import * as THREE from './vendor/three.module.min.js';

const FULL_PIXEL_BUDGET = 7_500_000;
const COMPATIBILITY_PIXEL_BUDGET = 3_000_000;

function resolvePixelRatio(width, height, compatibility) {
  const nativeRatio = Math.max(1, window.devicePixelRatio || 1);
  const ratioCap = compatibility ? 1.25 : 2.25;
  const pixelBudget = compatibility ? COMPATIBILITY_PIXEL_BUDGET : FULL_PIXEL_BUDGET;
  const budgetRatio = Math.sqrt(pixelBudget / Math.max(1, width * height));
  return Math.max(1, Math.min(nativeRatio, ratioCap, budgetRatio));
}

const clamp = value => THREE.MathUtils.clamp(value, 0, 1);
const mix = THREE.MathUtils.lerp;
const smooth = (from, to, value) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

export function createInternalScene(host, canvas, context, {
  type,
  compatibility = false,
  onFailure
}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    alpha: true,
    antialias: !compatibility,
    powerPreference: compatibility ? 'default' : 'high-performance'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !compatibility;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 60);
  const root = new THREE.Group();
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0xf6fff8, 0x3d5f5a, 2.8);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xf7fff8, 3.5);
  key.position.set(-4, 7, 6);
  key.castShadow = !compatibility;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.normalBias = .035;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fcab4, 2.0);
  rim.position.set(5, 2, -5);
  scene.add(rim);

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({
      color,
      roughness: .72,
      metalness: .06,
      ...options
    });
    materials.add(value);
    return value;
  };
  const lineMaterial = (color, options = {}) => {
    const value = new THREE.LineBasicMaterial({ color, transparent: true, ...options });
    materials.add(value);
    return value;
  };
  const addMesh = (shape, surface, parent = root) => {
    const value = new THREE.Mesh(shape, surface);
    value.castShadow = !compatibility;
    value.receiveShadow = !compatibility;
    parent.add(value);
    return value;
  };
  const createTextPlane = (text, {
    width = 2.4,
    height = .38,
    color = '#123541',
    fontSize = 82,
    weight = 600
  } = {}) => {
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 1536;
    textCanvas.height = 384;
    const paint = textCanvas.getContext('2d');
    paint.clearRect(0, 0, 1536, 384);
    paint.fillStyle = color;
    paint.font = `${weight} ${fontSize * 1.5}px "Plus Jakarta Sans", Inter, sans-serif`;
    paint.textAlign = 'center';
    paint.textBaseline = 'middle';
    paint.fillText(text, 768, 192, 1446);
    const texture = new THREE.CanvasTexture(textCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = compatibility ? 1 : Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.add(texture);
    const surface = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    });
    materials.add(surface);
    const plane = new THREE.Mesh(geometry(new THREE.PlaneGeometry(width, height)), surface);
    plane.renderOrder = 8;
    plane.userData.textSurface = surface;
    root.add(plane);
    return plane;
  };
  const faceCamera = (...planes) => planes.forEach(plane => plane?.quaternion.copy(camera.quaternion));

  const ink = material(0x123541);
  const green = material(0x23806d);
  const mint = material(0x88c9b5);
  const paper = material(0xe9f0ea);
  const pale = material(0xbfd4c8);
  const updateScene = createSceneByType(type, {
    root,
    camera,
    geometry,
    material,
    lineMaterial,
    addMesh,
    createTextPlane,
    faceCamera,
    surfaces: { ink, green, mint, paper, pale }
  });

  let progress = 0;
  let visible = true;
  let ready = false;
  let disposed = false;
  let frame = 0;
  let renders = 0;
  let slowFrames = 0;
  let failureReported = false;

  const reportFailure = reason => {
    if (failureReported || disposed) return;
    failureReported = true;
    onFailure(reason);
  };

  function render() {
    frame = 0;
    if (!ready || disposed || !visible || document.hidden) return;
    const before = performance.now();
    try {
      renderer.render(scene, camera);
    } catch {
      reportFailure('render-error');
      return;
    }
    const cost = performance.now() - before;
    renders++;
    if (renders > 10 && cost > 38) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 10) reportFailure('sustained-slow-rendering');
  }

  function requestRender() {
    if (!frame && ready && !disposed && visible && !document.hidden) {
      frame = requestAnimationFrame(render);
    }
  }

  function update(value) {
    progress = clamp(value);
    updateScene.update(progress);
    requestRender();
  }

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height || disposed) return;
    const nextPixelRatio = resolvePixelRatio(width, height, compatibility);
    if (Math.abs(renderer.getPixelRatio() - nextPixelRatio) > .01) renderer.setPixelRatio(nextPixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateScene.resize?.({ width, height, compact: width < 520 || width / height < .85 });
    requestRender();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  addEventListener('resize', resize, { passive: true });
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) requestRender();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: '120px' });
  visibilityObserver.observe(host);
  const contextLost = event => {
    event.preventDefault();
    reportFailure('context-lost');
  };
  canvas.addEventListener('webglcontextlost', contextLost);

  resize();
  update(0);

  return {
    async prepare() {
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      ready = true;
      update(progress);
      render();
    },
    update,
    getDiagnostics() {
      return {
        type,
        mode: compatibility ? 'compatibility' : 'full',
        progress,
        stage: updateScene.getStage?.() || Math.min(4, Math.floor(progress * 4) + 1),
        textPlanes: updateScene.textPlanes || 0,
        renders,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        pixelRatio: renderer.getPixelRatio(),
        cssSize: { width: host.clientWidth, height: host.clientHeight },
        drawingBuffer: (() => {
          const size = renderer.getDrawingBufferSize(new THREE.Vector2());
          return { width: size.x, height: size.y };
        })(),
        pixelBudget: compatibility ? COMPATIBILITY_PIXEL_BUDGET : FULL_PIXEL_BUDGET
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      removeEventListener('resize', resize);
      visibilityObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.remove();
      updateScene.dispose?.();
      for (const shape of geometries) shape.dispose();
      for (const surface of materials) surface.dispose();
      for (const texture of textures) texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}

function createSceneByType(type, tools) {
  if (type === 'management') return createManagementScene(tools);
  if (type === 'institutions') return createInstitutionScene(tools);
  return createProfessionalScene(tools);
}

function createManagementScene({ root, camera, geometry, lineMaterial, addMesh, createTextPlane, faceCamera, surfaces }) {
  const cellShape = geometry(new THREE.BoxGeometry(1, 1, 1));
  const markerShape = geometry(new THREE.SphereGeometry(1, 20, 14));
  const cells = [];
  const markers = [];
  const starts = [];
  const columns = 5;
  const rows = 4;
  for (let index = 0; index < columns * rows; index++) {
    const surface = index % 5 === 0 ? surfaces.green : index % 3 === 0 ? surfaces.pale : surfaces.paper;
    const cell = addMesh(cellShape, surface);
    const angle = index * 1.73;
    starts.push(new THREE.Vector3(
      Math.cos(angle) * (2.8 + index % 3 * .45),
      Math.sin(index * .9) * 1.6,
      Math.sin(angle) * (2.4 + index % 4 * .32)
    ));
    cells.push(cell);
  }
  for (let index = 0; index < 7; index++) {
    const marker = addMesh(markerShape, surfaces.green);
    markers.push(marker);
  }

  const gridGeometry = geometry(new THREE.BufferGeometry());
  const gridPoints = [];
  for (let column = 0; column <= columns; column++) {
    const x = (column - columns / 2) * .76;
    gridPoints.push(x, 0, -1.22, x, 0, 1.22);
  }
  for (let row = 0; row <= rows; row++) {
    const z = (row - rows / 2) * .61;
    gridPoints.push(-1.9, 0, z, 1.9, 0, z);
  }
  gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
  const gridSurface = lineMaterial(0x6ca994, { opacity: 0 });
  const grid = new THREE.LineSegments(gridGeometry, gridSurface);
  root.add(grid);
  const labels = [
    createTextPlane('COMPLEXIDADE', { width: 2.8, height: .34, color: '#55766d', fontSize: 76 }),
    createTextPlane('ESTRUTURA', { width: 2.25, height: .34, fontSize: 82 }),
    createTextPlane('PROFISSIONAIS', { width: 3.2, height: .34, color: '#16715f', fontSize: 74 }),
    createTextPlane('ESCALA ORGANIZADA', { width: 4.1, height: .4, color: '#123541', fontSize: 76 })
  ];
  labels[0].position.set(-2.5, 1.8, .4);
  labels[1].position.set(2.35, 1.55, -.25);
  labels[2].position.set(-2.2, 1.15, -1.4);
  labels[3].position.set(-.4, 1.9, -1.1);
  let currentStage = 1;

  function resize({ compact }) {
    camera.fov = compact ? 41 : 35;
    camera.updateProjectionMatrix();
  }

  function update(progress) {
    currentStage = Math.min(4, Math.floor(progress * 4) + 1);
    const assemble = smooth(.08, .58, progress);
    const populate = smooth(.36, .72, progress);
    const flatten = smooth(.66, 1, progress);
    cells.forEach((cell, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const target = new THREE.Vector3((column - 2) * .76, 0, (row - 1.5) * .61);
      cell.position.lerpVectors(starts[index], target, assemble);
      cell.rotation.set(
        mix((index % 3 - 1) * .6, 0, assemble),
        mix((index % 4 - 1.5) * .45, 0, assemble),
        mix((index % 2 ? 1 : -1) * .28, 0, assemble)
      );
      const emphasis = index % 6 === 0 ? 1 + populate * .18 : 1;
      cell.scale.set(mix(.32, .7, assemble) * emphasis, mix(.32, .08, flatten), mix(.32, .52, assemble) * emphasis);
    });
    markers.forEach((marker, index) => {
      const cellIndex = [1, 4, 7, 10, 13, 16, 19][index];
      const cell = cells[cellIndex];
      const angle = index * 2.1;
      marker.position.set(
        mix(Math.cos(angle) * 2.9, cell.position.x, populate),
        mix(1.7 + (index % 2) * .5, .18, populate),
        mix(Math.sin(angle) * 2.4, cell.position.z, populate)
      );
      marker.scale.setScalar(Math.max(.001, smooth(.2, .48, progress) * mix(.11, .085, flatten)));
    });
    gridSurface.opacity = smooth(.55, .9, progress) * .72;
    labels[0].userData.textSurface.opacity = (1 - smooth(.2, .33, progress)) * .9;
    labels[1].userData.textSurface.opacity = smooth(.18, .3, progress) * (1 - smooth(.48, .6, progress));
    labels[2].userData.textSurface.opacity = smooth(.43, .55, progress) * (1 - smooth(.72, .83, progress));
    labels[3].userData.textSurface.opacity = smooth(.7, .84, progress);
    root.rotation.x = mix(-.08, -.57, flatten);
    root.rotation.y = mix(-.68, -.02, assemble);
    camera.position.set(mix(4.2, .15, flatten), mix(4.5, 3.2, flatten), mix(9.5, 3.8, assemble));
    camera.lookAt(0, mix(.35, 0, flatten), 0);
    faceCamera(...labels);
  }

  return { update, resize, getStage: () => currentStage, textPlanes: labels.length };
}

function createInstitutionScene({ root, camera, geometry, lineMaterial, addMesh, createTextPlane, faceCamera, surfaces }) {
  const moduleShape = geometry(new THREE.BoxGeometry(1, 1, 1));
  const coreShape = geometry(new THREE.BoxGeometry(1.35, .45, 1.35));
  const moduleSurfaces = [surfaces.pale, surfaces.paper, surfaces.green, surfaces.mint];
  const modules = moduleSurfaces.map(surface => addMesh(moduleShape, surface));
  const core = addMesh(coreShape, surfaces.ink);
  surfaces.ink.transparent = true;
  const lineShape = geometry(new THREE.BufferGeometry());
  lineShape.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(4 * 2 * 3), 3));
  const connectionSurface = lineMaterial(0x72b39d, { opacity: 0 });
  const connections = new THREE.LineSegments(lineShape, connectionSurface);
  root.add(connections);
  const continuityRing = addMesh(geometry(new THREE.TorusGeometry(2.35, .025, 8, 80)), surfaces.mint);
  continuityRing.rotation.x = Math.PI / 2;
  continuityRing.position.y = -.14;
  const origins = [
    new THREE.Vector3(-4.2, 1.8, 2.5),
    new THREE.Vector3(4.0, -1.2, 3.0),
    new THREE.Vector3(-3.4, -1.8, -3.2),
    new THREE.Vector3(4.4, 1.5, -2.4)
  ];
  const targets = [
    new THREE.Vector3(-1.35, 0, .9),
    new THREE.Vector3(1.35, 0, .9),
    new THREE.Vector3(-1.35, 0, -.9),
    new THREE.Vector3(1.35, 0, -.9)
  ];
  const moduleLabels = ['SETORES', 'PERÍODOS', 'PESSOAS', 'NECESSIDADES'].map(label =>
    createTextPlane(label, { width: 1.8, height: .3, color: '#123541', fontSize: 72 })
  );
  const coreLabel = createTextPlane('OPERAÇÃO COORDENADA', { width: 3.9, height: .4, color: '#16715f', fontSize: 70 });
  const continuityLabel = createTextPlane('CONTINUIDADE', { width: 3.05, height: .4, color: '#123541', fontSize: 78 });
  let currentStage = 1;

  function resize({ compact }) {
    camera.fov = compact ? 44 : 37;
    camera.updateProjectionMatrix();
  }

  function update(progress) {
    currentStage = Math.min(4, Math.floor(progress * 4) + 1);
    const recognize = smooth(.05, .3, progress);
    const coordinate = smooth(.22, .65, progress);
    const continuity = smooth(.58, 1, progress);
    modules.forEach((module, index) => {
      module.position.lerpVectors(origins[index], targets[index], coordinate);
      module.rotation.set(
        mix((index - 1.5) * .35, 0, coordinate),
        mix((index % 2 ? 1 : -1) * .72, 0, coordinate),
        mix((index % 2 ? 1 : -1) * .24, 0, coordinate)
      );
      module.scale.set(mix(.62, 1.05, recognize), mix(.72, .2, continuity), mix(.62, .7, coordinate));
      const label = moduleLabels[index];
      label.position.set(module.position.x, module.position.y + mix(.72, .42, continuity), module.position.z);
      label.userData.textSurface.opacity = smooth(.08, .24, progress) * (1 - smooth(.7, .88, progress));
    });
    core.scale.setScalar(mix(.001, 1, smooth(.3, .62, progress)));
    core.position.y = mix(-.9, .04, coordinate);
    core.rotation.y = mix(-.75, 0, coordinate);
    surfaces.ink.opacity = smooth(.3, .58, progress);
    const positions = lineShape.attributes.position;
    modules.forEach((module, index) => {
      positions.setXYZ(index * 2, module.position.x, module.position.y, module.position.z);
      positions.setXYZ(index * 2 + 1, 0, .04, 0);
    });
    positions.needsUpdate = true;
    connectionSurface.opacity = smooth(.22, .68, progress) * (1 - continuity * .25) * .86;
    continuityRing.scale.setScalar(Math.max(.001, continuity));
    continuityRing.rotation.z = mix(-.8, 0, continuity);
    coreLabel.position.set(0, .72, .15);
    coreLabel.userData.textSurface.opacity = smooth(.42, .58, progress) * (1 - smooth(.78, .92, progress));
    continuityLabel.position.set(0, .65, .4);
    continuityLabel.userData.textSurface.opacity = smooth(.76, .9, progress);
    root.rotation.x = mix(-.04, -.43, continuity);
    root.rotation.y = mix(.35, -.1, coordinate);
    camera.position.set(mix(4.0, .15, coordinate), mix(4.0, 3.0, continuity), mix(11, 4.2, coordinate));
    camera.lookAt(0, mix(.35, 0, continuity), 0);
    faceCamera(...moduleLabels, coreLabel, continuityLabel);
  }

  return { update, resize, getStage: () => currentStage, textPlanes: moduleLabels.length + 2 };
}

function createProfessionalScene({ root, camera, geometry, material, lineMaterial, addMesh, createTextPlane, faceCamera, surfaces }) {
  const pointShape = geometry(new THREE.SphereGeometry(1, 16, 12));
  const markerShape = geometry(new THREE.SphereGeometry(1, 24, 16));
  const gateShape = geometry(new THREE.TorusGeometry(.78, .025, 8, 44));
  const possibilities = [];
  const pointSurfaces = [];
  for (let index = 0; index < 12; index++) {
    const surface = material(index % 4 === 0 ? 0x72b49f : 0xb8d3c6, { transparent: true, opacity: .72 });
    pointSurfaces.push(surface);
    possibilities.push(addMesh(pointShape, surface));
  }
  const gates = [0, 1, 2].map(() => addMesh(gateShape, surfaces.pale));
  const marker = addMesh(markerShape, surfaces.green);
  const presence = addMesh(geometry(new THREE.BoxGeometry(1.55, .04, 1.55)), surfaces.ink);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.35, .65, 3.2),
    new THREE.Vector3(.8, -.35, 1.25),
    new THREE.Vector3(-.55, .4, -.8),
    new THREE.Vector3(0, 0, -3.1)
  ]);
  const pathShape = geometry(new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)));
  const pathSurface = lineMaterial(0x65aa95, { opacity: .66 });
  const path = new THREE.Line(pathShape, pathSurface);
  root.add(path);
  const arrivalRing = addMesh(geometry(new THREE.TorusGeometry(1.05, .035, 8, 64)), surfaces.mint);
  arrivalRing.position.z = -3.08;
  arrivalRing.rotation.x = Math.PI / 2;
  gates.forEach((gate, index) => {
    gate.position.z = 1.55 - index * 2;
    gate.rotation.x = Math.PI / 2;
  });
  presence.position.z = -3.15;
  presence.visible = false;
  const labels = [
    createTextPlane('POSSIBILIDADES', { width: 3.15, height: .38, color: '#55766d', fontSize: 74 }),
    createTextPlane('SELEÇÃO', { width: 1.95, height: .38, color: '#123541', fontSize: 88 }),
    createTextPlane('CONTEXTO', { width: 2.35, height: .38, color: '#16715f', fontSize: 82 }),
    createTextPlane('PRESENÇA', { width: 2.35, height: .42, color: '#123541', fontSize: 88 })
  ];
  let compactLayout = false;
  let currentStage = 1;

  function resize({ compact }) {
    compactLayout = compact;
    camera.fov = compact ? 48 : 40;
    camera.updateProjectionMatrix();
  }

  function update(progress) {
    currentStage = Math.min(4, Math.floor(progress * 4) + 1);
    const select = smooth(.08, .4, progress);
    const contextualize = smooth(.38, .76, progress);
    const arrive = smooth(.72, 1, progress);
    possibilities.forEach((point, index) => {
      const angle = index * 2.18;
      const start = new THREE.Vector3(Math.cos(angle) * (1.6 + index % 3 * .28), Math.sin(angle * .7) * 1.4, 3.3 - index * .46);
      const target = curve.getPoint(clamp(index / 13));
      point.position.lerpVectors(start, target, select);
      point.scale.setScalar(.055 + (index % 3) * .012);
      pointSurfaces[index].opacity = mix(.72, index % 3 === 0 ? .72 : .18, contextualize);
    });
    const current = curve.getPoint(progress);
    marker.position.copy(current);
    marker.scale.setScalar(mix(.12, .24, arrive));
    gates.forEach((gate, index) => {
      const gateProgress = .26 + index * .22;
      const emphasis = 1 - Math.min(1, Math.abs(progress - gateProgress) * 5);
      gate.scale.setScalar(1 + emphasis * .32);
      gate.rotation.z = mix((index - 1) * .22, 0, contextualize);
      const label = labels[index];
      label.position.set(gate.position.x, gate.position.y + 1.02, gate.position.z);
      const center = .14 + index * .24;
      label.userData.textSurface.opacity = smooth(center - .12, center - .03, progress) * (1 - smooth(center + .14, center + .24, progress));
    });
    presence.visible = progress > .7;
    presence.scale.set(Math.max(.001, arrive * 1.2), Math.max(.001, arrive), Math.max(.001, arrive * 1.2));
    arrivalRing.scale.setScalar(Math.max(.001, arrive));
    arrivalRing.rotation.z = mix(-.8, 0, arrive);
    labels[3].position.set(0, compactLayout ? .55 : 1.1, -3.05);
    labels[3].userData.textSurface.opacity = smooth(.7, .86, progress);
    pathSurface.opacity = mix(.25, .82, select);
    root.rotation.y = mix(-.18, .06, contextualize);
    const currentCamera = curve.getPoint(clamp(progress * .82));
    const ahead = curve.getPoint(clamp(progress * .82 + .16));
    camera.position.set(
      currentCamera.x + mix(compactLayout ? 2.4 : 3.2, compactLayout ? 1.0 : 1.3, arrive),
      currentCamera.y + mix(compactLayout ? 2.1 : 1.9, 1.2, contextualize),
      currentCamera.z + mix(compactLayout ? 5.0 : 5.5, compactLayout ? 4.2 : 4.5, arrive)
    );
    camera.lookAt(ahead.x, ahead.y, ahead.z);
    faceCamera(...labels);
  }

  return { update, resize, getStage: () => currentStage, textPlanes: labels.length };
}
