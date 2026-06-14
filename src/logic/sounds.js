// Simple sound effects using Web Audio API (no external files needed)
let ctx = null;

let samplesPreloaded = false;
function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
    // Precharge les echantillons audio des le 1er contexte (apres geste utilisateur).
    if (!samplesPreloaded) { samplesPreloaded = true; queueMicrotask(() => preloadSamples()); }
  }
  return ctx;
}

function playTone(freq, duration = 0.15, type = 'sine', volume = 0.3) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration);
}

// Bruit blanc filtre (tonnerre, impacts) — buffer de samples aleatoires
function playNoise(duration = 0.4, volume = 0.3, { type = 'lowpass', freq = 1000, q = 0.7 } = {}) {
  const c = getCtx();
  if (!c) return;
  const frames = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = c.createGain();
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(c.currentTime);
  src.stop(c.currentTime + duration);
}

// --- Echantillons audio reels (Kenney, CC0) ---
// Charges via Vite (URL), decodes en AudioBuffer a la 1re utilisation.
const SAMPLE_URLS = import.meta.glob('../assets/sounds/*.ogg', { eager: true, query: '?url', import: 'default' });
const sampleUrlByName = {};
for (const path in SAMPLE_URLS) {
  sampleUrlByName[path.split('/').pop().replace('.ogg', '')] = SAMPLE_URLS[path];
}
const sampleBuffers = {};
const sampleLoading = {};

function loadSample(name) {
  const c = getCtx();
  if (!c || !sampleUrlByName[name] || sampleLoading[name] || sampleBuffers[name]) return;
  sampleLoading[name] = true;
  fetch(sampleUrlByName[name])
    .then((r) => r.arrayBuffer())
    .then((b) => c.decodeAudioData(b))
    .then((buf) => { sampleBuffers[name] = buf; })
    .catch(() => { sampleLoading[name] = false; });
}

// Joue un echantillon ; renvoie false s'il n'est pas (encore) pret -> fallback synthe.
function playSample(name, volume = 0.6, rate = 1) {
  const c = getCtx();
  if (!c) return false;
  const buf = sampleBuffers[name];
  if (!buf) { loadSample(name); return false; }
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const gain = c.createGain();
  gain.gain.value = volume;
  src.connect(gain);
  gain.connect(c.destination);
  src.start(c.currentTime);
  return true;
}

// Precharge les echantillons des qu'un contexte audio existe (1er son joue).
export function preloadSamples() {
  Object.keys(sampleUrlByName).forEach(loadSample);
}

// Un « clac » de de : corps boise/plastique (court sinus grave) + claquement
// (salve de bruit passe-bande tres court). Donne un impact sec et mat.
function playClack(volume = 0.18) {
  const c = getCtx();
  if (!c) return;
  playNoise(0.04, volume, { type: 'bandpass', freq: 900 + Math.random() * 1500, q: 1.7 });
  playTone(115 + Math.random() * 90, 0.05, 'triangle', volume * 0.55);
}

export function soundDice() {
  // Echantillon reel (Kenney Casino) avec variation aleatoire ; sinon synthe.
  const n = 1 + Math.floor(Math.random() * 3); // dice1..dice3
  const rate = 0.95 + Math.random() * 0.12;
  if (playSample(`dice${n}`, 0.7, rate)) return;
  soundDiceSynth();
}

function soundDiceSynth() {
  const c = getCtx();
  if (!c) return;
  // Des qui s'entrechoquent : grappe rapide au lancer, puis rebonds qui
  // ralentissent (espacement croissant), et un dernier « pose » plus doux.
  const hits = [];
  let t = 0;
  for (let i = 0; i < 7; i++) {            // tumble : cubes qui roulent
    hits.push({ t, v: 0.10 + Math.random() * 0.06 });
    t += 28 + Math.random() * 42;
  }
  let gap = 95;
  for (let i = 0; i < 4; i++) {            // rebonds qui decelerent
    t += gap; gap *= 1.5;
    hits.push({ t, v: 0.17 - i * 0.025 });
  }
  t += gap;
  hits.push({ t, v: 0.07 });              // pose finale
  hits.forEach(({ t: d, v }) => setTimeout(() => playClack(v), d));
}

// Tintement de pieces gagnees — echantillon reel (Kenney RPG « handleCoins »), sinon synthe
export function soundMoney() {
  if (playSample('coin', 0.6)) return;
  soundMoneySynth();
}

function soundMoneySynth() {
  const notes = [784, 988, 1175, 1397];
  notes.forEach((f, i) => setTimeout(() => playTone(f, 0.16, 'triangle', 0.18), i * 70));
  setTimeout(() => playTone(1568, 0.25, 'sine', 0.12), 300); // shimmer final
}

// Pieces qui s'echappent (perte)
export function soundCoinLoss() {
  const notes = [660, 520, 415, 311];
  notes.forEach((f, i) => setTimeout(() => playTone(f, 0.14, 'triangle', 0.16), i * 80));
}

// Coup de foudre : flash de bruit + grondement basse frequence
export function soundThunder() {
  playNoise(0.18, 0.32, { type: 'highpass', freq: 1800, q: 0.6 }); // crack
  setTimeout(() => playNoise(0.7, 0.4, { type: 'lowpass', freq: 320, q: 0.8 }), 60); // rumble
  setTimeout(() => playTone(70, 0.6, 'sawtooth', 0.18), 80);
}

// Whoosh court d'activation de pouvoir
export function soundPower() {
  playTone(420, 0.18, 'sawtooth', 0.14);
  setTimeout(() => playTone(720, 0.14, 'sine', 0.12), 70);
}

// Bouclier qui absorbe un recul : « clang » metallique amorti
export function soundShield() {
  playTone(330, 0.18, 'triangle', 0.2);
  setTimeout(() => playTone(247, 0.22, 'sine', 0.16), 60);
  playNoise(0.12, 0.12, { type: 'bandpass', freq: 2200, q: 1.2 });
}

// Piège qui se déclenche : claquement sec métallique
export function soundTrap() {
  playNoise(0.06, 0.28, { type: 'bandpass', freq: 2600, q: 2 });
  setTimeout(() => playTone(90, 0.18, 'square', 0.18), 30);
}

// Charge de pouvoir gagnee (pétillant ascendant)
export function soundCharge() {
  playTone(523, 0.1, 'sine', 0.16);
  setTimeout(() => playTone(784, 0.12, 'sine', 0.16), 90);
  setTimeout(() => playTone(1047, 0.16, 'triangle', 0.14), 180);
}

// Coup de katana qui tranche une réponse : sifflement aigu de la lame qui fend
// l'air (whoosh highpass) + tranchant métallique bref + fine résonance.
export function soundKatana() {
  playNoise(0.16, 0.22, { type: 'highpass', freq: 3200, q: 0.5 });           // whoosh
  setTimeout(() => playNoise(0.05, 0.2, { type: 'bandpass', freq: 4400, q: 3 }), 55); // tranchant
  setTimeout(() => playTone(2400, 0.12, 'triangle', 0.08), 75);              // shing
}

export function soundCorrect() {
  playTone(523, 0.12, 'sine', 0.25);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.25), 120);
  setTimeout(() => playTone(784, 0.2, 'sine', 0.25), 240);
}

export function soundWrong() {
  playTone(300, 0.2, 'sawtooth', 0.15);
  setTimeout(() => playTone(200, 0.3, 'sawtooth', 0.15), 200);
}

export function soundEvent() {
  playTone(440, 0.1, 'sine', 0.2);
  setTimeout(() => playTone(660, 0.1, 'sine', 0.2), 100);
  setTimeout(() => playTone(440, 0.1, 'sine', 0.2), 200);
}

export function soundVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.3, 'sine', 0.3), i * 200);
  });
}

export function soundClick() {
  playTone(800, 0.05, 'square', 0.1);
}

export function soundTimer() {
  playTone(880, 0.08, 'square', 0.15);
}
