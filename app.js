// Impostor — jogo de roda. Um celular cria a sala e mostra o QR code; cada pessoa
// escaneia e entra. A cada rodada o celular do anfitrião sorteia a palavra e o(s)
// impostor(es) e manda uma carta secreta para cada um, inclusive para ele mesmo.

import {
  BROKERS, topics, connect, connectFirst, seal, unseal, newRoomKey, importRoomKey,
  newKeyPair, deriveShared, randomId, randInt, shuffle,
} from './net.js';
import { CATEGORIES, ALL, poolFor, labelFor } from './words.js';
import qrcode from './vendor/qrcode.mjs';

const MIN_PLAYERS = 3;
const ROOM_TTL = 12 * 60 * 60 * 1000; // a sala do anfitrião é retomada por até 12h
const HOST_KEY = 'impostor:anfitriao';
const NAME_KEY = 'impostor:nome';
const meKey = (room) => `impostor:jogador:${room}`;

// Só para testes locais: abra com ?broker=ws://127.0.0.1:9001
const testBroker = new URLSearchParams(location.search).get('broker');

const app = document.getElementById('app');
const bannerEl = document.getElementById('banner');
const toastEl = document.getElementById('toast');
const dlg = document.getElementById('dlg');

// ---------- utilitários ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const cleanName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 20);
const maxImpostors = (n) => (n >= 9 ? 3 : n >= 6 ? 2 : 1);
const brokerUrl = (b) => (typeof b === 'number' ? (BROKERS[b] ?? BROKERS[0]) : b);
const nameIn = (players, id) => players.find((p) => p.id === id)?.name ?? 'alguém';

function joinNames(names) {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
}

const store = {
  get(k) {
    try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* armazenamento indisponível */ }
  },
  del(k) {
    try { localStorage.removeItem(k); } catch { /* idem */ }
  },
};

// ---------- estado ----------

const S = {
  mode: 'home', //       'home' | 'host' | 'player'
  hostView: 'lobby', //  anfitrião: 'lobby' (QR e ajustes) | 'round'
  conn: 'offline', //    'connecting' | 'online' | 'offline'
  host: null, //         sessão do anfitrião (fica salva no aparelho)
  invite: null, //       convite aberto pelo jogador
  me: null, //           identidade do jogador nesta sala (fica salva)
  view: null, //         último estado da sala recebido do anfitrião
  card: null, //         carta do jogador na rodada atual
  hostOnline: true,
  invalid: false,
};

let net = null; //       conexão atual
let roomKey = null; //   chave AES da sala
let T = null; //         tópicos da sala
let session = null; //   id desta conexão do anfitrião
const shared = new Map(); // anfitrião: id do jogador -> { pub, key }
let hostKey = null; //   jogador: chave compartilhada com o anfitrião
let hostPubSeen = null;
let pendingCard = null;
let lastHello = 0;
const cid = randomId(6); // id desta aba (separa avisos de queda antigos dos novos)

const setConn = (status) => {
  S.conn = status;
  renderBanner();
};

// ================================================================
// Anfitrião
// ================================================================

const saveHost = () => S.host && store.set(HOST_KEY, S.host);

async function hostCreate(name) {
  const kp = await newKeyPair();
  const id = randomId(10);
  S.host = {
    v: 1,
    created: Date.now(),
    room: randomId(12),
    key: newRoomKey(),
    broker: testBroker || null,
    id,
    name,
    kp,
    seq: 0,
    players: [{ id, name, pub: kp.pub, on: true }],
    kicked: [],
    settings: { cat: ALL.id, impostors: 1, hint: true },
    used: [],
    round: null,
  };
  store.set(NAME_KEY, name);
  saveHost();
  S.mode = 'host';
  S.hostView = 'lobby';
  await hostConnect();
}

async function hostConnect() {
  const H = S.host;
  roomKey = await importRoomKey(H.key);
  T = topics(H.room);
  session = randomId(6);
  const will = {
    topic: T.host,
    payload: await seal(roomKey, { t: 'host', on: false, hs: session }),
    qos: 0,
    retain: true,
  };
  const opts = { will, subs: [T.inbox], onConnect: hostOnConnect, onMessage: hostOnMessage, onStatus: setConn };
  render();
  if (H.broker == null) {
    const { index, conn } = await connectFirst(BROKERS, opts);
    net = conn;
    H.broker = index;
    saveHost();
  } else {
    net = connect({ ...opts, url: brokerUrl(H.broker) });
  }
  render();
}

async function hostOnConnect(api) {
  net = api;
  api.publish(T.host, await seal(roomKey, { t: 'host', on: true, hs: session }), true);
  await publishState();
  if (S.host.round) for (const id of S.host.round.participants) await publishCard(id);
}

let pubTimer = null;
function schedulePublish() {
  clearTimeout(pubTimer);
  pubTimer = setTimeout(publishState, 120);
}

async function publishState() {
  clearTimeout(pubTimer);
  const H = S.host;
  if (!H || !net) return;
  H.seq += 1;
  saveHost();
  const r = H.round;
  const state = {
    t: 'state',
    seq: H.seq,
    hs: session,
    host: { id: H.id, name: H.name, pub: H.kp.pub },
    players: H.players.map((p) => ({ id: p.id, name: p.name, on: p.id === H.id || p.on })),
    kicked: H.kicked,
    cat: H.settings.cat,
    // Durante a rodada o estado não diz quem é o impostor nem qual é a palavra.
    round: r && {
      n: r.n,
      participants: r.participants,
      first: r.first,
      phase: r.phase,
      ...(r.phase === 'reveal' ? { impostors: r.impostors, word: r.word, cat: r.cat } : {}),
    },
  };
  net.publish(T.state, await seal(roomKey, state), true);
}

async function sharedFor(p) {
  const cached = shared.get(p.id);
  if (cached && cached.pub === p.pub) return cached.key;
  const key = await deriveShared(S.host.kp.priv, p.pub);
  shared.set(p.id, { pub: p.pub, key });
  return key;
}

function cardFor(id) {
  const r = S.host.round;
  if (r.impostors.includes(id)) {
    return { t: 'card', n: r.n, role: 'impostor', multi: r.impostors.length > 1, hint: r.hint };
  }
  return { t: 'card', n: r.n, role: 'civil', word: r.word };
}

async function publishCard(id) {
  const H = S.host;
  if (!H?.round || id === H.id || !net) return;
  const p = H.players.find((x) => x.id === id);
  if (!p) return;
  net.publish(T.card(id), await seal(await sharedFor(p), cardFor(id)), true);
}

async function hostOnMessage(topic, text) {
  if (topic !== T.inbox || !text) return;
  let m;
  try { m = await unseal(roomKey, text); } catch { return; }
  const H = S.host;
  if (!H || typeof m?.id !== 'string' || m.id === H.id) return;

  if (m.t === 'hello' && typeof m.pub === 'string') {
    if (H.kicked.includes(m.id)) {
      if (!m.rejoin) return schedulePublish();
      H.kicked = H.kicked.filter((x) => x !== m.id);
    }
    const name = cleanName(m.name) || 'Jogador';
    let p = H.players.find((x) => x.id === m.id);
    if (p) Object.assign(p, { name, pub: m.pub, on: true, cid: m.cid });
    else H.players.push((p = { id: m.id, name, pub: m.pub, on: true, cid: m.cid }));
    saveHost();
    if (H.round?.participants.includes(m.id)) await publishCard(m.id);
    schedulePublish();
    render();
  } else if (m.t === 'off') {
    const p = H.players.find((x) => x.id === m.id);
    // Ignora aviso de queda de uma aba antiga quando a pessoa já voltou por outra.
    if (p && p.on && (!m.cid || !p.cid || m.cid === p.cid)) {
      p.on = false;
      saveHost();
      schedulePublish();
      render();
    }
  } else if (m.t === 'bye') {
    removePlayer(m.id, false);
  }
}

async function removePlayer(id, kick) {
  const H = S.host;
  if (!H || id === H.id) return;
  H.players = H.players.filter((p) => p.id !== id);
  if (kick && !H.kicked.includes(id)) H.kicked.push(id);
  net?.publish(T.card(id), '', true);
  saveHost();
  await publishState();
  render();
}

function setSetting(key, value) {
  const H = S.host;
  if (!H) return;
  if (key === 'impostors') value = Math.max(1, Math.min(maxImpostors(H.players.length), value));
  H.settings[key] = value;
  saveHost();
  schedulePublish();
  render();
}

async function startRound() {
  const H = S.host;
  if (!H || H.players.length < MIN_PLAYERS) return;
  const participants = H.players.map((p) => p.id);
  const nImp = Math.max(1, Math.min(H.settings.impostors, maxImpostors(participants.length)));

  // Palavra sem repetir até acabarem as do tema.
  const pool = poolFor(H.settings.cat);
  let fresh = pool.filter((w) => !H.used.includes(w.word));
  if (!fresh.length) {
    const inPool = new Set(pool.map((w) => w.word));
    H.used = H.used.filter((w) => !inPool.has(w));
    fresh = pool;
  }
  const pick = fresh[randInt(fresh.length)];
  H.used.push(pick.word);

  H.round = {
    n: (H.round?.n ?? 0) + 1,
    participants,
    impostors: shuffle(participants).slice(0, nImp),
    word: pick.word,
    cat: pick.cat,
    hint: H.settings.hint ? labelFor(pick.cat) : null,
    first: participants[randInt(participants.length)],
    phase: 'playing',
    at: Date.now(),
  };
  saveHost();
  // Cartas primeiro, estado depois: quem recebe o aviso da rodada já tem a carta.
  for (const id of participants) await publishCard(id);
  await publishState();
  S.hostView = 'round';
  navigator.vibrate?.(60);
  render();
}

async function revealRound() {
  const r = S.host?.round;
  if (!r) return;
  r.phase = 'reveal';
  saveHost();
  await publishState();
  render();
}

async function endRoom() {
  const H = S.host;
  if (net?.connected) {
    H.seq += 1;
    const closed = { t: 'state', seq: H.seq, hs: session, closed: true, host: { id: H.id, name: H.name, pub: H.kp.pub } };
    net.publish(T.state, await seal(roomKey, closed), true);
    for (const p of H.players) net.publish(T.card(p.id), '', true);
    net.publish(T.host, '', true);
  }
  await net?.end();
  store.del(HOST_KEY);
  resetSession();
  render();
}

function inviteUrl() {
  const H = S.host;
  const b = typeof H.broker === 'number' ? H.broker : encodeURIComponent(H.broker);
  return `${location.origin}${location.pathname}${location.search}#r=${H.room}&k=${H.key}&b=${b}`;
}

async function shareInvite() {
  const url = inviteUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Impostor', text: 'Entra na minha sala do Impostor:', url });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copiado. É só mandar pra galera.');
  } catch {
    window.prompt('Copie o link da sala:', url);
  }
}

// ================================================================
// Jogador
// ================================================================

function parseInvite() {
  if (!location.hash) return null;
  const h = new URLSearchParams(location.hash.slice(1));
  const room = h.get('r');
  const key = h.get('k');
  const b = h.get('b');
  if (!room && !key) return null;
  if (!/^[A-Za-z0-9]{8,32}$/.test(room || '') || !/^[A-Za-z0-9_-]{22}$/.test(key || '')) return 'invalid';
  let broker = 0;
  if (b) broker = /^\d+$/.test(b) ? Number(b) : b;
  if (typeof broker === 'string' && broker !== testBroker) return 'invalid';
  if (typeof broker === 'number' && !BROKERS[broker]) return 'invalid';
  return { room, key, broker };
}

const saveMe = () => S.me && store.set(meKey(S.invite.room), S.me);

async function playerOpen() {
  let me = store.get(meKey(S.invite.room));
  if (!me?.id || !me?.kp?.pub) {
    me = { id: randomId(10), kp: await newKeyPair(), name: '', joined: false };
  }
  S.me = me;
  saveMe();
  roomKey = await importRoomKey(S.invite.key);
  T = topics(S.invite.room);
  const will = { topic: T.inbox, payload: await seal(roomKey, { t: 'off', id: me.id, cid }), qos: 0, retain: false };
  net = connect({
    url: brokerUrl(S.invite.broker),
    will,
    subs: [T.state, T.host, T.card(me.id)],
    onConnect: () => S.me?.joined && sendHello(),
    onMessage: playerOnMessage,
    onStatus: setConn,
  });
  render();
}

async function playerJoin(name) {
  S.me.name = name;
  S.me.joined = true;
  saveMe();
  store.set(NAME_KEY, name);
  keepAwake();
  await sendHello();
  render();
}

async function sendHello(rejoin = false) {
  if (!net || !S.me) return;
  lastHello = Date.now();
  const hello = { t: 'hello', id: S.me.id, name: S.me.name, pub: S.me.kp.pub, cid, rejoin };
  net.publish(T.inbox, await seal(roomKey, hello), false);
}

async function playerOnMessage(topic, text) {
  if (topic === T.state) {
    if (!text) return;
    let st;
    try { st = await unseal(roomKey, text); } catch { return; }
    if (S.view && typeof st.seq === 'number' && st.seq < S.view.seq) return; // mensagem velha
    const prevSession = S.view?.hs;
    S.view = st;
    if (st.host?.pub && st.host.pub !== hostPubSeen) {
      hostKey = await deriveShared(S.me.kp.priv, st.host.pub);
      hostPubSeen = st.host.pub;
      if (pendingCard) await openCard(pendingCard);
    }
    if (S.me.joined && !st.closed && !st.kicked?.includes(S.me.id)) {
      const listed = st.players?.some((p) => p.id === S.me.id);
      // O anfitrião reconectou ou ainda não nos viu: avisa que estamos aqui.
      if ((!listed || st.hs !== prevSession) && Date.now() - lastHello > 1500) sendHello();
    }
    render();
  } else if (topic === T.host) {
    if (!text) return;
    try {
      const h = await unseal(roomKey, text);
      if (h.on || !S.view || h.hs === S.view.hs) S.hostOnline = !!h.on;
    } catch { /* ignora */ }
    render();
  } else if (topic === T.card(S.me?.id)) {
    if (!text) {
      S.card = null;
      render();
      return;
    }
    if (!hostKey) {
      pendingCard = text;
      return;
    }
    await openCard(text);
  }
}

async function openCard(text) {
  try {
    const c = await unseal(hostKey, text);
    pendingCard = null;
    if (S.card?.n !== c.n) navigator.vibrate?.(60);
    S.card = c;
  } catch {
    pendingCard = text;
  }
  render();
}

async function playerLeave(tellHost = true) {
  if (S.me) {
    if (tellHost && S.me.joined && net?.connected) {
      net.publish(T.inbox, await seal(roomKey, { t: 'bye', id: S.me.id }), false);
    }
    S.me.joined = false;
    saveMe();
  }
  await net?.end();
  history.replaceState(null, '', location.pathname + location.search);
  resetSession();
  render();
}

function resetSession() {
  net = null;
  roomKey = null;
  T = null;
  session = null;
  shared.clear();
  hostKey = null;
  hostPubSeen = null;
  pendingCard = null;
  Object.assign(S, {
    mode: 'home', hostView: 'lobby', conn: 'offline', host: null, invite: null,
    me: null, view: null, card: null, hostOnline: true, invalid: false,
  });
}

// ================================================================
// Telas
// ================================================================

const MENU_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/></svg>`;
const menuButton = () => `<button class="icon-btn" type="button" data-act="menu" aria-label="Opções">${MENU_ICON}</button>`;

function nameField() {
  const saved = esc(store.get(NAME_KEY) || '');
  return `
    <label class="field">
      <span class="field-label">Seu nome</span>
      <input id="nome" name="nome" maxlength="20" required value="${saved}"
        placeholder="Como te chamam na roda" autocomplete="nickname" autocapitalize="words" enterkeyhint="go">
    </label>`;
}

function viewHome() {
  return `
  <section class="screen screen--home">
    <div class="hero">
      <div class="paper tilt-l">
        <div class="slip slip--logo"><span class="logo">Impostor<span class="logo-q">?</span></span></div>
      </div>
      <p class="tagline">Todo mundo recebe a mesma palavra. Menos&nbsp;um.</p>
    </div>
    <div class="stack">
      <form class="stack" data-form="create" novalidate>
        ${nameField()}
        <button class="btn btn-primary" type="submit">Criar sala</button>
      </form>
      <button class="link" type="button" data-act="rules">Como jogar</button>
    </div>
  </section>`;
}

function viewJoin() {
  const v = S.view;
  const names = (v?.players || []).map((p) => p.name);
  const slip = v?.host?.name
    ? `<span class="slip-big">${esc(v.host.name)}</span><span class="slip-small">chamou você pra roda</span>`
    : `<span class="slip-small">Procurando a sala…</span>`;
  return `
  <section class="screen screen--home">
    <div class="hero">
      <div class="paper tilt-r"><div class="slip slip--invite">${slip}</div></div>
      ${names.length ? `<p class="muted">Na roda: ${esc(joinNames(names))}</p>` : ''}
    </div>
    <div class="stack">
      <form class="stack" data-form="join" novalidate>
        ${nameField()}
        <button class="btn btn-primary" type="submit">Entrar na sala</button>
      </form>
      <button class="link" type="button" data-act="rules">Como jogar</button>
    </div>
  </section>`;
}

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  }
  const q = 4; // margem branca exigida pelos leitores
  return `<svg viewBox="${-q} ${-q} ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges" role="img" aria-label="QR code para entrar na sala"><rect x="${-q}" y="${-q}" width="${n + 2 * q}" height="${n + 2 * q}" fill="#fff"/><path d="${d}" fill="#141d5e"/></svg>`;
}

function rosterSlip(players, myId, canKick) {
  const items = players.map((p) => {
    const me = p.id === myId;
    const tags = me
      ? '<span class="tag">você</span>'
      : `${p.on ? '' : '<span class="tag">sem conexão</span>'}${canKick ? `<button class="x" type="button" data-act="kick" data-id="${esc(p.id)}" aria-label="Tirar ${esc(p.name)} da roda">tirar</button>` : ''}`;
    return `<li class="${p.on || me ? '' : 'is-off'}"><span class="dot" aria-hidden="true"></span><span class="nm">${esc(p.name)}</span>${tags}</li>`;
  });
  return `<div class="paper"><ul class="slip slip--list" aria-label="Pessoas na roda">${items.join('')}</ul></div>`;
}

function viewLobby() {
  const H = S.host;
  const n = H.players.length;
  const missing = Math.max(0, MIN_PLAYERS - n);
  const maxImp = maxImpostors(n);
  const imp = Math.min(H.settings.impostors, maxImp);
  const r = H.round;
  const ready = H.broker != null;
  const impNote = maxImp === 1 ? 'Com 6 pessoas ou mais, dá pra ter 2.' : maxImp === 2 ? 'Com 9 pessoas ou mais, dá pra ter 3.' : '';
  const faltam = `Faltam ${missing} ${missing === 1 ? 'pessoa' : 'pessoas'}`;

  let actions;
  if (!r) {
    actions = missing
      ? `<button class="btn btn-primary" type="button" disabled>${faltam}</button>`
      : `<button class="btn btn-primary" type="button" data-act="start">Começar rodada</button>`;
  } else if (r.phase === 'reveal') {
    actions = `
      <button class="btn btn-primary" type="button" data-act="start" ${missing ? 'disabled' : ''}>${missing ? faltam : 'Próxima rodada'}</button>
      <button class="btn btn-ghost" type="button" data-act="round">Ver resultado da rodada ${r.n}</button>`;
  } else {
    actions = `
      <button class="btn btn-primary" type="button" data-act="round">Voltar pra rodada ${r.n}</button>
      <button class="btn btn-ghost" type="button" data-act="start" ${missing ? 'disabled' : ''}>Sortear outra rodada</button>`;
  }

  return `
  <section class="screen screen--lobby" data-room="${esc(H.room)}">
    <header class="top"><h1 class="title">Sua sala</h1>${menuButton()}</header>

    <div class="qr">
      <div class="paper qr-paper">
        <div class="slip slip--qr" ${ready ? `data-invite="${esc(inviteUrl())}"` : ''}>
          ${ready ? qrSvg(inviteUrl()) : '<span class="slip-small">Preparando a sala…</span>'}
          <p class="qr-caption">Aponte a câmera pra entrar</p>
        </div>
      </div>
      <button class="btn btn-ghost btn-small" type="button" data-act="share" ${ready ? '' : 'disabled'}>Mandar convite por link</button>
    </div>

    <section>
      <h2 class="section-title">Na roda <span class="count">${n}</span></h2>
      ${rosterSlip(H.players, H.id, true)}
    </section>

    <section class="settings" aria-label="Ajustes da rodada">
      <div>
        <h2 class="section-title">Tema das palavras</h2>
        <div class="chips" role="group" aria-label="Tema das palavras">
          ${[ALL, ...CATEGORIES].map((c) => `<button class="chip" type="button" data-act="cat" data-cat="${c.id}" aria-pressed="${H.settings.cat === c.id}">${c.label}</button>`).join('')}
        </div>
      </div>
      <div class="row">
        <div><span class="row-title">Impostores</span>${impNote ? `<span class="row-sub">${impNote}</span>` : ''}</div>
        <div class="stepper">
          <button type="button" data-act="imp" data-d="-1" aria-label="Menos impostores" ${imp <= 1 ? 'disabled' : ''}>−</button>
          <output aria-live="polite">${imp}</output>
          <button type="button" data-act="imp" data-d="1" aria-label="Mais impostores" ${imp >= maxImp ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <label class="row">
        <span><span class="row-title">Dica pro impostor</span><span class="row-sub">Ele fica sabendo o tema da palavra.</span></span>
        <input class="switch" type="checkbox" data-act="hint" ${H.settings.hint ? 'checked' : ''}>
      </label>
    </section>

    <div class="actions actions--sticky">${actions}</div>
  </section>`;
}

function secretSlip(card, n) {
  if (!card) {
    return `<div class="paper"><div class="slip slip--secret is-waiting">
      <span class="cover"><span class="cover-main">Recebendo sua palavra…</span></span>
    </div></div>`;
  }
  const face = card.role === 'impostor'
    ? `<span class="face face--imp">
         <span class="imp">${card.multi ? 'Você é um dos impostores' : 'Você é o impostor'}</span>
         ${card.hint ? `<span class="hint">Tema: ${esc(card.hint)}</span>` : ''}
         <span class="face-note">Descubra a palavra sem se entregar.</span>
       </span>`
    : `<span class="face face--word">
         <span class="face-label">Sua palavra</span>
         <span class="word">${esc(card.word)}</span>
       </span>`;
  return `<div class="paper"><button type="button" class="slip slip--secret" data-slip aria-pressed="false" aria-label="Segure pra ver sua palavra">
    <span class="cover"><span class="cover-main">Segure pra ver</span><span class="cover-sub">sua palavra da rodada ${n}</span></span>
    ${face}
  </button></div>`;
}

function viewRound(isHost) {
  const r = isHost ? S.host.round : S.view.round;
  const players = isHost ? S.host.players : S.view.players;
  const myId = isHost ? S.host.id : S.me.id;
  const card = isHost ? cardFor(S.host.id) : S.card?.n === r.n ? S.card : null;
  const first = r.first === myId ? 'Você começa.' : `Quem começa: ${esc(nameIn(players, r.first))}.`;
  return `
  <section class="screen screen--round" data-round="${r.n}">
    <header class="top"><h1 class="title">Rodada ${r.n}</h1>${menuButton()}</header>
    ${secretSlip(card, r.n)}
    <div class="stack-tight">
      <p class="first" data-first>${first}</p>
      <p class="muted">Cada um fala uma palavra ligada à sua, seguindo a roda. Depois, votem em quem é o impostor.</p>
    </div>
    ${isHost
      ? `<div class="actions">
           <button class="btn btn-primary" type="button" data-act="reveal">Revelar impostor</button>
           <button class="btn btn-ghost" type="button" data-act="lobby">Sala e QR code</button>
         </div>`
      : `<p class="muted foot">Quando ${esc(S.view.host.name)} revelar, o resultado aparece aqui.</p>`}
  </section>`;
}

function viewReveal(isHost) {
  const r = isHost ? S.host.round : S.view.round;
  const players = isHost ? S.host.players : S.view.players;
  const myId = isHost ? S.host.id : S.me.id;
  const names = r.impostors.map((id) => (id === myId ? 'você' : nameIn(players, id)));
  const multi = r.impostors.length > 1;
  const wasMe = r.impostors.includes(myId);
  return `
  <section class="screen screen--reveal" data-round="${r.n}">
    <header class="top"><h1 class="title">Rodada ${r.n}</h1>${menuButton()}</header>
    <div class="paper tilt-r drop"><div class="slip slip--reveal">
      <span class="face-label">${multi ? 'Os impostores eram' : 'O impostor era'}</span>
      <span class="reveal-name" data-impostors>${esc(joinNames(names))}</span>
    </div></div>
    <div class="paper tilt-l drop drop--late"><div class="slip">
      <span class="face-label">A palavra era</span>
      <span class="word" data-word>${esc(r.word)}</span>
    </div></div>
    ${wasMe ? `<p class="lead">${multi ? 'Você era um dos impostores.' : 'Você era o impostor.'} Enganou a roda?</p>` : ''}
    ${isHost
      ? `<div class="actions">
           <button class="btn btn-primary" type="button" data-act="start" ${S.host.players.length < MIN_PLAYERS ? 'disabled' : ''}>Próxima rodada</button>
           <button class="btn btn-ghost" type="button" data-act="lobby">Sala e QR code</button>
         </div>`
      : `<p class="muted foot">Esperando ${esc(S.view.host.name)} começar a próxima rodada.</p>`}
  </section>`;
}

function viewWait() {
  const v = S.view;
  const r = v.round;
  const midRound = r?.phase === 'playing' && !r.participants.includes(S.me.id);
  const lead = midRound
    ? 'A rodada já começou. Você entra na próxima.'
    : `Você está na roda. Quando ${esc(v.host.name)} começar a rodada, sua palavra aparece aqui.`;
  return `
  <section class="screen screen--wait">
    <header class="top"><h1 class="title">Sala de ${esc(v.host.name)}</h1>${menuButton()}</header>
    <p class="lead" data-wait>${lead}</p>
    <section>
      <h2 class="section-title">Na roda <span class="count">${v.players.length}</span></h2>
      ${rosterSlip(v.players, S.me.id, false)}
    </section>
  </section>`;
}

function viewMessage(title, body, primary, secondary) {
  return `
  <section class="screen screen--msg">
    <div class="paper tilt-l"><div class="slip slip--msg">
      <span class="slip-big">${title}</span>
      ${body ? `<span class="slip-small">${body}</span>` : ''}
    </div></div>
    <div class="actions">
      ${primary ? `<button class="btn btn-primary" type="button" data-act="${primary.act}">${primary.label}</button>` : ''}
      ${secondary ? `<button class="btn btn-ghost" type="button" data-act="${secondary.act}">${secondary.label}</button>` : ''}
    </div>
  </section>`;
}

function playerScreen() {
  const v = S.view;
  if (!S.me) return ['loading', viewMessage('Abrindo o convite…', '')];
  if (!S.me.joined) return ['join', viewJoin()];
  if (!v) return ['loading', viewMessage('Entrando na sala…', 'Conectando com o celular de quem criou a sala.')];
  if (v.closed) {
    return ['closed', viewMessage('A sala foi encerrada', `${esc(v.host?.name || 'Quem criou a sala')} encerrou o jogo.`, { act: 'leave', label: 'Voltar ao início' })];
  }
  if (v.kicked?.includes(S.me.id)) {
    return ['kicked', viewMessage('Você saiu da roda', `${esc(v.host.name)} tirou você da sala.`, { act: 'rejoin', label: 'Entrar de novo' }, { act: 'leave', label: 'Voltar ao início' })];
  }
  const r = v.round;
  if (r?.phase === 'reveal') return [`reveal-${r.n}`, viewReveal(false)];
  if (r?.phase === 'playing' && r.participants.includes(S.me.id)) return [`round-${r.n}`, viewRound(false)];
  return ['wait', viewWait()];
}

function currentView() {
  if (S.invalid) {
    return ['invalid', viewMessage('Esse convite não abre', 'Peça pra quem criou a sala mostrar o QR code de novo.', { act: 'leave', label: 'Ir pro início' })];
  }
  if (S.mode === 'host') {
    const r = S.host.round;
    if (r && S.hostView === 'round') {
      return r.phase === 'reveal' ? [`h-reveal-${r.n}`, viewReveal(true)] : [`h-round-${r.n}`, viewRound(true)];
    }
    return ['h-lobby', viewLobby()];
  }
  if (S.mode === 'player') return playerScreen();
  return ['home', viewHome()];
}

let lastHtml = '';
let lastKey = '';

function render() {
  const [key, html] = currentView();
  if (html !== lastHtml) {
    // Preserva o que a pessoa estava digitando quando a tela se atualiza.
    const typed = {};
    app.querySelectorAll('input[id]:not([type=checkbox])').forEach((i) => (typed[i.id] = i.value));
    const active = document.activeElement;
    const focusId = active && app.contains(active) ? active.id : '';
    const sel = focusId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

    app.innerHTML = html;
    lastHtml = html;

    for (const [id, value] of Object.entries(typed)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) {
        el.focus({ preventScroll: true });
        if (sel) try { el.setSelectionRange(...sel); } catch { /* ok */ }
      }
    }
    if (key !== lastKey) window.scrollTo(0, 0);
    lastKey = key;
  }
  renderBanner();
}

function renderBanner() {
  let msg = '';
  let alert = false;
  if (S.mode !== 'home' && !S.invalid && S.conn !== 'online') {
    msg = S.conn === 'connecting' ? 'Conectando…' : 'Sem conexão. Tentando de novo…';
    alert = S.conn !== 'connecting';
  } else if (S.mode === 'player' && S.me?.joined && S.view && !S.view.closed && S.hostOnline === false) {
    msg = `${S.view.host.name} está sem conexão. O jogo continua quando voltar.`;
    alert = true;
  }
  bannerEl.hidden = !msg;
  bannerEl.textContent = msg;
  bannerEl.classList.toggle('banner--alert', alert);
}

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 2800);
}

// ---------- folhas (menus e confirmações) ----------

function sheet(html) {
  return new Promise((resolve) => {
    dlg.innerHTML = `<div class="sheet-body">${html}</div>`;
    // Não escuta o evento "close": ele chega atrasado e fecharia a próxima folha
    // aberta em seguida (ex.: menu -> confirmação).
    const finish = (value) => {
      dlg.removeEventListener('click', onClick);
      dlg.removeEventListener('cancel', onCancel);
      if (dlg.open) dlg.close();
      resolve(value);
    };
    const onClick = (e) => {
      const b = e.target.closest('[data-ret]');
      if (b) finish(b.dataset.ret);
      else if (e.target === dlg) finish(null); // toque fora da folha
    };
    const onCancel = (e) => {
      e.preventDefault(); // tecla Esc / voltar
      finish(null);
    };
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('cancel', onCancel);
    dlg.showModal();
  });
}

const RULES = `
  <h2 class="sheet-title">Como jogar</h2>
  <ol class="rules">
    <li>Quem cria a sala mostra o QR code. Cada pessoa aponta a câmera do celular e entra com o nome.</li>
    <li>A cada rodada, todo mundo recebe a mesma palavra. Menos o impostor, que só fica sabendo que é o impostor.</li>
    <li>Começando por quem o app indicar e seguindo a roda, cada um fala uma palavra ligada à sua, sem entregar demais.</li>
    <li>Depois de uma ou duas voltas, todo mundo vota em quem acha que é o impostor. Se a roda acertar, o impostor ainda pode tentar adivinhar a palavra pra roubar a vitória.</li>
  </ol>
  <button class="btn btn-primary" type="button" data-ret="ok">Entendi</button>`;

const showRules = () => sheet(RULES);

async function showMenu() {
  const isHost = S.mode === 'host';
  const title = isHost ? 'Sua sala' : `Sala de ${esc(S.view?.host?.name || '')}`;
  const ret = await sheet(`
    <h2 class="sheet-title">${title}</h2>
    <div class="stack">
      <button class="btn btn-paper" type="button" data-ret="rules">Como jogar</button>
      ${isHost
        ? `<button class="btn btn-paper" type="button" data-ret="share">Mandar convite por link</button>
           <button class="btn btn-danger" type="button" data-ret="end">Encerrar sala</button>`
        : '<button class="btn btn-danger" type="button" data-ret="leave">Sair da sala</button>'}
      <button class="link link--paper" type="button" data-ret="close">Fechar</button>
    </div>`);
  if (ret === 'rules') showRules();
  else if (ret === 'share') shareInvite();
  else if (ret === 'end') {
    const ok = await sheet(`
      <h2 class="sheet-title">Encerrar a sala?</h2>
      <p>Todo mundo sai e o QR code para de funcionar.</p>
      <div class="stack">
        <button class="btn btn-danger" type="button" data-ret="yes">Encerrar sala</button>
        <button class="link link--paper" type="button" data-ret="no">Continuar jogando</button>
      </div>`);
    if (ok === 'yes') endRoom();
  } else if (ret === 'leave') {
    const ok = await sheet(`
      <h2 class="sheet-title">Sair da sala?</h2>
      <p>Você sai da roda. Pra voltar, é só escanear o QR code de novo.</p>
      <div class="stack">
        <button class="btn btn-danger" type="button" data-ret="yes">Sair da sala</button>
        <button class="link link--paper" type="button" data-ret="no">Continuar jogando</button>
      </div>`);
    if (ok === 'yes') playerLeave();
  }
}

async function confirmKick(id) {
  const name = esc(nameIn(S.host.players, id));
  const ok = await sheet(`
    <h2 class="sheet-title">Tirar ${name} da roda?</h2>
    <p>Essa pessoa para de receber palavras. Se quiser voltar, entra de novo pelo QR code.</p>
    <div class="stack">
      <button class="btn btn-danger" type="button" data-ret="yes">Tirar da roda</button>
      <button class="link link--paper" type="button" data-ret="no">Cancelar</button>
    </div>`);
  if (ok === 'yes') removePlayer(id, true);
}

// ================================================================
// Interação
// ================================================================

app.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const input = form.elements.nome;
  const name = cleanName(input?.value);
  if (!name) {
    input?.focus();
    input?.classList.add('is-empty');
    return;
  }
  const button = form.querySelector('button[type=submit]');
  if (button) button.disabled = true;
  if (form.dataset.form === 'create') {
    keepAwake();
    await hostCreate(name);
  } else if (form.dataset.form === 'join') {
    await playerJoin(name);
  }
});

app.addEventListener('input', (e) => e.target.classList?.remove('is-empty'));

app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  switch (el.dataset.act) {
    case 'rules': showRules(); break;
    case 'menu': showMenu(); break;
    case 'share': shareInvite(); break;
    case 'start': el.disabled = true; await startRound(); break;
    case 'reveal': el.disabled = true; await revealRound(); break;
    case 'round': S.hostView = 'round'; render(); break;
    case 'lobby': S.hostView = 'lobby'; render(); break;
    case 'cat': setSetting('cat', el.dataset.cat); break;
    case 'imp': setSetting('impostors', Math.min(S.host.settings.impostors, maxImpostors(S.host.players.length)) + Number(el.dataset.d)); break;
    case 'kick': confirmKick(el.dataset.id); break;
    case 'rejoin': await sendHello(true); break;
    case 'leave': await playerLeave(); break;
    default: break;
  }
});

app.addEventListener('change', (e) => {
  if (e.target.dataset?.act === 'hint') setSetting('hint', e.target.checked);
});

// Carta secreta: segurar mostra; soltar esconde. Um toque rápido mostra por 3 segundos.
let holdStart = 0;
let holdTimer = null;
const openSlip = (el) => {
  clearTimeout(holdTimer);
  el.classList.add('is-open');
  el.setAttribute('aria-pressed', 'true');
};
const closeSlip = (el) => {
  clearTimeout(holdTimer);
  el.classList.remove('is-open');
  el.setAttribute('aria-pressed', 'false');
};

app.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-slip]');
  if (!el) return;
  e.preventDefault();
  holdStart = performance.now();
  try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
  openSlip(el);
  keepAwake();
});

const endHold = (e) => {
  const el = e.target.closest?.('[data-slip]') || app.querySelector('[data-slip].is-open');
  if (!el) return;
  if (e.type === 'pointerup' && performance.now() - holdStart < 300) {
    holdTimer = setTimeout(() => closeSlip(el), 3000);
  } else {
    closeSlip(el);
  }
};
app.addEventListener('pointerup', endHold);
app.addEventListener('pointercancel', endHold);
app.addEventListener('contextmenu', (e) => {
  if (e.target.closest('[data-slip]')) e.preventDefault();
});
app.addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && e.target.matches?.('[data-slip]')) {
    e.preventDefault();
    if (!e.repeat) openSlip(e.target);
  }
});
app.addEventListener('keyup', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && e.target.matches?.('[data-slip]')) {
    e.preventDefault();
    closeSlip(e.target);
  }
});

// Mantém a tela acesa durante o jogo (senão o celular trava e cai a conexão).
let wakeLock = null;
async function keepAwake() {
  if (!('wakeLock' in navigator) || wakeLock || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => (wakeLock = null));
  } catch { /* sem suporte ou sem permissão */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  net?.nudge();
  if (S.mode !== 'home') keepAwake();
});
window.addEventListener('online', () => net?.nudge());

// ================================================================
// Início
// ================================================================

async function boot() {
  if (!window.isSecureContext || !crypto?.subtle) {
    app.innerHTML = viewMessage('Abra pelo link seguro', 'O jogo precisa de uma conexão https para funcionar.');
    return;
  }
  const invite = parseInvite();
  const saved = store.get(HOST_KEY);
  const alive = saved?.room && Date.now() - saved.created < ROOM_TTL;
  if (saved && !alive) store.del(HOST_KEY);

  if (invite === 'invalid') {
    S.invalid = true;
    S.mode = 'player';
    render();
    return;
  }
  // Quem criou a sala abriu o próprio convite: volta pra sala.
  if (invite && alive && invite.room === saved.room) history.replaceState(null, '', location.pathname + location.search);

  if (invite && !(alive && invite.room === saved.room)) {
    S.mode = 'player';
    S.invite = invite;
    render();
    await playerOpen();
    if (S.me.joined) keepAwake();
    return;
  }
  if (alive) {
    S.mode = 'host';
    S.host = saved;
    S.hostView = saved.round ? 'round' : 'lobby';
    await hostConnect();
    keepAwake();
    return;
  }
  render();
}

window.addEventListener('hashchange', () => location.reload());

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
