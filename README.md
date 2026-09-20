# Unmoored

A space-themed mobile game, built with Expo (React Native). This repository
currently contains the **start screen** and the scaffolding around it.

![Start screen, both states](docs/start-screen-states.svg)

## Getting it running on Windows

You need [Node.js](https://nodejs.org) (LTS) and the **Expo Go** app from the
iPhone App Store. No Mac, no Xcode.

```powershell
npm install
npx expo install --fix
npx expo start
```

A QR code appears in the terminal. Open the **Camera** app on your iPhone, point
it at the code, and tap the banner — the game opens in Expo Go. Your phone and PC
need to be on the same WiFi network.

Edit any file and save: the screen reloads on your phone in about a second.

### Previewing in a browser instead

The same code runs in a desktop browser through `react-native-web`:

```powershell
npx expo start --web
```

That opens `http://localhost:8081` with the real app in it — handy for quick
layout work without reaching for your phone. Two caveats: haptics are silently
ignored (browsers have no Taptic Engine), and the volume sliders are the one
control whose web rendering differs from the phone. Check anything touch-related
in Expo Go before trusting it.

### If Expo Go says the SDK version doesn't match

Expo Go only runs the current SDK. Upgrade the project to match:

```powershell
npx expo install expo@latest --fix
```

That one command realigns every dependency, and is also the fix for any
"incompatible version" warning during install.

## What the start screen does

Three menu entries:

| Entry | Behaviour |
| --- | --- |
| **New Run** | Opens ship select. The run is only created once a ship launches, so backing out leaves an existing save untouched. |
| **Continue Run** | Enabled only when a save exists. Its caption shows that run's progress (`SECTOR 3 · 12:40 · HULL 84%`); with no save it reads `NO RUN IN PROGRESS` and is greyed out and untappable. |
| **Settings** | Slides up the settings sheet. |

Supporting details:

- **Parallax starfield** — three depth bands scrolling at different speeds, looping
  seamlessly, with a subset of stars twinkling out of phase. Animation runs on the
  UI thread via Reanimated, so it stays smooth.
- **Backdrop** — gradient sky, two nebula blooms, and a lit planet rising from the
  lower edge with an atmospheric rim.
- **Entrance animation** — the title fades in and the menu entries rise in sequence.
- **Touch feel** — press states with scale and bloom, drag-off cancels, and a light
  haptic on tap with a firmer one on activation.
- **Layout** — derived from the real screen size and safe-area insets, so it adapts
  across devices rather than assuming one screen.
- **Reduce Motion** — a settings toggle that stills the drift and the entrance.

## Ship select

Pressing New Run opens a horizontal carousel. The centred ship sits at full size
and full opacity; its neighbours shrink and dim, staying visible at the screen
edges so the swipe invites itself. Snapping is per-card, and settling on a new
ship fires a light haptic.

Ships live in `lib/ships.ts` as plain data — name, class, tagline, an accent
colour that tints the card and stat bars, and three 0–1 stats. The drawing for
each lives in `components/ships/ShipArt.tsx`, keyed by id. Adding a ship means
one entry in each file; nothing else needs touching.

Six ships ship today: **Drifter** and **Lance** are available from the first
launch, and **Bulwark**, **Halo**, **Mantis** and **Vesper** start locked.

### Locking

A ship is locked simply by having an `unlockHint` in `lib/ships.ts`. Locked
ships still appear in the carousel — seeing what is coming is half the reason
to keep playing — but they draw in cold grey, carry a padlock, show their
unlock condition in place of the tagline, and the launch button reads LOCKED
and does nothing.

Earned ships persist through `lib/unlocks.ts`, which stores the unlocked ids
in AsyncStorage and always keeps the two starters. **Nothing awards a ship
yet**, because no run can end — the unlock conditions are written but not
wired. Once gameplay exists, granting one is a single `unlockShip(id)` call
and the carousel already reacts. Reset Progress clears earned ships along
with the run.

## Project layout

```
app/                     Screens (expo-router: one file = one route)
  _layout.tsx            Navigation stack, providers, status bar
  index.tsx              The start screen
  select-ship.tsx        Swipeable ship carousel
  run.tsx                The helm — ship, empty space, one button
  sector.tsx             The twenty-star jump map
  settings.tsx           Settings sheet
components/
  FuelBadge.tsx          Ⓕ badge and count, shared by the helm and the map
  ships/EncounterShip.tsx   Shrike and merchant, drawn at helm size
  ships/ShipArt.tsx      Vector art for each ship
  StarField.tsx          Looping parallax star layers
  Backdrop.tsx           Sky gradient, nebulae, planet
  MenuButton.tsx         Menu entry with pressed and disabled states
  TitleBlock.tsx         Wordmark, rule and tagline
lib/
  sectorMap.ts           Jump-map generation and range maths
  ships.ts               Ship roster, stats, accents and unlock hints
  unlocks.ts             Which ships the player has earned
  theme.ts               Palette, type scale, layout constants
  runStore.ts            Saves and loads the current run
  settings.tsx           Player preferences + haptics helper
assets/
  icon.png               App icon (1024×1024)
```

There are no image assets beyond the icon — every gradient and glow is drawn with
SVG or native views, so the art scales to any screen.

## The run

**The helm** (`app/run.tsx`) is the ship adrift in open space. The only control
is JUMP, and the space above the ship is where whatever is waiting at this star
appears. A quiet
LEAVE sits at the top so a player is never stuck with no way back to the title.

**The sector map** (`app/sector.tsx`) is twenty stars scattered across the
sector. The ship starts on the lone star at the bottom, and the star in the top
band is the **boss**, drawn red and ringed. Stars within jump range
are drawn bright and joined to the ship by dashed routes; everything beyond range
is dim. Tapping a star in range selects it, and JUMP commits the move and returns
to the helm one sector further along. Visited stars keep a ring.

### How maps are generated

`lib/sectorMap.ts` rolls a fresh map for every run. Coordinates live in a fixed
100×160 box rather than screen pixels, so a jump that is in range on one phone is
in range on every phone; the renderer scales that box to fit.

Nodes are laid out in seven bands from bottom to top (1, 3, 4, 4, 4, 3, 1 = 20),
each band spreading its nodes across evenly sized slots with jitter — scattered
without ever clumping into a corner. Any node that lands out of reach of every
node in the band below is then nudged sideways until it is reachable. That
guarantees a route from the start to the top **by construction**, rather than
rolling maps until one happens to work.

The jump range of 34 was picked by measurement, not taste: across 5,000 generated
maps it leaves no node unreachable, always gives the start at least 3 options, and
averages 4.9 choices per node. A range of 30 strands nodes on 1.4% of maps; 46
inflates the average to 7.9 choices and makes the decision mushy.

`allNodesReachable()` is exported so the property can be asserted in a test.

### What is on each star

Every star carries an encounter, rolled once with the map. There is exactly one
enemy type — the **Shrike** — and the boss star holds an **Elder Shrike**, the
same hull drawn larger.

The start is left empty (you begin docked, nothing has happened) and the boss
star is spoken for, which leaves **18 stars that divide into three exact
sixes**: six Shrikes, six merchants, six empty. The pool is shuffled, so threats
land differently every run. Verified over 5,000 maps — the split is exact every
time and the per-star enemy rate sits between 0.326 and 0.345 against an
expected 0.333.

**The map does not show any of this.** Every star is a plain dot; the only thing
visible ahead of time is the boss, red from the moment you can see it. What is
actually at a star is learned by jumping there: the ship waiting for you appears
in the open space above your own at the helm, nose down, facing you. Red is a
Shrike, gold is a merchant, and an empty star stays empty.

**None of them do anything yet.** They are there to be seen.

### The boss star

One star in the top band is marked as the boss and drawn red at every distance —
it should be findable without looking for it. `bossIndex()` resolves it, falling
back to the furthest band for maps saved before bosses existed. Over 5,000
generated maps the boss is always in the top band, never the starting star, and
always reachable.

**The boss fight itself does not exist yet.** Jumping to that star currently just
moves the ship there like any other.

### Fuel

A full tank is **10 jumps** — `Math.round(NODE_COUNT * FUEL_COVERAGE)` with
coverage at 0.5. One jump costs one fuel wherever it goes, so a tank with no
backtracking reaches half the sector.

The readout is an **F badge and a count** — `Ⓕ 13` — above JUMP on the helm and
smaller in the map header. It turns red below a quarter of a tank. At zero,
nothing on the map is selectable, the range ring fades out and both buttons read
OUT OF FUEL.

**Every jump costs one fuel, including a hop back to a star already visited.**
`visited` holds distinct stars only, for drawing the rings; `jumps` counts hops
and is what the sector number follows. Bouncing between two stars therefore
drains a tank in 10 jumps while `visited` stays at 2 — verified by driving the
preview through exactly that.

Measured over 5,000 maps: the boss is **always exactly 6 jumps** from the start,
because the band spacing (22.7) is more than half the jump range (34), so a jump
can never skip a band. A tank therefore covers a fixed 6-jump critical path plus
**4 spare jumps** to spend on detours — that spare budget is the whole decision.
No map is unwinnable for want of fuel.

**Running dry does not end the run yet.** The ship is simply stuck, and LEAVE is
the way out. A proper stranded/game-over state is the next thing this needs.

## Publishing to the App Store

All of this happens from Windows. Expo builds the iPhone app on their Macs.

```powershell
npm install -g eas-cli
eas login
eas build --platform ios      # produces a real .ipa
eas submit --platform ios     # uploads it to App Store Connect
```

You will need:

- An **Apple Developer Program** membership — $99/year, required by Apple to publish.
- An **Expo account** — the free tier includes a limited number of cloud builds per month.

Still placeholders before you ship:

- `bundleIdentifier` is `com.unmoored.game` in `app.json` — change it to something you own.
- The app icon is generated art, not a finished piece of design.
- App Store Connect will also want screenshots, a description and a privacy policy.

## History

The start screen was first built as a native Swift + SpriteKit app. That version
is preserved in git history at commit `bc42c4d` if it is ever useful — it was
replaced because building it requires a Mac.
