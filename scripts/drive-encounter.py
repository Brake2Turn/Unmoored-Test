"""Land on one chosen encounter and read it back, or shoot it.

    npm run build:web && node scripts/pack-artifact.mjs
    python3 scripts/drive-encounter.py <meetingId> [step] [out.png]

`meetingId` is an `id` from `MEETINGS` in `lib/dialogue.ts`. `step` is how many
taps into the conversation to stop at (0 is the first line). With an output
path it screenshots; without, it prints what the box says and whether the
portrait decoded.

    python3 scripts/drive-encounter.py 9 1          # the abandoned ship's line
    python3 scripts/drive-encounter.py 10 0 out.png # the convict, as a picture

Three things make this work, and each one cost a wrong answer first:

1. **It serves from a nested path.** `dist/` copied into `.probe/webroot/app/`
   and loaded at `/app/`, never at the server root. At the root an absolute
   `/assets/...` resolves because something *is* there, so a root-served check
   silently passes while the artifact would 404 — that is exactly how the
   portraits shipped live and invisible. Anything checking bundled media has
   to come through here.

2. **It keeps one browser profile** (`.probe/chrome-profile`). A fresh page
   load rolls a fresh map, so reloading in the hope of meeting a particular
   encounter never converges. Instead the first run rolls a map and records
   which node holds which meeting; every later run reuses that saved run from
   localStorage and only moves the ship. Delete `.probe/` to roll a new map.

3. **Taps are spaced out.** Two presses in one JavaScript turn are one press —
   React has not re-rendered in between — so each advance waits on a timer.

Remember that Reanimated does not advance in headless at all: a screenshot is
frame zero of any animation, never a middle.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
PROBE = ROOT / ".probe"
WEBROOT, APP = PROBE / "webroot", PROBE / "webroot" / "app"
PROFILE = PROBE / "chrome-profile"
MAP_FILE = PROBE / "map.json"
PAGE = ROOT / "scripts" / "artifact-page.html"

BIN = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"
PORT = "8099"
KEY = "unmoored.currentRun"

# Rolls a map and reports which node holds which meeting.
SURVEY = """
<script>
localStorage.setItem('__KEY__', JSON.stringify({ id: 'probe', shipId: 'bulwark', spoken: [] }));
setTimeout(function () {
  var run = JSON.parse(localStorage.getItem('__KEY__') || '{}');
  var nodes = (run.map && run.map.nodes) || [];
  document.title = JSON.stringify(nodes.map(function (n, i) { return [i, n.meeting]; }));
}, 2200);
</script>
"""

# Keeps the saved run and its map; only stands somewhere else.
VISIT = """
<script>
(function () {
  var run = JSON.parse(localStorage.getItem('__KEY__') || '{}');
  run.position = __POS__;
  run.spoken = [];
  localStorage.setItem('__KEY__', JSON.stringify(run));
})();

function spoken() {
  return [].slice.call(document.querySelectorAll('[aria-label]'))
    .map(function (e) { return e.getAttribute('aria-label'); })
    .filter(function (s) { return / says: /.test(s); });
}

setTimeout(function () {
  // The title screen's button is found by label, not by its visible text.
  var go = [].slice.call(document.querySelectorAll('[aria-label]'))
    .find(function (e) { return /^CONTINUE RUN/.test(e.getAttribute('aria-label')); });
  if (go) {
    go.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    go.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    go.click();
  }

  var want = __STEP__, done = 0;
  function tap() {
    if (done >= want) {
      var im = document.querySelector('img');
      document.title = (spoken()[0] || 'NO DIALOGUE') +
        ' || portrait=' + (im ? 'yes w=' + im.naturalWidth : 'none');
      return;
    }
    done++;
    // The whole overlay is the control, so tapping it is tapping the line.
    var box = [].slice.call(document.querySelectorAll('[aria-label]'))
      .find(function (e) { return / says: /.test(e.getAttribute('aria-label')); });
    if (box) {
      box.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      box.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      box.click();
    }
    setTimeout(tap, 500);          // never two taps in one turn
  }
  setTimeout(tap, 2000);
}, 1500);
</script>
"""


def load(driver: str, shot: str = "") -> str:
    """Serve the packed build at /app/ and run one page load against it."""
    if not (DIST / "bundle" / "entry.js").exists():
        raise SystemExit("no dist/bundle/entry.js — run build:web and pack-artifact.mjs first")

    APP.mkdir(parents=True, exist_ok=True)
    for item in APP.iterdir():
        shutil.rmtree(item) if item.is_dir() else item.unlink()
    shutil.copytree(DIST, APP, dirs_exist_ok=True)
    (APP / "index.html").write_text(PAGE.read_text() + driver.replace("__KEY__", KEY))

    server = subprocess.Popen(
        ["python3", "-m", "http.server", PORT, "--bind", "127.0.0.1", "--directory", str(WEBROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        subprocess.run(["sleep", "1"])
        args = [
            BIN, "--headless", "--disable-gpu", "--no-sandbox",
            "--proxy-server=direct://", "--proxy-bypass-list=*",
            f"--user-data-dir={PROFILE}",
            "--virtual-time-budget=14000", "--window-size=390,844",
        ]
        args += [f"--screenshot={shot}"] if shot else ["--dump-dom"]
        args += [f"http://127.0.0.1:{PORT}/app/"]

        result = subprocess.run(args, capture_output=True, text=True)
        if shot:
            return f"shot -> {shot}"
        found = re.search(r"<title>(.*?)</title>", result.stdout, re.S)
        return found.group(1) if found else "NO TITLE"
    finally:
        server.terminate()


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)

    want = int(sys.argv[1])
    step = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    shot = sys.argv[3] if len(sys.argv) > 3 else ""

    if not MAP_FILE.exists():
        MAP_FILE.parent.mkdir(parents=True, exist_ok=True)
        MAP_FILE.write_text(json.dumps(json.loads(load(SURVEY).replace("&quot;", '"'))))
    pairs = json.loads(MAP_FILE.read_text())

    node = next((i for i, m in pairs if m == want), None)
    if node is None:
        held = sorted({m for _, m in pairs if m is not None})
        print(f"meeting {want} is not in this map; it holds {held}. Delete .probe/ to reroll.")
        raise SystemExit(1)

    print(f"meeting {want} is at node {node}")
    print(load(VISIT.replace("__POS__", str(node)).replace("__STEP__", str(step)), shot))


if __name__ == "__main__":
    main()
