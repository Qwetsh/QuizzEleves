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
| Allemand | `allemand` | **Chasse aux verbes forts** (bulles) | |
| Espagnol | `espagnol` | **Memory español** (~90 paires) | |

## 🏛️ Histoire (culture G)

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Histoire (domaine)** | `histoire_g` | **La Grande Frise** (dates célèbres toutes époques) | |
| Préhistoire & Antiquité | `prehistoire_antiquite` | **Frise d'époque** (dates dédiées) | |
| Moyen Âge | `moyen_age` | **Frise d'époque** (dates dédiées) | |
| Époque moderne | `epoque_moderne` | **Frise d'époque** (dates dédiées) | |
| Révolutions & XIXe | `revolutions_xixe` | **Frise d'époque** (dates dédiées) | |
| XXe siècle | `xxe_siecle` | **Frise d'époque** (dates dédiées) | |
| Monde contemporain | `monde_contemporain` | **Frise d'époque** (dates dédiées) | |
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
| Chimie | `chimie` | **Le Tableau de Mendeleïev** (118 cases, clique le bon symbole) | |
| Astronomie & espace | `astronomie_espace` | **Échelle du Système solaire** (frise par distance) | |
| Informatique & numérique | `informatique_numerique` | Duel de rapidité (générique) | |
| Inventions & technologies | `inventions_technologies` | **Frise des inventions** | |

## 🌿 Nature

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Nature (domaine)** | `nature_g` | Duel de rapidité (générique) | |
| Animaux | `animaux` | **L'Animal mystère** (photo floutée, iNaturalist) | |
| Plantes & botanique | `plantes_botanique` | **La Plante mystère** (photo floutée) | |
| Corps humain & santé | `corps_humain_sante` | Duel de rapidité (générique) | |
| Cris d'animaux 🔒 | `cris_animaux` | Duel de rapidité (générique) | |
| Écologie & environnement | `ecologie_environnement` | Duel de rapidité (générique) | |
| Géologie & minéraux | `geologie_mineraux` | **La Roche mystère** (photo floutée) | |

## 🎨 Arts & lettres

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Arts & lettres (domaine)** | `arts_g` | Duel de rapidité (générique) | |
| Littérature & auteurs | `litterature_auteurs` | **Memory des écrivains** (auteur ↔ œuvre) | |
| — Harry Potter (intégrale) | `harrypotter` | Memory des écrivains *(hérité — futur duel de sorciers)* | |
| —— Livre 1 | `hp_livre1` | Memory des écrivains *(hérité)* | |
| Peinture & sculpture | `peinture_sculpture` | Duel de rapidité (générique) | |
| Architecture & design | `architecture_design` | Duel de rapidité (générique) | |
| Musique classique & opéra | `musique_classique_opera` | **Le Blind test classique** (34 œuvres célèbres) | |
| Photographie & arts visuels | `photographie_arts_visuels` | Duel de rapidité (générique) | |

## ★ Culture pop

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Culture pop (domaine)** | `divertissement_g` | Duel de rapidité (générique) | |
| Cinéma | `cinema` | **L'Affiche mystère** (affiche floutée qui se révèle, 200 films TMDB) | |
| — Horreur | `film_horreur` | **Affiche mystère : horreur** (pool dédié) | |
| — Super-héros | `super_heros` | **Affiche mystère : super-héros** (pool dédié) | |
| — Le Seigneur des anneaux | `seigneur_des_anneaux` | L'Affiche mystère *(hérité)* | |
| — Affiches de films 🔒 | `cinema_affiches` | L'Affiche mystère *(hérité)* | |
| Séries TV | `series_tv` | **L'Affiche mystère : séries** (100 séries TMDB) | |
| — Affiches de séries 🔒 | `series_affiches` | L'Affiche mystère : séries *(hérité)* | |
| Musique populaire | `musique_populaire` | **Le Blind test** (99 extraits Deezer du chart) | |
| Jeux vidéo | `jeux_video` | **La Jaquette mystère** (RAWG ; Chasse aux RPG en réserve) | |
| — Skyrim | `skyrim` | La Jaquette mystère *(hérité)* | |
| — Pokémon | `pokemon` | La Jaquette mystère *(hérité)* | *(prévu : vrai combat Pokémon ultra-custom)* |
| —— Qui est ce Pokémon ? 🔒 | `pokemon_silhouette` | **Qui est ce Pokémon ?!** (plateau TV silhouette) | |
| — World of Warcraft | `world_of_warcraft` | **Explorateur d'Azeroth** (Curioscope ; sans spots → Jaquette mystère) | |
| Jeux de société | `jeux_de_societe` | Duel de rapidité (générique) | |
| BD, comics & manga | `bd_comics_manga` | **Le Perso mystère** (BD + comics + top manga) | |
| Télé & célébrités | `tele_celebrites` | **La Célébrité mystère** (photo floutée) | |

## ◈ Sport

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Sport (domaine)** | `sport_g` | **Memory des champions** (athlète ↔ discipline) | |
| Football | `football` | Memory des champions *(hérité)* | |
| Sports collectifs | `sports_collectifs` | Memory des champions *(hérité)* | |
| Tennis & raquettes | `tennis_raquettes` | Memory des champions *(hérité)* | |
| Athlétisme & JO | `athletisme_jo` | Memory des champions *(hérité)* | |
| Sports mécaniques | `sports_mecaniques` | Memory des champions *(hérité)* | |
| Cyclisme | `cyclisme` | Memory des champions *(hérité)* | |

## 🌍 Société

| Thème | Clé | Mini-jeu actuel | Mini-jeu souhaité |
|---|---|---|---|
| **Société (domaine)** | `societe_g` | Duel de rapidité (générique) | |
| Politique & institutions | `politique_institutions` | Duel de rapidité (générique) | |
| Économie, marques & logos | `economie_marques_logos` | **Le Logo mystère** (logo flouté) | |
| Religions & mythologies | `religions_mythologies` | Duel de rapidité (générique) | |
| Gastronomie & cuisine | `gastronomie_cuisine` | Duel de rapidité (générique) | |
| Langues & expressions | `langues_expressions` | **Finis l'expression !** (~60 expressions) | |
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
