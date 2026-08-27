/**
 * Bottom-left event log: the latest events stay visible (no fade-out — owner
 * rule), and clicking the log toggles the full scrollable history.
 */

const VISIBLE_COMPACT = 6;
const MAX_HISTORY = 200;

export class Events {
  private root: HTMLElement;
  private list: HTMLElement;
  private history: string[] = [];
  private expanded = false;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'events';
    const header = document.createElement('div');
    header.className = 'event events-header';
    header.textContent = '📜 Events (click to expand)';
    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      this.expanded = !this.expanded;
      header.textContent = this.expanded ? '📜 Events (click to collapse)' : '📜 Events (click to expand)';
      this.render();
    });
    this.list = document.createElement('div');
    this.list.id = 'events-list';
    this.root.append(this.list, header);
    document.body.appendChild(this.root);
  }

  push(message: string): void {
    this.history.push(message);
    if (this.history.length > MAX_HISTORY) this.history.shift();
    this.render();
  }

  private render(): void {
    const shown = this.expanded ? this.history : this.history.slice(-VISIBLE_COMPACT);
    this.list.innerHTML = shown.map((m) => `<div class="event">${m}</div>`).join('');
    this.list.classList.toggle('expanded', this.expanded);
    this.list.scrollTop = this.list.scrollHeight;
  }
}
