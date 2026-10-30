(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const srStatus = document.getElementById('sr-status');
  const W = 480, H = 840;
  const floor = { x: 26, y: 170, w: 428, h: 550 };
  const colors = {
    ink: '#173b38', ink2: '#28524b', cream: '#fff4d8', paper: '#fff9e9',
    gold: '#e5b95e', mint: '#83c9a5', mint2: '#b9e2ad', pink: '#ed8490',
    orange: '#e9a85c', wood: '#986542', woodDark: '#61402f', tileA: '#f1e5c9',
    tileB: '#e9d9b6', steel: '#91aaa1', frog: '#75c56f', frogDark: '#4e9d58'
  };
  const items = {
    cup: { name: '空杯', short: '杯', tint: '#8acbd0', icon: 'cup' },
    pot: { name: '奶锅', short: '锅', tint: '#e9a85c', icon: 'pot' },
    oolong: { name: '乌龙茶', short: '茶', tint: '#89ad6e', icon: 'tea' },
    pearls: { name: '黑糖珍珠', short: '珍珠', tint: '#907362', icon: 'pearls' },
    berry: { name: '草莓酱', short: '莓', tint: '#e78088', icon: 'berry' },
    foam: { name: '奶盖云', short: '奶盖', tint: '#e6d9b7', icon: 'foam' },
    matcha: { name: '抹茶粉', short: '抹茶', tint: '#8ab86d', icon: 'matcha' }
  };
  const recipes = [
    { name: '黑糖云乌龙', guest: '小茶客', required: ['cup', 'pot', 'oolong', 'pearls'] },
    { name: '草莓云朵杯', guest: '莓莓蛙', required: ['cup', 'pot', 'berry', 'foam'] },
    { name: '抹茶奶盖杯', guest: '青团团', required: ['cup', 'pot', 'matcha', 'foam'] }
  ];
  const stations = [
    { id: 'cup', item: 'cup', x: 92, y: 225, label: '空杯站' },
    { id: 'pot', item: 'pot', x: 388, y: 225, label: '奶锅站' },
    { id: 'oolong', item: 'oolong', x: 92, y: 362, label: '乌龙茶站' },
    { id: 'pearls', item: 'pearls', x: 240, y: 306, label: '黑糖珍珠站' },
    { id: 'berry', item: 'berry', x: 388, y: 362, label: '草莓果酱站' },
    { id: 'foam', item: 'foam', x: 92, y: 498, label: '奶盖站' },
    { id: 'matcha', item: 'matcha', x: 388, y: 498, label: '抹茶粉站' },
    { id: 'deliver', item: 'deliver', x: 240, y: 650, label: '投喂台' }
  ];
  let dpr = 1, cssW = 0, cssH = 0, scale = 1, logicalW = W, logicalH = H, offX = 0, offY = 0;
  let player = { x: 240, y: 585, vx: 0, vy: 0, face: 1 };
  let round = 0, delivered = 0, eggs = 0, best = 0, carried = [], seconds = 48;
  let lastTime = 0, roundState = 'playing', pauseUntil = 0, toast = '', toastUntil = 0, effects = [];
  let joy = { id: null, x: 0, y: 0, dx: 0, dy: 0 }, keys = new Set();
  let audio = null, lastPrompt = '';
  try { best = Number(localStorage.getItem('wawa-kitchen-best') || 0); } catch (_) {}

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width; cssH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.25);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    scale = Math.min(cssW / W, cssH / H);
    logicalW = cssW / scale; logicalH = cssH / scale;
    offX = (logicalW - W) / 2;
    offY = Math.max(0, (logicalH - H) * 0.2);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  function recipe() { return recipes[round % recipes.length]; }
  function allCollected() { return recipe().required.every(id => carried.includes(id)); }
  function notify(text, ms = 1700) {
    toast = text; toastUntil = performance.now() + ms;
    if (srStatus) srStatus.textContent = text;
  }
  function rounded(x, y, w, h, r, fill, stroke, line = 1) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = line; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function ellipse(x, y, rx, ry, fill, stroke, line = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = line; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
  }
  function text(str, x, y, size, color, weight = 600, align = 'left') {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, logicalW, logicalH);
    g.addColorStop(0, '#28584f'); g.addColorStop(1, '#173b39');
    ctx.fillStyle = g; ctx.fillRect(0, 0, logicalW, logicalH);
    // A few soft, original decorative bubbles in the margins.
    for (let i = 0; i < 9; i++) {
      const x = ((i * 137 + 43) % Math.max(1, logicalW));
      const y = ((i * 211 + 72) % Math.max(1, logicalH));
      ellipse(x, y, 2 + (i % 3), 2 + (i % 3), 'rgba(230,244,211,.10)');
    }
  }
  function drawHud(now) {
    const x = 17, y = 17, w = 446, h = 138;
    rounded(x + 1, y + 5, w, h, 20, 'rgba(10,35,33,.22)');
    rounded(x, y, w, h, 20, colors.paper, 'rgba(255,255,255,.48)', 1.4);
    text('蛙蛙厨房', x + 19, y + 23, 18, colors.ink, 850);
    text('泡泡湾 · 今日营业中', x + 20, y + 43, 10, '#668075', 600);
    text(`奶蛋 ${eggs}`, x + 194, y + 30, 12, '#59855e', 750, 'center');
    text(`最佳 ${best}`, x + 267, y + 30, 10, '#8a927b', 650, 'center');
    rounded(x + 365, y + 10, 64, 40, 13, seconds <= 10 ? '#f4d5c7' : '#eaf1d8');
    text(String(Math.max(0, Math.ceil(seconds))).padStart(2, '0'), x + 397, y + 29, 21, seconds <= 10 ? '#bd514b' : '#446d50', 850, 'center');
    text('秒', x + 419, y + 30, 9, '#758777', 650);
    text(recipe().name, x + 20, y + 68, 16, '#285d53', 800);
    text(`${recipe().guest} 的订单`, x + 22, y + 87, 10, '#82907d', 600);
    const req = recipe().required, chipW = 95, gap = 8, startX = x + 18, cy = y + 111;
    req.forEach((id, i) => {
      const cx = startX + i * (chipW + gap), done = carried.includes(id), item = items[id];
      rounded(cx, cy, chipW, 21, 9, done ? '#d9efcf' : '#f2ead8', done ? '#a9d1a1' : '#eee2ca', 1);
      text(done ? '✓' : item.short, cx + 12, cy + 10.5, 9, done ? '#4a8b5c' : item.tint, 850, 'center');
      text(item.name, cx + 25, cy + 10.5, 9, '#50675a', 650);
    });
    // Small reset button sits inside the header's right edge.
    rounded(x + 326, y + 57, 28, 25, 8, '#edf0df');
    text('↻', x + 340, y + 69, 16, '#5e8269', 750, 'center');
    resetButton = { x: x + 326, y: y + 57, w: 28, h: 25 };
  }
  let resetButton = { x: 0, y: 0, w: 0, h: 0 };
  function drawRoom() {
    const { x, y, w, h } = floor;
    rounded(x + 5, y + 8, w, h, 25, '#102c2b');
    rounded(x, y, w, h, 23, '#d7c39e', '#f3dfb6', 3);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 19); ctx.clip();
    ctx.fillStyle = '#efe2c5'; ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
    const tile = 48;
    for (let r = 0, yy = y + 5; yy < y + h - 5; r++, yy += tile) {
      for (let c = 0, xx = x + 5; xx < x + w - 5; c++, xx += tile) {
        if ((r + c) % 2 === 0) { ctx.fillStyle = 'rgba(255,249,227,.35)'; ctx.fillRect(xx, yy, tile, tile); }
        ctx.strokeStyle = 'rgba(153,125,83,.12)'; ctx.lineWidth = 1; ctx.strokeRect(xx, yy, tile, tile);
      }
    }
    // Decorative rug and tile highlights.
    rounded(158, 411, 164, 67, 16, 'rgba(202,168,121,.14)', 'rgba(153,125,83,.12)', 1);
    ctx.restore();
    // Back counter / wall shelf.
    rounded(41, 179, 398, 28, 10, '#754d35');
    rounded(47, 176, 386, 8, 4, '#e0b576');
    for (let i = 0; i < 5; i++) {
      rounded(60 + i * 78, 184, 54, 17, 5, i % 2 ? '#477c69' : '#628b70');
      ellipse(87 + i * 78, 190, 4, 4, '#e6d59e');
    }
    // Warm inset lighting and perimeter labels.
    line(42, 207, 438, 207, 'rgba(255,255,255,.45)', 2);
    rounded(168, 680, 144, 22, 9, 'rgba(118,80,49,.20)');
    text('小厨房 · 大快乐', 240, 691, 9, '#8c7657', 700, 'center');
  }
  function stationNeeded(st) { return st.item === 'deliver' ? allCollected() : recipe().required.includes(st.item) && !carried.includes(st.item); }
  function drawStation(st, now) {
    const active = recipe().required.includes(st.item) && !carried.includes(st.item);
    const done = st.item !== 'deliver' && carried.includes(st.item);
    const ready = st.item === 'deliver' && allCollected();
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
    if (active || ready) {
      ctx.save(); ctx.globalAlpha = 0.22 + pulse * 0.16;
      ellipse(st.x, st.y + 7, 48, 28, ready ? '#f1ca66' : '#80d49c'); ctx.restore();
      ellipse(st.x, st.y + 7, 38 + pulse * 2, 21 + pulse, null, ready ? '#c69c44' : '#69b989', 1.6);
    }
    if (st.item === 'deliver') { drawDelivery(st, ready, now); return; }
    // Little oak cabinet and thick countertop.
    rounded(st.x - 38, st.y - 4, 76, 42, 8, '#8c6241', '#6f4b35', 1);
    rounded(st.x - 41, st.y - 14, 82, 20, 7, '#f0d6a6', '#b88956', 1.5);
    rounded(st.x - 29, st.y + 8, 58, 25, 5, '#a8764d');
    line(st.x, st.y + 11, st.x, st.y + 31, '#d6ab72', 1);
    rounded(st.x - 5, st.y + 18, 10, 4, 2, '#614831');
    drawProp(st.item, st.x, st.y - 21, now);
    rounded(st.x - 42, st.y + 42, 84, 15, 6, active ? '#dcefcf' : '#e7ddc5');
    text(done ? '✓ 已拿' : active ? items[st.item].name : '备料站', st.x, st.y + 49.5, 9, done ? '#518458' : '#536b58', 700, 'center');
    if (done) ellipse(st.x + 33, st.y - 10, 8, 8, '#70b77a');
  }
  function drawProp(kind, x, y, now) {
    if (kind === 'cup') {
      rounded(x - 12, y - 11, 24, 22, 5, '#d9f0e7', '#7eaaa2', 1.5);
      ctx.beginPath(); ctx.moveTo(x - 9, y + 9); ctx.lineTo(x + 9, y + 9); ctx.lineTo(x + 7, y + 12); ctx.lineTo(x - 7, y + 12); ctx.closePath(); ctx.fillStyle = '#91c7bb'; ctx.fill();
      line(x + 3, y - 12, x + 6, y - 25, '#e7838c', 3); ellipse(x + 2, y - 14, 3, 2, '#fff7df');
    } else if (kind === 'pot') {
      rounded(x - 18, y - 12, 36, 20, 7, '#a9b7a9', '#738c7f', 1.5); rounded(x - 21, y - 15, 42, 5, 3, '#d3d8c5');
      line(x - 18, y - 3, x - 25, y - 3, '#536c60', 4); line(x + 18, y - 3, x + 25, y - 3, '#536c60', 4);
      ellipse(x, y - 18, 8, 3, '#e7b35f');
    } else if (kind === 'oolong' || kind === 'berry' || kind === 'matcha') {
      const fill = kind === 'oolong' ? '#77966d' : kind === 'berry' ? '#d96872' : '#7ca765';
      rounded(x - 12, y - 14, 24, 27, 6, fill, '#f5e9ca', 1.5); rounded(x - 7, y - 21, 14, 8, 3, '#c59662');
      ellipse(x, y + 11, 15, 5, 'rgba(80,61,37,.18)');
      if (kind === 'berry') { ellipse(x - 5, y - 2, 2, 2, '#ffd88f'); ellipse(x + 5, y + 4, 2, 2, '#ffd88f'); }
      if (kind === 'matcha') { ellipse(x, y - 1, 7, 6, '#adc58a'); }
      if (kind === 'oolong') { line(x - 5, y + 3, x + 5, y - 5, '#c6d49c', 2); }
    } else if (kind === 'pearls') {
      ellipse(x, y - 3, 22, 12, '#715947', '#513f32', 1.3); ellipse(x, y - 7, 18, 9, '#9b7955');
      for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; ellipse(x + Math.cos(a) * 10, y - 7 + Math.sin(a) * 4, 3, 3, '#3b3029'); }
      ellipse(x, y - 8, 3, 3, '#3b3029');
    } else if (kind === 'foam') {
      ellipse(x, y + 2, 17, 10, '#e5d8b7', '#b9a882', 1.2); ellipse(x - 8, y - 6, 7, 7, '#fff6dc'); ellipse(x, y - 10, 8, 9, '#fff8e6'); ellipse(x + 8, y - 5, 7, 7, '#fff2d2');
    }
  }
  function drawDelivery(st, ready, now) {
    rounded(st.x - 49, st.y - 4, 98, 36, 9, '#74503b', '#563d2f', 1);
    rounded(st.x - 52, st.y - 14, 104, 21, 8, '#eacb91', '#b18a54', 1.5);
    rounded(st.x - 34, st.y - 31, 68, 19, 8, '#fff2d4', '#d0aa71', 1.2);
    text('投喂', st.x, st.y - 21, 11, '#8f6845', 850, 'center');
    ellipse(st.x, st.y + 17, 11, 4, '#4c3428');
    if (ready) { ellipse(st.x, st.y - 35 - Math.sin(now * .005) * 3, 4, 4, '#efbd5c'); }
    rounded(st.x - 43, st.y + 36, 86, 16, 6, ready ? '#f6e3aa' : '#e7ddc5');
    text(ready ? '订单齐了 · 交付' : '投喂台', st.x, st.y + 44, 9, ready ? '#8a6536' : '#6a705e', 750, 'center');
  }
  function drawFrog(p, now) {
    const bob = Math.sin(now * 0.006) * (Math.abs(p.vx) + Math.abs(p.vy) > 8 ? 2.5 : 1.1);
    const x = p.x, y = p.y + bob;
    ellipse(x, y + 20, 25, 9, 'rgba(57,68,46,.20)');
    // Feet and body.
    ellipse(x - 13, y + 14, 12, 7, '#4c854d'); ellipse(x + 13, y + 14, 12, 7, '#4c854d');
    ellipse(x, y, 22, 26, colors.frog, '#4e9d58', 1.6);
    ellipse(x, y + 6, 13, 14, '#e7e3bd');
    // Eyes, brows, smile and rosy cheeks.
    ellipse(x - 11, y - 19, 9, 12, '#72c46c', '#4e9d58', 1);
    ellipse(x + 11, y - 19, 9, 12, '#72c46c', '#4e9d58', 1);
    const blink = Math.sin(now * .0011) > .995;
    ellipse(x - 11 + p.face * 1.6, y - 20, 3.5, blink ? 1 : 4, '#fffdf0');
    ellipse(x + 11 + p.face * 1.6, y - 20, 3.5, blink ? 1 : 4, '#fffdf0');
    ellipse(x - 10 + p.face * 2, y - 20, 1.7, 2.5, '#243b33');
    ellipse(x + 12 + p.face * 2, y - 20, 1.7, 2.5, '#243b33');
    ellipse(x - 17, y - 4, 4, 2.5, 'rgba(236,122,131,.65)'); ellipse(x + 17, y - 4, 4, 2.5, 'rgba(236,122,131,.65)');
    ctx.beginPath(); ctx.arc(x + p.face * 1, y + 1, 5, 0.15, Math.PI - 0.15); ctx.strokeStyle = '#365a3d'; ctx.lineWidth = 1.8; ctx.stroke();
    // Tiny apron and order ingredients being carried.
    rounded(x - 11, y + 3, 22, 7, 3, '#f3d58f'); ellipse(x, y + 5, 3, 2, '#a9744b');
    carried.forEach((id, i) => {
      const item = items[id];
      ellipse(x - 16 + i * 10, y + 30, 6, 5, item.tint, '#fff4df', 1);
      text(item.short.slice(0, 1), x - 16 + i * 10, y + 30, 6, '#fffef0', 850, 'center');
    });
  }
  function nearestStation() {
    let nearest = null, distance = Infinity;
    for (const st of stations) {
      const d = Math.hypot(player.x - st.x, player.y - st.y);
      if (d < distance) { nearest = st; distance = d; }
    }
    return distance < 70 ? nearest : null;
  }
  function actionLabel() {
    const st = nearestStation();
    if (!st) return '互动';
    if (st.item === 'deliver') return allCollected() ? '交付' : '缺材料';
    if (carried.includes(st.item)) return '已拿';
    if (!recipe().required.includes(st.item)) return '不需要';
    return `拿${items[st.item].short}`;
  }
  function drawPrompt(now) {
    const st = nearestStation();
    if (!st) return;
    const label = st.item === 'deliver' ? (allCollected() ? '订单齐啦！送到投喂台' : '还差几样材料，再去取料') : carried.includes(st.item) ? `${items[st.item].name}已经拿好` : !recipe().required.includes(st.item) ? '这单暂时不需要' : `按右侧按钮 · ${items[st.item].name}`;
    const w = Math.min(250, Math.max(146, label.length * 11 + 22)), x = Math.max(12, Math.min(W - w - 12, player.x - w / 2));
    const y = player.y - 58;
    rounded(x, y, w, 27, 11, 'rgba(23,59,56,.92)', 'rgba(255,255,255,.32)', 1);
    text(label, x + w / 2, y + 13.5, 10, '#fff5db', 700, 'center');
  }
  function drawControls(now) {
    const cy = offY + Math.max(90, logicalH - 105), jx = offX + 91, ax = offX + 385;
    // Joystick.
    ellipse(jx, cy + 5, 59, 59, 'rgba(6,29,28,.19)');
    ellipse(jx, cy, 58, 58, 'rgba(239,249,221,.14)', 'rgba(240,249,224,.43)', 1.4);
    ellipse(jx, cy, 29, 29, 'rgba(237,249,225,.10)', 'rgba(239,248,226,.18)', 1);
    const knobX = jx + (joy.id !== null ? joy.dx * 35 : 0), knobY = cy + (joy.id !== null ? joy.dy * 35 : 0);
    ellipse(knobX, knobY + 2, 25, 25, 'rgba(8,38,35,.22)');
    ellipse(knobX, knobY, 24, 24, 'rgba(225,245,218,.78)', 'rgba(255,255,240,.8)', 1.2);
    text('移动', jx, cy + 77, 10, 'rgba(244,249,224,.76)', 750, 'center');
    // Action button.
    const label = actionLabel(), enabled = label !== '互动' && label !== '缺材料' && label !== '已拿' && label !== '不需要';
    const fill = label === '交付' ? '#e9b95c' : enabled ? '#e9a960' : 'rgba(231,241,215,.18)';
    ellipse(ax, cy + 5, 57, 57, 'rgba(6,29,28,.22)');
    ellipse(ax, cy, 54, 54, fill, enabled ? '#fff1c9' : 'rgba(235,246,226,.45)', 2);
    ellipse(ax, cy, 43, 43, enabled ? 'rgba(255,246,212,.18)' : 'rgba(255,255,255,.06)');
    text(label, ax, cy - 2, label.length > 4 ? 13 : 17, enabled ? '#fffaf0' : 'rgba(244,249,224,.75)', 850, 'center');
    text('按一下', ax, cy + 20, 9, enabled ? 'rgba(255,250,235,.9)' : 'rgba(244,249,224,.55)', 600, 'center');
  }
  function drawToast(now) {
    if (now > toastUntil || !toast) return;
    const fade = Math.min(1, (toastUntil - now) / 300);
    ctx.save(); ctx.globalAlpha = fade;
    const y = Math.min(logicalH - 185, 166);
    rounded(78, y, 324, 36, 14, 'rgba(20,55,51,.93)', 'rgba(240,246,218,.45)', 1);
    text(toast, 240, y + 18, 13, '#fff4d8', 750, 'center'); ctx.restore();
  }
  function drawCelebration(now) {
    for (const e of effects) {
      const t = (now - e.at) / e.life;
      if (t < 0 || t > 1) continue;
      const yy = e.y - t * 80, alpha = 1 - t;
      ctx.save(); ctx.globalAlpha = alpha;
      if (e.type === 'egg') {
        ellipse(e.x, yy, 14, 18, '#fff3d4', '#e1bd70', 2); ellipse(e.x - 4, yy - 4, 3, 5, '#fffdf4');
        text('奶蛋 +1', e.x + 34, yy - 4, 13, '#fff1bf', 850, 'left');
      } else {
        ctx.translate(e.x, yy); ctx.rotate(e.rot + t * 5); ctx.fillStyle = e.color; ctx.fillRect(-3, -6, 6, 12);
      }
      ctx.restore();
    }
    effects = effects.filter(e => now - e.at < e.life);
    if (roundState !== 'playing') {
      const fade = Math.min(1, (pauseUntil - now) / 350);
      ctx.save(); ctx.globalAlpha = Math.max(.8, fade);
      rounded(43, 164, 394, 74, 20, 'rgba(30,78,63,.96)', 'rgba(255,235,183,.58)', 1.5);
      text(roundState === 'success' ? '好耶！今日奶蛙效率冠军' : '客人等不及啦 · 下一单马上来', 240, 193, 17, '#fff2c9', 850, 'center');
      text(roundState === 'success' ? '准时送达，奶蛋收入 +1' : '这单没有奶蛋，继续加油！', 240, 219, 11, '#d9edc8', 650, 'center');
      ctx.restore();
    }
  }
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.save(); ctx.scale(scale, scale);
    drawBackground();
    ctx.save(); ctx.translate(offX, offY);
    drawHud(now);
    drawRoom();
    const actors = stations.map(st => ({ y: st.y, fn: () => drawStation(st, now) }));
    actors.push({ y: player.y, fn: () => drawFrog(player, now) });
    actors.sort((a, b) => a.y - b.y).forEach(a => a.fn());
    drawPrompt(now);
    drawToast(now);
    drawCelebration(now);
    ctx.restore();
    drawControls(now);
    ctx.restore();
  }
  function beginRound() { carried = []; seconds = 48; roundState = 'playing'; notify(`${recipe().guest}来下单啦，48 秒内做好这杯！`, 2200); }
  function playChime(success = false) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime;
      [0, success ? .13 : 0].forEach((delay, i) => {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = 'sine'; osc.frequency.value = (success ? [660, 880][i] : 560) * (success ? 1 : 1);
        gain.gain.setValueAtTime(.0001, t + delay); gain.gain.exponentialRampToValueAtTime(success ? .09 : .055, t + delay + .015); gain.gain.exponentialRampToValueAtTime(.0001, t + delay + .22);
        osc.connect(gain); gain.connect(audio.destination); osc.start(t + delay); osc.stop(t + delay + .24);
      });
    } catch (_) {}
  }
  function vibrate(ms = 12) { if (navigator.vibrate) navigator.vibrate(ms); }
  function interact() {
    if (roundState !== 'playing') return;
    const st = nearestStation();
    if (!st) { notify('再靠近亮起的工作台一点'); return; }
    if (st.item === 'deliver') {
      if (!allCollected()) { notify(`材料还差 ${recipe().required.filter(id => !carried.includes(id)).map(id => items[id].name).join('、')}`); return; }
      delivered++; eggs++; best = Math.max(best, eggs);
      try { localStorage.setItem('wawa-kitchen-best', String(best)); } catch (_) {}
      roundState = 'success'; pauseUntil = performance.now() + 2600;
      notify('交付成功！奶蛙捧到奶蛋啦', 2400); playChime(true); vibrate(24);
      effects.push({ type: 'egg', x: player.x + 28, y: player.y - 23, at: performance.now(), life: 1500 });
      for (let i = 0; i < 26; i++) effects.push({ type: 'confetti', x: 80 + Math.random() * 320, y: 225 + Math.random() * 120, at: performance.now() + Math.random() * 180, life: 1200 + Math.random() * 800, rot: Math.random() * 6, color: ['#f0c36f', '#e98592', '#88c98f', '#82c5d0'][i % 4] });
      return;
    }
    if (carried.includes(st.item)) { notify(`${items[st.item].name}已经拿好啦`); return; }
    if (!recipe().required.includes(st.item)) { notify(`这单不需要${items[st.item].name}`); return; }
    carried.push(st.item); notify(`拿到${items[st.item].name}！`); playChime(); vibrate();
  }
  function missOrder() {
    roundState = 'miss'; pauseUntil = performance.now() + 2200;
    notify('超时了，下一位客人马上来', 2100); vibrate(35);
  }
  function update(dt, now) {
    if (roundState !== 'playing') {
      if (now >= pauseUntil) { round++; beginRound(); }
      return;
    }
    seconds -= dt;
    if (seconds <= 0) { seconds = 0; missOrder(); return; }
    let dx = joy.dx, dy = joy.dy;
    if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const speed = 190;
    player.vx = dx * speed; player.vy = dy * speed;
    player.x = Math.max(51, Math.min(429, player.x + player.vx * dt));
    player.y = Math.max(214, Math.min(678, player.y + player.vy * dt));
    if (Math.abs(dx) > .1) player.face = dx > 0 ? 1 : -1;
    const prompt = actionLabel(); if (prompt !== lastPrompt) lastPrompt = prompt;
  }
  function screenToLogical(e) { return { x: e.clientX / cssW * logicalW, y: e.clientY / cssH * logicalH }; }
  function controlsGeometry() {
    return { jx: offX + 91, ax: offX + 385, cy: offY + Math.max(90, logicalH - 105) };
  }
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p = screenToLogical(e), g = controlsGeometry();
    if (p.x >= resetButton.x + offX - 5 && p.x <= resetButton.x + offX + resetButton.w + 5 && p.y >= resetButton.y + offY - 5 && p.y <= resetButton.y + offY + resetButton.h + 5) {
      round = 0; eggs = 0; delivered = 0; player = { x: 240, y: 585, vx: 0, vy: 0, face: 1 }; beginRound(); return;
    }
    if (Math.hypot(p.x - g.ax, p.y - g.cy) < 76) { interact(); return; }
    if (Math.hypot(p.x - g.jx, p.y - g.cy) < 95 && joy.id === null) {
      joy.id = e.pointerId; joy.x = g.jx; joy.y = g.cy; updateJoystick(p); return;
    }
    // Tap the kitchen to move toward a spot for players who prefer tap-to-walk.
    const tx = p.x - offX, ty = p.y - offY;
    if (tx > floor.x + 10 && tx < floor.x + floor.w - 10 && ty > floor.y + 25 && ty < floor.y + floor.h - 20) {
      const vx = tx - player.x, vy = ty - player.y, d = Math.max(1, Math.hypot(vx, vy));
      player.x = Math.max(51, Math.min(429, player.x + vx / d * Math.min(125, d)));
      player.y = Math.max(214, Math.min(678, player.y + vy / d * Math.min(125, d)));
    }
  }, { passive: false });
  function updateJoystick(p) {
    const g = controlsGeometry(), dx = p.x - g.jx, dy = p.y - g.cy, d = Math.hypot(dx, dy), r = 39;
    const m = d > r ? r / d : 1; joy.dx = dx * m / r; joy.dy = dy * m / r;
  }
  canvas.addEventListener('pointermove', e => { if (joy.id === e.pointerId) updateJoystick(screenToLogical(e)); });
  function endPointer(e) { if (joy.id === e.pointerId) { joy.id = null; joy.dx = 0; joy.dy = 0; } }
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer); canvas.addEventListener('lostpointercapture', endPointer);
  window.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (k === ' ' || k === 'e' || k === 'Enter') { if (!e.repeat) interact(); }
    keys.add(k);
  });
  window.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => { keys.clear(); joy.id = null; joy.dx = 0; joy.dy = 0; });
  function frame(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min(.04, (now - lastTime) / 1000); lastTime = now;
    update(dt, now); draw(now); requestAnimationFrame(frame);
  }
  beginRound(); requestAnimationFrame(frame);
})();
