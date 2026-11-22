/* 末班之后 · 小样二：敌人：驻军、警觉、每种一套招式、受伤与击毁掉落（从 combat.js 拆出来） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, Z = D.Z, VW = D.W / Z, VH = D.H / Z, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const Q = () => D.QUALITY;
  const K = D.K || (D.K = {}); // 站内各文件共用的内部函数
  // 别的文件里定义的函数：调用时再去 D.K 上找
  const rollItem = (...a) => K.rollItem(...a);
  const rollAmmo = (...a) => K.rollAmmo(...a);
  const scatter = (...a) => K.scatter(...a);
  const explode = (...a) => K.explode(...a);
  const part = (...a) => K.part(...a);
  const text = (...a) => K.text(...a);
  const ring = (...a) => K.ring(...a);
  const flashLight = (...a) => K.flashLight(...a);
  const addShake = (...a) => K.addShake(...a);
  const muzzle = (...a) => K.muzzle(...a);
  const deathBurst = (...a) => K.deathBurst(...a);
  const decal = (...a) => K.decal(...a);
  const damagePlayer = (...a) => K.damagePlayer(...a);

  function spawnGarrison(S, rng) {
    const st = S.st, al = S.raid.alert, lv = D.threatLv(S.raid), pool0 = D.GARRISON[st.type] || [['crawler', 1]];
    // 威胁 5 级起：拾荒蛛、自爆蜂一部分换成回收者和长眼（威胁改成 10 级以后，原来的 4 级大约是现在的 5 级）
    const pool = (lv >= 5 ? pool0.map(([k, w]) => [k, k === 'crawler' || k === 'bomber' ? w * 0.5 : w]).concat([['raider', 1 + (lv - 5) * 0.6], ['sniper', 0.6 + (lv - 5) * 0.25]]) : pool0).slice();
    // 杂兵：外环、威胁低的时候占一大半，越往里、越警戒越少
    const trashW = Math.max(0, (3 - st.tier) * 2.2 - (lv - 1) * 0.7); // 2026-11-19：威胁越高杂兵退得越快（原 0.5）
    if (trashW > 0) pool.push(['mite', trashW * 0.65], ['scav', trashW * 0.35]);
    const LT = D.LINE_THEMES[D.lineThemeOf(st)]; if (LT && !S.tut) pool.push([LT.enemy, LT.enemyW * (1 + st.tier * 0.25)]); // 主题线的特有敌人
    // 威胁专属敌人（enemies-threat.js）：到了它的等级哪一站都有，越新解锁的越常见、落后 5 级以上的少见；威胁越高占得越多（最多六成，2026-11-19 原四成五）
    const TF = (D.THREAT_FOES || []).filter(k => D.ENEMIES[k].threat <= lv);
    if (TF.length && !S.tut) { const tot = pool.reduce((s, c) => s + c[1], 0), share = Math.min(0.6, 0.08 * (lv - 2)), wk = k => (1 + 0.6 * (D.ENEMIES[k].threat - 3)) * (D.ENEMIES[k].threat < lv - 4 ? 0.4 : 1), ws = TF.reduce((s, k) => s + wk(k), 0); for (const k of TF) pool.push([k, tot * share / (1 - share) * wk(k) / ws]); }
    const GT = D.TUNE.garrison || { mul: 1, cap: 20 }, n = Math.min(GT.cap, Math.round((S.tut ? 1 : GT.mul) * (2 + st.tier + (trashW > 2 ? 2 : 0) + rng.int(0, 2) + Math.floor((lv - 1) * 0.55) + ((D.GARRISON_EXTRA || {})[st.type] || 0) + (D.DIFF[S.raid.diff || 0] || D.DIFF[0]).extra)));
    const spots = [];
    S.floors.forEach((F, fi) => { for (const sp of F.spawns) if (!(fi === 1 && sp.x < 12 * TS && sp.y > 10 * TS)) spots.push(Object.assign({ f: fi }, sp)); });
    // 撤离站：叫车的那一层最多 4 个普通守卫，多的挪到别的楼层（试玩反馈：撤离时站台上怪太多，打不过）
    const conF = S.isExit && S.console ? S.console.f : -1, others = spots.filter(q => q.f !== conF); let onCon = 0;
    const used = {}; // 出怪更杂：同一种出过越多，再抽到它的机会越小
    for (let i = 0; i < n && spots.length; i++) {
      let k = rng.weighted(pool.map(([q, w]) => [q, w / (1 + 1.2 * (used[q] || 0))])); used[k] = (used[k] || 0) + 1; if (k === 'medic' && i === 0) k = 'drone';
      if (!S.tut) k = D.upgradeFoe(lv, k, rng); // 威胁 4 级起：一部分换成同打法的威胁专属敌人（raid.js）
      let sp = rng.pick(spots); if (sp.f === conF && onCon >= 4 && others.length) sp = rng.pick(others);
      const F = S.floors[sp.f]; if (sp.f === conF) onCon += D.ENEMIES[k].pack || 1;
      let x, y, tries = 0;
      do { x = sp.x + rng.range(-sp.w / 2 + 20, sp.w / 2 - 20); y = sp.y + rng.range(-sp.h / 2 + 18, sp.h / 2 - 14); tries++; } while (D.solidAt(F, x, y) && tries < 30);
      const e = spawnEnemy(S, k, x, y, 0.6, sp.f); e.home = sp;
      if (D.ENEMIES[k].ambush) e.dormant = true; // 橱窗假人：装死
      for (let j = 1; j < (D.ENEMIES[k].pack || 1); j++) { const o = spawnEnemy(S, k, x + rng.range(-14, 14), y + rng.range(-10, 10), 0.6, sp.f); if (D.solidAt(F, o.x, o.y)) { o.x = x; o.y = y; } o.home = sp; i++; } // 野狗机：一群
    }
    // 杂兵群（2026-11-15 试玩：简单怪物多一些）：按危险等级再加几只锈螨 / 推车机，两三只一群分散在各房间
    const TT = D.TUNE.trash;
    if (TT && !S.tut) { const [a, b] = TT.perTier[Math.min(3, st.tier)]; let m = Math.round(rng.int(a, b) * Math.max(0, 1 - Math.max(0, lv - 3) * 0.14)); // 威胁 4 级起杂兵群越来越少，10 级基本没有
      while (m > 0 && spots.length) { const sp = rng.pick(spots), F = S.floors[sp.f], k = Math.min(m, rng.int(TT.pack[0], TT.pack[1])); m -= k;
        for (let j = 0; j < k; j++) { let x, y, tries = 0; do { x = sp.x + rng.range(-sp.w / 2 + 20, sp.w / 2 - 20); y = sp.y + rng.range(-sp.h / 2 + 18, sp.h / 2 - 14); tries++; } while (D.solidAt(F, x, y) && tries < 30); const e = spawnEnemy(S, rng.chance(0.6) ? 'mite' : 'scav', x, y, 0.6, sp.f); e.home = sp; } } }
    // 高价值房间：门里守着两三只
    S.floors.forEach((F, fi) => { for (const r of F.rooms) if (r.hv) { const k = 2 + (st.tier >= 2 ? 1 : 0); for (let i = 0; i < k; i++) { const x = (r.x + 1.5 + rng() * (r.w - 3)) * TS, y = (r.y + 1.5 + rng() * (r.h - 3)) * TS; if (D.solidAt(F, x, y)) continue; const e = spawnEnemy(S, D.upgradeFoe(lv, rng.weighted(pool.filter(([k]) => k !== 'medic' && k !== 'turret' && !D.ENEMIES[k].trash).concat([['raider', 1]])), rng), x, y, 0.6, fi); e.home = { x: (r.x + r.w / 2) * TS, y: (r.y + r.h / 2) * TS, w: r.w * TS, h: r.h * TS }; } } });
    if (K.spawnGuardBoss) K.spawnGuardBoss(S, rng); // M5：沦陷区的镇守首领（foes.js）
    if (D.ELITE_GUARD && D.ELITE_GUARD[st.type]) { const F = S.floors[1], x = 30 * TS + rng.range(-120, 120), y = 15 * TS; const e = spawnEnemy(S, 'engineer', x, y, 1, 1); e.home = { x, y, w: 200, h: 80 }; }
    if ((st.tier >= 2 || lv >= 4) && (rng.chance(0.15 + (lv - 1) * 0.07) || st.type === 'depot')) { const F = S.floors[0], h = F.rooms[0]; const e = spawnEnemy(S, 'engineer', (h.x + h.w / 2) * TS, (h.y + 3) * TS, 1, 0); e.home = { x: (h.x + h.w / 2) * TS, y: (h.y + h.h / 2) * TS, w: h.w * TS, h: h.h * TS }; }
  }
  // 发现你：头上冒感叹号，顺便叫醒附近的同伴
  function becomeAware(S, e) {
    if (e.aware) return; e.aware = true; e.notice = 1; e.cd = Math.max(e.cd, 0.6);
    if (e.f === S.f) { S.texts.push({ x: e.x, y: e.y - 26, s: '!', col: P.r, t: 0, big: true }); sfx('warn'); }
    alertAround(S, e.x, e.y, (D.TUNE.sense || {}).wake || 90, e.f);
  }
  // 听到动静：警觉值上来，并且走过去看看（头上一直挂着问号）
  function alertAround(S, x, y, r, f) { for (const o of S.enemies) if (!o.dead && !o.aware && o.f === (f == null ? S.f : f) && Math.hypot(o.x - x, o.y - y) < r) { o.notice = Math.max(o.notice, 0.55); o.invest = { x, y, t: o.t + 6 }; } }
  function spawnEnemy(S, kind, x, y, delay, f, aware) {
    const b = D.ENEMIES[kind], hpMul = (D.threatHp(S.raid) + S.st.tier * 0.04) * (D.DIFF[S.raid.diff || 0] || D.DIFF[0]).hp;
    const e = { kind, x, y, f: f == null ? S.f : f, aware: !!aware, notice: 0, wander: null, r: b.r, hp: Math.round(b.hp * hpMul), maxHp: Math.round(b.hp * hpMul), vx: 0, vy: 0, shield: 0, flash: 0, stun: 0, face: 1, t: S.rng() * 10, intent: null, tele: 0, teleMax: 1, act: null, cd: delay == null ? 0.8 : delay, spawnT: 0.35, dead: false, hitCd: {}, z: 0, phase: 1, step: 0, slot: S.rng() * TAU, shieldA: 0, healed: false, nadeCd: 4 + S.rng() * 3, pulseCd: 0, buffT: 0 };
    e.ai = b.base || kind; e.intent = nextIntent(S, e);
    S.enemies.push(e);
    if (e.f === S.f && aware) for (let i = 0; i < 10; i++) part(S, 'spark', x, y - 4, S.rng.range(-60, 60), S.rng.range(-80, 10), 0.3, P.c);
    return e;
  }

  // ───────────────────────── 敌人：每种一套招式
  function target(S) { return S.decoy || S.player; }
  function nextIntent(S, e) {
    const r = S.rng;
    const it = intentOf(S, e), mul = D.ENEMIES[e.kind].dmgMul; if (mul && it.dmg) { it.dmg = Math.max(1, Math.round(it.dmg * mul)); if (it.n && mul < 1) it.n = Math.max(1, it.n - 1); } return it;
  }
  function intentOf(S, e) {
    const r = S.rng;
    switch (e.ai || e.kind) {
      case 'crawler': return { k: 'leap', dmg: 8, tele: 0.35 };
      case 'drone': return { k: 'burst', dmg: 4, n: 3, tele: 0.55 };
      case 'sniper': return { k: 'snipe', dmg: 16, tele: 1.4 };
      case 'turret': return { k: 'mortar', dmg: 9, n: 3, tele: 0.6 };
      case 'bomber': return { k: 'arm', dmg: 14, tele: 0.7 };
      case 'medic': return { k: 'heal', sh: 15, tele: 0.5 };
      case 'raider': return e.nadeCd <= 0 ? { k: 'nade', dmg: 12, tele: 0.4 } : { k: 'burst', dmg: 7, n: 2, tele: 0.35 };
      case 'engineer': { const seq = ['hook', 'charge', 'armor', 'charge']; const k = seq[e.step++ % seq.length]; return k === 'charge' ? { k, dmg: 16, tele: 0.8 } : k === 'hook' ? { k, dmg: 6, tele: 0.6 } : { k, sh: 30, tele: 0.45 }; }
      case 'boss': {
        const f = e.phase === 2 ? 0.75 : 1, seq = e.phase === 2 ? ['slam', 'laser', 'ring', 'slam', 'ring'] : ['slam', 'ring', 'laser', 'slam'];
        const k = seq[e.step++ % seq.length];
        return k === 'slam' ? { k, dmg: 20, tele: 0.95 * f } : k === 'ring' ? { k, dmg: 7, n: e.phase === 2 ? 16 : 12, tele: 0.7 * f } : { k, dmg: 14, tele: 0.9 * f };
      }
      default: return K.intentX(S, e); // M5 的新敌人在 foes.js
    }
  }
  // 小队：同一层醒着的敌人 3 个以上时，约一半负责从侧面绕（flank = ±1），其余正面压
  function squadRole(S, e) {
    if (e.flankT > e.t) return e.flank || 0;
    e.flankT = e.t + 3;
    const n = S.enemies.filter(o => !o.dead && o.aware && o.f === e.f && o.kind !== 'turret').length, k = Math.floor(e.slot * 10);
    e.flank = n >= 3 && k % 2 ? (k % 4 === 1 ? 1 : -1) : 0;
    return e.flank;
  }
  // 掩体：柱子 / 箱子背对目标的一侧；flank 时更偏向侧面的掩体
  function findCover(S, e, T, maxD, fl) {
    let best = null, bestS = maxD; const ux = (T.x - e.x), uy = (T.y - e.y), ul = Math.hypot(ux, uy) || 1;
    for (const pr of S.A.props) {
      const vx = pr.x - T.x, vy = pr.y - 4 - T.y, l = Math.hypot(vx, vy) || 1, cx = pr.x + vx / l * 14, cy = pr.y - 4 + vy / l * 14, dd = Math.hypot(cx - e.x, cy - e.y);
      const side = fl ? ((cx - T.x) * (-uy / ul) + (cy - T.y) * (ux / ul)) * fl : 0, sc = dd - Math.max(0, side) * 0.6;
      if (sc < bestS && dd < maxD && l > 50 && !D.solidAt(S.A, cx, cy)) { bestS = sc; best = { x: cx, y: cy }; }
    }
    return best;
  }
  function enemyStep(S, e, dt) {
    e.t += dt; e.flash -= dt; e.spawnT -= dt; e.nadeCd -= dt; e.pulseCd -= dt; e.buffT -= dt;
    for (const k in e.hitCd) e.hitCd[k] -= dt;
    if (e.kind !== 'boss') D.move(S.A, e, e.vx * dt, e.vy * dt); else { e.x += e.vx * dt; e.y += e.vy * dt; }
    e.vx *= Math.pow(0.0015, dt); e.vy *= Math.pow(0.0015, dt);
    if (e.stun > 0) { e.stun -= dt; e.tele = 0; e.act = null; return; }
    if (e.spawnT > 0) return;
    if (D.offstage(S)) { e.act = null; e.tele = 0; return; } // 你还在车上：原地等着，不发现、不出招
    const T = target(S), dx = T.x - e.x, dy = T.y - e.y, d = Math.hypot(dx, dy) || 1, b = D.ENEMIES[e.kind], ux = dx / d, uy = dy / d;
    if (e.dormant) { if ((d < 44 && S.player.hp > 0) || e.hurtAt != null) { e.dormant = false; e.notice = 1; becomeAware(S, e); e.cd = 0; } else return; } // 装死的假人：走近或挨打才动
    if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
    if (e.kind === 'engineer' || (b.fshield && !e.shieldOff)) e.shieldA += D.angDiff(e.shieldA, Math.atan2(dy, dx)) * Math.min(1, dt * 2.2); // 护盾慢慢转向你
    const los = D.losClear(S.A, e.x, e.y - 6, T.x, T.y - 6);
    // 走不过去（中间隔着墙）就顺着寻路场绕
    const move = (vx, vy, s) => {
      let l = Math.hypot(vx, vy) || 1;
      if (!los && e.kind !== 'boss' && (vx * ux + vy * uy) / l > 0.2) { const f = D.flowDir(S.flow, S.A, e.x, e.y); if (f) { vx = f.x; vy = f.y; l = 1; } }
      if (e.kind === 'boss') { e.x += vx / l * s * dt; e.y += vy / l * s * dt; } else D.move(S.A, e, vx / l * s * dt, vy / l * s * dt);
    };
    // 没发现你：在自己房间里慢慢晃；看见你一小会儿（头上出问号）才进入战斗
    if (!e.aware) {
      const SN = D.TUNE.sense || { sight: 1, rate: 1, near: 2.2 }, sight = SN.sight * (b.sight || { sniper: 210, turret: 170, drone: 140, raider: 150, engineer: 130, medic: 110, bomber: 120, crawler: 100 }[e.ai || e.kind] || 120);
      const sees = S.player.hp > 0 && d < sight && los && !(S.player.cloakT > 0) && !e.blind; // blind：自己或你在烟里（arms.js）
      e.notice = Math.max(0, e.notice + (sees ? dt * SN.rate * (d < sight * 0.4 ? SN.near : 1) * (S.SH.trait.k === 'quiet' ? 0.5 : 1) * (S.raid.pas.quietstep ? 0.7 : 1) * D.fxOf(S.raid).notice : -dt * 0.5));
      if (e.notice >= 0.7) { becomeAware(S, e); return; }
      if (e.invest && e.t < e.invest.t && e.kind !== 'turret') {
        const wx = e.invest.x - e.x, wy = e.invest.y - e.y, l = Math.hypot(wx, wy) || 1;
        if (l > 16) { D.move(S.A, e, wx / l * b.speed * 0.6 * dt, wy / l * b.speed * 0.6 * dt); if (Math.abs(wx) > 2) e.face = wx > 0 ? 1 : -1; }
        else e.invest = null;
        e.notice = Math.max(e.notice, 0.25);
        return;
      }
      const h = e.home;
      if (h && e.kind !== 'turret') {
        if (!e.wander || Math.hypot(e.wander.x - e.x, e.wander.y - e.y) < 6 || e.t > e.wander.t) e.wander = { x: h.x + S.rng.range(-h.w / 2 + 20, h.w / 2 - 20), y: h.y + S.rng.range(-h.h / 2 + 20, h.h / 2 - 16), t: e.t + 4 };
        const wx = e.wander.x - e.x, wy = e.wander.y - e.y; D.move(S.A, e, wx / (Math.hypot(wx, wy) || 1) * b.speed * 0.3 * dt, wy / (Math.hypot(wx, wy) || 1) * b.speed * 0.3 * dt); if (Math.abs(wx) > 2) e.face = wx > 0 ? 1 : -1;
      }
      return;
    }
    if (e.act) { actStep(S, e, dt, T); return; }
    if (e.tele > 0) {
      e.tele -= dt;
      // 瞄准：蓄势时一直跟着你，最后一小段锁死方向——那一刻横移就能躲开（看不到弹道，只能看枪口闪光和倒计时）
      const lock = { burst: 0.15, snipe: 0.28, hook: 0.12, charge: 0.1, laser: 0, spray: 0.2, zap: 0.15, spit: 0.15 }[e.intent.k];
      if (lock != null && e.tele > lock) e.aimA = Math.atan2(T.y - 6 - (e.y - 8), dx);
      if (e.intent.k === 'leap' && e.tele > 0.15) e.mark = { x: T.x + (T.vx || 0) * 0.3, y: T.y + (T.vy || 0) * 0.3 };
      if (e.kind === 'bomber') move(ux, uy, 30);
      if (e.tele <= 0) startAct(S, e, T);
      return;
    }
    e.cd -= dt * 0.8; // 出手间隔比之前慢一些
    switch (e.ai || e.kind) {
      case 'crawler': { // 包抄：各自绕到你身边不同的位置；侧翼的先绕远一点再贴上来
        const fl = squadRole(S, e), far = fl && d > 50 ? 60 : 30, sx = T.x + Math.cos(e.slot + S.t * 0.3) * far, sy = T.y + Math.sin(e.slot + S.t * 0.3) * far * 0.73;
        const wob = Math.sin(e.t * 9) * 0.4;
        move(sx - e.x + (-uy) * wob * 20, sy - e.y + ux * wob * 20, b.speed * (Math.hypot(sx - e.x, sy - e.y) > 10 ? 1 : 0.3));
        if (e.cd <= 0 && d < 64) begin(S, e);
        break;
      }
      case 'drone': {
        // 挨了打：躲到掩体后面换位置
        if (e.t - (e.hurtAt == null ? -9 : e.hurtAt) < 1.6) { if (!e.cover || e.coverT < e.t) { e.cover = findCover(S, e, T, 110, squadRole(S, e)); e.coverT = e.t + 1.6; } if (e.cover && Math.hypot(e.cover.x - e.x, e.cover.y - e.y) > 5) { move(e.cover.x - e.x, e.cover.y - e.y, b.speed * 1.4); break; } }
        const fl = squadRole(S, e), want = d < 60 ? -1.3 : d > 140 ? 1 : 0, s = fl ? fl : Math.sin(e.t * 0.9 + e.slot);
        move(ux * want + (-uy) * s * 0.8, uy * want + ux * s * 0.8, b.speed * (d < 60 ? 1.5 : 1));
        if (e.cd <= 0 && d < 210 && los) begin(S, e);
        break;
      }
      case 'sniper': {
        const want = d < 150 ? -1 : d > 230 ? 0.7 : 0;
        move(ux * want + (-uy) * Math.sin(e.t * 0.5 + e.slot) * 0.4, uy * want + ux * Math.sin(e.t * 0.5 + e.slot) * 0.4, b.speed * (d < 60 ? 1.8 : 1));
        if (e.cd <= 0 && los && d > 50) begin(S, e);
        break;
      }
      case 'turret':
        if (d < 34 && e.pulseCd <= 0) { e.pulseCd = 3; shockwave(S, e); break; }
        if (e.cd <= 0 && d < 240) begin(S, e);
        break;
      case 'bomber': {
        const wob = Math.sin(e.t * 7 + e.slot) * 0.5;
        move(ux + (-uy) * wob, uy + ux * wob, b.speed);
        if (d < 26) begin(S, e);
        break;
      }
      case 'medic': {
        const allies = S.enemies.filter(o => !o.dead && o !== e && o.kind !== 'bomber');
        if (!allies.length || d < 60) { move(-ux + Math.sin(e.t) * 0.5, -uy + Math.cos(e.t) * 0.5, b.speed * 1.3); e.beam = null; break; }
        const hurtA = allies.reduce((a, o) => (o.hp / o.maxHp < a.hp / a.maxHp ? o : a), allies[0]);
        const hx = hurtA.x - ux * 26, hy = hurtA.y - uy * 26; // 躲在伤员身后
        move(hx - e.x, hy - e.y, Math.hypot(hx - e.x, hy - e.y) > 6 ? b.speed : 0);
        if (Math.hypot(hurtA.x - e.x, hurtA.y - e.y) < 70 && hurtA.hp < hurtA.maxHp) { hurtA.hp = Math.min(hurtA.maxHp, hurtA.hp + 8 * dt); e.beam = hurtA; } else e.beam = null;
        if (e.cd <= 0) { e.target = hurtA; begin(S, e); }
        break;
      }
      case 'raider': {
        if (!e.healed && e.hp < e.maxHp * 0.4) { e.healed = true; e.act = { k: 'medkit', t: 0 }; text(S, e.x, e.y - 22, '+', P.g); break; }
        // 找掩体：离自己近、站在柱子/箱子背对你的一侧
        if (!e.cover || e.t > e.coverT) {
          e.coverT = e.t + S.rng.range(2, 3.5); e.cover = findCover(S, e, T, e.t - (e.hurtAt == null ? -9 : e.hurtAt) < 1 ? 160 : 130, squadRole(S, e));
        }
        if (e.cover && Math.hypot(e.cover.x - e.x, e.cover.y - e.y) > 6) move(e.cover.x - e.x, e.cover.y - e.y, b.speed);
        else { const s = Math.sin(e.t * 2 + e.slot); move(-uy * s, ux * s, b.speed * 0.5); } // 在掩体边探头
        if (e.cd <= 0 && d < 200 && (los || e.nadeCd <= 0)) { e.intent = nextIntent(S, e); begin(S, e); }
        break;
      }
      case 'engineer': move(ux, uy, b.speed * (d > 50 ? 1 : 0)); if (e.cd <= 0) begin(S, e); break;
      case 'boss': {
        if (e.phase === 1 && e.hp < e.maxHp / 2) { e.phase = 2; S.banner = { t: 0, text: '过热', sub: '钳工-9 进入第二阶段' }; addShake(S, 0.6); }
        move(ux, uy * 0.6, b.speed * (d > 70 ? 1 : 0));
        e.x = D.clamp(e.x, 4 * TS, S.A.w - 4 * TS); e.y = D.clamp(e.y, 13 * TS, 18 * TS);
        if (e.cd <= 0) begin(S, e);
        break;
      }
      default: K.stepX(S, e, dt, T, d, ux, uy, los, move, b); // M5 的新敌人在 foes.js
    }
  }
  function begin(S, e) {
    e.tele = e.teleMax = e.intent.tele * 1.25; e.mark = null; // 蓄势更长，更好躲
    if (e.intent.k === 'slam') { const T = target(S); e.mark = { x: D.clamp(T.x + (T.vx || 0) * 0.45, 40, S.A.w - 40), y: D.clamp(T.y + (T.vy || 0) * 0.45, 13 * TS, 19 * TS) }; }
    if (e.kind === 'bomber') sfx('beep'); else if (e.kind === 'sniper') sfx('charge'); else if (e.kind === 'boss') sfx('bosswarn');
  }
  function startAct(S, e, T) {
    const it = e.intent, a = Math.atan2(T.y - e.y, T.x - e.x);
    switch (it.k) {
      case 'leap': { const m = e.mark || T; const d = Math.min(110, Math.hypot(m.x - e.x, m.y - e.y) + 12), la = Math.atan2(m.y - e.y, m.x - e.x); e.act = { k: 'leap', t: 0.24, vx: Math.cos(la) * d / 0.24, vy: Math.sin(la) * d / 0.24, hit: false }; sfx('leap'); break; }
      case 'burst': e.act = { k: 'burst', t: 0, n: it.n, gap: e.kind === 'raider' ? 0.14 : 0.1 }; break;
      case 'snipe': hitscan(S, e, e.aimA, it.dmg, 0.015, P.c, 420); e.cd = S.rng.range(3, 4); e.act = { k: 'relocate', t: 0, dur: 1, a: a + Math.PI + S.rng.range(-1.2, 1.2) }; e.intent = nextIntent(S, e); addShake(S, 0.2); break;
      case 'mortar': for (let i = 0; i < it.n; i++) { const lead = i * 0.35; S.shells.push({ sx: e.x, sy: e.y - 16, tx: D.clamp(T.x + (T.vx || 0) * lead + S.rng.range(-14, 14), 20, S.A.w - 20), ty: D.clamp(T.y + (T.vy || 0) * lead + S.rng.range(-10, 10), 40, S.A.h - 20), t: -i * 0.22, dur: 0.95, dmg: it.dmg }); } sfx('orb'); flashLight(S, e.x, e.y - 16, 60, P.m, 1); e.cd = S.rng.range(2.4, 3.2); e.intent = nextIntent(S, e); break;
      case 'arm': explode(S, e.x, e.y - 4, 26, it.dmg, true); e.hp = 0; kill(S, e, true); break;
      case 'heal': { const o = e.target; if (o && !o.dead) { o.shield += it.sh; ring(S, o.x, o.y - 8, 18, P.g); S.beams.push({ x0: e.x, y0: e.y - 8, x1: o.x, y1: o.y - 8, t: 0.3, max: 0.3, col: P.g }); } e.cd = 5; e.intent = nextIntent(S, e); sfx('shield'); break; }
      case 'nade': { const tx = T.x + (T.vx || 0) * 0.5, ty = T.y + (T.vy || 0) * 0.5; S.nades.push({ x: e.x, y: e.y - 8, sx: e.x, sy: e.y - 8, tx, ty, t: 0, fly: 0.45, fuse: 1.5, dmg: it.dmg }); e.nadeCd = S.rng.range(6, 9); e.cd = 1.2; e.intent = nextIntent(S, e); sfx('throw'); break; }
      case 'charge': e.act = { k: 'charge', t: 0, vx: Math.cos(e.aimA) * 270, vy: Math.sin(e.aimA) * 270, hit: false }; sfx('charge2'); break;
      case 'hook': S.eshots.push({ k: 'hook', x: e.x, y: e.y - 10, vx: Math.cos(e.aimA) * 260, vy: Math.sin(e.aimA) * 260, life: 0.9, dmg: it.dmg, r: 3, col: P[5], from: e }); e.cd = 1.0; e.intent = nextIntent(S, e); sfx('throw'); break;
      case 'armor': e.shield += it.sh; ring(S, e.x, e.y - 8, 20, P.c); e.cd = 0.8; e.intent = nextIntent(S, e); sfx('shield'); break;
      case 'ring': e.act = { k: 'ringwave', t: 0, waves: e.phase === 2 ? 3 : 2, gap: 0.28, n: it.n, dmg: it.dmg, off: S.rng() }; break;
      case 'slam': e.act = { k: 'slam', t: 0, dur: 0.42, sx: e.x, sy: e.y, tx: e.mark.x, ty: e.mark.y }; sfx('leap'); break;
      case 'laser': e.act = { k: 'laser', t: 0, dur: 1.3, a0: e.aimA != null ? e.aimA : a, dir: S.rng.chance(0.5) ? 1 : -1, sweep: e.phase === 2 ? 1.6 : 1.1 }; sfx('laser'); break;
      default: K.startX(S, e, T, a);
    }
  }
  function actStep(S, e, dt, T) {
    const A = e.act, p = S.player; A.t += dt;
    const done = () => { e.act = null; e.intent = nextIntent(S, e); };
    switch (A.k) {
      case 'leap':
        D.move(S.A, e, A.vx * dt, A.vy * dt); A.t -= 2 * dt; e.z = Math.sin(Math.max(0, A.t) / 0.24 * Math.PI) * 8;
        if (!A.hit && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 2) { A.hit = true; damagePlayer(S, e.intent.dmg, e); }
        if (A.t <= 0) { e.z = 0; e.cd = S.rng.range(1.0, 1.4); e.act = A.hit ? { k: 'flee', t: 0, dur: 0.6 } : null; if (!A.hit) e.intent = nextIntent(S, e); }
        break;
      case 'flee': { const a = Math.atan2(e.y - T.y, e.x - T.x); D.move(S.A, e, Math.cos(a) * 110 * dt, Math.sin(a) * 110 * dt); if (A.t >= A.dur) done(); break; }
      case 'relocate': D.move(S.A, e, Math.cos(A.a) * 70 * dt, Math.sin(A.a) * 70 * dt); if (A.t >= A.dur) e.act = null; break;
      case 'medkit': if (A.t > 1.2) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.5); ring(S, e.x, e.y - 6, 14, P.g); e.act = null; } break;
      case 'burst':
        if (A.t >= A.gap) { A.t = 0; A.n--; hitscan(S, e, e.aimA, e.intent.dmg, (e.kind === 'raider' ? 0.06 : 0.07) * (D.ENEMIES[e.kind].spreadMul || 1), e.kind === 'raider' ? P.O : P.r, 260); }
        if (A.n <= 0) { e.cd = S.rng.range(1.3, 2); done(); if (e.ai === 'drone') e.act = { k: 'relocate', t: 0, dur: 0.35, a: Math.atan2(T.y - e.y, T.x - e.x) + (S.rng.chance(0.5) ? 1.4 : -1.4) }; }
        break;
      case 'charge': {
        const bx = e.x, by = e.y; D.move(S.A, e, A.vx * dt, A.vy * dt);
        if (S.t % 0.04 < dt) part(S, 'spark', e.x - A.vx * 0.03, e.y - 4, S.rng.range(-40, 40), S.rng.range(-50, 0), 0.25, P.O);
        if (!A.hit && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 3) { A.hit = true; damagePlayer(S, e.intent.dmg, e); }
        const wall = Math.hypot(e.x - bx, e.y - by) < 0.6 * Math.hypot(A.vx * dt, A.vy * dt);
        if (A.t >= 0.55 || wall) { if (wall) { e.stun = 1.1; addShake(S, 0.4); for (let i = 0; i < 14; i++) part(S, 'debris', e.x, e.y, S.rng.range(-80, 80), S.rng.range(-80, 80), 0.6, P[3]); sfx('slam'); } e.cd = 0.9; done(); }
        break;
      }
      case 'slam': {
        const k = Math.min(1, A.t / A.dur);
        e.x = D.lerp(A.sx, A.tx, D.ease.inOut(k)); e.y = D.lerp(A.sy, A.ty, D.ease.inOut(k)); e.z = Math.sin(k * Math.PI) * 34;
        if (k >= 1) {
          e.z = 0; const R = 44;
          if (Math.hypot(p.x - e.x, p.y - e.y) < R) damagePlayer(S, e.intent.dmg, e);
          ring(S, e.x, e.y, R + 4, P.O); ring(S, e.x, e.y, R - 12, P.r); decal(S, e.x, e.y, 26);
          for (let i = 0; i < 30; i++) { const b = S.rng() * TAU; part(S, 'debris', e.x, e.y, Math.cos(b) * S.rng.range(40, 140), Math.sin(b) * S.rng.range(40, 140), S.rng.range(0.5, 1), S.rng.pick([P[3], P[2], P.t])); }
          if (e.phase === 2) for (let i = 0; i < 10; i++) eshot(S, e.x, e.y - 6, i / 10 * TAU, 80, 6, P.O);
          addShake(S, 0.8); S.stop = 0.06; flashLight(S, e.x, e.y, 140, P.O, 1.3); sfx('slam');
          e.cd = 0.8; done();
        }
        break;
      }
      case 'ringwave':
        if (A.t >= A.gap) { A.t = 0; A.waves--; for (let i = 0; i < A.n; i++) eshot(S, e.x, e.y - 20, (i + (A.waves % 2) * 0.5) / A.n * TAU + A.off, 85, A.dmg, P.O); flashLight(S, e.x, e.y - 20, 70, P.O, 1); sfx('orb'); }
        if (A.waves <= 0) { e.cd = 0.9; done(); }
        break;
      case 'laser': {
        const k = A.t / A.dur; A.a = A.a0 + A.dir * A.sweep * D.ease.inOut(Math.min(1, k)) - A.dir * A.sweep * 0.5;
        const ox = e.x, oy = e.y - 22; let len = 0; while (len < 420 && !D.solidAt(S.A, ox + Math.cos(A.a) * len, oy + Math.sin(A.a) * len)) len += 4;
        A.len = len;
        const t = D.clamp((p.x - ox) * Math.cos(A.a) + (p.y - 6 - oy) * Math.sin(A.a), 0, len);
        if (Math.hypot(p.x - (ox + Math.cos(A.a) * t), p.y - 6 - (oy + Math.sin(A.a) * t)) < 7 && !(e.hitCd.p > 0)) { e.hitCd.p = 0.4; damagePlayer(S, e.intent.dmg, e); }
        if (S.t % 0.03 < dt) part(S, 'spark', ox + Math.cos(A.a) * len, oy + Math.sin(A.a) * len, S.rng.range(-60, 60), S.rng.range(-80, 0), 0.3, P.R);
        S.tlights.push({ x: ox + Math.cos(A.a) * len, y: oy + Math.sin(A.a) * len, r: 40, col: P.r, a: 0.9, decay: 30 });
        if (k >= 1) { e.cd = 1.0; done(); }
        break;
      }
      default: K.actX(S, e, dt, T, done);
    }
  }
  // 瞬时射击：看不到弹道，打完才留下曳光
  function hitscan(S, e, ang, dmg, spread, col, range) {
    if (e.blind) spread *= 6; // 烟里乱打
    const p = S.player, a = ang + S.rng.range(-spread, spread), ox = e.x + Math.cos(a) * 7, oy = e.y - (e.kind === 'drone' ? 14 : e.kind === 'welder' ? 10 : 8) + Math.sin(a) * 7;
    let len = 0; while (len < range && !D.solidAt(S.A, ox + Math.cos(a) * len, oy + 6 + Math.sin(a) * len)) len += 3;
    const tgt = S.decoy || p;
    if (tgt === p) S.attackedAt = S.t; // 朝你开枪（打中没打中都算，搜刮页外框标红用）
    const t = D.clamp((tgt.x - ox) * Math.cos(a) + (tgt.y - 6 - oy) * Math.sin(a), 0, len);
    const hit = Math.hypot(tgt.x - (ox + Math.cos(a) * t), tgt.y - 6 - (oy + Math.sin(a) * t)) < (tgt === p ? p.r + 1.5 : 7);
    const end = hit ? t : len;
    S.tracers.push({ x0: ox, y0: oy, x1: ox + Math.cos(a) * end, y1: oy + Math.sin(a) * end, t: 0.09, max: 0.09, col, w: dmg >= 20 ? 2 : 1 });
    muzzle(S, ox, oy, a, col, dmg >= 20 ? 1.5 : 0.7);
    sfx(dmg >= 20 ? 'snipe' : 'eshot');
    if (hit && tgt === p && p.hp > 0) { if (p.inv <= 0) damagePlayer(S, dmg, e); else K.perfectDodge(S); }
    else for (let i = 0; i < 3; i++) part(S, 'spark', ox + Math.cos(a) * end, oy + Math.sin(a) * end, S.rng.range(-40, 40), S.rng.range(-40, 40), 0.2, col);
  }
  function shockwave(S, e) { const p = S.player, a = Math.atan2(p.y - e.y, p.x - e.x); ring(S, e.x, e.y, 36, P.m); if (Math.hypot(p.x - e.x, p.y - e.y) < 38) { damagePlayer(S, 6, e); p.vx += Math.cos(a) * 260; p.vy += Math.sin(a) * 260; } sfx('slam'); addShake(S, 0.3); }
  function eshot(S, x, y, a, s, dmg, col) { S.eshots.push({ k: 'orb', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 3, dmg, r: 3, col }); }

  // ───────────────────────── 伤害
  function hurt(S, e, dmg, o) {
    if (e.dead) return; o = o || {};
    if (S.players && S.players.length > 1 && S.player) { e.hitBy = S.player.pid; e.hitT = S.t; } // 联机：记下是谁打的，它会先追这个人（mp-core.js）
    if (o.elec && e.wet) dmg *= 1.5; // 水淹站：电打水里的敌人更疼
    if (e.markT > 0) dmg *= 1.5; // 鹰眼标记
    let left = dmg;
    if (e.shield > 0 && !o.noShield) { const a = Math.min(e.shield, left); e.shield -= a; left -= a; if (a && !o.dot) text(S, e.x, e.y - 20, a, P.c, true); }
    e.hp -= left; e.flash = 0.1; e.lastMelee = !!o.melee; e.hurtAt = e.t;
    // 持续伤害（着火、喷火枪的火流）：不顿帧、不震屏、不每下都响
    if (o.dot) { if (left > 0 && S.rng.chance(0.25)) text(S, e.x + S.rng.range(-4, 4), e.y - 18 - e.z, Math.max(1, Math.round(left * 3)), '#ff8a2e'); if (!e.aware) becomeAware(S, e); if (e.hp <= 0) kill(S, e); return; }
    if (e.ai === 'drone' || e.kind === 'raider' || e.kind === 'sniper') e.cd = Math.min(e.cd, 0.6);
    const l = Math.hypot(o.kx || 0, o.ky || 0) || 1, kb = (o.kb || 40) * (D.ENEMIES[e.kind].boss ? 0.1 : e.kind === 'engineer' ? 0.4 : e.kind === 'turret' ? 0 : 1);
    e.vx += (o.kx || 0) / l * kb; e.vy += (o.ky || 0) / l * kb;
    const heavy = left >= 15 || o.crit;
    if (left > 0) text(S, e.x + S.rng.range(-4, 4), e.y - 18 - e.z, Math.round(left), o.crit ? P.R : left >= 15 ? P.Y : P[6], heavy);
    const col = o.col || P.O, ang = Math.atan2(o.ky || 0, o.kx || 1);
    for (let i = 0; i < 6 + Math.min(10, left); i++) { const b = ang + S.rng.range(-0.8, 0.8), s = S.rng.range(60, 180); part(S, 'spark', e.x, e.y - 5 - e.z, Math.cos(b) * s, Math.sin(b) * s, S.rng.range(0.15, 0.35), S.rng.chance(0.5) ? col : P.Y); }
    if (o.slash) S.ghosts.push({ k: 'slash', x: e.x, y: e.y - 6, a: ang, t: 0.12 });
    flashLight(S, e.x, e.y - 6, 40, col, 0.8);
    // 顿帧按伤害分四档；轻击的顿帧有间隔，冲锋枪连射不会一直卡
    const stop = left >= 30 ? 0.085 : heavy ? 0.06 : left >= 6 ? 0.035 : 0.014;
    if (stop >= 0.035 || S.t - (S.lightStopT || -1) > 0.15) { S.stop = Math.max(S.stop, stop); if (stop < 0.035) S.lightStopT = S.t; }
    addShake(S, Math.min(0.35, 0.08 + left * 0.012));
    sfx(o.crit ? 'crit' : heavy ? 'hit2' : 'hit'); S.hitMark = { t: 0.14, kill: false };
    if (!e.aware) becomeAware(S, e);
    if (e.hp <= 0) kill(S, e);
  }
  const CONT_TRASH = () => D.CONT.trash;
  function kill(S, e, self) {
    if (e.dead) return;
    e.dead = true; if (!self) { S.kills++; S.hitMark = { t: 0.3, kill: true }; sfx('kill'); if (K.capGain && S.player) K.capGain(S, D.SHELL.capPerKill); }
    const big = D.ENEMIES[e.kind].boss ? 3 : e.minion ? 0.6 : e.kind === 'engineer' ? 1.8 : 1;
    if (e.kind === 'bomber' && !self) explode(S, e.x, e.y - 4, 26, 14, true, true); // 殉爆
    deathBurst(S, e.x, e.y - 5, e.kind === 'crawler' || e.kind === 'medic' ? P.g : e.kind === 'turret' ? P.m : e.kind === 'raider' ? P.O : e.kind === 'sniper' ? P.c : P.r, big);
    decal(S, e.x, e.y, 8 * big);
    if (!D.ENEMIES[e.kind].human) for (let i = 0; i < 5 * big; i++) part(S, 'debris', e.x, e.y - 5, S.rng.range(-90, 90), S.rng.range(-90, 30), S.rng.range(0.6, 1.1), S.rng.pick([P[2], P[3], P[4]])); // 机器碎成零件
    S.stop = Math.max(S.stop, 0.07 * Math.min(2, big)); addShake(S, 0.4 * big);
    const lv = D.ENEMIES[e.kind].loot;
    const isTrash = D.ENEMIES[e.kind].trash, TT = D.TUNE.trash;
    if (!self && !e.noLoot && (lv > 0 || S.rng.chance(isTrash && TT ? TT.drop : 0.3))) {
      const bonus = D.ENEMIES[e.kind].boss ? 2 : e.kind === 'engineer' ? 1 : e.kind === 'raider' ? 1 : 0;
      const n = Math.max(1, lv) + (S.SH.trait.k === 'hack' && !D.ENEMIES[e.kind].human ? 1 : 0), x = D.clamp(e.x, 24, S.A.w - 24);
      for (let i = 0; i < n; i++) { const r = rollItem(S, S.rng, bonus, isTrash ? CONT_TRASH() : undefined); scatter(S, x, e.y, e.f, r.id, r.n); } // 杂兵掉的是低级材料
      if (D.ENEMIES[e.kind].boss) scatter(S, x, e.y, e.f, 'core', 1);
      if (D.ENEMIES[e.kind].human && S.rng.chance(D.KEY_DROP.enemy)) scatter(S, x, e.y, e.f, S.rng.chance(0.85) ? 'key1' : 'key2', 1); // 回收者偶尔带着门禁卡
    }
    if (!self && !e.noLoot && e.kind !== 'bomber' && S.rng.chance(e.kind === 'raider' ? 0.9 : 0.6)) { const a = rollAmmo(S, S.rng, 2 + Math.min(2, S.st.tier)); S.drops.push({ x: e.x + S.rng.range(-6, 6), y: e.y + S.rng.range(-3, 3), id: a.id, n: a.n, t: 0, f: e.f }); }
    if (!self && D.Growth) D.Growth.onKill(S, e); // 委托：击毁计数
    if (!self && D.Story) D.Story.onKill(S, e, D.clamp(e.x, 24, S.A.w - 24)); // 主线：击毁掉落的线索、委托物
    if (!self && K.onKillX) K.onKillX(S, e); // M5：连锁电容
    if (!self && S.raid.pas.recycler && S.player.hp > 0) { S.player.hp = Math.min(S.player.maxHp, S.player.hp + 3); text(S, S.player.x, S.player.y - 24, '+3', P.g); }
    sfx(e.kind === 'boss' ? 'bossdie' : 'boom');
  }
  Object.assign(K, { spawnGarrison, becomeAware, alertAround, spawnEnemy, target, nextIntent, enemyStep, begin, startAct, actStep, hitscan, shockwave, eshot, hurt, kill });
})(D);
