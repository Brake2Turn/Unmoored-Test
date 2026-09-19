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
  run.tsx                Stand-in for gameplay (see below)
  settings.tsx           Settings sheet
components/
  ships/ShipArt.tsx      Vector art for each ship
  StarField.tsx          Looping parallax star layers
  Backdrop.tsx           Sky gradient, nebulae, planet
  MenuButton.tsx         Menu entry with pressed and disabled states
  TitleBlock.tsx         Wordmark, rule and tagline
lib/
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

## The placeholder run screen

`app/run.tsx` is **not gameplay**. It exists so the menu actions can be exercised
end to end: starting a run creates a save, time spent there accumulates, and
leaving writes it back so Continue Run has something real to resume. Replace it
when the actual game arrives — nothing else depends on its contents.

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
