import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { POWERS } from '../../data/powers';
import ModalOverlay from './ModalOverlay';
import TeamTargetButton from './TeamTargetButton';

// Décrit l'entête du picker selon la source (pouvoir legacy ou moteur d'effets).
function pickerInfo(stp, T) {
  if (!stp) return null;
  if (stp.source === 'engine') {
    const a = stp.action || {};
    const isMoney = a.action === 'money';
    return {
      icon: isMoney ? '💰' : '🎯',
      color: isMoney ? '#e8b117' : '#c9472f',
      name: isMoney ? T('modal.target.stealName') : T('modal.target.moveName'),
      desc: T('modal.target.desc'),
    };
  }
  const p = POWERS[stp.powerKey];
  return p ? { icon: p.icon, color: p.color, name: p.name, desc: p.desc } : null;
}

export default function TargetPickerModal() {
  const T = useT();
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const selectTarget = useGameStore((s) => s.selectTarget);
  const cancelTargetPicker = useGameStore((s) => s.cancelTargetPicker);

  const info = pickerInfo(showTargetPicker, T);

  return (
    <AnimatePresence>
      {showTargetPicker && info && (
        <ModalOverlay onClose={cancelTargetPicker} className="max-w-sm">
          <div style={{ padding: '26px 26px 4px', textAlign: 'center' }}>
            <div
              style={{
                width: 80, height: 80, borderRadius: 22,
                margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40,
                background: `linear-gradient(180deg, ${info.color}cc, ${info.color})`,
                boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -5px 0 rgba(0,0,0,0.18), 0 6px 0 rgba(110,30,18,0.4)',
              }}
            >
              {info.icon}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{info.name}</h2>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 4 }}>{info.desc}</p>
          </div>

          <div style={{ padding: '10px 26px 24px' }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>{T('modal.target.chooseTeam')}</p>
            <div className="space-y-2">
              {teams.map((team, i) => {
                if (i === currentTeam) return null;
                return (
                  <TeamTargetButton
                    key={i}
                    team={team}
                    onClick={() => selectTarget(i)}
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
              {T('common.cancel')}
            </button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
