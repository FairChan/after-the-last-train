/* 末班之后 · 未知信号站：和人说话、调查未知信号。逻辑在 event.js（talkOpen / talkChoose / talkClose），
   这里把当前这一步排成一串话交给 talk-bubble.js 演：人说的话冒在头顶，叙述是旁白，选项条在下面（不再是面板）。
   U.talkRender(S)：按 S.talk 现在的样子（上一次选的结果、这个节点的话和选项）重新排一串；
   main.js 的 talk 事件和自动玩家（选完一项）都调它。演完了（结果看完、没有下一句）就关掉对话。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, tr = s => (D.tr ? D.tr(s) : s);
  const B = () => D.TalkB;

  const names = list => list.map(g => tr(D.itemInfo(g.id).name) + (g.n > 1 ? ' ×' + g.n : '')).join(tr('、'));

  // 选了一项的结果：结果那句、揭开了几个站、拿到了什么、放不下的
  function resSteps(T) {
    const res = T.res; if (!res) return [];
    const out = B().split(res.text, T.kind === 'sig');
    if (res.revealed) out.push({ k: 'narr', t: tr('线路图上揭开了 ' + res.revealed + ' 个站') });
    if (res.got.length) out.push({ k: 'narr', t: tr('得到：') + names(res.got) });
    if (res.left.length) out.push({ k: 'narr', t: tr('背包放不下，留在了原地：') + names(res.left) });
    return out;
  }
  // 这个节点的话和选项（对话结束了就没有）
  function nodeSteps(S) {
    const T = S.talk; if (!T || T.done) return [];
    const R = S.raid, node = T.ev.E, out = [];
    for (const p of [].concat(node.text || [])) out.push(...B().split(p, T.kind === 'sig'));
    const opts = node.choices.map(c => {
      const cost = c.cost && !/\d/.test(c.sub || '') ? c.cost : 0;
      return { t: B().label(c.t, c.sub), ok: D.choiceOK(R, c), cost };
    });
    out.push({ k: 'choice', opts, pick: i => pick(S, i) });
    return out;
  }
  function pick(S, i) {
    const out = D.talkChoose(S, i); if (!out) return false;
    if (out.fight) { // 打起来了：对话收掉，横幅说一句
      D.talkClose(S); U.closePanel(S); S.banner = { t: 0, text: '伏击', sub: out.text || '站台两头冒出了东西！' }; if (D.Sfx) D.Sfx.play('slam'); return null;
    }
    if (out.got.length && D.Sfx) D.Sfx.play('pick');
    return resSteps(S.talk).concat(nodeSteps(S));
  }

  U.talkRender = function (S) {
    const T = S && S.talk; if (!T) return;
    const steps = [];
    if (!T.R) { // 刚开口：第一次见这个人，先交代一句他是谁；未知信号先报标题
      if (T.kind === 'npc' && T.obj.talked === 1 && T.tag) steps.push({ k: 'narr', t: tr(T.name) + ' · ' + tr(T.role) + tr('：') + tr(T.tag) });
      if (T.kind === 'sig' && T.ev.E.title) steps.push({ k: 'narr', t: tr('未知信号') + ' · ' + tr(T.ev.E.title) });
    }
    steps.push(...resSteps(T), ...nodeSteps(S));
    const head = T.kind === 'sig' ? 30 : 25;
    T.R = B().run(S, { name: T.name, col: T.col, obj: T.obj, head }, steps, { onDone: () => { if (S.talk === T) D.talkClose(S); } });
  };
})(D);
