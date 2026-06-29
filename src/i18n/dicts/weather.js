// Événements de terrain (« météo ») — textes du journal (log.weather.*) et de
// l'UI TBI (weather.*). Les noms/descriptions des météos elles-mêmes vivent dans
// src/data/weather.js (bilingues) ; ici, les messages générés au runtime.
export default {
  // --- Journal (addLog) ---
  'log.weather.announce': { fr: '{icon} {name} approche…', en: '{icon} {name} is coming…' },
  'log.weather.vent': { fr: '{icon} {name} : déplacements {factor} pendant {n} tour(s).', en: '{icon} {name}: movement {factor} for {n} turn(s).' },
  'log.weather.ventEnd': { fr: '🌬️ Le vent retombe.', en: '🌬️ The wind dies down.' },
  'log.weather.soleil': { fr: '☀️ Soleil puissant : chaque équipe recharge un pouvoir.', en: '☀️ Blazing sun: every team recharges a power.' },
  'log.weather.orage': { fr: '⛈️ Orage : la foudre s’abat sur le plateau !', en: '⛈️ Thunderstorm: lightning strikes the board!' },
  'log.weather.pluieAcide': { fr: '🌧️ Pluie acide : l’équipement se corrode.', en: '🌧️ Acid rain: equipment corrodes.' },
  'log.weather.seisme': { fr: '🌍 Tremblement de terre : le plateau est secoué !', en: '🌍 Earthquake: the board is shaken!' },
  'log.weather.pluieMaudite': { fr: '🌧️ Pluie maudite : une malédiction frappe tout le monde !', en: '🌧️ Cursed rain: a curse strikes everyone!' },
  'log.weather.curse.loseGold': { fr: '🌧️ …l’or se dissout dans la pluie.', en: '🌧️ …gold dissolves in the rain.' },
  'log.weather.curse.blockShop': { fr: '🌧️ …les boutiques ferment leurs portes (achats bloqués).', en: '🌧️ …shops shut their doors (purchases blocked).' },
  'log.weather.curse.timer': { fr: '🌧️ …le temps se dérègle et les réponses dansent.', en: '🌧️ …time warps and answers dance around.' },
  'log.weather.shopBlocked': { fr: ['🔒 {emoji} {name} : boutique fermée (encore {n} tour).', '🔒 {emoji} {name} : boutique fermée (encore {n} tours).'], en: ['🔒 {emoji} {name}: shop closed ({n} more turn).', '🔒 {emoji} {name}: shop closed ({n} more turns).'] },
  'log.weather.shopUnblocked': { fr: '🔓 {emoji} {name} peut à nouveau acheter.', en: '🔓 {emoji} {name} can buy again.' },
  // Notes de détail (volet dépliable du journal)
  'log.weather.note.recharge': { fr: 'recharge', en: 'recharge' },
  'log.weather.note.recul': { fr: 'recul', en: 'pushback' },
  'log.weather.note.lostEquip': { fr: 'équipement corrodé', en: 'equipment corroded' },
  'log.weather.note.lostGold': { fr: 'or corrodé', en: 'gold corroded' },
  'log.weather.note.unaffected': { fr: 'épargnée', en: 'spared' },
  'log.weather.note.shaken': { fr: 'secouée', en: 'shaken' },

  // --- UI TBI ---
  'weather.banner.turns': { fr: ['{icon} {name} — {n} tour restant', '{icon} {name} — {n} tours restants'], en: ['{icon} {name} — {n} turn left', '{icon} {name} — {n} turns left'] },
  'weather.banner.soon': { fr: '{icon} {name} approche…', en: '{icon} {name} incoming…' },
  'weather.overlay.preavis': { fr: 'Préavis', en: 'Forecast' },
};
