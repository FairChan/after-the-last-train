/* Underdog · 两个武器槽刀枪通用（用户 2026-11-17："主武器 / 副武器不再强行要求是刀还是枪，还是左右键触发"）
   槽位的键名不变（存档、各页都按它存）：load.gun = 主武器（左键），load.melee = 副武器（右键）。两个槽都能装枪或近战。
   - 两把枪：各有各的弹匣。手上那把的弹匣是 R.mag / R.magSeg / R.magTier / R.sup（原来的一套，开枪、换弹、超级弹都不用改），
     另一把的存在 R.mags[槽位] 里；用另一把的时候整套换过来（D.swapGun）。R.gk = 手上那把枪在哪个槽。
   - 两把近战：R.mk = 最近用的那把在哪个槽。
   - "这一趟的枪 / 近战"一律问 D.gunId(R) / D.melId(R)；据点里（只有 pf.load）问 D.loadGun(L) / D.loadMel(L)（左键优先）。
   - 一把枪都没有：不用带子弹，开局不装弹匣，弹药提示都不出。
   station.js 按左右键分别把"点一下 / 按住"转给那个槽的武器：枪就是开火，近战就是原来右键那套（点一下挥、按住蓄力重击、举盾……）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const W = D.WSLOTS = ['gun', 'melee'];
  D.WSLOT_KEY = { gun: '左键', melee: '右键' };
  const card = id => (id && D.CARDS[id]) || null;
  D.isGun = id => !!(card(id) && card(id).gun);
  D.isMel = id => !!(card(id) && card(id).melee);
  D.isWeaponSlot = k => k === 'gun' || k === 'melee';
  D.fitsWeapon = (c, k) => !!c && D.isWeaponSlot(k) && (c.slot === 'gun' || c.slot === 'melee');
  // 据点里：装着的枪 / 近战（两个槽都是同一类时取左键那把）
  D.loadGun = L => !L ? null : D.isGun(L.gun) ? L.gun : D.isGun(L.melee) ? L.melee : null;
  D.loadMel = L => !L ? null : D.isMel(L.melee) ? L.melee : D.isMel(L.gun) ? L.gun : null;
  D.loadGuns = L => !L ? [] : W.map(k => L[k]).filter(D.isGun);
  // 一趟里：手上的枪 / 最近用的近战在哪个槽
  D.gunKey = R => { if (!R || !R.load) return null; const L = R.load; if (R.gk && D.isGun(L[R.gk])) return R.gk; const k = D.isGun(L.gun) ? 'gun' : D.isGun(L.melee) ? 'melee' : null; R.gk = k; return k; };
  D.melKey = R => { if (!R || !R.load) return null; const L = R.load; if (R.mk && D.isMel(L[R.mk])) return R.mk; const k = D.isMel(L.melee) ? 'melee' : D.isMel(L.gun) ? 'gun' : null; R.mk = k; return k; };
  D.gunId = R => { const k = D.gunKey(R); return k ? R.load[k] : null; };
  D.melId = R => { const k = D.melKey(R); return k ? R.load[k] : null; };
  D.gunCal = R => { const id = D.gunId(R); return id ? D.CARDS[id].gun.cal : null; };

  // 另一把枪的弹匣（不在手上的那把）
  const blank = () => ({ mag: 0, seg: [], tier: 1, sup: 0 });
  D.otherMag = (R, k) => (R.mags && R.mags[k]) || blank();
  // 换到 k 槽的枪：手上这把的弹匣收起来，那把的拿出来
  D.swapGun = function (S, k) {
    const R = S.raid, p = S.player, cur = D.gunKey(R);
    if (!D.isGun(R.load[k]) || cur === k) return false;
    R.mags = R.mags || {};
    if (cur) R.mags[cur] = { mag: p.mag | 0, seg: (R.magSeg || []).map(x => x.slice()), tier: R.magTier || 1, sup: R.sup || 0 };
    const m = R.mags[k] || blank(); delete R.mags[k];
    R.mag = p.mag = m.mag; R.magSeg = m.seg; R.magTier = m.tier; R.sup = m.sup; R.gk = k;
    p.reload = 0; p.burstQ = 0; p.ads = 0; p.adsFull = false; p.bloom = 0; p.spin = 0; p.rHold = 0; p.fireCd = Math.max(p.fireCd || 0, 0.14);
    p.gunSwapT = S.t; if (D.playerAct) D.playerAct(p, 'swap', 0.3, 'gun');
    if (D.Sfx) D.Sfx.play('draw');
    return true;
  };
  // 出发时：两把枪都装满（先装另一把、再装手上那把）
  D.loadAllMags = function (R) {
    const ks = W.filter(k => D.isGun(R.load[k])); if (!ks.length) return;
    const main = ks[0]; R.gk = main;
    for (const k of ks.slice(1)) {
      R.gk = k; R.mag = 0; R.magSeg = []; R.magTier = 1; R.sup = 0;
      D.loadMag(R, (D.gunOf ? D.gunOf(R.pf, R.load[k], R) : D.CARDS[R.load[k]].gun).mag);
      (R.mags || (R.mags = {}))[k] = { mag: R.mag, seg: (R.magSeg || []).map(x => x.slice()), tier: R.magTier || 1, sup: R.sup || 0 };
    }
    R.gk = main; R.mag = 0; R.magSeg = []; R.magTier = 1; R.sup = 0;
    D.loadMag(R, (D.gunOf ? D.gunOf(R.pf, R.load[main], R) : D.CARDS[R.load[main]].gun).mag);
  };
})(D);
