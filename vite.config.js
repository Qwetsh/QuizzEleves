import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/QuizzEleves/',
  plugins: [react()],
  build: {
    target: 'esnext',
  },
  test: {
    globals: true,
  },
});
