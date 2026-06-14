// Objets qui FORCENT un thème « spécial » (Culture générale / Hardcore lycée),
// jamais tiré par une case du plateau — seulement via ces objets/consommables.
//   - sabotage : impose le thème à un adversaire (forceSubject target:'target')
//   - esquive  : bascule TA question vers la Culture G (rerollQuestion via bouton)
//
// UPSERT par clé (préfixe `pe`) — n'écrase QUE ces objets. Idempotent.
//   node scripts/seed-pool-themes.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// [key, name, icon, img, slot, rarity, price, desc, effects]
const DEFS = [
  // Sabotage : impose le thème à un adversaire au choix (prochaine question)
  ['peEnigmeCG', 'Énigme savante', '🧠', null, 'consumable', 'commun', 10,
    'Impose une question de culture générale à une équipe adverse.',
    [{ kind: 'trigger', on: 'use', do: [{ action: 'forceSubject', target: 'target', subject: 'cultureG' }] }]],
  ['peColleHC', 'Colle du proviseur', '💀', null, 'consumable', 'rare', 18,
    'Impose une rude question de niveau lycée à une équipe adverse.',
    [{ kind: 'trigger', on: 'use', do: [{ action: 'forceSubject', target: 'target', subject: 'hardcore' }] }]],
  // Esquive : transforme TA question courante en culture générale (bouton en jeu)
  ['peGrimoireCG', 'Almanach des curieux', '📚', 'grimoire07', 'body', 'rare', 24,
    'Te permet de transformer ta question en culture générale.',
    [{ kind: 'trigger', on: 'question', n: 1, do: [{ action: 'rerollQuestion', subject: 'cultureG' }] }]],
];

const rows = DEFS.map(([key, name, icon, img, slot, rarity, price, desc, effects], i) => ({
  key, name, description: desc, icon, img, slot, rarity, price,
  loot_only: rarity === 'legendaire',
  effects, enabled: true, ord: 1100 + i,
}));

console.log(`Préparé : ${rows.length} objets « thème spécial ».`);
const { error } = await supabase.from('quete_items').upsert(rows, { onConflict: 'key' });
if (error) { console.error('UPSERT échec :', error.message); process.exit(1); }
const { count } = await supabase.from('quete_items').select('*', { count: 'exact', head: true });
console.log(`Terminé. ${rows.length} objets insérés/à jour. Total en base : ${count}.`);
