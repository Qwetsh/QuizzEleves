import { useGameStore } from '../../../store/gameStore';
import TeamCard from './TeamCard';

export default function TeamList() {
  const teams = useGameStore((s) => s.teams);

  return (
    <div>
      <h3 className="text-xs font-bold uppercase text-[var(--muted)] mb-1">{"\u00c9quipes"}</h3>
      {teams.map((team, i) => (
        <TeamCard key={i} team={team} index={i} />
      ))}
    </div>
  );
}
