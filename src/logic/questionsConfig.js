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
  const a_img = [];
  for (const col of ['a', 'b', 'c', 'd']) {
    const fr = r[`rep_${col}`];
    const img = r[`rep_${col}_img`] ?? null;
    // On garde la position si elle porte un TEXTE ou une IMAGE. Réponse « image
    // seule » possible (ex. choisir le bon drapeau parmi 4) : texte vide + image.
    if ((fr == null || fr === '') && !img) continue;
    a.push(fr == null ? '' : fr);
    a_en.push(r[`rep_${col}_en`] ?? null);
    // Média par réponse (URL du bucket, nom opaque) aligné sur `a` par position.
    a_img.push(img);
  }
  const hasEn = !!(r.q_en || a_en.some(Boolean) || r.e_en);
  const hasAnsImg = a_img.some(Boolean);
  // `level` est conservé pour un filtrage par niveau fiable (cohérent avec
  // l'éditeur), indépendant du préfixe du thème.
  return {
    q: r.q, a, c: (r.correcte || 1) - 1, e: r.e ?? '', t: r.t ?? '', level: r.level ?? null,
    // Version anglaise (null si absente → repli FR à l'affichage). a_en aligné sur a.
    q_en: r.q_en ?? null, a_en: hasEn ? a_en : null, e_en: r.e_en ?? null,
    // Médias (URL publique du bucket 'quete-questions', noms opaques anti-triche) :
    // `img` = média de la question ; `a_img` = média par réponse (aligné sur `a`).
    img: r.img ?? null, a_img: hasAnsImg ? a_img : null,
    // Mode de rendu spécial (ex. 'silhouette' = image masquée en noir jusqu'à la
    // révélation, façon « Qui est ce Pokémon ? »). null = rendu normal.
    render: r.render ?? null,
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
      .select('pool,subject,level,q,rep_a,rep_b,rep_c,rep_d,correcte,e,t,enabled,ord,q_en,rep_a_en,rep_b_en,rep_c_en,rep_d_en,e_en,img,rep_a_img,rep_b_img,rep_c_img,rep_d_img,render')
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

const EDIT_COLS = 'id,pool,subject,level,q,rep_a,rep_b,rep_c,rep_d,correcte,e,t,enabled,ord,difficulte,generalite,q_en,rep_a_en,rep_b_en,rep_c_en,rep_d_en,e_en,img,rep_a_img,rep_b_img,rep_c_img,rep_d_img,render';

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
    // Métadonnées d'auteur (paliers de difficulté / généralité, 1-5, nullables).
    difficulte: row.difficulte == null || row.difficulte === '' ? null : Number(row.difficulte),
    generalite: row.generalite == null || row.generalite === '' ? null : Number(row.generalite),
    // Version anglaise (toutes nullables ; repli FR à l'affichage).
    q_en: blank(row.q_en),
    rep_a_en: blank(row.rep_a_en),
    rep_b_en: blank(row.rep_b_en),
    rep_c_en: blank(row.rep_c_en),
    rep_d_en: blank(row.rep_d_en),
    e_en: blank(row.e_en),
    // Médias (URL publique du bucket, nullables). Nom de fichier OPAQUE (cf.
    // uploadQuestionMedia) pour ne pas trahir la réponse via l'URL.
    img: blank(row.img),
    rep_a_img: blank(row.rep_a_img),
    rep_b_img: blank(row.rep_b_img),
    rep_c_img: blank(row.rep_c_img),
    rep_d_img: blank(row.rep_d_img),
    // Mode de rendu spécial ('silhouette' pour « Qui est ce Pokémon ? »).
    render: blank(row.render),
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

// --- Médias de question (bucket Storage public 'quete-questions') ---

const MEDIA_BUCKET = 'quete-questions';

// Identifiant OPAQUE : le nom de fichier ne doit JAMAIS encoder la réponse (ex.
// pas `fr.png` pour un drapeau français, sinon un élève lit la réponse dans l'URL
// via les devtools / le mobile). On génère donc un nom aléatoire.
function opaqueName(ext) {
  const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `q-${rnd}.${ext}`;
}

// Upload d'un média de question, renvoie l'URL publique. Nom de fichier opaque.
export async function uploadQuestionMedia(file) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = opaqueName(ext);
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
