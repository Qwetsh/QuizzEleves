import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import ModalOverlay from './ModalOverlay';

export default function ChargePickerModal() {
  const showChargePicker = useGameStore((s) => s.showChargePicker);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const chargePickerChoice = useGameStore((s) => s.chargePickerChoice);
  const chargePickerSkip = useGameStore((s) => s.chargePickerSkip);

  const team = teams[currentTeam];
  const powerKeys = team?.powers ? Object.keys(team.powers) : [];
  // Ouvert par le dé de 1 (gratuit + activation offensive immédiate possible)
  // ou par un objet/consommable (simple recharge : source 'item' ou 'engine')
  const fromItem = showChargePicker?.source === 'item' || showChargePicker?.source === 'engine';

  return (
    <AnimatePresence>
      {showChargePicker && team && (
        <ModalOverlay onClose={chargePickerSkip} className="max-w-sm">
          <div style={{ padding: '26px 26px 4px', textAlign: 'center' }}>
            <div
              style={{
                width: 80, height: 80, borderRadius: 22,
                margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 40,
                background: 'linear-gradient(180deg, #f5c842cc, #e8a817)',
                boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -5px 0 rgba(0,0,0,0.18), 0 6px 0 rgba(150,100,10,0.4)',
              }}
            >
              {fromItem ? "\u{1F48E}" : "\u2728"}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>
              {fromItem ? "Recharge !" : "D\u00e9 de 1 !"}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 4 }}>
              {fromItem ? "Choisis un pouvoir \u00e0 recharger :" : "Choisis un pouvoir \u00e0 recharger gratuitement :"}
            </p>
          </div>

          <div style={{ padding: '10px 26px 24px' }}>
            <div className="space-y-2">
              {powerKeys.map((key) => {
                const power = POWERS[key];
                if (!power) return null;
                const charges = team.powers[key]?.charges ?? 0;
                return (
                  <button
                    key={key}
                    onClick={() => chargePickerChoice(key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: 12, borderRadius: 14,
                      border: `2px solid ${power.color || 'rgba(122,94,58,0.22)'}44`,
                      background: '#fffefb',
                      cursor: 'pointer', fontFamily: 'var(--font-ui)',
                      transition: 'all 100ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = power.color || '#e8b117';
                      e.currentTarget.style.background = `${power.color || '#e8b117'}11`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = `${power.color || 'rgba(122,94,58,0.22)'}44`;
                      e.currentTarget.style.background = '#fffefb';
                    }}
                  >
                    <span
                      style={{
                        width: 40, height: 40, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22,
                        background: `linear-gradient(180deg, ${power.color}cc, ${power.color})`,
                        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -3px 0 rgba(0,0,0,0.15)',
                      }}
                    >
                      {power.icon}
                    </span>
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-800)' }}>
                        {power.name}
                        <span style={{ fontSize: 12, color: 'var(--ink-500)', marginLeft: 6 }}>
                          x{charges}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                        {!fromItem && power.category === 'off' ? 'Offensif — utilisable imm\u00e9diatement' : power.desc}
                      </div>
                    </div>
                    <span style={{ fontSize: 18, color: 'var(--gold-600)' }}>{"+1"}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={chargePickerSkip}
              style={{
                marginTop: 16, width: '100%',
                fontSize: 14, color: 'var(--ink-500)',
                cursor: 'pointer', background: 'none', border: 'none',
                fontFamily: 'var(--font-ui)',
                padding: 8,
              }}
            >
              Passer
            </button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
