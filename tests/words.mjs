// Confere a lista de palavras: cada tema tem os 4 níveis, com pelo menos 20 palavras em cada,
// sem palavra repetida dentro do mesmo tema e sem espaços sobrando.
import { CATEGORIES, LEVELS, poolFor, ALL } from '../words.js';

const MIN = 20;
let fails = 0;
const fail = (msg) => {
  fails++;
  console.log(`  ✗ ${msg}`);
};

console.log('\nPalavras por tema e nível');
let total = 0;
for (const c of CATEGORIES) {
  const seen = new Map();
  const counts = [];
  for (const { id } of LEVELS) {
    const list = c.words[id];
    if (!Array.isArray(list)) {
      fail(`${c.label}: falta o nível ${id}`);
      continue;
    }
    if (list.length < MIN) fail(`${c.label} / ${id}: só ${list.length} palavras (mínimo ${MIN})`);
    for (const w of list) {
      if (w !== w.trim() || /\s{2,}/.test(w) || !w) fail(`${c.label} / ${id}: palavra mal escrita "${w}"`);
      const k = w.toLocaleLowerCase('pt-BR');
      if (seen.has(k)) fail(`${c.label}: "${w}" aparece em ${seen.get(k)} e em ${id}`);
      seen.set(k, id);
    }
    counts.push(`${id} ${list.length}`);
    total += list.length;
  }
  console.log(`  ${c.label}: ${counts.join(', ')}`);
}
for (const { id } of LEVELS) console.log(`  Tudo / ${id}: ${poolFor(ALL.id, id).length} palavras diferentes`);
console.log(`  Total: ${total} palavras`);
console.log(fails ? `\n${fails} falha(s).` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
