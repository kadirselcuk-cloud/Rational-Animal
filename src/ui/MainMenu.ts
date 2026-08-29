/**
 * The main menu (Roadmap v2 Phase A, owner art delivered 2026-08-30).
 * Layout per owner: the surprised Aristo statue at the top — not knowing
 * what to do — with RATIONAL ANIMAL beneath him in all caps, flanked by
 * Greek columns (temple-front styling); one era artwork in each corner
 * (top-left cavemen hunting, top-right tribes hunting each other,
 * bottom-left Spanish vs Aztecs, bottom-right World War 1). Buttons:
 * New Game → the "Hello World!" chapter; Continue → newest save;
 * Load Game → slot list. Settings arrives later (decision 9).
 * One font everywhere: Inter (decision 18).
 */

import { SAVE_SLOTS, readSlot, requestLoad, slotSummary, type SaveSlot } from '../sim/save';

const GOLD = '#d8c79a';
const STONE = '#9a8f74';
const DIM = '#6e6753';

/** A small Doric column, drawn inline so it can flank the title. */
function columnSvg(height: number): string {
  return `
  <svg width="${Math.round(height * 0.34)}" height="${height}" viewBox="0 0 34 100" fill="none" style="opacity:0.85;">
    <rect x="1" y="0" width="32" height="5" fill="${STONE}"/>
    <path d="M3 5 L31 5 L28 12 L6 12 Z" fill="${DIM}"/>
    <rect x="7" y="12" width="20" height="74" fill="${STONE}"/>
    <line x1="11" y1="12" x2="11" y2="86" stroke="#7a7057" stroke-width="1.6"/>
    <line x1="15.5" y1="12" x2="15.5" y2="86" stroke="#7a7057" stroke-width="1.6"/>
    <line x1="20" y1="12" x2="20" y2="86" stroke="#7a7057" stroke-width="1.6"/>
    <line x1="24.5" y1="12" x2="24.5" y2="86" stroke="#7a7057" stroke-width="1.6"/>
    <path d="M6 86 L28 86 L31 92 L3 92 Z" fill="${DIM}"/>
    <rect x="1" y="92" width="32" height="8" fill="${STONE}"/>
  </svg>`;
}

export class MainMenu {
  /** New Game chosen — the caller closes into the chapter intro. */
  onNewGame: (() => void) | null = null;

  private overlay: HTMLDivElement | null = null;

  get visible(): boolean {
    return !!this.overlay;
  }

  show(): void {
    if (this.overlay) return;
    const base = import.meta.env.BASE_URL;
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:58;overflow:hidden;user-select:none;-webkit-user-select:none;' +
      'background:radial-gradient(120% 90% at 50% 30%, #16181d 0%, #0b0d10 55%, #060708 100%);' +
      'display:flex;align-items:center;justify-content:center;';
    this.overlay = overlay;

    // ---- the four era artworks, one per corner, fading toward the center.
    // Owner (2026-08-30): only the TOP corners carry artwork — the bottom two
    // are removed (their PNGs stay in public/menu for a possible return).
    const corners: { file: string; pos: string; obj: string }[] = [
      { file: 'top-left.png', pos: 'left:0;top:0;', obj: 'left top' },
      { file: 'top-right.png', pos: 'right:0;top:0;', obj: 'right top' },
    ];
    for (const c of corners) {
      const img = document.createElement('img');
      img.src = `${base}menu/${c.file}`;
      img.alt = '';
      img.draggable = false;
      // No fade masks (owner, 2026-08-30): the PNGs' own transparency carries
      // the blend into the background.
      img.style.cssText =
        `position:absolute;${c.pos}width:min(39vw, 56vh);height:min(50vh, 43vw);` +
        `object-fit:contain;object-position:${c.obj};pointer-events:none;`;
      overlay.appendChild(img);
    }

    // ---- center: Aristo, the temple title, the buttons.
    const center = document.createElement('div');
    center.style.cssText =
      'position:relative;display:flex;flex-direction:column;align-items:center;' +
      'gap:calc(var(--u) * 10);max-height:96vh;';

    const statue = document.createElement('img');
    statue.src = `${base}menu/aristo.png`;
    statue.alt = '';
    statue.draggable = false;
    statue.style.cssText =
      'height:min(30vh, 34vw);width:auto;object-fit:contain;' +
      'filter:drop-shadow(0 calc(var(--u) * 18) calc(var(--u) * 30) rgba(0,0,0,0.85));';

    // Temple front: columns flank the carved title over a stepped stylobate.
    const temple = document.createElement('div');
    temple.style.cssText = 'display:flex;align-items:flex-end;gap:calc(var(--u) * 22);';
    const colL = document.createElement('div');
    const colR = document.createElement('div');
    const colH = 58;
    colL.innerHTML = columnSvg(colH);
    colR.innerHTML = columnSvg(colH);
    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
    const architrave = document.createElement('div');
    architrave.style.cssText =
      `width:100%;height:calc(var(--u) * 3);background:linear-gradient(90deg, transparent, ${STONE}, transparent);` +
      'margin-bottom:calc(var(--u) * 10);';
    const title = document.createElement('div');
    title.textContent = 'RATIONAL ANIMAL';
    title.style.cssText =
      'font-weight:700;font-size:clamp(16px, 2.76vw, 35px);letter-spacing:0.32em;text-indent:0.32em;' +
      'text-align:center;white-space:nowrap;' +
      'background:linear-gradient(180deg, #efe6cc 0%, #cbbc95 45%, #8f8262 80%, #b0a37e 100%);' +
      '-webkit-background-clip:text;background-clip:text;color:transparent;' +
      'text-shadow:0 calc(var(--u) * 2) calc(var(--u) * 4) rgba(0,0,0,0.55);';
    // Stepped stylobate under the name — three narrowing stone lines.
    const steps = document.createElement('div');
    steps.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:calc(var(--u) * 3);' +
      'margin-top:calc(var(--u) * 10);width:100%;';
    for (const w of [100, 86, 72]) {
      const s = document.createElement('div');
      s.style.cssText = `width:${w}%;height:calc(var(--u) * 3);background:${STONE};opacity:${w === 100 ? 0.8 : w === 86 ? 0.55 : 0.35};`;
      steps.appendChild(s);
    }
    titleWrap.append(architrave, title, steps);
    temple.append(colL, titleWrap, colR);

    // ---- buttons
    const buttons = document.createElement('div');
    buttons.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:calc(var(--u) * 9);margin-top:calc(var(--u) * 8);';
    const mkBtn = (label: string, enabled = true) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.disabled = !enabled;
      b.style.cssText =
        'font-family:inherit;font-weight:600;font-size:calc(var(--u) * 14);letter-spacing:0.22em;text-indent:0.22em;' +
        `color:${enabled ? GOLD : '#57503d'};cursor:${enabled ? 'pointer' : 'default'};` +
        'width:calc(var(--u) * 250);padding:calc(var(--u) * 9) 0;' +
        'background:linear-gradient(180deg, #23262b, #131519);' +
        `border:1px solid ${enabled ? '#8a7a55' : '#3a3527'};border-radius:calc(var(--u) * 3);` +
        'box-shadow:inset 0 0 calc(var(--u) * 8) rgba(216, 199, 154, 0.12);transition:box-shadow 0.2s, color 0.2s;';
      if (enabled) {
        b.addEventListener('mouseenter', () => {
          b.style.color = '#f2e6c4';
          b.style.boxShadow =
            'inset 0 0 calc(var(--u) * 14) rgba(216, 199, 154, 0.3), 0 0 calc(var(--u) * 12) rgba(216, 199, 154, 0.2)';
        });
        b.addEventListener('mouseleave', () => {
          b.style.color = GOLD;
          b.style.boxShadow = 'inset 0 0 calc(var(--u) * 8) rgba(216, 199, 154, 0.12)';
        });
      }
      return b;
    };

    const saves = SAVE_SLOTS
      .map((slot) => ({ slot, data: readSlot(slot) }))
      .filter((s) => s.data)
      .sort((a, b) => (b.data!.savedAt ?? 0) - (a.data!.savedAt ?? 0));

    const newBtn = mkBtn('NEW GAME');
    newBtn.addEventListener('click', () => {
      this.close();
      this.onNewGame?.();
    });
    const contBtn = mkBtn('CONTINUE', saves.length > 0);
    if (saves.length > 0) {
      contBtn.dataset.tip = slotSummary(saves[0].slot) ?? '';
      contBtn.addEventListener('click', () => requestLoad(saves[0].data!));
    }
    const loadBtn = mkBtn('LOAD GAME', saves.length > 0);

    // Load list: replaces the buttons until Back.
    const slotList = document.createElement('div');
    slotList.style.cssText =
      'display:none;flex-direction:column;align-items:center;gap:calc(var(--u) * 8);margin-top:calc(var(--u) * 8);';
    const slotName = (s: SaveSlot) => (s === 'auto' ? 'Autosave' : `Slot ${s}`);
    for (const s of saves) {
      const b = mkBtn('');
      b.style.width = 'calc(var(--u) * 330)';
      b.style.letterSpacing = '0.04em';
      b.style.textIndent = '0';
      b.textContent = `${slotName(s.slot)} — ${slotSummary(s.slot)}`;
      b.addEventListener('click', () => requestLoad(s.data!));
      slotList.appendChild(b);
    }
    const backBtn = mkBtn('BACK');
    backBtn.addEventListener('click', () => {
      slotList.style.display = 'none';
      buttons.style.display = 'flex';
    });
    slotList.appendChild(backBtn);
    loadBtn.addEventListener('click', () => {
      buttons.style.display = 'none';
      slotList.style.display = 'flex';
    });

    buttons.append(newBtn, contBtn, loadBtn);
    center.append(statue, temple, buttons, slotList);
    overlay.appendChild(center);
    document.body.appendChild(overlay);
  }

  close(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
