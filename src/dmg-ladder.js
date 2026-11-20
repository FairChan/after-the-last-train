/* Underdog · 伤害阶梯（2026-11-19，用户："降低一下低等级刀枪/子弹的伤害，呈现阶梯"）
   1. 刀枪按品质乘一个系数 D.DMG_Q（普通、优良 ×0.8，精良 ×0.95，史诗 ×1，传说 ×1.05，至宝 ×1.1）。
      所有枪、近战、"·改""·精工"升级型号都按自己的品质乘（升级型号品质高一两档，所以同一把枪三个型号的差距拉大了）。
      枪伤害保留一位小数，近战取整。
   2. 弹药等级倍率改成一级 ×0.8、二级 ×1、三级 ×1.25、四级 ×1.5、五级 ×1.75（原来 1 / 1.15 / 1.3 / 1.5 / 1.75）。
      超级弹不吃弹药等级（player.js：按 ×1 再乘 1.8）。
   3. 卡片描述里写的伤害数字（"6 伤害"）跟着换，英文也换（英文是"6 Dmg"）；升级型号描述里的"原型：…"一起换，
      "比原型伤害 +15%"换成实际高出的百分比。
   高威胁站：传说、至宝武器 + 四级、五级弹反而比原来高 5%–10%，不会打不动。
   必须在所有武器（content.js、melee.js、arsenal*.js、gear.js 的升级型号）和它们的英文之后、main.js 之前加载。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  D.DMG_Q = [0.8, 0.8, 0.95, 1, 1.05, 1.1]; // 普通只有开局送的钉枪、工兵铲，底子本来就比优良低，所以和优良同一档系数
  const AMMO = [null, 0.8, 1, 1.25, 1.5, 1.75];
  for (let t = 1; t < AMMO.length; t++) if (D.AMMO_TIER[t]) D.AMMO_TIER[t].mul = AMMO[t];

  const I = D.I18N, r1 = v => Math.round(v * 10) / 10;
  // 描述里等于旧伤害的那个数字才换，别的数字（弹匣、秒数、范围）不动
  const swap = (s, re, a, b) => s.replace(re, (m, pre, n, post) => +n === a ? pre + b + post : m);
  const ZH = /(^|[^\d.])(\d+(?:\.\d+)?)(\s*伤害)/g, EN = /(^|[^\d.])(\d+(?:\.\d+)?)(\s+(?:[a-z]+\s+)?Dmg)/g;
  const add = {}, descOf = {}, seen = new Set(); // descOf：原型 id → [旧描述, 新描述]
  function redesc(k, c, a, b) {
    if (a === b || !c.desc) return;
    const z = swap(c.desc, ZH, a, b); if (z === c.desc) return;
    if (I && I.peek) { const e0 = I.peek(c.desc), e1 = e0 && e0 !== c.desc ? swap(e0, EN, a, b) : null; if (e1) add[z] = e1; }
    descOf[k] = [c.desc, z]; c.desc = z;
  }
  const ids = Object.keys(D.CARDS), base = ids.filter(k => !D.CARDS[k].base), up = ids.filter(k => D.CARDS[k].base);
  const scale = (k, c) => {
    const m = D.DMG_Q[Math.max(0, Math.min(5, c.q | 0))];
    if (c.gun && !seen.has(c.gun) && c.gun.dmg > 0) { seen.add(c.gun); const a = c.gun.dmg; c.gun.dmg = r1(a * m); if (!c.base) redesc(k, c, a, c.gun.dmg); }
    if (c.melee && !seen.has(c.melee) && c.melee.dmg > 0) { seen.add(c.melee); const a = c.melee.dmg; c.melee.dmg = Math.max(1, Math.round(a * m)); if (!c.base) redesc(k, c, a, c.melee.dmg); }
  };
  for (const k of base) scale(k, D.CARDS[k]);
  if (I && I.add) I.add(add);
  // 升级型号：描述里的"原型：…"跟着原型换；"比原型伤害 +15%"换成实际高出多少（品质系数也算进去：改 +13%–44%，精工 +30%–71%）
  const up2 = {};
  for (const k of up) {
    const c = D.CARDS[k], b = D.CARDS[c.base], od = descOf[c.base];
    if (od && c.desc) c.desc = c.desc.split(od[0]).join(od[1]);
    scale(k, c);
    const w = c.gun ? 'gun' : c.melee ? 'melee' : null, d0 = w && b && b[w] && b[w].dmg; if (!d0 || !c.desc) continue;
    const pct = Math.round((c[w].dmg / d0 - 1) * 100), z = c.desc.replace(/^比原型伤害 \+\d+%/, '比原型伤害 +' + pct + '%');
    if (z === c.desc) continue;
    if (I && I.peek) { const e = I.peek(c.desc); if (e !== c.desc) up2[z] = e.replace(/damage \+\d+%/, 'damage +' + pct + '%'); }
    c.desc = z;
  }
  if (I && I.add) I.add(up2);
})(D);
