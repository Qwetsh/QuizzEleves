# DESIGN — Enrichir les questions par des API (données → base)

But : atteindre une **profusion** de questions sur tous les thèmes, en **extrayant une
fois** des API publiques vers **notre base** (comme les drapeaux), puis en ne lisant
plus que Supabase en jeu. Aucune dépendance réseau externe au runtime.

## 1. Principe d'architecture (pattern « drapeaux »)

Pour chaque source, un script `scripts/seed-*.mjs` (lancé **à la main**, hors du jeu) :
1. **fetch** l'API une fois → **télécharge** les médias (images/sons) → **ré-héberge**
   dans le bucket Supabase `quete-questions` avec des **noms opaques** (anti-triche :
   l'URL ne doit jamais trahir la réponse) ;
2. **insère** des lignes `quete_questions` (énoncé, réponses, `img`/`a_img`, `render`,
   futur `audio`).

En partie, le jeu ne lit **que** `quete_questions` + le Storage. Les thèmes du pool
passent par le fallback `getSubjectPool(subject)` (déjà en place), donc aucun câblage
moteur par thème.

⚠️ **Limite juridique unique** : la **musique grand public** (Deezer/Spotify). Les
extraits 30 s existent mais leurs CGU **interdisent** le ré-hébergement/usage en jeu.
→ Pas de blind-test chansons. En revanche **hymnes, cris d'animaux, prononciations**
viennent de sources **libres** (Wikimedia Commons, xeno-canto) et sont ré-hébergeables.

## 2. Le moteur central : Wikidata (SPARQL)

`https://query.wikidata.org/sparql` — **sans clé, gratuit, CC0, libellés FR**. Couvre
~60 % des thèmes (capitales, œuvres↔auteurs, éléments, souverains, espèces, records…).
Une requête sort les faits + permet de tirer des **distracteurs futés** (même
région/type/catégorie), exactement comme les voisins des drapeaux.

## 3. Catalogue des API par thème

Modalités : 📝 texte · 📷 image · 🔊 audio. Clé : sk = `quete_questions.subject`.

| Domaine | Sources principales | Modalités | FR |
|---|---|---|---|
| Géographie (capitales, monuments, reliefs) | Wikidata, REST Countries, Commons | 📷📝 | ✅ |
| Drapeaux & symboles *(fait)* | REST Countries + flagcdn | 📷📝 | ✅ |
| Cinéma / séries / acteurs | TMDB | 📷📝 | ✅ |
| BD / manga | Jikan (MAL), Wikidata | 📷📝 | partiel |
| Jeux vidéo | RAWG | 📷📝 | partiel |
| Pokémon | **PokéAPI** | 📷🔊📝 | ✅ |
| Musique (pochettes, dates) | MusicBrainz + Cover Art | 📷📝 | ✅ |
| Musique classique (extraits) | Commons / Musopen (domaine public) | 🔊📷 | ✅ |
| Peinture / arts / photo | The Met, Art Institute, Rijksmuseum | 📷 | à traduire |
| Sciences (chimie, espace, physique) | PubChem, NASA, Wikidata | 📷📝 | ✅/traduire |
| Nature (animaux, plantes, minéraux) | GBIF, iNaturalist, Wikidata | 📷📝 | ✅ |
| Cris d'oiseaux / faune | **xeno-canto** (CC, ré-hébergeable) | 🔊 | ✅ |
| Histoire (souverains, éphéméride) | Wikidata, Wikimedia « On this day » | 📷📝 | ✅ |
| Sport (clubs, joueurs, JO) | TheSportsDB, Wikidata | 📷📝 | partiel |
| Gastronomie | TheMealDB | 📷📝 | à traduire |
| Marques & logos | Wikidata (⚠️ marques déposées) | 📷 | ✅ |
| Langues (vocabulaire, prononciation) | Free Dictionary, Datamuse, Wiktionary/Commons | 🔊📝 | EN/DE/ES |
| Trivia prêtes (démarrage) | Open Trivia DB, The Trivia API (CC-BY-NC) | 📝 | EN |

## 4. Confrontation avec l'existant

Constat : la taxonomie `quete_themes` est **déjà quasi complète** (~65 thèmes,
~9 800 Q) mais **tout est en texte** (seul `drapeaux_symboles` a des images).
→ **Les API servent surtout à injecter du MÉDIA (photo/son) et du VOLUME** dans les
thèmes existants, pas à créer des thèmes.

Règle de découpage :
- **Média de même difficulté** (affiches, monuments, tableaux, plats, photos
  d'animaux) → **mélangé dans le thème existant** (colonnes `img`/`a_img` déjà là).
- **Média plus dur ou mini-jeu** (hymnes, silhouettes, cris, « Qui est ce Pokémon ») →
  **nouvelle cassette opt-in** (voir §5).

Exclus du chantier : `fetes_traditions_symboles` (non souhaité) et les thèmes
**scolaires** (traités à part).

Angles réellement nouveaux : 🔊 Hymnes nationaux · 📷 Silhouettes de pays ·
🔊 Cris d'animaux · 📝 Éphéméride « ce jour-là » · 📷✨ **Qui est ce Pokémon ?**

## 5. Cassettes « dures » opt-in (exclues par défaut)

Mécanisme (implémenté) : un flag **`hard`** sur `quete_themes`. Une cassette dure
est **nichée** sous son thème parent mais **n'est jamais aspirée** par la sélection
d'un ancêtre (intégrale/domaine) — `descendantLeaves(key)` et `leafNodesUnder(key)`
sautent les nœuds `hard`. Elle reste **sélectionnable directement** (branche « feuille
pure » de `buildPerimeter`). L'éditeur, lui, les regroupe (`{ includeHard: true }`).

Cassettes prévues :
```
Géographie → 🆕 🔊 Hymnes nationaux · 🆕 📷 Silhouettes de pays
Nature     → 🆕 🔊 Cris d'animaux
Histoire   → 🆕 📝 Éphéméride « ce jour-là »
Jeux vidéo › Pokémon → 🆕 📷✨ Qui est ce Pokémon ?   (LIVRÉ, cf. §7)
```

## 6. Les deux briques techniques

1. **Rendu `silhouette-reveal`** ✅ **FAIT** : colonne `quete_questions.render`
   (`'silhouette'`). L'image est masquée en `brightness(0)` jusqu'à la révélation,
   puis fond en couleur + « pop » + jingle `soundReveal`. TBI (`QuestionModal`) +
   mobile (`ControllerView`, masquage anti-spoiler) + payload (`sessionConfig`).
   Réutilisable pour **Silhouettes de pays**.
2. **Audio** ✅ **FAIT** : colonne `quete_questions.audio` + upload dans les seeds +
   lecteur `<audio>` dans `QuestionModal` (TBI) et `ControllerView` (mobile) +
   inclusion dans le payload (`sessionConfig`). Nom de fichier opaque = anti-triche.

## 7. État & ordre de bataille

Livré (en base + code) :
- ✅ **Drapeaux** : 388 images fusionnées dans `drapeaux_symboles` (516 total).
- ✅ **« Qui est ce Pokémon ? »** : `render`/`hard`, silhouette-reveal + jingle,
  cassette `pokemon_silhouette` (hard), PokéAPI Gén.1. **151 Q.**
- ✅ **Cris d'animaux** (oiseaux) : `seed-birds.mjs` (Wikidata P225→P51 Commons —
  xeno-canto v2 supprimée). Cassette dure `cris_animaux`. **23 Q audio.**
- ✅ **Peinture** : `seed-met-paintings.mjs` (The Met, domaine public), ajout au
  thème `peinture_sculpture` (t='Tableau'). « Qui a peint ce tableau ? »
- ✅ **Cinéma** : `seed-tmdb-films.mjs` (TMDB, backdrops = photogrammes sans titre,
  anti-spoiler), ajout à `cinema` (t='Scène'). **60 Q.** Clé via env `TMDB_API_KEY`.
- 🟡 **Hymnes nationaux** : `seed-anthems.mjs` (Wikidata P85→P51). Cassette dure
  `hymnes_nationaux`. ⚠️ **Wikimedia rate-limite fort les gros audio** → ~10 Q
  seulement ; insert incrémental + `--keep` pour rattraper plus tard (IP à refroidir).

Reste : **monuments** (Wikidata), **silhouettes de pays** (réutilise silhouette-reveal),
**gastronomie** (TheMealDB), **photos d'animaux** (GBIF), **éphéméride** (Wikimedia).

Rappels : traduire les sources EN via l'API Claude (comme le pool culture-G) ;
créditer les licences CC-BY ; mettre en cache, ne jamais re-fetch en partie ;
noms de fichiers **opaques** pour tout média.
