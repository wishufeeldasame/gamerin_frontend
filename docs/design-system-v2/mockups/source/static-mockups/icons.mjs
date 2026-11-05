// 사용법: node icons.mjs <lucide-react 패키지 디렉터리>  (package-lock.json의 lucide-react 1.8.0 기준)
const LUCIDE = process.argv[2];
import { readFileSync, writeFileSync } from 'node:fs';
const names = ['log-out','upload','flame','plus','chevron-right','clapperboard','eye','users','star','house','search','bell','message-square','book-open','bookmark','wallet-cards','user','settings','heart','message-circle','repeat-2','share','chart-no-axes-column','play','pin','map-pin','link','calendar-days','arrow-left','image-plus','video','hash','ellipsis','gamepad-2','badge-check','square-pen','smile','mail','sparkles','trophy','crosshair'];
const out = {};
for (const n of names) {
  const src = readFileSync(LUCIDE + '/dist/esm/icons/' + n + '.js', 'utf8');
  const m = src.match(/const __iconNode = (\[[\s\S]*?\]);\n/);
  const arr = eval(m[1]);
  out[n] = arr.map(([tag, attrs]) => '<' + tag + ' ' + Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => k + '="' + v + '"').join(' ') + '/>').join('');
}
writeFileSync(new URL('./icons.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out).length);
