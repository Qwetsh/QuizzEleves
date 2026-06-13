import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/animations.css';
import { applyCachedBalance, refreshBalance } from './logic/balanceConfig';
import { applyCachedItems, refreshItems } from './logic/itemsConfig';
import { applyCachedQuestions, refreshQuestions } from './logic/questionsConfig';
import { useGameStore } from './store/gameStore';

// Équilibrage : applique tout de suite le dernier état connu (cache local,
// synchrone et offline-safe) AVANT le premier rendu, puis rafraîchit depuis
// Supabase en arrière-plan (sans bloquer ; hors-ligne = on garde le cache).
applyCachedBalance();
refreshBalance().catch(() => {});

// Objets : applique le cache (mute le catalogue ITEMS) puis resynchronise les
// objets activés du store, AVANT le rendu. Refresh Supabase en arrière-plan.
applyCachedItems();
useGameStore.getState().syncEnabledItems();
refreshItems()
  .then((n) => { if (n) useGameStore.getState().syncEnabledItems(); })
  .catch(() => {});

// Questions : même stratégie. Le cache (ou à défaut les fichiers JS embarqués)
// sert immédiatement ; le refresh Supabase met à jour le store et notifie le
// Setup (compteurs de questions) via questionsVersion.
applyCachedQuestions();
refreshQuestions()
  .then((n) => { if (n) useGameStore.getState().bumpQuestionsVersion(); })
  .catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
