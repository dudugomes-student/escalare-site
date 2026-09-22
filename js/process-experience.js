// A lightweight HTML diagram for the main service page. No WebGL or new dependency.
const board = document.querySelector('[data-process-board]');
if (board) {
  const controls = board.querySelector('[data-process-controls]');
  const status = board.querySelector('[data-process-note]');
  const messages = {
    demand:'Os períodos revelam o espaço que o planejamento precisa organizar.',
    people:'As disponibilidades entram na leitura da operação.',
    organized:'Profissionais e períodos se conectam em uma escala compreensível.'
  };
  controls.hidden = false;
  controls.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      board.dataset.processState = button.dataset.process;
      controls.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
      status.textContent = messages[button.dataset.process];
    });
  });
}
