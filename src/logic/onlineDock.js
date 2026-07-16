// Dock PRIVÉ du joueur en ligne : boutique, inventaire, ateliers… de SON équipe,
// ouverts localement sur SON écran (état d'ouverture non partagé) et branchés
// sur les intents d'ÉQUIPE existants (mêmes gardes que la manette téléphone).
//
// `teamDispatch` est le canal de mutation unique du dock :
//   — client miroir : envoie l'intent à l'hôte via Supabase (sendIntent) ;
//   — fenêtre hôte  : applique DIRECTEMENT (applyTeamIntent local, l'hôte est
//     l'autorité — pas d'aller-retour réseau pour son propre joueur).
import { create } from 'zustand';
import { useGameStore } from '../store/gameStore';
import { sendIntent, randomToken } from './sessionConfig';

export function teamDispatch(type, payload = {}) {
  const s = useGameStore.getState();
  const token = s._onlineToken;
  if (!token) return;
  if (s._mirror) {
    if (s._onlineCode) sendIntent(s._onlineCode, token, type, { ...payload, uid: randomToken() }).catch(() => {});
  } else {
    s.applyTeamIntent(token, type, payload);
  }
}

// Quelle modale privée est ouverte sur CET écran (jamais diffusée) :
// null | 'shop' | 'inventory' | 'scribe' | 'alchemy' | 'spellTable' | 'forge' | 'trade'
export const useOnlineDock = create((set) => ({
  modal: null,
  openDock: (m) => set({ modal: m }),
  closeDock: () => set({ modal: null }),
}));
