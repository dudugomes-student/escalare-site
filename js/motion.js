// Small, shared motion layer. Content remains visible if JS or observers are unavailable.
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const elements = [...document.querySelectorAll('[data-reveal]')];
let observer;
function syncMotion() {
  observer?.disconnect();
  document.documentElement.classList.remove('motion-ready');
  if (preference.matches || !('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    });
  }, { threshold:.08, rootMargin:'0px 0px 30px' });
  elements.forEach(el => {
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in-view');
    else observer.observe(el);
  });
  document.documentElement.classList.add('motion-ready');
}
syncMotion();
preference.addEventListener('change', syncMotion);
window.addEventListener('pageshow', syncMotion);
