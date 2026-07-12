// Chargement et édition des ÉVÉNEMENTS PERSONNALISÉS depuis Supabase
// (table public.quete_events). Mêmes principes offline-safe que les objets :
// cache localStorage appliqué au boot (synchrone), puis rafraîchissement réseau.
// Les événements personnalisés sont FUSIONNÉS par-dessus les événements intégrés
// (code) via setCustomEvents — les intégrés restent toujours présents.
import { supabase } from './supabaseClient.js';
import { setCustomEvents } from '../data/events.js';

const LS_KEY = 'quete_events_v1';

// Ligne DB -> événement interne (clés camelCase).
function rowToEvent(r) {
  return {
    name: r.name,
    name_en: r.name_en ?? undefined,
    desc_en: r.description_en ?? undefined,
    icon: r.icon || '✨',
    desc: r.description || '',
    optional: r.optional !== false,
    weight: typeof r.weight === 'number' ? r.weight : 1,
    category: r.category || undefined,
    needsItems: !!r.needs_items,
    tone: r.tone || undefined,
    params: (r.params && typeof r.params === 'object') ? r.params : undefined,
    actions: Array.isArray(r.actions) ? r.actions : [],
    custom: true, // marqueur : événement personnalisé (vs intégré)
  };
}

// Événement interne -> payload DB (snake_case). Utilisé par l'éditeur.
export function eventToPayload(ev) {
  return {
    key: ev.key,
    name: ev.name,
    name_en: ev.name_en || null,
    icon: ev.icon || '✨',
    description: ev.desc || null,
    description_en: ev.desc_en || null,
    optional: ev.optional !== false,
    weight: typeof ev.weight === 'number' ? ev.weight : 1,
    category: ev.category || null,
    needs_items: !!ev.needsItems,
    tone: ev.tone || null,
    params: (ev.params && typeof ev.params === 'object') ? ev.params : null,
    actions: ev.actions || [],
    enabled: ev.enabled !== false,
    ord: ev.ord ?? null,
    updated_at: new Date().toISOString(),
  };
}

function rowsToCustom(rows) {
  const map = {};
  (rows || []).filter((r) => r.enabled !== false)
    .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
    .forEach((r) => { if (r.key) map[r.key] = rowToEvent(r); });
  return map;
}

function writeCache(map) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch { /* quota */ }
}

// Boot synchrone : applique le cache des événements custom (aucun réseau).
export function applyCachedEvents() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY));
    if (cached && typeof cached === 'object' && !Array.isArray(cached)) setCustomEvents(cached);
  } catch { /* cache illisible */ }
}

// Récupère les événements custom activés, les fusionne et met à jour le cache.
// Retourne le nombre d'événements custom chargés.
export async function refreshEvents() {
  const { data, error } = await supabase.from('quete_events').select('*').order('ord', { ascending: true });
  if (error) throw error;
  const map = rowsToCustom(data);
  setCustomEvents(map);
  writeCache(map);
  return Object.keys(map).length;
}

// --- CRUD pour l'éditeur (lignes brutes, même désactivées) ---

export async function fetchEventRows() {
  const { data, error } = await supabase.from('quete_events').select('*').order('ord', { ascending: true });
  if (error) throw error;
  return data || [];
}

// isNew → INSERT (rejette une collision de clé) ; sinon UPDATE par clé.
export async function saveEventRow(ev, { isNew = false } = {}) {
  const payload = eventToPayload(ev);
  const q = isNew
    ? supabase.from('quete_events').insert(payload)
    : supabase.from('quete_events').update(payload).eq('key', payload.key);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

export async function deleteEventRow(key) {
  const { error } = await supabase.from('quete_events').delete().eq('key', key);
  if (error) throw error;
}
