// Éditeur de questions in-game (outil DEV) — CRUD sur la table Supabase
// quete_questions. Navigation par ARBRE DE THÈMES (domaine → thème → sous-thème,
// cf. quete_themes/ltree) + bac « Hors arbre » pour les subjects orphelins.
// Difficulté en 3 paliers (Amateur/Connaisseur/Expert, adossés à `difficulte` 1-5)
// et `generalite` en second axe. `level` (6e-3e) et `pool` (brevet) : scolaire only.
// Voir DESIGN_QUESTIONS_V2.md.
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SUBJECTS } from '../../data/subjects';
import {
  THEMES, THEME_ROOTS, childrenOf, isLeaf, descendantLeaves, pathOf,
} from '../../data/themes';
import {
  fetchQuestionRows, saveQuestionRow, deleteQuestionRow, refreshQuestions,
} from '../../logic/questionsConfig';
import { useGameStore } from '../../store/gameStore';
import ThemesEditor from './ThemesEditor';
import '../../styles/questions-editor.css';

const REP_KEYS = ['rep_a', 'rep_b', 'rep_c', 'rep_d'];
const REP_EN_KEYS = ['rep_a_en', 'rep_b_en', 'rep_c_en', 'rep_d_en'];
const ORPHAN_KEY = '__orphans__';

// Paliers de difficulté (bande de lecture sur `difficulte` 1-5, cf. §3).
const TIERS = [
  { key: 'amateur', label: 'Amateur', lo: 1, hi: 2, mid: 2, cls: 'tier-am' },
  { key: 'connaisseur', label: 'Connaisseur', lo: 3, hi: 3, mid: 3, cls: 'tier-co' },
  { key: 'expert', label: 'Expert', lo: 4, hi: 5, mid: 4, cls: 'tier-ex' },
];
const tierOf = (d) => (d == null ? null : TIERS.find((t) => d >= t.lo && d <= t.hi) || null);
const GENERALITE_LABEL = { 1: 'très grand public', 2: 'grand public', 3: 'intermédiaire', 4: 'pointu', 5: 'très pointu' };

const emptyDraft = (subject) => ({
  id: null, pool: 'cycle4', subject, level: '',
  q: '', rep_a: '', rep_b: '', rep_c: '', rep_d: '', correcte: 1,
  e: '', t: '', enabled: true, ord: null, difficulte: null, generalite: null,
  q_en: '', rep_a_en: '', rep_b_en: '', rep_c_en: '', rep_d_en: '', e_en: '',
});

// Validation : énoncé + 2 réponses mini, et la bonne réponse non vide.
function validate(d) {
  if (!d.q.trim() || !d.rep_a.trim() || !d.rep_b.trim()) return false;
  const reps = REP_KEYS.map((k) => (d[k] || '').trim());
  return !!reps[d.correcte - 1];
}

// Un subject est scolaire si son nœud vit sous la branche `scolaire`.
function isScolaireSubject(subjectKey, subjNode) {
  const p = subjNode?.path || pathOf(subjectKey);
  return !!p && (p === 'scolaire' || p.startsWith('scolaire.'));
}

export default function QuestionsEditor({ onClose }) {
  const bump = useGameStore((s) => s.bumpQuestionsVersion);
  const qv = useGameStore((s) => s.questionsVersion); // rafraîchit l'arbre après édition de thèmes
  const [rows, setRows] = useState(null);     // null = en chargement
  const [error, setError] = useState(null);
  const [showThemes, setShowThemes] = useState(false);
  const [sel, setSel] = useState('scolaire'); // clé de nœud, 'orphan:xxx' ou ORPHAN_KEY
  const [expanded, setExpanded] = useState(() => new Set(THEME_ROOTS));
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all'); // all|amateur|connaisseur|expert|none
  const [draft, setDraft] = useState(null);   // question éditée (ou null)
  const [busy, setBusy] = useState(false);
  const [showEn, setShowEn] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    setError(null);
    try { setRows(await fetchQuestionRows()); }
    catch (e) { setError(e.message || 'Connexion à Supabase impossible'); setRows([]); }
  }

  // --- Index de l'arbre (recalculé quand THEMES change : ajout/suppr → taille,
  // renommage/déplacement → bump questionsVersion via l'éditeur de thèmes). ---
  const themeSig = `${Object.keys(THEMES).length}:${qv}`;
  // subjectKey -> nœud feuille correspondant
  const subjectToNode = useMemo(() => {
    const m = {};
    for (const n of Object.values(THEMES)) if (n.subjectKey) m[n.subjectKey] = n;
    return m;
  }, [themeSig]);
  // clé de nœud -> Set des subjects sous ce nœud (soi + feuilles descendantes)
  const nodeSubjects = useMemo(() => {
    const m = {};
    for (const key of Object.keys(THEMES)) {
      const s = new Set(descendantLeaves(key));
      if (THEMES[key].subjectKey) s.add(THEMES[key].subjectKey);
      m[key] = s;
    }
    return m;
  }, [themeSig]);
  // Toutes les feuilles groupées par domaine racine (pour le <select> Thème).
  const leavesByRoot = useMemo(() => {
    const out = [];
    for (const rootKey of THEME_ROOTS) {
      const leaves = [...(nodeSubjects[rootKey] || [])]
        .map((sk) => subjectToNode[sk]).filter(Boolean)
        .sort((a, b) => (a.path || '').localeCompare(b.path || ''));
      if (leaves.length) out.push({ root: THEMES[rootKey], leaves });
    }
    return out;
  }, [themeSig, nodeSubjects, subjectToNode]);

  // Comptes par subject + détection des orphelins (subjects en base hors arbre).
  const countBySubject = useMemo(() => {
    const m = {};
    if (rows) for (const r of rows) m[r.subject] = (m[r.subject] || 0) + 1;
    return m;
  }, [rows]);
  const orphanSubjects = useMemo(() => {
    if (!rows) return [];
    const known = new Set(Object.keys(subjectToNode));
    return Object.keys(countBySubject).filter((sk) => !known.has(sk))
      .sort((a, b) => countBySubject[b] - countBySubject[a]);
  }, [rows, countBySubject, subjectToNode]);
  const orphanSet = useMemo(() => new Set(orphanSubjects), [orphanSubjects]);

  const countUnder = (key) => {
    let n = 0;
    for (const sk of nodeSubjects[key] || []) n += countBySubject[sk] || 0;
    return n;
  };

  // --- Filtrage de la liste selon la sélection courante ---
  const inSelection = (subject) => {
    if (sel === ORPHAN_KEY) return orphanSet.has(subject);
    if (sel.startsWith('orphan:')) return subject === sel.slice(7);
    return nodeSubjects[sel]?.has(subject);
  };
  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = search.trim().toLowerCase();
    return rows.filter((r) => inSelection(r.subject)
      && (tierFilter === 'all'
        || (tierFilter === 'none' ? r.difficulte == null : tierOf(r.difficulte)?.key === tierFilter))
      && (!s || (r.q || '').toLowerCase().includes(s)));
  }, [rows, sel, search, tierFilter, nodeSubjects, orphanSet]);

  async function reloadStore() { await refreshQuestions(); bump(); }

  async function handleSave() {
    if (!validate(draft) || busy) return;
    setBusy(true); setError(null);
    try {
      const saved = await saveQuestionRow(draft);
      setRows((rs) => {
        const i = rs.findIndex((r) => r.id === saved.id);
        return i >= 0 ? rs.map((r) => (r.id === saved.id ? saved : r)) : [...rs, saved];
      });
      await reloadStore();
      setDraft(saved);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function handleDelete() {
    if (!draft?.id || busy) return;
    if (!window.confirm('Supprimer définitivement cette question ?')) return;
    setBusy(true); setError(null);
    try {
      await deleteQuestionRow(draft.id);
      setRows((rs) => rs.filter((r) => r.id !== draft.id));
      await reloadStore();
      setDraft(null);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  // Subject par défaut pour « Nouvelle » selon la sélection.
  function defaultSubject() {
    if (sel.startsWith('orphan:')) return sel.slice(7);
    if (sel === ORPHAN_KEY) return orphanSubjects[0] || '';
    const node = THEMES[sel];
    if (node?.subjectKey) return node.subjectKey;
    const first = [...(nodeSubjects[sel] || [])][0];
    return first || '';
  }

  const draftNode = draft ? subjectToNode[draft.subject] : null;
  const draftScolaire = draft ? isScolaireSubject(draft.subject, draftNode) : false;
  const draftTier = draft ? tierOf(draft.difficulte) : null;

  // --- Rendu récursif de l'arbre ---
  function renderNode(key, depth) {
    const node = THEMES[key];
    if (!node) return null;
    const kids = childrenOf(key);
    const leaf = isLeaf(key) && !kids.length;
    const open = expanded.has(key);
    const n = countUnder(key);
    return (
      <div key={key}>
        <div className={`qed-tree-row ${sel === key ? 'is-active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}>
          {kids.length ? (
            <button className="qed-tree-caret" onClick={() => setExpanded((e) => {
              const ne = new Set(e); ne.has(key) ? ne.delete(key) : ne.add(key); return ne;
            })}>{open ? '▾' : '▸'}</button>
          ) : <span className="qed-tree-caret" />}
          <button className="qed-tree-label" onClick={() => setSel(key)} title={node.path}>
            {node.icon && <span className="qed-tree-ic">{node.icon}</span>}
            <span className="qed-tree-name">{node.name}</span>
            {n > 0 && <span className="qed-tree-count">{n}</span>}
          </button>
        </div>
        {open && kids.map((c) => renderNode(c.key, depth + 1))}
      </div>
    );
  }

  const orphanTotal = orphanSubjects.reduce((s, sk) => s + (countBySubject[sk] || 0), 0);

  return createPortal(
    <div className="qed-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qed-panel">
        <div className="qed-head">
          <span className="qed-title">{'\u{1F4DA}'} Éditeur de questions</span>
          <span className="qed-status">
            {rows == null ? 'Chargement…' : `${rows.length} questions en base`}
            {error && <span className="qed-err"> · {error}</span>}
          </span>
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={() => setShowThemes(true)} disabled={busy}>
            {'\u{1F333}'} Thèmes
          </button>
          <button className="btn btn--ghost btn--sm" onClick={load} disabled={busy}>
            {'↻'} Recharger
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>{'✕'} Fermer</button>
        </div>

        {showThemes && <ThemesEditor onClose={() => { setShowThemes(false); load(); }} />}

        <div className="qed-toolbar">
          <input className="qed-search" placeholder="Rechercher un énoncé…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="qed-tabs">
            {[['all', 'Tous'], ...TIERS.map((t) => [t.key, t.label]), ['none', 'Non classé']].map(([k, label]) => (
              <button key={k} className={`qed-tab qed-tf ${k !== 'all' && k !== 'none' ? `tf-${k}` : ''} ${tierFilter === k ? 'is-active' : ''}`}
                onClick={() => setTierFilter(k)}>{label}</button>
            ))}
          </div>
          <button className="btn btn--green btn--sm" disabled={!defaultSubject()}
            onClick={() => { setDraft(emptyDraft(defaultSubject())); setShowEn(false); }}>
            {'+'} Nouvelle
          </button>
        </div>

        <div className="qed-body">
          {/* Colonne 1 : arbre des thèmes */}
          <div className="qed-tree">
            {rows == null && <div style={{ padding: 12, color: 'var(--ink-500)' }}>Chargement…</div>}
            {THEME_ROOTS.length === 0 && rows != null && (
              <div style={{ padding: 12, color: 'var(--ink-500)', fontSize: 13 }}>Arbre de thèmes vide.</div>
            )}
            {THEME_ROOTS.map((k) => renderNode(k, 0))}
            {orphanSubjects.length > 0 && (
              <div className="qed-tree-orphans">
                <div className={`qed-tree-row ${sel === ORPHAN_KEY ? 'is-active' : ''}`} style={{ paddingLeft: 8 }}>
                  <button className="qed-tree-caret" onClick={() => setExpanded((e) => {
                    const ne = new Set(e); ne.has(ORPHAN_KEY) ? ne.delete(ORPHAN_KEY) : ne.add(ORPHAN_KEY); return ne;
                  })}>{expanded.has(ORPHAN_KEY) ? '▾' : '▸'}</button>
                  <button className="qed-tree-label" onClick={() => setSel(ORPHAN_KEY)}>
                    <span className="qed-tree-ic">{'\u{1F4E6}'}</span>
                    <span className="qed-tree-name">Hors arbre / à ranger</span>
                    <span className="qed-tree-count">{orphanTotal}</span>
                  </button>
                </div>
                {expanded.has(ORPHAN_KEY) && orphanSubjects.map((sk) => (
                  <div key={sk} className={`qed-tree-row ${sel === `orphan:${sk}` ? 'is-active' : ''}`} style={{ paddingLeft: 36 }}>
                    <span className="qed-tree-caret" />
                    <button className="qed-tree-label" onClick={() => setSel(`orphan:${sk}`)}>
                      <span className="qed-tree-name">{SUBJECTS[sk]?.name || sk}</span>
                      <span className="qed-tree-count">{countBySubject[sk] || 0}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Colonne 2 : liste des questions du nœud sélectionné */}
          <div className="qed-list">
            {rows != null && filtered.length === 0 && (
              <div style={{ padding: 12, color: 'var(--ink-500)', fontSize: 13 }}>Aucune question ici.</div>
            )}
            {filtered.map((r) => {
              const t = tierOf(r.difficulte);
              return (
                <button key={r.id}
                  className={`qed-item ${draft?.id === r.id ? 'is-active' : ''} ${r.enabled === false ? 'is-disabled' : ''}`}
                  onClick={() => setDraft({ ...r, rep_c: r.rep_c ?? '', rep_d: r.rep_d ?? '', e: r.e ?? '', t: r.t ?? '', level: r.level ?? '', q_en: r.q_en ?? '', rep_a_en: r.rep_a_en ?? '', rep_b_en: r.rep_b_en ?? '', rep_c_en: r.rep_c_en ?? '', rep_d_en: r.rep_d_en ?? '', e_en: r.e_en ?? '' })}>
                  <span className={`qed-tier-dot ${t ? t.cls : 'tier-none'}`} title={t ? t.label : 'non classé'} />
                  <span className="qed-item-q">{r.q}</span>
                </button>
              );
            })}
          </div>

          {/* Colonne 3 : formulaire */}
          {draft ? (
            <div className="qed-form">
              <div className="qed-field">
                <label className="qed-label">Énoncé</label>
                <textarea className="qed-textarea" value={draft.q}
                  onChange={(e) => set({ q: e.target.value })} />
              </div>

              <div className="qed-field">
                <label className="qed-label">Réponses (coche la bonne)</label>
                {REP_KEYS.map((k, i) => (
                  <div key={k} className={`qed-answer ${draft.correcte === i + 1 ? 'is-correct' : ''}`}>
                    <input type="radio" name="correcte" checked={draft.correcte === i + 1}
                      onChange={() => set({ correcte: i + 1 })} />
                    <input className="qed-input" value={draft[k]}
                      placeholder={i >= 2 ? '(optionnel — laisser vide pour Vrai/Faux)' : ''}
                      onChange={(e) => set({ [k]: e.target.value })} />
                  </div>
                ))}
              </div>

              {/* Difficulté : 3 paliers + réglage fin 1-5 */}
              <div className="qed-field">
                <label className="qed-label">Difficulté</label>
                <div className="qed-tiers">
                  {TIERS.map((t) => (
                    <button key={t.key} type="button"
                      className={`qed-tier ${t.cls} ${draftTier?.key === t.key ? 'is-active' : ''}`}
                      onClick={() => set({ difficulte: t.mid })}>{t.label}</button>
                  ))}
                  <button type="button" className={`qed-tier tier-none ${draft.difficulte == null ? 'is-active' : ''}`}
                    onClick={() => set({ difficulte: null })}>Non classé</button>
                </div>
                <div className="qed-fine">
                  <span className="qed-fine-lab">Précis&nbsp;:</span>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} type="button"
                      className={`qed-fine-dot ${draft.difficulte === v ? 'is-active' : ''}`}
                      onClick={() => set({ difficulte: v })}>{v}</button>
                  ))}
                </div>
              </div>

              {/* Généralité (2e axe : grand public ↔ pointu) */}
              <div className="qed-field">
                <label className="qed-label">Généralité {draft.generalite ? <span className="qed-badge">{GENERALITE_LABEL[draft.generalite]}</span> : null}</label>
                <div className="qed-fine">
                  <span className="qed-fine-lab">Grand public</span>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button key={v} type="button"
                      className={`qed-fine-dot ${draft.generalite === v ? 'is-active' : ''}`}
                      onClick={() => set({ generalite: draft.generalite === v ? null : v })}>{v}</button>
                  ))}
                  <span className="qed-fine-lab">Pointu</span>
                </div>
              </div>

              {/* Thème (subject) + facettes scolaires */}
              <div className="qed-field" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <label className="qed-label">Thème</label>
                  <select className="qed-select" value={draft.subject}
                    onChange={(e) => set({ subject: e.target.value })}>
                    {leavesByRoot.map(({ root, leaves }) => (
                      <optgroup key={root.key} label={root.name}>
                        {leaves.map((n) => <option key={n.subjectKey} value={n.subjectKey}>{n.name}</option>)}
                      </optgroup>
                    ))}
                    {/* subject courant hors arbre : reste sélectionnable */}
                    {!subjectToNode[draft.subject] && (
                      <optgroup label="Hors arbre">
                        <option value={draft.subject}>{SUBJECTS[draft.subject]?.name || draft.subject}</option>
                      </optgroup>
                    )}
                  </select>
                </div>
                {draftScolaire && (
                  <>
                    {draft.pool !== 'brevet' && (
                      <div style={{ flex: '0 1 120px' }}>
                        <label className="qed-label">Niveau</label>
                        <select className="qed-select" value={draft.level}
                          onChange={(e) => set({ level: e.target.value })}>
                          <option value="">—</option>
                          {['6e', '5e', '4e', '3e'].map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    )}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, alignSelf: 'flex-end', paddingBottom: 8 }}>
                      <input type="checkbox" checked={draft.pool === 'brevet'}
                        onChange={(e) => set({ pool: e.target.checked ? 'brevet' : 'cycle4', level: e.target.checked ? '' : draft.level })} />
                      Brevet (examen)
                    </label>
                  </>
                )}
              </div>

              <div className="qed-field">
                <label className="qed-label">Étiquette (optionnel — regroupement libre)</label>
                <input className="qed-input" value={draft.t} onChange={(e) => set({ t: e.target.value })} />
              </div>

              <div className="qed-field">
                <label className="qed-label">Explication</label>
                <textarea className="qed-textarea" value={draft.e}
                  onChange={(e) => set({ e: e.target.value })} />
              </div>

              {/* Version anglaise (repliable) — alignée sur les réponses FR. */}
              <div className="qed-field" style={{ border: '1px solid rgba(122,94,58,0.2)', borderRadius: 10, padding: 10 }}>
                <button type="button" className="qed-label" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}
                  onClick={() => setShowEn((v) => !v)}>
                  <span>{showEn ? '▾' : '▸'}</span>
                  {'🇬🇧 Version anglaise'}
                  <span style={{ fontWeight: 400, color: 'var(--ink-500)', fontSize: 12 }}>
                    ({[draft.q_en, draft.rep_a_en, draft.rep_b_en, draft.e_en].filter((x) => (x || '').trim()).length ? 'partielle/remplie' : 'vide — repli français'})
                  </span>
                </button>
                {showEn && (
                  <div style={{ marginTop: 8 }}>
                    <label className="qed-label">Énoncé (EN)</label>
                    <textarea className="qed-textarea" value={draft.q_en} placeholder="English statement…"
                      onChange={(e) => set({ q_en: e.target.value })} />
                    <label className="qed-label" style={{ marginTop: 6 }}>Réponses (EN — même ordre que ci-dessus)</label>
                    {REP_EN_KEYS.map((k, i) => (
                      (draft[REP_KEYS[i]] || '').trim() ? (
                        <div key={k} className={`qed-answer ${draft.correcte === i + 1 ? 'is-correct' : ''}`}>
                          <span style={{ width: 18, textAlign: 'center', fontWeight: 700 }}>{String.fromCharCode(65 + i)}</span>
                          <input className="qed-input" value={draft[k]} placeholder={`EN — ${draft[REP_KEYS[i]]}`}
                            onChange={(e) => set({ [k]: e.target.value })} />
                        </div>
                      ) : null
                    ))}
                    <label className="qed-label" style={{ marginTop: 6 }}>Explication (EN)</label>
                    <textarea className="qed-textarea" value={draft.e_en} placeholder="English explanation…"
                      onChange={(e) => set({ e_en: e.target.value })} />
                  </div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.enabled !== false}
                  onChange={(e) => set({ enabled: e.target.checked })} />
                Activée (décocher = exclue du jeu sans la supprimer)
              </label>

              <div className="qed-actions">
                <button className="btn btn--green" onClick={handleSave}
                  disabled={busy || !validate(draft)}>
                  {busy ? 'Enregistrement…' : (draft.id ? 'Enregistrer' : 'Créer')}
                </button>
                {draft.id && (
                  <button className="btn btn--ghost" onClick={handleDelete} disabled={busy}
                    style={{ color: '#b5341f' }}>Supprimer</button>
                )}
                <button className="btn btn--ghost" onClick={() => setDraft(null)} disabled={busy}>Annuler</button>
                {!validate(draft) && <span className="qed-err">Énoncé, 2 réponses min. et bonne réponse requise.</span>}
                {error && <span className="qed-err">{error}</span>}
              </div>
            </div>
          ) : (
            <div className="qed-empty">
              Choisis un thème à gauche, puis une question — ou crée-en une nouvelle.<br />
              Les modifications sont enregistrées dans Supabase et rechargées dans le jeu.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
