// Tries to open TCP connections to a few public hosts. Under the offline sandbox every attempt
// must fail; unsandboxed they should succeed, which proves the check isn't vacuous.
import { connect } from 'node:net';

const TARGETS = [
  ['1.1.1.1', 443],
  ['api.openai.com', 443],
  ['huggingface.co', 443],
  ['collegescorecard.ed.gov', 443],
];

function attempt(host, port) {
  return new Promise((resolve) => {
    const sock = connect({ host, port, timeout: 3000 });
    const done = (ok, error) => {
      sock.destroy();
      resolve({ target: `${host}:${port}`, connected: ok, error });
    };
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false, 'timeout'));
    sock.once('error', (e) => done(false, e.code ?? e.message));
  });
}

export async function egressCanary() {
  const results = await Promise.all(TARGETS.map(([h, p]) => attempt(h, p)));
  return { blocked: results.every((r) => !r.connected), results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await egressCanary();
  console.log(JSON.stringify(r));
  const want = process.argv[2] ?? 'blocked';
  process.exit((want === 'blocked') === r.blocked ? 0 : 1);
}
