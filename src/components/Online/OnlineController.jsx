// Manette « jeu en ligne » côté joueur distant. Le client online mire le plateau
// (spectateur) ; ce composant lui donne en plus une ÉQUIPE à posséder et, pendant
// son tour, la manette (ControllerView) qui envoie les intents `turn*` à l'hôte.
// Réutilise intégralement le moteur manette existant (aucune logique de jeu ici).
import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { sendIntent, randomToken, fetchTrades, subscribeTrades } from '../../logic/sessionConfig';
import { extOn } from '../../extensions/registry';
import ControllerView from '../Mobile/ControllerView';
import OnlineTeamPanel from './OnlineTeamPanel';
import DuelRaceView from './DuelRaceView';
import { useT } from '../../i18n';

const tokenKey = (code) => `quete_online_token_${code}`;

// Jeton local persistant : identifie ce joueur (possession d'équipe) à travers
// les reloads, sans compte (même principe que le token du lobby téléphone).
function loadToken(code) {
  try {
    const ex = localStorage.getItem(tokenKey(code));
    if (ex) return ex;
    const t = randomToken();
    localStorage.setItem(tokenKey(code), t);
    return t;
  } catch { return randomToken(); }
}

export default function OnlineController({ code, ctrl, lastSync = 0 }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const [token] = useState(() => loadToken(code));
  const [panelOpen, setPanelOpen] = useState(false);
  const [trades, setTrades] = useState([]);

  const ownedIdx = (teams || []).findIndex((t) => t && t.token === token);

  // Offres de troc de la session (onglet Troc + badge d'alerte).
  useEffect(() => {
    if (!code) return;
    let alive = true;
    const refresh = () => fetchTrades(code).then((r) => { if (alive) setTrades(r); }).catch(() => {});
    refresh();
    const unsub = subscribeTrades(code, refresh);
    return () => { alive = false; unsub(); };
  }, [code]);

  const owned = ownedIdx >= 0;
  const hasTrade = owned && extOn(ctrl?.extensions, 'trade');
  const hasDiplo = owned && extOn(ctrl?.extensions, 'diplomacy');
  const tradeAlert = trades.filter((t) => t.to_idx === ownedIdx && t.status === 'pending').length;

  // Pas d'équipe possédée (n'a pas rejoint le lobby) → simple spectateur.
  if (ownedIdx < 0) return null;

  // Duel éclair : si je suis un duelliste (attaquant OU défenseur), la vue de duel
  // prend le dessus — même pour le défenseur, dont ce n'est pas le tour.
  const fight = ctrl?.turn?.fight;
  if (fight && (ownedIdx === fight.attackerIndex || ownedIdx === fight.defenderIndex)) {
    return (
      <DuelRaceView
        fight={fight} teams={ctrl.teams} myTeamIdx={ownedIdx}
        onBegin={() => sendIntent(code, token, 'turnFightBegin', {}).catch(() => {})}
        onAnswer={(i) => sendIntent(code, token, 'turnFightAnswer', { index: i }).catch(() => {})}
        onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
        onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
      />
    );
  }

  // C'est mon tour → manette plein écran (le reste passe au second plan).
  const myTurn = !!(ctrl && ctrl.controller && ctrl.turn && ctrl.turn.team === ownedIdx);
  if (myTurn) {
    return <ControllerView session={ctrl} teamIdx={ownedIdx} code={code} token={token} T={T} lastSync={lastSync} />;
  }

  // Hors de mon tour : je spectate le plateau et peux gérer mon équipe
  // (équipement / boutique / pouvoirs) via un panneau, comme au tour adverse.
  return (
    <>
      {ctrl && !panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          style={{
            position: 'fixed', bottom: 16, right: 16, zIndex: 320, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 999,
            background: 'linear-gradient(#8effb0, #2fb551)', color: '#06210f', fontWeight: 700,
            border: '2px solid #05070a', boxShadow: '0 6px 16px rgba(0,0,0,0.4)', fontFamily: 'var(--font-ui)',
          }}
        >
          🎽 Mon équipe
          {tradeAlert > 0 && (
            <span style={{ background: '#c9472f', color: '#fff', borderRadius: 999, padding: '0 7px', fontSize: 12 }}>{tradeAlert}</span>
          )}
        </button>
      )}
      {ctrl && panelOpen && (
        <OnlineTeamPanel
          code={code} token={token} ctrl={ctrl} ownedIdx={ownedIdx}
          trades={trades} hasTrade={hasTrade} hasDiplo={hasDiplo} tradeAlert={tradeAlert}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </>
  );
}
