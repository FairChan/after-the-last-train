/* 末班之后 · 小样二：快捷栏切换。C 回血 / V 护盾 / Z 手雷三个格子（X 是释放电容，见 ammo.js），每格可以选用背包里同一类的哪一种：
   点按 = 用选中的那种；按住 + 滚轮 = 换成同类的下一种（松手只换、不用）；按住一会儿，格子上方弹出这一类的清单和数量。
   没按着格子时滚轮照旧换手雷。选过的种类记在存档里（pf.useSel），下一趟还是它；选的那种用完了就自动用同类的下一种。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K || (D.K = {}), P = D.PAL, sfx = n => D.Sfx && D.Sfx.play(n);
  // 每格：按键动作、D.USE 里的 key 字母、没选过时的先后
  const SLOTS = {
    heal: { act: 'heal', letter: 'C', name: '回血', first: ['medkit', 'patch'] },
    cell: { act: 'shieldUse', letter: 'V', name: '护盾', first: ['cell', 'bigcell'] },
    nade: { act: 'nade', letter: 'Z', name: '手雷', first: ['frag', 'freeze', 'emp', 'smoke', 'flash'] },
  };
  D.QUICK = SLOTS;
  D.QUICK_HOLD = 0.22; // 按住多久弹出清单（秒）
  // 这一格有哪些种类（按先后），以后加的消耗品只要 key 字母对得上就自动进来
  D.quickKinds = slot => { const s = SLOTS[slot], rest = Object.keys(D.USE).filter(k => D.USE[k].key === s.letter && !s.first.includes(k)); return s.first.filter(k => D.USE[k]).concat(rest); };
  const cnt = (R, k) => D.Grid.count(R.bag, id => id === 'use:' + k);
  D.quickCount = cnt;
  D.quickOwned = (R, slot) => D.quickKinds(slot).filter(k => cnt(R, k) > 0);
  const selOf = R => R.useSel || (R.useSel = R.pf ? (R.pf.useSel || (R.pf.useSel = {})) : {});
  // 现在用哪种：选过且背包里还有就用它，不然用同类里排在最前、背包里有的
  D.pickUse = function (R, slot) { const own = D.quickOwned(R, slot), s = selOf(R)[slot] || (slot === 'nade' ? R.nadeSel : null); return own.includes(s) ? s : own[0] || null; };
  D.cycleUse = function (R, slot, dir) {
    const own = D.quickOwned(R, slot); if (!own.length) return null;
    const i = own.indexOf(D.pickUse(R, slot)), nx = own[(i + (dir > 0 ? 1 : own.length - 1)) % own.length];
    selOf(R)[slot] = nx; if (slot === 'nade') R.nadeSel = nx; return nx;
  };
  // 每帧（station.js 调）：处理按下 / 按住 / 滚轮 / 松开，返回这一帧要用的格子 { heal, cell, nade }
  K.quickStep = function (S, dt, inp) {
    const p = S.player, R = S.raid, q = p.quick || (p.quick = {}), fire = {};
    let heldSlot = null;
    for (const slot in SLOTS) {
      const a = SLOTS[slot].act, st = q[slot] || (q[slot] = { on: false, t: 0, spun: false });
      if (inp[a]) { st.on = true; st.t = 0; st.spun = false; }
      if (!st.on) continue;
      if (inp[a + 'Held']) {
        st.t += dt; if (!heldSlot) heldSlot = slot;
        if (inp.wheel && heldSlot === slot) { const k = D.cycleUse(R, slot, inp.wheel); st.spun = true; if (k) { K.text(S, p.x, p.y - 26, D.USE[k].name, D.UIC.hi); sfx('click'); } else sfx('nope'); }
      } else { st.on = false; if (!st.spun) fire[slot] = true; } // 松手：没滚过就用，滚过就只是换
    }
    if (!heldSlot && inp.wheel) { const k = D.cycleUse(R, 'nade', inp.wheel); if (k) { K.text(S, p.x, p.y - 26, D.USE[k].name, D.UIC.hi); sfx('click'); } } // 没按着格子：滚轮换手雷
    S.quickOpen = heldSlot && (q[heldSlot].t >= D.QUICK_HOLD || q[heldSlot].spun) ? heldSlot : null;
    return fire;
  };
})(D);
