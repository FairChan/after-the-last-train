/* 站内地图第二代 P6 · 小场景第一批（三）：站台 8 个（plan-p6.md 任务 1；格式见 src/gen2/vignette.js）。
   只放进站台（rooms: ['platform']；'*' 的小场景不进站台）。站台上墙是 '#'；登车区那两行 furnish.js 留空，小场景放不进去；
   靠墙第二排是通道，摆设、容器不放（贴花、地上的东西可以），所以靠墙的小场景摆设、容器都写在第一排。
   新摆设：丢下的行李 luggage、应急箱 aidkit、检修推车 mcart（宽 2 格），画在 arena.js 的 makeProp 里。容器只用站台自己的种类（储物柜、货箱、垃圾桶、尸体）。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const G2 = D.gen2, V = G2.vig, P = ['platform'];
  G2.VIG_WIDE.mcart = 1; // 检修推车宽 2 格
  // 通用
  V({ id: 'plat_bench_cluster', rooms: P, at: 'wall', flip: true, map: ['######', 'BBtBB.', '.p...p'], key: { B: { prop: 'bench' }, t: { cont: 'trash' }, p: { decal: 'paper' } } }); // 墙边两张候车椅和垃圾桶
  V({ id: 'plat_luggage', rooms: P, at: 'center', flip: true, map: ['.L.', 'Lp.', '.l.'], key: { L: { prop: 'luggage' }, p: { decal: 'paper' }, l: { loose: 1 } } }); // 丢下的行李
  V({ id: 'plat_edge_aid', rooms: P, at: 'center', flip: true, map: ['p.x', '.A.', 'x.s'], key: { A: { prop: 'aidkit' }, x: { decal: 'blood' }, p: { decal: 'paper' }, s: { spawn: 1 } } }); // 站台边上的应急箱，旁边有血迹
  V({ id: 'plat_maint_cart', rooms: P, at: 'wall', flip: true, map: ['####', 'MMkc', '.r..'], key: { M: { prop: 'mcart' }, k: { prop: 'cartons' }, r: { decal: 'rubble' }, c: { cont: 'crate' } } }); // 靠墙停着的检修推车
  // 逃难时有人住过
  V({ id: 'plat_squat_bench', rooms: P, at: 'wall', flip: true, hist: ['squat'], map: ['#####', 'BBf..', '.c.l.'], key: { B: { prop: 'bedroll' }, f: { prop: 'firebarrel' }, c: { decal: 'chalk' }, l: { loose: 1 } } }); // 墙边的铺位和篝火桶
  // 交火
  V({ id: 'plat_fallen_rider', rooms: P, at: 'center', flip: true, hist: ['firefight', 'barricade'], map: ['e.x', '.b.', 'x.e'], key: { b: { cont: 'corpse' }, e: { decal: 'shells' }, x: { decal: 'blood' } } }); // 倒在站台上的乘客、弹壳
  // 机器清剿过
  V({ id: 'plat_purge_tracks', rooms: P, at: 'center', flip: true, hist: ['purge'], map: ['t..t', '.w..', 't..t'], key: { t: { decal: 'tread' }, w: { prop: 'botwreck' } } }); // 履带印和一台残骸
  // 水淹 / 被搜刮过
  V({ id: 'plat_leak_wall', rooms: P, at: 'wall', flip: true, hist: ['flood'], map: ['###', 'wuw', '.w.'], key: { u: { prop: 'bucket' }, w: { decal: 'water' } } }); // 墙上漏水、接水的桶
})(D);
