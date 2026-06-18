import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MobileApp from './components/Mobile/MobileApp';
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
import { useGameStore } from './store/gameStore';

// Le companion mobile s'ouvre via l'URL d'appairage (?join=CODE) : c'est une
// vue lecture seule, indépendante du moteur de jeu du TBI.
const joinMode = new URLSearchParams(window.location.search).has('join');

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
} else if (joinMode) {
  // Mobile : catalogue d'objets (noms/images) + recettes (grimoire d'alchimie).
  applyCachedItems();
  refreshItems().catch(() => {});
  applyCachedRecipes();
  refreshRecipes().catch(() => {});
} else {
  // TBI complet — applique les caches (synchrone, offline-safe) AVANT le 1er rendu,
  // puis rafraîchit depuis Supabase en arrière-plan.
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {joinMode && import.meta.env.VITE_OFFLINE !== '1' ? <MobileApp /> : <App />}
  </React.StrictMode>
);
