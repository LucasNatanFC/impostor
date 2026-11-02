// Teste ponta a ponta do modo juiz: a cada rodada alguém é sorteado, escreve a palavra
// e fica de fora (não recebe palavra, não vota, mas sabe quem é o impostor).
//   npm install && npm test
import { setup, openWith, sleep } from './lib.mjs';
import { poolFor } from '../words.js';

const {
  check, phone, shot, click, text, waitText, createRoom, join, waitCard, cards, checkRound,
  listen, optionNames, vote, waitVoted, verdictOf, tallyOf, finish,
} = await setup();

// Espera a rodada n ter um juiz definido em todos os celulares: só ele vê o formulário,
// e todos os outros veem o nome dele. `not` = nome de quem não pode mais ser o juiz.
async function currentJudge(phones, n, not = null) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const views = await Promise.all(phones.map((p) => p.page.evaluate((n) => {
      if (document.querySelector(`.screen--judge[data-round="${n}"] form[data-form=judge]`)) return { me: true };
      const other = document.querySelector(`.screen--choosing[data-round="${n}"] [data-judge]`);
      return other ? { name: other.textContent.trim() } : null;
    }, n)));
    const mine = phones.filter((_, i) => views[i]?.me);
    if (mine.length === 1 && mine[0].name !== not && views.every((v) => v && (v.me || v.name === mine[0].name))) {
      return mine[0];
    }
    await sleep(150);
  }
  throw new Error(`o juiz da rodada ${n} não ficou definido`);
}

async function holdSlip(p, file) {
  const box = await p.page.$eval('[data-slip]', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.page.touchscreen.touchStart(box.x, box.y);
  await sleep(450);
  await shot(p, file);
  await p.page.touchscreen.touchEnd();
}

try {
  console.log('\n1. Sala com juiz');
  const host = await phone('Lucas');
  const invite = await createRoom(host);
  const hash = new URLSearchParams(new URL(invite).hash.slice(1));
  const room = hash.get('r');
  const key = hash.get('k');
  const ana = await phone('Ana');
  const bia = await phone('Bia');
  await join(ana, invite);
  await join(bia, invite);
  await waitText(host, '.screen--lobby .count', '3');
  await click(host, 'input[data-act=judge]');
  await waitText(host, '.actions--sticky .btn-primary', 'Falta 1 pessoa');
  check(true, 'com juiz, 3 pessoas não bastam: "Falta 1 pessoa"');
  const caio = await phone('Caio');
  const dani = await phone('Dani');
  await join(caio, invite);
  await join(dani, invite);
  await waitText(host, '.screen--lobby .count', '5');
  await host.page.waitForSelector('.actions--sticky [data-act=start]');
  check(true, 'com 5 pessoas dá pra começar');
  await shot(host, '20-sala-com-juiz', true);
  const all = [host, ana, bia, caio, dani];
  let hostWasJudge = false;

  console.log('\n2. Rodada 1: o juiz escreve a palavra');
  const spy = await listen(room);
  await click(host, '[data-act=start]');
  const j1 = await currentJudge(all, 1);
  hostWasJudge ||= j1 === host;
  check(true, `${j1.name} foi sorteado juiz e todo mundo vê o nome`);
  const watcher = all.find((p) => p !== j1 && p !== host);
  await shot(watcher, '21-escolhendo');
  if (j1 !== host) await shot(host, '21b-anfitriao-esperando-juiz');
  await shot(j1, '22-juiz-escreve');
  await j1.page.type('#palavra', '  torre   Eiffel ');
  await j1.page.type('#tema', 'Lugares');
  await click(j1, 'form[data-form=judge] button[type=submit]');
  const c1 = await cards(all, 1);
  const r1 = checkRound(c1, 1, 'rodada 1 com juiz');
  const imp1 = r1.impostors[0];
  check(r1.judge === j1.name, 'o juiz recebe a carta de juiz, não uma palavra');
  check(r1.word === 'Torre Eiffel', 'os outros recebem a palavra do juiz, arrumada ("Torre Eiffel")');
  check(c1[imp1].hint === 'Tema: Lugares', 'o impostor recebe o tema que o juiz escreveu');
  check(c1[j1.name].judgeWord === 'Torre Eiffel' && c1[j1.name].judgeImps === imp1, `o juiz vê a palavra e o impostor (${c1[j1.name].judgeImps})`);
  check(c1[j1.name].first !== 'Você começa.', 'o juiz não é quem começa');
  spy.stop();
  const raw = spy.seen.map(([, v]) => v).join(' ');
  let wordMsgs = 0;
  let readable = 0;
  for (const [t, v] of spy.seen) {
    if (!t.endsWith('/j') || !v) continue;
    const m = await openWith(key, v).catch(() => null);
    if (m?.t !== 'word') continue;
    wordMsgs++;
    if (m.word) readable++;
    try { await openWith(key, m.box); readable++; } catch { /* esperado */ }
  }
  check(!raw.includes('Eiffel') && readable === 0 && (j1 === host || wordMsgs >= 1),
    j1 === host ? 'a palavra do anfitrião-juiz nem passa pela rede' : 'a palavra do juiz vai cifrada e não abre com a chave da sala');
  await holdSlip(j1, '23-juiz-carta');
  await waitText(watcher, '[data-judge-note]', `${j1.name} é o juiz e está fora desta rodada.`);
  check(true, 'os outros sabem quem é o juiz');
  await shot(watcher, '24-rodada-com-juiz');

  console.log('\n3. Votação sem o juiz');
  await click(host, '[data-act=vote-open]');
  for (const p of all) await p.page.waitForSelector('.screen--vote');
  check((await optionNames(j1)).length === 0 && !!(await j1.page.$('[data-judge-novote]')), 'o juiz não tem em quem votar');
  const players1 = all.filter((p) => p !== j1);
  const optsOk = [];
  for (const p of players1) {
    const opts = await optionNames(p);
    optsOk.push(opts.length === 3 && !opts.includes(j1.name) && !opts.includes(p.name));
  }
  check(optsOk.every(Boolean), 'ninguém pode votar no juiz (nem em si mesmo)');
  const scapegoat = players1.find((p) => p.name !== imp1).name;
  for (const p of players1) await vote(p, p.name === imp1 ? scapegoat : imp1);
  await waitVoted(host, 4, 4);
  check(true, 'a contagem de votos não espera o juiz (4 de 4)');
  await waitVoted(j1, 4, 4);
  check(true, 'o juiz acompanha quem já votou');
  await shot(j1, '25-juiz-na-votacao');
  await click(host, '[data-act=reveal]');
  for (const p of all) {
    const v = await verdictOf(p);
    if (v?.kind !== 'caught') check(false, `${p.name} devia ver que a roda acertou (viu "${v?.text}")`);
  }
  check(true, 'todo mundo vê que a roda acertou');
  check((await text(watcher, '[data-chosen-by]')) === `escolhida por ${j1.name}` && (await text(j1, '[data-chosen-by]')) === 'escolhida por você',
    'a revelação mostra quem escolheu a palavra');
  const t1 = await tallyOf(host);
  check(t1[imp1] === 3 && t1[scapegoat] === 1 && !(j1.name in t1), `placar sem o juiz (${JSON.stringify(t1)})`);
  await sleep(800);
  await shot(watcher, '26-revelacao-com-juiz', true);

  console.log('\n4. Rodízio, sortear outro juiz, passar a vez e sugestão');
  await click(host, '[data-act=start]');
  let j2 = await currentJudge(all, 2);
  check(j2 !== j1, `o juiz da rodada 2 é outra pessoa (${j2.name})`);
  const firstJ2 = j2;
  await click(host, j2 === host ? '[data-act=judge-pass]' : '[data-act=judge-redraw]');
  j2 = await currentJudge(all, 2, j2.name);
  check(j2 !== firstJ2 && j2 !== j1, `sortear outro juiz troca a pessoa, sem repetir quem já foi (${j2.name})`);
  for (let i = 0; i < 20 && j2 === host; i++) {
    await click(host, '[data-act=judge-pass]');
    j2 = await currentJudge(all, 2, j2.name);
  }
  const passer = j2;
  await click(passer, '[data-act=judge-pass]');
  j2 = await currentJudge(all, 2, passer.name);
  check(j2 !== passer && j2 !== j1, `o juiz pode passar a vez pra outra pessoa (${passer.name} passou, ${j2.name} assumiu)`);
  hostWasJudge ||= j2 === host;
  await click(j2, '[data-act=suggest]');
  const suggested = await j2.page.$eval('#palavra', (el) => el.value);
  const theme = await j2.page.$eval('#tema', (el) => el.value);
  check(!!suggested && !!theme, `"Sugerir uma palavra" preenche a palavra e o tema (${suggested} / ${theme})`);
  check(poolFor('tudo', 'medio').some((w) => w.word === suggested), 'a sugestão respeita a dificuldade escolhida (médio)');
  await shot(j2, '27-juiz-sugestao');
  await click(j2, 'form[data-form=judge] button[type=submit]');
  const c2 = await cards(all, 2);
  const r2 = checkRound(c2, 1, 'rodada 2 com palavra sugerida');
  check(r2.word === suggested && c2[r2.impostors[0]].hint === `Tema: ${theme}`, 'a palavra e o tema sugeridos chegam na roda');
  if (j2 !== host) {
    await j2.page.reload();
    const again = await waitCard(j2, 2);
    check(again.judge && again.judgeWord === suggested, 'o juiz recarrega a página e continua com a carta de juiz');
  }
  await click(host, '[data-act=reveal]');
  for (const p of all) await p.page.waitForSelector('.screen--reveal [data-chosen-by]');
  check(!(await host.page.$('[data-verdict]')), 'revelar sem votar também funciona com juiz');

  console.log('\n5. Anfitrião como juiz');
  await click(host, '[data-act=start]');
  let j3 = await currentJudge(all, 3);
  if (!hostWasJudge) {
    for (let i = 0; i < 20 && j3 !== host; i++) {
      await click(host, '[data-act=judge-redraw]');
      j3 = await currentJudge(all, 3, j3.name);
    }
    check(j3 === host, 'o anfitrião também pode ser o juiz');
  } else {
    check(true, 'o anfitrião já foi juiz numa rodada anterior');
  }
  await j3.page.type('#palavra', 'pão de queijo');
  await j3.page.type('#tema', 'Comida');
  await click(j3, 'form[data-form=judge] button[type=submit]');
  const c3 = await cards(all, 3);
  const r3 = checkRound(c3, 1, `rodada 3 com ${j3.name} de juiz`);
  check(r3.judge === j3.name && r3.word === 'Pão de queijo', 'a palavra do juiz chega pra todo mundo');
  await click(host, '[data-act=vote-open]');
  for (const p of all) await p.page.waitForSelector('.screen--vote');
  const players3 = all.filter((p) => p !== j3);
  const innocents = players3.filter((p) => !r3.impostors.includes(p.name)).map((p) => p.name);
  const [X, Y] = innocents;
  for (const p of players3) await vote(p, p.name === X ? Y : X);
  await waitVoted(host, 4, 4);
  await click(host, '[data-act=reveal]');
  for (const p of all) {
    const v = await verdictOf(p);
    if (v?.kind !== 'missed') check(false, `${p.name} devia ver que o impostor enganou a roda (viu "${v?.text}")`);
  }
  check(true, 'quando a roda erra, todo mundo vê que o impostor enganou a roda');

  console.log('\n6. Tirar o juiz enquanto ele escolhe; quem volta entra na rodada');
  await click(host, '[data-act=start]');
  let j4 = await currentJudge(all, 4);
  for (let i = 0; i < 20 && j4 === host; i++) {
    await click(host, '[data-act=judge-pass]');
    j4 = await currentJudge(all, 4, j4.name);
  }
  await click(host, '[data-act=lobby]');
  await host.page.waitForSelector('.screen--lobby');
  const kickId = await host.page.$$eval('[data-act=kick]', (els, name) => els.find((e) => e.getAttribute('aria-label').includes(name))?.dataset.id, j4.name);
  await click(host, `[data-act=kick][data-id="${kickId}"]`);
  await host.page.waitForSelector('#dlg[open] [data-ret=yes]');
  await click(host, '#dlg [data-ret=yes]');
  await waitText(host, '.screen--lobby .count', '4');
  await click(host, '[data-act=round]');
  const rest = all.filter((p) => p !== j4);
  const j4b = await currentJudge(rest, 4, j4.name);
  check(true, `tirar o juiz sorteia outro na hora (${j4b.name})`);
  await j4.page.waitForFunction(() => document.querySelector('.slip-big')?.textContent.includes('Você saiu da roda'));
  await click(j4, '[data-act=rejoin]');
  await waitText(j4, '.screen--choosing [data-judge]', j4b.name);
  check(true, `${j4.name} volta e espera o juiz escolher`);
  await j4b.page.type('#palavra', 'Capivara');
  await click(j4b, 'form[data-form=judge] button[type=submit]');
  const c4 = await cards(all, 4);
  checkRound(c4, 1, 'rodada 4');
  check(!c4[j4.name].judge && (c4[j4.name].word === 'Capivara' || c4[j4.name].impostor), `${j4.name} voltou a tempo e joga a rodada`);
  check(Object.values(c4).filter((c) => c.impostor).every((c) => !c.hint), 'sem tema escrito, o impostor fica sem dica');

  console.log('\n7. Desligar o juiz');
  await click(host, '[data-act=reveal]');
  await host.page.waitForSelector('.screen--reveal');
  await click(host, '[data-act=lobby]');
  await click(host, 'input[data-act=judge]');
  await host.page.waitForFunction(() => !document.querySelector('input[data-act=judge]').checked);
  await click(host, '[data-act=start]');
  const c5 = await cards(all, 5);
  const r5 = checkRound(c5, 1, 'rodada 5 sem juiz');
  check(!r5.judge && Object.keys(c5).length === 5, 'sem juiz, todo mundo joga de novo');

  await finish();
} catch (err) {
  await finish(err);
}
