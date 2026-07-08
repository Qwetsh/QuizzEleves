// Éditeur d'ÉVÉNEMENTS personnalisés (table Supabase quete_events). On crée des
// événements « scriptés » : métadonnées (nom/icône/desc/poids/optionnel) + une
// séquence d'ACTIONS du moteur (réutilise ActionList de l'éditeur d'effets).
// Les événements intégrés (code) restent gérés par la checklist du Setup.
import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { BUILTIN_EVENTS } from '../../data/events';
import { fetchEventRows, saveEventRow, deleteEventRow, refreshEvents } from '../../logic/eventsConfig';
import { ActionList, describeAction, defaultAction } from './EffectBuilder';
import { soundClick } from '../../logic/sounds';

const slug = (s) => (s || 'evt').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'evt';
const rand = () => Math.random().toString(36).slice(2, 6);

const rowToDraft = (r) => ({
  key: r.key, name: r.name || '', icon: r.icon || '✨', desc: r.description || '',
  optional: r.optional !== false, weight: typeof r.weight === 'number' ? r.weight : 1,
  category: r.category || '', needsItems: !!r.needs_items, actions: Array.isArray(r.actions) ? r.actions : [],
  isNew: false,
});

const blankDraft = () => ({
  key: '', name: '', icon: '✨', desc: '', optional: true, weight: 1, category: 'money',
  needsItems: false, actions: [defaultAction()], isNew: true,
});

export default function EventsEditor({ onClose }) {
  const syncEnabledEvents = useGameStore((s) => s.syncEnabledEvents);
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const reload = useCallback(() => {
    fetchEventRows().then(setRows).catch((e) => setErr(e.message || 'Chargement impossible'));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const upd = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (busy || !draft || !draft.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const key = draft.isNew ? `c-${slug(draft.name)}-${rand()}` : draft.key;
      await saveEventRow({ ...draft, key }, { isNew: draft.isNew });
      await refreshEvents();
      syncEnabledEvents(); // rend l'événement tirable immédiatement
      setDraft(null);
      reload();
    } catch (e) { setErr(e.message || 'Enregistrement impossible'); }
    setBusy(false);
  };

  const remove = async () => {
    if (busy || !draft || draft.isNew) return;
    if (!window.confirm(`Supprimer l'événement « ${draft.name} » ?`)) return;
    setBusy(true); setErr(null);
    try {
      await deleteEventRow(draft.key);
      await refreshEvents();
      syncEnabledEvents();
      setDraft(null);
      reload();
    } catch (e) { setErr(e.message || 'Suppression impossible'); }
    setBusy(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,18,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', padding: 16 }}>
      <div style={{ margin: 'auto', width: 'min(900px, 96vw)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 18, border: '1.5px solid var(--gold-600)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(122,94,58,0.2)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#8a6418' }}>✨ Éditeur d'événements</div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ display: 'flex', gap: 14, padding: 16, minHeight: 0, flex: 1 }}>
          {/* Liste */}
          <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            <button className="btn btn--green btn--sm" onClick={() => { soundClick(); setDraft(blankDraft()); }}>+ Nouvel événement</button>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{rows == null ? 'Chargement…' : `${rows.length} événement(s) personnalisé(s)`}</div>
            {(rows || []).map((r) => (
              <button key={r.key} onClick={() => { soundClick(); setDraft(rowToDraft(r)); }}
                style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${draft?.key === r.key ? 'var(--gold-600)' : 'rgba(122,94,58,0.2)'}`, background: '#fffefb', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{r.icon || '✨'}</span>
                <span style={{ fontSize: 13, minWidth: 0 }}>{r.name || '(sans nom)'}{r.enabled === false ? ' (off)' : ''}</span>
              </button>
            ))}
            <div style={{ fontSize: 10.5, color: 'var(--ink-400)', marginTop: 6, lineHeight: 1.4 }}>
              Les événements intégrés du jeu se règlent (activer/désactiver) dans la liste « Événements » du Setup.
            </div>
          </div>

          {/* Formulaire */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: 4 }}>
            {!draft ? (
              <div style={{ color: 'var(--ink-500)', fontStyle: 'italic', padding: 20 }}>
                Sélectionne un événement à gauche, ou crée-en un nouveau.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <label style={{ width: 64 }}>
                    <div className="field-label">Icône</div>
                    <input className="qed-input" style={{ width: '100%', textAlign: 'center', fontSize: 22 }} value={draft.icon} maxLength={4} onChange={(e) => upd({ icon: e.target.value })} />
                  </label>
                  <label style={{ flex: 1 }}>
                    <div className="field-label">Nom</div>
                    <input className="qed-input" style={{ width: '100%' }} value={draft.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Trésor du dragon…" />
                  </label>
                </div>

                <label>
                  <div className="field-label">Description (affichée au joueur)</div>
                  <textarea className="qed-input" style={{ width: '100%', minHeight: 56, resize: 'vertical' }} value={draft.desc} onChange={(e) => upd({ desc: e.target.value })} />
                </label>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={draft.optional} onChange={(e) => upd({ optional: e.target.checked })} /> Refusable (Accepter/Refuser)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={draft.needsItems} onChange={(e) => upd({ needsItems: e.target.checked })} /> Nécessite l'extension Objets
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    Poids
                    <input type="number" className="qed-input" style={{ width: 70 }} step="0.05" min="0" max="5" value={draft.weight} onChange={(e) => upd({ weight: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    Catégorie
                    <select className="qed-select" value={draft.category} onChange={(e) => upd({ category: e.target.value })}>
                      <option value="">—</option><option value="money">Argent</option><option value="item">Objet</option>
                    </select>
                  </label>
                </div>

                <div>
                  <div className="field-label" style={{ marginBottom: 6 }}>Actions (ce que l'événement fait)</div>
                  <ActionList actions={draft.actions} onChange={(actions) => upd({ actions })} />
                  {draft.actions?.length > 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 6 }}>
                      Aperçu : {draft.actions.map(describeAction).join(' · ')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button className="btn btn--green" onClick={save} disabled={busy || !draft.name.trim()}>{busy ? '…' : (draft.isNew ? 'Créer' : 'Enregistrer')}</button>
                  {!draft.isNew && <button className="btn btn--ghost" onClick={remove} disabled={busy}>Supprimer</button>}
                  <button className="btn btn--ghost" onClick={() => setDraft(null)}>Annuler</button>
                </div>
                {err && <div style={{ fontSize: 12, color: '#b5341f' }}>{err}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
