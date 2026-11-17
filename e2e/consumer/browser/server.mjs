/**
 * Minimal static server for the real-browser pages. Serves the consumer project root, so the
 * pages load the installed package from /node_modules/@xkid1/tour-guide/… like a CDN would.
 */
import { createReadStream, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
};

/** Pages served with a strict CSP: no inline scripts or styles anywhere. */
const STRICT_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'";

export function startServer(root) {
  const base = realpathSync(root);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const path = resolve(join(base, decodeURIComponent(url.pathname)));
    // pnpm symlinks packages into node_modules/.pnpm, still inside the project.
    if (path !== base && !path.startsWith(base + sep)) {
      response.writeHead(403).end();
      return;
    }
    let file = path;
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      statSync(file);
    } catch {
      response.writeHead(404).end('not found');
      return;
    }
    const headers = {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    };
    if (url.pathname.endsWith('.strict.html'))
      headers['content-security-policy'] = STRICT_CSP;
    response.writeHead(200, headers);
    createReadStream(file).pipe(response);
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolvePromise({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
