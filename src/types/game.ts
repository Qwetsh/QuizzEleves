// État de JEU : équipe, instance de pouvoir, nœud de plateau.
// Source runtime : src/store/gameStore.js, boardGenerator.js, turnHelpers.js.
import type { BagCell } from './content';
import type { Buff } from './effects';

// Instance d'un pouvoir possédé par une équipe (≠ PowerDef qui est la définition).
export interface PowerEntry {
  level: number;
  charges: number;          // plafonné à MAX_CHARGES (data/powers.js)
  // Voies d'embranchement choisies (extension Maîtrise), ex. spec5/spec10.
  spec5?: string;
  spec10?: string;
  [k: string]: unknown;
}

// Équipement porté (3 emplacements ; valeur = clé d'objet, instance enchantée, ou null).
export interface Equipment {
  head: string | { key: string; enchants: unknown[] } | null;
  body: string | { key: string; enchants: unknown[] } | null;
  feet: string | { key: string; enchants: unknown[] } | null;
}

export interface Team {
  name: string;
  emoji: string;
  color: string;
  colorDeep?: string;
  pos: string;              // id de nœud de plateau
  money: number;
  correct: number;
  wrong: number;
  streak?: number;
  powers: Record<string, PowerEntry>;
  powerDef?: string;        // clé du pouvoir défensif choisi au setup
  powerOff?: string;        // clé du pouvoir offensif choisi au setup
  equipment: Equipment;
  bag: BagCell[];
  itemShield?: number;      // charges de bouclier de bois (consommable)
  moneyMilestone?: number;
  buffs?: Buff[];
  knownItemKeys?: string[];
  knownIngredients?: string[];
  knownRecipes?: string[];
  lv2?: 'allemand' | 'espagnol';   // langue choisie en mode « LV2 au choix »
  token?: string;           // jeton d'appairage téléphone
  wager?: unknown;          // pari « Va-tout » en cours
  [k: string]: unknown;
}

// Un NŒUD du plateau (graphe orienté ; map { id: node }).
export type NodeType = 'depart' | 'arrivee' | 'subject' | 'jonction' | 'event';
export interface BoardNode {
  x: number;
  y: number;
  type: NodeType;
  subject?: string;
  next: string[];
  label?: string;
  trap?: unknown;           // piège posé sur la case (persisté)
}

export type Board = Record<string, BoardNode>;
