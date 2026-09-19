import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { GuideState } from './guideTypes';

/**
 * Tepadagi kichik 3D mashina. Kamera mashina atrofida aylanib, kerakli
 * tomonni ko'rsatadi; kerakli zona qizil yonib-o'chadi va faqat to'g'ri
 * pozada (LOCK) yashilga o'tadi.
 *
 * Model — protsedural sedan (tashqi asset va litsenziya yo'q). Zona
 * yoritishi model-agnostik: shader fragmentning azimuti va normali bo'yicha
 * hisoblaydi, qismlarga nom berish shart emas.
 *
 * Koordinatalar: mashina +Z ga qaraydi (old = +Z), chap yon = +X.
 * Burchak (bearing): 0 old, 90 chap, 180 orqa, 270 o'ng → (sin b, cos b).
 */

const D2R = Math.PI / 180;
const NORMAL_DIST = 8.6;
const OVERVIEW_DIST = 11.4;
const NORMAL_ELEV = 22;
const OVERVIEW_ELEV = 30;
const RING_R = 3.0;
const FPS_CAP = 30;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** a dan b gacha eng qisqa yo'l bo'yicha (gradus), a ga nisbatan davomiy qiymat qaytaradi */
function shortestTarget(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return from + d;
}

type Uniforms = Record<string, THREE.IUniform>;

/** Zona yoritishi + fresnel rim: material shaderiga qo'shiladi */
function patchZone(mat: THREE.MeshStandardMaterial, u: Uniforms, zoneStrength = 1) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.uniforms.uStrength = { value: zoneStrength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvObjNormal = objectNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObjPos;
        varying vec3 vObjNormal;
        uniform float uTarget;
        uniform float uPulse;
        uniform float uMix;
        uniform float uStrength;
        uniform vec3 uColBad;
        uniform vec3 uColOk;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float az = degrees(atan(vObjPos.x, vObjPos.z));
          float dAz = abs(mod(az - uTarget + 540.0, 360.0) - 180.0);
          float tr = radians(uTarget);
          float k = dot(normalize(vObjNormal).xz, vec2(sin(tr), cos(tr)));
          float w = smoothstep(0.30, 0.78, k) * (1.0 - smoothstep(55.0, 95.0, dAz));
          vec3 zc = mix(uColBad, uColOk, uMix);
          float f = w * uPulse * uStrength;
          totalEmissiveRadiance += zc * f * 1.2;
          diffuseColor.rgb = mix(diffuseColor.rgb, zc, f * 0.3);
          float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
          totalEmissiveRadiance += vec3(0.16, 0.30, 0.75) * rim * 0.5;
        }`
      );
  };
  mat.customProgramCacheKey = () => 'carvision-zone-v1';
}

function extrudeProfile(points: [number, number][], width: number, bevel: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  points.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 12,
  });
  geo.translate(0, 0, -width / 2);
  // shape.x (uzunlik) → world Z, extrude Z (kenglik) → world X
  geo.rotateY(-Math.PI / 2);
  return geo;
}

function buildCar(u: Uniforms): THREE.Group {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.55, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1118, metalness: 0.85, roughness: 0.18 });
  patchZone(bodyMat, u, 1);
  patchZone(glassMat, u, 0.7);

  /*
   * Zamonaviy sedan silueti: past beltline, uzun kapot, qiya old oyna va
   * fastback orqa. Nuqtalar [uzunlik, balandlik] — old tomon musbat Z'da.
   */
  const lower = extrudeProfile(
    [
      [-2.26, 0.26], // orqa pastki
      [-2.34, 0.56], // orqa bamper
      [-2.28, 0.84], // bagaj qirrasi
      [-1.55, 0.90], // bagaj qopqog'i
      [-0.30, 0.96], // beltline
      [1.15, 0.94], // oyna tagi (cowl)
      [1.88, 0.86], // kapot
      [2.26, 0.66], // burun
      [2.36, 0.42], // old bamper
      [2.14, 0.24], // splitter
    ],
    1.72,
    0.1
  );
  car.add(new THREE.Mesh(lower, bodyMat));

  // Salon: old oyna ~31°, orqa oyna ~19° — coupe-sedan ko'rinishi
  const cabin = extrudeProfile(
    [
      [-1.58, 0.88],
      [-1.26, 1.22],
      [-0.12, 1.36],
      [0.56, 1.36],
      [1.28, 0.92],
    ],
    1.52,
    0.08
  );
  car.add(new THREE.Mesh(cabin, glassMat));

  // Bagaj ustidagi kichik spoyler qirrasi
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.07, 0.3), bodyMat);
  spoiler.position.set(0, 0.92, -2.02);
  spoiler.rotation.x = -0.12;
  car.add(spoiler);

  // G'ildiraklar: qora shina + och rim
  // Kattaroq g'ildirak + yorqin alloy rim: zamonaviy proporsiya
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.9, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb6bdc6, roughness: 0.22, metalness: 0.95 });
  const tireGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.29, 28).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.31, 24).rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.position.set(sx * 0.87, 0.40, sz * 1.46);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.copy(tire.position);
      car.add(tire, rim);
    }
  }

  // Faralar: ingichka LED chiziq (old) va to'liq kenglikdagi orqa chiroq paneli
  const headMat = new THREE.MeshStandardMaterial({ color: 0xdfe9ff, emissive: 0xbcd0ff, emissiveIntensity: 1.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x5e1f1f, emissive: 0xc0302a, emissiveIntensity: 0.75 });
  const headGeo = new THREE.BoxGeometry(0.46, 0.07, 0.06);
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(sx * 0.56, 0.7, 2.3);
    car.add(head);
  }
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.05), tailMat);
  tailBar.position.set(0, 0.74, -2.31);
  car.add(tailBar);

  // Old panjara ostidagi qora havo olish qismi — burunni "yassi" ko'rinishdan chiqaradi
  const intakeMat = new THREE.MeshStandardMaterial({ color: 0x0d1015, roughness: 0.7, metalness: 0.2 });
  const intake = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.16, 0.06), intakeMat);
  intake.position.set(0, 0.42, 2.33);
  car.add(intake);

  car.position.y = 0;
  return car;
}

interface Timeline {
  t0: number;
  dur: number;
  azFrom: number;
  azTo: number;
  first: boolean;
  gainFrom: number;
}

export function CarGuide3D({
  stateRef,
  onFail,
}: {
  stateRef: RefObject<GuideState>;
  onFail?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      onFail?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1.5, 0.1, 60);
    scene.add(camera);
    scene.add(new THREE.HemisphereLight(0xaab8ff, 0x0a0b0d, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(2.5, 4, 3);
    camera.add(key); // yorug'lik kameraga bog'langan — ko'rinayotgan tomon doim yoritilgan

    const uniforms: Uniforms = {
      uTarget: { value: 0 },
      uPulse: { value: 0 },
      uMix: { value: 0 },
      uColBad: { value: new THREE.Color('#ff4d3d') },
      uColOk: { value: new THREE.Color('#2e9e6b') },
    };

    const car = buildCar(uniforms);
    scene.add(car);

    // 8 segmentli halqa (har biri 45°)
    const ringGroup = new THREE.Group();
    const segMats: THREE.MeshBasicMaterial[] = [];
    const segGeos: THREE.RingGeometry[] = [];
    for (let i = 0; i < 8; i++) {
      const b = i * 45;
      const geo = new THREE.RingGeometry(RING_R - 0.16, RING_R + 0.16, 20, 1, (b - 21 - 90) * D2R, 42 * D2R);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x3a4048, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.02;
      ringGroup.add(mesh);
      segMats.push(mat);
      segGeos.push(geo);
    }
    scene.add(ringGroup);

    // Foydalanuvchi belgisi (kompas): halqada, markazga qarab turgan konus
    const userPivot = new THREE.Group();
    const coneGeo = new THREE.ConeGeometry(0.22, 0.6, 3);
    coneGeo.rotateX(-Math.PI / 2); // uchi −Z (markazga) qaraydi
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 0.25, RING_R + 0.55);
    userPivot.add(cone);
    userPivot.visible = false;
    scene.add(userPivot);

    /* ------------------------------------------------------------ o'lcham */
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = Math.max(1, parent.clientWidth);
      const h = Math.max(1, parent.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    resize();

    const onLost = (e: Event) => {
      e.preventDefault();
      onFail?.();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    /* --------------------------------------------------------- animatsiya */
    let camAz = 25;
    let camEl = NORMAL_ELEV;
    let camDist = OVERVIEW_DIST;
    let gain = 0;
    let mix = 0;
    let userAz: number | null = null;
    let lastStep = -1;
    let timeline: Timeline | null = null;
    let raf = 0;
    let last = 0;
    let lastNow = 0;

    const startTimeline = (now: number, s: GuideState) => {
      const reduced = s.reducedMotion;
      const first = s.firstStep && !reduced;
      const azFrom = camAz;
      const azTo = first ? azFrom + 360 + (((s.target - azFrom) % 360) + 360) % 360 : shortestTarget(azFrom, s.target);
      timeline = {
        t0: now,
        dur: reduced ? 350 : first ? 3200 : 1500,
        azFrom,
        azTo,
        first,
        gainFrom: gain,
      };
      uniforms.uTarget!.value = s.target;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS_CAP - 1) return;
      const dt = Math.min(0.1, (now - (lastNow || now)) / 1000);
      last = now;
      lastNow = now;

      const s = stateRef.current;
      if (s.stepKey !== lastStep) {
        lastStep = s.stepKey;
        startTimeline(now, s);
      }
      // Target o'zgargan bo'lsa (masalan, qayta olish) uniform yangilanadi
      uniforms.uTarget!.value = s.target;

      /* Kamera vaqt chizig'i */
      let progress = 1;
      if (timeline) {
        const t = now - timeline.t0;
        progress = clamp01(t / timeline.dur);
        const tl = timeline;
        if (tl.first) {
          // 0–500 uzoqlashish, 500–2900 to'liq aylanish, 2500–3200 yaqinlashish
          const azT = easeInOut(clamp01((t - 500) / 2400));
          camAz = t < 500 ? tl.azFrom : lerp(tl.azFrom, tl.azTo, azT);
          const out = easeOut(clamp01(t / 500));
          const back = easeInOut(clamp01((t - 2500) / 700));
          camDist = lerp(NORMAL_DIST, OVERVIEW_DIST, out) + (NORMAL_DIST - OVERVIEW_DIST) * back;
          camEl = lerp(NORMAL_ELEV, OVERVIEW_ELEV, out) + (NORMAL_ELEV - OVERVIEW_ELEV) * back;
        } else {
          // 0–400 uzoqlashish, 400–1400 burilish, 1100–1500 yaqinlashish
          const azT = easeInOut(clamp01((t - 400) / 1000));
          camAz = t < 400 ? tl.azFrom : lerp(tl.azFrom, tl.azTo, azT);
          const out = easeOut(clamp01(t / 400));
          const back = easeInOut(clamp01((t - 1100) / 400));
          camDist = lerp(NORMAL_DIST, OVERVIEW_DIST, out) + (NORMAL_DIST - OVERVIEW_DIST) * back;
          camEl = lerp(NORMAL_ELEV, OVERVIEW_ELEV, out) + (NORMAL_ELEV - OVERVIEW_ELEV) * back;
        }
        if (t >= tl.dur) {
          camAz = ((tl.azTo % 360) + 360) % 360;
          camDist = NORMAL_DIST;
          camEl = NORMAL_ELEV;
          timeline = null;
        }
      } else if (s.phase === 'done') {
        camAz += 14 * dt; // tugagach mashina sekin aylanadi
      }

      /* Zona kuchi: eski zona so'nadi, yangisi burilish oxirida yonadi */
      let targetGain: number;
      if (timeline) {
        const t = now - timeline.t0;
        const fadeOut = clamp01(t / 200);
        const rampIn = clamp01((progress - 0.6) / 0.4);
        targetGain = fadeOut < 1 ? timeline.gainFrom * (1 - fadeOut) : rampIn;
      } else {
        targetGain = s.phase === 'done' ? 0 : 1;
      }
      gain = targetGain;

      /* Pulsatsiya: 1.1 Hz (3 Hz dan past — xavfsiz), reduced-motion'da o'zgarmas */
      const locked = s.phase === 'locked' || s.phase === 'captured';
      const pulse = s.reducedMotion || locked ? 1 : 0.55 + 0.45 * Math.sin(now * 0.001 * Math.PI * 2 * 1.1);
      uniforms.uPulse!.value = gain * pulse;

      mix += ((locked ? 1 : 0) - mix) * Math.min(1, dt / 0.09); // ~250ms
      uniforms.uMix!.value = mix;

      /* Halqa segmentlari */
      const bad = uniforms.uColBad!.value as THREE.Color;
      const ok = uniforms.uColOk!.value as THREE.Color;
      const zone = new THREE.Color().copy(bad).lerp(ok, mix);
      for (let i = 0; i < 8; i++) {
        const b = i * 45;
        const mat = segMats[i]!;
        const done = s.captured.some((c) => Math.abs(((c - b + 540) % 360) - 180) < 1) || s.phase === 'done';
        const isTarget = Math.abs(((s.target - b + 540) % 360) - 180) < 1 && s.phase !== 'done';
        if (done && !isTarget) {
          mat.color.copy(ok);
          mat.opacity = 0.95;
        } else if (isTarget) {
          mat.color.copy(zone);
          mat.opacity = 0.35 + 0.6 * gain * pulse;
        } else {
          mat.color.set(0x3a4048);
          mat.opacity = 0.5;
        }
      }

      /* Foydalanuvchi belgisi */
      if (s.user === null) {
        userPivot.visible = false;
        userAz = null;
      } else {
        userPivot.visible = true;
        if (userAz === null) userAz = s.user;
        else {
          let d = (s.user - userAz) % 360;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          userAz += d * Math.min(1, dt * 8);
        }
        userPivot.rotation.y = userAz * D2R;
        coneMat.color.copy(locked ? ok : new THREE.Color(0xffffff));
      }

      /* Kamera */
      const az = camAz * D2R;
      const el = camEl * D2R;
      camera.position.set(
        camDist * Math.cos(el) * Math.sin(az),
        camDist * Math.sin(el) + 0.35,
        camDist * Math.cos(el) * Math.cos(az)
      );
      camera.lookAt(0, 0.55, 0);

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        lastNow = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      observer.disconnect();
      segGeos.forEach((g) => g.dispose());
      segMats.forEach((m) => m.dispose());
      coneGeo.dispose();
      coneMat.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const m = obj.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />;
}
