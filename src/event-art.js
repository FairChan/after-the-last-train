/* 末班之后 · 未知信号站：站里的人和信号（画法）。
   数据和规则在 event.js（S.evObjs：NPC、未知信号）。挂在 D.drawExtras 上，和站里别的东西一起按脚底排序画。
   人身上没有字：走近了底下的提示会说他是谁；头顶的小光点是他的颜色（和人类据点一样）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const TAU = Math.PI * 2;
  // 六个人的外观：皮肤、头发、上衣、裤子；tag 是头顶光点的颜色（和 npc-metro.js 的 col 一致）
  const LOOK = {
    clerk:    { skin: '#c99a72', hair: '#e5e1d8', top: '#5c5a3e', bot: '#3a3424', tag: '#d9a441' },
    busker:   { skin: '#f0c39c', hair: '#c04a7a', top: '#3c3c48', bot: '#24242c', tag: '#e06c9f' },
    scrapper: { skin: '#b98a63', hair: '#8a8a8a', top: '#4a6a3a', bot: '#3b3026', tag: '#8fbf6a' },
    kid:      { skin: '#f2c9a0', hair: '#3a2a1a', top: '#7fb8ff', bot: '#4a4a6a', tag: '#7fb8ff' },
    defector: { skin: '#d8a882', hair: '#222222', top: '#6a2a2a', bot: '#2a2a2a', tag: '#c85a4a', bandage: true },
    radio:    { skin: '#8b6a4e', hair: '#333333', top: '#2e3a4a', bot: '#1e2530', tag: '#3ee8ff' },
  };
  const DEF = LOOK.clerk;

  // 一个人：脚底在 (x, y)。站着微微晃，头顶的小光点一闪一闪
  function person(ctx, ex, o, t) {
    const L = LOOK[o.npc] || DEF;
    const X = Math.round(o.x), Y0 = Math.round(o.y), Y = Y0 + Math.round(Math.sin(t * 2 + o.x * 0.1) * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(X - 5, Y0 - 1, 10, 2);                    // 影子
    ctx.fillStyle = L.bot; ctx.fillRect(X - 3, Y - 7, 2, 7); ctx.fillRect(X + 1, Y - 7, 2, 7); // 腿
    ctx.fillStyle = L.top; ctx.fillRect(X - 4, Y - 16, 8, 10); ctx.fillRect(X - 5, Y - 15, 1, 8); ctx.fillRect(X + 4, Y - 15, 1, 8); // 身子和胳膊
    if (L.bandage) { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(X - 4, Y - 12, 8, 1); ctx.fillRect(X - 5, Y - 9, 1, 1); } // 绷带
    ctx.fillStyle = L.skin; ctx.fillRect(X - 3, Y - 23, 6, 7);                                 // 头
    ctx.fillStyle = L.hair; ctx.fillRect(X - 3, Y - 23, 6, 2); ctx.fillRect(X - 3, Y - 22, 1, 3); ctx.fillRect(X + 2, Y - 22, 1, 3);
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(X - 2, Y - 19, 1, 1); ctx.fillRect(X + 1, Y - 19, 1, 1); // 眼睛
    ex.fillStyle = L.tag; ex.fillRect(X - 1, Y - 27 + Math.round(Math.sin(t * 3 + o.x) * 0.8), 2, 2); // 头顶的小光点
  }

  // 未知信号：立杆上一个灯箱。没用过的时候灯闪、地上冒光圈；用过了变灰
  function signal(ctx, ex, o, t) {
    const X = Math.round(o.x), Y = Math.round(o.y), on = !o.used, col = on ? '#3ee8ff' : '#4a5260';
    ctx.fillStyle = '#0b0a14'; ctx.fillRect(X - 4, Y - 3, 8, 3);                               // 底座
    ctx.fillStyle = '#2f3550'; ctx.fillRect(X - 3, Y - 3, 6, 2);
    ctx.fillStyle = '#0b0a14'; ctx.fillRect(X - 1, Y - 22, 2, 19);                             // 立杆
    ctx.fillStyle = '#4a5374'; ctx.fillRect(X, Y - 22, 1, 18);
    ctx.fillStyle = '#0b0a14'; ctx.fillRect(X - 3, Y - 27, 6, 5);                              // 灯箱
    ctx.fillStyle = on && (t * 3 | 0) % 2 ? '#bffaff' : col; ctx.fillRect(X - 2, Y - 26, 4, 3);
    if (on) for (let i = 0; i < 2; i++) { // 地上的光圈一圈圈往外扩
      const u = (t * 0.7 + i / 2) % 1, r = 3 + u * 12;
      ex.strokeStyle = D.rgba(col, 1 - u); ex.lineWidth = 0.5;
      ex.beginPath(); ex.ellipse(X, Y, r, r / 2, 0, 0, TAU); ex.stroke();
    }
  }

  // 挂在 D.drawExtras 上（outpost-art.js 也挂了一层，这里接在它后面）
  const de0 = D.drawExtras;
  D.drawExtras = function (S, list, ctx, ex) {
    const r = de0 ? de0.apply(this, arguments) : undefined;
    for (const o of S.evObjs || []) {
      if (o.f !== S.f) continue;
      if (o.kind === 'npc') list.push({ y: o.y, f: () => person(ctx, ex, o, S.t) });
      else if (o.kind === 'sig') list.push({ y: o.y, f: () => signal(ctx, ex, o, S.t) });
    }
    return r;
  };
})(D);
