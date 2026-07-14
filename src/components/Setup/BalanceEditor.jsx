// Éditeur d'équilibrage in-game (outil DEV). Onglet Objets : CRUD complet sur
// la table Supabase quete_items, en maître-détail avec recherche/filtres, fiche
// en sous-onglets (Infos / Effets / Textes), aperçu « carte vivante » sticky et
// garde-fou anti-perte de modifications. Onglets Pouvoirs/Loot : overrides.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ITEMS, RARITIES, SLOTS } from '../../data/items';
import { SUBJECTS, SUBJECT_KEYS, FORCED_SUBJECT_KEYS } from '../../data/subjects';
import { POWERS } from '../../data/powers';
import { SETS } from '../../data/sets';
import ItemIcon from '../Modals/ItemIcon';
import { ITEM_ASSET_KEYS, assetUrl } from '../../logic/itemAssets';
import {
  fetchItemRows, saveItemRow, deleteItemRow, uploadItemImage, refreshItems,
} from '../../logic/itemsConfig';
import { fetchRecipeRows, saveRecipeRow, deleteRecipeRow, refreshRecipes } from '../../logic/recipesConfig';
import { BASE_RECIPES } from '../../data/recipes';
import { fetchSpellRows, saveSpellRow, deleteSpellRow, refreshSpells } from '../../logic/spellsConfig';
import { BASE_SPELLS } from '../../data/spells';
import { RUNES, RUNE_KEYS, runeName } from '../../data/runes';
import { DEFAULTS, readCache, saveBalance } from '../../logic/balanceConfig';
import { tierLevelsFor } from '../../logic/powerEffects';
import { FORGE_EFFECTS } from '../../logic/forgeEffects';
import { faceEffects, MAX_FACE_EFFECTS, MAX_FACE_VALUE } from '../../logic/forge';
import { WEATHER_KEYS, weatherName, weatherIcon } from '../../data/weather';
import FaceTile from '../Game/FaceTile';
import { useGameStore } from '../../store/gameStore';
import { TriggerCard, AmountInput, DEFAULT_DICE, makeTrigger, ActionList, defaultAction, describeAction } from './EffectBuilder';
import AlchemyRecipeForm, { recipeLine } from './AlchemyRecipeForm';
import { describeItemEffects, itemEffectLines } from '../../logic/effectText';
import '../../styles/questions-editor.css';
import '../../styles/balance-editor.css';

const TABS = [
  { key: 'items', label: '\u{1F392} Objets' },
  { key: 'alchemy', label: '⚗️ Alchimie' },
  { key: 'sets', label: '⚜️ Sets' },
  { key: 'powers', label: '⚡ Pouvoirs' },
  { key: 'loot', label: '\u{1F3B0} Loot' },
  { key: 'forge', label: '\u{1F3B2} Forge' },
  { key: 'weather', label: '🌦️ Météo' },
  { key: 'spells', label: '✨ Sorts' },
];

// Modèle d'une recette en cours d'édition (onglet Alchimie).
const recipeRowToDraft = (r) => ({ key: r.key, ingredients: [...(r.ingredients || []), '', '', ''].slice(0, 3), potion: r.potion || '', isNew: false });
const rand4 = () => Math.random().toString(36).slice(2, 6);

const EFFECT_LABELS = {
  timerBonus: 'Timer (+s)', indiceBoost: 'Indice (+rép. éliminées)', moneyPerCorrect: 'Pièces / bonne réponse',
  taxReduction: 'Impôts/taxes (−%)', stealProtection: 'Anti-vol (−%)', reculReduction: 'Recul subi (−cases)', reculReductionPct: 'Recul subi (−%)',
  diceMalus: 'Malus de dé (−cases / lancer)',
  tempeteImmune: 'Immunité Tempête', oubliProtect: "Anti Trou de l'oubli", fightStealBonus: 'Vol de duel (+pièces)',
  duelImmune: 'Immunité aux duels',
  trapImmune: 'Immunité aux pièges',
  hardcoreChance: 'Question Hardcore (%)',
  itemStealImmune: "Immunité vol d'objet", goldStealImmune: "Immunité vol d'or", reflectChance: "Renvoi d'effet (% chance)",
  lootBonusConsumable: 'Chance loot consommable (+%)', lootBonusEquipment: 'Chance loot équipement (+%)',
  lootBonusSubject: 'Loot +% sur une matière',
  gainMoney: 'Gagne des pièces', gainMoneyAll: 'Pièces à toutes les équipes', moveForward: 'Avance (cases)',
  extraTime: 'Temps prochaine question (+s)', shieldNext: 'Annule le prochain recul',
  gainCharge: 'Recharge un pouvoir', fumigene: 'Annule un pouvoir offensif',
  randomPath: 'Voie aléatoire aux carrefours',
  magicRegen: 'Magie : régénération (+✨/min)', magicMax: 'Magie : plafond (+✨ max)',
};
// Unité affichée dans l'aperçu chiffré de l'éditeur (AmountInput) selon l'effet.
const EFFECT_UNIT = {
  timerBonus: ' s', extraTime: ' s', indiceBoost: ' rép.',
  moneyPerCorrect: ' 🪙', fightStealBonus: ' 🪙', gainMoney: ' 🪙', gainMoneyAll: ' 🪙',
  taxReduction: ' %', stealProtection: ' %', reculReductionPct: ' %', hardcoreChance: ' %',
  lootBonusConsumable: ' %', lootBonusEquipment: ' %', lootBonusSubject: ' %', reflectChance: ' %',
  reculReduction: ' case(s)', moveForward: ' case(s)', diceMalus: ' case(s)',
};
// ⚠️ magicRegen/magicMax : valeurs FIXES uniquement (JAMAIS dans DICEABLE_EFFECTS) —
// le taux de régén est relu en continu (accrual lazy, cf. logic/magic.js) et doit
// rester stable entre deux lectures ; ils sont donc édités au Stepper (nombre).
const EQUIP_EFFECTS = ['timerBonus', 'indiceBoost', 'moneyPerCorrect', 'taxReduction', 'stealProtection', 'reculReduction', 'reculReductionPct', 'diceMalus', 'hardcoreChance', 'tempeteImmune', 'oubliProtect', 'duelImmune', 'trapImmune', 'fightStealBonus', 'lootBonusConsumable', 'lootBonusEquipment', 'lootBonusSubject', 'randomPath', 'itemStealImmune', 'goldStealImmune', 'reflectChance', 'magicRegen', 'magicMax'];
const CONSUM_EFFECTS = ['gainMoney', 'gainMoneyAll', 'moveForward', 'extraTime', 'shieldNext', 'gainCharge', 'fumigene'];
// Effets simples dont la quantité peut être ALÉATOIRE (dé).
const DICEABLE_EFFECTS = new Set([
  'gainMoney', 'gainMoneyAll', 'moveForward', 'extraTime', 'shieldNext',
  'timerBonus', 'indiceBoost', 'moneyPerCorrect', 'taxReduction', 'stealProtection', 'reculReduction', 'diceMalus', 'fightStealBonus',
  'lootBonusConsumable', 'lootBonusEquipment', 'lootBonusSubject',
]);
// Effets binaires (immunités / déclencheurs simples) : pas de quantité.
const BINARY_EFFECTS = new Set(['tempeteImmune', 'oubliProtect', 'duelImmune', 'trapImmune', 'gainCharge', 'fumigene', 'randomPath', 'itemStealImmune', 'goldStealImmune']);
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
  // Arbre Maîtrise — Relance
  refundChance: 'Chance de remboursement', dieSides: 'Faces du dé', goldPerRoll: 'Or / valeur du dé',
  reqTimeBonus: 'Bonus de temps (s)', rechargeOnHigh: 'Seuil recharge (6+)',
  lootBonusOnHigh: 'Bonus de loot (×)', doubleLootOnHigh: 'Chance 2ᵉ loot (×)',
  swapCost: 'Coût en charges', lateStarterCharge: 'Charge retardataire',
};
const LOOT_FIELDS = [
  { k: 'chestLegendaryChance', label: 'Chance légendaire — coffre', pct: true },
  { k: 'fightLegendaryChance', label: 'Chance légendaire — duel', pct: true },
  { k: 'answerLegendaryChance', label: 'Chance légendaire — bonne réponse (équipement)', pct: true },
  { k: 'answerLootRate', label: 'Taux de loot ÉQUIPEMENT — bonne réponse (max)', pct: true },
  { k: 'answerConsumableRate', label: 'Taux de loot CONSOMMABLE — bonne réponse (max)', pct: true },
  { k: 'answerIngredientRate', label: 'Taux de loot INGRÉDIENT — bonne réponse (max)', pct: true },
  { k: 'shopWeightCommon', label: 'Poids boutique — commun', pct: false },
  { k: 'shopWeightOther', label: 'Poids boutique — rare/légendaire', pct: false },
];

// Champ numérique : on peut TAPER la valeur directement (éditeur utilisé au
// clavier sur PC) OU ajuster avec − / +. La saisie est libre pendant la frappe
// et bornée [min,max] à la validation (blur / Entrée).
function Stepper({ value, onChange, min = 0, max = 999, step = 1 }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = () => {
    const n = Number(text);
    if (text === '' || Number.isNaN(n)) { setText(String(value)); return; }
    onChange(Math.max(min, Math.min(max, n)));
  };
  return (
    <span className="bal-stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>{'−'}</button>
      <input
        type="number" className="bal-val bal-val-input"
        value={text} min={min} max={max} step={step}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }}
      />
      <button onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>{'+'}</button>
    </span>
  );
}

// Éditeur de l'onglet « Météo » (extension weather) : overrides de balanceConfig
// .WEATHER (cadence, poids/préavis par météo, valeurs de chaque météo, pool de
// la pluie maudite). Tout est éditable, rien en dur.
function WeatherTab({ ov, setOv, setStatus }) {
  const D = DEFAULTS.weather;
  const w = ov.weather || {};
  // Setter générique : clone l'override météo, applique la mutation, re-pose.
  const edit = (mut) => { setStatus(null); setOv((p) => { const nw = JSON.parse(JSON.stringify(p.weather || {})); mut(nw); return { ...p, weather: nw }; }); };
  const sub = (sec) => ({ ...D[sec], ...(w[sec] || {}) });
  const cad = sub('cadence');
  const vent = sub('vent');
  const num = (val, onChange, { step = 1, min = 0, max = 9999, width = 80 } = {}) => (
    <input type="number" className="qed-input" style={{ width }} step={step} min={min} max={max}
      value={val} onChange={(e) => onChange(Math.max(min, Math.min(max, parseFloat(e.target.value) || 0)))} />
  );
  return (
    <>
      <div className="qed-label" style={{ marginBottom: 10 }}>Cadence du tirage</div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>Écart minimum (cooldown, tours)</span>
        <Stepper value={cad.min} onChange={(v) => edit((nw) => { nw.cadence = { ...cad, min: v }; })} min={1} max={20} />
        <span className="bal-default">défaut : {D.cadence.min}</span></div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>Écart maximum (tirage garanti)</span>
        <Stepper value={cad.max} onChange={(v) => edit((nw) => { nw.cadence = { ...cad, max: v }; })} min={1} max={20} />
        <span className="bal-default">défaut : {D.cadence.max}</span></div>

      <div className="qed-label" style={{ margin: '16px 0 8px' }}>Météos — poids de tirage & préavis</div>
      {WEATHER_KEYS.map((id) => {
        const weight = w.weights?.[id] ?? D.weights[id] ?? 0;
        const pre = w.preavis?.[id] ?? D.preavis[id] ?? false;
        return (
          <div className="bal-row" key={id} style={{ gap: 10, flexWrap: 'wrap' }}>
            <span className="bal-label" style={{ width: 220 }}>{weatherIcon(id)} {weatherName(id, 'fr')}</span>
            <span className="bal-default">poids</span>
            <Stepper value={weight} onChange={(v) => edit((nw) => { nw.weights = { ...(nw.weights || {}), [id]: v }; })} min={0} max={50} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <input type="checkbox" checked={!!pre} onChange={(e) => edit((nw) => { nw.preavis = { ...(nw.preavis || {}), [id]: e.target.checked }; })} />
              <span className="bal-default">préavis (1 tour avant)</span>
            </label>
          </div>
        );
      })}

      <div className="qed-label" style={{ margin: '16px 0 8px' }}>Valeurs des météos</div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>🌬️ Vent — durée ambiante (tours)</span>
        <Stepper value={sub('durations').ventContraire} onChange={(v) => edit((nw) => { nw.durations = { ...sub('durations'), ventContraire: v, ventArriere: v }; })} min={1} max={9} />
        <span className="bal-default">(les deux vents)</span></div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>🌬️ Vent contraire — facteur (÷)</span>
        {num(vent.contraireFactor, (v) => edit((nw) => { nw.vent = { ...vent, contraireFactor: v }; }), { step: 0.1, min: 0.1, max: 1 })}
        <span className="bal-default">défaut : {D.vent.contraireFactor}</span></div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>🌬️ Vent arrière — facteur (×)</span>
        {num(vent.arriereFactor, (v) => edit((nw) => { nw.vent = { ...vent, arriereFactor: v }; }), { step: 0.5, min: 1, max: 5 })}
        <span className="bal-default">défaut : {D.vent.arriereFactor}</span></div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>☀️ Soleil — charges rechargées</span>
        <Stepper value={sub('soleil').charge} onChange={(v) => edit((nw) => { nw.soleil = { ...sub('soleil'), charge: v }; })} min={1} max={5} /></div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>⛈️ Orage — % de cases frappées</span>
        {num(sub('orage').tileRatio, (v) => edit((nw) => { nw.orage = { ...sub('orage'), tileRatio: v }; }), { step: 0.05, min: 0, max: 1 })}
        <span className="bal-default">= {Math.round(sub('orage').tileRatio * 100)}%</span></div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>🌧️ Pluie acide — or perdu (sans équip.)</span>
        <Stepper value={sub('pluieAcide').gold} onChange={(v) => edit((nw) => { nw.pluieAcide = { ...sub('pluieAcide'), gold: v }; })} min={0} max={200} /></div>
      <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>🌍 Séisme — nombre de secousses</span>
        <Stepper value={sub('seisme').ticks} onChange={(v) => edit((nw) => { nw.seisme = { ...sub('seisme'), ticks: v }; })} min={1} max={12} /></div>

      <div className="qed-label" style={{ margin: '16px 0 8px' }}>🌧️ Pluie maudite — pool de malédictions (poids)</div>
      {(() => {
        const pool = { ...(D.pluieMaudite.pool), ...(w.pluieMaudite?.pool || {}) };
        const LBL = { blockPowers: 'Bloquer les pouvoirs', blockConsumables: 'Bloquer les consommables', blockShop: 'Bloquer les achats', forceHardcore: 'Question Hardcore (tous)', curseTimer: 'Sablier + réponses mélangées', loseItem: 'Perte d’un objet', loseGold: 'Perte d’or (dé par équipe)' };
        return Object.keys(D.pluieMaudite.pool).map((cz) => (
          <div className="bal-row" key={cz}>
            <span className="bal-label" style={{ width: 290 }}>{LBL[cz] || cz}</span>
            <Stepper value={pool[cz]?.weight ?? 0} onChange={(v) => edit((nw) => { const pm = nw.pluieMaudite || {}; const pp = { ...(D.pluieMaudite.pool), ...(pm.pool || {}) }; pp[cz] = { ...pp[cz], weight: v }; nw.pluieMaudite = { ...pm, pool: pp }; })} min={0} max={20} />
          </div>
        ));
      })()}
    </>
  );
}

// --- Onglet « Sorts » (extension Magie) --------------------------------------
// (a) Réglages de la ressource magie → overrides `magic` du blob balance (fusion
//     plate, cf. balanceConfig.applyBalance) ; sauvegardés par le pied commun.
// (b) CRUD des sorts de la table Supabase quete_spells (pattern recettes :
//     DB = source de vérité ; les intégrés BASE_SPELLS sont copiables — même
//     clé → la copie REMPLACE l'intégré via setCustomSpells).

// Glyphe SVG d'une rune : polyline du premier gabarit de tracé (repère 0..100).
function RuneGlyph({ runeKey, size = 30, color = '#8745d4' }) {
  const pts = RUNES[runeKey]?.variants?.[0] || [];
  if (!pts.length) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ flexShrink: 0 }} aria-label={runeName(runeKey)}>
      <polyline points={pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Ligne DB / sort intégré → brouillon d'édition (formes internes de data/spells.js).
const spellRowToDraft = (r) => ({
  key: r.key, name: r.name || '', name_en: r.name_en || '', icon: r.icon || '✨', color: r.color || '#8745d4',
  desc: r.description || '', desc_en: r.description_en || '',
  runes: Array.isArray(r.runes) ? [...r.runes] : [],
  cost: Number(r.cost) || 0, targeted: !!r.targeted, facePick: !!r.face_pick,
  actions: Array.isArray(r.actions) ? clone(r.actions) : [],
  enabled: r.enabled !== false, ord: r.ord ?? 0, isNew: false,
});
const spellFromBase = (s, ord) => ({
  key: s.key, name: s.name, name_en: s.name_en || '', icon: s.icon || '✨', color: s.color || '#8745d4',
  desc: s.desc || '', desc_en: s.desc_en || '',
  runes: [...(s.runes || [])], cost: s.cost ?? 0, targeted: !!s.targeted, facePick: !!s.facePick,
  actions: clone(s.actions || []), enabled: true, ord, isNew: true, fromBase: true,
});
const blankSpell = (ord) => ({
  key: '', name: 'Nouveau sort', name_en: '', icon: '✨', color: '#8745d4', desc: '', desc_en: '',
  runes: [RUNE_KEYS[0], RUNE_KEYS[1]], cost: 30, targeted: false, facePick: false,
  actions: [defaultAction()], enabled: true, ord, isNew: true,
});
// Clé canonique d'une séquence (l'ORDRE compte — cf. matchSpell).
const spellSeq = (runes) => (runes || []).filter(Boolean).join('>');

// Réglages MAGIC : float = saisie décimale (proba 0-1), sinon Stepper entier.
const MAGIC_FIELDS = [
  { k: 'max', label: 'Plafond de la barre (✨ max)', min: 10, max: 999 },
  { k: 'regenPerMin', label: 'Régénération de base (✨ / minute)', min: 0, max: 99 },
  { k: 'start', label: 'Magie au départ de la partie', min: 0, max: 999 },
  { k: 'fizzleCost', label: 'Coût d’un raté (séquence sans sort)', min: 0, max: 99 },
  { k: 'castCooldownMs', label: 'Anti-spam entre 2 sorts (ms)', min: 0, max: 60000, step: 500, sec: true },
  { k: 'recogThreshold', label: 'Seuil de reconnaissance d’une rune (0-1)', min: 0, max: 1, step: 0.05, float: true },
  { k: 'answerRuneRate', label: 'Proba max rune / bonne réponse (0-1)', min: 0, max: 1, step: 0.05, float: true },
  { k: 'starterRunes', label: 'Runes connues au départ', min: 0, max: RUNE_KEYS.length },
  { k: 'starterSpells', label: 'Sorts connus au départ (les moins chers)', min: 0, max: 20 },
];

function SpellsTab({ ov, setOv, setStatus }) {
  const D = DEFAULTS.magic;
  const m = { ...D, ...(ov.magic || {}) };
  const setMagic = (k, v) => { setStatus(null); setOv((p) => ({ ...p, magic: { ...(p.magic || {}), [k]: v } })); };

  // CRUD des sorts (état local : l'onglet est démonté au changement d'onglet).
  const [rows, setRows] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const reload = () => fetchSpellRows()
    .then((r) => { setLoadErr(null); setRows(r); return r; })
    .catch((e) => { setLoadErr(e.message || 'Supabase injoignable'); setRows([]); return []; });
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (patch) => { setMsg(null); setDraft((d) => ({ ...d, ...patch })); };
  const runesOk = !!draft && draft.runes.length >= 2 && draft.runes.length <= 4 && draft.runes.every(Boolean);
  const valid = !!draft && !!draft.name.trim() && runesOk;

  // Même séquence qu'un AUTRE sort (intégré ou perso) → avertissement : un seul
  // des deux serait reconnu au tracé (matchSpell prend le premier trouvé).
  const seq = spellSeq(draft?.runes);
  const clash = draft && [...BASE_SPELLS, ...(rows || []).map(spellRowToDraft)]
    .find((s) => s.key !== draft.key && spellSeq(s.runes) === seq);

  const chooseRow = (r) => { setMsg(null); setDraft(spellRowToDraft(r)); };
  const chooseNew = () => { setMsg(null); setDraft(blankSpell((rows || []).length)); };
  // « Copier en custom » : pré-remplit un NOUVEAU sort depuis un intégré (même
  // clé → remplace l'intégré une fois enregistré). Déjà copié → rouvre la ligne.
  const chooseBase = (s) => {
    setMsg(null);
    const existing = (rows || []).find((r) => r.key === s.key);
    if (existing) { setDraft(spellRowToDraft(existing)); return; }
    setDraft(spellFromBase(s, (rows || []).length));
  };
  const duplicate = () => {
    if (!draft) return;
    setMsg(null);
    setDraft({ ...clone(draft), key: '', name: `${draft.name} (copie)`, isNew: true, fromBase: false, ord: (rows || []).length });
  };

  async function save() {
    if (busy || !valid) return;
    setBusy(true); setMsg(null);
    try {
      // Clé générée pour un sort vraiment nouveau ; unique aussi vis-à-vis des
      // intégrés (une copie d'intégré garde SA clé pour le remplacer).
      const key = draft.key || uniqueKey(draft.name, [...(rows || []), ...BASE_SPELLS]);
      const saved = await saveSpellRow({ ...draft, key, runes: draft.runes.filter(Boolean) }, { isNew: draft.isNew });
      await refreshSpells();
      await reload();
      setDraft(spellRowToDraft(saved));
      setMsg('Enregistré ✓');
    } catch (e) { setMsg('Erreur : ' + (e.message || 'Supabase injoignable')); }
    setBusy(false);
  }
  async function del() {
    if (busy || !draft || draft.isNew) return;
    if (!window.confirm(`Supprimer le sort « ${draft.name} » ?`)) return;
    setBusy(true); setMsg(null);
    try {
      await deleteSpellRow(draft.key);
      await refreshSpells();
      await reload();
      setDraft(null);
      setMsg('Supprimé');
    } catch (e) { setMsg('Erreur : ' + (e.message || 'Supabase injoignable')); }
    setBusy(false);
  }

  const setRune = (i, v) => upd({ runes: draft.runes.map((r, j) => (j === i ? v : r)) });
  const addRune = () => { if (draft.runes.length < 4) upd({ runes: [...draft.runes, RUNE_KEYS[0]] }); };
  const delRune = (i) => { if (draft.runes.length > 2) upd({ runes: draft.runes.filter((_, j) => j !== i) }); };

  const listBtn = (selected) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
    border: selected ? '2px solid #7a5ad4' : '1px solid rgba(122,94,58,0.2)',
    background: selected ? 'rgba(122,90,212,0.08)' : '#fff', textAlign: 'left',
  });

  return (
    <>
      {/* --- (a) Réglages de la ressource magie --- */}
      <div className="qed-label" style={{ marginBottom: 10 }}>✨ Réglages de la magie</div>
      {MAGIC_FIELDS.map((f) => (
        <div className="bal-row" key={f.k}>
          <span className="bal-label" style={{ width: 290 }}>{f.label}</span>
          {f.float ? (
            <>
              <input type="number" className="qed-input" style={{ width: 92 }} step={f.step} min={f.min} max={f.max}
                value={m[f.k]} onChange={(e) => setMagic(f.k, Math.max(f.min, Math.min(f.max, parseFloat(e.target.value) || 0)))} />
              <span className="bal-default">= {Math.round(m[f.k] * 100)}% · défaut {Math.round(D[f.k] * 100)}%</span>
            </>
          ) : (
            <>
              <Stepper value={m[f.k]} onChange={(v) => setMagic(f.k, v)} min={f.min} max={f.max} step={f.step || 1} />
              <span className="bal-default">{f.sec ? `= ${m[f.k] / 1000}s · ` : ''}défaut : {D[f.k]}</span>
            </>
          )}
        </div>
      ))}

      {/* --- (b) CRUD des sorts --- */}
      <div className="qed-label" style={{ margin: '18px 0 8px' }}>📜 Sorts — table quete_spells (DB = source de vérité)</div>
      {loadErr && (
        <div style={{ fontSize: 12.5, color: '#b5341f', background: 'rgba(181,52,31,0.08)', border: '1px solid rgba(181,52,31,0.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
          Erreur de chargement : {loadErr} — la table <code>quete_spells</code> existe-t-elle ?
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Liste maître : persos puis intégrés copiables */}
        <div style={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn--green btn--sm" onClick={chooseNew}>+ Nouveau sort</button>
          <div className="bal-default" style={{ fontSize: 11 }}>{rows == null ? 'Chargement…' : `${rows.length} sort(s) perso`}</div>
          {(rows || []).map((r) => (
            <button key={r.key} type="button" onClick={() => chooseRow(r)}
              style={{ ...listBtn(draft && !draft.isNew && draft.key === r.key), opacity: r.enabled === false ? 0.5 : 1 }}>
              <span style={{ fontSize: 18 }}>{r.icon || '✨'}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || '(sans nom)'}</span>
              {BASE_SPELLS.some((b) => b.key === r.key) && <span className="bal-default" title="Remplace le sort intégré (supprimer restaure l'original)">✎</span>}
              {r.enabled === false && <span className="bal-default" style={{ fontSize: 10 }}>off</span>}
            </button>
          ))}
          {(() => {
            const overridden = new Set((rows || []).map((r) => r.key));
            const base = BASE_SPELLS.filter((s) => !overridden.has(s.key));
            if (!base.length) return null;
            return (
              <>
                <div className="bal-default" style={{ margin: '8px 0 2px' }}>Intégrés (clique pour copier en custom)</div>
                {base.map((s) => (
                  <button key={s.key} type="button" onClick={() => chooseBase(s)}
                    style={listBtn(draft?.isNew && draft?.fromBase && draft.key === s.key)}>
                    <span style={{ fontSize: 18 }}>{s.icon}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span className="bal-default" style={{ fontSize: 10 }}>⚙️</span>
                  </button>
                ))}
              </>
            );
          })()}
        </div>

        {/* Détail du sort sélectionné */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!draft ? (
            <div className="bal-default" style={{ padding: 20 }}>Sélectionne un sort à gauche, copie un intégré, ou crée-en un nouveau.</div>
          ) : (
            <>
              {draft.fromBase && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-500)', background: 'rgba(232,169,88,0.12)', border: '1px solid rgba(122,94,58,0.2)', borderRadius: 8, padding: '6px 10px', marginBottom: 10 }}>
                  Copie du sort intégré « {draft.name} » : une fois enregistrée (même clé), elle <b>remplace</b> l'intégré. La supprimer restaure l'original.
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                <input className="qed-input" style={{ width: 54, fontSize: 22, textAlign: 'center', padding: 4 }} value={draft.icon} maxLength={4}
                  onChange={(e) => upd({ icon: e.target.value })} title="Icône (emoji)" />
                <input type="color" value={draft.color || '#8745d4'} onChange={(e) => upd({ color: e.target.value })} title="Couleur du sort"
                  style={{ width: 34, height: 34, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                <input className="qed-input" style={{ flex: 1, minWidth: 140 }} value={draft.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Nom (FR)" />
                <input className="qed-input" style={{ flex: 1, minWidth: 140 }} value={draft.name_en} onChange={(e) => upd({ name_en: e.target.value })} placeholder="Name (EN)" />
              </div>

              <div className="bal-row" style={{ gap: 12, flexWrap: 'wrap' }}>
                <span className="bal-label" style={{ width: 90 }}>Coût ✨</span>
                <Stepper value={draft.cost} onChange={(v) => upd({ cost: v })} min={0} max={999} step={5} />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
                  <input type="checkbox" checked={draft.targeted} onChange={(e) => upd({ targeted: e.target.checked })} /> vise une équipe
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
                  <input type="checkbox" checked={draft.facePick} onChange={(e) => upd({ facePick: e.target.checked })} /> choisit une face (1-6)
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
                  <input type="checkbox" checked={draft.enabled} onChange={(e) => upd({ enabled: e.target.checked })} /> activé
                </label>
              </div>

              {/* Séquence de runes (2-4, ordonnée) : glyphes + un dropdown par slot */}
              <div className="bal-row" style={{ alignItems: 'flex-start', marginTop: 6 }}>
                <span className="bal-label" style={{ width: 90 }}>Runes (2-4)</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {draft.runes.map((k, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {i > 0 && <span className="bal-default">→</span>}
                        <span style={{ display: 'inline-flex', padding: 3, border: '1px solid rgba(122,94,58,0.25)', borderRadius: 8, background: '#fff' }} title={runeName(k)}>
                          <RuneGlyph runeKey={k} size={34} color={draft.color || '#8745d4'} />
                        </span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {draft.runes.map((k, i) => (
                      <span key={i} style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
                        <select className="qed-select" value={k} onChange={(e) => setRune(i, e.target.value)}>
                          {RUNE_KEYS.map((rk) => <option key={rk} value={rk}>{RUNES[rk].icon} {runeName(rk)}</option>)}
                        </select>
                        <button className="bal-fx-x" disabled={draft.runes.length <= 2} onClick={() => delRune(i)} title="Retirer cette rune">{'\u{1F5D1}'}</button>
                      </span>
                    ))}
                    {draft.runes.length < 4 && <button className="btn btn--ghost btn--sm" onClick={addRune}>+ rune</button>}
                  </div>
                  {clash && (
                    <div style={{ fontSize: 11.5, color: '#a06a12' }}>
                      ⚠ Même séquence que « {clash.name} » — un seul des deux serait reconnu au tracé.
                    </div>
                  )}
                </div>
              </div>

              <div className="qed-field" style={{ marginTop: 8 }}>
                <label className="qed-label">Description (FR)</label>
                <textarea className="qed-textarea" value={draft.desc} onChange={(e) => upd({ desc: e.target.value })} placeholder="Ce que fait le sort, vu par les joueurs…" />
              </div>
              <div className="qed-field">
                <label className="qed-label">Description (EN)</label>
                <textarea className="qed-textarea" value={draft.desc_en} onChange={(e) => upd({ desc_en: e.target.value })} />
              </div>

              {/* Effets : mêmes ACTIONS du moteur que les événements scriptés. */}
              <div className="qed-field">
                <label className="qed-label">✨ Effets du sort (actions du moteur)</label>
                <ActionList actions={draft.actions} onChange={(actions) => upd({ actions })} />
                {draft.actions?.length > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 6 }}>
                    Aperçu : {draft.actions.map(describeAction).join(' · ')}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, borderTop: '1px solid rgba(122,94,58,0.15)', paddingTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn--green" onClick={save} disabled={busy || !valid}>{busy ? 'Enregistrement…' : (draft.isNew ? 'Créer' : 'Enregistrer')}</button>
                <button className="btn btn--ghost btn--sm" onClick={duplicate} disabled={busy}>{'⧉'} Dupliquer</button>
                {!draft.isNew && <button className="btn btn--ghost btn--sm" onClick={del} disabled={busy} style={{ color: '#b5341f' }}>{'\u{1F5D1}'} Supprimer</button>}
                {!valid && <span className="qed-err">{!draft.name.trim() ? 'Un nom est requis.' : 'Il faut 2 à 4 runes.'}</span>}
                {msg && <span style={{ fontSize: 12, fontWeight: 600, color: msg.startsWith('Erreur') ? '#b5341f' : '#2f9d5a' }}>{msg}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Éditeur de CATALOGUE de faces (onglet Forge), en MAÎTRE-DÉTAIL : la liste des
// faces à gauche, l'édition de la face sélectionnée à droite. Remplace l'ancien
// onglet surchargé — la génération aléatoire ayant disparu, il ne reste que les
// faces du catalogue (+ réglages contextuels : valeur de palier, enchaînement
// de la Relance). NB : `row()` renvoie du JSX (pas un sous-composant) pour ne pas
// remonter les champs à chaque frappe (perte de focus).
const FORGE_RAR = [['commun', 'Commune', '#7c9a5a'], ['rare', 'Rare', '#7a5ad4'], ['legendaire', 'Légendaire', '#d4762e']];
function ForgeCatalogEditor({ ov, setOv, setStatus }) {
  const F = DEFAULTS.forge;
  const catalog = ov.forge?.catalog ?? F.catalog ?? [];
  const [sel, setSel] = useState(0);
  const [fSlot, setFSlot] = useState('all'); // filtre slot : 'all' | 1..6
  const [fRar, setFRar] = useState('all');   // filtre rareté : 'all' | clé
  const idx = Math.min(sel, catalog.length - 1);
  const face = catalog[idx] || null;
  const matchFilter = (f) => (fSlot === 'all' || f.slot === fSlot) && (fRar === 'all' || f.rarity === fRar);

  const setCat = (arr) => { setStatus(null); setOv((p) => ({ ...p, forge: { ...(p.forge || {}), catalog: arr } })); };
  const updFace = (patch) => setCat(catalog.map((f, j) => (j === idx ? { ...f, ...patch } : f)));
  const uid = () => `face-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  const addFace = () => { const arr = [...catalog, { key: uid(), name: 'Nouvelle face', name_en: 'New face', rarity: fRar !== 'all' ? fRar : 'commun', price: 50, slot: typeof fSlot === 'number' ? fSlot : 1, value: 3, effects: [], enabled: true }]; setCat(arr); setSel(arr.length - 1); };
  const dupFace = () => { if (!face) return; const arr = [...catalog.slice(0, idx + 1), { ...face, key: uid(), name: `${face.name} (copie)` }, ...catalog.slice(idx + 1)]; setCat(arr); setSel(idx + 1); };
  const delFace = () => { if (!face) return; setCat(catalog.filter((_, j) => j !== idx)); setSel(Math.max(0, idx - 1)); };

  // Valeur d'un palier d'effet (COMMUNE à toutes les faces qui l'utilisent).
  const tiers = (type) => (ov.forge?.effects?.[type]?.tiers ?? F.effects[type]?.tiers ?? []);
  const setTier = (type, ti, v) => { setStatus(null); setOv((p) => { const eff = { ...(p.forge?.effects || {}) }; const cur = eff[type]?.tiers ?? F.effects[type].tiers; const arr = [...cur]; arr[ti] = v; eff[type] = { ...(eff[type] || {}), tiers: arr }; return { ...p, forge: { ...(p.forge || {}), effects: eff } }; }); };
  const relGet = () => (ov.forge?.relance?.enchainement ?? F.relance.enchainement);
  const setRel = (v) => { setStatus(null); setOv((p) => ({ ...p, forge: { ...(p.forge || {}), relance: { ...F.relance, ...(p.forge?.relance || {}), enchainement: v } } })); };

  // Effets de la face sélectionnée (0→3). Écrit toujours `effects` (et retire la
  // forme héritée `effect`) pour rester sur le modèle moderne.
  const effs = faceEffects(face);
  const setEffs = (arr) => updFace({ effects: arr, effect: undefined });
  const updEff = (i, patch) => setEffs(effs.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const addEff = () => { if (effs.length < MAX_FACE_EFFECTS) setEffs([...effs, { type: Object.keys(F.effects)[0], tier: 0 }]); };
  const delEff = (i) => setEffs(effs.filter((_, j) => j !== i));

  const rarMeta = (r) => FORGE_RAR.find((x) => x[0] === r) || FORGE_RAR[0];
  const row = (label, children) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
      <span className="bal-label" style={{ width: 110, flexShrink: 0 }}>{label}</span>{children}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', height: '100%', minHeight: 0 }}>
      {/* Colonne gauche : catalogue */}
      <div style={{ width: 248, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '100%', overflow: 'auto' }}>
        <button className="btn btn--green" onClick={addFace} style={{ width: '100%' }}>+ Nouvelle face</button>

        {/* Filtres : slot + rareté */}
        {(() => {
          const chip = (on, onClick, label, key) => (
            <button key={key} type="button" onClick={onClick} style={{
              padding: '3px 9px', borderRadius: 999, cursor: 'pointer', fontSize: 12,
              border: on ? '2px solid #7a5ad4' : '1px solid rgba(122,94,58,0.3)',
              background: on ? 'rgba(122,90,212,0.12)' : '#fff', color: 'var(--ink-800)', fontWeight: on ? 700 : 500,
            }}>{label}</button>
          );
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '2px 0 4px', borderBottom: '1px solid rgba(122,94,58,0.15)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span className="bal-default" style={{ fontSize: 11, width: 38 }}>Slot</span>
                {chip(fSlot === 'all', () => setFSlot('all'), 'Tous', 'all')}
                {[1, 2, 3, 4, 5, 6].map((s) => chip(fSlot === s, () => setFSlot(s), s, s))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span className="bal-default" style={{ fontSize: 11, width: 38 }}>Rareté</span>
                {chip(fRar === 'all', () => setFRar('all'), 'Toutes', 'all')}
                {FORGE_RAR.map(([k, lbl]) => chip(fRar === k, () => setFRar(k), lbl, k))}
              </div>
            </div>
          );
        })()}

        {catalog.length === 0 && <div className="bal-default">Aucune face. Ajoutez-en une.</div>}
        {catalog.length > 0 && !catalog.some(matchFilter) && <div className="bal-default" style={{ fontSize: 12 }}>Aucune face pour ce filtre.</div>}
        {catalog.map((f, i) => (matchFilter(f) ? (
          <button key={f.key || i} type="button" onClick={() => setSel(i)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 8, cursor: 'pointer',
              border: i === idx ? '2px solid #7a5ad4' : '1px solid rgba(122,94,58,0.2)',
              background: i === idx ? 'rgba(122,90,212,0.08)' : '#fff', textAlign: 'left', opacity: f.enabled === false ? 0.5 : 1 }}>
            <FaceTile face={f} size={38} slotTag={f.slot} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || '(sans nom)'}</span>
              <span className="bal-default" style={{ fontSize: 11 }}>slot {f.slot} · <span style={{ color: rarMeta(f.rarity)[2] }}>{rarMeta(f.rarity)[1]}</span>{f.enabled === false ? ' · off' : ''}</span>
            </span>
          </button>
        ) : null))}
      </div>

      {/* Colonne droite : détail de la face sélectionnée */}
      <div style={{ flex: 1, minWidth: 0, maxHeight: '100%', overflow: 'auto' }}>
        {!face ? (
          <div className="bal-default" style={{ padding: 20 }}>Sélectionnez une face à gauche, ou créez-en une nouvelle.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <FaceTile face={face} size={88} slotTag={face.slot} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{face.name || '(sans nom)'}</div>
                <div className="bal-default">{effs.length ? effs.map((e) => `${FORGE_EFFECTS[e.type]?.icon} ${FORGE_EFFECTS[e.type]?.fr}`).join(' · ') : 'Face de course (sans effet)'}</div>
              </div>
            </div>

            {row('Nom', <input className="qed-input" style={{ flex: 1, minWidth: 160 }} value={face.name || ''} onChange={(e) => updFace({ name: e.target.value })} />)}
            {row('Nom (EN)', <input className="qed-input" style={{ flex: 1, minWidth: 160 }} value={face.name_en || ''} onChange={(e) => updFace({ name_en: e.target.value })} />)}
            {row('Rareté', (
              <select className="qed-input" value={face.rarity || 'commun'} onChange={(e) => updFace({ rarity: e.target.value })}>
                {FORGE_RAR.map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
              </select>
            ))}
            {row('Slot cible', (<>
              <select className="qed-input" value={face.slot || 1} onChange={(e) => updFace({ slot: parseInt(e.target.value, 10) })}>
                {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="bal-default">forgeable uniquement sur ce slot</span>
            </>))}
            {row('Avance', (<>
              <Stepper value={face.value ?? 0} onChange={(v) => updFace({ value: Math.max(0, Math.min(MAX_FACE_VALUE, v)) })} min={0} max={MAX_FACE_VALUE} />
              <span className="bal-default">cases au lancer (0 = pas de recul si raté · max {MAX_FACE_VALUE})</span>
            </>))}
            {row('Prix', (<>
              <input type="number" className="qed-input" style={{ width: 90 }} value={face.price ?? 0} onChange={(e) => updFace({ price: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
              <span className="bal-default">{'\u{1FA99}'} en boutique</span>
            </>))}
            {/* Effets (0→3) : chacun = type + palier (+ valeur du palier éditable). */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span className="bal-label" style={{ width: 110, flexShrink: 0 }}>Effets</span>
                <span className="bal-default">{effs.length}/{MAX_FACE_EFFECTS}</span>
                <button className="btn btn--sm" disabled={effs.length >= MAX_FACE_EFFECTS} onClick={addEff}>+ Ajouter un effet</button>
              </div>
              {effs.length === 0 && <div className="bal-default" style={{ marginLeft: 120 }}>Aucun effet — face de course pure.</div>}
              {effs.map((e, i) => {
                const tv = tiers(e.type)[e.tier ?? 0];
                return (
                  <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginLeft: 120, marginBottom: 6 }}>
                    <select className="qed-input" value={e.type} onChange={(ev) => updEff(i, { type: ev.target.value, tier: 0 })}>
                      {Object.keys(F.effects).map((t) => <option key={t} value={t}>{FORGE_EFFECTS[t]?.icon} {FORGE_EFFECTS[t]?.fr || t}</option>)}
                    </select>
                    <select className="qed-input" value={e.tier ?? 0} onChange={(ev) => updEff(i, { tier: parseInt(ev.target.value, 10) })}>
                      {tiers(e.type).map((_, ti) => <option key={ti} value={ti}>palier {ti + 1}</option>)}
                    </select>
                    {typeof tv === 'number'
                      ? (<><span className="bal-default">valeur</span><input type="number" step="0.5" className="qed-input" style={{ width: 78 }} value={tv} onChange={(ev) => setTier(e.type, e.tier ?? 0, parseFloat(ev.target.value) || 0)} /></>)
                      : (<span className="bal-default">valeur : <b>{String(tv)}</b></span>)}
                    <button className="btn btn--ghost btn--sm" onClick={() => delEff(i)} title="Retirer cet effet">{'\u{1F5D1}'}</button>
                  </div>
                );
              })}
              {effs.some((e) => e.type === 'relance') && (
                <div style={{ marginLeft: 120, marginTop: 4 }}>
                  <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={relGet()} onChange={(e) => setRel(e.target.checked)} /> une Relance peut re-relancer</label>
                </div>
              )}
            </div>
            {row('Activée', (
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={face.enabled !== false} onChange={(e) => updFace({ enabled: e.target.checked })} /> proposée en boutique</label>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 18, borderTop: '1px solid rgba(122,94,58,0.15)', paddingTop: 14 }}>
              <button className="btn btn--ghost btn--sm" onClick={dupFace}>{'⧉'} Dupliquer</button>
              <button className="btn btn--ghost btn--sm" onClick={delFace} style={{ color: '#b5341f' }}>{'\u{1F5D1}'} Supprimer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const rowToDraft = (r) => ({
  key: r.key, name: r.name, desc: r.description ?? '', descExpert: r.desc_expert ?? '',
  icon: r.icon ?? '', img: r.img ?? '', set: r.set_key ?? '',
  slot: r.slot, rarity: r.rarity, price: r.price, lootOnly: !!r.loot_only,
  // Gating par matière (OR) : lootable / en boutique seulement si une de ces
  // matières est active. [] = toujours disponible.
  requiresSubjects: Array.isArray(r.requires_subjects) ? r.requires_subjects : [],
  // Famille (alchimie : ingredient/potion) + enchant (parchemin) : DOIVENT être
  // recopiés, sinon l'édition d'un ingrédient/potion/parchemin les efface au save.
  family: r.family || '', enchant: r.enchant || undefined,
  effects: Array.isArray(r.effects) ? r.effects : [], enabled: r.enabled !== false,
  ord: r.ord, _isNew: false,
});
const newDraft = (ord, over = {}) => ({
  key: '', name: 'Nouvel objet', desc: '', descExpert: '', icon: '✨', img: '', set: '',
  slot: 'head', rarity: 'commun', price: 10, lootOnly: false, effects: [],
  family: '', enchant: undefined, requiresSubjects: [],
  enabled: true, ord, _isNew: true, ...over,
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
              ? <AmountInput value={fx.value ?? 0} onChange={(v) => updateEffect(i, { value: v })} min={1} dice={diceFor(fx.type)} unit={EFFECT_UNIT[fx.type] || ''} />
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
  // Recettes d'alchimie (onglet Alchimie) : liste perso + brouillon en cours.
  const [recipeRows, setRecipeRows] = useState(null);
  const [recipeDraft, setRecipeDraft] = useState(null);

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
  const chooseRow = (r) => { if (confirmIfDirty('Modifications non enregistrées — changer d’objet et les perdre ?')) { setRecipeDraft(null); loadDraft(rowToDraft(r)); } };
  const chooseNew = () => { if (confirmIfDirty('Modifications non enregistrées — créer un objet et les perdre ?')) loadDraft(newDraft(rows?.length || 0)); };
  // Onglet Alchimie : création d'un objet pré-réglé en ingrédient / potion.
  const chooseNewItem = (over) => { if (confirmIfDirty('Modifications non enregistrées — créer un objet et les perdre ?')) { setRecipeDraft(null); loadDraft(newDraft(rows?.length || 0, { slot: 'consumable', ...over })); } };

  // --- Recettes d'alchimie ---
  const ingKeys = Object.keys(ITEMS).filter((k) => ITEMS[k].family === 'ingredient');
  const potKeys = Object.keys(ITEMS).filter((k) => ITEMS[k].family === 'potion');
  const chooseRecipe = (r) => { if (confirmIfDirty('Modifications non enregistrées — changer et les perdre ?')) { loadDraft(null); setStatus(null); setRecipeDraft(recipeRowToDraft(r)); } };
  const chooseNewRecipe = () => {
    if (!confirmIfDirty('Modifications non enregistrées — créer et les perdre ?')) return;
    loadDraft(null); setStatus(null);
    setRecipeDraft({ key: '', ingredients: [ingKeys[0] || '', ingKeys[1] || '', ingKeys[2] || ''], potion: potKeys[0] || '', isNew: true });
  };
  // Recette INTÉGRÉE : on l'édite en créant (ou en rouvrant) une recette perso de
  // MÊME id → elle remplace l'intégrée (setCustomRecipes fusionne par id). La
  // supprimer restaure la recette d'origine. La saisie garde l'id intégré.
  const chooseBaseRecipe = (base) => {
    if (!confirmIfDirty('Modifications non enregistrées — changer et les perdre ?')) return;
    loadDraft(null); setStatus(null);
    const existing = (recipeRows || []).find((r) => r.key === base.id);
    if (existing) { setRecipeDraft(recipeRowToDraft(existing)); return; }
    setRecipeDraft({ key: base.id, ingredients: [...base.ingredients, '', '', ''].slice(0, 3), potion: base.potion, isNew: true, fromBase: true });
  };
  async function saveRecipe() {
    if (busy || !recipeDraft) return;
    const ings = recipeDraft.ingredients.filter(Boolean);
    if (ings.length !== 3 || !recipeDraft.potion) return;
    setBusy(true); setStatus(null);
    try {
      // Garde l'id existant (recette perso OU intégrée éditée) ; n'en génère un
      // aléatoire que pour une recette vraiment nouvelle (sans id).
      const key = (recipeDraft.key && String(recipeDraft.key).trim()) ? recipeDraft.key : `r-${rand4()}${rand4()}`;
      await saveRecipeRow({ id: key, ingredients: ings, potion: recipeDraft.potion }, { isNew: recipeDraft.isNew });
      await refreshRecipes();
      await reloadRecipes();
      setRecipeDraft(null);
      setStatus('Enregistré ✓');
    } catch (e) { setStatus('Erreur : ' + (e.message || 'Supabase injoignable')); }
    setBusy(false);
  }
  async function deleteRecipe() {
    if (busy || !recipeDraft || recipeDraft.isNew) return;
    if (!window.confirm('Supprimer cette recette ?')) return;
    setBusy(true); setStatus(null);
    try {
      await deleteRecipeRow(recipeDraft.key);
      await refreshRecipes();
      await reloadRecipes();
      setRecipeDraft(null);
      setStatus('Supprimé');
    } catch (e) { setStatus('Erreur : ' + (e.message || 'Supabase injoignable')); }
    setBusy(false);
  }
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
  const treeTier = (key, slot, j, t, fxKey) => ov.powers?.[key]?.tree?.[slot]?.[j]?.tiers?.[t]?.[fxKey] ?? DEFAULTS.powers[key].tree[slot][j].tiers[t][fxKey];
  // Copie une branche en préservant les renforts de voie (tiers L7/L9) en profondeur.
  const cloneBranch = (b) => ({ ...b, effect: { ...b.effect }, ...(b.tiers ? { tiers: b.tiers.map((x) => ({ ...x })) } : {}) });
  const mutTree = (key, fn) => {
    setStatus(null);
    setOv((prev) => {
      const powers = { ...(prev.powers || {}) };
      const cur = { ...(powers[key] || {}) };
      const dTree = DEFAULTS.powers[key].tree;
      const tree = {
        upgradeCosts: cur.tree?.upgradeCosts ? [...cur.tree.upgradeCosts] : [...dTree.upgradeCosts],
        scale: cur.tree?.scale ? cur.tree.scale.map((s) => ({ ...s })) : dTree.scale.map((s) => ({ ...s })),
        branch5: (cur.tree?.branch5 || dTree.branch5).map(cloneBranch),
        branch10: (cur.tree?.branch10 || dTree.branch10).map(cloneBranch),
      };
      fn(tree);
      cur.tree = tree; powers[key] = cur;
      return { ...prev, powers };
    });
  };
  const setTreeCost = (key, i, v) => mutTree(key, (t) => { t.upgradeCosts[i] = v; });
  const setTreeScale = (key, lvl, fxKey, v) => mutTree(key, (t) => { t.scale[lvl] = { ...t.scale[lvl], [fxKey]: v }; });
  const setTreeBranch = (key, slot, j, fxKey, v) => mutTree(key, (t) => { t[slot][j] = { ...t[slot][j], effect: { ...t[slot][j].effect, [fxKey]: v } }; });
  const setTreeTier = (key, slot, j, ti, fxKey, v) => mutTree(key, (t) => { const tiers = [...(t[slot][j].tiers || [])]; tiers[ti] = { ...tiers[ti], [fxKey]: v }; t[slot][j] = { ...t[slot][j], tiers }; });

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
  // Création / suppression de sets PERSONNALISÉS (clé hors catalogue de base).
  const isCustomSet = (k) => !!k && !DEFAULTS.sets[k];
  const setSize = (k) => setVal(k, 'size') ?? 3;
  // Sets custom pas encore fusionnés dans SETS (avant Enregistrer) → liste/menus.
  const customSetEntries = Object.entries(ov.sets || {})
    .filter(([k, o]) => o?.custom && !SETS[k])
    .map(([k, o]) => [k, { icon: o.icon || '⚜️', name: o.name || k, color: o.color }]);
  const setEntries = [...Object.entries(SETS), ...customSetEntries];
  const addSet = () => {
    const k = 'set_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    setStatus(null);
    setOv((prev) => ({ ...prev, sets: { ...(prev.sets || {}), [k]: { custom: true, name: 'Nouveau set', name_en: 'New set', icon: '⚜️', color: '#a8771a', size: 2, bonus2: [], bonus3: [] } } }));
    setSelSet(k);
  };
  const deleteSet = (k) => {
    if (!window.confirm('Supprimer ce set ? Les objets assignés perdront leur appartenance.')) return;
    setStatus(null);
    setOv((prev) => { const sets = { ...(prev.sets || {}) }; delete sets[k]; return { ...prev, sets }; });
    setSelSet(Object.keys(SETS)[0] || null);
  };

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
  // Recettes d'alchimie : chargées à la première ouverture de l'onglet Alchimie.
  useEffect(() => {
    if (tab === 'alchemy' && recipeRows == null) {
      fetchRecipeRows().then(setRecipeRows).catch(() => setRecipeRows([]));
    }
  }, [tab, recipeRows]);
  const reloadRecipes = () => fetchRecipeRows().then(setRecipeRows).catch(() => {});

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
              : tab === 'forge' ? `${Object.keys(ov.forge || {}).length} réglage(s) Forge`
              : tab === 'weather' ? `${Object.keys(ov.weather || {}).length} réglage(s) Météo`
              : tab === 'spells' ? `${Object.keys(ov.magic || {}).length} réglage(s) Magie`
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
          {tab === 'alchemy' && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="btn btn--green btn--sm" onClick={() => chooseNewItem({ family: 'ingredient', name: 'Nouvel ingrédient', icon: '🌿', price: 4 })}>{'+'} Ingrédient</button>
              <button className="btn btn--green btn--sm" onClick={() => chooseNewItem({ family: 'potion', lootOnly: true, price: 0, name: 'Nouvelle potion', icon: '🧪' })}>{'+'} Potion</button>
              <button className="btn btn--green btn--sm" onClick={chooseNewRecipe} disabled={ingKeys.length < 3 || potKeys.length === 0}>{'+'} Recette</button>
            </div>
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
                                  {/* Renforts de voie (paliers L7/L9) : valeurs réglables par palier. */}
                                  {Array.isArray(br.tiers) && br.tiers.map((tier, ti) => (
                                    Object.entries(tier).filter(([, v]) => typeof v === 'number').map(([fxKey, dv]) => (
                                      <div key={`t${ti}-${fxKey}`} className="bal-row">
                                        <span className="bal-label">↳ niv.{tierLevelsFor(k)[ti] ?? '?'} · {FX_LABELS[fxKey] || fxKey}</span>
                                        <input className="qed-input" style={{ width: 64 }} type="number" step="any" value={treeTier(k, slot, j, ti, fxKey)} onChange={(e) => setTreeTier(k, slot, j, ti, fxKey, e.target.value === '' ? dv : Number(e.target.value))} />
                                        <span className="bal-default">déf. {String(dv)}</span>
                                      </div>
                                    ))
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
              {setEntries.map(([k, s]) => (
                <button key={k} className={`qed-item ${selSet === k ? 'is-active' : ''}`} onClick={() => { setSelSet(k); setStatus(null); }}>
                  <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{setVal(k, 'icon') || s.icon}</span>
                  <span style={{ flex: 1 }}>{setVal(k, 'name') || s.name}</span>
                  {isCustomSet(k)
                    ? <span className="qed-item-tag" title="Set personnalisé">{'✦'}</span>
                    : (ov.sets?.[k] && <span className="qed-item-tag" title="Modifié">{'✎'}</span>)}
                </button>
              ))}
              <button className="btn btn--green btn--sm" style={{ margin: '8px 6px 2px' }} onClick={addSet}>{'+'} Nouveau set</button>
            </div>
            <div className="bal-detail">
              <div className="bal-detail-scroll">
                {(() => {
                  const k = selSet; if (!k) return null;
                  if (!SETS[k] && !ov.sets?.[k]?.custom) return null;
                  const size = setSize(k);
                  const members = (rows || []).filter((r) => r.set_key === k);
                  return (
                    <>
                      <div className="bal-card bal-card--mini">
                        <input className="qed-input" style={{ width: 50, fontSize: 24, textAlign: 'center', padding: 4 }} value={setVal(k, 'icon') || ''} onChange={(e) => setSetField(k, 'icon', e.target.value)} title="Icône (emoji)" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input className="qed-input" value={setVal(k, 'name') || ''} onChange={(e) => setSetField(k, 'name', e.target.value)} placeholder="Nom du set" />
                          <div className="bal-default" style={{ marginTop: 4 }}>
                            {members.length}/{size} pièce{size > 1 ? 's' : ''}{members.length ? ` : ${members.map((r) => r.name).join(', ')}` : ' (assigne des objets via leur onglet Infos → Set)'}
                          </div>
                        </div>
                        <input type="color" value={setVal(k, 'color') || '#a8771a'} onChange={(e) => setSetField(k, 'color', e.target.value)} title="Couleur du set" style={{ width: 34, height: 34, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                      </div>

                      <div className="bal-row" style={{ marginTop: 6 }}>
                        <span className="bal-label" style={{ width: 72 }}>Nom (EN)</span>
                        <input className="qed-input" style={{ flex: 1 }} value={setVal(k, 'name_en') || ''} onChange={(e) => setSetField(k, 'name_en', e.target.value)} placeholder="English name" />
                      </div>

                      <div className="bal-row" style={{ marginTop: 8 }}>
                        <span className="bal-label" style={{ width: 72 }}>Taille</span>
                        {[2, 3].map((n) => (
                          <button key={n} type="button" className={`btn btn--sm ${size === n ? 'btn--green' : 'btn--ghost'}`} onClick={() => setSetField(k, 'size', n)}>{n} objets</button>
                        ))}
                        <span className="bal-default">nombre de pièces du set</span>
                      </div>

                      <div className="qed-label" style={{ marginTop: 12 }}>{'\u{1F948}'} Bonus à 2 pièces équipées</div>
                      <SetBonusEditor effects={setVal(k, 'bonus2') || []} onChange={(e) => setSetField(k, 'bonus2', e)} />
                      {size >= 3 && (
                        <>
                          <div className="qed-label" style={{ marginTop: 14 }}>{'\u{1F947}'} Bonus à 3 pièces équipées</div>
                          <SetBonusEditor effects={setVal(k, 'bonus3') || []} onChange={(e) => setSetField(k, 'bonus3', e)} />
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="bal-detail-foot">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy || !ovDirty}>{busy ? 'Enregistrement…' : (ovDirty ? 'Enregistrer' : 'Enregistré ✓')}</button>
                {isCustomSet(selSet)
                  ? <button className="btn btn--ghost" onClick={() => deleteSet(selSet)}>{'🗑'} Supprimer le set</button>
                  : <button className="btn btn--ghost" onClick={() => resetSet(selSet)} disabled={!ov.sets?.[selSet]}>{'↺'} Valeurs d'origine</button>}
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

              {/* Loot d'ingrédients : drops multiples */}
              <div className="qed-label" style={{ margin: '16px 0 8px' }}>⚗️ Loot d'ingrédients — drops multiples</div>
              {(() => {
                const md = { ...DEFAULTS.loot.ingredientMultiDrop, ...(ov.loot?.ingredientMultiDrop || {}) };
                const setMd = (patch) => { setStatus(null); setOv((prev) => ({ ...prev, loot: { ...(prev.loot || {}), ingredientMultiDrop: { ...DEFAULTS.loot.ingredientMultiDrop, ...(prev.loot?.ingredientMultiDrop || {}), ...patch } } })); };
                return (
                  <>
                    <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>Chance d'un ingrédient supplémentaire</span>
                      <input type="number" className="qed-input" style={{ width: 92 }} step="0.05" min="0" max="1" value={md.chance} onChange={(e) => setMd({ chance: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)) })} />
                      <span className="bal-default">= {Math.round(md.chance * 100)}% (répété, jusqu'au max)</span></div>
                    <div className="bal-row"><span className="bal-label" style={{ width: 290 }}>Maximum d'ingrédients EN PLUS</span>
                      <Stepper value={md.max} onChange={(v) => setMd({ max: v })} min={0} max={5} /></div>
                  </>
                );
              })()}

              {/* Loot d'ingrédients : poids + matière favorite par ingrédient */}
              <div className="qed-label" style={{ margin: '16px 0 8px' }}>⚗️ Poids & matière favorite par ingrédient</div>
              {(() => {
                const base = DEFAULTS.loot.ingredients || {};
                const curAll = { ...base, ...(ov.loot?.ingredients || {}) };
                const setIng = (key, patch) => { setStatus(null); setOv((prev) => { const merged = { ...base, ...(prev.loot?.ingredients || {}) }; merged[key] = { ...merged[key], ...patch }; return { ...prev, loot: { ...(prev.loot || {}), ingredients: merged } }; }); };
                return Object.keys(base).map((key) => {
                  const c = curAll[key] || {};
                  return (
                    <div className="bal-row" key={key} style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span className="bal-label" style={{ width: 170 }}>{ITEMS[key]?.icon} {ITEMS[key]?.name || key}</span>
                      <span className="bal-default">poids</span><Stepper value={c.weight ?? 1} onChange={(v) => setIng(key, { weight: v })} min={0} max={50} />
                      <span className="bal-default">favorite</span>
                      <select className="qed-select" style={{ width: 150 }} value={c.favSubject || ''} onChange={(e) => setIng(key, { favSubject: e.target.value || null })}>
                        <option value="">—</option>
                        {SUBJECT_KEYS.map((s) => <option key={s} value={s}>{SUBJECTS[s]?.icon} {SUBJECTS[s]?.name || s}</option>)}
                      </select>
                      <span className="bal-default">×</span><input type="number" className="qed-input" style={{ width: 60 }} step="0.5" min="1" max="9" value={c.favMult ?? 1} onChange={(e) => setIng(key, { favMult: Math.max(1, parseFloat(e.target.value) || 1) })} />
                    </div>
                  );
                });
              })()}
              </div>
              <div className="bal-detail-foot">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy || !ovDirty}>{busy ? 'Enregistrement…' : (ovDirty ? 'Enregistrer' : 'Enregistré ✓')}</button>
                <button className="btn btn--ghost" onClick={() => setOv((prev) => ({ ...prev, loot: {} }))}>{'↺'} Valeurs d'origine</button>
                {ovDirty && <span className="bal-default" style={{ color: '#b5341f' }}>● non enregistré</span>}
                {status && <span className="qed-err" style={{ color: statusColor }}>{status}</span>}
              </div>
            </div>
          </div>
        ) : tab === 'forge' ? (
          <div className="qed-body">
            <div className="bal-detail">
              <div className="bal-detail-scroll">
                <ForgeCatalogEditor ov={ov} setOv={setOv} setStatus={setStatus} />
              </div>
              <div className="bal-detail-foot">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy || !ovDirty}>{busy ? 'Enregistrement…' : (ovDirty ? 'Enregistrer' : 'Enregistré ✓')}</button>
                <button className="btn btn--ghost" onClick={() => setOv((prev) => ({ ...prev, forge: {} }))}>{'↺'} Valeurs d'origine</button>
                {ovDirty && <span className="bal-default" style={{ color: '#b5341f' }}>● non enregistré</span>}
                {status && <span className="qed-err" style={{ color: statusColor }}>{status}</span>}
              </div>
            </div>
          </div>
        ) : tab === 'weather' ? (
          <div className="qed-body">
            <div className="bal-detail">
              <div className="bal-detail-scroll">
                <WeatherTab ov={ov} setOv={setOv} setStatus={setStatus} />
              </div>
              <div className="bal-detail-foot">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy || !ovDirty}>{busy ? 'Enregistrement…' : (ovDirty ? 'Enregistrer' : 'Enregistré ✓')}</button>
                <button className="btn btn--ghost" onClick={() => setOv((prev) => ({ ...prev, weather: {} }))}>{'↺'} Valeurs d'origine</button>
                {ovDirty && <span className="bal-default" style={{ color: '#b5341f' }}>● non enregistré</span>}
                {status && <span className="qed-err" style={{ color: statusColor }}>{status}</span>}
              </div>
            </div>
          </div>
        ) : tab === 'spells' ? (
          /* Magie : réglages MAGIC (overrides `magic` du blob balance, pied
             Enregistrer/reset ci-dessous) + CRUD quete_spells (le SpellsTab
             sauvegarde ses sorts lui-même via saveSpellRow). */
          <div className="qed-body">
            <div className="bal-detail">
              <div className="bal-detail-scroll">
                <SpellsTab ov={ov} setOv={setOv} setStatus={setStatus} />
              </div>
              <div className="bal-detail-foot">
                <button className="btn btn--green" onClick={handleSaveBalance} disabled={busy || !ovDirty}>{busy ? 'Enregistrement…' : (ovDirty ? 'Enregistrer' : 'Enregistré ✓')}</button>
                <button className="btn btn--ghost" onClick={() => setOv((prev) => ({ ...prev, magic: {} }))}>{'↺'} Valeurs d'origine</button>
                {ovDirty && <span className="bal-default" style={{ color: '#b5341f' }}>● non enregistré</span>}
                {status && <span className="qed-err" style={{ color: statusColor }}>{status}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="qed-body">
            <div className="qed-list">
              {tab === 'alchemy' ? (
                /* Onglet Alchimie : ingrédients + potions + recettes au même endroit. */
                <>
                  {/* Recherche (indispensable : ~1140 potions) */}
                  <div className="bal-listtools">
                    <input className="qed-search" placeholder="🔎 Rechercher (nom)…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  {rows == null && <div style={{ padding: 12, color: 'var(--ink-500)' }}>Chargement…</div>}
                  {rows != null && [
                    { fam: 'ingredient', label: '⚗️ Ingrédients', cap: 999 },
                    { fam: 'potion', label: '🧪 Potions', cap: 60 },
                  ].map(({ fam, label, cap }) => {
                    const q = search.trim().toLowerCase();
                    const all = (rows || []).filter((r) => r.family === fam && (!q || r.name.toLowerCase().includes(q)));
                    const list = all.slice(0, cap);
                    return (
                      <div key={fam}>
                        <div className="qed-label" style={{ margin: '8px 6px 4px' }}>{label} <span className="bal-default">({all.length})</span></div>
                        {all.length === 0 && <div style={{ padding: '2px 8px', color: 'var(--ink-500)', fontSize: 12 }}>{q ? 'Aucun résultat.' : "Aucun pour l'instant."}</div>}
                        {list.map((r) => {
                          const active = draft && draft.key === r.key && !draft._isNew;
                          return (
                            <button key={r.key} className={`qed-item ${active ? 'is-active' : ''} ${r.enabled === false ? 'is-disabled' : ''}`} onClick={() => chooseRow(r)}>
                              <ItemIcon item={{ name: r.name, img: r.img, icon: r.icon, rarity: r.rarity, slot: r.slot }} size={30} ring />
                              <span style={{ flex: 1 }}>{r.name}</span>
                              {active && dirty && <span className="bal-dirty-dot" title="Modifications non enregistrées" />}
                            </button>
                          );
                        })}
                        {all.length > list.length && <div style={{ padding: '4px 8px', color: 'var(--ink-500)', fontSize: 12 }}>+{all.length - list.length} autres — affine la recherche.</div>}
                      </div>
                    );
                  })}
                  <div>
                    <div className="qed-label" style={{ margin: '12px 6px 4px' }}>📜 Recettes <span className="bal-default">({recipeRows == null ? '…' : recipeRows.length})</span></div>
                    {(() => {
                      const q = search.trim().toLowerCase();
                      const matchRec = (r) => !q || (ITEMS[r.potion]?.name || '').toLowerCase().includes(q) || r.ingredients.some((k) => (ITEMS[k]?.name || '').toLowerCase().includes(q));
                      const all = (recipeRows || []).filter(matchRec);
                      const list = all.slice(0, 60);
                      return (<>
                        {list.map((r) => {
                          const active = recipeDraft && recipeDraft.key === r.key && !recipeDraft.isNew;
                          const isBaseOverride = BASE_RECIPES.some((b) => b.id === r.key);
                          return (
                            <button key={r.key} className={`qed-item ${active ? 'is-active' : ''}`} onClick={() => chooseRecipe(r)}>
                              <span style={{ flex: 1 }}>{recipeLine(r.ingredients, r.potion)}</span>
                              {isBaseOverride && <span className="bal-default" title="Recette intégrée modifiée (supprime pour restaurer l'originale)">✎ intégrée</span>}
                            </button>
                          );
                        })}
                        {all.length > list.length && <div style={{ padding: '4px 8px', color: 'var(--ink-500)', fontSize: 12 }}>+{all.length - list.length} autres — affine la recherche.</div>}
                      </>);
                    })()}
                    {/* Recettes intégrées : cliquables pour les modifier (crée un override
                        de même id). Celles déjà personnalisées sont masquées ici (elles
                        apparaissent au-dessus, marquées « ✎ intégrée »). */}
                    {(() => {
                      const overridden = new Set((recipeRows || []).map((r) => r.key));
                      const base = BASE_RECIPES.filter((r) => !overridden.has(r.id));
                      if (!base.length) return null;
                      return (
                        <>
                          <div className="bal-default" style={{ margin: '8px 6px 2px' }}>Intégrées (clique pour modifier)</div>
                          {base.map((r) => {
                            const active = recipeDraft && recipeDraft.key === r.id;
                            return (
                              <button key={r.id} className={`qed-item ${active ? 'is-active' : ''}`} onClick={() => chooseBaseRecipe(r)}>
                                <span style={{ flex: 1 }}>{recipeLine(r.ingredients, r.potion)}</span>
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <>
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
                    // Potions & ingrédients (alchimie) ont slot:'consumable' mais vivent dans
                    // l'onglet « Alchimie » — on les exclut ici pour ne pas noyer la liste des
                    // consommables « normaux » sous ~1140 potions craftables.
                    const list = (rows || []).filter((r) => r.slot === g.slot
                      && !(g.slot === 'consumable' && (r.family === 'potion' || r.family === 'ingredient'))
                      && matches(r));
                    if (!list.length) return null;
                    return (
                      <div key={g.slot}>
                        <div className="qed-label" style={{ margin: '8px 6px 4px' }}>
                          {g.label} <span className="bal-default">({list.length})</span>
                          {g.slot === 'consumable' && <span className="bal-default"> — potions & ingrédients dans l’onglet ⚗️ Alchimie</span>}
                        </div>
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
                </>
              )}
            </div>

            {tab === 'alchemy' && recipeDraft ? (
              <div className="bal-detail">
                <div className="bal-detail-top">
                  <div className="bal-card bal-card--mini">
                    <span style={{ fontSize: 44 }}>{ITEMS[recipeDraft.potion]?.icon || '⚗️'}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                      <span className="bal-pill" style={{ background: '#7a5ea8', alignSelf: 'flex-start' }}>Recette</span>
                      <div className="bal-card-name" style={{ fontSize: 17 }}>{recipeDraft.fromBase ? 'Recette intégrée (à modifier)' : recipeDraft.isNew ? 'Nouvelle recette' : 'Recette'}</div>
                      <div className="bal-card-desc" style={{ textAlign: 'left' }}>{recipeLine(recipeDraft.ingredients, recipeDraft.potion)}</div>
                    </div>
                  </div>
                </div>
                <AlchemyRecipeForm
                  draft={recipeDraft} ingKeys={ingKeys} potKeys={potKeys}
                  onChange={setRecipeDraft} onSave={saveRecipe} onDelete={deleteRecipe}
                  onCancel={() => setRecipeDraft(null)} busy={busy}
                />
                {status && <div className="qed-err" style={{ padding: '0 12px 10px', color: statusColor }}>{status}</div>}
              </div>
            ) : draft ? (
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

                      {draft.slot === 'consumable' && (
                        <div className="bal-row">
                          <span className="bal-label">Famille</span>
                          <select className="qed-select" style={{ width: 220 }} value={draft.family || ''}
                            onChange={(ev) => {
                              const f = ev.target.value || undefined;
                              set({ family: f, ...(f === 'parchment' && !draft.enchant ? { enchant: { type: 'timerBonus', value: 3 } } : {}) });
                            }}>
                            <option value="">Consommable normal</option>
                            <option value="ingredient">⚗️ Ingrédient (alchimie)</option>
                            <option value="potion">⚗️ Potion (alchimie)</option>
                            <option value="parchment">📜 Parchemin (enchantement)</option>
                          </select>
                        </div>
                      )}

                      {draft.slot === 'consumable' && draft.family === 'parchment' && (() => {
                        const e = draft.enchant || {};
                        const isTrigger = e.kind === 'trigger';
                        const on = isTrigger ? e.on : null;
                        const rollVal = e.values?.[0] ?? 5;
                        const trigAmt = e.do?.[0]?.n ?? 15;
                        const subj = e.subjects?.[0] ?? SUBJECT_KEYS[0];
                        const passType = e.type || 'timerBonus';
                        const passVal = e.value ?? 3;
                        const money = (n) => [{ action: 'money', mode: 'gain', target: 'self', n, unit: 'flat' }];
                        const TRIG_OPTS = [
                          ['__roll', '🎲 +or quand je fais N'],
                          ['__correct', '✅ +or à chaque bonne réponse'],
                          ['__wrong', '❌ +or à chaque erreur'],
                          ['__questionSubject', '🎯 +or sur une question de…'],
                        ];
                        const buildTrigger = (kind) => {
                          const base = { kind: 'trigger', do: money(trigAmt) };
                          if (kind === 'roll') return { ...base, on: 'roll', values: [rollVal] };
                          if (kind === 'questionSubject') return { ...base, on: 'questionSubject', subjects: [subj] };
                          return { ...base, on: kind }; // correct | wrong
                        };
                        return (
                          <div className="qed-field" style={{ marginTop: 8, padding: 10, border: '1px solid rgba(122,94,58,0.2)', borderRadius: 10 }}>
                            <label className="qed-label">📜 Effet du parchemin (posé sur la pièce)</label>
                            <div className="bal-row">
                              <span className="bal-label">Type</span>
                              <select className="qed-select" style={{ width: 220 }} value={isTrigger ? '__' + on : passType}
                                onChange={(ev) => {
                                  const v = ev.target.value;
                                  if (v.startsWith('__')) set({ enchant: buildTrigger(v.slice(2)) });
                                  else set({ enchant: { type: v, value: passVal } });
                                }}>
                                {EQUIP_EFFECTS.map((t) => <option key={t} value={t}>{EFFECT_LABELS[t] || t}</option>)}
                                {TRIG_OPTS.map(([v, lab]) => <option key={v} value={v}>{lab}</option>)}
                              </select>
                            </div>
                            {isTrigger ? (
                              <>
                                {on === 'roll' && (
                                  <div className="bal-row"><span className="bal-label">Quand je fais</span>
                                    <Stepper value={rollVal} onChange={(v) => set({ enchant: { ...e, values: [Math.max(1, Math.min(10, v))] } })} min={1} max={10} /></div>
                                )}
                                {on === 'questionSubject' && (
                                  <div className="bal-row"><span className="bal-label">Matière</span>
                                    <select className="qed-select" style={{ width: 220 }} value={subj} onChange={(ev) => set({ enchant: { ...e, subjects: [ev.target.value] } })}>
                                      {SUBJECT_KEYS.map((k) => <option key={k} value={k}>{SUBJECTS[k]?.name || k}</option>)}
                                    </select></div>
                                )}
                                <div className="bal-row"><span className="bal-label">+ pièces</span>
                                  <Stepper value={trigAmt} onChange={(v) => set({ enchant: { ...e, do: [{ ...e.do[0], n: v }] } })} max={999} /></div>
                              </>
                            ) : (
                              <div className="bal-row"><span className="bal-label">Valeur</span>
                                <Stepper value={passVal} onChange={(v) => set({ enchant: { type: passType, value: v } })} max={999} /></div>
                            )}
                          </div>
                        );
                      })()}

                      {draft.slot !== 'consumable' && (
                        <div className="bal-row">
                          <span className="bal-label">Set</span>
                          <select className="qed-select" style={{ width: 200 }} value={draft.set || ''} onChange={(ev) => set({ set: ev.target.value })}>
                            <option value="">— aucun —</option>
                            {setEntries.map(([k, s]) => <option key={k} value={k}>{setVal(k, 'icon') || s.icon} {setVal(k, 'name') || s.name}</option>)}
                          </select>
                          <span className="bal-default">bonus à 2/3 pièces équipées</span>
                        </div>
                      )}

                      <label className="bal-toggle" style={{ marginTop: 4 }}>
                        <input type="checkbox" checked={!!draft.lootOnly} onChange={(ev) => set({ lootOnly: ev.target.checked })} />
                        Loot only — introuvable en boutique (reste en loot : coffres, duels…)
                      </label>

                      {/* Gating par matière : l'objet n'apparaît en loot / boutique que si
                          AU MOINS une matière cochée est active dans la partie. */}
                      <div className="bal-row" style={{ marginTop: 12, alignItems: 'flex-start' }}>
                        <span className="bal-label">Matières requises</span>
                        <div className="bal-chips" style={{ flex: 1 }}>
                          {[...SUBJECT_KEYS, ...FORCED_SUBJECT_KEYS].map((k) => {
                            const on = (draft.requiresSubjects || []).includes(k);
                            return (
                              <button key={k} type="button" className={`bal-chip ${on ? 'is-active' : ''}`}
                                onClick={() => {
                                  const cur = draft.requiresSubjects || [];
                                  set({ requiresSubjects: on ? cur.filter((s) => s !== k) : [...cur, k] });
                                }}>
                                {SUBJECTS[k]?.icon} {SUBJECTS[k]?.name || k}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="bal-default" style={{ marginTop: 2 }}>
                        {(draft.requiresSubjects || []).length
                          ? 'Lootable / en boutique SEULEMENT si au moins une de ces matières est sélectionnée pour la partie.'
                          : 'Aucune restriction : disponible quelles que soient les matières choisies.'}
                      </div>

                      <label className="bal-toggle" style={{ marginTop: 12 }}>
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
                              if (type === 'lootBonusSubject' && !fx.subject) patch.subject = 'svt';
                              updateEffect(i, patch);
                            }}>
                              {(effectPool.includes(fx.type) ? effectPool : [fx.type, ...effectPool]).map((t) => (
                                <option key={t} value={t}>{EFFECT_LABELS[t] || t}</option>
                              ))}
                            </select>
                            {fx.type === 'lootBonusSubject' && (
                              <select className="qed-select" value={fx.subject || 'svt'} onChange={(ev) => updateEffect(i, { subject: ev.target.value })} title="Matière de la case ciblée">
                                {SUBJECT_KEYS.map((s) => <option key={s} value={s}>{SUBJECTS[s]?.icon} {SUBJECTS[s]?.name || s}</option>)}
                              </select>
                            )}
                            {!BINARY_EFFECTS.has(fx.type) && (DICEABLE_EFFECTS.has(fx.type)
                              ? <AmountInput value={fx.value ?? 0} onChange={(v) => updateEffect(i, { value: v })} min={1} dice={diceFor(fx.type)} unit={EFFECT_UNIT[fx.type] || ''} />
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
                        <label className="qed-label">Description simple (vue par les joueurs)</label>
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
