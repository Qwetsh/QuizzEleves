// SOURCE UNIQUE des effets transitoires posés sur une équipe (consommés à son
// prochain tour / sa prochaine question). Partagée par la fiche d'équipe
// (BottomBar), l'aura du pion (BoardSVG) et le companion mobile, pour garantir
// qu'un effet en attente a TOUJOURS un rappel visuel — où qu'on regarde.
//   tone: 'buff' (positif/neutre) | 'malus' (négatif). L'aura du pion ne
//   s'affiche que pour les malus.
// Chaque entrée : { key, tone, icon, color, n?, name, desc, label, link? }
//   - name  : libellé COURT (chip du HUD).
//   - desc  : phrase complète (fiche d'info au survol/clic).
//   - label : conservé = desc (compat companion mobile).
//   - link  : { type, key } quand l'effet pointe une entité (set, matière) →
//             la fiche affiche cette entité plutôt qu'un texte ad hoc.
import { SUBJECTS } from '../data/subjects.js';
import { activeSets, getEffectValue, diceLabel } from './itemEffects.js';
import { locName } from '../i18n/content.js';
import { getLang } from '../i18n/lang.js';

const L = (lang, fr, en) => (lang === 'en' ? en : fr);
const plural = (n, lang, fr, en) => (n > 1 ? L(lang, fr, en) : '');

// Effets de durée (buffs des consommables) → name + desc + ton pour l'affichage.
const BUFF_INFO = {
  themeBonus: { tone: 'buff', icon: '💰', color: '#c8911f',
    name: (b, lang) => L(lang, '+Or/réponse', '+Gold/answer'),
    desc: (b, lang) => L(lang, `+${b.n ?? 5} or par bonne réponse${b.subject ? ` en ${locName(SUBJECTS[b.subject], lang) || b.subject}` : ''}`, `+${b.n ?? 5} gold per correct answer${b.subject ? ` in ${locName(SUBJECTS[b.subject], lang) || b.subject}` : ''}`) },
  noRecul: { tone: 'buff', icon: '\u{1F6DF}', color: '#3b6cb3',
    name: (b, lang) => L(lang, 'Sans recul', 'No setback'),
    desc: (b, lang) => L(lang, 'Pas de recul en cas d’erreur', 'No setback on a wrong answer') },
  advanceOnCorrect: { tone: 'buff', icon: '🏃', color: '#2f9d5a',
    name: (b, lang) => L(lang, 'Avance si juste', 'Advance if right'),
    desc: (b, lang) => L(lang, 'Avance d’une case à chaque bonne réponse', 'Move forward one square on each correct answer') },
  diceBonus: { tone: 'buff', icon: '🚀', color: '#2f9d5a',
    name: (b, lang) => L(lang, 'Dé bonus', 'Die bonus'),
    desc: (b, lang) => L(lang, `Le dé fait +${b.n ?? 1} à chaque lancer`, `The die rolls +${b.n ?? 1} each time`) },
  randomPath: { tone: 'buff', icon: '🎲', color: '#8745d4',
    name: (b, lang) => L(lang, 'Voie aléatoire', 'Random path'),
    desc: (b, lang) => L(lang, 'La voie est choisie au hasard aux carrefours', 'Your path is chosen at random at junctions') },
  duelImmune: { tone: 'buff', icon: '\u{1F6E1}\u{FE0F}', color: '#3b6cb3',
    name: (b, lang) => L(lang, 'Anti-duel', 'Duel-proof'),
    desc: (b, lang) => L(lang, 'Immunisé contre les duels', 'Immune to duels') },
  loseOnWrong: { tone: 'malus', icon: '💸', color: '#b5341f',
    name: (b, lang) => L(lang, 'Malus erreur', 'Wrong-answer malus'),
    desc: (b, lang) => L(lang, `Perd ${b.n ?? 5} or en cas d’erreur`, `Lose ${b.n ?? 5} gold on a wrong answer`) },
  bleedGold: { tone: 'malus', icon: '🩸', color: '#b5341f', link: { type: 'term', key: 'saignementOr' },
    name: (b, lang) => L(lang, 'Saignement d’or', 'Gold bleed'),
    desc: (b, lang) => L(lang, `Saignement d'or : ${b.mode === 'steal' ? 'volé de' : 'perd'} ${diceLabel(b.n)}/tour`, `Gold bleed: ${b.mode === 'steal' ? 'stolen' : 'lose'} ${diceLabel(b.n)}/turn`) },
  itemStealImmune: { tone: 'buff', icon: '🔒', color: '#3b6cb3',
    name: (b, lang) => L(lang, 'Anti-vol d’objet', 'Item-theft proof'),
    desc: (b, lang) => L(lang, "Immunisé au vol d'objet", 'Immune to item theft') },
  goldStealImmune: { tone: 'buff', icon: '🔒', color: '#c8911f',
    name: (b, lang) => L(lang, 'Anti-vol d’or', 'Gold-theft proof'),
    desc: (b, lang) => L(lang, "Immunisé au vol d'or", 'Immune to gold theft') },
  reflectChance: { tone: 'buff', icon: '↩️', color: '#8745d4', link: { type: 'term', key: 'renvoi' },
    name: (b, lang) => L(lang, 'Renvoi', 'Reflect'),
    desc: (b, lang) => L(lang, `Renvoi d'effet : ${b.n ?? 0}%`, `Effect reflect: ${b.n ?? 0}%`) },
};

export function getTeamEffects(team, lang = getLang()) {
  if (!team) return [];
  const out = [];
  const push = (e) => out.push({ ...e, label: e.desc });

  // --- Buffs / protections (déclenchés au tour ou à la prochaine question) ---
  if (team.itemShield > 0) {
    const n = team.itemShield;
    push({ key: 'shield', tone: 'buff', icon: '\u{1F6E1}️', n: n > 1 ? n : null, color: '#3b6cb3', link: { type: 'term', key: 'bouclierBois' },
      name: L(lang, 'Bouclier', 'Shield'),
      desc: L(lang, `Bouclier : annule ${n} recul${plural(n, lang, 's', 's')}`, `Shield: cancels ${n} setback${plural(n, lang, 's', 's')}`) });
  }
  if (team.itemFumigene) {
    const t = team.itemFumigeneTurns || 0;
    push({ key: 'fumigene', tone: 'buff', icon: '\u{1F4A8}', n: t || null, color: '#7a8a99', link: { type: 'term', key: 'fumigene' },
      name: L(lang, 'Fumigène', 'Smoke bomb'),
      desc: L(lang, `Fumigène : prochain pouvoir offensif annulé${t ? ` (${t} tour${plural(t, lang, 's', 's')})` : ''}`, `Smoke bomb: next offensive power cancelled${t ? ` (${t} turn${plural(t, lang, 's', 's')})` : ''}`) });
  }
  if (team.itemTimerBonus > 0) {
    push({ key: 'time', tone: 'buff', icon: '⏳', n: team.itemTimerBonus, color: '#2f9d5a',
      name: L(lang, '+Temps', '+Time'),
      desc: L(lang, `+${team.itemTimerBonus}s à ta prochaine question`, `+${team.itemTimerBonus}s on your next question`) });
  }
  if (team.doubleActive) {
    const n = 1 + (team.doubleExtra || 0);
    push({ key: 'double', tone: 'buff', icon: '✨', n: n > 1 ? n : null, color: '#8745d4',
      name: L(lang, 'À la suite', 'In a row'),
      desc: L(lang, `Questions à la suite (${n}) — récompense au bout`, `Questions in a row (${n}) — reward at the end`) });
  }
  if (team.wager) {
    push({ key: 'wager', tone: 'buff', icon: '\u{1F3B2}', color: '#c8911f',
      name: L(lang, 'Défi', 'Challenge'),
      desc: L(lang, 'Défi : récompense si tu réussis ta prochaine question', 'Challenge: reward if you pass your next question') });
  }
  if (team.totalImmuneTurns > 0) {
    const t = team.totalImmuneTurns;
    push({ key: 'totalImmune', tone: 'buff', icon: '\u{1F6E1}️', n: t, color: '#3b6cb3', link: { type: 'term', key: 'immunite' },
      name: L(lang, 'Immunité totale', 'Total immunity'),
      desc: L(lang, `Immunité totale (${t} tour${plural(t, lang, 's', 's')})`, `Total immunity (${t} turn${plural(t, lang, 's', 's')})`) });
  }
  // Immunités / renvoi PASSIFS (équipement/set) — affichés tant qu'actifs.
  if (getEffectValue(team, 'itemStealImmune') > 0) {
    push({ key: 'itemImmune', tone: 'buff', icon: '🔒', color: '#3b6cb3', link: { type: 'term', key: 'immunite' },
      name: L(lang, 'Anti-vol d’objet', 'Item-theft proof'),
      desc: L(lang, "Immunisé au vol d'objet", 'Immune to item theft') });
  }
  if (getEffectValue(team, 'goldStealImmune') > 0 || getEffectValue(team, 'stealProtection') >= 100) {
    push({ key: 'goldImmune', tone: 'buff', icon: '🔒', color: '#c8911f', link: { type: 'term', key: 'immunite' },
      name: L(lang, 'Anti-vol d’or', 'Gold-theft proof'),
      desc: L(lang, "Immunisé au vol d'or", 'Immune to gold theft') });
  }
  const reflectPct = getEffectValue(team, 'reflectChance');
  if (reflectPct > 0) {
    push({ key: 'reflect', tone: 'buff', icon: '↩️', color: '#8745d4', link: { type: 'term', key: 'renvoi' },
      name: L(lang, 'Renvoi', 'Reflect'),
      desc: L(lang, `Renvoi d'effet : ${Math.min(100, reflectPct)}%`, `Effect reflect: ${Math.min(100, reflectPct)}%`) });
  }

  // --- Malus (subis) ---
  if (team.powersBlockedTurns > 0) {
    const t = team.powersBlockedTurns;
    push({ key: 'powBlock', tone: 'malus', icon: '🚫', n: t, color: '#8a1f2e', link: { type: 'term', key: 'malediction' },
      name: L(lang, 'Pouvoirs bloqués', 'Powers blocked'),
      desc: L(lang, `Pouvoirs bloqués (${t} tour${plural(t, lang, 's', 's')})`, `Powers blocked (${t} turn${plural(t, lang, 's', 's')})`) });
  }
  if (team.consumablesBlockedTurns > 0) {
    const t = team.consumablesBlockedTurns;
    push({ key: 'consBlock', tone: 'malus', icon: '🚫', n: t, color: '#8a1f2e', link: { type: 'term', key: 'malediction' },
      name: L(lang, 'Consos bloquées', 'Consumables blocked'),
      desc: L(lang, `Consommables bloqués (${t} tour${plural(t, lang, 's', 's')})`, `Consumables blocked (${t} turn${plural(t, lang, 's', 's')})`) });
  }
  if (team.sablierActif) {
    push({ key: 'sablier', tone: 'malus', icon: '⏱️', color: '#8745d4', link: { type: 'term', key: 'malediction' },
      name: L(lang, 'Sablier', 'Hourglass'),
      desc: L(lang, 'Sablier : timer réduit à ta prochaine question', 'Hourglass: reduced timer on your next question') });
  }
  if (team.forcedSubject) {
    const s = SUBJECTS[team.forcedSubject] || {};
    const sn = locName(s, lang) || team.forcedSubject;
    push({ key: 'forced', tone: 'malus', icon: s.icon || '\u{1F3AF}', color: s.color || '#8a1f2e', link: { type: 'subject', key: team.forcedSubject },
      name: L(lang, 'Thème imposé', 'Forced subject'),
      desc: L(lang, `Question imposée : ${sn}`, `Forced question: ${sn}`) });
  }

  // --- Effets de durée (buffs des consommables), avec compteur de tours ---
  (team.buffs || []).forEach((b, i) => {
    const info = BUFF_INFO[b.type];
    if (!info) return;
    const turns = b.turns ?? 0;
    const tone = typeof info.tone === 'function' ? info.tone(b) : info.tone;
    const suffix = turns > 0 ? ` (${turns} ${L(lang, `tour${plural(turns, lang, 's', '')}`, `turn${plural(turns, lang, '', 's')}`)})` : '';
    push({ key: `buff-${i}`, tone, icon: info.icon, n: turns > 0 ? turns : null, color: info.color, link: info.link,
      name: info.name(b, lang), desc: `${info.desc(b, lang)}${suffix}` });
  });

  // --- Sets d'équipement actifs (2/3 ou 3/3) ---
  for (const a of activeSets(team)) {
    const sn = locName(a.set, lang) || a.key;
    const sz = a.set.size || 3;
    push({ key: `set-${a.key}`, tone: 'buff', icon: a.set.icon || '⚜️', color: a.set.color || '#a8771a', link: { type: 'set', key: a.key },
      name: L(lang, `Set ${sn}`, `${sn} set`),
      desc: L(lang, `Set ${sn} ${a.count}/${sz} pièces équipées`, `${sn} set: ${a.count}/${sz} pieces equipped`) });
  }

  return out;
}

// Malus en attente (sous-ensemble) — pilote l'aura ominueuse du pion.
export function getPendingMalus(team) {
  return getTeamEffects(team).filter((e) => e.tone === 'malus');
}
