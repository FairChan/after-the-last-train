/* 站内地图第二代 P7 任务 2 · 小场景第八批（十站不重复，续）：大厅 8、仓库 6、隐藏房 4、维修 / 车间 / 配电 6、车库 3、商铺 3、售票 / 控制 / 保安 5、医务 3、宿舍 / 食堂 2。
   第七批补完以后，十站里重复的就是这些常见房间的通用小场景；这批每种再补几个。格式见 src/gen2/vignette.js；字母约定同 vignettes-04.js。
   out：true 的大厅小场景露天也说得通（街道、楼顶这些对到大厅的露天房间也放）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const G2 = D.gen2;
  const BASE = { p: { decal: 'paper' }, x: { decal: 'blood' }, g: { decal: 'glass' }, c: { decal: 'chalk' }, e: { decal: 'shells' }, s: { decal: 'soot' }, w: { decal: 'water' }, r: { decal: 'rubble' }, t: { decal: 'tread' }, y: { decal: 'spray' }, z: { decal: 'tape' }, a: { decal: 'arc' }, l: { loose: 1 }, n: { spawn: 1 } };
  const V = o => G2.vig(Object.assign({ flip: true }, o, { key: Object.assign({}, BASE, o.key) }));
  const HALL = ['hall'];

  // ── 大厅
  V({ id: 'hall_bag_circle', rooms: HALL, out: true, at: 'center', map: ['L.L', '.l.', 'L.p'], key: { L: { prop: 'luggage' } } }); // 一圈放下的包
  V({ id: 'hall_planter_bench', rooms: HALL, at: 'wall', map: ['####', 'PBB.', '.p..'], key: { P: { prop: 'planter' }, B: { prop: 'bench' } } }); // 花池边的长椅
  V({ id: 'hall_glass_rain', rooms: HALL, at: 'center', map: ['g.g.g', '..p..'] }); // 顶上掉下来的玻璃
  V({ id: 'hall_vend_pair', rooms: HALL, at: 'wall', map: ['####', 'M.M.', '.g.p'], key: { M: { prop: 'vending' } } }); // 一对售货机
  V({ id: 'hall_bin_row', rooms: HALL, out: true, at: 'wall', map: ['###', 'i.i', 'p.p'], key: { i: { prop: 'bin' } } }); // 一排垃圾桶
  V({ id: 'hall_drag_trail', rooms: HALL, out: true, at: 'center', map: ['x...', '.x..', '..xl'] }); // 拖了一路的血
  V({ id: 'hall_crate_drop', rooms: HALL, out: true, at: 'center', map: ['C.k', '.l.'], key: { C: { prop: 'crate' }, k: { prop: 'cartons' } } }); // 掉在路中间的货
  V({ id: 'hall_kiosk_empty', rooms: HALL, at: 'wall', map: ['####', 'KK.p', '.g..'], key: { K: { prop: 'kiosk' } } }); // 搬空了的小卖部

  // ── 仓库
  V({ id: 'stor_crate_aisle', rooms: ['storage', 'cargo'], at: 'center', map: ['C.C', '.t.', 'C.l'], key: { C: { prop: 'crate' } } }); // 货箱中间叉车压过的路
  V({ id: 'stor_shelf_gap', rooms: ['storage', 'shop'], at: 'wall', map: ['####', 'SS.k', '.p..'], key: { S: { prop: 'shelf' }, k: { prop: 'cartons' } } }); // 货架空了一格
  V({ id: 'stor_barrel_leak', rooms: ['storage', 'garage', 'factory'], at: 'corner', map: ['###', '#D.', '#.s'], key: { D: { prop: 'barrel' } } }); // 角落里漏油的桶
  V({ id: 'stor_box_tumble', rooms: ['storage', 'cargo', 'hidden'], at: 'center', map: ['k.k', '.k.', 'p.l'], key: { k: { prop: 'cartons' } } }); // 塌下来的纸箱
  V({ id: 'stor_tally_wall', rooms: ['storage', 'cargo'], at: 'wall', map: ['####', 'c.c.', '..l.'] }); // 墙上记的数
  V({ id: 'stor_cart_left', rooms: ['storage', 'cargo', 'garage'], at: 'center', map: ['MM', '.p'], key: { M: { prop: 'mcart' } } }); // 没推走的推车

  // ── 隐藏房
  V({ id: 'hid_note_wall', rooms: ['hidden'], at: 'wall', map: ['###', 'p.p', '.l.'] }); // 墙根一堆写过字的纸
  V({ id: 'hid_aid_corner', rooms: ['hidden', 'shelter'], at: 'corner', map: ['###', '#A.', '#.x'], key: { A: { prop: 'aidkit' } } }); // 自己包扎过的地方
  V({ id: 'hid_tarp_bed', rooms: ['hidden', 'dorm'], at: 'wall', map: ['####', 'RR.i', '.p..'], key: { R: { prop: 'bedroll' }, i: { prop: 'bin' } } }); // 铺盖和一个当桌子的桶
  V({ id: 'hid_rubble_way', rooms: ['hidden'], at: 'door', map: ['r.r', '.r.'] }); // 打通墙留下的碎块

  // ── 维修间、车间、配电
  V({ id: 'wks_parts_floor', rooms: ['workshop', 'factory', 'garage'], at: 'center', map: ['k.r', '.l.', 'r.k'], key: { k: { prop: 'cartons' } } }); // 拆了一地的零件
  V({ id: 'wks_tire_corner', rooms: ['workshop', 'garage'], at: 'corner', map: ['###', '#U.', '#.s'], key: { U: { prop: 'tires' } } }); // 角落里堆的轮胎
  V({ id: 'fac_oil_trail', rooms: ['factory', 'workshop'], at: 'center', map: ['s..', '.ts', '..l'] }); // 机油一路滴过去
  V({ id: 'fac_barrel_pair', rooms: ['factory', 'workshop', 'pump'], at: 'wall', map: ['###', 'D.D', '.s.'], key: { D: { prop: 'barrel' } } }); // 墙边两个油桶
  V({ id: 'pwr_soot_panel', rooms: ['power', 'control'], at: 'wall', map: ['###', 's.s', '.l.'] }); // 墙根一片熏黑
  V({ id: 'pwr_cart_tools', rooms: ['power', 'workshop', 'server'], at: 'wall', map: ['####', 'MM.k', '.t..'], key: { M: { prop: 'mcart' }, k: { prop: 'cartons' } } }); // 检修推车和工具箱

  // ── 车库
  V({ id: 'gar_tire_line', rooms: ['garage'], at: 'wall', map: ['####', 'U.U.', '.t.l'], key: { U: { prop: 'tires' } } }); // 墙边一排轮胎
  V({ id: 'gar_oil_tracks', rooms: ['garage'], at: 'center', map: ['t.t', 's.s', '.l.'] }); // 车开走留下的油印
  V({ id: 'gar_junk_corner', rooms: ['garage'], at: 'corner', map: ['###', '#J.', '#.r'], key: { J: { prop: 'junkpile' } } }); // 角落里的破烂

  // ── 商铺
  V({ id: 'shop_glass_counter', rooms: ['shop', 'jewelry'], at: 'center', map: ['g.g', '.p.', 'g.l'] }); // 砸开的柜台玻璃
  V({ id: 'shop_box_door', rooms: ['shop', 'barter'], at: 'door', map: ['k.p', '.l.'], key: { k: { prop: 'cartons' } } }); // 门口扔下的货
  V({ id: 'shop_plant_wall', rooms: ['shop', 'lounge'], at: 'wall', map: ['###', 'P.i', '.p.'], key: { P: { prop: 'planter' }, i: { prop: 'bin' } } }); // 门边的盆栽和垃圾桶

  // ── 售票、控制、保安
  V({ id: 'tkt_paper_wall', rooms: ['ticket', 'office'], at: 'wall', map: ['####', 'p.p.', '.l.p'] }); // 墙边散的票据
  V({ id: 'ctl_cable_floor', rooms: ['control', 'server', 'radio'], at: 'center', map: ['Y.', '.l'], key: { Y: { prop: 'cablepile' } } }); // 拔下来的线
  V({ id: 'sec_shell_door', rooms: ['security', 'arsenal'], at: 'door', map: ['e.e', '.n.'] }); // 门口守过的弹壳
  V({ id: 'sec_locker_kick', rooms: ['security', 'dorm'], at: 'wall', map: ['###', 'LL.', '.p.'], key: { L: { prop: 'lockerfall' } } }); // 踢倒的柜子
  V({ id: 'ctl_tape_desk', rooms: ['control', 'ticket', 'security'], at: 'center', map: ['z.p', '.l.'] }); // 封过的工位

  // ── 医务室
  V({ id: 'med_aid_shelf', rooms: ['medic', 'lab'], at: 'wall', map: ['###', 'A.A', '.x.'], key: { A: { prop: 'aidkit' } } }); // 翻空的急救箱
  V({ id: 'med_bandage_trail', rooms: ['medic', 'shelter'], at: 'center', map: ['x.p', '.x.', 'p.l'] }); // 地上的绷带和血
  V({ id: 'med_bed_corner', rooms: ['medic'], at: 'corner', map: ['###', '#RR', '#.p'], key: { R: { prop: 'bedroll' } } }); // 角落里临时搭的铺

  // ── 宿舍、食堂
  V({ id: 'dorm_bag_pile', rooms: ['dorm', 'shelter'], at: 'center', map: ['L.L', '.l.'], key: { L: { prop: 'luggage' } } }); // 一堆没拿走的包
  V({ id: 'cant_bin_spill', rooms: ['canteen', 'lounge'], at: 'wall', map: ['###', 'i.p', 'p.g'], key: { i: { prop: 'bin' } } }); // 翻了的泔水桶
})(D);
