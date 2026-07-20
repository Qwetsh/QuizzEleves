// Moteur pur du « Cyber-duel » (Hacking) : sélection d'énigme (langage + niveau,
// anti-répétition, repli niveau voisin) et logique de remplissage des trous (dans
// l'ordre, bon/mauvais token, résolution au dernier). Fixture INLINE : ne dépend
// pas du vrai hackPuzzles.json (produit en parallèle).
import { describe, it, expect } from 'vitest';
import {
  languagesOf, pickPuzzle, createHackState, fillBlank, breachPct, renderTokens, blankCount,
} from '../logic/hackPuzzle.js';

// Deux langages, plusieurs niveaux — assez pour l'anti-répétition et le repli.
const PUZZLES = [
  { id: 'py1a', lang: 'python', level: 1, title: 'A', titleEn: 'A', lines: ['x = §0'], blanks: [{ answer: 'os', choices: ['os', 'io', 'sys', 're'] }] },
  { id: 'py1b', lang: 'python', level: 1, title: 'B', titleEn: 'B', lines: ['y = §0'], blanks: [{ answer: 'sys', choices: ['os', 'io', 'sys', 're'] }] },
  { id: 'py2a', lang: 'python', level: 2, title: 'C', titleEn: 'C', lines: ['z = §0(§1)'], blanks: [{ answer: 'open', choices: ['open', 'read', 'load', 'exec'] }, { answer: 'p', choices: ['p', 'q', 'r', 's'] }] },
  { id: 'py3a', lang: 'python', level: 3, title: 'D', titleEn: 'D', lines: ['w = §0'], blanks: [{ answer: 'eval', choices: ['eval', 'exec', 'compile', 'run'] }] },
  { id: 'js1a', lang: 'javascript', level: 1, title: 'E', titleEn: 'E', lines: ['const a = §0'], blanks: [{ answer: 'fetch', choices: ['fetch', 'grab', 'get', 'load'] }] },
];

describe('hackPuzzle — languagesOf', () => {
  it('liste les langages présents, triés et dédupliqués', () => {
    expect(languagesOf(PUZZLES)).toEqual(['javascript', 'python']);
    expect(languagesOf([])).toEqual([]);
    expect(languagesOf(null)).toEqual([]);
  });
});

describe('hackPuzzle — pickPuzzle (langage + niveau)', () => {
  it('respecte le langage et le niveau demandés', () => {
    const served = new Set();
    const p = pickPuzzle(PUZZLES, { lang: 'python', level: 2, served });
    expect(p.lang).toBe('python');
    expect(p.level).toBe(2);
    expect(p.id).toBe('py2a');
  });

  it('un langage sans énigme → null', () => {
    expect(pickPuzzle(PUZZLES, { lang: 'bash', level: 1, served: new Set() })).toBeNull();
  });

  it('anti-répétition : ne ressert pas une énigme déjà servie tant qu\'il en reste', () => {
    const served = new Set();
    const a = pickPuzzle(PUZZLES, { lang: 'python', level: 1, served });
    const b = pickPuzzle(PUZZLES, { lang: 'python', level: 1, served });
    expect(a.id).not.toBe(b.id); // py1a et py1b, dans un ordre quelconque
    expect(new Set([a.id, b.id])).toEqual(new Set(['py1a', 'py1b']));
  });

  it('pool d\'un niveau épuisé → on recycle CE niveau (les autres intacts)', () => {
    const served = new Set();
    pickPuzzle(PUZZLES, { lang: 'python', level: 1, served });
    pickPuzzle(PUZZLES, { lang: 'python', level: 1, served });
    // 3e tirage niveau 1 : les deux sont servies → recyclage, on ressert l'une.
    const c = pickPuzzle(PUZZLES, { lang: 'python', level: 1, served });
    expect(['py1a', 'py1b']).toContain(c.id);
    // le niveau 2 n'a pas été touché par le recyclage du niveau 1.
    expect(served.has('py2a')).toBe(false);
  });

  it('repli sur le niveau voisin le plus proche si le niveau visé est vide', () => {
    // javascript n'a QUE du niveau 1 ; demander le niveau 3 doit replier sur le 1.
    const p = pickPuzzle(PUZZLES, { lang: 'javascript', level: 3, served: new Set() });
    expect(p.id).toBe('js1a');
    expect(p.level).toBe(1);
  });

  it('rng injectable → tirage déterministe', () => {
    const served = new Set();
    const first = pickPuzzle(PUZZLES, { lang: 'python', level: 1, served, rng: () => 0 });
    expect(first.id).toBe('py1a'); // index 0 du pool niveau 1
  });
});

describe('hackPuzzle — fillBlank (remplissage dans l\'ordre)', () => {
  it('bon token → avance et n\'est pas encore résolu tant qu\'il reste des trous', () => {
    const st = createHackState(PUZZLES[2]); // py2a : 2 trous
    const v = fillBlank(st, 'open');
    expect(v).toEqual({ correct: true });
    expect(st.cur).toBe(1);
    expect(st.filled).toEqual(['open']);
    expect(st.solved).toBe(false);
  });

  it('dernier trou rempli → solved:true', () => {
    const st = createHackState(PUZZLES[2]);
    fillBlank(st, 'open');
    const v = fillBlank(st, 'p');
    expect(v).toEqual({ correct: true, solved: true });
    expect(st.solved).toBe(true);
    expect(st.filled).toEqual(['open', 'p']);
  });

  it('mauvais token → état INCHANGÉ', () => {
    const st = createHackState(PUZZLES[0]); // py1a : answer 'os'
    const v = fillBlank(st, 'io');
    expect(v).toEqual({ wrong: true });
    expect(st.cur).toBe(0);
    expect(st.filled).toEqual([]);
    expect(st.solved).toBe(false);
  });

  it('ordre imposé : seul le trou courant compte (répondre le 2e token d\'abord échoue)', () => {
    const st = createHackState(PUZZLES[2]); // trous : 'open' puis 'p'
    // 'p' est la bonne réponse du 2e trou, mais le trou courant est le 1er.
    expect(fillBlank(st, 'p')).toEqual({ wrong: true });
    expect(st.cur).toBe(0);
    // le bon token du trou courant avance normalement.
    expect(fillBlank(st, 'open')).toEqual({ correct: true });
  });

  it('énigme déjà résolue → wrong (plus de trou à remplir)', () => {
    const st = createHackState(PUZZLES[0]);
    fillBlank(st, 'os');
    expect(st.solved).toBe(true);
    expect(fillBlank(st, 'os')).toEqual({ wrong: true });
  });
});

describe('hackPuzzle — breach % et rendu des tokens', () => {
  it('breachPct progresse de 0 à 100 au fil des trous', () => {
    const st = createHackState(PUZZLES[2]); // 2 trous
    expect(breachPct(st)).toBe(0);
    fillBlank(st, 'open');
    expect(breachPct(st)).toBe(50);
    fillBlank(st, 'p');
    expect(breachPct(st)).toBe(100);
  });

  it('blankCount = nombre de trous', () => {
    expect(blankCount(PUZZLES[2])).toBe(2);
    expect(blankCount(PUZZLES[0])).toBe(1);
  });

  it('renderTokens découpe texte + trous, marque le trou courant et les remplis', () => {
    const seg = renderTokens(PUZZLES[2], ['open'], 1); // 1er rempli, trou courant = 1
    // ligne unique 'z = §0(§1)' → text 'z = ', blank0(filled), text '(', blank1(current), text ')'
    const line = seg[0];
    expect(line[0]).toEqual({ type: 'text', value: 'z = ' });
    expect(line[1]).toMatchObject({ type: 'blank', index: 0, filled: true, value: 'open', current: false });
    expect(line[2]).toEqual({ type: 'text', value: '(' });
    expect(line[3]).toMatchObject({ type: 'blank', index: 1, filled: false, current: true });
    expect(line[4]).toEqual({ type: 'text', value: ')' });
  });
});
