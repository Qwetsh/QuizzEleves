import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import {
  getUniverse, universeMetric, universeScore, pickSpot,
} from '../../data/universes';
import { spotPhoto } from '../Fight/minigames/Curioscope';
import TeamAvatar from '../TeamAvatar';
import { soundClick, soundCorrect } from '../../logic/sounds';
import { useT } from '../../i18n';

/**
 * Défi Curioscope SOLO (action d'effet `startMinigame`) : l'équipe joue N
 * manches de guessr (photo/nom → pin sur la carte zoomable → points à la
 * distance). À la fin, `curioChallengeResolve(total)` reprend la file
 * d'actions du moteur, qui convertit le total en récompense (paliers).
 * Même moteur de tirage que le duel : anti-répétition LRU (curioSeen) +
 * exclusion intra-défi.
 */

// Leaflet exige un DOM : lazy, comme dans Curioscope.jsx.
const UniverseMap = lazy(() => import('../Fight/minigames/UniverseMap.jsx'));

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function CurioChallengeModal() {
  const ch = useGameStore((s) => s.showCurioChallenge);
  if (!ch) return null;
  return <Challenge ch={ch} />;
}

function Challenge({ ch }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const resolve = useGameStore((s) => s.curioChallengeResolve);
  const team = teams[ch.teamIndex];
  const numLocale = T.lang === 'en' ? 'en-US' : 'fr-FR';
  // Rotation uniquement parmi les univers qui ont des spots (cf. Curioscope.jsx).
  const universes = (() => {
    const ok = (ch.universes || []).filter((id) => (getUniverse(id)?.spots() || []).length > 0);
    return ok.length ? ok : ['monde_reel'];
  })();

  const [roundNo, setRoundNo] = useState(1);
  const [total, setTotal] = useState(0);
  const [spot, setSpot] = useState(null);
  const [mark, setMark] = useState(null);
  const [reveal, setReveal] = useState(null); // { d, pts } | null
  const usedIds = useRef([]);
  const uRef = useRef(getUniverse(universes[0]) || getUniverse('monde_reel'));

  // Tirage du spot à chaque manche (rotation des univers + LRU + exclusion).
  useEffect(() => {
    const uid = universes[(roundNo - 1) % universes.length];
    const u = getUniverse(uid) || getUniverse('monde_reel');
    uRef.current = u;
    const st = useGameStore.getState();
    const s = pickSpot(u, (st.curioSeen || {})[u.id] || {}, roundNo, new Set(usedIds.current));
    if (!s) { resolve(total); return; }
    usedIds.current = [...usedIds.current, s.id];
    st.curioMarkSeen(u.id, s.id);
    setSpot(s); setMark(null); setReveal(null);
  }, [roundNo]);

  if (!team || !spot) return null;
  const u = uRef.current;

  const fmtDist = (d) => {
    if (d < 1) return T('fight.geo.pileDessus');
    return T(u.unit === 'km' ? 'fight.geo.km' : 'curio.dist.lieues', { n: d.toLocaleString(numLocale) });
  };

  const place = (pos) => { if (!reveal) { soundClick(); setMark(pos); } };

  const validate = () => {
    if (!mark || reveal) return;
    const d = universeMetric(u, mark, spot);
    const pts = universeScore(u, d);
    soundCorrect();
    setReveal({ d, pts });
    setTotal((t) => t + pts);
  };

  const next = () => {
    if (!reveal) return;
    soundClick();
    if (roundNo >= ch.rounds) resolve(total);
    else setRoundNo((r) => r + 1);
  };

  const photo = spotPhoto(spot);
  const mapFallback = <div style={{ width: '100%', height: '100%', background: '#101c26' }} />;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'radial-gradient(ellipse at 50% 40%, #1c2a3a 0%, #0b131c 70%)',
      display: 'flex', flexDirection: 'column', padding: 14, gap: 10,
    }}>
      {/* En-tête : défi + équipe + manche + total */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px',
        borderRadius: 12, background: 'rgba(255,254,251,0.10)',
        border: '1px solid rgba(243,201,105,0.3)', color: '#fff',
        fontFamily: 'var(--font-display)',
      }}>
        <span style={{ fontSize: 18, color: '#f3c969' }}>{T('modal.curio.title')}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <TeamAvatar team={team} size={28} />
          <span style={{ fontSize: 14 }}>{team.name}</span>
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
          {T('modal.curio.round', { i: roundNo, n: ch.rounds })}
        </span>
        <span style={{ fontSize: 16, color: '#f3c969' }}>
          {T('modal.curio.total', { n: total.toLocaleString(numLocale) })}
        </span>
      </div>

      {/* Consigne : photo mystère ou nom à placer */}
      <div style={{
        padding: '10px 20px', borderRadius: 14, textAlign: 'center',
        background: 'rgba(255,254,251,0.95)', fontFamily: 'var(--font-display)',
        fontSize: 17, color: 'var(--ink-900)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      }}>
        {photo ? (
          <>
            <img
              src={photo} alt={T('fight.placement.mysteryAlt')} draggable={false}
              style={{ height: 'clamp(180px, 36vh, 480px)', maxWidth: '92%', borderRadius: 10, objectFit: 'contain', display: 'block', margin: '0 auto 6px', boxShadow: '0 3px 10px rgba(0,0,0,0.3)', userSelect: 'none' }}
            />
            <strong style={{ fontSize: 19 }}>
              {spot.showName ? T('fight.placement.place', { label: spot.label }) : T('fight.placement.whereIsThis')}
            </strong>
          </>
        ) : (
          <>{T('fight.placement.placePrefix')} <strong style={{ fontSize: 21 }}>{spot.label}</strong></>
        )}
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2, fontFamily: 'var(--font-ui)' }}>
          {T('modal.curio.hint')}
        </div>
      </div>

      {/* Carte (pose puis révélation) */}
      <div style={{ flex: 1, minHeight: 0, borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', position: 'relative' }}>
        <Suspense fallback={mapFallback}>
          {!reveal ? (
            <UniverseMap
              key={`${u.id}-place`}
              universe={u}
              interactive
              onPlace={place}
              pins={mark ? [{ team, pos: mark }] : []}
            />
          ) : (
            <UniverseMap
              key={`${u.id}-reveal`}
              universe={u}
              pins={[{ team, pos: mark }]}
              target={spot}
              lines={[{ from: mark, to: spot, color: team.color }]}
              badges={[{ pos: mid(mark, spot), label: fmtDist(reveal.d), color: team.color }]}
              fit={[mark, spot]}
            />
          )}
        </Suspense>
      </div>

      {/* Pied : validation / résultat de manche */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-ui)', fontSize: 14, flexWrap: 'wrap' }}>
        {reveal ? (
          <>
            <span>
              {'\u{1F3AF}'} <strong>{spot.label}</strong> — {fmtDist(reveal.d)}
              <strong style={{ color: '#f3c969' }}>{' +' + T('fight.geo.points', { n: reveal.pts.toLocaleString(numLocale) })}</strong>
            </span>
            <button className="btn btn--green" onPointerDown={next} style={{ padding: '8px 22px' }}>
              {roundNo >= ch.rounds ? T('modal.curio.finish') : T('fight.placement.next')}
            </button>
          </>
        ) : (
          <button
            className="btn btn--green" onPointerDown={validate} disabled={!mark}
            style={{ opacity: mark ? 1 : 0.45, padding: '8px 22px' }}
          >
            {T('fight.placement.validatePlacement')}
          </button>
        )}
      </div>
    </div>
  );
}
