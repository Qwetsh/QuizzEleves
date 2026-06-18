import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mode « offline » (`vite build --mode offline`) : base relative pour pouvoir
// servir le bundle depuis n'importe quel dossier/serveur local en classe (pas de
// chemin GitHub Pages en dur). Le reste de la config — et tout le build EN LIGNE
// (mode production) — est strictement inchangé.
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  return {
    base: offline ? './' : '/QuizzEleves/',
    plugins: [react()],
    build: {
      target: 'esnext',
    },
    test: {
      globals: true,
    },
  };
});
