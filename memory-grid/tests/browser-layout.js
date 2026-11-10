/* Browser-console expression; run once per emulated color theme at 240 x 282. */
(async () => {
  const $ = id => document.getElementById(id), rows = [];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (fn, timeout = 9000) => { const start = Date.now(); while (Date.now() - start < timeout) { if (fn()) return true; await pause(40); } return false; };
  const click = id => $(id).click();
  const emit = name => window.dispatchEvent(new Event(name));
  const overlays = ['menu', 'help', 'gameover', 'confirm'];
  const view = { width: 240, height: 282 };
  const visible = el => el && !el.hidden && el.getBoundingClientRect().width > 0;
  const lit = [];
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      const nowLit = mutation.target.classList.contains('is-lit');
      const wasLit = String(mutation.oldValue || '').split(/\s+/).includes('is-lit');
      if (nowLit && !wasLit) lit.push(Number(mutation.target.dataset.tile));
    }
  });
  observer.observe($('grid'), { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  const measure = screen => {
    const page = document.documentElement, grid = $('grid'), panel = $('title-panel');
    const dialog = overlays.map(id => $(id)).find(el => !el.hidden) || null;
    const controls = [...document.querySelectorAll('#actions button, header button')].filter(visible);
    const pageFits = page.scrollWidth <= view.width && page.scrollHeight <= view.height;
    const gridFits = grid.hidden || (grid.scrollWidth <= grid.clientWidth + 1 && grid.scrollHeight <= grid.clientHeight + 1);
    const panelFits = panel.hidden || (panel.scrollWidth <= panel.clientWidth + 1 && panel.scrollHeight <= panel.clientHeight + 1);
    const dialogFits = !dialog || (dialog.scrollWidth <= dialog.clientWidth + 1 && dialog.getBoundingClientRect().right <= view.width + 0.5);
    const controlsFit = controls.every(button => {
      const r = button.getBoundingClientRect();
      return r.x >= -0.5 && r.right <= view.width + 0.5 && r.top >= -0.5 && r.bottom <= view.height + 0.5 && r.width > 0 && r.height > 0;
    });
    rows.push({ screen, pageFits, gridFits, panelFits, dialogFits, controlsFit, overflow: !(pageFits && gridFits && panelFits && dialogFits && controlsFit) });
  };
  await waitFor(() => $('app').getAttribute('aria-busy') === 'false');
  for (let i = 0; i < 4 && overlays.some(id => !$(id).hidden); i++) { $(overlays.find(id => !$(id).hidden)).querySelector('button').click(); await pause(40); }
  if ($('app').dataset.phase !== 'title') { click('title-btn'); await pause(60); if (!$('confirm').hidden) { click('confirm-leave'); await pause(60); } }
  measure('title');
  lit.length = 0;
  click('start');
  await waitFor(() => $('app').dataset.phase === 'input');
  measure('round-1-input');
  const sequence = lit.slice(-3);
  const wrong = (sequence[0] + 1) % 9;
  let at = Number($('grid').getAttribute('aria-activedescendant').split('-')[1]);
  while (at !== wrong) { emit(at < wrong ? 'scrollDown' : 'scrollUp'); at = at < wrong ? at + 1 : at - 1; }
  await pause(280);
  emit('sideClick');
  await waitFor(() => !$('gameover').hidden, 5000);
  measure('game-over');
  click('gameover-close');
  await pause(60);
  click('menu-open');
  await pause(60);
  measure('menu');
  click('menu-help');
  await pause(60);
  measure('help');
  click('help-close');
  await pause(60);
  click('menu-close');
  await pause(60);
  click('title-btn');
  await pause(60);
  if (!$('confirm').hidden) { measure('confirm'); click('confirm-cancel'); }
  observer.disconnect();
  return rows;
})();
