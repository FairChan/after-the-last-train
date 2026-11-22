/* 末班之后 · 小样二：撤离战：呼叫接驳车、刷波次、追兵、登车（从 combat.js 拆出来） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, Z = D.Z, VW = D.W / Z, VH = D.H / Z, TS = 16, TAU = Math.PI * 2;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const Q = () => D.QUALITY;
  const K = D.K || (D.K = {}); // 站内各文件共用的内部函数
  // 别的文件里定义的函数：调用时再去 D.K 上找
  const addShake = (...a) => K.addShake(...a);
  const spawnEnemy = (...a) => K.spawnEnemy(...a);

  // ───────────────────────── 撤离战
  // 试玩反馈：撤离时站台上怪太多，打不过。站台上同时活着的怪有上限（威胁 1–2 级 4 台、3–4 级 5 台、5 级起 6 台），
  // 满了就先不刷、打掉了再补；首领和工程机在场时不刷普通增援；撤离战最长 36 秒
  const EX_CAP = lv => lv <= 3 ? 4 : lv <= 6 ? 5 : 6; // 威胁 10 级制
  const onFloor = S => S.enemies.filter(e => !e.dead && e.f === S.f && !e.owner).length;
  const bigOn = S => S.enemies.some(e => !e.dead && e.f === S.f && (D.ENEMIES[e.kind].boss || e.kind === 'engineer'));
  D.EX_CAP = EX_CAP;
  function startExtract(S) {
    const R = S.raid, T = D.TUNE, value = D.bagValue(R);
    const dur = S.tut ? 20 : Math.min(36, Math.round((T.extractBase + value * T.extractPerValue + R.alert * T.extractPerAlert) * (D.DIFF[R.diff || 0] || D.DIFF[0]).ext));
    S.console.used = true;
    S.extract = { t: 0, dur, value, next: 3, wave: 0, train: false, board: 0, bossDone: false, trainX: 0 };
    S.banner = { t: 0, text: '撤离战', sub: `坚持 ${dur} 秒，接驳车就到` };
    addShake(S, 0.4); sfx('bosswarn'); R.noise += 2;
  }
  function extractStep(S, dt) {
    const X = S.extract, A = S.A, R = S.raid; X.t += dt;
    if (!X.train) {
      X.next -= dt;
      const left = X.dur - X.t;
      if (X.next <= 0 && left > 4) {
        const lv = D.threatLv(R), room = EX_CAP(lv) - onFloor(S);
        if (room <= 0 || bigOn(S)) X.next = 1.5; // 站台上已经够多了（或者首领 / 工程机在场）：等打掉一些再来
        else {
          X.wave++;
          const tier = Math.max(S.st.tier, lv - 2), n = Math.min(room, S.tut ? 1 : Math.max(1, Math.min(lv >= 5 ? 3 : 2, 1 + Math.floor(X.wave / 4)) - (S.coop ? 1 : 0))); // 每波最多 2 台，威胁 5 级起 3 台 // 和阿隼合作：储备库撤离战每波少一台
          const pool = S.tut ? [['crawler', 1]] : [['mite', Math.max(0, 4 - tier * 1.5)], ['scav', Math.max(0, 2 - tier * 0.7)], ['crawler', 3], ['drone', 2], ['bomber', 1], ['raider', tier >= 1 ? 2 : 0], ['sniper', tier >= 2 ? 1 : 0]];
          for (let i = 0; i < n; i++) { const side = S.rng.chance(0.5) ? 1 : 0; spawnEnemy(S, D.upgradeFoe(D.threatLv(S.raid), S.rng.weighted(pool), S.rng), side ? A.w - 4 * TS : 4 * TS, S.rng.range(13 * TS, 18 * TS), 0.6 + i * 0.15, S.f, true); }
          X.next = Math.max(8, 12 - X.wave * 0.3); sfx('summon');
        }
      }
      if (!X.bossDone && !S.tut && left < X.dur * 0.35) {
        X.bossDone = true;
        const lv = D.threatLv(R), big = X.value >= 5000 || lv >= 8; // 钳工-9 只追背着很值钱东西的
        if (big) { spawnEnemy(S, 'boss', A.w / 2 + 80, 15 * TS, 1.6, S.f, true); S.banner = { t: 0, text: '钳工-9', sub: '你背的东西太值钱，引来了大家伙' }; }
        else if (X.value >= 2500 || lv >= 4) { spawnEnemy(S, 'engineer', S.rng.chance(0.5) ? 5 * TS : A.w - 5 * TS, 15 * TS, 1.2, S.f, true); S.banner = { t: 0, text: '追兵', sub: '工程机从隧道里冲出来了' }; }
        addShake(S, 0.6); sfx('bosswarn');
      }
      if (X.t >= X.dur) { X.train = true; X.trainX = -A.w; S.banner = { t: 0, text: '车来了', sub: '走到站台下沿就上车 · 越晚上车追兵越多' }; sfx('win'); addShake(S, 0.3); }
    } else {
      X.trainX = Math.min(0, X.trainX + dt * 420);
      // 车到了还不上车：追兵一波比一波多、一波比一波快
      if (X.trainX >= 0 && !S.tut && !S.over) {
        X.late = (X.late || 0) + dt; X.lateNext = (X.lateNext == null ? 5 : X.lateNext) - dt;
        if (X.lateNext <= 0) {
          const k = Math.floor(X.late / 6), lv = D.threatLv(S.raid), tier = Math.max(S.st.tier, Math.floor((lv - 1) * 0.6) - 1), n = Math.max(0, Math.min(3, 1 + (k >> 1), EX_CAP(lv) + 1 - onFloor(S))); // 车到了不上车：上限多一台
          const pool = [['crawler', 3], ['bomber', 2], ['drone', 2], ['raider', 1 + k * 0.5], ['sniper', tier >= 1 ? 1 : 0], ['engineer', k >= 4 ? 0.6 : 0]];
          for (let i = 0; i < n; i++) spawnEnemy(S, D.upgradeFoe(D.threatLv(S.raid), S.rng.weighted(pool), S.rng), i % 2 ? A.w - 4 * TS : 4 * TS, S.rng.range(13 * TS, 18 * TS), 0.4 + i * 0.12, S.f, true);
          X.lateNext = Math.max(4, 7 - k * 0.5); sfx('summon');
          if (k >= 1 && !X.lateWarn) { X.lateWarn = true; S.banner = { t: 0, text: '追兵越来越多', sub: '快上车' }; addShake(S, 0.3); }
        }
      }
      const p = S.player, inZone = p.hp > 0 && S.f === S.console.f && p.y > A.boardY;
      if (inZone && X.trainX >= 0) { X.board += dt; S.prompt = { key: '', text: '登车中', prog: X.board / D.SCHED.board }; if (X.board >= D.SCHED.board && !S.over) { S.over = 'extracted'; S.endT = 0; let dx = p.x, bd = 1e9; for (let c = 0; c < 4; c++) { const d = X.trainX + TS + c * 100 + 48; if (d > 8 && d < A.w - 8 && Math.abs(d - p.x) < bd) { bd = Math.abs(d - p.x); dx = d; } } S.outro = { t: 0, x0: X.trainX, px: p.x, py: p.y, dx, dy: A.track.y0 * TS + 12 }; sfx('win'); sfx('power'); } } // 走到最近的车门上车
      else { X.board = 0; S.prompt = { key: '', text: '接驳车到了！走到站台下沿就上车' }; }
    }
  }

  // ── 在一个站待太久：巡逻队从隧道里进来。
  // 试玩（2026-11-15）：原来越晚越多、上不封顶，下来慢了站台上根本打不过。现在站台上的敌人只补到一个固定数
  // （D.TUNE.lingerCap，危险等级 2 起多 1 台），打掉了隔 lingerEvery 秒再补；不再一队比一队多，也不再升级成工程机
  function lingerStep(S, dt) {
    const T = D.TUNE, L = S.linger || (S.linger = { next: T.lingerT, n: 0 });
    if (S.t < L.next) return;
    L.next = S.t + (T.lingerEvery || 30);
    const A = S.floors[1] || S.A, tier = Math.max(S.st.tier, Math.floor((D.threatLv(S.raid) - 1) * 0.6) - 1), cap = (T.lingerCap || 6) + (tier >= 2 ? 1 : 0);
    const have = S.enemies.filter(e => !e.dead && e.f === 1 && !e.owner).length, n = Math.min(3, cap - have);
    if (n <= 0) return; // 站台上已经够多了：不再往上加
    L.n++;
    const pool = [['mite', Math.max(0, 3 - tier)], ['crawler', 2], ['drone', 2], ['raider', tier >= 1 ? 2 : 1], ['sniper', tier >= 2 ? 1 : 0]];
    const x = S.rng.chance(0.5) ? A.w - 3 * TS : 3 * TS;
    for (let i = 0; i < n; i++) spawnEnemy(S, D.upgradeFoe(D.threatLv(S.raid), S.rng.weighted(pool), S.rng), x, S.rng.range(13 * TS, 18 * TS), 0.4 + i * 0.3, 1, true);
    if (L.n === 1) S.banner = { t: 0, text: '巡逻队进站', sub: '在这站待太久了，站台上会一直守着一队巡逻' };
    sfx('summon');
  }
  // 列车画在哪、门开了多少：进站过场、撤离时车到站、登车后开走
  // 进站过场的几个时间点（秒）
  const IN = D.TRAIN_IN = { arrive: 1.3, open: 1.55, walk: 2.05, close: 2.3, gone: 3.3 };
  const OUT = D.TRAIN_OUT = { walk: 0.45, close: 0.7 };
  // 下车过场里、还没走下车门：人还在车上（试玩：这时候在站台上被打）。不受伤，敌人不动、不发现你
  D.offstage = S => !!(S && S.intro && S.intro.t < IN.walk);
  D.trainState = function (S) {
    if (S.outro) { const t = S.outro.t; return { x: S.outro.x0 + (t > OUT.close ? 900 * (t - OUT.close) * (t - OUT.close) : 0), door: t < OUT.walk ? 1 : Math.max(0, 1 - (t - OUT.walk) / (OUT.close - OUT.walk)), leaving: t > OUT.close }; }
    if (S.intro && S.f === 1) {
      const t = S.intro.t;
      if (t < IN.arrive) return { x: -640 + 672 * D.ease.outCubic(t / IN.arrive), door: 0, braking: t > IN.arrive * 0.45 };
      if (t < IN.open) return { x: 32, door: (t - IN.arrive) / (IN.open - IN.arrive) };
      if (t < IN.walk) return { x: 32, door: 1 };
      if (t < IN.close) return { x: 32, door: 1 - (t - IN.walk) / (IN.close - IN.walk) };
      return { x: 32 + 900 * (t - IN.close) * (t - IN.close), door: 0, leaving: true };
    }
    if (S.isExit && S.extract && S.extract.train && S.console && S.console.f === S.f) return { x: S.extract.trainX, door: S.extract.trainX >= 0 ? 1 : 0, board: true };
    return null;
  };
  Object.assign(K, { startExtract, extractStep, lingerStep });
})(D);
