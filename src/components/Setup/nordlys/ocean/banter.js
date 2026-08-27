/**
 * Nordlys — les petites conversations du bord.
 *
 * Amandine et Clément commentent la traversée : on percute un iceberg, la cale
 * se remplit, la voile faseye… À chaque fois, l'un lance une réplique et
 * l'autre répond 1,1 s plus tard, dans une bulle incrustée dans la 3D
 * (sprite canvas au-dessus de la tête, toujours face caméra).
 *
 * Le locuteur dépend du RÔLE tenu au moment de l'événement (`from`) :
 *   · 'helm' = à la barre · 'sail' = au poste de voile
 *   · 'deck' = libre sur le pont · 'any' = n'importe qui
 * Une ligne dont le rôle n'est tenu par personne est simplement écartée du
 * tirage — d'où plusieurs variantes par événement.
 *
 * Accords et prénoms sont posés à l'exécution, séparément pour chaque réplique
 * (le locuteur de `b` est l'interlocuteur de `a`) :
 *   {autre} prénom de l'interlocuteur · {cher} chéri/chérie (interlocuteur)
 *   {e} {le} accords du locuteur       · {e2} accord de l'interlocuteur
 */
import * as THREE from 'three';

export const CREW_NAMES = { amandine: 'Amandine', clement: 'Clément' };
const FEMININE = { amandine: true, clement: false };
const BUBBLE_COLOR = { amandine: '#5EE0A0', clement: '#9fd8ff' };

// ---------------------------------------------------------------------------
// Le catalogue. Au moins deux échanges par événement ET par rôle jouable.
// ---------------------------------------------------------------------------
export const BANTER = {
  // on vient de percuter un iceberg
  iceberg: [
    { from: 'helm', a: "…Ça, c'était pas un glaçon.", b: 'Tu conduis comme sur le périphérique !' },
    { from: 'helm', a: 'Pardon pardon pardon !', b: 'On avait dit : les icebergs, on les CONTOURNE.' },
    { from: 'deck', a: '{autre} ! LE GROS BLANC ! LE GROS BLANC !', b: "Je l'ai vu. Je l'ai même très bien senti." },
    { from: 'deck', a: "J'ai renversé mon hydromel.", b: 'Il y a un trou dans la coque et tu penses à ton verre.' },
    { from: 'sail', a: "J'ai lâché l'écoute, j'ai tout lâché !", b: "Moi j'ai lâché un mot que ta mère n'aimerait pas." },
    { from: 'any', a: 'Tout le monde va bien ?', b: 'Le bateau, lui, va beaucoup moins bien.' },
  ],

  // une avarie 🔧 traîne sur le pont sans que personne ne la répare
  repair: [
    { from: 'deck', a: 'Ça fuit ! Ça fuit là !', b: 'Le 🔧 orange, {autre} — colle-toi dessus et maintiens !' },
    { from: 'deck', a: '{cher}, la coque fait des bulles.', b: "Une coque, normalement, ça ne fait pas de bulles." },
    { from: 'helm', a: "{autre}, l'avarie ne va pas se réparer toute seule.", b: "J'y vais ! Tiens le cap, surtout." },
    { from: 'helm', a: 'Je tiens la barre, je ne peux pas me dédoubler !', b: 'Et moi je répare. Beau partage des tâches.' },
    { from: 'sail', a: 'Je borde la voile, je ne peux pas tout faire !', b: 'Lâche ta voile deux secondes, on prend l’eau.' },
    { from: 'any', a: 'On répare, ou on nage ?', b: 'On répare. L’eau est à quatre degrés.' },
  ],

  // la cale se remplit et personne n'écope
  bail: [
    { from: 'deck', a: "J'ai de l'eau jusqu'aux chevilles.", b: 'Alors écope, {autre} ! Maintiens la touche !' },
    { from: 'deck', a: 'On avait dit croisière, pas piscine.', b: 'La piscine était en option. Tu as coché.' },
    { from: 'helm', a: "Le drakkar est lourd… il y a de l'eau dedans !", b: "J'écope, j'écope ! Mes chaussures sont fichues." },
    { from: 'helm', a: 'On avance comme un caillou, {autre} !', b: 'Un caillou plein d’eau, oui.' },
    { from: 'sail', a: 'Ça traîne derrière, non ?', b: "C'est la cale pleine d'eau, {autre} !" },
    { from: 'any', a: 'Qui écope ?', b: 'Toujours la même personne, tiens.' },
  ],

  // bonne porte franchie
  answerOk: [
    { from: 'helm', a: 'Et voilà ! Bonne porte, bon cap.', b: "Je n'ai jamais douté. Enfin, presque." },
    { from: 'helm', a: 'Les runes s’allument, {cher} !', b: 'C’est surtout nous qui brillons.' },
    { from: 'deck', a: 'Bien joué, {autre} !', b: 'On fait une bonne équipe, quand même.' },
    { from: 'deck', a: 'Tu as vu ? Je le savais, celui-là.', b: 'Tu as surtout eu de la chance, {cher}.' },
    { from: 'sail', a: 'Bien manœuvré ! La voile est avec toi.', b: 'Encore quelques-unes comme ça et on est arrivés.' },
    { from: 'any', a: 'Une rune de plus !', b: 'À ce rythme, on y sera avant la nuit.' },
  ],

  // mauvaise porte : un paquet de mer embarque
  answerKo: [
    { from: 'helm', a: '…C’était l’autre porte.', b: 'Tu crois ?! On embarque, {autre} !' },
    { from: 'helm', a: "J'étais sûr{e} de moi, pourtant.", b: 'Tu étais sûr{e2} pour le camping en Norvège aussi.' },
    { from: 'deck', a: 'Mauvaise réponse, mauvais bain.', b: 'Ne bouge pas. La prochaine, c’est moi qui réponds.' },
    { from: 'deck', a: 'J’aurais dit pareil, remarque.', b: 'Ça me rassure beaucoup, merci.' },
    { from: 'sail', a: 'On a pris la mauvaise, c’est ça ?', b: 'Regarde l’eau qui monte : tu as ta réponse.' },
    { from: 'any', a: 'Bon. On note celle-là.', b: 'On note surtout de ne pas recommencer.' },
  ],

  // la personne au poste de voile a raté la séquence W X C V
  sailMiss: [
    { from: 'sail', a: 'Zut, la voile faseye !', b: 'C’était W. W comme… voilà, non.' },
    { from: 'sail', a: 'Mes doigts ! Mes doigts sont en bois.', b: 'Comme le bateau, {cher}.' },
    { from: 'sail', a: 'Je suis nul{le} en rythme.', b: 'Tu dansais déjà à contretemps à notre mariage.' },
    { from: 'sail', a: 'Ce n’était pas la bonne touche ?', b: 'Le vent te répond : non.' },
    { from: 'sail', a: 'Le vent est passé où ?', b: 'Il est parti avec ta séquence, {cher}.' },
  ],
};

// --- accords et prénoms -----------------------------------------------------
// La majuscule est reposée après coup : une réplique peut commencer par un
// placeholder (« {cher}, la coque fait des bulles. »).
const format = (text, speaker, listener) => {
  const out = text
    .replace(/\{autre\}/g, CREW_NAMES[listener])
    .replace(/\{cher\}/g, FEMININE[listener] ? 'chérie' : 'chéri')
    .replace(/\{e2\}/g, FEMININE[listener] ? 'e' : '')
    .replace(/\{le\}/g, FEMININE[speaker] ? 'le' : '')
    .replace(/\{e\}/g, FEMININE[speaker] ? 'e' : '');
  return out.charAt(0).toUpperCase() + out.slice(1);
};

/**
 * Choisit un échange jouable pour l'événement, en fonction des rôles tenus.
 * @param {string} evt          clé de BANTER
 * @param {object} roles        { helm, sail, ids: ['a','b'], whoOf: (id) => 'amandine'|'clement' }
 * @param {object} memory       { [evt]: index } — la dernière ligne jouée, pour ne pas la répéter
 * @returns {?{speaker, listener, a, b}} ids d'équipage + textes formatés
 */
export function pickBanter(evt, roles, memory = {}) {
  const lines = BANTER[evt];
  if (!lines) return null;
  const { helm, sail, ids } = roles;
  const free = ids.filter((id) => id !== helm && id !== sail);
  const speakerFor = (from) => {
    if (from === 'helm') return helm;
    if (from === 'sail') return sail;
    if (from === 'deck') return free[Math.floor(Math.random() * free.length)] ?? null;
    return ids[Math.floor(Math.random() * ids.length)];
  };
  const usable = lines
    .map((line, i) => ({ line, i, speaker: speakerFor(line.from) }))
    .filter((x) => x.speaker);
  if (!usable.length) return null;
  // jamais deux fois de suite la même réplique pour un même événement
  const fresh = usable.filter((x) => x.i !== memory[evt]);
  const pick = (fresh.length ? fresh : usable)[Math.floor(Math.random() * (fresh.length || usable.length))];
  memory[evt] = pick.i;
  const listener = ids.find((id) => id !== pick.speaker);
  const who = roles.whoOf;
  return {
    speaker: pick.speaker,
    listener,
    a: format(pick.line.a, who(pick.speaker), who(listener)),
    b: pick.line.b ? format(pick.line.b, who(listener), who(pick.speaker)) : null,
  };
}

// --- la bulle : sprite canvas, phylactère façon parchemin nordique -----------
const BUBBLE_W = 640, BUBBLE_H = 232;   // canvas
// Taille sur le pont (m). Large exprès : la caméra de chasse est à ~46 m, et le
// drakkar ne fait que 4 m au maître-bau — une bulle « à l'échelle » serait
// illisible. Repère : les panneaux des portes de réponse font 19 m.
const WORLD_W = 11.5, WORLD_H = 4.16;
export const BUBBLE_LIFT = 5;           // décalage vertical de la réponse

const wrapLines = (g, text, maxW) => {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxW && line) { out.push(line); line = word; }
    else line = next;
  }
  if (line) out.push(line);
  return out;
};

function bubbleTexture(text, who) {
  const c = document.createElement('canvas');
  c.width = BUBBLE_W; c.height = BUBBLE_H;
  const g = c.getContext('2d');
  const color = BUBBLE_COLOR[who] || '#9fd8ff';
  const boxH = 176;

  // corps du phylactère + pointe vers la tête du personnage
  g.fillStyle = 'rgba(8,14,28,0.90)';
  g.strokeStyle = color;
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect(8, 8, BUBBLE_W - 16, boxH, 26);
  g.fill(); g.stroke();
  g.beginPath();
  g.moveTo(BUBBLE_W / 2 - 26, boxH + 6);
  g.lineTo(BUBBLE_W / 2, boxH + 52);
  g.lineTo(BUBBLE_W / 2 + 26, boxH + 6);
  g.closePath();
  g.fillStyle = 'rgba(8,14,28,0.90)';
  g.fill();
  // on repasse le contour de la pointe sans refermer sur le bord du cadre
  g.beginPath();
  g.moveTo(BUBBLE_W / 2 - 26, boxH + 5);
  g.lineTo(BUBBLE_W / 2, boxH + 52);
  g.lineTo(BUBBLE_W / 2 + 26, boxH + 5);
  g.stroke();

  // qui parle
  g.fillStyle = color;
  g.font = "30px 'VT323', monospace";
  g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillText(CREW_NAMES[who].toUpperCase(), 30, 18);

  // la réplique, ajustée pour tenir en 3 lignes maxi
  g.fillStyle = '#eafff4';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 40, lines = [];
  for (; size >= 24; size -= 3) {
    g.font = `bold ${size}px 'Archivo Black', system-ui, sans-serif`;
    lines = wrapLines(g, text, BUBBLE_W - 76);
    if (lines.length <= 3) break;
  }
  const lh = size * 1.22;
  const top = 56 + (boxH - 56 - lines.length * lh) / 2 + lh / 2;
  lines.forEach((l, i) => g.fillText(l, BUBBLE_W / 2, top + i * lh));

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Bulle prête à être ajoutée au pont. `depthTest:false` : elle doit rester
 * lisible même derrière la voile ou le mât.
 * @returns {{sprite: THREE.Sprite, life: number, dur: number, delay: number, speaker: string}}
 */
export function createBubble(text, who, { delay = 0, dur = 3.2 } = {}) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: bubbleTexture(text, who), transparent: true, depthTest: false, opacity: 0,
  }));
  sprite.scale.set(WORLD_W, WORLD_H, 1);
  sprite.renderOrder = 30;
  sprite.center.set(0.5, 0); // la pointe touche le point d'ancrage
  return { sprite, life: 0, dur, delay, text };
}

/**
 * Fait vivre une bulle : surgissement élastique, flottement, effacement.
 * @returns {boolean} false quand elle a fini (à retirer de la scène)
 */
export function stepBubble(b, dt) {
  b.life += dt;
  const t = b.life - b.delay;
  // encore en attente de son tour — mais une réplique annulée avant d'éclore
  // (nouvel échange par-dessus) ne doit pas rester en file
  if (t < 0) { b.sprite.material.opacity = 0; b.sprite.visible = false; return b.life < b.dur; }
  b.sprite.visible = true;
  const inK = Math.min(1, t / 0.22);
  const pop = inK < 1 ? 1 + Math.sin(inK * Math.PI) * 0.18 : 1;  // petit rebond
  const out = Math.max(0, Math.min(1, (b.dur - t) / 0.4));
  b.sprite.material.opacity = Math.min(inK, out);
  b.sprite.scale.set(WORLD_W * inK * pop, WORLD_H * inK * pop, 1);
  return t < b.dur;
}
