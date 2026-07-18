// Spots Curioscope (table quete_spots) — même pattern que categoriesConfig :
// cache localStorage appliqué en synchrone au boot (offline-safe), refresh
// Supabase en arrière-plan. Les spots alimentent les univers fictifs du
// mini-jeu guessr (src/data/universes.js) ; sans spots chargés, les duels
// de ces thèmes retombent sur le duel générique (garde-fou getMinigame).
import { supabase } from './supabaseClient';
import { setCurioSpots, spotImageUrl } from '../data/universes';

const LS_KEY = 'quete_spots_v1';

// Lignes DB → spots par univers, au format attendu par pickSpot/Curioscope.
export function rowsToSpots(rows) {
  const by = {};
  for (const r of rows || []) {
    if (r.actif === false) continue;
    const cx = Number(r.cx);
    const cy = Number(r.cy);
    if (!(cx >= 0 && cx <= 1 && cy >= 0 && cy <= 1)) continue;
    (by[r.universe] ||= []).push({
      id: `s${r.id}`,
      label: r.label || r.zone || '?',
      zone: r.zone || '',
      x: cx, y: cy,
      kind: 'photo',
      image: spotImageUrl(r.image_path),
      render: r.render || 'flat',
      difficulte: r.difficulte ?? 3,
    });
  }
  return by;
}

export function applyCachedSpots() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY));
    if (cached && typeof cached === 'object' && !Array.isArray(cached)) setCurioSpots(cached);
  } catch { /* cache absent/corrompu : univers fictifs vides, repli géré */ }
}

export async function refreshSpots() {
  const { data, error } = await supabase
    .from('quete_spots')
    .select('id, universe, label, zone, cx, cy, image_path, render, difficulte, actif')
    .eq('actif', true);
  if (error) throw error;
  const by = rowsToSpots(data);
  setCurioSpots(by);
  try { localStorage.setItem(LS_KEY, JSON.stringify(by)); } catch { /* quota */ }
  return (data || []).length;
}
