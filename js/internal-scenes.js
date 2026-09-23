import * as THREE from './vendor/three.module.min.js';

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compatibility ? 1 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = !compatibility;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 60);
  const root = new THREE.Group();
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0xf6fff8, 0x31505a, 2.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xf7fff8, 3.5);
  key.position.set(-4, 7, 6);
  key.castShadow = !compatibility;
  key.shadow.mapSize.set(768, 768);
  key.shadow.normalBias = .035;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fcab4, 1.5);
  rim.position.set(5, 2, -5);
  scene.add(rim);

  const geometries = new Set();
  const materials = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({
      color,
      roughness: .78,
      metalness: .04,
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
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateScene.resize?.({ width, height, compact: width < 520 || width / height < .85 });
    requestRender();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
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
        renders,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        pixelRatio: renderer.getPixelRatio()
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.remove();
      updateScene.dispose?.();
      for (const shape of geometries) shape.dispose();
      for (const surface of materials) surface.dispose();
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

function createManagementScene({ root, camera, geometry, lineMaterial, addMesh, surfaces }) {
  const cellShape = geometry(new THREE.BoxGeometry(1, 1, 1));
  const markerShape = geometry(new THREE.SphereGeometry(1, 14, 10));
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
      Math.cos(angle) * (2.1 + index % 3 * .38),
      Math.sin(index * .9) * 1.25,
      Math.sin(angle) * (1.8 + index % 4 * .26)
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

  function resize({ compact }) {
    camera.fov = compact ? 41 : 35;
    camera.updateProjectionMatrix();
  }

  function update(progress) {
    const assemble = smooth(.08, .82, progress);
    const populate = smooth(.34, .84, progress);
    const flatten = smooth(.62, 1, progress);
    cells.forEach((cell, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const target = new THREE.Vector3((column - 2) * .76, 0, (row - 1.5) * .61);
      cell.position.lerpVectors(starts[index], target, assemble);
      cell.rotation.set(
        mix((index % 3 - 1) * .48, 0, assemble),
        mix((index % 4 - 1.5) * .32, 0, assemble),
        mix((index % 2 ? 1 : -1) * .18, 0, assemble)
      );
      cell.scale.set(mix(.32, .7, assemble), mix(.32, .08, flatten), mix(.32, .52, assemble));
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
    gridSurface.opacity = smooth(.55, .95, progress) * .72;
    root.rotation.x = mix(-.18, -.58, flatten);
    root.rotation.y = mix(-.52, -.04, assemble);
    camera.position.set(mix(0, .2, flatten), mix(4.7, 4.9, flatten), mix(7.5, 4.9, flatten));
    camera.lookAt(0, 0, 0);
  }

  return { update, resize };
}

function createInstitutionScene({ root, camera, geometry, lineMaterial, addMesh, surfaces }) {
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
  const origins = [
    new THREE.Vector3(-3.4, 1.4, 1.8),
    new THREE.Vector3(3.2, -.8, 2.4),
    new THREE.Vector3(-2.7, -1.4, -2.5),
    new THREE.Vector3(3.6, 1.1, -1.8)
  ];
  const targets = [
    new THREE.Vector3(-1.35, 0, .9),
    new THREE.Vector3(1.35, 0, .9),
    new THREE.Vector3(-1.35, 0, -.9),
    new THREE.Vector3(1.35, 0, -.9)
  ];

  function resize({ compact }) {
    camera.fov = compact ? 44 : 37;
    camera.updateProjectionMatrix();
  }

  function update(progress) {
    const recognize = smooth(.12, .46, progress);
    const coordinate = smooth(.34, .82, progress);
    const continuity = smooth(.72, 1, progress);
    modules.forEach((module, index) => {
      module.position.lerpVectors(origins[index], targets[index], coordinate);
      module.rotation.set(
        mix((index - 1.5) * .22, 0, coordinate),
        mix((index % 2 ? 1 : -1) * .58, 0, coordinate),
        mix((index % 2 ? 1 : -1) * .16, 0, coordinate)
      );
      module.scale.set(mix(.62, 1.05, recognize), mix(.72, .2, continuity), mix(.62, .7, coordinate));
    });
    core.scale.setScalar(mix(.52, 1, recognize));
    core.position.y = mix(-.9, .04, recognize);
    core.rotation.y = mix(-.75, 0, coordinate);
    surfaces.ink.opacity = 1 - smooth(.28, .58, progress);
    const positions = lineShape.attributes.position;
    modules.forEach((module, index) => {
      positions.setXYZ(index * 2, module.position.x, module.position.y, module.position.z);
      positions.setXYZ(index * 2 + 1, 0, .04, 0);
    });
    positions.needsUpdate = true;
    connectionSurface.opacity = smooth(.22, .7, progress) * .82;
    root.rotation.x = mix(-.08, -.46, continuity);
    root.rotation.y = mix(.22, -.12, coordinate);
    camera.position.set(mix(.4, 0, coordinate), mix(4.2, 5.3, continuity), mix(8.6, 6.4, coordinate));
    camera.lookAt(0, 0, 0);
  }

  return { update, resize };
}

function createProfessionalScene({ root, camera, geometry, material, lineMaterial, addMesh, surfaces }) {
  const pointShape = geometry(new THREE.SphereGeometry(1, 12, 8));
  const markerShape = geometry(new THREE.SphereGeometry(1, 20, 14));
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
  gates.forEach((gate, index) => {
    gate.position.z = 1.55 - index * 2;
    gate.rotation.x = Math.PI / 2;
  });
  presence.position.z = -3.15;
  presence.visible = false;

  function resize({ compact }) {
    camera.fov = compact ? 48 : 40;
    camera.updateProjectionMatrix();
  }

  function update(progress) {
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
    marker.scale.setScalar(mix(.12, .2, arrive));
    gates.forEach((gate, index) => {
      const gateProgress = .26 + index * .22;
      const emphasis = 1 - Math.min(1, Math.abs(progress - gateProgress) * 5);
      gate.scale.setScalar(1 + emphasis * .22);
      gate.rotation.z = mix((index - 1) * .22, 0, contextualize);
    });
    presence.visible = progress > .7;
    presence.scale.setScalar(Math.max(.001, arrive));
    pathSurface.opacity = mix(.25, .82, select);
    root.rotation.y = mix(-.14, .1, contextualize);
    camera.position.set(mix(0, .15, arrive), mix(1.5, 1.1, contextualize), mix(9.4, 7.7, contextualize));
    camera.lookAt(0, 0, mix(.4, -.6, progress));
  }

  return { update, resize };
}
