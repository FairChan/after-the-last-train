/* 末班之后 · 小样二：M5 敌人包：潜行者、干扰机、重机枪手，三个镇守首领（蜂后、铁闸、档案官）。
   数据、像素图、招式都在这里；enemy.js 的 intentOf / enemyStep / startAct / actStep 走不到的招式交给 K.intentX / stepX / startX / actX。
   设计：design/features/content/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const K = D.K || (D.K = {});
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a);
  const isBoss = e => !!D.ENEMIES[e.kind].boss;

  // ── 数据
  Object.assign(D.ENEMIES, {
    stalker: { name: '潜行者', hp: 30, r: 5, speed: 84, loot: 2, sight: 130, tag: '带光学迷彩的猎杀机', moves: ['隐身：离你远时几乎看不见，走近 60 像素或挨打才现形', '连斩：贴上来连砍两刀', '再隐身：砍完退开，过一会儿又看不见了'] },
    jammer: { name: '干扰机', hp: 28, r: 6, speed: 26, loot: 2, sight: 150, tag: '飘在后排的电子战机，先打它', moves: ['干扰场：离它 120 像素以内，你的模块冷却暂停', '催促：周围的机器动作快 25%', '电击：偶尔放一道很弱的电', '躲：你靠近就往后飘'] },
    gunner: { name: '重机枪手', hp: 60, r: 6, speed: 34, loot: 3, human: true, sight: 170, tag: '扛着重机枪的回收者老手', moves: ['架枪：蹲下架好重机枪，枪口亮起来', '扫射：一口气扫 12 发；扫的时候转身很慢，绕到侧面躲', '换弹：扫完要换很久，这时候冲上去'] },
    queen: { name: '蜂后', hp: 520, r: 12, speed: 46, loot: 4, boss: true, guard: 'nest', tag: '沦陷区虫巢的镇守首领：虫群的母机', moves: ['下蛋：一次放出几只锈螨、自爆蜂', '扑击：蓄一下直线扑过来，撞墙会晕', '喷酸：一扇五发酸弹', '暴躁（半血）：放一圈圈子弹，下蛋更多'] },
    warden: { name: '铁闸', hp: 640, r: 13, speed: 22, loot: 4, boss: true, fshield: true, guard: 'checkpoint', tag: '沦陷区检查站的镇守首领：履带闸门机', moves: ['大盾：正面的盾挡住子弹，绕后打或用近战', '迫击炮：三连抛射，落点有圈', '横扫激光：一道激光扫过来，闪避或躲到墙后', '护盾碎了（半血）：叫来两架哨兵，炮弹更多'] },
    archivist: { name: '档案官', hp: 460, r: 10, speed: 40, loot: 4, boss: true, guard: 'datacenter', tag: '沦陷区数据中心的镇守首领：管服务器的老系统', moves: ['瞬移：闪一下换个地方', '全息分身：放两个会开枪的分身，打一下就碎', '电弧：瞄你一会儿，然后一道电打过来（闪避能躲）', '电网（半血）：地上一格格亮起来，亮完就通电'] },
  });
  const addG = (st, k, w) => { if (D.GARRISON[st]) D.GARRISON[st].push([k, w]); };
  addG('hangar', 'stalker', 0.8); addG('depot', 'stalker', 1); addG('checkpoint', 'stalker', 1.2);
  addG('datacenter', 'jammer', 1.2); addG('relay', 'jammer', 1); addG('factory', 'jammer', 0.8);
  addG('armory', 'gunner', 1.5); addG('market', 'gunner', 0.6); addG('bank', 'gunner', 0.8);
  // 首领战利品：只从首领身上掉
  const TROPHY = D.BOSS_TROPHY = { queen: 'tr_queen', warden: 'tr_warden', archivist: 'tr_archivist' }; // 新首领（bosses-bx.js）往这里加自己的
  Object.assign(D.ITEMS, {
    tr_queen:     { name: '蜂后晶囊', q: 4, v: 1900, cat: 'val', art: 'tr_queen', w: 2, h: 2, stack: 1, noLoot: true },
    tr_warden:    { name: '铁闸主闸片', q: 4, v: 2300, cat: 'part', art: 'tr_warden', w: 2, h: 2, stack: 1, noLoot: true },
    tr_archivist: { name: '档案官记忆体', q: 5, v: 2600, cat: 'elec', art: 'tr_archivist', w: 2, h: 2, stack: 1, noLoot: true },
  });
  Object.assign(D.ITEM_ART, {
    tr_queen: p => { p.ell(14, 15, 9, 10, R.rust, { spec: true }); p.disc(14, 15, 4, '#ff7a2e', 1); p.disc(14, 15, 2, '#ffd0a0', 1); p.rect(12, 3, 4, 3, '#3b2018'); },
    tr_warden: p => { p.box(3, 6, 22, 16, R.steel, { r: 2 }); p.rect(5, 12, 18, 3, '#ff3047', 1); for (let x = 6; x < 23; x += 4) p.rect(x, 18, 2, 2, '#e3c14a'); },
    tr_archivist: p => { p.box(6, 3, 16, 22, R.blue, { r: 2 }); for (let i = 0; i < 4; i++) p.rect(9, 7 + i * 4, 10 - (i % 2) * 3, 1, '#3ee8ff', 1); p.rect(10, 1, 8, 2, '#e3c14a'); },
  });

  // ── 像素图（initHiArt 时一起画；图鉴按 kind 去 D.SPR 里找）
  const mk = (w, h, fn) => { const p = D.Paint(w, h); fn(p); p.outline(); return p.make(2); };
  const h0 = D.initHiArt;
  D.initHiArt = function () {
    const r = h0 ? h0.apply(this, arguments) : undefined, S = D.SPR;
    S.stalker = mk(18, 22, p => { p.ell(9, 4, 3.5, 3.5, R.dark, { spec: true }); p.rect(7, 3, 5, 1, '#ff3d8b', 1); p.box(6, 8, 7, 8, R.steel, { r: 2 }); p.line(5, 9, 1, 16, '#c8cdda'); p.line(13, 9, 17, 16, '#c8cdda'); p.rect(6, 16, 2, 6, '#34405f'); p.rect(11, 16, 2, 6, '#34405f'); });
    S.jammer = mk(22, 20, p => { p.ell(11, 11, 7, 6, R.gunmetal, { spec: true }); p.disc(11, 11, 2.5, '#ffd84a', 1); p.line(6, 6, 2, 1, '#949fb6'); p.line(16, 6, 20, 1, '#949fb6'); p.px(2, 1, '#ffd84a', 1); p.px(20, 1, '#ffd84a', 1); p.rect(1, 10, 4, 3, '#434b5f'); p.rect(17, 10, 4, 3, '#434b5f'); });
    S.gunner = mk(20, 24, p => { p.ell(10, 5, 4, 4, R.olive, { spec: true }); p.rect(7, 4, 6, 2, '#ff7a2e', 1); p.box(4, 9, 12, 9, R.olive, { r: 2 }); p.box(1, 9, 4, 8, R.cloth, { r: 1 }); p.rect(5, 13, 10, 1, '#e3c14a'); p.rect(5, 18, 3, 6, '#253017'); p.rect(12, 18, 3, 6, '#253017'); });
    S.queen = mk(40, 30, p => {
      p.ell(18, 5, 9, 4, R.glass, { flat: true }); p.ell(28, 4, 7, 3, R.glass, { flat: true });
      p.ell(14, 18, 11, 9, R.rust, { spec: true }); p.rect(6, 15, 16, 1, '#3b2018'); p.rect(5, 19, 18, 1, '#3b2018');
      p.ell(28, 14, 7, 6, R.dark, { spec: true }); p.disc(31, 12, 1.5, '#ffe14a', 1); p.disc(27, 12, 1.5, '#ffe14a', 1);
      p.disc(10, 24, 2, '#ff7a2e', 1); p.disc(17, 25, 2, '#ff7a2e', 1);
      for (const x of [22, 27, 32]) { p.line(x, 19, x - 2, 28, '#2d3550'); }
    });
    S.warden = mk(44, 36, p => {
      p.box(2, 26, 40, 9, R.dark, { r: 2 }); for (let x = 4; x < 40; x += 4) p.rect(x, 29, 2, 3, '#0c0e17');
      p.box(6, 12, 32, 15, R.steel, { r: 3 }); p.rect(7, 22, 30, 2, '#e3c14a'); for (let x = 8; x < 36; x += 6) p.rect(x, 22, 3, 2, '#1b1d12');
      p.box(14, 4, 16, 10, R.gunmetal, { r: 2 }); p.rect(17, 7, 10, 2, '#ff3047', 1); p.rect(30, 1, 4, 9, '#646e86');
    });
    S.archivist = mk(24, 34, p => {
      p.box(4, 10, 16, 22, R.blue, { r: 3, bias: -0.1 }); for (const [y, w] of [[14, 10], [18, 8], [22, 9], [26, 6]]) p.rect(7, y, w, 1, '#3ee8ff', 1);
      p.box(6, 1, 12, 9, R.dark, { r: 2 }); p.rect(8, 3, 8, 5, '#0b0a14'); p.rect(10, 4, 4, 2, '#3ee8ff', 1);
      p.rect(0, 12, 3, 5, '#a6e2f0', 1); p.rect(21, 12, 3, 5, '#a6e2f0', 1);
    });
    return r;
  };

  // ── 招式表（每种敌人下一招是什么）
  const SEQ = {
    queen: [['brood', 'swoop', 'spit', 'swoop'], ['ring', 'swoop', 'brood', 'ring', 'spit']],
    warden: [['mortar', 'charge', 'laser', 'mortar'], ['summon', 'laser', 'mortar', 'charge', 'laser']],
    archivist: [['blink', 'holo', 'arcz', 'blink', 'arcz'], ['blink', 'grid', 'holo', 'arcz', 'grid']],
  };
  K.intentX = function (S, e) {
    const two = e.phase === 2;
    switch (e.kind) {
      case 'stalker': return { k: 'slash2', dmg: 9, tele: 0.3 };
      case 'jammer': return { k: 'zap', dmg: 3, tele: 0.6 };
      case 'gunner': return { k: 'spray', dmg: 5, n: 12, tele: 0.9 };
    }
    const seq = SEQ[e.kind]; if (!seq) return { k: 'burst', dmg: 4, n: 3, tele: 0.55 };
    const s = seq[two ? 1 : 0], k = s[e.step++ % s.length], f = two ? 0.8 : 1;
    switch (k) {
      case 'brood': return { k, n: two ? 3 : 2, tele: 0.8 * f };
      case 'swoop': return { k: 'charge', dmg: 14, tele: 0.75 * f };
      case 'spit': return { k, dmg: 6, n: 5, tele: 0.6 * f };
      case 'ring': return { k, dmg: 6, n: 12, tele: 0.7 * f };
      case 'mortar': return { k, dmg: 10, n: two ? 5 : 3, tele: 0.7 * f };
      case 'laser': return { k, dmg: 12, tele: 0.9 * f };
      case 'charge': return { k, dmg: 16, tele: 0.9 };
      case 'summon': return { k, tele: 0.8 };
      case 'blink': return { k, tele: 0.45 };
      case 'holo': return { k, tele: 0.6 };
      case 'arcz': return { k, dmg: 10, tele: 0.8 * f };
      case 'grid': return { k, dmg: 10, tele: 0.5 };
    }
    return { k: 'burst', dmg: 4, n: 3, tele: 0.55 };
  };

  // ── 走位：enemyStep 的 switch 走不到的种类
  K.stepX = function (S, e, dt, T, d, ux, uy, los, move, b) {
    const begin = () => K.begin(S, e);
    switch (e.kind) {
      case 'stalker': {
        e.cloakOn = e.t - (e.hurtAt == null ? -9 : e.hurtAt) > 2 && d > 60;
        const wob = Math.sin(e.t * 5 + e.slot) * 0.5; move(ux + (-uy) * wob, uy + ux * wob, b.speed * (d > 30 ? 1 : 0.2));
        if (e.cd <= 0 && d < 30) begin(); break;
      }
      case 'jammer': {
        const want = d < 90 ? -1.2 : d > 150 ? 0.8 : 0, s = Math.sin(e.t * 0.8 + e.slot);
        move(ux * want + (-uy) * s * 0.6, uy * want + ux * s * 0.6, b.speed * (d < 90 ? 1.6 : 1));
        if (e.cd <= 0 && los && d < 170) begin(); break;
      }
      case 'gunner': {
        const want = d < 110 ? -1 : d > 180 ? 1 : 0, s = Math.sin(e.t * 1.1 + e.slot);
        move(ux * want + (-uy) * s * 0.5, uy * want + ux * s * 0.5, b.speed);
        if (e.cd <= 0 && los && d < 230) begin(); break;
      }
      case 'queen': {
        phase(S, e, '暴躁', '蜂后下蛋更快，还会放一圈圈子弹');
        const want = d < 50 ? -1 : d > 90 ? 1 : 0, s = Math.sin(e.t * 0.7 + e.slot);
        move(ux * want + (-uy) * s, uy * want + ux * s, b.speed); if (e.cd <= 0) begin(); break;
      }
      case 'warden': {
        if (phase(S, e, '护盾碎了', '铁闸叫来了哨兵')) { e.shieldOff = true; for (let i = 0; i < 12; i++) part(S, 'debris', e.x, e.y - 10, S.rng.range(-90, 90), S.rng.range(-90, 20), 0.8, P.c); }
        move(ux, uy, b.speed * (d > 80 ? 1 : 0)); if (e.cd <= 0) begin(); break;
      }
      case 'archivist': {
        phase(S, e, '过载', '档案官在地上铺电网');
        const want = d < 80 ? -1 : d > 140 ? 0.6 : 0, s = Math.sin(e.t * 0.6 + e.slot);
        move(ux * want + (-uy) * s * 0.7, uy * want + ux * s * 0.7, b.speed); if (e.cd <= 0) begin(); break;
      }
    }
  };
  function phase(S, e, title, sub) {
    if (e.phase !== 1 || e.hp >= e.maxHp / 2) return false;
    e.phase = 2; e.step = 0; S.banner = { t: 0, text: title, sub }; addShake(S, 0.6); sfx('bosswarn'); return true;
  }

  // ── 出招
  K.startX = function (S, e, T, a) {
    const it = e.intent, next = () => { e.intent = K.nextIntent(S, e); };
    switch (it.k) {
      case 'slash2': e.act = { k: 'slash2', t: 0, n: 2, gap: 0.16, hit: 0 }; sfx('swing'); break;
      case 'zap': K.hitscan(S, e, e.aimA != null ? e.aimA : a, it.dmg, 0.05, '#ffd84a', 200); e.cd = S.rng.range(2.4, 3.2); next(); break;
      case 'spray': e.act = { k: 'spray', t: 0, n: it.n, gap: 0.08, a: e.aimA != null ? e.aimA : a }; sfx('charge2'); break;
      case 'brood': {
        const own = S.enemies.filter(o => !o.dead && o.owner === e).length;
        for (let i = 0; i < it.n && own + i < 8; i++) { const b = S.rng() * TAU, x = e.x + Math.cos(b) * 16, y = e.y + Math.sin(b) * 10; if (D.solidAt(S.A, x, y)) continue; const o = K.spawnEnemy(S, i % 2 ? 'bomber' : 'mite', x, y, 0.4, e.f, true); o.owner = e; o.noLoot = true; }
        ring(S, e.x, e.y - 8, 24, P.O); sfx('leap'); e.cd = 1.2; next(); break;
      }
      case 'spit': for (let i = 0; i < it.n; i++) K.eshot(S, e.x, e.y - 14, a + (i / (it.n - 1) - 0.5) * 0.7, 120, it.dmg, '#8dff6a'); sfx('orb'); e.cd = 1; next(); break;
      case 'summon': for (const s of [-1, 1]) { const x = e.x + s * 30, y = e.y - 10; const o = K.spawnEnemy(S, 'drone', D.solidAt(S.A, x, y) ? e.x : x, D.solidAt(S.A, x, y) ? e.y : y, 0.5, e.f, true); o.owner = e; o.noLoot = true; } ring(S, e.x, e.y - 10, 30, P.r); sfx('warn'); e.cd = 1; next(); break;
      case 'blink': {
        const p = S.player; let tx = e.x, ty = e.y;
        for (let i = 0; i < 24; i++) { const b = S.rng() * TAU, r = S.rng.range(90, 140), x = p.x + Math.cos(b) * r, y = p.y + Math.sin(b) * r; if (x > 20 && y > 20 && x < S.A.w - 20 && y < S.A.h - 20 && !D.solidAt(S.A, x, y) && !D.solidAt(S.A, x, y - 8) && D.losClear(S.A, x, y - 6, p.x, p.y - 6)) { tx = x; ty = y; break; } }
        for (let i = 0; i < 14; i++) part(S, 'spark', e.x, e.y - 10, S.rng.range(-60, 60), S.rng.range(-70, 10), 0.3, P.c);
        e.x = tx; e.y = ty; ring(S, e.x, e.y - 8, 18, P.c); flashLight(S, e.x, e.y, 70, P.c, 1); sfx('dash'); e.cd = 0.5; next(); break;
      }
      case 'holo': for (const s of [-1, 1]) { const x = e.x + s * 22, y = e.y + 6, ok = !D.solidAt(S.A, x, y); const o = K.spawnEnemy(S, 'drone', ok ? x : e.x, ok ? y : e.y, 0.3, e.f, true); o.owner = e; o.noLoot = true; o.phantom = true; o.hp = o.maxHp = 12; } ring(S, e.x, e.y - 8, 22, P.c); sfx('shield'); e.cd = 0.9; next(); break;
      case 'arcz': {
        const p = S.player, d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < 180 && D.losClear(S.A, e.x, e.y - 14, p.x, p.y - 6)) { S.bolts.push({ pts: K.zig(S, e.x, e.y - 14, p.x, p.y - 6), t: 0.25 }); if (p.inv > 0) K.perfectDodge(S); else K.damagePlayer(S, it.dmg, e); }
        else S.bolts.push({ pts: K.zig(S, e.x, e.y - 14, e.x + Math.cos(a) * 80, e.y - 14 + Math.sin(a) * 80), t: 0.2 });
        flashLight(S, e.x, e.y - 14, 90, P.c, 1.2); sfx('zap'); e.cd = 1; next(); break;
      }
      case 'grid': {
        const p = S.player, par = S.rng.chance(0.5) ? 0 : 1, c = 20, cx = Math.round(p.x / c) * c, cy = Math.round(p.y / c) * c;
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (((i + j) & 1) === par) (S.hazards = S.hazards || []).push({ x: cx + i * c, y: cy + j * c, s: c, f: S.f, t: 0, warn: 0.9, on: 0.35, dmg: it.dmg, hit: false });
        sfx('charge'); e.cd = 1.4; next(); break;
      }
    }
  };
  K.actX = function (S, e, dt, T, done) {
    const A = e.act, p = S.player;
    switch (A.k) {
      case 'slash2':
        if (A.t >= A.gap) { A.t = 0; A.n--; e.x += Math.cos(Math.atan2(p.y - e.y, p.x - e.x)) * 4; if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r + 12) { if (p.inv > 0) K.perfectDodge(S); else K.damagePlayer(S, e.intent.dmg, e); } S.ghosts.push({ k: 'slash', x: e.x, y: e.y - 6, a: Math.atan2(p.y - e.y, p.x - e.x), t: 0.12 }); sfx('swing'); }
        if (A.n <= 0) { e.cd = S.rng.range(1.4, 1.9); e.act = { k: 'flee', t: 0, dur: 0.7 }; e.intent = K.nextIntent(S, e); }
        break;
      case 'spray':
        A.a += D.clamp(D.angDiff(A.a, Math.atan2(p.y - 6 - (e.y - 8), p.x - e.x)), -0.7 * dt, 0.7 * dt); e.aimA = A.a; // 扫射时转身很慢
        if (A.t >= A.gap) { A.t = 0; A.n--; K.hitscan(S, e, A.a, e.intent.dmg, 0.08, P.O, 280); }
        if (A.n <= 0) { e.cd = 2.8; text(S, e.x, e.y - 24, '换弹', P[5]); done(); }
        break;
    }
  };

  // ── 镇守首领：沦陷区（危险等级 3）的虫巢 / 检查站 / 数据中心，最深一层最大的房间
  D.BOSS_AT = { nest: 'queen', checkpoint: 'warden', datacenter: 'archivist' };
  K.spawnGuardBoss = function (S, rng) {
    const st = S.st, k = D.BOSS_AT[st.type]; if (!k || st.tier < 3 || S.tut || st.home) return;
    const fi = S.floors.length - 1, F = S.floors[fi];
    const rooms = F.rooms.filter(r => !r.hidden && r.kind !== 'platform' && r.w >= 8 && r.h >= 6).sort((a, b) => b.w * b.h - a.w * a.h), r = rooms[0] || F.rooms[0]; if (!r) return;
    const x = (r.x + r.w / 2) * TS, y = (r.y + r.h / 2) * TS;
    const e = K.spawnEnemy(S, k, x, y, 1, fi); e.home = { x, y, w: r.w * TS, h: r.h * TS }; r.boss = k; S.guardBoss = e;
  };
  // 首领醒了：横幅；死了：掉战利品和一张史诗以上的装备卡，召出来的小兵一起散架
  K.foesPost = function (S, dt) {
    S.jamField = false;
    for (const e of S.enemies) {
      if (e.dead) continue;
      if (e.haste > 0) e.haste -= dt;
      if (e.f !== S.f) continue;
      if (isBoss(e) && e.kind !== 'boss' && e.aware && !e.announced) { e.announced = true; S.banner = { t: 0, text: D.ENEMIES[e.kind].name, sub: '镇守首领 · ' + D.ENEMIES[e.kind].tag.split('：')[1], keep: true }; sfx('bosswarn'); }
      if (e.owner && e.owner.dead) { e.hp = 0; K.kill(S, e, true); continue; }
      if (e.kind === 'jammer' && e.aware) {
        if (Math.hypot(S.player.x - e.x, S.player.y - e.y) < 120) S.jamField = true;
        for (const o of S.enemies) if (!o.dead && o !== e && o.f === e.f && !D.ENEMIES[o.kind].human && Math.hypot(o.x - e.x, o.y - e.y) < 120) o.haste = 0.2;
      }
    }
    if (S.hazards && S.hazards.length) {
      const p = S.player;
      for (const h of S.hazards) {
        h.t += dt;
        if (h.t >= h.warn && !h.hit && h.f === S.f && Math.abs(p.x - h.x) < h.s / 2 && Math.abs(p.y - h.y) < h.s / 2 && p.hp > 0) { h.hit = true; if (p.inv > 0) K.perfectDodge(S); else K.damagePlayer(S, h.dmg, { kind: 'archivist', x: h.x, y: h.y }); }
        if (h.t >= h.warn && h.t - dt < h.warn && S.rng.chance(0.4)) { for (let i = 0; i < 3; i++) part(S, 'spark', h.x + S.rng.range(-8, 8), h.y, S.rng.range(-30, 30), S.rng.range(-50, -10), 0.25, P.c); }
      }
      if (S.hazards.some(h => h.t >= h.warn && h.t - dt < h.warn)) sfx('zap');
      S.hazards = S.hazards.filter(h => h.t < h.warn + h.on);
    }
  };
  const kx0 = K.onKillX;
  K.onKillX = function (S, e) {
    if (kx0) kx0(S, e);
    if (!isBoss(e) || e.kind === 'boss' || e.noTrophy) return; // noTrophy：双子先倒下的那个（bosses-bx.js）
    const x = D.clamp(e.x, 24, S.A.w - 24), cards = Object.keys(D.CARDS).filter(k => !D.CARDS[k].free && D.CARDS[k].q >= 3);
    K.scatter(S, x, e.y, e.f, TROPHY[e.kind], 1); K.scatter(S, x, e.y, e.f, 'card:' + S.rng.pick(cards), 1);
    S.banner = { t: 0, text: '击毁 ' + D.ENEMIES[e.kind].name, sub: '镇守首领掉下了好东西' }; sfx('rare');
    if (S.raid) (S.raid.bosses = S.raid.bosses || []).push(e.kind);
  };

  // ── 画：新敌人、分身、电网格
  D.drawFoe = function (ctx, ex, S, e, white, LT, H) {
    const SP = D.SPR, x = e.x, y = e.y, tele = e.tele > 0, sx = tele && e.tele < 0.25 ? Math.round(Math.sin(S.t * 80)) * 0.5 : 0;
    if (e.phantom) { ctx.globalAlpha = 0.45 + 0.2 * Math.sin(S.t * 25); H.actor(ctx, ex, SP.archivist, x + sx, y - 4, e.face < 0, white); ctx.globalAlpha = 1; return true; }
    switch (e.kind) {
      case 'stalker': {
        if (e.cloakOn && !white && !tele) ctx.globalAlpha = 0.1 + 0.06 * Math.sin(S.t * 13 + e.slot * 9);
        H.actor(ctx, ex, SP.stalker, x + sx, y - (e.z || 0), e.face < 0, white); ctx.globalAlpha = 1;
        if (tele || (e.act && e.act.k === 'slash2')) LT(x, y - 14, 20, '#ff3d8b', 0.8);
        return true;
      }
      case 'jammer': {
        const z = 8 + Math.sin(e.t * 2) * 1.5;
        if (e.aware) { ex.strokeStyle = D.rgba('#ffd84a', 0.12 + 0.08 * Math.sin(S.t * 4)); ex.lineWidth = 0.5; ex.beginPath(); ex.ellipse(x, y, 120, 84, 0, 0, TAU); ex.stroke(); }
        H.actor(ctx, ex, SP.jammer, x + sx, y - z, e.face < 0, white); if (tele) LT(x, y - z - 6, 24, '#ffd84a', 0.8); return true;
      }
      case 'gunner': {
        H.actor(ctx, ex, SP.gunner, x + sx, y, e.face < 0, white);
        const a = e.aimA != null ? e.aimA : (e.face > 0 ? 0 : Math.PI), gx = x + e.face * 3, gy = y - 10;
        H.seg(ctx, gx, gy, gx + Math.cos(a) * 15, gy + Math.sin(a) * 15, P.k, 3.5); H.seg(ctx, gx, gy, gx + Math.cos(a) * 15, gy + Math.sin(a) * 15, '#434b5f', 2);
        if (tele || (e.act && e.act.k === 'spray')) { const tx = gx + Math.cos(a) * 16, ty = gy + Math.sin(a) * 16; ex.fillStyle = (S.t * 30 | 0) % 2 ? '#ffffff' : P.O; ex.fillRect(tx - 1, ty - 1, 2, 2); LT(tx, ty, 26, P.O, 0.8); }
        return true;
      }
      case 'queen': {
        const z = 10 + Math.sin(e.t * 3) * 2, fl = (S.t * 24 | 0) % 2;
        ctx.fillStyle = D.rgba('#a6e2f0', fl ? 0.35 : 0.2); ctx.fillRect(x - 16, y - z - 26, 14, 2); ctx.fillRect(x + 2, y - z - 27, 12, 2);
        H.actor(ctx, ex, SP.queen, x + sx, y - z, e.face < 0, white); if (tele) LT(x, y - z - 12, 40, e.phase === 2 ? P.r : P.O, 1); return true;
      }
      case 'warden': {
        H.actor(ctx, ex, SP.warden, x + sx, y + 2, e.face < 0, white);
        if (!e.shieldOff) {
          const sa = e.shieldA, sc = e.shieldHit > 0 ? '#ffffff' : P.c; e.shieldHit = (e.shieldHit || 0) - 1 / 60;
          ctx.strokeStyle = P.k; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 12, 24, sa - 0.9, sa + 0.9); ctx.stroke();
          ctx.strokeStyle = '#2f6e88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 12, 24, sa - 0.9, sa + 0.9); ctx.stroke();
          ex.strokeStyle = D.rgba(sc, 0.8); ex.lineWidth = 0.5; ex.beginPath(); ex.arc(x, y - 12, 24.5, sa - 0.85, sa + 0.85); ex.stroke();
        }
        if (tele) LT(x, y - 24, 40, P.r, 1); return true;
      }
      case 'archivist': {
        const z = 4 + Math.sin(e.t * 2) * 1.5;
        if (tele && e.intent.k === 'blink') ctx.globalAlpha = (S.t * 20 | 0) % 2 ? 0.4 : 1;
        H.actor(ctx, ex, SP.archivist, x + sx, y - z, e.face < 0, white); ctx.globalAlpha = 1;
        if (tele && e.intent.k === 'arcz') { const p = S.player; ex.strokeStyle = D.rgba(P.c, 0.3 + 0.5 * (1 - e.tele / e.teleMax)); ex.lineWidth = 0.5; ex.setLineDash([2, 3]); ex.beginPath(); ex.moveTo(x, y - z - 14); ex.lineTo(p.x, p.y - 6); ex.stroke(); ex.setLineDash([]); }
        if (tele) LT(x, y - z - 16, 30, P.c, 1); return true;
      }
    }
    return false;
  };
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    if (de0) de0(S, list, ctx, ex);
    for (const h of S.hazards || []) if (h.f === S.f) list.push({ y: -1e9, f: () => {
      const on = h.t >= h.warn, x0 = Math.round(h.x - h.s / 2), y0 = Math.round(h.y - h.s / 2);
      if (on) { ex.fillStyle = D.rgba(P.c, 0.55); ex.fillRect(x0 + 1, y0 + 1, h.s - 2, h.s - 2); ex.fillStyle = D.rgba('#ffffff', 0.6); ex.fillRect(x0 + 2, y0 + h.s / 2, h.s - 4, 1); }
      else if ((h.t * (6 + h.t * 10) | 0) % 2) { ex.strokeStyle = D.rgba(P.c, 0.7); ex.lineWidth = 0.5; ex.strokeRect(x0 + 1.5, y0 + 1.5, h.s - 3, h.s - 3); }
    } });
  };
})(D);
