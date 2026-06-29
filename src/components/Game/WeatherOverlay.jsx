// Overlay « cérémonie météo » plein écran (TBI) : une SCÈNE animée dédiée par
// météo (particules + animations CSS, éclairs/fissures en SVG), lisible au fond
// de la classe. Grosse icône + nom + effet par-dessus la scène, son dédié, et
// auto-fermeture. Modèle de montage : ForgeCeremony (flag store + auto-close).
import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { weatherName, weatherDesc } from '../../data/weather';
import { getLang } from '../../i18n/lang';
import { soundThunder, soundWind, soundQuake, soundCharge } from '../../logic/sounds';
import '../../styles/weather.css';

// Durée de la scène (ms) par météo — le fondu CSS et le timer de fermeture sont
// alignés via la variable --wx-dur.
const DURATION = { orage: 3200, seisme: 3200, pluieMaudite: 3000, pluieAcide: 2800, soleil: 2600, vent: 2400 };

// Son joué selon la météo (clé `special`).
function playWeatherSound(special) {
  if (special === 'vent') return soundWind();
  if (special === 'orage') { soundThunder(); setTimeout(soundThunder, 900); return; }
  if (special === 'seisme') return soundQuake();
  if (special === 'soleil') return soundCharge();
  if (special === 'pluieAcide') { soundWind(); setTimeout(soundThunder, 240); return; }
  if (special === 'pluieMaudite') { soundWind(); setTimeout(soundThunder, 400); return; }
  return undefined;
}

const rnd = (a, b) => a + Math.random() * (b - a);

// Scène de particules dédiée à chaque météo.
function WeatherScene({ special, dir }) {
  const cfg = useMemo(() => {
    if (special === 'vent') {
      const toRight = dir !== 'contraire';
      return {
        streaks: Array.from({ length: 26 }, (_, i) => ({ id: i, top: `${rnd(4, 96)}%`, w: rnd(60, 220), delay: `${rnd(0, 1400)}ms`, dur: `${rnd(700, 1500)}ms` })),
        leaves: Array.from({ length: 12 }, (_, i) => ({ id: i, top: `${rnd(6, 90)}%`, delay: `${rnd(0, 1800)}ms`, dur: `${rnd(1500, 2600)}ms`, rot: rnd(-40, 40) })),
        toRight,
      };
    }
    if (special === 'soleil') {
      return { motes: Array.from({ length: 26 }, (_, i) => ({ id: i, left: `${rnd(0, 100)}%`, delay: `${rnd(0, 1600)}ms`, dur: `${rnd(1400, 2600)}ms`, size: rnd(5, 13) })) };
    }
    if (special === 'orage') {
      // Pas d'éclairs aléatoires : ce sont les VRAIS éclairs ciblés (OrageStrikes)
      // qui frappent les pions touchés. Ici, seulement la pluie battante.
      return {
        rain: Array.from({ length: 80 }, (_, i) => ({ id: i, left: `${rnd(-5, 100)}%`, delay: `${rnd(0, 1200)}ms`, dur: `${rnd(380, 680)}ms`, h: rnd(40, 80) })),
      };
    }
    if (special === 'pluieAcide') {
      return {
        rain: Array.from({ length: 64 }, (_, i) => ({ id: i, left: `${rnd(-5, 100)}%`, delay: `${rnd(0, 1300)}ms`, dur: `${rnd(520, 820)}ms`, h: rnd(34, 64) })),
        bubbles: Array.from({ length: 20 }, (_, i) => ({ id: i, left: `${rnd(0, 100)}%`, delay: `${rnd(0, 1800)}ms`, dur: `${rnd(1200, 2200)}ms`, size: rnd(8, 22) })),
      };
    }
    if (special === 'seisme') {
      return {
        cracks: Array.from({ length: 6 }, (_, i) => ({ id: i, rot: i * 60 + rnd(-15, 15), delay: `${i * 70}ms`, pts: ['50,50', ...Array.from({ length: 5 }, (__, k) => `${50 + (k + 1) * 9},${50 + (k % 2 ? 1 : -1) * rnd(3, 10)}`)].join(' ') })),
        debris: Array.from({ length: 16 }, (_, i) => ({ id: i, left: `${rnd(0, 100)}%`, delay: `${rnd(0, 1400)}ms`, dur: `${rnd(700, 1300)}ms`, size: rnd(10, 22), rot: rnd(-180, 180) })),
      };
    }
    if (special === 'pluieMaudite') {
      const glyphs = ['✦', '☠️', '🔮', '⚰️', '👁️', '🕸️'];
      return {
        rain: Array.from({ length: 54 }, (_, i) => ({ id: i, left: `${rnd(-5, 100)}%`, delay: `${rnd(0, 1400)}ms`, dur: `${rnd(520, 880)}ms`, h: rnd(34, 64) })),
        runes: Array.from({ length: 16 }, (_, i) => ({ id: i, left: `${rnd(2, 96)}%`, delay: `${rnd(0, 2000)}ms`, dur: `${rnd(1600, 2600)}ms`, g: glyphs[i % glyphs.length], size: rnd(20, 40) })),
      };
    }
    return {};
  }, [special, dir]);

  if (special === 'vent') {
    return (
      <div className={`wx-scene wx-scene-vent ${cfg.toRight ? 'to-right' : 'to-left'}`} aria-hidden="true">
        {cfg.streaks.map((s) => <span key={s.id} className="wx-streak" style={{ top: s.top, width: s.w, animationDelay: s.delay, animationDuration: s.dur }} />)}
        {cfg.leaves.map((l) => <span key={`l${l.id}`} className="wx-leaf" style={{ top: l.top, animationDelay: l.delay, animationDuration: l.dur, '--rot': `${l.rot}deg` }}>🍃</span>)}
      </div>
    );
  }
  if (special === 'soleil') {
    return (
      <div className="wx-scene wx-scene-soleil" aria-hidden="true">
        <div className="wx-sun-rays" />
        <div className="wx-sun-core" />
        {cfg.motes.map((m) => <span key={m.id} className="wx-mote" style={{ left: m.left, width: m.size, height: m.size, animationDelay: m.delay, animationDuration: m.dur }} />)}
      </div>
    );
  }
  if (special === 'orage' || special === 'pluieAcide' || special === 'pluieMaudite') {
    const cls = special === 'orage' ? 'wx-scene-orage' : special === 'pluieAcide' ? 'wx-scene-acide' : 'wx-scene-maudite';
    return (
      <div className={`wx-scene ${cls}`} aria-hidden="true">
        <div className="wx-clouds" />
        {cfg.rain.map((d) => <span key={d.id} className="wx-rainline" style={{ left: d.left, height: d.h, animationDelay: d.delay, animationDuration: d.dur }} />)}
        {special === 'pluieAcide' && cfg.bubbles.map((b) => <span key={`b${b.id}`} className="wx-bubble" style={{ left: b.left, width: b.size, height: b.size, animationDelay: b.delay, animationDuration: b.dur }} />)}
        {special === 'pluieMaudite' && cfg.runes.map((r) => <span key={`r${r.id}`} className="wx-rune" style={{ left: r.left, fontSize: r.size, animationDelay: r.delay, animationDuration: r.dur }}>{r.g}</span>)}
      </div>
    );
  }
  if (special === 'seisme') {
    return (
      <div className="wx-scene wx-scene-seisme" aria-hidden="true">
        <svg className="wx-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
          {cfg.cracks.map((c) => (
            <g key={c.id} transform={`rotate(${c.rot} 50 50)`}>
              <polyline className="wx-crack" points={c.pts} style={{ animationDelay: c.delay }} />
            </g>
          ))}
        </svg>
        <div className="wx-dust" />
        {cfg.debris.map((d) => <span key={d.id} className="wx-rock" style={{ left: d.left, width: d.size, height: d.size, animationDelay: d.delay, animationDuration: d.dur, '--rot': `${d.rot}deg` }} />)}
      </div>
    );
  }
  return null;
}

// Orage : VRAIS éclairs qui tombent sur les pions touchés (capturés à l'écran via
// data-pawn-idx, comme le VFX Foudre). Si personne n'est sur une case frappée,
// aucun éclair ne touche un pion → on voit clairement qui est épargné.
function OrageStrikes({ strikes }) {
  const [bolts, setBolts] = useState([]);
  useEffect(() => {
    if (!strikes?.length) { setBolts([]); return; }
    const out = [];
    strikes.forEach((idx, k) => {
      const el = document.querySelector(`[data-pawn-idx="${idx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const tx = r.left + r.width / 2;
      const ty = r.top + r.height / 2;
      const segs = 9;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const j = (i === 0 || i === segs) ? 0 : (Math.sin(i * 2.3) * 22 + (Math.random() - 0.5) * 30) * (1 - t * 0.3);
        pts.push(`${tx + j},${t * ty}`);
      }
      out.push({ idx, tx, ty, points: pts.join(' '), delay: `${k * 170}ms` });
    });
    setBolts(out);
  }, [strikes]);

  if (!bolts.length) return null;
  return (
    <div className="wx-strikes" aria-hidden="true">
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <filter id="wx-strike-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {bolts.map((b) => (
          <g key={b.idx} style={{ animationDelay: b.delay }} className="wx-strike-g">
            <polyline points={b.points} className="wx-strike-halo" filter="url(#wx-strike-glow)" />
            <polyline points={b.points} className="wx-strike-core" filter="url(#wx-strike-glow)" />
          </g>
        ))}
      </svg>
      {bolts.map((b) => (
        <div key={`f${b.idx}`} className="wx-strike-flash" style={{ animationDelay: b.delay, background: `radial-gradient(circle at ${b.tx}px ${b.ty}px, rgba(255,255,255,0.95), rgba(200,220,255,0.5) 9%, rgba(120,150,220,0.12) 18%, transparent 26%)` }} />
      ))}
      {bolts.map((b) => (
        <div key={`r${b.idx}`} className="wx-strike-ring" style={{ left: b.tx, top: b.ty, animationDelay: b.delay }} />
      ))}
    </div>
  );
}

export default function WeatherOverlay() {
  const cer = useGameStore((s) => s.weatherCeremony);
  const close = useGameStore((s) => s.closeWeatherCeremony);
  const lang = getLang();
  const dur = DURATION[cer?.special] ?? 2600;

  useEffect(() => {
    if (!cer) return undefined;
    const tSound = setTimeout(() => playWeatherSound(cer.special), 120);
    const tClose = setTimeout(() => close(), dur);
    return () => { clearTimeout(tSound); clearTimeout(tClose); };
  }, [cer, close, dur]);

  if (!cer) return null;
  const isOrage = cer.special === 'orage';
  const cls = `wx-overlay wx-${cer.special} wx-tone-${cer.tone || 'malus'}${isOrage ? ' wx-overlay--light' : ''}`;
  return (
    <div className={cls} role="dialog" aria-label={weatherName(cer.id, lang)} style={{ '--wx-dur': `${dur}ms` }}>
      <WeatherScene special={cer.special} dir={cer.dir} />
      {isOrage && <OrageStrikes strikes={cer.strikes} />}
      {/* Orage : pas de grosse carte centrale (elle masque le plateau et la foudre
          qui frappe les pions) → simple étiquette discrète en haut. */}
      {isOrage ? (
        <div className="wx-toplabel">{cer.icon} {weatherName(cer.id, lang)}</div>
      ) : (
        <div className="wx-stage">
          <div className="wx-icon">{cer.icon}</div>
          <div className="wx-name">{weatherName(cer.id, lang)}</div>
          <div className="wx-desc">{weatherDesc(cer.id, lang)}</div>
        </div>
      )}
    </div>
  );
}
