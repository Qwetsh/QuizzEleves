// Sets d'équipement : un objet peut appartenir à un set (item.set = clé). Quand
// une équipe porte 2 puis 3 pièces du même set, elle gagne des BONUS — des effets
// (passifs ou déclencheurs, même schéma que les objets, cf. effectEngine.js)
// injectés dans getEffectValue / equipTriggerActions via activeSetEffects().
//
// MUTABLE : balanceConfig applique d'éventuels overrides d'éditeur (ov.sets)
// en mutant cet objet en place (comme POWERS/LOOT). Le jeu lit toujours SETS.
//
// Raccourcis d'effets pour rester lisible.
const gain = (n) => ({ action: 'money', mode: 'gain', target: 'self', n, unit: 'flat' });

export const SETS = {
  nature: {
    name: 'Tenue de la Nature', icon: '🌿', color: '#779313',
    // 2 pièces : +3s au temps de réponse
    bonus2: [{ type: 'timerBonus', value: 3 }],
    // 3 pièces : à chaque bonne réponse en SVT, +5 pièces
    bonus3: [{ kind: 'trigger', on: 'correct', subject: 'svt', do: [gain(5)] }],
  },
  marchand: {
    name: 'Panoplie du Marchand', icon: '💰', color: '#c79120',
    bonus2: [{ type: 'moneyPerCorrect', value: 2 }],
    // 3 pièces : −50% d'impôts/taxes et +25% de chance de looter un consommable
    bonus3: [{ type: 'taxReduction', value: 50 }, { type: 'lootBonusConsumable', value: 25 }],
  },
  explorateur: {
    name: "Set de l'Explorateur", icon: '🧭', color: '#579b9a',
    // 2 pièces : recul subi réduit de 1 case
    bonus2: [{ type: 'reculReduction', value: 1 }],
    // 3 pièces : immunité Tempête + à chaque bonne réponse, avance d'1 case
    bonus3: [{ type: 'tempeteImmune', value: 1 }, { kind: 'trigger', on: 'correct', do: [{ action: 'move', target: 'self', dir: 'forward', n: 1 }] }],
  },
  sage: {
    name: 'Habit du Sage', icon: '🦉', color: '#3160a5',
    // 2 pièces : l'Indice élimine 1 mauvaise réponse de plus à chaque question
    bonus2: [{ type: 'indiceBoost', value: 1 }],
    // 3 pièces : +5s au timer et +2 pièces par bonne réponse
    bonus3: [{ type: 'timerBonus', value: 5 }, { type: 'moneyPerCorrect', value: 2 }],
  },
  duelliste: {
    name: 'Armure du Duelliste', icon: '⚔️', color: '#8a1f2e',
    // 2 pièces : +3 pièces volées en duel
    bonus2: [{ type: 'fightStealBonus', value: 3 }],
    // 3 pièces : quand je gagne un duel, loot un consommable ; anti-vol −50%
    bonus3: [{ type: 'stealProtection', value: 50 }, { kind: 'trigger', on: 'fightWin', do: [{ action: 'loot', category: 'consumable' }] }],
  },
};

// Champs d'un set modifiables par l'éditeur d'équilibrage (overrides).
export const SET_EDITABLE = ['name', 'bonus2', 'bonus3'];
