// Analyse de la distribution des effets des potions (gate de rééquilibrage).
// Affiche la part de chaque type d'effet + signale les bandes-cible violées :
//   chaque effet ∈ [5 %, 25 %] · mono-effet < 8 % · couverture ≥ 27 types.
//   node scripts/analyze-potions.mjs
import { POTIONS } from '../src/data/alchemyGen.js';
const pots = Object.values(POTIONS);
const N = pots.length;

function label(a) {
  switch (a.action) {
    case 'money': return a.mode === 'gain' ? 'Or +' : a.mode === 'lose' ? 'Or − (ennemi)' : a.mode === 'steal' ? "Vol d'or" : 'Or';
    case 'move': return a.dir === 'forward' ? 'Avancer' : 'Reculer (ennemi)';
    case 'extraTime': return 'Temps +';
    case 'shieldNext': return 'Bouclier';
    case 'gainCharge': return 'Recharge pouvoir';
    case 'teleportFurthest': return 'Téléportation';
    case 'fumigene': return 'Fumigène';
    case 'forceSubject': return 'Forcer matière';
    case 'curseTimer': return 'Malédiction chrono';
    case 'curseExtraQuestion': return 'Question en +';
    case 'randomPathNext': return 'Voie aléatoire';
    case 'blockPowers': return 'Blocage pouvoirs';
    case 'blockConsumables': return 'Blocage conso';
    case 'loot': return 'Loot objet';
    case 'loseItem': return "Vol d'objet";
    case 'placeTrap': return 'Poser un piège';
    case 'buff': return 'Buff: ' + (a.buff?.type || '?');
    default: return a.action || '?';
  }
}
function actionsOf(p) {
  const acts = []; let gamble = false;
  for (const fx of (p.effects || [])) {
    for (const a of (fx.do || [])) acts.push(a);
    if (fx.roll && fx.table) { gamble = true; for (const arr of Object.values(fx.table)) for (const a of arr) acts.push(a); }
  }
  return { acts, gamble };
}

const potionsWith = {}; let gambleCount = 0; const effDist = {}; const sigCount = {};
const scaledUse = { count: 0 };
for (const p of pots) {
  const { acts, gamble } = actionsOf(p);
  if (gamble) gambleCount++;
  const mainDo = (p.effects || []).flatMap((fx) => fx.do || []);
  for (const a of mainDo) if (a.n && typeof a.n === 'object') scaledUse.count++;
  const labels = new Set([...mainDo.map(label), ...(gamble ? ['🎲 Hasard'] : [])]);
  for (const l of labels) potionsWith[l] = (potionsWith[l] || 0) + 1;
  effDist[mainDo.length] = (effDist[mainDo.length] || 0) + 1;
  const sig = mainDo.map(label).sort().join(' + ');
  sigCount[sig] = (sigCount[sig] || 0) + 1;
}

const pct = (n) => (100 * n / N).toFixed(1) + '%';
console.log(`\n=== ${N} potions ===\n— Part des potions par type d'effet —`);
const rows = Object.entries(potionsWith).sort((a, b) => b[1] - a[1]);
const viol = [];
for (const [l, n] of rows) {
  const p = 100 * n / N;
  const flag = p > 25 ? '🔴 >25%' : p < 5 ? '🟡 <5%' : '';
  if (flag) viol.push(`${l}: ${pct(n)} ${flag}`);
  console.log(`  ${pct(n).padStart(6)}  ${l}${flag ? '  ' + flag : ''}`);
}
const mono = (effDist[1] || 0);
console.log(`\n— Couverture : ${rows.length} types d'effets utilisés`);
console.log(`— Mono-effet : ${pct(mono)} (cible < 8 %)`);
console.log(`— Hasard (d6) : ${pct(gambleCount)}`);
console.log(`— Valeurs à l'échelle : ${scaledUse.count} occurrences`);
const sigs = Object.entries(sigCount).sort((a, b) => b[1] - a[1]);
console.log(`— Combinaisons distinctes : ${sigs.length} ; top1=${pct(sigs[0][1])}, top10=${pct(sigs.slice(0,10).reduce((s,x)=>s+x[1],0))}`);

console.log('\n=== VERDICT ===');
if (mono / N >= 0.08) viol.push(`Mono-effet ${pct(mono)} ≥ 8%`);
if (rows.length < 27) viol.push(`Couverture ${rows.length} < 27`);
if (viol.length) { console.log('❌ Bandes violées :'); viol.forEach((v) => console.log('   - ' + v)); }
else console.log('✅ Toutes les bandes respectées.');
