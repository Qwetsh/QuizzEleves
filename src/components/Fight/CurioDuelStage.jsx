import { lazy, Suspense } from 'react';
// Police « LCD » du bandeau TV rétro (auto-hébergée, comme l'écran cassettes).
import '@fontsource/vt323/400.css';
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
      nextReady: c.nextReady || null,
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
        onNext={() => curioDuelNext(hostSide)}
      />
    );
  }

  // --- Vue spectateur (écran partagé / miroir) — habillage TV 90s plein cadre :
  // bandeau plastique en haut (manche + consigne), photo mystère PLEIN ÉCRAN
  // avec scanlines CRT, et deux « score bugs » compacts en surimpression bas
  // gauche/droite (façon habillage de retransmission télé).
  const u = c.target?.universe ? getUniverse(c.target.universe) : null;
  const reveal = c.reveal;
  const fmt = (d) => {
    if (d < 1) return T('fight.geo.pileDessus');
    return T(u?.unit === 'km' ? 'fight.geo.km' : 'curio.dist.lieues', { n: Number(d).toLocaleString(numLocale) });
  };
  const pts = (n) => T('fight.geo.points', { n: Number(n || 0).toLocaleString(numLocale) });
  const showLabel = c.target && (c.target.showName || reveal) ? c.target.label : null;
  const mapFallback = <div style={{ width: '100%', height: '100%', background: '#101c26' }} />;

  // Bandeau « plastique » commun haut/bas (bevel clair dessus, sombre dessous).
  const plastic = {
    background: 'linear-gradient(180deg, #463e30 0%, #2a2317 100%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.4)',
  };

  // « Score bug » compact d'un camp, en surimpression sur la photo.
  const chip = (team, side, corner) => {
    const done = !!c.validated?.[side];
    return (
      <div style={{
        position: 'absolute', bottom: 16, [corner]: 16, zIndex: 3, maxWidth: '36%',
        display: 'flex', alignItems: 'stretch', gap: 9, padding: '6px 12px 6px 8px',
        borderRadius: 9, border: '2px solid #0f0b06', ...plastic,
        boxShadow: `${plastic.boxShadow}, 0 8px 20px rgba(0,0,0,0.55)`,
      }}>
        <span style={{ width: 5, borderRadius: 3, background: team.color, flexShrink: 0 }} />
        <TeamAvatar team={team} size={30} />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 12, color: '#fff', lineHeight: 1.15,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {team.name}
          </span>
          <span style={{
            fontFamily: "'VT323', monospace", fontSize: 19, lineHeight: 1, color: '#f3c969',
            textShadow: '0 0 6px rgba(243,201,105,0.4)',
          }}>
            {pts(c.scores?.[side])}
          </span>
        </div>
        <span
          title={done ? T('fight.placement.validated') : T('curio.duel.placing')}
          style={{ alignSelf: 'center', fontSize: 17, color: done ? '#7dffa5' : 'rgba(255,255,255,0.7)' }}
        >
          {done ? '✔' : '⏳'}
        </span>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, color: '#fff' }}>
      {/* Bandeau haut : manche (LCD vert) + consigne + rappel téléphones */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '7px 18px',
        borderBottom: '3px solid #120d07', ...plastic,
      }}>
        <span style={{
          fontFamily: "'VT323', monospace", fontSize: 22, letterSpacing: 1, whiteSpace: 'nowrap',
          color: '#7dffa5', textShadow: '0 0 7px rgba(125,255,165,0.5)',
        }}>
          {'\u{1F52D}'} {T('curio.duel.round', { n: c.roundNo })}
        </span>
        <span style={{
          flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 21,
          color: '#f3c969', textShadow: '0 2px 0 rgba(0,0,0,0.5)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {reveal
            ? <>{'\u{1F3AF}'} {c.target.label}</>
            : (showLabel ? T('fight.placement.place', { label: showLabel }) : T('fight.placement.whereIsThis'))}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
          {'\u{1F4F1}'} {T('curio.duel.phonesHint')}
        </span>
      </div>

      {!reveal ? (
        /* Scène : photo mystère plein cadre + scanlines + score bugs */
        <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#07060a', overflow: 'hidden' }}>
          {c.target?.image && (
            <img
              src={c.target.image} alt={T('fight.placement.mysteryAlt')} draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
            />
          )}
          {/* Scanlines + vignette CRT (au-dessus de la photo, sous les chips) */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.14) 0 1px, transparent 1px 3px)',
          }} />
          <div aria-hidden style={{
            position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
            boxShadow: 'inset 0 0 130px 28px rgba(0,0,0,0.55)',
          }} />
          {chip(attacker, 'attacker', 'left')}
          {chip(defender, 'defender', 'right')}
        </div>
      ) : (
        <>
          {/* Révélation : carte plein cadre + bandeau résultat rétro */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
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
          <div style={{
            display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
            padding: '8px 16px', borderTop: '3px solid #120d07', ...plastic,
            fontFamily: 'var(--font-ui)', fontSize: 14,
          }}>
            {[['attacker', attacker, reveal.dA, reveal.pA], ['defender', defender, reveal.dB, reveal.pB]].map(([side, team, d, p]) => (
              <span key={side} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <TeamAvatar team={team} size={22} />
                {fmt(d)}
                <strong style={{ fontFamily: "'VT323', monospace", fontSize: 19, color: '#f3c969' }}>+{pts(p)}</strong>
                {/* ✔ = ce camp a déjà demandé la manche suivante sur son écran */}
                {c.nextReady?.[side] && <span style={{ color: '#7dffa5' }}>{'✔'}</span>}
              </span>
            ))}
            {!mirror && (
              <button className="btn btn--green" onPointerDown={() => curioDuelNext()} style={{ padding: '8px 22px' }}>
                {T('fight.placement.next')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
