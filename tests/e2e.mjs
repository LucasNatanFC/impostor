// Teste ponta a ponta do jogo: um anfitrião e vários jogadores, cada um num "celular"
// separado, conversando por um broker MQTT local.
//   npm install && npm test        (usa o Chrome instalado; ou defina CHROME_PATH)
import { setup, openWith, sleep } from './lib.mjs';
import { poolFor } from '../words.js';

const inPool = (word, cat, level) => poolFor(cat, level).some((w) => w.word === word);

const {
  check, phone, shot, click, text, waitText, join, waitCard, cards, checkRound,
  snoop, listen, vote, waitVoted, verdictOf, tallyOf, finish, s,
} = await setup();

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
  check(inPool(r1.word, 'tudo', 'medio'), `sem mexer nos ajustes, a palavra é do nível médio (${r1.word})`);

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
  check(stV.round.phase === 'voting' && Object.keys(stV.round.voted).length === 4 && !stV.round.votes, 'durante a votação dá pra ver quem votou, mas não em quem');
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
  await click(host, '[data-act=cat][data-cat=animais]');
  await click(host, '[data-act=level][data-level=impossivel]');
  await waitText(host, '[data-level-note]', 'Ideias abstratas e coisas raras. Boa sorte.');
  check(await host.page.$eval('[data-act=level][data-level=impossivel]', (b) => b.getAttribute('aria-pressed') === 'true'), 'dá pra escolher a dificuldade "Impossível"');
  await waitText(host, '.stepper output', '2');
  await shot(host, '10-sala-6-pessoas', true);
  await shot(host, '10b-sala-topo');
  await click(host, '[data-act=start]');
  const everyone = [host, ana, bia, caio, dani, edu];
  const c4 = await cards(everyone, 4);
  const r4 = checkRound(c4, 2, 'rodada 4 com 6 pessoas');
  check(inPool(r4.word, 'animais', 'impossivel'), `a palavra é de Animais, nível impossível (${r4.word})`);
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
  check(t4[X] === 5 && t4[Y] === 1, `placar com 6 pessoas, cada um circulando só 1 nome (${JSON.stringify(t4)})`);

  console.log('\n13b. Voto em mais de um com 2 impostores');
  const optState = (p) => p.page.$$eval('[data-act=vote]', (els) => Object.fromEntries(els.map((b) => [
    b.querySelector('.nm').textContent.trim(),
    b.getAttribute('aria-checked') === 'true' ? 'on' : b.getAttribute('aria-disabled') === 'true' ? 'off' : '',
  ])));
  async function unvote(p, name) {
    const opt = await p.page.waitForFunction((n) => [...document.querySelectorAll('[data-act=vote]')]
      .find((b) => b.querySelector('.nm').textContent.trim() === n), {}, name);
    await opt.asElement().click();
    await p.page.waitForFunction((n) => [...document.querySelectorAll('[data-act=vote]')]
      .find((b) => b.querySelector('.nm').textContent.trim() === n)?.getAttribute('aria-checked') === 'false', {}, name);
  }
  const voteMany = async (p, names) => { for (const n of names) await vote(p, n); };

  await click(host, '[data-act=start]');
  const c5 = await cards(everyone, 5);
  const r5 = checkRound(c5, 2, 'rodada 5');
  const [P1, P2] = r5.impostors;
  const inn5 = everyone.filter((p) => !r5.impostors.includes(p.name)).map((p) => p.name);
  const civ5 = everyone.find((p) => p !== host && inn5.includes(p.name));
  check((await text(civ5, '[data-imp-count]')) === 'Nesta rodada são 2 impostores. Na votação, dá pra circular até 2 nomes.', 'a rodada avisa que são 2 impostores');
  await click(host, '[data-act=vote-open]');
  for (const p of everyone) await p.page.waitForSelector('.screen--vote');
  check((await text(civ5, '.vote-q')) === 'Quem são os impostores?' && (await text(civ5, '[data-myvote]')) === 'Circule até 2 nomes.', 'a votação pede até 2 nomes');
  const others5 = everyone.filter((p) => p !== civ5).map((p) => p.name);
  await vote(civ5, others5[0]);
  check((await text(civ5, '[data-progress]'))?.startsWith('Dá pra circular mais 1.'), 'depois de 1 nome, avisa que dá pra circular mais 1');
  await vote(civ5, others5[1]);
  const full = await optState(civ5);
  check(full[others5[0]] === 'on' && full[others5[1]] === 'on' && others5.slice(2).every((n) => full[n] === 'off'), 'com 2 circulados, os outros nomes ficam bloqueados');
  await civ5.page.evaluate((n) => [...document.querySelectorAll('[data-act=vote]')].find((b) => b.querySelector('.nm').textContent.trim() === n).click(), others5[2]);
  await sleep(300);
  check((await optState(civ5))[others5[2]] === 'off', 'tocar num terceiro nome não faz nada');
  await sleep(300);
  await shot(civ5, '17-voto-multiplo');
  await unvote(civ5, others5[0]);
  check((await optState(civ5))[others5[2]] === '', 'desmarcar um nome libera os outros de novo');
  await unvote(civ5, others5[1]);
  await waitVoted(host, 0, 6);
  check(true, 'quem desmarca tudo volta a contar como "não votou"');

  // Rodada 5: a roda pega só um dos dois.
  const [I1, I2] = inn5;
  for (const p of everyone) {
    if (p.name === P1 || p.name === P2) await voteMany(p, [I1, I2]);
    else await voteMany(p, p.name === I1 ? [P1, I2] : [P1, I1]);
  }
  await waitVoted(host, 6, 6);
  await click(host, '[data-act=reveal]');
  for (const p of everyone) {
    const v = await verdictOf(p);
    const expected = p.name === P1 ? 'Pegaram você!' : p.name === P2 ? 'Você escapou!' : 'A roda pegou 1 de 2 impostores.';
    check(v?.kind === 'partial' && v.text === expected, `${p.name} vê "${v?.text}"`);
  }
  const t5 = await tallyOf(host);
  check(t5[P1] === 4 && t5[I1] === 5 && t5[I2] === 3, `cada nome circulado conta 1 voto (${JSON.stringify(t5)})`);
  await sleep(800);
  await shot(civ5, '18-resultado-parcial', true);

  // Rodada 6: a roda pega os dois.
  await click(host, '[data-act=start]');
  const c6 = await cards(everyone, 6);
  const r6 = checkRound(c6, 2, 'rodada 6');
  const inn6 = everyone.filter((p) => !r6.impostors.includes(p.name)).map((p) => p.name);
  await click(host, '[data-act=vote-open]');
  for (const p of everyone) await p.page.waitForSelector('.screen--vote');
  for (const p of everyone) {
    if (r6.impostors.includes(p.name)) await voteMany(p, [p.name === r6.impostors[0] ? inn6[0] : inn6[1]]);
    else await voteMany(p, r6.impostors);
  }
  await waitVoted(host, 6, 6);
  await click(host, '[data-act=reveal]');
  for (const p of everyone) {
    const v = await verdictOf(p);
    const expected = r6.impostors.includes(p.name) ? 'Pegaram você!' : 'A roda pegou os impostores!';
    check(v?.kind === 'caught' && v.text === expected, `${p.name} vê "${v?.text}"`);
  }

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
  await finish();
} catch (err) {
  await finish(err);
}
