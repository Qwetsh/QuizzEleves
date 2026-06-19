// Chargement des questions depuis Supabase (table public.quete_questions) —
// source de vérité éditable à la main. Stratégie offline-safe identique à
// l'équilibrage : au boot on applique le cache localStorage (synchrone), puis
// on rafraîchit depuis Supabase en arrière-plan. Si tout échoue, le store
// retombe sur les fichiers JS embarqués (cf. data/questions/index.js).
import { supabase } from './supabaseClient.js';
import { setQuestionData } from '../data/questions/index.js';

const LS_KEY = 'quete_questions_v1';
const PAGE = 1000;

// Reconstruit le format interne du jeu { q, a, c, e, t } à partir d'une ligne
// DB (4 colonnes de réponses → tableau sans les cases vides ; correcte 1-4 → c).
function rowToQuestion(r) {
  // a[] (FR) ET a_en[] (EN) construits dans la MÊME boucle → alignés par position
  // (on ne garde que les positions où la réponse FR existe ; a_en[i] = null si
  // pas encore traduit, repli FR géré à l'affichage).
  const a = [];
  const a_en = [];
  for (const col of ['a', 'b', 'c', 'd']) {
    const fr = r[`rep_${col}`];
    if (fr == null || fr === '') continue;
    a.push(fr);
    a_en.push(r[`rep_${col}_en`] ?? null);
  }
  const hasEn = !!(r.q_en || a_en.some(Boolean) || r.e_en);
  // `level` est conservé pour un filtrage par niveau fiable (cohérent avec
  // l'éditeur), indépendant du préfixe du thème.
  return {
    q: r.q, a, c: (r.correcte || 1) - 1, e: r.e ?? '', t: r.t ?? '', level: r.level ?? null,
    // Version anglaise (null si absente → repli FR à l'affichage). a_en aligné sur a.
    q_en: r.q_en ?? null, a_en: hasEn ? a_en : null, e_en: r.e_en ?? null,
  };
}

// Regroupe les lignes en { cycle4: { subject: [...] }, brevet: { subject: [...] } }
function groupRows(rows) {
  const data = { cycle4: {}, brevet: {} };
  const byPool = { cycle4: {}, brevet: {} };
  for (const r of rows) {
    if (r.enabled === false) continue;
    const pool = r.pool === 'brevet' ? 'brevet' : 'cycle4';
    (byPool[pool][r.subject] ||= []).push(r);
  }
  for (const pool of ['cycle4', 'brevet']) {
    for (const subject of Object.keys(byPool[pool])) {
      const list = byPool[pool][subject].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
      data[pool][subject] = list.map(rowToQuestion);
    }
  }
  return data;
}

function writeCache(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

// Boot synchrone : applique le dernier instantané connu s'il existe (sinon le
// store reste sur les fichiers JS). Aucun appel réseau.
export function applyCachedQuestions() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY));
    if (cached && (cached.cycle4 || cached.brevet)) setQuestionData(cached);
  } catch { /* cache illisible : on garde les fichiers JS */ }
}

// Récupère toutes les questions (paginé pour ne jamais tronquer en silence),
// remplace le store et met à jour le cache. Renvoie le nombre chargé.
export async function refreshQuestions() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('quete_questions')
      // `level` est INDISPENSABLE : sans lui, rowToQuestion met level=null et le
      // filtrage par niveau retombe sur le préfixe de `t` (qui ne couvre pas le 6e).
      .select('pool,subject,level,q,rep_a,rep_b,rep_c,rep_d,correcte,e,t,enabled,ord,q_en,rep_a_en,rep_b_en,rep_c_en,rep_d_en,e_en')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  if (!rows.length) return 0; // base vide : on garde le fallback en place
  const data = groupRows(rows);
  setQuestionData(data);
  writeCache(data);
  return rows.length;
}

// --- CRUD pour l'éditeur in-game (lignes brutes, avec id) ---

const EDIT_COLS = 'id,pool,subject,level,q,rep_a,rep_b,rep_c,rep_d,correcte,e,t,enabled,ord,q_en,rep_a_en,rep_b_en,rep_c_en,rep_d_en,e_en';

// Toutes les lignes (paginé) avec leur id, pour l'édition.
export async function fetchQuestionRows() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('quete_questions').select(EDIT_COLS)
      .order('pool', { ascending: true })
      .order('subject', { ascending: true })
      .order('ord', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

// Ne garde que les colonnes de la table (les réponses vides → null).
function toPayload(row) {
  const blank = (v) => (v == null || v === '' ? null : v);
  return {
    pool: row.pool === 'brevet' ? 'brevet' : 'cycle4',
    subject: row.subject,
    level: blank(row.level),
    q: row.q,
    rep_a: row.rep_a,
    rep_b: row.rep_b,
    rep_c: blank(row.rep_c),
    rep_d: blank(row.rep_d),
    correcte: row.correcte,
    e: blank(row.e),
    t: blank(row.t),
    enabled: row.enabled !== false,
    ord: row.ord ?? null,
    // Version anglaise (toutes nullables ; repli FR à l'affichage).
    q_en: blank(row.q_en),
    rep_a_en: blank(row.rep_a_en),
    rep_b_en: blank(row.rep_b_en),
    rep_c_en: blank(row.rep_c_en),
    rep_d_en: blank(row.rep_d_en),
    e_en: blank(row.e_en),
  };
}

// Insère (sans id) ou met à jour (avec id). Renvoie la ligne enregistrée.
export async function saveQuestionRow(row) {
  const payload = { ...toPayload(row), updated_at: new Date().toISOString() };
  const q = row.id
    ? supabase.from('quete_questions').update(payload).eq('id', row.id)
    : supabase.from('quete_questions').insert(payload);
  const { data, error } = await q.select(EDIT_COLS).single();
  if (error) throw error;
  return data;
}

export async function deleteQuestionRow(id) {
  const { error } = await supabase.from('quete_questions').delete().eq('id', id);
  if (error) throw error;
}
