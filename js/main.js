// Ativa estilos de aprimoramento progressivo sem depender de bibliotecas.
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initInputMasks();
  initFormValidation();
  initScrollHeader();
  initScrollReveal();
  initCounters();
  initAccordions();
  initScrollProgress();
  initBackToTop();
  initPremiumMotion();
});

function initScrollHeader() {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  let lastScrollY = window.scrollY;
  let ticking = false;

  const updateHeader = () => {
    const currentScrollY = Math.max(window.scrollY, 0);
    const scrollingDown = currentScrollY > lastScrollY + 6;
    const scrollingUp = currentScrollY < lastScrollY - 6;

    if (currentScrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    if (scrollingDown && currentScrollY > 180 && !header.classList.contains('nav-open')) {
      header.classList.add('is-hidden');
    } else if (scrollingUp || currentScrollY < 120) {
      header.classList.remove('is-hidden');
    }

    lastScrollY = currentScrollY;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });
}

function initPremiumMotion() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const hero = document.querySelector('.section-hero');
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  let frameRequested = false;

  const updateParallax = () => {
    if (hero) {
      const heroHeight = Math.max(hero.offsetHeight, 1);
      const progress = Math.min(Math.max(window.scrollY / heroHeight, 0), 1);
      hero.style.setProperty('--hero-parallax-bg', `${progress * 52}px`);
      hero.style.setProperty('--hero-parallax-media', `${progress * 32}px`);
    }
    frameRequested = false;
  };

  window.addEventListener('scroll', () => {
    if (!frameRequested) {
      requestAnimationFrame(updateParallax);
      frameRequested = true;
    }
  }, { passive: true });

  updateParallax();

  if (!finePointer) return;

  document.querySelectorAll('.card-feature, .metric-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
    }, { passive: true });
  });
}

function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    reveals.forEach(el => el.classList.add('revealed'));
    return;
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.18,
      rootMargin: '0px 0px -8% 0px'
    });

    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('revealed'));
  }
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const getCounterData = (el) => ({
    target: Number.parseFloat(el.dataset.counter),
    suffix: el.dataset.suffix || '',
    decimals: Number.parseInt(el.dataset.decimals || '0', 10)
  });

  const setFinalValue = (el) => {
    const { target, suffix, decimals } = getCounterData(el);
    if (!Number.isFinite(target)) return;
    el.textContent = `${target.toFixed(decimals)}${suffix}`;
  };

  if (reduceMotion) {
    counters.forEach(setFinalValue);
    return;
  }

  counters.forEach(el => {
    const { suffix, decimals } = getCounterData(el);
    el.textContent = `${(0).toFixed(decimals)}${suffix}`;
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const { target, suffix, decimals } = getCounterData(el);
          if (!Number.isFinite(target)) {
            obs.unobserve(el);
            return;
          }

          const duration = 1800;
          const startTime = performance.now();

          const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo: rápido no início, suave e preciso na chegada.
            const easeOutProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const currentVal = (target * easeOutProgress).toFixed(decimals);
            
            el.textContent = `${currentVal}${suffix}`;

            if (progress < 1) {
              requestAnimationFrame(updateNumber);
            } else {
              setFinalValue(el);
            }
          };

          requestAnimationFrame(updateNumber);
          obs.unobserve(el);
        }
      });
    }, { threshold: 0.3 });

    counters.forEach(c => observer.observe(c));
  } else {
    counters.forEach(setFinalValue);
  }
}

function initAccordions() {
  const items = document.querySelectorAll('.accordion-item');
  items.forEach(item => {
    const header = item.querySelector('.accordion-header');
    const panel = item.querySelector('.accordion-body');
    if (!header) return;

    header.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      items.forEach(other => {
        const otherHeader = other.querySelector('.accordion-header');
        const otherPanel = other.querySelector('.accordion-body');
        other.classList.remove('active');
        otherHeader?.setAttribute('aria-expanded', 'false');
        otherPanel?.setAttribute('aria-hidden', 'true');
      });

      if (!isActive) {
        item.classList.add('active');
        header.setAttribute('aria-expanded', 'true');
        panel?.removeAttribute('aria-hidden');
      }
    });
  });
}

function initMobileMenu() {
  const header = document.getElementById('siteHeader');
  const toggleBtn = document.querySelector('.mobile-toggle');
  const nav = document.querySelector('.main-nav');
  if (!header || !toggleBtn) return;

  const toggleMenu = (forceClose = false) => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    const shouldOpen = forceClose ? false : !isExpanded;

    toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    header.classList.toggle('nav-open', shouldOpen);
    document.body.classList.toggle('menu-open', shouldOpen);
  };

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  if (nav) {
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggleMenu(true);
      });
    });
  }

  document.addEventListener('click', (e) => {
    if (header.classList.contains('nav-open') && !header.contains(e.target)) {
      toggleMenu(true);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('nav-open')) {
      toggleMenu(true);
      toggleBtn.focus();
    }
  });
}

function initInputMasks() {
  const phoneInputs = document.querySelectorAll('input[type="tel"], input[name*="phone"], input[name*="whatsapp"], input[name*="tel"]');
  
  phoneInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);

      if (value.length > 10) {
        e.target.value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      } else if (value.length > 6) {
        e.target.value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
      } else if (value.length > 2) {
        e.target.value = value.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
      } else if (value.length > 0) {
        e.target.value = `(${value}`;
      }
    });
  });

  const crmInputs = document.querySelectorAll('input[name*="crm_number"]');
  crmInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^\d]/g, '');
    });
  });
}

function initFormValidation() {
  const forms = document.querySelectorAll('form[data-validate="true"]');
  const whatsappNumber = '5511978116482';

  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : 'Enviar';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Processando solicitação...';
      }

      const formData = new FormData(form);
      const dataObj = {};
      formData.forEach((value, key) => {
        dataObj[key] = value;
      });

      let summaryText = 'Olá! Gostaria de solicitar um serviço da Escalare Gestão Empresarial.';
      if (dataObj.institution_name) {
        summaryText = `Olá! Gostaria de solicitar um serviço da Escalare Gestão Empresarial para clínicas:\n\n` +
          `• *Clínica:* ${dataObj.institution_name}\n` +
          `• *Responsável:* ${dataObj.contact_name}\n` +
          `• *E-mail:* ${dataObj.corporate_email}\n` +
          `• *Telefone:* ${dataObj.phone}\n` +
          `• *Áreas / Demandas:* ${dataObj.sectors_needed}\n` +
          (dataObj.notes ? `• *Obs:* ${dataObj.notes}` : '');
      } else if (dataObj.doctor_name) {
        summaryText = `Olá! Gostaria de solicitar o credenciamento médico na Escalare Gestão Empresarial:\n\n` +
          `• *Médico:* ${dataObj.doctor_name}\n` +
          `• *CRM:* ${dataObj.crm_number}/${dataObj.crm_uf || ''}\n` +
          `• *Especialidade:* ${dataObj.specialty}\n` +
          (dataObj.rqe ? `• *RQE:* ${dataObj.rqe}\n` : '') +
          `• *E-mail:* ${dataObj.doctor_email}\n` +
          `• *WhatsApp:* ${dataObj.doctor_whatsapp}\n` +
          `• *Disponibilidade:* ${dataObj.shifts_pref || 'Geral'}`;
      } else if (dataObj.contact_fullname) {
        summaryText = `Olá! Gostaria de solicitar um atendimento/serviço da Escalare Gestão Empresarial:\n\n` +
          `• *Nome:* ${dataObj.contact_fullname}\n` +
          `• *E-mail:* ${dataObj.contact_email}\n` +
          `• *Telefone:* ${dataObj.contact_tel}\n` +
          `• *Assunto:* ${dataObj.subject_type}\n` +
          `• *Mensagem:* ${dataObj.message_text}`;
      }

      const encodedMsg = encodeURIComponent(summaryText);
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMsg}`;

      setTimeout(() => {
        const feedbackContainer = document.createElement('div');
        feedbackContainer.className = 'form-success-box';
        feedbackContainer.innerHTML = `
          <div class="success-icon">✓</div>
          <h3 class="success-title">Solicitação Registrada com Sucesso!</h3>
          <p class="success-message">
            Recebemos seus dados e nossa equipe de coordenação entrará em contato em breve.
          </p>
          <div class="success-actions">
            <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-large">
              Agilizar atendimento no WhatsApp
            </a>
            <button type="button" class="btn btn-secondary btn-reset-form" style="color: var(--color-text-primary); border-color: var(--color-border-light);">
              Enviar nova mensagem
            </button>
          </div>
        `;

        form.style.display = 'none';
        form.parentNode.insertBefore(feedbackContainer, form.nextSibling);

        const resetBtn = feedbackContainer.querySelector('.btn-reset-form');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            feedbackContainer.remove();
            form.reset();
            form.style.display = 'flex';
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = originalText;
            }
          });
        }
      }, 700);
    });
  });
}

function initScrollProgress() {
  const bar = document.querySelector('.reading-progress-bar');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    if (docHeight > 0) {
      const scrollPercent = (scrollTop / docHeight) * 100;
      bar.style.width = `${scrollPercent}%`;
    }
  }, { passive: true });
}

function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }, { passive: true });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}
