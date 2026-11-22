/* Underdog · 小样二：成就（M7）。30 个，存在浏览器里（不跟存档位走，和设置一样），以后一一对应 Steam 成就。
   三处挂钩：D.finishRaid 之后（撤离 / 损毁这一趟的账）、K.onKillX（击毁）、main.js 每帧 D.Ach.tick（存档里的进度：钱、型号、设施、线索、结局……）。
   据点"菜单"里的"成就"页（U.achievements）。设计：design/features/platform/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const KEY = 'underdog-ach';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  const st = Object.assign({ got: {}, n: {} }, load() || {}); st.got = st.got || {}; st.n = st.n || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 浏览器不让存：只留在内存里 */ } };
  const n = k => st.n[k] | 0, add = (k, v) => { st.n[k] = n(k) + (v | 0); };
  const seen = (k, v) => { const s = new Set(st.n[k] || []); s.add(v); st.n[k] = [...s]; return s.size; };
  const has = k => (st.n[k] || []).length;
  const story = pf => (pf && pf.story) || {}, grow = pf => (pf && pf.grow) || {};
  // [id, 名字, 说明, 条件（用到的累计数在 st.n 里）]
  const LIST = [
    ['first_out', '第一趟', '第一次撤出来', () => n('outs') >= 1],
    ['first_death', '学费', '第一次损毁', () => n('deaths') >= 1],
    ['outs10', '老手', '撤出 10 次', () => n('outs') >= 10],
    ['outs50', '地铁通', '撤出 50 次', () => n('outs') >= 50],
    ['haul', '满载而归', '一趟带回价值 5000 以上的东西', () => n('bestHaul') >= 5000],
    ['deep', '深入', '从危险等级 3 的站撤出来', () => n('deep') >= 1],
    ['hidden_exit', '秘密出口', '从隐藏撤离点撤出来', () => n('hiddenOut') >= 1],
    ['light', '轻装', '只带免费的钉枪和工兵铲，从危险等级 2 以上的站撤出来', () => n('lightOut') >= 1],
    ['kills100', '拆解工', '累计击毁 100 台机器', () => n('kills') >= 100],
    ['kills1000', '废品回收站', '累计击毁 1000 台机器', () => n('kills') >= 1000],
    ['perfect1', '贴脸', '第一次完美闪避', () => n('perfect') >= 1],
    ['perfect50', '舞者', '累计完美闪避 50 次', () => n('perfect') >= 50],
    ['crit1', '背后', '第一次背刺或处决', () => n('crits') >= 1],
    ['boss1', '屠龙', '击毁一个镇守首领', () => ['queen', 'warden', 'archivist'].some(k => (st.n.bosses || []).includes(k))],
    ['boss3', '清场', '蜂后、铁闸、档案官都击毁过', () => ['queen', 'warden', 'archivist'].every(k => (st.n.bosses || []).includes(k))],
    ['clamp', '钳工-9', '击毁钳工-9', () => (st.n.bosses || []).includes('boss')],
    ['clues', '拼图', '集齐 12 条线索', (pf) => (story(pf).clues || []).length >= 12 || n('clues') >= 12],
    ['end_public', '公开', '把记录交给林桥公开', (pf) => story(pf).ending === 'public' || (st.n.endings || []).includes('public')],
    ['end_sell', '收购', '把记录卖给陆峥', (pf) => story(pf).ending === 'sell' || (st.n.endings || []).includes('sell')],
    ['end_keep', '留着', '记录自己留着', (pf) => story(pf).ending === 'keep' || (st.n.endings || []).includes('keep')],
    ['rich', '小有积蓄', '手里有 10000', (pf) => pf && pf.money >= 10000],
    ['shells', '车库满了', '8 个型号都有', (pf) => pf && Object.keys(D.SHELLS).every(k => D.SHELLS[k].free || (pf.shells[k] && pf.shells[k].own))],
    ['facmax', '基建狂魔', '四个设施都升满', (pf) => pf && ['bench', 'med', 'intel', 'store'].every(k => (grow(pf).fac || {})[k] >= 4)],
    ['attfull', '改枪匠', '一把枪四个配件槽都装满', (pf) => pf && Object.values(grow(pf).att || {}).some(a => Object.keys(D.ATT_SLOTS || {}).every(s => a[s]))],
    ['modfull', '全副武装', '一台型号三个改装槽都装满', (pf) => pf && Object.values(pf.shells || {}).some(s => s.mods && ['armor', 'power', 'sensor'].every(k => s.mods[k]))],
    ['jobs10', '接活', '完成 10 个委托', (pf) => (pf && grow(pf).jobsDone >= 10) || n('jobs') >= 10],
    ['keycard', '门禁', '用掉一张门禁卡', () => n('keys') >= 1],
    ['events', '见多识广', '遇到全部 5 种站内事件', () => has('events') >= 5],
    ['trap', '中招', '打开陷阱箱时触发警报', () => n('traps') >= 1],
    ['city', '换个城市', '用别的城市种子撤出来一次', () => n('otherCity') >= 1],
  ];
  const Ach = D.Ach = { LIST, state: st };
  Ach.check = function (pf) {
    let changed = false;
    for (const [id, name, , ok] of LIST) if (!st.got[id]) { let v = false; try { v = ok(pf); } catch (e) { v = false; } if (v) { st.got[id] = Date.now(); changed = true; if (D.UI && D.UI.toast) D.UI.toast('成就解锁 · ' + name); if (D.Sfx) D.Sfx.play('rare'); } }
    if (changed) save();
    return changed;
  };
  Ach.count = () => Object.keys(st.got).length;
  // 测试用：清空
  Ach.reset = () => { st.got = {}; st.n = {}; save(); };

  // ── 一趟结束：撤出 / 损毁、带回多少、从哪撤的
  const fr0 = D.finishRaid;
  D.finishRaid = function (R, ok) {
    const out = fr0.apply(this, arguments);
    try {
      if (!R.tut) {
        const s = R.city && R.city.stations[R.at], L = R.load || {};
        if (ok) { add('outs', 1); if (out && out.value > n('bestHaul')) st.n.bestHaul = out.value; if (s && s.tier >= 3) add('deep', 1); if (s && (s.exit === 'hidden' || s.secret)) add('hiddenOut', 1); if (s && s.tier >= 2 && L.gun && D.CARDS[L.gun] && D.CARDS[L.gun].free && L.melee && D.CARDS[L.melee].free && !(L.pas || []).some(Boolean)) add('lightOut', 1); if (R.pf && R.pf.seed && R.pf.seed !== 'LANCHUAN') add('otherCity', 1); }
        else add('deaths', 1);
        add('perfect', R.perfect || 0); add('crits', R.crits || 0); add('traps', R.traps || 0);
        for (const k of R.events5 || []) seen('events', k);
        save(); Ach.check(R.pf);
      }
    } catch (e) { /* 成就出错不影响结算 */ }
    return out;
  };
  // ── 击毁：累计台数、打过哪些首领
  const K = D.K || (D.K = {}), kx0 = K.onKillX;
  K.onKillX = function (S, e) {
    if (kx0) kx0(S, e);
    if (S.tut) return;
    if (!D.ENEMIES[e.kind].human) add('kills', 1);
    if (D.ENEMIES[e.kind].boss) seen('bosses', e.kind);
    if (n('kills') % 25 === 0 || D.ENEMIES[e.kind].boss) { save(); Ach.check(S.raid && S.raid.pf); }
  };
  // ── 用掉门禁卡
  const uk0 = D.useKey;
  D.useKey = function (R) { const r = uk0.apply(this, arguments); if (r !== false && R && !R.tut) { add('keys', 1); save(); Ach.check(R.pf); } return r; };
  // ── 存档里的进度：每 2 秒看一次
  let t = 0;
  Ach.tick = function (G, dt) { t -= dt; if (t > 0 || !G.pf) return; t = 2; Ach.check(G.pf); };

  // ── 成就页（据点"菜单"里）
  Ach.page = function () {
    const U = D.UI, got = st.got;
    const rows = LIST.map(([id, name, desc]) => `<div class="ach-row${got[id] ? ' got' : ''}"><b>${got[id] ? '★' : '☆'}</b><span class="ach-n">${name}</span><em>${desc}</em></div>`).join('');
    const el = U.modal('ach', `<h3>成就 <em class="dim">${Ach.count()} / ${LIST.length}</em></h3><div class="ach-list scroll">${rows}</div><div class="mfoot"><button class="btn sm primary" data-act="close">关闭</button></div>`);
    el.querySelector('[data-act=close]').onclick = () => { D.Sfx.play('click'); U.closeModal(); };
  };
})(D);
