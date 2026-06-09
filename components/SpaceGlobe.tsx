'use client';

import { Settings, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type GlobePoint = {
  id: string;
  lat: number;
  lng: number;
  population: number;
};

type GlobeArc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
};

type SpaceSettings = {
  baseURL: string;
  apiKey: string;
  model: string;
};

const agentPoints: GlobePoint[] = [
  { id: 'beijing', lat: 39.9042, lng: 116.4074, population: 21540000 },
  { id: 'shanghai', lat: 31.2304, lng: 121.4737, population: 24280000 },
  { id: 'tokyo', lat: 35.6762, lng: 139.6503, population: 13960000 },
  { id: 'new-york', lat: 40.7128, lng: -74.006, population: 8419000 },
  { id: 'london', lat: 51.5074, lng: -0.1278, population: 8982000 },
  { id: 'paris', lat: 48.8566, lng: 2.3522, population: 2161000 },
  { id: 'sydney', lat: -33.8688, lng: 151.2093, population: 5312000 },
  { id: 'singapore', lat: 1.3521, lng: 103.8198, population: 5686000 },
  { id: 'dubai', lat: 25.2048, lng: 55.2708, population: 3489000 },
  { id: 'mumbai', lat: 19.076, lng: 72.8777, population: 20670000 },
];

const agentArcs: GlobeArc[] = [
  { startLat: 39.9042, startLng: 116.4074, endLat: 35.6762, endLng: 139.6503, color: '#1e90ff' },
  { startLat: 31.2304, startLng: 121.4737, endLat: 1.3521, endLng: 103.8198, color: '#3a7d44' },
  { startLat: 40.7128, startLng: -74.006, endLat: 51.5074, endLng: -0.1278, color: '#1e90ff' },
  { startLat: 51.5074, startLng: -0.1278, endLat: 48.8566, endLng: 2.3522, color: '#1e90ff' },
  { startLat: 25.2048, startLng: 55.2708, endLat: 19.076, endLng: 72.8777, color: '#3a7d44' },
  { startLat: -33.8688, startLng: 151.2093, endLat: 1.3521, endLng: 103.8198, color: '#1e90ff' },
  { startLat: 35.6762, startLng: 139.6503, endLat: 37.5665, endLng: 126.978, color: '#3a7d44' },
];

const EARTH_TEXTURE = '/globe/earth-blue-marble.jpg';
const EARTH_BUMP = '/globe/earth-topology.png';
const CLOUDS_TEXTURE = '/globe/clouds.png';
const SPACE_SETTINGS_STORAGE_KEY = 'muses.space.settings';
const defaultSpaceSettings: SpaceSettings = {
  baseURL: '',
  apiKey: '',
  model: '',
};

function makeStars(count: number) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const radius = 900 + Math.random() * 700;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#f8fbff',
    size: 1.45,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

function makeMilkyWay() {
  const geometry = new THREE.BufferGeometry();
  const count = 1600;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const radius = 860 + Math.random() * 480;
    const angle = Math.random() * Math.PI * 2;
    const band = (Math.random() - 0.5) * 120;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = band + Math.sin(angle * 2.4) * 34;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#9cc8ff',
    size: 1.05,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.rotation.set(0.32, -0.28, -0.18);
  return points;
}

export default function SpaceGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SpaceSettings>(defaultSpaceSettings);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SPACE_SETTINGS_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<SpaceSettings>;
      setSettings({
        baseURL: parsed.baseURL === 'https://api.302ai.com' ? '' : parsed.baseURL || '',
        apiKey: parsed.apiKey || '',
        model: parsed.model === 'gpt-5-mini' ? '' : parsed.model || '',
      });
    } catch {
      setSettings(defaultSpaceSettings);
    }
  }, []);

  const handleSettingsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSettings = {
      baseURL: settings.baseURL.trim(),
      apiKey: settings.apiKey.trim(),
      model: settings.model.trim(),
    };
    setSettings(nextSettings);
    window.localStorage.setItem(SPACE_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    setSettingsOpen(false);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;
    let controls: OrbitControls | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let globe: THREE.Object3D | null = null;
    let cloudLayer: THREE.Mesh | null = null;
    let stars: THREE.Points | null = null;
    let milkyWay: THREE.Points | null = null;

    async function init() {
      const { default: ThreeGlobe } = await import('three-globe');
      if (disposed || !container) return;

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#0a0a0f');
      scene.fog = new THREE.FogExp2('#0a0a0f', 0.00055);

      camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1600);
      camera.position.set(0, 38, 265);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor('#0a0a0f', 1);
      renderer.shadowMap.enabled = false;
      container.appendChild(renderer.domElement);

      const ambient = new THREE.AmbientLight('#ffffff', 0.62);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight('#fff8ee', 1.05);
      keyLight.position.set(200, 200, 200);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight('#1e90ff', 0.7);
      rimLight.position.set(-260, -90, -240);
      scene.add(rimLight);

      globe = new ThreeGlobe({ waitForGlobeReady: true, animateIn: true })
        .globeImageUrl(EARTH_TEXTURE)
        .bumpImageUrl(EARTH_BUMP)
        .showAtmosphere(true)
        .atmosphereColor('#4da6ff')
        .atmosphereAltitude(0.25)
        .showGraticules(false)
        .pointsData(agentPoints)
        .pointLat('lat')
        .pointLng('lng')
        .pointColor(() => '#1e90ff')
        .pointRadius((point: object) => {
          const item = point as GlobePoint;
          return Math.max(0.28, Math.min(0.62, item.population / 42000000));
        })
        .pointAltitude(0.012)
        .pointsTransitionDuration(900)
        .pointsMerge(true)
        .arcsData(agentArcs)
        .arcStartLat('startLat')
        .arcStartLng('startLng')
        .arcEndLat('endLat')
        .arcEndLng('endLng')
        .arcColor('color')
        .arcAltitude(0.16)
        .arcStroke(0.48)
        .arcDashLength(0.36)
        .arcDashGap(0.24)
        .arcDashInitialGap(() => Math.random())
        .arcDashAnimateTime(1600);

      globe.rotation.set(-0.2, -1.08, 0.05);
      globe.scale.setScalar(1.12);
      scene.add(globe);

      const cloudTexture = new THREE.TextureLoader().load(CLOUDS_TEXTURE);
      cloudTexture.colorSpace = THREE.SRGBColorSpace;
      if (cloudTexture) {
        cloudLayer = new THREE.Mesh(
          new THREE.SphereGeometry(103.8, 96, 96),
          new THREE.MeshPhongMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            blending: THREE.NormalBlending,
          })
        );
        cloudLayer.rotation.copy(globe.rotation);
        cloudLayer.scale.copy(globe.scale);
        scene.add(cloudLayer);
      }

      stars = makeStars(980);
      scene.add(stars);
      milkyWay = makeMilkyWay();
      scene.add(milkyWay);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.045;
      controls.enablePan = true;
      controls.panSpeed = 0.48;
      controls.rotateSpeed = 0.5;
      controls.zoomSpeed = 0.72;
      controls.minDistance = 150;
      controls.maxDistance = 500;
      controls.target.set(0, 0, 0);

      const resize = () => {
        if (!container || !renderer || !camera) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };

      window.addEventListener('resize', resize);
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);

      const animate = () => {
        if (disposed || !renderer || !scene || !camera) return;
        frameId = requestAnimationFrame(animate);
        if (globe) globe.rotation.y += 0.001;
        if (cloudLayer) cloudLayer.rotation.y += 0.0012;
        if (stars) stars.rotation.y -= 0.0001;
        if (milkyWay) milkyWay.rotation.y += 0.00006;
        controls?.update();
        renderer.render(scene, camera);
      };

      animate();

      return () => {
        window.removeEventListener('resize', resize);
        resizeObserver.disconnect();
      };
    }

    let detachResize: (() => void) | undefined;
    init().then((cleanup) => {
      detachResize = cleanup;
    });

    return () => {
      disposed = true;
      detachResize?.();
      cancelAnimationFrame(frameId);
      controls?.dispose();
      if (cloudLayer) {
        cloudLayer.geometry.dispose();
        const material = cloudLayer.material;
        const mat = (Array.isArray(material) ? material[0] : material) as THREE.MeshPhongMaterial;
        mat.map?.dispose();
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      }
      if (stars) {
        stars.geometry.dispose();
        (stars.material as THREE.Material).dispose();
      }
      if (milkyWay) {
        milkyWay.geometry.dispose();
        (milkyWay.material as THREE.Material).dispose();
      }
      if (globe) {
        globe.traverse((object) => {
          const mesh = object as THREE.Mesh;
          mesh.geometry?.dispose?.();
          const material = mesh.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material?.dispose?.();
        });
      }
      renderer?.dispose();
      if (renderer?.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0a0f]">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,144,255,0.18)_0%,rgba(30,144,255,0.08)_28%,transparent_56%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0a0a0f]/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0a0a0f]/90 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-[#0a0a0f]/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-[#0a0a0f]/80 to-transparent" />
      <button
        type="button"
        aria-label="系统设置"
        onClick={() => setSettingsOpen(true)}
        className="absolute left-6 top-6 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-[#1e90ff]/40 bg-[#0a0a0f]/70 text-white shadow-[0_8px_28px_rgba(30,144,255,0.18)] backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#1e90ff]/80 hover:bg-[#1e90ff]/25"
      >
        <Settings className="h-5 w-5" />
      </button>

      {settingsOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 p-6 backdrop-blur-[2px]">
          <form
            onSubmit={handleSettingsSubmit}
            className="w-[360px] rounded-2xl border border-[#1e90ff]/35 bg-[#0a0a0f]/90 p-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45),0_0_36px_rgba(30,144,255,0.18)] backdrop-blur-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">系统设置</h3>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setSettingsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-medium text-[#1e90ff]">BaseURL</span>
              <input
                value={settings.baseURL}
                onChange={(event) => setSettings((current) => ({ ...current, baseURL: event.target.value }))}
                className="h-11 w-full rounded-lg border border-[#1e90ff]/25 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#1e90ff]/80 focus:bg-white/[0.08]"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-medium text-[#1e90ff]">API key</span>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(event) => setSettings((current) => ({ ...current, apiKey: event.target.value }))}
                className="h-11 w-full rounded-lg border border-[#1e90ff]/25 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#1e90ff]/80 focus:bg-white/[0.08]"
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-2 block text-xs font-medium text-[#1e90ff]">Model</span>
              <input
                value={settings.model}
                onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}
                className="h-11 w-full rounded-lg border border-[#1e90ff]/25 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#1e90ff]/80 focus:bg-white/[0.08]"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="h-10 rounded-lg border border-white/10 px-4 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                className="h-10 rounded-lg border border-[#1e90ff] bg-[#1e90ff]/60 px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(30,144,255,0.24)] transition hover:bg-[#1e90ff]/80"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
