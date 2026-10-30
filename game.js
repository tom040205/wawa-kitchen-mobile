(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const srStatus = document.getElementById('sr-status');
  const orientationButton = document.getElementById('landscape-button');
  const W = 1100, H = 500, ROUND_SECONDS = 32;
  const floor = { x: 0, y: 0, w: W, h: H };
  const ink = '#173b38', paper = '#fff8e8';
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
    { item: 'cup', x: 165, y: 162 }, { item: 'pot', x: 935, y: 162 },
    { item: 'oolong', x: 165, y: 284 }, { item: 'pearls', x: 550, y: 143 },
    { item: 'berry', x: 935, y: 284 }, { item: 'foam', x: 350, y: 390 },
    { item: 'matcha', x: 750, y: 390 }, { item: 'deliver', x: 550, y: 425 }
  ];
  const photo = {
    frog: loadImage('assets/frog-front.jpg'),
    happy: loadImage('assets/frog-happy.jpg'),
    egg: loadImage('assets/milk-egg.jpg')
  };
  let cssW = 0, cssH = 0, dpr = 1, scale = 1, logicalW = W, logicalH = H;
  let isLandscape = false, didLayout = false;
  let player = { x: W / 2, y: H * .68, vx: 0, vy: 0, face: 1 };
  let round = 0, eggs = 0, best = 0, carried = [], seconds = ROUND_SECONDS;
  let lastTime = 0, roundState = 'playing', pauseUntil = 0, toast = '', toastUntil = 0, effects = [];
  let paused = false, urgencyWarned = false, flyingDish = null;
  let joy = { id: null, active: false, baseX: 118, baseY: H - 94, dx: 0, dy: 0 };
  let keys = new Set(), tapTarget = null, audio = null;
  let pauseButton = { x: W - 124, y: 12, w: 48, h: 44 };
  let resetButton = { x: W - 52, y: 12, w: 44, h: 44 };
  let resumeButton = { x: W / 2 - 86, y: H / 2 + 12, w: 172, h: 46 };
  const control = { defaultJoyX: 118, joyR: 62, actionR: 56 };
  try { best = Number(localStorage.getItem('wawa-kitchen-best') || 0); } catch (_) {}

  function loadImage(src) { const img = new Image(); img.src = src; return img; }
  function layoutScene() {
    floor.w = logicalW; floor.h = logicalH;
    const w = logicalW, h = logicalH;
    stations.forEach(st => {
      if (st.item === 'cup') { st.x = w * .15; st.y = h * .32; }
      else if (st.item === 'pot') { st.x = w * .85; st.y = h * .32; }
      else if (st.item === 'oolong') { st.x = w * .15; st.y = h * .56; }
      else if (st.item === 'pearls') { st.x = w * .5; st.y = h * .28; }
      else if (st.item === 'berry') { st.x = w * .85; st.y = h * .56; }
      else if (st.item === 'foam') { st.x = w * .32; st.y = h * .77; }
      else if (st.item === 'matcha') { st.x = w * .68; st.y = h * .77; }
      else if (st.item === 'deliver') { st.x = w * .5; st.y = h * .85; }
    });
    if (!didLayout) {
      player.x = w * .5; player.y = h * .68; didLayout = true;
    } else {
      player.x = Math.max(52, Math.min(w - 52, player.x));
      player.y = Math.max(72, Math.min(h - 42, player.y));
    }
    if (!joy.active) { joy.baseX = control.defaultJoyX; joy.baseY = h - 94; }
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width; cssH = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2.25);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    isLandscape = cssW > cssH;
    scale = Math.min(cssW / W, cssH / H);
    logicalW = cssW / scale; logicalH = cssH / scale;
    layoutScene();
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', resize, { passive: true });
  resize();
  if (orientationButton) orientationButton.addEventListener('click', async () => {
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (_) {}
    try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (_) {}
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
  function drawPhoto(image, x, y, w, h) {
    if (!image || !image.complete || !image.naturalWidth) return false;
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(image, x, y, w, h); ctx.restore();
    return true;
  }
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, logicalW, logicalH);
    g.addColorStop(0, '#f3e7cb'); g.addColorStop(1, '#e8d9b6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, logicalW, logicalH);
  }
  function drawHud(now) {
    const x = 14, y = 11, w = Math.min(406, logicalW - 28), h = 111;
    rounded(x + 2, y + 5, w, h, 18, 'rgba(79,57,36,.20)');
    rounded(x, y, w, h, 18, paper, 'rgba(255,255,255,.58)', 1.5);
    text('蛙蛙厨房', x + 16, y + 22, 19, ink, 900);
    text(`${recipe().guest} 的订单`, x + 16, y + 43, 9, '#82907d', 650);
    text(recipe().name, x + 16, y + 65, 16, '#285d53', 850);
    const urgent = seconds <= 10, flash = urgent && Math.floor(now / 260) % 2 === 0;
    rounded(x + w - 88, y + 12, 72, 36, 11, urgent ? (flash ? '#f5c5ba' : '#f7e1d7') : '#eaf1d8');
    text(`${String(Math.max(0, Math.ceil(seconds))).padStart(2, '0')}秒`, x + w - 52, y + 30, urgent ? 18 : 17, urgent ? '#b63e35' : '#446d50', 900, 'center');
    drawPhoto(photo.egg, x + w - 91, y + 52, 30, 29);
    text(`奶蛋 ${eggs}`, x + w - 58, y + 62, 10, '#5d845b', 850);
    text(`最佳 ${best}`, x + w - 58, y + 78, 8, '#86907b', 650);
    pauseButton = { x: logicalW - 124, y: 12, w: 48, h: 44 };
    resetButton = { x: logicalW - 52, y: 12, w: 44, h: 44 };
    rounded(pauseButton.x, pauseButton.y, pauseButton.w, pauseButton.h, 11, 'rgba(255,248,232,.96)', '#c5b185', 1);
    text(paused ? '▶' : 'Ⅱ', pauseButton.x + pauseButton.w / 2, pauseButton.y + 15, 15, '#426d58', 900, 'center');
    text(paused ? '继续' : '暂停', pauseButton.x + pauseButton.w / 2, pauseButton.y + 34, 8, '#426d58', 750, 'center');
    rounded(resetButton.x, resetButton.y, resetButton.w, resetButton.h, 11, 'rgba(255,248,232,.96)', '#c5b185', 1);
    text('↻', resetButton.x + resetButton.w / 2, resetButton.y + 15, 17, '#5e8269', 800, 'center');
    text('重开', resetButton.x + resetButton.w / 2, resetButton.y + 34, 8, '#5e8269', 750, 'center');
    const req = recipe().required, chipW = Math.min(89, (w - 28) / 4 - 3), chipH = 22, gap = 4;
    req.forEach((id, i) => {
      const cx = x + 12 + i * (chipW + gap), cy = y + 84;
      const done = carried.includes(id), item = items[id];
      rounded(cx, cy, chipW, chipH, 8, done ? '#d9efcf' : '#f1ead9', done ? '#a9d1a1' : '#eadfc8', 1);
      text(done ? '✓' : item.short, cx + 11, cy + 11, 8, done ? '#4a8b5c' : item.tint, 850, 'center');
      text(item.name, cx + 22, cy + 11, 8, '#50675a', 700);
    });
  }
  function drawRoom() {
    const w = logicalW, h = logicalH, top = Math.max(31, h * .064);
    ctx.fillStyle = '#eee2c5'; ctx.fillRect(0, 0, w, h);
    const tile = Math.max(46, Math.min(60, h * .108));
    for (let r = 0, yy = top; yy < h; r++, yy += tile) {
      for (let c = 0, xx = 0; xx < w; c++, xx += tile) {
        if ((r + c) % 2 === 0) { ctx.fillStyle = 'rgba(255,250,230,.40)'; ctx.fillRect(xx, yy, tile, tile); }
        ctx.strokeStyle = 'rgba(148,119,76,.15)'; ctx.lineWidth = 1; ctx.strokeRect(xx, yy, tile, tile);
      }
    }
    // Counter and shelf now run edge-to-edge; the order card sits over this scene.
    ctx.fillStyle = '#72503a'; ctx.fillRect(0, 0, w, 27);
    ctx.fillStyle = '#e1b97d'; ctx.fillRect(0, 26, w, 6);
    const slots = Math.max(6, Math.floor(w / 132));
    for (let i = 0; i < slots; i++) {
      const slotW = 50, gap = (w - slots * slotW) / (slots + 1), sx = gap + i * (slotW + gap);
      rounded(sx, 5, slotW, 17, 5, i % 2 ? '#477c69' : '#628b70');
      ellipse(sx + slotW / 2, 13.5, 3.5, 3.5, '#e6d59e');
    }
    line(0, top, w, top, 'rgba(255,255,255,.58)', 2);
    rounded(w * .42, h * .49, w * .16, h * .17, 17, 'rgba(202,168,121,.11)', 'rgba(153,125,83,.11)', 1);
    text('小厨房 · 大快乐', w / 2, h - 12, 9, '#8c7657', 700, 'center');
  }
  function drawStation(st, now) {
    const isDelivery = st.item === 'deliver';
    const active = !isDelivery && recipe().required.includes(st.item) && !carried.includes(st.item);
    const done = !isDelivery && carried.includes(st.item);
    const ready = isDelivery && allCollected() && !flyingDish;
    const pulse = .5 + .5 * Math.sin(now * .004);
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
    if (ready) drawPhoto(photo.egg, st.x - 16, st.y - 54 - Math.sin(now * .005) * 2, 32, 31);
    rounded(st.x - 47, st.y + 36, 94, 16, 6, ready ? '#f6e3aa' : '#e7ddc5');
    text(ready ? '订单齐了 · 交付' : '投喂台', st.x, st.y + 44, 9, ready ? '#8a6536' : '#6a705e', 750, 'center');
  }
  function drawFrog(p, now) {
    const speed = Math.hypot(p.vx, p.vy), walking = speed > 26;
    const laughing = roundState === 'success' && photo.happy && photo.happy.complete && photo.happy.naturalWidth;
    const image = laughing ? photo.happy : photo.frog;
    const avatarW = laughing ? 148 : 126, avatarH = laughing ? 160 : 126;
    const phase = now / 118;
    const bob = walking ? Math.abs(Math.sin(phase)) * 4.5 : Math.sin(now * .0022) * 1.5;
    const lean = walking ? Math.sin(phase) * .055 : laughing ? Math.sin(now * .012) * .045 : 0;
    const breathe = walking ? 1 + Math.sin(phase) * .018 : 1 + Math.sin(now * (laughing ? .008 : .0022)) * (laughing ? .025 : .012);
    const x = p.x, y = p.y + bob;
    ellipse(x, p.y + 5, walking ? 40 : 38, walking ? 8 + Math.abs(Math.sin(phase)) * 2 : 9, 'rgba(57,68,46,.24)');
    const drawCharacter = () => {
      if (image && image.complete && image.naturalWidth) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(image, -avatarW / 2, -avatarH + 4, avatarW, avatarH);
      } else drawFallbackFrog(0, 0, now);
    };
    if (walking) {
      const step = Math.sin(phase) > 0 ? -1 : 1;
      ctx.save(); ctx.translate(x, y); ctx.rotate(lean); ctx.scale(p.face * breathe, 1 / breathe); drawCharacter(); ctx.restore();
      ellipse(x + step * 15, p.y + 9, 8, 2.6, 'rgba(58,78,48,.32)');
    } else {
      ctx.save(); ctx.translate(x, y); ctx.rotate(lean); ctx.scale(p.face * breathe, 1 / breathe); drawCharacter(); ctx.restore();
    }
    carried.forEach((id, i) => {
      const item = items[id]; ellipse(x - 25 + i * 15, p.y + 7, 7, 6, item.tint, '#fff4df', 1);
      text(item.short.slice(0, 1), x - 25 + i * 15, p.y + 7, 7, '#fffef0', 850, 'center');
    });
  }
  function drawFallbackFrog(x, y) {
    ellipse(x, y - 9, 22, 28, '#e8c964', '#9c803f', 1.5); ellipse(x, y, 13, 14, '#efe3c2');
    ellipse(x - 11, y - 29, 8, 12, '#dfc454'); ellipse(x + 11, y - 29, 8, 12, '#dfc454');
    ellipse(x - 11, y - 31, 3, 4, '#fff'); ellipse(x + 11, y - 31, 3, 4, '#fff');
    ellipse(x - 11, y - 31, 1.5, 2.3, '#172a23'); ellipse(x + 11, y - 31, 1.5, 2.3, '#172a23');
  }
  function nearestStation() {
    if (flyingDish) {
      const d = Math.hypot(player.x - flyingDish.x, player.y - flyingDish.y);
      return d < 72 ? { item: 'flyingDish', x: flyingDish.x, y: flyingDish.y } : null;
    }
    let nearest = null, distance = Infinity;
    for (const st of stations) { const d = Math.hypot(player.x - st.x, player.y - st.y); if (d < distance) { nearest = st; distance = d; } }
    return distance < 66 ? nearest : null;
  }
  function actionLabel() {
    const st = nearestStation();
    if (flyingDish) return st && st.item === 'flyingDish' ? '抓奶茶' : '追奶茶';
    if (!st) return '互动';
    if (st.item === 'deliver') return allCollected() ? '交付' : '缺材料';
    if (carried.includes(st.item)) return '已拿';
    if (!recipe().required.includes(st.item)) return '不需要';
    return `拿${items[st.item].short}`;
  }
  function drawPrompt() {
    if (roundState !== 'playing') return;
    const st = nearestStation();
    if (!st && !flyingDish) return;
    let label;
    if (flyingDish) label = st ? '追上啦！按右侧按钮抓住奶茶' : '餐品飞走啦！追近后按右侧按钮';
    else label = st.item === 'deliver' ? (allCollected() ? '订单齐啦！送到投喂台' : '先去亮灯工作台收集材料') : carried.includes(st.item) ? `${items[st.item].name}已经拿好` : !recipe().required.includes(st.item) ? '这单暂时不需要' : `按右侧按钮 · ${items[st.item].name}`;
    const w = Math.min(260, Math.max(174, label.length * 10 + 22));
    const x = Math.max(8, Math.min(logicalW - w - 8, player.x - w / 2));
    const y = Math.max(130, player.y - 145);
    rounded(x, y, w, 27, 11, 'rgba(23,59,56,.93)', 'rgba(255,255,255,.34)', 1);
    text(label, x + w / 2, y + 13.5, 10, '#fff5db', 700, 'center');
  }
  function controlCenters() {
    return { jx: joy.active ? joy.baseX : control.defaultJoyX, ax: logicalW - 96, cy: joy.active ? joy.baseY : logicalH - 94 };
  }
  function drawControls() {
    const { jx, ax, cy } = controlCenters();
    const ringAlpha = joy.active ? .28 : .16;
    ellipse(jx, cy + 4, control.joyR, control.joyR, 'rgba(25,59,51,.12)');
    ellipse(jx, cy, control.joyR - 2, control.joyR - 2, `rgba(239,249,221,${ringAlpha})`, 'rgba(240,249,224,.48)', 1.5);
    ellipse(jx, cy, 30, 30, 'rgba(237,249,225,.09)', 'rgba(239,248,226,.26)', 1);
    const knobX = jx + joy.dx * 38, knobY = cy + joy.dy * 38;
    ellipse(knobX, knobY + 2, 26, 26, 'rgba(8,38,35,.23)');
    ellipse(knobX, knobY, 25, 25, 'rgba(225,245,218,.86)', 'rgba(255,255,240,.88)', 1.3);
    text('拖动移动', jx, cy + 74, 9, 'rgba(50,78,61,.72)', 750, 'center');
    const label = actionLabel(), enabled = label === '交付' || label === '抓奶茶' || label.startsWith('拿');
    const fill = label === '交付' ? '#e9b95c' : enabled ? '#e9a960' : 'rgba(53,91,70,.28)';
    ellipse(ax, cy + 4, control.actionR, control.actionR, 'rgba(25,59,51,.14)');
    ellipse(ax, cy, control.actionR - 2, control.actionR - 2, fill, enabled ? '#fff1c9' : 'rgba(255,250,228,.72)', 2);
    ellipse(ax, cy, 39, 39, enabled ? 'rgba(255,246,212,.20)' : 'rgba(255,255,255,.10)');
    text(label, ax, cy - 3, label.length > 4 ? 13 : 17, enabled ? '#fffaf0' : '#fff9e8', 850, 'center');
    text(flyingDish ? '追上互动' : '互动', ax, cy + 21, 9, enabled ? 'rgba(255,250,235,.95)' : 'rgba(255,250,235,.78)', 650, 'center');
  }
  function drawFlyingDish(now) {
    if (!flyingDish) return;
    const x = flyingDish.x, y = flyingDish.y + Math.sin(now * .008) * 3;
    const pulse = .5 + .5 * Math.sin(now * .009);
    ellipse(x, y + 18, 34 + pulse * 3, 10 + pulse, 'rgba(100,157,115,.20)', 'rgba(94,153,111,.35)', 1.5);
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(now * .004) * .09); ctx.scale(1.45, 1.45); drawProp('cup', 0, 0); ctx.restore();
    ellipse(x - 26, y - 15, 3, 3, '#f2c86e'); ellipse(x + 25, y + 5, 2.5, 2.5, '#e9878d');
    rounded(x - 38, y - 49, 76, 19, 9, 'rgba(255,247,220,.96)', '#d9b76e', 1);
    text(flyingDish.settled ? '来抓我呀' : '追我呀！', x, y - 39.5, 9, '#8c633e', 850, 'center');
  }
  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(20,48,43,.55)'; ctx.fillRect(0, 0, logicalW, logicalH);
    const w = Math.min(328, logicalW - 36), h = 166, x = (logicalW - w) / 2, y = (logicalH - h) / 2;
    rounded(x + 3, y + 6, w, h, 20, 'rgba(12,33,30,.24)');
    rounded(x, y, w, h, 20, '#fff8e8', 'rgba(255,255,255,.72)', 1.5);
    text('暂停一下', logicalW / 2, y + 38, 22, '#285d53', 900, 'center');
    text('倒计时和飞走的餐品都停住了', logicalW / 2, y + 70, 11, '#73836e', 650, 'center');
    resumeButton = { x: logicalW / 2 - 86, y: y + 96, w: 172, h: 46 };
    rounded(resumeButton.x, resumeButton.y, resumeButton.w, resumeButton.h, 14, '#e7b85f', '#d3a54e', 1.2);
    text('继续游戏', logicalW / 2, resumeButton.y + 23, 14, '#fffaf0', 850, 'center');
  }
  function drawUrgency(now) {
    if (paused || roundState !== 'playing' || seconds > 10) return;
    const alpha = .10 + (.5 + .5 * Math.sin(now * .014)) * .12;
    ctx.save(); ctx.strokeStyle = `rgba(191,61,52,${alpha})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, logicalW - 8, logicalH - 8); ctx.restore();
  }
  function drawToast(now) {
    if (now > toastUntil || !toast) return;
    const left = 432, right = logicalW - 132, w = Math.min(365, right - left), x = left + (right - left - w) / 2, y = 23;
    ctx.save(); ctx.globalAlpha = Math.min(1, (toastUntil - now) / 260);
    rounded(x, y, w, 34, 13, 'rgba(20,55,51,.93)', 'rgba(240,246,218,.45)', 1);
    text(toast, x + w / 2, y + 17, 12, '#fff4d8', 750, 'center'); ctx.restore();
  }
  function drawCelebration(now) {
    for (const e of effects) {
      const t = (now - e.at) / e.life; if (t < 0 || t > 1) continue;
      ctx.save(); ctx.globalAlpha = 1 - t;
      if (e.type === 'egg') {
        rounded(e.x - 36, e.y - 34 - t * 56, 72, 68, 17, '#fff5da', '#e5c87f', 1.5);
        drawPhoto(photo.egg, e.x - 33, e.y - 32 - t * 56, 66, 64);
      } else {
        ctx.translate(e.x, e.y + t * 85); ctx.rotate(e.rot + t * 5); ctx.fillStyle = e.color; ctx.fillRect(-4, -7, 8, 14);
      }
      ctx.restore();
    }
    effects = effects.filter(e => now - e.at < e.life);
    if (roundState === 'miss') {
      const x = logicalW / 2, y = Math.max(132, logicalH * .26);
      rounded(x - 193, y - 30, 386, 68, 18, 'rgba(30,78,63,.95)', 'rgba(255,235,183,.62)', 1.4);
      text('客人等不及啦 · 下一单马上来', x, y - 5, 16, '#fff2c9', 850, 'center');
      text('这单没有奶蛋，继续加油！', x, y + 20, 10, '#d9edc8', 650, 'center');
    } else if (roundState === 'success') {
      const bw = 220, bx = Math.max(8, Math.min(logicalW - bw - 8, player.x - 184));
      const by = Math.max(128, player.y - 207);
      rounded(bx, by, bw, 33, 13, '#fff4d8', '#e6c77e', 1.2);
      text('哈哈哈哈！奶蛋到手啦！', bx + bw / 2, by + 16.5, 12, '#8e5c39', 900, 'center');
      for (const [i, side] of [-1, 1].entries()) {
        const hx = Math.max(28, Math.min(logicalW - 28, player.x + side * 92));
        const hy = player.y - 139 - Math.sin(now * .006 + i) * 8;
        text('哈！', hx, hy, 16, i ? '#ce675d' : '#d78342', 900, 'center');
      }
    }
  }
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#eee2c5'; ctx.fillRect(0, 0, cssW, cssH);
    ctx.scale(scale, scale);
    drawBackground(); drawRoom(); drawHud(now);
    const actors = stations.map(st => ({ y: st.y, fn: () => drawStation(st, now) }));
    if (flyingDish) actors.push({ y: flyingDish.y, fn: () => drawFlyingDish(now) });
    actors.push({ y: player.y, fn: () => drawFrog(player, now) });
    actors.sort((a, b) => a.y - b.y).forEach(a => a.fn());
    drawPrompt(); drawToast(now); drawCelebration(now); drawControls(); drawUrgency(now);
    if (paused) drawPauseOverlay();
  }
  function beginRound() {
    carried = []; seconds = ROUND_SECONDS; urgencyWarned = false; flyingDish = null; roundState = 'playing';
    notify(`${recipe().guest}来下单啦，${ROUND_SECONDS} 秒内做好这杯！`, 2200);
  }
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
  function startFlyingDish() {
    const homeX = Math.max(logicalW * .22, Math.min(logicalW * .78, player.x + player.face * 92));
    const homeY = Math.max(logicalH * .30, Math.min(logicalH * .66, player.y - 18));
    flyingDish = { x: homeX, y: homeY, homeX, homeY, t: 0, settled: false };
    tapTarget = null;
    notify(`第${round + 1}位顾客的奶茶飞走啦！追上去按互动！`, 3200);
    playChime(false); vibrate(24);
  }
  function finishOrder() {
    if (roundState !== 'playing') return;
    flyingDish = null; player.vx = 0; player.vy = 0; tapTarget = null;
    eggs++; best = Math.max(best, eggs); try { localStorage.setItem('wawa-kitchen-best', String(best)); } catch (_) {}
    roundState = 'success'; pauseUntil = performance.now() + 3600;
    toast = ''; toastUntil = 0; if (srStatus) srStatus.textContent = '哈哈哈哈！奶蛙大笑彩蛋！奶蛋 +1';
    playChime(true); vibrate(45);
    effects.push({ type: 'egg', x: Math.min(logicalW - 40, player.x + 160), y: player.y - 150, at: performance.now(), life: 2200 });
    for (let i = 0; i < 32; i++) effects.push({ type: 'confetti', x: logicalW * (.24 + Math.random() * .52), y: logicalH * (.12 + Math.random() * .30), at: performance.now() + Math.random() * 180, life: 1700 + Math.random() * 900, rot: Math.random() * 6, color: ['#f0c36f', '#e98592', '#88c98f', '#82c5d0'][i % 4] });
  }
  function interact() {
    if (paused || roundState !== 'playing') return;
    const st = nearestStation();
    if (!st) { notify(flyingDish ? '奶茶正在飞，追近一点再按互动！' : '再靠近亮起的工作台一点'); return; }
    if (st.item === 'flyingDish') { finishOrder(); return; }
    if (st.item === 'deliver') {
      if (!allCollected()) { notify(`材料还差 ${recipe().required.filter(id => !carried.includes(id)).map(id => items[id].name).join('、')}`); return; }
      finishOrder(); return;
    }
    if (carried.includes(st.item)) { notify(`${items[st.item].name}已经拿好啦`); return; }
    if (!recipe().required.includes(st.item)) { notify(`这单不需要${items[st.item].name}`); return; }
    carried.push(st.item); playChime(); vibrate();
    if (allCollected() && round >= 2 && (round + 1) % 3 === 0) startFlyingDish();
    else notify(`拿到${items[st.item].name}！`);
  }
  function missOrder() { flyingDish = null; roundState = 'miss'; pauseUntil = performance.now() + 2200; notify('超时了，下一位客人马上来', 2100); vibrate(32); }
  function resetGame() {
    round = 0; eggs = 0; best = 0; paused = false; flyingDish = null; urgencyWarned = false; effects = []; toast = ''; toastUntil = 0;
    try { localStorage.setItem('wawa-kitchen-best', '0'); } catch (_) {}
    player = { x: logicalW / 2, y: logicalH * .68, vx: 0, vy: 0, face: 1 }; beginRound();
  }
  function update(dt, now) {
    if (!isLandscape || paused) return;
    if (roundState !== 'playing') { if (now >= pauseUntil) { round++; beginRound(); } return; }
    seconds -= dt;
    if (seconds <= 10 && !urgencyWarned) { urgencyWarned = true; notify('最后10秒！快冲！', 1900); playChime(false); vibrate(28); }
    if (seconds <= 0) { seconds = 0; missOrder(); return; }
    if (flyingDish && !flyingDish.settled) {
      flyingDish.t += dt;
      if (flyingDish.t >= 9) {
        flyingDish.settled = true; flyingDish.x = logicalW * .5 + 48; flyingDish.y = logicalH * .72;
        notify('奶茶飞累啦，停在投喂台附近了！', 1900);
      } else {
        flyingDish.x = Math.max(logicalW * .18, Math.min(logicalW * .82, flyingDish.homeX + Math.sin(flyingDish.t * 1.05) * Math.min(116, logicalW * .12)));
        flyingDish.y = Math.max(logicalH * .25, Math.min(logicalH * .70, flyingDish.homeY + Math.sin(flyingDish.t * 1.55) * 44));
      }
    }
    let dx = joy.active ? joy.dx : 0, dy = joy.active ? joy.dy : 0;
    if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
    if (Math.hypot(dx, dy) > 1) { const len = Math.hypot(dx, dy); dx /= len; dy /= len; }
    if (Math.abs(dx) + Math.abs(dy) < .01 && tapTarget && !joy.active) {
      const tx = tapTarget.x - player.x, ty = tapTarget.y - player.y, dist = Math.hypot(tx, ty);
      if (dist < 8) tapTarget = null; else { dx = tx / dist; dy = ty / dist; }
    }
    const speed = 285, desiredX = dx * speed, desiredY = dy * speed, blend = Math.min(1, dt * (dx || dy ? 15 : 9));
    player.vx += (desiredX - player.vx) * blend; player.vy += (desiredY - player.vy) * blend;
    player.x = Math.max(48, Math.min(logicalW - 48, player.x + player.vx * dt));
    player.y = Math.max(70, Math.min(logicalH - 42, player.y + player.vy * dt));
    if (Math.abs(dx) > .1) player.face = dx > 0 ? 1 : -1;
  }
  function screenToWorld(e) { return { x: e.clientX / cssW * logicalW, y: e.clientY / cssH * logicalH }; }
  function togglePause() {
    if (roundState !== 'playing') return;
    paused = !paused; keys.clear(); tapTarget = null;
    joy.id = null; joy.active = false; joy.dx = 0; joy.dy = 0; joy.baseX = control.defaultJoyX; joy.baseY = logicalH - 94;
    player.vx = 0; player.vy = 0;
    if (!paused) lastTime = performance.now();
    notify(paused ? '游戏已暂停' : '继续营业！', 1200);
  }
  function pointerDown(e) {
    if (!isLandscape) return;
    e.preventDefault(); canvas.setPointerCapture(e.pointerId);
    const p = screenToWorld(e);
    const hit = (r, pad = 8) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
    if (hit(pauseButton)) { togglePause(); return; }
    if (hit(resetButton)) { resetGame(); return; }
    if (paused) { if (hit(resumeButton, 4)) togglePause(); return; }
    const c = controlCenters();
    if (Math.hypot(p.x - c.ax, p.y - c.cy) < 78) { interact(); return; }
    const movementZone = p.x < logicalW * .46 && p.y > logicalH * .40;
    if (movementZone && joy.id === null) {
      joy.id = e.pointerId; joy.active = true;
      joy.baseX = Math.max(62, Math.min(logicalW * .42, p.x));
      joy.baseY = Math.max(118, Math.min(logicalH - 54, p.y));
      joy.dx = 0; joy.dy = 0; tapTarget = null; return;
    }
    if (p.x > 8 && p.x < logicalW - 8 && p.y > 126 && p.y < logicalH - 24) tapTarget = p;
  }
  function updateJoystick(p) {
    const dx = p.x - joy.baseX, dy = p.y - joy.baseY, distance = Math.hypot(dx, dy), radius = 61;
    if (distance < 8) { joy.dx = 0; joy.dy = 0; return; }
    const strength = Math.min(1, (distance - 8) / (radius - 8));
    joy.dx = dx / distance * strength; joy.dy = dy / distance * strength;
  }
  function endPointer(e) {
    if (joy.id === e.pointerId) { joy.id = null; joy.active = false; joy.dx = 0; joy.dy = 0; joy.baseX = control.defaultJoyX; joy.baseY = logicalH - 94; }
  }
  canvas.addEventListener('pointerdown', pointerDown, { passive: false });
  canvas.addEventListener('pointermove', e => { if (joy.id === e.pointerId) updateJoystick(screenToWorld(e)); });
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer); canvas.addEventListener('lostpointercapture', endPointer);
  window.addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'p' && !e.repeat) { togglePause(); return; }
    if (paused) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (k === ' ' || k === 'e' || k === 'Enter') { if (!e.repeat) interact(); }
    keys.add(k);
  });
  window.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => { keys.clear(); joy.id = null; joy.active = false; joy.dx = 0; joy.dy = 0; });
  function frame(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min(.04, (now - lastTime) / 1000); lastTime = now;
    update(dt, now); draw(now); requestAnimationFrame(frame);
  }
  beginRound(); requestAnimationFrame(frame);
})();
