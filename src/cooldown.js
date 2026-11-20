/* Underdog：G 技能、C 回血、V 护盾的冷却加长（用户："目前G C V cd太短了，请你延长并显示cd秒数"）。
   - G：每个型号的技能冷却 ×1.8（取整）。
   - C：回血类共用一个冷却（p.healCd），快速贴片 5 秒、纳米凝胶 6 秒、维修包 10 秒、军用维修包 14 秒。
   - V：护盾类以前没有冷却，现在也共用一个（p.cellCd）：护盾电池 8 秒、大号电池 12 秒、军用电池 16 秒。
   冷却的总长记在 p.healCdMax / p.cellCdMax，右下角的格子（hud-slots.js）按它画转圈和秒数。
   挂钩：K.finishUse（用完设冷却）；station.js 里 V 键看 p.cellCd。说明文字里的秒数跟着改。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K || (D.K = {});
  D.SKILL_CD_MUL = 1.8;
  for (const k in D.SHELLS) { const s = D.SHELLS[k].skill; if (s && !s.cdBase) { s.cdBase = s.cd; s.cd = Math.round(s.cd * D.SKILL_CD_MUL); } }
  const USE_CD = {
    patch: [5, '读条 0.4 秒，回复 10 耐久（没有维修包时按 C 用它）。用完 5 秒内不能再用药'],
    nanogel: [6, '读条 0.25 秒，回复 18 耐久；用完 6 秒内不能再用药'],
    medkit: [10, '读条 1.5 秒，回复 30 耐久。挨打会打断（药不消耗）；用完 10 秒内不能再用药'],
    medkit2: [14, '读条 1.8 秒，回复 55 耐久。挨打会打断（药不消耗）；用完 14 秒内不能再用药'],
    cell: [8, '获得 20 护盾；用完 8 秒内不能再用护盾电池'],
    bigcell: [12, '读条 0.8 秒，获得 35 护盾（背包里没有护盾电池时按 V 用）；用完 12 秒内不能再用护盾电池'],
    cell3: [16, '读条 1 秒，获得 55 护盾；用完 16 秒内不能再用护盾电池'],
  };
  for (const k in USE_CD) { const u = D.USE[k]; if (!u) continue; const [cd, desc] = USE_CD[k]; if (u.shield) u.scd = cd; else u.cd = cd; u.desc = desc; }
  // 以后加的 C / V 消耗品：按回多少、给多少护盾算一个冷却
  for (const k in D.USE) { const u = D.USE[k]; if (u.key === 'C' && u.heal && !USE_CD[k]) u.cd = Math.round(3 + u.heal * 0.2); if (u.key === 'V' && u.shield && !USE_CD[k]) u.scd = Math.round(4 + u.shield * 0.22); }
  const fu0 = K.finishUse;
  K.finishUse = function (S, k) {
    const r = fu0.apply(this, arguments), p = S.player, u = D.USE[k];
    if (u && u.heal && u.cd) p.healCdMax = u.cd;
    if (u && u.shield && u.scd) { p.cellCd = u.scd; p.cellCdMax = u.scd; }
    return r;
  };
})(D);
