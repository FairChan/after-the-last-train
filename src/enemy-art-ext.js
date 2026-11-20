/* 末班之后 · 小样二：第三批敌人的像素图、招式列表、刷新表（程序生成）
   enemies-ext.js 里的 110 种敌人：行为继承 base 指定的老敌人（爬行、飞行、炮台、人形……），
   图按 body（10 种外形）画，颜色和眼睛的颜色按名字的哈希挑。
   招式列表 = 基础敌人的招式 + 这一种独有的一条。
   刷新：没写 at 的，按 base 挑几种常见的站放进守卫表（权重低，老的敌人照旧是主力）。
   晚于 enemies-ext.js 和 foes.js 加载（foes.js 的 D.drawFoe 包一层：这些敌人自己画）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const R = D.RAMP, P = D.PAL;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const at = (r, i) => r[Math.max(0, Math.min(r.length - 1, i))];
  const SHADE = ['steel', 'rust', 'white', 'olive', 'gunmetal', 'copper', 'silver', 'green', 'blue', 'red', 'cloth', 'dark', 'yellow', 'magenta'];
  const EYES = ['#ff3047', '#ffd23a', '#3ee8ff', '#8dff6a', '#ff3d8b', '#ffb057', '#9b6bff'];
  const SIZE = { walker: [16, 22], flyer: [22, 18], crawler: [24, 16], turret: [22, 24], human: [14, 24], ball: [18, 18], bug: [22, 18], cart: [22, 18], tank: [24, 16], pod: [18, 22] };
  // 没写 at 的：按 base 挑站（权重 0.6）
  const AT = { crawler: ['ruin', 'nest', 'hospital'], drone: ['hangar', 'relay', 'datacenter'], sniper: ['factory', 'museum', 'checkpoint'], turret: ['factory', 'depot', 'bank'], bomber: ['ruin', 'nest', 'hangar'], medic: ['hospital', 'hangar', 'datacenter'], raider: ['market', 'armory', 'bank', 'cache'] };

  // ── 10 种外形（p 是画板，a 主色阶，b 点缀色阶，eye 是眼睛的颜色）
  const BODY = {
    walker(p, a, b, eye) { p.ell(8, 5, 5, 4, a, { spec: true }); p.rect(5, 5, 6, 2, eye, 1); p.box(4, 10, 9, 6, b, { r: 1 }); p.rect(4, 16, 3, 5, at(a, 1)); p.rect(9, 16, 3, 5, at(a, 1)); p.rect(3, 21, 4, 1, '#0b0a14'); p.rect(9, 21, 4, 1, '#0b0a14'); },
    flyer(p, a, b, eye) { p.line(1, 4, 21, 4, '#c8cdda'); p.line(2, 3, 20, 3, '#949fb6'); p.line(11, 4, 11, 6, '#949fb6'); p.ell(11, 11, 6, 5, a, { spec: true }); p.disc(11, 10, 1.5, eye, 1); p.rect(10, 15, 2, 3, at(b, 2)); },
    crawler(p, a, b, eye) { p.ell(12, 9, 7, 4, a, { spec: true }); p.ell(20, 8, 3, 3, a, { spec: true }); p.px(21, 7, eye, 1); for (let i = 0; i < 4; i++) { p.line(7 + i * 3, 10, 4 + i * 3, 15, at(b, 2)); p.line(14 + i * 2, 11, 17 + i * 2, 15, at(b, 2)); } },
    turret(p, a, b, eye) { p.box(3, 17, 18, 6, a, { r: 1 }); p.box(6, 8, 12, 9, b, { r: 1 }); p.rect(15, 10, 8, 2, '#2d3342'); p.px(9, 11, eye, 1); p.px(12, 11, eye, 1); },
    human(p, a, b, eye) { p.ell(7, 5, 3, 3, '#e9b383'); p.rect(5, 5, 5, 1, eye, 1); p.ell(7, 4, 4, 3, a, { spec: true }); p.box(2, 9, 10, 8, a, { r: 2 }); p.rect(0, 10, 2, 6, at(a, 2)); p.rect(4, 17, 3, 6, at(b, 2)); p.rect(8, 17, 3, 6, at(b, 2)); },
    ball(p, a, b, eye) { p.ell(9, 9, 8, 8, a, { spec: true }); p.rect(2, 9, 14, 2, at(b, 3)); p.disc(9, 6, 1.5, eye, 1); p.disc(9, 13, 1.2, at(b, 4)); },
    bug(p, a, b, eye) { p.ell(11, 10, 8, 5, a, { spec: true }); p.disc(19, 9, 3, at(b, 3)); p.line(21, 7, 24, 3, at(a, 3)); p.line(21, 11, 24, 15, at(a, 3)); p.px(20, 8, eye, 1); for (let i = 0; i < 3; i++) { p.line(5 + i * 4, 13, 2 + i * 4, 17, at(b, 2)); p.line(9 + i * 4, 13, 12 + i * 4, 17, at(b, 2)); } },
    cart(p, a, b, eye) { p.box(3, 6, 16, 9, a, { r: 1 }); p.rect(3, 6, 16, 2, at(b, 3)); p.disc(6, 16, 2, '#1d212c'); p.disc(16, 16, 2, '#1d212c'); p.line(18, 6, 20, 1, '#949fb6'); p.px(20, 0, eye, 1); p.px(9, 10, eye, 1); },
    tank(p, a, b, eye) { p.box(2, 11, 20, 6, a, { r: 2 }); p.rect(1, 15, 22, 3, '#1d212c'); p.box(6, 5, 10, 6, b, { r: 2 }); p.rect(15, 7, 7, 2, '#2d3342'); p.px(9, 7, eye, 1); for (let x = 2; x < 21; x += 3) p.px(x, 16, '#3d4766'); },
    pod(p, a, b, eye) { p.ell(9, 10, 7, 8, a, { spec: true }); p.ell(9, 8, 3, 3, R.glass, { spec: true }); p.line(5, 17, 3, 21, at(b, 3)); p.line(9, 18, 9, 22, at(b, 3)); p.line(13, 17, 15, 21, at(b, 3)); p.px(9, 9, eye, 1); },
  };

  // 天线（有的图顶上多一根，眼睛的颜色）
  const ANT = (p, w, eye) => { p.line(w - 5, 5, w - 5, 2, '#949fb6'); p.px(w - 5, 1, eye, 1); };

  // 图：initHiArt 时一起画（foes.js 的 S.stalker 等也是这时候画）
  const h0 = D.initHiArt;
  D.initHiArt = function () {
    const r = h0 ? h0.apply(this, arguments) : undefined;
    const S = D.SPR;
    for (const k in D.ENEMIES) {
      const E = D.ENEMIES[k];
      if (!E.body || !BODY[E.body] || S[k]) continue;
      const [w, h] = SIZE[E.body], a = R[SHADE[Math.floor(hash(k) * SHADE.length)]], b = R[SHADE[Math.floor(hash(k + '·b') * SHADE.length)]];
      const eye = EYES[Math.floor(hash(k + '·e') * EYES.length)], ant = hash(k + '·a') < 0.4;
      const p = D.Paint(w, h); BODY[E.body](p, a, b, eye); if (ant) ANT(p, w, eye); p.outline();
      S[k] = p.make(2);
    }
    return r;
  };

  // 数据加工（只碰 enemies-ext.js 写的那些：有 body 的）：招式 = 基础的 + 独有的；刷新表
  // 刷新权重：每座站里新敌人合起来约占原来守卫权重的一半，平分给各种（老敌人仍是主力）
  // 和原型比：耐久、速度、伤害、准头、视野、成群、掉落。只说数值上真有的差别
  const SIGHT0 = { sniper: 210, turret: 170, drone: 140, raider: 150, medic: 110, bomber: 120, crawler: 100 };
  function diffLine(E, B) {
    const out = [], r = (a, b) => b ? a / b : 1;
    const hp = r(E.hp, B.hp); if (hp >= 1.25) out.push('耐久高很多'); else if (hp >= 1.08) out.push('耐久高一些'); else if (hp <= 0.75) out.push('耐久低很多'); else if (hp <= 0.92) out.push('耐久低一些');
    if (B.speed > 0) { const sp = r(E.speed, B.speed); if (sp >= 1.2) out.push('快很多'); else if (sp >= 1.06) out.push('快一些'); else if (sp <= 0.8) out.push('慢很多'); else if (sp <= 0.94) out.push('慢一些'); }
    const dm = (E.dmgMul || 1) / (B.dmgMul || 1); if (dm >= 1.15) out.push('伤害高'); else if (dm > 1.02) out.push('伤害稍高'); else if (dm <= 0.85) out.push('伤害低'); else if (dm < 0.98) out.push('伤害稍低');
    const sr = (E.spreadMul || 1) / (B.spreadMul || 1); if (sr <= 0.92) out.push('打得更准'); else if (sr >= 1.08) out.push('打得更散');
    const s0 = B.sight || SIGHT0[E.base] || 120, si = r(E.sight || s0, s0); if (si >= 1.12) out.push('看得更远'); else if (si <= 0.88) out.push('看得更近');
    if ((E.pack || 1) > 1 && (B.pack || 1) <= 1) out.push('成群出现');
    if (E.loot > B.loot) out.push('掉得更多'); else if (E.loot < B.loot) out.push('掉得更少');
    return `和${B.name}的区别：${out.join(' · ') || '数值差不多'}`;
  }
  const perStation = {};
  for (const k in D.ENEMIES) {
    const E = D.ENEMIES[k];
    if (!E.body || E.gen) continue;
    E.gen = true;
    const B = D.ENEMIES[E.base];
    E.moves = (B && B.moves ? B.moves.slice() : []).concat(B ? [diffLine(E, B)] : []);
    if (E.threat) E.moves.push(`出没：威胁 ${E.threat} 级起，哪一站都有`); // 威胁专属敌人（enemies-threat.js）
    for (const st of E.at || AT[E.base] || []) if (D.GARRISON && D.GARRISON[st]) (perStation[st] = perStation[st] || []).push(k);
  }
  for (const st in perStation) {
    const G = D.GARRISON[st], old = G.reduce((s, c) => s + c[1], 0), ks = perStation[st];
    for (const k of ks) G.push([k, 0.5 * old / ks.length]);
  }

  // 画：这些敌人统一走 D.foePose（呼吸、走路、蓄势、挨打）；图按 D.SPR[kind] 找
  const df = D.drawFoe;
  D.drawFoe = function (ctx, ex, S, e, white, LT, H) {
    const E = D.ENEMIES[e.kind];
    if (E && E.gen && !e.phantom) {
      const x = e.x, y = e.y, tele = e.tele > 0, sx = tele && e.tele < 0.25 ? Math.round(Math.sin(S.t * 80)) * 0.5 : 0;
      H.actor(ctx, ex, D.SPR[e.kind], x + sx, y - (e.z || 0) + (tele ? 0.5 : 0), e.face < 0, white);
      if (tele && LT) LT(x, y - 10, 16, P.O, 0.5 + 0.5 * (1 - e.tele / (e.teleMax || 1)));
      return true;
    }
    return df ? df.apply(this, arguments) : false;
  };
})(D);
