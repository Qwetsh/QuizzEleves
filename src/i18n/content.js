// Helpers de localisation du CONTENU (données portant des variantes *_en) :
// objets, pouvoirs, événements, sets, matières. Renvoie la variante EN si la
// langue courante est l'anglais ET qu'elle existe, sinon repli FR.
// Ex. `locName(POWERS.bouclier)` → 'Shield' en EN, 'Bouclier' en FR.
import { getLang } from './lang.js';

export const locName = (e, lang = getLang()) =>
  (lang === 'en' ? (e?.name_en || e?.name) : e?.name) ?? '';

// Description : tolère `desc` (code) et `description` (DB).
export const locDesc = (e, lang = getLang()) =>
  (lang === 'en'
    ? (e?.desc_en ?? e?.description_en ?? e?.desc ?? e?.description)
    : (e?.desc ?? e?.description)) ?? '';

// Champ générique localisé : `loc(e, 'biome')` → e.biome_en || e.biome.
export const loc = (e, field, lang = getLang()) =>
  (lang === 'en' ? (e?.[`${field}_en`] ?? e?.[field]) : e?.[field]) ?? '';
