# DESIGN — Questions v2 : navigation par thèmes, sous-thèmes profonds, difficulté

> Cadrage (2026-07-04). Aucune implémentation encore. À valider avant de coder.
> Contexte : [[restructuration-questions-cassettes]], `DESIGN_MODULES.md`,
> `DESIGN_SELECTION_CASSETTES.md`.

## 1. Constat

L'éditeur `QuestionsEditor.jsx` navigue par **3 axes hérités du 100 % scolaire** :
`pool` (cycle4/brevet) · `subject` (onglets à plat) · `level` (6e→3e).

La réalité en base a débordé ce cadre :

- `pool='cycle4'` = **9441 questions / 60 subjects / 9 domaines** ; `pool='brevet'` = 438 (scolaire).
- `pool` est devenu **vestigial** (tout le culture-G est fourré dans « cycle4 »).
- `level` (6e–3e) n'a de sens que pour les 8 matières **scolaires**.
- `difficulte` (1–5) et `generalite` (1–5) **existent et sont déjà remplies** sur
  ~8170 questions culture-G (moyennes 3.04 / 2.82) — mais **jamais affichées** dans
  l'éditeur.

Les vrais axes de navigation existent déjà en base (`quete_themes`, arbre ltree :
9 domaines → ~55 thèmes) mais l'éditeur ne les exploite pas.

## 2. Décisions tranchées

| Sujet | Décision |
|---|---|
| **Difficulté** | Garder la colonne `difficulte` (1–5) telle quelle. L'**afficher** dans l'éditeur, avec un habillage 3 paliers **amateur / connaisseur / expert** posé par-dessus les 1–5. Pas de migration destructive. |
| **Sous-thèmes** | **Vrais nœuds** dans l'arbre ltree, **profondeur illimitée** (ex. Divertissement › Jeux vidéo › Bethesda › Skyrim). |
| **Périmètre immédiat** | Cadrage écrit d'abord (ce document). Puis, dans l'ordre : éditeur → sous-thèmes → UX cassette. |

## 3. Difficulté — modèle & UI

### 3.1 Colonne conservée, paliers en surcouche
`difficulte` reste un `smallint` 1–5 (source de vérité, déjà peuplée, réutilisable
pour un futur équilibrage auto). Les 3 paliers demandés sont une **bande de lecture**
posée dessus, pas une nouvelle colonne :

| Palier | Bande `difficulte` | Répartition actuelle culture-G |
|---|---|---|
| 🟢 **Amateur** | 1–2 | ~2759 |
| 🟡 **Connaisseur** | 3 | ~2566 |
| 🔴 **Expert** | 4–5 | ~2847 |

(Bandes bien équilibrées vu la distribution en cloche. Le mapping exact est **à
confirmer** — cf. §8.)

### 3.2 Contrôle dans l'éditeur
- Un sélecteur **3 gros boutons** Amateur / Connaisseur / Expert (geste principal,
  simple pour un prof).
- Un réglage fin optionnel **1–5** replié dessous (pour affiner sans changer de
  palier — ex. « expert mais 4 plutôt que 5 »).
- Un **filtre par palier** dans la liste de gauche (en plus de la recherche).
- Idem `generalite` : gardée en base, **affichée en lecture** (badge « grand public
  ↔ pointu ») ; pas un axe d'édition prioritaire pour l'instant.

### 3.3 Les NULL (scolaire + brevet)
1269 questions sans `difficulte`. Le scolaire porte déjà sa progression via `level`
(6e→3e). Options (§8) : (a) afficher « non classé » et laisser le prof noter à la
main, ou (b) backfill one-shot par heuristique (6e→2, 5e/4e→3, 3e/brevet→4) via un
petit script. **Reco : (a) par défaut, script (b) fourni mais non lancé d'office.**

## 4. Sous-thèmes profonds — modèle de données

### 4.1 Ce qui existe déjà et qu'on garde
- **La cassette EST le nœud, à n'importe quelle profondeur.** Le moteur ne connaît
  que « nœud → feuilles descendantes » : `descendantLeaves()` / `childrenOf()` sont
  **déjà récursifs**. Insérer un nœud interne = pool de toutes ses feuilles.
- **Feuille** = nœud avec `subjectKey` (= `quete_questions.subject`). Seules les
  feuilles portent des questions et exigent une ligne `quete_categories` (rôle
  subject, car `getQuestions` n'itère que `SUBJECT_KEYS`). Les nœuds **internes** =
  purs conteneurs, **aucune** catégorie ni question.
- **Re-pathing gratuit** : les questions référencent `subject` (stable), jamais le
  `path`. Déplacer/insérer un nœud ne touche **que** `quete_themes`.

### 4.2 Le seul ajustement moteur : nœud MIXTE
Aujourd'hui un nœud peut avoir soit un `subjectKey`, soit des enfants — pas les deux
(`descendantLeaves` s'arrête au premier `subjectKey` rencontré, `return` précoce).

Or ta vision demande le cas mixte : **Jeux vidéo** garde ses 290 questions
« généralistes » **ET** gagne des enfants (Skyrim, GTA…). Règle proposée :

> Un nœud contribue **son propre `subjectKey` (s'il en a un) PUIS toutes ses feuilles
> descendantes**. « Insérer Jeux vidéo » = 290 générales + Skyrim + GTA + … ;
> « insérer Skyrim » = Skyrim seul.

Changement minime dans `descendantLeaves` (ne plus `return` au `subjectKey` d'un nœud
qui a aussi des enfants — pousser sa clé **et** continuer la descente). Rétro-compatible :
les conteneurs actuels n'ont pas de `subjectKey`, comportement inchangé.

### 4.3 Recette « créer un sous-thème »
- **Feuille jouable** (ex. Skyrim) : 1 ligne `quete_categories` (rôle subject) + 1
  ligne `quete_themes` (`subjectKey='skyrim'`, `parentKey='jeux_video'`, `path`
  calculé) + des questions `subject='skyrim'`.
- **Nœud conteneur** (ex. Bethesda) : 1 ligne `quete_themes` sans `subjectKey`. C'est
  tout.

### 4.4 Ton exemple « évolution Bethesda » — pourquoi c'est cheap
1. État initial : `jeux_video` feuille (290 Q).
2. Tu crées Skyrim/GTA en enfants → `jeux_video` devient **mixte** (§4.2).
3. Plus tard tu insères **Bethesda** entre JV et {Skyrim, Oblivion, Fallout} :
   créer le nœud `bethesda` sous `jeux_video`, re-parenter les 3 jeux dessous,
   recalculer leur `path` (`…jeux_video.skyrim` → `…jeux_video.bethesda.skyrim`).
   **Les questions ne bougent pas** (elles pointent `subject='skyrim'`).
4. Coût réel = un outil **« déplacer un nœud »** (change `parentKey` + re-path du
   sous-arbre) — ou un script ponctuel. Rien d'autre.

## 5. UX cassette — drill-down récursif

### 5.1 Le problème que tu soulèves
Le rendu actuel (séparateur « best of » + sous-cassettes à plat) **casse à la
profondeur 3**. Un sous-sous-thème (Skyrim sous JV sous Divertissement) ne rentre
pas dans une liste plate.

### 5.2 Solution : navigateur d'arbre à un niveau visible + fil d'Ariane
On ne montre **qu'un niveau à la fois** :

- L'étagère/rack affiche : **la cassette « best-of » du nœud courant** (dorée =
  insérer tout le nœud) + **ses enfants directs**.
- Un **fil d'Ariane** « Divertissement › Jeux vidéo › Bethesda » pour remonter.
- Chaque carte-**conteneur** a 2 gestes : **insérer le coffret** (drag la dorée) ·
  **ouvrir** (tap → on descend d'un cran, ses enfants remplacent l'étagère).
- Chaque carte-**feuille** = drag → cassette unique.
- Profondeur **illimitée** sans encombrement : on ne voit jamais plus que
  « best-of courant + enfants directs ».

Résultat pour ton scénario : tu poses « Jeux vidéo » dans le rack → tu vois son
best-of + Skyrim/GTA/Bethesda… ; tu peux insérer JV entier, ou ouvrir Bethesda pour
n'insérer que Skyrim, ou drag Skyrim direct. Le séparateur actuel « best-of +
sous-cassettes » devient simplement **le rendu du niveau courant**, généralisé.

### 5.2.b Direction visuelle retenue (2026-07-04)
Plutôt que masquer les niveaux profonds derrière un pur drill-in, on **affiche la
hiérarchie en place** : les sous-sous-thèmes (ex. Skyrim sous Jeux vidéo) sont des
**mini-cassettes** (format réduit) **rangées sous leur sous-thème parent**. La taille
décroissante marque la profondeur. Drill-in / fil d'Ariane reste possible en secours
pour les branches très profondes (à trancher en Phase C).

### 5.3 Impact code
- `themesToCassetteModel()` (perimeter.js) : passer d'un aplatissement 2 niveaux à
  un modèle **arborescent** (le nœud garde ses enfants, on ne précalcule pas tout).
- `SelectionCassettes.jsx` : ajouter l'état « nœud courant » + fil d'Ariane +
  geste ouvrir/insérer. `buildPerimeter` **inchangé** (il prend déjà un `themeKey`
  à n'importe quelle profondeur).

## 6. Éditeur v2

- **Navigation par arbre** (domaine → thème → sous-thème) au lieu des onglets plats
  + du sélecteur pool. Lit `themesConfig` (déjà chargé au boot).
- **`level`** (6e–3e) affiché **uniquement** sous la branche `scolaire`. `pool`
  masqué (déduit `cycle4` par défaut ; case « Brevet/examen » seulement en scolaire).
- **Difficulté** : boutons 3 paliers + fin 1–5 + `generalite` en lecture (§3.2).
- **Filtre par palier** dans la liste.
- **Création de nœud** : petit outil séparé « Éditeur de thèmes » (créer / renommer /
  **déplacer** un nœud) — le CRUD de nœud est distinct du CRUD de question.

## 7. Chantiers (ordre proposé, non exécuté)

- **Phase A — Éditeur** : afficher `difficulte` (paliers + fin) + `generalite` ;
  filtre par palier ; navigation par arbre ; `level` scolaire-only ; `pool` masqué.
  → Répond direct à ton irritation + rend la difficulté visible. Aucune migration DB.
- **Phase B — Sous-thèmes profonds** ✅ LIVRÉE (2026-07-04) : `descendantLeaves`
  gère le nœud mixte (self + descendants), `isPureLeaf`/perimeter distinguent voie
  singleton vs large ; CRUD thèmes+catégories (`themesConfig`/`categoriesConfig`) ;
  `ThemesEditor.jsx` (créer feuille/conteneur, renommer, **déplacer** = re-path du
  sous-arbre, supprimer), accessible via bouton « 🌳 Thèmes » dans QuestionsEditor.
  14 tests perimeter (dont mixte + repath).
- **Phase C — UX cassette** : drill-down récursif dans `SelectionCassettes`
  + `themesToCassetteModel` arborescent.
- **Phase D (option, plus tard)** : difficulté **en jeu** (sélection de palier au
  Setup, ou cases de plateau par palier) ; backfill scolaire des `difficulte` NULL.

## 8. Décisions confirmées (2026-07-04)

1. **Bandes de difficulté** : ✅ 1-2 Amateur / 3 Connaisseur / 4-5 Expert.
2. **NULL scolaire** (~1269) : ✅ « non classé » à la main (pas de backfill auto).
3. **Nœud mixte** (§4.2) : ✅ oui — un thème peut garder ses questions « générales »
   ET avoir des enfants.
4. **Difficulté en jeu** : ✅ hors périmètre pour l'instant (Phase D plus tard). Les
   paliers restent des métadonnées d'auteur en attendant.

## 9. Questions orphelines (hors arbre)

260 questions ont un `subject` absent de `quete_themes` : `cultureG` (131),
`hardcore` (117), anciens `film_scifi/action/anim` (12). L'éditeur v2 doit exposer un
bac **« Hors arbre / à ranger »** qui liste les `subject` orphelins, pour qu'aucune
question ne soit invisible et qu'on puisse les reclasser (réaffecter à un nœud
existant ou en créer un). Rien n'est supprimé sans décision.
