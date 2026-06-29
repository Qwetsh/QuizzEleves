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
    if (b) {
      eff = { ...eff, ...b.effect };
      // Renforts de voie : un palier `tiers[i]` s'ajoute au niveau SPEC5_TIER_LEVELS[i]
      // (L7 = palier 1, L9 = palier 2). Chaque palier fusionne par-dessus (écrase le
      // même champ : ex. goldPerRoll 1 → 2 → 3 ; ajoute un champ nouveau sinon).
      if (Array.isArray(b.tiers)) {
        const TL = tree.tierLevels || SPEC5_TIER_LEVELS;
        b.tiers.forEach((tier, i) => { if (tier && lvl >= TL[i]) eff = { ...eff, ...tier }; });
      }
    }
  }
  if (lvl >= 10 && entry?.spec10) {
    const b = tree.branch10.find((o) => o.key === entry.spec10);
    if (b) eff = { ...eff, ...b.effect };
  }
  return eff;
}

// Niveaux auxquels s'appliquent les renforts de voie L5. DÉFAUT [7,9] (2 paliers :
// Relance/Bouclier). Un pouvoir peut surcharger via `tree.tierLevels` (longueur
// variable, ex. Foudre [6,7,9] = 3 paliers ; Sablier [6,8,9] ; Double/Indice [7,8,9]).
export const SPEC5_TIER_LEVELS = [7, 9];

// Niveaux de renfort de voie EFFECTIFS d'un pouvoir (per-power, fallback [7,9]).
export function tierLevelsFor(key) {
  return POWERS[key]?.tree?.tierLevels || SPEC5_TIER_LEVELS;
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
    case 'reroll': {
      const baseTxt = eff.mode === 'sum' ? 'Somme de 2 dés' : eff.mode === 'best' ? 'Garde le meilleur' : 'Relance le dé';
      const parts = [baseTxt];
      if (eff.dieSides > 6) parts.push('D10');
      if (eff.refundChance) parts.push(`remb. ${Math.round(eff.refundChance * 100)}%`);
      // Niveaux dont le CŒUR ne change pas : on précise ce qui se passe vraiment
      // (embranchement, renfort de la voie choisie, ou ultime) pour les distinguer.
      if (level === 5) parts.push('embranchement');
      else if (level === 10) parts.push('ultime');
      else if (tierLevelsFor(key).includes(level)) parts.push('renfort de voie');
      return parts.join(' · ');
    }
    case 'reculTarget': return `Recul ${dl(eff.amount)}${eff.flat ? ` +${eff.flat}` : ''}`;
    case 'timerReduce': return `Timer ÷${eff.divisor}`;
    case 'multiQuestion': return `+${eff.add} question${eff.add > 1 ? 's' : ''}${eff.timerDivisor ? ` · timer ÷${eff.timerDivisor}` : ''}`;
    default: return '';
  }
}
