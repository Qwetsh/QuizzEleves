import { describe, it, expect } from 'vitest';
import {
  HERO, comboMult, judgeHit, scoreHit, beamFromScores, finalWinner, buildChart,
} from '../logic/spellHero.js';

// RNG déterministe (mulberry32) pour tester la génération de partition.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pool synthétique : 6 catégories × 5 sorts, chacun 2 événements traçables
// (le label encode l'incantation → on peut vérifier la clé de réponse).
function makePool() {
  const cats = ['a', 'b', 'c', 'd', 'e', 'f'];
  const pool = [];
  for (const cat of cats) {
    for (let i = 0; i < 5; i++) {
      const inc = `${cat.toUpperCase()}${i}`;
      pool.push({
        incantation: inc, nomFr: inc, cat,
        events: [{ label: `${inc}-ev1` }, { label: `${inc}-ev2` }],
      });
    }
  }
  return pool;
}

describe('judgeHit — fenêtres de timing', () => {
  it('Parfait dans la fenêtre serrée (des deux côtés de la ligne)', () => {
    expect(judgeHit(0, true).verdict).toBe('perfect');
    expect(judgeHit(HERO.PERFECT_MS, true).verdict).toBe('perfect');
    expect(judgeHit(-HERO.PERFECT_MS, true).verdict).toBe('perfect');
  });
  it('Bien juste au-delà du Parfait, jusqu’à la fenêtre large', () => {
    expect(judgeHit(HERO.PERFECT_MS + 1, true).verdict).toBe('good');
    expect(judgeHit(HERO.GOOD_MS, true).verdict).toBe('good');
  });
  it('Raté (bon sort mais hors fenêtre)', () => {
    expect(judgeHit(HERO.GOOD_MS + 1, true).verdict).toBe('late');
    expect(judgeHit(9999, true).base).toBe(0);
  });
  it('Mauvais sort → wrong quel que soit le timing', () => {
    expect(judgeHit(0, false).verdict).toBe('wrong');
    expect(judgeHit(0, false).base).toBe(0);
  });
});

describe('comboMult — paliers', () => {
  it('×1 en dessous du premier palier, puis ×2/×3/×4', () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(4)).toBe(1);
    expect(comboMult(5)).toBe(2);
    expect(comboMult(9)).toBe(2);
    expect(comboMult(10)).toBe(3);
    expect(comboMult(19)).toBe(3);
    expect(comboMult(20)).toBe(4);
    expect(comboMult(999)).toBe(4);
  });
});

describe('scoreHit — série + multiplicateur', () => {
  it('un Parfait incrémente la série et applique le multiplicateur', () => {
    // 5e coup consécutif → série 5 → ×2.
    const r = scoreHit(0, true, 4);
    expect(r.combo).toBe(5);
    expect(r.mult).toBe(2);
    expect(r.points).toBe(HERO.PERFECT_PTS * 2);
  });
  it('un Bien rapporte moins mais tient la série', () => {
    const r = scoreHit(HERO.GOOD_MS, true, 0);
    expect(r.verdict).toBe('good');
    expect(r.combo).toBe(1);
    expect(r.points).toBe(HERO.GOOD_PTS);
  });
  it('un raté (mauvais sort ou hors fenêtre) casse la série', () => {
    expect(scoreHit(0, false, 12).combo).toBe(0);
    expect(scoreHit(0, false, 12).points).toBe(0);
    expect(scoreHit(9999, true, 12).combo).toBe(0);
  });
});

describe('beamFromScores — rai depuis l’écart de score', () => {
  it('centre à égalité', () => {
    expect(beamFromScores(0, 0).pos).toBe(50);
    expect(beamFromScores(300, 300).pos).toBe(50);
  });
  it('l’attaquant qui mène pousse vers 100, K.O. à l’écart plein', () => {
    expect(beamFromScores(HERO.KO_DIFF, 0).pos).toBe(100);
    expect(beamFromScores(HERO.KO_DIFF, 0).winner).toBe('attacker');
  });
  it('le défenseur qui mène pousse vers 0, K.O. symétrique', () => {
    expect(beamFromScores(0, HERO.KO_DIFF).pos).toBe(0);
    expect(beamFromScores(0, HERO.KO_DIFF).winner).toBe('defender');
  });
  it('clampe au-delà de l’écart K.O. (pas de vainqueur avant la borne)', () => {
    expect(beamFromScores(HERO.KO_DIFF * 3, 0).pos).toBe(100);
    expect(beamFromScores(200, 0).winner).toBeNull();
  });
});

describe('finalWinner — départage de fin', () => {
  it('meilleur score gagne', () => {
    expect(finalWinner(500, 300)).toBe('attacker');
    expect(finalWinner(300, 500)).toBe('defender');
  });
  it('égalité → défenseur (statu quo)', () => {
    expect(finalWinner(400, 400)).toBe('defender');
  });
});

describe('buildChart — génération de partition', () => {
  it('renvoie null si le pool est trop pauvre', () => {
    expect(buildChart([], {}, mulberry32(1))).toBeNull();
    expect(buildChart(makePool().slice(0, 3), {}, mulberry32(1))).toBeNull();
  });

  it('structure : bonnes dimensions (vagues, main, notes, durée)', () => {
    const chart = buildChart(makePool(), {}, mulberry32(42));
    expect(chart).toBeTruthy();
    expect(chart.waves).toHaveLength(HERO.WAVES);
    for (const w of chart.waves) expect(w.spells).toHaveLength(HERO.HAND);
    expect(chart.notes).toHaveLength(HERO.WAVES * HERO.NOTES_PER_WAVE);
    const last = chart.notes[chart.notes.length - 1];
    expect(chart.duration).toBe(last.t + HERO.TAIL_MS);
  });

  it('déterminisme : même seed → partition identique', () => {
    const a = buildChart(makePool(), {}, mulberry32(7));
    const b = buildChart(makePool(), {}, mulberry32(7));
    expect(a).toEqual(b);
  });

  it('temps strictement croissants (notes qui s’enchaînent)', () => {
    const chart = buildChart(makePool(), {}, mulberry32(3));
    for (let i = 1; i < chart.notes.length; i++) {
      expect(chart.notes[i].t).toBeGreaterThan(chart.notes[i - 1].t);
    }
  });

  it('clé de réponse : chaque note pointe un sort valide de SA vague, et le label lui appartient', () => {
    const pool = makePool();
    const byInc = Object.fromEntries(pool.map((s) => [s.incantation, s]));
    const chart = buildChart(pool, {}, mulberry32(99));
    for (const note of chart.notes) {
      const idx = chart.key[note.id];
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(HERO.HAND);
      const spellRef = chart.waves[note.wave].spells[idx];
      const spell = byInc[spellRef.incantation];
      const labels = spell.events.map((e) => e.label);
      // Le label tombé DOIT être un événement du sort désigné par la clé.
      expect(labels).toContain(note.label);
    }
  });

  it('chaque note a une clé (couverture complète)', () => {
    const chart = buildChart(makePool(), {}, mulberry32(11));
    for (const note of chart.notes) {
      expect(chart.key).toHaveProperty(String(note.id));
    }
  });
});
