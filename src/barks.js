/* 末班之后 · 剧情灵魂：站里的短句（不停人、不挡操作，只是"世界在说话"）。
   句子写在 story/剧情脚本.md 的"短句"一节，由 tools/build-dlg.mjs 编进 D.BARK_LINES。
   种类：pa 广播（所有站，低概率；字幕在屏幕下方）、pa_reserve 储备库广播（40–70 秒一句）、robot 机器发现你时的话、
         corpse 搜拾荒者遗体时的字条、laoka 检修隧道里老喀小队的求救（循环）、lu_radio 储备库开箱后陆峥的通信、relic / recorder 读遗物、放录音机。
   规矩：同类 60 秒最多一次；附近有敌人在打你时不出广播和遗骸字条。
   D.Barks.tick(S, dt) 每帧（包在 D.stepStation 上）；D.Barks.draw(ctx, S, cx, cy) 在光照之后画（draw.js 调）。
   设计：design/features/story-soul/design.md 第五节 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const B = D.Barks = {};
  B.LINES = D.BARK_LINES || {};
  const TS = 16, Z = 2;
  // 时机写在剧情脚本"短句"各小节的标题上（@gap @chance @every @near），开发面板里能临时改；这里的数是脚本里没写时的默认
  const prm = (k, n, d) => (D.Cues ? D.Cues.param(k, n, d) : d);
  const span = (v, d) => (Array.isArray(v) ? v : typeof v === 'number' ? [v, v] : d);
  const COL = { pa: '#9fe8b0', pa_reserve: '#9fe8b0', robot: '#9fe8b0', corpse: '#e8dcc0', laoka: '#e8a060', lu_radio: '#c8cbd6', relic: '#e8dcc0', recorder: '#c8cbd6', self: '#7dff9a' };
  const st = S => S.barks || (S.barks = { n: {}, list: [], seen: new WeakSet(), nextRes: 20, laokaT: 0, laokaI: 0, radio: false });
  // 自己的随机数（按站和第几站定种子），不去消耗站里的 S.rng，免得改了掉落之类的结果
  const rnd = S => { const b = st(S); if (!b.rng) b.rng = D.rng ? D.rng('barks:' + (S.st ? S.st.id : 0) + ':' + (S.step || 0)) : Math.random; return b.rng(); };
  const plain = t => (D.Dlg ? D.Dlg.plain(t) : t);
  const codeOf = (k, i) => (D.Cues ? D.Cues.barkCode(k, i) : null);
  const pick = (S, k) => { const L = B.LINES[k] || []; if (!L.length) return null; const i = Math.floor(rnd(S) * L.length); return { t: L[i], code: codeOf(k, i) }; };
  const fighting = S => S.enemies.some(e => !e.dead && e.f === S.f && e.aware && Math.hypot(e.x - S.player.x, e.y - S.player.y) < 220);
  B.count = (S, k) => (S.barks && S.barks.n[k]) || 0;
  // 冒一句：at = {x, y}（世界坐标，冒在它上方）或 null（屏幕下方的字幕）
  function push(S, kind, text, at, dur, who) {
    const b = st(S); if (!text) return;
    let code = null; if (typeof text === 'object') { code = text.code; text = text.t; } if (!text) return;
    b.list = b.list.filter(x => !(at && x.at === at)); // 同一个东西上只留最新的一句
    const shown = plain(D.tr ? D.tr(text) : text).replace(/^(陆峥|Lu Zheng)[:：]\s*/, ''); // 先整句翻（词典的键带效果标记），再去掉标记
    b.list.push({ kind, text: shown, code, at, f: S.f, t: 0, dur: dur || Math.min(9, 2.6 + shown.length * 0.09), who });
    b.n[kind] = (b.n[kind] || 0) + 1;
    if (b.list.length > 6) b.list.shift();
  }
  B.say = (S, kind, at, text) => push(S, kind, text || pick(S, kind), at);
  // 主角自己嘀咕一句（比如开到空箱子）：只在头顶冒字、过一会儿自己淡掉，不停人、不用按键关
  B.self = (S, text, dur) => { if (S && S.player) push(S, 'self', text, S.player, dur || 2.2); };
  B.relic = (S, q, R) => { const tr = D.tr || (x => x); push(S, 'relic', { t: tr(R.title) + (D.I18N && D.I18N.lang === 'en' ? ': ' : '：') + tr(R.text), code: R.code }, q, 8); };
  B.recorder = (S, q) => {
    const L = (B.LINES.recorder || []).map((t, i) => ({ t, code: codeOf('recorder', i) })), b = st(S), gap = prm('recorder', 'every', 4);
    L.forEach((l, i) => { if (!i) push(S, 'recorder', l, q, gap); else (b.tq || (b.tq = [])).push({ at: (b.clock || 0) + gap * i, kind: 'recorder', text: l, q }); });
  };

  B.tick = function (S, dt) {
    if (!S || !S.player || S.tut || S.safe && !S.reserve) { if (S && S.barks) S.barks.list.forEach(x => x.t += dt); return; }
    const b = st(S), fight = fighting(S); b.clock = (b.clock || 0) + dt; const T = b.clock;
    for (const x of b.list) x.t += dt; b.list = b.list.filter(x => x.t < x.dur);
    const lastOf = k => (b.lastT && b.lastT[k] != null ? b.lastT[k] : -1e9), mark = k => { (b.lastT || (b.lastT = {}))[k] = T; };
    const okT = k => T - lastOf(k) >= prm(k, 'gap', 60);
    // 储备库：广播 40–70 秒一句
    if (S.reserve) {
      b.nextRes -= dt;
      if (b.nextRes <= 0) { const [a0, a1] = span(prm('pa_reserve', 'every', [40, 70]), [40, 70]); b.nextRes = a0 + rnd(S) * (a1 - a0); push(S, 'pa_reserve', pick(S, 'pa_reserve'), null); mark('pa_reserve'); if (D.Sfx) D.Sfx.play('liftding'); }
      // 开箱以后陆峥的通信：三句，隔 4 秒
      if (S.alarm && !b.radio) { b.radio = true; const g = prm('lu_radio', 'every', 4); (B.LINES.lu_radio || []).forEach((l, i) => (b.tq || (b.tq = [])).push({ at: T + i * g, text: { t: l, code: codeOf('lu_radio', i) }, kind: 'lu_radio', who: '陆峥' })); }
    } else if (!fight && okT('pa') && rnd(S) < prm('pa', 'chance', 1 / 70) * dt) { push(S, 'pa', pick(S, 'pa'), null); mark('pa'); if (D.Sfx) D.Sfx.play('liftding'); }
    if (b.tq) b.tq = b.tq.filter(q => { if (T >= q.at) { push(S, q.kind, q.text, q.q || null, 5, q.who); return false; } return true; });
    // 机器发现你
    for (const e of S.enemies) {
      if (e.dead || e.f !== S.f) continue;
      if (e.aware && !e._bk) { e._bk = true; if (okT('robot') && e.kind !== 'raider' && rnd(S) < prm('robot', 'chance', 0.3)) { push(S, 'robot', pick(S, 'robot'), e, 3.2); mark('robot'); } }
    }
    // 搜遗体：字条
    const L = S.lootOpen; if (L && L.kind === 'corpse' && !b.seen.has(L)) { b.seen.add(L); if (!fight && okT('corpse') && rnd(S) < prm('corpse', 'chance', 0.4)) { push(S, 'corpse', pick(S, 'corpse'), { x: L.x, y: L.y }, 6); mark('corpse'); } }
    // 老喀：走近检修隧道里的残骸，循环求救
    if (S.e17 && S.f === S.e17.f) {
      const near = S.containers.filter(c => c.laoka && c.f === S.f).find(c => Math.hypot(c.x - S.player.x, c.y - S.player.y) < prm('laoka', 'near', 130));
      b.laokaT -= dt;
      if (near && b.laokaT <= 0) { const Ls = B.LINES.laoka || [], i = b.laokaI++ % Math.max(1, Ls.length); push(S, 'laoka', { t: Ls[i], code: codeOf('laoka', i) }, near, 4.5); b.laokaT = span(prm('laoka', 'every', 6.5), [6.5])[0]; }
    }
  };

  // ── 画：光照之后、在屏幕坐标里
  function wrap(ctx, s, maxW) { const out = []; let line = ''; for (const ch of s) { if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch === ' ' ? '' : ch; } else line += ch; } if (line) out.push(line); return out; }
  B.draw = function (ctx, S, cx, cy) {
    const b = S.barks; if (!b || !b.list.length) return;
    const W = ctx.canvas.width, H = ctx.canvas.height, tr = D.tr || (s => s);
    ctx.save(); ctx.font = D.PXF; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    let subY = H - 74;
    for (const x of b.list.slice().reverse()) {
      if (x.f !== S.f) continue;
      const a = Math.min(1, x.t / 0.25) * Math.min(1, (x.dur - x.t) / 0.6), col = COL[x.kind] || '#ddd', text = (D.Cues ? D.Cues.tag(x.code) : '') + x.text; // 开发模式：前面带编号 [B12]
      ctx.globalAlpha = Math.max(0, a);
      if (!x.at) { // 字幕：屏幕下方居中，前面一个标
        const tag = x.who ? tr(x.who) + ' · ' : tr('广播') + ' · ', lines = wrap(ctx, tag + text, W - 160), w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, h = lines.length * 15 + 8;
        ctx.fillStyle = 'rgba(6,5,10,0.78)'; ctx.fillRect(Math.round(W / 2 - w / 2), subY - h, w, h);
        ctx.fillStyle = col; ctx.fillRect(Math.round(W / 2 - w / 2), subY - h, 2, h);
        lines.forEach((l, i) => { ctx.fillStyle = i === 0 ? col : '#d8d4cc'; ctx.fillText(l, Math.round(W / 2 - w / 2) + 8, subY - h + 4 + i * 15); });
        subY -= h + 4; continue;
      }
      const lines = wrap(ctx, text, 170), w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 12, h = lines.length * 15 + 6;
      const sx = Math.round((x.at.x - cx) * Z), sy = Math.round((x.at.y - cy) * Z) - 40 - h + Math.round((1 - Math.min(1, x.t / 0.25)) * 4);
      if (sx < -200 || sx > W + 200 || sy < -60 || sy > H + 20) continue;
      const bx = Math.max(4, Math.min(W - w - 4, sx - w / 2));
      ctx.fillStyle = '#0b0a14'; ctx.fillRect(bx - 1, sy - 1, w + 2, h + 2);
      ctx.fillStyle = 'rgba(14,12,20,0.9)'; ctx.fillRect(bx, sy, w, h);
      ctx.fillStyle = col; ctx.fillRect(bx, sy + h - 1, w, 1); ctx.fillRect(sx - 1, sy + h, 3, 2);
      lines.forEach((l, i) => { ctx.fillStyle = x.kind === 'robot' && x.t < 0.3 ? '#3ee8ff' : col; ctx.fillText(l, bx + 6, sy + 3 + i * 15); });
    }
    ctx.restore();
  };
  // 挂上：每帧走（包 D.stepStation）
  const ss0 = D.stepStation;
  D.stepStation = function (S, dt) { const r = ss0.apply(this, arguments); if (S && S.ponly) return r; try { B.tick(S, dt); } catch (e) { if (D.debug) console.error(e); } return r; };
})(D);
