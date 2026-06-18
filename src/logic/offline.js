// Indicateur de build « hors ligne » (cible classe : un seul écran TBI, sans
// réseau ni téléphone). Activé par `vite build --mode offline`, qui charge
// .env.offline (VITE_OFFLINE=1).
//
// En build normal (en ligne), la variable est absente → OFFLINE = false, et tout
// le code gardé par ce flag est éliminé au tree-shaking : le bundle en ligne est
// strictement inchangé. NE JAMAIS faire dépendre de logique métier de ce flag —
// uniquement le câblage réseau/UI (volet téléphone, éditeurs, chargement données).
export const OFFLINE = import.meta.env.VITE_OFFLINE === '1';
