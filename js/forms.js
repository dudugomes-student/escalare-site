// The browser only prepares a message. Delivery happens after the user sends it in WhatsApp.
const fieldLimits = { name: 120, institution: 160, email: 180, message: 1200 };
const allowedProfiles = new Set(['Instituição', 'Profissional', 'Outro assunto']);
const cleanInline = (value, limit) => String(value ?? '')
  .normalize('NFC')
  .replace(/[\u0000-\u001f\u007f]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, limit);
const cleanMessage = value => String(value ?? '')
  .normalize('NFC')
  .replace(/\r\n?/g, '\n')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  .trim()
  .slice(0, fieldLimits.message);

document.querySelectorAll('[data-whatsapp-form]').forEach(form => {
  const submit = form.querySelector('button[type=submit]');
  const profile = form.querySelector('[name=profile]');
  const result = form.querySelector('[data-form-result]');
  const link = result?.querySelector('a');
  const status = result?.querySelector('[role=status]');
  if (!submit || !profile || !result || !link || !status) return;

  submit.disabled = false;
  const requestedProfile = new URLSearchParams(location.search).get('perfil');
  if (requestedProfile === 'profissional') profile.value = 'Profissional';
  if (requestedProfile === 'instituicao') profile.value = 'Instituição';
  form.addEventListener('input', () => { result.hidden = true; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const selectedProfile = cleanInline(data.get('profile'), 40);
    const safeProfile = allowedProfiles.has(selectedProfile) ? selectedProfile : 'Outro assunto';
    const name = cleanInline(data.get('name'), fieldLimits.name);
    const institution = cleanInline(data.get('institution'), fieldLimits.institution);
    const email = cleanInline(data.get('email'), fieldLimits.email);
    const message = cleanMessage(data.get('message'));
    if (!name || !message) {
      const invalidField = !name ? form.elements.name : form.elements.message;
      invalidField.setCustomValidity('Informe um texto válido, sem usar apenas espaços ou caracteres de controle.');
      invalidField.reportValidity();
      invalidField.addEventListener('input', () => invalidField.setCustomValidity(''), { once: true });
      return;
    }
    const lines = ['Olá, Escalare. Gostaria de conversar.', '',
      `Perfil: ${safeProfile}`, `Nome: ${name}`,
      institution ? `Instituição: ${institution}` : '',
      email ? `E-mail: ${email}` : '',
      `Mensagem: ${message}`].filter(Boolean);
    const whatsappUrl = new URL('https://wa.me/5511978116482');
    whatsappUrl.searchParams.set('text', lines.join('\n'));
    link.href = whatsappUrl.href;
    result.hidden = false;
    status.textContent = 'Mensagem preparada. Revise e envie no WhatsApp para iniciar a conversa.';
    link.focus();
  });
});
