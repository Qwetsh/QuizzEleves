/// <reference types="vite/client" />

// Couvre les imports Vite spécifiques utilisés dans le code :
// - `import.meta.glob(...)` (assets du plateau / items via glob)
// - imports suffixés `?url` (URL publique d'un asset)
// - `import.meta.env` (mode, BASE_URL…)
declare module '*?url' {
  const src: string;
  export default src;
}
