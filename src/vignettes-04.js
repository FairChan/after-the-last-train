/* 站内地图第二代 P7 · 小场景第四批：三段新历史各 8–9 个（隔离封锁、拾荒者营地、电气事故），失火 5、水淹 4、路障防守 4（plan-p7.md 任务 1）。
   格式见 src/gen2/vignette.js：'#' 墙、'.' 空地、空格不管、字母查 key；宽 2 格的摆设连写两个字母。
   新摆设（隔离帘 qcurtain、防护服 hazsuit、喷雾罐 sprayer、医疗废物桶 biobin、帐篷布 tarp、炊具 cookpot、破烂堆 junkpile、购物车 scrapcart、
   烧坏的配电箱 burntbox、焦电缆 cablepile、轮胎 tires）画在 arena.js 的 makeProp 里；新贴花（消毒喷雾痕 spray、封条 tape、电弧痕 arc）画在 gen2/decals.js。
   rooms 写 'outdoor' 的只放露天的房间（街区、公园、楼顶、码头、工地、夜市、弹坑、车辆段的轨道区、高架），不放室内才有的东西；站台的只放站台，
   摆设、容器写在靠墙第一排（第二排是通道，只放贴花）。粉笔画只画符号，不写字。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const G2 = D.gen2;
  G2.VIG_WIDE.qcurtain = 1; G2.VIG_WIDE.tarp = 1; // 隔离帘、帐篷布宽 2 格
  // 小写字母默认是这些贴花 / 格子（每个小场景只用得上的那几个字母）
  const BASE = { p: { decal: 'paper' }, x: { decal: 'blood' }, g: { decal: 'glass' }, c: { decal: 'chalk' }, e: { decal: 'shells' }, s: { decal: 'soot' }, w: { decal: 'water' }, r: { decal: 'rubble' }, t: { decal: 'tread' }, y: { decal: 'spray' }, z: { decal: 'tape' }, a: { decal: 'arc' }, l: { loose: 1 }, n: { spawn: 1 } };
  const V = o => G2.vig(Object.assign({ flip: true }, o, { key: Object.assign({}, BASE, o.key) }));
  const HALL = ['hall'], PLAT = ['platform'], OUT = ['outdoor'];
  const MANY = ['security', 'control', 'ticket', 'storage', 'medic', 'office', 'power', 'workshop', 'hidden', 'factory', 'shop', 'cargo', 'garage', 'dorm', 'lab', 'canteen', 'server', 'pump'];

  // ── 隔离封锁 quarantine：隔离帘、封条、消毒喷雾痕、扔掉的防护服
  const Q = ['quarantine'];
  V({ id: 'quar_hall_curtain', rooms: HALL, at: 'wall', hist: Q, map: ['#####', 'QQ.S.', '.y.z.'], key: { Q: { prop: 'qcurtain' }, S: { prop: 'sprayer' } } }); // 大厅墙边拉起的隔离帘、喷雾罐
  V({ id: 'quar_ward', rooms: ['medic', 'dorm', 'lab', 'washroom', 'hidden', 'storage', 'office'], at: 'wall', hist: Q, map: ['####', 'QQH.', 'y.zy'], key: { Q: { prop: 'qcurtain' }, H: { prop: 'hazsuit' } } }); // 隔离病床：帘子后面一件防护服
  V({ id: 'quar_door_seal', rooms: MANY, at: 'door', hist: Q, map: ['zyz', '.H.'], key: { H: { prop: 'hazsuit' } } }); // 门口贴着封条，喷过消毒水
  V({ id: 'quar_suit_pile', out: true, rooms: ['hall', 'storage', 'cargo', 'medic', 'garage', 'factory', 'workshop', 'canteen'], at: 'center', hist: Q, map: ['y.y', '.H.', 'z.U'], key: { H: { prop: 'hazsuit' }, U: { prop: 'biobin' } } }); // 脱下来的防护服、医疗废物桶
  V({ id: 'quar_decon_corner', rooms: ['storage', 'medic', 'washroom', 'lab', 'workshop', 'security', 'hidden', 'power', 'control'], at: 'corner', hist: Q, map: ['###', '#SU', '#y.'], key: { S: { prop: 'sprayer' }, U: { prop: 'biobin' } } }); // 消毒角
  V({ id: 'quar_sealed_cargo', rooms: ['cargo', 'storage', 'shop', 'garage', 'factory', 'hidden'], at: 'wall', hist: Q, map: ['####', 'kqz.', 'z.yl'], key: { k: { prop: 'cartons' }, q: { cont: 'parcel' } } }); // 贴了封条的货
  V({ id: 'quar_plat_check', rooms: PLAT, at: 'wall', hist: Q, map: ['#####', 'QQ.U.', '.z.y.'], key: { Q: { prop: 'qcurtain' }, U: { prop: 'biobin' } } }); // 站台上的隔离检查点
  V({ id: 'quar_out_post', rooms: OUT, at: 'center', hist: Q, map: ['y.H.', '.z.U', 'y..z'], key: { H: { prop: 'hazsuit' }, U: { prop: 'biobin' } } }); // 露天的消毒点（没有帘子）

  // ── 拾荒者营地 camp：成堆的捡来的东西、帐篷布、炊具、粉笔记号
  const C = ['camp'];
  V({ id: 'camp_hall_tarp', rooms: HALL, at: 'wall', hist: C, map: ['######', 'TTJ.F.', '.c..l.'], key: { T: { prop: 'tarp' }, J: { prop: 'junkpile' }, F: { prop: 'cookpot' } } }); // 靠墙搭的帐篷、破烂堆、炊具
  V({ id: 'camp_cookfire', out: true, rooms: ['hall', 'storage', 'cargo', 'garage', 'factory', 'workshop', 'canteen', 'dorm'], at: 'center', hist: C, map: ['c.c', '.F.', 'J.l'], key: { F: { prop: 'cookpot' }, J: { prop: 'junkpile' } } }); // 屋子当中生的火
  V({ id: 'camp_scrap_cart', out: true, rooms: ['storage', 'shop', 'workshop', 'hall', 'garage', 'cargo', 'factory', 'ticket'], at: 'wall', hist: C, map: ['###', 'MJ.', '.c.'], key: { M: { prop: 'scrapcart' }, J: { prop: 'junkpile' } } }); // 装满破烂的购物车
  V({ id: 'camp_bunk_corner', rooms: ['hidden', 'storage', 'dorm', 'power', 'security', 'workshop', 'office', 'medic'], at: 'corner', hist: C, map: ['####', '#BB.', '#Jcl'], key: { B: { prop: 'bedroll' }, J: { prop: 'junkpile' } } }); // 墙角的铺位
  V({ id: 'camp_stash_crate', out: true, rooms: ['hidden', 'storage', 'cargo', 'hall', 'garage', 'factory'], at: 'wall', hist: C, map: ['###', 'JoJ', '.c.'], key: { J: { prop: 'junkpile' }, o: { cont: 'crate' } } }); // 两堆破烂中间的货箱
  V({ id: 'camp_door_marks', rooms: MANY, at: 'door', hist: C, map: ['c.c', '.J.'], key: { J: { prop: 'junkpile' } } }); // 门口的记号
  V({ id: 'camp_plat_shanty', rooms: PLAT, at: 'wall', hist: C, map: ['#####', 'TTFJ.', '.c.l.'], key: { T: { prop: 'tarp' }, F: { prop: 'cookpot' }, J: { prop: 'junkpile' } } }); // 站台墙边的窝棚
  V({ id: 'camp_out_fire', rooms: OUT, at: 'center', hist: C, w: 4, map: ['J.c.', '.FTT', 'c.l.'], key: { J: { prop: 'junkpile' }, F: { prop: 'cookpot' }, T: { prop: 'tarp' } } }); // 露天的营火和帐篷

  // ── 电气事故 shortcircuit：烧坏的配电箱、焦黑电缆、地上的电弧痕
  const S = ['shortcircuit'];
  V({ id: 'short_power_blast', rooms: ['power', 'control', 'server', 'workshop', 'factory', 'pump', 'dispatchroom'], at: 'wall', hist: S, map: ['###', 'Xa.', 'aKa'], key: { X: { prop: 'burntbox' }, K: { prop: 'cablepile' } } }); // 炸开的配电箱
  V({ id: 'short_hall_arc', out: true, rooms: HALL, at: 'center', hist: S, map: ['a.s', '.K.', 's.a'], key: { K: { prop: 'cablepile' } } }); // 大厅当中掉下来的电缆
  V({ id: 'short_hall_box', out: true, rooms: HALL, at: 'wall', hist: S, map: ['####', 'X.Ka', '.a.s'], key: { X: { prop: 'burntbox' }, K: { prop: 'cablepile' } } }); // 大厅墙上烧坏的电箱
  V({ id: 'short_door_cable', rooms: MANY, at: 'door', hist: S, map: ['aK.', '.a.'], key: { K: { prop: 'cablepile' } } }); // 门口一盘烧焦的线
  V({ id: 'short_corner_box', rooms: ['power', 'workshop', 'storage', 'control', 'security', 'ticket', 'server', 'pump', 'garage'], at: 'corner', hist: S, map: ['###', '#Xa', '#sK'], key: { X: { prop: 'burntbox' }, K: { prop: 'cablepile' } } });
  V({ id: 'short_desk_pc', rooms: ['office', 'control', 'ticket', 'server', 'dispatchroom', 'radio', 'security', 'archive', 'lab'], at: 'wall', hist: S, map: ['###', 'sos', '.a.'], key: { o: { cont: 'wreck' } } }); // 烧坏的设备（容器位：机器残骸）
  V({ id: 'short_server_scorch', rooms: ['server', 'control', 'power', 'lab', 'dispatchroom', 'office'], at: 'center', hist: S, map: ['a.a', '.K.', 's.s'], key: { K: { prop: 'cablepile' } } });
  V({ id: 'short_plat_fuse', rooms: PLAT, at: 'wall', hist: S, map: ['####', 'X.K.', '.a.a'], key: { X: { prop: 'burntbox' }, K: { prop: 'cablepile' } } }); // 站台墙上的电箱
  V({ id: 'short_out_cabinet', rooms: OUT, at: 'center', hist: S, map: ['a.s', '.X.', 'K.a'], key: { X: { prop: 'burntbox' }, K: { prop: 'cablepile' } } }); // 街边烧坏的电柜

  // ── 失火 fire
  const FI = ['fire'];
  V({ id: 'fire_hall_bench', out: true, rooms: HALL, at: 'wall', hist: FI, map: ['#####', 'sBBs.', '.rs.r'], key: { B: { prop: 'benchfall' } } }); // 烧翻的长椅
  V({ id: 'fire_shop_stock', rooms: ['shop', 'storage', 'canteen', 'ticket', 'cargo', 'hidden'], at: 'wall', hist: FI, map: ['###', 'sks', '.rs'], key: { k: { prop: 'cartons' } } }); // 烧了一半的货
  V({ id: 'fire_office_files', rooms: ['office', 'control', 'archive', 'ticket', 'dispatchroom', 'radio', 'security'], at: 'wall', hist: FI, map: ['###', 'sfs', 'p.s'], key: { f: { cont: 'filecab' } } }); // 熏黑的文件柜
  V({ id: 'fire_plat_scorch', rooms: PLAT, at: 'wall', hist: FI, map: ['#####', 'BBs.s', '.r..s'], key: { B: { prop: 'benchfall' } } }); // 站台上烧翻的候车椅
  V({ id: 'fire_out_tires', rooms: OUT, at: 'center', hist: FI, w: 4, map: ['s.r', '.U.', 'r.s'], key: { U: { prop: 'tires' } } }); // 烧过的轮胎堆

  // ── 水淹 flood（积水只放室内）
  const FL = ['flood'];
  V({ id: 'flood_hall_puddles', rooms: HALL, at: 'center', hist: FL, map: ['w.w', '.u.', 'w.p'], key: { u: { prop: 'bucket' } } });
  V({ id: 'flood_storage_corner', rooms: ['storage', 'cargo', 'pump', 'garage', 'workshop', 'hidden'], at: 'corner', hist: FL, map: ['###', '#kw', '#ww'], key: { k: { prop: 'cartons' } } }); // 泡了水的纸箱
  V({ id: 'flood_plat_drip', rooms: PLAT, at: 'wall', hist: FL, map: ['###', 'u.u', 'w.w'], key: { u: { prop: 'bucket' } } }); // 站台墙下两只接水桶
  V({ id: 'flood_medic_wet', rooms: ['medic', 'washroom', 'dorm', 'lab', 'office', 'security'], at: 'wall', hist: FL, map: ['###', 'wuw', '.p.'], key: { u: { prop: 'bucket' } } });

  // ── 路障防守 barricade
  const BA = ['barricade'];
  V({ id: 'bar_door_bags', rooms: MANY, at: 'door', hist: BA, map: ['bb.', '.e.'], key: { b: { prop: 'sandbag' } } }); // 门里码的沙袋
  V({ id: 'bar_hall_crates', out: true, rooms: HALL, at: 'wall', hist: BA, map: ['#####', 'kbkb.', '.e.e.'], key: { k: { prop: 'crate' }, b: { prop: 'sandbag' } } }); // 货箱和沙袋垒的掩体
  V({ id: 'bar_plat_line', rooms: PLAT, at: 'wall', hist: BA, map: ['#####', 'b.RR.', '.e..e'], key: { b: { prop: 'sandbag' }, R: { prop: 'roadblock' } } }); // 站台上的防线
  V({ id: 'bar_out_block', rooms: OUT, at: 'center', hist: BA, map: ['e.e..', '.RR.b', 'e...e'], key: { R: { prop: 'roadblock' }, b: { prop: 'sandbag' } } }); // 街上的路障
})(D);
