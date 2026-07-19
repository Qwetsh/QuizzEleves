# Mini-jeux par thème — inventaire & souhaits

> **Mode d'emploi** : ce doc liste TOUS les thèmes de la base (`quete_themes`,
> extrait du 2026-07-19) avec le mini-jeu de duel qu'ils déclenchent
> aujourd'hui. **Remplis la colonne « Mini-jeu souhaité »** avec ce que tu
> imagines : un nom libre, une ligne de description, une référence (« comme
> Motus », « combat Pokémon tour par tour »…) — ou laisse vide si le jeu actuel
> te va. Tu peux aussi corriger les noms actuels si tu veux les renommer.
> Ensuite renvoie-moi le doc : je le mets en mémoire comme feuille de route.
>
> Rappels (cf. `DESIGN_MINIGAMES.md`) :
> - **Cascade** : un sous-thème sans mini-jeu joue celui de sa catégorie, sinon
>   celui du domaine, sinon le **Duel de rapidité** (générique). Donner un
>   mini-jeu à une ligne « domaine » profite donc à tous ses enfants sans jeu.
> - *(hérité)* = pas de mini-jeu propre, il vient de la catégorie au-dessus.
> - 🔒 = cassette dure (opt-in).

## 🏫 Scolaire

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| Français | `francais` | Le Mot le Plus Long | |
| Maths | `maths` | Le Compte est Bon | |
| Histoire | `histoire` | Frise du temps | |
| Géographie | `geographie` | Tour du monde (Curioscope) | |
| SVT | `svt` | Le Grand Tri (bulles) | |
| Anglais | `anglais` | Chasse aux verbes irréguliers (bulles) | |
| Allemand | `allemand` | Duel de rapidité (générique) | |
| Espagnol | `espagnol` | Duel de rapidité (générique) | |

## 🏛️ Histoire (culture G)

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Histoire (domaine)** | `histoire_g` | Duel de rapidité (générique) | |
| Préhistoire & Antiquité | `prehistoire_antiquite` | Duel de rapidité (générique) | |
| Moyen Âge | `moyen_age` | Duel de rapidité (générique) | |
| Époque moderne | `epoque_moderne` | Duel de rapidité (générique) | |
| Révolutions & XIXe | `revolutions_xixe` | Duel de rapidité (générique) | |
| XXe siècle | `xxe_siecle` | Duel de rapidité (générique) | |
| Monde contemporain | `monde_contemporain` | Duel de rapidité (générique) | |
| Éphéméride | `ephemeride` | Duel de rapidité (générique) | |

*(note : la Frise du temps existe déjà — elle est branchée sur la matière
scolaire `histoire`, pas sur ce domaine. Dis-moi si tu veux l'étendre ici.)*

## 🧭 Géographie (culture G)

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Géographie (domaine)** | `geographie_g` | Duel de rapidité (générique) | |
| Reliefs, fleuves & climats | `geographie_physique` | Duel de rapidité (générique) | |
| Pays & capitales | `pays_capitales` | Duel de rapidité (générique) | |
| Villes & monuments | `villes_monuments` | Duel de rapidité (générique) | |
| Drapeaux & symboles | `drapeaux_symboles` | **Drapeau éclair** (drapeau net, course au bon nom) | |
| Mers, déserts & repères | `mers_deserts_reperes` | Duel de rapidité (générique) | |
| Hymnes nationaux 🔒 | `hymnes_nationaux` | Duel de rapidité (générique) | |
| Silhouettes de pays 🔒 | `silhouettes_pays` | Duel de rapidité (générique) | |

*(note : le Tour du monde Curioscope est branché sur la matière scolaire
`geographie` — extensible ici si tu veux.)*

## ✦ Sciences

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Sciences (domaine)** | `sciences_g` | Duel de rapidité (générique) | |
| Maths & logique | `maths_logique` | Duel de rapidité (générique) | |
| Physique | `physique` | Duel de rapidité (générique) | |
| Chimie | `chimie` | Duel de rapidité (générique) | |
| Astronomie & espace | `astronomie_espace` | Duel de rapidité (générique) | |
| Informatique & numérique | `informatique_numerique` | Duel de rapidité (générique) | |
| Inventions & technologies | `inventions_technologies` | Duel de rapidité (générique) | |

## 🌿 Nature

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Nature (domaine)** | `nature_g` | Duel de rapidité (générique) | |
| Animaux | `animaux` | Duel de rapidité (générique) | |
| Plantes & botanique | `plantes_botanique` | Duel de rapidité (générique) | |
| Corps humain & santé | `corps_humain_sante` | Duel de rapidité (générique) | |
| Cris d'animaux 🔒 | `cris_animaux` | Duel de rapidité (générique) | |
| Écologie & environnement | `ecologie_environnement` | Duel de rapidité (générique) | |
| Géologie & minéraux | `geologie_mineraux` | Duel de rapidité (générique) | |

## 🎨 Arts & lettres

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Arts & lettres (domaine)** | `arts_g` | Duel de rapidité (générique) | |
| Littérature & auteurs | `litterature_auteurs` | Duel de rapidité (générique) | |
| — Harry Potter (intégrale) | `harrypotter` | Duel de rapidité (générique) | |
| —— Livre 1 | `hp_livre1` | Duel de rapidité (générique) | |
| Peinture & sculpture | `peinture_sculpture` | Duel de rapidité (générique) | |
| Architecture & design | `architecture_design` | Duel de rapidité (générique) | |
| Musique classique & opéra | `musique_classique_opera` | Duel de rapidité (générique) | |
| Photographie & arts visuels | `photographie_arts_visuels` | Duel de rapidité (générique) | |

## ★ Culture pop

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Culture pop (domaine)** | `divertissement_g` | Duel de rapidité (générique) | |
| Cinéma | `cinema` | **L'Affiche mystère** (affiche floutée qui se révèle, 200 films TMDB) | |
| — Horreur | `film_horreur` | L'Affiche mystère *(hérité)* | |
| — Super-héros | `super_heros` | L'Affiche mystère *(hérité)* | |
| — Le Seigneur des anneaux | `seigneur_des_anneaux` | L'Affiche mystère *(hérité)* | |
| — Affiches de films 🔒 | `cinema_affiches` | L'Affiche mystère *(hérité)* | |
| Séries TV | `series_tv` | **L'Affiche mystère : séries** (100 séries TMDB) | |
| — Affiches de séries 🔒 | `series_affiches` | L'Affiche mystère : séries *(hérité)* | |
| Musique populaire | `musique_populaire` | Duel de rapidité (générique) | |
| Jeux vidéo | `jeux_video` | Chasse aux RPG (bulles) | |
| — Skyrim | `skyrim` | Chasse aux RPG *(hérité)* | |
| — Pokémon | `pokemon` | Chasse aux RPG *(hérité)* | *(prévu : vrai combat Pokémon ultra-custom)* |
| —— Qui est ce Pokémon ? 🔒 | `pokemon_silhouette` | **Qui est ce Pokémon ?!** (plateau TV silhouette) | |
| — World of Warcraft | `world_of_warcraft` | **Explorateur d'Azeroth** (Curioscope ; sans spots → Chasse aux RPG) | |
| Jeux de société | `jeux_de_societe` | Duel de rapidité (générique) | |
| BD, comics & manga | `bd_comics_manga` | Duel de rapidité (générique) | |
| Télé & célébrités | `tele_celebrites` | Duel de rapidité (générique) | |

## ◈ Sport

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Sport (domaine)** | `sport_g` | Duel de rapidité (générique) | |
| Football | `football` | Duel de rapidité (générique) | |
| Sports collectifs | `sports_collectifs` | Duel de rapidité (générique) | |
| Tennis & raquettes | `tennis_raquettes` | Duel de rapidité (générique) | |
| Athlétisme & JO | `athletisme_jo` | Duel de rapidité (générique) | |
| Sports mécaniques | `sports_mecaniques` | Duel de rapidité (générique) | |
| Cyclisme | `cyclisme` | Duel de rapidité (générique) | |

## 🌍 Société

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Société (domaine)** | `societe_g` | Duel de rapidité (générique) | |
| Politique & institutions | `politique_institutions` | Duel de rapidité (générique) | |
| Économie, marques & logos | `economie_marques_logos` | Duel de rapidité (générique) | |
| Religions & mythologies | `religions_mythologies` | Duel de rapidité (générique) | |
| Gastronomie & cuisine | `gastronomie_cuisine` | Duel de rapidité (générique) | |
| Langues & expressions | `langues_expressions` | Duel de rapidité (générique) | |
| Fêtes & traditions | `fetes_traditions_symboles` | Duel de rapidité (générique) | |

## Boîte à moteurs disponibles (réutilisables tels quels avec un simple contenu)

- **Bulles** (touche la bonne catégorie) — ex. verbes irréguliers, Grand Tri, RPG
- **Frise** (ordonne par date/valeur) — ex. Histoire, films
- **Memory** (paires, tour par tour) — ex. mot ↔ traduction *(entrée démo `vocabulaire`, pas encore rattachée à un vrai thème)*
- **Compte est Bon** (calcul)
- **Mot le Plus Long** (lettres)
- **Curioscope** (guessr sur carte, multi-univers : monde réel, Azeroth…)
- **Photo mystère / Deblur** (image floue qui se révèle) — en service sur Cinéma + Séries TV (affiches TMDB seedées) ; extensible aux jaquettes JV
- **Frise des films** (timeline, contenu MOVIE_EVENTS) — EN RÉSERVE : décâblée de Cinéma au profit de l'Affiche mystère, réactivable sur n'importe quel thème
- **Course d'images** (image nette, premier au bon nom) — ex. Drapeau éclair ; marche gratuitement sur tout thème à questions-images
- **Silhouette** (plateau TV « Qui est ce Pokémon ?! », jingle)
- **Duel de rapidité** (générique, toutes matières)
