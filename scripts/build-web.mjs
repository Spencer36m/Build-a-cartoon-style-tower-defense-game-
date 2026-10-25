// Copies the game files into www/, which is what Capacitor bundles into the iOS app.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const files = ['index.html', 'privacy.html', 'style.css', 'manifest.webmanifest', 'sw.js', 'js', 'icons', 'fonts'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of files) cpSync(join(root, f), join(out, f), { recursive: true });
console.log(`Copied ${files.length} entries to www/`);
