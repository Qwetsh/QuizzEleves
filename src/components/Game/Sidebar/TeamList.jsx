import { useGameStore } from '../../../store/gameStore';
import TeamCard from './TeamCard';

export default function TeamList() {
  const teams = useGameStore((s) => s.teams);

  return (
    <div>
      {teams.map((team, i) => (
        <TeamCard key={`team-${team.name}-${i}`} team={team} index={i} />
      ))}
    </div>
  );
}
