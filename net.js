// Comunicação em tempo real entre os celulares + criptografia de ponta a ponta.
//
// Os celulares conversam por um broker MQTT público (via WebSocket seguro), então o app
// funciona como site estático, sem servidor próprio. Tudo que passa pelo broker vai
// cifrado: a chave da sala viaja só no QR code (na parte depois do #, que nunca sai do
// celular), e a carta de cada jogador é cifrada com uma chave que só o anfitrião e
// aquele jogador conhecem (ECDH). Ninguém na roda consegue espiar a carta do outro.

import mqtt from './vendor/mqtt.esm.js';

// Brokers públicos, em ordem de preferência. O anfitrião usa o primeiro que responder,
// e o índice escolhido vai no convite para todo mundo usar o mesmo.
// Importante: a ordem faz parte do convite (b=0, 1, 2...). Para trocar, acrescente no fim.
export const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];

const PREFIX = 'jogo-impostor/v1';

export const topics = (room) => ({
  state: `${PREFIX}/${room}/s`, //  anfitrião -> todos (estado da sala, retido)
  inbox: `${PREFIX}/${room}/j`, //  jogadores -> anfitrião (entrar / saiu)
  host: `${PREFIX}/${room}/h`, //   anfitrião online/offline (retido)
  card: (id) => `${PREFIX}/${room}/c/${id}`, // anfitrião -> um jogador (carta, retida)
});

// ---------- utilitários ----------

export function b64u(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const ALPHA = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomId(n = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let out = '';
  for (const b of bytes) out += ALPHA[b % ALPHA.length];
  return out;
}

// Inteiro aleatório em [0, max), sem viés (sorteio justo do impostor).
export function randInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- criptografia ----------

const te = new TextEncoder();
const td = new TextDecoder();

export const newRoomKey = () => b64u(crypto.getRandomValues(new Uint8Array(16)));

export const importRoomKey = (k) =>
  crypto.subtle.importKey('raw', unb64u(k), 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = te.encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64u(out);
}

export async function unseal(key, text) {
  const bytes = unb64u(text);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.subarray(0, 12) },
    key,
    bytes.subarray(12),
  );
  return JSON.parse(td.decode(pt));
}

const EC = { name: 'ECDH', namedCurve: 'P-256' };

// Par de chaves serializável (fica salvo no aparelho para reconectar sem perder a carta).
export async function newKeyPair() {
  const kp = await crypto.subtle.generateKey(EC, true, ['deriveKey']);
  return {
    pub: b64u(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))),
    priv: await crypto.subtle.exportKey('jwk', kp.privateKey),
  };
}

export async function deriveShared(privJwk, pubB64) {
  const priv = await crypto.subtle.importKey('jwk', privJwk, EC, false, ['deriveKey']);
  const pub = await crypto.subtle.importKey('raw', unb64u(pubB64), EC, false, []);
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: pub },
    priv,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ---------- conexão ----------

// Abre uma conexão que se reconecta sozinha. Publicações feitas sem conexão são
// descartadas de propósito: a cada reconexão o app republica o estado atual, então
// nada velho chega fora de ordem.
export function connect({ url, will, subs = [], onConnect, onMessage, onStatus }) {
  const client = mqtt.connect(url, {
    clientId: `imp_${randomId(12)}`,
    clean: true,
    keepalive: 20,
    reconnectPeriod: 2500,
    connectTimeout: 8000,
    resubscribe: false,
    queueQoSZero: false,
    protocolVersion: 4,
    will,
  });

  const api = {
    url,
    get connected() {
      return client.connected;
    },
    publish(topic, text, retain = false) {
      if (!client.connected) return false;
      client.publish(topic, text, { qos: 0, retain });
      return true;
    },
    nudge() {
      if (!client.connected && !client.reconnecting && !client.disconnecting) client.reconnect();
    },
    close() {
      client.end(true);
    },
    // Encerra com calma: entrega o que falta e avisa o broker (sem disparar o "caiu").
    end() {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          client.end(true);
          resolve();
        }, 1500);
        client.end(false, {}, () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
    onceConnected(fn) {
      if (client.connected) fn();
      else client.once('connect', () => fn());
    },
  };

  client.on('connect', () => {
    if (subs.length) client.subscribe(subs, { qos: 0 });
    onStatus?.('online');
    onConnect?.(api);
  });
  client.on('reconnect', () => onStatus?.('connecting'));
  client.on('offline', () => onStatus?.('offline'));
  client.on('close', () => {
    if (!client.connected) onStatus?.(client.reconnecting ? 'connecting' : 'offline');
  });
  client.on('error', (err) => console.warn('[impostor] conexão:', err?.message || err));
  client.on('message', (topic, payload) => onMessage?.(topic, payload.toString()));

  onStatus?.('connecting');
  return api;
}

// Tenta os brokers em ordem e fica com o primeiro que conectar.
export function connectFirst(urls, opts, perTryMs = 6000) {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= urls.length) {
        // Nenhum respondeu (sem internet?). Fica tentando o primeiro.
        resolve({ index: 0, conn: connect({ ...opts, url: urls[0] }) });
        return;
      }
      const index = i++;
      // Uma tentativa abandonada não pode mais mexer no estado do app.
      let live = true;
      const guard = (fn) => (...args) => {
        if (live) fn?.(...args);
      };
      const conn = connect({
        ...opts,
        url: urls[index],
        onConnect: guard(opts.onConnect),
        onMessage: guard(opts.onMessage),
        onStatus: guard(opts.onStatus),
      });
      const timer = setTimeout(() => {
        live = false;
        conn.close();
        tryNext();
      }, perTryMs);
      conn.onceConnected(() => {
        clearTimeout(timer);
        resolve({ index, conn });
      });
    };
    tryNext();
  });
}
