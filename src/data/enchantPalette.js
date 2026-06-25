// PALETTE DE CRÉATION D'ENCHANTEMENTS — « L'Autel du Scribe » (créateur ouvert
// façon Oblivion). Le joueur choisit 1-2 effets, règle leur valeur (BORNÉE par un
// maximum) et, pour les effets déclenchés, le moment (passif / dé / bonne réponse…).
// Le COÛT EN OR croît avec la PUISSANCE → un enchant fort coûte cher (le vrai frein).
//
// Tout produit des specs d'enchant DÉJÀ comprises par le moteur :
//   - passif    : { type, value [, subject] }              (lu par getEffectValue & co)
//   - déclencheur: { kind:'trigger', on, do:[…] [, values|subjects] }  (equipTrigger*)
//
// ⚠️ Bornage : maximum par effet (ci-dessous) + MAX_TOTAL_POWER + MAX_EFFECTS +
//    ENCHANT_CAP_PER_PIECE. Effets SELF/positifs uniquement (enchant = ta pièce).

export const MAX_EFFECTS_PER_PARCHMENT = 2;
export const MAX_TOTAL_POWER = 24;      // plafond de puissance cumulée d'un parchemin
export const ENCHANT_CAP_PER_PIECE = 3; // enchants max sur une pièce d'équipement
export const CRAFT_BASE_COST = 6;       // or de base (gravure)
export const GOLD_PER_POWER = 4;        // or par point de puissance

// Fréquence d'un déclencheur → multiplicateur de puissance (un effet « à chaque
// bonne réponse » vaut plus qu'« une fois sur un dé = 6 »).
export const TRIGGER_MULT = { passive: 1, correct: 0.8, wrong: 0.5, questionSubject: 0.5 };
// Déclencheur « dé » : dépend du nombre de faces choisies (1→rare, 3→fréquent).
export const rollMult = (n) => 0.12 + 0.14 * Math.max(1, Math.min(3, n || 1));

const money = (n) => ({ action: 'money', mode: 'gain', target: 'self', n, unit: 'flat' });

// Effets « déclenchés » communs (action + plage de magnitude + déclencheurs permis).
// `triggers` = liste des `on` autorisés ; le 1er est le défaut.
const TRIGGERED = {
  gainGold: { fr: "Gagner de l'or", en: 'Gain gold', icon: '🟡', min: 3, max: 25, step: 1, unitPower: 0.5, triggers: ['correct', 'roll', 'wrong', 'questionSubject'], make: (n) => [money(n)] },
  advance: { fr: 'Avancer', en: 'Advance', icon: '🏃', min: 1, max: 2, step: 1, unitPower: 4, triggers: ['correct', 'roll'], make: (n) => [{ action: 'move', target: 'self', dir: 'forward', n }] },
  recharge: { fr: 'Recharger un pouvoir', en: 'Recharge a power', icon: '⚡', binary: true, power: 4, triggers: ['correct', 'roll'], make: () => [{ action: 'gainCharge' }] },
  extraTime: { fr: '+ Temps (ponctuel)', en: '+ Time (one-shot)', icon: '⏳', min: 2, max: 8, step: 1, unitPower: 0.45, triggers: ['correct', 'questionSubject'], make: (n) => [{ action: 'extraTime', n }] },
  shield: { fr: 'Bouclier', en: 'Shield', icon: '🛡️', min: 1, max: 2, step: 1, unitPower: 2, triggers: ['correct', 'wrong'], make: (n) => [{ action: 'shieldNext', n }] },
};

// Effets « passifs » (toujours actifs sur la pièce) : { type, value [, subject] }.
const PASSIVE = {
  timerBonus: { fr: '+ Temps permanent', en: '+ Permanent time', icon: '⌛', type: 'timerBonus', min: 1, max: 8, step: 1, unitPower: 1, unitLabel: 's' },
  reculReduction: { fr: 'Recul réduit', en: 'Reduced setback', icon: '🧱', type: 'reculReduction', min: 1, max: 3, step: 1, unitPower: 2.5, unitLabel: 'case' },
  reflectChance: { fr: 'Renvoi d\'effet', en: 'Reflect effect', icon: '🪞', type: 'reflectChance', min: 5, max: 50, step: 5, unitPower: 0.22, unitLabel: '%' },
  stealProtection: { fr: 'Or protégé', en: 'Gold protected', icon: '🔒', type: 'stealProtection', min: 10, max: 60, step: 10, unitPower: 0.1, unitLabel: '%' },
  lootBonusSubject: { fr: 'Butin sur une matière', en: 'Loot on a subject', icon: '🎁', type: 'lootBonusSubject', min: 10, max: 50, step: 10, unitPower: 0.1, unitLabel: '%', needsSubject: true },
  moveDieSides: { fr: 'Dé de mouvement D10', en: 'Movement die D10', icon: '🎲', type: 'moveDieSides', binary: true, value: 10, power: 6 },
  duelImmune: { fr: 'Immunité aux duels', en: 'Duel immunity', icon: '🏰', type: 'duelImmune', binary: true, value: 1, power: 6 },
  goldStealImmune: { fr: 'Or involable', en: 'Gold unstealable', icon: '💰', type: 'goldStealImmune', binary: true, value: 1, power: 5 },
  itemStealImmune: { fr: 'Objets involables', en: 'Items unstealable', icon: '🧿', type: 'itemStealImmune', binary: true, value: 1, power: 5 },
};

// Catalogue unifié exposé à l'UI : chaque entrée = un effet configurable.
export const ENCHANT_EFFECTS = [
  ...Object.entries(PASSIVE).map(([id, e]) => ({ id, kind: 'passive', ...e })),
  ...Object.entries(TRIGGERED).map(([id, e]) => ({ id, kind: 'triggered', ...e })),
];
export const EFFECT_BY_ID = Object.fromEntries(ENCHANT_EFFECTS.map((e) => [e.id, e]));

// Borne une valeur à la plage d'un effet (pas + min/max).
export function clampValue(effect, v) {
  if (effect.binary) return effect.value ?? 1;
  const n = Math.round((Number(v) || effect.min) / (effect.step || 1)) * (effect.step || 1);
  return Math.max(effect.min, Math.min(effect.max, n));
}

// Puissance d'UN effet configuré. cfg = { value, trigger, dice:[…], subject }.
export function effectPower(effect, cfg = {}) {
  if (!effect) return 0;
  if (effect.kind === 'passive') {
    if (effect.binary) return effect.power || 0;
    return clampValue(effect, cfg.value) * (effect.unitPower || 0);
  }
  // déclenché : base (magnitude) × multiplicateur de fréquence du déclencheur
  const base = effect.binary ? (effect.power || 0) : clampValue(effect, cfg.value) * (effect.unitPower || 0);
  const trig = cfg.trigger || effect.triggers[0];
  const mult = trig === 'roll' ? rollMult((cfg.dice || []).length) : (TRIGGER_MULT[trig] ?? 0.5);
  return base * mult;
}

// Coût en or d'un parchemin = base + Σ puissance × or/puissance (arrondi).
export function enchantCost(parts) {
  const power = parts.reduce((s, p) => s + effectPower(EFFECT_BY_ID[p.id], p), 0);
  return Math.round(CRAFT_BASE_COST + power * GOLD_PER_POWER);
}
export function totalPower(parts) {
  return parts.reduce((s, p) => s + effectPower(EFFECT_BY_ID[p.id], p), 0);
}

// Construit la spec d'enchant d'UN effet configuré (forme moteur).
export function buildEnchant(effect, cfg = {}) {
  if (effect.kind === 'passive') {
    const value = effect.binary ? (effect.value ?? 1) : clampValue(effect, cfg.value);
    const spec = { type: effect.type, value };
    if (effect.needsSubject && cfg.subject) spec.subject = cfg.subject;
    return spec;
  }
  const n = effect.binary ? undefined : clampValue(effect, cfg.value);
  const trig = cfg.trigger || effect.triggers[0];
  const spec = { kind: 'trigger', on: trig, do: effect.make(n) };
  if (trig === 'roll') spec.values = (cfg.dice && cfg.dice.length ? cfg.dice : [6]).slice(0, 3);
  if (trig === 'questionSubject' && cfg.subject) spec.subjects = [cfg.subject];
  return spec;
}

// Valide un assemblage complet de parchemin (1-2 effets, plafonds respectés).
// Renvoie { ok, reason?, cost, power, enchants:[spec] }.
export function validateParchment(parts) {
  if (!parts.length) return { ok: false, reason: 'empty' };
  if (parts.length > MAX_EFFECTS_PER_PARCHMENT) return { ok: false, reason: 'tooMany' };
  const power = totalPower(parts);
  if (power > MAX_TOTAL_POWER) return { ok: false, reason: 'overpowered', power };
  const enchants = parts.map((p) => buildEnchant(EFFECT_BY_ID[p.id], p));
  return { ok: true, cost: enchantCost(parts), power, enchants };
}
