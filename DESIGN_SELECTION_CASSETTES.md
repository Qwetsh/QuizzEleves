# Brief design — Écran de sélection « Lecteur de cassettes »

> **Pour :** Claude Design.
> **Objet :** maquetter l'écran de **sélection des thèmes d'une partie** du jeu de quiz « Curioscope ».
> **Statut :** brief autonome. Tout le contexte nécessaire est ici.
> **Hors périmètre :** la logique de jeu, la base de données, et la géométrie réelle du plateau (cases, déplacements). On ne maquette QUE l'écran de sélection et ses états.

---

## 1. Le concept en une phrase

On choisit les thèmes d'une partie comme on chargeait une chaîne hi-fi dans les années 90 : une **étagère de cassettes** (chaque cassette = un thème) et un **lecteur** dans lequel on **insère les cassettes**. Chaque cassette insérée devient une « voie » du plateau, et **le plateau se déroule en direct** à mesure qu'on charge.

**Objectif d'expérience :** cet écran est projeté en grand devant un groupe (classe ou salon). Il doit donner **envie de jouer avant même de jouer** : tactile, nostalgique, vivant. Le **clunk** de l'insertion, le deck qui tourne, le plateau qui s'assemble = le spectacle.

---

## 2. Principe d'architecture visuelle (à respecter absolument)

On sépare deux couches :

- **LE CHÂSSIS = à dessiner par toi** (vectoriel / composants interactifs) : le **lecteur**, l'**étagère**, les **slots**, les boutons, l'aperçu du plateau, le header. C'est ce qui s'anime et réagit.
- **LES JAQUETTES = des emplacements-images** (slots) remplis plus tard par des illustrations générées séparément. **Ne dessine pas les jaquettes en dur** : prévois des **cadres-images vides** au bon ratio, avec un placeholder.
- **LE TITRE DU THÈME = une couche de texte** par-dessus la jaquette (jamais dans l'image). Le jeu est **bilingue FR/EN** : le titre doit pouvoir changer de langue sans toucher l'image. Réserve donc une **bande de titre** en haut de chaque cassette.

> Règle d'or : **jaquette = image muette dans un slot ; titre = texte overlay.**

---

## 3. Anatomie de la page — posture « Scène » (TBI plein écran + écran principal)

Layout de référence (les proportions exactes sont à ton appréciation) :

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER : [logo]   « La Quête des … »  (titre auto-généré)    [▶ LANCER] │
├───────────────────────────────────────────┬──────────────────────────┤
│ ÉTAGÈRE  (zone principale, défile horiz.)  │  LECTEUR (la machine)     │
│                                            │  ┌─────────────────────┐  │
│  ┌ DIVERTISSEMENT ┐ ┌ SPORT ┐ ┌ SCIENCES ┐ │  │ slot 1 : ▮ Séries    │  │
│  │ ⭐ INTÉGRALE     │ │ ⭐...  │ │ ⭐...      │ │  │ slot 2 : ▮ (vide)    │  │
│  │ │Séries│Cinéma│  │ │       │ │           │ │  │ slot 3 : ▮ (vide)    │  │
│  │ │·Friends·(imp.)│ │       │ │           │ │  │ slot 4 : ▮ (vide)    │  │
│  └────────────────┘ └───────┘ └───────────┘ │  └─────────────────────┘  │
│  ┌ 🏛 SCOLAIRE ┐ ┌ 📼 IMPORTS ┐ …            │  (slots = voies du plateau)│
├───────────────────────────────────────────┴──────────────────────────┤
│ APERÇU DU PLATEAU : un ruban/serpentin qui s'allonge à chaque cassette │
│ chargée (chaque voie = une couleur de domaine).                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Les zones
1. **Header** — titre de partie généré à partir des cassettes choisies (placeholder « La Quête des … ») + bouton **LANCER** (désactivé tant qu'aucune cassette n'est chargée).
2. **Étagère** — la zone principale. Organisée en **rayons par domaine** (façon bac de disquaire / vidéoclub), avec un **intercalaire** par domaine (nom + emblème + couleur de biome). Défile horizontalement.
3. **Lecteur (machine)** — à droite. Une rangée de **slots** (3 à 6). Chaque slot accueille **une cassette** = **une voie**. Slots vides visibles et invitants.
4. **Aperçu du plateau** — en bas. Un ruban stylisé qui **s'allonge** quand on charge une cassette. Pas la vraie géométrie du jeu : juste une promesse visuelle (« voici le monde que tu construis »).

---

## 4. Les emplacements d'images (slots) — où laisser la place

| Slot | Ratio | Où | Notes |
|------|-------|-----|-------|
| **Cassette — face pleine** | **3:2 paysage** | Étagère (au survol/sélection), Lecteur | Le visuel principal. Bande de titre réservée **en haut** (~18 % de la hauteur) pour le texte overlay. |
| **Cassette — tranche (spine)** | **~1:5 vertical** (fine) | Étagère (état rangé) | Vue « rangée dans le bac ». Peut être un simple bandeau couleur + mini-emblème, pas forcément une image générée. |
| **Cassette INTÉGRALE** | 3:2 paysage | Tête de chaque rayon | Look **doré / deluxe**, badge « best of ». Même bande de titre. |
| **Cartouche scolaire** | **~4:3** (objet plus trapu) | Rayon SCOLAIRE | Objet différent (cartouche console + switch). Voir §6. |
| **Emblème de domaine** | carré 1:1 | Intercalaire de rayon | Petit pictogramme. |
| **Aperçu plateau** | libre | Bas de page | Châssis vectoriel, pas une image générée. |

> Pour CHAQUE slot image : mets un **placeholder gris** au bon ratio + une étiquette « [jaquette: ratio 3:2] ». Réserve **la bande de titre** par-dessus (rectangle semi-opaque où viendra le texte FR/EN).

Dimensions indicatives (desktop) : cassette face ≈ **300 × 200 px**, spine ≈ **40 × 200 px**. À adapter via un système d'échelle.

---

## 5. Le geste central : insérer / charger

- **Étagère → Lecteur** : on **fait glisser** (TBI/souris) ou on **tape** une cassette → elle file dans un slot, le deck « tourne », l'aperçu du plateau gagne une voie.
- **Trois niveaux d'insertion** (la hiérarchie des thèmes) :
  - **INTÉGRALE** (tête de rayon, dorée) = voie **large** (tout le domaine, version « tubes »).
  - **Cassette normale** = voie **thème** (ex. Séries).
  - **Cassette d'import** (section IMPORTS) = voie **pointue** (ex. Friends).
- **Exclusion** : après avoir chargé une INTÉGRALE, on peut **éjecter** une sous-cassette d'un tap → elle passe en **rouge « EJECT »** (ex. « Sciences sauf Maths »). État à maquetter.

---

## 6. Objets spéciaux à dessiner

- **INTÉGRALE** : cassette **dorée/foil**, badge starburst « best of », posée en **tête de rayon**, visuellement au-dessus des autres. = la voie large d'un domaine.
- **Cartouche scolaire** : le domaine SCOLAIRE n'est PAS une cassette musicale mais une **cartouche de console rétro**, trapue, avec un **switch 3 positions** sur le côté : **Cycle 3 / Cycle 4 / Lycée**. Elle expose aussi des **onglets-matières** (Français, Maths, Histoire-Géo, SVT, …). C'est l'objet « à part » assumé. État avec le switch sur chaque position à prévoir.
- **Cassette d'import / bootleg** : jaquette **faite-main / photocopiée**, sticker de coin, légèrement de travers. Rangée dans un rayon **IMPORTS** distinct. = contenu communautaire (packs).
- **Cassette « usée »** (avertissement) : une tape grisée/grésillante = thème avec trop peu de questions pour faire une voie seule. État désactivé à prévoir.

---

## 7. Les états à maquetter (livrables)

1. **Repos / browse** — l'étagère pleine, le lecteur vide, bouton LANCER désactivé.
2. **Une cassette en cours d'insertion** — transition cassette → slot, deck qui tourne, première voie qui apparaît dans l'aperçu plateau.
3. **Plusieurs voies chargées** — 3-4 slots remplis, plateau bien déroulé, LANCER actif, titre de partie généré.
4. **Exclusion / EJECT** — une INTÉGRALE chargée avec une sous-cassette éjectée (rouge).
5. **Cartouche scolaire** — le switch de cycle visible, onglets-matières.
6. **Cassette usée** (avertissement de viabilité).

---

## 8. Les trois postures (responsive) — IMPORTANT

Le même écran doit fonctionner dans **trois contextes**. Ce n'est pas trois UI : c'est **une scène, trois densités/entrées**.

### 8.a Posture « Scène » — TBI plein écran + TV (écran principal d'un salon)
- Lisible **de loin** : gros repères, peu de texte, couleurs franches.
- Entrée **tactile** (TBI) **ou** focus navigable au **clavier/flèches** (cas TV pilotée à distance).
- C'est le layout du §3.

### 8.b Posture « Atelier » — Online sur ordinateur (lecture proche)
- Même scène, mais on **densifie** : ajoute un **panneau latéral** avec :
  - la liste claire du **périmètre** (cassettes chargées / exclues),
  - une **recherche** de thème,
  - (plus tard) des **filtres de facette** (zone : France/Europe/Monde ; époque) façon **boutons d'égaliseur** sur la machine,
  - des **infobulles au survol**.
- Le survol est permis ici (contrairement au tactile).

### 8.c Posture « Command deck » — mobile (l'hôte pilote, mode salon)
En mode **salon**, la **TV** affiche la Scène et le **téléphone de l'hôte** sert de **télécommande**. Le téléphone ne montre PAS la grande carte : il montre un **deck de commande** rapide au pouce.

```
┌────────────────┐
│  La Quête des…  │
├────────────────┤
│ CHARGÉES :      │  ← voies déjà mises (mini-slots)
│ [Séries] [ + ]  │
├────────────────┤
│ Rayons : (tabs) │
│ Divert │ Sport… │
│ ┌────────────┐  │
│ │ ⭐ Intégrale │  │  ← cartes-cassettes, TAP = charger
│ │ Séries      │  │
│ │ Cinéma      │  │
│ └────────────┘  │
├────────────────┤
│   [ ▶ LANCER ]   │
└────────────────┘
```
- Cartes-régions verticales, couleur de biome, gros boutons au pouce.
- L'illustration de jaquette peut être réduite à une **vignette** ; l'important est la rapidité.

---

## 9. Direction artistique

- **Style global : illustration plate rétro années 90.** Aplats, formes nettes, contours marqués, palette chaude (crème, orange brûlé, turquoise, moutarde, rouge éteint). Pas de dégradés lourds, pas de 3D, pas de photoréalisme.
- **Le lecteur** : une **chaîne hi-fi / boombox des années 90** stylisée (boutons chunky, VU-mètres, LED, fente d'insertion bien visible). C'est l'**ancre constante** de la page.
- **L'étagère** : bois / plastique d'époque, **intercalaires** par domaine type bac de disquaire.
- **Le titre de partie** : typo rétro façon menu VHS / cartouche.
- **Cohérence** : la machine et l'étagère restent identiques quel que soit le thème ; seules les **jaquettes** apportent la variété.

---

## 10. Détails d'interaction à garder en tête (même si l'anim vient après)

- **Cibles tactiles généreuses** (TBI + mobile).
- **Navigation au focus** possible sans souris (clavier/flèches) pour la TV et l'accessibilité.
- **Aperçu d'un thème** : au **survol** (desktop) **ou** au **tap maintenu** (tactile) — prévoir les deux déclencheurs.
- **LANCER** désactivé tant qu'aucune voie n'est chargée.
- **Un seul opérateur** compose la partie (prof / hôte / joueur) ; les autres ne font que regarder/rejoindre.

---

## 11. Ce qu'on NE maquette PAS ici
- La vraie géométrie du plateau (cases, embranchements, déplacements) — l'aperçu en bas est purement évocateur.
- Les écrans de jeu (questions, dé, scores).
- La création des illustrations de jaquettes (faite séparément ; ici ce sont des slots).
```
