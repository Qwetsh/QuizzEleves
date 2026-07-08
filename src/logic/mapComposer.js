// Composition du plateau « espace » (maps v2) : continents flottants + îlots.
//
// Produit la MÊME structure { nodes, viewBox } que generateBoard (boardGenerator.js)
// — ids, types et champs identiques, donc tout l'aval (pathfinding, pièges, duels,
// events, caméra, pions) est indifférent au mode — plus une couche `space` décrivant
// le rendu : continents posés, socles/îlots par case, et le fond (étoiles, nébuleuses,
// constellations) généré en DONNÉES ici pour être persisté avec la partie (le rendu
// est ainsi stable au resume, comme boardDecor pour le décor procédural).
//
// Topologie : 1 CONTINENT = 1 VOIE, disposition « en quinconce » (croquis
// utilisateur du 2026-07-06) : une section = 2 continents décalés en diagonale
// — le continent PROCHE d'un côté de l'épine (haut ou bas, tiré au sort), le
// continent LOINTAIN plus loin en x, de l'autre côté. Chaque voie traverse SON
// continent et contourne l'autre par une traînée d'îlots (la voie du continent
// lointain contourne d'abord le proche, celle du proche contourne ensuite le
// lointain), puis tout converge sur un îlot-jonction. FIGÉ à 2 voies ; les
// continents sont rendus réduits (CONT_SCALE ; socles/pions en taille absolue).
// Chaque continent porte UNE SEULE route de cases, qui suit sa route peinte
// calibrée (src/data/maps/espace.js — outil DEV ?calibrate). À terme, l'asset
// du continent lui-même indiquera le thème de sa voie (les socles restent nus).
// Les cases hors continent (départ, jonctions, couloirs mix, voie finale,
// arrivée) sont des îlots rocheux flottant dans l'espace.
//
// Backlog (idée validée, non câblée) : voies « approchantes » — sur une voie,
// un continent généraliste suivi un peu plus loin d'un continent au thème
// proche, vs la voie d'en face qui va directement au thème (nécessite une
// notion de proximité entre thèmes).

import { SUBJECT_KEYS } from '../data/subjects.js';
import { THEMES } from '../data/themes.js';
import { distributeEvents } from './boardGenerator.js';
import { CONTINENT, CONTINENTS, SOCLE_KEYS, ILOT_KEYS } from '../data/maps/espace.js';

// Espacement horizontal des îlots couloir (unités viewBox = pixels d'asset)
const ILOT_GAP = 185;
// Marge au-dessus du 1er continent / sous le dernier
const MARGIN = 60;
// Écart horizontal entre le continent proche et le continent lointain
const CONT_XGAP = 110;
// Demi-écart vertical du quinconce : centre d'un continent = épine ± V_OFF_RATIO×h
// (assez pour que la traînée de contournement passe au large des arbres)
const V_OFF_RATIO = 0.33;
// Nombre d'îlots de contournement par voie (avant ou après son continent)
const N_BYPASS = 2;
// Distance îlot-jonction → bout du ponton du premier continent
const JIN_TO_CONT = 150;
// Écart vertical des branches courte/longue de la voie finale
const FINAL_GAP = 200;
// Nombre de voies (continents parallèles) par section — figé en mode espace
const N_VOIES = 2;
// Échelle de rendu des continents (l'asset est calibré à taille pleine ;
// ancres et dimensions sont multipliées ici — socles/pions non affectés)
export const CONT_SCALE = 0.66;

function shuffleArray(arr) {
  const p = arr.slice();
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Sous-ensemble régulier de `n` ancres parmi celles de la route (bornes incluses)
function pickAnchors(anchors, n) {
  const count = Math.max(2, Math.min(n, anchors.length));
  if (count === anchors.length) return anchors;
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(anchors[Math.round((i * (anchors.length - 1)) / (count - 1))]);
  }
  return out;
}

// Léger flottement vertical des îlots de l'espace (organique, persisté)
const wiggle = (amp = 26) => (Math.random() * 2 - 1) * amp;

// Paramètres de LÉVITATION (animation CSS sp-float de BoardSVG) : amplitude,
// durée et déphasage aléatoires — chaque élément bobbe en asynchrone. Générés
// ici (données persistées) pour être stables au resume.
const mkFloat = (ampMin, ampMax) => {
  const dur = +(5 + Math.random() * 4).toFixed(2);
  return {
    amp: +(ampMin + Math.random() * (ampMax - ampMin)).toFixed(1),
    dur,
    delay: +(-Math.random() * dur).toFixed(2),
  };
};

/**
 * Compose le plateau spatial.
 * Mêmes params que generateBoard ; nbVoies est IGNORÉ (figé à N_VOIES = 2 en
 * mode espace — le curseur du Setup ne vaut que pour le plateau procédural).
 *
 * @returns {{ nodes: object, viewBox: {w,h}, space: object }}
 */
export function composeSpaceBoard(params) {
  const {
    casesParVoie = 4,
    nbSections = 3,
    voieFinale = 'court-long',
    couloirsMix = 2,
    eventEveryX = 3,
    subjects = SUBJECT_KEYS,
  } = params;
  const subjectPool = (Array.isArray(subjects) && subjects.length) ? subjects : SUBJECT_KEYS;
  const nVoies = N_VOIES;

  // Continent d'une voie : asset du thème s'il existe (ou alias, cf. espace.js),
  // sinon on REMONTE l'arbre de thèmes — un sous-thème sans île propre joue sur
  // l'île de son parent (Horreur → Cinéma, HP tome 1 → Harry Potter…).
  // Repli final : le continent générique.
  const defFor = (subj) => {
    if (CONTINENTS[subj]) return CONTINENTS[subj];
    let node = THEMES[subj]
      || Object.values(THEMES).find((t) => t.subjectKey === subj);
    for (let guard = 0; node && guard < 8; guard++) {
      const k = node.subjectKey || node.key;
      if (CONTINENTS[k]) return CONTINENTS[k];
      node = node.parentKey ? THEMES[node.parentKey] : null;
    }
    return CONTINENT;
  };
  const S = (v) => Math.round(v * CONT_SCALE);

  // Tirage des thèmes de chaque section AVANT la géométrie : la hauteur du
  // plateau dépend du plus grand continent réellement posé (formats mixtes :
  // 1448×1086, carrés 1254², panneaux larges…).
  let availablePool = shuffleArray(subjectPool);
  const sectionSubjects = [];
  for (let s = 0; s < nbSections; s++) {
    while (availablePool.length < nVoies) {
      availablePool = availablePool.concat(shuffleArray(subjectPool));
    }
    sectionSubjects.push(availablePool.slice(0, nVoies));
    availablePool = availablePool.slice(nVoies);
  }
  const maxContH = Math.max(
    ...sectionSubjects.flat().map((subj) => S(defFor(subj).h)),
  );
  const vOff = Math.round(maxContH * V_OFF_RATIO);

  // Hauteur totale du quinconce → épine centrale du plateau
  const fanH = maxContH + 2 * vOff;
  const SPINE_Y = MARGIN + fanH / 2;

  const nodes = {};
  const layers = []; // continents posés : { img, x, y, w, h, s, v, float }
  const socleFor = {}; // id de case → asset de socle/îlot
  const nodeFloat = {}; // id de case → paramètres de lévitation

  const spaceNode = (id, x, y, props) => {
    nodes[id] = { x, y: y + wiggle(), ...props };
    socleFor[id] = pick(ILOT_KEYS);
    nodeFloat[id] = mkFloat(4, 8); // îlot isolé : bob indépendant
  };

  let x = 130;
  let prevId = 'depart';

  // --- Départ : îlot dans l'espace, sur l'épine centrale ---
  nodes.depart = { x, y: SPINE_Y, type: 'depart', label: 'DÉPART', next: [] };
  socleFor.depart = pick(ILOT_KEYS);
  nodeFloat.depart = mkFloat(4, 8);

  // --- Couloir d'échauffement (mix) sur îlots ---
  for (let i = 0; i < couloirsMix; i++) {
    const id = `mixWarm_${i}`;
    x += ILOT_GAP;
    spaceNode(id, x, SPINE_Y, { type: 'subject', subject: 'multi', next: [] });
    nodes[prevId].next.push(id);
    prevId = id;
  }

  for (let s = 0; s < nbSections; s++) {
    // Jonction d'entrée : îlot dans l'espace, d'où partent les traînées vers
    // le ponton de chaque continent de l'éventail.
    const jin = `jin_${s}`;
    x += ILOT_GAP;
    spaceNode(jin, x, SPINE_Y, { type: 'jonction', label: '?', next: [] });
    nodes[prevId].next.push(jin);

    const subjs = sectionSubjects[s];
    const defNear = defFor(subjs[0]);
    const defFar = defFor(subjs[1]);

    // Quinconce : continent PROCHE d'un côté de l'épine (haut/bas au hasard),
    // continent LOINTAIN plus loin en x de l'autre côté. Toutes les coordonnées
    // calibrées (ancres, in/out) sont mises à l'échelle du continent CONCERNÉ
    // (les assets thématiques ont des formats variés).
    const sideNear = Math.random() < 0.5 ? 1 : -1; // 1 = proche EN BAS
    const contNearX = nodes[jin].x + JIN_TO_CONT - S(defNear.in.x);
    const contFarX = contNearX + S(defNear.w) + CONT_XGAP;
    const contY = (def, side) => Math.round(SPINE_Y - S(def.h) / 2 + side * vOff);
    const joutX = contFarX + S(defFar.out.x) + ILOT_GAP;

    // Traversée d'un continent : bout du ponton → sa route peinte calibrée →
    // porte (jin/jout calibrés = première/dernière case de la route).
    const crossContinent = (v, subj, def, contX, cy, fromId, layerFloat) => {
      const route = [def.jin, ...def.route, def.jout];
      const picked = pickAnchors(route, casesParVoie);
      let prev = fromId;
      picked.forEach((a, c) => {
        const id = `s${s}v${v}_${subj}_${c}`;
        nodes[id] = {
          x: contX + S(a.x),
          y: cy + S(a.y),
          type: 'subject', subject: subj, next: [],
        };
        socleFor[id] = pick(SOCLE_KEYS);
        // même bob que le continent porteur (sinon les socles « glissent »
        // sur la route peinte pendant la lévitation)
        nodeFloat[id] = layerFloat;
        nodes[prev].next.push(id);
        prev = id;
      });
      return prev;
    };
    // Traînée de contournement : N_BYPASS îlots (cases de la voie), chaînés
    // depuis `fromId`, maintenus du côté `side` de l'épine pour passer au
    // large de l'autre continent. Retourne la dernière case créée.
    const bypass = (v, subj, fromId, x0, x1, side) => {
      let prev = fromId;
      for (let i = 0; i < N_BYPASS; i++) {
        const t = (i + 1) / (N_BYPASS + 1);
        const id = `b${s}v${v}_${subj}_${i}`;
        nodes[id] = {
          x: Math.round(x0 + (x1 - x0) * t),
          y: Math.round(SPINE_Y + side * vOff + wiggle(20)),
          type: 'subject', subject: subj, next: [],
        };
        socleFor[id] = pick(ILOT_KEYS);
        nodes[prev].next.push(id);
        prev = id;
      }
      return prev;
    };

    const floatNear = mkFloat(3, 6);
    const floatFar = mkFloat(3, 6);
    layers.push({ img: defNear.img, x: contNearX, y: contY(defNear, sideNear), w: S(defNear.w), h: S(defNear.h), s, v: 0, float: floatNear });
    layers.push({ img: defFar.img, x: contFarX, y: contY(defFar, -sideNear), w: S(defFar.w), h: S(defFar.h), s, v: 1, float: floatFar });

    // Voie 0 (continent proche) : traversée, puis contournement du lointain
    const gateNearX = contNearX + S(defNear.out.x);
    const endNear = crossContinent(0, subjs[0], defNear, contNearX, contY(defNear, sideNear), jin, floatNear);
    const endVoie0 = bypass(0, subjs[0], endNear, gateNearX, joutX, sideNear);

    // Voie 1 (continent lointain) : contournement du proche, puis traversée
    const jettyFarX = contFarX + S(defFar.in.x);
    const fromFar = bypass(1, subjs[1], jin, nodes[jin].x, jettyFarX, -sideNear);
    const endVoie1 = crossContinent(1, subjs[1], defFar, contFarX, contY(defFar, -sideNear), fromFar, floatFar);

    // Jonction de sortie : îlot dans l'espace où convergent les deux voies
    const jout = `jout_${s}`;
    x = joutX;
    spaceNode(jout, x, SPINE_Y, { type: 'jonction', label: '?', next: [] });
    nodes[endVoie0].next.push(jout);
    nodes[endVoie1].next.push(jout);
    prevId = jout;

    // Couloir mix entre sections (sauf après la dernière)
    if (s < nbSections - 1) {
      for (let i = 0; i < couloirsMix; i++) {
        const id = `mixInter_${s}_${i}`;
        x += ILOT_GAP;
        spaceNode(id, x, SPINE_Y, { type: 'subject', subject: 'multi', next: [] });
        nodes[prevId].next.push(id);
        prevId = id;
      }
    }
  }

  // --- Voie finale, sur îlots dans l'espace ---
  if (voieFinale === 'court-long') {
    const jf = 'jfinal';
    x += ILOT_GAP;
    spaceNode(jf, x, SPINE_Y, { type: 'jonction', label: '?', next: [] });
    nodes[prevId].next.push(jf);

    const courtIds = [];
    let cx = x;
    for (let i = 0; i < 3; i++) {
      const id = `court_${i}`;
      cx += ILOT_GAP;
      spaceNode(id, cx, SPINE_Y - FINAL_GAP, { type: 'subject', subject: 'multi', next: [] });
      courtIds.push(id);
    }
    const longIds = [];
    let lx = x;
    for (let i = 0; i < 5; i++) {
      const id = `long_${i}`;
      lx += ILOT_GAP;
      spaceNode(id, lx, SPINE_Y + FINAL_GAP, { type: 'subject', subject: 'multi', next: [] });
      longIds.push(id);
    }
    for (let i = 0; i < courtIds.length - 1; i++) nodes[courtIds[i]].next = [courtIds[i + 1]];
    for (let i = 0; i < longIds.length - 1; i++) nodes[longIds[i]].next = [longIds[i + 1]];
    nodes[jf].next = [courtIds[0], longIds[0]];

    x = Math.max(cx, lx) + ILOT_GAP;
    nodes.arrivee = { x, y: SPINE_Y, type: 'arrivee', label: 'ARRIVÉE', next: [] };
    socleFor.arrivee = pick(ILOT_KEYS);
    nodeFloat.arrivee = mkFloat(4, 8);
    nodes[courtIds[courtIds.length - 1]].next = ['arrivee'];
    nodes[longIds[longIds.length - 1]].next = ['arrivee'];

  } else if (voieFinale === 'unique') {
    for (let i = 0; i < 3; i++) {
      const id = `final_${i}`;
      x += ILOT_GAP;
      spaceNode(id, x, SPINE_Y, { type: 'subject', subject: 'multi', next: [] });
      nodes[prevId].next.push(id);
      prevId = id;
    }
    x += ILOT_GAP;
    nodes.arrivee = { x, y: SPINE_Y, type: 'arrivee', label: 'ARRIVÉE', next: [] };
    socleFor.arrivee = pick(ILOT_KEYS);
    nodeFloat.arrivee = mkFloat(4, 8);
    nodes[prevId].next.push('arrivee');

  } else {
    // 'aucune'
    x += ILOT_GAP;
    nodes.arrivee = { x, y: SPINE_Y, type: 'arrivee', label: 'ARRIVÉE', next: [] };
    socleFor.arrivee = pick(ILOT_KEYS);
    nodeFloat.arrivee = mkFloat(4, 8);
    nodes[prevId].next.push('arrivee');
  }

  distributeEvents(nodes, eventEveryX);

  const viewBox = { w: nodes.arrivee.x + 180, h: fanH + 2 * MARGIN };

  const space = {
    layers,
    socles: socleFor,
    nodeFloat,
    ...generateSpaceBackdrop(viewBox, layers),
  };

  return { nodes, viewBox, space };
}

// ---------------------------------------------------------------------------
// Fond spatial : données générées une fois (persistées), rendues par BoardSVG.

function generateSpaceBackdrop(viewBox, layers) {
  const { w, h } = viewBox;

  // Champ d'étoiles : densité constante, ~8% scintillent
  const stars = [];
  const nStars = Math.round((w * h) / 6500);
  for (let i = 0; i < nStars; i++) {
    stars.push({
      x: Math.round(Math.random() * w),
      y: Math.round(Math.random() * h),
      r: +(0.7 + Math.random() * 1.7).toFixed(1),
      tw: Math.random() < 0.08 ? 1 : 0,
    });
  }

  // Nébuleuses : taches lumineuses molles, teintes violettes/roses/bleues
  const nebulae = [];
  const nNeb = Math.max(3, Math.round((w * h) / 1_500_000));
  const hues = [275, 290, 250, 315, 230];
  for (let i = 0; i < nNeb; i++) {
    nebulae.push({
      x: Math.round(Math.random() * w),
      y: Math.round(h * (0.08 + Math.random() * 0.84)),
      r: Math.round(220 + Math.random() * 340),
      hue: pick(hues),
    });
  }

  // Constellations : une derrière chaque continent (dépasse de ses bords),
  // plus une dans chaque grand vide (avant le premier / après le dernier).
  const constellations = [];
  const zones = [
    { cx: layers.length ? layers[0].x / 2 : w * 0.1, cy: h * 0.35, spread: 300 },
    ...layers.map((l) => ({ cx: l.x + l.w / 2, cy: l.y + l.h / 2, spread: Math.max(l.w, l.h) * 0.62 })),
    { cx: layers.length ? (layers[layers.length - 1].x + layers[layers.length - 1].w + w) / 2 : w * 0.9, cy: h * 0.4, spread: 320 },
  ];
  for (const z of zones) {
    const n = 5 + Math.floor(Math.random() * 4);
    const pts = [];
    let px = z.cx - z.spread * 0.8;
    let py = z.cy + (Math.random() * 2 - 1) * z.spread * 0.5;
    for (let i = 0; i < n; i++) {
      pts.push({ x: Math.round(px), y: Math.round(py) });
      px += (z.spread * 1.6) / (n - 1);
      py += (Math.random() * 2 - 1) * z.spread * 0.45;
      py = Math.max(30, Math.min(h - 30, py));
    }
    const links = [];
    for (let i = 0; i < pts.length - 1; i++) links.push([i, i + 1]);
    // une branche occasionnelle
    if (n >= 6 && Math.random() < 0.7) {
      const from = 1 + Math.floor(Math.random() * (n - 3));
      pts.push({
        x: Math.round(pts[from].x + (Math.random() * 2 - 1) * z.spread * 0.4),
        y: Math.round(Math.max(30, Math.min(h - 30, pts[from].y + (Math.random() * 2 - 1) * z.spread * 0.5))),
      });
      links.push([from, pts.length - 1]);
    }
    constellations.push({ pts, links });
  }

  return { stars, nebulae, constellations };
}
