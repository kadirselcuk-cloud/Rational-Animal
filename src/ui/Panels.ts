import { UIWindow } from './Window';
import { BUILDING_ICONS, PROFESSION_LABELS, RESOURCE_ICONS, RESOURCE_LABELS } from './icons';
import { PROFESSIONS, SHOP_STORE_CAPS, Village, type Profession, type ResourceKind } from '../sim/village';
import { BUILD_MATERIALS, BUILDING_SPECS, isUpgradableWorkshop, type Building, type BuildingKind } from '../sim/buildings';
import { TECHS, techById } from '../sim/techs';
import type { PlacementController } from './Placement';
import { TRADE_GOODS, type TradeSystem, type Tribe } from '../sim/tribes';
import type { WarSystem } from '../sim/war';
import { STONE_ICON as STONE_ICON_REF } from './icons';

/** The openable, draggable town-management windows. */

function statusClass(value: number, warn: number, bad: number): string {
  return value <= bad ? 'stat-bad' : value <= warn ? 'stat-warn' : 'stat-ok';
}

// ---------------------------------------------------------------- Info

export class InfoPanel {
  readonly win = new UIWindow('ℹ️ Town information', 270);

  constructor(private readonly village: Village) {}

  update(): void {
    if (!this.win.visible) return;
    const v = this.village;
    const men = v.adultCount('male');
    const women = v.adultCount('female');
    const children = v.childrenCount();
    const foodDays = v.foodDaysLeft();
    const fwDays = v.firewoodDaysLeft();
    const beds = v.bedCount();
    const tools = Math.floor(
      v.resources.woodenTools + v.resources.stoneTools + v.resources.bronzeTools + v.resources.ironTools,
    );
    this.win.body.innerHTML = `
      <div class="info-row"><span>🏰 Town</span><span><strong>${v.townName}</strong></span></div>
      <div class="info-row"><span>👥 Population</span><span>${v.villagers.length}</span></div>
      <div class="info-row"><span>Adults</span><span>${men + women} (♂ ${men} · ♀ ${women})</span></div>
      <div class="info-row"><span>Children</span><span>${children} (📖 ${v.studentCount()} in school)</span></div>
      <hr>
      <div class="info-row"><span>🍽 Food</span>
        <span class="${statusClass(foodDays, 15, 5)}">${Math.floor(v.foodTotal())} (≈ ${isFinite(foodDays) ? foodDays.toFixed(0) + ' days' : '∞'})</span></div>
      <div class="info-row"><span>Diet at home</span>
        <span data-tip="Each distinct food kept in a family's pantry gives its members +1 happiness.">Ø ${(v.villagers.reduce((s, x) => s + x.dietBonus, 0) / Math.max(1, v.villagers.length)).toFixed(1)} foods (+happiness)</span></div>
      <div class="info-row"><span>😊 Avg happiness</span>
        <span>${Math.round(v.villagers.reduce((s, x) => s + x.happiness, 0) / Math.max(1, v.villagers.length))} → ${Math.round((0.2 + v.villagers.reduce((s, x) => s + x.happiness, 0) / Math.max(1, v.villagers.length) / 100) * 100)}% productivity</span></div>
      <div class="info-row"><span>🔥 Firewood</span>
        <span class="${statusClass(fwDays, 15, 5)}">${Math.floor(v.resources.firewood)} (≈ ${isFinite(fwDays) ? fwDays.toFixed(0) + ' winter days' : '∞'})</span></div>
      <div class="info-row"><span>🏠 Housing</span>
        <span class="${v.homelessCount() > 0 ? 'stat-warn' : 'stat-ok'}">${v.houseCount()} houses · ${beds} beds · ${v.homelessCount()} homeless</span></div>
      <div class="info-row"><span>🛠️ Tools</span>
        <span class="${statusClass(tools, 4, 0)}">${tools} in store</span></div>
      <div class="info-row"><span>🧥 Clothes (basic/fine/lux)</span><span>${Math.floor(v.resources.clothes)} / ${Math.floor(v.resources.fineClothes)} / ${Math.floor(v.resources.luxuryClothes)}</span></div>
      <div class="info-row"><span>💊 Medicine / 🌿 herbs</span><span>${Math.floor(v.resources.medicine)} / ${Math.floor(v.resources.herbs)}</span></div>
      <div class="info-row"><span>📖 Knowledge</span><span>${Math.floor(v.knowledge)}</span></div>
      <hr>
      <div class="info-row"><span>🛡️ Soldiers</span><span>${v.soldiers().length}</span></div>
      <div class="info-row"><span>Defense strength</span><span>${v.defenseStrength().toFixed(0)} (🗼 ${v.watchtowerCount()})</span></div>
      <div class="info-row"><span>Weapons / armor</span>
        <span>${Math.floor(v.resources.spears + v.resources.bronzeWeapons + v.resources.ironWeapons)} / ${Math.floor(v.resources.leatherArmor)}</span></div>
    `;
  }
}

// ---------------------------------------------------------------- Resources

const RESOURCE_TABS: { label: string; kinds: ResourceKind[] }[] = [
  {
    label: '🍽 Food',
    kinds: ['berries', 'mushrooms', 'roots', 'meat', 'fish', 'bread', 'potatoes', 'tomatoes', 'peppers', 'strawberries', 'carrots', 'melons', 'watermelons'],
  },
  {
    label: '🌾 Farm',
    kinds: ['seeds', 'wheat', 'rye', 'oat', 'barley', 'flour', 'animalFeed'],
  },
  {
    label: '🪵 Materials',
    kinds: ['wood', 'stone', 'straw', 'clay', 'brick', 'clayTiles', 'copperOre', 'tinOre', 'ironOre', 'coal', 'bronzeBar', 'ironBar'],
  },
  {
    label: '🎒 Goods',
    kinds: ['firewood', 'herbs', 'medicine', 'pottery', 'hides', 'fur', 'leather', 'string', 'linen', 'clothes', 'fineClothes', 'luxuryClothes', 'sandals', 'hideShoes', 'boots', 'luxuryBoots', 'woodenTools', 'stoneTools', 'bronzeTools', 'ironTools', 'spears', 'bronzeWeapons', 'ironWeapons', 'leatherArmor'],
  },
];

export class ResourcesPanel {
  readonly win = new UIWindow('📦 Resources', 260);
  private tab = 0;
  private tabBar: HTMLElement;
  private content: HTMLElement;

  constructor(private readonly village: Village) {
    this.tabBar = document.createElement('div');
    this.tabBar.className = 'row tab-bar';
    RESOURCE_TABS.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.textContent = t.label;
      btn.addEventListener('click', () => {
        this.tab = i;
        this.refreshTabs();
      });
      this.tabBar.appendChild(btn);
    });
    this.content = document.createElement('div');
    this.win.body.append(this.tabBar, this.content);
    this.refreshTabs();
  }

  private refreshTabs(): void {
    [...this.tabBar.children].forEach((b, i) => b.classList.toggle('active', i === this.tab));
  }

  update(): void {
    if (!this.win.visible) return;
    const v = this.village;
    const used = Math.floor(v.storedTotal());
    const cap = v.storageCapacity();
    const pct = Math.min(100, (used / cap) * 100);
    let html = `
      <div class="storage-label">Storage: ${used} / ${cap}</div>
      <div class="storage-bar"><div class="storage-fill ${pct > 90 ? 'fill-bad' : pct > 70 ? 'fill-warn' : ''}" style="width:${pct}%"></div></div>
    `;
    for (const kind of RESOURCE_TABS[this.tab].kinds) {
      html += `<div class="info-row"><span>${RESOURCE_ICONS[kind]} ${RESOURCE_LABELS[kind]}</span><span>${Math.floor(v.resources[kind])}</span></div>`;
    }
    if (this.tab === 0) {
      html += `<hr><div class="info-row"><span>In storage</span><span>${Math.floor(v.foodTotal())} · in pantries ${Math.floor(v.totalFoodReserve() - v.foodTotal())}</span></div>`;
    }
    this.content.innerHTML = html;
  }
}

// ---------------------------------------------------------------- Work

export class WorkPanel {
  readonly win = new UIWindow('👷 Workers', 290);
  private countEls = new Map<Profession, HTMLElement>();
  private noteEls = new Map<Profession, HTMLElement>();
  private idleEl: HTMLElement;

  constructor(private readonly village: Village) {
    for (const prof of PROFESSIONS) {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('span');
      label.innerHTML = PROFESSION_LABELS[prof];
      label.style.flex = '1';
      const note = document.createElement('small');
      note.className = 'work-note';
      const minus = document.createElement('button');
      minus.textContent = '−';
      const count = document.createElement('span');
      count.style.minWidth = 'calc(var(--u) * 34)';
      count.style.textAlign = 'center';
      const plus = document.createElement('button');
      plus.textContent = '+';
      minus.addEventListener('click', () => village.setDesired(prof, village.desired[prof] - 1));
      plus.addEventListener('click', () => village.setDesired(prof, village.desired[prof] + 1));
      row.append(label, note, minus, count, plus);
      this.win.body.appendChild(row);
      this.countEls.set(prof, count);
      this.noteEls.set(prof, note);
    }
    const idleRow = document.createElement('div');
    idleRow.className = 'row';
    this.idleEl = document.createElement('span');
    idleRow.appendChild(this.idleEl);
    this.win.body.appendChild(idleRow);
  }

  update(): void {
    if (!this.win.visible) return;
    const v = this.village;
    const active = v.countByProfession();
    for (const prof of PROFESSIONS) {
      const slots = v.workerSlots(prof);
      const countEl = this.countEls.get(prof)!;
      const noteEl = this.noteEls.get(prof)!;
      countEl.textContent = `${active[prof]}/${v.desired[prof]}`;
      const workplace = v.workplaceOf(prof);
      // Why assigned hands are resting / nobody signs up (owner report, s36).
      const blocked = v.desired[prof] > 0 ? v.hiringBlockReason(prof) : null;
      if (workplace && slots === 0) {
        // Owner rule: just the lock — the requirement lives in its tooltip.
        noteEl.textContent = '🔒';
        noteEl.dataset.tip = `Needs ${BUILDING_SPECS[workplace].label}`;
        noteEl.className = 'work-note stat-bad';
      } else if (blocked) {
        noteEl.textContent = `⏸ ${blocked}`;
        delete noteEl.dataset.tip;
        noteEl.className = 'work-note stat-warn';
      } else if (workplace && v.desired[prof] > slots) {
        noteEl.textContent = `⚠ only ${slots} slot${slots === 1 ? '' : 's'}`;
        delete noteEl.dataset.tip;
        noteEl.className = 'work-note stat-warn';
      } else if (workplace && isFinite(slots)) {
        noteEl.textContent = `${slots} slots`;
        delete noteEl.dataset.tip;
        noteEl.className = 'work-note';
      } else {
        noteEl.textContent = '';
        delete noteEl.dataset.tip;
      }
    }
    // Owner rule: babies/children are not workers, so they never count as idle.
    this.idleEl.textContent = `💤 Idle (working age): ${v.idleCount()}`;
  }
}

// ---------------------------------------------------------------- Build

// Which research unlocks each gated building — surfaced as a lock tooltip.
const BUILD_REQUIREMENTS: Partial<Record<BuildingKind, string>> = {
  school: 'education',
  tradingPost: 'trade',
  cropField: 'agriculture',
  clayPit: 'clayWorking',
  pottery: 'pottery',
  weaver: 'weaving',
  leatherworker: 'leatherworking',
  cobbler: 'cobbling',
  brickOven: 'brickMaking',
  brickHouse: 'brickMaking',
  mine: 'mining',
  smelter: 'bronzeWorking',
  trainingGround: 'warcraft',
  weaponsmith: 'warcraft',
  watchtower: 'warcraft',
  manor: 'feudalism',
  temple: 'religion',
};

const BUILD_TABS: { label: string; kinds: string[] }[] = [
  { label: '🏠', kinds: ['house', 'stoneHouse', 'brickHouse'] },
  { label: '🍽', kinds: ['fishingHut', 'huntingLodge', 'cropField', 'barn', 'bakery'] },
  { label: '⚒', kinds: ['woodcutterLodge', 'foresterHut', 'toolmaker', 'storageShed', 'clayPit', 'brickOven', 'pottery', 'mine', 'smelter', 'weaver', 'leatherworker', 'tailor', 'cobbler', 'herbalistHut'] },
  { label: '🏛', kinds: ['school', 'tradingPost', 'manor', 'temple', 'road', 'stoneRoad'] },
  { label: '🛡', kinds: ['trainingGround', 'weaponsmith', 'watchtower', 'woodWall', 'stoneWall', 'woodGate', 'stoneGate'] },
];

export class BuildPanel {
  readonly win = new UIWindow('🔨 Build', 310);
  private buttons = new Map<BuildingKind, HTMLButtonElement>();
  private tabContainers: HTMLElement[] = [];
  private tabBar: HTMLElement;
  private entryHost = new Map<string, HTMLElement>();

  private tabFor(kind: string): number {
    const i = BUILD_TABS.findIndex((t) => t.kinds.includes(kind));
    return i === -1 ? 2 : i;
  }

  constructor(
    private readonly village: Village,
    placement: PlacementController,
  ) {
    this.tabBar = document.createElement('div');
    this.tabBar.className = 'row tab-bar';
    BUILD_TABS.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.textContent = t.label;
      btn.title = ['Housing', 'Food', 'Industry', 'Civic & roads', 'Military & walls'][i];
      btn.addEventListener('click', () => this.showTab(i));
      this.tabBar.appendChild(btn);
      const container = document.createElement('div');
      this.tabContainers.push(container);
    });
    this.win.body.appendChild(this.tabBar);
    for (const c of this.tabContainers) this.win.body.appendChild(c);
    for (const t of BUILD_TABS) {
      for (const kind of t.kinds) this.entryHost.set(kind, this.tabContainers[this.tabFor(kind)]);
    }

    for (const spec of Object.values(BUILDING_SPECS)) {
      if (spec.kind === 'stockpile') continue; // prebuilt, never placed by hand
      const entry = document.createElement('div');
      entry.className = 'build-entry';
      const costText = BUILD_MATERIALS.filter((m) => (spec.cost[m] ?? 0) > 0)
        .map((m) => `${spec.cost[m]} ${RESOURCE_ICONS[m]}`)
        .join(' + ');
      const info = document.createElement('div');
      info.className = 'build-info';
      info.innerHTML =
        `<div><strong>${BUILDING_ICONS[spec.kind]} ${spec.label}</strong> <small>${spec.w}×${spec.d} · ${costText}</small></div>` +
        `<small>${spec.desc}</small>`;
      const btn = document.createElement('button');
      btn.textContent = 'Place';
      btn.addEventListener('click', () => placement.toggle(spec.kind));
      entry.append(info, btn);
      (this.entryHost.get(spec.kind) ?? this.tabContainers[2]).appendChild(entry);
      this.buttons.set(spec.kind, btn);
    }
    // Roads, walls & gates (line/click modes handled by the placement controller).
    const extras: { mode: string; title: string; desc: string }[] = [
      {
        mode: 'road',
        title: `🛤 Dirt road <small>free</small>`,
        desc: 'Click start and end points — the roadbed is cut level through the terrain. +25% travel speed.',
      },
      {
        mode: 'stoneRoad',
        title: `🛤 Stone road <small>1 ${RESOURCE_ICONS.stone}/tile</small>`,
        desc: 'Paved with stone: +50% travel speed. Dirt roads can be upgraded in place.',
      },
      {
        mode: 'woodWall',
        title: `🪵 Wooden wall <small>2 ${RESOURCE_ICONS.wood}/tile</small>`,
        desc: 'Click start and end. Blocks everyone — add gates so your people can pass.',
      },
      {
        mode: 'stoneWall',
        title: `${STONE_ICON_REF} Stone wall <small>3 ${RESOURCE_ICONS.stone}/tile</small>`,
        desc: 'Click start and end. Stronger defense than timber.',
      },
      {
        mode: 'woodGate',
        title: `🚪 Wooden gate <small>4 ${RESOURCE_ICONS.wood}</small>`,
        desc: 'Single tile. Your villagers pass; raiders funnel through it.',
      },
      {
        mode: 'stoneGate',
        title: `🏰 Stone gate <small>6 ${RESOURCE_ICONS.stone}</small>`,
        desc: 'Single tile. The strongest doorway in the north.',
      },
    ];
    for (const ex of extras) {
      const entry = document.createElement('div');
      entry.className = 'build-entry';
      const info = document.createElement('div');
      info.className = 'build-info';
      info.innerHTML = `<div><strong>${ex.title}</strong></div><small>${ex.desc}</small>`;
      const btn = document.createElement('button');
      btn.textContent = 'Place';
      btn.addEventListener('click', () => placement.toggle(ex.mode as BuildingKind));
      entry.append(info, btn);
      (this.entryHost.get(ex.mode) ?? this.tabContainers[3]).appendChild(entry);
      this.buttons.set(ex.mode as BuildingKind, btn);
    }
    this.showTab(0);

    placement.onChanged = () => {
      for (const [kind, btn] of this.buttons) {
        btn.classList.toggle('active', placement.active === kind);
        btn.textContent = placement.active === kind ? 'Cancel' : 'Place';
      }
    };
  }

  private showTab(i: number): void {
    this.tabContainers.forEach((c, k) => (c.style.display = k === i ? 'block' : 'none'));
    [...this.tabBar.children].forEach((b, k) => b.classList.toggle('active', k === i));
  }

  update(): void {
    if (!this.win.visible) return;
    for (const [kind, btn] of this.buttons) {
      const extraModes = ['road', 'stoneRoad', 'woodWall', 'stoneWall', 'woodGate', 'stoneGate'];
      // Stone fortifications unlock with Feudalism (owner rule).
      const stoneWork = kind === ('stoneWall' as BuildingKind) || kind === ('stoneGate' as BuildingKind);
      const unlocked = stoneWork
        ? this.village.researched.has('feudalism')
        : extraModes.includes(kind as string) || this.village.isBuildingUnlocked(kind);
      btn.disabled = !unlocked;
      if (!unlocked) {
        btn.textContent = '🔒';
        // Owner rule: the requirement lives in the lock's tooltip, not the entry text.
        const req = stoneWork ? 'feudalism' : BUILD_REQUIREMENTS[kind];
        btn.dataset.tip = req ? `Requires research: ${techById(req).label}` : 'Locked';
      } else if (!btn.classList.contains('active')) {
        btn.textContent = 'Place';
        delete btn.dataset.tip;
      }
    }
  }
}

// ---------------------------------------------------------------- Research

export class ResearchPanel {
  readonly win = new UIWindow('📖 Knowledge', 290);
  private lastKey = '';

  constructor(private readonly village: Village) {}

  update(): void {
    if (!this.win.visible) return;
    const v = this.village;
    const key = `${Math.floor(v.knowledge)}:${v.researched.size}`;
    if (key === this.lastKey) return;
    this.lastKey = key;

    this.win.body.innerHTML = `<div class="tech-head">${Math.floor(v.knowledge)} 📖 knowledge available</div>`;
    for (const tech of TECHS) {
      const row = document.createElement('div');
      row.className = 'tech';
      const info = document.createElement('span');
      info.innerHTML = `${tech.icon} <strong>${tech.label}</strong> · ${tech.cost}📖<br><small>${tech.desc}</small>`;
      row.appendChild(info);
      if (v.researched.has(tech.id)) {
        const done = document.createElement('span');
        done.textContent = '✓';
        done.className = 'tech-done';
        row.appendChild(done);
      } else if (tech.requires && !v.researched.has(tech.requires)) {
        const lock = document.createElement('span');
        lock.textContent = `🔒 ${techById(tech.requires).label}`;
        lock.className = 'tech-lock';
        row.appendChild(lock);
      } else {
        const btn = document.createElement('button');
        btn.textContent = 'Research';
        btn.disabled = !v.canResearch(tech);
        btn.addEventListener('click', () => {
          if (v.research(tech)) this.lastKey = '';
        });
        row.appendChild(btn);
      }
      this.win.body.appendChild(row);
    }
  }
}

// ---------------------------------------------------------------- Tribes

const SIDE_LABELS: Record<string, string> = { north: '⬆ North', east: '➡ East', south: '⬇ South', west: '⬅ West' };

interface TribeRow {
  tribe: Tribe;
  bar: HTMLElement;
  barLabel: HTMLElement;
  giveSel: HTMLSelectElement;
  amountInp: HTMLInputElement;
  recvSel: HTMLSelectElement;
  estEl: HTMLElement;
  sendBtn: HTMLButtonElement;
  attackBtn: HTMLButtonElement;
  header: HTMLElement;
}

export class TribesPanel {
  readonly win = new UIWindow('🏕 Tribes', 330);
  private rows: TribeRow[] = [];
  private caravanEl: HTMLElement;
  private postWarn: HTMLElement;

  constructor(
    private readonly village: Village,
    private readonly trade: TradeSystem,
    private readonly war: WarSystem,
  ) {
    this.postWarn = document.createElement('div');
    this.postWarn.className = 'stat-warn';
    this.win.body.appendChild(this.postWarn);

    for (const tribe of trade.tribes) {
      const box = document.createElement('div');
      box.className = 'tribe-box';
      const colorHex = `#${tribe.color.toString(16).padStart(6, '0')}`;
      const header = document.createElement('div');
      header.innerHTML =
        `<span class="tribe-dot" style="background:${colorHex}"></span>` +
        `<strong>${tribe.name}</strong> · ${SIDE_LABELS[tribe.side]} · ${tribe.personaLabel}`;
      box.appendChild(header);

      const barWrap = document.createElement('div');
      barWrap.className = 'storage-bar';
      const bar = document.createElement('div');
      bar.className = 'storage-fill';
      barWrap.appendChild(bar);
      const barLabel = document.createElement('div');
      barLabel.className = 'work-note';
      box.append(barWrap, barLabel);

      const goods = document.createElement('div');
      goods.className = 'work-note';
      goods.innerHTML =
        `Sells cheap: ${tribe.sells.map((k) => RESOURCE_ICONS[k]).join(' ')} · ` +
        `Pays well for: ${tribe.needs.map((k) => RESOURCE_ICONS[k]).join(' ')}`;
      box.appendChild(goods);

      // Trade form.
      const form = document.createElement('div');
      form.className = 'row';
      const giveSel = document.createElement('select');
      for (const k of TRADE_GOODS) giveSel.add(new Option(RESOURCE_LABELS[k], k));
      const amountInp = document.createElement('input');
      amountInp.type = 'number';
      amountInp.value = '10';
      amountInp.min = '1';
      amountInp.style.width = 'calc(var(--u) * 44)';
      const arrow = document.createElement('span');
      arrow.textContent = '→';
      const recvSel = document.createElement('select');
      recvSel.add(new Option('🎁 gift', ''));
      for (const k of TRADE_GOODS) recvSel.add(new Option(RESOURCE_LABELS[k], k));
      recvSel.value = 'berries';
      form.append(giveSel, amountInp, arrow, recvSel);
      box.appendChild(form);

      const actionRow = document.createElement('div');
      actionRow.className = 'row';
      const estEl = document.createElement('span');
      estEl.style.flex = '1';
      const sendBtn = document.createElement('button');
      sendBtn.textContent = 'Send caravan';
      sendBtn.addEventListener('click', () => {
        const receive = recvSel.value === '' ? null : (recvSel.value as ResourceKind);
        const err = this.trade.sendCaravan(tribe, giveSel.value as ResourceKind, Number(amountInp.value) || 0, receive);
        if (err) estEl.innerHTML = `<span class="stat-bad">${err}</span>`;
      });
      const attackBtn = document.createElement('button');
      attackBtn.textContent = '⚔ Attack';
      attackBtn.dataset.tip = 'March all soldiers on this tribe (auto-resolved battle at their camp)';
      attackBtn.addEventListener('click', () => {
        const err = this.war.attackTribe(tribe);
        if (err) estEl.innerHTML = `<span class="stat-bad">${err}</span>`;
      });
      actionRow.append(estEl, sendBtn, attackBtn);
      box.appendChild(actionRow);

      this.win.body.appendChild(box);
      this.rows.push({ tribe, bar, barLabel, giveSel, amountInp, recvSel, estEl, sendBtn, attackBtn, header });
    }

    this.caravanEl = document.createElement('div');
    this.caravanEl.className = 'work-note';
    this.win.body.appendChild(this.caravanEl);
  }

  update(): void {
    if (!this.win.visible) return;
    const hasPost = this.village.tradingPostTile() !== null;
    this.postWarn.textContent = hasPost ? '' : '⚠ Build a trading post to send caravans.';
    for (const r of this.rows) {
      const rel = r.tribe.relation;
      const pct = ((rel + 100) / 200) * 100;
      r.bar.style.width = `${pct}%`;
      r.bar.className = `storage-fill ${rel < -20 ? 'fill-bad' : rel < 20 ? 'fill-warn' : ''}`;
      const defeated = r.tribe.defeated;
      r.barLabel.textContent = defeated
        ? `☑ Subdued — trades peacefully forever`
        : `Relations: ${rel > 0 ? '+' : ''}${Math.round(rel)} · their strength ≈ ${this.war.tribeStrength(r.tribe)} (yours: ${this.village.soldiers().reduce((s, v) => s + v.combatStrength, 0)})`;
      r.attackBtn.disabled = defeated || this.war.party !== null || this.village.soldiers().length < 3;
      const give = r.giveSel.value as ResourceKind;
      const amount = Number(r.amountInp.value) || 0;
      const have = Math.floor(this.village.resources[give]);
      if (r.recvSel.value === '') {
        r.estEl.textContent = `Gift (+~${Math.max(1, Math.round(((amount * 1) || 0) / 8))} relations) · have ${have}`;
      } else {
        const est = this.trade.estimate(r.tribe, give, amount, r.recvSel.value as ResourceKind);
        r.estEl.textContent = `≈ receive ${est} · have ${have}`;
      }
      r.sendBtn.disabled = !hasPost || amount <= 0 || have < amount;
    }
    this.caravanEl.textContent = this.trade.caravans.length > 0
      ? `🐂 Caravans on the road: ${this.trade.caravans.map((c) => `${c.tribe.name} (${c.state})`).join(', ')}`
      : '';
  }
}

// ---------------------------------------------------------------- Statistics

import { SEASON_SECONDS } from '../sim/calendar';

export class StatsPanel {
  readonly win = new UIWindow('📊 Chronicle', 300);
  private canvas: HTMLCanvasElement;
  private infoEl: HTMLElement;
  private lastSamples = -1;

  constructor(private readonly village: Village) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 272;
    this.canvas.height = 120;
    this.canvas.style.width = '100%';
    this.canvas.style.background = 'rgba(255,255,255,0.04)';
    this.canvas.style.borderRadius = 'calc(var(--u) * 4)';
    this.infoEl = document.createElement('div');
    const legend = document.createElement('div');
    legend.className = 'work-note';
    legend.innerHTML = '<span style="color:#8fc47f">■</span> population · <span style="color:#d8a25a">■</span> food · <span style="color:#d87a6a">■</span> firewood';
    this.win.body.append(this.canvas, legend, this.infoEl);
  }

  update(): void {
    if (!this.win.visible) return;
    const v = this.village;
    if (v.history.length !== this.lastSamples) {
      this.lastSamples = v.history.length;
      this.draw();
    }
    this.infoEl.innerHTML = `
      <div class="info-row"><span>👥 Population</span><span>${v.villagers.length}</span></div>
      <div class="info-row"><span>👶 Births</span><span>${v.stats.births}</span></div>
      <div class="info-row"><span>⚰️ Deaths</span><span>${v.stats.deaths}</span></div>
      <div class="info-row"><span>🏠 Houses</span><span>${v.houseCount()} (${v.bedCount()} beds)</span></div>
      <div class="info-row"><span>📖 Techs researched</span><span>${v.researched.size}</span></div>
    `;
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d')!;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);
    const h = this.village.history;
    if (h.length < 2) return;
    const series: { key: 'pop' | 'food' | 'firewood'; color: string }[] = [
      { key: 'food', color: '#d8a25a' },
      { key: 'firewood', color: '#d87a6a' },
      { key: 'pop', color: '#8fc47f' },
    ];
    // Year gridlines.
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    const t0 = h[0].t;
    const t1 = h[h.length - 1].t;
    for (let y = Math.ceil(t0 / (SEASON_SECONDS * 4)); y * SEASON_SECONDS * 4 <= t1; y++) {
      const x = ((y * SEASON_SECONDS * 4 - t0) / (t1 - t0)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (const s of series) {
      const max = Math.max(...h.map((p) => p[s.key]), 1);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      h.forEach((p, i) => {
        const x = (i / (h.length - 1)) * width;
        const y = height - 4 - (p[s.key] / max) * (height - 10);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- Save / Load

import { SAVE_SLOTS, deleteSlot, readSlot, requestLoad, slotSummary, writeSlot, type SaveData, type SaveSlot } from '../sim/save';

export class SavePanel {
  readonly win = new UIWindow('💾 Save & Load', 300);

  constructor(private readonly capture: () => SaveData) {
    this.render();
  }

  private render(): void {
    this.win.body.innerHTML = '';
    for (const slot of SAVE_SLOTS) {
      const row = document.createElement('div');
      row.className = 'row';
      const label = document.createElement('span');
      label.style.flex = '1';
      const summary = slotSummary(slot);
      const slotName = slot === 'auto' ? '🕐 Autosave' : `Slot ${slot}`;
      label.innerHTML = `<strong>${slotName}</strong><br><small>${summary ?? 'empty'}</small>`;
      row.appendChild(label);

      if (slot !== 'auto') {
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => {
          writeSlot(slot, this.capture());
          this.render();
        });
        row.appendChild(saveBtn);
      }
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Load';
      loadBtn.disabled = summary === null;
      loadBtn.addEventListener('click', () => {
        const data = readSlot(slot);
        if (data) requestLoad(data); // reloads the page
      });
      row.appendChild(loadBtn);
      if (summary !== null && slot !== 'auto') {
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑';
        delBtn.title = 'Delete this save';
        delBtn.addEventListener('click', () => {
          deleteSlot(slot as SaveSlot);
          this.render();
        });
        row.appendChild(delBtn);
      }
      this.win.body.appendChild(row);
    }
    const note = document.createElement('div');
    note.className = 'work-note';
    note.style.marginTop = 'calc(var(--u) * 8)';
    note.textContent = 'Autosaves every new year. Caravans/raids in transit are not saved.';
    this.win.body.appendChild(note);
  }

  /** Refresh summaries when opened. */
  update(): void {
    // Rendered on demand; nothing per-frame.
  }

  refresh(): void {
    this.render();
  }
}

// ---------------------------------------------------------------- Character

import type { Villager } from '../sim/village';

const TOOL_LABELS: Record<string, string> = {
  none: 'none', wood: 'Wooden tool', stone: 'Stone tool', bronze: 'Bronze tool', iron: 'Iron tool', net: 'Fishing net',
};
const CLOTHING_LABELS: Record<string, string> = {
  none: 'ragged', basic: '🧥 basic clothes', fine: '👔 fine clothes', luxury: '👘 luxury clothes',
};
const SHOE_LABELS: Record<string, string> = {
  none: 'barefoot (−10% speed)', sandals: '🩴 sandals', hide: '👞 hide shoes', boots: '🥾 boots', luxury: '👢 luxury boots',
};
const WEAPON_LABELS: Record<string, string> = {
  none: '—', spear: 'Spear', bronze: 'Bronze weapon', iron: 'Iron weapon',
};

export class CharacterPanel {
  readonly win = new UIWindow('Villager', 260, false); // opens on selection only
  private current: Villager | null = null;
  private titleEl: HTMLElement;

  constructor(private readonly village: Village) {
    this.titleEl = this.win.root.querySelector('.ui-window-bar span')!;
    this.win.onClose = () => (this.current = null);
  }

  private lastCharHtml = '';

  open(v: Villager): void {
    this.current = v;
    this.lastCharHtml = '';
    this.win.show();
    this.update();
  }

  /** Owner rule (session 27): the ℹ️ tooltip itemizes every happiness effect. */
  private happinessTip(v: Villager): string {
    const joy: Record<string, number> = { none: 0, basic: 5, fine: 10, luxury: 15 };
    const parts: string[] = ['base 50'];
    parts.push(v.home ? 'has a home +20' : 'homeless −15');
    if (v.spouse) parts.push('married +10');
    if (joy[v.clothing]) parts.push(`${v.clothing} clothes +${joy[v.clothing]}`);
    if (v.tool !== 'none') parts.push('owns a tool +5');
    if (v.dietBonus) parts.push(`food variety at home +${v.dietBonus}`);
    if (v.templeBonus) parts.push(`temple blessing +${v.templeBonus}`);
    parts.push(v.home && v.home.potteryCount > 0 ? 'pottery at home +5' : 'no pottery −5');
    if (v.hungerStrikes) parts.push(`hunger −${v.hungerStrikes * 10}`);
    if (v.coldStrikes) parts.push(`cold −${v.coldStrikes * 10}`);
    if (v.ill) parts.push('sick −15 (and works at half pace)');
    if (v.griefTimer > 0) parts.push('mourning a death −20');
    if (v.raggedPenalty) parts.push(`ragged clothes −${v.raggedPenalty} (seasonal)`);
    const shoeJoy: Record<string, number> = { none: -5, sandals: 0, hide: 5, boots: 10, luxury: 15 };
    if (v.shoes === 'none') parts.push('barefoot −5');
    else if (shoeJoy[v.shoes]) parts.push(`${SHOE_LABELS[v.shoes]} +${shoeJoy[v.shoes]}`);
    return parts.join('  ·  ');
  }

  private healthTip(v: Villager): string {
    const parts: string[] = ['base 100'];
    if (v.ill) parts.push('sick −35');
    if (v.hungerStrikes) parts.push(`hunger −${v.hungerStrikes * 15}`);
    if (v.coldStrikes) parts.push(`cold −${v.coldStrikes * 15}`);
    if (v.ageYears > v.lifespan - 5) parts.push('old age −20');
    if (parts.length === 1) parts.push('in perfect shape');
    return parts.join('  ·  ');
  }

  update(): void {
    if (!this.win.visible || !this.current) return;
    const v = this.current;
    if (v.dead || !this.village.villagers.includes(v)) {
      this.win.body.innerHTML = '<small>This villager has passed away.</small>';
      return;
    }
    this.titleEl.innerHTML = `${v.sex === 'male' ? '♂' : '♀'} ${v.isBaron ? '👑 Baron ' : ''}${v.name}`;
    const stage = v.isBaby ? '👶 Baby' : v.isChild ? '🧒 Child' : v.ageYears >= 50 ? '🧓 Elder' : '🧑 Adult';
    const occupation = v.isBaby ? '—' : v.isChild
      ? (this.village.studentCount() > 0 ? '📖 Pupil' : 'Child')
      : v.profession ? PROFESSION_LABELS[v.profession] : '💤 Unemployed';
    const hClass = (n: number) => (n >= 70 ? 'stat-ok' : n >= 35 ? 'stat-warn' : 'stat-bad');
    const html = `
      <div class="info-row"><span>Age</span><span>${Math.floor(v.ageYears)} · ${stage}</span></div>
      <div class="info-row"><span>Occupation</span><span>${occupation}</span></div>
      <div class="info-row"><span>Doing now</span><span>${v.activity}</span></div>
      <div class="info-row"><span>Health <span data-tip="${this.healthTip(v)}">ℹ️</span></span><span class="${hClass(v.health)}">${v.health}${v.ill ? (v.illTreated ? ' · 🤒 sick (treated)' : ' · 🤒 sick') : ''}</span></div>
      <div class="info-row"><span>Happiness <span data-tip="${this.happinessTip(v)}">ℹ️</span></span><span class="${hClass(v.happiness)}">${v.happiness}${v.griefTimer > 0 ? ' · 🖤 in mourning' : ''}</span></div>
      <div class="info-row"><span>Tool</span><span>${TOOL_LABELS[v.tool]}${v.tool !== 'none' ? ` (${v.toolUses} uses left)` : ''}</span></div>
      <div class="info-row"><span>Weapon</span><span>${WEAPON_LABELS[v.weapon]}${v.hasArmor ? ' + 🛡️ armor' : ''}</span></div>
      <div class="info-row"><span>Clothing</span><span>${CLOTHING_LABELS[v.clothing]}</span></div>
      <div class="info-row"><span>Shoes</span><span>${SHOE_LABELS[v.shoes]}</span></div>
      <div class="info-row"><span>Family</span><span>${v.spouse ? `💍 ${v.spouse.name}` : 'unmarried'}${v.pregnantTimer > 0 ? ' · 🤰 expecting' : ''}</span></div>
      ${(() => {
        const parents = [v.father?.name, v.mother?.name].filter(Boolean).join(' & ');
        const children = this.village.villagers.filter((c) => c.mother === v || c.father === v).map((c) => c.name).join(', ');
        let rows = '';
        if (parents) rows += `<div class="info-row"><span>Parents</span><span>${parents}</span></div>`;
        if (children) rows += `<div class="info-row"><span>Children</span><span>${children}</span></div>`;
        return rows;
      })()}
      <div class="info-row"><span>Home</span><span>${v.home ? v.home.spec.label : 'homeless'}</span></div>
    `;
    // Re-render only on change so tooltips and clicks aren't swallowed.
    if (html !== this.lastCharHtml) {
      this.lastCharHtml = html;
      this.win.body.innerHTML = html;
    }
  }
}

// ---------------------------------------------------------------- Building info

export class BuildingInfoPanel {
  readonly win = new UIWindow('Building', 270, false); // opens on selection only
  /** Set by main: opens the character window for a clicked occupant. */
  onSelectVillager: ((v: Villager) => void) | null = null;
  private current: Building | null = null;
  private titleEl: HTMLElement;

  constructor(private readonly village: Village) {
    this.titleEl = this.win.root.querySelector('.ui-window-bar span')!;
    this.win.onClose = () => (this.current = null);
    this.win.body.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const vEl = target.closest('[data-villager]');
      if (vEl && this.current) {
        const v = this.current.occupants[Number(vEl.getAttribute('data-villager'))];
        if (v) this.onSelectVillager?.(v);
        return;
      }
      const aEl = target.closest('[data-action]');
      if (!aEl || !this.current) return;
      const b = this.current;
      const action = aEl.getAttribute('data-action')!;
      if (action === 'mw-minus') b.maxWorkers = Math.max(0, b.maxWorkers - 1);
      else if (action === 'mw-plus') b.maxWorkers = Math.min(b.spec.workerSlots, b.maxWorkers + 1);
      else if (action.startsWith('mode:')) b.productionMode = action.slice(5);
      else if (action === 'cancel') {
        if (this.village.cancelBuilding(b)) this.win.hide();
      } else if (action === 'destroy') this.village.markDemolition(b);
      else if (action === 'refit') this.village.upgradeWorkshop(b);
      else if (action.startsWith('upgrade:')) {
        if (this.village.upgradeHouse(b, action.slice(8) as BuildingKind)) this.win.hide();
      }
    });
  }

  /** Product choices for workshops (owner: "choose which building does what").
   *  Each option's tooltip spells out the recipe (owner rule, session 29). */
  private static MODES: Partial<Record<BuildingKind, { value: string; label: string; tip?: string }[]>> = {
    brickOven: [
      { value: 'auto', label: 'Bricks', tip: 'Requires 2 clay + 1 firewood → 3 bricks' },
      { value: 'clayTiles', label: 'Clay tiles', tip: 'Requires 2 clay + 1 firewood → 3 clay tiles' },
    ],
    smelter: [
      { value: 'auto', label: 'Auto', tip: 'Smelts the best bar the materials allow (iron first)' },
      { value: 'bronze', label: 'Bronze', tip: 'Requires 1 copper ore + 1 tin ore + 1 firewood → 1 bronze bar' },
      { value: 'iron', label: 'Iron', tip: 'Requires 2 iron ore + 1 coal → 1 iron bar (Iron working)' },
    ],
    toolmaker: [
      { value: 'auto', label: 'Best', tip: 'Crafts the best tier the materials allow' },
      { value: 'wooden', label: 'Wood', tip: 'Requires 2 wood → 2 wooden tools' },
      { value: 'stone', label: 'Stone', tip: 'Requires 2 stone + 1 wood → 2 stone tools' },
      { value: 'bronze', label: 'Bronze', tip: 'Requires 1 bronze bar + 1 wood → 2 bronze tools' },
      { value: 'iron', label: 'Iron', tip: 'Requires 1 iron bar + 1 wood → 2 iron tools' },
    ],
    weaponsmith: [
      { value: 'auto', label: 'Auto', tip: 'Weapons until every soldier is armed, then armor' },
      { value: 'weapons', label: 'Weapons', tip: 'Spear: 2 wood + 1 stone · Bronze: 1 bar + 1 wood · Iron: 1 bar + 1 wood' },
      { value: 'armor', label: 'Armor', tip: 'Requires 2 hides → 1 leather armor' },
    ],
    weaver: [
      { value: 'auto', label: 'Auto', tip: 'Twists string until a small buffer is met, then weaves linen' },
      { value: 'string', label: '🧵 String', tip: 'Requires 2 straw → 1 string' },
      { value: 'linen', label: 'Linen', tip: 'Requires 2 string → 1 linen' },
    ],
    tailor: [
      { value: 'auto', label: 'Best', tip: 'Sews the best garment the materials allow' },
      { value: 'basic', label: '🧥 Basic', tip: 'Requires 1 linen OR 1 hide → 1 basic clothes' },
      { value: 'fine', label: '👔 Fine', tip: 'Requires 2 linen + 2 leather → 1 fine clothes (+10 😊, warmer)' },
      { value: 'luxury', label: '👘 Luxury', tip: 'Requires 2 linen + 2 leather + 2 fur → 1 luxury clothes (+15 😊, warmest)' },
    ],
    cobbler: [
      { value: 'auto', label: 'Best', tip: 'Cobbles the best footwear the materials allow' },
      { value: 'sandals', label: '🩴', tip: 'Requires 1 string + 1 straw → sandals (last 90 days)' },
      { value: 'hide', label: '👞', tip: 'Requires 1 hide → hide shoes (+5 😊, 120 days)' },
      { value: 'boots', label: '🥾', tip: 'Requires 1 leather → boots (+10 😊, 180 days)' },
      { value: 'luxury', label: '👢', tip: 'Requires 1 leather + 1 fur → luxury boots (+15 😊, 240 days)' },
    ],
    cropField: [
      { value: 'wheat', label: '🌾 Wheat' },
      { value: 'rye', label: '🌾 Rye' },
      { value: 'oat', label: '🌾 Oat' },
      { value: 'barley', label: '🌾 Barley' },
      { value: 'potatoes', label: '🥔' },
      { value: 'tomatoes', label: '🍅' },
      { value: 'peppers', label: '🌶️' },
      { value: 'strawberries', label: '🍓' },
      { value: 'carrots', label: '🥕' },
      { value: 'melons', label: '🍈' },
      { value: 'watermelons', label: '🍉' },
    ],
  };

  private lastHtml = '';

  open(b: Building): void {
    this.current = b;
    this.titleEl.innerHTML = `${BUILDING_ICONS[b.spec.kind]} ${b.spec.label}`;
    this.lastHtml = '';
    this.win.show();
    this.update();
  }

  /** Only touch the DOM when content actually changed — rebuilding the HTML
   *  every frame swallowed button clicks (owner bug: couldn't switch modes). */
  private render(html: string): void {
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    this.win.body.innerHTML = html;
  }

  update(): void {
    if (!this.win.visible || !this.current) return;
    const b = this.current;
    const v = this.village;

    if (b.state !== 'complete') {
      const pct = Math.round(b.progress() * 100);
      let materials = '';
      for (const m of BUILD_MATERIALS) {
        const need = b.spec.cost[m] ?? 0;
        if (need > 0) materials += `<div class="info-row"><span>${RESOURCE_ICONS[m]} ${m}</span><span>${b.delivered[m] ?? 0} / ${need}</span></div>`;
      }
      const status = b.demolition
        ? '🧹 Being dismantled…'
        : b.state === 'awaitingMaterials' ? 'Waiting for materials…' : 'Under construction…';
      const controls = b.demolition
        ? ''
        : b.totalDelivered() === 0
          ? `<button data-action="cancel">✖ Cancel site</button>`
          : `<button data-action="destroy" data-tip="Materials already delivered — builders must dismantle it; half comes back.">🧹 Demolish</button>`;
      this.render(`
        <div class="storage-label">${status} ${pct}%</div>
        <div class="storage-bar"><div class="storage-fill" style="width:${pct}%"></div></div>
        ${materials}
        <small>${b.spec.desc}</small>
        <div class="row">${controls}</div>
      `);
      return;
    }

    let html = `<small>${b.spec.desc}</small><hr>`;
    const kind = b.spec.kind;
    if (b.spec.capacity > 0) {
      html += `<div class="info-row"><span>Beds</span><span>${b.occupants.length} / ${b.spec.capacity}</span></div>`;
      html += `<div class="info-row"><span>Warmth</span><span class="${b.coldStrikes > 0 ? 'stat-bad' : 'stat-ok'}">${b.coldStrikes > 0 ? '🥶 cold!' : '🔥 warm'}</span></div>`;
      html += `<div class="info-row"><span>🔥 Firewood at home</span><span class="${b.firewoodStore < 2 ? 'stat-warn' : 'stat-ok'}">${Math.floor(b.firewoodStore)} / ${v.houseFirewoodCap(b)}</span></div>`;
      html += `<div class="info-row"><span>🏺 Pottery</span><span class="${b.potteryCount > 0 ? 'stat-ok' : 'stat-warn'}">${b.potteryCount} / ${v.housePotteryCap(b)} ${b.potteryCount > 0 ? '(+5 😊)' : '(−5 😊)'}</span></div>`;
      // Family pantry — food eaten & enjoyed at home.
      const pantryRows = Object.entries(b.pantry).filter(([, n]) => (n ?? 0) >= 1);
      html += `<div class="info-row"><span>🍽 Pantry</span><span>${Math.floor(b.pantryTotal())} / ${Village.PANTRY_LIMIT} max</span></div>`;
      if (pantryRows.length > 0) {
        html += `<div class="work-note" style="white-space:normal">${pantryRows
          .map(([k, n]) => `${RESOURCE_ICONS[k as ResourceKind] ?? ''} ${Math.floor(n ?? 0)}`)
          .join(' · ')}</div>`;
      }
      b.occupants.forEach((o, idx) => {
        const tag = o.isBaby ? ' 👶' : o.isChild ? ' 🧒' : o.spouse && o.spouse.home === b ? ' 💍' : '';
        html += `<div class="info-row villager-link" data-villager="${idx}"><span>${o.sex === 'male' ? '♂' : '♀'} ${o.name}${tag}</span><span>${Math.floor(o.ageYears)} yrs</span></div>`;
      });
      html += `<small>Click a name for details.</small>`;
    } else if (kind === 'storageShed' || kind === 'stockpile') {
      // Owner rule (session 28): every storage shows its OWN inventory.
      const used = Math.floor(b.storeTotal());
      const cap = v.storageCapacityOf(b);
      const pct = Math.min(100, (used / cap) * 100);
      html += `<div class="storage-label">This storage: ${used} / ${cap}</div>`;
      html += `<div class="storage-bar"><div class="storage-fill ${pct > 90 ? 'fill-bad' : pct > 70 ? 'fill-warn' : ''}" style="width:${pct}%"></div></div>`;
      for (const [kindKey, label] of Object.entries(RESOURCE_LABELS)) {
        const amount = Math.floor(b.store[kindKey] ?? 0);
        if (amount > 0) html += `<div class="info-row"><span>${RESOURCE_ICONS[kindKey as ResourceKind]} ${label}</span><span>${amount}</span></div>`;
      }
      html += `<small>Villagers fetch goods only from the storage that holds them. Demolishing a storage first moves its goods elsewhere.</small>`;
    } else if (kind === 'school') {
      const teachers = v.countByProfession().teacher;
      const students = v.studentCount();
      html += `<div class="info-row"><span>📖 Teachers</span><span>${teachers} / ${b.spec.workerSlots}</span></div>`;
      html += `<div class="info-row"><span>👶 Students</span><span>${students}</span></div>`;
      html += `<div class="info-row"><span>Knowledge rate</span><span>${(1 + 0.05 * students).toFixed(2)} per lesson</span></div>`;
    } else if (kind === 'huntingLodge') {
      const hunters = v.countByProfession().hunter;
      const deer = v.deerNear(b.centerX, b.centerZ, 60);
      const efficiency = Math.min(100, deer * 12);
      html += `<div class="info-row"><span>🏹 Hunters</span><span>${hunters} / ${b.maxWorkers}</span></div>`;
      html += `<div class="info-row"><span>🦌 Game nearby</span><span>${deer}</span></div>`;
      html += `<div class="info-row"><span>Efficiency</span><span class="${efficiency > 60 ? 'stat-ok' : efficiency > 25 ? 'stat-warn' : 'stat-bad'}">${efficiency}%</span></div>`;
    } else if (kind === 'cropField') {
      html += `<div class="info-row"><span>🌾 Growth</span><span>${Math.round(b.growth * 100)}%</span></div>`;
      html += `<div class="storage-bar"><div class="storage-fill" style="width:${Math.round(b.growth * 100)}%"></div></div>`;
      html += `<div class="info-row"><span>Farmers here</span><span>${v.workersAt(b).length}</span></div>`;
    } else if (b.spec.workerSlots > 0) {
      const prof: Profession | null =
        kind === 'fishingHut' ? 'fisher'
        : kind === 'herbalistHut' ? 'herbalist'
        : kind === 'toolmaker' ? 'toolmaker'
        : kind === 'clayPit' ? 'clayDigger'
        : kind === 'brickOven' ? 'brickmaker'
        : kind === 'woodcutterLodge' ? 'firewoodmaker'
        : kind === 'foresterHut' ? 'forester'
        : kind === 'mine' ? 'miner'
        : kind === 'smelter' ? 'smelter'
        : kind === 'weaponsmith' ? 'weaponsmith'
        : kind === 'trainingGround' ? 'soldier'
        : kind === 'tailor' ? 'tailor'
        : kind === 'weaver' ? 'weaver'
        : kind === 'bakery' ? 'baker'
        : kind === 'barn' ? 'farmer'
        : kind === 'pottery' ? 'potter'
        : kind === 'leatherworker' ? 'leatherworker'
        : kind === 'cobbler' ? 'cobbler'
        : null;
      if (kind === 'mine') {
        const veins: Record<number, string> = { 1: 'Copper', 2: 'Tin', 3: 'Iron', 4: 'Coal' };
        html += `<div class="info-row"><span>Vein</span><span>${veins[b.oreType] ?? 'none (!)'}</span></div>`;
      }
      if (kind === 'clayPit') {
        const left = Math.max(0, 1000 - Math.floor(b.clayTaken));
        html += left > 0
          ? `<div class="info-row"><span>🏺 Deposit left</span><span class="${left < 200 ? 'stat-warn' : ''}">${left} / 1000</span></div>`
          : `<div class="info-row"><span>🏺 Deposit</span><span class="stat-bad">exhausted — digging at 20% pace</span></div>`;
      }
      if (prof) {
        html += `<div class="info-row"><span>${PROFESSION_LABELS[prof]}</span><span>${v.countByProfession()[prof]} / ${v.desired[prof]}</span></div>`;
        html += `<div class="info-row"><span>Worker slots here</span><span>${b.maxWorkers}</span></div>`;
      }
      // Craftsmen stock their own shelves first (owner rule, session 30).
      const shelf = SHOP_STORE_CAPS[kind];
      if (shelf) {
        html += `<div class="info-row"><span>🗃 Shop shelf</span><span>${Math.floor(b.storeTotal())} / ${shelf.total}${shelf.perKind < shelf.total ? ` (max ${shelf.perKind} each)` : ''}</span></div>`;
        const rows = Object.entries(b.store).filter(([, n]) => (n ?? 0) >= 1);
        if (rows.length > 0) {
          html += `<div class="work-note" style="white-space:normal">${rows
            .map(([k2, n]) => `${RESOURCE_ICONS[k2 as ResourceKind] ?? ''} ${Math.floor(n ?? 0)}`)
            .join(' · ')}</div>`;
        }
      }
    }

    // Per-building worker cap (owner rule: adjust workers for each building).
    if (b.spec.workerSlots > 0) {
      html += `<div class="row"><span style="flex:1">Workers allowed</span>` +
        `<button data-action="mw-minus">−</button><span style="min-width:calc(var(--u)*34);text-align:center">${b.maxWorkers}/${b.spec.workerSlots}</span>` +
        `<button data-action="mw-plus">+</button></div>`;
    }
    // Production choice (owner rule: choose what each workshop makes).
    const modes = BuildingInfoPanel.MODES[kind];
    if (modes) {
      html += `<div class="row"><span style="flex:1">Produces</span>` +
        modes.map((m) => `<button data-action="mode:${m.value}" class="${b.productionMode === m.value ? 'active' : ''}"${m.tip ? ` data-tip="${m.tip}"` : ''}>${m.label}</button>`).join('') +
        `</div>`;
    }
    // House upgrades: the family moves out first and is rehoused if possible.
    if (kind === 'house' || kind === 'stoneHouse') {
      const targets: BuildingKind[] = kind === 'house' ? ['stoneHouse', 'brickHouse'] : ['brickHouse'];
      html += `<div class="row">` + targets
        .map((t) => {
          const unlocked = v.isBuildingUnlocked(t);
          const spec = BUILDING_SPECS[t];
          const cost = BUILD_MATERIALS.filter((m) => (spec.cost[m] ?? 0) > 0).map((m) => `${spec.cost[m]} ${RESOURCE_LABELS[m]}`).join(' + ');
          return `<button data-action="upgrade:${t}" ${unlocked ? '' : 'disabled'} data-tip="${unlocked ? `Rebuild as ${spec.label} (${cost}). Occupants move out and are rehoused where possible.` : 'Requires research'}">⬆ ${spec.label}</button>`;
        })
        .join('') + `</div>`;
    }
    // Workshop refit (owner rule: straw-built workshops upgrade for +20%).
    if (isUpgradableWorkshop(kind)) {
      if (b.upgraded) {
        html += `<div class="info-row"><span>⬆ Refitted</span><span class="stat-ok">+20% productivity</span></div>`;
      } else {
        html += `<div class="row"><button data-action="refit" ${v.canUpgradeWorkshop(b) ? '' : 'disabled'} data-tip="Refit with 4 wood + 4 stone + 4 bricks + 4 clay tiles — workers here gain 20% productivity.">⬆ Refit (+20%)</button></div>`;
      }
    }
    // Demolition.
    if (b.demolition) {
      html += `<div class="row"><span class="stat-warn">🧹 Awaiting dismantling by builders…</span></div>`;
    } else {
      html += `<div class="row"><button data-action="destroy" data-tip="Builders tear it down; half the materials are recovered.">🧹 Demolish</button></div>`;
    }
    this.render(html);
  }
}
