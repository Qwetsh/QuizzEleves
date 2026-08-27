/**
 * Nordlys — le mini-jeu de la cassette secrète (easter egg escape game).
 *
 * 100 % autonome : aucune donnée Supabase, aucun store — juste du state local.
 * Trois écrans : intro (la cassette démarre) → jeu → victoire (le mot VALKYRIE
 * en runes, attendu par le site de l'escape game — NE PAS changer ce mot).
 *
 * Le jeu = « La traversée du drakkar », coop à deux sur le même clavier
 * (NordlysDrakkar3D, moteur three.js issu du prototype Claude Design) :
 * les deux joueurs débarquent sur le pont et choisissent qui prend la barre ;
 * 10 questions (portes runiques, drapeaux, sirènes-audio), bisous compris.
 */
import React, { useEffect, useMemo, useState } from 'react';
import '../../../styles/nordlys.css';
import { currentMusic, playMusic, stopMusic } from '../../../logic/music';
import NordlysDrakkar3D from './NordlysDrakkar3D';

const FONT_DISPLAY = "'Archivo Black', system-ui, sans-serif";
const FONT_MONO = "'VT323', monospace";

// ᚹ ᚨ ᛚ ᚲ ᛃ ᚱ ᛁ ᛖ — VALKYRIE (translittération affichée dessous).
const VALKYRIE_RUNES = ['ᚹ', 'ᚨ', 'ᛚ', 'ᚲ', 'ᛃ', 'ᚱ', 'ᛁ', 'ᛖ'];

// Étoiles du ciel polaire — positions figées au montage (pas de re-scintillement
// à chaque rendu).
const makeStars = () => Array.from({ length: 40 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 55}%`,
  delay: `${(Math.random() * 3).toFixed(2)}s`,
  scale: 0.5 + Math.random(),
}));

export default function NordlysMinigame({ onClose }) {
  // 'boot' = prise de contrôle VHS (l'écran « normal » se fait avaler),
  // puis 'intro' | 'game' | 'won'.
  const [screen, setScreen] = useState('boot');
  const stars = useMemo(makeStars, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // La cassette a sa propre bande-son : on coupe la musique du Curioscope le
  // temps de la lecture, et on la reprend à l'éjection.
  useEffect(() => {
    const prev = currentMusic();
    stopMusic();
    return () => { if (prev) playMusic(prev); };
  }, []);

  // La séquence VHS se joue seule (~3,4 s) puis laisse place à l'aurore.
  useEffect(() => {
    if (screen !== 'boot') return undefined;
    const t = setTimeout(() => setScreen('intro'), 3400);
    return () => clearTimeout(t);
  }, [screen]);

  return (
    <div className="nl-root">
      <div className="nl-aurora" />
      <div className="nl-aurora nl-aurora--2" />
      {stars.map((s, i) => (
        <span key={i} className="nl-star"
          style={{ left: s.left, top: s.top, animationDelay: s.delay, transform: `scale(${s.scale})` }} />
      ))}
      <button className="nl-close" onClick={onClose} title="Éjecter la cassette">⏏</button>

      {/* Prise de contrôle VHS : flash, neige, tracking, OSD magnétoscope —
          puis l'aurore « perce » le signal et la séquence s'efface. */}
      {screen === 'boot' && (
        <div className="nl-boot" style={{ animation: 'nl-boot-settle 3.4s ease-in both' }}>
          <div className="nl-boot__snow" />
          <div className="nl-boot__band" />
          <div className="nl-boot__band nl-boot__band--2" />
          <div className="nl-boot__aurora-leak" />
          <div className="nl-boot__scan" />
          <div className="nl-boot__osd nl-boot__osd--play">▶ PLAY</div>
          <div className="nl-boot__osd nl-boot__osd--src">AV-1 · NORDLYS</div>
          <div className="nl-boot__osd nl-boot__osd--counter">00:00:1994</div>
          <div className="nl-boot__osd nl-boot__osd--warn">SIGNAL INCONNU</div>
          <div className="nl-boot__flash" />
        </div>
      )}

      {screen === 'intro' && (
        <div className="nl-panel" style={{ maxWidth: 560, padding: '0 24px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, letterSpacing: 6, color: '#5EE0A0' }}>ᚾᛟᚱᛞᛚᛇᛊ</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 44, letterSpacing: 2, color: '#eafff4', margin: '6px 0 14px', textShadow: '0 0 24px rgba(94,224,160,.5)' }}>
            NORDLYS
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 21, lineHeight: 1.5, color: '#9fd8ff' }}>
            La bande magnétique crépite.<br />
            Quelque part au nord, une lumière attend qu'on la mérite.
          </div>
          <button onClick={() => setScreen('game')}
            style={{ marginTop: 26, fontFamily: FONT_DISPLAY, fontSize: 18, letterSpacing: 1, padding: '14px 30px',
              borderRadius: 10, cursor: 'pointer', border: '2px solid #5EE0A0', background: 'rgba(94,224,160,.12)',
              color: '#5EE0A0', boxShadow: '0 0 22px rgba(94,224,160,.35)' }}>
            ▶ LIRE LA CASSETTE
          </button>
        </div>
      )}

      {screen === 'game' && <NordlysDrakkar3D onWin={() => setScreen('won')} />}

      {screen === 'won' && (
        <div className="nl-panel" style={{ padding: '0 24px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 19, letterSpacing: 4, color: '#5EE0A0', marginBottom: 22 }}>
            LA LUMIÈRE SE LÈVE
          </div>
          <div className="nl-rune-word">
            {VALKYRIE_RUNES.map((r, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.22}s, ${i * 0.22}s` }}>{r}</span>
            ))}
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, letterSpacing: 12, color: '#9fd8ff', marginTop: 20, animation: 'nl-rise .5s ease-out 2s both' }}>
            VALKYRIE
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 22, color: '#cfe8ff', marginTop: 26, animation: 'nl-rise .5s ease-out 2.6s both' }}>
            Rapporte ce mot à Amandine.
          </div>
        </div>
      )}
    </div>
  );
}
