import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';

export default function TeamCount() {
  const T = useT();
  const nbTeams = useGameStore((s) => s.nbTeams);
  const setNbTeams = useGameStore((s) => s.setNbTeams);

  return (
    <div className="mb-4">
      <div className="field-label">{T('setup.teamsInPlay', { n: nbTeams })}</div>
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
