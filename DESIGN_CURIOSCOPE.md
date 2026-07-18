# Curioscope — Moteur « Guessr » multi-univers

Moteur de mini-jeu type GeoGuessr : une image (photo plate ou panorama 360°), une carte
zoomable, chaque équipe place un pin, la distance donne des points, les points se
convertissent en récompense (victoire de duel, or, déplacement, loot…).
Multi-univers : monde réel, World of Warcraft (premier univers fictif), puis Terre du
Milieu, Skyrim, GTA V… Projet fan, non commercial.

---

## 0. Ce qui existe DÉJÀ dans le jeu (à généraliser, pas à refaire)

| Brique | Fichier | Réutilisation |
|---|---|---|
| Mini-jeu GeoDuel (monde réel) | `src/components/Fight/minigames/GeoDuel.jsx` | Devient le 1er « univers » du nouveau moteur |
| Commit-reveal (A place, B place, révélation) | `src/components/Fight/minigames/PlacementDuel.jsx` | Réutilisé tel quel |
| Score GeoGuessr + haversine | `GeoDuel.jsx` (`geoPoints`, `GEO_TARGET_SCORE=10000`) + `placementData.jsx` (`haversineKm`, `lonLatToXY`) | Paramétrer par univers (métrique euclidienne px pour mondes fictifs) |
| Registre moteurs de duel | `src/components/Fight/minigames/index.js` (`ENGINES`, `THEME_MINIGAMES`, flags `persistent`/`pointsBased`) | On ajoute un moteur `curioscope` |
| Résolution duel + récompenses | `src/store/fightHandlers.js` (`fightMatchWin`, `applyFightReward`) | Inchangé — le moteur appelle les callbacks existants |
| File d'actions suspendable + interrupts | `src/store/effectEngine.js` (`runEffects`, `suspend`/`resumeQueue`) | Nouvelle action `startMinigame` sur ce modèle |
| Récompenses moteur | actions `money` / `move` / `loot` / `grantItem` | Conversion points→récompense en données |
| Upload Supabase Storage noms opaques | `src/logic/questionsConfig.js` (`uploadQuestionMedia`, bucket `quete-questions`) | Même pattern, bucket `quete-spots` |
| Scripts seed avec upload | `scripts/seed-monuments.mjs` | Modèle pour `seed-spots-wow.mjs` |

**Conséquence clé** : les tables `duels`/`manches`/`guesses` du brouillon initial sont
INUTILES en V1 — le système de duel du jeu (FightModal, BO/points, passage de main
local) gère déjà tout ça. Seule la table des spots est nécessaire.

---

## 1. Décisions d'architecture

### 1.1 Un moteur, un registre d'univers
```js
// src/data/universes.js
export const UNIVERSES = {
  monde_reel: {
    name: 'Monde réel', crs: 'geo',           // lat/lon + haversine (km)
    map: { type: 'image', src: worldMap },     // existant
    scoreK: 2000, freeRadius: 100, unit: 'km',
  },
  wow_kalimdor: {
    name: 'Kalimdor', crs: 'flat',             // coordonnées carte (px) + euclidienne
    map: { type: 'image', src: '<url storage>', w: 4096, h: 5480 },
    scoreK: null /* ≈ largeur/8, calibré en jeu */, unit: 'lieues',
  },
  // wow_royaumes_est, terre_du_milieu, gta_v, skyrim…
};
```
Un « spot » = `{ universe, image_path, cx, cy, difficulte, hint? }` — coordonnées déjà
dans l'espace de la carte de l'univers (la conversion zone→continent WoW se fait au
seed, PAS au runtime).

### 1.2 Carte : Leaflet en `CRS.Simple`
- Ajouter `leaflet` + `react-leaflet` : zoom/pan/pin, standard, MIT.
- V1 : **une seule image par continent** (`L.imageOverlay`, ~4096 px, 3-5 Mo) — pas de
  pyramide de tuiles. Suffisant pour placer un pin ; tuiles seulement si le zoom paraît
  trop flou (V3, pipeline wow.export → gdal2tiles déjà identifié).
- Le monde réel migre aussi sur Leaflet (même UX zoom partout) ; `haversineKm` reste la
  métrique.

### 1.3 Images : plates en V1, panoramas 360° en V2
- V1 : screenshots plats (comme Where in Warcraft) — coût ~1 min/spot.
- V2 : équirectangulaires affichées avec **Photo Sphere Viewer** (MIT, actif 2026,
  wrapper `react-photo-sphere-viewer`). Champ `render: 'flat' | 'pano'` sur le spot.
  Capture WoW : addon PanoShot + assemblage Hugin (~10-15 min/spot, réservé aux lieux
  emblématiques). Monde réel 360 : API **Mapillary** filtrée `is_pano` (gratuite,
  CC-BY-SA) — même viewer.

### 1.4 Déclenchement : duel ET action d'effet
1. **Duel** : moteur `curioscope` dans `ENGINES` (`persistent: true, pointsBased: true`),
   thèmes dans `THEME_MINIGAMES` (`curioscope_wow`, `curioscope_monde`, mixte…).
2. **Effet** : nouvelle action `startMinigame` dans `effectEngine.js` (pattern
   suspend/interrupt existant). Mode solo-challenge : l'équipe joue N manches seule,
   son total de points est converti par une table en données :
   ```js
   { minigame: 'curioscope', universe: 'any', rounds: 1,
     convert: [ { min: 4000, actions: [{ type: 'money', mode: 'gain', n: 25 }] },
                { min: 2000, actions: [{ type: 'move', dir: 'forward', n: 2 }] },
                { min: 0,    actions: [] } ] }
   ```
   → utilisable par objets, événements, pièges, météo, sans nouveau code par variante.

### 1.5 Stockage — RIEN de lourd dans le repo git
| Donnée | Emplacement | Pourquoi |
|---|---|---|
| Screenshots bruts, journaux CurioSnap, projets Hugin, exports wow.export | `C:\CurioscopeAssets\` (hors repo, **hors OneDrive** — des Go regénérables, la sync OneDrive serait pénible) | Zone de travail locale = **master** (tout hébergeur repeuplable depuis là) |
| Images de spots finales (redimensionnées 1600 px, **WebP q80**, ~130 Ko ; panos ~1,5 Mo) | Supabase Storage, bucket **`quete-spots`**, noms opaques `s-<uuid>.webp` (anti-triche, pattern `quete-questions`) | Sauvegarde durable du produit fini |
| Cartes continentales (1 image/continent) | Supabase Storage `quete-spots/maps/` | 3-5 Mo pièce, chargées 1×/partie |
| Métadonnées spots | Table `quete_spots` (PersoDB) | DB = source de vérité |
| Scripts pipeline + addon Lua + `universes.js` | Repo git (`scripts/curioscope/`) | Léger, versionnable |

### 1.5 bis Plan de croissance stockage (décidé 2026-07-17)

**Règle d'architecture (dès P1, non négociable)** : `quete_spots.image_path` stocke un
**chemin relatif** (`wow/s-<uuid>.webp`), JAMAIS d'URL complète ; la base d'URL vit
dans une config unique (`spotsBaseUrl`). Changer d'hébergeur = copier les fichiers +
changer une ligne. (Ne pas reproduire le pattern items qui stocke des URLs complètes.)

Paliers :
1. **Palier 0 — Supabase Storage** (gratuit, 1 Go, 5 Go egress/mois) : en WebP,
   ≈ 6 000-7 000 spots plats ou ~2 000 spots + 300 panos. Largement suffisant pour
   plusieurs univers.
2. **Palier 1 — Cloudflare R2** (gratuit, 10 Go, **egress illimité gratuit**, API
   compatible S3) : migration = copie des fichiers (ou re-upload depuis
   `C:\CurioscopeAssets\`) + changement de `spotsBaseUrl` + 3 lignes dans les scripts
   d'upload. ≈ 60 000 spots.
3. **Palier 2 — R2 payant** : ~0,015 €/Go/mois (100 Go ≈ 1,50 €/mois). Jamais un
   vrai mur.

Écartés : Supabase Pro (25 $/mois, disproportionné), repo GitHub d'assets (screenshots
Blizzard redistribués publiquement = exposition juridique inutile).

Budget courant : 200 spots ≈ 26 Mo, 500 spots + 30 panos ≈ 110 Mo (WebP).

### 1.6 Schéma DB (simplifié vs brouillon initial)
```sql
create table quete_spots (
  id          bigint generated always as identity primary key,
  universe    text not null,                  -- 'wow_kalimdor', 'monde_reel'…
  zone        text,                           -- libellé (révélation)
  cx          numeric(8,2) not null,          -- coords espace carte univers
  cy          numeric(8,2) not null,
  image_path  text not null,                  -- bucket quete-spots
  render      text not null default 'flat',   -- 'flat' | 'pano'
  difficulte  int not null default 3 check (difficulte between 1 and 5),
  actif       boolean not null default true,
  meta        jsonb                           -- map_id, x_zone, y_zone, hint…
);
```
Anti-triche : V1 TBI locale → pas critique (le prof tient l'écran). Pour le mode en
ligne (V3), vue `quete_spots_public` sans `cx,cy,zone` + RPC de résolution — pattern
noté, pas bloquant.

---

## 2. Ressources externes retenues (recherche 2026-07-17)

| Ressource | Usage | Licence |
|---|---|---|
| [wow.export](https://github.com/Kruithne/wow.export) | Export cartes/minimaps WoW (GUI, actif) | MIT |
| [HereBeDragons](https://github.com/Nevcairiel/HereBeDragons) (`HereBeDragons-2.0.lua`) | Tables zone→monde par mapID (extraction JSON à écrire, ~30 lignes) | BSD |
| [whereinwarcraft.net](https://github.com/Kruithne/whereinwarcraft.net) | Référence directe (même concept, même auteur que wow.export) | MIT |
| [Photo Sphere Viewer](https://github.com/mistic100/Photo-Sphere-Viewer) | Viewer panoramas (V2) | MIT |
| [PanoShot](https://www.curseforge.com/wow/addons/panoshot) + Hugin | Capture 360 in-game + stitching | — / GPL |
| [Mapillary API](https://www.mapillary.com/developer/api-documentation) | 360 monde réel gratuit (`is_pano`) | CC-BY-SA |
| [Jean-Tinland/middle-earth](https://github.com/Jean-Tinland/middle-earth) | Terre du Milieu : carte redessinée, **tuiles incluses** — l'univers le plus propre juridiquement | GPL-3.0 |
| [RiceaRaul/gta-v-map-leaflet](https://github.com/RiceaRaul/gta-v-map-leaflet) | GTA V : tuiles Leaflet prêtes | MIT |
| [uesp-gamemap](https://github.com/uesp/uesp-gamemap) / srmap.uesp.net | Skyrim : viewer libre, tuiles à extraire | MIT (code) |
| [LostGamer.io](https://lostgamer.io/world-of-warcraft) | Preuve de faisabilité 360 WoW + réf UX (propriétaire) | — |

Rappel légal : screenshots/cartes Blizzard = régime fansite non commercial. Ne pas
réutiliser la base d'un autre fan site.

---

## 3. Roadmap

Badges : **[TOI]** = étape manuelle utilisateur · **[CC]** = Claude Code.

### P1 — Moteur générique + univers « monde réel » — ✅ LIVRÉE 2026-07-17
- [x] [CC] `leaflet` (SANS react-leaflet : wrapper maison) ; composant `UniverseMap.jsx`
  (CRS.Simple, imageOverlay, zoom/pan ×11, pose de pin, pins/traits/badges/étoile en
  divIcons, chargé en LAZY — Leaflet hors bundle initial et hors tests node).
- [x] [CC] `src/data/universes.js` : registre + `universeMetric` (geo=haversine km /
  flat=euclidienne lieues) + `universeScore` (max·exp) + `pickSpot`.
- [x] [CC] Anti-répétition : `curioSeen`/`curioSeq` persistés (SAVE_FIELDS), action
  `curioMarkSeen` (no-op en devSandbox), tirage LRU jamais-vus d'abord.
- [x] [CC] Moteur `Curioscope.jsx` sur `PlacementDuel` (nouvelle prop `renderBoard`,
  chemin par défaut intact), entrée `curioscope` dans `ENGINES`, thème `geographie`
  migré (`content.universes: ['monde_reel']`). GeoDuel.jsx supprimé.
- [x] [CC] Migration monde réel : 90+ lieux photo + 54 capitales de `placementData.jsx`
  exposés comme spots (alternance photo/capitale conservée).
- [x] [CC] 1058 tests (16 nouveaux `curioscope.test.js`), build + typecheck OK,
  vérifié en jeu via simulateur DEV (placement, validation, révélation, manche 2).
- **[TOI]** Valider l'UX en jeu (zoom, pin, révélation) sur le TBI.

### P2 — Déclenchement par effet + conversion points — ✅ LIVRÉE 2026-07-17
- [x] [CC] Action `startMinigame` dans `effectEngine.js` : suspend la file, ouvre
  `CurioChallengeModal` (défi SOLO : N manches, même tirage LRU que le duel),
  reprise via `curioChallengeResolve(total)`.
- [x] [CC] Conversion par PALIERS BORNÉS `tiers: [{ min, kind: 'money'|'move'|'loot'|'none', n }]`
  (simplification vs `convert` générique du plan : éditable en phrase à trous,
  compilée en actions moteur injectées en tête de file — elles se journalisent
  elles-mêmes). Bots et mode en ligne : défi sauté proprement (journal).
- [x] [CC] Éditeur (EffectBuilder, partagé objets+événements) : action
  « 🔭 Défi Curioscope », manches + paliers add/remove ; `effectText` (résumé
  paliers) ; i18n `log.fx.curio.*` + `modal.curio.*`.
- [x] [CC] 1066 tests (8 nouveaux : suspend, paliers, filet min 0, bots, online,
  reprise de file) ; vérifié en jeu (défi 2 manches → « avance de 2 cases »).
- **[TOI]** Décider 2-3 objets/événements d'exemple et leurs barèmes (via
  l'éditeur — l'action est dans le menu « + Ajouter un effet »).

### P3 — Univers World of Warcraft — outillage ✅ LIVRÉ 2026-07-17, assets [TOI]
Simplification majeure vs plan initial : l'addon interroge `C_Map` EN JEU et
journalise directement la position sur la carte du CONTINENT (cx/cy 0..1) —
**l'extraction HereBeDragons et la conversion zone→continent sont supprimées**
(les tables HBD sont construites au runtime par C_Map, pas dans le .lua).

- [x] [CC] Addon **CurioSnap** (`scripts/curioscope/CurioSnap/`) : zone + coords
  zone ET continent (remontée de hiérarchie uiMap), print de contrôle, SavedVariables.
- [x] [CC] Supabase : table `quete_spots` (cx/cy normalisés, `image_path` RELATIF,
  RLS pattern maison) + bucket public `quete-spots` (migration `curioscope_quete_spots`).
- [x] [CC] Pipeline `scripts/curioscope/` : `parse-snaps.mjs` (SavedVariables +
  screenshots → `spots.csv` éditable, fusion préservant les éditions),
  `build-spots.mjs` (WebP 1600 q80 → upload noms opaques → insert, idempotent,
  `--dry-run`, calibration affine `--calib`), `make-map.mjs` (carte → WebP 4096 →
  `maps/<universe>.webp`, affiche l'aspect à reporter). `snaplib.mjs` pur + testé.
- [x] [CC] Front : `spotsConfig.js` (cache localStorage + refresh au boot TBI),
  univers `wow_kalimdor`/`wow_royaumes_est` (flat, lieues, k=18 de départ, spots
  dynamiques `setCurioSpots`), thème de duel `world_of_warcraft` → curioscope +
  **garde-fou getMinigame** (0 spot chargé → duel générique, jamais de carte vide ;
  couvre aussi le build offline). i18n `fight.mg.wow.*`. 1074 tests, build OK.
- **[TOI]** Installer l'addon (`README.md` du dossier, étape 1) et vérifier le
  message chat au premier screenshot (`/reload` en fin de session pour flusher).
- [x] [CC] **Rendu « satellite » = pyramide de tuiles** (décision 2026-07-17,
  demande utilisateur type WyriMaps/wowcarto) : `UniverseMap` mode `tiles`
  ({z}/{x}/{y} CRS.Simple, sur-zoom au-delà du natif), `make-tiles.mjs`
  (image assemblée → pyramide WebP → bucket, recadrage sur cadre uiMap),
  `tilelib.mjs` pur testé (solveFrame moindres carrés).
- [x] [CC+TOI] **Cartes satellite HD LIVE 2026-07-18** : exports minimap
  wow.export de l'utilisateur (qualité minimap 512/tuile ADT) → `assemble-tex.mjs`
  (stitch des tex_X_Y.png) → cadre uiMap calculé **automatiquement** depuis
  `UiMapAssignment` du client 2.5.6 (wago.tools, constantes `WOW_UIMAP_FRAMES`
  dans tilelib — AUCUNE calibration manuelle) → 2×3 697 tuiles (16384px, Z=6,
  ~10 Mo). Alignement vérifié en jeu : étoile pile sur Orgrimmar/Tirisfal aux
  coords monde calculées. Rotation d'univers corrigée (saute les univers sans
  spots — Curioscope + CurioChallengeModal). Client = **WoW Anniversary
  (TBC 2.5.6)** : addon Interface 20506, Outland mappé (univers wow_outremonde
  à créer plus tard), zones map 530 (Quel'Thalas/Azuremyst) absentes du
  stitch — à incruster un jour depuis l'export expansion01.
- Outillage annexe : bug wow.export 0.2.19 patché localement (builds CDN
  undefined — 3 gardes dans src/app.js), wow.export installé
  `C:\CurioscopeAssets\tools\wow.export\`.
- **[TOI]** Sessions de capture : **vague 1 = 150-200 spots** (seuil de lancement),
  puis croisière **300-500** au fil de l'année ; équilibrés par zone/difficulté
  (1 = monument unique, 5 = nature anonyme ; Alt+Z, pas d'UI/minimap/nom de joueur).
  Repères genre : Where in Warcraft ≈ 1 000 lieux en 6 ans (plafond artisanal) ; une
  séance de classe expose ~10-20 spots au TBI (grillés pour toute la classe) → 200
  spots ≈ un trimestre, 300-500 ≈ l'année. Rythme mesuré : 20-40 spots/h de jeu.
- **[TOI]** Par session : copier screenshots + `CurioSnap.lua` dans
  `C:\CurioscopeAssets\wow\session-N\` → `parse-snaps` → éditer le CSV
  (labels/difficulté) → `build-spots` (README étapes 3-4).
- **[TOI]** Calibrer `score.k`/`freeDist` en jouant (README étape 5).

### P4 — Panoramas 360°
- [CC] `render: 'pano'` + Photo Sphere Viewer intégré au moteur (flat et pano cohabitent).
- **[TOI]** WoW : PanoShot + Hugin sur ~10-20 lieux emblématiques.
- [CC] Monde réel : source Mapillary `is_pano` (script de sélection + attribution CC-BY-SA).

### P5 — Extension du catalogue + confort
- [CC] Univers Terre du Milieu (tuiles GPL récupérables directement) puis GTA V (tuiles
  MIT) — quasi gratuit une fois le moteur en place.
- [CC] Éditeur de spots in-game (aperçu image, repositionnement du point, actif/difficulté).
- (V3 éventuel) tuiles zoom profond, anti-triche online (vue publique + RPC), mode
  téléphone-manette pour placer le pin au doigt.
