import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ITEMS, SLOTS, RARITIES } from '../../data/items';
import { itemImg } from '../../logic/itemAssets';
import { locName } from '../../i18n/content';

const GROUPS = [
  { slot: 'head', label: `${SLOTS.head.icon} Coiffes` },
  { slot: 'body', label: `${SLOTS.body.icon} Armures` },
  { slot: 'feet', label: `${SLOTS.feet.icon} Amulettes` },
  { slot: 'consumable', label: '🧳 Consommables' },
];

export default function ItemsChecklist() {
  const enabledItems = useGameStore((s) => s.enabledItems);
  const toggleItem = useGameStore((s) => s.toggleItem);
  const setAllItems = useGameStore((s) => s.setAllItems);
  const [open, setOpen] = useState(false);

  // Les items d'alchimie (ingrédients/potions) et parchemins se gèrent dans
  // l'éditeur (onglet Alchimie) : on les exclut de cette checklist (sinon 1100+
  // potions la noieraient). On ne liste ici que l'équipement + consommables purs.
  const allKeys = Object.keys(ITEMS).filter((k) => !ITEMS[k].family);
  const allChecked = allKeys.every((k) => enabledItems.includes(k));

  return (
    <div>
      <div className="flex items-center justify-between mb-2 cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="field-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-400)', transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>{'▶'}</span>
          {`Objets (${enabledItems.filter((k) => allKeys.includes(k)).length}/${allKeys.length})`}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setAllItems(!allChecked); }}
          style={{ fontSize: 12, color: 'var(--gold-600)', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 600 }}
        >
          {allChecked ? 'Tout décocher' : 'Tout cocher'}
        </button>
      </div>

      {open && GROUPS.map(({ slot, label }) => (
        <div key={slot} style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--ink-500)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            margin: '6px 0 4px', paddingBottom: 2,
            borderBottom: '1px solid rgba(122,94,58,0.15)',
          }}>
            {label}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {allKeys.filter((k) => ITEMS[k].slot === slot).map((key) => {
              const item = ITEMS[key];
              const on = enabledItems.includes(key);
              const rarityColor = RARITIES[item.rarity]?.color || '#888';
              return (
                <div
                  key={key}
                  onClick={() => toggleItem(key)}
                  className="flex items-start gap-2.5 cursor-pointer select-none"
                  style={{ padding: '6px 8px', borderRadius: 8 }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(232, 169, 88, 0.12)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div
                    style={{
                      width: 18, height: 18, borderRadius: 5,
                      background: on ? 'var(--gold-600)' : '#fffefb',
                      border: `2px solid ${on ? 'var(--gold-700)' : 'var(--ink-400)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 14, flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {on ? '✓' : ''}
                  </div>
                  <div className="min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {itemImg(item)
                          ? <img src={itemImg(item)} alt="" style={{ width: 18, height: 18, objectFit: 'contain', verticalAlign: 'middle' }} />
                          : <span>{item.icon}</span>}
                        {locName(item)}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: rarityColor,
                        border: `1px solid ${rarityColor}66`, background: `${rarityColor}14`,
                        padding: '0 5px', borderRadius: 5,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}>
                        {RARITIES[item.rarity]?.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-500)', lineHeight: 1.35, marginTop: 1 }}>
                      {item.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
