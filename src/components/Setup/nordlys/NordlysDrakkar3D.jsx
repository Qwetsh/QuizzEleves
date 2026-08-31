/**
 * Nordlys — « La traversée du drakkar », coop à DEUX sur un clavier.
 *
 *  · Les deux joueurs embarquent SUR LE PONT et choisissent eux-mêmes leur
 *    rôle : joueur clavier gauche = ZQSD + E, joueur clavier droit = ←↑↓→ + ↵.
 *    Prendre la barre (à la poupe) fait de vous le barreur / la barreuse ;
 *    l'autre écope les voies d'eau. On peut échanger en cours de route.
 *  · QUIZ-NAVIGATION : 10 questions (mythologie nordique, drapeaux sosies,
 *    Oslo, « bonjour » en norvégien…) — on fait passer le drakkar par la
 *    bonne porte runique. Mauvaise réponse, iceberg ou vague scélérate =
 *    voie d'eau (l'eau ralentit, jamais game over) + l'équipage chute.
 *  · LES SIRÈNES : question audio (« Runaway » d'AURORA, fichier
 *    src/assets/nordlys/runaway.mp3) — la barre ne répond plus, le drakkar
 *    dérive à tribord ; taper AURORA ou RUNAWAY brise le charme.
 *  · Si les deux amoureux sont proches : ESPACE = petit bisou + cœurs. 💞
 *
 * Moteur : base « Modélisation d'eau pour jeu Drakkar » de Claude Design
 * (océan de Gerstner GPU+CPU, drakkar procédural, embruns, caméra de chasse),
 * ré-éclairée en nuit polaire avec aurore boréale shader. Aucun store/réseau.
 * L'équipage (GLB animés ou vikings de secours) vit dans ocean/characters.js.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createOcean } from './ocean/water';
import {
  SHIP, HELM_POS, SAIL_POS, buildDrakkar, buildGate, makeObstacle, disposeScene,
  buildWindLane, windLaneTexture, preloadGateBoulder, buildStationMarker,
} from './ocean/drakkar';
import { createCrewMember, glbUrl, makeLoader } from './ocean/characters';
import { pickBanter, createBubble, stepBubble, BUBBLE_LIFT } from './ocean/banter';

const FONT_DISPLAY = "'Archivo Black', system-ui, sans-serif";
const FONT_MONO = "'VT323', monospace";

// « Runaway » d'AURORA pour la question des sirènes — déposer le fichier audio
// (runaway.mp3 / .ogg / .m4a) dans src/assets/nordlys/ ; sans lui, la mécanique
// fonctionne quand même, en silence.
const ASSET_URLS = import.meta.glob('../../../assets/nordlys/*', {
  eager: true, query: '?url', import: 'default',
});
const audioUrl = (re) => Object.entries(ASSET_URLS).find(([p]) => re.test(p))?.[1] || null;
const RUNAWAY_URL = audioUrl(/runaway[^/]*\.(mp3|ogg|m4a|wav)$/i);
const OCEAN_URL = audioUrl(/ocean-ambience[^/]*\.mp3$/i);   // ressac en boucle
const CRASH_URL = audioUrl(/wave-crash[^/]*\.mp3$/i);       // impact de scélérate
const MUSIC_URL = audioUrl(/music-ambience[^/]*\.mp3$/i);   // musique du voyage
const ROCK_URL = audioUrl(/rock-crash[^/]*\.mp3$/i);        // choc contre un iceberg

// ---- Le périple : 10 étapes, ordre fixe (rythme pensé pour la traversée) ----
//  · gate  : deux portes texte (bâbord / tribord)
//  · flag  : deux portes drapeaux — le bon pays contre son sosie nordique
//  · siren : question audio — taper AURORA ou RUNAWAY pour reprendre la barre
const QUESTIONS = [
  { type: 'gate', q: "Combien de mondes relie Yggdrasil, l'arbre-monde ?", ok: '9', ko: '7' },
  { type: 'flag', q: 'Cap sur la NORVÈGE !', okFlag: 'no', koFlag: 'is' },
  { type: 'gate', q: 'Qui manie le marteau Mjöllnir ?', ok: 'Thor', ko: 'Loki' },
  { type: 'siren' },
  { type: 'gate', q: 'Dans quelle ville est remis le prix Nobel de la paix ?', ok: 'Oslo', ko: 'Stockholm' },
  { type: 'flag', q: 'Cap sur la SUÈDE !', okFlag: 'se', koFlag: 'ax' },
  { type: 'gate', q: 'Quel loup géant menace les dieux ?', ok: 'Fenrir', ko: 'Sleipnir' },
  { type: 'flag', q: 'Cap sur la FINLANDE !', okFlag: 'fi', koFlag: 'fo' },
  { type: 'gate', q: 'Où vont les guerriers tombés au combat ?', ok: 'Valhalla', ko: 'Midgard' },
  { type: 'gate', q: 'Comment dit-on « bonjour » en norvégien ?', ok: 'Hei !', ko: 'Hola !' },
];
const WIN_SCORE = QUESTIONS.length;
// la progression épelle le début du futhark, une rune par bonne réponse
const FUTHARK = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ'];

const CRUISE = 17;         // référence de vitesse (m/s) — la vitesse réelle dépend
                           // du VENT (courants aériens → S.boost) et de l'eau embarquée
const GATE_AHEAD = 240;    // distance d'apparition des portes
const GATE_SPREAD = 30;    // écart latéral des centres de porte

const OK_TEXTS = ['SKÅL ! Bonne voie !', 'Par Thor, bien joué !', 'Les runes approuvent !'];
const KO_TEXTS = ["Par Odin ! Voie d'eau !", 'Aïe ! Mauvais cap !'];

// Deux moitiés de clavier : chacun pilote SON personnage. Le barreur vire avec
// ses propres touches gauche/droite (Q/D ou ←/→).
const CTRL = {
  a: { left: ['q', 'a'], right: ['d'], up: ['z'], down: ['s'], action: 'e', name: 'ZQSD', actName: 'E' },
  b: { left: ['arrowleft'], right: ['arrowright'], up: ['arrowup'], down: ['arrowdown'], action: 'enter', name: '←↑↓→', actName: '↵' },
};
// Le rythme de la voile : ces touches appartiennent au poste, pas au déplacement.
// Chacun reste sur SA moitié de clavier — W X C V tombe sous la main gauche, donc
// le clavier droit joue sur le pavé numérique. Repéré par e.code : le NumLock et
// le layout ne changent rien (Numpad4 sans NumLock enverrait 'ArrowLeft').
const SAIL_KEYS = {
  a: ['w', 'x', 'c', 'v'],
  b: ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'],
};
const SAIL_LABELS = { a: ['W', 'X', 'C', 'V'], b: ['1', '2', '3', '4'] };
const SAIL_SLOTS = 4;
// index (0..3) de la touche de voile jouée par `id`, ou -1
const sailSlotOf = (e, id) => (id === 'b'
  ? SAIL_KEYS.b.indexOf(e.code)
  : SAIL_KEYS.a.indexOf(e.key.toLowerCase()));
// Qui incarne qui (les GLB amandine.glb / clement.glb sont mappés là-dessus).
const WHO = { a: 'amandine', b: 'clement' };

// Presets de caméra (touches 1/2/3 en jeu). Le 2 est la vue par défaut :
// reculée pour que la personne à la barre (poupe) reste visible à l'écran.
const CAM_PRESETS = {
  1: { back: 60, up: 25, aheadLook: 30, lookY: 7, fov: 55, crew: 1.0, sailOpacity: 1 },    // chase basse (v1)
  2: { back: 46, up: 27, aheadLook: 34, lookY: 1, fov: 50, crew: 1.5, sailOpacity: 0.28 }, // « pont + barreur » (défaut, portes au-dessus de la voile)
  3: { back: 36, up: 17, aheadLook: 40, lookY: 4, fov: 50, crew: 1.6, sailOpacity: 0.6 },  // « grand large »
};

const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

export default function NordlysDrakkar3D() {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready'); // 'ready' | 'run' | 'done'
  const [hud, setHud] = useState({
    item: null, siren: null, score: 0, water: 0, feedback: null,
    helmId: null, hint: null, boost: 0, bailPct: null,
  });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 4000);
    const MOON = new THREE.Vector3(-0.4, 0.42, -1).normalize();

    // ---- ciel : nuit polaire + aurore boréale animée + étoiles ----
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(2200, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: {
          uTop: { value: new THREE.Color('#081226') },
          uHorizon: { value: new THREE.Color('#16344e') },
          uMoonCol: { value: new THREE.Color('#dfe9ff') },  // lune froide (fixe)
          uMoonDir: { value: new THREE.Vector3(0.55, 0.42, 0.62).normalize() },
          uSunCol: { value: new THREE.Color('#ffeccf') },   // soleil chaud (fixe)
          uSunDir: { value: MOON.clone() },
          uTime: { value: 0 },
          uDay: { value: 1 },  // 0 = nuit polaire, 1 = aube tamisée (cycle 4 min)
          uDawnCol: { value: new THREE.Color('#ff9a5e') },
        },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `
          uniform vec3 uTop, uHorizon, uMoonCol, uMoonDir, uSunCol, uSunDir, uDawnCol;
          uniform float uTime, uDay; varying vec3 vD;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
          void main(){
            vec3 nd = normalize(vD);
            float night = 1.0 - uDay;
            float h = clamp(vD.y * 1.6, -0.2, 1.0);
            vec3 c = mix(uHorizon, uTop, smoothstep(-0.02, 0.85, h));
            // soleil (façon Claude Design : disque net + large halo doux)
            float s = max(dot(nd, normalize(uSunDir)), 0.0);
            c += uSunCol * (pow(s, 900.0) * 1.4 + pow(s, 12.0) * 0.22) * uDay;
            // lune froide, plus petite, qui veille la nuit
            float m = max(dot(nd, normalize(uMoonDir)), 0.0);
            c += uMoonCol * (pow(m, 2600.0) * 1.1 + pow(m, 40.0) * 0.10) * night;
            // lueur d'aube : bandeau orangé côté soleil, au ras de l'horizon
            float az0 = max(dot(normalize(vec3(nd.x, 0.0, nd.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
            c += uDawnCol * uDay * pow(az0, 2.6) * smoothstep(0.45, 0.02, abs(nd.y - 0.05)) * 0.42;
            // étoiles et aurore s'effacent quand le jour se lève
            float st = step(0.9986, hash(floor(vD.xy * 260.0 + vD.zx * 97.0)));
            c += vec3(0.9) * st * smoothstep(0.06, 0.3, vD.y) * night;
            float az = atan(vD.x, vD.z);
            float band = smoothstep(0.10, 0.32, vD.y) * smoothstep(0.85, 0.42, vD.y);
            float cur1 = sin(az * 4.0 + uTime * 0.22 + sin(vD.y * 9.0 + uTime * 0.13) * 1.6);
            float cur2 = sin(az * 7.0 - uTime * 0.15 + 2.1);
            c += vec3(0.30, 0.85, 0.55) * band * max(cur1, 0.0) * 0.75 * night;
            c += vec3(0.45, 0.30, 0.80) * band * max(cur2, 0.0) * 0.28 * night;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    sky.frustumCulled = false;
    scene.add(sky);

    const hemi = new THREE.HemisphereLight(0x9ec4e4, 0x0c1c2c, 1.15);
    scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xcfe4ff, 1.25);
    moon.position.copy(MOON).multiplyScalar(200);
    scene.add(moon);

    // ---- cycle aube ↔ nuit polaire : palettes interpolées chaque frame ----
    // (période DAY_CYCLE : ~2 min d'aube tamisée, ~2 min de nuit à aurore)
    const C = (x) => new THREE.Color(x);
    const PAL = {
      night: { top: C('#081226'), horizon: C('#16344e'), moon: C('#cfe4ff'), hemiSky: C('#9ec4e4'), hemiGround: C('#0c1c2c'), deep: C('#04101c'), shallow: C('#0d3546'), skyTint: C('#1d3a54'), fog: C('#0a1826') },
      dawn: { top: C('#31425c'), horizon: C('#9a7570'), moon: C('#ffd9a8'), hemiSky: C('#f2d6ba'), hemiGround: C('#48404a'), deep: C('#123f58'), shallow: C('#2e6d84'), skyTint: C('#b39a8c'), fog: C('#82717e') },
    };
    const DAY_CYCLE = 240; // secondes pour un tour complet aube → nuit → aube
    const sunDirNow = new THREE.Vector3();
    const moonDirNow = new THREE.Vector3();
    const lightDirNow = new THREE.Vector3();

    // ---- océan (recoloré nuit) ----
    const ocean = createOcean({ size: 1100, segments: 340 });
    ocean.params.amp = 0.8;
    ocean.uniforms.uDeep.value.set('#04101c');
    ocean.uniforms.uShallow.value.set('#0d3546');
    ocean.uniforms.uSkyTint.value.set('#1d3a54');
    ocean.uniforms.uSunCol.value.set('#bfe4ff');
    ocean.uniforms.uFogCol.value.set('#0a1826');
    ocean.uniforms.uSunDir.value.copy(MOON);
    ocean.uniforms.uFogDensity.value = 0.0026;
    ocean.mesh.renderOrder = 2; // après le masque de cale (voir drakkar.js)
    scene.add(ocean.mesh);

    // ---- drakkar + équipage ----
    const boat = new THREE.Group();
    const built = buildDrakkar();
    boat.add(built.group);
    scene.add(boat);
    let sail = built.group.getObjectByName('sail');

    // ---- vrai drakkar (drakkar.glb, compressé meshopt) : dès qu'il est
    // chargé, il remplace le visuel procédural ; le pont logique (équipage,
    // fuites, barre) ne bouge pas. Constantes de calage ci-dessous.
    const DRAKKAR_TUNE = {
      rotY: -Math.PI / 2, // longueur du modèle sur X → alignée sur -Z (retourné 180° : la proue devant)
      y: -1.6,           // hauteur de la quille dans le repère du bateau
      scale: 1.0,        // ajustement fin par rapport aux 26 m théoriques
      deckY: 0.12,       // le FOND praticable de la coque GLB au maître-couple
      deckSlope: -0.053, // sa pente (inversée par le retournement : il remonte vers la poupe)
      shieldY: 1.66,     // le masque anti-océan reste, lui, au niveau du plat-bord
    };
    let deckSlope = 0;   // 0 tant que le drakkar procédural (pont plat) est visible
    const floorAt = (lz) => -deckSlope * lz; // offset du plancher au point lz du pont
    let lantern = null;
    preloadGateBoulder(makeLoader(), glbUrl('boulder')); // rochers des portes
    const drakkarGlbUrl = glbUrl('drakkar');
    if (drakkarGlbUrl) {
      makeLoader().load(drakkarGlbUrl, (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const spanX = box.max.x - box.min.x;
        const wrap = new THREE.Group();
        // origine du wrap = centre x/z du navire, quille posée à y=0
        model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
        wrap.add(model);
        wrap.scale.setScalar((SHIP.length / spanX) * DRAKKAR_TUNE.scale);
        wrap.rotation.y = DRAKKAR_TUNE.rotY;
        wrap.position.y = DRAKKAR_TUNE.y;
        built.group.add(wrap);
        built.visual.visible = false;
        built.planks.visible = false;
        built.deck.position.y = DRAKKAR_TUNE.deckY; // l'équipage descend au fond de la coque
        deckSlope = DRAKKAR_TUNE.deckSlope;         // …qui penche vers la poupe
        built.bilgeWater.rotation.x = deckSlope;    // l'eau de cale épouse la pente
        built.bilgeShield.position.y = DRAKKAR_TUNE.shieldY; // l'anti-houle reste haut
        built.helm.visible = false; // le GLB a son propre gouvernail sculpté
        sail = null; // le GLB est un mesh unique : pas de voile à estomper
        // lanterne au pied du mât : sans elle, l'équipage se perd dans la nuit
        // (elle s'éteint doucement quand l'aube se lève — cf. cycle jour/nuit)
        lantern = new THREE.PointLight('#ffd9a0', 30, 26, 1.8);
        lantern.position.set(0, 2.6, 1); // au pied du mât (modèle retourné)
        built.deck.add(lantern);
      }, undefined, () => { /* fichier illisible → on garde le procédural */ });
    }

    // Les deux amoureux, côte à côte au milieu du pont — à eux de choisir
    // qui court prendre la barre.
    // spawn derrière la voile (le drakkar.glb a sa voile qui descend jusqu'au
    // pont sur la bande z ∈ [0..3,5] — on évite d'y cacher l'équipage)
    const crew = [
      { id: 'a', spawn: { x: -1.1, z: 4.6 } },
      { id: 'b', spawn: { x: 1.1, z: 4.6 } },
    ].map((def) => {
      const member = createCrewMember({ who: WHO[def.id] });
      member.group.position.set(def.spawn.x, 0.12, def.spawn.z);
      built.deck.add(member.group);
      return { ...def, member, lx: def.spawn.x, lz: def.spawn.z, rotY: Math.PI, fallT: 0 };
    });

    // marqueurs holographiques des postes vacants : « c'est ici qu'on agit »
    const helmMarker = buildStationMarker('#5EE0A0', '🧭');
    helmMarker.position.set(HELM_POS.x, 0.1, HELM_POS.z);
    built.deck.add(helmMarker);
    const sailMarker = buildStationMarker('#5EE0A0', '⛵');
    sailMarker.position.set(SAIL_POS.x, 0.1, SAIL_POS.z);
    built.deck.add(sailMarker);

    // preset de caméra actif (2 = défaut) — touches 1/2/3 pour comparer en jeu.
    // La souris orbite autour du bateau (glisser) et la molette zoome ; les
    // presets réinitialisent l'orbite.
    let cam = CAM_PRESETS[2];
    const orbit = { yaw: 0, pitch: 0.5, dist: 53 };
    const applyPreset = (p) => {
      cam = p;
      camera.fov = p.fov;
      camera.updateProjectionMatrix();
      for (const c of crew) c.member.group.scale.setScalar(p.crew);
      if (sail) sail.material.opacity = p.sailOpacity;
      orbit.yaw = 0;
      orbit.pitch = Math.atan2(p.up, p.back);
      orbit.dist = Math.hypot(p.back, p.up);
    };
    applyPreset(cam);

    let camDrag = null;
    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      camDrag = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    };
    const onPointerMove = (e) => {
      if (!camDrag) return;
      orbit.yaw -= (e.clientX - camDrag.x) * 0.005;
      orbit.pitch = Math.min(1.25, Math.max(0.08, orbit.pitch + (e.clientY - camDrag.y) * 0.004));
      camDrag = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => { camDrag = null; };
    const onWheel = (e) => {
      e.preventDefault();
      orbit.dist = Math.min(120, Math.max(16, orbit.dist * Math.pow(1.0016, e.deltaY)));
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // ---- embruns d'étrave (repris du prototype) ----
    const SPRAY_N = 400;
    const sprayPos = new Float32Array(SPRAY_N * 3);
    const sprayVel = new Float32Array(SPRAY_N * 3);
    const sprayLife = new Float32Array(SPRAY_N);
    const sprayGeo = new THREE.BufferGeometry();
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    const sprayTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.45, 'rgba(230,244,246,0.45)');
      grd.addColorStop(1, 'rgba(230,244,246,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const spray = new THREE.Points(sprayGeo, new THREE.PointsMaterial({
      size: 1.5, map: sprayTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, opacity: 0.8, sizeAttenuation: true,
    }));
    spray.frustumCulled = false;
    scene.add(spray);
    let sprayCursor = 0;
    const emitSpray = (x, y, z, dir, power) => {
      for (let k = 0; k < 2; k++) {
        const i = (sprayCursor = (sprayCursor + 1) % SPRAY_N) * 3;
        sprayPos[i] = x + (Math.random() - 0.5) * 2.4;
        sprayPos[i + 1] = y + Math.random() * 0.4;
        sprayPos[i + 2] = z + (Math.random() - 0.5) * 2.4;
        sprayVel[i] = dir.x * power * 0.4 + (Math.random() - 0.5) * 3;
        sprayVel[i + 1] = 3 + Math.random() * 4 * power;
        sprayVel[i + 2] = dir.z * power * 0.4 + (Math.random() - 0.5) * 3;
        sprayLife[sprayCursor] = 0.9 + Math.random() * 0.5;
      }
    };

    // ---- cœurs du bisou (sprites locaux au pont : ils suivent le drakkar) ----
    const heartTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      g.font = '52px serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('💗', 32, 36);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const hearts = [];
    const spawnHearts = (lx, lz) => {
      for (let i = 0; i < 14; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: heartTex, transparent: true, depthTest: false,
        }));
        sp.position.set(lx + (Math.random() - 0.5) * 1.4, 1.4 + Math.random() * 0.8, lz + (Math.random() - 0.5) * 1.4);
        const sc = 0.45 + Math.random() * 0.65;
        sp.scale.set(sc, sc, 1);
        const life = 1.4 + Math.random() * 1.0;
        sp.userData = { vy: 1.5 + Math.random() * 1.5, sway: Math.random() * 6.28, life, maxLife: life };
        built.deck.add(sp);
        hearts.push(sp);
      }
    };

    // ---- obstacles : la mer se densifie au fil des bonnes réponses ----
    const obstacles = [];
    for (let i = 0; i < 32; i++) {
      const o = makeObstacle();
      o.position.set((Math.random() - 0.5) * 600, 0, (Math.random() - 0.5) * 600 - 150);
      o.visible = i < 14;
      scene.add(o);
      obstacles.push(o);
    }
    // replace un obstacle devant l'étrave, hors du couloir des portes
    const recycleObstacle = (o) => {
      const spread = (Math.random() - 0.5) * 240;
      const ahead2 = 190 + Math.random() * 130;
      o.position.set(
        S.pos.x + dirVec.x * ahead2 - dirVec.z * spread, 0,
        S.pos.z + dirVec.z * ahead2 + dirVec.x * spread,
      );
      o.rotation.z = 0;
      o.userData.sinking = 0;
      if (S.gate) {
        const rel = o.position.clone().sub(S.gate.origin);
        if (Math.abs(rel.dot(S.gate.dir)) < 75 && Math.abs(rel.dot(S.gate.side)) < 55) {
          o.position.addScaledVector(S.gate.side, rel.dot(S.gate.side) >= 0 ? 95 : -95);
        }
      }
    };

    // ---- courants aériens : rubans de vent qui rechargent la barre de vent ----
    const laneTex = windLaneTexture();
    const lanes = [];
    const laneDir = new THREE.Vector3();
    const placeLane = (lane, first = false) => {
      const ahead = first ? 80 + Math.random() * 260 : 170 + Math.random() * 220;
      const lat = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 75);
      const fwd = new THREE.Vector3(-Math.sin(S.heading), 0, -Math.cos(S.heading));
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
      lane.position.copy(S.pos).addScaledVector(fwd, ahead).addScaledVector(side, lat);
      lane.rotation.y = S.heading + (Math.random() - 0.5) * 0.5; // ~aligné sur la route
    };
    for (let i = 0; i < 4; i++) {
      const lane = buildWindLane(laneTex, 55, 9); // couloirs courts, recharge punchy
      scene.add(lane);
      lanes.push(lane);
    }

    // ---- le fjord (arrivée) : trois crêtes en silhouette, design Claude ----
    const fbm = (u, seed) => {
      let v = 0, a = 1, f = 1.7;
      for (let i = 0; i < 5; i++) { v += a * Math.sin(u * f + seed * (i + 1) * 2.399); a *= 0.55; f *= 2.03; }
      return v;
    };
    const ridgeGeometry = (width, height, seed) => {
      const N = 200, shape = new THREE.Shape();
      shape.moveTo(-width / 2, -60);
      for (let i = 0; i <= N; i++) {
        const u = (i / N) * 2 - 1;
        const wall = Math.pow(Math.abs(u), 0.85); // le creux central = le chenal d'entrée
        let hh = height * (0.08 + 0.98 * wall);
        hh *= 0.70 + 0.44 * (fbm(u * 3.1, seed) * 0.5 + 0.5);
        hh += height * 0.11 * fbm(u * 12, seed + 3);
        shape.lineTo(u * width / 2, Math.max(hh, height * 0.015));
      }
      shape.lineTo(width / 2, -60);
      shape.closePath();
      return new THREE.ShapeGeometry(shape, 1);
    };
    const FJORD_SPECS = [
      { w: 6400, h: 520, d: 3100, color: '#8ea6b1', o: 0.55, seed: 1.3 },
      { w: 4800, h: 700, d: 2150, color: '#61798a', o: 0.8, seed: 4.1 },
      { w: 3400, h: 820, d: 1350, color: '#364a55', o: 1.0, seed: 7.7 },
    ];
    const fjord = new THREE.Group();
    fjord.visible = false;
    scene.add(fjord);
    const fjordLayers = FJORD_SPECS.map((s) => {
      const m = new THREE.Mesh(ridgeGeometry(s.w, s.h, s.seed), new THREE.MeshBasicMaterial({
        color: s.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
      }));
      m.position.z = -s.d;
      m.userData.max = s.o;
      fjord.add(m);
      return m;
    });

    // ---- bande-son : ressac + musique (fondue pendant les sirènes) + impacts ----
    const makeAudio = (url, { loop = false, volume = 1 } = {}) => {
      if (!url) return null;
      const a = new Audio(url);
      a.loop = loop;
      a.volume = volume;
      a.preload = 'auto'; // décodé d'avance : pas de latence au premier play
      return a;
    };
    const sirenAudio = makeAudio(RUNAWAY_URL, { loop: true, volume: 0.85 });
    const oceanAudio = makeAudio(OCEAN_URL, { loop: true, volume: 0.35 });
    const musicAudio = makeAudio(MUSIC_URL, { loop: true, volume: 0 }); // fondu d'entrée
    const crashAudio = makeAudio(CRASH_URL, { volume: 0.9 });
    const rockAudio = makeAudio(ROCK_URL, { volume: 0.9 });
    let rockStopTimer = 0;
    // le fichier a 1,52 s de silence en tête (mesuré) : on attaque directement
    // le choc, et on garde ~5 s utiles avant le fondu de sortie
    const playRockCrash = () => {
      if (!rockAudio) return;
      clearTimeout(rockStopTimer);
      rockAudio.currentTime = 1.45;
      rockAudio.volume = 0.9;
      rockAudio.play().catch(() => {});
      rockStopTimer = setTimeout(() => {
        fadeAudio(rockAudio, 0, 0.5, () => { rockAudio.pause(); rockAudio.volume = 0.9; });
      }, 4500);
    };
    const MUSIC_VOL = 0.5;
    const fadeIvs = new Set();
    const fadeAudio = (audio, target, dur = 1.8, onDone) => {
      if (!audio) { onDone?.(); return; }
      const from = audio.volume, t0 = performance.now();
      const iv = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / (dur * 1000));
        audio.volume = from + (target - from) * k;
        if (k >= 1) { clearInterval(iv); fadeIvs.delete(iv); onDone?.(); }
      }, 50);
      fadeIvs.add(iv);
    };

    // ---- état du jeu ----
    const keys = new Set();
    const S = {
      pos: new THREE.Vector3(), heading: 0, speed: 0,
      score: 0, water: 0, shake: 0, cooldown: 0, done: false,
      leaks: [],                       // { mesh, hp, x, z }
      gate: null,                      // { origin, dir, side, groups, correctSide, item }
      currentItem: null,
      qIndex: 0, nextQuestionIn: 3.5, feedback: null,
      helmId: null,                    // 'a' | 'b' | null — qui tient la barre
      siren: null,                     // { typed } pendant la question des sirènes
      wave: { nextIn: 24 + Math.random() * 12, rogue: null, ridden: false, closeWarned: false },
      kissT: 0, kissCd: 0,
      boost: 0,                        // barre de vent (0..1), rechargée dans les courants
      inLane: false, laneFbCd: 0,
      bailPct: null,                   // progression du colmatage en cours (HUD)
      day: 1, dayOverride: null,       // 1 = aube, 0 = nuit (override pour debug)
      fjordReveal: 0,                  // la brume se retire sur les crêtes (0..1)
      sailerId: null,                  // 'a' | 'b' | null — qui tient le poste de voile
      sailQte: { slot: null, timer: 0, total: 1, next: 1.6, fb: null, fbUntil: 0 },
      // petites conversations du bord (ocean/banter.js)
      chat: { bubbles: [], cd: 0, seen: {}, leakNag: 0, waterNag: 0 },
    };

    const setFeedback = (kind, text, ms = 2400) => {
      S.feedback = { kind, text, until: performance.now() + ms };
    };
    // ---- les petites conversations du bord ----------------------------------
    // Une réplique + la réponse de l'autre 1,1 s plus tard, en bulle au-dessus
    // de la tête. Le locuteur dépend du rôle tenu à cet instant. Silence pendant
    // le chant des sirènes (c'est une question audio) et une fois arrivés.
    const CHAT_COOLDOWN = 5.5;
    const say = (evt, { force = false } = {}) => {
      const C = S.chat;
      if (S.done || S.siren || (C.cd > 0 && !force)) return;
      const ex = pickBanter(evt, {
        helm: S.helmId, sail: S.sailerId, ids: crew.map((c) => c.id),
        whoOf: (id) => WHO[id],
      }, C.seen);
      if (!ex) return;
      C.cd = CHAT_COOLDOWN;
      const open = (text, id, delay) => {
        const b = createBubble(text, WHO[id], { delay });
        b.crewId = id;
        built.deck.add(b.sprite);
        C.bubbles.push(b);
      };
      // une seule bulle par personne : la précédente s'efface
      for (const b of C.bubbles) if (b.crewId === ex.speaker || b.crewId === ex.listener) b.dur = Math.min(b.dur, b.life + 0.25);
      open(ex.a, ex.speaker, 0);
      if (ex.b) open(ex.b, ex.listener, 1.1);
    };
    // tout l'équipage sauf le barreur / la barreuse se retrouve à terre
    // (et la personne à la voile est éjectée de son poste)
    const knockDown = () => {
      for (const c of crew) if (c.id !== S.helmId) c.fallT = 1.2;
      if (S.sailerId) { S.sailerId = null; S.sailQte.slot = null; }
    };
    const crewDist = () => Math.hypot(crew[0].lx - crew[1].lx, crew[0].lz - crew[1].lz);

    // Victoire : le fjord se lève à l'horizon (la brume se retire), puis
    // l'inscription runique s'allume dans le ciel — le mot à rapporter.
    const checkWin = () => {
      if (S.score < WIN_SCORE || S.done) return;
      S.done = true;
      if (sirenAudio) sirenAudio.pause();
      fadeAudio(musicAudio, 0, 4); // seuls la mer et le vent accompagnent l'arrivée
      fjord.visible = true;
      fjord.position.set(S.pos.x, 0, S.pos.z);
      fjord.rotation.y = S.heading; // droit sur le cap : le chenal accueille le drakkar
      S.fjordReveal = 0;
      setPhase('done');
    };

    // ---- avaries (chocs d'iceberg) : zone holographique à réparer sur le
    // pont — tant qu'une avarie est ouverte, l'eau monte ----
    const spawnLeak = () => {
      if (S.leaks.length >= 3) return;
      const marker = buildStationMarker('#ff9a5a', '🔧');
      const x = (Math.random() - 0.5) * 3.2;
      // jamais sous la voile du GLB (bande z ∈ [-3,5..0,5] après retournement)
      const z = Math.random() < 0.5 ? -4.5 - Math.random() * 3.2 : 1.5 + Math.random() * 6;
      marker.position.set(x, 0.04 + floorAt(z), z);
      built.deck.add(marker);
      S.leaks.push({ mesh: marker, hp: 2.2, x, z });
    };

    // ---- questions : portes de réponse / sirènes ----
    const sideVec = new THREE.Vector3();
    // aucun iceberg à l'entrée des zones de réponse : on pousse de côté tout
    // obstacle présent dans le couloir des portes
    const clearGateCorridor = () => {
      if (!S.gate) return;
      for (const o of obstacles) {
        const rel = o.position.clone().sub(S.gate.origin);
        const along = rel.dot(S.gate.dir);
        const lat = rel.dot(S.gate.side);
        if (Math.abs(along) < 75 && Math.abs(lat) < 55) {
          o.position.addScaledVector(S.gate.side, lat >= 0 ? 95 : -95);
        }
      }
    };
    const answerFor = (item, good) => (item.type === 'flag'
      ? { flag: good ? item.okFlag : item.koFlag }
      : { text: good ? item.ok : item.ko });
    const askQuestion = () => {
      const item = QUESTIONS[S.qIndex];
      S.currentItem = item;
      S.feedback = null;
      if (item.type === 'siren') {
        S.siren = { typed: '' };
        // la musique du bord s'éteint doucement… puis le chant des sirènes s'élève
        fadeAudio(musicAudio, 0, 1.8, () => {
          if (S.siren && sirenAudio) { sirenAudio.currentTime = 0; sirenAudio.play().catch(() => {}); }
        });
        return;
      }
      const correctSide = Math.random() < 0.5 ? -1 : 1; // -1 = bâbord (gauche)
      const dir = new THREE.Vector3(-Math.sin(S.heading), 0, -Math.cos(S.heading));
      sideVec.set(-dir.z, 0, dir.x);
      const origin = S.pos.clone().addScaledVector(dir, GATE_AHEAD);
      const groups = [];
      for (const s of [-1, 1]) {
        const gate = buildGate(answerFor(item, s === correctSide));
        gate.position.copy(origin).addScaledVector(sideVec, s * GATE_SPREAD);
        gate.rotation.y = S.heading;
        scene.add(gate);
        groups.push(gate);
      }
      S.gate = { origin, dir: dir.clone(), side: sideVec.clone(), groups, correctSide, item };
      clearGateCorridor();
    };
    const clearGate = () => {
      if (!S.gate) return;
      for (const g of S.gate.groups) { scene.remove(g); disposeScene(g); }
      S.gate = null;
    };
    const resolveGate = (lat) => {
      const g = S.gate;
      const picked = Math.abs(lat - g.correctSide * GATE_SPREAD) < Math.abs(lat + g.correctSide * GATE_SPREAD) ? g.correctSide : -g.correctSide;
      const missed = Math.abs(Math.abs(lat) - GATE_SPREAD) > 17;
      clearGate();
      S.currentItem = null;
      if (missed) { S.nextQuestionIn = 1.5; return; } // repasse la même
      if (picked === g.correctSide) {
        S.score++; S.qIndex++;
        setFeedback('ok', OK_TEXTS[Math.floor(Math.random() * OK_TEXTS.length)]);
        checkWin();
        say('answerOk', { force: true });
      } else {
        // mauvais cap : un paquet de mer embarque (à écoper), pas d'avarie
        setFeedback('ko', KO_TEXTS[Math.floor(Math.random() * KO_TEXTS.length)]);
        S.water = Math.min(1, S.water + 0.25);
        knockDown();
        S.shake = 1;
        say('answerKo', { force: true });
      }
      S.nextQuestionIn = 6;
    };
    // les lettres tapées pendant les sirènes (n'importe où sur le clavier)
    const sirenType = (ch) => {
      const s = S.siren;
      s.typed = (s.typed + ch).slice(-14);
      if (stripAccents(s.typed).includes('AURORA') || stripAccents(s.typed).includes('RUNAWAY')) {
        S.siren = null;
        S.currentItem = null;
        if (sirenAudio) sirenAudio.pause();
        fadeAudio(musicAudio, MUSIC_VOL, 2.2); // la musique du bord revient
        S.score++; S.qIndex++;
        setFeedback('ok', 'Le charme des sirènes est rompu !', 2800);
        S.nextQuestionIn = 6;
        checkWin();
      }
    };

    // prendre / lâcher la barre (touche action près de la poupe)
    const tryHelmToggle = (id) => {
      if (S.helmId === id) { S.helmId = null; return; }
      if (S.helmId || S.sailerId === id) return;
      const c = crew.find((m) => m.id === id);
      if (c.fallT > 0) return;
      if (Math.hypot(c.lx - HELM_POS.x, c.lz - HELM_POS.z) < 2.3) {
        S.helmId = id;
        c.lx = HELM_POS.x; c.lz = HELM_POS.z;
      }
    };
    // entrer / quitter le poste de voile (mini-jeu de rythme, cf. SAIL_KEYS)
    const trySailToggle = (id) => {
      const Q = S.sailQte;
      if (S.sailerId === id) {
        S.sailerId = null;
        Q.slot = null; Q.fb = null;
        return;
      }
      if (S.sailerId || S.helmId === id) return;
      const c = crew.find((m) => m.id === id);
      if (c.fallT > 0) return;
      if (Math.hypot(c.lx - SAIL_POS.x, c.lz - SAIL_POS.z) < 1.8) {
        S.sailerId = id;
        c.lx = SAIL_POS.x; c.lz = SAIL_POS.z;
        Q.slot = null; Q.next = 1.2; Q.fb = null;
      }
    };
    const sailResolve = (hit) => {
      const Q = S.sailQte;
      S.boost = Math.min(1, Math.max(0, S.boost + (hit ? 0.22 : -0.2)));
      Q.fb = hit ? 'hit' : 'miss';
      Q.fbUntil = performance.now() + 700;
      Q.slot = null;
      Q.next = 0.8 + Math.random() * 0.8;
      // on ne commente pas CHAQUE fausse note : le poste en produit beaucoup
      if (!hit && Math.random() < 0.55) say('sailMiss');
    };
    const tryKiss = () => {
      if (S.kissCd > 0 || S.kissT > 0 || S.done) return;
      if (crewDist() > 2.4) return;
      S.kissT = 1.6; S.kissCd = 5;
      spawnHearts((crew[0].lx + crew[1].lx) / 2, (crew[0].lz + crew[1].lz) / 2);
    };

    // `say('iceberg')` en console rejoue un dialogue à la demande
    if (import.meta.env.DEV) window.__nordlys = { S, keys, crew, phaseRef, scene, boat, built, THREE, applyPreset, CAM_PRESETS, ocean, checkWin, say };

    const down = (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      if (k === ' ' && phaseRef.current === 'ready') {
        setPhase('run');
        // on largue les amarres : le ressac s'installe, la musique se lève
        oceanAudio?.play().catch(() => {});
        if (musicAudio) { musicAudio.play().catch(() => {}); fadeAudio(musicAudio, MUSIC_VOL, 2.5); }
        return;
      }
      if (phaseRef.current === 'run') {
        // 1/2/3 de la rangée du haut seulement : le pavé numérique est au poste de voile
        if (CAM_PRESETS[k] && !e.code.startsWith('Numpad')) { applyPreset(CAM_PRESETS[k]); return; }
        if (S.siren) {
          if (/^[a-z]$/.test(k)) sirenType(k);
          else if (k === 'backspace') S.siren.typed = S.siren.typed.slice(0, -1);
        }
        // le rythme de la voile : bonne touche = accélère, mauvaise = faseye
        if (!e.repeat && S.sailerId) {
          const slot = sailSlotOf(e, S.sailerId);
          // la touche est consommée par le poste : elle ne rejoint pas `keys`
          if (slot >= 0) { e.preventDefault(); sailResolve(S.sailQte.slot === slot); return; }
        }
        // pas d'auto-répétition : maintenir E/↵ sert à écoper, pas à toggler les postes
        if (!e.repeat && k === CTRL.a.action) { tryHelmToggle('a'); trySailToggle('a'); }
        if (!e.repeat && k === CTRL.b.action) { tryHelmToggle('b'); trySailToggle('b'); }
        if (!e.repeat && k === ' ') tryKiss();
      }
      keys.add(k);
    };
    const up = (e) => keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    // ---- boucle ----
    const clock = new THREE.Clock();
    let t = 0, raf = 0, hudTick = 0;
    const camPos = new THREE.Vector3(0, 24, 62);
    const camTarget = new THREE.Vector3();
    const dirVec = new THREE.Vector3();

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', resize);
    resize();

    const step = (dt) => {
      // ---- la barre : le navire avance seul, l'eau embarquée le freine ----
      let steer = 0;
      if (S.siren) {
        // les sirènes tiennent la barre : dérive inexorable à tribord
        S.heading -= 0.22 * dt;
      } else if (S.helmId && !S.done) { // à l'arrivée, le cap est verrouillé sur le fjord
        const ctrl = CTRL[S.helmId];
        steer = (ctrl.left.some((k) => keys.has(k)) ? 1 : 0) - (ctrl.right.some((k) => keys.has(k)) ? 1 : 0);
        S.heading += steer * dt * 1.0 * (0.4 + 0.6 * (S.speed / CRUISE));
      }
      if (built.helm) built.helm.rotation.y += (steer * 0.45 - built.helm.rotation.y) * Math.min(1, dt * 8);
      dirVec.set(-Math.sin(S.heading), 0, -Math.cos(S.heading));

      // ---- courants aériens : dedans, la barre de vent se recharge ----
      let inLane = false;
      for (const lane of lanes) {
        if (!lane.userData.placed) { placeLane(lane, true); lane.userData.placed = true; }
        laneDir.set(-Math.sin(lane.rotation.y), 0, -Math.cos(lane.rotation.y));
        const rx = S.pos.x - lane.position.x, rz = S.pos.z - lane.position.z;
        const along = rx * laneDir.x + rz * laneDir.z;
        const lat = rx * -laneDir.z + rz * laneDir.x;
        if (Math.abs(along) < lane.userData.halfLen && Math.abs(lat) < lane.userData.halfWid) inLane = true;
        // recyclage : trop loin ou largement dépassé → replacé devant
        const dx = lane.position.x - S.pos.x, dz = lane.position.z - S.pos.z;
        const ahead = dx * dirVec.x + dz * dirVec.z;
        if (Math.hypot(dx, dz) > 450 || ahead < -160) placeLane(lane);
        lane.position.y = ocean.sampleHeight(lane.position.x, lane.position.z, t) + 0.55;
        lane.material.opacity = 0.30 + Math.sin(t * 2.1 + lane.position.x) * 0.07;
      }
      laneTex.offset.y -= dt * 0.9; // les chevrons filent dans le sens du vent
      S.laneFbCd = Math.max(0, S.laneFbCd - dt);
      if (inLane && !S.inLane && S.laneFbCd <= 0 && !S.feedback) {
        setFeedback('ok', '💨 Le vent gonfle la voile !', 1800);
        S.laneFbCd = 10;
      }
      S.inLane = inLane;
      // les courants sont courts : la recharge y est franche — doublée si
      // quelqu'un tient le poste de voile
      S.boost = Math.min(1, Math.max(0, S.boost + (inLane ? (S.sailerId ? 1.8 : 0.9) : -0.05) * dt));

      // vitesse : portée par le vent (que le rythme de la voile entretient),
      // plombée par l'eau embarquée
      const target = S.done ? CRUISE
        : CRUISE * (0.75 + 0.55 * S.boost) * (1 - 0.55 * S.water);
      S.speed += (target - S.speed) * dt * 0.8;
      S.pos.addScaledVector(dirVec, S.speed * dt);

      // ---- l'équipage sur le pont ----
      S.kissT = Math.max(0, S.kissT - dt);
      S.kissCd = Math.max(0, S.kissCd - dt);
      const kissing = S.kissT > 0;
      let bailPct = null; // progression de la réparation (reprise par le HUD)
      for (const c of crew) {
        c.fallT = Math.max(0, c.fallT - dt);
        const ctrl = CTRL[c.id];
        const other = crew.find((m) => m !== c);
        let moving = false, kneeling = false;
        if (c.id === S.helmId) {
          c.lx = HELM_POS.x; c.lz = HELM_POS.z;
          c.rotY = Math.PI; // face à la proue, mains sur la barre
        } else if (c.id === S.sailerId) {
          c.lx = SAIL_POS.x; c.lz = SAIL_POS.z;
          c.rotY = Math.PI; // face au mât, écoutes en main
        } else if (c.fallT === 0 && !kissing) {
          const mvx = (ctrl.right.some((k) => keys.has(k)) ? 1 : 0) - (ctrl.left.some((k) => keys.has(k)) ? 1 : 0);
          const mvz = (ctrl.down.some((k) => keys.has(k)) ? 1 : 0) - (ctrl.up.some((k) => keys.has(k)) ? 1 : 0);
          if (mvx || mvz) {
            const n = Math.hypot(mvx, mvz);
            let lx = c.lx + (mvx / n) * 4.6 * dt;
            let lz = c.lz + (mvz / n) * 4.6 * dt;
            const ell = (lx / 2.1) ** 2 + (lz / 8.6) ** 2; // reste sur le pont (les étraves du GLB remontent dès ±9)
            if (ell > 1) { const f = 1 / Math.sqrt(ell); lx *= f; lz *= f; }
            c.lx = lx; c.lz = lz;
            c.rotY = Math.atan2(mvx, mvz);
            moving = true;
          }
          // action maintenue, par priorité : réparer l'avarie proche, sinon
          // border la voile au poste, sinon écoper l'eau n'importe où
          if (keys.has(ctrl.action)) {
            let acted = false;
            for (const leak of S.leaks) {
              if (Math.hypot(leak.x - c.lx, leak.z - c.lz) < 1.6) {
                kneeling = true; acted = true;
                leak.hp -= dt;
                leak.mesh.scale.setScalar(Math.max(0.25, leak.hp / 2.2));
                bailPct = Math.max(bailPct ?? 0, 1 - leak.hp / 2.2);
                if (leak.hp <= 0) {
                  built.deck.remove(leak.mesh);
                  disposeScene(leak.mesh);
                  S.leaks = S.leaks.filter((l) => l !== leak);
                }
                break;
              }
            }
            if (!acted && S.water > 0.005) {
              kneeling = true;
              S.water = Math.max(0, S.water - 0.10 * dt);
            }
          }
        }
        if (kissing && c.fallT === 0) {
          // on se fait face, on se penche l'un vers l'autre
          c.rotY = Math.atan2(other.lx - c.lx, other.lz - c.lz);
        }
        let st = 'idle';
        if (c.fallT > 0) st = 'fall';
        else if (kissing) st = 'kiss';
        else if (c.id === S.helmId || c.id === S.sailerId) st = 'helm';
        else if (kneeling) st = 'kneel';
        else if (moving) st = 'run';
        c.member.setState(st);
        c.member.group.position.set(c.lx, 0.04 + floorAt(c.lz), c.lz);
        c.member.group.rotation.y = c.rotY;
        c.member.update(dt, t + (c.id === 'a' ? 0 : 1.7));
      }
      S.bailPct = bailPct;

      // ---- bulles de dialogue : ancrées au-dessus de la tête, sur le pont ----
      const C = S.chat;
      C.cd = Math.max(0, C.cd - dt);
      const closeTogether = crewDist() < 3.2;
      for (let i = C.bubbles.length - 1; i >= 0; i--) {
        const b = C.bubbles[i];
        const c = crew.find((m) => m.id === b.crewId);
        if (c) {
          // la réponse monte d'un cran quand les amoureux sont collés, sinon
          // les deux bulles se chevauchent
          const lift = b.delay > 0 && closeTogether ? BUBBLE_LIFT : 0;
          b.sprite.position.set(c.lx, 0.04 + floorAt(c.lz) + 2.3 + lift, c.lz);
        }
        if (!stepBubble(b, dt)) {
          built.deck.remove(b.sprite);
          b.sprite.material.map.dispose();
          b.sprite.material.dispose();
          C.bubbles.splice(i, 1);
        }
      }
      // rappels doux : une avarie qu'on laisse traîner, une cale qui se remplit
      if (S.leaks.length && bailPct === null) {
        C.leakNag += dt;
        if (C.leakNag > 5) { say('repair'); C.leakNag = -14; }
      } else C.leakNag = Math.min(C.leakNag, 0);
      if (S.water > 0.3 && bailPct === null) {
        C.waterNag += dt;
        if (C.waterNag > 4.5) { say('bail'); C.waterNag = -16; }
      } else C.waterNag = Math.min(C.waterNag, 0);

      // le rythme de la voile : une touche à jouer, une fenêtre qui se referme
      const Q = S.sailQte;
      if (S.sailerId && !S.done) {
        if (Q.slot !== null) {
          Q.timer -= dt;
          if (Q.timer <= 0) sailResolve(false); // trop tard : la voile faseye
        } else {
          Q.next -= dt;
          if (Q.next <= 0) {
            Q.slot = Math.floor(Math.random() * SAIL_SLOTS);
            Q.total = 1.5;
            Q.timer = Q.total;
          }
        }
      } else if (Q.slot !== null) Q.slot = null;
      // marqueurs holographiques : pulse doux, visibles seulement quand utiles
      helmMarker.visible = !S.helmId && !S.done;
      sailMarker.visible = !S.sailerId && !S.done;
      helmMarker.position.y = 0.04 + floorAt(HELM_POS.z);
      sailMarker.position.y = 0.04 + floorAt(SAIL_POS.z);
      for (const mk of [helmMarker, sailMarker, ...S.leaks.map((l) => l.mesh)]) {
        if (!mk.visible) continue;
        mk.userData.ring.material.opacity = 0.4 + Math.sin(t * 3.2) * 0.2;
        mk.userData.ring.scale.setScalar(1 + Math.sin(t * 3.2) * 0.1);
        mk.userData.icon.position.y = 2.4 + Math.sin(t * 2.1) * 0.15;
      }
      // l'eau ne monte QUE par les avaries ouvertes ; l'écopage est le seul
      // moyen de l'évacuer (réparer stoppe la montée, il reste à vider)
      S.water = Math.min(1, Math.max(0, S.water + S.leaks.length * 0.035 * dt));
      // nappe d'eau de cale : le niveau visible suit la jauge
      built.bilgeWater.visible = S.water > 0.02;
      if (built.bilgeWater.visible) {
        // niveau plafonné SOUS le bordé (bas au milieu du drakkar) : le
        // remplissage se lit à l'étalement et au clapot, pas à la hauteur
        built.bilgeWater.position.y = 0.02 + S.water * 0.08;
        const bw = built.bilgeWater.material.uniforms;
        bw.uTime.value = t;
        bw.uWater.value = S.water;
        bw.uOpacity.value = 0.62 + S.water * 0.25;
        const sw = 0.55 + Math.min(1, S.water * 3) * 0.35; // la flaque s'étale
        built.bilgeWater.scale.set(sw, 1, sw);
      }

      // ---- questions : dès qu'une main tient la barre ----
      if (!S.gate && !S.siren && !S.done && S.helmId && S.qIndex < WIN_SCORE) {
        S.nextQuestionIn -= dt;
        if (S.nextQuestionIn <= 0) askQuestion();
      }
      if (S.gate) {
        for (const gg of S.gate.groups) {
          for (const fm of gg.userData.flagMats || []) fm.uniforms.uTime.value = t;
        }
        const rel = S.pos.clone().sub(S.gate.origin);
        if (rel.dot(S.gate.dir) > 0) resolveGate(rel.dot(S.gate.side));
      }

      // ---- flottabilité 3 points + tangage/roulis ----
      const p = S.pos;
      const half = SHIP.length * 0.42;
      const bow = { x: p.x + dirVec.x * half, z: p.z + dirVec.z * half };
      const stern = { x: p.x - dirVec.x * half, z: p.z - dirVec.z * half };
      const side = { x: -dirVec.z, z: dirVec.x };
      const hBow = ocean.sampleHeight(bow.x, bow.z, t);
      const hStern = ocean.sampleHeight(stern.x, stern.z, t);
      const hPort = ocean.sampleHeight(p.x + side.x * SHIP.beam, p.z + side.z * SHIP.beam, t);
      const hStar = ocean.sampleHeight(p.x - side.x * SHIP.beam, p.z - side.z * SHIP.beam, t);
      boat.position.set(p.x, (hBow + hStern) * 0.5 - 0.30 - S.water * 0.35, p.z);
      boat.rotation.y = S.heading;
      const pitch = Math.atan2(hBow - hStern, half * 2);
      built.group.rotation.x = -pitch;
      built.group.rotation.z = Math.atan2(hPort - hStar, SHIP.beam * 2) * 0.9 + Math.sin(t * 0.7) * 0.02;

      if (S.speed > 3 && Math.random() < 0.6) {
        emitSpray(bow.x, hBow + 0.3, bow.z, dirVec, Math.min(1.6, S.speed / 12 + Math.max(0, pitch) * 3));
      }

      // ---- vague scélérate : une vraie crête dans le champ de hauteur (design
      // Claude « rogue waves ») — l'eau se soulève réellement, la coque monte
      // dessus, les reflets suivent. Aucun mesh plaqué.
      const W = S.wave;
      if (W.rogue && !ocean.rogues.includes(W.rogue)) W.rogue = null; // expirée
      if (!S.done && W.rogue) {
        const sd = ocean.distanceToFront(W.rogue, t, p.x, p.z); // >0 : pas encore passée
        const front = ocean.rogueFront(W.rogue, t);
        // embruns qui fument le long de la crête à l'approche
        if (sd > -25 && sd < 150 && Math.random() < 0.8) {
          const lat = (Math.random() - 0.5) * 150;
          const cx = p.x + W.rogue.dx * -sd + -W.rogue.dz * lat;
          const cz = p.z + W.rogue.dz * -sd + W.rogue.dx * lat;
          emitSpray(cx, ocean.sampleHeight(cx, cz, t) + 1.2, cz,
            { x: W.rogue.dx, z: W.rogue.dz }, 1.4 * front.fade);
        }
        if (!W.closeWarned && sd > 0 && sd < 90) {
          W.closeWarned = true;
          setFeedback('warn', '🌊 ELLE ARRIVE — ACCROCHEZ-VOUS !', 2000);
        }
        // passage de la crête sous la coque : une seule fois
        if (!W.ridden && Math.abs(sd) < W.rogue.len * 0.9) {
          W.ridden = true;
          S.shake = Math.max(S.shake, 1.5);
          S.speed *= 0.72;
          // la vague ne casse rien : elle noie le pont, à écoper
          S.water = Math.min(1, S.water + 0.35);
          knockDown();
          // 1,74 s de silence en tête du fichier (mesuré) : droit au fracas
          if (crashAudio) { crashAudio.currentTime = 1.65; crashAudio.play().catch(() => {}); }
          setFeedback('ko', '🌊 La vague noie le pont !', 2200);
        }
      } else if (!S.done) {
        W.nextIn -= dt;
        if (W.nextIn <= 0) {
          // elle arrive de l'avant, en biais — jamais pile de face (cf. design)
          const skew = (Math.random() - 0.5) * 0.7;
          const rdx = -dirVec.x * Math.cos(skew) - dirVec.z * Math.sin(skew);
          const rdz = -dirVec.z * Math.cos(skew) + dirVec.x * Math.sin(skew);
          const lead = 320 + Math.random() * 90;
          W.rogue = ocean.spawnRogue({
            x: p.x - rdx * lead, z: p.z - rdz * lead,
            dirX: rdx, dirZ: rdz,
            amp: 7.5 + Math.random() * 4.5,
            width: 85 + Math.random() * 45,
            len: 24 + Math.random() * 10,
            speed: 26 + Math.random() * 8,
            ttl: 22, ramp: 3.0, t0: t,
          });
          W.ridden = false;
          W.closeWarned = false;
          W.nextIn = 16 + Math.random() * 14;
          setFeedback('warn', `🌊 VAGUE SCÉLÉRATE ${skew > 0.12 ? 'PAR BÂBORD AVANT' : skew < -0.12 ? 'PAR TRIBORD AVANT' : 'DROIT DEVANT'} !`, 3200);
        }
      }

      // ---- arrivée : la brume se retire, les crêtes du fjord émergent ----
      if (S.done && fjord.visible && S.fjordReveal < 1) {
        S.fjordReveal = Math.min(1, S.fjordReveal + dt / 5);
        const rv = S.fjordReveal * S.fjordReveal * (3 - 2 * S.fjordReveal); // smoothstep
        for (const m of fjordLayers) m.material.opacity = m.userData.max * rv;
      }

      // ---- obstacles : recyclés devant ; un iceberg heurté COULE pour de bon
      // (il renaît plus loin) et leur nombre grimpe avec le score ----
      S.cooldown = Math.max(0, S.cooldown - dt);
      const activeObstacles = Math.min(obstacles.length, 14 + S.score * 2);
      for (let oi = 0; oi < obstacles.length; oi++) {
        const o = obstacles[oi];
        if (oi >= activeObstacles) { o.visible = false; continue; }
        if (!o.visible) { o.visible = true; recycleObstacle(o); }
        if (o.userData.sinking > 0) {
          // il sombre en tanguant, puis disparaît des flots
          o.userData.sinking -= dt;
          o.position.y = ocean.sampleHeight(o.position.x, o.position.z, t) - 0.4
            - (2.6 - o.userData.sinking) * 2.4;
          o.rotation.z += dt * 0.5;
          o.rotation.y += o.userData.spin * dt * 2;
          if (o.userData.sinking <= 0) recycleObstacle(o);
          continue;
        }
        const dx = o.position.x - p.x, dz = o.position.z - p.z;
        const ahead = dx * dirVec.x + dz * dirVec.z;
        if (Math.hypot(dx, dz) > 330 || ahead < -140) recycleObstacle(o);
        o.position.y = ocean.sampleHeight(o.position.x, o.position.z, t) - 0.4;
        o.rotation.y += o.userData.spin * dt;
        if (S.cooldown === 0 && Math.hypot(dx, dz) < o.userData.radius + SHIP.beam * 1.3) {
          S.shake = 1; S.cooldown = 1.4;
          S.speed *= 0.35;
          spawnLeak();
          knockDown();
          playRockCrash();
          o.userData.sinking = 2.6; // celui-là ne mordra plus personne
          setFeedback('ko', 'KRAK ! Avarie de coque — réparez !', 2200);
          say('iceberg', { force: true });
          S.chat.leakNag = -6; // on les laisse encaisser avant de râler sur la réparation
        }
      }
    };

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      if (phaseRef.current !== 'ready') step(dt);

      // embruns
      for (let i = 0; i < SPRAY_N; i++) {
        if (sprayLife[i] <= 0) continue;
        sprayLife[i] -= dt;
        const j = i * 3;
        sprayVel[j + 1] -= 14 * dt;
        sprayPos[j] += sprayVel[j] * dt;
        sprayPos[j + 1] += sprayVel[j + 1] * dt;
        sprayPos[j + 2] += sprayVel[j + 2] * dt;
        if (sprayLife[i] <= 0) sprayPos[j + 1] = -999;
      }
      sprayGeo.attributes.position.needsUpdate = true;

      // cœurs qui s'envolent
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i], u = h.userData;
        u.life -= dt;
        h.position.y += u.vy * dt;
        h.position.x += Math.sin(t * 3 + u.sway) * 0.6 * dt;
        h.material.opacity = Math.max(0, Math.min(1, u.life / (u.maxLife * 0.4)));
        if (u.life <= 0) {
          built.deck.remove(h);
          h.material.dispose();
          hearts.splice(i, 1);
        }
      }

      // caméra de chasse orbitale : suit le bateau, la souris tourne autour
      dirVec.set(-Math.sin(S.heading), 0, -Math.cos(S.heading));
      const hDist = Math.cos(orbit.pitch) * orbit.dist;
      const vDist = Math.sin(orbit.pitch) * orbit.dist;
      const yawT = S.heading + orbit.yaw; // yaw 0 = derrière le bateau
      const desired = new THREE.Vector3(
        S.pos.x + Math.sin(yawT) * hDist, boat.position.y + vDist, S.pos.z + Math.cos(yawT) * hDist,
      );
      camPos.lerp(desired, 1 - Math.pow(0.0016, dt));
      S.shake = Math.max(0, S.shake - dt * 2.2);
      camera.position.copy(camPos);
      if (S.shake > 0) {
        camera.position.x += (Math.random() - 0.5) * S.shake * 1.6;
        camera.position.y += (Math.random() - 0.5) * S.shake * 1.2;
      }
      // en orbitant, le regard glisse du point de visée avant vers le drakkar
      const orbitMix = Math.min(1, Math.abs(orbit.yaw) / 1.0);
      camTarget.set(
        S.pos.x + dirVec.x * cam.aheadLook * (1 - orbitMix),
        boat.position.y + cam.lookY + orbitMix * 2,
        S.pos.z + dirVec.z * cam.aheadLook * (1 - orbitMix),
      );
      camera.lookAt(camTarget);
      sky.position.copy(camera.position);
      sky.material.uniforms.uTime.value = t;

      // ---- aube ↔ nuit : toutes les couleurs glissent en douceur ----
      const day = S.dayOverride ?? (0.5 + 0.5 * Math.cos((2 * Math.PI * t) / DAY_CYCLE));
      S.day = day;
      sky.material.uniforms.uDay.value = day;
      sky.material.uniforms.uTop.value.lerpColors(PAL.night.top, PAL.dawn.top, day);
      sky.material.uniforms.uHorizon.value.lerpColors(PAL.night.horizon, PAL.dawn.horizon, day);
      // le soleil se lève avec le jour, la lune se couche — et la lumière
      // directionnelle + les reflets de l'océan suivent l'astre dominant
      sunDirNow.set(-0.4, -0.10 + day * 0.46, -1).normalize();
      moonDirNow.set(0.55, 0.46 - day * 0.54, 0.62).normalize();
      sky.material.uniforms.uSunDir.value.copy(sunDirNow);
      sky.material.uniforms.uMoonDir.value.copy(moonDirNow);
      lightDirNow.copy(moonDirNow).lerp(sunDirNow, day).normalize();
      ocean.uniforms.uSunDir.value.copy(lightDirNow);
      moon.position.copy(lightDirNow).multiplyScalar(200);
      hemi.color.lerpColors(PAL.night.hemiSky, PAL.dawn.hemiSky, day);
      hemi.groundColor.lerpColors(PAL.night.hemiGround, PAL.dawn.hemiGround, day);
      hemi.intensity = 1.15 + day * 0.35;
      moon.color.lerpColors(PAL.night.moon, PAL.dawn.moon, day);
      moon.intensity = 1.25 + day * 0.4;
      ocean.uniforms.uDeep.value.lerpColors(PAL.night.deep, PAL.dawn.deep, day);
      ocean.uniforms.uShallow.value.lerpColors(PAL.night.shallow, PAL.dawn.shallow, day);
      ocean.uniforms.uSkyTint.value.lerpColors(PAL.night.skyTint, PAL.dawn.skyTint, day);
      ocean.uniforms.uSunCol.value.lerpColors(PAL.night.moon, PAL.dawn.moon, day);
      ocean.uniforms.uFogCol.value.lerpColors(PAL.night.fog, PAL.dawn.fog, day);
      // la brume se dissipe à l'aube… et se retire tout à fait devant le fjord
      ocean.uniforms.uFogDensity.value = (0.0026 - day * 0.0005) * (1 - 0.45 * S.fjordReveal);
      renderer.toneMappingExposure = 1.35 + day * 0.15;
      if (lantern) lantern.intensity = 30 * (1 - day * 0.85);

      ocean.update(t, S.pos, camera.position);
      renderer.render(scene, camera);

      if (++hudTick % 6 === 0) {
        const fb = (S.feedback && performance.now() < S.feedback.until) ? S.feedback : null;
        // indication contextuelle : barre à prendre > fuite à écoper > bisou
        let hint = null;
        if (!S.done && phaseRef.current === 'run') {
          const freeCrew = crew.find((c) => c.id !== S.helmId && c.fallT === 0);
          const nearHelm = !S.helmId && crew.find((c) => c.fallT === 0 && Math.hypot(c.lx - HELM_POS.x, c.lz - HELM_POS.z) < 2.3);
          const nearLeak = crew.find((c) => c.id !== S.helmId && c.fallT === 0
            && S.leaks.some((l) => Math.hypot(l.x - c.lx, l.z - c.lz) < 1.6));
          const nearSail = !S.sailerId && crew.find((c) => c.id !== S.helmId && c.id !== S.sailerId && c.fallT === 0
            && Math.hypot(c.lx - SAIL_POS.x, c.lz - SAIL_POS.z) < 1.8);
          if (nearHelm) hint = { icon: '🧭', text: 'prends la barre', key: CTRL[nearHelm.id].actName };
          else if (nearLeak) hint = { icon: '🔧', text: 'maintiens pour réparer', key: CTRL[nearLeak.id].actName };
          else if (nearSail) hint = { icon: '⛵', text: 'prends le poste de voile', key: CTRL[nearSail.id].actName };
          else if (S.water > 0.12 && freeCrew && S.bailPct === null) hint = { icon: '🪣', text: "maintiens pour écoper l'eau", key: CTRL[freeCrew.id].actName };
          else if (S.kissT <= 0 && S.kissCd <= 0 && crewDist() < 2.4) hint = { icon: '💞', text: 'un petit bisou ?', key: 'ESPACE' };
        }
        setHud({
          item: (S.gate && !S.siren) ? S.currentItem : null,
          siren: S.siren ? { typed: S.siren.typed, hasAudio: !!sirenAudio } : null,
          score: S.score, water: S.water, feedback: fb,
          helmId: S.helmId, sailerId: S.sailerId, hint,
          boost: S.boost, bailPct: S.bailPct,
          qte: S.sailerId ? {
            // la touche affichée dépend de la moitié de clavier tenue
            key: S.sailQte.slot === null ? null : SAIL_LABELS[S.sailerId][S.sailQte.slot],
            frac: S.sailQte.slot !== null ? S.sailQte.timer / S.sailQte.total : 0,
            fb: performance.now() < S.sailQte.fbUntil ? S.sailQte.fb : null,
          } : null,
          reveal: S.fjordReveal,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      for (const iv of fadeIvs) clearInterval(iv);
      clearTimeout(rockStopTimer);
      for (const a of [sirenAudio, oceanAudio, musicAudio, crashAudio, rockAudio]) {
        if (a) { a.pause(); a.src = ''; }
      }
      clearGate();
      disposeScene(scene);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = {
    border: '2px solid #1c2c4a', borderRadius: 12, background: 'rgba(6,10,22,.82)',
    padding: '12px 16px', fontFamily: FONT_MONO, fontSize: 18, color: '#9fd8ff', lineHeight: 1.4,
  };
  const key = {
    display: 'inline-block', minWidth: 26, padding: '1px 7px', margin: '0 2px', borderRadius: 6,
    border: '2px solid #5EE0A0', color: '#5EE0A0', fontFamily: FONT_MONO, fontSize: 17, textAlign: 'center',
  };
  const fbColor = { ok: '#5EE0A0', ko: '#ff9a7a', warn: '#ffd27a' };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* progression (futhark) + question en cours */}
      <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', width: 'min(760px, 86vw)', textAlign: 'center', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          {FUTHARK.map((r, i) => (
            <span key={i} style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: i < hud.score ? '#5EE0A0' : 'rgba(159,216,255,.25)',
              textShadow: i < hud.score ? '0 0 12px rgba(94,224,160,.8)' : 'none' }}>{r}</span>
          ))}
        </div>
        {hud.item && phase === 'run' && (
          <div style={{ ...card, display: 'inline-block', padding: '10px 24px', fontFamily: FONT_DISPLAY, fontSize: 20, color: '#eafff4' }}>
            {hud.item.q}
            <div style={{ fontFamily: FONT_MONO, fontSize: 15, color: '#7aa8d8', marginTop: 4 }}>
              {hud.item.type === 'flag' ? 'passe sous le bon drapeau' : 'passe entre les pierres de la bonne réponse'}
            </div>
          </div>
        )}
        {hud.siren && phase === 'run' && (
          <div style={{ ...card, display: 'inline-block', padding: '12px 26px', borderColor: '#8a5aa8' }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, color: '#e8c8ff', textShadow: '0 0 16px rgba(180,120,255,.6)' }}>
              🧜‍♀️ DES SIRÈNES ! La barre ne répond plus…
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 17, color: '#c8a8e8', marginTop: 6 }}>
              Brisez le charme : tapez le nom de la chanteuse — ou de sa chanson.
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 24, letterSpacing: 4, color: '#eafff4', marginTop: 8, minHeight: 28 }}>
              {hud.siren.typed.toUpperCase()}<span style={{ animation: 'nl-twinkle 1s step-end infinite' }}>▍</span>
            </div>
          </div>
        )}
        {hud.feedback && (
          <div style={{ marginTop: 10, fontFamily: FONT_DISPLAY, fontSize: 24, letterSpacing: 1,
            color: fbColor[hud.feedback.kind] || '#9fd8ff',
            textShadow: `0 0 18px ${fbColor[hud.feedback.kind] || '#9fd8ff'}` }}>
            {hud.feedback.text}
          </div>
        )}
      </div>

      {/* jauges (vent / eau / colmatage) + indication contextuelle */}
      {phase === 'run' && (
        <div style={{ position: 'absolute', bottom: 76, left: '50%', transform: 'translateX(-50%)', width: 320, textAlign: 'center', pointerEvents: 'none' }}>
          {hud.qte && (
            <div style={{ marginBottom: 10, minHeight: 64 }}>
              {hud.qte.key ? (
                <>
                  <div style={{ display: 'inline-block', minWidth: 46, padding: '7px 15px', borderRadius: 10,
                    border: '3px solid #5EE0A0', fontFamily: FONT_DISPLAY, fontSize: 30, color: '#eafff4',
                    background: 'rgba(6,10,22,.85)', boxShadow: '0 0 18px rgba(94,224,160,.55)' }}>
                    {hud.qte.key.toUpperCase()}
                  </div>
                  <div style={{ height: 5, width: 130, margin: '6px auto 0', borderRadius: 3, background: 'rgba(6,10,22,.8)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(hud.qte.frac * 100)}%`, background: '#5EE0A0' }} />
                  </div>
                </>
              ) : hud.qte.fb ? (
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, paddingTop: 14,
                  color: hud.qte.fb === 'hit' ? '#5EE0A0' : '#ff9a7a' }}>
                  {hud.qte.fb === 'hit' ? '✔ La voile se gonfle !' : '✘ La voile faseye…'}
                </div>
              ) : null}
            </div>
          )}
          <div style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 2, color: hud.sailerId || hud.boost > 0.65 ? '#5EE0A0' : '#7aa8d8', marginBottom: 3 }}>
            💨 VENT {hud.sailerId ? '— ⛵ VOILE TENUE' : hud.boost > 0.9 ? '— PLEINE VOILE !' : ''}
          </div>
          <div style={{ height: 8, borderRadius: 4, border: '2px solid #1c2c4a', background: 'rgba(6,10,22,.8)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${Math.round(hud.boost * 100)}%`, transition: 'width .3s linear',
              background: 'linear-gradient(90deg,#1d8a6a,#5EE0A0)' }} />
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 15, letterSpacing: 2, color: hud.water > 0.6 ? '#ff9a7a' : '#7aa8d8', marginBottom: 3 }}>
            EAU EMBARQUÉE {hud.water > 0.6 ? '— LE DRAKKAR SE TRAÎNE !' : ''}
          </div>
          <div style={{ height: 8, borderRadius: 4, border: '2px solid #1c2c4a', background: 'rgba(6,10,22,.8)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(hud.water * 100)}%`, transition: 'width .3s linear',
              background: hud.water > 0.6 ? 'linear-gradient(90deg,#a85a2e,#ff9a7a)' : 'linear-gradient(90deg,#1d5a8a,#5EB8E0)' }} />
          </div>
          {hud.bailPct !== null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, letterSpacing: 2, color: '#5EE0A0', marginBottom: 3 }}>
                🔧 RÉPARATION…
              </div>
              <div style={{ height: 8, borderRadius: 4, border: '2px solid #2a5a3a', background: 'rgba(6,10,22,.8)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(hud.bailPct * 100)}%`,
                  background: 'linear-gradient(90deg,#2a8a4a,#5EE0A0)', boxShadow: '0 0 8px rgba(94,224,160,.7)' }} />
              </div>
            </div>
          )}
          {hud.hint && (
            <div style={{ marginTop: 8, fontFamily: FONT_DISPLAY, fontSize: 17, color: '#5EE0A0', animation: 'nl-twinkle 1s ease-in-out infinite' }}>
              {hud.hint.icon} <span style={key}>{hud.hint.key}</span> {hud.hint.text}
            </div>
          )}
        </div>
      )}

      {/* les deux joueurs (le rôle suit qui a pris la barre) */}
      {phase === 'run' && (
        <>
          <div style={{ ...card, position: 'absolute', left: 18, bottom: 16, pointerEvents: 'none' }}>
            {hud.helmId === 'a' ? <>🧭 À LA BARRE<br /><span style={key}>Q</span><span style={key}>D</span> vire de bord</>
              : hud.sailerId === 'a' ? <>⛵ À LA VOILE<br /><span style={key}>W</span><span style={key}>X</span><span style={key}>C</span><span style={key}>V</span> en rythme · <span style={key}>E</span> quitte</>
                : <>🎮 CLAVIER GAUCHE<br /><span style={key}>Z</span><span style={key}>Q</span><span style={key}>S</span><span style={key}>D</span> bouge · <span style={key}>E</span> agit</>}
          </div>
          <div style={{ ...card, position: 'absolute', right: 18, bottom: 16, textAlign: 'right', pointerEvents: 'none' }}>
            {hud.helmId === 'b' ? <>🧭 À LA BARRE<br /><span style={key}>←</span><span style={key}>→</span> vire de bord</>
              : hud.sailerId === 'b' ? <>⛵ À LA VOILE<br /><span style={key}>1</span><span style={key}>2</span><span style={key}>3</span><span style={key}>4</span> du pavé num. en rythme · <span style={key}>↵</span> quitte</>
                : <>🎮 CLAVIER DROIT<br /><span style={key}>←</span><span style={key}>↑</span><span style={key}>↓</span><span style={key}>→</span> bouge · <span style={key}>↵</span> agit</>}
          </div>
        </>
      )}

      {/* briefing d'embarquement : un panneau par rôle, le commun autour */}
      {phase === 'ready' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(4,7,15,.45)' }}>
          <div style={{ ...card, maxWidth: 880, padding: '22px 28px', textAlign: 'center' }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, color: '#eafff4', letterSpacing: 1, marginBottom: 10 }}>
              ⛵ LA TRAVERSÉE — À DEUX
            </div>
            <div style={{ fontSize: 19, marginBottom: 14 }}>
              Vous embarquez <strong>ensemble</strong>. Joueur clavier gauche :
              {' '}<span style={key}>Z</span><span style={key}>Q</span><span style={key}>S</span><span style={key}>D</span> + <span style={key}>E</span> ·
              joueur clavier droit : <span style={key}>←</span><span style={key}>↑</span><span style={key}>↓</span><span style={key}>→</span> + <span style={key}>↵</span>.
              Rejoignez les <strong style={{ color: '#5EE0A0' }}>marqueurs lumineux</strong> pour choisir vos rôles — échangeables à tout moment.
            </div>

            <div style={{ display: 'flex', gap: 14, textAlign: 'left', alignItems: 'stretch' }}>
              <div style={{ flex: 1, border: '2px solid #24405e', borderRadius: 10, padding: '12px 16px', background: 'rgba(10,18,36,.6)' }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: '#9fd8ff', marginBottom: 8 }}>
                  🧭 LE BARREUR / LA BARREUSE
                </div>
                <div style={{ fontSize: 18, lineHeight: 1.45 }}>
                  Prend la <strong>barre à la poupe</strong> avec sa touche d'action, puis vire de bord
                  avec ses touches gauche / droite.<br />
                  ❓ Fait passer le drakkar <strong>par la bonne réponse</strong>, entre les rochers.<br />
                  🧊 Évite les icebergs — chaque choc ouvre une avarie.
                </div>
              </div>
              <div style={{ flex: 1, border: '2px solid #2a4a3a', borderRadius: 10, padding: '12px 16px', background: 'rgba(10,26,22,.6)' }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: '#5EE0A0', marginBottom: 8 }}>
                  ⛵ L'ÉQUIPAGE DU PONT
                </div>
                <div style={{ fontSize: 18, lineHeight: 1.45 }}>
                  Au <strong>poste de voile</strong> (action pour entrer / sortir) : appuie au bon
                  moment sur {' '}<span style={key}>W</span><span style={key}>X</span><span style={key}>C</span><span style={key}>V</span> (clavier
                  gauche) ou <span style={key}>1</span><span style={key}>2</span><span style={key}>3</span><span style={key}>4</span> du
                  pavé numérique (clavier droit) — réussi, ça <strong>accélère</strong> ; raté, ça ralentit.<br />
                  🔧 <strong>Répare</strong> les avaries (action maintenue), sinon l'eau monte.<br />
                  🪣 <strong>Écope</strong> l'eau embarquée, qui freine le drakkar.
                </div>
              </div>
            </div>

            <div style={{ fontSize: 17, marginTop: 12, color: '#9fd8ff' }}>
              💨 Les courants de vent lumineux rechargent la voile · 🖱 souris : tourner la caméra, molette : zoomer
            </div>
            <div style={{ fontSize: 18, marginTop: 8, color: '#7aa8d8' }}>
              {WIN_SCORE} bonnes réponses et le fjord est à vous.
              <span style={{ color: '#c8a0d8' }}> (tout près l'un de l'autre… <span style={key}>ESPACE</span> 💞)</span>
            </div>
            <div style={{ marginTop: 14, fontFamily: FONT_DISPLAY, fontSize: 16, color: '#5EE0A0', animation: 'nl-twinkle 1.6s ease-in-out infinite' }}>
              ESPACE pour larguer les amarres
            </div>
          </div>
        </div>
      )}

      {/* arrivée : l'inscription s'allume dans le ciel une fois la brume
          retirée (style du handoff Claude Design). Le seul mot à rapporter est
          le LIEU que désignent les coordonnées : l'eyebrow ne porte donc que
          de la ponctuation runique. Y remettre un mot lisible (ce fut le cas
          de ᚹᚨᛚᚲᛃᚱᛁᛖ) crée une fausse piste — le site attend six runes
          composées sur la plaque, pas ce qui est écrit ici. */}
      {phase === 'done' && (
        <div className={`nl-victory ${hud.reveal > 0.55 ? 'on' : ''}`}>
          <div className="nl-victory-halo" />
          <div className="nl-victory-inscription">
            <div className="nl-victory-runes" aria-hidden="true">᛫ ᛬ ᛭ ᛬ ᛫</div>
            <h2>Terre en vue</h2>
            <p className="nl-victory-word">60.3913<span>᛭</span>5.3221</p>
            <p className="nl-victory-sub">Il n'y a plus qu'à aller voir où nous sommes.</p>
          </div>
        </div>
      )}
    </div>
  );
}
