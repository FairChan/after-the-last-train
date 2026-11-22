/* 末班之后 · 小样二：第三批容器的像素图（程序生成）
   containers-ext2.js 里的 110 种容器，按外形（body）画 14 种：柜、箱、木箱、桶、罐、推车、货架、垃圾箱、冷柜、麻袋、托盘、舱、窄柜、售货机。
   颜色和角标按名字的哈希挑，所以同一种外形的两种看着也不太一样。关（o=false）和开（o=true）各一张。
   房间：每种按外形塞进几个房间，权重很低，老的容器照旧是主力。
   晚于 containers-ext2.js 和 resource-ext.js 加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const R = D.RAMP, DK = '#080a12';
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const at = (r, i) => r[Math.max(0, Math.min(r.length - 1, i))];
  const SHADE = ['steel', 'gunmetal', 'olive', 'cloth', 'copper', 'rust', 'white', 'silver', 'blue', 'red', 'green', 'yellow', 'dark', 'crate', 'magenta', 'gold'];
  const MAT = { cabinet: 'metal', chest: 'wood', crate: 'wood', drum: 'metal', tank: 'metal', cart: 'metal', shelf: 'wood', bin: 'plastic', freezer: 'fridge', sack: 'soft', pallet: 'wood', pod: 'metal', locker: 'metal', vending: 'glass' };
  const SIZE = { cabinet: [22, 32], chest: [28, 20], crate: [28, 22], drum: [18, 24], tank: [16, 30], cart: [28, 24], shelf: [28, 30], bin: [20, 20], freezer: [28, 22], sack: [26, 20], pallet: [30, 24], pod: [26, 26], locker: [20, 34], vending: [22, 32] };
  // 外形 → 出现的房间（都是 D.ROOMS 里已有的房间；没有的会跳过）
  const ROOMS = { cabinet: ['storage', 'workshop', 'security', 'control', 'office'], chest: ['storage', 'cargo', 'shelter', 'hidden', 'gallery'], crate: ['storage', 'cargo', 'garage', 'factory', 'shop'], drum: ['storage', 'factory', 'garage', 'workshop', 'power'], tank: ['power', 'factory', 'medic', 'workshop', 'pit'], cart: ['garage', 'workshop', 'tracks', 'platform', 'hall'], shelf: ['shop', 'storage', 'office', 'dorm', 'lounge'], bin: ['washroom', 'platform', 'hall', 'lounge', 'shelter', 'atrium'], freezer: ['medic', 'shop', 'lounge', 'control', 'server'], sack: ['shelter', 'cargo', 'storage', 'platform'], pallet: ['cargo', 'storage', 'tracks', 'hall'], pod: ['dorm', 'medic', 'control', 'server', 'hidden'], locker: ['hall', 'platform', 'dorm', 'security', 'traincar', 'atrium'], vending: ['hall', 'platform', 'lounge', 'shop', 'atrium'] };

  // ── 14 种外形（p 是画板，o 是开着，a 是主色阶，b 是点缀色阶）
  const BODY = {
    cabinet(p, o, a, b) {
      p.box(1, 1, 20, 30, a, { r: 1 }); p.rect(10, 3, 1, 27, '#161a29'); p.px(8, 15, '#e3c14a'); p.px(12, 15, '#e3c14a'); p.rect(3, 3, 6, 1, at(a, 5));
      if (o) { p.rect(2, 2, 7, 28, DK); p.rect(3, 3, 1, 26, '#2a3140'); } else p.rect(3, 4, 6, 24, at(a, 3));
    },
    chest(p, o, a, b) {
      p.box(1, 8, 26, 11, a, { r: 1 }); p.box(1, 3, 26, 6, b, { r: 2 }); p.rect(1, 11, 26, 1, '#24160c'); p.rect(12, 10, 4, 4, '#e3c14a');
      if (o) { p.box(1, 0, 26, 4, b, { r: 2 }); p.rect(3, 9, 22, 3, DK); }
    },
    crate(p, o, a, b) {
      p.box(1, 3, 26, 18, a, { r: 1 }); p.rect(1, 11, 26, 1, '#24160c'); p.line(3, 5, 25, 19, at(a, 1)); p.rect(4, 15, 6, 2, b[3]);
      if (o) p.box(0, 0, 28, 4, a, { r: 1 });
    },
    drum(p, o, a, b) {
      p.ell(9, 5, 7, 3, a, { spec: true }); p.box(2, 5, 14, 18, a, { r: 2 }); p.rect(2, 10, 14, 1, '#161a29'); p.rect(2, 18, 14, 1, '#161a29'); p.rect(5, 12, 8, 4, b[4]);
      if (o) p.ell(9, 5, 6, 2, DK, { flat: true });
    },
    tank(p, o, a, b) {
      p.box(3, 4, 10, 24, a, { r: 3 }); p.ell(8, 4, 5, 2, b, { spec: true }); p.rect(12, 10, 3, 2, '#e3c14a'); p.disc(7, 15, 1.5, '#ffd860', 1);
      if (o) p.ell(8, 4, 4, 1, DK, { flat: true });
    },
    cart(p, o, a, b) {
      p.box(3, 6, 22, 12, a, { r: 1 }); p.rect(3, 6, 22, 2, b[3]); p.disc(7, 21, 2.5, '#1d212c'); p.disc(21, 21, 2.5, '#1d212c'); p.line(25, 6, 27, 1, '#949fb6'); p.rect(6, 10, 6, 3, b[4]);
      if (o) p.rect(4, 7, 20, 3, DK);
    },
    shelf(p, o, a, b) {
      p.rect(2, 1, 24, 28, at(a, 1)); p.rect(1, 1, 1, 28, at(a, 4)); p.rect(26, 1, 1, 28, at(a, 4));
      for (const y of [8, 16, 24]) p.rect(1, y, 26, 2, at(a, 4));
      const cols = ['#e8e0c8', '#ff3047', '#3ee8ff', b[3], '#8dff6a'];
      [2, 10, 18].forEach((top, i) => { for (let x = 3, n = 0; x < 22; x += 4, n++) { if (o && (n + i) % 3 === 0) continue; p.rect(x, top, 3, 6, cols[(n + i) % cols.length]); } });
    },
    bin(p, o, a, b) {
      p.box(3, 8, 14, 11, a, { r: 2 }); p.rect(2, 6, 16, 3, at(a, 5)); p.rect(5, 11, 1, 8, at(a, 1)); p.rect(9, 11, 1, 8, at(a, 1)); p.rect(13, 11, 1, 8, at(a, 1));
      if (o) p.rect(3, 6, 14, 2, DK);
    },
    freezer(p, o, a, b) {
      p.box(1, 6, 26, 15, R.white, { r: 2 }); p.rect(1, 12, 26, 1, '#848ca8'); p.rect(20, 8, 4, 1, '#848ca8'); p.rect(4, 8, 8, 3, R.glass);
      if (o) { p.rect(2, 2, 24, 4, R.white); p.rect(3, 7, 22, 3, DK); }
    },
    sack(p, o, a, b) {
      p.ell(13, 12, 10, 8, a); p.rect(11, 4, 5, 3, '#4a2f1f'); p.rect(9, 11, 8, 5, b[3]);
      if (o) { p.ell(13, 17, 11, 3, a); p.disc(8, 17, 1, b[4], 1); p.disc(19, 18, 1, b[4], 1); }
    },
    pallet(p, o, a, b) {
      p.rect(1, 20, 28, 2, '#8a6a42'); p.rect(2, 22, 3, 2, '#5a3e0d'); p.rect(14, 22, 3, 2, '#5a3e0d'); p.rect(25, 22, 3, 2, '#5a3e0d');
      p.box(2, 9, 12, 11, a, { r: 1 }); p.rect(2, 13, 12, 1, '#24160c'); p.box(15, 5, 13, 15, b, { r: 1 }); p.rect(15, 11, 13, 1, '#24160c');
      if (o) p.rect(3, 9, 10, 2, DK);
    },
    pod(p, o, a, b) {
      p.ell(13, 12, 10, 12, a, { spec: true }); p.ell(13, 9, 5, 4, R.glass, { spec: true }); p.rect(6, 22, 14, 3, R.dark);
      if (o) p.ell(13, 12, 5, 6, DK);
    },
    locker(p, o, a, b) {
      p.box(1, 1, 18, 32, a, { r: 1 }); p.rect(9, 2, 1, 30, '#161a29'); for (let y = 4; y < 12; y += 3) { p.rect(3, y, 5, 1, '#232a42'); p.rect(11, y, 6, 1, '#232a42'); } p.px(7, 17, '#ffd95c');
      if (o) p.rect(2, 2, 7, 30, DK);
    },
    vending(p, o, a, b) {
      p.box(1, 1, 20, 30, a, { r: 1 }); p.rect(3, 3, 16, 16, R.glass);
      const pr = ['#ff3047', '#ffd23a', '#8dff6a', '#e8e0c8'];
      for (const x of [5, 9, 13]) for (const y of [5, 10, 15]) p.rect(x, y, 3, 3, pr[(x + y) % pr.length]);
      p.rect(3, 21, 16, 2, '#161a29'); p.rect(16, 24, 3, 3, '#3ee8ff', 1);
      if (o) { p.rect(3, 3, 16, 16, DK); p.rect(4, 4, 4, 1, '#a6e2f0'); }
    },
  };
  // 角标：色带、警示条、标签、小锁、铆钉（每种只一个，只在关着的时候画）
  const DECO = [
    null,
    (p, w, h, b) => p.rect(2, Math.round(h * 0.55), w - 4, 2, b[3]),
    (p, w, h) => { for (let x = 1; x < w - 1; x += 4) p.line(x, h - 2, x + 2, h - 4, '#ffd23a'); },
    (p, w, h) => { const cx = Math.round(w / 2), cy = Math.round(h * 0.4); p.rect(cx - 3, cy, 6, 4, '#eef1f8'); p.rect(cx - 2, cy + 1, 4, 1, '#2d3550'); },
    (p, w) => { p.rect(w - 6, 3, 3, 3, '#e3c14a'); p.px(w - 5, 4, DK); },
    (p, w, h) => { for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) p.rect(x, y, 1, 1, '#949fb6'); },
  ];

  // 关、开各一张；initHiArt 时一起画（只画 containers-ext2.js 里新的、还没有图的）
  const h0 = D.initHiArt;
  D.initHiArt = function () {
    const r = h0 ? h0.apply(this, arguments) : undefined;
    for (const k in D.CONT) {
      const C = D.CONT[k];
      if (!C.body || !BODY[C.body] || D.CSPR[k]) continue;
      const [w, h] = SIZE[C.body], a = R[SHADE[Math.floor(hash(k) * SHADE.length)]], b = R[SHADE[Math.floor(hash(k + '·b') * SHADE.length)]];
      const deco = DECO[Math.floor(hash(k + '·c') * DECO.length)];
      const frame = o => { const p = D.Paint(w, h); BODY[C.body](p, o, a, b); if (deco && !o) deco(p, w, h, b); p.outline(); return p.make(2); };
      D.CSPR[k] = [frame(false), frame(true)];
    }
    return r;
  };

  // 材质（决定开箱声和碎屑）、房间（权重低）
  for (const k in D.CONT) {
    const C = D.CONT[k];
    if (!C.body || !MAT[C.body]) continue;
    D.CMAT[k] = MAT[C.body];
    for (const rk of ROOMS[C.body] || []) { const rm = D.ROOMS && D.ROOMS[rk]; if (rm && rm.cont && !rm.cont.some(c => c[0] === k)) rm.cont.push([k, 0.25]); }
  }
})(D);
