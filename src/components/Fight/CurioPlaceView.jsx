import { lazy, Suspense, useEffect, useState } from 'react';
import { getUniverse } from '../../data/universes';
import TeamAvatar from '../TeamAvatar';
import { useT } from '../../i18n';

/**
 * Duel Curioscope — écran du DUELLISTE sur les surfaces distantes : téléphone
 * (mode « écran + téléphones ») et client en ligne (+ fenêtre de l'hôte-joueur
 * en ligne, via CurioDuelStage). Photo mystère + carte interactive + VALIDER,
 * puis révélation (pins des deux camps, cible, distances, points).
 *
 * `fight` au FORMAT PAYLOAD (turn.fight de sessionConfig) : le pin adverse et
 * la cible n'y figurent qu'à la révélation (anti-triche côté hôte). Mon propre
 * pin vit en état local (jamais diffusé avant validation).
 *
 * Contrat : onValidate({x,y}) envoie la position finale ; onNext() manche
 * suivante (après révélation).
 */

// Leaflet exige un DOM : lazy, comme partout ailleurs.
const UniverseMap = lazy(() => import('./minigames/UniverseMap.jsx'));

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function CurioPlaceView({ fight, teams, mySide, onValidate, onNext }) {
  const T = useT();
  const numLocale = T.lang === 'en' ? 'en-US' : 'fr-FR';
  const c = fight?.curio;
  const [mark, setMark] = useState(null);
  const [sent, setSent] = useState(false);
  // « Suivant » appuyé localement (optimiste) — la manche n'avance que quand
  // les DEUX camps l'ont demandé (nextReady côté hôte).
  const [nextSent, setNextSent] = useState(false);
  const roundNo = c?.roundNo || 1;
  // Nouvelle manche → repère local remis à zéro.
  useEffect(() => { setMark(null); setSent(false); setNextSent(false); }, [roundNo]);

  if (!c) return null;
  const u = getUniverse(c.universe);
  if (!u) return null;
  const att = teams?.[fight.attackerIndex];
  const def = teams?.[fight.defenderIndex];
  if (!att || !def) return null;
  const me = mySide === 'attacker' ? att : def;
  const reveal = c.reveal;
  const iValidated = sent || !!c.validated?.[mySide];
  const otherValidated = !!c.validated?.[mySide === 'attacker' ? 'defender' : 'attacker'];
  const iNextReady = nextSent || !!c.nextReady?.[mySide];

  const fmt = (d) => {
    if (d < 1) return T('fight.geo.pileDessus');
    return T(u.unit === 'km' ? 'fight.geo.km' : 'curio.dist.lieues', { n: Number(d).toLocaleString(numLocale) });
  };
  const pts = (n) => T('fight.geo.points', { n: Number(n || 0).toLocaleString(numLocale) });
  const mapFallback = <div style={{ width: '100%', height: '100%', background: '#101c26' }} />;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'radial-gradient(ellipse at 50% 30%, #1c2a3a 0%, #0b131c 70%)',
      display: 'flex', flexDirection: 'column', padding: 10, gap: 8, color: '#fff',
    }}>
      {/* En-tête : manche + scores de course */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontSize: 13 }}>
        <TeamAvatar team={att} size={22} />
        <span style={{ color: '#f3c969' }}>{pts(c.scores?.attacker)}</span>
        <span style={{ margin: '0 auto', color: 'rgba(255,255,255,0.75)' }}>
          {T('curio.duel.round', { n: roundNo })}
        </span>
        <span style={{ color: '#f3c969' }}>{pts(c.scores?.defender)}</span>
        <TeamAvatar team={def} size={22} />
      </div>

      {/* Photo mystère (ou « Place : X ») */}
      <div style={{
        borderRadius: 12, background: 'rgba(255,254,251,0.95)', color: 'var(--ink-900)',
        padding: '8px 12px', textAlign: 'center', fontFamily: 'var(--font-display)',
      }}>
        {c.image ? (
          <img
            src={c.image} alt={T('fight.placement.mysteryAlt')} draggable={false}
            style={{ width: '100%', maxHeight: '26vh', objectFit: 'contain', borderRadius: 8, userSelect: 'none' }}
          />
        ) : null}
        <div style={{ fontSize: 15, marginTop: 4 }}>
          {c.showName && c.label
            ? T('fight.placement.place', { label: c.label })
            : T('fight.placement.whereIsThis')}
        </div>
      </div>

      {/* Carte : placement (ma copie) puis révélation commune */}
      <div style={{ flex: 1, minHeight: 0, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
        <Suspense fallback={mapFallback}>
          {!reveal ? (
            <UniverseMap
              key={`${u.id}-place`}
              universe={u}
              interactive={!iValidated}
              onPlace={setMark}
              pins={mark ? [{ team: me, pos: mark }] : []}
            />
          ) : (
            <UniverseMap
              key={`${u.id}-reveal`}
              universe={u}
              pins={[{ team: att, pos: reveal.marks.attacker }, { team: def, pos: reveal.marks.defender }]}
              target={reveal.target}
              lines={[
                { from: reveal.marks.attacker, to: reveal.target, color: att.color },
                { from: reveal.marks.defender, to: reveal.target, color: def.color },
              ]}
              badges={[
                { pos: mid(reveal.marks.attacker, reveal.target), label: fmt(reveal.dA), color: att.color },
                { pos: mid(reveal.marks.defender, reveal.target), label: fmt(reveal.dB), color: def.color },
              ]}
              fit={[reveal.marks.attacker, reveal.marks.defender, reveal.target]}
            />
          )}
        </Suspense>
        {!reveal && iValidated && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(10,16,24,0.55)', fontFamily: 'var(--font-display)', fontSize: 18, textAlign: 'center', padding: 20,
          }}>
            {otherValidated ? '…' : T('fight.placement.waitingOpponent')}
          </div>
        )}
      </div>

      {/* Pied : valider / résultat de manche */}
      {!reveal ? (
        <button
          className="btn btn--green"
          disabled={!mark || iValidated}
          style={{ opacity: !mark || iValidated ? 0.45 : 1, padding: '12px 0', fontSize: 16 }}
          onClick={() => { if (mark && !iValidated) { setSent(true); onValidate(mark); } }}
        >
          {iValidated ? T('fight.placement.waitingOpponent') : T('fight.placement.validatePlacement')}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-ui)', fontSize: 13, textAlign: 'center' }}>
          <div>
            {'\u{1F3AF}'} <strong>{c.label || reveal.target.label}</strong>
            {' — '}{att.emoji} {fmt(reveal.dA)} <strong style={{ color: '#f3c969' }}>+{pts(reveal.pA)}</strong>
            {' · '}{def.emoji} {fmt(reveal.dB)} <strong style={{ color: '#f3c969' }}>+{pts(reveal.pB)}</strong>
          </div>
          <button
            className="btn btn--green"
            disabled={iNextReady}
            style={{ padding: '10px 0', fontSize: 15, opacity: iNextReady ? 0.45 : 1 }}
            onClick={() => { if (!iNextReady) { setNextSent(true); onNext(); } }}
          >
            {iNextReady ? T('fight.placement.waitingOpponent') : T('fight.placement.next')}
          </button>
        </div>
      )}
    </div>
  );
}
