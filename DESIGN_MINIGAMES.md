# Mini-jeux de duel — moteurs génériques, contenu par thème, cascade de repli

> Doc de référence du système de mini-jeux. À lire avant d'ajouter un moteur, un
> contenu de thème, ou un mini-jeu ultra-custom. Complémente `DESIGN_CURIOSCOPE.md`
> (moteur guessr) et `DESIGN_ONLINE.md` (contraintes multi-surface / anti-triche).

## 1. Vision

Un duel (case adverse, boss, événement) déclenche un mini-jeu. Trois étages :

1. **Mini-jeu ultra-custom du thème** — ex. thème « Pokémon » → un vrai combat
   Pokémon. Construit à la main, un par un, quand on a le temps.
2. **Mini-jeu de la catégorie** — ex. « Jeux vidéo » → un duel générique-mais-thématisé
   (moteur réutilisable + contenu jeux vidéo).
3. **Duel générique** (`QuickDuel`, course de rapidité) — le filet de sécurité,
   toujours jouable.

**Règle d'or : la cascade se met en place toute seule.** On n'écrit jamais de
code de routage pour un nouveau thème : tant que « Pokémon » n'a pas de mini-jeu,
le duel remonte l'arbre de thèmes (`quete_themes`, ltree) et prend le premier
mini-jeu **jouable** rencontré chez ses ancêtres ; à défaut, le générique.
Le jour où le mini-jeu Pokémon existe, il prend la place, sans rien débrancher.

Corollaires :
- Ajouter un thème = ajouter du **contenu** (et une entrée de registre), pas du code.
- Un mini-jeu « existe » seulement s'il est **jouable maintenant** (contenu chargé,
  spots en DB…). Une entrée au registre sans contenu ne bloque pas la cascade.
- Une amélioration d'un **moteur** profite d'un coup à tous les thèmes qui l'utilisent.

## 2. Architecture (état actuel)

Tout vit dans `src/components/Fight/minigames/index.js` :

- **`ENGINES`** — moteurs theme-agnostiques. Un moteur = un composant React
  + des capacités techniques (`persistent`, `pointsBased`).

  | Moteur | Composant | Principe | Forme du `content` |
  |---|---|---|---|
  | `bubble` | BubbleHunt | bulles qui apparaissent, touche la bonne catégorie | `[{ id, prompt, prompt_en?, good[], bad[] }]` |
  | `timeline` | TimelineGame | ordonne des éléments par valeur (année…) | `[{ name, year }]` |
  | `memory` | MemoryGame | paires sur plateau partagé tour-par-tour | `[{ a, b, id? }]` |
  | `maths` | CompteEstBon | compte est bon | — (auto-suffisant) |
  | `french` | MotLePlusLong | mot le plus long, égalité = vitesse | — |
  | `curioscope` | Curioscope | guessr multi-univers (monde réel, Azeroth…) | `{ universes: ['monde_reel', …] }` |
  | `deblur` | DeblurGame | photo mystère : image floue qui se révèle, 1ᵉʳ sur la bonne réponse. Destination cible : affiches de films / jaquettes JV (statique) | `{ fromQuestions: '<subjectKey>' }` (questions à image du pool) OU `[{ img, answer, decoys[], prompt? }]` |
  | `imgrace` | DeblurGame (`props.sharp`) | course d'images NETTES : l'image s'affiche directement, 1ᵉʳ sur la bonne réponse (Drapeau éclair) | même contrat que `deblur` |
  | `silhouette` | WhosThatPokemon | « Qui est ce Pokémon ?! » : plateau TV (rayons rouges, explosion étoilée, silhouette noire, jingle), révélation en couleur | même contrat que `deblur` |
  | *(défaut)* | QuickDuel | course de rapidité (pas dans ENGINES, c'est le filet) | — |

  Un moteur peut porter des `props` supplémentaires (`ENGINES[x].props`,
  transmises au composant par MinigameStage) — c'est ainsi qu'`imgrace`
  réutilise DeblurGame avec `sharp: true`.

- **`THEME_MINIGAMES`** — clé de thème → `{ engine, content, name, rules, howto,
  winLabel? }`. Les libellés sont des clés i18n `fight.mg.*`
  (`src/i18n/dicts/fight.js`), résolues par `tg()` à l'affichage
  (FightBriefing / FightModal / testeur).

- **`getMinigame(subject)`** — résolution **en cascade** (cf. §3). Fusionne moteur
  (technique) + thème (contenu + libellés). Repli final : `DEFAULT_MINIGAME` (QuickDuel).

- **`curioUniverses(subject)`** — même cascade, mais ne répond que si le mini-jeu
  résolu est un Curioscope jouable (univers avec spots). Utilisé par
  `fightBegin` (store) pour router les surfaces téléphone / en ligne vers le duel
  guessr piloté par le store (`curioFightHandlers.js`).

- **Contenu** : `src/data/fightData.js` (fichiers d'abord ; format pensé pour
  migrer en DB + éditeur, cf. §8). Spots Curioscope : DB (`quete_spots`) via
  `src/data/universes.js`.

### D'où vient `subject` ?

`fight.subject` = la voie du plateau où le duel se déclenche
(`gameStore` ~l.1353 : `node.subject`, ou `randomBoardSubject()` si case multi).
Avec le système de cassettes (`buildPerimeter`), une voie est :
- une **feuille pure** → `subjectKey` (= `quete_questions.subject`) ;
- un **nœud large** (intégrale/domaine) → `themeKey`.

La cascade accepte les deux (elle cherche par clé de thème ET par subjectKey).

## 3. La cascade de repli (le cœur du système)

`getMinigame(subject)` essaie, dans l'ordre, jusqu'à trouver une entrée **jouable** :

1. `THEME_MINIGAMES[subject]` — lookup direct (couvre les clés plates legacy :
   `anglais`, `histoire`… même si l'arbre `THEMES` n'est pas chargé / hors ligne).
2. Le nœud de thème correspondant (par `key` ou par `subjectKey`), puis **chaque
   ancêtre** en remontant `parentKey` jusqu'à la racine — à chaque étage on teste
   la clé du nœud puis son `subjectKey` (nœuds mixtes).
3. `DEFAULT_MINIGAME` (QuickDuel).

**Jouabilité** (`isPlayable`) — une entrée non jouable est **sautée** (la cascade
continue vers l'ancêtre, elle ne tombe PAS directement sur le générique) :
- `curioscope` : au moins un univers avec des spots chargés (DB vide / hors ligne
  sans cache → pas jouable) ;
- `deblur` en mode `fromQuestions` : au moins une question à image dans le pool ;
- moteurs à `content` tableau : contenu non vide ;
- moteurs auto-suffisants (`maths`, `french`) : toujours jouables.

Exemple cible (quand les thèmes existeront en base) :

```
duel sur « pokemon »
  → THEME_MINIGAMES['pokemon'] ?         non (pas encore construit)
  → parent « jeuxvideo » ?               oui, bubble « clique les RPG » → joué
     (le jour où le duel Pokémon custom existe, il gagne l'étage 1)
```

Cas réel déjà couvert : `world_of_warcraft` sans spots en DB → si le nœud WoW est
fils d'un thème « jeux vidéo » câblé, on joue le mini-jeu jeux vidéo ; sinon QuickDuel.

**Conventions de clés** : une entrée de `THEME_MINIGAMES` doit être indexée par la
clé du nœud `quete_themes` (`key`) **ou** par son `subject_key` — les clés EXACTES
de la base, pas des variantes (leçon : les clés démo `films`/`jeuxvideo` ne
matchaient aucun thème réel, renommées en `cinema`/`jeux_video` le 2026-07-19).
Si les deux existent, la clé de nœud est testée d'abord. L'inventaire complet
thèmes ↔ mini-jeux vit dans **`MINIJEUX_PAR_THEME.md`** (feuille de route
éditée par le prof).

## 4. Contrat d'un moteur

Chaque moteur reçoit `{ attacker, defender, subject, round, onRoundWin, content }`
et appelle `onRoundWin('attacker'|'defender')` à chaque manche gagnée (BO3,
`FIGHT_ROUNDS_TO_WIN = 2`). Flags :
- `persistent: true` → le composant n'est pas remonté entre les manches
  (il gère la continuité, ex. frise Timeline, manches Curioscope) ;
- `pointsBased: true` → score cumulé plutôt que manches sèches (Curioscope).

**Anti-triche (obligatoire pour tout nouveau moteur à 2 côtés sur écran partagé)** :
les deux côtés ne doivent pas pouvoir se copier. Patterns validés :
- 2 plannings indépendants mais équitables (mêmes instants/positions, même nombre
  de bonnes — `bubbleSchedule.js`) ;
- plateau partagé tour-par-tour (Memory) ;
- secret côté hôte, strippé du payload avant diffusion (Curioscope : position
  cible ; duel éclair : bonne réponse — cf. `sessionConfig.buildTurnPayload`).

## 5. Multi-surface (qui joue où)

Raisonner **par surface**, pas « TBI » (cf. mémoire projet). Routage dans
`fightBegin` (`src/store/fightHandlers.js:130`) :

| Surface | Duel joué |
|---|---|
| Écran partagé tactile | Mini-jeu composant plein écran (FightModal) — tous moteurs |
| TV + téléphones (`phoneController`) | Curioscope piloté store si jouable ; sinon mini-jeu sur l'écran partagé |
| En ligne (`connectionMode==='online'`) | Curioscope piloté store si jouable ; sinon **duel éclair** (course à la question sur chaque appareil) |
| Solo bots / Boss | Duel éclair (un bot/boss ne touche pas l'écran) |

Aujourd'hui seul Curioscope a une déclinaison « pilotée par le store » jouable à
distance. **Cible** : chaque moteur déclare ses surfaces supportées, et la cascade
devient par-surface — sur une surface donnée, on prend le premier ancêtre dont le
mini-jeu est jouable *sur cette surface*, sinon le repli de la surface (mini-jeu
sur écran partagé, ou duel éclair en ligne). À faire au moment de porter un 2ᵉ
moteur sur téléphone (candidats faciles : QuickDuel-course déjà fait, Memory
tour-par-tour).

## 6. Recettes — comment ajouter…

### a) Un contenu de thème sur un moteur existant (le cas courant, ~15 min)
1. Contenu dans `src/data/fightData.js` (forme selon moteur, cf. tableau §2).
2. Entrée dans `THEME_MINIGAMES` : `{ engine, content, name, rules, howto }`.
3. Libellés `fight.mg.<clé>.*` dans `src/i18n/dicts/fight.js` (FR + EN).
4. Le testeur Outils (§7) le liste automatiquement (`MINIGAME_THEMES`).

### b) Un nouveau moteur générique (Deblur, chasse-au-mot variante…)
1. Composant dans `src/components/Fight/minigames/`, respectant le contrat §4
   (props, `onRoundWin`, anti-triche).
2. Entrée `ENGINES` (+ `persistent`/`pointsBased` si besoin).
3. Démo animée dans `FightBriefing` (`howto.demo`).
4. Si le contenu a une forme nouvelle : la documenter dans le tableau §2 et dans
   le commentaire d'en-tête de `index.js`.
5. Règle de jouabilité dans `isPlayable` si le moteur dépend de données externes.

### c) Un mini-jeu ULTRA-CUSTOM de thème (combat Pokémon…)
Même mécanique que (b) : c'est un moteur qui n'a qu'un seul thème client, ou dont
le « contenu » est riche (stats, sprites…). Il s'enregistre dans `ENGINES` +
une entrée `THEME_MINIGAMES['pokemon']`. Rien d'autre : la cascade fait le reste.
Tant qu'il n'est pas jouable (assets absents), l'entrée est sautée → étage catégorie.

## 7. Testeur de mini-jeux (panneau Outils, dispo en prod)

`SelectionCassettes.jsx` (§ testeur) + `gameStore.devStartFight(subject,
forceDefault, surface)` : liste tous les thèmes câblés + le duel générique,
choix de surface (tactile / TV+tél via QR / en ligne), sandbox 2 équipes,
restauration des réglages au ✕. C'est l'outil pour valider tout nouveau moteur
sur chaque surface avant de le brancher.

## 8. Backlog / roadmap

- ~~Moteur Deblur~~ **LIVRÉ** : `DeblurGame.jsx`, flou → net en 18 s, verrouillage
  sur erreur, jauge de netteté. 1ᵉʳ thème : `drapeaux_symboles` (« Drapeau
  mystère ») via `fromQuestions` (zéro contenu dédié — les questions à image de
  la DB servent de contenu, piochées par `fightPickImageQuestion`,
  anti-répétition namespace `img:`). **Destination cible : affiches de films /
  jaquettes de jeux vidéo en contenu statique — brancher `films`/`jeuxvideo`
  dessus quand les images seront fournies.**
- ~~« Qui est ce Pokémon ?! »~~ **LIVRÉ** : moteur `silhouette` dédié
  (`WhosThatPokemon.jsx`), plateau TV de l'anime (rayons, explosion étoilée,
  silhouette noire, jingle original) sur les questions à image
  `pokemon_silhouette`. PAS le Deblur : le charme, c'est la silhouette franche.
- **Duel « jeux vidéo » dédié** (étage 2 de la cascade Pokémon) puis **combat
  Pokémon ultra-custom** (étage 1 — le WTP silhouette reste le mini-jeu de la
  cassette silhouette, le combat sera celui du thème pokemon parent).
- **Cascade par-surface** (§5) : `surfaces` déclarées par moteur ; porter Memory
  (tour-par-tour = naturel au téléphone) puis les autres.
- **Contenu en DB + éditeur** (comme `quete_questions`) : table de contenu de
  mini-jeux, l'entrée de registre ne garde que `engine` + clés i18n ; jouabilité
  = contenu présent en DB. Prépare la curation par le prof.
- **Passes visuelles transverses** : un lifting d'un moteur (BubbleHunt, Timeline…)
  bénéficie à tous ses thèmes — préférer ça aux customisations par thème.
- Mini-jeux matières restants (maths/français/SVT/géo ont un moteur ; physique,
  musique… à contenu-iser sur bubble/timeline/memory).

## 9. Invariants à ne pas casser (tests)

- `minigames.test.js` : chaque thème câblé résout composant + libellés ; cascade
  enfant → catégorie → générique ; entrée non jouable sautée ; équité des 2
  plannings BubbleHunt.
- `curioscope.test.js` : WoW sans spots → repli ; monde réel intact.
- `devFightSurface.test.js` : le testeur force correctement chaque surface.
