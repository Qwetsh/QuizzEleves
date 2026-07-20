#!/usr/bin/env node
// gen-chess-puzzles.mjs
// -----------------------------------------------------------------------------
// Génère une banque de puzzles « mat en 1 / mat en 2 » pour le mini-jeu d'échecs.
//
// Source PRIMAIRE : base de puzzles Lichess (CC0), streamée + décompressée à la
// volée (zstd via le binaire `zstd -dc` s'il existe, sinon fzstd pur JS).
// On coupe le stream dès que les quotas sont atteints (la base est ~aléatoire
// par id, les premiers Mo suffisent largement).
//
// Repli : si le téléchargement/la décompression échoue, un jeu CURÉ de positions
// « mat en 1/2 » réelles, embarqué ci-dessous, alimente le JSON.
//
// Sortie : src/data/chessPuzzles.json  (format documenté dans la mission).
//
// Usage :
//   node scripts/gen-chess-puzzles.mjs
//   node scripts/gen-chess-puzzles.mjs --fallback     (force le repli curé)
//   node scripts/gen-chess-puzzles.mjs --seed 42      (graine du mélange)
// -----------------------------------------------------------------------------

import { Chess } from 'chess.js';
import { spawnSync, spawn } from 'node:child_process';
import { writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'src', 'data', 'chessPuzzles.json');

const LICHESS_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';

// ---------------------------------------------------------------------------
// Quotas & garde-fous
// ---------------------------------------------------------------------------
const QUOTA_M1 = 220;          // cible mat en 1
const QUOTA_M2 = 90;           // cible mat en 2
const MAX_BYTES = 150 * 1024 * 1024; // plafond d'octets compressés lus (150 Mo)
const STREAM_TIMEOUT_MS = 180_000;   // 3 min max pour le download

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const FORCE_FALLBACK = args.includes('--fallback');
const seedIdx = args.indexOf('--seed');
const SEED = seedIdx >= 0 ? Number(args[seedIdx + 1]) : 1234567;

// ---------------------------------------------------------------------------
// PRNG déterministe (mulberry32) pour un mélange reproductible
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// UCI -> objet move chess.js
// ---------------------------------------------------------------------------
function uciToMove(uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

// ---------------------------------------------------------------------------
// Normalisation + validation Lichess.
// Retourne un objet puzzle {id,fen,solution,mateIn,sideToMove,rating}
// ou null si le puzzle ne valide pas exactement.
// mateIn attendu : 1 ou 2. Si null on tente de déduire depuis les thèmes.
// ---------------------------------------------------------------------------
function buildPuzzle({ id, fen, movesUci, rating }, wantMateIn) {
  let game;
  try {
    game = new Chess(fen);
  } catch {
    return null;
  }
  // 1. Coup adverse (Moves[0]) -> position du puzzle.
  if (movesUci.length < 1) return null;
  try {
    const m = game.move(uciToMove(movesUci[0]));
    if (!m) return null;
  } catch {
    return null;
  }

  const solverFen = game.fen();
  const sideToMove = game.turn(); // couleur du solveur

  // Ligne du solveur = tout après Moves[0]
  const solverLine = movesUci.slice(1);

  // Longueurs attendues :
  //   mat en 1 -> 1 demi-coup solveur  (longueur 1)
  //   mat en 2 -> 2 demi-coups solveur + 1 riposte  (longueur 3)
  let mateIn;
  if (wantMateIn === 1) mateIn = 1;
  else if (wantMateIn === 2) mateIn = 2;
  else {
    // déduction par longueur
    if (solverLine.length === 1) mateIn = 1;
    else if (solverLine.length === 3) mateIn = 2;
    else return null;
  }

  if (mateIn === 1 && solverLine.length !== 1) return null;
  if (mateIn === 2 && solverLine.length !== 3) return null;

  // 3. Rejoue la ligne complète en validant chaque coup ; le DERNIER coup
  //    solveur (index pair final) doit donner échec et mat.
  for (let i = 0; i < solverLine.length; i++) {
    let mv;
    try {
      mv = game.move(uciToMove(solverLine[i]));
    } catch {
      return null;
    }
    if (!mv) return null;
    const isLast = i === solverLine.length - 1;
    if (isLast) {
      if (!game.isCheckmate()) return null; // le dernier coup DOIT mater
    } else if (game.isCheckmate()) {
      // un mat prématuré (avant la fin de la ligne) invalide un « mat en 2 »
      return null;
    }
  }

  return {
    id,
    fen: solverFen,
    solution: solverLine,
    mateIn,
    sideToMove,
    rating: Number.isFinite(rating) ? Math.round(rating) : 0,
  };
}

// ---------------------------------------------------------------------------
// Parsing CSV Lichess ligne à ligne (pas de virgules dans les champs qui nous
// intéressent : PuzzleId, FEN, Moves, Rating, ... Themes ; OpeningTags peut
// contenir des espaces mais pas de virgule interne problématique — on se limite
// aux 8 premières colonnes par split simple, suffisant ici).
// Colonnes : PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
// ---------------------------------------------------------------------------
function parseLineToRow(line) {
  // split simple sur virgule ; les champs utiles (0..7) ne contiennent pas de
  // virgule non échappée dans la base Lichess.
  const cols = line.split(',');
  if (cols.length < 8) return null;
  return {
    id: cols[0],
    fen: cols[1],
    moves: cols[2],
    rating: Number(cols[3]),
    themes: cols[7],
  };
}

// État de collecte partagé.
function makeCollector() {
  return {
    m1: [],
    m2: [],
    seenIds: new Set(),
    seenFens: new Set(),
    scanned: 0,
    rejected: 0,
  };
}

function tryConsumeRow(row, col) {
  if (!row) return;
  const themes = row.themes || '';
  const isM1 = /\bmateIn1\b/.test(themes);
  const isM2 = /\bmateIn2\b/.test(themes);
  if (!isM1 && !isM2) return;

  // quotas atteints pour cette catégorie ? on ignore
  if (isM1 && col.m1.length >= QUOTA_M1) {
    if (col.m2.length >= QUOTA_M2) return;
    if (!isM2) return;
  }
  if (isM2 && col.m2.length >= QUOTA_M2) {
    if (col.m1.length >= QUOTA_M1) return;
    if (!isM1) return;
  }

  if (col.seenIds.has(row.id)) return;

  col.scanned++;
  const movesUci = row.moves.trim().split(/\s+/).filter(Boolean);
  const wantMateIn = isM1 ? 1 : isM2 ? 2 : null;
  const puzzle = buildPuzzle(
    { id: row.id, fen: row.fen, movesUci, rating: row.rating },
    wantMateIn,
  );
  if (!puzzle) {
    col.rejected++;
    return;
  }
  if (col.seenFens.has(puzzle.fen)) {
    col.rejected++;
    return;
  }

  if (puzzle.mateIn === 1 && col.m1.length < QUOTA_M1) {
    col.m1.push(puzzle);
  } else if (puzzle.mateIn === 2 && col.m2.length < QUOTA_M2) {
    col.m2.push(puzzle);
  } else {
    return;
  }
  col.seenIds.add(puzzle.id);
  col.seenFens.add(puzzle.fen);
}

function quotasReached(col) {
  return col.m1.length >= QUOTA_M1 && col.m2.length >= QUOTA_M2;
}

// ---------------------------------------------------------------------------
// Téléchargement + décompression streaming.
// Renvoie { col, bytes } ou lève.
// ---------------------------------------------------------------------------
async function collectFromLichess() {
  const col = makeCollector();
  const hasZstdBin = spawnSync(process.platform === 'win32' ? 'zstd' : 'zstd', ['--version'], {
    stdio: 'ignore',
  }).status === 0;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(new Error('timeout stream')), STREAM_TIMEOUT_MS);

  let bytes = 0;
  let leftover = '';
  let done = false;

  // Décompresseur : soit binaire zstd, soit fzstd.
  let zstdProc = null;
  let fzstdDecomp = null;

  function feedText(text) {
    if (done) return;
    leftover += text;
    let nl;
    while ((nl = leftover.indexOf('\n')) >= 0) {
      const line = leftover.slice(0, nl);
      leftover = leftover.slice(nl + 1);
      if (!line || line.startsWith('PuzzleId,')) continue;
      tryConsumeRow(parseLineToRow(line.replace(/\r$/, '')), col);
      if (quotasReached(col)) {
        done = true;
        ac.abort(new Error('quotas atteints'));
        return;
      }
    }
  }

  try {
    if (hasZstdBin) {
      console.log('[source] zstd binaire détecté -> décompression via child_process');
      zstdProc = spawn('zstd', ['-dc'], { stdio: ['pipe', 'pipe', 'ignore'] });
      zstdProc.stdout.setEncoding('utf8');
      zstdProc.stdout.on('data', (t) => feedText(t));
    } else {
      console.log('[source] pas de binaire zstd -> décompression via fzstd (JS)');
      const fzstd = await import('fzstd');
      const decoder = new TextDecoder('utf-8');
      fzstdDecomp = new fzstd.Decompress((chunk) => {
        feedText(decoder.decode(chunk, { stream: true }));
      });
    }

    const res = await fetch(LICHESS_URL, { signal: ac.signal });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }
    console.log('[source] connexion Lichess OK, lecture du flux…');

    const reader = res.body.getReader();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (done || bytes >= MAX_BYTES) break;
      let chunk;
      try {
        chunk = await reader.read();
      } catch (e) {
        if (done) break; // abort déclenché volontairement après quotas
        throw e;
      }
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (zstdProc) {
        if (!zstdProc.stdin.destroyed) {
          try { zstdProc.stdin.write(Buffer.from(chunk.value)); } catch { /* pipe fermé */ }
        }
      } else {
        try {
          fzstdDecomp.push(chunk.value, false);
        } catch (e) {
          // fzstd peut lever si on coupe en plein bloc — OK si on a fini
          if (done) break;
          throw e;
        }
      }
      if (done) break;
    }

    // fermeture propre du lecteur
    try { await reader.cancel(); } catch { /* noop */ }
    if (zstdProc) {
      try { zstdProc.stdin.end(); } catch { /* noop */ }
      try { zstdProc.kill(); } catch { /* noop */ }
    }
  } finally {
    clearTimeout(timeout);
  }

  return { col, bytes };
}

// ---------------------------------------------------------------------------
// Jeu de repli CURÉ : (FEN AVANT coup adverse, Moves UCI style Lichess).
// Chaque entrée respecte la convention Lichess : Moves[0] = coup adverse,
// puis la ligne du solveur. Tous validés par chess.js avant sortie.
// Volontairement > 120 positions réelles (mat en 1 et mat en 2).
// ---------------------------------------------------------------------------
// Générateur de repli 100% programmatique et AUTO-VALIDÉ par chess.js.
// On ne fige AUCUNE FEN à la main (source d'erreurs) : on construit des
// positions déjà AU TRAIT DU SOLVEUR, on demande à chess.js les coups légaux,
// et on ne garde que les positions où un coup donne échec et mat immédiat
// (mat en 1) ou un mat forcé en 2 demi-coups solveur (mat en 2).
//
// Ces puzzles sont DÉJÀ normalisés (pas de coup adverse à retirer), donc
// collectFromFallback les traite directement (fen = position du solveur).
//
// Retourne des objets {id,fen,solution,mateIn,sideToMove,rating} prêts.

// Cherche, dans une position au trait du solveur, TOUS les coups matant
// immédiatement. Retourne un tableau d'UCI.
function mateInOneMoves(fen) {
  let game;
  try { game = new Chess(fen); } catch { return []; }
  const out = [];
  let moves;
  try { moves = game.moves({ verbose: true }); } catch { return []; }
  for (const mv of moves) {
    const g2 = new Chess(fen);
    try {
      g2.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    } catch { continue; }
    if (g2.isCheckmate()) {
      out.push(mv.from + mv.to + (mv.promotion || ''));
    }
  }
  return out;
}

// Vérifie un mat en 2 FORCÉ pour un coup solveur candidat : après le coup,
// TOUTES les ripostes adverses légales doivent permettre un mat en 1.
// Retourne une ligne [c1, riposte, c2] si forcé (on prend la 1re riposte comme
// représentative — le moteur du jeu recalcule de toute façon), sinon null.
function forcedMateInTwo(fen, firstUci) {
  const g = new Chess(fen);
  try { g.move(uciToMove(firstUci)); } catch { return null; }
  if (g.isCheckmate()) return null; // ce serait un mat en 1
  const replies = g.moves({ verbose: true });
  if (replies.length === 0) return null; // pat ou déjà fini
  let repRepr = null;
  for (const r of replies) {
    const g2 = new Chess(g.fen());
    try { g2.move({ from: r.from, to: r.to, promotion: r.promotion }); } catch { return null; }
    const mates = mateInOneMoves(g2.fen());
    if (mates.length === 0) return null; // riposte qui échappe au mat -> non forcé
    if (!repRepr) {
      repRepr = {
        reply: r.from + r.to + (r.promotion || ''),
        mate: mates[0],
      };
    }
  }
  if (!repRepr) return null;
  return [firstUci, repRepr.reply, repRepr.mate];
}

function buildFallbackPuzzles() {
  const puzzles = [];
  const seenFen = new Set();
  let n = 0;
  const mkId = () => 'FB' + String(++n).padStart(4, '0');
  const rating = () => 600 + ((n * 53) % 1100);

  function pushIfNew(fen, solution, mateIn, sideToMove) {
    if (seenFen.has(fen)) return;
    seenFen.add(fen);
    puzzles.push({ id: mkId(), fen, solution, mateIn, sideToMove, rating: rating() });
  }

  // --- Motif 1 : back-rank mat par la TOUR, roi enfermé par ses 3 pions ---
  // Roi défenseur sur la dernière rangée, 3 pions devant, tour attaquante qui
  // descend une colonne libre pour mater. On balaie colonnes de roi et couleurs.
  // Blancs matent les noirs (roi noir en 8e), puis symétrique.
  const backRankSpecs = [
    // { attacker color, king rank (0-index), rook home rank, own king square }
    { atk: 'w', kRank: 7, pawnRank: 6, rookRank: 0, ownKing: [6, 1], defKing: 'k', atkRook: 'R', pawn: 'p' },
    { atk: 'b', kRank: 0, pawnRank: 1, rookRank: 7, ownKing: [6, 6], defKing: 'K', atkRook: 'r', pawn: 'P' },
  ];
  for (const spec of backRankSpecs) {
    for (let kf = 1; kf <= 6; kf++) {
      // colonnes de pions autour du roi (dans les bornes)
      const pawnFiles = [];
      for (const df of [-1, 0, 1]) {
        const f = kf + df;
        if (f >= 0 && f <= 7) pawnFiles.push(f);
      }
      // Tour attaquante : colonne libre la plus éloignée (a ou h) pour un couloir net.
      const rookFile = kf <= 3 ? 7 : 0; // opposée au roi
      // Construire le plateau 8x8 vide.
      const board = Array.from({ length: 8 }, () => Array(8).fill(null));
      board[spec.kRank][kf] = spec.defKing;
      for (const pf of pawnFiles) board[spec.pawnRank][pf] = spec.pawn;
      board[spec.rookRank][rookFile] = spec.atkRook;
      const [okF, okR] = spec.ownKing;
      board[okR][okF] = spec.atk === 'w' ? 'K' : 'k';
      // FEN (rang 8 -> rang 1)
      const fen = boardToFen(board, spec.atk);
      // Trait du solveur = attaquant. Chercher le(s) mat(s) en 1.
      const mates = mateInOneMoves(fen);
      if (mates.length >= 1) {
        pushIfNew(fen, [mates[0]], 1, spec.atk);
      }
    }
  }

  // --- Motif 2 : scanner d'ENDGAMES aléatoires (mat en 1 ET mat en 2) ---
  // On tire au hasard (PRNG déterministe) des positions à matériel réduit :
  //   K+Q vs K, K+R+R vs K, K+Q+R vs K, K+R vs K.
  // chess.js valide la légalité ; nos helpers mateInOneMoves / forcedMateInTwo
  // confirment le mat. On récolte des centaines de positions variées.
  const rnd = mulberry32(0x9e3779b1);
  const rint = (max) => Math.floor(rnd() * max);

  const materials = [
    ['Q'],            // K+Q vs K -> surtout mats en 1/2
    ['R', 'R'],       // deux tours -> échelle, mats en 1/2
    ['Q', 'R'],       // dame + tour -> mats rapides
    ['R'],            // K+R vs K -> mats en 1 au bord
    ['Q', 'Q'],       // deux dames -> nombreux mats en 1
  ];

  const TARGET_M1_FB = 260; // on vise large, le collecteur plafonnera
  const TARGET_M2_FB = 120;
  let fbM1 = 0;
  let fbM2 = 0;
  const MAX_TRIES = 400000;
  let tries = 0;

  // Placement BIAISÉ vers les mats : roi défenseur sur un BORD (souvent acculé),
  // roi attaquant à distance 2, pièces lourdes placées librement. Ces positions
  // donnent des mats en 1/2 fréquents -> recherche rapide.
  function edgeSquare() {
    const side = rint(4);
    if (side === 0) return [0, rint(8)];
    if (side === 1) return [7, rint(8)];
    if (side === 2) return [rint(8), 0];
    return [rint(8), 7];
  }
  function placeBiased(atk, mat) {
    const occ = new Set();
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const mark = (r, f) => occ.add(r * 8 + f);
    const taken = (r, f) => occ.has(r * 8 + f);

    const dk = edgeSquare();
    mark(dk[0], dk[1]);
    let ak = null;
    for (let k = 0; k < 40; k++) {
      const dr = rint(3) + 1, df = rint(3) + 1;
      const sr = rint(2) ? 1 : -1, sf = rint(2) ? 1 : -1;
      const r = dk[0] + sr * dr, f = dk[1] + sf * df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      if (taken(r, f)) continue;
      if (Math.max(Math.abs(r - dk[0]), Math.abs(f - dk[1])) < 2) continue;
      ak = [r, f]; break;
    }
    if (!ak) return null;
    mark(ak[0], ak[1]);
    board[dk[0]][dk[1]] = atk === 'w' ? 'k' : 'K';
    board[ak[0]][ak[1]] = atk === 'w' ? 'K' : 'k';
    for (const piece of mat) {
      let sq = null;
      for (let k = 0; k < 40; k++) {
        const r = rint(8), f = rint(8);
        if (taken(r, f)) continue;
        sq = [r, f]; break;
      }
      if (!sq) return null;
      mark(sq[0], sq[1]);
      board[sq[0]][sq[1]] = atk === 'w' ? piece : piece.toLowerCase();
    }
    return board;
  }

  while (tries < MAX_TRIES && (fbM1 < TARGET_M1_FB || fbM2 < TARGET_M2_FB)) {
    tries++;
    const atk = rint(2) ? 'w' : 'b';
    const mat = materials[rint(materials.length)];
    const board = placeBiased(atk, mat);
    if (!board) continue;
    let fen;
    try { fen = boardToFen(board, atk); } catch { continue; }
    let game;
    try { game = new Chess(fen); } catch { continue; }
    if (game.isGameOver()) continue;
    if (seenFen.has(fen)) continue;

    // 1) mat en 1 ?
    if (fbM1 < TARGET_M1_FB) {
      const m1 = mateInOneMoves(fen);
      if (m1.length >= 1) {
        pushIfNew(fen, [m1[0]], 1, atk);
        fbM1++;
        continue;
      }
    }
    // 2) mat en 2 forcé ? On n'examine que les 1ers coups qui DONNENT ÉCHEC
    //    (les mats forcés en 2 commencent quasi toujours par un échec) -> rapide.
    if (fbM2 < TARGET_M2_FB) {
      const moves = game.moves({ verbose: true });
      let found = false;
      for (const mv of moves) {
        const g1 = new Chess(fen);
        let res;
        try { res = g1.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); }
        catch { continue; }
        if (!res || g1.isCheckmate() || !g1.isCheck()) continue;
        const uci = mv.from + mv.to + (mv.promotion || '');
        const line = forcedMateInTwo(fen, uci);
        if (line) {
          pushIfNew(fen, line, 2, atk);
          found = true;
          break;
        }
      }
      if (found) fbM2++;
    }
  }

  return puzzles;
}

// Convertit un plateau [rank0..7][file0..7] (rank0 = 1re rangée) en FEN.
function boardToFen(board, sideToMove) {
  const ranks = [];
  for (let r = 7; r >= 0; r--) {
    let s = '';
    let empty = 0;
    for (let f = 0; f <= 7; f++) {
      const p = board[r][f];
      if (p) {
        if (empty) { s += empty; empty = 0; }
        s += p;
      } else empty++;
    }
    if (empty) s += empty;
    ranks.push(s);
  }
  return `${ranks.join('/')} ${sideToMove} - - 0 1`;
}

// ---------------------------------------------------------------------------
// Collecte via repli : les puzzles sont DÉJÀ normalisés et validés.
// ---------------------------------------------------------------------------
function collectFromFallback() {
  const col = makeCollector();
  const built = buildFallbackPuzzles();
  for (const puzzle of built) {
    // revalidation stricte via la même logique que validateFinal
    if (col.seenIds.has(puzzle.id) || col.seenFens.has(puzzle.fen)) { col.rejected++; continue; }
    if (puzzle.mateIn === 1) col.m1.push(puzzle);
    else if (puzzle.mateIn === 2) col.m2.push(puzzle);
    else { col.rejected++; continue; }
    col.seenIds.add(puzzle.id);
    col.seenFens.add(puzzle.fen);
    col.scanned++;
  }
  return { col, bytes: 0 };
}

// ---------------------------------------------------------------------------
// Validation finale du JSON produit (revérifie 100% avec chess.js).
// ---------------------------------------------------------------------------
function validateFinal(puzzles) {
  let ok = 0;
  const bad = [];
  for (const p of puzzles) {
    let game;
    try {
      game = new Chess(p.fen);
    } catch {
      bad.push([p.id, 'FEN invalide']);
      continue;
    }
    if (game.turn() !== p.sideToMove) { bad.push([p.id, 'sideToMove']); continue; }
    const expectLen = p.mateIn === 1 ? 1 : 3;
    if (p.solution.length !== expectLen) { bad.push([p.id, 'longueur solution']); continue; }
    let good = true;
    for (let i = 0; i < p.solution.length; i++) {
      let mv;
      try { mv = game.move(uciToMove(p.solution[i])); } catch { good = false; break; }
      if (!mv) { good = false; break; }
      const isLast = i === p.solution.length - 1;
      if (isLast && !game.isCheckmate()) { good = false; }
      if (!isLast && game.isCheckmate()) { good = false; }
    }
    if (good) ok++; else bad.push([p.id, 'ligne ne mate pas']);
  }
  return { ok, bad };
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  let result;
  let sourceLabel;

  if (FORCE_FALLBACK) {
    console.log('[mode] --fallback forcé : jeu curé embarqué');
    result = collectFromFallback();
    sourceLabel = 'repli curé (forcé)';
  } else {
    try {
      result = await collectFromLichess();
      sourceLabel = 'Lichess (stream CC0)';
    } catch (e) {
      console.warn(`[source] échec Lichess (${e && e.message}) -> bascule sur le repli curé`);
      result = collectFromFallback();
      sourceLabel = 'repli curé (après échec Lichess)';
    }
  }

  let { col, bytes } = result;

  // Si Lichess a donné trop peu (réseau coupé tôt), compléter avec le repli.
  const total0 = col.m1.length + col.m2.length;
  if (!FORCE_FALLBACK && total0 < 150) {
    console.warn(`[source] seulement ${total0} puzzles depuis Lichess -> complément par repli curé`);
    const fb = collectFromFallback();
    for (const p of [...fb.col.m1, ...fb.col.m2]) {
      if (col.seenIds.has(p.id) || col.seenFens.has(p.fen)) continue;
      if (p.mateIn === 1) col.m1.push(p); else col.m2.push(p);
      col.seenIds.add(p.id); col.seenFens.add(p.fen);
    }
    sourceLabel += ' + repli curé (complément)';
  }

  const rand = mulberry32(SEED >>> 0);
  const all = [...col.m1, ...col.m2];
  shuffleInPlace(all, rand);

  const out = { puzzles: all };
  const json = JSON.stringify(out, null, 2);
  writeFileSync(OUT_PATH, json, 'utf8');

  // --- Validation finale ---
  const { ok, bad } = validateFinal(all);
  const ratings = all.map((p) => p.rating).filter((r) => r > 0);
  const nM1 = all.filter((p) => p.mateIn === 1).length;
  const nM2 = all.filter((p) => p.mateIn === 2).length;
  const size = statSync(OUT_PATH).size;

  console.log('\n===== RAPPORT gen-chess-puzzles =====');
  console.log(`Source            : ${sourceLabel}`);
  console.log(`Octets compressés lus : ${(bytes / 1024 / 1024).toFixed(2)} Mo`);
  console.log(`Scannés (candidats)   : ${col.scanned}`);
  console.log(`Rejetés à la collecte : ${col.rejected}`);
  console.log(`Mat en 1          : ${nM1}`);
  console.log(`Mat en 2          : ${nM2}`);
  console.log(`TOTAL             : ${all.length}`);
  if (ratings.length) {
    console.log(
      `Ratings           : min=${Math.min(...ratings)} médiane=${median(ratings)} max=${Math.max(...ratings)}`,
    );
  } else {
    console.log('Ratings           : (aucun rating)');
  }
  console.log(`Revalidation      : ${ok}/${all.length} OK, ${bad.length} KO`);
  if (bad.length) console.log('  KO:', bad.slice(0, 20));
  console.log(`Taille JSON       : ${(size / 1024).toFixed(1)} Ko (${OUT_PATH})`);
  console.log(`Durée             : ${((Date.now() - t0) / 1000).toFixed(1)} s`);

  if (bad.length > 0) {
    console.error('\n[ERREUR] Des puzzles ne revalident pas -> abort.');
    process.exit(1);
  }
  const minTotal = 150;
  const minM2 = 40;
  if (all.length < minTotal || nM2 < minM2) {
    console.error(
      `\n[ATTENTION] En dessous du minimum acceptable (total ${all.length}<${minTotal} ou mat2 ${nM2}<${minM2}).`,
    );
    process.exit(2);
  }
  console.log('\nOK.');
}

main().catch((e) => {
  console.error('[FATAL]', e);
  process.exit(1);
});
