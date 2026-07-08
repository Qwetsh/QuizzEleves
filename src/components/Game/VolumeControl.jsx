import { useState, useRef, useEffect } from 'react';
import { useAudioStore } from '../../store/audioStore';
import { soundClick } from '../../logic/sounds';

// Bouton « réglage du son » posé sur le bandeau de la TV rétro. Ouvre un petit
// panneau flottant : volume musique, volume effets, coupure globale.
export default function VolumeControl() {
  const [open, setOpen] = useState(false);
  const musicVolume = useAudioStore((s) => s.musicVolume);
  const sfxVolume = useAudioStore((s) => s.sfxVolume);
  const muted = useAudioStore((s) => s.muted);
  const setMusicVolume = useAudioStore((s) => s.setMusicVolume);
  const setSfxVolume = useAudioStore((s) => s.setSfxVolume);
  const toggleMuted = useAudioStore((s) => s.toggleMuted);
  const ref = useRef(null);

  // Ferme le panneau sur clic à l'extérieur.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const icon = muted ? '\u{1F507}' : (musicVolume + sfxVolume) / 2 > 0.45 ? '\u{1F50A}' : '\u{1F509}';

  return (
    <div className="rg-vol" ref={ref}>
      <button
        className="rg-tv-switch rg-vol-btn"
        onClick={() => setOpen((o) => !o)}
        title="Réglage du son"
        aria-label="Réglage du son"
        aria-expanded={open}
      >
        <span className="rg-vol-ico">{icon}</span>
        <span className="rg-tv-switch-label" style={{ color: '#66ff8a' }}>SON</span>
      </button>

      {open && (
        <div className="rg-vol-pop" role="dialog" aria-label="Réglage du son">
          <div className="rg-vol-pop__title">{'\u{1F39A}\u{FE0F}'} RÉGLAGE DU SON</div>

          <label className="rg-vol-row">
            <span>{'\u{1F3B5}'} Musique</span>
            <input
              type="range" min="0" max="1" step="0.01" value={musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              disabled={muted}
              aria-label="Volume de la musique"
            />
            <b>{Math.round(musicVolume * 100)}</b>
          </label>

          <label className="rg-vol-row">
            <span>{'\u{1F514}'} Effets</span>
            <input
              type="range" min="0" max="1" step="0.01" value={sfxVolume}
              onChange={(e) => setSfxVolume(parseFloat(e.target.value))}
              onPointerUp={() => { if (!muted) soundClick(); }}
              disabled={muted}
              aria-label="Volume des effets sonores"
            />
            <b>{Math.round(sfxVolume * 100)}</b>
          </label>

          <button className="rg-vol-mute" onClick={toggleMuted}>
            {muted ? `\u{1F508} Rétablir le son` : `\u{1F507} Couper le son`}
          </button>
        </div>
      )}
    </div>
  );
}
