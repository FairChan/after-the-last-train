/* 末班之后 · 多人联机：队友这边（design/features/multiplayer §4.5）
   本机也有一个 S（用房主发来的种子建，墙、房间、箱子位置一模一样），但它不跑规则，只是"画面用的影子"：
   - 敌人、别的队友、子弹、箱子、地上的东西、车……：收到快照写进影子 S；画的时候往回看一小段（网络稳 100 毫秒，一阵一阵的就多留，最多 0.8 秒），在两条快照之间插值
   - 自己：本机先按自己的输入走（预测），房主的快照回来以后对一下：差得小慢慢拉回，差得大（被炸飞、换层）直接跳过去
   - 粒子、飘字、光：房主只发新出的，本机自己让它们飘、淡掉
   - 背包、箱子：界面照常（ui-*.js 改的是本机这份），改动的同时把"调了哪个函数、参数是哪些格子 / 东西"发给房主照做；
     房主那边的结果（私有状态）回来以后盖掉本机这份。
   自己的这一趟（R）是自己存档出发时建的，房主发回来的背包写进它，最后由自己结算、存档。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const NET = D.Net = D.Net || {}, K = D.K || (D.K = {}), Z = () => D.Z, TS = 16;
  const PRED = new Set(['x', 'y', 'vx', 'vy', 'aim', 'walk', 'dashT']); // 自己的这几样本机说了算（预测），别的听房主的
  const cities = {};
  const cityOf = c => cities[c.seed + ':' + c.ver] || (cities[c.seed + ':' + c.ver] = D.makeCity(c.seed, c.ver));

  NET.Client = function (conn, opt) {
    opt = opt || {};
    const CL = { kEn: NET.Keyed(), kPl: NET.Keyed(), conn, S: null, R: opt.R || null, pid: -1, seq: 0, sent: [], hist: new Map(), pend: { x: 0, y: 0 }, opN: 0, tc: 0, lastT: 0, en: new Map(), ui: opt.ui !== false, rtt: 0, pingT: 0, lastSnap: 0, panel: null, evq: [], name: opt.name || 'P2' };
    CL.bind = c => { CL.conn = c; c.on(m => { if (CL.conn === c) CL.recv(m); }); }; // 断线重连时换一条新连接
    CL.bind(conn);
    CL.hello = (pfData, extra) => CL.conn.send(Object.assign({ k: 'hello', v: NET.VERSION, name: CL.name, pf: pfData }, extra || {}));
    CL.recv = function (m) {
      if (!m || !m.k) return; NET.clean(m);
      switch (m.k) {
        case 'start': CL.start(m); break;
        case 'snap': if (CL.S) CL.snap(m); break;
        case 'ev': if (CL.S) for (const e of m.l) CL.event(NET.decEv(CL.S, e)); break;
        case 'priv': if (CL.S && (m.oa | 0) >= CL.opN) CL.priv(m.r); break;
        case 'pong': CL.rtt = Math.round(performance.now() - m.t); CL.conn.send({ k: 'rtt', ms: CL.rtt }); break;
        case 'bye': CL.bye = m; if (CL.onBye) CL.onBye(m); break;
        case 'closed': CL.lost = true; CL.hostGone = !!m.host; if (CL.onLost) CL.onLost(); break;
        default: if (CL.onMsg) CL.onMsg(m);
      }
    };

    // ── 进站：建影子站，把房主、队友都放进来
    CL.start = function (m) {
      const R = CL.R, city = cityOf(m.city), st = city.stations[m.at];
      R.city = city; R.at = m.at; R.step = m.step; R.alert = m.alert;
      const S = D.enterStation(R, st, m.step, Object.assign({}, m.o, { seed: m.seed, shadow: true }));
      S.shadow = true; S.rt = null; S.intro = null; S.hideP = false;
      S.enemies = []; S.ground = []; for (const c of S.containers) { c.items = []; c.grid.items = []; }
      const me = S.player; me.pid = m.pid; me.name = CL.name;
      const PL = [];
      m.look.forEach((lk, pid) => {
        if (pid === m.pid) { PL[pid] = me; return; }
        const stub = { hp: 1, maxHp: 1, mag: 0, pas: {}, shell: lk.shell, look: lk.look, load: lk.load || {}, sup: lk.sup || 0, modsAtStart: lk.mods };
        const SH = K.shellOf(stub), p = K.makePlayer(S, stub, SH, false); p.pid = pid; p.name = lk.name;
        p.ctx = { player: p, raid: stub, SH, mods: lk.mods, cam: S.cam, events: [] }; PL[pid] = p;
      });
      S.players = PL; S.me = me;
      for (const p of PL) if (m.pub[p.pid]) { Object.assign(p, m.pub[p.pid]); p._s = []; for (const q of p.scarf) { q.x = q.px = p.x; q.y = q.py = p.y - 8; } }
      me.inv = Math.max(me.inv || 0, 1);
      CL.kEn = NET.Keyed(); CL.kPl = NET.Keyed(); CL.S = S; CL.en.clear(); CL.hist.clear(); CL.pend = { x: 0, y: 0 }; CL.tc = m.t; CL.lastT = m.t; CL.offs = []; CL.delay = NET.DELAY; CL.seq = 0; CL.sent = []; CL.pid = m.pid; CL.brOpen = S.floors.map(() => new Set());
      S.cam.x = D.clamp(me.x - D.W / D.Z / 2, 0, Math.max(0, S.A.w - D.W / D.Z)); S.cam.y = D.clamp(me.y + 10 - D.H / D.Z / 2, -4, Math.max(0, S.A.h - D.H / D.Z + 20));
      if (CL.onStart) CL.onStart(S, m);
    };

    // ── 每步：发输入、预测自己、让画面走起来
    CL.step = function (S, dt, inp) {
      if (!S || S !== CL.S) return;
      const I = D.Input, me = S.player;
      if (inp.ax == null) { inp.ax = I.mx / D.Z + S.cam.x; inp.ay = I.my / D.Z + S.cam.y; }
      I.wx = inp.ax; I.wy = inp.ay;
      const seq = ++CL.seq; CL.sent.push([seq, compact(inp)]); if (CL.sent.length > 3) CL.sent.shift();
      CL.conn.send({ k: 'in', i: CL.sent }, true);
      predict(S, me, inp, dt);
      CL.hist.set(seq, { x: me.x, y: me.y }); if (CL.hist.size > 240) CL.hist.delete(CL.hist.keys().next().value);
      CL.visual(S, dt);
      // 面板开关告诉房主（开着箱子时才揭开、走路变慢）
      if (S.lootOpen !== CL.panel) { CL.panel = S.lootOpen; CL.conn.send({ k: 'panel', n: ++CL.opN, v: NET.encPanel(S, S.lootOpen) }); }
      CL.pingT -= dt; if (CL.pingT <= 0) { CL.pingT = 1; CL.conn.send({ k: 'ping', t: performance.now() }); }
      for (const e of CL.evq.splice(0)) S.events.push(e);
    };
    const compact = inp => { const o = {}; for (const k in inp) { const v = inp[k]; if (v || v === 0 && (k === 'mx' || k === 'my')) o[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : v; } return o; };
    // 自己怎么走（和 station.js 同一套：走、闪避、开箱子时变慢）
    function predict(S, p, inp, dt) {
      if (p.out || p.hp <= 0 && !p.down) { p.vx *= 0.9; p.vy *= 0.9; return; }
      p.aim = Math.atan2(D.Input.wy - (p.y - 6), D.Input.wx - p.x);
      if (p.dashT > 0) { p.dashT -= dt; p.vx = p.dx; p.vy = p.dy; if (p.dashT <= 0) { p.vx *= 0.2; p.vy *= 0.2; } }
      else if (inp.dash && !(p.dashCd > 0) && !p.down) {
        let mx = inp.mx, my = inp.my; if (!mx && !my) { mx = Math.cos(p.aim); my = Math.sin(p.aim); }
        const l = Math.hypot(mx, my); p.dx = mx / l * D.SHELL.dashSpeed; p.dy = my / l * D.SHELL.dashSpeed; p.dashT = D.SHELL.dashTime; p.dashCd = p.dashCdMax || 1; p.vx = p.dx; p.vy = p.dy;
        if (D.Sfx) D.Sfx.play('dash');
      } else if (!(p.pullT > 0)) {
        const l = Math.hypot(inp.mx, inp.my) || 1, sp = (p.speed || 90) * (p.useT > 0 && !(p.healOT > 0) ? 0.5 : 1) * (p.buffT > 0 ? 1.25 : 1) * (S.lootOpen && S.lootOpen.items ? 0.55 : 1) * (p.charging && p.chargeT > 0.15 ? 0.7 : 1) * (1 - 0.45 * (p.ads || 0)) * (p.spdMul || 1) * (p.down ? 0.25 : 1);
        const k = 1 - Math.exp(-dt * 18); p.vx += (inp.mx / l * sp - p.vx) * k; p.vy += (inp.my / l * sp - p.vy) * k;
      }
      D.move(S.A, p, p.vx * dt, p.vy * dt);
      if (Math.hypot(p.vx, p.vy) > 20) p.walk += dt * 11;
      p.dashCd = (p.dashCd || 0) - dt;
      // 房主的修正：每帧拉回两成
      const pe = CL.pend; if (pe.x || pe.y) { const ax = pe.x * 0.2, ay = pe.y * 0.2; p.x += ax; p.y += ay; pe.x -= ax; pe.y -= ay; for (const h of CL.hist.values()) { h.x += ax; h.y += ay; } if (Math.abs(pe.x) < 0.05 && Math.abs(pe.y) < 0.05) pe.x = pe.y = 0; }
    }

    // ── 画面：插值、特效自己走、镜头
    CL.visual = function (S, dt) {
      const realDt = dt;
      // 往回看多久（CL.delay）按最近 5 秒快照到达的忽快忽慢、丢快照留下的空档来定：网络稳就 0.1 秒，一阵一阵的（远处中继）就多留一点（最多 0.8 秒），免得没东西可画、停住再猛跳。
      // 画面时间朝"房主现在 - 缓冲"走：房主现在 ≈ 本机时钟 + 最近到得最快那条的时差（快照卡住时也照常往前走，到了再接上，不用猛追）；
      // 房主有慢动作、卡帧，本机时钟会和房主时间慢慢错开，所以不落后于"最新一条快照 - 缓冲 - 0.15 秒"。差太多才直接跳过去。
      CL.lc = (CL.lc || 0) + dt;
      const offs = CL.offs || [], st = CL.st || (CL.st = { f: 0, dry: 0, jump: 0 }); st.f++;
      let goal = CL.lastT - (CL.delay || NET.DELAY);
      if (offs.length > 1) {
        let hi = -Infinity, lo = Infinity, gap = 0; for (let i = 0; i < offs.length; i++) { const o = offs[i]; if (o.off > hi) hi = o.off; if (o.off < lo) lo = o.off; if (i) gap = Math.max(gap, o.lc - offs[i - 1].lc); }
        const want = D.clamp(Math.max(hi - lo + 0.06, gap + 0.03), NET.DELAY, NET.DELAY_MAX);
        CL.delay = want > (CL.delay || 0) ? want : Math.max(want, CL.delay - dt * 0.05); // 变卡马上加，变顺慢慢减
        goal = Math.max(CL.lc + hi - CL.delay, CL.lastT - CL.delay - 0.15);
      }
      if (Math.abs(CL.tc - goal) > 1) { CL.tc = goal; st.jump++; } else CL.tc += (goal - CL.tc) * 0.05;
      if (CL.tc > CL.lastT) st.dry++; // 画到了最新一条快照后面：没东西可插，画面停住
      S.t = Math.max(S.t, CL.tc); S.dt = dt;
      const at = CL.tc;
      const lerpS = o => { const s = o._s; if (!s || !s.length) return; let a = s[0], b = s[s.length - 1]; for (let i = 0; i < s.length - 1; i++) if (s[i].t <= at && s[i + 1].t >= at) { a = s[i]; b = s[i + 1]; break; } const u = b.t > a.t ? D.clamp((at - a.t) / (b.t - a.t), 0, 1.15) : 1; o.x = a.x + (b.x - a.x) * u; o.y = a.y + (b.y - a.y) * u; if (a.z != null) o.z = a.z + ((b.z || 0) - a.z) * u; };
      for (const e of S.enemies) lerpS(e);
      for (const p of S.players) if (p !== S.player) { lerpS(p); if (K.scarf) K.scarf(S, p); }
      if (K.scarf) K.scarf(S, S.player);
      for (const s of S.shots.concat(S.eshots)) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (D.solidAt(S.A, s.x, s.y + 6)) s.life = 0; }
      S.shots = S.shots.filter(s => s.life > 0); S.eshots = S.eshots.filter(s => s.life > 0);
      for (const q of S.parts) { q.life -= dt; if (q.k === 'debris') { q.vz -= 260 * dt; q.z += q.vz * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.4; q.vx *= 0.6; q.vy *= 0.6; } } else if (q.k === 'smoke') { q.vx *= 0.94; q.vy *= 0.94; q.size += dt * 6; } else if (q.k === 'spark') { q.vx *= 0.9; q.vy = q.vy * 0.9 + 140 * dt; } q.x += q.vx * dt; q.y += q.vy * dt; }
      S.parts = S.parts.filter(q => q.life > 0);
      for (const t of S.texts) { t.t += realDt; t.y -= realDt * 14 * Math.max(0, 1 - t.t * 1.5); } S.texts = S.texts.filter(t => t.t < 0.9);
      const age = (arr, k) => { for (const o of arr) o[k || 't'] -= dt; return arr.filter(o => o[k || 't'] > 0); };
      S.floaters = (S.floaters || []).filter(o => (o.t += dt) < 1);
      S.ghosts = age(S.ghosts); S.bolts = age(S.bolts); S.beams = age(S.beams); S.tracers = age(S.tracers); S.pillars = age(S.pillars);
      for (const l of S.tlights) l.a -= dt * l.decay; S.tlights = S.tlights.filter(l => l.a > 0);
      for (const m of S.motes) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.y < 0) { m.y = S.A.h; m.x = S.rng() * S.A.w; } }
      if (S.banner) { S.banner.t += realDt; if (S.banner.t > 2.4) S.banner = null; }
      S.shake = Math.max(0, (S.shake || 0) - realDt * 1.8);
      if (S.hitMark && (S.hitMark.t -= realDt) <= 0) S.hitMark = null;
      const p = S.player, ST = D.settings || {};
      S.groundNear = p.hp > 0 && !p.out ? S.ground.filter(g => g.f === S.f && !g.dropped && g.t > 0.35 && Math.hypot(g.x - p.x, g.y - p.y) < D.TUNE.groundR) : [];
      // 镜头（同 station.js）
      const VW = D.W / D.Z, VH = D.H / D.Z, I = CL.noMouse ? { mx: D.W / 2, my: D.H / 2 } : D.Input; // 本机分屏的第二个人：镜头不跟鼠标
      S.camShift = D.lerp(S.camShift || 0, S.lootOpen && (S.lootOpen.items || S.lootOpen.trade) ? VW * 0.27 : 0, 1 - Math.exp(-realDt * 7));
      const tx = D.clamp(p.x - VW / 2 + S.camShift + (I.mx / D.Z - VW / 2) * (0.15 + 0.45 * (p.ads || 0)) * (S.lootOpen ? 0 : 1), 0, Math.max(0, S.A.w - VW) + S.camShift), ty = D.clamp(p.y + 10 - VH / 2 + (I.my / D.Z - VH / 2) * (0.12 + 0.45 * (p.ads || 0)), -4, Math.max(0, S.A.h - VH + 20));
      const ck = 1 - Math.exp(-realDt * 8); S.cam.x += (tx - S.cam.x) * ck; S.cam.y += (ty - S.cam.y) * ck;
    };

    // 位置样本留够缓冲那么长（最多 0.8 秒 + 余量），不按条数砍：缓冲加长时画面时间还落在样本里
    const trim = (arr, t) => { const cut = t - NET.DELAY_MAX - 0.3; while (arr.length > 2 && arr[1].t < cut) arr.shift(); };
    // ── 快照写进影子
    CL.snap = function (m) {
      const S = CL.S, W = m.w; CL.lastSnap = m.n; if (W.t > CL.lastT) CL.lastT = W.t;
      { const lc = CL.lc || 0, offs = CL.offs || (CL.offs = []); offs.push({ lc, off: W.t - lc }); while (offs.length && lc - offs[0].lc > 5) offs.shift(); } // 到达时差（自适应缓冲用）
      if (W.f !== S.f && S.floors[W.f]) { S.f = W.f; S.A = S.floors[W.f]; S.floor = S.fxs[W.f].c; S.fx = S.fxs[W.f].x; if (K.resetMotes) K.resetMotes(S); CL.hist.clear(); CL.pend = { x: 0, y: 0 }; CL.snapMe = true; for (const e of CL.en.values()) e._s = []; }
      // 敌人：按编号对上同一个对象（画图的缓存留着），位置记成样本
      const keep = new Map();
      const ENL = CL.kEn.dec(W.en, 'nid'), PLL = CL.kPl.dec(W.pl, 'pid');
      if (!ENL || !PLL) { if (W.key) {} return; } // 还没收到这一段的关键帧：等下一个
      for (const pe of ENL) {
        let e = CL.en.get(pe.nid); if (!e) { e = { _s: [] }; }
        const x = pe.x, y = pe.y, z = pe.z; delete pe.x; delete pe.y; delete pe.z;
        Object.assign(e, pe); e._s.push({ t: W.t, x, y, z }); trim(e._s, W.t); if (e.x == null) { e.x = x; e.y = y; e.z = z; }
        keep.set(pe.nid, e);
      }
      CL.en = keep; S.enemies = [...keep.values()];
      // 箱子、地上：自己有没发完的操作时先不盖（免得闪），叫房主下一次全发
      if ((m.oa | 0) >= CL.opN) {
        for (const [i, pc] of W.ct) { let c = S.containers[i]; if (!c && pc && pc.grid) c = S.containers[i] = { grid: D.Grid.make(pc.grid.w, pc.grid.h), items: [] }; if (!c) continue; const g = pc.grid; delete pc.grid; Object.assign(c, pc); if (g) NET.gridInto(c.grid, g); c.items = c.grid.items; if (c._render && S.lootOpen === c) { try { c._render(); } catch (e) {} } } // 后来才有的箱子（倒下的队友留下的遗骸）
        if (W.gr) S.ground = W.gr;
      } else if (W.ct.length) CL.conn.send({ k: 'full' });
      W.br.forEach((list, fi) => { for (const bi of list) if (!CL.brOpen[fi].has(bi)) { CL.brOpen[fi].add(bi); const F = S.floors[fi], br = F.breakables[bi]; if (br && !br.open) D.openBreakable(F, br, S.fxs[fi].x); } });
      for (const k of NET.FX) if (W[k]) for (const o of W[k]) S[k].push(o);
      for (const k of ['shots', 'eshots']) { const L = W[k]; if (!L) continue; const alive = new Set(L.a); S[k] = S[k].filter(o => alive.has(o.nid)); for (const o of L.n) if (alive.has(o.nid)) { o.hit = new Set(); S[k].push(o); } }
      for (const k of ['nades', 'mines', 'shells', 'drops']) if (W[k]) S[k] = W[k];
      for (const k of Object.keys(W.x)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; const v = W.x[k], cur = S[k]; if (v && cur && typeof v === 'object' && typeof cur === 'object' && !Array.isArray(v) && !Array.isArray(cur)) Object.assign(cur, v); else S[k] = v; }
      // 人
      PLL.forEach(pp => {
        const pid = pp.pid, p = S.players[pid]; if (!p) return;
        if (p === S.player) {
          for (const k in pp) if (!PRED.has(k)) p[k] = pp[k];
          const h = CL.hist.get(m.ack);
          const ex = h ? pp.x - h.x : pp.x - p.x, ey = h ? pp.y - h.y : pp.y - p.y;
          // 差得大（被炸飞、拖走、换层）直接跳过去；对不上步号（刚跳过、房主还没收到新输入）就先不管，等对得上的那一条
          if (CL.snapMe || pp.pullT > 0 || Math.hypot(ex, ey) > (h ? 40 : 80)) { p.x = pp.x; p.y = pp.y; p.vx = pp.vx; p.vy = pp.vy; CL.hist.clear(); CL.pend = { x: 0, y: 0 }; CL.snapMe = false; }
          else if (h) CL.pend = { x: ex, y: ey };
          for (const k of [...CL.hist.keys()]) if (k < m.ack) CL.hist.delete(k); // 留着 ack 那一步：房主下一条快照可能还没往前走
        } else {
          const x = pp.x, y = pp.y; delete pp.x; delete pp.y; Object.assign(p, pp); p._s = p._s || []; p._s.push({ t: W.t, x, y }); trim(p._s, W.t);
        }
      });
      (W.dc || []).forEach((d, pid) => { const p = S.players[pid]; if (!p) return; if (p === S.player) S.decoy = d; else p.ctx.decoy = d; });
      const me = m.me || {}; S.prompt = me.prompt; S.fpick = me.fpick; if (me.hitMark && !S.hitMark) S.hitMark = me.hitMark; S.kills = me.kills; S.scanT = me.scanT; S.holdF = me.holdF; S.hurtDirs = me.hurtDirs || []; if (me.recoil > (S.recoil || 0)) S.recoil = me.recoil;
    };
    // ── 自己的背包（房主那边算出来的）写回本机这一趟
    CL.priv = function (r) {
      const R = CL.R;
      for (const k in r) {
        const v = r[k];
        if (k === '$money') { if (R.pf) R.pf.money = v; continue; }
        if (k === '$pouch') { if (D.pouchR) NET.gridInto(D.pouchR(R), v); continue; }
        if (NET.isGrid(v) && NET.isGrid(R[k])) NET.gridInto(R[k], v); else R[k] = v;
      }
      if (CL.ui && CL.S && CL.S.lootOpen && D.UI && D.UI.refresh) { try { D.UI.refresh(); } catch (e) {} }
    };
    CL.event = function (ev) { CL.evq.push(ev); if (CL.onEvent) CL.onEvent(ev); };
    // 界面改背包 / 箱子时：把这一下发给房主（net/host.js 的 NET.OPS）
    // 发得出去返回编好的参数，发不出去（认不出的对象、按值的东西）返回 null
    CL.op = function (name, args) {
      const S = CL.S, R = CL.R, loose = args.includes(S), enc = args.map(a => NET.enc(S, R, a, loose));
      if (enc.some(a => a === undefined) || !enc.some(NET.known) || enc.some(NET.itemByValue)) return null;
      CL.conn.send({ k: 'op', n: ++CL.opN, f: name, a: enc });
      return enc;
    };
    CL.close = () => CL.conn.close();
    return CL;
  };

  // ── 包一层：本机是队友、改的是影子站里的东西时，同时发给房主（只包最外面那一层调用）
  let depth = 0;
  function wrapOp(name) {
    const fn = NET.fnOf(name); if (!fn || fn.f.__mp) return;
    const f0 = fn.f, w = function () {
      const CL = NET.cl; if (!CL || !CL.S || depth > 0) return f0.apply(this, arguments);
      const args = [...arguments]; if (!args.some(a => a === CL.S || a === CL.R || (a && typeof a === 'object' && NET.enc(CL.S, CL.R, a) && NET.known(NET.enc(CL.S, CL.R, a))))) return f0.apply(this, arguments);
      const enc = CL.op(name, args);
      if (!enc) { CL.conn.send({ k: 'full' }); return 0; } // 房主那边做不了的，本机也不做（以前本机先加进背包，房主不知道，东西就多出来了）
      // 界面拿着的是上一份快照里的地上东西时，本机也改现在这件（和房主改的是同一件）
      const a2 = args.map((a, i) => enc[i] && enc[i][0] === 'gr' ? NET.dec(CL.S, CL.R, enc[i]) || a : a);
      depth++; try { return f0.apply(this, a2); } finally { depth--; }
    };
    w.__mp = true; fn.o[name.split('.').pop()] = w;
  }
  NET.wrapOps = () => { for (const n of NET.OPS) wrapOp(n); };
})(D);
