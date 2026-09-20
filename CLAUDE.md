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
npm run verify        # typecheck + map and energy property checks — run this before claiming anything works
npm run typecheck     # tsc --noEmit on its own
npm run verify:map    # sector generation properties, 2000 maps (pass a count: ... verify:map 5000)
npm run verify:energy # reactor properties: legal allocations, moves, and junk saves
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

### The reactor is a set of trade-offs, not a set of sliders

`lib/energy.ts` holds a pool of reactor energy and three subsystems — shields,
weapons, engines — that hold four bars each. Twelve bars of capacity against a
reactor of four to seven means **no ship can power everything**, so every bar is
somewhere it is not somewhere else. `npm run verify:energy` fails if a ship's
reactor ever creeps up to `TOTAL_CAPACITY`.

**Two levels are read so far, both on the engines and the shields.**
`jumpBlocker(run)` (`lib/runStore.ts`) returns `'fuel'`, `'held'`, `'engines'`
or null, and both the helm and the sector map ask it rather than each deciding
for itself, so the button that offers a jump and the button that performs it
can never disagree. `applyJump` refuses a blocked jump and hands the run
straight back, the same way `shiftEnergy` refuses an illegal move. Weapons
still does nothing — there is nothing to shoot.

**Arriving on a hostile star pins the ship there.** The hold is stored as
`detain`, in *units of work* rather than seconds, and the engines burn through
it at `escapeRate(engines) = engines ** 0.35`. One bar clears the 40 units in
40 seconds; four clears it in about 25, and each extra bar buys less than the
one before it, so power helps without making escape cheap. **No bars means no
rate**, which pauses the hold rather than ending it — and because the rate is
read continuously, changing the allocation mid-hold changes the countdown.
`verify:energy` holds the shape of that curve: monotonic, diminishing, and
never below half the base time at full power.

**The shields row is a ceiling, not a switch.** Three bars means the shield can
reach level three and no further. `shieldCharge` is where it actually is — a
float, because it has to creep toward the next level, but only whole levels
count: `shieldLevel()` floors it, and that is what the bubble and the LEVEL bar
are both drawn from, so they cannot disagree. Every level takes
`SHIELD_SECONDS_PER_LEVEL` (5s), first or last, and `verify:energy` walks each
one to hold that.

A hit (`damageShield`) takes a whole level and the part-charge with it: caught
at 2.9 the shield drops to 2, not 1.9, so being hit mid-regen costs the
progress too. Nothing shoots yet — the only thing that calls it is the
**DEV · HIT SHIELD** control opposite LEAVE on the helm, there so the bar and
the regen can be watched. Delete the control with the feature it was testing.

Pulling power is asymmetric on purpose: it drops the charge on the spot, in
`shiftEnergy`, because the energy holding it is simply gone. A new run launches
with its shields already up — the charge is for changes made in flight, not a
tax on launching.

The LEVEL bar sits under the shields row in the panel and lines up with it
through the shared `GLYPH_W` / `STEP_W` / `ROW_GAP` constants rather than by
eye. Squares past the ceiling are drawn as bare outlines; the one currently
charging fills across, so the five-second wait is visible instead of a number
that jumps.

**A break is felt as well as counted.** `ShieldBreak` plays a shimmer round the
rim when a layer goes and sends the shell out in wedges when the last one does.
Which plays is decided by the level *before* the hit against the level after,
and it fires on a change in `run.shieldHits` rather than on the level dropping
— pulling the power lowers the level too, and that must stay silent. Both
effects unmount when they finish, and neither is load-bearing: if they never
play, the bar and the bubble still tell the truth.

Two things there:

- **Rotate a circle, then squash it.** The shimmer travels the rim by rotating,
  but rotating an *ellipse* swings its long axis round and the highlight leaves
  the rim. So the comet is drawn on a circle of radius `SHIELD_RX`, rotated,
  and the parent view scales it by `SHIELD_RY / SHIELD_RX` — which traces the
  ellipse exactly. Both are plain view transforms, which behave the same
  everywhere; animated SVG attributes were avoided on purpose.
- **The shatter is one animated view, not ten.** Scaling the whole group about
  the shield's centre carries every wedge outward along its own radius, which
  is what a shell coming apart does anyway.

Both flashes start at full brightness and fade, rather than easing in. A hit
should land; it also means the effect is visible where frames are scarce
instead of being stuck at the transparent end of a fade-in.

Both clocks are advanced by `tickRun`, and **only the helm ticks** — it is the
only screen that sits still. It writes back when a clock finishes, every two
seconds along the way, and on leaving the screen, rather than four times a
second.

The gate cannot strand anyone: the smallest reactor is four bars, so a bar can
always be moved back into the engines, and `verify:energy` holds that every
ship's opening split already has the engines running.

There is no unlock trigger in the game yet, so the locked half of the roster is
otherwise unflyable. The title screen carries a quiet **DEV · UNLOCK ALL SHIPS**
button for that. It writes through the normal unlock store rather than holding a
flag of its own, so Reset Progress in Settings clears it like anything earned,
and the title screen re-reads the unlocks on focus so the label tells the truth
again afterwards.

Engines shipped as **piloting** first, and that name is still on disk in older
saves. `LEGACY_KEYS` in `lib/energy.ts` carries those bars over — dropping them
would have loaded a run that could not move. If a subsystem is ever renamed
again, it gets an entry there and a check in `verify:energy`.

The panel is on the helm only, where the ship is in front of you — the sector
map is for choosing where to go, and deliberately carries none of it. Because
the panel takes a fixed, known slice of the helm, the two pieces of ship art
there are scaled from the space left over rather than sized by hand; fixed
sizes dropped the Elder Shrike through the player's ship on a short phone.

Two of the three subsystems are drawn on the ship itself
(`components/ships/ShipSystems.tsx`): shields as a bubble that holds one size
and grows brighter with each bar, engines as an exhaust plume that lengthens
with each bar. Both are invisible at zero and use their subsystem's colour from
`SUBSYSTEM_STYLE`, so a cyan bubble is the shields row and an orange flame
is the engines row — and a ship with no flame is a ship that cannot jump. Each
bar does more to the exhaust than lengthen it: the plume widens, the plume and
its white core both brighten, the heat haze around it builds and the pulse
deepens, so four bars reads as hotter rather than merely longer. Weapons (bright
red) has no mark yet — there is nothing to shoot.

The panel's cells animate between unlit and their subsystem's colour, with a
kick and a white flash as the current lands, so a bar moving between two rows
reads as something travelling. **They also settle by timer.** Reanimated drives
them off `requestAnimationFrame` on web, and the panel reports an allocation the
player just changed, so a starved tab must not strand a cell showing the old
level — the same reason `FadeInView` exists. This was not theoretical: a
screenshot taken before the guard showed 2/2/2 while the save held 0/2/4.

The shield's fill is a radial gradient that is fully transparent inside
`SHIELD_CLEAR` and piles up on the rim. That number is measured, not chosen:
the furthest corner of any hull sits at about 0.80 of the bubble's radii, so
0.82 means the colour only starts once the ship has ended, and more power
brightens the edge instead of fogging the hull. The plating over it — dashed
shells and radial ribs — lives in that same outer band, and each element
carries its own opacity rather than sampling the gradient, because a gradient
in `objectBoundingBox` units is measured against *each element's own* box.
Checked by sampling the rendered pixels — inside the clear zone they match the
bare background exactly at every level, while the rim climbs with each bar.

Two things there are worth keeping:

- **The overlay boxes share the ship box's aspect ratio.** `ShipSystems` draws
  the shield and the exhaust in `viewBox`es that are the art's 200×260 grown
  about its centre by `SYSTEMS_SPAN`. Because the ratio is unchanged, both
  overlays letterbox exactly as `ShipArt` does, and a nozzle written as y=232
  lands on the engine bar with no arithmetic. Change the span and the ratio
  must hold, or every overlay slides out of register.
- **Nozzle positions are a table in `ShipArt.tsx`** (`ENGINES`), beside the
  paths they were read off, so moving a ship's tail moves the flame with it.
  Every hull's engines share one `y`, which is what lets the flame pulse from
  a single `transformOrigin` — including the Bulwark's pair.

Hull and speed used to sit beside cargo on the ship cards. They are gone —
cargo is the one stat that still varies without being energy. The cards also
carry an empty **WEAPON** hardpoint above cargo and the reactor; there is no
weapon table yet, so the slot reads EMPTY and holds the space.

`lib/energy.ts` imports nothing, for the same reason `sectorMap.ts` imports
nothing: pure rules run under bare node in the verify script. The labels and
tints live in `lib/subsystems.ts`, which is to it what `encounters.ts` is to
`sectorMap.ts`.

### Layer boundaries

`lib/theme.ts`, `lib/sectorMap.ts` and `lib/energy.ts` import nothing from the
project and are the leaves. `lib/ships.ts`, `lib/encounters.ts` and
`lib/subsystems.ts` depend on the theme; `lib/runStore.ts` depends on ships,
the map, the energy rules and `encounters.ts` — it reads the `hostile` flag out
of `ENCOUNTER_STYLE` rather than keeping its own list of which stars mean
trouble. Keep that direction — the theme
briefly imported a helper from `sectorMap` and it was the wrong way round.

Presentation belongs in a table, not in a screen. `ENCOUNTER_STYLE`
(`lib/encounters.ts`) holds each encounter's label, colour and size because those
three facts were previously spelled out separately in the map, the helm and the
ship art. `SUBSYSTEM_STYLE` (`lib/subsystems.ts`) does the same for the reactor
rows.

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
- **`Alert.alert` is an empty function on react-native-web.** Not a stub that
  logs — `class Alert { static alert() {} }`. Reset Progress used it to
  confirm, so on web the dialog never appeared and nothing was ever reset. It
  now confirms in the row itself (tap, then tap again), which works everywhere
  and looks like the rest of the app. Do not reach for a system dialog.
- **Progress is more than the run.** Reset Progress was disabled unless a run
  was in progress, which left earned ships unclearable on a fresh save — the
  dev unlock button made that reachable in one tap. It now enables on a run
  *or* any earned ship.
- **Two taps in one JavaScript turn are one tap.** Driving the panel from a
  script, `__step(...); __step(...)` back to back both act on the same render
  and only one bar moves — React has not re-rendered in between. A test that
  needs two presses has to space them out, or it will quietly assert the wrong
  state. This hid the paused-timer case on the first run.
- **A pulsing flame cannot be checked from a screenshot here.** The thruster
  animates with `withRepeat`, which needs `requestAnimationFrame`; headless
  throttles it, so a capture shows the flame at rest. That is the resting
  state, not a stalled one — layout and size grading are checkable, the pulse
  is not.
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
