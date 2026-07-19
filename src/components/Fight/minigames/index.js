import QuickDuel from './QuickDuel.jsx';
import BubbleHunt from './BubbleHunt.jsx';
import TimelineGame from './TimelineGame.jsx';
import CompteEstBon from './CompteEstBon.jsx';
import MotLePlusLong from './MotLePlusLong.jsx';
import Curioscope from './Curioscope.jsx';
import DeblurGame from './DeblurGame.jsx';
import WhosThatPokemon from './WhosThatPokemon.jsx';
import { getUniverse } from '../../../data/universes.js';
import { THEMES } from '../../../data/themes.js';
import { useGameStore } from '../../../store/gameStore.js';
import { getSubjectPool } from '../../../data/questions/index.js';
import MemoryGame from './MemoryGame.jsx';
import {
  IRREGULAR_VERBS, REGULAR_VERBS, SVT_CHALLENGES, TIMELINE_EVENTS,
  RPG_CHALLENGE, MEMORY_VOCAB,
} from '../../../data/fightData';
import {
  ERA_PREHISTOIRE_ANTIQUITE, ERA_MOYEN_AGE, ERA_EPOQUE_MODERNE,
  ERA_REVOLUTIONS_XIXE, ERA_XXE_SIECLE, ERA_MONDE_CONTEMPORAIN,
  HISTORY_ALL_ERAS, INVENTIONS_TIMELINE, SPACE_DISTANCES,
  MEMORY_ES, MEMORY_LITT, MEMORY_SPORT, GERMAN_VERB_CHALLENGE, EXPRESSIONS,
} from '../../../data/fightPacks';

/**
 * Système de mini-jeux de duel — séparé en MOTEURS (theme-agnostiques) et THÈMES
 * (données + libellés). Ajouter un thème = AJOUTER UNE ENTRÉE dans THEME_MINIGAMES
 * (+ son contenu), sans écrire de nouveau composant tant qu'un moteur convient.
 *
 * Chaque moteur reçoit { attacker, defender, subject, round, onRoundWin, content }
 * et appelle onRoundWin('attacker'|'defender') à chaque manche gagnée.
 * `persistent: true` = le composant n'est pas remonté entre les manches (il gère
 * lui-même la continuité, ex. la frise Timeline). `content` = données du thème,
 * dont la forme dépend du moteur :
 *   - bubble   : [{ id, prompt, prompt_en?, good[], bad[] }]  (touche-la-catégorie)
 *   - timeline : [{ name, year }]                              (ordonne-par-valeur)
 *   - curioscope : { universes: ['monde_reel', ...], target? } (guessr multi-univers)
 *   - deblur   : { fromQuestions: '<subjectKey>' } (questions à image du pool)
 *                OU [{ img, answer, decoys[], prompt? }] (statique)
 *   - silhouette : même contrat que deblur — plateau TV « Qui est ce Pokémon ?! »
 *                (silhouette noire + jingle) au lieu du défloutage progressif
 *   - maths/french : pas de `content` (jeu auto-suffisant)
 */
const ENGINES = {
  bubble: { Component: BubbleHunt, persistent: false },
  timeline: { Component: TimelineGame, persistent: true },
  maths: { Component: CompteEstBon, persistent: false },
  french: { Component: MotLePlusLong, persistent: false },
  curioscope: { Component: Curioscope, persistent: true, pointsBased: true },
  memory: { Component: MemoryGame, persistent: false },
  deblur: { Component: DeblurGame, persistent: false },
  // Course d'images : même composant que deblur mais image NETTE d'emblée
  // (props.sharp) — pure rapidité de reconnaissance (drapeaux…). `props` du
  // moteur = props supplémentaires passées au composant par MinigameStage.
  imgrace: { Component: DeblurGame, persistent: false, props: { sharp: true } },
  silhouette: { Component: WhosThatPokemon, persistent: false },
  // Duel de rapidité à CONTENU EMBARQUÉ [{ q, a[], c }] — même jeu que le
  // générique mais avec les questions du thème (ex. « Finis l'expression »).
  quick: { Component: QuickDuel, persistent: false },
};

// Contenu « bubble » de l'anglais (chasse aux verbes irréguliers).
const VERB_CONTENT = [{
  id: 'verbes-irreguliers',
  prompt: 'Touche les verbes IRRÉGULIERS !', prompt_en: 'Tap the IRREGULAR verbs!',
  good: IRREGULAR_VERBS, bad: REGULAR_VERBS,
}];

// THÈMES → moteur + contenu + libellés (clés i18n `fight.mg.*` résolues à
// l'affichage par FightBriefing / FightModal). `name`/`rules`/`howto` sont propres
// au thème (ex. « Chasse aux verbes » vs « Le Grand Tri » partagent le moteur bubble).
const THEME_MINIGAMES = {
  anglais: {
    engine: 'bubble', content: VERB_CONTENT,
    name: 'fight.mg.anglais.name', rules: 'fight.mg.anglais.rules',
    howto: { demo: 'tapBubbles', goal: 'fight.mg.anglais.goal', steps: ['fight.mg.anglais.step1', 'fight.mg.anglais.step2', 'fight.mg.anglais.step3', 'fight.mg.anglais.step4'] },
  },
  svt: {
    engine: 'bubble', content: SVT_CHALLENGES,
    name: 'fight.mg.svt.name', rules: 'fight.mg.svt.rules',
    howto: { demo: 'tapBubbles', goal: 'fight.mg.svt.goal', steps: ['fight.mg.svt.step1', 'fight.mg.svt.step2', 'fight.mg.svt.step3', 'fight.mg.svt.step4'] },
  },
  histoire: {
    engine: 'timeline', content: TIMELINE_EVENTS,
    name: 'fight.mg.histoire.name', rules: 'fight.mg.histoire.rules',
    howto: { demo: 'timeline', goal: 'fight.mg.histoire.goal', steps: ['fight.mg.histoire.step1', 'fight.mg.histoire.step2', 'fight.mg.histoire.step3', 'fight.mg.histoire.step4'] },
  },
  maths: {
    engine: 'maths',
    name: 'fight.mg.maths.name', rules: 'fight.mg.maths.rules',
    howto: { demo: 'compute', goal: 'fight.mg.maths.goal', steps: ['fight.mg.maths.step1', 'fight.mg.maths.step2', 'fight.mg.maths.step3'] },
  },
  francais: {
    engine: 'french',
    name: 'fight.mg.francais.name', rules: 'fight.mg.francais.rules',
    howto: { demo: 'word', goal: 'fight.mg.francais.goal', steps: ['fight.mg.francais.step1', 'fight.mg.francais.step2', 'fight.mg.francais.step3', 'fight.mg.francais.step4'] },
  },
  geographie: {
    engine: 'curioscope', content: { universes: ['monde_reel'] },
    name: 'fight.mg.geographie.name', rules: 'fight.mg.geographie.rules', winLabel: 'fight.mg.geographie.winLabel',
    howto: { demo: 'geo', goal: 'fight.mg.geographie.goal', steps: ['fight.mg.geographie.step1', 'fight.mg.geographie.step2', 'fight.mg.geographie.step3', 'fight.mg.geographie.step4'] },
  },

  // ── Thèmes culture pop — clés = subject_key de la table quete_themes ! ──
  // (`cinema`/`jeux_video`, PAS les anciennes clés démo films/jeuxvideo qui ne
  // matchaient aucun thème réel : la cascade des sous-thèmes — pokemon, skyrim,
  // horreur… — remonte vers CES clés-là.)
  //
  // Cinéma & Séries : « Affiche mystère » (deblur) sur les affiches TMDB
  // seedées en base (scripts/seed-cinema-affiches.mjs, mécanique reprise du
  // projet Ciné — question type 'poster' + distracteurs même genre/décennie).
  // Sans affiches chargées : cascade → générique. La Frise des films
  // (MOVIE_EVENTS, timeline) reste en réserve dans fightData.
  cinema: {
    engine: 'deblur', content: { fromQuestions: 'cinema_affiches' },
    name: 'fight.mg.cinema.name', rules: 'fight.mg.deblur.rules',
    howto: { demo: 'deblur', goal: 'fight.mg.deblur.goal', steps: ['fight.mg.deblur.step1', 'fight.mg.deblur.step2', 'fight.mg.deblur.step3', 'fight.mg.deblur.step4'] },
  },
  series_tv: {
    engine: 'deblur', content: { fromQuestions: 'series_affiches' },
    name: 'fight.mg.series.name', rules: 'fight.mg.deblur.rules',
    howto: { demo: 'deblur', goal: 'fight.mg.deblur.goal', steps: ['fight.mg.deblur.step1', 'fight.mg.deblur.step2', 'fight.mg.deblur.step3', 'fight.mg.deblur.step4'] },
  },
  jeux_video: {
    engine: 'bubble', content: [RPG_CHALLENGE],
    name: 'fight.mg.jeuxvideo.name', rules: 'fight.mg.jeuxvideo.rules',
    howto: { demo: 'tapBubbles', goal: 'fight.mg.jeuxvideo.goal', steps: ['fight.mg.jeuxvideo.step1', 'fight.mg.jeuxvideo.step2', 'fight.mg.jeuxvideo.step3', 'fight.mg.jeuxvideo.step4'] },
  },
  vocabulaire: {
    engine: 'memory', content: MEMORY_VOCAB,
    name: 'fight.mg.vocabulaire.name', rules: 'fight.mg.vocabulaire.rules',
    howto: { demo: 'memory', goal: 'fight.mg.vocabulaire.goal', steps: ['fight.mg.vocabulaire.step1', 'fight.mg.vocabulaire.step2', 'fight.mg.vocabulaire.step3', 'fight.mg.vocabulaire.step4'] },
  },

  // Curioscope multi-univers : guessr sur les cartes d'Azeroth (spots chargés
  // depuis la DB — tant qu'aucun spot n'existe, garde-fou getMinigame → duel
  // générique). Clé = subject des questions WoW (seed-world-of-warcraft.mjs).
  world_of_warcraft: {
    engine: 'curioscope', content: { universes: ['wow_kalimdor', 'wow_royaumes_est'] },
    name: 'fight.mg.wow.name', rules: 'fight.mg.wow.rules', winLabel: 'fight.mg.geographie.winLabel',
    howto: { demo: 'geo', goal: 'fight.mg.wow.goal', steps: ['fight.mg.wow.step1', 'fight.mg.wow.step2', 'fight.mg.wow.step3', 'fight.mg.wow.step4'] },
  },

  // ── « Qui est ce Pokémon ?! » : reconstitution du plateau TV de l'anime ──
  // Moteur dédié (silhouette noire sur explosion étoilée, jingle original) —
  // PAS le Deblur : le charme du jeu, c'est la silhouette franche, pas le flou.
  // Contenu gratuit : les questions à image de la cassette pokemon_silhouette.
  pokemon_silhouette: {
    engine: 'silhouette', content: { fromQuestions: 'pokemon_silhouette' },
    name: 'fight.mg.pokemon_silhouette.name', rules: 'fight.mg.wtp.rules',
    howto: { demo: 'silhouette', goal: 'fight.mg.wtp.goal', steps: ['fight.mg.wtp.step1', 'fight.mg.wtp.step2', 'fight.mg.wtp.step3', 'fight.mg.wtp.step4'] },
  },

  // ── QUICK WINS feuille de route (MINIJEUX_SOUHAITS.md) : moteurs existants
  // + packs de contenu (src/data/fightPacks.js). Les libellés de frise/memory/
  // verbes réutilisent les clés génériques existantes, seuls les noms changent.

  // Frises d'histoire : le DOMAINE = dates célèbres toutes époques ; chaque
  // époque = ses dates précises (réservées au sous-thème, souhait utilisateur).
  histoire_g: {
    engine: 'timeline', content: HISTORY_ALL_ERAS,
    name: 'fight.mg.grandefrise.name', rules: 'fight.mg.histoire.rules',
    howto: { demo: 'timeline', goal: 'fight.mg.histoire.goal', steps: ['fight.mg.histoire.step1', 'fight.mg.histoire.step2', 'fight.mg.histoire.step3', 'fight.mg.histoire.step4'] },
  },
  ...Object.fromEntries([
    ['prehistoire_antiquite', ERA_PREHISTOIRE_ANTIQUITE],
    ['moyen_age', ERA_MOYEN_AGE],
    ['epoque_moderne', ERA_EPOQUE_MODERNE],
    ['revolutions_xixe', ERA_REVOLUTIONS_XIXE],
    ['xxe_siecle', ERA_XXE_SIECLE],
    ['monde_contemporain', ERA_MONDE_CONTEMPORAIN],
  ].map(([key, content]) => [key, {
    engine: 'timeline', content,
    name: 'fight.mg.frisepoque.name', rules: 'fight.mg.histoire.rules',
    howto: { demo: 'timeline', goal: 'fight.mg.histoire.goal', steps: ['fight.mg.histoire.step1', 'fight.mg.histoire.step2', 'fight.mg.histoire.step3', 'fight.mg.histoire.step4'] },
  }])),
  inventions_technologies: {
    engine: 'timeline', content: INVENTIONS_TIMELINE,
    name: 'fight.mg.inventions.name', rules: 'fight.mg.histoire.rules',
    howto: { demo: 'timeline', goal: 'fight.mg.histoire.goal', steps: ['fight.mg.histoire.step1', 'fight.mg.histoire.step2', 'fight.mg.histoire.step3', 'fight.mg.histoire.step4'] },
  },
  // Frise par DISTANCE au Soleil (le moteur ordonne par valeur, unité M km).
  astronomie_espace: {
    engine: 'timeline', content: SPACE_DISTANCES,
    name: 'fight.mg.espace.name', rules: 'fight.mg.espace.rules',
    howto: { demo: 'timeline', goal: 'fight.mg.espace.goal', steps: ['fight.mg.histoire.step1', 'fight.mg.espace.step2', 'fight.mg.histoire.step3', 'fight.mg.histoire.step4'] },
  },

  // Memory : espagnol (mot ↔ traduction), littérature (auteur ↔ œuvre),
  // sport (athlète ↔ discipline, sur le DOMAINE → hérité par tous les sports).
  espagnol: {
    engine: 'memory', content: MEMORY_ES,
    name: 'fight.mg.espagnol.name', rules: 'fight.mg.espagnol.rules',
    howto: { demo: 'memory', goal: 'fight.mg.espagnol.goal', steps: ['fight.mg.vocabulaire.step1', 'fight.mg.mem.step2', 'fight.mg.vocabulaire.step3', 'fight.mg.vocabulaire.step4'] },
  },
  litterature_auteurs: {
    engine: 'memory', content: MEMORY_LITT,
    name: 'fight.mg.litterature.name', rules: 'fight.mg.litterature.rules',
    howto: { demo: 'memory', goal: 'fight.mg.litterature.goal', steps: ['fight.mg.vocabulaire.step1', 'fight.mg.mem.step2', 'fight.mg.vocabulaire.step3', 'fight.mg.vocabulaire.step4'] },
  },
  sport_g: {
    engine: 'memory', content: MEMORY_SPORT,
    name: 'fight.mg.sport.name', rules: 'fight.mg.sport.rules',
    howto: { demo: 'memory', goal: 'fight.mg.sport.goal', steps: ['fight.mg.vocabulaire.step1', 'fight.mg.mem.step2', 'fight.mg.vocabulaire.step3', 'fight.mg.vocabulaire.step4'] },
  },

  // Chasse aux verbes forts (bubble, libellés verbes = déjà génériques).
  allemand: {
    engine: 'bubble', content: [GERMAN_VERB_CHALLENGE],
    name: 'fight.mg.allemand.name', rules: 'fight.mg.anglais.rules',
    howto: { demo: 'tapBubbles', goal: 'fight.mg.anglais.goal', steps: ['fight.mg.anglais.step1', 'fight.mg.anglais.step2', 'fight.mg.anglais.step3', 'fight.mg.anglais.step4'] },
  },

  // Finis l'expression (duel de rapidité à contenu embarqué).
  langues_expressions: {
    engine: 'quick', content: EXPRESSIONS,
    name: 'fight.mg.expressions.name', rules: 'fight.mg.expressions.rules',
    howto: { demo: 'pickAnswer', goal: 'fight.mg.expressions.goal', steps: ['fight.mg.default.step1', 'fight.mg.default.step2', 'fight.mg.default.step3'] },
  },

  // ── Drapeau éclair : course d'images NETTES (moteur imgrace) ──
  // Décision utilisateur : pas de flou sur les drapeaux (ça n'apporte rien) —
  // le drapeau s'affiche net, pure rapidité de reconnaissance entre les deux
  // côtés. Le moteur deblur (flou progressif) reste réservé aux AFFICHES de
  // films / JAQUETTES de jeux vidéo (contenu statique à venir).
  drapeaux_symboles: {
    engine: 'imgrace', content: { fromQuestions: 'drapeaux_symboles' },
    name: 'fight.mg.drapeaux.name', rules: 'fight.mg.imgrace.rules',
    howto: { demo: 'imgrace', goal: 'fight.mg.imgrace.goal', steps: ['fight.mg.imgrace.step1', 'fight.mg.imgrace.step2', 'fight.mg.imgrace.step3'] },
  },
};

const DEFAULT_MINIGAME = {
  Component: QuickDuel, persistent: false, content: undefined,
  name: 'fight.mg.default.name', rules: 'fight.mg.default.rules',
  howto: { demo: 'pickAnswer', goal: 'fight.mg.default.goal', steps: ['fight.mg.default.step1', 'fight.mg.default.step2', 'fight.mg.default.step3'] },
};

// --- Cascade de repli thème → ancêtres → générique (cf. DESIGN_MINIGAMES.md §3) ---

// Clés candidates pour `subject`, de la plus spécifique à la plus large : le
// subject lui-même (clés plates legacy, marche même sans arbre THEMES chargé),
// puis son nœud `quete_themes` (par key OU subjectKey) et chaque ancêtre en
// remontant parentKey. À chaque étage on teste la clé du nœud puis son
// subjectKey (nœuds mixtes).
function candidateKeys(subject) {
  const keys = [subject];
  const seen = new Set(keys);
  const push = (k) => { if (k && !seen.has(k)) { seen.add(k); keys.push(k); } };
  let node = THEMES[subject]
    || Object.values(THEMES).find((t) => t.subjectKey === subject)
    || null;
  let guard = 0; // borne dure au cas où l'arbre contiendrait un cycle
  while (node && guard++ < 50) {
    push(node.key);
    push(node.subjectKey);
    node = node.parentKey ? THEMES[node.parentKey] : null;
  }
  return keys;
}

// Une entrée câblée est-elle JOUABLE maintenant ? Non jouable = SAUTÉE par la
// cascade (on continue vers l'ancêtre, on ne tombe pas direct sur le générique).
//   - curioscope : au moins un univers avec des spots chargés (sinon le
//     placement n'aurait aucune cible à proposer) ;
//   - mode fromQuestions (deblur/silhouette) : au moins une question à image
//     dans le pool de la partie, sinon dans le STORE global (même repli que
//     fightPickImageQuestion : testeur de mini-jeux, thème hors périmètre) ;
//   - moteurs à contenu tableau (bubble/timeline/memory/deblur statique) :
//     contenu non vide ;
//   - moteurs auto-suffisants (maths/french) : toujours jouables.
function isPlayable(theme) {
  if (!ENGINES[theme.engine]?.Component) return false;
  if (theme.engine === 'curioscope') {
    return (theme.content?.universes || []).some((id) => (getUniverse(id)?.spots() || []).length > 0);
  }
  if (theme.content?.fromQuestions) {
    const key = theme.content.fromQuestions;
    const inGame = useGameStore.getState()?.questions?.[key] || [];
    const pool = inGame.length ? inGame : getSubjectPool(key);
    return pool.some((q) => q && q.img);
  }
  if (Array.isArray(theme.content)) return theme.content.length > 0;
  return true;
}

// Première entrée jouable de la cascade, ou null (→ duel générique).
function resolveEntry(subject) {
  for (const key of candidateKeys(subject)) {
    const theme = THEME_MINIGAMES[key];
    if (theme && isPlayable(theme)) return theme;
  }
  return null;
}

// Résout le mini-jeu d'un thème : cascade thème → ancêtres, puis fusionne le
// MOTEUR (composant + technique) et le THÈME (contenu + libellés). Repli sur le
// duel générique si aucune entrée jouable sur toute la chaîne.
export function getMinigame(subject) {
  const theme = resolveEntry(subject);
  if (!theme) return DEFAULT_MINIGAME;
  const engine = ENGINES[theme.engine] || {};
  return {
    Component: engine.Component,
    persistent: !!engine.persistent,
    pointsBased: !!engine.pointsBased,
    props: engine.props, // props supplémentaires du moteur (ex. imgrace → sharp)
    content: theme.content,
    name: theme.name,
    rules: theme.rules,
    winLabel: theme.winLabel,
    howto: theme.howto,
  };
}

// Le duel générique (utilisé par le simulateur dev pour tester le fallback).
export function getDefaultMinigame() {
  return DEFAULT_MINIGAME;
}

// Exposé pour les tests / le simulateur : liste des thèmes câblés.
export const MINIGAME_THEMES = Object.keys(THEME_MINIGAMES);

// Le thème `subject` résout-il (via la MÊME cascade que getMinigame) un duel
// Curioscope JOUABLE (≥1 univers avec des spots chargés) ? Retourne la liste des
// univers jouables, sinon null. Utilisé par fightBegin (store) pour router les
// surfaces téléphone/en ligne vers le duel guessr piloté par le store
// (curioFightHandlers).
export function curioUniverses(subject) {
  const theme = resolveEntry(subject);
  if (!theme || theme.engine !== 'curioscope') return null;
  const ok = (theme.content?.universes || []).filter((id) => (getUniverse(id)?.spots() || []).length > 0);
  return ok.length ? ok : null;
}

// Le thème `subject` résout-il (même cascade) un duel SILHOUETTE jouable
// (« Qui est ce Pokémon ?! ») ? Retourne la clé du pool de questions à image,
// sinon null. Utilisé par fightBegin pour router les surfaces téléphone/en
// ligne vers le duel-course piloté par le store : plateau TV sur l'écran
// partagé, réponses sur les appareils des duellistes.
export function silhouetteKey(subject) {
  const theme = resolveEntry(subject);
  if (!theme || theme.engine !== 'silhouette') return null;
  return theme.content?.fromQuestions || null;
}
