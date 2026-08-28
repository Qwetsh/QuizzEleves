/**
 * Talon de l'easter egg Nordlys pour le build HORS-LIGNE (classe / Tauri).
 *
 * L'egg est un cadeau de mariage : il se joue en ligne, jamais sur le poste
 * d'une salle. Or ses ressources — drakkar.glb, deux bandes-son, les deux
 * personnages, la jaquette — pèsent ~19 Mo, embarqués dans l'installeur pour
 * rien. `vite.config.js` remplace donc NordlysShelf par ce fichier quand
 * `--mode offline` : ni composant, ni glob d'assets, ni chunk de mini-jeu.
 *
 * Même surface d'export que le vrai module — SelectionCassettes n'a pas à
 * savoir lequel des deux il importe.
 */

export function useNordlysEgg() {
  return { unlocked: false };
}

export function NordlysVoile() {
  return null;
}

export default function NordlysShelf() {
  return null;
}
