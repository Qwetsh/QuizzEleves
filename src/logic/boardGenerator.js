import { SUBJECT_KEYS } from '../data/subjects.js';

const SX = 130;      // espacement horizontal entre cases
const Y_C = 480;     // y central du parcours
const Y_GAP = 260;   // ecart entre voies paralleles

function shuffleArray(arr) {
  const p = arr.slice();
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
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
 * @param {number} params.eventEveryX - un evenement toutes les X cases (0 = aucun)
 * @returns {{ nodes: object, viewBox: { w: number, h: number } }}
 */
export function generateBoard(params) {
  const {
    casesParVoie = 4,
    nbVoies = 3,
    nbSections = 3,
    voieFinale = 'court-long',
    couloirsMix = 2,
    eventEveryX = 3,
    // Matières à répartir sur les voies (défaut = toutes). Permet de restreindre
    // le plateau à une sélection (cf. selectedSubjects au Setup).
    subjects = SUBJECT_KEYS,
  } = params;
  const subjectPool = (Array.isArray(subjects) && subjects.length) ? subjects : SUBJECT_KEYS;

  const nodes = {};
  let x = 80;
  let prevId = 'depart';

  nodes.depart = { x, y: Y_C, type: 'depart', label: 'D\u00c9PART', next: [] };
  x += SX + 10;

  // --- Couloir d'echauffement (mix) ---
  for (let i = 0; i < couloirsMix; i++) {
    const id = `mixWarm_${i}`;
    nodes[id] = { x, y: Y_C, type: 'subject', subject: 'multi', next: [] };
    nodes[prevId].next.push(id);
    prevId = id;
    x += SX;
  }

  // Pool de matieres melange aleatoirement (restreint à la sélection)
  let availablePool = shuffleArray(subjectPool);

  for (let s = 0; s < nbSections; s++) {
    // Jonction d'entree
    const jin = `jin_${s}`;
    nodes[jin] = { x, y: Y_C, type: 'jonction', label: '?', next: [] };
    nodes[prevId].next.push(jin);
    x += SX + 10;

    // Choix des matieres et positions y
    // `while` (et non `if`) : si la sélection est plus petite que le nb de voies,
    // on recharge autant que nécessaire (sinon des voies resteraient sans matière).
    while (availablePool.length < nbVoies) {
      availablePool = availablePool.concat(shuffleArray(subjectPool));
    }
    const subjs = availablePool.slice(0, nbVoies);
    availablePool = availablePool.slice(nbVoies);
    const ys = nbVoies === 2
      ? [Y_C - 140, Y_C + 140]
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
        nodes[id] = { x, y: Y_C, type: 'subject', subject: 'multi', next: [] };
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
      nodes[id] = { x: cx, y: Y_C - 170, type: 'subject', subject: 'multi', next: [] };
      courtIds.push(id);
      cx += SX;
    }
    const longIds = [];
    let lx = x;
    for (let i = 0; i < 5; i++) {
      const id = `long_${i}`;
      nodes[id] = { x: lx, y: Y_C + 170, type: 'subject', subject: 'multi', next: [] };
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
      nodes[id] = { x, y: Y_C, type: 'subject', subject: 'multi', next: [] };
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

  // --- Distribution reguliere des evenements : un evenement toutes les X cases ---
  // On reconstruit chaque voie/couloir comme une chaine lineaire de cases subject,
  // puis on marque une case sur X. Cela garantit une repartition uniforme le long
  // du parcours (pas de longue section sans evenement), contrairement a un tirage
  // aleatoire global qui laissait des trous.
  if (eventEveryX >= 1) {
    const isSubj = (id) => nodes[id] && nodes[id].type === 'subject';
    const preds = {};
    for (const [id, n] of Object.entries(nodes)) {
      for (const nx of n.next) {
        if (!preds[nx]) preds[nx] = [];
        preds[nx].push(id);
      }
    }

    // Une chaine commence a une case subject dont aucun predecesseur n'est subject.
    const chains = [];
    for (const id of Object.keys(nodes)) {
      if (!isSubj(id)) continue;
      if ((preds[id] || []).some(isSubj)) continue;
      const chain = [];
      let cur = id;
      while (cur && isSubj(cur)) {
        chain.push(cur);
        const nextSubj = nodes[cur].next.filter(isSubj);
        cur = nextSubj.length === 1 ? nextSubj[0] : null;
      }
      chains.push(chain);
    }

    // Place un evenement toutes les X cases dans chaque chaine. Le decalage de
    // depart (ci % eventEveryX) evite que les evenements s'alignent tous sur la
    // meme colonne entre voies paralleles.
    chains.forEach((chain, ci) => {
      let step = ci % eventEveryX;
      for (const id of chain) {
        step++;
        if (step >= eventEveryX) {
          nodes[id].type = 'event';
          step = 0;
        }
      }
    });
  }

  const viewBox = { w: nodes.arrivee.x + 100, h: 960 };
  return { nodes, viewBox };
}

export { SX, Y_C, Y_GAP };
