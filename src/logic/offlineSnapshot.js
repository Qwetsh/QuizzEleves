// Application de l'instantané de données FIGÉ dans le bundle hors ligne.
//
// La base Supabase étant la source de vérité en ligne, une machine au cache vide
// et sans réseau démarrerait sur les fichiers JS embarqués (potentiellement
// périmés). Pour un mode hors ligne FIABLE, `scripts/snapshot-offline.mjs`
// capture l'état de la base dans src/data/offlineSnapshot.json (déjà au format
// interne du jeu, images uploadées rapatriées en data URL), et ce module
// l'applique aux mêmes stores que le rafraîchissement réseau utilise en ligne.
//
// Ce module n'est importé QUE dans la branche offline de main.jsx (import
// dynamique). En build en ligne, cette branche est morte → ce module ET le JSON
// ne sont jamais inclus dans le bundle.
import snapshot from '../data/offlineSnapshot.json';
import { setQuestionData } from '../data/questions/index.js';
import { setItemsData } from '../data/items.js';
import { setCustomEvents } from '../data/events.js';
import { setCustomRecipes } from '../data/recipes.js';
import { applyBalance } from './balanceConfig.js';

// Applique tout ce que l'instantané contient (chaque section est optionnelle :
// une section absente/vide laisse en place le fallback des fichiers JS du code).
export function applyOfflineSnapshot() {
  const s = snapshot || {};
  if (s.balance) applyBalance(s.balance);
  if (s.items && Object.keys(s.items).length) setItemsData(s.items);
  if (s.events && Object.keys(s.events).length) setCustomEvents(s.events);
  if (Array.isArray(s.recipes) && s.recipes.length) setCustomRecipes(s.recipes);
  if (s.questions && (s.questions.cycle4 || s.questions.brevet)) setQuestionData(s.questions);
}
