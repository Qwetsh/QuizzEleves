import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { canUsePowerInContext } from '../../logic/powerActivator';
import Dice3D from './Dice3D';

export default function Dice() {
  const rollDice = useGameStore((s) => s.rollDice);
  const rolling = useGameStore((s) => s.rolling);
  const diceValue = useGameStore((s) => s.diceValue);
  const finished = useGameStore((s) => s.finished);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const showQuestion = useGameStore((s) => s.showQuestion);
  const showEvent = useGameStore((s) => s.showEvent);
  const showDiceModal = useGameStore((s) => s.showDiceModal);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const usePower = useGameStore((s) => s.usePower);

  const pendingLanding = useGameStore((s) => s.pendingLanding);
  // Une séquence d'effet d'objet en cours (choix de case, d6, cible...) bloque le dé.
  const pendingActions = useGameStore((s) => s.pendingActions);
  const showChargePicker = useGameStore((s) => s.showChargePicker);
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);
  const disabled = rolling || finished || awaitingChoice || showQuestion || showEvent || pendingLanding || showDiceModal || !!pendingActions || !!showChargePicker || !!showTargetPicker;
  const team = teams[currentTeam];
  const ctx = { diceValue, showQuestion, rolling, showEvent, awaitingChoice, finished, pendingLanding, pendingActions };
  const canRelance = team?.powers?.relance?.charges > 0 && canUsePowerInContext('relance', ctx);

  const handleRoll = () => {
    rollDice(); // le son de dé est joué par la cérémonie (DiceRollModal)
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <Dice3D
        value={diceValue || 1}
        rolling={false}
        size={88}
        disabled={disabled}
      />

      <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: pendingLanding ? 'var(--gold-600)' : 'var(--ink-500)' }}>
        {rolling ? 'Le d\u00e9 tourne\u2026' : pendingLanding ? (canRelance ? 'Relance possible !' : 'En route\u2026') : (disabled ? '' : 'Cliquer pour lancer')}
      </div>

      <button
        onClick={handleRoll}
        disabled={disabled}
        className="btn"
        style={{ width: '100%', ...(disabled ? { opacity: 0.5, cursor: 'not-allowed', filter: 'saturate(0.6)' } : {}) }}
      >
        {"\u{1F3B2} Lancer le d\u00e9"}
      </button>

      <AnimatePresence>
        {canRelance && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => usePower('relance')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px',
              borderRadius: 14,
              fontWeight: 600,
              fontSize: 14,
              border: '2px solid var(--gold-400)',
              background: 'linear-gradient(180deg, #fff7e2, #f3d997)',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 0 rgba(110,78,16,0.3)',
              transition: 'transform 100ms ease',
            }}
          >
            {"\u{1F3B2} Relance !"} <span style={{ opacity: 0.6 }}>(x{team.powers.relance.charges})</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
