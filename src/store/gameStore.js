import { create } from 'zustand';
import { TEAM_COLORS, TEAM_DEFAULTS, TEAM_DEFAULT_EMOJIS, TEAM_BLAZON_GLYPHS } from '../data/teamPresets.js';
import { defaultCharacterFor } from '../data/characters.js';
import { EVENTS } from '../data/events.js';
import { SUBJECTS, SUBJECT_KEYS, DEFAULT_BOARD_SUBJECTS, LV2_SUBJECTS, MODULES } from '../data/subjects.js';
import { POWERS, addCharge, MAX_CHARGES } from '../data/powers.js';
import { generateBoard } from '../logic/boardGenerator.js';
import { composeSpaceBoard } from '../logic/mapComposer.js';
import { generateDecor } from '../logic/decorGenerator.js';
import { moveForward, moveBack } from '../logic/pathfinding.js';
import { boardCategoriesFor } from '../logic/boardCategories';
import { pickQuestion } from '../logic/questionPicker.js';
import { pickRandomEvent } from '../logic/eventPicker.js';
import { defaultExtensions, extOn, applyExtensionToggle } from '../extensions/registry.js';
import { craftEnabledFor, metierActive, metierPending, METIER_IDS, METIER_BY_ID, metierName } from '../logic/metier.js';
import { defaultDieFaces, getDieFaces, clampFaceValue, faceEffects, DIE_SLOTS, isForgeServiceTrade } from '../logic/forge.js';
import { resolveFaceAtRoll, faceRollEngineActions, isRelanceFace, pickFaceStock, pickReplacementFace, faceShortLabel, FACE_STOCK_MAX } from '../logic/forgeEffects.js';
import { getQuestions, getSubjectPool } from '../data/questions/index.js';
import { calculateMoneyGain } from '../logic/moneyCalculator.js';
import { saveGame, loadGame, clearSave } from './persistence.js';
import { resolveWrongAnswer, resolveDoubleQuestion, BURST_RESET, applyRecul, questionDuration, QUESTION_TIME_FLOOR } from '../logic/turnHelpers.js';
import { resolvePowerEffect } from '../logic/powerEffects.js';
import { soundShield, soundTrap, soundWarp } from '../logic/sounds.js';
import * as eventH from './eventHandlers.js';
import * as powerH from './powerHandlers.js';
import * as fightH from './fightHandlers.js';
import * as itemH from './itemHandlers.js';
import * as effectH from './effectEngine.js';
import * as weatherH from './weatherHandlers.js';
import { ITEMS } from '../data/items.js';
import { LOOT, FORGE } from '../logic/balanceConfig.js';
import { getEffectValue, getSubjectLootBonus, explainEffectValue, findBuff, hasBuff, buffValue, isDuelImmune, isTrapImmune, resolveAmount, isGoldStealImmune, isItemStealImmune, reducedRecul, itemKeyOf, itemEnchantsOf, hasStreakGuard, minRollFloor, interestPct, tithePct } from '../logic/itemEffects.js';
import { RECIPES } from '../data/recipes.js';
import { ENCHANT_CAP_PER_PIECE } from '../data/enchantPalette.js';
import { tg, tgPlural, getLang } from '../i18n';
import { locName } from '../i18n/content.js';
import { loc } from '../i18n/content';
import { hasPactSpec, isDiploTrade, pactTurns, withPromise, tickPromises, hasCoalitionSpec, coalitionTurns, withCoalition, tickCoalitions } from '../logic/pacts.js';

const INITIAL_CHARGES = 2;

function createDefaultTeams(n) {
  return Array.from({ length: n }, (_, i) => ({
    name: TEAM_DEFAULTS[i] || `\u00c9quipe ${i + 1}`,
    color: TEAM_COLORS[i],
    emoji: TEAM_DEFAULT_EMOJIS[i] || '\u{1F3B2}',
    character: defaultCharacterFor(i),
    blazonGlyph: TEAM_BLAZON_GLYPHS[i] || 'lion',
    pos: 'depart',
    correct: 0,
    wrong: 0,
    streak: 0,
    money: 0,
    powerDef: null,
    powerOff: null,
    sablierActif: false,
    doubleActive: false,
    // Tours écoulés depuis la dernière visite de la boutique par cette équipe
    // (prompt « Visiter la boutique ? »). Remis à 0 à chaque ouverture.
    turnsSinceShop: 0,
  }));
}

// Configuration par défaut du coffre de départ (modifiable au Setup). Reproduit
// le comportement historique : activé, 20 or fixe, 3 consommables proposés, 1 gardé.
export function defaultStarterChestConfig() {
  return {
    enabled: true,
    goldMode: 'fixed',   // 'fixed' | 'random'
    gold: 20,            // montant fixe
    goldMin: 10,         // borne basse si 'random'
    goldMax: 30,         // borne haute si 'random'
    propose: 3,          // objets proposés (0–6)
    keep: 1,             // objets à garder (1–propose)
    category: 'consumable', // 'consumable' | 'equipment' | 'all'
  };
}

// Tire l'or du coffre selon la config (résolu UNE fois au début : même montant
// pour toutes les équipes quand 'random', cf. décision produit).
function resolveStarterGold(cfg) {
  if (cfg.goldMode !== 'random') return cfg.gold ?? 0;
  const lo = Math.min(cfg.goldMin ?? 0, cfg.goldMax ?? 0);
  const hi = Math.max(cfg.goldMin ?? 0, cfg.goldMax ?? 0);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Convertit les fiches du lobby (créées depuis les téléphones) en setupTeams.
// Dé-doublonne les noms (suffixe), assigne couleur/blason par défaut si absent,
// et CONSERVE le `token` (lien interne équipe↔téléphone, jamais publié).
export function buildLobbySetupTeams(rows) {
  const counts = {};
  return (rows || []).filter((r) => !r.removed).map((r, i) => {
    let name = (r.name || '').trim() || `Équipe ${i + 1}`;
    if (counts[name]) { counts[name] += 1; name = `${name} ${counts[name]}`; } else counts[name] = 1;
    return {
      name,
      color: r.color || TEAM_COLORS[i % TEAM_COLORS.length],
      emoji: r.emoji || TEAM_DEFAULT_EMOJIS[i] || '\u{1F3B2}',
      character: r.character || defaultCharacterFor(i),
      blazonGlyph: TEAM_BLAZON_GLYPHS[i] || 'lion',
      pos: 'depart', correct: 0, wrong: 0, streak: 0, money: 0,
      powerDef: r.power_def || null, powerOff: r.power_off || null,
      lv2: r.lv2 || null, // langue LV2 choisie au téléphone (si mode LV2 actif)
      sablierActif: false, doubleActive: false, turnsSinceShop: 0,
      token: r.token || null, // lien token↔équipe (interne au TBI, non publié)
    };
  });
}

// Compteur monotone d'id de VFX (foudre/bouclier) — un seul, partagé par tous
// les overlays, pour qu'un id ne se répète jamais d'affilée sur le champ `vfx`.
let vfxSeq = 0;

// Vrai si le Bouclier (pouvoir) ou un Bouclier de bois (consommable) a absorbe
// le recul entre l'etat avant/apres resolveWrongAnswer (declenche le son).
function bouclierAbsorbed(before, after) {
  return (
    (before.powers?.bouclier?.charges ?? 0) > (after.powers?.bouclier?.charges ?? 0) ||
    (before.itemShield ?? 0) > (after.itemShield ?? 0)
  );
}

// Pièges TRAVERSÉS pendant un déplacement (cases foulées SANS y finir le tour) :
// chacun a 50% de se déclencher ; le PREMIER qui part stoppe le pion sur la case
// (trajet tronqué) — il sera ensuite déclenché par handleLanding. La case où le
// tour se TERMINE n'est PAS passée ici : un arrêt PILE dessus déclenche à 100%
// (géré par handleLanding). `touched` = cases traversées, dans l'ordre. Retourne :
//   { idx, missed } — idx = index dans `touched` de la case fatale (-1 si aucune),
//   missed = ids des cases piégées frôlées (50% raté) AVANT la fatale (restent armées).
function scanTraversedTraps(board, touched, immune = false) {
  // Équipe immunisée aux pièges : elle glisse au-dessus sans jamais être stoppée
  // ni déclencher quoi que ce soit (les pièges restent armés pour les autres).
  if (immune) return { idx: -1, missed: [] };
  const missed = [];
  for (let i = 0; i < touched.length; i++) {
    const id = touched[i];
    if (board[id]?.trap) {
      if (Math.random() < 0.5) return { idx: i, missed };
      missed.push(id);
    }
  }
  return { idx: -1, missed };
}

// Manette téléphone : uid des intents `turn*` déjà appliqués (anti-doublon —
// fetch de rattrapage + realtime peuvent livrer la même ligne, et certains
// handlers ne sont pas idempotents). Module-level : jamais publié ni persisté.
const turnIntentSeen = new Set();

// UI state reset shared by nextTurn, resumeGame, reset.
// NB: movePath n'est PAS reset ici — les animations de deplacement doivent
// survivre au changement de tour (ex: recul apres mauvaise reponse) et sont
// nettoyees par clearTeamMove quand chaque pion finit son trajet.
const TURN_RESET = {
  diceValue: null,
  pendingMove: null,
  pendingLanding: false,
  awaitingChoice: false,
  preRollPos: null,
  preRollValue: null,
  showTargetPicker: null,
  showShop: false,
  showShopPrompt: false,
  showInventory: false,
  showDuelChoice: null,
  indiceUsed: false,
  indiceHidden: [],
  freeActivation: false,
  showChargePicker: false,
  // Sélecteur de métier (extension « metier ») : re-évalué à chaque début de tour.
  showMetierPicker: false,
  // Moteur d'effets composable (objets) : file + interrupts transitoires
  pendingActions: null,
  showTilePicker: null,
  showActionDice: null,
  forgeCeremony: null,
  relanceCount: 0,
  showSubjectPicker: false,
  inspectTrap: null,
  rerollUsed: false,
  trapDepth: 0,
  // Case événement = événement + question : flag posé à l'atterrissage, consommé
  // par finishEventTurn ; effacé par les événements qui ont déjà leur question.
  pendingEventQuestion: null,
  forcedSubject: null,
  deferredTurnEnd: null,
};

// Retire une « spec » d'offre (or + objets sac + équipement) d'une équipe ; renvoie
// { team, items, gold } ou null si impossible (or/objet absent). Partagé par le
// troc (applyTrade) et le PAIEMENT de la prestation de forgeage (applyForgeService).
// Préserve les enchantements (instances { key, enchants }).
function takeSpecFrom(team, spec = {}) {
  const t = { ...team };
  const items = [];
  const gold = Math.max(0, Math.trunc(spec.gold || 0));
  if ((t.money || 0) < gold) return null;
  t.money = (t.money || 0) - gold;
  const bag = itemH.normalizeBag(t.bag);
  for (const key of (spec.bag || [])) {
    const i = bag.findIndex((c) => itemH.cellKey(c) === key && ITEMS[key]);
    if (i < 0) return null;
    const n = itemH.cellN(bag[i]);
    const ench = itemH.cellEnchants(bag[i]);
    bag[i] = n > 1 ? itemH.mkCell(key, n - 1) : null;
    items.push(ench.length ? { key, enchants: ench } : key);
  }
  t.bag = bag;
  const equip = { ...(t.equipment || {}) };
  for (const slot of (spec.equip || [])) {
    const ek = itemH.cellKey(equip[slot]);
    if (!ek || !ITEMS[ek]) return null;
    items.push(equip[slot]);
    equip[slot] = null;
  }
  t.equipment = equip;
  return { team: t, items, gold };
}

// Donne or + objets à une équipe (équipement reçu va au sac ; sac plein → revente
// auto via placeItem).
function giveSpecTo(team, items, gold) {
  let t = { ...team, money: (team.money || 0) + (gold || 0) };
  for (const key of items) { t = itemH.placeItem(t, key).team; }
  return t;
}

export const useGameStore = create((set, get) => ({
  // --- Phase ---
  phase: 'setup',
  setPhase: (phase) => set({ phase }),

  // Bac a sable dev : partie simulee qui ne touche pas a la sauvegarde
  devSandbox: false,

  // --- Setup state ---
  // `level` est un TABLEAU de niveaux (sélection multiple). 'cycle4' = méta
  // (= tout le cycle 4), mutuellement exclusif avec les niveaux précis.
  level: ['cycle4'],
  setLevel: (level) => set({ level: Array.isArray(level) ? level : [level] }),
  toggleLevel: (key) => set((s) => {
    const cur = Array.isArray(s.level) ? s.level : [s.level];
    const META = 'cycle4';
    if (key === META) return { level: [META] };           // méta : remplace tout
    const grades = cur.filter((l) => l !== META);          // on quitte la méta
    const next = grades.includes(key) ? grades.filter((l) => l !== key) : [...grades, key];
    return { level: next.length ? next : [key] };          // garder ≥ 1 niveau
  }),

  // Pool de questions « spécial Brevet » (DNB) ajouté par-dessus le niveau choisi
  useBrevet: false,
  setUseBrevet: (v) => set({ useBrevet: v }),

  // Matières activées sur le plateau (sous-ensemble de SUBJECT_KEYS). Défaut =
  // les 6 historiques ; Allemand/Espagnol s'activent quand elles ont du contenu.
  selectedSubjects: DEFAULT_BOARD_SUBJECTS.slice(),
  toggleSubject: (key) => set((s) => {
    const cur = Array.isArray(s.selectedSubjects) ? s.selectedSubjects : DEFAULT_BOARD_SUBJECTS;
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    return { selectedSubjects: next.length ? next : cur }; // garder ≥ 1 matière
  }),

  // Mode « LV2 au choix » : quand Allemand ET Espagnol sont sélectionnés, fusionne
  // les deux en une seule filière `lv2` sur le plateau ; chaque équipe répond dans
  // SA langue (team.lv2, choisie à la création d'équipe).
  lv2Mode: false,
  setLv2Mode: (v) => set({ lv2Mode: !!v }),

  // Mode anglais : affiche les questions (énoncé/choix/explication) en anglais
  // quand une traduction existe (repli FR sinon). Flag global choisi au Setup.
  englishMode: false,
  setEnglishMode: (v) => set({ englishMode: !!v }),

  // Matières réellement posées sur le plateau (set au démarrage) : sert à
  // `randomBoardSubject` pour que les cases « multi »/jonctions ne tirent que
  // parmi la sélection effective (et 'lv2' si le mode est actif).
  boardSubjects: SUBJECT_KEYS.slice(),
  // Mode multi-thèmes : une voie = un THÈME qui pioche parmi ses sous-thèmes.
  // `categoryPools[themeKey] = [sousThèmes]`. Vide en mono-thème (Collège seul)
  // → résolution identité, comportement historique. Posé au startGame.
  categoryPools: {},
  randomBoardSubject: () => {
    const pool = get().boardSubjects;
    const list = Array.isArray(pool) && pool.length ? pool : SUBJECT_KEYS;
    return list[Math.floor(Math.random() * list.length)];
  },
  // Résout une CATÉGORIE de voie vers un sous-thème concret (clé de pool de
  // questions) pour une équipe :
  //  - thème multi (categoryPools[cat]) → un de ses sous-thèmes au hasard ;
  //  - 'lv2' → la langue de l'équipe (team.lv2, repli espagnol) ;
  //  - sinon → identité (sous-thème direct ; mode mono = historique).
  resolveSubjectFor: (subject, teamIdx) => {
    const pool = get().categoryPools?.[subject];
    if (Array.isArray(pool) && pool.length) {
      const sub = pool[Math.floor(Math.random() * pool.length)];
      return sub === 'lv2' ? (get().teams[teamIdx]?.lv2 || 'espagnol') : sub;
    }
    if (subject !== 'lv2') return subject;
    return get().teams[teamIdx]?.lv2 || 'espagnol';
  },

  // Duels : true = duel forcé automatique (historique) ; false = l'équipe qui
  // arrive sur une case occupée CHOISIT de défier (et qui) ou non.
  forcedDuels: false,
  setForcedDuels: (v) => set({ forcedDuels: v }),

  // Manette téléphone : l'équipe ACTIVE peut piloter son tour depuis son
  // téléphone (dé, réponse, choix…) via les intents `turn*`. Le TBI reste
  // maître et utilisable en parallèle (premier arrivé gagne). Piloté par la
  // carte « 🕹️ Téléphone-manette » du MODE DE JEU (console Setup) — implique
  // le mode connexion 'phone' (les téléphones doivent posséder leur équipe).
  phoneController: false,
  setPhoneController: (v) => set({ phoneController: !!v }),

  // Mode de connexion (Setup) : 'board' = équipes créées au tableau (historique) ;
  // 'phone' = équipes créées depuis les téléphones (lobby + QR).
  connectionMode: 'board',
  setConnectionMode: (m) => { if (get().phase === 'setup') set({ connectionMode: m }); },
  // Session partagée (mode téléphone) : code de lobby/partie + équipes du lobby
  // (live, alimentées depuis Supabase par LobbyPanel).
  sessionCode: null,
  lobbyTeams: [],
  setSessionCode: (c) => set({ sessionCode: c }),
  setLobbyTeams: (rows) => set({ lobbyTeams: Array.isArray(rows) ? rows : [] }),

  // Étiquette « classe / séance » (ex. « 6eB ») saisie au Setup : sert de clé de
  // regroupement pour le suivi multi-séances dans le dashboard d'analyse.
  classLabel: '',
  setClassLabel: (v) => { if (get().phase === 'setup') set({ classLabel: String(v || '').slice(0, 40) }); },

  // Style de carte des nouvelles parties (toggle DEV) : 'space' | 'legacy'
  setMapStyle: (v) => set({ mapStyle: v === 'legacy' ? 'legacy' : 'space' }),

  nbTeams: 3,
  setNbTeams: (n) => set({ nbTeams: n, setupTeams: createDefaultTeams(n) }),

  setupTeams: createDefaultTeams(3),
  updateSetupTeam: (index, updates) => {
    const teams = [...get().setupTeams];
    teams[index] = { ...teams[index], ...updates };
    set({ setupTeams: teams });
  },

  boardParams: {
    casesParVoie: 6, nbVoies: 3, nbSections: 3,
    voieFinale: 'court-long', couloirsMix: 4, eventEveryX: 3,
  },
  setBoardParam: (key, value) => {
    set({ boardParams: { ...get().boardParams, [key]: value } });
  },

  // --- Extensions (modules activables, choisis au Setup, verrouillés en jeu) ---
  extensions: defaultExtensions(),
  toggleExtension: (id) => {
    // Verrou : on ne bascule une extension qu'au Setup (élimine les états
    // incohérents en pleine partie : objets équipés orphelins, stock, events…).
    if (get().phase !== 'setup') return;
    set((s) => ({
      extensions: applyExtensionToggle(s.extensions, id, !extOn(s.extensions, id)),
    }));
  },
  // Helper interne : l'extension « objets/équipement » est-elle active ?
  itemsEnabled: () => extOn(get().extensions, 'equipment'),
  // Familles d'objets ajoutées à la boutique selon les extensions actives
  // (ingrédients si Alchimie, parchemins si Enchantement).
  shopFamilies: () => [
    ...(extOn(get().extensions, 'alchemy') ? ['ingredient'] : []),
    ...(extOn(get().extensions, 'enchant') ? ['parchment'] : []),
  ],

  enabledEvents: Object.keys(EVENTS),
  toggleEvent: (key) => {
    const { enabledEvents } = get();
    set({ enabledEvents: enabledEvents.includes(key) ? enabledEvents.filter((k) => k !== key) : [...enabledEvents, key] });
  },
  setAllEvents: (enabled) => set({ enabledEvents: enabled ? Object.keys(EVENTS) : [] }),
  // Coche/décoche un SOUS-ENSEMBLE d'événements (ex : un groupe positif/négatif…).
  setEventsFor: (keys, enabled) => set((s) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    const cur = new Set(s.enabledEvents || []);
    ks.forEach((k) => { if (enabled) cur.add(k); else cur.delete(k); });
    return { enabledEvents: [...cur].filter((k) => EVENTS[k]) };
  }),
  // Réconcilie enabledEvents avec le catalogue après chargement des événements
  // custom : les NOUVELLES clés (jamais vues, suivies par knownEventKeys) sont
  // activées par défaut ; un événement décoché n'est pas re-coché. Setup only.
  knownEventKeys: Object.keys(EVENTS),
  syncEnabledEvents: () => {
    const all = Object.keys(EVENTS);
    set((s) => {
      if (s.phase !== 'setup') return { knownEventKeys: all };
      const known = s.knownEventKeys || [];
      const fresh = all.filter((k) => !known.includes(k));
      const enabled = [...(s.enabledEvents || []).filter((k) => EVENTS[k]), ...fresh];
      return { enabledEvents: [...new Set(enabled)], knownEventKeys: all };
    });
  },

  // Objets actives (boutique, coffres, marchand, butin) — meme principe que les evenements
  enabledItems: Object.keys(ITEMS),
  toggleItem: (key) => {
    const { enabledItems } = get();
    set({ enabledItems: enabledItems.includes(key) ? enabledItems.filter((k) => k !== key) : [...enabledItems, key] });
  },
  setAllItems: (enabled) => set({ enabledItems: enabled ? Object.keys(ITEMS) : [] }),
  // Resynchronise la liste des objets activés sur le catalogue courant (après
  // (re)chargement depuis Supabase). PRÉSERVE les choix manuels : retire les
  // clés disparues, ajoute seulement les objets RÉELLEMENT nouveaux (jamais vus,
  // suivis par knownItemKeys) — un objet décoché n'est donc pas re-coché. N'agit
  // sur enabledItems qu'au setup, pour ne pas perturber une partie en cours.
  itemsVersion: 0,
  knownItemKeys: Object.keys(ITEMS),
  syncEnabledItems: () => {
    const all = Object.keys(ITEMS);
    set((s) => {
      if (s.phase !== 'setup') return { knownItemKeys: all, itemsVersion: s.itemsVersion + 1 };
      const known = s.knownItemKeys || [];
      const fresh = all.filter((k) => !known.includes(k)); // jamais vus → activés par défaut
      const enabled = [...s.enabledItems.filter((k) => ITEMS[k]), ...fresh];
      return { enabledItems: [...new Set(enabled)], knownItemKeys: all, itemsVersion: s.itemsVersion + 1 };
    });
  },

  // --- Game state ---
  teams: [],
  currentTeam: 0,
  board: null,
  boardDecor: null,
  // Mode « espace » (maps v2) : couches de rendu (continents, socles par case,
  // étoiles/nébuleuses/constellations). null = plateau procédural legacy —
  // c'est CE champ (persisté) qui pilote le mode de rendu de BoardSVG.
  boardSpace: null,
  // Style de carte pour les NOUVELLES parties : 'space' (défaut) | 'legacy'
  // (île/océan procédural, conservé derrière le toggle DEV le temps du chantier).
  mapStyle: 'space',
  viewBox: { w: 2400, h: 620 },
  finished: false,
  askedQuestions: {},
  questions: {},
  log: [],

  // --- Analytics : journal STRUCTURÉ pour le dashboard d'analyse (≠ log texte) ---
  // Réinitialisé à chaque startGame. `answers` = 1 entrée par question répondue
  // OU expirée ; `itemUses`/`powerUses` = usages d'objets/pouvoirs. Archivé une
  // seule fois en fin de partie (cf. StatsArchiver + archiveGameStats).
  gameStats: { startedAt: null, classLabel: '', subjects: [], level: [], answers: [], itemUses: [], powerUses: [] },
  statsArchived: false,

  // --- UI state ---
  rolling: false,
  diceValue: null,
  pendingMove: null,
  pendingLanding: false,
  _landingSeq: 0,
  _landingId: 0,
  freeActivation: false,
  showChargePicker: false,
  // Choix de voie (Maîtrise) au passage L5/L10 : { powerKey, slot, teamIdx } | null
  showSpecPicker: null,
  // Sélecteur de pièce à enchanter (parchemin) : { bagIndex, slots } | null
  showEnchantPicker: null,
  awaitingChoice: false,
  // Révélation d'objet (visuel C) : { itemKey, title?, subtitle? } | null
  lootReveal: null,
  showQuestion: null,
  showEvent: null,
  showFight: null,
  // Choix de duel (mode non forcé) : { defenders:[idx], subject } | null
  showDuelChoice: null,
  eventApplied: false,
  showTargetPicker: null,
  // Investissement : modale de mise à l'activation { teamIndex, gold, rate } | null
  showInvestPicker: null,
  // Bilan d'investissement à afficher après une bonne réponse (post-loot)
  // { teamIndex, stake, rate, payout } | null, + résultat en attente pendant le loot.
  investResult: null,
  pendingInvestResult: null,
  indiceUsed: false,
  indiceHidden: [],
  showDiceModal: false,
  showShop: false,
  // Prompt « Visiter la boutique ? » proposé en début de tour (transitoire,
  // non persisté) : true | false
  showShopPrompt: false,
  showInventory: false,
  // Stock rotatif de la boutique d'objets : renouvelé tous les N tours
  shopStock: [],
  shopStockTurns: 0,
  // Coffre de départ : configuration (Setup) + or résolu une fois au début
  // (null tant que la partie n'a pas démarré → résolu depuis la config si besoin).
  starterChestConfig: defaultStarterChestConfig(),
  starterGold: null,
  preRollPos: null,
  preRollValue: null,
  // Animations: [{ teamIndex, waypoints: [{x,y},...], type: 'forward'|'back' }, ...]
  // Tableau pour supporter plusieurs pions en mouvement (tempete, echange...).
  movePath: null,

  // --- Événements de terrain (« météo », extension `weather`) ---
  // weather        : météo AMBIANTE en cours { id, nature:'ambient', turnsLeft, factor } | null
  // weatherNotice  : préavis (1 tour à l'avance) { id } | null
  // weatherCeremony: overlay transitoire en cours { id, icon, ... } | null (auto-fermé)
  // turnCount      : compteur global de tours (sert à la cadence météo)
  // lastWeatherTurn: turnCount du dernier déclenchement (cooldown)
  weather: null,
  weatherNotice: null,
  weatherCeremony: null,
  turnCount: 0,
  lastWeatherTurn: 0,

  // --- Power selection ---
  powerSetupIndex: 0,
  powerSetupCategory: 'def',

  // Incrémenté quand les questions sont (re)chargées depuis Supabase : permet au
  // Setup de rafraîchir ses compteurs sans bloquer le boot. Voir questionsConfig.
  questionsVersion: 0,
  bumpQuestionsVersion: () => set((s) => ({ questionsVersion: s.questionsVersion + 1 })),

  // --- Log ---
  // msg : chaîne OU objet { text, detail:[{label, amount?, note?}] } (cf. logFormat).
  addLog: (msg) => set({ log: [...get().log, msg] }),

  // --- Analytics : enregistre un événement structuré dans gameStats ---
  // category ∈ { 'answers', 'itemUses', 'powerUses' }. Chaque entrée reçoit un
  // `seq` (ordre) et un horodatage `at`. No-op si la catégorie est inconnue.
  // Session « scolaire » = tous les thèmes des voies du plateau sont de kind 'school'
  // (Collège, Lycée…). L'analyse de données (recordStat/archivage) y est RÉSERVÉE :
  // un thème ludique (Film, Sport…) ne pollue pas les stats de classe (DESIGN_MODULES §15).
  isSchoolSession: () => {
    const cats = get().boardSubjects;
    if (!Array.isArray(cats) || !cats.length) return true; // défaut : scolaire (rétro-compat)
    const themeOf = (k) => (MODULES[k] ? k : (SUBJECTS[k]?.module || 'college'));
    return [...new Set(cats.map(themeOf))].every((t) => (MODULES[t]?.kind ?? 'school') === 'school');
  },
  // Vrai s'il y a AU MOINS une matière scolaire sur le plateau (≠ isSchoolSession
  // qui exige que TOUTES le soient). Sert au gating de bossProf (`requiresSchool`).
  hasSchoolSubject: () => {
    const cats = get().boardSubjects;
    if (!Array.isArray(cats) || !cats.length) return true; // défaut : scolaire (rétro-compat)
    const themeOf = (k) => (MODULES[k] ? k : (SUBJECTS[k]?.module || 'college'));
    return [...new Set(cats.map(themeOf))].some((t) => (MODULES[t]?.kind ?? 'school') === 'school');
  },
  recordStat: (category, payload) => set((s) => {
    // Analyse réservée aux sessions scolaires (sinon no-op).
    if (!get().isSchoolSession()) return {};
    const gs = s.gameStats;
    const arr = Array.isArray(gs?.[category]) ? gs[category] : null;
    if (!arr) return {};
    return { gameStats: { ...gs, [category]: [...arr, { seq: arr.length, at: new Date().toISOString(), ...payload }] } };
  }),

  // --- Coffre de départ : config (Setup uniquement, verrouillé en partie) ---
  setStarterChestConfig: (patch) => {
    if (get().phase !== 'setup') return;
    set((s) => ({ starterChestConfig: { ...s.starterChestConfig, ...patch } }));
  },

  // --- Révélation d'objet (visuel C) ---
  // Coffre de départ : ouvert une fois par équipe à son premier tour (20 PO +
  // un consommable). La récompense est tirée à l'avance (lastStarterReward) pour
  // que l'aperçu de la modale corresponde au butin réellement accordé.
  showStarterChest: false,
  lastStarterReward: null,
  triggerStarterChest: () => {
    const { teams, currentTeam } = get();
    const t = teams[currentTeam];
    const cfg = get().starterChestConfig || defaultStarterChestConfig();
    // Coffre désactivé (config) ou extension objets coupée : pas de coffre.
    if (!get().itemsEnabled() || !cfg.enabled) { set({ showStarterChest: false, lastStarterReward: null }); return; }
    if (!t || t.starterChestOpened) { set({ showStarterChest: false, lastStarterReward: null }); return; }
    // Pool d'objets proposés selon la catégorie choisie (hors légendaires lootOnly).
    const enabled = get().enabledItems || Object.keys(ITEMS);
    const pool = enabled.filter((k) => {
      const it = ITEMS[k];
      if (!it || it.lootOnly || it.family) return false; // pas d'ingrédient/potion/parchemin au coffre de départ
      if (cfg.category === 'consumable') return it.slot === 'consumable';
      if (cfg.category === 'equipment') return it.slot !== 'consumable';
      return true; // 'all'
    });
    const propose = Math.max(0, Math.min(6, cfg.propose ?? 3));
    const choices = propose > 0
      ? itemH.pickWeightedItems(propose, pool, (item) => (item.rarity === 'commun' ? 3 : 2))
      : [];
    const keep = Math.max(1, Math.min(cfg.keep ?? 1, choices.length || 1));
    // Or pré-résolu au début de partie (même montant pour tous) ; sinon résolu ici.
    const gold = get().starterGold ?? resolveStarterGold(cfg);
    set({ showStarterChest: true, lastStarterReward: { gold, choices, keep } });
  },
  // Ferme le coffre de départ : verse l'or + les objets CHOISIS (jusqu'à `keep`).
  // `chosen` : une clé (compat) OU un tableau de clés ; validées contre la liste.
  closeStarterChest: (chosen = null) => {
    const { teams, currentTeam, lastStarterReward, addLog } = get();
    const t = teams[currentTeam];
    if (!t) { set({ showStarterChest: false, lastStarterReward: null }); return; }
    const gold = lastStarterReward?.gold || 0;
    const choices = lastStarterReward?.choices || [];
    const keep = lastStarterReward?.keep || 1;
    const arr = Array.isArray(chosen) ? chosen : (chosen ? [chosen] : []);
    // Garde au plus `keep` clés valides et distinctes.
    const seen = new Set();
    const chosenKeys = [];
    for (const k of arr) {
      if (choices.includes(k) && !seen.has(k) && chosenKeys.length < keep) { seen.add(k); chosenKeys.push(k); }
    }
    let placed = { ...t, money: (t.money ?? 0) + gold, starterChestOpened: true };
    const names = [];
    for (const k of chosenKeys) {
      placed = itemH.placeItem(placed, k).team; // équipe (slot libre) ou met au sac
      names.push(`${ITEMS[k].icon} ${loc(ITEMS[k], 'name')}`);
    }
    const nt = [...teams];
    nt[currentTeam] = placed;
    set({ teams: nt, showStarterChest: false, lastStarterReward: null });
    addLog(tg('log.store.starterChest', {
      emoji: t.emoji, name: t.name, gold,
      items: names.length ? tg('log.store.starterChest.items', { names: names.join(', ') }) : tg('log.store.starterChest.empty'),
    }));
    get().checkMoneyMilestone(currentTeam); // les pièces volent (FlyingCoins) au changement d'or
    get().triggerMetierPicker(); // enchaîne le choix de métier juste après le coffre
    if (get().phase === 'game') saveGame(get());
  },

  // --- Métiers (extension « metier ») : une équipe choisit UN métier à son 1er
  // tour, juste après le coffre de bienvenue, puis ne pratique plus QUE cet
  // artisanat (forge / alchimie / enchantement). Choix DÉFINITIF (verrou). ---
  // Ouvre le sélecteur pour l'équipe active si l'extension est active et qu'elle
  // n'a pas encore choisi. No-op sinon (extension coupée ou métier déjà fixé).
  triggerMetierPicker: () => {
    const { teams, currentTeam, extensions } = get();
    if (metierPending(extensions, teams[currentTeam])) set({ showMetierPicker: true });
  },
  // Fixe DÉFINITIVEMENT le métier d'une équipe. TBI : équipe active ; mobile :
  // `teamIndex` (intent du propriétaire). Ignoré si déjà choisi (verrou) ou métier
  // invalide. Ferme la modale uniquement si c'est l'équipe active du TBI.
  chooseMetier: (craft, teamIndex) => {
    const st = get();
    const idx = teamIndex ?? st.currentTeam;
    const team = st.teams[idx];
    if (!team || team.metier) return;             // déjà choisi → verrou
    if (!METIER_IDS.includes(craft)) return;       // métier inconnu
    if (!metierActive(st.extensions)) return;      // extension coupée
    const nt = [...st.teams];
    nt[idx] = { ...team, metier: craft };
    const closing = idx === st.currentTeam ? { showMetierPicker: false } : {};
    set({ teams: nt, ...closing });
    const m = METIER_BY_ID[craft];
    st.addLog(tg('log.store.metierChosen', {
      emoji: team.emoji, name: team.name, metier: m ? metierName(m, getLang()) : craft,
    }));
    if (get().phase === 'game') saveGame(get());
  },

  // Paliers d'or : un message motivant la première fois qu'une équipe franchit
  // 20 / 40 / 60 pièces, pour l'inviter à dépenser en boutique.
  checkMoneyMilestone: (teamIdx) => {
    const teams = get().teams;
    const t = teams[teamIdx];
    if (!t) return;
    const THRESHOLDS = [20, 40, 60];
    const last = t.moneyMilestone || 0;
    const reached = THRESHOLDS.filter((th) => th > last && (t.money ?? 0) >= th);
    if (!reached.length) return;
    const th = Math.max(...reached);
    const nt = [...teams];
    nt[teamIdx] = { ...t, moneyMilestone: th };
    set({ teams: nt });
    const msg = tg(`log.store.milestone.${th}`);
    effectH.announce(set, get, '💰', `${t.emoji} ${msg}`, '#c8911f');
    get().addLog(tg('log.store.milestone', { emoji: t.emoji, name: t.name, msg }));
  },

  showLoot: (itemKey, opts = {}) => set({ lootReveal: { itemKey, ...opts } }),
  dismissLoot: () => {
    const lr = get().lootReveal;
    // File de révélations (ex. consommable + équipement lootés au même tour) :
    // on enchaîne sur l'objet suivant au lieu de fermer.
    if (lr?.rest?.length) {
      const [next, ...rest] = lr.rest;
      set({ lootReveal: { ...next, rest, thenClose: lr.thenClose, thenNextTurn: lr.thenNextTurn } });
      return;
    }
    set({ lootReveal: null });
    // Loot d'événement (coffre) : la révélation remplace le ResultPhase, donc
    // sa fermeture enchaîne sur le tour suivant (comme closeEvent).
    if (lr?.thenClose) {
      set({ showEvent: null, eventApplied: false });
      get().finishEventTurn();
    } else if (lr?.thenNextTurn) {
      // Loot de bonne réponse : une fois le butin fermé, on affiche l'éventuel
      // bilan d'investissement AVANT de passer la main (afterCorrectResolve), pour
      // que le coffre de départ de l'équipe suivante ne recouvre rien.
      get().afterCorrectResolve();
    }
  },

  // --- Investissement (bourse spatiale) ---
  // Modale de mise : l'équipe choisit combien investir (1 → tout son or) ou refuse.
  // Résout la file d'effets suspendue par l'action `invest` (cf. effectEngine).
  confirmInvest: (amount) => {
    const p = get().showInvestPicker;
    if (!p) return;
    const gold = p.gold ?? (get().teams[p.teamIndex]?.money || 0);
    const amt = Math.max(1, Math.min(Math.round(amount) || 0, gold));
    set({ showInvestPicker: null });
    effectH.resumeQueue(set, get, { _investAmount: amt });
  },
  cancelInvest: () => {
    if (!get().showInvestPicker) return;
    set({ showInvestPicker: null });
    effectH.resumeQueue(set, get, { _investAmount: 0 }); // 0 = refusé, aucune mise
  },
  // Après une bonne réponse (post-loot) : affiche le bilan d'investissement s'il y
  // en a un, sinon passe directement la main. Le bilan diffère nextTurn jusqu'à sa
  // fermeture (dismissInvestResult).
  afterCorrectResolve: () => {
    const pending = get().pendingInvestResult;
    if (pending) { set({ investResult: pending, pendingInvestResult: null }); return; }
    get().nextTurn();
  },
  dismissInvestResult: () => {
    if (!get().investResult) return;
    set({ investResult: null });
    get().nextTurn();
  },

  // --- Start game ---
  startGame: () => {
    const { level, useBrevet, selectedSubjects, lv2Mode } = get();
    const questions = getQuestions(level, { brevet: useBrevet });
    // Matières effectives = sélection ∩ matières ayant réellement des questions
    // (au niveau choisi) → on n'envoie jamais une matière au pool vide sur le
    // plateau. Repli sur toutes les matières avec contenu si la sélection est vide.
    let subjects = (selectedSubjects || DEFAULT_BOARD_SUBJECTS).filter((k) => questions[k]?.length);
    if (!subjects.length) subjects = SUBJECT_KEYS.filter((k) => questions[k]?.length);
    // LV2 au choix : si Allemand ET Espagnol sont présents, on les remplace par la
    // filière unique 'lv2' (chaque équipe répondra dans sa langue, cf. team.lv2).
    const lv2On = lv2Mode && LV2_SUBJECTS.every((k) => subjects.includes(k));
    if (lv2On) subjects = [...subjects.filter((k) => !LV2_SUBJECTS.includes(k)), 'lv2'];
    // RUSTINE (2026-06-22) : MIXAGE FIN demandé — chaque sous-thème coché devient sa
    // propre voie (ex. Français + Harry Potter = 2 voies distinctes), au lieu de la
    // granularité auto « 1 voie = 1 thème entier » de DESIGN_MODULES §0. C'est un
    // override volontaire et temporaire (cf. flag `fineMix`) ; la vraie granularité
    // (toggle / refonte) reste à concevoir.
    const FINE_MIX = true;
    const themeOf = (k) => SUBJECTS[k]?.module || 'college';
    // Tous les sous-thèmes avec contenu (fusion lv2 appliquée comme à la sélection).
    let allWithContent = SUBJECT_KEYS.filter((k) => questions[k]?.length);
    if (lv2On) allWithContent = [...allWithContent.filter((k) => !LV2_SUBJECTS.includes(k)), 'lv2'];
    const subthemesOf = (theme) => allWithContent.filter((k) => themeOf(k) === theme);
    const { boardCats, categoryPools } = boardCategoriesFor(subjects, themeOf, subthemesOf, FINE_MIX);
    // Mode multi : une voie = un THÈME (clé de module). Pseudo-catégorie d'affichage
    // construite depuis MODULES pour que le disque coloré du plateau la rende comme
    // une matière. Display-only (hors SUBJECT_KEYS), appliquée dans _beginGameWithBoard.
    const displayInject = {};
    if (Object.keys(categoryPools).length) {
      for (const themeKey of boardCats) {
        const m = MODULES[themeKey];
        if (m && !SUBJECTS[themeKey]) {
          displayInject[themeKey] = {
            module: themeKey, name: m.name, name_en: m.name_en, icon: m.icon,
            color: m.color || '#d9cda5', colorSoft: m.colorSoft, colorDeep: m.colorDeep,
            biome: m.biome, biome_en: m.biome_en,
          };
        }
      }
    }
    get()._beginGameWithBoard({ boardSubjects: boardCats, categoryPools, questions, displayInject, statsSubjects: subjects, lv2On });
  },

  // Lancement depuis un PÉRIMÈTRE (nouvel écran « lecteur de cassettes »).
  // Contourne la rustine FINE_MIX / boardCategoriesFor : le périmètre fournit
  // directement boardSubjects/categoryPools/displayInject (cf. src/logic/perimeter.js).
  startGameFromPerimeter: (perimeter) => {
    const { level = 'cycle4', boardSubjects, categoryPools, displayInject } = perimeter || {};
    if (!boardSubjects || !boardSubjects.length) return;
    set({ level });
    const questions = getQuestions(level, { brevet: get().useBrevet });
    get()._beginGameWithBoard({ boardSubjects, categoryPools, questions, displayInject, statsSubjects: boardSubjects, lv2On: false });
  },

  // Lancement « jeu en ligne » : les équipes viennent du LOBBY (créées par les
  // joueurs, jeton conservé), le plateau du périmètre (thèmes insérés). Comme les
  // fiches du lobby portent déjà leurs pouvoirs, on enchaîne directement en jeu.
  startOnlineGame: (perimeter) => {
    const setup = buildLobbySetupTeams(get().lobbyTeams);
    if (!setup.length) return false;
    set({ setupTeams: setup, nbTeams: setup.length });
    get().startGameFromPerimeter(perimeter);
    if (get().phase === 'powerSelect' && setup.every((t) => t.powerDef && t.powerOff)) {
      get().finalizePowersAndPlay();
    }
    return true;
  },

  openCompose: () => set({ phase: 'compose' }),

  // Queue commune de démarrage (partagée par startGame et startGameFromPerimeter) :
  // injecte les pseudo-catégories d'affichage, génère le plateau, construit les
  // équipes et passe en phase 'powerSelect'.
  _beginGameWithBoard: ({ boardSubjects, categoryPools, questions, displayInject, statsSubjects, lv2On = false }) => {
    const { setupTeams, boardParams } = get();
    // Injection display-only des voies larges dans le catalogue runtime SUBJECTS.
    if (displayInject) {
      for (const [key, cat] of Object.entries(displayInject)) {
        if (!SUBJECTS[key]) SUBJECTS[key] = cat;
      }
    }
    // Plateau : espace (continents flottants, défaut) ou procédural legacy
    const useSpace = get().mapStyle !== 'legacy';
    const { nodes, viewBox, space } = useSpace
      ? composeSpaceBoard({ ...boardParams, subjects: boardSubjects })
      : generateBoard({ ...boardParams, subjects: boardSubjects });
    const forgeOn = extOn(get().extensions, 'forge');
    const teams = setupTeams.map((t) => ({
      ...t, pos: 'depart', powers: {},
      // Langue LV2 de l'équipe (choisie à la création) ; repli espagnol si le mode
      // est actif mais qu'aucun choix n'a été fait.
      lv2: lv2On ? (t.lv2 || 'espagnol') : null,
      equipment: { head: null, body: null, feet: null },
      bag: Array(itemH.BAG_SIZE).fill(null),
      // Ingrédients d'alchimie déjà utilisés (effet révélé). Initialisé ici pour que
      // le masquage « ❓ Effet inconnu » s'applique dès le 1er tour (sinon le champ
      // n'apparaît qu'à la 1re distillation et l'effet fuite entre-temps).
      knownIngredients: [],
      // Métier (extension « metier ») : choisi au 1er tour, verrouillé ensuite.
      // null = pas encore choisi (ou extension inactive → jamais demandé).
      metier: null,
      // Forge de dés : dé standard 1→6 + stock de faces achetées (vide au départ).
      ...(forgeOn ? { dieFaces: defaultDieFaces(), faceStock: [] } : {}),
    }));
    set({
      devSandbox: false,
      phase: 'powerSelect', teams, board: nodes, viewBox, questions,
      boardSubjects,
      categoryPools,
      boardDecor: useSpace ? null : generateDecor(nodes),
      boardSpace: useSpace ? space : null,
      currentTeam: 0, finished: false, askedQuestions: {}, log: [],
      // Journal analytique neuf pour cette partie (cf. recordStat / dashboard).
      gameStats: {
        startedAt: new Date().toISOString(),
        classLabel: get().classLabel || '',
        subjects: statsSubjects, level: get().level || [],
        answers: [], itemUses: [], powerUses: [],
      },
      statsArchived: false,
      shopStock: get().itemsEnabled() ? itemH.generateShopStock(get().enabledItems, get().shopFamilies()) : [],
      shopStockTurns: 0,
      // Forge : vitrine ORGANISÉE PAR SLOT (une offre par slot 1→6, effets résolus only).
      shopFaceStock: forgeOn ? pickFaceStock() : [],
      ...TURN_RESET, movePath: null,
      showQuestion: null, showEvent: null, showFight: null, showDiceModal: false, eventApplied: false, lootReveal: null,
      // Météo : partie neuve → aucun état, compteurs à zéro.
      weather: null, weatherNotice: null, weatherCeremony: null, turnCount: 0, lastWeatherTurn: 0,
      powerSetupIndex: 0, powerSetupCategory: 'def',
    });
  },

  // --- Power selection flow ---
  selectPower: (teamIndex, category, powerKey) => {
    const teams = [...get().teams];
    if (category === 'def') {
      teams[teamIndex] = { ...teams[teamIndex], powerDef: powerKey };
    } else {
      teams[teamIndex] = { ...teams[teamIndex], powerOff: powerKey };
    }
    set({ teams });
  },

  advancePowerSetup: () => {
    const { powerSetupIndex, powerSetupCategory, teams } = get();
    // Idempotent : un double-tap sur la dernière carte (TBI) relançait la
    // transition et dupliquait le « Début de la partie ! » dans le journal
    if (get().phase !== 'powerSelect') return;
    const nextIndex = powerSetupIndex + 1;
    if (nextIndex >= teams.length) {
      if (powerSetupCategory === 'def') {
        set({ powerSetupCategory: 'off', powerSetupIndex: 0 });
      } else {
        get().finalizePowersAndPlay();
      }
    } else {
      set({ powerSetupIndex: nextIndex });
    }
  },

  // Finalise les pouvoirs choisis (powerDef/powerOff → charges) et lance la
  // partie. Partagé par la fin de la sélection au tableau ET le démarrage depuis
  // le lobby quand les pouvoirs ont déjà été choisis sur les téléphones.
  finalizePowersAndPlay: () => {
    const { teams, addLog } = get();
    const finalTeams = teams.map((t) => {
      const powers = { ...t.powers };
      if (t.powerDef && !powers[t.powerDef]) powers[t.powerDef] = { charges: INITIAL_CHARGES, level: 1 };
      if (t.powerOff && !powers[t.powerOff]) powers[t.powerOff] = { charges: INITIAL_CHARGES, level: 1 };
      return { ...t, powers };
    });
    addLog(tgPlural('log.store.gameStart', finalTeams.length, { n: finalTeams.length }));
    const starterGold = resolveStarterGold(get().starterChestConfig || defaultStarterChestConfig());
    set({ teams: finalTeams, phase: 'game', starterGold });
    get().triggerStarterChest();
    // Pas de coffre (désactivé/déjà ouvert) → proposer le métier directement.
    if (!get().showStarterChest) get().triggerMetierPicker();
  },

  // Démarre la partie à partir des équipes du lobby (mode téléphone). Construit
  // les setupTeams (dédoublonnage des noms, token conservé), génère le plateau,
  // puis : si toutes les équipes ont déjà leurs 2 pouvoirs (choisis au téléphone)
  // on lance directement ; sinon on passe par la sélection des pouvoirs au tableau.
  startFromLobby: () => {
    const setupTeams = buildLobbySetupTeams(get().lobbyTeams);
    if (!setupTeams.length) return false;
    set({ setupTeams, nbTeams: setupTeams.length });
    get().startGame();
    const allHavePowers = setupTeams.every((t) => t.powerDef && t.powerOff);
    if (allHavePowers) get().finalizePowersAndPlay();
    return true;
  },

  // --- Dice ---
  rollDice: () => {
    const { finished, rolling, showDiceModal, showFight, pendingActions, pendingLanding, awaitingChoice, showQuestion, showEvent, showStarterChest, showMetierPicker, showDuelChoice, teams, currentTeam } = get();
    if (finished || rolling || showDiceModal || showFight || showStarterChest || showMetierPicker || showDuelChoice) return;
    // Bloque le dé pendant une séquence d'effet (choix de case/cible/d6...) ou
    // tant que le tour n'est pas résolu (atterrissage, jonction, question).
    if (pendingActions || pendingLanding || awaitingChoice || showQuestion || showEvent) return;
    // Gel (Sablier L10) : l'équipe saute son lancer (flag consommé).
    if (teams[currentTeam]?.skipNextRoll) {
      const t = teams[currentTeam];
      const nt = [...teams];
      nt[currentTeam] = { ...t, skipNextRoll: false };
      set({ teams: nt });
      get().addLog(tg('log.store.frozen', { emoji: t.emoji, name: t.name }));
      get().nextTurn();
      return;
    }
    // Dé de mouvement : toujours un D6 (1→6).
    const finalValue = Math.floor(Math.random() * 6) + 1;
    set({ rolling: true, diceValue: finalValue, showDiceModal: true, relanceCount: 0 });
  },

  completeDiceRoll: () => {
    const { diceValue, teams, currentTeam } = get();
    const team = teams[currentTeam];
    // Relance (face Forge) : si la face tombée est une Relance, on RE-ANIME la
    // modale avec une nouvelle valeur (seule la dernière face compte, §6.2).
    // Enchaînement (re-relance) piloté par balanceConfig (défaut : une seule).
    if (team && diceValue && extOn(get().extensions, 'forge')) {
      const faces = getDieFaces(team);
      const face = faces[((diceValue - 1) % 6 + 6) % 6];
      const n = get().relanceCount || 0;
      if (isRelanceFace(face) && (n === 0 || (FORGE.relance?.enchainement && n < 6))) {
        const nv = Math.floor(Math.random() * 6) + 1;
        // Faces multi-effets : une Relance peut être co-localisée avec d'autres
        // effets de lancer (éditeur). On applique ici les effets « par patch »
        // (Prime, Égide/Indice/Répit/Aubaine/Butin armés…) AVANT de relancer,
        // sinon ils disparaîtraient (handleDiceResult n'est jamais appelé pour la
        // face-Relance). NB : la Recharge (gainCharge) reste non appliquée pour une
        // face-Relance car son sélecteur TBI entrerait en conflit avec la ré-animation.
        const forgeRoll = resolveFaceAtRoll(team, face);
        const nt = [...teams];
        nt[currentTeam] = { ...team, ...forgeRoll.patch };
        forgeRoll.logs.forEach((l) => get().addLog(l));
        get().addLog(tg('log.store.relanceFace', { emoji: team.emoji, name: team.name, value: clampFaceValue(faces[nv - 1].value) }));
        set({ teams: nt, diceValue: nv, relanceCount: n + 1, rolling: true }); // showDiceModal reste true → ré-animation
        return;
      }
    }
    set({ showDiceModal: false, rolling: false, relanceCount: 0 });
    if (diceValue) get().handleDiceResult(diceValue);
  },

  handleDiceResult: (value, opts = {}) => {
    const { teams, currentTeam, board, addLog } = get();
    const team = teams[currentTeam];
    // Buff \u00AB bonus de d\u00E9 \u00BB (effet de dur\u00E9e) : pendant sa dur\u00E9e, le d\u00E9placement
    // effectif = valeur du d\u00E9 + N. L'atterrissage sur la case finale est normal.
    // Forge de dés : le slot tiré (value = 1→6, l'adresse immuable) désigne une
    // FACE forgée dont la VALEUR (0→6) fait avancer. Dé standard ou extension
    // désactivée : face.value === value (comportement inchangé).
    // La face tirée (slot = value) donne la valeur de déplacement. La Relance est
    // résolue EN AMONT (completeDiceRoll ré-anime la modale, seule la dernière face
    // compte) : ici `face` n'est donc plus une face-Relance, sauf la dernière d'une
    // relance simple — auquel cas sa VALEUR s'applique normalement (§6.2).
    const face = getDieFaces(team)[((value - 1) % 6 + 6) % 6];
    const rawMove = clampFaceValue(face.value);
    // Dé chanceux (minRoll) : plancher garanti de la valeur de déplacement.
    const lucky = minRollFloor(team);
    const moveValue = Math.max(rawMove, lucky);
    const bonus = buffValue(team, 'diceBonus');
    // Malus de dé (passif d'équipement diceMalus) : réduit l'avancée de N cases à
    // CHAQUE lancer, sans recul ni aller-retour (≠ reculReduction qui n'amortit que
    // les reculs subis). Plancher à 0 : un malus ≥ valeur fait rester sur place.
    const malus = getEffectValue(team, 'diceMalus') + buffValue(team, 'diceMalus');
    // Météo « vent » (ambiante) : ×/÷ sur la valeur FINALE de déplacement (après
    // dé, Relance, bonus/malus). Facteur 1 si pas de vent / extension coupée.
    const windFactor = extOn(get().extensions, 'weather') ? weatherH.weatherMoveFactor(get) : 1;
    const eff = Math.max(0, Math.round((moveValue + bonus - malus) * windFactor));
    set({ preRollPos: team.pos, preRollValue: eff, freeActivation: false });
    // Météo « vent » : le déplacement effectif (eff) diffère de la valeur du dé →
    // le journal doit montrer l'avancée RÉELLE (et pas seulement la valeur brute).
    const windLabel = windFactor !== 1 ? (windFactor < 1 ? `÷${+(1 / windFactor).toFixed(2)}` : `×${+windFactor.toFixed(2)}`) : null;
    addLog(windLabel
      ? tg('log.store.roll.wind', { emoji: team.emoji, name: team.name, value: moveValue, factor: windLabel, eff })
      : bonus > 0
        ? tg('log.store.roll.bonus', { emoji: team.emoji, name: team.name, value: moveValue, bonus, eff })
        : malus > 0
          ? tg('log.store.roll.malus', { emoji: team.emoji, name: team.name, value: moveValue, malus, eff })
          : tg('log.store.roll', { emoji: team.emoji, name: team.name, value: moveValue }));
    // Effets de la face : 🎲 lancer (Prime…) appliqués maintenant ; ⏱️ avant
    // question (Égide…) armés pour ce tour (pipeline §6).
    const forgeRoll = resolveFaceAtRoll(team, face);
    forgeRoll.logs.forEach(addLog);

    const result = moveForward(board, team.pos, eff);

    // Pi\u00E8ges TRAVERS\u00C9S : 50% par case foul\u00E9e. On EXCLUT la case d'arr\u00EAt final
    // (arr\u00EAt pile = 100%, g\u00E9r\u00E9 par handleLanding) \u2014 sauf si le d\u00E9 s'arr\u00EAte sur
    // une JONCTION : on n'y finit pas le tour, donc c'est un passage (50%). Le
    // 1er pi\u00E8ge qui part stoppe le pion dessus ; handleLanding le d\u00E9clenche.
    const lastIdx = result.path.length - 1;
    const traversedEnd = result.stoppedAtJunction ? lastIdx : lastIdx - 1;
    const traversed = result.path.slice(1, traversedEnd + 1);
    const scan = scanTraversedTraps(board, traversed, isTrapImmune(team));
    let finalPos = result.finalPos;
    let path = result.path;
    let stoppedAtJunction = result.stoppedAtJunction;
    let remaining = result.remaining;
    if (scan.idx >= 0) {
      const hitPathIdx = scan.idx + 1; // traversed[i] === path[i + 1]
      path = result.path.slice(0, hitPathIdx + 1);
      finalPos = path[path.length - 1];
      stoppedAtJunction = false;
      remaining = 0;
    }
    // Pi\u00E8ges fr\u00F4l\u00E9s (50% rat\u00E9) : ils restent arm\u00E9s, on le signale au joueur.
    scan.missed.forEach((id) => {
      const lbl = board[id].trap.label ? tg('log.store.trap.label', { label: board[id].trap.label }) : '';
      addLog(tg('log.store.trapAvoided', { emoji: team.emoji, name: team.name, label: lbl }));
    });

    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, pos: finalPos, ...forgeRoll.patch };
    // Build animation waypoints from path
    const waypoints = path.map((id) => ({ x: board[id].x, y: board[id].y }));
    set({ teams: newTeams, movePath: [{ teamIndex: currentTeam, waypoints, type: 'forward' }] });

    // D\u00E9clencheurs on:roll de l'\u00E9quipement : ils d\u00E9pendent de la VALEUR du d\u00E9,
    // PAS de l'endroit o\u00F9 l'on s'arr\u00EAte. On les d\u00E9clenche donc AVANT de g\u00E9rer la
    // jonction/atterrissage ; finishQueue encha\u00EEne ensuite resolvePostRoll.
    // opts.skipOnRoll : une Relance ne re-d\u00E9clenche pas le bonus on:roll (d\u00E9j\u00E0
    // accord\u00E9 au 1er lancer) \u2192 \u00E9vite un double bonus.
    const postRoll = { stoppedAtJunction, remaining, junctionPos: finalPos };
    // Effets de face nécessitant le moteur/les interrupts (Recharge → sélecteur de
    // pouvoir TBI) : joués via la MÊME file que les déclencheurs on:roll, qui
    // enchaîne ensuite resolvePostRoll.
    const onRoll = [
      ...(opts.skipOnRoll ? [] : effectH.equipOnRollActions(team, value)),
      ...faceRollEngineActions(face),
    ];
    if (onRoll.length) {
      effectH.runEffects(set, get, onRoll, { source: 'roll', diceValue: value, postRoll });
      return;
    }
    get().resolvePostRoll(value, postRoll);
  },

  // R\u00E9solution apr\u00E8s le lancer (jonction / d\u00E9 de 1 / atterrissage), ex\u00E9cut\u00E9e
  // APR\u00C8S les \u00E9ventuels effets on:roll de l'\u00E9quipement.
  resolvePostRoll: (value, postRoll) => {
    const { teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    // Un effet on:roll a pu d\u00E9placer l'\u00E9quipe HORS de la jonction o\u00F9 le d\u00E9 s'\u00E9tait
    // arr\u00EAt\u00E9 : on ne propose le choix de voie que si elle s'y trouve toujours.
    if (postRoll?.stoppedAtJunction && team.pos === postRoll.junctionPos) {
      // Voie al\u00E9atoire : buff de dur\u00E9e, effet d'\u00E9quipement, OU flag one-shot
      // (randomPathNext, pos\u00E9 par un consommable/effet cibl\u00E9) : on choisit pour
      // le joueur. Le flag one-shot est consomm\u00E9 ici.
      // Pilote (Relance L5) : un one-shot qui force le choix MANUEL de voie, même
      // si l'équipe aurait normalement avancé au hasard.
      if (team.pilotNext) {
        const nt = [...teams];
        nt[currentTeam] = { ...team, pilotNext: false };
        set({ teams: nt, awaitingChoice: true, pendingMove: { remaining: postRoll.remaining } });
        addLog(tg('log.store.pilote'));
        return;
      }
      if (hasBuff(team, 'randomPath') || getEffectValue(team, 'randomPath') > 0 || team.randomPathNext) {
        const opts = get().board[team.pos]?.next || [];
        if (opts.length) {
          if (team.randomPathNext) {
            const nt = [...teams];
            nt[currentTeam] = { ...team, randomPathNext: false };
            set({ teams: nt, pendingMove: { remaining: postRoll.remaining } });
          } else {
            set({ pendingMove: { remaining: postRoll.remaining } });
          }
          addLog(tg('log.store.randomPath'));
          setTimeout(() => get().chooseJunction(opts[Math.floor(Math.random() * opts.length)]), 450);
          return;
        }
      }
      set({ awaitingChoice: true, pendingMove: { remaining: postRoll.remaining } });
      addLog(tg('log.store.choosePath'));
      return;
    }
    // (Le d\u00e9 de 1 ne recharge plus de pouvoir : cet effet passe d\u00e9sormais par
    //  l'\u00e9quipement \u2014 d\u00e9clencheur on:roll \u2192 action gainCharge.)
    set({ pendingLanding: true });
  },

  // --- Junction choice ---
  chooseJunction: (nextNodeId) => {
    const { teams, currentTeam, board, pendingMove } = get();
    const team = teams[currentTeam];
    const junctionPos = team.pos;
    // Deplacement d'objet (potion) : pas d'action de case a l'atterrissage,
    // et on ne touche pas au pendingLanding du tour en cours
    const noLanding = !!pendingMove?.noLanding;
    const resumeEngine = !!pendingMove?.resumeEngine; // move issu du moteur d'effets
    if (!noLanding) set({ pendingLanding: false });

    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, pos: nextNodeId };
    set({ teams: newTeams, awaitingChoice: false });

    if (pendingMove && pendingMove.remaining > 1) {
      const result = moveForward(board, nextNodeId, pendingMove.remaining - 1);
      // Pièges traversés sur la branche choisie (sauf déplacement d'objet) :
      // result.path[0] === nextNodeId. On exclut l'arrêt final (100% via
      // handleLanding), sauf si on s'arrête sur une jonction (= passage, 50%).
      const lastIdx = result.path.length - 1;
      const traversedEnd = result.stoppedAtJunction ? lastIdx : lastIdx - 1;
      const traversed = noLanding ? [] : result.path.slice(0, traversedEnd + 1);
      const scan = scanTraversedTraps(board, traversed, isTrapImmune(team));
      let fpos = result.finalPos;
      let cut = result.path;
      let stoppedAtJunction = result.stoppedAtJunction;
      if (scan.idx >= 0) {
        cut = result.path.slice(0, scan.idx + 1); // traversed[i] === path[i] : stoppe sur la case piégée
        fpos = cut[cut.length - 1];
        stoppedAtJunction = false;
      }
      if (!noLanding) scan.missed.forEach((id) => {
        const lbl = board[id].trap.label ? tg('log.store.trap.label', { label: board[id].trap.label }) : '';
        get().addLog(tg('log.store.trapAvoided', { emoji: team.emoji, name: team.name, label: lbl }));
      });
      const updatedTeams = [...get().teams];
      updatedTeams[currentTeam] = { ...updatedTeams[currentTeam], pos: fpos };
      // Animation depuis la jonction, en passant par la branche choisie
      const waypoints = [junctionPos, ...cut].map((id) => ({ x: board[id].x, y: board[id].y }));
      set({ teams: updatedTeams, pendingMove: null, movePath: [{ teamIndex: currentTeam, waypoints, type: 'forward' }] });

      if (stoppedAtJunction) {
        set({ awaitingChoice: true, pendingMove: { remaining: result.remaining, noLanding, resumeEngine } });
        return;
      }
    } else {
      // Pas de cases traversées : le pion s'arrête PILE sur nextNodeId
      // (arrêt = 100%, géré par handleLanding).
      const waypoints = [junctionPos, nextNodeId].map((id) => ({ x: board[id].x, y: board[id].y }));
      set({ pendingMove: null, movePath: [{ teamIndex: currentTeam, waypoints, type: 'forward' }] });
    }

    if (noLanding) {
      // Seule l'arrivee compte pour un deplacement d'objet
      const pos = get().teams[currentTeam].pos;
      if (board[pos]?.type === 'arrivee') {
        get().addLog(tg('log.store.finish', { emoji: get().teams[currentTeam].emoji, name: get().teams[currentTeam].name }));
        get().closeForgeService(); // rend l'escrow d'une éventuelle session de forge
        set({ finished: true });
      }
      // Move issu du moteur d'effets : reprendre la file (l'action move est terminee)
      if (resumeEngine && get().pendingActions) {
        effectH.resumeQueue(set, get, { junctionDone: true });
        return;
      }
      saveGame(get());
      return;
    }

    // Atterrissage différé : on passe par « Continuer » (comme un déplacement
    // sans jonction) pour laisser un moment d'achat / de pouvoirs avant la case.
    set({ pendingLanding: true });
  },

  // --- Landing ---
  handleLanding: () => {
    const { teams, currentTeam, board, addLog, enabledEvents } = get();
    const team = teams[currentTeam];
    const node = board[team.pos];

    if (!node) { get().nextTurn(); return; }

    // High-water-mark : mémorise la case la plus avancée (par x) jamais atteinte
    // par cette équipe — utilisé par l'action `teleportFurthest`.
    {
      const curMaxX = team.maxPos && board[team.maxPos] ? board[team.maxPos].x : -Infinity;
      if (node.x > curMaxX) {
        const nt = [...teams];
        nt[currentTeam] = { ...team, maxPos: team.pos };
        set({ teams: nt });
      }
    }

    if (node.type === 'arrivee') {
      addLog(tg('log.store.finish', { emoji: team.emoji, name: team.name }));
      get().closeForgeService(); // rend l'escrow d'une éventuelle session de forge
      set({ finished: true });
      saveGame(get());
      return;
    }

    // Piege sur la case : declenche pour TOUTE equipe (poseur compris), one-shot.
    // Resolu AVANT le combat (un recul peut sortir la victime de la case adverse).
    // L'atterrissage PILE sur un piège le déclenche à 100% (le 50% « au passage »
    // a déjà été résolu pendant le déplacement, qui aurait stoppé le pion plus tôt).
    if (node.trap && isTrapImmune(team)) {
      // Immunité aux pièges (passif d'équipement ou buff temporisé) : le piège
      // n'est PAS déclenché et reste armé sur la case (pour les autres équipes).
      addLog(tg('log.store.trapImmune', { emoji: team.emoji, name: team.name, label: node.trap.label ? tg('log.store.trap.label', { label: node.trap.label }) : '' }));
    } else if (node.trap) {
      const depth = get().trapDepth || 0;
      const trap = node.trap;
      const nb = { ...board };
      nb[team.pos] = { ...node }; delete nb[team.pos].trap; // nettoyage avant execution (idempotence)
      set({ board: nb, trapDepth: depth + 1 });
      soundTrap();
      get().emitVfx('trap', currentTeam); // visuel du déclenchement sur le pion
      addLog(tg('log.store.trap', { emoji: team.emoji, name: team.name, label: trap.label ? tg('log.store.trap.label', { label: trap.label }) : '' }));
      if (depth < 3) {
        // ownerTeam = le POSEUR : l'or volé par le piège lui revient (cf. applyMoney).
        effectH.runEffects(set, get, trap.do, { source: 'trap', ownerTeam: trap.ownerTeam });
        return;
      }
    }

    // Duel : la case (hors départ) est occupée par une/des autre(s) équipe(s).
    if (node.type !== 'depart') {
      const present = teams.filter((t, i) => i !== currentTeam && t.pos === team.pos);
      if (present.length) {
        const subj = node.type === 'subject' && node.subject !== 'multi' ? node.subject : get().randomBoardSubject();
        // Immunité (passif/buff) : l'arrivant immunisé ne duelle pas ; un défenseur
        // immunisé est exclu de la liste des cibles possibles.
        if (isDuelImmune(team)) {
          addLog(tg('log.store.duelImmune', { emoji: team.emoji, name: team.name }));
        } else {
          const presentIdx = teams.map((_, i) => i).filter((i) => i !== currentTeam && teams[i].pos === team.pos);
          // Cibles possibles vs cibles bloquées (immunisées) : ces dernières sont
          // affichées grisées dans la modale (non sélectionnables), pas masquées.
          const defenders = presentIdx.filter((i) => !isDuelImmune(teams[i]));
          const blocked = presentIdx.filter((i) => isDuelImmune(teams[i]));
          if (defenders.length === 0) {
            addLog(tg('log.store.duelImmuneFoes'));
          } else if (get().forcedDuels) {
            // Duel forcé (historique) : duel automatique avec le 1er adversaire.
            fightH.startFight(set, get, defenders[0], subj);
            return;
          } else {
            // Mode choix : l'arrivant décide (défier qui, ou refuser → case normale).
            set({ showDuelChoice: { defenders, blocked, subject: subj } });
            return;
          }
        }
      }
    }

    // Pas de duel → action normale de la case.
    get().resolveLandingCase();
  },

  // Action « normale » d'une case (hors duel) : événement, question de matière,
  // jonction… Extrait de handleLanding pour être réutilisé quand un duel est
  // refusé (declineDuel) ou évité (immunité).
  resolveLandingCase: () => {
    const { teams, currentTeam, board, addLog, enabledEvents } = get();
    const team = teams[currentTeam];
    const node = board[team.pos];
    if (!node) { get().nextTurn(); return; }

    if (node.type === 'event') {
      const picked = pickRandomEvent(enabledEvents, { itemsEnabled: get().itemsEnabled(), extensions: get().extensions, connectionMode: get().connectionMode, schoolSubject: get().hasSchoolSubject() });
      if (picked) {
        addLog(tg('log.store.landEvent', { emoji: team.emoji, name: team.name, eicon: picked.event.icon, ename: loc(picked.event, 'name') }));
        set({ pendingEventQuestion: { subject: node.subject || get().randomBoardSubject() } });
        eventH.triggerEvent(set, get, picked);
        return;
      }
      get().askQuestion(node.subject || get().randomBoardSubject());
      return;
    }

    if (node.type === 'subject') {
      const subj = node.subject === 'multi' ? get().randomBoardSubject() : node.subject;
      get().askQuestion(subj);
      return;
    }

    if (node.type === 'depart') { get().nextTurn(); return; }

    if (node.type === 'jonction') {
      get().askQuestion(get().randomBoardSubject());
      return;
    }

    get().nextTurn();
  },

  // L'arrivant accepte le duel contre l'équipe choisie (mode non forcé).
  chooseDuel: (defenderIndex) => {
    const dc = get().showDuelChoice;
    if (!dc || !dc.defenders.includes(defenderIndex)) return;
    set({ showDuelChoice: null });
    fightH.startFight(set, get, defenderIndex, dc.subject);
  },
  // L'arrivant refuse le duel → il joue la case normalement.
  declineDuel: () => {
    if (!get().showDuelChoice) return;
    const t = get().teams[get().currentTeam];
    get().addLog(tg('log.store.declineDuel', { emoji: t.emoji, name: t.name }));
    set({ showDuelChoice: null });
    get().resolveLandingCase();
  },

  // --- Questions ---
  askQuestion: (subject) => {
    // Thème forcé : per-équipe (posé par un adversaire ou par un on:roll de cette
    // équipe) prioritaire, sinon le forçage global historique. Consommé ici, et
    // s'applique à la PROCHAINE question de l'équipe concernée.
    const cur = get().currentTeam;
    // Relance opportune (Bouclier… non, Relance L5) : « tu choisis le thème ». On
    // ouvre le sélecteur de thème AVANT de tirer la question, puis on rejoue
    // askQuestion avec le thème choisi (le flag chooseSubject est consommé ici, le
    // bonus de temps restant l'est plus bas).
    const oppQ = get().teams[cur]?.relanceQ;
    if (oppQ?.chooseSubject && !get().showSubjectPicker) {
      const nt = [...get().teams];
      nt[cur] = { ...nt[cur], relanceQ: { ...oppQ, chooseSubject: false } };
      set({ teams: nt, showSubjectPicker: { source: 'opportune' } });
      return;
    }
    // Résout la catégorie de voie → sous-thème concret : thème multi → un de ses
    // sous-thèmes ; 'lv2' → langue de l'équipe ; sinon identité (mono = historique).
    subject = get().resolveSubjectFor(subject, cur);
    const teamForced = get().teams[cur]?.forcedSubject;
    const forced = teamForced || get().forcedSubject;
    if (forced) {
      subject = forced;
      if (teamForced) {
        const nt = [...get().teams];
        nt[cur] = { ...nt[cur], forcedSubject: null };
        set({ teams: nt, forcedSubject: null });
      } else {
        set({ forcedSubject: null });
      }
    }
    // Effet passif « Question Hardcore (X%) » : si le thème n'est pas déjà forcé,
    // X% de chance que la question bascule en Hardcore (uniquement si le pool existe).
    if (!forced) {
      const t0 = get().teams[cur];
      const hc = getEffectValue(t0, 'hardcoreChance');
      if (hc > 0 && (get().questions.hardcore || []).length && Math.random() * 100 < hc) {
        subject = 'hardcore';
        get().addLog(tg('log.store.hardcore', { emoji: t0.emoji, name: t0.name, pct: hc }));
      }
    }
    // Questions corsées (Double voie) : chance que CHAQUE question imposée bascule
    // en Hardcore (doubleHCChance = fraction 0→1, posée par la Double sur la cible).
    if (!forced && subject !== 'hardcore') {
      const t0 = get().teams[cur];
      if (t0?.doubleActive && t0.doubleHCChance && (get().questions.hardcore || []).length && Math.random() < t0.doubleHCChance) {
        subject = 'hardcore';
        get().addLog(tg('log.store.hardcore', { emoji: t0.emoji, name: t0.name, pct: Math.round(t0.doubleHCChance * 100) }));
      }
    }
    const { questions, askedQuestions, teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    // Thème de la partie, sinon (thème « surprise » forcé hors périmètre par un
    // effet) pool complet depuis le STORE global — sans précharge (tout est déjà
    // chargé au boot).
    const pool = (questions[subject]?.length ? questions[subject] : getSubjectPool(subject));
    const asked = askedQuestions[subject] || new Set();
    let result = pickQuestion(pool, asked);

    if (!result) {
      addLog(tg('log.store.noQuestion', { subject: SUBJECTS[subject] ? loc(SUBJECTS[subject], 'name') : subject }));
      get().nextTurn();
      return;
    }

    // Question fraîche (face Forge) : écarte la 1re question et en pioche une autre
    // (même thème). L'abandonnée est tracée (abandoned) mais hors stats de réussite.
    if (team.forgeFreshQ) {
      { const nt = [...get().teams]; nt[currentTeam] = { ...nt[currentTeam], forgeFreshQ: undefined }; set({ teams: nt }); }
      addLog(tg('log.store.freshQuestion', { emoji: team.emoji, name: team.name }));
      get().recordStat('answers', {
        teamIdx: currentTeam, teamName: team.name, subject,
        level: result.question.level || null, theme: result.question.t || null,
        qId: result.question.id ?? `${subject}:${result.index}`, qText: result.question.q,
        answers: result.question.a, correctIndex: result.question.c,
        chosenIndex: null, correct: false, timedOut: false, abandoned: true, timeLeftRatio: null,
        explanation: result.question.e || null,
      });
      const alt = pickQuestion(pool, result.newAsked); // exclut la question écartée
      if (alt) result = alt; // sinon (pool épuisé) : on garde la 1re
    }

    const { question: q, newAsked } = result;
    const subjectInfo = SUBJECTS[subject];
    addLog(tg('log.store.question', { icon: subjectInfo?.icon || '', subject: subjectInfo ? loc(subjectInfo, 'name') : subject }));

    // Sablier (one-shot : consomme a la 1re question) et Double niv.3
    // (doubleTimerDivisor : persiste sur la rafale, nettoye avec BURST_RESET)
    const sablierDiv = team.sablierActif ? (team.sablierDivisor || 2) : 1;
    const doubleDiv = (team.doubleActive && team.doubleTimerDivisor) || 1;
    const timerDivisor = Math.max(sablierDiv, doubleDiv);
    const timerHalved = timerDivisor > 1;
    // Modeleur de l'espace (Sablier voie) : intervalle de réarrangement des réponses
    // (one-shot, consommé avec le Sablier).
    const modeleur = team.modeleurInterval || null;
    // Sablier + Modeleur sont posés ensemble par le cast, mais on nettoie chacun
    // dès qu'il est présent (robuste même si l'un manque).
    if (team.sablierActif || team.modeleurInterval) {
      const nt = [...get().teams];
      nt[currentTeam] = { ...nt[currentTeam], sablierActif: false, sablierDivisor: undefined, modeleurInterval: undefined };
      set({ teams: nt });
    }
    if (timerHalved) {
      addLog(tg('log.store.sablier', { div: timerDivisor }));
    }

    // Bonus de temps : equipement (permanent) + consommable Sablier de poche (one-shot)
    // + crédit « Vol de temps » (Sablier L10, one-shot) + Relance opportune (L5, one-shot).
    const opportune = team.relanceQ || null;
    const itemBonusTime = getEffectValue(team, 'timerBonus') + (team.itemTimerBonus || 0) + (team.timeCredit || 0) + (opportune?.bonusTime || 0) + (team.forgeRepit || 0);
    if (team.itemTimerBonus || team.timeCredit || opportune || team.forgeRepit) {
      const nt = [...get().teams];
      // relanceQ + Répit (Forge) consommés ici (le bonus s'applique à CETTE question).
      nt[currentTeam] = { ...nt[currentTeam], itemTimerBonus: 0, timeCredit: 0, relanceQ: undefined, forgeRepit: undefined };
      set({ teams: nt });
    }

    // Suivi de rafale Double (cumulable) : on lit l'equipe A JOUR (apres les set
    // partiels ci-dessus). doubleTotal est fige au demarrage de la rafale, doubleAsked
    // s'incremente a chaque question. Exposes a la modale pour l'affichage « X / N ».
    let multiIndex = null, multiTotal = null;
    const curTeam = get().teams[currentTeam];
    if (curTeam.doubleActive) {
      const started = (curTeam.doubleAsked || 0) > 0;
      multiTotal = started ? curTeam.doubleTotal : 1 + (curTeam.doubleExtra || 0);
      multiIndex = started ? curTeam.doubleAsked + 1 : 1;
      const nt = [...get().teams];
      nt[currentTeam] = { ...curTeam, doubleTotal: multiTotal, doubleAsked: multiIndex };
      set({ teams: nt });
    }

    // Chrono partagé (Double L5) : un seul chrono pour TOUTE la rafale.
    let sharedStart;
    {
      const ct2 = get().teams[currentTeam];
      if (ct2.doubleActive && ct2.doubleSharedTimer) {
        // Temps commun (voie) : chrono partagé, raccourci de `doubleSharedCut` s (plancher 7).
        const base = Math.max(7, Math.floor(30 / (timerDivisor || 1)) + itemBonusTime - (ct2.doubleSharedCut || 0));
        const first = (ct2.doubleAsked || 1) <= 1 || ct2.burstTimeLeft == null;
        sharedStart = Math.max(0, first ? base : ct2.burstTimeLeft);
        if (first) { const nt = [...get().teams]; nt[currentTeam] = { ...ct2, burstTimeLeft: base }; set({ teams: nt }); }
      }
    }
    // Confusion (Sablier L5) : énoncé brouillé quelques secondes (one-shot).
    let confused = false;
    {
      const ct3 = get().teams[currentTeam];
      if (ct3.confused) { confused = true; const nt = [...get().teams]; nt[currentTeam] = { ...ct3, confused: false }; set({ teams: nt }); }
    }

    // Equipement (indiceBoost) : elimine passivement des mauvaises reponses a
    // CHAQUE question. getEffectValue resout le de et la probabilite a chaque
    // appel (ex. 'd3' a 100% => 1 a 3 reponses retirees ; un 3 les retire toutes).
    const indiceBoost = getEffectValue(team, 'indiceBoost');
    const forgeHide = team.forgeIndice || 0; // Indice (Forge) armé au lancer
    // Sagesse partagée (Indice ultime, passif) : élimine GRATUITEMENT 1 mauvaise
    // réponse au début de chaque question (sans dépenser de charge).
    const wisdom = (extOn(get().extensions, 'mastery') && team.powers?.indice?.spec10 === 'wisdom') ? 1 : 0;
    const passiveHide = indiceBoost + forgeHide + wisdom;
    let indiceHidden = [];
    if (passiveHide > 0) {
      const wrong = q.a.map((_, i) => i).filter((i) => i !== q.c);
      for (let i = wrong.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
      }
      indiceHidden = wrong.slice(0, Math.min(passiveHide, wrong.length));
      // Le log d'équipement ne couvre que sa part ; l'Indice de Forge a déjà été
      // annoncé à l'armement (au lancer).
      if (indiceBoost > 0) {
        const n = Math.min(indiceBoost, indiceHidden.length);
        if (n > 0) addLog(tgPlural('log.store.equipHide', n, { n }));
      }
    }
    if (team.forgeIndice) {
      const nt = [...get().teams];
      nt[currentTeam] = { ...nt[currentTeam], forgeIndice: undefined };
      set({ teams: nt });
    }

    // L'horloge de la question vit dans le STORE (deadline = instant limite) :
    // le TBI est l'horloge de référence, la modale et la manette téléphone ne
    // font qu'afficher le temps restant. `selected`/`answerRevealed` (sélection
    // et révélation) y vivent aussi pour que TBI et téléphone restent synchrones.
    // NB : `revealed` (ci-dessous) est le marqueur CLAIRVOYANCE (stats) — rien à voir.
    const sq = { question: q, subject, index: result.index, timerHalved, timerDivisor, itemBonusTime, multiIndex, multiTotal, sharedStart, confused, timerCap: team.maxTimerCap || null, modeleur, revealHint: !!team.clairvoyanceTurn, revealed: !!team.clairvoyanceTurn };
    set({
      showQuestion: { ...sq, deadline: Date.now() + questionDuration(sq) * 1000, selected: null, answerRevealed: false, timeLeftAtReveal: null },
      askedQuestions: { ...askedQuestions, [subject]: newAsked },
      indiceUsed: false, indiceUses: 0, indiceHidden, rerollUsed: false,
    });

    // Déclencheur d'équipement « quand je tombe sur une question de [thèmes] » :
    // joué À l'apparition de la question (avant de répondre). La question est déjà
    // ouverte → les actions agissent dessus (prolonger le temps, changer la
    // question, bouclier préventif, gain d'or, avancer…).
    const subjActions = effectH.equipTriggerActions(get().teams[currentTeam], 'questionSubject', subject);
    if (subjActions.length) effectH.runEffects(set, get, subjActions, { source: 'item' });
  },

  // --- Sélection & révélation de réponse (source de vérité : le STORE) ---
  // Flux : sélection (TBI ou téléphone) → révélation (vert/rouge partout) →
  // « Continuer » → answerQuestion/timeoutQuestion. Le temps restant est FIGÉ à
  // la révélation (timeLeftAtReveal), calculé depuis la deadline — l'ancienne
  // horloge locale de QuestionModal ne fait plus foi.
  selectAnswer: (index) => {
    const sq = get().showQuestion;
    if (!sq || sq.answerRevealed || !sq.question) return;
    if (!Number.isInteger(index) || index < 0 || index >= (sq.question.a?.length || 0)) return;
    if ((get().indiceHidden || []).includes(index)) return; // réponse barrée
    // Seconde chance (buff) : la 1re mauvaise SÉLECTION est barrée et l'équipe
    // rejoue — SANS révéler la bonne réponse (sinon la « seconde chance » serait
    // une réponse gratuite). Le buff est consommé, aucune pénalité.
    const curTeam = get().teams[get().currentTeam];
    if (index !== sq.question.c && !sq.secondChanceUsed && findBuff(curTeam, 'secondChance')) {
      const buffs = [...(curTeam.buffs || [])];
      const bi = buffs.findIndex((b) => b.type === 'secondChance');
      if (bi >= 0) buffs.splice(bi, 1);
      const nt = [...get().teams];
      nt[get().currentTeam] = { ...curTeam, buffs };
      set({
        teams: nt,
        showQuestion: { ...sq, secondChanceUsed: true, selected: null, answerRevealed: false },
        indiceHidden: [...(get().indiceHidden || []), index], // la mauvaise réponse est barrée
      });
      get().addLog(tg('log.store.secondChance', { emoji: curTeam.emoji, name: curTeam.name }));
      get().emitCurseVfx?.(get().currentTeam, { icon: '🔁', color: '#2f9d5a', tone: 'buff' });
      return;
    }
    const timeLeft = Math.max(0, Math.round(((sq.deadline || Date.now()) - Date.now()) / 1000));
    set({ showQuestion: { ...sq, selected: index, answerRevealed: true, timeLeftAtReveal: timeLeft } });
  },

  // Temps écoulé (tick du TBI à deadline atteinte) : révélation sans sélection.
  revealQuestionTimeout: () => {
    const sq = get().showQuestion;
    if (!sq || sq.answerRevealed) return;
    // Seconde chance : un temps écoulé est aussi rejoué une fois (chrono plein),
    // sans révéler la réponse.
    const curTeam = get().teams[get().currentTeam];
    if (!sq.secondChanceUsed && findBuff(curTeam, 'secondChance')) {
      const buffs = [...(curTeam.buffs || [])];
      const bi = buffs.findIndex((b) => b.type === 'secondChance');
      if (bi >= 0) buffs.splice(bi, 1);
      const nt = [...get().teams];
      nt[get().currentTeam] = { ...curTeam, buffs };
      const sq2 = { ...sq, secondChanceUsed: true };
      set({
        teams: nt,
        showQuestion: { ...sq2, deadline: Date.now() + questionDuration(sq2) * 1000, selected: null, answerRevealed: false, timeLeftAtReveal: null },
      });
      get().addLog(tg('log.store.secondChance', { emoji: curTeam.emoji, name: curTeam.name }));
      get().emitCurseVfx?.(get().currentTeam, { icon: '🔁', color: '#2f9d5a', tone: 'buff' });
      return;
    }
    set({ showQuestion: { ...sq, selected: null, answerRevealed: true, timeLeftAtReveal: 0 } });
  },

  // « Continuer » après révélation (TBI ou téléphone) : route vers la résolution.
  // Idempotent : answerQuestion/timeoutQuestion ferment ou remplacent showQuestion
  // (une nouvelle question de rafale repart avec answerRevealed=false).
  continueQuestion: () => {
    const sq = get().showQuestion;
    if (!sq || !sq.answerRevealed) return;
    if (sq.selected != null) get().answerQuestion(sq.selected, sq.timeLeftAtReveal || 0);
    else get().timeoutQuestion();
  },

  // Prolonge le timer de la question courante (Indice L2, action extraTime…).
  extendQuestionDeadline: (sec) => {
    const sq = get().showQuestion;
    if (!sq || !sq.deadline || !(sec > 0)) return;
    set({ showQuestion: { ...sq, deadline: sq.deadline + sec * 1000 } });
  },

  answerQuestion: (chosenIndex, timeLeft = 0) => {
    const { showQuestion, teams, currentTeam, addLog } = get();
    if (!showQuestion) return;

    const { question, timerHalved, timerDivisor, itemBonusTime, indiceBonusMoney } = showQuestion;
    const correct = chosenIndex === question.c;
    const team = teams[currentTeam];
    // NB : la « seconde chance » est gérée en amont (selectAnswer/revealQuestionTimeout),
    // AVANT toute révélation de la bonne réponse — rien à faire ici.

    const newTeams = [...teams];
    const effectiveDivisor = timerDivisor || (timerHalved ? 2 : 1);
    // Meme echelle que le timer reellement affiche (QuestionModal) : le bonus
    // de temps d'equipement compte, sinon le ratio depasse 1 et gonfle le gain
    const maxTime = Math.min(showQuestion.timerCap || Infinity, Math.max(QUESTION_TIME_FLOOR, Math.floor(30 / effectiveDivisor) + (itemBonusTime || 0)));
    // Ratio de temps restant (0..100) fig\u00e9 pour cette r\u00e9ponse : alimente la
    // m\u00e9trique d'\u00e9chelle 'timeleft' (ex. gain = 1\u00d7% temps restant). On l'attache
    // \u00e0 l'\u00e9quipe pour que getEffectValue / les d\u00e9clencheurs puissent la lire.
    const answerTimeRatio = Math.round(Math.max(0, Math.min(1, maxTime > 0 ? timeLeft / maxTime : 0)) * 100);
    const tTeam = { ...team, answerTimeRatio };

    // Glaneur (Sablier ultime, passif) : les pièces « non gagnées » par l'équipe qui
    // répond (gain < plein) sont glanées par toute équipe portant l'ultime Glaneur.
    const masteryGlaneur = extOn(get().extensions, 'mastery');
    const glaneurFull = calculateMoneyGain(maxTime, maxTime);
    const applyGlaneur = (nt, earned) => {
      const unwon = Math.max(0, glaneurFull - earned);
      if (unwon <= 0) return;
      for (let gi = 0; gi < nt.length; gi++) {
        if (gi === currentTeam) continue;
        if (masteryGlaneur && nt[gi]?.powers?.sablier?.spec10 === 'glaneur') {
          nt[gi] = { ...nt[gi], money: (nt[gi].money || 0) + unwon };
          addLog(tgPlural('log.pw.glaneur', unwon, { emoji: nt[gi].emoji, name: nt[gi].name, n: unwon }));
        }
      }
    };

    // Analytics : trace structurée de la réponse (juste OU fausse). `question`
    // est déjà mélangé (shuffleAnswers) → answers/correctIndex/chosenIndex sont
    // cohérents et rejouables tels quels côté mobile.
    get().recordStat('answers', {
      teamIdx: currentTeam, teamName: team.name,
      subject: showQuestion.subject, level: question.level || null, theme: question.t || null,
      qId: question.id ?? `${showQuestion.subject}:${showQuestion.index}`,
      qText: question.q, answers: question.a, correctIndex: question.c,
      chosenIndex, correct, timedOut: false, timeLeftRatio: answerTimeRatio,
      explanation: question.e || null,
      // Marqueurs d'analyse (décision : on MARQUE sans exclure) : question Hardcore
      // (Double « Corsées » / passif) et réponse révélée (Indice Clairvoyance).
      hardcore: showQuestion.subject === 'hardcore', revealed: !!showQuestion.revealed,
    });

    // Bilan d'investissement de ce tour (mise/taux/gain), affiché en modale « bourse
    // spatiale » après le loot. Renseigné dans la branche « bonne réponse ».
    let investResultThisTurn = null;
    if (correct) {
      // Double/triple: money only on last question (or never if doubleNoBonus)
      const noBonus = team.doubleActive && (team.doubleNoBonus || (team.doubleExtra || 0) > 0);
      // L'equipement (moneyPerCorrect) s'applique a chaque bonne reponse, meme sans bonus.
      // explainEffectValue D\u00c9TAILLE chaque source (objet, set, \u00d7s\u00e9rie\u2026) en un seul tirage.
      const base = noBonus ? 0 : calculateMoneyGain(timeLeft, maxTime);
      const bonusBreak = explainEffectValue(tTeam, 'moneyPerCorrect');
      // Facteur d'or de la rafale Double (Chrono partagé ×1.5 / Rafale tranquille ÷2).
      const gFactor = team.doubleActive ? (team.doubleGoldFactor || 1) : 1;
      // Aubaine (face Forge) : multiplie l'or de la bonne réponse de ce tour.
      const aubaine = team.forgeGoldMult || 1;
      // Antisèche (Indice L10) : bonus d'or forfaitaire sur cette bonne réponse.
      const gain = Math.round((base + bonusBreak.total) * gFactor * aubaine) + (indiceBonusMoney || 0);
      // s\u00e9rie = +1 par TOUR r\u00e9ussi : pendant une rafale Double, on n'incr\u00e9mente
      // qu'\u00e0 la derni\u00e8re question (doubleExtra \u00e9puis\u00e9) ; cass\u00e9e sur erreur/timeout.
      const turnComplete = !team.doubleActive || (team.doubleExtra || 0) === 0;
      // Tout-ou-rien (Double L10) : on banque les gains et on les DOUBLE à la dernière
      // question (rafale parfaite) ; une erreur en route (BURST_RESET) fait tout perdre.
      let payNow = gain;
      let aonPatch = {};
      if (team.doubleActive && team.doubleAllOrNothing) {
        const bank = (team.doubleBank || 0) + gain;
        if (turnComplete) { payNow = bank * 2; addLog(tg('log.store.allOrNothing', { n: payNow })); }
        else { payNow = 0; aonPatch = { doubleBank: bank }; }
      }
      // Chrono partagé : on reporte le temps restant à la prochaine question de la rafale.
      const stPatch = (team.doubleActive && team.doubleSharedTimer) ? { burstTimeLeft: timeLeft } : {};
      newTeams[currentTeam] = { ...team, answerTimeRatio, correct: team.correct + 1, streak: (team.streak || 0) + (turnComplete ? 1 : 0), money: team.money + payNow, wager: undefined, ...aonPatch, ...stPatch };
      if (team.larcinBy != null) newTeams[currentTeam] = { ...newTeams[currentTeam], larcinBy: undefined, larcinChance: undefined };
      applyGlaneur(newTeams, payNow); // Glaneur : or non gagné par cette équipe (vitesse < pleine)
      // Investissement : mise remboursée à `rate` % sur cette bonne réponse. Le
      // bilan (mise/taux/gain) est mis de côté pour la modale « bourse spatiale »
      // affichée APRÈS le loot (cf. afterCorrectResolve).
      if (team.investment) {
        const rate = effectH.investRate(team.investment);
        const stake = team.investment.stake || 0;
        const payout = Math.max(0, Math.round((stake * rate) / 100));
        newTeams[currentTeam] = { ...newTeams[currentTeam], money: (newTeams[currentTeam].money || 0) + payout, investment: undefined };
        addLog(tg('log.store.investWin', { emoji: team.emoji, name: team.name, n: payout }));
        investResultThisTurn = { teamIndex: currentTeam, stake, rate, payout };
      }
      // Dîme : chaque adversaire porteur prélève un % de l'or GAGNÉ par l'équipe.
      if (payNow > 0) {
        for (let gi = 0; gi < newTeams.length; gi++) {
          if (gi === currentTeam) continue;
          const pctT = tithePct(newTeams[gi]);
          if (pctT <= 0) continue;
          const take = Math.min(newTeams[currentTeam].money || 0, Math.floor((payNow * pctT) / 100));
          if (take > 0) {
            newTeams[currentTeam] = { ...newTeams[currentTeam], money: (newTeams[currentTeam].money || 0) - take };
            newTeams[gi] = { ...newTeams[gi], money: (newTeams[gi].money || 0) + take };
            addLog(tg('log.store.tithe', { aemoji: newTeams[gi].emoji, aname: newTeams[gi].name, vemoji: team.emoji, vname: team.name, n: take }));
          }
        }
      }
      // D\u00e9tail d\u00e9pliable seulement si un bonus d'\u00e9quipement/set a jou\u00e9.
      let gainDetail;
      if (bonusBreak.parts.length > 0) {
        gainDetail = [];
        if (base > 0) gainDetail.push({ label: tg('log.store.detail.speed'), amount: base });
        for (const p of bonusBreak.parts) gainDetail.push({ label: p.label, note: `(${p.formula})`, amount: p.amount });
      }
      addLog({
        text: tg('log.store.correct', { gain: gain > 0 ? tg('log.store.correct.gain', { n: gain }) : (noBonus ? tg('log.store.correct.noBonus') : '') }),
        detail: gainDetail,
      });
      if (team.wager) addLog(tg('log.store.wagerWin'));
    } else {
      // Recul = valeur du d\u00e9 qui a fait avancer (preRollValue), d\u00e9faut 2.
      const masteryOnW = extOn(get().extensions, 'mastery');
      const { updatedTeam, logMessage, detail, path, forward, surplusPush, pushAmount } = resolveWrongAnswer(team, get().board, tg('log.turn.reasonWrong'), get().preRollValue ?? 2, masteryOnW);
      // erreur : la s\u00e9rie de bonnes r\u00e9ponses repart de 0 ; un pari \u00ab D\u00e9fi \u00bb est perdu ;
      // les bonus de loot arm\u00e9s par la Relance chanceuse sont consomm\u00e9s (pas de loot ici).
      // Garde de série (face Forge, ou passif/buff « streakGuard ») : la série ne
      // casse pas sur cette erreur.
      const streakKept = team.forgeStreakGuard || hasStreakGuard(team);
      newTeams[currentTeam] = { ...updatedTeam, answerTimeRatio, streak: streakKept ? (team.streak || 0) : 0, wager: undefined, relanceLootBonus: undefined, relanceDoubleLoot: undefined, indiceLegendaryArmed: undefined };
      if (streakKept && !team.forgeStreakGuard && (team.streak || 0) > 0) addLog(tg('log.store.streakGuard', { emoji: team.emoji, name: team.name }));
      // Prime réclamée + investissement perdu sur cette erreur.
      {
        const failed = newTeams[currentTeam];
        if (failed.bountyBy != null && newTeams[failed.bountyBy]) {
          const g = failed.bountyGold || 0;
          newTeams[failed.bountyBy] = { ...newTeams[failed.bountyBy], money: (newTeams[failed.bountyBy].money || 0) + g };
          addLog(tg('log.store.bountyClaim', { aemoji: newTeams[failed.bountyBy].emoji, aname: newTeams[failed.bountyBy].name, vemoji: failed.emoji, vname: failed.name, n: g }));
        }
        if (failed.investment) addLog(tg('log.store.investLost', { emoji: failed.emoji, name: failed.name, n: failed.investment.stake }));
        newTeams[currentTeam] = { ...failed, bountyBy: undefined, bountyGold: undefined, investment: undefined };
      }
      // Sur-r\u00e9duction (Bouclier L9) : push \u00ab toutes les \u00e9quipes \u00bb du surplus (auto).
      // Une \u00e9quipe immunis\u00e9e est \u00e9pargn\u00e9e ; une Bombe fumig\u00e8ne esquive (et se consomme).
      const surgeMoves = [];
      if (surplusPush === 'all' && pushAmount > 0) {
        const board = get().board;
        newTeams.forEach((tm, i) => {
          if (i === currentTeam) return;
          if ((tm.totalImmuneTurns ?? 0) > 0) { addLog(tg('log.pw.immuneBlock', { emoji: tm.emoji, name: tm.name, power: loc(POWERS.bouclier, 'name') })); return; }
          if (tm.itemFumigene) { newTeams[i] = { ...tm, itemFumigene: false, itemFumigeneTurns: undefined }; addLog(tg('log.pw.fumigeneBlock', { emoji: tm.emoji, name: tm.name, power: loc(POWERS.bouclier, 'name') })); return; }
          const rr = applyRecul(tm, board, pushAmount, masteryOnW);
          newTeams[i] = { ...tm, ...rr.patch };
          if (rr.path && rr.path.length > 1) surgeMoves.push({ teamIndex: i, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: rr.forward ? 'forward' : 'back' });
          addLog(rr.forward
            ? tg('log.turn.fortressAdvance', { team: `${tm.emoji} ${tm.name}`, cases: rr.advance })
            : tg('log.pw.surgePush', { vemoji: tm.emoji, vname: tm.name, n: rr.applied ?? pushAmount }));
        });
      }
      addLog({ text: logMessage, detail });
      if (team.wager) addLog(tg('log.store.wagerLose'));
      if (bouclierAbsorbed(team, updatedTeam)) { soundShield(); get().emitVfx('shield', currentTeam); }
      if ((team.powers?.bouclier?.charges ?? 0) > (updatedTeam.powers?.bouclier?.charges ?? 0))
        get().recordStat('powerUses', { teamIdx: currentTeam, powerKey: 'bouclier', targetIdx: null });

      // Double/triple: wrong answer stops immediately, clear double state
      if (team.doubleActive) {
        const remaining = team.doubleExtra || 0; // questions imposées non répondues
        // Saboteur (Double voie) : pénalités croissantes en cas d'erreur.
        if (team.doubleSaboteur >= 1) {
          let lost = glaneurFull; // niv.1 : perd l'argent qu'elle devait gagner
          if (team.doubleSaboteur >= 2) lost += remaining * glaneurFull; // niv.2 : + questions non répondues
          lost = Math.min(lost, newTeams[currentTeam].money || 0);
          let saboteurRecul = '';
          if (team.doubleSaboteur >= 3 && remaining > 0) {
            const extra = remaining * (get().preRollValue ?? 2); // niv.3 : recul × questions restantes
            const rr = moveBack(get().board, newTeams[currentTeam].pos, extra);
            newTeams[currentTeam] = { ...newTeams[currentTeam], pos: rr.finalPos };
            saboteurRecul = tg('log.pw.doubleSaboteurRecul', { n: extra });
          }
          newTeams[currentTeam] = { ...newTeams[currentTeam], money: (newTeams[currentTeam].money || 0) - lost };
          addLog(tg('log.pw.doubleSaboteurHit', { emoji: team.emoji, name: team.name, gold: lost, recul: saboteurRecul }));
        }
        // Report (Double ultime) : les questions restantes vont au prochain tour.
        const reportPatch = (team.doubleReport && remaining > 0) ? { doubleReportPending: remaining } : {};
        if (team.doubleReport && remaining > 0) addLog(tg('log.pw.doubleReportHit', { emoji: team.emoji, name: team.name, n: remaining }));
        newTeams[currentTeam] = { ...newTeams[currentTeam], ...BURST_RESET, ...reportPatch };
        addLog(tg('log.store.doubleFailed'));
      }

      // Sur-réduction / Forteresse : le « recul » peut être devenu une AVANCE.
      const selfPath = path ? [{ teamIndex: currentTeam, waypoints: path.map((id) => ({ x: get().board[id].x, y: get().board[id].y })), type: forward ? 'forward' : 'back' }] : [];
      const backPath = [...selfPath, ...surgeMoves].length ? [...selfPath, ...surgeMoves] : null;
      // Larcin (Sablier voie) : si la cible répond faux, chance de lui voler un
      // objet du sac (transféré au lanceur). Respecte l'immunité au vol d'objet.
      if (team.larcinChance && team.larcinBy != null && Math.random() < team.larcinChance && !isItemStealImmune(team)) {
        const victim = newTeams[currentTeam];
        const bagIdxs = (victim.bag || []).map((c, i) => (itemH.cellKey(c) ? i : -1)).filter((i) => i >= 0);
        const thiefIdx = team.larcinBy;
        if (bagIdxs.length && newTeams[thiefIdx]) {
          const bi = bagIdxs[Math.floor(Math.random() * bagIdxs.length)];
          const k = itemH.cellKey(victim.bag[bi]); const n = itemH.cellN(victim.bag[bi]);
          const newBag = [...victim.bag]; newBag[bi] = n > 1 ? itemH.mkCell(k, n - 1) : null;
          newTeams[currentTeam] = { ...victim, bag: newBag };
          const r = itemH.placeItem(newTeams[thiefIdx], k);
          newTeams[thiefIdx] = r.team;
          addLog(tg('log.pw.sablierLarcinSteal', { aemoji: newTeams[thiefIdx].emoji, aname: newTeams[thiefIdx].name, item: loc(ITEMS[k], 'name'), vemoji: victim.emoji, vname: victim.name }));
        }
      }
      if (team.larcinBy != null) newTeams[currentTeam] = { ...newTeams[currentTeam], larcinBy: undefined, larcinChance: undefined };
      applyGlaneur(newTeams, 0); // Glaneur : réponse ratée → tout le gain plein est glané
      set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [], movePath: backPath });
      // Avance (Forteresse/Sur-réduction) atteignant l'arrivée → victoire.
      if (forward && get().checkArrival(currentTeam)) return;
      // D\u00e9clencheurs d'\u00e9quipement \u00ab \u00e0 la mauvaise r\u00e9ponse \u00bb (ex. perdre 5 PO).
      // Si l'effet ouvre un s\u00e9lecteur (interactif), on DIFF\u00c8RE nextTurn jusqu'\u00e0 la
      // fin de la file (sinon TURN_RESET \u00e9craserait la file + le picker).
      const finishWrong = () => {
        if (get().finished) return;
        // Sur-réduction « au choix » (Bouclier L7) : ouvrir le sélecteur de cible
        // (recule l'équipe choisie du surplus), qui enchaînera nextTurn.
        if (surplusPush === 'one' && pushAmount > 0 && get().teams.length > 1) {
          set({ showTargetPicker: { source: 'surge', amount: pushAmount } });
          return;
        }
        get().nextTurn();
      };
      const lwBuff = findBuff(team, 'loseOnWrong');
      const buffWrong = lwBuff ? [{ action: 'money', mode: 'lose', target: 'self', n: lwBuff.n ?? 5, unit: 'flat' }] : [];
      const onWrong = [...effectH.equipTriggerActions(get().teams[currentTeam], 'wrong', showQuestion.subject), ...buffWrong, ...(team.wager?.else || [])];
      if (onWrong.length) {
        effectH.runEffects(set, get, onWrong, { source: 'item' });
        if (get().pendingActions) { set({ deferredTurnEnd: finishWrong }); return; }
      }
      finishWrong();
      return;
    }

    // Bilan d'investissement : préservé si aucun nouveau (ex. rafale Double dont
    // seule la 1re question portait l'investissement) — consommé par afterCorrectResolve.
    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [], pendingInvestResult: investResultThisTurn || get().pendingInvestResult });
    get().checkMoneyMilestone(currentTeam); // palier d'or franchi par le gain ?

    // Suite du tour (rafale Double / loot / nextTurn) encapsulée : peut être
    // DIFFÉRÉE si un déclencheur on:correct ouvre un sélecteur interactif (sinon
    // nextTurn/TURN_RESET écraserait la file d'effets en cours).
    const finishCorrect = () => {
      if (get().finished) return; // victoire déclenchée par un effet on:correct

      // Double/triple question: continue only on correct answer
      const updatedTeam = get().teams[currentTeam];
      const doubleResult = resolveDoubleQuestion(updatedTeam);
      if (doubleResult.shouldContinue) {
        const nt = [...get().teams];
        nt[currentTeam] = doubleResult.updatedTeam;
        set({ teams: nt });
        addLog(doubleResult.logMessage);
        get().askQuestion(get().randomBoardSubject());
        if (get().phase === 'game') saveGame(get());
        return;
      } else if (doubleResult.updatedTeam !== updatedTeam) {
        const nt = [...get().teams];
        nt[currentTeam] = doubleResult.updatedTeam;
        // Interro générale : la rafale terminée renvoie une Double sur l'attaquant.
        const refl = updatedTeam.doubleReflectTo;
        if (refl != null && nt[refl] && refl !== currentTeam) {
          const r = nt[refl];
          nt[refl] = { ...r, doubleActive: true, doubleExtra: Math.min((r.doubleExtra || 0) + 1, 4), doubleNoBonus: true };
          addLog(tg('log.store.interroGenerale', { emoji: r.emoji, name: r.name }));
        }
        set({ teams: nt });
      }

      // Loot de bonne réponse : au plus une fois par tour (la rafale Double y
      // revient une seule fois). Taux par canal = BASE × temps restant + BONUS
      // d'objet FLAT (un « +100% » garantit le loot). Canaux INDÉPENDANTS.
      // Extension objets désactivée : aucun butin (couture d'octroi coupée).
      if (!get().itemsEnabled()) { get().afterCorrectResolve(); return; }
      const timeRatio = Math.max(0, Math.min(1, timeLeft / maxTime));
      const enabledForLoot = get().enabledItems || Object.keys(ITEMS);
      const lootTeam = get().teams[currentTeam];
      // Relance chanceuse (L5) : bonus de loot one-shot armé par la relance (sur 6+).
      // Palier 1 = +chance de loot ; palier 2 = chance d'un 2ᵉ drop. Consommé ici.
      const relLootBonus = lootTeam.relanceLootBonus || 0;
      const relDoubleLoot = lootTeam.relanceDoubleLoot || 0;
      if (relLootBonus || relDoubleLoot) {
        const nt = [...get().teams];
        nt[currentTeam] = { ...nt[currentTeam], relanceLootBonus: undefined, relanceDoubleLoot: undefined };
        set({ teams: nt });
      }
      // Butin (face Forge) : +chance de loot (fraction) sur les deux canaux.
      const butinBonus = typeof lootTeam.forgeButin === 'number' ? lootTeam.forgeButin : 0;
      const consumRate = (LOOT.answerConsumableRate || 0) * timeRatio + getEffectValue(lootTeam, 'lootBonusConsumable') / 100 + relLootBonus + butinBonus;
      const equipRate = LOOT.answerLootRate * timeRatio + getEffectValue(lootTeam, 'lootBonusEquipment') / 100 + relLootBonus + butinBonus;
      const drops = [];
      if (Math.random() < consumRate) {
        const k = itemH.pickLootItem(0, enabledForLoot, { category: 'consumable' });
        if (k) drops.push(k);
      }
      if (Math.random() < equipRate) {
        const k = itemH.pickLootItem(LOOT.answerLegendaryChance, enabledForLoot, { category: 'equipment' });
        if (k) drops.push(k);
      }
      // Double loot (palier 2) : un 2ᵉ tirage (consommable) à la probabilité donnée.
      if (relDoubleLoot && Math.random() < relDoubleLoot) {
        const k = itemH.pickLootItem(0, enabledForLoot, { category: 'consumable' });
        if (k) drops.push(k);
      }
      // Canal INGRÉDIENTS (extension Alchimie) : taux séparé + affinité de matière
      // de la case (showQuestion.subject) + bonus d'équipement « loot matière »,
      // puis drops multiples (mêmes ou différents, empilés).
      if (extOn(get().extensions, 'alchemy')) {
        const subj = showQuestion.subject;
        const ingRate = (LOOT.answerIngredientRate || 0) * timeRatio + getSubjectLootBonus(lootTeam, subj) / 100;
        if (Math.random() < ingRate) {
          const k = itemH.pickLootIngredient(enabledForLoot, subj);
          if (k) {
            drops.push(k);
            const md = LOOT.ingredientMultiDrop || {};
            let extra = 0;
            while (extra < (md.max || 0) && Math.random() < (md.chance || 0)) {
              const k2 = itemH.pickLootIngredient(enabledForLoot, subj);
              if (k2) drops.push(k2);
              extra++;
            }
          }
        }
      }
      // Butin « garanti » (face Forge) : si rien n'est tombé, force un consommable.
      if (lootTeam.forgeButin === 'guaranteed' && !drops.length) {
        const k = itemH.pickLootItem(0, enabledForLoot, { category: 'consumable' });
        if (k) drops.push(k);
      }
      // Objet légendaire (Indice ultime) : bonne réponse après un indice → octroie
      // un équipement LÉGENDAIRE garanti. Le drapeau est consommé ici.
      if (lootTeam.indiceLegendaryArmed) {
        const kl = itemH.pickLootItem(1, enabledForLoot, { category: 'equipment' });
        if (kl) drops.push(kl);
        const nt = [...get().teams];
        nt[currentTeam] = { ...nt[currentTeam], indiceLegendaryArmed: undefined };
        set({ teams: nt });
      }
      const revealQueue = [];
      if (drops.length) {
        const nt = [...get().teams];
        for (const k of drops) {
          const r = itemH.placeItem(nt[currentTeam], k);
          nt[currentTeam] = r.team;
          if (r.outcome === 'refunded') {
            addLog(tg('log.store.lootRefunded', { emoji: team.emoji, name: team.name, icon: ITEMS[k].icon, iname: loc(ITEMS[k], 'name'), refund: r.refund }));
          } else {
            addLog(tg('log.store.lootFound', { emoji: team.emoji, name: team.name, icon: ITEMS[k].icon, iname: loc(ITEMS[k], 'name') }));
            revealQueue.push(k);
          }
        }
        set({ teams: nt });
      }

      // Le butin appartient à l'équipe QUI VIENT DE RÉPONDRE : on le révèle AVANT
      // de passer la main, puis on diffère `nextTurn` (et donc le coffre de départ
      // de l'équipe suivante) jusqu'à la fermeture du butin — sinon le coffre de
      // l'équipe d'après s'affiche par-dessus la révélation (thenNextTurn).
      if (revealQueue.length) {
        const [first, ...rest] = revealQueue;
        get().showLoot(first, {
          title: '✨ Bien joué !',
          subtitle: rest.length ? 'Double butin ! (1/2)' : 'Récompense de bonne réponse',
          rest: rest.map((k) => ({ itemKey: k, title: '✨ Et en plus…', subtitle: 'Double butin ! (2/2)' })),
          thenNextTurn: true,
        });
      } else {
        get().afterCorrectResolve();
      }
    };

    // Effets de durée actifs à la bonne réponse : bonus d'or (sur thème) + avance.
    const buffCorrect = [];
    const tBonus = findBuff(team, 'themeBonus', showQuestion.subject);
    if (tBonus) buffCorrect.push({ action: 'money', mode: 'gain', target: 'self', n: tBonus.n ?? 5, unit: 'flat' });
    const advBuff = findBuff(team, 'advanceOnCorrect');
    if (advBuff) buffCorrect.push({ action: 'move', target: 'self', dir: 'forward', n: advBuff.n ?? 'd4' });
    // Déclencheurs d'équipement « à la bonne réponse » (perte/gain/charge…),
    // précédés de la récompense d'un éventuel pari « Défi » (team.wager.do) et des buffs.
    const onCorrect = [...(team.wager?.do || []), ...buffCorrect, ...effectH.equipTriggerActions(get().teams[currentTeam], 'correct', showQuestion.subject)];
    if (onCorrect.length) {
      effectH.runEffects(set, get, onCorrect, { source: 'item' });
      if (get().pendingActions) { set({ deferredTurnEnd: finishCorrect }); return; }
    }
    finishCorrect();
  },

  timeoutQuestion: () => {
    const { teams, currentTeam, addLog } = get();
    const team = teams[currentTeam];
    const sq = get().showQuestion;
    // NB : la « seconde chance » sur temps écoulé est gérée dans
    // revealQuestionTimeout (avant la révélation) — ici la question est déjà soldée.
    const timedSubject = sq?.subject; // thème (pour les déclencheurs conditionnés)
    const newTeams = [...teams];

    // Analytics : trace de la question expirée (réponse non donnée).
    if (sq?.question) {
      get().recordStat('answers', {
        teamIdx: currentTeam, teamName: team.name,
        subject: sq.subject, level: sq.question.level || null, theme: sq.question.t || null,
        qId: sq.question.id ?? `${sq.subject}:${sq.index}`,
        qText: sq.question.q, answers: sq.question.a, correctIndex: sq.question.c,
        chosenIndex: null, correct: false, timedOut: true, timeLeftRatio: 0,
        explanation: sq.question.e || null,
      });
    }

    // Recul = valeur du d\u00e9 qui a fait avancer (preRollValue), d\u00e9faut 2.
    const masteryOnT = extOn(get().extensions, 'mastery');
    const { updatedTeam, logMessage, detail, path, forward, surplusPush, pushAmount } = resolveWrongAnswer(team, get().board, tg('log.turn.reasonTimeout'), get().preRollValue ?? 2, masteryOnT);
    // temps \u00e9coul\u00e9 = erreur : s\u00e9rie remise \u00e0 0, 0% de temps restant ; pari \u00ab D\u00e9fi \u00bb perdu ;
    // bonus de loot de la Relance chanceuse consomm\u00e9s (pas de loot au timeout).
    // Garde de série (face Forge, ou passif/buff « streakGuard ») : la série tient même au temps écoulé.
    const streakKeptT = team.forgeStreakGuard || hasStreakGuard(team);
    newTeams[currentTeam] = { ...updatedTeam, streak: streakKeptT ? (team.streak || 0) : 0, answerTimeRatio: 0, wager: undefined, relanceLootBonus: undefined, relanceDoubleLoot: undefined };
    if (streakKeptT && !team.forgeStreakGuard && (team.streak || 0) > 0) addLog(tg('log.store.streakGuard', { emoji: team.emoji, name: team.name }));
    // Prime réclamée + investissement perdu sur ce temps écoulé.
    {
      const failed = newTeams[currentTeam];
      if (failed.bountyBy != null && newTeams[failed.bountyBy]) {
        const g = failed.bountyGold || 0;
        newTeams[failed.bountyBy] = { ...newTeams[failed.bountyBy], money: (newTeams[failed.bountyBy].money || 0) + g };
        addLog(tg('log.store.bountyClaim', { aemoji: newTeams[failed.bountyBy].emoji, aname: newTeams[failed.bountyBy].name, vemoji: failed.emoji, vname: failed.name, n: g }));
      }
      if (failed.investment) addLog(tg('log.store.investLost', { emoji: failed.emoji, name: failed.name, n: failed.investment.stake }));
      newTeams[currentTeam] = { ...failed, bountyBy: undefined, bountyGold: undefined, investment: undefined };
    }
    // Sur-r\u00e9duction (Bouclier L9) : push \u00ab toutes \u00bb du surplus (auto, immunit\u00e9/fumig\u00e8ne g\u00e9r\u00e9s).
    if (surplusPush === 'all' && pushAmount > 0) {
      const board = get().board;
      newTeams.forEach((tm, i) => {
        if (i === currentTeam) return;
        if ((tm.totalImmuneTurns ?? 0) > 0) { addLog(tg('log.pw.immuneBlock', { emoji: tm.emoji, name: tm.name, power: loc(POWERS.bouclier, 'name') })); return; }
        if (tm.itemFumigene) { newTeams[i] = { ...tm, itemFumigene: false, itemFumigeneTurns: undefined }; addLog(tg('log.pw.fumigeneBlock', { emoji: tm.emoji, name: tm.name, power: loc(POWERS.bouclier, 'name') })); return; }
        const rr = applyRecul(tm, board, pushAmount, masteryOnT);
        newTeams[i] = { ...tm, ...rr.patch };
        addLog(rr.forward
          ? tg('log.turn.fortressAdvance', { team: `${tm.emoji} ${tm.name}`, cases: rr.advance })
          : tg('log.pw.surgePush', { vemoji: tm.emoji, vname: tm.name, n: rr.applied ?? pushAmount }));
      });
    }
    addLog({ text: logMessage, detail });
    // Taxe du temps (Sablier L5) : la cible perd de l'or en d\u00e9passant le temps.
    if (team.timeoutPenalty) {
      const pen = Math.min(team.timeoutPenalty, newTeams[currentTeam].money || 0);
      newTeams[currentTeam] = { ...newTeams[currentTeam], money: (newTeams[currentTeam].money || 0) - pen, timeoutPenalty: undefined };
      if (pen > 0) addLog(tg('log.store.timeoutPenalty', { emoji: team.emoji, name: team.name, n: pen }));
    }
    if (team.wager) addLog(tg('log.store.wagerLose'));
    if (bouclierAbsorbed(team, updatedTeam)) { soundShield(); get().emitVfx('shield', currentTeam); }
    if ((team.powers?.bouclier?.charges ?? 0) > (updatedTeam.powers?.bouclier?.charges ?? 0))
      get().recordStat('powerUses', { teamIdx: currentTeam, powerKey: 'bouclier', targetIdx: null });

    if (team.doubleActive) {
      newTeams[currentTeam] = { ...newTeams[currentTeam], ...BURST_RESET };
      addLog(tg('log.store.doubleFailed'));
    }

    const backPath = path ? [{ teamIndex: currentTeam, waypoints: path.map((id) => ({ x: get().board[id].x, y: get().board[id].y })), type: forward ? 'forward' : 'back' }] : null;
    set({ teams: newTeams, showQuestion: null, indiceUsed: false, indiceHidden: [], movePath: backPath });
    if (forward && get().checkArrival(currentTeam)) return;
    // D\u00e9clencheurs d'\u00e9quipement \u00ab \u00e0 la mauvaise r\u00e9ponse \u00bb (timeout compris).
    // nextTurn diff\u00e9r\u00e9 si l'effet ouvre un s\u00e9lecteur (cf. answerQuestion).
    const finishWrong = () => {
      if (get().finished) return;
      if (surplusPush === 'one' && pushAmount > 0 && get().teams.length > 1) {
        set({ showTargetPicker: { source: 'surge', amount: pushAmount } });
        return;
      }
      get().nextTurn();
    };
    const lwBuffT = findBuff(team, 'loseOnWrong');
    const buffWrongT = lwBuffT ? [{ action: 'money', mode: 'lose', target: 'self', n: lwBuffT.n ?? 5, unit: 'flat' }] : [];
    const onWrong = [...effectH.equipTriggerActions(get().teams[currentTeam], 'wrong', timedSubject), ...buffWrongT, ...(team.wager?.else || [])];
    if (onWrong.length) {
      effectH.runEffects(set, get, onWrong, { source: 'item' });
      if (get().pendingActions) { set({ deferredTurnEnd: finishWrong }); return; }
    }
    finishWrong();
  },

  // --- Events (delegated) ---
  triggerEvent: (picked) => eventH.triggerEvent(set, get, picked),
  revealEvent: () => eventH.revealEvent(set, get),
  acceptEvent: () => eventH.acceptEvent(set, get),
  declineEvent: () => eventH.declineEvent(set, get),
  eventSelectTarget: (ti) => eventH.eventSelectTarget(set, get, ti),
  eventRollDice: () => eventH.eventRollDice(set, get),
  eventAskQuestion: () => eventH.eventAskQuestion(set, get),
  eventAnswerQuestion: (ci) => eventH.eventAnswerQuestion(set, get, ci),
  eventVaToutContinue: () => eventH.eventVaToutContinue(set, get),
  eventVaToutCashOut: () => eventH.eventVaToutCashOut(set, get),
  eventRechargeChoice: (pk) => eventH.eventRechargeChoice(set, get, pk),
  eventMarcheNoirBuy: (pk) => eventH.eventMarcheNoirBuy(set, get, pk),
  eventVolApply: (stealKey, giveKey) => eventH.eventVolApply(set, get, stealKey, giveKey),
  eventMerchantBuy: (itemKey) => eventH.eventMerchantBuy(set, get, itemKey),
  eventChooseGift: (itemKey) => eventH.eventChooseGift(set, get, itemKey),
  eventTrade: (pick) => eventH.eventTrade(set, get, pick),
  eventPillageApply: (pick) => eventH.eventPillageApply(set, get, pick),
  applyEventEffect: () => eventH.applyEventEffect(set, get),
  closeEvent: () => {
    set({ showEvent: null, eventApplied: false });
    get().finishEventTurn();
  },
  // Sortie UNIQUE des événements : pose une question (case événement = événement
  // + question) sauf si l'événement avait déjà sa propre question (flag effacé)
  // ou si la partie est finie ; sinon on enchaîne directement sur le tour suivant.
  finishEventTurn: () => {
    if (get().finished) return;
    const peq = get().pendingEventQuestion;
    if (peq) {
      set({ pendingEventQuestion: null });
      get().askQuestion(peq.subject || get().randomBoardSubject());
      return;
    }
    get().nextTurn();
    if (get().phase === 'game') saveGame(get());
  },

  // --- Animation ---
  // Retire l'animation d'un pion qui a fini son trajet ; null quand plus aucune.
  clearTeamMove: (teamIndex) => {
    const mp = get().movePath;
    if (!mp) return;
    const rest = mp.filter((m) => m.teamIndex !== teamIndex);
    set({ movePath: rest.length ? rest : null });
    // Auto-déclenchement des PIÈGES : dès que l'équipe courante a fini son trajet
    // d'atterrissage, si sa case porte un piège, on enchaîne SANS « Continuer »
    // (demande utilisateur). Les autres cases gardent le bouton pour laisser
    // jouer pouvoirs/boutique avant la résolution.
    const st = get();
    if (teamIndex === st.currentTeam && st.pendingLanding && !st.rolling && !st.awaitingChoice && !st.showDiceModal) {
      const node = st.board[st.teams[st.currentTeam]?.pos];
      // Immunisé : pas d'auto-enchaînement, on garde le « Continuer » comme une
      // case normale (le piège ne le concerne pas).
      if (node?.trap && !isTrapImmune(st.teams[st.currentTeam])) st.confirmLanding();
    }
  },

  // Effet visuel transitoire (foudre/bouclier...) consomme par les overlays.
  // id monotone via un compteur unique → jamais deux fois le meme id d'affilee.
  emitVfx: (type, teamIndex) => set({ vfx: { type, teamIndex, id: ++vfxSeq } }),
  clearVfx: () => set({ vfx: null }),

  // Aura visuelle de malediction/bonus, MULTI-cibles (liste, contrairement au
  // canal `vfx` mono-slot ci-dessus) : « maudire les autres groupes » frappe
  // plusieurs cartes en meme temps. Chaque entree { id, teamIndex, icon, color,
  // tone } est rendue par <CurseStrike/> puis auto-retiree (clearCurseVfx).
  curseVfx: [],
  emitCurseVfx: (teamIndex, opts = {}) => set({
    curseVfx: [...(get().curseVfx || []), {
      id: ++vfxSeq, teamIndex,
      icon: opts.icon || '\u{1F300}', color: opts.color || '#8745d4', tone: opts.tone || 'malus',
    }],
  }),
  clearCurseVfx: (id) => set({ curseVfx: (get().curseVfx || []).filter((v) => v.id !== id) }),

  // Cinematiques d'IDENTITE des pouvoirs (Sablier : horloge qui se deregle, etc.),
  // ancrees sur la/les carte(s) cible(s). Multi-cibles (liste) comme curseVfx.
  // Chaque entree { id, type, teamIndex, color }. Rendu par <PowerCinematic/>.
  powerFx: [],
  emitPowerFx: (type, teamIndex, opts = {}) => set({
    powerFx: [...(get().powerFx || []), { id: ++vfxSeq, type, teamIndex, color: opts.color || '#a83e7f' }],
  }),
  clearPowerFx: (id) => set({ powerFx: (get().powerFx || []).filter((v) => v.id !== id) }),

  // Toasts d'effet animes (moteur d'effets composable) — auto-retires par l'overlay.
  effectToasts: [],
  dismissFx: (id) => set({ effectToasts: (get().effectToasts || []).filter((t) => t.id !== id) }),

  // --- Confirm landing (player done using powers) ---
  confirmLanding: () => {
    if (!get().pendingLanding) return;
    set({ pendingLanding: false, freeActivation: false });
    get().handleLanding();
  },

  // --- « Hacking » (mode téléphone) : tour piraté ---
  // Cinématique « app piratée » couvrant l'écran tout le tour de l'équipe visée.
  hackOverlay: null,
  // Appelé par BottomBar (minuterie de la cellule HUD) à la fin du « beat » de
  // résolution : on consomme le compteur de hack de l'équipe (fin de la
  // cinématique), on lève le verrou et on passe au tour suivant (tour perdu).
  endHackedTurn: () => {
    const ho = get().hackOverlay;
    if (!ho) return;
    const teams = [...get().teams];
    const t = teams[ho.teamIndex];
    if (t) {
      const left = (t.hackedTurns || 0) - 1;
      teams[ho.teamIndex] = left > 0 ? { ...t, hackedTurns: left } : { ...t, hackedTurns: undefined, hackedBy: undefined };
    }
    set({ teams, hackOverlay: null });
    get().nextTurn();
  },

  // --- Dev : ajoute des pieces a l'equipe active (localhost uniquement) ---
  devAddMoney: (amount = 10) => {
    const { teams, currentTeam, addLog } = get();
    if (!teams.length) return;
    const team = teams[currentTeam];
    const newTeams = [...teams];
    newTeams[currentTeam] = { ...team, money: (team.money ?? 0) + amount };
    addLog(tg('log.store.devMoney', { emoji: team.emoji, name: team.name, n: amount }));
    set({ teams: newTeams });
  },

  // Loot moteur : pioche un objet (catégorie optionnelle) et le donne à une
  // équipe — utilisé par l'action d'effet `loot` (ex. set Duelliste, fightWin).
  // Place l'objet PUIS déclenche le visuel de gain d'objet (LootReveal), comme
  // le coffre. Pas de `thenClose` : on est en plein milieu d'un tour (effet de
  // consommable), il ne faut donc ni fermer d'événement ni enchaîner nextTurn.
  engineLoot: (teamIdx, category) => {
    if (!get().itemsEnabled()) return; // extension objets coupée → action `loot` neutre
    const idx = teamIdx ?? get().currentTeam;
    const enabled = get().enabledItems || Object.keys(ITEMS);
    const key = itemH.pickLootItem(0, enabled, category ? { category } : {});
    if (!key) return;
    const res = itemH.grantItem(set, get, idx, key);
    // Sac plein → objet revendu : pas de cérémonie de gain (cohérent coffre).
    if (!res || res.outcome === 'refunded') return;
    // File-aware : si une révélation est déjà à l'écran (plusieurs loots dans
    // la même séquence d'effets), on empile au lieu d'écraser.
    const lr = get().lootReveal;
    if (lr) {
      set({ lootReveal: { ...lr, rest: [...(lr.rest || []), { itemKey: key, title: '🎁 Butin obtenu !' }] } });
    } else {
      get().showLoot(key, { title: '🎁 Butin obtenu !' });
    }
  },

  // Retire un objet à une équipe (action `loseItem`). category : 'equipment' |
  // 'consumable' | undefined (les deux). Repli : perte de `fallbackGold` si rien.
  engineLoseItem: (teamIdx, category, fallbackGold = 0, family) => {
    const idx = teamIdx ?? get().currentTeam;
    const team = get().teams[idx];
    if (!team) return;
    const pool = [];
    // `family` (optionnel) restreint au sac et à une famille précise (ex. 'ingredient').
    if (!family && category !== 'consumable') {
      for (const [slot, v] of Object.entries(team.equipment || {})) { const k = itemH.cellKey(v); if (k && ITEMS[k]) pool.push({ kind: 'equip', slot, key: k }); }
    }
    if (category !== 'equipment') {
      itemH.normalizeBag(team.bag).forEach((c, i) => { const k = itemH.cellKey(c); if (k && ITEMS[k] && (!family || ITEMS[k].family === family)) pool.push({ kind: 'bag', index: i, key: k }); });
    }
    const nt = [...get().teams];
    if (pool.length === 0) {
      const g = Math.max(0, Math.trunc(fallbackGold) || 0);
      if (g > 0) {
        nt[idx] = { ...team, money: Math.max(0, (team.money || 0) - g) };
        set({ teams: nt });
        get().addLog(tg('log.store.loseItemGold', { emoji: team.emoji, name: team.name, n: g }));
        get().checkMoneyMilestone(idx);
      }
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const it = ITEMS[pick.key];
    if (pick.kind === 'equip') {
      nt[idx] = { ...team, equipment: { ...team.equipment, [pick.slot]: null } };
    } else {
      const bag = itemH.normalizeBag(team.bag);
      const c = bag[pick.index];
      bag[pick.index] = itemH.cellN(c) > 1 ? itemH.mkCell(pick.key, itemH.cellN(c) - 1) : null;
      nt[idx] = { ...team, bag };
    }
    set({ teams: nt });
    get().addLog(tg('log.store.loseItem', { emoji: team.emoji, name: team.name, icon: it.icon, iname: loc(it, 'name') }));
  },

  // Vol d'objet CIBLÉ : le voleur (thiefIdx) prend un objet AU HASARD à la victime
  // (victimIdx) et le récupère dans son propre inventaire. Respecte l'immunité au
  // vol d'objet ; repli sur l'or (fallbackGold) si la victime n'a aucun objet.
  engineStealItem: (thiefIdx, victimIdx, category, family, fallbackGold = 0) => {
    const thief = get().teams[thiefIdx];
    const victim = get().teams[victimIdx];
    if (!thief || !victim || thiefIdx === victimIdx) return;
    if (isItemStealImmune(victim)) {
      get().addLog(tg('log.store.stealItemImmune', { emoji: victim.emoji, name: victim.name }));
      return;
    }
    const pool = [];
    if (!family && category !== 'consumable') {
      for (const [slot, v] of Object.entries(victim.equipment || {})) { const k = itemH.cellKey(v); if (k && ITEMS[k]) pool.push({ kind: 'equip', slot, key: k }); }
    }
    if (category !== 'equipment') {
      itemH.normalizeBag(victim.bag).forEach((c, i) => { const k = itemH.cellKey(c); if (k && ITEMS[k] && (!family || ITEMS[k].family === family)) pool.push({ kind: 'bag', index: i, key: k }); });
    }
    const nt = [...get().teams];
    if (pool.length === 0) {
      const g = Math.max(0, Math.trunc(fallbackGold) || 0);
      const take = Math.min(g, victim.money || 0);
      if (take > 0) {
        nt[victimIdx] = { ...victim, money: (victim.money || 0) - take };
        nt[thiefIdx] = { ...nt[thiefIdx], money: (nt[thiefIdx].money || 0) + take };
        set({ teams: nt });
        get().addLog(tg('log.store.stealItemGold', { aemoji: thief.emoji, aname: thief.name, vemoji: victim.emoji, vname: victim.name, n: take }));
        get().checkMoneyMilestone(thiefIdx);
      } else {
        get().addLog(tg('log.store.stealItemNone', { aemoji: thief.emoji, aname: thief.name, vemoji: victim.emoji, vname: victim.name }));
      }
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const it = ITEMS[pick.key];
    // Retire l'objet à la victime et CONSERVE l'instance (enchantements inclus)
    // pour la transférer telle quelle au voleur.
    let stolenInstance;
    if (pick.kind === 'equip') {
      stolenInstance = victim.equipment?.[pick.slot] ?? pick.key;
      nt[victimIdx] = { ...victim, equipment: { ...victim.equipment, [pick.slot]: null } };
    } else {
      const bag = itemH.normalizeBag(victim.bag);
      const c = bag[pick.index];
      // Une pile (>1) : on ne prend qu'une unité (la clé, sans enchant sur les piles).
      stolenInstance = itemH.cellN(c) > 1 ? pick.key : c;
      bag[pick.index] = itemH.cellN(c) > 1 ? itemH.mkCell(pick.key, itemH.cellN(c) - 1) : null;
      nt[victimIdx] = { ...victim, bag };
    }
    // Donne l'objet au voleur (placeItem gère l'équipement libre / le sac / le
    // repli en or si l'inventaire est plein).
    const r = itemH.placeItem(nt[thiefIdx], stolenInstance);
    nt[thiefIdx] = r.team;
    set({ teams: nt });
    get().addLog(r.outcome === 'refunded'
      ? tg('log.store.stealItemFull', { aemoji: thief.emoji, aname: thief.name, icon: it.icon, iname: loc(it, 'name'), vemoji: victim.emoji, vname: victim.name, n: r.refund })
      : tg('log.store.stealItem', { aemoji: thief.emoji, aname: thief.name, icon: it.icon, iname: loc(it, 'name'), vemoji: victim.emoji, vname: victim.name }));
  },

  // === Actions d'événements liées aux extensions Alchimie & Enchantement =======

  // Donne un objet PRÉCIS (clé) à une équipe. `reveal` : cérémonie de gain (file-aware).
  engineGrantItem: (teamIdx, key, { reveal = true, title = '🎁 Reçu !' } = {}) => {
    const idx = teamIdx ?? get().currentTeam;
    if (!ITEMS[key]) return;
    const res = itemH.grantItem(set, get, idx, key);
    if (!res || res.outcome === 'refunded' || !reveal) return;
    const lr = get().lootReveal;
    if (lr) set({ lootReveal: { ...lr, rest: [...(lr.rest || []), { itemKey: key, title }] } });
    else get().showLoot(key, { title });
  },

  // Donne N ingrédients d'alchimie ALÉATOIRES (pondérés) à une équipe.
  engineGrantIngredient: (teamIdx, n = 1) => {
    const idx = teamIdx ?? get().currentTeam;
    const enabled = get().enabledItems || Object.keys(ITEMS);
    for (let i = 0; i < Math.max(1, n); i++) {
      const key = itemH.pickLootIngredient(enabled, null);
      if (key) get().engineGrantItem(idx, key, { reveal: i === 0, title: '🌿 Ingrédient récolté !' });
    }
  },

  // Révèle une recette d'alchimie (au grimoire de l'équipe). Aléatoire si non précisée.
  engineDiscoverRecipe: (teamIdx, recipeKey) => {
    const idx = teamIdx ?? get().currentTeam;
    const team = get().teams[idx];
    if (!team) return;
    const known = team.knownRecipes || [];
    let rid = recipeKey;
    if (!rid) {
      const undisc = RECIPES.filter((r) => !known.includes(r.id));
      if (!undisc.length) return;
      rid = undisc[Math.floor(Math.random() * undisc.length)].id;
    }
    if (known.includes(rid)) return;
    const recipe = RECIPES.find((r) => r.id === rid);
    if (!recipe) return;
    const nt = [...get().teams];
    nt[idx] = { ...team, knownRecipes: [...known, rid] };
    set({ teams: nt });
    const pName = ITEMS[recipe.potion] ? loc(ITEMS[recipe.potion], 'name') : recipe.potion;
    get().addLog(tg('log.fx.discoverRecipe', { emoji: team.emoji, name: team.name, potion: pName }));
  },

  // Enchante GRATUITEMENT une pièce équipée (specs données, sinon une rune aléatoire
  // légère). Choisit une pièce sous le plafond d'enchants. Sans effet si rien à enchanter.
  engineEnchantEquipped: (teamIdx, specs, slot) => {
    const idx = teamIdx ?? get().currentTeam;
    const team = get().teams[idx];
    if (!team) return;
    const RUNES = [
      { type: 'timerBonus', value: 2 },
      { type: 'reculReduction', value: 1 },
      { type: 'reflectChance', value: 15 },
      { kind: 'trigger', on: 'roll', values: [6], do: [{ action: 'money', mode: 'gain', target: 'self', n: 10, unit: 'flat' }] },
      { kind: 'trigger', on: 'correct', do: [{ action: 'money', mode: 'gain', target: 'self', n: 4, unit: 'flat' }] },
    ];
    const slots = ['head', 'body', 'feet'].filter((s) => {
      const v = team.equipment?.[s];
      const k = itemKeyOf(v);
      return k && ITEMS[k] && itemEnchantsOf(v).length < ENCHANT_CAP_PER_PIECE;
    });
    if (!slots.length) return;
    const useSlot = slot && slots.includes(slot) ? slot : slots[Math.floor(Math.random() * slots.length)];
    const toApply = (specs && specs.length) ? specs : [RUNES[Math.floor(Math.random() * RUNES.length)]];
    const cur = team.equipment[useSlot];
    const enchants = [...itemEnchantsOf(cur), ...toApply].slice(0, ENCHANT_CAP_PER_PIECE);
    const nt = [...get().teams];
    nt[idx] = { ...team, equipment: { ...team.equipment, [useSlot]: { key: itemKeyOf(cur), enchants } } };
    set({ teams: nt });
    const it = ITEMS[itemKeyOf(cur)];
    get().addLog(tg('log.fx.runeEnchant', { emoji: team.emoji, name: team.name, icon: it?.icon || '✨', item: it ? loc(it, 'name') : useSlot }));
    effectH.announce(set, get, '🔮', tg('log.fx.runeEnchant.toast'), '#7a4fae');
  },

  // Efface un enchantement (au hasard) d'une pièce équipée enchantée. Sans effet si aucune.
  engineUnenchant: (teamIdx) => {
    const idx = teamIdx ?? get().currentTeam;
    const team = get().teams[idx];
    if (!team) return;
    const slots = ['head', 'body', 'feet'].filter((s) => itemEnchantsOf(team.equipment?.[s]).length > 0);
    if (!slots.length) return;
    const useSlot = slots[Math.floor(Math.random() * slots.length)];
    const cur = team.equipment[useSlot];
    const ench = itemEnchantsOf(cur);
    const remIdx = Math.floor(Math.random() * ench.length);
    const left = ench.filter((_, i) => i !== remIdx);
    const nt = [...get().teams];
    nt[idx] = { ...team, equipment: { ...team.equipment, [useSlot]: left.length ? { key: itemKeyOf(cur), enchants: left } : itemKeyOf(cur) } };
    set({ teams: nt });
    const it = ITEMS[itemKeyOf(cur)];
    get().addLog(tg('log.fx.unenchant', { emoji: team.emoji, name: team.name, icon: it?.icon || '✨', item: it ? loc(it, 'name') : useSlot }));
  },

  // --- Dev : donne un objet à l'équipe active pour le tester (localhost) ---
  devGiveItem: (key) => { if (get().teams.length) itemH.grantItem(set, get, get().currentTeam, key); },

  // --- Dev : donne une FACE de dé à la réserve de l'équipe active (localhost) ---
  devGiveFace: (face) => {
    const { teams, currentTeam, addLog } = get();
    if (!teams.length || !face) return;
    const team = teams[currentTeam];
    const faceStock = [...(team.faceStock || [])];
    if (faceStock.length >= FACE_STOCK_MAX) return;
    faceStock.push({ value: clampFaceValue(face.value), effects: faceEffects(face), slot: face.slot });
    const nt = [...teams];
    nt[currentTeam] = { ...team, faceStock };
    addLog(`\u{1F6E0}\u{FE0F} ${team.emoji} ${team.name} — [dev] face ${faceShortLabel(face)} (slot ${face.slot}) ajoutée à la réserve.`);
    set({ teams: nt });
  },

  // --- Dev : simulateur de combat (localhost uniquement, voir Setup) ---
  devStartFight: (subject, forceDefault = false) => {
    const { setupTeams, boardParams, level, useBrevet } = get();
    const useSpace = get().mapStyle !== 'legacy';
    const { nodes, viewBox, space } = useSpace ? composeSpaceBoard(boardParams) : generateBoard(boardParams);
    // Deux equipes de test, equipees pour rendre la recompense interessante
    const forgeOn = extOn(get().extensions, 'forge');
    const teams = setupTeams.slice(0, 2).map((t) => ({
      ...t,
      pos: 'depart',
      money: 25,
      powerDef: 'bouclier',
      powerOff: 'foudre',
      powers: { bouclier: { charges: 2, level: 1 }, foudre: { charges: 2, level: 1 } },
      equipment: { head: null, body: null, feet: null },
      bag: Array(itemH.BAG_SIZE).fill(null),
      ...(forgeOn ? { dieFaces: defaultDieFaces(), faceStock: [] } : {}),
    }));
    const questions = getQuestions(level, { brevet: useBrevet });
    set({
      devSandbox: true,
      phase: 'game', teams, board: nodes, viewBox, questions,
      boardDecor: useSpace ? null : generateDecor(nodes),
      boardSpace: useSpace ? space : null,
      currentTeam: 0, finished: false, askedQuestions: {}, log: [],
      ...TURN_RESET, movePath: null,
      showQuestion: null, showEvent: null, showFight: null, showDiceModal: false, eventApplied: false, lootReveal: null,
    });
    fightH.startFight(set, get, 1, subject);
    if (forceDefault) set({ showFight: { ...get().showFight, forceDefault: true } });
  },

  // --- Fight (delegated) ---
  // Combat de boss lancé depuis l'événement « Boss : le Prof » (choix du mini-jeu).
  startBossFight: (subject) => {
    set({ showEvent: null, eventApplied: true });
    fightH.startBossFight(set, get, subject);
  },
  fightBegin: () => fightH.fightBegin(set, get),
  fightStart: () => fightH.fightStart(set, get),
  fightRoundWin: (side) => fightH.fightRoundWin(set, get, side),
  fightMatchWin: (side) => fightH.fightMatchWin(set, get, side),
  fightChooseReward: (choice) => fightH.fightChooseReward(set, get, choice),
  closeFight: () => fightH.closeFight(set, get),
  // Duel éclair (en ligne) : un duelliste répond à la question de course.
  submitFightAnswer: (teamIdx, index) => fightH.submitFightAnswer(set, get, teamIdx, index),
  // Route un intent de combat venu d'un duelliste (attaquant OU défenseur). Le
  // défenseur n'étant pas l'équipe active, ces intents contournent le verrou
  // « équipe active » — d'où ce dispatcher dédié (mode en ligne).
  applyFightIntent: (idx, type, payload = {}) => {
    const f = get().showFight;
    if (!f || (idx !== f.attackerIndex && idx !== f.defenderIndex)) return;
    if (type === 'turnFightBegin') { get().fightBegin(); return; }
    if (type === 'turnFightAnswer') { get().submitFightAnswer(idx, payload.index); return; }
    if (type === 'turnFightClose') { get().closeFight(); return; }
    if (type === 'turnFightReward') {
      const winnerIdx = f.winnerSide === 'attacker' ? f.attackerIndex : f.winnerSide === 'defender' ? f.defenderIndex : -1;
      if (idx === winnerIdx) get().fightChooseReward(payload.choice);
    }
  },
  // Tire une question pour un mini-jeu de combat (marquee comme posee)
  fightPickQuestion: (subject) => {
    const st = get();
    // Résout la catégorie → sous-thème (thème multi / 'lv2' = langue de l'attaquant
    // / identité). En duel, on résout pour l'équipe qui arrive (attaquant).
    subject = st.resolveSubjectFor(subject, st.showFight?.attackerIndex ?? st.currentTeam);
    const { questions, askedQuestions } = st;
    const pool = questions[subject] || [];
    const asked = askedQuestions[subject] || new Set();
    const result = pickQuestion(pool, asked);
    if (!result) return null;
    set({ askedQuestions: { ...askedQuestions, [subject]: result.newAsked } });
    return result.question;
  },

  // --- Powers (delegated) ---
  usePower: (pk) => powerH.usePower(set, get, pk),
  useIndice: () => powerH.useIndice(set, get),
  useRelance: () => powerH.useRelance(set, get),
  useRelanceSwap: () => powerH.useRelanceSwap(set, get),
  useShieldImmunity: () => powerH.useShieldImmunity(set, get),
  useClairvoyance: () => powerH.useClairvoyance(set, get),
  useSablierBroken: () => powerH.useSablierBroken(set, get),
  // Ouvre le sélecteur de cible en mode « Renvoi au départ » (Foudre ultime).
  openFoudreBanish: () => { if (!get().finished) set({ showTargetPicker: { powerKey: 'foudre', banish: true } }); },
  applyOffensivePower: (ti) => powerH.applyOffensivePower(set, get, ti),
  cancelTargetPicker: () => powerH.cancelTargetPicker(set, get),

  // --- Charge picker (delegated) ---
  chargePickerChoice: (pk) => powerH.chargePickerChoice(set, get, pk),
  chargePickerSkip: () => powerH.chargePickerSkip(set, get),

  // --- Shop (delegated) ---
  openShop: () => {
    const { finished, rolling, showQuestion, showEvent, showFight, awaitingChoice, teams, currentTeam } = get();
    if (finished || rolling || showQuestion || showEvent || showFight || awaitingChoice) return;
    // Pluie maudite (météo) : la boutique est fermée pendant X tours.
    if (teams[currentTeam]?.shopBlockedTurns > 0) {
      const t = teams[currentTeam];
      get().addLog(tgPlural('log.weather.shopBlocked', t.shopBlockedTurns, { emoji: t.emoji, name: t.name, n: t.shopBlockedTurns }));
      return;
    }
    // Visiter la boutique remet à zéro le compteur du prompt de l'équipe active.
    const nt = teams.slice();
    if (nt[currentTeam]) nt[currentTeam] = { ...nt[currentTeam], turnsSinceShop: 0 };
    set({ showShop: true, showShopPrompt: false, teams: nt });
  },
  // Prompt « Visiter la boutique ? » : accepter ouvre la boutique (reset compteur
  // via openShop) ; « Plus tard » referme et remet le compteur à 0 (snooze : ne
  // re-proposé que dans shopPromptDelay tours).
  acceptShopPrompt: () => { set({ showShopPrompt: false }); get().openShop(); },
  dismissShopPrompt: () => {
    const { teams, currentTeam } = get();
    const nt = teams.slice();
    if (nt[currentTeam]) nt[currentTeam] = { ...nt[currentTeam], turnsSinceShop: 0 };
    set({ showShopPrompt: false, teams: nt });
  },
  closeShop: () => {
    // Marché Noir : la boutique a été ouverte par un événement → fermer = fin du tour.
    const mn = typeof get().showShop === 'object' && get().showShop?.marcheNoir;
    set({ showShop: false });
    if (mn) get().finishEventTurn(); // Marché Noir = événement → question puis fin de tour
  },
  buyNewPower: (pk) => powerH.buyNewPower(set, get, pk),
  buyPowerCharge: (pk) => powerH.buyPowerCharge(set, get, pk),
  upgradePowerLevel: (pk) => powerH.upgradePowerLevel(set, get, pk),
  chooseSpec: (specKey) => powerH.chooseSpec(set, get, specKey),
  // Enchantement : applique le parchemin sur la pièce du slot choisi.
  chooseEnchantSlot: (slot) => {
    const p = get().showEnchantPicker;
    if (!p) return;
    itemH.enchantWith(set, get, get().currentTeam, p.bagIndex, slot);
    set({ showEnchantPicker: null });
  },
  cancelEnchant: () => set({ showEnchantPicker: null }),

  // Autel du Scribe (TBI) : grave un parchemin custom pour l'équipe active.
  // `parts` = 1-2 effets configurés (cf. enchantPalette). Résout le 1er parchemin
  // vierge du sac. Renvoie le résultat de craftParchment ({ ok, reason? }).
  showScribe: false,
  openScribe: () => { if (craftEnabledFor(get().extensions, get().teams[get().currentTeam], 'enchant')) set({ showScribe: true }); },
  closeScribe: () => set({ showScribe: false }),

  // --- Atelier d'alchimie sur le TBI (extension alchemy) : même craft que le
  // mobile, appliqué DIRECTEMENT pour l'équipe active (craftPotionFor). ---
  showAlchemy: false,
  openAlchemy: () => { if (craftEnabledFor(get().extensions, get().teams[get().currentTeam], 'alchemy')) set({ showAlchemy: true }); },
  closeAlchemy: () => set({ showAlchemy: false }),
  // Distille 3 ingrédients (par CLÉS) en résolvant chacun vers une case DISTINCTE
  // du sac positionnel du TBI (comme l'intent mobile). Renvoie le résultat de craft.
  craftPotionFor: (teamIdx, keys) => {
    const t = get().teams[teamIdx];
    if (!t) return { ok: false };
    const bag = itemH.normalizeBag(t.bag);
    const used = [];
    const resolve = (k) => { const i = bag.findIndex((c, j) => !used.includes(j) && itemH.cellKey(c) === k); if (i >= 0) used.push(i); return i; };
    return itemH.craftPotion(set, get, teamIdx, (keys || []).map(resolve));
  },

  // --- Forge de dés : atelier ouvert depuis le dé 3D du HUD (extension forge) ---
  showForge: false,
  openForge: () => { if (craftEnabledFor(get().extensions, get().teams[get().currentTeam], 'forge')) set({ showForge: true }); },
  closeForge: () => set({ showForge: false }),
  craftParchmentFor: (teamIdx, parts) => {
    const t = get().teams[teamIdx];
    if (!t) return { ok: false };
    const bag = itemH.normalizeBag(t.bag);
    const i = bag.findIndex((c) => { const it = ITEMS[itemH.cellKey(c)]; return it && it.family === 'parchment' && it.blank; });
    if (i < 0) return { ok: false, reason: 'aucun parchemin vierge' };
    return itemH.craftParchment(set, get, teamIdx, i, parts);
  },

  // --- Items / inventaire (delegated) ---
  openInventory: () => {
    const { finished, rolling, showQuestion, showEvent, showFight, awaitingChoice } = get();
    if (finished || rolling || showQuestion || showEvent || showFight || awaitingChoice) return;
    set({ showInventory: true });
  },
  closeInventory: () => set({ showInventory: false }),
  buyItem: (key) => itemH.buyItem(set, get, key),
  // Forge : achète une face de la vitrine → réserve de l'équipe (faceStock),
  // renouvelle l'emplacement acheté (comme les objets). teamIndex optionnel (mobile).
  buyFace: (faceIndex, teamIndex) => {
    const st = get();
    const idx = teamIndex ?? st.currentTeam;
    const team = st.teams[idx];
    if (!craftEnabledFor(st.extensions, team, 'forge')) return; // métier ≠ forgeron
    const stock = st.shopFaceStock || [];
    const f = stock[faceIndex];
    if (!team || !f) return;
    const price = f.price || 0;
    const faceStock = [...(team.faceStock || [])];
    if ((team.money || 0) < price || faceStock.length >= FACE_STOCK_MAX) return;
    // La face conserve son SLOT cible : elle ne pourra être forgée que là.
    faceStock.push({ value: f.value, effects: faceEffects(f), slot: f.slot });
    const nt = [...st.teams];
    nt[idx] = { ...team, money: team.money - price, faceStock };
    const newStock = [...stock];
    // Renouvelle l'emplacement acheté par une autre face du catalogue (pondérée
    // par rareté, absente du stock courant) — comme la boutique d'objets.
    const repl = pickReplacementFace(newStock.filter((_, i) => i !== faceIndex), Math.random);
    newStock[faceIndex] = repl || newStock[faceIndex];
    st.addLog(tg('log.store.buyFace', { emoji: team.emoji, name: team.name, label: faceShortLabel(f), price }));
    set({ teams: nt, shopFaceStock: newStock });
    saveGame(get());
  },
  // Forge : pose une face de la réserve (stockIndex) sur un slot du dé (slotIndex).
  // L'ADRESSE du slot (base) est immuable ; on remplace sa couche forge. Une face
  // écrasée est PERDUE (pas de recyclage) — la confirmation est gérée côté UI.
  // `fromIntent` (forge initiée depuis le TÉLÉPHONE) : on saute la cérémonie TBI,
  // l'animation de coulée se joue sur le téléphone de l'élève (cf. MobileApp).
  forgeFace: (slotIndex, stockIndex, teamIndex, fromIntent = false) => {
    const st = get();
    const idx = teamIndex ?? st.currentTeam;
    const team = st.teams[idx];
    if (!team) return;
    if (!craftEnabledFor(st.extensions, team, 'forge')) return; // métier ≠ forgeron
    const stock = team.faceStock || [];
    const f = stock[stockIndex];
    if (!f) return;
    // Face liée à un slot : elle se pose UNIQUEMENT sur son slot cible (f.slot).
    // Repli sur slotIndex pour d'éventuelles faces héritées sans slot.
    const target = f.slot ? f.slot - 1 : slotIndex;
    if (target < 0 || target >= DIE_SLOTS) return;
    if (slotIndex != null && slotIndex !== target) return; // garde : slot non concordant
    const faces = getDieFaces(team).map((face, i) => (
      i === target ? { base: i + 1, value: clampFaceValue(f.value), effects: faceEffects(f) } : face
    ));
    const nt = [...st.teams];
    nt[idx] = { ...team, dieFaces: faces, faceStock: stock.filter((_, i) => i !== stockIndex) };
    st.addLog(tg('log.store.forgeFace', { emoji: team.emoji, name: team.name, base: target + 1, label: faceShortLabel(f) }));
    // Cérémonie de forge (overlay TBI) : marteau/enclume/étincelles + son.
    // Sautée pour les forges venant du téléphone (l'animation est sur le tél).
    const ceremony = fromIntent ? {} : { forgeCeremony: { teamIdx: idx, base: target + 1, face: { value: clampFaceValue(f.value), effects: faceEffects(f) } } };
    set({ teams: nt, ...ceremony });
    saveGame(get());
  },
  clearForgeCeremony: () => set({ forgeCeremony: null }),
  sellEquipment: (slot) => itemH.sellEquipment(set, get, slot),
  sellBagItem: (i) => itemH.sellBagItem(set, get, i),
  useConsumable: (i) => itemH.useConsumable(set, get, i),
  moveInventoryItem: (fromKey, toKey) => itemH.moveInventoryItem(set, get, fromKey, toKey),

  // --- Intentions mobiles (édition d'équipement à distance) ---
  // Le téléphone envoie une intention référant son équipe par son `token` ; le
  // TBI (maître) la valide (jeton connu + équipe pas en pleine résolution) puis
  // l'applique sur la BONNE équipe. Types : equip {key} / unequip {slot} /
  // sellEquip {slot} / sellBag {key} — par CLÉ d'objet (les index de sac du
  // mobile ne correspondent pas au sac positionnel du TBI).
  applyTeamIntent: (token, type, payload = {}) => {
    const st = get();
    const idx = st.teams.findIndex((t) => t.token && t.token === token);
    if (idx < 0) return; // jeton inconnu (équipe retirée ?)
    // Prestation de forgeage : la session collaborative est PARALLÈLE à la partie —
    // on traite ses intents AVANT le verrou de résolution (sinon le forgeron, s'il
    // est l'équipe active, ne pourrait pas forger pendant son propre tour).
    if (type === 'forgeServicePlace') { get().forgeServicePlace(payload.slotIndex, payload.stockIndex, idx); return; }
    if (type === 'forgeServiceRemove') { get().forgeServiceRemove(payload.slotIndex, idx); return; }
    if (type === 'forgeServiceValidate') { get().forgeServiceValidate(idx); return; }
    if (type === 'forgeServiceCancel') { get().forgeServiceCancel(idx); return; }
    // Duel éclair (EN LIGNE) : les intents de combat peuvent venir de l'ATTAQUANT
    // ou du DÉFENSEUR (le défenseur n'est pas l'équipe active) → routage dédié,
    // hors du verrou « équipe active ». Réservé au mode online : le mode classe
    // garde son comportement (seul l'attaquant pilote le duel au TBI).
    if (st.connectionMode === 'online' && st.showFight && typeof type === 'string'
      && (type === 'turnFightAnswer' || type === 'turnFightReward' || type === 'turnFightClose' || type === 'turnFightBegin')) {
      if (idx === st.showFight.attackerIndex || idx === st.showFight.defenderIndex) { get().applyFightIntent(idx, type, payload); return; }
    }
    // Manette téléphone : les intents « de tour » (turn*) sont réservés à
    // l'équipe ACTIVE et autorisés PENDANT sa résolution (c'est leur raison
    // d'être) — ils passent donc AVANT le verrou, avec leurs propres gardes.
    if (typeof type === 'string' && type.startsWith('turn')) { get().applyTurnIntent(idx, type, payload); return; }
    const resolving = !!(st.showQuestion || st.showEvent || st.showFight || st.showDuelChoice
      || st.rolling || st.showDiceModal || st.awaitingChoice || st.pendingActions || st.pendingLanding);
    // Bloqué si partie finie, ou si c'est l'équipe ACTIVE en pleine résolution.
    if (st.finished || (idx === st.currentTeam && resolving)) return;

    const team = st.teams[idx];
    if (!team) return;
    if (type === 'equip') {
      const i = itemH.normalizeBag(team.bag).findIndex((c) => itemH.cellKey(c) === payload.key);
      const item = ITEMS[payload.key];
      if (i >= 0 && item && item.slot !== 'consumable') itemH.moveInventoryItem(set, get, `bag:${i}`, `equip:${item.slot}`, idx);
    } else if (type === 'unequip') {
      const free = itemH.normalizeBag(team.bag).indexOf(null);
      if (free >= 0 && team.equipment?.[payload.slot]) itemH.moveInventoryItem(set, get, `equip:${payload.slot}`, `bag:${free}`, idx);
    } else if (type === 'sellEquip') {
      itemH.sellEquipment(set, get, payload.slot, idx);
    } else if (type === 'sellBag') {
      const i = itemH.normalizeBag(team.bag).findIndex((c) => itemH.cellKey(c) === payload.key);
      if (i >= 0) itemH.sellBagItem(set, get, i, idx);
    } else if (type === 'craft') {
      // Alchimie : le mobile envoie les CLÉS des 3 ingrédients (payload.keys) —
      // PAS des index : son sac est compacté (filter(Boolean)) alors que le TBI a
      // un sac positionnel (avec trous). On résout chaque clé vers une case
      // DISTINCTE, comme equip/sellBag/enchant. (Rétro-compat : payload.bag = index.)
      const bag = itemH.normalizeBag(team.bag);
      const used = [];
      const resolve = (k) => {
        const i = bag.findIndex((c, j) => !used.includes(j) && itemH.cellKey(c) === k);
        if (i >= 0) used.push(i);
        return i;
      };
      const indices = Array.isArray(payload.keys) ? payload.keys.map(resolve) : (payload.bag || []);
      itemH.craftPotion(set, get, idx, indices);
    } else if (type === 'enchant') {
      // Enchantement : applique le parchemin (payload.key) sur la pièce du slot.
      const i = itemH.normalizeBag(team.bag).findIndex((c) => itemH.cellKey(c) === payload.key);
      if (i >= 0) itemH.enchantWith(set, get, idx, i, payload.slot);
    } else if (type === 'craftParchment') {
      // Autel du Scribe : grave un parchemin custom (payload.parts) en consommant
      // un parchemin vierge + l'or. Résout le vierge vers une case du sac du TBI.
      const i = itemH.normalizeBag(team.bag).findIndex((c) => { const it = ITEMS[itemH.cellKey(c)]; return it && it.family === 'parchment' && it.blank; });
      if (i >= 0) itemH.craftParchment(set, get, idx, i, payload.parts || []);
    } else if (type === 'buyItem') {
      // Achat d'un objet de la boutique pour l'équipe du téléphone.
      itemH.buyItem(set, get, payload.key, idx);
    } else if (type === 'buyFace') {
      // Forge : achat d'une face de la vitrine (index) pour l'équipe du téléphone.
      get().buyFace(payload.faceIndex, idx);
    } else if (type === 'forgeFace') {
      // Forge : pose d'une face de la réserve sur un slot du dé (atelier mobile).
      // fromIntent=true → pas de cérémonie TBI (l'animation joue sur le téléphone).
      get().forgeFace(payload.slotIndex, payload.stockIndex, idx, true);
    } else if (type === 'buyPower') {
      // Déblocage d'un nouveau pouvoir.
      powerH.buyNewPower(set, get, payload.key, idx);
    } else if (type === 'buyPowerCharge') {
      powerH.buyPowerCharge(set, get, payload.key, idx);
    } else if (type === 'upgradePower') {
      powerH.upgradePowerLevel(set, get, payload.key, idx);
    } else if (type === 'chooseSpec') {
      // Choix d'une voie (Maîtrise, niv. 5/10) à distance.
      powerH.chooseSpecFor(set, get, idx, payload.key, payload.slot, payload.specKey);
    } else if (type === 'relanceSwap') {
      // Ultime « Échange de place » (Relance L10) déclenché depuis le téléphone.
      powerH.useRelanceSwap(set, get, idx);
    } else if (type === 'shieldImmunity') {
      // Ultime « Immunité totale » (Bouclier L10) déclenché depuis le téléphone.
      powerH.useShieldImmunity(set, get, idx);
    } else if (type === 'chooseMetier') {
      // Métiers : le propriétaire choisit son métier depuis le téléphone.
      get().chooseMetier(payload.craft, idx);
    }
  },

  // --- Manette téléphone : intents « de tour » (turn*) ---
  // L'équipe ACTIVE pilote SA résolution depuis son téléphone. Chaque intent est
  // mappé sur le handler TBI existant (qui garde ses propres gardes internes —
  // double filet) après trois étages de garde :
  //   1. global   : toggle actif, partie en cours, émetteur = équipe active ;
  //   2. anti-doublon : `payload.uid` (fetch + realtime peuvent livrer deux fois,
  //      et certains handlers ne sont pas idempotents, ex. usePower) ;
  //   3. phase    : l'intent n'est valide que si l'état de tour correspondant est
  //      ouvert (turnAnswerSelect ⇒ question affichée, etc.).
  // Course TBI/téléphone : premier arrivé gagne, le second est no-op (voulu — le
  // prof peut toujours débloquer un téléphone à plat depuis le tableau).
  applyTurnIntent: (idx, type, payload = {}) => {
    const st = get();
    if (!st.phoneController || st.finished || idx !== st.currentTeam) return;
    const uid = payload.uid;
    if (uid != null) {
      if (turnIntentSeen.has(uid)) return;
      turnIntentSeen.add(uid);
      // Plafond FIFO : on ne garde que les ~100 derniers uid (Set ordonné par insertion).
      if (turnIntentSeen.size > 100) turnIntentSeen.delete(turnIntentSeen.values().next().value);
    }
    const team = st.teams[idx];
    if (!team) return;
    switch (type) {
      // --- Déplacement ---
      case 'turnRoll':
        get().rollDice(); // gardes internes complètes (résolution, gel…)
        return;
      case 'turnChooseJunction': {
        const opts = st.board?.[team.pos]?.next || [];
        if (st.awaitingChoice && opts.includes(payload.nodeId)) get().chooseJunction(payload.nodeId);
        return;
      }
      case 'turnConfirmLanding':
        if (st.pendingLanding) get().confirmLanding();
        return;
      // --- Question ---
      case 'turnAnswerSelect':
        // selectAnswer garde déjà : question ouverte, non révélée, index valide
        // et non barré (indiceHidden).
        if (st.showQuestion) get().selectAnswer(payload.index);
        return;
      case 'turnQuestionContinue':
        if (st.showQuestion?.answerRevealed) get().continueQuestion();
        return;
      // --- Pouvoirs & consommables ---
      case 'turnUsePower':
        // usePower garde tout (charges, contexte via canUsePowerInContext…).
        if (typeof payload.key === 'string') get().usePower(payload.key);
        return;
      case 'turnUseConsumable': {
        // Par CLÉ (le sac mobile est compacté, le sac TBI est positionnel).
        const i = itemH.normalizeBag(team.bag).findIndex((c) => itemH.cellKey(c) === payload.key);
        if (i >= 0) get().useConsumable(i);
        return;
      }
      case 'turnUseReroll': {
        // Le téléphone renvoie l'INDEX de la liste publiée ; on la recalcule ici
        // (même état ⇒ même liste — le TBI reste maître de la résolution).
        if (!st.showQuestion || st.showQuestion.answerRevealed) return;
        const opts = effectH.questionRerollOptions(team, st.rerollUsed, st.showQuestion.subject);
        const opt = opts[payload.optIndex];
        if (opt) get().useQuestionReroll(opt);
        return;
      }
      // --- Pickers (interrupts du moteur d'effets / pouvoirs) ---
      case 'turnSelectTarget': {
        const stp = st.showTargetPicker;
        if (!stp || !Number.isInteger(payload.index) || !st.teams[payload.index]) return;
        // Mêmes règles que la modale TBI : pas soi-même sans allowSelf, pas de
        // cible sous Immunité totale. (La trahison de pacte est confirmée côté
        // téléphone avant l'envoi — comme la modale TBI confirme avant d'agir.)
        if (payload.index === idx && !stp.allowSelf) return;
        if (payload.index !== idx && (st.teams[payload.index].totalImmuneTurns ?? 0) > 0) return;
        get().selectTarget(payload.index);
        return;
      }
      case 'turnCancelTarget':
        if (st.showTargetPicker) get().cancelTargetPicker();
        return;
      case 'turnSelectSubject':
        if (st.showSubjectPicker && typeof payload.key === 'string') get().selectSubject(payload.key);
        return;
      case 'turnChargePick':
        if (st.showChargePicker && typeof payload.key === 'string') get().chargePickerChoice(payload.key);
        return;
      case 'turnChargeSkip':
        if (st.showChargePicker) get().chargePickerSkip();
        return;
      // --- Pose de piège (choix de case au téléphone) ---
      case 'turnSelectTile':
        if (st.showTilePicker && st.board?.[payload.nodeId] && st.board[payload.nodeId].type !== 'arrivee') get().selectTile(payload.nodeId);
        return;
      case 'turnCancelTile':
        if (st.showTilePicker) get().cancelTilePicker();
        return;
      // --- Point de contrôle (téléportation manuelle du propriétaire) ---
      case 'turnCheckpoint':
        get().teleportToCheckpoint(); // gardes internes (bon tour, hors résolution, %)
        return;
      // --- Duel (choix de l'arrivant) ---
      case 'turnDuelChoose':
        // chooseDuel garde déjà defenders.includes (les immunisés n'y sont pas).
        if (st.showDuelChoice && Number.isInteger(payload.index)) get().chooseDuel(payload.index);
        return;
      case 'turnDuelDecline':
        if (st.showDuelChoice) get().declineDuel();
        return;
      // --- Événements (chaque intent est gardé par la phase de showEvent) ---
      case 'turnEventAccept':
        if (st.showEvent?.phase === 'intro') get().acceptEvent();
        return;
      case 'turnEventDecline':
        // decline sert aussi de « passer mon chemin » dans les choix marchands.
        if (st.showEvent && (st.showEvent.phase === 'intro' || st.showEvent.phase === 'choice')) get().declineEvent();
        return;
      case 'turnEventTarget':
        if (st.showEvent?.phase === 'target' && Number.isInteger(payload.index)
          && payload.index !== idx && st.teams[payload.index]) get().eventSelectTarget(payload.index);
        return;
      case 'turnEventAnswer': {
        const d = st.showEvent?.data;
        if (st.showEvent?.phase === 'question' && d?.eventQuestion && !d.questionRevealed
          && Number.isInteger(payload.index)) get().eventAnswerQuestion(payload.index);
        return;
      }
      case 'turnEventVaToutContinue':
        if (st.showEvent?.phase === 'vaToutChoice') get().eventVaToutContinue();
        return;
      case 'turnEventVaToutCashOut':
        if (st.showEvent?.phase === 'vaToutChoice') get().eventVaToutCashOut();
        return;
      case 'turnEventGift':
        // eventChooseGift re-vérifie que l'objet fait partie des coffres proposés.
        if (st.showEvent?.phase === 'choice' && st.showEvent.key === 'troisCoffres') get().eventChooseGift(payload.itemKey);
        return;
      case 'turnEventRecharge':
        if (st.showEvent?.phase === 'choice' && st.showEvent.key === 'recharge'
          && team.powers?.[payload.key]) get().eventRechargeChoice(payload.key);
        return;
      case 'turnEventMarcheNoir':
        if (st.showEvent?.phase === 'choice' && st.showEvent.key === 'marcheNoir'
          && team.powers?.[payload.key]) get().eventMarcheNoirBuy(payload.key);
        return;
      case 'turnEventBuy':
        if (st.showEvent?.phase === 'choice' && st.showEvent.key === 'marchandAmbulant'
          && (st.showEvent.data?.merchandise || []).includes(payload.itemKey)) get().eventMerchantBuy(payload.itemKey);
        return;
      case 'turnEventVol': {
        const se = st.showEvent;
        if (se?.phase === 'choice' && se.key === 'vol') {
          const tgt = st.teams[se.data?.targetIndex];
          if (tgt && (tgt.powers?.[payload.stealKey]?.charges || 0) > 0 && team.powers?.[payload.giveKey]) {
            get().eventVolApply(payload.stealKey, payload.giveKey);
          }
        }
        return;
      }
      case 'turnEventBoss':
        if (st.showEvent?.phase === 'choice' && st.showEvent.key === 'bossProf'
          && typeof payload.subject === 'string') get().startBossFight(payload.subject);
        return;
      case 'turnEventClose':
        if (st.showEvent?.phase === 'result') get().closeEvent();
        return;
      // --- Loot / coffre de départ / prompt boutique ---
      case 'turnLootDismiss':
        if (st.lootReveal) get().dismissLoot();
        return;
      case 'turnStarterChest':
        // closeStarterChest valide les clés contre les coffres proposés (≤ keep).
        if (st.showStarterChest && Array.isArray(payload.keys)) get().closeStarterChest(payload.keys);
        return;
      case 'turnShopAccept':
        if (st.showShopPrompt) get().acceptShopPrompt();
        return;
      case 'turnShopDismiss':
        if (st.showShopPrompt) get().dismissShopPrompt();
        return;
      // --- Combat : périphérie seulement (le mini-jeu se joue au TBI) ---
      case 'turnFightBegin':
        if (st.showFight?.phase === 'versus') get().fightBegin();
        return;
      case 'turnFightReward': {
        const sf = st.showFight;
        if (sf?.phase === 'reward' && ['steal', 'knockback', 'loot'].includes(payload.choice) && !sf.reward?.choice) {
          // La récompense revient au VAINQUEUR : seul son téléphone peut choisir
          // (s'il n'est pas l'équipe active, il passe par le TBI — limite v1).
          const wIdx = sf.winnerSide === 'attacker' ? sf.attackerIndex : sf.defenderIndex;
          if (wIdx === idx) get().fightChooseReward(payload.choice);
        }
        return;
      }
      case 'turnFightClose':
        if (st.showFight?.phase === 'result') get().closeFight();
        return;
      default:
        return;
    }
  },

  // Lie un jeton à une équipe : permet à un téléphone de « posséder » l'équipe
  // (édition/achats/troc) sans passer par le lobby. Utilisé par les LIENS DE TEST
  // du TBI (?claim=idx&token=…) pour jouer plusieurs équipes en fenêtres séparées.
  applyClaimIntent: (token, payload = {}) => {
    const idx = Number(payload.idx);
    const st = get();
    if (!token || !Number.isInteger(idx) || !st.teams[idx]) return;
    const newTeams = [...st.teams];
    newTeams[idx] = { ...newTeams[idx], token };
    set({ teams: newTeams });
  },

  // --- Troc entre équipes (extension « trade ») : application ATOMIQUE ---
  // `trade` = ligne quete_trades { from_idx, to_idx, give, want } où give/want =
  // { gold, bag:[itemKey], equip:[slot] }. On re-vérifie la possession des deux
  // côtés À L'INSTANT T puis on transfère en un seul set (jamais d'état perdu).
  // Renvoie { ok, reason } ; le TradeConsumer journalise/efface l'offre.
  applyTrade: (trade) => {
    const st = get();
    const A = trade?.from_idx, B = trade?.to_idx;
    if (st.finished) return { ok: false, reason: 'partie terminée' };
    if (A == null || B == null || A === B || !st.teams[A] || !st.teams[B]) return { ok: false, reason: 'équipe invalide' };
    const resolving = !!(st.showQuestion || st.showEvent || st.showFight || st.showDuelChoice
      || st.rolling || st.showDiceModal || st.awaitingChoice || st.pendingActions || st.pendingLanding);
    if ((A === st.currentTeam || B === st.currentTeam) && resolving) return { ok: false, reason: 'résolution en cours' };

    const ra = takeSpecFrom(st.teams[A], trade.give);
    const rb = takeSpecFrom(st.teams[B], trade.want);
    if (!ra || !rb) return { ok: false, reason: 'objets ou or indisponibles' };
    let ta = giveSpecTo(ra.team, rb.items, rb.gold); // A reçoit ce que B donnait (want)
    let tb = giveSpecTo(rb.team, ra.items, ra.gold); // B reçoit ce que A donnait (give)
    // Diplomatie (« Complots ») : un terme `pact` engage le DONNEUR à ne pas
    // attaquer le receveur pendant N tours (promesse BRISABLE — cf. trahison).
    const secret = isDiploTrade(trade);
    if (hasPactSpec(trade.give)) ta = { ...ta, promises: withPromise(ta.promises, B, pactTurns(trade.give)) };
    if (hasPactSpec(trade.want)) tb = { ...tb, promises: withPromise(tb.promises, A, pactTurns(trade.want)) };
    // Coalition (« attaque commune ») : chaque côté enregistre l'accord de viser
    // la cible avec l'autre équipe. Pur marqueur partagé (aucun effet automatique).
    if (hasCoalitionSpec(trade.give)) ta = { ...ta, coalitions: withCoalition(ta.coalitions, B, trade.give.coalition.against, coalitionTurns(trade.give)) };
    if (hasCoalitionSpec(trade.want)) tb = { ...tb, coalitions: withCoalition(tb.coalitions, A, trade.want.coalition.against, coalitionTurns(trade.want)) };
    const nt = [...st.teams];
    nt[A] = ta; nt[B] = tb;
    set({ teams: nt });
    // Un pacte est SECRET : aucune trace publique sur le TBI (l'or bouge en
    // silence). Un troc classique se journalise comme avant.
    if (!secret) get().addLog(tg('log.store.trade', { emojiA: st.teams[A].emoji, nameA: st.teams[A].name, emojiB: st.teams[B].emoji, nameB: st.teams[B].name }));
    get().checkMoneyMilestone(A); get().checkMoneyMilestone(B);
    if (get().phase === 'game') saveGame(get());
    return { ok: true };
  },

  // --- Prestation de FORGEAGE (troc + forge) : session collaborative à 2 ---
  // Un forgeron propose dans un deal de forger des faces sur le dé d'une autre
  // équipe. À l'acceptation, le TBI ouvre cette session (état diffusé aux 2
  // mobiles) : la réserve de faces du forgeron est mise en ESCROW, il place ses
  // faces sur le dé du CLIENT (brouillon réversible), puis double validation →
  // pose définitive + paiement. Annulation → réserve rendue, aucun paiement.
  forgeService: null,
  // Démarre la session depuis une offre `trade` ACCEPTÉE (appelé par TradeConsumer).
  startForgeService: (trade) => {
    const st = get();
    if (st.finished || st.forgeService) return { ok: false, reason: 'occupé' };
    // Sens du deal : le FORGERON est le côté qui porte le marqueur `forge`.
    //  • give.forge → le proposeur (from) forge le dé du destinataire (to) ; paiement = want.
    //  • want.forge → le destinataire (to) forge le dé du proposeur (from) ; paiement = give.
    const giveForge = !!trade?.give?.forge;
    const providerIdx = giveForge ? trade?.from_idx : trade?.to_idx;
    const customerIdx = giveForge ? trade?.to_idx : trade?.from_idx;
    const price = (giveForge ? trade?.want : trade?.give) || {};
    const provider = st.teams[providerIdx], customer = st.teams[customerIdx];
    if (!provider || !customer || providerIdx === customerIdx) return { ok: false, reason: 'équipe invalide' };
    if (!craftEnabledFor(st.extensions, provider, 'forge')) return { ok: false, reason: 'pas forgeron' };
    // Faces disponibles pour le forgeron : SA réserve (escrow) + le CATALOGUE de la
    // boutique (faces qu'il pourrait acheter) → il place « les faces souhaitées »
    // même sans réserve. Tag `src` pour ne rendre que la réserve à la fin/annulation.
    // Faces disponibles = UNIQUEMENT la réserve du forgeron (faces achetées à
    // l'avance, escrow). Coût de revient réel, symétrique avec potions/parchemins.
    // (La proposition du deal est gatée côté UI sur la présence de faces.)
    const providerStock = (provider.faceStock || []).map((f) => ({ value: f.value, effects: faceEffects(f), slot: f.slot, src: 'reserve' }));
    if (!providerStock.length) return { ok: false, reason: 'aucune face en réserve' };
    const nt = [...st.teams];
    nt[providerIdx] = { ...provider, faceStock: [] }; // escrow : la réserve part en atelier
    set({
      teams: nt,
      forgeService: {
        providerIdx, customerIdx,
        price,                          // ce que le client paie (or/objets)
        providerStock,                  // faces escrow (réserve du forgeron au départ)
        placements: {},                 // { [slotIndex]: stockIndex } — brouillon
        providerOk: false, customerOk: false,
      },
    });
    st.addLog(tg('log.store.forgeServiceStart', {
      pe: provider.emoji, pn: provider.name, ce: customer.emoji, cn: customer.name,
    }));
    if (get().phase === 'game') saveGame(get());
    return { ok: true };
  },
  // Le forgeron pose une face de sa réserve (escrow) sur son slot cible du dé client.
  forgeServicePlace: (slotIndex, stockIndex, teamIndex) => {
    const st = get();
    const fs = st.forgeService;
    if (!fs || teamIndex !== fs.providerIdx) return;
    const face = fs.providerStock[stockIndex];
    if (!face) return;
    const target = face.slot ? face.slot - 1 : slotIndex; // face liée à son slot
    if (target == null || target < 0 || target >= DIE_SLOTS) return;
    // Une face de la réserve ne se pose qu'une fois : on retire son ancienne pose
    // éventuelle, puis on l'affecte au slot cible (en remplaçant ce qui s'y trouvait).
    const placements = {};
    for (const [s, si] of Object.entries(fs.placements || {})) {
      if (si !== stockIndex && Number(s) !== target) placements[s] = si;
    }
    placements[target] = stockIndex;
    set({ forgeService: { ...fs, placements, providerOk: false, customerOk: false, error: null } });
  },
  // Le forgeron retire la face brouillon d'un slot (revient à la face d'origine).
  forgeServiceRemove: (slotIndex, teamIndex) => {
    const st = get();
    const fs = st.forgeService;
    if (!fs || teamIndex !== fs.providerIdx) return;
    const placements = { ...(fs.placements || {}) };
    delete placements[slotIndex];
    set({ forgeService: { ...fs, placements, providerOk: false, customerOk: false, error: null } });
  },
  // Clôt une éventuelle session de forge (ex. fin de partie) en RENDANT l'escrow
  // au forgeron, sans paiement ni log bruyant. Idempotent.
  closeForgeService: () => {
    const st = get();
    const fs = st.forgeService;
    if (!fs) return;
    const nt = [...st.teams];
    const prov = nt[fs.providerIdx];
    const back = (fs.providerStock || []).filter((f) => f.src === 'reserve').map((f) => ({ value: f.value, effects: f.effects, slot: f.slot }));
    if (prov) nt[fs.providerIdx] = { ...prov, faceStock: [...(prov.faceStock || []), ...back] };
    set({ teams: nt, forgeService: null });
  },
  // Validation d'une partie (forgeron ou client). Quand les DEUX valident → pose.
  forgeServiceValidate: (teamIndex) => {
    const st = get();
    const fs = st.forgeService;
    if (!fs || st.finished) return;
    let next = fs;
    if (teamIndex === fs.providerIdx) next = { ...fs, providerOk: true };
    else if (teamIndex === fs.customerIdx) next = { ...fs, customerOk: true };
    else return;
    if (next.providerOk && next.customerOk) { set({ forgeService: next }); get().applyForgeService(); }
    else set({ forgeService: next });
  },
  // Annulation (par l'une des 2 parties) : la réserve escrow est RENDUE au forgeron,
  // aucune face posée, aucun paiement.
  forgeServiceCancel: (teamIndex) => {
    const st = get();
    const fs = st.forgeService;
    if (!fs) return;
    if (teamIndex != null && teamIndex !== fs.providerIdx && teamIndex !== fs.customerIdx) return;
    const nt = [...st.teams];
    const prov = nt[fs.providerIdx];
    // Ne RENDRE que les faces de RÉSERVE escrow (le catalogue n'appartient à personne).
    const reserveBack = (fs.providerStock || []).filter((f) => f.src === 'reserve').map((f) => ({ value: f.value, effects: f.effects, slot: f.slot }));
    if (prov) nt[fs.providerIdx] = { ...prov, faceStock: [...(prov.faceStock || []), ...reserveBack] };
    set({ teams: nt, forgeService: null });
    const customer = st.teams[fs.customerIdx];
    if (prov && customer) st.addLog(tg('log.store.forgeServiceCancel', { pe: prov.emoji, pn: prov.name, ce: customer.emoji, cn: customer.name }));
    if (get().phase === 'game') saveGame(get());
  },
  // Pose DÉFINITIVE (double validation atteinte) : faces sur le dé client, faces
  // non posées rendues au forgeron, paiement transféré. Atomique.
  applyForgeService: () => {
    const st = get();
    const fs = st.forgeService;
    if (!fs || st.finished) return { ok: false };
    const provider = st.teams[fs.providerIdx];
    const customer = st.teams[fs.customerIdx];
    if (!provider || !customer) { set({ forgeService: null }); return { ok: false }; }
    // Paiement (client → forgeron). Échec si le client est devenu insolvable pendant
    // la session : on RÉINITIALISE les validations + on signale l'erreur (sinon les
    // deux mobiles restent figés sur « ✅✅ » sans comprendre), session gardée ouverte.
    const pay = takeSpecFrom(customer, fs.price || {});
    if (!pay) {
      set({ forgeService: { ...fs, providerOk: false, customerOk: false, error: 'payment' } });
      st.addLog(tg('log.store.forgeServicePayFail', { ce: customer.emoji, cn: customer.name }));
      return { ok: false, reason: 'paiement impossible' };
    }
    const placements = fs.placements || {};
    const placedStock = new Set(Object.values(placements).map(Number));
    const faces = getDieFaces(customer).map((face, i) => {
      const si = placements[i];
      if (si == null) return face;
      const f = fs.providerStock[si];
      return { base: i + 1, value: clampFaceValue(f.value), effects: faceEffects(f) };
    });
    // Seules les faces de RÉSERVE non posées sont rendues au forgeron (les faces du
    // catalogue non posées ne reviennent à personne).
    const returned = fs.providerStock
      .filter((f, i) => f.src === 'reserve' && !placedStock.has(i))
      .map((f) => ({ value: f.value, effects: f.effects, slot: f.slot }));
    const custTeam = { ...pay.team, dieFaces: faces };
    let provTeam = giveSpecTo(provider, pay.items, pay.gold);
    provTeam = { ...provTeam, faceStock: [...(provTeam.faceStock || []), ...returned] };
    const nt = [...st.teams];
    nt[fs.providerIdx] = provTeam;
    nt[fs.customerIdx] = custTeam;
    set({ teams: nt, forgeService: null });
    st.addLog(tg('log.store.forgeServiceDone', {
      pe: provider.emoji, pn: provider.name, ce: customer.emoji, cn: customer.name,
      n: placedStock.size,
    }));
    get().checkMoneyMilestone(fs.providerIdx); get().checkMoneyMilestone(fs.customerIdx);
    if (get().phase === 'game') saveGame(get());
    return { ok: true };
  },

  // --- Intentions ADMIN (interface prof sur téléphone, code 54150) ---
  // Contrôle total : agit sur N'IMPORTE quelle équipe (par index), SANS verrou.
  // Types : adminMoney {teamIdx, delta} · adminGiveItem {teamIdx, key, n?} ·
  // adminRemoveEquip {teamIdx, slot} · adminRemoveBag {teamIdx, key}.
  applyAdminIntent: (type, payload = {}) => {
    const st = get();
    // Météo : intent sans équipe cible (s'applique à tout le plateau). Traité
    // AVANT la garde d'équipe. Forçage immédiat (spectacle), sans préavis.
    if (type === 'adminWeather') {
      if (extOn(get().extensions, 'weather') && payload.id) {
        weatherH.triggerWeather(set, get, payload.id, { forced: true });
        if (get().phase === 'game') saveGame(get());
      }
      return;
    }
    const idx = Number(payload.teamIdx);
    const team = st.teams[idx];
    if (!team) return;

    if (type === 'adminMoney') {
      const delta = Math.trunc(Number(payload.delta) || 0);
      const nt = [...st.teams];
      nt[idx] = { ...team, money: Math.max(0, (team.money ?? 0) + delta) };
      set({ teams: nt });
      get().addLog(tg('log.store.adminMoney', { emoji: team.emoji, name: team.name, sign: delta >= 0 ? '+' : '', n: delta }));
      get().checkMoneyMilestone(idx);
    } else if (type === 'adminGiveItem') {
      // n (quantité) : 1 par défaut, plafonné à 9 (plafond d'une pile de sac).
      // Donner plusieurs empile les consommables via grantItem/placeItem.
      const n = Math.max(1, Math.min(9, Math.trunc(Number(payload.n) || 1)));
      if (ITEMS[payload.key]) for (let k = 0; k < n; k++) itemH.grantItem(set, get, idx, payload.key);
    } else if (type === 'adminRemoveEquip') {
      const cur = itemH.cellKey(team.equipment?.[payload.slot]);
      if (cur) {
        const it = ITEMS[cur];
        const nt = [...st.teams];
        nt[idx] = { ...team, equipment: { ...team.equipment, [payload.slot]: null } };
        set({ teams: nt });
        get().addLog(tg('log.store.adminRemoveItem', { emoji: team.emoji, name: team.name, icon: it?.icon || '', iname: (it ? loc(it, 'name') : '') || payload.slot }));
      }
    } else if (type === 'adminRemoveBag') {
      const bag = itemH.normalizeBag(team.bag);
      const i = bag.findIndex((c) => itemH.cellKey(c) === payload.key);
      if (i >= 0) {
        const n = itemH.cellN(bag[i]);
        bag[i] = n > 1 ? itemH.mkCell(payload.key, n - 1) : null;
        const nt = [...st.teams];
        nt[idx] = { ...team, bag };
        set({ teams: nt });
        const it = ITEMS[payload.key];
        get().addLog(tg('log.store.adminRemoveItem', { emoji: team.emoji, name: team.name, icon: it?.icon || '', iname: (it ? loc(it, 'name') : '') || payload.key }));
      }
    }
    if (get().phase === 'game') saveGame(get());
  },

  // --- Événements de terrain (« météo ») : actions exposées ---
  // Déclenche une météo précise (DEV/admin TBI). `forced` saute le préavis.
  triggerWeather: (id, opts = {}) => {
    weatherH.triggerWeather(set, get, id, opts);
    if (get().phase === 'game') saveGame(get());
  },
  // Ferme l'overlay de cérémonie météo (appelé par WeatherOverlay en fin d'anim).
  closeWeatherCeremony: () => set({ weatherCeremony: null }),


  // --- Moteur d'effets composable (objets) : routeurs des interruptions ---
  // Sélecteur de cible générique : route vers le pouvoir (legacy) ou le moteur.
  selectTarget: (i) => {
    const stp = get().showTargetPicker;
    if (stp?.source === 'engine') {
      set({ showTargetPicker: null });
      effectH.resumeQueue(set, get, { targetTeam: i });
      return;
    }
    if (stp?.source === 'surge') {
      // Sur-réduction (Bouclier L7) : recule l'équipe choisie du surplus, puis fin de tour.
      set({ showTargetPicker: null });
      const masteryOn = extOn(get().extensions, 'mastery');
      const board = get().board;
      const nt = [...get().teams];
      const v = nt[i];
      if ((v.totalImmuneTurns ?? 0) > 0) {
        get().addLog(tg('log.pw.immuneBlock', { emoji: v.emoji, name: v.name, power: loc(POWERS.bouclier, 'name') }));
      } else if (v.itemFumigene) {
        nt[i] = { ...v, itemFumigene: false, itemFumigeneTurns: undefined };
        set({ teams: nt });
        get().addLog(tg('log.pw.fumigeneBlock', { emoji: v.emoji, name: v.name, power: loc(POWERS.bouclier, 'name') }));
      } else {
        const rr = applyRecul(v, board, stp.amount, masteryOn);
        nt[i] = { ...v, ...rr.patch };
        const mv = rr.path && rr.path.length > 1 ? [{ teamIndex: i, waypoints: rr.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: rr.forward ? 'forward' : 'back' }] : null;
        set({ teams: nt, movePath: mv });
        get().addLog(rr.forward
          ? tg('log.turn.fortressAdvance', { team: `${v.emoji} ${v.name}`, cases: rr.advance })
          : tg('log.pw.surgePush', { vemoji: v.emoji, vname: v.name, n: rr.applied ?? stp.amount }));
      }
      if (!get().finished) get().nextTurn();
      return;
    }
    powerH.applyOffensivePower(set, get, i);
  },
  cancelTargetPicker: () => {
    const stp = get().showTargetPicker;
    if (stp?.source === 'surge') {
      // Annuler le ciblage du surplus : on passe simplement au tour suivant.
      set({ showTargetPicker: null });
      if (!get().finished) get().nextTurn();
      return;
    }
    if (stp?.source === 'engine') {
      const pa = get().pendingActions;
      const ctx = pa?.ctx || {};
      // Consommable : l'unité a été retirée du sac AVANT la résolution. Annuler le
      // choix de cible doit donc la REMBOURSER (l'objet n'a pas servi) et ABANDONNER
      // la séquence — sinon l'objet est perdu pour rien.
      if (ctx.source === 'item' && ITEMS[ctx.itemKey]) {
        const ti = ctx.sourceTeam ?? get().currentTeam;
        const nt = [...get().teams];
        nt[ti] = itemH.placeItem(nt[ti], ctx.itemKey).team; // restacke l'unité au sac
        set({ teams: nt });
        get().addLog(tg('log.it.useCancelled', { icon: ITEMS[ctx.itemKey].icon, item: locName(ITEMS[ctx.itemKey]) }));
        set({ showTargetPicker: null });
        if (pa) effectH.finishQueue(set, get); // vide la file + reprend le flux normal
        return;
      }
      // Autres sources (événement/piège…) : on saute l'action ciblée et on continue.
      set({ showTargetPicker: null });
      if (pa) {
        set({ pendingActions: { ...pa, queue: pa.queue.slice(1) } });
        effectH.runQueue(set, get);
      }
      return;
    }
    powerH.cancelTargetPicker(set, get);
  },
  // Sélecteur de case (pose de piège)
  selectTile: (nodeId) => {
    if (!get().showTilePicker) return;
    set({ showTilePicker: null });
    effectH.resumeQueue(set, get, { tile: nodeId });
  },
  cancelTilePicker: () => {
    if (!get().showTilePicker) return;
    set({ showTilePicker: null });
    const pa = get().pendingActions;
    if (pa) { set({ pendingActions: { ...pa, queue: pa.queue.slice(1) } }); effectH.runQueue(set, get); }
  },
  // Sélecteur de thème (reroll de question « au choix »)
  selectSubject: (key) => {
    const sp = get().showSubjectPicker;
    if (!sp) return;
    set({ showSubjectPicker: false });
    // Relance opportune : on (re)lance la question avec le thème choisi par le joueur.
    if (sp?.source === 'opportune') { get().askQuestion(key); return; }
    // Sinon : reroll de question piloté par le moteur d'effets (file en attente).
    effectH.resumeQueue(set, get, { subject: key });
  },
  // Inspection d'un piège : ouvre une fiche listant ses effets (un piège peut en
  // cumuler plusieurs). Purement informatif, ne déclenche pas le piège.
  inspectTrapAt: (nodeId) => {
    const node = get().board?.[nodeId];
    if (!node?.trap) return;
    set({ inspectTrap: { nodeId, ...node.trap } });
  },
  closeInspectTrap: () => set({ inspectTrap: null }),

  // Point de contrôle : l'équipe ACTIVE (qui l'a posé) clique dessus pour s'y
  // téléporter quand elle le décide. Consommé selon `checkpointConsumeChance`
  // (0 % = borne réutilisable, 100 % = à usage unique). Refusé en pleine
  // résolution (question/événement/duel/déplacement/file d'effets).
  teleportToCheckpoint: () => {
    const { teams, currentTeam, board } = get();
    const team = teams[currentTeam];
    if (!team?.checkpoint || !board[team.checkpoint]) return;
    if (get().showQuestion || get().showEvent || get().showFight || get().showDuelChoice
      || get().rolling || get().pendingActions || get().awaitingChoice || get().movePath) return;
    const from = team.pos, dest = team.checkpoint;
    if (from === dest) return;
    const chance = team.checkpointConsumeChance ?? 100;
    const consume = chance >= 100 || Math.random() * 100 < chance;
    // Effet visuel de téléportation : portail de DÉPART (le pion est encore sur
    // `from`), puis saut instantané et portail d'ARRIVÉE une fois le pion rendu sur
    // `dest` — la téléportation ne « glisse » pas le long du plateau (pas de movePath).
    soundWarp();
    get().emitVfx('warp', currentTeam);
    get().addLog(tg('log.store.checkpointTeleport', { emoji: team.emoji, name: team.name }));
    setTimeout(() => {
      const cur = get().teams;
      const t2 = cur[currentTeam];
      if (!t2) return;
      const nt = [...cur];
      nt[currentTeam] = { ...t2, pos: dest, ...(consume ? { checkpoint: undefined, checkpointConsumeChance: undefined } : {}) };
      set({ teams: nt, movePath: null });
      // Laisse React repositionner le pion sur la destination avant le 2ᵉ portail.
      setTimeout(() => get().emitVfx('warp', currentTeam), 70);
      if (get().phase === 'game') saveGame(get());
    }, 430);
  },
  // Bouton « changer la question » : exécute le reroll fourni par un objet
  useQuestionReroll: (opt) => {
    const { showQuestion, pendingActions, rerollUsed, teams, currentTeam } = get();
    if (!showQuestion || pendingActions || !opt) return;
    if (opt.fromBag) {
      const bag = itemH.normalizeBag(teams[currentTeam].bag);
      const cell = bag[opt.bagIndex];
      // Consomme UNE unité de la pile (la case se libère à 0).
      bag[opt.bagIndex] = itemH.cellN(cell) > 1 ? itemH.mkCell(itemH.cellKey(cell), itemH.cellN(cell) - 1) : null;
      const nt = [...teams];
      nt[currentTeam] = { ...nt[currentTeam], bag };
      set({ teams: nt });
    } else if (rerollUsed) {
      return; // équipement : un seul reroll par question
    }
    effectH.runEffects(set, get, opt.actions, { source: 'question' });
  },

  // --- Turn management ---
  // Déclenche la victoire si l'équipe `idx` se trouve sur la case d'arrivée.
  // Utile quand une AVANCE (Forteresse/Sur-réduction sur mauvaise réponse, push,
  // duel…) amène un pion à l'arrivée hors du chemin normal handleLanding.
  checkArrival: (idx) => {
    if (get().finished) return false;
    const t = get().teams[idx];
    if (t && get().board[t.pos]?.type === 'arrivee') {
      get().addLog(tg('log.store.finish', { emoji: t.emoji, name: t.name }));
      get().closeForgeService(); // rend l'escrow d'une éventuelle session de forge
      set({ finished: true });
      saveGame(get());
      return true;
    }
    return false;
  },

  nextTurn: () => {
    const { teams, currentTeam, finished, addLog } = get();
    if (finished) return;

    // La boutique ne tourne plus toute seule : son stock se renouvelle à l'achat
    // (un objet acheté est remplacé aussitôt — cf. buyItem/pickReplacement).

    const newCurrent = (currentTeam + 1) % teams.length;
    // Buffs à durée (tours) : on décrémente quand l'équipe REGAGNE la main ;
    // expiration à 0. (Fumigène posé avec une durée X ; autres buffs à venir.)
    let nt = get().teams;
    // Silence/Taxe (Sablier) : consommés à la fin du tour de l'équipe visée.
    const og = nt[currentTeam];
    if (og && (og.silencedNextTurn || og.timeoutPenalty || og.forgeAegis != null || og.forgeGoldMult != null || og.forgeButin != null || og.forgeStreakGuard || og.forgeIndice != null || og.forgeRepit != null || og.forgeFreshQ || og.clairvoyanceTurn)) {
      nt = [...nt];
      // Flags « ce tour » (faces Forge + Clairvoyance) : nettoyés quand l'équipe rend la main.
      nt[currentTeam] = { ...og, silencedNextTurn: false, timeoutPenalty: undefined, forgeAegis: undefined, forgeGoldMult: undefined, forgeButin: undefined, forgeStreakGuard: undefined, forgeIndice: undefined, forgeRepit: undefined, forgeFreshQ: undefined, clairvoyanceTurn: undefined };
    }
    const ct = nt[newCurrent];
    if (ct?.itemFumigeneTurns > 0) {
      const left = ct.itemFumigeneTurns - 1;
      nt = [...nt];
      nt[newCurrent] = left > 0
        ? { ...ct, itemFumigeneTurns: left }
        : { ...ct, itemFumigene: false, itemFumigeneTurns: undefined };
      if (left <= 0) addLog(tg('log.store.fumigene', { emoji: ct.emoji, name: ct.name }));
    }

    // Immunité totale (Bouclier L10) : 1 tour de moins quand l'équipe REGAGNE la main.
    const ci = nt[newCurrent];
    if (ci?.totalImmuneTurns > 0) {
      const left = ci.totalImmuneTurns - 1;
      if (nt === get().teams) nt = [...nt];
      nt[newCurrent] = left > 0 ? { ...ci, totalImmuneTurns: left } : { ...ci, totalImmuneTurns: undefined };
    }

    // Intérêts (passif/buff) : l'équipe qui reprend la main gagne un % de son or.
    const cInt = nt[newCurrent];
    if (cInt) {
      const rate = interestPct(cInt);
      const gain = rate > 0 ? Math.floor(((cInt.money || 0) * rate) / 100) : 0;
      if (gain > 0) {
        if (nt === get().teams) nt = [...nt];
        nt[newCurrent] = { ...nt[newCurrent], money: (nt[newCurrent].money || 0) + gain };
        addLog(tg('log.store.interest', { emoji: cInt.emoji, name: cInt.name, n: gain }));
      }
    }

    // DoT « saignement d'or » (bleedGold) : à chaque fois que la victime REGAGNE
    // la main, on lui retire (mode 'lose') ou on lui vole (mode 'steal', au profit
    // de `from`) un montant (dé/échelle). Exécuté AVANT la décrémentation des buffs
    // (un buff de 3 tours frappe donc 3 fois). Respecte l'immunité au vol d'or.
    const cdot = nt[newCurrent];
    if (cdot?.buffs?.some((b) => b.type === 'bleedGold')) {
      if (nt === get().teams) nt = [...nt];
      let victim = { ...cdot };
      for (const b of cdot.buffs) {
        if (b.type !== 'bleedGold') continue;
        if (isGoldStealImmune(victim)) { addLog(tg('log.store.bleedImmune', { emoji: victim.emoji, name: victim.name })); continue; }
        const amt = Math.min(resolveAmount(b.n, victim), victim.money ?? 0);
        if (amt <= 0) continue;
        victim = { ...victim, money: (victim.money ?? 0) - amt };
        if (b.mode === 'steal' && b.from != null && b.from !== newCurrent && nt[b.from]) {
          nt[b.from] = { ...nt[b.from], money: (nt[b.from].money ?? 0) + amt };
          addLog(tgPlural('log.store.bleedSteal', amt, { emoji: victim.emoji, name: victim.name, n: amt, aemoji: nt[b.from].emoji, aname: nt[b.from].name }));
        } else {
          addLog(tgPlural('log.store.bleedLose', amt, { emoji: victim.emoji, name: victim.name, n: amt }));
        }
      }
      nt[newCurrent] = victim;
    }

    // Orage persistant (Foudre ultime) : au DÉBUT du tour de la cible, elle recule
    // d'un dé (réduit par l'équipement, PAS par le Bouclier — §9). Non cumulable :
    // le compteur décroît, expire à 0.
    const cor = nt[newCurrent];
    if (cor?.orageRecul?.turns > 0) {
      if (nt === get().teams) nt = [...nt];
      const die = cor.orageRecul.die || 'd4';
      const amt = reducedRecul(cor, resolveAmount(die, cor));
      const rr = moveBack(get().board, cor.pos, amt);
      const left = cor.orageRecul.turns - 1;
      nt[newCurrent] = { ...cor, pos: rr.finalPos, orageRecul: left > 0 ? { ...cor.orageRecul, turns: left } : undefined };
      addLog(tgPlural('log.store.orage', amt, { emoji: cor.emoji, name: cor.name, n: amt }));
    }

    // Report (Double ultime) : les questions imposées non répondues (reportées au
    // tour précédent) s'appliquent maintenant que l'équipe regagne la main.
    const crep = nt[newCurrent];
    if (crep?.doubleReportPending > 0) {
      if (nt === get().teams) nt = [...nt];
      const extra = Math.min(crep.doubleReportPending, 4);
      nt[newCurrent] = { ...crep, doubleActive: true, doubleExtra: extra, doubleNoBonus: true, doubleReportPending: undefined };
      addLog(tg('log.store.doubleReported', { emoji: crep.emoji, name: crep.name, n: extra }));
    }

    // Buffs temporisés (effets de durée des consommables) : 1 tour de moins quand
    // l'équipe REGAGNE la main ; expiration à 0.
    const cb = nt[newCurrent];
    if (cb?.buffs?.length) {
      const buffs = cb.buffs.map((b) => ({ ...b, turns: (b.turns ?? 1) - 1 })).filter((b) => b.turns > 0);
      if (nt === get().teams) nt = [...nt];
      nt[newCurrent] = { ...cb, buffs };
      if (buffs.length < cb.buffs.length) addLog(tg('log.store.buffExpired', { emoji: cb.emoji, name: cb.name }));
    }

    // Blocage des POUVOIRS : 1 tour de moins quand l'équipe regagne la main.
    const cbp = nt[newCurrent];
    if (cbp?.powersBlockedTurns > 0) {
      const left = cbp.powersBlockedTurns - 1;
      if (nt === get().teams) nt = [...nt];
      nt[newCurrent] = left > 0 ? { ...cbp, powersBlockedTurns: left } : { ...cbp, powersBlockedTurns: undefined };
      if (left <= 0) addLog(tg('log.store.powersUnblocked', { emoji: cbp.emoji, name: cbp.name }));
    }

    // Blocage des CONSOMMABLES : 1 tour de moins quand l'équipe regagne la main.
    const cbc = nt[newCurrent];
    if (cbc?.consumablesBlockedTurns > 0) {
      const left = cbc.consumablesBlockedTurns - 1;
      if (nt === get().teams) nt = [...nt];
      nt[newCurrent] = left > 0 ? { ...cbc, consumablesBlockedTurns: left } : { ...cbc, consumablesBlockedTurns: undefined };
      if (left <= 0) addLog(tg('log.store.consumablesUnblocked', { emoji: cbc.emoji, name: cbc.name }));
    }

    // Blocage des ACHATS (Pluie maudite) : 1 tour de moins quand l'équipe regagne la main.
    const cbs = nt[newCurrent];
    if (cbs?.shopBlockedTurns > 0) {
      const left = cbs.shopBlockedTurns - 1;
      if (nt === get().teams) nt = [...nt];
      nt[newCurrent] = left > 0 ? { ...cbs, shopBlockedTurns: left } : { ...cbs, shopBlockedTurns: undefined };
      if (left <= 0) addLog(tg('log.weather.shopUnblocked', { emoji: cbs.emoji, name: cbs.name }));
    }

    // « Hacking » (événement mode téléphone) : la cinématique « app piratée »
    // est VISIBLE en continu dès le déclenchement (tant que hackedTurns > 0, cf.
    // BottomBar/MobileApp). Quand l'équipe piratée REGAGNE la main, c'est la
    // RÉSOLUTION : on marque hackOverlay (verrou du dé + minuterie de fin dans
    // BottomBar → endHackedTurn) ; le compteur est consommé à ce moment-là.
    let hackOverlay = null;
    const chk = nt[newCurrent];
    if (chk?.hackedTurns > 0) {
      hackOverlay = { teamIndex: newCurrent, emoji: chk.emoji, name: chk.name, color: chk.color };
      addLog(tg('log.store.hackLock', { emoji: chk.emoji, name: chk.name }));
    }

    // Pactes & coalitions (« Complots ») : 1 tour de moins quand l'équipe REGAGNE
    // la main, comme les buffs. Expiration discrète (engagements secrets).
    const cp = nt[newCurrent];
    if (cp?.promises?.length || cp?.coalitions?.length) {
      if (nt === get().teams) nt = [...nt];
      let np = cp;
      if (cp.promises?.length) {
        const { promises, expired } = tickPromises(cp.promises);
        np = { ...np, promises };
        if (expired > 0) addLog(tg('log.store.pactExpired', { emoji: cp.emoji, name: cp.name }));
      }
      if (cp.coalitions?.length) {
        const { coalitions } = tickCoalitions(cp.coalitions); // expiration silencieuse (secret)
        np = { ...np, coalitions };
      }
      nt[newCurrent] = np;
    }

    // Compteur du prompt boutique : +1 quand l'équipe REGAGNE la main.
    const reTeam = nt[newCurrent];
    const sinceShop = (reTeam?.turnsSinceShop ?? 0) + 1;
    if (nt === get().teams) nt = [...nt];
    nt[newCurrent] = { ...reTeam, turnsSinceShop: sinceShop };

    // Élan du retardataire (Relance L10) : en début de tour, si l'équipe est la
    // MOINS avancée (ou ex æquo au dernier rang), elle gagne 1 charge de relance.
    if (extOn(get().extensions, 'mastery')) {
      const lt = nt[newCurrent];
      const rl = lt?.powers?.relance;
      const eff = rl ? resolvePowerEffect(lt, 'relance', true) : null;
      if (eff?.lateStarterCharge) {
        const board = get().board;
        const xOf = (t) => (t?.pos && board[t.pos] ? board[t.pos].x : Infinity);
        const myX = xOf(lt);
        const isLast = nt.every((t, i) => i === newCurrent || xOf(t) >= myX);
        const soloLeader = nt.length > 1 && nt.every((t, i) => i === newCurrent || xOf(t) < myX);
        if (isLast && !soloLeader && rl.charges < MAX_CHARGES) {
          nt[newCurrent] = { ...lt, powers: { ...lt.powers, relance: { ...rl, charges: addCharge(rl.charges) } } };
          addLog(tg('log.pw.relanceLate', { emoji: lt.emoji, name: lt.name }));
        }
      }
    }

    // Proposer « Visiter la boutique ? » si l'équipe ne l'a pas vue depuis assez
    // de tours ET peut s'offrir au moins un objet de l'arrivage.
    let showShopPrompt = false;
    if (get().itemsEnabled()) {
      const cheapest = itemH.cheapestStockPrice(get().shopStock);
      if (sinceShop >= (LOOT.shopPromptDelay ?? 3) && (reTeam?.money ?? 0) >= cheapest) {
        showShopPrompt = true;
      }
    }

    set({ currentTeam: newCurrent, teams: nt, ...TURN_RESET, showShopPrompt: hackOverlay ? false : showShopPrompt, hackOverlay, turnCount: (get().turnCount || 0) + 1 });
    if (!hackOverlay) {
      get().triggerStarterChest(); // coffre de départ au 1er tour de cette équipe
      // Choix de métier au 1er tour : si pas de coffre, on l'enchaîne directement
      // (sinon il s'ouvre à la fermeture du coffre, cf. closeStarterChest).
      if (!get().showStarterChest) get().triggerMetierPicker();
    }
    // Événements de terrain (« météo ») : tirage périodique « entre deux tours »
    // (aucune question/événement ouvert ici). No-op si l'extension est coupée.
    weatherH.maybeDrawWeather(set, get);
    if (get().phase === 'game') saveGame(get());
  },

  // --- Resume saved game ---
  resumeGame: () => {
    const saved = loadGame();
    if (!saved) return;
    set({
      ...saved,
      devSandbox: false,
      rolling: false,
      ...TURN_RESET,
      movePath: null,
      showQuestion: null, showEvent: null, showFight: null, showDiceModal: false, eventApplied: false, lootReveal: null,
      showStarterChest: false, lastStarterReward: null, hackOverlay: null,
      // Météo : l'overlay transitoire ne survit pas à un reload (l'état ambiant
      // et le préavis, eux, sont persistés et restaurés via ...saved).
      weatherCeremony: null,
    });
    // Prestation de forgeage : absente des vieilles saves → null. Si présente (reload
    // en pleine session), elle est restaurée via ...saved (escrow préservé).
    if (saved.forgeService === undefined) set({ forgeService: null });
    // Météo : champs absents des vieilles sauvegardes → défauts.
    if (saved.weather === undefined) set({ weather: null });
    if (saved.weatherNotice === undefined) set({ weatherNotice: null });
    if (saved.turnCount == null) set({ turnCount: 0 });
    if (saved.lastWeatherTurn == null) set({ lastWeatherTurn: 0 });
    // Coffre de départ : config absente (vieilles saves) → défaut ; or non résolu
    // (saves antérieures à la config) → on le résout depuis la config.
    if (saved.starterChestConfig == null) set({ starterChestConfig: defaultStarterChestConfig() });
    if (saved.starterGold == null) set({ starterGold: resolveStarterGold(get().starterChestConfig) });
    // Coffre de départ : si l'équipe courante ne l'a pas encore ouvert, le reproposer.
    // Sinon (coffre déjà pris/désactivé), reproposer un éventuel choix de métier.
    if (get().phase === 'game') {
      get().triggerStarterChest();
      if (!get().showStarterChest) get().triggerMetierPicker();
    }
    // Sauvegardes anterieures au systeme d'objets : le CHAMP est absent.
    // Un tableau vide est un etat legitime (tout decoche au setup / etal vide)
    // et doit etre respecte — d'ou le test sur la presence, pas sur la longueur.
    if (!Array.isArray(saved.enabledItems)) set({ enabledItems: Object.keys(ITEMS) });
    // knownItemKeys : sans lui, des objets décochés réapparaîtraient cochés (la
    // garde "objet jamais vu" se baserait sur le catalogue courant). Anciennes
    // sauvegardes sans ce champ : on retombe sur le catalogue connu actuel.
    if (!Array.isArray(saved.knownItemKeys)) set({ knownItemKeys: Object.keys(ITEMS) });
    if (!Array.isArray(saved.knownEventKeys)) set({ knownEventKeys: Object.keys(EVENTS) });
    // Le catalogue ITEMS est dynamique (édité via l'éditeur) : purger des équipes
    // les clés d'objets qui n'existent plus, sinon un slot reste occupé par un
    // « fantôme » (objet invisible, effet perdu, slot bloqué). Le sac est filtré
    // par normalizeBag ; on protège de même l'équipement.
    const resumedTeams = get().teams;
    if (Array.isArray(resumedTeams) && resumedTeams.length) {
      set({
        teams: resumedTeams.map((t) => {
          const eq = t.equipment || { head: null, body: null, feet: null };
          const cleaned = {};
          for (const slot of ['head', 'body', 'feet']) { const k = itemH.cellKey(eq[slot]); cleaned[slot] = (k && ITEMS[k]) ? eq[slot] : null; } // garde l'instance enchantée
          return { ...t, equipment: cleaned, bag: itemH.normalizeBag(t.bag) };
        }),
      });
    }
    // Sauvegardes sans decor OU a un ANCIEN format : regenerer. Le format
    // actuel (phase 3) n'a plus de champ `layer` et peut contenir des
    // bannieres/palmiers/buissons/rochers/fanions — on detecte donc l'ancien
    // format par la presence du champ `layer` ou d'assets retires (pont/plage/
    // clairiere/disc), PAS par "ne commence pas par prop-".
    const dec = get().boardDecor;
    const oldFormat = !dec?.length
      || dec.some((d) => ('layer' in d) || /^(pont|plage|bridge|clairiere|disc)-/.test(d.img || ''));
    // (le décor procédural ne concerne que le mode legacy — une save « espace »
    // porte boardSpace et n'a pas de decor à régénérer)
    if (get().board && oldFormat && !get().boardSpace) {
      set({ boardDecor: generateDecor(get().board) });
    }
    // Saves antérieures au mode espace : champ absent → legacy explicite.
    if (saved.boardSpace === undefined) set({ boardSpace: null });
    // Extensions : une save porte son propre jeu d'extensions. Sauvegardes
    // antérieures (champ absent) → tout activé (comportement historique).
    if (saved.extensions == null) set({ extensions: defaultExtensions() });
    // `level` est désormais un tableau : normalise les sauvegardes au format chaîne.
    if (!Array.isArray(saved.level)) set({ level: [saved.level || 'cycle4'] });
    // Migration : ancien stock (rotatif, 4 objets) → nouvelle vitrine 8+8. On
    // régénère si le stock est absent ou trop petit pour le nouveau format.
    if (get().itemsEnabled()
        && (!Array.isArray(saved.shopStock) || saved.shopStock.length < itemH.SHOP_CONSUMABLE_SLOTS)) {
      set({ shopStock: itemH.generateShopStock(get().enabledItems, get().shopFamilies()), shopStockTurns: 0 });
    }
  },

  // --- Reset ---
  reset: () => {
    // En bac a sable dev, ne pas effacer la sauvegarde de la vraie partie
    if (!get().devSandbox) clearSave();
    set({
      devSandbox: false,
      phase: 'setup', teams: [], currentTeam: 0, board: null, boardDecor: null, boardSpace: null, finished: false,
      askedQuestions: {}, questions: {}, log: [],
      shopStock: [], shopStockTurns: 0,
      starterChestConfig: defaultStarterChestConfig(), starterGold: null,
      rolling: false, ...TURN_RESET, movePath: null,
      showQuestion: null, showEvent: null, showFight: null, showDiceModal: false, eventApplied: false, lootReveal: null,
      hackOverlay: null,
      weather: null, weatherNotice: null, weatherCeremony: null, turnCount: 0, lastWeatherTurn: 0,
      nbTeams: 3, setupTeams: createDefaultTeams(3),
      extensions: defaultExtensions(),
      enabledEvents: Object.keys(EVENTS),
      enabledItems: Object.keys(ITEMS),
      boardParams: {
        casesParVoie: 4, nbVoies: 3, nbSections: 3,
        voieFinale: 'court-long', couloirsMix: 2, eventEveryX: 3,
      },
    });
  },
}));

// Accès au store depuis la console en développement (debug / tests manuels)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__store = useGameStore;
  window.__ITEMS = ITEMS;
  window.__effectH = effectH;
}
