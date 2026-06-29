import { useGameStore } from '../../store/gameStore';
import { EXTENSIONS, EXT_BY_ID, extOn } from '../../extensions/registry';
import { EXTENSION_IMG, COMING_SOON } from '../../data/extensionAssets';
import { useT } from '../../i18n';
import '../../styles/extensions.css';

// Petit maillon de chaîne gravé — marque une extension qui dépend d'une autre.
function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M8 11 6 13a3.2 3.2 0 0 0 4.5 4.5L12 16" />
      <path d="M16 13l2-2a3.2 3.2 0 0 0-4.5-4.5L12 8" />
    </svg>
  );
}

// Sélecteur des EXTENSIONS de la partie (modules activables) sous forme de
// galerie d'affiches : un clic active/désactive, le survol OU le focus (tactile)
// révèle l'explication de l'extension. Choisi au Setup, puis verrouillé en cours
// de jeu (toggleExtension ignore hors phase 'setup').
export default function ExtensionsChecklist() {
  const T = useT();
  const extensions = useGameStore((s) => s.extensions);
  const toggleExtension = useGameStore((s) => s.toggleExtension);

  return (
    <div>
      <div className="field-label" style={{ marginBottom: 4 }}>{T('setup.extensionsTitle')}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginBottom: 10 }}>
        {T('setup.extensionsHint')}
      </div>
      <div className="ext-gallery">
        {EXTENSIONS.map((ext) => {
          const on = extOn(extensions, ext.id);
          const img = EXTENSION_IMG[ext.id];
          const reqs = (ext.requires || []).map((rid) => EXT_BY_ID[rid]).filter(Boolean);
          return (
            <div
              key={ext.id}
              role="button"
              tabIndex={0}
              aria-pressed={on}
              aria-label={ext.name}
              className={`ext-card ${on ? 'is-on' : 'is-off'}`}
              onClick={() => toggleExtension(ext.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleExtension(ext.id);
                }
              }}
            >
              {img ? (
                <img className="ext-card__img" src={img} alt={ext.name} draggable={false} />
              ) : (
                <div
                  className="ext-card__img"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 56, background: 'linear-gradient(160deg,#3a2a14,#1c1408)',
                  }}
                >
                  {ext.icon}
                </div>
              )}

              <div className="ext-card__badge">{on ? '✓' : ''}</div>

              {reqs.length > 0 && (
                <div className="ext-card__dep">
                  <LinkIcon />
                  {reqs.map((r) => r.short || r.name).join(' + ')}
                </div>
              )}

              <div className="ext-card__desc">
                <div className="ext-card__desc-title">
                  <span>{ext.icon}</span>{ext.name}
                </div>
                <div className="ext-card__desc-text">{ext.desc}</div>
                {reqs.length > 0 && (
                  <div className="ext-card__desc-dep">
                    <LinkIcon />
                    {T('setup.extRequires')} {reqs.map((r) => `${r.icon} ${r.name}`).join(' + ')}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Extensions « À venir » : aperçu non sélectionnable (pas de clic). */}
        {COMING_SOON.map((cs) => {
          const img = EXTENSION_IMG[cs.id];
          const name = T.lang === 'en' ? (cs.name_en || cs.name) : cs.name;
          return (
            <div
              key={cs.id}
              className="ext-card is-soon"
              aria-disabled="true"
              aria-label={`${name} — ${T('setup.comingSoon')}`}
            >
              {img ? (
                <img className="ext-card__img" src={img} alt={name} draggable={false} />
              ) : (
                <div
                  className="ext-card__img"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, background: 'linear-gradient(160deg,#3a2a14,#1c1408)' }}
                >
                  {cs.icon}
                </div>
              )}
              <div className="ext-card__soon">{'🔒'} {T('setup.comingSoon')}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
