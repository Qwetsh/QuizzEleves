import { SUBJECTS } from '../../../data/subjects';
import { POWERS } from '../../../data/powers';
import { useGameStore } from '../../../store/gameStore';
import { useT } from '../../../i18n';
import { locName } from '../../../i18n/content';
import { getEffectValue } from '../../../logic/itemEffects';
import TeamAvatar from '../../TeamAvatar';

export default function TeamCard({ team, index }) {
  const T = useT();
  const currentTeam = useGameStore((s) => s.currentTeam);
  const finished = useGameStore((s) => s.finished);
  const isCurrent = index === currentTeam && !finished;

  const powerEntries = Object.entries(team.powers || {}).map(([key, val]) => ({
    key,
    info: POWERS[key],
    charges: val.charges,
  }));

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px',
        borderRadius: 12,
        marginBottom: 6,
        border: isCurrent ? '2px solid var(--gold-500)' : '2px solid transparent',
        background: isCurrent
          ? 'linear-gradient(90deg, rgba(243,201,105,0.2), rgba(243,201,105,0.05))'
          : 'rgba(255, 250, 240, 0.5)',
        boxShadow: isCurrent ? '0 0 0 3px rgba(243,201,105,0.15)' : 'none',
        transition: 'all 160ms ease',
      }}
    >
      <TeamAvatar team={team} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink-900)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {team.name}
          {isCurrent && <span style={{ fontSize: 11, color: 'var(--gold-700)' }}>{'\u25C0'} {T('game.turnMarker')}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
          {powerEntries.map(({ key, info, charges }) => (
            <span key={key} title={locName(info)}>{info.icon} {charges}</span>
          ))}
          {(team.sablierActif || (team.doubleActive && team.doubleTimerDivisor)) && <span title={T('game.timerHalf')}>{"\u23F1\uFE0F"}</span>}
          {team.doubleActive && <span title={T('game.doubleQuestion')}>{"\u2753"}</span>}
          {team.itemShield > 0 && (
            <span title={T('game.shieldBlocks', { n: team.itemShield })}>
              {"\u{1F6E1}\uFE0F"}{team.itemShield > 1 ? team.itemShield : ''}
            </span>
          )}
          {team.itemFumigene && (
            <span title={team.itemFumigeneTurns
              ? T('game.smokeNextOffTurns', { turns: team.itemFumigeneTurns })
              : T('game.smokeNextOff')}>
              {"\u{1F4A8}"}{team.itemFumigeneTurns ? team.itemFumigeneTurns : ''}
            </span>
          )}
          {team.powersBlockedTurns > 0 && (
            <span title={T('game.powersBlocked', { n: team.powersBlockedTurns })}>{'\u{1F6AB}'}{'⚡'}{team.powersBlockedTurns}</span>
          )}
          {team.consumablesBlockedTurns > 0 && (
            <span title={T('game.consumablesBlocked', { n: team.consumablesBlockedTurns })}>{'\u{1F6AB}'}{'\u{1F9EA}'}{team.consumablesBlockedTurns}</span>
          )}
          {getEffectValue(team, 'itemStealImmune') > 0 && (
            <span title={T('game.itemStealImmune')}>{'\u{1F512}'}{'\u{1F392}'}</span>
          )}
          {(getEffectValue(team, 'goldStealImmune') > 0 || getEffectValue(team, 'stealProtection') >= 100) && (
            <span title={T('game.goldStealImmune')}>{'\u{1F512}'}{'\u{1FA99}'}</span>
          )}
          {getEffectValue(team, 'reflectChance') > 0 && (
            <span title={T('game.reflectChance', { n: Math.min(100, getEffectValue(team, 'reflectChance')) })}>{'↩️'}</span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', fontSize: 12, fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="coin" /> <span>{team.money}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-500)' }}>
          <span style={{ color: '#2f9d5a' }}>{"\u2713"} {team.correct}</span>
          <span style={{ color: '#c9472f' }}>{"\u2717"} {team.wrong}</span>
        </div>
      </div>
    </div>
  );
}
