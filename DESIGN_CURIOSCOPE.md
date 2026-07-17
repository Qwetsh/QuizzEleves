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
| Screenshots bruts, journaux CurioSnap, projets Hugin, exports wow.export | `C:\CurioscopeAssets\` (hors repo, **hors OneDrive** — des Go regénérables, la sync OneDrive serait pénible) | Zone de travail locale |
| Images de spots finales (redimensionnées 1600 px, JPEG q82, ~150-250 Ko) | Supabase Storage, bucket **`quete-spots`**, noms opaques `s-<uuid>.jpg` (anti-triche, pattern `quete-questions`) | C'est aussi la sauvegarde durable |
| Cartes continentales (1 image/continent) | Supabase Storage `quete-spots/maps/` | 3-5 Mo pièce, chargées 1×/partie |
| Métadonnées spots | Table `quete_spots` (PersoDB) | DB = source de vérité |
| Scripts pipeline + addon Lua + `universes.js` | Repo git (`scripts/curioscope/`) | Léger, versionnable |

Budget : 60 spots ≈ 15 Mo, 300 spots + 30 panos ≈ 150 Mo — très loin du 1 Go du tier
gratuit Supabase.

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

### P1 — Moteur générique + univers « monde réel » (aucun asset à produire)
- [CC] `npm i leaflet react-leaflet` ; composant `UniverseMap` (CRS.Simple, imageOverlay
  ou crs geo, zoom/pan, pose de pin, affichage révélation pins+réel+distances).
- [CC] `src/data/universes.js` + généralisation scoring (métrique + K par univers).
- [CC] Moteur `Curioscope.jsx` branché sur `PlacementDuel` (commit-reveal conservé),
  entrée `curioscope` dans `ENGINES`/`THEME_MINIGAMES`.
- [CC] Migration du GeoDuel monde réel comme univers `monde_reel` (les 90+ lieux de
  `placementData.jsx` deviennent des spots) — le moteur est prouvé sans rien capturer.
- [CC] Tests + E2E duel.
- **[TOI]** Valider l'UX en jeu (zoom, pin, révélation) sur le TBI.

### P2 — Déclenchement par effet + conversion points
- [CC] Action `startMinigame` dans `effectEngine.js` (suspend/resume), mode
  solo-challenge, table `convert` points→actions.
- [CC] Câblage éditeur d'objets/événements (phrase à trous) + `effectText` + glossaire.
- **[TOI]** Décider 2-3 objets/événements d'exemple et leurs barèmes.

### P3 — Univers World of Warcraft
- [CC] Génération de l'addon **CurioSnap** (`.toc` + `.lua`, journal SavedVariables
  horodaté — spec §1 du brouillon initial, validée).
- **[TOI]** Copier le dossier addon dans `Interface/AddOns/`, vérifier le message chat
  au premier screenshot (`/reload` en fin de session pour flusher).
- **[TOI]** Installer wow.export ; exporter la carte stitchée (ou tuiles minimap) de
  Kalimdor et des Royaumes de l'Est → déposer dans `C:\CurioscopeAssets\maps\`.
- [CC] Script assemblage/redimensionnement carte (~4096 px) + upload Storage.
- [CC] Extraction HereBeDragons → `zone-transforms.json` (mapID → width/height/left/top).
- **[TOI]** Sessions de capture : 30-60 spots équilibrés par zone/difficulté
  (1 = monument unique, 5 = nature anonyme ; Alt+Z, pas d'UI/minimap/nom de joueur).
- **[TOI]** Récupérer `Screenshots/` + `WTF/.../SavedVariables/CurioSnap.lua` →
  `C:\CurioscopeAssets\wow\session-N\`.
- [CC] Pipeline `scripts/curioscope/` : parseur Lua→CSV (appariement par timestamp),
  conversion zone→continent, resize 1600 px JPEG q82, upload bucket `quete-spots`,
  insert `quete_spots`.
- [CC] Thème de duel `curioscope_wow` + univers mixte/aléatoire.
- **[TOI]** Calibrer `scoreK` en jouant (départ : largeur_carte/8).

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
