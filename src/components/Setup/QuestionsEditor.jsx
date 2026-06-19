// Éditeur de questions in-game (outil DEV) — CRUD sur la table Supabase
// quete_questions. Filtre par pool (cycle4/brevet) et matière, recherche par
// énoncé, édite/crée/supprime une question, puis rafraîchit le store du jeu.
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SUBJECTS, SUBJECT_KEYS } from '../../data/subjects';
import {
  fetchQuestionRows, saveQuestionRow, deleteQuestionRow, refreshQuestions,
} from '../../logic/questionsConfig';
import { useGameStore } from '../../store/gameStore';
import '../../styles/questions-editor.css';

const POOLS = [{ key: 'cycle4', label: 'Cycle 4' }, { key: 'brevet', label: 'Brevet' }];
const REP_KEYS = ['rep_a', 'rep_b', 'rep_c', 'rep_d'];
const REP_EN_KEYS = ['rep_a_en', 'rep_b_en', 'rep_c_en', 'rep_d_en'];

const emptyDraft = (pool, subject) => ({
  id: null, pool, subject, level: pool === 'brevet' ? '' : '5e',
  q: '', rep_a: '', rep_b: '', rep_c: '', rep_d: '', correcte: 1,
  e: '', t: '', enabled: true, ord: null,
  // Version anglaise (optionnelle ; repli FR en jeu si vide).
  q_en: '', rep_a_en: '', rep_b_en: '', rep_c_en: '', rep_d_en: '', e_en: '',
});

// Validation : énoncé + 2 réponses mini, et la bonne réponse non vide.
function validate(d) {
  if (!d.q.trim() || !d.rep_a.trim() || !d.rep_b.trim()) return false;
  const reps = REP_KEYS.map((k) => (d[k] || '').trim());
  return !!reps[d.correcte - 1];
}

export default function QuestionsEditor({ onClose }) {
  const bump = useGameStore((s) => s.bumpQuestionsVersion);
  const [rows, setRows] = useState(null);     // null = en chargement
  const [error, setError] = useState(null);
  const [pool, setPool] = useState('cycle4');
  const [subject, setSubject] = useState('francais');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(null);   // question éditée (ou null)
  const [busy, setBusy] = useState(false);
  const [showEn, setShowEn] = useState(false); // section « version anglaise » dépliée

  useEffect(() => { load(); }, []);
  async function load() {
    setError(null);
    try { setRows(await fetchQuestionRows()); }
    catch (e) { setError(e.message || 'Connexion à Supabase impossible'); setRows([]); }
  }

  const filtered = useMemo(() => {
    if (!rows) return [];
    const s = search.trim().toLowerCase();
    return rows.filter((r) => r.pool === pool && r.subject === subject
      && (!s || (r.q || '').toLowerCase().includes(s)));
  }, [rows, pool, subject, search]);

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

  return createPortal(
    <div className="qed-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qed-panel">
        <div className="qed-head">
          <span className="qed-title">{'\u{1F4DA}'} Éditeur de questions</span>
          <span className="qed-status">
            {rows == null ? 'Chargement…' : `${rows.length} questions en base`}
            {error && <span className="qed-err"> · {error}</span>}
          </span>
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={load} disabled={busy}>
            {'↻'} Recharger
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>{'✕'} Fermer</button>
        </div>

        <div className="qed-toolbar">
          <div className="qed-tabs">
            {POOLS.map((p) => (
              <button key={p.key} className={`qed-tab ${pool === p.key ? 'is-active' : ''}`}
                onClick={() => setPool(p.key)}>{p.label}</button>
            ))}
          </div>
          <div className="qed-tabs">
            {SUBJECT_KEYS.map((k) => (
              <button key={k} className={`qed-tab ${subject === k ? 'is-active' : ''}`}
                onClick={() => setSubject(k)} title={SUBJECTS[k].name}>
                {SUBJECTS[k].icon}
              </button>
            ))}
          </div>
          <input className="qed-search" placeholder="Rechercher un énoncé…"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn--green btn--sm" onClick={() => setDraft(emptyDraft(pool, subject))}>
            {'+'} Nouvelle
          </button>
        </div>

        <div className="qed-body">
          <div className="qed-list">
            {rows == null && <div style={{ padding: 12, color: 'var(--ink-500)' }}>Chargement…</div>}
            {rows != null && filtered.length === 0 && (
              <div style={{ padding: 12, color: 'var(--ink-500)', fontSize: 13 }}>Aucune question ici.</div>
            )}
            {filtered.map((r) => (
              <button key={r.id}
                className={`qed-item ${draft?.id === r.id ? 'is-active' : ''} ${r.enabled === false ? 'is-disabled' : ''}`}
                onClick={() => setDraft({ ...r, rep_c: r.rep_c ?? '', rep_d: r.rep_d ?? '', e: r.e ?? '', t: r.t ?? '', level: r.level ?? '', q_en: r.q_en ?? '', rep_a_en: r.rep_a_en ?? '', rep_b_en: r.rep_b_en ?? '', rep_c_en: r.rep_c_en ?? '', rep_d_en: r.rep_d_en ?? '', e_en: r.e_en ?? '' })}>
                <span className="qed-item-tag">{r.level || (r.pool === 'brevet' ? 'DNB' : '·')}</span>
                <span>{r.q}</span>
              </button>
            ))}
          </div>

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

              <div className="qed-field" style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="qed-label">Pool</label>
                  <select className="qed-select" value={draft.pool}
                    onChange={(e) => set({ pool: e.target.value, level: e.target.value === 'brevet' ? '' : (draft.level || '5e') })}>
                    <option value="cycle4">Cycle 4</option>
                    <option value="brevet">Brevet</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="qed-label">Matière</label>
                  <select className="qed-select" value={draft.subject}
                    onChange={(e) => set({ subject: e.target.value })}>
                    {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k].name}</option>)}
                  </select>
                </div>
                {draft.pool !== 'brevet' && (
                  <div style={{ flex: 1 }}>
                    <label className="qed-label">Niveau</label>
                    <select className="qed-select" value={draft.level}
                      onChange={(e) => set({ level: e.target.value })}>
                      {['6e', '5e', '4e', '3e'].map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="qed-field">
                <label className="qed-label">Thème (sert au filtrage par niveau — préfixe ex. « 5e — … »)</label>
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
              Sélectionne une question à gauche, ou crée-en une nouvelle.<br />
              Les modifications sont enregistrées dans Supabase et rechargées dans le jeu.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
