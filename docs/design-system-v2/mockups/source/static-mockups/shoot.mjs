import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIR = new URL('.', import.meta.url).pathname;
// 사용법: node shoot.mjs <출력 디렉터리> <페이지 이름...>  예) node shoot.mjs out feed4 profile4
const [out, ...pages] = process.argv.slice(2);
// 설치된 Playwright와 브라우저 버전이 다르면 CHROMIUM_PATH로 실행 파일을 지정한다.
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const [name, w, h] of pages.flatMap(n => [[n, 1440, 1400], [n, 390, 844]])) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.goto('file://' + DIR + name + '.html');
  await page.evaluate(() => document.fonts.ready);
  const fam = await page.evaluate(() => document.fonts.check('16px "Noto Sans KR"'));
  await page.screenshot({ path: `${out}/${name}-${w > 500 ? 'desktop' : 'mobile'}.png` });
  console.log(name, w, 'font loaded:', fam);
  await page.close();
}
await browser.close();
