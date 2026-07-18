import { lazy, Suspense } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getUniverse } from '../../data/universes';
import { onlineToken } from '../../logic/sessionConfig';
import TeamAvatar from '../TeamAvatar';
import CurioPlaceView from './CurioPlaceView';
import { useT } from '../../i18n';

/**
 * Duel Curioscope piloté par le STORE — rendu dans FightModal (phase minigame,
 * showFight.curio) :
 * - fenêtre de l'HÔTE EN LIGNE dont l'équipe est duelliste → il joue
 *   (CurioPlaceView branché sur les actions directes du store) ;
 * - sinon (écran partagé du mode « écran + téléphones », hôte non-duelliste,
 *   miroir en ligne) → vue SPECTATEUR : photo mystère en grand + statut des
 *   deux camps, puis la révélation sur la grande carte.
 */

const UniverseMap = lazy(() => import('./minigames/UniverseMap.jsx'));

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Adapte l'état store (données complètes) au format payload de CurioPlaceView.
function toViewFight(sf) {
  const c = sf.curio;
  return {
    attackerIndex: sf.attackerIndex,
    defenderIndex: sf.defenderIndex,
    curio: {
      roundNo: c.roundNo,
      scores: c.scores,
      universe: c.target?.universe || null,
      image: c.target?.image || null,
      showName: !!c.target?.showName,
      label: c.target ? c.target.label : null,
      validated: c.validated,
      reveal: c.reveal ? {
        ...c.reveal,
        target: { x: c.target.x, y: c.target.y, label: c.target.label },
        marks: c.marks,
      } : null,
    },
  };
}

export default function CurioDuelStage({ fight, attacker, defender }) {
  const T = useT();
  const numLocale = T.lang === 'en' ? 'en-US' : 'fr-FR';
  const teams = useGameStore((s) => s.teams);
  const mirror = useGameStore((s) => !!s._mirror);
  const online = useGameStore((s) => s.connectionMode === 'online');
  const sessionCode = useGameStore((s) => s.sessionCode);
  const curioDuelValidate = useGameStore((s) => s.curioDuelValidate);
  const curioDuelNext = useGameStore((s) => s.curioDuelNext);

  const c = fight.curio;
  if (!c) return null;

  // Hôte en ligne = joueur : si SON équipe est un des duellistes, il joue ici.
  let hostSide = null;
  if (online && !mirror) {
    const hostToken = sessionCode ? onlineToken(sessionCode) : null;
    for (const [side, idx] of [['attacker', fight.attackerIndex], ['defender', fight.defenderIndex]]) {
      const t = teams[idx];
      if (t && !t.isBot && (!t.token || (hostToken && t.token === hostToken))) { hostSide = side; break; }
    }
  }
  if (hostSide) {
    return (
      <CurioPlaceView
        fight={toViewFight(fight)}
        teams={teams}
        mySide={hostSide}
        onValidate={(pos) => curioDuelValidate(hostSide, pos)}
        onNext={curioDuelNext}
      />
    );
  }

  // --- Vue spectateur (écran partagé / miroir) ---
  const u = c.target?.universe ? getUniverse(c.target.universe) : null;
  const reveal = c.reveal;
  const fmt = (d) => {
    if (d < 1) return T('fight.geo.pileDessus');
    return T(u?.unit === 'km' ? 'fight.geo.km' : 'curio.dist.lieues', { n: Number(d).toLocaleString(numLocale) });
  };
  const pts = (n) => T('fight.geo.points', { n: Number(n || 0).toLocaleString(numLocale) });
  const showLabel = c.target && (c.target.showName || reveal) ? c.target.label : null;
  const mapFallback = <div style={{ width: '100%', height: '100%', background: '#101c26' }} />;

  const status = (team, side) => (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      padding: 14, borderRadius: 14,
      background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
      borderTop: `4px solid ${team.color}`, color: '#fff', fontFamily: 'var(--font-display)',
    }}>
      <TeamAvatar team={team} size={44} />
      <span style={{ fontSize: 15 }}>{team.name}</span>
      <span style={{ fontSize: 16, color: '#f3c969' }}>{pts(c.scores?.[side])}</span>
      <span style={{ fontSize: 22 }}>{c.validated?.[side] ? '✔' : '⏳'}</span>
      <span style={{ fontSize: 12, fontFamily: 'var(--font-ui)', color: 'rgba(255,255,255,0.75)' }}>
        {c.validated?.[side] ? T('fight.placement.validated') : T('curio.duel.placing')}
      </span>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 14, gap: 10, minHeight: 0, color: '#fff' }}>
      <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
        {'\u{1F52D}'} {T('curio.duel.round', { n: c.roundNo })} — {T('curio.duel.phonesHint')}
      </div>

      {!reveal ? (
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          {status(attacker, 'attacker')}
          <div style={{
            width: 'clamp(320px, 46vw, 900px)', display: 'flex', flexDirection: 'column', gap: 6,
            borderRadius: 14, background: 'rgba(255,254,251,0.95)', color: 'var(--ink-900)',
            padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-display)', minHeight: 0,
          }}>
            {c.target?.image && (
              <img
                src={c.target.image} alt={T('fight.placement.mysteryAlt')} draggable={false}
                style={{ flex: '1 1 auto', minHeight: 0, width: '100%', objectFit: 'contain', borderRadius: 10, userSelect: 'none' }}
              />
            )}
            <strong style={{ fontSize: 19 }}>
              {showLabel ? T('fight.placement.place', { label: showLabel }) : T('fight.placement.whereIsThis')}
            </strong>
          </div>
          {status(defender, 'defender')}
        </div>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            <Suspense fallback={mapFallback}>
              <UniverseMap
                key={`${u?.id}-reveal-stage`}
                universe={u}
                pins={[{ team: attacker, pos: c.marks.attacker }, { team: defender, pos: c.marks.defender }]}
                target={c.target}
                lines={[
                  { from: c.marks.attacker, to: c.target, color: attacker.color },
                  { from: c.marks.defender, to: c.target, color: defender.color },
                ]}
                badges={[
                  { pos: mid(c.marks.attacker, c.target), label: fmt(reveal.dA), color: attacker.color },
                  { pos: mid(c.marks.defender, c.target), label: fmt(reveal.dB), color: defender.color },
                ]}
                fit={[c.marks.attacker, c.marks.defender, c.target]}
              />
            </Suspense>
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ui)', fontSize: 14, flexWrap: 'wrap' }}>
            <span>{'\u{1F3AF}'} <strong>{c.target.label}</strong></span>
            <span>{attacker.emoji} {fmt(reveal.dA)} <strong style={{ color: '#f3c969' }}>+{pts(reveal.pA)}</strong></span>
            <span>{defender.emoji} {fmt(reveal.dB)} <strong style={{ color: '#f3c969' }}>+{pts(reveal.pB)}</strong></span>
            {!mirror && (
              <button className="btn btn--green" onPointerDown={curioDuelNext} style={{ padding: '8px 22px' }}>
                {T('fight.placement.next')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
