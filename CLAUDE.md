# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Unmoored is a space roguelike for iOS, built with Expo (React Native) and TypeScript.
It is pre-release: there is no combat, no run-end state, and no unlock trigger yet.

The author develops on **Windows and has no Mac**, which is why the project is Expo
rather than native Swift — Expo builds the iOS binary on hosted machines
(`eas build`), so nothing in the workflow requires Apple hardware.

## Where the work goes

**Develop and push on `claude/claude-md-unmoored-info-aliq46`.** Not on the
default branch, and not on a new branch per feature — the author follows this
one.

**Then fast-forward `main` to it and push that too.** A new session clones the
repo and checks out `main`, so anything left only on the branch is invisible to
the next chat — including this file. That is not hypothetical: sixteen commits
and the whole of `CLAUDE.md` once sat on the branch alone, and a fresh session
opened on a build from before the reactor existed with no notes to tell it
otherwise. The branch never diverges from `main` in practice, so this is a
`git merge --ff-only` with nothing to resolve. Do it at the end of a piece of
work, the same way the artifact gets republished.

**The live build is one artifact, updated in place:**
<https://claude.ai/artifact/DUdeLS4PCiguJTRHJw2YuZ>. That link is what the
author opens to play, so it has to keep working — publishing a *new* artifact
strands them on an old build. Read the artifact first, then republish to the
same URL.

It is not `dist/` verbatim. The page is a small hand-written wrapper around
Expo's output, and the two things it does are both load-bearing:

- **The bundle is published as `bundle/entry.js`**, because published paths are
  relative and Expo's `index.html` points at an absolute `/_expo/...` that does
  not exist on the artifact host.
- **The page rewrites `location.pathname` to `/` before injecting the script.**
  `expo-router` picks its route from the path, and the artifact is not served at
  a site root, so without the rewrite it boots on a path matching no route and
  renders "Unmatched Route" — but the rewrite also moves what relative paths
  resolve against, which is why the bundle URL is resolved and a `<base>` pinned
  *first*. Get that order wrong and the page sits on LOADING forever, silently.

Rebuild, swap in the new `bundle/entry.js`, republish. The page itself rarely
changes — and note that the artifact service wraps whatever is published in its
own `<html><head>…<body>`, so publish the page's *contents* (starting at
`<title>`) rather than a full document, or the result is one page nested inside
another.

**The artifact is shared between sessions, and the last publish wins.** More
than one chat can be open on this project at once, and they all push to that one
URL. A session that publishes a build made from a stale checkout silently
replaces the author's working game with a partial one — this happened: a session
working from an old `main` published a pre-reactor build over the top, and the
reactor, hull, shields, cargo and crew all disappeared from the link while still
being perfectly present in the repo.

So, before publishing, every time:

1. `git fetch origin main` and confirm the checkout is not behind it. If it is,
   the build would be a regression — bring `main` in first.
2. `npm run build:web`, and publish *that* bundle.
3. **Verify what is actually being served afterwards.** The publish call
   reporting success only means the call succeeded; it says nothing about
   whether another session has since overwritten it. Read the artifact's
   `bundle/entry.js` back and check its checksum against the local build, or
   grep it for a string from the newest feature (`Open the hold`, and so on).
   A size that is *smaller* than the previous version is the tell — the bundle
   only grows.

Never tell the author the live game is up to date without having done step 3.

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

**To land on a screen other than the title, seed a save and drive the UI.**
Write a scratch page into `dist/` that sets the run in `localStorage` before the
bundle loads, then clicks its way in by `aria-label`. Two details make it work:

```js
// Read the query string BEFORE the rewrite, which wipes it.
var Q = new URLSearchParams(location.search);
history.replaceState(null, '', '/');          // or expo-router 404s the page
localStorage.setItem('unmoored.currentRun', JSON.stringify({ id: 'probe', shipId: 'bulwark' }));
```

`hydrate()` fills in everything else, so an `id` and a `shipId` are a whole
run — no need to hand-roll a map. Then click `Continue`, space the later steps
out on `setTimeout` (see the two-taps trap below), and read the result back
either by collecting `aria-label`s into `document.title` with `--dump-dom`, or
by screenshotting. Every control on the helm carries a label that states its
numbers, so the DOM dump is usually enough and costs no image.

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
helm. The boss is the single exception, red from the start — red and nothing
else, with no ring or halo around it.

### Every encounter speaks, and the table is the author's

`lib/dialogue.ts` holds `MEETINGS`: who is out at a star, which of the two
hulls they arrive in, and what is said. **It is provisional** — transcribed
from the author's spreadsheet to get dialogue working end to end, and expected
to be rewritten, added to and cut down. So nothing anywhere counts the rows,
names an id, or hard-codes how many of each kind there are. Editing that list
is the whole job.

Three things follow from treating it that way:

- **The sector deals whatever it finds.** `assignMeetings` empties a third of
  the free stars and deals the rest from the table, using every encounter
  before repeating any of it. Written against `MEETINGS.length`: fewer
  encounters than slots and each is dealt more than once; more, and each
  sector shows a different subset. A player crosses six or seven stars, and
  drawing each independently would sometimes hand them the same pirate three
  times while the merchant never appeared.
- **`verify:map` checks the deal against the table's own length**, not against
  a number — "a third empty", "every encounter dealt before any repeats", "no
  meeting the table does not carry". Add an eleventh encounter and they still
  hold with nobody remembering to come back here.
- **A star holds an id, not a copy.** Rewrite a line and a run already in
  progress says the new one. Delete an entry and `meetingAt` returns null for
  the stars holding it, which quietly empties them rather than crashing — that
  case is the point, not an edge.

`Encounter` (empty / enemy / merchant / boss) is now **derived** from the
meeting rather than stored beside it: a red hull means combat, a yellow one a
trader or a conversation. That is what keeps the ship on screen and the words
in the box from ever disagreeing, and it means `hostile` — the long jump
charge — still comes off `ENCOUNTER_STYLE` exactly as before. Combat is the
only kind that pins you down.

**An encounter speaks once per run**, on arrival. `run.spoken` records *which*
stars have spoken, by node index, so backing out to the map and returning
finds the ship already there and says nothing. A save from before dialogue
counts its visited stars as already spoken — otherwise loading an old run
would open with a conversation from a merchant long since passed.

The overlay (`components/DialogueOverlay.tsx`) is the whole screen: a pale
wash, a box above the helm's controls, and a tap anywhere to advance. **Which
side the face sits on says who is speaking** before a word is read — the other
party left, the player's pilot right — and that is decided by `faceFor`, which
recognises the player by speaker name rather than by position, so an encounter
that opens with the pilot (number 9 does) still lands the right face on the
right side.

The faces (`components/PortraitArt.tsx`) are **placeholders**: a head and one
distinguishing mark each, drawn from the same few parts, square for a machine
and round for a person. They exist so two speakers can be told apart, not as
art. Adding an entity to the table adds it to `EntityId`, and the compiler
points at the face table until it has one.

**The map is an instrument, not a window.** The title screen and the helm look
*out* — gradient sky, nebulae, a drifting `StarField`. The sector map does not:
it is a chart on a piloting console (`components/StarChart.tsx`), with a lit
display a shade off the housing, the sector's own graticule, graduations down
two edges, a bezel with corner brackets and a vignette curving the glass. The
`StarField` is gone from this screen entirely, because the same stars drifting
behind a chart of stars read as two of the same thing.

The graticule is generated from the board's `offsetX` / `offsetY` / `scale` —
the very numbers the nodes are placed with — so a heavy line is a round number
of *map* units rather than of pixels, and the grid cannot drift out of register
with what sits on it. The chart renders as bare SVG elements into the board's
own `<Svg>` for that reason: a separate layer behind it would mean two
transforms to keep in step, and they would part company the first time the
board was resized.

Nothing on it moves. A radar sweep would say "console" louder than any of it,
but motion cannot be checked in this container at all, and a scanner that
silently sat still would be worse than one that was never there.

A ring means **the ship has stood there**. It is drawn off the visited set
rather than off the star's `kind`, so a star already walked keeps its ring while
it is in range, chosen, or under the ship — which is the whole point of it.

### The reactor is a set of trade-offs, not a set of sliders

`lib/energy.ts` holds a pool of reactor energy and three subsystems — shields,
weapons, engines — that hold four bars each. Twelve bars of capacity against a
reactor of four to seven means **no ship can power everything**, so every bar is
somewhere it is not somewhere else. `npm run verify:energy` fails if a ship's
reactor ever creeps up to `TOTAL_CAPACITY`.

**Two levels are read so far, both on the engines and the shields.**
`jumpBlocker(run)` (`lib/runStore.ts`) returns `'fuel'`, `'engines'`,
`'charging'` or null — in that order, because an empty tank is the harder stop
and cold engines are not building a charge at all — and both the helm and the
sector map ask it rather than each deciding
for itself, so the button that offers a jump and the button that performs it
can never disagree. `applyJump` refuses a blocked jump and hands the run
straight back, the same way `shiftEnergy` refuses an illegal move. Weapons
still does nothing — there is nothing to shoot.

**Systems charge, and one curve drives all of them.** Charge is counted in
*units of work* rather than seconds, and a subsystem builds it at
`chargeRate(bars) = bars ** 0.35`. One bar does a unit a second; four bars is a
little over one and a half times that, and each extra bar buys less than the
one before, so power helps without making anything cheap. **No bars means no
rate at all** — a system with nothing in it sits still rather than creeping.
Because the rate is read continuously, moving energy mid-charge changes the
fill under the player's hands.

Two charges run today, both shown as sliders under the row that drives them in
the expanded controls, and neither carries a number — the bar is the readout.

- **The drive** (`jumpCharge`) has to build before the ship can leave a star,
  and `applyJump` empties it on arrival. `jumpUnitsFor(run)` is derived from
  where the ship is standing rather than stored: an ordinary star costs
  `JUMP_UNITS` (14, about 11s at two bars), a hostile one `HOSTILE_JUMP_UNITS`
  (40, about 31s). That is what being pinned down by a Shrike now amounts to —
  a far longer build, not a separate timer with its own rules.
- **The weapons** (`weaponCharge`) build the same way and reset the same way.
  Nothing reads the result; there is still nothing to shoot.

The jump button says nothing about any of this. While the drive builds it is
simply closed, because the slider is the readout — a countdown printed over the
button was the thing that replaced. Cold engines keep their own words, since
that is a different problem and an unexplained still slider would be worse.

`verify:energy` holds the shape of the curve (monotonic, diminishing, never
below half the base time at full power), that a hostile star costs at least
twice an ordinary one, and that an ordinary hop is never a long wait.

**The shields row is a ceiling, not a switch.** Three bars means the shield can
reach level three and no further. `shieldCharge` is where it actually is — a
float, because it has to creep toward the next level, but only whole levels
count: `shieldLevel()` floors it, and that is what the bubble and the LEVEL bar
are both drawn from, so they cannot disagree. Every level takes
`SHIELD_SECONDS_PER_LEVEL` (5s), first or last, and `verify:energy` walks each
one to hold that.

A hit (`damageShield`) takes a whole level and the part-charge with it: caught
at 2.9 the shield drops to 2, not 1.9, so being hit mid-regen costs the
progress too.

**`takeHit` is the one rule for what a hit costs.** Shields soak it while any
are standing, and only once they are down does the hull start losing plates —
which is the whole reason to spend energy on shields. Whatever starts shooting
later calls this rather than inventing its own order. Nothing shoots yet, so
its only caller is the **DEV · TAKE A HIT** control opposite LEAVE on the helm,
there so the shield, its effects and the hull can be watched. Delete the
control with the feature it was testing.

### The hull is not part of the reactor

`lib/hull.ts` is a third pure leaf: `HULL_MAX` plates (8), `damagedHull` takes
one, and nothing puts any back. It is drawn as a plain white line with HULL
on the left, sharing a row with the fuel badge and **outside the reactor's card
entirely.** The reactor is a set of choices, rows the player moves energy
between; the hull is not one of those, and giving it the card and the cell
treatment would have filed it as another thing to fiddle with.

`verify:energy` walks the hull all the way down and holds that it takes exactly
`HULL_MAX` hits and stays there.

Pulling power is asymmetric on purpose: it drops the charge on the spot, in
`shiftEnergy`, because the energy holding it is simply gone. A new run launches
with its shields already up — the charge is for changes made in flight, not a
tax on launching.

The shield's four squares sit under its row in the expanded controls and line
up with the cells above through the shared `GLYPH_W` / `STEP_W` / `ROW_GAP`
constants rather than by eye. Squares past the ceiling are drawn as bare
outlines; the one currently charging fills across, so the five-second wait is
visible instead of a number that jumps.

**A break is felt as well as counted.** `ShieldBreak` runs a blade of light
across the whole face when a layer goes, and tears the field apart when the
last one does. Which plays is decided by the level *before* the hit against the
level after, and it fires on a change in `run.shieldHits` rather than on the
level dropping — pulling the power lowers the level too, and that must stay
silent. Each effect is keyed on the hit that caused it, so a second hit
restarts it cleanly. Neither is load-bearing: if they never play, the bar and
the bubble still tell the truth.

The wash is four broad translucent sheens, each wider, dimmer and later than
the one in front, with five-stop gradients so none of them has a visible edge.
It was one bright blade first and read as a hard line rather than a shimmer.

The one piece of real maths is **the sweep needs no clipping**. A vertical
chord of an ellipse at horizontal position `x` (in units of `SHIELD_RX`) has
half-height `SHIELD_RY * sqrt(1 - x²)`, so scaling a sheen by exactly that
factor traces the inside of the envelope precisely, edge to edge, while a plain
`translateX` carries it across. Both come off one progress value, and both are
plain view transforms — as is everything in these effects. **Animated SVG
attributes are avoided on purpose:** view transforms behave identically on both
platforms, and since motion cannot be checked here at all (below), the parts
that cannot be verified are kept to the ones least able to surprise.

The failure is three layers on one clock: a white-out that is gone almost
before it registers, two shock fronts at different speeds, and three dozen
slivers thrown out of the whole face. The debris implodes for four hundredths
of a second before it flies — that snap is what makes it read as violent rather
than as an expansion. Scaling the group about the centre throws each sliver out
along its own radius, so the whole spray costs one animated view.

Every effect's first frame is already visible — full brightness, fading from
there, rather than easing in. A hit should land, and it also means something
shows even where frames are scarce.

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

### The HUD shows, and only expands when asked

The reactor is on the helm only — the sector map is for choosing where to go
and deliberately carries none of it — and it has two states
(`components/ReactorPanel.tsx`).

**Collapsed** it is a thumb-sized tab, the left of three across the bottom of
the helm. Every tab opens with its own mark and its name on one line
(`components/PanelChrome.tsx`, shared by all three, along with the header the
opened panel carries and the `CARD` both are drawn on — a tab and its panel
have to look like one section, which is easier to keep true with the two
headers side by side). The reactor's mark is a power station, *not* the bolt: the bolt
means unclaimed power and sits inside the same tab beside a number, so the
section and one reading within it would otherwise be the same glyph. Below the
header each subsystem row is
two things stacked — its icon and pips for what is *in* it, and a hairline
track for how far what it is building has got — then a bolt and the power
nothing has claimed. The charge is the half that changes second to second, so
leaving it out meant opening the controls just to see whether the drive was
nearly there. The shield's track is measured against the ceiling it is powered
for, not against four: the pips beside it already say how high that cap is.

**Expanded** — tap the tab — the controls open *over* the helm, on a scrim that
dims it and catches the tap that closes them. They are an overlay rather than a
row in the layout, which is the whole point: the helm is sized for the tab, so
the room the controls need is only taken while energy is actually being moved.
The panel used to hold a third of the screen permanently for controls that go
untouched most of the time.

**The hold and the berths sit beside it** (`components/HoldPanels.tsx`), in
exactly the same two states, and the three tabs divide the chrome's width
evenly with the jump button full-width beneath them. Every tab is
`layout.tabHeight` tall and everything they open is `layout.panelWidth` wide,
both shared through the theme rather than repeated per component, so the tabs
sit as one row and the panels swap without the card shifting under the thumb.
Only ever one is open: the helm holds `open: 'reactor' | 'cargo' | 'crew' |
null`, not a flag each, so two panels cannot stack.

Cargo space is drawn as slots, and how many is `cargoSlots(ship.cargo)`
(`lib/hold.ts`) — the cargo stat is a 0–1 impression rather than a count, so it
is scaled to at most `CARGO_SLOTS_MAX` (8) and never rounds down to none.
Berths are a flat `CREW_SLOTS` (3); ships do not differ on crew yet. **Neither
holds anything.** There is no trade and no crew roster, so every slot is drawn
empty — but `filled` is threaded through every one of these components, and a
filled slot is already white, so the thing to change when cargo or crew arrives
is what the helm passes, not what the panels do. `verify:energy` holds that
every ship's hold has room in it and that none overflows the panel.

**No words inside the reactor.** Not SHIELDS, WEAPONS, ENGINES, LEVEL, CHARGE
or DRIVE, in either state. The icons carry it, and they are shared between the
two states (`components/SubsystemGlyph.tsx`) precisely so that what the player
learns from the controls reads the tab afterwards. Free power is a bolt and a
number, not `0 FREE`.

**Unclaimed power is yellow** (`palette.power`), not the accent. It was cyan,
which is the shields row directly above it and every other live reading in the
app, so the one figure meaning "not in anything yet" looked like a fourth
system reporting in. In the opened controls it sits at the *foot* of the three
rows rather than above them: at the top it read as a heading, as though it were
the reactor's size rather than its remainder, and at the bottom the bolt falls
in the same column as the subsystem marks, so spare and spent line up.

**An opened panel repeats its tab's name.** The panel covers the helm on a
scrim, so the tab that was tapped is dimmed behind it and cannot be what says
which section this is.

**The three sections do carry their names**, on the tab header line: REACTOR,
CARGO, CREW. That is not the same rule bending. A subsystem is met in the
controls, where there is room to learn what its mark means; a tab is the first
thing tapped and nothing teaches it beforehand. Every mark in the set is an
outline, including the bolt — it was the one filled glyph, which gave a
footnote about spare power more weight than the rows above it.

The hull is one white line above the controls (`components/StatusBar.tsx`),
the full width of the chrome. **Fuel rides on the jump button** — `MenuButton`
takes a `gauge` of `{ label, value }` and gives it a section of its own at the
right end, the full height of the button and divided off by a rule — because
the only question fuel answers is whether to jump, and a strip of its own was a
row spent on a number consulted at one moment. The name and the reading are two
fields rather than one string so the word can be set small and tracked against
a full-size figure; it read `F 10` first, which fitted the corner but had to be
learned before it said anything.

**The section is cut out of the button, not laid on it.** `scheme.fill` is a
layer inset by `GAUGE_W` rather than the button's own `backgroundColor`, so
nothing paints behind the gauge and the sky shows through. That is what lets
the reading be the accent — on a filled button, anything drawn *on* the fill
has to be the near-black the label uses, and a cyan figure on cyan is not a
figure. The label centres in what is left rather than in the whole button. It
is
left off when the label already says the tank is empty. The jump is a compact
control under the tabs rather than a menu-sized panel; `MenuButton` takes a
`height` for it and drops its label a size to match.

Because the chrome is now a known, small slice of the helm, the two pieces of
ship art are scaled from the space left over rather than sized by hand; fixed
sizes dropped the Elder Shrike through the player's ship on a short phone. The
saving went straight to the art — a boss no longer shrinks anything.

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

The cells in the expanded controls animate between unlit and their subsystem's
colour, with a kick and a white flash as the current lands, so a bar moving
between two rows reads as something travelling. **They also settle by timer.**
Reanimated drives them off `requestAnimationFrame` on web, and they report an
allocation the player just changed, so a starved tab must not strand a cell
showing the old level — the same reason `FadeInView` exists. This was not
theoretical: a screenshot taken before the guard showed 2/2/2 while the save
held 0/2/4.

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

**No ship has a colour of its own, and neither does the player.**
`palette.player` — plain white — draws every hull, the card it sits in, its
class label, its stat bars and carousel dot, and on the sector map the range
ring, the routes out of here and the star the ship is standing on. `ShipArt`
takes no colour at all, only a `locked` flag that swaps in the cold grey.

Each ship used to carry an `accent` on its table entry that tinted all of
that, so the *map* changed colour depending on what you had launched in.
Nothing about a ship actually varies by colour: they differ in silhouette,
cargo and reactor. The field is gone from `Ship` rather than set to one shared
value, so the six cannot quietly drift apart again.

**White is doing work, not just being neutral.** It is what leaves the two
colour-coded things on screen free to mean something: a **red** boss star, and
whatever is waiting at a star (`ENCOUNTER_STYLE`). Those stay. So do the
subsystem tints, which are a different question again — a cyan shield bubble
and an orange exhaust say which *row* is powering them, not which ship it is.

The accent survives only as app chrome that was never ship-specific: the menu
buttons, the fuel gauge on the jump button and the fuel badge on the map, the
wordmark's rule, the settings controls and the planet's atmosphere.

Hull and speed used to sit beside cargo on the ship cards. They are gone —
cargo is the one stat that still varies without being energy. The cards also
carry an empty **WEAPON** hardpoint above cargo and the reactor; there is no
weapon table yet, so the slot reads EMPTY and holds the space.

`lib/energy.ts` imports nothing, for the same reason `sectorMap.ts` imports
nothing: pure rules run under bare node in the verify script. The labels and
tints live in `lib/subsystems.ts`, which is to it what `encounters.ts` is to
`sectorMap.ts`.

### Layer boundaries

`lib/theme.ts`, `lib/dialogue.ts`, `lib/energy.ts`, `lib/hull.ts` and
`lib/hold.ts` import nothing from the project and are the leaves.
`lib/sectorMap.ts` is nearly one: it imports `dialogue.ts` alone, to deal
encounters across the stars, and both still run under bare node. `lib/ships.ts`, `lib/encounters.ts` and
`lib/subsystems.ts` depend on the theme; `lib/runStore.ts` depends on ships,
the map, the energy and hull rules, and `encounters.ts` — it reads the
`hostile` flag out
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
- **`ScrollView`'s snapping props are native-only.** `snapToInterval`,
  `decelerationRate` and `disableIntervalMomentum` do nothing on
  react-native-web, which wires CSS scroll snapping up for `pagingEnabled`
  alone. The ship carousel therefore free-scrolled on web and rested wherever
  momentum ran out. `scroll-snap-type: x mandatory` on the strip and
  `scroll-snap-align: center` on each card give the browser the same job; both
  are applied on web only and cast, since `ViewStyle` has no names for them.
  **`onMomentumScrollEnd` is a separate hole in the same component** —
  react-native-web's `ScrollView` only ever calls `onScroll`, so anything
  hung off momentum ending never runs there at all. Derive it from the scroll
  offset instead. The two look like one bug and are not: one is where the
  strip stops, the other is what gets read out of where it stopped.
- **The `@/` alias does not resolve under bare node.** The verify scripts run
  the rule files directly, with no bundler, so anything they reach has to
  import with a relative path *and* the `.ts` extension — `./dialogue.ts`, not
  `@/lib/dialogue`. That is the real reason the leaf files import nothing;
  purity alone was never the whole of it. Metro is happy with the relative
  form either way, so when a rule file does need another, write it that way
  and `npm run verify` keeps working.
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
- **Reanimated animations do not advance here at all — and waiting does not
  help.** Measured rather than assumed: `requestAnimationFrame` *does* fire in
  headless, about four times a second, yet a `withTiming` stays pinned at its
  starting value however long the capture runs. A screenshot therefore shows
  frame zero of any animation, never a middle. Give every effect a first frame
  that is already worth looking at, and never conclude anything about motion
  from a capture.
- **To actually see an animation, render its maths statically.** The frames in
  this session's shield work were checked by generating a scratch HTML page
  that draws the same geometry at a handful of progress values with plain CSS
  transforms — no Reanimated — and screenshotting that. It verifies the part
  that was designed (the geometry) without depending on the part that cannot
  run here. Keep the page beside the component's constants so the two can be
  compared.
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
