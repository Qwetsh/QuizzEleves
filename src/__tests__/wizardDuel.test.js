// Moteur pur du « Duel de sorciers » (beam struggle) : accumulation des
// poussées, clamp aux bornes, seuils de victoire (l'orbe touche un camp),
// remontada (les deux camps poussent), biais visuel et vérif de réponse.
import { describe, it, expect } from 'vitest';
import {
  createBeam, pushBeam, beamSideBias, isWin, checkAnswer, WIZARD_PUSH,
} from '../logic/wizardDuel.js';

describe('wizardDuel — état initial', () => {
  it('démarre au centre, sans vainqueur, avec la poussée par défaut', () => {
    const b = createBeam();
    expect(b.pos).toBe(50);
    expect(b.push).toBe(WIZARD_PUSH);
    expect(b.winner).toBeNull();
    expect(isWin(b)).toBe(false);
  });

  it('accepte une poussée personnalisée', () => {
    expect(createBeam({ push: 25 }).push).toBe(25);
  });
});

describe('wizardDuel — poussées et accumulation', () => {
  it('l\'attaquant pousse vers 100, le défenseur vers 0', () => {
    const b = createBeam({ push: 10 });
    expect(pushBeam(b, 'attacker').pos).toBe(60);
    expect(pushBeam(b, 'defender').pos).toBe(40);
  });

  it('les poussées s\'accumulent (immuable : l\'entrée n\'est pas mutée)', () => {
    const b = createBeam({ push: 10 });
    const b1 = pushBeam(b, 'attacker');
    const b2 = pushBeam(b1, 'attacker');
    expect(b.pos).toBe(50); // état d'origine intact
    expect(b1.pos).toBe(60);
    expect(b2.pos).toBe(70);
  });

  it('accepte un montant explicite qui prime sur la poussée de l\'état', () => {
    const b = createBeam({ push: 10 });
    expect(pushBeam(b, 'attacker', 30).pos).toBe(80);
    expect(pushBeam(b, 'defender', 5).pos).toBe(45);
  });
});

describe('wizardDuel — clamp et seuils de victoire', () => {
  it('l\'orbe est borné à [0, 100]', () => {
    const b = createBeam({ push: 40 });
    // 3 poussées attaquant = 50→90→130 clampé, mais 130 franchit 100 avant clamp
    const far = pushBeam(pushBeam(b, 'attacker'), 'attacker'); // 50→90→100
    expect(far.pos).toBe(100);
    expect(far.pos).toBeLessThanOrEqual(100);
  });

  it('orbe à 100 → l\'attaquant gagne (le défenseur est frappé)', () => {
    let b = createBeam({ push: 50 });
    b = pushBeam(b, 'attacker'); // 100
    expect(b.pos).toBe(100);
    expect(b.winner).toBe('attacker');
    expect(isWin(b)).toBe(true);
  });

  it('orbe à 0 → le défenseur gagne (l\'attaquant est frappé)', () => {
    let b = createBeam({ push: 50 });
    b = pushBeam(b, 'defender'); // 0
    expect(b.pos).toBe(0);
    expect(b.winner).toBe('defender');
  });

  it('l\'état est gelé après victoire (plus aucune poussée n\'a d\'effet)', () => {
    let b = createBeam({ push: 60 });
    b = pushBeam(b, 'attacker'); // → 100, winner attacker
    const frozen = pushBeam(b, 'defender', 40); // ignorée
    expect(frozen).toBe(b);
    expect(frozen.winner).toBe('attacker');
    expect(frozen.pos).toBe(100);
  });
});

describe('wizardDuel — remontada (les deux camps poussent)', () => {
  it('une avance peut être renversée', () => {
    let b = createBeam({ push: 20 });
    b = pushBeam(b, 'attacker'); // 70
    b = pushBeam(b, 'attacker'); // 90 (au bord de la défaite du défenseur)
    expect(b.pos).toBe(90);
    expect(b.winner).toBeNull();
    // le défenseur remonte
    b = pushBeam(b, 'defender'); // 70
    b = pushBeam(b, 'defender'); // 50
    b = pushBeam(b, 'defender'); // 30
    expect(b.pos).toBe(30);
    expect(b.winner).toBeNull();
  });
});

describe('wizardDuel — biais visuel et vérif de réponse', () => {
  it('beamSideBias : 0.5 au centre, → 1 côté attaquant, → 0 côté défenseur', () => {
    expect(beamSideBias(50)).toBe(0.5);
    expect(beamSideBias(100)).toBe(1);
    expect(beamSideBias(0)).toBe(0);
    expect(beamSideBias(75)).toBeGreaterThan(0.5);
    // valeur absente → centre (pas de crash)
    expect(beamSideBias(undefined)).toBe(0.5);
  });

  it('checkAnswer : compare l\'index à q.c, robuste au q absent', () => {
    const q = { a: ['A', 'B', 'C', 'D'], c: 2 };
    expect(checkAnswer(q, 2)).toBe(true);
    expect(checkAnswer(q, 0)).toBe(false);
    expect(checkAnswer(null, 2)).toBe(false);
  });
});
