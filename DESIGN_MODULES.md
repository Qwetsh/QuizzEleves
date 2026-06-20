# Design — Système de modules de questions (taxonomie dynamique)

> **Statut : PRÉPARATION (pas d'implémentation).** Document de cadrage technique.
> Le moteur de jeu (plateau, combat, pouvoirs, économie) ne change pas ; on touche
> à *ce qui remplit une case/voie*, *quel défi se lance*, et — ajout du 20/06 —
> *quels objets sont disponibles selon les thèmes* (voir §0 et §14).

---

## 0. Modèle affiné — 2026-06-20 (FAIT FOI)

> Session de cadrage avec l'utilisateur. **En cas de divergence avec les sections
> rédigées le 18/06, CETTE section prime.** Le reste du doc reste valable pour le
> détail technique (tables, registre, migration, éditeurs, contenu, roadmap).

**Taxonomie ramenée à 2 niveaux :**
```
THÈME        (Collège · Jeux vidéo · Sport · Séries · Warhammer · Menuiserie …)
  └─ SOUS-THÈME   (Collège → Maths/Français/SVT …  ·  Jeux vidéo → RPG/Simulation/Indé …)
```
On abandonne les 4 niveaux du 18/06 (module/matière/sous-matière/thème). Correspondance :
l'ancien **« module » = le THÈME** ; l'ancienne **« matière/filière » = le SOUS-THÈME**.
Les matières du collège deviennent les sous-thèmes d'**un** thème « Collège » — l'école
n'est plus un cas spécial, juste le premier thème.

**Granularité de plateau AUTOMATIQUE (remplace le toggle mono/multi du §7) :**
- **≥ 2 thèmes cochés** → 1 voie = 1 **THÈME**. Tomber sur « Jeux vidéo » tire une
  question d'**un sous-thème JV au hasard**. *Pas de mixage fin* : en multi, ce sont
  des thèmes entiers (on n'injecte pas un sous-thème isolé).
- **1 seul thème coché** → 1 voie = 1 **SOUS-THÈME** ; chaque voie tire dans son sous-thème.

→ Une « voie/case » = une **catégorie jouable** `{ key, label, color, icon, pool:[sousThèmes] }`.
Multi : `pool` = tous les sous-thèmes du thème. Mono : `pool` = [un sous-thème].
**C'est `resolveSubjectFor` (déjà utilisé par le mode LV2) généralisé** — LV2 est le
prototype d'une catégorie qui pioche parmi plusieurs options. On généralise ce résolveur
au lieu d'en inventer un.

**Difficulté = axe OPTIONNEL par thème (décision ouverte §12.3 TRANCHÉE) :**
on ne ferme pas la porte. Un thème *peut* déclarer un axe de difficulté
(Collège/Lycée → niveaux scolaires ; autres → facile/moyen/difficile, ou aucun).
La colonne `level` devient un **filtre optionnel défini par le thème** (pas supprimée).

**Visuel : générique d'abord, mixage par case.** Phase 1 = rendu **générique**
(disque coloré + emoji/icône du sous-thème) ; assets dédiés ajoutés au fil de l'eau.
Le **mixage marche nativement** : chaque case étant stylée par SA catégorie, un plateau
Jeux vidéo + Sport montre les deux thèmes case par case. Terrain global neutre ; biomes
et décor sur-mesure (qui « se fondent ») plus tard, thème par thème.

**Contenu = IA + revue humaine.** Questions générées par workflow multi-agents (cf. §9),
écrites en base, puis **contre-vérification/correction humaine** dans l'éditeur.

**Objets = UN pool + tags de thème, affinité généralisée (nouveau chantier, voir §14).**

---

## 1. Objectif

Transformer le contenu figé (6 matières scolaires) en un **système de modules**
extensible : collège, lycée, mais aussi modules thématiques (cinéma, jeux vidéo,
culture historique, art, musique…). Chaque module apporte sa taxonomie et ses
défis. Objectif final : un **immense pool** de questions variées, sélectionnables
finement.

### Taxonomie cible
```
MODULE              (Collège · Lycée · Cinéma · Jeux vidéo · Art · Musique …)
  └─ MATIÈRE         (Histoire · Maths …  /  Réalisateurs · Sagas …)
       └─ SOUS-MATIÈRE   (Histoire → Antiquité · Moyen Âge …)
            └─ THÈME       (« Rome », « Les Capétiens » …) ← devient une VOIE du plateau
```

### Décisions validées (2026-06-18)
- **Modes de plateau : les deux, au choix au Setup.**
  - *Multi-matières* (actuel) : chaque voie = une matière.
  - *Mono-matière* : on choisit UNE matière → ses **sous-matières/thèmes** = les voies.
- **Défis : mini-jeux DÉDIÉS par module** (pas seulement un défi générique).
- Le côté « gaming » reste identique.

---

## 2. État des lieux (ce qui est déjà dynamique vs figé)

### Déjà dynamique ✓
- **Contenu** : table Supabase `quete_questions` — champs libres `subject`,
  `level`, `t` (thème), `pool`. Ajouter du contenu est trivial.
- **Filtrage par niveau** : logique générique (`filterByLevel`, tableau de niveaux).
- **Tirage par catégorie** : `fightPickQuestion(subject)` pioche dans
  `questions[subject]` (`gameStore.js:1358`).
- **Plateau** : l'algorithme accepte déjà N catégories (il *shuffle* une liste).

### Figé en dur ❌ (à généraliser)
| Couplage | Fichier(s) | Note |
|---|---|---|
| Énumération des matières | `src/data/subjects.js` (`SUBJECTS`, `SUBJECT_KEYS`, `FORCED_SUBJECT_KEYS`) | source de vérité en dur |
| Plateau ← matières | `src/logic/boardGenerator.js:57` (`shuffleArray(SUBJECT_KEYS)`) | une voie = une matière |
| Tirage question | `src/store/gameStore.js:452` (`getQuestions`) + `:1358` (`fightPickQuestion`) | pool figé au démarrage |
| Niveaux | `src/components/Setup/LevelSelect.jsx:4-10`, `src/data/questions/index.js:28-36` | 6e/5e/4e/3e + cycle4 + dual brevet |
| Pools cycle4/brevet | `src/logic/questionsConfig.js:23`, `src/data/questions/index.js:46` | dualité binaire |
| Mini-jeux ↔ matière | `src/components/Fight/minigames/index.js:16` (`MINIGAMES`, `getMinigame`) | 6 entrées en dur |
| Décor ↔ matière | `src/logic/decorGenerator.js:37` (`SUBJECT_PROPS`) | props par matière |
| Sujet forcé (events) | `src/data/events.js` (`sphinx: { subject:'hardcore' }`), `effectText.js:50` | lookup `SUBJECTS[...]` |
| Fallback embarqué | `src/data/questions/_cycle4.js`, `_brevet.js`, `index.js:10` | 2 pools figés |

> ~20-30 références directes à `SUBJECT_KEYS`/`SUBJECTS` à router via un registre.

---

## 3. Concept central : le **registre de filières**

On introduit une abstraction unique : la **filière** = ce qui remplit une voie du
plateau et déclenche un défi.

```js
// Descripteur de filière (runtime, construit depuis la sélection + la base)
{
  key: 'histoire-antiquite',     // identifiant unique pour la partie
  name: 'Antiquité',             // libellé affiché
  short: 'ANT',
  icon: '🏛️',
  color: '#c79120', colorSoft: '#…', colorDeep: '#…',
  biome: 'Les Ruines Dorées',    // décor/ambiance
  minigame: 'timeline',          // clé du défi (mini-jeu) à lancer
  pick: (q) => /* prédicat de filtrage des questions */,  // ou un filtre sérialisable
}
```

**Tout le moteur lit ce registre au lieu de `SUBJECTS`/`SUBJECT_KEYS`** :
- `boardGenerator` reçoit la **liste des filières actives** (au lieu de `SUBJECT_KEYS`).
- `decorGenerator` lit `filiere.biome`/couleurs (fallback générique si absent).
- `getMinigame` lit `filiere.minigame`.
- `effectText`/affichage lisent `filiere.name`.

Le **store** garde une `state.questions` indexée par **clé de filière** :
`{ [filiereKey]: Question[] }`. `fightPickQuestion(filiereKey)` ne change pas
de forme. La nouveauté est **comment on construit cette map** au démarrage.

### Construction des filières actives (au `startGame`)
```
selection (module + mode + niveaux + filtres)  ──►  filières actives []
                                                └►  questions{ filiereKey: [...] }
```
- **Mode multi-matières** : 1 filière = 1 matière (≈ comportement actuel).
- **Mode mono-matière** : 1 filière = 1 sous-matière (ou 1 thème) de la matière
  choisie. Couleurs dérivées de la matière parente (dégradés), biome hérité ou
  propre.

---

## 4. Modèle de données (Supabase)

### 4.1 Nouvelle table `quete_modules`
| colonne | type | note |
|---|---|---|
| `key` | text PK | ex. `college`, `lycee`, `cinema` |
| `name` | text | « Collège », « Cinéma » |
| `icon` | text | emoji |
| `kind` | text | `school` \| `themed` (filtrage niveaux ou non) |
| `description` | text | |
| `enabled` | bool | |
| `ord` | int | |

### 4.2 Nouvelle table `quete_categories` (= « matières/filières » d'un module)
Remplace à terme l'objet `SUBJECTS` en dur.
| colonne | type | note |
|---|---|---|
| `key` | text PK | ex. `histoire`, `realisateurs` |
| `module` | text FK → modules | |
| `name`, `short`, `icon` | text | |
| `color`, `color_soft`, `color_deep` | text | palette plateau |
| `biome` | text | nom d'ambiance/décor |
| `minigame` | text | clé du défi par défaut de la catégorie |
| `board` | bool | apparaît sur le plateau (vs « forcé-only » comme cultureG/hardcore) |
| `enabled`, `ord` | | |

### 4.3 Extension de `quete_questions`
Champs **ajoutés** (rétro-compatibles, valeurs par défaut pour l'existant) :
| colonne | type | note |
|---|---|---|
| `module` | text | défaut `college` (rempli pour l'existant) |
| `category` | text | = l'actuel `subject` (rename logique, on garde `subject` en alias) |
| `subcategory` | text | **sous-matière** (nouveau, optionnel) |
| `theme` | text | = l'actuel `t`, structuré ; sert de **voie** en mode mono-matière |

> Migration douce : l'existant devient `module=college`, `category=subject`,
> `subcategory=null`, `theme=t`. **Aucune perte.** On peut garder `subject`/`t`
> comme colonnes synonymes le temps de la transition.

### 4.4 Sous-matières & thèmes
Deux options (à trancher) :
- **(A) Dérivés** des questions : la liste des sous-matières/thèmes d'une matière
  = `DISTINCT (subcategory, theme)` sur `quete_questions`. Zéro table en plus,
  mais pas de couleurs/ordre propres.
- **(B) Table `quete_themes`** : `{ key, module, category, subcategory, name,
  color?, icon?, ord, enabled }` pour piloter l'ordre, les couleurs de voie et
  les libellés indépendamment du contenu. **Recommandé** pour le mode
  mono-matière (les voies ont besoin d'identité visuelle).

---

## 5. Génération du plateau (les deux modes)

`boardGenerator` ne connaît plus `SUBJECT_KEYS` : il reçoit `activeFilieres[]`.

```js
// AVANT : shuffleArray(SUBJECT_KEYS)
// APRÈS : shuffleArray(activeFilieres.map(f => f.key))
generateBoard({ ..., filieres: activeFilieres })
```

- **Multi-matières** : `activeFilieres` = matières sélectionnées (≥2). Inchangé
  fonctionnellement.
- **Mono-matière** : `activeFilieres` = sous-matières (ou thèmes) de la matière
  choisie. Chaque **voie** d'une section = une sous-matière différente → « les
  thèmes deviennent les chemins ».

Le reste (jonctions, voies parallèles, sections, voie finale, événements) **ne
change pas** : il manipule déjà des clés opaques.

### Cas limites à prévoir
- Trop peu de filières pour le nb de voies demandé → réduire le nb de voies ou
  réutiliser des filières (déjà géré pour les matières aujourd'hui).
- Mode mono-matière avec 1 seule sous-matière → retomber en « thèmes » comme voies.

---

## 6. Défis (mini-jeux) — dédiés par module

État actuel : `MINIGAMES` mappe 6 clés de matière → composant
(`minigames/index.js`). On généralise :

- Chaque **filière** porte une clé `minigame`. `getMinigame(key)` lit le registre,
  fallback `DEFAULT_MINIGAME` (`QuickDuel`).
- Les **mini-jeux dédiés par module** sont de nouveaux composants ajoutés au
  registre par clé (ex. `cinema-blindtest`, `jeuxvideo-screenshot`).
- Le registre `MINIGAMES` devient extensible (objet ouvert par clé), et la
  catégorie/le module déclare quelle clé utiliser.

> Travail réel = concevoir + coder N mini-jeux par module. À étaler (un module à
> la fois). Le moteur de sélection, lui, est trivial une fois le registre par clé.

### Interface attendue d'un mini-jeu (contrat existant à respecter)
Réutiliser le contrat actuel (`Component`, `name`, `persistent?`,
`pointsBased?`…) documenté dans `minigames/index.js` pour ne pas toucher
`fightHandlers`/`FightModal`.

---

## 7. Sélection au Setup

Nouveau parcours (remplace/enrichit `LevelSelect` + sélection matières) :

1. **Choix du module** (cartes : Collège, Lycée, Cinéma…).
2. **Module scolaire** → niveaux (comme aujourd'hui) ; **module thématique** →
   pas de niveaux (le champ `level` est ignoré, `kind='themed'`).
3. **Mode plateau** : *Multi-matières* ou *Mono-matière* (toggle).
   - Multi : cocher les matières (≥2).
   - Mono : choisir 1 matière → cocher les sous-matières/thèmes à inclure.
4. (Optionnel) filtres fins par sous-matière/thème.

Le store passe de `level: []` à une **sélection** structurée :
```js
selection: {
  module: 'college',
  mode: 'multi' | 'single',
  levels: ['5e','4e'],          // school only
  useBrevet: false,             // school only (devient un « pool » générique)
  categories: ['histoire',…],   // mode multi
  category: 'histoire',         // mode single
  themes: ['antiquite','moyen-age'], // mode single
}
```
`startGame` construit `activeFilieres` + `questions{}` à partir de cette sélection.

> **Rétro-compat** : un helper convertit l'ancien `level: []`/`useBrevet` en
> `selection` (module `college`, mode `multi`, matières par défaut) pour ne pas
> casser les parties sauvegardées / le code existant.

---

## 8. Éditeur de modules (in-game)

Sur le modèle des éditeurs existants (questions/objets/événements/recettes,
`src/components/Setup/*Editor.jsx`, déverrouillage code 54150) :

- **ModulesEditor** : CRUD modules + catégories (nom, couleurs, biome, icône,
  mini-jeu par défaut, board on/off).
- **ThemesEditor** (si table `quete_themes`) : sous-matières/thèmes + couleurs/ordre.
- L'éditeur de **questions** existant (`QuestionsEditor.jsx`) gagne les champs
  `module` / `category` / `subcategory` / `theme` (et ses onglets ne sont plus
  figés sur `SUBJECT_KEYS` mais sur les catégories du module sélectionné).
- Liaison vivante : `setCustomModules`/`setCustomCategories` + `syncEnabled…`
  (même pattern que `setCustomEvents`/`setCustomRecipes`).

---

## 9. Contenu de masse (pool immense)

Séparé du moteur. Une fois la taxonomie en place :
- **Génération multi-agents par thème** (comme la passe « questions 6e » :
  rédacteur + vérificateur par thème, conformité programme/sources), écrivant
  directement en base avec `module/category/subcategory/theme`.
- Garde-fous : convention `correcte` 1-indexé, réponses mélangées à l'affichage,
  anti-doublon, vérif factuelle.
- Lots par module : Collège (compléter), Lycée, puis modules thématiques.

---

## 10. Feuille de route (phases & effort)

| Phase | Contenu | Effort |
|---|---|---|
| **0** | Ce doc (cadrage) | ✅ |
| **1 — Moteur** | Registre de filières dynamique : sortir `SUBJECT_KEYS`/`SUBJECTS` du dur, router boardGenerator/decor/minigames/effectText via le registre. Module `college` = 1er module, **zéro changement visible**. Tables `quete_modules`/`quete_categories` + migration de l'existant. | Moyen-élevé |
| **2 — Mode mono-matière** | `selection` structurée au Setup, construction des filières en mode single (sous-matières/thèmes = voies), table `quete_themes`. | Moyen |
| **3 — Éditeur de modules** | ModulesEditor/ThemesEditor + extension du QuestionsEditor. | Moyen |
| **4 — Défis par module** | Registre de mini-jeux par clé + 1er lot de mini-jeux dédiés (par module ajouté). | Élevé (récurrent) |
| **5 — Contenu** | Workflow de génération de masse par thème. | Élevé (récurrent) |

> L'ordre 1→2→3 est le chemin critique du **moteur**. 4 et 5 s'étalent par module.

---

## 11. Compatibilité & migration

- **Sauvegardes** : `selection` dérivée de l'ancien format si absente (helper de
  migration dans le chargement de save, cf. pattern `Array.isArray` déjà utilisé).
- **Hors ligne** : le snapshot (`scripts/snapshot-offline.mjs` →
  `offlineSnapshot.json`) doit inclure `quete_modules`/`quete_categories`/
  (`quete_themes`) en plus des questions. Ajouter ces tables à la capture.
- **Forcé-only** (`cultureG`/`hardcore`) : deviennent des catégories `board=false`
  d'un module (transverses), pilotées par les events à `forceSubject`.
- **Décor/mini-jeux manquants** : fallback générique (biome « Carrefour »,
  `DEFAULT_MINIGAME`) pour toute filière sans config dédiée.

---

## 12. Risques & décisions ouvertes

1. **Sous-matières : table dédiée (B) ou dérivées (A) ?** → recommandation **B**
   pour l'identité visuelle des voies en mode mono-matière.
2. **`subject`/`t` : renommer en `category`/`theme` ou garder en alias ?** →
   garder en alias le temps de la transition (moins de risque).
3. **Niveaux pour modules thématiques** : ~~ignorés~~ → **TRANCHÉ (20/06)** : la
   difficulté est un **axe optionnel par thème** (school → niveaux ; thématique →
   facile/moyen/difficile, ou aucun). `level` = filtre optionnel défini par le thème.
4. **Mini-jeux dédiés = gros effort récurrent** : prioriser quels modules en ont
   besoin en premier.
5. **Volume base** : un pool immense → penser pagination/index DB
   (déjà paginé à 1000 dans `questionsConfig.js`).

---

## 13. Fichiers impactés (carte d'attaque, pour plus tard)

- `src/data/subjects.js` → devient un **fallback** ; source réelle = registre dynamique.
- `src/logic/` : nouveau `taxonomy.js`/`filieres.js` (registre + construction
  depuis la sélection) ; `questionsConfig.js` (champs étendus) ; nouveau
  `modulesConfig.js`/`categoriesConfig.js` (cache + Supabase, pattern existant).
- `src/logic/boardGenerator.js`, `decorGenerator.js` : consomment `filieres[]`.
- `src/components/Fight/minigames/index.js` : registre ouvert par clé.
- `src/store/gameStore.js` : `selection` + construction `activeFilieres`/`questions`.
- `src/components/Setup/` : `LevelSelect` → `ModuleSelect` + mode plateau ;
  nouveaux `ModulesEditor`/`ThemesEditor` ; `QuestionsEditor` étendu.
- `scripts/snapshot-offline.mjs` : capture des nouvelles tables.

---

## 14. Objets & thèmes (ajout 2026-06-20)

Décision : **un seul catalogue d'objets** (`quete_items` actuelle), PAS d'onglets-
catalogues séparés par thème (qui dupliqueraient la mécanique et exploseraient
l'équilibrage). La quasi-totalité des objets sont **mécaniques** (bouclier, +or,
dé, loot, piège…) donc **thème-agnostiques**.

**Modèle : pool unique + tag de thème.**
- Nouveau champ **`themes text[]`** sur `quete_items` :
  - `[]` / « universel » → l'objet drop/s'achète **dans toutes les parties** (le socle
    mécanique = la majorité des ~130 objets faits main).
  - `['jeuxVideo', …]` → objet **de saveur**, n'apparaît que si ce(s) thème(s) actif(s).
- **Loot + boutique** filtrent déjà sur `enabledItems` → ajouter le prédicat
  « ET (universel OU `themes` ∩ thèmes actifs) ». Changement minime.
- **Éditeur** : des onglets/filtre par thème = simple *vue d'organisation* (confort de
  l'« option B ») ; le modèle dessous reste le pool unique taggé (robustesse de l'« option A »).

**Affinité généralisée** (remplace les affinités scolaires en dur) :
- Aujourd'hui en dur : objets `oc*` (« quand je réponds bien en Français »), `favSubject`
  des ingrédients (alchimie), déclencheurs `on:'correct'` filtrés par `subjects[]`,
  `lootBonusSubject` (`itemEffects.getSubjectLootBonus`).
- Cible : l'affinité pointe vers une **catégorie ACTIVE**, pas une clé scolaire figée —
  soit **« la catégorie de la case »** (l'affinité joue sur le sous-thème courant), soit
  une **« catégorie de prédilection »** affectée à l'équipe. → marche avec n'importe quel thème.
- `getSubjectLootBonus`/déclencheurs `subjects[]`/`favSubject` se résolvent contre les
  catégories en jeu (résolution dynamique, comme `resolveSubjectFor`).

**Migration objets :**
- Tous les objets existants → `themes=[]` (universels) — aucun changement de comportement.
- Les objets/ingrédients à affinité scolaire → soit rattachés au thème **Collège**
  (`themes=['college']`), soit bascule vers l'**affinité générique** (recommandé : « catégorie
  de la case / de prédilection »), ce qui les rend jouables avec tout thème.

> Effort : **moyen** côté moteur (champ + filtre loot/boutique + résolveur d'affinité),
> **récurrent** côté contenu (créer des objets de saveur par thème, au fil de l'eau).
> À typer en TS dès le départ (champ `themes` sur le type `Item`, déjà dans `src/types`).

---

*Fin du document de préparation. Aucune implémentation engagée.*
