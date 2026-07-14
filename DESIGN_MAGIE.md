# DESIGN — Extension « Magie » (sorts tracés au doigt)

> Design figé le 2026-07-14. Plan détaillé : `~/.claude/plans/vast-finding-riddle.md`.

## 1. Vision

Chaque équipe dispose d'une **barre de magie** qui se recharge en **temps réel** (« magie
par minute », pas par tour). Pour lancer un sort, un élève **trace une séquence de signes
(runes) au doigt** sur la « table des sorts » de son téléphone ; le TBI valide et joue une
cérémonie spectaculaire. Les runes et combinaisons connues sont archivées dans un **codex**
consultable à tout moment. Au départ une équipe ne connaît que 2-3 sorts ; les autres se
**gagnent** (loot, événements, objets) ou se **découvrent** en traçant une combinaison
valide inconnue. Une combinaison invalide = **fizzle**, le coût de tentative est perdu.

## 2. Décisions verrouillées

| Sujet | Décision |
|---|---|
| Surface de tracé | **Téléphone d'abord** (secret des combos) ; modale TBI en fallback (sans téléphone / DEV) |
| Visuel | **100 % procédural** (canvas/SVG/CSS) — pas de planches IA en v1 |
| Scope v1 | Socle + effets spéciaux (faces bénies/maudites + purge, réponses instables) |
| Apprentissage | Gagné **et** expérimentation (découverte en traçant) ; fizzle payant |
| Reconnaissance | $1 Unistroke Recognizer maison (`src/logic/gestures.js`), zéro dépendance |
| Sort | Séquence **ordonnée** de 2-3 runes (≠ multiset alchimie) |
| Régen | Modèle **accrual lazy** : `magic = {stored, lastTs}`, valeur calculée à la lecture ; matérialisation aux transactions + à `nextTurn` ; barres animées localement (zéro republish) |
| Cast hors tour | Autorisé, mais **garde globale `resolving`** (file `pendingActions` unique) ; jamais de picker suspendu sur le chemin intent (cible/face choisies au téléphone ; « magie sauvage » aléatoire en découverte) |
| Cérémonie | Overlay TBI dédié `SpellCeremony` (pattern ForgeCeremony), jouée même pour un cast téléphone |
| Vieilles saves | Backfill `extensions.magic = false` si clé absente (extOn : absent = actif) ; `lastTs = now` au resume |

## 3. Modèle de données

```js
// Équipe (init dans _beginGameWithBoard si extOn('magic'), backfill au resumeGame)
team.magic      = { stored: MAGIC.start, lastTs: Date.now() }
team.knownRunes  = ['cercle', 'eclair', 'fleche', 'vague']   // clés runes.js
team.knownSpells = ['etincelleDoree', 'pasDeLEclair']        // clés spells.js
team.faceMods    = { 3: { kind: 'bless', gold: 10, by: 0 } } // slot 1..6, écrase

// Sort (src/data/spells.js fallback + table quete_spells, setCustomSpells)
{ key, name, name_en, runes: ['cercle','eclair'], cost: 20, icon, color,
  desc, desc_en, actions: [{ action: 'money', mode: 'gain', n: 10, target: 'self' }] }

// Rune (src/data/runes.js)
{ key, name, name_en, glyph (SVG path), template: [{x,y}...] } // template = tracé $1
```

Balance : `MAGIC = { max, regenPerMin, start, fizzleCost, answerRuneRate, starterRunes,
starterSpells, recogThreshold, castCooldownMs }` (DEFAULT_MAGIC + overrides quete_balance).

## 4. Flux de cast

1. Mobile onglet **✨ Sorts** : tracé canvas → reconnaissance $1 au relâcher (sous le seuil
   = rejet local **gratuit**, pas d'intent) → séquence de runes → cible/face si sort connu →
   **Incanter** (grisé via `session.locked`).
2. Intent `castSpell { runes, target?, face? }` (dédup par `row.id`, IntentConsumer).
3. TBI `applyTeamIntent` → garde globale `resolving` → `castSpellFor(teamIdx, payload)` :
   match séquence exacte → coût vs `magicNow` → connu : cast ; valide inconnu : **découverte**
   (learnSpell + fanfare) ; invalide : **fizzle** (`MAGIC.fizzleCost`) →
   `runEffects(spell.actions, { sourceTeam: idx, targetTeam })` → cérémonie + son + journal
   + `gameStats.spellCasts` + save.
4. TBI : overlay `SpellCeremony` (~2 s) — cercle magique, glyphes en orbite, convergence,
   flash couleur du sort ; variantes fizzle/découverte. `'spellCeremony'` dans RENDER_FIELDS.

## 5. Nouvelles actions moteur

`gainMagic`, `learnRune`, `learnSpell` (clé ou aléatoire-inconnue), `blessFace`, `curseFace`,
`cleanseFaces`, `unstableAnswers` (pose `modeleurInterval: min(existant || 99, n)` sur la
cible — réutilise le Modeleur du Sablier, consommé à la **prochaine question principale**),
buff `magicRegen` (+X/min pendant N tours), passifs objet `magicRegen`/`magicMax` (valeurs
**fixes** uniquement : `getEffectValue` relance les dés à chaque appel).

Faces bénies/maudites : résolues dans `handleDiceResult` après `resolveFaceAtRoll` (±or,
hors pipeline déplacement). Indépendantes de `team.dieFaces` (marchent sans forge, survivent
au re-forgeage). Non volables/échangeables en v1.

## 6. Contenu v1 (fallback — DB = vérité ensuite)

8 runes : cercle ○, triangle △, éclair ⚡, vague 〜, flèche →, serpent S, spirale ◎, croix ✕.
~7 sorts : Étincelle dorée (○⚡, 20 → +10 or) · Pas de l'éclair (⚡→, 30 → avance 2) ·
Main invisible (◎〜, 40 → vole 10 or) · Bénédiction du dé (△○✕, 50) · Malédiction du dé
(S△⚡, 50, cible) · Purification (✕○, 30) · Brouillard mental (〜S, 45, cible).
Départ : 4 runes, 2-3 sorts connus.

## 7. Plan d'implémentation

- **P1 Socle** : registry, balanceConfig MAGIC, runes/spells/magic.js, spellsConfig,
  gameStore (init/backfill/castSpellFor/engine*/faceMods/nextTurn), effectEngine (7 cases),
  effectText, types, i18n, tests.
- **P2 Intents + TBI** : case `castSpell`, gestures.js ($1), SpellTableView/CodexView,
  SpellCeremony + sons, modales TBI, jauges HUD, marqueurs FaceTile/Dice3D, glossaire.
- **P3 Mobile** : payload session, onglet ✨ MobileApp, onlineSnapshot.
- **P4 Éditeur + contenu** : onglet Sorts BalanceEditor, EffectBuilder, événements/objets
  exemples, canal loot runes, table `quete_spells` + seed.

## 8. Hors scope v1

Sons dédiés par sort, planches IA, écoles/cooldowns par sort, RPC anti-triche stricte pour
le codex, vol/échange de runes, faceMods au-delà de ±or, apprentissage en boutique.
