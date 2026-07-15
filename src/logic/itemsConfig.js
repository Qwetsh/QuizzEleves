// Chargement et édition des objets depuis Supabase (table public.quete_items) —
// source de vérité éditable in-game. Même stratégie offline-safe que les
// questions : au boot on applique le cache (synchrone), puis on rafraîchit
// depuis Supabase. Fallback ultime : les objets du code (BASE_ITEMS).
import { supabase } from './supabaseClient.js';
import { setItemsData } from '../data/items.js';

// v2 : schéma d'effets étendu (dés, valeurs à l'échelle, déclencheurs) — bumper
// cette clé invalide les anciens caches au format périmé.
const LS_KEY = 'quete_items_v2';
const BUCKET = 'quete-items';

// Ligne DB -> objet interne du jeu (clés en camelCase, lootOnly).
function rowToItem(r) {
  return {
    name: r.name,
    // Variantes anglaises (Phase C i18n) : lues par locName/locDesc et
    // itemEffectLines selon la langue ; repli FR géré côté affichage.
    name_en: r.name_en ?? undefined,
    desc_en: r.description_en ?? undefined,
    descExpert_en: r.desc_expert_en ?? undefined,
    desc: r.description ?? '',
    descExpert: r.desc_expert ?? '',
    set: r.set_key ?? undefined,
    icon: r.icon ?? undefined,
    img: r.img ?? undefined,
    slot: r.slot,
    rarity: r.rarity,
    price: r.price,
    lootOnly: !!r.loot_only,
    // Gating par matière (OR) : l'objet n'est lootable / en boutique que si au
    // moins une de ces matières est active. Absent/[] = toujours disponible.
    requiresSubjects: Array.isArray(r.requires_subjects) && r.requires_subjects.length ? r.requires_subjects : undefined,
    // Gating par extension (ET) : l'objet n'existe dans la partie que si TOUTES
    // ces extensions sont actives. Absent/[] = toujours disponible.
    requiresExtensions: Array.isArray(r.requires_extensions) && r.requires_extensions.length ? r.requires_extensions : undefined,
    effects: Array.isArray(r.effects) ? r.effects : [],
    // Alchimie / Enchantement : sous-famille de consommable + effet de parchemin.
    family: r.family || undefined,
    enchant: r.enchant || undefined,
    // Parchemin VIERGE (matière première de l'Autel du Scribe) : pas de colonne
    // dédiée en DB → on le DÉRIVE. Un parchemin est « vierge » s'il n'a aucun
    // effet fixe (`enchant`) ni n'est lootOnly : le vierge s'achète et se grave,
    // le gravé est lootOnly, et un parchemin pré-fait (éditeur) porte un enchant.
    blank: r.family === 'parchment' && !r.enchant && !r.loot_only ? true : undefined,
  };
}

// Objet interne -> payload DB (snake_case). Utilisé par l'éditeur.
export function itemToPayload(it) {
  return {
    key: it.key,
    name: it.name,
    name_en: it.name_en || null,
    description: it.desc || null,
    description_en: it.desc_en || null,
    desc_expert: it.descExpert || null,
    desc_expert_en: it.descExpert_en || null,
    set_key: it.set || null,
    icon: it.icon || null,
    img: it.img || null,
    slot: it.slot,
    rarity: it.rarity,
    price: it.price,
    loot_only: !!it.lootOnly,
    requires_subjects: (Array.isArray(it.requiresSubjects) && it.requiresSubjects.length) ? it.requiresSubjects : null,
    requires_extensions: (Array.isArray(it.requiresExtensions) && it.requiresExtensions.length) ? it.requiresExtensions : null,
    effects: it.effects || [],
    family: it.family || null,
    enchant: it.enchant || null,
    enabled: it.enabled !== false,
    ord: it.ord ?? null,
    updated_at: new Date().toISOString(),
  };
}

function rowsToItems(rows) {
  const items = {};
  rows.filter((r) => r.enabled !== false)
    .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
    .forEach((r) => { items[r.key] = rowToItem(r); });
  return items;
}

function writeCache(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* quota */ }
}

// Boot synchrone : applique le cache s'il existe (sinon on garde les objets du
// code). Aucun appel réseau.
export function applyCachedItems() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY));
    if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return;
    const items = Object.values(cached);
    // N'applique le cache que s'il est bien formé (sinon on garde le fallback
    // = objets du code), pour ne pas casser l'affichage avec un schéma périmé.
    if (items.length && items.every((it) => it && it.slot && it.rarity && Array.isArray(it.effects))) setItemsData(cached);
  } catch { /* cache illisible */ }
}

// Récupère TOUTES les lignes par pages de 1000 (PostgREST/Supabase plafonne à
// 1000 lignes par requête — indispensable avec ~1300 objets dont 1140 potions).
async function fetchAllItemRows() {
  const PAGE = 1000;
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('quete_items').select('*').order('ord', { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

// Récupère les objets activés, remplace le catalogue et met à jour le cache.
export async function refreshItems() {
  const data = await fetchAllItemRows();
  if (!data.length) return 0;        // base vide : on garde le fallback
  const items = rowsToItems(data);
  if (!Object.keys(items).length) return 0;
  setItemsData(items);
  writeCache(items);
  return Object.keys(items).length;
}

// --- CRUD pour l'éditeur (lignes brutes, tous les objets même désactivés) ---

export async function fetchItemRows() {
  return fetchAllItemRows();
}

// isNew=true → INSERT (la contrainte de clé primaire rejette une collision,
// au lieu d'écraser silencieusement un objet existant) ; sinon UPDATE par clé.
export async function saveItemRow(item, { isNew = false } = {}) {
  const payload = itemToPayload(item);
  const q = isNew
    ? supabase.from('quete_items').insert(payload)
    : supabase.from('quete_items').update(payload).eq('key', payload.key);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

export async function deleteItemRow(key) {
  const { error } = await supabase.from('quete_items').delete().eq('key', key);
  if (error) throw error;
}

// Upload d'une image dans le bucket Storage public, renvoie l'URL publique.
export async function uploadItemImage(file, key) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${key || 'item'}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
