// Peças comuns dos testes ponta a ponta: sobe o app e um broker MQTT locais e simula
// cada pessoa num "celular" separado (contexto isolado do Chrome).
import { existsSync, mkdirSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import puppeteer from 'puppeteer-core';
import mqtt from 'mqtt';
import { startServers } from './serve.mjs';

export const SHOTS = new URL('./screens/', import.meta.url).pathname;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = process.env.CHROME_PATH || [
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));

// ---------- decifrar como "intruso" (só com a chave do QR code) ----------
const unb64u = (t) => Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export async function openWith(keyB64, payload) {
  const key = await webcrypto.subtle.importKey('raw', unb64u(keyB64), 'AES-GCM', false, ['decrypt']);
  const bytes = unb64u(payload);
  const pt = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
  return JSON.parse(Buffer.from(pt).toString());
}

export async function setup() {
  mkdirSync(SHOTS, { recursive: true });
  const failures = [];
  const errors = [];

  function check(cond, msg) {
    if (cond) console.log(`  ✓ ${msg}`);
    else {
      console.log(`  ✗ ${msg}`);
      failures.push(msg);
    }
  }

  const s = await startServers({ appPort: 8080, brokerPort: 9001 });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const phones = [];

  async function phone(name) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${name}: ${m.text()}`);
    });
    page.setDefaultTimeout(10000);
    const p = { name, ctx, page };
    phones.push(p);
    return p;
  }

  // Quando algo falha, mostra o que cada celular tinha na tela.
  async function dumpScreens() {
    for (const p of phones) {
      const view = await p.page.evaluate(() => ({
        screen: document.querySelector('#app section')?.className,
        text: document.querySelector('#app')?.innerText.replace(/\s+/g, ' ').slice(0, 160),
        dialog: document.querySelector('#dlg[open]')?.innerText.replace(/\s+/g, ' ').slice(0, 80) || null,
        banner: document.querySelector('#banner:not([hidden])')?.innerText || null,
      })).catch((e) => ({ erro: e.message }));
      console.log(`  [${p.name}]`, JSON.stringify(view));
    }
  }

  const shot = (p, file, fullPage = false) => p.page.screenshot({ path: `${SHOTS}${file}.png`, fullPage });
  // Como uma pessoa faria: rola até o botão ficar no meio da tela e toca.
  const click = async (p, sel) => {
    await p.page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' })).catch(() => {});
    await p.page.click(sel);
  };
  const text = (p, sel) => p.page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);
  const waitText = (p, sel, value) =>
    p.page.waitForFunction((q, v) => document.querySelector(q)?.textContent.trim() === v, {}, sel, value);

  async function createRoom(host) {
    await host.page.goto(s.appUrl);
    await host.page.type('#nome', host.name);
    await click(host, 'form[data-form=create] button[type=submit]');
    await host.page.waitForSelector('.slip--qr[data-invite] svg');
    return host.page.$eval('.slip--qr', (el) => el.dataset.invite);
  }

  async function join(p, invite) {
    await p.page.goto(invite);
    await p.page.waitForSelector('#nome');
    await p.page.waitForSelector('.slip--invite .slip-big'); // já enxerga a sala antes de entrar
    await p.page.type('#nome', p.name);
    await click(p, 'form[data-form=join] button[type=submit]');
    await p.page.waitForSelector('.screen--wait, .screen--reveal, .screen--choosing, .screen--judge');
  }

  async function waitCard(p, n) {
    await p.page.waitForFunction(
      (n) => document.querySelector('.screen--round')?.dataset.round === String(n) && document.querySelector('.face'),
      {},
      n,
    );
    return p.page.evaluate(() => ({
      word: document.querySelector('.face--word .word')?.textContent.trim() || null,
      impostor: !!document.querySelector('.face--imp'),
      impText: document.querySelector('.face--imp .imp')?.textContent.trim() || null,
      hint: document.querySelector('.face--imp .hint')?.textContent.trim() || null,
      judge: !!document.querySelector('.face--judge'),
      judgeWord: document.querySelector('.face--judge .word')?.textContent.trim() || null,
      judgeImps: document.querySelector('.face--judge [data-judge-imps]')?.textContent.trim() || null,
      first: document.querySelector('[data-first]')?.textContent.trim(),
    }));
  }

  async function cards(phones, n) {
    const out = {};
    for (const p of phones) out[p.name] = await waitCard(p, n);
    return out;
  }

  // Confere uma rodada: impostores, mesma palavra pro resto, uma pessoa começando.
  // No modo juiz, o juiz fica de fora dessas contas.
  function checkRound(cs, nImp, label) {
    const all = Object.entries(cs);
    const judges = all.filter(([, c]) => c.judge).map(([n]) => n);
    const list = all.filter(([, c]) => !c.judge);
    const imps = list.filter(([, c]) => c.impostor).map(([n]) => n);
    const words = new Set(list.filter(([, c]) => !c.impostor).map(([, c]) => c.word));
    check(imps.length === nImp, `${label}: ${nImp} impostor(es) entre ${list.length} (${imps.join(', ')})`);
    check(words.size === 1 && !![...words][0], `${label}: todos os outros têm a mesma palavra (${[...words].join(' / ')})`);
    const starters = list.filter(([, c]) => c.first === 'Você começa.').map(([n]) => n);
    check(starters.length === 1, `${label}: exatamente uma pessoa começa (${starters.join(', ')})`);
    const named = new Set(all.filter(([, c]) => c.first !== 'Você começa.').map(([, c]) => c.first));
    check(named.size === 1 && [...named][0] === `Quem começa: ${starters[0]}.`, `${label}: todos veem a mesma pessoa começando`);
    return { impostors: imps, word: [...words][0], judge: judges[0] ?? null };
  }

  async function snoop(room) {
    const seen = new Map();
    const c = mqtt.connect(s.brokerUrl);
    await new Promise((r) => c.on('connect', r));
    c.on('message', (topic, payload) => seen.set(topic, payload.toString()));
    await new Promise((r) => c.subscribe(`jogo-impostor/v1/${room}/#`, r));
    await sleep(500);
    c.end(true);
    return seen;
  }

  async function listen(room) {
    const seen = [];
    const c = mqtt.connect(s.brokerUrl);
    await new Promise((r) => c.on('connect', r));
    c.on('message', (topic, payload) => seen.push([topic, payload.toString()]));
    await new Promise((r) => c.subscribe(`jogo-impostor/v1/${room}/#`, r));
    return { seen, stop: () => c.end(true) };
  }

  const optionNames = (p) => p.page.$$eval('[data-act=vote] .nm', (els) => els.map((e) => e.textContent.trim()));

  async function vote(p, name) {
    const opt = await p.page.waitForFunction((n) => [...document.querySelectorAll('[data-act=vote]')]
      .find((b) => b.querySelector('.nm').textContent.trim() === n), {}, name);
    await opt.asElement().click();
    await p.page.waitForFunction((n) => [...document.querySelectorAll('[data-act=vote]')]
      .find((b) => b.querySelector('.nm').textContent.trim() === n)?.getAttribute('aria-checked') === 'true', {}, name);
  }

  const waitVoted = (p, done, total) =>
    p.page.waitForFunction((d, t) => {
      const el = document.querySelector('[data-progress]')?.textContent || '';
      return d === t ? el.includes('Todo mundo já votou') : el.includes(`${d} de ${t} votaram`);
    }, {}, done, total);

  async function verdictOf(p) {
    await p.page.waitForSelector('.screen--reveal');
    return p.page.$eval('[data-verdict]', (el) => ({ kind: el.dataset.verdict, text: el.textContent.trim() })).catch(() => null);
  }

  const tallyOf = (p) =>
    p.page.$$eval('[data-tally] .tally-row', (rows) => Object.fromEntries(rows.map((r) => [
      r.querySelector('.nm').textContent.replace(' (você)', '').trim(),
      parseInt(r.querySelector('.n-votes').textContent, 10),
    ])));

  async function finish(err) {
    if (err) {
      failures.push(`erro: ${err.message}`);
      console.error(err);
      await dumpScreens();
    }
    check(errors.length === 0, `sem erros de JavaScript nas páginas${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    await browser.close();
    await s.close();
    console.log(failures.length ? `\n${failures.length} falha(s).` : '\nTudo certo.');
    process.exit(failures.length ? 1 : 0);
  }

  return {
    s, browser, check, phone, shot, click, text, waitText, createRoom, join, waitCard, cards, checkRound,
    snoop, listen, optionNames, vote, waitVoted, verdictOf, tallyOf, finish,
  };
}
