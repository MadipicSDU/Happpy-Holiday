// On phones, data tables are shown as stacked cards (see ux-checklist.css). Each cell needs to say which column
// it belongs to, so this copies the column header text into a data-label attribute for every table cell.
function label(root) {
  for (const table of root.querySelectorAll('table')) {
    // headers that are only visually hidden (e.g. an "Actions" column) get no visible label
    const headers = [...table.querySelectorAll('thead th')].map(th => th.querySelector(':scope > .sr-only:only-child') ? '' : th.textContent.trim());
    if (!headers.length) continue;
    for (const row of table.querySelectorAll('tbody tr')) {
      [...row.children].forEach((cell, index) => {
        const text = headers[index] || '';
        if (cell.getAttribute('data-label') !== text) cell.setAttribute('data-label', text);
      });
    }
  }
}
export function startTableLabels() {
  let queued = false;
  const run = () => { queued = false; label(document); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } })
    .observe(document.body, { childList: true, subtree: true });
  run();
}
