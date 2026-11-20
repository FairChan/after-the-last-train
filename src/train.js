/* 末班之后 · 小样二：站台班车（试玩反馈第三轮：每一站都只能在站台上坐车离开，不能一进站就从隧道溜走）
   进站时坐来的那班车开走；下一班车按时刻表来（站越大来得越晚），停靠一会儿，走到站台下沿站一下就上车，去下一站。
   撤离站多一个选择：控制台呼叫接驳车回据点（撤离战，见 extract.js）。叫了接驳车，普通班车就不再进站。
   人类据点、未知信号站不排时刻表：一进站就有一列车停在站台上一直等着（hold），想走了走到站台下沿就上车。
   隧道口被塌方封死，只是巡逻队进站的地方。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  const K = D.K || (D.K = {});
  // first：进站后第一班车多久到；perFloor：每多一层晚多少；every：错过了下一班多久到；dwell：停靠多久；board：站多久算上车
  const T = D.SCHED = { first: 70, perFloor: 12, safe: 20, revisit: 30, every: 45, dwell: 16, arrive: 1.3, depart: 1.2, board: 0.8, ride: 1.6 };

  D.schedInit = function (S, o) {
    // 训练场不来班车：建站时 S.tut 还没设上（enterTutorial 建完站才设），所以也看建站参数 o.tut。以前训练场里照样来车，上车就进了线路图
    if (S.tut || (o && o.tut) || !S.floors[1] || !S.floors[1].track) return;
    if (S.st && S.st.type === 'event') { D.schedHold(S); return; } // 未知信号站：车一直停在站台上等你（用户：出站直接坐车，不用叫）
    // 线路尽头的撤离站：路线不能回头，相邻的站都走过了就没有下一站，普通班车不来，只能在控制台叫接驳车撤离
    if (D.schedEnd(S)) { S.sched = { st: 'end', t: 0, n: 0, board: 0 }; return; }
    const first = S.safe ? T.safe : o && o.revisit ? T.revisit : T.first + T.perFloor * Math.max(0, S.floors.length - 2);
    S.sched = { st: 'wait', t: 0, wait: first, n: 0, board: 0 };
  };
  // 一直等着的车：已经停好、车门开着，不开走（人类据点 outpost-town.js、未知信号站）
  D.schedHold = S => (S.sched = { st: 'dwell', t: 0.5, n: 1, board: 0, hold: true });
  D.schedEnd = S => !!(S.isExit && S.raid && D.reachNew && D.reachNew(S.raid).length === 0);
  D.schedLeft = S => { const X = S.sched; return !X ? null : X.st === 'wait' ? Math.max(0, X.wait - X.t) : X.st === 'dwell' ? Math.max(0, T.dwell - X.t) : 0; };

  K.schedStep = function (S, dt) {
    const X = S.sched; if (!X || S.over) return;
    if (S.extract && X.st !== 'depart') { if (X.st === 'arrive' || X.st === 'dwell') { X.st = 'depart'; X.t = 0; } else { X.st = 'off'; return; } } // 叫了接驳车：普通班车不再进站
    if (X.st === 'off' || X.st === 'end') return;
    X.t += dt;
    if (X.st === 'wait' && X.t >= X.wait) { X.st = 'arrive'; X.t = 0; X.n++; S.banner = { t: 0, text: '列车进站', sub: `停靠 ${T.dwell} 秒：回站台，走到站台下沿就上车，去下一站`, keep: true }; if (S.f === 1) sfx('slam'); }
    else if (X.st === 'arrive' && X.t >= T.arrive) { X.st = 'dwell'; X.t = 0; if (S.f === 1) sfx('open_metal'); }
    else if (X.st === 'dwell') {
      if (X.hold) X.t = Math.min(X.t, 0.5); // 一直等着的车：门开着，不走
      const p = S.player, A = S.floors[1], inZone = p.hp > 0 && S.f === 1 && p.y > A.boardY && X.t > 0.25 && !D.offstage(S); // 下车过场里人从车门走下来也会经过站台下沿，不算上车
      if (inZone) { X.board += dt; S.prompt = { key: '', text: '上车中', prog: X.board / T.board }; if (X.board >= T.board) board(S); }
      else { X.board = 0; if (S.f === 1 && !S.prompt) S.prompt = { key: '', text: X.hold ? '列车在等你：走到站台下沿上车，去下一站' : `列车停靠中（还剩 ${Math.ceil(T.dwell - X.t)} 秒）：走到站台下沿上车，去下一站` }; }
      if (S.sched === X && !S.over && !X.hold && X.t >= T.dwell) { X.st = 'depart'; X.t = 0; X.board = 0; if (S.f === 1) sfx('throw'); }
    }
    else if (X.st === 'depart' && X.t >= T.depart) { X.st = S.extract ? 'off' : 'wait'; X.t = 0; X.wait = T.every; if (!S.extract) S.banner = { t: 0, text: '车开走了', sub: `下一班 ${T.every} 秒后进站` }; }
  };
  // 走到最近的车门上车 → 车门关上开走 → 隧道里跑一小段 → 线路图选下一站
  function board(S) {
    if (S.tut) return; // 保险：训练场里不能坐车离开
    const p = S.player, A = S.A, x0 = 32; let dx = p.x, bd = 1e9;
    for (let c = 0; c < 4; c++) { const d = x0 + TS + c * 100 + 48; if (d > 8 && d < A.w - 8 && Math.abs(d - p.x) < bd) { bd = Math.abs(d - p.x); dx = d; } }
    S.over = 'leave'; S.endT = 0; S.outro = { t: 0, x0, px: p.x, py: p.y, dx, dy: A.track.y0 * TS + 12, next: true, dur: T.ride };
    S.sched.st = 'gone'; sfx('power');
  }

  // 列车画在哪：进站 → 停靠（开门）→ 开走。进站过场、撤离战的接驳车、上车以后的过场还是 extract.js 那套
  const ts0 = D.trainState;
  D.trainState = function (S) {
    const X = S.sched;
    if (S.intro && S.f === 1 && X && X.hold && S.intro.t >= D.TRAIN_IN.walk) return { x: 32, door: 1, board: true }; // 一直等着的车：下车以后不关门、不开走
    const r = ts0(S); if (r) return r; if (!X || S.f !== 1 || (S.extract && S.extract.train)) return null;
    if (X.st === 'arrive') { const k = Math.min(1, X.t / T.arrive); return { x: -640 + 672 * D.ease.outCubic(k), door: 0, braking: k > 0.45 }; }
    if (X.st === 'dwell') return { x: 32, door: Math.min(1, X.t / 0.25) * Math.min(1, Math.max(0, (T.dwell - X.t) / 0.3)), board: true };
    if (X.st === 'depart') return { x: 32 + 900 * X.t * X.t, door: 0, leaving: true };
    return null;
  };

  // 隧道口：塌方封死了，走不过去
  K.tunnelPrompt = S => (S.tut ? '训练场的隧道是封着的' : '隧道塌方封死了，走不过去：等站台上的列车');
})(D);
