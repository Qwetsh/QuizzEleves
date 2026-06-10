---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Mini-jeux de combat 1v1 par matière (maths, français, SVT, géographie) pour la Quête des Matières'
session_goals: 'Générer un large éventail de concepts de mini-jeux jouables sur écran tactile/TBI, scoring automatique, manches de 30-60s, puis identifier les 4 à implémenter en premier'
selected_approach: 'ai-recommended'
techniques_used: ['Cross-Pollination + Analogical Thinking', 'SCAMPER Method', 'Solution Matrix']
ideas_generated: ['Compte est Bon (maths)', 'Mot le Plus Long (français)', 'Motus duel (réserve)', 'Anatomiste (SVT)', 'GeoGuessr photos (géo)', 'quiz photo espèces (rejeté)', 'chaîne alimentaire (rejeté)', 'pattern commit-reveal', 'contenu asymétrique']
session_active: false
workflow_completed: true
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Claude (avec Thomas)
**Date:** 2026-06-10

## Session Overview

**Topic:** Mini-jeux de combat 1v1 par matière (maths, français, SVT, géographie) pour le système de fight de la Quête des Matières.

**Goals:** Générer un maximum de concepts de mini-jeux, puis converger vers les 4 premiers à implémenter (un par matière manquante).

### Context Guidance

Contraintes techniques et pédagogiques issues du système existant :
- Écran tactile / TBI : split-screen simultané possible (deux élèves touchent chacun leur moitié) OU tour par tour sur zone partagée
- Scoring 100% automatique (pas de jugement humain)
- Manches courtes (30-60 s), combat au meilleur des 3 manches
- Public : collège cycle 4 (5e-4e-3e)
- Stack : React + Zustand + Framer Motion, données embarquées dans le bundle (pas d'API)
- Mini-jeux existants : Duel de rapidité (questions, fallback toutes matières), Chasse aux verbes irréguliers (anglais, grille 30s), Frise du temps (histoire, type Timeline, tour par tour)
- Contrat technique : composant qui reçoit { attacker, defender, subject, round, onRoundWin }

### Session Setup

_Session lancée à la demande de Thomas après le test réussi du mini-jeu Frise du temps en local._

## Technique Selection

**Approach:** Techniques recommandées (IA)
**Analysis Context:** Mini-jeux de combat par matière, objectif volume puis sélection des 4 à implémenter.

**Recommended Techniques:**

- **Cross-Pollination + Analogical Thinking :** piller les mécaniques des jeux existants (société, vidéo, TV, cour de récré) et les transposer en duel pédagogique — la veine qui a déjà produit Timeline et la Chasse aux verbes.
- **SCAMPER Method :** démultiplier les mécaniques existantes et trouvées (Substituer/Combiner/Adapter/Modifier/autres usages/Éliminer/Renverser).
- **Solution Matrix :** converger — grille matière × mécanique notée sur faisabilité auto-scoring, fun 30-60s, valeur pédagogique cycle 4.

**AI Rationale:** Sujet concret et ludique, énergie joueuse, contraintes bien définies → divergence créative à fort rendement (analogies) puis expansion systématique (SCAMPER) puis convergence structurée vers la shortlist de 4.

## Phase 1 — Pollinisation croisée (captures en cours)

**[Maths #1] : Le Compte est Bon** ✅ retenu par Thomas
_Concept_ : split-screen, même cible et mêmes 6 nombres des deux côtés ; on assemble calculs en touchant nombres/opérateurs ; premier à la cible ou le plus proche au gong (45 s).
_Novelty_ : pas UNE réponse à trouver mais un chemin à construire — calcul mental stratégique, scoring trivial.

**[Français #2] : Motus duel** (Thomas)
_Concept_ : chaque équipe devine son mot façon Motus/Wordle, grille de couleurs.
_Novelty_ : mécanique archi-connue des élèves (Wordle/Tusmo). Problème soulevé : copiage entre côtés.

**[Français #3] : Le Mot le Plus Long façon Scrabble** (Thomas)
_Concept_ : tirage de lettres commun, chaque équipe compose un mot ; score = valeurs Scrabble des lettres ; le plus gros score gagne la manche.
_Novelty_ : scoring riche (longueur ET lettres chères), vrai travail de vocabulaire/orthographe. Problème : copiage + besoin d'un dictionnaire embarqué pour valider.

**[SVT #4] : Photo d'espèce à identifier** (Thomas, jugé « pas ouf » par lui)
_Concept_ : photo d'une espèce, retrouver son nom.
_Novelty_ : faible — c'est un quiz d'images. À transformer.

**[Géo #5] : Mini-GeoGuessr commit-reveal** (Thomas) 💎 ✅ retenu
_Concept_ : PHOTO d'un lieu célèbre SANS son nom (sinon trop simple) ; chaque équipe a SA carte du monde, se déplace et plante un drapeau ; quand les DEUX ont validé, révélation et le plus proche gagne.
_Novelty_ : le pattern « valider puis cacher jusqu'à révélation » règle le copiage par construction. Décision : ~40 photos embarquées dans le bundle (~1,5 Mo, validé par Thomas).

**[SVT #6] : L'Anatomiste** ✅ retenu (étendu par Thomas)
_Concept_ : silhouettes variées — humain, plante, écosystème, oiseau… — et « Place le pancréas / les étamines / la nappe phréatique ! » : placement façon GeoGuessr, commit-reveal, le plus proche gagne.
_Novelty_ : réutilise le moteur de placement de la géo ; la variété des silhouettes couvre tout le programme SVT.

**[SVT #7] : Chaîne alimentaire (ordre)** ❌ rejeté par Thomas (« trop bateau »)

**Décisions de design transverses (Thomas) :**
- Les deux équipes sont physiquement devant le MÊME tableau → masquer une moitié d'écran est absurde. Anti-copiage = « à la validation, la production se cache jusqu'à la révélation commune ».
- Saisie de mots : PAS de clavier virtuel — on GLISSE des lettres (tuiles) dans des emplacements prévus.

**Shortlist en construction :**
- Maths : Le Compte est Bon ✅
- Français : Le Mot le Plus Long, tuiles glissées, cache à la validation, score Scrabble, dico embarqué (Motus en réserve)
- SVT : L'Anatomiste ✅
- Géo : GeoGuessr photos ✅

## Phase 2 — SCAMPER éclair : règles arrêtées

### 🧮 Le Compte est Bon (maths)
- Split-screen, même cible (2-3 chiffres) et mêmes 6 nombres des deux côtés
- Assemblage tactile : nombres + opérateurs, résultats intermédiaires réutilisables
- **Compte exact = victoire immédiate de la manche** ; sinon au gong de **60 s**, le plus proche gagne
- **Égalité parfaite → manche rejouée** avec nouveau tirage (personne ne marque)

### 🔤 Le Mot le Plus Long (français)
- Tirage commun de **9 lettres** (équilibre voyelles/consonnes), **45 s**
- Saisie par **glisser-déposer de tuiles** dans des emplacements (pas de clavier virtuel)
- **À la validation, le mot se cache** jusqu'à la révélation commune (anti-copiage au TBI partagé)
- Score = somme des valeurs Scrabble des lettres du mot
- **Mot absent du dictionnaire = 0 point** (la prudence orthographique est une stratégie)
- Nécessite un dictionnaire français embarqué (~200-400 Ko compressé)
- En réserve : Motus duel (mots différents par côté, même difficulté)

### 🫀 L'Anatomiste (SVT)
- Moteur de **placement commit-reveal** (partagé avec le GeoGuessr)
- Silhouettes v1 : **corps humain, fleur/plante, paysage/écosystème** (cellule en v2)
- « Place le pancréas ! » → chaque équipe pose son marqueur sur SA copie de la silhouette, révélation, **le plus proche du point cible gagne**

### 🌍 GeoGuessr (géographie)
- **Photo d'un lieu célèbre SANS son nom**, carte du monde (SVG équirectangulaire) par équipe
- Déplacement/zoom sur la carte, pose d'un drapeau, **commit-reveal**, le plus proche gagne
- **~40 lieux mondiaux**, photos libres de droits (Wikimedia Commons) optimisées WebP, embarquées dans le bundle (~1,5 Mo)
- Sourcing : Claude prépare la liste de lieux + photos, **Thomas valide avant intégration** ; format de données permettant de remplacer/ajouter ses propres photos

## Idea Organization and Prioritization

**Thèmes émergés :**
1. **Jeux de construction sous pression** (Compte est Bon, Mot le Plus Long) — on assemble une production, pattern « valider = cacher »
2. **Jeux de placement spatial** (GeoGuessr, Anatomiste) — un seul moteur commit-reveal pour deux matières
3. **Patterns transverses réutilisables** : commit-reveal (anti-copiage structurel), contenu asymétrique (en réserve), glisser-déposer tactile

**Prioritization Results:**
- **Top 4 (un par matière)** : Compte est Bon, Mot le Plus Long, Anatomiste, GeoGuessr — tous validés avec règles complètes
- **Quick win technique** : moteur de placement unique → Anatomiste + GeoGuessr pour le prix d'un
- **En réserve** : Motus duel (français), cellule (silhouette Anatomiste v2), carte France (GeoGuessr v2)
- **Rejeté** : quiz photo d'espèces (trop proche du Duel de rapidité), chaîne alimentaire ordonnée (« trop bateau »)

**Action Planning:**
1. **Moteur de placement commit-reveal** (sert 2 jeux) → puis Anatomiste (données : points cibles sur 3 silhouettes SVG) → puis GeoGuessr (carte monde + 40 lieux/photos à faire valider par Thomas)
2. **Compte est Bon** : générateur de tirages avec solution garantie à distance raisonnable, UI de construction de calcul
3. **Mot le Plus Long** : dictionnaire français compressé embarqué, tirage 9 lettres pondéré, drag & drop de tuiles, scoring Scrabble
4. Intégration : 4 entrées dans le registre `minigames/index.js` (contrat onRoundWin existant, BO3 inchangé)

## Session Summary and Insights

**Key Achievements:**
- 9 concepts explorés, 4 retenus avec règles complètes prêtes à coder, 2 en réserve, 2 rejetés en connaissance de cause
- Découverte du pattern structurant de la session : **commit-reveal** (inventé par Thomas sur le GeoGuessr, généralisé à 3 jeux)
- Architecture économe : 4 jeux pour ~3 moteurs (placement partagé)

**Session Reflections:**
- Thomas converge vite et bien quand les contraintes sont posées (TBI partagé, scoring auto) — les meilleures idées sont venues de SES références (jeux TV, GeoGuessr, Scrabble)
- Correction utilisateur clé : masquer une moitié d'écran n'a aucun sens quand les deux équipes sont devant le même tableau physique — le masquage doit être temporel (après validation), pas spatial
