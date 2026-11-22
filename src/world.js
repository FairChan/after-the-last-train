/* 末班之后 · 小样二：M5 世界包：四种新站（水淹站、停电站、调度中心、旧货运站）、12 种新房间、7 种新容器、
   站内随机事件（停电、机群迁徙、空投、对手小队、幽灵列车）、调度终端、积水。
   只通过挂钩接进 level.js（D.stationMod）、city.js（D.assignTypesX）、loot.js（K.onOpenX）、station.js（K.candX 交互候选 / K.worldPost）、draw.js（drawExtras）。
   设计：design/features/content/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const K = D.K || (D.K = {});
  const part = (...a) => K.part(...a), ring = (...a) => K.ring(...a), flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a);

  // ── 站：w 是 0，不进原来的分配（老城市的站型不变）；assignTypesX 用自己的随机流从普通站里改出几座
  Object.assign(D.STATION_TYPES, {
    flooded:  { name: '水淹站', w: 0, m5: 0.035, theme: 'platform', desc: '一部分地面泡在水里：人和机器在水里都慢三成，电磁和电弧打水里的敌人更疼' },
    blackout: { name: '停电站', w: 0, m5: 0.035, minTier: 1, theme: 'depot', desc: '整站只剩应急灯，敌人的眼睛在黑里发亮。东西比同级的站多一点' },
    dispatch: { name: '调度中心', w: 0, m5: 0.03, minTier: 1, theme: 'depot', desc: '控制室多；找到调度终端骇入，本层锁着的门和门禁柜全开' },
    freight:  { name: '旧货运站', w: 0, m5: 0.035, theme: 'depot', desc: '货仓里堆满集装箱（开得慢、东西多），重机枪手在这里扎营' },
  });
  Object.assign(D.NODE_ICON_ART, { // 13×13 的站点小图标（initArt 时一起画）
    flooded: g => { g.rect(4, 1, 4, 4, P[4]); for (const y of [7, 10]) { g.line(1, y, 3, y - 2, P.c); g.line(3, y - 2, 6, y, P.c); g.line(6, y, 9, y - 2, P.c); g.line(9, y - 2, 11, y, P.c); } },
    blackout: g => { g.disc(6, 5, 3, P[3]); g.rect(5, 8, 3, 3, P[4]); g.line(1, 11, 11, 1, P.r); },
    dispatch: g => { g.rect(1, 2, 11, 7, P[3]); g.rect(2, 3, 9, 5, P.c); g.rect(5, 9, 3, 2, P[4]); g.rect(3, 11, 7, 1, P[4]); },
    freight: g => { g.rect(1, 4, 11, 7, P.o); for (let x = 3; x < 11; x += 2) g.rect(x, 5, 1, 5, P.n); g.rect(1, 3, 11, 1, P[5]); },
  });
  Object.assign(D.GARRISON, {
    flooded: [['crawler', 3], ['drone', 2], ['mite', 2], ['medic', 1], ['bomber', 1]],
    blackout: [['stalker', 2], ['crawler', 3], ['drone', 2], ['bomber', 1]],
    dispatch: [['drone', 3], ['jammer', 1.5], ['turret', 1], ['sniper', 1]],
    freight: [['gunner', 2], ['raider', 2], ['crawler', 1], ['drone', 1]],
  });
  // ── 房间（18 → 30）
  Object.assign(D.ROOMS, {
    office:   { name: '办公室', floor: ['#262a3a', '#2a2e40'], props: [['desk', 4], ['cabinet', 1], ['planter', 1]], cont: [['filecab', 2], ['pc', 2], ['locker', 1], ['mailbag', 1]], nCont: [2, 3] },
    canteen:  { name: '食堂',   floor: ['#2e2a26', '#332e29'], props: [['bench', 4], ['vending', 1]], cont: [['fridge', 2], ['trash', 2], ['vendor', 1]], nCont: [2, 3] },
    dorm:     { name: '宿舍',   floor: ['#2a2633', '#2e2938'], props: [['bed', 4], ['cabinet', 1]], cont: [['locker', 3], ['parcel', 1], ['corpse', 1]], nCont: [2, 3] },
    washroom: { name: '卫生间', floor: ['#3a4250', '#3e4656'], props: [['bin', 2]], cont: [['trash', 2], ['locker', 1], ['medcab', 1]], nCont: [1, 2] },
    archive:  { name: '档案室', floor: ['#2b2620', '#302a23'], props: [['shelf', 4], ['cabinet', 2]], cont: [['filecab', 3], ['evidence', 2], ['safe', 1]], nCont: [2, 4] },
    lab:      { name: '实验室', floor: ['#22303a', '#25353f'], props: [['machine', 2], ['desk', 2], ['cabinet', 1]], cont: [['labfridge', 2], ['pc', 1], ['medcab', 1], ['lockbox', 1]], nCont: [2, 3], lamp: '#8dff6a' },
    garage:   { name: '车库',   floor: ['#2a2c2e', '#2e3032'], props: [['barrel', 3], ['crate', 2], ['machine', 1]], cont: [['toolcart', 2], ['wreck', 2], ['toolbox', 1]], nCont: [2, 4] },
    pump:     { name: '泵房',   floor: ['#1f2a33', '#223038'], props: [['machine', 3], ['barrel', 2]], cont: [['toolbox', 2], ['partsbin', 1], ['toolcart', 1]], nCont: [2, 3], dim: true, wet: true },
    cargo:    { name: '货仓',   floor: ['#2d2a24', '#322e27'], props: [['crate', 5], ['barrel', 2]], cont: [['container', 3], ['crate', 2], ['trapcrate', 1], ['parcel', 1]], nCont: [3, 5] },
    dispatchroom: { name: '调度台', floor: ['#1c2232', '#20263a'], props: [['desk', 4], ['machine', 1]], cont: [['pc', 2], ['filecab', 2], ['mailbag', 1], ['safe', 1]], nCont: [2, 3], lamp: '#3ee8ff' },
    shelter:  { name: '避难所', floor: ['#2a2622', '#2e2a25'], props: [['bed', 2], ['crate', 2], ['bench', 1]], cont: [['corpse', 2], ['medcab', 1], ['crate', 1], ['mailbag', 1]], nCont: [2, 3] },
    lounge:   { name: '休息室', floor: ['#2e2638', '#33293f'], props: [['bench', 3], ['vending', 2], ['planter', 1]], cont: [['vendor', 2], ['trash', 1], ['locker', 1], ['fridge', 1]], nCont: [1, 3] },
  });
  Object.assign(D.ROOM_POOL, {
    flooded: [['pump', 4], ['storage', 2], ['washroom', 2], ['power', 1]],
    blackout: [['power', 3], ['dorm', 2], ['office', 2], ['storage', 2], ['shelter', 1]],
    dispatch: [['dispatchroom', 3], ['control', 2], ['office', 2], ['archive', 1], ['lounge', 1]],
    freight: [['cargo', 5], ['garage', 2], ['storage', 2], ['office', 1]],
  });
  // 老站也偶尔出新房间
  const addR = (st, k, w) => { if (D.ROOM_POOL[st]) D.ROOM_POOL[st].push([k, w]); };
  addR('ruin', 'dorm', 1); addR('ruin', 'washroom', 1); addR('ruin', 'shelter', 0.7); addR('market', 'canteen', 1); addR('market', 'washroom', 0.6); addR('market', 'lounge', 0.6);
  addR('hangar', 'garage', 1.5); addR('depot', 'garage', 1); addR('factory', 'canteen', 0.6); addR('hospital', 'lab', 1.5); addR('museum', 'archive', 1.2);
  addR('datacenter', 'lab', 1); addR('datacenter', 'archive', 1); addR('relay', 'office', 1); addR('checkpoint', 'office', 1); addR('checkpoint', 'dorm', 1);
  addR('bank', 'office', 1.2); addR('armory', 'garage', 0.8); addR('outpost', 'canteen', 1); addR('refuge', 'dorm', 1.5); addR('blackmarket', 'lounge', 1);
  // ── 容器（23 → 30）
  Object.assign(D.CONT, {
    container: { name: '集装箱',   n: [4, 7], g: [8, 5], slow: 1.6, cats: ['mat', 'part', 'elec', 'val'], lean: 0.5, ammoP: 0.08, desc: '货仓里。大、开得慢，东西多' },
    mailbag:   { name: '邮袋',     n: [1, 3], g: [4, 3], slow: 0.6, cats: ['val', 'elec', 'intel'], lean: 0.5, ammoP: 0.04, desc: '没送出去的信和包裹，翻得快，偶尔有值钱的' },
    evidence:  { name: '证物柜',   n: [2, 3], g: [4, 4], bonus: 1, slow: 1.2, cats: ['intel', 'val', 'metal'], lean: 0.7, cards: 0.15, desc: '档案室。品质高一档，偶尔有收缴的装备卡' },
    labfridge: { name: '样本冷柜', n: [2, 3], g: [4, 4], medP: 0.5, cats: ['med', 'elec'], lean: 0.6, desc: '实验室。药品和精密电子' },
    toolcart:  { name: '工具车',   n: [2, 4], g: [5, 3], ammoP: 0.12, cats: ['part', 'mat'], lean: 0.7, desc: '车库、泵房。零件和材料' },
    trapcrate: { name: '陷阱箱',   n: [2, 4], g: [5, 4], bonus: 1, trap: 0.3, cats: ['part', 'val'], lean: 0.4, desc: '品质高一档，但三成几率一打开就报警，全层的敌人都会过来' },
    supply:    { name: '空投补给箱', n: [3, 5], g: [5, 4], bonus: 1, ammoP: 0.35, medP: 0.35, cards: 0.3, desc: '站内事件"空投"掉下来的。弹药、药、装备卡' },
  });
  Object.assign(D.CMAT, { container: 'metal', mailbag: 'soft', evidence: 'metal', labfridge: 'fridge', toolcart: 'metal', trapcrate: 'wood', supply: 'metal' });

  // ── 容器的像素图（关、开两种）；initHiArt 时一起画
  const mk = (w, h, fn) => { const p = D.Paint(w, h); fn(p); p.outline(); return p.make(2); };
  const cont = (k, w, h, fn) => { D.CSPR[k] = [mk(w, h, p => fn(p, false)), mk(w, h, p => fn(p, true))]; };
  const h0 = D.initHiArt;
  D.initHiArt = function () {
    const r = h0 ? h0.apply(this, arguments) : undefined;
    cont('container', 40, 30, (p, o) => { p.box(1, 3, 38, 26, R.blue, { r: 1 }); for (let x = 4; x < 37; x += 4) p.rect(x, 5, 1, 22, '#132a5a'); p.rect(1, 14, 38, 1, '#0a1630'); p.rect(30, 18, 3, 5, '#e3c14a'); if (o) p.rect(3, 5, 18, 22, '#080a12'); });
    cont('mailbag', 22, 18, (p, o) => { p.ell(11, 11, 9, 6, R.olive, { bias: -0.1 }); p.rect(5, 6, 12, 2, '#3a4a22'); p.rect(9, 9, 4, 3, '#e3c14a'); if (o) p.ell(11, 7, 6, 2, R.dark, { flat: true }); });
    cont('evidence', 24, 30, (p, o) => { p.box(1, 1, 22, 28, R.gunmetal, { r: 1 }); for (let y = 4; y < 28; y += 8) { p.rect(3, y, 18, 6, '#1d212c'); p.rect(10, y + 2, 4, 1, '#e3c14a'); } if (o) p.rect(3, 4, 18, 6, '#080a12'); });
    cont('labfridge', 24, 32, (p, o) => { p.box(1, 1, 22, 30, R.white, { r: 1 }); p.grad(4, 4, 16, 16, R.glass, 1); p.rect(4, 23, 16, 1, '#848ca8'); p.rect(18, 24, 2, 4, '#8dff6a', 1); if (o) p.rect(4, 4, 16, 16, '#080a12'); });
    cont('toolcart', 28, 22, (p, o) => { p.box(1, 3, 26, 14, R.red, { r: 1 }); p.rect(1, 9, 26, 1, '#5a1218'); p.rect(4, 6, 6, 1, '#e3c14a'); p.disc(5, 19, 2, '#151a29'); p.disc(23, 19, 2, '#151a29'); if (o) p.rect(3, 4, 22, 4, '#080a12'); });
    cont('trapcrate', 28, 22, (p, o) => { p.box(1, 3, 26, 18, R.crate, { r: 1 }); for (let x = 2; x < 26; x += 6) { p.rect(x, 9, 3, 3, '#ffd23a'); p.rect(x + 3, 9, 3, 3, '#1b1d12'); } p.px(24, 5, '#ff3047', 1); if (o) p.box(0, 0, 28, 4, R.crate); });
    cont('supply', 30, 26, (p, o) => { p.box(1, 3, 28, 22, R.olive, { r: 1 }); p.rect(13, 3, 4, 22, '#e3c14a'); p.rect(1, 12, 28, 2, '#e3c14a'); p.rect(5, 6, 4, 4, '#ff3047', 1); if (o) p.box(0, 0, 30, 4, R.olive); });
    return r;
  };

  // ── 城市：从普通站里改出新站型（自己的随机流，别的站不变）
  D.assignTypesX = function (C, live, home) {
    const TT = D.STATION_TYPES, rng = D.rng('types5:' + C.seed), commons = ['ruin', 'market', 'hangar', 'factory'];
    const pool = live.filter(s => !s.home && !s.hidden && !s.exit && commons.includes(s.type)), n = live.length;
    for (const k of Object.keys(TT).filter(k => TT[k].m5)) {
      const want = Math.max(2, Math.round(n * TT[k].m5));
      for (const s of rng.shuffle(pool.filter(s => commons.includes(s.type) && (TT[k].minTier || 0) <= s.tier)).slice(0, want * 3)) {
        if (live.filter(o => o.type === k).length >= want) break;
        if ([...s.adj].some(o => C.stations[o].type === k)) continue;
        if (live.filter(o => o.type === s.type).length <= 3) continue; // 原来的站型至少留三座
        s.type = k;
      }
    }
  };

  // ── 生成站时：积水、停电、调度终端
  D.stationMod = function (F, rng, st, fi) {
    if (st.type === 'flooded') {
      F.water = new Uint8Array(F.tw * F.tht);
      for (const r of F.rooms) {
        if (!(D.ROOMS[r.kind].wet || r.kind === 'hall' || r.kind === 'platform' ? rng.chance(0.85) : rng.chance(0.45))) continue;
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rx = r.w * rng.range(0.35, 0.55), ry = r.h * rng.range(0.4, 0.6);
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1 && !(F.track && y >= F.track.y0 - 3)) F.water[y * F.tw + x] = 1;
      }
    }
    if (st.type === 'blackout') {
      F.dark = true; F.ambient = D.mixHex(F.ambient, '#000000', 0.45);
      F.lights = F.lights.filter((l, i) => i % 4 === 0).map(l => Object.assign({}, l, { col: '#ff3d2e', a: 0.5, flick: 0.25, r: 80 }));
    }
    if (st.type === 'dispatch') {
      const rooms = F.rooms.filter(r => r.kind === 'dispatchroom' || r.kind === 'control').concat(F.rooms.filter(r => r.kind === 'office'));
      const r = rooms[0]; if (r) (F.terminals = F.terminals || []).push({ x: (r.x + Math.floor(r.w / 2)) * TS + 8, y: (r.y + 1) * TS + 12, used: false });
    }
  };
  D.wetAt = (S, x, y) => { const A = S.A; if (!A.water) return false; const tx = Math.floor(x / TS), ty = Math.floor(y / TS); return !!A.water[ty * A.tw + tx]; };

  // ── 陷阱箱：打开时三成几率报警
  K.onOpenX = function (S, c) {
    const C = D.CONT[c.kind]; if (!C.trap || c.trapDone) return; c.trapDone = true;
    if (!S.rng.chance(C.trap)) return;
    for (const e of S.enemies) if (!e.dead && e.f === c.f) { e.dormant = false; K.becomeAware(S, e); }
    S.raid.noise += 2; S.raid.traps = (S.raid.traps || 0) + 1; S.banner = { t: 0, text: '陷阱！', sub: '箱子一开就响了，全层的敌人都往这边来' };
    ring(S, c.x, c.y - 6, 40, P.r); flashLight(S, c.x, c.y, 120, P.r, 1.3); addShake(S, 0.3); sfx('warn');
  };
  // ── 调度终端：骇入后本层锁着的门全开
  K.candX = function (S, add) {
    const p = S.player, A = S.A;
    for (const T of A.terminals || []) {
      if (Math.hypot(T.x - p.x, T.y - p.y) >= 22) continue;
      if (T.used) add({ ref: T, x: T.x, y: T.y, key: '', text: '调度终端：本层的门已经打开了' });
      else add({ ref: T, x: T.x, y: T.y, key: 'F', text: '骇入调度终端（打开本层锁着的门和门禁柜）', go: inp => { if (inp.interact) hackTerminal(S, T); } });
    }
  };
  function hackTerminal(S, T) {
    const A = S.A;
    T.used = true; let n = 0;
    for (const br of A.breakables) if (!br.open && br.lock) { D.openBreakable(A, br, S.fx); n++; }
    let m = 0; for (const c of S.containers) if (c.f === S.f && c.locked) { c.locked = false; m++; } // 门禁柜也一起开
    S.flow = null; S.flowT = 0; ring(S, T.x, T.y - 8, 24, P.c); flashLight(S, T.x, T.y, 120, P.c, 1.2); sfx('power');
    S.banner = { t: 0, text: '调度终端', sub: n || m ? '本层 ' + n + ' 扇门禁门、' + m + ' 个门禁柜打开了' : '本层没有锁着的门和柜子' };
  }

  // ── 站内随机事件：进一个有敌人的站，30% 几率在 20 到 60 秒后发生一种
  const EVENTS = {
    dark:  { name: '停电', sub: '整站只剩应急灯，25 秒' },
    swarm: { name: '机群迁徙', sub: '一大群小机器从站里穿过去，别挡它们的路' },
    drop:  { name: '空投', sub: '有人往站里扔了一箱补给，落点标出来了' },
    rival: { name: '对手小队', sub: '三个回收者追进来了，他们也想要你背包里的东西' },
    ghost: { name: '幽灵列车', sub: '一列没人的车开过站台，车上掉下来一样东西' },
  };
  D.STATION_EVENTS = EVENTS;
  function schedule(S) {
    S.evInit = true;
    if (S.safe || S.tut || S.extract || !S.st || S.st.type === 'event' || S.st.reserve) return;
    const rng = D.rng('ev:' + S.st.id + ':' + (S.raid.stops || 0) + ':' + (S.raid.day != null ? S.raid.day : (S.raid.pf && S.raid.pf.day) || 0));
    if (!rng.chance(0.3)) return;
    S.ev = { k: rng.pick(Object.keys(EVENTS)), at: rng.range(20, 60), rng };
  }
  function openSpot(S, rng, near, minD, maxD) {
    const A = S.A, p = S.player;
    for (let i = 0; i < 80; i++) {
      const x = rng.range(3 * TS, A.w - 3 * TS), y = rng.range(3 * TS, A.h - 3 * TS), d = Math.hypot(x - p.x, y - p.y);
      if (near && (d < minD || d > maxD)) continue;
      if (!D.solidAt(A, x, y) && !D.solidAt(A, x + 8, y) && !D.solidAt(A, x - 8, y) && !D.solidAt(A, x, y - 8)) return { x, y };
    }
    return null;
  }
  function fire(S) {
    const E = S.ev, rng = E.rng, p = S.player, A = S.A; let k = E.k;
    if (k === 'ghost' && !A.track) k = 'swarm';
    E.fired = true; S.banner = { t: 0, text: EVENTS[k].name, sub: EVENTS[k].sub }; sfx('warn');
    S.raid.events5 = (S.raid.events5 || []).concat(k);
    if (k === 'dark') { S.darkT = 25; for (const F of S.floors) { F._amb0 = F.ambient; F.ambient = D.mixHex(F.ambient, '#000000', 0.55); for (const l of F.lights) { l._a0 = l.a; l.a *= 0.3; } } sfx('cool'); }
    if (k === 'swarm') {
      const left = p.x > A.w / 2, x0 = left ? 3 * TS : A.w - 3 * TS, x1 = left ? A.w - 3 * TS : 3 * TS;
      for (let i = 0; i < 10; i++) {
        let y = null; for (let t = 0; t < 40; t++) { const yy = rng.range(3 * TS, A.h - 3 * TS); if (!D.solidAt(A, x0, yy)) { y = yy; break; } } if (y == null) continue;
        const e = K.spawnEnemy(S, i % 5 < 3 ? 'mite' : 'crawler', x0 + rng.range(-10, 10), y, 0.3, S.f, false); e.invest = { x: x1, y: rng.range(3 * TS, A.h - 3 * TS), t: e.t + 40 }; e.migrant = true;
      }
    }
    if (k === 'drop') { const sp = openSpot(S, rng, true, 90, 260) || openSpot(S, rng); if (sp) S.airdrop = { x: sp.x, y: sp.y, f: S.f, t: 6 }; }
    if (k === 'rival') {
      const st = A.stairs && A.stairs.length ? A.stairs : [{ x: 4 * TS, y: A.h / 2 }], far = st.slice().sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y))[0];
      for (let i = 0; i < 3; i++) { const kind = i === 2 && S.st.tier >= 2 ? 'gunner' : 'raider'; let x = far.x + rng.range(-20, 20), y = far.y + rng.range(10, 30); if (D.solidAt(A, x, y)) { x = far.x; y = far.y + 20; } K.spawnEnemy(S, kind, x, y, 0.8, S.f, true); }
    }
    if (k === 'ghost') { S.ghostT = 0; addShake(S, 0.4); sfx('charge2'); }
  }
  // 幽灵列车借用列车的画法：没有别的列车时，D.trainState 给一列一直开过去的车
  const ts0 = D.trainState;
  D.trainState = function (S) {
    const r = ts0 ? ts0(S) : null; if (r || S.ghostT == null || !S.A.track) return r;
    return { x: -700 + 1300 * S.ghostT, door: 0, leaving: true };
  };

  K.worldPost = function (S, dt) {
    if (!S.evInit) schedule(S);
    const p = S.player, A = S.A;
    if (S.ev && !S.ev.fired && S.t >= S.ev.at && p.hp > 0 && !S.extract && !S.over) fire(S);
    if (S.darkT > 0) { S.darkT -= dt; if (S.darkT <= 0) { for (const F of S.floors) { if (F._amb0) F.ambient = F._amb0; for (const l of F.lights) if (l._a0 != null) l.a = l._a0; } S.banner = { t: 0, text: '来电了', sub: '灯又亮了' }; sfx('power'); } }
    if (S.airdrop) {
      const d = S.airdrop; d.t -= dt;
      if (d.t <= 0) {
        const c = D.newContainer(S, S.ev.rng, 'supply', d.x, d.y, 1); c.f = d.f; S.containers.push(c);
        const F = S.floors[d.f], tx = Math.floor(d.x / TS), ty = Math.floor((d.y - 4) / TS); F.solid[ty * F.tw + tx] = 1; S.flow = null; S.flowT = 0;
        if (d.f === S.f) { K.explode(S, d.x, d.y, 18, 0, true); ring(S, d.x, d.y, 30, P.Y); for (let i = 0; i < 16; i++) part(S, 'smoke', d.x + S.rng.range(-14, 14), d.y, S.rng.range(-30, 30), S.rng.range(-30, -5), 1, '#7c8299'); }
        K.alertAround(S, d.x, d.y, 220, d.f); S.airdrop = null;
      }
    }
    if (S.ghostT != null) {
      S.ghostT += dt;
      if (S.ghostT > 0.6 && !S.ghostDrop && A.track) { S.ghostDrop = true; const y = (A.track.y0 - 2) * TS, x = D.clamp(p.x + S.rng.range(-60, 60), 40, A.w - 40); K.scatter(S, x, y, S.f, S.rng.pick(['oldphoto', 'watch', 'pocketw', 'ssd']), 1); }
      if (S.ghostT > 1.8) S.ghostT = null;
    }
    S.wetT = D.wetAt(S, p.x, p.y) ? 0.1 : 0;
    for (const e of S.enemies) if (!e.dead && e.f === S.f) e.wet = D.wetAt(S, e.x, e.y);
  };

  // ── 画：积水、调度终端、空投落点
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    if (de0) de0(S, list, ctx, ex);
    const A = S.A, VW = D.W / D.Z, VH = D.H / D.Z;
    if (A.water) list.push({ y: -2e9, f: () => {
      const x0 = Math.max(0, Math.floor(S.cam.x / TS)), y0 = Math.max(0, Math.floor(S.cam.y / TS)), x1 = Math.min(A.tw - 1, Math.ceil((S.cam.x + VW) / TS)), y1 = Math.min(A.tht - 1, Math.ceil((S.cam.y + VH) / TS));
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const i = ty * A.tw + tx; if (!A.water[i] || A.solid[i] && A.kind[i] === 1) continue;
        ctx.fillStyle = D.rgba('#2f6e88', 0.38); ctx.fillRect(tx * TS, ty * TS, TS, TS);
        const w = Math.sin(S.t * 2 + tx * 1.3 + ty * 0.7); if (w > 0.6) { ex.fillStyle = D.rgba('#a6e2f0', 0.25); ex.fillRect(tx * TS + ((tx * 7 + ty * 3) % 10), ty * TS + 6 + ((tx + ty) % 5), 4, 1); }
      }
    } });
    for (const T of A.terminals || []) list.push({ y: T.y, f: () => {
      const x = Math.round(T.x), y = Math.round(T.y);
      ctx.fillStyle = P.k; ctx.fillRect(x - 6, y - 14, 12, 14); ctx.fillStyle = '#20263b'; ctx.fillRect(x - 5, y - 13, 10, 12); ctx.fillStyle = '#0b0a14'; ctx.fillRect(x - 4, y - 12, 8, 5);
      ex.fillStyle = T.used ? D.rgba(P.g, 0.9) : D.rgba(P.c, 0.6 + 0.4 * Math.sin(S.t * 6)); ex.fillRect(x - 3, y - 11, 6, 3);
    } });
    const d = S.airdrop;
    if (d && d.f === S.f) list.push({ y: d.y, f: () => {
      const k = Math.max(0, d.t), pulse = 0.5 + 0.5 * Math.sin(S.t * 8);
      ex.strokeStyle = D.rgba(P.Y, 0.5 + 0.4 * pulse); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(d.x, d.y, 14, 7, 0, 0, TAU); ex.stroke(); ex.beginPath(); ex.moveTo(d.x - 4, d.y); ex.lineTo(d.x + 4, d.y); ex.moveTo(d.x, d.y - 2); ex.lineTo(d.x, d.y + 2); ex.stroke();
      if (k < 1) { const z = k * 140; ctx.fillStyle = D.rgba('#000000', 0.4 * (1 - k)); ctx.beginPath(); ctx.ellipse(d.x, d.y, 10 * (1 - k * 0.5), 4, 0, 0, TAU); ctx.fill(); D.blit(ctx, D.CSPR.supply[0], d.x, d.y - z, false, null); }
    } });
  };
})(D);
