import { SUBJECT_KEYS } from '../data/subjects.js';

const SX = 80;      // espacement horizontal entre cases
const Y_C = 310;     // y central du parcours
const Y_GAP = 170;   // ecart entre voies paralleles

function shuffleArray(arr) {
  const p = arr.slice();
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

function randomSubject() {
  return SUBJECT_KEYS[Math.floor(Math.random() * SUBJECT_KEYS.length)];
}

/**
 * Genere le plateau sous forme de graphe de noeuds.
 *
 * @param {object} params
 * @param {number} params.casesParVoie - nombre de cases par voie parallele (3-6)
 * @param {number} params.nbVoies - 2 ou 3 voies paralleles
 * @param {number} params.nbSections - nombre de sections (2-4)
 * @param {string} params.voieFinale - 'court-long' | 'unique' | 'aucune'
 * @param {number} params.couloirsMix - nombre de cases echauffement/inter-section (0-3)
 * @param {number} params.eventsPerCouloir - nombre de cases evenement par couloir (0-2)
 * @returns {{ nodes: object, viewBox: { w: number, h: number } }}
 */
export function generateBoard(params) {
  const {
    casesParVoie = 4,
    nbVoies = 3,
    nbSections = 3,
    voieFinale = 'court-long',
    couloirsMix = 2,
    eventsPerCouloir = 0,
  } = params;

  const nodes = {};
  let x = 50;
  let prevId = 'depart';

  nodes.depart = { x, y: Y_C, type: 'depart', label: 'D\u00c9PART', next: [] };
  x += SX + 10;

  // --- Couloir d'echauffement (mix) ---
  for (let i = 0; i < couloirsMix; i++) {
    const id = `mixWarm_${i}`;
    nodes[id] = { x, y: Y_C, type: 'subject', subject: randomSubject(), next: [] };
    nodes[prevId].next.push(id);
    prevId = id;
    x += SX;
  }

  // Pool de matieres melange aleatoirement
  let availablePool = shuffleArray(SUBJECT_KEYS);

  for (let s = 0; s < nbSections; s++) {
    // Jonction d'entree
    const jin = `jin_${s}`;
    nodes[jin] = { x, y: Y_C, type: 'jonction', label: '?', next: [] };
    nodes[prevId].next.push(jin);
    x += SX + 10;

    // Choix des matieres et positions y
    if (availablePool.length < nbVoies) {
      availablePool = availablePool.concat(shuffleArray(SUBJECT_KEYS));
    }
    const subjs = availablePool.slice(0, nbVoies);
    availablePool = availablePool.slice(nbVoies);
    const ys = nbVoies === 2
      ? [Y_C - 90, Y_C + 90]
      : [Y_C - Y_GAP, Y_C, Y_C + Y_GAP];

    const lastInVoies = [];
    for (let v = 0; v < nbVoies; v++) {
      const subj = subjs[v];
      const y = ys[v];
      let voieX = x;
      let prevInVoie = null;
      for (let c = 0; c < casesParVoie; c++) {
        const id = `s${s}_${subj}_${c}`;
        nodes[id] = { x: voieX, y, type: 'subject', subject: subj, next: [] };
        if (prevInVoie === null) {
          nodes[jin].next.push(id);
        } else {
          nodes[prevInVoie].next.push(id);
        }
        prevInVoie = id;
        voieX += SX;
      }
      lastInVoies.push(prevInVoie);
    }
    x += casesParVoie * SX + 10;

    // Jonction de sortie (convergence)
    const jout = `jout_${s}`;
    nodes[jout] = { x, y: Y_C, type: 'jonction', label: '?', next: [] };
    lastInVoies.forEach((id) => nodes[id].next.push(jout));
    prevId = jout;
    x += SX + 10;

    // Couloir mix entre sections (sauf apres la derniere)
    if (s < nbSections - 1) {
      for (let i = 0; i < couloirsMix; i++) {
        const id = `mixInter_${s}_${i}`;
        nodes[id] = { x, y: Y_C, type: 'subject', subject: randomSubject(), next: [] };
        nodes[prevId].next.push(id);
        prevId = id;
        x += SX;
      }
    }
  }

  // --- Voie finale ---
  if (voieFinale === 'court-long') {
    const jf = 'jfinal';
    nodes[jf] = { x, y: Y_C, type: 'jonction', label: '?', next: [] };
    nodes[prevId].next.push(jf);
    x += SX + 10;

    const courtIds = [];
    let cx = x;
    for (let i = 0; i < 3; i++) {
      const id = `court_${i}`;
      nodes[id] = { x: cx, y: Y_C - 110, type: 'subject', subject: randomSubject(), next: [] };
      courtIds.push(id);
      cx += SX;
    }
    const longIds = [];
    let lx = x;
    for (let i = 0; i < 5; i++) {
      const id = `long_${i}`;
      nodes[id] = { x: lx, y: Y_C + 110, type: 'subject', subject: randomSubject(), next: [] };
      longIds.push(id);
      lx += SX;
    }
    for (let i = 0; i < courtIds.length - 1; i++) nodes[courtIds[i]].next = [courtIds[i + 1]];
    for (let i = 0; i < longIds.length - 1; i++) nodes[longIds[i]].next = [longIds[i + 1]];
    nodes[jf].next = [courtIds[0], longIds[0]];

    x = Math.max(cx, lx) + 10;
    nodes.arrivee = { x, y: Y_C, type: 'arrivee', label: 'ARRIV\u00c9E', next: [] };
    nodes[courtIds[courtIds.length - 1]].next = ['arrivee'];
    nodes[longIds[longIds.length - 1]].next = ['arrivee'];

  } else if (voieFinale === 'unique') {
    for (let i = 0; i < 3; i++) {
      const id = `final_${i}`;
      nodes[id] = { x, y: Y_C, type: 'subject', subject: randomSubject(), next: [] };
      nodes[prevId].next.push(id);
      prevId = id;
      x += SX;
    }
    nodes.arrivee = { x, y: Y_C, type: 'arrivee', label: 'ARRIV\u00c9E', next: [] };
    nodes[prevId].next.push('arrivee');

  } else {
    // 'aucune'
    nodes.arrivee = { x, y: Y_C, type: 'arrivee', label: 'ARRIV\u00c9E', next: [] };
    nodes[prevId].next.push('arrivee');
  }

  // --- Distribution aleatoire des evenements sur les cases subject ---
  const totalCorridors = 1 + Math.max(0, nbSections - 1); // warm + inter-sections
  const totalEvents = eventsPerCouloir * totalCorridors;
  if (totalEvents > 0) {
    const subjectIds = Object.keys(nodes).filter(
      (id) => nodes[id].type === 'subject'
    );
    const picked = shuffleArray(subjectIds).slice(0, totalEvents);
    picked.forEach((id) => {
      nodes[id].type = 'event';
    });
  }

  const viewBox = { w: nodes.arrivee.x + 60, h: 620 };
  return { nodes, viewBox };
}

export { SX, Y_C, Y_GAP };
