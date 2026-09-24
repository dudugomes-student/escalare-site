const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const cleanups = [];
const sceneStates = new Map();
let sceneModulePromise;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function onFrameScroll(callback) {
  let frame = 0;
  const update = () => {
    frame = 0;
    callback();
  };
  const request = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', request, { passive: true });
  callback();
  cleanups.push(() => {
    removeEventListener('scroll', request);
    removeEventListener('resize', request);
    if (frame) cancelAnimationFrame(frame);
  });
}

function observeOnce(element, activeClass) {
  if (!element) return;
  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    element.classList.add(activeClass);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    element.classList.add(activeClass);
    observer.disconnect();
  }, { threshold: .28, rootMargin: '0px 0px -8%' });
  observer.observe(element);
  cleanups.push(() => observer.disconnect());
}

function sceneProgress(element) {
  const rect = element.getBoundingClientRect();
  const travel = Math.max(innerHeight * .82, rect.height * .92);
  return clamp((innerHeight * .82 - rect.top) / travel);
}

function setInternalSceneProgress(host, progress) {
  if (!host) return;
  const value = clamp(progress);
  host.dataset.sceneProgress = value.toFixed(4);
  sceneStates.get(host)?.controller?.update(value);
}

function initSteppedHero(selector, datasetKey, states) {
  const scene = document.querySelector(selector);
  if (!scene) return;
  const story = scene.closest('.hero-split') || scene;
  const renderHost = scene.querySelector('[data-internal-scene]');
  const setFinal = () => {
    scene.dataset[datasetKey] = states.at(-1);
    scene.style.setProperty('--scene-progress', '1');
    setInternalSceneProgress(renderHost, 1);
  };
  if (reducedMotion.matches) {
    setFinal();
  } else {
    scene.dataset[datasetKey] = states[0];
  }

  let start = 0;
  let travel = 1;
  const measure = () => {
    scene.classList.add('is-measuring');
    const headerHeight = document.querySelector('.site-header')?.offsetHeight || 80;
    const sceneTop = scrollY + scene.getBoundingClientRect().top;
    const storyBottom = scrollY + story.getBoundingClientRect().bottom;
    start = innerWidth <= 700
      ? Math.max(0, sceneTop - innerHeight * .68)
      : Math.max(0, sceneTop - headerHeight - 24);
    travel = Math.max(innerHeight * .72, storyBottom - scene.offsetHeight - start);
    scene.classList.remove('is-measuring');
  };
  measure();
  addEventListener('resize', measure, { passive: true });
  document.fonts?.ready.then(measure);
  cleanups.push(() => removeEventListener('resize', measure));

  onFrameScroll(() => {
    if (reducedMotion.matches) {
      setFinal();
      return;
    }
    const progress = clamp((scrollY - start) / travel);
    const index = Math.min(states.length - 1, Math.floor(progress * states.length));
    scene.dataset[datasetKey] = states[index];
    scene.style.setProperty('--scene-progress', String(progress));
    setInternalSceneProgress(renderHost, progress);
  });
}

function initCoordinationStory() {
  const scene = document.querySelector('[data-coordination-field]');
  const story = scene?.closest('.page-hero');
  const renderHost = scene?.querySelector('[data-internal-scene]');
  if (!scene || !story) return;

  const states = ['fragmented', 'recognition', 'coordination', 'continuity'];
  let start = 0;
  let end = 1;
  const setProgress = progress => {
    const value = clamp(progress);
    const index = Math.min(states.length - 1, Math.floor(value * states.length));
    scene.dataset.coordinationState = states[index];
    scene.style.setProperty('--scene-progress', String(value));
    setInternalSceneProgress(renderHost, value);
  };

  const setFinal = () => setProgress(1);
  if (reducedMotion.matches) setFinal();
  else setProgress(0);

  const measure = () => {
    scene.style.setProperty('--coordination-pin-offset', '0px');
    scene.classList.add('is-measuring');
    const headerHeight = document.querySelector('.site-header')?.offsetHeight || 80;
    const stickyTop = headerHeight + (innerHeight < 620 ? 12 : 28);
    const sceneTop = scrollY + scene.getBoundingClientRect().top;
    const storyTop = scrollY + story.getBoundingClientRect().top;
    start = sceneTop - stickyTop;
    end = storyTop + story.offsetHeight - scene.offsetHeight - stickyTop;
    scene.classList.remove('is-measuring');
  };

  measure();
  const onResize = () => measure();
  addEventListener('resize', onResize, { passive: true });
  cleanups.push(() => removeEventListener('resize', onResize));
  document.fonts?.ready.then(measure);

  onFrameScroll(() => {
    if (reducedMotion.matches) {
      scene.style.setProperty('--coordination-pin-offset', '0px');
      setFinal();
      return;
    }

    const pinTravel = Math.max(0, end - start);
    const pinOffset = innerWidth <= 900 ? clamp(scrollY - start, 0, pinTravel) : 0;
    scene.style.setProperty('--coordination-pin-offset', `${pinOffset}px`);
    const travel = Math.max(end - start, innerHeight * 2.2);
    setProgress(Math.max(0, scrollY - start) / travel);
  });
}

function initCompositionStory() {
  const story = document.querySelector('.composition-story');
  const board = document.querySelector('[data-composition-board]');
  const steps = [...document.querySelectorAll('[data-composition-step]')];
  if (!story || !board || !steps.length) return;

  const controls = board.querySelector('[data-process-controls]');
  const note = board.querySelector('[data-process-note]');
  const renderHost = board.querySelector('[data-internal-scene]');
  const states = steps.map(step => step.dataset.compositionStep);
  const messages = {
    demand: 'Os períodos revelam o espaço que o planejamento precisa organizar.',
    context: 'Setores e necessidades dão contexto à estrutura temporal.',
    people: 'As disponibilidades entram na leitura da operação.',
    allocation: 'Posições começam a relacionar pessoas e períodos.',
    routine: 'A leitura conjunta torna pontos de alinhamento visíveis.',
    organized: 'Profissionais e períodos se conectam em uma escala compreensível.'
  };

  const setState = (state, announce = false) => {
    board.dataset.processState = state;
    steps.forEach(step => step.classList.toggle('is-current', step.dataset.compositionStep === state));
    controls?.querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.process === state));
    });
    if (announce && note && messages[state]) note.textContent = messages[state];
  };

  if (controls) {
    controls.hidden = false;
    controls.querySelectorAll('button').forEach(button => {
      const onClick = () => {
        const state = button.dataset.process;
        setState(state, true);
        setInternalSceneProgress(renderHost, states.indexOf(state) / (states.length - 1));
      };
      button.addEventListener('click', onClick);
      cleanups.push(() => button.removeEventListener('click', onClick));
    });
  }

  const setFinal = () => {
    setState(states.at(-1));
    board.style.setProperty('--process-progress', '1');
    setInternalSceneProgress(renderHost, 1);
  };
  if (reducedMotion.matches) {
    setFinal();
  }

  onFrameScroll(() => {
    if (reducedMotion.matches) {
      setFinal();
      return;
    }
    const rect = story.getBoundingClientRect();
    const travel = Math.max(story.offsetHeight - innerHeight * .18, innerHeight * 1.15);
    const progress = clamp((innerHeight * .7 - rect.top) / travel);
    const index = Math.min(states.length - 1, Math.floor(progress * states.length));
    setState(states[index]);
    board.style.setProperty('--process-progress', String(progress));
    setInternalSceneProgress(renderHost, progress);
  });
}

function initProfessionalRoute() {
  const story = document.querySelector('[data-professional-story]');
  if (!story) return;
  const route = story.querySelector('[data-professional-route]');
  const steps = [...story.querySelectorAll('[data-route-step]')];
  const renderHost = route?.querySelector('[data-internal-scene]');
  if (!route || !steps.length) return;

  const setProgress = progress => {
    const value = clamp(progress);
    const position = 8 + value * 84;
    route.style.setProperty('--route-progress', `${position}%`);
    route.style.setProperty('--journey-progress', String(value));
    const active = Math.min(steps.length - 1, Math.floor(value * steps.length));
    steps.forEach((step, index) => step.classList.toggle('is-current', index === active));
    route.dataset.journeyStage = String(Math.min(4, Math.floor(value * 4) + 1));
    setInternalSceneProgress(renderHost, value);
  };

  if (reducedMotion.matches) {
    setProgress(1);
    steps.forEach(step => step.classList.remove('is-current'));
  }

  onFrameScroll(() => {
    if (reducedMotion.matches) {
      setProgress(1);
      return;
    }
    const rect = story.getBoundingClientRect();
    const travel = Math.max(rect.height - innerHeight * .18, innerHeight * .75);
    setProgress(clamp((innerHeight * .72 - rect.top) / travel));
  });
}

function initMethodStory() {
  const method = document.querySelector('[data-method-composition]');
  if (!method) return;
  const setProgress = progress => {
    const value = clamp(progress);
    const stage = Math.min(4, Math.floor(value * 4) + 1);
    method.dataset.methodStage = String(stage);
    method.style.setProperty('--method-progress', String(value));
    method.classList.toggle('is-resolved', stage === 4);
  };
  if (reducedMotion.matches) {
    setProgress(1);
  }
  onFrameScroll(() => {
    if (reducedMotion.matches) {
      setProgress(1);
      return;
    }
    setProgress(sceneProgress(method));
  });
}

function initEditorialIndex() {
  const shelf = document.querySelector('[data-editorial-shelf]');
  if (shelf) observeOnce(shelf, 'is-indexed');
}

function createWebGL2Surface(compatibilityOnly = false) {
  const makeCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    return canvas;
  };
  if (!compatibilityOnly) {
    const canvas = makeCanvas();
    try {
      const context = canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: true
      });
      if (context) return { canvas, context, compatibility: false };
    } catch {
      // A second full-quality request without the caveat veto is attempted below.
    }
    const retryCanvas = makeCanvas();
    try {
      const context = retryCanvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      });
      if (context) return { canvas: retryCanvas, context, compatibility: false };
    } catch {
      // The compatible WebGL2 configuration below is the next capability step.
    }
  }
  const canvas = makeCanvas();
  try {
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false
    });
    return context ? { canvas, context, compatibility: true } : null;
  } catch {
    return null;
  }
}

function disposeSceneState(state) {
  const controller = state.controller;
  const surface = state.surface;
  state.controller = null;
  state.surface = null;
  state.host?.closest('[data-coordination-field], [data-composition-board], [data-professional-route]')?.classList.remove('has-internal-webgl');
  if (controller) {
    controller.dispose();
  } else if (surface) {
    surface.canvas.remove();
    surface.context.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

function useSemanticFallback(host, reason) {
  const state = sceneStates.get(host);
  if (!state) return;
  state.generation++;
  disposeSceneState(state);
  host.classList.remove('has-webgl');
  host.closest('[data-coordination-field], [data-composition-board], [data-professional-route]')?.classList.remove('has-internal-webgl');
  host.dataset.renderMode = reason;
}

async function startInternalScene(host, compatibilityOnly = false) {
  const state = sceneStates.get(host);
  if (!state) return;
  const ticket = ++state.generation;
  disposeSceneState(state);
  host.classList.remove('has-webgl');

  if (reducedMotion.matches) {
    host.dataset.renderMode = 'reduced-motion';
    return;
  }

  const surface = createWebGL2Surface(compatibilityOnly);
  if (!surface) {
    useSemanticFallback(host, 'semantic-fallback');
    return;
  }
  state.surface = surface;
  host.dataset.renderMode = surface.compatibility ? 'compatibility-loading' : 'full-loading';
  host.append(surface.canvas);

  const retryOrFallback = reason => {
    if (ticket !== state.generation) return;
    if (!surface.compatibility) startInternalScene(host, true);
    else useSemanticFallback(host, `semantic-fallback-${reason}`);
  };

  try {
    sceneModulePromise ||= import('./internal-scenes.js');
    const module = await sceneModulePromise;
    if (ticket !== state.generation) {
      surface.context.getExtension('WEBGL_lose_context')?.loseContext();
      surface.canvas.remove();
      return;
    }
    const controller = module.createInternalScene(host, surface.canvas, surface.context, {
      type: state.type,
      compatibility: surface.compatibility,
      onFailure: retryOrFallback
    });
    state.controller = controller;
    await controller.prepare();
    if (ticket !== state.generation) {
      controller.dispose();
      return;
    }
    controller.update(Number(host.dataset.sceneProgress || 0));
    host.classList.add('has-webgl');
    host.closest('[data-coordination-field], [data-composition-board], [data-professional-route]')?.classList.add('has-internal-webgl');
    host.dataset.renderMode = surface.compatibility ? 'compatibility' : 'full';
    host.getSceneDiagnostics = () => ({ renderMode: host.dataset.renderMode, ...controller.getDiagnostics() });
  } catch (error) {
    console.warn('[Escalare internal scene] Enhancement failed; preserving the semantic scene.', error);
    state.controller?.dispose();
    state.controller = null;
    surface.canvas.remove();
    retryOrFallback('initialization');
  }
}

function initInternalScenes() {
  document.querySelectorAll('[data-internal-scene]').forEach(host => {
    sceneStates.set(host, {
      host,
      type: host.dataset.internalScene,
      generation: 0,
      surface: null,
      controller: null
    });
    startInternalScene(host);
  });
}

function applyReducedState() {
  document.querySelector('[data-system-map]')?.setAttribute('data-scene-state', 'system');
  document.querySelector('[data-coordination-field]')?.setAttribute('data-coordination-state', 'continuity');
  document.querySelector('[data-composition-board]')?.setAttribute('data-process-state', 'organized');
  const route = document.querySelector('[data-professional-route]');
  route?.style.setProperty('--route-progress', '92%');
  const method = document.querySelector('[data-method-composition]');
  if (method) {
    method.dataset.methodStage = '4';
    method.classList.add('is-resolved');
  }
  document.querySelector('[data-editorial-shelf]')?.classList.add('is-indexed');
  document.querySelector('[data-contact-connection]')?.classList.add('is-connected');
}

function initExperience() {
  initSteppedHero('[data-system-map]', 'sceneState', ['parts', 'proximity', 'relations', 'system']);
  initCoordinationStory();
  initCompositionStory();
  initProfessionalRoute();
  initMethodStory();
  observeOnce(document.querySelector('[data-contact-connection]'), 'is-connected');
  initEditorialIndex();
  document.documentElement.classList.add('internal-experience-ready');
  requestAnimationFrame(() => requestAnimationFrame(initInternalScenes));
}

const onPreferenceChange = () => {
  if (reducedMotion.matches) {
    applyReducedState();
    sceneStates.forEach((_, host) => useSemanticFallback(host, 'reduced-motion'));
  } else {
    sceneStates.forEach((_, host) => startInternalScene(host));
    dispatchEvent(new Event('resize'));
  }
};

initExperience();
reducedMotion.addEventListener('change', onPreferenceChange);
cleanups.push(() => reducedMotion.removeEventListener('change', onPreferenceChange));

addEventListener('pagehide', () => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  sceneStates.forEach(state => disposeSceneState(state));
  sceneStates.clear();
}, { once: true });
