/**
 * Chantier naval du mini-jeu Nordlys — géométries three.js.
 *
 * Le drakkar procédural (coque, pont plat praticable, boucliers, voile, rames)
 * vient du prototype « Modélisation d'eau pour jeu Drakkar » de Claude Design,
 * repris quasi tel quel. S'y ajoutent, pour le gameplay coop : la barre franche
 * à la poupe, les portes de réponse (texte runique ou drapeaux nordiques) et
 * les obstacles. L'équipage vit dans `characters.js`.
 */
import * as THREE from 'three';

// Drakkar, échelle réelle : 26 m de long, 5.8 m au maître-couple. Le pont est
// plat — `deck` est le groupe où poser tout ce qui vit à bord (viking, fuites).
export const SHIP = { length: 26, beam: 2.9, deckY: 0.7 };

const PALETTE = {
  oak: new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.85 }),
  darkOak: new THREE.MeshStandardMaterial({ color: '#4b331f', roughness: 0.9 }),
  deck: new THREE.MeshStandardMaterial({ color: '#8a6740', roughness: 0.8 }),
  shieldA: new THREE.MeshStandardMaterial({ color: '#8f2f27', roughness: 0.7 }),
  shieldB: new THREE.MeshStandardMaterial({ color: '#d9cdb4', roughness: 0.7 }),
};

function sailTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ded2b8'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#9a352a';
  for (let i = 0; i < 128; i += 32) g.fillRect(i, 0, 16, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// `visual` regroupe tout le cosmétique du drakkar procédural (coque, voile,
// boucliers, rames…) et `planks` le plancher dessiné du pont : les deux sont
// masqués quand le vrai modèle drakkar.glb est chargé, tandis que `deck`
// (repère gameplay : équipage, fuites, barre) reste actif.
export function buildDrakkar() {
  const g = new THREE.Group();
  const visual = new THREE.Group();
  g.add(visual);
  const L = SHIP.length, halfL = L / 2;

  // coque : cylindre effilé → coque viking à deux étraves
  const hullGeo = new THREE.CylinderGeometry(SHIP.beam, SHIP.beam, L, 26, 16, true);
  hullGeo.rotateZ(Math.PI / 2);
  {
    const pos = hullGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const t = Math.min(Math.abs(x) / halfL, 1);
      const taper = Math.pow(Math.max(1 - t * t, 0), 0.42);
      const keel = 1 + Math.pow(t, 3) * 0.9; // rocker : les extrémités se lèvent
      pos.setY(i, y * taper * 0.62 * (y < 0 ? keel : 1) + Math.pow(t, 4) * 2.0);
      pos.setZ(i, z * taper);
    }
    hullGeo.computeVertexNormals();
  }
  const hull = new THREE.Mesh(hullGeo, PALETTE.oak);
  hull.rotation.y = Math.PI / 2; // pointe vers -z
  visual.add(hull);

  // pont plat : plancher continu utilisable comme plateforme
  const deck = new THREE.Group();
  deck.position.y = SHIP.deckY;
  const planks = new THREE.Group();
  deck.add(planks);
  const plankW = 0.62;
  for (let i = -4; i <= 4; i++) {
    const t = Math.abs(i) / 4.6;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(plankW * 0.94, 0.14, L * (0.86 - t * 0.30)),
      i % 2 ? PALETTE.deck : PALETTE.oak,
    );
    plank.position.x = i * plankW;
    planks.add(plank);
  }
  for (let i = -5; i <= 5; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(SHIP.beam * 1.8, 0.16, 0.22), PALETTE.darkOak);
    beam.position.set(0, -0.06, i * 2.1);
    beam.scale.x = Math.pow(Math.max(1 - Math.pow(Math.abs(i) / 5.6, 2), 0.15), 0.45);
    planks.add(beam);
  }
  g.add(deck);

  // étraves + têtes de dragon
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.24, 8, 28, Math.PI * 0.85), PALETTE.darkOak);
    post.position.set(0, 1.9, s * (halfL - 0.8));
    post.rotation.set(0, Math.PI / 2, s > 0 ? Math.PI * 0.15 : -Math.PI * 0.15);
    visual.add(post);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.9, 7), PALETTE.darkOak);
    head.position.set(0, 4.5, s * (halfL - 0.1));
    head.rotation.x = s > 0 ? -0.5 : 0.5;
    visual.add(head);
  }

  // boucliers le long des plat-bords
  const shieldGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.14, 16);
  for (let i = -6; i <= 6; i++) {
    for (const s of [-1, 1]) {
      const sh = new THREE.Mesh(shieldGeo, i % 2 ? PALETTE.shieldA : PALETTE.shieldB);
      sh.rotation.z = Math.PI / 2;
      sh.position.set(s * (SHIP.beam * 0.78), 1.35, i * 1.55);
      visual.add(sh);
    }
  }

  // mât + vergue + voile gonflée
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 17, 12), PALETTE.darkOak);
  mast.position.y = 8.9;
  visual.add(mast);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 15, 8), PALETTE.darkOak);
  yard.rotation.z = Math.PI / 2; yard.position.y = 15.4;
  visual.add(yard);
  const sailGeo = new THREE.PlaneGeometry(14.6, 11, 14, 10);
  {
    const pos = sailGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / 7.3, v = pos.getY(i) / 5.5;
      pos.setZ(i, -Math.cos(u * 1.5) * (1 - v * v * 0.25) * 1.6);
    }
    sailGeo.computeVertexNormals();
  }
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({
    map: sailTexture(), roughness: 0.95, side: THREE.DoubleSide, transparent: true,
  }));
  sail.position.set(0, 9.7, 0.6);
  sail.name = 'sail'; // la caméra plongeante la rend semi-transparente (occlusion du pont)
  visual.add(sail);

  // rames au repos le long des flancs
  const oarGeo = new THREE.BoxGeometry(0.14, 0.14, 8);
  for (let i = -4; i <= 4; i++) {
    for (const s of [-1, 1]) {
      const oar = new THREE.Mesh(oarGeo, PALETTE.darkOak);
      oar.position.set(s * 3.6, 0.8, i * 1.55 + 0.4);
      oar.rotation.set(0.3, s * 1.15, 0);
      visual.add(oar);
    }
  }

  // masque de cale : écrit la profondeur (sans couleur) APRÈS le navire mais
  // AVANT l'océan (renderOrder 1 < océan 2) — la mer ne « perce » jamais dans
  // la coque, et le pont, déjà dessiné, reste intact à l'écran. Le bouclier
  // (masque + jupe) vit dans SON groupe, indépendant du plancher praticable :
  // il doit rester au niveau du plat-bord même quand le plancher descend au
  // fond de la coque (cas du drakkar.glb).
  const bilgeShield = new THREE.Group();
  bilgeShield.position.y = SHIP.deckY - 0.06;
  g.add(bilgeShield);
  const bilgeShape = new THREE.Shape();
  bilgeShape.absellipse(0, 0, 2.35, 9.6, 0, Math.PI * 2);
  const bilgeGeo = new THREE.ShapeGeometry(bilgeShape, 40);
  bilgeGeo.rotateX(-Math.PI / 2);
  const bilgeMask = new THREE.Mesh(bilgeGeo, new THREE.MeshBasicMaterial({ colorWrite: false }));
  bilgeMask.renderOrder = 1;
  bilgeShield.add(bilgeMask);
  // …et sa « jupe » : un anneau incliné qui monte vers le plat-bord — sans
  // lui, les crêtes de houle débordaient encore sur les BORDS du pont
  const skirtShape = new THREE.Shape();
  skirtShape.absellipse(0, 0, 2.7, 9.9, 0, Math.PI * 2);
  const skirtHole = new THREE.Path();
  skirtHole.absellipse(0, 0, 1.95, 9.0, 0, Math.PI * 2);
  skirtShape.holes.push(skirtHole);
  const skirtGeo = new THREE.ShapeGeometry(skirtShape, 40);
  skirtGeo.rotateX(-Math.PI / 2);
  {
    const pos = skirtGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const e = Math.min(1, Math.hypot(pos.getX(i) / 2.7, pos.getZ(i) / 9.9));
      const k = Math.min(1, Math.max(0, (e - 0.7) / 0.3));
      pos.setY(i, 0.02 + k * 0.55);
    }
  }
  const bilgeSkirt = new THREE.Mesh(skirtGeo, new THREE.MeshBasicMaterial({
    colorWrite: false, side: THREE.DoubleSide,
  }));
  bilgeSkirt.renderOrder = 1;
  bilgeShield.add(bilgeSkirt);
  // nappe d'eau de cale animée : contour qui clapote (bruit sur l'angle),
  // vaguelettes qui défilent, liseré d'écume au bord — piloté par les
  // uniforms uTime / uWater / uOpacity depuis la boucle de jeu.
  // plan subdivisé (et non l'ellipse plate) : le vertex shader soulève de
  // vraies vaguelettes 3D — vue de biais, l'eau a du volume ; le fragment
  // découpe l'ellipse via uR (alpha nul au-delà du bord)
  const bilgeWaterGeo = new THREE.PlaneGeometry(2.21 * 2, 9.31 * 2, 14, 44);
  bilgeWaterGeo.rotateX(-Math.PI / 2);
  // rendu OPAQUE (découpe par discard) : la nappe vit au fond de la coque,
  // SOUS le masque anti-océan — en transparent elle serait rejetée au z-test
  // du masque ; en opaque elle est dessinée avant lui et reste à l'écran.
  const bilgeWater = new THREE.Mesh(
    bilgeWaterGeo,
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWater: { value: 0 },     // niveau 0..1 (agite le clapot)
        uOpacity: { value: 0.8 },
        uR: { value: new THREE.Vector2(2.21, 9.31) },
      },
      vertexShader: `
        uniform float uTime, uWater; varying vec2 vP;
        void main(){
          vP = position.xz;
          vec3 p = position;
          float w = 0.028 + uWater * 0.032;
          p.y += sin(p.x * 4.2 + uTime * 2.3) * w
               + sin(p.z * 1.8 - uTime * 1.6 + p.x * 0.9) * w * 0.8;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime, uWater, uOpacity; uniform vec2 uR; varying vec2 vP;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), f.x),
                     mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
        }
        void main(){
          vec2 q = vP / uR;
          float r = length(q);
          float ang = atan(q.y, q.x);
          // le contour de la flaque ondule (clapot contre la coque)
          float slosh = 0.5 + 0.5 * uWater;
          float wob = noise(vec2(ang * 2.5, uTime * 0.55)) * 0.6
                    + noise(vec2(ang * 5.0 + 7.0, uTime * 0.9)) * 0.4;
          float edge = r + (wob - 0.5) * 0.16 * slosh;
          float a = smoothstep(1.0, 0.84, edge);
          if (a * uOpacity < 0.35) discard; // contour ondulé, découpe nette
          // vaguelettes qui se croisent
          float rip = noise(vP * 1.6 + vec2(uTime * 0.35, -uTime * 0.28)) * 0.6
                    + noise(vP * 3.8 - vec2(uTime * 0.55, uTime * 0.42)) * 0.4;
          vec3 col = mix(vec3(0.04, 0.19, 0.29), vec3(0.15, 0.42, 0.55), rip);
          // liseré d'écume qui lèche le bord
          float foam = smoothstep(0.80, 0.95, edge) * (1.0 - smoothstep(0.95, 1.0, edge));
          col = mix(col, vec3(0.85, 0.93, 0.94), foam * (0.35 + 0.45 * rip));
          gl_FragColor = vec4(col * (0.7 + 0.3 * uOpacity), 1.0);
        }`,
    }),
  );
  bilgeWater.position.y = 0.05;
  bilgeWater.visible = false;
  deck.add(bilgeWater);

  // barre franche à la poupe (poste du barreur / de la barreuse — HELM_POS
  // dans le repère du pont) ; le groupe pivote avec le steer pour le feedback
  const helm = new THREE.Group();
  const rudderPost = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.7, 8), PALETTE.darkOak);
  rudderPost.position.y = 0.55;
  helm.add(rudderPost);
  const tillerBar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 2.3), PALETTE.oak);
  tillerBar.position.set(0, 1.32, -1.0);
  tillerBar.rotation.x = 0.18;
  helm.add(tillerBar);
  helm.position.set(0, 0, 8.4);
  deck.add(helm);

  return { group: g, deck, helm, visual, planks, bilgeWater, bilgeShield };
}

// Où se tenir pour prendre la barre (repère local du pont — z 7 : le pont du
// drakkar.glb y est encore plat, il remonte fort vers l'étrave arrière).
export const HELM_POS = { x: 0, z: 7.0 };
// Le poste de voile : derrière le mât, visible depuis la caméra de poursuite.
export const SAIL_POS = { x: 0, z: 1.8 };

// --- Marqueurs holographiques (postes vacants, avaries à réparer) -------------
// Anneau au sol + pictogramme flottant, en blending additif — la boucle de jeu
// anime le pulse via userData.ring / userData.icon.
function emojiSprite(emoji, size = 1.6) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.font = '72px serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, 48, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: t, transparent: true, depthTest: false,
  }));
  sp.scale.set(size, size, 1);
  return sp;
}

export function buildStationMarker(color, emoji) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 1.0, 28),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.8, 2.2, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.10,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  beam.position.y = 1.16;
  g.add(beam);
  const icon = emojiSprite(emoji);
  icon.position.y = 2.4;
  g.add(icon);
  g.userData = { ring, icon, beam };
  return g;
}

// --- Drapeaux nordiques (croix scandinaves dessinées au canvas) ---------------
// Les paires de portes opposent le bon drapeau à son sosie : Norvège↔Islande,
// Suède↔Åland, Finlande↔Féroé.
const FLAGS = {
  no: { field: '#BA0C2F', border: '#ffffff', cross: '#00205B' }, // Norvège
  is: { field: '#02529C', border: '#ffffff', cross: '#DC1E35' }, // Islande
  se: { field: '#006AA7', cross: '#FECC02' },                    // Suède
  ax: { field: '#0053A5', border: '#FFCE00', cross: '#D21034' }, // Åland
  fi: { field: '#ffffff', cross: '#002F6C' },                    // Finlande
  fo: { field: '#ffffff', border: '#005EB9', cross: '#EF303E' }, // Féroé
};

// texture de drapeau plein cadre (l'étoffe elle-même : croix décalée à la hampe)
function flagClothTexture(code) {
  const spec = FLAGS[code];
  const c = document.createElement('canvas');
  c.width = 512; c.height = 352;
  const g = c.getContext('2d');
  const fw = 512, fh = 352;
  g.fillStyle = spec.field; g.fillRect(0, 0, fw, fh);
  const cx = fw * 0.36, cy = fh / 2;
  const drawCross = (color, arm) => {
    g.fillStyle = color;
    g.fillRect(0, cy - arm / 2, fw, arm);
    g.fillRect(cx - arm / 2, 0, arm, fh);
  };
  if (spec.border) drawCross(spec.border, fh * 0.30);
  drawCross(spec.cross, fh * (spec.border ? 0.16 : 0.20));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// drapeau qui claque au vent : plan attaché au mât par son bord gauche, ondulé
// dans le vertex shader (amplitude croissante vers le bord libre) + ombrage
function buildWavingFlag(tex, w = 7.4, h = 5.1) {
  const geo = new THREE.PlaneGeometry(w, h, 24, 12);
  geo.translate(w / 2, 0, 0); // x = 0 : la hampe
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uMap: { value: tex } },
    vertexShader: `
      uniform float uTime; varying vec2 vUv; varying float vShade;
      void main(){
        vUv = uv;
        vec3 p = position;
        float free = vUv.x; // 0 à la hampe → 1 au bord libre
        float w1 = sin(p.x * 1.6 - uTime * 6.2 + p.y * 0.6);
        float w2 = sin(p.x * 3.3 - uTime * 9.7);
        p.z += (w1 * 0.5 + w2 * 0.2) * free;
        p.x -= (1.0 - cos(free * 0.9)) * 0.4; // l'étoffe se raccourcit en ondulant
        vShade = 0.8 + 0.2 * cos(w1 + w2 * 0.5);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uMap; varying vec2 vUv; varying float vShade;
      void main(){
        vec4 c = texture2D(uMap, vUv);
        gl_FragColor = vec4(c.rgb * vShade, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

// rocher Meshy des portes, chargé une fois puis cloné (ressources partagées :
// les clones sont tagués noDispose pour survivre au disposeScene des portes)
let boulderProto = null;
export function preloadGateBoulder(loader, url) {
  if (!url || boulderProto) return;
  loader.load(url, (gltf) => {
    boulderProto = gltf.scene;
    boulderProto.traverse((o) => {
      if (o.isMesh && o.material) o.material.emissiveIntensity = 0;
    });
  }, undefined, () => { /* on gardera les pierres procédurales */ });
}

// --- Porte de réponse : deux pierres runiques + panneau texte ou drapeau ------
function answerTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,16,32,0.88)';
  g.beginPath(); g.roundRect(6, 6, 500, 148, 22); g.fill();
  g.strokeStyle = '#5EE0A0'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#eafff4';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 64;
  g.font = `bold ${size}px 'Archivo Black', system-ui, sans-serif`;
  while (g.measureText(text).width > 460 && size > 22) {
    size -= 4;
    g.font = `bold ${size}px 'Archivo Black', system-ui, sans-serif`;
  }
  g.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const stoneMat = new THREE.MeshStandardMaterial({ color: '#4a5560', roughness: 0.9 });
const runeGlowMat = new THREE.MeshBasicMaterial({ color: '#5EE0A0' });

// `answer` : { text } pour un panneau texte, { flag: 'no'|'is'|'se'|'ax'|'fi'|'fo' }
// pour un vrai drapeau 3D sur mât. Chaque montant de porte = un rocher (GLB
// Meshy si chargé, pierre procédurale sinon).
export function buildGate(answer, width = 26) {
  const g = new THREE.Group();
  g.userData.flagMats = [];
  for (const s of [-1, 1]) {
    const pier = new THREE.Group();
    pier.position.set(s * width / 2, 0, 0);
    g.add(pier);
    if (boulderProto) {
      const rock = boulderProto.clone(true);
      rock.traverse((o) => { o.userData.noDispose = true; }); // ressources du proto
      rock.scale.setScalar(6.2 + Math.random() * 1.6);
      rock.rotation.y = Math.random() * Math.PI * 2;
      rock.position.y = -1.6; // bien assis dans l'eau
      pier.add(rock);
    } else {
      const pillarGeo = new THREE.CylinderGeometry(1.4, 2.1, 13, 7);
      const pos = pillarGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) * (0.85 + Math.random() * 0.3));
        pos.setZ(i, pos.getZ(i) * (0.85 + Math.random() * 0.3));
      }
      pillarGeo.computeVertexNormals();
      const pillar = new THREE.Mesh(pillarGeo, stoneMat);
      pillar.position.y = 3.5;
      pier.add(pillar);
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.6), runeGlowMat);
      rune.position.set(-s * 1.6, 6.5, 0);
      rune.rotation.y = -s * Math.PI / 2 + Math.PI;
      pier.add(rune);
    }
    if (answer.flag) {
      // mât planté dans le rocher + drapeau claquant au vent
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 15, 8), PALETTE.darkOak);
      mast.position.y = 8.2;
      pier.add(mast);
      const truck = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), PALETTE.oak);
      truck.position.y = 15.8;
      pier.add(truck);
      const flag = buildWavingFlag(flagClothTexture(answer.flag));
      flag.position.set(0.25, 13.2, 0);
      pier.add(flag);
      g.userData.flagMats.push(flag.material);
    }
  }
  if (!answer.flag) {
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({
      map: answerTexture(answer.text), transparent: true, depthTest: false,
    }));
    sign.scale.set(19, 6, 1);
    sign.position.y = 13.5;
    g.add(sign);
  }
  g.userData.width = width;
  return g;
}

// --- Obstacles (icebergs / récifs) recyclés devant l'étrave -------------------
const rockMat = new THREE.MeshStandardMaterial({ color: '#3c4147', roughness: 0.95, flatShading: true });
const iceMat = new THREE.MeshStandardMaterial({ color: '#cfe3e8', roughness: 0.35, metalness: 0.05, flatShading: true });
const foamRingMat = new THREE.MeshBasicMaterial({
  color: 0xdff0f2, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
});

export function makeObstacle() {
  const isIce = Math.random() < 0.6; // Norvège oblige : surtout de la glace
  const r = 3 + Math.random() * (isIce ? 5 : 4);
  const geo = isIce ? new THREE.OctahedronGeometry(r, 1) : new THREE.IcosahedronGeometry(r, 1);
  // Les géométries polyédriques dupliquent les sommets par face : un bruit par
  // INDEX déchire le maillage (faces disjointes, on voyait à travers). Le bruit
  // est donc dérivé de la POSITION — les doublons bougent d'un seul bloc.
  const seed = Math.random() * 100;
  const hash3 = (x, y, z) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed) * 43758.5453;
    return n - Math.floor(n);
  };
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const s = 0.72 + hash3(x, y, z) * 0.5;
    pos.setXYZ(i, x * s, y * s * (isIce ? 1.15 : 0.8), z * s);
  }
  geo.computeVertexNormals();
  const group = new THREE.Group();
  const body = new THREE.Mesh(geo, isIce ? iceMat : rockMat);
  body.position.y = -r * 0.35;
  group.add(body);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r * 1.45, 28), foamRingMat);
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  group.userData = { radius: r * 0.85, spin: (Math.random() - 0.5) * 0.3, bobPhase: Math.random() * 6 };
  return group;
}

// --- Courant aérien : ruban de vent lumineux posé sur l'eau -------------------
// S'y engager recharge la barre de vent (boost de vitesse) — il faut parfois
// se décaler de la route des portes pour aller le chercher.
export function windLaneTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 10;
  g.lineCap = 'round';
  // chevrons qui pointent vers l'avant du courant (+v)
  for (const y of [40, 130, 220]) {
    g.beginPath();
    g.moveTo(20, y + 26);
    g.lineTo(64, y - 26);
    g.lineTo(108, y + 26);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildWindLane(map, length = 95, width = 13) {
  const geo = new THREE.PlaneGeometry(width, length, 1, 1);
  geo.rotateX(-Math.PI / 2); // à plat, longueur sur Z (local -z = avant)
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map, color: '#5EE0A0', transparent: true, opacity: 0.38,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.material.map.repeat.set(1, 4);
  mesh.renderOrder = 1;
  mesh.userData = { halfLen: length / 2, halfWid: width / 2 };
  return mesh;
}

export function disposeScene(root) {
  root.traverse((o) => {
    if (o.userData?.noDispose) return; // ressources partagées (clones du rocher)
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (m.map) m.map.dispose();
      if (m.uniforms?.uMap?.value?.dispose) m.uniforms.uMap.value.dispose();
      m.dispose();
    }
  });
}
