// Seed « mystères » (phase 2 de MINIJEUX_SOUHAITS.md) : pools de questions à
// IMAGE pour le moteur deblur — jaquettes de jeux vidéo, animaux, plantes,
// roches, logos de marques, célébrités, persos BD/comics/manga, affiches
// horreur & super-héros.
//
// Sources (une par pool, listes CURÉES pour la reconnaissabilité en classe) :
//   - RAWG (jeux les plus populaires, clé VITE_RAWG_API_KEY du projet Ciné)
//   - iNaturalist (photos animaux/plantes par nom scientifique, licences CC)
//   - Wikipédia FR (vignette de page : roches, marques, célébrités, persos BD)
//   - Jikan / MyAnimeList (persos manga les plus aimés)
//   - TMDB (affiches horreur genre 27 / super-héros keyword 9715)
//
// Même contrat que seed-cinema-affiches : image → bucket `quete-questions`
// (NOM OPAQUE anti-triche) → quete_questions (t='Image' ou 'Affiche').
// Distracteurs par CATÉGORIE (mammifère avec mammifères, marque de sport avec
// marques de sport…). Idempotent : delete-then-insert par (subject, t).
//
//   node scripts/seed-deblur-pack.mjs [pool ...]
//     pools : jv animaux plantes geologie logos celebrites persos horreur superheros
//     (défaut : tous)
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const URL_ = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
const BUCKET = 'quete-questions';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// fetch AVEC TIMEOUT (20 s) : sans ça, une requête qui ne répond jamais fige
// tout le script (Node n'a pas de timeout par défaut).
const fetchT = (url, opts = {}) => fetch(url, { signal: AbortSignal.timeout(20000), ...opts });
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// Clés API du projet Ciné (jamais loggées).
function cineEnvKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    const m = readFileSync('C:/Users/Utilisateur/OneDrive/Code/Ciné/.env', 'utf8')
      .match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* absent */ }
  return null;
}

async function uploadImage(url) {
  const r = await fetchT(url);
  if (!r.ok) throw new Error(`img HTTP ${r.status}`);
  const ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const ext = ct.includes('png') ? 'png' : ct.includes('svg') ? 'svg' : ct.includes('webp') ? 'webp' : 'jpg';
  const buf = Buffer.from(await r.arrayBuffer());
  const path = `q-${randomUUID()}.${ext}`; // OPAQUE
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: true });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Distracteurs : même catégorie d'abord, puis n'importe (3 requis).
function distractorsFor(target, all) {
  const usable = all.filter((x) => x !== target && x.name !== target.name);
  const tiers = [usable.filter((x) => x.cat && x.cat === target.cat), usable];
  const out = []; const used = new Set([target.name]);
  for (const tier of tiers) {
    for (const x of shuffle(tier)) {
      if (out.length >= 3) return out;
      if (used.has(x.name)) continue;
      used.add(x.name); out.push(x);
    }
  }
  return out;
}

// Construit + insère les questions d'un pool : items = [{ name, cat, img }].
async function seedPool({ subject, tag = 'Image', qFr, qEn, items }) {
  const rows = [];
  let ord = 0;
  for (const item of items) {
    if (!item.img) continue;
    const distractors = distractorsFor(item, items.filter((x) => x.img || x.name !== item.name));
    if (distractors.length < 3) { console.warn(`  ✗ ${item.name} : distracteurs insuffisants`); continue; }
    let img = null;
    for (const src of [item.img, item.imgAlt].filter(Boolean)) {
      try { img = await uploadImage(src); break; }
      catch (e) { console.warn(`  ✗ image ${item.name} : ${e.message}`); }
    }
    if (!img) continue;
    const choices = shuffle([item, ...distractors]);
    rows.push({
      pool: 'cycle4', subject, level: null, t: tag, enabled: true, ord: ord++,
      q: qFr, q_en: qEn,
      rep_a: choices[0].name, rep_b: choices[1].name, rep_c: choices[2].name, rep_d: choices[3].name,
      correcte: choices.findIndex((x) => x.name === item.name) + 1,
      e: `Bonne réponse : ${item.name}.`, e_en: `Correct answer: ${item.name}.`,
      img,
    });
  }
  console.log(`→ ${subject} : ${rows.length} questions. Remplacement en base…`);
  const { error: delErr } = await sb.from('quete_questions').delete().eq('subject', subject).eq('t', tag);
  if (delErr) { console.error('delete:', delErr.message); process.exit(1); }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
    if (error) { console.error('insert:', error.message); process.exit(1); }
  }
  console.log(`✓ ${rows.length} questions « ${subject} » insérées.`);
}

// ── Sources d'images ─────────────────────────────────────────────────────────

// Vignette Wikipédia FR d'une page (souvent le logo / la photo de l'infobox).
// Retry avec backoff : l'API limite le débit (des rafales à ~8 req/s finissent
// en refus permanent). Et ne JAMAIS demander une vignette plus grande que
// l'original (le thumbnailer répond 400 si on tente d'agrandir).
async function wikiThumb(title) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetchT(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
        headers: { 'User-Agent': 'quete-matieres-seed/1.0 (contact: usage scolaire local)' },
      });
      if (r.status === 429 || r.status >= 500) {
        console.warn(`  … wiki ${title} : HTTP ${r.status}, retry dans ${2 ** attempt * 2}s`);
        await sleep(2 ** attempt * 2000);
        continue;
      }
      if (!r.ok) { console.warn(`  ✗ wiki ${title} : HTTP ${r.status}`); return null; }
      const j = await r.json();
      const orig = j.originalimage;
      if (!orig?.source) return j.thumbnail?.source || null;
      // Original raisonnable (ou SVG) → qualité max ; sinon vignette 800px
      // (garantie < largeur d'origine puisque orig.width > 900).
      if (orig.width <= 900 || orig.source.endsWith('.svg')) return orig.source;
      const t = j.thumbnail?.source;
      return t && /\/\d+px-/.test(t) ? t.replace(/\/(\d+)px-/, '/800px-') : orig.source;
    } catch (e) {
      console.warn(`  … wiki ${title} : ${e.name}, retry`);
      await sleep(2000);
    }
  }
  return null;
}

// Photo iNaturalist par nom scientifique (medium ~500px).
async function inatPhoto(scientific) {
  try {
    const r = await fetchT(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(scientific)}&rank=species,genus&per_page=1`);
    if (!r.ok) return null;
    const t = (await r.json()).results?.[0];
    return t?.default_photo?.medium_url || null;
  } catch { return null; }
}

async function resolveImages(list, resolver, delay = 400) {
  const out = [];
  for (const item of list) {
    const img = await resolver(item);
    if (!img) console.warn(`  ✗ pas d'image : ${item.name}`);
    out.push({ ...item, img });
    await sleep(delay);
  }
  return out;
}

// Vignettes Wikipédia PAR LOT (API Action, prop=pageimages, 50 titres/requête) :
// contourne le rate-limit de l'API REST (2 requêtes au lieu de 150) et
// `pithumbsize` est BORNÉ à l'original par MediaWiki (aucun 400 d'agrandissement).
// Retourne les items enrichis de `img` (suit normalisations + redirections).
async function wikiImagesBatch(items) {
  const byTitle = new Map();
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    const url = new URL('https://fr.wikipedia.org/w/api.php');
    url.searchParams.set('action', 'query');
    url.searchParams.set('prop', 'pageimages');
    url.searchParams.set('piprop', 'thumbnail');
    url.searchParams.set('pithumbsize', '800');
    url.searchParams.set('titles', chunk.map((x) => x.wiki).join('|'));
    url.searchParams.set('redirects', '1');
    url.searchParams.set('format', 'json');
    const r = await fetchT(url, { headers: { 'User-Agent': 'quete-matieres-seed/1.0 (usage scolaire local)' } });
    if (!r.ok) { console.warn(`  ✗ wiki batch : HTTP ${r.status}`); continue; }
    const j = await r.json();
    // Chaîne titre demandé → normalisé → redirigé → page.
    const forward = {};
    for (const n of j.query?.normalized || []) forward[n.from] = n.to;
    for (const n of j.query?.redirects || []) forward[n.from] = n.to;
    const resolve = (t) => { let cur = t, guard = 0; while (forward[cur] && guard++ < 5) cur = forward[cur]; return cur; };
    const pages = Object.values(j.query?.pages || {});
    for (const x of chunk) {
      const page = pages.find((p) => p.title === resolve(x.wiki));
      byTitle.set(x.wiki, page?.thumbnail?.source || null);
    }
    await sleep(500);
  }
  return items.map((x) => {
    const img = byTitle.get(x.wiki) || null;
    if (!img) console.warn(`  ✗ pas d'image : ${x.name}`);
    return { ...x, img };
  });
}

// ── Listes curées ────────────────────────────────────────────────────────────

const ANIMAUX = [
  // [nom FR, nom scientifique, catégorie]
  ['Lion', 'Panthera leo', 'mam'], ['Tigre', 'Panthera tigris', 'mam'],
  ['Éléphant d\'Afrique', 'Loxodonta africana', 'mam'], ['Girafe', 'Giraffa camelopardalis', 'mam'],
  ['Zèbre', 'Equus quagga', 'mam'], ['Hippopotame', 'Hippopotamus amphibius', 'mam'],
  ['Rhinocéros blanc', 'Ceratotherium simum', 'mam'], ['Gorille', 'Gorilla gorilla', 'mam'],
  ['Chimpanzé', 'Pan troglodytes', 'mam'], ['Orang-outan', 'Pongo pygmaeus', 'mam'],
  ['Panda géant', 'Ailuropoda melanoleuca', 'mam'], ['Koala', 'Phascolarctos cinereus', 'mam'],
  ['Kangourou roux', 'Osphranter rufus', 'mam'], ['Loup gris', 'Canis lupus', 'mam'],
  ['Renard roux', 'Vulpes vulpes', 'mam'], ['Ours brun', 'Ursus arctos', 'mam'],
  ['Ours polaire', 'Ursus maritimus', 'mam'], ['Lynx boréal', 'Lynx lynx', 'mam'],
  ['Guépard', 'Acinonyx jubatus', 'mam'], ['Léopard', 'Panthera pardus', 'mam'],
  ['Hyène tachetée', 'Crocuta crocuta', 'mam'], ['Suricate', 'Suricata suricatta', 'mam'],
  ['Paresseux', 'Bradypus variegatus', 'mam'], ['Tatou à neuf bandes', 'Dasypus novemcinctus', 'mam'],
  ['Fourmilier géant', 'Myrmecophaga tridactyla', 'mam'], ['Hérisson d\'Europe', 'Erinaceus europaeus', 'mam'],
  ['Écureuil roux', 'Sciurus vulgaris', 'mam'], ['Castor d\'Europe', 'Castor fiber', 'mam'],
  ['Loutre d\'Europe', 'Lutra lutra', 'mam'], ['Blaireau', 'Meles meles', 'mam'],
  ['Sanglier', 'Sus scrofa', 'mam'], ['Cerf élaphe', 'Cervus elaphus', 'mam'],
  ['Chevreuil', 'Capreolus capreolus', 'mam'], ['Bouquetin des Alpes', 'Capra ibex', 'mam'],
  ['Chamois', 'Rupicapra rupicapra', 'mam'], ['Marmotte des Alpes', 'Marmota marmota', 'mam'],
  ['Dauphin commun', 'Delphinus delphis', 'mer'], ['Orque', 'Orcinus orca', 'mer'],
  ['Baleine à bosse', 'Megaptera novaeangliae', 'mer'], ['Phoque veau-marin', 'Phoca vitulina', 'mer'],
  ['Morse', 'Odobenus rosmarus', 'mer'],
  ['Aigle royal', 'Aquila chrysaetos', 'ois'], ['Faucon pèlerin', 'Falco peregrinus', 'ois'],
  ['Chouette effraie', 'Tyto alba', 'ois'], ['Hibou grand-duc', 'Bubo bubo', 'ois'],
  ['Flamant rose', 'Phoenicopterus roseus', 'ois'], ['Ara rouge', 'Ara macao', 'ois'],
  ['Toucan toco', 'Ramphastos toco', 'ois'], ['Autruche', 'Struthio camelus', 'ois'],
  ['Manchot empereur', 'Aptenodytes forsteri', 'ois'], ['Pélican blanc', 'Pelecanus onocrotalus', 'ois'],
  ['Cigogne blanche', 'Ciconia ciconia', 'ois'], ['Héron cendré', 'Ardea cinerea', 'ois'],
  ['Martin-pêcheur', 'Alcedo atthis', 'ois'], ['Rouge-gorge', 'Erithacus rubecula', 'ois'],
  ['Mésange bleue', 'Cyanistes caeruleus', 'ois'], ['Pie bavarde', 'Pica pica', 'ois'],
  ['Grand corbeau', 'Corvus corax', 'ois'], ['Paon bleu', 'Pavo cristatus', 'ois'],
  ['Cygne tuberculé', 'Cygnus olor', 'ois'],
  ['Crocodile du Nil', 'Crocodylus niloticus', 'rep'], ['Alligator d\'Amérique', 'Alligator mississippiensis', 'rep'],
  ['Python royal', 'Python regius', 'rep'], ['Cobra royal', 'Ophiophagus hannah', 'rep'],
  ['Caméléon panthère', 'Furcifer pardalis', 'rep'], ['Iguane vert', 'Iguana iguana', 'rep'],
  ['Tortue verte', 'Chelonia mydas', 'rep'], ['Vipère aspic', 'Vipera aspis', 'rep'],
  ['Rainette verte', 'Hyla arborea', 'rep'], ['Axolotl', 'Ambystoma mexicanum', 'rep'],
  ['Salamandre tachetée', 'Salamandra salamandra', 'rep'],
  ['Grand requin blanc', 'Carcharodon carcharias', 'mer'], ['Requin-marteau', 'Sphyrna mokarran', 'mer'],
  ['Poisson-clown', 'Amphiprion ocellaris', 'mer'], ['Hippocampe', 'Hippocampus guttulatus', 'mer'],
  ['Raie manta', 'Mobula birostris', 'mer'], ['Espadon', 'Xiphias gladius', 'mer'],
  ['Poisson-lune', 'Mola mola', 'mer'], ['Murène', 'Muraena helena', 'mer'],
  ['Pieuvre commune', 'Octopus vulgaris', 'mer'], ['Étoile de mer commune', 'Asterias rubens', 'mer'],
  ['Homard européen', 'Homarus gammarus', 'mer'],
  ['Coccinelle à sept points', 'Coccinella septempunctata', 'ins'], ['Abeille domestique', 'Apis mellifera', 'ins'],
  ['Papillon monarque', 'Danaus plexippus', 'ins'], ['Mante religieuse', 'Mantis religiosa', 'ins'],
  ['Scarabée rhinocéros', 'Oryctes nasicornis', 'ins'], ['Escargot de Bourgogne', 'Helix pomatia', 'ins'],
].map(([name, sci, cat]) => ({ name, sci, cat }));

const PLANTES = [
  ['Coquelicot', 'Papaver rhoeas', 'fleur'], ['Tournesol', 'Helianthus annuus', 'fleur'],
  ['Lavande vraie', 'Lavandula angustifolia', 'fleur'], ['Pissenlit', 'Taraxacum officinale', 'fleur'],
  ['Marguerite', 'Leucanthemum vulgare', 'fleur'], ['Bleuet', 'Centaurea cyanus', 'fleur'],
  ['Muguet', 'Convallaria majalis', 'fleur'], ['Tulipe', 'Tulipa gesneriana', 'fleur'],
  ['Jonquille', 'Narcissus pseudonarcissus', 'fleur'], ['Perce-neige', 'Galanthus nivalis', 'fleur'],
  ['Ortie', 'Urtica dioica', 'autre'], ['Fougère aigle', 'Pteridium aquilinum', 'autre'],
  ['Trèfle des prés', 'Trifolium pratense', 'autre'], ['Chardon commun', 'Cirsium vulgare', 'autre'],
  ['Edelweiss', 'Leontopodium nivale', 'fleur'], ['Genêt à balais', 'Cytisus scoparius', 'autre'],
  ['Bruyère commune', 'Calluna vulgaris', 'autre'], ['Chêne pédonculé', 'Quercus robur', 'arbre'],
  ['Hêtre', 'Fagus sylvatica', 'arbre'], ['Bouleau', 'Betula pendula', 'arbre'],
  ['Érable sycomore', 'Acer pseudoplatanus', 'arbre'], ['Saule pleureur', 'Salix babylonica', 'arbre'],
  ['Peuplier noir', 'Populus nigra', 'arbre'], ['Olivier', 'Olea europaea', 'arbre'],
  ['Pin parasol', 'Pinus pinea', 'arbre'], ['Sapin blanc', 'Abies alba', 'arbre'],
  ['Cyprès', 'Cupressus sempervirens', 'arbre'], ['Palmier dattier', 'Phoenix dactylifera', 'arbre'],
  ['Baobab', 'Adansonia digitata', 'arbre'], ['Séquoia géant', 'Sequoiadendron giganteum', 'arbre'],
  ['Bambou', 'Bambusa vulgaris', 'autre'], ['Cactus saguaro', 'Carnegiea gigantea', 'autre'],
  ['Aloe vera', 'Aloe vera', 'autre'], ['Figuier', 'Ficus carica', 'arbre'],
  ['Vigne', 'Vitis vinifera', 'autre'], ['Lierre', 'Hedera helix', 'autre'],
  ['Gui', 'Viscum album', 'autre'], ['Houx', 'Ilex aquifolium', 'autre'],
].map(([name, sci, cat]) => ({ name, sci, cat }));

const ROCHES = [
  // [nom affiché, titre wiki fr, catégorie]
  ['Granite', 'Granite', 'roche'], ['Basalte', 'Basalte', 'roche'],
  ['Calcaire', 'Calcaire', 'roche'], ['Marbre', 'Marbre', 'roche'],
  ['Ardoise', 'Ardoise', 'roche'], ['Grès', 'Grès (géologie)', 'roche'],
  ['Silex', 'Silex', 'roche'], ['Obsidienne', 'Obsidienne', 'roche'],
  ['Pierre ponce', 'Pierre ponce', 'roche'], ['Craie', 'Craie', 'roche'],
  ['Quartz', 'Quartz (minéral)', 'mineral'], ['Améthyste', 'Améthyste', 'mineral'],
  ['Diamant', 'Diamant', 'mineral'], ['Émeraude', 'Émeraude', 'mineral'],
  ['Rubis', 'Rubis', 'mineral'], ['Saphir', 'Saphir', 'mineral'],
  ['Topaze', 'Topaze', 'mineral'], ['Opale', 'Opale', 'mineral'],
  ['Turquoise', 'Turquoise (pierre)', 'mineral'], ['Jade', 'Jade', 'mineral'],
  ['Lapis-lazuli', 'Lapis-lazuli', 'mineral'], ['Malachite', 'Malachite', 'mineral'],
  ['Pyrite', 'Pyrite', 'mineral'], ['Galène', 'Galène', 'mineral'],
  ['Soufre', 'Soufre', 'mineral'], ['Gypse', 'Gypse', 'mineral'],
  ['Halite (sel gemme)', 'Halite', 'mineral'], ['Ambre', 'Ambre', 'mineral'],
].map(([name, wiki, cat]) => ({ name, wiki, cat }));

// Logos par DOMAINE (Clearbit Logo API, sans clé ; repli favicon Google 256px)
// — Wikimedia refusait nos requêtes en rafale (429/400 persistants).
const MARQUES = [
  ['Nike', 'nike.com', 'sport'], ['Adidas', 'adidas.com', 'sport'], ['Puma', 'puma.com', 'sport'],
  ['Decathlon', 'decathlon.com', 'sport'], ['Lacoste', 'lacoste.com', 'mode'],
  ['Apple', 'apple.com', 'tech'], ['Samsung', 'samsung.com', 'tech'], ['Sony', 'sony.com', 'tech'],
  ['Nintendo', 'nintendo.com', 'tech'], ['PlayStation', 'playstation.com', 'tech'],
  ['Xbox', 'xbox.com', 'tech'], ['Microsoft', 'microsoft.com', 'tech'],
  ['Google', 'google.com', 'tech'], ['YouTube', 'youtube.com', 'tech'],
  ['Netflix', 'netflix.com', 'media'], ['Spotify', 'spotify.com', 'tech'],
  ['Instagram', 'instagram.com', 'tech'], ['TikTok', 'tiktok.com', 'tech'], ['Snapchat', 'snapchat.com', 'tech'],
  ['McDonald\'s', 'mcdonalds.com', 'food'], ['Burger King', 'burgerking.com', 'food'],
  ['KFC', 'kfc.com', 'food'], ['Coca-Cola', 'coca-cola.com', 'food'], ['Pepsi', 'pepsi.com', 'food'],
  ['Fanta', 'fanta.com', 'food'], ['Red Bull', 'redbull.com', 'food'], ['Nutella', 'nutella.com', 'food'],
  ['Kinder', 'kinder.com', 'food'], ['Haribo', 'haribo.com', 'food'],
  ['Danone', 'danone.com', 'food'], ['Evian', 'evian.com', 'food'], ['Michelin', 'michelin.com', 'auto'],
  ['Lego', 'lego.com', 'jouet'], ['Playmobil', 'playmobil.com', 'jouet'],
  ['Ferrari', 'ferrari.com', 'auto'], ['Porsche', 'porsche.com', 'auto'],
  ['Peugeot', 'peugeot.com', 'auto'], ['Renault', 'renault.com', 'auto'],
  ['Citroën', 'citroen.com', 'auto'], ['Toyota', 'toyota.com', 'auto'],
  ['Tesla', 'tesla.com', 'auto'], ['BMW', 'bmw.com', 'auto'], ['Mercedes-Benz', 'mercedes-benz.com', 'auto'],
  ['Air France', 'airfrance.com', 'transport'], ['SNCF', 'sncf.com', 'transport'],
  ['Carrefour', 'carrefour.com', 'distribution'], ['Ikea', 'ikea.com', 'distribution'],
  ['H&M', 'hm.com', 'mode'], ['Louis Vuitton', 'louisvuitton.com', 'mode'],
  ['Chanel', 'chanel.com', 'mode'], ['Rolex', 'rolex.com', 'mode'],
  ['Canal+', 'canalplus.com', 'media'], ['TF1', 'tf1.fr', 'media'], ['M6', 'm6.fr', 'media'],
].map(([name, domain, cat]) => ({
  name, cat,
  img: `https://logo.clearbit.com/${domain}?size=400`,
  imgAlt: `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
}));

// Photos de célébrités via TMDB /search/person (Wikimedia nous refuse) —
// le champ wiki est conservé à titre documentaire mais n'est plus utilisé.
const CELEBRITES = [
  ['Omar Sy', 'Omar Sy', 'acteur'], ['Jean Dujardin', 'Jean Dujardin', 'acteur'],
  ['Marion Cotillard', 'Marion Cotillard', 'acteur'], ['Louis de Funès', 'Louis de Funès', 'acteur'],
  ['Leonardo DiCaprio', 'Leonardo DiCaprio', 'acteur'], ['Will Smith', 'Will Smith', 'acteur'],
  ['Emma Watson', 'Emma Watson', 'acteur'], ['Tom Cruise', 'Tom Cruise', 'acteur'],
  ['Scarlett Johansson', 'Scarlett Johansson', 'acteur'], ['Brad Pitt', 'Brad Pitt', 'acteur'],
  ['Johnny Depp', 'Johnny Depp', 'acteur'], ['Dwayne Johnson', 'Dwayne Johnson', 'acteur'],
  ['Keanu Reeves', 'Keanu Reeves', 'acteur'],
  ['Céline Dion', 'Céline Dion', 'musique'], ['Stromae', 'Stromae', 'musique'],
  ['Angèle', 'Angèle (chanteuse)', 'musique'], ['Aya Nakamura', 'Aya Nakamura', 'musique'],
  ['Mylène Farmer', 'Mylène Farmer', 'musique'], ['Johnny Hallyday', 'Johnny Hallyday', 'musique'],
  ['Beyoncé', 'Beyoncé', 'musique'], ['Rihanna', 'Rihanna', 'musique'],
  ['Taylor Swift', 'Taylor Swift', 'musique'], ['Michael Jackson', 'Michael Jackson', 'musique'],
  ['Elvis Presley', 'Elvis Presley', 'musique'], ['Ed Sheeran', 'Ed Sheeran', 'musique'],
  ['Adele', 'Adele', 'musique'], ['Soprano', 'Soprano (rappeur)', 'musique'],
  ['Kylian Mbappé', 'Kylian Mbappé', 'sport'], ['Zinédine Zidane', 'Zinédine Zidane', 'sport'],
  ['Antoine Griezmann', 'Antoine Griezmann', 'sport'], ['Tony Parker', 'Tony Parker', 'sport'],
  ['Teddy Riner', 'Teddy Riner', 'sport'], ['Lionel Messi', 'Lionel Messi', 'sport'],
  ['Cristiano Ronaldo', 'Cristiano Ronaldo', 'sport'], ['Usain Bolt', 'Usain Bolt', 'sport'],
  ['Serena Williams', 'Serena Williams', 'sport'], ['Roger Federer', 'Roger Federer', 'sport'],
  ['Squeezie', 'Squeezie', 'tele'], ['Inoxtag', 'Inoxtag', 'tele'],
  ['Léna Situations', 'Léna Situations', 'tele'], ['Arthur', 'Arthur (animateur)', 'tele'],
  ['Nagui', 'Nagui', 'tele'], ['Jean-Luc Reichmann', 'Jean-Luc Reichmann', 'tele'],
  ['Denis Brogniart', 'Denis Brogniart', 'tele'], ['Thomas Pesquet', 'Thomas Pesquet', 'science'],
  ['Elon Musk', 'Elon Musk', 'tech'],
].map(([name, wiki, cat]) => ({ name, wiki, cat }));

const PERSOS_BD = [
  ['Tintin', 'Tintin', 'bd'], ['Astérix', 'Astérix (personnage)', 'bd'],
  ['Obélix', 'Obélix', 'bd'], ['Lucky Luke', 'Lucky Luke', 'bd'],
  ['Gaston Lagaffe', 'Gaston Lagaffe', 'bd'], ['Spirou', 'Spirou', 'bd'],
  ['Titeuf', 'Titeuf', 'bd'], ['Corto Maltese', 'Corto Maltese', 'bd'],
  ['Marsupilami', 'Marsupilami', 'bd'], ['Les Schtroumpfs', 'Les Schtroumpfs', 'bd'],
  ['Batman', 'Batman', 'comics'], ['Superman', 'Superman', 'comics'],
  ['Spider-Man', 'Spider-Man', 'comics'], ['Wonder Woman', 'Wonder Woman', 'comics'],
  ['Hulk', 'Hulk (comics)', 'comics'], ['Iron Man', 'Iron Man', 'comics'],
  ['Captain America', 'Captain America', 'comics'], ['Wolverine', 'Wolverine (comics)', 'comics'],
  ['Deadpool', 'Deadpool', 'comics'], ['Le Joker', 'Joker (comics)', 'comics'],
  ['Mickey Mouse', 'Mickey Mouse', 'cartoon'], ['Donald Duck', 'Donald Duck', 'cartoon'],
  ['Garfield', 'Garfield (personnage)', 'cartoon'],
].map(([name, wiki, cat]) => ({ name, wiki, cat }));

// Persos manga/anime ICONIQUES (reconnaissables par un large public). Sourcés
// AniList par ID (fiable, pas de faux positif de recherche) ; on garde nos
// noms d'affichage FR/communs (AniList renvoie du romaji en ordre inversé).
// cat 'manga' → distracteurs entre persos manga uniquement.
const PERSOS_MANGA = [
  ['Son Goku', 246], ['Naruto', 17], ['Sasuke', 13], ['Luffy', 40],
  ['Zoro', 62], ['Nami', 723], ['Kakashi', 85], ['Vegeta', 913],
  ['Sailor Moon', 2030], ['Totoro', 269], ['Astro Boy', 11686], ['Doraemon', 4304],
  ['Pikachu', 3891], ['Ichigo', 5], ['Edward Elric', 11], ['Light Yagami', 80],
  ['L', 71], ['Levi', 45627], ['Mikasa', 40881], ['Eren', 40882],
  ['Tanjiro', 126071], ['Nezuko', 127518], ['Saitama', 73935], ['Gon', 30],
  ['Killua', 27], ['Rukia', 6], ['Gojo Satoru', 127691], ['Anya Forger', 138100],
  ['Kaneki', 87275], ['Yugi', 1374], ['Chihiro', 384], ['Spike Spiegel', 1],
  ['Guts', 422], ['Inuyasha', 1353], ['Sakura', 2671], ['Nobita', 4303],
  ['Kenshiro', 2511],
].map(([name, id]) => ({ name, id, cat: 'manga' }));

// Dédoublonne par id (sécurité si un id se répète).
const _seenId = new Set();
const PERSOS_MANGA_UNIQ = PERSOS_MANGA.filter((p) => {
  if (_seenId.has(p.id)) return false;
  _seenId.add(p.id); return true;
});

// Récupère les images AniList par LOT (id_in, jusqu'à 50/requête, 1 seule requête
// pour toute la liste). Rate limit AniList = 90 req/min → on reste très en deçà.
async function anilistImagesBatch(items) {
  const byId = new Map();
  const query = `query($ids:[Int]){Page(perPage:50){characters(id_in:$ids){id image{large medium}}}}`;
  for (let i = 0; i < items.length; i += 50) {
    const ids = items.slice(i, i + 50).map((x) => x.id);
    try {
      const r = await fetchT('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables: { ids } }),
      });
      if (!r.ok) { console.warn(`  ✗ AniList batch : HTTP ${r.status}`); continue; }
      const j = await r.json();
      for (const c of j.data?.Page?.characters || []) {
        byId.set(c.id, c.image?.large || c.image?.medium || null);
      }
    } catch (e) { console.warn(`  ✗ AniList batch : ${e.name}`); }
    await sleep(1500); // large marge sous les 90 req/min
  }
  return items.map((x) => {
    const img = byId.get(x.id) || null;
    if (!img) console.warn(`  ✗ pas d'image AniList : ${x.name}`);
    return { ...x, img };
  });
}

// ── Builders par pool ────────────────────────────────────────────────────────

async function poolJv() {
  const key = cineEnvKey('VITE_RAWG_API_KEY');
  if (!key) { console.warn('✗ RAWG : clé absente, pool jaquettes sauté.'); return; }
  const items = [];
  const seen = new Set();
  for (let page = 1; page <= 5; page++) {
    const r = await fetchT(`https://api.rawg.io/api/games?key=${key}&page_size=40&ordering=-added&page=${page}`);
    if (!r.ok) { console.warn(`✗ RAWG HTTP ${r.status}`); break; }
    for (const g of (await r.json()).results || []) {
      if (!g.name || !g.background_image || seen.has(g.name)) continue;
      seen.add(g.name);
      items.push({ name: g.name, cat: g.genres?.[0]?.name || 'jeu', img: g.background_image });
    }
    await sleep(250);
  }
  console.log(`→ RAWG : ${items.length} jeux.`);
  await seedPool({
    subject: 'jeux_video_affiches', qFr: 'Quel est ce jeu vidéo ?', qEn: 'What video game is this?', items,
  });
}

async function poolTmdb(subject, qFr, qEn, params) {
  const key = cineEnvKey('VITE_TMDB_API_KEY');
  if (!key) { console.warn(`✗ TMDB : clé absente, pool ${subject} sauté.`); return; }
  const items = [];
  const seen = new Set();
  for (let page = 1; page <= 4; page++) {
    const url = new URL('https://api.themoviedb.org/3/discover/movie');
    url.searchParams.set('api_key', key);
    url.searchParams.set('language', 'fr-FR');
    url.searchParams.set('sort_by', 'vote_count.desc');
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('page', String(page));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const r = await fetchT(url);
    if (!r.ok) { console.warn(`✗ TMDB HTTP ${r.status}`); break; }
    for (const m of (await r.json()).results || []) {
      if (!m.title || !m.poster_path || seen.has(m.title)) continue;
      seen.add(m.title);
      const decade = Math.floor((Number((m.release_date || '').slice(0, 4)) || 0) / 10) * 10;
      items.push({ name: m.title, cat: String(decade), img: `https://image.tmdb.org/t/p/w342${m.poster_path}` });
    }
    await sleep(150);
  }
  console.log(`→ TMDB ${subject} : ${items.length} films.`);
  await seedPool({ subject, tag: 'Affiche', qFr, qEn, items });
}

// Photo TMDB d'une personne (search/person → profile_path w342).
async function tmdbPersonPhoto(key, name) {
  try {
    const url = new URL('https://api.themoviedb.org/3/search/person');
    url.searchParams.set('api_key', key);
    url.searchParams.set('query', name);
    const r = await fetchT(url);
    if (!r.ok) { console.warn(`  ✗ TMDB person ${name} : HTTP ${r.status}`); return null; }
    const p = (await r.json()).results?.[0];
    return p?.profile_path ? `https://image.tmdb.org/t/p/w342${p.profile_path}` : null;
  } catch { return null; }
}

async function poolPersos() {
  // Persos BD/comics (Wikipédia par lot) + manga/anime iconiques (AniList par ID).
  // Jikan (MyAnimeList) est tombé en 504 au seed initial → AniList GraphQL le
  // remplace (sans clé, images CDN fiables, distracteurs entre persos manga).
  const bd = await wikiImagesBatch(PERSOS_BD);
  const manga = (await anilistImagesBatch(PERSOS_MANGA_UNIQ)).filter((x) => x.img);
  console.log(`→ AniList : ${manga.length} persos manga.`);
  await seedPool({
    subject: 'bd_persos', qFr: 'Quel est ce personnage ?', qEn: 'Who is this character?',
    items: [...bd, ...manga],
  });
}

const POOLS = {
  jv: poolJv,
  animaux: async () => seedPool({
    subject: 'animaux_photos', qFr: 'Quel est cet animal ?', qEn: 'What animal is this?',
    items: await resolveImages(ANIMAUX, (i) => inatPhoto(i.sci)),
  }),
  plantes: async () => seedPool({
    subject: 'plantes_photos', qFr: 'Quelle est cette plante ?', qEn: 'What plant is this?',
    items: await resolveImages(PLANTES, (i) => inatPhoto(i.sci)),
  }),
  geologie: async () => seedPool({
    subject: 'geologie_photos', qFr: 'Quelle est cette roche ou ce minéral ?', qEn: 'What rock or mineral is this?',
    items: await wikiImagesBatch(ROCHES),
  }),
  logos: async () => seedPool({
    subject: 'logos_images', qFr: 'Quelle est cette marque ?', qEn: 'What brand is this?',
    items: MARQUES, // img/imgAlt déjà résolus (Clearbit / favicon Google)
  }),
  celebrites: async () => {
    const key = cineEnvKey('VITE_TMDB_API_KEY');
    if (!key) { console.warn('✗ TMDB : clé absente, pool célébrités sauté.'); return; }
    await seedPool({
      subject: 'celebrites_photos', qFr: 'Qui est-ce ?', qEn: 'Who is this?',
      items: await resolveImages(CELEBRITES, (i) => tmdbPersonPhoto(key, i.name), 150),
    });
  },
  persos: poolPersos,
  horreur: () => poolTmdb('horreur_affiches', 'Quel est ce film d\'horreur ?', 'What horror movie is this?', { with_genres: '27' }),
  superheros: () => poolTmdb('superheros_affiches', 'Quel est ce film de super-héros ?', 'What superhero movie is this?', { with_keywords: '9715' }),
};

const asked = process.argv.slice(2).filter((p) => POOLS[p]);
const toRun = asked.length ? asked : Object.keys(POOLS);
for (const p of toRun) {
  console.log(`\n══ POOL ${p} ══`);
  await POOLS[p]();
}
console.log('\nTerminé.');
