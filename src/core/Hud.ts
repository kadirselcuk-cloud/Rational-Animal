import type { GameLoop, SpeedSetting } from './GameLoop';
import { TICK_RATE } from './GameLoop';
import { SEASON_META, type Calendar } from '../sim/calendar';
import type { InfoPanel, ResourcesPanel, WorkPanel, BuildPanel, ResearchPanel, BuildingInfoPanel, TribesPanel, SavePanel, CharacterPanel, StatsPanel } from '../ui/Panels';

export interface Panels {
  info: InfoPanel;
  resources: ResourcesPanel;
  work: WorkPanel;
  build: BuildPanel;
  research: ResearchPanel;
  buildingInfo: BuildingInfoPanel;
  tribes: TribesPanel;
  save: SavePanel;
  character: CharacterPanel;
  stats: StatsPanel;
}

/**
 * Main HUD (top-left): season/day/year, speed controls, and the menu buttons
 * that open the draggable management windows. Technical info (FPS, sim time,
 * map seed) lives bottom-right, out of the way.
 */
export class Hud {
  private seasonEl: HTMLElement;
  private townEl: HTMLElement;
  private fpsEl: HTMLElement;
  private timeEl: HTMLElement;
  private buttons = new Map<SpeedSetting, HTMLButtonElement>();
  private frames = 0;
  private fpsWindowStart = performance.now();
  private calendar: Calendar | null = null;
  private panels: Panels | null = null;

  /** Show the town's name atop the HUD (owner rule, s63). */
  setTown(name: string): void {
    this.townEl.textContent = `🏰 ${name}`;
  }

  constructor(private readonly loop: GameLoop, seed: number) {
    const root = document.getElementById('hud')!;
    root.innerHTML = `
      <div><strong id="hud-town">Rational Animal</strong></div>
      <div class="row"><span id="hud-season"></span></div>
      <div class="row" id="hud-speeds"></div>
      <div class="row" id="hud-menu"></div>
    `;
    this.seasonEl = root.querySelector('#hud-season')!;
    this.townEl = root.querySelector('#hud-town')!;

    const speedsRow = root.querySelector('#hud-speeds')!;
    const speeds: { s: SpeedSetting; label: string }[] = [
      { s: 0, label: '⏸' },
      { s: 1, label: '1×' },
      { s: 2, label: '2×' },
      { s: 4, label: '4×' },
    ];
    for (const { s, label } of speeds) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        loop.setSpeed(s);
        (document.activeElement as HTMLElement | null)?.blur();
      });
      speedsRow.appendChild(btn);
      this.buttons.set(s, btn);
    }

    // Technical corner: FPS, sim time, seed controls.
    const tech = document.createElement('div');
    tech.id = 'techinfo';
    tech.innerHTML = `
      <span id="hud-fps">FPS –</span> · <span id="hud-time"></span><br>
      seed <input id="hud-seed" type="text" data-tip="Map seed — Enter to regenerate" />
      <button id="hud-newmap" data-tip="Random new map">🎲</button>
    `;
    document.body.appendChild(tech);
    this.fpsEl = tech.querySelector('#hud-fps')!;
    this.timeEl = tech.querySelector('#hud-time')!;
    const seedInput = tech.querySelector<HTMLInputElement>('#hud-seed')!;
    seedInput.value = String(seed);
    const loadSeed = (s: string) => {
      const url = new URL(location.href);
      if (s) url.searchParams.set('seed', s);
      else url.searchParams.delete('seed');
      location.href = url.toString();
    };
    seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadSeed(seedInput.value.trim());
      e.stopPropagation();
    });
    tech.querySelector('#hud-newmap')!.addEventListener('click', () => loadSeed(''));

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        loop.togglePause();
      } else if (e.code === 'Digit1') loop.setSpeed(1);
      else if (e.code === 'Digit2') loop.setSpeed(2);
      else if (e.code === 'Digit3') loop.setSpeed(4);
    });
  }

  bindCalendar(calendar: Calendar): void {
    this.calendar = calendar;
  }

  bindPanels(panels: Panels): void {
    this.panels = panels;
    const menu = document.getElementById('hud-menu')!;
    const defs: { label: string; title: string; win: { toggle(): void } }[] = [
      { label: 'ℹ️ Info', title: 'Town information', win: panels.info.win },
      { label: '📦', title: 'Resources', win: panels.resources.win },
      { label: '👷', title: 'Workers', win: panels.work.win },
      { label: '🔨', title: 'Build', win: panels.build.win },
      { label: '📖', title: 'Knowledge', win: panels.research.win },
      { label: '🏕', title: 'Tribes & trade', win: panels.tribes.win },
      { label: '📊', title: 'Chronicle & statistics', win: panels.stats.win },
    ];
    for (const d of defs) {
      const btn = document.createElement('button');
      btn.textContent = d.label;
      btn.dataset.tip = d.title;
      btn.addEventListener('click', () => d.win.toggle());
      menu.appendChild(btn);
    }
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾';
    saveBtn.dataset.tip = 'Save & Load';
    saveBtn.addEventListener('click', () => {
      panels.save.refresh();
      panels.save.win.toggle();
    });
    menu.appendChild(saveBtn);
  }

  /** Call once per rendered frame. */
  update(): void {
    this.frames++;
    const now = performance.now();
    if (now - this.fpsWindowStart >= 500) {
      const fps = (this.frames * 1000) / (now - this.fpsWindowStart);
      this.fpsEl.textContent = `FPS ${fps.toFixed(0)}`;
      this.frames = 0;
      this.fpsWindowStart = now;
    }
    this.timeEl.textContent = `sim ${(this.loop.tickCount / TICK_RATE).toFixed(0)}s`;

    if (this.calendar) {
      const meta = SEASON_META[this.calendar.season];
      this.seasonEl.textContent =
        `${meta.icon} ${meta.label} · Day ${this.calendar.dayOfSeason} · Year ${this.calendar.year}`;
    }
    for (const [s, btn] of this.buttons) {
      btn.classList.toggle('active', this.loop.speed === s);
    }

    if (this.panels) {
      this.panels.info.update();
      this.panels.resources.update();
      this.panels.work.update();
      this.panels.build.update();
      this.panels.research.update();
      this.panels.buildingInfo.update();
      this.panels.tribes.update();
      this.panels.character.update();
      this.panels.stats.update();
    }
  }
}
