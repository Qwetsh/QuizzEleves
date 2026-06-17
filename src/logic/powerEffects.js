// ============================================================
//  Résolveur central des effets de pouvoir (extension « Maîtrise »).
//
//  Point de vérité UNIQUE : tous les consommateurs (resolveWrongAnswer pour le
//  Bouclier, askQuestion pour l'Indice, applyOffensivePower pour Foudre/Sablier/
//  Double, useRelance) lisent l'effet EFFECTIF d'ici plutôt que
//  POWERS[key].levels[level-1].effect en dur.
//
//  - masteryOn = false (défaut) → mode classique 3 niveaux (levels[]).
//    C'est aussi le défaut des tests / appels sans contexte d'extension.
//  - masteryOn = true → arbre : scale[level] + branche L5 (spec5) + branche L10
//    (spec10), fusionnés par-dessus (Object.assign : un champ de branche écrase
//    le même champ du cœur, ex. Forteresse amount:99 ; un champ NOUVEAU s'ajoute).
// ============================================================
import { POWERS } from '../data/powers.js';

export function resolvePowerEffect(team, key, masteryOn = false) {
  const power = POWERS[key];
  if (!power) return {};
  const entry = team?.powers?.[key];
  const level = entry?.level ?? 1;
  const tree = power.tree;

  // Mode classique (sans extension) ou pouvoir sans arbre : on lit `levels`.
  if (!masteryOn || !tree) {
    const lvl = Math.min(Math.max(level, 1), power.levels.length);
    return { ...(power.levels[lvl - 1]?.effect || {}) };
  }

  // Mode « Maîtrise » : cœur du niveau + branches débloquées.
  const lvl = Math.min(Math.max(level, 1), tree.scale.length);
  let eff = { ...(tree.scale[lvl - 1] || {}) };
  if (lvl >= 5 && entry?.spec5) {
    const b = tree.branch5.find((o) => o.key === entry.spec5);
    if (b) eff = { ...eff, ...b.effect };
  }
  if (lvl >= 10 && entry?.spec10) {
    const b = tree.branch10.find((o) => o.key === entry.spec10);
    if (b) eff = { ...eff, ...b.effect };
  }
  return eff;
}

// Niveau maximum selon le mode (10 avec Maîtrise + arbre, sinon 3).
export function maxPowerLevel(key, masteryOn = false) {
  const p = POWERS[key];
  if (!p) return 0;
  if (masteryOn && p.tree) return p.tree.scale.length;
  return p.levels?.length ?? 3;
}

// Coût d'or pour passer du niveau `level` au suivant (null si déjà au max).
export function powerUpgradeCost(key, level, masteryOn = false) {
  const p = POWERS[key];
  if (!p) return null;
  if (masteryOn && p.tree) {
    if (level >= p.tree.scale.length) return null;
    return p.tree.upgradeCosts[level - 1] ?? null;
  }
  if (level >= p.levels.length) return null;
  return p.upgradeCosts?.[level - 1] ?? null;
}

// Le niveau qu'on vient d'atteindre ouvre-t-il un choix de voie ? ('spec5'|'spec10'|null)
export function specSlotForLevel(level) {
  if (level === 5) return 'spec5';
  if (level === 10) return 'spec10';
  return null;
}

// Les 3 voies proposées pour un slot ('spec5'|'spec10') d'un pouvoir donné.
export function specOptionsFor(key, slot) {
  const tree = POWERS[key]?.tree;
  if (!tree) return [];
  return slot === 'spec5' ? tree.branch5 : slot === 'spec10' ? tree.branch10 : [];
}

// Résumé court et lisible de l'effet de CŒUR d'un niveau (pour la boutique).
export function describePowerScale(key, level, masteryOn = false) {
  const eff = resolvePowerEffect({ powers: { [key]: { level } } }, key, masteryOn);
  const dl = (a) => (typeof a === 'string' ? '1' + a.toUpperCase() : String(a));
  switch (eff.type) {
    case 'reduceRecul': return `Recul −${eff.amount} case${eff.amount > 1 ? 's' : ''}${eff.bonusMoney ? ` +${eff.bonusMoney} or` : ''}`;
    case 'hideAnswers': return `${eff.count} réponse${eff.count > 1 ? 's' : ''} éliminée${eff.count > 1 ? 's' : ''}${eff.bonusTime ? ` +${eff.bonusTime}s` : ''}`;
    case 'reroll': return eff.mode === 'sum' ? 'Somme de 2 dés' : eff.mode === 'best' ? 'Garde le meilleur' : 'Relance le dé';
    case 'reculTarget': return `Recul ${dl(eff.amount)}${eff.flat ? ` +${eff.flat}` : ''}`;
    case 'timerReduce': return `Timer ÷${eff.divisor}`;
    case 'multiQuestion': return `+${eff.add} question${eff.add > 1 ? 's' : ''}${eff.timerDivisor ? ` · timer ÷${eff.timerDivisor}` : ''}`;
    default: return '';
  }
}
