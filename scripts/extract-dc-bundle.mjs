// Extrait les assets d'un export « hors-ligne » Claude Design (bundle base64/gzip
// dans <script type="__bundler/manifest">) vers un dossier, pour lire la maquette.
//   node scripts/extract-dc-bundle.mjs <bundle.html> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [file, outDir] = process.argv.slice(2);
if (!file || !outDir) { console.error('usage: extract-dc-bundle.mjs <bundle.html> <outDir>'); process.exit(1); }

const html = fs.readFileSync(file, 'utf8');
const grab = (type) => {
  const m = html.match(new RegExp(`<script type="__bundler/${type}"[^>]*>([\\s\\S]*?)</script>`));
  if (!m) { console.error(`bloc ${type} introuvable`); process.exit(1); }
  return JSON.parse(m[1]);
};

const manifest = grab('manifest');
fs.mkdirSync(outDir, { recursive: true });

const index = [];
for (const [uuid, entry] of Object.entries(manifest)) {
  let bytes = Buffer.from(entry.data, 'base64');
  if (entry.compressed) bytes = zlib.gunzipSync(bytes);
  const name = (entry.name || entry.path || uuid).replace(/[\\/:*?"<>|]/g, '_');
  fs.writeFileSync(path.join(outDir, name), bytes);
  index.push({ uuid, name, type: entry.type || entry.mimeType || '?', size: bytes.length });
}

// Le template est la page hôte (HTML final) : utile pour voir la structure.
const template = grab('template');
fs.writeFileSync(path.join(outDir, '__template.html'), typeof template === 'string' ? template : JSON.stringify(template, null, 2));

console.log(index.map((e) => `${e.size.toString().padStart(9)}  ${e.type.padEnd(24)} ${e.name}`).join('\n'));
console.log(`\n${index.length} assets → ${outDir}`);
