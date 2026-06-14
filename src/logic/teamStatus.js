// SOURCE UNIQUE des effets transitoires posés sur une équipe (consommés à son
// prochain tour / sa prochaine question). Partagée par la fiche d'équipe
// (BottomBar), l'aura du pion (BoardSVG) et le companion mobile, pour garantir
// qu'un effet en attente a TOUJOURS un rappel visuel — où qu'on regarde.
//   tone: 'buff' (positif/neutre) | 'malus' (négatif). L'aura du pion ne
//   s'affiche que pour les malus.
import { SUBJECTS } from '../data/subjects.js';

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

  return out;
}

// Malus en attente (sous-ensemble) — pilote l'aura ominueuse du pion.
export function getPendingMalus(team) {
  return getTeamEffects(team).filter((e) => e.tone === 'malus');
}
