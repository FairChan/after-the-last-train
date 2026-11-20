/* Underdog · 每把枪拿在手上的样子（melee-hold.js 画，2026-11-17 用户："再按同样的方式修改枪械的持枪方案"）
   sprite.js 画板，2 倍精度、自动描黑边，灯、能量、火标发光。枪口朝右画。
   size: [宽, 高, 握把 x, 握把 y]（后手握的地方 = 绕着转的点）；fore: 前手托的位置（没有 = 单手）；mz: 枪口；
   kind: pistol 单手往前伸 / rifle 双手抵肩 / heavy 端在腰上（重、慢、后坐大）；kick: 后坐（世界单位）；frames: 动画帧数（转管、锯片……）；
   dual: 一手一把（双枪）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const R = D.RAMP, TAU = Math.PI * 2;
  // 横着的一根管子：上沿亮、下沿暗
  const tube = (p, x0, x1, y, h, ramp) => { for (let j = 0; j < h; j++) { const v = h === 1 ? 0.6 : 0.95 - 0.8 * j / (h - 1); p.rect(x0, y + j, x1 - x0 + 1, 1, ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))]); } };
  // 斜着往后下方的握把
  const handle = (p, x, y, h, col, dark) => { for (let j = 0; j < h; j++) p.rect(x - Math.floor(j / 2), y + j, 3, 1, j === h - 1 ? dark || col : col); if (dark) for (let j = 0; j < h; j++) p.px(x - Math.floor(j / 2) + 2, y + j, dark); };
  const G = {
    nailgun: { kind: 'pistol', kick: 0.8, size: [21, 13, 6, 7], mz: [19, 4], paint: p => {
      p.box(3, 1, 13, 6, R.yellow, { r: 2 }); p.rect(5, 2, 7, 1, '#fff3b0'); p.px(13, 3, '#ff7a2e', 1);
      tube(p, 15, 19, 3, 2, R.gunmetal); handle(p, 7, 7, 5, '#2d3342', '#1d212c'); p.rect(11, 7, 2, 4, '#646e86'); p.rect(11, 7, 2, 1, '#c8cdda');
    } },
    smg: { kind: 'rifle', kick: 0.7, size: [27, 12, 9, 6], fore: [16, 6], mz: [25, 3], paint: p => {
      p.rect(1, 3, 1, 4, '#3d4766'); p.rect(1, 3, 6, 1, '#3d4766'); // 折叠托
      p.box(6, 1, 13, 5, R.dark, { r: 1 }); p.rect(8, 2, 8, 1, '#4c5c86'); tube(p, 19, 25, 2, 2, R.gunmetal);
      handle(p, 9, 6, 5, '#20263b', '#0c0e17'); p.rect(14, 6, 3, 5, '#151a29'); p.rect(14, 6, 3, 1, '#3d4766'); p.px(17, 3, '#ff3047', 1);
    } },
    shotgun: { kind: 'rifle', kick: 2.4, size: [38, 11, 11, 6], fore: [23, 6], mz: [36, 3], paint: p => {
      for (let x = 1; x <= 9; x++) { const h = 3 + Math.round((9 - x) / 4); p.rect(x, 3, 1, h, x < 3 ? '#4a2f1f' : R.cloth[3 + (x % 2)]); } p.rect(1, 3, 9, 1, '#ad7a52');
      p.box(9, 2, 9, 4, R.gunmetal, { r: 1 }); tube(p, 17, 36, 2, 2, R.gunmetal); tube(p, 18, 30, 4, 2, R.gunmetal);
      p.box(20, 4, 8, 3, R.cloth); for (let x = 21; x < 28; x += 2) p.px(x, 5, '#2f1d13'); handle(p, 11, 6, 4, '#4a2f1f', '#2f1d13');
    } },
    pulse: { kind: 'rifle', kick: 0.6, size: [36, 12, 12, 7], fore: [22, 7], mz: [34, 4], paint: p => {
      p.box(1, 3, 8, 4, R.white, { r: 1 }); p.box(8, 1, 18, 6, R.white, { r: 2 }); tube(p, 25, 34, 3, 3, R.gunmetal);
      for (let x = 12; x < 24; x += 3) p.rect(x, 3, 2, 1, '#3ee8ff', 1); p.px(33, 4, '#e6fdff', 1);
      handle(p, 12, 7, 5, '#555d7a', '#2e3349'); p.box(17, 7, 4, 4, R.dark); p.rect(18, 8, 2, 1, '#3ee8ff', 1);
    } },
    railgun: { kind: 'rifle', kick: 2.8, size: [46, 14, 13, 8], fore: [26, 8], mz: [44, 5], paint: p => {
      p.box(1, 4, 9, 5, R.dark, { r: 1 }); p.box(9, 2, 15, 7, R.gunmetal, { r: 2 });
      p.rect(23, 2, 21, 2, '#646e86'); p.rect(23, 2, 21, 1, '#c8cdda'); p.rect(23, 7, 21, 2, '#434b5f'); p.rect(23, 7, 21, 1, '#949fb6'); // 两条导轨
      for (let x = 24; x < 43; x += 3) p.rect(x, 4, 1, 3, '#3ee8ff', 1); p.box(12, 0, 8, 2, R.dark); p.px(19, 0, '#3ee8ff', 1);
      handle(p, 13, 9, 5, '#2d3342', '#1d212c');
    } },
    sniper: { kind: 'rifle', kick: 2.2, size: [46, 12, 13, 7], fore: [24, 6], mz: [44, 4], paint: p => {
      for (let x = 1; x <= 10; x++) p.rect(x, 3, 1, x < 7 ? 5 : 4, R.olive[2 + (x % 2)]); p.rect(1, 3, 10, 1, '#788f45');
      p.box(10, 3, 14, 3, R.olive); tube(p, 23, 44, 3, 2, R.gunmetal); p.rect(42, 3, 2, 2, '#1d212c');
      p.box(12, 0, 11, 3, R.dark, { r: 1 }); p.px(22, 1, '#ff3047', 1); p.px(11, 1, '#9cc4ff', 1); p.rect(18, 5, 3, 1, '#c8cdda'); // 瞄准镜、枪栓
      handle(p, 13, 6, 5, '#3a4a22', '#253017');
    } },
    revolver: { kind: 'pistol', kick: 1.6, size: [20, 12, 5, 6], mz: [18, 3], paint: p => {
      p.box(4, 1, 7, 5, R.silver, { r: 1 }); p.ell(8.5, 3.5, 2.6, 2.6, R.silver, { spec: true }); tube(p, 10, 18, 2, 2, R.silver); p.rect(17, 1, 1, 1, '#9aa1b4');
      for (let j = 0; j < 6; j++) p.rect(4 - Math.floor(j / 2), 6 + j, 3, 1, j % 2 ? '#8c5d3c' : '#6a442c');
    } },
    dbarrel: { kind: 'rifle', kick: 3, size: [36, 11, 11, 6], fore: [21, 6], mz: [34, 3], paint: p => {
      for (let x = 1; x <= 9; x++) p.rect(x, 3, 1, 3 + Math.round((9 - x) / 3), R.cloth[2 + (x % 3)]); p.rect(1, 3, 9, 1, '#ad7a52');
      p.box(9, 2, 6, 4, R.silver); tube(p, 15, 34, 2, 2, R.gunmetal); tube(p, 15, 34, 4, 2, R.gunmetal); p.rect(17, 6, 9, 2, '#6a442c');
      handle(p, 11, 6, 4, '#4a2f1f', '#2f1d13');
    } },
    xbow: { kind: 'rifle', kick: 0.8, size: [28, 18, 8, 10], fore: [16, 10], mz: [26, 8], paint: p => {
      p.box(1, 7, 22, 3, R.cloth); p.rect(1, 7, 22, 1, '#ad7a52'); tube(p, 20, 26, 8, 1, R.silver);
      p.line(20, 1, 22, 8, '#3d4766'); p.line(22, 9, 20, 16, '#3d4766'); p.line(21, 1, 23, 8, '#646e86'); p.line(23, 9, 21, 16, '#646e86'); // 弓臂
      p.line(20, 2, 12, 8, '#c8cdda'); p.line(12, 9, 20, 15, '#c8cdda'); p.rect(12, 8, 12, 1, '#949fb6'); p.px(25, 8, '#e3c14a');
      handle(p, 8, 10, 5, '#4a2f1f', '#2f1d13');
    } },
    burst: { kind: 'rifle', kick: 1, size: [36, 14, 12, 7], fore: [21, 7], mz: [34, 4], paint: p => {
      p.box(1, 3, 9, 5, R.dark, { r: 1 }); p.box(9, 2, 15, 5, R.gunmetal, { r: 1 }); tube(p, 23, 34, 3, 2, R.gunmetal); p.rect(30, 2, 1, 1, '#646e86');
      p.rect(11, 0, 10, 1, '#434b5f'); p.rect(11, 0, 1, 2, '#434b5f'); p.rect(20, 0, 1, 2, '#434b5f'); // 提把
      for (let j = 0; j < 6; j++) p.rect(16 + Math.floor(j / 2), 7 + j, 3, 1, '#1d212c'); p.rect(16, 7, 3, 1, '#646e86'); handle(p, 12, 7, 5, '#2d3342', '#1d212c'); p.px(22, 4, '#ffd84a', 1);
    } },
    ricochet: { kind: 'rifle', kick: 0.8, size: [28, 12, 9, 7], fore: [17, 7], mz: [26, 4], paint: p => {
      p.box(3, 2, 15, 6, R.green, { r: 3 }); tube(p, 17, 26, 3, 3, R.gunmetal); for (let x = 19; x < 25; x += 2) p.rect(x, 2, 1, 5, '#b4ec98', 1);
      p.ell(8, 4.5, 2, 2, R.silver, { spec: true }); handle(p, 9, 8, 4, '#1c4a20', '#0e2a12');
    } },
    hookgun: { kind: 'rifle', kick: 1.2, size: [30, 14, 9, 8], fore: [16, 8], mz: [27, 5], paint: p => {
      p.box(2, 3, 14, 6, R.rust, { r: 2 }); p.ell(7, 6, 3, 3, R.gunmetal); p.px(7, 6, '#c8cdda'); tube(p, 15, 23, 4, 3, R.gunmetal);
      p.line(23, 5, 27, 2, '#c8cdda'); p.line(23, 6, 27, 9, '#c8cdda'); p.line(24, 5, 28, 5, '#eef1f8'); p.px(27, 1, '#9aa1b4'); p.px(27, 10, '#9aa1b4');
      handle(p, 9, 9, 4, '#3b2018', '#1f0f0c');
    } },
    flamer: { kind: 'heavy', kick: 0.3, size: [36, 16, 10, 8], fore: [20, 9], mz: [34, 5], paint: p => {
      p.box(1, 4, 18, 5, R.red, { r: 2 }); tube(p, 18, 33, 4, 3, R.gunmetal); p.box(31, 3, 4, 5, R.dark);
      p.ell(13, 11.5, 6, 3, R.red, { spec: true }); p.rect(9, 10, 6, 1, '#ff98a0'); p.rect(15, 9, 1, 2, '#3d4766'); // 油罐
      p.px(34, 7, '#ff8a2e', 1); p.px(34, 8, '#ffd84a', 1); handle(p, 10, 9, 3, '#2d3342', '#1d212c');
    } },
    gl: { kind: 'heavy', kick: 2.2, size: [32, 15, 10, 9], fore: [22, 9], mz: [30, 5], paint: p => {
      p.box(1, 4, 9, 4, R.olive, { r: 1 }); p.ell(15, 6.5, 6, 5.5, R.olive, { spec: true }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; p.px(15 + Math.cos(a) * 3.5, 6.5 + Math.sin(a) * 3.5, '#141a0e'); }
      tube(p, 20, 30, 3, 5, R.gunmetal); p.rect(29, 4, 1, 3, '#0c0e17'); handle(p, 10, 9, 5, '#3a4a22', '#253017');
    } },
    emshot: { kind: 'rifle', kick: 2, size: [34, 12, 10, 7], fore: [20, 7], mz: [32, 4], paint: p => {
      p.box(1, 3, 8, 4, R.dark); p.box(8, 1, 14, 6, R.yellow, { r: 1 }); p.box(21, 2, 12, 5, R.gunmetal, { r: 1 });
      for (let x = 22; x < 32; x += 3) p.rect(x, 2, 1, 5, '#ffd84a', 1); p.rect(10, 3, 9, 1, '#5a3e0d'); handle(p, 10, 7, 5, '#2d3342', '#1d212c');
    } },
    minigun: { kind: 'heavy', kick: 0.5, size: [42, 16, 11, 9], fore: [22, 3], mz: [40, 7], frames: 3, paint: (p, f) => {
      p.box(1, 3, 17, 9, R.gunmetal, { r: 2 }); p.rect(4, 4, 10, 1, '#949fb6'); p.box(4, 12, 9, 3, R.dark); // 弹箱
      p.rect(19, 0, 6, 2, '#434b5f'); p.rect(19, 0, 1, 4, '#434b5f'); p.rect(24, 0, 1, 4, '#434b5f'); // 上把手
      for (let i = 0; i < 4; i++) { const y = 4 + ((i + f) % 4) * 2; tube(p, 18, 40, y, 2, i === 0 ? R.silver : R.gunmetal); }
      p.rect(18, 3, 2, 10, '#1d212c'); p.rect(37, 3, 2, 10, '#1d212c'); handle(p, 11, 12, 3, '#2d3342', '#1d212c');
    } },
    smart: { kind: 'rifle', kick: 0.6, size: [30, 13, 10, 8], fore: [18, 8], mz: [28, 4], paint: p => {
      p.box(2, 2, 18, 6, R.blue, { r: 3 }); tube(p, 19, 28, 3, 3, R.gunmetal); p.box(10, 0, 6, 3, R.dark, { r: 1 }); p.px(14, 1, '#ff3047', 1); p.px(12, 1, '#3ee8ff', 1);
      p.rect(5, 4, 10, 1, '#9cc4ff'); handle(p, 10, 8, 4, '#132a5a', '#0a1630');
    } },
    bolas: { kind: 'rifle', kick: 1.6, size: [32, 15, 10, 9], fore: [18, 9], mz: [28, 6], paint: p => {
      p.box(1, 4, 20, 6, R.copper, { r: 2 }); tube(p, 20, 27, 5, 3, R.gunmetal);
      p.ell(28.5, 3, 2.5, 2.5, R.gunmetal, { spec: true }); p.ell(28.5, 11, 2.5, 2.5, R.gunmetal, { spec: true }); p.line(28, 5, 28, 9, '#949fb6');
      handle(p, 10, 10, 4, '#5a2a10', '#2a1206');
    } },
    cryo: { kind: 'rifle', kick: 0.5, size: [34, 14, 11, 8], fore: [20, 8], mz: [32, 4], paint: p => {
      p.box(1, 2, 20, 6, R.white, { r: 2 }); tube(p, 20, 32, 3, 3, R.gunmetal); p.rect(31, 2, 2, 5, '#9fe9ff', 1);
      p.box(14, 8, 7, 5, R.glass, { r: 2 }); p.rect(15, 9, 5, 1, '#e6fbff', 1); p.rect(4, 4, 8, 1, '#58a3bd', 1); handle(p, 11, 8, 5, '#555d7a', '#2e3349');
    } },
    stapler: { kind: 'pistol', kick: 0.9, size: [22, 12, 5, 6], mz: [20, 5], paint: p => {
      p.box(2, 1, 18, 3, R.red, { r: 1 }); p.rect(3, 1, 15, 1, '#ff98a0'); p.box(2, 4, 18, 2, R.silver); p.rect(19, 4, 1, 2, '#3a3f4c');
      handle(p, 5, 6, 5, '#2d3550', '#151a29');
    } },
    sawgun: { kind: 'rifle', kick: 1.4, size: [32, 18, 9, 10], fore: [16, 10], mz: [27, 8], frames: 2, paint: (p, f) => {
      p.box(1, 6, 18, 5, R.yellow, { r: 2 }); p.rect(4, 7, 10, 1, '#fff3b0');
      p.ell(25, 8, 6.5, 6.5, R.silver, { spec: true }); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + f * 0.3; p.px(25 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, '#eef1f8'); }
      p.disc(25, 8, 1.6, '#3a3f4c'); handle(p, 9, 11, 5, '#5a3e0d', '#2a1c06');
    } },
    sonic: { kind: 'heavy', kick: 1.6, size: [34, 18, 10, 10], fore: [18, 10], mz: [32, 8], paint: p => {
      p.box(1, 5, 18, 7, R.magenta, { r: 2 }); for (let x = 18; x <= 32; x++) { const h = 4 + Math.round((x - 18) * 0.7); tube(p, x, x, 8 - Math.floor(h / 2), h, R.magenta); }
      p.rect(31, 2, 1, 13, '#d080d4', 1); p.rect(6, 7, 8, 1, '#d080d4', 1); handle(p, 10, 12, 4, '#381443', '#1d0a22');
    } },
    arcgun: { kind: 'rifle', kick: 1.2, size: [40, 15, 11, 9], fore: [22, 9], mz: [38, 6], paint: p => {
      p.box(1, 4, 22, 6, R.blue, { r: 2 }); p.rect(4, 5, 14, 1, '#9cc4ff');
      tube(p, 22, 37, 2, 2, R.copper); tube(p, 22, 37, 9, 2, R.copper); for (let x = 24; x < 37; x += 3) { p.px(x, 1, '#e3975a'); p.px(x, 11, '#e3975a'); }
      p.px(38, 2, '#9cc4ff', 1); p.px(38, 10, '#9cc4ff', 1); handle(p, 11, 10, 4, '#132a5a', '#0a1630');
    } },
    parasite: { kind: 'pistol', kick: 1, size: [21, 13, 5, 7], mz: [19, 4], paint: p => {
      p.ell(9, 4.5, 6, 3.5, R.green, { spec: true }); tube(p, 14, 19, 3, 3, R.olive); p.ell(8, 4, 2, 1.5, R.magenta); p.px(8, 4, '#d080d4', 1); p.px(11, 6, '#8dff6a', 1);
      handle(p, 5, 7, 5, '#1c4a20', '#0e2a12');
    } },
    breacher: { kind: 'rifle', kick: 3.2, size: [32, 12, 10, 7], fore: [19, 7], mz: [30, 4], paint: p => {
      p.box(1, 3, 8, 4, R.dark); p.box(8, 1, 13, 6, R.gunmetal, { r: 1 }); tube(p, 20, 28, 2, 5, R.gunmetal);
      for (let y = 1; y <= 7; y += 2) p.rect(29, y, 2, 1, '#c8cdda'); p.rect(10, 3, 8, 1, '#ff7a2e'); handle(p, 10, 7, 5, '#2d3342', '#1d212c');
    } },
    akimbo: { kind: 'pistol', dual: true, kick: 0.7, size: [17, 11, 5, 6], mz: [15, 3], paint: p => {
      p.box(3, 1, 12, 4, R.gunmetal, { r: 1 }); p.rect(4, 1, 10, 1, '#949fb6'); p.px(14, 2, '#1d212c'); handle(p, 5, 5, 5, '#20263b', '#0c0e17'); p.px(8, 6, '#3d4766');
    } },
    beam: { kind: 'rifle', kick: 0.3, size: [36, 14, 11, 8], fore: [21, 8], mz: [34, 6], paint: p => {
      p.box(1, 3, 22, 7, R.dark, { r: 2 }); p.rect(4, 4, 15, 1, '#3d4766'); tube(p, 22, 30, 4, 4, R.gunmetal);
      p.ell(32, 6, 2.6, 3.6, R.red, { spec: true, emit: true }); p.px(33, 6, '#ffffff', 1); for (let x = 6; x < 18; x += 4) p.px(x, 6, '#ff3d8b', 1);
      handle(p, 11, 10, 4, '#20263b', '#0c0e17');
    } },
    minegun: { kind: 'rifle', kick: 1.4, size: [32, 15, 10, 9], fore: [18, 9], mz: [28, 6], paint: p => {
      p.box(1, 4, 18, 6, R.olive, { r: 2 }); tube(p, 18, 25, 5, 3, R.gunmetal);
      p.ell(28, 6.5, 3, 3, R.gunmetal, { spec: true }); for (const [x, y] of [[28, 2], [28, 11], [32, 6], [25, 3], [31, 3], [31, 10]]) p.px(x, y, '#c8cdda'); p.px(28, 6, '#ff3047', 1);
      handle(p, 10, 10, 4, '#3a4a22', '#253017');
    } },
    prism: { kind: 'rifle', kick: 0.6, size: [30, 14, 10, 8], fore: [17, 8], mz: [28, 6], paint: p => {
      p.box(1, 3, 18, 6, R.white, { r: 2 }); tube(p, 18, 22, 4, 3, R.gunmetal);
      for (let x = 22; x <= 28; x++) { const h = 9 - Math.abs(x - 25) * 2; if (h > 0) p.rect(x, 6 - Math.floor(h / 2), 1, h, x < 25 ? '#a6e2f0' : '#58a3bd', 1); }
      p.px(24, 5, '#ffffff', 1); p.px(26, 7, '#ff98a0', 1); p.px(25, 4, '#ffd95c', 1); handle(p, 10, 9, 4, '#555d7a', '#2e3349');
    } },
    singular: { kind: 'heavy', kick: 3.4, size: [38, 18, 11, 10], fore: [21, 11], mz: [35, 8], paint: p => {
      p.box(1, 5, 20, 7, R.dark, { r: 2 }); p.box(19, 2, 13, 12, R.magenta, { r: 4 }); for (let y = 3; y < 13; y += 3) p.rect(19, y, 13, 1, '#1d0a22');
      p.ell(33, 8, 3.5, 3.5, R.dark); p.disc(33, 8, 1.5, '#0b0a14'); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; p.px(33 + Math.cos(a) * 3.5, 8 + Math.sin(a) * 3.5, '#ff6af0', 1); }
      handle(p, 11, 12, 4, '#20263b', '#0c0e17');
    } },
    gambler: { kind: 'pistol', kick: 1.6, size: [20, 12, 5, 6], mz: [18, 3], paint: p => {
      p.box(4, 1, 7, 5, R.gold, { r: 1 }); p.ell(8.5, 3.5, 2.6, 2.6, R.gold, { spec: true }); tube(p, 10, 18, 2, 2, R.gold); p.px(8, 3, '#ff3047', 1);
      for (let j = 0; j < 6; j++) p.rect(4 - Math.floor(j / 2), 6 + j, 3, 1, j % 2 ? '#8f1d26' : '#c82e3a'); p.px(3, 8, '#fff4c0');
    } },
    overheat: { kind: 'rifle', kick: 0.6, size: [36, 13, 12, 7], fore: [22, 7], mz: [34, 4], fx: 'heat', paint: p => {
      p.box(1, 3, 9, 4, R.dark); p.box(9, 1, 15, 6, R.gunmetal, { r: 1 }); tube(p, 23, 34, 3, 2, R.copper);
      for (let x = 24; x < 33; x += 2) { p.rect(x, 1, 1, 2, '#8c4a1c'); p.rect(x, 5, 1, 2, '#8c4a1c'); } // 散热片
      p.rect(11, 3, 10, 1, '#ff7a2e', 1); handle(p, 12, 7, 5, '#2d3342', '#1d212c');
    } },
  };
  D.GUN_LOOK = G;
  // 枪口离手多远（世界单位）
  D.gunReach = id => { const L = G[D.cardBase ? D.cardBase(id) : id]; return L ? (L.mz[0] - L.size[2]) / 2 : 8; };
})(D);
// 开火点（player.js 原来那个，没改：子弹、枪口火光都从这里出去）。画枪的时候让枪口对上它（melee-hold.js 的 drawGun）
(function (D) {
  D.muzzlePt = (S, p, a) => [p.x + Math.cos(a) * 12, p.y - 11 + Math.sin(a) * 7];
})(D);
