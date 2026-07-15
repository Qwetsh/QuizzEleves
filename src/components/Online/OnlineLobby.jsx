// ============================================================
//  LOBBY « JEU EN LIGNE » — écran dédié plein écran, pour l'HÔTE
//  (phase 'onlineLobby') ET les joueurs distants (OnlineClient,
//  prop `client`). Fini l'onglet séparé : l'hôte crée SON équipe
//  ici, comme tout le monde.
//
//  Hôte : session ouverte AUTOMATIQUEMENT au montage, code + lien
//  copiables, liste des joueurs en direct, bouton THÈMES (console
//  cassettes en aller-retour, composition persistée dans le store
//  via onlineCompose) et gros LANCER gaté (≥1 voie + tous prêts).
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../../store/gameStore';
import {
  createSession, buildSessionPayload, onlineJoinUrl, onlineToken,
  fetchLobbyTeams, subscribeLobby, removeLobbyTeam, assignLobbyIndices,
  writeLobbyResume, clearLobbyResume, subscribePresence,
} from '../../logic/sessionConfig';
import { LobbyCreateScreen } from '../Mobile/MobileApp';
import TeamAvatar from '../TeamAvatar';
import '../../styles/online-lobby.css';

// Lien copiable au clic (feedback ✓), même comportement que le lobby téléphone.
function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { return; }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" className={`olb-link ${copied ? 'is-copied' : ''}`} onClick={copy} title="Cliquer pour copier le lien">
      {copied ? '✓ LIEN COPIÉ ! Donne-le aux joueurs.' : <>{url} <span aria-hidden="true">📋</span></>}
    </button>
  );
}

export default function OnlineLobby({ client = false, code: codeProp, token: tokenProp, lv2Mode: lv2Prop, englishMode: enProp }) {
  const sessionCode = useGameStore((s) => s.sessionCode);
  const setSessionCode = useGameStore((s) => s.setSessionCode);
  const setLobbyTeams = useGameStore((s) => s.setLobbyTeams);
  const startOnlineGame = useGameStore((s) => s.startOnlineGame);
  const openConsole = useGameStore((s) => s.openConsole);
  const setPhase = useGameStore((s) => s.setPhase);
  const extensions = useGameStore((s) => s.extensions);
  const lv2ModeStore = useGameStore((s) => s.lv2Mode);
  const englishModeStore = useGameStore((s) => s.englishMode);
  const onlineCompose = useGameStore((s) => s.onlineCompose);
  const perimeter = onlineCompose.perimeter;

  const code = client ? codeProp : sessionCode;
  const lv2Mode = client ? !!lv2Prop : !!lv2ModeStore;
  const englishMode = client ? !!enProp : !!englishModeStore;
  const [rows, setRows] = useState([]);
  const [rowsLoaded, setRowsLoaded] = useState(false); // 1er fetch fini (pré-remplissage fiable)
  const [hostOnline, setHostOnline] = useState(true); // présence (badge côté client)
  const [err, setErr] = useState(null);
  const [launching, setLaunching] = useState(false);
  // Jeton du joueur local (l'hôte est un joueur comme les autres). Dérivé du
  // code : côté hôte, la session s'ouvre APRÈS le montage (async).
  const token = useMemo(() => tokenProp || (code ? onlineToken(code) : null), [tokenProp, code]);

  // Hôte : ouvre la session AUTOMATIQUEMENT si aucune n'existe encore.
  useEffect(() => {
    if (client || sessionCode) return;
    let alive = true;
    const payload = buildSessionPayload({ teams: [], currentTeam: 0, status: 'lobby', shopStock: [], log: [], extensions, lv2Mode: lv2ModeStore });
    createSession(payload)
      .then((c) => { if (alive) setSessionCode(c); })
      .catch((e) => { if (alive) setErr(e.message || 'Connexion impossible'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, sessionCode]);

  // Hôte : mémorise { code, compose } pour reprendre le lobby après un reload
  // (l'état lobby n'est pas dans la sauvegarde de partie).
  useEffect(() => {
    if (client || !sessionCode) return;
    writeLobbyResume({ code: sessionCode, compose: onlineCompose });
  }, [client, sessionCode, onlineCompose]);

  // Présence : l'hôte s'annonce dès le LOBBY ; les clients savent s'il est là
  // (un lobby sans hôte ne pourra pas lancer — autant le dire).
  useEffect(() => {
    if (!code || !token) return;
    return subscribePresence(code, { role: client ? 'spectator' : 'host', token }, (list) => {
      setHostOnline(list.some((p) => p.role === 'host'));
    });
  }, [code, client, token]);

  // Équipes du lobby en direct (état local + store côté hôte : startOnlineGame
  // lit get().lobbyTeams).
  useEffect(() => {
    if (!code) return;
    let alive = true;
    const refresh = () => fetchLobbyTeams(code).then((r) => {
      if (!alive) return;
      setRows(r);
      setRowsLoaded(true);
      if (!client) setLobbyTeams(r);
    }).catch(() => {});
    refresh();
    const unsub = subscribeLobby(code, refresh);
    return () => { alive = false; unsub(); };
  }, [code, client, setLobbyTeams]);

  const teamsLive = (rows || []).filter((r) => !r.removed);
  const allReady = teamsLive.length > 0 && teamsLive.every((r) => r.ready);
  const nbVoies = perimeter?.boardSubjects?.length || 0;
  const canLaunch = !client && nbVoies > 0 && allReady && !launching;

  const launch = async () => {
    if (!canLaunch) return;
    setLaunching(true);
    const byToken = {};
    teamsLive.forEach((r, i) => { byToken[r.token] = i; });
    try { await assignLobbyIndices(code, byToken); } catch { /* best effort */ }
    if (startOnlineGame(perimeter)) clearLobbyResume(); // la partie a SA save
    else setLaunching(false);
  };

  // Ce qui manque encore pour lancer (affiché sous le bouton, côté hôte).
  const missing = client ? null
    : nbVoies === 0 ? 'Insère au moins un thème (bouton 📼 THÈMES).'
    : teamsLive.length === 0 ? 'En attente d’au moins une équipe…'
    : !allReady ? 'En attente que toutes les équipes soient prêtes…'
    : null;

  const url = code ? onlineJoinUrl(code) : null;

  return (
    <div className="olb-root">
      <div className="olb-wrap">
        {/* ---- Bandeau : code + lien + QR ---- */}
        <div className="olb-head">
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: 2, color: '#8a7656', marginBottom: 4 }}>
              🌐 PARTIE EN LIGNE — CODE
            </div>
            <div className="olb-led">
              {(code || '····').split('').map((ch, i) => <span key={i}>{ch}</span>)}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, letterSpacing: 2, color: '#8a7656' }}>
              LIEN À PARTAGER (clic = copier)
            </div>
            {url ? <CopyLink url={url} /> : <div className="olb-waiting">Ouverture de la session</div>}
            {err && <div style={{ color: '#e88f8f', fontSize: 13 }}>⚠ {err}</div>}
          </div>
          {url && (
            <div style={{ background: '#fff', padding: 6, borderRadius: 8, lineHeight: 0 }}>
              <QRCodeSVG value={url} size={86} level="M" />
            </div>
          )}
          {!client && (
            <button type="button" className="olb-btn" style={{ alignSelf: 'flex-start', padding: '8px 14px', fontSize: 13 }}
              onClick={() => { clearLobbyResume(); setPhase('home'); }}>⌂ ACCUEIL</button>
          )}
        </div>

        {/* ---- Colonnes : mon équipe / joueurs connectés ---- */}
        <div className="olb-cols">
          <div className="olb-card">
            <div className="olb-card-title">🎽 MON ÉQUIPE</div>
            <div className="olb-myteam">
              {/* Monté après le 1er fetch : si MON équipe existe déjà (retour de
                  la console, reload), le formulaire est PRÉ-REMPLI et repart de
                  l'écran « prêt ✓ » — pas de fausse re-création. */}
              {code && token && rowsLoaded
                ? <LobbyCreateScreen code={code} token={token} lv2Mode={lv2Mode} englishMode={englishMode}
                    initial={teamsLive.find((r) => r.token === token) || null} />
                : <div className="olb-waiting" style={{ paddingTop: 40 }}>Ouverture de la session</div>}
            </div>
          </div>

          <div className="olb-card">
            <div className="olb-card-title">
              👥 JOUEURS
              <span style={{ color: '#9be88f' }}>({teamsLive.length})</span>
              <span style={{ marginLeft: 'auto', fontSize: 14, color: allReady && teamsLive.length ? '#9be88f' : '#8a7656' }}>
                {teamsLive.length ? (allReady ? 'TOUS PRÊTS ✓' : 'PRÉPARATION…') : ''}
              </span>
            </div>
            <div className="olb-players">
              {teamsLive.length === 0 && <div className="olb-waiting">En attente des joueurs — partage le lien ou le code</div>}
              {teamsLive.map((r) => (
                <div key={r.id ?? r.token} className="olb-player">
                  <TeamAvatar team={{ ...r, emoji: r.emoji || '🦁' }} size={26} />
                  <span className="olb-player-name" style={{ color: r.color || '#f4e7cc' }}>
                    {r.name || 'Sans nom'}
                    {r.token === token && <span style={{ color: '#e8a13a', fontWeight: 400 }}> (moi)</span>}
                  </span>
                  <span className="olb-player-status" style={{ color: r.ready ? '#9be88f' : '#e8a13a' }}>
                    {r.ready ? '✓ PRÊT' : '… EN COURS'}
                  </span>
                  {!client && r.token !== token && (
                    <button type="button" className="olb-player-x" title="Retirer cette équipe"
                      onClick={() => removeLobbyTeam(r.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Actions (hôte) / statut (client) ---- */}
        {client ? (
          <div className="olb-hint" style={hostOnline ? undefined : { color: '#e88f8f' }}>
            {hostOnline
              ? 'EN ATTENTE DU LANCEMENT PAR L\'HÔTE — la partie démarrera ici automatiquement'
              : '🔴 HÔTE DÉCONNECTÉ — en attente de son retour…'}
          </div>
        ) : (
          <>
            <div className="olb-actions">
              <button type="button" className="olb-btn" onClick={() => openConsole('play')}>
                📼 THÈMES DE LA PARTIE
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: nbVoies ? '#9be88f' : '#e8a13a' }}>
                  {nbVoies ? `${nbVoies} VOIE${nbVoies > 1 ? 'S' : ''} ✓` : 'AUCUNE VOIE'}
                </span>
              </button>
              <button type="button" className="olb-btn olb-btn--launch" disabled={!canLaunch} onClick={launch}>
                ▶ LANCER LA PARTIE
              </button>
            </div>
            {missing && <div className="olb-hint">{missing}</div>}
          </>
        )}
      </div>
    </div>
  );
}
