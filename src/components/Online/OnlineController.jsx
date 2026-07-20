// Couche « joueur » du client online. Depuis la refonte UX souris, le tour se
// joue DIRECTEMENT sur le plateau (modales interactives + intents via
// onlineMirror, gating par onlineSelf) et la gestion d'équipe vit dans le dock
// privé (OnlinePrivateDock). Il ne reste ici que le DUEL ÉCLAIR : une course
// à deux qui déborde du modèle « équipe active » (le défenseur joue aussi),
// rendue par un overlay dédié — DuelRaceView.
import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { sendIntent, onlineToken } from '../../logic/sessionConfig';
import DuelRaceView from './DuelRaceView';
import CurioPlaceView from '../Fight/CurioPlaceView';
import ChessDuelView from '../Fight/ChessDuelView';
import HackDuelView from '../Fight/HackDuelView';

// `host` : monté dans la FENÊTRE DE L'HÔTE (qui est un joueur comme les autres).
// La vue de duel y est sautée : FightModal (plein écran hôte) la rend déjà via
// HostDuelRace.
export default function OnlineController({ code, ctrl, host = false }) {
  const teams = useGameStore((s) => s.teams);
  // MÊME résolution de jeton qu'OnlineClient : un lien de test (?token=…&claim=…)
  // a réclamé l'équipe avec le jeton d'URL — lire seulement onlineToken(code)
  // donnerait ownedIdx = -1 (spectateur) et casserait le testeur online.
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || onlineToken(code));

  const ownedIdx = (teams || []).findIndex((t) => t && t.token === token);
  if (ownedIdx < 0) return null; // spectateur pur

  // Duel éclair : si je suis un duelliste (attaquant OU défenseur), la vue de
  // duel prend le dessus — même pour le défenseur, dont ce n'est pas le tour.
  const fight = ctrl?.turn?.fight;
  if (!fight || host) return null;
  if (ownedIdx !== fight.attackerIndex && ownedIdx !== fight.defenderIndex) return null;
  // Duel Curioscope (guessr) : je place mon pin sur MA carte — la cible et le
  // pin adverse n'arrivent qu'à la révélation (payload strippé par l'hôte).
  if (fight.curio && fight.phase === 'minigame') {
    return (
      <CurioPlaceView
        fight={fight}
        teams={ctrl.teams}
        mySide={ownedIdx === fight.attackerIndex ? 'attacker' : 'defender'}
        onValidate={(pos) => sendIntent(code, token, 'turnCurioValidate', { x: pos.x, y: pos.y }).catch(() => {})}
        onNext={() => sendIntent(code, token, 'turnCurioNext', {}).catch(() => {})}
      />
    );
  }
  // Duel d'échecs : mon échiquier interactif (mate-in-N). L'hôte arbitre chaque
  // coup ; reward/result gérés par la vue elle-même (comme memory/pkmn).
  if (fight.chess && ['minigame', 'reward', 'result'].includes(fight.phase)) {
    return (
      <ChessDuelView
        fight={fight}
        teams={ctrl.teams}
        myTeamIdx={ownedIdx}
        onMove={(mv) => sendIntent(code, token, 'turnChessMove', { from: mv.from, to: mv.to, promotion: mv.promotion }).catch(() => {})}
        onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
        onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
      />
    );
  }
  // Cyber-duel (hacking) : choix du langage puis remplissage des trous. L'hôte
  // arbitre chaque token ; reward/result gérés par la vue (comme chess/memory).
  if (fight.hack && ['minigame', 'reward', 'result'].includes(fight.phase)) {
    return (
      <HackDuelView
        fight={fight}
        teams={ctrl.teams}
        myTeamIdx={ownedIdx}
        onPickLang={(lang) => sendIntent(code, token, 'turnHackLang', { lang }).catch(() => {})}
        onPick={(tok) => sendIntent(code, token, 'turnHackPick', { token: tok }).catch(() => {})}
        onReward={(c) => sendIntent(code, token, 'turnFightReward', { choice: c }).catch(() => {})}
        onClose={() => sendIntent(code, token, 'turnFightClose', {}).catch(() => {})}
      />
    );
  }
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
