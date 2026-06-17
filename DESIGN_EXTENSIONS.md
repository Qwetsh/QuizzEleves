# Design — Extensions « Maîtrise » & « Troc »

> Document de cadrage (validé le 2026-06-17). Statut : **design figé, implémentation à venir**.
> Décisions actées : branches de pouvoir gratuites au passage de niveau et définitives ;
> troc = sac + or + équipement porté, auto entre élèves (le prof a un droit de regard via l'historique/admin).

---

## 0. Principes communs

- **Deux extensions activables au Setup** (registre `src/extensions/`), verrouillées en cours de partie comme l'extension Objets.
  - `mastery` — « Maîtrise des pouvoirs » (niveaux 1→10 + embranchements).
  - `trade` — « Troc entre équipes ».
- **Le TBI reste maître de la logique.** Le mobile ne fait qu'émettre des *intents* ; le TBI applique, persiste (Supabase), republie l'état. Aucune règle de jeu ne vit côté mobile.
- **Rétrocompat** : sans l'extension, comportement actuel inchangé (pouvoirs à 3 niveaux ; pas de troc).
- **Réglable** : tout ce qui est chiffré passe à terme par `balanceConfig` (éditeur d'équilibrage) — on commet des valeurs de départ, calibrables sans toucher au code.

---

# Extension A — « Maîtrise des pouvoirs »

## A.1 Concept

Chaque pouvoir monte de **1 à 10**.
- **Niveaux 1-4 et 6-9** : montée en puissance « chiffrée » (le stat de cœur grandit, automatique).
- **Niveau 5 et niveau 10** : **embranchement** = choix parmi **3 spécialisations** qui changent la *nature* du pouvoir.
  - Choix **gratuit** au passage du niveau, **définitif** pour la partie.
  - Le choix L5 oriente le milieu de courbe ; le choix L10 est un « ultime ».

## A.2 Modèle de données

```
team.powers[key] = {
  charges: number,
  level:   1..10,        // était 1..3
  spec5:   null | 'a'|'b'|'c',   // voie choisie au L5 (clé d'une des 3 branches)
  spec10:  null | 'a'|'b'|'c',   // ultime choisi au L10
}
```

`src/data/powers.js` — chaque pouvoir gagne un bloc `tree` (présent seulement si on veut le L10 ;
sinon on garde `levels`/`upgradeCosts` actuels pour le mode sans extension) :

```js
tree: {
  // effet de cœur par niveau (1..10) — chiffres résolus par le moteur
  scale: [ /* 10 entrées : { ... } */ ],
  // 3 voies au L5 et au L10 : { key, name, icon, desc, effect:{...} }
  branch5:  [ {…}, {…}, {…} ],
  branch10: [ {…}, {…}, {…} ],
  // coûts d'or pour passer de Ln à Ln+1 (9 entrées : L1→2 … L9→10)
  upgradeCosts: [20, 30, 45, 65, 90, 120, 155, 195, 240],
}
```

## A.3 Résolveur central (clé de voûte)

Aujourd'hui chaque endroit lit `POWERS[key].levels[level-1].effect`. On centralise :

```
resolvePowerEffect(team, key) -> effet effectif
  = merge( tree.scale[level-1],
           level>=5  ? tree.branch5[spec5].effect  : {},
           level>=10 ? tree.branch10[spec10].effect : {} )
```

Tous les consommateurs (resolveWrongAnswer pour Bouclier, askQuestion pour Indice,
applyOffensivePower pour Foudre/Sablier/Double, useRelance) passent par ce résolveur.
**Avantage** : un seul point de vérité ; le mode « sans extension » renvoie simplement
`levels[min(level,3)-1].effect`.

## A.4 Courbe de coûts (point de départ, à calibrer)

| Passage | L1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 | 7→8 | 8→9 | 9→10 | total |
|--------|----|----|----|----|----|----|----|----|----|----|
| Or     | 20 | 30 | 45 | 65 | 90 | 120 | 155 | 195 | 240 | **960** |

Achat des améliorations **sur le TBI** (boutique, comme aujourd'hui) ; le **choix de voie** L5/L10
se fait **gratuitement** au moment où on atteint le niveau (popup TBI + possibilité de le faire depuis le mobile via un intent `chooseSpec`).

## A.5 Détail des 6 pouvoirs

> Cœur = ce qui scale L1-10. Voies L5 / L10 = 3 choix chacun. Chiffres = valeurs de départ.

### 🛡️ Bouclier — Défense (recul absorbé)
- **Cœur (cases retirées au recul)** : L1:2 · L2:3 · L3:4 · L4:5 · L5:6 · L6:6 · L7:7 · L8:8 · L9:9 · L10:total.
- **L5 — Voie :**
  - **Rempart doré** : en plus d'absorber, gagne **+1 or par case absorbée**.
  - **Contre** : quand le recul est absorbé, **relance gratuitement la question** (2ᵉ chance).
  - **Égide** : le bouclier protège **aussi contre la Foudre** adverse (exception levée).
- **L10 — Ultime :**
  - **Forteresse** : recul **totalement annulé** en permanence.
  - **Réflexion** : l'attaquant (Foudre/duel) **subit la moitié** du recul qu'il voulait infliger.
  - **Trésor de guerre** : chaque absorption rapporte **+10 or et 1 charge** d'un pouvoir au hasard.

### 💡 Indice — Défense (réponses éliminées / temps)
- **Cœur** : réponses masquées 1→2→2→3 + bonus de temps croissant (0→+10 s).
- **L5 — Voie :**
  - **Clairvoyance** : −1 mauvaise réponse de plus **et** révèle le thème à l'avance.
  - **Sérénité** : gros **bonus de temps** (timer ×1.5).
  - **50/50** : sur une question à 4 choix, **garde toujours 2 réponses**.
- **L10 — Ultime :**
  - **Omniscience** : **révèle la bonne réponse** (1×/tour, coûte 2 charges).
  - **Maître du temps** : **pas de timer** sur la question (1×/tour).
  - **Antisèche** : 50/50 garanti **+ bonus d'or** si bonne réponse.

### 🎲 Relance — Défense (relance le dé)
- **Cœur** : remplace → garde le meilleur → somme → (L4+) relances multiples / planchers croissants.
- **L5 — Voie :**
  - **Double dé** : avance de la **somme de 2 dés**.
  - **Dé chanceux** : relance **jusqu'à obtenir ≥ 4**.
  - **Pilote** : après la relance, **choisis ta voie** aux jonctions.
- **L10 — Ultime :**
  - **Triple chance** : garde le **meilleur de 3 dés**.
  - **Bond** : avance directement jusqu'à la **prochaine case avantageuse**.
  - **Surcharge** : la relance **recharge aussi un pouvoir** au hasard.

### ⚡ Foudre — Attaque (recule une cible)
- **Cœur (dé de recul)** : 1D4 → 1D6 → 1D8 → 1D10 → … → 1D12 + bonus plat aux hauts niveaux.
- **L5 — Voie :**
  - **Chaîne** : touche **aussi l'équipe la mieux placée** (2 cibles).
  - **Surcharge** : recul **+50 %** mais coûte **+1 charge**.
  - **Tempête ciblée** : la cible **perd aussi de l'or**.
- **L10 — Ultime :**
  - **Cataclysme** : recule **toutes les autres équipes**.
  - **Bannissement** : renvoie la cible **à la dernière jonction**.
  - **Orage** : pose un **piège-foudre** sur une case du plateau.

### ⏱️ Sablier — Attaque (réduit le timer de la cible)
- **Cœur (diviseur)** : /2 → /3 → /4 → … jusqu'à /6.
- **L5 — Voie :**
  - **Taxe du temps** : la cible **perd de l'or** si elle dépasse le temps.
  - **Confusion** : masque brièvement l'énoncé en plus.
  - **Silence** : la cible **ne peut pas utiliser de pouvoir** à son prochain tour.
- **L10 — Ultime :**
  - **Gel** : la cible **saute son prochain lancer**.
  - **Vol de temps** : le temps retiré est **ajouté à ton prochain tour**.
  - **Tempête de sable** : timer réduit pour **toutes les autres équipes**.

### ❓ Double question — Attaque (questions en plus à la cible)
- **Cœur (questions ajoutées)** : +1 → +1 → +2 → +2 → … jusqu'à +4, réductions de timer aux hauts niveaux.
- **L5 — Voie :**
  - **Examen surprise** : une question est **Hardcore** — gros bonus si tout est juste, recul aggravé sinon.
  - **Chrono partagé** : **un seul timer** pour toute la rafale, mais **+50 % d'or** par bonne réponse.
  - **Rafale tranquille** : **+1 question**, mais gain par question **÷2**.
- **L10 — Ultime :**
  - **Interro générale** : la cible **subit aussi** la double au tour suivant.
  - **Tout ou rien** : **×2 gains** si 100 % réussi, **0** sinon.
  - **Marathon+** : encore **+2 questions** + chrono partagé offert.

## A.6 UI

- **Mobile** : l'**arbre de talent** (déjà en place) affiche les 10 paliers ; aux L5/L10 atteints,
  les 3 voies deviennent **choisissables** (intent `chooseSpec`). Les voies non prises restent grisées.
- **TBI** : la boutique propose l'amélioration de niveau ; au passage L5/L10, une modale de choix de voie
  (réutilisable depuis le mobile). L'éditeur d'équilibrage expose la courbe de coûts.

## A.7 Compatibilité / migration

- Sauvegardes existantes : `level` 1-3 conservé ; `spec5/spec10` absents = `null` (pas d'effet).
- Sans l'extension `mastery` : `upgradePowerLevel` plafonne à 3 (actuel) ; le résolveur ignore les specs.
- Les pouvoirs sans bloc `tree` (au cas où) retombent sur `levels` (mode 3 niveaux).

## A.8 Points d'équilibrage ouverts (à trancher en test)

1. Courbe de coûts (ci-dessus) : trop chère / pas assez ?
2. Certaines voies sont des **malus/bonus** (risque/récompense) — vérifier qu'aucune n'est strictement dominante.
3. Les ultimes « toutes les équipes » (Cataclysme, Tempête de sable) sont-ils trop puissants à 3+ équipes ?

---

# Extension B — « Troc entre équipes »

## B.1 Concept

Échanges **équipe ↔ équipe** initiés depuis le **mobile**. Une équipe propose un troc
(**je donne** : or + objets du sac + équipement porté / **je veux** : or + objets), l'autre **accepte ou refuse**
sur son tél. **Application automatique** dès acceptation ; le prof garde un droit de regard (historique + admin).

Cas d'usage : vendre un objet à une équipe précise, échanger objet contre objet, payer, faire un don.

## B.2 Modèle de données (Supabase)

Nouvelle table `quete_trades` :

```
{
  id,            // pk
  code,          // code de session
  from_idx,      // index équipe proposante
  from_token,    // jeton propriétaire (auth légère, comme les intents)
  to_idx,        // index équipe destinataire
  give: {        // ce que l'émetteur donne
    gold: number,
    bag:  [ itemKey, ... ],          // cases du sac
    equip:[ slot, ... ],             // slots d'équipement portés
  },
  want: {        // ce que l'émetteur demande en retour (peut être vide = don)
    gold, bag, equip
  },
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'applied' | 'failed',
  created_at,
}
```

> Réutilise le pattern d'auth « token par équipe » des intents (`quete_intents`).

## B.3 Flux

```
1. (Mobile A) compose une offre : sélectionne dans SON sac/équipement/or ce qu'elle donne,
   et dans le sac/équipement/or de B ce qu'elle veut. -> INSERT quete_trades (pending).
2. Realtime -> (Mobile B) reçoit une notif d'offre entrante : voit give/want, Accepter / Refuser.
   (Mobile A) peut Annuler tant que pending.
3. B accepte -> UPDATE status='accepted'.
4. (TBI) TradeConsumer (Realtime, comme IntentConsumer) détecte 'accepted' :
   - RE-VÉRIFIE atomiquement que A possède bien tout son `give` ET B tout son `want`
     à l'instant T, et qu'aucune des 2 n'est en pleine résolution (verrou) ;
   - si OK : transfert croisé (or, objets sac, déséquipement->transfert équipement),
     status='applied', log « 🤝 A et B ont fait affaire » ;
   - sinon : status='failed', log « troc annulé (objet/or indisponible) ».
5. Suppression/purge des lignes traitées.
```

## B.4 Application atomique (côté TBI)

- Un seul `set()` qui patche les deux équipes (jamais d'état intermédiaire où l'objet a disparu des deux).
- Garde-fous : or jamais négatif ; case de sac libre côté receveur (sinon revente auto +remboursement
  comme `placeItem`) ; un équipement reçu va **dans le sac** du receveur (pas auto-équipé).
- **Verrou** : refus si l'une des deux équipes est l'équipe active **en résolution** (`locked`), comme l'édition d'équipement.

## B.5 UI mobile

- Nouvel **onglet « 🤝 Troc »** (gated par l'extension `trade`), à côté de Boutique.
- Écran : liste des **offres reçues** (Accepter/Refuser) + **offres envoyées** (Annuler) + bouton **« Proposer un troc »**.
- Compositeur de troc : choisir l'équipe cible, puis 2 colonnes « Je donne » / « Je veux »
  (piochées dans les inventaires publiés dans la session). Réutilise la modale objet centrale pour les détails.

## B.6 Règles actées

- Échangeable : **sac + or + équipement porté** (pas les charges de pouvoir).
- **Auto entre élèves** : appliqué dès acceptation. Le prof peut **annuler/rembourser** via l'interface admin (intents `admin*` existants) en cas d'abus.
- Don = offre avec `want` vide. Vente = `give` objet / `want` or. Échange = objet/objet.

## B.7 Phasing

1. **Don/paiement simple** : A envoie or et/ou 1 objet à B (B accepte). (valide le tuyau Realtime + transfert atomique)
2. **Troc complet** : compositeur give/want bilatéral, accept/decline/cancel.
3. **Marché ouvert** (optionnel) : offres « publiques » visibles par toutes les équipes (premier qui accepte rafle).

## B.8 Points ouverts

1. Limite anti-spam d'offres (ex. 1 offre en attente par couple d'équipes) ?
2. Notification visuelle sur le TBI quand un troc s'applique (toast) ?
3. Le marché ouvert (phase 3) : utile en classe ou trop chaotique ?

---

# Plan d'implémentation (ordre proposé)

### Extension A — Maîtrise
1. Registre : entrée `mastery` + gate.
2. `powers.js` : blocs `tree` (scale 1-10, branch5, branch10, upgradeCosts) pour les 6 pouvoirs.
3. `resolvePowerEffect()` central + branchement de TOUS les consommateurs dessus.
4. `upgradePowerLevel` : plafond 10 si extension, coûts depuis `tree.upgradeCosts`.
5. Choix de voie : action/intent `chooseSpec` + modale TBI + déblocage dans l'arbre mobile.
6. Tests (résolveur, paliers, specs, compat 3 niveaux, gate).

### Extension B — Troc
1. Migration Supabase `quete_trades` + helpers `sessionConfig` (create/subscribe/update/purge).
2. Registre : entrée `trade` + gate.
3. `TradeConsumer` (TBI) + application atomique (`applyTrade`).
4. Onglet mobile « Troc » : offres reçues/envoyées + compositeur.
5. Phasing 1→2 (→3 optionnel).
6. Tests (application atomique, verrous, or négatif, sac plein, refus/annulation).

### Tests transverses
- Build + suite Vitest verte à chaque phase.
- Garde-fous de migration de save (specs absents, niveaux > 3 ignorés sans extension).

---
---

# Design — Extensions « Alchimie » & « Enchantement »

> Cadrage validé le 2026-06-18. Décisions actées :
> Alchimie = **recettes fixes prédéfinies** (découvertes en trouvant le bon combo), grimoire **par équipe**,
> ingrédient utilisé seul = **bonus mineur + le révèle** au grimoire.
> Enchantement = lié à la **pièce précise** (suit l'objet si déséquipé/troqué/vendu) → objets en **instances**.
> Les deux dépendent de l'extension Objets (`needsItems`).

## ⚗️ Extension « Alchimie »

### Modèle de données
- Les consommables gagnent un champ `family: 'ingredient' | 'potion'` (absent = consommable normal).
- **Ingrédient** : un consommable `family:'ingredient'` avec un **effet mineur** (ses `effects` habituels, faibles).
- **Potion** : un consommable `family:'potion'` avec un effet **majeur**.
- **Recettes** (data + éditeur) : `{ id, ingredients:[keyA,keyB,keyC], potion: potionKey }`. L'ordre des 3 ingrédients n'importe pas (comparaison par multiset).
- État par équipe : `team.knownIngredients: Set<key>` (révélés en utilisant seul) et `team.knownRecipes: Set<recipeId>` (réussis).

### Flux
- **Ingrédient utilisé seul** (carte active, comme un consommable) → applique son effet mineur **et** ajoute la clé à `knownIngredients`.
- **Atelier (mobile)** : 3 emplacements + bouton **« Distiller »** (animé). → intent `craft { bag:[i,j,k] }`.
- **TBI (`applyCraft`)** : vérifie 3 ingrédients distincts du sac, cherche une recette correspondante (multiset).
  - **Match** : consomme les 3, ajoute la **potion** au sac (placeItem), `knownRecipes.add(id)`, log « ✨ Recette découverte ! ».
  - **Pas de match** : consomme les 3 (ou 1 seul ? — décision d'implémentation : on consomme les 3, ratage = « eau trouble » sans effet) et log « 💨 Distillation ratée ».
- **Grimoire (mobile)** : liste des recettes — **découvertes** affichées en clair (ingrédients → potion), **non découvertes** en `? + ? + ? → ?`. Ingrédients du sac : effet mineur affiché si `knownIngredients`.

### Publication / mobile
- `buildSessionPayload` publie `knownRecipes` + `knownIngredients` de l'équipe + le catalogue des recettes (ids + état). Le mobile résout ITEMS/recettes localement (comme POWERS/ITEMS).
- Catalogue de recettes : table Supabase `quete_recipes` **OU** (plus simple) un fichier `src/data/recipes.js` éditable comme les events. **Décision implémentation : fichier + éditeur léger** (pas de table au début).

### UI
- Atelier : 3 cases (tap un ingrédient du sac → le pose), bouton Distiller (animation de bulles), résultat révélé.
- Grimoire : onglet ou section, liste recettes avec `?` masquant le non-découvert.

## 📜 Extension « Enchantement »

### Modèle d'instance (refonte douce du modèle d'objet)
- Un objet peut désormais être soit une **clé** `"casque"`, soit une **instance** `{ key, enchants:[effect,…] }`.
- Sac : la cellule passe de `null | "key" | {key,n}` à pouvoir contenir `{key, n, enchants}` (un objet enchanté = **non empilable**, n=1).
- Équipement : `team.equipment[slot]` = clé **ou** instance `{key, enchants}`.
- Helpers centraux (itemHandlers) : `itemKeyOf(x)`, `itemEnchantsOf(x)`, normalisation préservant `enchants`. `cellKey/cellN` déjà tolérants ; ajout de `cellEnchants`.

### Lecture des effets
- `equippedItems(team)` renvoie, pour chaque slot, l'objet + ses `enchants`. `getEffectValue` / `triggersOf` / `equipOnRollActions` somment **effets de base + enchantements**.
- Donc un parchemin `on:roll 5 → +15 or` posé sur la tête se comporte comme si le casque avait ce déclencheur.

### Parchemins
- Consommable `family:'parchment'` avec un champ `enchant` = un **effet/déclencheur** (réutilise le schéma de l'éditeur d'effets : passif `{type,value}` ou `{kind:'trigger', on, do}`).
- **Utiliser un parchemin** → ouvre un sélecteur de **pièce équipée** (slots non vides) → ajoute `enchant` aux `enchants` de **cette instance** (équipe-la en instance si besoin). Consomme le parchemin.
- L'enchantement **suit la pièce** : déséquiper (→ sac) garde l'instance enchantée ; troc/vente transfèrent l'instance entière.

### Impacts
- itemHandlers : placeItem/normalizeBag/move/sell tolèrent les instances (pas d'empilement des enchantés ; prix de revente inchangé ou +bonus).
- Trade (`applyTrade`) : transférer l'**instance** (clé + enchants), pas juste la clé.
- Mobile : afficher un liseré/✦ sur les objets enchantés + lister leurs effets ; action « Enchanter » au tap d'un parchemin.
- Éditeur d'objets : créer des parchemins (`family:'parchment'` + champ enchant via EffectBuilder).

## Plan d'implémentation (ordre)
1. **Socle commun** : champ `family` sur les consommables ; entrées registre `alchemy` + `enchant` (needsItems).
2. **Alchimie** : data ingrédients/potions/recettes ; usage seul (effet mineur + reveal) ; `applyCraft` (TBI) + intent ; atelier + grimoire mobile ; publication ; éditeur de recettes ; tests.
3. **Enchantement** : modèle d'instance (`itemKeyOf`/`itemEnchantsOf`, normalisation) ; lecture d'effets enchantés ; parchemins (`family:'parchment'` + enchant) ; usage → sélecteur de pièce → applique ; trade/sell/mobile ; éditeur ; tests.
