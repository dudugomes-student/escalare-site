const story = document.querySelector('[data-operation-story]');
const host = document.querySelector('[data-operation-render]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 900px)');
const tablet = matchMedia('(min-width: 901px) and (max-width: 1180px)');
const connection = navigator.connection;
const stages = [
  ['Unidade de saúde', 'O cuidado começa com uma operação conectada.'],
  ['Setores conectados', 'Por dentro da unidade, cada setor tem seu contexto.'],
  ['Profissionais', 'Pessoas, setores e horários precisam funcionar juntos.'],
  ['Plantões e conexões', 'Pessoas e períodos se alinham em uma visão de conjunto.'],
  ['Da unidade à escala', 'Sala vira célula. Corredor vira divisão. Presença vira alocação.']
];
let scene;
let timeline;
let narrative;
let generation = 0;
let lastStage = -1;
let inView = true;
let disposed = false;
let failed = false;
const scriptPromises = new Map();

function createWebGL2Surface() {
  const attributes = { alpha: true, antialias: true, powerPreference: 'low-power' };
  let canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let context = null;
  try {
    context = canvas.getContext('webgl2', { ...attributes, failIfMajorPerformanceCaveat: true });
  } catch {
    /* Retry below with compatibility-oriented settings. */
  }
  if (context) return { canvas, context, compatibilityContext: false };

  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  try {
    context = canvas.getContext('webgl2', {
      ...attributes,
      antialias: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false
    });
  } catch {
    context = null;
  }
  return context ? { canvas, context, compatibilityContext: true } : null;
}

function loadScript(filename) {
  if (!scriptPromises.has(filename)) {
    scriptPromises.set(filename, new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => reject(new Error('Optional animation dependency timed out')), 12000);
      script.src = new URL(`vendor/${filename}`, import.meta.url).href;
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Optional animation dependency unavailable'));
      };
      document.head.append(script);
    }));
  }
  return scriptPromises.get(filename);
}

function updateOperationHandoff(progress) {
  const normalized = Math.min(1, Math.max(0, (progress - .88) / .12));
  const eased = normalized * normalized * (3 - 2 * normalized);
  story.style.setProperty('--handoff-opacity', String(eased));
  story.style.setProperty('--handoff-y', `${(1 - eased) * 10}px`);
  story.style.setProperty('--canvas-opacity', String(1 - eased));
}

function showStage(progress) {
  const index = progress < .16 ? 0 : progress < .36 ? 1 : progress < .57 ? 2 : progress < .79 ? 3 : 4;
  updateOperationHandoff(progress);
  if (index === lastStage) return;
  lastStage = index;
  story.dataset.stage = String(index + 1);
  story.querySelector('[data-operation-label]').textContent = stages[index][0];
  story.querySelector('[data-operation-message]').textContent = stages[index][1];
  story.querySelector('[data-operation-index]').textContent = `0${index + 1} / 05`;
  story.querySelectorAll('[data-chapter]').forEach((chapter, chapterIndex) => {
    const current = chapterIndex === index;
    chapter.classList.toggle('is-current', current);
    if (current) chapter.setAttribute('aria-current', 'step');
    else chapter.removeAttribute('aria-current');
  });
}

function teardownOperation() {
  timeline?.scrollTrigger?.kill();
  timeline?.kill();
  timeline = null;
  scene?.dispose();
  scene = null;
  story.classList.remove('is-webgl', 'is-enhanced');
  story.style.removeProperty('--handoff-opacity');
  story.style.removeProperty('--handoff-y');
  story.style.removeProperty('--canvas-opacity');
  lastStage = -1;
  showStage(0);
}

function teardown() {
  narrative?.dispose();
  narrative = null;
  teardownOperation();
}

function useFallback(reason) {
  generation++;
  failed = true;
  teardownOperation();
  story.dataset.mode = reason;
}

async function enhance() {
  const ticket = ++generation;
  teardown();
  if (disposed) return;
  if (reducedMotion.matches) {
    story.dataset.mode = 'reduced-motion';
    return;
  }

  story.dataset.mode = 'loading';
  try {
    await Promise.all([loadScript('gsap.min.js'), loadScript('ScrollTrigger.min.js')]);
    const narrativeModule = await import('./home-narrative.js');
    if (ticket !== generation || disposed) return;
    window.gsap.registerPlugin(window.ScrollTrigger);
    narrative = narrativeModule.createHomeNarrative({
      gsap: window.gsap,
      ScrollTrigger: window.ScrollTrigger
    });
  } catch (error) {
    console.warn('[Escalare experience] Motion enhancement failed; keeping the static narrative.', error);
    failed = true;
    if (ticket === generation) {
      teardown();
      story.dataset.mode = 'dependency-fallback';
    }
    return;
  }

  if (failed) {
    story.dataset.mode = 'static';
    return;
  }

  const surface = createWebGL2Surface();
  if (!surface) {
    story.dataset.mode = 'no-webgl';
    return;
  }

  const { canvas, context, compatibilityContext } = surface;
  const lowMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory < 4;
  const simplified = compatibilityContext || connection?.saveData === true || lowMemory;
  try {
    const module = await import('./operation-scene.js');
    if (ticket !== generation || disposed) {
      context.getExtension('WEBGL_lose_context')?.loseContext();
      return;
    }
    host.append(canvas);
    scene = module.createOperationScene(host, canvas, context, {
      mobile: compact.matches,
      tablet: tablet.matches,
      simplified,
      onFailure: () => useFallback('render-fallback')
    });
    await scene.prepare();
    if (ticket !== generation || disposed) return;
    scene.setVisible(inView);
    scene.renderNow();
    if (!scene) return;
    story.classList.add('is-webgl', 'is-enhanced');
    story.dataset.mode = compact.matches ? 'mobile-webgl' : 'desktop-webgl';
    const playhead = { progress: 0 };
    timeline = window.gsap.timeline({
      scrollTrigger: {
        trigger: compact.matches ? host : story,
        start: compact.matches ? 'clamp(top 65%)' : () => `top ${document.getElementById('siteHeader').offsetHeight}px`,
        end: compact.matches
          ? 'bottom 35%'
          : () => `+=${Math.max(1, story.offsetHeight - story.querySelector('.operation-stage').offsetHeight)}`,
        scrub: compact.matches ? .22 : .65,
        invalidateOnRefresh: true,
        onRefresh: () => {
          scene?.update(playhead.progress);
          showStage(playhead.progress);
        }
      }
    });
    timeline.to(playhead, {
      progress: 1,
      duration: 1,
      ease: 'none',
      onUpdate: () => {
        scene?.update(playhead.progress);
        showStage(playhead.progress);
      }
    });
    window.ScrollTrigger.refresh();
  } catch (error) {
    console.warn('[Escalare experience] WebGL enhancement failed; using the static operation while preserving the DOM narrative.', error);
    context.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
    if (ticket === generation) useFallback('render-fallback');
  }
}

const visibility = new IntersectionObserver(entries => {
  inView = entries[0].isIntersecting;
  scene?.setVisible(inView && !document.hidden);
}, { rootMargin: '80px' });

visibility.observe(story);

function onVisibility() {
  scene?.setVisible(inView && !document.hidden);
}

document.addEventListener('visibilitychange', onVisibility);
reducedMotion.addEventListener('change', enhance);
compact.addEventListener('change', enhance);
tablet.addEventListener('change', enhance);
connection?.addEventListener?.('change', enhance);

window.addEventListener('pagehide', () => {
  disposed = true;
  generation++;
  teardown();
});

window.addEventListener('pageshow', event => {
  if (event.persisted) {
    disposed = false;
    enhance();
  }
});

// Read-only diagnostics for local validation. No analytics or personal data.
story.getOperationDiagnostics = () => ({
  mode: story.dataset.mode,
  stage: lastStage + 1,
  ...(scene?.getDiagnostics() || {})
});

showStage(0);

// Let HTML, typography and the static composition paint before optional modules load.
requestAnimationFrame(() => requestAnimationFrame(() => {
  if ('requestIdleCallback' in window) requestIdleCallback(enhance, { timeout: 1800 });
  else setTimeout(enhance, 150);
}));
