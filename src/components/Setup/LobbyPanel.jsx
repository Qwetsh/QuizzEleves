// Lobby (côté TBI) — mode « par téléphone ». Ouvre une session, affiche le QR +
// code, liste les équipes qui arrivent en direct (Realtime), permet d'en retirer,
// puis démarre la partie (les index token↔équipe sont écrits pour que chaque
// téléphone retrouve la sienne).
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../../store/gameStore';
import { POWERS } from '../../data/powers';
import TeamAvatar from '../TeamAvatar';
import { locName } from '../../i18n/content';
import {
  createSession, buildSessionPayload, joinUrl, onlineJoinUrl,
  fetchLobbyTeams, subscribeLobby, removeLobbyTeam, assignLobbyIndices,
} from '../../logic/sessionConfig';
import { useT } from '../../i18n';
import '@fontsource/vt323/400.css';
import '@fontsource/archivo-black/400.css';
import '../../styles/lobby-retro.css';

// Barre de titre commune (fenêtre logicielle « LOBBY.EXE »).
function TitleBar() {
  return (
    <div className="lobby90-titlebar">
      <span className="lobby90-rec" />
      <span className="lobby90-tt">LOBBY.EXE</span>
      <span className="lobby90-winbtns">
        <span className="lobby90-winbtn">_</span>
        <span className="lobby90-winbtn">□</span>
        <span className="lobby90-winbtn">✕</span>
      </span>
    </div>
  );
}

export default function LobbyPanel({ online = false }) {
  const T = useT();
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
    } catch (e) { setErr(e.message || T('setup.lobbyConnFailed')); }
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
      <div className="lobby90">
        <div className="lobby90-win">
          <TitleBar />
          <div className="lobby90-body">
            <div className="lobby90-offline">
              &gt; {T('setup.lobbyIntro')}<br />
              &gt; STATUT : <b>HORS LIGNE</b>_
            </div>
            <div>
              <button className="lobby90-btn" onClick={openLobby} disabled={busy}>{busy ? '…' : `► ${T('setup.lobbyOpen')}`}</button>
            </div>
            {err && <div className="lobby90-err">! {err}</div>}
          </div>
        </div>
      </div>
    );
  }

  const url = online ? onlineJoinUrl(sessionCode) : joinUrl(sessionCode);
  // En ligne : on ne peut lancer que si TOUTES les équipes présentes sont prêtes.
  const allReady = teamsLive.length > 0 && teamsLive.every((r) => r.ready);
  const canStart = teamsLive.length >= 1 && (!online || allReady);
  return (
    <div className="lobby90">
      <div className="lobby90-win">
        <TitleBar />
        <div className="lobby90-body">
          {/* Écran CRT : QR (clair, scannable) + instructions + code à segments */}
          <div className="lobby90-crt">
            <div className="lobby90-qrwrap">
              <span className="lobby90-qrframe">
                <QRCodeSVG value={url} size={150} level="M" />
              </span>
              <div className="lobby90-scanlabel">SCANNE-MOI</div>
            </div>
            <div className="lobby90-crt-side">
              <div className="lobby90-lines">
                &gt; SCANNE LE CODE<br />
                &gt; POUR <b>REJOINDRE</b><br />
                &gt; LA PARTIE
              </div>
              <div>
                <div className="lobby90-codelabel">CODE DE SESSION</div>
                <div className="lobby90-led">
                  {sessionCode.split('').map((ch, i) => <span key={i}>{ch}</span>)}
                </div>
              </div>
              <div className="lobby90-url">{url}</div>
            </div>
          </div>

          {/* Liste terminal des équipes connectées */}
          <div className="lobby90-list">
            <div className="lobby90-list-h">
              CONNECTÉS ─ {teamsLive.length} {T.plural('setup.teamCount', teamsLive.length)}
            </div>
            {teamsLive.length === 0 ? (
              <div className="lobby90-waiting">{T('setup.lobbyWaiting')}</div>
            ) : teamsLive.map((r) => {
              const dup = nameCounts[(r.name || '').trim().toLowerCase()] > 1;
              return (
                <div key={r.id} className="lobby90-row">
                  <TeamAvatar team={{ ...r, emoji: r.emoji || '🦁' }} size={22} className="lobby90-emoji" />
                  <span className="lobby90-name" style={{ color: r.color || '#d9ffe6' }}>
                    {r.name || T('setup.lobbyNoName')} {dup && <span title={T('setup.lobbyDupName')} style={{ color: '#ffb64a' }}>⚠</span>}
                  </span>
                  <span className="lobby90-sub">
                    <span className="lobby90-dot">●</span> {r.ready ? T('setup.lobbyReady') : T('setup.lobbyInProgress')}
                    {r.power_def ? ` · 🛡️ ${locName(POWERS[r.power_def]) || r.power_def}` : ''}
                    {r.power_off ? ` · ⚔️ ${locName(POWERS[r.power_off]) || r.power_off}` : ''}
                  </span>
                  <span className="lobby90-cursor" />
                  <button className="lobby90-x" onClick={() => removeLobbyTeam(r.id)} title={T('setup.lobbyRemoveTeam')}>✕</button>
                </div>
              );
            })}
          </div>

          {online ? (
            <>
              {/* L'hôte joue AUSSI via un client : il ouvre sa propre fenêtre de jeu
                  (l'onglet actuel = l'écran/serveur partagé). Le lancement se fait
                  par le bouton « LANCER » de l'en-tête (thème + tout le monde prêt). */}
              <button className="lobby90-start" onClick={() => window.open(url, '_blank', 'noopener')}>
                🎮 Jouer / créer mon équipe
              </button>
              <div className="lobby90-waiting" style={{ textAlign: 'center' }}>
                Ouvre ta fenêtre de jeu (bouton ci-dessus) pour créer ton équipe. Cet onglet est l’écran partagé.
                Insère un thème puis clique « LANCER » (en haut) quand {allReady ? 'tout le monde est prêt' : 'tous les joueurs sont prêts'}.
              </div>
            </>
          ) : (
            <button className="lobby90-start" onClick={start} disabled={!canStart}>
              ▶▶ {T('setup.lobbyStart', { n: teamsLive.length })}
            </button>
          )}

          {devOn() && (
            <div className="lobby90-sim">
              <div className="lobby90-sim-h">{T('setup.lobbySimTitle')}</div>
              <div className="lobby90-chips">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className="lobby90-chip"
                    onClick={() => window.open(`${online ? onlineJoinUrl(sessionCode) : joinUrl(sessionCode)}&token=test-${sessionCode}-${n}`, `qm-phone-${n}`, 'width=430,height=880')}
                  >
                    {T('setup.lobbySimStudent', { n })}
                  </button>
                ))}
              </div>
              <div className="lobby90-sim-desc">{T('setup.lobbySimDesc')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Visible seulement en localhost OU quand les outils d'édition sont déverrouillés.
function devOn() {
  if (import.meta.env.DEV) return true;
  try { return localStorage.getItem('quete_tools_unlock') === '1'; } catch { return false; }
}
