document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('siteHeader');
  const toggle = document.querySelector('.mobile-toggle');
  const nav = document.querySelector('.main-nav');

  toggle?.addEventListener('click', () => {
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isOpen));
    header?.classList.toggle('nav-open', !isOpen);
    document.body.classList.toggle('menu-open', !isOpen);
  });

  nav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      toggle?.setAttribute('aria-expanded', 'false');
      header?.classList.remove('nav-open');
      document.body.classList.remove('menu-open');
    });
  });

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach(element => observer.observe(element));
  } else {
    reveals.forEach(element => element.classList.add('revealed'));
  }

  const backToTop = document.querySelector('.back-to-top');
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const contactForm = document.querySelector('#contactForm');
  contactForm?.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(contactForm);
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const message = String(formData.get('message') || '').trim();
    const whatsappMessage = [
      'Olá! Gostaria de falar com a Escalare.',
      '',
      `Nome: ${name}`,
      `E-mail: ${email}`,
      `Telefone: ${phone}`,
      message ? `Mensagem: ${message}` : ''
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/5511978116482?text=${encodeURIComponent(whatsappMessage)}`, '_blank', 'noopener,noreferrer');
  });
});
