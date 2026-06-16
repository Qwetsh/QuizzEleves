// Choix de duel (mode « duels non forcés ») : quand une équipe arrive sur une
// case occupée, ELLE décide de défier (et qui, parmi les équipes présentes) ou
// de refuser — auquel cas elle joue la case normalement. Cf. gameStore
// (handleLanding → showDuelChoice, chooseDuel/declineDuel).
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import ModalOverlay from './ModalOverlay';
import { soundClick } from '../../logic/sounds';

export default function DuelChoiceModal() {
  const dc = useGameStore((s) => s.showDuelChoice);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const chooseDuel = useGameStore((s) => s.chooseDuel);
  const declineDuel = useGameStore((s) => s.declineDuel);

  const arriver = teams[currentTeam];
  const subj = dc ? SUBJECTS[dc.subject] : null;

  return (
    <AnimatePresence>
      {dc && arriver && (
        <ModalOverlay className="max-w-md" onClose={() => { soundClick(); declineDuel(); }}>
          <div style={{ padding: '24px 24px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 6 }}>⚔️</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink-900)', margin: '0 0 4px' }}>
              {arriver.emoji} {arriver.name}, un duel ?
            </h2>
            <p style={{ fontSize: 14, color: 'var(--ink-600)', margin: '0 0 16px' }}>
              Tu arrives sur une case occupée.{subj ? <> Duel en <strong style={{ color: subj.color }}>{subj.icon} {subj.name}</strong>.</> : ''} Qui veux-tu défier ?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {dc.defenders.map((i) => {
                const t = teams[i];
                if (!t) return null;
                return (
                  <motion.button
                    key={i}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { soundClick(); chooseDuel(i); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px', borderRadius: 14, cursor: 'pointer',
                      border: `2px solid ${t.color}`,
                      background: `linear-gradient(180deg, ${t.color}22, #fffefb)`,
                      fontFamily: 'var(--font-ui)', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 40, height: 40, flexShrink: 0, borderRadius: 12, fontSize: 22,
                      display: 'grid', placeItems: 'center',
                      background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                    }}>{t.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 17, color: t.color }}>{t.name}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)' }}>
                        {t.money ?? 0} 🪙 · {t.correct ?? 0} ✓
                      </span>
                    </span>
                    <span style={{ fontSize: 20 }}>⚔️</span>
                  </motion.button>
                );
              })}

              {/* Équipes présentes mais IMMUNISÉES : affichées grisées, non sélectionnables */}
              {(dc.blocked || []).map((i) => {
                const t = teams[i];
                if (!t) return null;
                return (
                  <div
                    key={`b-${i}`}
                    title={`${t.name} est immunisé(e) aux duels`}
                    aria-disabled="true"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px', borderRadius: 14,
                      border: '2px dashed rgba(122,94,58,0.35)',
                      background: 'rgba(122,94,58,0.06)',
                      opacity: 0.55, cursor: 'not-allowed', filter: 'grayscale(0.7)',
                    }}
                  >
                    <span style={{
                      width: 40, height: 40, flexShrink: 0, borderRadius: 12, fontSize: 22,
                      display: 'grid', placeItems: 'center',
                      background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`,
                    }}>{t.emoji}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-700)' }}>{t.name}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-500)' }}>🛡️ Immunisé — impossible à défier</span>
                    </span>
                    <span style={{ fontSize: 20 }}>🛡️</span>
                  </div>
                );
              })}
            </div>

            <button
              className="btn btn--ghost"
              style={{ width: '100%' }}
              onClick={() => { soundClick(); declineDuel(); }}
            >
              🤝 Non, je joue la case
            </button>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
