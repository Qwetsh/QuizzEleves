// Session de jeu en direct (companion mobile). Le TBI est MAÎTRE de la logique :
// il publie un instantané de l'état des équipes dans Supabase ; les téléphones
// s'y abonnent en lecture (Realtime). Tout est optionnel — le TBI fonctionne
// sans aucun téléphone connecté.
import { supabase } from './supabaseClient.js';
import { logText } from './logFormat.js';

const TABLE = 'quete_game_sessions';
// Sans I/O/0/1 pour éviter les confusions de lecture du code d'appairage.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function randomCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

// URL d'appairage encodée dans le QR (respecte la base GitHub Pages).
export function joinUrl(code) {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}?join=${code}`;
}

// Sous-ensemble publié vers les téléphones. On n'envoie que les CLÉS d'objets/
// pouvoirs : le mobile (même app) résout ITEMS/POWERS localement.
export function buildSessionPayload({ teams, currentTeam, status, shopStock, log, extensions }) {
  return {
    status,
    currentTeam,
    extensions: extensions || null, // extensions actives (gate l'UI objets côté mobile)
    shop: (shopStock || []).filter(Boolean), // clés du stock boutique (lecture mobile)
    // Historique : on n'envoie que les dernières entrées (l'onglet mobile les
    // affiche du plus récent au plus ancien). Les entrées structurées
    // { text, detail } sont aplaties en texte (le mobile lit des chaînes).
    log: (log || []).slice(-60).map(logText),
    teams: (teams || []).map((t, idx) => ({
      idx,
      name: t.name, emoji: t.emoji, color: t.color,
      money: t.money ?? 0,
      correct: t.correct ?? 0, wrong: t.wrong ?? 0,
      pos: t.pos,
      // Effets transitoires (rappel visuel côté élève) — cf. getTeamEffects.
      forcedSubject: t.forcedSubject || null,
      randomPathNext: !!t.randomPathNext,
      itemShield: t.itemShield || 0,
      itemFumigene: !!t.itemFumigene,
      itemFumigeneTurns: t.itemFumigeneTurns || 0,
      itemTimerBonus: t.itemTimerBonus || 0,
      doubleActive: !!t.doubleActive,
      doubleExtra: t.doubleExtra || 0,
      sablierActif: !!t.sablierActif,
      wager: t.wager ? true : null,
      buffs: (t.buffs || []).map((b) => ({ type: b.type, turns: b.turns, n: b.n, subject: b.subject })),
      equipment: t.equipment || { head: null, body: null, feet: null },
      bag: (t.bag || []).filter(Boolean),
      powers: t.powers || {},
      powerDef: t.powerDef, powerOff: t.powerOff,
    })),
  };
}

// --- Côté TBI (publication) ---

// Crée une session avec un code unique (réessaie sur collision de code).
export async function createSession(payload) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from(TABLE).insert({ code, data: payload });
    if (!error) return code;
    if (error.code !== '23505') throw error; // 23505 = collision de clé → on réessaie
  }
  throw new Error('Impossible de générer un code de session.');
}

export async function publishSession(code, payload) {
  const { error } = await supabase.from(TABLE)
    .upsert({ code, data: payload, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// --- Côté mobile (lecture) ---

export async function fetchSession(code) {
  const { data, error } = await supabase.from(TABLE).select('data').eq('code', code).maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

// S'abonne aux mises à jour de la session ; renvoie une fonction de désabonnement.
export function subscribeSession(code, onData) {
  const channel = supabase
    .channel(`quete-session-${code}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `code=eq.${code}` },
      (payload) => onData(payload.new?.data ?? null))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
