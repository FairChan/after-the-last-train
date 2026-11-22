/* 末班之后 · 剧情灵魂：对话逻辑（不碰画面，能在 node / 测试里直接跑）。
   台词在 story/剧情脚本.md，由 tools/build-dlg.mjs 编译成 src/dlg-data.js（D.Dlg.add）。
   D.Dlg.run(场次 id, pf, opt) 返回一个 R：update(dt) 走时间、press() 打完 / 下一句、hold(on) 快进、pick(i) 选、cut() 打断、skipAll() 跳到下一个必须选的地方。
   R.view() 给显示层（dlg-view.js）画；R.log 是这一场的记录（回看）。动作里会改进度的（线索、委托、话的选项、给东西）落到 story.js。
   设计：design/features/story-soul/design.md 第三节 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const Dl = D.Dlg = D.Dlg || {};
  Dl.SCENES = Dl.SCENES || {};
  Dl.add = list => { for (const s of list) Dl.SCENES[s.id] = s; };
  // 说话人：颜色、打字速度（字 / 秒）、打字音
  Dl.CAST = {
    林桥: { id: 'lin', col: '#ffb057', cps: 22, voice: 'lin' },
    阿隼: { id: 'ahsun', col: '#3ee8ff', cps: 32, voice: 'ahsun' },
    陆峥: { id: 'lu', col: '#c8cbd6', cps: 16, voice: 'lu' },
    广播: { id: 'pa', col: '#9fe8b0', cps: 18, voice: 'pa' },
    维护机: { id: 'bot', col: '#9fe8b0', cps: 18, voice: 'pa' },
    站民: { id: 'crowd', col: '#d8c8a8', cps: 20, voice: 'lin' },
    老喀: { id: 'laoka', col: '#e8a060', cps: 24, voice: 'pa' },
    林远舟: { id: 'yuan', col: '#b8b0a0', cps: 20, voice: null, hand: true },
    陆衡: { id: 'heng', col: '#c8cbd6', cps: 16, voice: 'pa' },
    你: { id: 'op', col: '#7dff9a', cps: 40, voice: 'op' },
    旁白: { id: 'narr', col: '#a8a4b4', cps: 26, voice: null },
  };
  const PAUSE = { '，': 0.12, '、': 0.12, ',': 0.12, '；': 0.2, '：': 0.15, '。': 0.3, '？': 0.3, '！': 0.3, '.': 0.3, '?': 0.3, '!': 0.3, '…': 0.25, '—': 0.175 };
  Dl.PAUSE = PAUSE;
  const tr = t => (D.tr ? D.tr(t) : t);
  // 解析效果标记 → 一个字一项：{ch, fx:[shake|wave|glitch], col:red|dim|hand|null, pre 出现前停几秒, wait 出现后停几秒, mul 速度倍数, fast 一下子出来}
  Dl.glyphs = function (text) {
    const out = [], fx = new Set(); let col = null, mul = 1, fast = false, pre = 0;
    const re = /\{(\/?)(p|shake|wave|glitch|red|dim|hand|slow|fast)(?:\s+([\d.]+))?\}/y;
    for (let i = 0; i < text.length;) {
      if (text[i] === '{') {
        re.lastIndex = i; const m = re.exec(text);
        if (m) {
          const [, end, tag, num] = m;
          if (tag === 'p') pre += +num || 0;
          else if (tag === 'shake' || tag === 'wave' || tag === 'glitch') end ? fx.delete(tag) : fx.add(tag);
          else if (tag === 'red' || tag === 'dim' || tag === 'hand') col = end ? null : tag;
          else if (tag === 'slow') mul = end ? 1 : (+num || 0.5);
          else if (tag === 'fast') fast = !end;
          i = re.lastIndex; continue;
        }
      }
      const ch = text[i++];
      out.push({ ch, fx: [...fx], col, pre, wait: PAUSE[ch] || 0, mul, fast });
      pre = 0;
    }
    if (pre && out.length) out[out.length - 1].wait += pre; // 句尾的 {p}：停在最后一个字后面
    return out;
  };
  Dl.plain = text => text.replace(/\{\/?(?:p|shake|wave|glitch|red|dim|hand|slow|fast)(?:\s+[\d.]+)?\}/g, '');

  // 条件：has:线索 flag:名[=值] item:物品 quest:委托（进行中） done:委托 ending:键，前面加 ! 取反
  const S0 = pf => D.Story.S(pf);
  const holdN = (pf, id) => [pf.stash, pf.kit, pf.safe, pf.keycase, pf.bag].filter(Boolean).reduce((a, g) => a + D.Grid.count(g, y => y === id), 0);
  Dl.cond = function (pf, c) {
    if (!c) return true;
    if (Array.isArray(c)) return c.every(x => Dl.cond(pf, x));
    if (c[0] === '!') return !Dl.cond(pf, c.slice(1));
    const i = c.indexOf(':'), k = c.slice(0, i), v = c.slice(i + 1), s = S0(pf);
    if (k === 'has') return D.Story.has(pf, v);
    if (k === 'flag') { const [n, want] = v.split('='); const x = s.flags[n]; return want == null ? !!x && x !== 0 : String(x) === want; }
    if (k === 'item') return holdN(pf, v) > 0;
    if (k === 'quest') return s.quests[v] === 'active';
    if (k === 'done') return s.quests[v] === 'done';
    if (k === 'ending') return s.ending === v;
    return false;
  };
  // 会改进度的动作；其他（walk、cam、music…）交给 opt.onAct
  const ACT = {
    clue: (pf, a) => D.Story.learn(pf, a[0], a.slice(1).join(' ') || '对话里', null),
    quest: (pf, a) => { const s = S0(pf); if (!s.quests[a[0]]) s.quests[a[0]] = 'active'; },
    beat: (pf, a) => D.Story.choose(pf, a[0], +a[1]),
    flag: (pf, a) => { const s = S0(pf); for (const x of a) { const [n, v] = x.split('='); s.flags[n] = v == null ? 1 : isNaN(+v) ? v : +v; } },
    money: (pf, a) => { pf.money += +a[0] || 0; },
    screen: (pf, a, raw) => { S0(pf).flags.screen = raw; },
    give: (pf, a) => { if (D.Story.giveRelicItem) D.Story.giveRelicItem(pf, a[0]); else D.Grid.add(pf.stash, a[0], 1); },
  };
  Dl.ACT = ACT;

  Dl.run = function (id, pf, opt) {
    opt = Object.assign({ timers: true, cpsMul: 1, dry: false, onAct: null, onType: null }, opt);
    const sc = Dl.SCENES[id]; if (!sc) throw new Error('没有这场戏：' + id);
    const N = sc.nodes, L = sc.labels;
    const R = { id, scene: sc, done: false, log: [], holding: false };
    let i = 0, kind = 'done', who = null, raw = '', gl = [], shown = 0, acc = 0, delay = 0, cut = null, after = null, waitT = 0, choices = null, timer = null, timeLeft = 0, noTimer = false;
    const say = (w, text, c, next) => { kind = w === '旁白' ? 'narr' : 'say'; who = w; raw = tr(text); gl = Dl.glyphs(raw); shown = 0; acc = 0; delay = gl.length ? gl[0].pre : 0; cut = c || null; after = next; };
    function enter(j) {
      i = j;
      for (let guard = 0; guard < 5000; guard++) {
        const n = N[i];
        if (!n || n.k === 'end') { kind = 'done'; R.done = true; who = null; return; }
        if (n.k === 'say' || n.k === 'narr') { say(n.k === 'narr' ? '旁白' : n.who, n.t, n.cut, i + 1); return; }
        if (n.k === 'choice') {
          kind = 'choice'; who = null;
          choices = n.opts.map(o => ({ t: tr(o.t), to: o.to, act: !!o.act, cost: o.cost || 0, ok: (!o.cost || pf.money >= o.cost) && Dl.cond(pf, o.cond) }));
          timer = opt.timers && !noTimer && n.timer ? n.timer : null; timeLeft = timer ? timer.sec : 0; return;
        }
        if (n.k === 'go') { i = L[n.to]; continue; }
        if (n.k === 'if') { i = Dl.cond(pf, n.cond) ? i + 1 : L[n.to]; continue; }
        if (n.k === 'act') {
          if (n.op === 'wait') { kind = 'wait'; who = null; waitT = +n.a[0] || 0.5; after = i + 1; return; }
          if (ACT[n.op] && !opt.dry) ACT[n.op](pf, n.a, n.raw);
          if (opt.onAct) opt.onAct(n.op, n.a, n.raw);
          i++; continue;
        }
        i++;
      }
      throw new Error(id + ' 死循环');
    }
    const finishLine = () => { R.log.push({ who, t: Dl.plain(raw) }); enter(after); };
    const cps = () => ((D.Dlg.CAST[who] || {}).cps || 24) * opt.cpsMul;
    R.update = function (dt) {
      if (R.done) return;
      if (R.holding) dt *= 4;
      if (kind === 'wait') { waitT -= dt; if (waitT <= 0) enter(after); return; }
      if (kind === 'choice') { if (timer) { timeLeft -= dt; if (timeLeft <= 0) { const to = timer.to; timer = null; noTimer = false; enter(L[to]); } } return; }
      if (kind !== 'say' && kind !== 'narr') return;
      if (opt.cpsMul >= 1000) { shown = gl.length; delay = 0; return; } // 设置里的"立刻"：整句一下子出来，不等标点和停顿
      acc += dt;
      while (shown < gl.length) {
        const g = gl[shown], need = delay + (g.fast ? 0 : 1 / (cps() * (g.mul || 1)));
        if (acc < need) break;
        acc -= need; shown++; delay = g.wait + (gl[shown] ? gl[shown].pre : 0);
        if (opt.onType && !PAUSE[g.ch] && g.ch !== ' ') opt.onType(who, g);
      }
    };
    R.press = function () {
      if (kind === 'say' || kind === 'narr') { if (shown < gl.length) { shown = gl.length; delay = 0; } else finishLine(); }
      else if (kind === 'wait') enter(after);
    };
    R.hold = on => { R.holding = !!on; };
    R.pick = function (k) {
      if (kind !== 'choice') return false;
      const c = choices[k]; if (!c || (!c.ok && !opt.dry)) return false;
      timer = null; noTimer = false;
      if (c.act) { R.log.push({ who: '你', t: Dl.plain(c.t), act: true }); enter(L[c.to]); }
      else say('你', c.t, null, L[c.to]);
      return true;
    };
    R.cut = function () {
      if (!cut || kind !== 'say' || shown >= gl.length) return false;
      R.log.push({ who, t: Dl.plain(gl.slice(0, shown).map(g => g.ch).join('')) + '——', cut: true });
      const c = cut; cut = null; say('你', c.t, null, L[c.to]); return true;
    };
    R.skipAll = function () {
      for (let g = 0; g < 5000 && !R.done; g++) {
        if (kind === 'choice') { timer = null; timeLeft = 0; noTimer = true; return; }
        if (kind === 'say' || kind === 'narr') { shown = gl.length; finishLine(); } else R.press();
      }
    };
    R.view = () => ({ kind, who, text: Dl.plain(raw), glyphs: gl, shown, choices: kind === 'choice' ? choices : [], timeLeft: kind === 'choice' ? Math.max(0, timeLeft) : 0, timeMax: kind === 'choice' && timer ? timer.sec : 0, cut: kind === 'say' && cut && shown < gl.length ? { t: tr(cut.t) } : null, cast: D.Dlg.CAST[who] || null });
    enter(0);
    return R;
  };
})(D);
