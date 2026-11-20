/* 多个能按 F 的东西挤在一起（柜子挨着柜子、脚下掉了东西又站在柜子边、商人旁边就是配电柜……）
   以前 station.js 的交互是一条写死的先后顺序，排前面的一在范围里，后面的就看不到也按不到。
   现在：范围里能按 F 的都收成"候选"，选离你最近的那个（别的要明显更近才换过去，免得站在中间来回跳）；
   有两个以上时提示条后面写"还有 N 个"，按 T（设置里能改）轮流切，切过就一直选它，直到它出了范围；
   选中的那个头顶有个小箭头，看得出 F 会按在谁身上。
   收候选：station.js 的 interact()；各模块自己交候选：event.js（D.evSiteCands）、outpost.js（D.Outpost.cands）、
   story.js（D.Story.cands）、world.js / lift.js（K.candX）。
   候选：{ ref, x, y, d?, key: 'F' | '', text, prog?, go(inp)?, near? }
     ref  同一个东西每帧给同一个引用（记住选中的是谁）
     key  '' 只是一句说明（电梯没通电、信号收完了……），按 F 没用：范围里有能按的就不选它
     go   选中时每帧调一次，自己看 inp.interact / inp.interactHeld
     near 选中时写进 S.near（门禁柜的教学提示要看） */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  const STICK = 6; // 别的候选要比当前选中的近这么多（像素）才换过去
  const Pick = D.Pick = {
    STICK,
    list(S) {
      const C = [], p = S.player;
      C.add = c => { if (c.d == null) c.d = Math.hypot(c.x - p.x, c.y - p.y); C.push(c); return true; };
      return C;
    },
    // 从候选里挑一个：写 S.prompt、S.fpick（画箭头）、S.near，调它的 go。返回选中的候选（没有就 null）
    choose(S, C, inp) {
      inp = inp || {};
      const act = C.filter(c => c.key), pool = (act.length ? act : C).slice().sort((a, b) => a.d - b.d);
      const sel = S.fsel || (S.fsel = { ref: null, manual: false });
      S.fpick = null;
      if (!pool.length) { sel.ref = null; sel.manual = false; return null; }
      let cur = pool.find(c => c.ref === sel.ref);
      if (cur && inp.pick && pool.length > 1) { cur = pool[(pool.indexOf(cur) + 1) % pool.length]; sel.manual = true; if (D.Sfx) D.Sfx.play('click'); }
      else if (!cur) { cur = pool[0]; sel.manual = false; }
      else if (!sel.manual && pool[0] !== cur && pool[0].d < cur.d - STICK) cur = pool[0];
      sel.ref = cur.ref;
      S.prompt = { key: cur.key, text: cur.text, prog: cur.prog, more: act.length > 1 ? act.length - 1 : 0 };
      if (act.length > 1 && cur.key) S.fpick = { x: cur.x, y: cur.y, f: S.f };
      if (cur.near) S.near = cur.near;
      if (cur.go) cur.go(inp);
      return cur;
    },
    // 只看一个模块自己的候选（老接口 D.evSiteInteract、D.Outpost.interact、D.Story.interact 用；测试里直接调它们）
    solo(S, inp, fill) { const C = Pick.list(S); fill(S, C.add); if (!C.length) return false; Pick.choose(S, C, inp); return true; },
  };

  // 选中的那个头顶画一个往下指的小箭头（界面标记，和楼梯口的箭头一样直接画）；只有两个以上能按的才画
  const do0 = D.drawOver;
  D.drawOver = function (S, ctx, ex) {
    if (do0) do0(S, ctx, ex);
    const m = S.fpick; if (!m || m.f !== S.f || S.lootOpen) return;
    const x = Math.round(m.x), y = Math.round(m.y - 26 + Math.sin((S.t || 0) * 5) * 1.5);
    ctx.fillStyle = '#0b0a14'; ctx.beginPath(); ctx.moveTo(x - 5, y - 1); ctx.lineTo(x + 5, y - 1); ctx.lineTo(x, y + 5); ctx.fill();
    ctx.fillStyle = '#ffb057'; ctx.beginPath(); ctx.moveTo(x - 3.5, y); ctx.lineTo(x + 3.5, y); ctx.lineTo(x, y + 3.5); ctx.fill();
    ctx.fillStyle = '#fff1c8'; ctx.fillRect(x - 2, y, 2, 1);
    ex.fillStyle = D.rgba ? D.rgba('#ffb057', 0.8) : '#ffb057'; ex.beginPath(); ex.moveTo(x - 3.5, y); ex.lineTo(x + 3.5, y); ex.lineTo(x, y + 3.5); ex.fill();
  };
})(D);
