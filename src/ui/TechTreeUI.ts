/**
 * The tech tree screen (Roadmap v2, Phase B). Opened with the 🌳 menu button:
 * a full-screen chart — tier columns T0–T6, branch rows, prerequisite lines —
 * with drag-pan and wheel-zoom. Hovering a tech shows its info card (image,
 * era, knowledge cost, effect, description); tiers beyond the current era are
 * locked and dimmed (owner decision 12). DEV MODE (owner request, 2026-08-28):
 * double-clicking any tech completes it "as if played" — all earlier tiers and
 * its prerequisite chain complete with it; finishing a tier advances the era
 * and plays the chapter intro with the new era's name.
 */

import {
  BRANCH_LABELS, BRANCH_ORDER, STUB_TIERS, TECH_NODES, TIER_NAMES,
  TechTreeState, techNodeById, type TechNode,
} from '../sim/techtree';

const NODE_W = 168;
const NODE_H = 48;
const GAP_Y = 10;
const COL_W = NODE_W + 64;
const LABEL_W = 150;
const HEADER_H = 56;
const BAND_GAP = 22;
const STUB_W = 200;

export class TechTreeUI {
  readonly state = new TechTreeState();
  /** Fired when completing techs pushes the game into a new era (index 1..6). */
  onEraAdvance: ((tier: number, eraName: string) => void) | null = null;
  /** Optional event-feed hook. */
  onMessage: ((text: string) => void) | null = null;

  private overlay: HTMLDivElement | null = null;
  private world!: HTMLDivElement;
  private headerInfo!: HTMLSpanElement;
  private card!: HTMLDivElement;
  private nodeEls = new Map<string, HTMLDivElement>();
  private edgeEls: { from: string; to: string; el: SVGPathElement }[] = [];
  private zoom = 0.8;
  private panX = 20;
  private panY = 10;
  private pos = new Map<string, { x: number; y: number }>();

  get visible(): boolean {
    return !!this.overlay;
  }

  toggle(): void {
    if (this.overlay) this.close();
    else this.open();
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.nodeEls.clear();
    this.edgeEls = [];
  }

  open(): void {
    if (this.overlay) return;
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:55;background:rgba(8,10,12,0.96);display:flex;flex-direction:column;';
    this.overlay = overlay;

    // ---- header bar
    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;gap:calc(var(--u) * 12);padding:calc(var(--u) * 8) calc(var(--u) * 14);' +
      'background:#151b1f;border-bottom:1px solid #2c3a42;color:#cfe3ee;flex:0 0 auto;' +
      'font-size:calc(var(--u) * 13);';
    const title = document.createElement('span');
    title.textContent = '🌳 Tech Tree';
    title.style.cssText = 'font-weight:bold;font-size:calc(var(--u) * 15);';
    this.headerInfo = document.createElement('span');
    this.headerInfo.style.cssText = 'flex:1;color:#9fb8c6;';
    const hint = document.createElement('span');
    hint.textContent = 'drag to pan · wheel to zoom · double-click a tech to complete it (dev)';
    hint.style.cssText = 'color:#5f7784;font-style:italic;';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↺ Reset';
    resetBtn.dataset.tip = 'Forget every research (dev)';
    resetBtn.addEventListener('click', () => {
      this.state.reset();
      this.refresh();
    });
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.dataset.tip = 'Close (Esc)';
    closeBtn.addEventListener('click', () => this.close());
    for (const b of [resetBtn, closeBtn]) {
      b.style.cssText =
        'background:#22303a;border:1px solid #3b4f5c;border-radius:calc(var(--u) * 4);color:#cfe3ee;' +
        'padding:calc(var(--u) * 4) calc(var(--u) * 10);cursor:pointer;font-size:calc(var(--u) * 12);';
    }
    header.append(title, this.headerInfo, hint, resetBtn, closeBtn);

    // ---- pannable chart
    const viewport = document.createElement('div');
    viewport.style.cssText = 'flex:1;overflow:hidden;position:relative;cursor:grab;';
    const world = document.createElement('div');
    world.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;';
    this.world = world;
    viewport.appendChild(world);

    this.buildChart();

    // Pan by dragging anywhere that's not a node.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    viewport.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      viewport.style.cursor = 'grabbing';
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.panX += e.clientX - lastX;
      this.panY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.applyTransform();
    });
    viewport.addEventListener('pointerup', () => {
      dragging = false;
      viewport.style.cursor = 'grab';
    });
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.pow(1.0016, -e.deltaY);
      const z = Math.min(1.6, Math.max(0.3, this.zoom * factor));
      // Zoom around the cursor so the point under the mouse stays put.
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      this.panX = cx - ((cx - this.panX) / this.zoom) * z;
      this.panY = cy - ((cy - this.panY) / this.zoom) * z;
      this.zoom = z;
      this.applyTransform();
    }, { passive: false });

    // ---- hover info card
    const card = document.createElement('div');
    card.style.cssText =
      'position:fixed;z-index:57;display:none;width:calc(var(--u) * 250);pointer-events:none;' +
      'background:#10171c;border:1px solid #3b5468;border-radius:calc(var(--u) * 6);' +
      'padding:calc(var(--u) * 10);color:#cfe3ee;font-size:calc(var(--u) * 12);line-height:1.45;' +
      'box-shadow:0 calc(var(--u) * 6) calc(var(--u) * 24) rgba(0,0,0,0.6);';
    this.card = card;

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && this.overlay) {
        this.close();
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);

    overlay.append(header, viewport, card);
    document.body.appendChild(overlay);
    this.applyTransform();
    this.refresh();
  }

  // ------------------------------------------------------------- chart build

  private buildChart(): void {
    this.nodeEls.clear();
    this.edgeEls = [];
    this.pos.clear();
    const world = this.world;
    world.innerHTML = '';

    // Vertical bands: one per branch, tall enough for its busiest tier.
    const buckets = new Map<string, TechNode[]>();
    for (const n of TECH_NODES) {
      const key = `${n.branch}:${n.tier}`;
      const arr = buckets.get(key) ?? [];
      arr.push(n);
      buckets.set(key, arr);
    }
    const bandTop = new Map<string, number>();
    let y = HEADER_H + 8;
    for (const b of BRANCH_ORDER) {
      let rows = 0;
      for (let t = 0; t <= 6; t++) rows = Math.max(rows, buckets.get(`${b}:${t}`)?.length ?? 0);
      bandTop.set(b, y);
      y += rows * (NODE_H + GAP_Y) + BAND_GAP;
    }
    const totalH = y + 20;
    const totalW = LABEL_W + 7 * COL_W + STUB_TIERS.length * STUB_W + 60;
    world.style.width = `${totalW}px`;
    world.style.height = `${totalH}px`;

    // Node positions.
    for (const [key, arr] of buckets) {
      const [branch, tierStr] = key.split(':');
      const tier = Number(tierStr);
      arr.forEach((n, i) => {
        this.pos.set(n.id, {
          x: LABEL_W + tier * COL_W,
          y: (bandTop.get(branch) ?? 0) + i * (NODE_H + GAP_Y),
        });
      });
    }

    // Edges first (under the nodes).
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(totalW));
    svg.setAttribute('height', String(totalH));
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    for (const n of TECH_NODES) {
      const to = this.pos.get(n.id)!;
      for (const p of n.prereqs) {
        const from = this.pos.get(p);
        if (!from) continue;
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', '2');
        svg.appendChild(path);
        this.edgeEls.push({ from: p, to: n.id, el: path });
      }
    }
    world.appendChild(svg);

    // Tier headers.
    for (let t = 0; t <= 6; t++) {
      const h = document.createElement('div');
      h.style.cssText =
        `position:absolute;left:${LABEL_W + t * COL_W}px;top:6px;width:${NODE_W}px;` +
        'text-align:center;color:#d8b872;font-weight:bold;font-size:calc(var(--u) * 13);line-height:1.25;';
      h.innerHTML = `T${t}<br><span style="font-size:calc(var(--u) * 11);color:#b09055">${TIER_NAMES[t]}</span>`;
      world.appendChild(h);
      const col = document.createElement('div');
      col.style.cssText =
        `position:absolute;left:${LABEL_W + t * COL_W - 18}px;top:${HEADER_H}px;width:1px;` +
        `height:${totalH - HEADER_H - 10}px;background:#1d262c;`;
      world.appendChild(col);
    }

    // Branch labels.
    for (const b of BRANCH_ORDER) {
      const l = document.createElement('div');
      l.style.cssText =
        `position:absolute;left:8px;top:${bandTop.get(b)}px;width:${LABEL_W - 24}px;` +
        'color:#8fa8b5;font-size:calc(var(--u) * 12);font-weight:bold;';
      l.textContent = BRANCH_LABELS[b];
      world.appendChild(l);
    }

    // Nodes.
    for (const n of TECH_NODES) {
      const p = this.pos.get(n.id)!;
      const el = document.createElement('div');
      el.style.cssText =
        `position:absolute;left:${p.x}px;top:${p.y}px;width:${NODE_W}px;height:${NODE_H}px;` +
        'box-sizing:border-box;border-radius:calc(var(--u) * 5);padding:calc(var(--u) * 4) calc(var(--u) * 7);' +
        'display:flex;align-items:center;gap:calc(var(--u) * 6);cursor:pointer;user-select:none;overflow:hidden;';
      el.innerHTML =
        `<span style="font-size:calc(var(--u) * 17);flex:0 0 auto;">${n.icon}</span>` +
        `<span style="flex:1;min-width:0;font-size:calc(var(--u) * 11);line-height:1.2;color:inherit;">` +
        `${n.star ? '⭐ ' : ''}${n.name}<br><span style="opacity:0.75;">📖 ${n.kp}</span></span>`;
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('mouseenter', () => this.showCard(n, el));
      el.addEventListener('mouseleave', () => {
        this.card.style.display = 'none';
      });
      el.addEventListener('dblclick', () => this.devComplete(n));
      this.nodeEls.set(n.id, el);
      world.appendChild(el);
    }

    // The chapters beyond: locked plaques for T7/T8/Epilogue.
    STUB_TIERS.forEach((s, i) => {
      const x = LABEL_W + 7 * COL_W + i * STUB_W;
      const plaque = document.createElement('div');
      plaque.style.cssText =
        `position:absolute;left:${x}px;top:${HEADER_H + 8}px;width:${STUB_W - 30}px;` +
        'border:1px dashed #3b4f5c;border-radius:calc(var(--u) * 6);padding:calc(var(--u) * 12);' +
        'color:#5f7784;font-size:calc(var(--u) * 12);line-height:1.5;';
      plaque.innerHTML =
        `<div style="color:#8fa8b5;font-weight:bold;">🔒 ${i < 2 ? `T${7 + i}` : 'Epilogue'} · ${s.name}</div>` +
        `<div style="margin-top:calc(var(--u) * 6);font-style:italic;">${s.note}</div>`;
      world.appendChild(plaque);
    });
  }

  // ------------------------------------------------------------- interaction

  private devComplete(n: TechNode): void {
    if (this.state.isResearched(n.id)) return;
    const before = this.state.currentTier();
    const added = this.state.completeAsPlayed(n.id);
    const after = this.state.currentTier();
    if (added.length > 1) {
      this.onMessage?.(`🌳 ${n.name} researched (dev) — ${added.length - 1} prerequisite techs came with it.`);
    } else {
      this.onMessage?.(`🌳 ${n.name} researched (dev).`);
    }
    this.refresh();
    if (after > before) {
      if (after <= 6) {
        this.onMessage?.(`⭐ A new age dawns: ${TIER_NAMES[after]}`);
        this.onEraAdvance?.(after, TIER_NAMES[after]);
      } else {
        this.onMessage?.('⭐ The settlement tree is complete. What comes next is a different game — T7 awaits.');
      }
    }
  }

  private showCard(n: TechNode, el: HTMLDivElement): void {
    const done = this.state.isResearched(n.id);
    const tier = this.state.currentTier();
    const status = done
      ? '<span style="color:#8fd08f">✓ researched</span>'
      : n.tier > tier
        ? `<span style="color:#c98f8f">🔒 locked — the ${TIER_NAMES[n.tier]} era is not yet reached</span>`
        : this.state.prereqsMet(n.id)
          ? '<span style="color:#d8b872">available</span>'
          : '<span style="color:#c9b48f">needs its prerequisites</span>';
    const prereqs = n.prereqs.length
      ? n.prereqs
          .map((p) => {
            const pn = techNodeById.get(p)!;
            return `${this.state.isResearched(p) ? '✓' : '·'} ${pn.icon} ${pn.name}`;
          })
          .join('<br>')
      : '—';
    this.card.innerHTML = `
      <div style="display:flex;align-items:center;gap:calc(var(--u) * 8);">
        <span style="font-size:calc(var(--u) * 34);">${n.icon}</span>
        <div>
          <div style="font-weight:bold;font-size:calc(var(--u) * 13);">${n.star ? '⭐ ' : ''}${n.name}</div>
          <div style="color:#9fb8c6;">T${n.tier} · ${TIER_NAMES[n.tier]} · ${BRANCH_LABELS[n.branch]}</div>
        </div>
      </div>
      <hr style="border:none;border-top:1px solid #2c3a42;margin:calc(var(--u) * 7) 0;">
      <div>📖 <strong>${n.kp}</strong> knowledge · ${status}</div>
      <div style="margin-top:calc(var(--u) * 6);">${n.effect}</div>
      <div style="margin-top:calc(var(--u) * 6);font-style:italic;color:#b09055;">${n.flavor}</div>
      <hr style="border:none;border-top:1px solid #2c3a42;margin:calc(var(--u) * 7) 0;">
      <div style="color:#9fb8c6;">Requires:<br>${prereqs}</div>`;
    const r = el.getBoundingClientRect();
    this.card.style.display = 'block';
    const cw = this.card.offsetWidth;
    const ch = this.card.offsetHeight;
    let cx = r.right + 10;
    if (cx + cw > window.innerWidth - 8) cx = r.left - cw - 10;
    let cy = Math.min(r.top, window.innerHeight - ch - 8);
    if (cy < 8) cy = 8;
    this.card.style.left = `${Math.max(8, cx)}px`;
    this.card.style.top = `${cy}px`;
  }

  private applyTransform(): void {
    this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  /** Re-style every node and edge from the current research state. */
  refresh(): void {
    if (!this.overlay) return;
    const tier = this.state.currentTier();
    if (tier <= 6) {
      const p = this.state.tierProgress(tier);
      this.headerInfo.textContent =
        `Era T${tier} · ${TIER_NAMES[tier]} — ${p.done}/${p.total} researched, ` +
        `${p.total - p.done} to the next age`;
    } else {
      this.headerInfo.textContent = 'The settlement tree is complete — T7 is a different game.';
    }
    for (const n of TECH_NODES) {
      const el = this.nodeEls.get(n.id)!;
      const done = this.state.isResearched(n.id);
      const future = n.tier > tier;
      const ready = !done && !future && this.state.prereqsMet(n.id);
      el.style.opacity = future ? '0.38' : '1';
      el.style.background = done ? '#33290f' : ready ? '#16241d' : '#161d22';
      el.style.border = done
        ? '1px solid #b8944f'
        : ready
          ? '1px solid #4f8f5f'
          : '1px solid #2c3a42';
      el.style.color = done ? '#e8d5a2' : ready ? '#cfe8d5' : '#9fb8c6';
      el.style.boxShadow = ready ? '0 0 calc(var(--u) * 8) rgba(90, 180, 110, 0.25)' : 'none';
    }
    for (const e of this.edgeEls) {
      const litUp = this.state.isResearched(e.from) && this.state.isResearched(e.to);
      e.el.setAttribute('stroke', litUp ? '#b8944f' : '#2c3a42');
      e.el.setAttribute('stroke-width', litUp ? '2.5' : '2');
    }
  }
}
