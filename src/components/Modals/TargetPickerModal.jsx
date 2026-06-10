import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import ModalOverlay from './ModalOverlay';
import TeamTargetButton from './TeamTargetButton';

export default function TargetPickerModal() {
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const applyOffensivePower = useGameStore((s) => s.applyOffensivePower);
  const cancelTargetPicker = useGameStore((s) => s.cancelTargetPicker);

  const power = showTargetPicker ? POWERS[showTargetPicker.powerKey] : null;

  return (
    <AnimatePresence>
      {showTargetPicker && power && (
        <ModalOverlay onClose={cancelTargetPicker} className="max-w-sm">
          <div style={{ padding: '26px 26px 4px', textAlign: 'center' }}>
            <div
              style={{
                width: 80, height: 80, borderRadius: 22,
                margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40,
                background: power.color
                  ? `linear-gradient(180deg, ${power.color}cc, ${power.color})`
                  : 'linear-gradient(180deg, #e85d6b, #c9472f)',
                boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -5px 0 rgba(0,0,0,0.18), 0 6px 0 rgba(110,30,18,0.4)',
              }}
            >
              {power.icon}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{power.name}</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 4 }}>{power.desc}</p>
          </div>

          <div style={{ padding: '10px 26px 24px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>{"Choisir une \u00e9quipe cible :"}</p>
            <div className="space-y-2">
              {teams.map((team, i) => {
                if (i === currentTeam) return null;
                return (
                  <TeamTargetButton
                    key={i}
                    team={team}
                    onClick={() => applyOffensivePower(i)}
                  />
                );
              })}
            </div>
            <button
              onClick={cancelTargetPicker}
              style={{
                marginTop: 16, width: '100%',
                fontSize: 14, color: 'var(--ink-500)',
                cursor: 'pointer', background: 'none', border: 'none',
                fontFamily: 'var(--font-ui)',
                padding: 8,
              }}
            >
              Annuler
            </button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
