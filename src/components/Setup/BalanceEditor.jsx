// Éditeur d'équilibrage in-game (outil DEV). Onglet Objets : CRUD complet sur
// la table Supabase quete_items, en maître-détail avec recherche/filtres, fiche
// en sous-onglets (Infos / Effets / Textes), aperçu « carte vivante » sticky et
// garde-fou anti-perte de modifications. Onglets Pouvoirs/Loot : overrides.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RARITIES, SLOTS } from '../../data/items';
import { POWERS } from '../../data/powers';
import { SETS } from '../../data/sets';
import ItemIcon from '../Modals/ItemIcon';
import { ITEM_ASSET_KEYS, assetUrl } from '../../logic/itemAssets';
import {
  fetchItemRows, saveItemRow, deleteItemRow, uploadItemImage, refreshItems,
} from '../../logic/itemsConfig';
import { DEFAULTS, readCache, saveBalance } from '../../logic/balanceConfig';
import { useGameStore } from '../../store/gameStore';
import { TriggerCard, AmountInput, DEFAULT_DICE, makeTrigger } from './EffectBuilder';
import { describeItemEffects, itemEffectLines } from '../../logic/effectText';
import '../../styles/questions-editor.css';
import '../../styles/balance-editor.css';

const TABS = [
  { key: 'items', label: '\u{1F392} Objets' },
  { key: 'sets', label: '⚜️ Sets' },
  { key: 'powers', label: '⚡ Pouvoirs' },
  { key: 'loot', label: '\u{1F3B0} Loot' },
];

const EFFECT_LABELS = {
  timerBonus: 'Timer (+s)', indiceBoost: 'Indice (+rép. éliminées)', moneyPerCorrect: 'Pièces / bonne réponse',
  taxReduction: 'Impôts/taxes (−%)', stealProtection: 'Anti-vol (−%)', reculReduction: 'Recul subi (−cases)', reculReductionPct: 'Recul subi (−%)',
  tempeteImmune: 'Immunité Tempête', oubliProtect: "Anti Trou de l'oubli", fightStealBonus: 'Vol de duel (+pièces)',
  duelImmune: 'Immunité aux duels', moveDieSides: 'Dé de mouvement (4 / 6 / 10)',
  hardcoreChance: 'Question Hardcore (%)',
  lootBonusConsumable: 'Chance loot consommable (+%)', lootBonusEquipment: 'Chance loot équipement (+%)',
  gainMoney: 'Gagne des pièces', gainMoneyAll: 'Pièces à toutes les équipes', moveForward: 'Avance (cases)',
  extraTime: 'Temps prochaine question (+s)', shieldNext: 'Annule le prochain recul',
  gainCharge: 'Recharge un pouvoir', fumigene: 'Annule un pouvoir offensif',
  randomPath: 'Voie aléatoire aux carrefours',
};
const EQUIP_EFFECTS = ['timerBonus', 'indiceBoost', 'moneyPerCorrect', 'taxReduction', 'stealProtection', 'reculReduction', 'reculReductionPct', 'moveDieSides', 'hardcoreChance', 'tempeteImmune', 'oubliProtect', 'duelImmune', 'fightStealBonus', 'lootBonusConsumable', 'lootBonusEquipment', 'randomPath'];
const CONSUM_EFFECTS = ['gainMoney', 'gainMoneyAll', 'moveForward', 'extraTime', 'shieldNext', 'gainCharge', 'fumigene'];
// Effets simples dont la quantité peut être ALÉATOIRE (dé).
const DICEABLE_EFFECTS = new Set([
  'gainMoney', 'gainMoneyAll', 'moveForward', 'extraTime', 'shieldNext',
  'timerBonus', 'indiceBoost', 'moneyPerCorrect', 'taxReduction', 'stealProtection', 'reculReduction', 'fightStealBonus',
  'lootBonusConsumable', 'lootBonusEquipment',
]);
// Effets binaires (immunités / déclencheurs simples) : pas de quantité.
const BINARY_EFFECTS = new Set(['tempeteImmune', 'oubliProtect', 'duelImmune', 'gainCharge', 'fumigene', 'randomPath']);
const diceFor = (type) => (type === 'indiceBoost' ? ['d2', 'd3'] : DEFAULT_DICE);
const isDynamicVal = (v) => typeof v === 'string' || (v != null && typeof v === 'object');

const GROUPS = [
  { slot: 'head', label: '\u{1F3A9} Coiffes' },
  { slot: 'body', label: '\u{1F6E1}️ Armures' },
  { slot: 'feet', label: '\u{1F4FF} Amulettes' },
  { slot: 'consumable', label: '\u{1F9F3} Consommables' },
];
// Filtres de la liste (puces) — « Tout » + un par slot.
const SLOT_FILTERS = [{ slot: 'all', label: 'Tout' }, ...GROUPS.map((g) => ({ slot: g.slot, label: g.label }))];

const FX_LABELS = {
  amount: 'Valeur', count: 'Nombre', bonusTime: 'Bonus temps (s)', bonusMoney: 'Bonus pièces',
  divisor: 'Diviseur du timer', timerDivisor: 'Diviseur timer (rafale)',
  // Arbre Maîtrise — cœur
  add: 'Questions ajoutées', flat: 'Bonus fixe (cases)', mode: 'Mode de relance',
  // Arbre Maîtrise — branches
  goldPerCaseAbsorbed: 'Or / case absorbée', absorbBonusMoney: 'Or par absorption', reflectFraction: 'Recul réfléchi (×)',
  extraHide: 'Réponses éliminées (+)', timerMult: 'Temps de réponse (×)', bonusMoneyOnCorrect: 'Or si bonne réponse',
  minRoll: 'Relance jusqu’à ≥', rerollCount: 'Nb de dés (meilleur)',
  amountMult: 'Recul (×)', extraChargeCost: 'Charges en plus', stealGold: 'Or volé', goldPenaltyOnTimeout: 'Taxe (or)',
  goldMult: 'Or rafale (×)', goldDiv: 'Or rafale (÷)', extraAdd: 'Questions en plus',
};
const LOOT_FIELDS = [
  { k: 'chestLegendaryChance', label: 'Chance légendaire — coffre', pct: true },
  { k: 'fightLegendaryChance', label: 'Chance légendaire — duel', pct: true },
  { k: 'answerLegendaryChance', label: 'Chance légendaire — bonne réponse (équipement)', pct: true },
  { k: 'answerLootRate', label: 'Taux de loot ÉQUIPEMENT — bonne réponse (max)', pct: true },
  { k: 'answerConsumableRate', label: 'Taux de loot CONSOMMABLE — bonne réponse (max)', pct: true },
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
  key: r.key, name: r.name, desc: r.description ?? '', descExpert: r.desc_expert ?? '',
  icon: r.icon ?? '', img: r.img ?? '', set: r.set_key ?? '',
  slot: r.slot, rarity: r.rarity, price: r.price, lootOnly: !!r.loot_only,
  effects: Array.isArray(r.effects) ? r.effects : [], enabled: r.enabled !== false,
  ord: r.ord, _isNew: false,
});
const newDraft = (ord) => ({
  key: '', name: 'Nouvel objet', desc: '', descExpert: '', icon: '✨', img: '', set: '',
  slot: 'head', rarity: 'commun', price: 10, lootOnly: false, effects: [],
  enabled: true, ord, _isNew: true,
});
const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(' ')
  .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('');

const uniqueKey = (name, rows) => {
  const base = slugify(name) || 'objet';
  const taken = new Set((rows || []).map((r) => r.key));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n++;
  return `${base}${n}`;
};

const clone = (v) => JSON.parse(JSON.stringify(v));

const ITEM_SUBTABS = [
  { key: 'infos', label: '\u{1F4CB} Infos' },
  { key: 'effets', label: '✨ Effets' },
  { key: 'textes', label: '\u{1F4DD} Textes' },
];

// Éditeur des effets-bonus d'un set (pool équipement) : simples + déclencheurs.
function SetBonusEditor({ effects, onChange }) {
  const [menu, setMenu] = useState(false);
  const list = effects || [];
  const updateEffect = (i, patch) => onChange(list.map((fx, j) => (j !== i ? fx : (((patch && patch.kind === 'trigger') || (fx && fx.kind === 'trigger')) ? patch : { ...fx, ...patch }))));
  const removeEffect = (i) => onChange(list.filter((_, j) => j !== i));
  const addFx = (mk) => { onChange([...list, mk()]); setMenu(false); };
  const presets = [
    { label: '♾️ Bonus permanent', mk: () => ({ type: EQUIP_EFFECTS[0], value: 1 }) },
    { label: '✅ Quand je réponds bien', mk: () => makeTrigger('correct') },
    { label: '🎯 Quand je tombe sur un thème', mk: () => makeTrigger('questionSubject') },
    { label: '🤺 Quand je gagne un duel', mk: () => makeTrigger('fightWin') },
    { label: '🎲 Selon le dé', mk: () => makeTrigger('roll') },
  ];
  return (
    <div className="qed-field">
      {list.length === 0 && <div className="bal-empty-fx">Aucun bonus.</div>}
      {list.map((fx, i) => (
        fx && fx.kind === 'trigger' ? (
          <TriggerCard key={i} fx={fx} slot="body" onChange={(v) => updateEffect(i, v)} onRemove={() => removeEffect(i)} />
        ) : (
          <div key={i} className="bal-effect">
            <select className="qed-select" value={fx.type} onChange={(ev) => {
              const type = ev.target.value; const patch = { type };
              if (isDynamicVal(fx.value) && (!DICEABLE_EFFECTS.has(type) || (typeof fx.value === 'string' && !diceFor(type).includes(fx.value)))) patch.value = 1;
              updateEffect(i, patch);
            }}>
              {(EQUIP_EFFECTS.includes(fx.type) ? EQUIP_EFFECTS : [fx.type, ...EQUIP_EFFECTS]).map((t) => <option key={t} value={t}>{EFFECT_LABELS[t] || t}</option>)}
            </select>
            {!BINARY_EFFECTS.has(fx.type) && (DICEABLE_EFFECTS.has(fx.type)
              ? <AmountInput value={fx.value ?? 0} onChange={(v) => updateEffect(i, { value: v })} min={1} dice={diceFor(fx.type)} />
              : <Stepper value={fx.value ?? 0} onChange={(v) => updateEffect(i, { value: v })} max={999} />)}
            <button className="btn btn--ghost btn--sm" onClick={() => removeEffect(i)} title="Retirer">{'\u{1F5D1}'}</button>
          </div>
        )
      ))}
      <div style={{ marginTop: 6 }}>
        <button className="btn btn--green btn--sm" onClick={() => setMenu((m) => !m)}>{menu ? '▾' : '+'} Ajouter un bonus</button>
        {menu && (
          <div className="fx-addmenu">
            {presets.map((p) => <button key={p.label} onClick={() => addFx(p.mk)}>{p.label}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BalanceEditor({ onClose }) {
  const syncEnabled = useGameStore((s) => s.syncEnabledItems);
  const [tab, setTab] = useState('items');
  const [rows, setRows] = useState(null);
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null); // copie de référence → détection « non sauvé »
  const [subtab, setSubtab] = useState('infos');
  const [search, setSearch] = useState('');
  const [slotFilter, setSlotFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [picker, setPicker] = useState(false);
  const [fxMenu, setFxMenu] = useState(false);
  const fileRef = useRef(null);
  const [ov, setOv] = useState(() => readCache());
  const [ovBaseline, setOvBaseline] = useState(() => readCache()); // référence pour « non sauvé » (pouvoirs/loot/sets)
  const [selPower, setSelPower] = useState('bouclier');
  const [selSet, setSelSet] = useState(Object.keys(SETS)[0]);

  // Modifications non enregistrées : objet courant (items) / overrides (pouvoirs+loot)
  const dirty = !!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline);
  const ovDirty = JSON.stringify(ov) !== JSON.stringify(ovBaseline);

  // Charge un brouillon comme référence « propre » (réinitialise le garde-fou).
  const loadDraft = (d, { keepSubtab = false } = {}) => {
    setStatus(null);
    setDraft(d);
    setBaseline(d ? clone(d) : null);
    if (!keepSubtab) setSubtab('infos');
  };
  const confirmIfDirty = (msg) => !dirty || window.confirm(msg);
  const chooseRow = (r) => { if (confirmIfDirty('Modifications non enregistrées — changer d’objet et les perdre ?')) loadDraft(rowToDraft(r)); };
  const chooseNew = () => { if (confirmIfDirty('Modifications non enregistrées — créer un objet et les perdre ?')) loadDraft(newDraft(rows?.length || 0)); };
  const handleClose = () => {
    // Prévient quel que soit l'onglet : un brouillon d'objet OU des overrides non sauvés.
    if (!(dirty || ovDirty) || window.confirm('Modifications non enregistrées — fermer et les perdre ?')) onClose();
  };

  // --- Pouvoirs ---
  const pVal = (key, field) => ov.powers?.[key]?.[field] ?? DEFAULTS.powers[key][field];
  const lvFx = (key, i, fxKey) => ov.powers?.[key]?.levels?.[i]?.[fxKey] ?? DEFAULTS.powers[key].levels[i].effect[fxKey];
  const setPowerField = (key, field, value) => {
    setStatus(null);
    setOv((prev) => { const powers = { ...(prev.powers || {}) }; powers[key] = { ...(powers[key] || {}), [field]: value }; return { ...prev, powers }; });
  };
  const setLevelFx = (key, i, fxKey, value) => {
    setStatus(null);
    setOv((prev) => {
      const powers = { ...(prev.powers || {}) };
      const cur = { ...(powers[key] || {}) };
      const levels = cur.levels ? cur.levels.map((l) => ({ ...l })) : [{}, {}, {}];
      levels[i] = { ...levels[i], [fxKey]: value };
      cur.levels = levels; powers[key] = cur;
      return { ...prev, powers };
    });
  };
  // --- Pouvoirs : arbre « Maîtrise » (coûts L1→10, valeurs par niveau, branches) ---
  const treeCost = (key, i) => ov.powers?.[key]?.tree?.upgradeCosts?.[i] ?? DEFAULTS.powers[key].tree.upgradeCosts[i];
  const treeScale = (key, lvl, fxKey) => ov.powers?.[key]?.tree?.scale?.[lvl]?.[fxKey] ?? DEFAULTS.powers[key].tree.scale[lvl][fxKey];
  const treeBranch = (key, slot, j, fxKey) => ov.powers?.[key]?.tree?.[slot]?.[j]?.effect?.[fxKey] ?? DEFAULTS.powers[key].tree[slot][j].effect[fxKey];
  const mutTree = (key, fn) => {
    setStatus(null);
    setOv((prev) => {
      const powers = { ...(prev.powers || {}) };
      const cur = { ...(powers[key] || {}) };
      const dTree = DEFAULTS.powers[key].tree;
      const tree = {
        upgradeCosts: cur.tree?.upgradeCosts ? [...cur.tree.upgradeCosts] : [...dTree.upgradeCosts],
        scale: cur.tree?.scale ? cur.tree.scale.map((s) => ({ ...s })) : dTree.scale.map((s) => ({ ...s })),
        branch5: cur.tree?.branch5 ? cur.tree.branch5.map((b) => ({ ...b, effect: { ...b.effect } })) : dTree.branch5.map((b) => ({ ...b, effect: { ...b.effect } })),
        branch10: cur.tree?.branch10 ? cur.tree.branch10.map((b) => ({ ...b, effect: { ...b.effect } })) : dTree.branch10.map((b) => ({ ...b, effect: { ...b.effect } })),
      };
      fn(tree);
      cur.tree = tree; powers[key] = cur;
      return { ...prev, powers };
    });
  };
  const setTreeCost = (key, i, v) => mutTree(key, (t) => { t.upgradeCosts[i] = v; });
  const setTreeScale = (key, lvl, fxKey, v) => mutTree(key, (t) => { t.scale[lvl] = { ...t.scale[lvl], [fxKey]: v }; });
  const setTreeBranch = (key, slot, j, fxKey, v) => mutTree(key, (t) => { t[slot][j] = { ...t[slot][j], effect: { ...t[slot][j].effect, [fxKey]: v } }; });

  const resetPower = (key) => { setStatus(null); setOv((prev) => { const powers = { ...(prev.powers || {}) }; delete powers[key]; return { ...prev, powers }; }); };

  // --- Sets (bonus à 2/3 pièces) : valeur effective override ?? défaut ---
  const setVal = (k, field) => ov.sets?.[k]?.[field] ?? DEFAULTS.sets[k]?.[field];
  const setSetField = (k, field, value) => {
    setStatus(null);
    setOv((prev) => {
      const sets = { ...(prev.sets || {}) };
      sets[k] = { ...(sets[k] || {}), [field]: value };
      return { ...prev, sets };
    });
  };
  const resetSet = (k) => { setStatus(null); setOv((prev) => { const sets = { ...(prev.sets || {}) }; delete sets[k]; return { ...prev, sets }; }); };

  // --- Loot ---
  const lootVal = (k) => ov.loot?.[k] ?? DEFAULTS.loot[k];
  const setLoot = (k, v) => { setStatus(null); setOv((prev) => ({ ...prev, loot: { ...(prev.loot || {}), [k]: v } })); };

  async function handleSaveBalance() {
    if (busy) return;
    setBusy(true); setStatus(null);
    try { await saveBalance(ov); setOvBaseline(clone(ov)); setStatus('Enregistré ✓'); }
    catch (e) { setStatus('Erreur : ' + (e.message || 'Supabase injoignable')); }
    setBusy(false);
  }

  useEffect(() => { load(); }, []);
  async function load() {
    setStatus(null);
    try {
      const r = await fetchItemRows();
      setRows(r);
      if (!draft && r[0]) loadDraft(rowToDraft(r[0]));
    } catch (e) { setStatus('Erreur : ' + (e.message || 'Supabase injoignable')); setRows([]); }
  }

  const set = (patch) => { setStatus(null); setDraft((d) => ({ ...d, ...patch })); };
  const effectPool = draft?.slot === 'consumable' ? CONSUM_EFFECTS : EQUIP_EFFECTS;

  const updateEffect = (i, patch) => set({
    effects: draft.effects.map((fx, j) => {
      if (j !== i) return fx;
      return (patch && patch.kind === 'trigger') || (fx && fx.kind === 'trigger') ? patch : { ...fx, ...patch };
    }),
  });
  const removeEffect = (i) => set({ effects: draft.effects.filter((_, j) => j !== i) });
  const moveEffect = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= draft.effects.length) return;
    const arr = [...draft.effects];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set({ effects: arr });
  };
  const duplicateEffect = (i) => {
    const arr = [...draft.effects];
    arr.splice(i + 1, 0, clone(draft.effects[i]));
    set({ effects: arr });
  };
  const addFx = (mk) => { set({ effects: [...draft.effects, mk()] }); setFxMenu(false); };
  // Catégories d'effet en langage clair (le menu « + Ajouter un effet »).
  const fxPresets = (slot) => slot === 'consumable' ? [
    { label: '💥 Effet immédiat', sub: 'Gagne des pièces, avance, bouclier…', mk: () => ({ type: CONSUM_EFFECTS[0], value: 1 }) },
    { label: "🎲 À l'utilisation (chance / dé)", sub: 'Une condition puis des effets', mk: () => makeTrigger('use') },
    { label: '🔄 Bouton « Changer la question »', sub: 'Relance la question en jeu', mk: () => makeTrigger('question') },
  ] : [
    { label: '♾️ Bonus permanent', sub: 'Tant que l’objet est équipé', mk: () => ({ type: EQUIP_EFFECTS[0], value: 1 }) },
    { label: '✅ Quand je réponds bien', sub: 'Récompense (option : par matière)', mk: () => makeTrigger('correct') },
    { label: '🎯 Quand je tombe sur un thème', sub: 'Effet auto à l’apparition d’une question de matière(s) choisie(s)', mk: () => makeTrigger('questionSubject') },
    { label: '❌ Quand je rate', sub: 'Malus / effet à l’erreur', mk: () => makeTrigger('wrong') },
    { label: '🤺 Quand je gagne un duel', sub: 'Loot, or, avancer…', mk: () => makeTrigger('fightWin') },
    { label: '🛡️ Quand je perds un duel', sub: 'Lot de consolation, malus…', mk: () => makeTrigger('fightLose') },
    { label: '🎲 Selon le dé (à mon tour)', sub: 'Si le dé fait certaines faces', mk: () => makeTrigger('roll') },
    { label: '🔄 Bouton « Changer la question »', sub: 'Relance la question en jeu', mk: () => makeTrigger('question') },
  ];

  function validate(d) { return !!(d && d.name.trim()); }

  async function handleSave() {
    if (busy || !validate(draft)) return;
    setBusy(true); setStatus(null);
    const toSave = { ...draft, key: draft._isNew ? uniqueKey(draft.name, rows) : draft.key };
    try {
      const saved = await saveItemRow(toSave, { isNew: draft._isNew });
      await refreshItems(); syncEnabled();
      setRows((rs) => {
        const i = rs.findIndex((r) => r.key === saved.key);
        return i >= 0 ? rs.map((r) => (r.key === saved.key ? saved : r)) : [...rs, saved];
      });
      loadDraft(rowToDraft(saved), { keepSubtab: true });
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
      loadDraft(null);
      setStatus('Supprimé');
    } catch (e) { setStatus('Erreur : ' + e.message); }
    setBusy(false);
  }

  async function handleUpload(file) {
    if (!file || busy) return;
    setBusy(true); setStatus(null);
    try { const url = await uploadItemImage(file, draft.key || slugify(draft.name)); set({ img: url }); setPicker(false); }
    catch (e) { setStatus('Upload échec : ' + e.message); }
    if (fileRef.current) fileRef.current.value = '';
    setBusy(false);
  }

  const preview = draft && {
    name: draft.name, desc: draft.desc, icon: draft.icon, img: draft.img,
    slot: draft.slot, rarity: draft.rarity, lootOnly: draft.lootOnly, effects: draft.effects,
  };
  const rar = draft ? (RARITIES[draft.rarity] || { color: '#888', name: '' }) : null;
  const slotLabel = draft && (draft.slot === 'consumable' ? 'Consommable' : SLOTS[draft.slot]?.name);

  // Liste filtrée (recherche + slot)
  const q = search.trim().toLowerCase();
  const matches = (r) => (slotFilter === 'all' || r.slot === slotFilter) && (!q || r.name.toLowerCase().includes(q));

  const statusColor = status && (status.startsWith('Erreur') || status.includes('échec')) ? '#b5341f' : '#2f9d5a';

  return createPortal(
    <div className="qed-overlay" onPointerDown={(ev) => { if (ev.target === ev.currentTarget) handleClose(); }}>
      <div className="qed-panel">
        <div className="qed-head">
          <span className="qed-title">{'⚖️'} Éditeur d'équilibrage</span>
          <span className="qed-status">
            {tab === 'items' ? (rows == null ? 'Chargement…' : `${rows.length} objets`)
              : tab === 'powers' ? `${Object.keys(ov.powers || {}).length} pouvoir(s) modifié(s)`
              : tab === 'sets' ? `${Object.keys(SETS).length} sets`
              : `${Object.keys(ov.loot || {}).length} réglage(s) modifié(s)`}
            {status && <span style={{ marginLeft: 6, color: status.startsWith('Erreur') || status.includes('échec') ? '#ffd9d0' : '#d6ffe0' }}>· {status}</span>}
          </span>
          <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={handleClose}>{'✕'} Fermer</button>
        </div>

        <div className="qed-toolbar">
          <div className="qed-tabs">
            {TABS.map((t) => (
              <button key={t.key} className={`qed-tab ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          {tab === 'items' && (
            <button className="btn btn--green btn--sm" style={{ marginLeft: 'auto' }} onClick={chooseNew}>{'+'} Nouvel objet</button>
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
            <div className="bal-detail">
              <div className="bal-detail-scroll">
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

                    <div className="bal-default" style={{ marginTop: 14, fontWeight: 700 }}>Sans l'extension Maîtrise — 3 niveaux :</div>
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

                    {/* === Extension « Maîtrise » : arbre niveaux 1→10 + branches === */}
                    {p.tree && (
                      <>
                        <div className="qed-field" style={{ marginTop: 18 }}>
                          <label className="qed-label">{'⚡'} Maîtrise — Coûts d'amélioration (niv. 1→10)</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {d.tree.upgradeCosts.map((c, i) => (
                              <div key={i} className="bal-row">
                                <span className="bal-label">Niv.{i + 1}→{i + 2}</span>
                                <input className="qed-input" style={{ width: 64 }} type="number" min="0"
                                  value={treeCost(k, i)} onChange={(e) => setTreeCost(k, i, Math.max(0, Math.round(Number(e.target.value) || 0)))} />
                                <span className="bal-default">déf. {c}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="qed-field" style={{ marginTop: 10 }}>
                          <label className="qed-label">Valeurs par niveau (1→10)</label>
                          {d.tree.scale.map((s, lvl) => {
                            const keys = Object.entries(s).filter(([key]) => key !== 'type');
                            if (!keys.length) return null;
                            return (
                              <div key={lvl} style={{ marginTop: 6 }}>
                                <div className="bal-default" style={{ fontWeight: 700, color: 'var(--ink-700)' }}>Niveau {lvl + 1}</div>
                                {keys.map(([fxKey, dv]) => (
                                  <div key={fxKey} className="bal-row">
                                    <span className="bal-label">{FX_LABELS[fxKey] || fxKey}</span>
                                    {typeof dv === 'string'
                                      ? <input className="qed-input" style={{ width: 64 }} value={treeScale(k, lvl, fxKey)} onChange={(e) => setTreeScale(k, lvl, fxKey, e.target.value)} />
                                      : <input className="qed-input" style={{ width: 64 }} type="number" step="any" value={treeScale(k, lvl, fxKey)} onChange={(e) => setTreeScale(k, lvl, fxKey, e.target.value === '' ? dv : Number(e.target.value))} />}
                                    <span className="bal-default">déf. {String(dv)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>

                        {[['branch5', 5], ['branch10', 10]].map(([slot, lvl]) => (
                          <div key={slot} className="qed-field" style={{ marginTop: 10 }}>
                            <label className="qed-label">{'🌟'} Embranchement niv.{lvl} — les 3 voies</label>
                            {d.tree[slot].map((br, j) => {
                              const keys = Object.entries(br.effect).filter(([, v]) => typeof v === 'number' || typeof v === 'string');
                              return (
                                <div key={j} style={{ marginTop: 6 }}>
                                  <div className="bal-default" style={{ fontWeight: 700, color: 'var(--ink-700)' }}>{br.icon} {br.name}</div>
                                  {keys.length === 0 && <div className="bal-default">aucune valeur réglable</div>}
                                  {keys.map(([fxKey, dv]) => (
                                    <div key={fxKey} className="bal-row">
                                      <span className="bal-label">{FX_LABELS[fxKey] || fxKey}</span>
                                      {typeof dv === 'string'
                                        ? <input className="qed-input" style={{ width: 64 }} value={treeBranch(k, slot, j, fxKey)} onChange={(e) => setTreeBranch(k, slot, j, fxKey, e.target.value)} />
                                        : <input className="qed-input" style={{ width: 64 }} type="number" step="any" value={treeBranch(k, slot, j, fxKey)} onChange={(e) => setTreeBranch(k, slot, j, fxKey, e.target.value === '' ? dv : Number(e.target.value))} />}
                                      <span className="bal-default">déf. {String(dv)}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
              </div>
              <div className="bal-detail-foot">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy || !ovDirty}>{busy ? 'Enregistrement…' : (ovDirty ? 'Enregistrer' : 'Enregistré ✓')}</button>
                <button className="btn btn--ghost" onClick={() => resetPower(selPower)} disabled={!ov.powers?.[selPower]}>{'↺'} Valeurs d'origine</button>
                {ovDirty && <span className="bal-default" style={{ color: '#b5341f' }}>● non enregistré</span>}
                {status && <span className="qed-err" style={{ color: statusColor }}>{status}</span>}
              </div>
            </div>
          </div>
        ) : tab === 'sets' ? (
          <div className="qed-body">
            <div className="qed-list">
              {Object.entries(SETS).map(([k, s]) => (
                <button key={k} className={`qed-item ${selSet === k ? 'is-active' : ''}`} onClick={() => { setSelSet(k); setStatus(null); }}>
                  <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{s.icon}</span>
                  <span style={{ flex: 1 }}>{setVal(k, 'name') || s.name}</span>
                  {ov.sets?.[k] && <span className="qed-item-tag" title="Modifié">{'✎'}</span>}
                </button>
              ))}
            </div>
            <div className="bal-detail">
              <div className="bal-detail-scroll">
                {(() => {
                  const k = selSet; const s = SETS[k]; if (!s) return null;
                  const members = (rows || []).filter((r) => r.set_key === k);
                  return (
                    <>
                      <div className="bal-card bal-card--mini">
                        <span style={{ fontSize: 36 }}>{s.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input className="qed-input" value={setVal(k, 'name') || ''} onChange={(e) => setSetField(k, 'name', e.target.value)} />
                          <div className="bal-default" style={{ marginTop: 4 }}>
                            {members.length} pièce{members.length > 1 ? 's' : ''} assignée{members.length > 1 ? 's' : ''}{members.length ? ` : ${members.map((r) => r.name).join(', ')}` : ' (assigne des objets via leur onglet Infos → Set)'}
                          </div>
                        </div>
                      </div>
                      <div className="qed-label" style={{ marginTop: 12 }}>{'\u{1F948}'} Bonus à 2 pièces équipées</div>
                      <SetBonusEditor effects={setVal(k, 'bonus2') || []} onChange={(e) => setSetField(k, 'bonus2', e)} />
                      <div className="qed-label" style={{ marginTop: 14 }}>{'\u{1F947}'} Bonus à 3 pièces équipées</div>
                      <SetBonusEditor effects={setVal(k, 'bonus3') || []} onChange={(e) => setSetField(k, 'bonus3', e)} />
                    </>
                  );
                })()}
              </div>
              <div className="bal-detail-foot">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy || !ovDirty}>{busy ? 'Enregistrement…' : (ovDirty ? 'Enregistrer' : 'Enregistré ✓')}</button>
                <button className="btn btn--ghost" onClick={() => resetSet(selSet)} disabled={!ov.sets?.[selSet]}>{'↺'} Valeurs d'origine</button>
                {ovDirty && <span className="bal-default" style={{ color: '#b5341f' }}>● non enregistré</span>}
                {status && <span className="qed-err" style={{ color: statusColor }}>{status}</span>}
              </div>
            </div>
          </div>
        ) : tab === 'loot' ? (
          <div className="qed-body">
            <div className="bal-detail">
              <div className="bal-detail-scroll">
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
              </div>
              <div className="bal-detail-foot">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy || !ovDirty}>{busy ? 'Enregistrement…' : (ovDirty ? 'Enregistrer' : 'Enregistré ✓')}</button>
                <button className="btn btn--ghost" onClick={() => setOv((prev) => ({ ...prev, loot: {} }))}>{'↺'} Valeurs d'origine</button>
                {ovDirty && <span className="bal-default" style={{ color: '#b5341f' }}>● non enregistré</span>}
                {status && <span className="qed-err" style={{ color: statusColor }}>{status}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="qed-body">
            <div className="qed-list">
              {/* Recherche + filtres de slot */}
              <div className="bal-listtools">
                <input className="qed-search" placeholder="🔎 Rechercher un objet…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="bal-chips">
                  {SLOT_FILTERS.map((f) => (
                    <button key={f.slot} className={`bal-chip ${slotFilter === f.slot ? 'is-active' : ''}`} onClick={() => setSlotFilter(f.slot)}>{f.label}</button>
                  ))}
                </div>
              </div>
              {rows == null && <div style={{ padding: 12, color: 'var(--ink-500)' }}>Chargement…</div>}
              {rows != null && GROUPS.map((g) => {
                if (slotFilter !== 'all' && slotFilter !== g.slot) return null;
                const list = (rows || []).filter((r) => r.slot === g.slot && matches(r));
                if (!list.length) return null;
                return (
                  <div key={g.slot}>
                    <div className="qed-label" style={{ margin: '8px 6px 4px' }}>{g.label} <span className="bal-default">({list.length})</span></div>
                    {list.map((r) => {
                      const active = draft && draft.key === r.key && !draft._isNew;
                      return (
                        <button key={r.key}
                          className={`qed-item ${active ? 'is-active' : ''} ${r.enabled === false ? 'is-disabled' : ''}`}
                          onClick={() => chooseRow(r)}>
                          <ItemIcon item={{ name: r.name, img: r.img, icon: r.icon, rarity: r.rarity, slot: r.slot }} size={30} ring />
                          <span style={{ flex: 1 }}>{r.name}</span>
                          {active && dirty && <span className="bal-dirty-dot" title="Modifications non enregistrées" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {rows != null && !rows.some(matches) && (
                <div style={{ padding: 12, color: 'var(--ink-500)', fontSize: 13 }}>Aucun objet ne correspond.</div>
              )}
            </div>

            {draft ? (
              <div className="bal-detail">
                {/* Aperçu carte vivante + sous-onglets (collés en haut) */}
                <div className="bal-detail-top">
                  <div className="bal-card bal-card--mini">
                    <ItemIcon item={preview} size={64} radius={16} ring />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                      <span className="bal-pill" style={{ background: rar.color, alignSelf: 'flex-start' }}>{rar.name} · {slotLabel}</span>
                      <div className="bal-card-name" style={{ fontSize: 17 }}>{draft.name || '—'}</div>
                      <div className="bal-card-desc" style={{ minHeight: 0, textAlign: 'left' }}>{draft.desc || <em style={{ opacity: 0.5 }}>Pas de description</em>}</div>
                    </div>
                  </div>
                  <div className="bal-subtabs">
                    {ITEM_SUBTABS.map((s) => (
                      <button key={s.key} className={`bal-subtab ${subtab === s.key ? 'is-active' : ''}`} onClick={() => setSubtab(s.key)}>
                        {s.label}{s.key === 'effets' && draft.effects.length ? ` (${draft.effects.length})` : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contenu défilant du sous-onglet courant */}
                <div className="bal-detail-scroll">
                  {subtab === 'infos' && (
                    <>
                      <div className="qed-field">
                        <label className="qed-label">Nom</label>
                        <input className="qed-input" value={draft.name} onChange={(ev) => set({ name: ev.target.value })} />
                      </div>

                      <div className="bal-row">
                        <span className="bal-label">Image</span>
                        <button className="btn btn--ghost btn--sm" onClick={() => setPicker((p) => !p)}>
                          {draft.img ? 'Changer l’image' : 'Choisir une image'}
                        </button>
                        {draft.img && <button className="btn btn--ghost btn--sm" onClick={() => set({ img: '' })}>Retirer</button>}
                        <span className="bal-default">ou emoji :</span>
                        <input className="qed-input" style={{ width: 64, textAlign: 'center' }} value={draft.icon} onChange={(ev) => set({ icon: ev.target.value })} />
                      </div>

                      {picker && (
                        <div className="bal-picker">
                          {ITEM_ASSET_KEYS.map((k) => (
                            <button key={k} className={`bal-thumb ${draft.img === k ? 'is-sel' : ''}`} title={k} onClick={() => { set({ img: k }); setPicker(false); }}>
                              <img src={assetUrl(k)} alt={k} />
                            </button>
                          ))}
                          <button className="bal-thumb bal-upload" onClick={() => fileRef.current?.click()} title="Uploader une image">{busy ? '…' : '⬆️'}</button>
                          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(ev) => handleUpload(ev.target.files?.[0])} />
                        </div>
                      )}

                      <div className="bal-row" style={{ marginTop: 10 }}>
                        <span className="bal-label">Emplacement</span>
                        <select className="qed-select" style={{ width: 170 }} value={draft.slot}
                          onChange={(ev) => set({ slot: ev.target.value, effects: [] })}>
                          <option value="head">Coiffe</option>
                          <option value="body">Armure</option>
                          <option value="feet">Amulette</option>
                          <option value="consumable">Consommable</option>
                        </select>
                        <span className="bal-default">change d’emplacement = remet les effets à zéro</span>
                      </div>

                      <div className="bal-row">
                        <span className="bal-label">Rareté</span>
                        <select className="qed-select" style={{ width: 170 }} value={draft.rarity} onChange={(ev) => set({ rarity: ev.target.value })}>
                          {Object.entries(RARITIES).map(([k, r]) => <option key={k} value={k}>{r.name}</option>)}
                        </select>
                      </div>

                      <div className="bal-row">
                        <span className="bal-label">Prix</span>
                        <Stepper value={draft.price} onChange={(v) => set({ price: v })} max={999} />
                        <span className="bal-default">pièces en boutique</span>
                      </div>

                      {draft.slot !== 'consumable' && (
                        <div className="bal-row">
                          <span className="bal-label">Set</span>
                          <select className="qed-select" style={{ width: 200 }} value={draft.set || ''} onChange={(ev) => set({ set: ev.target.value })}>
                            <option value="">— aucun —</option>
                            {Object.entries(SETS).map(([k, s]) => <option key={k} value={k}>{s.icon} {s.name}</option>)}
                          </select>
                          <span className="bal-default">bonus à 2/3 pièces équipées</span>
                        </div>
                      )}

                      <label className="bal-toggle" style={{ marginTop: 4 }}>
                        <input type="checkbox" checked={!!draft.lootOnly} onChange={(ev) => set({ lootOnly: ev.target.checked })} />
                        Loot only — introuvable en boutique (reste en loot : coffres, duels…)
                      </label>
                      <label className="bal-toggle" style={{ marginTop: 8 }}>
                        <input type="checkbox" checked={draft.enabled} onChange={(ev) => set({ enabled: ev.target.checked })} />
                        Activé (décocher = retiré du jeu sans le supprimer)
                      </label>
                    </>
                  )}

                  {subtab === 'effets' && (
                    <div className="qed-field">
                      {draft.effects.length === 0 && (
                        <div className="bal-empty-fx">Aucun effet. Ajoute-en un ci-dessous.</div>
                      )}
                      {draft.effects.map((fx, i) => (
                        <div key={i} className="bal-fx-item">
                          <div className="bal-fx-ctrl">
                            <span className="bal-fx-num">#{i + 1}</span>
                            <button className="bal-fx-move" disabled={i === 0} onClick={() => moveEffect(i, -1)} title="Monter">↑</button>
                            <button className="bal-fx-move" disabled={i === draft.effects.length - 1} onClick={() => moveEffect(i, 1)} title="Descendre">↓</button>
                            <button className="bal-fx-move" onClick={() => duplicateEffect(i)} title="Dupliquer">{'⧉'}</button>
                          </div>
                        {fx && fx.kind === 'trigger' ? (
                          <TriggerCard fx={fx} slot={draft.slot} onChange={(v) => updateEffect(i, v)} onRemove={() => removeEffect(i)} />
                        ) : (
                          <div className="bal-effect">
                            <select className="qed-select" value={fx.type} onChange={(ev) => {
                              const type = ev.target.value;
                              const patch = { type };
                              if (isDynamicVal(fx.value) && (!DICEABLE_EFFECTS.has(type) || (typeof fx.value === 'string' && !diceFor(type).includes(fx.value)))) patch.value = 1;
                              updateEffect(i, patch);
                            }}>
                              {(effectPool.includes(fx.type) ? effectPool : [fx.type, ...effectPool]).map((t) => (
                                <option key={t} value={t}>{EFFECT_LABELS[t] || t}</option>
                              ))}
                            </select>
                            {!BINARY_EFFECTS.has(fx.type) && (DICEABLE_EFFECTS.has(fx.type)
                              ? <AmountInput value={fx.value ?? 0} onChange={(v) => updateEffect(i, { value: v })} min={1} dice={diceFor(fx.type)} />
                              : <Stepper value={fx.value ?? 0} onChange={(v) => updateEffect(i, { value: v })} max={999} />)}
                            <span className="bal-fx-chance" title="Probabilité que l'effet se déclenche (100 % = toujours)"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--ink-500)' }}>
                              <span>déclenche</span>
                              <input type="number" className="qed-input" style={{ width: 74 }} min={1} max={100}
                                value={Math.round((typeof fx.chance === 'number' ? fx.chance : 1) * 100)}
                                onChange={(ev) => { const pct = Math.max(1, Math.min(100, Number(ev.target.value) || 0)); updateEffect(i, { chance: pct >= 100 ? undefined : pct / 100 }); }} />
                              <span>%</span>
                            </span>
                            <button className="btn btn--ghost btn--sm" onClick={() => removeEffect(i)} title="Retirer">{'\u{1F5D1}'}</button>
                          </div>
                        )}
                        </div>
                      ))}
                      <div style={{ marginTop: 8 }}>
                        <button className="btn btn--green btn--sm" onClick={() => setFxMenu((m) => !m)}>
                          {fxMenu ? '▾' : '+'} Ajouter un effet
                        </button>
                        {fxMenu && (
                          <div className="fx-addmenu">
                            {fxPresets(draft.slot).map((p) => (
                              <button key={p.label} onClick={() => addFx(p.mk)}>
                                {p.label}<small>{p.sub}</small>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {subtab === 'textes' && (
                    <>
                      <div className="qed-field">
                        <label className="qed-label">Description simple (vue par les élèves)</label>
                        <textarea className="qed-textarea" value={draft.desc} onChange={(ev) => set({ desc: ev.target.value })}
                          placeholder="Effet en clair, sans chiffres (le détail exact est sous le bouton « Détail de l'effet »)." />
                      </div>

                      <div className="qed-field">
                        <label className="qed-label" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          Détail de l'effet (bouton « Détail » en jeu)
                          <button type="button" className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }}
                            onClick={() => set({ descExpert: describeItemEffects(draft).join('\n') })}
                            disabled={describeItemEffects(draft).length === 0}>{'↻'} Générer depuis les effets</button>
                          {draft.descExpert?.trim() && (
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => set({ descExpert: '' })}>{'↺'} Auto</button>
                          )}
                        </label>
                        <textarea className="qed-textarea" value={draft.descExpert} onChange={(ev) => set({ descExpert: ev.target.value })}
                          placeholder={describeItemEffects(draft).join('\n') || "Texte détaillé… (une ligne = une puce). Laisse vide pour le texte auto-généré."} />
                        <div style={{ fontSize: 11, color: 'var(--ink-500)', marginTop: 2 }}>
                          {draft.descExpert?.trim() ? 'Override manuel actif (le texte ci-dessus prime sur l’auto-généré).' : 'Vide → texte auto-généré depuis les effets (aperçu ci-dessous).'}
                        </div>
                        {itemEffectLines(draft).length > 0 && (
                          <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'rgba(91,140,58,0.08)', border: '1px solid rgba(91,140,58,0.25)' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', marginBottom: 4 }}>{'👁️'} Aperçu en jeu</div>
                            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: 'var(--ink-800)', lineHeight: 1.5 }}>
                              {itemEffectLines(draft).map((l, i) => <li key={i}>{l}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Pied d'action collé en bas */}
                <div className="bal-detail-foot">
                  <button className="btn btn--green" onClick={handleSave} disabled={busy || !validate(draft) || !dirty}>
                    {busy ? 'Enregistrement…' : (draft._isNew ? 'Créer' : (dirty ? 'Enregistrer' : 'Enregistré ✓'))}
                  </button>
                  {!draft._isNew && (
                    <button className="btn btn--ghost" onClick={handleDelete} disabled={busy} style={{ color: '#b5341f' }}>Supprimer</button>
                  )}
                  {dirty && <span className="bal-default" style={{ color: '#b5341f' }}>● modifications non enregistrées</span>}
                  {!validate(draft) && <span className="qed-err">Un nom est requis.</span>}
                  {status && <span className="qed-err" style={{ color: statusColor }}>{status}</span>}
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
