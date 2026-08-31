/* Walk lightness within the same hue until the ratio clears, so a failing
   value is corrected rather than replaced with a different colour. */
const { ratio } = require('./contrast.js');

function hexToRgb(h){h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
function rgbToHex(r){return '#'+r.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase();}
function rgbToHsl([r,g,b]){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h,s,l=(mx+mn)/2;
  if(mx===mn){h=s=0;}else{const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);
    switch(mx){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h/=6;}
  return [h*360,s*100,l*100];}
function hslToRgb([h,s,l]){h/=360;s/=100;l/=100;
  if(s===0){const v=l*255;return [v,v,v];}
  const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
  const f=t=>{if(t<0)t+=1;if(t>1)t-=1;
    if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p;};
  return [f(h+1/3)*255,f(h)*255,f(h-1/3)*255];}

function solve(hex, bgs, min, dir) {
  const hsl = rgbToHsl(hexToRgb(hex));
  for (let step = 0; step <= 600; step++) {
    const l = hsl[2] + dir * step * 0.1;
    if (l < 0 || l > 100) break;
    const cand = rgbToHex(hslToRgb([hsl[0], hsl[1], l]));
    if (bgs.every(bg => ratio(cand, bg) >= min)) {
      return { hex: cand, hsl: [hsl[0].toFixed(0), hsl[1].toFixed(0), l.toFixed(1)],
               ratios: bgs.map(bg => ({ bg, r: +ratio(cand, bg).toFixed(2) })) };
    }
  }
  return null;
}

const LP = '#F8F6F1', LSA = '#F1ECE3';
const DP = '#1A1917', DSA = '#2B2825';

console.log('CORRECTIONS — same hue, lightness adjusted until the ratio clears\n');

const jobs = [
  ['E5 Speculative (light)', '#8A8478', [LP, LSA], 4.5, -1],
  ['E3 Plausible (light)',   '#8B6914', [LP, LSA], 4.5, -1],
  ['mute (dark)',            '#8E877C', [DP, DSA], 4.5, +1],
  ['E5 Speculative (dark)',  '#8E877C', [DP, DSA], 4.5, +1]
];

jobs.forEach(([label, hex, bgs, min, dir]) => {
  const orig = bgs.map(bg => +ratio(hex, bg).toFixed(2));
  const s = solve(hex, bgs, min, dir);
  console.log(label);
  console.log('  was  ' + hex + '   ratios ' + JSON.stringify(orig));
  if (s) {
    console.log('  now  ' + s.hex + '   ratios ' + JSON.stringify(s.ratios.map(x=>x.r)) +
                '   hsl(' + s.hsl.join(', ') + ')');
    const oh = rgbToHsl(hexToRgb(hex));
    console.log('  hue  ' + oh[0].toFixed(0) + '° -> ' + s.hsl[0] + '°  (unchanged)');
  } else console.log('  no solution in this hue');
  console.log();
});
