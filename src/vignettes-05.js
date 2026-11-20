/* 站内地图第二代 P7 · 小场景第五批：交火 3、逃难时有人住过 3、机器清剿过 3、被搜刮过 4，通用的大厅 4、功能房 23（plan-p7.md 任务 1）。
   格式见 src/gen2/vignette.js；字母约定同 vignettes-04.js（小写字母默认是贴花 / 格子，大写和其余字母查 key）。
   通用的补上 P3 那批覆盖得少的房间：隐藏房间、车间、配电室、机房、医务室、商铺、宿舍、车库、货运间。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const G2 = D.gen2;
  const BASE = { p: { decal: 'paper' }, x: { decal: 'blood' }, g: { decal: 'glass' }, c: { decal: 'chalk' }, e: { decal: 'shells' }, s: { decal: 'soot' }, w: { decal: 'water' }, r: { decal: 'rubble' }, t: { decal: 'tread' }, y: { decal: 'spray' }, z: { decal: 'tape' }, a: { decal: 'arc' }, l: { loose: 1 }, n: { spawn: 1 } };
  const V = o => G2.vig(Object.assign({ flip: true }, o, { key: Object.assign({}, BASE, o.key) }));
  const HALL = ['hall'], PLAT = ['platform'], OUT = ['outdoor'];
  const MANY = ['security', 'control', 'ticket', 'storage', 'medic', 'office', 'power', 'workshop', 'hidden', 'factory', 'shop', 'cargo', 'garage', 'dorm', 'lab', 'canteen', 'server', 'pump'];

  // ── 交火 firefight
  const FF = ['firefight'];
  V({ id: 'ff_desk_cover', rooms: ['office', 'control', 'ticket', 'security', 'dispatchroom', 'radio', 'archive'], at: 'center', hist: FF, map: ['e.x', '.o.', 'x.e'], key: { o: { cont: 'corpse' } } }); // 倒在办公室当中的人
  V({ id: 'ff_storage_cover', rooms: ['storage', 'cargo', 'factory', 'workshop', 'garage', 'hidden'], at: 'wall', hist: FF, map: ['###', 'kek', 'x.e'], key: { k: { prop: 'crate' } } }); // 货箱后面的弹壳
  V({ id: 'ff_out_bodies', rooms: OUT, at: 'center', hist: FF, map: ['e.x.', '.o.e', 'x..e'], key: { o: { cont: 'corpse' } } }); // 露天倒着的人

  // ── 逃难时有人住过 squat
  const SQ = ['squat'];
  V({ id: 'squat_dorm_beds', rooms: ['dorm', 'hidden', 'storage', 'medic', 'office', 'canteen'], at: 'wall', hist: SQ, map: ['######', 'BB.BB.', '.c.l..'], key: { B: { prop: 'bedroll' } } }); // 一排地铺
  V({ id: 'squat_hall_tally', out: true, rooms: HALL, at: 'wall', hist: SQ, map: ['####', 'c.c.', '.l.p'] }); // 墙根下数日子的粉笔记号
  V({ id: 'squat_shop_nest', rooms: ['shop', 'canteen', 'ticket', 'office', 'storage', 'hidden'], at: 'center', hist: SQ, map: ['p.c', 'BB.', '.l.'], key: { B: { prop: 'bedroll' } } }); // 柜台之间的睡袋

  // ── 机器清剿过 purge
  const PU = ['purge'];
  V({ id: 'purge_storage_scan', rooms: ['storage', 'cargo', 'factory', 'workshop', 'garage', 'power'], at: 'center', hist: PU, map: ['t.x', '.o.', 'x.t'], key: { o: { cont: 'corpse' } } }); // 履带碾过、倒下的人
  V({ id: 'purge_door_breach', rooms: MANY, at: 'door', hist: PU, map: ['t.r', '.v.'], key: { v: { prop: 'botwreck' } } }); // 门口卡住的一台机器
  V({ id: 'purge_out_tracks', rooms: OUT, at: 'center', hist: PU, map: ['t..t', '.v..', 't..t'], key: { v: { prop: 'botwreck' } } }); // 露天的履带印和残骸

  // ── 被搜刮过 looted（只改画面）
  const LO = ['looted'];
  V({ id: 'loot_office_drawers', rooms: ['office', 'control', 'archive', 'ticket', 'security', 'dispatchroom'], at: 'wall', hist: LO, map: ['###', 'LLp', 'g.p'], key: { L: { prop: 'lockerfall' } } }); // 推倒的柜子、满地的纸
  V({ id: 'loot_pharmacy', rooms: ['medic', 'shop', 'lab', 'canteen'], at: 'corner', hist: LO, map: ['####', '#LLp', '#g.p'], key: { L: { prop: 'lockerfall' } } }); // 翻空的药柜
  V({ id: 'loot_plat_vendor', rooms: PLAT, at: 'wall', hist: LO, map: ['###', 'V.p', 'g.g'], key: { V: { prop: 'vendbroke' } } }); // 站台上撬开的售货机
  V({ id: 'loot_out_cart', rooms: OUT, at: 'center', hist: LO, map: ['p.g', '.M.', 'g.p'], key: { M: { prop: 'scrapcart' } } }); // 扔下的购物车

  // ── 通用：大厅
  V({ id: 'hall_luggage_drop', out: true, rooms: HALL, at: 'center', map: ['.L.', 'p.L', '.l.'], key: { L: { prop: 'luggage' } } }); // 跑的时候扔下的行李
  V({ id: 'hall_bench_rest', out: true, rooms: HALL, at: 'wall', map: ['####', 'BB.i', '.p..'], key: { B: { prop: 'bench' }, i: { prop: 'bin' } } }); // 墙边的长椅和垃圾桶
  V({ id: 'hall_aid_station', out: true, rooms: HALL, at: 'wall', map: ['###', 'A.k', '.x.'], key: { A: { prop: 'aidkit' }, k: { prop: 'cartons' } } }); // 临时的救护点
  V({ id: 'hall_paper_trail', out: true, rooms: ['hall', 'lounge', 'shelter'], at: 'center', map: ['p..', '.p.', '..p'] }); // 一路散落的纸

  // ── 通用：功能房
  V({ id: 'hidden_bunk', rooms: ['hidden', 'dorm', 'storage'], at: 'wall', map: ['####', 'BB.o', '.l..'], key: { B: { prop: 'bedroll' }, o: { cont: 'crate' } } }); // 藏身处的铺位和一箱存货
  V({ id: 'hidden_supply_corner', rooms: ['hidden', 'storage', 'cargo'], at: 'corner', map: ['###', '#kk', '#.l'], key: { k: { prop: 'cartons' } } });
  V({ id: 'hidden_chalk_tally', rooms: ['hidden', 'dorm', 'security', 'shelter'], at: 'center', map: ['c.c', '.l.', 'c..'] }); // 地上画的记号
  V({ id: 'hidden_barrels', rooms: ['hidden', 'storage', 'pump', 'garage'], at: 'wall', map: ['###', 'DoD', '.r.'], key: { D: { prop: 'barrel' }, o: { cont: 'crate' } } });
  V({ id: 'factory_parts_bench', rooms: ['factory', 'workshop', 'garage'], at: 'wall', map: ['#####', 'MMo..', '.r.l.'], key: { M: { prop: 'machine' }, o: { cont: 'partsbin' } } }); // 机器旁边的零件架
  V({ id: 'factory_oil_spill', rooms: ['factory', 'workshop', 'garage', 'power', 'pump'], at: 'center', map: ['r.t', '.D.', 't.r'], key: { D: { prop: 'barrel' } } }); // 翻倒的油桶
  V({ id: 'factory_scrap_corner', rooms: ['factory', 'workshop', 'storage', 'garage'], at: 'corner', map: ['###', '#vo', '#r.'], key: { v: { prop: 'botwreck' }, o: { cont: 'wreck' } } }); // 墙角堆的报废机器
  V({ id: 'power_maint_cart', rooms: ['power', 'workshop', 'pump', 'server', 'control'], at: 'wall', map: ['####', 'MMk.', '.r..'], key: { M: { prop: 'mcart' }, k: { prop: 'cartons' } } }); // 停在配电柜前的检修推车
  V({ id: 'power_floor_tools', rooms: ['power', 'pump', 'workshop', 'server'], at: 'center', map: ['r.p', '.l.'] }); // 掉在地上的工具
  V({ id: 'server_parts_boxes', rooms: ['server', 'control', 'lab', 'office'], at: 'wall', map: ['###', 'k.k', '.p.'], key: { k: { prop: 'cartons' } } }); // 拆下来的设备装箱
  V({ id: 'server_cable_floor', rooms: ['server', 'control', 'power', 'dispatchroom'], at: 'center', map: ['p.r', '...', 'r.p'] });
  V({ id: 'server_tech_corner', rooms: ['server', 'power', 'control', 'workshop'], at: 'corner', map: ['####', '#MM', '#.p'], key: { M: { prop: 'mcart' } } });
  V({ id: 'medic_bed_blood', rooms: ['medic', 'dorm', 'lab'], at: 'wall', map: ['####', 'BB.A', 'x.p.'], key: { B: { prop: 'bed' }, A: { prop: 'aidkit' } } }); // 带血的病床、急救箱
  V({ id: 'medic_gurney_center', rooms: ['medic', 'lab', 'hall', 'security'], at: 'center', map: ['x.p', '.A.', 'p.x'], key: { A: { prop: 'aidkit' } } });
  V({ id: 'shop_cart_aisle', rooms: ['shop', 'canteen', 'storage', 'barter'], at: 'center', map: ['.M.', 'p.k'], key: { M: { prop: 'scrapcart' }, k: { prop: 'cartons' } } }); // 货架中间的购物车
  V({ id: 'shop_counter_papers', rooms: ['shop', 'ticket', 'canteen', 'barter', 'jewelry'], at: 'wall', map: ['###', 'kpk', 'p.l'], key: { k: { prop: 'cartons' } } });
  V({ id: 'dorm_bed_luggage', rooms: ['dorm', 'medic', 'hidden'], at: 'wall', map: ['#####', 'BB.L.', '.p...'], key: { B: { prop: 'bed' }, L: { prop: 'luggage' } } }); // 床边的行李
  V({ id: 'dorm_luggage_corner', rooms: ['dorm', 'hidden', 'storage', 'office', 'ticket'], at: 'corner', map: ['###', '#LL', '#.p'], key: { L: { prop: 'luggage' } } });
  V({ id: 'garage_tires', rooms: ['garage', 'workshop', 'factory', 'storage', 'cargo'], at: 'wall', map: ['###', 'UU.', '.t.'], key: { U: { prop: 'tires' } } }); // 靠墙的旧轮胎、车辙
  V({ id: 'garage_toolcart', rooms: ['garage', 'workshop', 'factory'], at: 'wall', map: ['####', 'MMo.', '.r..'], key: { M: { prop: 'mcart' }, o: { cont: 'toolbox' } } });
  V({ id: 'lounge_vending_trash', rooms: ['lounge', 'canteen', 'hall'], at: 'wall', map: ['###', 'v.i', '.p.'], key: { v: { prop: 'vending' }, i: { prop: 'bin' } } }); // 休息室：售货机旁边的垃圾桶
  V({ id: 'shelter_bunk_row', rooms: ['shelter', 'dorm', 'hidden'], at: 'wall', map: ['#####', 'BB.o.', '.p.l.'], key: { B: { prop: 'bed' }, o: { cont: 'crate' } } }); // 避难所：床和一箱存货
  V({ id: 'cargo_pallet_stack', rooms: ['cargo', 'storage', 'shop', 'garage'], at: 'wall', map: ['###', 'kok', '.p.'], key: { k: { prop: 'cartons' }, o: { cont: 'crate' } } }); // 码好的货
})(D);
