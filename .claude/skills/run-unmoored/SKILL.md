---
name: run-unmoored
description: Launch and drive the Unmoored app in this container to see a change working, take a screenshot, or publish the playable build into chat. Use when asked to run, start, test, screenshot or share the app. Covers the Expo proxy workaround, the static-serve + headless Chromium driver, and the artifact publish recipe.
---

# Running Unmoored

The verified path. Every workaround below exists because the obvious thing failed.

## 1. Build (do not use `expo start`)

`npx expo start` crashes in this container: the CLI validates dependency
versions against Expo's API, the agent proxy answers with non-JSON, and it dies
before Metro binds a port. `EXPO_OFFLINE=1` and
`EXPO_NO_DEPENDENCY_VALIDATION=1` do **not** prevent it.

Export a static bundle instead — it also exercises the whole Metro build, so it
catches resolution errors `tsc` cannot:

```bash
npm install                       # once per container
npm run verify                    # typecheck + map and energy properties, cheap
rm -rf dist && npm run build:web  # writes dist/
```

## 2. Serve and drive

```bash
cd dist && python3 -m http.server 8099 --bind 127.0.0.1 &
```

Chromium is pre-installed. Pass `--proxy-server='direct://'` or requests to
localhost go through the agent proxy and fail:

```bash
BIN=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
"$BIN" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --proxy-server='direct://' --proxy-bypass-list='*' \
  --virtual-time-budget=9000 --window-size=390,844 \
  --screenshot=shot.png "http://127.0.0.1:8099/"
```

**Look at the screenshot.** A blank frame is a failure to launch, not a pass.

### Clicking through screens

React Native Web renders `Text` as divs, so drive it by visible label — or,
better, by `aria-label`: every control on the space screen carries one that
states its numbers (see `CLAUDE.md`). Append this to `dist/index.html`, run,
then restore the file:

```js
window.__click = function (text) {
  const all = [...document.querySelectorAll('div,span,button')];
  const hit = all.reverse().find(el => (el.textContent || '').trim() === text && el.offsetParent !== null);
  if (!hit) return 'NOT FOUND: ' + text;
  let node = hit;
  for (let i = 0; i < 8 && node; i++) {
    if (node.getAttribute && (node.getAttribute('role') === 'button' || node.tabIndex >= 0)) break;
    node = node.parentElement;
  }
  node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  node.click();
};
```

A full run is `NEW RUN` → `LAUNCH` → `JUMP`, ~1.5s apart. `--dump-dom` plus
`document.title = ...` is the cheapest way to read state back out — far cheaper
than a screenshot when the answer is a number or a string.

### What this cannot tell you

`requestAnimationFrame` is throttled to roughly **1fps** here, so Reanimated
animations do not advance and star opacities stay frozen. Layout and content are
trustworthy; motion is not. Never report an animation as broken — or working —
from a headless run.

## 3. Publishing the playable build into chat

The compiled bundle can be published as an artifact so the app is playable in
conversation. Two traps, both of which produce a silent blank or a stuck
loading screen:

- **`_expo/` is a reserved published path.** Copy the bundle to `bundle/entry.js`
  and reference that.
- **The artifact is not served at `/`.** expo-router reads `location.pathname`,
  so without a rewrite it renders "Unmatched Route". But the rewrite also moves
  the base URL that relative paths resolve against — so resolve the bundle URL
  **before** rewriting, then inject the script. Getting this order wrong 404s the
  bundle and the page sits on LOADING forever.

The working page is `scripts/artifact-page.html`. After `build:web`, run
`node scripts/pack-artifact.mjs`: it moves the bundle to `bundle/entry.js`,
makes Metro's absolute `/assets/...` URLs relative, and prints the `files`
map. Publish the page with `root: "dist"` and that map to the **one** live
artifact whose URL is in `CLAUDE.md` — never a new one — and do the checks
listed there before and after (fetch `main` first; read the bundle back).

**Reproduce path bugs faithfully.** Serving from the server root hides them,
because the wrong URL resolves too. Serve from a nested directory with nothing
at the root before trusting a fix.
