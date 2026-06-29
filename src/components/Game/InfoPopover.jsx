// Contrôleur de la fiche d'info flottante. Monté UNE fois (GameLayout). Lit
// l'état du uiStore (descripteur + rect d'ancrage), résout le contenu via le
// glossaire, et place la fiche à côté de l'ancre. Rendu via un PORTAIL sur
// <body> pour échapper aux `transform` des conteneurs (sinon position:fixed se
// recale dessus). Pas de backdrop (BG3) ; ferme sur clic extérieur / Échap /
// scroll.
import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUiStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { resolveDescriptor } from '../../logic/glossary';
import { useT } from '../../i18n';
import InfoCard from './InfoCard';

const GAP = 10;
const MARGIN = 8;

function InfoPopoverInner({ info, entry, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  // Mesure une fois monté (la clé du parent force un remount par ouverture).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const r = info.rect;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = r.left + r.width / 2;
    let place = 'top';
    let top = r.top - GAP - h;
    if (top < MARGIN) { place = 'bottom'; top = r.bottom + GAP; }
    if (place === 'bottom' && top + h > vh - MARGIN) top = Math.max(MARGIN, vh - MARGIN - h);
    let left = cx - w / 2;
    left = Math.max(MARGIN, Math.min(left, vw - MARGIN - w));
    const arrowLeft = Math.max(12, Math.min(cx - left, w - 12));
    setPos({ left, top, place, arrowLeft });
  }, [info]);

  // Fermeture : clic hors d'une ancre, Échap, ou défilement/redimensionnement.
  useEffect(() => {
    const onDown = (e) => { if (!e.target.closest?.('[data-info-anchor]')) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    // L'auto-scroll programmatique du journal (scrollIntoView à chaque nouvelle
    // ligne) émet des événements 'scroll' captés ici : on les ignore pour ne pas
    // fermer une fiche épinglée à chaque action de jeu. Un vrai défilement de la
    // page/plateau (cible ailleurs) ferme bien la fiche, car l'ancre bouge.
    const onScroll = (e) => { if (e.target?.closest?.('[data-log-scroll]')) return; onClose(); };
    const onResize = () => onClose();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="info-pop"
      data-place={pos?.place || 'top'}
      style={{
        '--accent': entry.accent,
        left: pos ? pos.left : -9999,
        top: pos ? pos.top : -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <InfoCard entry={entry} />
      <span className="info-pop-arrow" style={{ left: pos ? pos.arrowLeft : 0 }} />
    </div>,
    document.body,
  );
}

export default function InfoPopover() {
  const T = useT();
  const info = useUiStore((s) => s.info);
  const close = useUiStore((s) => s.closeInfo);
  // Contexte d'équipe active : masque l'effet d'un ingrédient non découvert.
  const known = useGameStore((s) => s.teams[s.currentTeam]?.knownIngredients);
  if (!info) return null;
  const entry = resolveDescriptor(info.descriptor, T.lang, { knownIngredients: known || [] });
  if (!entry) return null;
  return <InfoPopoverInner key={`${info.anchorId}:${T.lang}`} info={info} entry={entry} onClose={close} />;
}
