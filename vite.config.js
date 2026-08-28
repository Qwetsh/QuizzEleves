import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mode « offline » (`vite build --mode offline`) : base relative pour pouvoir
// servir le bundle depuis n'importe quel dossier/serveur local en classe (pas de
// chemin GitHub Pages en dur). Le reste de la config — et tout le build EN LIGNE
// (mode production) — est strictement inchangé.
//
// L'easter egg Nordlys est aussi retiré de ce mode : c'est un cadeau de mariage,
// il se joue en ligne. Ses ressources (drakkar.glb, bandes-son, personnages,
// jaquette) pèsent ~19 Mo qui n'ont rien à faire dans l'installeur d'une salle
// de classe. Le talon `nordlys/offline.jsx` en expose la même surface, si bien
// que SelectionCassettes n'a rien à savoir de tout ça.
const talonNordlys = fileURLToPath(
  new URL('./src/components/Setup/nordlys/offline.jsx', import.meta.url),
);

export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    base: offline ? './' : '/QuizzEleves/',
    plugins: [react()],
    resolve: {
      // motif ancré : l'alias remplace le spécificateur ENTIER, sinon le « ./ »
      // de tête survit et se recolle devant le chemin absolu
      alias: offline ? [{ find: /^\.\/nordlys\/NordlysShelf$/, replacement: talonNordlys }] : [],
    },
    build: {
      target: 'esnext',
    },
    test: {
      globals: true,
    },
  };
});
