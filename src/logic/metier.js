// ============================================================
//  Métiers (extension « metier »)
//
//  Quand l'extension est active, chaque équipe choisit UN métier au 1er tour
//  (juste après le coffre de bienvenue) et ne peut plus pratiquer QUE l'artisanat
//  correspondant. Les 3 métiers correspondent 1-pour-1 aux 3 extensions de craft :
//    forgeron  → forge   (faces de dé)
//    alchimiste → alchemy (potions)
//    enchanteur → enchant (parchemins)
//  L'id d'un métier === l'id de l'extension de craft qu'il débloque, ce qui rend
//  le gating trivial (`team.metier === craft`).
//
//  Extension coupée → comportement historique : les 3 crafts sont ouverts à tous.
// ============================================================
import { extOn } from '../extensions/registry.js';

export const METIERS = [
  {
    id: 'forge', icon: '🔨', color: '#c8893a',
    name: 'Forgeron', name_en: 'Smith',
    tagline: 'Maître de la forge de dés', tagline_en: 'Master of the dice forge',
    desc: 'Tu peux forger les faces de ton dé. Pas de potions ni de parchemins.',
    desc_en: 'You can forge your die faces. No potions or scrolls.',
  },
  {
    id: 'alchemy', icon: '⚗️', color: '#7e57c2',
    name: 'Alchimiste', name_en: 'Alchemist',
    tagline: 'Distille des potions', tagline_en: 'Distils potions',
    desc: 'Tu peux distiller des potions. Pas de forge ni de parchemins.',
    desc_en: 'You can distil potions. No forging or scrolls.',
  },
  {
    id: 'enchant', icon: '✒️', color: '#2f9d8f',
    name: 'Enchanteur', name_en: 'Enchanter',
    tagline: 'Grave et applique les parchemins', tagline_en: 'Scribes and applies scrolls',
    desc: 'Tu peux graver et appliquer des parchemins. Pas de forge ni de potions.',
    desc_en: 'You can scribe and apply scrolls. No forging or potions.',
  },
];

export const METIER_BY_ID = Object.fromEntries(METIERS.map((m) => [m.id, m]));
export const METIER_IDS = METIERS.map((m) => m.id);

// Nom/description localisés d'un métier selon la langue ('fr' | 'en').
export const metierName = (m, lang) => (lang === 'en' ? m.name_en : m.name) || m.name;
export const metierTagline = (m, lang) => (lang === 'en' ? m.tagline_en : m.tagline) || m.tagline;
export const metierDesc = (m, lang) => (lang === 'en' ? m.desc_en : m.desc) || m.desc;

// L'extension « Métiers » est-elle EXPLICITEMENT active ? Opt-in STRICT : une clé
// absente = OFF — y compris pour les sauvegardes antérieures à la feature (sans
// quoi extOn() la croirait active par compat « vieilles saves » et bloquerait à
// tort tous les crafts des parties en cours).
export const metierActive = (extensions) => extensions?.metier === true;

// Le MÉTIER de l'équipe autorise-t-il le craft `craft` ? (sans tenir compte de
// l'activation de l'extension du craft — utile pour les gardes du moteur, où
// l'extension est déjà supposée active en amont.)
//  - extension « metier » coupée → oui (comportement historique)
//  - sinon                       → seulement si le métier choisi correspond
export function metierAllows(extensions, team, craft) {
  if (!metierActive(extensions)) return true;
  return team?.metier === craft;
}

// Une équipe peut-elle pratiquer le craft `craft` (= 'forge' | 'alchemy' | 'enchant') ?
// Combine l'activation de l'extension du craft ET la restriction de métier — utilisé
// pour le gating d'UI (boutons/onglets : on ne montre que ce qui est jouable).
export function craftEnabledFor(extensions, team, craft) {
  return extOn(extensions, craft) && metierAllows(extensions, team, craft);
}

// L'équipe doit-elle encore choisir son métier ? (extension active + pas encore choisi)
export function metierPending(extensions, team) {
  return metierActive(extensions) && team != null && !team.metier;
}
