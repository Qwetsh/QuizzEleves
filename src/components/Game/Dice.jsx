import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { soundDice } from '../../logic/sounds';

const DICE_FACES = [null, '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

const diceVariants = {
  rolling: {
    rotate: [0, -15, 15, -10, 10, 0],
    y: [0, -12, 0, -8, 0, -4, 0],
    transition: { duration: 0.5, repeat: Infinity },
  },
  idle: {
    rotate: 0,
    y: 0,
    transition: { type: 'spring', damping: 12 },
  },
  result: {
    scale: [1, 1.3, 1],
    transition: { duration: 0.3 },
  },
};

export default function Dice() {
  const rollDice = useGameStore((s) => s.rollDice);
  const rolling = useGameStore((s) => s.rolling);
  const diceValue = useGameStore((s) => s.diceValue);
  const finished = useGameStore((s) => s.finished);
  const awaitingChoice = useGameStore((s) => s.awaitingChoice);
  const showQuestion = useGameStore((s) => s.showQuestion);
  const showEvent = useGameStore((s) => s.showEvent);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const usePower = useGameStore((s) => s.usePower);

  const disabled = rolling || finished || awaitingChoice || showQuestion || showEvent;
  const team = teams[currentTeam];
  const canRelance = diceValue && !showQuestion && !rolling && !showEvent && team?.powers?.relance?.charges > 0;

  const handleRoll = () => {
    soundDice();
    rollDice();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        className="select-none"
        style={{
          fontSize: 64,
          filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
        }}
        variants={diceVariants}
        animate={rolling ? 'rolling' : diceValue ? 'result' : 'idle'}
      >
        {diceValue ? DICE_FACES[diceValue] : '\u{1F3B2}'}
      </motion.div>

      <div style={{ fontSize: 14, fontFamily: 'var(--font-display)', color: 'var(--ink-500)' }}>
        {rolling ? 'Le d\u00e9 tourne\u2026' : (disabled ? '' : 'Cliquer pour lancer')}
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
