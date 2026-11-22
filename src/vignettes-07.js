/* 站内地图第二代 P7 任务 2 · 小场景第七批（十站不重复）：站台通用 16、隐藏房 8、门禁房 / 金库 5、办公 / 配电 / 机房这类功能房 11。
   十站里重复最多的是每站都有的房间（站台层、换乘层的站台，隐藏房、门禁房），它们的通用小场景太少；这批专门补它们。
   格式见 src/gen2/vignette.js；字母约定同 vignettes-04.js。站台的靠墙小场景，摆设、容器写在第一排（第二排是通道）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const G2 = D.gen2;
  const BASE = { p: { decal: 'paper' }, x: { decal: 'blood' }, g: { decal: 'glass' }, c: { decal: 'chalk' }, e: { decal: 'shells' }, s: { decal: 'soot' }, w: { decal: 'water' }, r: { decal: 'rubble' }, t: { decal: 'tread' }, y: { decal: 'spray' }, z: { decal: 'tape' }, a: { decal: 'arc' }, l: { loose: 1 }, n: { spawn: 1 } };
  const V = o => G2.vig(Object.assign({ flip: true }, o, { key: Object.assign({}, BASE, o.key) }));
  const PLAT = ['platform'], HID = ['hidden'], SEC = ['secure', 'vault', 'arsenal'];

  // ── 站台通用
  V({ id: 'plat_paper_bench', rooms: PLAT, at: 'wall', map: ['####', 'BB.k', 'p.p.'], key: { B: { prop: 'bench' }, k: { prop: 'cartons' } } }); // 长椅边一摞没人要的报纸箱
  V({ id: 'plat_bin_tipped', rooms: PLAT, at: 'wall', map: ['###', 'i.T', 'pgp'], key: { i: { prop: 'bin' }, T: { cont: 'trash' } } }); // 踢翻的垃圾桶
  V({ id: 'plat_sleeper', rooms: PLAT, at: 'center', map: ['RR.', '.pl'], key: { R: { prop: 'bedroll' } } }); // 站台上睡过人的铺盖
  V({ id: 'plat_vend_pair', rooms: PLAT, at: 'wall', map: ['####', 'M.M.', '.p.g'], key: { M: { prop: 'vending' } } }); // 一对售货机，地上碎玻璃
  V({ id: 'plat_cart_spill', rooms: PLAT, at: 'center', map: ['MM.', 'k.p'], key: { M: { prop: 'mcart' }, k: { prop: 'cartons' } } }); // 推车上掉下来的箱子
  V({ id: 'plat_aid_drag', rooms: PLAT, at: 'center', map: ['A.x', '.x.', 'x.l'], key: { A: { prop: 'aidkit' } } }); // 应急箱旁拖走的血迹
  V({ id: 'plat_locker_row', rooms: PLAT, at: 'wall', map: ['###', 'O.O', '.l.'], key: { O: { cont: 'locker' } } }); // 墙边两个储物柜
  V({ id: 'plat_body_bags', rooms: PLAT, at: 'center', map: ['L.Q', '.x.'], key: { L: { prop: 'luggage' }, Q: { cont: 'corpse' } } }); // 倒在行李边的人
  V({ id: 'plat_planter_rest', rooms: PLAT, at: 'wall', map: ['####', 'PBB.', '..p.'], key: { P: { prop: 'planter' }, B: { prop: 'bench' } } }); // 花池边的长椅
  V({ id: 'plat_crate_left', rooms: PLAT, at: 'wall', map: ['###', 'C.K', '.r.'], key: { C: { prop: 'crate' }, K: { cont: 'crate' } } }); // 没运走的货箱
  V({ id: 'plat_glass_trail', rooms: PLAT, at: 'center', map: ['g.g', '.g.', 'p.l'] }); // 一路碎玻璃
  V({ id: 'plat_chalk_arrows', rooms: PLAT, at: 'center', map: ['c..c', '.l..'] }); // 地上画的箭头
  V({ id: 'plat_tvm_smashed', rooms: PLAT, at: 'wall', map: ['###', 'M.g', '.g.'], key: { M: { prop: 'tvm' } } }); // 砸开的售票机
  V({ id: 'plat_kiosk_shut', rooms: PLAT, at: 'wall', map: ['####', 'KK.k', '.p..'], key: { K: { prop: 'kiosk' }, k: { prop: 'cartons' } } }); // 关了门的小卖部
  V({ id: 'plat_bag_line', rooms: PLAT, at: 'center', map: ['L.L.L', '..p..'], key: { L: { prop: 'luggage' } } }); // 排队等车时放下的一排包
  V({ id: 'plat_shell_scatter', rooms: PLAT, at: 'center', map: ['e.e', '.x.', 'e.n'] }); // 站台上打过一阵

  // ── 隐藏房
  V({ id: 'hid_crate_bed', rooms: HID.concat(['dorm']), at: 'wall', map: ['####', 'RR.K', '.l..'], key: { R: { prop: 'bedroll' }, K: { cont: 'crate' } } }); // 铺盖挨着一箱存货
  V({ id: 'hid_fire_corner', rooms: HID, at: 'corner', map: ['###', '#F.', '#.l'], key: { F: { prop: 'firebarrel' } } }); // 角落里烤火的油桶
  V({ id: 'hid_tally_wall', rooms: HID, at: 'wall', map: ['###', 'c.c', '.l.'] }); // 墙根划的记号
  V({ id: 'hid_box_fort', rooms: HID.concat(['storage']), at: 'corner', map: ['###', '#kk', '#k.', '#.l'], key: { k: { prop: 'cartons' } } }); // 纸箱垒的小窝
  V({ id: 'hid_last_one', rooms: HID, at: 'center', map: ['Q.p', '.p.'], key: { Q: { cont: 'corpse' } } }); // 没走出去的人
  V({ id: 'hid_scrap_bed', rooms: HID, at: 'center', map: ['RR.', '..J'], key: { R: { prop: 'bedroll' }, J: { prop: 'junkpile' } } }); // 铺盖边一堆捡来的东西
  V({ id: 'hid_barrel_line', rooms: HID.concat(['pump']), at: 'wall', map: ['####', 'D.D.', '.r.l'], key: { D: { prop: 'barrel' } } }); // 墙边一排油桶
  V({ id: 'hid_scrap_cart', rooms: HID, at: 'center', map: ['S.', '.l'], key: { S: { prop: 'scrapcart' } } }); // 推进来藏好的一车东西

  // ── 门禁房、金库、枪械库
  V({ id: 'sec_shell_floor', rooms: SEC, at: 'center', map: ['e.e', '.e.', 'x.n'] }); // 守到最后的弹壳
  V({ id: 'sec_cab_wall', rooms: SEC, at: 'wall', map: ['###', 'K.K', '.l.'], key: { K: { cont: 'filecab' } } }); // 墙边的档案柜
  V({ id: 'sec_drag_marks', rooms: SEC.concat(['security']), at: 'center', map: ['x..', '.x.', '..x'] }); // 拖出去的血迹
  V({ id: 'sec_locker_down', rooms: SEC, at: 'wall', map: ['###', 'LL.', '.g.'], key: { L: { prop: 'lockerfall' } } }); // 撬倒的柜子
  V({ id: 'vault_glass_scatter', rooms: ['vault', 'jewelry', 'gallery'], at: 'center', map: ['g.g', 'p.l'] }); // 碎了一地的展柜玻璃

  // ── 办公、售票、控制、保安、配电、机房
  V({ id: 'ofc_paper_drift', rooms: ['office', 'ticket', 'control'], at: 'center', map: ['p.p', '.l.', 'p..'] }); // 满地文件
  V({ id: 'ofc_cab_down', rooms: ['office', 'control', 'security'], at: 'wall', map: ['###', 'LL.', '.p.'], key: { L: { prop: 'lockerfall' } } }); // 推倒的文件柜
  V({ id: 'pwr_cable_coil', rooms: ['power', 'server', 'control'], at: 'center', map: ['Y.r', '.l.'], key: { Y: { prop: 'cablepile' } } }); // 剪下来的一卷电缆
  V({ id: 'pwr_box_stack', rooms: ['power', 'server'], at: 'wall', map: ['###', 'k.k', '.t.'], key: { k: { prop: 'cartons' } } }); // 备件箱和推车压出的印子
  V({ id: 'srv_glass_floor', rooms: ['server', 'control', 'lab'], at: 'center', map: ['g.g', '.p.'] }); // 砸碎的屏幕
  V({ id: 'tkt_queue_tape', rooms: ['ticket', 'security'], at: 'center', map: ['z.z', '.p.'] }); // 拦过人的胶带
  V({ id: 'sec_desk_blood', rooms: ['security', 'control'], at: 'center', map: ['x.p', '.l.'] }); // 值班的人没走成
  V({ id: 'ofc_plant_corner', rooms: ['office', 'lounge', 'ticket'], at: 'corner', map: ['##', '#P', '#.'], key: { P: { prop: 'planter' } } }); // 角落里枯了的盆栽
  V({ id: 'pwr_bucket_drip', rooms: ['power', 'pump'], at: 'wall', map: ['###', 'U.w', '.w.'], key: { U: { prop: 'bucket' } } }); // 接漏水的桶
  V({ id: 'ctl_chalk_wall', rooms: ['control', 'security', 'office'], at: 'wall', map: ['####', 'c..c', '.l..'] }); // 墙根写写画画
  V({ id: 'ofc_bin_spill', rooms: ['office', 'ticket', 'control', 'lounge'], at: 'wall', map: ['###', 'i.p', 'p.p'], key: { i: { prop: 'bin' } } }); // 翻了的废纸篓
})(D);
