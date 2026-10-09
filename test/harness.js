// Headless test af Kølerkildekøbing Destroy (ingen browser): node test/harness.js index.html
// Kører byen med DOM-stubs, tjekker at byen står stabilt, at samme frø giver samme by,
// og at alle våben + sammenstyrtning kører uden runtime-fejl.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const code = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const noop = () => {};
function ctxStub(){
  return new Proxy({}, { get(t, k){
    if(k in t) return t[k];
    if(k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({addColorStop: noop});
    if(k === 'createImageData') return (w, h) => ({data: new Uint8ClampedArray(w*h*4), width: w, height: h});
    if(k === 'measureText') return s => ({width: String(s).length*7});
    return noop;
  }, set(t, k, v){ t[k] = v; return true; } });
}
const els = {};
function el(id){
  if(id && els[id]) return els[id];
  const e = { id, hidden:false, style:{}, dataset:{}, textContent:'', value:'', width:300, height:150, offsetX:0, offsetY:0,
    classList:{add:noop, remove:noop, toggle:noop, contains:() => false},
    addEventListener(t, f){ (this.l = this.l || {})[t] = f; }, setAttribute(k, v){ this['a_'+k] = v; }, getAttribute(k){ return this['a_'+k]; },
    getContext: () => ctxStub(), getBoundingClientRect: () => ({left:0, top:0, width:1280, height:640}),
    setPointerCapture: noop, blur: noop, focus: noop, toggleAttribute(k, v){ this['a_'+k] = v; }, appendChild(c){ (this.kids = this.kids || []).push(c); },
    set innerHTML(v){ this._html = v; if(v === '') this.kids = []; }, get innerHTML(){ return this._html || ''; } };
  if(id) els[id] = e;
  return e;
}
const tools = ['raket','bombe','mega','c4','bor'].map(t => { const e = el(''); e.dataset.tool = t; return e; });
global.document = { getElementById: el, createElement: () => el(''), querySelectorAll: s => s === '.tool' ? tools : [], addEventListener: noop, hidden: false, body: el('body') };
const store = {};
global.localStorage = { getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const wl = {};
global.window = { devicePixelRatio: 1, addEventListener: (t, f) => { wl[t] = f; } };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = noop;
global.setTimeout = () => 0; global.clearTimeout = noop;
(0, eval)(code);
const K = window.KKD;

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FEJL ') + msg); if(!cond) fails++; };
function checksum(){ let h = 0; for(let i=0;i<K.N;i+=7) h = (h*31 + K.mat[i]) | 0; return h; }
function run(sec){ const errs = []; for(let k=0; k<sec*60; k++){ try { K.step(1/60); if(k % 10 === 0){ K.redrawStatic(); K.draw(k/60); } } catch(e){ errs.push(e.stack.split('\n').slice(0,2).join(' | ')); if(errs.length > 20) break; } } return errs; }
function staticCount(){ let n = 0; for(let i=0;i<K.N;i++) if(K.structural(K.mat[i])) n++; return n; }

// 1) samme frø → samme by
K.start('test-1'); const a = checksum(); K.start('test-2'); const b = checksum(); K.start('test-1');
ok(a === checksum() && a !== b, 'samme frø giver samme by, andet frø giver anden by');

// 2) byen står stabilt af sig selv
for(const sd of ['test-1','kølerkilde-417','havnegade-9','x','torvet-555']){
  K.start(sd);
  for(let i=0;i<K.N;i++) if(K.structural(K.mat[i])) K.seeds.push(i);
  const before = staticCount();
  const errs = run(3);
  const after = staticCount();
  ok(errs.length === 0 && after === before && K.bodies.length === 0 && K.stats.fallen === 0,
     `by "${sd}" står stabilt (${K.bld.length-1} bygninger, ${before} celler, ændret ${before-after}, legemer ${K.bodies.length})` + (errs.length ? ' ' + errs[0] : ''));
}

// 3) våben + sammenstyrtning uden fejl
K.start('test-1'); K.resize();
let allErrs = [];
const bl = K.bld.filter(Boolean);
for(let k=0; k<bl.length; k+=3){
  const B = bl[k], tool = ['raket','bombe','mega'][k % 3];
  K.fire(tool, (B.x0+B.x1)/2, B.y0 + 3);                       // våbnet som spilleren bruger det
  const cx = Math.round((B.x0+B.x1)/2), z = K.frontZ[cx + K.WX*(B.y0+3)];
  K.explode(cx, B.y0 + 3, z === 255 ? B.z0 : z, 7, 2.5);       // bombe-sprængning ved bunden
  allErrs = allErrs.concat(run(1.5));
}
allErrs = allErrs.concat(run(8));
for(let k=0; k<52 && K.bodies.length; k++) allErrs = allErrs.concat(run(1));   // vent til alt er landet (lange kæder, højst 60 s)
const c = {}; for(const e of allErrs) c[e] = (c[e]||0) + 1;
for(const [e, n] of Object.entries(c)) console.log('  ' + n + 'x ' + e);
ok(allErrs.length === 0, `alle våben mod ${Math.ceil(bl.length/3)} bygninger uden runtime-fejl`);
ok(K.stats.fallen > 0, `bygninger styrter sammen (${K.stats.fallen} af ${bl.length} faldt, skade ${Math.round(K.stats.damage).toLocaleString('da-DK')} kr.)`);
ok(K.bodies.length === 0, `alle faldende stykker er landet (${K.bodies.length} tilbage)` + K.bodies.map(b => ` [n${b.n} ${b.state} liv${b.life.toFixed(1)} c${b.cx.toFixed(1)},${b.cy.toFixed(1)} v${b.vx.toFixed(1)},${b.vy.toFixed(1)} w${b.w.toFixed(2)} a${b.a.toFixed(2)}]`).join(""));
// 3b) intet svæver: alle celler skal hænge sammen med jorden (direkte eller via brokker/bygninger)
function floating(){
  const L = K.WX*K.DZ, seen = new Uint8Array(K.N), q = [];
  for(let i=0;i<L;i++) if(K.mat[i]){ seen[i] = 1; q.push(i); }
  while(q.length){
    const i = q.pop(), x = i % K.WX, z = ((i / K.WX) | 0) % K.DZ, y = (i / L) | 0;
    const nb = [];
    if(x>0) nb.push(i-1); if(x<K.WX-1) nb.push(i+1); if(z>0) nb.push(i-K.WX); if(z<K.DZ-1) nb.push(i+K.WX); if(y>0) nb.push(i-L); if(y<K.HY-1) nb.push(i+L);
    for(const j of nb) if(!seen[j] && K.mat[j]){ seen[j] = 1; q.push(j); }
  }
  let n = 0; for(let i=0;i<K.N;i++) if(K.mat[i] && !seen[i]) n++;
  return n;
}
for(const sd of ['test-1','torvet-555']){
  K.start(sd);
  for(const B of K.bld.filter(Boolean)){ const cx = (B.x0+B.x1)/2, z = K.frontZ[Math.round(cx) + K.WX*(B.y0+3)]; K.explode(cx, B.y0+3, z === 255 ? B.z0 : z, 12, 3.2); run(1); }
  run(15); for(let k=0; k<20 && K.bodies.length; k++) run(1);
  const f = floating();
  ok(f === 0 && K.bodies.length === 0, `by "${sd}" efter megabomber på alle bygninger: ${f} svævende celler, ${K.stats.fallen} faldt`);
}

// 4) 3D-skrå visning: tegning, sigtning gennem dybden, våben
K.start('test-1'); K.setView('iso');
ok(K.viewMode === 'iso', 'skift til 3D-visning');
let t0 = Date.now(); K.redrawIso(K.WX); const tFull = Date.now() - t0;
ok(tFull < 2000, `hele byen tegnet i 3D på ${tFull} ms`);
{
  const B = K.bld.filter(b => b && b.z0 >= 16 && b.y1 - b.y0 > 30)[0];   // høj bygning i bagerste række
  const x = Math.round((B.x0+B.x1)/2), y = B.y1 - 2;
  // sigt på dens forside over forreste række: u = x + z/2, v = y + z/2
  const h = K.pickIso(x + B.z0*.5, y + B.z0*.5);
  ok(h && K.bid[K.idx(h.x, h.y, h.z)] === B.id, `sigte i 3D rammer bagerste bygning (${h ? h.x+','+h.y+','+h.z : 'intet'})`);
}
let isoErrs = [];
for(let k=0; k<bl.length; k+=4){
  const B = K.bld[bl[k].id], tool = ['raket','bombe','mega'][k % 3];
  const h = K.pickIso((B.x0+B.x1)/2 + B.z0*.5, B.y1 - 3 + B.z0*.5);
  if(h) K.fire(tool, h.x, h.y, h.z);
  const z = Math.max(B.z0, 4); K.explode((B.x0+B.x1)/2, B.y0 + 3, z, 7, 2.5);
  isoErrs = isoErrs.concat(run(1.5).map(e => 'iso ' + e));
  try { K.redrawIso(K.WX); K.draw(0); } catch(e){ isoErrs.push('iso draw ' + e.message); }
}
isoErrs = isoErrs.concat(run(6));
for(const e of [...new Set(isoErrs)].slice(0,5)) console.log('  ' + e);
ok(isoErrs.length === 0, `våben og sammenstyrtning i 3D uden runtime-fejl (${K.stats.fallen} faldt)`);
K.setView('side');
ok(K.viewMode === 'side', 'skift tilbage til sidevisning');

// 5) C4: placér ved bunden, udløs, ladninger forsvinder; nabo-ladning springer med
K.start('test-1'); K.setView('side'); K.redrawStatic();
{
  const B = K.bld.filter(b => b && b.z0 < 15 && b.type !== 'træhus')[0];
  const n0 = B.n;
  let placed = 0;
  for(let x = B.x0; x <= B.x1 && placed < 8; x += Math.max(1, Math.floor((B.x1-B.x0)/7))){
    const y = B.y0 + 2, z = K.frontZ[x + K.WX*y];
    if(z !== 255 && K.placeC4({x, y, z})) placed++;
  }
  ok(placed >= 4 && K.charges.length === placed, `C4: ${placed} ladninger placeret`);
  ok(!K.placeC4(null), 'C4 på luft afvises');
  K.detonate();
  const e1 = run(3);
  ok(e1.length === 0 && K.charges.length === 0 && B.n < n0, `C4 udløst: ${n0 - B.n} celler væk fra bygningen, ladninger tilbage ${K.charges.length}` + (e1[0] ? ' ' + e1[0] : ''));
  // nabo: én ladning, eksplosion lige ved siden af
  const B2 = K.bld.filter(b => b && b.z0 < 15 && b.id !== B.id && !b.fallen)[2];
  const x = Math.round((B2.x0+B2.x1)/2), y = B2.y0 + 6; K.redrawStatic(); const z = K.frontZ[x + K.WX*y];
  K.placeC4({x, y, z}); const c0 = K.charges.length;
  K.explode(x + 2, y, z, 4, 2); run(1);
  ok(c0 === 1 && K.charges.length === 0, 'C4 ramt af eksplosion springer med');
}

// 6) boremaskine: borer sig ind i bygningen
K.start('test-1'); K.redrawStatic();
{
  const B = K.bld.filter(b => b && b.z0 < 15 && b.type === 'kontor')[0] || K.bld[1];
  const x = Math.round((B.x0+B.x1)/2), y = B.y0 + 10;
  const z0 = K.frontZ[x + K.WX*y];
  let removed = 0;
  for(let k=0;k<40;k++){ K.redrawStatic(); const z = K.frontZ[x + K.WX*y]; if(z === 255) break; removed += K.drillTick({x, y, z}); K.step(1/60); }
  K.redrawStatic(); const z1 = K.frontZ[x + K.WX*y];
  ok(removed > 20 && (z1 === 255 || z1 > z0), `boremaskine fjernede ${removed} celler, hullet gik fra dybde ${z0} til ${z1 === 255 ? 'helt igennem' : z1}`);
  ok(run(2).length === 0, 'ingen fejl efter boring');
}

// 7) Top 10 pr. by
for(const k in store) delete store[k];
K.start('top-by'); K.stats.damage = 5000; K.start('top-by');
K.stats.damage = 9000; K.start('top-by');
for(let k=0;k<12;k++){ K.stats.damage = 1000 + k; K.start('top-by'); }
K.start('anden-by'); K.stats.damage = 1; K.start('tredje-by');
{
  const top = K.loadTop()['storby:top-by'] || [];
  ok(top.length === 10 && top[0].kr === 9000 && top[1].kr === 5000 && top.every((e, k) => k === 0 || top[k-1].kr >= e.kr), `Top 10 gemmes sorteret og kappes ved 10 (${top.map(e => e.kr).slice(0,4).join(', ')} …)`);
  ok((K.loadTop()['storby:anden-by'] || []).length === 1, 'hver by har sin egen liste');
  K.showTop(true); ok(true, 'Top 10-panel kan åbnes');
}

// 8) liv: figurer, biler, busser
const bad = () => K.people.filter(q => !isFinite(q.x) || !isFinite(q.y)).length + K.cars.filter(c => !isFinite(c.x) || !isFinite(c.y)).length;
K.start('test-1');
{
  const P = K.people, out = P.filter(q => q.st === 'walk'), ins = P.filter(q => q.st === 'inside');
  const supported = P.every(q => K.mat[K.idx(Math.round(q.x), q.y - 1, q.z)] && !K.mat[K.idx(Math.round(q.x), q.y, q.z)]);
  ok(out.length > 30 && ins.length > 50 && K.cars.length === 16 && K.buses.length === 3 && supported,
     `byen har ${out.length} figurer ude, ${ins.length} inde, ${K.cars.length} biler, ${K.buses.length} busser – alle står på noget`);
  const cx0 = K.cars.map(c => c.x);
  const e = run(10);
  ok(e.length === 0 && K.stats.hit === 0 && K.stats.saved === 0 && bad() === 0 && K.cars.some((c, k) => Math.abs(c.x - cx0[k]) > 5),
     `rolig by i 10 s: ingen ramt, ingen flygter, bilerne kører` + (e[0] ? ' ' + e[0] : ''));
}
// fuld evakuering
K.start('test-1');
{
  for(const b of K.bld) if(b) b.alarm = true;
  for(const q of K.people) if(q.st === 'walk') q.st = 'flee';
  const e = run(90);
  const st = {}; for(const q of K.people) st[q.st] = (st[q.st] || 0) + 1;
  const tot = K.stats.people;
  const waiting = K.people.filter(q => q.st === 'flee' && K.buses.some(b => Math.abs(b.home - q.x) < 1)).length;
  ok(e.length === 0 && bad() === 0 && K.stats.hit === 0 && K.stats.saved + waiting === tot,
     `evakuering uden ødelæggelse: ${K.stats.saved}/${tot} reddet på 90 s, ${waiting} venter ved stoppestedet, ramt ${K.stats.hit} (tilstande: ${JSON.stringify(st)})` + (e[0] ? ' ' + e[0] : ''));
  ok(K.buses.some(b => b.st !== 'wait' || b.load > 0), `busserne fyldes (${K.buses.map(b => b.st + ':' + b.load).join(', ')})`);
}
// figur ramt af eksplosion
K.start('test-1');
{
  const q = K.people.find(q => q.st === 'walk' && q.z === 3 && q.x > 20 && q.x < K.WX - 20);
  K.explode(q.x, q.y + 1, q.z, 4, 2);
  ok(K.stats.hit >= 1 && (q.st === 'fly' || q.st === 'dizzy'), `figur ramt af eksplosion flyver og bliver svimmel (${q.st}, ramt ${K.stats.hit})`);
  run(4);
  ok(q.st === 'dizzy' && bad() === 0, `figuren ligger svimmel efter landing`);
}
// biler: vrag og murbrokker på vejen
K.start('test-1');
{
  const c = K.cars.find(c => c.x > 40 && c.x < K.WX - 40), d0 = K.stats.damage;
  K.explode(c.x, c.y + 1, c.z, 4, 2); run(4);
  ok(c.st === 'wreck' && K.stats.damage - d0 >= 30000, `bil ramt af eksplosion bliver til vrag (+${(K.stats.damage - d0).toLocaleString('da-DK')} kr.)`);
  const c2 = K.cars.find(o => o !== c && o.st === 'drive' && o.z === 0 && o.x > 30 && o.x < K.WX - 60);
  const wx = Math.round(c2.x) + 15;
  for(let y=K.GY; y<K.GY+3; y++) for(let x=wx; x<wx+2; x++) K.mat[K.idx(x, y, 0)] = 6 | 0x40;
  run(8);
  ok(c2.st === 'drive' && c2.x < wx - 1 && c2.v < .5, `bil stopper for murbrokker på vejen (holder ved ${c2.x.toFixed(1)}, brokker ved ${wx})`);
}
// fuld bus kører væk og kommer tilbage
K.start('test-1');
{
  const b = K.buses[1]; b.load = 15; run(1);
  const left = b.st === 'leave'; run(40);
  ok(left && b.st === 'wait' && b.load === 0, `fuld bus kører væk og kommer tom tilbage (${b.st}, ${b.load})`);
}
// total ødelæggelse med liv i begge visninger
for(const vm of ['side', 'iso']){
  K.start('torvet-555'); K.setView(vm);
  let e = [];
  for(const B of K.bld.filter(Boolean)){ K.explode((B.x0+B.x1)/2, B.y0 + 3, B.z0, 12, 3.2); e = e.concat(run(.6)); try { if(vm === 'iso') K.redrawIso(K.WX); else K.redrawStatic(); K.draw(1); } catch(err){ e.push('draw ' + err.message); } }
  e = e.concat(run(20));
  const P = K.people, left = P.filter(q => q.st !== 'saved' && !q.hit).length;
  ok(e.length === 0 && bad() === 0, `${vm}: megabomber på hele byen med liv uden fejl – reddet ${K.stats.saved}, ramt ${K.stats.hit}, stadig i byen ${left} af ${K.stats.people}` + (e[0] ? ' ' + e[0] : ''));
}
K.setView('side');

// 9) temaer: stabile byer, havn, kirke
for(const th of ['havneby', 'landsby']){
  K.setTheme(th);
  let unstable = [], nb = 0;
  for(const sd of ['a','b','c','test-1','kølerkilde-417','torvet-555']){
    K.start(sd); nb += K.bld.length - 1;
    for(let i=0;i<K.N;i++) if(K.structural(K.mat[i])) K.seeds.push(i);
    const e = run(3);
    if(e.length || K.bodies.length || K.stats.fallen) unstable.push(sd + (e[0] ? ' ' + e[0] : ''));
  }
  ok(unstable.length === 0, `${th}: 6 byer (${nb} bygninger) står stabilt` + (unstable.length ? ' – ustabile: ' + unstable.join(' | ') : ''));
}
K.setTheme('havneby'); K.start('a');
{
  let water = 0; for(let i=0;i<K.N;i++) if((K.mat[i] & 63) === K.WATER) water++;
  const cranes = K.bld.filter(b => b && b.type === 'kran').length, inWater = K.people.filter(q => (K.mat[K.idx(Math.round(q.x), q.y - 1, q.z)] & 63) === K.WATER).length;
  ok(water > 1000 && cranes === 2 && inWater === 0, `Havneby: ${water} vandceller, ${cranes} kraner, ${inWater} figurer i vandet`);
  const e = run(30);
  ok(e.length === 0 && K.people.every(q => (K.mat[K.idx(Math.max(0, Math.round(q.x)), Math.max(0, q.y - 1), q.z)] & 63) !== K.WATER || q.st === 'fly'), 'Havneby: ingen går ud i vandet på 30 s' + (e[0] ? ' ' + e[0] : ''));
}
K.setTheme('landsby'); K.start('a');
ok(K.bld.some(b => b && b.type === 'kirke') && K.bld.filter(b => b && b.type === 'træhus').length >= 8, `Landsby: kirke og ${K.bld.filter(b => b && b.type === 'træhus').length} træhuse`);

// 10) natur
// jordskælv styrke 3 vælter bygninger
K.setTheme('landsby'); K.start('a');
{
  K.startQuake(); K.startQuake(); K.startQuake();
  const e = run(6); for(let k=0; k<30 && K.bodies.length; k++) e.push(...run(1));
  ok(e.length === 0 && K.quake === null && K.stats.fallen >= 3, `jordskælv (styrke 3) i Landsby: ${K.stats.fallen} af ${K.bld.length-1} bygninger faldt, ramt ${K.stats.hit}` + (e[0] ? ' ' + e[0] : ''));
}
K.setTheme('storby'); K.start('test-1');
{
  K.startQuake(); const e = run(6); for(let k=0; k<30 && K.bodies.length; k++) e.push(...run(1));
  ok(e.length === 0 && K.stats.fallen < (K.bld.length-1)*.5, `jordskælv (styrke 1) i Storby: ${K.stats.fallen} af ${K.bld.length-1} faldt (ikke alt)`);
}
// lyn + ild i træhus
K.setTheme('landsby'); K.start('a');
{
  const B = K.bld.find(b => b && b.type === 'træhus' && b.z0 < 15);
  const n0 = B.n, x = Math.round((B.x0+B.x1)/2);
  const hit = K.strikeLightning(x);
  ok(hit && K.burning.size > 0, `lyn rammer (${hit && hit.x},${hit && hit.y}) og tænder ild (${K.burning.size} celler brænder)`);
  let maxB = 0, e = [];
  for(let k=0; k<60 && (K.burning.size || k < 5); k++){ e = e.concat(run(1)); maxB = Math.max(maxB, K.burning.size); }
  ok(e.length === 0 && maxB > 20 && K.burning.size === 0 && B.n < n0*.8, `ilden spreder sig (op til ${maxB} celler) og brænder ud; træhuset mistede ${n0 - B.n} af ${n0} celler` + (e[0] ? ' ' + e[0] : ''));
}
// ild på beton fænger ikke
K.setTheme('storby'); K.start('test-1');
{ const B = K.bld.find(b => b && b.type === 'kontor'); const n = K.igniteAround({x:B.x0+3, y:B.y0+5, z:B.z0}, 1); ok(n === 0, 'ild fænger ikke i beton'); }
// tornado
K.setTheme('storby'); K.start('test-1');
{
  const d0 = K.stats.damage; K.startTornado(60);
  let e = run(16);
  ok(e.length === 0 && K.tornados.length === 0 && K.stats.damage - d0 > 100000, `tornado skader byen (+${Math.round(K.stats.damage - d0).toLocaleString('da-DK')} kr.), ramt ${K.stats.hit}, forsvinder igen` + (e[0] ? ' ' + e[0] : ''));
}
// tsunami
for(const th of ['havneby', 'storby']){
  K.setTheme(th); K.start('a');
  const d0 = K.stats.damage, wr0 = K.cars.filter(c => c.st === 'wreck').length;
  K.startTsunami();
  const e = run(30);
  const wr = K.cars.filter(c => c.st === 'wreck').length - wr0;
  ok(e.length === 0 && K.waves.length === 0 && K.stats.damage > d0 && wr > 5, `tsunami i ${th}: +${Math.round(K.stats.damage - d0).toLocaleString('da-DK')} kr., ${wr} bilvrag, ramt ${K.stats.hit}, oversvømmelsen er trukket væk: ${Math.max(...K.floodH).toFixed(1)}` + (e[0] ? ' ' + e[0] : ''));
}
// alt på én gang i begge visninger
for(const vm of ['side', 'iso']){
  K.setTheme('havneby'); K.start('b'); K.setView(vm);
  K.startQuake(); K.startTornado(100); K.startTsunami(); K.strikeLightning(200); K.strikeLightning(150);
  let e = [];
  for(let k=0;k<25;k++){ e = e.concat(run(1)); try { if(vm === 'iso') K.redrawIso(K.WX); else K.redrawStatic(); K.draw(k); } catch(err){ e.push('draw ' + err.message); } }
  ok(e.length === 0 && bad() === 0, `${vm}: jordskælv + tornado + tsunami + lyn samtidig uden fejl (${K.stats.fallen} faldt, ramt ${K.stats.hit})` + (e[0] ? ' ' + e[0] : ''));
}
K.setView('side'); K.setTheme('storby');

// 11) sci-fi
// laser: skærer et højhus over ved at trække strålen hen over det
K.setTheme('storby'); K.start('test-1'); K.setView('side'); K.redrawStatic();
{
  const B = K.bld.find(b => b && b.type === 'tårn' && b.z0 < 15);
  const n0 = B.n, x = Math.round((B.x0+B.x1)/2), z = B.z0 + 2; let cut = 0;
  for(let k=0; k<60; k++) cut += K.laserTick({x, y:B.y1, z});
  let col = 0; for(let y=K.GY; y<=B.y1; y++) if(K.mat[K.idx(x, y, z)]) col++;
  const e = run(6); for(let k=0; k<30 && K.bodies.length; k++) e.push(...run(1));
  ok(e.length === 0 && cut > 50 && col === 0, `laser brændte sig ned gennem højhuset (${cut} celler, ${col} tilbage i søjlen)` + (e[0] ? ' ' + e[0] : ''));
}
// sort hul
K.start('test-1');
{
  const B = K.bld.find(b => b && b.type === 'kontor' && b.z0 < 15), d0 = K.stats.damage;
  const cars0 = K.cars.filter(c => c.st !== 'lost').length;
  K.spawnHole({x:Math.round((B.x0+B.x1)/2), y:B.y0 + 6, z:B.z0});
  const e = run(10);
  const lostP = K.people.filter(q => q.st === 'lost').length, lostC = K.cars.filter(c => c.st === 'lost').length;
  ok(e.length === 0 && K.holes.length === 0 && K.stats.damage - d0 > 500000 && bad() === 0, `sort hul slugte for ${Math.round(K.stats.damage - d0).toLocaleString('da-DK')} kr., ${lostP} figurer og ${lostC} biler forsvandt, hullet lukkede igen` + (e[0] ? ' ' + e[0] : ''));
  K.redrawStatic(); K.draw(0);
}
// meteor
K.start('test-1');
{
  const B = K.bld.find(b => b && b.z0 < 15 && b.x0 > 60), d0 = K.stats.damage;
  let earth0 = 0; for(let i=0;i<K.N;i++) if((K.mat[i] & 63) === 2) earth0++;
  K.fire('meteor', (B.x0+B.x1)/2, B.y0 + 2, B.z0);
  const e = run(5);
  let earth1 = 0; for(let i=0;i<K.N;i++) if((K.mat[i] & 63) === 2) earth1++;
  ok(e.length === 0 && K.shots.length === 0 && K.stats.damage - d0 > 1000000, `meteor slog ned: +${Math.round(K.stats.damage - d0).toLocaleString('da-DK')} kr., krater på ${earth0 - earth1} jordceller, ${K.burning.size} celler brænder` + (e[0] ? ' ' + e[0] : ''));
}
// UFO: flyv hen over vejen, træk biler/figurer og brokker op, slip dem
K.start('test-1'); K.resize();
{
  const B = K.bld.find(b => b && b.z0 < 15 && b.x0 > 80);
  K.explode((B.x0+B.x1)/2, B.y0 + 3, B.z0, 9, 3); run(4);
  const sx = ((B.x0+B.x1)/2 - K.cam.x)*K.cam.s, sy = K.view.h - (K.GY + 14 - K.cam.y)*K.cam.s;
  K.ufoSteer(sx, sy); run(4);
  ok(K.ufo && Math.abs(K.ufo.x - (B.x0+B.x1)/2) < 2, `UFO flyver hen til målet (x ${K.ufo && K.ufo.x.toFixed(1)})`);
  K.setBeam(true); run(4);
  const cargo = K.ufo.cargo.length, held = K.people.filter(q => q.st === 'held' || q.st === 'beam').length + K.cars.filter(c => c.st === 'held' || c.st === 'beam').length;
  ok(cargo > 20, `trækstrålen løfter ${cargo} brokker og ${held} figurer/biler`);
  K.setBeam(false);
  const e = run(6); for(let k=0; k<20 && K.bodies.length; k++) e.push(...run(1));
  ok(e.length === 0 && K.ufo.cargo.length === 0 && bad() === 0 && K.people.every(q => q.st !== 'held' && q.st !== 'beam'), `lasten slippes og falder ned, ingen hænger fast` + (e[0] ? ' ' + e[0] : ''));
}
// alt sci-fi samtidig i begge visninger
for(const vm of ['side', 'iso']){
  K.start('torvet-555'); K.setView(vm); K.resize();
  K.spawnHole({x:120, y:K.GY + 15, z:10}); K.fire('meteor', 220, K.GY + 5, 6); K.ufoSteer(300, 200); K.setBeam(true);
  let e = [];
  for(let k=0;k<12;k++){ for(let q=0;q<20;q++) K.laserTick({x: 40 + k*3, y: K.GY + 20, z: 6}); e = e.concat(run(1)); try { if(vm === 'iso') K.redrawIso(K.WX); else K.redrawStatic(); K.draw(k); } catch(err){ e.push('draw ' + err.message); } }
  K.setBeam(false); e = e.concat(run(8));
  ok(e.length === 0 && bad() === 0, `${vm}: laser + sort hul + meteor + UFO samtidig uden fejl (${K.stats.fallen} faldt)` + (e[0] ? ' ' + e[0] : ''));
}
K.setView('side');

// 12) monstre
K.setTheme('storby'); K.start('test-1'); K.setView('side');
{
  K.spawnMonster('gorilla', 30);
  const g = K.monsters[0], d0 = K.stats.damage;
  let e = run(3);
  ok(g && !g.air && g.y === K.groundAt(g.x, g.z), `gorillaen lander på jorden (y ${g.y.toFixed(1)})`);
  const x0 = g.x; e = e.concat(run(14));
  ok(e.length === 0 && Math.abs(g.x - x0) > 30 && K.stats.damage - d0 > 1e6 && bad() === 0, `gorillaen går ${Math.abs(g.x - x0).toFixed(0)} celler gennem byen: +${Math.round(K.stats.damage - d0).toLocaleString('da-DK')} kr., ${K.stats.fallen} bygninger faldt, ramt ${K.stats.hit}` + (e[0] ? ' ' + e[0] : ''));
  // hop: styr over hovedet
  const yMax0 = g.y; let yMax = g.y;
  K.steerMonster('gorilla', g.x + g.dir*10, g.y + 40);
  for(let k=0;k<180;k++){ K.step(1/60); yMax = Math.max(yMax, g.y); }
  ok(yMax > yMax0 + 8 && !g.air, `gorillaen hopper (op til ${(yMax - yMax0).toFixed(1)} celler) og lander igen`);
}
K.start('test-1');
{
  K.spawnMonster('kaiju', 300);
  const kj = K.monsters[0], d0 = K.stats.damage;
  run(3);
  const B = K.bld.filter(b => b && b.z0 < 15 && !b.fallen && (b.x0+b.x1)/2 < kj.x - 10 && (b.x0+b.x1)/2 > kj.x - 45)[0];
  const n0 = B ? B.n : 0;
  for(let k=0;k<30;k++){ if(B) K.steerMonster('kaiju', (B.x0+B.x1)/2, B.y0 + 8); run(.2); }
  const e = run(8);
  ok(e.length === 0 && K.stats.damage - d0 > 1e6 && (!B || B.n < n0) && bad() === 0, `kaiju med ildånde: +${Math.round(K.stats.damage - d0).toLocaleString('da-DK')} kr., målbygningen mistede ${B ? n0 - B.n : '?'} celler, ${K.burning.size} brænder` + (e[0] ? ' ' + e[0] : ''));
}
K.start('test-1');
{
  const B = K.bld.find(b => b && b.z0 < 15 && b.x0 > 100), d0 = K.stats.damage;
  K.spawnMonster('tentakel', (B.x0+B.x1)/2);
  let e = run(8);
  const m = K.monsters[0];
  ok(m && m.arms.every(a => a.pts.length === 15) && K.stats.damage - d0 > 200000, `tentaklerne vokser op og river i byen (+${Math.round(K.stats.damage - d0).toLocaleString('da-DK')} kr.)`);
  e = e.concat(run(14));
  ok(e.length === 0 && K.monsters.length === 0 && bad() === 0, 'tentaklerne trækker sig tilbage efter 18 s' + (e[0] ? ' ' + e[0] : ''));
}
for(const vm of ['side', 'iso']){
  K.setTheme('landsby'); K.start('b'); K.setView(vm);
  K.spawnMonster('gorilla', 60); K.spawnMonster('kaiju', 280); K.spawnMonster('tentakel', 170);
  let e = [];
  for(let k=0;k<20;k++){ e = e.concat(run(1)); try { if(vm === 'iso') K.redrawIso(K.WX); else K.redrawStatic(); K.draw(k); } catch(err){ e.push('draw ' + err.message); } }
  ok(e.length === 0 && bad() === 0, `${vm}: alle tre monstre samtidig uden fejl (${K.stats.fallen} faldt, ramt ${K.stats.hit})` + (e[0] ? ' ' + e[0] : ''));
}
K.setView('side'); K.setTheme('storby');

// 13) missioner: en automatisk spiller skal kunne klare alle 24 med de våben, missionen giver
function waitResult(maxSec){ const e = []; for(let k=0; k<maxSec*4 && !K.mission.result; k++) e.push(...run(.25)); return e; }
const standing = (pred) => K.bld.filter(b => b && !b.fallen && b.type !== 'kran' && (!pred || pred(b)));
const frontZat = (x, y) => { K.redrawStatic(); const f = K.frontZ[Math.round(x) + K.WX*Math.round(y)]; return f === 255 ? null : f; };
function c4Base(B, n){
  let placed = 0;
  for(let k=0; k<n; k++){
    const x = Math.round(B.x0 + .5 + (B.x1 - B.x0 - 1)*(n === 1 ? .5 : k/(n-1))), y = B.y0 + 2;
    let z = B.z0; for(; z <= B.z1; z++) if(K.mat[K.idx(x, y, z)]) break;
    if(z <= B.z1 && K.act('c4', {x, y, z})) placed++;
  }
  K.detonate(); return placed;
}
function topOf(B, dx){ const x = Math.round((B.x0+B.x1)/2 + (dx || 0)); for(let y = B.y1 + 12; y >= B.y0; y--) for(let z = B.z0; z <= B.z1; z++) if(K.mat[K.idx(x, y, z)] && K.bid[K.idx(x, y, z)] === B.id) return {x, y, z}; return {x, y:B.y0 + 2, z:B.z0}; }
function atBase(t, B, dy){ const x = Math.round((B.x0 + B.x1)/2), y = B.y0 + (dy || 2); let z = B.z0; for(; z <= B.z1; z++) if(K.mat[K.idx(x, y, z)]) break; return K.act(t, {x, y, z: Math.min(z, B.z1)}); }
const SOLVE = {
  s1(){ const B = standing(b => b.z0 < 15).sort((a, b) => a.n0 - b.n0)[0]; for(let k=0;k<5 && !K.mission.result;k++){ K.act('bombe', topOf(B)); run(2.5); } },
  s2(){ c4Base(K.bld[K.mission.targetId], 8); },
  s3(){ for(let k=0; k<120 && !K.mission.result; k++){ const f = standing(b => b.z0 < 15); const B = f[k % f.length]; atBase('raket', B, 2 + (k % 3)*3); run(.4); } },
  s4(){ for(let k=0;k<6;k++){ K.act('lyn', null, {x: K.WX*(k + .5)/6, y: 40}); run(1); } },
  s5(){},
  s6(){ const f = standing(b => b.z0 < 15 && b.x0 > 30).sort((a, b) => b.n0 - a.n0); for(let k=0;k<3;k++){ const B = f[k*2]; K.act('meteor', {x: Math.round((B.x0+B.x1)/2), y: B.y0 + 1, z: B.z0}); run(3); } },
  s7(){ const B = K.bld[K.mission.targetId]; const w = B.x1 - B.x0 + 1;
        K.holdAt('bor', k => { const x = B.x0 + (k % w), y = B.y0 + 2 + ((k / w) | 0) % 2; const z = frontZat(x, y); return {x, y, z: z === null ? B.z0 : z}; }, 20); },
  s8(){ for(let k=0; k<200 && !K.mission.result; k++){ const f = standing(); if(!f.length) break; const B = f[k % f.length]; K.act('mega', topOf(B)); atBase('raket', B); run(.4); } },
  h1(){ for(const B of K.bld.filter(b => b && b.type === 'kran')){ const x = B.x0 + 8; for(const lx of [x, x + 8]) for(const y of [K.GY + 2, K.GY + 12]) K.act('c4', {x: lx, y, z: 5}); } K.detonate(); },
  h2(){ for(let k=0;k<5;k++){ K.act('lyn', null, {x: K.WX*(k + .5)/5, y: 40}); run(.5); } },
  h3(){ for(const B of standing(b => b.type === 'pakhus').slice(0, 4)){ for(let f=1; f*4 < B.y1 - B.y0; f++) for(const fx of [.3, .7]){ const x = Math.round(B.x0 + (B.x1 - B.x0)*fx), y = B.y0 + 4*f, z = Math.round((B.z0 + B.z1)/2); K.act('ild', {x, y, z}); } } },
  h4(){ for(let k=0; k<14 && !K.mission.result; k++){ const c = K.cars.filter(c => !c.dead && c.st === 'drive' && c.x > 20 && c.x < K.WX - 20)[0]; if(!c) break; K.act(k < 8 ? 'raket' : 'bombe', {x: Math.round(c.x), y: c.y, z: c.z}); run(1.5); } },
  h5(){ const B = standing(b => b.z0 < 15 && b.x0 > 60)[0]; for(let k=0;k<4;k++){ K.act('bombe', topOf(B, (k-1.5)*3)); run(1.5); } run(3);
        K.act('ufo', null, {x:(B.x0+B.x1)/2, y:K.GY + 16}); run(3); K.setBeam(true);
        for(let k=0; k<60 && !K.mission.result; k++){ K.act('ufo', null, {x:(B.x0+B.x1)/2 + Math.sin(k*.4)*6, y:K.GY + 16}); run(1); } K.setBeam(false); },
  h6(){ K.act('gorilla', null, {x: 70, y: K.GY}); },
  h7(){ K.act('tornado', null, {x: 90, y: 20}); run(1); K.act('tornado', null, {x: 260, y: 20}); },
  h8(){ for(let k=0; k<220 && !K.mission.result; k++){ const f = standing(); if(!f.length) break; const B = f[k % f.length]; K.act('mega', topOf(B)); atBase('raket', B); if(k % 6 === 0) K.act('skaelv'); run(.4); } },
  l1(){ const B = K.bld[K.mission.targetId]; c4Base(B, 8); run(6); if(!K.mission.result){ for(let k=0;k<3;k++){ K.act('bombe', topOf(B, -(B.x1-B.x0)/2 + 3)); run(2); } } },
  l2(){ const hs = standing(b => b.type === 'træhus' && b.z0 < 15); const used = []; for(const B of hs){ if(used.length >= 3) break; const ok = K.act('ild', {x: Math.round((B.x0+B.x1)/2), y: B.y0 + 2, z: B.z0}); if(ok) used.push(B); }
        let k = 0; for(const B of hs.slice(3, 5)){ K.act('lyn', null, {x:(B.x0+B.x1)/2, y:30}); k++; } },
  l3(){ K.act('skaelv'); K.act('skaelv'); K.act('skaelv'); run(6); },
  l4(){ for(let k=0;k<6;k++){ K.act('lyn', null, {x: K.WX*(k + .5)/6, y: 40}); run(1); } },
  l5(){ const f = standing(b => b.z0 < 15 && b.x0 > 50); K.act('tentakel', null, {x:(f[0].x0 + f[0].x1)/2, y:K.GY}); run(19); if(!K.mission.result) K.act('tentakel', null, {x:(f[4].x0 + f[4].x1)/2, y:K.GY}); },
  l6(){ const f = standing(b => b.z0 < 15).sort((a, b) => b.n0 - a.n0); for(const B of f.slice(0, 2)){ K.act('sorthul', {x: Math.round((B.x0+B.x1)/2), y: B.y0 + 5, z: B.z0}); run(9); } },
  l7(){ K.act('tsunami'); run(26); for(const B of standing(b => b.z0 < 15).slice(0, 3)){ K.act('bombe', topOf(B)); run(2); } },
  l8(){ K.act('skaelv'); K.act('skaelv'); K.act('skaelv'); for(let k=0; k<220 && !K.mission.result; k++){ const f = standing(); if(!f.length) break; const B = f[k % f.length]; K.act('mega', topOf(B)); atBase('raket', B); run(.4); } }
};
K.setView('side'); K.resize();
for(const k in store) if(k === 'kkd-mis') delete store[k];
{
  const res = [];
  for(const M of K.MISSIONS){
    K.startMission(M.id);
    let e = [];
    try { SOLVE[M.id](); } catch(err){ e.push('løser: ' + err.stack.split('\n').slice(0,2).join(' | ')); }
    e = e.concat(waitResult(200));
    const r = K.mission.result;
    res.push(`${M.id}:${r ? (r.ok ? r.stars + '★' : 'FEJL(' + r.reason + ')') : 'ingen afslutning'}`);
    if(!(r && r.ok) || e.length) console.log(`  ${M.id} ${M.title}: ${r ? (r.ok ? 'ok' : r.reason) : 'ingen afslutning'} – ${K.mission.g ? K.mission.g.text : ''}` + (e[0] ? ' ' + e[0] : ''));
  }
  const failed = res.filter(r => !/★/.test(r));
  ok(failed.length === 0, `alle 24 missioner kan klares: ${res.join(' ')}`);
  const pr = K.misProgress();
  ok(K.MISSIONS.every(m => pr[m.id] >= 1) && K.MISSIONS.every(m => K.misUnlocked(m)), 'fremskridt gemt og alle baner låst op');
}
K.exitMission(); K.setTheme('storby');

// 14) byg selv
for(const k in store) if(k === 'kkd-designs' || k === 'kkd-mix') delete store[k];
K.exitMission(); K.setTheme('storby'); K.start('test-1'); K.setView('side');
{
  const d = K.newDesign(); d.name = 'Testtårn'; K.resizeDesign(d, 14, 9, 33); d.wall = 'beton'; d.roof = 'flad'; d.grid = K.autoWindows(14, 33);
  ok(K.validDesign(d) && K.designCells(d).length > 500, `design har ${K.designCells(d).length} celler`);
  const n0 = K.bld.filter(b => b && !b.gone).length;
  const b = K.placeDesign(d, 120, false);
  for(let i=0;i<K.N;i++) if(K.structural(K.mat[i])) K.seeds.push(i);
  let e = run(4);
  ok(b && e.length === 0 && !b.fallen && b.n === b.n0 && K.bodies.length === 0, `eget hus sat ind i forreste række og står stabilt (${b && b.n0} celler, erstattede ${n0 + 1 - K.bld.filter(x => x && !x.gone).length} hus(e))` + (e[0] ? ' ' + e[0] : ''));
  ok(K.people.filter(q => q.b === b.id).length > 0, `huset har beboere (${K.people.filter(q => q.b === b.id).length})`);
  // spræng det
  for(let k=0;k<3;k++){ K.explode(b.x0 + 2 + k*4, b.y0 + 3, b.z0, 7, 2.5); }
  e = run(8); for(let k=0;k<30 && K.bodies.length;k++) e.push(...run(1));
  ok(e.length === 0 && b.fallen, `eget hus kan vælte (${b.n}/${b.n0} celler tilbage)`);
  // bagerste række + skøre designs
  const weird = [
    Object.assign(K.newDesign(), {name:'Glashus', grid:'g'.repeat(10*17)}),
    Object.assign(K.newDesign(), {name:'Luft', grid:'.'.repeat(10*17), floors:false}),
    Object.assign(K.newDesign(), {name:'Stålboks', grid:'s'.repeat(10*17), wall:'træ'})
  ];
  let ok2 = true, msgs = [];
  weird.forEach((w, k) => { const bb = K.placeDesign(w, 40 + k*60, true); for(let i=0;i<K.N;i++) if(K.bid[i] === bb.id && K.structural(K.mat[i])) K.seeds.push(i); const ee = run(3); if(ee.length){ ok2 = false; msgs.push(ee[0]); } msgs.push(`${w.name}:${bb.fallen ? 'faldt' : 'står'}`); });
  ok(ok2 && bad() === 0, `skøre designs giver ingen fejl (${msgs.join(', ')})`);
  try { K.redrawStatic(); K.draw(0); K.setView('iso'); K.redrawIso(K.WX); K.draw(0); K.setView('side'); ok(true, 'egne huse kan tegnes i begge visninger'); } catch(err){ ok(false, 'tegning: ' + err.message); }
}
// gemte designs blandes ind i nye byer, og byerne står stabilt
{
  const a = K.newDesign(); a.name = 'Lille'; K.resizeDesign(a, 8, 6, 9);
  const b2 = K.newDesign(); b2.name = 'Høj'; K.resizeDesign(b2, 12, 10, 29); b2.wall = 'beton';
  K.saveDesigns([a, b2]); store['kkd-mix'] = '1';
  let mixed = 0, unstable = [];
  for(const sd of ['a', 'b', 'c', 'test-1']){
    K.start(sd); mixed += K.bld.filter(b => b && b.type === 'egen').length;
    for(let i=0;i<K.N;i++) if(K.structural(K.mat[i])) K.seeds.push(i);
    const e = run(3); if(e.length || K.bodies.length || K.stats.fallen) unstable.push(sd);
  }
  ok(mixed >= 3 && unstable.length === 0, `egne bygninger blandet ind i 4 byer (${mixed} stk.), alle stabile` + (unstable.length ? ' – ustabile: ' + unstable.join(',') : ''));
  K.startMission('s1'); ok(K.bld.every(b => !b || b.type !== 'egen'), 'missioner bruger ikke egne bygninger (faste baner)'); K.exitMission();
  store['kkd-mix'] = '0';
  K.start('test-1'); ok(K.bld.every(b => !b || b.type !== 'egen'), 'uden blanding: kun standardhuse');
}

console.log(fails ? `\n${fails} FEJL` : '\nALT OK');
process.exit(fails ? 1 : 0);
