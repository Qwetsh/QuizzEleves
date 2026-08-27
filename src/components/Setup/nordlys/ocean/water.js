// Ocean model — sum of Gerstner waves, shared by the GPU (shader) and the CPU (buoyancy).
// Reusable: createOcean(opts) -> { mesh, params, sampleHeight(x,z,t), sampleNormal(x,z,t), update(t, focus) }
import * as THREE from 'three';

// dirX, dirZ, amplitude (m), wavelength (m) — long swell first, ripples last
export const WAVES = [
  new THREE.Vector4( 1.00,  0.18, 0.95, 74),
  new THREE.Vector4( 0.72, -0.62, 0.55, 43),
  new THREE.Vector4(-0.32,  0.94, 0.30, 25),
  new THREE.Vector4( 0.88,  0.47, 0.16, 13),
  new THREE.Vector4(-0.80, -0.55, 0.08, 7.0),
].map(w => {
  const l = Math.hypot(w.x, w.y);
  w.x /= l; w.y /= l;
  return w;
});

const G = 9.81;
const ROGUE_N = 2;                      // vagues scélérates simultanées

// Une vague scélérate = crête gaussienne mobile, avec creux devant et derrière.
// Même formule côté GPU (rogueH en GLSL) et côté CPU, donc la coque monte
// exactement sur la crête qu'on voit à l'écran.
function rogueAt(r, x, z, t) {
  const age = t - r.t0;
  if (age < 0 || age > r.ttl) return 0;
  const fade = Math.min(1, age / r.ramp) * Math.min(1, (r.ttl - age) / r.ramp);
  const rx = x - r.ox, rz = z - r.oz;
  const s = rx * r.dx + rz * r.dz - age * r.speed;
  const l = -rx * r.dz + rz * r.dx;
  if (Math.abs(s) > r.len * 4 || Math.abs(l) > r.width * 3) return 0;
  const envL = Math.exp(-Math.pow(l / r.width, 2));
  const crest = Math.exp(-Math.pow(s / r.len, 2));
  const trough = Math.exp(-Math.pow((Math.abs(s) - 2.1 * r.len) / (1.1 * r.len), 2));
  return r.amp * fade * envL * (crest - 0.42 * trough);
}

export function makeSampler(params, rogues) {
  return function sampleHeight(x, z, t) {
    let y = 0;
    for (const w of WAVES) {
      const amp = w.z * params.amp;
      const k = (Math.PI * 2) / w.w;
      const c = Math.sqrt(G / k) * params.speed;
      y += amp * Math.sin(k * (w.x * x + w.y * z - c * t));
    }
    if (rogues) for (const r of rogues) y += rogueAt(r, x, z, t);
    return y;
  };
}

const VERT = /* glsl */`
#define NW ${WAVES.length}
#define NR ${ROGUE_N}
uniform float uTime, uAmp, uChop, uSpeed;
uniform vec4 uWaves[NW];
uniform vec4 uRogueA[NR];   // dirX, dirZ, amp*fade, width
uniform vec4 uRogueB[NR];   // origX, origZ, travel, len
varying vec3 vN;
varying vec3 vW;
varying float vFoam;
float rogueH(vec2 xy, out float breakFoam) {
  float h = 0.0;
  breakFoam = 0.0;
  for (int i = 0; i < NR; i++) {
    float amp = uRogueA[i].z;
    if (amp <= 0.0001) continue;
    vec2 d = uRogueA[i].xy;
    vec2 rel = xy - uRogueB[i].xy;
    float s = dot(rel, d) - uRogueB[i].z;
    float l = dot(rel, vec2(-d.y, d.x));
    float len = uRogueB[i].w, w = uRogueA[i].w;
    float envL = exp(-pow(l / w, 2.0));
    float crest = exp(-pow(s / len, 2.0));
    float trough = exp(-pow((abs(s) - 2.1 * len) / (1.1 * len), 2.0));
    h += amp * envL * (crest - 0.42 * trough);
    breakFoam = max(breakFoam, envL * exp(-pow((s + len * 0.25) / (len * 0.38), 2.0)) * clamp(amp / 9.0, 0.0, 0.8));
  }
  return h;
}
void main() {
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 p = wp;
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  float crest = 0.0, ampSum = 0.0;
  for (int i = 0; i < NW; i++) {
    vec2 d = uWaves[i].xy;
    float amp = max(uWaves[i].z * uAmp, 0.0005);
    float k = 6.2831853 / uWaves[i].w;
    float c = sqrt(9.81 / k) * uSpeed;
    float f = k * (dot(d, wp.xz) - c * uTime);
    float sf = sin(f), cf = cos(f);
    float q = uChop / (k * amp * float(NW));
    p.x += q * amp * d.x * cf;
    p.z += q * amp * d.y * cf;
    p.y += amp * sf;
    float ka = k * amp;
    tangent  += vec3(-q * ka * d.x * d.x * sf, d.x * ka * cf, -q * ka * d.x * d.y * sf);
    binormal += vec3(-q * ka * d.x * d.y * sf, d.y * ka * cf, -q * ka * d.y * d.y * sf);
    crest += amp * sf;
    ampSum += amp;
  }
  float bf, bfx, bfz;
  float rh = rogueH(wp.xz, bf);
  if (abs(rh) > 0.0001 || bf > 0.0001) {
    float e = 2.5;
    float rhx = rogueH(wp.xz + vec2(e, 0.0), bfx);
    float rhz = rogueH(wp.xz + vec2(0.0, e), bfz);
    p.y += rh;
    vec3 rt = normalize(vec3(e, rhx - rh, 0.0));
    vec3 rb = normalize(vec3(0.0, rhz - rh, e));
    tangent = normalize(tangent) + rt;
    binormal = normalize(binormal) + rb;
  }
  vN = normalize(cross(binormal, tangent));
  vW = p;
  vFoam = smoothstep(0.62, 1.0, crest / max(ampSum, 0.001)) + bf * 0.55;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */`
precision highp float;
uniform vec3 uDeep, uShallow, uSkyTint, uSunCol, uFogCol, uSunDir, uCam;
uniform float uFogDensity, uFoamAmount;
varying vec3 vN;
varying vec3 vW;
varying float vFoam;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(uCam - vW);
  float fres = 0.04 + 0.9 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  float lift = clamp(vW.y * 0.35 + 0.5, 0.0, 1.0);
  vec3 body = mix(uDeep, uShallow, lift * 0.85);
  vec3 h = normalize(uSunDir + v);
  float sd = max(dot(n, h), 0.0);
  float spec = pow(sd, 260.0) * 1.6 + pow(sd, 26.0) * 0.14;
  vec3 col = mix(body, uSkyTint, fres) + uSunCol * spec;
  float grain = noise(vW.xz * 1.7) * 0.6 + noise(vW.xz * 6.0) * 0.4;
  float foam = clamp(vFoam * (0.45 + grain * 0.9), 0.0, 1.0) * uFoamAmount;
  col = mix(col, vec3(0.90, 0.945, 0.95), foam);
  float d = length(uCam - vW);
  col = mix(col, uFogCol, 1.0 - exp(-pow(d * uFogDensity, 2.0)));
  gl_FragColor = vec4(col, 1.0);
}`;

export function createOcean(opts = {}) {
  const size = opts.size ?? 900;
  const seg = opts.segments ?? 300;
  const params = { amp: 1.0, chop: 0.85, speed: 1.0, foam: 1.0 };
  const rogues = [];

  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: params.amp },
    uChop: { value: params.chop },
    uSpeed: { value: params.speed },
    uWaves: { value: WAVES },
    uDeep: { value: new THREE.Color('#061a26') },
    uShallow: { value: new THREE.Color('#175468') },
    uSkyTint: { value: new THREE.Color('#8ea7b4') },
    uSunCol: { value: new THREE.Color('#ffe9c9') },
    uFogCol: { value: new THREE.Color('#9fb4bd') },
    uSunDir: { value: new THREE.Vector3(-0.35, 0.30, -1).normalize() },
    uCam: { value: new THREE.Vector3() },
    uFogDensity: { value: 0.0034 },
    uFoamAmount: { value: 1.0 },
    uRogueA: { value: Array.from({ length: ROGUE_N }, () => new THREE.Vector4()) },
    uRogueB: { value: Array.from({ length: ROGUE_N }, () => new THREE.Vector4()) },
  };

  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms,
  }));
  mesh.name = 'ocean';
  mesh.frustumCulled = false;

  const step = size / seg;
  const sampleHeight = makeSampler(params, rogues);

  // spawnRogue({x, z, dirX, dirZ, amp, width, len, speed, ttl})
  function spawnRogue(o) {
    const d = new THREE.Vector2(o.dirX ?? 0, o.dirZ ?? -1).normalize();
    const r = {
      ox: o.x ?? 0, oz: o.z ?? 0, dx: d.x, dz: d.y,
      amp: o.amp ?? 9, width: o.width ?? 90, len: o.len ?? 26,
      speed: o.speed ?? 22, ttl: o.ttl ?? 16, ramp: o.ramp ?? 2.2, t0: o.t0 ?? 0,
    };
    if (rogues.length >= ROGUE_N) rogues.shift();
    rogues.push(r);
    return r;
  }

  // crête d'une scélérate : position et distance signée pour le HUD / les embruns
  function rogueFront(r, t) {
    const age = t - r.t0;
    return {
      x: r.ox + r.dx * age * r.speed,
      z: r.oz + r.dz * age * r.speed,
      age,
      fade: Math.min(1, age / r.ramp) * Math.min(1, Math.max(0, r.ttl - age) / r.ramp),
    };
  }

  function distanceToFront(r, t, x, z) {
    const age = t - r.t0;
    return (x - r.ox) * r.dx + (z - r.oz) * r.dz - age * r.speed;
  }

  function sampleNormal(x, z, t, eps = 1.2) {
    const hL = sampleHeight(x - eps, z, t), hR = sampleHeight(x + eps, z, t);
    const hD = sampleHeight(x, z - eps, t), hU = sampleHeight(x, z + eps, t);
    return new THREE.Vector3(hL - hR, 2 * eps, hD - hU).normalize();
  }

  function update(t, focus, camPos) {
    uniforms.uTime.value = t;
    uniforms.uAmp.value = params.amp;
    uniforms.uChop.value = params.chop;
    uniforms.uSpeed.value = params.speed;
    uniforms.uFoamAmount.value = params.foam;
    for (let i = rogues.length - 1; i >= 0; i--) {
      if (t - rogues[i].t0 > rogues[i].ttl) rogues.splice(i, 1);
    }
    for (let i = 0; i < ROGUE_N; i++) {
      const r = rogues[i];
      const A = uniforms.uRogueA.value[i], B = uniforms.uRogueB.value[i];
      if (!r) { A.set(0, -1, 0, 1); B.set(0, 0, 0, 1); continue; }
      const age = t - r.t0;
      const fade = Math.min(1, age / r.ramp) * Math.min(1, Math.max(0, r.ttl - age) / r.ramp);
      A.set(r.dx, r.dz, r.amp * fade, r.width);
      B.set(r.ox, r.oz, age * r.speed, r.len);
    }
    if (camPos) uniforms.uCam.value.copy(camPos);
    if (focus) {
      mesh.position.x = Math.round(focus.x / step) * step;
      mesh.position.z = Math.round(focus.z / step) * step;
    }
  }

  return { mesh, params, uniforms, rogues, sampleHeight, sampleNormal, update,
           spawnRogue, rogueFront, distanceToFront };
}
