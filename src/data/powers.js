// Coûts d'or pour passer de Ln à Ln+1 (extension « Maîtrise », niveaux 4→10).
// 9 entrées : L1→2 … L9→10. Calibrable via balanceConfig à terme.
export const TREE_COSTS = [20, 30, 45, 65, 90, 120, 155, 195, 240];

// Plafond de charges accumulables par pouvoir (recharge, butin, événements…).
// Appliqué à TOUS les points d'incrément + désactive l'achat de recharge au max.
export const MAX_CHARGES = 5;
// Incrément d'une charge en respectant le plafond.
export const addCharge = (n) => Math.min((n ?? 0) + 1, MAX_CHARGES);

export const POWERS = {
  bouclier: {
    name: 'Bouclier',
    name_en: 'Shield',
    icon: '\u{1F6E1}️',
    desc: 'Amortit le recul apres une mauvaise reponse.',
    desc_en: 'Cushions the setback after a wrong answer.',
    type: 'passive',
    category: 'def',
    price: 15,
    color: '#3b6cb3',
    activationCost: 0,
    upgradeCosts: [20, 30],
    // Recul d'une mauvaise reponse = valeur du de qui a fait avancer. Le Bouclier
    // en RETIRE un nombre de cases croissant avec le niveau (>= recul => absorbe).
    levels: [
      { desc: 'Recul reduit de 2 cases', desc_en: 'Setback reduced by 2 squares', effect: { type: 'reduceRecul', amount: 2 } },
      { desc: 'Recul reduit de 4 cases', desc_en: 'Setback reduced by 4 squares', effect: { type: 'reduceRecul', amount: 4 } },
      { desc: 'Recul reduit de 6 cases + 5 pieces', desc_en: 'Setback reduced by 6 squares + 5 coins', effect: { type: 'reduceRecul', amount: 6, bonusMoney: 5 } },
    ],
    // Extension « Maîtrise » (niveaux 1→10 + embranchements).
    tree: {
      // Cœur : cases retirées au recul EN DÉPENSANT 1 charge (amount). L1-3 = comme
      // les `levels`. `passiveReduce` (dès L3) = réduction PERMANENTE sans charge
      // (non cumulative avec l'active : l'active s'applique à la place quand on a
      // une charge). `bonusMoney` = forfait d'or baked dans le palier.
      scale: [
        { type: 'reduceRecul', amount: 2 },
        { type: 'reduceRecul', amount: 4 },
        { type: 'reduceRecul', amount: 6, bonusMoney: 5, passiveReduce: 1 },
        { type: 'reduceRecul', amount: 7, bonusMoney: 5, passiveReduce: 1 },
        { type: 'reduceRecul', amount: 8, bonusMoney: 5, passiveReduce: 1 },
        { type: 'reduceRecul', amount: 9, bonusMoney: 8, passiveReduce: 1 },
        { type: 'reduceRecul', amount: 10, bonusMoney: 8, passiveReduce: 1 },
        { type: 'reduceRecul', amount: 11, bonusMoney: 10, passiveReduce: 1 },
        { type: 'reduceRecul', amount: 12, bonusMoney: 10, passiveReduce: 1 },
        { type: 'reduceRecul', amount: 14, bonusMoney: 15, passiveReduce: 1 },
      ],
      // Voies L5. `effect` = base ; `tiers` = renforts L7 (tiers[0]) puis L9 (tiers[1]).
      branch5: [
        { key: 'gold', name: 'Rempart doré', name_en: 'Golden Rampart', icon: '🪙',
          desc: 'À l’usage du bouclier, gagne 5 or.', desc_en: 'When the shield is used, gain 5 gold.',
          effect: { goldOnUse: 5 }, tiers: [{ goldOnUse: 10 }, { goldOnUse: 15 }],
          tierDesc: ['Niv.7 : 10 or à l’usage.', 'Niv.9 : 15 or à l’usage.'],
          tierDesc_en: ['Lvl.7: 10 gold on use.', 'Lvl.9: 15 gold on use.'] },
        { key: 'surge', name: 'Sur-réduction', name_en: 'Overcharge', icon: '⏩',
          desc: 'Le surplus de réduction (au-delà du recul) te fait avancer d’autant.',
          desc_en: 'Reduction beyond the setback (the surplus) moves you forward instead.',
          effect: { surplusAdvance: true }, tiers: [{ surplusPush: 'one' }, { surplusPush: 'all' }],
          tierDesc: ['Niv.7 : recule aussi une équipe (au choix) du surplus.', 'Niv.9 : recule TOUTES les équipes adverses du surplus.'],
          tierDesc_en: ['Lvl.7: also push one team (your choice) back by the surplus.', 'Lvl.9: push ALL rival teams back by the surplus.'] },
        { key: 'antifoudre', name: 'Anti-Foudre', name_en: 'Anti-Lightning', icon: '⚡',
          desc: 'Réduit aussi de moitié le recul infligé par la Foudre.',
          desc_en: 'Also halves the setback dealt by Lightning.',
          effect: { foudreReduceFraction: 0.5 }, tiers: [{ foudreReflectFraction: 0.5 }, { foudreReflectGold: true }],
          tierDesc: ['Niv.7 : renvoie la moitié du recul de Foudre à l’attaquant.', 'Niv.9 : et tu gagnes cette valeur en or.'],
          tierDesc_en: ['Lvl.7: reflect half the Lightning setback back at the attacker.', 'Lvl.9: and you gain that value in gold.'] },
      ],
      branch10: [
        { key: 'fortress', name: 'Forteresse', name_en: 'Fortress', icon: '🏰',
          desc: 'Le recul devient impossible : tu avances du montant évité (sauf Foudre).',
          desc_en: 'Setbacks become impossible: you move forward by the avoided amount (except Lightning).',
          effect: { fortressAdvance: true } },
        { key: 'aegisTotal', name: 'Immunité totale', name_en: 'Total Immunity', icon: '🛡️',
          desc: 'Actif : dépense toutes tes charges → immunité aux attaques adverses pendant 2 tours.',
          desc_en: 'Active: spend all your charges → immunity to enemy attacks for 2 turns.',
          effect: { totalImmune: true, immuneCost: 5, immuneTurns: 2 } },
        { key: 'goldVault', name: 'Banque fortifiée', name_en: 'Fortified Vault', icon: '🏦',
          desc: 'Ton or devient impossible à voler.', desc_en: 'Your gold can no longer be stolen.',
          effect: { goldUnstealable: true } },
      ],
      // Description « élève » par niveau (ce que le niveau apporte, sans répétition).
      scaleDesc: [
        'Dépense une charge pour reculer 2 cases de moins.',
        'La réduction passe à 4 cases (avec une charge).',
        'Réduction de 6 cases et +5 or (avec charge). En plus : −1 case en permanence, sans charge.',
        'La réduction passe à 7 cases.',
        'Réduction de 8 cases. Tu choisis une spécialité (3 voies au choix).',
        'La réduction passe à 9 cases.',
        'Réduction de 10 cases. Ta spécialité gagne un premier renfort.',
        'La réduction passe à 11 cases.',
        'Réduction de 12 cases. Ta spécialité atteint son plein effet.',
        'Réduction de 14 cases. Tu choisis un pouvoir ultime (3 au choix).',
      ],
      scaleDesc_en: [
        'Spend a charge to move back 2 fewer squares.',
        'Reduction raised to 4 squares (with a charge).',
        'Reduction of 6 squares and +5 gold (with a charge). Plus: −1 square permanently, no charge.',
        'Reduction raised to 7 squares.',
        'Reduction of 8 squares. Pick a specialty (3 paths to choose from).',
        'Reduction raised to 9 squares.',
        'Reduction of 10 squares. Your specialty gains a first boost.',
        'Reduction raised to 11 squares.',
        'Reduction of 12 squares. Your specialty reaches full power.',
        'Reduction of 14 squares. Pick an ultimate power (3 to choose from).',
      ],
      upgradeCosts: TREE_COSTS,
    },
  },
  indice: {
    name: 'Indice',
    name_en: 'Hint',
    icon: '\u{1F4A1}',
    desc: 'Elimine 1 mauvaise reponse.',
    desc_en: 'Removes 1 wrong answer.',
    type: 'passive',
    category: 'def',
    price: 15,
    color: '#e8b117',
    activationCost: 5,
    upgradeCosts: [20, 30],
    levels: [
      { desc: 'Elimine 1 mauvaise reponse', desc_en: 'Removes 1 wrong answer', effect: { type: 'hideAnswers', count: 1, bonusTime: 0 } },
      { desc: 'Elimine 1 reponse + 5s de bonus', desc_en: 'Removes 1 answer + 5s bonus time', effect: { type: 'hideAnswers', count: 1, bonusTime: 5 } },
      { desc: 'Elimine 2 mauvaises reponses', desc_en: 'Removes 2 wrong answers', effect: { type: 'hideAnswers', count: 2, bonusTime: 0 } },
    ],
    tree: {
      // Cœur : élimine 1 mauvaise réponse, + une chance croissante d'en éliminer
      // une 2ᵉ (25→50→75→100 %). À 100 % (L6+), 2 éliminations garanties.
      // L'élimination ne retire jamais la bonne réponse. Renforts 7/8/9.
      scale: [
        { type: 'hideAnswers', count: 1, secondChance: 0 },     // L1
        { type: 'hideAnswers', count: 1, secondChance: 0.25 },  // L2 25%
        { type: 'hideAnswers', count: 1, secondChance: 0.50 },  // L3 50%
        { type: 'hideAnswers', count: 1, secondChance: 0.75 },  // L4 75%
        { type: 'hideAnswers', count: 1, secondChance: 0.75 },  // L5 (embranchement)
        { type: 'hideAnswers', count: 2, secondChance: 0 },     // L6 100% → 2 sûres
        { type: 'hideAnswers', count: 2, secondChance: 0 },     // L7 (renfort palier 1)
        { type: 'hideAnswers', count: 2, secondChance: 0 },     // L8 (renfort palier 2)
        { type: 'hideAnswers', count: 2, secondChance: 0 },     // L9 (renfort palier 3)
        { type: 'hideAnswers', count: 2, secondChance: 0 },     // L10 (ultime)
      ],
      tierLevels: [7, 8, 9],
      scaleDesc: [
        'Élimine 1 mauvaise réponse.',
        '25 % de chance d’éliminer une 2ᵉ mauvaise réponse.',
        '50 % de chance d’éliminer une 2ᵉ mauvaise réponse.',
        '75 % de chance d’éliminer une 2ᵉ mauvaise réponse.',
        'Tu choisis une voie d’Indice (3 au choix).',
        '100 % : élimine une 2ᵉ mauvaise réponse à coup sûr (2 au total).',
        'Ta voie d’Indice gagne son 1ᵉʳ palier.',
        'Ta voie d’Indice gagne son 2ᵉ palier.',
        'Ta voie d’Indice gagne son 3ᵉ palier.',
        'Tu choisis un ultime d’Indice (3 au choix).',
      ],
      scaleDesc_en: [
        'Removes 1 wrong answer.',
        '25% chance to remove a 2nd wrong answer.',
        '50% chance to remove a 2nd wrong answer.',
        '75% chance to remove a 2nd wrong answer.',
        'Pick a Hint path (3 to choose from).',
        '100%: removes a 2nd wrong answer for sure (2 total).',
        'Your Hint path gains its 1st tier.',
        'Your Hint path gains its 2nd tier.',
        'Your Hint path gains its 3rd tier.',
        'Pick an ultimate Hint power (3 to choose from).',
      ],
      branch5: [
        { key: 'temps', name: 'Maîtrise du temps', name_en: 'Time Mastery', icon: '⏱️',
          desc: 'Quand tu cliques sur Indice, ton timer augmente.',
          desc_en: 'When you click Hint, your timer increases.',
          effect: { hintTime: true }, tiers: [{ hintTimeBonus: 5 }, { hintTimeBonus: 10 }, { hintTimeBonus: 15 }],
          tierDesc: ['Niv.7 : +5 s.', 'Niv.8 : +10 s.', 'Niv.9 : +15 s.'],
          tierDesc_en: ['Lvl.7: +5s.', 'Lvl.8: +10s.', 'Lvl.9: +15s.'] },
        { key: 'chain', name: 'Indices en chaîne', name_en: 'Chained Hints', icon: '🔁',
          desc: 'Tu peux utiliser l’indice plusieurs fois sur la même question.',
          desc_en: 'You can use the hint several times on the same question.',
          effect: { chainHints: true }, tiers: [{ chainHintUses: 2 }, { chainHintUses: 3 }, { chainHintUses: 99 }],
          tierDesc: ['Niv.7 : 2ᵉ utilisation.', 'Niv.8 : 3ᵉ utilisation.', 'Niv.9 : jusqu’à ne garder que la bonne.'],
          tierDesc_en: ['Lvl.7: 2nd use.', 'Lvl.8: 3rd use.', 'Lvl.9: until only the correct one remains.'] },
        { key: 'loot', name: 'Loot d’or', name_en: 'Gold Loot', icon: '🪙',
          desc: 'Si tu réponds juste après avoir utilisé un indice, tu gagnes de l’or.',
          desc_en: 'If you answer correctly after using a hint, you gain gold.',
          effect: { hintLoot: true }, tiers: [{ hintGold: 5 }, { hintGold: 10 }, { hintGold: 15 }],
          tierDesc: ['Niv.7 : +5 pièces.', 'Niv.8 : +10 pièces.', 'Niv.9 : +15 pièces.'],
          tierDesc_en: ['Lvl.7: +5 coins.', 'Lvl.8: +10 coins.', 'Lvl.9: +15 coins.'] },
      ],
      branch10: [
        { key: 'legendary', name: 'Objet légendaire', name_en: 'Legendary Item', icon: '🌟', desc: 'Quand tu utilises un indice et que tu réponds juste, tu gagnes un objet légendaire.', desc_en: 'When you use a hint and answer correctly, you gain a legendary item.', effect: { legendaryOnHint: true } },
        { key: 'clairvoyance', name: 'Clairvoyance', name_en: 'Clairvoyance', icon: '🔮', desc: 'Actif (5 charges) : révèle la bonne réponse à toutes les questions du tour.', desc_en: 'Active (5 charges): reveals the correct answer to all questions this turn.', effect: { clairvoyance: true, activeCost: 5 } },
        { key: 'wisdom', name: 'Sagesse partagée', name_en: 'Shared Wisdom', icon: '👁️', desc: 'Passif : au début de chaque question, élimine gratuitement 1 mauvaise réponse.', desc_en: 'Passive: at the start of each question, removes 1 wrong answer for free.', effect: { sharedWisdom: true } },
      ],
      upgradeCosts: TREE_COSTS,
    },
  },
  relance: {
    name: 'Relance',
    name_en: 'Reroll',
    icon: '\u{1F3B2}',
    desc: 'Relance le de.',
    desc_en: 'Rerolls the die.',
    type: 'instant',
    category: 'def',
    price: 15,
    color: '#8745d4',
    activationCost: 8,
    upgradeCosts: [20, 30],
    levels: [
      { desc: 'Relance le de 1 fois', desc_en: 'Rerolls the die once', effect: { type: 'reroll', mode: 'replace' } },
      { desc: 'Relance + garde le meilleur resultat', desc_en: 'Reroll + keep the best result', effect: { type: 'reroll', mode: 'best' } },
      { desc: 'Relance + avance du total des 2 des', desc_en: 'Reroll + move by the total of both dice', effect: { type: 'reroll', mode: 'sum' } },
    ],
    tree: {
      // Cœur de la relance : MODE de résolution (replace → best → sum, le plus haut
      // palier gagne), REMBOURSEMENT de charge (L2/L4) et RELANCE ASSURÉE (L8 :
      // résultat minimum garanti, le multi-dé ayant été retiré du jeu).
      // Toutes ces valeurs sont calibrables via balanceConfig (tree.scale).
      scale: [
        { type: 'reroll', mode: 'replace' },                              // L1 Relance
        { type: 'reroll', mode: 'replace', refundChance: 0.10 },          // L2 Remboursement 10%
        { type: 'reroll', mode: 'best', refundChance: 0.10 },             // L3 Garde le meilleur
        { type: 'reroll', mode: 'best', refundChance: 0.25 },             // L4 Remboursement 25%
        { type: 'reroll', mode: 'best', refundChance: 0.25 },             // L5 (embranchement)
        { type: 'reroll', mode: 'sum', refundChance: 0.25 },              // L6 Somme
        { type: 'reroll', mode: 'sum', refundChance: 0.25 },              // L7 (renfort voie palier 1)
        { type: 'reroll', mode: 'sum', refundChance: 0.25, minRoll: 3 },  // L8 Relance assurée (≥3)
        { type: 'reroll', mode: 'sum', refundChance: 0.25, minRoll: 3 },  // L9 (renfort voie palier 2)
        { type: 'reroll', mode: 'sum', refundChance: 0.25, minRoll: 4 },  // L10 (ultime)
      ],
      // Description « élève » par niveau : on n'écrit QUE ce que le niveau apporte
      // de nouveau (pas de répétition des acquis précédents). Affichée dans l'arbre
      // de talent et la boutique.
      scaleDesc: [
        'Tu peux relancer le dé : ta nouvelle valeur remplace l’ancienne.',
        'Bonus : 1 chance sur 10 de récupérer la charge dépensée.',
        'La relance garde le meilleur des deux dés (ancien ou nouveau).',
        'La chance de récupérer la charge passe à 1 sur 4.',
        'Tu choisis une spécialité de Relance (3 voies au choix).',
        'La relance additionne les deux dés au lieu d’en garder un seul.',
        'Ta spécialité de Relance gagne un premier renfort.',
        'La relance garantit un résultat d’au moins 3 (jamais de petit dé).',
        'Ta spécialité de Relance atteint son plein effet.',
        'Tu choisis un pouvoir ultime de Relance (3 au choix).',
      ],
      scaleDesc_en: [
        'You can reroll the die: your new value replaces the old one.',
        'Bonus: 1-in-10 chance to recover the charge you spent.',
        'The reroll keeps the better of the two dice (old or new).',
        'The chance to recover the charge rises to 1-in-4.',
        'Pick a Reroll specialty (3 paths to choose from).',
        'The reroll adds both dice together instead of keeping one.',
        'Your Reroll specialty gains a first boost.',
        'The reroll guarantees a result of at least 3 (never a tiny die).',
        'Your Reroll specialty reaches full power.',
        'Pick an ultimate Reroll power (3 to choose from).',
      ],
      // Voies L5. `effect` = effet de base ; `tiers` = renforts appliqués en L7
      // (tiers[0]) puis L9 (tiers[1]). Le résolveur fusionne base → tier1 → tier2.
      branch5: [
        { key: 'lucrative', name: 'Relance lucrative', name_en: 'Lucrative Reroll', icon: '🪙',
          desc: 'À chaque relance, gagne de l’or égal à la valeur du dé.',
          desc_en: 'Each reroll grants gold equal to the die value.',
          effect: { goldPerRoll: 1 }, tiers: [{ goldPerRoll: 2 }, { goldPerRoll: 3 }],
          tierDesc: ['Niv.7 : or ×2 la valeur du dé.', 'Niv.9 : or ×3 la valeur du dé.'],
          tierDesc_en: ['Lvl.7: gold ×2 the die value.', 'Lvl.9: gold ×3 the die value.'] },
        { key: 'opportune', name: 'Relance opportune', name_en: 'Timely Reroll', icon: '⏱️',
          desc: 'À la relance : +10 s au timer et tu choisis le thème de ta question.',
          desc_en: 'On reroll: +10s timer and you pick your question’s theme.',
          effect: { reqTimeBonus: 10, reChooseSubject: true },
          tiers: [{ reqTimeBonus: 20 }, { reqTimeBonus: 30 }],
          tierDesc: ['Niv.7 : bonus de temps porté à +20 s.', 'Niv.9 : bonus de temps porté à +30 s.'],
          tierDesc_en: ['Lvl.7: time bonus raised to +20s.', 'Lvl.9: time bonus raised to +30s.'] },
        { key: 'chanceuse', name: 'Relance chanceuse', name_en: 'Lucky Reroll', icon: '🍀',
          desc: 'Sur un résultat de 6+, recharge un autre pouvoir.',
          desc_en: 'On a 6+ result, recharge another power.',
          effect: { rechargeOnHigh: 6 }, tiers: [{ lootBonusOnHigh: 0.5 }, { doubleLootOnHigh: 0.5 }],
          tierDesc: ['Niv.7 : sur un 6+, +50 % de chance de loot.', 'Niv.9 : 50 % de chance d’un 2ᵉ loot.'],
          tierDesc_en: ['Lvl.7: on a 6+, +50% loot chance.', 'Lvl.9: 50% chance of a 2nd loot.'] },
      ],
      branch10: [
        { key: 'swap', name: 'Échange de place', name_en: 'Place Swap', icon: '🔄',
          desc: 'Actif : dépense 5 charges pour échanger ta place avec le groupe le plus avancé.',
          desc_en: 'Active: spend 5 charges to swap places with the most advanced team.',
          effect: { swapWithLeader: true, swapCost: 5 } },
        { key: 'lateStarter', name: 'Élan du retardataire', name_en: 'Underdog’s Surge', icon: '🐢',
          desc: 'En début de tour, si tu es la moins avancée, gagne 1 charge de relance.',
          desc_en: 'At the start of your turn, if you are last, gain 1 reroll charge.',
          effect: { lateStarterCharge: 1 } },
        { key: 'vengeful', name: 'Relance vengeresse', name_en: 'Vengeful Reroll', icon: '⚔️',
          desc: 'En plus d’avancer, fait reculer le 1ᵉʳ groupe de la valeur du dé.',
          desc_en: 'In addition to moving, pushes the leading team back by the die value.',
          effect: { vengefulPushLeader: true } },
      ],
      upgradeCosts: TREE_COSTS,
    },
  },
  foudre: {
    name: 'Foudre',
    name_en: 'Lightning',
    icon: '⚡',
    desc: 'Recule un adversaire.',
    desc_en: 'Pushes an opponent back.',
    type: 'target',
    category: 'off',
    price: 15,
    color: '#e85d6b',
    activationCost: 10,
    upgradeCosts: [20, 30],
    levels: [
      { desc: 'Recule la cible de 1D4 cases', desc_en: 'Pushes the target back 1D4 squares', effect: { type: 'reculTarget', amount: 'd4' } },
      { desc: 'Recule la cible de 1D6 cases', desc_en: 'Pushes the target back 1D6 squares', effect: { type: 'reculTarget', amount: 'd6' } },
      { desc: 'Recule la cible de 1D10 cases', desc_en: 'Pushes the target back 1D10 squares', effect: { type: 'reculTarget', amount: 'd10' } },
    ],
    tree: {
      // Cœur : dé de recul (D4→D6→D6+1→D10→D10+1). L3 ajoute « Opportuniste »
      // (avance d'un D4 si la cible traverse ta case en reculant). Renforts de voie
      // aux niveaux 6/7/9 (le cœur n'y change pas).
      scale: [
        { type: 'reculTarget', amount: 'd4' },                              // L1
        { type: 'reculTarget', amount: 'd6' },                              // L2
        { type: 'reculTarget', amount: 'd6', opportuniste: 'd4' },          // L3 Opportuniste
        { type: 'reculTarget', amount: 'd6', flat: 1, opportuniste: 'd4' }, // L4 D6+1
        { type: 'reculTarget', amount: 'd6', flat: 1, opportuniste: 'd4' }, // L5 (embranchement)
        { type: 'reculTarget', amount: 'd6', flat: 1, opportuniste: 'd4' }, // L6 (renfort palier 1)
        { type: 'reculTarget', amount: 'd6', flat: 1, opportuniste: 'd4' }, // L7 (renfort palier 2)
        { type: 'reculTarget', amount: 'd10', opportuniste: 'd4' },         // L8 D10
        { type: 'reculTarget', amount: 'd10', opportuniste: 'd4' },         // L9 (renfort palier 3)
        { type: 'reculTarget', amount: 'd10', flat: 1, opportuniste: 'd4' },// L10 (ultime) D10+1
      ],
      tierLevels: [6, 7, 9], // 3 paliers de voie délivrés à L6, L7, L9
      scaleDesc: [
        'Recule la cible d’un D4.',
        'Le recul passe à un D6.',
        'Opportuniste : si la cible traverse ta case en reculant, tu avances d’un D4.',
        'Le recul passe à D6+1.',
        'Tu choisis une voie de Foudre (3 au choix).',
        'Ta voie de Foudre gagne son 1ᵉʳ palier.',
        'Ta voie de Foudre gagne son 2ᵉ palier.',
        'Le recul passe à un D10.',
        'Ta voie de Foudre gagne son 3ᵉ palier.',
        'Tu choisis un ultime de Foudre ; recul de base porté à D10+1.',
      ],
      scaleDesc_en: [
        'Push the target back by a D4.',
        'Setback rises to a D6.',
        'Opportunist: if the target passes through your square while recoiling, you move forward a D4.',
        'Setback rises to D6+1.',
        'Pick a Lightning path (3 to choose from).',
        'Your Lightning path gains its 1st tier.',
        'Your Lightning path gains its 2nd tier.',
        'Setback rises to a D10.',
        'Your Lightning path gains its 3rd tier.',
        'Pick an ultimate Lightning power; base setback raised to D10+1.',
      ],
      branch5: [
        { key: 'pillage', name: 'Pillage', name_en: 'Pillage', icon: '🪙',
          desc: 'En reculant la cible, tu lui voles de l’or (lié à la valeur du dé).',
          desc_en: 'As you push the target back, you steal gold from it (tied to the die value).',
          effect: { pillage: true }, tiers: [{ pillageMult: 0.5 }, { pillageMult: 1 }, { pillageMult: 2 }],
          tierDesc: ['Niv.6 : vole ½ × la valeur du dé.', 'Niv.7 : vole 1× la valeur du dé.', 'Niv.9 : vole 2× la valeur du dé.'],
          tierDesc_en: ['Lvl.6: steal ½ × the die value.', 'Lvl.7: steal 1× the die value.', 'Lvl.9: steal 2× the die value.'] },
        { key: 'poseTrap', name: 'Pose-piège', name_en: 'Trap Layer', icon: '🪤',
          desc: 'Un piège est posé là où était la cible ; son effet = le recul de ton niveau de Foudre.',
          desc_en: 'A trap is placed where the target stood; its effect = your current Lightning setback.',
          effect: { poseTrap: true }, tiers: [{ poseTrapCount: 1 }, { poseTrapCount: 2 }, { poseTrapCount: 3 }],
          tierDesc: ['Niv.6 : 1 piège (case cible).', 'Niv.7 : +1 piège aléatoire sur le trajet.', 'Niv.9 : +1 piège de plus.'],
          tierDesc_en: ['Lvl.6: 1 trap (target square).', 'Lvl.7: +1 random trap on the path.', 'Lvl.9: +1 more trap.'] },
        { key: 'reaction', name: 'Réaction en chaîne', name_en: 'Chain Reaction', icon: '🔗',
          desc: 'Si la cible recule sur une case occupée, cette équipe recule aussi (tu es immunisé).',
          desc_en: 'If the target recoils onto an occupied square, that team also recoils (you are immune).',
          effect: { reaction: true }, tiers: [{ chainRecul: 'd4' }, { chainRecul: 'd6' }, { chainRecul: 'd6', chainFlat: 1 }],
          tierDesc: ['Niv.6 : recul en chaîne de 1D4.', 'Niv.7 : recul en chaîne de 1D6.', 'Niv.9 : recul en chaîne de 1D6+1.'],
          tierDesc_en: ['Lvl.6: chain setback of 1D4.', 'Lvl.7: chain setback of 1D6.', 'Lvl.9: chain setback of 1D6+1.'] },
      ],
      branch10: [
        { key: 'cataclysm', name: 'Cataclysme', name_en: 'Cataclysm', icon: '🌩️', desc: 'Cible toutes les équipes sauf toi.', desc_en: 'Targets all teams except you.', effect: { allOthers: true } },
        { key: 'banishStart', name: 'Renvoi au départ', name_en: 'Banish to Start', icon: '⏮️', desc: 'Actif : dépense 5 charges pour renvoyer une équipe au départ.', desc_en: 'Active: spend 5 charges to send a team back to the start.', effect: { banishStart: true, activeCost: 5 } },
        { key: 'orage', name: 'Orage persistant', name_en: 'Lingering Storm', icon: '⛈️', desc: 'Pendant 2 tours, au début du tour de la cible, elle recule d’1D4 (non cumulable).', desc_en: 'For 2 turns, at the start of the target’s turn, it recoils 1D4 (does not stack).', effect: { orageTurns: 2, orageDie: 'd4' } },
      ],
      upgradeCosts: TREE_COSTS,
    },
  },
  sablier: {
    name: 'Sablier',
    name_en: 'Hourglass',
    icon: '⏱️',
    desc: 'Reduit le timer de la cible.',
    desc_en: 'Shortens the target’s timer.',
    type: 'target',
    category: 'off',
    price: 15,
    color: '#a83e7f',
    activationCost: 8,
    upgradeCosts: [20, 30],
    levels: [
      { desc: 'Timer divise par 2 (15s)', desc_en: 'Timer halved (15s)', effect: { type: 'timerReduce', divisor: 2 } },
      { desc: 'Timer divise par 3 (10s)', desc_en: 'Timer divided by 3 (10s)', effect: { type: 'timerReduce', divisor: 3 } },
      { desc: 'Timer divise par 4 (7s)', desc_en: 'Timer divided by 4 (7s)', effect: { type: 'timerReduce', divisor: 4 } },
    ],
    tree: {
      // Cœur : diviseur du timer (÷2 → ÷2,5 → ÷3 → ÷4). L4 ajoute l'auto-ciblage
      // (te cibler MULTIPLIE le timer au lieu de le diviser). Renforts 6/8/9.
      scale: [
        { type: 'timerReduce', divisor: 2 },                       // L1
        { type: 'timerReduce', divisor: 2.5 },                     // L2
        { type: 'timerReduce', divisor: 3 },                       // L3
        { type: 'timerReduce', divisor: 3, autoTarget: true },     // L4 Auto-ciblage
        { type: 'timerReduce', divisor: 3, autoTarget: true },     // L5 (embranchement)
        { type: 'timerReduce', divisor: 3, autoTarget: true },     // L6 (renfort palier 1)
        { type: 'timerReduce', divisor: 4, autoTarget: true },     // L7 ÷4
        { type: 'timerReduce', divisor: 4, autoTarget: true },     // L8 (renfort palier 2)
        { type: 'timerReduce', divisor: 4, autoTarget: true },     // L9 (renfort palier 3)
        { type: 'timerReduce', divisor: 4, autoTarget: true },     // L10 (ultime)
      ],
      tierLevels: [6, 8, 9],
      scaleDesc: [
        'Divise le timer de la cible par 2.',
        'Diviseur porté à ÷2,5.',
        'Diviseur porté à ÷3.',
        'Auto-ciblage : tu peux te cibler ; le timer est alors multiplié (tu gagnes du temps).',
        'Tu choisis une voie de Sablier (3 au choix).',
        'Ta voie de Sablier gagne son 1ᵉʳ palier.',
        'Diviseur porté à ÷4.',
        'Ta voie de Sablier gagne son 2ᵉ palier.',
        'Ta voie de Sablier gagne son 3ᵉ palier.',
        'Tu choisis un ultime de Sablier (3 au choix).',
      ],
      scaleDesc_en: [
        'Halves the target’s timer.',
        'Divider raised to ÷2.5.',
        'Divider raised to ÷3.',
        'Self-target: you may target yourself; the timer is then multiplied (you gain time).',
        'Pick an Hourglass path (3 to choose from).',
        'Your Hourglass path gains its 1st tier.',
        'Divider raised to ÷4.',
        'Your Hourglass path gains its 2nd tier.',
        'Your Hourglass path gains its 3rd tier.',
        'Pick an ultimate Hourglass power (3 to choose from).',
      ],
      branch5: [
        { key: 'larcin', name: 'Larcin', name_en: 'Larceny', icon: '🗡️',
          desc: 'Si la cible répond faux, chance de lui voler un objet.',
          desc_en: 'If the target answers wrong, a chance to steal an item from it.',
          effect: { larcin: true }, tiers: [{ larcinChance: 0.25 }, { larcinChance: 0.5 }, { larcinChance: 0.75 }],
          tierDesc: ['Niv.6 : 25 % de vol.', 'Niv.8 : 50 % de vol.', 'Niv.9 : 75 % de vol.'],
          tierDesc_en: ['Lvl.6: 25% steal.', 'Lvl.8: 50% steal.', 'Lvl.9: 75% steal.'] },
        { key: 'sandbank', name: 'Voleur de sable', name_en: 'Sand Thief', icon: '💨',
          desc: 'Le temps retiré aux cibles est ajouté au timer de ta prochaine question.',
          desc_en: 'Time removed from targets is added to your next question’s timer.',
          effect: { sandBank: true }, tiers: [{ sandBankFactor: 0.5 }, { sandBankFactor: 1 }, { sandBankFactor: 2 }],
          tierDesc: ['Niv.6 : ½ du temps volé.', 'Niv.8 : 100 % du temps volé.', 'Niv.9 : 2× le temps volé.'],
          tierDesc_en: ['Lvl.6: ½ of the time stolen.', 'Lvl.8: 100% of the time stolen.', 'Lvl.9: 2× the time stolen.'] },
        { key: 'modeleur', name: 'Modeleur de l’espace', name_en: 'Space Shaper', icon: '🌀',
          desc: 'Pour la cible, les réponses changent de place (difficile de cliquer).',
          desc_en: 'For the target, the answers shift position (hard to click).',
          effect: { modeleur: true }, tiers: [{ modeleurInterval: 4 }, { modeleurInterval: 3 }, { modeleurInterval: 2 }],
          tierDesc: ['Niv.6 : changement toutes les 4 s.', 'Niv.8 : toutes les 3 s.', 'Niv.9 : toutes les 2 s.'],
          tierDesc_en: ['Lvl.6: shuffle every 4s.', 'Lvl.8: every 3s.', 'Lvl.9: every 2s.'] },
      ],
      branch10: [
        { key: 'sandstorm', name: 'Tempête de sable', name_en: 'Sandstorm', icon: '🏜️', desc: 'Cible tout le monde sauf toi.', desc_en: 'Targets everyone except you.', effect: { allOthers: true } },
        { key: 'broken', name: 'Sablier brisé', name_en: 'Broken Hourglass', icon: '⏱️', desc: 'Actif (5 charges) : réduit le timer MAX des autres équipes, jusqu’à un minimum de 7 s.', desc_en: 'Active (5 charges): reduces the MAX timer of other teams, down to a 7s minimum.', effect: { brokenTimer: true, activeCost: 5, brokenFloor: 7 } },
        { key: 'glaneur', name: 'Glaneur', name_en: 'Gleaner', icon: '🪙', desc: 'Passif : tu gagnes toutes les pièces non gagnées par les autres (erreur ou réponse trop lente).', desc_en: 'Passive: you gain every coin not earned by the others (wrong or too-slow answer).', effect: { glaneur: true } },
      ],
      upgradeCosts: TREE_COSTS,
    },
  },
  double: {
    name: 'Double question',
    name_en: 'Double Question',
    icon: '❓',
    desc: 'Ajoute des questions au prochain tour de la cible (cumulable).',
    desc_en: 'Adds questions to the target’s next turn (stackable).',
    type: 'target',
    category: 'off',
    price: 15,
    color: '#c9472f',
    activationCost: 10,
    upgradeCosts: [20, 30],
    levels: [
      { desc: '+1 question au prochain tour (cumulable, sans bonus pieces)', desc_en: '+1 question next turn (stackable, no coin bonus)', effect: { type: 'multiQuestion', add: 1, noBonus: true } },
      { desc: '+2 questions au prochain tour (cumulable, sans bonus)', desc_en: '+2 questions next turn (stackable, no bonus)', effect: { type: 'multiQuestion', add: 2, noBonus: true } },
      { desc: '+2 questions (cumulable) + timer divise par 2', desc_en: '+2 questions (stackable) + timer halved', effect: { type: 'multiQuestion', add: 2, noBonus: true, timerDivisor: 2 } },
    ],
    tree: {
      // Cœur : questions imposées garanties (1→2→3, plafond ~5 au runtime) +
      // chance d'imposer une question DE PLUS (5 % → 15 %). Renforts 7/8/9.
      scale: [
        { type: 'multiQuestion', add: 1, noBonus: true },                         // L1
        { type: 'multiQuestion', add: 1, noBonus: true, bonusChance: 0.05 },      // L2 5%
        { type: 'multiQuestion', add: 2, noBonus: true, bonusChance: 0.05 },      // L3
        { type: 'multiQuestion', add: 2, noBonus: true, bonusChance: 0.15 },      // L4 15%
        { type: 'multiQuestion', add: 2, noBonus: true, bonusChance: 0.15 },      // L5 (embranchement)
        { type: 'multiQuestion', add: 3, noBonus: true, bonusChance: 0.15 },      // L6 +3
        { type: 'multiQuestion', add: 3, noBonus: true, bonusChance: 0.15 },      // L7 (renfort palier 1)
        { type: 'multiQuestion', add: 3, noBonus: true, bonusChance: 0.15 },      // L8 (renfort palier 2)
        { type: 'multiQuestion', add: 3, noBonus: true, bonusChance: 0.15 },      // L9 (renfort palier 3)
        { type: 'multiQuestion', add: 3, noBonus: true, bonusChance: 0.15 },      // L10 (ultime)
      ],
      tierLevels: [7, 8, 9],
      scaleDesc: [
        'Impose +1 question à la cible.',
        '5 % de chance d’imposer une question de plus.',
        'Impose +2 questions.',
        'La chance d’une question de plus passe à 15 %.',
        'Tu choisis une voie de Double (3 au choix).',
        'Impose +3 questions (plafond ~5).',
        'Ta voie de Double gagne son 1ᵉʳ palier.',
        'Ta voie de Double gagne son 2ᵉ palier.',
        'Ta voie de Double gagne son 3ᵉ palier.',
        'Tu choisis un ultime de Double (3 au choix).',
      ],
      scaleDesc_en: [
        'Impose +1 question on the target.',
        '5% chance to impose one more question.',
        'Impose +2 questions.',
        'The chance of one more question rises to 15%.',
        'Pick a Double path (3 to choose from).',
        'Impose +3 questions (cap ~5).',
        'Your Double path gains its 1st tier.',
        'Your Double path gains its 2nd tier.',
        'Your Double path gains its 3rd tier.',
        'Pick an ultimate Double power (3 to choose from).',
      ],
      branch5: [
        { key: 'corsees', name: 'Questions corsées', name_en: 'Tough Questions', icon: '🔥',
          desc: 'Les questions imposées ont une chance d’être « hard core ».',
          desc_en: 'The imposed questions have a chance to be "hardcore".',
          effect: { corsees: true }, tiers: [{ hardcoreChance: 0.05 }, { hardcoreChance: 0.10 }, { hardcoreChance: 0.15 }],
          tierDesc: ['Niv.7 : 5 % hard core.', 'Niv.8 : 10 % hard core.', 'Niv.9 : 15 % hard core.'],
          tierDesc_en: ['Lvl.7: 5% hardcore.', 'Lvl.8: 10% hardcore.', 'Lvl.9: 15% hardcore.'] },
        { key: 'saboteur', name: 'Saboteur', name_en: 'Saboteur', icon: '💸',
          desc: 'Si la cible répond faux, elle est pénalisée (gain perdu, puis questions non répondues, puis recul).',
          desc_en: 'If the target answers wrong, it is penalised (lost gain, then unanswered questions, then setback).',
          effect: { saboteur: true }, tiers: [{ saboteurLevel: 1 }, { saboteurLevel: 2 }, { saboteurLevel: 3 }],
          tierDesc: ['Niv.7 : perd l’argent qu’elle devait gagner.', 'Niv.8 : perd aussi l’argent des questions non répondues.', 'Niv.9 : et recule ×(questions restantes).'],
          tierDesc_en: ['Lvl.7: loses the money it would have earned.', 'Lvl.8: also loses the money of unanswered questions.', 'Lvl.9: and recoils ×(remaining questions).'] },
        { key: 'shared', name: 'Temps commun', name_en: 'Shared Time', icon: '🕐',
          desc: 'Les questions imposées partagent un seul et même timer.',
          desc_en: 'The imposed questions share a single timer.',
          effect: { sharedTimer: true }, tiers: [{ sharedTimerCut: 0 }, { sharedTimerCut: 2 }, { sharedTimerCut: 5 }],
          tierDesc: ['Niv.7 : timer commun établi.', 'Niv.8 : −2 s sur le timer commun.', 'Niv.9 : −5 s sur le timer commun.'],
          tierDesc_en: ['Lvl.7: shared timer established.', 'Lvl.8: −2s on the shared timer.', 'Lvl.9: −5s on the shared timer.'] },
      ],
      branch10: [
        { key: 'allOthers', name: 'Cible tout le monde', name_en: 'Target Everyone', icon: '📣', desc: 'La Double touche toutes les équipes sauf toi.', desc_en: 'The Double hits all teams except you.', effect: { allOthers: true } },
        { key: 'surcharge', name: 'Surcharge', name_en: 'Overload', icon: '📚', desc: 'Chaque Double que tu lances impose 2 questions de plus (définitif).', desc_en: 'Every Double you cast imposes 2 more questions (permanent).', effect: { surchargePermanent: 2 } },
        { key: 'report', name: 'Report', name_en: 'Carry-over', icon: '📋', desc: 'Si la cible répond faux, les questions restantes sont reportées à son prochain tour.', desc_en: 'If the target answers wrong, the remaining questions are carried to its next turn.', effect: { report: true } },
      ],
      upgradeCosts: TREE_COSTS,
    },
  },
};
