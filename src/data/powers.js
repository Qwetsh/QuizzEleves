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
      // Cœur : nombre de mauvaises réponses éliminées (count) + bonus de temps.
      scale: [
        { type: 'hideAnswers', count: 1, bonusTime: 0 },
        { type: 'hideAnswers', count: 1, bonusTime: 5 },
        { type: 'hideAnswers', count: 2, bonusTime: 0 },
        { type: 'hideAnswers', count: 2, bonusTime: 5 },
        { type: 'hideAnswers', count: 2, bonusTime: 8 },
        { type: 'hideAnswers', count: 2, bonusTime: 10 },
        { type: 'hideAnswers', count: 3, bonusTime: 5 },
        { type: 'hideAnswers', count: 3, bonusTime: 8 },
        { type: 'hideAnswers', count: 3, bonusTime: 10 },
        { type: 'hideAnswers', count: 3, bonusTime: 15 },
      ],
      branch5: [
        { key: 'clair', name: 'Clairvoyance', name_en: 'Clairvoyance', icon: '👁️', desc: '−1 mauvaise réponse de plus et révèle le thème à l’avance.', desc_en: '−1 more wrong answer and reveals the theme in advance.', effect: { extraHide: 1, revealTheme: true } },
        { key: 'serenity', name: 'Sérénité', name_en: 'Serenity', icon: '😌', desc: 'Temps de réponse ×1,5.', desc_en: 'Answer time ×1.5.', effect: { timerMult: 1.5 } },
        { key: 'fifty', name: '50/50', name_en: '50/50', icon: '⚖️', desc: 'Garde toujours 2 réponses (questions à 4 choix).', desc_en: 'Always keeps 2 answers (4-choice questions).', effect: { keepTwo: true } },
      ],
      branch10: [
        { key: 'omni', name: 'Omniscience', name_en: 'Omniscience', icon: '🔮', desc: 'Révèle la bonne réponse (1×/tour, coûte 2 charges).', desc_en: 'Reveals the correct answer (1×/turn, costs 2 charges).', effect: { revealAnswer: true } },
        { key: 'notimer', name: 'Maître du temps', name_en: 'Time Master', icon: '⏳', desc: 'Aucun timer sur la question (1×/tour).', desc_en: 'No timer on the question (1×/turn).', effect: { noTimer: true } },
        { key: 'cheat', name: 'Antisèche', name_en: 'Cheat Sheet', icon: '📝', desc: '50/50 garanti + bonus d’or si bonne réponse.', desc_en: 'Guaranteed 50/50 + gold bonus on a correct answer.', effect: { keepTwo: true, bonusMoneyOnCorrect: 5 } },
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
      // Cœur : dé de recul. L1-3 = identique aux `levels` (d4/d6/d10).
      scale: [
        { type: 'reculTarget', amount: 'd4' },
        { type: 'reculTarget', amount: 'd6' },
        { type: 'reculTarget', amount: 'd10' },
        { type: 'reculTarget', amount: 'd10', flat: 1 },
        { type: 'reculTarget', amount: 'd12', flat: 1 },
        { type: 'reculTarget', amount: 'd12', flat: 2 },
        { type: 'reculTarget', amount: 'd12', flat: 4 },
        { type: 'reculTarget', amount: 'd12', flat: 6 },
        { type: 'reculTarget', amount: 'd12', flat: 8 },
        { type: 'reculTarget', amount: 'd12', flat: 10 },
      ],
      branch5: [
        { key: 'chain', name: 'Chaîne', name_en: 'Chain', icon: '⛓️', desc: 'Touche aussi l’équipe la mieux placée.', desc_en: 'Also strikes the team in the lead.', effect: { chain: true } },
        { key: 'surge', name: 'Surcharge', name_en: 'Surge', icon: '💥', desc: 'Recul +50 % mais coûte 1 charge de plus.', desc_en: 'Setback +50% but costs 1 extra charge.', effect: { amountMult: 1.5, extraChargeCost: 1 } },
        { key: 'storm', name: 'Tempête ciblée', name_en: 'Targeted Storm', icon: '🌩️', desc: 'La cible perd aussi 5 or.', desc_en: 'The target also loses 5 gold.', effect: { stealGold: 5 } },
      ],
      branch10: [
        { key: 'cataclysm', name: 'Cataclysme', name_en: 'Cataclysm', icon: '🌋', desc: 'Recule toutes les autres équipes.', desc_en: 'Pushes back all other teams.', effect: { allOthers: true } },
        { key: 'banish', name: 'Bannissement', name_en: 'Banishment', icon: '🕳️', desc: 'Renvoie la cible à la dernière jonction.', desc_en: 'Sends the target back to the last junction.', effect: { toPrevJunction: true } },
        { key: 'orage', name: 'Orage', name_en: 'Thunderstorm', icon: '🌩️', desc: 'Pose un piège-foudre sur une case.', desc_en: 'Places a lightning trap on a square.', effect: { placeTrap: true } },
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
      // Cœur : diviseur du timer. L1-3 = identique aux `levels` (2/3/4).
      scale: [
        { type: 'timerReduce', divisor: 2 },
        { type: 'timerReduce', divisor: 3 },
        { type: 'timerReduce', divisor: 4 },
        { type: 'timerReduce', divisor: 4 },
        { type: 'timerReduce', divisor: 5 },
        { type: 'timerReduce', divisor: 5 },
        { type: 'timerReduce', divisor: 6 },
        { type: 'timerReduce', divisor: 6 },
        { type: 'timerReduce', divisor: 7 },
        { type: 'timerReduce', divisor: 8 },
      ],
      branch5: [
        { key: 'tax', name: 'Taxe du temps', name_en: 'Time Tax', icon: '💸', desc: 'La cible perd 5 or si elle dépasse le temps.', desc_en: 'The target loses 5 gold if it runs out of time.', effect: { goldPenaltyOnTimeout: 5 } },
        { key: 'confuse', name: 'Confusion', name_en: 'Confusion', icon: '🌀', desc: 'Masque brièvement l’énoncé.', desc_en: 'Briefly hides the question text.', effect: { confuse: true } },
        { key: 'silence', name: 'Silence', name_en: 'Silence', icon: '🔇', desc: 'La cible ne peut pas utiliser de pouvoir à son prochain tour.', desc_en: 'The target cannot use a power on its next turn.', effect: { silenceNextTurn: true } },
      ],
      branch10: [
        { key: 'freeze', name: 'Gel', name_en: 'Freeze', icon: '🧊', desc: 'La cible saute son prochain lancer.', desc_en: 'The target skips its next roll.', effect: { skipNextRoll: true } },
        { key: 'stealtime', name: 'Vol de temps', name_en: 'Time Theft', icon: '⏲️', desc: 'Le temps retiré est ajouté à ton prochain tour.', desc_en: 'The time removed is added to your next turn.', effect: { stealTime: true } },
        { key: 'sandstorm', name: 'Tempête de sable', name_en: 'Sandstorm', icon: '🏜️', desc: 'Timer réduit pour toutes les autres équipes.', desc_en: 'Timer reduced for all other teams.', effect: { allOthers: true } },
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
      // Cœur : questions ajoutées. L1-3 = identique aux `levels`.
      scale: [
        { type: 'multiQuestion', add: 1, noBonus: true },
        { type: 'multiQuestion', add: 2, noBonus: true },
        { type: 'multiQuestion', add: 2, noBonus: true, timerDivisor: 2 },
        { type: 'multiQuestion', add: 3, noBonus: true, timerDivisor: 2 },
        { type: 'multiQuestion', add: 3, noBonus: true, timerDivisor: 2 },
        { type: 'multiQuestion', add: 4, noBonus: true, timerDivisor: 2 },
        { type: 'multiQuestion', add: 4, noBonus: true, timerDivisor: 2 },
        { type: 'multiQuestion', add: 5, noBonus: true, timerDivisor: 2 },
        { type: 'multiQuestion', add: 5, noBonus: true, timerDivisor: 3 },
        { type: 'multiQuestion', add: 6, noBonus: true, timerDivisor: 3 },
      ],
      branch5: [
        { key: 'exam', name: 'Examen surprise', name_en: 'Pop Quiz', icon: '🎓', desc: 'Une question est Hardcore : gros bonus si tout est juste, recul aggravé sinon.', desc_en: 'One question is Hardcore: big bonus if all correct, worse setback otherwise.', effect: { hardcoreOne: true } },
        { key: 'shared', name: 'Chrono partagé', name_en: 'Shared Timer', icon: '⏳', desc: 'Un seul timer pour toute la rafale, mais +50 % d’or par bonne réponse.', desc_en: 'A single timer for the whole burst, but +50% gold per correct answer.', effect: { sharedTimer: true, goldMult: 1.5 } },
        { key: 'calm', name: 'Rafale tranquille', name_en: 'Calm Burst', icon: '📚', desc: '+1 question, mais gain par question divisé par 2.', desc_en: '+1 question, but gold per question halved.', effect: { extraAdd: 1, goldDiv: 2 } },
      ],
      branch10: [
        { key: 'general', name: 'Interro générale', name_en: 'General Test', icon: '🏫', desc: 'La cible subit aussi la double au tour suivant.', desc_en: 'The target also takes the double on the following turn.', effect: { reflectToTarget: true } },
        { key: 'allin', name: 'Tout ou rien', name_en: 'All or Nothing', icon: '🎰', desc: '×2 gains si 100 % réussi, 0 sinon.', desc_en: '×2 gold if 100% correct, 0 otherwise.', effect: { allOrNothing: true } },
        { key: 'marathon', name: 'Marathon+', name_en: 'Marathon+', icon: '🏃', desc: 'Encore +2 questions + chrono partagé.', desc_en: '+2 more questions + shared timer.', effect: { extraAdd: 2, sharedTimer: true } },
      ],
      upgradeCosts: TREE_COSTS,
    },
  },
};
