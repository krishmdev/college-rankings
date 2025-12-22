// Writes src/crowd/demoReviews.json: SYNTHETIC reviews for the offline demo, so the review UI and
// the crowd metrics have something to show without a backend. Seeded, so the file is stable.
// These are not real opinions; the app labels them as synthetic everywhere they appear.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const snap = JSON.parse(readFileSync(join(here, '../../../packages/dataset/data/snapshot.json'), 'utf8'));

let seed = 20251223;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const clamp = (x) => Math.max(1, Math.min(5, Math.round(x)));

const TITLES = ['Good fit for me', 'Mixed feelings', 'Worth it so far', 'Solid but not perfect', 'Better than I expected', 'Depends on your major'];
const LINES = [
  'Professors in the intro courses are approachable and hold regular office hours.',
  'Housing is fine for first years but gets expensive after that.',
  'There is a club for almost anything, and starting a new one is easy.',
  'Career services helped me find an internship, though you have to go to them.',
  'Campus feels safe at night and the escort service actually shows up.',
  'Financial aid was generous but the paperwork took months.',
  'Some required classes are huge lectures; upper-level ones are much smaller.',
  'Weekends can be quiet if you do not have a car.',
];

// A spread of schools: the 40 largest plus 60 sampled from the rest.
const bySize = [...snap.schools].sort((a, b) => b.ugSize - a.ugSize);
const chosen = new Set(bySize.slice(0, 40).map((s) => s.id));
while (chosen.size < 100) chosen.add(pick(snap.schools).id);

// Two different sentences per review.
function twoLines() {
  const a = Math.floor(rnd() * LINES.length);
  const b = (a + 1 + Math.floor(rnd() * (LINES.length - 1))) % LINES.length;
  return `${LINES[a]} ${LINES[b]}`;
}

const reviews = [];
let id = 1;
for (const s of snap.schools.filter((x) => chosen.has(x.id))) {
  const n = 2 + Math.floor(rnd() * 11);
  const base = 3 + rnd() * 1.4 - 0.4; // each school gets its own center
  for (let k = 0; k < n; k++) {
    const r = (d) => clamp(base + d + (rnd() - 0.5) * 2);
    reviews.push({
      id: id++,
      schoolId: s.id,
      synthetic: true,
      relationship: rnd() < 0.7 ? 'current_student' : 'recent_alum',
      gradYear: 2024 + Math.floor(rnd() * 5),
      ratings: { overall: r(0), academics: r(0.2), social: r(0), career: r(-0.1), housing: r(-0.4), safety: r(0.2), value: r(-0.2) },
      title: TITLES[(s.id + k) % TITLES.length],
      body: twoLines(),
    });
  }
}
writeFileSync(join(here, '../src/crowd/demoReviews.json'), JSON.stringify({ synthetic: true, generator: 'scripts/make-demo-reviews.mjs', reviews }) + '\n');
console.log(`${reviews.length} synthetic reviews for ${chosen.size} schools`);
