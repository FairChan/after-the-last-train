/* 末班之后 · 剧情灵魂：剧情屋模式（G.mode = 'scene'）。
   回据点时（G.toHub）先看有没有"该演还没演"的场次，有就一场接一场演完再进据点；储备库里读日志也从这里演（演完回站里）。
   D.Scene.play(ids, pf, done)：切到 scene 模式按顺序演，演完调 done。D.Scene.pending(pf)：该演还没演的场次。
   输入：空格 / F / 左键 打完或下一句；按住快进；1–4 选；有打断时 1 或点它；Esc 两下跳过这一场；L 回看。
   演过的记在 pf.story.seen；老存档里看过的话（talk 里有）算演过。
   测试和自动玩家（没有存档位）不自动演，除非 D.Scene.force = true。新存档在首页入场放完、问新手教学之前先演开场 open（S00，包在 D.UI.tutOffer 上）；
   教学做完或跳过以前不演别的。
   设计：design/features/story-soul/design.md 第四节 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const Sc = D.Scene = { force: false, cur: null };
  const G = () => D.Game;
  const seenOf = pf => { const s = D.Story.S(pf); return s.seen || (s.seen = {}); };
  const SET = () => D.settings || {};
  const CPS = { slow: 0.6, mid: 1, fast: 1.7, instant: 1000 };

  Sc.pending = function (pf) {
    const seen = seenOf(pf), out = [];
    for (const b of D.Story.visibleBeats(pf)) if (D.Dlg.SCENES[b.id] && !seen[b.id]) out.push(b.id);
    return out;
  };
  Sc.music = () => { const c = Sc.cur, m = c && (c.music || (c.R && c.R.scene.music)); return m && D.Music && D.Music.TRACKS[m] ? m : 'hub'; };

  Sc.play = function (ids, pf, done, opt) {
    ids = (ids || []).filter(id => D.Dlg.SCENES[id]);
    const g = G(); if (!ids.length) { if (done) done(); return; }
    const prev = g.mode === 'scene' ? (Sc.cur ? Sc.cur.prev : 'hub') : g.mode; // 演着的时候又要演（读档）：顶掉旧的
    Sc.cur = { ids, k: -1, pf, done, opt: opt || {}, prev, t: 0, escT: 0, logOpen: false, heldT: 0 };
    g.mode = 'scene'; if (D.UI && D.UI.clear) D.UI.clear(); if (D.Sfx && D.Sfx.musicDuck) D.Sfx.musicDuck(0.7); // 对话时音乐压低一点，打字音听得清
    next();
  };
  function next() {
    const c = Sc.cur; c.k++;
    if (c.k >= c.ids.length) { const g = G(), done = c.done; Sc.cur = null; if (D.Sfx && D.Sfx.musicDuck) D.Sfx.musicDuck(1); g.mode = c.prev === 'scene' ? 'hub' : c.prev; if (done) done(); return; }
    const id = c.ids[c.k], sc = D.Dlg.SCENES[id], room = D.SROOMS[sc.room] || D.SROOMS.shop;
    if (!room.cache) room.cache = room.build();
    const s = D.Story.S(c.pf), set = SET();
    c.end0 = s.ending; c.id = id; c.room = room; c.music = sc.music; c.dark = 0; c.darkGoal = 0; c.shake = 0; c.t = 0; c.fade = 0; c.out = 0; c.escT = 0; c.logOpen = false;
    c.actors = {}; for (const k in room.actors) c.actors[k] = Object.assign({ pose: 'stand' }, room.actors[k], { x0: room.actors[k].x });
    c.st = { cache: room.cache, screen: s.flags.screen, lamps: s.flags.lamps, badge: s.flags.badge === 1, day: D.marketDay ? D.marketDay(c.pf) : 0, actors: () => drawActors(c), light: (x, y, r, col, a) => D.Post.addLight((x / 2 - c.cam.x) * ZS, (y / 2 - c.cam.y) * ZS, r * 2, col, a) };
    c.cam = { x: 80, y: 72 }; c.camSnap = true;
    c.R = D.Dlg.run(id, c.pf, {
      timers: set.dlgTimers !== false, cpsMul: +set.typeSpeed || 1, dry: !!c.opt.dry, // 重演选过的场次：只回看，不改进度
      onType: (who, gl) => D.DlgView.typeSound(who, gl),
      onAct: (op, a, raw) => act(c, op, a, raw),
    });
    D.DlgView.calm = set.reduceFlash === true; // 设置里"减少闪烁"：文字不抖、不乱码，只留颜色
    if (D.Music && sc.music) D.Music.play(Sc.music());
    if (D.Mood) D.Mood.glitch(260); // 开场：信号干扰闪一下
  }
  function finishScene() {
    const c = Sc.cur, s = D.Story.S(c.pf); seenOf(c.pf)[c.id] = 1;
    // 这一场里第一次选定了结局：接着在站台演尾声；从"暂时保留"改成公开：补演念名字那一段
    const ins = [];
    if (!c.end0 && s.ending && !seenOf(c.pf).epi_platform) ins.push('epi_platform');
    else if (c.end0 === 'keep' && s.ending === 'public') ins.push('epi_public_late');
    if (ins.length) c.ids.splice(c.k + 1, 0, ...ins);
    if (G().save && c.prev !== 'station') G().save(); // 行动中（储备库里读日志）不存：会盖掉这一趟的检查点，关网页就不按损毁结算了
    next();
  }
  function act(c, op, a, raw) {
    const A = c.actors, who = a[0], key = who && D.Dlg.CAST[who] ? D.Dlg.CAST[who].id : who;
    if (op === 'sfx' && D.Sfx) D.Sfx.play(a[0]);
    else if (op === 'music') { c.music = a[0]; if (D.Music) D.Music.play(Sc.music()); }
    else if (op === 'sting' && D.Music) D.Music.sting(a[0]); // 配乐第二代：短乐句（e17 / spotted / clear / death）
    else if (op === 'dark') c.darkGoal = +a[0] || 0;
    else if (op === 'shake') c.shake = +a[0] || 0.4;
    else if (op === 'walk' && A[key]) A[key].goal = +a[1];
    else if (op === 'face' && A[key]) A[key].face = a[1] === 'left' ? -1 : 1;
    else if (op === 'pose' && A[key]) { A[key].pose = a[1]; if (a[1] === 'work' || a[1] === 'down') A[key].face = 1; if (a[1] === 'stand') A[key].face = room0(c).actors[key] ? room0(c).actors[key].face : -1; }
    else if (op === 'screen') c.st.screen = raw;
    else if (op === 'flag' && /lamps/.test(raw)) c.st.lamps = 1;
    else if (op === 'give' && c.opt.give) c.opt.give(a[0]);
  }
  const room0 = c => c.room;

  // ── 每帧
  Sc.step = function (dt) {
    const c = Sc.cur; if (!c) return;
    const I = D.Input, R = c.R; c.t += dt; c.fade = Math.min(1, c.fade + dt * 2.5);
    if (D.Sfx && D.Sfx.ambTick) D.Sfx.ambTick(c.room.amb, dt); // 屋子的环境声
    c.dark += (c.darkGoal - c.dark) * Math.min(1, dt * 2); c.shake = Math.max(0, c.shake - dt);
    for (const k in c.actors) { const p = c.actors[k]; if (p.goal != null) { const d = p.goal - p.x; p.moving = Math.abs(d) > 0.5; p.x += Math.sign(d) * Math.min(Math.abs(d), 40 * dt); if (p.moving) p.face = Math.sign(d); else p.goal = null; } }
    if (c.out) { c.out += dt * 2.5; if (c.out >= 1) finishScene(); return; }
    if (c.logOpen) { if (I.hit('KeyL') || I.hit('Escape') || I.mclick) c.logOpen = false; return; }
    if (I.hit('KeyL')) { c.logOpen = true; return; }
    if (I.hit('Escape')) { if (c.escT > 0) { R.skipAll(); c.escT = 0; } else c.escT = 2.2; }
    c.escT = Math.max(0, c.escT - dt);
    const v = R.view();
    const adv = I.hit('Space') || I.hit('KeyF') || I.hit('Enter');
    let clicked = null;
    if (I.mclick) { for (const h of D.DlgView.hits) if (I.mx >= h.x && I.mx < h.x + h.w && I.my >= h.y && I.my < h.y + h.h) clicked = h; }
    if (v.cut && (I.hit('Digit1') || (clicked && clicked.cut))) { R.cut(); D.Sfx.play('warn'); }
    else if (v.kind === 'choice') {
      for (let i = 0; i < 4; i++) if (I.hit('Digit' + (i + 1)) || I.hit('Numpad' + (i + 1))) { if (R.pick(i)) D.Sfx.play('click'); else D.Sfx.play('nope'); }
      if (clicked && clicked.pick != null) { if (R.pick(clicked.pick)) D.Sfx.play('click'); else D.Sfx.play('nope'); }
    } else if (adv || (I.mclick && !clicked)) R.press();
    const held = I.keys.Space || I.keys.KeyF || I.mdown; c.heldT = held ? c.heldT + dt : 0; R.hold(c.heldT > 0.4);
    R.update(dt);
    if (R.done && !c.out) c.out = 0.001;
  };

  // ── 画
  // 镜头：世界 160×90 的一块放大 4 倍（人物比站里大一倍，像过场）；对准两个人中间，说话的人那边偏一点
  const ZS = 4, VW = 160, VH = 90;
  function camGoal(c) {
    const A = c.actors, xs = Object.values(A).map(p => p.x), mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const v = c.R ? c.R.view() : null, sp = v && v.cast && A[v.cast.id] ? A[v.cast.id].x : mid;
    const rv = c.room.view || {};
    return { x: Math.max(0, Math.min(320 - VW, mid + (sp - mid) * 0.18 - VW / 2)), y: rv.y != null ? rv.y : 72 };
  }
  function drawActors(c) {
    const ctx = c.bx, ex = c.bex, t = c.t;
    for (const k in c.actors) {
      const p = c.actors[k]; if (k === 'op') { drawShell(ctx, ex, c, p, t); continue; }
      if (p.kind === 'ghost') { p.headY = p.y - 6; continue; } // 只有位置（车厢里的座位、录音机、人群）：话从那里冒出来
      if (p.kind === 'bot') { if (p.goal == null) { const nx = 236 + Math.sin(t * 0.22) * 34; p.face = nx < p.x ? -1 : 1; p.x = nx; } const b = c.room.cache.bot; D.blit(ctx, b, p.x, p.y + Math.sin(t * 5) * 0.3, p.face < 0); D.blit(ex, b, p.x, p.y, p.face < 0, 'emit'); c.st.botX = p.x; p.headY = p.y - 16; continue; }
      if (!p.look) p.look = D.SROOMS.shop.actors.lin.look;
      const pose = p.pose === 'sit' ? 'sit' : 'stand', talk = D.humanSpeaking(c.R, v => !!(v.cast && v.cast.id === k));
      const A = D.humanAnim(p, t, { pose, moving: p.moving, talk, listen: !talk && D.humanSpeaking(c.R, () => true) });
      const spr = D.humanSprite(p.look, pose, A.fr, p.pose === 'down' ? A.an.replace(/[cgh]/g, '') + 'n' : A.an), bob = p.pose === 'down' ? 1 : A.bob;
      ctx.fillStyle = 'rgba(5,4,12,0.5)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.5, 6, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      D.blit(ctx, spr, p.x, p.y + bob, (p.face || 1) < 0);
      ex.globalAlpha = 0.14; D.blit(ex, spr, p.x, p.y + bob, (p.face || 1) < 0); ex.globalAlpha = 1;
      p.headY = p.y - spr.h / 2 + 4;
    }
  }
  function drawShell(ctx, ex, c, p, t) { // 玩家的工壳：朝右的待机（和首页立绘同一套图集）
    const pf = c.pf, k = D.shellOf ? D.shellOf(pf) : null, mods = k && pf.shells[k] ? D.shellMods(pf, k) : null;
    const H = k && D.heroOf ? D.heroOf(k, mods, ['idle6']) : null;
    ctx.fillStyle = 'rgba(5,4,12,0.5)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 0.5, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
    if (!H || !H.ready || !H.meta.idle6) { p.headY = p.y - 26; return; }
    const list = H.meta.idle6, s = list[Math.floor(t * 6) % list.length];
    D.heroBlit(ctx, H.img, H, s, p.x, p.y); if (H.emit) D.heroBlit(ex, H.emit, H, s, p.x, p.y);
    const m = H.anch && H.anch[s]; p.headY = m ? p.y - (H.footY - m.top) / 2 - 2 : p.y - 26;
  }
  let buf = null;
  Sc.draw = function (ctx, time) {
    const c = Sc.cur; if (!c) return;
    const W = D.W, Hh = D.H, room = c.room;
    if (!buf) { const [a, ax] = D.canvas(W, Hh), [b, bx] = D.canvas(W, Hh); ax.imageSmoothingEnabled = bx.imageSmoothingEnabled = false; buf = { a, ax, b, bx }; }
    // 镜头慢慢跟
    const g = camGoal(c), k = c.camSnap ? 1 : 0.06; c.camSnap = false; c.cam.x += (g.x - c.cam.x) * k; c.cam.y += (g.y - c.cam.y) * k;
    // 先在缓冲里按世界坐标（×2）画整间屋，再截镜头那一块放大 2 倍贴到屏幕
    const bx = buf.ax, bex = buf.bx; c.bx = bx; c.bex = bex;
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.fillStyle = '#05040a'; bx.fillRect(0, 0, W, Hh); bex.setTransform(1, 0, 0, 1, 0, 0); bex.clearRect(0, 0, W, Hh);
    bx.setTransform(2, 0, 0, 2, 0, 0); bex.setTransform(2, 0, 0, 2, 0, 0);
    room.draw(bx, bex, c.t, c.st);
    const sx = c.shake > 0 ? Math.round(Math.sin(c.t * 70) * 2) : 0, cx = Math.round(c.cam.x * 2) / 2, cy = Math.round(c.cam.y * 2) / 2;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf.a, cx * 2, cy * 2, VW * 2, VH * 2, sx, 0, W, Hh);
    const ex = D.Post.ex; ex.save(); ex.setTransform(1, 0, 0, 1, 0, 0); ex.imageSmoothingEnabled = false; ex.drawImage(buf.b, cx * 2, cy * 2, VW * 2, VH * 2, sx, 0, W, Hh); ex.restore();
    room.lights(c.t, c.st);
    D.Pix.finish(ctx, room.ambient, { vig: 1.6 });
    // 变暗、淡入淡出、宽银幕黑边
    const fk = Math.min(c.fade, 1 - Math.min(1, c.out || 0));
    if (c.dark > 0.01) { ctx.fillStyle = `rgba(4,3,8,${c.dark * 0.6})`; ctx.fillRect(0, 0, W, Hh); }
    if (fk < 1) { ctx.fillStyle = `rgba(4,3,8,${1 - fk})`; ctx.fillRect(0, 0, W, Hh); }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 24); ctx.fillRect(0, Hh - 24, W, 24);
    // 对话：头顶那一点换成屏幕坐标
    const actors = {}; for (const key in c.actors) { const p = c.actors[key]; actors[key] = { x: (p.x - cx) * ZS + sx, y: ((p.headY || p.y - 26) - cy) * ZS }; }
    if (!c.out) D.DlgView.draw(ctx, c.R, actors, c.t);
    ctx.font = D.PXF; ctx.textBaseline = 'top'; ctx.textAlign = 'right'; ctx.fillStyle = '#5a5668';
    ctx.fillText(c.escT > 0 ? '再按一次 Esc 跳过这一场' : 'L 回看 · Esc 跳过', W - 10, Hh - 18);
    ctx.textAlign = 'left'; ctx.fillText(room.name || '', 10, 6);
    if (D.Cues && D.Cues.dev) { const sc = D.Dlg.SCENES[c.id] || {}; ctx.textAlign = 'right'; ctx.fillStyle = '#ffd27a'; ctx.fillText((sc.code || '?') + ' · ' + c.id + (c.opt.dry ? ' · 预览' : ''), W - 10, 6); } // 开发模式：这一场的编号
    if (c.logOpen) drawLog(ctx, c);
    ctx.restore();
  };
  function drawLog(ctx, c) {
    const W = D.W, Hh = D.H, L = c.R.log.slice(-14), tr = D.tr || (s => s);
    ctx.fillStyle = 'rgba(5,4,10,0.94)'; ctx.fillRect(40, 30, W - 80, Hh - 60);
    ctx.fillStyle = '#6a6478'; ctx.fillRect(40, 30, W - 80, 1); ctx.fillRect(40, Hh - 31, W - 80, 1);
    ctx.textAlign = 'left'; ctx.fillStyle = '#a8a4b4'; ctx.fillText('对话记录 · L 关闭', 52, 38);
    let y = 58;
    for (const e of L) { const C = D.Dlg.CAST[e.who] || {}; ctx.fillStyle = C.col || '#ccc'; ctx.fillText(e.who === '旁白' ? '' : tr(e.who), 52, y); ctx.fillStyle = e.who === '旁白' ? '#8a8698' : '#d8d4cc'; const s = e.t.length > 40 ? e.t.slice(0, 40) + '…' : e.t; ctx.fillText(s, 110, y); y += 18; }
  }

  // ── 回据点先演：G.toHub 包一层
  const wrap = () => {
    const g = G(); if (!g || g._sceneWrapped) return; g._sceneWrapped = true;
    const toHub0 = g.toHub;
    g.toHub = function (tab) {
      const pf = g.pf, self = this;
      if (pf && ((g.slot != null && pf.tut) || Sc.force)) {
        const ids = Sc.pending(pf), learned = D.Story.seeBeats(pf); // 话里读到的线索（陆峥的报价单）回到据点后弹卡片
        const cards = () => { if (D.UI && D.UI.clueCard) for (const c of learned) D.UI.clueCard(pf, c); };
        if (ids.length) { g.raid = null; g.S = null; return Sc.play(ids, pf, () => { toHub0.call(self, tab); cards(); }); }
        const r = toHub0.call(self, tab); cards(); return r;
      }
      return toHub0.call(self, tab);
    };
  };
  if (D.Game) wrap(); else (D._late || (D._late = [])).push(wrap);

  // ── 新存档：首页入场放完、问新手教学之前，先演开场 S00（讲清楚故事），演完回首页再问
  if (D.UI && D.UI.tutOffer) {
    const offer0 = D.UI.tutOffer;
    D.UI.tutOffer = function () {
      const g = G(), pf = g && g.pf;
      if (D.UI.introBusy && D.UI.introBusy()) return setTimeout(D.UI.tutOffer, 300); // 入场动画还在放：等放完
      if (pf && !pf.tut && !seenOf(pf).open && D.Dlg.SCENES.open) return Sc.play(['open'], pf, () => { g.toHub('home'); offer0(); });
      return offer0();
    };
  }

  // ── 存档：seen 跟着主线一起存；老存档（没有 seen）里看过的话算演过
  const ser0 = D.Story.serialize, des0 = D.Story.deserialize;
  D.Story.serialize = function (pf) { const o = ser0.call(this, pf); o.seen = Object.assign({}, seenOf(pf)); return o; };
  D.Story.deserialize = function (pf, o) {
    const s = des0.apply(this, arguments);
    s.seen = {};
    if (o && o.seen && typeof o.seen === 'object') { for (const k in o.seen) if (o.seen[k]) s.seen[k] = 1; }
    else if (o && o.talk) for (const k in o.talk) s.seen[k] = 1;
    return s;
  };
})(D);
