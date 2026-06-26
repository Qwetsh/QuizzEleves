// Schéma du MOTEUR D'EFFETS (effectEngine.js) — la brique la plus rentable à
// typer : c'est le format des `effects`/`actions` de TOUS les objets, potions,
// pouvoirs, événements, et le langage des futurs modules de contenu.
//
// Source de vérité runtime : src/store/effectEngine.js + scripts/alchemy-palette.mjs.
// Volontairement tolérant (champs optionnels) pour coller au contenu existant.

export type Target = 'self' | 'all' | 'allOthers' | 'randomOpponent' | 'target';
export type MoneyMode = 'gain' | 'lose' | 'steal';
export type AmountUnit = 'flat' | 'percent';

// Quantité : nombre fixe, dé ('d4'…'d10'), ou valeur à l'échelle d'une métrique.
export type ScaledAmount = { per: 'streak' | 'correct' | 'wrong' | 'precision' | 'imprecision' | 'timeleft'; factor?: number; base?: number };
export type Amount = number | string | ScaledAmount;

// Un buff temporisé (action `buff`).
export interface Buff {
  type: string;            // 'themeBonus' | 'advanceOnCorrect' | 'diceBonus' | 'duelImmune' | 'noRecul' | …
  turns?: number;
  n?: number;
  subject?: string;
  [k: string]: unknown;
}

// Une ACTION du moteur (union discriminée par `action`).
export type EffectAction =
  | { action: 'money'; mode: MoneyMode; target?: Target; n?: Amount; unit?: AmountUnit; chance?: number }
  | { action: 'move'; target?: Target; dir: 'forward' | 'back'; n?: Amount; chance?: number }
  | { action: 'extraTime'; n?: Amount; chance?: number }
  | { action: 'shieldNext'; n?: Amount; chance?: number }
  | { action: 'gainCharge'; chance?: number }
  | { action: 'loot'; category?: 'consumable' | 'equipment'; chance?: number }
  | { action: 'teleportFurthest'; target?: Target; chance?: number }
  | { action: 'fumigene'; turns?: Amount; chance?: number }
  | { action: 'forceSubject'; target?: Target; subject?: string; chance?: number }
  | { action: 'curseTimer'; target?: Target; divisor?: number; chance?: number }
  | { action: 'curseExtraQuestion'; target?: Target; n?: Amount; chance?: number }
  | { action: 'randomPathNext'; target?: Target; chance?: number }
  | { action: 'buff'; target?: Target; buff: Buff; chance?: number }
  // Échappatoire pour les actions de contenu non encore listées ici.
  | { action: string; [k: string]: unknown };

// Table de dé : clés '1', '2-3', '4-5', '6' → liste d'actions.
export type RollTable = Record<string, EffectAction[]>;

// Un DÉCLENCHEUR (passif) : `kind:'trigger'`, on:'use'|'roll'|'correct'|'wrong'|'question'|'fightWin'|…
export interface Trigger {
  kind: 'trigger';
  on: string;
  do?: EffectAction[];
  else?: EffectAction[];
  roll?: string;            // ex. 'd6'
  table?: RollTable;
  chance?: number;
  subjects?: string[];
  [k: string]: unknown;
}

// Un EFFET PASSIF simple (sur équipement/pouvoir) : `{ type, value, chance? }`.
export interface PassiveEffect {
  type: string;             // 'moneyPerCorrect' | 'reculReduction' | 'extraTime' | …
  value?: Amount;
  chance?: number;
  [k: string]: unknown;
}

// La liste `effects` d'un objet/pouvoir mélange passifs et déclencheurs.
export type Effect = PassiveEffect | Trigger | EffectAction;
