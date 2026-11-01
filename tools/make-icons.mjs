// Gera os ícones do app (PNG) desenhando um papelzinho com "?" no Chrome.
//   node tools/make-icons.mjs   (precisa do Chrome; ou defina CHROME_PATH)
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHROME = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));

const font = `data:font/woff2;base64,${readFileSync(`${ROOT}fonts/shantell-sans.woff2`).toString('base64')}`;

// slip: tamanho do papel em relação ao ícone; radius: canto do fundo (0 = quadrado)
function html({ slip = 0.66, radius = 0.22 } = {}) {
  return `<!doctype html><html><head><style>
  @font-face { font-family: Shantell; src: url(${font}); font-weight: 300 800; }
  html, body { margin: 0; width: 100vw; height: 100vh; background: transparent; overflow: hidden; }
  .bg { position: absolute; inset: 0; background: #1a2580; border-radius: ${radius * 100}vw; }
  .slip {
    position: absolute; left: 50%; top: 50%;
    width: ${slip * 100}vw; height: ${slip * 76}vw;
    transform: translate(-50%, -50%) rotate(-7deg);
    border-radius: 1.2vw;
    background:
      linear-gradient(90deg, transparent 19%, #ee8f84 19%, #ee8f84 calc(19% + 0.9vw), transparent calc(19% + 0.9vw)),
      repeating-linear-gradient(180deg, transparent 0, transparent ${slip * 15.5}vw, #c3d3ef ${slip * 15.5}vw, #c3d3ef ${slip * 15.5 + 0.8}vw),
      #fbf9f1;
    background-position: 0 0, 0 ${slip * 7}vw, 0 0;
    box-shadow: 0 3vw 5vw rgba(6, 10, 48, 0.45);
  }
  .q {
    position: absolute; left: 56%; top: 50%;
    transform: translate(-50%, -52%) rotate(9deg);
    font: 800 ${slip * 82}vw/1 Shantell; font-variation-settings: 'INFM' 100, 'BNCE' 30;
    color: #d02a1e;
  }
  </style></head><body><div class="bg"></div><div class="slip"><span class="q">?</span></div></body></html>`;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();

async function render(file, size, opts) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(html(opts), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${ROOT}icons/${file}`, omitBackground: true });
}

await render('icon-512.png', 512);
await render('icon-192.png', 192);
await render('icon-maskable-512.png', 512, { slip: 0.54, radius: 0 }); // cabe na área segura
await render('apple-touch-icon.png', 180, { radius: 0 });
await render('favicon-32.png', 32, { slip: 0.8, radius: 0.2 });
await browser.close();
console.log('ícones gerados em icons/');
