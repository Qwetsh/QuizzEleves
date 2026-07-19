// P1 du duel Pokémon (DESIGN_POKEMON.md) : génère src/data/pokemonBattle.json
// — les 151 Pokémon de la Gén. 1 avec stats, types, sprites animés, cris et un
// MOVESET CURÉ de 4 capacités (2 offensives + 2 statuts) tiré du VRAI learnset
// Rouge/Bleu (PokéAPI, version_group 'red-blue').
//
// Curation des capacités :
//   - offensive 1 : la meilleure attaque STAB (score puissance × précision) ;
//   - offensive 2 : la meilleure attaque d'un AUTRE type (couverture) ;
//   - statuts : 2 capacités de la liste blanche SUPPORTÉE par le moteur v1
//     (boosts/malus de stats ±, paralysie/poison/sommeil), priorité aux
//     altérations infligées puis aux boosts ; s'il en manque → 3e attaque.
// Effets encodés : { kind:'boost', stat, delta, target } | { kind:'ailment',
// ailment:'par'|'psn'|'slp' } (précision du move = chance d'infliger).
//
// Fichier généré = VÉRITÉ (retouchable à la main), commité dans le repo.
//   node scripts/gen-pokemon-battle.mjs
import { writeFileSync } from 'node:fs';

const fetchT = (url) => fetch(url, { signal: AbortSignal.timeout(20000) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const API = 'https://pokeapi.co/api/v2';

async function getJson(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetchT(url);
      if (r.ok) return r.json();
      console.warn(`  … ${url.split('/v2/')[1]} HTTP ${r.status}, retry`);
    } catch (e) { console.warn(`  … ${url.split('/v2/')[1]} ${e.name}, retry`); }
    await sleep(1500 * (i + 1));
  }
  throw new Error(`échec définitif : ${url}`);
}

// Statuts v1 supportés par le moteur : liste blanche (slug PokéAPI).
// L'ORDRE est une priorité de sélection (altérations d'abord, gros boosts ensuite).
const STATUS_WHITELIST = [
  // sommeil / paralysie / poison (infligés à l'adversaire)
  'spore', 'sleep-powder', 'hypnosis', 'sing', 'lovely-kiss',
  'thunder-wave', 'stun-spore', 'glare',
  'toxic', 'poison-powder', 'poison-gas',
  // boosts de stats (soi)
  'swords-dance', 'amnesia', 'agility', 'acid-armor', 'barrier',
  'growth', 'meditate', 'sharpen', 'harden', 'withdraw', 'defense-curl',
  // malus de stats (adversaire)
  'screech', 'growl', 'tail-whip', 'leer', 'string-shot',
];

// Moves à ignorer même s'ils font des dégâts (mécaniques hors moteur v1 :
// charge 2 tours, contrecoup lourd, OHKO, multi-tours, dégâts fixes bizarres).
const MOVE_BLACKLIST = new Set([
  'solar-beam', 'sky-attack', 'razor-wind', 'skull-bash', 'hyper-beam',
  'fly', 'dig', 'thrash', 'petal-dance', 'rage', 'bide', 'counter',
  'guillotine', 'horn-drill', 'fissure', 'explosion', 'self-destruct',
  'dream-eater', 'sonic-boom', 'dragon-rage', 'psywave', 'super-fang',
  'seismic-toss', 'night-shade', 'low-kick', 'wrap', 'bind', 'fire-spin', 'clamp',
  // contrecoup non modélisé v1 → surpuissants sans leur inconvénient
  'double-edge', 'take-down', 'submission', 'jump-kick', 'high-jump-kick',
]);

// Types postérieurs à la Gén. 1 (l'API donne le type MODERNE des capacités :
// Morsure = Ténèbres aujourd'hui, Normal à l'époque) → remap vers la Gén. 1.
const GEN1_TYPE_REMAP = { dark: 'normal', steel: 'normal', fairy: 'normal' };

const moveCache = new Map();
async function getMove(name) {
  if (moveCache.has(name)) return moveCache.get(name);
  const m = await getJson(`${API}/move/${name}`);
  const fr = m.names.find((n) => n.language.name === 'fr')?.name || m.name;
  m.type.name = GEN1_TYPE_REMAP[m.type.name] || m.type.name;
  const meta = m.meta || {};
  const ailmentMap = { paralysis: 'par', poison: 'psn', sleep: 'slp' };
  const statMap = { attack: 'atk', defense: 'def', speed: 'spe', 'special-attack': 'spc', 'special-defense': 'spc' };
  const effects = [];
  const ailment = ailmentMap[meta.ailment?.name];
  if (ailment) effects.push({ kind: 'ailment', ailment });
  for (const sc of m.stat_changes || []) {
    const stat = statMap[sc.stat.name];
    if (stat) effects.push({ kind: 'boost', stat, delta: sc.change, target: sc.change > 0 ? 'self' : 'foe' });
  }
  const out = {
    id: m.name, fr, type: m.type.name,
    power: m.power || 0, accuracy: m.accuracy ?? 100,
    category: m.damage_class?.name || 'status', // note : le moteur Gén.1 recalcule phys/spé PAR TYPE
    effects,
  };
  moveCache.set(name, out);
  return out;
}

// Learnset Rouge/Bleu d'un Pokémon (level-up + machines).
function redBlueMoves(p) {
  const out = [];
  for (const mv of p.moves) {
    if (mv.version_group_details.some((d) => d.version_group.name === 'red-blue')) out.push(mv.move.name);
  }
  return out;
}

const score = (m) => m.power * (m.accuracy / 100);

async function buildOne(id) {
  const [p, s] = [await getJson(`${API}/pokemon/${id}`), await getJson(`${API}/pokemon-species/${id}`)];
  const nameFr = s.names.find((n) => n.language.name === 'fr')?.name || p.name;
  // Types Gén. 1 : Fée/Acier n'existaient pas (Mélofée était Normal pur,
  // Magnéti Électrik pur) → on retire ces types ; espèce sans type restant = Normal.
  let types = p.types.map((t) => t.type.name).filter((t) => !GEN1_TYPE_REMAP[t]);
  if (!types.length) types = ['normal'];
  const stats = Object.fromEntries(p.stats.map((st) => [st.stat.name, st.base_stat]));
  // Gén. 1 : Spécial unique — on prend special-attack comme base « Spécial ».
  const base = { hp: stats.hp, atk: stats.attack, def: stats.defense, spc: stats['special-attack'], spe: stats.speed };
  const bst = Object.values(base).reduce((a, b) => a + b, 0);

  const learnset = redBlueMoves(p).filter((n) => !MOVE_BLACKLIST.has(n));
  const details = [];
  for (const n of learnset) { try { details.push(await getMove(n)); } catch { /* move introuvable : ignoré */ } }

  const damaging = details.filter((m) => m.power > 0);
  const stab = damaging.filter((m) => types.includes(m.type)).sort((a, b) => score(b) - score(a));
  const off1 = stab[0] || damaging.sort((a, b) => score(b) - score(a))[0];
  const off2 = damaging
    .filter((m) => m !== off1 && m.type !== off1?.type)
    .sort((a, b) => score(b) - score(a))[0]
    || damaging.filter((m) => m !== off1).sort((a, b) => score(b) - score(a))[0];

  const statusAvail = STATUS_WHITELIST.filter((w) => details.some((m) => m.id === w)).map((w) => details.find((m) => m.id === w));
  // 1 altération (adversaire) + 1 boost/malus si possible, sinon les 2 premiers.
  const ailments = statusAvail.filter((m) => m.effects.some((e) => e.kind === 'ailment'));
  const boosts = statusAvail.filter((m) => m.effects.every((e) => e.kind === 'boost'));
  const chosenStatus = [];
  if (ailments[0]) chosenStatus.push(ailments[0]);
  if (boosts[0]) chosenStatus.push(boosts[0]);
  for (const m of statusAvail) { if (chosenStatus.length >= 2) break; if (!chosenStatus.includes(m)) chosenStatus.push(m); }
  // Complément si moveset incomplet : 3e attaque, puis n'importe quel move restant.
  const fillers = damaging.filter((m) => m !== off1 && m !== off2).sort((a, b) => score(b) - score(a));
  const moves = [off1, off2, ...chosenStatus].filter(Boolean);
  while (moves.length < 4 && fillers.length) moves.push(fillers.shift());

  const pick = (m) => m && ({ id: m.id, fr: m.fr, type: m.type, power: m.power, accuracy: m.accuracy, effects: m.effects });
  return {
    id, name: nameFr, en: p.name, types, base, bst,
    legendary: !!(s.is_legendary || s.is_mythical),
    sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`,
    spriteStatic: p.sprites.front_default,
    cry: p.cries?.latest || null,
    moves: moves.slice(0, 4).map(pick),
  };
}

const all = [];
for (let id = 1; id <= 151; id++) {
  const mon = await buildOne(id);
  all.push(mon);
  if (id % 10 === 0) console.log(`  … ${id}/151 (${mon.name} : ${mon.moves.map((m) => m.fr).join(', ')})`);
  await sleep(80);
}

const out = 'src/data/pokemonBattle.json';
writeFileSync(out, JSON.stringify(all, null, 1), 'utf8');
const incomplete = all.filter((m) => m.moves.length < 4);
console.log(`✓ ${all.length} Pokémon → ${out} (${moveCache.size} capacités distinctes).`);
if (incomplete.length) console.log(`⚠ movesets <4 : ${incomplete.map((m) => m.name).join(', ')}`);
