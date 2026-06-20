# Quête des Matières — Contexte de conception (design · UX · équilibrage)

> **À quoi sert ce document.** C'est le brief de contexte à charger dans un projet Claude
> dédié à la **conception** du jeu : idées, game design, UX, équilibrage, pédagogie,
> contenu. **Ce n'est pas un doc technique** — il ne décrit pas le code, mais *ce qu'est
> le jeu, pour qui, comment il se joue, et comment on le règle*. Quand tu raisonnes sur
> une nouvelle feature, pars d'ici pour rester cohérent avec la vision et les contraintes.
>
> Docs frères (techniques, dans le repo) : `DESIGN_MODULES.md` (refonte taxonomie),
> `DESIGN_EXTENSIONS.md` (Maîtrise / Troc / Alchimie / Enchantement). Ce fichier en
> reprend la substance **côté design**, sans les détails d'implémentation.

---

## 1. Pitch en une phrase

**Un jeu de plateau d'aventure éducatif**, joué en classe sur écran tactile / TBI, où des
**équipes d'élèves** progressent sur un plateau en répondant à des **questions de cours** ;
elles gagnent de l'or, des objets et des pouvoirs, se défient en duel, et la première à
atteindre le royaume final gagne. Le quiz scolaire est habillé d'une **vraie couche de jeu**
(économie, loot, pouvoirs, événements) pour transformer la révision en aventure.

## 2. Vision & intention

- **Réviser sans en avoir l'air.** La question de cours est le moteur, mais l'élève vit une
  partie de jeu d'aventure, pas un contrôle. Le « gaming » doit être premier au ressenti.
- **Outil de classe, pas appli solo.** Conçu pour une séance animée par un·e prof sur un
  **grand écran tactile (TBI)** partagé, avec les élèves regroupés en équipes. Les téléphones
  des élèves sont des **compagnons** secondaires.
- **Spectacle & cérémonie.** Chaque action importante a son moment : lancer de dé en 3D,
  pluie de pièces, éclair de Foudre, révélation de loot. Le jeu doit être **lisible à
  distance** et **jubilatoire** (« juicy »).
- **Extensible à l'infini côté contenu.** L'ambition finale : un **immense pool de
  questions** qui dépasse le collège (lycée, mais aussi thèmes ludiques : jeux vidéo, sport,
  séries, culture…). Le moteur ne doit jamais coder une matière en dur.
- **Réglable par le prof, sans toucher au code.** Difficulté, objets actifs, événements,
  équilibrage, modules : tout se pilote via des **éditeurs in-game** et un **éditeur
  d'équilibrage**.

## 3. Public & contexte d'usage

- **Élèves de collège** d'abord (6e → 3e), extensible au lycée et au-delà.
- **Séance type** : une classe scindée en **2 à 6 équipes**, animée par le prof, sur un
  **TBI / écran tactile** en fond de classe ou au tableau. Durée variable (récréative ou
  fin de chapitre).
- **Matériel** : un grand écran tactile partagé (la « table de jeu »), éventuellement les
  **smartphones** des élèves comme compagnons (lecture de l'état, gestion de leur équipe,
  achats, troc).
- **Le prof est maître du jeu.** Il lance la partie, arbitre, peut intervenir (interface
  admin : donner/retirer or et objets, annuler un troc abusif). Côté « combat » contre le
  Boss, **c'est le prof qui joue le rôle de l'adversaire** sur le TBI.

## 4. Objectifs pédagogiques

- **Réviser activement** des connaissances de programme (toutes matières du collège).
- **Engagement & émulation** par le jeu d'équipe (coopération interne, compétition externe).
- **Suivi pédagogique** : un **dashboard d'analyse** agrège les réponses par matière/équipe
  (taux de réussite, questions ratées) pour que le prof identifie les lacunes. **Cette
  analyse n'est activée que pour les sessions 100 % scolaires** — un thème ludique présent
  désactive tout enregistrement (on ne pollue pas l'outil pédagogique).

---

## 5. La boucle de jeu (core loop)

```
Tour d'une équipe :
  1. Lancer le dé (cérémonie 3D)         → avance de N cases
  2. Choix de voie aux jonctions          (le plateau a des embranchements)
  3. Résolution de la case d'arrivée :
       • Case-matière → QUESTION de cours (timer) → bonne réponse = or (+ série, + loot ?)
                                                     mauvaise   = RECUL (atténuable)
       • Case spéciale → événement / boutique / coffre / piège / duel…
  4. (Option) utiliser un POUVOIR ou un OBJET (défensif avant, offensif sur une cible)
  5. Fin de tour → équipe suivante
But : atteindre en premier le ROYAUME FINAL (case d'arrivée).
```

**Tensions de design à garder** :
- Le **recul** sur mauvaise réponse est la principale source de risque/tension. Il doit
  faire mal sans être démoralisant → d'où le système de **bouclier** qui l'atténue.
- La **série** (bonnes réponses consécutives) récompense la régularité (+1 par tour réussi).
- Les **pouvoirs offensifs** (Foudre, Sablier, Double) créent l'interaction entre équipes :
  on ne joue pas que sa course, on gêne les autres.

---

## 6. Univers & direction artistique

- **Thème : aventure / parchemin médiéval-fantasy.** Palette or / encre / parchemin,
  polices « display » à empattement pour les titres. Ambiance « carte au trésor ».
- **Plateau = une carte de royaume** générée, avec décor procédural (assets intégrés :
  arbres, reliefs, bannières, fanions, rose des vents au départ). Les **voies** sont
  colorées par matière/thème ; en multi-thèmes, chaque case porte l'identité de SA
  catégorie (un plateau « Jeux vidéo + Sport » montre les deux, case par case).
- **Feedback visuel & sonore** très présent (cf. §8) : c'est une **signature** du jeu, pas
  un nice-to-have.

---

## 7. Les systèmes de jeu (vue design)

> Chaque système est décrit *par son intention de jeu*, pas par son code.

### 7.1 Le plateau
- Carte avec **voies parallèles**, **jonctions** (choix de chemin), sections successives,
  une **voie finale** et le royaume d'arrivée.
- **Granularité automatique** (refonte modules) : ≥ 2 thèmes cochés → une voie = un
  **thème** (la case tire une question d'un de ses sous-thèmes) ; 1 seul thème → une voie =
  un **sous-thème**. Plus de toggle manuel : le système choisit selon la sélection.
- Cases spéciales : boutique, coffre, événement, piège (posable sur n'importe quelle case),
  duel.

### 7.2 Questions & défis
- **Question de cours** : énoncé + 4 réponses mélangées à l'affichage, **timer**. C'est le
  cœur. Affichage volontairement **gros** (énoncé ~34px, réponses ~22px) pour la lisibilité
  TBI à distance.
- **Mini-jeux dédiés** (défis) : au-delà du QCM, des mini-jeux par matière (maths, français,
  géo via un « GeoGuessr » de capitales, « Mot le plus long »…). Vision : **un lot de
  mini-jeux dédiés par module/thème** (blind-test cinéma, screenshot jeux vidéo…). Gros
  chantier récurrent, étalé par module.
- **Niveaux / difficulté** : axe **optionnel par thème**. Scolaire → niveaux (6e…3e, Brevet
  en toggle additif) ; thème ludique → facile/moyen/difficile ou aucun.
- **Bilingue** : toute l'UI **et** les questions ont une version anglaise (toggle à
  l'accueil) — utile pour les sections langues et pour jouer « en immersion ».
- **Mode LV2 au choix** : si Allemand + Espagnol sont choisis, une filière « LV2 » unique
  où chaque équipe répond **dans sa langue** (choisie à la création d'équipe).

### 7.3 Pouvoirs (6 de base)
Chaque équipe choisit **un pouvoir défensif** et **un offensif** au setup. Ils se rechargent
(boutique, parfois loot) et montent en niveau.

| Pouvoir | Type | Effet de cœur |
|---|---|---|
| 🛡️ **Bouclier** | Défense | Réduit / annule le **recul** sur mauvaise réponse (sauf Foudre au niveau de base). |
| 💡 **Indice** | Défense | Élimine des mauvaises réponses + bonus de temps. |
| 🎲 **Relance** | Défense | Relance le dé (remplace / garde le meilleur / somme selon niveau). |
| ⚡ **Foudre** | Attaque | **Recule** une équipe cible (dé de recul 1D4→1D10…). |
| ⏱️ **Sablier** | Attaque | **Réduit le timer** de la cible (diviseur croissant). |
| ❓ **Double** | Attaque | Impose des **questions en plus** à la cible (mécanique additive cumulable, plafond ~5). |

- **Extension « Maîtrise »** (design figé) : les pouvoirs montent de **1 à 10** ; aux
  **niveaux 5 et 10**, choix gratuit et définitif parmi **3 spécialisations** (un
  embranchement qui change la *nature* du pouvoir, ex. Bouclier → « Rempart doré » qui
  rapporte de l'or, ou ultime « Forteresse » qui annule tout recul). Présenté côté élève
  comme un **arbre de talents** sur mobile. Voir `DESIGN_EXTENSIONS.md` §A pour les 36 voies.

### 7.4 Combat / Duel
- **Duel équipe ↔ équipe** : l'équipe qui arrive sur une équipe peut la **défier** (ou jouer
  la case normalement) — option « choix » par défaut, « forcé » activable. Duels départagés
  par la réponse (en français, égalité tranchée à la **vitesse de validation**).
- **Immunité de duel** (objet/buff) : une équipe peut se rendre non-défiables.
- **Boss « le Prof »** (événement) : combat contre un adversaire virtuel que **le prof
  incarne sur le TBI** — gros gain si victoire, recul si défaite.

### 7.5 Économie & boutique
- **Or** = monnaie unique (bonnes réponses, événements, loot, ventes).
- **Boutique** en 2 onglets : **Objets** (consommables / équipements, vitrine de 8 + 8) et
  **Pouvoirs** (recharger / améliorer / débloquer). La vitrine se **renouvelle à l'achat**
  (pas de rotation au temps). **Marché Noir** : variante « boutique louche » événementielle.
- **Prompt contextuel** « Visiter la boutique ? » après quelques tours sans achat, avec
  snooze — pour réduire la friction sans harceler.

### 7.6 Inventaire & équipement
- **3 slots d'équipement** (Coiffe / Armure / Amulette) + un **sac** de consommables.
- **Catalogue d'objets** : ~130 objets faits main (mécaniques : bouclier, +or, dés, loot,
  pièges, sets…) + un large pool de **potions générées** (alchimie). Objets **thème-
  agnostiques** par défaut ; champ `themes[]` pour les objets « de saveur » liés à un thème.
- **Sets d'objets** : bonus à 2/3 pièces. **Consommables empilables** (sac hybride, pile
  plafonnée). **Buffs temporisés** (X tours, compteur affiché).
- **Sources de loot** : coffres, marchands, pillage, butin de combat, petite chance de loot
  sur bonne réponse.
- **Coffre de départ paramétrable** au setup (or fixe/aléatoire, N objets proposés / gardés,
  conso/équip).

### 7.7 Événements
- Cases-événements scriptées : trois coffres, pickpocket, bénédiction/malédiction, boussole,
  tempête, loterie, sphinx (question forcée), **Va-tout** (pari croissant), **Boss : le
  Prof**, roulette d'événement… Pilotés par un **moteur d'effets composable** (actions du
  moteur) et **éditables** par le prof (éditeur d'événements).

### 7.8 Extensions activables (au setup)
Le jeu a un **système de modules activables** — on coche au setup ce qu'on veut.
- **Objets & équipement** (socle de l'inventaire).
- **Maîtrise des pouvoirs** (arbre 1→10, cf. 7.3).
- **Troc** : échanges **équipe ↔ équipe** (or + sac + équipement porté) initiés depuis les
  téléphones (proposer / accepter / refuser), application automatique, droit de regard du
  prof. Don / vente / échange. **Réservé au propriétaire de l'équipe** (faille corrigée).
- **Alchimie** : ingrédients + **recettes** (3 ingrédients → potion), atelier + grimoire sur
  mobile, effets « ??? » tant que non découverts (20 ingrédients, ~1140 potions générées).
- **Enchantement** : parchemins qui ajoutent un effet à une **pièce d'équipement précise**
  (l'enchantement **suit l'objet** s'il est déséquipé, troqué, vendu).

### 7.9 Compagnon mobile
- App élève **lecture seule** au départ (voir l'état, ses objets), puis **interactive** :
  création d'équipe en lobby (nom, logo, pouvoirs via QR), gestion d'équipement, **achats**,
  **troc**, **alchimie**, choix de voie de pouvoir. Tout passe par des **intents** : le
  **mobile propose, le TBI dispose** (le TBI reste la seule source de vérité des règles).
- **Interface admin** cachée (triple-tap + code) : le prof contrôle tout depuis un téléphone.

---

## 8. UX — principes directeurs

> Ces principes sont des **règles de décision** quand on conçoit un écran ou une interaction.

1. **Lisible à distance, sur grand écran tactile.** Gros textes, gros boutons, contrastes
   forts. Si un élève au fond de la classe ne peut pas lire → c'est un bug d'UX.
2. **Tactile d'abord.** Cibles tactiles larges (boutons HUD ~238px), pas de hover requis,
   container queries pour s'adapter. Le TBI peut être imprécis : pardonner les gros doigts.
3. **Réduire les clics.** On traque la friction (« trop de cliques ») : consommables
   activables directement sur la carte active, accès éditeur, prompts contextuels. Objectif
   récurrent : passer une action de 3 → 2 taps.
4. **Cérémonie & feedback (« juicy »).** Chaque moment fort a son animation + son :
   - Dé 3D (perspective, faces), pluie de pièces volantes, particules.
   - Sons Web Audio (dé, pièces, tonnerre, bouclier, charge, katana…).
   - VFX dédiés (éclair de Foudre ciblé, flash de Bouclier, révélation de loot centrée).
   - **« Aucun effet »** est aussi un feedback : ne jamais laisser une action muette.
5. **Toujours dire ce qui se passe.** Journal de partie **dépliable** : chaque gain/recul
   détaille sa composition (base + série + équipement, bouclier appliqué, effets du moteur).
   Descriptions d'objets en **mode simple** par défaut, **détail expert** repliable.
6. **Le mobile propose, le TBI dispose.** Aucune règle ne vit côté téléphone ; cohérence et
   anti-triche garantis par le TBI. Verrous quand une équipe est « en résolution ».
7. **Setup progressif.** Accueil = « L'essentiel » visible (classe, langue, lancer), le
   reste en **accordéons repliés** à résumé, outils derrière un overlay ⚙. Ne pas noyer le
   prof sous les options.
8. **Accessibilité des modales** : focus, fermeture clavier, chrome cohérent (pattern temple).

---

## 9. Équilibrage — philosophie & repères

> **Tout chiffre est calibrable** via `balanceConfig` (overrides persistés) et l'**éditeur
> d'équilibrage** in-game (onglets Objets / Pouvoirs / Loot). On commet des valeurs de
> départ, on règle ensuite **sans toucher au code**. Quand tu proposes une valeur, donne un
> point de départ ET la fourchette à tester.

### Principes
- **Risque/récompense net** : avancer vite = répondre juste ; se tromper = reculer. Le
  recul doit être *ressenti* mais *récupérable* (sinon découragement).
- **Pas de stratégie strictement dominante.** Chaque pouvoir/voie/objet doit avoir un
  contre ou un coût. Les voies de la Maîtrise incluent volontairement des **risque/
  récompense** (ex. Foudre « Surcharge » : +50 % recul mais +1 charge).
- **Échelle = lisibilité.** Les valeurs « à l'échelle » (série, précision) sont prévisual-
  isées dans l'éditeur (« série 3 → 15 % ») pour qu'on voie l'effet réel avant de jouer.
- **Catch-up doux.** Les pouvoirs offensifs « toutes équipes » (ultimes Cataclysme,
  Tempête de sable) peuvent rééquilibrer une partie — à surveiller à 3+ équipes (risque de
  trop punir le leader OU de créer du chaos).

### Repères actuels (points de départ, pas gravés)
- **Recul mauvaise réponse** = valeur du dé lancé (`preRollValue`) — punition proportionnée
  à l'élan.
- **Bouclier** retire **2 / 4 / 6** cases de recul selon le niveau (annulation totale =
  haut niveau / extension). Protège partout **sauf la Foudre** (au niveau de base).
- **Foudre** : dé de recul **1D4 / 1D6 / 1D10** selon niveau (→ 1D12 + bonus en Maîtrise).
- **Série** : +1 par tour entièrement réussi ; alimente les gains à l'échelle.
- **Boutique** : 8 consommables + 8 équipements en vitrine, renouvelés à l'achat.
- **Maîtrise — courbe de coûts** (départ, à calibrer) : 20/30/45/65/90/120/155/195/240 or
  par palier (**960 or** pour monter un pouvoir 1→10).
- **Victoire GeoGuessr** : seuil de score ramené à **10 000** (depuis 25 000).

### Points d'équilibrage ouverts
1. Courbe de coûts Maîtrise : trop chère / pas assez ?
2. Aucune voie L5/L10 strictement dominante à vérifier en test.
3. Ultimes « toutes les équipes » trop forts à 3+ équipes ?
4. Taux de loot sur bonne réponse (~10 %) : bon dosage de surprise vs inflation d'objets ?
5. Fréquence/violence des événements punitifs (pickpocket, malédiction, tempête).

---

## 10. Contenu & pédagogie

- **Source de vérité = base de données** (Supabase) : ~900+ questions et plus, éditables
  in-game (éditeur bilingue). Convention : champ `correcte` **1-indexé**, réponses
  **mélangées à l'affichage**.
- **Génération de contenu = IA + revue humaine.** Workflow multi-agents (un rédacteur + un
  vérificateur par matière, conformité programme/BO/sources) → écriture en base → **contre-
  vérification humaine** dans l'éditeur. Exemple : la 6e est passée de 114 à 252 questions.
- **Garde-fous contenu** : conformité au programme, sources, anti-doublon, vérif factuelle,
  réponses plausibles (les distracteurs ne doivent pas être trop courts → biais détecté et
  corrigé).
- **Taxonomie cible (refonte « modules de thèmes »)** : 2 niveaux **Thème → Sous-thème**.
  Le collège devient « un thème parmi d'autres » (sous-thèmes = Maths, Français, SVT…). On
  vise des thèmes **non scolaires** (jeux vidéo, sport, séries, culture, métiers…) mixables
  sur un même plateau. Voir `DESIGN_MODULES.md`.

---

## 11. Données & analyse pédagogique

- **Instrumentation** : on enregistre réponses / usages d'objets / usages de pouvoirs par
  session.
- **Dashboard `?analyse`** : agrège par matière/équipe (taux de réussite, questions ratées),
  export CSV / impression, étiquette « classe / séance ».
- **Règle de respect** : analyse **uniquement** pour les sessions **100 % scolaires**. Dès
  qu'un thème ludique est présent, **aucun enregistrement** (l'outil pédagogique ne doit
  refléter que du scolaire).

---

## 12. État du projet & priorités

> Le code est mûr et largement livré ; les chantiers restants sont surtout **contenu**,
> **équilibrage** et **modules de thèmes**.

**Livré / solide** : plateau procédural, 6 pouvoirs + UX/feedback, combat & duels, économie
& boutique à onglets, inventaire/équipement (sets, buffs, stacking), événements scriptés +
éditeur, extensions Objets / Maîtrise / Troc / Alchimie / Enchantement, compagnon mobile
(lobby, achats, troc, admin), éditeurs in-game (questions, objets, équilibrage, événements,
arbre de pouvoirs), i18n FR/EN complète (UI + questions), dashboard d'analyse, mode hors
ligne + appli Tauri.

**En cours / à venir** :
- **Refonte « modules de thèmes »** (taxonomie dynamique, le gros chantier de fond — phases
  moteur → mode mono-thème → éditeur → mini-jeux par module → contenu de masse).
- **Mini-jeux dédiés par module** (effort récurrent, à étaler).
- **Contenu de masse** par thème (workflow IA + revue).
- **Équilibrage continu** (courbes Maîtrise, loot, événements).
- Polish : objets de saveur par thème, biomes/décor sur-mesure par thème.

---

## 13. Décisions de design actées (journal court)

À respecter pour rester cohérent (ne pas re-litiger sans raison) :

- **Taxonomie à 2 niveaux** (thème / sous-thème), granularité plateau **automatique** selon
  le nombre de thèmes.
- **Un seul catalogue d'objets** taggé par `themes[]` (pas de catalogues séparés par thème,
  qui exploseraient l'équilibrage).
- **Difficulté = axe optionnel par thème** (pas supprimée, pas imposée).
- **Analyse = scolaire only.**
- **Maîtrise** : montée chiffrée auto, embranchements **gratuits et définitifs** aux L5/L10.
- **Troc** : échangeable = sac + or + équipement porté (pas les charges de pouvoir) ;
  **réservé au propriétaire** ; application auto, droit de regard prof.
- **Alchimie** : recettes **fixes** à découvrir ; grimoire par équipe ; ingrédient seul =
  effet mineur + révélation.
- **Enchantement** : lié à la **pièce précise**, suit l'objet (objets en instances).
- **Le mobile propose, le TBI dispose** (aucune règle côté mobile).
- **Pas d'édition d'équipement « pour une autre équipe »** depuis le mode tableau (anti-
  triche).

---

## 14. Questions ouvertes / pistes (terrain de brainstorm)

- Mini-jeux par thème : lesquels prioriser ? Quel **contrat de mini-jeu** garde la tension
  juste (timer, points, départage) ?
- Thèmes ludiques en **cases de plateau** ou seulement en « questions forcées » ?
- **Marché ouvert** (troc public, premier qui accepte rafle) : utile en classe ou trop
  chaotique ?
- Catch-up : faut-il un mécanisme explicite pour l'équipe distancée, ou les pouvoirs
  offensifs suffisent ?
- Onboarding du prof : comment expliquer toutes les extensions sans surcharge ?
- Durée de partie : leviers pour viser une séance courte vs longue (taille de plateau,
  seuils) ?
- Récompenses de fin / « haut-faits » : valoriser autre chose que la 1re place ?

---

## 15. Glossaire produit

- **TBI** : Tableau Blanc Interactif / grand écran tactile partagé = la « table de jeu ».
- **Équipe** : groupe d'élèves qui joue un pion ; a or, objets, équipement, pouvoirs, série.
- **Voie / filière / catégorie** : ce qui remplit une case du plateau et déclenche un défi
  (une matière ou un sous-thème).
- **Thème / sous-thème** : niveau haut (Collège, Jeux vidéo…) / niveau bas (Maths, RPG…).
- **Recul** : pénalité de cases en arrière sur mauvaise réponse (ou Foudre / duel / event).
- **Série (streak)** : bonnes réponses consécutives, +1 par tour réussi, alimente les gains.
- **Charge** : « munition » d'un pouvoir (rechargeable en boutique / loot).
- **Spécialisation (spec5/spec10)** : branche choisie d'un pouvoir en extension Maîtrise.
- **Intent** : action proposée par un mobile, appliquée par le TBI (jamais l'inverse).
- **Module / extension** : bloc de règles activable au setup (Objets, Maîtrise, Troc…).
- **balanceConfig / éditeur d'équilibrage** : surcouche de valeurs réglables sans code.
- **Session scolaire** : partie 100 % thèmes scolaires → seule à alimenter l'analyse.

---

*Document de contexte design. Pour l'implémentation, voir le repo et les docs techniques
(`DESIGN_MODULES.md`, `DESIGN_EXTENSIONS.md`). Mets ce fichier à jour quand une décision de
design change.*
