/**
 * Nordlys — l'équipage du drakkar : Amandine & Clément.
 *
 * Deux membres d'équipage pilotables (un par moitié de clavier). Chacun est :
 *  · soit un vrai modèle GLB animé, déposé dans `src/assets/nordlys/`
 *    (`amandine.glb`, `clement.glb`) — auto-détecté, redimensionné à ~1,75 m,
 *    animations mappées par nom de clip (courir / chuter / s'agenouiller / idle
 *    / bisou, tolérant FR & EN & noms Mixamo) ;
 *  · soit, en attendant les fichiers, un viking procédural de secours
 *    (variante « amandine » : nattes blondes, tunique lie-de-vin ; variante
 *    « clement » : barbe rousse, tunique verte).
 *
 * API unifiée : createCrewMember({ who }) → { group, setState, update, dispose }.
 * États d'animation : 'idle' | 'run' | 'kneel' | 'fall' | 'helm' | 'kiss'.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Tous les assets du dossier (la jaquette y vit aussi) — on filtre les .glb.
const ASSET_URLS = import.meta.glob('../../../../assets/nordlys/*', {
  eager: true, query: '?url', import: 'default',
});

// Les GLB sont compressés meshopt (EXT_meshopt_compression) — décodeur requis.
export function makeLoader() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export function glbUrl(name) {
  const hit = Object.entries(ASSET_URLS).find(([p]) => {
    const f = p.split('/').pop().toLowerCase();
    return f.endsWith('.glb') && f.includes(name);
  });
  return hit ? hit[1] : null;
}
export const crewModelUrl = glbUrl;

// Mapping tolérant nom de clip → état (Mixamo, exports FR, etc.).
const CLIP_PATTERNS = {
  run: /run|course|cour|jog|sprint/i,
  fall: /fall|chut|trip|stumble|knock|hit|death|ko/i,
  kneel: /kneel|agenou|crouch|scoop|ramass|bail|ecop|écop|gather|pick/i,
  kiss: /kiss|bisou|embrass|hug|calin|câlin/i,
  idle: /idle|repos|stand|attente|breath/i,
};

// ---- viking procédural de secours ------------------------------------------
const SKIN = new THREE.MeshStandardMaterial({ color: '#e8c39a', roughness: 0.8 });

function buildFallbackViking(who) {
  const isAmandine = who === 'amandine';
  const g = new THREE.Group();
  const tunic = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.42, 0.9, 10),
    new THREE.MeshStandardMaterial({ color: isAmandine ? '#8f2f4a' : '#2e5e4e', roughness: 0.85 }),
  );
  tunic.position.y = 0.55;
  g.add(tunic);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), SKIN);
  head.position.y = 1.28;
  g.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: '#7a828a', roughness: 0.4, metalness: 0.5 }),
  );
  helmet.position.y = 1.34;
  g.add(helmet);
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.3, 6),
      new THREE.MeshStandardMaterial({ color: '#d9cdb4', roughness: 0.6 }),
    );
    horn.position.set(s * 0.26, 1.45, 0);
    horn.rotation.z = -s * 0.9;
    g.add(horn);
  }
  if (isAmandine) {
    // deux nattes blondes qui dépassent du casque
    const hairMat = new THREE.MeshStandardMaterial({ color: '#d8b04a', roughness: 0.75 });
    for (const s of [-1, 1]) {
      const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.03, 0.62, 6), hairMat);
      braid.position.set(s * 0.24, 1.02, -0.12);
      braid.rotation.z = s * 0.22;
      g.add(braid);
    }
  } else {
    // barbe rousse de circonstance
    const beard = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.34, 8),
      new THREE.MeshStandardMaterial({ color: '#a4552c', roughness: 0.85 }),
    );
    beard.position.set(0, 1.08, 0.16);
    beard.rotation.x = Math.PI;
    g.add(beard);
  }
  // seau d'écopage à la main (tout le monde peut écoper)
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.10, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: '#4b331f', roughness: 0.9 }),
  );
  bucket.position.set(0.4, 0.45, 0);
  g.add(bucket);
  return g;
}

// ---- membre d'équipage : API unifiée GLB / fallback -------------------------
export function createCrewMember({ who }) {
  const group = new THREE.Group();
  let fallback = buildFallbackViking(who);
  group.add(fallback);

  let mixer = null;
  let actions = {};        // état → THREE.AnimationAction
  let current = 'idle';
  let currentAction = null;
  // pose procédurale du fallback, lissée vers la cible de l'état courant
  const pose = { rotX: 0, y: 0 };

  const url = crewModelUrl(who);
  if (url) {
    makeLoader().load(url, (gltf) => {
      const model = gltf.scene;
      // Meshy recopie la texture de base en émissif : en nuit polaire, les
      // personnages luiraient comme des lanternes — on coupe l'émission.
      model.traverse((o) => {
        if (o.isMesh && o.material) {
          // un filet d'émission pour rester lisible en pleine nuit, sans luire
          o.material.emissiveIntensity = 0.22;
          o.frustumCulled = false; // mesh skinné : bbox au repos fausse une fois animé
        }
      });
      // normalise : ~1,75 m de haut, pieds posés à y=0
      const box = new THREE.Box3().setFromObject(model);
      const h = Math.max(box.max.y - box.min.y, 0.01);
      const s = 1.75 / h;
      // Les clips Meshy embarquent la translation du bassin (root motion) : en
      // boucle, le personnage glisse d'un mètre puis « snap » à sa place. On
      // fige le X/Z de tout track de position qui dérive vraiment — le jeu
      // pilote la position via le group, les animations font du surplace.
      for (const clip of gltf.animations) {
        for (const track of clip.tracks) {
          if (!track.name.endsWith('.position')) continue;
          const v = track.values;
          const x0 = v[0], z0 = v[2];
          let drift = 0;
          for (let i = 0; i < v.length; i += 3) {
            drift = Math.max(drift, Math.abs(v[i] - x0), Math.abs(v[i + 2] - z0));
          }
          if (drift < h * 0.03) continue; // simple balancement : on garde
          for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
        }
      }
      model.scale.setScalar(s);
      model.position.y = -box.min.y * s;
      if (fallback) {
        group.remove(fallback);
        disposeObject(fallback);
        fallback = null;
      }
      group.add(model);
      mixer = new THREE.AnimationMixer(model);
      for (const [state, re] of Object.entries(CLIP_PATTERNS)) {
        const clip = gltf.animations.find((c) => re.test(c.name));
        if (!clip) continue;
        const a = mixer.clipAction(clip);
        if (state === 'fall' || state === 'kiss') {
          a.setLoop(THREE.LoopOnce);
          a.clampWhenFinished = true;
        }
        actions[state] = a;
      }
      if (actions.kneel) {
        // écopage/réparation : on ne garde que la DESCENTE du clip (le clip
        // Meshy se relève et finit debout), jouée en ping-pong → le personnage
        // s'abaisse et se redresse en boucle, sans saut de pose
        const src = actions.kneel.getClip();
        const frames = Math.max(2, Math.floor(src.duration * 30 * 0.55));
        const bend = THREE.AnimationUtils.subclip(src, 'kneelLoop', 0, frames, 30);
        const a = mixer.clipAction(bend);
        a.setLoop(THREE.LoopPingPong, Infinity);
        actions.kneel = a;
      }
      playAction(current);
    }, undefined, () => { /* fichier illisible → on garde le fallback */ });
  }

  function playAction(state) {
    if (!mixer) return;
    // repli raisonnable si le clip manque : les états calmes (barre, bisou)
    // retombent sur idle, les autres sur run
    const calm = state === 'helm' || state === 'kiss' || state === 'idle';
    const a = actions[state] || (calm ? actions.idle : actions.run) || actions.idle || actions.run;
    if (!a || a === currentAction) return;
    a.timeScale = 1; // les persos ont une vraie anim d'attente (Long Breathe)
    if (currentAction) currentAction.fadeOut(0.18);
    a.reset().fadeIn(0.18).play();
    currentAction = a;
  }

  function setState(state) {
    if (state === current) return;
    current = state;
    playAction(state);
  }

  function update(dt, t) {
    if (mixer) { mixer.update(dt); return; }
    if (!fallback) return;
    // animations « à la main » du viking de secours
    let targetRotX = 0, targetY = 0, bob = Math.sin(t * 2) * 0.02;
    if (current === 'run') { targetRotX = 0.12; bob = Math.abs(Math.sin(t * 9)) * 0.07; }
    else if (current === 'kneel') { targetRotX = 0.55; targetY = -0.34; bob = 0; }
    else if (current === 'fall') { targetRotX = -1.45; targetY = 0.14; bob = 0; }
    else if (current === 'kiss') { targetRotX = 0.28; bob = Math.sin(t * 6) * 0.02; }
    const k = Math.min(1, dt * 9);
    pose.rotX += (targetRotX - pose.rotX) * k;
    pose.y += (targetY - pose.y) * k;
    fallback.rotation.x = pose.rotX;
    fallback.position.y = pose.y + bob;
  }

  function dispose() {
    disposeObject(group);
  }

  return { group, setState, update, dispose, get state() { return current; } };
}

function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}
