// Client « jeu en ligne » (ouvert via ?online=CODE). Deux temps :
//  1) LOBBY (partie pas lancée) : le joueur crée SON équipe (nom + logo + pouvoirs)
//     et se met « prêt » — réutilise l'écran du lobby téléphone.
//  2) JEU : une fois l'hôte lancé, hydrate le plateau depuis l'instantané diffusé
//     et rend l'app complète ; le joueur possède son équipe (via son jeton) et
//     joue son tour / gère son équipe depuis son écran.
import { useEffect, useState } from 'react';
import App from '../../App';
import { useGameStore } from '../../store/gameStore';
import { fetchSession, subscribeSession, subscribePresence, onlineToken } from '../../logic/sessionConfig';
import { hydrateSnapshot } from '../../logic/onlineSnapshot';
import { bindMirrorTurnActions } from '../../logic/onlineMirror';
import OnlineController from './OnlineController';
import OnlineLobby from './OnlineLobby';

// Jeton local persistant (identité du joueur → possession de son équipe) :
// helper partagé onlineToken (même clé que OnlineController / OnlineLobby).

function Splash({ code, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0b0e12', color: '#bfeccb', fontFamily: 'var(--font-ui)', textAlign: 'center', padding: 20 }}>
      <div>
        <div style={{ fontSize: 26, color: '#66ff8a', marginBottom: 8 }}>🌐 Jeu en ligne</div>
        <div>{children} <b style={{ letterSpacing: 2 }}>{code || '—'}</b></div>
      </div>
    </div>
  );
}

export default function OnlineClient({ code }) {
  const [data, setData] = useState(undefined); // undefined = pas encore ; null = introuvable ; objet = session
  const [started, setStarted] = useState(false);
  const [ctrl, setCtrl] = useState(null);
  const [lastSync, setLastSync] = useState(0);
  const [hostOnline, setHostOnline] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [token] = useState(() => onlineToken(code));

  useEffect(() => {
    if (!code) return;
    let alive = true;
    const apply = (d) => {
      if (!alive) return;
      setData(d ?? null);
      const isGame = !!(d && d.v && d.phase === 'game'); // instantané de jeu (vs payload lobby)
      // Transition lobby → jeu IRRÉVERSIBLE : une fois lancé, un éventuel message
      // non-jeu (heartbeat lobby résiduel) ne doit pas renvoyer au lobby.
      if (isGame) { const slice = hydrateSnapshot(d); if (slice) useGameStore.setState(slice); setStarted(true); }
      setCtrl(d?.ctrl ?? null);
      setLastSync(Date.now());
    };
    fetchSession(code).then((d) => apply(d)).catch(() => { if (alive) setData(null); });
    const unsub = subscribeSession(code, apply);
    return () => { alive = false; unsub(); };
  }, [code]);

  // Partie lancée : cette fenêtre appartient à MON équipe (jeton) et les
  // actions de tour du store deviennent des émetteurs d'intents (le clic sur
  // une modale du plateau pilote le tour à distance — l'hôte reste l'autorité).
  useEffect(() => {
    if (!started) return;
    useGameStore.getState().setOnlineIdentity(token, code);
    bindMirrorTurnActions(code, token);
  }, [started, code, token]);

  // Présence : l'hôte est-il là ? combien de joueurs/spectateurs ?
  useEffect(() => {
    if (!code) return;
    return subscribePresence(code, { role: 'spectator', token }, (list) => {
      setHostOnline(list.some((p) => p.role === 'host'));
      setViewers(list.filter((p) => p.role === 'spectator').length);
    });
  }, [code, token]);

  // Session CLOSE par l'hôte (⏹ Quitter) : fini pour tout le monde — on
  // n'entre ni au lobby ni dans le jeu fantôme (prioritaire, même « started »).
  if (data?.status === 'ended') {
    return <Splash code={code}>L'hôte a mis fin à cette partie. Demande-lui un nouveau lien ! Code :</Splash>;
  }

  // --- Phase LOBBY (partie pas encore lancée) : créer son équipe ---
  if (!started) {
    if (data === undefined) return <Splash code={code}>Connexion à la partie</Splash>;
    if (data === null) return <Splash code={code}>Partie introuvable — vérifie le code (l’hôte doit avoir ouvert le lobby) :</Splash>;
    // Même écran lobby que l'hôte (variante client : pas de bouton thèmes /
    // lancer / retrait), avec MA création d'équipe intégrée.
    return <OnlineLobby client code={code} token={token} lv2Mode={!!data.lv2Mode} englishMode={!!data.englishMode} />;
  }

  // --- Phase JEU : plateau en direct + ma manette / gestion d'équipe ---
  return (
    <>
      <App />
      <OnlineController code={code} ctrl={ctrl} lastSync={lastSync} />
      <div style={{
        position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 300,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '4px 12px', borderRadius: 999, background: 'rgba(10,14,18,0.9)',
        border: '1px solid #16351f', fontFamily: 'var(--font-ui)', fontSize: 12,
      }}>
        <span style={{ color: hostOnline ? '#66ff8a' : '#ff8a7a' }}>{hostOnline ? '🟢 EN DIRECT' : '🔴 Hôte hors ligne'}</span>
        <span style={{ color: '#8b9096' }}>{code}</span>
        {viewers > 1 && <span style={{ color: '#bfeccb' }}>· {viewers} 👁️</span>}
      </div>
    </>
  );
}
