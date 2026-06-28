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
import { clampFaceValue, faceEffects } from './forge.js';

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

// Puissance d'une face = valeur de déplacement (0-6) + somme des coûts des effets.
export function facePower(face) {
  const v = clampFaceValue(face?.value);
  return v + faceEffects(face).reduce((s, e) => s + forgeEffectCost(e.type, e.tier), 0);
}

// --- Sélection de faces depuis le CATALOGUE curé (FORGE.catalog) -----------
// La boutique ne GÉNÈRE plus de faces : elle PIOCHE parmi une collection de
// faces validées (éditable dans l'éditeur d'équilibrage), pondérées par rareté.
// Une entrée de catalogue : { key, name, rarity, price, slot 1→6, value 0→6,
// effect: {type,tier}|null, enabled }. La face emporte toujours son slot cible.
const FACE_RARITY_WEIGHT = { commun: 10, rare: 4, legendaire: 1 };
const faceWeight = (f) => (FORGE.shopWeight || FACE_RARITY_WEIGHT)[f?.rarity] ?? 1;

// Faces réellement proposables : activées + effet résolu (ou face « course » pure).
export function enabledCatalogFaces() {
  return (FORGE.catalog || []).filter(
    (f) => f && f.key && f.enabled !== false && faceEffects(f).every((e) => FORGE_RESOLVED.includes(e.type)),
  );
}

// Normalise une entrée de catalogue en face de boutique (copie + power calculé
// pour l'affichage). Conserve key/rarity/price/slot/value/effect.
function toShopFace(f) {
  return {
    key: f.key, rarity: f.rarity || 'commun', price: f.price || 0,
    slot: f.slot, value: clampFaceValue(f.value),
    effects: faceEffects(f).map((e) => ({ type: e.type, tier: e.tier ?? 0 })),
    power: facePower(f),
  };
}

// Tirage pondéré d'une face parmi `pool`, en excluant les clés de `taken`.
function weightedPick(pool, taken, rng) {
  const avail = pool.filter((f) => !taken.has(f.key));
  const total = avail.reduce((s, f) => s + faceWeight(f), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const f of avail) { if (r < faceWeight(f)) return f; r -= faceWeight(f); }
  return avail[avail.length - 1] || null;
}

// Vitrine : `count` faces DISTINCTES du catalogue, pondérées par rareté.
// (Renouvelée à l'achat côté store, comme la boutique d'objets.)
export function pickFaceStock(count = SHOP_FACE_SLOTS, rng = Math.random) {
  const pool = enabledCatalogFaces();
  const out = [];
  const used = new Set();
  while (out.length < count && used.size < pool.length) {
    const pick = weightedPick(pool, used, rng);
    if (!pick) break;
    used.add(pick.key);
    out.push(toShopFace(pick));
  }
  return out;
}

// Face de remplacement (renouvellement à l'achat) absente du `stock` (par key).
export function pickReplacementFace(stock = [], rng = Math.random) {
  const taken = new Set((stock || []).map((f) => f && f.key).filter(Boolean));
  const pick = weightedPick(enabledCatalogFaces(), taken, rng);
  return pick ? toShopFace(pick) : null;
}

// Libellé court d'une face pour l'UI (boutique, dé 3D) : « +3 💰🛡️ » / « +5 ».
export function faceShortLabel(face) {
  const v = clampFaceValue(face?.value);
  const icons = faceEffects(face).map((e) => FORGE_EFFECTS[e.type]?.icon).filter(Boolean).join('');
  return icons ? `+${v} ${icons}` : `+${v}`;
}

// Libellé lisible d'UN effet (icône + nom + détail chiffré). null si inconnu.
function oneEffectLabel(e, en) {
  const meta = e?.type ? FORGE_EFFECTS[e.type] : null;
  if (!meta) return null;
  const name = en ? meta.en : meta.fr;
  const v = forgeTierValue(e.type, e.tier);
  let detail = '';
  switch (e.type) {
    case 'prime': detail = en ? `+${v} gold` : `+${v} or`; break;
    case 'aubaine': detail = `×${v}`; break;
    case 'recharge': detail = v === 'full' ? (en ? 'full' : 'pleine') : `+${v}`; break;
    case 'indice': detail = `−${v}`; break;
    case 'repit': detail = `+${v} s`; break;
    case 'egide': detail = v === 'cancel' ? (en ? 'cancel' : 'annule') : `−${v}`; break;
    case 'butin': detail = v === 'guaranteed' ? (en ? 'guaranteed' : 'garanti') : `+${Math.round((Number(v) || 0) * 100)} %`; break;
    default: detail = '';
  }
  return detail ? `${meta.icon} ${name} (${detail})` : `${meta.icon} ${name}`;
}

// Description lisible des effets d'une face (carte boutique / atelier), TOUS les
// effets joints par « · ». null si la face n'a aucun effet.
export function faceEffectLabel(face, en = false) {
  const parts = faceEffects(face).map((e) => oneEffectLabel(e, en)).filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// Quand l'effet se déclenche (phrase lisible pour la modale de détail).
function forgeTimingText(timing, en) {
  switch (timing) {
    case 'roll': return en ? 'Triggers each time you roll this face.' : 'Se déclenche à chaque fois que tu tombes sur cette face.';
    case 'preQuestion': return en ? 'Triggers before the question, the turn you land on this face.' : 'Se déclenche avant la question, le tour où tu tombes sur cette face.';
    case 'correct': return en ? 'Triggers when you then answer correctly.' : "Se déclenche quand tu réponds ensuite correctement.";
    default: return '';
  }
}

// Description DÉTAILLÉE d'UN effet (modale de zoom) : { name, icon, family, what, when }.
function oneEffectDescription(e, en = false) {
  const meta = e?.type ? FORGE_EFFECTS[e.type] : null;
  if (!meta) return null;
  const name = en ? meta.en : meta.fr;
  const v = forgeTierValue(e.type, e.tier);
  let what = '';
  switch (e.type) {
    case 'prime': what = en ? `You immediately gain +${v} gold.` : `Tu gagnes immédiatement +${v} or.`; break;
    case 'aubaine': what = en ? `Your reward gold is multiplied by ${v}.` : `Ton or de récompense est multiplié par ${v}.`; break;
    case 'recharge': what = v === 'full'
      ? (en ? 'One of your powers is fully recharged.' : "Un de tes pouvoirs est rechargé à fond.")
      : (en ? `One of your powers gains +${v} charge${(Number(v) || 0) > 1 ? 's' : ''}.` : `Un de tes pouvoirs gagne +${v} charge${(Number(v) || 0) > 1 ? 's' : ''}.`); break;
    case 'indice': what = en ? `Removes ${v} wrong answer${(Number(v) || 0) > 1 ? 's' : ''} from the question.` : `Élimine ${v} mauvaise${(Number(v) || 0) > 1 ? 's' : ''} réponse${(Number(v) || 0) > 1 ? 's' : ''} de la question.`; break;
    case 'repit': what = en ? `+${v} seconds to answer.` : `+${v} secondes pour répondre.`; break;
    case 'questionFraiche': what = en ? 'Replaces the question with a fresh one (never seen).' : 'Remplace la question par une nouvelle (jamais vue).'; break;
    case 'egide': what = v === 'cancel'
      ? (en ? 'Cancels the setback entirely if you answer wrong.' : "Annule entièrement le recul en cas de mauvaise réponse.")
      : (en ? `Reduces the setback by ${v} space${(Number(v) || 0) > 1 ? 's' : ''}.` : `Réduit le recul de ${v} case${(Number(v) || 0) > 1 ? 's' : ''}.`); break;
    case 'gardeSerie': what = en ? 'Your answer streak will not break, even on a wrong answer.' : 'Ta série de bonnes réponses ne se casse pas, même en cas d’erreur.'; break;
    case 'butin': what = v === 'guaranteed'
      ? (en ? 'Guaranteed loot on a correct answer.' : 'Butin garanti en cas de bonne réponse.')
      : (en ? `+${Math.round((Number(v) || 0) * 100)}% loot chance on a correct answer.` : `+${Math.round((Number(v) || 0) * 100)} % de chances de butin en cas de bonne réponse.`); break;
    case 'relance': what = en ? 'Reroll the die (a new roll).' : 'Relance le dé (nouveau tirage).'; break;
    default: what = '';
  }
  return { name, icon: meta.icon, family: meta.family, what, when: forgeTimingText(meta.timing, en) };
}

// Descriptions détaillées de TOUS les effets d'une face (modale de zoom). [] si aucun.
export function faceEffectDescriptions(face, en = false) {
  return faceEffects(face).map((e) => oneEffectDescription(e, en)).filter(Boolean);
}

// Boutique de faces : nombre d'emplacements en vitrine + plafond de la réserve
// de faces achetées (non posées) d'une équipe.
export const SHOP_FACE_SLOTS = 6;
export const FACE_STOCK_MAX = 12;

// Effets dont la RÉSOLUTION est câblée. La boutique ne propose QUE ces effets-là
// (aucune face achetable ne doit être muette). Lot de départ complet (10).
export const FORGE_RESOLVED = ['prime', 'egide', 'aubaine', 'indice', 'repit', 'gardeSerie', 'butin', 'recharge', 'questionFraiche', 'relance'];

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
// Fusion d'un palier d'Égide (réduction de recul) : 'cancel' l'emporte, sinon max.
function mergeAegis(prev, v) {
  if (prev === 'cancel' || v === 'cancel') return 'cancel';
  return Math.max(Number(prev) || 0, Number(v) || 0);
}
// Fusion d'un palier de Butin : 'guaranteed' l'emporte, sinon meilleure fraction.
function mergeButin(prev, v) {
  if (prev === 'guaranteed' || v === 'guaranteed') return 'guaranteed';
  return Math.max(Number(prev) || 0, Number(v) || 0);
}

export function resolveFaceAtRoll(team, face) {
  const patch = {};
  const logs = [];
  const effects = faceEffects(face).filter((e) => FORGE_EFFECTS[e.type]);
  if (!effects.length) return { patch, logs };
  const en = getLang() === 'en';
  const who = `${team.emoji} ${team.name}`;

  // Plusieurs effets cumulables : Prime/Indice/Répit s'ADDITIONNENT, Aubaine prend
  // le meilleur multiplicateur, Égide/Butin fusionnent (cancel/guaranteed gagnent),
  // les drapeaux (Garde de série, Question fraîche) passent à vrai.
  for (const eff of effects) {
    const v = forgeTierValue(eff.type, eff.tier);
    switch (eff.type) {
      case 'prime': {
        const amt = Number(v) || 0;
        if (amt > 0) {
          patch.money = (patch.money ?? team.money ?? 0) + amt;
          logs.push(en ? `💰 ${who} — forged die: +${amt} gold (Bounty).`
                       : `💰 ${who} — dé forgé : +${amt} or (Prime).`);
        }
        break;
      }
      case 'egide': {
        if (v != null) {
          patch.forgeAegis = mergeAegis(patch.forgeAegis, v); // consommé par applyRecul (max avec Bouclier)
          const what = v === 'cancel'
            ? (en ? 'cancels the setback' : 'annule le recul')
            : (en ? `−${v} to the setback` : `−${v} au recul`);
          logs.push(en ? `🛡️ ${who} — Aegis armed (${what}).` : `🛡️ ${who} — Égide armée (${what}).`);
        }
        break;
      }
      case 'aubaine': {
        const m = Number(v) || 1;
        patch.forgeGoldMult = Math.max(patch.forgeGoldMult || 0, m);
        logs.push(en ? `💰 ${who} — Windfall armed (×${m} gold on a correct answer).`
                     : `💰 ${who} — Aubaine armée (or ×${m} si bonne réponse).`);
        break;
      }
      case 'indice': {
        const n = Number(v) || 0;
        if (n > 0) {
          patch.forgeIndice = (patch.forgeIndice || 0) + n;
          logs.push(en ? `💡 ${who} — Hint armed (−${n} wrong answer${n > 1 ? 's' : ''}).`
                       : `💡 ${who} — Indice armé (−${n} mauvaise${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}).`);
        }
        break;
      }
      case 'repit': {
        const s = Number(v) || 0;
        if (s > 0) {
          patch.forgeRepit = (patch.forgeRepit || 0) + s;
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
        patch.forgeButin = mergeButin(patch.forgeButin, v); // nombre (+fraction) | 'guaranteed'
        const what = v === 'guaranteed'
          ? (en ? 'guaranteed loot' : 'butin garanti')
          : (en ? `+${Math.round((Number(v) || 0) * 100)}% loot` : `+${Math.round((Number(v) || 0) * 100)} % de butin`);
        logs.push(en ? `🎁 ${who} — Spoils armed (${what}).` : `🎁 ${who} — Butin armé (${what}).`);
        break;
      }
      case 'questionFraiche': {
        patch.forgeFreshQ = true; // consommé à l'affichage de la question (askQuestion)
        logs.push(en ? `🔄 ${who} — Fresh question armed.` : `🔄 ${who} — Question fraîche armée.`);
        break;
      }
      // recharge : via le moteur d'effets (sélecteur de pouvoir TBI) — voir
      //   faceRollEngineActions. relance : interceptée au lancer (gameStore).
      default: break;
    }
  }
  return { patch, logs };
}

// Actions « moteur d'effets » d'une face à appliquer AU LANCER (timing 'roll')
// qui nécessitent la file/les interrupts — actuellement la Recharge (sélecteur
// de pouvoir TBI, §6.1). Renvoie une liste d'actions (vide si rien).
export function faceRollEngineActions(face) {
  return faceEffects(face)
    .filter((e) => e.type === 'recharge')
    .map((e) => ({ action: 'gainCharge', n: forgeTierValue('recharge', e.tier) })); // 1 | 2 | 'full'
}

// La face tirée porte-t-elle une Relance ? (interceptée au lancer.)
export function isRelanceFace(face) {
  return faceEffects(face).some((e) => e.type === 'relance');
}

// Réduction de recul apportée par une Égide armée (résolu pour un recul `recul`).
// 'cancel' ⇒ annule tout ; nombre ⇒ ce nombre de cases ; absente ⇒ 0.
export function aegisReduction(team, recul) {
  const raw = team?.forgeAegis;
  if (recul <= 0 || raw == null) return 0;
  if (raw === 'cancel') return recul;
  return Math.max(0, Math.round(Number(raw) || 0));
}
