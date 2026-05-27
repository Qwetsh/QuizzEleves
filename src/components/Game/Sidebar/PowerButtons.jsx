import { useGameStore } from '../../../store/gameStore';
import { POWERS } from '../../../data/powers';

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

  const team = teams[currentTeam];
  if (!team?.powers) return null;

  const powerEntries = Object.entries(team.powers)
    .filter(([, val]) => val.charges > 0)
    .map(([key, val]) => ({ key, ...POWERS[key], charges: val.charges }));

  if (powerEntries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {powerEntries.map(({ key, icon, name, charges, category }) => {
        // Determine if this power can be used right now
        let canUse = false;
        if (key === 'relance') {
          canUse = !!diceValue && !showQuestion && !rolling && !showEvent;
        } else if (key === 'indice') {
          canUse = !!showQuestion && !rolling;
        } else if (key === 'bouclier') {
          canUse = false; // auto-activated
        } else if (category === 'off') {
          canUse = !diceValue && !showQuestion && !rolling && !showEvent && !awaitingChoice && !finished;
        }

        return (
          <button
            key={key}
            onClick={() => usePower(key)}
            disabled={!canUse}
            className={`text-xs px-2 py-1 rounded-lg border font-semibold transition ${
              canUse
                ? 'border-yellow-400 bg-yellow-50 hover:bg-yellow-100 shadow-sm cursor-pointer'
                : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
            title={`${name} (${charges} charge${charges > 1 ? 's' : ''})`}
          >
            {icon} {name} <span className="opacity-60">x{charges}</span>
          </button>
        );
      })}
    </div>
  );
}
