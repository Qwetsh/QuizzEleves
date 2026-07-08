# DESIGN — Mode « Jeu en ligne » (100 % à distance)

> Statut : **cadrage** (2026-07-08). Aucune ligne de moteur écrite pour l'online.
> Décisions produit prises (§0). Le reste du document découle de ces choix.

## 0. Décisions verrouillées

| Question | Décision | Conséquence |
|---|---|---|
| Public visé v1 | **Entre amis / privé d'abord**, porte ouverte au public plus tard | Anti-triche « raisonnable » suffit pour v1 ; on isole le moteur pour pouvoir passer serveur ensuite |
| Autorité | **Client-hôte** (un navigateur joueur héberge le moteur existant) | Réutilisation maximale du moteur Zustand ; il faut gérer persistance + migration d'hôte |
| Frontend | **Deux frontends** : mode classe (TBI + compagnon) **inchangé** + nouveau **client online** complet et responsive | Le mode classe qui marche n'est pas déstabilisé ; code partagé au maximum |

**Non-objectifs v1** : matchmaking public entre inconnus, classements, autorité serveur, anti-triche fort contre un hôte malveillant.

---

## 1. Constat de l'existant (ce que le code impose)

- **Autorité unique = le TBI.** Tout l'état vit dans **un seul store Zustand local**. Cette machine calcule tout (dé, déplacements, loot, événements, questions, combats — tous les `Math.random()` côté TBI) et persiste en **localStorage local**.
- **Supabase = simple relais**, jamais source de vérité :
  - `quete_game_sessions` : le TBI **diffuse** un payload (≈250 ms + heartbeat 15 s) ;
  - `quete_intents` : les téléphones **envoient des commandes** (`turn*`, achats, admin…), le TBI valide/applique/supprime ;
  - `quete_lobby_teams`, `quete_trades`, `quete_game_stats`.
- **Pas de backend, pas d'auth** : clé anon publique dans le bundle, sécurité RLS seule, pas de présence, pas d'ordre garanti.

**Tremplin déjà en place — le mode « manette » :** l'équipe active pilote **déjà tout son tour** depuis son téléphone (dé, réponses, cibles, voies, pouvoirs, événements, coffre, boutique) via les intents `turn*`, avec anti-triche (bonne réponse jamais envoyée avant révélation, deadline dans le store, TBI = horloge). ~80 % de « jouer un tour à distance » est résolu.

**Restant « TBI-only » :** rendu du **plateau**, animations, modales (question/événement/combat), **mini-jeux de duel**, **choix de case (tilePicker)**.

**Le mode « 🌐 Jeu en ligne »** = bouton stub (`ready:false`, `SelectionCassettes.jsx`), sans `conn`, sans logique.

---

## 2. Paradigme

En classe : **un écran partagé** (TBI). En ligne : **il n'existe plus**. Deux conséquences indépendantes :

- **(A) Autorité** : qui calcule la partie ? → **un client-hôte** tient le moteur existant en « TBI headless ».
- **(B) Rendu** : chaque joueur voit **le plateau complet** sur son écran, pendant son tour **et** celui des autres.

### « Jouer pendant le tour adverse » (question fondatrice)
Le clivage TBI / compagnon **disparaît**. Pendant le tour d'en face, chaque joueur :
1. **regarde le plateau vivant** sur son propre écran (état synchronisé) ;
2. fait ses **actions asynchrones sur lui-même** (inventaire, boutique, artisanat, **propositions de troc**) — déjà supportées comme intents hors-tour.
Le « compagnon lecture seule » **fusionne** dans le client complet (= « mon plateau quand ce n'est pas mon tour »).

---

## 3. Architecture cible v1 (client-hôte)

```
        ┌───────────────── Supabase (relais + persistance) ─────────────────┐
        │  quete_game_sessions.data = ÉTAT AUTORITAIRE COMPLET (snapshot)    │
        │  quete_intents = commandes joueurs → hôte                          │
        │  Presence = qui est connecté                                       │
        └───────────────────────────────────────────────────────────────────┘
                 ▲ diffuse état            ▲ envoient intents
                 │                         │
        ┌────────┴─────────┐      ┌────────┴─────────┐      ┌──────────────────┐
        │  CLIENT HÔTE     │      │  CLIENT JOUEUR   │  …   │  CLIENT JOUEUR    │
        │  moteur Zustand  │      │  store MIROIR    │      │  store MIROIR     │
        │  (autorité)      │      │  (lecture)       │      │  (lecture)        │
        │  + rend plateau  │      │  + rend plateau  │      │  + rend plateau   │
        └──────────────────┘      └──────────────────┘      └──────────────────┘
```

- **Un** client détient le moteur (autorité). Il joue aussi comme joueur normal.
- Les autres ont un **store miroir** hydraté par la diffusion ; ils **rendent le plateau** et **envoient des intents** pour agir.
- **Isolation du moteur** : séparer proprement « calculer l'état » (autorité) de « rendre l'état » (tous). C'est la clé pour, plus tard, déplacer l'autorité vers un serveur (modèle B) sans réécrire le rendu.

---

## 4. Réutilisation vs construction

| Brique | État | Action online |
|---|---|---|
| Moteur (tour, dé, questions, effets, combats) | ✅ | Réutilisé tel quel côté hôte |
| Intents `turn*` | ✅ | Réutilisés ; l'actif rend **ses propres** modales |
| Anti-triche réponse (correctIndex caché) | ✅ | Réutilisé, **étendu aux spectateurs** |
| Diffusion d'état (payload) | ⚠️ team+turn only | **Élargir à l'état complet** (plateau, positions, waypoints d'anim) |
| Rendu plateau/modales | ❌ TBI-only | **Rendre depuis l'état synchronisé** sur chaque client |
| tilePicker / choix de case | ❌ TBI-only | **Porter sur le client actif** |
| Mini-jeux de duel | ❌ TBI-only | **Porter sur les 2 participants** |
| Persistance | ❌ localStorage hôte | **Persister l'autorité dans Supabase** (resume + migration) |
| Présence / déconnexion | ❌ | **Construire** (Supabase Presence) |
| Lobby | ⚠️ QR en salle | **Salon en ligne** (lien, ready-up, rejoin) |
| RLS | ⚠️ permissive | **Durcir** par session + par token |

---

## 5. Bloquants & risques

1. **Déconnexion de l'hôte** → partie morte. *Mitig.* : état autoritaire persisté dans Supabase + **migration d'hôte** (un autre client reprend depuis le dernier snapshot). Non trivial → Phase 4.
2. **Anti-triche** : en modèle A, l'hôte connaît tout (il EST le moteur). **Acceptable entre amis** ; rédhibitoire en public → basculer modèle B (serveur) le jour venu.
3. **Rendu plateau sur petit écran** : UI pensée grand TBI → **passe responsive** (plateau zoomable/pannable, HUD compact). Gros morceau UX → Phase 5.
4. **Horloge & latence** : deadline = horloge de l'hôte ; diffuser la **deadline absolue** + **marge de grâce** côté hôte.
5. **Volume/fréquence de synchro** : diffuser l'état complet toutes les 250 ms peut exploser → **throttle par événements**, éventuels deltas.
6. **Abandon en plein tour** : pause + timer de reconnexion / **auto-skip** / reprise par l'hôte → à designer (Phase 4).
7. **RLS** : policies **par code de session** + **par token** (aujourd'hui un client lit tout).
8. **Ordre des intents non garanti** + races sous latence réelle → re-vérifier les gardes existantes.
9. **Mini-jeux & tilePicker TBI-only** → à porter (Phase 3).
10. **Rejoindre / quitter** : lien/room en ligne + gestion des arrivées/départs.
11. **i18n par appareil** (langue aujourd'hui globale via l'hôte). Son déjà par-appareil ✅.
12. **Déploiement** : modèle A tient en **statique (GitHub Pages) + Supabase**, sans backend. Modèle B imposerait des Edge Functions (nouvelle infra).

---

## 6. Feuille de route

- **Phase 0 — Cadrage** ✅ (ce document).
- **Phase 1 — Synchro d'état complet + plateau spectateur** : élargir le payload à l'état complet ; rendre `GameLayout`/plateau **en lecture** sur un client non-autoritaire. *Livrable : je vois la partie de l'hôte en direct sur mon écran.*
- **Phase 2 — Autorité déportée** : moteur en « hôte headless », persistance de l'autorité dans Supabase, présence + **resume**. *Livrable : une partie tient sans TBI physique.*
- **Phase 3 — Interactions distribuées** : chaque joueur rend **ses** modales/tilePicker/choix ; mini-jeux de duel sur les 2 appareils. *Livrable : un tour 100 % à distance, duels compris.*
- **Phase 4 — Robustesse** : déconnexion/reconnexion/**migration d'hôte**, anti-triche spectateur, durcissement RLS, throttle réseau.
- **Phase 5 — Onboarding & polish** : salon en ligne (lien, ready-up, rejoin), passe **responsive** du plateau, i18n par joueur, finitions.

---

## 7. Prochaine étape

Détailler la **Phase 1** en tâches concrètes (élargissement du payload, store miroir, montage du client online derrière le stub `online`), sans toucher au mode classe.
