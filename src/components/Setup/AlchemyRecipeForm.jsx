// Formulaire d'une recette d'alchimie (3 ingrédients → 1 potion), piloté par
// props. Utilisé dans l'onglet « Alchimie » de BalanceEditor. La logique de
// persistance (Supabase quete_recipes) reste dans le parent.
import { ITEMS } from '../../data/items';

// Ligne d'aperçu : icônes des ingrédients → icône + nom de la potion.
export function recipeLine(ingredients, potion) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {(ingredients || []).filter(Boolean).map((k, i) => <span key={i}>{ITEMS[k]?.icon || '?'}</span>)}
      <span style={{ color: 'var(--ink-500)', margin: '0 4px' }}>→</span>
      <span>{ITEMS[potion]?.icon} {ITEMS[potion]?.name || potion || '—'}</span>
    </span>
  );
}

export default function AlchemyRecipeForm({ draft, ingKeys, potKeys, onChange, onSave, onDelete, onCancel, busy }) {
  const setIng = (i, v) => {
    const ing = [...draft.ingredients]; ing[i] = v;
    onChange({ ...draft, ingredients: ing });
  };
  const valid = draft.ingredients.filter(Boolean).length === 3 && !!draft.potion;

  const IngSelect = ({ i }) => (
    <select className="qed-select" style={{ width: 220 }} value={draft.ingredients[i] || ''} onChange={(e) => setIng(i, e.target.value)}>
      <option value="">— ingrédient —</option>
      {ingKeys.map((k) => <option key={k} value={k}>{ITEMS[k].icon} {ITEMS[k].name}</option>)}
    </select>
  );

  return (
    <div className="bal-detail-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {ingKeys.length < 3 || potKeys.length === 0 ? (
        <div style={{ color: '#b5341f', fontSize: 13 }}>
          Crée d'abord au moins 3 ingrédients et 1 potion (boutons ci-dessus) pour pouvoir composer une recette.
        </div>
      ) : null}

      <div className="qed-field">
        <label className="qed-label">3 ingrédients (ordre indifférent)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <IngSelect i={0} /><IngSelect i={1} /><IngSelect i={2} />
        </div>
      </div>

      <div className="qed-field">
        <label className="qed-label">→ Potion produite</label>
        <select className="qed-select" style={{ width: 240 }} value={draft.potion} onChange={(e) => onChange({ ...draft, potion: e.target.value })}>
          <option value="">— potion —</option>
          {potKeys.map((k) => <option key={k} value={k}>{ITEMS[k].icon} {ITEMS[k].name}</option>)}
        </select>
      </div>

      <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(120,170,90,0.12)', fontSize: 16 }}>
        Aperçu : {recipeLine(draft.ingredients, draft.potion)}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn--green" onClick={onSave} disabled={busy || !valid}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        {!draft.isNew && <button className="btn btn--ghost" onClick={onDelete} disabled={busy}>🗑 Supprimer</button>}
        <button className="btn btn--ghost" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  );
}
