// Petit store d'UI TRANSITOIRE (non persisté, hors gameStore) : pilote la fiche
// d'info flottante « façon BG3 » partagée par le HUD (effets) et le journal
// (mots-clés cliquables). Garder ça hors de gameStore évite de polluer la
// sauvegarde et les re-rendus du jeu.
import { create } from 'zustand';

// info = { anchorId, descriptor, rect, pinned } | null
//   descriptor : soit { type:'item'|'power'|'set'|'subject'|'term', key }
//                soit { type:'effect', name, desc, icon, color, lines? } (effet HUD ad hoc)
//   pinned : ouverte au clic (reste jusqu'au clic extérieur) vs survol (suit la souris)
export const useUiStore = create((set) => ({
  info: null,
  openInfo: (info) => set({ info }),
  closeInfo: () => set({ info: null }),
}));
