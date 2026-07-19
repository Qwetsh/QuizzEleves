# Duel Pokémon — vrai combat tour par tour (thème `pokemon`)

> Cadrage du plus gros mini-jeu du projet (spec utilisateur, MINIJEUX_SOUHAITS.md) :
> « Un vrai combat pokémon. Chacun a 3 pokémon différents (parmi les 150 premiers)
> et ont 4 attaques différentes (2 attaques et 2 effets). On recrée vraiment le
> système de combat entier de pokémon (avec force faiblesse etc), le premier qui
> n'a plus de pokémon en jeu perd. On respecte le tour par tour, la possibilité
> de changer de pokémon en cours de fight en gardant les valeurs de santé.
> On ne fait pas du tout d'objet. »

## 1. Vue d'ensemble

- **Un combat = tout le duel** (pas de BO3) : moteur `persistent` qui déclare
  lui-même le vainqueur (pattern Curioscope pointsBased, `winLabel` dédié
  « Mets K.O. les 3 Pokémon adverses ! »).
- **3 Pokémon par équipe**, tirés/choisis parmi les 151 de la Gén. 1, niveau 50.
- **4 capacités par Pokémon** : 2 offensives (dégâts, type → STAB/faiblesses)
  + 2 de statut (boosts/altérations).
- **Tour par tour fidèle** : chaque équipe choisit son action (capacité ou
  switch), résolution par ordre de Vitesse ; switch = action du tour, PV
  conservés. Premier sans Pokémon valide = perdu.
- **Pas d'objets** (spec) ; pas de talents/natures/IV (hors Gén. 1 de toute
  façon) — le cœur Gén. 1 : stats, types, STAB, statuts, crits légers.

## 2. Mécanique de combat (fidèle Gén. 1, simplifiée où ça ne se voit pas)

- **Stats** : PV / Attaque / Défense / Spécial (Gén. 1 !) / Vitesse — bases
  PokéAPI au niveau 50, formule officielle `((2×base+31)×50/100)+5` (+PV ad hoc).
- **Dégâts** : formule officielle
  `(((2×50/5+2) × puissance × Att/Déf) / 50 + 2) × STAB(1,5) × table des types × aléa(0,85-1)`
  — attaques physiques/spéciales réparties PAR TYPE comme en Gén. 1
  (Normal/Combat/Vol/Sol/Roche/Insecte/Spectre/Poison = physique ; Feu/Eau/
  Plante/Élec/Psy/Glace/Dragon = spécial).
- **Table des types** : les 15 types Gén. 1, multiplicateurs 0 / ½ / 1 / 2
  (« C'est super efficace ! », « Ce n'est pas très efficace… », « Ça n'affecte
  pas… »).
- **Critiques** : 1/16, ×1,5 (simplifié — pas le calcul Vitesse Gén. 1).
- **Précision** : celle du move (Ex. Séisme 100, Lance-Flammes 100, Hydrocanon
  80…). Échec → « L'attaque échoue ! ».
- **Statuts v1** (les 3 classiques + boosts) :
  - **Paralysie** : Vitesse ÷ 4, 25 % de tour perdu ;
  - **Poison** : −1/8 PV max par tour ;
  - **Sommeil** : 1 à 3 tours sans agir (réveil annoncé) ;
  - **Boosts/malus de stats** : ±1 cran = ×1,5 / ÷1,5 (max ±2 crans v1) —
    Danse-Lames, Armure, Grondement, Mimi-Queue…
  - Un seul statut majeur à la fois (comme le vrai jeu). Hors v1 : gel,
    confusion, brûlure, vampigraine, moves à 2 tours.
- **KO** : à 0 PV, le Pokémon est K.O. → l'équipe envoie le suivant (choix si
  2 restants). Plus de Pokémon = défaite.

## 3. Sélection des équipes (phase « pick »)

Écran de draft AVANT le combat, un côté par équipe : chaque équipe reçoit
**6 propositions** tirées dans les MÊMES tranches de puissance (BST — total des
stats de base — apparié par paires : les 2 tirages du « slot fort » se valent,
etc.) et **en garde 3**. Pas de doublon entre les deux équipes. Legendaires
(Mewtwo/Mew/oiseaux) exclus du tirage. → équité sans priver du plaisir du choix.

## 4. Visuel (référence : Rouge Feu / Émeraude, assumé rétro)

- **Scène centrale** : arène avec deux plateformes, le Pokémon de chaque équipe
  face à face (sprites ANIMÉS Gén. 5 black-white de PokéAPI, le camp gauche
  en miroir), ciel dégradé, ombres portées.
- **Boîtes de PV** style GBA (crème, liseré) : nom FR, Nv. 50, barre de PV
  animée (vert → jaune → rouge), badge de statut (PAR/PSN/SOM), pastilles des
  crans de boost.
- **Commandes** : un panneau par équipe SOUS son côté — 4 capacités (carte
  colorée par type, PP non gérés, libellé FR) + bouton « Changer » (ouvre les
  2 remplaçants avec leurs PV) + 3 pokéballs d'état (pleine/K.O.).
- **Boîte de dialogue rétro** en bas, messages séquencés : « Dracaufeu utilise
  Lance-Flammes ! » → barre qui descend → « C'est super efficace ! » → cri.
- **Anims** : lunge du sprite attaquant, flash/shake du défenseur, VFX simple
  par type (flamme/éclair/goutte/feuille en CSS), barre PV qui glisse.
- **Sons** : cris officiels PokéAPI (`cries.latest`) à l'entrée et au K.O.,
  impacts synthé (sounds.js), petite fanfare de victoire.

## 5. Anti-triche / équité (écran partagé)

Choix simultanés : chaque équipe tape sa capacité — le bouton ne se surligne
PAS (le choix reste secret), le panneau affiche juste « Prêt ✓ ». Résolution
quand les deux ont validé. (Au téléphone plus tard : choix naturellement
cachés — hors v1.)

## 6. Données (pipeline extract→fichier)

`scripts/gen-pokemon-battle.mjs` → `src/data/pokemonBattle.json` (commité) :
- 151 Pokémon : id, nom FR/EN, types, stats de base, BST, sprites (front/back
  animés + fallback statique, URLs PokéAPI hotlinkées v1), URL du cri ;
- **moveset curé automatiquement** : 2 offensives (la meilleure STAB apprise
  + 1 couverture d'un autre type) + 2 statuts iconiques du learnset (priorité
  à une liste blanche : Danse-Lames, Grondement, Poudre Dodo, Cage-Éclair,
  Toxik, Armure, Affûtage…), noms FR, puissance/précision/type/effet ;
- généré une fois, retouchable à la main (fichier = vérité).

## 7. Intégration au jeu

- Entrée registre `pokemon: { engine: 'pkmn' }` — par cascade, le thème
  `pokemon` quitte la Jaquette mystère pour le vrai combat ;
  `pokemon_silhouette` GARDE son « Qui est ce Pokémon ?! ».
- `persistent: true`, victoire déclarée par le moteur ; récompenses/suite du
  duel inchangées (reward steal/knockback/loot).
- Surfaces : v1 écran partagé tactile ; en ligne/téléphone → duel éclair
  (comme les autres moteurs à écran), portage phone envisageable ensuite
  (choix secrets naturels).
- Durée cible : 3-5 min (si trop long en pratique : PV ×0,8 via balanceConfig).

## 8. Phases de réalisation

1. **P1 — Data** : script PokéAPI → pokemonBattle.json (151, movesets curés).
2. **P2 — Moteur pur** : `src/logic/pokemonBattle.js` — état du combat,
   résolution d'un tour (ordre, dégâts, statuts, KO, switch), AUCUN rendu →
   batterie de tests unitaires (table des types, formule, statuts).
3. **P3 — UI** : draft 3/6 + scène + commandes + dialogue + anims/sons.
4. **P4 — Intégration** : registre, victoire persistent, testeur Outils.
5. **P5 — Équilibrage & polish** : VFX par type, vitesse des séquences,
   tranches BST, PV scaling.

## 9. Décisions tranchées avec l'utilisateur (2026-07-19)

- Pick : draft 6 → 3 par tranches de puissance équitables. ✔ (« Draft 6 → 3 »)
- Rythme : PV ×0,8 pour viser 3-4 min. ✔ (« Rapide (PV réduits) »)
- Sprites : pixel animés Gén. 5 (rétro, cohérent avec la DA). ✔ (« Pixel animés »)
