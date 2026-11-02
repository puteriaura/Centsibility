import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = dirname(fileURLToPath(import.meta.url));
export const states = [
  { name: 'neutral', label: 'Neutral', duration: 0, purpose: 'A still, ready pose. No unnecessary idle motion.' },
  { name: 'welcome', label: 'Welcome', duration: 1.1, purpose: 'A clear two-part wave with a friendly lean, settling into a greeting.', left: 108,
    css: '.left-arm{animation:wave 1.1s var(--move) both}.character{animation:greet-lean 1.1s var(--move) both}@keyframes wave{0%{transform:rotate(0deg)}24%{transform:rotate(142deg)}40%{transform:rotate(62deg)}57%{transform:rotate(142deg)}73%{transform:rotate(62deg)}90%,100%{transform:rotate(108deg)}}@keyframes greet-lean{0%,100%{transform:rotate(0deg)}28%,65%{transform:rotate(-4deg)}}' },
  { name: 'guide', label: 'Guide', duration: 0.7, right: -96, purpose: 'Extend one simple arm toward the next action.',
    css: '.right-arm{animation:point .7s var(--move) both}.character{animation:guide-lean .7s var(--move) both}@keyframes point{0%{transform:rotate(0deg)}38%{transform:rotate(-112deg) translateX(12px)}65%{transform:rotate(-88deg)}100%{transform:rotate(-96deg)}}@keyframes guide-lean{0%,100%{transform:rotate(0deg)}45%{transform:rotate(4deg)}}' },
  { name: 'happy', label: 'Happy', duration: 0.6, mouth: 'open', left: 60, right: -60, purpose: 'A visible little hop and a relaxed happy face.',
    css: '.character{animation:lift .6s var(--move) both}@keyframes lift{0%,100%{transform:translateY(0)}45%{transform:translateY(-20px)}}' },
  { name: 'encouraging', label: 'Encouraging', duration: 0.7, left: 35, purpose: 'A clear supportive nod, without exaggerated approval.',
    css: '.character{animation:nod .7s var(--move) both}.left-arm{animation:encourage-arm .7s var(--move) both}@keyframes nod{0%,100%{transform:rotate(0deg) translateY(0)}45%{transform:rotate(5deg) translateY(6px)}70%{transform:rotate(-2deg)}}@keyframes encourage-arm{0%,100%{transform:rotate(35deg)}45%{transform:rotate(80deg)}}' },
  { name: 'attentive', label: 'Attentive', duration: 0.5, mouth: 'flat', right: -45, purpose: 'A calm attentive glance for information that needs review.',
    css: '.character{animation:attend .5s var(--move) both}@keyframes attend{0%,100%{transform:rotate(0deg)}45%{transform:rotate(-6deg)}}' },
  { name: 'proud', label: 'Proud', duration: 0.8, eyes: 'closed', left: 40, right: -40, purpose: 'Straighten gently into a quietly proud pose.',
    css: '.character{animation:proud-straighten .8s var(--out) both}.left-arm{animation:proud-left .8s var(--move) both}.right-arm{animation:proud-right .8s var(--move) both}@keyframes proud-straighten{0%{transform:rotate(5deg)}55%{transform:rotate(-2deg)}100%{transform:rotate(0deg)}}@keyframes proud-left{0%{transform:rotate(0deg)}50%{transform:rotate(75deg)}100%{transform:rotate(40deg)}}@keyframes proud-right{0%{transform:rotate(0deg)}50%{transform:rotate(-75deg)}100%{transform:rotate(-40deg)}}' },
  { name: 'celebrate', label: 'Celebrate', duration: 1.2, eyes: 'closed', mouth: 'open', left: 108, right: -108, purpose: 'One clear celebratory hop and raised arms for a confirmed milestone.',
    css: '.character{animation:hop 1.2s var(--move) both}.left-arm{animation:raise-left 1.2s var(--move) both}.right-arm{animation:raise-right 1.2s var(--move) both}@keyframes hop{0%,15%,75%,100%{transform:translateY(0) rotate(0deg)}42%{transform:translateY(-44px) rotate(-4deg)}62%{transform:translateY(-12px) rotate(3deg)}}@keyframes raise-left{0%{transform:rotate(0deg)}35%{transform:rotate(142deg)}58%{transform:rotate(86deg)}80%,100%{transform:rotate(108deg)}}@keyframes raise-right{0%{transform:rotate(0deg)}35%{transform:rotate(-142deg)}58%{transform:rotate(-86deg)}80%,100%{transform:rotate(-108deg)}}' },
  { name: 'reassuring', label: 'Reassuring', duration: 0.9, left: 62, right: -62, purpose: 'Open simple arms to offer support without judgment.',
    css: '.left-arm{animation:offer-left .9s var(--move) both}.right-arm{animation:offer-right .9s var(--move) both}.character{animation:offer-lean .9s var(--move) both}@keyframes offer-left{0%{transform:rotate(0deg)}45%{transform:rotate(95deg)}100%{transform:rotate(62deg)}}@keyframes offer-right{0%{transform:rotate(0deg)}45%{transform:rotate(-95deg)}100%{transform:rotate(-62deg)}}@keyframes offer-lean{0%,100%{transform:rotate(0deg)}45%{transform:rotate(-4deg)}}' },
  { name: 'loading', label: 'Loading', duration: 1.6, loop: true, purpose: 'A visible repeating side-to-side rock while an operation is genuinely pending.',
    css: '.character{animation:wait 1.6s var(--move) infinite}@keyframes wait{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}' },
  { name: 'saved', label: 'Saved', duration: 0.5, purpose: 'A clear confirmation nod and a separate check for any confirmed save.',
    prop: '<g class="check"><path d="M378 125l10 10 20-25" fill="none" stroke="#44836C" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>',
    css: '.character{animation:saved-nod .5s var(--move) both}.check{transform-origin:390px 125px;animation:check-in .5s var(--out) both}@keyframes saved-nod{0%,100%{transform:rotate(0deg) translateY(0)}45%{transform:rotate(5deg) translateY(5px)}}@keyframes check-in{0%{opacity:0;transform:translateY(12px) scale(.95)}65%{opacity:1;transform:translateY(0) scale(1.25)}100%{opacity:1;transform:translateY(0) scale(1)}}' },
  { name: 'unavailable', label: 'Unavailable', duration: 0.5, mouth: 'flat', purpose: 'Settle into a calm neutral pose for offline or failed operations.',
    css: '.character{animation:settle .5s var(--out) both}@keyframes settle{from{transform:rotate(6deg) translateY(-8px)}to{transform:rotate(0deg) translateY(0)}}' },
];

export function svg(state, still = false) {
  // Each inline SVG needs scoped selectors so multiple states can share a page.
  const style = `
.penny{--move:cubic-bezier(.77,0,.175,1);--out:cubic-bezier(.23,1,.32,1)}
.character{transform-origin:256px 430px}.left-arm{transform-origin:101px 250px;transform:rotate(${state.left || 0}deg)}.right-arm{transform-origin:410px 250px;transform:rotate(${state.right || 0}deg)}
.left-leg{transform-origin:217px 367px}.right-leg{transform-origin:291px 367px}.face{transform-origin:252px 239px}
${still ? '' : state.css || ''}
.still *{animation:none!important}
@media(prefers-reduced-motion:reduce){.penny *{animation:none!important}}
@media(prefers-color-scheme:dark){.shoe{fill:#856591}.limb{stroke:#BA9557}}
`.replace(/\.([a-z][\w-]*)/g, (_, cls) => cls === 'penny' ? `.penny-${state.name}` : cls === 'still' ? `.penny-${state.name}.still` : `.penny-${state.name} .${cls}`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-labelledby="penny-${state.name}-title penny-${state.name}-desc" class="penny penny-${state.name}${still ? ' still' : ''}">
<title id="penny-${state.name}-title">Penny — ${state.label}</title><desc id="penny-${state.name}-desc">${state.purpose}</desc>
<style>${style}</style>
<g class="character">
<g class="left-leg"><path class="limb" d="M217 366L210 422" fill="none" stroke="#82602D" stroke-width="9" stroke-linecap="round"/><path class="shoe" d="M185 423C183 414 205 413 215 416C226 420 225 431 213 434C202 437 183 434 185 423Z" fill="#302046"/></g>
<g class="right-leg"><path class="limb" d="M291 366L300 422" fill="none" stroke="#82602D" stroke-width="9" stroke-linecap="round"/><path class="shoe" d="M288 421C289 414 306 413 316 418C328 423 330 433 315 435C302 437 286 432 288 421Z" fill="#302046"/></g>
<g class="left-arm"><path class="limb" d="M101 250Q89 264 75 287" fill="none" stroke="#82602D" stroke-width="7" stroke-linecap="round"/></g>
<g class="right-arm"><path class="limb" d="M410 250Q426 263 438 290" fill="none" stroke="#82602D" stroke-width="7" stroke-linecap="round"/></g>
<path d="M269 74C351 72 410 137 413 222C418 309 353 377 274 380L254 373L250 81Z" fill="#CBA951"/>
<path d="M249 73C329 72 391 134 392 218C395 302 337 374 254 379C166 383 104 323 101 239C96 151 156 77 249 73Z" fill="#E2C66B"/>
<g class="face">
${state.eyes === 'closed' ? '<path d="M192 225q9-13 19 0M285 225q9-13 19 0" fill="none" stroke="#211D17" stroke-width="4" stroke-linecap="round"/>' : '<path d="M210 225c0 6-4 10-10 10s-10-4-10-10 4-10 10-10 10 4 10 10M304 224c0 6-4 10-10 10s-10-4-10-10 4-10 10-10 10 4 10 10" fill="#211D17"/>'}
${state.mouth === 'flat' ? '<path d="M237 261h23" stroke="#211D17" stroke-width="3.5" stroke-linecap="round"/>' : state.mouth === 'open' ? '<path d="M231 254Q249 263 267 253C265 278 236 278 231 254Z" fill="#211D17"/>' : '<path d="M235 255Q249 279 265 254" fill="none" stroke="#211D17" stroke-width="3.5" stroke-linecap="round"/>'}
</g>
${state.prop || ''}
</g></svg>`;
}

export async function build() {
  await mkdir(join(folder, 'animated'), { recursive: true });
  await mkdir(join(folder, 'static'), { recursive: true });
  for (const state of states) {
    await writeFile(join(folder, 'animated', `${state.name}.svg`), svg(state));
    await writeFile(join(folder, 'static', `${state.name}.svg`), svg(state, true));
  }
  await writeFile(join(folder, 'welcome.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Penny — Welcome</title><style>body{margin:0;min-height:100vh;display:grid;place-content:center;background:#fff;color:#211D17;font:16px system-ui}main{width:min(90vw,512px)}svg{width:100%;height:auto}p{margin:0 30px 12px}button{margin:0 30px;padding:8px 18px;background:white;color:inherit;border:1px solid #ccc;border-radius:4px;cursor:pointer}</style><main>${svg(states.find(s => s.name === 'welcome'))}<p>Welcome · 1.1 seconds</p><button onclick="const s=document.querySelector('svg');s.replaceWith(s.cloneNode(true))">Replay</button></main></html>`);
  await writeFile(join(folder, 'manifest.json'), JSON.stringify(states.map(({ name, label, duration, loop, purpose }) => ({ name, label, duration, playback: duration === 0 ? 'static' : loop ? 'loop' : 'one-shot', purpose, tool: 'Native SVG + CSS, rendered by Chromium', toolReason: 'Editable vector shapes and native transform animation without a library.', animated: `animated/${name}.svg`, reducedMotion: `static/${name}.svg` })), null, 2));
  const cards = states.map(state => `<article><div class="stage" data-state="${state.name}">${svg(state)}</div><h2>${state.label}</h2><p>${state.duration === 0 ? 'Static' : `${state.duration}s · ${state.loop ? 'pending-only loop' : 'one-shot'}`}</p><p>${state.purpose}</p><button type="button" data-replay="${state.name}" ${state.duration === 0 ? 'disabled' : ''}>Replay</button> <a href="animated/${state.name}.svg" download>SVG</a> · <a href="static/${state.name}.svg" download>Still</a></article>`).join('\n');
  await writeFile(join(folder, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Penny — motion library</title><style>
body{margin:0;background:#fff;color:#29251f;font:16px/1.5 system-ui,sans-serif}main{max-width:1080px;margin:40px auto;padding:0 24px}h1{font-size:28px;font-weight:600;margin-bottom:8px}header p{max-width:680px}.controls{display:flex;gap:24px;flex-wrap:wrap;padding:18px 0;border-bottom:1px solid #ddd}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:36px 24px;margin-top:24px}article{min-width:0}.stage{background:#fff;aspect-ratio:1}.stage svg{width:100%;height:100%;display:block}h2{font-size:18px;font-weight:600;margin:8px 0}article p{font-size:14px;margin:6px 0;min-height:22px}button{font:inherit;font-size:14px;background:#fff;color:#29251f;border:1px solid #bcb6aa;border-radius:3px;padding:5px 12px;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid #44836c;outline-offset:3px}a{color:#315e50;font-size:14px}.dark .stage{background:#202529}.reduced .penny *{animation:none!important}.paused .penny *{animation-play-state:paused!important}@media(max-width:550px){main{margin-top:24px}.gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 12px}article p{min-height:0}}
</style></head><body><main><header><h1>Penny, in motion</h1><p>Twelve reusable states. Flat gold, simple limbs, no perimeter stroke. Essential status stays in the app's text; Penny adds a quiet human cue.</p></header><div class="controls"><label><input id="reduce" type="checkbox"> Reduced motion</label><label><input id="dark" type="checkbox"> Dark background</label><label><input id="pause" type="checkbox"> Pause</label><button id="replay-all" type="button">Replay all</button></div><section class="gallery" aria-label="Penny animation states">${cards}</section><p>SVG + CSS · scalable 512 × 512 viewBox · no runtime dependencies. Loading is the only loop. OS reduced-motion settings are respected automatically.</p></main><script>
const replay=stage=>{const svg=stage.querySelector('svg');svg.replaceWith(svg.cloneNode(true));stage.dataset.replayedAt=String(performance.now())};
document.querySelectorAll('[data-replay]').forEach(button=>button.addEventListener('click',()=>replay(document.querySelector('[data-state="'+button.dataset.replay+'"]'))));
document.getElementById('replay-all').addEventListener('click',()=>document.querySelectorAll('.stage').forEach(replay));
for(const [id,cls] of [['reduce','reduced'],['dark','dark'],['pause','paused']])document.getElementById(id).addEventListener('change',event=>{document.body.classList.toggle(cls,event.target.checked);if(id==='dark'){document.querySelectorAll('.shoe').forEach(node=>node.style.fill=event.target.checked?'#856591':'');document.querySelectorAll('.limb').forEach(node=>node.style.stroke=event.target.checked?'#BA9557':'')}});
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('paused',document.hidden||document.getElementById('pause').checked));
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.querySelectorAll('svg *').forEach(node=>node.style.animationPlayState=entry.isIntersecting?'':'paused')),{threshold:.01});document.querySelectorAll('.stage').forEach(stage=>observer.observe(stage));
const repeatLabel=document.createElement('label');repeatLabel.innerHTML='<input id="repeat" type="checkbox" checked> Repeat previews';document.querySelector('.controls').append(repeatLabel);
const previewStates=${JSON.stringify(states.filter(s=>s.duration>0&&!s.loop).map(s=>({name:s.name,duration:s.duration})))};
setInterval(()=>{if(!document.getElementById('repeat').checked||document.hidden||document.body.matches('.paused,.reduced')||matchMedia('(prefers-reduced-motion:reduce)').matches)return;for(const state of previewStates){const stage=document.querySelector('[data-state="'+state.name+'"]'),rect=stage.getBoundingClientRect(),animations=stage.querySelector('svg').getAnimations({subtree:true});if(rect.bottom>0&&rect.top<innerHeight&&animations.length&&animations.every(animation=>animation.playState==='finished')&&performance.now()-Number(stage.dataset.replayedAt||0)>state.duration*1000+900)replay(stage)}},400);
</script></body></html>`);
}
await build();
