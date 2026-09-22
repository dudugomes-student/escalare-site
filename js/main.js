document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initScrollHeader();
  initBackToTop();
});

function initScrollHeader() {
  const header = document.getElementById('siteHeader');
  if (!header) return;
  let frame = 0;
  const update = () => { header.classList.toggle('scrolled', scrollY > 20); frame = 0; };
  addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive:true });
  update();
}

function initMobileMenu() {
  const header = document.getElementById('siteHeader');
  const toggle = document.querySelector('.mobile-toggle');
  const nav = document.querySelector('.main-nav');
  if (!header || !toggle || !nav) return;
  const mobile = matchMedia('(max-width: 1000px)');
  const main = document.querySelector('main');
  const footer = document.querySelector('footer');
  let open = false;
  const setOpen = (value, restore = false) => {
    open = value && mobile.matches;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu de navegação' : 'Abrir menu de navegação');
    header.classList.toggle('nav-open', open);
    document.body.classList.toggle('menu-open', open);
    nav.inert = mobile.matches && !open;
    if (main) main.inert = open;
    if (footer) footer.inert = open;
    header.querySelector('.brand-logo').inert = open;
    if (open) nav.querySelector('a')?.focus();
    else if (restore) toggle.focus();
  };
  toggle.addEventListener('click', () => setOpen(!open, open));
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); }
    if (event.key === 'Tab') {
      const targets = [...nav.querySelectorAll('a[href]'), toggle].filter(el => el.getClientRects().length);
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  mobile.addEventListener('change', () => setOpen(false));
  addEventListener('pageshow', () => setOpen(false));
  setOpen(false);
}

function initBackToTop() {
  const button = document.querySelector('.back-to-top');
  if (!button) return;
  const update = () => button.classList.toggle('visible', scrollY > 600);
  addEventListener('scroll', update, { passive:true });
  button.addEventListener('click', () => scrollTo({top:0, behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'}));
  update();
}
