const story = document.querySelector('[data-operation-story]');
const host = document.querySelector('[data-operation-render]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 900px)');
const tablet = matchMedia('(min-width: 901px) and (max-width: 1180px)');
const shortScreen = matchMedia('(max-height: 570px)');
const connection = navigator.connection;
const stages = [
  ['Unidade de saúde', 'O cuidado começa com uma operação conectada.'],
  ['Setores conectados', 'Por dentro da unidade, cada setor tem seu contexto.'],
  ['Profissionais', 'Pessoas, setores e horários precisam funcionar juntos.'],
  ['Plantões e conexões', 'Pessoas e períodos se alinham em uma visão de conjunto.'],
  ['Da unidade à escala', 'A mesma operação. Agora, uma escala compreensível.']
];
let scene;
let timeline;
let generation = 0;
let lastStage = -1;
let inView = true;
let disposed = false;
let failed = false;
const scriptPromises = new Map();

function loadScript(filename) {
  if (!scriptPromises.has(filename)) scriptPromises.set(filename, new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('Optional animation dependency timed out')), 12000);
    script.src = new URL(`vendor/${filename}`, import.meta.url).href;
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Optional animation dependency unavailable')); };
    document.head.append(script);
  }));
  return scriptPromises.get(filename);
}

function showStage(progress) {
  const index = progress < .16 ? 0 : progress < .36 ? 1 : progress < .57 ? 2 : progress < .79 ? 3 : 4;
  if (index === lastStage) return;
  lastStage = index;
  story.dataset.stage = String(index + 1);
  story.querySelector('[data-operation-label]').textContent = stages[index][0];
  story.querySelector('[data-operation-message]').textContent = stages[index][1];
  story.querySelector('[data-operation-index]').textContent = `0${index + 1} / 05`;
  story.querySelectorAll('[data-chapter]').forEach((chapter, i) => chapter.classList.toggle('is-current', i === index));
}

function teardown() {
  timeline?.scrollTrigger?.kill();
  timeline?.kill();
  timeline = null;
  scene?.dispose();
  scene = null;
  story.classList.remove('is-webgl', 'is-enhanced');
  showStage(0);
}

function useFallback(reason) {
  generation++;
  failed = true;
  teardown();
  story.dataset.mode = reason;
}

async function enhance() {
  const ticket = ++generation;
  teardown();
  if (disposed) return;
  if (reducedMotion.matches || connection?.saveData || shortScreen.matches || failed || (navigator.deviceMemory && navigator.deviceMemory < 4)) {
    story.dataset.mode = reducedMotion.matches ? 'reduced-motion' : 'static';
    return;
  }
  story.dataset.mode = 'loading';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let context;
  try { context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true }); }
  catch { story.dataset.mode = 'no-webgl'; return; }
  if (!context) { story.dataset.mode = 'no-webgl'; return; }
  try {
    // No large optional downloads on reduced-motion, save-data or unsupported devices.
    await loadScript('gsap.min.js');
    const [, module] = await Promise.all([loadScript('ScrollTrigger.min.js'), import('./operation-scene.js')]);
    if (ticket !== generation || disposed) { context.getExtension('WEBGL_lose_context')?.loseContext(); return; }
    window.gsap.registerPlugin(window.ScrollTrigger);
    host.append(canvas);
    scene = module.createOperationScene(host, canvas, context, { mobile: compact.matches, tablet: tablet.matches, onFailure: () => useFallback('render-fallback') });
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
        end: compact.matches ? 'bottom 35%' : () => `+=${Math.max(1, story.offsetHeight - story.querySelector('.operation-stage').offsetHeight)}`,
        scrub: compact.matches ? .22 : .65,
        invalidateOnRefresh: true,
        onRefresh: () => { scene?.update(playhead.progress); showStage(playhead.progress); }
      }
    });
    timeline.to(playhead, { progress: 1, duration: 1, ease: 'none', onUpdate: () => { scene?.update(playhead.progress); showStage(playhead.progress); } });
    window.ScrollTrigger.refresh();
  } catch {
    context.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
    if (ticket === generation) useFallback('dependency-fallback');
  }
}

const visibility = new IntersectionObserver(entries => {
  inView = entries[0].isIntersecting;
  scene?.setVisible(inView && !document.hidden);
}, { rootMargin: '80px' });
visibility.observe(story);
function onVisibility() { scene?.setVisible(inView && !document.hidden); }
document.addEventListener('visibilitychange', onVisibility);
reducedMotion.addEventListener('change', enhance);
compact.addEventListener('change', enhance);
tablet.addEventListener('change', enhance);
shortScreen.addEventListener('change', enhance);
connection?.addEventListener('change', enhance);
window.addEventListener('pagehide', () => { disposed = true; generation++; teardown(); });
window.addEventListener('pageshow', event => { if (event.persisted) { disposed = false; enhance(); } });

// Read-only diagnostics for local validation. No analytics or personal data.
story.getOperationDiagnostics = () => ({ mode: story.dataset.mode, stage: lastStage + 1, ...(scene?.getDiagnostics() || {}) });
showStage(0);
// Let HTML, typography and the static composition paint before optional modules load.
requestAnimationFrame(() => requestAnimationFrame(() => {
  if ('requestIdleCallback' in window) requestIdleCallback(enhance, { timeout: 1800 });
  else setTimeout(enhance, 150);
}));
