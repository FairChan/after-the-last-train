/* Underdog · 物品介绍卡片。鼠标停在物品上时，提示框不再是一行字，而是一张标准的卡：
     头：图标 + 名字（品质色）+ "品质 · 分类"
     身：描述；属性表（枪、近战、模块、消耗品、弹药、背包各有自己的几项）；特别标注（线路特产、首领战利品、用于哪个设施 / 配方、委托要用）
     脚：价值（金币图标）、占几格、一组几个；这一格特有的操作提示（右键卸下、单击捡起……）
   格子上用 U._.tipAttr(id, n, 说明) 写 data-item；ui.js 的 showTip 看到 data-item 就调 U.itemCard。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const U = D.UI, X = U._, esc = X.esc;
  const fx = (v, d) => { const k = Math.pow(10, d || 0); return String(Math.round(v * k) / k); };

  // 这样东西用在哪：设施升级、工作台配方（同一档同一类的配方用一样的材料，合成一条）
  let uses = null;
  function usesOf(id) {
    if (!uses) {
      uses = new Map(); const add = (k, s) => { if (!uses.has(k)) uses.set(k, []); if (!uses.get(k).includes(s)) uses.get(k).push(s); };
      for (const f in D.FAC || {}) D.FAC[f].lv.forEach((L, i) => { for (const [m] of L.mats || []) add(m, D.FAC[f].name + '升 ' + (i + 1) + ' 级'); });
      const gear = (T, names, what) => { for (const k in T || {}) { const r = D.recipe && D.recipe(k); if (r) for (const [m] of r.mats || []) add(m, '做' + D.QUALITY[r.q].name + (names[T[k].slot] || '') + what); } };
      gear(D.ATT, D.ATT_SLOTS || {}, '配件'); gear(D.RMOD, D.RMOD_SLOTS || {}, '改装件');
    }
    return uses.get(id) || [];
  }
  const ammoGuns = cal => Object.keys(D.CARDS).filter(k => D.CARDS[k].gun && D.CARDS[k].gun.cal === cal).map(k => D.CARDS[k].name);

  U.itemCard = function (id, n, extra) {
    const it = D.itemInfo(id), Q = D.QUALITY[it.q] || D.QUALITY[0], pf = D.Game && D.Game.pf;
    let sub = '', desc = it.desc || '', stats = [], marks = [], hints = [];
    switch (it.kind) {
      case 'card': {
        const c = D.CARDS[it.card]; sub = D.SLOT_NAME[c.slot] + '卡'; desc = c.desc;
        if (c.gun) {
          const g = (D.gunOf && pf ? D.gunOf(pf, it.card) : null) || c.gun;
          stats = [['伤害', fx(g.dmg, 1) + (g.n > 1 ? ' ×' + g.n : '')], ['弹匣', g.mag], ['射速', fx(1 / g.rate, 1) + ' 发/秒'], ['换弹', fx(g.reload, 1) + ' 秒'], ['口径', D.CALIBER[g.cal].name], ['每秒伤害', fx(g.dmg * (g.n || 1) / g.rate, 0)]];
        } else if (c.melee) stats = [['伤害', c.melee.dmg], ['出手间隔', fx(c.melee.cd, 2) + ' 秒'], ['距离', c.melee.range], ['扇面', Math.round(c.melee.arc * 114.6) + '°']];
        else if (c.slot === 'mod') stats = [['冷却', c.cd + ' 秒'], ['按键', 'Q / E']];
        break;
      }
      case 'use':
        sub = '消耗品';
        stats = [it.heal && ['回复', it.heal + ' 耐久'], it.shield && ['护盾', '+' + it.shield], it.buff && ['持续', it.buff + ' 秒'], it.time && ['读条', it.time + ' 秒'], it.cd && ['冷却', it.cd + ' 秒'], it.key && ['按键', it.key]].filter(Boolean);
        desc = String(desc).replace(/^Z 扔向准星[：:]?/, '扔向准星：');
        break;
      case 'ammo': {
        const C = D.CALIBER[it.cal], T = D.AMMO_TIER[it.tier], guns = ammoGuns(it.cal);
        sub = '弹药'; desc = '换弹时自动从背包里拿；B 换弹种。';
        stats = [['口径', C.name], ['等级', T.name], ['伤害', '×' + T.mul], ['一组', C.pack + ' 发']];
        if (guns.length) marks.push(['适用', guns.slice(0, 4).join('、') + (guns.length > 4 ? ' 等 ' + guns.length + ' 把' : '')]);
        break;
      }
      case 'bag': { const B = D.BAGS[it.bag]; sub = '背包'; desc = ''; stats = [['容量', B.gw + '×' + B.gh + ' 格']]; break; }
      case 'armor': ({ sub, desc, stats } = D.Armor.card(id)); break;
      case 'clue': sub = '线索'; break;
      case 'quest': sub = '委托物'; break;
      case 'att': sub = (D.ATT_SLOTS[it.slot] || '') + '配件'; break;
      case 'rmod': sub = (D.RMOD_SLOTS[it.slot] || '') + '改装件'; break;
      case 'bp': sub = '蓝图'; break;
      case 'job': sub = '委托包裹'; break;
      default: {
        const I = D.ITEMS[id] || {};
        if (D.isKey && D.isKey(id)) { sub = '门禁卡'; desc = '开 ' + D.KEY_LEVEL[id] + ' 级以下的门禁房和门禁柜，用一次就没了。放进门禁卡包，死了也不丢。'; break; }
        sub = D.CAT_NAME[it.cat] || '杂物';
        if (I.line && D.LINE_THEMES && D.LINE_THEMES[I.line]) marks.push(['特产', D.LINE_THEMES[I.line].name + '的特产']);
        if (/^tr_/.test(id)) marks.push(['首领', '只从镇守首领身上掉']);
        const u = usesOf(id); if (u.length) marks.push(['用于', u.slice(0, 3).join('、') + (u.length > 3 ? ' 等 ' + u.length + ' 处' : '')]);
      }
    }
    { const how = D.combatHow && D.combatHow(id); if (how) marks.unshift(['直接用', how, 'use']); } // 战斗用品（gear.js）
    // 这一格特有的说明：委托 / 设施要用（橙色）、卖价（放到脚上）、操作提示（灰色）
    let sell = null;
    for (const s of String(extra || '').split('｜').filter(Boolean)) { const m = s.match(/^卖价 (\d+)/); if (m) sell = +m[1]; else if (/要$|要用|委托/.test(s)) marks.push(['需要', s]); else hints.push(s); }
    const tierQ = it.kind === 'clue' || it.kind === 'quest' || it.kind === 'bp' || it.kind === 'job' ? '' : Q.name + ' · ';
    const st = stats.map(([k, v]) => `<div class="tc-s"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
    const mk = marks.map(([k, v, c]) => `<div class="tc-m${c ? ' ' + c : ''}"><em>${esc(k)}</em>${esc(v)}</div>`).join('');
    const size = it.w && it.h ? it.w + '×' + it.h + ' 格' : '', stack = it.stack > 1 ? '一组 ' + it.stack : '';
    const val = it.v != null ? (n > 1 && it.kind !== 'ammo' ? `${it.v} ×${n} = ${Math.round(it.v * n)}` : it.kind === 'ammo' ? `${fx(it.v, 1)} / 发` : String(it.v)) : '';
    const html = `<div class="tc-h"><div class="tc-ic"><img src="${X.infoIcon(it)}"></div><div class="tc-t"><div class="tc-nm">${esc(it.name)}${n > 1 ? ` <i>×${n}</i>` : ''}</div><div class="tc-sub">${esc(tierQ + sub)}</div></div></div>`
      + (desc ? `<div class="tc-d">${esc(desc)}</div>` : '')
      + (st ? `<div class="tc-st">${st}</div>` : '') + mk
      + (hints.length ? `<div class="tc-hint">${hints.map(esc).join(' · ')}</div>` : '')
      + `<div class="tc-f"><span>${val ? `<i class="ico-gold"></i>${esc(val)}` : ''}</span><span>${[size, stack].filter(Boolean).join(' · ')}</span>${sell != null ? `<span class="tc-sell">卖 <i class="ico-gold"></i>${sell}</span>` : ''}</div>`;
    return { html, col: Q.col };
  };
})(D);
