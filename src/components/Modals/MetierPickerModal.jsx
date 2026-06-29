import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { METIERS, metierName, metierTagline, metierDesc } from '../../logic/metier';
import ModalOverlay from './ModalOverlay';

// Choix du métier au 1er tour (extension « Métiers »), juste après le coffre de
// bienvenue. NON refusable et DÉFINITIF : l'équipe choisit forgeron / alchimiste
// / enchanteur et ne pratiquera plus que cet artisanat. Choix possible ici (TBI)
// ou depuis le téléphone du propriétaire (la modale se ferme alors d'elle-même).
export default function MetierPickerModal() {
  const T = useT();
  const lang = T.lang;
  const show = useGameStore((s) => s.showMetierPicker);
  const team = useGameStore((s) => s.teams[s.currentTeam]);
  const chooseMetier = useGameStore((s) => s.chooseMetier);

  if (!show || !team) return null;

  return (
    <AnimatePresence>
      {show && (
        <ModalOverlay className="max-w-2xl">
          <div style={{ padding: '24px 24px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>⚒️</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink-900)', marginTop: 8 }}>
              {T('modal.metier.title', { emoji: team.emoji, name: team.name })}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', marginTop: 4 }}>
              {T('modal.metier.choose')}
            </p>
          </div>

          <div style={{ padding: '12px 22px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {METIERS.map((m) => (
              <button
                key={m.id}
                onClick={() => chooseMetier(m.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6,
                  padding: '18px 14px', borderRadius: 18,
                  border: `2px solid ${m.color}66`, background: '#fffefb',
                  cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'all 120ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.background = `${m.color}11`; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${m.color}66`; e.currentTarget.style.background = '#fffefb'; e.currentTarget.style.transform = 'none'; }}
              >
                <span style={{
                  width: 60, height: 60, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, background: `linear-gradient(180deg, ${m.color}dd, ${m.color})`, color: '#fff',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -4px 0 rgba(0,0,0,0.18), 0 4px 0 rgba(0,0,0,0.2)',
                }}>
                  {m.icon}
                </span>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-900)' }}>{metierName(m, lang)}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: m.color }}>{metierTagline(m, lang)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.35 }}>{metierDesc(m, lang)}</div>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--ink-400)', textAlign: 'center', padding: '0 24px 18px' }}>
            {T('modal.metier.locked')}
          </p>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
