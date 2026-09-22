import * as THREE from './vendor/three.module.min.js';

const mix = THREE.MathUtils.lerp;
const smooth = (a, b, value) => { const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// One persistent set of rooms: floors become cells, walls become dividers,
// and each professional becomes an assignment inside the very same cell.
export function createOperationScene(host, canvas, context, { mobile, tablet = false, simplified = false, onFailure }) {
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  const quality = simplified ? 'simplified' : mobile ? 'mobile' : tablet ? 'tablet' : 'desktop';
  const shadows = !mobile && !tablet && !simplified;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, simplified ? 1 : mobile ? 1.25 : tablet ? 1.35 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(mobile ? 39 : 35, 1, .1, 70);
  const rig = new THREE.Group();
  scene.add(rig);
  scene.add(new THREE.HemisphereLight(0xf8fff8, 0x789089, 3));
  const key = new THREE.DirectionalLight(0xfffaf0, 4);
  key.position.set(-4, 10, 5);
  key.castShadow = shadows;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 25 });
  key.shadow.normalBias = .035;
  key.shadow.bias = -.0002;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc9e0ea, 1.2);
  fill.position.set(6, 4, -5);
  scene.add(fill);

  const geometries = new Set();
  const materials = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: .02, ...extra }); materials.add(m); return m; };
  const box = geometry(new THREE.BoxGeometry(1, 1, 1));
  const white = material(0xf0f3ed);
  const wallMat = material(0xdde5db);
  const blue = material(0x153945);
  const glass = material(0x658b89, { roughness: .38, metalness: .12 });
  const green = material(0x248770);
  const roofMat = material(0xf5f6ee, { transparent: true });
  const rows = mobile ? 2 : 3;
  const count = rows * 4;
  const mesh = (g, m, amount) => { const obj = new THREE.InstancedMesh(g, m, amount); obj.instanceMatrix.setUsage(THREE.DynamicDrawUsage); obj.castShadow = shadows; obj.receiveShadow = shadows; obj.frustumCulled = false; rig.add(obj); return obj; };
  const floors = mesh(box, white, count);
  const walls = mesh(box, wallMat, count * 2);
  const fronts = mesh(box, blue, count);
  const windows = mesh(box, glass, count);
  const roofs = mesh(box, roofMat, count);
  const bodies = mesh(box, green, count);
  const heads = mesh(geometry(new THREE.SphereGeometry(1, 12, 8)), green, count);
  const routes = mesh(box, material(0x97b9a7), 3);
  const markers = mesh(box, material(0xc7dcd1), count * 2);
  const baseMat = material(0xe0e8dd);
  const base = new THREE.Mesh(box, baseMat);
  base.receiveShadow = shadows;
  rig.add(base);
  const entry = new THREE.Mesh(box, blue);
  entry.castShadow = shadows;
  rig.add(entry);

  // A small generated contact shadow, not an external texture or postprocessing pass.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const paint = shadowCanvas.getContext('2d');
  const gradient = paint.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(35, 67, 54, .22)');
  gradient.addColorStop(1, 'rgba(35, 67, 54, 0)');
  paint.fillStyle = gradient;
  paint.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  materials.add(shadowMaterial);
  const shadow = new THREE.Mesh(geometry(new THREE.PlaneGeometry(15, 12)), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -.3;
  scene.add(shadow);
  const groundMat = new THREE.ShadowMaterial({ opacity: .09 });
  materials.add(groundMat);
  const ground = new THREE.Mesh(geometry(new THREE.PlaneGeometry(20, 20)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.22;
  ground.receiveShadow = true;
  ground.visible = shadows;
  scene.add(ground);

  const temp = new THREE.Object3D();
  const set = (obj, index, x, y, z, sx, sy, sz) => {
    temp.position.set(x, y, z); temp.scale.set(sx, Math.max(.001, sy), sz); temp.rotation.set(0, 0, 0); temp.updateMatrix(); obj.setMatrixAt(index, temp.matrix);
  };
  const instances = [floors, walls, fronts, windows, roofs, bodies, heads, routes, markers];
  let progress = 0;
  let visible = true;
  let disposed = false;
  let ready = false;
  let pendingCompile = null;
  let frame = 0;
  let slowFrames = 0;
  let reducedQuality = false;
  let renders = 0;
  const gaze = new THREE.Vector3();

  function update(value) {
    progress = value;
    const open = smooth(.08, .37, value);
    const people = smooth(.27, .5, value);
    const ordered = smooth(.48, .76, value);
    const grid = smooth(.66, 1, value);
    const roofLift = open * (1 - grid);
    rig.rotation.y = mix(-.12, 0, grid);
    base.position.set(0, -.08, 0);
    base.scale.set(mix(8.65, 8.9, grid), mix(.22, .1, grid), mix(rows * 2.05 + .75, rows * 1.7 + .85, grid));
    entry.scale.set(mix(1.15, .6, grid), mix(.5, .04, grid), mix(.75, .25, grid));
    entry.position.set(0, mix(.2, .08, grid), mix(rows * 1.02 + .32, rows * .85 + .23, grid));

    for (let i = 0; i < count; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const side = col < 2 ? -1 : 1;
      const startX = (col - 1.5) * 1.8 + side * .25;
      const startZ = (row - (rows - 1) / 2) * 2.02;
      const spread = Math.sin(open * Math.PI / 2) * (1 - grid);
      const x = mix(startX + side * spread * .2, (col - 1.5) * 2.06, grid);
      const z = mix(startZ, (row - (rows - 1) / 2) * 1.68, grid);
      const width = mix(1.68, 1.88, grid);
      const depth = mix(1.78, 1.46, grid);
      set(floors, i, x, .12, z, width, .16, depth);
      const height = mix(.84, .035, grid);
      const wallY = .22 + height / 2;
      set(walls, i * 2, x - width / 2 + .045, wallY, z, .09, height, depth);
      set(walls, i * 2 + 1, x, wallY, z - depth / 2 + .045, width, height, .09);
      set(fronts, i, x, mix(.38, .235, grid), z + depth / 2 - .055, width, mix(.44, .025, grid), .08);
      set(windows, i, x + width / 2 - .04, mix(.55, .24, grid), z, .065, mix(.54, .02, grid), depth * .88);
      set(roofs, i, x, mix(1.15 + roofLift * (mobile ? 1.2 : 1.8), .235, grid), z, width + .06, mix(.14, .025, grid), depth + .06);
      const dx = Math.sin(i * 2.8) * .37 * (1 - ordered);
      const dz = Math.cos(i * 1.7) * .34 * (1 - ordered);
      const px = x + mix(dx, -.22, grid);
      const pz = z + mix(dz, 0, grid);
      const scale = Math.max(.001, people);
      set(bodies, i, px, mix(.43, .29, grid), pz, mix(.16, .92, grid) * scale, mix(.42, .055, grid) * scale, mix(.16, .45, grid) * scale);
      const headSize = .115 * scale * (1 - grid);
      set(heads, i, px, .77, pz, Math.max(.001, headSize), Math.max(.001, headSize), Math.max(.001, headSize));
      // Room details flatten into the secondary marks of the same schedule cell.
      set(markers, i * 2, x + .45, .27, z - .25, mix(.28, .42, grid), .025, .055);
      set(markers, i * 2 + 1, x + .4, .27, z - .10, mix(.20, .32, grid), .025, .055);
    }
    roofs.visible = value < .68;
    roofMat.opacity = 1 - smooth(.15, .38, value);
    roofs.castShadow = shadows && roofMat.opacity > .7;
    heads.visible = grid < .99 && people > .001;
    bodies.visible = people > .001;
    // The corridors are present from the start and become dividers, rather than appearing as a new scene.
    set(routes, 0, 0, .025, 0, mix(.34, .025, grid), .012, mix(rows * 2.05, rows * 1.68, grid));
    set(routes, 1, -2.05, .025, 0, mix(.15, .02, grid), .012, rows * 1.75);
    set(routes, 2, 2.05, .025, 0, mix(.15, .02, grid), .012, rows * 1.75);
    for (const obj of instances) obj.instanceMatrix.needsUpdate = true;
    const approach = Math.sin(smooth(0, .75, value) * Math.PI);
    const distance = mobile ? 1.14 : 1;
    camera.position.set(mix(10.6 - approach * 2.2, .35, grid) * distance, mix(9 + approach * .8, 15.4, grid) * distance, mix(12.3 - approach * 2.8, 2.9, grid) * distance);
    gaze.set(mix(-.28 * approach, 0, grid), mix(.28 + approach * .15, 0, grid), 0);
    camera.lookAt(gaze);
    requestRender();
  }

  function render() {
    frame = 0;
    if (disposed || !ready || !visible || document.hidden) return;
    const before = performance.now();
    try { renderer.render(scene, camera); } catch { onFailure(); return; }
    const cost = performance.now() - before;
    // Conservative degradation after repeated slow rendering, never device sniffing alone.
    if (renders++ > 8 && cost > 38) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 8 && !reducedQuality) {
      renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; reducedQuality = true; slowFrames = 0;
    } else if (slowFrames > 16 && reducedQuality) { onFailure(); }
  }
  function requestRender() { if (!frame && ready && !disposed && visible && !document.hidden) frame = requestAnimationFrame(render); }
  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height || disposed) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestRender();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  function lost(event) { event.preventDefault(); onFailure(); }
  canvas.addEventListener('webglcontextlost', lost);
  resize();
  update(0);
  return {
    async prepare() {
      // Use parallel shader compilation when the browser supports it; retain SVG until ready.
      pendingCompile = renderer.compileAsync(scene, camera);
      await pendingCompile;
      if (!disposed) ready = true;
    },
    update,
    setVisible(value) { visible = value; if (value) requestRender(); else { cancelAnimationFrame(frame); frame = 0; } },
    renderNow() { cancelAnimationFrame(frame); render(); },
    getDiagnostics() { return { renders, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), progress, reducedQuality, quality }; },
    dispose() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.remove();
      const release = () => {
        for (const obj of instances) obj.dispose();
        for (const g of geometries) g.dispose();
        for (const m of materials) m.dispose();
        shadowTexture.dispose(); key.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss();
      };
      // Three's parallel shader poll still owns its programs until compilation resolves.
      // Detach immediately, but don't destroy programs underneath a pending resize/rebuild.
      if (pendingCompile) pendingCompile.then(release, release);
      else release();
    }
  };
}
