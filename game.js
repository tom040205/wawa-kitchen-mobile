(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const srStatus = document.getElementById('sr-status');
  const orientationButton = document.getElementById('landscape-button');
  const W = 1100, H = 500;
  const floor = { x: 251, y: 25, w: 649, h: 448 };
  const ink = '#173b38', paper = '#fff8e8', cream = '#fff1d0', mint = '#91c99b';
  const items = {
    cup: { name: '空杯', short: '杯', tint: '#8acbd0' },
    pot: { name: '奶锅', short: '锅', tint: '#e9a85c' },
    oolong: { name: '乌龙茶', short: '茶', tint: '#89ad6e' },
    pearls: { name: '黑糖珍珠', short: '珍珠', tint: '#907362' },
    berry: { name: '草莓酱', short: '莓', tint: '#e78088' },
    foam: { name: '奶盖云', short: '奶盖', tint: '#e6d9b7' },
    matcha: { name: '抹茶粉', short: '抹茶', tint: '#8ab86d' }
  };
  const recipes = [
    { name: '黑糖云乌龙', guest: '小茶客', required: ['cup', 'pot', 'oolong', 'pearls'] },
    { name: '草莓云朵杯', guest: '莓莓蛙', required: ['cup', 'pot', 'berry', 'foam'] },
    { name: '抹茶奶盖杯', guest: '青团团', required: ['cup', 'pot', 'matcha', 'foam'] }
  ];
  const stations = [
    { item: 'cup', x: 330, y: 96 },
    { item: 'pot', x: 822, y: 96 },
    { item: 'oolong', x: 330, y: 213 },
    { item: 'pearls', x: 576, y: 145 },
    { item: 'berry', x: 822, y: 213 },
    { item: 'foam', x: 330, y: 326 },
    { item: 'matcha', x: 822, y: 326 },
    { item: 'deliver', x: 576, y: 418 }
  ];
  const photo = {
    frog: loadImage('assets/frog-front.jpg'),
    happy: loadImage('assets/frog-happy.jpg'),
    egg: loadImage('assets/milk-egg.jpg')
  };
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, logicalW = W, logicalH = H, offX = 0, offY = 0;
  let isLandscape = false;
  let player = { x: 576, y: 378, vx: 0, vy: 0, face: 1 };
  let round = 0, eggs = 0, best = 0, carried = [], seconds = 48;
  let lastTime = 0, roundState = 'playing', pauseUntil = 0, toast = '', toastUntil = 0, effects = [];
  let joy = { id: null, dx: 0, dy: 0 }, keys = new Set(), tapTarget = null;
  let audio = null, resetButton = { x: 204, y: 36, w: 22, h: 22 };
  const control = { joyX: 118, actionX: 1003, y: 410, joyR: 61, actionR: 55 };
  try { best = Number(localStorage.getItem('wawa-kitchen-best') || 0); } catch (_) {}

  function loadImage(src) {
    const img = new Image(); img.src = src; return img;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width; cssH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.25);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    isLandscape = cssW > cssH;
    scale = Math.min(cssW / W, cssH / H);
    logicalW = cssW / scale; logicalH = cssH / scale;
    offX = (logicalW - W) / 2; offY = (logicalH - H) / 2;
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', resize, { passive: true });
  resize();

  if (orientationButton) orientationButton.addEventListener('click', async () => {
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch (_) {}
    try {
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
    } catch (_) {}
    if (srStatus) srStatus.textContent = '请将手机横过来进入游戏';
  });

  function recipe() { return recipes[round % recipes.length]; }
  function allCollected() { return recipe().required.every(id => carried.includes(id)); }
  function notify(message, ms = 1650) {
    toast = message; toastUntil = performance.now() + ms;
    if (srStatus) srStatus.textContent = message;
  }
  function rounded(x, y, w, h, r, fill, stroke, line = 1) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = line; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function ellipse(x, y, rx, ry, fill, stroke, line = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = line; ctx.strokeStyle = stroke; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
  }
  function text(str, x, y, size, color, weight = 600, align = 'left') {
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function drawPhoto(image, x, y, w, h, blend = true) {
    if (!image || !image.complete || !image.naturalWidth) return false;
    ctx.save();
    // The supplied photos have white studio backgrounds; multiply blends those
    // whites into the game's light surfaces without altering the source images.
    if (blend) ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(image, x, y, w, h);
    ctx.restore();
    return true;
  }
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2c6257'); g.addColorStop(1, '#173b39');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 18; i++) {
      const x = 28 + ((i * 149 + 57) % 1040), y = 13 + ((i * 83 + 39) % 472);
      ellipse(x, y, 2 + (i % 3), 2 + (i % 3), 'rgba(230,244,211,.10)');
    }
  }
  function drawHud(now) {
    const x = 17, y = 17, w = 216, h = 316;
    rounded(x + 2, y + 6, w, h, 19, 'rgba(9,34,32,.24)');
    rounded(x, y, w, h, 19, paper, 'rgba(255,255,255,.44)', 1.4);
    text('蛙蛙厨房', x + 17, y + 27, 20, ink, 900);
    text('泡泡湾 · 今日营业中', x + 18, y + 48, 9, '#668075', 650);
    rounded(x + 147, y + 13, 52, 34, 11, seconds <= 10 ? '#f6d4c3' : '#eaf1d8');
    text(`${String(Math.max(0, Math.ceil(seconds))).padStart(2, '0')}秒`, x + 173, y + 30, 14, seconds <= 10 ? '#bd514b' : '#446d50', 850, 'center');
    rounded(x + 178, y + 56, 23, 22, 7, '#edf0df');
    text('↻', x + 189.5, y + 67, 15, '#5e8269', 800, 'center');
    resetButton = { x: x + 178, y: y + 56, w: 23, h: 22 };
    text(`${recipe().guest} 的订单`, x + 18, y + 82, 10, '#82907d', 650);
    text(recipe().name, x + 18, y + 104, 17, '#285d53', 850);
    text('收集材料', x + 18, y + 129, 10, '#7f8875', 750);
    const req = recipe().required, chipW = 87, chipH = 27, gapX = 9;
    req.forEach((id, i) => {
      const cx = x + 17 + (i % 2) * (chipW + gapX), cy = y + 143 + Math.floor(i / 2) * 34;
      const done = carried.includes(id), item = items[id];
      rounded(cx, cy, chipW, chipH, 9, done ? '#d9efcf' : '#f1ead9', done ? '#a9d1a1' : '#eadfc8', 1);
      text(done ? '✓' : item.short, cx + 12, cy + 13.5, 9, done ? '#4a8b5c' : item.tint, 850, 'center');
      text(item.name, cx + 25, cy + 13.5, 9, '#50675a', 700);
    });
    rounded(x + 17, y + 218, 182, 31, 10, '#edf0dc');
    text(allCollected() ? '材料齐了，去投喂台交付！' : '走近亮灯台，按右侧按钮取料', x + 108, y + 233.5, 9, '#5d7b5f', 700, 'center');
    // User-provided egg image is used in the score badge.
    rounded(x + 16, y + 261, 184, 39, 12, '#f5edd9');
    drawPhoto(photo.egg, x + 23, y + 262, 38, 37, true);
    text(`奶蛋 ${eggs}`, x + 67, y + 276, 13, '#5d845b', 850);
    text(`最佳 ${best}`, x + 67, y + 290, 9, '#86907b', 650);
  }
  function drawRoom() {
    const { x, y, w, h } = floor;
    rounded(x + 5, y + 9, w, h, 23, '#102c2b');
    rounded(x, y, w, h, 22, '#d7c39e', '#f3dfb6', 3);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 19); ctx.clip();
    ctx.fillStyle = '#efe2c5'; ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
    const tile = 54;
    for (let r = 0, yy = y + 5; yy < y + h - 5; r++, yy += tile) {
      for (let c = 0, xx = x + 5; xx < x + w - 5; c++, xx += tile) {
        if ((r + c) % 2 === 0) { ctx.fillStyle = 'rgba(255,249,227,.38)'; ctx.fillRect(xx, yy, tile, tile); }
        ctx.strokeStyle = 'rgba(153,125,83,.13)'; ctx.lineWidth = 1; ctx.strokeRect(xx, yy, tile, tile);
      }
    }
    rounded(454, 239, 242, 89, 19, 'rgba(202,168,121,.14)', 'rgba(153,125,83,.12)', 1);
    ctx.restore();
    rounded(x + 13, y + 5, w - 26, 25, 9, '#754d35');
    rounded(x + 19, y + 2, w - 38, 7, 4, '#e0b576');
    for (let i = 0; i < 7; i++) {
      rounded(x + 31 + i * 83, y + 10, 55, 14, 5, i % 2 ? '#477c69' : '#628b70');
      ellipse(x + 58 + i * 83, y + 17, 3.4, 3.4, '#e6d59e');
    }
    line(x + 12, y + 30, x + w - 12, y + 30, 'rgba(255,255,255,.48)', 2);
    text('小厨房 · 大快乐', x + w / 2, y + h - 12, 9, '#8c7657', 700, 'center');
  }
  function drawStation(st, now) {
    const isDelivery = st.item === 'deliver';
    const active = !isDelivery && recipe().required.includes(st.item) && !carried.includes(st.item);
    const done = !isDelivery && carried.includes(st.item);
    const ready = isDelivery && allCollected();
    const pulse = 0.5 + 0.5 * Math.sin(now * .004);
    if (active || ready) {
      ctx.save(); ctx.globalAlpha = .20 + pulse * .16;
      ellipse(st.x, st.y + 7, isDelivery ? 58 : 48, isDelivery ? 29 : 24, ready ? '#f1ca66' : '#80d49c'); ctx.restore();
      ellipse(st.x, st.y + 7, isDelivery ? 47 + pulse * 2 : 39 + pulse * 2, isDelivery ? 23 + pulse : 20 + pulse, null, ready ? '#c69c44' : '#69b989', 1.5);
    }
    if (isDelivery) { drawDelivery(st, ready, now); return; }
    rounded(st.x - 39, st.y - 3, 78, 42, 8, '#8c6241', '#6f4b35', 1);
    rounded(st.x - 42, st.y - 13, 84, 19, 7, '#f0d6a6', '#b88956', 1.4);
    rounded(st.x - 30, st.y + 8, 60, 26, 5, '#a8764d');
    line(st.x, st.y + 11, st.x, st.y + 31, '#d6ab72', 1);
    rounded(st.x - 5, st.y + 18, 10, 4, 2, '#614831');
    drawProp(st.item, st.x, st.y - 21);
    rounded(st.x - 42, st.y + 42, 84, 15, 6, active ? '#dcefcf' : '#e7ddc5');
    text(done ? '✓ 已拿' : active ? items[st.item].name : '备料站', st.x, st.y + 49.5, 9, done ? '#518458' : '#536b58', 700, 'center');
    if (done) ellipse(st.x + 33, st.y - 10, 8, 8, '#70b77a');
  }
  function drawProp(kind, x, y) {
    if (kind === 'cup') {
      rounded(x - 12, y - 11, 24, 22, 5, '#d9f0e7', '#7eaaa2', 1.5);
      ctx.beginPath(); ctx.moveTo(x - 9, y + 9); ctx.lineTo(x + 9, y + 9); ctx.lineTo(x + 7, y + 12); ctx.lineTo(x - 7, y + 12); ctx.closePath(); ctx.fillStyle = '#91c7bb'; ctx.fill();
      line(x + 3, y - 12, x + 6, y - 25, '#e7838c', 3); ellipse(x + 2, y - 14, 3, 2, '#fff7df');
    } else if (kind === 'pot') {
      rounded(x - 18, y - 12, 36, 20, 7, '#a9b7a9', '#738c7f', 1.5); rounded(x - 21, y - 15, 42, 5, 3, '#d3d8c5');
      line(x - 18, y - 3, x - 25, y - 3, '#536c60', 4); line(x + 18, y - 3, x + 25, y - 3, '#536c60', 4); ellipse(x, y - 18, 8, 3, '#e7b35f');
    } else if (kind === 'oolong' || kind === 'berry' || kind === 'matcha') {
      const fill = kind === 'oolong' ? '#77966d' : kind === 'berry' ? '#d96872' : '#7ca765';
      rounded(x - 12, y - 14, 24, 27, 6, fill, '#f5e9ca', 1.5); rounded(x - 7, y - 21, 14, 8, 3, '#c59662');
      ellipse(x, y + 11, 15, 5, 'rgba(80,61,37,.18)');
      if (kind === 'berry') { ellipse(x - 5, y - 2, 2, 2, '#ffd88f'); ellipse(x + 5, y + 4, 2, 2, '#ffd88f'); }
      if (kind === 'matcha') ellipse(x, y - 1, 7, 6, '#adc58a');
      if (kind === 'oolong') line(x - 5, y + 3, x + 5, y - 5, '#c6d49c', 2);
    } else if (kind === 'pearls') {
      ellipse(x, y - 3, 22, 12, '#715947', '#513f32', 1.3); ellipse(x, y - 7, 18, 9, '#9b7955');
      for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; ellipse(x + Math.cos(a) * 10, y - 7 + Math.sin(a) * 4, 3, 3, '#3b3029'); }
      ellipse(x, y - 8, 3, 3, '#3b3029');
    } else if (kind === 'foam') {
      ellipse(x, y + 2, 17, 10, '#e5d8b7', '#b9a882', 1.2); ellipse(x - 8, y - 6, 7, 7, '#fff6dc'); ellipse(x, y - 10, 8, 9, '#fff8e6'); ellipse(x + 8, y - 5, 7, 7, '#fff2d2');
    }
  }
  function drawDelivery(st, ready, now) {
    rounded(st.x - 51, st.y - 4, 102, 36, 9, '#74503b', '#563d2f', 1);
    rounded(st.x - 55, st.y - 14, 110, 21, 8, '#eacb91', '#b18a54', 1.5);
    rounded(st.x - 34, st.y - 31, 68, 19, 8, '#fff2d4', '#d0aa71', 1.2);
    text('投喂', st.x, st.y - 21, 11, '#8f6845', 850, 'center');
    ellipse(st.x, st.y + 17, 11, 4, '#4c3428');
    if (ready) drawPhoto(photo.egg, st.x - 16, st.y - 54 - Math.sin(now * .005) * 2, 32, 31, true);
    rounded(st.x - 47, st.y + 36, 94, 16, 6, ready ? '#f6e3aa' : '#e7ddc5');
    text(ready ? '订单齐了 · 交付' : '投喂台', st.x, st.y + 44, 9, ready ? '#8a6536' : '#6a705e', 750, 'center');
  }
  function drawFallbackFrog(x, y, now) {
    ellipse(x, y + 5, 24, 8, 'rgba(57,68,46,.22)');
    ellipse(x, y - 8, 22, 28, '#e8c964', '#9c803f', 1.5); ellipse(x, y + 1, 13, 14, '#efe3c2');
    ellipse(x - 11, y - 28, 8, 12, '#dfc454'); ellipse(x + 11, y - 28, 8, 12, '#dfc454');
    ellipse(x - 11, y - 30, 3, 4, '#fff'); ellipse(x + 11, y - 30, 3, 4, '#fff');
    ellipse(x - 11, y - 30, 1.5, 2.3, '#172a23'); ellipse(x + 11, y - 30, 1.5, 2.3, '#172a23');
  }
  function drawFrog(p, now) {
    const bob = Math.sin(now * .006) * (Math.abs(p.vx) + Math.abs(p.vy) > 8 ? 2 : 1);
    const x = p.x, y = p.y + bob;
    ellipse(x, y + 5, 38, 10, 'rgba(57,68,46,.25)');
    const happy = roundState === 'success';
    const img = happy ? photo.happy : photo.frog;
    if (img && img.complete && img.naturalWidth) {
      const w = happy ? 108 : 126, h = happy ? 138 : 126;
      ctx.save();
      if (!happy && p.face < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(img, x - w / 2, y - h + 4, w, h);
      ctx.restore();
    } else drawFallbackFrog(x, y, now);
    carried.forEach((id, i) => {
      const icon = items[id];
      ellipse(x - 24 + i * 15, y + 9, 7, 6, icon.tint, '#fff4df', 1);
      text(icon.short.slice(0, 1), x - 24 + i * 15, y + 9, 7, '#fffef0', 850, 'center');
    });
  }
  function nearestStation() {
    let nearest = null, distance = Infinity;
    for (const st of stations) {
      const d = Math.hypot(player.x - st.x, player.y - st.y);
      if (d < distance) { nearest = st; distance = d; }
    }
    return distance < 63 ? nearest : null;
  }
  function actionLabel() {
    const st = nearestStation();
    if (!st) return '互动';
    if (st.item === 'deliver') return allCollected() ? '交付' : '缺材料';
    if (carried.includes(st.item)) return '已拿';
    if (!recipe().required.includes(st.item)) return '不需要';
    return `拿${items[st.item].short}`;
  }
  function drawPrompt() {
    const st = nearestStation(); if (!st) return;
    const label = st.item === 'deliver' ? (allCollected() ? '订单齐啦！送到投喂台' : '先去亮灯工作台收集材料') : carried.includes(st.item) ? `${items[st.item].name}已经拿好` : !recipe().required.includes(st.item) ? '这单暂时不需要' : `按右侧按钮 · ${items[st.item].name}`;
    const w = Math.min(235, Math.max(162, label.length * 10 + 22));
    const x = Math.max(floor.x + 8, Math.min(floor.x + floor.w - w - 8, player.x - w / 2));
    const y = Math.max(floor.y + 37, player.y - 137);
    rounded(x, y, w, 27, 11, 'rgba(23,59,56,.94)', 'rgba(255,255,255,.32)', 1);
    text(label, x + w / 2, y + 13.5, 10, '#fff5db', 700, 'center');
  }
  function controlCenters() { return { jx: offX + control.joyX, ax: offX + control.actionX, cy: offY + control.y }; }
  function drawControls() {
    const { jx, ax, cy } = controlCenters();
    ellipse(jx, cy + 5, control.joyR, control.joyR, 'rgba(6,29,28,.20)');
    ellipse(jx, cy, control.joyR - 2, control.joyR - 2, 'rgba(239,249,221,.15)', 'rgba(240,249,224,.45)', 1.5);
    ellipse(jx, cy, 30, 30, 'rgba(237,249,225,.09)', 'rgba(239,248,226,.20)', 1);
    const knobX = jx + (joy.id !== null ? joy.dx * 36 : 0), knobY = cy + (joy.id !== null ? joy.dy * 36 : 0);
    ellipse(knobX, knobY + 2, 26, 26, 'rgba(8,38,35,.23)'); ellipse(knobX, knobY, 25, 25, 'rgba(225,245,218,.82)', 'rgba(255,255,240,.82)', 1.3);
    text('移动', jx, cy + 77, 10, 'rgba(244,249,224,.80)', 750, 'center');
    const label = actionLabel(), enabled = !['互动', '缺材料', '已拿', '不需要'].includes(label);
    const fill = label === '交付' ? '#e9b95c' : enabled ? '#e9a960' : 'rgba(231,241,215,.20)';
    ellipse(ax, cy + 5, control.actionR, control.actionR, 'rgba(6,29,28,.24)');
    ellipse(ax, cy, control.actionR - 2, control.actionR - 2, fill, enabled ? '#fff1c9' : 'rgba(235,246,226,.48)', 2);
    ellipse(ax, cy, 39, 39, enabled ? 'rgba(255,246,212,.19)' : 'rgba(255,255,255,.06)');
    text(label, ax, cy - 3, label.length > 4 ? 13 : 17, enabled ? '#fffaf0' : 'rgba(244,249,224,.78)', 850, 'center');
    text('互动', ax, cy + 21, 9, enabled ? 'rgba(255,250,235,.92)' : 'rgba(244,249,224,.60)', 650, 'center');
  }
  function drawToast(now) {
    if (now > toastUntil || !toast) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, (toastUntil - now) / 260);
    rounded(398, 37, 356, 34, 13, 'rgba(20,55,51,.93)', 'rgba(240,246,218,.45)', 1);
    text(toast, 576, 54, 12, '#fff4d8', 750, 'center'); ctx.restore();
  }
  function drawCelebration(now) {
    for (const e of effects) {
      const t = (now - e.at) / e.life; if (t < 0 || t > 1) continue;
      ctx.save(); ctx.globalAlpha = 1 - t;
      if (e.type === 'egg') {
        rounded(e.x - 33, e.y - 31 - t * 48, 66, 62, 16, '#fff5da', '#e5c87f', 1.5);
        drawPhoto(photo.egg, e.x - 30, e.y - 29 - t * 48, 60, 58, true);
      } else {
        ctx.translate(e.x, e.y + t * 85); ctx.rotate(e.rot + t * 5); ctx.fillStyle = e.color; ctx.fillRect(-4, -7, 8, 14);
      }
      ctx.restore();
    }
    effects = effects.filter(e => now - e.at < e.life);
    if (roundState !== 'playing') {
      rounded(383, 38, 386, 70, 18, 'rgba(30,78,63,.96)', 'rgba(255,235,183,.60)', 1.4);
      text(roundState === 'success' ? '好耶！奶蛙准时交付' : '客人等不及啦 · 下一单马上来', 576, 64, 16, '#fff2c9', 850, 'center');
      text(roundState === 'success' ? '奶蛋收入 +1' : '这单没有奶蛋，继续加油！', 576, 89, 10, '#d9edc8', 650, 'center');
    }
  }
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#173d3b'; ctx.fillRect(0, 0, cssW, cssH);
    ctx.scale(scale, scale); ctx.translate(offX, offY);
    drawBackground(); drawHud(now); drawRoom();
    const actors = stations.map(st => ({ y: st.y, fn: () => drawStation(st, now) }));
    actors.push({ y: player.y, fn: () => drawFrog(player, now) });
    actors.sort((a, b) => a.y - b.y).forEach(a => a.fn());
    drawPrompt(); drawToast(now); drawCelebration(now); drawControls();
  }
  function beginRound() { carried = []; seconds = 48; roundState = 'playing'; notify(`${recipe().guest}来下单啦，48 秒内做好这杯！`, 2200); }
  function playChime(success = false) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime, tones = success ? [660, 880] : [560];
      tones.forEach((frequency, i) => {
        const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, t + i * .13); gain.gain.exponentialRampToValueAtTime(success ? .09 : .055, t + i * .13 + .015); gain.gain.exponentialRampToValueAtTime(.0001, t + i * .13 + .22);
        osc.connect(gain); gain.connect(audio.destination); osc.start(t + i * .13); osc.stop(t + i * .13 + .24);
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
      eggs++; best = Math.max(best, eggs); try { localStorage.setItem('wawa-kitchen-best', String(best)); } catch (_) {}
      roundState = 'success'; pauseUntil = performance.now() + 2700; notify('交付成功！奶蛙捧到奶蛋啦', 2400); playChime(true); vibrate(24);
      effects.push({ type: 'egg', x: player.x + 58, y: player.y - 73, at: performance.now(), life: 1600 });
      for (let i = 0; i < 28; i++) effects.push({ type: 'confetti', x: 310 + Math.random() * 510, y: 95 + Math.random() * 120, at: performance.now() + Math.random() * 180, life: 1200 + Math.random() * 800, rot: Math.random() * 6, color: ['#f0c36f', '#e98592', '#88c98f', '#82c5d0'][i % 4] });
      return;
    }
    if (carried.includes(st.item)) { notify(`${items[st.item].name}已经拿好啦`); return; }
    if (!recipe().required.includes(st.item)) { notify(`这单不需要${items[st.item].name}`); return; }
    carried.push(st.item); notify(`拿到${items[st.item].name}！`); playChime(); vibrate();
  }
  function missOrder() { roundState = 'miss'; pauseUntil = performance.now() + 2200; notify('超时了，下一位客人马上来', 2100); vibrate(32); }
  function resetGame() {
    round = 0; eggs = 0; best = 0; try { localStorage.setItem('wawa-kitchen-best', '0'); } catch (_) {}
    player = { x: 576, y: 378, vx: 0, vy: 0, face: 1 }; beginRound();
  }
  function update(dt, now) {
    if (!isLandscape) return;
    if (roundState !== 'playing') { if (now >= pauseUntil) { round++; beginRound(); } return; }
    seconds -= dt; if (seconds <= 0) { seconds = 0; missOrder(); return; }
    let dx = joy.dx, dy = joy.dy;
    if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
    if (Math.hypot(dx, dy) > 1) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; }
    if (Math.abs(dx) + Math.abs(dy) < .01 && tapTarget) {
      const tx = tapTarget.x - player.x, ty = tapTarget.y - player.y, d = Math.hypot(tx, ty);
      if (d < 6) tapTarget = null; else { dx = tx / d; dy = ty / d; }
    }
    const speed = 205;
    player.vx = dx * speed; player.vy = dy * speed;
    player.x = Math.max(280, Math.min(873, player.x + player.vx * dt));
    player.y = Math.max(70, Math.min(444, player.y + player.vy * dt));
    if (Math.abs(dx) > .1) player.face = dx > 0 ? 1 : -1;
  }
  function screenToLogical(e) { return { x: e.clientX / cssW * logicalW, y: e.clientY / cssH * logicalH }; }
  function pointerDown(e) {
    if (!isLandscape) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p = screenToLogical(e), x = p.x - offX, y = p.y - offY, c = controlCenters();
    if (x >= resetButton.x - 7 && x <= resetButton.x + resetButton.w + 7 && y >= resetButton.y - 7 && y <= resetButton.y + resetButton.h + 7) { resetGame(); return; }
    if (Math.hypot(p.x - c.ax, p.y - c.cy) < 78) { interact(); return; }
    if (Math.hypot(p.x - c.jx, p.y - c.cy) < 92 && joy.id === null) { joy.id = e.pointerId; updateJoystick(p); tapTarget = null; return; }
    if (x > floor.x + 10 && x < floor.x + floor.w - 10 && y > floor.y + 34 && y < floor.y + floor.h - 20) tapTarget = { x, y };
  }
  function updateJoystick(p) {
    const c = controlCenters(), dx = p.x - c.jx, dy = p.y - c.cy, d = Math.hypot(dx, dy), r = 39, m = d > r ? r / d : 1;
    joy.dx = dx * m / r; joy.dy = dy * m / r;
  }
  function endPointer(e) { if (joy.id === e.pointerId) { joy.id = null; joy.dx = 0; joy.dy = 0; } }
  canvas.addEventListener('pointerdown', pointerDown, { passive: false });
  canvas.addEventListener('pointermove', e => { if (joy.id === e.pointerId) updateJoystick(screenToLogical(e)); });
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
