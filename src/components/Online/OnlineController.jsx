// Manette « jeu en ligne » côté joueur distant. Le client online mire le plateau
// (spectateur) ; ce composant lui donne en plus une ÉQUIPE à posséder et, pendant
// son tour, la manette (ControllerView) qui envoie les intents `turn*` à l'hôte.
// Réutilise intégralement le moteur manette existant (aucune logique de jeu ici).
import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { sendIntent, onlineToken, fetchTrades, subscribeTrades } from '../../logic/sessionConfig';
import { extOn } from '../../extensions/registry';
import ControllerView from '../Mobile/ControllerView';
import OnlineTeamPanel from './OnlineTeamPanel';
import DuelRaceView from './DuelRaceView';
import { useT } from '../../i18n';
import '../../styles/online-game.css';

// `host` : monté dans la FENÊTRE DE L'HÔTE (qui est un joueur comme les autres
// depuis le lobby dédié). Même manette, mêmes intents — seule la vue de DUEL
// est sautée : FightModal (plein écran hôte) la rend déjà via HostDuelRace.
export default function OnlineController({ code, ctrl, lastSync = 0, host = false }) {
  const T = useT();
  const teams = useGameStore((s) => s.teams);
  const [token] = useState(() => onlineToken(code));
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
  // Côté hôte : FightModal rend déjà le duel (HostDuelRace, jouable) → on skippe.
  const fight = ctrl?.turn?.fight;
  if (fight && host) return null;
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

  // Mon tour → contrôles : plein écran au téléphone, COLONNE latérale sur
  // grand écran (.olc-turnside via online-game.css) — le plateau reste visible.
  const myTurn = !!(ctrl && ctrl.controller && ctrl.turn && ctrl.turn.team === ownedIdx);

  // Le dock « MON ÉQUIPE » (boutique / inventaire / pouvoirs / troc PRIVÉS)
  // est disponible EN PERMANENCE — pendant mon tour aussi : chacun a son
  // écran, acheter ou réorganiser son sac ne dérange personne.
  return (
    <>
      {myTurn && (
        <div className="olc-turnside">
          <ControllerView online session={ctrl} teamIdx={ownedIdx} code={code} token={token} T={T} lastSync={lastSync} />
        </div>
      )}
      {ctrl && !panelOpen && (
        <button className={`olc-myteam-btn ${myTurn ? 'olc-myteam-btn--beside' : ''}`} onClick={() => setPanelOpen(true)}>
          🎽 MON ÉQUIPE
          {tradeAlert > 0 && <span className="olc-myteam-badge">{tradeAlert}</span>}
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
