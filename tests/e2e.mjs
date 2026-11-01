// Teste ponta a ponta: um anfitrião e vários jogadores, cada um num "celular" separado
// (contextos isolados do Chrome), conversando por um broker MQTT local.
//   npm install && npm test        (usa o Chrome instalado; ou defina CHROME_PATH)
import { existsSync, mkdirSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import puppeteer from 'puppeteer-core';
import mqtt from 'mqtt';
import { startServers } from './serve.mjs';

const SHOTS = new URL('./screens/', import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

const CHROME = process.env.CHROME_PATH || [
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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

async function phone(name) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${name}: ${m.text()}`);
  });
  page.setDefaultTimeout(10000);
  return { name, ctx, page };
}

const shot = (p, file, fullPage = false) => p.page.screenshot({ path: `${SHOTS}${file}.png`, fullPage });
const click = (p, sel) => p.page.click(sel);
const text = (p, sel) => p.page.$eval(sel, (el) => el.textContent.trim()).catch(() => null);
const waitText = (p, sel, value) =>
  p.page.waitForFunction((s, v) => document.querySelector(s)?.textContent.trim() === v, {}, sel, value);

async function join(p, invite) {
  await p.page.goto(invite);
  await p.page.waitForSelector('#nome');
  await p.page.waitForSelector('.slip--invite .slip-big'); // já enxerga a sala antes de entrar
  await p.page.type('#nome', p.name);
  await click(p, 'form[data-form=join] button[type=submit]');
  await p.page.waitForSelector('.screen--wait, .screen--reveal');
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
    first: document.querySelector('[data-first]')?.textContent.trim(),
  }));
}

async function cards(phones, n) {
  const out = {};
  for (const p of phones) out[p.name] = await waitCard(p, n);
  return out;
}

function checkRound(cs, nImp, label) {
  const list = Object.entries(cs);
  const imps = list.filter(([, c]) => c.impostor).map(([n]) => n);
  const words = new Set(list.filter(([, c]) => !c.impostor).map(([, c]) => c.word));
  check(imps.length === nImp, `${label}: ${nImp} impostor(es) entre ${list.length} (${imps.join(', ')})`);
  check(words.size === 1 && !![...words][0], `${label}: todos os outros têm a mesma palavra (${[...words].join(' / ')})`);
  const starters = list.filter(([, c]) => c.first === 'Você começa.').map(([n]) => n);
  check(starters.length === 1, `${label}: exatamente uma pessoa começa (${starters.join(', ')})`);
  const named = new Set(list.filter(([, c]) => c.first !== 'Você começa.').map(([, c]) => c.first));
  check(named.size === 1 && [...named][0] === `Quem começa: ${starters[0]}.`, `${label}: todos veem a mesma pessoa começando`);
  return { impostors: imps, word: [...words][0] };
}

// ---------- decifrar como "intruso" (só com a chave do QR code) ----------
const unb64u = (t) => Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
async function openWith(keyB64, payload) {
  const key = await webcrypto.subtle.importKey('raw', unb64u(keyB64), 'AES-GCM', false, ['decrypt']);
  const bytes = unb64u(payload);
  const pt = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12));
  return JSON.parse(Buffer.from(pt).toString());
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

const optionFor = (p, name) =>
  p.page.waitForFunction((n) => [...document.querySelectorAll('[data-act=vote]')]
    .find((b) => b.querySelector('.nm').textContent.trim() === n), {}, name);

async function vote(p, name) {
  await (await optionFor(p, name)).asElement().click();
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

try {
  console.log('\n1. Criar sala');
  const host = await phone('Lucas');
  await host.page.goto(s.appUrl);
  await shot(host, '01-inicio');
  await host.page.type('#nome', 'Lucas');
  await click(host, 'form[data-form=create] button[type=submit]');
  await host.page.waitForSelector('.slip--qr[data-invite] svg');
  const invite = await host.page.$eval('.slip--qr', (el) => el.dataset.invite);
  const hash = new URLSearchParams(new URL(invite).hash.slice(1));
  check(!!hash.get('r') && hash.get('k')?.length === 22, 'convite tem sala e chave no QR code');

  console.log('\n2. Jogadores entram pelo convite');
  const ana = await phone('Ana');
  await ana.page.goto(invite);
  await ana.page.waitForSelector('.slip--invite .slip-big');
  check((await text(ana, '.slip--invite .slip-big')) === 'Lucas', 'convidado vê de quem é a sala antes de entrar');
  await shot(ana, '02-convite');
  await ana.page.type('#nome', 'Ana');
  await click(ana, 'form[data-form=join] button[type=submit]');
  await ana.page.waitForSelector('.screen--wait');
  const bia = await phone('Bia');
  const caio = await phone('Caio');
  await join(bia, invite);
  await join(caio, invite);
  await waitText(host, '.screen--lobby .count', '4');
  check(true, 'anfitrião vê 4 pessoas na roda');
  await waitText(ana, '.screen--wait .count', '4');
  check(true, 'jogadores veem a roda atualizada');
  await shot(ana, '03-esperando');
  await shot(host, '04-sala', true);

  const all = [host, ana, bia, caio];

  console.log('\n3. Rodada 1');
  await click(host, '[data-act=start]');
  const r1 = checkRound(await cards(all, 1), 1, 'rodada 1');

  console.log('\n4. Privacidade');
  const room = hash.get('r');
  const msgs = await snoop(room);
  const raw = [...msgs.values()].join(' ');
  check(!raw.includes(r1.word), 'a palavra não aparece em texto puro no broker');
  const st = await openWith(hash.get('k'), msgs.get(`jogo-impostor/v1/${room}/s`));
  check(st.round && !st.round.word && !st.round.impostors, 'com a chave do QR dá pra ler a sala, mas não a palavra nem o impostor');
  const cardTopics = [...msgs.keys()].filter((t) => t.includes('/c/'));
  let leaked = 0;
  for (const t of cardTopics) {
    try { await openWith(hash.get('k'), msgs.get(t)); leaked++; } catch { /* esperado */ }
  }
  check(cardTopics.length === 3 && leaked === 0, `cartas dos ${cardTopics.length} jogadores não abrem com a chave da sala`);

  console.log('\n5. Segurar pra ver a carta');
  const civ = all.find((q) => !r1.impostors.includes(q.name));
  const imp = all.find((p) => p.name === r1.impostors[0]);
  for (const [p, file] of [[civ, '05-carta-palavra'], [imp, '06-carta-impostor']]) {
    const box = await p.page.$eval('[data-slip]', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (p === civ) await shot(p, '05-carta-fechada');
    await p.page.touchscreen.touchStart(box.x, box.y);
    await sleep(450);
    const open = await p.page.$eval('[data-slip]', (el) => el.classList.contains('is-open'));
    await shot(p, file);
    await p.page.touchscreen.touchEnd();
    await sleep(100);
    const closed = await p.page.$eval('[data-slip]', (el) => !el.classList.contains('is-open'));
    check(open && closed, `${p.name}: carta abre ao segurar e fecha ao soltar`);
  }

  console.log('\n6. Revelar sem votar');
  await click(host, '[data-act=reveal]');
  for (const p of all) {
    await p.page.waitForSelector('.screen--reveal [data-impostors]');
    const who = await text(p, '[data-impostors]');
    const expected = r1.impostors[0] === p.name ? 'você' : r1.impostors[0];
    check(who === expected && (await text(p, '[data-word]')) === r1.word, `${p.name} vê o impostor (${who}) e a palavra`);
  }
  check(!(await host.page.$('[data-verdict]')), 'sem votação, a revelação não mostra placar');
  await sleep(700);
  await shot(civ.name === 'Lucas' ? ana : civ, '07-revelacao');

  console.log('\n7. Rodada 2 e recarregar página');
  await click(host, '[data-act=start]');
  const c2 = await cards(all, 2);
  const r2 = checkRound(c2, 1, 'rodada 2');
  check(r2.word !== r1.word, 'palavra nova a cada rodada');
  await ana.page.reload();
  const anaAgain = await waitCard(ana, 2);
  check(anaAgain.word === c2.Ana.word && anaAgain.impostor === c2.Ana.impostor, 'jogador recarrega a página e recebe a mesma carta');
  await host.page.reload();
  await host.page.waitForSelector('.screen--round[data-round="2"] .face');
  check(true, 'anfitrião recarrega e volta pra rodada');

  console.log('\n8. Votação: a roda acerta');
  const k = hash.get('k');
  const spy = await listen(room);
  await click(host, '[data-act=vote-open]');
  for (const p of all) await p.page.waitForSelector('.screen--vote');
  check(true, 'todo mundo vai pra tela de votação');
  const imp2 = r2.impostors[0];
  const civs2 = all.filter((p) => p.name !== imp2);
  const [firstCiv, ...otherCivs] = civs2;
  check(!(await firstCiv.page.evaluate((me) => [...document.querySelectorAll('[data-act=vote] .nm')].some((n) => n.textContent.trim() === me), firstCiv.name)), 'ninguém pode votar em si mesmo');
  await vote(firstCiv, otherCivs[0].name);
  await vote(firstCiv, imp2); // mudou de ideia
  for (const p of otherCivs) await vote(p, imp2);
  const impPhone2 = all.find((p) => p.name === imp2);
  await vote(impPhone2, firstCiv.name);
  await waitVoted(host, 4, 4);
  check(true, 'anfitrião vê que todo mundo votou');
  const voteShot = civs2.find((p) => p !== host);
  await sleep(300);
  await shot(voteShot, '14-votacao');
  await shot(host, '14b-votacao-anfitriao');
  const reloader = otherCivs.find((p) => p !== host);
  await reloader.page.reload();
  await reloader.page.waitForFunction((n) => [...document.querySelectorAll('[data-act=vote]')]
    .find((b) => b.querySelector('.nm').textContent.trim() === n)?.getAttribute('aria-checked') === 'true', {}, imp2);
  check(true, `${reloader.name} recarrega no meio da votação e o voto continua marcado`);
  spy.stop();
  const lastState = [...spy.seen].reverse().find(([t, v]) => t.endsWith('/s') && v);
  const stV = await openWith(k, lastState[1]);
  check(stV.round.phase === 'voting' && stV.round.voted.length === 4 && !stV.round.votes, 'durante a votação dá pra ver quem votou, mas não em quem');
  let voteMsgs = 0;
  let readable = 0;
  for (const [t, v] of spy.seen) {
    if (!t.endsWith('/j') || !v) continue;
    const m = await openWith(k, v).catch(() => null);
    if (m?.t !== 'vote') continue;
    voteMsgs++;
    if (m.target) readable++;
    try { await openWith(k, m.box); readable++; } catch { /* esperado */ }
  }
  check(voteMsgs >= 3 && readable === 0, `os ${voteMsgs} votos enviados não abrem com a chave da sala`);
  await click(host, '[data-act=reveal]');
  for (const p of all) {
    const v = await verdictOf(p);
    const expected = p.name === imp2 ? 'Pegaram você!' : 'A roda acertou!';
    check(v?.kind === 'caught' && v.text === expected, `${p.name} vê "${v?.text}"`);
  }
  const t2 = await tallyOf(host);
  check(t2[imp2] === 3 && t2[firstCiv.name] === 1, `placar certo (${JSON.stringify(t2)})`);
  await sleep(800);
  await shot(voteShot, '15-resultado', true);
  await shot(impPhone2, '15b-resultado-impostor');

  await click(host, '[data-act=start]');
  const c3 = await cards(all, 3);
  checkRound(c3, 1, 'rodada 3 (depois de o anfitrião recarregar)');

  console.log('\n9. Tirar alguém da roda e entrar de novo');
  await click(host, '[data-act=lobby]');
  await host.page.waitForSelector('.screen--lobby');
  const caioId = await host.page.$$eval('[data-act=kick]', (els, name) => els.find((e) => e.getAttribute('aria-label').includes(name))?.dataset.id, 'Caio');
  await click(host, `[data-act=kick][data-id="${caioId}"]`);
  await host.page.waitForSelector('#dlg[open] [data-ret=yes]');
  await sleep(450);
  await shot(host, '08-confirmar-tirar');
  await click(host, '#dlg [data-ret=yes]');
  await waitText(host, '.screen--lobby .count', '3');
  await caio.page.waitForFunction(() => document.querySelector('.slip-big')?.textContent.includes('Você saiu da roda'));
  check(true, 'Caio é avisado que saiu da roda');
  await sleep(300);
  await shot(caio, '09-tirado');
  await click(caio, '[data-act=rejoin]');
  await waitText(host, '.screen--lobby .count', '4');
  const caioBack = await waitCard(caio, 3);
  check(caioBack.word === c3.Caio.word && caioBack.impostor === c3.Caio.impostor, 'Caio volta na mesma rodada com a mesma carta');

  console.log('\n10. Chegou atrasado');
  const dani = await phone('Dani');
  const edu = await phone('Edu');
  await join(dani, invite);
  check((await text(dani, '[data-wait]'))?.startsWith('A rodada já começou'), 'quem chega no meio da rodada espera a próxima');
  await shot(dani, '10-chegou-atrasado');

  console.log('\n11. Votação empatada; quem chegou atrasado não vota');
  await click(host, '[data-act=round]');
  await host.page.waitForSelector('.screen--round[data-round="3"]');
  await click(host, '[data-act=vote-open]');
  for (const p of all) await p.page.waitForSelector('.screen--vote');
  await dani.page.waitForFunction(() => document.querySelector('[data-wait]')?.textContent.startsWith('A rodada está na votação'));
  check(true, 'quem chegou no meio não vota e espera a próxima');
  check(!(await host.page.evaluate(() => [...document.querySelectorAll('[data-act=vote] .nm')].some((n) => n.textContent.trim() === 'Dani'))), 'quem chegou no meio não aparece como opção de voto');
  await vote(host, 'Ana');
  await vote(ana, 'Lucas');
  await vote(bia, 'Lucas');
  await vote(caio, 'Ana');
  await waitVoted(host, 4, 4);
  await click(host, '[data-act=reveal]');
  for (const p of all) {
    const v = await verdictOf(p);
    check(v?.kind === 'tie', `${p.name} vê o empate ("${v?.text}")`);
  }
  await sleep(800);
  await shot(dani, '16-empate-visto-por-quem-chegou', true);
  await click(host, '[data-act=lobby]');
  await host.page.waitForSelector('.screen--lobby');

  console.log('\n12. Seis pessoas e dois impostores');
  await join(edu, invite);
  await waitText(host, '.screen--lobby .count', '6');
  await click(host, '[data-act=imp][data-d="1"]');
  await waitText(host, '.stepper output', '2');
  await shot(host, '10-sala-6-pessoas', true);
  await shot(host, '10b-sala-topo');
  await click(host, '[data-act=start]');
  const everyone = [host, ana, bia, caio, dani, edu];
  const c4 = await cards(everyone, 4);
  checkRound(c4, 2, 'rodada 4 com 6 pessoas');
  check(Object.values(c4).filter((c) => c.impostor).every((c) => c.impText === 'Você é um dos impostores'), 'com 2 impostores, a carta diz "um dos impostores"');

  console.log('\n13. Votação: os impostores enganam a roda');
  await click(host, '[data-act=vote-open]');
  for (const p of everyone) await p.page.waitForSelector('.screen--vote');
  const imps4 = Object.entries(c4).filter(([, c]) => c.impostor).map(([n]) => n);
  const innocents = everyone.filter((p) => !imps4.includes(p.name)).map((p) => p.name);
  const [X, Y] = innocents;
  for (const p of everyone) await vote(p, p.name === X ? Y : X);
  await waitVoted(host, 6, 6);
  await click(host, '[data-act=reveal]');
  for (const p of everyone) {
    const v = await verdictOf(p);
    const expected = imps4.includes(p.name) ? 'Você enganou a roda!' : 'Os impostores enganaram a roda!';
    check(v?.kind === 'missed' && v.text === expected, `${p.name} vê "${v?.text}"`);
  }
  const t4 = await tallyOf(host);
  check(t4[X] === 5 && t4[Y] === 1, `placar com 6 pessoas (${JSON.stringify(t4)})`);

  console.log('\n14. Sair da sala e encerrar');
  await click(edu, '[data-act=menu]');
  await edu.page.waitForSelector('#dlg[open] [data-ret=leave]');
  await sleep(450);
  await shot(edu, '11-menu-jogador');
  await click(edu, '#dlg [data-ret=leave]');
  await edu.page.waitForSelector('#dlg[open] [data-ret=yes]');
  await click(edu, '#dlg [data-ret=yes]');
  await edu.page.waitForSelector('form[data-form=create]');
  await click(host, '[data-act=lobby]');
  await waitText(host, '.screen--lobby .count', '5');
  check(true, 'quem sai pelo menu some da roda do anfitrião');

  await click(host, '[data-act=menu]');
  await host.page.waitForSelector('#dlg[open] [data-ret=rules]');
  await click(host, '#dlg [data-ret=rules]');
  await host.page.waitForSelector('#dlg[open] .rules');
  await sleep(450);
  await shot(host, '12-como-jogar');
  await click(host, '#dlg [data-ret=ok]');
  await sleep(200);
  await click(host, '[data-act=menu]');
  await host.page.waitForSelector('#dlg[open] [data-ret=end]');
  await click(host, '#dlg [data-ret=end]');
  await host.page.waitForSelector('#dlg[open] [data-ret=yes]');
  await click(host, '#dlg [data-ret=yes]');
  await host.page.waitForSelector('form[data-form=create]');
  for (const p of [ana, bia, caio, dani]) {
    await p.page.waitForFunction(() => document.querySelector('.slip-big')?.textContent.includes('A sala foi encerrada'));
  }
  check(true, 'todo mundo vê que a sala foi encerrada');
  await shot(ana, '13-encerrada');
} catch (err) {
  failures.push(`erro: ${err.message}`);
  console.error(err);
} finally {
  check(errors.length === 0, `sem erros de JavaScript nas páginas${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await browser.close();
  await s.close();
  console.log(failures.length ? `\n${failures.length} falha(s).` : '\nTudo certo.');
  process.exit(failures.length ? 1 : 0);
}
