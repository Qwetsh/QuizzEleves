import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';

export default function PowerSetup() {
  const teams = useGameStore((s) => s.teams);
  const powerSetupIndex = useGameStore((s) => s.powerSetupIndex);
  const powerSetupCategory = useGameStore((s) => s.powerSetupCategory);
  const selectPower = useGameStore((s) => s.selectPower);
  const advancePowerSetup = useGameStore((s) => s.advancePowerSetup);

  const team = teams[powerSetupIndex];
  if (!team) return null;

  const isDef = powerSetupCategory === 'def';
  const powers = Object.entries(POWERS).filter(([, p]) => p.category === powerSetupCategory);

  const handleSelect = (key) => {
    selectPower(powerSetupIndex, powerSetupCategory, key);
    advancePowerSetup();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-[var(--paper)] rounded-2xl shadow-lg max-w-lg w-full p-6">
        <div
          className="text-center text-sm font-bold text-white rounded-full px-4 py-1 inline-block mb-4"
          style={{ background: isDef ? '#3b82f6' : '#dc2626' }}
        >
          {isDef ? '\u{1F6E1}\uFE0F POUVOIR D\u00c9FENSIF' : '\u2694\uFE0F POUVOIR OFFENSIF'}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-5 h-10 rounded"
            style={{ background: team.color }}
          />
          <span className="text-xl font-bold">{team.emoji} {team.name}</span>
          <span className="text-sm text-[var(--muted)] ml-auto">
            {`${powerSetupIndex + 1}/${teams.length}`}
          </span>
        </div>

        <div className="space-y-3">
          {powers.map(([key, p]) => (
            <button
              key={key}
              onClick={() => handleSelect(key)}
              className="w-full flex items-start gap-3 p-4 bg-white rounded-xl border-2 border-[var(--border)] hover:border-blue-400 hover:shadow-md transition text-left"
            >
              <span className="text-3xl">{p.icon}</span>
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-sm text-[var(--muted)]">{p.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
