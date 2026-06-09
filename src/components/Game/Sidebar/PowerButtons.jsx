import { useGameStore } from '../../../store/gameStore';
import { getAvailablePowers, canUsePowerInContext } from '../../../logic/powerActivator';

export default function PowerButtons() {
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const usePower = useGameStore((s) => s.usePower);
  const confirmLanding = useGameStore((s) => s.confirmLanding);
  const rolling = useGameStore((s) => s.rolling);
  const finished = useGameStore((s) => s.finished);
  const diceValue = useGameStore((s) => s.diceValue);
  const showQuestion = useGameStore((s) => s.showQuestion);
  const showEvent = useGameStore((s) => s.showEvent);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const pendingLanding = useGameStore((s) => s.pendingLanding);
  const showChargePicker = useGameStore((s) => s.showChargePicker);
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);

  const team = teams[currentTeam];
  if (!team?.powers) return null;

  const powerEntries = getAvailablePowers(team);
  const ctx = { diceValue, showQuestion, rolling, showEvent, awaitingChoice, finished, pendingLanding };

  // Show "Continuer" when waiting for player action after dice roll
  const showContinue = pendingLanding && !rolling && !showChargePicker && !showTargetPicker && !showQuestion && !showEvent;

  return (
    <div className="flex flex-col items-center gap-3 mt-3">
      {powerEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {powerEntries.map(({ key, icon, name, charges }) => {
            const canUse = canUsePowerInContext(key, ctx);
            return (
              <button
                key={key}
                onClick={() => usePower(key)}
                disabled={!canUse}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: canUse ? '#fffefb' : 'var(--parch-100)',
                  border: `1px solid ${canUse ? 'var(--gold-500)' : 'rgba(122, 94, 58, 0.22)'}`,
                  fontSize: 13, color: canUse ? 'var(--ink-700)' : 'var(--ink-400)',
                  cursor: canUse ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                  fontFamily: 'var(--font-ui)',
                  opacity: canUse ? 1 : 0.4,
                  transition: 'all 100ms ease',
                }}
                title={`${name} (${charges} charge${charges > 1 ? 's' : ''})`}
              >
                {icon} {name} <span style={{ opacity: 0.6 }}>x{charges}</span>
              </button>
            );
          })}
        </div>
      )}

      {showContinue && (
        <button
          onClick={confirmLanding}
          style={{
            padding: '10px 28px',
            borderRadius: 14,
            background: 'linear-gradient(180deg, var(--gold-400), var(--gold-600))',
            border: 'none',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.15)',
            animation: 'btn-pulse 2s ease-in-out infinite',
            transition: 'all 100ms ease',
          }}
        >
          Continuer
        </button>
      )}
    </div>
  );
}
