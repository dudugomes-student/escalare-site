// The browser only prepares a message. Delivery happens after the user sends it in WhatsApp.
document.querySelectorAll('[data-whatsapp-form]').forEach(form => {
  form.querySelector('button[type=submit]').disabled = false;
  const profile = form.querySelector('[name=profile]');
  const requestedProfile = new URLSearchParams(location.search).get('perfil');
  if (requestedProfile === 'profissional') profile.value = 'Profissional';
  if (requestedProfile === 'instituicao') profile.value = 'Instituição';
  const result = form.querySelector('[data-form-result]');
  form.addEventListener('input', () => { result.hidden = true; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const lines = ['Olá, Escalare. Gostaria de conversar.', '',
      `Perfil: ${data.get('profile')}`, `Nome: ${String(data.get('name')).trim()}`,
      data.get('institution') ? `Instituição: ${String(data.get('institution')).trim()}` : '',
      data.get('email') ? `E-mail: ${String(data.get('email')).trim()}` : '',
      `Mensagem: ${String(data.get('message')).trim()}`].filter(Boolean);
    const link = result.querySelector('a');
    link.href = `https://wa.me/5511978116482?text=${encodeURIComponent(lines.join('\n'))}`;
    result.hidden = false;
    result.querySelector('[role=status]').textContent = 'Mensagem preparada. Revise e envie no WhatsApp para iniciar a conversa.';
    link.focus();
  });
});
