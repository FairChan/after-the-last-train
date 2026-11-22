/* 末班之后 · 小样二：结算页（撤离成功 / 工壳损毁）重做。用户 2026-11-17："撤离成功撤离失败的页面请你重做"。
   旧页（ui-raid.js 的 U.result）是一列居中：大格子名字一长就叠到隔壁、品质字被切、提示一多标题被顶出画面。
   新页铺满 640×360 舞台，分三层：
     上：左边标题 + 一句话，右边大号的带回价值 / 损失价值（数字滚上去）；
     中：一条小块——站数、警戒、件数、途中卖出（联机的小队表插在这条后面，mp-coop.js 找 .over-wrap .stats）；
     下：左边清单（一行一件：品质色条、图标、名字（长了省略、悬停看全名）、数量、价值；失败时下面多一块"保险箱保住的"），
         右边消息卡片（解锁出发站、熟练度、委托、工壳带伤 / 留在城里、仓库满了……沿用原来的句子，英文已有）；
     底：回据点。
   这里只覆盖 U.result，不动 ui-raid.js（那个文件别的会话在改）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, { esc, hideTip, infoIcon } = X;
  let root, G;
  X.hooks.init.push((r, g) => { root = r; G = g; });
  const $ = s => root.querySelector(s);
  const val = e => Math.round(D.itemInfo(e.id).v * (e.n || 1));

  function row(e, i, cls) {
    const it = D.itemInfo(e.id);
    return `<div class="ovr-it q${it.q}${cls ? ' ' + cls : ''}" style="--i:${Math.min(i, 24)}" ${X.tipAttr(e.id, e.n || 1)}>`
      + `<img src="${infoIcon(it)}"><span class="oi-n">${esc(it.name)}</span>${e.n > 1 ? `<em>×${e.n}</em>` : ''}`
      + `<b><i class="ico-gold"></i>${val(e)}</b></div>`;
  }

  U.result = function (out, R) {
    U.clear(); root.className = 'm-over' + (out.ok ? ' won' : '');
    const ok = out.ok, items = (ok ? out.brought : out.lost).slice().sort((a, b) => D.itemInfo(b.id).q - D.itemInfo(a.id).q || val(b) - val(a));
    const pcs = items.reduce((s, e) => s + (e.n || 1), 0);
    const safe = !ok && out.safe && out.safe.length ? out.safe.map(id => ({ id, n: 1 })) : [];

    // 消息卡片：原来的提示句子原样搬过来（英文词典里都有），只是换成卡片排在右边
    const notes = [
      out.newEntry != null ? `<div class="hint ok big">解锁了新的出发站：<b>${esc(R.city.stations[out.newEntry].name)}</b>。以后在据点"出发"页能直接从这里进城</div>` : '',
      U.resultGrowHTML ? U.resultGrowHTML(out) : '',
      out.lostShell ? `<div class="hint warn">${D.SHELLS[out.lostShell].name}留在了城里。下次只能开租来的工壳，或者去机库再买一台。</div>` : '',
      ok && out.cond != null && out.cond < 1 ? `<div class="hint warn">${D.SHELLS[R.shell].name}带伤回来（${Math.round(out.cond * 100)}%），去机库修一下。</div>` : '',
      out.cut ? `<div class="hint">按约定，阿隼拿走了这趟的两成：-${out.cut}</div>` : '',
      out.overflow ? `<div class="hint warn">仓库满了，有 ${out.overflow} 件放不下，按半价卖掉了（+${out.overflowSold || 0}）。下次出发前记得整理仓库。</div>` : '',
    ].join('');

    const stat = (n, label, cls) => `<div class="ovr-st${cls ? ' ' + cls : ''}"><b>${n}</b><span>${label}</span></div>`;
    root.innerHTML = `<div class="over-wrap ovr${ok ? ' ok' : ' bad'}">
      <div class="ovr-head">
        <div class="ovr-tt"><small>${ok ? '撤离' : '信号中断'} · ${esc(out.station)}</small><h1>${ok ? '撤离成功' : '工壳损毁'}</h1>
          <div class="sub">${ok ? `接驳车驶出${esc(out.station)}。战利品进了南栈的仓库，弹药和药留在背包里；这个站以后也能当入口。` : `中继在${esc(out.station)}断开。背包、背包里的东西和装上的卡都留在了城里。`}</div></div>
        <div class="ovr-val"><span>${ok ? '带回价值' : '损失价值'}</span><b><i class="ico-gold"></i><em data-to="${Math.round(out.value)}">0</em></b></div>
      </div>
      <div class="stats">${stat(R.stations, '站')}${stat(R.alert.toFixed(1), '警戒')}${stat(pcs, ok ? '件带回' : '件丢失')}${R.sold ? stat(Math.round(R.sold), '途中卖出', 'gold') : ''}</div>
      <div class="ovr-body">
        <div class="ovr-loot">
          <h4>${ok ? '带回的东西' : '丢在城里的'}<em>${items.length} 组</em></h4>
          <div class="ovr-list">${items.length ? items.map((e, i) => row(e, i)).join('') : `<div class="ovr-empty">${ok ? '空手回来，人没事就好。' : '什么也没丢。'}</div>`}</div>
          ${safe.length ? `<h4 class="safe">保险箱保住的<em>${safe.length} 件</em></h4><div class="ovr-list safe">${safe.map((e, i) => row(e, i, 'kept')).join('')}</div>` : ''}
        </div>
        <div class="ovr-notes">${notes || `<div class="ovr-empty">${ok ? '这趟没有别的消息。' : '下次带上保险箱里放得下的贵东西。'}</div>`}</div>
      </div>
      <div class="ov-foot"><button class="btn primary" data-act="back">回据点</button></div></div>`;
    $('[data-act=back]').onclick = () => { D.Sfx.play('click'); G.toHub('stash'); };

    // 价值数字滚上去（0.7 秒，阶梯式，像素风）
    const num = $('.ovr-val em'), to = +num.dataset.to, t0 = performance.now();
    const tick = now => { if (!num.isConnected) return; const u = Math.min(1, (now - t0) / 700), k = Math.floor(u * 14) / 14; num.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (u < 1) requestAnimationFrame(tick); };
    if (to > 0 && typeof requestAnimationFrame === 'function') requestAnimationFrame(tick); else num.textContent = to;
    hideTip();
  };
})(D);
