import { useGameStore } from '../../../store/gameStore';
import { getAvailablePowers, canUsePowerInContext } from '../../../logic/powerActivator';
import { useT } from '../../../i18n';
import '../../../styles/power-cast.css';

export default function PowerButtons() {
  const T = useT();
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

  const ctx = { diceValue, showQuestion, rolling, showEvent, awaitingChoice, finished, pendingLanding };

  // Pouvoirs OFFENSIFS utilisables MAINTENANT (fenetre de cast).
  // Le Bouclier (passif) et l'Indice (reserve aux questions) ne s'affichent pas ici ;
  // la Relance a son propre bouton sous le de.
  const castable = getAvailablePowers(team).filter(
    (p) => p.category === 'off' && canUsePowerInContext(p.key, ctx)
  );

  // Show "Continuer" when waiting for player action after dice roll
  const showContinue = pendingLanding && !rolling && !showChargePicker && !showTargetPicker && !showQuestion && !showEvent;

  return (
    <div className="flex flex-col items-center gap-3 mt-3">
      {castable.length > 0 && (
        <div className="power-cast-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', width: '100%' }}>
          {castable.map(({ key, icon, name, charges, color }) => (
            <button
              key={key}
              onClick={() => usePower(key)}
              className="power-cast-btn"
              style={{ '--cast-color': color }}
              title={T('game.powerCharges', { name, charges: `${charges} ${T.plural('game.charge', charges)}` })}
            >
              <span className="power-cast-disc">
                <span className="power-cast-icon">{icon}</span>
                <span className="power-cast-count">{charges}</span>
              </span>
              <span className="power-cast-name">{name}</span>
            </button>
          ))}
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
          {T('common.continue')}
        </button>
      )}
    </div>
  );
}
