// Éditeur de THÈMES (outil DEV) — CRUD sur l'arbre `quete_themes` (ltree).
// Permet de créer des sous-thèmes profonds (nœuds), les renommer, les DÉPLACER
// (re-path du sous-arbre — les questions, liées à `subject` stable, ne bougent
// pas) et les supprimer. Une FEUILLE jouable crée aussi sa ligne
// `quete_categories` (role subject), sinon getQuestions ne l'itère pas.
// Voir DESIGN_QUESTIONS_V2.md (Phase B).
import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchThemeRows, saveThemeRow, deleteThemeRow, repathSubtree, slugifyKey, refreshThemes,
} from '../../logic/themesConfig';
import { saveCategoryRow, deleteCategoryRow, refreshCategories } from '../../logic/categoriesConfig';
import { useGameStore } from '../../store/gameStore';
import '../../styles/questions-editor.css';
import '../../styles/themes-editor.css';

const kindLabel = (node, kids) => {
  if (!node.parent_key) return node.kind === 'scolaire' ? 'Domaine (scolaire)' : 'Domaine';
  if (node.subject_key && kids.length) return 'Mixte (contenu + sous-thèmes)';
  if (node.subject_key) return 'Feuille jouable';
  return 'Conteneur';
};

export default function ThemesEditor({ onClose }) {
  const bump = useGameStore((s) => s.bumpQuestionsVersion);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [form, setForm] = useState({ name: '', name_en: '', icon: '' }); // renommage
  const [moveTo, setMoveTo] = useState('');
  // Création d'enfant
  const [adding, setAdding] = useState(false);
  const [child, setChild] = useState({ name: '', key: '', type: 'leaf', icon: '', keyTouched: false });

  useEffect(() => { load(); }, []);
  async function load() {
    setError(null);
    try { const r = await fetchThemeRows(); setRows(r); if (!sel && r.length) { setExpanded(new Set(r.filter((x) => !x.parent_key).map((x) => x.key))); } }
    catch (e) { setError(e.message || 'Connexion impossible'); setRows([]); }
  }

  const byKey = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.key, r])), [rows]);
  const childrenOf = useMemo(() => {
    const m = {};
    for (const r of rows || []) (m[r.parent_key || '__root__'] ||= []).push(r);
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
    return m;
  }, [rows]);
  const node = sel ? byKey[sel] : null;
  const selKids = node ? (childrenOf[node.key] || []) : [];

  useEffect(() => {
    if (node) setForm({ name: node.name || '', name_en: node.name_en || '', icon: node.icon || '' });
    setMoveTo(''); setAdding(false);
    setChild({ name: '', key: '', type: 'leaf', icon: '', keyTouched: false });
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  async function afterMutation() { await refreshThemes(); await refreshCategories(); bump(); await load(); }

  // Domaine racine (1er segment du path) → module de catégorie.
  const domainOf = (n) => (n?.path ? n.path.split('.')[0] : null);
  const moduleFor = (n) => { const d = domainOf(n); return d === 'scolaire' ? 'college' : d; };

  async function handleRename() {
    if (!node || busy) return;
    setBusy(true); setError(null);
    try {
      await saveThemeRow({ ...node, name: form.name.trim(), name_en: form.name_en.trim() || null, icon: form.icon.trim() || null });
      if (node.subject_key) {
        // Garder le libellé de la catégorie en phase (best-effort).
        await saveCategoryRow({ key: node.subject_key, module: moduleFor(node), name: form.name.trim(), name_en: form.name_en.trim() || null, icon: form.icon.trim() || null, role: 'subject' }).catch(() => {});
      }
      await afterMutation();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  // Cibles de déplacement possibles : tous sauf soi + descendants.
  const moveTargets = useMemo(() => {
    if (!node || !rows) return [];
    return rows.filter((r) => r.key !== node.key && !r.path.startsWith(`${node.path}.`))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [node, rows]);

  async function handleMove() {
    if (!node || !moveTo || busy) return;
    setBusy(true); setError(null);
    try {
      const updates = repathSubtree(rows, node.key, moveTo);
      for (const u of updates) await saveThemeRow(u); // parent d'abord n'importe pas (upsert par key)
      await afterMutation();
      setSel(node.key);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function handleDelete() {
    if (!node || busy) return;
    if (selKids.length) { setError('Ce nœud a des sous-thèmes : déplace ou supprime-les d’abord.'); return; }
    const warn = node.subject_key
      ? 'Supprimer ce thème ? Les questions rattachées ne seront pas supprimées mais iront dans « Hors arbre ».'
      : 'Supprimer ce conteneur ?';
    if (!window.confirm(warn)) return;
    setBusy(true); setError(null);
    try {
      await deleteThemeRow(node.key);
      if (node.subject_key) await deleteCategoryRow(node.subject_key).catch(() => {});
      await afterMutation();
      setSel(node.parent_key || null);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const childKey = child.keyTouched ? child.key : slugifyKey(child.name);
  const childKeyValid = childKey && !byKey[childKey];

  async function handleAddChild() {
    if (!node || busy) return;
    const key = childKey;
    if (!child.name.trim()) { setError('Nom requis.'); return; }
    if (!childKeyValid) { setError(byKey[key] ? `La clé « ${key} » existe déjà.` : 'Clé invalide.'); return; }
    setBusy(true); setError(null);
    try {
      const dom = byKey[domainOf(node)] || node;
      const ord = (selKids.reduce((m, k) => Math.max(m, k.ord ?? 0), 0)) + 1;
      const isLeaf = child.type === 'leaf';
      await saveThemeRow({
        key, path: `${node.path}.${key}`, parent_key: node.key,
        subject_key: isLeaf ? key : null, kind: isLeaf ? 'theme' : 'integrale',
        name: child.name.trim(), icon: child.icon.trim() || null,
        color: dom.color ?? null, color_soft: dom.color_soft ?? null, color_deep: dom.color_deep ?? null,
        biome: dom.biome ?? null, ord, enabled: true,
      });
      if (isLeaf) {
        await saveCategoryRow({
          key, module: moduleFor(node), name: child.name.trim(), icon: child.icon.trim() || null,
          color: dom.color ?? null, color_soft: dom.color_soft ?? null, color_deep: dom.color_deep ?? null,
          biome: dom.biome ?? null, role: 'subject', board: true, default_on: false, enabled: true, ord,
        });
      }
      await afterMutation();
      setExpanded((e) => new Set(e).add(node.key));
      setSel(key);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  function renderNode(r, depth) {
    const kids = childrenOf[r.key] || [];
    const open = expanded.has(r.key);
    return (
      <div key={r.key}>
        <div className={`qed-tree-row ${sel === r.key ? 'is-active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }}>
          {kids.length ? (
            <button className="qed-tree-caret" onClick={() => setExpanded((e) => {
              const ne = new Set(e); ne.has(r.key) ? ne.delete(r.key) : ne.add(r.key); return ne;
            })}>{open ? '▾' : '▸'}</button>
          ) : <span className="qed-tree-caret" />}
          <button className="qed-tree-label" onClick={() => setSel(r.key)} title={r.path}>
            {r.icon && <span className="qed-tree-ic">{r.icon}</span>}
            <span className="qed-tree-name">{r.name}</span>
            {r.subject_key && <span className="the-leaf-dot" title="feuille jouable">●</span>}
          </button>
        </div>
        {open && kids.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  return createPortal(
    <div className="qed-overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qed-panel">
        <div className="qed-head">
          <span className="qed-title">{'\u{1F333}'} Éditeur de thèmes</span>
          <span className="qed-status">
            {rows == null ? 'Chargement…' : `${rows.length} nœuds`}
            {error && <span className="qed-err"> · {error}</span>}
          </span>
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={load} disabled={busy}>↻ Recharger</button>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>✕ Fermer</button>
        </div>

        <div className="qed-body">
          <div className="qed-tree">
            {(childrenOf['__root__'] || []).map((r) => renderNode(r, 0))}
          </div>

          <div className="qed-form">
            {!node ? (
              <div className="qed-empty">Choisis un nœud à gauche pour l’éditer, ou sélectionne un parent puis « Ajouter un sous-thème ».</div>
            ) : (
              <>
                <div className="the-crumb">{node.path}</div>
                <div className="the-kind">{kindLabel(node, selKids)}</div>

                {/* Renommer */}
                <div className="qed-field" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label className="qed-label">Nom</label>
                    <input className="qed-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label className="qed-label">Nom (EN)</label>
                    <input className="qed-input" value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
                  </div>
                  <div style={{ flex: '0 1 90px' }}>
                    <label className="qed-label">Icône</label>
                    <input className="qed-input" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
                  </div>
                  <button className="btn btn--green btn--sm" style={{ alignSelf: 'flex-end' }} disabled={busy || !form.name.trim()} onClick={handleRename}>Renommer</button>
                </div>

                {/* Déplacer */}
                {node.parent_key && (
                  <div className="qed-field" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label className="qed-label">Déplacer sous…</label>
                      <select className="qed-select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                        <option value="">— choisir un nouveau parent —</option>
                        {moveTargets.map((t) => <option key={t.key} value={t.key}>{t.path}</option>)}
                      </select>
                    </div>
                    <button className="btn btn--ghost btn--sm" disabled={busy || !moveTo} onClick={handleMove}>Déplacer</button>
                    <span className="the-hint">Les questions ne bougent pas (re-path du sous-arbre).</span>
                  </div>
                )}

                {/* Ajouter un enfant */}
                <div className="the-add">
                  {!adding ? (
                    <button className="btn btn--green btn--sm" onClick={() => setAdding(true)}>➕ Ajouter un sous-thème sous « {node.name} »</button>
                  ) : (
                    <div className="the-add-form">
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 220px' }}>
                          <label className="qed-label">Nom du sous-thème</label>
                          <input className="qed-input" autoFocus value={child.name}
                            onChange={(e) => setChild((c) => ({ ...c, name: e.target.value }))} placeholder="ex. Skyrim" />
                        </div>
                        <div style={{ flex: '0 1 90px' }}>
                          <label className="qed-label">Icône</label>
                          <input className="qed-input" value={child.icon} onChange={(e) => setChild((c) => ({ ...c, icon: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                        <div style={{ flex: '1 1 220px' }}>
                          <label className="qed-label">Clé (identifiant ltree)</label>
                          <input className="qed-input" value={childKey}
                            onChange={(e) => setChild((c) => ({ ...c, key: slugifyKey(e.target.value), keyTouched: true }))} />
                          {!childKeyValid && childKey && <span className="qed-err">Clé déjà utilisée.</span>}
                        </div>
                        <div style={{ flex: '1 1 260px' }}>
                          <label className="qed-label">Type</label>
                          <div className="qed-tiers">
                            <button type="button" className={`qed-tier ${child.type === 'leaf' ? 'is-active tier-am' : ''}`}
                              onClick={() => setChild((c) => ({ ...c, type: 'leaf' }))}>Feuille jouable</button>
                            <button type="button" className={`qed-tier ${child.type === 'container' ? 'is-active tier-co' : ''}`}
                              onClick={() => setChild((c) => ({ ...c, type: 'container' }))}>Conteneur</button>
                          </div>
                          <span className="the-hint">{child.type === 'leaf' ? 'Reçoit des questions (nouvelle « matière » subject).' : 'Regroupe des sous-thèmes, sans questions propres.'}</span>
                        </div>
                      </div>
                      <div className="qed-actions" style={{ marginTop: 12 }}>
                        <button className="btn btn--green" disabled={busy || !child.name.trim() || !childKeyValid} onClick={handleAddChild}>
                          {busy ? 'Création…' : 'Créer le sous-thème'}
                        </button>
                        <button className="btn btn--ghost" disabled={busy} onClick={() => setAdding(false)}>Annuler</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="qed-actions">
                  <button className="btn btn--ghost" style={{ color: '#b5341f' }} disabled={busy} onClick={handleDelete}>Supprimer ce nœud</button>
                  {error && <span className="qed-err">{error}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
