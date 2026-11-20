/* Underdog · 新枪 15 把（design/features/arsenal/design.md）：链弹炮、冷凝枪、订书钉枪、锯片发射器、声波炮、蓄能电弧枪、寄生弹手枪、破门霰弹、
   双枪、汲能光束、钉雷枪、棱镜枪、奇点炮、赌徒左轮、过热步枪。
   挂钩：player.js 的 fire() → K.shootX（换掉造子弹那一段）、K.fireOwn（过热步枪，不走弹匣）；子弹打中 → K.shotHit；
   每帧 → 包住 K.armsPre / K.armsPost；画 → 包住 K.meleeDraw。自己的弹体放 S.ap，自己走、自己判定。
   在 status.js 之后、gear.js 之前加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, R = D.RAMP, K = D.K || (D.K = {}), TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const part = (...a) => K.part(...a), text = (...a) => K.text(...a), ring = (...a) => K.ring(...a), hurt = (...a) => K.hurt(...a);
  const flashLight = (...a) => K.flashLight(...a), addShake = (...a) => K.addShake(...a), zig = (...a) => K.zig(...a);
  const isBoss = e => !!(D.ENEMIES[e.kind] && D.ENEMIES[e.kind].boss);
  const alive = S => S.enemies.filter(e => !e.dead && e.f === S.f && !e.dormant);
  const add = (k, o) => { o.price = D.CARD_VALUE[o.q]; D.CARDS[k] = o; };
  const G = (k, name, q, art, desc, gun) => add(k, { slot: 'gun', name, q, art, desc, gun: Object.assign({ n: 1, spread: 0.04, noise: 1.2, life: 0.9 }, gun, { x: k }) });

  // ── 1. 表
  G('bolas', '链弹炮', 2, 'gun_bolas', '10 伤害，弹匣 2。打出两颗连着铁链的弹，缠住敌人 2 秒；两颗缠到两个敌人会把它们拽到一起互撞', { cal: 'shell', dmg: 10, mag: 2, rate: 0.5, reload: 1.6, speed: 300, life: 0.7, noise: 1.6 });
  G('cryo', '冷凝枪', 3, 'gun_cryo', '5 伤害，弹匣 40，射速快。每发叠 1 层冻结，5 层冻住 2 秒；冻住的敌人挨近战 ×3 碎掉', { cal: 'cell', dmg: 5, mag: 40, rate: 0.09, reload: 1.8, speed: 380, spread: 0.06, life: 0.6 });
  G('stapler', '订书钉枪', 2, 'gun_stapler', '12 伤害，弹匣 8。敌人被打退的方向贴着墙，就被钉在墙上 1.5 秒（受伤 +50%）', { cal: 'nail', dmg: 12, mag: 8, rate: 0.32, reload: 1.3, speed: 520, life: 0.8 });
  G('sawgun', '锯片发射器', 3, 'gun_saw', '14 伤害，弹匣 3。锯片飞到准星处再飞回来，去回都伤害、都穿透', { cal: 'nail', dmg: 14, mag: 3, rate: 0.55, reload: 1.6, speed: 330, life: 2 });
  G('sonic', '声波炮', 3, 'gun_sonic', '6 伤害，扇形。推开扇面里所有的敌人，把敌人的子弹吹散', { cal: 'cell', dmg: 6, mag: 8, rate: 0.5, reload: 1.6, speed: 0, noise: 2.2 });
  G('arcgun', '蓄能电弧枪', 4, 'gun_arc', '按住蓄力，松开放电弧：蓄得越久跳得越多（最多 6 个），每跳 18 伤害；没蓄就松开只是一发小电弹', { cal: 'cell', dmg: 18, mag: 6, rate: 0.3, reload: 1.8, speed: 420, charge: 1.5 });
  G('parasite', '寄生弹手枪', 3, 'gun_parasite', '8 伤害，弹匣 7。子弹扎在敌人身上 3 秒后引爆：这 3 秒里它吃的伤害 30% 一起炸出来，炸到旁边', { cal: 'rifle', dmg: 8, mag: 7, rate: 0.3, reload: 1.4, speed: 480 });
  G('breacher', '破门霰弹', 2, 'gun_breacher', '30 伤害，弹匣 2。一枪把敌人轰退，撞墙或撞到别的敌人再吃 20 并晕住；能轰开可破坏的墙', { cal: 'slug', dmg: 30, mag: 2, rate: 0.6, reload: 1.8, speed: 600, life: 0.5, noise: 2.6, kick: 5 });
  G('akimbo', '双枪', 2, 'gun_akimbo', '5 伤害，弹匣 32。左右手交替开火，连着打越来越快、越来越散；闪避后 1 秒内弹弹暴击', { cal: 'light', dmg: 5, mag: 32, rate: 0.13, reload: 1.5, speed: 420, spread: 0.05 });
  G('beam', '汲能光束', 4, 'gun_beam', '按住持续光束：一直照同一个敌人伤害越来越高（3 秒翻倍），打中时每秒回 2 耐久', { cal: 'cell', dmg: 3, mag: 60, rate: 0.07, reload: 2, speed: 0, noise: 1 });
  G('minegun', '钉雷枪', 3, 'gun_mine', '子弹落地变小地雷（最多 6 颗，留 20 秒），敌人踩上爆炸 22 伤害', { cal: 'shell', dmg: 22, mag: 6, rate: 0.35, reload: 1.8, speed: 0, noise: 1 });
  G('prism', '棱镜枪', 4, 'gun_prism', '7 伤害，弹匣 24。子弹飞出 80 像素分成 3 发；打到墙不消失，分裂反射', { cal: 'light', dmg: 7, mag: 24, rate: 0.14, reload: 1.6, speed: 400 });
  G('singular', '奇点炮', 5, 'gun_singular', '弹匣 2。打出一颗慢慢飞的黑球，一路把附近的敌人和子弹吸过去，到准星处塌缩爆炸 60 伤害', { cal: 'cell', dmg: 60, mag: 2, rate: 1, reload: 2.4, speed: 110, noise: 2.4 });
  G('gambler', '赌徒左轮', 2, 'gun_gambler', '16 伤害，弹匣 6。每一发随机：暴击 ×3、燃烧、电、穿透、爆炸，或者是空包；看得到下一发是什么', { cal: 'rifle', dmg: 16, mag: 6, rate: 0.35, reload: 1.6, speed: 520 });
  G('overheat', '过热步枪', 3, 'gun_heat', '8 伤害，不用子弹、不用换弹。越打越热、越热伤害越高（最多 +60%），过热卡 2 秒；完美闪避立刻散热', { cal: 'cell', dmg: 8, mag: 1, rate: 0.11, reload: 1, speed: 420, heat: 0.06 });
  Object.assign(D.CARD_SHAPE, { bolas: [4, 1], cryo: [4, 2], stapler: [3, 1], sawgun: [3, 2], sonic: [4, 2], arcgun: [5, 1], parasite: [2, 1], breacher: [4, 1], akimbo: [2, 2], beam: [4, 2], minegun: [3, 2], prism: [3, 1], singular: [4, 2], gambler: [2, 1], overheat: [4, 1] });

  // ── 2. 图（28×28，画板自动描黑边；发光的部分 emit）
  Object.assign(D.ITEM_ART, {
    gun_bolas: p => { p.box(2, 10, 15, 7, R.gunmetal, { r: 2 }); p.box(16, 9, 6, 9, R.dark, { r: 1 }); p.ell(24, 9, 2, 2, R.steel); p.ell(24, 18, 2, 2, R.steel); p.line(24, 11, 24, 16, '#c8cdda'); p.box(6, 17, 4, 7, R.cloth, { r: 1 }); },
    gun_cryo: p => { p.box(2, 11, 18, 7, R.white, { r: 2 }); p.ell(9, 8, 4, 4, R.glass, { spec: true }); p.rect(20, 12, 6, 4, '#9fe9ff', 1); p.px(26, 13, '#e6fbff', 1); p.box(5, 18, 4, 7, R.dark); p.rect(4, 14, 14, 1, '#5fb8d8'); },
    gun_stapler: p => { p.box(2, 9, 21, 8, R.red, { r: 2 }); p.rect(4, 17, 17, 3, '#949fb6'); p.rect(22, 11, 4, 3, '#c8cdda'); p.box(4, 19, 5, 6, R.dark); p.rect(8, 11, 10, 1, '#ffd0d0'); },
    gun_saw: p => { p.box(2, 13, 14, 7, R.olive, { r: 2 }); p.ell(20, 12, 6, 6, R.silver, { spec: true }); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; p.px(20 + Math.round(Math.cos(a) * 7), 12 + Math.round(Math.sin(a) * 7), '#dbe5fa'); } p.px(20, 12, '#0b0a14'); p.box(5, 20, 4, 6, R.dark); },
    gun_sonic: p => { p.box(2, 10, 14, 9, R.magenta, { r: 2 }); for (let i = 0; i < 3; i++) p.rect(16 + i * 3, 8 - i, 2, 13 + i * 2, i === 2 ? '#ffb3d4' : '#b3407a', i === 2 ? 1 : 0); p.box(5, 19, 4, 6, R.dark); },
    gun_arc: p => { p.box(1, 11, 22, 6, R.blue, { r: 2 }); for (let i = 0; i < 3; i++) p.ell(7 + i * 5, 10, 2, 2, R.copper); p.line(23, 13, 27, 11, '#c4fbff', 1); p.line(23, 14, 27, 16, '#3ee8ff', 1); p.box(5, 17, 4, 7, R.dark); },
    gun_parasite: p => { p.box(4, 10, 14, 6, R.green, { r: 2 }); p.rect(18, 11, 5, 3, '#949fb6'); p.ell(9, 8, 3, 2, R.green, { spec: true }); p.px(9, 8, '#8dff6a', 1); p.box(6, 16, 5, 8, R.dark, { r: 1 }); },
    gun_breacher: p => { p.box(1, 11, 24, 6, R.gunmetal, { r: 1 }); p.rect(24, 10, 3, 8, '#c8cdda'); p.box(3, 17, 8, 7, R.copper, { r: 2 }); p.rect(14, 17, 6, 2, '#646e86'); p.rect(25, 13, 2, 2, '#ff7a2e', 1); },
    gun_akimbo: p => { for (const o of [0, 9]) { p.box(3 + o, 6 + o, 11, 5, R.steel, { r: 1 }); p.box(4 + o, 11 + o, 4, 6, R.dark, { r: 1 }); p.px(14 + o, 7 + o, '#ffb057', 1); } },
    gun_beam: p => { p.box(2, 10, 17, 9, R.dark, { r: 3 }); p.ell(10, 14, 4, 3, R.green, { spec: true }); p.rect(19, 12, 5, 5, '#646e86'); p.rect(24, 13, 3, 3, '#8dff6a', 1); p.box(5, 19, 4, 6, R.cloth); },
    gun_mine: p => { p.box(2, 11, 15, 8, R.olive, { r: 2 }); p.box(16, 10, 9, 10, R.gunmetal, { r: 4 }); p.px(21, 14, '#ff3047', 1); p.box(5, 19, 4, 6, R.dark); p.rect(4, 13, 10, 1, '#c8cc7a'); },
    gun_prism: p => { p.box(2, 11, 14, 6, R.silver, { r: 2 }); p.line(16, 14, 22, 9, '#c4fbff', 1); p.line(16, 14, 23, 14, '#ffb3d4', 1); p.line(16, 14, 22, 19, '#ffe9b0', 1); p.rect(15, 12, 3, 5, '#e6fbff', 1); p.box(5, 17, 4, 7, R.dark); },
    gun_singular: p => { p.box(2, 10, 16, 10, R.dark, { r: 3 }); p.ell(21, 15, 5, 5, R.magenta, { spec: true }); p.ell(21, 15, 2, 2, R.dark); p.px(20, 13, '#ffb3d4', 1); p.box(5, 20, 4, 6, R.gunmetal); },
    gun_gambler: p => { p.box(3, 10, 15, 5, R.gold, { r: 2 }); p.ell(10, 12, 3, 3, R.gunmetal); p.rect(18, 11, 6, 3, '#e3c14a'); p.box(4, 15, 5, 9, R.red, { r: 2 }); p.px(10, 12, '#ff3047', 1); },
    gun_heat: p => { p.box(1, 11, 21, 6, R.gunmetal, { r: 1 }); for (let i = 0; i < 4; i++) p.rect(5 + i * 4, 9, 2, 10, i < 2 ? '#ff7a2e' : '#7a3a1c', i < 2 ? 1 : 0); p.rect(22, 12, 5, 4, '#949fb6'); p.box(4, 17, 5, 7, R.dark); },
  });

  // ── 3. 小工具
  const ap = S => S.ap || (S.ap = []);
  function ghit(S, e, dmg, o) { // 自己的弹体打中：吃子弹的加成（弱点识别、过载回路），充电容，近战冷却减一点
    if (e.dead) return false;
    const m = K.shotMul ? K.shotMul(S, {}, e) : 1;
    hurt(S, e, Math.round(dmg * m * 10) / 10, Object.assign({ col: P.O, kb: 50 }, o));
    if (K.capGain && !o.noCap) K.capGain(S, D.SHELL.capPerDmg * dmg);
    S.player.meleeCd -= 0.05;
    return e.dead;
  }
  function wallAt(S, x, y) { return D.solidAt(S.A, x, y + 6); }
  // 打飞：撞墙 / 撞别的敌人都吃一下并晕住（破门霰弹、抓取爪扔出去）
  K.fling = function (S, e, a, sp, dmg, col) {
    if (e.dead || isBoss(e) || e.kind === 'turret') return false;
    e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp; e.gfl = { t: 0.5, a, dmg, col: col || P.o }; e.stun = Math.max(e.stun || 0, 0.5); return true;
  };
  function flingStep(S, dt) {
    for (const e of S.enemies) if (e.gfl) {
      const F = e.gfl; F.t -= dt; if (e.dead || F.t <= 0) { e.gfl = null; continue; }
      const ax = Math.cos(F.a), ay = Math.sin(F.a);
      if (D.solidAt(S.A, e.x + ax * (e.r + 3), e.y + ay * (e.r + 3))) { e.gfl = null; e.vx = e.vy = 0; hurt(S, e, F.dmg, { kx: -ax, ky: -ay, kb: 20, col: F.col, crit: true }); if (!e.dead) e.stun = Math.max(e.stun || 0, 1); ring(S, e.x, e.y - 6, 20, F.col); addShake(S, 0.3); text(S, e.x, e.y - 30, 'SLAM', F.col, true); sfx('slam'); continue; }
      for (const o of S.enemies) if (o !== e && !o.dead && o.f === S.f && Math.hypot(o.x - e.x, o.y - e.y) < o.r + e.r + 2) {
        e.gfl = null; e.vx *= 0.2; e.vy *= 0.2; hurt(S, e, F.dmg, { kx: -ax, ky: -ay, kb: 20, col: F.col }); hurt(S, o, F.dmg, { kx: ax, ky: ay, kb: 160, col: F.col });
        if (!e.dead) e.stun = Math.max(e.stun || 0, 1); if (!o.dead) o.stun = Math.max(o.stun || 0, 1);
        ring(S, o.x, o.y - 6, 18, F.col); addShake(S, 0.25); text(S, o.x, o.y - 30, 'SLAM', F.col, true); sfx('heavy'); break;
      }
    }
  }
  // 沿准星方向找第一个敌人（光束、电弧用）
  function rayHit(S, x, y, a, max, w) {
    let best = null, bd = max, end = max;
    for (let d = 0; d < max; d += 4) if (wallAt(S, x + Math.cos(a) * d, y + Math.sin(a) * d)) { end = d; break; }
    for (const e of alive(S)) { const dx = e.x - x, dy = e.y - 6 - y, along = dx * Math.cos(a) + dy * Math.sin(a); if (along < 0 || along > end) continue; const perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)); if (perp < e.r + (w || 3) && along < bd) { bd = along; best = e; } }
    return { e: best, d: best ? bd : end };
  }
  const GAMB = [['crit', 2, P.R], ['burn', 2, '#ff8a2e'], ['elec', 2, '#ffd84a'], ['pierce', 2, P.c], ['boom', 1.5, P.m], ['blank', 1, P[4]]]; // 下一发的颜色画在头顶
  const rollGamb = S => S.rng.weighted(GAMB.map(g => [g[0], g[1]]));

  // ── 4. 造子弹（fire() 里调；弹匣、射速、后坐、枪声 fire() 自己管）
  K.shootX = function (S, g, c) {
    const p = S.player, I = D.Input, a = c.a, dmg = g.dmg * c.tm, sp = g.speed, k = g.x;
    const shot = (o) => S.shots.push(Object.assign({ x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: g.life, dmg: Math.round(dmg * 10) / 10, r: 2, hit: new Set(), col: P.O }, o));
    const aimD = Math.min(180, Math.hypot(I.wx - p.x, I.wy - p.y));
    switch (k) {
      case 'bolas': { const pid = S.t + Math.random(); for (const s of [-0.2, 0.2]) { const b = a + s; ap(S).push({ k: 'bolas', x: c.ox, y: c.oy, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp, life: g.life, dmg, r: 4, hit: new Set(), pid, col: '#c8cdda' }); } break; }
      case 'cryo': shot({ vx: Math.cos(a + S.rng.range(-c.spread, c.spread)) * sp, vy: Math.sin(a + S.rng.range(-c.spread, c.spread)) * sp, ice: 1, col: '#9fe9ff' }); break;
      case 'stapler': shot({ staple: true, col: '#c8cdda', r: 2.5 }); break;
      case 'sawgun': ap(S).push({ k: 'saw', x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: g.life, dmg, r: 6, hit: new Set(), go: Math.max(40, aimD), d: 0, back: false, col: '#dbe5fa', spin: 0 }); sfx('throw'); break;
      case 'sonic': {
        const R0 = 100, half = 0.45;
        for (const e of alive(S)) { const dx = e.x - p.x, dy = e.y - 6 - (p.y - 6), d = Math.hypot(dx, dy); if (d < R0 + e.r && Math.abs(D.angDiff(a, Math.atan2(dy, dx))) < half && D.losClear(S.A, p.x, p.y - 6, e.x, e.y - 6)) { ghit(S, e, dmg, { kx: dx, ky: dy, kb: isBoss(e) ? 60 : 320, col: P.M }); e.stun = Math.max(e.stun || 0, 0.3); } }
        for (const s of S.eshots) { const dx = s.x - p.x, dy = s.y - (p.y - 6); if (Math.hypot(dx, dy) < R0 && Math.abs(D.angDiff(a, Math.atan2(dy, dx))) < half + 0.1) { s.life = 0; part(S, 'spark', s.x, s.y, dx, dy, 0.25, P.M); } }
        ap(S).push({ k: 'sonicfx', x: p.x, y: p.y - 6, a, t: 0.3, max: 0.3, life: 0.3, hit: new Set() }); addShake(S, 0.2); sfx('orb'); break;
      }
      case 'arcgun': {
        const lv = p.chgLv || 0; p.chgLv = 0;
        if (lv < 0.3) { shot({ dmg: Math.round(dmg * 0.45), col: '#ffd84a', emp: 0.2 }); break; }
        const n = Math.min(6, Math.ceil(lv / 0.25)), hit = new Set(); let from = { x: c.ox, y: c.oy }, first = null, ba = 0.4; // 第一跳：准星方向 0.4 弧度以内、看得见的，离准星方向最近的那个
        for (const e of alive(S)) { const dx = e.x - c.ox, dy = e.y - 6 - c.oy, da = Math.abs(D.angDiff(a, Math.atan2(dy, dx))); if (Math.hypot(dx, dy) < 170 && da < ba && D.losClear(S.A, c.ox, c.oy, e.x, e.y - 6)) { ba = da; first = e; } }
        if (!first) { S.bolts.push({ pts: zig(S, c.ox, c.oy, c.ox + Math.cos(a) * 90, c.oy + Math.sin(a) * 90), t: 0.2 }); sfx('zap'); break; }
        let cur = first;
        for (let i = 0; i < n && cur; i++) {
          hit.add(cur); S.bolts.push({ pts: zig(S, from.x, from.y, cur.x, cur.y - 6), t: 0.25 }); ghit(S, cur, dmg, { kx: cur.x - from.x, ky: cur.y - from.y, kb: 40, col: P.c, elec: true }); cur.stun = Math.max(cur.stun || 0, 0.4);
          from = { x: cur.x, y: cur.y - 6 }; let nx = null, bd = 90; for (const e of alive(S)) if (!hit.has(e)) { const d = Math.hypot(e.x - from.x, e.y - 6 - from.y); if (d < bd) { bd = d; nx = e; } } cur = nx;
        }
        flashLight(S, c.ox, c.oy, 90, P.c, 1.4); addShake(S, 0.15 + n * 0.04); text(S, p.x, p.y - 30, 'ARC ×' + hit.size, P.c); sfx('zap'); break;
      }
      case 'parasite': shot({ para: true, col: P.g }); break;
      case 'breacher': ap(S).push({ k: 'breach', x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: g.life, dmg, r: 4, hit: new Set(), col: P.o }); break;
      case 'akimbo': {
        const st = p.akN = S.t - (p.akT || -9) < 0.35 ? Math.min(20, (p.akN || 0) + 1) : 0; p.akT = S.t; p.akSide = -(p.akSide || 1);
        const off = p.akSide * 3, sx = c.ox - Math.sin(a) * off, sy = c.oy + Math.cos(a) * off, spr = c.spread * (1 + st / 12), b = a + S.rng.range(-spr, spr);
        const crit = S.t < (p.dodgeUntil || -9) + 1;
        shot({ x: sx, y: sy, vx: Math.cos(b) * sp, vy: Math.sin(b) * sp, dmg: Math.round(dmg * (crit ? 2 : 1) * 10) / 10, col: crit ? P.R : P.O });
        p.fireCd = g.rate * (1 - 0.45 * st / 20); break;
      }
      case 'beam': {
        const h = rayHit(S, c.ox, c.oy, a, 170, 3), e = h.e;
        if (e) { if (p.beamE !== e || S.t - (p.beamLast || -9) > 0.2) { p.beamE = e; p.beamT = 0; } p.beamT += g.rate; p.beamLast = S.t; const k2 = 1 + Math.min(1, p.beamT / 3); ghit(S, e, dmg * k2, { kx: Math.cos(a), ky: Math.sin(a), kb: 5, col: P.g, dot: true }); p.hp = Math.min(p.maxHp, p.hp + 2 * g.rate); }
        p.beamFx = { x0: c.ox, y0: c.oy, x1: c.ox + Math.cos(a) * h.d, y1: c.oy + Math.sin(a) * h.d, t: 0.09, k: e ? 1 + Math.min(1, (p.beamT || 0) / 3) : 1 };
        break;
      }
      case 'minegun': {
        const mine = S.mines.filter(m => m.gm); if (mine.length >= 6) mine[0].dead = true;
        const d = Math.max(20, Math.min(110, aimD));
        S.mines.push({ x: p.x, y: p.y - 4, sx: p.x, sy: p.y - 4, tx: p.x + Math.cos(a) * d, ty: p.y + Math.sin(a) * d, t: 0, fly: 0.3, arm: 0.4, dmg: Math.round(dmg), life: 20, gm: true }); sfx('throw'); break;
      }
      case 'prism': shot({ vx: Math.cos(a + S.rng.range(-c.spread, c.spread)) * sp, vy: Math.sin(a + S.rng.range(-c.spread, c.spread)) * sp, prism: 0, travel: 0, bounce: 1, col: P.C }); break;
      case 'singular': ap(S).push({ k: 'sing', x: c.ox, y: c.oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Math.max(0.4, aimD / sp), dmg, r: 5, hit: new Set(), col: P.m }); sfx('orb'); break;
      case 'gambler': {
        const r = p.gambNext || rollGamb(S); p.gambNext = rollGamb(S);
        const col = GAMB.find(x => x[0] === r)[2];
        if (r === 'blank') { for (let i = 0; i < 6; i++) part(S, 'smoke', c.ox, c.oy, S.rng.range(-20, 20), S.rng.range(-30, -5), 0.5, '#8a90a8'); text(S, p.x, p.y - 28, 'BLANK', P[4]); sfx('nope'); break; }
        shot({ dmg: Math.round(dmg * (r === 'crit' ? 3 : 1)), col, burn: r === 'burn' ? 3 : 0, emp: r === 'elec' ? 0.8 : 0, pierce: r === 'pierce', boom: r === 'boom' ? 26 : 0, r: r === 'crit' ? 3 : 2, gamb: r });
        if (r === 'crit') { addShake(S, 0.25); flashLight(S, c.ox, c.oy, 70, P.R, 1.2); } break;
      }
      default: shot({});
    }
  };

  // 过热步枪：不走弹匣、不吃子弹（fire() 一开头调；返回 true 就不往下走）
  K.fireOwn = function (S, g) {
    if (!g.heat) return false;
    const p = S.player; if (p.heatLock > 0) return true;
    const a = p.aim, ox = p.x + Math.cos(a) * 12, oy = p.y - 11 + Math.sin(a) * 7, h = p.heat || 0, b = a + S.rng.range(-g.spread, g.spread) * (1 + h);
    S.shots.push({ x: ox, y: oy, vx: Math.cos(b) * g.speed, vy: Math.sin(b) * g.speed, life: g.life, dmg: Math.round(g.dmg * (1 + 0.6 * h) * 10) / 10, r: 2, hit: new Set(), col: h > 0.6 ? P.r : h > 0.3 ? P.o : P.O });
    p.fireCd = g.rate; p.lastShot = S.t; p.cloakT = 0; p.heat = Math.min(1, h + g.heat);
    K.muzzle(S, ox, oy, a, h > 0.6 ? P.r : P.O, 1); K.kick(S, a, 1.2); S.shotsFired++; K.alertAround(S, p.x, p.y, ((D.TUNE.sense || {}).shot || 180)); S.raid.noise += g.noise; sfx('shot');
    if (p.heat >= 1) { p.heatLock = 2; text(S, p.x, p.y - 30, 'OVERHEAT', P.r, true); sfx('nope'); for (let i = 0; i < 10; i++) part(S, 'smoke', ox, oy, S.rng.range(-20, 20), S.rng.range(-40, -10), 0.8, '#c8cdda'); }
    return true;
  };
  const pd0 = K.perfectDodge; K.perfectDodge = function (S) { const p = S.player, had = p.pdDone; pd0(S); const gid = S.raid && D.gunId(S.raid), g = gid && D.CARDS[gid].gun; if (!had && p.pdDone && g && g.heat && (p.heat > 0 || p.heatLock > 0)) { p.heat = 0; p.heatLock = 0; text(S, p.x, p.y - 40, 'COOL', P.c); } };

  // 子弹打中（S.shots 里的）：冻结、订书钉、寄生弹
  const hit0 = K.shotHit; K.shotHit = function (S, s, e) {
    if (hit0) hit0(S, s, e);
    if (e.dead) return;
    if (s.ice) K.addIce(S, e, s.ice);
    if (s.staple) { const l = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / l, uy = s.vy / l; if (D.solidAt(S.A, e.x + ux * (e.r + 10), e.y + uy * (e.r + 10))) K.addPin(S, e, 1.5); else e.stapleT = S.t + 0.35; e.stapleA = Math.atan2(uy, ux); }
    if (s.para && !e.para) { e.para = { t: 3, acc: 0 }; text(S, e.x, e.y - 28, 'PARASITE', P.g); }
  };

  // ── 5. 每帧：蓄力、热量、双枪、寄生、订书钉、棱镜分裂、自己的弹体、链子、打飞
  const pre0 = K.armsPre; K.armsPre = function (S, dt, inp, gun) {
    if (pre0) pre0(S, dt, inp, gun);
    const p = S.player;
    if (gun && gun.charge) {
      const can = p.mag > 0 && p.reload <= 0 && p.dashT <= 0 && !S.lootOpen;
      if (inp.fire && can) { const was = p.chg || 0; p.chg = Math.min(gun.charge, was + dt); p.fireCd = Math.max(p.fireCd, 0.05); if (S.rng.chance(0.4)) part(S, 'spark', p.x + Math.cos(p.aim) * 12 + S.rng.range(-4, 4), p.y - 11 + S.rng.range(-4, 4), S.rng.range(-30, 30), S.rng.range(-30, 30), 0.2, P.c); if (was < gun.charge && p.chg >= gun.charge) { sfx('chargeup'); ring(S, p.x, p.y - 8, 12, P.c); } }
      else if (p.chg > 0) { p.chgLv = p.chg; p.chg = 0; if (can) K.fire(S, gun); }
    } else p.chg = 0;
    if (gun && gun.heat) {
      p.mag = Math.max(p.mag, 1);
      if (p.heatLock > 0) { p.heatLock -= dt; p.heat = Math.max(0, p.heatLock / 2); if (S.rng.chance(0.3)) part(S, 'smoke', p.x + Math.cos(p.aim) * 10, p.y - 11, S.rng.range(-8, 8), -30, 0.6, '#c8cdda'); }
      else if (S.t - (p.lastShot || -9) > 0.25) p.heat = Math.max(0, (p.heat || 0) - dt * 0.45);
    }
  };
  const post0 = K.armsPost; K.armsPost = function (S, dt) {
    if (post0) post0(S, dt);
    const p = S.player;
    // 寄生弹：3 秒后引爆
    for (const e of S.enemies) if (e.para) {
      e.para.t -= dt; if (e.dead && e.para.t > 0) e.para.t = 0;
      if (e.para.t <= 0) { const dmg = Math.round(10 + e.para.acc * 0.3), x = e.x, y = e.y; e.para = null; for (const o of alive(S)) if (Math.hypot(o.x - x, o.y - y) < 36 + o.r) hurt(S, o, dmg, { kx: o.x - x, ky: o.y - y, kb: 120, col: P.g, para: true }); ring(S, x, y - 4, 38, P.g); K.deathBurst(S, x, y - 4, P.g, 0.7); flashLight(S, x, y - 6, 70, P.g, 1.2); addShake(S, 0.3); sfx('boom'); }
    }
    // 订书钉：打退以后 0.35 秒内撞到墙就钉住
    for (const e of S.enemies) if (e.stapleT && !e.dead) { if (S.t > e.stapleT) e.stapleT = 0; else if (D.solidAt(S.A, e.x + Math.cos(e.stapleA) * (e.r + 4), e.y + Math.sin(e.stapleA) * (e.r + 4))) { e.stapleT = 0; K.addPin(S, e, 1.5); } }
    // 棱镜：飞出 80 像素分成 3 发；撞墙反射时多分出两发
    const add2 = [];
    for (const s of S.shots) if (s.prism != null) {
      s.travel += Math.hypot(s.vx, s.vy) * dt;
      if (s.prism === 0 && s.travel > 80 && s.life > 0) { s.life = 0; const a = Math.atan2(s.vy, s.vx), sp = Math.hypot(s.vx, s.vy); for (const d of [-0.22, 0, 0.22]) add2.push(Object.assign({}, s, { vx: Math.cos(a + d) * sp, vy: Math.sin(a + d) * sp, life: 0.6, prism: 1, hit: new Set(), bounce: 1 })); for (let i = 0; i < 4; i++) part(S, 'spark', s.x, s.y, S.rng.range(-40, 40), S.rng.range(-40, 40), 0.2, P.C); }
      if (s.prism === 1 && s.bounce === 0 && !s.split) { s.split = true; const a = Math.atan2(s.vy, s.vx), sp = Math.hypot(s.vx, s.vy); for (const d of [-0.35, 0.35]) add2.push(Object.assign({}, s, { vx: Math.cos(a + d) * sp, vy: Math.sin(a + d) * sp, life: 0.4, prism: 2, hit: new Set(), bounce: 0, split: true })); }
    }
    for (const s of add2) S.shots.push(s);
    // 链弹炮：被链子拽到一起
    for (const L of S.alinks || []) {
      L.t -= dt; const a = L.a, b = L.b; if (a.dead || b.dead) { L.t = 0; continue; }
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d < a.r + b.r + 3) { L.t = 0; for (const e of [a, b]) { hurt(S, e, 12, { kx: e === a ? -dx : dx, ky: e === a ? -dy : dy, kb: 60, col: '#c8cdda', crit: true }); if (!e.dead) e.stun = Math.max(e.stun || 0, 1.2); } ring(S, (a.x + b.x) / 2, (a.y + b.y) / 2 - 6, 18, '#c8cdda'); text(S, (a.x + b.x) / 2, a.y - 30, 'CLANG', P.Y, true); addShake(S, 0.3); sfx('slam'); continue; }
      for (const [e, s] of [[a, 1], [b, -1]]) if (!isBoss(e) && e.kind !== 'turret') { e.x += dx / d * 260 * dt * s; e.y += dy / d * 260 * dt * s; }
    }
    if (S.alinks) S.alinks = S.alinks.filter(L => L.t > 0);
    // 自己的弹体
    for (const s of ap(S)) {
      s.life -= dt;
      if (s.k === 'sonicfx') continue;
      if (s.k === 'saw') {
        s.spin += dt * 30;
        if (!s.back) { s.x += s.vx * dt; s.y += s.vy * dt; s.d += Math.hypot(s.vx, s.vy) * dt; if (s.d >= s.go || wallAt(S, s.x, s.y)) { s.back = true; s.hit.clear(); if (wallAt(S, s.x, s.y)) { s.x -= s.vx * dt; s.y -= s.vy * dt; sfx('tink'); } } }
        else { const dx = p.x - s.x, dy = p.y - 6 - s.y, d = Math.hypot(dx, dy) || 1, sp = 380; s.x += dx / d * sp * dt; s.y += dy / d * sp * dt; if (d < 10) { s.life = 0; sfx('draw'); } }
        for (const e of alive(S)) if (!s.hit.has(e) && Math.hypot(e.x - s.x, e.y - 6 - s.y) < e.r + s.r) { s.hit.add(e); ghit(S, e, s.dmg, { kx: s.vx, ky: s.vy, kb: 40, col: '#dbe5fa' }); for (let i = 0; i < 4; i++) part(S, 'spark', s.x, s.y, S.rng.range(-80, 80), S.rng.range(-80, 20), 0.2, P.Y); }
        if (S.rng.chance(0.5)) part(S, 'spark', s.x, s.y, S.rng.range(-30, 30), S.rng.range(-30, 30), 0.15, '#dbe5fa');
        continue;
      }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.k === 'sing') {
        for (const e of alive(S)) { const dx = s.x - e.x, dy = s.y - (e.y - 6), d = Math.hypot(dx, dy) || 1; if (d < 70 && !isBoss(e) && e.kind !== 'turret') { e.vx += dx / d * 1100 * dt; e.vy += dy / d * 1100 * dt; } }
        for (const b of S.eshots) if (Math.hypot(b.x - s.x, b.y - s.y) < 70) { b.life = 0; part(S, 'spark', b.x, b.y, (s.x - b.x) * 3, (s.y - b.y) * 3, 0.2, P.m); }
        if (S.rng.chance(0.8)) { const a = S.rng() * TAU; part(S, 'spark', s.x + Math.cos(a) * 30, s.y + Math.sin(a) * 30, -Math.cos(a) * 90, -Math.sin(a) * 90, 0.3, S.rng.pick([P.m, P.v])); }
        if (s.life <= 0 || wallAt(S, s.x, s.y)) { s.life = 0; for (const e of alive(S)) if (Math.hypot(e.x - s.x, e.y - 6 - s.y) < 50 + e.r) ghit(S, e, s.dmg, { kx: e.x - s.x, ky: e.y - s.y, kb: 160, col: P.m, crit: true }); ring(S, s.x, s.y, 52, P.m); ring(S, s.x, s.y, 30, P.v); K.deathBurst(S, s.x, s.y, P.m, 1.2); flashLight(S, s.x, s.y, 120, P.m, 1.6); addShake(S, 0.6); S.stop = Math.max(S.stop, 0.08); sfx('boom'); }
        continue;
      }
      if (wallAt(S, s.x, s.y)) { s.life = 0; if (s.k === 'breach') { D.hitWall(S, s.x, s.y + 6, s.dmg * 4); ring(S, s.x, s.y, 12, P.o); addShake(S, 0.2); } for (let i = 0; i < 4; i++) part(S, 'spark', s.x, s.y, S.rng.range(-50, 50), S.rng.range(-50, 50), 0.2, s.col); continue; }
      for (const e of alive(S)) if (!s.hit.has(e) && Math.hypot(e.x - s.x, e.y - 6 - s.y) < e.r + s.r) {
        s.hit.add(e); s.life = 0;
        if (s.k === 'bolas') {
          ghit(S, e, s.dmg, { kx: s.vx, ky: s.vy, kb: 20, col: '#c8cdda' }); if (!e.dead) { e.stun = Math.max(e.stun || 0, isBoss(e) ? 0.5 : 2); e.bolaT = S.t; e.bolaPid = s.pid; text(S, e.x, e.y - 28, 'BOUND', '#c8cdda'); }
          const mate = S.enemies.find(o => o !== e && !o.dead && o.bolaPid === s.pid && S.t - o.bolaT < 0.5);
          if (mate && !e.dead) (S.alinks = S.alinks || []).push({ a: e, b: mate, t: 1.2 });
        } else if (s.k === 'breach') { const a = Math.atan2(s.vy, s.vx); ghit(S, e, s.dmg, { kx: s.vx, ky: s.vy, kb: 0, col: P.o, crit: true }); K.fling(S, e, a, 480, 20, P.o); ring(S, e.x, e.y - 6, 14, P.o); addShake(S, 0.3); }
        break;
      }
    }
    S.ap = ap(S).filter(s => s.life > 0);
    flingStep(S, dt);
    if (p.beamFx) { p.beamFx.t -= dt; if (p.beamFx.t <= 0) p.beamFx = null; }
  };

  // ── 6. 画
  const draw0 = K.meleeDraw; K.meleeDraw = function (S, ctx, ex) {
    if (draw0) draw0(S, ctx, ex);
    const p = S.player, gid = S.raid && D.gunId(S.raid), g = gid && D.CARDS[gid].gun;
    // 链弹炮在飞的两颗之间连一根链子；拽在一起的敌人之间也是
    const bol = ap(S).filter(s => s.k === 'bolas');
    for (const a of bol) for (const b of bol) if (a !== b && a.pid === b.pid && a.x < b.x + 0.001) { ctx.strokeStyle = '#646e86'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    for (const L2 of S.alinks || []) { ctx.strokeStyle = '#949fb6'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L2.a.x, L2.a.y - 6); ctx.lineTo(L2.b.x, L2.b.y - 6); ctx.stroke(); }
    for (const s of ap(S)) {
      if (s.k === 'bolas') { ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.arc(s.x, s.y, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#949fb6'; ctx.beginPath(); ctx.arc(s.x - 0.5, s.y - 0.5, 2.5, 0, TAU); ctx.fill(); }
      else if (s.k === 'saw') { ex.save(); ex.translate(s.x, s.y); ex.rotate(s.spin); ex.fillStyle = '#dbe5fa'; for (let i = 0; i < 6; i++) { ex.rotate(TAU / 6); ex.fillRect(2, -1, 5, 2); } ex.fillStyle = '#ffffff'; ex.beginPath(); ex.arc(0, 0, 2, 0, TAU); ex.fill(); ex.restore(); }
      else if (s.k === 'breach') { ex.fillStyle = P.o; ex.beginPath(); ex.arc(s.x, s.y, 3, 0, TAU); ex.fill(); ex.fillStyle = P.Y; ex.beginPath(); ex.arc(s.x, s.y, 1.5, 0, TAU); ex.fill(); }
      else if (s.k === 'sing') { ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, TAU); ctx.fill(); ex.strokeStyle = P.m; ex.lineWidth = 1.5; ex.beginPath(); ex.arc(s.x, s.y, 6 + Math.sin(S.t * 20), 0, TAU); ex.stroke(); ex.save(); ex.globalAlpha = 0.1; ex.strokeStyle = P.v; ex.lineWidth = 0.5; ex.setLineDash([2, 6]); ex.lineDashOffset = S.t * 30; ex.beginPath(); ex.arc(s.x, s.y, 70, 0, TAU); ex.stroke(); ex.restore(); }
      else if (s.k === 'sonicfx') { const k = s.life / s.max, r = 100 * (1 - k); ex.save(); ex.globalAlpha = k; ex.strokeStyle = P.M; ex.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ex.beginPath(); ex.arc(s.x, s.y, Math.max(1, r - i * 12), s.a - 0.45, s.a + 0.45); ex.stroke(); } ex.restore(); }
    }
    if (p.beamFx) { const b = p.beamFx; ex.save(); ex.strokeStyle = P.g; ex.lineWidth = 1.5 + b.k * 1.2; ex.beginPath(); ex.moveTo(b.x0, b.y0); ex.lineTo(b.x1, b.y1); ex.stroke(); ex.strokeStyle = '#ffffff'; ex.lineWidth = 0.5 + b.k * 0.4; ex.stroke(); ex.restore(); }
    for (const e of S.enemies) if (e.para && !e.dead && e.f === S.f) { const k = 0.5 + 0.5 * Math.sin(S.t * (6 + (3 - e.para.t) * 6)); ex.fillStyle = D.rgba(P.g, 0.5 + 0.5 * k); ex.fillRect(e.x - 1.5, e.y - 9, 3, 3); }
    for (const s of S.shots) if (s.ice) { ex.fillStyle = '#e6fbff'; ex.fillRect(s.x - 1, s.y - 1, 2, 2); }
    if (!g || p.hp <= 0) return;
    // 头顶的小条：蓄力、热量；赌徒左轮下一发
    const bar = (k, col) => { ctx.fillStyle = '#0b0a14'; ctx.fillRect(p.x - 8, p.y - 30, 16, 3); ex.fillStyle = col; ex.fillRect(p.x - 7.5, p.y - 29.5, 15 * k, 2); };
    if (g.charge && p.chg > 0) bar(p.chg / g.charge, P.c);
    if (g.heat && ((p.heat || 0) > 0.02 || p.heatLock > 0)) bar(p.heatLock > 0 ? p.heatLock / 2 : p.heat, p.heatLock > 0 ? (S.t % 0.3 < 0.15 ? P.r : P.o) : p.heat > 0.6 ? P.r : P.O);
    if (g.x === 'gambler') { if (!p.gambNext) p.gambNext = rollGamb(S); const G2 = GAMB.find(x => x[0] === p.gambNext); ctx.fillStyle = '#0b0a14'; ctx.fillRect(p.x + 7, p.y - 31, 6, 6); ex.fillStyle = G2[2]; ex.fillRect(p.x + 8, p.y - 30, 4, 4); }
  };
  D.GAMB = GAMB;
})(D);
