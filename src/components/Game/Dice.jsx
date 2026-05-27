import { useGameStore } from '../../store/gameStore';
import { soundDice } from '../../logic/sounds';

const DICE_FACES = [null, '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

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

  const handleRoll = () => {
    soundDice();
    rollDice();
  };
  const team = teams[currentTeam];
  const canRelance = diceValue && !showQuestion && !rolling && !showEvent && team?.powers?.relance?.charges > 0;

  return (
    <div className="flex flex-col items-center gap-2 my-4">
      <div
        className={`text-6xl select-none transition-transform ${rolling ? 'animate-bounce' : ''}`}
      >
        {diceValue ? DICE_FACES[diceValue] : '\u{1F3B2}'}
      </div>
      <button
        onClick={handleRoll}
        disabled={disabled}
        className={`px-6 py-2 rounded-lg font-bold text-white transition ${
          disabled
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 shadow-md'
        }`}
      >
        {rolling ? 'Lancement...' : 'Lancer le d\u00e9'}
      </button>
      {canRelance && (
        <button
          onClick={() => usePower('relance')}
          className="px-4 py-1.5 rounded-lg font-semibold text-sm border-2 border-yellow-400 bg-yellow-50 hover:bg-yellow-100 transition"
        >
          {"\u{1F3B2} Relance !"} <span className="opacity-60">(x{team.powers.relance.charges})</span>
        </button>
      )}
    </div>
  );
}
