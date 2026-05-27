import { SUBJECTS } from '../../../data/subjects';
import { POWERS } from '../../../data/powers';
import { useGameStore } from '../../../store/gameStore';

export default function TeamCard({ team, index }) {
  const currentTeam = useGameStore((s) => s.currentTeam);
  const board = useGameStore((s) => s.board);
  const finished = useGameStore((s) => s.finished);
  const isCurrent = index === currentTeam && !finished;

  const node = board?.[team.pos];
  let posLabel = '?';
  if (node) {
    if (node.type === 'depart') posLabel = 'd\u00e9part';
    else if (node.type === 'arrivee') posLabel = '\u{1F3C1} arriv\u00e9e';
    else if (node.type === 'jonction') posLabel = 'jonction';
    else if (node.type === 'event') posLabel = '\u{1F381} \u00e9v\u00e9nement';
    else if (node.type === 'subject') posLabel = SUBJECTS[node.subject]?.name || node.subject;
  }

  const powerEntries = Object.entries(team.powers || {}).map(([key, val]) => ({
    key,
    info: POWERS[key],
    charges: val.charges,
  }));

  return (
    <div
      className={`rounded-lg p-2 mb-1 border-2 transition ${
        isCurrent
          ? 'border-yellow-400 bg-yellow-50 shadow-md'
          : 'border-transparent bg-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{team.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate" style={{ color: team.color }}>
            {team.name}
            {isCurrent && <span className="ml-1 text-xs text-yellow-600">{"\u25C0"}</span>}
          </div>
          <div className="text-xs text-[var(--muted)]">{posLabel}</div>
        </div>
        <div className="text-right text-xs text-[var(--muted)]">
          <div>{"\u{1F4B0}"} {team.money}</div>
          <div>{"\u2705"} {team.correct} {"\u274C"} {team.wrong}</div>
        </div>
      </div>
      {powerEntries.length > 0 && (
        <div className="flex gap-1 mt-1">
          {powerEntries.map(({ key, info, charges }) => (
            <span
              key={key}
              className={`text-xs px-1.5 py-0.5 rounded border ${
                info.category === 'def'
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-red-300 bg-red-50'
              } ${charges === 0 ? 'opacity-40' : ''}`}
              title={info.desc}
            >
              {info.icon} {charges}
            </span>
          ))}
          {team.sablierActif && (
            <span className="text-xs px-1 py-0.5 rounded border border-orange-300 bg-orange-50" title="Timer /2 au prochain tour">
              {"\u23F1\uFE0F"}
            </span>
          )}
          {team.doubleActive && (
            <span className="text-xs px-1 py-0.5 rounded border border-purple-300 bg-purple-50" title="Double question au prochain tour">
              {"\u2753"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
