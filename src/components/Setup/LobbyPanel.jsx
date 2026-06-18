// Lobby (côté TBI) — mode « par téléphone ». Ouvre une session, affiche le QR +
// code, liste les équipes qui arrivent en direct (Realtime), permet d'en retirer,
// puis démarre la partie (les index token↔équipe sont écrits pour que chaque
// téléphone retrouve la sienne).
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import {
  createSession, buildSessionPayload, joinUrl,
  fetchLobbyTeams, subscribeLobby, removeLobbyTeam, assignLobbyIndices,
} from '../../logic/sessionConfig';

export default function LobbyPanel() {
  const sessionCode = useGameStore((s) => s.sessionCode);
  const setSessionCode = useGameStore((s) => s.setSessionCode);
  const lobbyTeams = useGameStore((s) => s.lobbyTeams);
  const setLobbyTeams = useGameStore((s) => s.setLobbyTeams);
  const startFromLobby = useGameStore((s) => s.startFromLobby);
  const extensions = useGameStore((s) => s.extensions);
  const lv2Mode = useGameStore((s) => s.lv2Mode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Abonnement temps réel au lobby tant qu'un code existe.
  useEffect(() => {
    if (!sessionCode) return;
    let alive = true;
    const refresh = () => fetchLobbyTeams(sessionCode).then((rows) => { if (alive) setLobbyTeams(rows); }).catch(() => {});
    refresh();
    const unsub = subscribeLobby(sessionCode, refresh);
    return () => { alive = false; unsub(); };
  }, [sessionCode, setLobbyTeams]);

  const openLobby = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const payload = buildSessionPayload({ teams: [], currentTeam: 0, status: 'lobby', shopStock: [], log: [], extensions, lv2Mode });
      setSessionCode(await createSession(payload));
    } catch (e) { setErr(e.message || 'Connexion impossible'); }
    setBusy(false);
  };

  const teamsLive = (lobbyTeams || []).filter((r) => !r.removed);
  const nameCounts = {};
  teamsLive.forEach((r) => { const n = (r.name || '').trim().toLowerCase(); if (n) nameCounts[n] = (nameCounts[n] || 0) + 1; });

  const start = async () => {
    if (!teamsLive.length) return;
    const byToken = {};
    teamsLive.forEach((r, i) => { byToken[r.token] = i; });
    try { await assignLobbyIndices(sessionCode, byToken); } catch { /* best effort */ }
    startFromLobby();
  };

  if (!sessionCode) {
    return (
      <div>
        <div className="field-label" style={{ marginBottom: 8 }}>📱 Lobby téléphone</div>
        <p style={{ fontSize: 12, color: 'var(--ink-500)', margin: '0 0 10px', lineHeight: 1.4 }}>
          Ouvre un lobby : les élèves scannent le QR et créent leur équipe (nom + logo + pouvoir).
        </p>
        <button className="btn btn--green" onClick={openLobby} disabled={busy}>{busy ? '…' : 'Ouvrir le lobby'}</button>
        {err && <div style={{ fontSize: 11, color: '#b5341f', marginTop: 6 }}>{err}</div>}
      </div>
    );
  }

  const url = joinUrl(sessionCode);
  return (
    <div>
      <div className="field-label" style={{ marginBottom: 8 }}>
        📱 Lobby téléphone — {teamsLive.length} équipe{teamsLive.length > 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: 10, background: '#fff', borderRadius: 14, boxShadow: 'inset 0 0 0 1px rgba(122,94,58,0.2)' }}>
            <QRCodeSVG value={url} size={150} level="M" />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, letterSpacing: '0.25em', textIndent: '0.25em', color: 'var(--ink-900)', marginTop: 8 }}>{sessionCode}</div>
          <div style={{ fontSize: 10, color: 'var(--ink-500)', wordBreak: 'break-all', maxWidth: 170 }}>{url}</div>
        </div>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {teamsLive.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-500)', fontStyle: 'italic' }}>En attente des équipes…</div>
          ) : teamsLive.map((r) => {
            const dup = nameCounts[(r.name || '').trim().toLowerCase()] > 1;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 10, border: `1px solid ${r.color || 'rgba(122,94,58,0.25)'}`, background: '#fffefb' }}>
                <span style={{ fontSize: 20 }}>{r.emoji || '🦁'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 14, color: r.color || 'var(--ink-800)' }}>
                    {r.name || '(sans nom)'} {dup && <span title="Nom en double (sera suffixé au départ)" style={{ color: '#c9472f' }}>⚠</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-500)' }}>
                    {r.ready ? '✅ prêt' : '… en cours'}
                    {r.power_def ? ` · 🛡️ ${POWERS[r.power_def]?.name || r.power_def}` : ''}
                    {r.power_off ? ` · ⚔️ ${POWERS[r.power_off]?.name || r.power_off}` : ''}
                  </span>
                </span>
                <button className="btn btn--ghost btn--sm" onClick={() => removeLobbyTeam(r.id)} title="Retirer cette équipe">✕</button>
              </div>
            );
          })}
        </div>
      </div>
      <button className="btn btn--green btn--lg" style={{ width: '100%', marginTop: 12 }} onClick={start} disabled={!teamsLive.length}>
        🚀 Démarrer la partie ({teamsLive.length})
      </button>
    </div>
  );
}
