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

// Couleur par famille d'effet (spec §5) : or, question, défense, pouvoir, loot.
export const FORGE_FAMILY_COLOR = {
  gold: '#e8b117', question: '#3b6cb3', defense: '#2f9d5a', power: '#8745d4', loot: '#d98a2b',
};

// Catalogue (s'enrichit en Phase 2). `timing` pilote QUAND l'effet se résout.
export const FORGE_EFFECTS = {
  prime: { icon: '💰', family: 'gold', timing: 'roll', fr: 'Prime', en: 'Bounty' },
  egide: { icon: '🛡️', family: 'defense', timing: 'preQuestion', fr: 'Égide', en: 'Aegis' },
};

// Valeur du palier d'un effet (tier 0/1/2 = petit/moyen/gros). null si inconnu.
// Une valeur peut être un nombre (Prime) ou un littéral (Égide : 'cancel').
export function forgeTierValue(type, tier) {
  const arr = FORGE.effects?.[type]?.tiers;
  return Array.isArray(arr) ? (arr[tier ?? 0] ?? null) : null;
}

// Résolution d'une face AU LANCER : applique les effets 'roll' et ARME ceux
// 'preQuestion'. Renvoie { patch, logs } à fusionner dans l'équipe (le store
// applique patch sur newTeams et pousse logs dans le journal).
//   - patch.money     : Prime (or sec)
//   - patch.forgeAegis: Égide armée pour le tour (nombre de cases ou 'cancel')
export function resolveFaceAtRoll(team, face) {
  const patch = {};
  const logs = [];
  const eff = face?.effect;
  if (!eff || !eff.type || !FORGE_EFFECTS[eff.type]) return { patch, logs };
  const en = getLang() === 'en';
  const who = `${team.emoji} ${team.name}`;

  if (eff.type === 'prime') {
    const amt = Number(forgeTierValue('prime', eff.tier)) || 0;
    if (amt > 0) {
      patch.money = (team.money || 0) + amt;
      logs.push(en ? `💰 ${who} — forged die: +${amt} gold (Bounty).`
                   : `💰 ${who} — dé forgé : +${amt} or (Prime).`);
    }
  } else if (eff.type === 'egide') {
    const v = forgeTierValue('egide', eff.tier);
    if (v != null) {
      patch.forgeAegis = v; // nombre | 'cancel' — consommé par applyRecul (max avec Bouclier)
      const what = v === 'cancel'
        ? (en ? 'cancels the setback' : 'annule le recul')
        : (en ? `−${v} to the setback` : `−${v} au recul`);
      logs.push(en ? `🛡️ ${who} — Aegis armed (${what}).`
                   : `🛡️ ${who} — Égide armée (${what}).`);
    }
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
