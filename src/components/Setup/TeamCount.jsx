import { useGameStore } from '../../store/gameStore';

export default function TeamCount() {
  const nbTeams = useGameStore((s) => s.nbTeams);
  const setNbTeams = useGameStore((s) => s.setNbTeams);

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold mb-2 text-[var(--muted)]">
        {`Nombre d'\u00e9quipes : ${nbTeams}`}
      </label>
      <input
        type="range"
        min={2}
        max={6}
        value={nbTeams}
        onChange={(e) => setNbTeams(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
      </div>
    </div>
  );
}
