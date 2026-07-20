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
  // Contexte suspendu (créé avant tout geste utilisateur, ou page remise en
  // avant-plan) : sans resume() TOUS les sons sont muets en silence.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// --- Bus maître des effets sonores ---
// Tous les sons synthé/échantillons passent par ce gain avant la sortie, ce qui
// permet un réglage de volume / une coupure globale (voir audioStore). La musique
// de fond (music.js) est indépendante et a son propre volume.
let masterGain = null;
let sfxVolume = 0.8;
let sfxMuted = false;
function getMaster() {
  const c = getCtx();
  if (!c) return null;
  if (!masterGain) {
    masterGain = c.createGain();
    masterGain.gain.value = sfxMuted ? 0 : sfxVolume;
    masterGain.connect(c.destination);
  }
  return masterGain;
}
function applyMaster() {
  if (masterGain) masterGain.gain.value = sfxMuted ? 0 : sfxVolume;
}
export function setSfxVolume(v) {
  sfxVolume = Math.max(0, Math.min(1, v));
  applyMaster();
}
export function setSfxMuted(m) {
  sfxMuted = !!m;
  applyMaster();
}
// Niveau effectif (0 si muet) — pour les lecteurs HTMLAudio hors bus Web Audio
// (ex. extraits du Blind test) qui doivent respecter le réglage global.
export function getSfxLevel() {
  return sfxMuted ? 0 : sfxVolume;
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
  gain.connect(getMaster());
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
  gain.connect(getMaster());
  src.start(c.currentTime);
  src.stop(c.currentTime + duration);
}

// --- Echantillons audio reels (Kenney, CC0 + jingles) ---
// Charges via Vite (URL), decodes en AudioBuffer a la 1re utilisation.
const SAMPLE_URLS = import.meta.glob('../assets/sounds/*.{ogg,mp3}', { eager: true, query: '?url', import: 'default' });
const sampleUrlByName = {};
for (const path in SAMPLE_URLS) {
  sampleUrlByName[path.split('/').pop().replace(/\.(ogg|mp3)$/, '')] = SAMPLE_URLS[path];
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
  gain.connect(getMaster());
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

// Vent (météo ambiante) : souffle continu = bruit blanc passe-bas modulé.
export function soundWind() {
  playNoise(1.1, 0.16, { type: 'lowpass', freq: 520, q: 0.5 });
  setTimeout(() => playNoise(0.9, 0.13, { type: 'lowpass', freq: 700, q: 0.4 }), 250);
  setTimeout(() => playNoise(0.7, 0.1, { type: 'bandpass', freq: 900, q: 0.8 }), 550);
}

// Séisme (météo) : grondement très grave + roulement de bruit basse fréquence.
export function soundQuake() {
  playNoise(1.3, 0.42, { type: 'lowpass', freq: 120, q: 0.9 });
  playTone(45, 1.1, 'sawtooth', 0.22);
  setTimeout(() => playTone(38, 0.9, 'sawtooth', 0.18), 300);
  setTimeout(() => playNoise(0.5, 0.3, { type: 'lowpass', freq: 90, q: 1 }), 600);
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

// Saut hyperspatial : souffle (bruit balayé) + drone grave qui monte jusqu'au
// « saut », puis un « pop » de sortie d'hyperespace. `dur` en s cale la cinématique.
export function soundHyperspace(dur = 2.1) {
  const c = getCtx();
  const master = getMaster();
  if (!c || !master) return;
  const t0 = c.currentTime;
  const jump = dur * 0.86; // instant du saut (pic) avant la sortie

  // 1) Souffle : bruit blanc long, passe-bande dont la fréquence + le gain montent.
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buffer;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(160, t0);
  bp.frequency.exponentialRampToValueAtTime(3400, t0 + jump);
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.34, t0 + dur * 0.7);
  ng.gain.exponentialRampToValueAtTime(0.5, t0 + jump);
  ng.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  src.connect(bp); bp.connect(ng); ng.connect(master);
  src.start(t0); src.stop(t0 + dur);

  // 2) Drone : sawtooth grave qui monte (accélération vers la lumière).
  const osc = c.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(58, t0);
  osc.frequency.exponentialRampToValueAtTime(440, t0 + jump);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.14, t0 + dur * 0.7);
  og.gain.exponentialRampToValueAtTime(0.0008, t0 + dur * 0.92);
  osc.connect(og); og.connect(master);
  osc.start(t0); osc.stop(t0 + dur);

  // 3) « Pop » de sortie : impact + descente rapide, au moment du saut.
  setTimeout(() => {
    playNoise(0.22, 0.3, { type: 'lowpass', freq: 2600, q: 0.6 });
    const b = c.createOscillator(); b.type = 'triangle';
    const bg = c.createGain(); const tt = c.currentTime;
    b.frequency.setValueAtTime(920, tt);
    b.frequency.exponentialRampToValueAtTime(120, tt + 0.35);
    bg.gain.setValueAtTime(0.3, tt);
    bg.gain.exponentialRampToValueAtTime(0.001, tt + 0.4);
    b.connect(bg); bg.connect(master);
    b.start(tt); b.stop(tt + 0.42);
  }, Math.round(jump * 1000));
}

// Révélation d'une silhouette (« Qui est ce Pokémon ? ») : petit roulement
// interrogatif qui se résout en un accord ascendant triomphal + scintillement —
// le « C'est ... ! » de la pub TV. Joué au moment où l'image passe en couleur.
export function soundReveal() {
  // Montée interrogative rapide (« qui est-ce ? »)
  playTone(392, 0.08, 'triangle', 0.14);
  setTimeout(() => playTone(494, 0.08, 'triangle', 0.14), 80);
  // Résolution triomphale (arpège majeur) + shimmer cristallin
  setTimeout(() => playTone(659, 0.14, 'sine', 0.24), 200);   // mi
  setTimeout(() => playTone(784, 0.14, 'sine', 0.24), 300);   // sol
  setTimeout(() => playTone(1047, 0.28, 'triangle', 0.22), 400); // do aigu
  setTimeout(() => playNoise(0.3, 0.07, { type: 'highpass', freq: 5200, q: 0.5 }), 420);
}

// Lancer de pokéball (intro « Qui est ce Pokémon ?! ») : sifflement de vol
// (bruit passe-bande balayé du grave vers l'aigu, façon projectile) puis « pop »
// d'ouverture + scintillement, calés sur l'animation (vol ~0,85 s puis flash).
export function soundWtpBall() {
  const c = getCtx();
  const master = getMaster();
  if (!c || !master) return;
  const dur = 0.8;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4;
  const t = c.currentTime;
  filter.frequency.setValueAtTime(320, t);
  filter.frequency.exponentialRampToValueAtTime(2600, t + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.55, t + dur * 0.7); // s'approche → enfle
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
  src.stop(t + dur);
  // Effet doppler léger : sinus grave qui monte avec le vol.
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(420, t + dur);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.7);
  og.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(og);
  og.connect(master);
  osc.start(t);
  osc.stop(t + dur);
  // Impact : pop d'ouverture + note claire + scintillement du flash.
  setTimeout(() => {
    playNoise(0.14, 0.55, { type: 'bandpass', freq: 1600, q: 1.1 });
    playTone(520, 0.14, 'triangle', 0.4);
    playTone(180, 0.1, 'sine', 0.3);
    setTimeout(() => playNoise(0.35, 0.14, { type: 'highpass', freq: 5000, q: 0.5 }), 60);
  }, 830);
}

// Jingle TV « Qui est ce Pokémon ?! » (extrait original) : lancé au début de
// chaque manche du mini-jeu silhouette, coupé net à la révélation (le sting
// « C'est … ! » est alors joué par soundReveal). Une seule instance à la fois ;
// passe par le bus maître → respecte volume/coupure des effets.
let wtpSource = null;
export function soundWtpJingle() {
  stopWtpJingle();
  const c = getCtx();
  if (!c) return;
  const buf = sampleBuffers['whos-that-pokemon'];
  if (!buf) {
    // Pas encore décodé (1er lancement) : charge puis retente brièvement.
    loadSample('whos-that-pokemon');
    let tries = 0;
    const retry = setInterval(() => {
      if (sampleBuffers['whos-that-pokemon']) { clearInterval(retry); soundWtpJingle(); }
      else if (++tries > 8) clearInterval(retry);
    }, 250);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.value = 0.75;
  src.connect(gain);
  gain.connect(getMaster());
  src.start(c.currentTime);
  src.onended = () => { if (wtpSource === src) wtpSource = null; };
  wtpSource = src;
}
export function stopWtpJingle() {
  if (wtpSource) {
    try { wtpSource.stop(); } catch { /* déjà stoppé */ }
    wtpSource = null;
  }
}

export function soundVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    setTimeout(() => playTone(f, 0.3, 'sine', 0.3), i * 200);
  });
}

// Forge : marteau qui frappe l'enclume (2 coups métalliques) + trempe (sifflement
// de vapeur). Pièce sonore de la cérémonie de forge (§8).
export function soundForge() {
  const clang = (v) => {
    playNoise(0.05, v, { type: 'bandpass', freq: 1700 + Math.random() * 700, q: 1.6 }); // impact
    playTone(170, 0.12, 'square', v * 0.4);                                              // masse
    setTimeout(() => playTone(2300, 0.18, 'triangle', v * 0.22), 8);                     // résonance
  };
  clang(0.26);
  setTimeout(() => clang(0.22), 175);
  setTimeout(() => playNoise(0.5, 0.16, { type: 'highpass', freq: 5200, q: 0.5 }), 430); // trempe
}

// Coulée d'une face dans son moule : jet de métal (glissando descendant) +
// trempe (sifflement de vapeur). Joué au moment où la face est posée.
export function soundCast() {
  playTone(560, 0.16, 'sawtooth', 0.1);
  setTimeout(() => playTone(300, 0.2, 'sawtooth', 0.1), 70);
  setTimeout(() => playNoise(0.55, 0.2, { type: 'highpass', freq: 5200, q: 0.5 }), 200); // trempe
}

export function soundClick() {
  playTone(800, 0.05, 'square', 0.1);
}

// Pouvoir SABLIER (sabotage du temps de la cible) : un tic-tac d'horloge régulier
// qui se DÉRÈGLE — l'engrenage s'emballe, le ressort se détend (glissando grave),
// puis le mécanisme se bloque (clunk). Accompagne la cinématique <PowerCinematic>.
export function soundSablier() {
  // tic = clic aigu, tac = clic plus grave (alternance d'une vraie horloge)
  const tick = (hi, v = 0.16) => {
    playNoise(0.022, v, { type: 'bandpass', freq: hi ? 3200 : 2200, q: 3.2 });
    playTone(hi ? 1500 : 1080, 0.028, 'square', v * 0.45);
  };
  // 1) 6 tic-tac réguliers (~1 s)
  for (let i = 0; i < 6; i++) setTimeout(() => tick(i % 2 === 0), i * 165);
  // 2) emballement : les tics accélèrent puis le ressort se détend (pitch qui chute)
  setTimeout(() => {
    let t = 0;
    for (let i = 0; i < 8; i++) { setTimeout(() => tick(i % 2 === 0, 0.13), t); t += Math.max(22, 78 - i * 8); }
    playTone(900, 0.5, 'sawtooth', 0.1);
    setTimeout(() => playTone(520, 0.45, 'sawtooth', 0.11), 110);
    setTimeout(() => playTone(300, 0.5, 'sawtooth', 0.12), 240);
  }, 1000);
  // 3) clunk final : le mécanisme se bloque
  setTimeout(() => {
    playNoise(0.13, 0.24, { type: 'lowpass', freq: 280, q: 1 });
    playTone(115, 0.24, 'square', 0.17);
  }, 1760);
}

// Sablier SUR SOI (gain de temps) : version POSITIVE — on remonte le ressort,
// les tics ralentissent en montant, puis un accord chaleureux (« +temps »).
export function soundSablierBoost() {
  const tick = (f, v = 0.12) => {
    playNoise(0.02, v, { type: 'bandpass', freq: f, q: 3 });
    playTone(f * 0.7, 0.03, 'square', v * 0.4);
  };
  let t = 0;
  for (let i = 0; i < 6; i++) { const f = 2100 + i * 190; setTimeout(() => tick(f), t); t += 110 + i * 32; }
  setTimeout(() => {
    playTone(523, 0.3, 'sine', 0.16);
    playTone(659, 0.32, 'sine', 0.13);
    setTimeout(() => playTone(784, 0.42, 'triangle', 0.16), 120);
  }, 950);
}

// Pouvoir DOUBLE (questions imposées en plus) : un « blip » interrogatif (montée)
// qui se DÉDOUBLE puis résonne en écho — sensation de questions qui se multiplient.
export function soundDouble() {
  const q = (v = 0.14) => {
    playTone(440, 0.09, 'triangle', v);
    setTimeout(() => playTone(660, 0.12, 'triangle', v), 90); // montée interrogative
  };
  q();                              // la question
  setTimeout(() => q(0.12), 165);   // sa copie
  setTimeout(() => q(0.07), 430);   // écho
  setTimeout(() => q(0.045), 650);  // écho lointain
}

export function soundTimer() {
  playTone(880, 0.08, 'square', 0.15);
}

// Téléportation (point de contrôle) : « whoosh » spatial ascendant (aspiration au
// départ) suivi d'un scintillement cristallin descendant (matérialisation).
export function soundWarp() {
  // Aspiration : bruit passe-bande qui monte + glissando sinus ascendant.
  playNoise(0.34, 0.16, { type: 'bandpass', freq: 900, q: 0.7 });
  playTone(220, 0.3, 'sine', 0.12);
  setTimeout(() => playTone(660, 0.22, 'sine', 0.12), 120);
  // Matérialisation à l'arrivée : arpège cristallin + shimmer.
  setTimeout(() => {
    [1320, 990, 1560].forEach((f, i) => setTimeout(() => playTone(f, 0.16, 'triangle', 0.12), i * 60));
    playNoise(0.3, 0.08, { type: 'highpass', freq: 5000, q: 0.5 });
  }, 400);
}

// Incantation d'un sort (extension Magie) : whoosh grave qui MONTE (l'énergie
// s'accumule dans le cercle) puis arpège scintillant quand les runes s'allument.
// ~0,8 s — joué au début de la cérémonie <SpellCeremony>.
export function soundSpell() {
  const c = getCtx();
  const master = getMaster();
  if (!c || !master) return;
  const t0 = c.currentTime;
  // 1) Souffle : bruit passe-bande balayé 200 Hz → 2,4 kHz, gain en cloche.
  const frames = Math.floor(c.sampleRate * 0.6);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(200, t0);
  bp.frequency.exponentialRampToValueAtTime(2400, t0 + 0.55);
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.0001, t0);
  ng.gain.exponentialRampToValueAtTime(0.24, t0 + 0.38);
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  src.connect(bp); bp.connect(ng); ng.connect(master);
  src.start(t0); src.stop(t0 + 0.6);
  // 2) Drone grave ascendant sous le souffle (la « gravité » de l'incantation).
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t0);
  osc.frequency.exponentialRampToValueAtTime(440, t0 + 0.55);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(0.13, t0 + 0.35);
  og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  osc.connect(og); og.connect(master);
  osc.start(t0); osc.stop(t0 + 0.6);
  // 3) Arpège scintillant en sortie de whoosh + shimmer cristallin.
  [880, 1175, 1568, 2093].forEach((f, i) => setTimeout(() => playTone(f, 0.14, 'triangle', 0.12), 380 + i * 70));
  setTimeout(() => playNoise(0.28, 0.06, { type: 'highpass', freq: 6000, q: 0.5 }), 540);
}

// Sort raté (fizzle) : glissando descendant penaud (le ballon se dégonfle) +
// « pfff » de souffle grave. Joué à la brisure du cercle magique.
export function soundFizzle() {
  const c = getCtx();
  const master = getMaster();
  if (!c || !master) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(620, t0);
  osc.frequency.exponentialRampToValueAtTime(110, t0 + 0.55);
  const g = c.createGain();
  g.gain.setValueAtTime(0.13, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + 0.6);
  // « Pfff » : bouffée de bruit filtré grave qui retombe + plouf final.
  setTimeout(() => playNoise(0.4, 0.14, { type: 'lowpass', freq: 700, q: 0.6 }), 180);
  setTimeout(() => playTone(92, 0.22, 'triangle', 0.11), 460);
}

// ── Combat Pokémon (P5) — sons synthétisés par archétype d'attaque ──────────
// Un son court (<900 ms) et typé par ARCHÉTYPE de VFX (cf. logic/pkmnAnimMap).
// Joués UNIQUEMENT sur la surface qui fait office de sono : tactile =
// PokemonBattleGame ; téléphones = la TV (PkmnDuelStage). Passent tous par le
// bus maître → respectent volume/coupure des effets (getMaster / getSfxLevel).

// Glissando : oscillateur qui balaie f0→f1 avec enveloppe simple (rampe expo).
function glide(f0, f1, dur, type = 'sine', vol = 0.16) {
  const c = getCtx();
  const master = getMaster();
  if (!c || !master) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.18);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  osc.connect(g); g.connect(master);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

const PKMN_VFX_SOUND = {
  // Vague : bruit passe-bas dont la fréquence descend (déferlante) + « splash ».
  wave() {
    const c = getCtx(); const master = getMaster(); if (!c || !master) return;
    const t0 = c.currentTime; const dur = 0.6;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(2200, t0);
    bp.frequency.exponentialRampToValueAtTime(360, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur);
    setTimeout(() => playNoise(0.18, 0.16, { type: 'lowpass', freq: 700, q: 0.7 }), 480); // splash à l'impact
  },
  // Beam : ton pur montant, tenu, + fine surcouche aiguë (rayon d'énergie).
  beam() {
    glide(320, 1200, 0.62, 'sawtooth', 0.13);
    setTimeout(() => playTone(1600, 0.16, 'sine', 0.08), 470);
  },
  // Projectile : petit « pew » descendant bref + tic d'impact.
  projectile() {
    glide(1300, 500, 0.16, 'square', 0.1);
    setTimeout(() => playNoise(0.06, 0.14, { type: 'bandpass', freq: 1800, q: 1.4 }), 560);
  },
  // Flammes : rugissement de bruit passe-bande chaud + crépitement.
  flames() {
    const c = getCtx(); const master = getMaster(); if (!c || !master) return;
    const t0 = c.currentTime; const dur = 0.55;
    const frames = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, frames, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(500, t0);
    bp.frequency.exponentialRampToValueAtTime(1400, t0 + 0.3);
    const g = c.createGain(); g.gain.setValueAtTime(0.28, t0);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur);
    setTimeout(() => playNoise(0.2, 0.12, { type: 'highpass', freq: 3000, q: 0.5 }), 460); // crépitement
  },
  // Bolt : crack sec aigu + rumble grave (calé sur le flash de l'éclair).
  bolt() {
    playNoise(0.14, 0.3, { type: 'highpass', freq: 2000, q: 0.6 });
    setTimeout(() => { playNoise(0.5, 0.34, { type: 'lowpass', freq: 300, q: 0.8 }); playTone(64, 0.5, 'sawtooth', 0.16); }, 50);
  },
  // Quake : grondement très grave qui roule (secousse du sol).
  quake() {
    playNoise(1.0, 0.36, { type: 'lowpass', freq: 130, q: 0.9 });
    playTone(46, 0.9, 'sawtooth', 0.2);
    setTimeout(() => playTone(38, 0.7, 'sawtooth', 0.16), 260);
  },
  // Slash : swish bref (bruit passe-haut balayé) + shing tranchant.
  slash() {
    playNoise(0.13, 0.22, { type: 'highpass', freq: 3400, q: 0.5 });
    setTimeout(() => playTone(2600, 0.1, 'triangle', 0.08), 60);
  },
  // Charge : impact sourd (thud grave) — ruée physique au contact.
  charge() {
    playTone(150, 0.14, 'square', 0.2);
    playNoise(0.1, 0.2, { type: 'lowpass', freq: 500, q: 0.8 });
    setTimeout(() => playTone(90, 0.16, 'sine', 0.14), 40);
  },
  // Spores : shimmer doux, nuage qui dérive (notes sinus voilées + souffle).
  spores() {
    [880, 990, 1100].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.07), i * 120));
    playNoise(0.6, 0.05, { type: 'bandpass', freq: 2400, q: 0.6 });
  },
  // Psy : wobble sinusoïdal (fréquence modulée) — énergie psychique.
  psy() {
    const c = getCtx(); const master = getMaster(); if (!c || !master) return;
    const t0 = c.currentTime; const dur = 0.6;
    const osc = c.createOscillator(); osc.type = 'sine';
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 14;
    const lg = c.createGain(); lg.gain.value = 220;
    osc.frequency.value = 620;
    lfo.connect(lg); lg.connect(osc.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); lfo.start(t0); osc.stop(t0 + dur); lfo.stop(t0 + dur);
  },
  // Drain : glissando descendant (l'énergie est aspirée vers le lanceur).
  drain() {
    glide(900, 240, 0.6, 'triangle', 0.14);
    setTimeout(() => playTone(330, 0.16, 'sine', 0.1), 560);
  },
  // Buff : arpège majeur MONTANT (renforcement).
  buff() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.16, 'triangle', 0.14), i * 75));
  },
  // Debuff : arpège DESCENDANT (affaiblissement).
  debuff() {
    [784, 659, 523, 392].forEach((f, i) => setTimeout(() => playTone(f, 0.16, 'triangle', 0.13), i * 80));
  },
  // Notes : 3 notes de berceuse douces (chant apaisant).
  notes() {
    [659, 587, 494].forEach((f, i) => setTimeout(() => playTone(f, 0.3, 'sine', 0.13), i * 200));
  },
};

// Joue le son d'un archétype de VFX Pokémon (repli silencieux si inconnu).
export function soundPkmnVfx(archetype) {
  const fn = PKMN_VFX_SOUND[archetype];
  if (fn) fn();
}

// Lancer de pokéball d'un Pokémon en combat (entrée) : woosh de vol court +
// « pop » d'ouverture (plus léger que soundWtpBall qui sert à l'intro « Qui… »).
export function soundPkmnBall() {
  const c = getCtx(); const master = getMaster(); if (!c || !master) return;
  const dur = 0.45;
  const frames = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
  const t = c.currentTime;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(2200, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.3, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur);
  // Pop d'ouverture calé sur la matérialisation.
  setTimeout(() => { playTone(520, 0.12, 'triangle', 0.3); playNoise(0.1, 0.28, { type: 'bandpass', freq: 1600, q: 1.1 }); }, 430);
}

// Rappel dans la pokéball : zap descendant (le Pokémon est aspiré au rayon rouge).
export function soundPkmnRecall() {
  glide(1400, 300, 0.42, 'sawtooth', 0.14);
  setTimeout(() => playTone(180, 0.1, 'sine', 0.12), 380);
}

// K.O. : chute (glissando grave descendant) + « plouf » sourd à l'atterrissage.
export function soundPkmnFaint() {
  glide(520, 90, 0.7, 'triangle', 0.18);
  setTimeout(() => { playTone(70, 0.24, 'sine', 0.16); playNoise(0.12, 0.14, { type: 'lowpass', freq: 300, q: 0.8 }); }, 640);
}

// Victoire du combat Pokémon : petite fanfare montante enjouée (do majeur).
export function soundPkmnVictory() {
  [523, 659, 784, 659, 1047].forEach((f, i) => setTimeout(() => playTone(f, i === 4 ? 0.36 : 0.16, 'triangle', 0.2), i * 130));
  setTimeout(() => playNoise(0.3, 0.06, { type: 'highpass', freq: 5200, q: 0.5 }), 620);
}

// Sort DÉCOUVERT : fanfare triomphale ascendante + shimmer aigu (style
// soundReveal) — joué à l'apparition du bandeau doré « Nouveau sort découvert ».
export function soundSpellDiscover() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.2), i * 90)); // do majeur montant
  setTimeout(() => playTone(1568, 0.4, 'triangle', 0.16), 460); // sol aigu tenu
  setTimeout(() => playNoise(0.4, 0.08, { type: 'highpass', freq: 5500, q: 0.5 }), 480); // shimmer
}
