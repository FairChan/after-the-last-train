/* 末班之后 · 小样二：列车开走的过场（重做）。上车以后、去下一站或回据点之前放。
   全部画在 320×180 的世界像素上（和游戏一样一格两像素），再整数倍放大，像素不糊。
   镜头：
     1. 进隧道（0–0.42 秒）：一根近景立柱从右往左扫过镜头，把站台画面换成隧道里的侧面跟拍。
     2. 侧面跟拍：六层视差——远墙混凝土板和公里牌、电缆桥架和隧道灯、列车、铁轨枕木和第三轨、近处栏杆、最近处一闪而过的立柱。
        列车和站台上那列同款（银白车身、本线路色带、车顶空调），在隧道里整体压暗，只有车窗、车灯亮着；
        车窗里有座椅、吊环（跟着晃）、乘客剪影，你的机器人站在车头的门窗里；车轮会转；压过钢轨接缝时车身一颠、第三轨冒火花；
        隧道灯掠过时车身上扫过一道暖光；车头灯照亮前方的隧道和钢轨。列车从出站的慢速平滑加速，枕木越快拖影越长。
     3a. 去下一站（1.6 秒）：前方站台的冷光从右边一层层涌进隧道，列车变成逆光剪影（车窗还亮着、车顶一道亮边），再淡成白光。
     3b. 回据点（3.2 秒）：中途立柱再扫一次，切到司机室视角——四面墙一节节迎面冲过来，左墙的灯一盏盏掠过，
         铁轨往远处汇聚；最后隧道口的暖光越来越大，把墙也照亮，铺满整个画面。
   画风和站里统一（pixfx.js + gfx.js 的 Post）：底色压暗，光（隧道灯、车窗、车头灯、前方站台的光）走抖动光照，
   车窗、灯管、指示灯进发光层泛光，四角暗角；隧道墙是混凝土纹理，车身有点阵明暗和污渍，司机室视角的隧道逐行填整像素。
   draw.js 的 drawStation 最后调 D.drawRide；时间轴还是 D.OUTRO_RIDE（station.js 用它算什么时候结束）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const VW = 320, VH = 180, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  let off = null, o = null, eoff = null, eo = null, rc = null, rcx = null, rc2 = null, rc2x = null, wallTex = null, shadeTex = null, exitMask = null;
  const AMB = '#6a7096'; // 隧道里的底光：压暗，亮的地方靠灯
  const R = (x, y, w, h, c) => { o.fillStyle = c; o.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const RA = (x, y, w, h, c, a) => { if (a <= 0) return; o.globalAlpha = Math.min(1, a); R(x, y, w, h, c); o.globalAlpha = 1; };
  const EM = (x, y, w, h, c) => { R(x, y, w, h, c); eo.fillStyle = D.mixHex(c, '#000000', 0.5); eo.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }; // 发光：底色 + 发光层
  const KO = (x, y, w, h, c) => { R(x, y, w, h, c); eo.fillStyle = '#000000'; eo.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }; // 挡住发光（车窗里的人、座椅）
  const mod = (a, b) => ((a % b) + b) % b;
  const hash = n => { n = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
  const smooth = (a, b, x) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const mix = (a, b, k) => D.mixHex ? D.mixHex(a, b, Math.max(0, Math.min(1, k))) : a;
  // 3×5 的小数字（车号、公里牌）
  const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
  function digits(str, x, y, c) { for (const ch of String(str)) { const g = DIG[ch.charCodeAt(0) - 48]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') R(x + i % 3, y + (i / 3 | 0), 1, 1, c); x += 4; } }
  // 光晕：交给 Post 的光照（抖动成几级、边缘棋盘格，和站里一样）；屏幕坐标是这里的两倍
  function glow(x, y, rx, ry, col, a, steps) { D.Pix.light(x * 2, y * 2, Math.max(rx, ry) * 2.2, col, Math.min(1, a * (steps || 3) * 2.2)); }
  // 隧道墙：混凝土（几档灰点阵、模板缝、水渍往下淌）
  function wall() {
    if (wallTex) return wallTex; const [c, g] = D.canvas(288, 107), X = D.Pix;
    X.paint(g, 0, 0, 288, 107, (x, y) => {
      const n = X.hash(x >> 1, y >> 1) * 0.22 + X.hash(x >> 3, y >> 3) * 0.18, drip = X.hash(x >> 2, 3) < 0.14 && y > 26 + X.hash(x >> 2, 4) * 30;
      if (y === 47 || y === 48) return y === 47 ? '#0e1018' : '#262a36'; // 模板缝
      if (X.hash(x, y) < 0.006) return '#0a0b10';
      return X.ramp(['#10131c', '#161a24', '#1d212d', '#252a38', '#2e3444'], 0.5 + n - y / 107 * 0.25 - (drip ? 0.25 : 0), x, y);
    });
    return (wallTex = c);
  }
  // 车身的明暗和污渍：叠在纯色车身上（透明的地方不画）
  function shade() {
    if (shadeTex) return shadeTex; const [c, g] = D.canvas(L, 56), X = D.Pix;
    X.paint(g, 0, 0, L, 56, (x, y) => {
      if (y >= 2 && y < 5) return X.on(0.35, x, y) ? '#eef3f6' : null; // 车顶受光
      if (y >= 22 && y < 34) { const under = [10, 42, 128, 160].some(w => x >= w + 2 && x < w + 22) && X.hash(x, 1) < 0.45; return X.on((y - 22) / 12 * 0.3 + (under ? 0.25 : 0), x, y) ? (under ? '#8f9aa4' : '#a6b0b8') : null; } // 往下越脏，车窗下淌的水渍
      if (y >= 38 && y < 44) return X.on(0.18 + (y - 38) / 6 * 0.2, x, y) ? '#a2acb4' : null;
      if (y >= 44) return X.on(0.2 + (y - 44) / 12 * 0.3, x, y) ? '#5a6470' : null; // 裙板
      if (x % 38 === 2 && y % 6 === 0 && y > 5 && y < 34) return '#aab4bc'; // 铆钉
      return null;
    });
    return (shadeTex = c);
  }
  // 前方站台的光：从右往左越来越密的点阵（发光层）
  function mask() { if (exitMask) return exitMask; const [c, g] = D.canvas(VW, 107), X = D.Pix; X.paint(g, 0, 0, VW, 107, (x, y) => X.on(Math.min(1, x / VW * 1.4) * 0.7, x, y) ? '#3a4a5c' : null); return (exitMask = c); }
  const add = fn => { o.globalCompositeOperation = 'lighter'; fn(); o.globalCompositeOperation = 'source-over'; };

  // ── 速度：从出站的慢速平滑加速到全速（px/秒）；dist 是走过的距离（解析积分，和帧率无关）
  const V0 = 150, V1 = 640, ACC = 1.1;
  const dist = t => t < ACC ? V0 * t + (V1 - V0) * (t * t * t / (ACC * ACC) - t * t * t * t / (2 * ACC * ACC * ACC)) : V0 * t + (V1 - V0) * (ACC / 2 + (t - ACC));
  const speed = t => V0 + (V1 - V0) * smooth(0, ACC, t);
  const J = 92; // 钢轨接缝的间距
  const bump = (d, x) => mod(d + x, J) < 7 ? 1 : 0;

  // ── 镜头 2：侧面跟拍。exitK：去下一站时前方的光涌进来（0–1）
  const L = 190, CAR_Y = 60; // 车厢长、车顶那一行
  function side(t, d, v, info, exitK) {
    // 远墙（视差 0.35）：混凝土板、接缝、水渍、公里牌
    R(0, 0, VW, VH, '#07080d');
    R(0, 0, VW, 13, '#0a0c12'); R(0, 13, VW, 2, '#0e1018');
    const dw = d * 0.35, tex = wall();
    for (let x = -mod(dw, 288); x < VW; x += 288) o.drawImage(tex, Math.round(x), 15);
    for (let x = -mod(dw, 72), i = Math.floor(dw / 72); x < VW; x += 72, i++) {
      R(x, 15, 1, 107, '#0a0c12'); R(x + 1, 15, 1, 107, '#2a2e3c');
      if (i % 5 === 0) { R(x + 24, 46, 17, 9, '#8a9098'); R(x + 24, 46, 17, 1, '#b4bac2'); R(x + 26, 48, 1, 5, '#1a1d28'); R(x + 27, 50, 1, 1, '#1a1d28'); R(x + 28, 48, 1, 2, '#1a1d28'); R(x + 28, 51, 1, 2, '#1a1d28'); digits(12 + (i / 5 | 0) % 40, x + 31, 48, '#1a1d28'); } // 公里牌 K12、K13……
    }
    R(0, 122, VW, 6, '#0c0e15'); R(0, 122, VW, 1, '#151826');
    // 电缆桥架和隧道灯（视差 0.55）
    const dc = d * 0.55, lamps = [];
    for (let x = -mod(dc, 56); x < VW + 56; x += 56) {
      R(x, 17, 2, 7, '#262a36'); R(x, 23, 7, 1, '#262a36');
      for (let px = 0; px < 56; px++) { const s = 1 - Math.pow(px / 28 - 1, 2); R(x + px, 23 + Math.round(3 * s), 1, 1, '#1e2230'); R(x + px, 25 + Math.round(3.5 * s), 1, 1, '#3a2a20'); R(x + px, 27 + Math.round(4 * s), 1, 1, '#22262f'); }
    }
    for (let x = -mod(dc, 112) + 30, i = Math.floor(dc / 112); x < VW + 112; x += 112, i++) {
      R(x - 5, 31, 11, 4, '#1c2030'); R(x - 5, 31, 11, 1, '#3a3e4c'); EM(x - 4, 34, 9, 1, '#ffe7b8'); lamps.push(x);
      glow(x, 38, 28, 16, '#ffc890', 0.05, 3); glow(x, 34, 9, 3, '#fff2d8', 0.25, 2);
      if (hash(i * 7 + 3) < 0.28) { R(x + 26, 42, 10, 6, '#0b1a10'); EM(x + 27, 43, 8, 4, '#1aa04a'); EM(x + 30, 44, 1, 1, '#e8fff0'); EM(x + 29, 45, 3, 1, '#e8fff0'); EM(x + 30, 46, 1, 1, '#e8fff0'); EM(x + 33, 45, 1, 1, '#e8fff0'); glow(x + 31, 45, 8, 6, '#1aa04a', 0.06, 2); } // 安全出口
    }
    // 前方的光（去下一站）：画在墙上、列车后面，从右边一层层亮起来
    const fx = VW * (1.08 - exitK * 1.3);
    if (exitK > 0) { eo.globalAlpha = Math.min(1, exitK * 1.3); eo.drawImage(mask(), Math.round(fx), 15); eo.globalAlpha = 1; for (let i = 0; i < 6; i++) D.Pix.light((fx + 20 + i * 40) * 2, 68 * 2, 170, info.exitCol, 0.2 + exitK * 0.75); RA(Math.max(fx, 0), 13, VW, 2, info.exitCol, exitK * 0.5); } // 右边最亮，往左点阵越来越稀
    RA(0, 120, VW, 8, '#000000', 0.55); // 车下的影子
    // 列车（镜头锁在车上，只有一点漂移）：先画整车，整体压暗（隧道里），再把发光的部分重画一遍
    const drift = Math.round(Math.sin(t * 0.9) * 3 - (1 - smooth(0, 0.6, t)) * 14), head = 252 + drift;
    const cars = [{ x: head - L, idx: info.carNo, head: true }, { x: head - L - 8 - L, idx: info.carNo - 1 }, { x: head - 2 * (L + 8) - L, idx: info.carNo - 2 }].filter(c => c.x < VW && c.x + L + 30 > 0);
    const sparks = [];
    for (const c of cars) {
      c.y = CAR_Y + Math.round(Math.sin(t * 9 + c.idx * 1.7) * 0.6) - Math.max(bump(d, c.x + 30), bump(d, c.x + L - 30));
      car(c, t, d, info, false);
      for (const bx of [c.x + 30, c.x + L - 30]) if (bump(d, bx) && v > 260) sparks.push(bx);
      if (!c.head) { const gx = c.x + L; R(gx, c.y + 7, 8, 40, '#22262f'); for (let k = 0; k < 6; k++) R(gx, c.y + 9 + k * 6, 8, 2, '#2e333e'); R(gx + 1, c.y + 54, 6, 3, '#14161c'); } // 风挡、车钩
    }
    RA(0, CAR_Y - 8, VW, 78, '#05070e', 0.12 + exitK * 0.5);
    for (const c of cars) car(c, t, d, info, true);
    // 隧道灯从车身上扫过：一道暖光
    for (const lx of lamps) { D.Pix.light(lx * 2, (CAR_Y + 10) * 2, 72, '#ffc890', 0.34 * (1 - exitK)); RA(lx - 10, CAR_Y - 1, 20, 1, '#ffe7b8', 0.5 * (1 - exitK)); }
    // 逆光：车顶、车头描一道亮边
    if (exitK > 0) for (const c of cars) { RA(Math.max(c.x, fx), c.y - 1, L - Math.max(0, fx - c.x), 1, info.exitCol, exitK); if (c.head) for (let r = 0; r < 32; r++) { const w = r < 8 ? Math.round(r * 2.4) : 19 + Math.round((r - 8) * 0.4); RA(c.x + L + w, c.y + r, 1, 1, info.exitCol, exitK); } }
    // 铁轨（视差 1）：道床、枕木（越快拖影越长）、钢轨、第三轨和绝缘子、接缝
    R(0, 130, VW, 20, '#14120f');
    for (let i = 0; i < 70; i++) { const x = mod(i * 41 - d, VW + 20) - 10, y = 135 + (i * 7) % 13; R(x, y, 2, 1, i % 3 ? '#1f1b16' : '#2a251e'); }
    const smear = Math.min(16, v / 38);
    for (let x = -mod(d, 20); x < VW + 20; x += 20) { RA(x - smear, 132, 10 + smear, 4, '#2a2018', 0.55); R(x, 132, 10, 1, '#3a2e22'); }
    R(0, 128, VW, 3, '#4a5060'); R(0, 128, VW, 1, '#9aa2b4');
    for (const lx of lamps) RA(lx - 10, 128, 20, 1, '#fff2d8', 0.6); // 隧道灯在钢轨上的反光
    for (let x = -mod(d, J); x < VW; x += J) R(x, 128, 1, 3, '#0b0a14');
    R(0, 141, VW, 1, '#4a5060'); R(0, 142, VW, 2, '#2e323c');
    for (let x = -mod(d, 40); x < VW; x += 40) R(x, 144, 3, 3, '#8a7a5e');
    if (exitK > 0) add(() => { RA(fx, 128, VW, 1, info.exitCol, exitK); RA(fx, 130, VW, 18, info.exitCol, exitK * 0.12); });
    // 车轮火花、第三轨的电弧
    for (const bx of sparks) for (let k = 0; k < 6; k++) { const a = hash(k + Math.floor(t * 30) * 13), b = hash(k * 5 + Math.floor(t * 30)); RA(bx - 8 - a * 18, 127 - b * 6, 1 + (a > 0.7), 1, a > 0.5 ? '#ffe14a' : '#ff7a2e', 1); }
    if (sparks.length && hash(Math.floor(t * 20)) < 0.5) { const bx = sparks[0]; R(bx - 2, 139, 1, 2, '#bfe8ff'); R(bx - 1, 138, 1, 1, '#ffffff'); glow(bx - 1, 139, 10, 5, '#7fc8ff', 0.14, 2); }
    // 车头灯：照亮前方的隧道和钢轨
    beam(head + 28, CAR_Y + 42, 1 - exitK * 0.7);
    // 近处（视差 1.9）：检修走道的栏杆
    const dn = d * 1.9;
    R(0, 155, VW, 25, '#05060a'); R(0, 155, VW, 1, '#1a1d28'); R(0, 156, VW, 1, '#0d0f16');
    for (let x = -mod(dn, 36); x < VW; x += 36) { R(x, 156, 2, 24, '#0d0f16'); R(x, 156, 1, 24, '#1a1d28'); }
    // 最近处（视差 2.6）：一闪而过的立柱，越快边越虚
    const dp = d * 2.6, pw = 30, blur = Math.min(10, v / 70);
    for (let x = -mod(dp, 340) + 220; x > -pw - 20; x -= 340) { RA(x - blur, 0, pw + blur * 2, VH, '#020306', 0.55); R(x, 0, pw, VH, '#020306'); R(x + pw - 1, 0, 1, VH, '#161925'); }
    // 粉尘：被车带起来的细线
    for (let i = 0; i < 9; i++) { const x = mod(i * 97 - d * 3.2, VW + 80) - 40, y = 20 + (i * 53) % 140; RA(x, y, 18 + (i % 3) * 12, 1, '#c8cee0', 0.1); }
    RA(0, 0, VW, 6, '#000000', 0.5); RA(0, VH - 8, VW, 8, '#000000', 0.45); // 上下压暗
  }

  // 一节车厢（和站台上那列同款，放大一倍、细节更多）。glow：只画发光的部分（车窗、门窗、机器人、终点牌、车灯）
  function car(c, t, d, info, glow) {
    const x = c.x, y = c.y, lc = info.lc;
    if (!glow) {
      R(x - 1, y - 1, L + 2, 58, '#0b0a14');
      R(x, y, L, 56, '#b4bec6'); R(x, y, L, 2, '#dce2ea'); R(x, y + 2, L, 1, '#c8d0d8'); R(x, y + 3, L, 2, '#9aa4ae');
      for (const k of [22, 136]) { R(x + k, y - 6, 30, 6, '#0b0a14'); R(x + k + 1, y - 5, 28, 5, '#5a6470'); R(x + k + 1, y - 5, 28, 1, '#7d8891'); for (let g = 3; g < 27; g += 3) R(x + k + 1 + g, y - 3, 1, 2, '#454e5a'); } // 车顶空调
      R(x, y + 44, L, 12, '#7d8891'); R(x, y + 44, L, 1, '#8f9aa4'); for (let g = 8; g < L - 8; g += 5) R(x + g, y + 48, 3, 1, '#626c78'); // 裙板和通风格栅
      R(x, y + 34, L, 4, lc); RA(x, y + 34, L, 1, '#ffffff', 0.45); // 线路色带
      for (let g = 0; g < L; g += 38) R(x + g, y + 5, 1, 29, '#b8c2ca'); // 车身接缝
      o.drawImage(shade(), x, y); // 点阵明暗、往下越脏、铆钉
      for (const wx0 of [10, 42, 128, 160]) R(x + wx0 - 1, y + 7, 26, 22, '#1d2033'); // 窗框
      R(x + 77, y + 4, 38, 41, '#5a6470'); R(x + 78, y + 5, 18, 39, '#aeb8c0'); R(x + 96, y + 5, 18, 39, '#aeb8c0'); R(x + 96, y + 5, 1, 39, '#8f9aa4'); // 车门
      for (const dx of [81, 99]) R(x + dx, y + 10, 12, 16, '#1d2033');
      digits(String(c.idx).padStart(2, '0'), x + L - 22, y + 39, '#4a525e');
      for (const bx of [x + 14, x + L - 46]) { // 转向架、车轮（会转）、集电靴
        R(bx, y + 55, 32, 8, '#2a2e38'); R(bx, y + 55, 32, 1, '#3a3f4c'); R(bx + 13, y + 56, 6, 5, '#454e5a');
        for (const wx of [bx + 7, bx + 25]) wheel(wx, y + 62, d);
        R(bx + 13, y + 70, 7, 2, '#3a3f4c'); // 集电靴：贴着第三轨
      }
      R(x + 56, y + 56, 30, 7, '#20242e'); R(x + 56, y + 56, 30, 1, '#2e333e'); R(x + 100, y + 56, 34, 8, '#20242e'); R(x + 100, y + 56, 34, 1, '#2e333e'); // 车下设备箱
      if (c.head) { // 流线型的前脸、挡风玻璃、司机
        for (let r = 0; r < 56; r++) { const w = r < 8 ? Math.round(r * 2.4) : r < 32 ? 19 + Math.round((r - 8) * 0.4) : 28; R(x + L, y + r, w, 1, r === 0 ? '#e8eef3' : r > 43 ? '#7d8891' : '#c9d2d9'); R(x + L + w, y + r, 1, 1, '#0b0a14'); }
        R(x + L + 2, y + 6, 12, 1, '#0b0a14'); for (let r = 0; r < 18; r++) R(x + L + 1, y + 7 + r, Math.min(14, 3 + Math.round(r * 1.1)), 1, '#1d2a3a');
        R(x + L + 3, y + 13, 3, 4, '#3b3340'); R(x + L + 2, y + 17, 5, 7, '#3b3340'); RA(x + L + 8, y + 9, 2, 12, '#a0d2ff', 0.35);
        R(x + L, y + 34, 28, 4, lc); R(x + L - 14, y + 7, 13, 5, '#0b0a14');
      }
    }
    // 车窗：暖光、天花板灯管、吊环（跟着晃）、座椅、乘客剪影；玻璃上掠过的反光
    const refl = mod(d * 0.9, 360) - 40;
    for (const wx0 of [10, 42, 128, 160]) {
      const wx = x + wx0;
      EM(wx, y + 8, 24, 20, '#e8c080'); EM(wx, y + 8, 24, 2, '#fff0d0'); EM(wx, y + 10, 24, 1, '#fff6e0');
      for (let s = 0; s < 4; s++) { const sw = Math.round(Math.sin(t * 5 + s + c.idx) * 1); KO(wx + 3 + s * 6, y + 11, 1, 3, '#9a7a4a'); KO(wx + 2 + s * 6 + sw, y + 14, 3, 2, '#9a7a4a'); }
      KO(wx, y + 21, 24, 7, '#6a5a48'); KO(wx, y + 21, 24, 1, '#86735c');
      const n = Math.floor(hash(c.idx * 11 + wx0) * 3);
      for (let p = 0; p < n; p++) { const px = wx + 4 + p * 10 + Math.floor(hash(c.idx + wx0 * 3 + p) * 4), stand = hash(p * 9 + c.idx + wx0) > 0.6, top = stand ? y + 12 : y + 16; KO(px, top, 3, 3, '#3b3340'); KO(px - 1, top + 3, 5, 28 - (top - y) - 3, '#3b3340'); if (stand) KO(px + 2, y + 13, 1, 3, '#3b3340'); }
      if (refl > wx - 30 && refl < wx + 30) for (let k = 0; k < 20; k++) { const px2 = Math.round(refl + 8 - k * 0.6); if (px2 >= wx && px2 < wx + 24) RA(px2, y + 8 + k, 2, 1, '#ffffff', 0.4); }
    }
    for (const dx of [81, 99]) { EM(x + dx + 1, y + 11, 10, 14, '#ffe0a0'); EM(x + dx + 1, y + 11, 10, 2, '#fff6e0'); }
    EM(x + 93, y + 2, 4, 2, '#5fe07a');
    if (c.head) {
      eo.fillStyle = '#000000'; eo.fillRect(x + 100, y + 11, 10, 14); hero(x + 100, y + 11, info);
      for (let k = 0; k < 6; k++) if (((t * 8 + k) | 0) % 4) EM(x + L - 13 + k * 2, y + 8, 1, 3, '#ffb057'); // 终点牌
      EM(x + L + 22, y + 40, 5, 3, '#fff6d0'); EM(x + L + 22, y + 46, 5, 2, '#ffe14a'); // 前灯
    }
    if (glow) for (const wx0 of [10, 42, 128, 160]) D.Pix.light((x + wx0 + 12) * 2, (y + 18) * 2, 44, '#ffc890', 0.32); // 车窗的光洒出来
  }
  // 车轮：深色轮子，三道轮辐跟着走过的距离转
  function wheel(cx, cy, d) {
    for (let j = -6; j <= 6; j++) { const w = Math.round(Math.sqrt(36 - j * j)); R(cx - w, cy + j, w * 2, 1, j < -3 ? '#2a2e38' : '#14161c'); }
    const a = (d / 6) % TAU;
    for (let k = 0; k < 3; k++) { const b = a + k * TAU / 3; R(cx + Math.round(Math.cos(b) * 4), cy + Math.round(Math.sin(b) * 4), 1, 1, '#6a7080'); }
    R(cx - 1, cy - 1, 2, 2, '#8a90a0');
  }
  // 车头门窗里的机器人（你的型号；没有图集时画个剪影）
  function hero(x, y, info) {
    const H = info.hero;
    if (H && H.ready && H.meta && H.img && H.img.width) { // 图集被换掉 / 没生成好时画剪影（联机时型号多，图集缓存会被挤掉）
      const fr = (H.meta.idle6 || H.meta.idle8 || [0])[0], sx = (fr % H.cols) * H.fw, sy = Math.floor(fr / H.cols) * H.fh, h = 16, w = Math.round(H.fw * h / H.fh);
      o.save(); o.beginPath(); o.rect(x, y, 10, 14); o.clip(); o.drawImage(H.img, sx, sy, H.fw, H.fh, x + 5 - w / 2, y + 1, w, h);
      if (H.emit) { o.globalCompositeOperation = 'lighter'; o.drawImage(H.emit, sx, sy, H.fw, H.fh, x + 5 - w / 2, y + 1, w, h); eo.drawImage(H.emit, sx, sy, H.fw, H.fh, x + 5 - w / 2, y + 1, w, h); }
      o.restore();
    } else { R(x + 3, y + 3, 4, 4, '#2d3342'); R(x + 2, y + 7, 6, 7, '#2d3342'); R(x + 4, y + 4, 3, 1, info.visor || '#ff7a2e'); }
  }
  // 车头灯：往前一串光（Post），光锥是发光层上的点阵，越远越稀
  function beam(x, y, k) {
    if (k <= 0) return;
    for (let s = 0; s < 6; s++) D.Pix.light((x + 8 + s * 26) * 2, (y + s * 2) * 2, (12 + s * 7) * 2, '#fff2c8', (0.85 - s * 0.12) * k);
    for (let s = 0; x + s < VW; s++) { const hw = 1 + s * 0.16; for (let j = -Math.floor(hw); j <= hw; j++) if (D.Pix.on(0.42 * k * (1 - s / 120), x + s, Math.round(y + j))) { eo.fillStyle = '#2a2618'; eo.fillRect(x + s, Math.round(y + j), 1, 1); } }
    RA(x, 128, VW - x, 1, '#fff2c8', 0.5 * k);
  }

  // ── 镜头 3b：司机室视角（回据点那一趟）。exitK：隧道口的光越来越近
  function cab(t, d, v, exitK, info) {
    const cx = 160, cy = 82, f = 116, z = d * 0.03, HW = 1.3, TOP = -1.0, BOT = 0.95, SEG = 1.3;
    R(0, 0, VW, VH, '#030407');
    const P = (x, y, dep) => [cx + x * f / dep, cy + y * f / dep];
    const box = dep => { const a = P(-HW, TOP, dep), b = P(HW, BOT, dep); return [a[0], a[1], b[0], b[1]]; };
    const quad = (q, col) => D.Pix.poly(o, q, col); // 逐行填，边缘整像素
    const ed = Math.max(0.5, 34 - 33.5 * Math.pow(exitK, 1.5)), jit = v > 300 && bump(d, 0) ? 1 : 0;
    o.save(); o.translate(Math.round((hash(Math.floor(t * 24)) - 0.5) * 2 * jit), jit);
    // 一节节的隧道：从远往近画，四面墙各一块梯形；离隧道口近的墙被它照亮
    const segs = []; for (let j = 0; j < 30; j++) { const dep = 0.3 + j * SEG - mod(z, SEG); if (dep > 0.2 && dep < ed) segs.push({ dep, ring: Math.floor(z / SEG) + j }); }
    segs.push({ dep: ed, ring: -1 });
    for (let k = segs.length - 2; k >= 0; k--) {
      const a = segs[k], b = segs[k + 1], A = box(Math.max(0.18, a.dep)), B = box(b.dep), fog = Math.min(1, a.dep / 20), lit = exitK * Math.max(0, 1 - (ed - a.dep) / 7), odd = a.ring % 2;
      const sh = (base, far) => mix(mix(base, far, fog), '#fff0d0', lit * 0.75);
      quad([A[0], A[1], A[2], A[1], B[2], B[1], B[0], B[1]], sh(odd ? '#12152a' : '#161a30', '#06070c'));   // 顶
      quad([A[0], A[3], A[2], A[3], B[2], B[3], B[0], B[3]], sh(odd ? '#17120d' : '#1c1610', '#050403'));   // 地
      quad([A[0], A[1], B[0], B[1], B[0], B[3], A[0], A[3]], sh(odd ? '#1d2234' : '#22283c', '#08090f'));   // 左墙
      quad([A[2], A[1], B[2], B[1], B[2], B[3], A[2], A[3]], sh(odd ? '#191d2e' : '#1d2236', '#08090f'));   // 右墙
      { const c = sh('#0a0c14', '#040508'), x0 = Math.round(B[0]), y0 = Math.round(B[1]), w = Math.round(B[2] - B[0]), h = Math.round(B[3] - B[1]); R(x0, y0, w, 1, c); R(x0, y0 + h, w + 1, 1, c); R(x0, y0, 1, h, c); R(x0 + w, y0, 1, h, c); } // 环缝
      if (b.ring >= 0 && b.ring % 2 === 0) { // 左墙的灯：一根竖灯管，墙上一片光
        const [lx, ly] = P(-HW, -0.5, b.dep), s = Math.max(1, Math.round(3 / b.dep));
        EM(lx, ly - s * 2, Math.max(1, Math.round(s / 2) + 1), s * 4, '#ffe7b8'); glow(lx + s * 2, ly, s * 8, s * 7, '#ffc890', Math.min(0.2, 0.03 + 0.08 / b.dep), 3);
        if (b.dep < 2.4) RA(lx - s * 14, ly - s, s * 14, Math.max(1, s), '#ffe7b8', 0.35 / b.dep); // 近处的灯拉出一道拖影
      }
    }
    // 隧道口：一个暖白的口子，越来越大
    const E = box(ed);
    if (exitK > 0) { EM(E[0], E[1], E[2] - E[0], E[3] - E[1], mix('#ffd9a0', '#fff6e8', exitK)); glow((E[0] + E[2]) / 2, (E[1] + E[3]) / 2, (E[2] - E[0]) * 0.9 + 6, (E[3] - E[1]) * 0.9 + 4, '#fff0d0', 0.06 + exitK * 0.22, 4); }
    else R(E[0], E[1], E[2] - E[0], E[3] - E[1], '#020304');
    // 枕木、钢轨：往远处汇聚
    for (let k = 0; k < 40; k++) { const dep = 0.42 + k * 0.6 - mod(z, 0.6); if (dep >= ed) break; const a = P(-0.7, BOT, dep), b = P(0.7, BOT, dep); R(a[0], a[1] - 1, b[0] - a[0], Math.max(1, Math.round(2.2 / dep)), mix(dep < 3 ? '#2e2319' : '#1a1510', '#fff0d0', exitK * Math.max(0, 1 - (ed - dep) / 7) * 0.6)); }
    for (const s of [-0.36, 0.36]) for (let dep = 0.4; dep < ed; dep *= 1.035) { const [rx, ry] = P(s, BOT - 0.03, dep); R(rx, ry, Math.max(1, Math.round(1.6 / dep)), Math.max(1, Math.round(0.8 / dep)), '#9aa2b4'); }
    glow(cx, VH - 40, 70, 18, '#fff2c8', 0.04, 4); // 车头灯照着前面的地
    for (const [sx, sy, c] of [[-HW, -0.82, '#2e2a26'], [-HW, -0.74, '#3a2a20'], [-HW, -0.66, '#262a36'], [HW, -0.78, '#262a36'], [HW, -0.7, '#2e2a26']]) for (let dep = 0.35; dep < ed; dep *= 1.04) { const [x0, y0] = P(sx, sy, dep); R(x0 - (sx < 0 ? 0 : 1), y0, Math.max(1, Math.round(1.4 / dep)), Math.max(1, Math.round(1.1 / dep)), c); } // 墙上的电缆
    for (let i = 0; i < 4; i++) { RA(i * 6, 0, 6, VH, '#000000', 0.18); RA(VW - 6 - i * 6, 0, 6, VH, '#000000', 0.18); RA(0, i * 5, VW, 5, '#000000', 0.12); } // 四周压暗
    // 速度线：从中心往外放射
    for (let i = 0; i < 20; i++) { const a = hash(i) * TAU, r0 = mod(hash(i + 7) * 220 + d * 0.6, 220) + 24; RA(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6, 1 + r0 / 40, 1, '#c8cee0', 0.06 + r0 / 1200); }
    o.restore();
    // 司机室：挡风玻璃的框、雨刷、仪表台（指示灯、速度表）；玻璃上映着你机器人的护目光
    R(0, 0, VW, 9, '#0b0c12'); R(0, 0, 10, VH, '#0b0c12'); R(VW - 10, 0, 10, VH, '#0b0c12'); R(10, 9, VW - 20, 1, '#22262f'); R(9, 9, 1, VH - 43, '#22262f'); R(VW - 10, 9, 1, VH - 43, '#22262f');
    for (let k = 0; k < 40; k++) R(30 + k, VH - 36 - Math.round(k * 0.35), 1, 2, '#0b0c12'); // 雨刷
    R(0, VH - 34, VW, 34, '#0e1018'); R(0, VH - 34, VW, 1, '#2e333e'); R(0, VH - 33, VW, 1, '#181b24');
    for (const [lx, c] of [[30, '#5fe07a'], [38, '#ffb057'], [46, '#5fe07a'], [264, '#3ee8ff'], [272, '#ff3047']]) { EM(lx, VH - 24, 4, 3, c); glow(lx + 2, VH - 23, 5, 3, c, 0.12, 2); }
    const sp = Math.min(1, v / V1), na = Math.PI * (1.15 + 0.7 * sp); R(138, VH - 30, 44, 24, '#05060a'); R(138, VH - 30, 44, 1, '#22262f');
    for (let k = 0; k <= 8; k++) { const b = Math.PI * (1.15 + 0.7 * k / 8); R(160 + Math.cos(b) * 15, VH - 10 + Math.sin(b) * 15, 1, 1, k > 6 ? '#ff3047' : '#5a6075'); }
    for (let k = 0; k < 13; k++) R(160 + Math.cos(na) * k, VH - 10 + Math.sin(na) * k, 1, 1, '#ff7a2e');
    digits(String(Math.round(sp * 80)).padStart(2, '0'), 156, VH - 22, '#ffb057');
    const vc = info.visor || '#ff7a2e'; RA(232, 34, 3, 1, vc, 0.45); RA(237, 34, 3, 1, vc, 0.45); RA(228, 30, 16, 10, vc, 0.035); // 玻璃上的倒影
    for (let i = 0; i < 12; i++) RA(20 + hash(i * 3) * 280, 14 + hash(i * 5) * 120, 1, 1, '#c8cee0', 0.08); // 玻璃上的灰点
  }

  // ── 立柱扫过：x 是立柱左边（屏幕像素）；左边保持原来的画面，右边换成新画面
  function pillarWipe(ctx, x, H) {
    const pw = 120, X = Math.round(x);
    ctx.fillStyle = '#020306'; ctx.fillRect(X, 0, pw, H);
    ctx.fillStyle = '#0c0e15'; ctx.fillRect(X + 2, 0, 2, H); ctx.fillStyle = '#161925'; ctx.fillRect(X + pw - 2, 0, 2, H);
    for (let y = 40; y < H; y += 96) { ctx.fillStyle = '#ffe7b8'; ctx.fillRect(X + pw - 10, y, 6, 2); }
  }

  // ── 入口：draw.js 每帧调；时间轴从 D.OUTRO_RIDE.start 开始
  D.drawRide = function (ctx, S, time) {
    const R0 = D.OUTRO_RIDE, t = S.outro.t - R0.start; if (t <= 0) return;
    const dur = S.outro.dur || R0.dur, home = !S.outro.next, W = D.W, H = D.H;
    if (!off) { [off, o] = D.canvas(VW, VH); o.imageSmoothingEnabled = false; [eoff, eo] = D.canvas(VW, VH); [rc, rcx] = D.canvas(W, H); [rc2, rc2x] = D.canvas(W, H); }
    const lit = (fn, dst, dx) => { // 画一个镜头，打光，返回 640×360 的画面
      eo.clearRect(0, 0, VW, VH); fn();
      dx.globalCompositeOperation = 'source-over'; dx.globalAlpha = 1; dx.imageSmoothingEnabled = false; dx.drawImage(off, 0, 0, W, H);
      const ex = D.Post.ex; ex.imageSmoothingEnabled = false; ex.drawImage(eoff, 0, 0, W, H);
      D.Pix.finish(dx, AMB); return dst;
    };
    const d = dist(t), v = speed(t);
    const info = S._rideInfo || (S._rideInfo = {
      lc: S.st && S.st.lines && S.st.lines.length ? D.LINE_COLORS[S.st.lines[0]] : '#ff3047',
      hero: D.heroOf && S.SH && S.SH.key ? D.heroOf(S.SH.key, S.mods) : null, visor: S.SH && S.SH.visor,
      carNo: 3 + ((S.st && +S.st.id) || 0) % 6, exitCol: '#d8ecff', // 训练场的站 id 是 'tut'：按 0 算（以前 'tut' % 6 = NaN，车厢的光全是 NaN）
    });
    // 声音：按跨过的时间点触发（一帧画一次）
    const st = S.outro, prev = st._rt == null ? -1 : st._rt; st._rt = t;
    const cross = x => prev < x && t >= x;
    if (cross(0)) sfx('dash');
    for (let k = 0.55; k < dur - 0.3; k += 0.32) if (cross(k)) sfx('tink');
    const cut = home ? Math.min(1.75, dur * 0.55) : 99; // 回据点：这一刻切到司机室
    if (home && cross(cut - 0.2)) sfx('dash');
    const sideExit = home ? 0 : smooth(dur - 0.7, dur - 0.1, t), cabExit = home ? smooth(cut + 0.35, dur - 0.04, t) : 0;
    const shot = () => t < cut + 0.025 ? lit(() => side(t, d, v, info, sideExit), rc, rcx) : lit(() => cab(t, d, v, cabExit, info), rc, rcx);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const wipe = 0.42;
    if (t < wipe) { // 镜头 1：立柱扫过，把站台换成隧道
      const img = shot(), k = smooth(0, wipe, t), x = W - k * (W + 140);
      ctx.save(); ctx.beginPath(); ctx.rect(Math.round(x + 60), 0, W, H); ctx.clip(); ctx.drawImage(img, 0, 0, W, H); ctx.restore(); pillarWipe(ctx, x, H);
    } else if (home && t > cut - 0.2 && t < cut + 0.25) { // 侧面 → 司机室：立柱再扫一次
      const k = smooth(cut - 0.2, cut + 0.25, t), x = W - k * (W + 140);
      ctx.drawImage(lit(() => side(t, d, v, info, 0), rc, rcx), 0, 0, W, H);
      const b = lit(() => cab(t, d, v, cabExit, info), rc2, rc2x); ctx.save(); ctx.beginPath(); ctx.rect(Math.round(x + 60), 0, W, H); ctx.clip(); ctx.drawImage(b, 0, 0, W, H); ctx.restore();
      pillarWipe(ctx, x, H);
    } else ctx.drawImage(shot(), 0, 0, W, H);
    // 最后淡成白光（去下一站偏冷，回据点偏暖）
    const fin = smooth(dur - 0.16, dur, t); if (fin > 0) { ctx.fillStyle = D.rgba(home ? '#fff4dc' : '#eef6ff', fin); ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  };
})(D);
