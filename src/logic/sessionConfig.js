// Session de jeu en direct (companion mobile). Le TBI est MAÎTRE de la logique :
// il publie un instantané de l'état des équipes dans Supabase ; les téléphones
// s'y abonnent en lecture (Realtime). Tout est optionnel — le TBI fonctionne
// sans aucun téléphone connecté.
import { supabase } from './supabaseClient.js';
import { logText } from './logFormat.js';
import { extOn } from '../extensions/registry.js';
import { getDieFaces } from './forge.js';

const TABLE = 'quete_game_sessions';
const LOBBY_TABLE = 'quete_lobby_teams';
const INTENTS_TABLE = 'quete_intents';
const TRADES_TABLE = 'quete_trades';
const STATS_TABLE = 'quete_game_stats';

// Jeton secret d'une équipe créée depuis un téléphone : stocké dans le
// localStorage du tel, il lui permet de « posséder » son équipe (reconnexion,
// envoi d'intentions). Pas de compte (cf. décision : jeton local).
export function randomToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
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
export function buildSessionPayload({ teams, currentTeam, status, shopStock, shopFaceStock = [], log, extensions, locked = false, lv2Mode = false, englishMode = false, gameStats = null, forgeService = null }) {
  // Historique de questions par équipe (onglet mobile « anciennes questions ») :
  // dérivé du journal analytique, compacté aux derniers ~20 par équipe et aux
  // seuls champs utiles à la revue. Le mobile filtre ensuite sur SON équipe.
  const questionLog = {};
  for (const a of (gameStats?.answers || [])) {
    const arr = (questionLog[a.teamIdx] ||= []);
    arr.push({
      subject: a.subject, qText: a.qText, answers: a.answers,
      correctIndex: a.correctIndex, chosenIndex: a.chosenIndex,
      correct: a.correct, timedOut: a.timedOut, explanation: a.explanation,
    });
  }
  for (const k of Object.keys(questionLog)) questionLog[k] = questionLog[k].slice(-20);
  const forgeOn = extOn(extensions, 'forge');
  return {
    questionLog,
    status,
    currentTeam,
    // Édition d'équipement bloquée côté mobile pendant une résolution (question,
    // duel, événement, déplacement…) — le TBI reste maître du timing.
    locked: !!locked,
    extensions: extensions || null, // extensions actives (gate l'UI objets côté mobile)
    lv2Mode: !!lv2Mode, // mode « LV2 au choix » : le mobile montre le choix de langue au lobby
    englishMode: !!englishMode, // localisation anglaise (le mobile traduit son UI)
    shop: (shopStock || []).filter(Boolean), // clés du stock boutique (lecture mobile)
    shopFaces: forgeOn ? (shopFaceStock || []).filter(Boolean) : [], // vitrine de faces (Forge)
    // Prestation de forgeage en cours (session collaborative) : diffusée aux 2
    // mobiles concernés (le forgeron forge, le client suit) ; null sinon.
    forgeService: forgeService || null,
    // Historique : on n'envoie que les dernières entrées (l'onglet mobile les
    // affiche du plus récent au plus ancien). Les entrées structurées
    // { text, detail } sont aplaties en texte (le mobile lit des chaînes).
    log: (log || []).slice(-60).map(logText),
    teams: (teams || []).map((t, idx) => ({
      idx,
      name: t.name, emoji: t.emoji, color: t.color,
      money: t.money ?? 0,
      // « Hacking » : tant que > 0, le téléphone de CETTE équipe affiche la
      // cinématique « app piratée » en boucle (jusqu'à la résolution du tour).
      // `hackedBy` = attribution affichée (« le boss » ou l'équipe lanceuse).
      hacked: (t.hackedTurns || 0) > 0,
      hackedBy: t.hackedBy || null,
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
      // Pluie maudite (météo) : achats bloqués pendant X tours (info mobile).
      shopBlockedTurns: t.shopBlockedTurns || 0,
      wager: t.wager ? true : null,
      buffs: (t.buffs || []).map((b) => ({ type: b.type, turns: b.turns, n: b.n, subject: b.subject })),
      // Pactes de non-agression actifs (« Complots ») : promesses de NE PAS attaquer.
      promises: (t.promises || []).map((p) => ({ to: p.to, turns: p.turns })),
      // Coalitions (« attaques communes ») : on vise une même cible avec un allié.
      coalitions: (t.coalitions || []).map((c) => ({ with: c.with, against: c.against, turns: c.turns })),
      // Équipement publié en CLÉS (le mobile lit des clés) + specs d'enchant
      // par emplacement (Enchantement). Les specs COMPLÈTES (pas juste un
      // compteur) permettent au mobile d'afficher le détail des effets ajoutés
      // par un parchemin gravé (marqueur ✦ + bloc « Enchantement », utile pour
      // vérifier ce qu'on échange lors d'un troc).
      equipment: Object.fromEntries(['head', 'body', 'feet'].map((s) => {
        const v = t.equipment?.[s];
        return [s, typeof v === 'string' ? v : (v?.key ?? null)];
      })),
      enchants: Object.fromEntries(['head', 'body', 'feet'].map((s) => {
        const v = t.equipment?.[s];
        return [s, (v && typeof v === 'object' && Array.isArray(v.enchants)) ? v.enchants : []];
      })),
      bag: (t.bag || []).filter(Boolean),
      powers: t.powers || {},
      powerDef: t.powerDef, powerOff: t.powerOff,
      // Métier choisi (extension « Métiers ») : pilote le gating des onglets craft
      // côté mobile + l'affichage du sélecteur (null = pas encore choisi).
      metier: t.metier || null,
      // Alchimie : grimoire de l'équipe (ingrédients goûtés + recettes trouvées).
      knownIngredients: t.knownIngredients || [],
      knownRecipes: t.knownRecipes || [],
      // Forge de dés : les 6 faces actuelles (normalisées) + faces achetées non
      // posées, pour l'atelier de forge mobile. Publié seulement si l'extension
      // est active (sinon le mobile ne montre pas l'atelier).
      ...(forgeOn ? { dieFaces: getDieFaces(t), faceStock: t.faceStock || [] } : {}),
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

// --- Lobby : équipes créées depuis les téléphones (avant la partie) ---

// Crée ou met à jour la fiche d'équipe d'un téléphone (clé = code + token).
export async function upsertLobbyTeam(code, token, fields) {
  const { error } = await supabase.from(LOBBY_TABLE)
    .upsert({ code, token, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'code,token' });
  if (error) throw error;
}

// Liste des équipes d'un lobby (hors retirées), triées par ordre d'arrivée.
export async function fetchLobbyTeams(code) {
  const { data, error } = await supabase.from(LOBBY_TABLE)
    .select('*').eq('code', code).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Le TBI retire une équipe (l'élève le voit via removed=true).
export async function removeLobbyTeam(id) {
  const { error } = await supabase.from(LOBBY_TABLE).update({ removed: true }).eq('id', id);
  if (error) throw error;
}

// Au démarrage : le TBI inscrit l'index attribué à chaque équipe du lobby pour
// que chaque téléphone retrouve « son » équipe (par son token).
export async function assignLobbyIndices(code, byToken) {
  await Promise.all(Object.entries(byToken).map(([token, idx]) =>
    supabase.from(LOBBY_TABLE).update({ idx }).eq('code', code).eq('token', token)));
}

export function subscribeLobby(code, onChange) {
  const channel = supabase
    .channel(`quete-lobby-${code}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: LOBBY_TABLE, filter: `code=eq.${code}` },
      () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// --- Intents : commandes mobile -> TBI (édition d'équipement en jeu) ---

// Le téléphone envoie une intention ; le TBI (maître) la valide puis l'applique.
export async function sendIntent(code, token, type, payload = {}) {
  const { error } = await supabase.from(INTENTS_TABLE).insert({ code, token, type, payload });
  if (error) throw error;
}

export async function fetchIntents(code) {
  const { data, error } = await supabase.from(INTENTS_TABLE)
    .select('*').eq('code', code).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function deleteIntent(id) {
  const { error } = await supabase.from(INTENTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// Le TBI s'abonne aux nouvelles intentions (INSERT) d'une session.
export function subscribeIntents(code, onInsert) {
  const channel = supabase
    .channel(`quete-intents-${code}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: INTENTS_TABLE, filter: `code=eq.${code}` },
      (payload) => onInsert(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// --- Troc : propositions d'échange entre équipes (extension « trade ») ---
// Une offre : { code, from_idx, from_token, to_idx, give:{gold,bag[],equip[]},
// want:{...}, status:'pending'|'accepted'|'declined'|'cancelled'|'applied'|'failed' }.
// Le TBI (maître) re-vérifie et applique atomiquement les offres « accepted ».

export async function createTrade(code, fromToken, fromIdx, toIdx, give, want) {
  const { error } = await supabase.from(TRADES_TABLE)
    .insert({ code, from_token: fromToken, from_idx: fromIdx, to_idx: toIdx, give: give || {}, want: want || {}, status: 'pending' });
  if (error) throw error;
}

export async function fetchTrades(code) {
  const { data, error } = await supabase.from(TRADES_TABLE)
    .select('*').eq('code', code).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function setTradeStatus(id, status) {
  const { error } = await supabase.from(TRADES_TABLE).update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteTrade(id) {
  const { error } = await supabase.from(TRADES_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// Abonnement à toutes les évolutions d'offres d'une session (TBI + mobiles).
export function subscribeTrades(code, onChange) {
  const channel = supabase
    .channel(`quete-trades-${code}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: TRADES_TABLE, filter: `code=eq.${code}` },
      (payload) => onChange(payload))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// --- Analyse : archivage des statistiques de partie (dashboard `?analyse`) ---
// Une ligne par partie terminée. `data` = le journal analytique complet
// (answers/itemUses/powerUses + méta). Écrit une seule fois (cf. StatsArchiver).

export async function archiveGameStats({ code = null, classLabel = '', startedAt = null, subjects = [], data }) {
  const { error } = await supabase.from(STATS_TABLE).insert({
    code,
    class_label: classLabel || null,
    started_at: startedAt,
    subjects: subjects || [],
    data: data || {},
  });
  if (error) throw error;
}

// Toutes les parties archivées (récentes d'abord), filtrables par étiquette de classe.
export async function fetchGameStats({ classLabel = null } = {}) {
  let q = supabase.from(STATS_TABLE).select('*').order('ended_at', { ascending: false });
  if (classLabel) q = q.eq('class_label', classLabel);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Liste distincte des étiquettes de classe rencontrées (pour le filtre du dashboard).
export async function fetchClassLabels() {
  const { data, error } = await supabase.from(STATS_TABLE)
    .select('class_label').not('class_label', 'is', null);
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.class_label).filter(Boolean))];
}
