// Client Supabase pour la config d'équilibrage (table public.quete_balance,
// projet PersoDB). La clé "publishable" (anon) est PUBLIQUE par conception —
// elle finit dans le bundle front et la sécurité repose sur les policies RLS
// de la table (lecture/écriture publiques sur cette seule table). On peut la
// surcharger via les variables d'env Vite si on bascule de projet.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const BALANCE_TABLE = 'quete_balance';
export const BALANCE_ROW_ID = 'current';
