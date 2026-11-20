/* 末班之后 · 屋里的剧情（design/features/mini-rooms 第三节）：普通站里挑一间屋放一场小剧情，走进那间屋就在屋里演。
   台词在 story/小剧情屋/*.md 里写了 @in 房间种类 的场次（build-evtalk.mjs 编进 D.EvTalk.EVENTS，带 in / st / idle）。
   - 进站（包 D.enterStation）：大约三站一场（RT.CHANCE）。从这站能用的场次里（@in 有这站的房间、@st、@tier、@when、一辈子没演过）按权重挑一场，
     再挑一间对得上的屋，把人摆在屋里空着的地方（不压容器、摆设、楼梯，离墙一格）。用自己的随机数，不动刷怪和掉落。
   - 走进那间屋就开演，有敌人也演（用户定的）：整站停住（包 D.stepStation，演的时候不走原来那一帧：敌人、子弹、班车计时、警戒都不动），
     界面收起（S.noHud + #ui.talking），镜头推近到 1.6–2 倍对着说话的人（包 D.drawStation，画完以后裁一块放大），再画头顶气泡（dlg-view.js）。
   - 开演就记 evd_ 标记（演到一半读档也不重演）；Esc 跳过也算演过。动作照问号站那套（evtalk.js 挂在 D.Dlg.ACT 上，E.cur 这时设好）。
     耐久：开演前把工壳现在的耐久交给 raid，演完再拿回来；给的东西进背包，满了不落地（evtalk.js 的 loot 本来就这样）。
   - 演完人留在屋里，走近按 F 说 @idle 那一句；出站就没了。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TS = 16, K = D.K || (D.K = {});
  const RT = D.RoomTalk = { CHANCE: 1 / 3, ZOOM: 1.8, force: false }; // force：没有存档位（测试、自动玩家）也真演；不然直接按第一个能选的走完
  const E = () => D.EvTalk, S0 = pf => D.Story.S(pf);
  const tr = t => (D.tr ? D.tr(t) : t);
  const NO_TYPES = ['event', 'outpost', 'reserve'];

  // ── 这站能用的场次（问号站那套条件，外加 @in 有对得上的屋）
  RT.eligible = function (S) {
    const Ev = E(); if (!Ev) return [];
    const R = S.raid, pf = R.pf, s = S0(pf), st = S.st, out = [];
    const kinds = new Set(); S.floors.forEach(F => F.rooms.forEach(r => kinds.add(r.kind)));
    Ev.cur = { R, st, rng: D.rng('rtpick'), fx: [] };
    try {
      for (const id in Ev.EVENTS) {
        const ev = Ev.EVENTS[id];
        if (!ev.in || s.flags['evd_' + id]) continue;
        if ((ev.tier || 0) > (st.tier || 0)) continue;
        if (ev.st && !ev.st.includes(st.type)) continue;
        if (!ev.in.some(k => kinds.has(k))) continue;
        if (ev.need && !ev.need.every(c => D.Dlg.cond(pf, c))) continue;
        out.push(id);
      }
    } finally { Ev.cur = null; }
    return out;
  };

  // 屋里空着、能站人的地方（世界坐标，脚底）
  function spots(S, fi, r) {
    const F = S.floors[fi], out = [], cont = S.containers.filter(c => c.f === fi);
    for (let ty = r.y + 1; ty < r.y + r.h - 1; ty++) for (let tx = r.x + 1; tx < r.x + r.w - 1; tx++) {
      const x = tx * TS + TS / 2, y = ty * TS + TS - 2;
      if (F.room[ty * F.tw + tx] !== r.i) continue;
      let ok = true;
      for (const [ox, oy] of [[-6, -10], [6, -10], [-6, 0], [6, 0], [0, -6]]) if (D.solidAt(F, x + ox, y + oy)) { ok = false; break; }
      if (!ok) continue;
      if (cont.some(c => Math.hypot(c.x - x, c.y - y) < 18)) continue;
      if ((F.stairs || []).some(q => Math.hypot(q.x - x, q.y - y) < 30)) continue;
      if ((F.props || []).some(p => Math.abs(p.x - x) < p.w / 2 + 6 && y > p.y - p.h - 4 && y < p.y + 8)) continue;
      out.push({ x, y, tx, ty });
    }
    return out;
  }

  // ── 进站时挑：返回 { f, room, id } 或 null
  RT.pick = function (S, force) {
    const R = S.raid, st = S.st;
    if (!force && (!R || R.tut || NO_TYPES.includes(st.type) || st.reserve || st.home || S.town || S.safe)) return null;
    const rng = D.rng(R.city.seed + ':roomtalk:' + R.pf.raids + ':' + st.id + ':' + S.step);
    if (!force && rng() >= RT.CHANCE) return null;
    const ids = RT.eligible(S); if (!ids.length) return null;
    const Ev = E();
    for (let tries = 0; tries < 6 && ids.length; tries++) {
      const id = rng.weighted(ids.map(k => [k, Ev.EVENTS[k].w || 1])), ev = Ev.EVENTS[id];
      const rooms = []; S.floors.forEach((F, fi) => F.rooms.forEach(r => { if (ev.in.includes(r.kind)) rooms.push({ fi, r }); }));
      const bodies = (ev.cast || []).filter(c => !c.voice && Ev.CAST[c.who] && Ev.CAST[c.who].kind !== 'ghost').length;
      const fit = rooms.map(o => Object.assign(o, { sp: spots(S, o.fi, o.r) })).filter(o => o.sp.length >= Math.max(1, bodies));
      if (fit.length) { const o = rng.pick(fit); return { f: o.fi, room: o.r.i, id, sp: o.sp, rng }; }
      ids.splice(ids.indexOf(id), 1);
    }
    return null;
  };

  // 把人摆进去：离屋子中间近一点，互相隔开
  RT.place = function (S, P) {
    const Ev = E(), ev = Ev.EVENTS[P.id], F = S.floors[P.f], r = F.rooms[P.room];
    const cx = (r.x + r.w / 2) * TS, cy = (r.y + r.h / 2) * TS, used = [], actors = [];
    const free = P.sp.slice().sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    for (const c of ev.cast || []) {
      const who = Ev.CAST[c.who] || null, dc = D.Dlg.CAST[c.who];
      const a = { who: c.who, id: (who && who.id) || (dc && dc.id) || c.who, kind: 'ghost' };
      if (who && !c.voice) {
        if (c.shell) Object.assign(a, { kind: 'shell', mon: c.shell });
        else if (who.kind === 'mon' || who.kind === 'shell' || who.kind === 'wreck') Object.assign(a, { kind: who.kind, mon: who.mon, size: who.size || 1 });
        else if (who.kind !== 'ghost') Object.assign(a, { kind: 'human', look: who.look, pose: who.pose });
      }
      if (a.kind !== 'ghost') {
        const s = free.find(q => used.every(u => Math.hypot(u.x - q.x, u.y - q.y) >= 22)) || free[0];
        if (s) { used.push(s); a.x = s.x; a.y = s.y; } else { a.x = cx; a.y = cy; }
      } else { a.x = cx; a.y = cy - 10; } // 只有声音的：话从屋子中间冒出来
      actors.push(a);
    }
    const p0 = used[0] || { x: cx, y: cy };
    for (const a of actors) if (a.kind !== 'ghost') a.face = S.player.x < a.x ? -1 : 1;
    S.rt = { id: P.id, ev, f: P.f, room: P.room, actors, state: 'wait', t: 0, zoom: 1, foc: { x: p0.x, y: p0.y } };
    return S.rt;
  };

  // ── 开演 / 演完
  // opt.dry：开发面板的预览（只看：不记演过、不改耐久、动作不生效，演完把这间屋原来的剧情放回去）
  RT.start = function (S, opt) {
    const T = S.rt, Ev = E(), R = S.raid, pf = R.pf, dry = !!(opt && opt.dry);
    T.dry = dry;
    if (!dry) { S0(pf).flags['evd_' + T.id] = 1; R.hp = S.player.hp; }
    T.cur = Ev.cur = { R, st: S.st, ev: T.ev, rng: D.rng(R.city.seed + ':rt:' + T.id + ':' + pf.raids), fx: [] };
    T.state = 'play'; T.t = 0;
    const g = D.Game;
    if (!dry && g && g.slot == null && !RT.force) { Ev.runHeadless(T.id, pf); T.zoom = 1; RT.finish(S); return; }
    const run = D.Dlg.run(T.id, pf, { timers: !(D.settings && D.settings.timedChoices === false), dry });
    S.talk = { R: run, rt: true, near: { x: S.player.x, y: S.player.y, f: S.f } };
    S.noHud = true; S.prompt = null; S.banner = null; // 进屋那一下的房间名横幅会压在气泡上

    if (D.Sfx) D.Sfx.play('tink');
  };
  RT.finish = function (S) {
    const T = S.rt, Ev = E(); if (!T || T.state !== 'play') return;
    T.state = 'done';
    const R = S.raid; if (!T.dry) S.player.hp = Math.max(1, Math.min(S.player.maxHp, R.hp));
    if (Ev.cur === T.cur) Ev.cur = null;
    if (S.talk && S.talk.rt) S.talk = null;
    S.noHud = false;
    if (T.dry) { S.rt = T.prev || null; if (S.rt) S.rt.zoom = T.zoom; return; }
    const fx = (T.cur && T.cur.fx) || [];
    if (fx.length) S.banner = { t: 0, text: tr(T.ev.title), sub: fx.join(' · ') };
  };

  // 开发面板预览：把这一场摆进你现在站的这间屋（不管 @in 对不对得上），马上演，只看
  RT.preview = function (S, id) {
    const Ev = E(), ev = Ev.EVENTS[id]; if (!ev || !S || !S.A || !S.A.rooms) return false;
    const ri = roomAt(S), r = ri >= 0 ? S.A.rooms[ri] : null; if (!r) return false;
    const prev = S.rt && S.rt.state !== 'play' ? S.rt : null;
    const sp = spots(S, S.f, r).filter(q => Math.hypot(q.x - S.player.x, q.y - S.player.y) >= 28); if (!sp.length) sp.push({ x: S.player.x + 30, y: S.player.y });
    const T = RT.place(S, { f: S.f, room: ri, id, sp }); T.prev = prev;
    RT.start(S, { dry: true });
    return true;
  };

  // 玩家现在站在哪间屋
  const roomAt = S => { const A = S.A, tx = Math.floor(S.player.x / TS), ty = Math.floor(S.player.y / TS); return A.room ? A.room[ty * A.tw + tx] : -1; };

  // ── 挂钩
  const es0 = D.enterStation;
  D.enterStation = function (raid, st, step, o) {
    const S = es0.apply(this, arguments);
    if (!(o && (o.tut || o.revisit))) { try { const P = RT.pick(S); if (P) RT.place(S, P); } catch (e) { if (D.debug) console.error(e); } }
    return S;
  };
  const ss0 = D.stepStation;
  D.stepStation = function (S, dt, inp) {
    const T = S && S.rt;
    if (T && T.state === 'wait' && S.f === T.f && !S.lift && !S.stairWalk && roomAt(S) === T.room && !S.talk && !S.intro) RT.start(S);
    if (T && T.state === 'play') {
      if (!S.talk || !S.talk.R) { RT.finish(S); return; } // Esc：main.js 关了对话 = 跳过
      T.t += dt; T.zoom += (RT.zoomGoal(S) - T.zoom) * Math.min(1, dt * 3);
      // 站里的镜头本身挪过去对着屋里的人（放大只能放大画出来的那一块）
      { const f = RT.focus(S), vw = (D.W || 960) / (D.Z || 2), vh = (D.H || 540) / (D.Z || 2), k = Math.min(1, dt * 4);
        const gx = Math.max(0, Math.min(Math.max(0, S.A.w - vw), f.x - vw / 2)), gy = Math.max(-4, Math.min(Math.max(0, S.A.h - vh + 20), f.y - vh / 2));
        S.cam.x += (gx - S.cam.x) * k; S.cam.y += (gy - S.cam.y) * k; }
      if (D.TalkB) D.TalkB.step(S, dt);
      if (typeof document !== 'undefined') { const ui = document.getElementById('ui'); if (ui && !ui.classList.contains('talking')) ui.classList.add('talking'); }
      if (S.talk.R.done) RT.finish(S);
      return; // 世界停住：不走原来那一帧
    }
    if (T && T.state === 'done' && T.zoom > 1.001) T.zoom += (1 - T.zoom) * Math.min(1, dt * 4);
    return ss0.apply(this, arguments);
  };

  // 人画进站里按脚底排序的那张表（和小镇里的人一样）
  function drawActor(ctx, ex, S, a, t) {
    if (a.kind === 'human') {
      const R = S.talk && S.talk.R, talk = D.humanSpeaking(R, v => !!(v.cast && v.cast.id === a.id)), listen = !talk && D.humanSpeaking(R, () => true);
      const A = D.humanAnim(a, t, { pose: a.pose || 'stand', moving: false, talk, listen });
      const spr = D.humanSprite(a.look || {}, a.pose || 'stand', A.fr, A.an), flip = (a.face || 1) < 0, X = Math.round(a.x), y = Math.round(a.y) + A.bob;
      ctx.fillStyle = 'rgba(5,4,12,0.45)'; ctx.beginPath(); ctx.ellipse(X, Math.round(a.y) - 0.5, 5, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      D.blit(ctx, spr, X, y, flip); ex.globalAlpha = 0.14; D.blit(ex, spr, X, y, flip); ex.globalAlpha = 1;
      if (spr.emit) D.blit(ex, spr, X, y, flip, 'emit');
      a.top = spr.h / 2 + 2;
    } else if (a.kind === 'mon') {
      const sp = D.SPR && D.SPR[a.mon]; if (!sp) return;
      const k = Math.max(1, Math.round((a.size || 1) * 0.6)), flip = (a.face || -1) < 0, bob = Math.round(Math.sin(t * 2 + a.x) * 0.5) / 2;
      ctx.fillStyle = 'rgba(5,4,12,0.45)'; ctx.beginPath(); ctx.ellipse(a.x, a.y - 0.5, 3 + 3 * k, 1.2 + k * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      for (const g of [ctx, ex]) { g.save(); g.translate(a.x, a.y + bob); g.scale(k, k); if (g === ctx) D.blit(g, sp, 0, 0, flip); else { g.globalAlpha = 0.14; D.blit(g, sp, 0, 0, flip); g.globalAlpha = 1; if (sp.emit) D.blit(g, sp, 0, 0, flip, 'emit'); } g.restore(); }
      a.top = sp.h / (sp.res || 1) * k;
    } else if (a.kind === 'shell' || a.kind === 'wreck') {
      const H = D.heroOf ? D.heroOf(a.mon || 'worker', null, ['idle6']) : null;
      ctx.fillStyle = 'rgba(5,4,12,0.45)'; ctx.beginPath(); ctx.ellipse(a.x, a.y - 0.5, a.kind === 'wreck' ? 10 : 6, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      if (H && H.ready && H.meta && H.meta.idle6) { const L = H.meta.idle6, s = a.kind === 'wreck' ? L[0] : L[Math.floor(t * 6) % L.length]; D.heroBlit(ctx, H.img, H, s, a.x, a.y); if (H.emit) D.heroBlit(ex, H.emit, H, s, a.x, a.y); const m = H.anch && H.anch[s]; a.top = m ? (H.footY - m.top) / 2 : 26; }
      else a.top = 26;
    }
  }
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    const r = de0 ? de0.apply(this, arguments) : undefined, T = S && S.rt;
    if (T && S.f === T.f) for (const a of T.actors) if (a.kind !== 'ghost') list.push({ y: a.y, f: () => drawActor(ctx, ex, S, a, S.t) });
    return r;
  };

  // 推近多少：屋里的人和你都要框得进来（站台那种长屋子人离得远，就少推一点，最少 1.15 倍）
  RT.zoomGoal = function (S) {
    const T = S.rt, pts = T.actors.filter(a => a.kind !== 'ghost').concat([S.player]), Z = D.Z || 2, W = D.W || 960, H = D.H || 540;
    const bw = Math.max(...pts.map(q => q.x)) - Math.min(...pts.map(q => q.x)) + 80, bh = Math.max(...pts.map(q => q.y)) - Math.min(...pts.map(q => q.y)) + 85;
    return Math.max(1.15, Math.min(RT.ZOOM, W / (bw * Z), H / (bh * Z)));
  };
  // 镜头：对着说话的人（没人说话时对着屋里的人和你中间），推近 zoom 倍
  RT.focus = function (S) {
    const T = S.rt, v = S.talk && S.talk.R && S.talk.R.view ? S.talk.R.view() : null;
    const sp = v && v.cast && T.actors.find(a => a.id === v.cast.id && a.kind !== 'ghost');
    const bodies = T.actors.filter(a => a.kind !== 'ghost'), mid = bodies.length ? { x: bodies.reduce((s, a) => s + a.x, 0) / bodies.length, y: bodies.reduce((s, a) => s + a.y, 0) / bodies.length } : { x: S.player.x, y: S.player.y };
    // 屋里的人和你都框进来，偏向说话的人一点
    const pts = bodies.concat([S.player]), bx = { x: (Math.min(...pts.map(q => q.x)) + Math.max(...pts.map(q => q.x))) / 2, y: (Math.min(...pts.map(q => q.y)) + Math.max(...pts.map(q => q.y))) / 2 };
    const goal = sp ? { x: bx.x + (sp.x - bx.x) * 0.3, y: bx.y + (sp.y - bx.y) * 0.3 - 12 } : { x: bx.x, y: bx.y - 12 };
    T.foc.x += (goal.x - T.foc.x) * 0.08; T.foc.y += (goal.y - T.foc.y) * 0.08;
    return T.foc;
  };
  let buf = null;
  const ds0 = D.drawStation;
  D.drawStation = function (ctx, S, time) {
    const r = ds0.apply(this, arguments), T = S && S.rt;
    if (T && T.state === 'done') { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); RT.drawIdle(ctx, S, S.cam.x, S.cam.y); ctx.restore(); }
    if (!T || T.zoom <= 1.001 || !D.Z) return r;
    const W = ctx.canvas.width, H = ctx.canvas.height, Z = D.Z, k = T.zoom;
    if (!buf || buf.c.width !== W || buf.c.height !== H) { const [c, x] = D.canvas(W, H); buf = { c, x }; }
    buf.x.setTransform(1, 0, 0, 1, 0, 0); buf.x.drawImage(ctx.canvas, 0, 0);
    const f = T.foc, cx = S.cam.x, cy = S.cam.y;
    let sx = (f.x - cx) * Z - W / k / 2, sy = (f.y - cy) * Z - H / k / 2;
    // 偏向说话的人，但屋里的人和你都得留在画面里（头顶留出气泡的地方）
    { const pts = T.actors.filter(a => a.kind !== 'ghost').concat([S.player]), xs = pts.map(q => (q.x - cx) * Z), ys = pts.map(q => (q.y - cy) * Z);
      const loX = Math.max(...xs) + 30 - W / k, hiX = Math.min(...xs) - 30, loY = Math.max(...ys) + 16 - H / k, hiY = Math.min(...ys) - 64;
      if (loX <= hiX) sx = Math.max(loX, Math.min(hiX, sx)); if (loY <= hiY) sy = Math.max(loY, Math.min(hiY, sy)); }
    sx = Math.max(0, Math.min(W - W / k, sx)); sy = Math.max(0, Math.min(H - H / k, sy));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf.c, sx, sy, W / k, H / k, 0, 0, W, H);
    ctx.restore();
    // 头顶气泡：世界坐标 → 放大后的屏幕坐标
    if (T.state === 'play' && S.talk && S.talk.R && D.DlgView) {
      const scr = (x, y) => ({ x: Math.round(((x - cx) * Z - sx) * k), y: Math.round(((y - cy) * Z - sy) * k) });
      const act = { op: scr(S.player.x, S.player.y - 30) };
      for (const a of T.actors) act[a.id] = scr(a.x, a.y - (a.top || 22) - 4);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      D.DlgView.calm = (D.settings || {}).reduceFlash === true;
      D.DlgView.draw(ctx, S.talk.R, act, T.t);
      const v = S.talk.R.view();
      ctx.font = D.PXF; ctx.textBaseline = 'top'; ctx.textAlign = 'right'; ctx.fillStyle = '#6a6478';
      ctx.fillText(tr(v.kind === 'choice' ? '按数字键或点选项 · Esc 跳过' : '空格 / F 下一句 · Esc 跳过'), W - 10, H - 14);
      ctx.restore();
    }
    return r;
  };

  // 演完以后：走近按 F，那个人说 @idle 那一句
  const cx0 = K.candX;
  K.candX = function (S, add) {
    const T = S.rt;
    if (T && T.state === 'done' && T.ev.idle && S.f === T.f) {
      const p = S.player;
      for (const a of T.actors) if (a.kind !== 'ghost' && Math.hypot(a.x - p.x, a.y - p.y) < 30) {
        add({ ref: a, x: a.x, y: a.y, key: 'F', text: '说话', go: inp => { if (inp.interact) { a.say = { t: tr(T.ev.idle), at: S.t }; if (D.Sfx) D.Sfx.play('tink'); } } });
        break;
      }
    }
    if (cx0) cx0(S, add);
  };
  // 闲话气泡：画在世界上（不暂停）
  RT.drawIdle = function (ctx, S, cx, cy) {
    const T = S.rt; if (!T || T.state !== 'done' || S.f !== T.f) return;
    for (const a of T.actors) if (a.say && S.t - a.say.at < 3.5) {
      const Z = D.Z, x = Math.round((a.x - cx) * Z), y = Math.round((a.y - (a.top || 22) - 8 - cy) * Z);
      ctx.save(); ctx.font = D.PXF; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const w = ctx.measureText(a.say.t).width + 12; ctx.globalAlpha = Math.min(1, (3.5 - (S.t - a.say.at)) * 2);
      ctx.fillStyle = 'rgba(8,7,14,0.82)'; ctx.fillRect(x - w / 2, y - 16, w, 16); ctx.fillStyle = '#d8d0e0'; ctx.fillText(a.say.t, x, y - 2);
      ctx.restore();
    }
  };
})(D);
