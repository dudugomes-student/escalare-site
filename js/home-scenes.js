import * as THREE from './vendor/three.module.min.js';

const clamp = value => THREE.MathUtils.clamp(value, 0, 1);
const mix = THREE.MathUtils.lerp;
const smooth = (from, to, value) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
const windowed = (from, to, value) => smooth(from, from + .08, value) * (1 - smooth(to - .08, to, value));

export function createHomeScene(host, canvas, context, {
  type,
  compatibility = false,
  onFailure
}) {
  const dark = type === 'convergence';
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
  renderer.toneMappingExposure = dark ? 1.3 : 1.16;
  renderer.shadowMap.enabled = !compatibility;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.HemisphereLight(dark ? 0xa9e6d4 : 0xf8fff9, dark ? 0x071b2c : 0x56716b, dark ? 2.1 : 2.8));
  const key = new THREE.DirectionalLight(dark ? 0xc9fff0 : 0xffffff, dark ? 4.4 : 3.7);
  key.position.set(-5, 8, 7);
  key.castShadow = !compatibility;
  key.shadow.mapSize.set(compatibility ? 512 : 1024, compatibility ? 512 : 1024);
  key.shadow.normalBias = .035;
  scene.add(key);
  const rim = new THREE.DirectionalLight(dark ? 0x42c4a4 : 0x69b9a3, dark ? 3.1 : 1.8);
  rim.position.set(6, 3, -6);
  scene.add(rim);

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, options = {}) => {
    const value = new THREE.MeshStandardMaterial({
      color,
      roughness: .76,
      metalness: .035,
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
    width = 2.6,
    height = .42,
    color = dark ? '#dff8ef' : '#123541',
    fontSize = 84,
    weight = 600,
    align = 'center'
  } = {}) => {
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 1024;
    textCanvas.height = 256;
    const paint = textCanvas.getContext('2d');
    paint.clearRect(0, 0, textCanvas.width, textCanvas.height);
    paint.fillStyle = color;
    paint.font = `${weight} ${fontSize}px "Plus Jakarta Sans", Inter, sans-serif`;
    paint.textAlign = align;
    paint.textBaseline = 'middle';
    const x = align === 'left' ? 30 : align === 'right' ? 994 : 512;
    paint.fillText(text, x, 128, 964);
    const texture = new THREE.CanvasTexture(textCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = compatibility ? 1 : 4;
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

  const surfaces = {
    ink: material(dark ? 0x173e48 : 0x123541),
    green: material(0x23806d),
    mint: material(0x83cbb6),
    paper: material(dark ? 0x214953 : 0xe9f0ea),
    pale: material(dark ? 0x315e61 : 0xbfd4c8),
    white: material(dark ? 0x5b9388 : 0xf7faf7)
  };
  const sceneController = createSceneByType(type, {
    root,
    camera,
    geometry,
    material,
    lineMaterial,
    addMesh,
    createTextPlane,
    faceCamera,
    surfaces
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
  const render = () => {
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
  };
  const requestRender = () => {
    if (!frame && ready && !disposed && visible && !document.hidden) frame = requestAnimationFrame(render);
  };
  const update = value => {
    progress = clamp(value);
    sceneController.update(progress);
    requestRender();
  };
  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height || disposed) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    sceneController.resize?.({ width, height, compact: width < 620 || width / height < .82 });
    camera.updateProjectionMatrix();
    requestRender();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) requestRender();
    else if (frame) { cancelAnimationFrame(frame); frame = 0; }
  }, { rootMargin: '180px' });
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
    setVisible(value) {
      visible = value;
      if (visible) requestRender();
      else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    },
    getDiagnostics() {
      return {
        type,
        quality: compatibility ? 'compatibility' : 'full',
        progress,
        stage: sceneController.getStage?.() || Math.min(4, Math.floor(progress * 4) + 1),
        textPlanes: sceneController.textPlanes || 0,
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
      sceneController.dispose?.();
      for (const shape of geometries) shape.dispose();
      for (const surface of materials) surface.dispose();
      for (const texture of textures) texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
  };
}

function createSceneByType(type, tools) {
  if (type === 'scale') return createScaleScene(tools);
  if (type === 'human') return createHumanScene(tools);
  return createConvergenceScene(tools);
}

function createScaleScene({ root, camera, geometry, material, lineMaterial, addMesh, createTextPlane, faceCamera, surfaces }) {
  const cellShape = geometry(new THREE.BoxGeometry(1, 1, 1));
  const markerShape = geometry(new THREE.SphereGeometry(1, 18, 12));
  const cells = [];
  const starts = [];
  const targets = [];
  const columns = 5;
  const rows = 4;
  const activeIndex = 7;
  for (let index = 0; index < columns * rows; index++) {
    const surface = index === activeIndex ? surfaces.green : index % 4 === 0 ? surfaces.pale : surfaces.paper;
    const cell = addMesh(cellShape, surface);
    const column = index % columns;
    const row = Math.floor(index / columns);
    starts.push(new THREE.Vector3((column - 2) * .9, 0, (row - 1.5) * .74));
    targets.push(new THREE.Vector3((column - 2) * .9, (column - 2) * .12, (row - 1.5) * .74));
    cells.push(cell);
  }
  const markerSurfaces = [];
  const markers = Array.from({ length: 7 }, (_, index) => {
    const surface = material(index === 3 ? 0x123541 : 0x3b9a82, { transparent: true, opacity: 0 });
    markerSurfaces.push(surface);
    return addMesh(markerShape, surface);
  });
  const relationShape = geometry(new THREE.BufferGeometry());
  relationShape.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(markers.length * 2 * 3), 3));
  const relationSurface = lineMaterial(0x23806d, { opacity: 0 });
  const relations = new THREE.LineSegments(relationShape, relationSurface);
  root.add(relations);

  const labels = [
    createTextPlane('ONDE', { width: 1.55, height: .32, fontSize: 92 }),
    createTextPlane('QUANDO', { width: 2.15, height: .32, fontSize: 86 }),
    createTextPlane('QUEM', { width: 1.55, height: .32, fontSize: 92 }),
    createTextPlane('CONTEXTO', { width: 2.7, height: .38, color: '#15705f', fontSize: 86 })
  ];
  labels[0].position.set(-2.9, 1.55, .4);
  labels[1].position.set(2.7, 1.45, -.2);
  labels[2].position.set(-2.65, .9, -1.8);
  labels[3].position.set(.35, 1.95, -.65);
  const labelWindows = [[0, .33], [.2, .56], [.44, .79], [.68, 1.08]];

  const base = addMesh(geometry(new THREE.BoxGeometry(5.4, .08, 3.65)), material(0xdfe9e2, { transparent: true, opacity: .45 }));
  base.position.y = -.16;
  const focus = new THREE.Vector3();
  let currentStage = 1;

  function resize({ compact }) {
    camera.fov = compact ? 48 : 37;
  }

  function update(progress) {
    currentStage = Math.min(4, Math.floor(progress * 4) + 1);
    const depth = smooth(.12, .5, progress);
    const populate = smooth(.38, .69, progress);
    const relate = smooth(.6, .9, progress);
    const handoff = smooth(.9, 1, progress);
    cells.forEach((cell, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      cell.position.lerpVectors(starts[index], targets[index], depth);
      cell.position.y += Math.sin(index * 1.7) * .13 * depth * (1 - relate);
      cell.rotation.set(mix(0, -.08 + row * .025, depth), mix(0, (column - 2) * .045, depth), 0);
      const selected = index === activeIndex;
      const selectedScale = selected ? 1 + relate * .28 : 1;
      cell.scale.set(.78 * selectedScale, mix(.07, selected ? .28 : .13, depth) * selectedScale, .58 * selectedScale);
      if (selected) {
        cell.position.y += relate * .42 + handoff * 1.35;
        cell.position.z += handoff * 1.3;
        cell.scale.multiplyScalar(1 + handoff * .65);
      }
    });
    markers.forEach((marker, index) => {
      const cellIndex = [1, 4, 6, 7, 11, 14, 18][index];
      const target = cells[cellIndex].position;
      const angle = index * 1.77;
      marker.position.set(
        mix(Math.cos(angle) * 3.1, target.x, populate),
        mix(1.8 + index % 2 * .28, target.y + .28, populate),
        mix(Math.sin(angle) * 2.1, target.z, populate)
      );
      marker.scale.setScalar(Math.max(.001, .105 * populate * (1 - handoff * .35)));
      markerSurfaces[index].opacity = populate * mix(.5, 1, relate);
    });
    const positions = relationShape.attributes.position;
    markers.forEach((marker, index) => {
      positions.setXYZ(index * 2, marker.position.x, marker.position.y, marker.position.z);
      const selected = cells[activeIndex].position;
      positions.setXYZ(index * 2 + 1, selected.x, selected.y, selected.z);
    });
    positions.needsUpdate = true;
    relationSurface.opacity = relate * .68 * (1 - handoff);
    labels.forEach((label, index) => {
      const [from, to] = labelWindows[index];
      label.userData.textSurface.opacity = index === 3 ? smooth(from, from + .08, progress) : windowed(from, to, progress);
    });
    root.rotation.set(mix(-.08, -.26, depth), mix(-.45, .12, relate), 0);
    camera.position.set(mix(5.4, 2.2, relate), mix(5.2, 4.15, depth), mix(7.6, 6.1, relate));
    focus.copy(cells[activeIndex].position).multiplyScalar(relate * .38);
    camera.lookAt(focus);
    faceCamera(...labels);
  }

  return { update, resize, getStage: () => currentStage, textPlanes: labels.length };
}

function createHumanScene({ root, camera, geometry, material, lineMaterial, addMesh, createTextPlane, faceCamera, surfaces }) {
  const entrySurface = material(0x23806d, { transparent: true, opacity: 1 });
  const entryCell = addMesh(geometry(new THREE.BoxGeometry(2.7, .18, 1.75)), entrySurface);
  const body = new THREE.Group();
  root.add(body);
  const head = addMesh(geometry(new THREE.SphereGeometry(.68, 28, 20)), surfaces.ink, body);
  const torso = addMesh(geometry(new THREE.CylinderGeometry(.82, 1.15, 2.35, 28)), surfaces.green, body);
  const shoulder = addMesh(geometry(new THREE.TorusGeometry(1.2, .18, 10, 40, Math.PI)), surfaces.pale, body);
  shoulder.rotation.z = Math.PI;
  shoulder.rotation.x = Math.PI / 2;
  head.position.y = 1.55;
  torso.position.y = -.15;
  shoulder.position.y = -.98;
  const marker = addMesh(geometry(new THREE.SphereGeometry(.13, 18, 12)), surfaces.mint, body);
  marker.position.set(0, .2, .82);

  const panels = Array.from({ length: 9 }, (_, index) => {
    const panel = addMesh(geometry(new THREE.BoxGeometry(.9, .07, .66)), index === 4 ? surfaces.green : surfaces.paper);
    panel.userData.index = index;
    return panel;
  });
  const orbit = addMesh(geometry(new THREE.TorusGeometry(2.3, .018, 8, 80)), surfaces.mint);
  orbit.rotation.x = Math.PI / 2;
  const axisShape = geometry(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -1.8, 0),
    new THREE.Vector3(0, 2.25, 0)
  ]));
  const axisSurface = lineMaterial(0x72b7a4, { opacity: 0 });
  root.add(new THREE.Line(axisShape, axisSurface));

  const labels = [
    createTextPlane('CÉLULA DA ESCALA', { width: 3.7, height: .38, fontSize: 72 }),
    createTextPlane('PRESENÇA', { width: 2.55, height: .38, fontSize: 86 }),
    createTextPlane('CONTEXTO', { width: 2.55, height: .38, fontSize: 86 }),
    createTextPlane('CUIDADO', { width: 2.2, height: .38, color: '#16715f', fontSize: 90 })
  ];
  labels[0].position.set(0, 1.65, .1);
  labels[1].position.set(-2.15, 1.55, -.4);
  labels[2].position.set(2.15, .6, -.7);
  labels[3].position.set(0, 2.05, .45);
  let currentStage = 1;

  function resize({ compact }) {
    camera.fov = compact ? 50 : 39;
  }

  function update(progress) {
    currentStage = Math.min(4, Math.floor(progress * 4) + 1);
    const open = smooth(.12, .38, progress);
    const presence = smooth(.28, .58, progress);
    const context = smooth(.5, .8, progress);
    const care = smooth(.74, 1, progress);
    entrySurface.opacity = 1 - smooth(.18, .48, progress);
    entryCell.position.set(0, mix(0, -.7, open), mix(.5, -1.2, open));
    entryCell.rotation.set(mix(-.34, -1.1, open), mix(.2, 0, open), 0);
    entryCell.scale.set(mix(1, 1.5, open), mix(1, .25, open), mix(1, 1.4, open));

    const bodyScale = Math.max(.001, presence * mix(.8, .68, care));
    body.scale.set(bodyScale, bodyScale, bodyScale);
    body.position.y = mix(-1.25, -.05, presence);
    body.rotation.y = mix(-.75, .12, context);
    panels.forEach((panel, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const angle = index / 9 * Math.PI * 2;
      panel.position.set(
        mix((column - 1) * 1.02, Math.cos(angle) * 2.35, context),
        mix((row - 1) * .76, (row - 1) * .82, context),
        mix(-.8, Math.sin(angle) * 1.35 - .55, context)
      );
      panel.rotation.set(mix(-.9, -.16, context), mix(0, -angle + Math.PI / 2, context), 0);
      panel.scale.setScalar(Math.max(.001, open * mix(.78, 1, context)));
    });
    orbit.scale.setScalar(Math.max(.001, context));
    orbit.rotation.z = progress * .55;
    surfaces.mint.transparent = true;
    surfaces.mint.opacity = context * (1 - care * .3);
    axisSurface.opacity = context * .62;
    labels[0].userData.textSurface.opacity = windowed(0, .34, progress);
    labels[1].userData.textSurface.opacity = windowed(.22, .62, progress);
    labels[2].userData.textSurface.opacity = windowed(.48, .84, progress);
    labels[3].userData.textSurface.opacity = smooth(.72, .82, progress);

    root.rotation.y = mix(-.2, .18, context);
    camera.position.set(mix(4.4, 1.15, care), mix(2.1, 1.35, presence), mix(8.5, 6.1, context));
    camera.lookAt(0, mix(.1, .25, presence), mix(-.3, -.55, context));
    faceCamera(...labels);
  }

  return { update, resize, getStage: () => currentStage, textPlanes: labels.length };
}

function createConvergenceScene({ root, camera, geometry, material, lineMaterial, addMesh, createTextPlane, faceCamera, surfaces }) {
  const cellShape = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cells = [];
  const starts = [];
  const targets = [];
  for (let index = 0; index < 12; index++) {
    const cell = addMesh(cellShape, index % 4 === 0 ? surfaces.green : index % 3 === 0 ? surfaces.pale : surfaces.paper);
    const angle = index * 1.81;
    starts.push(new THREE.Vector3(Math.cos(angle) * (4.3 + index % 3), Math.sin(index * .83) * 2.8, Math.sin(angle) * 3.7));
    const column = index % 4;
    const row = Math.floor(index / 4);
    targets.push(new THREE.Vector3((column - 1.5) * 1.12, (row - 1) * .76, (column % 2 ? -.52 : .52)));
    cells.push(cell);
  }
  const nodeShape = geometry(new THREE.SphereGeometry(1, 16, 12));
  const nodes = Array.from({ length: 6 }, (_, index) => {
    const node = addMesh(nodeShape, index === 2 ? surfaces.mint : surfaces.green);
    return node;
  });
  const lineShape = geometry(new THREE.BufferGeometry());
  lineShape.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nodes.length * 2 * 3), 3));
  const lineSurface = lineMaterial(0x6ed0b7, { opacity: 0 });
  root.add(new THREE.LineSegments(lineShape, lineSurface));
  const platform = addMesh(geometry(new THREE.BoxGeometry(4.8, .12, 2.7)), material(0x123541, { transparent: true, opacity: .75 }));
  platform.position.y = -1.65;
  const continuityRing = addMesh(geometry(new THREE.TorusGeometry(2.2, .035, 10, 96)), surfaces.mint);
  continuityRing.rotation.x = Math.PI / 2;
  continuityRing.position.y = -1.48;

  const labels = [
    createTextPlane('COMPLEXIDADE', { width: 3.25, height: .4, color: '#8db8ae', fontSize: 76 }),
    createTextPlane('ORGANIZAÇÃO', { width: 3.25, height: .4, fontSize: 78 }),
    createTextPlane('CLAREZA', { width: 2.1, height: .4, fontSize: 88 }),
    createTextPlane('ESCALARE', { width: 3.45, height: .55, color: '#f1fbf7', fontSize: 108 }),
    createTextPlane('OPERAÇÃO · PESSOAS · CONTINUIDADE', { width: 4.6, height: .3, color: '#78cdb7', fontSize: 48, weight: 500 })
  ];
  labels[0].position.set(-2.5, 2.2, -.8);
  labels[1].position.set(2.2, 1.65, -.9);
  labels[2].position.set(-1.8, .9, .2);
  labels[3].position.set(.15, -.55, 1.05);
  labels[4].position.set(.15, -1.05, 1.05);
  let currentStage = 1;

  function resize({ compact }) {
    camera.fov = compact ? 50 : 38;
  }

  function update(progress) {
    currentStage = Math.min(4, Math.floor(progress * 4) + 1);
    const gather = smooth(.08, .48, progress);
    const organize = smooth(.3, .7, progress);
    const clarify = smooth(.58, .86, progress);
    const settle = smooth(.78, 1, progress);
    cells.forEach((cell, index) => {
      cell.position.lerpVectors(starts[index], targets[index], gather);
      cell.position.y = mix(cell.position.y, targets[index].y * .68, organize);
      cell.rotation.set(
        mix((index % 3 - 1) * .5, 0, organize),
        mix((index % 4 - 1.5) * .38, 0, organize),
        mix(index % 2 ? .3 : -.3, 0, clarify)
      );
      cell.scale.set(mix(.42, .88, gather), mix(.42, .12, clarify), mix(.42, .64, organize));
      if (index % 4 !== 0) cell.scale.multiplyScalar(mix(1, .72, settle));
    });
    nodes.forEach((node, index) => {
      const source = cells[index * 2].position;
      const target = cells[5 + index % 4].position;
      node.position.lerpVectors(source, target, .5);
      node.position.y += .26;
      node.scale.setScalar(Math.max(.001, .1 * smooth(.38, .62, progress)));
    });
    const positions = lineShape.attributes.position;
    nodes.forEach((node, index) => {
      positions.setXYZ(index * 2, node.position.x, node.position.y, node.position.z);
      positions.setXYZ(index * 2 + 1, 0, -.2, 0);
    });
    positions.needsUpdate = true;
    lineSurface.opacity = clarify * .72;
    continuityRing.scale.setScalar(Math.max(.001, settle));
    continuityRing.rotation.z = mix(-.7, 0, settle);
    labels[0].userData.textSurface.opacity = windowed(0, .38, progress);
    labels[1].userData.textSurface.opacity = windowed(.2, .64, progress);
    labels[2].userData.textSurface.opacity = windowed(.48, .84, progress);
    labels[3].userData.textSurface.opacity = smooth(.72, .88, progress);
    labels[4].userData.textSurface.opacity = smooth(.82, .96, progress);
    platform.scale.set(mix(.42, 1, settle), 1, mix(.42, 1, settle));
    root.rotation.set(mix(-.1, -.18, organize), mix(-.58, .04, settle), 0);
    camera.position.set(mix(5.8, .45, settle), mix(3.7, 2.8, clarify), mix(9.8, 7.2, organize));
    camera.lookAt(0, mix(.45, -.05, settle), 0);
    faceCamera(...labels);
  }

  return { update, resize, getStage: () => currentStage, textPlanes: labels.length };
}
