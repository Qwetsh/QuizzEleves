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

// `host` : monté dans la FENÊTRE DE L'HÔTE (qui est un joueur comme les autres).
// La vue de duel y est sautée : FightModal (plein écran hôte) la rend déjà via
// HostDuelRace.
export default function OnlineController({ code, ctrl, host = false }) {
  const teams = useGameStore((s) => s.teams);
  const [token] = useState(() => onlineToken(code));

  const ownedIdx = (teams || []).findIndex((t) => t && t.token === token);
  if (ownedIdx < 0) return null; // spectateur pur

  // Duel éclair : si je suis un duelliste (attaquant OU défenseur), la vue de
  // duel prend le dessus — même pour le défenseur, dont ce n'est pas le tour.
  const fight = ctrl?.turn?.fight;
  if (!fight || host) return null;
  if (ownedIdx !== fight.attackerIndex && ownedIdx !== fight.defenderIndex) return null;
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
