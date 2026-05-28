# Analyse Complete - Quete des Matieres
> Generee le 28/05/2026

---

## PARTIE 1 : AUDIT DU CODE

### BUGS CRITIQUES

#### 1. Contradiction dans la logique Relance
**Fichiers:** `src/logic/powerActivator.js:45` + `src/store/gameStore.js:873-877`

`canUsePowerInContext` exige `pendingLanding === true` pour la relance, mais `usePower()` dans le store ne verifie PAS `pendingLanding` :
```javascript
// powerActivator.js:45 - UI check (correct)
if (key === 'relance') return !!diceValue && !showQuestion && !rolling && !showEvent && !!pendingLanding;

// gameStore.js:873 - Store check (manque pendingLanding!)
if (powerKey === 'relance') {
  if (!diceValue || showQuestion) return;
  get().useRelance();
}
```
**Impact:** La relance pourrait etre activee hors de la fenetre prevue.

#### 2. Race condition dans eventRollDice
**Fichier:** `src/store/gameStore.js:504-516`

Le `setInterval` dans `eventRollDice` accede a `get().showEvent` en boucle. Si l'event est ferme pendant l'animation du de, `showEvent` devient null et le code tente de spread `undefined`.

#### 3. Race condition pendingLanding + chooseJunction
**Fichier:** `src/store/gameStore.js:202-208`

Si le joueur arrive a une jonction, `awaitingChoice: true` est set MAIS le `setTimeout` de `pendingLanding` peut quand meme se declencher apres le choix de jonction, causant un double `handleLanding()`.

---

### BUGS IMPORTANTS (HIGH)

#### 4. Acces non securise dans l'event volArgent
**Fichier:** `src/store/gameStore.js:803`
```javascript
const target = teams[targetIndex]; // Pas de verification de bornes!
```
Si `targetIndex` est hors limites, crash sur `.money`.

#### 5. Spread de pouvoir potentiellement undefined
**Fichier:** `src/store/gameStore.js:700-725` (event vol)
```javascript
const targetPowers = { ...target.powers, [stolen]: { ...target.powers[stolen], charges: ... } };
// target.powers[stolen] peut etre undefined
```

#### 6. Relance : pas de verification du solde avant deduction
**Fichier:** `src/store/gameStore.js:930-937`

Le cout d'activation (8 coins) est deduit sans verifier que `team.money >= cost`. L'equipe peut passer en negatif.

#### 7. Timer de question pas reset correctement pour les doubles questions
**Fichier:** `src/components/Modals/QuestionModal.jsx:34-40`

Si `showQuestion` change de reference sans passer par `null` (questions chainees), le `useEffect` peut ne pas se re-declencher.

---

### BUGS MOYENS (MEDIUM)

#### 8. setTimeout non nettoye dans useRelance
**Fichier:** `src/store/gameStore.js:924-959`

Le `setInterval` de l'animation de relance n'est pas rattache au cycle de vie React. Si le jeu est reset pendant l'animation, l'intervalle persiste.

#### 9. Double question : edge case sur doubleCount
**Fichier:** `src/store/gameStore.js:362-378`

Si `doubleActive=true` mais `doubleCount=0` ou `undefined`, le code entre dans le `else if` et reset sans jamais poser de question.

#### 10. ChargeIndicator plafonne a 5 visuellement
**Fichier:** `src/components/Modals/ShopModal.jsx:7-24`

`max={5}` en dur. Si le joueur a 8 charges, seules 5 sont visibles.

#### 11. Event Recharge : pas de validation du powerKey
**Fichier:** `src/store/gameStore.js:554-565`

`eventRechargeChoice` accepte n'importe quel powerKey sans verifier que le joueur possede le pouvoir ou que c'est un pouvoir valide pour l'event.

---

### BUGS MINEURS (LOW)

- EventModal : dependance `[showEvent?.key]` au lieu de `[showEvent]` (son potentiellement manque)
- Index comme key dans VictoryModal confetti
- Board position invalide renvoie silencieusement (0,0) dans BoardSVG
- Z-index 300 pour FlyingCoins vs 60 pour le sidebar
- Pas de validation des parametres de generation du plateau
- Persistence sauvegarde un etat potentiellement corrompu

---

## PARTIE 2 : ANALYSE DU SYSTEME DE POUVOIRS

### Tableau des pouvoirs actuels

| Pouvoir | Cat. | Type | Prix | Activation | Upgrade | Niveaux |
|---------|------|------|------|------------|---------|---------|
| Bouclier | DEF | Passif | 15 | **0** | 20, 30 | Bloque recul / +50% argent / +5 coins |
| Indice | DEF | Passif | 15 | 5 | 20, 30 | Cache 2 rep / +5s / Cache 3 rep |
| Relance | DEF | Instant | 15 | 8 | 20, 30 | Relance / Meilleur / Somme |
| Foudre | OFF | Cible | 15 | 10 | 20, 30 | -3 cases / -5 / -7 |
| Sablier | OFF | Cible | 15 | 8 | 20, 30 | Timer /2 / /3 / /4 |
| Double | OFF | Cible | 15 | 10 | 20, 30 | 2 questions / 2 sans bonus / 3 questions |

### Problemes d'equilibre

#### Bouclier est trop fort
- Activation a **0 coin** (vs 5-10 pour les autres)
- Passif = aucune action requise, se declenche automatiquement
- 2 charges de depart = 2 erreurs gratuites sans consequence
- **Recommandation :** Ajouter un cout d'activation de 3 coins

#### Double Niv.2 est un piege
- Niv.1 : 2 questions (avec bonus coins)
- Niv.2 : 2 questions **sans bonus coins** = downgrade!
- Niv.3 : 3 questions (avec bonus)
- **Recommandation :** Changer Niv.2 en "2 questions + la cible ne gagne pas de coins" (au lieu de supprimer le bonus du lanceur)

#### Relance Niv.3 est sous-evalue
- Mode "somme" = potentiellement 2-12 de deplacement total
- Cout identique aux autres pouvoirs (upgrade 30, activation 8)
- **Recommandation :** Monter le cout d'upgrade Niv.3 a 40 et l'activation a 12

#### Indice Niv.3 trivialise les questions
- Cache 3 mauvaises reponses sur 4 = ne reste que la bonne
- Pour seulement 5 coins, c'est une reponse garantie
- **Recommandation :** Plafonner a 2 reponses cachees OU monter l'activation a 7 coins au Niv.3

---

## PARTIE 3 : ANALYSE DE L'ECONOMIE

### Sources de revenus

| Source | Gain | Frequence |
|--------|------|-----------|
| Bonne reponse (speed bonus) | 2-10 coins | Chaque question |
| Event Tresor | 15-25 coins | Aleatoire |
| Event Banquier | 3x bonnes reponses | Aleatoire |
| Event Jackpot (gagne) | 30 coins | Aleatoire |
| Event Pari Argent (gagne) | 10 coins | Aleatoire |

### Sources de depenses

| Depense | Cout |
|---------|------|
| Debloquer un pouvoir | 15 coins |
| Acheter 1 charge | 15 coins |
| Upgrade Niv.2 | 20 coins |
| Upgrade Niv.3 | 30 coins |
| Activation pouvoir | 5-10 coins |
| Event Impot | 30% du total |
| Event Taxe Commune | 5 coins (tous) |

### Diagnostic

- **Debut de partie :** Economie saine, chaque piece compte
- **Milieu :** Acceleration OK, les choix sont significatifs (~40-60 coins)
- **Fin :** **Inflation** - les joueurs accumulent 100+ coins inutiles
- **Events surpuissants :** Tresor (15-25) et Banquier (3x) eclipsent les recompenses de questions (2-10)

### Recommandations economie
1. Reduire gains events : Tresor 10-15, Banquier 2x+5
2. Augmenter recompenses questions : 3-12 au lieu de 2-10
3. Ajouter un "puits a pieces" endgame (fusions de pouvoirs, encheres speciales)

---

## PARTIE 4 : FONCTIONNALITES MANQUANTES / CASSEES

### Marche Noir - Event non implemente
**Fichier:** `src/store/gameStore.js:796`

L'event "Marche Noir" est suppose offrir un achat de charge a -50%, mais le handler ne fait que logger un message. Aucun choix n'est propose au joueur.

### Fenetre de relance invisible
Apres le lancer de de, le joueur a 4 secondes pour utiliser la Relance, mais **rien ne l'indique visuellement**. Il faudrait :
- Un timer visible ("3s pour relancer !")
- Un highlight du bouton relance
- Un son d'alerte

### Pas d'achat en lot
Acheter 5 charges = 5 clics successifs. Ajouter un "Shift+clic = acheter 5" ou un selecteur de quantite.

---

## PARTIE 5 : IDEES D'AMELIORATION (INSPIRES DU JEU VIDEO)

### Nouveaux pouvoirs possibles

| Pouvoir | Cat. | Effet | Inspiration |
|---------|------|-------|-------------|
| **Joker** | DEF | Relance la question (nouvelle question aleatoire) | Slay the Spire |
| **Multiplication** | OFF | Prochaine bonne reponse = 3x coins | Catan |
| **Immunite** | DEF | Bloque 1 event negatif ce tour | Risk |
| **Banditisme** | OFF | Vole 1 charge d'un pouvoir a une cible | Catan (voleur) |

### Mecaniques de jeu manquantes

1. **Combos de pouvoirs** : Utiliser Relance puis Foudre dans le meme tour = bonus de degats
2. **Synergie visuelle** : Dans la boutique, indiquer quels pouvoirs se combinent bien
3. **Cooldowns passifs** : Apres le tour 10, chaque pouvoir regagne +1 charge par tour
4. **Fusions endgame** : Apres le Niv.3, investir 50-100 coins pour des bonus permanents

### Ameliorations UX boutique

1. Indicateur de disponibilite ("Boutique dispo dans 20s")
2. Suggestions d'achat intelligentes
3. Preview des synergies entre pouvoirs
4. Historique des achats dans le journal

---

## PARTIE 6 : CORRECTIONS EFFECTUEES CE SOIR

1. **Boutique refondue** : Affiche maintenant tous les pouvoirs (acquis + non-acquis) avec deblocage en jeu
2. **Pouvoirs offensifs** : Utilisables pendant la fenetre pendingLanding (4s apres le lancer), pas seulement avant
3. **Fenetre de reaction** : Passee de 2s a 4s apres le lancer de de
4. **Flying coins** : Corrige la detection des gains (surveille toutes les equipes, pas seulement currentTeam)
5. **Nouvelle action buyNewPower** : Debloque un pouvoir avec 1 charge au Niv.1

---

## PRIORITE DES CORRECTIONS

| Priorite | Action | Effort |
|----------|--------|--------|
| 1 | Fix contradiction relance (store vs powerActivator) | Faible |
| 2 | Fix race condition pendingLanding + junction | Faible |
| 3 | Implementer event Marche Noir | Moyen |
| 4 | Ajouter verification bornes dans events | Faible |
| 5 | Timer visuel pour fenetre de relance | Moyen |
| 6 | Reequilibrer Bouclier (cout activation) | Faible |
| 7 | Fix Double Niv.2 (piege) | Faible |
| 8 | Ajouter verification solde avant activation | Faible |
| 9 | Fix ChargeIndicator max dynamique | Faible |
| 10 | Bulk buy dans la boutique | Moyen |
