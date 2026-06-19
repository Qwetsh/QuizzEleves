import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { describeAction } from '../../logic/effectText';
import ModalOverlay from './ModalOverlay';

// Fiche d'inspection d'un piège (clic sur son icône sur le plateau). Un piège
// pouvant cumuler plusieurs effets, on liste chaque action en clair via
// describeAction (même source que les descriptions d'objets).
export default function TrapInspectModal() {
  const T = useT();
  const inspectTrap = useGameStore((s) => s.inspectTrap);
  const close = useGameStore((s) => s.closeInspectTrap);

  const lines = (inspectTrap?.do || []).map(describeAction).filter(Boolean);

  return (
    <AnimatePresence>
      {inspectTrap && (
        <ModalOverlay className="max-w-xs" onClose={close}>
          <div style={{ padding: '22px 22px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 38 }}>{inspectTrap.icon || '\u{1FAA4}'}</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, marginTop: 4 }}>
              {inspectTrap.label || T('modal.trap.title')}
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 4 }}>
              {T('modal.trap.sub')}
            </p>
          </div>
          <div style={{ padding: '6px 20px 18px' }}>
            {lines.length ? (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
                {lines.map((l, i) => (
                  <li key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '9px 12px', borderRadius: 11,
                    border: '1px solid rgba(201,71,47,0.3)', background: 'rgba(201,71,47,0.06)',
                    fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink-800)',
                  }}>
                    <span style={{ color: '#c9472f' }}>▸</span>
                    <span style={{ textTransform: 'capitalize' }}>{l}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-600)' }}>{T('modal.trap.unknown')}</p>
            )}
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            <button className="btn btn--primary" style={{ width: '100%' }} onClick={close}>{T('common.close')}</button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
