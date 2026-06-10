import { POWERS } from '../../data/powers';
import { SUBJECTS } from '../../data/subjects';
import { useGameStore } from '../../store/gameStore';
import '../../styles/team-strip-hud.css';

const TILE_TYPES = {
  depart:   { icon: '\u{1F3F0}', label: 'D\u00e9part' },
  arrivee:  { icon: '\u{1F3C6}', label: 'Arriv\u00e9e' },
  jonction: { icon: '\u{1F3B2}', label: 'Carrefour' },
  event:    { icon: '\u2728',    label: '\u00C9v\u00e9nement' },
};

function biomeKey(subjectId) {
  if (subjectId === 'geographie') return 'geo';
  return subjectId;
}

function PowerBadge({ powerKey, charges, level, kindLabel }) {
  const info = POWERS[powerKey];
  if (!info) return null;
  const empty = charges <= 0;
  return (
    <div
      className={'power-badge ' + (empty ? 'is-empty' : '')}
      style={{ '--power-color': info.color }}
      title={`${info.name} — Niv.${level} — ${charges} charge${charges > 1 ? 's' : ''}\n${info.desc}`}
    >
      <div className="power-badge-disc">
        <span className="power-badge-icon">{info.icon}</span>
        <span className="power-badge-count">{charges}</span>
        {level > 1 && <span className="power-badge-level">{level}</span>}
      </div>
      <div className="power-badge-meta">
        <div className="power-badge-kind">{kindLabel}</div>
        <div className="power-badge-name">{info.name}</div>
      </div>
    </div>
  );
}

function TeamStripCard({ team, active, rank, total, compact }) {
  const board = useGameStore((s) => s.board);

  const powers = team.powers || {};
  const defKey = team.powerDef;
  const offKey = team.powerOff;

  // Resolve current tile and biome — board is { nodeId: nodeObj }
  const currentNode = board?.[team.pos];
  const subject = currentNode?.subject && currentNode.subject !== 'multi'
    ? SUBJECTS[currentNode.subject]
    : null;
  const tileType = currentNode ? TILE_TYPES[currentNode.type] : null;

  const accent = team.color || '#888';
  const totalQ = (team.correct ?? 0) + (team.wrong ?? 0);
  const winRate = totalQ > 0 ? Math.round((team.correct / totalQ) * 100) : null;

  return (
    <div
      className={'ts-card ' + (active ? 'is-active' : '')}
      style={{ '--team-accent': accent }}
    >
      {active && (
        <div className="ts-card-tab">
          <span className="ts-card-tab-arrow">{'\u25B6'}</span> {'\u00C0'} TOI DE JOUER
        </div>
      )}

      <div className="ts-card-stripe" aria-hidden="true" />

      <div className="ts-card-blazon">
        <div style={{
          width: compact ? 38 : 52, height: compact ? 38 : 52, borderRadius: compact ? 11 : 14,
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 20 : 26,
          boxShadow: active
            ? `inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.18), 0 0 12px ${accent}66`
            : 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.15)',
        }}>
          {team.emoji}
        </div>
        <div className="ts-card-rank">{rank}<span>/{total}</span></div>
      </div>

      <div className="ts-card-body">
        <div className="ts-card-head">
          <div className="ts-card-name" style={{ color: accent }}>{team.name}</div>
          <div className="ts-card-location">
            {subject ? (
              <>
                <span
                  className="ts-card-location-ico"
                  style={{
                    background: `var(--m-${biomeKey(currentNode.subject)}-soft)`,
                    color: `var(--m-${biomeKey(currentNode.subject)}-deep)`,
                  }}
                >
                  {subject.icon}
                </span>
                <span className="ts-card-location-text">{subject.biome}</span>
              </>
            ) : tileType ? (
              <>
                <span className="ts-card-location-ico ts-card-location-ico--neutral">{tileType.icon}</span>
                <span className="ts-card-location-text">{tileType.label}</span>
              </>
            ) : (
              <span className="ts-card-location-text" style={{ opacity: 0.5 }}>En attente…</span>
            )}
          </div>
        </div>

        <div className="ts-card-stats">
          <div className="ts-stat ts-stat--coin" title="Pi\u00e8ces d'or">
            <span className="coin ts-stat-coin" />
            <span className="ts-stat-num">{team.money ?? 0}</span>
          </div>
          <div className="ts-stat ts-stat--good" title="Bonnes r\u00e9ponses">
            <span className="ts-stat-ico">{'\u2713'}</span>
            <span className="ts-stat-num">{team.correct ?? 0}</span>
          </div>
          <div className="ts-stat ts-stat--bad" title="Erreurs">
            <span className="ts-stat-ico">{'\u2717'}</span>
            <span className="ts-stat-num">{team.wrong ?? 0}</span>
          </div>
          {winRate !== null && (
            <div className="ts-stat ts-stat--rate" title="Taux de r\u00e9ussite">
              <span className="ts-stat-ico">{'\u25CE'}</span>
              <span className="ts-stat-num">{winRate}<small>%</small></span>
            </div>
          )}
        </div>
      </div>

      <div className="ts-card-powers">
        {defKey && (
          <PowerBadge
            powerKey={defKey}
            charges={powers[defKey]?.charges ?? 0}
            level={powers[defKey]?.level ?? 1}
            kindLabel="Défense"
          />
        )}
        {offKey && (
          <PowerBadge
            powerKey={offKey}
            charges={powers[offKey]?.charges ?? 0}
            level={powers[offKey]?.level ?? 1}
            kindLabel="Attaque"
          />
        )}
      </div>
    </div>
  );
}

export default function BottomBar() {
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const finished = useGameStore((s) => s.finished);

  const compact = teams.length >= 5;

  return (
    <div className={'team-strip' + (compact ? ' team-strip--compact' : '')}>
      <div className="team-strip-inner">
        {teams.map((t, i) => (
          <TeamStripCard
            key={`ts-${t.name}-${i}`}
            team={t}
            active={i === currentTeam && !finished}
            rank={i + 1}
            total={teams.length}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
