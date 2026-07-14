// Reconnaissance des runes ($1 Unistroke, logic/gestures.js) : gabarits propres,
// robustesse aux transformations, discrimination croisée, rejets, seuil.
// Tests 100 % DÉTERMINISTES : le « bruit » est une pseudo-noise sinusoïdale.
import { RUNES, RUNE_KEYS } from '../data/runes.js';
import { recognizeRune } from '../logic/gestures.js';

// Pseudo-bruit déterministe dans (-1, 1) — pas de Math.random.
const noise = (i) => (Math.sin(i * 12.9898) * 43758.5453) % 1;

// Transformation d'un gabarit : rotation (degrés, autour du centre 50,50 du
// repère des runes) → échelle → translation → jitter (amplitude en unités
// finales). Simule un tracé au doigt décalé/agrandi/penché/tremblant.
function transform(pts, { dx = 0, dy = 0, scale = 1, rot = 0, jitter = 0 } = {}) {
  const a = (rot * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return pts.map((p, i) => {
    const x = p.x - 50, y = p.y - 50;
    return {
      x: (x * cos - y * sin + 50) * scale + dx + jitter * noise(i * 2 + 1),
      y: (x * sin + y * cos + 50) * scale + dy + jitter * noise(i * 2 + 2),
    };
  });
}

describe('recognizeRune — gabarits propres', () => {
  for (const key of RUNE_KEYS) {
    it(`reconnaît « ${key} » (variants[0]) avec un score > 0.9`, () => {
      const res = recognizeRune(RUNES[key].variants[0]);
      expect(res).not.toBeNull();
      expect(res.key).toBe(key);
      expect(res.score).toBeGreaterThan(0.9);
    });
  }
});

describe('recognizeRune — robustesse aux transformations', () => {
  for (const key of RUNE_KEYS) {
    for (const rot of [-15, 15]) {
      it(`« ${key} » translaté +200/+300, ×2.5, tourné de ${rot}°, jitter ±2 → reconnu au seuil 0.8`, () => {
        const pts = transform(RUNES[key].variants[0], { dx: 200, dy: 300, scale: 2.5, rot, jitter: 2 });
        const res = recognizeRune(pts, { threshold: 0.8 });
        expect(res).not.toBeNull();
        expect(res.key).toBe(key);
      });
    }
  }
});

describe('recognizeRune — discrimination entre les 8 runes', () => {
  // Seuil 0 : on veut la MEILLEURE clé, quelle qu'elle soit — aucune confusion
  // croisée tolérée entre les gabarits légèrement tournés.
  for (const key of RUNE_KEYS) {
    for (const rot of [-10, 10]) {
      it(`« ${key} » tourné de ${rot}° n'est confondu avec aucune autre rune`, () => {
        const res = recognizeRune(transform(RUNES[key].variants[0], { rot }), { threshold: 0 });
        expect(res?.key).toBe(key);
      });
    }
  }
});

describe('recognizeRune — rejets défensifs', () => {
  it('rejette un tracé trop court (3 points)', () => {
    expect(recognizeRune([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }])).toBeNull();
  });

  it('rejette des points tous identiques (tap immobile) sans throw', () => {
    const pts = Array.from({ length: 20 }, () => ({ x: 42, y: 42 }));
    expect(recognizeRune(pts)).toBeNull();
  });

  it('rejette un gribouillis pseudo-aléatoire au seuil 0.95', () => {
    // Marche pseudo-aléatoire de 40 points ($1 matche toujours QUELQUE CHOSE :
    // c'est le seuil qui filtre, d'où le threshold serré ici).
    let x = 50, y = 50;
    const scribble = Array.from({ length: 40 }, (_, i) => {
      x += 12 * noise(i * 2 + 1);
      y += 12 * noise(i * 2 + 2);
      return { x, y };
    });
    expect(recognizeRune(scribble, { threshold: 0.95 })).toBeNull();
  });
});

describe('recognizeRune — respect du seuil', () => {
  it('un tracé moyen (0.8 < score < 0.95) passe au seuil 0.8 mais pas à 0.99', () => {
    const pts = transform(RUNES.cercle.variants[0], { jitter: 5 });
    const best = recognizeRune(pts, { threshold: -Infinity });
    expect(best.score).toBeGreaterThan(0.8);
    expect(best.score).toBeLessThan(0.95);
    expect(recognizeRune(pts, { threshold: 0.8 })?.key).toBe('cercle');
    expect(recognizeRune(pts, { threshold: 0.99 })).toBeNull();
  });
});
