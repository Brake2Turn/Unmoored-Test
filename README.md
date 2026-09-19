# Unmoored

A space-themed iOS game. This repository currently contains the **start screen**
and the scaffolding around it.

![Start screen, both states](docs/start-screen-states.svg)

## Requirements

- Xcode 16 or later (the project uses synchronized file groups, `objectVersion 77`)
- iOS 17.0+ deployment target
- A Mac — SpriteKit does not build on Linux

## Running it

```sh
open Unmoored.xcodeproj
```

Then pick an iPhone simulator and hit Run. From the command line:

```sh
xcodebuild -scheme Unmoored -destination 'platform=iOS Simulator,name=iPhone 15' build
```

No dependencies, no package resolution, nothing to install first.

## What the start screen does

Three menu entries, as specified:

| Entry | Behaviour |
| --- | --- |
| **New Run** | Discards any saved run, writes a fresh one, and enters the run scene. |
| **Continue Run** | Enabled only when a save exists. Its caption shows that run's progress (`SECTOR 3 · 12:40 · HULL 84%`); with no save it reads `NO RUN IN PROGRESS` and is greyed out and untappable. |
| **Settings** | Presents the settings sheet over the scene. |

Supporting details:

- **Parallax starfield** — three depth bands scrolling at different speeds, looping
  seamlessly, with a subset of stars twinkling out of phase.
- **Backdrop** — gradient sky, two drifting nebula blooms, a lit planet rising from
  the lower edge with an atmospheric rim, and an occasional shooting star.
- **Entrance animation** — title fades and settles, menu entries rise in sequence.
  It plays on first launch only; returning from a run does not replay it.
- **Touch feel** — press states with scale and bloom, drag-off cancels the way UIKit
  controls do, light haptic on press and a firmer one on activation.
- **Layout** — everything is derived from the scene size and the real safe-area
  insets, so it adapts across devices rather than assuming one screen.
- **Reduce Motion** — a settings toggle that stills the drift, parallax and entrance
  for players sensitive to motion.

## Project layout

```
Unmoored/
  UnmooredApp.swift          @main entry point
  RootView.swift             Hosts the SpriteKit scene, presents the settings sheet
  AppModel.swift             Navigation state, scene transitions, menu delegate
  Scenes/
    StartScene.swift         The start screen
    RunPlaceholderScene.swift  Stand-in for gameplay (see below)
    Nodes/
      Starfield.swift        Looping parallax star layers
      CelestialBackdrop.swift  Sky, nebulae, planet, shooting stars
      MenuButton.swift       Menu entry with pressed and disabled states
  Models/
    RunState.swift           A single in-progress run
    RunStore.swift           Saves and loads that run as JSON
    GameSettings.swift       Player preferences, persisted to UserDefaults
  Views/
    SettingsView.swift       SwiftUI settings sheet
  Support/
    Theme.swift              Palette, type scale, layout constants
    TextureFactory.swift     Runtime-generated star, glow, gradient and planet textures
    Haptics.swift            Feedback wrapper that respects the settings toggle
```

There are no image assets beyond the app icon — every glow and gradient is drawn at
runtime, so the art scales to any screen and the app stays small.

## The placeholder run scene

`RunPlaceholderScene` is **not gameplay**. It exists so the three menu actions can be
exercised end to end: starting a run creates a save, time spent in it accumulates, and
leaving writes it back so Continue Run has something real to resume. Replace it
wholesale when the actual game scene arrives — `AppModel.enterRun(_:)` is the only
place that references it.

## Regenerating the project file

`Unmoored.xcodeproj` is committed and is the source of truth. `project.yml` is an
[XcodeGen](https://github.com/yonaskolb/XcodeGen) spec kept alongside it, so the
project can be rebuilt from scratch if that file is ever lost or hits a merge
conflict:

```sh
brew install xcodegen && xcodegen generate
```

## Before submitting to the App Store

The scaffolding is in place but these are still placeholders:

- `PRODUCT_BUNDLE_IDENTIFIER` is `com.unmoored.game` — change it to an identifier you own.
- No development team is set; signing is on Automatic.
- The app icon is a generated placeholder. It is a valid 1024×1024 asset, but it is
  not a finished piece of art.
- App Store Connect will also want a privacy manifest, screenshots and a support URL.
