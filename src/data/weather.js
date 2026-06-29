// ============================================================
//  Catalogue des ÉVÉNEMENTS DE TERRAIN (« météo ») — extension `weather`.
//
//  Une météo est GLOBALE : elle s'applique à tout le plateau et à toutes les
//  équipes à la fois (≠ case-événement qui ne frappe qu'une équipe). Une seule
//  météo active à la fois (lisibilité TBI).
//
//  Deux natures :
//   - 'ambient'  : modifie le jeu pendant X tours (ex. vent contraire ÷ le
//                  déplacement). Pose un état `weather` persistant + bandeau.
//   - 'instant'  : se résout UNE fois en cérémonie (overlay), puis disparaît.
//
//  Ce fichier ne porte que les MÉTADONNÉES d'affichage + la nature + la clé de
//  résolveur (`special`). Les VALEURS (durées, facteurs, poids, montants) sont
//  dans balanceConfig.WEATHER (éditable, zéro valeur en dur). La résolution
//  vit dans src/store/weatherHandlers.js.
//
//  Thème-agnostique → aucune incidence sur le verrou « analyse = scolaire only ».
// ============================================================

export const WEATHERS = {
  ventContraire: {
    icon: '🌬️', nature: 'ambient', special: 'vent', dir: 'contraire', preavis: false,
    name: { fr: 'Vent contraire', en: 'Headwind' },
    desc: { fr: 'Les déplacements sont réduits pour tout le monde.', en: 'Everyone moves less.' },
    tone: 'malus',
  },
  ventArriere: {
    icon: '🌬️', nature: 'ambient', special: 'vent', dir: 'arriere', preavis: false,
    name: { fr: 'Vent arrière', en: 'Tailwind' },
    desc: { fr: 'Les déplacements sont amplifiés pour tout le monde.', en: 'Everyone moves more.' },
    tone: 'buff',
  },
  soleil: {
    icon: '☀️', nature: 'instant', special: 'soleil', preavis: false,
    name: { fr: 'Soleil puissant', en: 'Blazing sun' },
    desc: { fr: 'Chaque équipe recharge un pouvoir.', en: 'Every team recharges a power.' },
    tone: 'buff',
  },
  orage: {
    icon: '⛈️', nature: 'instant', special: 'orage', preavis: true,
    name: { fr: 'Orage', en: 'Thunderstorm' },
    desc: { fr: 'La foudre frappe des cases au hasard ; les équipes touchées reculent.', en: 'Lightning strikes random tiles; teams hit are pushed back.' },
    tone: 'malus',
  },
  pluieAcide: {
    icon: '🌧️', nature: 'instant', special: 'pluieAcide', preavis: true,
    name: { fr: 'Pluie acide', en: 'Acid rain' },
    desc: { fr: 'Chaque équipe perd un équipement (ou de l’or si elle n’en porte pas).', en: 'Each team loses a piece of equipment (or gold if none).' },
    tone: 'malus',
  },
  seisme: {
    icon: '🌍', nature: 'instant', special: 'seisme', preavis: true,
    name: { fr: 'Tremblement de terre', en: 'Earthquake' },
    desc: { fr: 'Le sol tremble : tous les pions sont secoués dans tous les sens.', en: 'The ground shakes: every pawn is jolted around.' },
    tone: 'malus',
  },
  pluieMaudite: {
    icon: '🌧️', nature: 'instant', special: 'pluieMaudite', preavis: true,
    name: { fr: 'Pluie maudite', en: 'Cursed rain' },
    desc: { fr: 'Une malédiction tirée au hasard frappe tout le monde.', en: 'A random curse strikes everyone.' },
    tone: 'malus',
  },
};

export const WEATHER_KEYS = Object.keys(WEATHERS);

const pick = (obj, lang) => (lang === 'en' ? (obj?.en ?? obj?.fr) : obj?.fr) || '';
export function weatherName(id, lang = 'fr') { return pick(WEATHERS[id]?.name, lang); }
export function weatherDesc(id, lang = 'fr') { return pick(WEATHERS[id]?.desc, lang); }
export function weatherIcon(id) { return WEATHERS[id]?.icon || '🌦️'; }
