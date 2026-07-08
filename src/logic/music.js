// Musique de fond (menu + en jeu) — longues boucles MP3 lues via HTMLAudioElement.
// Deux pistes qui se relaient avec un fondu enchaîné selon la phase du jeu :
//   - 'menu' : accueil / sélection / choix des pouvoirs (Star Map Menu)
//   - 'game' : partie en cours (Stellar Drift)
// Volume et coupure sont pilotés par audioStore (indépendants des effets sonores).
import menuUrl from '../assets/music/star-map-menu.mp3';
import gameUrl from '../assets/music/stellar-drift.mp3';

const TRACKS = { menu: menuUrl, game: gameUrl };

let volume = 0.5;
let muted = false;
let currentKey = null;

const elems = {};   // key -> HTMLAudioElement
const fades = {};   // key -> intervalId (fondu en cours)

function getElem(key) {
  if (!elems[key]) {
    const a = new Audio(TRACKS[key]);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    elems[key] = a;
  }
  return elems[key];
}

function targetVol() { return muted ? 0 : volume; }

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function clearFade(key) {
  if (fades[key]) { clearInterval(fades[key]); delete fades[key]; }
}

// Fondu linéaire du volume de l'élément vers `to` en `ms` (pause en fin si →0).
function fadeTo(key, to, ms, pauseAtEnd = false) {
  const el = getElem(key);
  clearFade(key);
  const from = el.volume;
  const dst = clamp01(to);
  const steps = Math.max(1, Math.round(ms / 40));
  let i = 0;
  fades[key] = setInterval(() => {
    i++;
    el.volume = clamp01(from + (dst - from) * (i / steps));
    if (i >= steps) {
      clearFade(key);
      el.volume = dst;
      if (pauseAtEnd && dst === 0) el.pause();
    }
  }, 40);
}

// --- Reprise après blocage « autoplay » : les navigateurs bloquent la lecture
// audio tant qu'aucun geste utilisateur n'a eu lieu. On réessaie au 1er clic/touche.
let gestureArmed = false;
function armGesture() {
  if (gestureArmed) return;
  gestureArmed = true;
  const resume = () => {
    document.removeEventListener('pointerdown', resume);
    document.removeEventListener('keydown', resume);
    gestureArmed = false;
    if (currentKey && !muted) getElem(currentKey).play().catch(() => {});
  };
  document.addEventListener('pointerdown', resume);
  document.addEventListener('keydown', resume);
}

function tryPlay(el) {
  const p = el.play();
  if (p && p.catch) p.catch(() => armGesture());
}

// Bascule vers la piste `key` (fondu croisé). No-op si déjà en cours.
export function playMusic(key) {
  if (!TRACKS[key] || currentKey === key) return;
  const prev = currentKey;
  currentKey = key;
  if (prev && elems[prev]) fadeTo(prev, 0, 600, true);
  if (muted) return;
  const el = getElem(key);
  tryPlay(el);
  fadeTo(key, targetVol(), 900);
}

export function stopMusic() {
  if (currentKey) fadeTo(currentKey, 0, 500, true);
  currentKey = null;
}

export function setMusicVolume(v) {
  volume = clamp01(v);
  if (!currentKey) return;
  clearFade(currentKey);
  const el = getElem(currentKey);
  el.volume = targetVol();
  if (!muted && el.paused) tryPlay(el);
}

export function setMusicMuted(m) {
  muted = !!m;
  if (!currentKey) return;
  const el = getElem(currentKey);
  if (muted) { clearFade(currentKey); el.volume = 0; el.pause(); }
  else { tryPlay(el); fadeTo(currentKey, targetVol(), 400); }
}
