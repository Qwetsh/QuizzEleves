// Extension « Magie » — ressource d'équipe en TEMPS RÉEL (magie par minute).
//
// Modèle « accrual lazy » : le store ne stocke que `team.magic = {stored, lastTs}`
// et la valeur courante est CALCULÉE à la lecture (magicNow). On ne matérialise
// (stored ← valeur courante, lastTs ← now) qu'aux TRANSACTIONS : cast/gain/
// dépense + un point de matérialisation générale à nextTurn (borne l'erreur
// quand le taux de régen change en cours de route). Les barres (TBI + mobile)
// s'animent LOCALEMENT dans les composants sans muter le store — sinon chaque
// seconde déclencherait un republish Supabase de la session.
//
// ⚠️ Les passifs d'équipement `magicRegen`/`magicMax` doivent être des valeurs
// FIXES : on les somme ici SANS résoudre dés ni probabilité (contrairement à
// getEffectValue) pour que le taux soit stable entre deux lectures.
import { MAGIC } from './balanceConfig.js';
import { equippedItems, activeSetEffects, buffValue } from './itemEffects.js';
import { SPELLS } from '../data/spells.js';
import { RUNE_KEYS } from '../data/runes.js';

// Somme DÉTERMINISTE d'un passif (valeurs numériques uniquement, pas de dé/chance).
function fixedEffectSum(team, type) {
  let total = 0;
  for (const item of equippedItems(team)) {
    for (const fx of item.effects || []) {
      if (fx.type === type && typeof fx.value === 'number') total += fx.value;
    }
  }
  for (const fx of activeSetEffects(team)) {
    if (fx.type === type && typeof fx.value === 'number') total += fx.value;
  }
  return total;
}

// Taux de régénération effectif (magie/minute) : base + passifs + buffs.
export function magicRegenPerMin(team) {
  return Math.max(0, (MAGIC.regenPerMin || 0) + fixedEffectSum(team, 'magicRegen') + buffValue(team, 'magicRegen'));
}

// Plafond effectif de la barre.
export function magicMaxOf(team) {
  return Math.max(1, (MAGIC.max || 0) + fixedEffectSum(team, 'magicMax'));
}

// Barre de départ / backfill (resume de save, vieille équipe sans magie).
export const initTeamMagic = (now = Date.now()) => ({ stored: MAGIC.start || 0, lastTs: now });

// Valeur courante CALCULÉE (défensif : 0 si l'équipe n'a pas de magie —
// extension coupée, devSandbox, vieux tests).
export function magicNow(team, now = Date.now()) {
  const m = team?.magic;
  if (!m || typeof m.stored !== 'number') return 0;
  const elapsedMin = Math.max(0, now - (m.lastTs || now)) / 60000;
  return Math.min(magicMaxOf(team), m.stored + elapsedMin * magicRegenPerMin(team));
}

// Matérialise l'accrual : nouveau bloc {stored, lastTs} à poser sur l'équipe.
export function materializeMagic(team, now = Date.now()) {
  return { stored: magicNow(team, now), lastTs: now };
}

// Dépense (matérialise puis débite). Retourne le nouveau bloc ou null si fonds
// insuffisants — l'appelant décide du message/refus.
export function spendMagic(team, amount, now = Date.now()) {
  const current = magicNow(team, now);
  if (current < amount) return null;
  return { stored: current - amount, lastTs: now };
}

// Gain (peut dépasser 0 mais jamais le plafond effectif).
export function gainMagicBlock(team, amount, now = Date.now()) {
  const current = magicNow(team, now);
  return { stored: Math.max(0, Math.min(magicMaxOf(team), current + amount)), lastTs: now };
}

// Connaissance de départ d'une équipe : les MAGIC.starterSpells sorts les moins
// chers (jouables dès le 1er tour) + leurs runes, complétées au hasard jusqu'à
// MAGIC.starterRunes runes connues (l'union peut dépasser si un sort de départ
// en demande plus — on ne prive jamais une équipe d'un sort qu'elle « connaît »).
export function starterKnowledge(rand = Math.random) {
  const starters = SPELLS.filter((s) => s.enabled !== false)
    .slice().sort((a, b) => (a.cost || 0) - (b.cost || 0))
    .slice(0, Math.max(0, MAGIC.starterSpells || 0));
  const runes = new Set(starters.flatMap((s) => s.runes || []).filter((k) => RUNE_KEYS.includes(k)));
  const pool = RUNE_KEYS.filter((k) => !runes.has(k));
  while (runes.size < Math.min(MAGIC.starterRunes || 0, RUNE_KEYS.length) && pool.length) {
    runes.add(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return { knownRunes: [...runes], knownSpells: starters.map((s) => s.key) };
}
