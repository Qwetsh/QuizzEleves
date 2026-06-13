// Éditeur d'équilibrage in-game (outil DEV). Onglet Objets : CRUD complet sur
// la table Supabase quete_items (création, modification, suppression, image),
// en « carte vivante » (aperçu temps réel). Onglets Pouvoirs/Loot : à venir.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RARITIES, SLOTS } from '../../data/items';
import { POWERS } from '../../data/powers';
import ItemIcon from '../Modals/ItemIcon';
import { ITEM_ASSET_KEYS, assetUrl } from '../../logic/itemAssets';
import {
  fetchItemRows, saveItemRow, deleteItemRow, uploadItemImage, refreshItems,
} from '../../logic/itemsConfig';
import { DEFAULTS, readCache, saveBalance } from '../../logic/balanceConfig';
import { useGameStore } from '../../store/gameStore';
import '../../styles/questions-editor.css';
import '../../styles/balance-editor.css';

const TABS = [
  { key: 'items', label: '\u{1F392} Objets' },
  { key: 'powers', label: '⚡ Pouvoirs' },
  { key: 'loot', label: '\u{1F3B0} Loot' },
];

const EFFECT_LABELS = {
  timerBonus: 'Timer (+s)', indiceBoost: 'Indice (+rép. éliminées)', moneyPerCorrect: 'Pièces / bonne réponse',
  taxReduction: 'Impôts/taxes (−%)', stealProtection: 'Anti-vol (−%)', reculReduction: 'Recul subi (−cases)',
  tempeteImmune: 'Immunité Tempête (0/1)', oubliProtect: "Anti Trou de l'oubli (0/1)", fightStealBonus: 'Vol de duel (+pièces)',
  gainMoney: 'Gagne des pièces', gainMoneyAll: 'Pièces à toutes les équipes', moveForward: 'Avance (cases)',
  extraTime: 'Temps prochaine question (+s)', shieldNext: 'Annule prochain recul (0/1)',
  gainCharge: 'Recharge un pouvoir (0/1)', fumigene: 'Annule pouvoir offensif (0/1)',
};
const EQUIP_EFFECTS = ['timerBonus', 'indiceBoost', 'moneyPerCorrect', 'taxReduction', 'stealProtection', 'reculReduction', 'tempeteImmune', 'oubliProtect', 'fightStealBonus'];
const CONSUM_EFFECTS = ['gainMoney', 'gainMoneyAll', 'moveForward', 'extraTime', 'shieldNext', 'gainCharge', 'fumigene'];

const GROUPS = [
  { slot: 'head', label: '\u{1F3A9} Coiffes' },
  { slot: 'body', label: '\u{1F6E1}️ Armures' },
  { slot: 'feet', label: '\u{1F4FF} Amulettes' },
  { slot: 'consumable', label: '\u{1F9F3} Consommables' },
];

// Libellés des champs numériques des effets de pouvoir
const FX_LABELS = {
  amount: 'Valeur', count: 'Nombre', bonusTime: 'Bonus temps (s)', bonusMoney: 'Bonus pièces',
  divisor: 'Diviseur du timer', timerDivisor: 'Diviseur timer (rafale)',
};
// Réglages de loot (LOOT) : pct = valeur 0-1 affichée en %
const LOOT_FIELDS = [
  { k: 'chestLegendaryChance', label: 'Chance légendaire — coffre', pct: true },
  { k: 'fightLegendaryChance', label: 'Chance légendaire — duel', pct: true },
  { k: 'answerLegendaryChance', label: 'Chance légendaire — bonne réponse', pct: true },
  { k: 'answerLootRate', label: 'Taux de loot — bonne réponse (max)', pct: true },
  { k: 'shopWeightCommon', label: 'Poids boutique — commun', pct: false },
  { k: 'shopWeightOther', label: 'Poids boutique — rare/légendaire', pct: false },
];

function Stepper({ value, onChange, min = 0, max = 999, step = 1 }) {
  return (
    <span className="bal-stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>{'−'}</button>
      <span className="bal-val">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>{'+'}</button>
    </span>
  );
}

const rowToDraft = (r) => ({
  key: r.key, name: r.name, desc: r.description ?? '', icon: r.icon ?? '', img: r.img ?? '',
  slot: r.slot, rarity: r.rarity, price: r.price, lootOnly: !!r.loot_only,
  effects: Array.isArray(r.effects) ? r.effects : [], enabled: r.enabled !== false,
  ord: r.ord, _isNew: false,
});
const newDraft = (ord) => ({
  key: '', name: 'Nouvel objet', desc: '', icon: '✨', img: '',
  slot: 'head', rarity: 'commun', price: 10, lootOnly: false, effects: [],
  enabled: true, ord, _isNew: true,
});
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ')
  .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('');

export default function BalanceEditor({ onClose }) {
  const syncEnabled = useGameStore((s) => s.syncEnabledItems);
  const [tab, setTab] = useState('items');
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [picker, setPicker] = useState(false);
  const fileRef = useRef(null);
  // Overrides d'équilibrage (pouvoirs + loot), pilotés par balanceConfig
  const [ov, setOv] = useState(() => readCache());
  const [selPower, setSelPower] = useState('bouclier');

  // --- Pouvoirs : valeurs effectives (override ?? défaut) et setters ---
  const pVal = (key, field) => ov.powers?.[key]?.[field] ?? DEFAULTS.powers[key][field];
  const lvFx = (key, i, fxKey) => ov.powers?.[key]?.levels?.[i]?.[fxKey] ?? DEFAULTS.powers[key].levels[i].effect[fxKey];
  const setPowerField = (key, field, value) => {
    setStatus(null);
    setOv((prev) => {
      const powers = { ...(prev.powers || {}) };
      powers[key] = { ...(powers[key] || {}), [field]: value };
      return { ...prev, powers };
    });
  };
  const setLevelFx = (key, i, fxKey, value) => {
    setStatus(null);
    setOv((prev) => {
      const powers = { ...(prev.powers || {}) };
      const cur = { ...(powers[key] || {}) };
      const levels = cur.levels ? cur.levels.map((l) => ({ ...l })) : [{}, {}, {}];
      levels[i] = { ...levels[i], [fxKey]: value };
      cur.levels = levels;
      powers[key] = cur;
      return { ...prev, powers };
    });
  };
  const resetPower = (key) => {
    setStatus(null);
    setOv((prev) => { const powers = { ...(prev.powers || {}) }; delete powers[key]; return { ...prev, powers }; });
  };

  // --- Loot ---
  const lootVal = (k) => ov.loot?.[k] ?? DEFAULTS.loot[k];
  const setLoot = (k, v) => { setStatus(null); setOv((prev) => ({ ...prev, loot: { ...(prev.loot || {}), [k]: v } })); };

  async function handleSaveBalance() {
    if (busy) return;
    setBusy(true); setStatus(null);
    try { await saveBalance(ov); setStatus('Enregistré ✓'); }
    catch (e) { setStatus('Erreur : ' + (e.message || 'Supabase injoignable')); }
    setBusy(false);
  }

  useEffect(() => { load(); }, []);
  async function load() {
    setStatus(null);
    try {
      const r = await fetchItemRows();
      setRows(r);
      setDraft((d) => d || (r[0] ? rowToDraft(r[0]) : null));
    } catch (e) { setStatus('Erreur : ' + (e.message || 'Supabase injoignable')); setRows([]); }
  }

  const set = (patch) => { setStatus(null); setDraft((d) => ({ ...d, ...patch })); };
  const effectPool = draft?.slot === 'consumable' ? CONSUM_EFFECTS : EQUIP_EFFECTS;

  const updateEffect = (i, patch) => set({ effects: draft.effects.map((fx, j) => (j === i ? { ...fx, ...patch } : fx)) });
  const removeEffect = (i) => set({ effects: draft.effects.filter((_, j) => j !== i) });
  const addEffect = () => set({ effects: [...draft.effects, { type: effectPool[0], value: 1 }] });

  function validate(d) {
    if (!d) return false;
    if (!d.name.trim()) return false;
    const key = d._isNew ? slugify(d.key || d.name) : d.key;
    if (!key) return false;
    if (d._isNew && rows?.some((r) => r.key === key)) return false;
    return true;
  }

  async function handleSave() {
    if (busy || !validate(draft)) return;
    setBusy(true); setStatus(null);
    const toSave = { ...draft, key: draft._isNew ? slugify(draft.key || draft.name) : draft.key };
    try {
      const saved = await saveItemRow(toSave, { isNew: draft._isNew });
      await refreshItems(); syncEnabled();
      setRows((rs) => {
        const i = rs.findIndex((r) => r.key === saved.key);
        return i >= 0 ? rs.map((r) => (r.key === saved.key ? saved : r)) : [...rs, saved];
      });
      setDraft(rowToDraft(saved));
      setStatus('Enregistré ✓');
    } catch (e) { setStatus('Erreur : ' + e.message); }
    setBusy(false);
  }

  async function handleDelete() {
    if (busy || !draft || draft._isNew) return;
    if (!window.confirm(`Supprimer définitivement « ${draft.name} » ?`)) return;
    setBusy(true); setStatus(null);
    try {
      await deleteItemRow(draft.key);
      await refreshItems(); syncEnabled();
      setRows((rs) => rs.filter((r) => r.key !== draft.key));
      setDraft(null);
      setStatus('Supprimé');
    } catch (e) { setStatus('Erreur : ' + e.message); }
    setBusy(false);
  }

  async function handleUpload(file) {
    if (!file || busy) return;
    setBusy(true); setStatus(null);
    try {
      const url = await uploadItemImage(file, draft.key || slugify(draft.name));
      set({ img: url }); setPicker(false);
    } catch (e) { setStatus('Upload échec : ' + e.message); }
    // Réinitialise l'input pour autoriser la re-sélection du même fichier
    if (fileRef.current) fileRef.current.value = '';
    setBusy(false);
  }

  const preview = draft && {
    name: draft.name, desc: draft.desc, icon: draft.icon, img: draft.img,
    slot: draft.slot, rarity: draft.rarity, lootOnly: draft.lootOnly, effects: draft.effects,
  };
  const rar = draft ? (RARITIES[draft.rarity] || { color: '#888', name: '' }) : null;
  const slotLabel = draft && (draft.slot === 'consumable' ? 'Consommable' : SLOTS[draft.slot]?.name);

  return createPortal(
    <div className="qed-overlay" onPointerDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}>
      <div className="qed-panel">
        <div className="qed-head">
          <span className="qed-title">{'⚖️'} Éditeur d'équilibrage</span>
          <span className="qed-status">
            {tab === 'items' ? (rows == null ? 'Chargement…' : `${rows.length} objets`)
              : tab === 'powers' ? `${Object.keys(ov.powers || {}).length} pouvoir(s) modifié(s)`
              : `${Object.keys(ov.loot || {}).length} réglage(s) modifié(s)`}
            {status && <span style={{ marginLeft: 6, color: status.startsWith('Erreur') || status.includes('échec') ? '#ffd9d0' : '#d6ffe0' }}>· {status}</span>}
          </span>
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={onClose}>{'✕'} Fermer</button>
        </div>

        <div className="qed-toolbar">
          <div className="qed-tabs">
            {TABS.map((t) => (
              <button key={t.key} className={`qed-tab ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          {tab === 'items' && (
            <button className="btn btn--green btn--sm" style={{ marginLeft: 'auto' }}
              onClick={() => setDraft(newDraft(rows?.length || 0))}>{'+'} Nouvel objet</button>
          )}
        </div>

        {tab === 'powers' ? (
          <div className="qed-body">
            <div className="qed-list">
              {Object.entries(POWERS).map(([k, p]) => (
                <button key={k} className={`qed-item ${selPower === k ? 'is-active' : ''}`} onClick={() => { setSelPower(k); setStatus(null); }}>
                  <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{p.icon}</span>
                  <span style={{ flex: 1 }}>{p.name}</span>
                  {ov.powers?.[k] && <span className="qed-item-tag" title="Modifié">{'✎'}</span>}
                </button>
              ))}
            </div>
            <div className="qed-form">
              {(() => {
                const k = selPower; const p = POWERS[k]; const d = DEFAULTS.powers[k];
                return (
                  <>
                    <div className="bal-card" style={{ paddingBottom: 12 }}>
                      <span style={{ fontSize: 40 }}>{p.icon}</span>
                      <div className="bal-card-name">{p.name}</div>
                      <div className="bal-card-desc">{p.desc}</div>
                    </div>
                    <div style={{ height: 12 }} />
                    <div className="bal-row"><span className="bal-label">Prix</span>
                      <Stepper value={pVal(k, 'price')} onChange={(v) => setPowerField(k, 'price', v)} max={999} />
                      <span className="bal-default">défaut : {d.price}</span></div>
                    <div className="bal-row"><span className="bal-label">Coût activ.</span>
                      <Stepper value={pVal(k, 'activationCost')} onChange={(v) => setPowerField(k, 'activationCost', v)} max={999} />
                      <span className="bal-default">défaut : {d.activationCost}</span></div>
                    <div className="bal-row"><span className="bal-label">Amélio. niv.2</span>
                      <Stepper value={pVal(k, 'upgradeCosts')[0]} onChange={(v) => setPowerField(k, 'upgradeCosts', [v, pVal(k, 'upgradeCosts')[1]])} max={999} />
                      <span className="bal-default">défaut : {d.upgradeCosts[0]}</span></div>
                    <div className="bal-row"><span className="bal-label">Amélio. niv.3</span>
                      <Stepper value={pVal(k, 'upgradeCosts')[1]} onChange={(v) => setPowerField(k, 'upgradeCosts', [pVal(k, 'upgradeCosts')[0], v])} max={999} />
                      <span className="bal-default">défaut : {d.upgradeCosts[1]}</span></div>

                    {d.levels.map((lv, i) => {
                      const numKeys = Object.entries(lv.effect).filter(([, v]) => typeof v === 'number');
                      return (
                        <div key={i} className="qed-field" style={{ marginTop: 10 }}>
                          <label className="qed-label">Niveau {i + 1} — {lv.desc}</label>
                          {numKeys.length === 0 && <div className="bal-default">aucune valeur numérique</div>}
                          {numKeys.map(([fxKey]) => (
                            <div key={fxKey} className="bal-row">
                              <span className="bal-label">{FX_LABELS[fxKey] || fxKey}</span>
                              <Stepper value={lvFx(k, i, fxKey)} onChange={(v) => setLevelFx(k, i, fxKey, v)} max={999} />
                              <span className="bal-default">défaut : {lv.effect[fxKey]}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    <div className="qed-actions">
                      <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
                      <button className="btn btn--ghost" onClick={() => resetPower(k)} disabled={!ov.powers?.[k]}>{'↺'} Valeurs d'origine</button>
                      {status && <span className="qed-err" style={{ color: status.startsWith('Erreur') ? '#b5341f' : '#2f9d5a' }}>{status}</span>}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : tab === 'loot' ? (
          <div className="qed-body">
            <div className="qed-form">
              <div className="qed-label" style={{ marginBottom: 10 }}>Probabilités & poids de loot</div>
              {LOOT_FIELDS.map((f) => (
                <div className="bal-row" key={f.k}>
                  <span className="bal-label" style={{ width: 290 }}>{f.label}</span>
                  {f.pct ? (
                    <>
                      <input type="number" className="qed-input" style={{ width: 92 }} step="0.05" min="0" max="1"
                        value={lootVal(f.k)} onChange={(ev) => setLoot(f.k, Math.max(0, Math.min(1, parseFloat(ev.target.value) || 0)))} />
                      <span className="bal-default">= {Math.round(lootVal(f.k) * 100)}% · défaut {Math.round(DEFAULTS.loot[f.k] * 100)}%</span>
                    </>
                  ) : (
                    <>
                      <Stepper value={lootVal(f.k)} onChange={(v) => setLoot(f.k, v)} min={0} max={20} />
                      <span className="bal-default">défaut : {DEFAULTS.loot[f.k]}</span>
                    </>
                  )}
                </div>
              ))}
              <div className="qed-actions">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
                <button className="btn btn--ghost" onClick={() => setOv((prev) => ({ ...prev, loot: {} }))}>{'↺'} Valeurs d'origine</button>
                {status && <span className="qed-err" style={{ color: status.startsWith('Erreur') ? '#b5341f' : '#2f9d5a' }}>{status}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="qed-body">
            <div className="qed-list">
              {rows == null && <div style={{ padding: 12, color: 'var(--ink-500)' }}>Chargement…</div>}
              {GROUPS.map((g) => {
                const list = (rows || []).filter((r) => r.slot === g.slot);
                if (!list.length) return null;
                return (
                  <div key={g.slot}>
                    <div className="qed-label" style={{ margin: '8px 6px 4px' }}>{g.label}</div>
                    {list.map((r) => (
                      <button key={r.key}
                        className={`qed-item ${draft && draft.key === r.key && !draft._isNew ? 'is-active' : ''} ${r.enabled === false ? 'is-disabled' : ''}`}
                        onClick={() => setDraft(rowToDraft(r))}>
                        <ItemIcon item={{ name: r.name, img: r.img, icon: r.icon, rarity: r.rarity, slot: r.slot }} size={30} ring />
                        <span style={{ flex: 1 }}>{r.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            {draft ? (
              <div className="qed-form">
                {/* Aperçu carte vivante */}
                <div className="bal-card">
                  <ItemIcon item={preview} size={92} radius={20} ring />
                  <span className="bal-pill" style={{ background: rar.color }}>{rar.name} · {slotLabel}</span>
                  <div className="bal-card-name">{draft.name || '—'}</div>
                  <div className="bal-card-desc">{draft.desc}</div>
                </div>

                <div style={{ height: 14 }} />

                <div className="qed-field">
                  <label className="qed-label">Nom</label>
                  <input className="qed-input" value={draft.name} onChange={(ev) => set({ name: ev.target.value })} />
                </div>

                {draft._isNew && (
                  <div className="qed-field">
                    <label className="qed-label">Clé (identifiant unique)</label>
                    <input className="qed-input" value={draft.key}
                      placeholder={slugify(draft.name)} onChange={(ev) => set({ key: ev.target.value })} />
                    <span className="bal-default">générée : {slugify(draft.key || draft.name) || '—'}</span>
                  </div>
                )}

                {/* Image */}
                <div className="bal-row">
                  <span className="bal-label">Image</span>
                  <button className="btn btn--ghost btn--sm" onClick={() => setPicker((p) => !p)}>
                    {draft.img ? 'Changer l’image' : 'Choisir une image'}
                  </button>
                  {draft.img && <button className="btn btn--ghost btn--sm" onClick={() => set({ img: '' })}>Retirer</button>}
                  <span className="bal-default">ou emoji :</span>
                  <input className="qed-input" style={{ width: 64, textAlign: 'center' }} value={draft.icon}
                    onChange={(ev) => set({ icon: ev.target.value })} />
                </div>

                {picker && (
                  <div className="bal-picker">
                    {ITEM_ASSET_KEYS.map((k) => (
                      <button key={k} className={`bal-thumb ${draft.img === k ? 'is-sel' : ''}`}
                        title={k} onClick={() => { set({ img: k }); setPicker(false); }}>
                        <img src={assetUrl(k)} alt={k} />
                      </button>
                    ))}
                    <button className="bal-thumb bal-upload" onClick={() => fileRef.current?.click()} title="Uploader une image">
                      {busy ? '…' : '⬆️'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" hidden
                      onChange={(ev) => handleUpload(ev.target.files?.[0])} />
                  </div>
                )}

                <div className="bal-row" style={{ marginTop: 10 }}>
                  <span className="bal-label">Emplacement</span>
                  <select className="qed-select" style={{ width: 160 }} value={draft.slot}
                    onChange={(ev) => set({ slot: ev.target.value, effects: [] })}>
                    <option value="head">Coiffe</option>
                    <option value="body">Armure</option>
                    <option value="feet">Amulette</option>
                    <option value="consumable">Consommable</option>
                  </select>
                </div>

                <div className="bal-row">
                  <span className="bal-label">Rareté</span>
                  <select className="qed-select" style={{ width: 160 }} value={draft.rarity}
                    onChange={(ev) => set({ rarity: ev.target.value })}>
                    {Object.entries(RARITIES).map(([k, r]) => <option key={k} value={k}>{r.name}</option>)}
                  </select>
                </div>

                <div className="bal-row">
                  <span className="bal-label">Prix</span>
                  <Stepper value={draft.price} onChange={(v) => set({ price: v })} max={999} />
                </div>

                {draft.slot !== 'consumable' && (
                  <div className="bal-row">
                    <span className="bal-label">Loot only</span>
                    <label className="bal-toggle">
                      <input type="checkbox" checked={!!draft.lootOnly} onChange={(ev) => set({ lootOnly: ev.target.checked })} />
                      introuvable en boutique
                    </label>
                  </div>
                )}

                <div className="qed-field" style={{ marginTop: 8 }}>
                  <label className="qed-label">Description (texte affiché)</label>
                  <textarea className="qed-textarea" value={draft.desc} onChange={(ev) => set({ desc: ev.target.value })} />
                </div>

                <div className="qed-field">
                  <label className="qed-label">Effets</label>
                  {draft.effects.map((fx, i) => (
                    <div key={i} className="bal-effect">
                      <select className="qed-select" value={fx.type} onChange={(ev) => updateEffect(i, { type: ev.target.value })}>
                        {(effectPool.includes(fx.type) ? effectPool : [fx.type, ...effectPool]).map((t) => (
                          <option key={t} value={t}>{EFFECT_LABELS[t] || t}</option>
                        ))}
                      </select>
                      <Stepper value={fx.value ?? 0} onChange={(v) => updateEffect(i, { value: v })} max={999} />
                      <button className="btn btn--ghost btn--sm" onClick={() => removeEffect(i)} title="Retirer">{'\u{1F5D1}'}</button>
                    </div>
                  ))}
                  <button className="btn btn--ghost btn--sm" onClick={addEffect}>{'+'} Ajouter un effet</button>
                </div>

                <label className="bal-toggle" style={{ marginTop: 6 }}>
                  <input type="checkbox" checked={draft.enabled} onChange={(ev) => set({ enabled: ev.target.checked })} />
                  Activé (décocher = retiré du jeu sans le supprimer)
                </label>

                <div className="qed-actions">
                  <button className="btn btn--green" onClick={handleSave} disabled={busy || !validate(draft)}>
                    {busy ? 'Enregistrement…' : (draft._isNew ? 'Créer' : 'Enregistrer')}
                  </button>
                  {!draft._isNew && (
                    <button className="btn btn--ghost" onClick={handleDelete} disabled={busy} style={{ color: '#b5341f' }}>Supprimer</button>
                  )}
                  {!validate(draft) && <span className="qed-err">Nom et clé unique requis.</span>}
                  {status && <span className="qed-err" style={{ color: status.startsWith('Erreur') || status.includes('échec') ? '#b5341f' : '#2f9d5a' }}>{status}</span>}
                </div>
              </div>
            ) : (
              <div className="qed-empty">Sélectionne un objet, ou crée-en un nouveau.</div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
