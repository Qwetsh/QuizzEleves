// Valide le système de mini-jeux de duel piloté par les données : chaque thème
// résout un moteur + un contenu valides ; ajouter un thème ne casse rien ; et le
// générateur de plannings BubbleHunt produit DEUX plannings équitables mais
// distincts (anti-triche : pas les mêmes mots au même instant).
import { describe, it, expect, afterEach } from 'vitest';
import { getMinigame, getDefaultMinigame, MINIGAME_THEMES } from '../components/Fight/minigames';
import { makeSchedules } from '../components/Fight/minigames/bubbleSchedule.js';
import DeblurGame from '../components/Fight/minigames/DeblurGame.jsx';
import WhosThatPokemon from '../components/Fight/minigames/WhosThatPokemon.jsx';
import { setThemesData, resetThemesData } from '../data/themes.js';
import { useGameStore } from '../store/gameStore';

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
    const jv = getMinigame('jeux_video');
    expect(Array.isArray(jv.content)).toBe(true);
    expect(jv.content[0].good.length).toBeGreaterThan(3);
    expect(jv.content[0].bad.length).toBeGreaterThan(3);

    // Preuve de réutilisation : jeux_video partage le moteur (bubble) d'anglais.
    expect(jv.Component).toBe(getMinigame('anglais').Component);
  });

  it('le moteur Memory expose un contenu de paires { a, b }', () => {
    const mem = getMinigame('vocabulaire');
    expect(typeof mem.Component).toBe('function');
    expect(mem.content.length).toBeGreaterThanOrEqual(6);
    expect(mem.content.every((p) => typeof p.a === 'string' && typeof p.b === 'string')).toBe(true);
  });
});

// Cascade thème → ancêtres → générique (DESIGN_MINIGAMES.md §3) : un thème sans
// mini-jeu custom hérite de celui de sa catégorie via l'arbre quete_themes ; une
// entrée non jouable (curioscope sans spots) est SAUTÉE, pas court-circuitée.
describe('mini-jeux — cascade de repli par l\'arbre de thèmes', () => {
  afterEach(() => resetThemesData());

  const tree = {
    loisirs: { key: 'loisirs', path: 'loisirs', parentKey: null },
    // Nœud mixte : sa clé de thème diffère de son subjectKey câblé au registre.
    jv: { key: 'jv', path: 'loisirs.jv', parentKey: 'loisirs', subjectKey: 'jeux_video' },
    pokemon: { key: 'pokemon', path: 'loisirs.jv.pokemon', parentKey: 'jv', subjectKey: 'pokemon' },
    // WoW : câblé au registre (curioscope) mais injouable sans spots en DB.
    world_of_warcraft: { key: 'world_of_warcraft', path: 'loisirs.jv.world_of_warcraft', parentKey: 'jv', subjectKey: 'world_of_warcraft' },
  };

  it('un thème enfant sans mini-jeu hérite de celui de sa catégorie', () => {
    setThemesData({ themes: tree, roots: ['loisirs'] });
    const mg = getMinigame('pokemon');
    expect(mg.Component).toBe(getMinigame('jeux_video').Component); // bubble
    expect(mg.name).toBe('fight.mg.jeuxvideo.name'); // libellés de la catégorie
  });

  it('une entrée injouable (curioscope sans spots) est sautée au profit de l\'ancêtre', () => {
    setThemesData({ themes: tree, roots: ['loisirs'] });
    // Sans arbre : WoW sans spots → générique (test curioscope.test.js). Avec
    // l'arbre : la cascade continue vers la catégorie jeux vidéo (bubble).
    const mg = getMinigame('world_of_warcraft');
    expect(mg.Component).toBe(getMinigame('jeux_video').Component);
  });

  it('aucun ancêtre câblé → duel générique (et subject inconnu sans arbre aussi)', () => {
    setThemesData({ themes: { seul: { key: 'seul', path: 'seul', parentKey: null, subjectKey: 'seul' } }, roots: ['seul'] });
    expect(getMinigame('seul').Component).toBe(getDefaultMinigame().Component);
  });
});

// Moteur Deblur : jouable seulement si le pool de questions du thème contient
// des images ; fightPickImageQuestion ne pioche QUE des questions à image et
// tient son anti-répétition dans un namespace `img:` séparé du pool complet.
describe('mini-jeux — moteur Deblur (photo mystère)', () => {
  const QS = [
    { q: 'Quel est ce drapeau ?', a: ['Japon', 'Palaos', 'Bangladesh', 'Laos'], c: 0, img: 'https://x/jp.png' },
    { q: 'Question sans image', a: ['a', 'b', 'c', 'd'], c: 1 },
  ];
  const saved = { questions: useGameStore.getState().questions, askedQuestions: useGameStore.getState().askedQuestions };
  afterEach(() => useGameStore.setState({ questions: saved.questions, askedQuestions: saved.askedQuestions }));

  it('sans question à image chargée, le thème retombe sur le duel générique', () => {
    useGameStore.setState({ questions: {}, askedQuestions: {} });
    expect(getMinigame('drapeaux_symboles').Component).toBe(getDefaultMinigame().Component);
  });

  it('Drapeau éclair : course d\'images NETTES (imgrace = DeblurGame + sharp)', () => {
    // Décision utilisateur : pas de flou sur les drapeaux — image nette, pure
    // rapidité. Le composant est partagé avec deblur, différencié par props.
    useGameStore.setState({ questions: { drapeaux_symboles: QS }, askedQuestions: {} });
    const mg = getMinigame('drapeaux_symboles');
    expect(mg.Component).toBe(DeblurGame);
    expect(mg.props).toEqual({ sharp: true });
    expect(mg.content.fromQuestions).toBe('drapeaux_symboles');
    expect(mg.name).toBe('fight.mg.drapeaux.name');
    expect(mg.rules).toBe('fight.mg.imgrace.rules');
  });

  it('Pokémon N\'utilise PAS le Deblur : moteur silhouette dédié (plateau TV)', () => {
    useGameStore.setState({
      questions: { pokemon_silhouette: [{ q: 'Qui est ce Pokémon ?', a: ['Pikachu', 'Salamèche', 'Bulbizarre', 'Carapuce'], c: 0, img: 'https://x/pika.png' }] },
      askedQuestions: {},
    });
    const mg = getMinigame('pokemon_silhouette');
    expect(mg.Component).toBe(WhosThatPokemon);
    expect(mg.Component).not.toBe(DeblurGame);
    expect(mg.content.fromQuestions).toBe('pokemon_silhouette');
    expect(mg.name).toBe('fight.mg.pokemon_silhouette.name');
  });

  it('silhouette sans questions à image → cascade vers la catégorie jeux vidéo', () => {
    useGameStore.setState({ questions: {}, askedQuestions: {} });
    setThemesData({ themes: {
      jeux_video: { key: 'jeux_video', path: 'pop.jeux_video', parentKey: null, subjectKey: 'jeux_video' },
      pokemon_silhouette: { key: 'pokemon_silhouette', path: 'pop.jeux_video.pokemon_silhouette', parentKey: 'jeux_video', subjectKey: 'pokemon_silhouette' },
    }, roots: [] });
    expect(getMinigame('pokemon_silhouette').Component).toBe(getMinigame('jeux_video').Component);
    resetThemesData();
  });

  it('Cinéma & Séries TV : Affiche mystère (deblur) sur les questions à affiches seedées', () => {
    // Mécanique reprise du projet Ciné (question 'poster') via seed-cinema-affiches.mjs.
    useGameStore.setState({
      questions: {
        cinema_affiches: [{ q: 'Quel est ce film ?', a: ['Inception', 'Interstellar', 'Tenet', 'Memento'], c: 0, img: 'https://x/inception.jpg' }],
        series_affiches: [{ q: 'Quelle est cette série ?', a: ['Dark', 'Lost', 'Fringe', 'Heroes'], c: 0, img: 'https://x/dark.jpg' }],
      },
      askedQuestions: {},
    });
    const cine = getMinigame('cinema');
    expect(cine.Component).toBe(DeblurGame);
    expect(cine.props).toBeUndefined(); // flou progressif, PAS le mode sharp
    expect(cine.content.fromQuestions).toBe('cinema_affiches');
    expect(getMinigame('series_tv').content.fromQuestions).toBe('series_affiches');
    // Sans affiches chargées → repli générique (pas de Frise des films câblée).
    useGameStore.setState({ questions: {}, askedQuestions: {} });
    expect(getMinigame('cinema').Component).toBe(getDefaultMinigame().Component);
  });

  it('fightPickImageQuestion ne sert que des questions à image, hors namespace du pool complet', () => {
    useGameStore.setState({ questions: { drapeaux_symboles: QS }, askedQuestions: {} });
    const pick = useGameStore.getState().fightPickImageQuestion;
    for (let i = 0; i < 5; i++) {
      const q = pick('drapeaux_symboles');
      expect(q.img).toBe('https://x/jp.png');
      expect(q.a).toContain('Japon'); // réponses mélangées mais complètes
      expect(q.a[q.c]).toBe(QS[0].a[QS[0].c]); // index de la bonne réponse recalculé
    }
    const asked = useGameStore.getState().askedQuestions;
    expect(asked['img:drapeaux_symboles'].size).toBeGreaterThan(0);
    expect(asked.drapeaux_symboles).toBeUndefined(); // pool complet intact
    expect(pick('pool_inconnu')).toBeNull();
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
