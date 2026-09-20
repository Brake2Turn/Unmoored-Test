# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Unmoored is a space roguelike for iOS, built with Expo (React Native) and TypeScript.
It is pre-release: there is no combat, no run-end state, and no unlock trigger yet.

The author develops on **Windows and has no Mac**, which is why the project is Expo
rather than native Swift — Expo builds the iOS binary on hosted machines
(`eas build`), so nothing in the workflow requires Apple hardware.

## Commands

```bash
npm install
npm run verify        # typecheck + map property checks — run this before claiming anything works
npm run typecheck     # tsc --noEmit on its own
npm run verify:map    # sector generation properties, 2000 maps (pass a count: ... verify:map 5000)
npm run build:web     # full production web bundle into dist/ — catches what tsc cannot
npm run web           # dev server at localhost:8081
```

There is no test runner and no linter. `npm run verify` is the whole automated
safety net, and it is cheap — prefer it over screenshots for anything
non-visual.

### Running it in this container

`npm install` works. `npx expo start` does **not**: the CLI crashes trying to
reach Expo's API through the agent proxy (`Unexpected token 'H', "Host not i"`),
and `EXPO_OFFLINE` does not prevent it. Use `npm run build:web` and serve
`dist/` statically instead:

```bash
npm run build:web
cd dist && python3 -m http.server 8099 --bind 127.0.0.1
# then drive it with the pre-installed Chromium:
/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
  --headless --no-sandbox --proxy-server='direct://' --proxy-bypass-list='*' \
  --virtual-time-budget=9000 --window-size=390,844 \
  --screenshot=out.png "http://127.0.0.1:8099/"
```

**Headless throttles requestAnimationFrame to about 1fps.** Reanimated
animations therefore do not advance, and a screenshot can show a pre-animation
state that is not a real bug. Verify layout and content this way; never
conclude anything about motion from it.

## Architecture

### The run is the state

`lib/runStore.ts` owns everything about a run. `loadRun()` is the **only** way to
get one: it reads AsyncStorage once, migrates whatever shape it finds, writes
the migrated shape back, and caches it in memory. That is why `RunState` has no
optional gameplay fields and why screens read `run.fuel` without `??` guards.

Consequences worth preserving:

- **Migration is private.** `hydrate()` is not exported. If a new field is added,
  it gets a clause there — and because `RunState` is fully required, the compiler
  will point at it.
- **Rules live in the store, not in screens.** `applyJump()` spends the fuel and
  records the hop. A press handler should call it, not reimplement it.
- **Derived values are derived.** `sectorOf(run)` is `jumps + 1`; the sector
  number is never stored. Anything computable from another field should follow
  that pattern rather than becoming a second source of truth.

### Sector generation is guaranteed, not sampled

`lib/sectorMap.ts` rolls a fresh map per run in a fixed 100×160 logical box, so a
jump in range on one phone is in range on every phone.

Twenty stars sit in seven bands (1, 3, 4, 4, 4, 3, 1). Any star that lands out of
reach of every star in the band below is **nudged sideways until it is
reachable** — so a route from bottom to top exists by construction, rather than
by rejecting and regenerating maps. Band spacing (22.7) exceeds half the jump
range (34), so a jump can never skip a band, which makes the boss always exactly
six jumps away.

Constants were fitted by measurement, not taste. Changing `JUMP_RANGE`,
`NODE_COUNT`, `FUEL_COVERAGE` or the band shape invalidates that fitting — rerun
`npm run verify:map` with a large count and check nothing became unwinnable.

Encounters split the 18 stars that are neither the start nor the boss into three
exact sixes. **The map does not reveal them**: every star is a plain dot, and
what is waiting is only learned by jumping there, where the ship appears at the
helm. The boss is the single exception, red from the start.

### Layer boundaries

`lib/theme.ts` and `lib/sectorMap.ts` import nothing from the project and are the
leaves. `lib/ships.ts` and `lib/encounters.ts` depend on the theme;
`lib/runStore.ts` depends on ships and the map. Keep that direction — the theme
briefly imported a helper from `sectorMap` and it was the wrong way round.

Presentation belongs in a table, not in a screen. `ENCOUNTER_STYLE`
(`lib/encounters.ts`) holds each encounter's label, colour and size because those
three facts were previously spelled out separately in the map, the helm and the
ship art.

## Platform traps already paid for

These cost real debugging time. Do not rediscover them.

- **`query-string` is an explicit dependency.** `expo-router` requires it at
  runtime without declaring it, and `@react-navigation/native` v7 no longer
  supplies it. Without it the web bundle fails to resolve and nothing builds.
- **Dependency versions must match the SDK.** They are pinned to
  `node_modules/expo/bundledNativeModules.json`. Four hand-written pins were
  wrong and the build was broken until they were aligned. `npx expo install --fix`
  does this online; the same file can be diffed offline.
- **Reanimated's `entering` prop does not run on React Native Web** for a view
  mounted after navigation — it stays at opacity 0 permanently. Use
  `components/FadeInView.tsx`, which fades but also switches to plain opacity 1
  once the fade should have ended. **Content must never be hostage to an
  animation finishing.**
- **`adjustsFontSizeToFit` is native-only.** On web it ellipsises instead, so web
  relies on `titleSizeFor()` sizing correctly.
- **Tracked capitals are much wider than they look.** The wordmark's advance
  ratio is ~0.83 for the web fallback, not the ~0.62 a mixed-case guess suggests;
  guessing clipped UNMOORED to "NMOORE". Measure in a browser before sizing
  tracked display text.

## Working style that fits this project

The author is not a programmer and tests by playing. Explanations should be
plain; jargon needs unpacking.

Prefer `npm run verify` and `npm run build:web` over screenshots — they are
orders of magnitude cheaper and catch more. Take one screenshot at the end of a
visual change, not one per attempt.

There is a published artifact of the compiled web build so the app can be played
in chat. It is the real bundle, not a mock-up. An earlier hand-written HTML
replica was retired precisely because keeping a parallel copy in sync doubled the
cost of every feature and hid three real bugs.
