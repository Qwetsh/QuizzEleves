# DESIGN — Cartes peintes (« maps v2 »)

> Objectif : passer du plateau procédural actuel (île sable/herbe + props détourés) à des cartes
> de qualité illustrée type « board game AAA » (réf. : image château/nuit fournie le 2026-07-05),
> avec plusieurs univers de cartes et des chemins visuellement liés aux thèmes des questions.

---

## 1. Verdict de faisabilité (l'objectif, confronté au réel)

### Ce qui est objectivement réalisable
| Attente | Faisable ? | Comment |
|---|---|---|
| Qualité visuelle de l'image de référence | ✅ Oui | L'image de réf. est elle-même le rendu typique d'un modèle image actuel. Une illustration **peinte d'un seul tenant** garantit la cohérence (lumière, style, absence de coutures). |
| Plusieurs cartes / univers | ✅ Oui | Un « set » de chunks par univers (château, île, village…), style verrouillé par référence de style. |
| Chemins visuellement thématisés | ✅ Oui, avec un compromis | Biomes **peints** pour un petit nombre de thèmes majeurs (les 6 matières + qq gros thèmes culture G) ; pour les 46+ thèmes arbitraires : chunk neutre + **habillage dynamique** (bannière, props détourés, médaillon coloré). |
| Fusion parfaite des assets | ✅ Oui | En ne fusionnant **rien au runtime** : chaque morceau peint est un îlot détouré posé sur un fond d'eau/forêt commun (exactement la composition actuelle). Les seuls éléments dynamiques par-dessus sont des overlays qui « flottent » naturellement (médaillons, bannières, pions). |
| Longueurs de plateau variables | ✅ Oui, en changeant d'approche | La longueur ne se règle plus au curseur près : **nbSections = nombre de chunks posés**. À l'intérieur d'un chunk, le nombre de cases varie en occupant un sous-ensemble des ancres (les pointillés de chemin sont peints en continu, les médaillons se posent sur N d'entre eux — c'est exactement ce que montre l'image de réf.). |

### Ce qui n'est PAS réaliste (à abandonner tout de suite)
1. **Générer la carte peinte au runtime** selon la config de la partie. Les API image sont trop
   lentes/chères/imprévisibles pour un usage en classe, et on perdrait tout contrôle qualité.
   → Tout est **pré-produit offline**, le runtime ne fait qu'assembler.
2. **Une illustration unique qui s'adapte à toute géométrie** (2 ou 3 voies, 4 à 8 cases, 2 à 4
   sections…). Une image figée = géométrie figée. → On fige des **gabarits** et on compose.
3. **Un décor peint unique pour chacun des 46+ thèmes** (×univers ×gabarits = explosion
   combinatoire d'assets). → Biomes peints réservés aux thèmes « piliers », habillage dynamique
   pour le reste.
4. **Faire « fusionner » par IA des assets générés séparément** (raccorder deux images aux bords).
   L'inpainting de raccord marche mal, se voit toujours un peu, et ne passe pas à l'échelle.
   → Principe d'architecture : **jamais de couture image-image**. Les jonctions entre chunks sont
   des ponts/portails posés SUR l'eau (élément détouré qui chevauche les deux rives, comme un pion
   chevauche une case).

---

## 2. Architecture retenue : « îlots peints » + overlays dynamiques

C'est une évolution directe de la composition actuelle (île gooey sur fond d'eau), pas une rupture.

```
┌────────────────────────────────────────────────────────────┐
│  Couche 0 — fond commun (texture eau/forêt/brume, tuilé)   │  ← par univers
│  Couche 1 — chunks peints détourés (PNG/WebP alpha)        │  ← pré-produits
│      [chunk départ] ─pont─ [chunk section] ─pont─ … [fin]  │
│  Couche 2 — habillage thème (bannières, props détourés)    │  ← dynamique, posé sur des slots
│  Couche 3 — médaillons de cases (case-{theme} / fallback)  │  ← dynamique (système actuel)
│  Couche 4 — pions, pièges, surlignage de choix, VFX        │  ← système actuel inchangé
└────────────────────────────────────────────────────────────┘
```

### 2.1 Anatomie d'un chunk
Un chunk = **1 section de jeu** (l'équivalent d'un bloc `jin → voies → jout` du générateur actuel).

- **Image** : illustration détourée (bords organiques : falaise, muraille, rivage), ~2048×1200 px,
  WebP. Peinte avec : les chemins en pointillés/pavés continus, les zones de voies, des zones de
  respiration (placettes, jardins) et des **zones réservées vides** aux emplacements des slots.
- **`mapDef` JSON** (produit par l'outil de calibration, § 5.3) :
  ```js
  {
    id: 'chateau_s3v_01',        // univers _ gabarit _ variante
    img: 'chunk-chateau-01.webp',
    size: { w: 2048, h: 1200 },
    gabarit: '3v',               // 3 voies (seul gabarit en v1)
    in:  { x: 12,   y: 600 },    // point de jonction d'entrée (bord ouest)
    out: { x: 2036, y: 600 },    // point de jonction de sortie (bord est)
    lanes: [                      // 1 lane = 1 voie ; ancres ordonnées ouest→est
      { anchors: [{x,y}, …8],  bannerSlot: {x,y}, propSlots: [{x,y,r}, …3] },
      { anchors: [{x,y}, …8],  bannerSlot: {x,y}, propSlots: […] },
      { anchors: [{x,y}, …8],  bannerSlot: {x,y}, propSlots: […] },
    ],
    biome: 'neutre' | 'scriptorium' | 'sport' | …   // identité peinte éventuelle
  }
  ```
- **8 ancres par voie, on en occupe 4 à 8** : le moteur choisit un sous-ensemble régulier
  (ex. 6 cases → ancres 1,2,3,5,6,8 ou espacement calculé). Les ancres inutilisées restent des
  pavés décoratifs du chemin peint — aucun trou visuel. C'est le mécanisme qui absorbe
  `casesParVoie` sans multiplier les images.

### 2.2 Composition d'une carte au démarrage
1. La config donne `nbSections` → on tire N chunks du set de l'univers choisi (sans doublon).
2. On pose : `[chunk départ] + N×[chunk section] + [chunk arrivée]`, alignés sur `in`/`out`
   (même y standardisé, ex. 600), espacés d'un gap d'eau fixe (~380 px).
3. Entre deux chunks : un **asset pont** (détouré, chevauche les deux rives) portant 1 à 4 ancres
   → ce sont les cases « couloir mix » actuelles. Variantes de pont par univers (pont-levis,
   passerelle de bois, gué…). Le pont absorbe `couloirsMix`.
4. Le graphe logique (`nodes` avec `next`) est construit **depuis les ancres** : mêmes types
   qu'aujourd'hui (`depart/jonction/subject/event/arrivee`), donc **pathfinding, pièges, duels,
   events, caméra, pions : zéro changement moteur**. Seul le calcul des x/y change de source.
5. `eventEveryX` : inchangé (retypage de cases en `event` après coup — le médaillon coffre est un
   overlay, l'image peinte n'a pas besoin de le savoir).

### 2.3 Voies et thèmes
- **Gabarit unique en v1 : 3 voies.** Le générateur actuel recharge déjà le pool quand
  la sélection < nbVoies (boardGenerator.js:73-77) → une partie à 2 thèmes remplit la 3e voie
  par répétition ou `multi`. On ne produit PAS de gabarit 2 voies en v1 (÷2 le coût d'assets).
- **Attribution voie→thème** : comme aujourd'hui (pool mélangé par section).
- **Habillage dynamique par voie** (couche 2) :
  - le **médaillon** `case-{themeKey}` (système existant, fallback cercle+emoji) ;
  - une **bannière/étendard** aux couleurs+icône du thème posée sur `bannerSlot` — à générer en
    template neutre (bannière vierge) + composition SVG (teinte + icône du thème par-dessus) →
    couvre TOUS les thèmes présents et futurs sans nouvel asset ;
  - 2-3 **props détourés** du thème sur `propSlots` (le catalogue `SUBJECT_PROPS` existe déjà pour
    les 6 matières ; extensible thème par thème, mais optionnel : bannière + médaillons suffisent
    à identifier une voie).
- **Chunks à biome peint** (le « rêve » chemin-sport-visuel-sport) : pour les piliers uniquement.
  Un chunk biome a ses 3 voies peintes dans 3 ambiances (ex. château : bibliothèque / observatoire /
  cour d'armes). Au tirage, si un thème sélectionné matche un biome disponible dans le set, le
  moteur privilégie ce chunk et **épingle la voie au thème** (mapping `lane.biomeHint = themeKey`).
  Sinon chunk neutre + habillage. → Le rêve est atteint pour les matières scolaires, approché
  partout ailleurs, et rien ne casse quand un thème n'a pas de biome.

### 2.4 Ce que devient l'existant
- `BoardSVG.jsx` : conservé. On ajoute un **mode `map`** (couches 0-2 = `<image>` posées, plus de
  filtre gooey ni pierres de gué procédurales) à côté du mode `procedural` (legacy, inchangé,
  reste le fallback et le mode « aléatoire infini »).
- `boardGenerator.js` : conservé. Nouveau module `mapComposer.js` qui produit la MÊME structure
  `{ nodes, viewBox }` (+ `decorLayers` pour les couches 0-2) → tout l'aval est indifférent.
- `decorGenerator.js` : non utilisé en mode map (le décor est peint). Reste pour le legacy.
- Persistance : la save stocke `mapId + seed de composition` (ou la liste des chunks tirés),
  comme `boardDecor` aujourd'hui.

---

## 3. Pipeline de production des assets (méthode IA)

### 3.1 Outils recommandés (état mi-2026)
| Besoin | Outil | Pourquoi |
|---|---|---|
| Génération des chunks | **Midjourney v7** (`--sref` + `--oref`) ou **Flux + ControlNet** (ComfyUI local) | MJ = meilleure DA/cohérence de style entre images via style reference ; Flux+ControlNet = contrôle exact du tracé des chemins depuis le blockout. Combo gagnant : MJ pour trouver le style, Flux pour la production contrôlée. |
| Édition localisée / retouches | **Gemini image (« nano-banana »)** ou Photoshop Generative Fill | « change cette zone en jardin, garde tout le reste » — c'est LE bon usage de l'édition IA (jamais pour raccorder deux images). |
| Upscale | Magnific / Topaz Gigapixel / 4x-UltraSharp (gratuit, ComfyUI) | Générer à ~1024-1536 de large puis ×2. |
| Détourage | Photoshop / rembg + retouche manuelle des bords | Bords organiques (rivage, muraille) = détourage facile et pardonnant. |
| Compression | `cwebp -q 82` | ÷5 à ÷10 vs PNG. Objectif ≤ 500 Ko/chunk. |

Budget indicatif : MJ ~10 €/mois suffit ; Flux local gratuit si GPU, sinon ~0,03 €/image via API.
Le coût réel est le **temps de curation** (générer 8, garder 1, retoucher).

### 3.2 Procédure par chunk (une fois le pipeline rodé : ~45 min/chunk)
1. **Style bible de l'univers** (une fois par univers) : 3-4 images de référence validées
   (palette, heure du jour, épaisseur des traits) → `--sref` / LoRA maison. C'est ce qui garantit
   que chunk 1 et chunk 7 semblent peints par la même main.
2. **Blockout** : croquis grossier (même à la souris) : masses du chunk, tracé des 3 chemins,
   zones vides réservées aux slots. → entrée ControlNet (scribble/depth) ou image de départ img2img.
3. **Génération** : 6-10 candidats, garder le meilleur. Contraintes de prompt systématiques :
   vue top-down ¾ cohérente avec le reste, chemins en pavés clairs **continus et lisibles**,
   PAS de personnages, PAS de texte, zones de respiration là où le blockout les met.
4. **Retouche** par inpainting : effacer les artefacts, vider les zones de slots, ouvrir
   l'entrée/sortie du chemin pile sur les points `in`/`out` standardisés.
5. **Upscale ×2 → détourage → WebP.**
6. **Calibration** dans l'outil in-app (§ 5.3) : cliquer les 24 ancres + slots → export JSON.
7. **Check qualité** : superposer médaillons + pions dans l'outil → contraste suffisant ?
   médaillon lisible sur le chemin ? ancres espacées ≥ ~110 px ?

### 3.3 Règles de « fusion » visuelle (pourquoi ça ne jurera pas)
- Un seul **soleil** par univers (direction de lumière notée dans la style bible, ex. NO→SE) :
  les ombres des chunks, ponts et props détourés vont toutes dans le même sens.
- Les overlays dynamiques (médaillons, bannières) sont **conçus comme des objets posés** :
  ombre portée douce intégrée à l'asset → ils flottent légitimement sur n'importe quel fond.
  (C'est exactement ce que fait l'image de référence : ses médaillons sont des jetons posés.)
- Le fond commun (eau/brume) est sombre et peu détaillé → il désature les transitions.
- Interdit : dégradé image-vers-image, raccord de textures entre deux fichiers.

### 3.4 Volumes v1 (premier univers jouable)
| Asset | Quantité | Notes |
|---|---|---|
| Chunk départ + arrivée | 2 | petits (~1200×1000) |
| Chunks section neutres | 4 | rejouabilité : tirage de 2-4 parmi 4 |
| Chunks section à biomes | 2 | 3 biomes peints chacun → couvre les 6 matières scolaires |
| Ponts | 3 variantes | 1-4 ancres |
| Bannière template + fond | 2 | bannière vierge teintable + texture eau/brume |
| **Total** | **~13 images** | ~4-6 Mo en WebP — moins lourd que les 32 Mo actuels |

Univers suivants : re-dérouler § 3.2 avec une nouvelle style bible (~2-3 soirées/univers).

---

## 4. Gestion des longueurs et de la variabilité (récap)

| Paramètre actuel | Devient |
|---|---|
| `nbSections` (2-4) | Nombre de chunks tirés. Inchangé côté UI. |
| `casesParVoie` (4-8) | Sous-ensemble des 8 ancres par voie. Inchangé côté UI. |
| `nbVoies` (2-3) | **Figé à 3 en mode map** (le pool de thèmes recharge si < 3). Le curseur reste actif en mode procédural. |
| `couloirsMix` (2-4) | Nombre d'ancres du pont utilisé. Plafonné à 4. |
| `voieFinale` court-long | v1 : voie unique peinte dans le chunk d'arrivée. v2 : chunk d'arrivée à 2 branches (une image dédiée). |
| Voie aléatoire / socle rose des vents | Peints dans les chunks départ/arrivée de chaque univers. |

---

## 5. Plan de réalisation

### Phase 0 — Prototype de dérisquage (À FAIRE EN PREMIER, ~1 soirée + 1 session)
> But : valider la qualité ET la chaîne complète sur UN chunk avant tout investissement.
1. Générer 1 chunk neutre univers « château » (§ 3.2, sans outil de calibration : ancres notées à
   la main dans un JSON).
2. Brancher en dur dans BoardSVG (spike, branche jetable) : fond + chunk + médaillons existants
   + pions par-dessus.
3. Jouer 2 tours. Critères de sortie : lisibilité TBI à 3 m, contraste médaillons, pas de malaise
   visuel médaillon/décor, perf OK.
   **Si le rendu déçoit ici, on ajuste la DA avant d'écrire le moindre moteur.**

### Phase 1 — Moteur `mapComposer` + mode map de BoardSVG (~2-3 sessions)
- `src/logic/mapComposer.js` : `composeMap(mapSet, params) → { nodes, viewBox, layers }`
  (mêmes `nodes` que le générateur ; tests unitaires miroir de `boardGenerator.test.js`).
- `BoardSVG` mode `map` : rendu couches 0-2, suppression gooey/pierres/decorGenerator dans ce mode.
- Persistance : `mapId` + composition dans la save ; fallback legacy si set indisponible.
- Setup : choix « Carte : Château / Aléatoire (classique) » (mock si Phase 4 pas prête).

### Phase 2 — Outil de calibration (~1 session)
- Composant DEV `MapCalibrator` (route `?calibrate`) : charge une image, clic = ancre typée
  (case / in / out / banner / prop), drag pour ajuster, aperçu médaillons+pion à l'échelle,
  export JSON presse-papiers. Sans lui, chaque chunk coûte 30 min de coordonnées à la main.

### Phase 3 — Habillage thème dynamique (~1-2 sessions)
- Bannière teintable : template + `<g>` SVG (teinte `color`, icône du thème) posé sur `bannerSlot`.
- `propSlots` : réutilise `SUBJECT_PROPS` (catalogue par thème, optionnel, extensible plus tard).
- Épinglage biome→thème (`lane.biomeHint`).

### Phase 4 — Production du set « Château » (~3-4 soirées, hors code)
- Style bible → 13 assets (§ 3.4) → calibration → recette qualité § 3.2.7 sur chacun.

### Phase 5 — Intégration finale + perf (~1 session)
- Choix de carte au Setup (vignettes), WebP + `loading` différé des chunks hors viewport initial,
  vérif TBI plein écran, E2E, MAJ BoardPreview (silhouette de la carte choisie).

### Ensuite (backlog, non bloquant)
- Univers 2 (île tropicale) et 3 ; chunk d'arrivée à 2 branches (court/long) ; biomes culture G
  (cinéma, jeux vidéo…) ; props par thème ; événements météo re-skinnés par univers ;
  éditeur de carte pour toi (drag de chunks).

---

## 6. Risques et parades
| Risque | Prob. | Parade |
|---|---|---|
| Style dérive entre chunks (générés à des semaines d'écart) | Haute | Style bible + `--sref` figé + garder les prompts dans `assets/maps/<univers>/PROMPTS.md`. |
| Chemins peints illisibles / IA qui « ferme » un chemin | Moyenne | Blockout + ControlNet (pas de génération libre) ; check § 3.2.7. |
| Médaillons qui jurent sur fond très détaillé | Moyenne | Halo/ombre portée intégré au médaillon ; zones de chemin peintes claires et peu chargées (contrainte de prompt). |
| Perf TBI (grosses images) | Faible | WebP ≤ 500 Ko/chunk, total < 6 Mo ; c'est MOINS d'éléments SVG qu'aujourd'hui (exit gooey + 2500 nœuds). |
| Combinatoire d'assets qui explose | Faible si discipline | Gabarit unique 3 voies, biomes réservés aux piliers, bannières = template teintable. |
| Config figée frustrante (nbVoies) | Faible | Mode procédural conservé tel quel comme option. |

## 7. Décisions déjà prises / à confirmer
- ✅ Architecture îlots + overlays, jamais de couture image-image.
- ✅ Gabarit unique 3 voies en v1 ; legacy conservé.
- ⬜ Univers de lancement (proposition : Château — la réf. visuelle existe déjà).
- ⬜ Outil de génération principal (MJ seul suffit pour commencer ; Flux+ControlNet si le contrôle
  du tracé s'avère nécessaire dès la Phase 0).
- ⬜ Ambiance jour/nuit par univers (la réf. est nocturne — superbe mais vérifier lisibilité TBI
  en salle éclairée, à trancher en Phase 0).
