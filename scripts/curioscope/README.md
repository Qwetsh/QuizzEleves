# Curioscope — pipeline World of Warcraft (P3)

Chaîne complète : captures en jeu → `spots.csv` → bucket `quete-spots` + table
`quete_spots` → le TBI charge les spots au démarrage et le thème de duel
`world_of_warcraft` bascule automatiquement sur le guessr dès qu'il y a des spots.

## 1. Installer l'addon CurioSnap — une fois

1. Copier le dossier `CurioSnap/` (à côté de ce README) dans
   `World of Warcraft/_classic_era_/Interface/AddOns/`
   (adapter `_classic_era_`/`_classic_`/`_retail_` selon la version jouée).
2. Relancer le jeu. Si « addon obsolète » : cocher « Charger les addons
   obsolètes » ou mettre à jour `## Interface` dans le `.toc`
   (numéro : `/dump select(4, GetBuildInfo())` en jeu).
3. Test : prendre un screenshot (Impr. écran) → message vert
   `CurioSnap <zone> x, y — <continent> cx%, cy%` dans le chat.
   L'addon enregistre DIRECTEMENT la position sur la carte du continent
   (aucune table de conversion externe n'est nécessaire).

## 2. La carte « satellite » de chaque continent — une fois

**Déjà en place (provisoire)** : l'art de carte Classic (1002 px) est tuilé et
en ligne — les duels Azeroth fonctionnent, mais c'est flou au zoom. La cible
est le rendu « satellite » type WyriMaps/wowcarto : l'assemblage des minimaps.

1. **wow.export** (https://github.com/Kruithne/wow.export) : Maps → choisir
   Kalimdor → « Export Minimap Tiles » (ou l'export PNG stitché s'il est
   proposé). Si l'export sort en tuiles séparées, les assembler en un seul
   PNG (wow.export sait produire l'image complète ; sinon WoWTools.Minimaps
   MinimapCompile). Poser le résultat dans `C:\CurioscopeAssets\maps\`.
   Pareil pour Eastern Kingdoms (= « Azeroth » en interne).
2. **Calibration** (indispensable : l'assemblage minimap ne couvre pas le même
   cadre que la carte du jeu). Choisir 2 lieux reconnaissables ÉLOIGNÉS en
   diagonale (ex. Orgrimmar et Cap Strangleronce) :
   - en jeu, s'y placer, screenshot → le chat CurioSnap donne `cx%, cy%`
     (→ diviser par 100) ;
   - ouvrir l'assemblage dans une visionneuse et noter la position en pixels
     du même endroit.
3. Générer + pousser la pyramide (WebP, ~30-60 Mo par continent) :

       node scripts/curioscope/make-tiles.mjs C:\CurioscopeAssets\maps\kalimdor.png wow_kalimdor ^
         --ref 0.532,0.297=8112,3260 --ref 0.475,0.815=7350,9480

   (valeurs d'exemple — mettre les tiennes). Le script recadre l'image sur le
   cadre uiMap : les spots de l'addon tombent juste sans autre réglage.
4. Reporter la ligne `map: { type:'tiles', w, h, maxNativeZoom }` affichée
   dans `src/data/universes.js` (entrée de l'univers).

`make-map.mjs` (image simple, sans tuiles) reste disponible pour un univers
à carte unique (ex. futur Terre du Milieu).

## 3. Sessions de capture — au fil de l'année

- Se placer devant le point d'intérêt, `Alt+Z` (masquer l'UI), Impr. écran.
- Pas d'UI, pas de minimap, pas de nom de joueur dans le cadre.
- Difficulté visée : 1 = monument unique (portes d'Orgrimmar) → 5 = nature
  anonyme. Objectif : 150-200 spots au lancement, 300-500 en croisière.
- **Fin de session : `/reload` ou déconnexion propre** (sinon le journal
  SavedVariables n'est pas écrit sur disque).

## 4. Rapatrier et pousser une session

1. Créer `C:\CurioscopeAssets\wow\session-N\` et y copier :
   - les `WoWScrnShot_*.jpg` de `World of Warcraft/_classic_era_/Screenshots/`
   - `WTF/Account/<COMPTE>/SavedVariables/CurioSnap.lua`
2. `node scripts/curioscope/parse-snaps.mjs C:\CurioscopeAssets\wow\session-N`
   → produit/complète `spots.csv` (fusion : les lignes déjà éditées sont
   conservées).
3. Éditer `spots.csv` (tableur, séparateur `;`) : `label` (nom affiché à la
   révélation), `difficulte` 1-5, `actif` 0 pour écarter une capture ratée.
4. `node scripts/curioscope/build-spots.mjs C:\CurioscopeAssets\wow\session-N --dry-run`
   pour vérifier, puis sans `--dry-run` : WebP 1600 px q80 → upload noms
   opaques → insert `quete_spots`. Idempotent (`.curio-done.json`).
5. Recharger le TBI : les spots arrivent au démarrage (cache + refresh).

## 5. Calibrage du barème — en jouant

`src/data/universes.js` (wow_*) : `score.k` (≈ largeur_carte/8 en lieues,
départ 18) et `freeDist` (rayon plein pot, départ 1,5 lieue). Si les scores
paraissent trop généreux/sévères en classe, ajuster k à la baisse/hausse.

## Divers

- `calib.json` (option `--calib` de build-spots) : correction affine par
  univers si la carte-image ne colle pas au cadre uiMap
  (`{ "wow_kalimdor": { "ax": 1, "bx": 0, "ay": 1, "by": 0 } }`).
- Mode hors ligne du jeu : les spots/cartes sont distants → le thème WoW
  retombe sur le duel générique dans le build offline (garde-fou).
- Légal : screenshots/cartes = propriété Blizzard, régime fansite non
  commercial. Ne pas réutiliser la base d'un autre fan site.
