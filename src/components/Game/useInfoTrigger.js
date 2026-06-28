// Hook : renvoie les props événementielles à coller sur n'importe quel élément
// (chip d'effet du HUD, mot-clé du journal) pour ouvrir la fiche d'info flottante.
// - Souris : ouverture AU SURVOL (non épinglée → se ferme quand la souris part).
// - Souris (clic) / tactile (tap) : ouverture ÉPINGLÉE (reste jusqu'au clic
//   extérieur ; un 2e clic/tap ferme).
// On distingue souris et tactile via e.pointerType pour éviter le double
// déclenchement des événements souris synthétiques sur écran tactile.
import { useId } from 'react';
import { useUiStore } from '../../store/uiStore';

export function useInfoTrigger(descriptor) {
  const id = useId();
  const open = useUiStore((s) => s.openInfo);
  const close = useUiStore((s) => s.closeInfo);
  const rectOf = (e) => e.currentTarget.getBoundingClientRect();

  return {
    'data-info-anchor': '',
    onPointerEnter: (e) => {
      if (e.pointerType === 'mouse') open({ anchorId: id, descriptor, rect: rectOf(e), pinned: false });
    },
    onPointerLeave: (e) => {
      if (e.pointerType !== 'mouse') return;
      const c = useUiStore.getState().info;
      if (c && c.anchorId === id && !c.pinned) close();
    },
    onClick: (e) => {
      e.stopPropagation();
      const c = useUiStore.getState().info;
      if (c && c.anchorId === id && c.pinned) close();
      else open({ anchorId: id, descriptor, rect: rectOf(e), pinned: true });
    },
  };
}
