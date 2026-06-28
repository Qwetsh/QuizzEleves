// GLOSSAIRE — source unique pour :
//  1. résoudre une clé d'entité (objet, pouvoir, set, matière, terme) en CONTENU
//     de fiche d'info { name, icon, accent, badge, desc, lines }.
//  2. construire un INDEX des noms affichés et repérer ces mots-clés dans un
//     texte (journal) pour les rendre cliquables.
// Couvre automatiquement les objets futurs (ITEMS est peuplé dynamiquement
// depuis Supabase). Bilingue : tout dépend de `lang`.
import { ITEMS, RARITIES, SLOTS } from '../data/items.js';
import { POWERS } from '../data/powers.js';
import { SETS } from '../data/sets.js';
import { SUBJECTS } from '../data/subjects.js';
import { GLOSSARY_TERMS } from '../data/glossaryTerms.js';
import { locName, locDesc } from '../i18n/content.js';
import { getLang } from '../i18n/lang.js';
import { describeEffect, itemEffectLines } from './effectText.js';

const EN = (lang) => lang === 'en';

// --- Petites étiquettes bilingues (rareté / slot) ----------------------
const RARITY_EN = { commun: 'Common', rare: 'Rare', legendaire: 'Legendary' };
const SLOT_EN = { head: 'Head', body: 'Armor', feet: 'Amulet' };
const rarityLabel = (r, lang) => { const m = RARITIES[r]; return m ? (EN(lang) ? (RARITY_EN[r] || m.name) : m.name) : ''; };
const slotLabel = (slot, lang) => { const m = SLOTS[slot]; return m ? (EN(lang) ? (SLOT_EN[slot] || m.name) : m.name) : ''; };

// --- Résolution d'une entité en contenu de fiche -----------------------
function resolveItem(key, lang, knownIngredients) {
  const it = ITEMS[key];
  if (!it) return null;
  const rar = RARITIES[it.rarity];
  const kind = it.slot === 'consumable' ? (EN(lang) ? 'Consumable' : 'Consommable') : slotLabel(it.slot, lang);
  const badge = [rarityLabel(it.rarity, lang), kind].filter(Boolean).join(' · ');
  return {
    type: 'item', key, name: locName(it, lang), icon: it.icon, accent: rar?.color || '#b8862c',
    // Ingrédient d'alchimie : effet caché (???) tant que `knownIngredients` ne le
    // contient pas (passé par l'appelant qui a le contexte d'équipe).
    badge, desc: locDesc(it, lang), lines: itemEffectLines(it, { lang, key, knownIngredients }),
  };
}

function resolvePower(key, lang) {
  const p = POWERS[key];
  if (!p) return null;
  const lvl = EN(lang) ? 'Lvl' : 'Niv';
  const lines = (p.levels || []).map((lv, i) => { const d = locDesc(lv, lang); return d ? `${lvl}.${i + 1} : ${d}` : ''; }).filter(Boolean);
  return {
    type: 'power', key, name: locName(p, lang), icon: p.icon, accent: p.color || '#8745d4',
    badge: EN(lang) ? 'Power' : 'Pouvoir', desc: locDesc(p, lang), lines,
  };
}

function resolveSet(key, lang) {
  const s = SETS[key];
  if (!s) return null;
  const two = (s.bonus2 || []).map((fx) => describeEffect(fx, lang)).filter(Boolean);
  const three = (s.bonus3 || []).map((fx) => describeEffect(fx, lang)).filter(Boolean);
  const lines = [];
  if (two.length) lines.push(`${EN(lang) ? '2 pieces' : '2 pièces'} : ${two.join(', ')}`);
  if (three.length) lines.push(`${EN(lang) ? '3 pieces' : '3 pièces'} : ${three.join(', ')}`);
  return {
    type: 'set', key, name: locName(s, lang), icon: s.icon || '⚜️', accent: s.color || '#a8771a',
    badge: EN(lang) ? 'Item set' : 'Set d’objets', desc: '', lines,
  };
}

function resolveSubject(key, lang) {
  const s = SUBJECTS[key];
  if (!s) return null;
  const name = locName(s, lang);
  return {
    type: 'subject', key, name, icon: s.icon, accent: s.color || '#b8862c',
    badge: EN(lang) ? 'Subject' : 'Matière',
    desc: EN(lang) ? `Questions in ${name}.` : `Questions de ${name}.`, lines: [],
  };
}

function resolveTerm(key, lang) {
  const t = GLOSSARY_TERMS[key];
  if (!t) return null;
  return {
    type: 'term', key, name: EN(lang) ? t.name_en : t.name, icon: t.icon || '📖', accent: t.color || '#7a5e3a',
    badge: EN(lang) ? 'Game term' : 'Terme de jeu', desc: EN(lang) ? t.desc_en : t.desc, lines: [],
  };
}

export function resolveEntry(type, key, lang = getLang(), opts = {}) {
  switch (type) {
    case 'item': return resolveItem(key, lang, opts.knownIngredients);
    case 'power': return resolvePower(key, lang);
    case 'set': return resolveSet(key, lang);
    case 'subject': return resolveSubject(key, lang);
    case 'term': return resolveTerm(key, lang);
    default: return null;
  }
}

// Résout un DESCRIPTEUR de fiche (depuis un trigger) : entité par clé, OU effet
// HUD ad hoc déjà porteur de son contenu (type:'effect'). `opts.knownIngredients`
// (contexte d'équipe) permet de masquer l'effet d'un ingrédient non découvert.
export function resolveDescriptor(d, lang = getLang(), opts = {}) {
  if (!d) return null;
  if (d.type === 'effect') {
    return { type: 'effect', name: d.name, icon: d.icon, accent: d.accent || d.color || '#7a5e3a',
      badge: d.badge || null, desc: d.desc || '', lines: d.lines || [] };
  }
  return resolveEntry(d.type, d.key, lang, opts);
}

// --- Index des mots-clés + tokenisation --------------------------------
const STOPWORDS = new Set(['les', 'des', 'une', 'multi']);
const isWordChar = (ch) => !!ch && /[\p{L}\p{N}]/u.test(ch);

export function buildGlossaryIndex(lang) {
  const entries = [];
  const add = (phrase, type, key) => {
    if (!phrase) return;
    const p = String(phrase).trim();
    if (p.length < 3 || STOPWORDS.has(p.toLowerCase())) return;
    entries.push({ phrase: p, lower: p.toLowerCase(), type, key });
  };
  for (const [key, it] of Object.entries(ITEMS)) add(locName(it, lang), 'item', key);
  for (const [key, p] of Object.entries(POWERS)) add(locName(p, lang), 'power', key);
  for (const [key, s] of Object.entries(SETS)) add(locName(s, lang), 'set', key);
  for (const [key, s] of Object.entries(SUBJECTS)) add(locName(s, lang), 'subject', key);
  for (const [key, t] of Object.entries(GLOSSARY_TERMS)) {
    add(EN(lang) ? t.name_en : t.name, 'term', key);
    for (const a of (EN(lang) ? t.aliases_en : t.aliases) || []) add(a, 'term', key);
  }
  // Plus longue d'abord (priorité au match le plus spécifique), dédup, bucket par
  // 1re lettre (perf : on ne teste que les candidats commençant par le bon char).
  entries.sort((a, b) => b.lower.length - a.lower.length);
  const seen = new Set();
  const byChar = new Map();
  for (const e of entries) {
    if (seen.has(e.lower)) continue;
    seen.add(e.lower);
    const c = e.lower[0];
    if (!byChar.has(c)) byChar.set(c, []);
    byChar.get(c).push(e);
  }
  return { byChar };
}

// Cache mémoïsé par (lang, version) — `version` = itemsVersion du store, pour
// reconstruire quand le catalogue d'objets change (chargement Supabase).
let _cache = { lang: null, version: null, index: null };
export function getGlossaryIndex(lang = getLang(), version = 0) {
  if (_cache.index && _cache.lang === lang && _cache.version === version) return _cache.index;
  _cache = { lang, version, index: buildGlossaryIndex(lang) };
  return _cache.index;
}

// Découpe un texte en segments : { text } (brut) ou { text, type, key } (mot-clé
// cliquable). Match à BORNES DE MOTS (accents gérés), plus longue correspondance
// d'abord, insensible à la casse.
export function tokenizeText(text, index) {
  const byChar = index?.byChar;
  if (!text || !byChar) return [{ text: text || '' }];
  const out = [];
  const lower = text.toLowerCase();
  let i = 0;
  let buf = '';
  while (i < text.length) {
    let matched = null;
    if (!isWordChar(text[i - 1])) {
      const cands = byChar.get(lower[i]);
      if (cands) {
        for (const e of cands) {
          if (lower.startsWith(e.lower, i) && !isWordChar(text[i + e.lower.length])) { matched = e; break; }
        }
      }
    }
    if (matched) {
      if (buf) { out.push({ text: buf }); buf = ''; }
      out.push({ text: text.substr(i, matched.lower.length), type: matched.type, key: matched.key });
      i += matched.lower.length;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  if (buf) out.push({ text: buf });
  return out;
}
