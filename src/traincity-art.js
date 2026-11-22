/* Underdog：北渡列车城的车队（story-act2.js 的 traincity 站；台词见 story/第四幕-北渡.md）
   站台层轨道的右半段停着 E-17 的车队（左半段留给进站的班车和接驳车，车头停在 x≈460 以内）：
     驾驶室（车头朝左、门开着，林远舟站在门口）→ 生活车厢（暖光的窗、窗里的盆栽、晒的衣服、烟囱）→ 三节导弹发射平车（盖着防水布的弹筒、黄三角、起竖臂）。
   画法守死亡细胞画风：全部用 D.mkSprite（2 倍精度、box / ell 着色、抖动、自动黑边），光从左上来；
   窗光、门里的光、车头灯、状态灯标 emit 进发光层，另外往这一层加几盏灯（F.lights）让后期泛光。
   用法：D.TrainCityArt.place(S) 在列车城第一帧调一次（返回驾驶室门口、生活车厢门口的位置，用来摆林远舟、陆衡）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16;
  const rampOf = c => [D.mixHex(c, '#0b0a14', 0.72), D.mixHex(c, '#0b0a14', 0.45), D.mixHex(c, '#0b0a14', 0.2), c, D.mixHex(c, '#fff4e0', 0.22), D.mixHex(c, '#fff4e0', 0.45), D.mixHex(c, '#fff4e0', 0.7)];
  const BODY = { cab: '#5d6a52', home: '#4f5d70', flat: '#3a3f4a', tarp: '#5b663f' };
  // 车队：x 是世界坐标的车身左沿，w 是车身宽（世界像素）；车厢之间留 6
  const CARS = [{ k: 'cab', x: 476, w: 104 }, { k: 'home', x: 586, w: 100 }, { k: 'launch', x: 692, w: 118 }, { k: 'launch', x: 816, w: 118 }, { k: 'launch', x: 940, w: 118 }];
  const cache = new Map();
  const spr = (key, w, h, fn) => { let s = cache.get(key); if (!s) { s = D.mkSprite(w, h, fn); cache.set(key, s); } return s; };

  // 转向架、车轮、底架（每节车都有）
  function chassis(p, W, H) {
    const RP = D.RAMP;
    p.box(6, H - 22, W - 12, 7, RP.dark, { v: 0.45 });
    for (const bx of [14, W - 50]) {
      p.box(bx, H - 17, 36, 8, RP.gunmetal, { r: 2, v: 0.55 });
      for (const wx of [bx + 8, bx + 28]) { p.ell(wx, H - 7, 6, 6, RP.gunmetal, { spec: true, bias: -0.05 }); p.disc(wx, H - 7, 2, '#1d212c'); }
    }
  }
  // 车头：车头朝左，斜面前脸、挡风玻璃里有暖光、开着的驾驶室门、红腰线、锈和烧痕
  const cabSpr = () => spr('tc_cab', 216, 84, p => {
    const RP = D.RAMP, B = rampOf(BODY.cab), H = 84;
    chassis(p, 216, H);
    p.box(14, 14, 196, 50, B, { r: 4, v: 0.62 });
    p.box(2, 26, 18, 38, B, { r: 3, v: 0.5 });                                   // 斜面前脸
    p.box(6, 18, 34, 18, RP.glass, { r: 3, v: 0.35 }); p.grad(10, 22, 26, 10, rampOf('#ffcf8a'), true); p.rect(22, 22, 2, 10, '#3a2a1a'); // 挡风玻璃、里面的暖光、窗框
    p.box(14, 50, 196, 5, RP.red, { v: 0.6 });                                   // 红腰线
    p.box(70, 20, 24, 40, RP.dark, { r: 1, v: 0.3 }); p.grad(73, 23, 18, 35, rampOf('#ffb060'), true); p.box(94, 22, 5, 36, RP.silver, { r: 1, v: 0.5 }); // 开着的门、门里的光、推开的门扇
    for (const wx of [112, 148]) { p.box(wx, 22, 22, 14, RP.dark, { r: 1 }); p.grad(wx + 2, 24, 18, 10, rampOf('#e8b070'), true); }
    p.box(180, 22, 26, 12, RP.dark, { r: 1, v: 0.25 });                           // 车号牌（字另画）
    p.box(36, 6, 64, 10, RP.gunmetal, { r: 2, v: 0.6 }); p.box(120, 8, 40, 8, RP.gunmetal, { r: 2, v: 0.5 }); // 车顶机组
    p.line(52, 6, 62, 0, '#2d3342'); p.line(62, 0, 80, 0, '#2d3342');             // 受电弓（折着）
    p.disc(5, 44, 3, '#fff3c0', true); p.disc(5, 56, 2, '#ff6a4a', true);        // 车头灯、尾灯
    for (const [x, y, w, h] of [[120, 40, 18, 8], [172, 42, 26, 6], [40, 40, 14, 6]]) p.box(x, y, w, h, RP.rust, { v: 0.4 }); // 锈
    for (const [x, y] of [[150, 18], [60, 58], [190, 58]]) p.ell(x, y, 7, 3, RP.dark, { flat: true, bias: -0.2 }); // 烧痕
  });
  // 生活车厢：暖光的窗（有的窗里摆着盆栽）、门开着、一根晾衣绳挂着衣服、车顶一根烟囱、补丁
  const homeSpr = () => spr('tc_home', 208, 84, p => {
    const RP = D.RAMP, B = rampOf(BODY.home), H = 84;
    chassis(p, 208, H);
    p.box(4, 14, 200, 50, B, { r: 4, v: 0.6 });
    p.box(4, 50, 200, 4, RP.yellow, { v: 0.55 });
    [10, 44, 132, 166].forEach((wx, i) => {
      p.box(wx, 24, 26, 18, RP.dark, { r: 1 }); p.grad(wx + 2, 26, 22, 14, rampOf(i % 2 ? '#ffc070' : '#ffb060'), true); p.rect(wx + 12, 26, 2, 14, '#3a2414');
      if (i === 1 || i === 2) { p.ell(wx + 7, 38, 4, 3, RP.green, { flat: true }); p.ell(wx + 19, 37, 3, 4, RP.green, { flat: true }); } // 窗台上的盆栽
    });
    p.box(84, 20, 22, 40, RP.dark, { r: 1, v: 0.3 }); p.grad(87, 23, 16, 35, rampOf('#ffb060'), true);
    p.line(6, 19, 202, 19, '#2a1f19');                                            // 晾衣绳
    const cloth = ['#c8524a', '#e6d8b0', '#5a7ab0', '#d08a3a', '#8a6aa8', '#e6d8b0', '#6a8a5a'];
    [14, 30, 52, 112, 128, 150, 176].forEach((x, i) => p.box(x, 20, i % 3 === 2 ? 8 : 11, i % 2 ? 12 : 9, rampOf(cloth[i]), { r: 1, v: 0.72 }));
    p.box(150, 0, 8, 16, RP.rust, { r: 1, v: 0.55 }); p.px(153, 0, '#ffb060', true); p.px(154, 0, '#ff8a3a', true); // 烟囱和一点火星
    p.box(116, 44, 22, 10, RP.rust, { v: 0.45 }); for (const x of [118, 128, 136]) p.px(x, 46, '#2a1f19');   // 补丁和铆钉
  });
  // 导弹发射平车：低平的车架，弹筒躺在起竖架上、盖着防水布，几道绑带，露出来的弹头端有黄黑警示环和黄三角，尾端一盏红状态灯
  const launchSpr = () => spr('tc_launch', 240, 96, p => {
    const RP = D.RAMP, T = rampOf(BODY.tarp), F = rampOf(BODY.flat), H = 96;
    chassis(p, 240, H);
    p.box(2, 62, 236, 12, F, { r: 2, v: 0.55 });                                 // 平车车架
    p.box(176, 40, 46, 24, RP.gunmetal, { r: 2, v: 0.55 });                       // 起竖架底座
    for (let k = 0; k < 3; k++) p.line(186 + k, 40, 200 + k, 26, RP.steel[3 + (k === 0 ? 1 : 0)]); // 液压臂
    p.box(14, 30, 196, 32, T, { r: 12, v: 0.66 });                                // 防水布裹着的弹筒
    for (let x = 40; x < 196; x += 26) p.box(x, 32, 3, 28, T, { v: 0.3 });         // 布褶
    for (const x of [56, 112, 168]) p.box(x, 28, 5, 36, RP.cloth, { r: 1, v: 0.5 }); // 绑带
    p.ell(14, 46, 12, 15, RP.white, { spec: true, bias: -0.08 });                 // 露出来的弹头端
    for (let y = 33; y < 60; y += 6) p.rect(8, y, 6, 3, '#eab52e'); for (let y = 36; y < 60; y += 6) p.rect(8, y, 6, 3, '#1d1408'); // 黄黑警示环
    p.line(22, 52, 27, 42, '#eab52e'); p.line(27, 42, 32, 52, '#eab52e'); p.line(22, 52, 32, 52, '#eab52e'); p.px(27, 48, '#1d1408'); // 黄三角
    p.disc(226, 36, 2, '#ff3047', true);                                          // 状态灯
  });
  const SPR = { cab: cabSpr, home: homeSpr, launch: launchSpr };

  // 摆进列车城：第一帧调。给这一层加灯，记下要画的车；返回驾驶室门口、生活车厢门口（站台上，登车区上面一点）
  function place(S) {
    const F = S.floors && S.floors[1]; if (!F || !F.track) return null;
    const ty = F.track.y0 * TS + 2, base = ty + 34;
    S.tcConvoy = { f: 1, cars: CARS, base };
    const L = (x, y, r, col, a, flick) => F.lights.push({ x, y, r, col, a, flick: flick || 0.04, seed: x % 97 });
    L(CARS[0].x + 41, ty + 14, 56, '#ffb060', 0.55); L(CARS[0].x + 12, ty + 12, 40, '#ffcf8a', 0.4);
    L(CARS[1].x + 47, ty + 14, 56, '#ffb060', 0.55); L(CARS[1].x + 15, ty + 12, 34, '#ffc070', 0.35); L(CARS[1].x + 85, ty + 12, 34, '#ffc070', 0.35);
    for (const c of CARS.filter(c => c.k === 'launch')) { L(c.x + 113, ty + 6, 18, '#ff3047', 0.35, 0.3); L(c.x + 56, ty - 2, 64, '#c8d8e8', 0.42, 0.06); } // 状态灯；照着弹筒的冷白工作灯
    return { cabDoor: { x: CARS[0].x + 41, y: F.boardY - 6 }, homeDoor: { x: CARS[1].x + 47, y: F.boardY - 8 } };
  }
  // 画：排在站台上的人、东西后面（轨道在站台下沿外面，离镜头更近），按车身底边排序
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    const r = de0 ? de0.apply(this, arguments) : undefined, V = S && S.tcConvoy;
    if (V && S.f === V.f) for (const c of V.cars) list.push({ y: V.base, f: () => {
      const s = SPR[c.k](); D.blit(ctx, s, c.x + c.w / 2, V.base); if (s.emit) D.blit(ex, s, c.x + c.w / 2, V.base, false, 'emit');
      if (c.k === 'cab') { const t = S.t || 0; D.text(ctx, 'E-17', c.x + 97, V.base - 34, '#ffb057', { align: 'center' }); D.text(ex, 'E-17', c.x + 97, V.base - 34, 'rgba(255,176,87,0.55)', { align: 'center' }); if (((t * 1.5) | 0) % 2) { ex.fillStyle = 'rgba(255,240,200,0.5)'; ex.fillRect(c.x, V.base - 20, 2, 2); } }
      if (c.k === 'launch' && (((S.t || 0) * 2 + c.x) | 0) % 2) { ex.fillStyle = 'rgba(255,48,71,0.8)'; ex.fillRect(c.x + 112, V.base - 31, 2, 2); }
    } });
    return r;
  };
  D.TrainCityArt = { CARS, place, sprites: () => CARS.map(c => SPR[c.k]()) };
})(D);
