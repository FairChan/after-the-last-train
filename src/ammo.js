/* 末班之后 · 小样二：子弹袋、分段弹匣、超级弹、弹药 HUD。
   - 子弹袋：5×1 的格子，只放弹药，跟着人走（存在存档里，像门禁卡包）；死了袋里的子弹一起丢，撤出来留着。
   - 换弹的顺序：先从子弹袋里从左到右找同口径的那一组，拿完一组再拿下一组；袋里没有了才从背包拿（背包里还按 B 选的等级）。
     袋里的顺序就是打出去的顺序，拖动就能调。
   - 弹匣分段：R.magSeg = [[等级, 发数], ...]，前面的先打。等级 'S' 是超级弹。
   - 电容：近战每下、子弹按伤害（超级弹不算）、击毁一台都充电（K.capGain，数值在 D.SHELL）。
   - 超级弹：电容满了按 X 释放（2026-11-15 前是满了自动放）：弹匣补满、整匣变成超级弹（青色、穿透、伤害 ×1.8），
     放的时候有冲击波、电弧、闪光、震屏，子弹条闪一下；电容清零，接着再蓄。没满按 X 只响一声。超级弹换枪时不退回背包。
   - HUD：电容条分四格、带闪电图标，满了框跟着闪、右边亮一个 X；子弹一颗颗按等级上色，超级弹是青色还会闪；弹匣大（66 发以上）排成两三行小子弹，三百发以上才画成一整条、每 10 发一道刻度。
   只通过挂钩接进 raid.js（D.loadMag / pickTier / ammoTiers / finishRaid）、loot.js（D.equipCard）、player.js（fire 里的 D.magFront / magPop）、
   arms.js（K.armsPre）、draw.js（D.drawAmmoHud）、save.js、ui-*.js（子弹袋的格子）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const P = D.PAL, K = D.K || (D.K = {}), Gr = () => D.Grid;
  const sfx = n => D.Sfx && D.Sfx.play(n);
  D.POUCH = [5, 1];
  D.SUPER_MUL = 1.8;
  D.isAmmo = id => typeof id === 'string' && id.startsWith('ammo:');
  D.pouchOf = pf => pf.pouch || (pf.pouch = Gr().make(D.POUCH[0], D.POUCH[1]));
  D.kitAmmo = (pf, cal) => { const a = Gr().ammo(pf.kit, cal), b = Gr().ammo(D.pouchOf(pf), cal); return a.map((v, i) => v + b[i]); }; // 据点里：背包 + 子弹袋
  const pouchR = R => R.pouch || (R.pf ? (R.pouch = D.pouchOf(R.pf)) : null);
  D.pouchR = pouchR;

  // ── 下一发从哪拿：子弹袋从左到右（同口径），再背包（B 选的等级，没有就拿最高的）
  D.nextAmmo = function (R, cal) {
    const Pc = pouchR(R);
    if (Pc) { const e = Pc.items.filter(x => x.id.startsWith('ammo:' + cal + ':') && x.n > 0).sort((a, b) => a.y - b.y || a.x - b.x)[0]; if (e) return { g: Pc, e, tier: +e.id.split(':')[2], pouch: true }; }
    const have = Gr().ammo(R.bag, cal), want = R.ammoPick && R.ammoPick[cal]; let t = want && have[want] > 0 ? want : 0;
    if (!t) for (let k = D.AMMO_TIER.length - 1; k >= 1; k--) if (have[k] > 0) { t = k; break; } // 一级到五级（五级在 workshop.js 加）
    if (!t) return null;
    const e = R.bag.items.find(x => x.id === 'ammo:' + cal + ':' + t); return e ? { g: R.bag, e, tier: t, pouch: false } : null;
  };
  D.ammoTiers = (R, cal) => { const a = Gr().ammo(R.bag, cal), Pc = pouchR(R); if (Pc) { const b = Gr().ammo(Pc, cal); for (let i = 0; i < a.length; i++) a[i] += b[i]; } return a; };
  D.pickTier = (R, cal) => { const n = D.nextAmmo(R, cal); return n ? n.tier : 0; };

  // ── 捡到的东西进背包：子弹先进子弹袋（袋里有空位就进，从左到右用），放不下的再进背包。
  //    捡地上的、自动捡、搜刮箱子、事件给的（D.addToBag）都走这里（用户 2026-11-17：捡到子弹自动进子弹袋）。返回放不下的个数（同 Grid.add）。
  D.bagIn = function (R, id, n) {
    n = n == null ? 1 : n; const Pc = D.isAmmo(id) && pouchR(R); if (Pc) n = Gr().add(Pc, id, n);
    return Gr().add(R.bag, id, n);
  };
  // 从箱子这类格子拿一件进背包：弹药先进子弹袋（能进多少进多少），剩下的进背包。拿到了东西返回 true
  D.takeToBag = function (R, src, e) {
    let moved = false; const Pc = D.isAmmo(e.id) && pouchR(R);
    if (Pc && Gr().move(src, e, Pc)) moved = true;
    if (src.items.includes(e) && Gr().move(src, e, R.bag)) moved = true;
    return moved;
  };

  // ── 分段弹匣
  const segSum = R => (R.magSeg || []).reduce((s, x) => s + x[1], 0);
  function heal(R) { if (!R.magSeg || segSum(R) !== R.mag) R.magSeg = R.mag > 0 ? [[R.magTier || 1, R.mag]] : []; } // 别处直接改了 R.mag：按旧的单一等级补回来
  function sync(R) { const f = R.magSeg[0]; R.magTier = f && f[0] !== 'S' ? f[0] : (R.magSeg.find(x => x[0] !== 'S') || [R.magTier || 1])[0]; R.sup = R.magSeg.reduce((s, x) => s + (x[0] === 'S' ? x[1] : 0), 0); }
  function push(R, t, n) { const L = R.magSeg[R.magSeg.length - 1]; if (L && L[0] === t) L[1] += n; else R.magSeg.push([t, n]); }
  D.magFront = R => { heal(R); return R.magSeg.length ? R.magSeg[0][0] : (R.magTier || 1); };
  D.magPop = R => { if (!R.magSeg) return; const f = R.magSeg[0]; if (f) { f[1]--; if (f[1] <= 0) R.magSeg.shift(); } sync(R); }; // fire 里先减了 R.mag 再调这个，所以这里不能 heal
  D.loadMag = function (R, room) {
    const cal = D.gunCal(R); let got = 0; heal(R); if (!cal) return 0;
    while (room > 0) { const s = D.nextAmmo(R, cal); if (!s) break; const k = Math.min(room, s.e.n); s.e.n -= k; if (s.e.n <= 0) Gr().remove(s.g, s.e); push(R, s.tier, k); room -= k; got += k; }
    R.mag += got; sync(R); return got;
  };
  // 换枪：弹匣里的普通子弹按段退回背包（放不下的掉在脚边），超级弹不退
  const eq0 = D.equipCard;
  D.equipCard = function (S, k, put, slot) {
    const R = S.raid, p = S.player, c = D.CARDS[k]; slot = slot || (c && c.slot);
    const old = R.load[slot]; // 这个槽原来是枪：它的弹匣退回背包（手上那把是 R.magSeg，另一把在 R.mags 里，wslots.js）
    if (c && D.isWeaponSlot(slot) && D.isGun(old)) {
      const oc = D.CARDS[old].gun.cal, back = segs => { for (const [t, n] of segs) if (t !== 'S') { const left = Gr().add(R.bag, 'ammo:' + oc + ':' + t, n); if (left) D.dropAt(S, 'ammo:' + oc + ':' + t, left); } };
      if (D.gunKey(R) === slot) { if (p.mag > 0) { heal(R); back(R.magSeg); } p.mag = 0; R.mag = 0; R.magSeg = []; R.sup = 0; }
      else if (R.mags && R.mags[slot]) { back(R.mags[slot].seg || []); delete R.mags[slot]; }
    }
    return eq0(S, k, put, slot);
  };
  // 死了：子弹袋里的一起丢
  const fr0 = D.finishRaid;
  D.finishRaid = function (R, ok) {
    const Pc = !R.tut && pouchR(R), items = Pc ? Pc.items.map(e => ({ id: e.id, n: e.n })) : [];
    const out = fr0(R, ok);
    if (!ok && Pc && items.length) { out.lost.push(...items); out.value += items.reduce((s, e) => s + D.itemInfo(e.id).v * e.n, 0); Pc.items.length = 0; }
    return out;
  };

  // ── 电容充电：amt 是基础量，再乘"电容扩充"被动和改装件的电容充能；刚充满时飘字、亮一圈
  // 总的充电速度：2026-11-19 第三次减半（用户："X 能量条还是太容易累积了"）。乘在这里，近战、开枪、击毁、完美闪避、双节棍、弹反一起降；
  // 各来源的基础量还在 D.SHELL（data.js）。训练场不减：沙袋那一步还是 8 下充满
  D.CAP_RATE = 0.5;
  K.capGain = function (S, amt) {
    const p = S.player, R = S.raid; if (!p || !R || !(amt > 0) || p.hp <= 0) return;
    if (D.magFront && D.magFront(R) === 'S') return; // 超级弹没打完不充：以前新枪（arsenal-guns 两个文件）自己的弹体打中照样充，打一匣超级弹又攒回来
    if (!S.tut) amt *= D.CAP_RATE;
    const before = p.cap || 0; p.cap = Math.min(1, before + amt * (R.pas && R.pas.capx ? 1.5 : 1) * (D.fxOf ? D.fxOf(R).cap : 1));
    if (before < 1 && p.cap >= 1) { K.text(S, p.x, p.y - 26, 'CHARGED X', P.c); K.ring(S, p.x, p.y - 5, 16, P.c); sfx('power'); S.events.push({ type: 'charged' }); }
  };
  // ── 超级弹：电容满了按 X → 弹匣补满、整匣变超级弹，电容清零
  function superMag(S, gun) {
    const p = S.player, R = S.raid, x = p.x, y = p.y - 6; p.cap = 0;
    R.magSeg = [['S', gun.mag]]; R.mag = p.mag = gun.mag; sync(R); p.reload = 0; p.burstQ = 0; S.superT = S.t; // 记在这一站的时钟上：S.t 每站从 0 开始，记在 R 上换站后白闪会卡很久
    S.texts = S.texts.filter(t => t.s !== 'CHARGED X'); K.text(S, x, p.y - 30, 'SUPER ×' + gun.mag, P.c, true);
    for (const [r, c] of [[10, '#ffffff'], [18, P.C], [30, P.c], [46, P.c], [64, '#c8f8ff']]) K.ring(S, x, y, r, c); // 一圈圈往外的冲击波
    K.flashLight(S, x, y, 170, P.c, 1.6); K.addShake(S, 0.45);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + S.rng.range(-0.25, 0.25), d = S.rng.range(28, 46); S.bolts.push({ pts: K.zig(S, x, y, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7), t: 0.28 }); } // 往四周炸开的电弧
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, v = S.rng.range(70, 150); K.part(S, 'spark', x, y - 2, Math.cos(a) * v, Math.sin(a) * v * 0.7, 0.45, i % 2 ? P.c : P.C); }
    S.events.push({ type: 'super' }); sfx('power'); sfx('rail');
  }
  K.releaseCharge = function (S, gun) {
    const p = S.player; if (!gun || p.hp <= 0 || S.over) return false;
    if (p.cap < 1) { K.text(S, p.x, p.y - 26, 'NOT CHARGED', P[4]); sfx('nope'); return false; }
    superMag(S, gun); return true;
  };
  const ap0 = K.armsPre;
  K.armsPre = function (S, dt, inp, gun) {
    if (ap0) ap0(S, dt, inp, gun);
    if (inp && inp.charge) K.releaseCharge(S, gun); // X：释放电容
  };

  // ── 弹药 HUD（draw.js 调）：x 左边，by 子弹那一行的上沿（640×360 舞台像素）
  // ── 左下角：电容条 + 子弹条（2026-11-15 重画，用户："更新左下角子弹效果，提升美术效果"）
  //    子弹一颗颗画成子弹：按等级上色的弹头（左亮右暗）、黄铜弹壳、底缘；空位是凹下去的槽。
  //    开枪：打掉的那颗位置白闪一下，弹壳从那里蹦出来、转着落下去。换弹：新子弹半透明地一颗颗滑进来，换完一道亮光从左扫到右。
  //    子弹少了（四分之一以下）框边红色呼吸，打空了 R 闪。超级弹青色、冒小火星。
  //    电容条：四格能量，里面有一道亮光流过，充到哪格那里冒火星；满了整条闪、上下窜电弧，右边 X 键。
  const TIER_COL = [null, '#c8cbd6', '#5fd068', '#4a9dff', '#b36bff', '#ffc23d']; // 弹头颜色 = 物品品质色（一级灰、二级绿、三级蓝、四级紫、五级金）
  const mix = (a, b, k) => { const A = D.rgb(a), B = D.rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  const shade = new Map(), tone = (c, k) => { const key = c + k; if (!shade.has(key)) shade.set(key, k > 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k)); return shade.get(key); };
  function bolt(ctx, x, y, on, time) { // 小闪电图标
    const c = on ? P.c : '#2a5a66', R2 = (a, b, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + a, y + b, w, h); };
    R2(-1, -2, 12, 13, P.k);
    for (const [a, b, w] of [[5, -1, 3], [4, 1, 3], [3, 3, 5], [2, 5, 6], [5, 7, 2], [4, 9, 2]]) R2(a, b, w, 2, c);
    if (on) { R2(5, -1, 1, 2, '#e8fdff'); R2(3, 3, 1, 2, '#e8fdff'); if ((time * 6 | 0) % 3 === 0) R2(9, 2, 1, 1, '#ffffff'); }
  }
  function capBar(ctx, S, x, cy, time) {
    const p = S.player, R = S.raid, cap = Math.min(1, p.cap), sup = R.sup > 0, cx = x + 14, cw = 80, w = 18, h = 7;
    bolt(ctx, x, cy, cap > 0 || sup, time);
    ctx.fillStyle = P.k; ctx.fillRect(cx - 2, cy - 2, cw + 4, h + 4); ctx.fillStyle = '#1d3a46'; ctx.fillRect(cx - 1, cy - 1, cw + 2, 1);
    for (let i = 0; i < 4; i++) {
      const sx = cx + i * 20, k = D.clamp(cap * 4 - i, 0, 1), fw = Math.round(w * k);
      ctx.fillStyle = '#0b1a22'; ctx.fillRect(sx, cy, w, h); ctx.fillStyle = '#12303a'; ctx.fillRect(sx, cy + h - 1, w, 1);
      if (fw <= 0) continue;
      ctx.fillStyle = P.c; ctx.fillRect(sx, cy, fw, h); ctx.fillStyle = '#c8f8ff'; ctx.fillRect(sx, cy, fw, 1); ctx.fillStyle = '#1d8aa0'; ctx.fillRect(sx, cy + h - 2, fw, 2);
      const fl = Math.floor((time * 26 + i * 7) % (w + 8)) - 4; if (fl > -3 && fl < fw) { ctx.fillStyle = D.rgba('#ffffff', 0.55); ctx.fillRect(sx + Math.max(0, fl), cy + 1, Math.min(3, fw - Math.max(0, fl)), h - 3); } // 流过的一道亮光
      if (k < 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(sx + fw - 1, cy, 1, h); if ((time * 20 | 0) % 2) { ctx.fillStyle = '#c8f8ff'; ctx.fillRect(sx + fw, cy - 1 + ((time * 37 | 0) % (h + 2)), 1, 1); ctx.fillRect(sx + fw + 1, cy + ((time * 53 | 0) % h), 1, 1); } } // 充到这里：亮边 + 火星
    }
    if (sup) { ctx.fillStyle = D.rgba(P.c, 0.35 + 0.25 * Math.sin(time * 10)); ctx.fillRect(cx - 2, cy - 2, cw + 4, 1); ctx.fillRect(cx - 2, cy + h + 1, cw + 4, 1); }
    if (cap >= 1) { // 满了：整条闪，上下窜电弧，右边 X 键
      const k = 0.5 + 0.5 * Math.sin(time * 9); ctx.fillStyle = D.rgba('#ffffff', 0.12 + 0.28 * k); ctx.fillRect(cx, cy, cw - 2, h);
      const seed = (time * 14 | 0); ctx.fillStyle = '#c8f8ff';
      for (let a = 0; a < 2; a++) { let ax = cx + ((seed * 29 + a * 41) % (cw - 12)), ay = a ? cy - 2 : cy + h + 1; for (let s = 0; s < 10; s++) { ctx.fillRect(ax, ay, 1, 1); ax += 1; ay += ((seed + s * 7 + a) % 3) - 1; if (a === 0) ay = Math.min(ay, cy - 1); else ay = Math.max(ay, cy + h); } }
      const on = k > 0.5, bx = cx + cw + 4; ctx.fillStyle = P.c; ctx.fillRect(bx, cy - 3, 12, 12); ctx.fillStyle = on ? P.c : P.k; ctx.fillRect(bx + 1, cy - 2, 10, 10); ctx.fillStyle = on ? P.k : P.c;
      for (let i = 0; i < 8; i++) { ctx.fillRect(bx + 2 + i, cy - 1 + i, 2, 1); ctx.fillRect(bx + 8 - i, cy - 1 + i, 2, 1); }
    }
  }
  // 一颗子弹：弹头（按等级上色，尖一点）、弹壳、底缘
  function round(ctx, bx, by, pw, t, time, alpha, rh) {
    const tip = t === 'S' ? ((time * 10 | 0) % 2 ? '#c8f8ff' : P.c) : TIER_COL[t] || TIER_COL[1], caseC = t === 'S' ? '#7fb0c8' : '#b8873a';
    if (alpha != null) ctx.globalAlpha = alpha;
    const R2 = (a, b, w, h, c) => { if (w > 0 && h > 0) { ctx.fillStyle = c; ctx.fillRect(bx + a, by + b, w, h); } };
    if (rh && rh < 13) { // 弹匣大、排成两三行时的小子弹：弹头 + 弹壳 + 底缘，同样左亮右暗
      const th = rh >= 6 ? 2 : 1, ch = rh - th - 1;
      R2(0, 0, pw, th, tip); if (th > 1) R2(0, 0, pw, 1, tone(tip, 0.45)); if (pw >= 2) R2(pw - 1, 0, 1, th, tone(tip, -0.35));
      R2(0, th, pw, ch, caseC); if (pw >= 2) { R2(0, th, 1, ch, tone(caseC, 0.45)); R2(pw - 1, th, 1, ch, tone(caseC, -0.4)); }
      R2(0, rh - 1, pw, 1, tone(caseC, -0.5));
      if (t === 'S' && (time * 7 + bx + by) % 3 < 0.4) R2(pw >> 1, -1, 1, 1, '#ffffff');
      if (alpha != null) ctx.globalAlpha = 1;
      return;
    }
    R2(pw > 3 ? 1 : 0, 0, pw > 3 ? pw - 2 : pw, 1, tone(tip, 0.45)); R2(0, 1, pw, 4, tip); // 弹头
    if (pw >= 3) { R2(0, 1, 1, 4, tone(tip, 0.4)); R2(pw - 1, 1, 1, 4, tone(tip, -0.35)); }
    R2(0, 5, pw, 6, caseC); R2(0, 5, pw, 1, tone(caseC, -0.35)); // 弹壳 + 弹头和弹壳之间的一道缝
    if (pw >= 3) { R2(0, 6, 1, 5, tone(caseC, 0.45)); R2(pw - 1, 6, 1, 5, tone(caseC, -0.4)); }
    R2(0, 11, pw, 2, tone(caseC, -0.5)); R2(0, 11, pw, 1, tone(caseC, -0.2)); // 底缘
    if (t === 'S' && (time * 7 + bx) % 3 < 0.4) R2(pw >> 1, -2, 1, 1, '#ffffff'); // 超级弹冒火星
    if (alpha != null) ctx.globalAlpha = 1;
  }
  D.drawAmmoHud = function (ctx, S, x, by, time) {
    const p = S.player, R = S.raid, gun = D.gunId(R) ? D.gunOf(R.pf, D.gunId(R), R) : null;
    capBar(ctx, S, x, by - 17, time);
    if (!gun) return;
    const F = S._ammoFx || (S._ammoFx = { mag: null, lt: time, shells: [], hit: [], sweep: -1 }), dt = D.clamp(time - F.lt, 0, 0.1); F.lt = time;
    const n = gun.mag, segs = (R.magSeg && segSum(R) === p.mag) ? R.magSeg : (p.mag > 0 ? [[R.magTier || 1, p.mag]] : []);
    // 排法：66 发以内一行；再多排成两行、三行（每行矮一点），子弹窄到 1 像素宽、间隔 1；还放不下（三百发以上）才画成一整条
    const rows = Math.min(3, Math.ceil(n / 66)), per = Math.ceil(n / rows), big = per > 100, gap = per > 40 ? 1 : 2;
    const pw = big ? 0 : Math.max(1, Math.min(6, Math.floor((200 + gap) / per) - gap)), rh = rows === 1 ? 13 : Math.floor((13 - (rows - 1)) / rows);
    const wAll = big ? 200 : per * (pw + gap) - gap, slot = i => x + (i % per) * (pw + gap), row = i => by + Math.floor(i / per) * (rh + 1);
    // 开枪 / 换弹：和上一帧比
    if (F.mag != null && p.mag < F.mag && !big) for (let i = p.mag; i < F.mag && i < n; i++) { F.shells.push({ x: slot(i) + pw / 2, y: row(i) + Math.min(4, rh >> 1), vx: 18 + Math.random() * 30, vy: -60 - Math.random() * 45, t: 0 }); F.hit.push({ i, t: 0 }); }
    if (F.mag != null && p.mag > F.mag) F.sweep = 0;
    F.mag = p.mag;
    const low = p.mag > 0 && p.mag <= Math.max(2, Math.ceil(n * 0.25)), out = p.mag === 0 && !(p.reload > 0);
    // 弹匣框：低了红色呼吸，打空了红框闪
    const pulse = 0.5 + 0.5 * Math.sin(time * 8), fc = out ? ((time * 4 | 0) % 2 ? '#ff3d4a' : '#5a1820') : low ? mix('#2f3550', '#ff3d4a', pulse) : '#2f3550';
    ctx.fillStyle = P.k; ctx.fillRect(x - 3, by - 3, wAll + 6, 19); ctx.fillStyle = fc; ctx.fillRect(x - 3, by - 3, wAll + 6, 1); ctx.fillRect(x - 3, by + 15, wAll + 6, 1); ctx.fillRect(x - 3, by - 3, 1, 19); ctx.fillRect(x + wAll + 2, by - 3, 1, 19);
    ctx.fillStyle = D.rgba(fc, 0.9); ctx.fillRect(x - 5, by - 5, 4, 1); ctx.fillRect(x - 5, by - 5, 1, 4); ctx.fillRect(x + wAll + 1, by + 17, 4, 1); ctx.fillRect(x + wAll + 4, by + 14, 1, 4); // 两个角
    if (!big) {
      let i = 0;
      for (const [t, m] of segs) for (let j = 0; j < m && i < n; j++, i++) round(ctx, slot(i), row(i), pw, t, time, null, rh);
      const ghosts = p.reload > 0 ? Math.floor((1 - p.reload / p.reloadMax) * (n - i) + 0.001) : 0, nxt = D.nextAmmo ? D.nextAmmo(R, gun.cal) : null, gt = nxt ? nxt.tier : (R.magTier || 1);
      for (let g = 0; i < n; i++, g++) {
        const bx = slot(i), ry = row(i); ctx.fillStyle = '#141220'; ctx.fillRect(bx, ry, pw, rh); ctx.fillStyle = '#221e2e'; ctx.fillRect(bx, ry, pw, 1); ctx.fillStyle = '#0b0a14'; ctx.fillRect(bx, ry + rh - 1, pw, 1);
        if (g < ghosts) round(ctx, bx, ry - (g === ghosts - 1 ? (rows > 1 ? 1 : 2) : 0), pw, gt, time, g === ghosts - 1 ? 0.75 : 0.45, rh); // 换弹：一颗颗滑进来
        if (low && (time * 3 | 0) % 2 && !(p.reload > 0)) { ctx.fillStyle = D.rgba('#ff3d4a', 0.25); ctx.fillRect(bx, ry, pw, rh); }
      }
    } else { // 一整条：黄铜底 + 按等级的弹头色带 + 每十发一道
      ctx.fillStyle = '#141220'; ctx.fillRect(x, by, 200, 13);
      let at = 0; for (const [t, m] of segs) { const w = Math.max(0, Math.min(200 - at, Math.round(200 * m / n))), tip = t === 'S' ? P.c : TIER_COL[t] || TIER_COL[1]; ctx.fillStyle = '#b8873a'; ctx.fillRect(x + at, by + 4, w, 9); ctx.fillStyle = '#f0cf86'; ctx.fillRect(x + at, by + 4, w, 1); ctx.fillStyle = tip; ctx.fillRect(x + at, by, w, 4); ctx.fillStyle = tone(tip, 0.4); ctx.fillRect(x + at, by, w, 1); at += w; }
      for (let k = 10; k < n; k += 10) { ctx.fillStyle = '#00000090'; ctx.fillRect(x + Math.round(200 * k / n), by, 1, 13); }
    }
    // 打掉的那颗：白闪；弹壳蹦出来、转着落下
    for (const h of F.hit) { h.t += dt; if (h.t < 0.12 && !big) { ctx.fillStyle = D.rgba('#ffffff', 0.9 * (1 - h.t / 0.12)); ctx.fillRect(slot(h.i) - 1, row(h.i) - 1, pw + 2, rh + 2); } }
    F.hit = F.hit.filter(h => h.t < 0.12);
    for (const s of F.shells) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 330 * dt;
      ctx.globalAlpha = Math.max(0, 1 - s.t / 0.6); const spin = (s.t * 22 | 0) % 2;
      ctx.fillStyle = '#e0b060'; ctx.fillRect(Math.round(s.x), Math.round(s.y), spin ? 3 : 1, spin ? 1 : 3); ctx.fillStyle = '#7a5420'; ctx.fillRect(Math.round(s.x) + (spin ? 2 : 0), Math.round(s.y) + (spin ? 0 : 2), 1, 1);
      ctx.globalAlpha = 1;
    }
    F.shells = F.shells.filter(s => s.t < 0.6);
    // 换完 / 补满：一道亮光从左扫到右
    if (F.sweep >= 0) { const sx = x + Math.round(F.sweep * (wAll + 8)) - 4; ctx.fillStyle = D.rgba('#ffffff', 0.7); ctx.fillRect(Math.max(x, sx), by, Math.max(0, Math.min(3, x + wAll - Math.max(x, sx))), 13); F.sweep += dt / 0.32; if (F.sweep > 1) F.sweep = -1; }
    const since = S.superT != null ? S.t - S.superT : -1, flash = since >= 0 && since < 0.5 ? 1 - since / 0.5 : 0; // 刚放完电容（同一站内 0.5 秒）：整条白闪
    if (flash > 0) { ctx.fillStyle = D.rgba('#ffffff', 0.85 * flash); ctx.fillRect(x - 3, by - 3, wAll + 6, 19); }
    if (p.reload > 0) { // 换弹进度：黄色斜纹
      const rk = 1 - p.reload / p.reloadMax, w = Math.round(wAll * rk); ctx.fillStyle = P.k; ctx.fillRect(x - 1, by + 17, wAll + 2, 4); ctx.fillStyle = '#5a4a14'; ctx.fillRect(x, by + 18, wAll, 2);
      ctx.fillStyle = P.Y; ctx.fillRect(x, by + 18, w, 2); ctx.fillStyle = '#fff2b0'; for (let s = Math.floor(time * 30) % 6; s < w; s += 6) ctx.fillRect(x + s, by + 18, 2, 1);
      D.text(ctx, 'R', x + wAll + 7, by, P.Y, { scale: 2 });
    } else if (out && (time * 4 | 0) % 2) D.text(ctx, 'R', x + wAll + 7, by, '#ff5a64', { scale: 2 }); // 打空了：R 闪
  };
  // HUD 文字：现在打的是什么、弹匣 / 子弹袋 / 背包各多少
  D.ammoText = function (R, p) {
    if (!D.gunId(R)) return { name: '', col: '#ffffff', line: '', empty: false };
    const gun = D.CARDS[D.gunId(R)].gun, f = D.magFront(R), nx = D.nextAmmo(R, gun.cal), Pc = pouchR(R);
    const pc = Pc ? Gr().ammo(Pc, gun.cal).reduce((a, b) => a + b, 0) : 0, bc = Gr().ammo(R.bag, gun.cal).reduce((a, b) => a + b, 0);
    const name = f === 'S' ? '超级弹 ×' + R.sup : D.AMMO_TIER[f].name + D.CALIBER[gun.cal].name, col = f === 'S' ? '#3ee8ff' : D.QUALITY[D.AMMO_TIER[f].q].col;
    const later = nx && f !== 'S' && nx.tier !== f ? '（下次装' + (nx.pouch ? '袋里的' : '') + D.AMMO_TIER[nx.tier].name + '）' : '';
    return { name, col, line: `${p.mag} / 袋 ${pc} · 包 ${bc}${later}`, empty: pc + bc === 0 && p.mag === 0 };
  };
})(D);
