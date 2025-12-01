// Copies the committed dataset snapshot into public/ so the web build can fetch it
// instead of inlining ~1 MB of JSON into the JS bundle.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..', 'packages', 'dataset', 'data');
const dest = join(here, '..', 'public', 'data');

mkdirSync(dest, { recursive: true });
for (const name of ['snapshot.json', 'manifest.json']) {
  const from = join(src, name);
  if (existsSync(from)) copyFileSync(from, join(dest, name));
}
