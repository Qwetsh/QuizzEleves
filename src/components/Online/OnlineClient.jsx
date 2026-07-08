// Client « jeu en ligne » côté SPECTATEUR (miroir, lecture). Ouvert via
// ?online=CODE : s'abonne à la session, hydrate le store depuis l'instantané
// diffusé par l'hôte, et rend l'app complète (plateau en direct). Ne calcule
// rien — c'est un reflet de l'autorité.
import { useEffect, useRef, useState } from 'react';
import App from '../../App';
import { useGameStore } from '../../store/gameStore';
import { fetchSession, subscribeSession, subscribePresence, randomToken } from '../../logic/sessionConfig';
import { hydrateSnapshot } from '../../logic/onlineSnapshot';
import OnlineController from './OnlineController';

export default function OnlineClient({ code }) {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('connecting');
  const [hostOnline, setHostOnline] = useState(false);
  const [viewers, setViewers] = useState(0);
  // Payload « manette » diffusé par l'hôte (pour piloter son tour) + fraîcheur.
  const [ctrl, setCtrl] = useState(null);
  const [lastSync, setLastSync] = useState(0);
  const tokenRef = useRef(null);
  if (!tokenRef.current) tokenRef.current = randomToken();

  useEffect(() => {
    if (!code) return;
    let alive = true;
    const apply = (data) => {
      if (!alive) return;
      const slice = hydrateSnapshot(data);
      if (slice) { useGameStore.setState(slice); setReady(true); }
      setCtrl(data?.ctrl ?? null);
      setLastSync(Date.now());
    };
    // Rattrapage immédiat, puis flux temps réel.
    fetchSession(code).then((d) => { if (d) apply(d); }).catch(() => {});
    const unsub = subscribeSession(code, apply, (st) => setStatus(st === 'SUBSCRIBED' ? 'live' : st));
    return () => { alive = false; unsub(); };
  }, [code]);

  // Présence : l'hôte est-il là ? combien de spectateurs ?
  useEffect(() => {
    if (!code) return;
    return subscribePresence(code, { role: 'spectator', token: tokenRef.current }, (list) => {
      setHostOnline(list.some((p) => p.role === 'host'));
      setViewers(list.filter((p) => p.role === 'spectator').length);
    });
  }, [code]);

  if (!ready) {
    return (
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        background: '#0b0e12', color: '#bfeccb', fontFamily: 'var(--font-ui)', textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: 26, color: '#66ff8a', marginBottom: 8 }}>🌐 Jeu en ligne</div>
          <div>Connexion à la partie <b style={{ letterSpacing: 2 }}>{code || '—'}</b>…</div>
          {status !== 'connecting' && status !== 'live' && (
            <div style={{ fontSize: 12, color: '#8b9096', marginTop: 8 }}>({String(status)})</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <App />
      {/* Manette du joueur distant : choix d'équipe, puis pilotage de son tour. */}
      <OnlineController code={code} ctrl={ctrl} lastSync={lastSync} />
      {/* Bandeau discret : liveness + spectateurs. */}
      <div style={{
        position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '4px 12px', borderRadius: 999, background: 'rgba(10,14,18,0.9)',
        border: '1px solid #16351f', fontFamily: 'var(--font-ui)', fontSize: 12,
      }}>
        <span style={{ color: hostOnline ? '#66ff8a' : '#ff8a7a' }}>
          {hostOnline ? '🟢 EN DIRECT' : '🔴 Hôte hors ligne'}
        </span>
        <span style={{ color: '#8b9096' }}>👁️ SPECTATEUR · {code}</span>
        {viewers > 1 && <span style={{ color: '#bfeccb' }}>· {viewers} 👁️</span>}
      </div>
    </>
  );
}
