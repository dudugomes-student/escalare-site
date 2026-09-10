/**
 * Escalare Gestão Empresarial - Script Principal
 * Funcionalidades: Menu responsivo mobile, máscaras de inputs, validação e envio interativo de formulários.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initInputMasks();
  initFormValidation();
});

/**
 * 1. Menu Responsivo Mobile
 */
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

  // Fechar ao clicar em qualquer link de navegação
  if (nav) {
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggleMenu(true);
      });
    });
  }

  // Fechar ao clicar fora do cabeçalho
  document.addEventListener('click', (e) => {
    if (header.classList.contains('nav-open') && !header.contains(e.target)) {
      toggleMenu(true);
    }
  });

  // Fechar com a tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('nav-open')) {
      toggleMenu(true);
      toggleBtn.focus();
    }
  });
}

/**
 * 2. Máscaras de Entrada para Telefones e Campos Específicos
 */
function initInputMasks() {
  // Máscara de Telefone/WhatsApp brasileiro (10 ou 11 dígitos)
  const phoneInputs = document.querySelectorAll('input[type="tel"], input[name*="phone"], input[name*="whatsapp"], input[name*="tel"]');
  
  phoneInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);

      if (value.length > 10) {
        // Formato (XX) XXXXX-XXXX
        e.target.value = value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      } else if (value.length > 6) {
        // Formato (XX) XXXX-XXXX (parcial)
        e.target.value = value.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
      } else if (value.length > 2) {
        e.target.value = value.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
      } else if (value.length > 0) {
        e.target.value = `(${value}`;
      }
    });
  });

  // CRM: Apenas dígitos ou caracteres de registro
  const crmInputs = document.querySelectorAll('input[name*="crm_number"]');
  crmInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^\d]/g, '');
    });
  });
}

/**
 * 3. Validação e Feedback Interativo dos Formulários
 */
function initFormValidation() {
  const forms = document.querySelectorAll('form[data-validate="true"]');
  const whatsappNumber = '5511994963872';

  forms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      // Checagem de campos obrigatórios nativos
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.innerHTML : 'Enviar';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Processando solicitação...';
      }

      // Coletar dados do formulário
      const formData = new FormData(form);
      const dataObj = {};
      formData.forEach((value, key) => {
        dataObj[key] = value;
      });

      // Montar mensagem para WhatsApp de apoio
      let summaryText = 'Olá, gostaria de falar com a Escalare:';
      if (dataObj.institution_name) {
        summaryText = `*Solicitação para Clínicas - Escalare*\n\n` +
          `• *Clínica:* ${dataObj.institution_name}\n` +
          `• *Responsável:* ${dataObj.contact_name}\n` +
          `• *E-mail:* ${dataObj.corporate_email}\n` +
          `• *Telefone:* ${dataObj.phone}\n` +
          `• *Áreas / Demandas:* ${dataObj.sectors_needed}\n` +
          (dataObj.notes ? `• *Obs:* ${dataObj.notes}` : '');
      } else if (dataObj.doctor_name) {
        summaryText = `*Credenciamento Médico - Escalare*\n\n` +
          `• *Médico:* ${dataObj.doctor_name}\n` +
          `• *CRM:* ${dataObj.crm_number}/${dataObj.crm_uf || ''}\n` +
          `• *Especialidade:* ${dataObj.specialty}\n` +
          (dataObj.rqe ? `• *RQE:* ${dataObj.rqe}\n` : '') +
          `• *E-mail:* ${dataObj.doctor_email}\n` +
          `• *WhatsApp:* ${dataObj.doctor_whatsapp}\n` +
          `• *Disponibilidade:* ${dataObj.shifts_pref || 'Geral'}`;
      } else if (dataObj.contact_fullname) {
        summaryText = `*Contato Institucional - Escalare*\n\n` +
          `• *Nome:* ${dataObj.contact_fullname}\n` +
          `• *E-mail:* ${dataObj.contact_email}\n` +
          `• *Telefone:* ${dataObj.contact_tel}\n` +
          `• *Assunto:* ${dataObj.subject_type}\n` +
          `• *Mensagem:* ${dataObj.message_text}`;
      }

      const encodedMsg = encodeURIComponent(summaryText);
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${whatsappNumber}&text=${encodedMsg}`;

      // Simulação de processamento com feedback amigável
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

