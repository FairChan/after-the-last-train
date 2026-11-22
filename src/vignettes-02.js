/* 站内地图第二代 P3 · 小场景第一批（二）：功能房 26 个（plan-p3.md 任务 2）。格式见 src/gen2/vignette.js。
   rooms 的第一个是它算在哪类功能房里（售票处 3、商铺 3、保安室 3、医务室 3、仓库 3、维修间 3、配电室 2、控制室 2、隐藏房 2、门禁房 2），
   后面列的是也能放进去的相近房间（世界扩充的房间、线路主题的房间也有份），样本里才放得出来。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const V = D.gen2.vig;
  // 售票处
  V({ id: 'ticket_queue_papers', rooms: ['ticket', 'control', 'office', 'dispatchroom', 'radio'], at: 'wall', flip: true, map: ['####', 't.t.', '.pp.'], key: { t: { prop: 'stanchion' }, p: { decal: 'paper' } } });
  V({ id: 'ticket_ransacked', rooms: ['ticket', 'office', 'control', 'security', 'archive'], at: 'door', flip: true, hist: ['looted'], map: ['LL.', 'p.g'], key: { L: { prop: 'lockerfall' }, p: { decal: 'paper' }, g: { decal: 'glass' } } });
  V({ id: 'ticket_booth_blood', rooms: ['ticket', 'security', 'control', 'office'], at: 'corner', flip: true, map: ['###', '#c.', '#xp'], key: { c: { cont: 'corpse' }, x: { decal: 'blood' }, p: { decal: 'paper' } } });
  // 商铺
  V({ id: 'shop_carton_stock', rooms: ['shop', 'storage', 'barter', 'cargo', 'canteen'], at: 'corner', flip: true, map: ['###', '#kq', '#k.'], key: { k: { prop: 'cartons' }, q: { cont: 'parcel' } } });
  V({ id: 'shop_ransacked', rooms: ['shop', 'jewelry', 'canteen', 'storage', 'barter', 'gallery'], at: 'center', flip: true, hist: ['looted'], map: ['pLL', 'g.p'], key: { L: { prop: 'lockerfall' }, p: { decal: 'paper' }, g: { decal: 'glass' } } });
  V({ id: 'shop_squat_corner', rooms: ['shop', 'storage', 'ticket', 'hidden', 'dorm', 'canteen'], at: 'corner', flip: true, hist: ['squat'], map: ['####', '#BB.', '#.cl'], key: { B: { prop: 'bedroll' }, c: { decal: 'chalk' }, l: { loose: 1 } } });
  // 保安室
  V({ id: 'security_barricade', rooms: ['security', 'control', 'arsenal', 'secure', 'power', 'ticket', 'storage'], at: 'door', flip: true, hist: ['barricade'], map: ['RR.', 'b.e'], key: { R: { prop: 'roadblock' }, b: { prop: 'sandbag' }, e: { decal: 'shells' } } });
  V({ id: 'security_last_stand', rooms: ['security', 'control', 'ticket', 'arsenal', 'storage', 'medic'], at: 'corner', flip: true, hist: ['firefight'], map: ['###', '#ce', '#xe'], key: { c: { cont: 'corpse' }, e: { decal: 'shells' }, x: { decal: 'blood' } } });
  V({ id: 'security_evidence', rooms: ['security', 'control', 'ticket', 'office', 'archive'], at: 'wall', flip: true, map: ['###', 'kp.', '.p.'], key: { k: { prop: 'cartons' }, p: { decal: 'paper' } } });
  // 医务室
  V({ id: 'medic_triage', rooms: ['medic', 'dorm', 'lab'], at: 'wall', flip: true, map: ['####', 'BB.m', 'x.p.'], key: { B: { prop: 'bed' }, m: { cont: 'medcab' }, x: { decal: 'blood' }, p: { decal: 'paper' } } });
  V({ id: 'medic_purged', rooms: ['medic', 'security', 'storage', 'control', 'power', 'workshop', 'ticket', 'shop'], at: 'center', flip: true, hist: ['purge'], map: ['t.x', '.c.', 'x.t'], key: { t: { decal: 'tread' }, c: { cont: 'corpse' }, x: { decal: 'blood' } } });
  V({ id: 'medic_bucket', rooms: ['medic', 'washroom', 'storage', 'lab'], at: 'corner', flip: true, map: ['###', '#ui', '#.p'], key: { u: { prop: 'bucket' }, i: { prop: 'bin' }, p: { decal: 'paper' } } });
  // 仓库
  V({ id: 'storage_wet_boxes', rooms: ['storage', 'cargo', 'power', 'workshop', 'pump', 'shop', 'ticket'], at: 'wall', flip: true, hist: ['flood'], map: ['####', 'kk.u', 'w.ww'], key: { k: { prop: 'cartons' }, u: { prop: 'bucket' }, w: { decal: 'water' } } });
  V({ id: 'storage_pallets', rooms: ['storage', 'cargo', 'factory', 'workshop', 'garage'], at: 'corner', flip: true, map: ['####', '#kk.', '#k.l', '#..p'], key: { k: { prop: 'cartons' }, l: { loose: 1 }, p: { decal: 'paper' } } });
  V({ id: 'storage_ransacked', rooms: ['storage', 'cargo', 'shop', 'workshop', 'power', 'ticket', 'factory'], at: 'center', flip: true, hist: ['looted'], map: ['p.r', '.k.', 'r.p'], key: { k: { prop: 'cartons' }, r: { decal: 'rubble' }, p: { decal: 'paper' } } });
  // 维修间
  V({ id: 'workshop_scorched', rooms: ['workshop', 'factory', 'power', 'garage', 'storage', 'control', 'ticket'], at: 'wall', flip: true, hist: ['fire'], map: ['###', 'so.', '.s.'], key: { s: { decal: 'soot' }, o: { cont: 'wreck' } } });
  V({ id: 'workshop_bench_parts', rooms: ['workshop', 'factory', 'garage', 'fixshop', 'pump'], at: 'wall', flip: true, map: ['###', 'ao.', '.r.'], key: { a: { prop: 'barrel' }, o: { cont: 'toolbox' }, r: { decal: 'rubble' } } });
  V({ id: 'workshop_bot_parts', rooms: ['workshop', 'factory', 'power', 'storage', 'control', 'garage', 'security'], at: 'corner', flip: true, hist: ['purge'], map: ['###', '#w.', '#.t'], key: { w: { prop: 'botwreck' }, t: { decal: 'tread' } } });
  // 配电室
  V({ id: 'power_flooded', rooms: ['power', 'pump', 'workshop', 'storage', 'control', 'server'], at: 'door', flip: true, hist: ['flood'], map: ['w.w', '.u.'], key: { w: { decal: 'water' }, u: { prop: 'bucket' } } });
  V({ id: 'power_burnt', rooms: ['power', 'control', 'server', 'workshop', 'storage', 'ticket', 'security'], at: 'corner', flip: true, hist: ['fire'], map: ['###', '#s.', '#rs'], key: { s: { decal: 'soot' }, r: { decal: 'rubble' } } });
  // 控制室
  V({ id: 'control_papers', rooms: ['control', 'office', 'dispatchroom', 'radio', 'archive', 'ticket'], at: 'wall', flip: true, map: ['###', '.f.', 'ppp'], key: { f: { cont: 'filecab' }, p: { decal: 'paper' } } });
  V({ id: 'control_chalk_plan', rooms: ['control', 'security', 'dispatchroom', 'office', 'power', 'radio'], at: 'center', flip: true, map: ['c.c', '.l.', 'p.c'], key: { c: { decal: 'chalk' }, l: { loose: 1 }, p: { decal: 'paper' } } });
  // 隐藏房
  V({ id: 'hidden_stash_camp', rooms: ['hidden'], at: 'corner', flip: true, map: ['####', '#BB.', '#qc.'], key: { B: { prop: 'bedroll' }, q: { cont: 'parcel' }, c: { decal: 'chalk' } } });
  V({ id: 'hidden_last_note', rooms: ['hidden', 'secure', 'vault'], at: 'wall', flip: true, map: ['###', '.c.', 'p.l'], key: { c: { cont: 'corpse' }, p: { decal: 'paper' }, l: { loose: 1 } } });
  // 门禁房
  V({ id: 'secure_breach', rooms: ['secure', 'vault', 'server', 'arsenal', 'hidden'], at: 'door', flip: true, map: ['r.e', '.s.'], key: { r: { decal: 'rubble' }, e: { decal: 'shells' }, s: { spawn: 1 } } });
  V({ id: 'secure_cases', rooms: ['secure', 'arsenal', 'vault', 'server', 'gallery'], at: 'wall', flip: true, map: ['###', 'k.k', '.p.'], key: { k: { prop: 'cartons' }, p: { decal: 'paper' } } });
})(D);
