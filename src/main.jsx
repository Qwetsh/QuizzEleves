import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MobileApp from './components/Mobile/MobileApp';
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

if (joinMode) {
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
    {joinMode ? <MobileApp /> : <App />}
  </React.StrictMode>
);
