// Client Supabase pour la config d'équilibrage (table public.quete_balance,
// projet PersoDB). La clé "publishable" (anon) est PUBLIQUE par conception —
// elle finit dans le bundle front et la sécurité repose sur les policies RLS
// de la table (lecture/écriture publiques sur cette seule table). On peut la
// surcharger via les variables d'env Vite si on bascule de projet.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';

// Création PARESSEUSE du client : createClient() instancie un RealtimeClient
// qui exige WebSocket (absent sous Node 20 — fait planter `npm test` en CI). On
// n'utilise jamais le Realtime ; le client n'est donc créé qu'au premier accès
// réseau réel (jamais déclenché par le simple import des tests).
let _client = null;
const instance = () => (_client ||= createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}));

export const supabase = new Proxy({}, {
  get(_target, prop) {
    const c = instance();
    const value = c[prop];
    return typeof value === 'function' ? value.bind(c) : value;
  },
});

export const BALANCE_TABLE = 'quete_balance';
export const BALANCE_ROW_ID = 'current';
