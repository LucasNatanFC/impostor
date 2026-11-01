// Ambiente local de teste: serve o app e sobe um broker MQTT (WebSocket) na máquina.
//   node tests/serve.mjs   ->  app em http://127.0.0.1:8080/?broker=ws://127.0.0.1:9001
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, createWebSocketStream } from 'ws';
import { Aedes } from 'aedes';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

export async function startServers({ appPort = 8080, brokerPort = 9001 } = {}) {
  const broker = await Aedes.createBroker();

  const wss = new WebSocketServer({
    port: brokerPort,
    handleProtocols: (protocols) => (protocols.has('mqtt') ? 'mqtt' : false),
  });
  wss.on('connection', (ws) => broker.handle(createWebSocketStream(ws)));

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    if (!path || path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(ROOT, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(appPort, '127.0.0.1', resolve));

  return {
    broker,
    appUrl: `http://127.0.0.1:${appPort}/?broker=${encodeURIComponent(`ws://127.0.0.1:${brokerPort}`)}`,
    brokerUrl: `ws://127.0.0.1:${brokerPort}`,
    async close() {
      await new Promise((r) => server.close(r));
      await new Promise((r) => wss.close(r));
      await new Promise((r) => broker.close(r));
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await startServers();
  console.log(`App: ${s.appUrl}`);
}
