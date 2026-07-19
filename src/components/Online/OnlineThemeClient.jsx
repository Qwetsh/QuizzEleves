// Écran de CHOIX DES THÈMES côté joueur distant (jeu en ligne). Diffusé par
// l'hôte via la ligne de session (`status:'compose'`). Deux modes :
//  - composer : le joueur PROPOSE des cassettes (« pourquoi pas celle-là ? ») à
//               l'hôte, qui les prend s'il veut. Il voit les voies déjà choisies.
//  - surprise : lecture seule — l'hôte tire les thèmes au hasard ; on voit la
//               liste des thèmes bannis + un message d'attente.
import { useMemo, useState } from 'react';
import { themesToCassetteModel } from '../../logic/perimeter';
import { sendIntent, randomToken } from '../../logic/sessionConfig';

const FONT_UI = 'var(--font-ui)';
const FONT_MONO = 'var(--font-mono)';

export default function OnlineThemeClient({ code, token, compose }) {
  const mode = compose?.mode || 'composer';
  const voies = compose?.voies || [];
  const excluded = compose?.excluded || [];
  const model = useMemo(() => themesToCassetteModel(), []);
  const [suggested, setSuggested] = useState(() => new Set());
  const [openDom, setOpenDom] = useState(() => new Set(model.DOMAINS[0]?.id ? [model.DOMAINS[0].id] : []));

  const suggest = (item) => {
    if (suggested.has(item.id)) return;
    setSuggested((s) => new Set(s).add(item.id));
    sendIntent(code, token, 'suggestCassette', { themeId: item.id, label: item.label, uid: randomToken() }).catch(() => {});
  };
  const toggleDom = (id) => setOpenDom((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const domById = (id) => model.DOMAINS.find((d) => d.id === id);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#0b0e12', color: '#dff5e6', fontFamily: FONT_UI, padding: '18px 16px 40px' }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 22, color: '#66ff8a', fontWeight: 800 }}>🌐 Choix des thèmes</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 1, color: '#8b9096', marginTop: 2 }}>
            {mode === 'surprise' ? '🎲 MODE SURPRISE' : '📼 COMPOSITION EN COURS'} · {code}
          </div>
        </div>

        {/* Voies déjà choisies par l'hôte */}
        <div style={{ background: '#10231a', border: '1px solid #1d4a30', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#8fd9a6', marginBottom: 8, letterSpacing: 0.5 }}>VOIES DE LA PARTIE ({voies.length})</div>
          {voies.length === 0 ? (
            <div style={{ fontSize: 13.5, color: '#6f7b73' }}>Aucune voie choisie pour l’instant…</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {voies.map((v, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, background: v.color || '#2a4a22', color: '#fff', fontSize: 13, fontWeight: 700, border: '1px solid rgba(0,0,0,.35)' }}>
                  📼 {v.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {mode === 'surprise' ? (
          /* ---- Mode SURPRISE : lecture seule ---- */
          <div style={{ background: '#161a12', border: '1px solid #3a4a22', borderRadius: 12, padding: '16px 16px' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#e8d06a' }}>🎲 Thèmes tirés au hasard</div>
            <div style={{ fontSize: 13.5, color: '#b9c2a6', marginTop: 6, lineHeight: 1.5 }}>
              L’hôte a choisi le mode Surprise : les thèmes seront tirés au sort au lancement.
              Tu les découvriras sur le plateau — patiente&nbsp;!
            </div>
            {excluded.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12.5, color: '#8b9096', letterSpacing: 0.5, marginBottom: 7 }}>THÈMES ÉCARTÉS PAR L’HÔTE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {excluded.map((e) => (
                    <span key={e.key} style={{ padding: '4px 10px', borderRadius: 999, background: '#3a1713', color: '#e8a79a', fontSize: 12.5, textDecoration: 'line-through', border: '1px solid #6a2a22' }}>
                      {e.name || e.key}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 16, fontFamily: FONT_MONO, fontSize: 15, color: '#66ff8a', letterSpacing: 1 }}>
              ⏳ En attente du lancement par l’hôte…
            </div>
          </div>
        ) : (
          /* ---- Mode COMPOSER : proposer des cassettes ---- */
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#66ff8a', marginBottom: 4 }}>💡 Propose une cassette</div>
            <div style={{ fontSize: 13, color: '#8b9096', marginBottom: 12, lineHeight: 1.45 }}>
              « Pourquoi pas celle-là&nbsp;? » — tes propositions apparaissent chez l’hôte, qui décide de les insérer.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {model.GROUPS.map((g) => {
                const dom = domById(g.domain);
                const open = openDom.has(g.domain);
                return (
                  <div key={g.domain} style={{ background: '#10231a', border: '1px solid #1d4a30', borderRadius: 12, overflow: 'hidden' }}>
                    <button onClick={() => toggleDom(g.domain)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', background: 'transparent', border: 0, cursor: 'pointer', color: '#dff5e6', font: 'inherit' }}>
                      <span style={{ fontSize: 15 }}>{dom?.emblem || '●'}</span>
                      <span style={{ flex: 1, textAlign: 'left', fontWeight: 700, fontSize: 14, color: dom?.color || '#bfe0a8' }}>{dom?.name || g.domain}</span>
                      <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: '#6f7b73' }}>{g.items.length}</span>
                      <span style={{ color: '#6f7b73' }}>{open ? '▾' : '▸'}</span>
                    </button>
                    {open && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 12px 12px' }}>
                        {g.items.map((it) => {
                          const done = suggested.has(it.id);
                          const indent = (it.depth || 0) >= 2 ? { opacity: 0.9 } : null;
                          return (
                            <button key={it.id} onClick={() => suggest(it)} disabled={done}
                              style={{ ...indent, padding: '7px 12px', borderRadius: 999, cursor: done ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, font: 'inherit',
                                border: '1px solid ' + (done ? '#2a6a3a' : '#2f5a3a'),
                                background: done ? '#16351f' : '#183024',
                                color: done ? '#66ff8a' : '#cfe9d4' }}>
                              {it.type === 'integrale' ? '★ ' : ''}{it.label}{done ? ' ✓ proposé' : ''}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, textAlign: 'center', fontFamily: FONT_MONO, fontSize: 14, color: '#8b9096', letterSpacing: 1 }}>
              ⏳ L’hôte lance la partie quand il est prêt…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
