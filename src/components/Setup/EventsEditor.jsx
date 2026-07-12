// Éditeur d'ÉVÉNEMENTS — gère à la fois les événements INTÉGRÉS (codés) et les
// PERSONNALISÉS (table Supabase quete_events). Chaque événement est éditable selon
// son niveau (`eventEditability`) :
//   • scripted   → liste d'ACTIONS complète (ActionList) ;
//   • params     → valeurs chiffrées (EVENT_PARAMS_SCHEMA) ; effet codé ;
//   • structural → effet codé non chiffrable → métadonnées seules (verrouillé) ;
//   • custom     → événement personnalisé (actions).
// Un événement intégré modifié est stocké comme OVERRIDE PARTIEL (même clé) et
// fusionné par-dessus le code (cf. setCustomEvents). « Réinitialiser » = supprimer
// l'override → retour au défaut codé.
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import {
  EVENTS, BUILTIN_EVENTS, EVENT_TONE, eventTone, eventEditability, EVENT_PARAMS_SCHEMA,
} from '../../data/events';
import { fetchEventRows, saveEventRow, deleteEventRow, refreshEvents } from '../../logic/eventsConfig';
import { ActionList, describeAction, defaultAction } from './EffectBuilder';
import { soundClick } from '../../logic/sounds';

const slug = (s) => (s || 'evt').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'evt';
const rand = () => Math.random().toString(36).slice(2, 6);
const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));

// Groupes de la liste (mêmes tons que le tri du Setup) + section persos.
const GROUP_ORDER = ['positive', 'negative', 'gamble', 'boss', 'other', 'custom'];
const GROUP_LABEL = {
  positive: '😊 Positifs', negative: '💀 Négatifs', gamble: '🎲 Paris & hasard',
  boss: '👨‍🏫 Boss', other: '✨ Autres', custom: '✚ Personnalisés',
};
const TONE_OPTIONS = [
  { v: '', label: '— (automatique)' },
  { v: 'positive', label: '😊 Positif' },
  { v: 'negative', label: '💀 Négatif' },
  { v: 'gamble', label: '🎲 Pari & hasard' },
];
const TIER_CHIP = {
  scripted: { label: 'Scripté', color: '#3f9d5a' },
  params: { label: 'Chiffré', color: '#a06a12' },
  structural: { label: 'Verrouillé', color: '#8a6b6b' },
  custom: { label: 'Perso', color: '#6b46c1' },
};

// Libellés des extensions qui conditionnent le tirage (info lecture seule).
function gatingLabels(ev) {
  const g = [];
  if (ev.needsItems) g.push('Objets');
  const req = ev.requires || [];
  if (req.includes('alchemy')) g.push('Alchimie');
  if (req.includes('enchant')) g.push('Enchantement');
  if (ev.requiresPhone) g.push('Téléphone');
  if (ev.requiresSchool) g.push('Matières scolaires');
  return g;
}

export default function EventsEditor({ onClose }) {
  const syncEnabledEvents = useGameStore((s) => s.syncEnabledEvents);
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const reload = useCallback(() => fetchEventRows()
    .then((r) => { setRows(r); return r; })
    .catch((e) => { setErr(e.message || 'Chargement impossible'); return []; }), []);
  useEffect(() => { reload(); }, [reload]);

  const upd = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const updParam = (k, v) => setDraft((d) => ({ ...d, params: { ...d.params, [k]: v } }));

  // --- Construction des drafts -------------------------------------------------
  const draftFromBuiltin = (key, rowsList) => {
    const ev = EVENTS[key];
    return {
      key, isNew: false, isBuiltin: true, editability: eventEditability(key),
      name: ev.name || '', name_en: ev.name_en || '', icon: ev.icon || '✨',
      desc: ev.desc || '', desc_en: ev.desc_en || '',
      optional: ev.optional !== false, weight: typeof ev.weight === 'number' ? ev.weight : 1,
      category: ev.category || '', tone: ev.tone || EVENT_TONE[key] || '',
      needsItems: !!ev.needsItems, params: { ...(ev.params || {}) },
      actions: Array.isArray(ev.actions) ? ev.actions : [],
      overridden: (rowsList || rows || []).some((r) => r.key === key),
    };
  };
  const draftFromRow = (r) => ({
    key: r.key, isNew: false, isBuiltin: false, editability: 'custom',
    name: r.name || '', name_en: r.name_en || '', icon: r.icon || '✨',
    desc: r.description || '', desc_en: r.description_en || '',
    optional: r.optional !== false, weight: typeof r.weight === 'number' ? r.weight : 1,
    category: r.category || '', tone: r.tone || '', needsItems: !!r.needs_items,
    params: (r.params && typeof r.params === 'object') ? r.params : {},
    actions: Array.isArray(r.actions) ? r.actions : [], overridden: false,
  });
  const blankDraft = () => ({
    key: '', isNew: true, isBuiltin: false, editability: 'custom',
    name: '', name_en: '', icon: '✨', desc: '', desc_en: '',
    optional: true, weight: 1, category: 'money', tone: '', needsItems: false,
    params: {}, actions: [defaultAction()], overridden: false,
  });

  // --- Objet transmis à eventToPayload ----------------------------------------
  const toRow = (key) => ({
    key,
    name: draft.name, name_en: draft.name_en, icon: draft.icon,
    desc: draft.desc, desc_en: draft.desc_en,
    optional: draft.optional, weight: draft.weight, category: draft.category,
    needsItems: draft.needsItems, tone: draft.tone || null,
    // params : uniquement pour les événements paramétrables (ou persos qui en ont) ;
    params: draft.editability === 'params' ? draft.params
      : (draft.params && Object.keys(draft.params).length ? draft.params : null),
    // actions : jamais pour un flux codé (params/structural) — évite tout détournement.
    actions: (draft.editability === 'scripted' || draft.editability === 'custom') ? draft.actions : [],
    enabled: true,
  });

  const save = async () => {
    if (busy || !draft || !draft.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      const key = draft.isNew ? `c-${slug(draft.name)}-${rand()}` : draft.key;
      const isNewRow = draft.isBuiltin ? !draft.overridden : draft.isNew;
      await saveEventRow(toRow(key), { isNew: isNewRow });
      await refreshEvents();
      syncEnabledEvents();
      const fresh = await reload();
      if (draft.isBuiltin) setDraft(draftFromBuiltin(key, fresh)); // ré-ouvre (statut « modifié »)
      else setDraft(null);
    } catch (e) { setErr(e.message || 'Enregistrement impossible'); }
    setBusy(false);
  };

  // Réinitialise un intégré modifié : supprime l'override → retour au défaut codé.
  const resetBuiltin = async () => {
    if (busy || !draft?.isBuiltin || !draft.overridden) return;
    if (!window.confirm(`Réinitialiser « ${draft.name} » à son comportement d'origine ?`)) return;
    setBusy(true); setErr(null);
    try {
      await deleteEventRow(draft.key);
      await refreshEvents();
      syncEnabledEvents();
      const fresh = await reload();
      setDraft(draftFromBuiltin(draft.key, fresh));
    } catch (e) { setErr(e.message || 'Réinitialisation impossible'); }
    setBusy(false);
  };

  const remove = async () => {
    if (busy || !draft || draft.isNew || draft.isBuiltin) return;
    if (!window.confirm(`Supprimer l'événement « ${draft.name} » ?`)) return;
    setBusy(true); setErr(null);
    try {
      await deleteEventRow(draft.key);
      await refreshEvents();
      syncEnabledEvents();
      await reload();
      setDraft(null);
    } catch (e) { setErr(e.message || 'Suppression impossible'); }
    setBusy(false);
  };

  // --- Regroupement de la liste ------------------------------------------------
  const groups = {};
  for (const key of Object.keys(BUILTIN_EVENTS)) (groups[eventTone(key)] ||= []).push({ key, builtin: true });
  for (const r of (rows || [])) if (!BUILTIN_EVENTS[r.key]) (groups.custom ||= []).push({ key: r.key, builtin: false, row: r });

  const isOverridden = (key) => (rows || []).some((r) => r.key === key);

  const listItem = ({ key, builtin, row }) => {
    const ev = builtin ? EVENTS[key] : draftFromRow(row);
    const tier = builtin ? eventEditability(key) : 'custom';
    const chip = TIER_CHIP[tier];
    const badge = builtin ? (isOverridden(key) ? { t: '✎ modifié', c: '#a06a12' } : { t: '⚙️ intégré', c: 'var(--ink-400)' }) : { t: '✚ perso', c: '#6b46c1' };
    const selected = draft?.key === key && (builtin ? draft.isBuiltin : !draft.isBuiltin);
    return (
      <button key={key}
        onClick={() => { soundClick(); setDraft(builtin ? draftFromBuiltin(key) : draftFromRow(row)); }}
        style={{ textAlign: 'left', padding: '7px 9px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${selected ? 'var(--gold-600)' : 'rgba(122,94,58,0.2)'}`, background: '#fffefb', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{ev.icon || '✨'}</span>
        <span style={{ fontSize: 13, minWidth: 0, flex: 1 }}>{ev.name || '(sans nom)'}</span>
        <span style={{ fontSize: 8.5, fontWeight: 700, color: chip.color, background: `${chip.color}1a`, border: `1px solid ${chip.color}55`, borderRadius: 999, padding: '1px 5px', whiteSpace: 'nowrap' }}>{chip.label}</span>
        <span style={{ fontSize: 8.5, color: badge.c, whiteSpace: 'nowrap' }}>{badge.t}</span>
      </button>
    );
  };

  const gating = draft?.isBuiltin ? gatingLabels(EVENTS[draft.key]) : [];
  const paramSchema = draft?.editability === 'params' ? (EVENT_PARAMS_SCHEMA[draft.key] || []) : [];

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,18,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', padding: 16 }}>
      <div style={{ margin: '0 auto', width: 'min(1120px, 97vw)', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#fffefb,#f4e8cf)', borderRadius: 18, border: '1.5px solid var(--gold-600)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(122,94,58,0.2)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#8a6418' }}>✨ Éditeur d'événements</div>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ display: 'flex', gap: 14, padding: 16, minHeight: 0, flex: 1 }}>
          {/* Liste */}
          <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', paddingRight: 4 }}>
            <button className="btn btn--green btn--sm" onClick={() => { soundClick(); setDraft(blankDraft()); }}>+ Nouvel événement</button>
            <div style={{ fontSize: 11, color: 'var(--ink-500)' }}>{rows == null ? 'Chargement…' : `${Object.keys(BUILTIN_EVENTS).length} intégrés · ${(rows || []).filter((r) => !BUILTIN_EVENTS[r.key]).length} perso`}</div>
            {GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => (
              <div key={g}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-500)', margin: '8px 2px 3px' }}>{GROUP_LABEL[g]}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {groups[g].map(listItem)}
                </div>
              </div>
            ))}
          </div>

          {/* Formulaire */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', paddingRight: 4 }}>
            {!draft ? (
              <div style={{ color: 'var(--ink-500)', fontStyle: 'italic', padding: 20 }}>
                Sélectionne un événement à gauche (intégré ou perso), ou crée-en un nouveau.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Bandeau statut (pleine largeur) */}
                {draft.isBuiltin && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-500)', background: 'rgba(232,169,88,0.12)', border: '1px solid rgba(122,94,58,0.2)', borderRadius: 8, padding: '6px 10px' }}>
                    Événement <b>intégré</b>{draft.overridden ? ' (modifié)' : ''}. {gating.length ? <>Nécessite : <b>{gating.join(', ')}</b>.</> : 'Aucune extension requise.'}
                  </div>
                )}

                {/* Deux colonnes : Infos | Effet (layout horizontal, comme l'éditeur d'objets) */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {/* Colonne Infos */}
                  <div style={{ flex: '1 1 360px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="field-label" style={{ color: '#8a6418', fontWeight: 700, borderBottom: '1px solid rgba(122,94,58,0.2)', paddingBottom: 4 }}>📋 Infos</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                      <label style={{ width: 60 }}>
                        <div className="field-label">Icône</div>
                        <input className="qed-input" style={{ width: '100%', textAlign: 'center', fontSize: 22 }} value={draft.icon} maxLength={4} onChange={(e) => upd({ icon: e.target.value })} />
                      </label>
                      <label style={{ flex: 1 }}>
                        <div className="field-label">Nom (FR)</div>
                        <input className="qed-input" style={{ width: '100%' }} value={draft.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Trésor du dragon…" />
                      </label>
                    </div>
                    <label>
                      <div className="field-label">Nom (EN)</div>
                      <input className="qed-input" style={{ width: '100%' }} value={draft.name_en} onChange={(e) => upd({ name_en: e.target.value })} placeholder="Dragon's hoard…" />
                    </label>
                    <label>
                      <div className="field-label">Description (FR)</div>
                      <textarea className="qed-input" style={{ width: '100%', minHeight: 56, resize: 'vertical' }} value={draft.desc} onChange={(e) => upd({ desc: e.target.value })} />
                    </label>
                    <label>
                      <div className="field-label">Description (EN)</div>
                      <textarea className="qed-input" style={{ width: '100%', minHeight: 56, resize: 'vertical' }} value={draft.desc_en} onChange={(e) => upd({ desc_en: e.target.value })} />
                    </label>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input type="checkbox" checked={draft.optional} onChange={(e) => upd({ optional: e.target.checked })} /> Refusable
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        Poids
                        <input type="number" className="qed-input" style={{ width: 70 }} step="0.05" min="0" max="5" value={draft.weight} onChange={(e) => upd({ weight: Math.max(0, Number(e.target.value) || 0) })} />
                      </label>
                      {draft.key !== 'bossProf' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          Ton
                          <select className="qed-select" value={draft.tone} onChange={(e) => upd({ tone: e.target.value })}>
                            {TONE_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                          </select>
                        </label>
                      )}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        Catégorie
                        <select className="qed-select" value={draft.category} onChange={(e) => upd({ category: e.target.value })}>
                          <option value="">—</option><option value="money">Argent</option><option value="item">Objet</option>
                        </select>
                      </label>
                      {!draft.isBuiltin && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                          <input type="checkbox" checked={draft.needsItems} onChange={(e) => upd({ needsItems: e.target.checked })} /> Ext. Objets
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Colonne Effet */}
                  <div style={{ flex: '1 1 360px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="field-label" style={{ color: '#8a6418', fontWeight: 700, borderBottom: '1px solid rgba(122,94,58,0.2)', paddingBottom: 4 }}>✨ Effet</div>
                    {(draft.editability === 'scripted' || draft.editability === 'custom') && (
                      <div>
                        <ActionList actions={draft.actions} onChange={(actions) => upd({ actions })} />
                        {draft.actions?.length > 0 && (
                          <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 6 }}>
                            Aperçu : {draft.actions.map(describeAction).join(' · ')}
                          </div>
                        )}
                      </div>
                    )}
                    {draft.editability === 'params' && (
                      <div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {paramSchema.map((f) => (
                            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ fontSize: 11.5, color: 'var(--ink-600)' }}>{f.label}</span>
                              <input type="number" className="qed-input" style={{ width: 120 }} min={f.min} max={f.max}
                                value={draft.params[f.key] ?? f.def}
                                onChange={(e) => updParam(f.key, clamp(e.target.value, f.min, f.max))} />
                            </label>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 8 }}>
                          L'effet lui-même reste codé ; seules ces valeurs sont modifiables.
                        </div>
                      </div>
                    )}
                    {draft.editability === 'structural' && (
                      <div style={{ fontSize: 12.5, color: 'var(--ink-500)', background: 'rgba(138,107,107,0.1)', border: '1px solid rgba(138,107,107,0.3)', borderRadius: 8, padding: '8px 12px' }}>
                        ⚙️ <b>Effet structurel codé</b> — non chiffrable ici (téléport, échange, tirage d'objet, dé…). Seuls le texte, l'apparence, la refusabilité et la fréquence (poids) sont modifiables.
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions (pleine largeur) */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', borderTop: '1px solid rgba(122,94,58,0.2)', paddingTop: 12 }}>
                  <button className="btn btn--green" onClick={save} disabled={busy || !draft.name.trim()}>{busy ? '…' : (draft.isNew ? 'Créer' : 'Enregistrer')}</button>
                  {draft.isBuiltin && draft.overridden && <button className="btn btn--ghost" onClick={resetBuiltin} disabled={busy}>↺ Réinitialiser</button>}
                  {!draft.isBuiltin && !draft.isNew && <button className="btn btn--ghost" onClick={remove} disabled={busy}>Supprimer</button>}
                  <button className="btn btn--ghost" onClick={() => setDraft(null)}>Annuler</button>
                  {err && <div style={{ fontSize: 12, color: '#b5341f', alignSelf: 'center' }}>{err}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
