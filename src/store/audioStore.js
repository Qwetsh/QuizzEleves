// État réactif du réglage du son (volume musique, volume effets, coupure).
// C'est la couche UI : chaque changement est répercuté sur les moteurs audio
// impératifs (sounds.js pour les effets, music.js pour la musique) et persisté
// en localStorage pour retrouver ses réglages d'une partie à l'autre.
import { create } from 'zustand';
import { setSfxVolume, setSfxMuted } from '../logic/sounds';
import { setMusicVolume, setMusicMuted } from '../logic/music';

const LS_KEY = 'qm-audio';

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}

const saved = loadSaved();
const initial = {
  musicVolume: typeof saved.musicVolume === 'number' ? saved.musicVolume : 0.5,
  sfxVolume: typeof saved.sfxVolume === 'number' ? saved.sfxVolume : 0.8,
  muted: !!saved.muted,
};

// Applique les réglages sauvegardés aux moteurs audio dès le chargement.
setSfxVolume(initial.sfxVolume);
setSfxMuted(initial.muted);
setMusicVolume(initial.musicVolume);
setMusicMuted(initial.muted);

function persist(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      musicVolume: s.musicVolume, sfxVolume: s.sfxVolume, muted: s.muted,
    }));
  } catch { /* localStorage indisponible : réglages non persistés */ }
}

export const useAudioStore = create((set, get) => ({
  ...initial,
  setMusicVolume: (v) => { setMusicVolume(v); set({ musicVolume: v }); persist(get()); },
  setSfxVolume: (v) => { setSfxVolume(v); set({ sfxVolume: v }); persist(get()); },
  setMuted: (m) => { setSfxMuted(m); setMusicMuted(m); set({ muted: m }); persist(get()); },
  toggleMuted: () => {
    const m = !get().muted;
    setSfxMuted(m); setMusicMuted(m);
    set({ muted: m }); persist(get());
  },
}));
