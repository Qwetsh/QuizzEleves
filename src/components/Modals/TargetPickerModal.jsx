import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';

export default function TargetPickerModal() {
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const applyOffensivePower = useGameStore((s) => s.applyOffensivePower);
  const cancelTargetPicker = useGameStore((s) => s.cancelTargetPicker);

  if (!showTargetPicker) return null;

  const power = POWERS[showTargetPicker.powerKey];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--paper)] rounded-2xl shadow-2xl max-w-sm w-full p-6 modal-pop">
        <div className="text-center mb-4">
          <span className="text-4xl">{power.icon}</span>
          <h2 className="text-lg font-bold mt-2">{power.name}</h2>
          <p className="text-sm text-[var(--muted)]">{power.desc}</p>
        </div>
        <p className="text-sm font-semibold mb-3 text-center">{"Choisir une \u00e9quipe cible :"}</p>
        <div className="space-y-2">
          {teams.map((team, i) => {
            if (i === currentTeam) return null;
            return (
              <button
                key={i}
                onClick={() => applyOffensivePower(i)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-[var(--border)] bg-white hover:border-red-400 hover:bg-red-50 transition"
              >
                <span className="text-2xl">{team.emoji}</span>
                <span className="font-bold" style={{ color: team.color }}>{team.name}</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={cancelTargetPicker}
          className="mt-4 w-full text-sm text-[var(--muted)] hover:text-red-600 transition"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
