# Taxonomie du pool de base (culture-G) — à valider avant seed

> Dérivée de `DESIGN_MODULES.md` §5. **8 domaines · 46 thèmes jouables.**
> Cible : **~150 questions FR par thème** (~6900 au total), avec **difficulté (1-5)** et **généralité (1-5)** capturées à l'écriture.
> Chaque thème = une feuille : `quete_categories` (role subject) + `quete_themes` (subject_key = la clé). Le scolaire existant (1707 Q) n'est PAS régénéré.
> Clés = ascii snake_case (segments ltree). Édite librement (ajoute/retire/renomme), puis on seede.

## Arbre

```
histoire  (domaine)
  prehistoire_antiquite     Préhistoire & Antiquité
  moyen_age                 Moyen Âge
  epoque_moderne            Époque moderne (XVe–XVIIIe)
  revolutions_xixe          Révolutions & XIXe siècle
  xxe_siecle                XXe siècle
  monde_contemporain        Monde contemporain (depuis 1991)

geographie  (domaine)
  geographie_physique       Reliefs, fleuves, climats
  pays_capitales            Pays & capitales
  villes_monuments          Villes & monuments
  drapeaux_symboles         Drapeaux & symboles
  mers_deserts_reperes      Mers, déserts & grands repères

sciences  (domaine)
  maths_logique             Maths & logique
  physique                  Physique
  chimie                    Chimie
  astronomie_espace         Astronomie & espace
  informatique_numerique    Informatique & numérique
  inventions_technologies   Inventions & technologies

nature  (domaine)
  animaux                   Animaux
  plantes_botanique         Plantes & botanique
  corps_humain_sante        Corps humain & santé
  ecologie_environnement    Écologie & environnement
  geologie_mineraux         Géologie & minéraux

arts  (domaine)
  litterature_auteurs       Littérature & auteurs
  peinture_sculpture        Peinture & sculpture
  architecture_design       Architecture & design
  musique_classique_opera   Musique classique & opéra
  photographie_arts_visuels Photographie & arts visuels

divertissement  (domaine — existe déjà)
  cinema                    Cinéma
  series_tv                 Séries TV
  musique_populaire         Musique populaire
  jeux_video                Jeux vidéo
  jeux_de_societe           Jeux de société
  bd_comics_manga           BD, comics & manga
  tele_celebrites           Télé & célébrités

sport  (domaine — existe déjà)
  football                  Football
  sports_collectifs         Sports collectifs (basket, rugby, hand…)
  tennis_raquettes          Tennis & sports de raquette
  athletisme_jo             Athlétisme & Jeux Olympiques
  sports_mecaniques         Sports mécaniques (F1, moto)
  cyclisme                  Cyclisme

societe  (domaine)
  politique_institutions    Politique & institutions
  economie_marques_logos    Économie, marques & logos
  religions_mythologies     Religions & mythologies
  gastronomie_cuisine       Gastronomie & cuisine
  langues_expressions       Langues & expressions
  fetes_traditions_symboles Fêtes, traditions & symboles
```

## Points de réconciliation avec l'existant (à trancher)

1. **Collision de clés** : le scolaire a déjà des feuilles `histoire` et `geographie` (matières), qui entrent en conflit avec les domaines culture-G du même nom.
   → Reco : renommer ces 2 feuilles scolaires en `sco_histoire` / `sco_geographie` (le `subject_key` reste `histoire`/`geographie`, donc **aucun impact sur les questions ni les parties**). Les 6 autres matières ne bougent pas.
2. **`cinema`** : devient un vrai thème jouable (~150 Q générales). Les mini-packs de démo `film_scifi/anim/action` (12 Q, phase 1) → à **retirer** du core (ou garder comme sous-packs bonus, au choix).
3. **`harrypotter`/`hp_livre1`** : reste un **pack bonus** sous divertissement, hors des 46 thèmes du pool de base (contenu communautaire, pas culture générale).

## Paramètres de génération (rappel)
- ~150 Q **FR** par thème (EN plus tard via `export/import-translations`).
- Chaque question : énoncé, 4 réponses (rep_a..d), `correcte` 1-indexé, explication, 4 distracteurs **plausibles**, `pool='cycle4'`, `level=null` (transverse).
- **difficulté 1-5** + **généralité 1-5** (5 = grand public / 1 = niche pointue) assignées par le rédacteur.
- Éviter les faits **périssables** (records sportifs « actuels », classements, « le dernier… »). Privilégier le stable.
- Qualité : rédacteur → vérificateur adversarial (fact-check + plausibilité des distracteurs) → déduplication par thème.
