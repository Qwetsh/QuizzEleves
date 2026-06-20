// Lignes Supabase (miroir des colonnes réelles). Sert à typer les couches
// d'accès : itemsConfig.js, eventsConfig.js, questions, balance, lobby.
// Convention i18n : colonnes *_en (Phase C). snake_case = côté DB.

export interface ItemRow {
  key: string;
  name: string;
  name_en: string | null;
  icon: string | null;
  img: string | null;
  slot: string;
  rarity: string;
  price: number;
  loot_only: boolean | null;
  effects: unknown;          // jsonb
  enabled: boolean | null;
  ord: number | null;
  description: string | null;
  description_en: string | null;
  desc_expert: string | null;
  desc_expert_en: string | null;
  set_key: string | null;
  family: string | null;
  enchant: unknown;          // jsonb
  updated_at?: string;
}

export interface EventRow {
  key: string;
  name: string;
  name_en: string | null;
  icon: string | null;
  description: string | null;
  description_en: string | null;
  optional: boolean | null;
  weight: number | null;
  category: string | null;
  needs_items: boolean | null;
  actions: unknown;          // jsonb
  enabled: boolean | null;
  ord: number | null;
  updated_at?: string;
}

export interface QuestionRow {
  id?: number | string;
  level: string;
  subject: string;
  q: string;
  a: string[];              // réponses (jsonb / text[])
  correcte: number;        // 1-indexé
  e?: string | null;       // explication
  q_en?: string | null;
  a_en?: string[] | null;
  e_en?: string | null;
  brevet?: boolean | null;
  enabled?: boolean | null;
  [k: string]: unknown;
}

export interface LobbyTeamRow {
  id?: number | string;
  code: string;
  name: string | null;
  emoji: string | null;
  color: string | null;
  power_def: string | null;
  power_off: string | null;
  lv2: string | null;
  token: string | null;
  ready: boolean | null;
  [k: string]: unknown;
}
