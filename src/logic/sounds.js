// Simple sound effects using Web Audio API (no external files needed)
let ctx = null;

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { return null; }
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

export function soundDice() {
  const c = getCtx();
  if (!c) return;
  // Rapid clicks
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playTone(200 + Math.random() * 400, 0.05, 'square', 0.1), i * 60);
  }
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
