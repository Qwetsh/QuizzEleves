// Éditeur de RECETTES d'alchimie (table Supabase quete_recipes). Une recette =
// 3 ingrédients (ordre indifférent) → 1 potion. Les recettes intégrées (code)
// restent toujours présentes ; on édite ici les recettes PERSONNALISÉES.
import { useState, useEffect, useCallback } from 'react';
import { ITEMS } from '../../data/items';
import { BASE_RECIPES } from '../../data/recipes';
import { fetchRecipeRows, saveRecipeRow, deleteRecipeRow, refreshRecipes } from '../../logic/recipesConfig';
import { soundClick } from '../../logic/sounds';

const rand = () => Math.random().toString(36).slice(2, 6);

const rowToDraft = (r) => ({ key: r.key, ingredients: Array.isArray(r.ingredients) ? [...r.ingredients, '', '', ''].slice(0, 3) : ['', '', ''], potion: r.potion || '', isNew: false });

export default function RecipesEditor({ onClose }) {
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const ingKeys = Object.keys(ITEMS).filter((k) => ITEMS[k].family === 'ingredient');
  const potKeys = Object.keys(ITEMS).filter((k) => ITEMS[k].family === 'potion');

  const reload = useCallback(() => {
    fetchRecipeRows().then(setRows).catch((e) => setErr(e.message || 'Chargement impossible'));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const blankDraft = () => ({ key: '', ingredients: [ingKeys[0] || '', ingKeys[1] || '', ingKeys[2] || ''], potion: potKeys[0] || '', isNew: true });
  const upd = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setIng = (i, v) => setDraft((d) => { const ing = [...d.ingredients]; ing[i] = v; return { ...d, ingredients: ing }; });
  const valid = draft && draft.ingredients.filter(Boolean).length === 3 && !!draft.potion;

  const save = async () => {
    if (busy || !valid) return;
    setBusy(true); setErr(null);
    try {
      const key = draft.isNew ? `r-${rand()}${rand()}` : draft.key;
      await saveRecipeRow({ id: key, ingredients: draft.ingredients.filter(Boolean), potion: draft.potion }, { isNew: draft.isNew });
      await refreshRecipes();
      setDraft(null); reload();
    } catch (e) { setErr(e.message || 'Enregistrement impossible'); }
    setBusy(false);
  };

  const remove = async () => {
    if (busy || !draft || draft.isNew) return;
    if (!window.confirm('Supprimer cette recette ?')) return;
    setBusy(true); setErr(null);
    try { await deleteRecipeRow(draft.key); await refreshRecipes(); setDraft(null); reload(); }
    catch (e) { setErr(e.message || 'Suppression impossible'); }
    setBusy(false);
  };

  const recipeLine = (r) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {(r.ingredients || []).map((k, i) => <span key={i}>{ITEMS[k]?.icon || '?'}</span>)}
      <span style={{ color: 'var(--ink-500)', margin: '0 4px' }}>→</span>
      <span>{ITEMS[r.potion]?.icon} {ITEMS[r.potion]?.name || r.potion}</span>
    </span>
  );

  const IngSelect = ({ i }) => (
    <select className="qed-select" style={{ width: 200 }} value={draft.ingredients[i] || ''} onChange={(e) => setIng(i, e.target.value)}>
      <option value="">— ingrédient —</option>
      {ingKeys.map((k) => <option key={k} value={k}>{ITEMS[k].icon} {ITEMS[k].name}</option>)}
    </select>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,18,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', padding: 16 }}>
      <div style={{ margin: 'auto', width: 'min(880px, 96vw)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 18, border: '1.5px solid var(--gold-600)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(122,94,58,0.2)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#8a6418' }}>⚗️ Éditeur de recettes</div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ display: 'flex', gap: 14, padding: 16, minHeight: 0, flex: 1 }}>
          <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            <button className="btn btn--green btn--sm" onClick={() => { soundClick(); setDraft(blankDraft()); }} disabled={ingKeys.length < 3 || potKeys.length === 0}>+ Nouvelle recette</button>
            {(ingKeys.length < 3 || potKeys.length === 0) && <div style={{ fontSize: 11, color: '#b5341f' }}>Crée d'abord des ingrédients et des potions (onglet Objets → Famille).</div>}
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{rows == null ? 'Chargement…' : `${rows.length} recette(s) personnalisée(s)`}</div>
            {(rows || []).map((r) => (
              <button key={r.key} onClick={() => { soundClick(); setDraft(rowToDraft(r)); }}
                style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${draft?.key === r.key ? 'var(--gold-600)' : 'rgba(122,94,58,0.2)'}`, background: '#fffefb', fontSize: 14 }}>
                {recipeLine(r)}
              </button>
            ))}
            <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 10, fontWeight: 700 }}>Recettes intégrées (lecture seule)</div>
            {BASE_RECIPES.map((r) => (
              <div key={r.id} style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(122,94,58,0.06)', fontSize: 13.5 }}>{recipeLine(r)}</div>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
            {!draft ? (
              <div style={{ color: 'var(--ink-500)', padding: 20, textAlign: 'center' }}>Sélectionne une recette ou crée-en une nouvelle.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="qed-field">
                  <label className="qed-label">3 ingrédients (ordre indifférent)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <IngSelect i={0} /><IngSelect i={1} /><IngSelect i={2} />
                  </div>
                </div>
                <div className="qed-field">
                  <label className="qed-label">→ Potion produite</label>
                  <select className="qed-select" style={{ width: 240 }} value={draft.potion} onChange={(e) => upd({ potion: e.target.value })}>
                    <option value="">— potion —</option>
                    {potKeys.map((k) => <option key={k} value={k}>{ITEMS[k].icon} {ITEMS[k].name}</option>)}
                  </select>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(120,170,90,0.12)', fontSize: 16 }}>
                  Aperçu : {recipeLine({ ingredients: draft.ingredients, potion: draft.potion })}
                </div>
                {err && <div style={{ color: '#b5341f', fontSize: 13 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn--green" onClick={save} disabled={busy || !valid}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
                  {!draft.isNew && <button className="btn btn--ghost" onClick={remove} disabled={busy}>🗑 Supprimer</button>}
                  <button className="btn btn--ghost" onClick={() => setDraft(null)}>Annuler</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
