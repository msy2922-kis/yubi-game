// ===== 전투 장면 (원작 영걸전풍: 부대 단위 병사 돌격 애니메이션) =====
// BattleScene.play({ att, def, strikes, terrain, weather, IMG, CLASSES }) -> Promise
// strikes: [{ att, def, dmg, hpBefore, hpAfter, killed, ranged, magic?, miss?, name?, counter? }]
const BattleScene = (() => {
  let speed = 1, cv, ctx, W = 360, H = 300, dpr = 1, GY = 240, HY = 196;
  const GEN = 96, SOL = 56, NSOL = 6;      // 장수 크기, 병사 크기, 최대 병사 수
  const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const srand = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const COL = { p: ['#3b6fd6', '#9ec1ff'], n: ['#3da35d', '#9ee0a8'], e: ['#d64545', '#ff9e9e'] };
  const MAGIC = { fire: '#ff7043', water: '#4fc3f7', earth: '#a1887f', morale: '#ce93d8', confuse: '#ce93d8', heal: '#8fe08f', cheer: '#f5c542', cure: '#8fe08f', virtue: '#ffd54f' };
  const SKY = { sun: ['#4f9fe0', '#cfe9ff'], cloud: ['#7d93b3', '#d9dfe8'], rain: ['#3e4a66', '#8690a8'] };
  const GROUND = { P: ['#5fa345', '#8fd062'], G: ['#4f9a3a', '#86c95a'], R: ['#b89a63', '#dcc48c'], D: ['#8c6f45', '#b8956a'], F: ['#3f7a34', '#6aa64e'], M: ['#7a6a58', '#a48f78'], H: ['#6fa64a', '#a0cf6c'], C: ['#777586', '#a3a1b0'], K: ['#777586', '#a3a1b0'], X: ['#6a6878', '#96949f'], S: ['#5fa345', '#8fd062'], E: ['#5fa345', '#8fd062'], T: ['#5fa345', '#8fd062'], Q: ['#5fa345', '#8fd062'], B: ['#8a6a3f', '#b48c55'], W: ['#3f7fc0', '#6fb0e0'] };
  let parts = [];   // 파티클 {x,y,vx,vy,g,life,life0,size,grow,color,shape}

  function setup() {
    cv = document.getElementById('battleCanvas'); ctx = cv.getContext('2d');
    W = Math.min(600, window.innerWidth); H = Math.round(Math.min(340, window.innerHeight * 0.42));
    dpr = window.devicePixelRatio || 1;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    GY = Math.round(H * 0.80); HY = GY - 46;
  }
  function win(x, y, w, h) {   // 코에이식 창
    ctx.fillStyle = 'rgba(10,14,40,.9)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = '#8a6d1f'; ctx.lineWidth = 1; ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
  }

  // ---------- 배경: 하늘 · 날씨 · 원경 · 지면 ----------
  function drawSky(weather, t) {
    const sky = ctx.createLinearGradient(0, 0, 0, HY);
    const c = SKY[weather] || SKY.sun; sky.addColorStop(0, c[0]); sky.addColorStop(1, c[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HY);
    if (weather === 'sun') {
      const sx = W * 0.8, sy = HY * 0.28;
      const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, 60); g.addColorStop(0, 'rgba(255,245,200,.9)'); g.addColorStop(0.25, 'rgba(255,235,170,.5)'); g.addColorStop(1, 'rgba(255,235,170,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 60, sy - 60, 120, 120);
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(sx, sy, 13, 0, 7); ctx.fill();
    }
    // 구름 (천천히 흐름)
    const n = weather === 'sun' ? 3 : 6, alpha = weather === 'rain' ? 0.55 : weather === 'cloud' ? 0.85 : 0.75;
    ctx.fillStyle = weather === 'rain' ? `rgba(90,100,125,${alpha})` : weather === 'cloud' ? `rgba(235,238,245,${alpha})` : `rgba(255,255,255,${alpha})`;
    for (let i = 0; i < n; i++) {
      const cx = ((srand(i + 7) * (W + 160) + t * (0.012 + srand(i) * 0.01)) % (W + 160)) - 80, cy = 14 + srand(i + 3) * HY * 0.45, s = 18 + srand(i + 11) * 16;
      for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(cx + (j - 1.5) * s * 0.8, cy + (j % 2) * s * 0.25, s * (0.6 + srand(i * 5 + j) * 0.4), 0, 7); ctx.fill(); }
      ctx.fillRect(cx - s * 1.6, cy + s * 0.2, s * 3.2, s * 0.6);
    }
  }
  function mountains(y, color, seed, amp, step, px) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-100, y + 5);
    for (let x = -100; x <= W + 100; x += step) ctx.lineTo(x + px, y - srand(seed + x) * amp - amp * 0.3);
    ctx.lineTo(W + 100, y + 5); ctx.closePath(); ctx.fill();
  }
  function tree(x, y, s, dark, light) {
    ctx.fillStyle = '#4e3620'; ctx.fillRect(x - s * 0.09, y - s * 0.3, s * 0.18, s * 0.32);
    for (let i = 0; i < 3; i++) { const ty = y - s * 0.22 - i * s * 0.26, w = s * (0.55 - i * 0.13); ctx.fillStyle = i === 2 ? light : dark; ctx.beginPath(); ctx.moveTo(x - w, ty); ctx.lineTo(x, ty - s * 0.42); ctx.lineTo(x + w, ty); ctx.closePath(); ctx.fill(); }
  }
  function house(x, y, w, h) {
    ctx.fillStyle = '#e4d3a8'; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(x - w * 0.12, y - h * 0.55, w * 0.24, h * 0.55);
    ctx.fillStyle = '#8c3b2e'; ctx.beginPath(); ctx.moveTo(x - w * 0.62, y - h); ctx.lineTo(x, y - h - w * 0.42); ctx.lineTo(x + w * 0.62, y - h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6b2a22'; ctx.fillRect(x - w * 0.62, y - h - 2, w * 1.24, 3);
  }
  function wall(y, h, light) {
    ctx.fillStyle = light ? '#9e9cab' : '#8a8898'; ctx.fillRect(0, y - h, W, h);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let r = 0; r < h / 12; r++) { ctx.fillRect(0, y - h + r * 12 + 11, W, 1); const off = r % 2 ? 14 : 0; for (let x = off; x < W; x += 28) ctx.fillRect(x, y - h + r * 12, 1, 12); }
    ctx.fillStyle = light ? '#9e9cab' : '#8a8898'; for (let x = 4; x < W; x += 24) ctx.fillRect(x, y - h - 10, 12, 11);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, y - 3, W, 3);
  }
  function drawScenery(terrain, weather, shake, t) {
    const y = HY, dim = weather === 'rain' ? 0.25 : weather === 'cloud' ? 0.12 : 0;
    const px1 = shake.x * 0.2, px2 = shake.x * 0.45;
    if (terrain === 'M') { mountains(y, '#8e9ab3', 5, 110, 70, px1); mountains(y, '#6f6456', 9, 80, 46, px2);
      ctx.fillStyle = 'rgba(255,255,255,.75)'; for (let x = -100; x <= W + 100; x += 46) { const py = y - srand(9 + x) * 80 - 24; if (py < y - 70) { ctx.beginPath(); ctx.moveTo(x + px2, py); ctx.lineTo(x + px2 - 9, py + 14); ctx.lineTo(x + px2 + 9, py + 14); ctx.closePath(); ctx.fill(); } } }
    else if (!'CKX'.includes(terrain)) { mountains(y, 'rgba(120,140,175,.55)', 1, 70, 90, px1); mountains(y, 'rgba(95,120,150,.55)', 3, 42, 60, px2); }
    if (terrain === 'F') { for (let i = 0; i < 12; i++) { const x = i * (W / 11) + srand(i + 20) * 20 - 10 + px2; tree(x, y - 6 + srand(i) * 4, 40 + srand(i + 30) * 16, '#2f6a2a', '#4c8f3a'); } for (let i = 0; i < 9; i++) tree(i * (W / 8) + 18 + px2, y + 2, 56 + srand(i + 40) * 14, '#275b24', '#3f7d34'); }
    else if ('CKX'.includes(terrain)) { wall(y, terrain === 'X' ? 78 : 58, terrain !== 'X');
      if (terrain === 'K') { const gx = W / 2; ctx.fillStyle = '#8a8898'; ctx.fillRect(gx - 54, y - 92, 108, 92); ctx.fillStyle = '#7b2b24'; ctx.fillRect(gx - 64, y - 110, 128, 10); ctx.beginPath(); ctx.moveTo(gx - 70, y - 100); ctx.lineTo(gx, y - 128); ctx.lineTo(gx + 70, y - 100); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c9a24a'; ctx.fillRect(gx - 40, y - 92, 80, 4); ctx.fillStyle = '#2a1e1a'; ctx.beginPath(); ctx.moveTo(gx - 22, y); ctx.lineTo(gx - 22, y - 44); ctx.arc(gx, y - 44, 22, Math.PI, 0); ctx.lineTo(gx + 22, y); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 6; i++) { const fx = 30 + i * (W - 60) / 5; ctx.fillStyle = '#4a2a1a'; ctx.fillRect(fx, y - 118, 2, 44); ctx.fillStyle = i % 2 ? '#b03030' : '#d4a030'; ctx.beginPath(); ctx.moveTo(fx + 2, y - 118); ctx.lineTo(fx + 20 + Math.sin(t / 200 + i) * 3, y - 110); ctx.lineTo(fx + 2, y - 100); ctx.closePath(); ctx.fill(); } }
    else if (terrain === 'H') { for (let i = 0; i < 5; i++) house(40 + i * (W - 80) / 4 + srand(i + 50) * 16, y - 2 + (i % 2) * 6, 46 + srand(i) * 14, 30 + srand(i + 60) * 8); for (let i = 0; i < 4; i++) tree(20 + i * (W / 3) + 50, y + 2, 34, '#3b7a30', '#5aa045'); }
    else if (terrain === 'S') { ctx.fillStyle = '#7b5a35'; for (let x = 0; x < W; x += 9) { const h = 30 + srand(x) * 6; ctx.fillRect(x, y - h, 7, h); ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 3.5, y - h - 7); ctx.lineTo(x + 7, y - h); ctx.closePath(); ctx.fill(); } ctx.fillStyle = '#5a3f24'; ctx.fillRect(0, y - 22, W, 3); ctx.fillRect(0, y - 10, W, 3);
      for (let i = 0; i < 5; i++) tree(30 + i * (W - 60) / 4, y - 30, 40, '#3b7a30', '#5aa045'); }
    else if (terrain === 'E') { for (let i = 0; i < 5; i++) { const x = 36 + i * (W - 72) / 4 + srand(i + 70) * 10, s = 30 + srand(i) * 10, ty = y - (i % 2) * 6; ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(x - s, ty); ctx.lineTo(x, ty - s * 1.1); ctx.lineTo(x + s, ty); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#b03030'; ctx.beginPath(); ctx.moveTo(x - s * 0.5, ty - s * 0.55); ctx.lineTo(x, ty - s * 1.1); ctx.lineTo(x + s * 0.5, ty - s * 0.55); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(x - s * 0.22, ty); ctx.lineTo(x, ty - s * 0.5); ctx.lineTo(x + s * 0.22, ty); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = '#4a2a1a'; ctx.fillRect(W / 2 - 1, y - 90, 3, 60); ctx.fillStyle = '#d4a030'; ctx.beginPath(); ctx.moveTo(W / 2 + 2, y - 90); ctx.lineTo(W / 2 + 26 + Math.sin(t / 180) * 3, y - 80); ctx.lineTo(W / 2 + 2, y - 70); ctx.closePath(); ctx.fill(); }
    else if (terrain === 'T' || terrain === 'Q') { const x = W / 2, w = 150, h = 44; ctx.fillStyle = '#d9c7a0'; ctx.fillRect(x - w / 2, y - h, w, h); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 1; i < 5; i++) ctx.fillRect(x - w / 2, y - h + i * 9, w, 1); ctx.fillStyle = terrain === 'T' ? '#8a5a20' : '#5a3a24'; ctx.fillRect(x - 16, y - 30, 32, 30); ctx.fillStyle = '#6b3a2a'; ctx.beginPath(); ctx.moveTo(x - w * 0.58, y - h); ctx.lineTo(x, y - h - 34); ctx.lineTo(x + w * 0.58, y - h); ctx.closePath(); ctx.fill(); for (let i = 0; i < 2; i++) tree(x + (i ? 1 : -1) * 120, y + 2, 40, '#3b7a30', '#5aa045'); }
    else if (terrain === 'W' || terrain === 'B') { ctx.fillStyle = '#3f7fc0'; ctx.fillRect(0, y - 30, W, 30); ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 14; i++) { const wx = ((srand(i + 80) * W + t * 0.03) % (W + 40)) - 20, wy = y - 26 + srand(i + 90) * 22; ctx.fillRect(wx, wy, 14 + srand(i) * 12, 2); } ctx.fillStyle = '#6fa650'; ctx.fillRect(0, y - 34, W, 5); for (let i = 0; i < 6; i++) tree(i * (W / 5) + 20, y - 32, 30, '#3b7a30', '#5aa045'); }
    else { ctx.fillStyle = 'rgba(110,170,80,.75)'; ctx.beginPath(); ctx.ellipse(W * 0.25 + px2, y + 10, W * 0.5, 34, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(95,155,70,.8)'; ctx.beginPath(); ctx.ellipse(W * 0.85 + px2, y + 10, W * 0.45, 26, 0, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 5; i++) tree(srand(i + 100) * W + px2, y - 2 - srand(i) * 8, 22 + srand(i + 110) * 12, '#3b7a30', '#5aa045'); }
    if (dim) { ctx.fillStyle = `rgba(60,70,100,${dim})`; ctx.fillRect(0, 0, W, y); }
  }
  function drawGround(terrain, weather, shake) {
    const c = GROUND[terrain] || GROUND.P;
    const g = ctx.createLinearGradient(0, HY, 0, H); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g; ctx.fillRect(0, HY, W, H - HY);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, HY, W, 3);
    const ox = shake.x * 0.6;
    if ('CKX'.includes(terrain)) { ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1; for (let i = 0; i < 6; i++) { const yy = HY + 6 + i * i * 4; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); } for (let i = -2; i < 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + (i - 4) * 46 + ox, HY); ctx.lineTo(W / 2 + (i - 4) * 90 + ox, H); ctx.stroke(); } }
    else if (terrain === 'B') { ctx.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 9; i++) ctx.fillRect(0, HY + 6 + i * 13, W, 2); ctx.fillRect(0, HY + 3, W, 1); ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < W; x += 70) ctx.fillRect(x + ox, HY, 2, H - HY); }
    else if (terrain === 'R') { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(W * 0.35 + ox, HY); ctx.lineTo(W * 0.65 + ox, HY); ctx.lineTo(W + 40, H); ctx.lineTo(-40, H); ctx.closePath(); ctx.fill(); for (let i = 0; i < 16; i++) { ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(srand(i + 200) * W + ox, HY + 8 + srand(i + 210) * (H - HY - 10), 3 + srand(i) * 4, 2); } }
    else if (terrain === 'D') { ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; for (let i = 0; i < 10; i++) { const x = srand(i + 300) * W + ox, y = HY + 8 + srand(i + 310) * (H - HY - 10); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 10, y + 4); ctx.lineTo(x + 18, y + 2); ctx.stroke(); } for (let i = 0; i < 8; i++) { ctx.fillStyle = '#7a5c3a'; ctx.beginPath(); ctx.ellipse(srand(i + 320) * W + ox, HY + 10 + srand(i + 330) * (H - HY - 14), 5, 3, 0, 0, 7); ctx.fill(); } }
    else if (terrain === 'M') { for (let i = 0; i < 10; i++) { const x = srand(i + 400) * W + ox, y = HY + 6 + srand(i + 410) * (H - HY - 10), s = 4 + srand(i) * 7; ctx.fillStyle = '#6a5a4a'; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.6, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.25, s * 0.4, s * 0.2, 0, 0, 7); ctx.fill(); } }
    else { // 풀밭 계열: 풀 포기
      for (let i = 0; i < 34; i++) { const x = srand(i + 500) * W + ox, y = HY + 6 + srand(i + 510) * (H - HY - 8), s = 3 + (y - HY) / (H - HY) * 4; ctx.strokeStyle = i % 3 ? 'rgba(40,110,40,.55)' : 'rgba(200,230,120,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s * 0.6, y - s); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.2, y - s * 1.3); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.8, y - s * 0.8); ctx.stroke(); }
      if (terrain === 'F') { ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(0, HY, W, 26); }
    }
    if (weather === 'rain') { ctx.fillStyle = 'rgba(120,160,220,.22)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(srand(i + 600) * W + ox, HY + 14 + srand(i + 610) * (H - HY - 20), 18 + srand(i) * 18, 4, 0, 0, 7); ctx.fill(); } }
  }
  function drawRain(t) {
    ctx.strokeStyle = 'rgba(205,225,255,.5)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 70; i++) { const x = ((srand(i + 700) * (W + 60) - t * 0.25) % (W + 60) + W + 60) % (W + 60) - 30, y = (srand(i + 710) * H + t * (0.9 + srand(i) * 0.4)) % H; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); }
    ctx.stroke();
  }

  // ---------- 파티클 ----------
  function spawn(p) { p.life0 = p.life; parts.push(p); }
  function stepParts(dt) { const k = dt / 16; parts = parts.filter((p) => { p.life -= dt; if (p.life <= 0) return false; p.x += p.vx * k; p.y += p.vy * k; p.vy += (p.g || 0) * k; if (p.grow) p.size += p.grow * k; return true; }); }
  function drawParts() {
    for (const p of parts) { const a = clamp(p.life / p.life0, 0, 1); ctx.globalAlpha = (p.alpha ?? 1) * (p.fade === false ? 1 : a); ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); else { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, 7); ctx.fill(); } }
    ctx.globalAlpha = 1;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function dust(x, y, n = 1, dir = 0) { for (let i = 0; i < n; i++) spawn({ x: x + rnd(-14, 14), y: y + rnd(-4, 6), vx: -dir * rnd(0.3, 1.2) + rnd(-0.3, 0.3), vy: rnd(-0.6, -0.2), size: rnd(3, 6), grow: 0.25, color: 'rgba(170,140,100,.55)', life: rnd(350, 600) }); }
  function sparks(x, y, n = 14, cols = ['#fff', '#ffe082', '#ffab40']) { for (let i = 0; i < n; i++) spawn({ x: x + rnd(-10, 10), y: y + rnd(-20, 20), vx: rnd(-4, 4), vy: rnd(-4.5, 1.5), g: 0.18, size: rnd(2, 4), shape: 'rect', color: cols[i % cols.length], life: rnd(250, 450) }); }

  // ---------- 부대 그리기 ----------
  const maskCache = new Map();
  function colorMask(img, color) {
    const key = color + '|'; let m = maskCache.get(img); if (m && m[key]) return m[key];
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    if (!m) { m = {}; maskCache.set(img, m); } m[key] = c; return c;
  }
  const whiteMask = (img) => colorMask(img, '#fff');
  function drawFigure(sp, u, x, y, sz, opt = {}) {
    const alpha = opt.alpha ?? 1; if (alpha <= 0) return;
    const bob = opt.bob || 0;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 2, sz * 0.32 * (1 - bob * 0.02), sz * 0.1, 0, 0, 7); ctx.fill();
    ctx.translate(x, y - bob); if (opt.flip) ctx.scale(-1, 1); if (opt.tilt) ctx.rotate(opt.tilt);
    if (sp) ctx.drawImage(sp, -sz / 2, -sz, sz, sz);
    else { ctx.fillStyle = COL[u.side][0]; ctx.beginPath(); ctx.arc(0, -sz * 0.45, sz * 0.3, 0, 7); ctx.fill(); }
    if (opt.flash > 0 && sp) { ctx.globalAlpha = alpha * opt.flash; ctx.drawImage(whiteMask(sp), -sz / 2, -sz, sz, sz); }
    if (opt.red > 0 && sp) { ctx.globalAlpha = alpha * opt.red * 0.55; ctx.drawImage(colorMask(sp, '#e53935'), -sz / 2, -sz, sz, sz); }
    ctx.restore();
  }
  function drawFlag(x, y, side, dir, t, fall = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-dir * fall * 1.3);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, 3, 6, 2.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -112); ctx.stroke();
    ctx.fillStyle = '#d4af37'; ctx.beginPath(); ctx.moveTo(-3, -112); ctx.lineTo(0, -120); ctx.lineTo(3, -112); ctx.closePath(); ctx.fill();
    const w = Math.sin(t / 160) * 3, w2 = Math.sin(t / 160 + 1.5) * 3;
    ctx.fillStyle = COL[side][0]; ctx.beginPath(); ctx.moveTo(0, -110); ctx.quadraticCurveTo(dir * 18, -108 + w, dir * 36, -100 + w2); ctx.lineTo(dir * 34, -92 + w2); ctx.quadraticCurveTo(dir * 18, -88 + w, 0, -86); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(dir * 18, -108 + w); ctx.lineTo(dir * 36, -100 + w2); ctx.lineTo(dir * 34, -92 + w2); ctx.lineTo(dir * 18, -88 + w); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 부대 대형: 장수 1 + 병사 최대 6 (2열). dir=1이면 x 증가 방향이 전방
  function formation(cx, gy, dir, nsol) {
    const out = [];
    out.push({ x: cx - dir * 70, y: gy, sz: GEN, kind: 'gen' });
    for (let i = 0; i < NSOL; i++) {
      const row = i % 2, col = Math.floor(i / 2);
      out.push({ x: cx - dir * (col * 26 - 10) + dir * (row ? 0 : 18), y: gy - 10 + row * 24, sz: SOL, kind: 'sol', i, alive: i < nsol });
    }
    return out;
  }
  function soldiersFor(u, hp) { const mh = Logic.maxHp(u); return hp <= 0 ? 0 : clamp(Math.ceil(hp / mh * NSOL), 1, NSOL); }

  // ---------- HUD · 글자 ----------
  function drawHud(u, hp, side, IMG, CLASSES, flash) {
    const bw = Math.min(190, W * 0.42), bh = 72, bx = side === 'left' ? 6 : W - bw - 6, by = 6;
    win(bx, by, bw, bh);
    if (flash > 0) { ctx.fillStyle = `rgba(220,40,40,${flash * 0.45})`; ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6); }
    const face = IMG[u.portrait] || IMG[CLASSES[u.cls].sprite];
    if (face) { ctx.save(); ctx.beginPath(); ctx.rect(bx + 8, by + 8, 52, 52); ctx.clip(); ctx.fillStyle = '#223'; ctx.fillRect(bx + 8, by + 8, 52, 52); ctx.drawImage(face, bx + 8, by + 8, 52, 52); ctx.restore(); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1; ctx.strokeRect(bx + 8.5, by + 8.5, 52, 52); }
    const tx = bx + 68, mh = Logic.maxHp(u), cur = Math.max(0, Math.round(hp));
    ctx.fillStyle = COL[u.side][1]; ctx.font = 'bold 14px "Galmuri11", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${u.name}`, tx, by + 8);
    ctx.fillStyle = '#ddd'; ctx.font = '11px "Galmuri11", sans-serif'; ctx.fillText(`${CLASSES[u.cls].name} Lv${u.lv}`, tx, by + 25);
    ctx.fillStyle = flash > 0.3 ? '#ff8a80' : '#fff'; ctx.font = 'bold 18px "Galmuri11", sans-serif'; ctx.fillText(`${cur}`, tx, by + 38);
    ctx.fillStyle = '#aaa'; ctx.font = '11px "Galmuri11", sans-serif'; ctx.fillText(`/${mh}`, tx + ctx.measureText(`${cur}`).width + 24, by + 44);
    const bw2 = bw - 76, pct = clamp(hp / mh, 0, 1);
    ctx.fillStyle = '#1b2040'; ctx.fillRect(tx, by + 60, bw2, 5); ctx.fillStyle = pct > 0.5 ? '#6fd66f' : pct > 0.25 ? '#f5c542' : '#e0553a'; ctx.fillRect(tx, by + 60, bw2 * pct, 5);
    ctx.strokeStyle = '#556'; ctx.lineWidth = 1; ctx.strokeRect(tx + 0.5, by + 60.5, bw2 - 1, 4);
  }
  function drawText(text, x, y, size, color, alpha = 1, scale = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.font = `bold ${size}px "Galmuri11", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size * 0.16); ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(text, 0, 0); ctx.fillStyle = color; ctx.fillText(text, 0, 0); ctx.restore();
  }

  // ---------- 책략 효과 (대상 대형 위, k: 0~1) ----------
  function drawMagic(type, cx, gy, k, dir, t) {
    ctx.save();
    if (type === 'fire') {
      const env = Math.sin(Math.PI * clamp(k, 0, 1));
      const glow = ctx.createRadialGradient(cx, gy, 10, cx, gy, 150); glow.addColorStop(0, `rgba(255,140,40,${0.45 * env})`); glow.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = glow; ctx.fillRect(cx - 150, gy - 150, 300, 200);
      for (let i = 0; i < 16; i++) {
        const s = srand(i + 900), fx = cx + (i - 7.5) * 15 + Math.sin(t / 90 + i * 1.7) * 4, fh = (34 + s * 54) * env * (0.85 + 0.15 * Math.sin(t / 60 + i * 2.3)), fy = gy + 10 - (i % 2) * 18;
        const layers = [['rgba(230,70,30,.85)', 1], ['rgba(255,150,40,.9)', 0.72], ['rgba(255,235,120,.95)', 0.42]];
        for (const [col, m] of layers) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx - 10 * m, fy); ctx.quadraticCurveTo(fx - 7 * m, fy - fh * m * 0.5, fx + Math.sin(t / 70 + i) * 3 * m, fy - fh * m); ctx.quadraticCurveTo(fx + 7 * m, fy - fh * m * 0.5, fx + 10 * m, fy); ctx.closePath(); ctx.fill(); }
      }
      if (k > 0.1 && k < 0.85 && Math.random() < 0.8) spawn({ x: cx + rnd(-110, 110), y: gy - rnd(0, 40), vx: rnd(-0.4, 0.4), vy: rnd(-2.2, -0.8), size: rnd(1.5, 3), shape: 'rect', color: Math.random() < 0.5 ? '#ffd54f' : '#ff7043', life: rnd(400, 800) });
      if (k > 0.3 && Math.random() < 0.5) spawn({ x: cx + rnd(-90, 90), y: gy - rnd(30, 70), vx: rnd(-0.3, 0.3), vy: rnd(-0.9, -0.4), size: rnd(5, 9), grow: 0.3, color: 'rgba(70,60,60,.35)', life: rnd(600, 1100) });
    } else if (type === 'water') {
      const wx = cx - dir * 170 + dir * 300 * ease(clamp(k, 0, 1)), hgt = 46 + Math.sin(Math.PI * k) * 24;
      ctx.fillStyle = 'rgba(40,120,200,.3)'; ctx.fillRect(wx - 160, gy - 4, 320, 12);
      ctx.fillStyle = 'rgba(79,170,240,.85)'; ctx.beginPath(); ctx.moveTo(wx - dir * 95, gy + 10);
      for (let i = 0; i <= 12; i++) { const px = wx - dir * 95 + dir * i * 16, ph = hgt * Math.sin(Math.PI * i / 12) + Math.sin(i * 1.4 + t / 50) * 6 + (i > 8 ? (i - 8) * 9 : 0); ctx.lineTo(px, gy + 10 - ph); }
      ctx.lineTo(wx + dir * 100, gy + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(235,250,255,.9)'; for (let i = 7; i <= 12; i++) { const px = wx - dir * 95 + dir * i * 16, ph = hgt * Math.sin(Math.PI * i / 12) + Math.sin(i * 1.4 + t / 50) * 6 + (i > 8 ? (i - 8) * 9 : 0); ctx.beginPath(); ctx.arc(px, gy + 10 - ph, 6 + (i % 2) * 3, 0, 7); ctx.fill(); }
      if (Math.random() < 0.9) spawn({ x: wx + dir * rnd(40, 100), y: gy - hgt - rnd(0, 30), vx: dir * rnd(0.5, 2.5), vy: rnd(-3, -1), g: 0.2, size: rnd(1.5, 3), color: '#cfeeff', life: rnd(300, 500) });
    } else if (type === 'earth') {
      for (let i = 0; i < 7; i++) {
        const tt = clamp(k * 1.5 - i * 0.07, 0, 1), rx = cx + (i - 3) * 26 + srand(i) * 10, land = gy + 6 - (i % 2) * 14, ry = land - 230 * (1 - tt * tt), sz = 11 + (i % 3) * 3;
        ctx.fillStyle = `rgba(0,0,0,${0.3 * tt})`; ctx.beginPath(); ctx.ellipse(rx, land + 2, sz * (0.5 + tt * 0.7), sz * 0.35 * (0.5 + tt * 0.7), 0, 0, 7); ctx.fill();
        if (tt < 1) { ctx.save(); ctx.translate(rx, ry - sz); ctx.rotate(tt * 6 + i); ctx.fillStyle = '#7d6253'; ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.4); ctx.lineTo(-sz * 0.3, -sz); ctx.lineTo(sz * 0.8, -sz * 0.7); ctx.lineTo(sz, sz * 0.3); ctx.lineTo(sz * 0.2, sz); ctx.lineTo(-sz * 0.8, sz * 0.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(-sz * 0.3, -sz * 0.4, sz * 0.3, 0, 7); ctx.fill(); ctx.restore(); }
        else { ctx.fillStyle = '#6e564a'; ctx.beginPath(); ctx.moveTo(rx - sz, land); ctx.lineTo(rx - sz * 0.5, land - sz * 0.9); ctx.lineTo(rx + sz * 0.3, land - sz * 1.1); ctx.lineTo(rx + sz, land); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(rx - sz * 0.5, land - sz * 0.9); ctx.lineTo(rx + sz * 0.3, land - sz * 1.1); ctx.lineTo(rx + sz * 0.1, land - sz * 0.6); ctx.closePath(); ctx.fill(); }
      }
    } else {
      ctx.fillStyle = MAGIC[type] || '#ce93d8';
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + k * 6, r = 20 + k * 70; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, gy - 60 + Math.sin(a) * r * 0.5, 6, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }

  // 타임라인(ms): 한 타격 = 돌격 0~420, 충돌 420~900, 복귀 900~1300
  const T = { charge: 420, impact: 900, back: 1300, end: 1350, intro: 450, gap: 250, outro: 500 };
  function play(o) {
    setup();
    const { IMG, CLASSES } = o, weather = o.weather || 'sun';
    const left = o.att, right = o.def, gy = GY;
    const hp = {}; hp[right.id] = o.strikes[0].hpBefore; hp[left.id] = (o.strikes.find((s) => s.def === left) || { hpBefore: left.hp }).hpBefore;
    const shown = { [left.id]: soldiersFor(left, hp[left.id]), [right.id]: soldiersFor(right, hp[right.id]) };
    const dead = { [left.id]: 0, [right.id]: 0 };
    const fall = { [left.id]: [], [right.id]: [] };   // 쓰러지는 병사 {i,t0}
    const hudFlash = { [left.id]: -9999, [right.id]: -9999 }, lastHp = { ...hp };
    const total = T.intro + o.strikes.length * T.end + (o.strikes.length - 1) * T.gap + T.outro;
    const popups = []; parts = [];
    const wrap = document.getElementById('battle'); wrap.classList.remove('hidden');
    speed = 1; const fast = () => { speed = 4; }; wrap.addEventListener('pointerdown', fast);
    const lx = W * 0.30, rx = W * 0.70;
    const spL = IMG[CLASSES[left.cls].sprite], spR = IMG[CLASSES[right.cls].sprite];
    const mounted = (u) => /cav|lord/.test(CLASSES[u.cls].sprite);

    return new Promise((resolve) => {
      let last = performance.now(), t = 0;
      const finish = () => { wrap.classList.add('hidden'); wrap.removeEventListener('pointerdown', fast); parts = []; resolve(); };
      const frame = (now) => {
        try { frameBody(now); } catch (e) { console.error('battle scene error', e); finish(); }
      };
      const frameBody = (now) => {
        const dt = Math.min(100, (now - last) * speed); t += dt; last = now;
        const shake = { x: 0, y: 0 };
        const pos = { [left.id]: { dx: 0, flash: 0, tilt: 0, red: 0, march: 0 }, [right.id]: { dx: 0, flash: 0, tilt: 0, red: 0, march: 0 } };
        let effect = null, arrows = null, slash = null, scrFlash = 0, tint = null;
        const introK = ease(clamp(t / T.intro, 0, 1));
        pos[left.id].dx -= (1 - introK) * W * 0.4; pos[right.id].dx += (1 - introK) * W * 0.4;
        o.strikes.forEach((s, i) => {
          const st = T.intro + i * (T.end + T.gap), lt = t - st;
          if (lt < 0) return;
          const A = s.att, D = s.def, dir = A === left ? 1 : -1;
          const reach = s.ranged ? 0 : (Math.abs(rx - lx) - 150);
          const pa = pos[A.id], pd = pos[D.id];
          const ax = A === left ? lx : rx, dx = D === left ? lx : rx;
          if (lt < T.charge) { const k = ease(lt / T.charge); pa.dx += dir * reach * k; pa.tilt = dir * 0.08 * k;
            if (!s.ranged) { pa.march = lt; if (Math.random() < 0.7) dust(ax + pa.dx - dir * 30, gy + 14, 1, dir); }
            if (s.ranged && !s.magic) { arrows = { k, dir, from: ax, to: dx, s }; if (!s._draw) { s._draw = true; pa.flash = 0; } }
            if (s.magic) { effect = { type: s.magic, cx: dx, k: k * 0.5, dir }; if (!s._cast) { s._cast = true; sparks(ax, gy - 70, 10, [MAGIC[s.magic] || '#fff', '#fff']); } }
          } else if (lt < T.impact) {
            const k = (lt - T.charge) / (T.impact - T.charge);
            pa.dx += dir * reach; pa.tilt = dir * 0.08;
            if (s.magic) { effect = { type: s.magic, cx: dx, k: 0.5 + k * 0.5, dir }; if (s.magic === 'fire') tint = `rgba(255,120,30,${0.12 * Math.sin(Math.PI * k)})`; if (s.magic === 'earth' && k < 0.5) { shake.x += (Math.random() - 0.5) * 8; shake.y += (Math.random() - 0.5) * 8; } }
            if (s.ranged && !s.magic && k < 0.6) arrows = { k: 1, dir, from: ax, to: dx, s, stuck: true };
            if (!s.miss) {
              if (k < 0.4) { shake.x += (Math.random() - 0.5) * 12 * (1 - k * 2.5); shake.y += (Math.random() - 0.5) * 7 * (1 - k * 2.5); }
              pd.flash = Math.max(0, 1 - k * 7); pd.red = k < 0.15 ? 0 : Math.max(0, 1 - (k - 0.15) / 0.5) * 0.7; pd.dx += -dir * 16 * Math.max(0, 1 - k * 2); pd.tilt = -dir * 0.14 * Math.max(0, 1 - k * 2);
              if (!s.magic) { if (k < 0.3) slash = { x: dx - dir * 24, y: gy - 48, k: k / 0.3, dir }; if (k < 0.12) scrFlash = 0.5 * (1 - k / 0.12); }
            }
            if (!s._hit) { s._hit = true;
              if (!s.miss) { sparks(dx - dir * 30, gy - 50, s.magic ? 8 : 16); dust(dx, gy + 14, 6, -dir); }
              popups.push({ text: s.miss ? '실패!' : `-${s.dmg}`, x: dx, y: gy - 126, t0: t, color: s.miss ? '#ccc' : D.side === 'e' ? '#fff' : '#ff8a80', size: 32 });
              if (s.name) popups.push({ text: s.name, x: W / 2, y: H * 0.36, t0: t - 300, color: '#ffe082', size: 24, dur: 1100 });
              if (s.counter) popups.push({ text: '반격!', x: W / 2, y: H * 0.36, t0: t - 100, color: '#ffe082', size: 24, dur: 1100 });
              if (s.killed) popups.push({ text: D.side === 'e' ? '격파!' : '퇴각…', x: W / 2, y: H * 0.42, t0: t + 350, color: '#ffd54f', size: 34, dur: 1300 });
              const nb = soldiersFor(D, s.hpBefore), na = s.killed ? 0 : soldiersFor(D, s.hpAfter);
              for (let j = na; j < nb; j++) fall[D.id].push({ i: j, t0: t + (j - na) * 70 });
            }
            hp[D.id] = s.hpBefore + (s.hpAfter - s.hpBefore) * Math.min(1, k * 1.5);
            if (s.killed) dead[D.id] = clamp((k - 0.4) / 0.6, 0, 1);
          } else if (lt < T.back) { const k = ease((lt - T.impact) / (T.back - T.impact)); pa.dx += dir * reach * (1 - k); pa.tilt = dir * 0.08 * (1 - k); hp[D.id] = s.hpAfter; if (s.killed) dead[D.id] = 1; }
          else { hp[D.id] = s.hpAfter; if (s.killed) dead[D.id] = 1; }
        });
        for (const id of [left.id, right.id]) { if (hp[id] < lastHp[id] - 0.5) hudFlash[id] = t; lastHp[id] = hp[id]; }
        stepParts(dt);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        drawSky(weather, t); drawScenery(o.terrain, weather, shake, t); drawGround(o.terrain, weather, shake);
        ctx.save(); ctx.translate(shake.x, shake.y);
        for (const [u, cx, dir, sp] of [[left, lx, 1, spL], [right, rx, -1, spR]]) {
          const p = pos[u.id], alpha = 1 - dead[u.id], horse = mounted(u);
          drawFlag(cx - dir * 100 + p.dx, gy - 4, u.side, dir, t, dead[u.id]);
          const form = formation(cx + p.dx, gy, dir, shown[u.id]);
          form.sort((a, b) => a.y - b.y);
          for (const f of form) {
            const bob = p.march ? Math.abs(Math.sin(p.march / (horse ? 95 : 70) + (f.i || 0) * 1.1)) * (horse ? 6 : 4) : 0;
            if (f.kind === 'sol') {
              const fl = fall[u.id].find((z) => z.i === f.i);
              let a = alpha, tilt = p.tilt;
              if (fl && t >= fl.t0) { const k = clamp((t - fl.t0) / 350, 0, 1); a = alpha * (1 - k); tilt = -dir * k * 1.25; if (!fl._d) { fl._d = true; dust(f.x, f.y + 2, 3); } }
              else if (f.i >= shown[u.id] && !fl) a = 0;
              drawFigure(sp, u, f.x, f.y, f.sz, { flip: dir < 0, tilt, flash: p.flash, red: p.red, alpha: a, bob });
            } else drawFigure(sp, u, f.x, f.y, f.sz, { flip: dir < 0, tilt: p.tilt - dir * dead[u.id] * 1.3, flash: p.flash, red: p.red, alpha: alpha < 1 ? Math.max(0, 1 - dead[u.id] * 1.1) : 1, bob });
          }
        }
        if (arrows) {
          const n = 3 + shown[arrows.s.att.id];
          for (let i = 0; i < n; i++) {
            const k = arrows.stuck ? 1 : clamp(arrows.k * 1.35 - i * 0.05, 0, 1); if (k <= 0) continue;
            const amp = 85 + srand(i + 40) * 30, from = arrows.from - arrows.dir * (10 + srand(i) * 60), to = arrows.to - arrows.dir * (srand(i + 50) * 60 - 10);
            const ax = from + (to - from) * k, ay = gy - 60 - Math.sin(Math.PI * k) * amp - srand(i + 60) * 20;
            const ang = Math.atan2(-Math.cos(Math.PI * k) * Math.PI * amp, to - from);
            if (!arrows.stuck) { ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(ax, gy + 6 + (i % 3) * 8, 9, 2.5, 0, 0, 7); ctx.fill(); }
            if (k >= 1 && !arrows.s._land) { arrows.s._land = true; sparks(arrows.to - arrows.dir * 20, gy - 50, 10); }
            ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
            ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
            ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(10, -3.5); ctx.lineTo(10, 3.5); ctx.fill();
            ctx.fillStyle = '#c0392b'; ctx.fillRect(-15, -2.5, 6, 5);
            ctx.restore();
          }
        }
        if (effect) drawMagic(effect.type, effect.cx, gy, effect.k, effect.dir, t);
        if (slash) { const k = slash.k; ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
          ctx.translate(slash.x, slash.y); ctx.scale(slash.dir, 1);
          for (const [col, lw, r] of [['rgba(255,255,255,.95)', 7 - k * 4, 38], ['rgba(255,225,120,.9)', 3, 46]]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); const a0 = -2.4 + k * 0.3, len = 1.9 * (0.3 + k * 0.7); ctx.arc(0, 0, r, a0, a0 + len); ctx.stroke(); }
          ctx.restore(); }
        drawParts();
        ctx.restore();
        if (weather === 'rain') drawRain(t);
        if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
        if (scrFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${scrFlash})`; ctx.fillRect(0, 0, W, H); }
        drawHud(left, hp[left.id], 'left', IMG, CLASSES, clamp(1 - (t - hudFlash[left.id]) / 350, 0, 1));
        drawHud(right, hp[right.id], 'right', IMG, CLASSES, clamp(1 - (t - hudFlash[right.id]) / 350, 0, 1));
        for (const p of popups) { const k = (t - p.t0) / (p.dur || 950); if (k < 0 || k > 1) continue; const sc = 1 + Math.max(0, 1 - k * 5) * 0.7; drawText(p.text, p.x, p.y - k * 34, p.size, p.color, 1 - k * k, sc); }
        if (t < T.intro) { ctx.fillStyle = `rgba(0,0,0,${1 - t / T.intro})`; ctx.fillRect(0, 0, W, H); }
        if (t > total - 250) { ctx.fillStyle = `rgba(0,0,0,${(t - (total - 250)) / 250})`; ctx.fillRect(0, 0, W, H); }
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '11px "Galmuri11", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('터치: 빨리 감기', W - 8, H - 6);
        if (t < total) requestAnimationFrame(frame);
        else finish();
      };
      requestAnimationFrame(frame);
    });
  }
  return { play };
})();
