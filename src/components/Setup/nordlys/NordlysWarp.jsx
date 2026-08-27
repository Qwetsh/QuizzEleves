/**
 * Nordlys — séquence « singularité » du déblocage console.
 *
 * Un trou noir s'ouvre au centre du BAC (et seulement là : la machine à fentes
 * reste visible et utilisable à droite), aspire les jaquettes en spirale,
 * s'effondre, et la cassette secrète naît de l'éclat. Elle finit en flottaison
 * stable, draggable vers le Curioscope.
 *
 * À monter DANS le conteneur du bac (`[data-nl-bay]`, position:relative) —
 * NordlysShelf s'en charge par portail, parce qu'il vit lui-même à l'intérieur
 * du rack scrollable, qui n'est pas le bon repère.
 *
 * Les jaquettes aspirées sont les VRAIS éléments du DOM : on les anime par
 * styles inline + Web Animations API, `cssText` sauvegardé et restitué une fois
 * le fond nuit opaque (le bac est alors intact dessous, personne ne l'a vu).
 *
 * Timeline (× S = 1/speed) :
 *   0     tremblement léger        2450  fond opaque → restitution du bac
 *   420   tremblement violent      2500  effondrement + onde de choc
 *   380   fond nuit + trou noir    3180  éclat + naissance de la cassette
 *   620   aspiration en spirale    4400  flottaison stable, drag actif
 */
import { useEffect, useRef } from 'react';

const NIGHT = 'radial-gradient(120% 100% at 50% 32%, #14224a 0%, #0A1020 48%, #05070f 100%)';

// Souffle de la singularité, joué à l'ouverture du trou noir. Le fichier a
// 0,62 s de silence en tête (mesuré) : sans ce décalage, le son arriverait
// après coup — exactement le défaut qu'avait le clac de la cassette.
const HOLE_SFX = Object.values(import.meta.glob('../../../assets/nordlys/blackhole.mp3', {
  eager: true, query: '?url', import: 'default',
}))[0] || null;
const HOLE_SFX_AT = 0.62; // ce qui reste (4,26 s) couvre toute la séquence

// Ce que le trou noir avale : jaquettes (« glisse-moi dans le Curioscope » /
// « déjà dans le Curioscope ») + plaques de rayon. La cassette Nordlys
// elle-même (« qui n'existe pas ») est évidemment épargnée.
const TILE_SELECTOR = 'button[title*="Curioscope"], button[title*="rayon"]';
const tilesOf = (root) => [...root.querySelectorAll(TILE_SELECTOR)]
  .filter((el) => !(el.title || '').includes("n'existe pas"));

// starfield déterministe : un LCG, pas Math.random — sinon les étoiles
// se redistribuent à chaque re-render (et il y en a, la cassette est draggable).
const STARS = (() => {
  let s = 7;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: 46 }, () => ({
    left: `${(rnd() * 100).toFixed(1)}%`, top: `${(rnd() * 100).toFixed(1)}%`,
    size: `${(0.8 + rnd() * 1.8).toFixed(1)}px`,
    dur: `${(1.6 + rnd() * 2.8).toFixed(2)}s`, delay: `-${(rnd() * 4).toFixed(2)}s`,
  }));
})();

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/**
 * @param {boolean} active           déclenche la séquence
 * @param {number} [speed]           1 = timings de référence
 * @param {() => HTMLElement[]} [getTiles]  override du ramassage des jaquettes
 * @param {() => void} [onReady]     appelé quand la cassette est stable/draggable
 * @param {object} [cassetteProps]   posé sur le cadre de la cassette (onPointerDown, title…)
 * @param {React.ReactNode} children la cassette elle-même (jaquette)
 */
export default function NordlysWarp({ active, speed = 1, getTiles, onReady, cassetteProps, children }) {
  const warpRef = useRef(null), holeRef = useRef(null), shockRef = useRef(null),
    burstRef = useRef(null), cassRef = useRef(null), hintRef = useRef(null);
  const timers = useRef([]), anims = useRef([]), saved = useRef([]), rackRef = useRef(null);
  const sfx = useRef(null);

  // ⚠️ `el.animate(..., {fill:'forwards'})` continue d'imposer son transform
  // final même après restitution du cssText → il FAUT annuler les Animation
  // ET remettre transform/opacity/filter à vide, sinon le bac reste invisible.
  const restoreTiles = () => {
    if (rackRef.current) rackRef.current.style.zIndex = '';
    rackRef.current = null;
    for (const a of anims.current) { try { a.cancel(); } catch { /* déjà finie */ } }
    anims.current = [];
    for (const { el, cssText } of saved.current) {
      for (const a of el.getAnimations()) { try { a.cancel(); } catch { /* idem */ } }
      el.style.cssText = cssText;
      el.style.transform = 'none';
      el.style.opacity = '';
      el.style.filter = '';
      el.style.animation = '';
      el.style.pointerEvents = '';
    }
    saved.current = [];
  };

  useEffect(() => {
    if (!active) return undefined;
    const warp = warpRef.current, hole = holeRef.current, cass = cassRef.current;
    const bay = warp.parentElement;

    // état 5 d'emblée : ni tremblement ni effondrement, juste la cassette.
    const settle = () => {
      cass.style.opacity = '1';
      cass.style.animation = 'nlw-float 3.4s ease-in-out infinite';
      cass.style.pointerEvents = 'auto';
      hintRef.current.style.display = 'block';
      onReady?.();
    };
    if (reducedMotion()) {
      warp.style.opacity = '1';
      settle();
      return restoreTiles;
    }

    const S = 1 / Math.max(0.4, speed);
    const T = (fn, ms) => timers.current.push(setTimeout(fn, ms * S));
    // décodé dès maintenant : il doit partir pile à l'ouverture du trou noir
    if (HOLE_SFX) { sfx.current = new Audio(HOLE_SFX); sfx.current.preload = 'auto'; }
    const tiles = getTiles ? getTiles() : tilesOf(bay);
    saved.current = tiles.map((el) => ({ el, cssText: el.style.cssText }));

    // 1 — la gravité monte
    tiles.forEach((el, i) => { el.style.animation = `nlw-shake-a .34s linear ${i * 9}ms infinite`; });
    T(() => tiles.forEach((el, i) => { el.style.animation = `nlw-shake-b .22s linear ${i * 5}ms infinite`; }), 420);

    // le trou noir s'ouvre pendant que le fond nuit s'installe
    T(() => {
      warp.style.opacity = '1';
      hole.style.animation = `nlw-hole-in ${1.15 * S}s cubic-bezier(.2,.85,.25,1) both`;
      const a = sfx.current;
      if (a) { try { a.currentTime = HOLE_SFX_AT; } catch { /* pas encore chargé */ } a.play().catch(() => {}); }
    }, 380);

    // 2 — aspiration en spirale. Le rack est remonté AU-DESSUS du fond nuit,
    // sans quoi l'absorption se joue derrière un écran opaque : invisible.
    T(() => {
      const rack = bay.querySelector('[data-nl-rack]');
      if (rack) { rackRef.current = rack; rack.style.zIndex = '41'; }
      const zr = bay.getBoundingClientRect();
      const k = zr.width / bay.offsetWidth || 1; // le stage des cassettes est scalé
      const cx = zr.left + zr.width / 2, cy = zr.top + zr.height / 2;
      for (const el of tiles) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const vx = (cx - (r.left + r.width / 2)) / k, vy = (cy - (r.top + r.height / 2)) / k;
        const d = Math.hypot(vx, vy), a0 = Math.atan2(-vy, -vx);
        const dir = Math.random() < 0.5 ? -1 : 1;
        const phi = dir * (2.4 + Math.random() * 1.4);     // enroulement de la spirale
        const frames = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const rr = d * Math.pow(1 - t, 1.7);             // chute accélérée vers l'horizon
          const ang = a0 + phi * t;
          frames.push({
            offset: t,
            transform: `translate(${(vx + rr * Math.cos(ang)).toFixed(2)}px, ${(vy + rr * Math.sin(ang)).toFixed(2)}px)`
              + ` rotate(${(dir * 520 * t).toFixed(1)}deg) scale(${Math.max(0.02, 1 - t * 0.98).toFixed(3)})`,
            opacity: t < 0.72 ? 1 : Number((1 - (t - 0.72) / 0.28).toFixed(2)),
            filter: `blur(${(t * 2.6).toFixed(2)}px) brightness(${(1 + t * 1.4).toFixed(2)})`,
          });
        }
        el.style.animation = 'none';
        el.style.pointerEvents = 'none';
        anims.current.push(el.animate(frames, {
          duration: 1000 * S,
          delay: (d * 0.5 + Math.random() * 180) * S,      // les plus loin partent en dernier
          easing: 'cubic-bezier(.45,0,.75,.45)',
          fill: 'forwards',
        }));
      }
    }, 620);

    // le fond est opaque : on remet le bac intact dessous
    T(restoreTiles, 2450);

    // 3 — effondrement de la singularité + onde de choc
    T(() => {
      hole.style.animation = `nlw-hole-out ${0.95 * S}s cubic-bezier(.5,0,.3,1) both`;
      const sh = shockRef.current;
      sh.style.animation = 'none';
      requestAnimationFrame(() => { sh.style.animation = `nlw-shock ${1.3 * S}s cubic-bezier(.15,.7,.2,1) both`; });
    }, 2500);

    // 4 — naissance de la cassette
    T(() => {
      burstRef.current.style.animation = `nlw-burst ${1.1 * S}s ease-out both`;
      cass.style.opacity = '1';
      cass.style.animation = `nlw-mat ${1.25 * S}s cubic-bezier(.28,.82,.28,1) both`;
    }, 3180);

    // 5 — état stable, draggable
    T(settle, 4400);

    return () => {
      for (const tm of timers.current) clearTimeout(tm);
      timers.current = [];
      // la cassette insérée coupe l'écrin : le souffle ne doit pas déborder sur
      // le clac de l'insertion
      if (sfx.current) { sfx.current.pause(); sfx.current = null; }
      restoreTiles();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div ref={warpRef} style={{
      position: 'absolute', inset: 0, zIndex: 40, opacity: 0, pointerEvents: 'none',
      transition: 'opacity 1.1s ease', background: NIGHT, overflow: 'hidden', perspective: 800,
    }}>
      {STARS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', left: s.left, top: s.top, width: s.size, height: s.size,
          borderRadius: '50%', background: '#dff0ff', opacity: 0.5,
          animation: `nlw-twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
        }} />
      ))}

      {/* aurores */}
      <div style={{ position: 'absolute', left: '-20%', top: '6%', width: '140%', height: '34%', filter: 'blur(26px)', opacity: 0.55, transformOrigin: '50% 0%', background: 'linear-gradient(180deg, rgba(94,224,160,.55), rgba(80,170,255,.12) 70%, transparent)', animation: 'nlw-aurora 11s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', left: '-20%', top: 0, width: '140%', height: '26%', filter: 'blur(34px)', opacity: 0.4, transformOrigin: '50% 0%', background: 'linear-gradient(180deg, rgba(140,255,210,.5), transparent 80%)', animation: 'nlw-aurora 15s ease-in-out -4s infinite' }} />

      {/* LE TROU NOIR : halo · disque d'accrétion (2 anneaux contra-rotatifs) ·
          anneau photonique · horizon des événements · jet polaire */}
      <div ref={holeRef} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: 'scale(0)', opacity: 0, transformStyle: 'preserve-3d' }}>
        <div style={{ position: 'absolute', left: -190, top: -190, width: 380, height: 380, borderRadius: '50%', filter: 'blur(12px)', background: 'radial-gradient(closest-side, rgba(120,190,255,.22), rgba(94,224,160,.10) 52%, transparent 76%)', animation: 'nlw-breathe 3.4s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', left: -140, top: -140, width: 280, height: 280, transform: 'rotateX(72deg)' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%', filter: 'blur(3px)', animation: 'nlw-spin 4.6s linear infinite',
            background: 'conic-gradient(from 0deg, rgba(94,224,160,0) 0deg, rgba(94,224,160,.85) 60deg, rgba(223,255,255,1) 105deg, rgba(159,216,255,.8) 160deg, rgba(60,120,220,.35) 240deg, rgba(94,224,160,0) 330deg)',
            mask: 'radial-gradient(closest-side, transparent 40%, #000 50%, #000 82%, transparent 97%)',
            WebkitMaskImage: 'radial-gradient(closest-side, transparent 40%, #000 50%, #000 82%, transparent 97%)',
          }} />
          <div style={{
            position: 'absolute', inset: 34, borderRadius: '50%', filter: 'blur(2px)', opacity: 0.9, animation: 'nlw-spin-rev 2.4s linear infinite',
            background: 'conic-gradient(from 120deg, transparent 0deg, rgba(255,255,255,.95) 70deg, rgba(159,216,255,.55) 150deg, transparent 260deg)',
            mask: 'radial-gradient(closest-side, transparent 52%, #000 62%, #000 88%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(closest-side, transparent 52%, #000 62%, #000 88%, transparent 100%)',
          }} />
        </div>
        <div style={{ position: 'absolute', left: -74, top: -74, width: 148, height: 148, borderRadius: '50%', border: '2px solid rgba(214,244,255,.95)', boxShadow: '0 0 22px rgba(159,216,255,.75), inset 0 0 26px rgba(120,190,255,.45)', animation: 'nlw-photon 2.1s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', left: -68, top: -68, width: 136, height: 136, borderRadius: '50%', background: 'radial-gradient(closest-side, #000 68%, #01030a 88%, rgba(3,6,14,0) 100%)', boxShadow: 'inset 0 0 30px #000' }} />
        <div style={{ position: 'absolute', left: -9, top: -260, width: 18, height: 520, filter: 'blur(9px)', opacity: 0.7, background: 'linear-gradient(180deg, transparent, rgba(159,216,255,.30) 22%, rgba(223,255,255,.55) 50%, rgba(159,216,255,.30) 78%, transparent)', animation: 'nlw-breathe 2.8s ease-in-out infinite' }} />
      </div>

      <div ref={shockRef} style={{ position: 'absolute', left: '50%', top: '50%', width: 300, height: 300, margin: '-150px 0 0 -150px', borderRadius: '50%', border: '3px solid rgba(214,244,255,.9)', boxShadow: '0 0 30px rgba(159,216,255,.7)', opacity: 0, pointerEvents: 'none' }} />
      <div ref={burstRef} style={{ position: 'absolute', left: '50%', top: '50%', width: 420, height: 420, margin: '-210px 0 0 -210px', borderRadius: '50%', filter: 'blur(4px)', opacity: 0, pointerEvents: 'none', background: 'radial-gradient(closest-side, rgba(255,255,255,.95), rgba(159,216,255,.5) 34%, rgba(94,224,160,.18) 58%, transparent 76%)' }} />

      {/* la cassette. Son style inline est piloté en JS (opacity / animation /
          pointerEvents) : rien de dynamique côté React ici, sinon un re-render
          écraserait la flottaison. L'atténuation pendant le drag est portée par
          les children. */}
      <div ref={cassRef} {...cassetteProps} style={{
        position: 'absolute', left: '50%', top: '50%', width: 250, height: 181, margin: '-92px 0 0 -125px',
        borderRadius: 12, overflow: 'hidden', cursor: 'grab', touchAction: 'none',
        pointerEvents: 'none', opacity: 0, transformStyle: 'preserve-3d',
        filter: 'drop-shadow(0 14px 28px rgba(0,0,0,.7)) drop-shadow(0 0 20px rgba(94,224,160,.45))',
      }}>
        {children}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'screen', background: 'linear-gradient(180deg, rgba(159,216,255,.16), transparent 40%, rgba(94,224,160,.14))' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, height: '38%', pointerEvents: 'none', mixBlendMode: 'screen', background: 'linear-gradient(180deg, transparent, rgba(223,255,255,.22), transparent)', animation: 'nlw-scan 3.6s linear infinite' }} />
      </div>

      <div ref={hintRef} style={{
        position: 'absolute', left: 0, right: 0, top: 'calc(50% + 108px)', textAlign: 'center',
        fontFamily: "'VT323', monospace", fontSize: 20, letterSpacing: 3, color: '#5EE0A0',
        textShadow: '0 0 10px rgba(94,224,160,.6)', display: 'none',
        animation: 'nlw-hint 1.8s ease-in-out infinite',
      }}>GLISSE-MOI DANS LE CURIOSCOPE →</div>
    </div>
  );
}
