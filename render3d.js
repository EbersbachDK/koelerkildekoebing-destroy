// Kølerkildekøbing Destroy – ægte 3D-visning med three.js.
// Indlæses først, når man vælger 3D. Spillets simulering er uændret: denne fil læser kun spillets tilstand (K) og tegner den.
// Byen deles i blokke (32 x 16 celler i bredde/højde, hele dybden). Kun synlige sider tegnes, med skygge i hjørnerne (AO).
import * as THREE from './vendor/three.module.min.js';

export function create(K, canvas, opt){
  const {WX, HY, DZ, GY, mat, bid} = K;
  const MM = 63, LOOSE = 128, LAYER = WX*DZ;
  const mobile = !!(opt && opt.mobile);

  // ---------------------------------------------------------------- renderer, scene, lys
  const renderer = new THREE.WebGLRenderer({canvas, antialias: !mobile, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !mobile; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fbbe3);
  scene.fog = new THREE.Fog(0xbcd6ea, 230, 700);
  const camera = new THREE.PerspectiveCamera(42, 1, .5, 2500);
  scene.add(new THREE.HemisphereLight(0xcfe4f7, 0x6d5a44, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(WX/2 - 120, 190, 120); sun.target.position.set(WX/2, 0, -16); scene.add(sun.target);
  sun.castShadow = !mobile; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -210, right: 210, top: 130, bottom: -130, near: 10, far: 600});
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .06;
  scene.add(sun);
  const land = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({color: 0x6f9a52, roughness: 1}));
  land.rotation.x = -Math.PI/2; land.position.set(WX/2, GY - .52, -16); land.receiveShadow = true; scene.add(land);

  // ---------------------------------------------------------------- teksturatlas (ét felt pr. materiale)
  const TILE = 128, ATL = 512;
  const atlas = (() => {
    const c = document.createElement('canvas'); c.width = c.height = ATL;
    const g = c.getContext('2d');
    let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
    const tile = (m, fn) => { g.save(); g.translate((m % 4)*TILE, ((m/4)|0)*TILE); g.beginPath(); g.rect(0, 0, TILE, TILE); g.clip(); fn(); g.restore(); };
    const noise = (base, amp, n, sz) => { g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, TILE, TILE); for(let k=0;k<n;k++){ const v = base + (rnd()-.5)*amp; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd()*TILE, rnd()*TILE, sz*(.5+rnd()), sz*(.5+rnd())); } };
    tile(1, () => noise(150, 70, 900, 6));
    tile(2, () => noise(210, 60, 1200, 4));
    tile(3, () => { noise(215, 50, 600, 3); g.strokeStyle = 'rgba(255,255,255,.35)'; for(let k=0;k<180;k++){ const x = rnd()*TILE, y = rnd()*TILE; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd()-.5)*4, y - 6 - rnd()*6); g.stroke(); } });
    tile(4, () => noise(200, 50, 2500, 2));
    tile(5, () => { noise(235, 18, 400, 3); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, TILE-3, TILE-3); g.beginPath(); g.moveTo(TILE/2, 0); g.lineTo(TILE/2, TILE); g.moveTo(0, TILE/2); g.lineTo(TILE, TILE/2); g.stroke(); });
    tile(6, () => { noise(238, 22, 700, 3); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(1, 1, TILE-2, TILE-2); });
    tile(7, () => { const gr = g.createLinearGradient(0, 0, TILE*.4, TILE); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.45, '#c9d6e2'); gr.addColorStop(.55, '#ffffff'); gr.addColorStop(1, '#9fb0c2'); g.fillStyle = gr; g.fillRect(0, 0, TILE, TILE);
      g.strokeStyle = '#5b6672'; g.lineWidth = 10; g.strokeRect(5, 5, TILE-10, TILE-10); g.lineWidth = 5; g.beginPath(); g.moveTo(TILE/2, 0); g.lineTo(TILE/2, TILE); g.stroke(); });
    tile(8, () => { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, TILE, TILE); const rows = 8, bh = TILE/rows, bw = TILE/3;
      for(let r=0; r<rows; r++) for(let k=-1; k<4; k++){ const x = k*bw + (r % 2 ? bw/2 : 0), v = 215 + (rnd()-.5)*50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 2, r*bh + 2, bw - 4, bh - 4); } });
    tile(9, () => { noise(215, 30, 300, 2); g.strokeStyle = 'rgba(255,255,255,.25)'; for(let y=0; y<TILE; y+=3){ g.beginPath(); g.moveTo(0, y); g.lineTo(TILE, y + (rnd()-.5)*2); g.stroke(); } g.fillStyle = 'rgba(0,0,0,.35)'; for(const [x, y] of [[12,12],[TILE-12,12],[12,TILE-12],[TILE-12,TILE-12]]){ g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); } });
    tile(10, () => { g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, TILE, TILE); const pw = TILE/4; for(let k=0; k<4; k++){ const v = 200 + (rnd()-.5)*40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(k*pw + 1, 0, pw - 2, TILE); g.strokeStyle = 'rgba(0,0,0,.12)'; for(let q=0;q<5;q++){ g.beginPath(); const x = k*pw + rnd()*pw; g.moveTo(x, 0); g.bezierCurveTo(x + 5, TILE*.3, x - 5, TILE*.7, x, TILE); g.stroke(); } } });
    tile(11, () => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, TILE, TILE); const rows = 6, rh = TILE/rows; for(let r=0; r<rows; r++) for(let k=-1; k<6; k++){ const x = k*(TILE/5) + (r % 2 ? TILE/10 : 0), v = 225 + (rnd()-.5)*30; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.moveTo(x, r*rh); g.lineTo(x + TILE/5 - 2, r*rh); g.quadraticCurveTo(x + TILE/5 - 2, r*rh + rh, x + TILE/10, r*rh + rh - 1); g.quadraticCurveTo(x, r*rh + rh, x, r*rh); g.fill(); } });
    tile(12, () => { noise(170, 60, 50, 4); for(let k=0;k<70;k++){ const v = 180 + rnd()*75; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(rnd()*TILE, rnd()*TILE, 8 + rnd()*14, 0, 7); g.fill(); } });
    tile(13, () => { noise(220, 20, 200, 3); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; for(let k=0;k<25;k++){ const x = rnd()*TILE, y = rnd()*TILE; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y - 3, x + 16, y); g.stroke(); } });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  })();
  const TUV = []; for(let m=0; m<16; m++){ const u0 = (m % 4)*TILE/ATL, v0 = 1 - (((m/4)|0) + 1)*TILE/ATL, e = 2/ATL; TUV[m] = [u0 + e, v0 + e, u0 + TILE/ATL - e, v0 + TILE/ATL - e]; }
  const voxMat = new THREE.MeshStandardMaterial({map: atlas, vertexColors: true, roughness: .82, metalness: 0});
  const LIN = new Uint8Array(256); for(let k=0; k<256; k++) LIN[k] = Math.round(Math.pow(k/255, 2.2)*255);

  // ---------------------------------------------------------------- sider: hjørner (three-koordinater), uv, nabo og AO-naboer (spil-koordinater)
  // three: X = x, Y = y, Z = -z. En side vender mod dir (three); naboen i spillet er (x+dx, y+dy, z-dz).
  const FACES = [
    {dir:[-1,0,0], c:[[0,1,0],[0,0,0],[0,1,1],[0,0,1]], uv:[[0,1],[0,0],[1,1],[1,0]]},
    {dir:[ 1,0,0], c:[[1,1,1],[1,0,1],[1,1,0],[1,0,0]], uv:[[0,1],[0,0],[1,1],[1,0]]},
    {dir:[0,-1,0], c:[[1,0,1],[0,0,1],[1,0,0],[0,0,0]], uv:[[1,0],[0,0],[1,1],[0,1]]},
    {dir:[0, 1,0], c:[[0,1,1],[1,1,1],[0,1,0],[1,1,0]], uv:[[1,1],[0,1],[1,0],[0,0]]},
    {dir:[0,0,-1], c:[[1,0,0],[0,0,0],[1,1,0],[0,1,0]], uv:[[0,0],[1,0],[0,1],[1,1]]},
    {dir:[0,0, 1], c:[[0,0,1],[1,0,1],[0,1,1],[1,1,1]], uv:[[0,0],[1,0],[0,1],[1,1]]}
  ];
  for(const F of FACES){
    F.g = [F.dir[0], F.dir[1], -F.dir[2]];
    const t = [0, 1, 2].filter(a => F.dir[a] === 0);
    F.ao = F.c.map(cc => {
      const s1 = [0, 0, 0], s2 = [0, 0, 0]; s1[t[0]] = cc[t[0]]*2 - 1; s2[t[1]] = cc[t[1]]*2 - 1;
      const g = v => [v[0], v[1], -v[2]];
      const a = g(s1), b = g(s2);
      return [a[0], a[1], a[2], b[0], b[1], b[2], a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    });
  }
  const AOF = [.42, .62, .82, 1];
  const solidG = (x, y, z) => y < 0 ? 1 : (x < 0 || x >= WX || y >= HY || z < 0 || z >= DZ) ? 0 : (mat[x + WX*(z + DZ*y)] !== 0 ? 1 : 0);

  // ---------------------------------------------------------------- byg et 3D-net for en blok (genbrugte buffere, ingen små objekter i løkken)
  const CX = 32, CY = 16, NX = Math.ceil(WX/CX), NY = Math.ceil(HY/CY);
  let cap = 24000;
  let sPos, sNor, sUV, sCol, sInd;
  const alloc = () => { sPos = new Float32Array(cap*12); sNor = new Int8Array(cap*12); sUV = new Float32Array(cap*8); sCol = new Uint8Array(cap*12); sInd = new Uint32Array(cap*6); };
  alloc();
  const aoTmp = [0, 0, 0, 0];
  function meshRegion(x0, x1, y0, y1){
    let f = 0;
    for(let y=y0; y<y1; y++) for(let z=0; z<DZ; z++){
      let i = x0 + WX*(z + DZ*y);
      for(let x=x0; x<x1; x++, i++){
        const v = mat[i]; if(!v) continue;
        // helt omsluttede celler springes over
        if(x > 0 && x < WX-1 && y > 0 && y < HY-1 && z > 0 && z < DZ-1 && mat[i-1] && mat[i+1] && mat[i-WX] && mat[i+WX] && mat[i-LAYER] && mat[i+LAYER]) continue;
        const m = v & MM;
        let ready = false, cr = 0, cg = 0, cb = 0, u0 = 0, v0 = 0, u1 = 0, v1 = 0;
        for(let fi=0; fi<6; fi++){
          const F = FACES[fi], nx = x + F.g[0], ny = y + F.g[1], nz = z + F.g[2];
          if(solidG(nx, ny, nz)) continue;
          if(!ready){
            const c = K.cellColor(m, bid[i], x, y, z, (v & LOOSE) !== 0, true);
            cr = LIN[c & 255]; cg = LIN[(c >> 8) & 255]; cb = LIN[(c >> 16) & 255];
            const T = TUV[m] || TUV[6]; u0 = T[0]; v0 = T[1]; u1 = T[2]; v1 = T[3]; ready = true;
          }
          if(f >= cap) return -1;
          const p = f*12, q = f*8, base = f*4;
          for(let k=0; k<4; k++){
            const cc = F.c[k], A = F.ao[k];
            sPos[p + k*3] = x - .5 + cc[0]; sPos[p + k*3 + 1] = y - .5 + cc[1]; sPos[p + k*3 + 2] = -z - .5 + cc[2];
            sNor[p + k*3] = F.dir[0]*127; sNor[p + k*3 + 1] = F.dir[1]*127; sNor[p + k*3 + 2] = F.dir[2]*127;
            sUV[q + k*2] = F.uv[k][0] ? u1 : u0; sUV[q + k*2 + 1] = F.uv[k][1] ? v1 : v0;
            const a1 = solidG(nx + A[0], ny + A[1], nz + A[2]), a2 = solidG(nx + A[3], ny + A[4], nz + A[5]), a3 = solidG(nx + A[6], ny + A[7], nz + A[8]);
            const a = (a1 && a2) ? 0 : 3 - (a1 + a2 + a3);
            aoTmp[k] = a; const kk = AOF[a];
            sCol[p + k*3] = cr*kk; sCol[p + k*3 + 1] = cg*kk; sCol[p + k*3 + 2] = cb*kk;
          }
          const ib = f*6;
          if(aoTmp[0] + aoTmp[3] > aoTmp[1] + aoTmp[2]){ sInd[ib] = base; sInd[ib+1] = base+1; sInd[ib+2] = base+3; sInd[ib+3] = base; sInd[ib+4] = base+3; sInd[ib+5] = base+2; }
          else { sInd[ib] = base; sInd[ib+1] = base+1; sInd[ib+2] = base+2; sInd[ib+3] = base+2; sInd[ib+4] = base+1; sInd[ib+5] = base+3; }
          f++;
        }
      }
    }
    return f;
  }
  function buildGeo(f){
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(sPos.slice(0, f*12), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(sNor.slice(0, f*12), 3, true));
    geo.setAttribute('uv', new THREE.BufferAttribute(sUV.slice(0, f*8), 2));
    geo.setAttribute('color', new THREE.BufferAttribute(sCol.slice(0, f*12), 3, true));
    geo.setIndex(new THREE.BufferAttribute(sInd.slice(0, f*6), 1));
    geo.computeBoundingSphere();
    return geo;
  }
  const chunks = new Array(NX*NY).fill(null), chunkList = [];
  function rebuild(cx, cy){
    const x0 = cx*CX, y0 = cy*CY;
    let f;
    while((f = meshRegion(x0, Math.min(WX, x0 + CX), y0, Math.min(HY, y0 + CY))) < 0){ cap *= 2; alloc(); }
    const k = cx + NX*cy;
    let mesh = chunks[k];
    if(!f){ if(mesh){ mesh.visible = false; } return; }
    const geo = buildGeo(f);
    if(!mesh){ mesh = new THREE.Mesh(geo, voxMat); mesh.castShadow = mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; chunks[k] = mesh; chunkList.push(mesh); scene.add(mesh); }
    else { mesh.geometry.dispose(); mesh.geometry = geo; mesh.visible = true; }
  }
  // ændringer findes ved at sammenligne med en kopi af byen
  let snap = new Uint8Array(mat.length).fill(255);
  const dirty = new Uint8Array(NX*NY).fill(1);
  function scanChanges(){
    const N = mat.length;
    for(let i=0; i<N; i++){
      if(mat[i] === snap[i]) continue;
      snap[i] = mat[i];
      const x = i % WX, y = (i / LAYER) | 0, cx = (x / CX) | 0, cy = (y / CY) | 0;
      dirty[cx + NX*cy] = 1;
      const lx = x - cx*CX, ly = y - cy*CY;
      if(lx === 0 && cx > 0) dirty[cx - 1 + NX*cy] = 1;
      if(lx === CX - 1 && cx < NX - 1) dirty[cx + 1 + NX*cy] = 1;
      if(ly === 0 && cy > 0) dirty[cx + NX*(cy - 1)] = 1;
      if(ly === CY - 1 && cy < NY - 1) dirty[cx + NX*(cy + 1)] = 1;
    }
  }
  const stats = {meshMs: 0, chunksBuilt: 0};
  function processDirty(budgetMs){
    const t0 = performance.now(); let n = 0;
    // ombyg de blokke, der er tættest på kameraets mål først
    const order = [];
    for(let k=0; k<dirty.length; k++) if(dirty[k]) order.push(k);
    if(!order.length) return;
    const tx = cam.tx;
    order.sort((a, b) => Math.abs((a % NX + .5)*CX - tx) - Math.abs((b % NX + .5)*CX - tx));
    let avg = stats.avgChunk || 3;
    for(const k of order){
      if(n > 0 && performance.now() - t0 + avg > budgetMs) break;
      const t1 = performance.now();
      dirty[k] = 0; rebuild(k % NX, (k / NX) | 0); n++;
      avg = stats.avgChunk = avg*.8 + (performance.now() - t1)*.2;
    }
    stats.meshMs = performance.now() - t0; stats.chunksBuilt += n;
  }

  // ---------------------------------------------------------------- faldende stykker: ét net pr. stykke
  const bodyMeshes = new Map();
  function meshBody(b){
    // belægning i et lille lokalt gitter (hurtigere end tekstnøgler)
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 99, z1 = -1;
    const RX = new Int16Array(b.n), RY = new Int16Array(b.n);
    for(let k=0; k<b.n; k++){ RX[k] = Math.round(b.lx[k]); RY[k] = Math.round(b.ly[k]); const z = b.lz[k]; if(RX[k] < x0) x0 = RX[k]; if(RX[k] > x1) x1 = RX[k]; if(RY[k] < y0) y0 = RY[k]; if(RY[k] > y1) y1 = RY[k]; if(z < z0) z0 = z; if(z > z1) z1 = z; }
    const nx = x1 - x0 + 3, ny = y1 - y0 + 3, nz = z1 - z0 + 3, occ = new Uint8Array(nx*ny*nz);
    const oi = (X, Y, Z) => (X - x0 + 1) + nx*((Z - z0 + 1) + nz*(Y - y0 + 1));
    for(let k=0; k<b.n; k++) occ[oi(RX[k], RY[k], b.lz[k])] = 1;
    let f = 0;
    for(let k=0; k<b.n; k++){
      const m = b.lm[k] & MM, X = RX[k], Y = RY[k], z = b.lz[k];
      let ready = false, cr = 0, cg = 0, cb = 0, T = null;
      for(const F of FACES){
        if(occ[oi(X + F.g[0], Y + F.g[1], z + F.g[2])]) continue;
        if(!ready){ const c = K.cellColor(m, b.lb[k], X, Y, z, false, true); cr = LIN[c & 255]; cg = LIN[(c >> 8) & 255]; cb = LIN[(c >> 16) & 255]; T = TUV[m] || TUV[6]; ready = true; }
        if(f >= cap){ cap *= 2; alloc(); return meshBody(b); }
        const p = f*12, q = f*8, base = f*4;
        for(let i=0; i<4; i++){
          const cc = F.c[i];
          sPos[p + i*3] = b.lx[k] - .5 + cc[0]; sPos[p + i*3 + 1] = b.ly[k] - .5 + cc[1]; sPos[p + i*3 + 2] = -z - .5 + cc[2];
          sNor[p + i*3] = F.dir[0]*127; sNor[p + i*3 + 1] = F.dir[1]*127; sNor[p + i*3 + 2] = F.dir[2]*127;
          sUV[q + i*2] = F.uv[i][0] ? T[2] : T[0]; sUV[q + i*2 + 1] = F.uv[i][1] ? T[3] : T[1];
          sCol[p + i*3] = cr; sCol[p + i*3 + 1] = cg; sCol[p + i*3 + 2] = cb;
        }
        const ib = f*6; sInd[ib] = base; sInd[ib+1] = base+1; sInd[ib+2] = base+2; sInd[ib+3] = base+2; sInd[ib+4] = base+1; sInd[ib+5] = base+3;
        f++;
      }
    }
    const mesh = new THREE.Mesh(buildGeo(f), voxMat); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    return mesh;
  }
  function syncBodies(){
    const live = new Set(K.bodies);
    for(const [b, mesh] of bodyMeshes) if(!live.has(b)){ scene.remove(mesh); mesh.geometry.dispose(); bodyMeshes.delete(b); }
    // nye stykker får deres net inden for et tidsbudget – resten i de næste billeder
    const t0 = performance.now();
    for(const b of K.bodies){
      let mesh = bodyMeshes.get(b);
      if(!mesh){ if(performance.now() - t0 > (mobile ? 4 : 6)) continue; mesh = meshBody(b); bodyMeshes.set(b, mesh); }
      mesh.position.set(b.cx, b.cy, 0); mesh.rotation.set(0, 0, b.a);
    }
  }

  // ---------------------------------------------------------------- hjælpere til instanser
  const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
  const colCache = new Map();
  const cssColor = s => { let c = colCache.get(s); if(!c){ c = new THREE.Color(s); colCache.set(s, c); } return c; };
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({color, roughness: .75}, extra || {}));
  function inst(geo, material, max, shadow){
    const m = new THREE.InstancedMesh(geo, material, max); m.count = 0; m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if(shadow){ m.castShadow = true; m.receiveShadow = true; } else m.receiveShadow = true;
    scene.add(m); return m;
  }
  const hide = (mesh, i) => { dummy.position.set(0, -999, 0); dummy.scale.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); };

  // ---------------------------------------------------------------- figurer
  const PMAX = 600;
  const box = (w, h, d, y) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y, 0); return g; };
  const pTorso = inst(box(.7, .8, .45, 1.05), std(0xffffff), PMAX, true);
  const pLegs = inst(box(.6, .7, .4, .35), std(0x2d3142), PMAX, false);
  const pHead = inst((() => { const g = new THREE.SphereGeometry(.3, 10, 8); g.translate(0, 1.72, 0); return g; })(), std(0xffffff), PMAX, false);
  let peopleRef = null;
  function syncPeople(t){
    const P = K.people, n = Math.min(P.length, PMAX);
    if(peopleRef !== P || pTorso.count !== n){
      peopleRef = P;
      for(let k=0; k<n; k++){ pTorso.setColorAt(k, cssColor(P[k].shirt)); pHead.setColorAt(k, cssColor(P[k].skin)); }
      if(pTorso.instanceColor) pTorso.instanceColor.needsUpdate = true; if(pHead.instanceColor) pHead.instanceColor.needsUpdate = true;
    }
    pTorso.count = pLegs.count = pHead.count = n;
    for(let k=0; k<n; k++){
      const p = P[k];
      if(p.st === 'saved' || p.st === 'lost'){ hide(pTorso, k); hide(pLegs, k); hide(pHead, k); continue; }
      const run = p.st === 'flee' || p.st === 'cross' || p.st === 'toStairs';
      dummy.position.set(p.x, p.y - .5 + (run ? Math.abs(Math.sin(p.t*16))*.15 : 0), -p.z);
      dummy.scale.set(1, 1, 1);
      if(p.st === 'dizzy') dummy.rotation.set(0, 0, Math.PI/2);
      else if(p.st === 'fly' || p.st === 'beam' || p.st === 'held') dummy.rotation.set(0, 0, p.rot || 0);
      else dummy.rotation.set(0, (p.dir || 1) > 0 ? Math.PI/2 : -Math.PI/2, 0);
      dummy.updateMatrix();
      pTorso.setMatrixAt(k, dummy.matrix); pLegs.setMatrixAt(k, dummy.matrix); pHead.setMatrixAt(k, dummy.matrix);
      if(p.st === 'dizzy') for(let s=0; s<3; s++){ const a = t*4 + s*2.1; addSprite(true, p.x + 1.3 + Math.cos(a)*.6, p.y + .2, p.z + Math.sin(a)*.6, 1, .85, .1, .9, .55); }
    }
    pTorso.instanceMatrix.needsUpdate = pLegs.instanceMatrix.needsUpdate = pHead.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- biler og busser
  const VMAX = 64;
  const vBody = inst(new THREE.BoxGeometry(1, 1, 1), std(0xffffff, {roughness: .45, metalness: .2}), VMAX, true);
  const vCab = inst(new THREE.BoxGeometry(1, 1, 1), std(0x9fc6dc, {roughness: .15, metalness: .3}), VMAX, false);
  const vWheel = inst((() => { const g = new THREE.CylinderGeometry(.42, .42, 1.7, 10); g.rotateX(Math.PI/2); return g; })(), std(0x151515), VMAX*2, false);
  const qI = new THREE.Quaternion(), qv = new THREE.Quaternion(), ev = new THREE.Euler(), mv = new THREE.Matrix4(), mloc = new THREE.Matrix4(), vecS = new THREE.Vector3(), vecP = new THREE.Vector3();
  function syncVehicles(){
    const V = K.cars.concat(K.buses), n = Math.min(V.length, VMAX);
    vBody.count = vCab.count = n; vWheel.count = n*2;
    for(let k=0; k<n; k++){
      const v = V[k];
      if(v.st === 'away' || v.st === 'lost'){ hide(vBody, k); hide(vCab, k); hide(vWheel, k*2); hide(vWheel, k*2 + 1); continue; }
      const dead = v.st === 'wreck' || (v.st === 'fly' && v.dead);
      const L = v.len, H = v.bus ? 2.6 : 1.3, W = v.bus ? 2.3 : 1.7;
      ev.set(0, v.dir < 0 ? Math.PI : 0, (v.st === 'fly' || v.st === 'wreck' || v.st === 'beam' || v.st === 'held') ? (v.rot || 0)*(v.dir < 0 ? -1 : 1) : 0);
      qv.setFromEuler(ev);
      mv.compose(vecP.set(v.x, v.y - .5, -v.z), qv, vecS.set(1, 1, 1));
      // karrosseri
      mloc.compose(vecP.set(0, .25 + H*(v.bus ? .45 : .32), 0), qI, vecS.set(L, v.bus ? H*.85 : H*.5, W)); dummy.matrix.multiplyMatrices(mv, mloc); vBody.setMatrixAt(k, dummy.matrix);
      vBody.setColorAt(k, dead ? tmpC.set(0x2e2e2e) : cssColor(v.col));
      // kabine / vinduesbånd
      if(v.bus) mloc.compose(vecP.set(0, .25 + H*.62, 0), qI, vecS.set(L*.96, H*.3, W*1.02));
      else mloc.compose(vecP.set(-L*.04, .25 + H*.78, 0), qI, vecS.set(L*.55, H*.42, W*.92));
      dummy.matrix.multiplyMatrices(mv, mloc); vCab.setMatrixAt(k, dummy.matrix);
      vCab.setColorAt(k, dead ? tmpC.set(0x1a1a1a) : tmpC.set(0xbfe3f2));
      for(let w=0; w<2; w++){ mloc.compose(vecP.set((w ? .3 : -.3)*L, .42, 0), qI, vecS.set(1, 1, W/1.7)); dummy.matrix.multiplyMatrices(mv, mloc); vWheel.setMatrixAt(k*2 + w, dummy.matrix); }
    }
    vBody.instanceMatrix.needsUpdate = vCab.instanceMatrix.needsUpdate = vWheel.instanceMatrix.needsUpdate = true;
    if(vBody.instanceColor) vBody.instanceColor.needsUpdate = true; if(vCab.instanceColor) vCab.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- partikler: små klodser + bløde lys-/røgpletter
  const DMAX = 3500;
  const debris = inst(new THREE.BoxGeometry(1, 1, 1), std(0xffffff), DMAX, false);
  const SMAX = 9000;
  function spriteSystem(additive){
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SMAX*3), col = new Float32Array(SMAX*3), alpha = new Float32Array(SMAX), size = new Float32Array(SMAX);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.ShaderMaterial({
      uniforms: {scale: {value: 600}},
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix*vec4(position, 1.0); gl_PointSize = size*scale/max(1.0, -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d)*4.0; if(r > 1.0) discard; float s = 1.0 - r; gl_FragColor = vec4(vC, vA*s*${additive ? 's' : '(0.6 + 0.4*s)'}); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    const pts = new THREE.Points(geo, material); pts.frustumCulled = false; pts.renderOrder = additive ? 3 : 2; scene.add(pts);
    return {pts, pos, col, alpha, size, n: 0, geo, material};
  }
  const sprN = spriteSystem(false), sprA = spriteSystem(true);
  function addSprite(add, x, y, z, r, g, b, a, sz){
    const S = add ? sprA : sprN; if(S.n >= SMAX) return;
    const i = S.n++;
    S.pos[i*3] = x; S.pos[i*3 + 1] = y; S.pos[i*3 + 2] = -z;
    S.col[i*3] = r; S.col[i*3 + 1] = g; S.col[i*3 + 2] = b; S.alpha[i] = a; S.size[i] = sz;
  }
  function flushSprites(S){
    S.geo.setDrawRange(0, S.n);
    for(const k of ['position', 'color', 'alpha', 'size']) S.geo.attributes[k].needsUpdate = true;
  }
  function syncParticles(t){
    let d = 0;
    for(const p of K.parts){
      const a = p.life/p.max, pz = p.z === undefined ? 9 : p.z;
      switch(p.k){
        case 'deb': case 'suck': case 'beamup':
          if(d < DMAX){ const s = p.s || .55; dummy.position.set(p.x, p.y, -pz); dummy.rotation.set(p.rot || 0, (p.rot || 0)*.7, 0); dummy.scale.set(s, s, s); dummy.updateMatrix(); debris.setMatrixAt(d, dummy.matrix); debris.setColorAt(d, cssColor(p.col)); d++; }
          break;
        case 'spark': addSprite(true, p.x, p.y, pz, 1, .85, .45, a, .5); break;
        case 'dust': addSprite(false, p.x, p.y, pz, .59, .55, .5, a*.55, p.r*2.4); break;
        case 'smoke': addSprite(false, p.x, p.y, pz, .78, .78, .78, a*.5, p.r*2.4); break;
        case 'fire': addSprite(true, p.x, p.y, pz, 1, (140 + 100*a)/255, .16*a, a*.9, p.r*2.6*(1.4 - a*.4)); break;
        case 'flame': addSprite(true, p.x, p.y, pz, 1, (120 + 120*a)/255, .12*a, a*.85, Math.max(.6, p.r*2.4)); break;
        case 'flash': addSprite(true, p.x, p.y, pz, 1, .98, .86, a, p.r*2.4); break;
      }
    }
    debris.count = d; debris.instanceMatrix.needsUpdate = true; if(debris.instanceColor) debris.instanceColor.needsUpdate = true;
  }

  // ---------------------------------------------------------------- C4, projektiler, mål
  const c4 = inst(new THREE.BoxGeometry(1.1, .7, .3), std(0x3d4a2c), 16, false);
  const c4led = inst(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshBasicMaterial({color: 0xff3b30}), 16, false);
  function syncCharges(t){
    const C = K.charges; c4.count = c4led.count = C.length;
    C.forEach((c, k) => {
      dummy.position.set(c.x, c.y, -(c.z - .62)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); c4.setMatrixAt(k, dummy.matrix);
      const on = c.armed ? (t*12 % 1) < .5 : (t*2 % 1) < .5;
      dummy.position.set(c.x + .35, c.y, -(c.z - .8)); dummy.scale.setScalar(on ? 1 : .3); dummy.updateMatrix(); c4led.setMatrixAt(k, dummy.matrix);
    });
    c4.instanceMatrix.needsUpdate = c4led.instanceMatrix.needsUpdate = true;
  }
  const shotMeshes = new Map();
  function shotMesh(s){
    const g = new THREE.Group();
    if(s.kind === 'raket'){
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, 2.4, 10), std(0xe8e2d6)); body.rotation.z = Math.PI/2; g.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.32, .7, 10), std(0xdd3333)); tip.rotation.z = -Math.PI/2; tip.position.x = 1.55; g.add(tip);
    } else if(s.kind === 'meteor'){
      g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 1), std(0x3a2a22, {emissive: 0xff5a10, emissiveIntensity: .8})));
    } else if(s.kind === 'atom' || s.kind === 'brint'){
      const r = s.kind === 'brint' ? 1.1 : .9;
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(r*.8, r*.8, 4, 10), std(0x3a4048)); g.add(b);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r*.82, r*.82, r*.4, 12), std(0xffd60a)); g.add(band);
      const chute = new THREE.Mesh(new THREE.SphereGeometry(r*3, 16, 8, 0, Math.PI*2, 0, Math.PI/2), std(0xf4f1e6, {side: THREE.DoubleSide})); chute.scale.y = .45; chute.position.y = r*4.4; g.add(chute);
      const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, r, 0), new THREE.Vector3(-r*2.6, r*4.3, 0), new THREE.Vector3(0, r, 0), new THREE.Vector3(r*2.6, r*4.3, 0), new THREE.Vector3(0, r, 0), new THREE.Vector3(0, r*4.3, r*2.6), new THREE.Vector3(0, r, 0), new THREE.Vector3(0, r*4.3, -r*2.6)]), new THREE.LineBasicMaterial({color: 0xdddddd}));
      g.add(lines);
    } else {
      const r = s.kind === 'mega' ? 1.4 : .9;
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), std(0x2a2f36)); b.scale.y = 1.4; g.add(b);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(r*1.4, r*.6, r*1.4), std(0x545c66)); fin.position.y = r*1.8; g.add(fin);
    }
    g.traverse(o => { if(o.isMesh) o.castShadow = true; });
    scene.add(g); return g;
  }
  function syncShots(){
    const live = new Set(K.shots);
    for(const [s, g] of shotMeshes) if(!live.has(s)){ scene.remove(g); shotMeshes.delete(s); }
    for(const s of K.shots){
      let g = shotMeshes.get(s); if(!g){ g = shotMesh(s); shotMeshes.set(s, g); }
      g.position.set(s.x, s.y, -s.z);
      if(s.kind === 'raket'){ g.rotation.set(0, 0, Math.atan2(s.vy, s.vx)); addSprite(true, s.x - s.vx*.012, s.y - s.vy*.012, s.z, 1, .7, .3, .9, 1.6); }
      if(s.kind === 'meteor') addSprite(true, s.x, s.y, s.z, 1, .55, .15, .9, 7);
    }
  }
  const target = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 12), new THREE.MeshBasicMaterial({color: 0xff3b30})); target.rotation.x = Math.PI; target.visible = false; scene.add(target);
  function syncTarget(t){
    const M = K.mission, b = M && M.targetId ? K.bld[M.targetId] : null;
    target.visible = !!(b && !b.fallen);
    if(target.visible) target.position.set((b.x0 + b.x1)/2, b.y1 + 5 + Math.sin(t*4), -(b.z0 + b.z1)/2);
  }

  // ---------------------------------------------------------------- natur: tornado, tsunami, oversvømmelse, lyn
  const waterMat = new THREE.MeshStandardMaterial({color: 0x2a72b8, roughness: .15, metalness: .1, transparent: true, opacity: .78});
  const waves = [];
  const flood = inst(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: 0x2f7cc4, roughness: .1, transparent: true, opacity: .55}), WX, false);
  const boltMat = new THREE.LineBasicMaterial({color: 0xffffee});
  const boltLines = [];
  function syncNature(t){
    // tornado: tragt af grå skyer, der snurrer
    for(const tn of K.tornados){
      for(let hh=0; hh<56; hh+=1.6){
        const r = 2 + hh*.12, sway = Math.sin(hh*.15 + t*3)*1.2;
        for(let k=0; k<5; k++){ const a = t*5 + k*1.257 + hh*.3; addSprite(false, tn.x + sway + Math.cos(a)*r, GY + hh, tn.z + Math.sin(a)*r, .46, .46, .49, .22, r*1.3); }
      }
      for(const d of tn.debris){ /* brokkerne vises som partikler i spillets egen liste, når de slynges ud */ addSprite(false, tn.x + Math.cos(d.a)*d.r, GY + d.h, tn.z + Math.sin(d.a)*d.r, .35, .3, .26, .9, .8); }
    }
    // tsunami: en vandvæg, der skyller frem
    const W = K.waves;
    while(waves.length < W.length){ const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), waterMat); m.castShadow = true; scene.add(m); waves.push(m); }
    waves.forEach((m, k) => {
      const w = W[k]; m.visible = !!w; if(!w) return;
      m.scale.set(40, w.H, DZ + 2); m.position.set(w.x - 20, GY - .5 + w.H/2, -DZ/2 + .5);
      addSprite(false, w.x, GY + w.H, 0, 1, 1, 1, .8, 4); addSprite(false, w.x, GY + w.H, DZ/2, 1, 1, 1, .7, 4);
    });
    // oversvømmelse
    const F = K.floodH; let fc = 0;
    for(let x=0; x<WX; x++){ const h = F[x]; if(h <= .05) continue; dummy.position.set(x, GY - .5 + h/2, -DZ/2 + .5); dummy.rotation.set(0, 0, 0); dummy.scale.set(1.02, h, DZ); dummy.updateMatrix(); flood.setMatrixAt(fc++, dummy.matrix); }
    flood.count = fc; flood.instanceMatrix.needsUpdate = true;
    // lyn
    const B = K.bolts || [];
    while(boltLines.length < B.length){ const l = new THREE.Line(new THREE.BufferGeometry(), boltMat); l.frustumCulled = false; scene.add(l); boltLines.push(l); }
    boltLines.forEach((l, k) => { const b = B[k]; l.visible = !!b; if(!b) return; l.geometry.setFromPoints(b.pts.map(([x, y]) => new THREE.Vector3(x, y, -b.z))); });
  }

  // ---------------------------------------------------------------- sci-fi: laser, sorte huller, UFO
  const laserOuter = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), new THREE.MeshBasicMaterial({color: 0xff4f7a, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false}));
  const laserCore = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), new THREE.MeshBasicMaterial({color: 0xfff0f4}));
  scene.add(laserOuter, laserCore);
  const holeMeshes = [];
  const ufoG = new THREE.Group();
  {
    const saucer = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), std(0x9aa3ad, {metalness: .7, roughness: .3})); saucer.scale.set(5, 1.2, 5); ufoG.add(saucer);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 10, 0, Math.PI*2, 0, Math.PI/2), new THREE.MeshStandardMaterial({color: 0x96e6ff, transparent: true, opacity: .7, roughness: .1})); dome.position.y = .6; ufoG.add(dome);
    for(let k=0; k<8; k++){ const l = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), new THREE.MeshBasicMaterial({color: 0xffe45e})); l.position.set(Math.cos(k*Math.PI/4)*4.2, -.2, Math.sin(k*Math.PI/4)*4.2); ufoG.add(l); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 3.2, 1, 20, 1, true), new THREE.MeshBasicMaterial({color: 0xbfff78, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    beam.name = 'beam'; ufoG.add(beam);
    ufoG.traverse(o => { if(o.isMesh && o.name !== 'beam') o.castShadow = true; });
    ufoG.visible = false; scene.add(ufoG);
  }
  function syncScifi(t){
    const L = K.laser;
    const on = !!(L && L.on && L.hit);
    laserOuter.visible = laserCore.visible = on;
    if(on){
      const y0 = L.y + .5, y1 = HY + 60, h = y1 - y0, mid = (y0 + y1)/2;
      laserOuter.scale.set(1.1, h, 1.1); laserOuter.position.set(L.x, mid, -L.z + .5);
      laserCore.scale.set(.3, h, .3); laserCore.position.set(L.x, mid, -L.z + .5);
      addSprite(true, L.x, y0, L.z - .5, 1, .8, .85, 1, 9);
    }
    const H = K.holes;
    while(holeMeshes.length < H.length){
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({color: 0x000000})));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, .12, 8, 48), new THREE.MeshBasicMaterial({color: 0xffaa50})); ring.rotation.x = Math.PI/2.3; ring.name = 'ring'; g.add(ring);
      scene.add(g); holeMeshes.push(g);
    }
    holeMeshes.forEach((g, k) => { const hl = H[k]; g.visible = !!hl; if(!hl) return; const r = Math.max(.1, hl.r); g.position.set(hl.x, hl.y, -hl.z); g.scale.setScalar(r*.75); g.getObjectByName('ring').rotation.z = hl.spin*.4; addSprite(true, hl.x, hl.y, hl.z, .6, .35, 1, .55, r*4.5); });
    const U = K.ufo;
    ufoG.visible = !!U;
    if(U){
      ufoG.position.set(U.x, U.y, -U.z); ufoG.rotation.set(0, t*.6, Math.max(-.3, Math.min(.3, -U.vx*.02)));
      const beam = ufoG.getObjectByName('beam'), h = Math.max(1, U.y - GY);
      beam.visible = !!U.beam; beam.scale.set(1, h, 1); beam.position.y = -h/2;
    }
  }

  // ---------------------------------------------------------------- monstre: gorilla og kaiju af klodser, tentakler af cylindre
  const monsterGroups = new Map();
  function gorillaModel(){
    const g = new THREE.Group(), fur = std(0x2b2422, {roughness: .95}), face = std(0x6b5a52), eye = new THREE.MeshBasicMaterial({color: 0xff3b30});
    const part = (geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if(name) o.name = name; o.castShadow = true; g.add(o); return o; };
    part(new THREE.BoxGeometry(.16, .34, .18), fur, -.1, .17, 0, 'legL'); part(new THREE.BoxGeometry(.16, .34, .18), fur, .1, .17, 0, 'legR');
    part(new THREE.BoxGeometry(.56, .55, .4), fur, 0, .58, 0);
    part(new THREE.BoxGeometry(.3, .3, .05), face, .0, .6, .2);
    part(new THREE.SphereGeometry(.14, 12, 10), fur, 0, .92, .05);
    part(new THREE.BoxGeometry(.16, .12, .06), face, 0, .9, .18);
    part(new THREE.SphereGeometry(.02, 6, 6), eye, -.05, .95, .19); part(new THREE.SphereGeometry(.02, 6, 6), eye, .05, .95, .19);
    const arm = (side, name) => { const pivot = new THREE.Group(); pivot.position.set(side*.32, .78, 0); pivot.name = name; const a = new THREE.Mesh(new THREE.BoxGeometry(.13, .5, .14), fur); a.position.y = -.25; a.castShadow = true; pivot.add(a); g.add(pivot); };
    arm(-1, 'armL'); arm(1, 'armR');
    return g;
  }
  function kaijuModel(){
    const g = new THREE.Group(), skin = std(0x3f5a48, {roughness: .9}), belly = std(0x56785f), spike = std(0xcfd8d2, {emissive: 0x2bb8ff, emissiveIntensity: 0});
    const part = (geo, m, x, y, z, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); if(name) o.name = name; o.castShadow = true; g.add(o); return o; };
    part(new THREE.BoxGeometry(.13, .3, .16), skin, -.09, .15, 0, 'legL'); part(new THREE.BoxGeometry(.13, .3, .16), skin, .09, .15, 0, 'legR');
    const body = part(new THREE.SphereGeometry(.22, 16, 12), skin, 0, .5, 0); body.scale.set(.9, 1.25, .8);
    const b2 = part(new THREE.SphereGeometry(.16, 12, 10), belly, .05, .5, .09); b2.scale.set(.6, 1.1, .6);
    const head = part(new THREE.SphereGeometry(.11, 12, 10), skin, .12, .83, 0); head.scale.set(1.3, .8, .8);
    part(new THREE.BoxGeometry(.14, .04, .12), skin, .24, .79, 0, 'jaw');
    const tail = part(new THREE.ConeGeometry(.1, .7, 10), skin, -.45, .2, 0); tail.rotation.z = 1.25;
    part(new THREE.BoxGeometry(.12, .05, .06), skin, .16, .62, .1);
    for(let k=0; k<6; k++){ const s = part(new THREE.ConeGeometry(.04, .12, 6), spike, -.12 - k*.06, .76 - k*.08, 0); s.rotation.z = .6; }
    g.userData.spike = spike;
    return g;
  }
  const tentMesh = inst((() => { const gg = new THREE.CylinderGeometry(1, 1, 1, 10); return gg; })(), std(0x6e2a7d, {roughness: .5}), 64, true);
  function syncMonsters(t){
    const live = new Set();
    let tc = 0;
    for(const m of K.monsters){
      if(m.type === 'tentakel'){
        for(const a of m.arms){
          for(let k=1; k<a.pts.length; k++){
            const [x0, y0] = a.pts[k-1], [x1, y1] = a.pts[k], w = Math.max(.6, 2.6 - k*.13), len = Math.hypot(x1 - x0, y1 - y0);
            if(tc >= 64) break;
            dummy.position.set((x0 + x1)/2, (y0 + y1)/2, -m.z); dummy.rotation.set(0, 0, Math.atan2(y1 - y0, x1 - x0) - Math.PI/2); dummy.scale.set(w*.9, len + .4, w*.9); dummy.updateMatrix(); tentMesh.setMatrixAt(tc++, dummy.matrix);
          }
        }
        continue;
      }
      live.add(m);
      let g = monsterGroups.get(m);
      if(!g){ g = m.type === 'gorilla' ? gorillaModel() : kaijuModel(); monsterGroups.set(m, g); scene.add(g); }
      const H = K.MON_DEF[m.type].h, walk = Math.sin(m.t*(m.type === 'kaiju' ? 3 : 5))*(m.air ? 0 : 1);
      g.scale.setScalar(H); g.position.set(m.x, m.y - .5, -m.z); g.rotation.set(0, m.dir < 0 ? Math.PI : 0, 0);
      const L = g.getObjectByName('legL'), R = g.getObjectByName('legR');
      if(L) L.rotation.z = walk*.35; if(R) R.rotation.z = -walk*.35;
      if(m.type === 'gorilla'){ g.getObjectByName('armR').rotation.z = m.swing > 0 ? 1.7 : .2 + walk*.3; g.getObjectByName('armL').rotation.z = -.2 - walk*.3; }
      else { g.userData.spike.emissiveIntensity = m.breath > 0 ? 1.5 : 0; const j = g.getObjectByName('jaw'); if(j) j.rotation.z = m.breath > 0 ? -.35 : 0; }
    }
    for(const [m, g] of monsterGroups) if(!live.has(m)){ scene.remove(g); monsterGroups.delete(m); }
    tentMesh.count = tc; tentMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- atomsvampe: bløde lysende kugler (samme forløb som i 2D)
  function syncNukes(){
    for(const n of K.nukes){
      const T = n.t, life = n.big ? 22 : 17, fade = Math.min(1, (life - T)/4), R = n.r*(n.big ? 1.25 : 1), gy = Math.max(GY, n.y - (n.big ? 0 : 2));
      const heat = Math.max(0, 1 - T/5), rise = Math.min(1, T/7), capY = gy + R*(.5 + 1.9*rise), capR = R*(.45 + .55*Math.min(1, T/5));
      const blob = (x, y, z, r, hot) => { const h = Math.max(0, Math.min(1, hot)); addSprite(false, x, y, z, (255*h + 150*(1-h))/255, (180*h + 145*(1-h))/255, (90*h + 138*(1-h))/255, fade*.92, r*2.3); if(h > .3) addSprite(true, x, y, z, 1, .55, .15, h*fade*.5, r*1.8); };
      if(T < 1.2){ blob(n.x, gy + R*.3, n.z, R*(.4 + T*.5), 1); addSprite(true, n.x, gy + R*.3, n.z, 1, .95, .8, 1 - T/1.2, R*3); continue; }
      for(let k=0; k<9; k++){ const q = k/8, wy = gy + (capY - gy)*q*.92, w = R*(.22 + .1*Math.sin(q*3 + T))*(1 - q*.35); blob(n.x + Math.sin(q*5 + T*.7)*R*.05, wy, n.z, w, heat*(1 - q*.4) + .15*(1 - q)); }
      for(let k=0; k<14; k++){ const a = k/14*Math.PI*2 + T*.15; blob(n.x + Math.cos(a)*capR*.85, capY + Math.sin(T + k)*capR*.08, n.z + Math.sin(a)*capR*.85, capR*.45, heat*.9 + .1); }
      blob(n.x, capY + capR*.2, n.z, capR*.65, heat + .15);
      if(T < 2.2){ const rr = R*(.4 + T*1.6), a = 1 - T/2.2; for(let k=0; k<24; k++){ const ang = k/24*Math.PI*2; addSprite(false, n.x + Math.cos(ang)*rr, GY + .5, n.z + Math.sin(ang)*rr, .85, .82, .78, a*.6, 5); } }
    }
  }

  // ---------------------------------------------------------------- kamera: drej, flyt, zoom
  const cam = {tx: WX/2, ty: 22, tz: -16, yaw: .24, pitch: .3, dist: 178};
  const clampCam = () => {
    cam.pitch = Math.max(.04, Math.min(1.45, cam.pitch)); cam.dist = Math.max(14, Math.min(520, cam.dist));
    cam.tx = Math.max(0, Math.min(WX, cam.tx)); cam.ty = Math.max(GY, Math.min(70, cam.ty)); cam.tz = Math.max(-DZ - 10, Math.min(10, cam.tz));
  };
  function placeCamera(shake){
    const cp = Math.cos(cam.pitch);
    camera.position.set(cam.tx + Math.sin(cam.yaw)*cp*cam.dist, cam.ty + Math.sin(cam.pitch)*cam.dist, cam.tz + Math.cos(cam.yaw)*cp*cam.dist);
    if(shake > .05){ const k = shake*.04; camera.position.x += (Math.random() - .5)*k; camera.position.y += (Math.random() - .5)*k; }
    camera.lookAt(cam.tx, cam.ty, cam.tz);
  }
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  function orbit(dx, dy){ cam.yaw -= dx*.006; cam.pitch += dy*.005; clampCam(); }
  function pan(dx, dy){
    camera.updateMatrixWorld(); right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
    const k = cam.dist*.0016;
    cam.tx -= right.x*dx*k - up.x*dy*k; cam.ty -= right.y*dx*k - up.y*dy*k; cam.tz -= right.z*dx*k - up.z*dy*k; clampCam();
  }
  function zoom(f){ cam.dist /= f; clampCam(); }

  // ---------------------------------------------------------------- sigte: skærmpunkt -> celle / punkt
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitP = new THREE.Vector3();
  function setRay(sx, sy){ const r = canvas.getBoundingClientRect(); ndc.set(sx/r.width*2 - 1, -(sy/r.height)*2 + 1); camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera); }
  function pick(sx, sy){
    setRay(sx, sy);
    const hit = ray.intersectObjects(chunkList.filter(m => m.visible), false)[0];
    if(!hit) return null;
    const p = hit.point.clone().addScaledVector(hit.face.normal, -.5);
    const x = Math.round(p.x), y = Math.round(p.y), z = -Math.round(p.z);
    if(x < 0 || x >= WX || y < 0 || y >= HY || z < 0 || z >= DZ) return null;
    return {x, y, z};
  }
  function ground(sx, sy){ setRay(sx, sy); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(GY - .5)); if(!ray.ray.intersectPlane(pl, hitP)) return null; return {x: hitP.x, z: Math.max(0, Math.min(DZ-1, -hitP.z))}; }
  function planeZ(sx, sy, zg){ setRay(sx, sy); const pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), zg); if(!ray.ray.intersectPlane(pl, hitP)) return {x: cam.tx, y: cam.ty}; return {x: hitP.x, y: hitP.y}; }

  // ---------------------------------------------------------------- størrelse og billedløkke
  function resize(){
    const r = canvas.getBoundingClientRect(), w = Math.max(100, r.width), h = Math.max(100, r.height);
    renderer.setSize(w, h, false); camera.aspect = w/h; camera.updateProjectionMatrix();
    const s = h*renderer.getPixelRatio()/(2*Math.tan(camera.fov*Math.PI/360));
    sprN.material.uniforms.scale.value = sprA.material.uniforms.scale.value = s;
  }
  let frameN = 0;
  function render(dt){
    if(canvas.width < 2) resize();
    if(++frameN % 2 === 0 || frameN < 3) scanChanges();
    processDirty(frameN < 90 ? 40 : (mobile ? 5 : 8));
    const t = performance.now()/1000;
    sprN.n = sprA.n = 0;
    syncBodies(); syncPeople(t); syncVehicles(); syncParticles(t); syncCharges(t); syncShots(); syncTarget(t);
    syncNature(t); syncScifi(t); syncMonsters(t); syncNukes();
    flushSprites(sprN); flushSprites(sprA);
    placeCamera(K.shake || 0);
    renderer.render(scene, camera);
  }
  function setShadows(on){ renderer.shadowMap.enabled = on; sun.castShadow = on; voxMat.needsUpdate = true; }
  resize();
  // måling: hvor lang tid tager beregning og oprettelse af alle blokke
  function bench(){
    const t0 = performance.now(); let faces = 0;
    for(let cy=0; cy<NY; cy++) for(let cx=0; cx<NX; cx++){ const x0 = cx*CX; let f; while((f = meshRegion(x0, Math.min(WX, x0 + CX), cy*CY, Math.min(HY, cy*CY + CY))) < 0){ cap *= 2; alloc(); } faces += f; }
    const t1 = performance.now();
    for(let cy=0; cy<NY; cy++) for(let cx=0; cx<NX; cx++) rebuild(cx, cy);
    const t2 = performance.now();
    renderer.render(scene, camera);
    const t3 = performance.now();
    return {beregning: Math.round(t1 - t0), medOprettelse: Math.round(t2 - t1), foersteTegning: Math.round(t3 - t2), sider: faces};
  }
  return {render, resize, pick, ground, planeZ, orbit, pan, zoom, stats, renderer, camera, cam, setShadows, bench, get chunkCount(){ return chunkList.length; }};
}
