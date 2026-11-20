/* 末班之后 · 小样二：一个站（进站、换层、每帧、交互）
   操作：WASD 移动，左键开枪（按住连发），右键近战，空格闪避，Q/E 模块，R 换弹，F 交互，C 维修包。
   电容：近战、子弹打中和击毁都充电，满了按 X 释放：弹匣补满、整匣超级弹（ammo.js）；子弹命中缩短近战冷却。
   搜刮：打开容器后东西一件件揭开，越稀有越慢，揭开时按品质闪色光，金和红会冲起光柱。
   敌人开枪是瞬时的：看不到弹道，打出去之后才留下一道曳光。
   坐标：世界单位；画面 640×360 = 世界 320×180（D.Z = 2）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, Z = D.Z, VW = D.W / Z, VH = D.H / Z, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const Q = () => D.QUALITY;
  const K = D.K || (D.K = {}); // 站内各文件共用的内部函数
  const CONT = D.CONT, CMAT = D.CMAT, OPEN_POP = 0.18, OPEN_DUR = D.OPEN_DUR;
  // 别的文件里定义的函数：调用时再去 D.K 上找
  const startOpen = (...a) => K.startOpen(...a);
  const openBurst = (...a) => K.openBurst(...a);
  const newContainer = (...a) => K.newContainer(...a);
  const rollItem = (...a) => K.rollItem(...a);
  const dropsStep = (...a) => K.dropsStep(...a);
  const revealStep = (...a) => K.revealStep(...a);
  const projectiles = (...a) => K.projectiles(...a);
  const part = (...a) => K.part(...a);
  const text = (...a) => K.text(...a);
  const ring = (...a) => K.ring(...a);
  const flashLight = (...a) => K.flashLight(...a);
  const deathBurst = (...a) => K.deathBurst(...a);
  const spawnGarrison = (...a) => K.spawnGarrison(...a);
  const enemyStep = (...a) => K.enemyStep(...a);
  const hurt = (...a) => K.hurt(...a);
  const finishUse = (...a) => K.finishUse(...a);
  D.pickNade = R => D.pickUse(R, 'nade'); // 快捷栏选中的手雷（quick.js）
  const startReload = (...a) => K.startReload(...a);
  const fire = (...a) => K.fire(...a);
  const melee = (...a) => K.melee(...a);
  const useMod = (...a) => K.useMod(...a);
  const useSkill = (...a) => K.useSkill(...a);
  const scarf = (...a) => K.scarf(...a);
  const startExtract = (...a) => K.startExtract(...a);
  const extractStep = (...a) => K.extractStep(...a);



  // ───────────────────────── 进站（每次进站都重新随机生成；同一站不同步数长得不一样）
  // o.tut：新手教学站（不刷驻军和地上的东西，教学脚本自己放）
  // o.revisit：死胡同折返回来，容器已经搜空；o.asType：问号站按哪种站生成；o.bonus：容器品质加成；o.ambush / o.elite：问号站的伏击
  D.enterStation = function (raid, st, step, o) {
    o = o || {}; const tut = !!o.tut;
    if (o.asType) st = Object.assign({}, st, { type: o.asType });
    const evSite = st.type === 'event'; // 未知信号站：就是一座地铁站（站台、铁轨）；人、信号、闸机在 event.js；不过场、不坐班车
    const T = D.STATION_TYPES[st.type], seed = o.seed || raid.city.seed + ':' + st.id + ':' + step + ':' + raid.pf.raids; // o.seed：联机队友用房主发来的种子建同一个站
    const rng = D.rng(seed), isExit = !!st.exit && D.exitOpen(st, step);
    const opt = { exit: isExit, safe: !!T.safe, inter: st.lines && st.lines.length > 1, tut };
    const floors = D.makeStation(rng, st, opt);
    const fxs = floors.map(F => { const [c, x] = D.canvas(F.floor.width, F.floor.height); x.drawImage(F.floor, 0, 0); return { c, x }; });
    const S = {
      raid, st, step, seed, enterOpt: { revisit: !!o.revisit, asType: o.asType || null, bonus: o.bonus || 0 }, rng, floors, fxs, f: 1, A: floors[1], floor: fxs[1].c, fx: fxs[1].x, t: 0, safe: !!T.safe, isExit,
      player: null,
      enemies: [], containers: [], shots: [], eshots: [], tracers: [], shells: [], nades: [], parts: [], texts: [], mines: [], ghosts: [], tlights: [], bolts: [], beams: [], pillars: [], drops: [], ground: [], groundNear: [],
      SH: null, mods: raid.modsAtStart || null, scanT: 0, relay: null, // mods：装着的改装件，画在身上（heroes.js）
      shake: 0, stop: 0, slowT: 0, decoy: null, cam: { x: 0, y: 0 }, banner: null, events: [], shotsFired: 0, kills: 0, flowT: 0, flow: null,
      prompt: null, near: null, extract: null, trader: null, healer: null, console: null, motes: [],
    };
    S.SH = shellOf(raid); S.player = makePlayer(S, raid, S.SH, tut); // 多人联机（MP0）：队友也用同一个 makePlayer 建
    floors.forEach((F, fi) => { for (const sp of F.contSpots) { const c = newContainer(S, rng, sp.kind, sp.x, sp.y, sp.bonus); c.f = fi; c.room = sp.room; S.containers.push(c); } });
    const shadow = !!o.shadow; // 联机队友本机的影子站：只建墙和摆设，敌人、箱子里的东西、地上的东西都等房主的快照
    if (o.bonus && !shadow) for (const c of S.containers) for (let k = 0; k < c.items.length; k++) { const r = rollItem(S, rng, (CONT[c.kind].bonus || 0) + o.bonus, CONT[c.kind]); if (D.Grid.canAdd(c.grid, r.id, r.n)) { D.Grid.add(c.grid, r.id, r.n); break; } }
    if (o.revisit) for (const c of S.containers) { c.items.length = 0; c.opened = true; c.locked = false; c.openT = OPEN_DUR; c.burst = true; }
    if (D.Story && !tut && !shadow) D.Story.onEnter(S, o); // 主线：线索、委托物、储备库
    if (D.Growth && !tut && !shadow) D.Growth.onEnter(S); // 委托：到站、送包裹
    if (D.Outpost && !tut && !shadow) D.Outpost.onEnter(S, o); // 人类据点：进站横幅
    if (opt.trader) { S.trader = opt.trader; S.healer = Object.assign(opt.healer, { used: raid.healed.has(st.id) }); }
    S.people = opt.people || []; // 人类据点里的人（outpost.js）
    S.talk = null; if (evSite) D.evSiteSetup(S, rng); // 未知信号站：站台上摆 NPC、信号、闸机（event.js）
    if (opt.console) S.console = Object.assign(opt.console, { used: false });
    if (opt.relay) S.relay = Object.assign(opt.relay, { used: false });
    // 地上散落的东西（不用搜，走过去就能捡）：高价值房间里更多、更好
    if (!tut && !o.revisit && !shadow) floors.forEach((F, fi) => { for (const sp of F.loose || []) { const r = rollItem(S, rng, sp.bonus, sp.hv ? CONT.vault : null); S.ground.push({ x: sp.x, y: sp.y, f: fi, id: r.id, n: r.n, t: 1 }); } });
    if (!S.safe && !tut && !shadow) spawnGarrison(S, rng);
    if (o.elite && !shadow) { const e = K.spawnEnemy(S, 'engineer', S.A.w / 2, 15 * TS, 1.4, 1, true); e.home = null; }
    if (o.ambush && !shadow) for (let i = 0; i < 2 + Math.min(2, st.tier); i++) K.spawnEnemy(S, o.ambush, i % 2 ? S.A.w - 5 * TS : 14 * TS, rng.range(13 * TS, 18 * TS), 1.2 + i * 0.3, 1, true);
    if (!tut && !evSite && S.A.track) { S.intro = { t: 0 }; S.player.inv = Math.max(S.player.inv, 1.6); S.hideP = true; S.player.y = 18 * TS + 6; S.player.aim = -Math.PI / 2; } // 列车进站、开门、下车
    if (!S.intro) D.playerAct(S.player, 'stand', 0.75); // 没有下车过场：原地开机站起来
    resetMotes(S);
    S.cam.x = D.clamp(S.player.x - VW / 2, 0, Math.max(0, S.A.w - VW)); S.cam.y = D.clamp(S.player.y + 10 - VH / 2, -4, Math.max(0, S.A.h - VH + 20));
    S.banner = { t: 0, text: st.name, sub: o.revisit ? '来过了 · 东西都搜空了' : (isExit ? (step === 0 && !tut ? '入口站 · ' : '撤离站 · ') : '') + T.name + ' · 威胁 ' + D.threatLv(raid) + ' 级' };
    markRoom(S);
    if (D.schedInit) D.schedInit(S, o); // 站台班车：只能坐车离开（train.js）
    return S;
  };
  // 一个玩家（站里的工壳）：位置、耐久、冷却……；SH 是型号（带涂装）
  function shellOf(raid) { const SH = D.SHELLS[raid.shell || 'worker']; return raid.look ? Object.assign({}, SH, raid.look) : SH; } // 涂装
  function makePlayer(S, raid, SH, tut) {
    const p = { x: 6 * TS, y: 16 * TS, r: 5, vx: 0, vy: 0, hp: raid.hp, maxHp: raid.maxHp, shield: 0, shieldT: 0, aim: 0, dashT: 0, dashCd: 0, dx: 0, dy: 0, inv: 0.6, hurtT: 0, flash: 0, walk: 0, swingT: 0, swingDir: 1, meleeCd: 0, fireCd: 0, reload: 0, reloadMax: 1, mag: 0, cap: 0, lungeHit: null, scarf: [], modCd: { q: 0, e: 0 }, jamT: 0, healT: 0, pullT: 0, useT: 0, useK: null, buffT: 0 };
    p.mag = raid.mag; // 弹匣跟着工壳走，不会进站就白送满
    Object.assign(p, { bloom: 0, chargeT: 0, charging: false, dodgeUntil: 0, pdDone: true, skillCd: 0, cloakT: 0, healOT: 0, lastHurt: -9, speed: SH.speed * D.fxOf(raid).speed, dashCdMax: (SH.dashCd || D.SHELL.dashCd) * (raid.pas.spring ? 0.6 : 1) * D.fxOf(raid).dash, scale: SH.scale || 1 });
    if (D.fxOf(raid).shield0 && !tut) p.shield += D.fxOf(raid).shield0; // 护盾发生器
    for (let i = 0; i < 8; i++) p.scarf.push({ x: p.x, y: p.y - 8, px: p.x, py: p.y - 8 });
    return p;
  }
  function resetMotes(S) { S.motes = []; for (let i = 0; i < 70; i++) S.motes.push({ x: S.rng() * S.A.w, y: S.rng() * S.A.h, vx: S.rng.range(-3, 3), vy: S.rng.range(-4, -1), s: S.rng() }); }
  // 换层：清掉飞行中的东西，镜头直接跳过去
  function goFloor(S, to, stair) {
    const from = S.f; if (D.floorFx) D.floorFx(S, from, to, stair && stair.dir); // 试玩反馈 5：上下楼过渡（floorfx.js），要在换层之前记下旧层
    S.f = to; S.A = S.floors[to]; S.floor = S.fxs[to].c; S.fx = S.fxs[to].x;
    const back = S.A.stairs.find(s => s.to === (stair ? stair.from : -1)) || S.A.stairs[0];
    const p = S.player; p.vx = p.vy = 0; p.inv = Math.max(p.inv, 0.6); S.stairCd = S.t + 0.5;
    const spots = [[0, 26], [0, -18], [28, 6], [-28, 6], [0, 40], [0, -30]].map(([dx, dy]) => ({ x: back.x + dx, y: back.y + dy }));
    const ok = q => { for (const [ox, oy] of [[-6, -5], [6, -5], [-6, 5], [6, 5], [0, 0]]) if (D.solidAt(S.A, q.x + ox, q.y + oy)) return false; return true; };
    const land = spots.find(ok) || { x: back.x, y: back.y + 14 }; p.x = land.x; p.y = land.y;
    if (S.players && S.players.length > 1) S.players.forEach((q, i) => { if (q === p) return; const sp = spots.filter(ok)[i % 6] || land; q.x = sp.x; q.y = sp.y; q.vx = q.vy = 0; q.inv = Math.max(q.inv, 0.6); }); // 联机：全队一起换层（楼梯口要全队都到）
    S.shots = []; S.eshots = []; S.tracers = []; S.shells = []; S.nades = []; S.parts = []; S.mines = []; S.drops = S.drops.filter(d => d.f === to); S.flow = null;
    resetMotes(S);
    S.cam.x = D.clamp(p.x - VW / 2, 0, Math.max(0, S.A.w - VW)); S.cam.y = D.clamp(p.y + 10 - VH / 2, -4, Math.max(0, S.A.h - VH + 20));
    S.banner = { t: 0, text: S.A.name, sub: S.st.name };
    sfx('dash'); markRoom(S);
  }
  // 小地图：走进过的房间点亮
  function markRoom(S) { const A = S.A, tx = Math.floor(S.player.x / TS), ty = Math.floor(S.player.y / TS), ri = A.room[ty * A.tw + tx]; if (ri >= 0 && !A.rooms[ri].seen) { A.rooms[ri].seen = true; if (A.rooms[ri].hidden) { S.banner = { t: 0, text: '隐藏房间', sub: '好东西都在这种地方' }; sfx('rare'); } else if (A.rooms[ri].hv) { S.banner = { t: 0, text: '高价值区域', sub: A.rooms[ri].name + ' · 守卫很多，东西很值钱', hv: true }; sfx('rare'); } } }
  // ───────────────────────── 每帧
  const ONE_SHOT = ['melee', 'dash', 'q', 'e', 'reload', 'heal', 'shieldUse', 'charge', 'ammo', 'interact', 'pick', 'skill', 'nade'];
  D.stepStation = function (S, dt, inp) {
    // 顿帧期间按下的键先记着，顿帧结束那一帧再生效（不然打中之后紧跟着的点击、闪避会被吞掉）
    if (S.stop > 0) { S.stop -= dt; const b = S.ibuf || (S.ibuf = {}); for (const k of ONE_SHOT) if (inp[k]) b[k] = true; return; }
    if (S.ibuf) { for (const k in S.ibuf) inp[k] = true; S.ibuf = null; }
    const realDt = dt;
    const IN = D.TRAIN_IN, OUT = D.TRAIN_OUT;
    // 多人联机（mp-core.js）：S.ponly = 这一遍只走"这个人"的部分（队友），世界（敌人、子弹、车、计时……）由房主那一遍走；单人时一直是 false
    const W0 = !S.ponly, MP = !!(S.players && S.players.length > 1);
    if (S.intro && W0) {
      const t0 = S.intro.t; S.intro.t += realDt; const t = S.intro.t, p0 = S.player;
      if (t < IN.walk) inp = { mx: 0, my: 0 };
      if (S.intro.y1 == null) S.intro.y1 = p0.y;
      if (t >= IN.open && t < IN.walk) { const u = (t - IN.open) / (IN.walk - IN.open), e = u * u * (3 - 2 * u); p0.y = D.lerp((S.A.track || S.floors[1].track).y0 * TS + 12, S.intro.y1, e); p0.walk += realDt * 8; p0.aim = -Math.PI / 2; } // 从车门走下来
      if (t0 < IN.walk && t >= IN.walk) { p0.y = S.intro.y1; p0.inv = Math.max(p0.inv, 0.5); } // 落地后 0.5 秒无敌，来得及反应
      if (t > IN.arrive * 0.45 && t < IN.arrive && S.f === 1) { const tr = D.trainState(S); if (tr) for (let c = 0; c < 4; c++) if (S.rng.chance(0.5)) part(S, 'spark', tr.x + TS + c * 100 + S.rng.pick([16, 84]), S.A.track.y0 * TS + 29, S.rng.range(-90, -20), S.rng.range(-50, -10), S.rng.range(0.15, 0.35), S.rng.pick(['#ffd860', '#ff9a4a', '#fff2c8'])); } // 刹车火花
      if (t0 < IN.arrive && t >= IN.arrive) { K.addShake(S, 0.25); sfx('slam'); }
      if (t0 < IN.open && t >= IN.open - 0.2) sfx('open_metal');
      if (t0 < IN.walk && t >= IN.walk) D.playerAct(p0, 'stand', 0.6); // 下车后站直、护目亮起
      if (t > IN.gone) S.intro = null;
    }
    if (S.outro && W0) {
      const rideT0 = S.outro.t; S.outro.t += realDt; const o = S.outro, p0 = S.player;
      if (rideT0 < D.OUTRO_RIDE.start && o.t >= D.OUTRO_RIDE.start) { S.banner = o.next ? { t: 0, text: '前往下一站', sub: '列车开进隧道' } : { t: 0, text: '撤离成功', sub: '接驳车开进隧道，回据点' }; sfx('power'); }
      if (o.dx != null && o.t <= OUT.walk) { const u = Math.min(1, o.t / OUT.walk); p0.x = D.lerp(o.px, o.dx, u); p0.y = D.lerp(o.py, o.dy, u); p0.walk += realDt * 8; p0.aim = Math.atan2(o.dy - o.py, o.dx - o.px); } // 走进车门
    }
    S.hideP = !!(S.outro && S.outro.t > OUT.walk) || !!(S.intro && S.intro.t < IN.open);
    if (S.slowmo > 0 && W0) { S.slowmo -= dt; dt *= 0.35; } // 完美闪避后的慢动作
    if (W0) S.t += dt;
    if (S.banner && W0) { S.banner.t += realDt; if (S.banner.t > (D.settings.lite && !S.banner.keep ? 1.8 : 2.4)) S.banner = null; }
    const p = S.player, I = D.Input, R = S.raid, L = R.load, pas = R.pas;
    if (inp.ax != null) { I.wx = inp.ax; I.wy = inp.ay; } else { I.wx = I.mx / Z + S.cam.x; I.wy = I.my / Z + S.cam.y; } // 队友的瞄准点跟着输入一起发过来
    const alive = p.hp > 0 && !S.over && !p.out; // p.out：联机里这个人已经倒下 / 撤出了
    // 左右键 → 两个武器槽（wslots.js）：哪边按下了就换到那边的武器（枪换弹匣、近战换成那把），再把"点一下 / 按住"交给它
    const lPress = !!inp.fire && !p.lHeld; p.lHeld = !!inp.fire;
    const side = { gun: { press: lPress, held: !!inp.fire }, melee: { press: !!inp.melee, held: !!inp.meleeHeld } };
    if (alive) for (const k of D.WSLOTS) if (side[k].press) {
      if (D.isGun(L[k])) { if (D.gunKey(R) !== k) D.swapGun(S, k); p.hand = k; }
      else if (D.isMel(L[k])) { if (D.melKey(R) !== k) { R.mk = k; p.charging = false; p.chargeT = 0; p.shPress = null; p.blocking = false; p.meleeBuf = 0; } p.hand = k; }
    }
    const gk = D.gunKey(R), mk = D.melKey(R), gun = gk ? D.gunOf(R.pf, L[gk], R) : null, mel = mk ? D.CARDS[L[mk]].melee : null;
    const scoped = !!(gun && gun.scope && gk === 'gun' && mk === 'melee'); // 狙击类在左键、右键是近战：右键按住开镜（原来的玩法）
    { const g = gk ? side[gk] : null, m = mk ? side[mk] : null; inp = Object.assign({}, inp, { fire: !!(g && g.held), melee: !!(m && m.press), meleeHeld: !!(m && m.held) }); }
    if (alive) {
      p.aim = Math.atan2(I.wy - (p.y - 6), I.wx - p.x);
      if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { R.mag = p.mag; const got = D.loadMag(R, gun.mag - R.mag); p.mag = R.mag; sfx(got ? 'draw' : 'nope'); if (!got) text(S, p.x, p.y - 26, 'NO AMMO', P.r); } }
      if (inp.reload && gun && !gun.heat && p.reload <= 0 && p.mag < gun.mag) startReload(S, gun);
      if (inp.ammo && gun) { // B：换弹种（下次换弹生效）
        const have = D.ammoTiers(R, gun.cal), tiers = [1, 2, 3, 4, 5].filter(t => have[t] > 0); // 五级在工坊做（workshop.js）
        if (tiers.length) { const cur = D.pickTier(R, gun.cal), nx = tiers[(tiers.indexOf(cur) + 1) % tiers.length]; R.ammoPick[gun.cal] = nx; text(S, p.x, p.y - 26, D.AMMO_TIER[nx].name, D.QUALITY[D.AMMO_TIER[nx].q].col); sfx('click'); }
      }
      if (K.armsPre) K.armsPre(S, dt, inp, gun); // M5：转管、连发、移速、纳米修复、护盾发生器、分身
      if (K.meleeStep) K.meleeStep(S, dt); // 近战招牌重击、剑气、被打飞的敌人（melee.js）
      p.fireCd -= dt;
      if (inp.fire && gun && p.fireCd <= 0 && p.reload <= 0 && p.dashT <= 0 && !S.lootOpen) { if (p.mag > 0 || gun.heat) fire(S, gun); else startReload(S, gun); }
      p.bloom = Math.max(0, p.bloom - dt * (inp.fire ? 1.1 : 3));
      p.meleeCd -= dt;
      if (mel && mel.mode && K.meleeInput) K.meleeInput(S, mel, inp, dt); // 举盾、打桩机、骑枪、抓取爪（arsenal-melee.js）
      else if (scoped) {
        // 狙击类：右键点按是近战，按住是开镜（代替蓄力重击）
        if (inp.meleeHeld) p.rHold = (p.rHold || 0) + dt;
        else { if (p.rHold > 0 && p.rHold < 0.18 && p.meleeCd <= 0 && p.dashT <= 0) melee(S, mel); p.rHold = 0; }
      } else if (mel) {
        if (mel.cd <= 0.15) { if ((inp.melee || inp.meleeHeld) && p.meleeCd <= 0 && p.dashT <= 0) melee(S, mel); } // 链锯：按住一直锯
        else {
          // 点一下：普通挥击；按住不放 0.6 秒蓄满，松开打出重击
          // 冷却没好时点的那一下先记着（0.18 秒内冷却一好就砍出去），不然出手快的刀点快了会一下有一下没有
          if (inp.melee) { if (p.meleeCd <= 0 && p.dashT <= 0) melee(S, mel); else p.meleeBuf = 0.18; p.charging = true; p.chargeT = 0; }
          else if (p.meleeBuf > 0) { p.meleeBuf -= dt; if (p.meleeCd <= 0 && p.dashT <= 0) { p.meleeBuf = 0; melee(S, mel); } }
          if (p.charging) {
            if (inp.meleeHeld) { const was = p.chargeT; p.chargeT += dt; if (was < D.TUNE.chargeT && p.chargeT >= D.TUNE.chargeT) { sfx('chargeup'); ring(S, p.x, p.y - 6, 14, P.O); } }
            else { if (p.chargeT >= D.TUNE.chargeT && p.dashT <= 0) { p.meleeBuf = 0; melee(S, mel, true); } p.charging = false; p.chargeT = 0; }
          }
        }
      }
      { const want = !!(scoped && (p.rHold || 0) >= 0.18 && p.dashT <= 0 && p.reload <= 0 && !S.lootOpen);
        p.ads = D.clamp((p.ads || 0) + (want ? dt / (S.SH.trait.k === 'farshot' ? 0.18 : 0.35) : -dt / 0.12), 0, 1); // 鹰眼开镜快一倍
        if (want && p.ads >= 1 && !p.adsFull && !(p.lastShot > S.t - gun.rate)) { p.adsFull = true; sfx('tink'); }
        if (!want) p.adsFull = false; }
      // 快捷栏 C / V / X / Z：点按用选中的那种，按住 + 滚轮换种类（quick.js）
      p.nadeCd = (p.nadeCd || 0) - dt;
      if (p.act) { p.act.t += dt; if (p.act.t >= p.act.dur) p.act = null; } // 一次性的动作（站起、换枪、扔、捡、用完药）
      const qf = K.quickStep(S, dt, inp);
      if (qf.nade) { const k = D.pickUse(R, 'nade'); if (k && p.nadeCd <= 0 && p.dashT <= 0) { D.Grid.take(R.bag, 'use:' + k, 1); K.throwNade(S, k); p.nadeCd = 0.6; } else sfx('nope'); }
      for (const k of ['q', 'e']) { p.modCd[k] -= dt * (S.jamField ? 0 : 1); if (inp[k] && L[k]) { if (p.modCd[k] <= 0 && p.jamT <= 0) { useMod(S, L[k]); p.modCd[k] = D.CARDS[L[k]].cd * (pas.heatsink ? 0.75 : 1); } else sfx('nope'); } }
      // 型号技能（G）
      p.skillCd -= dt;
      if (inp.skill) { if (p.skillCd <= 0) { useSkill(S, S.SH.skill.k); p.skillCd = S.SH.skill.cd * D.fxOf(R).skill; } else sfx('nope'); }
      if (p.healOT > 0) { const h = Math.min(p.healOT, dt) * 8; p.healOT -= dt; p.hp = Math.min(p.maxHp, p.hp + h); if (S.t % 0.2 < dt) part(S, 'spark', p.x + S.rng.range(-6, 6), p.y - 4, 0, -40, 0.5, P.g); }
      if (S.SH.trait.k === 'regen' && S.t - p.lastHurt > 3 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + dt * 1.5);
      if (p.cloakT > 0) p.cloakT -= dt;
      if (S.scanT > 0) S.scanT -= dt;
      if (inp.dash && p.dashCd <= 0 && p.dashT <= 0) {
        let mx = inp.mx, my = inp.my; if (!mx && !my) { mx = Math.cos(p.aim); my = Math.sin(p.aim); }
        const l = Math.hypot(mx, my); p.dx = mx / l * D.SHELL.dashSpeed; p.dy = my / l * D.SHELL.dashSpeed; p.dashT = D.SHELL.dashTime; p.inv = Math.max(p.inv, D.SHELL.dashTime + 0.06);
        p.dashCd = p.dashCdMax; p.lungeHit = null; p.pullT = 0; p.dodgeUntil = S.t + D.SHELL.dashTime + 0.1; p.pdDone = false; sfx('dash');
        for (let i = 0; i < 6; i++) part(S, 'smoke', p.x, p.y, -p.dx * 0.05 + S.rng.range(-10, 10), -p.dy * 0.05 + S.rng.range(-10, 10), 0.4, '#6b7290');
      }
      // 消耗品：在背包里就能用。读条中移动减速，读完才生效
      if (p.useT > 0) { p.useT -= dt; if (p.useK && D.USE[p.useK].heal && S.t % 0.12 < dt) part(S, 'spark', p.x + S.rng.range(-7, 7), p.y - S.rng.range(2, 10), S.rng.range(-8, 8), -50, 0.5, P.g); if (p.useT <= 0) finishUse(S, p.useK); }
      else {
        const B = R.bag;
        let k = null;
        if (qf.heal && p.hp < p.maxHp && !(p.healCd > 0)) k = D.pickUse(R, 'heal');
        else if (qf.cell && !(p.cellCd > 0)) k = D.pickUse(R, 'cell'); // 护盾也有冷却了（cooldown.js）
        if (k) { D.Grid.take(B, 'use:' + k, 1); p.useK = k; p.useT = D.USE[k].time; sfx('throw'); }
        else if (qf.heal || qf.cell) { if (qf.heal && p.hp >= p.maxHp) {} else if ((qf.heal && p.healCd > 0) || (qf.cell && p.cellCd > 0)) sfx('nope'); else { text(S, p.x, p.y - 26, 'NONE', P[4]); sfx('nope'); } }
      }
      p.buffT -= dt; p.healCd = (p.healCd || 0) - dt; p.cellCd = (p.cellCd || 0) - dt;
      S.dt = dt; interact(S, inp);
      if (p.dashT > 0) {
        p.dashT -= dt; p.vx = p.dx; p.vy = p.dy;
        if (S.t % 0.03 < dt) S.ghosts.push({ x: p.x, y: p.y, t: 0.2, flip: Math.cos(p.aim) < 0, col: p.lungeHit ? P.O : P.c, slot: (() => { const GH = D.heroOf ? D.heroOf(S.SH.key) : D.HERO; return GH && GH.ready ? GH.meta['walk' + D.heroDir(p.aim)][0] : null; })() });
        if (p.lungeHit) for (const e of S.enemies) if (!e.dead && !p.lungeHit.hit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 14) { p.lungeHit.hit.add(e); hurt(S, e, p.lungeHit.dmg, { kx: p.dx, ky: p.dy, kb: 90, col: P.O, slash: true, melee: true }); }
        if (p.dashT <= 0) { p.vx *= 0.2; p.vy *= 0.2; }
      } else if (p.pullT > 0) { p.pullT -= dt; } // 被磁钩拖着走
      else {
        const l = Math.hypot(inp.mx, inp.my) || 1, sp = p.speed * (p.useT > 0 && p.healOT <= 0 ? 0.5 : 1) * (p.buffT > 0 ? 1.25 : 1) * (S.lootOpen && S.lootOpen.items ? 0.55 : 1) * (p.charging && p.chargeT > 0.15 ? 0.7 : 1) * (1 - 0.45 * (p.ads || 0)) * (p.spdMul || 1) * (p.down ? 0.25 : 1), tx = inp.mx / l * sp, ty = inp.my / l * sp;
        const k = 1 - Math.exp(-dt * 18); p.vx += (tx - p.vx) * k; p.vy += (ty - p.vy) * k;
      }
      D.move(S.A, p, p.vx * dt, p.vy * dt);
      if (Math.hypot(p.vx, p.vy) > 20) { const w0 = p.walk; p.walk += dt * 11; if (Math.floor(p.walk / Math.PI) !== Math.floor(w0 / Math.PI)) part(S, 'smoke', p.x, p.y, S.rng.range(-8, 8), S.rng.range(-6, -1), 0.35, '#5a6080'); }
      // 搜：面板开着就一件件揭开
      const c = S.lootOpen && S.lootOpen.items ? S.lootOpen : null;
      if (c) revealStep(S, c, dt);
    } else { p.vx *= 0.9; p.vy *= 0.9; }
    p.dashCd -= dt; p.inv -= dt; p.flash -= dt; p.hurtT -= dt; p.swingT -= dt; p.jamT -= dt; p.healT -= dt;
    if (p.shield > 0) { p.shieldT += dt; if (p.shieldT > 3) p.shield = Math.max(0, p.shield - dt * 3); }
    scarf(S, p);
    if (S.decoy) { S.decoy.t -= dt; if (S.decoy.t <= 0) S.decoy = null; }
    if (S.t > S.flowT) { S.flowT = S.t + 0.3; S.flow = D.flowField(S.A, S.player.x, S.player.y); } // 敌人往你这儿找路（联机时每人一张）
    let es = 1;
    if (W0) {
    if (S.slowT > 0) S.slowT -= dt;
    es = S.slowT > 0 ? 0.5 : 1;
    if (S.extract) extractStep(S, dt);
    else if (!S.safe && !S.tut && !S.over) K.lingerStep(S, dt);
    if (K.schedStep) K.schedStep(S, dt); // 下一班车：进站、停靠、上车（train.js）
    if (!S.safe && !S.tut && !S.over) { const lv0 = D.threatLv(S.raid); S.raid.alert += dt / 120; if (D.threatLv(S.raid) > lv0) { const lv1 = D.threatLv(S.raid); S.banner = { t: 0, text: '威胁升到 ' + lv1 + ' 级', sub: D.THREAT_NAME[lv1] + ' · 敌人更多更硬，哪儿都一样' };
      if (!S.shadow) { const q = (D.THREAT_HP[lv1] || 1) / (D.THREAT_HP[lv0] || 1); for (const e of S.enemies) if (!e.dead && !e.owner) { e.maxHp = Math.round(e.maxHp * q); e.hp = Math.round(e.hp * q); } } } } // 待得越久越危险；升级那一下场上活着的也跟着变硬（联机队友本机等房主快照）
    for (const e of S.enemies) if (!e.dead && e.f === S.f) { if (MP) D.MP.aim(S, e); if (e.frz > 0) e.frz -= dt; enemyStep(S, e, dt * es * (e.frz > 0 || e.tslow > 0 ? 0.3 : 1) * (e.haste > 0 ? 1.25 : 1) * (e.wet ? 0.7 : 1)); } // 冰冻：慢 70%；干扰机旁边：快 25%
    if (MP) D.MP.use(S, S.players[0]); // 每个敌人追自己选的那个人（换成那个人的视角走），走完换回房主
    }
    markRoom(S);
    if (!W0 && K.mpNear) K.mpNear(S); // 联机：队友脚边能捡的东西（房主那一遍在 dropsStep 里算）
    if (W0) {
    const E = S.enemies;
    for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
      const a = E[i], b = E[j]; if (a.dead || b.dead || a.f !== S.f || b.f !== S.f) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, m = a.r + b.r + 2;
      if (d < m) { const k = (m - d) / 2 / d; if (!D.ENEMIES[a.kind].boss && a.kind !== 'turret') { a.x -= dx * k; a.y -= dy * k; } if (!D.ENEMIES[b.kind].boss && b.kind !== 'turret') { b.x += dx * k; b.y += dy * k; } }
    }
    projectiles(S, dt, es);
    if (K.armsPost) K.armsPost(S, dt); // M5：着火、炮台、僚机、烟
    if (K.foesPost) K.foesPost(S, dt); // M5：干扰场、首领横幅、电网格
    if (K.worldPost) K.worldPost(S, dt); // M5：站内随机事件、积水
    for (const q of S.parts) {
      q.life -= dt;
      if (q.k === 'debris') { q.vz -= 260 * dt; q.z += q.vz * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.4; q.vx *= 0.6; q.vy *= 0.6; } }
      else if (q.k === 'smoke') { q.vx *= 0.94; q.vy *= 0.94; q.size += dt * 6; }
      else if (q.k === 'spark') { q.vx *= 0.9; q.vy = q.vy * 0.9 + 140 * dt; }
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    S.parts = S.parts.filter(q => q.life > 0);
    for (const t of S.texts) { t.t += realDt; t.y -= realDt * 14 * Math.max(0, 1 - t.t * 1.5); }
    S.texts = S.texts.filter(t => t.t < 0.9);
    const age = (arr, k) => { for (const o of arr) o[k || 't'] -= dt; return arr.filter(o => o[k || 't'] > 0); };
    dropsStep(S);
    for (const c of S.containers) if (c.openT != null && c.openT < OPEN_DUR) { c.openT += dt; if (!c.burst && c.openT >= OPEN_POP) { c.burst = true; if (c.f === S.f) openBurst(S, c); if (c.pendingPanel) { c.pendingPanel = false; const who = MP && c.openBy != null ? S.players[c.openBy] : null; if (who) D.MP.use(S, who); if (c.f === S.f && Math.hypot(c.x - S.player.x, c.y - 4 - S.player.y) < 34 && !S.lootOpen) S.events.push({ type: 'loot', c }); if (who) D.MP.use(S, S.players[0]); } } } // 联机：谁开的箱子，面板弹给谁
    S.floaters = (S.floaters || []).filter(o => (o.t += dt) < 1);
    S.ghosts = age(S.ghosts); S.bolts = age(S.bolts); S.beams = age(S.beams); S.tracers = age(S.tracers); S.pillars = age(S.pillars);
    for (const l of S.tlights) l.a -= dt * l.decay; S.tlights = S.tlights.filter(l => l.a > 0);
    for (const m of S.motes) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.y < 0) { m.y = S.A.h; m.x = S.rng() * S.A.w; } }
    S.shake = Math.max(0, S.shake - realDt * 1.8);
    }
    S.recoil = (S.recoil || 0) * Math.exp(-realDt * 16);
    if (S.hitMark && (S.hitMark.t -= realDt) <= 0) S.hitMark = null;
    S.hurtDirs = (S.hurtDirs || []).filter(h => (h.t -= realDt) > 0);
    // 低于三成耐久：心跳声（越低越快）和画面边缘收红
    if (p.hp > 0 && p.hp < p.maxHp * 0.3 && !S.over) { S.heartT = (S.heartT || 0) - realDt; if (S.heartT <= 0) { S.heartT = 0.5 + 0.7 * p.hp / (p.maxHp * 0.3); S.beat = 0.25; sfx('heart'); } }
    S.beat = Math.max(0, (S.beat || 0) - realDt);
    S.camShift = D.lerp(S.camShift || 0, S.lootOpen && (S.lootOpen.items || S.lootOpen.trade) ? VW * 0.27 : 0, 1 - Math.exp(-realDt * 7));
    const tx = D.clamp(p.x - VW / 2 + S.camShift + (I.mx / Z - VW / 2) * (0.15 + 0.45 * (p.ads || 0)) * (S.lootOpen ? 0 : 1), 0, Math.max(0, S.A.w - VW) + S.camShift), ty = D.clamp(p.y + 10 - VH / 2 + (I.my / Z - VH / 2) * (0.12 + 0.45 * (p.ads || 0)), -4, Math.max(0, S.A.h - VH + 20));
    const ck = 1 - Math.exp(-realDt * 8); S.cam.x += (tx - S.cam.x) * ck; S.cam.y += (ty - S.cam.y) * ck;
    if (W0) { if (S.tut) D.tutStep(S, realDt); else D.hintCheck(S, realDt); }
    if (!S.over && !p.out && p.hp <= 0) { if (MP) { p.out = 'dead'; D.MP.teamOver(S); } else { S.over = 'dead'; S.endT = 0; } deathBurst(S, p.x, p.y - 6, P.o, 1.5); sfx('die'); for (let i = 0; i < 26; i++) part(S, 'debris', p.x, p.y - 6, S.rng.range(-140, 140), S.rng.range(-120, 50), S.rng.range(0.8, 1.6), S.rng.pick([P[2], P[3], P[4], P.o, '#c9d2d9'])); for (let i = 0; i < 12; i++) part(S, 'smoke', p.x + S.rng.range(-8, 8), p.y - 6, S.rng.range(-20, 20), S.rng.range(-40, -10), 1.4, '#3a3a4a'); flashLight(S, p.x, p.y - 6, 120, P.o, 1.6); }
    if (S.over && W0) { S.endT += realDt; if (S.endT > (S.over === 'extracted' || S.over === 'leave' ? (S.outro ? D.OUTRO_RIDE.start + (S.outro.dur || D.OUTRO_RIDE.dur) : 2.4) : 1.8) && !S.reported) { S.reported = true; S.events.push({ type: S.over }); } }
    if (D.Story && !S.tut && W0) D.Story.tick(S);
    if (!S.tut && D.stowKeys(S.raid)) { S.texts.push({ x: S.player.x, y: S.player.y - 30, s: 'KEY', col: '#ffd860', t: 0 }); } // 门禁卡自动收进卡包
  };

  // ───────────────────────── 交互
  // 范围里能按 F 的东西都收成候选，交给 D.Pick 选最近的一个（T 键切换，interact.js）
  function interact(S, inp) {
    const p = S.player, A = S.A; S.prompt = null; S.near = null; S.fpick = null;
    // 隧道口（试玩反馈第三轮）：走不过去了，每一站都只能在站台上坐车离开（train.js）
    for (const t of A.tunnels) if (Math.abs(p.x - t.x) < t.w && Math.abs(p.y - t.y) < t.h / 2) { S.prompt = { key: '', text: K.tunnelPrompt ? K.tunnelPrompt(S) : '隧道走不过去' }; return; }
    const C = D.Pick.list(S), add = C.add;
    for (const st of A.stairs) if (Math.abs(p.x - st.x) < 18 && Math.abs(p.y - st.y - 6) < 14) {
      const team = D.MP && D.MP.team(S, st.x, st.y + 6, 60); // 联机：全队都到楼梯口才能换层，一起走（不放一级级走的动画）
      if (S.extract) add({ ref: st, x: st.x, y: st.y + 6, key: '', text: '撤离战进行中，守住站台' });
      else if (team && team.near < team.all) add({ ref: st, x: st.x, y: st.y + 6, key: '', text: '等队友到楼梯口（' + team.near + '/' + team.all + '）' });
      else add({ ref: st, x: st.x, y: st.y + 6, key: 'F', text: st.label, go: inp => { if (inp.interact && !(S.stairCd > S.t)) { if (K.startStairs && !team) K.startStairs(S, st); else goFloor(S, st.to, { from: S.f, dir: st.dir }); } } }); // lift.js：一级一级走上去 / 下去
    }
    // 门禁房的门：刷够等级的卡打开（等级高的卡能开低级的门）
    for (const br of A.breakables) if (!br.open && br.lock && Math.hypot(br.x - p.x, br.y - p.y) < 34) {
      const nm = D.KEY_NAME[br.lock], have = D.hasKey(S.raid, br.lock);
      add({ ref: br, x: br.x, y: br.y, key: have ? 'F' : '', text: have ? '刷卡打开门禁房（' + nm + '）' : '门禁房：要一张' + nm + (br.lock < 3 ? '或更高级的卡' : ''), go: inp => {
        if (!inp.interact) return;
        if (have) { D.useKey(S.raid, br.lock); D.openBreakable(A, br, S.fx); S.flow = null; S.flowT = 0; ring(S, br.x, br.y, 20, D.KEY_COL[br.lock]); flashLight(S, br.x, br.y, 90, D.KEY_COL[br.lock], 1.2); sfx('power'); S.banner = { t: 0, text: '门禁房', sub: '刷开了。里面的东西品质更高' }; }
        else sfx('nope');
      } });
    }
    for (const br of A.breakables) if (!br.open && !br.lock && Math.hypot(br.x - p.x, br.y - p.y) < 50) { br.seen = true; if (Math.hypot(br.x - p.x, br.y - p.y) < 36) add({ ref: br, x: br.x, y: br.y, key: '', text: '墙上有裂缝，后面是空的——打破它' }); }
    const atConsole = S.console && S.console.f === S.f && !S.console.used && Math.hypot(S.console.x - p.x, S.console.y - p.y) < 22;
    const looting = S.lootOpen && S.lootOpen.items;
    const gNear = () => S.groundNear.reduce((a, g) => { const d = Math.hypot(g.x - p.x, g.y - p.y); return !a || d < a.d ? { x: g.x, y: g.y, d } : a; }, null);
    // 地上有枪 / 近战：点按 F 捡起，长按 F 直接换上
    const wcard = !looting && !atConsole && S.groundNear.find(g => D.isWeaponCard(g.id));
    if (wcard) {
      const nm = D.CARDS[wcard.id.slice(5)].name;
      add(Object.assign(gNear(), { ref: 'ground', key: 'F', text: '捡起 · 长按换上' + nm, prog: Math.max(0, S.holdF || 0) / 0.45, go: inp => {
        if (inp.interactHeld) { if (S.holdF >= 0) { S.holdF = (S.holdF || 0) + (S.dt || 0); if (S.holdF >= 0.45) { S.holdF = -1; D.equipFromGround(S, wcard); } } }
        else { if (S.holdF > 0) D.takeAllGround(S); S.holdF = 0; }
      } }));
    } else if (S.groundNear.length && !looting && !atConsole && S.groundNear.some(g => D.Grid.canAdd(S.raid.bag, g.id, 1))) {
      add(Object.assign(gNear(), { ref: 'ground', key: 'F', text: '捡起地上的 ' + S.groundNear.length + ' 样东西（也可以单击拾取框）', go: inp => { if (inp.interact) D.takeAllGround(S); } }));
    }
    if (D.Story && D.Story.cands) D.Story.cands(S, add); // 储备库第 10 节的战略黑匣子、随车遗物
    if (K.candX) K.candX(S, add); // M5：调度终端（world.js）、电梯（lift.js）
    if (S.relay && S.relay.f === S.f && Math.hypot(S.relay.x - p.x, S.relay.y - p.y) < 24) {
      if (S.relay.used) add({ ref: S.relay, x: S.relay.x, y: S.relay.y, key: '', text: '中继台已经接通了' });
      else add({ ref: S.relay, x: S.relay.x, y: S.relay.y, key: 'F', text: '修好中继台（看清周围的站）', go: inp => { if (inp.interact) { S.relay.used = true; const got = D.relayScan(S.raid.city, S.st.id); S.banner = { t: 0, text: '中继接通', sub: '线路图上揭开了 ' + got + ' 个站' }; sfx('power'); if (D.Story) D.Story.onRelay(S); ring(S, S.relay.x, S.relay.y - 6, 40, P.c); flashLight(S, S.relay.x, S.relay.y, 120, P.c, 1.4); } } });
    }
    let nCont = 0;
    for (const c of S.containers) {
      if (c.f !== S.f || (c.opened && !c.items.length)) continue;
      const d = Math.hypot(c.x - p.x, c.y - 4 - p.y); if (d >= 22) continue;
      nCont++;
      if (c.locked) {
        const key = D.hasKey(S.raid, 1), hack = S.SH.trait.k === 'hack', nm = CONT[c.kind].name;
        add({ ref: c, x: c.x, y: c.y - 4, d, near: c, key: key || hack ? 'F' : '', text: key || hack ? (hack ? '破解' + nm : '刷一张门禁卡打开' + nm) : nm + '锁着：要一张门禁卡（任何等级都行；蛛网能直接破解）', go: inp => {
          if (inp.interact && (key || hack)) {
            if (!hack) D.useKey(S.raid, 1);
            c.locked = false; startOpen(S, c); c.pendingPanel = true; c.opened = true;
            ring(S, c.x, c.y - 6, 18, P.g); flashLight(S, c.x, c.y - 8, 60, P.g, 1); text(S, c.x, c.y - 24, hack ? 'HACKED' : 'UNLOCKED', P.g); sfx('power');
          } else if (inp.interact) sfx('nope');
        } });
      } else {
        const left = c.items.filter(o => !o.seen).length;
        add({ ref: c, x: c.x, y: c.y - 4, d, near: c, key: 'F', text: (c.opened ? (left ? '继续搜' : '查看') : '搜') + CONT[c.kind].name + (c.opened ? '（' + c.items.length + ' 件）' : ''), go: inp => { if (inp.interact) { if (!c.opened) { startOpen(S, c); c.pendingPanel = true; } else { sfx('click'); S.events.push({ type: 'loot', c }); } c.opened = true; } } });
      }
    }
    if (!nCont && looting) S.events.push({ type: 'closeLoot' });
    if (S.trader && S.trader.f === S.f && Math.hypot(S.trader.x - p.x, S.trader.y - p.y) < 22) add({ ref: S.trader, x: S.trader.x, y: S.trader.y, key: 'F', text: S.trader.prompt || '和商人交易', go: inp => { if (inp.interact) S.events.push({ type: 'trade' }); } });
    if (S.healer && S.healer.f === S.f && Math.hypot(S.healer.x - p.x, S.healer.y - p.y) < 22) {
      const hq = S.st.type === 'outpost'; // 人类据点的配电柜是诊所的
      if (S.healer.used) add({ ref: S.healer, x: S.healer.x, y: S.healer.y, key: '', text: hq ? '诊所的电已经用完了' : '配电室的电已经用完了' });
      else add({ ref: S.healer, x: S.healer.x, y: S.healer.y, key: 'F', text: hq ? '接上诊所的电，回满耐久' : '接上配电室，回满耐久', go: inp => { if (inp.interact) { S.healer.used = true; S.raid.healed.add(S.st.id); p.hp = p.maxHp; sfx('heal'); text(S, p.x, p.y - 24, 'FULL', P.g, true); ring(S, p.x, p.y - 5, 20, P.g); } } });
    }
    if (D.evSiteCands) D.evSiteCands(S, add); // 未知信号站：NPC、信号（event.js）
    if (D.Outpost && D.Outpost.cands) D.Outpost.cands(S, add); // 人类据点里的人：说话、换、提升、托付（outpost.js）
    if (atConsole) {
      const cs = S.console, at = { ref: cs, x: cs.x, y: cs.y };
      if (!D.tutAllows(S, 'extract')) add(Object.assign(at, { key: '', text: '先完成左边的教学目标' }));
      else if (S.step === 0 && !S.tut) add(Object.assign(at, { key: '', text: '入口站不能撤离：去别的撤离站' }));
      else add(Object.assign(at, { key: 'F', text: '呼叫接驳车（开始撤离战）', go: inp => { if (inp.interact) startExtract(S); } }));
    }
    const cur = D.Pick.choose(S, C, inp);
    if (!cur || cur.ref !== 'ground') S.holdF = inp.interactHeld ? -1 : 0; // 没选中地上的枪：长按 F 不算数，松开以前也不会换上
  }

  D.stationText = S => ({ hp: Math.ceil(S.player.hp), mag: S.player.mag, cap: +S.player.cap.toFixed(2), enemies: S.enemies.filter(e => !e.dead).map(e => e.kind), containers: S.containers.filter(c => !D.containerDone(c) || !c.opened).length, extract: S.extract ? { t: Math.round(S.extract.t), dur: S.extract.dur, train: S.extract.train } : null, over: S.over || null });
  Object.assign(K, { resetMotes, goFloor, markRoom, interact, shellOf, makePlayer });
})(D);
