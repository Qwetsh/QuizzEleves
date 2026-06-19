import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { POWERS } from '../../data/powers';
import { specOptionsFor } from '../../logic/powerEffects';
import ModalOverlay from './ModalOverlay';

// Choix de voie au passage L5/L10 (extension « Maîtrise »). NON refusable :
// l'équipe DOIT choisir une des 3 spécialisations (le choix est définitif).
export default function SpecPickerModal() {
  const T = useT();
  const picker = useGameStore((s) => s.showSpecPicker);
  const chooseSpec = useGameStore((s) => s.chooseSpec);

  if (!picker) return null;
  const power = POWERS[picker.powerKey];
  if (!power) return null;
  const options = specOptionsFor(picker.powerKey, picker.slot);
  const tier = picker.slot === 'spec10' ? 10 : 5;
  const color = power.color || '#8745d4';

  return (
    <AnimatePresence>
      {picker && (
        <ModalOverlay className="max-w-md">
          <div style={{ padding: '24px 24px 4px', textAlign: 'center' }}>
            <div style={{
              width: 76, height: 76, borderRadius: 20, margin: '0 auto 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, color: '#fff',
              background: `linear-gradient(180deg, ${color}cc, ${color})`,
              boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -5px 0 rgba(0,0,0,0.18), 0 6px 0 rgba(0,0,0,0.25)',
            }}>
              {power.icon}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 23, color: 'var(--ink-900)' }}>
              {T('modal.spec.title', { name: power.name, tier })}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 4 }}>
              {T('modal.spec.choose')}
            </p>
          </div>

          <div style={{ padding: '10px 22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {options.map((opt) => (
              <button
                key={opt.key}
                onClick={() => chooseSpec(opt.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: 14, borderRadius: 16, textAlign: 'left',
                  border: `2px solid ${color}55`, background: '#fffefb',
                  cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 100ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}11`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${color}55`; e.currentTarget.style.background = '#fffefb'; }}
              >
                <span style={{ fontSize: 30, flexShrink: 0 }}>{opt.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-900)' }}>{opt.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.35, marginTop: 2 }}>{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
