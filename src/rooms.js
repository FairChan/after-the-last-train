/* 末班之后 · 剧情灵魂：剧情屋的画（五间：修理铺 shop、后巷 alley、候车室 lounge、车厢 carriage、站台 platform）。
   一间屋 = 一张背景（640×360 屏幕像素，D.Paint 逐像素着色、点阵过渡）+ 几件摆设（D.mkSprite，自动描黑边）+ 光（D.Post）+ 人站的位置。
   死亡细胞画风：体积用 ell / box 着色、色阶、光从左上来；发光的标 emit 进泛光层。只有细线、屏上的字、光效直接画。
   画法由 scene.js 调：ROOM.draw(ctx, ex, t, st) 画背景和摆设（世界坐标，1 单位 = 2 像素），ROOM.lights(t, st) 加光。
   设计：design/features/story-soul/design.md 第四节 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const RM = D.SROOMS = D.SROOMS || {}; // 不叫 D.ROOMS：那是站里的房间表
  const INK = '#0b0a14', W = 640, H = 360;
  const ramp = (hex, n) => { const out = []; n = n || 6; for (let i = 0; i < n; i++) { const k = i / (n - 1); out.push(k < 0.5 ? D.mixHex(hex, INK, (0.5 - k) * 1.5) : D.mixHex(hex, '#fff1dc', (k - 0.5) * 0.9)); } return out; };
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  const pickR = (r, v, x, y) => r[Math.max(0, Math.min(r.length - 1, Math.floor(v * r.length + bay(x, y) - 0.5)))];
  // 一整张背景：fn(P, pick) 里逐块画；返回 {img, emit}
  function bg(fn) { const P = D.Paint(W, H); fn(P); return P.make(2); }
  // 墙：竖直方向上暗下亮一点，有板缝和污渍
  function wall(P, y0, y1, r, seam) {
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
      let v = 0.35 + 0.18 * (y - y0) / (y1 - y0) + (D.Pix.hash(x >> 3, y >> 4) - 0.5) * 0.08;
      if (seam && (x % seam === 0)) v -= 0.18; if (seam && x % seam === 1) v += 0.06;
      P.set(x, y, pickR(r, v, x, y));
    }
  }
  function floor(P, y0, r, tile) {
    for (let y = y0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = 0.42 - 0.22 * (y - y0) / (H - y0);
      if (tile && (x % tile === 0 || (y - y0) % 12 === 0)) v -= 0.14;
      if (y === y0) v = 0.7; else if (y === y0 + 1) v = 0.18;
      P.set(x, y, pickR(r, v, x, y));
    }
  }
  const S = {}; // 摆设缓存
  const spr = (k, w, h, fn) => S[k] || (S[k] = D.mkSprite(w, h, fn));

  // ── 修理铺（林桥）
  RM.shop = {
    name: '修理铺', ambient: '#2a2534', amb: 'gen',
    view: { y: 72 }, actors: { lin: { x: 222, y: 152, face: -1, look: { skin: '#e0b08a', hair: '#1f1a22', top: '#5a4636', bot: '#2e2a33', acc: 'none', outfit: 'apron', hairS: 'bun' } }, op: { x: 146, y: 152, face: 1 } },
    build() {
      const C = {};
      const CON = ramp('#3a3442', 7), FL = ramp('#2a2620', 6);
      C.bg = bg(P => {
        wall(P, 0, 300, CON, 64);
        floor(P, 300, FL, 32);
        // 窗：右上，外面是站台，那块屏的红光
        P.box(424, 150, 120, 80, D.RAMP.gunmetal, { top: 2 });
        for (let y = 156; y < 224; y++) for (let x = 430; x < 538; x++) P.set(x, y, pickR(['#0a0608', '#140a0e', '#200e14', '#2e1018'], 0.2 + 0.7 * (1 - Math.abs(x - 484) / 64) * (1 - (y - 156) / 100), x, y), (x - 484) ** 2 / 3000 + (y - 182) ** 2 / 700 < 1);
        P.rect(430, 196, 108, 2, '#1d212c'); P.rect(483, 156, 2, 68, '#1d212c');
        // 工具墙：左边一块洞洞板
        P.box(196, 150, 116, 100, D.RAMP.dark, { top: 1, v: 0.55 });
        for (let y = 158; y < 246; y += 8) for (let x = 204; x < 308; x += 8) P.set(x, y, '#0c0e17');
        // 墙脚的管子
        P.box(0, 262, W, 8, D.RAMP.gunmetal, { top: 1 }); P.box(0, 276, W, 5, D.RAMP.rust, { top: 1, v: 0.45 });
      });
      C.tools = spr('shop_tools', 104, 70, p => {
        p.box(4, 6, 6, 40, D.RAMP.gunmetal); p.box(2, 2, 10, 8, D.RAMP.steel, { r: 2 }); // 扳手
        p.box(20, 4, 4, 48, D.RAMP.crate); p.box(16, 2, 12, 10, D.RAMP.silver, { r: 1 }); // 锤子
        p.ell(46, 22, 12, 12, D.RAMP.copper, {}); p.ell(46, 22, 5, 5, D.RAMP.dark, {}); // 一卷铜线
        p.box(66, 6, 4, 36, D.RAMP.yellow); p.box(64, 40, 8, 14, D.RAMP.red, { r: 2 }); // 螺丝刀
        p.box(80, 10, 18, 26, D.RAMP.steel, { r: 2 }); p.box(83, 14, 12, 6, D.RAMP.glass, { emit: false }); // 万用表
        p.px(89, 27, '#ff3b4a', 1); p.px(90, 27, '#ff3b4a', 1);
      });
      C.bench = spr('shop_bench', 150, 48, p => {
        p.box(0, 12, 150, 10, D.RAMP.crate, { top: 2 }); // 台面
        p.box(6, 22, 8, 26, D.RAMP.gunmetal); p.box(136, 22, 8, 26, D.RAMP.gunmetal); // 腿
        p.box(20, 23, 52, 16, D.RAMP.dark, { top: 1 }); p.box(23, 26, 21, 6, D.RAMP.gunmetal); p.box(47, 26, 21, 6, D.RAMP.gunmetal); // 抽屉
        p.box(84, 3, 34, 10, D.RAMP.steel, { r: 2 }); p.box(88, 0, 12, 5, D.RAMP.plate); // 台钳
        p.box(120, 5, 26, 8, D.RAMP.crate, { v: 0.4 }); p.rect(122, 7, 22, 1, '#e8e0c8'); // 摊着的纸
      });
      C.lamp = spr('shop_lamp', 50, 60, p => {
        p.box(30, 50, 16, 8, D.RAMP.gunmetal, { r: 2 }); p.line(38, 50, 24, 26, '#434b5f'); p.line(39, 50, 25, 26, '#2d3342'); p.line(24, 26, 12, 16, '#434b5f');
        p.ell(12, 14, 11, 7, D.RAMP.olive, {}); p.ell(12, 19, 7, 3, D.RAMP.yellow, { emit: true, flat: true });
      });
      C.gen = spr('shop_gen', 70, 64, p => {
        p.box(0, 10, 70, 54, D.RAMP.gunmetal, { top: 2, r: 2 }); p.box(6, 18, 40, 26, D.RAMP.dark, { top: 1 });
        for (let i = 0; i < 6; i++) p.rect(9, 21 + i * 4, 34, 1, '#434b5f');
        p.box(50, 18, 14, 10, D.RAMP.yellow, { r: 1 }); p.box(50, 48, 14, 6, D.RAMP.rust);
        p.box(10, 0, 8, 12, D.RAMP.rust); p.box(30, 2, 6, 10, D.RAMP.rust, { v: 0.4 }); // 排气管
      });
      C.genLed = spr('shop_led', 6, 6, p => { p.disc(3, 3, 2, '#7dff9a', 1); });
      C.shell = spr('shop_shell', 60, 96, p => { // 吊着的半成品工壳：没装手臂，线从胸口垂下来
        p.line(30, 0, 30, 14, '#2d3342'); p.box(22, 12, 16, 6, D.RAMP.gunmetal);
        p.ell(30, 30, 13, 12, D.RAMP.steel, { spec: true }); p.box(22, 28, 16, 5, D.RAMP.glass); p.rect(24, 30, 4, 2, '#3ee8ff', 1);
        p.box(16, 42, 28, 30, D.RAMP.plate, { r: 3 }); p.box(22, 48, 16, 12, D.RAMP.dark);
        p.line(24, 72, 20, 92, '#c82e3a'); p.line(30, 72, 31, 94, '#e3c14a'); p.line(36, 72, 40, 90, '#5a92e8');
      });
      return C;
    },
    draw(ctx, ex, t, st) {
      const C = st.cache;
      // 背景在屏幕像素里，scene.js 已经设好世界变换：320×180
      D.blitBG(ctx, ex, C.bg);
      // 窗外那块屏：红字，偶尔闪一下（发光层）
      const flick = Math.sin(t * 23) > 0.96 ? 0.3 : 1;
      ex.save(); ex.globalAlpha = 0.85 * flick; ex.fillStyle = '#ff3b4a'; ex.font = '5px PixelZH10, sans-serif'; ex.textAlign = 'center'; ex.textBaseline = 'top';
      { const parts = (st.screen || 'E-17 · 南栈 · 23:40 · 延误').split(' · '), h = Math.ceil(parts.length / 2); ex.fillText(parts.slice(0, h).join(' · '), 242, 82); ex.fillText(parts.slice(h).join(' · '), 242, 89); } ex.restore();
      D.blit(ctx, C.tools, 127, 118); D.blit(ctx, C.shell, 176, 120 + Math.sin(t * 0.7) * 0.6);
      D.blit(ctx, C.gen, 278, 152); D.blit(ex, C.gen, 278, 152, false, 'emit');
      if (Math.sin(t * 3) > -0.3) D.blit(ex, C.genLed, 288, 134);
      D.blit(ctx, C.bench, 236, 146); if (C.bench.emit) D.blit(ex, C.bench, 236, 146, false, 'emit');
      D.blit(ctx, C.lamp, 214, 134); D.blit(ex, C.lamp, 214, 134, false, 'emit');
      st.actors(); // 人站在工作台前面
    },
    lights(t, st) {
      // 发电机不稳：台灯偶尔暗一下
      const g = st.flick != null ? st.flick : (D.Pix.hash(Math.floor(t * 6), 7) > 0.94 ? 0.35 : 1);
      const L = st.light; L(414, 256, 130, '#ffb057', 0.8 * g); L(414, 260, 40, '#fff0c8', 0.35 * g);
      L(484, 186, 150, '#ff3b4a', 0.5); L(300, 300, 200, '#4a3a5a', 0.25);
    },
  };

  // 一个简单的随机数（站民的外观用）：按种子固定
  const rngOf = seed => { let n = 0; return { pick: a => a[Math.floor(D.Pix.hash(seed, n++) * a.length)], next: () => D.Pix.hash(seed, n++) }; };

  // ── 后巷（阿隼）：交易行背后的检修通道，管子、货箱、烧着的油桶
  RM.alley = {
    name: '交易行后巷', ambient: '#1c1a24', amb: 'fire', view: { y: 72 },
    actors: { ahsun: { x: 214, y: 152, face: -1, look: { skin: '#d9a57a', hair: '#2a2a33', top: '#2e4a52', bot: '#24242c', acc: 'none', outfit: 'vest', hat: 'cap' } }, op: { x: 142, y: 152, face: 1 } },
    build() {
      const C = {}, BR = ramp('#3a2e2c', 7), FL = ramp('#24221e', 6);
      C.bg = bg(P => {
        // 砖墙：错缝，砖缝暗
        for (let y = 0; y < 300; y++) for (let x = 0; x < W; x++) {
          const row = y / 10 | 0, off = row & 1 ? 12 : 0, mortar = y % 10 === 0 || (x + off) % 24 === 0;
          const v = 0.42 + (D.Pix.hash((x + off) / 24 | 0, row) - 0.5) * 0.16 - (mortar ? 0.2 : 0) + 0.1 * (y / 300);
          P.set(x, y, pickR(BR, v, x, y));
        }
        floor(P, 300, FL, 0);
        // 横着的管子两根，一根锈
        P.box(0, 150, W, 12, D.RAMP.gunmetal, { top: 2 }); P.box(0, 172, W, 8, D.RAMP.rust, { top: 1, v: 0.5 });
        for (let x = 40; x < W; x += 120) { P.box(x, 146, 8, 20, D.RAMP.steel, { r: 1 }); P.box(x + 50, 168, 6, 16, D.RAMP.rust); }
        // 墙上的粉笔：一列车，车窗里画着叉
        P.line(250, 230, 330, 230, '#8a8478'); P.line(250, 244, 330, 244, '#8a8478'); P.line(250, 230, 250, 244, '#8a8478'); P.line(330, 230, 336, 237, '#8a8478'); P.line(336, 237, 330, 244, '#8a8478');
        for (let i = 0; i < 4; i++) { const x = 258 + i * 18; P.line(x, 233, x + 6, 239, '#6a665e'); P.line(x + 6, 233, x, 239, '#6a665e'); }
      });
      C.crates = spr('al_crates', 90, 80, p => { p.box(0, 34, 50, 46, D.RAMP.crate, { top: 2 }); p.box(4, 40, 42, 4, D.RAMP.cloth); p.box(46, 44, 44, 36, D.RAMP.crate, { top: 2, bias: -0.08 }); p.box(10, 0, 40, 36, D.RAMP.crate, { top: 2, bias: 0.05 }); p.rect(16, 14, 28, 2, '#2f1d13'); });
      C.barrel = spr('al_barrel', 40, 52, p => { p.box(2, 8, 36, 44, D.RAMP.rust, { r: 3, top: 2 }); p.box(2, 18, 36, 3, D.RAMP.gunmetal); p.box(2, 38, 36, 3, D.RAMP.gunmetal); p.ell(20, 9, 16, 4, D.RAMP.dark, { flat: true }); p.ell(20, 8, 12, 3, D.RAMP.copper, { emit: true, flat: true }); });
      C.bulb = spr('al_bulb', 16, 30, p => { p.line(8, 0, 8, 14, '#2d3342'); p.box(3, 14, 10, 6, D.RAMP.gunmetal); p.ell(8, 23, 5, 5, D.RAMP.glass, { emit: true }); p.line(3, 20, 3, 28, '#434b5f'); p.line(13, 20, 13, 28, '#434b5f'); });
      return C;
    },
    draw(ctx, ex, t, st) {
      const C = st.cache; D.blitBG(ctx, ex, C.bg);
      D.blit(ctx, C.bulb, 120, 100); D.blit(ex, C.bulb, 120, 100, false, 'emit');
      D.blit(ctx, C.crates, 262, 152);
      D.blit(ctx, C.barrel, 186, 152); D.blit(ex, C.barrel, 186, 152, false, 'emit');
      // 火：粒子往上飘，画在发光层
      for (let i = 0; i < 14; i++) { const k = (t * 0.9 + i / 14) % 1, x = 186 + Math.sin(i * 2.3 + t * 3) * 4 * (1 - k), y = 126 - k * 16; ex.fillStyle = k < 0.3 ? '#fff0b0' : k < 0.6 ? '#ffb057' : '#c8402a'; ex.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, k < 0.5 ? 1 : 0.5, k < 0.5 ? 1 : 0.5); }
      st.actors();
    },
    lights(t, st) { const L = st.light, f = 0.8 + Math.sin(t * 13) * 0.08 + Math.sin(t * 31) * 0.06; L(372, 250, 150 * f, '#ff8a3a', 0.85 * f); L(240, 196, 90, '#8ab0c8', 0.35); },
  };

  // ── 候车室（陆峥）：南栈废弃的贵宾候车室，长沙发、熄灭的吊灯、积灰的大理石、刮掉一半的旧标志
  RM.lounge = {
    name: '旧贵宾候车室', ambient: '#16151e', amb: 'drip', view: { y: 70 },
    actors: { heng: { x: 226, y: 136, kind: 'ghost' }, lu: { x: 222, y: 152, face: -1, pose: 'sit', look: { skin: '#e8c4a0', hair: '#1a1a1f', top: '#2a2e3a', bot: '#24262e', acc: 'none', outfit: 'suit' } }, op: { x: 148, y: 152, face: 1 } },
    build() {
      const C = {}, WL = ramp('#3a3446', 7), MB = ['#1c1a20', '#2a2830', '#3c3a44', '#55535e', '#76747e', '#9c9aa2'];
      C.bg = bg(P => {
        wall(P, 0, 300, WL, 80);
        P.box(0, 236, W, 64, D.RAMP.cloth, { top: 2, v: 0.4 }); // 护墙板
        for (let x = 0; x < W; x += 64) P.rect(x, 238, 1, 62, '#1b100b');
        // 大理石地：灰色带纹路，蒙灰
        for (let y = 300; y < H; y++) for (let x = 0; x < W; x++) { const vein = Math.abs(Math.sin(x * 0.05 + y * 0.21 + Math.sin(x * 0.013) * 3)) < 0.06; let v = 0.46 - 0.2 * (y - 300) / 60 - (vein ? 0.16 : 0) + ((x + y) % 48 === 0 ? -0.12 : 0); if (y === 300) v = 0.75; P.set(x, y, pickR(MB, v, x, y)); }
        // 墙上的旧标志：一个圆环，刮掉了一半（刮痕是竖的）
        for (let a = 0; a < 360; a += 1) { const r = a * Math.PI / 180, ok = a < 180 || D.Pix.hash(a, 3) > 0.7; if (!ok) continue; for (let d = 28; d < 34; d++) P.set(320 + Math.cos(r) * d, 176 + Math.sin(r) * d, pickR(D.RAMP.silver, 0.35 + (d - 28) * 0.05, a, d)); }
        for (let i = 0; i < 30; i++) { const x = 290 + D.Pix.hash(i, 9) * 60 | 0; P.line(x, 176, x + 2, 212, '#2a2632'); }
      });
      C.sofa = spr('lg_sofa', 130, 50, p => { p.box(0, 10, 130, 26, D.RAMP.red, { r: 4, top: 2, bias: -0.18 }); p.box(0, 30, 130, 16, D.RAMP.red, { r: 3, bias: -0.25 }); p.box(0, 14, 12, 30, D.RAMP.red, { r: 4, bias: -0.1 }); p.box(118, 14, 12, 30, D.RAMP.red, { r: 4, bias: -0.1 }); p.box(8, 44, 6, 6, D.RAMP.gold); p.box(116, 44, 6, 6, D.RAMP.gold); for (let x = 20; x < 116; x += 16) p.px(x, 20, '#2a0a0e'); });
      C.chand = spr('lg_chand', 70, 60, p => { p.line(35, 0, 35, 20, '#3a3f4c'); p.ell(35, 26, 22, 8, D.RAMP.gold, { bias: -0.15 }); for (let i = 0; i < 7; i++) { const x = 15 + i * 7; p.line(x, 30, x, 42 + (i % 2) * 6, '#666d80'); p.ell(x, 46 + (i % 2) * 6, 2, 3, D.RAMP.glass, { bias: -0.1 }); } });
      C.lamp = spr('lg_lamp', 18, 26, p => { p.box(4, 0, 10, 4, D.RAMP.gunmetal, { r: 1 }); p.box(3, 4, 12, 16, D.RAMP.glass, { emit: true, bias: 0.25 }); p.box(2, 20, 14, 5, D.RAMP.gunmetal, { r: 1 }); });
      return C;
    },
    draw(ctx, ex, t, st) {
      const C = st.cache; D.blitBG(ctx, ex, C.bg);
      D.blit(ctx, C.chand, 186, 106 + Math.sin(t * 0.4) * 0.4);
      D.blit(ctx, C.sofa, 228, 156);
      D.blit(ctx, C.lamp, 260, 136); D.blit(ex, C.lamp, 260, 136, false, 'emit');
      const k = (t * 0.35) % 1; if (k < 0.6) { ex.fillStyle = '#6a7aa0'; ex.fillRect(204, 112 + k * 70, 0.5, 1); } // 吊灯上滴下来的水
      st.actors();
    },
    lights(t, st) { const L = st.light; L(520, 250, 150, '#dfe8ff', 0.7); L(520, 250, 30, '#ffffff', 0.3); L(370, 200, 160, '#3a3a5a', 0.2); L(296, 268, 110, '#4a4a6a', 0.35); },
  };

  // ── 车厢（E-17 第九节）：一排座位上盖着毯子的轮廓、行李架、半亮半坏的顶灯、窗外是隧道墙
  RM.carriage = {
    name: 'E-17 · 第九节', ambient: '#141820', amb: 'wind', view: { y: 70 },
    actors: { op: { x: 132, y: 152, face: 1 }, bot: { x: 262, y: 152, face: -1, kind: 'bot' }, yuan: { x: 240, y: 140, kind: 'ghost' } },
    build() {
      const C = {}, IN = ramp('#3a4448', 7), FL = ramp('#262a2a', 6);
      C.bg = bg(P => {
        wall(P, 0, 300, IN, 0);
        // 车窗：一排，外面是隧道墙（几乎全黑，偶尔一道管线）
        for (let x = 24; x < W; x += 120) { P.box(x, 150, 96, 60, D.RAMP.gunmetal, { r: 3, top: 2 }); for (let y = 156; y < 204; y++) for (let i = x + 6; i < x + 90; i++) P.set(i, y, pickR(['#05070a', '#0a0e12', '#121a20'], 0.25 + 0.4 * ((i + y) % 37 < 2 ? 1 : 0), i, y)); }
        P.box(0, 120, W, 6, D.RAMP.gunmetal, { top: 1 }); for (let x = 10; x < W; x += 40) P.line(x, 126, x + 6, 140, '#2d3342'); // 行李架
        for (let x = 140; x < W; x += 160) P.box(x, 120, 4, 180, D.RAMP.silver, { bias: -0.2 }); // 扶手杆
        floor(P, 300, FL, 0);
      });
      // 座位；人：毯子盖住的轮廓（头和肩膀的形状），不画脸
      C.seat = spr('cr_seat', 36, 50, p => { p.box(2, 0, 30, 34, D.RAMP.blue, { r: 3, top: 2, bias: -0.22 }); p.box(0, 30, 34, 10, D.RAMP.blue, { r: 2, bias: -0.15 }); p.box(4, 40, 4, 10, D.RAMP.gunmetal); p.box(26, 40, 4, 10, D.RAMP.gunmetal); });
      const who = k => spr('cr_who' + k, 34, 50, p => { const B = k % 3 === 0 ? D.RAMP.cloth : k % 3 === 1 ? D.RAMP.olive : D.RAMP.gunmetal; p.ell(17, 12 + (k % 2), 7, 8, B, { bias: -0.05 }); p.box(5, 18, 24, 28, B, { r: 5, top: 2, bias: -0.08 }); p.line(9, 24, 12, 44, B[1]); p.line(24, 22, 22, 44, B[1]); if (k === 9) p.box(9, 36, 14, 8, D.RAMP.crate, { r: 1, bias: 0.1 }); });
      C.who = []; for (let k = 0; k < 10; k++) C.who.push(who(k));
      C.bot = spr('cr_bot', 30, 30, p => { p.ell(15, 18, 12, 10, D.RAMP.white, { spec: true, bias: -0.1 }); p.box(6, 24, 18, 6, D.RAMP.gunmetal, { r: 2 }); p.ell(15, 16, 4, 3, D.RAMP.green, { emit: true }); p.line(22, 12, 28, 4, '#848ca8'); p.box(26, 2, 4, 4, D.RAMP.cloth); });
      return C;
    },
    draw(ctx, ex, t, st) {
      const C = st.cache; D.blitBG(ctx, ex, C.bg);
      // 顶灯：一半亮、一半坏，坏的那根偶尔闪（灯管是光效，直接画进发光层）
      for (let i = 0; i < 4; i++) { const x = 30 + i * 80, broken = i % 2 === 1, on = !broken || D.Pix.hash(Math.floor(t * 8), i) > 0.9; ctx.fillStyle = '#1d212c'; ctx.fillRect(x, 64, 36, 3); if (on) { ex.fillStyle = broken ? '#8a9070' : '#e8f0d0'; ex.fillRect(x + 2, 65, 32, 1.5); } }
      for (let i = 0; i < 8; i++) { const x = 156 + i * 18; D.blit(ctx, C.seat, x, 150); D.blit(ctx, C.who[i === 4 ? 9 : i], x, 142); }
      st.actors();
    },
    lights(t, st) {
      const L = st.light;
      for (let i = 0; i < 4; i++) { const broken = i % 2 === 1, on = !broken || D.Pix.hash(Math.floor(t * 8), i) > 0.9; if (on) L(96 + i * 160, 140, 170, broken ? '#8a9070' : '#c8d4c0', broken ? 0.4 : 0.6); }
      if (st.botX != null) L(st.botX * 2, 288, 60, '#7dff9a', 0.45);
    },
  };

  // ── 站台（南栈）：正中那块屏，站台边、铁轨，站民。公开结局时站民手里的灯一盏盏亮起来
  RM.platform = {
    name: '南栈站台 · 23:40', ambient: '#141018', amb: 'wind', view: { y: 62 },
    actors: { lin: { x: 182, y: 150, face: 1, look: null }, crowd: { x: 238, y: 140, kind: 'ghost' }, op: { x: 140, y: 150, face: 1 } },
    build() {
      const C = {}, WL = ramp('#2e2a36', 7), PL = ramp('#3a3630', 6);
      C.bg = bg(P => {
        wall(P, 0, 270, WL, 96);
        for (let y = 270; y < 316; y++) for (let x = 0; x < W; x++) P.set(x, y, pickR(PL, 0.5 - 0.25 * (y - 270) / 46, x, y)); // 站台面
        for (let x = 0; x < W; x += 2) P.set(x, 310, (x / 8 | 0) % 2 ? '#c8a020' : '#6a5410'); // 黄线
        for (let y = 316; y < H; y++) for (let x = 0; x < W; x++) P.set(x, y, pickR(['#08080c', '#101016', '#1a1a22'], 0.3 + (y === 330 || y === 346 ? 0.6 : 0), x, y)); // 轨道
        for (let x = 60; x < W; x += 200) P.box(x, 0, 26, 270, D.RAMP.dark, { top: 0, v: 0.6 }); // 柱子
      });
      C.screen = spr('pf_screen', 150, 56, p => { p.box(0, 0, 150, 48, D.RAMP.gunmetal, { r: 2, top: 2 }); p.box(6, 6, 138, 36, D.RAMP.dark, { v: 0.2 }); p.line(40, 48, 40, 56, '#2d3342'); p.line(110, 48, 110, 56, '#2d3342'); });
      C.badge = spr('pf_badge', 14, 20, p => { p.line(7, 0, 7, 4, '#949fb6'); p.box(1, 4, 12, 15, D.RAMP.white, { r: 1, bias: -0.1 }); p.box(3, 6, 8, 6, D.RAMP.crate); p.rect(3, 14, 8, 1, '#555d7a'); p.rect(3, 16, 6, 1, '#555d7a'); });
      const rng = rngOf(23);
      C.crowd = []; for (let i = 0; i < 9; i++) C.crowd.push({ L: D.humanLook(rng), x: 214 + i * 11 + rng.next() * 6, y: 150 - (i % 2) * 3, kid: i === 4 });
      return C;
    },
    draw(ctx, ex, t, st) {
      const C = st.cache; D.blitBG(ctx, ex, C.bg);
      D.blit(ctx, C.screen, 200, 100);
      const flick = Math.sin(t * 17) > 0.95 ? 0.35 : 1, txt = st.screen || 'E-17 · 南栈 · 23:40 · 延误', found = /已找到/.test(txt);
      ex.save(); ex.globalAlpha = flick; ex.fillStyle = found ? '#ffd27a' : '#ff3b4a'; ex.font = '5px PixelZH10, sans-serif'; ex.textAlign = 'center'; ex.textBaseline = 'top';
      const parts = txt.split(' · '), h = Math.ceil(parts.length / 2); ex.fillText(parts.slice(0, h).join(' · '), 200, 76); ex.fillText(parts.slice(h).join(' · '), 200, 84);
      if (!found) { ex.globalAlpha = 0.6 * flick; ex.font = '4px PixelZH10, sans-serif'; ex.fillText('+' + (8401 + (st.day || 0)), 200, 92); }
      ex.restore();
      if (st.badge) D.blit(ctx, C.badge, 200, 116);
      // 站民：剪影一样暗，灯亮了才看得清
      for (const p of C.crowd) { const po = p.kid ? 'kid' : 'stand', A = D.humanAnim(p, t, { pose: po, moving: false }), spr = D.humanSprite(p.L, po, 0, A.an); ctx.globalAlpha = st.lamps ? 1 : 0.55; D.blit(ctx, spr, p.x, p.y, true); ctx.globalAlpha = 1; if (st.lamps) { ex.fillStyle = '#ffd27a'; ex.fillRect(p.x - 3, p.y - 12, 1, 1); } }
      st.actors();
    },
    lights(t, st) {
      const L = st.light, found = /已找到/.test(st.screen || '');
      L(400, 160, 220, found ? '#ffd27a' : '#ff3b4a', 0.55);
      if (st.lamps) for (const p of st.cache.crowd) L(p.x * 2 - 6, p.y * 2 - 24, 46, '#ffb057', 0.5);
    },
  };

  // 背景：640×360 的图贴在世界 0,0（320×180）
  D.blitBG = (ctx, ex, b) => { ctx.drawImage(b.img, 0, 0, 320, 180); if (b.emit) ex.drawImage(b.emit, 0, 0, 320, 180); };
})(D);
