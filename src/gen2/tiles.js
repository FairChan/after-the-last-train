/* 站内地图第二代 P5 · 地面材质套 + 墙面分层（design/features/station-gen/plan-p5.md 任务 1；设计文档 5.6 节）
   只对 F.gen2 楼层、D.TUNE.gen2.art 开着时用（G2.artOn）。level.js 的 bake 在这种楼层上不再逐格调 paintFloorTile / paintWallTile，
   改成（随机数照旧一个不少地从父流取，见 G2.burnTiles）：
     G2.planLit(F)        挑亮着的招牌位（灯箱广告、商铺霓虹），推进 F.signs（导向牌会躲开它们）；
     G2.planDeco(F)       导向牌定好以后，按规则挂墙面装饰（消防栓、配电箱、通风口、海报）；
     G2.paintTiles(F, ex, ar) 地面、墙画进共用的像素缓冲（decals.js 的 G2.pixBuf），bake 一次贴到地面大图上。
   地面材质：瓷砖 tile（大厅、售票处、商铺、医务室……）、水磨石 terrazzo（大厅的主通道带、珠宝店、藏品室、金库）、
     水泥 concrete（仓库、维修间、车间、隐藏房、枪械库、门禁房、走廊）、格栅 grate（配电室、机房、控制室机柜周围）、地毯 carpet（控制室、保安室）。
     每种 4 个变体（干净、旧、缺角 / 裂缝、替补砖 / 补丁），按格坐标和站的种子做哈希挑（不耗随机流），人流量大的格（F.wear）偏"旧"。
     颜色从房间配色（D.ROOMS[kind].floor，'theme' 用线路主题染过的 F.th.floor）做出暗 → 亮 7 级色阶（暗部偏墨色、亮部偏暖白），
     每块贴片按"材质 × 变体 × 色阶 × 板缝奇偶"缓存，同一种只画一次；画法同 D.Paint：色阶 + 4×4 点阵抖动、左上亮右下暗。
   收边条：两种材质交界、房间和走廊交界（门洞也是）画一条 2 像素的金属收边（一暗一亮）。墙根、左墙在地面上投一道抖动的阴影。
   墙：立面（下面是地面的墙）从上到下：亮边 + 墙顶檐的阴影、墙面（大厅 / 售票处 / 商铺 / 医务室瓷砖护墙板，仓库 / 走廊等混凝土，
     配电室 / 机房 / 控制室 / 保安室等金属板）、踢脚线。墙顶（其余的墙）很暗、带一点噪点，挨着地面的边一道亮边。
     立面的一头挨着地面（墙到头、门洞两边）画成带倒角的门柱；横墙上的门洞顶上一条门楣。
   P6：站台（kind platform）同大厅：正中一条水磨石带、灯箱广告、消防栓和海报；轨道沟（kind 2）贴 platform.js 的 G2.trackTile。
   F.mat（Uint8Array，每格材质编号 1–5，0 不是地面）、F.floorArt = 'gen2' 给测试和小地图看。新代码不写中文字符串。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, Z = 2, T2 = TS * Z, G2 = D.gen2 = D.gen2 || {};
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16 - 0.5;
  const INK = '#0b0a14', WARM = '#fff1dc';
  const MAT = G2.MAT = { tile: 1, terrazzo: 2, concrete: 3, grate: 4, carpet: 5 }, MAT_NAME = ['', 'tile', 'terrazzo', 'concrete', 'grate', 'carpet'];
  const ROOM_MAT = {
    hall: 1, platform: 1, ticket: 1, shop: 1, medic: 1, canteen: 1, nursery: 1, tents: 1, barter: 1,
    jewelry: 2, gallery: 2, vault: 2,
    storage: 3, workshop: 3, factory: 3, hidden: 3, arsenal: 3, secure: 3, fixshop: 3,
    power: 4, server: 4,
    control: 5, security: 5, radio: 5, gatehouse: 5,
  };
  const FACE_OF = { hall: 'panel', platform: 'panel', ticket: 'panel', shop: 'panel', medic: 'panel', jewelry: 'panel', gallery: 'panel', canteen: 'panel', nursery: 'panel',
    power: 'metal', server: 'metal', control: 'metal', security: 'metal', secure: 'metal', vault: 'metal', radio: 'metal', gatehouse: 'metal' }; // 其余（仓库、维修间、车间、走廊……）混凝土
  G2.artOn = F => !!(F && F.gen2 && D.TUNE.gen2 && D.TUNE.gen2.art !== false && !F.env && !F.open && !F.tower && F.theme !== 'pipe' && !F.cars);

  // ── 颜色
  const mix = (a, b, k) => D.mixHex(a, b, k);
  const packOf = new Map();
  const pack = hex => { let v = packOf.get(hex); if (v == null) { const n = parseInt(hex.slice(1, 7), 16); v = ((255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | ((n >> 16) & 255)) >>> 0; packOf.set(hex, v); } return v; };
  const rampCache = new Map();
  // 一个颜色 → 7 级（暗部偏墨色、亮部偏暖白），存成打包好的像素值
  function ramp(hex) {
    let r = rampCache.get(hex); if (r) return r;
    r = [mix(hex, INK, 0.72), mix(hex, INK, 0.48), mix(hex, INK, 0.24), hex, mix(hex, WARM, 0.16), mix(hex, WARM, 0.34), mix(hex, WARM, 0.56)].map(pack);
    rampCache.set(hex, r); return r;
  }
  const pick = (R, v, x, y) => R[Math.max(0, Math.min(R.length - 1, Math.floor(Math.max(0, Math.min(0.999, v)) * R.length + dith(x, y) * 0.9)))];
  // 整数哈希（不耗随机流）
  const hh = (a, b, c) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  // 噪声查表（P5 提速：贴片第一次画的时候每像素要好几次哈希，进第一站慢）：一张 256×256 的像素噪声、两张平滑值噪声（格距 3、6）
  const NT = 256, NZT = new Float32Array(NT * NT), VNT = {};
  for (let y = 0; y < NT; y++) for (let x = 0; x < NT; x++) NZT[y * NT + x] = (hh(x, y, 91) & 1023) / 1023;
  const vtab = sc => { let a = VNT[sc]; if (a) return a; a = VNT[sc] = new Float32Array(NT * NT); const L = Math.ceil(NT / sc) + 1, g = new Float32Array(L * L); for (let i = 0; i < L * L; i++) g[i] = (hh(i, sc, 17) & 1023) / 1023;
    for (let y = 0; y < NT; y++) for (let x = 0; x < NT; x++) { const gx = x / sc, gy = y / sc, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy; a[y * NT + x] = (g[iy * L + ix] * (1 - fx) + g[iy * L + ix + 1] * fx) * (1 - fy) + (g[(iy + 1) * L + ix] * (1 - fx) + g[(iy + 1) * L + ix + 1] * fx) * fy; }
    return a; };
  const nz = (x, y, s) => NZT[((y + ((s >>> 4) % 192)) & 255) * NT + ((x + ((s >>> 12) % 192)) & 255)]; // 0..1 的像素噪声
  const vnz = (x, y, s, sc) => vtab(sc < 5 ? 3 : 6)[((y + (s % 160)) & 255) * NT + ((x + ((s >>> 8) % 160)) & 255)]; // 平滑一点的值噪声

  // ── 贴片：32×32 的打包像素（Uint32Array），按 key 缓存
  // 贴片先画成"色阶编号图"（每像素 = 第几条色阶 × 8 + 第几级，和配色无关，一种只画一次），再按这一站的配色查表上色（也缓存）。
  //   各站主题色不一样，这样换了主题不用重新算噪声、抖动，只查一次表（P5 提速）
  // 审稿修复 M4 / I2：上了配色的贴片最多存 G2.TILE_CAP 张（两代：新的一代存满一半，就把它当旧的一代、旧的那代整个丢掉；旧一代里又用到的挪回新一代。
  //   常用的一直留着，没再用过的会丢；丢了下次再查表上色，画出来一样）。色阶编号图 CODE 和配色无关，种类是固定的几百种，不封顶
  const CODE = new Map(); let TILE = new Map(), TILE0 = new Map(); G2.TILE_CAP = 1024;
  const SYM = id => [0, 1, 2, 3, 4, 5, 6].map(l => id * 8 + l);
  const FS = SYM(0); FS.alt = SYM(1); FS.acc = 2 * 8; FS.patch = SYM(3); FS.pit = SYM(4); FS.rust = SYM(5); // 地面：本色、替补砖、石子、补丁、格栅底下的坑、锈
  const FIX_INK = 6 * 8, FIX_BURN = 6 * 8 + 1;
  const WS = SYM(0); WS.tl = SYM(1); WS.post = SYM(2); // 立面：墙面、护墙砖、门柱
  const tileOf = (ck, fn, pk, lut) => {
    const key = ck + '#' + pk; let t = TILE.get(key); if (t) return t;
    t = TILE0.get(key);
    if (!t) { let c = CODE.get(ck); if (!c) { c = new Uint8Array(T2 * T2); fn(c); CODE.set(ck, c); } t = new Uint32Array(T2 * T2); for (let i = 0; i < T2 * T2; i++) t[i] = lut[c[i]]; }
    if (TILE.size >= G2.TILE_CAP >> 1) { TILE0 = TILE; TILE = new Map(); }
    TILE.set(key, t); return t;
  };
  const rowsOf = t => { const R = t.rows = new Array(T2); for (let y = 0; y < T2; y++) R[y] = t.subarray(y * T2, y * T2 + T2); return R; };
  const lutOf = (...ramps) => { const L = new Uint32Array(64); ramps.forEach((r, id) => { for (let l = 0; l < 8; l++) L[id * 8 + l] = Array.isArray(r) ? r[Math.min(l, r.length - 1)] : r; }); return L; };
  const P = (t, x, y, c) => { if (x >= 0 && y >= 0 && x < T2 && y < T2) t[y * T2 + x] = c; };
  const line = (t, x0, y0, x1, y1, f) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) f(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), i, n); };
  // 一道裂缝：暗线，右下贴一道亮边（光从左上来）
  function crack(t, R, s, x0, y0, len) {
    let x = x0, y = y0;
    for (let i = 0; i < len; i++) { P(t, x, y, R[0]); P(t, x + 1, y + 1, R[4]); const h = hh(s, i, 7); x += (h & 1) ? 1 : 0; y += (h & 2) ? 1 : (h & 4) ? 0 : 1; if (h % 5 === 0) x -= 1; }
  }

  // 地面贴片：mat 材质编号、R 色阶、v 变体 0–3、par 板缝奇偶（bit0 = 这格是不是一块板的左边，bit1 = 上边）、s 这种贴片自己的种子
  //   ns 一块板（水磨石、水泥）共用的噪声种子：一块 2×2 格的板四格各取噪声场里相邻的一块，板里面看不出格子的接缝
  function paintFloorTile(t, mat, R, v, par, s, ns) {
    const ox = par & 1 ? 0 : 32, oy = par & 2 ? 0 : 32; ns = ns == null ? s : ns;
    if (mat === 1) { // 瓷砖：2×2 块 16 像素的砖，一像素砖缝；砖面左上亮右下暗
      const alt = v === 3 ? (hh(s, 1, 1) & 3) : -1, chip = v === 2 ? (hh(s, 2, 2) & 3) : -1;
      for (let q = 0; q < 4; q++) {
        const sx = (q & 1) * 16, sy = (q >> 1) * 16, RR = q === alt ? R.alt : R, b = ((hh(s, q, 3) & 7) - 3.5) * 0.012;
        for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
          const x = sx + i, y = sy + j;
          if (i === 0 || j === 0) { P(t, x, y, R[1]); continue; }
          let val = 0.5 - 0.1 * (i + j) / 30 + b;
          if (j === 1) val = 0.7; else if (i === 1) val += 0.1; if (i === 15) val = 0.36; if (j === 15) val = 0.32;
          if (v === 1) { const n = nz(x, y, s); if (n > 0.93) val -= 0.18; else if (n < 0.05) val += 0.1; val -= 0.06 * vnz(x, y, s, 9); }
          P(t, x, y, pick(RR, val, x, y));
        }
        if (q === chip) { // 缺一角：露出底下的砂浆，断口亮边
          for (let j = 0; j < 6; j++) for (let i = 0; i < 6 - j; i++) P(t, sx + 15 - i, sy + 15 - j, pick(R, 0.18 + 0.05 * dith(i, j), i, j));
          for (let k = 0; k < 6; k++) P(t, sx + 9 + k, sy + 15 - k, R[5]);
          crack(t, R, s, sx + 3, sy + 2, 10);
        }
      }
    } else if (mat === 2) { // 水磨石：一块 2×2 格的大板，板缝；石面有碎石子、斜着的一道抛光
      for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) {
        let val = 0.5 + 0.08 * (vnz(x + ox, y + oy, ns, 6) - 0.5) - 0.05 * (x + y + ox + oy) / 126;
        const sh = ((x + y + ox + oy) % 64); if (sh > 40 && sh < 47) val += v === 1 ? 0.16 : 0.08;
        const n = nz(x + ox, y + oy, ns + 5);
        let c = pick(R, val, x, y);
        if (n > 0.965) c = R[6]; else if (n > 0.94) c = R[5]; else if (n < 0.025) c = R[1]; else if (n < 0.04) c = R.acc;
        P(t, x, y, c);
      }
      if (par & 1) for (let y = 0; y < T2; y++) { P(t, 0, y, R[1]); P(t, 1, y, R[4]); }
      if (par & 2) for (let x = 0; x < T2; x++) { P(t, x, 0, R[1]); P(t, x, 1, R[4]); }
      if (v === 1) for (let k = 0; k < 5; k++) { const h = hh(s, k, 9), x0 = 3 + (h & 15), y0 = 4 + ((h >> 4) & 15); line(t, x0, y0, x0 + 5 + ((h >> 8) & 3), y0 + 1, (x, y) => P(t, x, y, R[5])); } // 磨出来的细划痕
      if (v === 2) crack(t, R, s, 4 + (hh(s, 3, 3) & 7), 3, 26);
      if (v === 3) { const x0 = 6 + (hh(s, 4, 4) & 7), y0 = 7 + (hh(s, 5, 5) & 7), w = 12, h = 9; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P(t, x, y, pick(R.patch, 0.45 + 0.1 * (nz(x, y, s) - 0.5) + (y === y0 || x === x0 ? 0.2 : 0) - (y === y0 + h - 1 || x === x0 + w - 1 ? 0.2 : 0), x, y)); }
    } else if (mat === 3) { // 水泥：2×2 格一块，锯缝；斑驳、气孔
      for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) {
        let val = 0.46 + 0.14 * (vnz(x + ox, y + oy, ns, 7) - 0.5) + 0.06 * (vnz(x + ox, y + oy, ns + 3, 3) - 0.5) - 0.04 * (x + y + ox + oy) / 126;
        const n = nz(x + ox, y + oy, ns + 9); let c = pick(R, val, x, y); if (n > 0.975) c = R[1]; else if (n < 0.012) c = R[4];
        P(t, x, y, c);
      }
      if (par & 1) for (let y = 0; y < T2; y++) { P(t, 0, y, R[0]); P(t, 1, y, R[4]); }
      if (par & 2) for (let x = 0; x < T2; x++) { P(t, x, 0, R[0]); P(t, x, 1, R[4]); }
      if (v === 1) { const cx = 10 + (hh(s, 6, 6) & 11), cy = 10 + (hh(s, 7, 7) & 11), rx = 7 + (hh(s, 8, 8) & 3), ry = 5 + (hh(s, 9, 9) & 2); // 油渍
        for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) { const d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d > 1 || dith(x, y) + 0.5 < (d - 0.6) / 0.4) continue; P(t, x, y, pick(R, 0.2 - 0.1 * (1 - d), x, y)); } }
      if (v === 2) crack(t, R, s, 2 + (hh(s, 3, 3) & 7), 2, 30);
      if (v === 3) { const x0 = 4 + (hh(s, 4, 4) & 7), y0 = 5 + (hh(s, 5, 5) & 7), w = 14, h = 10; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P(t, x, y, pick(R, 0.56 + 0.06 * (nz(x, y, s) - 0.5) + (y === y0 || x === x0 ? 0.18 : 0) - (y === y0 + h - 1 || x === x0 + w - 1 ? 0.2 : 0), x, y)); }
    } else if (mat === 4) { // 格栅：一格一块，外框倒角，底下是黑的坑，横条上亮下暗
      if (v === 3) { // 盖着的花纹钢板
        for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) { const d = ((x + y) % 6 === 0 && (x % 6) < 3) || ((x - y + 64) % 6 === 0 && (x % 6) >= 3); P(t, x, y, pick(R, (d ? 0.66 : 0.42) - 0.08 * (x + y) / 62, x, y)); }
      } else {
        for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) P(t, x, y, pick(R.pit, 0.3 + 0.15 * (vnz(x, y, s, 5) - 0.5), x, y));
        const RB = v === 1 ? R.rust : R, gone = v === 2 ? 2 + (hh(s, 3, 3) % 4) : -1;
        for (let k = 0; k < 6; k++) { if (k === gone) continue; const y = 3 + k * 5; for (let x = 2; x < 30; x++) { P(t, x, y, pick(RB, 0.86, x, y)); P(t, x, y + 1, pick(RB, 0.52 - 0.1 * x / 30, x, y + 1)); P(t, x, y + 2, R[0]); } }
        for (const x of [10, 21]) for (let y = 2; y < 30; y++) if ((y - 3) % 5 > 1) P(t, x, y, pick(RB, 0.34, x, y)); // 竖着的两根托条
        if (gone >= 0) { const y = 3 + gone * 5; P(t, 3, y, R[4]); P(t, 4, y + 1, R[3]); P(t, 28, y, R[4]); P(t, 27, y - 1, R[3]); } // 断掉的那根留两截
      }
      for (let i = 0; i < T2; i++) { P(t, i, 0, R[5]); P(t, i, 1, R[3]); P(t, 0, i, R[4]); P(t, 1, i, R[3]); P(t, i, 31, R[0]); P(t, i, 30, R[1]); P(t, 31, i, R[1]); P(t, 30, i, R[2]); }
    } else { // 地毯：细的织纹，每 4 行一道暗纹；旧的中间磨浅、有污渍、烫痕
      for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) {
        let val = 0.45 + ((x + y) & 1 ? 0.05 : -0.05) + ((y & 3) === 0 ? -0.06 : 0) + 0.05 * (vnz(x, y, s, 8) - 0.5);
        if (v === 1) val += 0.12 * Math.max(0, 1 - Math.hypot(x - 16, y - 16) / 18);
        P(t, x, y, pick(R, val, x, y));
      }
      if (v === 2) { const cx = 9 + (hh(s, 6, 6) & 15), cy = 9 + (hh(s, 7, 7) & 15); for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 8; x <= cx + 8; x++) { const d = Math.hypot((x - cx) / 8, (y - cy) / 6); if (d < 1 && dith(x, y) + 0.5 > d * 0.8) P(t, x, y, pick(R, 0.18, x, y)); } }
      if (v === 3) { const cx = 10 + (hh(s, 6, 6) & 11), cy = 10 + (hh(s, 7, 7) & 11); for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) { const d = Math.hypot(x - cx, y - cy); if (d < 2) P(t, x, y, FIX_INK); else if (d < 3.4) P(t, x, y, FIX_BURN); } }
    }
  }

  // 立面贴片：face 墙面种类、R 色阶、v 变体 0–2、ls / rs 左右挨着什么（0 接着是立面，1 地面 = 墙到头画门柱，2 墙顶 = 内角压暗）、par 横向奇偶
  function paintFaceTile(t, face, R, v, ls, rs, par, s) {
    for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) {
      let c;
      if (y === 0) c = R[5]; // 墙顶檐：一道亮边
      else if (y === 1) c = R[2];
      else if (y < 4) c = pick(R, 0.08 + 0.06 * (y - 2), x, y); // 檐下的阴影
      else if (y >= 27) c = y === 27 ? R[4] : y === 31 ? R[0] : pick(R, 0.2, x, y); // 踢脚线
      else if (face === 'panel') {
        if (y < 13) c = pick(R, 0.56 - 0.1 * (y - 4) / 9 + 0.04 * (1 - x / 32) + 0.04 * (vnz(x, y, s, 6) - 0.5), x, y); // 上半截刷漆的墙
        else if (y === 13) c = R.tl[5]; else if (y === 14) c = R[1];
        else { // 下半截瓷砖护墙板：8×6 的小釉面砖
          const ty = (y - 15) % 6, tx = (x + (((y - 15) / 6 | 0) & 1) * 4) % 8;
          if (ty === 5 || tx === 7) c = R[1];
          else c = pick(R.tl, ty === 0 ? 0.86 : tx === 0 ? 0.62 : tx === 6 || ty === 4 ? 0.3 : 0.5 - 0.04 * ty, x, y);
        }
      } else if (face === 'metal') { // 金属板：16 像素一块，左亮右暗，拉丝竖纹，四角铆钉，中间一道横缝
        const k = x & 15; let val = 0.5 - 0.14 * (y - 4) / 22 + ((x & 1) ? 0.025 : -0.025);
        if (k === 0) val = 0.78; else if (k === 15) val = 0.2; if (y === 15) val = 0.14; if (y === 16) val = 0.72;
        c = pick(R, val, x, y);
        if ((k === 3 || k === 12) && (y === 6 || y === 24)) c = R[6]; else if ((k === 4 || k === 13) && (y === 7 || y === 25)) c = R[1];
      } else { // 混凝土：斑驳，两排对拉螺栓孔，一道浇筑缝
        let val = 0.48 + 0.14 * (vnz(x, y, s, 6) - 0.5) - 0.12 * (y - 4) / 22;
        if (y === 15) val -= 0.1;
        c = pick(R, val, x, y);
        for (const [hx, hy] of [[8, 9], [24, 9], [8, 21], [24, 21]]) { if ((x === hx || x === hx + 1) && (y === hy || y === hy + 1)) c = R[0]; else if (x === hx + 2 && y === hy + 2) c = R[5]; }
      }
      t[y * T2 + x] = c;
    }
    if (face === 'concrete' && !(par & 1)) for (let y = 4; y < 27; y++) { t[y * T2] = R[1]; t[y * T2 + 1] = R[4]; }
    if (v === 1) for (const sx of [5 + (hh(s, 1, 1) % 18), 9 + (hh(s, 2, 2) % 18)]) for (let y = 3; y < 27; y++) if (dith(sx, y) + 0.5 < 0.85 - (y - 3) / 30) { t[y * T2 + sx] = pick(R, 0.14, sx, y); if (y > 8 && (y & 1)) t[y * T2 + sx + 1] = pick(R, 0.2, sx + 1, y); } // 往下流的水痕
    if (v === 2) { const cx = 8 + (hh(s, 3, 3) % 16), cy = face === 'panel' ? 20 : 12; // 掉了一块：露出暗的里子，断口上边亮
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) { const d = Math.hypot((x - cx) / 4, (y - cy) / 3); if (d > 1) continue; t[y * T2 + x] = d > 0.75 && y < cy ? R[5] : pick(R, 0.1 + 0.1 * d, x, y); }
      crack(t, R, s, cx + 3, cy + 2, 7);
    }
    // 两头：挨着地面画门柱（带倒角的一根方柱），挨着墙顶（内角）压一道暗
    for (const [side, st] of [[0, ls], [1, rs]]) {
      if (!st) continue;
      for (let y = 0; y < T2; y++) for (let k = 0; k < 5; k++) {
        const x = side ? T2 - 1 - k : k;
        if (st === 1) { const val = side ? [0.08, 0.2, 0.34, 0.44, 0.5][k] : [0.92, 0.74, 0.6, 0.5, 0.16][k]; t[y * T2 + x] = pick(R.post, y === 0 ? 0.95 : y === 31 ? 0.08 : val - 0.1 * y / 32, x, y); }
        else if (k < 3 && dith(x, y) + 0.5 < (3 - k) / 4) t[y * T2 + x] = R[0];
      }
    }
  }
  // 墙顶贴片：很暗、带噪点；n / w / e 这一边挨着地面就画一道亮边（左、上亮，右暗一点）
  function paintTopTile(t, R, n, w, e, s) {
    for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) t[y * T2 + x] = pick(R, 0.22 + 0.1 * (vnz(x, y, s, 5) - 0.5) + (nz(x, y, s) > 0.97 ? 0.15 : 0), x, y);
    for (let i = 0; i < T2; i++) {
      if (n) { t[i] = R[6]; t[T2 + i] = R[4]; t[2 * T2 + i] = R[3]; }
      if (w) { t[i * T2] = R[5]; t[i * T2 + 1] = R[3]; t[i * T2 + 2] = R[2]; }
      if (e) { t[i * T2 + 31] = R[4]; t[i * T2 + 30] = R[2]; t[i * T2 + 29] = R[2]; }
    }
  }

  // ── 每格的材质（F.mat）：按房间种类；大厅沿长边正中一条 3–4 格宽的主通道带换水磨石；控制室的机柜周围一圈换格栅
  function planMat(F) {
    const W = F.tw, H = F.tht, N = W * H, mat = F.mat = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (F.kind[i] !== 0) continue;
      const ri = F.room[i], r = ri >= 0 ? F.rooms[ri] : null;
      mat[i] = r ? ROOM_MAT[r.kind] || 1 : 3;
    }
    for (const r of F.rooms) {
      if (r.kind === 'hall' || r.kind === 'platform') { // P6：站台正中（那排柱子）也是一条水磨石带
        const horiz = r.w >= r.h, bw = (horiz ? r.h : r.w) >= 12 ? 4 : 3, c0 = Math.floor((horiz ? r.y + r.h / 2 : r.x + r.w / 2) - bw / 2);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          const i = y * W + x, a = horiz ? y : x; if (F.room[i] === r.i && F.kind[i] === 0 && a >= c0 && a < c0 + bw) mat[i] = 2;
        }
      } else if (r.kind === 'control') {
        for (const p of F.props) {
          if (p.kind !== 'cabinet' && p.kind !== 'machine') continue;
          const px = Math.floor(p.x / TS), py = Math.floor((p.y - 1) / TS);
          for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const x = px + a, y = py + b; if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x; if (F.room[i] === r.i && F.kind[i] === 0) mat[i] = 4; }
        }
      }
    }
    return mat;
  }
  // 色阶：每格的底色（房间配色，'theme' 和走廊用主题色），再按材质往石头 / 水泥 / 钢 / 布的方向调
  const MAT_TINT = { 2: ['#8a8274', 0.2], 3: ['#4e4f52', 0.35], 4: ['#3a4458', 0.4] };
  function floorPal(F, i, m) {
    const ri = F.room[i], r = ri >= 0 ? F.rooms[ri] : null, RD = r && D.ROOMS[r.kind];
    let base = RD && RD.floor !== 'theme' && RD.floor ? RD.floor[0] : (F.th.floor && F.th.floor[0]) || '#2b2e44';
    if (MAT_TINT[m]) base = mix(base, MAT_TINT[m][0], MAT_TINT[m][1]);
    if (m === 5) base = mix(base, r && r.kind === 'security' ? '#5a2430' : r && r.kind === 'control' ? '#24406a' : '#3a2a50', 0.45);
    const key = 'p' + m + base;
    let lut = rampCache.get(key);
    if (!lut) {
      lut = lutOf(ramp(base), ramp(mix(base, (hh(base.length, m, 1) & 1) ? '#6a7a8a' : '#8a7a62', 0.28)), pack(mix(base, '#c89a62', 0.45)), // 本色、替补砖（色相差一点）、水磨石里的暖色石子
        ramp(mix(base, '#5a5850', 0.45)), ramp(mix(INK, base, 0.25)), ramp(mix(base, '#8a4a28', 0.55)), [pack(INK), pack('#4a2a18')]); // 补丁、坑、锈、烫痕
      lut.hi = lut.map((c, q) => (q >> 3) < 6 ? lut[(q & ~7) | Math.min(6, (q & 7) + 1)] : c); // 走旧的路：同一张图整体亮一级（磨亮了）
      rampCache.set(key, lut);
    }
    return { lut, key };
  }
  function facePal(F, kind) {
    const face = FACE_OF[kind] || 'concrete', f0 = (F.th.face && F.th.face[0]) || '#2c2b30';
    const base = face === 'metal' ? mix(f0, '#4c5c86', 0.42) : face === 'panel' ? mix(f0, '#5a6274', 0.18) : mix(f0, '#5a5650', 0.32);
    const tl = mix(base, kind === 'medic' ? '#c8dce0' : kind === 'shop' || kind === 'jewelry' ? '#a88a9a' : '#8a9aaa', 0.4), key = 'w' + face + base + tl;
    let o = rampCache.get(key);
    if (!o) { const R = ramp(base), T = ramp(tl), PO = ramp(mix(base, '#7a8090', 0.3)); o = { face, key, lut: lutOf(R, T, PO), post: PO }; rampCache.set(key, o); }
    return o;
  }
  const TOP_LUT = () => rampCache.get('top') || (rampCache.set('top', lutOf(ramp('#1a1c2a'))), rampCache.get('top'));
  const TOP_R = () => rampCache.get('topR') || (rampCache.set('topR', ramp('#1a1c2a')), rampCache.get('topR'));

  // ── 亮着的招牌（灯箱广告、商铺霓虹）：数目和旧画法差不多（旧画法每 9 个立面一块霓虹；这里大厅、商铺、售票处、走廊的立面上挑，隔开 ≥ 8 格）
  G2.planLit = function (F, nOld) {
    const W = F.tw, H = F.tht, k = F.kind, out = F.wallLit = [];
    const faceAt = (x, y) => x >= 0 && y >= 1 && x < W && y < H - 1 && k[y * W + x] === 1 && k[(y + 1) * W + x] === 0;
    const near = (x, y) => F.stairs.some(s => Math.abs(Math.floor(s.x / TS) - x) <= 2 && Math.abs(Math.floor(s.y / TS) - y) <= 3);
    const ok = (x, y) => faceAt(x, y) && !F.solid[(y + 1) * W + x] && !near(x, y) && faceAt(x - 1, y) && faceAt(x + 1, y);
    const cand = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!ok(x, y)) continue;
      const ri = F.room[(y + 1) * W + x], kind = ri >= 0 ? (G2.roomKind ? G2.roomKind(F, F.rooms[ri]) : F.rooms[ri].kind) : 'corr'; // P6：旧骨架楼层（dress.js）按对照的种类挑
      if ((kind === 'hall' || kind === 'platform') && ok(x + 1, y)) cand.push({ x, y, kind: 'billboard', w: 2, h: hh(x, y, F.tw) });
      else if (kind === 'shop' || kind === 'jewelry' || kind === 'ticket') cand.push({ x, y, kind: 'neon', w: 1, h: hh(x, y, F.tht) });
      else if (kind === 'corr' && (hh(x, y, 5) & 3) === 0) cand.push({ x, y, kind: 'billboard', w: ok(x + 1, y) ? 2 : 1, h: hh(x, y, 9) });
    }
    cand.sort((a, b) => a.h - b.h || a.y - b.y || a.x - b.x);
    const want = Math.max(2, Math.round((nOld || 6) * 0.75)), th = F.th;
    for (const c of cand) {
      if (out.length >= want) break;
      if (out.some(o => o.y === c.y && Math.abs(o.x - c.x) < 8) || out.some(o => Math.abs(o.y - c.y) <= 1 && Math.abs(o.x - c.x) < 3)) continue;
      const col = th.neon[c.h % th.neon.length]; c.col = col; out.push(c);
      c.refs = [{ x: (c.x + c.w / 2) * TS, y: c.y * TS + 6, col, deco: c.kind }]; F.signs.push(c.refs[0]);
      if (c.w === 2) { c.refs.push({ x: c.x * TS + 8, y: c.y * TS + 6, col, nolight: true, deco: 'slot' }); F.signs.push(c.refs[1]); } // 左半块只占位（导向牌、灯具躲开），不加灯
    }
    return out;
  };
  // 审稿修复 I3：封死的出口（planWayfinding）定好以后，撤掉压在出口格、出口两边那格、出口上面一排（出口牌）上的灯箱 / 霓虹（连同 F.signs 里它的灯和占位），
  //   不然出口的图盖住了招牌，招牌的灯管还留在发光层里、两格的灯箱只剩半块
  G2.litOffExits = function (F) {
    const ex = F.exits || []; if (!ex.length || !F.wallLit || !F.wallLit.length) return 0;
    const hit = (x, y) => ex.some(e => x >= e.x - 1 && x <= e.x + e.w && y >= e.y - 1 && y < e.y + e.h);
    const drop = F.wallLit.filter(s => { for (let a = 0; a < s.w; a++) if (hit(s.x + a, s.y)) return true; return false; });
    if (!drop.length) return 0;
    const refs = new Set(); for (const s of drop) for (const r of s.refs || []) refs.add(r);
    F.wallLit = F.wallLit.filter(s => !drop.includes(s)); F.signs = F.signs.filter(s => !refs.has(s));
    return drop.length;
  };
  // ── 墙面装饰（导向牌、出口定好以后）：消防栓隔 12–16 格一个（大厅、走廊）、配电箱挂在配电室门口、通风口隔 7–9 格（走廊）、海报隔 5–8 格（大厅、商铺、售票处、医务室）
  G2.planDeco = function (F) {
    const W = F.tw, H = F.tht, k = F.kind, out = F.wallDeco = [], used = new Uint8Array(W * H);
    for (const s of F.wallLit || []) for (let a = 0; a < s.w; a++) used[s.y * W + s.x + a] = 1;
    for (const s of F.wayfind || []) used[s.ty * W + s.tx] = 1;
    for (const g of F.gateSigns || []) used[g.ty * W + g.tx] = 1;
    for (const e of F.exits || []) for (let y = e.y - 1; y <= e.y + e.h; y++) for (let x = e.x - 1; x <= e.x + e.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) used[y * W + x] = 1;
    const faceAt = (x, y) => x >= 0 && y >= 1 && x < W && y < H - 1 && k[y * W + x] === 1 && k[(y + 1) * W + x] === 0;
    const near = (x, y) => F.stairs.some(s => Math.abs(Math.floor(s.x / TS) - x) <= 2 && Math.abs(Math.floor(s.y / TS) - y) <= 3);
    const free = (x, y) => faceAt(x, y) && !used[y * W + x] && !F.solid[(y + 1) * W + x] && !near(x, y) && faceAt(x - 1, y) && faceAt(x + 1, y);
    const put = (x, y, kind) => { out.push({ x, y, kind, h: hh(x, y, 77) }); used[y * W + x] = 1; };
    // 配电箱：配电室的门洞旁边那格立面
    for (const d of F.doors || []) {
      const r = F.rooms[d.room]; if (!r || r.kind !== 'power' || d.h !== 1) continue;
      for (const x of [d.x + d.w, d.x - 1]) if (free(x, d.y)) { put(x, d.y, 'ebox'); break; }
    }
    // 一排排立面（下面同一个空间）按间隔挂
    for (let y = 1; y < H - 1; y++) {
      let run = [], key = null;
      const flush = () => {
        if (run.length >= 5) {
          const kind = key < 0 ? 'corr' : G2.roomKind ? G2.roomKind(F, F.rooms[key]) : F.rooms[key].kind, h0 = hh(run[0], y, 3);
          const rules = kind === 'hall' || kind === 'platform' ? [['hydrant', 12 + h0 % 5, 3 + (h0 >> 3) % 4], ['poster', 5 + (h0 >> 5) % 4, 1 + (h0 >> 7) % 3]]
            : kind === 'corr' ? [['hydrant', 12 + h0 % 5, 5 + (h0 >> 3) % 4], ['vent', 7 + (h0 >> 5) % 3, 2 + (h0 >> 7) % 3]]
            : kind === 'shop' || kind === 'ticket' || kind === 'medic' || kind === 'security' ? [['poster', 5 + (h0 >> 5) % 4, 2 + (h0 >> 7) % 3]] : [];
          for (const [dk, step, off] of rules) for (let q = off; q < run.length; q += step) { let x = run[q]; if (!free(x, y)) { if (free(x + 1, y)) x++; else continue; } put(x, y, dk); }
        }
        run = []; key = null;
      };
      for (let x = 0; x <= W; x++) {
        const f = x < W && faceAt(x, y), ri = f ? F.room[(y + 1) * W + x] : null;
        if (f && (key === null || ri === key)) { run.push(x); key = ri; continue; }
        flush(); if (f) { run.push(x); key = ri; }
      }
    }
    return out;
  };

  // ── 墙面装饰的图（画板画：色阶、倒角、描黑边；发光的像素另出一张，进发光层）
  const DECO = new Map();
  function decoSprite(kind, col, v) {
    const key = kind + '|' + col + '|' + v; let s = DECO.get(key); if (s) return s;
    const RR = D.RAMP, w = kind === 'billboard2' ? 60 : 28, h = kind === 'billboard2' || kind === 'billboard' ? 18 : kind === 'vent' ? 10 : kind === 'poster' ? 20 : 22, cr = c => [D.mixHex(c, '#000000', 0.7), D.mixHex(c, '#000000', 0.45), D.mixHex(c, '#000000', 0.2), c, D.mixHex(c, '#ffffff', 0.3), D.mixHex(c, '#ffffff', 0.6)];
    const p = D.Paint(w, h);
    if (kind === 'hydrant') { p.box(4, 0, 20, 22, RR.red, { r: 1, v: 0.55 }); p.box(7, 3, 14, 12, RR.glass, { v: 0.45 }); p.ell(14, 9, 4.5, 4.5, RR.red, {}); p.ell(14, 9, 1.8, 1.8, RR.dark, { flat: true }); p.rect(7, 17, 14, 2, '#dde1ee'); p.px(8, 4, '#a6e2f0'); p.px(9, 4, '#a6e2f0'); }
    else if (kind === 'ebox') { p.box(5, 2, 18, 20, RR.gunmetal, { r: 1, v: 0.6 }); p.rect(14, 4, 1, 16, '#161a2a'); p.box(9, 7, 6, 6, RR.yellow, { v: 0.7 }); p.px(12, 8, '#2a1c06'); p.px(12, 9, '#2a1c06'); p.px(12, 11, '#2a1c06'); p.box(12, 0, 4, 3, RR.steel, {}); p.px(19, 14, '#8dff6a', 1); }
    else if (kind === 'vent') { p.box(3, 0, 22, 10, RR.gunmetal, { r: 1, v: 0.55 }); for (let j = 2; j < 9; j += 2) { p.rect(5, j, 18, 1, '#0c0e17'); p.rect(5, j + 1, 18, 1, '#646e86'); } }
    else if (kind === 'poster') { const R2 = cr(col), x0 = 4 + (v % 3) * 3; p.box(x0, 0, 15, 20, RR.white, { v: 0.62 }); p.box(x0 + 2, 2, 11, 9, R2, { v: 0.5 }); p.ell(x0 + 7, 6, 2.5, 2.5, RR.yellow, { flat: true }); p.rect(x0 + 2, 13, 9, 1, '#555d7a'); p.rect(x0 + 2, 15, 6, 1, '#848ca8'); if (v & 1) { p.px(x0 + 14, 19, null); p.line(x0 + 11, 19, x0 + 14, 16, '#848ca8'); } }
    else { // 灯箱广告 / 商铺霓虹：钢框里一块发光的画（只有图形，不写字）
      const R2 = cr(col), W2 = kind === 'neon' ? 26 : w - 2;
      p.box(1, 0, W2, h, RR.gunmetal, { r: 1, v: 0.5 });
      if (kind === 'neon') { p.rect(3, 2, W2 - 4, h - 4, '#0d0e18'); for (let i = 0; i < 3; i++) p.rect(4 + i * 7 + (v % 3), 5 + (i & 1) * 4, 6, 2, R2[4], 1); p.rect(3, h - 3, W2 - 4, 1, R2[2], 1); }
      else { p.grad(3, 2, W2 - 4, h - 4, R2); p.rect(3, 2, W2 - 4, 1, R2[5], 1); p.ell(3 + (W2 - 4) * (0.3 + (v % 3) * 0.15), h / 2, 4, 4, cr('#fff3dc'), { emit: true, flat: true }); p.rect(3, h - 5, W2 - 4, 2, R2[1]); for (let i = 0; i < 3; i++) p.rect(6 + i * 6 + (v & 3), h - 8 - i, 3, 1 + i, '#0d0e18'); } // 灯箱：画面本身不进发光层（不然泛光糊成一块白），只有顶上的灯管和画里的亮点发光
    }
    p.outline();
    const px = new Uint32Array(w * h), [ec, ecx] = D.canvas(w, h), em = ecx.createImageData(w, h); let any = false;
    for (let i = 0; i < w * h; i++) { const c = p.col[i]; if (!c) continue; px[i] = pack(c); if (p.em[i]) { const n = parseInt(c.slice(1, 7), 16), q = i * 4; em.data[q] = (n >> 16) & 255; em.data[q + 1] = (n >> 8) & 255; em.data[q + 2] = n & 255; em.data[q + 3] = 255; any = true; } }
    if (any) ecx.putImageData(em, 0, 0);
    s = { w, h, px, emit: any ? ec : null }; DECO.set(key, s); return s;
  }

  const SH_TOP = [], SH_LEFT = []; // 墙投在地面上的阴影（格内像素、浓淡），抖动渐淡
  for (let y = 0; y < 6; y++) for (let x = 0; x < T2; x++) { const a = 0.55 * (1 - y / 6); if (dith(x, y) + 0.5 < a + 0.25) SH_TOP.push([x, y, a]); }
  for (let y = 0; y < T2; y++) for (let x = 0; x < 4; x++) { const a = 0.42 * (1 - x / 4); if (dith(x, y) + 0.5 < a + 0.3) SH_LEFT.push([x, y, a]); }
  // ── 画：地面、墙进共用的像素缓冲（打包像素直接拷），收边、阴影、门楣、裂缝墙、装饰混进去；level.js 的 bake 随后一次贴上
  // defer（审稿修复，提速）：表面痕迹、贴花接着画进这块（不透明的）缓冲，bake 最后一次直接贴（中间不先贴、不清缓冲）
  G2.paintTiles = function (F, ex, ar, defer) {
    const W = F.tw, H = F.tht, N = W * H, k = F.kind, W2 = F.w * Z, H2 = F.h * Z, seed = (F.p4 ? F.p4.s : hh(W, H, 1)) >>> 0;
    const PB = G2.pixBuf(W2, H2, !!defer), SW = PB.SW, u32 = PB.u32, buf = PB.buf;
    const mat = planMat(F), wf = F._wf, lv = wf ? wf.lv : null;
    // 审稿修复（提速）：这一层里同一房间、同一材质的配色只算一次，同样的贴片按编号查（不再每格拼字符串、新建画法函数）
    const loc = new Map(), pc = new Map(), wc = new Map(); let pid = 0;
    const palF = (i, m) => { const q = (F.room[i] + 1) * 8 + m; let o = pc.get(q); if (!o) { o = Object.assign({ id: pid++ }, floorPal(F, i, m)); pc.set(q, o); } return o; };
    const palW = kind => { let o = wc.get(kind); if (!o) { o = Object.assign({ id: pid++ }, facePal(F, kind)); wc.set(kind, o); } return o; };
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : k[y * W + x];
    const flo = (x, y) => at(x, y) === 0;
    const blit = (t, cx, cy) => { let o = cy * T2 * SW + cx * T2; const R = t.rows || rowsOf(t); for (let y = 0; y < T2; y++, o += SW) u32.set(R[y], o); }; // 审稿修复（提速）：一行一次 set（贴片上存好每行的视图）
    const blend = (px, py, c, a) => { const o = (py * SW + px) * 4, r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; buf[o] = r * a + buf[o] * (1 - a); buf[o + 1] = g * a + buf[o + 1] * (1 - a); buf[o + 2] = b * a + buf[o + 2] * (1 - a); };
    const SHADE = pack('#05040c');
    const TR = TOP_R(), TL = TOP_LUT(), DEEP = pack(G2.DEEP_COL);
    const near = new Uint8Array(W * H), nr2 = new Uint8Array(W * H); // 离地面 ≤ 2 格（先横着、再竖着往外扩两格）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (k[y * W + x] === 0) for (let a = -2; a <= 2; a++) { const xx = x + a; if (xx >= 0 && xx < W) near[y * W + xx] = 1; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (near[y * W + x]) for (let b = -2; b <= 2; b++) { const yy = y + b; if (yy >= 0 && yy < H) nr2[yy * W + x] = 1; }
    const deep = (tx, ty) => !nr2[ty * W + tx], blk = (tx, ty) => ((ty * T2) >> 6) * PB.BW + ((tx * T2) >> 6);
    const trk = !!(F.track && G2.trackTile);
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (!deep(tx, ty) || (trk && k[ty * W + tx] === 2)) PB.dirty[blk(tx, ty)] = 1; // 只贴有东西的块（先记好，深处的格只在要贴的块里才写底色，不往缓冲里留东西）
    PB.fill = DEEP; PB.opaque = !!defer; // 审稿修复 I1：贴的外框里没画的块铺成墙里深处的颜色（pixFlush），画布上一个透明像素都不留
    // 审稿修复（提速）：要贴的外框（脏块的范围）里，离地面两格以外的墙格一排排连着铺底色（一行像素一次 fill），外框里的块都算脏（pixFlush 不用再补）
    { const BW = PB.BW, D8 = PB.dirty; let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
      for (let b = 0; b < D8.length; b++) if (D8[b]) { const bx = b % BW, by = (b / BW) | 0; if (bx < bx0) bx0 = bx; if (by < by0) by0 = by; if (bx > bx1) bx1 = bx; if (by > by1) by1 = by; }
      if (bx1 >= 0) {
        for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) D8[by * BW + bx] = 1;
        const tx0 = (bx0 * 64) / T2, tx1 = Math.min(W - 1, ((bx1 + 1) * 64) / T2 - 1), ty0 = (by0 * 64) / T2, ty1 = Math.min(H - 1, ((by1 + 1) * 64) / T2 - 1);
        for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
          if (!deep(tx, ty) || (trk && k[ty * W + tx] === 2)) continue;
          let te = tx; while (te + 1 <= tx1 && deep(te + 1, ty) && !(trk && k[ty * W + te + 1] === 2)) te++;
          const o = ty * T2 * SW + tx * T2, n = (te - tx + 1) * T2; for (let y = 0; y < T2; y++) u32.fill(DEEP, o + y * SW, o + y * SW + n);
          tx = te;
        }
      } }
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const i = ty * W + tx, kk = k[i];
      if (kk === 0) { // 地面
        const m = mat[i], fp = palF(i, m), h = hh(tx, ty, seed), worn = lv && lv[i] >= 2;
        let v = h % 100; v = worn ? (v < 45 ? 1 : v < 55 ? 0 : v < 72 ? 2 : v < 80 ? 3 : 1) : (v < 58 ? 0 : v < 76 ? 1 : v < 88 ? 2 : 3);
        const par = m === 2 || m === 3 ? ((tx & 1) ? 0 : 1) | ((ty & 1) ? 0 : 2) : 0, vs = (h >>> 8) & 1; // vs：同一变体再分 2 种样子
        const n = ((fp.id * 2 + (worn ? 1 : 0)) * 256) + (((m * 4 + v) * 4 + par) * 2 + vs); let t = loc.get(n);
        if (!t) { t = tileOf('f' + m + '|' + v + '|' + par + '|' + vs, q => paintFloorTile(q, m, FS, v, par, hh(m, v, vs + 7), hh(m, 3, 5)), worn ? fp.key + '^' : fp.key, worn ? fp.lut.hi : fp.lut); loc.set(n, t); }
        blit(t, tx, ty); // 人流量大的格亮一级（P5：暗的大厅里也看得出走旧的路）
      } else if (kk === 2) { if (trk) blit(G2.trackTile(F, tx, ty), tx, ty); else if (PB.dirty[blk(tx, ty)]) { const o = ty * T2 * SW + tx * T2; for (let y = 0; y < T2; y++) u32.fill(DEEP, o + y * SW, o + y * SW + T2); } continue; } // P6：站台层的轨道沟（platform.js 的贴片）
      else if (flo(tx, ty + 1)) { // 立面
        const ri = F.room[i + W], kind = ri >= 0 ? F.rooms[ri].kind : 'corr', wp = palW(kind), face = wp.face;
        const side = x => flo(x, ty) ? 1 : !flo(x, ty + 1) ? 2 : 0, ls = side(tx - 1), rs = side(tx + 1), h = hh(tx, ty, seed + 1), v = h % 100 < 70 ? 0 : h % 100 < 88 ? 1 : 2;
        const par = face === 'concrete' ? tx & 1 : 0, vs = 0;
        const n = 1e6 + wp.id * 256 + ((v * 9 + ls * 3 + rs) * 2 + par); let t = loc.get(n);
        if (!t) { t = tileOf('w' + face + '|' + v + '|' + ls + rs + '|' + par + '|' + vs, q => paintFaceTile(q, face, WS, v, ls, rs, par, hh(v, ls * 3 + rs, vs)), wp.key, wp.lut); loc.set(n, t); }
        blit(t, tx, ty);
      } else { // 墙顶
        if (deep(tx, ty)) continue; // 离地面两格以外的墙里：一块平的暗色（和画布底色一样，上面一排排铺好了；外框外面整块都是这种格的不贴）
        const n = flo(tx, ty - 1), w = flo(tx - 1, ty), e = flo(tx + 1, ty), vs = hh(tx, ty, seed + 2) & 1, q = 2e6 + ((+n) * 4 + (+w) * 2 + (+e)) * 2 + vs; let t = loc.get(q);
        if (!t) { t = tileOf('t' + (+n) + (+w) + (+e) + '|' + vs, z => paintTopTile(z, SYM(0), n, w, e, vs + 11), 'top', TL); loc.set(q, t); }
        blit(t, tx, ty);
      }
      if (kk === 3) { // 裂缝墙（以后能打开的墙）：几道裂缝
        const X = tx * T2, Y = ty * T2, face = flo(tx, ty + 1);
        for (const [a, b, c, d] of [[8, 6, 14, 14], [14, 14, 11, 20], [11, 20, 18, 26], [14, 14, 22, 12]]) { const n = Math.max(Math.abs(c - a), Math.abs(d - b)); for (let q = 0; q <= n; q++) { const x = X + Math.round(a + (c - a) * q / n), y = Y + Math.round(b + (d - b) * q / n); u32[y * SW + x] = pack(INK); u32[y * SW + x + 1] = face ? TR[5] : TR[4]; } }
      }
    }
    // 地面上的阴影：上面是墙的格顶上一道、左边是墙的格左边一道（光从左上来），抖动渐淡；摆设不算
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      if (!flo(tx, ty)) continue;
      const X = tx * T2, Y = ty * T2;
      if (!flo(tx, ty - 1)) for (const [x, y, a] of SH_TOP) blend(X + x, Y + y, SHADE, a);
      if (!flo(tx - 1, ty)) for (const [x, y, a] of SH_LEFT) blend(X + x, Y + y, SHADE, a);
    }
    // 收边条：右边 / 下边那格材质不同或者不是同一个空间（房间 ↔ 走廊、门洞），在交界上画 2 像素（这格一像素暗、那格一像素亮）
    const TRIM = ramp('#8a8f9e'), sp = i => F.room[i];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const i = ty * W + tx; if (k[i] !== 0) continue;
      if (tx + 1 < W && k[i + 1] === 0 && (mat[i + 1] !== mat[i] || sp(i + 1) !== sp(i))) for (let y = 0; y < T2; y++) { const Y = ty * T2 + y; u32[Y * SW + tx * T2 + 31] = pick(TRIM, 0.3, 31, y); u32[Y * SW + tx * T2 + 32] = pick(TRIM, y & 3 ? 0.78 : 0.95, 0, y); }
      if (ty + 1 < H && k[i + W] === 0 && (mat[i + W] !== mat[i] || sp(i + W) !== sp(i))) for (let x = 0; x < T2; x++) { const X = tx * T2 + x; u32[(ty * T2 + 31) * SW + X] = pick(TRIM, 0.3, x, 31); u32[(ty * T2 + 32) * SW + X] = pick(TRIM, x & 3 ? 0.78 : 0.95, x, 0); }
    }
    // 门楣：横墙上的门洞（门洞格顶上一条倒角的横梁，两头接着门柱）
    for (const d of F.doors || []) {
      if (d.h !== 1 || at(d.x, d.y) !== 0 || !flo(d.x, d.y - 1) || !flo(d.x, d.y + 1) || flo(d.x - 1, d.y) || flo(d.x + d.w, d.y)) continue; // 只要横墙上的门洞（上下是地面、左右是墙）
      const kind = (F.rooms[d.room] || {}).kind, RP = facePal(F, kind || 'corr').post;
      for (let x = d.x * T2 - 2; x < (d.x + d.w) * T2 + 2; x++) for (let y = 0; y < 6; y++) { const Y = d.y * T2 + y; if (x < 0 || x >= W2) continue; u32[Y * SW + x] = pick(RP, y === 0 ? 0.95 : y === 5 ? 0.08 : y === 4 ? 0.3 : 0.6 - 0.05 * y, x, Y); }
    }
    // 墙面装饰
    const lit = (F.wallLit || []).map(s => ({ x: s.x, y: s.y, kind: s.w === 2 ? 'billboard2' : s.kind === 'neon' ? 'neon' : 'billboard', col: s.col, h: s.h }));
    for (const d of lit.concat(F.wallDeco || [])) {
      const sp2 = decoSprite(d.kind, d.col || (F.th.neon || ['#ff3d8b'])[d.h % ((F.th.neon || [1]).length)], d.h % 6);
      const X = d.x * T2 + (d.kind === 'billboard2' ? 2 : 0), Y = d.y * T2 + (d.kind === 'vent' ? 7 : d.kind === 'poster' ? 5 : 4);
      for (let y = 0; y < sp2.h; y++) for (let x = 0; x < sp2.w; x++) { const c = sp2.px[y * sp2.w + x]; if (c) u32[(Y + y) * SW + X + x] = c; }
      if (sp2.emit) { ex.globalAlpha = 0.6; ex.drawImage(sp2.emit, X, Y); ex.globalAlpha = 1; }
    }
    F.floorArt = 'gen2';
    return F;
  };
  // ── P6 任务 2（dress.js 的 walls）：旧骨架楼层只换墙——bake 照旧逐格画地面，D.paintWallX 不管的墙格（cells）交到这里：
  //   立面 / 墙顶贴片、裂缝墙的裂缝、离地面两格以外铺墙里深处的颜色；亮着的招牌（planLit）和墙面装饰（planDeco）只挂在这些立面上。
  //   画进共用的像素缓冲（不是不透明的那种），和表面痕迹、贴花一起在 bake 里贴一次。房间种类按 G2.roomKind 对照（中庭 = 大厅）
  G2.paintDressWalls = function (F, cells, ex) {
    const W = F.tw, H = F.tht, k = F.kind, W2 = F.w * Z, H2 = F.h * Z, seed = (F.p4 ? F.p4.s : hh(W, H, 1)) >>> 0;
    const PB = G2.pixBuf(W2, H2), SW = PB.SW, u32 = PB.u32, BW = PB.BW, dirty = PB.dirty;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 1 : k[y * W + x], flo = (x, y) => at(x, y) === 0;
    const mine = new Uint8Array(W * H); for (const i of cells) mine[i] = 1;
    const near = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (k[y * W + x] === 0) for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1; }
    const loc = new Map(), wc = new Map(); let pid = 0;
    const kindOf = ri => ri >= 0 ? (G2.roomKind ? G2.roomKind(F, F.rooms[ri]) : F.rooms[ri].kind) : 'corr';
    const palW = kind => { let o = wc.get(kind); if (!o) { o = Object.assign({ id: pid++ }, facePal(F, kind)); wc.set(kind, o); } return o; };
    const TR = TOP_R(), TL = TOP_LUT(), DEEP = pack(G2.DEEP_COL);
    const mark = (tx, ty) => { dirty[((ty * T2) >> 6) * BW + ((tx * T2) >> 6)] = 1; dirty[((ty * T2 + T2 - 1) >> 6) * BW + ((tx * T2 + T2 - 1) >> 6)] = 1; };
    const blit = (t, tx, ty) => { let o = ty * T2 * SW + tx * T2; const R = t.rows || rowsOf(t); for (let y = 0; y < T2; y++, o += SW) u32.set(R[y], o); mark(tx, ty); };
    let faces = 0, nOld = 0;
    for (const i of cells) {
      const tx = i % W, ty = (i / W) | 0, kk = k[i];
      if (!near[i]) { const o = ty * T2 * SW + tx * T2; for (let y = 0; y < T2; y++) u32.fill(DEEP, o + y * SW, o + y * SW + T2); mark(tx, ty); continue; }
      if (flo(tx, ty + 1)) {
        faces++; if ((tx * 31 + ty * 17) % 9 === 0) nOld++;
        const kind = kindOf(F.room[i + W]), wp = palW(kind), face = wp.face;
        const side = x => flo(x, ty) ? 1 : !flo(x, ty + 1) ? 2 : 0, ls = side(tx - 1), rs = side(tx + 1), h = hh(tx, ty, seed + 1), v = h % 100 < 70 ? 0 : h % 100 < 88 ? 1 : 2;
        const par = face === 'concrete' ? tx & 1 : 0;
        const n = 1e6 + wp.id * 256 + ((v * 9 + ls * 3 + rs) * 2 + par); let t = loc.get(n);
        if (!t) { t = tileOf('w' + face + '|' + v + '|' + ls + rs + '|' + par + '|0', q => paintFaceTile(q, face, WS, v, ls, rs, par, hh(v, ls * 3 + rs, 0)), wp.key, wp.lut); loc.set(n, t); }
        blit(t, tx, ty);
      } else {
        const n = flo(tx, ty - 1), w = flo(tx - 1, ty), e = flo(tx + 1, ty), vs = hh(tx, ty, seed + 2) & 1, q = 2e6 + ((+n) * 4 + (+w) * 2 + (+e)) * 2 + vs; let t = loc.get(q);
        if (!t) { t = tileOf('t' + (+n) + (+w) + (+e) + '|' + vs, z => paintTopTile(z, SYM(0), n, w, e, vs + 11), 'top', TL); loc.set(q, t); }
        blit(t, tx, ty);
      }
      if (kk === 3) { const X = tx * T2, Y = ty * T2, face = flo(tx, ty + 1);
        for (const [a, b, c, d] of [[8, 6, 14, 14], [14, 14, 11, 20], [11, 20, 18, 26], [14, 14, 22, 12]]) { const m = Math.max(Math.abs(c - a), Math.abs(d - b)); for (let s2 = 0; s2 <= m; s2++) { const x = X + Math.round(a + (c - a) * s2 / m), y = Y + Math.round(b + (d - b) * s2 / m); u32[y * SW + x] = pack(INK); u32[y * SW + x + 1] = face ? TR[5] : TR[4]; } } }
    }
    // 亮着的招牌、墙面装饰：只留挂在这些立面上的（D.paintWallX 画的墙——写字楼的窗、车壁——上不挂）
    const okAt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mine[y * W + x];
    G2.planLit(F, nOld);
    const drop = new Set(); F.wallLit = F.wallLit.filter(s => { for (let a = 0; a < s.w; a++) if (!okAt(s.x + a, s.y)) { for (const r of s.refs || []) drop.add(r); return false; } return true; });
    if (drop.size) F.signs = F.signs.filter(s => !drop.has(s));
    G2.planDeco(F); F.wallDeco = F.wallDeco.filter(d => okAt(d.x, d.y));
    const lit = F.wallLit.map(s => ({ x: s.x, y: s.y, kind: s.w === 2 ? 'billboard2' : s.kind === 'neon' ? 'neon' : 'billboard', col: s.col, h: s.h }));
    for (const d of lit.concat(F.wallDeco)) {
      const sp2 = decoSprite(d.kind, d.col || (F.th.neon || ['#ff3d8b'])[d.h % ((F.th.neon || [1]).length)], d.h % 6);
      const X = d.x * T2 + (d.kind === 'billboard2' ? 2 : 0), Y = d.y * T2 + (d.kind === 'vent' ? 7 : d.kind === 'poster' ? 5 : 4);
      for (let y = 0; y < sp2.h; y++) for (let x = 0; x < sp2.w; x++) { const c = sp2.px[y * sp2.w + x]; if (c) u32[(Y + y) * SW + X + x] = c; }
      if (sp2.emit && ex) { ex.globalAlpha = 0.6; ex.drawImage(sp2.emit, X, Y); ex.globalAlpha = 1; }
    }
    F.dressWalls = { cells: cells.length, faces, lit: F.wallLit.length, deco: F.wallDeco.length };
    return F.dressWalls;
  };
  // 打开裂缝墙以后补画那一格地面（openBreakable 在运行时调；画布是这一层的地面大图）
  G2.paintCell = function (g, F, tx, ty) {
    if (!F.mat) planMat(F);
    const i = ty * F.tw + tx; let m = F.mat[i]; if (!m) { const ri = F.room[i], r = ri >= 0 ? F.rooms[ri] : null; m = F.mat[i] = r ? ROOM_MAT[r.kind] || 1 : 3; }
    const { lut, key } = floorPal(F, i, m), t = tileOf('f' + m + '|0|0|0', q => paintFloorTile(q, m, FS, 0, 0, hh(m, 0, 7), hh(m, 3, 5)), key, lut);
    const [c, cx] = D.canvas(T2, T2), img = cx.createImageData(T2, T2); new Uint32Array(img.data.buffer).set(t); cx.putImageData(img, 0, 0);
    g.drawImage(c, tx * T2, ty * T2);
  };
  G2.MAT_NAME = MAT_NAME;
  G2.tileCacheSize = () => TILE.size + TILE0.size; // 测试看缓存有没有封顶
  G2.DEEP_COL = '#0e0f19'; // 墙里深处的底色（level.js 的 bake 新画法先用它铺满画布）
  // 进游戏后趁空闲先把常用的色阶编号图画好（和配色无关；分小块做，每块 ≤ 4 毫秒），第一次进站不用现画
  G2.warmTiles = function () {
    const jobs = [];
    for (const m of [1, 2, 3, 4, 5]) for (let v = 0; v < 4; v++) for (const par of m === 2 || m === 3 ? [0, 1, 2, 3] : [0]) for (let vs = 0; vs < 2; vs++) jobs.push(['f' + m + '|' + v + '|' + par + '|' + vs, t => paintFloorTile(t, m, FS, v, par, hh(m, v, vs + 7), hh(m, 3, 5))]);
    for (const face of ['panel', 'concrete', 'metal']) for (let v = 0; v < 3; v++) for (let ls = 0; ls < 3; ls++) for (let rs = 0; rs < 3; rs++) for (const par of face === 'concrete' ? [0, 1] : [0]) jobs.push(['w' + face + '|' + v + '|' + ls + rs + '|' + par + '|0', t => paintFaceTile(t, face, WS, v, ls, rs, par, hh(v, ls * 3 + rs, 0))]);
    for (let b = 0; b < 8; b++) for (let vs = 0; vs < 2; vs++) jobs.push(['t' + (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1) + '|' + vs, t => paintTopTile(t, SYM(0), !!(b & 1), !!(b & 2), !!(b & 4), vs + 11)]);
    const step = () => { const t0 = performance.now(); while (jobs.length && performance.now() - t0 < 4) { const [ck, fn] = jobs.shift(); if (!CODE.has(ck)) { const c = new Uint8Array(T2 * T2); fn(c); CODE.set(ck, c); } } if (jobs.length) setTimeout(step, 0); };
    setTimeout(step, 0);
  };
  if (typeof window !== 'undefined' && typeof document !== 'undefined') G2.warmTiles();
  G2.oldSignsLeft = (F, cells) => cells.filter(([x, y]) => !(F.exits || []).some(e => x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h)).length;

  // ── 随机数：新画法不逐格画旧的地砖和墙，但父流要照旧取一样多的数（后面的楼层、灯的种子照旧）。
  //    这里按旧的 paintFloorTile / paintWallTile 的取数一格格空跑（只取数、不画），返回旧画法会挂霓虹招牌的格 [[tx, ty]…]
  //    （bake 末尾每块再取一个数；导向牌画出口时会撤掉出口上的招牌，所以要等出口定了再数，见 G2.oldSignsLeft）
  G2.burnTiles = function (F, rng) {
    const W = F.tw, H = F.tht, k = F.kind, T2s = TS * Z, isFloor = (x, y) => !(x < 0 || y < 0 || x >= W || y >= H) && k[y * W + x] === 0;
    const signs = [];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const kk = k[ty * W + tx];
      if (kk === 0) { if (rng.chance(0.15)) { rng.int(4, 27); rng.int(4, 27); for (let i = 0; i < rng.int(5, 12); i++) { rng.int(-1, 1); rng.int(0, 1); } } }
      else if (kk === 2) continue;
      else if (isFloor(tx, ty + 1)) {
        const roll = (tx * 31 + ty * 17) % 9;
        if (roll === 0) { rng.pick(F.th.neon); for (let i = 0; i < 3; i++) { rng.int(0, T2s - 12); rng.int(3, 8); rng.int(0, 6); } signs.push([tx, ty]); }
        else if (roll === 5) rng.pick([0, 1, 2]);
      } else if ((tx * 5 + ty * 3) % 4 === 0) { rng.int(2, 26); rng.int(2, 26); }
    }
    return signs;
  };
})(D);
