/* 末班之后 · 小样二：战利品全量（试玩反馈二）
   在原来四十几件的基础上，按"家族 × 变体"生成几百件战利品：金属、电子、机械部件、医疗、贵重品、首饰、情报、材料、工具、生活用品、军需。
   每件有名字、品质、价值、形状、能叠几个、分类（决定哪种容器常出）和图标。
   图标按家族用模板画（几十种外形 × 配色），同一个模板里按名字微调细节，所以每件长得都不太一样。
   价值按品质落在原来的区间里（经济不变），形状越大略贵一点。
   id 规则：家族代号 + 两位序号 + 变体序号（只往后加，不改顺序，老存档里的东西就不会丢）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const R = D.RAMP;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const VQ = [10, 40, 130, 360, 1150, 3700];

  // ── 图标模板：p 是 28×28 画板，a / b 是主色和点缀色（RAMP 里的色阶），k 是 0..1 的随机微调
  const T = {
    ingot:   (p, a, b, k) => { p.box(3, 12, 22, 10, a, { r: 1 }); p.box(6, 7, 16, 7, a, { r: 1, bias: 0.15 }); p.rect(8, 9, 10 - Math.round(k * 4), 1, a[a.length - 1]); },
    plate:   (p, a, b, k) => { p.box(3, 6, 22, 17, a, { r: 1 }); for (let i = 0; i < 3; i++) p.rect(5, 9 + i * 4, 18, 1, a[1]); p.rect(5 + Math.round(k * 10), 19, 6, 2, b[3]); },
    rod:     (p, a, b, k) => { for (let i = 0; i < 3; i++) p.box(3 + i * 2, 6 + i * 6, 22 - i * 2, 4, a, { r: 1 }); p.rect(22, 7, 2, 2, b[3]); },
    coil:    (p, a, b, k) => { p.ell(14, 15, 10, 9, a); p.ell(14, 15, 4.5, 4, R.dark, { flat: true }); for (let i = 0; i < 4; i++) p.line(6 + i * 4, 7, 4 + i * 4, 23, a[1]); p.line(22, 12, 26, 6 - Math.round(k * 3), a[3]); },
    jar:     (p, a, b, k) => { p.box(7, 7, 14, 18, R.glass, { r: 3, bias: 0.1 }); p.rect(9, 11, 10, 11, a[3]); p.box(8, 3, 12, 5, b, { r: 1 }); p.rect(10, 15, 8, 3, '#eef1f8'); },
    chip:    (p, a, b, k) => { p.box(6, 6, 16, 16, R.dark, { r: 1 }); for (let i = 0; i < 5; i++) { p.rect(3, 8 + i * 3, 3, 1, '#c8cdda'); p.rect(22, 8 + i * 3, 3, 1, '#c8cdda'); } p.rect(9, 9, 10, 10, a[2]); p.rect(11, 11, 6 - Math.round(k * 3), 6, b[4], 1); },
    board:   (p, a, b, k) => { p.box(2, 7, 24, 15, a, { r: 1 }); p.rect(5, 10, 6, 5, '#151a29'); p.rect(13, 10, 4, 3, '#151a29'); for (let i = 0; i < 4; i++) p.line(13, 15 + i, 24, 15 + i, b[4]); p.rect(19, 9 + Math.round(k * 3), 4, 3, '#c8cdda'); },
    device:  (p, a, b, k) => { p.box(2, 6, 24, 17, a, { r: 2 }); p.rect(4, 8, 13, 10, '#0b0e16'); p.rect(5, 9, 11, 3 + Math.round(k * 4), b[4], 1); p.disc(21, 11, 2, b[3]); p.rect(19, 16, 5, 2, '#c8cdda'); },
    phone:   (p, a, b, k) => { p.box(8, 3, 12, 22, a, { r: 2 }); p.rect(9, 5, 10, 15, '#0b0e16'); p.rect(10, 6, 8, 6 + Math.round(k * 6), b[3], 1); p.rect(12, 22, 4, 1, '#c8cdda'); },
    radio:   (p, a, b, k) => { p.box(7, 7, 14, 18, a, { r: 2 }); p.line(17, 7, 19, 1, '#949fb6'); p.rect(9, 10, 10, 5, '#0b0e16'); p.rect(10, 11, 6, 2, b[4], 1); for (let i = 0; i < 3; i++) p.rect(9, 17 + i * 2, 10, 1, a[1]); },
    module:  (p, a, b, k) => { p.box(3, 8, 22, 13, a, { r: 1 }); for (let i = 0; i < 4; i++) p.rect(6 + i * 4, 11, 2, 2, i === Math.floor(k * 4) ? '#ff3047' : '#8dff6a', 1); p.rect(5, 16, 18, 2, '#0b0e16'); },
    drive:   (p, a, b, k) => { p.box(4, 6, 20, 16, a, { r: 1 }); p.ell(13, 14, 6, 6, R.silver); p.disc(13, 14, 1.5, '#1d212c'); p.rect(20, 18, 2, 2, b[4], 1); },
    stick:   (p, a, b, k) => { p.box(9, 8, 10, 16, a, { r: 2 }); p.rect(10, 3, 8, 6, '#c8cdda'); p.rect(11, 4, 2, 2, '#0b0e16'); p.rect(15, 4, 2, 2, '#0b0e16'); p.rect(11, 14, 6, 2, b[4], 1); },
    camera:  (p, a, b, k) => { p.box(3, 9, 22, 14, a, { r: 2 }); p.ell(14, 16, 5, 5, R.gunmetal); p.ell(14, 16, 3, 3, R.glass, { spec: true }); p.rect(5, 7, 6, 3, a[2]); p.rect(21, 11, 2, 2, b[4], 1); },
    goggles: (p, a, b, k) => { p.box(2, 10, 24, 9, a, { r: 3 }); p.ell(8, 14, 4, 4, R.glass, { emit: 0 }); p.ell(20, 14, 4, 4, R.glass); p.disc(8, 14, 2, b[4], 1); p.disc(20, 14, 2, b[4], 1); },
    gear:    (p, a, b, k) => { for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; p.rect(13 + Math.round(Math.cos(t) * 10), 13 + Math.round(Math.sin(t) * 10), 3, 3, a[3]); } p.ell(14, 14, 9, 9, a); p.ell(14, 14, 3, 3, R.dark, { flat: true }); },
    spring:  (p, a, b, k) => { for (let i = 0; i < 7; i++) p.line(7, 5 + i * 3, 21, 7 + i * 3, a[3 + (i % 2)]); p.rect(6, 4, 16, 2, a[2]); p.rect(6, 24, 16, 2, a[2]); },
    piston:  (p, a, b, k) => { p.box(9, 3, 10, 12, a, { r: 2 }); p.rect(9, 6, 10, 1, a[1]); p.rect(9, 9, 10, 1, a[1]); p.rect(12, 15, 4, 8, '#c8cdda'); p.ell(14, 24, 4, 2, a); },
    valve:   (p, a, b, k) => { p.box(3, 13, 22, 7, a, { r: 1 }); p.box(10, 9, 8, 14, a, { r: 2 }); p.rect(13, 3, 2, 7, '#949fb6'); p.ell(14, 4, 6, 2, b); },
    ring2:   (p, a, b, k) => { p.ell(14, 14, 10, 10, a, { spec: true }); p.ell(14, 14, 6, 6, R.dark, { flat: true }); for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; p.disc(14 + Math.cos(t) * 8, 14 + Math.sin(t) * 8, 1, '#ffffff'); } },
    motor:   (p, a, b, k) => { p.box(3, 8, 16, 13, a, { r: 3 }); p.rect(19, 12, 6, 5, '#949fb6'); for (let i = 0; i < 3; i++) p.rect(5, 10 + i * 3, 12, 1, a[1]); p.rect(7, 21, 3, 3, b[3]); },
    tool:    (p, a, b, k) => { p.line(5, 23, 19, 9, a[3]); p.line(6, 23, 20, 9, a[2]); p.ell(21, 7, 4, 4, a); p.ell(21, 7, 1.5, 1.5, R.dark, { flat: true }); p.box(3, 20, 6, 6, b, { r: 1 }); },
    drill:   (p, a, b, k) => { p.box(4, 6, 15, 9, a, { r: 2 }); p.box(8, 14, 6, 10, R.dark, { r: 1 }); p.rect(19, 9, 6, 3, '#c8cdda'); p.rect(5, 8, 4, 2, b[4]); p.rect(9, 23, 6, 2, b[3]); },
    blade:   (p, a, b, k) => { p.line(4, 24, 22, 6, '#dde1ee'); p.line(5, 24, 23, 6, '#a3b6dc'); p.box(3, 20, 6, 6, a, { r: 1 }); p.rect(8, 18, 3, 3, b[3]); },
    pills:   (p, a, b, k) => { p.box(8, 8, 12, 17, a, { r: 2 }); p.box(8, 4, 12, 5, R.white, { r: 1 }); p.rect(10, 13, 8, 6, '#eef1f8'); p.rect(11, 15, 6, 2, b[3]); },
    bottle:  (p, a, b, k) => { p.box(9, 9, 10, 16, a, { r: 3, bias: 0.1 }); p.rect(12, 3, 4, 7, a[2]); p.rect(11, 2, 6, 2, b[3]); p.rect(10, 15, 8, 5, '#eef1f8'); p.rect(11, 17, 4 + Math.round(k * 2), 1, b[2]); },
    box:     (p, a, b, k) => { p.box(4, 8, 20, 16, a, { r: 1 }); p.rect(4, 8, 20, 3, a[a.length - 2]); p.rect(12, 8, 4, 16, b[3]); p.rect(6, 15, 5, 4, '#eef1f8'); },
    syringe: (p, a, b, k) => { p.line(5, 23, 21, 7, '#dde1ee'); p.box(8, 12, 12, 5, R.glass, { r: 1 }); p.rect(10, 13, 6 + Math.round(k * 3), 3, a[3], 1); p.line(21, 7, 25, 3, '#c8cdda'); p.rect(4, 22, 4, 3, b[3]); },
    ivbag:   (p, a, b, k) => { p.box(7, 3, 14, 17, R.glass, { r: 3, bias: 0.2 }); p.rect(9, 8, 10, 10, a[3]); p.line(14, 20, 14, 26, '#c8cdda'); p.rect(10, 5, 8, 2, '#eef1f8'); },
    can:     (p, a, b, k) => { p.box(8, 6, 12, 18, a, { r: 2 }); p.rect(8, 11, 12, 7, b[3]); p.rect(10, 13, 8, 3, '#eef1f8'); p.rect(8, 6, 12, 2, '#c8cdda'); },
    bar:     (p, a, b, k) => { p.box(3, 10, 22, 9, a, { r: 1 }); p.rect(9, 10, 10, 9, b[3]); p.rect(11, 13, 6, 3, '#eef1f8'); },
    ring:    (p, a, b, k) => { p.ell(14, 16, 8, 8, a, { spec: true }); p.ell(14, 16, 5, 5, R.dark, { flat: true }); p.ell(14, 7, 4, 4, b, { spec: true, emit: 0 }); p.px(13, 6, '#ffffff', 1); },
    earring: (p, a, b, k) => { for (const x of [9, 19]) { p.disc(x, 6, 1.5, a[4]); p.line(x, 7, x, 13, a[3]); p.ell(x, 17, 3.5, 4.5, b, { spec: true }); p.px(x - 1, 15, '#ffffff', 1); } },
    bangle:  (p, a, b, k) => { p.ell(14, 14, 11, 8, a, { spec: true }); p.ell(14, 14, 8, 5, R.dark, { flat: true }); for (let i = 0; i < 5; i++) p.disc(7 + i * 3.5, 20 - Math.abs(i - 2), 1, b[4]); },
    brooch:  (p, a, b, k) => { for (let i = 0; i < 6; i++) { const t = i / 6 * Math.PI * 2; p.ell(14 + Math.cos(t) * 6, 14 + Math.sin(t) * 6, 3, 3, a); } p.ell(14, 14, 4.5, 4.5, b, { spec: true }); p.px(13, 12, '#ffffff', 1); },
    pendant: (p, a, b, k) => { for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI; p.disc(14 + Math.cos(t) * 9, 4 + Math.sin(t) * 10, 0.9, a[4]); } p.ell(14, 19, 4, 5, b, { spec: true }); p.rect(13, 13, 2, 2, a[3]); },
    gem:     (p, a, b, k) => { p.ell(14, 15, 9, 8, a, { spec: true, emit: 0 }); p.line(6, 12, 22, 12, a[a.length - 1]); p.line(14, 7, 10, 12, a[a.length - 1]); p.line(14, 7, 18, 12, a[a.length - 1]); p.px(10, 10, '#ffffff', 1); },
    watch2:  (p, a, b, k) => { p.rect(11, 2, 6, 24, b[2]); p.ell(14, 14, 8, 8, a, { spec: true }); p.ell(14, 14, 6, 6, R.white, { flat: true }); p.line(14, 14, 14, 9, '#0b0a14'); p.line(14, 14, 17 + Math.round(k * 2), 15, '#0b0a14'); },
    statue:  (p, a, b, k) => { p.box(9, 21, 10, 5, R.dark, { r: 1 }); p.box(10, 9, 8, 13, a, { r: 2 }); p.ell(14, 6, 4, 4, a, { spec: true }); p.rect(8, 12, 3, 6, a[2]); p.rect(17, 12, 3, 6, a[2]); },
    vase:    (p, a, b, k) => { p.ell(14, 17, 9, 9, a, { spec: true }); p.box(10, 3, 8, 6, a, { r: 1 }); for (let x = 7; x < 22; x += 4) p.px(x, 17, b[4]); p.line(8, 14, 20, 14, b[4]); },
    coin:    (p, a, b, k) => { for (let i = 0; i < 4; i++) p.ell(14, 22 - i * 4, 9, 3, a, { spec: true }); p.ell(14, 9, 9, 4, a, { spec: true }); p.rect(12, 8, 4, 2, a[1]); },
    medal:   (p, a, b, k) => { p.rect(10, 2, 3, 10, b[3]); p.rect(15, 2, 3, 10, b[2]); p.ell(14, 18, 7, 7, a, { spec: true }); for (let i = 0; i < 5; i++) { const t = i / 5 * Math.PI * 2 - Math.PI / 2; p.px(14 + Math.round(Math.cos(t) * 3), 18 + Math.round(Math.sin(t) * 3), a[1]); } },
    doc:     (p, a, b, k) => { p.rect(6, 4, 16, 21, '#e8e0c8'); p.rect(6, 4, 16, 3, a[3]); for (let i = 0; i < 5; i++) p.rect(9, 10 + i * 3, i === 4 ? 6 : 10, 1, '#6a5f50'); p.rect(16, 20, 4, 3, b[3]); },
    folder:  (p, a, b, k) => { p.box(3, 7, 22, 17, a, { r: 1 }); p.rect(3, 5, 9, 3, a[3]); p.rect(6, 10, 16, 11, '#e8e0c8'); p.rect(8, 13, 10, 1, '#6a5f50'); p.rect(8, 16, 7, 1, '#6a5f50'); p.rect(18, 18, 3, 3, b[3]); },
    tape:    (p, a, b, k) => { p.box(2, 8, 24, 14, a, { r: 1 }); p.rect(5, 11, 18, 6, '#e8e0c8'); p.disc(10, 14, 2, '#1d212c'); p.disc(18, 14, 2, '#1d212c'); p.rect(6, 19, 16, 2, b[3]); },
    map:     (p, a, b, k) => { p.rect(3, 5, 22, 18, '#d8ccaa'); p.line(3, 5, 10, 8, '#b8ac8a'); p.line(10, 8, 17, 5, '#b8ac8a'); p.line(5, 18, 22, 9, a[3]); p.line(6, 12, 20, 20, b[3]); p.disc(14 + Math.round(k * 4), 13, 1.5, '#c82e3a'); },
    card:    (p, a, b, k) => { p.box(4, 8, 20, 13, R.white, { r: 2 }); p.rect(4, 11, 20, 3, a[3]); p.rect(7, 15, 5, 4, b[4]); p.rect(14, 16, 7, 1, '#2d3550'); },
    book:    (p, a, b, k) => { p.box(6, 4, 16, 21, a, { r: 1 }); p.rect(6, 4, 3, 21, a[1]); p.rect(11, 9, 8, 2, b[4]); p.rect(11, 13, 6, 1, b[3]); },
    fabric:  (p, a, b, k) => { p.box(2, 9, 20, 12, a, { r: 4 }); p.ell(22, 15, 4, 6, a); p.ell(22, 15, 2, 3, a[1] ? R.dark : R.dark, { flat: true }); for (let i = 0; i < 3; i++) p.line(5 + i * 5, 10, 5 + i * 5, 20, b[3]); },
    barrel:  (p, a, b, k) => { p.box(5, 4, 18, 21, a, { r: 3 }); p.rect(5, 9, 18, 2, a[1]); p.rect(5, 18, 18, 2, a[1]); p.rect(10, 12, 8, 4, b[4]); },
    canister:(p, a, b, k) => { p.box(6, 6, 16, 19, a, { r: 2 }); p.rect(16, 2, 4, 5, '#2d3342'); p.rect(8, 3, 9, 3, a[2]); p.rect(9, 12, 10, 6, b[3]); },
    cup:     (p, a, b, k) => { p.box(6, 9, 14, 15, a, { r: 2 }); p.ell(21, 15, 3, 4, a); p.ell(21, 15, 1.5, 2, R.dark, { flat: true }); p.rect(6, 9, 14, 2, a[a.length - 1]); p.rect(9, 14, 8, 4, b[3]); },
    glasses: (p, a, b, k) => { p.ell(8, 14, 5, 4, R.dark); p.ell(20, 14, 5, 4, R.dark); p.line(13, 13, 15, 13, a[3]); p.line(2, 12, 3, 13, a[3]); p.line(25, 13, 26, 12, a[3]); p.rect(6, 12, 3, 1, b[4]); p.rect(18, 12, 3, 1, b[4]); },
    shoe:    (p, a, b, k) => { p.box(3, 12, 20, 9, a, { r: 3 }); p.box(14, 7, 9, 8, a, { r: 2 }); p.rect(3, 20, 22, 3, '#eef1f8'); for (let i = 0; i < 3; i++) p.rect(15, 9 + i * 2, 6, 1, b[4]); },
    wallet:  (p, a, b, k) => { p.box(3, 8, 22, 14, a, { r: 2 }); p.rect(3, 13, 22, 2, a[1]); p.rect(18, 12, 5, 4, b[4]); },
    helmet:  (p, a, b, k) => { p.ell(14, 15, 11, 10, a, { bias: 0.1 }); p.rect(3, 18, 22, 6, '#0b0a14'); p.rect(6, 15, 16, 3, b[3]); p.rect(20, 9, 3, 3, '#3ee8ff', 1); },
    vest:    (p, a, b, k) => { p.box(5, 4, 18, 21, a, { r: 2 }); p.rect(11, 4, 6, 5, '#0b0a14'); for (let i = 0; i < 3; i++) p.rect(7, 12 + i * 4, 14, 2, a[1]); p.rect(8, 11, 4, 3, b[3]); },
    torch:   (p, a, b, k) => { p.box(4, 11, 18, 7, a, { r: 2 }); p.box(19, 9, 6, 11, a, { r: 2 }); p.ell(24, 14, 1.5, 4, R.glass, { emit: 0 }); p.rect(9, 13, 3, 3, b[4], 1); },
    battery: (p, a, b, k) => { p.box(5, 7, 18, 16, a, { r: 2 }); p.rect(9, 4, 3, 3, '#c8cdda'); p.rect(16, 4, 3, 3, '#c8cdda'); p.rect(8, 11, 12, 3, b[4], 1); p.rect(8, 17, 6 + Math.round(k * 6), 2, '#8dff6a', 1); },
    seeker:  (p, a, b, k) => { p.box(4, 9, 16, 11, a, { r: 4 }); p.ell(21, 14, 5, 6, R.glass, { spec: true }); p.rect(6, 12, 8, 2, b[4], 1); p.rect(4, 6, 3, 17, a[2]); },
  };
  // 每个家族：分类、模板、主色、点缀色；条目 [名字, 品质, 模板?, 主色?, 宽?, 高?]
  const FAM = [
    { code: 'mt', cat: 'metal', var: [['', 0, 1], ['回收', -1, 0.8], ['高纯', 1, 1.5]], items: [
      ['铁锭', 0, 'ingot', 'gunmetal'], ['铝锭', 0, 'ingot', 'silver'], ['锌锭', 0, 'ingot', 'steel'], ['锡锭', 1, 'ingot', 'silver'], ['镍锭', 1, 'ingot', 'plate'], ['镁锭', 1, 'ingot', 'white'],
      ['铬锭', 2, 'ingot', 'steel'], ['钴锭', 2, 'ingot', 'blue'], ['钛锭', 2, 'ingot', 'white'], ['钨锭', 3, 'ingot', 'dark'], ['黄铜块', 1, 'ingot', 'gold'], ['青铜块', 1, 'ingot', 'copper'],
      ['不锈钢板', 1, 'plate', 'silver'], ['钢筋头', 0, 'rod', 'rust'], ['铜线卷', 0, 'coil', 'copper'], ['铝箔卷', 0, 'coil', 'silver'], ['银丝卷', 2, 'coil', 'silver'], ['金丝卷', 3, 'coil', 'gold'],
      ['金箔', 3, 'plate', 'gold'], ['钯金片', 4, 'plate', 'silver'], ['铱棒', 4, 'rod', 'silver'], ['稀土氧化物', 3, 'jar', 'green'], ['铑粉瓶', 4, 'jar', 'silver'], ['铂丝卷', 4, 'coil', 'white'],
      ['锇块', 5, 'ingot', 'blue'], ['金砖', 5, 'ingot', 'gold', 2, 1] ] },
    { code: 'el', cat: 'elec', var: [['', 0, 1], ['工业', 1, 1.6], ['军规', 2, 2.6]], items: [
      ['电解电容', 0, 'chip', 'blue'], ['电阻排', 0, 'chip', 'green'], ['继电器', 0, 'module', 'blue'], ['晶振', 1, 'chip', 'silver'], ['稳压模块', 1, 'module', 'green'], ['变压器', 1, 'motor', 'copper', 2, 1],
      ['旧主板', 1, 'board', 'green', 2, 1], ['内存条', 1, 'board', 'green', 2, 1], ['网卡', 1, 'board', 'blue', 2, 1], ['路由器', 1, 'device', 'dark', 2, 1], ['机械硬盘', 1, 'drive', 'gunmetal'], ['U 盘', 0, 'stick', 'red'],
      ['摄像头模组', 1, 'camera', 'dark'], ['对讲机', 1, 'radio', 'olive', 1, 2], ['平板电脑', 2, 'phone', 'dark'], ['智能手机', 2, 'phone', 'gunmetal'], ['卫星电话', 3, 'radio', 'dark', 1, 2], ['示波器', 3, 'device', 'blue', 2, 2],
      ['频谱仪', 3, 'device', 'gunmetal', 2, 2], ['光模块', 2, 'stick', 'silver'], ['FPGA 板', 3, 'board', 'magenta', 2, 1], ['服务器主板', 3, 'board', 'dark', 2, 2], ['固态阵列', 4, 'module', 'dark', 2, 1], ['量子退火芯', 5, 'chip', 'magenta'],
      ['工控机', 2, 'device', 'gunmetal', 2, 2], ['交换机', 2, 'module', 'dark', 3, 1], ['显示屏', 1, 'device', 'dark', 2, 2], ['电源适配器', 0, 'module', 'dark'] ] },
    { code: 'pt', cat: 'part', var: [['', 0, 1], ['重型', 1, 1.5], ['精密', 2, 2.4]], items: [
      ['齿轮', 0, 'gear', 'steel'], ['弹簧组', 0, 'spring', 'silver'], ['活塞', 1, 'piston', 'gunmetal', 1, 2], ['阀门', 1, 'valve', 'copper'], ['链条', 0, 'coil', 'gunmetal'], ['传动皮带', 0, 'coil', 'dark'],
      ['滚珠丝杠', 2, 'rod', 'silver', 2, 1], ['减速器', 2, 'motor', 'steel', 2, 1], ['步进电机', 2, 'motor', 'gunmetal', 2, 1], ['液压泵', 2, 'motor', 'red', 2, 2], ['涡轮叶片', 3, 'gear', 'silver'], ['喷油嘴', 1, 'valve', 'silver'],
      ['离合器片', 1, 'ring2', 'rust'], ['传动轴', 1, 'rod', 'steel', 2, 1], ['机械臂关节', 3, 'gear', 'yellow', 2, 2], ['陀螺仪', 3, 'ring2', 'gold'], ['编码器', 2, 'chip', 'gunmetal'], ['电磁阀', 1, 'valve', 'blue'],
      ['气缸', 1, 'piston', 'silver', 1, 2], ['轴承座', 0, 'ring2', 'steel'], ['联轴器', 1, 'ring2', 'gunmetal'], ['伺服驱动器', 3, 'module', 'yellow', 2, 1], ['谐波减速机', 4, 'gear', 'silver', 2, 2], ['外骨骼关节', 4, 'piston', 'yellow', 2, 2] ] },
    { code: 'md', cat: 'med', var: [['', 0, 1], ['军用', 1, 1.7]], items: [
      ['止痛片', 0, 'pills', 'white', 'red'], ['抗生素', 1, 'pills', 'blue'], ['碘伏', 0, 'bottle', 'rust'], ['纱布卷', 0, 'fabric', 'white'], ['夹板', 0, 'plate', 'white'], ['输液袋', 1, 'ivbag', 'red'],
      ['血浆袋', 2, 'ivbag', 'red'], ['肾上腺素', 2, 'syringe', 'yellow'], ['吗啡针', 2, 'syringe', 'magenta'], ['除颤贴片', 1, 'card', 'red'], ['手术器械包', 2, 'box', 'white', 2, 1], ['缝合包', 1, 'box', 'blue'],
      ['抗辐射药', 2, 'pills', 'yellow'], ['营养剂', 0, 'bottle', 'green'], ['压缩饼干', 0, 'bar', 'yellow'], ['能量棒', 0, 'bar', 'red'], ['罐装水', 0, 'can', 'blue'], ['咖啡罐头', 0, 'can', 'cloth'],
      ['疫苗冷藏盒', 3, 'box', 'glass', 2, 1], ['纳米修复剂', 3, 'syringe', 'green'], ['再生凝胶', 4, 'jar', 'magenta'], ['战地手术箱', 3, 'box', 'olive', 2, 2] ] },
    { code: 'jw', cat: 'val', var: [['银', 2, 0.9], ['金', 3, 1], ['铂金', 4, 1], ['镶钻', 5, 0.9]], items: [
      ['戒指', 0, 'ring', 'silver'], ['耳环', 0, 'earring', 'silver'], ['手镯', 0, 'bangle', 'silver'], ['胸针', 0, 'brooch', 'silver'], ['项坠', 0, 'pendant', 'silver'], ['袖扣', 0, 'earring', 'silver'],
      ['发簪', 0, 'blade', 'silver'], ['怀表链', 0, 'pendant', 'silver'] ] },
    { code: 'vl', cat: 'val', var: [['', 0, 1]], items: [
      ['打火机', 1, 'card', 'gold'], ['钢笔', 1, 'rod', 'dark'], ['烟斗', 1, 'tool', 'cloth'], ['邮票册', 2, 'book', 'red'], ['纪念币', 2, 'coin', 'silver'], ['勋章', 2, 'medal', 'gold', 'red'],
      ['铜像', 2, 'statue', 'copper', 1, 2], ['茶具', 2, 'cup', 'white', 'blue', 2, 1], ['漆盒', 2, 'box', 'red', 'gold'], ['鼻烟壶', 3, 'bottle', 'glass', 'gold'], ['琥珀', 3, 'gem', 'yellow'], ['珍珠串', 3, 'pendant', 'white', 'white'],
      ['翡翠摆件', 4, 'statue', 'green', 1, 2], ['蓝宝石', 4, 'gem', 'blue'], ['祖母绿', 4, 'gem', 'green'], ['欧泊', 4, 'gem', 'magenta'], ['黑珍珠', 4, 'gem', 'dark'], ['机械腕表', 3, 'watch2', 'silver', 'dark'],
      ['陀飞轮表', 4, 'watch2', 'gold', 'cloth'], ['青花瓷', 4, 'vase', 'white', 'blue', 2, 2], ['玉玺', 5, 'statue', 'green'], ['粉钻', 5, 'gem', 'magenta'], ['古籍善本', 4, 'book', 'cloth'], ['油画小品', 4, 'folder', 'cloth', 'gold', 2, 1],
      ['金佛', 5, 'statue', 'gold', 1, 2], ['帝王绿手镯', 5, 'bangle', 'green'], ['老年份白酒', 2, 'bottle', 'white', 'red'], ['名庄红酒', 3, 'bottle', 'red', 'gold'], ['雪茄礼盒', 2, 'box', 'cloth', 'gold'], ['限量球鞋', 2, 'shoe', 'white', 'red', 2, 1] ] },
    { code: 'in', cat: 'intel', var: [['', 0, 1], ['加密', 1, 1.7]], items: [
      ['调度日志', 1, 'doc', 'blue'], ['监控录像带', 1, 'tape', 'dark'], ['员工证', 0, 'card', 'blue'], ['施工图纸', 1, 'map', 'blue'], ['军用地图', 2, 'map', 'olive'], ['硬盘阵列', 3, 'module', 'dark', 2, 1],
      ['保险单据', 1, 'folder', 'yellow'], ['股权证书', 3, 'folder', 'gold'], ['实验记录', 2, 'book', 'white'], ['样本冷藏盒', 3, 'box', 'glass'], ['卫星数据卡', 3, 'card', 'magenta'], ['密码本', 2, 'book', 'red'],
      ['巡检记录', 0, 'doc', 'gunmetal'], ['货运清单', 0, 'doc', 'yellow'], ['人事档案', 1, 'folder', 'cloth'], ['董事会纪要', 3, 'folder', 'dark'], ['研发数据盘', 4, 'drive', 'magenta'], ['城市防务图', 4, 'map', 'red'] ] },
    { code: 'ma', cat: 'mat', var: [['', 0, 1]], items: [
      ['胶带', 0, 'ring2', 'yellow'], ['扎带', 0, 'coil', 'dark'], ['螺栓', 0, 'rod', 'steel'], ['铆钉', 0, 'rod', 'silver'], ['焊锡丝', 0, 'coil', 'silver'], ['电线', 0, 'coil', 'red'],
      ['帆布', 0, 'fabric', 'olive'], ['皮革', 1, 'fabric', 'cloth'], ['橡胶管', 0, 'coil', 'dark'], ['塑料桶', 0, 'barrel', 'blue'], ['玻璃瓶', 0, 'bottle', 'glass'], ['化肥袋', 0, 'box', 'white'],
      ['汽油罐', 1, 'canister', 'red'], ['医用酒精', 0, 'bottle', 'white'], ['硝酸铵', 1, 'box', 'white', 'red'], ['防锈剂', 0, 'canister', 'yellow'], ['润滑油', 0, 'canister', 'gunmetal'], ['环氧树脂', 1, 'jar', 'yellow'],
      ['碳纤维布', 2, 'fabric', 'dark'], ['凯夫拉片', 2, 'plate', 'yellow'], ['硅胶垫', 0, 'plate', 'blue'], ['导热膏', 1, 'jar', 'silver'], ['石墨烯薄膜', 3, 'plate', 'dark'], ['气凝胶块', 3, 'ingot', 'glass'],
      ['工业胶水', 0, 'bottle', 'yellow'], ['焊条', 0, 'rod', 'rust'], ['耐火砖', 0, 'ingot', 'rust'], ['钢丝绳', 1, 'coil', 'steel'], ['液氮罐', 2, 'canister', 'glass', 1, 2], ['特种陶瓷', 3, 'plate', 'white'] ] },
    { code: 'tl', cat: 'part', var: [['', 0, 1], ['专业', 1, 1.6]], items: [
      ['扳手', 0, 'tool', 'steel'], ['螺丝刀组', 0, 'tool', 'red'], ['钳子', 0, 'tool', 'blue'], ['电钻', 1, 'drill', 'yellow', 2, 1], ['角磨机', 1, 'drill', 'blue', 2, 1], ['万用表', 1, 'device', 'yellow'],
      ['热风枪', 1, 'drill', 'red', 2, 1], ['切割机', 2, 'drill', 'gunmetal', 2, 2], ['千斤顶', 1, 'piston', 'red', 1, 2], ['液压剪', 2, 'tool', 'red', 2, 1], ['激光测距仪', 2, 'torch', 'yellow'], ['内窥镜', 2, 'camera', 'dark'],
      ['焊台', 1, 'device', 'dark', 2, 1], ['扭力扳手', 1, 'tool', 'silver'], ['游标卡尺', 0, 'rod', 'silver'], ['手术级钳', 2, 'tool', 'white'] ] },
    { code: 'hh', cat: 'mat', var: [['', 0, 1]], items: [
      ['香烟', 0, 'box', 'white', 'red'], ['咖啡豆', 0, 'box', 'cloth'], ['茶饼', 1, 'ring2', 'cloth'], ['巧克力', 0, 'bar', 'cloth', 'gold'], ['太阳镜', 1, 'glasses', 'dark'], ['耳机', 1, 'ring2', 'dark'],
      ['皮夹', 1, 'wallet', 'cloth', 'gold'], ['香薰', 1, 'bottle', 'magenta'], ['口红', 1, 'stick', 'red', 'gold'], ['剃须刀', 0, 'phone', 'silver'], ['保温杯', 0, 'can', 'steel'], ['游戏机', 2, 'device', 'red', 2, 1],
      ['相机镜头', 2, 'camera', 'dark'], ['无人机', 2, 'module', 'white', 2, 2], ['电子书', 1, 'phone', 'white'], ['蓝牙音箱', 1, 'can', 'dark', 'blue'], ['手电', 0, 'torch', 'dark'], ['充电宝', 0, 'battery', 'white'] ] },
    { code: 'ml', cat: 'part', var: [['', 0, 1], ['改进型', 1, 1.6]], items: [
      ['战术手电', 1, 'torch', 'olive'], ['夜视仪', 3, 'goggles', 'olive', 2, 1], ['防弹插板', 2, 'vest', 'olive', 2, 2], ['战术头盔', 2, 'helmet', 'olive', 2, 2], ['激光指示器', 2, 'torch', 'dark'], ['军用电台', 3, 'radio', 'olive', 1, 2],
      ['无人机电池', 1, 'battery', 'olive'], ['热成像模块', 3, 'camera', 'olive'], ['导引头', 4, 'seeker', 'gunmetal', 2, 1], ['雷达板', 4, 'board', 'olive', 2, 2], ['火控计算机', 4, 'device', 'olive', 2, 2], ['外骨骼电池', 3, 'battery', 'yellow', 1, 2],
      ['战术背心', 1, 'vest', 'cloth', 2, 2], ['防毒面具', 1, 'goggles', 'dark'], ['弹药箱', 0, 'box', 'olive', 2, 1], ['信号弹', 0, 'rod', 'red'] ] },
  ];
  const CAT_EXTRA = {}; // 预留
  let n = 0;
  for (const F of FAM) {
    F.items.forEach((it, i) => {
      let [name, q, tpl, ramp, w, h] = it; let acc = 'yellow';
      if (typeof w === 'string') { acc = w; w = h; h = it[6]; }  // [名字, 品质, 模板, 主色, 点缀色, 宽, 高]
      w = w || 1; h = h || 1;
      F.var.forEach(([pre, dq, vm], vi) => {
        const qq = F.code === 'jw' ? dq : q + dq; if (qq < 0 || qq > 5) return;
        if (F.var.length > 1 && F.code !== 'jw' && vi > 0 && hash(name + vi) < 0.25) return; // 少数组合不出，别太整齐
        const id = F.code + String(i).padStart(2, '0') + vi, nm = pre + name, k = hash(nm);
        const v = Math.round(VQ[qq] * (0.7 + 0.6 * k) * (1 + (w * h - 1) * 0.2) * (F.code === 'jw' ? vm : 1));
        const stack = w * h > 1 ? 1 : qq === 0 ? 10 : qq === 1 ? 5 : qq === 2 ? 3 : 1;
        const a = R[F.code === 'jw' ? ['silver', 'gold', 'white', 'silver'][vi] : ramp] || R.steel, b = R[F.code === 'jw' ? ['glass', 'red', 'blue', 'white'][Math.floor(k * 4)] : acc] || R.yellow;
        D.ITEMS[id] = { name: nm, q: qq, v: Math.max(1, v), w, h, stack, cat: F.cat, art: 'x_' + id, gen: F.code };
        const mark = F.code === 'jw' || !vi ? null : ['#ffd860', '#3ee8ff', '#ff6a6a'][vi - 1]; // 变体在右上角多一个小标：一道 / 两道杠
        D.ITEM_ART['x_' + id] = p => { T[tpl](p, a, b, k); if (mark) for (let j = 0; j < vi; j++) { p.rect(21, 2 + j * 3, 5, 2, '#0b0a14'); p.rect(22, 2 + j * 3, 4, 1, mark, 1); } };
        n++;
      });
    });
  }
  D.ITEMS_GEN = n;
  // 堆叠规则（试玩反馈：低价值东西一组 5 个起）：白色至少 10、绿色至少 5（占两格的也 5 个）、蓝色一格的至少 3
  for (const k in D.ITEMS) { const it = D.ITEMS[k], big = it.w * it.h > 2; if (big || D.KEY_LEVEL[k]) continue; const min = it.q === 0 ? 10 : it.q === 1 ? 5 : it.q === 2 && it.w * it.h === 1 ? 3 : 1; if ((it.stack || 1) < min) it.stack = min; }
  void CAT_EXTRA;
})(D);
