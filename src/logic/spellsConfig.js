// Chargement et édition des SORTS personnalisés depuis Supabase (table
// public.quete_spells). Mêmes principes offline-safe que les recettes :
// cache localStorage au boot (synchrone), puis rafraîchissement réseau.
// Les sorts personnalisés sont FUSIONNÉS par-dessus les intégrés (code)
// via setCustomSpells — DB = source de vérité pour le contenu.
import { supabase } from './supabaseClient.js';
import { setCustomSpells } from '../data/spells.js';

const LS_KEY = 'quete_spells_v1';

// Ligne DB -> sort interne (formes de data/spells.js).
function rowToSpell(r) {
  return {
    key: r.key,
    name: r.name,
    name_en: r.name_en || undefined,
    icon: r.icon || '✨',
    color: r.color || '#8745d4',
    desc: r.description || '',
    desc_en: r.description_en || undefined,
    runes: Array.isArray(r.runes) ? r.runes : [],
    cost: Number(r.cost) || 0,
    targeted: !!r.targeted,
    facePick: !!r.face_pick,
    actions: Array.isArray(r.actions) ? r.actions : [],
    enabled: r.enabled !== false,
    ord: r.ord ?? null,
  };
}

// Sort interne -> payload DB. Utilisé par l'éditeur.
export function spellToPayload(s) {
  return {
    key: s.key,
    name: s.name,
    name_en: s.name_en || null,
    icon: s.icon || '✨',
    color: s.color || '#8745d4',
    description: s.desc || '',
    description_en: s.desc_en || null,
    runes: s.runes || [],
    cost: Number(s.cost) || 0,
    targeted: !!s.targeted,
    face_pick: !!s.facePick,
    actions: s.actions || [],
    enabled: s.enabled !== false,
    ord: s.ord ?? null,
    updated_at: new Date().toISOString(),
  };
}

function rowsToCustom(rows) {
  return (rows || [])
    .filter((r) => r.enabled !== false && r.key && Array.isArray(r.runes) && r.runes.length)
    .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
    .map(rowToSpell);
}

function writeCache(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* quota */ }
}

// Boot synchrone : applique le cache des sorts custom (aucun réseau).
export function applyCachedSpells() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY));
    if (Array.isArray(cached)) setCustomSpells(cached);
  } catch { /* cache illisible */ }
}

// Récupère les sorts custom activés, les fusionne et met à jour le cache.
export async function refreshSpells() {
  const { data, error } = await supabase.from('quete_spells').select('*').order('ord', { ascending: true });
  if (error) throw error;
  const list = rowsToCustom(data);
  setCustomSpells(list);
  writeCache(list);
  return list.length;
}

// --- CRUD pour l'éditeur (lignes brutes, même désactivées) ---

export async function fetchSpellRows() {
  const { data, error } = await supabase.from('quete_spells').select('*').order('ord', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveSpellRow(spell, { isNew = false } = {}) {
  const payload = spellToPayload(spell);
  const q = isNew
    ? supabase.from('quete_spells').insert(payload)
    : supabase.from('quete_spells').update(payload).eq('key', payload.key);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

export async function deleteSpellRow(key) {
  const { error } = await supabase.from('quete_spells').delete().eq('key', key);
  if (error) throw error;
}
