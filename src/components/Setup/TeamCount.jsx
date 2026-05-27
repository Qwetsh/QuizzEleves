import { useGameStore } from '../../store/gameStore';

export default function TeamCount() {
  const nbTeams = useGameStore((s) => s.nbTeams);
  const setNbTeams = useGameStore((s) => s.setNbTeams);

  return (
    <div className="mb-4">
      <div className="field-label">{`\u00c9quipes \u2014 ${nbTeams} en lice`}</div>
      <div className="flex items-center gap-3.5">
        <input
          type="range"
          min={2}
          max={6}
          value={nbTeams}
          onChange={(e) => setNbTeams(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: '#b8862c' }}
        />
        <strong style={{ fontFamily: 'var(--font-display)', fontSize: 22, width: 36, textAlign: 'center' }}>
          {nbTeams}
        </strong>
      </div>
    </div>
  );
}
