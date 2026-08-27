/**
 * Styled tooltip replacing the sluggish native title popup (owner rule).
 * Any element with a `data-tip` attribute shows it instantly on hover.
 */

export function initTooltips(): void {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.style.display = 'none';
  document.body.appendChild(tip);

  let current: HTMLElement | null = null;

  const position = (e: MouseEvent) => {
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    const r = tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 4) x = e.clientX - r.width - 6;
    if (y + r.height > window.innerHeight - 4) y = e.clientY - r.height - 6;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };

  document.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (el === current) return;
    current = el;
    if (el && el.dataset.tip) {
      tip.innerHTML = el.dataset.tip;
      tip.style.display = 'block';
      position(e as MouseEvent);
    } else {
      tip.style.display = 'none';
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (current && tip.style.display === 'block') position(e);
  });
  document.addEventListener('mouseout', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (el && el === current && !el.contains(e.relatedTarget as Node)) {
      current = null;
      tip.style.display = 'none';
    }
  });
}
