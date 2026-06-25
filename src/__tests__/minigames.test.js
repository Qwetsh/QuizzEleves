// Valide le système de mini-jeux de duel piloté par les données : chaque thème
// résout un moteur + un contenu valides ; ajouter un thème ne casse rien ; et le
// générateur de plannings BubbleHunt produit DEUX plannings équitables mais
// distincts (anti-triche : pas les mêmes mots au même instant).
import { describe, it, expect } from 'vitest';
import { getMinigame, getDefaultMinigame, MINIGAME_THEMES } from '../components/Fight/minigames';
import { makeSchedules } from '../components/Fight/minigames/bubbleSchedule.js';

describe('mini-jeux — registre piloté par les données', () => {
  it('chaque thème résout un Composant + des libellés', () => {
    expect(MINIGAME_THEMES.length).toBeGreaterThanOrEqual(8);
    for (const theme of MINIGAME_THEMES) {
      const mg = getMinigame(theme);
      expect(typeof mg.Component).toBe('function');
      expect(typeof mg.name).toBe('string');
      expect(typeof mg.rules).toBe('string');
      expect(mg.howto && typeof mg.howto.goal).toBe('string');
    }
  });

  it('un thème inconnu retombe sur le duel générique', () => {
    expect(getMinigame('inexistant').Component).toBe(getDefaultMinigame().Component);
  });

  it('les nouveaux thèmes réutilisent un moteur existant avec leur contenu', () => {
    const films = getMinigame('films');
    expect(films.content.length).toBeGreaterThan(5);
    expect(films.content.every((e) => typeof e.name === 'string' && typeof e.year === 'number')).toBe(true);

    const jv = getMinigame('jeuxvideo');
    expect(Array.isArray(jv.content)).toBe(true);
    expect(jv.content[0].good.length).toBeGreaterThan(3);
    expect(jv.content[0].bad.length).toBeGreaterThan(3);

    // Preuve de réutilisation : films partage le moteur de histoire, jeuxvideo celui d'anglais.
    expect(films.Component).toBe(getMinigame('histoire').Component);
    expect(jv.Component).toBe(getMinigame('anglais').Component);
  });
});

describe('BubbleHunt — anti-triche (2 plannings)', () => {
  const challenge = {
    id: 'test', prompt: '?',
    good: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'],
    bad: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'],
  };

  it('même structure de temps + même nombre de bonnes (équité)', () => {
    const { attacker, defender } = makeSchedules(challenge);
    expect(attacker.length).toBe(defender.length);
    expect(attacker.length).toBeGreaterThan(5);
    const goodA = attacker.filter((b) => b.good).length;
    const goodB = defender.filter((b) => b.good).length;
    expect(goodA).toBe(goodB); // difficulté identique
    // mêmes instants/positions (squelette partagé)
    for (let i = 0; i < attacker.length; i++) {
      expect(attacker[i].t).toBe(defender[i].t);
      expect(attacker[i].x).toBe(defender[i].x);
    }
  });

  it('labels tirés des bons pools, et contenu globalement différent entre les deux', () => {
    // Sur plusieurs tirages, au moins un diffère (mots/placement indépendants).
    let everDifferent = false;
    for (let r = 0; r < 5 && !everDifferent; r++) {
      const { attacker, defender } = makeSchedules(challenge);
      for (let i = 0; i < attacker.length; i++) {
        const a = attacker[i], d = defender[i];
        expect(a.good ? challenge.good : challenge.bad).toContain(a.label);
        expect(d.good ? challenge.good : challenge.bad).toContain(d.label);
        if (a.label !== d.label || a.good !== d.good) everDifferent = true;
      }
    }
    expect(everDifferent).toBe(true);
  });
});
