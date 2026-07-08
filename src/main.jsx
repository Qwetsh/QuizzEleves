import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MobileApp from './components/Mobile/MobileApp';
// Dashboard d'analyse (?analyse) : chargé paresseusement (jamais embarqué dans
// le chemin élève/jeu si on n'ouvre pas l'URL).
const DashboardApp = lazy(() => import('./components/Dashboard/DashboardApp'));
// Preview autonome du nouvel écran de sélection « Lecteur de cassettes » (?cassettes) :
// données mock, non câblé au jeu. Paresseux pour ne pas l'embarquer dans le flux TBI.
const CassettesPreview = lazy(() => import('./components/Setup/SelectionCassettes'));
// Calibrateur de continents de l'univers espace (?calibrate) : outil DEV
// autonome (maps v2), aucune donnée Supabase requise.
const MapCalibrator = lazy(() => import('./components/Dev/MapCalibrator'));
// Client « jeu en ligne » spectateur (?online=CODE) : miroir lecture de la
// partie de l'hôte. Paresseux (hors du bundle TBI/mobile par défaut).
const OnlineClient = lazy(() => import('./components/Online/OnlineClient'));
// Polices auto-hébergées (bundlées) au lieu du CDN Google Fonts : fonctionnent
// hors ligne et évitent tout appel réseau. Familles : Lilita One (display),
// Fredoka (UI), Inter (corps) — cf. --font-display/--font-ui/--font-body.
import '@fontsource/lilita-one/400.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './styles/index.css';
import './styles/animations.css';
import { applyCachedBalance, refreshBalance } from './logic/balanceConfig';
import { applyCachedItems, refreshItems } from './logic/itemsConfig';
import { applyCachedEvents, refreshEvents } from './logic/eventsConfig';
import { applyCachedQuestions, refreshQuestions } from './logic/questionsConfig';
import { applyCachedRecipes, refreshRecipes } from './logic/recipesConfig';
import { applyCachedCategories, refreshCategories } from './logic/categoriesConfig';
import { applyCachedThemes, refreshThemes } from './logic/themesConfig';
import { useGameStore } from './store/gameStore';

// Le companion mobile s'ouvre via l'URL d'appairage (?join=CODE) : c'est une
// vue lecture seule, indépendante du moteur de jeu du TBI.
const params = new URLSearchParams(window.location.search);
const joinMode = params.has('join');
// Spectateur « jeu en ligne » : miroir lecture d'une partie hébergée par un hôte.
const onlineMode = params.has('online');
// Dashboard d'analyse : vue dédiée, hors flux de jeu (nécessite Supabase).
const analyseMode = params.has('analyse');
// Preview de l'écran de sélection cassettes : autonome, aucune donnée requise.
const cassettesMode = params.has('cassettes');
// Calibrateur de continents (maps v2) : autonome, aucune donnée requise.
const calibrateMode = params.has('calibrate');

// Build hors ligne : aucun appel réseau, données figées dans le bundle. Le test
// littéral (et non un import) garantit que cette branche — et donc l'instantané
// JSON importé dynamiquement — est éliminée du bundle EN LIGNE (tree-shaking).
if (import.meta.env.VITE_OFFLINE === '1') {
  import('./logic/offlineSnapshot.js').then(({ applyOfflineSnapshot }) => {
    applyOfflineSnapshot();
    const st = useGameStore.getState();
    st.syncEnabledItems();
    st.syncEnabledEvents();
    st.bumpQuestionsVersion();
  });
} else if (cassettesMode || calibrateMode) {
  // Preview mock / outil de calibration : rien à charger.
} else if (joinMode || analyseMode || onlineMode) {
  // Mobile / dashboard / spectateur online : catalogue d'objets (noms/images) +
  // recettes + équilibrage
  // (noms de pouvoirs) pour résoudre ITEMS/POWERS dans les libellés.
  applyCachedCategories();
  refreshCategories().catch(() => {});
  applyCachedItems();
  refreshItems().catch(() => {});
  applyCachedRecipes();
  refreshRecipes().catch(() => {});
  // Équilibrage : aligne prix/coûts des pouvoirs sur les valeurs du TBI (sinon
  // l'achat afficherait les valeurs par défaut alors que le TBI applique les
  // valeurs équilibrées). Mute POWERS/LOOT en place.
  applyCachedBalance();
  refreshBalance().catch(() => {});
} else {
  // TBI complet — applique les caches (synchrone, offline-safe) AVANT le 1er rendu,
  // puis rafraîchit depuis Supabase en arrière-plan.
  // Catégories/modules d'abord (le plateau et la sélection des matières en dépendent).
  applyCachedCategories();
  refreshCategories()
    .then((n) => { if (n) useGameStore.getState().bumpQuestionsVersion(); })
    .catch(() => {});

  // Arbre de thèmes (table quete_themes) : alimente l'écran de sélection « cassettes »
  // (beta). Après les catégories, car les feuilles référencent des categories.
  applyCachedThemes();
  refreshThemes()
    .then((n) => { if (n) useGameStore.getState().bumpQuestionsVersion(); })
    .catch(() => {});

  applyCachedBalance();
  refreshBalance().catch(() => {});

  applyCachedItems();
  useGameStore.getState().syncEnabledItems();
  refreshItems()
    .then((n) => { if (n) useGameStore.getState().syncEnabledItems(); })
    .catch(() => {});

  // Événements personnalisés (table quete_events) fusionnés par-dessus les intégrés.
  applyCachedEvents();
  useGameStore.getState().syncEnabledEvents();
  refreshEvents()
    .then(() => useGameStore.getState().syncEnabledEvents())
    .catch(() => {});

  applyCachedQuestions();
  refreshQuestions()
    .then((n) => { if (n) useGameStore.getState().bumpQuestionsVersion(); })
    .catch(() => {});

  // Recettes d'alchimie personnalisées (table quete_recipes) par-dessus les intégrées.
  applyCachedRecipes();
  refreshRecipes().catch(() => {});
}

function Root() {
  if (import.meta.env.VITE_OFFLINE === '1') return <App />;
  if (calibrateMode) return <Suspense fallback={null}><MapCalibrator /></Suspense>;
  if (cassettesMode) return <Suspense fallback={null}><CassettesPreview /></Suspense>;
  if (analyseMode) return <Suspense fallback={null}><DashboardApp /></Suspense>;
  if (onlineMode) return <Suspense fallback={null}><OnlineClient code={params.get('online')} /></Suspense>;
  if (joinMode) return <MobileApp />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
