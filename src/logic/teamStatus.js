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
// Exporté pour que le moteur d'effets (effectEngine) puisse en tirer l'icône, la
// couleur et le ton lorsqu'il déclenche l'aura visuelle d'un buff posé.
export const BUFF_INFO = {
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
  trapImmune: { tone: 'buff', icon: '🪤', color: '#3b6cb3',
    name: (b, lang) => L(lang, 'Anti-piège', 'Trap-proof'),
    desc: (b, lang) => L(lang, 'Immunisé contre les pièges', 'Immune to traps') },
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
  thorns: { tone: 'buff', icon: '🌵', color: '#2f9d5a', link: { type: 'term', key: 'epines' },
    name: (b, lang) => L(lang, 'Épines', 'Thorns'),
    desc: (b, lang) => L(lang, `Épines : renvoie ${b.n ?? 0}% du recul/vol subi à l'attaquant`, `Thorns: returns ${b.n ?? 0}% of the setback/theft you suffer to the attacker`) },
  streakGuard: { tone: 'buff', icon: '🔥', color: '#e8801f',
    name: (b, lang) => L(lang, 'Garde-série', 'Streak guard'),
    desc: (b, lang) => L(lang, 'La série ne casse pas en cas d’erreur', 'Your streak does not break on a wrong answer') },
  secondChance: { tone: 'buff', icon: '🔁', color: '#2f9d5a',
    name: (b, lang) => L(lang, 'Seconde chance', 'Second chance'),
    desc: (b, lang) => L(lang, 'Une mauvaise réponse peut être rejouée une fois', 'One wrong answer can be replayed once') },
  diceMalus: { tone: 'malus', icon: '🎲', color: '#8a1f2e',
    name: (b, lang) => L(lang, 'Dé saboté', 'Sabotaged die'),
    desc: (b, lang) => L(lang, `Le dé fait −${b.n ?? 1} à chaque lancer`, `The die rolls −${b.n ?? 1} each time`) },
  minRoll: { tone: 'buff', icon: '🍀', color: '#2f9d5a',
    name: (b, lang) => L(lang, 'Dé chanceux', 'Lucky die'),
    desc: (b, lang) => L(lang, `Le dé fait au moins ${b.n ?? 1}`, `The die rolls at least ${b.n ?? 1}`) },
  anchor: { tone: 'buff', icon: '⚓', color: '#3b6cb3',
    name: (b, lang) => L(lang, 'Ancre', 'Anchor'),
    desc: (b, lang) => L(lang, 'Immunisé au déplacement forcé (recul/téléport/échange)', 'Immune to forced movement (setback/teleport/swap)') },
  insurance: { tone: 'buff', icon: '🛟', color: '#2f9d5a',
    name: (b, lang) => L(lang, 'Assurance', 'Insurance'),
    desc: (b, lang) => L(lang, `Récupère ${b.n ?? 0}% de l'or qu'on te prend`, `Recover ${b.n ?? 0}% of stolen/lost gold`) },
  interest: { tone: 'buff', icon: '💹', color: '#c8911f',
    name: (b, lang) => L(lang, 'Intérêts', 'Interest'),
    desc: (b, lang) => L(lang, `+${b.n ?? 0}% de ton or par tour`, `+${b.n ?? 0}% of your gold each turn`) },
  tithe: { tone: 'buff', icon: '⛪', color: '#c8911f',
    name: (b, lang) => L(lang, 'Dîme', 'Tithe'),
    desc: (b, lang) => L(lang, `Prélève ${b.n ?? 0}% de l'or gagné par les adversaires`, `Take ${b.n ?? 0}% of opponents' earned gold`) },
  magicRegen: { tone: 'buff', icon: '✨', color: '#8745d4',
    name: (b, lang) => L(lang, '+Magie/min', '+Magic/min'),
    desc: (b, lang) => L(lang, `+${b.n ?? 1} magie par minute`, `+${b.n ?? 1} magic per minute`) },
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
  } else if (team.itemTimerBonus < 0) {
    // Temps volé (vol de temps) : malus appliqué à la prochaine question.
    const lost = -team.itemTimerBonus;
    push({ key: 'time', tone: 'malus', icon: '⏳', n: lost, color: '#8a1f2e',
      name: L(lang, '−Temps', '−Time'),
      desc: L(lang, `−${lost}s à ta prochaine question (temps volé)`, `−${lost}s on your next question (time stolen)`) });
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
  // Épines PASSIVES (équipement/set) — le buff temporisé passe par la boucle des buffs.
  const thornsP = getEffectValue(team, 'thorns');
  if (thornsP > 0) {
    push({ key: 'thorns', tone: 'buff', icon: '🌵', color: '#2f9d5a', link: { type: 'term', key: 'epines' },
      name: L(lang, 'Épines', 'Thorns'),
      desc: L(lang, `Épines : renvoie ${Math.min(100, thornsP)}% du recul/vol subi`, `Thorns: returns ${Math.min(100, thornsP)}% of setback/theft suffered`) });
  }
  // Garde-série PASSIVE (équipement/set).
  if (getEffectValue(team, 'streakGuard') > 0) {
    push({ key: 'streakGuard', tone: 'buff', icon: '🔥', color: '#e8801f',
      name: L(lang, 'Garde-série', 'Streak guard'),
      desc: L(lang, 'La série ne casse pas en cas d’erreur', 'Your streak does not break on a wrong answer') });
  }
  // Passifs économiques / défensifs (équipement/set).
  const insP = getEffectValue(team, 'insurance');
  if (insP > 0) push({ key: 'insurance', tone: 'buff', icon: '🛟', color: '#2f9d5a', name: L(lang, 'Assurance', 'Insurance'), desc: L(lang, `Récupère ${Math.min(100, insP)}% de l'or qu'on te prend`, `Recover ${Math.min(100, insP)}% of stolen/lost gold`) });
  const intP = getEffectValue(team, 'interest');
  if (intP > 0) push({ key: 'interest', tone: 'buff', icon: '💹', color: '#c8911f', name: L(lang, 'Intérêts', 'Interest'), desc: L(lang, `+${intP}% de ton or par tour`, `+${intP}% of your gold each turn`) });
  const titheP = getEffectValue(team, 'tithe');
  if (titheP > 0) push({ key: 'tithe', tone: 'buff', icon: '⛪', color: '#c8911f', name: L(lang, 'Dîme', 'Tithe'), desc: L(lang, `Prélève ${titheP}% de l'or gagné par les adversaires`, `Take ${titheP}% of opponents' earned gold`) });
  const mrP = getEffectValue(team, 'minRoll');
  if (mrP > 0) push({ key: 'minRoll', tone: 'buff', icon: '🍀', color: '#2f9d5a', name: L(lang, 'Dé chanceux', 'Lucky die'), desc: L(lang, `Le dé fait au moins ${mrP}`, `The die rolls at least ${mrP}`) });
  // États transitoires (flags posés par des effets).
  if (team.checkpoint) push({ key: 'checkpoint', tone: 'buff', icon: '🚩', color: '#3b6cb3', name: L(lang, 'Point de contrôle', 'Checkpoint'), desc: L(lang, 'À ton tour, clique dessus pour t’y téléporter', 'On your turn, click it to teleport there') });
  if (team.investment) {
    const invRate = team.investment.rate != null ? team.investment.rate : (team.investment.mult != null ? team.investment.mult * 100 : 200);
    push({ key: 'investment', tone: 'buff', icon: '📈', color: '#2f9d5a', name: L(lang, 'Investissement', 'Investment'), desc: L(lang, `Mise ${team.investment.stake} → ${invRate} % à la prochaine bonne réponse`, `Stake ${team.investment.stake} → ${invRate}% on your next correct answer`) });
  }
  if (team.bountyBy != null) push({ key: 'bounty', tone: 'malus', icon: '🎯', color: '#8a1f2e', name: L(lang, 'Prime', 'Bounty'), desc: L(lang, `Prime de ${team.bountyGold} or sur ta prochaine erreur`, `${team.bountyGold} gold bounty on your next mistake`) });
  // Immunité aux pièges PASSIVE (équipement/set). Le buff temporisé est affiché
  // séparément (avec compteur de tours) par la boucle des buffs ci-dessous.
  if (getEffectValue(team, 'trapImmune') > 0) {
    push({ key: 'trapImmune', tone: 'buff', icon: '🪤', color: '#3b6cb3', link: { type: 'term', key: 'immunite' },
      name: L(lang, 'Anti-piège', 'Trap-proof'),
      desc: L(lang, 'Immunisé contre les pièges', 'Immune to traps') });
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
  // Réponses instables (sort de magie / Modeleur) : consommé à la prochaine question.
  if (team.modeleurInterval) {
    push({ key: 'unstable', tone: 'malus', icon: '🌫️', color: '#8745d4', link: { type: 'term', key: 'malediction' },
      name: L(lang, 'Réponses instables', 'Unstable answers'),
      desc: L(lang, `À ta prochaine question, les réponses changent de place toutes les ${team.modeleurInterval}s`, `On your next question, answers shuffle every ${team.modeleurInterval}s`) });
  }
  // Faces bénies/maudites (Magie) : marques persistantes sur le dé (slot 1→6).
  for (const [slot, m] of Object.entries(team.faceMods || {})) {
    if (!m) continue;
    const cursed = m.kind === 'curse';
    push({ key: `faceMod-${slot}`, tone: cursed ? 'malus' : 'buff', icon: cursed ? '☠️' : '✨', n: Number(slot), color: cursed ? '#8a1f2e' : '#e8c34a',
      name: cursed ? L(lang, `Face ${slot} maudite`, `Face ${slot} cursed`) : L(lang, `Face ${slot} bénie`, `Face ${slot} blessed`),
      desc: cursed
        ? L(lang, `Face ${slot} du dé maudite : −${m.gold} or quand elle tombe`, `Die face ${slot} cursed: −${m.gold} gold when it lands`)
        : L(lang, `Face ${slot} du dé bénie : +${m.gold} or quand elle tombe`, `Die face ${slot} blessed: +${m.gold} gold when it lands`) });
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
    const cnt = Math.min(a.count, sz); // un set Taille 2 ne montre jamais « 3/2 »
    push({ key: `set-${a.key}`, tone: 'buff', icon: a.set.icon || '⚜️', color: a.set.color || '#a8771a', link: { type: 'set', key: a.key },
      name: L(lang, `Set ${sn}`, `${sn} set`),
      desc: L(lang, `Set ${sn} ${cnt}/${sz} pièces équipées`, `${sn} set: ${cnt}/${sz} pieces equipped`) });
  }

  return out;
}

// Malus en attente (sous-ensemble) — pilote l'aura ominueuse du pion.
export function getPendingMalus(team) {
  return getTeamEffects(team).filter((e) => e.tone === 'malus');
}
