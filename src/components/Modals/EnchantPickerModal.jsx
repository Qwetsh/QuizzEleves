import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { ITEMS, SLOTS } from '../../data/items';
import { itemKeyOf } from '../../logic/itemEffects';
import { cellKey } from '../../store/itemHandlers';
import ModalOverlay from './ModalOverlay';

// Sélecteur de pièce à enchanter (parchemin). On choisit l'emplacement équipé
// qui recevra l'effet du parchemin (extension « enchant »).
export default function EnchantPickerModal() {
  const picker = useGameStore((s) => s.showEnchantPicker);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const chooseEnchantSlot = useGameStore((s) => s.chooseEnchantSlot);
  const cancelEnchant = useGameStore((s) => s.cancelEnchant);

  if (!picker) return null;
  const team = teams[currentTeam];
  const bag = team?.bag || [];
  const parch = ITEMS[cellKey(bag[picker.bagIndex])];
  if (!parch) return null;

  return (
    <AnimatePresence>
      {picker && (
        <ModalOverlay onClose={cancelEnchant} className="max-w-sm">
          <div style={{ padding: '24px 24px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 44 }}>{'📜'}</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-900)' }}>{parch.name}</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-600)', marginTop: 4 }}>{parch.desc}</p>
            <p style={{ fontSize: 14, color: 'var(--ink-700)', marginTop: 10, fontWeight: 700 }}>Sur quelle pièce ?</p>
          </div>
          <div style={{ padding: '8px 22px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(picker.slots || []).map((slot) => {
              const key = itemKeyOf(team.equipment?.[slot]);
              const it = ITEMS[key];
              if (!it) return null;
              return (
                <button key={slot} onClick={() => chooseEnchantSlot(slot)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, textAlign: 'left',
                    border: '2px solid rgba(122,94,58,0.3)', background: '#fffefb', cursor: 'pointer', fontFamily: 'var(--font-ui)',
                  }}>
                  <span style={{ fontSize: 26 }}>{it.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-900)' }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{SLOTS[slot]?.name}</div>
                  </div>
                  <span style={{ fontSize: 18 }}>{'✨'}</span>
                </button>
              );
            })}
            <button onClick={cancelEnchant} style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--ink-500)', fontFamily: 'var(--font-ui)', fontSize: 14, cursor: 'pointer', padding: 8 }}>Annuler</button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
