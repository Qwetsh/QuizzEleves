// Malus « en attente » d'une équipe : effets contraignants à venir, partagés par
// l'aura du pion (BoardSVG), la fiche d'équipe (BottomBar) et le companion mobile.
// Aujourd'hui : forcedSubject (thème imposé à la prochaine question, typiquement
// Hardcore / Culture G posé par un adversaire ou un défi).
import { SUBJECTS } from '../data/subjects.js';

export function getPendingMalus(team) {
  if (!team) return [];
  const out = [];
  if (team.forcedSubject) {
    const s = SUBJECTS[team.forcedSubject] || {};
    out.push({
      key: 'forced',
      icon: s.icon || '🎯',
      label: `Question imposée : ${s.name || team.forcedSubject}`,
      color: s.color || '#8a1f2e',
    });
  }
  return out;
}
