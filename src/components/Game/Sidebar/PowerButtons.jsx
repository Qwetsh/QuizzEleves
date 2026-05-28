import { useGameStore } from '../../../store/gameStore';
import { getAvailablePowers, canUsePowerInContext } from '../../../logic/powerActivator';

export default function PowerButtons() {
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const usePower = useGameStore((s) => s.usePower);
  const rolling = useGameStore((s) => s.rolling);
  const finished = useGameStore((s) => s.finished);
  const diceValue = useGameStore((s) => s.diceValue);
  const showQuestion = useGameStore((s) => s.showQuestion);
  const showEvent = useGameStore((s) => s.showEvent);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const pendingLanding = useGameStore((s) => s.pendingLanding);

  const team = teams[currentTeam];
  if (!team?.powers) return null;

  const powerEntries = getAvailablePowers(team);
  if (powerEntries.length === 0) return null;

  const ctx = { diceValue, showQuestion, rolling, showEvent, awaitingChoice, finished, pendingLanding };

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-3">
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
  );
}
