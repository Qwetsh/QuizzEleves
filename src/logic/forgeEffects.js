// ============================================================
//  FORGE DE DÉS — catalogue & résolution des EFFETS DE FACE
//
//  Métadonnées STATIQUES des effets ici (icône, famille, timing). Les VALEURS
//  des paliers vivent dans balanceConfig.FORGE.effects[type].tiers (calibrables,
//  aucun chiffre en dur côté logique).
//
//  Pipeline (spec §6) — l'effet d'une face se déclenche selon son `timing` :
//    - 'roll'        : au lancer (Prime…) — appliqué tout de suite.
//    - 'preQuestion' : avant la question (Égide…) — ARMÉ pour le tour (flag équipe).
//    - 'correct'     : sur bonne réponse (Aubaine/Butin…) — Phase 2.
//
//  Phase 1c : 2 effets pilotes (Prime, Égide) pour valider le pipeline de bout
//  en bout. Le lot complet (9 effets) arrive en Phase 2.
// ============================================================
import { FORGE } from './balanceConfig.js';
import { getLang } from '../i18n/lang.js';
import { clampFaceValue } from './forge.js';

// Couleur par famille d'effet (spec §5) : or, question, défense, pouvoir, loot.
export const FORGE_FAMILY_COLOR = {
  gold: '#e8b117', question: '#3b6cb3', defense: '#2f9d5a', power: '#8745d4', loot: '#d98a2b',
};

// Lot de départ (spec §5) — métadonnées statiques. `timing` pilote QUAND l'effet
// se résout dans le pipeline (§6) : roll → preQuestion → question → correct.
// Les VALEURS des paliers sont dans balanceConfig.FORGE.effects[type].
export const FORGE_EFFECTS = {
  prime:           { icon: '💰', family: 'gold',     timing: 'roll',        fr: 'Prime',           en: 'Bounty' },
  aubaine:         { icon: '💰', family: 'gold',     timing: 'correct',     fr: 'Aubaine',         en: 'Windfall' },
  recharge:        { icon: '🔋', family: 'power',    timing: 'roll',        fr: 'Recharge',        en: 'Recharge' },
  indice:          { icon: '💡', family: 'question', timing: 'preQuestion', fr: 'Indice',          en: 'Hint' },
  repit:           { icon: '⏳', family: 'question', timing: 'preQuestion', fr: 'Répit',           en: 'Respite' },
  questionFraiche: { icon: '🔄', family: 'question', timing: 'preQuestion', fr: 'Question fraîche', en: 'Fresh question' },
  egide:           { icon: '🛡️', family: 'defense',  timing: 'preQuestion', fr: 'Égide',           en: 'Aegis' },
  gardeSerie:      { icon: '🔗', family: 'defense',  timing: 'preQuestion', fr: 'Garde de série',  en: 'Streak guard' },
  butin:           { icon: '🎁', family: 'loot',     timing: 'correct',     fr: 'Butin',           en: 'Spoils' },
  relance:         { icon: '🎲', family: 'power',    timing: 'roll',        fr: 'Relance',         en: 'Reroll' },
};

// Valeur du palier d'un effet (tier 0/1/2 = petit/moyen/gros). null si inconnu.
// Une valeur peut être un nombre (Prime), un littéral (Égide : 'cancel') ou un
// booléen (effets sans palier, ex. Question fraîche).
export function forgeTierValue(type, tier) {
  const arr = FORGE.effects?.[type]?.tiers;
  return Array.isArray(arr) ? (arr[tier ?? 0] ?? null) : null;
}

// Coût de PUISSANCE d'un effet à un palier donné (0 si pas d'effet/inconnu).
export function forgeEffectCost(type, tier) {
  const arr = FORGE.effects?.[type]?.costs;
  return Array.isArray(arr) ? (Number(arr[tier ?? 0]) || 0) : 0;
}

// Puissance d'une face = valeur de déplacement (0-6) + coût de l'effet.
export function facePower(face) {
  const v = clampFaceValue(face?.value);
  const e = face?.effect;
  return v + (e?.type ? forgeEffectCost(e.type, e.tier) : 0);
}

// --- Générateur de faces (boutique, Phase 2) -------------------------------
// 6 bandes de puissance P. Une bande i couvre [2i+1, 2i+2].
const BAND_RANGES = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]];

// Construit une face de puissance exactement `P` : on énumère les combinaisons
// (valeur de déplacement 0-6) + (effet à un coût c) telles que valeur + c === P,
// puis on en tire une au hasard. `enabledTypes` restreint les effets permis.
export function buildFaceOfPower(P, rng = Math.random, enabledTypes = null) {
  const budget = Math.min(P, FORGE.budgetMax ?? 12);
  const combos = [];
  if (budget >= 0 && budget <= 6) combos.push({ value: budget, effect: null }); // face « course » pure
  for (const [type, e] of Object.entries(FORGE.effects || {})) {
    if (enabledTypes && !enabledTypes.includes(type)) continue;
    (e.costs || []).forEach((c, tier) => {
      const value = budget - (Number(c) || 0);
      if (value >= 0 && value <= 6) combos.push({ value, effect: { type, tier } });
    });
  }
  if (!combos.length) return null;
  return combos[Math.floor(rng() * combos.length)];
}

// Tire une face de boutique : bande pondérée par la rareté, puissance dans la
// bande, puis face de cette puissance. Renvoie { value, effect, price, power }.
export function rollShopFace(rng = Math.random, enabledTypes = null) {
  const weights = FORGE.rarityByBand || [1, 1, 1, 1, 1, 1];
  const total = weights.reduce((s, w) => s + (Number(w) || 0), 0) || 1;
  let r = rng() * total;
  let bi = 0;
  for (; bi < weights.length; bi++) { if (r < weights[bi]) break; r -= weights[bi]; }
  bi = Math.min(bi, BAND_RANGES.length - 1);
  const [lo, hi] = BAND_RANGES[bi];
  const P = lo + Math.floor(rng() * (hi - lo + 1));
  const face = buildFaceOfPower(P, rng, enabledTypes);
  if (!face) return null;
  return { ...face, power: facePower(face), price: (FORGE.priceByBand || [])[bi] ?? 0 };
}

// Vitrine de `count` faces (renouvelée à l'achat côté store, comme les objets).
export function generateFaceStock(count, rng = Math.random, enabledTypes = null) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const f = rollShopFace(rng, enabledTypes);
    if (f) out.push(f);
  }
  return out;
}

// Libellé court d'une face pour l'UI (boutique, dé 3D) : « +3 · 💰 » / « +5 ».
export function faceShortLabel(face) {
  const v = clampFaceValue(face?.value);
  const e = face?.effect;
  const meta = e?.type ? FORGE_EFFECTS[e.type] : null;
  return meta ? `+${v} ${meta.icon}` : `+${v}`;
}

// Effets dont la RÉSOLUTION est câblée (le reste — recharge, questionFraiche,
// relance — arrive dans une étape ultérieure). La boutique ne propose QUE ces
// effets-là, pour qu'aucune face achetable ne soit muette.
export const FORGE_RESOLVED = ['prime', 'egide', 'aubaine', 'indice', 'repit', 'gardeSerie', 'butin'];

// Résolution d'une face AU LANCER : applique les effets 'roll' (Prime) et ARME
// les effets 'preQuestion'/'correct' via des flags d'équipe consommés plus tard
// (cf. gameStore). Renvoie { patch, logs } à fusionner dans l'équipe.
//   - patch.money          : Prime (or sec, immédiat)
//   - patch.forgeAegis     : Égide (réduction de recul ; nombre | 'cancel')
//   - patch.forgeGoldMult  : Aubaine (×or de la bonne réponse)
//   - patch.forgeIndice    : Indice (nb de mauvaises réponses éliminées)
//   - patch.forgeRepit     : Répit (secondes ajoutées au timer)
//   - patch.forgeStreakGuard: Garde de série (la série ne casse pas)
//   - patch.forgeButin     : Butin (+chance de loot, ou 'guaranteed')
export function resolveFaceAtRoll(team, face) {
  const patch = {};
  const logs = [];
  const eff = face?.effect;
  if (!eff || !eff.type || !FORGE_EFFECTS[eff.type]) return { patch, logs };
  const en = getLang() === 'en';
  const who = `${team.emoji} ${team.name}`;
  const v = forgeTierValue(eff.type, eff.tier);

  switch (eff.type) {
    case 'prime': {
      const amt = Number(v) || 0;
      if (amt > 0) {
        patch.money = (team.money || 0) + amt;
        logs.push(en ? `💰 ${who} — forged die: +${amt} gold (Bounty).`
                     : `💰 ${who} — dé forgé : +${amt} or (Prime).`);
      }
      break;
    }
    case 'egide': {
      if (v != null) {
        patch.forgeAegis = v; // consommé par applyRecul (max avec Bouclier)
        const what = v === 'cancel'
          ? (en ? 'cancels the setback' : 'annule le recul')
          : (en ? `−${v} to the setback` : `−${v} au recul`);
        logs.push(en ? `🛡️ ${who} — Aegis armed (${what}).` : `🛡️ ${who} — Égide armée (${what}).`);
      }
      break;
    }
    case 'aubaine': {
      const m = Number(v) || 1;
      patch.forgeGoldMult = m;
      logs.push(en ? `💰 ${who} — Windfall armed (×${m} gold on a correct answer).`
                   : `💰 ${who} — Aubaine armée (or ×${m} si bonne réponse).`);
      break;
    }
    case 'indice': {
      const n = Number(v) || 0;
      if (n > 0) {
        patch.forgeIndice = n;
        logs.push(en ? `💡 ${who} — Hint armed (−${n} wrong answer${n > 1 ? 's' : ''}).`
                     : `💡 ${who} — Indice armé (−${n} mauvaise${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}).`);
      }
      break;
    }
    case 'repit': {
      const s = Number(v) || 0;
      if (s > 0) {
        patch.forgeRepit = s;
        logs.push(en ? `⏳ ${who} — Respite armed (+${s}s).` : `⏳ ${who} — Répit armé (+${s} s).`);
      }
      break;
    }
    case 'gardeSerie': {
      patch.forgeStreakGuard = true;
      logs.push(en ? `🔗 ${who} — Streak guard armed.` : `🔗 ${who} — Garde de série armée.`);
      break;
    }
    case 'butin': {
      patch.forgeButin = v; // nombre (+fraction de chance) | 'guaranteed'
      const what = v === 'guaranteed'
        ? (en ? 'guaranteed loot' : 'butin garanti')
        : (en ? `+${Math.round((Number(v) || 0) * 100)}% loot` : `+${Math.round((Number(v) || 0) * 100)} % de butin`);
      logs.push(en ? `🎁 ${who} — Spoils armed (${what}).` : `🎁 ${who} — Butin armé (${what}).`);
      break;
    }
    // recharge / questionFraiche / relance : résolution câblée dans une étape ultérieure.
    default: break;
  }
  return { patch, logs };
}

// Réduction de recul apportée par une Égide armée (résolu pour un recul `recul`).
// 'cancel' ⇒ annule tout ; nombre ⇒ ce nombre de cases ; absente ⇒ 0.
export function aegisReduction(team, recul) {
  const raw = team?.forgeAegis;
  if (recul <= 0 || raw == null) return 0;
  if (raw === 'cancel') return recul;
  return Math.max(0, Math.round(Number(raw) || 0));
}
