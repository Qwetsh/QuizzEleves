// Diffusion « jeu en ligne » côté HÔTE (autorité). Quand la partie tourne en
// mode `online`, ce composant crée une session et publie l'instantané COMPLET de
// l'état (onlineSnapshot) à chaque changement, pour que les clients « miroir »
// rendent le plateau en direct. Additif : n'a aucun effet hors mode online, et
// reste inactif sur un client miroir (garde `_mirror`).
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { OFFLINE } from '../../logic/offline';
import { createSession, publishSession, subscribePresence, randomToken } from '../../logic/sessionConfig';
import { serializeSnapshot } from '../../logic/onlineSnapshot';

// Lien à partager pour rejoindre en spectateur (respecte la base GitHub Pages).
export function onlineUrl(code) {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}?online=${code}`;
}

export default function OnlineHost() {
  const connectionMode = useGameStore((s) => s.connectionMode);
  const phase = useGameStore((s) => s.phase);
  const mirror = useGameStore((s) => s._mirror);
  const code = useGameStore((s) => s.sessionCode);
  const setSessionCode = useGameStore((s) => s.setSessionCode);
  const [open, setOpen] = useState(true);
  const [viewers, setViewers] = useState(0);
  const creatingRef = useRef(false);
  const tokenRef = useRef(null);
  if (!tokenRef.current) tokenRef.current = randomToken();

  const active = !OFFLINE && !mirror && connectionMode === 'online' && phase === 'game';

  // Crée la session à l'entrée en partie online (une seule fois).
  useEffect(() => {
    if (!active || code || creatingRef.current) return;
    creatingRef.current = true;
    createSession(serializeSnapshot(useGameStore.getState()))
      .then((c) => setSessionCode(c))
      .catch(() => { creatingRef.current = false; });
  }, [active, code, setSessionCode]);

  // Publie l'instantané à chaque changement d'état (throttle 300 ms) + heartbeat.
  // `publishedAt` = horloge de l'hôte (les spectateurs détectent une liaison morte).
  useEffect(() => {
    if (!active || !code) return;
    let timer = null;
    const publish = () => {
      publishSession(code, { ...serializeSnapshot(useGameStore.getState()), publishedAt: Date.now() }).catch(() => {});
    };
    const schedule = () => { if (!timer) timer = setTimeout(() => { timer = null; publish(); }, 300); };
    const unsub = useGameStore.subscribe(schedule);
    publish(); // publication initiale
    const hb = setInterval(publish, 15000);
    return () => { unsub(); if (timer) clearTimeout(timer); clearInterval(hb); };
  }, [active, code]);

  // Présence : annonce l'hôte et compte les spectateurs connectés.
  useEffect(() => {
    if (!active || !code) return;
    const leave = subscribePresence(code, { role: 'host', token: tokenRef.current }, (list) => {
      setViewers(list.filter((p) => p.role === 'spectator').length);
    });
    return leave;
  }, [active, code]);

  if (!active || !code || !open) return null;
  const url = onlineUrl(code);
  return (
    <div style={{
      position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 999,
      background: 'rgba(10,14,18,0.92)', border: '1px solid #16351f', color: '#bfeccb',
      fontFamily: 'var(--font-ui)', fontSize: 13, boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
    }}>
      <span style={{ color: '#66ff8a' }}>🌐 EN LIGNE</span>
      <span>Code <b style={{ letterSpacing: 2, color: '#fff' }}>{code}</b></span>
      <span title="Spectateurs connectés" style={{ color: '#bfeccb' }}>👁️ {viewers}</span>
      <button
        onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); }}
        style={{ cursor: 'pointer', background: '#16351f', color: '#bfeccb', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 12 }}
        title={url}
      >
        📋 Copier le lien
      </button>
      <button
        onClick={() => setOpen(false)}
        style={{ cursor: 'pointer', background: 'transparent', color: '#8b9096', border: 'none', fontSize: 14 }}
        title="Masquer"
      >✕</button>
    </div>
  );
}
