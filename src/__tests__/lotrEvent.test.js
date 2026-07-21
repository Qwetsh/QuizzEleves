// Logique de tirage des « Chroniques de la Terre du Milieu » (moteur mapevent) :
// une manche = un LIEU cible + 3 distracteurs (événements d'AUTRES lieux),
// mélangés. Invariants : la cible n'est jamais dans ses propres distracteurs ;
// 4 choix distincts ; la bonne réponse = l'événement du lieu cible ;
// anti-répétition (un lieu servi ne ressort qu'une fois le pool épuisé).
import { describe, it, expect } from 'vitest';
import { drawRound } from '../components/Fight/minigames/LotrEventDuel.jsx';

// Fixture inline (schéma partagé avec src/data/lotrEvents.js).
const FIXTURE = [
  { place: 'Fondcombe', x: 0.5, y: 0.4, event: "Le Conseil d'Elrond", eventEn: "The Council of Elrond" },
  { place: 'La Moria', x: 0.45, y: 0.5, event: 'La chute de Gandalf face au Balrog', eventEn: 'Gandalf falls before the Balrog' },
  { place: 'Minas Tirith', x: 0.7, y: 0.7, event: 'Le siège de la cité blanche', eventEn: 'The siege of the White City' },
  { place: 'La Comté', x: 0.2, y: 0.25, event: "L'anniversaire de Bilbon", eventEn: "Bilbo's birthday party" },
  { place: 'Le Mont Destin', x: 0.85, y: 0.75, event: "La destruction de l'Anneau", eventEn: 'The destruction of the One Ring' },
  { place: 'Isengard', x: 0.4, y: 0.55, event: "L'assaut des Ents", eventEn: 'The march of the Ents' },
];

describe('LotrEventDuel — logique de tirage (drawRound)', () => {
  it('produit 4 choix distincts dont la cible, la bonne réponse = event de la cible', () => {
    const served = new Set();
    const { target, choices } = drawRound(FIXTURE, served, Math.random);
    expect(choices).toHaveLength(4);
    // choix distincts (par lieu)
    const places = choices.map((c) => c.place);
    expect(new Set(places).size).toBe(4);
    // la cible fait partie des choix
    expect(places).toContain(target.place);
    // la bonne réponse est bien l'événement du lieu cible
    const good = choices.find((c) => c.place === target.place);
    expect(good.event).toBe(target.event);
  });

  it('la cible n\'est jamais dans ses propres distracteurs', () => {
    for (let i = 0; i < 40; i++) {
      const { target, choices } = drawRound(FIXTURE, new Set(), Math.random);
      const decoys = choices.filter((c) => c.place !== target.place);
      expect(decoys).toHaveLength(3);
      expect(decoys.every((d) => d.place !== target.place)).toBe(true);
      // les distracteurs sont bien des lieux du pool
      expect(decoys.every((d) => FIXTURE.some((e) => e.place === d.place))).toBe(true);
    }
  });

  it('anti-répétition : un lieu servi ne ressort pas tant que le pool n\'est pas épuisé', () => {
    const served = new Set();
    const seen = [];
    for (let i = 0; i < FIXTURE.length; i++) {
      const { target } = drawRound(FIXTURE, served, Math.random);
      seen.push(target.place);
    }
    // les N premiers tirages couvrent tous les lieux, sans répétition
    expect(new Set(seen).size).toBe(FIXTURE.length);
    // au tirage suivant, le pool est épuisé → il repart (served vidé puis re-rempli)
    const before = served.size;
    drawRound(FIXTURE, served, Math.random);
    expect(before).toBe(FIXTURE.length);
    expect(served.size).toBe(1); // reset puis une nouvelle cible ajoutée
  });

  it('déterministe avec un rng fixe (pas de Math.random imposé)', () => {
    // rng constant → tirages reproductibles (les tests n\'imposent pas de graine
    // au runtime, mais la fonction DOIT accepter un rng injecté).
    const rng = () => 0; // toujours le premier élément disponible
    const a = drawRound(FIXTURE, new Set(), rng);
    const b = drawRound(FIXTURE, new Set(), rng);
    expect(a.target.place).toBe(b.target.place);
    expect(a.choices.map((c) => c.place).sort()).toEqual(b.choices.map((c) => c.place).sort());
  });

  it('pool insuffisant (<4 lieux) → null (repli propre, pas de crash)', () => {
    expect(drawRound(FIXTURE.slice(0, 3), new Set(), Math.random)).toBeNull();
    expect(drawRound([], new Set(), Math.random)).toBeNull();
    expect(drawRound(undefined, new Set(), Math.random)).toBeNull();
  });

  it('ignore les entrées mal formées (sans place ou sans event)', () => {
    const dirty = [
      ...FIXTURE,
      { place: '', x: 0, y: 0, event: 'vide' },
      { x: 0.1, y: 0.1, event: 'sans lieu' },
      { place: 'Sans event', x: 0.2, y: 0.2 },
    ];
    const { choices } = drawRound(dirty, new Set(), Math.random);
    expect(choices.every((c) => c.place && c.event)).toBe(true);
  });
});
