// Associe les images d'événements (dossier opaque ChatGPT) aux clés d'événements.
// Hypothèse d'ordre : tri par horodatage puis par indice (n) = ordre des 2 tableaux
// de renommage fournis. Mode --montage : génère des planches de vérification.
// Mode --copy : copie chaque image vers src/assets/events/<clé>.png (détourée du fond).
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = 'C:/Users/Utilisateur/Pictures/Evenements';
const OUT = path.join(ROOT, 'src/assets/events');
const TMP = path.join(ROOT, 'tmp_sprites');

// Ordre des clés = table 1 (29) puis table 2 (23).
const KEYS = [
  // — Table 1 —
  'rejouer', 'decharge', 'sacrifice', 'coupDePouce', 'teleport', 'recharge', 'vol', 'echange',
  'bonus', 'tresor', 'marcheNoir', 'volArgent', 'banquier', 'coffre', 'marchandAmbulant', 'pillage',
  'troisCoffres', 'benediction', 'poseurPiege', 'forge', 'reliquaire', 'herboriste', 'chaudronAbandonne',
  'pluieEssences', 'eureka', 'scribeAmbulant', 'runeMysterieuse', 'encreRunique', 'subventionScribe',
  // — Table 2 —
  'recul', 'oubli', 'tempete', 'taxeCommune', 'malediction', 'tempeteMagnetique', 'explosionChaudron',
  'duel', 'pari', 'vaTout', 'sphinx', 'tournoi', 'don', 'embuscade', 'impot', 'pickpocket',
  'boussoleCassee', 'hacking', 'effacement', 'quitteDouble', 'jackpot', 'loterie', 'troc',
];

// Tri des fichiers : horodatage (HH_MM_SS) puis indice (n).
function orderedFiles() {
  const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png'));
  const parsed = files.map((f) => {
    const t = f.match(/(\d\d)_(\d\d)_(\d\d)/);
    const n = f.match(/\((\d+)\)/);
    const ts = t ? Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]) : 0;
    return { f, ts, n: n ? Number(n[1]) : 0 };
  });
  parsed.sort((a, b) => (a.ts - b.ts) || (a.n - b.n));
  return parsed.map((p) => p.f);
}

async function montage() {
  fs.mkdirSync(TMP, { recursive: true });
  const files = orderedFiles();
  console.log(`${files.length} images, ${KEYS.length} clés`);
  const COLS = 6, TH = 200, LBL = 26, PAD = 6;
  const cellW = TH + PAD * 2, cellH = TH + LBL + PAD * 2;
  const makeSheet = async (from, to, name) => {
    const items = [];
    for (let i = from; i < to && i < files.length; i++) {
      const idx = i - from;
      const col = idx % COLS, row = (idx / COLS) | 0;
      const thumb = await sharp(path.join(SRC, files[i])).resize(TH, TH, { fit: 'contain', background: { r: 10, g: 14, b: 22, alpha: 1 } }).png().toBuffer();
      const label = `${i + 1}. ${KEYS[i] || '???'}`;
      const svg = Buffer.from(`<svg width="${cellW}" height="${LBL}"><rect width="100%" height="100%" fill="#0b0e16"/><text x="6" y="18" font-family="monospace" font-size="15" fill="#8fd0e6">${label}</text></svg>`);
      items.push({ input: thumb, left: col * cellW + PAD, top: row * cellH + PAD });
      items.push({ input: svg, left: col * cellW, top: row * cellH + TH + PAD });
    }
    const rows = Math.ceil((to - from) / COLS);
    await sharp({ create: { width: COLS * cellW, height: rows * cellH, channels: 4, background: { r: 6, g: 8, b: 14, alpha: 1 } } })
      .composite(items).png().toFile(path.join(TMP, name));
    console.log('→', name);
  };
  await makeSheet(0, 29, '_ev_map_1.png');   // table 1
  await makeSheet(29, 52, '_ev_map_2.png');  // table 2
}

const isBg = (r, g, b) => r > 165 && b > 165 && g < 115; // magenta éventuel
async function copyAll() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = orderedFiles();
  for (let i = 0; i < KEYS.length; i++) {
    const src = path.join(SRC, files[i]);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;
    // Détoure un éventuel fond magenta (sinon garde tel quel).
    let hasMagenta = false;
    for (let p = 0; p < data.length; p += C * 997) { if (isBg(data[p], data[p + 1], data[p + 2])) { hasMagenta = true; break; } }
    // Redimensionne à 512px max (bundle web raisonnable : ~2,5 Mo → ~0,4 Mo).
    const resize = { width: 512, height: 512, fit: 'inside' };
    if (hasMagenta) {
      const buf = Buffer.alloc(W * H * 4, 0);
      for (let j = 0; j < W * H; j++) {
        const si = j * C, r = data[si], g = data[si + 1], b = data[si + 2];
        if (isBg(r, g, b)) continue;
        const di = j * 4; buf[di] = r; buf[di + 1] = g; buf[di + 2] = b; buf[di + 3] = 255;
      }
      await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).trim().resize(resize).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${KEYS[i]}.png`));
    } else {
      await sharp(src).resize(resize).png({ compressionLevel: 9 }).toFile(path.join(OUT, `${KEYS[i]}.png`));
    }
    console.log(`${String(i + 1).padStart(2)} ${KEYS[i].padEnd(20)} ← ${files[i]}`);
  }
  console.log(`\n${KEYS.length} images copiées → src/assets/events/`);
}

const mode = process.argv[2] || '--montage';
(mode === '--copy' ? copyAll() : montage()).catch((e) => { console.error(e); process.exit(1); });
