import { useGameStore } from '../../store/gameStore';

export default function TeamCustomization() {
  const setupTeams = useGameStore((s) => s.setupTeams);
  const updateSetupTeam = useGameStore((s) => s.updateSetupTeam);

  return (
    <div className="flex flex-col gap-2">
      {setupTeams.map((team, i) => {
        const inputId = `team-name-${i}`;
        return (
          <div
            key={`setup-team-${i}`}
            className="flex items-center gap-3"
            style={{
              padding: 10,
              borderRadius: 14,
              background: 'var(--parch-50)',
              border: '1px solid rgba(122, 94, 58, 0.16)',
            }}
          >
            <div
              aria-label={`Couleur de l'\u00e9quipe ${team.name}: ${team.color}`}
              role="img"
              style={{
                width: 18, height: 38, borderRadius: 5,
                background: team.color,
                boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)',
              }}
            />
            <label htmlFor={inputId} className="text-2xl" aria-label={`Ic\u00f4ne \u00e9quipe ${i + 1}`}>
              {team.emoji}
            </label>
            <input
              id={inputId}
              type="text"
              value={team.name}
              onChange={(e) => updateSetupTeam(i, { name: e.target.value })}
              maxLength={20}
              aria-label={`Nom de l'\u00e9quipe ${i + 1}`}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '8px 10px',
                fontFamily: 'var(--font-ui)',
                fontSize: 16,
                color: 'var(--ink-900)',
                outline: 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
