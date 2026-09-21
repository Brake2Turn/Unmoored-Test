/**
 * Prepares `dist/` for publishing to the artifact, and prints the file list.
 *
 *     npm run build:web && node scripts/pack-artifact.mjs
 *
 * Two things stand between Expo's export and a working artifact, and both
 * fail *silently* — the page loads, the game runs, and one piece of it is
 * simply missing.
 *
 * 1. **The bundle moves to `bundle/entry.js`.** Expo's `index.html` points at
 *    an absolute `/_expo/...`, and `_expo/` is a reserved path on the artifact
 *    host besides. This has been known for a while; the hand-written wrapper
 *    page exists to inject the bundle from its new home.
 *
 * 2. **Asset URLs have to be made relative.** This one is new, and it cost a
 *    round trip: Metro writes image sources as absolute `/assets/...`, which
 *    resolves against the *host* root. The artifact is not served at a host
 *    root, so every bundled image 404s — the dialogue portraits were live and
 *    invisible for a version because of it. A `<base>` tag cannot save them:
 *    `<base>` only affects relative URLs, which is exactly what these are not.
 *    Rewriting them to `assets/...` lets the wrapper's `<base>` do its job.
 *
 * **Serving `dist/` from the root hides both.** `/assets/...` resolves there
 * because there *is* something at the root. Verify from a nested directory
 * with nothing above it, or the test proves nothing — this is the second time
 * that has caught someone out.
 */

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/** Every file under a directory, as paths relative to `dist/`. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(relative(DIST, full));
  }
  return out;
}

const web = join(DIST, '_expo/static/js/web');
const built = readdirSync(web).find((name) => name.startsWith('entry-') && name.endsWith('.js'));
if (!built) throw new Error('no entry-*.js in dist/_expo/static/js/web — did build:web run?');

mkdirSync(join(DIST, 'bundle'), { recursive: true });
let code = readFileSync(join(web, built), 'utf8');

const absolute = (code.match(/"\/assets\//g) ?? []).length;
code = code.replaceAll('"/assets/', '"assets/');
writeFileSync(join(DIST, 'bundle/entry.js'), code);

const files = ['bundle/entry.js', 'favicon.ico', ...walk(join(DIST, 'assets'))];
const sum = createHash('sha256').update(code).digest('hex').slice(0, 16);

console.log(`bundle   ${code.length} bytes  sha256 ${sum}`);
console.log(`rewrote  ${absolute} absolute asset urls to relative`);
console.log(`publish  ${files.length} files:`);
for (const file of files) console.log(`  ${file}`);
console.log('\nfiles map for the Artifact call:');
console.log(JSON.stringify(Object.fromEntries(files.map((f) => [f, f]))));
