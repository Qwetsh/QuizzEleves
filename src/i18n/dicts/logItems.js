// Journal de partie — messages localisés (FR/EN) pour itemHandlers.js.
// Clés namespacées log.it.* ; vars interpolées via {x}.
export default {
  // --- Achat / revente (boutique, sac) ---
  'log.it.buyEquip':  { fr: '🛒 {emoji} {name} équipe {icon} {item} ! (-{price} 💰)',
                        en: '🛒 {emoji} {name} equips {icon} {item}! (-{price} 💰)' },
  'log.it.buy':       { fr: '🛒 {emoji} {name} achète {icon} {item} ! (-{price} 💰)',
                        en: '🛒 {emoji} {name} buys {icon} {item}! (-{price} 💰)' },
  'log.it.sell':      { fr: '♻️ {emoji} {name} revend {icon} {item} (+{refund} 💰).',
                        en: '♻️ {emoji} {name} sells {icon} {item} (+{refund} 💰).' },

  // --- Drag & drop d'inventaire ---
  'log.it.equip':     { fr: '🎒 {emoji} {name} équipe {icon} {item} !',
                        en: '🎒 {emoji} {name} equips {icon} {item}!' },
  'log.it.stow':      { fr: '🎒 {emoji} {name} range {icon} {item} dans le sac.',
                        en: '🎒 {emoji} {name} stows {icon} {item} in the bag.' },

  // --- Attribution (loot, butin) ---
  'log.it.grantEquip':    { fr: '🎁 {emoji} {name} équipe {icon} {item} ({slot}) !',
                            en: '🎁 {emoji} {name} equips {icon} {item} ({slot})!' },
  'log.it.grantRefunded': { fr: '🎒 Sac plein ! {icon} {item} est revendu (+{refund} 💰).',
                            en: '🎒 Bag full! {icon} {item} is sold off (+{refund} 💰).' },
  'log.it.grantBag':      { fr: '🎁 {emoji} {name} obtient {icon} {item} !',
                            en: '🎁 {emoji} {name} obtains {icon} {item}!' },

  // --- Consommables ---
  'log.it.noPieceToEnchant': { fr: '📜 {emoji} {name} : aucune pièce équipée à enchanter !',
                               en: '📜 {emoji} {name}: no equipped piece to enchant!' },
  'log.it.use':              { fr: '{icon} {emoji} {name} utilise {item} !',
                               en: '{icon} {emoji} {name} uses {item}!' },
  'log.it.useCancelled':     { fr: '↩️ {icon} {item} : choix de cible annulé, l\'objet est rendu.',
                               en: '↩️ {icon} {item}: target selection cancelled, item returned.' },
  'log.it.consumablesBlocked': { fr: ['🚫 {emoji} {name} : consommables bloqués ({n} tour) !', '🚫 {emoji} {name} : consommables bloqués ({n} tours) !'],
                                 en: ['🚫 {emoji} {name}: consumables blocked ({n} turn)!', '🚫 {emoji} {name}: consumables blocked ({n} turns)!'] },
  'log.it.gambleFail':       { fr: '💨 {item} : raté, aucun effet cette fois…',
                               en: '💨 {item}: missed, no effect this time…' },
  'log.it.gambleFail.toast': { fr: 'Raté ! {item} n\'a rien fait',
                               en: 'Missed! {item} did nothing' },
  'log.it.noEffect':         { fr: '💨 {item} n\'a eu aucun effet.',
                               en: '💨 {item} had no effect.' },
  'log.it.noEffect.toast':   { fr: '{item} : aucun effet',
                               en: '{item}: no effect' },

  // --- Enchantement ---
  'log.it.enchant':   { fr: '📜 {emoji} {name} enchante {icon} {item} ({slot}) avec {parch} !',
                        en: '📜 {emoji} {name} enchants {icon} {item} ({slot}) with {parch}!' },
  'log.it.inscribe':  { fr: '✒️ {emoji} {name} grave un parchemin d\'enchantement ({cost} or).',
                        en: '✒️ {emoji} {name} inscribes an enchantment scroll ({cost} gold).' },

  // --- Alchimie (distillation) ---
  'log.it.craft':          { fr: '⚗️ {emoji} {name} distille {icon} {potion} !',
                             en: '⚗️ {emoji} {name} distills {icon} {potion}!' },
  'log.it.craft.discovered': { fr: ' ✨ Recette découverte !',
                               en: ' ✨ Recipe discovered!' },
  'log.it.craftFail':      { fr: '💨 {emoji} {name} : distillation ratée (eau trouble).',
                             en: '💨 {emoji} {name}: distillation failed (murky water).' },
  'log.it.craftFull':      { fr: '🎒 {emoji} {name} : sac plein, fusion annulée (libère une place).',
                             en: '🎒 {emoji} {name}: bag full, fusion cancelled (free a slot).' },
};
