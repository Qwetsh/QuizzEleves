# Version hors ligne & application native (Tauri)

Deux cibles **en plus** du déploiement en ligne (GitHub Pages). Le build en ligne
(`npm run build`) reste strictement inchangé : tout le code hors ligne est gardé
par le flag `VITE_OFFLINE` et éliminé du bundle en ligne au tree-shaking.

## 1. Build web hors ligne

Fige les données de la base Supabase dans le bundle et coupe tout le réseau
(volet téléphone, éditeurs, Realtime masqués).

```bash
npm run build:offline   # 1 fois EN LIGNE : snapshot de la base + build → dist/
```

- `scripts/snapshot-offline.mjs` capture les 5 tables (questions, objets,
  équilibrage, événements, recettes) dans `src/data/offlineSnapshot.json`, au
  format interne du jeu. Les images d'objets uploadées (URL Storage) sont
  rapatriées en **data URL** base64 → 100 % autonomes.
- `src/data/offlineSnapshot.json` est versionné comme **placeholder `{}`** ;
  `build:offline` le régénère localement (~0,5 Mo). **Ne pas committer la version
  remplie** (elle vieillit et alourdit le repo).
- Base relative (`./`) → `dist/` est servable depuis n'importe quel dossier.

⚠️ `dist/index.html` ne s'ouvre **pas** en double-clic (`file://` bloque les
modules ES). Il faut le servir (serveur statique local) **ou** passer par
l'application native ci-dessous.

### Reste en ligne : les polices
Les polices (Lilita One / Fredoka / Inter) sont encore chargées depuis Google
Fonts. Sans connexion, l'app retombe sur les polices système (thème dégradé mais
fonctionnel). Pour un offline 100 % fidèle : héberger les polices en local.

## 2. Application native Windows (Tauri)

Empaquette le build hors ligne dans un `.exe` installable : double-clic, plein
écran, vrai offline, pas de navigateur. Utilise **WebView2** (présent par défaut
sur Windows 10/11), donc l'installeur reste léger (~5-15 Mo).

### Prérequis (à installer UNE fois sur la machine de build)

1. **Rust** : https://rustup.rs/
2. **VS Build Tools (MSVC + SDK)** : https://aka.ms/vs/17/release/vs_BuildTools.exe
   (cocher « Développement Desktop en C++ »).

Vérifier avec `npx tauri info` (doit montrer ✔ rustc, Cargo, MSVC, WebView2).

### Build

```bash
npm run tauri:build    # lance build:offline puis compile l'installeur
```

L'installeur NSIS est produit dans
`src-tauri/target/release/bundle/nsis/`.

### Dev

```bash
npm run tauri:dev      # fenêtre native + hot reload (frontend EN LIGNE)
```

### À savoir
- **Signature** : l'`.exe` n'est pas signé → SmartScreen affichera un
  avertissement « éditeur inconnu » à la 1re exécution. Pour une distribution
  large, prévoir un certificat de signature de code.
- **Icône** : remplacer l'icône par défaut avec
  `npx tauri icon chemin/vers/icone.png` (génère tous les formats).
- Config : `src-tauri/tauri.conf.json` (fenêtre maximisée, titre, identifiant
  `fr.quetematieres.app`, cible `nsis`).
