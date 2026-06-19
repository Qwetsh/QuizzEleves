import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { SUBJECTS, SUBJECT_KEYS } from '../../data/subjects';
import ModalOverlay from './ModalOverlay';

// Sélecteur de thème : choix de la matière pour une relance de question « au choix ».
export default function SubjectPickerModal() {
  const T = useT();
  const showSubjectPicker = useGameStore((s) => s.showSubjectPicker);
  const selectSubject = useGameStore((s) => s.selectSubject);

  return (
    <AnimatePresence>
      {showSubjectPicker && (
        <ModalOverlay className="max-w-sm">
          <div style={{ padding: '24px 24px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 34 }}>🔄</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginTop: 4 }}>{T('modal.subject.title')}</h2>
            <p style={{ fontSize: 13, color: 'var(--ink-600)', marginTop: 4 }}>{T('modal.subject.sub')}</p>
          </div>
          <div style={{ padding: '12px 22px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {SUBJECT_KEYS.map((key) => {
              const s = SUBJECTS[key] || {};
              return (
                <button
                  key={key}
                  onClick={() => selectSubject(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    border: `2px solid ${s.color || '#b89a5e'}`,
                    background: `linear-gradient(180deg, ${s.color || '#b89a5e'}22, #fffefb)`,
                    fontFamily: 'var(--font-ui)', fontWeight: 600, color: 'var(--ink-800)',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{s.icon}</span>
                  <span>{s.name || key}</span>
                </button>
              );
            })}
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
