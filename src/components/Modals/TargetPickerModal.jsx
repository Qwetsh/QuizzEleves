import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import ModalOverlay from './ModalOverlay';

export default function TargetPickerModal() {
  const showTargetPicker = useGameStore((s) => s.showTargetPicker);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const applyOffensivePower = useGameStore((s) => s.applyOffensivePower);
  const cancelTargetPicker = useGameStore((s) => s.cancelTargetPicker);

  const power = showTargetPicker ? POWERS[showTargetPicker.powerKey] : null;

  return (
    <AnimatePresence>
      {showTargetPicker && power && (
        <ModalOverlay onClose={cancelTargetPicker} className="max-w-sm">
          <div className="p-6">
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
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
