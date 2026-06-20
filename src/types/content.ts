// Modèles de CONTENU : objets, pouvoirs, matières, événements, sets.
// Source runtime : src/data/{items,powers,subjects,events,sets}.js + colonnes
// Supabase. Les variantes *_en suivent la convention i18n (Phases B/C).
import type { Effect } from './effects';

export type Rarity = 'commun' | 'rare' | 'legendaire';
export type Slot = 'head' | 'body' | 'feet' | 'consumable';
export type ItemFamily = 'ingredient' | 'potion' | 'parchment';

// Enchantement (Phase Enchantement) : un objet peut être une clé OU une instance.
export interface ItemEnchant {
  key: string;
  enchants: Effect[];
}

export interface Item {
  key: string;
  name: string;
  name_en?: string;
  desc?: string;
  desc_en?: string;
  descExpert?: string;
  descExpert_en?: string;
  icon?: string;
  img?: string;
  slot: Slot;
  rarity: Rarity;
  price: number;
  lootOnly?: boolean;
  effects: Effect[];
  family?: ItemFamily;
  set?: string;
  enchant?: unknown;        // parchemin : effet appliqué (forme libre côté data)
}

// Une cellule du sac : vide, une clé, ou une pile { key, n } (consommables).
export type BagCell = null | string | { key: string; n: number };

// Définition d'un POUVOIR (data/powers.js). Riche (levels, arbre Maîtrise) →
// typé de façon tolérante ; l'essentiel est name/category/price/color.
export interface PowerLevel {
  desc?: string;
  desc_en?: string;
  effect?: Record<string, unknown>;
}
export interface PowerDef {
  name: string;
  name_en?: string;
  desc?: string;
  desc_en?: string;
  icon?: string;
  type?: string;
  category?: 'def' | 'off';
  price: number;
  color?: string;
  activationCost?: number;
  upgradeCosts?: number[];
  levels?: PowerLevel[];
  tree?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface Subject {
  name: string;
  name_en?: string;
  short?: string;
  icon: string;
  color: string;
  colorSoft?: string;
  colorDeep?: string;
  biome: string;
  biome_en?: string;
}

export interface GameEvent {
  name: string;
  name_en?: string;
  icon?: string;
  desc?: string;
  desc_en?: string;
  optional?: boolean;
  weight?: number;
  category?: string;
  needsItems?: boolean;
  actions?: import('./effects').EffectAction[];
  custom?: boolean;
}

export interface ItemSet {
  name: string;
  name_en?: string;
  pieces?: string[];
  bonuses?: unknown;
  [k: string]: unknown;
}
