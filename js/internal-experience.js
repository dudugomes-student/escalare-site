const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const wideViewport = matchMedia('(min-width: 701px)');
const cleanups = [];

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

function initSteppedHero(selector, datasetKey, states) {
  const scene = document.querySelector(selector);
  if (!scene) return;
  const setFinal = () => { scene.dataset[datasetKey] = states.at(-1); };
  if (reducedMotion.matches || !wideViewport.matches) {
    setFinal();
    return;
  }
  scene.dataset[datasetKey] = states[0];
  onFrameScroll(() => {
    const rect = scene.getBoundingClientRect();
    const distance = Math.max(rect.height * .78, innerHeight * .56);
    const progress = clamp((96 - rect.top) / distance);
    const index = Math.min(states.length - 1, Math.floor(progress * states.length));
    scene.dataset[datasetKey] = states[index];
  });
}

function initCompositionStory() {
  const board = document.querySelector('[data-composition-board]');
  const steps = [...document.querySelectorAll('[data-composition-step]')];
  if (!board || !steps.length) return;

  const controls = board.querySelector('[data-process-controls]');
  const note = board.querySelector('[data-process-note]');
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
      button.addEventListener('click', () => setState(button.dataset.process, true));
    });
  }

  if (reducedMotion.matches || !wideViewport.matches || !('IntersectionObserver' in window)) {
    setState('organized');
    return;
  }

  setState(steps[0].dataset.compositionStep);
  const observer = new IntersectionObserver(entries => {
    const current = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (current) setState(current.target.dataset.compositionStep);
  }, { threshold: [.25, .5, .72], rootMargin: '-22% 0px -34%' });
  steps.forEach(step => observer.observe(step));
  cleanups.push(() => observer.disconnect());
}

function initProfessionalRoute() {
  const story = document.querySelector('[data-professional-story]');
  if (!story) return;
  const route = story.querySelector('[data-professional-route]');
  const steps = [...story.querySelectorAll('[data-route-step]')];
  if (!route || !steps.length) return;

  const setProgress = progress => {
    const position = 8 + progress * 84;
    route.style.setProperty('--route-progress', `${position}%`);
    const active = Math.min(steps.length - 1, Math.floor(progress * steps.length));
    steps.forEach((step, index) => step.classList.toggle('is-current', index === active));
  };

  if (reducedMotion.matches || !wideViewport.matches) {
    setProgress(1);
    steps.forEach(step => step.classList.remove('is-current'));
    return;
  }

  onFrameScroll(() => {
    const rect = story.getBoundingClientRect();
    const travel = Math.max(rect.height - innerHeight * .18, innerHeight * .75);
    setProgress(clamp((innerHeight * .7 - rect.top) / travel));
  });
}

function initEditorialIndex() {
  const shelf = document.querySelector('[data-editorial-shelf]');
  if (!shelf) return;
  observeOnce(shelf, 'is-indexed');
}

function initExperience() {
  initSteppedHero('[data-system-map]', 'sceneState', ['parts', 'relations', 'system']);
  initSteppedHero('[data-coordination-field]', 'coordinationState', ['fragmented', 'related', 'coordinated']);
  initCompositionStory();
  initProfessionalRoute();
  observeOnce(document.querySelector('[data-method-composition]'), 'is-resolved');
  observeOnce(document.querySelector('[data-contact-connection]'), 'is-connected');
  initEditorialIndex();
  document.documentElement.classList.add('internal-experience-ready');
}

initExperience();

addEventListener('pagehide', () => {
  cleanups.splice(0).forEach(cleanup => cleanup());
}, { once: true });
