// Identité du joueur local en mode « jeu en ligne ».
//
// En ligne, chaque fenêtre (hôte-joueur compris) appartient à UN joueur : son
// jeton local (`_onlineToken`, posé par OnlineClient / OnlineHost) désigne SON
// équipe. Ces sélecteurs permettent aux surfaces du plateau (modales, dé,
// pouvoirs…) d'être interactives UNIQUEMENT pour le joueur concerné — c'est le
// remplaçant du blanket `pointerEvents:none` (plateau inerte) : le jeu se joue
// directement à l'écran, à la souris.
//
// Hors ligne (TBI classe / téléphone-manette), tout reste piloté au tableau :
// `canDriveTurn` vaut true et rien ne change.

/** Mode « jeu en ligne » actif dans cette fenêtre ? */
export const isOnlineMode = (s) => s.connectionMode === 'online';

/** Index de MON équipe (via jeton), ou -1 (spectateur pur / hors ligne). */
export const onlineSelfIdx = (s) => {
  if (!isOnlineMode(s) || !s._onlineToken) return -1;
  return (s.teams || []).findIndex((t) => t && t.token === s._onlineToken);
};

/** En ligne : est-ce le tour de MON équipe ? */
export const isMyOnlineTurn = (s) => {
  const i = onlineSelfIdx(s);
  return i >= 0 && i === s.currentTeam;
};

/**
 * Cette fenêtre peut-elle piloter le TOUR courant (dé, question, événement…) ?
 * — hors ligne : oui (le TBI pilote tout, comportement historique) ;
 * — en ligne : uniquement si l'équipe active est la mienne.
 */
export const canDriveTurn = (s) => (isOnlineMode(s) ? isMyOnlineTurn(s) : true);
