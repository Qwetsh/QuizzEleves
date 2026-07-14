// Glossaire des TERMES DE MÉCANIQUE du jeu (≠ entités nommées comme objets ou
// pouvoirs, déjà couverts par leurs propres données). Sert à rendre cliquables,
// dans le journal, les mots de mécanique (« recul », « jonction », « duel »…) et
// à afficher une fiche d'explication. Bilingue FR/EN.
//
// Chaque entrée : { name, name_en, icon, desc, desc_en, color?, aliases?, aliases_en? }
//   - aliases : formes alternatives à reconnaître dans le texte (synonymes,
//     pluriels, formes verbales courantes). Évite les mots trop génériques.
export const GLOSSARY_TERMS = {
  recul: {
    name: 'Recul', name_en: 'Setback', icon: '⬅️', color: '#b5341f',
    aliases: ['reculer', 'recule', 'recules', 'reculs', 'reculent', 'reculé', 'reculée'],
    aliases_en: ['setbacks', 'move back', 'pushed back'],
    desc: "Faire revenir un pion en arrière de plusieurs cases. Arrive sur mauvaise réponse, défaite en duel, certains événements ou la Foudre. Le Bouclier et certains équipements amortissent le recul (sauf la Foudre).",
    desc_en: "Sending a pawn backwards by several squares. Happens on a wrong answer, a duel loss, some events or Lightning. The Shield and some gear cushion setbacks (except Lightning).",
  },
  jonction: {
    name: 'Jonction', name_en: 'Junction', icon: '🎲', color: '#e0a458',
    aliases: ['carrefour', 'jonctions', 'embranchement'],
    aliases_en: ['junctions', 'crossroads', 'fork'],
    desc: "Une case où le chemin se sépare en plusieurs voies. En t'y arrêtant, tu choisis la direction à prendre (sauf effet « voie aléatoire »).",
    desc_en: "A square where the path splits into several routes. Stopping on it lets you choose which way to go (unless a 'random path' effect applies).",
  },
  duel: {
    name: 'Duel', name_en: 'Duel', icon: '⚔️',
    aliases: ['duels', 'défi'],
    aliases_en: ['duels', 'challenge'],
    desc: "Un affrontement entre deux équipes : un mini-jeu ou une question départage. Le perdant subit un recul ou se fait voler de l'or. Certains objets rendent immunisé aux duels.",
    desc_en: "A clash between two teams settled by a mini-game or a question. The loser takes a setback or gets gold stolen. Some items grant duel immunity.",
  },
  piege: {
    name: 'Piège', name_en: 'Trap', icon: '🪤', color: '#8a1f2e',
    aliases: ['piège', 'pièges', 'piege', 'pieges'],
    aliases_en: ['traps'],
    desc: "Un effet caché posé sur une case. La première équipe qui marche dessus le déclenche (recul, perte d'or…). Tu peux inspecter un piège visible en cliquant son icône.",
    desc_en: "A hidden effect placed on a square. The first team to step on it triggers it (setback, gold loss…). You can inspect a visible trap by clicking its icon.",
  },
  serie: {
    name: 'Série', name_en: 'Streak', icon: '🔥', color: '#c65429',
    aliases: ['série', 'séries', 'serie'],
    aliases_en: ['streaks', 'combo'],
    desc: "Le nombre de bonnes réponses consécutives. Elle augmente certains gains (or, effets « à l'échelle ») et se brise à la première erreur.",
    desc_en: "Your number of correct answers in a row. It boosts some rewards (gold, 'scaling' effects) and breaks on the first wrong answer.",
  },
  malediction: {
    name: 'Malédiction', name_en: 'Curse', icon: '🔮', color: '#8745d4',
    aliases: ['malédiction', 'malédictions', 'malediction', 'maudit'],
    aliases_en: ['curses', 'cursed'],
    desc: "Un malus temporaire posé sur une équipe : timer réduit, question(s) supplémentaire(s), pouvoirs ou consommables bloqués… Il se dissipe au bout de quelques tours.",
    desc_en: "A temporary penalty on a team: reduced timer, extra question(s), blocked powers or consumables… It wears off after a few turns.",
  },
  saignementOr: {
    name: "Saignement d'or", name_en: 'Gold bleed', icon: '🩸', color: '#b5341f',
    aliases: ['saignement', "saignement d'or"],
    aliases_en: ['gold bleed', 'bleed'],
    desc: "Un effet de durée (DoT) qui fait perdre de l'or à chaque tour, parfois au profit de l'équipe qui l'a posé.",
    desc_en: "A damage-over-time effect that drains gold every turn, sometimes to the benefit of the team that applied it.",
  },
  enchantement: {
    name: 'Enchantement', name_en: 'Enchantment', icon: '✦', color: '#8a4fc0',
    aliases: ['enchantement', 'enchantements', 'enchanté', 'enchanter', 'parchemin', 'parchemins'],
    aliases_en: ['enchantments', 'enchanted', 'scroll', 'scrolls'],
    desc: "Un bonus gravé sur un objet via un parchemin. L'enchantement suit l'objet et s'ajoute à ses effets. Un marqueur ✦ signale un objet enchanté.",
    desc_en: "A bonus engraved onto an item with a scroll. The enchantment follows the item and adds to its effects. A ✦ marker shows an enchanted item.",
  },
  forge: {
    name: 'Forge', name_en: 'Forge', icon: '🔨', color: '#b8862c',
    aliases: ['forger', 'forgé', 'forgée'],
    aliases_en: ['forging', 'forged', 'die face', 'die faces'],
    desc: "L'atelier où tu personnalises les faces de ton dé : chaque face porte une valeur de déplacement et parfois un effet. Chaque équipe peut avoir un dé différent.",
    desc_en: "The workshop where you customise your die faces: each face carries a move value and sometimes an effect. Each team can have a different die.",
  },
  immunite: {
    name: 'Immunité', name_en: 'Immunity', icon: '🔒', color: '#3b6cb3',
    aliases: ['immunité', 'immunités', 'immunite', 'immunisé', 'immunisée'],
    aliases_en: ['immunities', 'immune'],
    desc: "Une protection qui annule un type d'effet subi : vol d'or, vol d'objet, duels, Tempête… Tant qu'elle est active, l'effet correspondant n'a aucun impact.",
    desc_en: "A protection that cancels a type of incoming effect: gold theft, item theft, duels, Storm… While active, the matching effect has no impact.",
  },
  renvoi: {
    name: "Renvoi d'effet", name_en: 'Reflect', icon: '↩️', color: '#8745d4',
    aliases: ['renvoi', 'renvoie', 'renvoyer'],
    aliases_en: ['reflects', 'reflected'],
    desc: "Une chance de retourner un effet négatif vers l'équipe qui l'a lancé, au lieu de le subir.",
    desc_en: "A chance to bounce a negative effect back onto the team that cast it, instead of suffering it.",
  },
  epines: {
    name: "Bouclier d'épines", name_en: 'Thorns', icon: '🌵', color: '#2f9d5a',
    aliases: ['épines', 'epines', 'épine'],
    aliases_en: ['thorns', 'thorn'],
    desc: "Quand une équipe te fait reculer ou te vole de l'or, elle en subit une partie en retour (un pourcentage du recul ou de l'or volé).",
    desc_en: 'When a team pushes you back or steals your gold, it suffers part of it in return (a percentage of the setback or stolen gold).',
  },
  butin: {
    name: 'Butin', name_en: 'Loot', icon: '🎁', color: '#c8911f',
    aliases: ['butin', 'loot', 'looter', 'looté'],
    aliases_en: ['loots', 'looted'],
    desc: "Un objet (ou de l'or) gagné aléatoirement : coffre, victoire de duel, événement ou bonne réponse. Certains équipements augmentent la chance de butin.",
    desc_en: "An item (or gold) won at random: chest, duel win, event or correct answer. Some gear increases your loot chance.",
  },
  charge: {
    name: 'Charge', name_en: 'Charge', icon: '⚡', color: '#8745d4',
    aliases: ['charges', 'recharge', 'recharger', 'rechargé'],
    aliases_en: ['charges', 'recharge', 'recharged'],
    desc: "Une utilisation disponible d'un pouvoir. Quand les charges tombent à zéro, le pouvoir doit être rechargé (boutique ou certains effets) avant de resservir.",
    desc_en: "One available use of a power. When charges hit zero, the power must be recharged (shop or certain effects) before it can be used again.",
  },
  fumigene: {
    name: 'Fumigène', name_en: 'Smoke bomb', icon: '💨', color: '#7a8a99',
    aliases: ['fumigène', 'fumigènes', 'fumigene'],
    aliases_en: ['smoke bombs', 'smoke'],
    desc: "Une protection qui annule le prochain pouvoir offensif subi pendant quelques tours.",
    desc_en: "A protection that cancels the next offensive power used against you for a few turns.",
  },
  bouclierBois: {
    name: 'Bouclier de bois', name_en: 'Wooden shield', icon: '🛡️', color: '#8a6d3a',
    aliases: ['bouclier de bois'],
    aliases_en: ['wooden shields'],
    desc: "Un consommable/effet qui amortit le prochain recul subi (1 case par charge), en plus du pouvoir Bouclier. N'agit pas contre la Foudre.",
    desc_en: "A consumable/effect that cushions the next setback (1 square per charge), on top of the Shield power. Does not work against Lightning.",
  },
  // --- Extension « Magie » ---
  magie: {
    name: 'Magie', name_en: 'Magic', icon: '✨', color: '#8745d4',
    aliases: ['magie', 'magique', 'mana'],
    aliases_en: ['magic', 'magical', 'mana'],
    desc: "La ressource des sorts : chaque équipe a une barre de magie qui se recharge EN TEMPS RÉEL (magie par minute), même pendant les tours des autres. On la dépense en incantant sur la table des sorts ; certains équipements accélèrent la régénération ou agrandissent la barre.",
    desc_en: "The spell resource: each team has a magic bar that refills IN REAL TIME (magic per minute), even during other teams' turns. Spend it by casting at the spell table; some gear speeds up regeneration or enlarges the bar.",
  },
  rune: {
    name: 'Rune', name_en: 'Rune', icon: '🖋️', color: '#8745d4',
    aliases: ['rune', 'runes'],
    aliases_en: ['runes'],
    desc: "Un signe magique qu'on TRACE AU DOIGT sur la table des sorts (le sens du tracé compte !). Les runes connues sont archivées au codex ; on en apprend en jouant (bonnes réponses, événements) — et un sort = une séquence précise de runes.",
    desc_en: "A magic sign you TRACE WITH YOUR FINGER on the spell table (stroke direction matters!). Known runes are archived in the codex; you learn new ones by playing (correct answers, events) — and a spell = a precise sequence of runes.",
  },
  sortilege: {
    name: 'Sortilège', name_en: 'Spell', icon: '🪄', color: '#8745d4',
    aliases: ['sortilège', 'sortilèges', 'incantation', 'incanter'],
    aliases_en: ['spells', 'incantation', 'casting'],
    desc: "Une séquence ordonnée de runes tracées à la suite, qui coûte de la magie. Combo connue → le sort part ; combo valide inconnue → DÉCOUVERTE (inscrite au codex) ; combo invalide → le sort échoue et la magie d'essai est perdue. Effets possibles : or, déplacement, vol, bénir/maudire une face de dé, réponses instables…",
    desc_en: "An ordered sequence of runes traced one after another, costing magic. Known combo → the spell fires; valid unknown combo → DISCOVERY (added to the codex); invalid combo → the spell fizzles and the attempt cost is lost. Possible effects: gold, movement, theft, blessing/cursing a die face, unstable answers…",
  },
};
