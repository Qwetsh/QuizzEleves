// ============================================================
//  ÉVÉNEMENTS DE TERRAIN (« météo ») — résolution (extension `weather`).
//
//  Une météo GLOBALE s'abat sur tout le plateau tous les 3–5 tours (cadence
//  calibrée dans balanceConfig.WEATHER). Une seule active à la fois. La
//  résolution réutilise au maximum les briques existantes (applyRecul pour le
//  recul avec bouclier, addCharge pour la recharge, le moteur d'effets pour le
//  reste). Appelé depuis gameStore (nextTurn → maybeDrawWeather, admin/DEV →
//  triggerWeather).
//
//  Phases : 1 = vent/soleil/orage/pluie acide (ici). 2 = séisme. 3 = pluie
//  maudite. Les résolveurs des phases 2/3 sont des points d'extension marqués.
// ============================================================
import { WEATHERS, weatherName, weatherIcon } from '../data/weather.js';
import { WEATHER } from '../logic/balanceConfig.js';
import { extOn } from '../extensions/registry.js';
import { addCharge, MAX_CHARGES } from '../data/powers.js';
import { applyRecul } from '../logic/turnHelpers.js';
import { buildPredecessors } from '../logic/pathfinding.js';
import { resolveAmount } from '../logic/itemEffects.js';
import * as effectH from './effectEngine.js';
import { tg } from '../i18n';
import { getLang } from '../i18n/lang.js';

// Espacement horizontal d'une case (boardGenerator SX) — sert à exprimer le
// déplacement NET d'un pion après le séisme en « cases » dans le journal.
const SX = 130;

// Météos réellement câblées pour le TIRAGE AUTOMATIQUE. La pluie maudite (Phase 3)
// est forçable en admin mais pas encore auto-tirée.
const AUTO_IMPLEMENTED = new Set(['ventContraire', 'ventArriere', 'soleil', 'orage', 'pluieAcide', 'seisme', 'pluieMaudite']);

// Préavis effectif d'une météo : override balanceConfig sinon défaut du catalogue.
function usesPreavis(id) {
  const ov = WEATHER.preavis?.[id];
  return ov != null ? !!ov : !!WEATHERS[id]?.preavis;
}

// Facteur de déplacement de la météo ambiante en cours (vent). 1 si aucune.
// Lu au calcul FINAL du déplacement (après dé/Relance) dans handleDiceResult.
export function weatherMoveFactor(get) {
  const w = get().weather;
  return (w && w.nature === 'ambient' && w.factor) ? w.factor : 1;
}

// Tirage pondéré par rareté parmi les météos auto-implémentées de poids > 0.
function pickWeather() {
  const weights = WEATHER.weights || {};
  const pool = Object.entries(weights)
    .filter(([id, w]) => WEATHERS[id] && AUTO_IMPLEMENTED.has(id) && w > 0);
  const total = pool.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const [id, w] of pool) { r -= w; if (r < 0) return id; }
  return pool[pool.length - 1][0];
}

// Point d'accroche périodique (fin de nextTurn, « entre deux tours »). Gère, dans
// l'ordre : (1) résolution d'un préavis arrivé à échéance ; (2) décompte d'une
// météo ambiante ; (3) tirage d'une nouvelle météo si la cadence le permet.
export function maybeDrawWeather(set, get) {
  if (!extOn(get().extensions, 'weather')) return;
  const st = get();
  // Jamais par-dessus un autre overlay / une résolution en cours.
  if (st.finished || st.hackOverlay || st.showStarterChest || st.weatherCeremony) return;

  // (1) Un préavis posé au tour précédent → la météo annoncée se résout MAINTENANT.
  if (st.weatherNotice) {
    const id = st.weatherNotice.id;
    set({ weatherNotice: null });
    resolveWeather(set, get, id);
    set({ lastWeatherTurn: get().turnCount });
    return;
  }

  // (2) Météo ambiante en cours (vent) → 1 tour de moins ; pas de nouveau tirage.
  if (st.weather && st.weather.nature === 'ambient') {
    const left = (st.weather.turnsLeft ?? 1) - 1;
    if (left > 0) set({ weather: { ...st.weather, turnsLeft: left } });
    else { set({ weather: null }); get().addLog(tg('log.weather.ventEnd')); }
    return;
  }

  // (3) Cadence : cooldown (≥ min tours d'écart) puis probabilité montant à 1 au max.
  const cad = WEATHER.cadence || { min: 3, max: 5 };
  const min = cad.min ?? 3, max = cad.max ?? 5;
  const gap = (get().turnCount || 0) - (st.lastWeatherTurn || 0);
  if (gap < min) return;
  const span = Math.max(1, max - min);
  const prob = (gap - min + 1) / (span + 1); // = 1 au tour `max` → tirage garanti
  if (Math.random() >= prob) return;

  const id = pickWeather();
  if (id) triggerWeather(set, get, id, {});
}

// Déclenche une météo précise. `forced` (admin/DEV) = résolution immédiate, sans
// préavis (spectacle). Sinon, une météo punitive s'annonce 1 tour à l'avance.
export function triggerWeather(set, get, id, { forced = false } = {}) {
  const w = WEATHERS[id];
  if (!w) return;
  if (!forced && usesPreavis(id)) {
    set({ weatherNotice: { id } });
    get().addLog(tg('log.weather.announce', { icon: w.icon, name: weatherName(id, getLang()) }));
    return;
  }
  resolveWeather(set, get, id);
  set({ lastWeatherTurn: get().turnCount, weatherNotice: null });
}

// Applique les effets d'une météo + arme l'overlay (cérémonie auto-fermée par
// WeatherOverlay). Le dispatch est piloté par `special` (catalogue).
export function resolveWeather(set, get, id) {
  const w = WEATHERS[id];
  if (!w) return;
  set({ weatherCeremony: { id, icon: w.icon, nature: w.nature, special: w.special, tone: w.tone, dir: w.dir || null } });
  switch (w.special) {
    case 'vent': return resolveVent(set, get, id, w);
    case 'soleil': return resolveSoleil(set, get);
    case 'orage': return resolveOrage(set, get);
    case 'pluieAcide': return resolvePluieAcide(set, get);
    case 'seisme': return resolveSeisme(set, get);            // Phase 2
    case 'pluieMaudite': return resolvePluieMaudite(set, get); // Phase 3
    default: return undefined;
  }
}

// --- Vent (ambiante) : pose un facteur ×/÷ lu au déplacement, pour N tours. ---
function resolveVent(set, get, id, w) {
  const dur = WEATHER.durations?.[id] ?? 2;
  const factor = w.dir === 'contraire'
    ? (WEATHER.vent?.contraireFactor ?? 0.5)
    : (WEATHER.vent?.arriereFactor ?? 2);
  set({ weather: { id, nature: 'ambient', turnsLeft: dur, factor } });
  const label = w.dir === 'contraire' ? `÷${+(1 / factor).toFixed(2)}` : `×${+factor.toFixed(2)}`;
  get().addLog(tg('log.weather.vent', { icon: w.icon, name: weatherName(id, getLang()), factor: label, n: dur }));
}

// --- Soleil (ponctuelle) : chaque équipe recharge un pouvoir (plafond MAX_CHARGES). ---
function resolveSoleil(set, get) {
  const n = WEATHER.soleil?.charge ?? 1;
  const teams = get().teams;
  const detail = [];
  const nt = teams.map((t) => {
    const powers = t.powers || {};
    // Pouvoir le plus « en manque » (charges les plus basses) parmi ceux possédés.
    const keys = Object.keys(powers).filter((k) => powers[k]);
    if (!keys.length) { detail.push({ label: `${t.emoji} ${t.name}`, note: tg('log.weather.note.unaffected') }); return t; }
    keys.sort((a, b) => (powers[a].charges ?? 0) - (powers[b].charges ?? 0));
    const pk = keys[0];
    const cur = powers[pk].charges ?? 0;
    if (cur >= MAX_CHARGES) { detail.push({ label: `${t.emoji} ${t.name}`, note: tg('log.weather.note.unaffected') }); return t; }
    let charges = cur;
    for (let i = 0; i < n; i++) charges = addCharge(charges);
    detail.push({ label: `${t.emoji} ${t.name}`, amount: charges - cur, note: tg('log.weather.note.recharge') });
    return { ...t, powers: { ...powers, [pk]: { ...powers[pk], charges } } };
  });
  set({ teams: nt });
  get().addLog({ text: tg('log.weather.soleil'), detail });
}

// --- Orage (ponctuelle) : ~tileRatio des cases frappées ; les équipes présentes
//     reculent d'un dé (recul avec bouclier via applyRecul). ---
function resolveOrage(set, get) {
  const board = get().board;
  const die = WEATHER.orage?.die ?? 'd10';
  const ratio = Math.max(0, Math.min(1, WEATHER.orage?.tileRatio ?? 0.2));
  const masteryOn = extOn(get().extensions, 'mastery');
  // Cases « frappables » = cases de matière/événement (on épargne départ/jonctions/arrivée).
  const strikeable = Object.keys(board).filter((id) => ['subject', 'event'].includes(board[id]?.type));
  const struck = new Set(strikeable.filter(() => Math.random() < ratio));

  const teams = get().teams;
  const detail = [];
  const moves = [];
  const strikes = []; // index des équipes RÉELLEMENT touchées → foudre ciblée sur leur pion
  const nt = teams.map((t, i) => {
    if (!struck.has(t.pos)) { detail.push({ label: `${t.emoji} ${t.name}`, note: tg('log.weather.note.unaffected') }); return t; }
    strikes.push(i);
    const base = resolveAmount(die, t);
    const r = applyRecul(t, board, base, masteryOn);
    if (r.path?.length) moves.push({ teamIndex: i, waypoints: r.path.map((id) => ({ x: board[id].x, y: board[id].y })), type: 'back' });
    detail.push({ label: `${t.emoji} ${t.name}`, amount: -(r.applied || 0), note: tg('log.weather.note.recul') });
    return { ...t, ...r.patch };
  });
  // La cérémonie d'orage porte la liste des pions frappés : l'overlay y fait
  // tomber de vrais éclairs (LightningStrike-like) pour montrer qui est touché.
  set({ teams: nt, ...(moves.length ? { movePath: moves } : {}), weatherCeremony: { ...get().weatherCeremony, strikes } });
  get().addLog({ text: tg('log.weather.orage'), detail });
}

// --- Pluie acide (ponctuelle) : chaque équipe perd un équipement (au hasard) ;
//     sinon, bascule sur une perte d'or (action déjà existante côté moteur). ---
function resolvePluieAcide(set, get) {
  const gold = WEATHER.pluieAcide?.gold ?? 15;
  const SLOTS = ['head', 'body', 'feet'];
  const teams = get().teams;
  const detail = [];
  const nt = teams.map((t) => {
    const worn = SLOTS.filter((s) => t.equipment?.[s]);
    if (worn.length) {
      const slot = worn[Math.floor(Math.random() * worn.length)];
      detail.push({ label: `${t.emoji} ${t.name}`, note: tg('log.weather.note.lostEquip') });
      return { ...t, equipment: { ...t.equipment, [slot]: null } };
    }
    const lost = Math.min(gold, t.money ?? 0);
    detail.push({ label: `${t.emoji} ${t.name}`, amount: -lost, note: tg('log.weather.note.lostGold') });
    return { ...t, money: (t.money ?? 0) - lost };
  });
  set({ teams: nt });
  get().addLog({ text: tg('log.weather.pluieAcide'), detail });
}

// --- Séisme (Phase 2) : à chaque tick, chaque pion fait 1 déplacement dans une
//     direction TIRÉE AU HASARD parmi les valides (avancer/reculer/voie↑/voie↓).
//     Borné avant l'arrivée (ne peut pas faire gagner) ; jonction → voie au
//     hasard ; directions impossibles exclues. Tous les pions s'animent en même
//     temps, tick par tick, via movePath (chaque waypoint = une secousse). ---

// Voies parallèles d'une case de voie `s{S}_{subj}_{C}` = mêmes S et C, subj ≠.
// Renvoie l'id de la voie adjacente (haut = y plus petit / bas = y plus grand)
// la plus proche, ou null (couloirs/jonctions/départ/arrivée n'en ont pas).
function laneNeighbor(board, pos, dir) {
  const node = board[pos];
  const m = pos.match(/^s(\d+)_(.+)_(\d+)$/);
  if (!node || !m) return null;
  const [, s, , c] = m;
  let best = null;
  for (const id of Object.keys(board)) {
    if (id === pos) continue;
    const mm = id.match(/^s(\d+)_(.+)_(\d+)$/);
    if (!mm || mm[1] !== s || mm[3] !== c) continue;
    const y = board[id].y;
    if (dir === 'up' && y < node.y && (!best || y > board[best].y)) best = id;
    if (dir === 'down' && y > node.y && (!best || y < board[best].y)) best = id;
  }
  return best;
}

// Directions valides depuis `pos` (cible déjà résolue). Avancer exclut l'arrivée
// (bornage) et choisit une branche au hasard à une jonction.
function quakeDirs(board, preds, pos) {
  const node = board[pos];
  const out = [];
  const fwd = (node.next || []).filter((n) => board[n] && board[n].type !== 'arrivee');
  if (fwd.length) out.push(fwd[Math.floor(Math.random() * fwd.length)]);
  const bk = preds[pos];
  if (bk && bk.length) out.push(bk[0]);
  const up = laneNeighbor(board, pos, 'up');
  if (up) out.push(up);
  const down = laneNeighbor(board, pos, 'down');
  if (down) out.push(down);
  return out;
}

function resolveSeisme(set, get) {
  const board = get().board;
  const ticks = WEATHER.seisme?.ticks ?? 6;
  const preds = buildPredecessors(board);
  const teams = get().teams;
  const detail = [];
  const moves = [];
  const nt = teams.map((t, i) => {
    if (!t.pos || !board[t.pos]) return t;
    const startX = board[t.pos].x;
    const wp = [{ x: board[t.pos].x, y: board[t.pos].y }];
    let pos = t.pos;
    for (let k = 0; k < ticks; k++) {
      const dirs = quakeDirs(board, preds, pos);
      if (dirs.length) pos = dirs[Math.floor(Math.random() * dirs.length)];
      wp.push({ x: board[pos].x, y: board[pos].y }); // un waypoint par tick (secousse visible)
    }
    if (pos === t.pos) { detail.push({ label: `${t.emoji} ${t.name}`, note: tg('log.weather.note.shaken') }); return t; }
    moves.push({ teamIndex: i, waypoints: wp, type: 'forward' });
    const net = Math.round((board[pos].x - startX) / SX); // avancée NETTE en cases (lisible)
    detail.push({ label: `${t.emoji} ${t.name}`, ...(net !== 0 ? { amount: net } : {}), note: tg('log.weather.note.shaken') });
    return { ...t, pos };
  });
  set({ teams: nt, ...(moves.length ? { movePath: moves } : {}) });
  get().addLog({ text: tg('log.weather.seisme'), detail });
}

// --- Pluie maudite (Phase 3) : tire UNE malédiction au hasard dans un pool
//     configurable et l'applique à TOUTES les équipes. La plupart réutilisent
//     les actions du moteur (target:'all') ; quelques-unes sont gérées ici
//     (or par dé propre à chaque équipe, blocage d'achat, sablier+mélange). ---
function pickCurse() {
  const pool = WEATHER.pluieMaudite?.pool || {};
  const entries = Object.entries(pool).filter(([, c]) => c && c.weight > 0);
  const total = entries.reduce((s, [, c]) => s + c.weight, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const e of entries) { r -= e[1].weight; if (r < 0) return e; }
  return entries[entries.length - 1];
}

function resolvePluieMaudite(set, get) {
  get().addLog(tg('log.weather.pluieMaudite'));
  const picked = pickCurse();
  if (!picked) return;
  const [id, cfg] = picked;
  const all = (action) => effectH.runEffects(set, get, [{ ...action, target: 'all' }], { source: 'weather' });
  switch (id) {
    case 'blockPowers': return all({ action: 'blockPowers', turns: cfg.turns ?? 1, n: cfg.turns ?? 1 });
    case 'blockConsumables': return all({ action: 'blockConsumables', turns: cfg.turns ?? 1, n: cfg.turns ?? 1 });
    case 'forceHardcore': return all({ action: 'forceSubject', subject: 'hardcore' });
    case 'loseItem': return all({ action: 'loseItem', fallbackGold: cfg.fallbackGold });
    case 'loseGold': return curseLoseGoldAll(set, get, cfg);
    case 'blockShop': return curseBlockShopAll(set, get, cfg);
    case 'curseTimer': return curseTimerAll(set, get, cfg);
    default: return undefined;
  }
}

// Perte d'or : chaque équipe lance SON propre dé (différent pour chacun).
function curseLoseGoldAll(set, get, cfg) {
  const die = cfg.die ?? 'd10';
  const detail = [];
  const nt = get().teams.map((t) => {
    const lost = Math.min(resolveAmount(die, t), t.money ?? 0);
    detail.push({ label: `${t.emoji} ${t.name}`, amount: -lost, note: tg('log.weather.note.lostGold') });
    return { ...t, money: (t.money ?? 0) - lost };
  });
  set({ teams: nt });
  get().addLog({ text: tg('log.weather.curse.loseGold'), detail });
}

// Blocage d'achat (nouveau flag `shopBlockedTurns`) sur toutes les équipes.
function curseBlockShopAll(set, get, cfg) {
  const turns = cfg.turns ?? 1;
  const nt = get().teams.map((t) => ({ ...t, shopBlockedTurns: turns }));
  set({ teams: nt });
  get().addLog(tg('log.weather.curse.blockShop'));
}

// Sablier (timer divisé) + Modeleur (réponses qui changent de place toutes les N s)
// sur toutes les équipes, pour leur PROCHAINE question. Réutilise les flags
// existants `sablierActif`/`sablierDivisor` et `modeleurInterval`.
function curseTimerAll(set, get, cfg) {
  const div = cfg.divisor ?? 2;
  const interval = cfg.interval ?? 2;
  const nt = get().teams.map((t) => ({ ...t, sablierActif: true, sablierDivisor: div, modeleurInterval: interval }));
  set({ teams: nt });
  get().addLog(tg('log.weather.curse.timer'));
}
