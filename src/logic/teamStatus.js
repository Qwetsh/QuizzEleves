// SOURCE UNIQUE des effets transitoires posés sur une équipe (consommés à son
// prochain tour / sa prochaine question). Partagée par la fiche d'équipe
// (BottomBar), l'aura du pion (BoardSVG) et le companion mobile, pour garantir
// qu'un effet en attente a TOUJOURS un rappel visuel — où qu'on regarde.
//   tone: 'buff' (positif/neutre) | 'malus' (négatif). L'aura du pion ne
//   s'affiche que pour les malus.
import { SUBJECTS } from '../data/subjects.js';
import { activeSets } from './itemEffects.js';

// Effets de durée (buffs des consommables) → libellé + ton pour l'affichage.
const BUFF_INFO = {
  themeBonus: { tone: 'buff', icon: '💰', color: '#c8911f', label: (b) => `+${b.n ?? 5} or / bonne réponse${b.subject ? ` en ${SUBJECTS[b.subject]?.name || b.subject}` : ''}` },
  noRecul: { tone: 'buff', icon: '\u{1F6DF}', color: '#3b6cb3', label: () => 'Pas de recul à l’erreur' },
  advanceOnCorrect: { tone: 'buff', icon: '🏃', color: '#2f9d5a', label: () => 'Avance si bonne réponse' },
  randomPath: { tone: 'buff', icon: '🎲', color: '#8745d4', label: () => 'Voie choisie au hasard' },
  loseOnWrong: { tone: 'malus', icon: '💸', color: '#b5341f', label: (b) => `Perd ${b.n ?? 5} or à l’erreur` },
};

export function getTeamEffects(team) {
  if (!team) return [];
  const out = [];

  // --- Buffs / protections (déclenchés au tour ou à la prochaine question) ---
  if (team.itemShield > 0) {
    out.push({ key: 'shield', tone: 'buff', icon: '\u{1F6E1}️', n: team.itemShield > 1 ? team.itemShield : null,
      label: `Bouclier : annule ${team.itemShield} recul${team.itemShield > 1 ? 's' : ''}`, color: '#3b6cb3' });
  }
  if (team.itemFumigene) {
    out.push({ key: 'fumigene', tone: 'buff', icon: '\u{1F4A8}', n: team.itemFumigeneTurns || null,
      label: `Fumigène : prochain pouvoir offensif annulé${team.itemFumigeneTurns ? ` (${team.itemFumigeneTurns} tour${team.itemFumigeneTurns > 1 ? 's' : ''})` : ''}`, color: '#7a8a99' });
  }
  if (team.itemTimerBonus > 0) {
    out.push({ key: 'time', tone: 'buff', icon: '⏳', n: team.itemTimerBonus,
      label: `+${team.itemTimerBonus}s à ta prochaine question`, color: '#2f9d5a' });
  }
  if (team.doubleActive) {
    const n = 1 + (team.doubleExtra || 0);
    out.push({ key: 'double', tone: 'buff', icon: '✨', n: n > 1 ? n : null,
      label: `Questions à la suite (${n}) — récompense au bout`, color: '#8745d4' });
  }
  if (team.wager) {
    out.push({ key: 'wager', tone: 'buff', icon: '\u{1F3B2}',
      label: 'Défi : récompense si tu réussis ta prochaine question', color: '#c8911f' });
  }

  // --- Malus (subis) ---
  if (team.sablierActif) {
    out.push({ key: 'sablier', tone: 'malus', icon: '⏱️',
      label: 'Sablier : timer réduit à ta prochaine question', color: '#8745d4' });
  }
  if (team.forcedSubject) {
    const s = SUBJECTS[team.forcedSubject] || {};
    out.push({ key: 'forced', tone: 'malus', icon: s.icon || '\u{1F3AF}',
      label: `Question imposée : ${s.name || team.forcedSubject}`, color: s.color || '#8a1f2e' });
  }

  // --- Effets de durée (buffs des consommables), avec compteur de tours ---
  (team.buffs || []).forEach((b, i) => {
    const info = BUFF_INFO[b.type];
    if (!info) return;
    const turns = b.turns ?? 0;
    out.push({ key: `buff-${i}`, tone: info.tone, icon: info.icon, n: turns > 0 ? turns : null,
      label: `${info.label(b)} (${turns} tour${turns > 1 ? 's' : ''})`, color: info.color });
  });

  // --- Sets d'équipement actifs (2/3 ou 3/3) ---
  for (const a of activeSets(team)) {
    out.push({ key: `set-${a.key}`, tone: 'buff', icon: a.set.icon || '⚜️',
      label: `Set ${a.set.name} ${a.count}/3`, color: a.set.color || '#a8771a' });
  }

  return out;
}

// Malus en attente (sous-ensemble) — pilote l'aura ominueuse du pion.
export function getPendingMalus(team) {
  return getTeamEffects(team).filter((e) => e.tone === 'malus');
}
