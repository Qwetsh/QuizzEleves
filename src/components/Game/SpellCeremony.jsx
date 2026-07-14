// Cérémonie de lancement de sort (extension « Magie ») : overlay « spectacle »
// joué sur le TBI quand une équipe incante une séquence de runes. 100 % procédural
// (SVG/CSS) : un cercle magique se dessine, les glyphes des runes tracées
// apparaissent en orbite puis convergent — flash, révélation du sort et gerbe
// d'étincelles. Trois issues : 'cast' (sort connu), 'discover' (combinaison
// valide inconnue → fanfare dorée), 'fizzle' (séquence invalide → le cercle se
// brise dans un nuage de fumée). Sons Web Audio synchronisés (logic/sounds).
import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { RUNES } from '../../data/runes';
import { getLang } from '../../i18n/lang';
import { soundSpell, soundFizzle, soundSpellDiscover, soundClick, soundCharge } from '../../logic/sounds';
import '../../styles/magic-ceremony.css';

// Chronologie partagée JS/CSS (les délais CSS de magic-ceremony.css y font écho).
const T_GLYPH0 = 500;      // apparition du 1er glyphe
const T_GLYPH_STEP = 120;  // écart entre glyphes
const T_FLASH = 1600;      // flash de convergence (cast/discover)
const T_BANNER = 1860;     // bandeau « sort découvert »
const T_BREAK = 1050;      // brisure du cercle (fizzle)

// Arc de cercle SVG (angles en radians) — éclats de l'anneau brisé du fizzle.
const arcPath = (cx, cy, r, a0, a1) => {
  const px = (a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  return `M ${px(a0)} A ${r} ${r} 0 0 1 ${px(a1)}`;
};

export default function SpellCeremony() {
  const cer = useGameStore((s) => s.spellCeremony);
  const clear = useGameStore((s) => s.clearSpellCeremony);

  const fizzle = cer?.outcome === 'fizzle';
  const discover = cer?.outcome === 'discover';

  // Sons synchronisés sur la chronologie CSS + auto-clear.
  useEffect(() => {
    if (!cer) return undefined;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    if (cer.outcome === 'fizzle') {
      at(T_BREAK - 60, () => soundFizzle());
    } else {
      at(40, () => soundSpell()); // whoosh d'incantation
      (cer.runes || []).forEach((_, i) => at(T_GLYPH0 + i * T_GLYPH_STEP, () => soundClick())); // tick par glyphe
      at(T_FLASH, () => soundCharge()); // pétillant du flash
      if (cer.outcome === 'discover') at(T_BANNER, () => soundSpellDiscover());
    }
    at(cer.outcome === 'discover' ? 3000 : 2600, () => clear?.());
    return () => timers.forEach(clearTimeout);
  }, [cer, clear]);

  // Glyphes des runes : polyline (gabarit 0..100 de data/runes.js) + position en
  // orbite autour du cercle (--gx/--gy) + délai d'apparition en cascade (--d).
  const glyphs = useMemo(() => {
    const runes = (Array.isArray(cer?.runes) ? cer.runes : []).filter((k) => RUNES[k]?.variants?.[0]);
    const n = Math.max(runes.length, 1);
    return runes.map((key, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2; // départ en haut, sens horaire
      return {
        id: i,
        points: RUNES[key].variants[0].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
        x: `${Math.round(Math.cos(a) * 182)}px`,
        y: `${Math.round(Math.sin(a) * 182)}px`,
        delay: `${((T_GLYPH0 + i * T_GLYPH_STEP) / 1000).toFixed(2)}s`,
      };
    });
  }, [cer?.id]);

  // Gerbe d'étincelles de la révélation (même patron que forge-spark).
  const sparks = useMemo(() => Array.from({ length: 28 }).map((_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const d = 80 + Math.random() * 140;
    return { id: i, x: `${Math.cos(a) * d}px`, y: `${Math.sin(a) * d}px`, delay: `${Math.random() * 90}ms` };
  }), [cer?.id]);

  // Fizzle : éclats de l'anneau (dispersés vers l'extérieur) + bouffées de fumée.
  const shards = useMemo(() => {
    if (!fizzle) return [];
    return Array.from({ length: 8 }).map((_, i) => {
      const a0 = (i / 8) * Math.PI * 2 + 0.07;
      const a1 = a0 + Math.PI / 4 - 0.14;
      const mid = (a0 + a1) / 2;
      const d = 60 + Math.random() * 55;
      return {
        id: i,
        d: arcPath(210, 210, 150, a0, a1),
        sx: `${Math.round(Math.cos(mid) * d)}px`,
        sy: `${Math.round(Math.sin(mid) * d)}px`,
        sr: `${Math.round(-45 + Math.random() * 90)}deg`,
      };
    });
  }, [cer?.id, fizzle]);
  const smoke = useMemo(() => {
    if (!fizzle) return [];
    return Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      x: `${Math.round(-70 + Math.random() * 140)}px`,
      size: `${Math.round(46 + Math.random() * 44)}px`,
      delay: `${1280 + i * 90}ms`,
    }));
  }, [cer?.id, fizzle]);

  if (!cer) return null;
  const en = getLang() === 'en';
  const color = cer.color || '#8745d4';
  const name = (en ? cer.name_en : cer.name) || cer.name || '';

  return (
    <div
      key={cer.id}
      className={`magic-cer${fizzle ? ' is-fizzle' : ''}${discover ? ' is-discover' : ''}`}
      style={{ '--mc': color, '--out-delay': discover ? '2.6s' : '2.2s' }}
      role="dialog"
      aria-label={en ? 'Spell' : 'Sort'}
    >
      <div className="magic-cer-team">{cer.teamEmoji} {cer.teamName}</div>

      <div className="magic-cer-stage">
        {/* Cercle magique : double anneau + graduations (rotation lente) et
            hexagramme inscrit (contre-rotation). Tout se dessine au démarrage. */}
        <svg className="magic-circle" viewBox="0 0 420 420" width="420" height="420" aria-hidden="true">
          <g className="magic-rings">
            <circle className="magic-ring magic-ring-a" cx="210" cy="210" r="150" pathLength="100" />
            <circle className="magic-ring magic-ring-b" cx="210" cy="210" r="128" pathLength="100" />
            <circle className="magic-grads" cx="210" cy="210" r="139" pathLength="100" />
            <circle className="magic-dot" cx="210" cy="60" r="5" />
            <circle className="magic-dot" cx="360" cy="210" r="5" />
            <circle className="magic-dot" cx="210" cy="360" r="5" />
            <circle className="magic-dot" cx="60" cy="210" r="5" />
          </g>
          <g className="magic-rings-rev">
            <polygon className="magic-tri" points="210,92 312.2,269 107.8,269" />
            <polygon className="magic-tri" points="210,328 312.2,151 107.8,151" />
          </g>
          {fizzle && (
            <g className="magic-shards">
              {shards.map((sh) => (
                <path key={sh.id} className="magic-shard" d={sh.d} style={{ '--sx': sh.sx, '--sy': sh.sy, '--sr': sh.sr }} />
              ))}
            </g>
          )}
        </svg>

        {/* Glyphes des runes tracées, en orbite, qui se dessinent puis convergent. */}
        {glyphs.map((g) => (
          <div key={g.id} className="magic-glyph" style={{ '--gx': g.x, '--gy': g.y, '--d': g.delay }}>
            <svg viewBox="0 0 100 100" width="74" height="74" aria-hidden="true">
              <polyline className="magic-glyph-line" points={g.points} pathLength="100" />
            </svg>
          </div>
        ))}

        {!fizzle && <div className="magic-flash" />}

        {/* Révélation du sort : icône + nom + coût + gerbe d'étincelles. */}
        {!fizzle && (
          <div className="magic-result">
            <div className="magic-sparks">
              {sparks.map((s) => (
                <span key={s.id} className="magic-spark" style={{ '--x': s.x, '--y': s.y, '--sd': s.delay }} />
              ))}
            </div>
            <div className="magic-result-icon">{cer.icon || '✨'}</div>
            {name && <div className="magic-result-name">{name}</div>}
            {cer.cost != null && <div className="magic-result-cost">{'−'}{cer.cost} {'✨'}</div>}
          </div>
        )}

        {discover && <div className="magic-gold-ring" />}
        {discover && (
          <div className="magic-banner">
            {'✨'} {en ? 'New spell discovered!' : 'Nouveau sort découvert !'}
          </div>
        )}

        {/* Raté : fumée qui monte + texte penaud. */}
        {smoke.map((p) => (
          <span key={p.id} className="magic-smoke" style={{ '--x': p.x, '--sz': p.size, '--d': p.delay }} />
        ))}
        {fizzle && (
          <div className="magic-fizzle-text">
            <div className="magic-pfff">Pfff{'…'}</div>
            <div className="magic-fizzle-label">{en ? 'The spell fizzles' : 'Le sort échoue'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
