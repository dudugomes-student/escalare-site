const clamp = value => Math.min(1, Math.max(0, value));

const SCALE_STATES = [
  'A necessidade começa em um setor: um lugar dentro da operação.',
  'Períodos organizam a mesma necessidade no tempo.',
  'A presença profissional passa a ocupar uma posição compreensível.',
  'Setor, período e profissional formam um contexto.'
];

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
      // A compatible WebGL2 configuration is the next capability step.
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

export function createHomeNarrative({ gsap, ScrollTrigger }) {
  const scaleStory = document.querySelector('[data-scale-story]');
  const scaleStage = scaleStory?.querySelector('.scale-stage');
  const scaleCopy = scaleStory?.querySelector('[data-scale-copy]');
  const humanStory = document.querySelector('[data-human-story]');
  const humanStage = humanStory?.querySelector('.human-stage');
  const convergence = document.querySelector('[data-convergence]');
  const convergenceStage = convergence?.querySelector('.convergence-stage');
  const header = document.getElementById('siteHeader');
  const animations = [];
  const sceneStates = new Map();
  const media = gsap.matchMedia();
  let sceneModulePromise;
  let lazyObserver;
  let scaleProgress = 0;
  let scaleStageIndex = -1;
  let disposed = false;

  const sceneParent = host => host.closest('.living-scale, .human-frame, [data-convergence]');
  const setSceneProgress = (host, progress) => {
    if (!host) return;
    const value = clamp(progress);
    host.dataset.sceneProgress = value.toFixed(4);
    sceneStates.get(host)?.controller?.update(value);
  };
  const disposeScene = state => {
    if (!state) return;
    const { controller, surface, host } = state;
    state.controller = null;
    state.surface = null;
    host.classList.remove('has-webgl');
    sceneParent(host)?.classList.remove('has-home-webgl');
    if (controller) controller.dispose();
    else if (surface) {
      surface.canvas.remove();
      surface.context.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
  const useSemanticFallback = (state, reason) => {
    state.generation++;
    disposeScene(state);
    state.host.dataset.renderMode = reason;
  };

  async function startScene(state, compatibilityOnly = false) {
    if (!state || disposed) return;
    const ticket = ++state.generation;
    disposeScene(state);
    const surface = createWebGL2Surface(compatibilityOnly);
    if (!surface) {
      useSemanticFallback(state, 'semantic-fallback');
      return;
    }
    state.surface = surface;
    state.host.dataset.renderMode = surface.compatibility ? 'compatibility-loading' : 'full-loading';
    state.host.append(surface.canvas);

    const retryOrFallback = reason => {
      if (ticket !== state.generation || disposed) return;
      if (!surface.compatibility) startScene(state, true);
      else useSemanticFallback(state, `semantic-fallback-${reason}`);
    };
    try {
      sceneModulePromise ||= import('./home-scenes.js');
      const module = await sceneModulePromise;
      if (ticket !== state.generation || disposed) {
        surface.context.getExtension('WEBGL_lose_context')?.loseContext();
        surface.canvas.remove();
        return;
      }
      const controller = module.createHomeScene(state.host, surface.canvas, surface.context, {
        type: state.type,
        compatibility: surface.compatibility,
        onFailure: retryOrFallback
      });
      state.controller = controller;
      await controller.prepare();
      if (ticket !== state.generation || disposed) {
        controller.dispose();
        return;
      }
      controller.update(Number(state.host.dataset.sceneProgress || 0));
      state.host.classList.add('has-webgl');
      sceneParent(state.host)?.classList.add('has-home-webgl');
      state.host.dataset.renderMode = surface.compatibility ? 'compatibility' : 'full';
      state.host.getHomeSceneDiagnostics = () => ({
        renderMode: state.host.dataset.renderMode,
        ...controller.getDiagnostics()
      });
    } catch (error) {
      console.warn('[Escalare home scene] Enhancement failed; preserving the semantic composition.', error);
      state.controller?.dispose();
      state.controller = null;
      surface.canvas.remove();
      retryOrFallback('initialization');
    }
  }

  document.querySelectorAll('[data-home-scene]').forEach(host => {
    const state = {
      host,
      type: host.dataset.homeScene,
      generation: 0,
      controller: null,
      surface: null,
      started: false
    };
    sceneStates.set(host, state);
  });
  if ('IntersectionObserver' in window) {
    lazyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const state = sceneStates.get(entry.target);
        if (!state?.started) {
          state.started = true;
          startScene(state);
        }
        lazyObserver.unobserve(entry.target);
      });
    }, { rootMargin: '600px 0px' });
    sceneStates.forEach((_, host) => lazyObserver.observe(host));
  } else {
    sceneStates.forEach(state => {
      state.started = true;
      startScene(state);
    });
  }

  function setScaleStage(index) {
    if (!scaleStory || index === scaleStageIndex) return;
    scaleStageIndex = index;
    scaleStory.dataset.stage = String(index + 1);
    if (scaleCopy) scaleCopy.textContent = SCALE_STATES[index];
    scaleStory.querySelectorAll('[data-scale-chapter]').forEach((chapter, chapterIndex) => {
      const current = chapterIndex === index;
      chapter.classList.toggle('is-current', current);
      if (current) chapter.setAttribute('aria-current', 'step');
      else chapter.removeAttribute('aria-current');
    });
  }
  function setScaleProgress(value) {
    if (!scaleStory || disposed) return;
    scaleProgress = clamp(value);
    const index = Math.min(3, Math.floor(scaleProgress * 4));
    setScaleStage(index);
    setSceneProgress(scaleStory.querySelector('[data-home-scene="scale"]'), scaleProgress);
  }
  function setHumanProgress(value) {
    if (!humanStory || disposed) return;
    const progress = clamp(value);
    humanStory.dataset.stage = String(Math.min(4, Math.floor(progress * 4) + 1));
    setSceneProgress(humanStory.querySelector('[data-home-scene="human"]'), progress);
  }
  function setConvergenceProgress(value) {
    if (!convergence || disposed) return;
    const progress = clamp(value);
    convergence.dataset.stage = String(Math.min(4, Math.floor(progress * 4) + 1));
    setSceneProgress(convergence.querySelector('[data-home-scene="convergence"]'), progress);
  }

  const addTween = ({ trigger, pin, start, end, scrub, onProgress }) => {
    if (!trigger) return null;
    const playhead = { progress: 0 };
    const tween = gsap.to(playhead, {
      progress: 1,
      ease: 'none',
      onUpdate: () => onProgress(playhead.progress),
      scrollTrigger: {
        trigger,
        pin: pin || false,
        start,
        end,
        scrub,
        anticipatePin: pin ? 1 : 0,
        invalidateOnRefresh: true,
        onRefresh: () => onProgress(playhead.progress)
      }
    });
    animations.push(tween);
    onProgress(0);
    return tween;
  };

  media.add('(min-width: 701px)', () => {
    addTween({
      trigger: scaleStory,
      pin: scaleStage,
      start: () => `top ${header?.offsetHeight || 0}px`,
      end: () => `+=${Math.max(innerHeight * 2.7, 1800)}`,
      scrub: .58,
      onProgress: setScaleProgress
    });
    addTween({
      trigger: humanStory,
      pin: humanStage,
      start: () => `top ${header?.offsetHeight || 0}px`,
      end: () => `+=${Math.max(innerHeight * 2.15, 1450)}`,
      scrub: .62,
      onProgress: setHumanProgress
    });
    addTween({
      trigger: convergence,
      pin: convergenceStage,
      start: () => `top ${header?.offsetHeight || 0}px`,
      end: () => `+=${Math.max(innerHeight * 2.1, 1400)}`,
      scrub: .66,
      onProgress: setConvergenceProgress
    });
  });

  media.add('(max-width: 700px)', () => {
    const canPinCompactScene = matchMedia('(min-height: 651px)').matches;
    const compactStart = () => canPinCompactScene
      ? `top ${header?.offsetHeight || 0}px`
      : 'top 78%';

    addTween({
      trigger: scaleStory?.querySelector('.living-scale'),
      pin: canPinCompactScene ? scaleStory?.querySelector('.living-scale') : false,
      start: compactStart,
      end: () => `+=${Math.max(innerHeight * 1.85, 1050)}`,
      scrub: .42,
      onProgress: setScaleProgress
    });
    addTween({
      trigger: humanStory?.querySelector('.human-frame'),
      pin: canPinCompactScene ? humanStory?.querySelector('.human-frame') : false,
      start: compactStart,
      end: () => `+=${Math.max(innerHeight * 1.75, 980)}`,
      scrub: .44,
      onProgress: setHumanProgress
    });
    addTween({
      trigger: convergence,
      pin: canPinCompactScene ? convergenceStage : false,
      start: () => canPinCompactScene ? `top ${header?.offsetHeight || 0}px` : 'top 82%',
      end: () => `+=${Math.max(innerHeight * 1.8, 920)}`,
      scrub: .48,
      onProgress: setConvergenceProgress
    });
  });

  ScrollTrigger.refresh();

  if (scaleStory) {
    scaleStory.classList.add('is-narrative-enhanced');
    scaleStory.getScaleDiagnostics = () => ({
      stage: scaleStageIndex + 1,
      progress: scaleProgress,
      mode: matchMedia('(min-width: 701px)').matches ? 'pinned-webgl' : 'responsive-webgl'
    });
  }

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      lazyObserver?.disconnect();
      media.revert();
      animations.forEach(animation => {
        animation.scrollTrigger?.kill();
        animation.kill();
      });
      sceneStates.forEach(state => disposeScene(state));
      sceneStates.clear();
      if (scaleStory) {
        scaleStory.classList.remove('is-narrative-enhanced');
        scaleStory.dataset.stage = '4';
        delete scaleStory.getScaleDiagnostics;
      }
      if (humanStory) humanStory.dataset.stage = '4';
      if (convergence) convergence.dataset.stage = '4';
    }
  };
}
