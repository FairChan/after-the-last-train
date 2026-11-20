/* 末班之后 · 剧情灵魂：储备库里手工搭的 E-17 一段（储备库其他房间照旧随机生成）。
   站台层多一道楼梯 → 检修隧道（老喀小队的三具工壳倒在这里）→ E-17 站台 → 10 节车厢：
     1–3 节货厢（E-17 封箱放这里）、4–9 节席位车厢（盖着毯子的轮廓坐在座位上，小维护机来回掸灰）、第 10 节战略核指挥车厢（战略黑匣子）。
   第 9 节最后一排有林远舟的随车日志（读了进剧情屋"车厢"那场），第 4 节靠窗有陆衡的录音机，6 件随车遗物散在各节车厢。
   这一层叫 F.e17；交互和封箱 / 服务器的位置在 story.js（S.e17）。画法守死亡细胞画风：座位、人、维护机都是 D.mkSprite 画的。
   设计：design/features/story-soul/design.md 第二节"储备库里多出来的东西" */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, TW = 78, TH = 22, CAR0 = 20, CARW = 5, CARGAP = 6, CAR_Y = 6, CAR_H = 6;
  // 房间种类（名字会显示在站里）：不进随机生成，只在这一层用
  Object.assign(D.ROOMS, {
    e17tun: { name: '检修隧道', floor: ['#22262a', '#25292d', '#1f2327'], props: [], cont: [['wreck', 1]], nCont: [0, 0], lamp: '#8ab0c8' },
    e17plat: { name: 'E-17 站台', floor: ['#2e3236', '#32363a'], props: [], cont: [['crate', 1]], nCont: [0, 0], lamp: '#c8d4c0' },
    e17cargo: { name: '货厢', floor: ['#2a2622', '#2e2a25'], props: [], cont: [['crate', 1]], nCont: [0, 0], lamp: '#ffd27a' },
    e17seat: { name: '席位车厢', floor: ['#262c34', '#2a3038'], props: [], cont: [['crate', 1]], nCont: [0, 0], lamp: '#c8d4c0' },
    e17server: { name: '机要车厢', floor: ['#1e2430', '#222834'], props: [], cont: [['crate', 1]], nCont: [0, 0], lamp: '#3ee8ff' },
  });
  const carX = i => CAR0 + i * CARGAP;
  const px = (tx, ty) => ({ x: tx * TS + 8, y: ty * TS + 12 });

  function build(rng) {
    const L = D.LV, F = L.newFloor(TW, TH, 'E-17 · 封存站台', 'depot');
    F.e17 = true; F.ambient = '#10131c';
    const tun = L.addRoom(F, 2, 12, 16, 4, 'e17tun');
    L.addRoom(F, 17, 13, TW - 20, 4, 'e17plat');
    F.stairs.push({ x: 4 * TS, y: 12 * TS + 6, dir: 'up', label: '回到库区站台', to: 1 });
    const spots = [], seats = [], bots = [];
    for (let i = 0; i < 10; i++) {
      const x = carX(i), kind = i < 3 ? 'e17cargo' : i < 9 ? 'e17seat' : 'e17server', r = L.addRoom(F, x, CAR_Y, CARW, CAR_H, kind, { car: i + 1 });
      L.carve(F, x + 2, CAR_Y + CAR_H, 1, 1, r.i); // 车门
      if (kind === 'e17cargo') spots.push(Object.assign({ k: 'crate', car: i + 1 }, px(x + 1, CAR_Y + 2)), Object.assign({ k: 'crate', car: i + 1 }, px(x + 3, CAR_Y + 2)));
      if (kind === 'e17seat') {
        for (let a = 0; a < CARW; a++) { F.solid[(CAR_Y) * TW + x + a] = 1; seats.push({ x: (x + a) * TS + 8, y: (CAR_Y + 1) * TS - 1, k: (i * 7 + a) % 9, car: i + 1 }); }
        bots.push({ x0: x * TS + 10, x1: (x + CARW) * TS - 10, y: (CAR_Y + 4) * TS, ph: rng() * 6, car: i + 1 });
        F.lights.push({ x: (x + 2.5) * TS, y: (CAR_Y + 1) * TS, r: 60, col: '#c8d4c0', a: i % 2 ? 0.25 : 0.55, flick: i % 2 ? 0.45 : 0.04, seed: rng() * 100 });
      }
      if (kind === 'e17cargo') F.lights.push({ x: (x + 2.5) * TS, y: (CAR_Y + 1) * TS, r: 55, col: '#ffd27a', a: 0.4, flick: 0.05, seed: rng() * 100 });
      if (kind === 'e17server') { spots.push(Object.assign({ k: 'server', car: 10 }, px(x + 2, CAR_Y + 2))); F.lights.push({ x: (x + 2.5) * TS, y: (CAR_Y + 2) * TS, r: 60, col: '#3ee8ff', a: 0.5, flick: 0.08, seed: rng() * 100 }); }
    }
    // 随车遗物：story.js 的 RELICS 写着在第几节
    const per = {}; for (const k in D.Story.RELICS) { const car = D.Story.RELICS[k].car, n = per[car] = (per[car] || 0) + 1; spots.push(Object.assign({ k: 'relic', id: k, car }, px(carX(car - 1) + (n === 1 ? 1 : 3), CAR_Y + 3))); }
    spots.push(Object.assign({ k: 'log', car: 9 }, px(carX(8) + 3, CAR_Y + 2)));
    spots.push(Object.assign({ k: 'recorder', car: 4 }, px(carX(3) + 1, CAR_Y + 2)));
    // 老喀小队：三具工壳倒在隧道里（普通残骸，能搜）
    for (const tx of [7, 10, 14]) { const q = Object.assign({ k: 'laoka' }, px(tx, 14)); spots.push(q); F.contSpots.push({ kind: 'wreck', x: q.x, y: q.y, bonus: 1, room: tun.i }); }
    // 隧道和站台的灯：冷、稀
    for (let x = 4; x < 17; x += 5) F.lights.push({ x: x * TS, y: 12 * TS + 4, r: 46, col: '#8ab0c8', a: 0.3, flick: 0.2, seed: rng() * 100 });
    for (let x = 20; x < TW - 2; x += 8) F.lights.push({ x: x * TS, y: 13 * TS + 2, r: 70, col: '#c8d4c0', a: 0.35, flick: 0.04, seed: rng() * 100 });
    F.e17spots = spots; F.e17seats = seats; F.e17bots = bots;
    F.spawn = { x: 5 * TS, y: 14 * TS };
    return F;
  }
  // 站台层上找一块空地放楼梯（和别的楼梯、摆设隔开）
  function freeSpot(P) {
    for (const ty of [13, 14, 12, 15]) for (let tx = 50; tx > 6; tx--) {
      if (P.solid[ty * P.tw + tx] || P.solid[(ty + 1) * P.tw + tx]) continue;
      const x = tx * TS + 8, y = ty * TS + 6;
      if (P.stairs.some(s => Math.hypot(s.x - x, s.y - y) < 64) || P.props.some(p => Math.hypot((p.x || 0) - x, (p.y || 0) - y) < 28) || (P.tunnels || []).some(t => Math.abs(t.x - x) < 70)) continue;
      return { x, y };
    }
    return { x: 40 * TS, y: 13 * TS + 6 };
  }
  const ms0 = D.makeStation;
  D.makeStation = function (rng, st, opt) {
    const floors = ms0.apply(this, arguments);
    if (!st || st.type !== 'reserve' || (opt && opt.tut) || !floors[1]) return floors;
    const F = build(rng), fi = floors.length; F.layout = 'standard'; F.line = floors[1].line; // 地下：不跟高架那种露天的布局
    D.LV.bake(F, rng); floors.push(F);
    const at = freeSpot(floors[1]); floors[1].stairs.push({ x: at.x, y: at.y, dir: 'down', label: '下到检修隧道（E-17）', to: fi, hatch: true });
    return floors;
  };

  // ── 画：座位上盖着毯子的轮廓、来回掸灰的维护机、遗物的微光、日志和录音机
  const SP = {};
  const spr = (k, w, h, fn) => SP[k] || (SP[k] = D.mkSprite(w, h, fn));
  const seatSpr = () => spr('e17_seat', 28, 30, p => { p.box(2, 0, 24, 20, D.RAMP.blue, { r: 3, top: 2, bias: -0.22 }); p.box(0, 18, 28, 7, D.RAMP.blue, { r: 2, bias: -0.15 }); p.box(3, 25, 3, 5, D.RAMP.gunmetal); p.box(22, 25, 3, 5, D.RAMP.gunmetal); });
  const whoSpr = k => spr('e17_who' + k, 26, 34, p => { const B = k % 3 === 0 ? D.RAMP.cloth : k % 3 === 1 ? D.RAMP.olive : D.RAMP.gunmetal; p.ell(13, 8 + (k % 2), 6, 7, B, { bias: -0.05 }); p.box(3, 13, 20, 21, B, { r: 4, top: 2, bias: -0.08 }); p.line(7, 18, 9, 32, B[1]); p.line(19, 17, 17, 32, B[1]); });
  const botSpr = () => spr('e17_bot', 22, 22, p => { p.ell(11, 13, 9, 8, D.RAMP.white, { spec: true, bias: -0.1 }); p.box(4, 17, 14, 5, D.RAMP.gunmetal, { r: 2 }); p.ell(11, 12, 3, 2, D.RAMP.green, { emit: true }); p.line(16, 8, 20, 2, '#848ca8'); p.box(18, 0, 4, 3, D.RAMP.cloth); });
  const logSpr = () => spr('e17_log', 12, 10, p => { p.box(0, 2, 12, 8, D.RAMP.cloth, { r: 1 }); p.rect(2, 4, 8, 1, '#e8e0c8'); });
  const recSpr = () => spr('e17_rec', 12, 9, p => { p.box(0, 1, 12, 8, D.RAMP.gunmetal, { r: 1 }); p.disc(3, 5, 2, '#151a29'); p.disc(9, 5, 2, '#151a29'); p.px(6, 2, '#c82e3a', 1); });
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    const r = de0 ? de0.apply(this, arguments) : undefined;
    const F = S.A; if (!F || !F.e17) return r;
    const t = S.t, E = S.e17;
    for (const q of F.e17seats) list.push({ y: q.y, f: () => { D.blit(ctx, seatSpr(), q.x, q.y + 6); D.blit(ctx, whoSpr(q.k), q.x, q.y + 2); } });
    for (const b of F.e17bots) { const k = (Math.sin(t * 0.3 + b.ph) + 1) / 2, x = b.x0 + (b.x1 - b.x0) * k, dir = Math.cos(t * 0.3 + b.ph) > 0 ? 1 : -1; b.x = x; list.push({ y: b.y, f: () => { D.blit(ctx, botSpr(), x, b.y + Math.sin(t * 5 + b.ph) * 0.3, dir < 0); D.blit(ex, botSpr(), x, b.y, dir < 0, 'emit'); } }); }
    if (E) for (const q of E.spots) {
      if (q.k === 'relic' && !(D.Story.S(S.raid.pf).relics || []).includes(q.id)) list.push({ y: q.y, f: () => { const a = 0.5 + 0.5 * Math.sin(t * 2 + q.x); ex.fillStyle = `rgba(255,236,190,${0.35 + 0.4 * a})`; ex.fillRect(q.x - 0.5, q.y - 3, 1, 1); ex.fillRect(q.x - 1.5, q.y - 2, 3, 0.5); } });
      if (q.k === 'log') list.push({ y: q.y, f: () => { D.blit(ctx, logSpr(), q.x, q.y); } });
      if (q.k === 'recorder' && !q.taken) list.push({ y: q.y, f: () => { D.blit(ctx, recSpr(), q.x, q.y); D.blit(ex, recSpr(), q.x, q.y, false, 'emit'); } });
    }
    return r;
  };
  D.E17 = { build, TW, carX };
})(D);
