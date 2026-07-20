// Session de jeu en direct (companion mobile). Le TBI est MAÎTRE de la logique :
// il publie un instantané de l'état des équipes dans Supabase ; les téléphones
// s'y abonnent en lecture (Realtime). Tout est optionnel — le TBI fonctionne
// sans aucun téléphone connecté.
import { supabase } from './supabaseClient.js';
import { logText } from './logFormat.js';
import { extOn } from '../extensions/registry.js';
import { getDieFaces } from './forge.js';
import { magicRegenPerMin, magicMaxOf } from './magic.js';
import { hasActivePromise } from './pacts.js';
import { questionRerollOptions } from '../store/effectEngine.js';

const TABLE = 'quete_game_sessions';
const LOBBY_TABLE = 'quete_lobby_teams';
const INTENTS_TABLE = 'quete_intents';
const TRADES_TABLE = 'quete_trades';
const STATS_TABLE = 'quete_game_stats';

// Jeton secret d'une équipe créée depuis un téléphone : stocké dans le
// localStorage du tel, il lui permet de « posséder » son équipe (reconnexion,
// envoi d'intentions). Pas de compte (cf. décision : jeton local).
export function randomToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
// Jeton local PERSISTANT d'un joueur « en ligne » pour une partie donnée (même
// clé partout : lobby, contrôleur, client — ET l'hôte, qui est un joueur comme
// les autres). Détermine la possession d'équipe via team.token.
export function onlineToken(code) {
  const key = `quete_online_token_${code}`;
  try {
    const ex = localStorage.getItem(key);
    if (ex) return ex;
    const t = randomToken();
    localStorage.setItem(key, t);
    return t;
  } catch { return randomToken(); }
}

// Reprise du LOBBY en ligne côté hôte après un reload : { code, compose }
// en localStorage tant que le lobby est ouvert (écrit par OnlineLobby, lu par
// l'accueil), effacé au lancement de la partie ou au retour accueil.
export const LOBBY_RESUME_KEY = 'quete-online-lobby';
export function readLobbyResume() {
  try { return JSON.parse(localStorage.getItem(LOBBY_RESUME_KEY) || 'null'); } catch { return null; }
}
export function writeLobbyResume(data) {
  try { localStorage.setItem(LOBBY_RESUME_KEY, JSON.stringify(data)); } catch { /* best effort */ }
}
export function clearLobbyResume() {
  try { localStorage.removeItem(LOBBY_RESUME_KEY); } catch { /* best effort */ }
}

// Sans I/O/0/1 pour éviter les confusions de lecture du code d'appairage.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function randomCode() {
  let c = '';
  for (let i = 0; i < 4; i++) c += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return c;
}

// URL d'appairage encodée dans le QR (respecte la base GitHub Pages).
export function joinUrl(code) {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}?join=${code}`;
}

// URL de jointure « jeu en ligne » (client complet : lobby → plateau + jeu).
export function onlineJoinUrl(code) {
  const base = import.meta.env.BASE_URL || '/';
  return `${window.location.origin}${base}?online=${code}`;
}

// --- Manette téléphone : état du tour publié vers les mobiles ---
// La « phase de tour » n'existe pas côté TBI (combinaison de flags) : on la
// dérive ici pour le mobile. Premier flag actif gagne — l'ordre est calqué sur
// la priorité de rendu des modales TBI (GameLayout).
export function deriveTurnPhase(s) {
  if (s.finished) return 'finished';
  if (s.showStarterChest) return 'starterChest';
  if (s.showMetierPicker) return 'metier';
  if (s.showFight) return 'fight';
  if (s.showDuelChoice) return 'duelChoice';
  if (s.showQuestion) return 'question';
  if (s.showEvent) return 'event';
  if (s.showTargetPicker) return 'targetPicker';
  if (s.showTilePicker) return 'tilePicker';
  if (s.showSubjectPicker) return 'subjectPicker';
  if (s.showChargePicker) return 'chargePicker';
  if (s.showActionDice) return 'actionDice';
  if (s.lootReveal) return 'loot';
  if (s.showShopPrompt) return 'shopPrompt';
  if (s.awaitingChoice) return 'junction';
  if (s.rolling || s.showDiceModal) return 'dice';
  if (s.pendingLanding) return 'landing';
  return 'idle';
}

// Bloc `turn` du payload de session : ce que le téléphone de l'équipe ACTIVE
// doit savoir pour rendre sa « manette ». Fonction PURE et isolée : le jour où
// on veut un canal broadcast à faible latence, on republie ce même bloc tel
// quel sans toucher au mobile (qui ne lit que session.turn).
//
// ⚠️ CHECKLIST : tout état du store consommé ici doit AUSSI être abonné dans
// MobileSessionPanel (sélecteur + deps du useEffect), sinon la phase se fige
// silencieusement côté mobile. États lus : finished, teams, currentTeam, board,
// rolling, showDiceModal, diceValue, awaitingChoice, pendingMove, pendingLanding,
// showQuestion, showEvent, showFight, showDuelChoice, showTargetPicker,
// showTilePicker, showSubjectPicker, showChargePicker, showActionDice,
// lootReveal, showStarterChest, lastStarterReward, showShopPrompt,
// showMetierPicker, indiceHidden, indiceUsed, rerollUsed.
//
// ⚠️ ANTI-TRICHE : le payload est reçu par TOUS les téléphones (y compris les
// équipes adverses, devtools ouverts). Ne JAMAIS publier la bonne réponse
// (question.c), l'explication (question.e) ni l'indice Clairvoyance avant la
// révélation. Ne jamais publier de token ni de fonction (deferredTurnEnd).
export function buildTurnPayload(s) {
  if (!s) return null;
  const phase = deriveTurnPhase(s);
  const team = s.teams?.[s.currentTeam];
  const turn = { team: s.currentTeam, phase };
  if (phase === 'dice') {
    // Le téléphone REFLÈTE le dé (gros chiffre) — l'animation 3D reste au TBI.
    // Anti-spoiler : la valeur finale est connue dès rollDice() mais on ne la
    // publie pas tant que l'animation TBI roule (sinon le téléphone révèle le
    // résultat avant le tableau).
    turn.dice = { value: s.rolling ? null : (s.diceValue ?? null), rolling: !!s.rolling };
  } else if (phase === 'question' && s.showQuestion?.question) {
    const sq = s.showQuestion;
    const q = sq.question;
    const revealed = !!sq.answerRevealed;
    turn.question = {
      q: q.q, q_en: q.q_en || null,
      a: q.a || [], a_en: q.a_en || null,
      // Médias (URL publiques, noms opaques) : font partie de l'ÉNONCÉ → publiés
      // avant révélation. L'anti-triche repose sur les noms de fichiers opaques
      // (l'URL ne révèle jamais la bonne réponse), pas sur le masquage.
      img: q.img || null, a_img: q.a_img || null,
      // Mode de rendu ('silhouette' = image masquée en noir jusqu'à la révélation).
      // Le téléphone DOIT le respecter, sinon l'artwork en couleur trahit la réponse.
      render: q.render || null,
      // Média audio de l'énoncé (hymnes, cris) : publié avant révélation (nom opaque).
      audio: q.audio || null,
      subject: sq.subject || null,
      hidden: s.indiceHidden || [],       // réponses barrées (Indice / équipement)
      deadline: sq.deadline || null,       // le téléphone affiche le temps restant
      selected: revealed ? (sq.selected ?? null) : null,
      answerRevealed: revealed,
      timerHalved: !!sq.timerHalved,
      multiIndex: sq.multiIndex || null,
      multiTotal: sq.multiTotal || null,
      confused: !!sq.confused,
      modeleur: sq.modeleur || null,
      indiceUsed: !!s.indiceUsed,
      // Objets « changer la question » : noms/icônes pour les boutons du
      // téléphone. L'intent turnUseReroll renvoie l'INDEX de cette liste — le
      // TBI la recalcule à l'application (même état ⇒ même liste, TBI maître).
      rerollOptions: revealed ? [] : questionRerollOptions(team, s.rerollUsed, sq.subject)
        .map((o) => ({ itemName: o.itemName, icon: o.icon || null })),
      // ANTI-TRICHE : la bonne réponse et l'explication ne partent qu'APRÈS la
      // révélation (tous les téléphones reçoivent ce payload, devtools compris).
      // La Clairvoyance (revealHint) n'est JAMAIS publiée.
      ...(revealed ? { correctIndex: q.c, explanation: q.e || null, explanation_en: q.e_en || null } : {}),
    };
  } else if (phase === 'event' && s.showEvent) {
    const se = s.showEvent;
    const ev = se.event || {};
    const d = se.data || {};
    const evq = d.eventQuestion;
    const qRevealed = !!d.questionRevealed;
    turn.event = {
      key: se.key,
      phase: se.phase, // roulette | intro | target | dice | question | choice | vaToutChoice | result
      icon: ev.icon || null,
      name: ev.name || null, name_en: ev.name_en || null,
      desc: ev.desc || null, desc_en: ev.desc_en || null,
      data: {
        targetIndex: d.targetIndex ?? null,
        // Dé d'événement reflété (anti-spoiler : valeur masquée pendant l'anim TBI).
        diceRolling: !!d.diceRolling,
        diceValue: d.diceRolling ? null : (d.diceValue ?? null),
        vaToutPot: d.vaToutPot ?? null,
        vaToutStreak: d.vaToutStreak ?? null,
        lastGain: d.lastGain ?? null,
        gifts: d.gifts || null,           // troisCoffres
        merchandise: d.merchandise || null, // marchandAmbulant
        message: d.message || null,       // phase result
        // Question d'événement : MÊME stripping anti-triche que turn.question.
        question: evq ? {
          q: evq.q, q_en: evq.q_en || null, a: evq.a || [], a_en: evq.a_en || null,
          subject: d.eventSubject || null,
          revealed: qRevealed,
          selected: qRevealed ? (d.questionSelected ?? null) : null,
          ...(qRevealed ? { correctIndex: evq.c, result: !!d.questionResult } : {}),
        } : null,
      },
    };
  } else if (phase === 'duelChoice' && s.showDuelChoice) {
    const dc = s.showDuelChoice;
    turn.duel = { defenders: dc.defenders || [], blocked: dc.blocked || [], subject: dc.subject || null };
  } else if (phase === 'loot' && s.lootReveal) {
    turn.loot = { itemKey: s.lootReveal.itemKey || null, title: s.lootReveal.title || null };
  } else if (phase === 'starterChest' && s.lastStarterReward) {
    const r = s.lastStarterReward;
    turn.starterChest = { gold: r.gold || 0, choices: r.choices || [], keep: r.keep || 1 };
  } else if (phase === 'shopPrompt') {
    turn.shopPrompt = true;
  } else if (phase === 'fight' && s.showFight) {
    const sf = s.showFight;
    const winnerIdx = sf.winnerSide ? (sf.winnerSide === 'attacker' ? sf.attackerIndex : sf.defenderIndex) : null;
    turn.fight = {
      phase: sf.phase, // versus | briefing | minigame | reward | result
      attackerIndex: sf.attackerIndex ?? null,
      defenderIndex: sf.defenderIndex ?? null,
      subject: sf.subject || null,
      winnerIndex: winnerIdx,
      rewardChosen: !!sf.reward?.choice,
      resultMessage: sf.resultMessage || null,
      boss: !!(sf.boss || sf.bossFight),
      wins: sf.wins || null,
      round: sf.round || null,
      // Extension objets active ? Le client masque le bouton de récompense
      // « Voler un objet » si false (garde autorité dans fightChooseReward).
      itemsOn: extOn(s.extensions, 'equipment'),
      // Duel silhouette (« Qui est ce Pokémon ?! ») : clé du pool si la course
      // est en mode silhouette (le téléphone affiche l'image masquée + répond).
      wtp: sf.wtp || null,
      // Duel éclair (en ligne) : question de course SANS la bonne réponse (l'hôte
      // arbitre) + qui a déjà répondu + deadline. null hors duel éclair.
      // ANTI-TRICHE silhouette : la bonne réponse ne part QU'À la révélation.
      race: sf.race ? {
        q: (() => { const { c, e, e_en, ...safe } = sf.race.q || {}; return safe; })(),
        answered: { attacker: !!sf.race.answers?.attacker, defender: !!sf.race.answers?.defender },
        deadline: sf.race.deadline || null,
        reveal: sf.race.reveal ? { c: sf.race.reveal.c, winner: sf.race.reveal.winner || null } : null,
      } : null,
      // Duel Curioscope (guessr, surfaces téléphone/en ligne) — ANTI-TRICHE :
      // la position de la cible (x/y), son label (sauf mode « Place : X ») et
      // les marques des équipes ne partent QU'À la révélation.
      curio: sf.curio ? (() => {
        const c = sf.curio;
        return {
          roundNo: c.roundNo,
          scores: c.scores,
          universe: c.target?.universe || null,
          image: c.target?.image || null,
          showName: !!c.target?.showName,
          label: (c.target && (c.target.showName || c.reveal)) ? c.target.label : null,
          validated: c.validated,
          nextReady: c.nextReady || null,
          reveal: c.reveal ? {
            ...c.reveal,
            target: { x: c.target.x, y: c.target.y, label: c.target.label },
            marks: c.marks,
          } : null,
        };
      })() : null,
      // Duel Memory (paires, surface « écran + téléphones ») — ANTI-TRICHE : le
      // texte d'une carte et son appariement (pairId) ne partent QUE lorsqu'elle
      // est face visible (flipped) ou capturée (matched). Une carte au dos n'a
      // ni texte ni propriétaire → impossible de deviner les paires en amont.
      memory: sf.memory ? (() => {
        const m = sf.memory;
        return {
          roundNo: m.roundNo,
          scores: m.scores,
          activeSide: m.activeSide,
          busy: !!m.busy,
          flipped: m.flipped,
          reveal: m.reveal || null,
          cards: m.cards.map((c, i) => {
            const owner = m.matched[c.pairId] || null;   // 'attacker'|'defender'|null
            const shown = owner != null || m.flipped.includes(i);
            return { key: c.key, text: shown ? c.text : null, owner };
          }),
        };
      })() : null,
      // Combat Pokémon (surface « écran + téléphones ») — ANTI-TRICHE : le
      // CONTENU des choix secrets d'un tour ne part jamais, seulement des
      // accusés `chosen` (le téléphone adverse voit juste « a choisi »). Le
      // reste (offres du draft, vue des PV, dialogue) est public.
      pkmn: sf.pkmn ? (() => {
        const p = sf.pkmn;
        return {
          stage: p.stage,
          offers: p.offers,
          picks: p.picks,
          validated: p.validated,
          view: p.view,
          dialog: p.dialog,
          anim: p.anim || null,
          vfx: p.vfx || null,
          phaseB: p.phaseB,
          chosen: { A: !!p.choice?.A, B: !!p.choice?.B },
          replaceSide: p.replaceSide || null,
          winner: p.winner || null,
        };
      })() : null,
    };
  } else if (phase === 'targetPicker' && s.showTargetPicker) {
    const stp = s.showTargetPicker;
    turn.targetPicker = {
      powerKey: stp.powerKey || null,
      source: stp.source || null,
      banish: !!stp.banish,
      allowSelf: !!stp.allowSelf,
      amount: stp.amount ?? null,
      // Mêmes règles que la modale TBI : immunité totale = non ciblable ;
      // pacte actif = ciblable mais confirmation de trahison (vrais pouvoirs
      // offensifs seulement, pas les ciblages du moteur d'effets).
      immune: (s.teams || []).map((t, i) => ((t.totalImmuneTurns ?? 0) > 0 ? i : -1)).filter((i) => i >= 0),
      pact: !stp.source && team
        ? (s.teams || []).map((_, i) => i).filter((i) => i !== s.currentTeam && hasActivePromise(team, i))
        : [],
    };
  } else if (phase === 'subjectPicker') {
    turn.subjectPicker = true; // le mobile liste les thèmes localement (SUBJECT_KEYS)
  } else if (phase === 'chargePicker') {
    turn.chargePicker = { amount: s.showChargePicker?.amount ?? 1 };
  } else if (phase === 'tilePicker') {
    // Pose de piège pilotable au téléphone : liste des cases éligibles (toutes
    // sauf l'arrivée), triées par progression (x), avec les équipes présentes.
    const nodes = Object.entries(s.board || {})
      .filter(([, n]) => n.type !== 'arrivee')
      .sort((a, b) => (a[1].x ?? 0) - (b[1].x ?? 0))
      .map(([id, n], i) => ({
        id, order: i + 1, type: n.type || null, subject: n.subject || null,
        trap: !!n.trap,
        occupants: (s.teams || []).map((t, ti) => (t.pos === id ? ti : -1)).filter((ti) => ti >= 0),
      }));
    turn.tilePicker = { label: s.showTilePicker?.label || null, icon: s.showTilePicker?.icon || null, nodes };
  } else if (phase === 'junction' && team) {
    // Options dérivées côté TBI (le mobile n'a pas le plateau) : cartes-directions.
    turn.junction = {
      remaining: s.pendingMove?.remaining ?? 1,
      options: (s.board?.[team.pos]?.next || []).map((id) => {
        const n = s.board?.[id] || {};
        return { id, type: n.type || null, subject: n.subject || null, label: n.label || null };
      }),
    };
  } else if (phase === 'landing' && team) {
    const n = s.board?.[team.pos] || {};
    turn.landing = { type: n.type || null, subject: n.subject || null };
  } else if (phase === 'idle' && team) {
    // Point de contrôle posé par l'équipe active : téléportable depuis la manette.
    if (team.checkpoint && s.board?.[team.checkpoint] && team.checkpoint !== team.pos) {
      turn.checkpoint = { consumeChance: team.checkpointConsumeChance ?? 100 };
    }
  }
  return turn;
}

// Sous-ensemble publié vers les téléphones. On n'envoie que les CLÉS d'objets/
// pouvoirs : le mobile (même app) résout ITEMS/POWERS localement.
// Payload « manette » construit depuis un état de store complet (mode « jeu en
// ligne » : l'hôte le diffuse en plus du snapshot pour piloter la manette des
// joueurs distants). Même sortie que le mode manette classe — buildTurnPayload
// strippe déjà les secrets (bonne réponse avant révélation, cases cachées).
export function buildControllerPayload(s) {
  const turnState = {
    finished: s.finished, teams: s.teams, currentTeam: s.currentTeam, board: s.board,
    rolling: s.rolling, showDiceModal: s.showDiceModal, diceValue: s.diceValue,
    awaitingChoice: s.awaitingChoice, pendingMove: s.pendingMove, pendingLanding: s.pendingLanding,
    showQuestion: s.showQuestion, showEvent: s.showEvent, showFight: s.showFight, showDuelChoice: s.showDuelChoice,
    showTargetPicker: s.showTargetPicker, showTilePicker: s.showTilePicker, showSubjectPicker: s.showSubjectPicker,
    showChargePicker: s.showChargePicker, showActionDice: s.showActionDice, lootReveal: s.lootReveal,
    showStarterChest: s.showStarterChest, lastStarterReward: s.lastStarterReward, showShopPrompt: s.showShopPrompt,
    showMetierPicker: s.showMetierPicker, indiceHidden: s.indiceHidden, indiceUsed: s.indiceUsed, rerollUsed: s.rerollUsed,
  };
  const locked = !!(s.showQuestion || s.showEvent || s.showFight || s.showDuelChoice
    || s.rolling || s.showDiceModal || s.awaitingChoice || s.pendingActions || s.pendingLanding);
  return buildSessionPayload({
    teams: s.teams, currentTeam: s.currentTeam, status: s.finished ? 'finished' : 'playing',
    shopStock: s.shopStock, shopFaceStock: s.shopFaceStock, log: s.log, extensions: s.extensions,
    locked, lv2Mode: s.lv2Mode, englishMode: s.englishMode, gameStats: s.gameStats,
    forgeService: s.forgeService, phoneController: true, turnState,
  });
}

export function buildSessionPayload({ teams, currentTeam, status, shopStock, shopFaceStock = [], log, extensions, locked = false, lv2Mode = false, englishMode = false, gameStats = null, forgeService = null, phoneController = false, turnState = null }) {
  // Historique de questions par équipe (onglet mobile « anciennes questions ») :
  // dérivé du journal analytique, compacté aux derniers ~20 par équipe et aux
  // seuls champs utiles à la revue. Le mobile filtre ensuite sur SON équipe.
  const questionLog = {};
  for (const a of (gameStats?.answers || [])) {
    const arr = (questionLog[a.teamIdx] ||= []);
    arr.push({
      subject: a.subject, qText: a.qText, answers: a.answers,
      correctIndex: a.correctIndex, chosenIndex: a.chosenIndex,
      correct: a.correct, timedOut: a.timedOut, explanation: a.explanation,
    });
  }
  for (const k of Object.keys(questionLog)) questionLog[k] = questionLog[k].slice(-20);
  const forgeOn = extOn(extensions, 'forge');
  const magicOn = extOn(extensions, 'magic');
  return {
    questionLog,
    status,
    currentTeam,
    // Manette téléphone : toggle (Setup) + bloc d'état du tour en cours. Le
    // mobile n'affiche la manette que si controller=true ET turn.team = lui.
    controller: !!phoneController,
    // `extensions` injecté : buildTurnPayload en dérive itemsOn (bloc fight) —
    // les turnState construits par les appelants ne portent pas ce champ.
    turn: turnState ? buildTurnPayload({ extensions, ...turnState }) : null,
    // Horodatage de publication : le mobile s'en sert pour détecter un état
    // périmé (bandeau « reconnexion » si > quelques secondes pendant son tour).
    publishedAt: Date.now(),
    // Édition d'équipement bloquée côté mobile pendant une résolution (question,
    // duel, événement, déplacement…) — le TBI reste maître du timing.
    locked: !!locked,
    extensions: extensions || null, // extensions actives (gate l'UI objets côté mobile)
    lv2Mode: !!lv2Mode, // mode « LV2 au choix » : le mobile montre le choix de langue au lobby
    englishMode: !!englishMode, // localisation anglaise (le mobile traduit son UI)
    shop: (shopStock || []).filter(Boolean), // clés du stock boutique (lecture mobile)
    shopFaces: forgeOn ? (shopFaceStock || []).filter(Boolean) : [], // vitrine de faces (Forge)
    // Prestation de forgeage en cours (session collaborative) : diffusée aux 2
    // mobiles concernés (le forgeron forge, le client suit) ; null sinon.
    forgeService: forgeService || null,
    // Historique : on n'envoie que les dernières entrées (l'onglet mobile les
    // affiche du plus récent au plus ancien). Les entrées structurées
    // { text, detail } sont aplaties en texte (le mobile lit des chaînes).
    log: (log || []).slice(-60).map(logText),
    teams: (teams || []).map((t, idx) => ({
      idx,
      name: t.name, emoji: t.emoji, character: t.character, color: t.color,
      money: t.money ?? 0,
      // « Hacking » : tant que > 0, le téléphone de CETTE équipe affiche la
      // cinématique « app piratée » en boucle (jusqu'à la résolution du tour).
      // `hackedBy` = attribution affichée (« le boss » ou l'équipe lanceuse).
      hacked: (t.hackedTurns || 0) > 0,
      hackedBy: t.hackedBy || null,
      correct: t.correct ?? 0, wrong: t.wrong ?? 0,
      pos: t.pos,
      // Effets transitoires (rappel visuel côté élève) — cf. getTeamEffects.
      forcedSubject: t.forcedSubject || null,
      randomPathNext: !!t.randomPathNext,
      itemShield: t.itemShield || 0,
      itemFumigene: !!t.itemFumigene,
      itemFumigeneTurns: t.itemFumigeneTurns || 0,
      itemTimerBonus: t.itemTimerBonus || 0,
      doubleActive: !!t.doubleActive,
      doubleExtra: t.doubleExtra || 0,
      sablierActif: !!t.sablierActif,
      // Pluie maudite (météo) : achats bloqués pendant X tours (info mobile).
      shopBlockedTurns: t.shopBlockedTurns || 0,
      wager: t.wager ? true : null,
      buffs: (t.buffs || []).map((b) => ({ type: b.type, turns: b.turns, n: b.n, subject: b.subject })),
      // Pactes de non-agression actifs (« Complots ») : promesses de NE PAS attaquer.
      promises: (t.promises || []).map((p) => ({ to: p.to, turns: p.turns })),
      // Coalitions (« attaques communes ») : on vise une même cible avec un allié.
      coalitions: (t.coalitions || []).map((c) => ({ with: c.with, against: c.against, turns: c.turns })),
      // Équipement publié en CLÉS (le mobile lit des clés) + specs d'enchant
      // par emplacement (Enchantement). Les specs COMPLÈTES (pas juste un
      // compteur) permettent au mobile d'afficher le détail des effets ajoutés
      // par un parchemin gravé (marqueur ✦ + bloc « Enchantement », utile pour
      // vérifier ce qu'on échange lors d'un troc).
      equipment: Object.fromEntries(['head', 'body', 'feet'].map((s) => {
        const v = t.equipment?.[s];
        return [s, typeof v === 'string' ? v : (v?.key ?? null)];
      })),
      enchants: Object.fromEntries(['head', 'body', 'feet'].map((s) => {
        const v = t.equipment?.[s];
        return [s, (v && typeof v === 'object' && Array.isArray(v.enchants)) ? v.enchants : []];
      })),
      bag: (t.bag || []).filter(Boolean),
      powers: t.powers || {},
      powerDef: t.powerDef, powerOff: t.powerOff,
      // Métier choisi (extension « Métiers ») : pilote le gating des onglets craft
      // côté mobile + l'affichage du sélecteur (null = pas encore choisi).
      metier: t.metier || null,
      // Alchimie : grimoire de l'équipe (ingrédients goûtés + recettes trouvées).
      knownIngredients: t.knownIngredients || [],
      knownRecipes: t.knownRecipes || [],
      // Forge de dés : les 6 faces actuelles (normalisées) + faces achetées non
      // posées, pour l'atelier de forge mobile. Publié seulement si l'extension
      // est active (sinon le mobile ne montre pas l'atelier).
      ...(forgeOn ? { dieFaces: getDieFaces(t), faceStock: t.faceStock || [] } : {}),
      // Magie : barre {stored, lastTs} + taux/plafond RÉSOLUS côté TBI (passifs
      // et buffs inclus) — le mobile anime la barre LOCALEMENT à partir de ces
      // trois valeurs, sans recalculer les équipements. Codex publié en CLÉS ;
      // le matching des séquences reste au TBI (autorité).
      ...(magicOn ? {
        magic: {
          stored: t.magic?.stored ?? 0,
          lastTs: t.magic?.lastTs ?? Date.now(),
          regenPerMin: magicRegenPerMin(t),
          max: magicMaxOf(t),
        },
        knownRunes: t.knownRunes || [],
        knownSpells: t.knownSpells || [],
        faceMods: t.faceMods || {},
        lastCastAt: t.lastCastAt || 0,
      } : {}),
    })),
  };
}

// --- Côté TBI (publication) ---

// Purge best-effort des sessions périmées : une ligne de session est un état de
// jeu TRANSITOIRE (companion classe ou snapshot « en ligne »). Rien ne les
// supprimait → elles s'empilaient (150+ lignes, dont des snapshots multi-Mo) et
// alimentaient l'usure du Disk IO. On les nettoie à la création d'une nouvelle
// session (moment naturel, hors chemin critique). Non bloquant : une erreur ici
// (RLS, réseau) ne doit jamais empêcher de lancer une partie.
async function purgeStaleSessions() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from(TABLE).delete().lt('updated_at', cutoff);
  } catch { /* best-effort */ }
}

// Crée une session avec un code unique (réessaie sur collision de code).
export async function createSession(payload) {
  purgeStaleSessions(); // fire-and-forget : ne bloque pas le lancement
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const { error } = await supabase.from(TABLE).insert({ code, data: payload });
    if (!error) return code;
    if (error.code !== '23505') throw error; // 23505 = collision de clé → on réessaie
  }
  throw new Error('Impossible de générer un code de session.');
}

export async function publishSession(code, payload) {
  const { error } = await supabase.from(TABLE)
    .upsert({ code, data: payload, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// --- Côté mobile (lecture) ---

export async function fetchSession(code) {
  const { data, error } = await supabase.from(TABLE).select('data').eq('code', code).maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

// S'abonne aux mises à jour de la session ; renvoie une fonction de désabonnement.
// `onStatus` (optionnel) reçoit l'état du canal ('SUBSCRIBED', 'CHANNEL_ERROR',
// 'TIMED_OUT', 'CLOSED') — le mobile s'en sert pour se réabonner (manette).
export function subscribeSession(code, onData, onStatus) {
  // Nom de canal UNIQUE par abonnement : deux `.channel('quete-session-CODE')`
  // renvoient le MÊME canal (dédup Supabase par topic) ; un 2e `.on().subscribe()`
  // (re-montage StrictMode, multi-abonné) lève « cannot add postgres_changes
  // callbacks after subscribe() » et casse l'abonnement. Un suffixe unique évite
  // toute collision — chaque abonné reçoit quand même tous les changements DB.
  const channel = supabase
    .channel(`quete-session-${code}-${Math.random().toString(36).slice(2, 9)}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `code=eq.${code}` },
      (payload) => {
        // Le payload Realtime peut être VIDE/incomplet pour un gros JSON (le
        // snapshot complet du jeu en ligne) ou selon la RLS Realtime → on relit
        // alors la ligne complète en REST (SELECT), fiable quelle que soit la taille.
        const inline = payload.new?.data;
        if (inline) onData(inline);
        else fetchSession(code).then((d) => { if (d) onData(d); }).catch(() => {});
      })
    .subscribe((status) => onStatus?.(status));
  return () => { supabase.removeChannel(channel); };
}

// --- Présence (mode « jeu en ligne ») : qui est connecté à la session ---
// Canal Realtime Presence dédié : chaque client s'y « track » avec son rôle
// (host/spectator) et son token. `onSync(list)` reçoit la liste aplatie des
// présents à chaque changement. Renvoie une fonction de départ.
export function subscribePresence(code, meta, onSync) {
  const key = meta?.token || randomToken();
  const topic = `quete-presence-${code}`;
  // La présence exige un topic PARTAGÉ (pour se voir entre clients) → on ne peut
  // pas le rendre unique. On purge donc tout canal résiduel du même topic avant
  // d'en recréer un (évite « callbacks after subscribe » au re-montage StrictMode).
  try { supabase.getChannels().forEach((c) => { if (c.topic === topic || c.topic === `realtime:${topic}`) supabase.removeChannel(c); }); } catch { /* noop */ }
  const channel = supabase.channel(topic, { config: { presence: { key } } });
  const emit = () => {
    const state = channel.presenceState();
    const list = Object.values(state).flat();
    onSync?.(list);
  };
  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ ...meta, at: Date.now() }).catch(() => {});
    });
  return () => { supabase.removeChannel(channel); };
}

// --- Lobby : équipes créées depuis les téléphones (avant la partie) ---

// Crée ou met à jour la fiche d'équipe d'un téléphone (clé = code + token).
export async function upsertLobbyTeam(code, token, fields) {
  const { error } = await supabase.from(LOBBY_TABLE)
    .upsert({ code, token, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'code,token' });
  if (error) throw error;
}

// Liste des équipes d'un lobby (hors retirées), triées par ordre d'arrivée.
export async function fetchLobbyTeams(code) {
  const { data, error } = await supabase.from(LOBBY_TABLE)
    .select('*').eq('code', code).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Le TBI retire une équipe (l'élève le voit via removed=true).
export async function removeLobbyTeam(id) {
  const { error } = await supabase.from(LOBBY_TABLE).update({ removed: true }).eq('id', id);
  if (error) throw error;
}

// Au démarrage : le TBI inscrit l'index attribué à chaque équipe du lobby pour
// que chaque téléphone retrouve « son » équipe (par son token).
export async function assignLobbyIndices(code, byToken) {
  await Promise.all(Object.entries(byToken).map(([token, idx]) =>
    supabase.from(LOBBY_TABLE).update({ idx }).eq('code', code).eq('token', token)));
}

// Suffixe unique par abonnement (cf. subscribeSession) : évite « cannot add
// postgres_changes after subscribe() » si deux abonnés partagent le topic
// (StrictMode, lobby en ligne + autre écoute…).
export function subscribeLobby(code, onChange) {
  const channel = supabase
    .channel(`quete-lobby-${code}-${Math.random().toString(36).slice(2, 9)}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: LOBBY_TABLE, filter: `code=eq.${code}` },
      () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// --- Intents : commandes mobile -> TBI (édition d'équipement en jeu) ---

// Le téléphone envoie une intention ; le TBI (maître) la valide puis l'applique.
export async function sendIntent(code, token, type, payload = {}) {
  const { error } = await supabase.from(INTENTS_TABLE).insert({ code, token, type, payload });
  if (error) throw error;
}

export async function fetchIntents(code) {
  const { data, error } = await supabase.from(INTENTS_TABLE)
    .select('*').eq('code', code).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function deleteIntent(id) {
  const { error } = await supabase.from(INTENTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// Le TBI s'abonne aux nouvelles intentions (INSERT) d'une session.
// Suffixe unique par abonnement : même piège de topic partagé que ci-dessus.
export function subscribeIntents(code, onInsert) {
  const channel = supabase
    .channel(`quete-intents-${code}-${Math.random().toString(36).slice(2, 9)}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: INTENTS_TABLE, filter: `code=eq.${code}` },
      (payload) => onInsert(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// --- Troc : propositions d'échange entre équipes (extension « trade ») ---
// Une offre : { code, from_idx, from_token, to_idx, give:{gold,bag[],equip[]},
// want:{...}, status:'pending'|'accepted'|'declined'|'cancelled'|'applied'|'failed' }.
// Le TBI (maître) re-vérifie et applique atomiquement les offres « accepted ».

export async function createTrade(code, fromToken, fromIdx, toIdx, give, want) {
  const { error } = await supabase.from(TRADES_TABLE)
    .insert({ code, from_token: fromToken, from_idx: fromIdx, to_idx: toIdx, give: give || {}, want: want || {}, status: 'pending' });
  if (error) throw error;
}

export async function fetchTrades(code) {
  const { data, error } = await supabase.from(TRADES_TABLE)
    .select('*').eq('code', code).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function setTradeStatus(id, status) {
  const { error } = await supabase.from(TRADES_TABLE).update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteTrade(id) {
  const { error } = await supabase.from(TRADES_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// Abonnement à toutes les évolutions d'offres d'une session (TBI + mobiles).
// Nom de canal UNIQUE par abonnement (même piège que subscribeSession) : chez
// l'hôte-joueur en ligne, TradeConsumer ET OnlineController s'abonnent tous
// deux aux trades — un topic partagé lèverait « cannot add postgres_changes
// callbacks after subscribe() » et CRASHERAIT le plateau.
export function subscribeTrades(code, onChange) {
  const channel = supabase
    .channel(`quete-trades-${code}-${Math.random().toString(36).slice(2, 9)}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: TRADES_TABLE, filter: `code=eq.${code}` },
      (payload) => onChange(payload))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// --- Analyse : archivage des statistiques de partie (dashboard `?analyse`) ---
// Une ligne par partie terminée. `data` = le journal analytique complet
// (answers/itemUses/powerUses + méta). Écrit une seule fois (cf. StatsArchiver).

export async function archiveGameStats({ code = null, classLabel = '', startedAt = null, subjects = [], data }) {
  const { error } = await supabase.from(STATS_TABLE).insert({
    code,
    class_label: classLabel || null,
    started_at: startedAt,
    subjects: subjects || [],
    data: data || {},
  });
  if (error) throw error;
}

// Toutes les parties archivées (récentes d'abord), filtrables par étiquette de classe.
export async function fetchGameStats({ classLabel = null } = {}) {
  let q = supabase.from(STATS_TABLE).select('*').order('ended_at', { ascending: false });
  if (classLabel) q = q.eq('class_label', classLabel);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Liste distincte des étiquettes de classe rencontrées (pour le filtre du dashboard).
export async function fetchClassLabels() {
  const { data, error } = await supabase.from(STATS_TABLE)
    .select('class_label').not('class_label', 'is', null);
  if (error) throw error;
  return [...new Set((data || []).map((r) => r.class_label).filter(Boolean))];
}
