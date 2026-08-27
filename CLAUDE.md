# Project: Strategy Survival Browser Game (three.js)

**Status: design phase — NO CODE YET.** Do not start implementation until the owner approves the roadmap.

On session start, read these in order to restore full context:
1. `docs/GAME_VISION.md` — the owner's recorded instructions (source of truth)
2. `docs/CONVERSATION_LOG.md` — what happened in each session, current state, next steps
3. `docs/OPEN_QUESTIONS.md` — pending decisions and recorded answers
4. `docs/RESOURCES.md` and `docs/BUILDINGS.md` — draft catalogs pending owner review
5. `docs/ROADMAP.md` — draft phase plan (Phases 0–8) pending owner approval
6. `docs/VISUAL_STYLE_GUIDE.md` — **MANDATORY before creating/changing any building or visual element** (owner's graphics rules: materials, layouts, yards, roofs, placement, verification workflow)

## Working rules (owner's standing instructions)
- **Always start the game on a localhost dev server** (`npm run dev`, background) at the end of every working session so the owner can test immediately. Report the URL.
- The game's dedicated port is **5180** (http://localhost:5180) — pinned with `strictPort` in `vite.config.ts` because 5173 is used by another app on the owner's machine. Don't change it.
- Record all owner instructions in `docs/*.md` before acting on them.
- Build the roadmap **together** with the owner; ask questions when info is missing.
- Update `docs/CONVERSATION_LOG.md` at the end of every working session (what was decided, what's next).
- 3D assets: buildings & roads use the Kenney Fantasy Town Kit (CC0, `public/models/fantasy-town/`, loaded via `src/render/kit.ts`); everything else is built by Claude in code — low-poly, small, semi-realistic. No extreme graphics. Note: the kit's GLBs reference the external `Textures/colormap.png`, so that folder must stay next to them.
- **Tone of ALL player-facing text** (intros, building/tech descriptions, events, UI flavor): humorous / black-humorous, almost insulting to the player — but the aim is a philosophical mirror, not the insult: facing ancestral instincts should make the player feel they drift from humanity's virtues toward the animal. Voice reference: the T0 "Hello World!" intro in `docs/SKILL_TREE.md`. Full rule in `docs/GAME_VISION.md` §Tone & Writing.
- **Research-game conversion (2026-08-25): planned but FROZEN** — `docs/SKILL_TREE.md` is the approved foundation for a future tech tree ("Hello World!" T0 → T6). Do NOT implement any of it until the owner explicitly says it is OK to go.
