/**
 * Draggable in-game window: title bar (drag handle) + close button + body.
 * Windows cascade from an offset so several can be open at once.
 * Position and open state persist in localStorage (owner rule, session 34)
 * so the layout survives reloads — context windows (villager/building) only
 * keep their position, never reopen on their own.
 */

let cascade = 0;

const STORE_KEY = 'northreach-windows';

interface WindowMemory {
  x: number;
  y: number;
  open?: boolean;
}

const memory: Record<string, WindowMemory> = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
})();

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(memory));
  } catch {
    /* storage unavailable — layout just won't persist */
  }
}

export class UIWindow {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  onClose: (() => void) | null = null;
  private readonly key: string;
  private readonly persistOpen: boolean;

  constructor(title: string, width = 260, persistOpen = true) {
    this.key = title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'window';
    this.persistOpen = persistOpen;
    this.root = document.createElement('div');
    this.root.className = 'ui-window';
    // Widths ride the --u scale unit: the 260-wide design = 12.5% of the
    // player's window (owner rule, session 37); wider windows keep their ratio.
    this.root.style.width = `calc(var(--u) * ${width})`;
    const mem = memory[this.key];
    if (mem) {
      this.root.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, mem.x))}px`;
      this.root.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, mem.y))}px`;
    } else {
      this.root.style.left = `calc(var(--u) * ${230 + (cascade % 5) * 40})`;
      this.root.style.top = `calc(var(--u) * ${60 + (cascade % 5) * 36})`;
      cascade++;
    }

    const bar = document.createElement('div');
    bar.className = 'ui-window-bar';
    const titleEl = document.createElement('span');
    titleEl.innerHTML = title;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ui-window-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.hide());
    bar.append(titleEl, closeBtn);

    this.body = document.createElement('div');
    this.body.className = 'ui-window-body';

    this.root.append(bar, this.body);
    this.root.style.display = 'none';
    document.body.appendChild(this.root);

    // Dragging.
    let dragging = false;
    let offX = 0;
    let offY = 0;
    bar.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      dragging = true;
      offX = e.clientX - this.root.offsetLeft;
      offY = e.clientY - this.root.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.root.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, e.clientX - offX))}px`;
      this.root.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offY))}px`;
    });
    bar.addEventListener('pointerup', () => {
      dragging = false;
      this.remember();
    });

    // Clicking anywhere raises the window.
    this.root.addEventListener('pointerdown', () => this.raise());

    if (this.persistOpen && mem?.open) this.show();
  }

  private remember(): void {
    const mem = memory[this.key] ?? (memory[this.key] = { x: 0, y: 0 });
    mem.x = this.root.offsetLeft;
    mem.y = this.root.offsetTop;
    if (this.persistOpen) mem.open = this.visible;
    persist();
  }

  private raise(): void {
    for (const el of document.querySelectorAll<HTMLElement>('.ui-window')) el.style.zIndex = '20';
    this.root.style.zIndex = '21';
  }

  get visible(): boolean {
    return this.root.style.display !== 'none';
  }

  show(): void {
    this.root.style.display = 'block';
    this.raise();
    this.remember();
  }

  hide(): void {
    this.root.style.display = 'none';
    this.remember();
    this.onClose?.();
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }
}
