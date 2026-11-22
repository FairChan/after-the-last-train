/* 末班之后 · 小样二：资源搜取点（14 种新容器）
   消防柜、油桶堆、废料堆、麻袋堆、书架、衣柜、抽屉柜、冷链箱、弹药箱、货物托盘、矿石堆、配电箱、珍宝箱、储液罐。
   晚于 scenes.js 加载：D.ROOMS 已有全部房间，这里只往里追加容器。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const R = D.RAMP, DK = '#080a12';

  Object.assign(D.CONT, {
    firebox:   { name: '消防柜',   n: [1, 3], g: [4, 3], cats: ['part', 'mat'], lean: 0.5, medP: 0.25, desc: '红色消防柜，玻璃门后面是应急药和工具' },
    drums:     { name: '油桶堆',   n: [2, 4], g: [5, 3], cats: ['mat', 'part'], lean: 0.5, ammoP: 0.1, desc: '仓库和维修间的油桶，装的多是燃料和润滑剂' },
    scrapheap: { name: '废料堆',   n: [2, 5], g: [6, 3], cats: ['mat', 'part', 'elec'], lean: 0.5, slow: 0.8, desc: '一堆一堆的废料，翻得快，什么都有一点' },
    sacks:     { name: '麻袋堆',   n: [2, 4], g: [5, 3], cats: ['med', 'mat'], lean: 0.6, medP: 0.4, desc: '补给站的麻袋，装的是干粮和药' },
    bookcase:  { name: '书架',     n: [1, 3], g: [4, 4], cats: ['intel', 'val'], lean: 0.7, slow: 1.1, desc: '图书室和档案室的书架，书脊后面常夹着东西' },
    wardrobe:  { name: '衣柜',     n: [1, 3], g: [4, 4], cats: ['val', 'mat'], lean: 0.5, ammoP: 0.04, desc: '宿舍和休息室的衣柜，里面挂着私人物品' },
    drawers:   { name: '抽屉柜',   n: [2, 4], g: [4, 3], cats: ['part', 'elec', 'intel'], lean: 0.6, desc: '工作台下面的抽屉，一格一格的零件和工具' },
    coldchest: { name: '冷链箱',   n: [2, 3], g: [4, 4], cats: ['med'], lean: 0.6, medP: 0.6, slow: 1.1, desc: '冷藏箱，药品和疫苗' },
    ammocan:   { name: '弹药箱',   n: [2, 3], g: [5, 3], cats: ['part'], lean: 0.2, ammoP: 0.7, desc: '军用弹药箱，绿色铁皮，撬开就是子弹' },
    pallet:    { name: '货物托盘', n: [2, 4], g: [6, 3], cats: ['mat', 'elec', 'med'], lean: 0.4, slow: 0.9, desc: '码在一起的货，最上面那层还没拆' },
    oreheap:   { name: '矿石堆',   n: [1, 3], g: [5, 3], cats: ['metal', 'mat'], lean: 0.7, desc: '矿井运来的原矿，一块块敲下来才知道里面有什么' },
    powerbox:  { name: '配电箱',   n: [1, 3], g: [4, 4], cats: ['elec', 'part'], lean: 0.6, slow: 1.2, desc: '墙上的电闸箱，拉开闸门能找到电子元件' },
    coffer:    { name: '珍宝箱',   n: [2, 3], g: [4, 3], cats: ['val', 'metal'], lean: 0.8, bonus: 1, slow: 1.3, desc: '老式木箱配铜扣，装着值钱的旧东西' },
    tankunit:  { name: '储液罐',   n: [1, 3], g: [4, 4], cats: ['mat', 'med'], lean: 0.6, ammoP: 0.05, desc: '化工和净水站的罐子，装药剂和燃料' },
  });
  Object.assign(D.CMAT, {
    firebox: 'metal', drums: 'metal', scrapheap: 'scrap', sacks: 'soft', bookcase: 'wood', wardrobe: 'wood', drawers: 'metal',
    coldchest: 'fridge', ammocan: 'metal', pallet: 'wood', oreheap: 'scrap', powerbox: 'elec', coffer: 'wood', tankunit: 'metal',
  });

  // ── 摆进现有房间：[房间, 容器, 权重]
  [
    ['hall', 'firebox', 1], ['platform', 'firebox', 1], ['office', 'firebox', 0.5], ['power', 'firebox', 0.6],
    ['storage', 'drums', 1], ['workshop', 'drums', 1.2], ['garage', 'drums', 1], ['factory', 'drums', 1], ['pump', 'drums', 1],
    ['workshop', 'scrapheap', 1], ['factory', 'scrapheap', 1.5], ['garage', 'scrapheap', 0.8], ['storage', 'scrapheap', 0.5],
    ['shelter', 'sacks', 1.2], ['storage', 'sacks', 1], ['canteen', 'sacks', 0.6], ['cargo', 'sacks', 0.8],
    ['archive', 'bookcase', 1.5], ['office', 'bookcase', 0.5], ['lounge', 'bookcase', 0.6], ['gallery', 'bookcase', 0.5], ['hidden', 'bookcase', 0.4],
    ['dorm', 'wardrobe', 2], ['lounge', 'wardrobe', 0.8], ['shelter', 'wardrobe', 0.5], ['hidden', 'wardrobe', 0.4],
    ['workshop', 'drawers', 1.5], ['garage', 'drawers', 0.8], ['lab', 'drawers', 0.6], ['office', 'drawers', 0.6], ['power', 'drawers', 0.6], ['control', 'drawers', 0.5],
    ['medic', 'coldchest', 1.5], ['shop', 'coldchest', 0.6], ['lab', 'coldchest', 1], ['canteen', 'coldchest', 0.5],
    ['arsenal', 'ammocan', 1.5], ['security', 'ammocan', 1], ['storage', 'ammocan', 0.5], ['shelter', 'ammocan', 0.4],
    ['cargo', 'pallet', 2], ['storage', 'pallet', 1.5], ['shop', 'pallet', 0.5],
    ['cargo', 'oreheap', 1], ['factory', 'oreheap', 0.6], ['storage', 'oreheap', 0.4],
    ['power', 'powerbox', 2], ['control', 'powerbox', 0.8], ['pump', 'powerbox', 0.8], ['factory', 'powerbox', 0.5], ['hall', 'powerbox', 0.4],
    ['vault', 'coffer', 1], ['gallery', 'coffer', 1.5], ['hidden', 'coffer', 1], ['jewelry', 'coffer', 0.5], ['secure', 'coffer', 0.4],
    ['pump', 'tankunit', 1.5], ['lab', 'tankunit', 0.8], ['factory', 'tankunit', 0.8], ['washroom', 'tankunit', 0.4],
  ].forEach(function (a) {
    const r = D.ROOMS && D.ROOMS[a[0]];
    if (r && r.cont && !r.cont.some(function (c) { return c[0] === a[1]; })) r.cont.push([a[1], a[2]]);
  });

  // ── 像素图（关、开各一张）；initHiArt 时一起画
  const mk = (w, h, fn) => { const p = D.Paint(w, h); fn(p); p.outline(); return p.make(2); };
  const cont = (k, w, h, fn) => { D.CSPR[k] = [mk(w, h, p => fn(p, false)), mk(w, h, p => fn(p, true))]; };
  const h0 = D.initHiArt;
  D.initHiArt = function () {
    const r = h0 ? h0.apply(this, arguments) : undefined;

    // 消防柜：红色竖柜，玻璃门里是水带卷
    cont('firebox', 20, 26, (p, o) => {
      p.box(1, 1, 18, 24, R.red, { r: 1 });
      if (o) { p.rect(4, 4, 12, 14, DK); p.rect(8, 8, 4, 2, R.white[4]); p.rect(9, 7, 2, 4, R.white[4]); p.rect(4, 14, 12, 1, R.gunmetal[3]); }
      else { p.grad(4, 4, 12, 14, R.glass, 1); p.disc(10, 11, 4, R.white[4]); p.disc(10, 11, 2, R.glass[2]); p.line(5, 5, 8, 4, R.glass[5]); }
      p.rect(5, 20, 10, 3, R.white[4]); p.rect(9, 20, 2, 3, R.red[3]); p.rect(16, 11, 1, 3, R.silver[3]);
    });
    // 油桶堆：三个桶，后面一个，前面两个
    cont('drums', 28, 24, (p, o) => {
      const dr = (x, y, rp) => { p.box(x, y, 10, 16, rp, { r: 1 }); p.rect(x, y + 4, 10, 1, R.dark[1]); p.rect(x, y + 11, 10, 1, R.dark[1]); };
      dr(9, 2, R.green); dr(1, 8, R.red); dr(16, 8, R.blue);
      p.rect(11, 6, 2, 1, R.yellow[5]); p.rect(3, 12, 2, 2, R.yellow[4]);
      if (o) { p.rect(3, 8, 6, 2, DK); p.rect(2, 7, 8, 1, R.red[5]); }
    });
    // 废料堆：一座锈铁丘，露出管子和铁板
    cont('scrapheap', 30, 20, (p, o) => {
      p.ell(15, 13, 14, 7, R.rust); p.ell(9, 11, 7, 5, R.steel, { bias: -0.15 }); p.ell(21, 12, 7, 5, R.gunmetal);
      p.line(3, 9, 12, 3, R.steel[5]); p.line(17, 4, 26, 9, R.rust[6]); p.rect(12, 8, 5, 2, R.copper[4]);
      p.disc(23, 8, 2, R.gunmetal[4]); p.disc(23, 8, 1, R.dark[1]);
      if (o) { p.rect(10, 11, 10, 3, DK); p.px(12, 10, R.copper[5]); }
    });
    // 麻袋堆：三袋，扎口
    cont('sacks', 26, 20, (p, o) => {
      p.ell(7, 13, 6, 6, R.crate, { bias: 0.12 }); p.ell(19, 13, 6, 6, R.crate, { bias: 0.05 }); p.ell(13, 8, 6, 6, R.crate, { bias: 0.15 });
      p.rect(12, 2, 3, 2, '#c9a05a'); p.rect(6, 7, 3, 1, '#c9a05a'); p.rect(18, 7, 3, 1, '#c9a05a');
      p.px(5, 15, R.crate[1]); p.px(21, 16, R.crate[1]); p.px(12, 11, R.crate[2]);
      if (o) { p.rect(11, 3, 5, 3, DK); p.px(13, 4, R.red[4]); }
    });
    // 书架：高木架，彩色书脊
    cont('bookcase', 22, 32, (p, o) => {
      p.box(0, 0, 22, 32, R.crate);
      p.rect(2, 2, 18, 28, '#1a1008');
      const cs = [R.red[3], R.blue[3], R.green[3], R.yellow[4], R.magenta[3], R.white[3], R.olive[4]];
      for (let r = 0; r < 4; r++) {
        const y = 2 + r * 7; let x = 2, i = r * 3;
        while (x < 19) { const w = 1 + ((x * 3 + r) % 2), h = 4 + ((x + r * 5) % 3); p.rect(x, y + 6 - h, w, h, cs[i++ % cs.length]); x += w; }
        p.rect(2, y + 6, 18, 1, R.crate[4]);
      }
      if (o) { p.rect(7, 9, 7, 6, DK); p.rect(14, 10, 2, 5, R.red[3]); p.px(9, 14, R.gold[4]); }
    });
    // 衣柜：高木柜，双开门
    cont('wardrobe', 22, 34, (p, o) => {
      p.box(0, 0, 22, 34, R.crate, { bias: -0.1 });
      p.rect(2, 32, 3, 2, R.dark[1]); p.rect(17, 32, 3, 2, R.dark[1]);
      if (o) {
        p.rect(3, 3, 9, 28, DK); p.rect(4, 6, 8, 1, R.silver[3]);
        p.rect(5, 7, 1, 3, R.silver[2]); p.rect(8, 7, 1, 3, R.silver[2]); p.rect(6, 10, 3, 9, R.cloth[2]);
        p.box(0, 2, 3, 29, R.crate, { bias: 0.1 });
        p.rect(12, 3, 1, 28, R.crate[1]); p.rect(14, 5, 5, 11, R.crate[2]); p.rect(14, 19, 5, 9, R.crate[2]); p.px(13, 17, R.gold[4]);
      } else {
        p.rect(10, 3, 1, 28, R.crate[1]); p.rect(3, 5, 6, 11, R.crate[2]); p.rect(12, 5, 6, 11, R.crate[2]);
        p.rect(3, 19, 6, 9, R.crate[2]); p.rect(12, 19, 6, 9, R.crate[2]); p.px(8, 17, R.gold[4]); p.px(12, 17, R.gold[4]);
      }
    });
    // 抽屉柜：蓝灰铁皮，三层抽屉，亮色把手
    cont('drawers', 24, 24, (p, o) => {
      p.box(1, 2, 22, 21, R.steel, { r: 1 });
      for (let i = 0; i < 3; i++) { const y = 4 + i * 6; p.rect(3, y, 18, 5, R.steel[2]); p.rect(9, y + 2, 6, 1, R.silver[4]); }
      if (o) { p.rect(3, 4, 18, 5, DK); p.box(2, 0, 20, 3, R.steel, { bias: 0.1 }); p.px(6, 6, R.copper[4]); p.px(14, 7, R.silver[4]); }
    });
    // 冷链箱：白色箱体，蓝盖，红十字
    cont('coldchest', 28, 20, (p, o) => {
      p.box(1, 6, 26, 13, R.white, { r: 1 });
      p.rect(12, 11, 4, 6, R.red[3]); p.rect(10, 13, 8, 2, R.red[3]); p.rect(3, 17, 4, 1, R.glass[4]); p.disc(24, 9, 1, R.glass[5]);
      if (o) { p.rect(3, 7, 22, 3, DK); p.px(8, 8, R.glass[5]); p.px(17, 8, R.white[5]); p.box(2, 0, 24, 4, R.blue, { r: 1 }); }
      else { p.box(0, 2, 28, 6, R.blue, { r: 1 }); p.rect(12, 7, 4, 2, R.silver[3]); }
    });
    // 弹药箱：低矮橄榄绿铁箱，黄字，提手
    cont('ammocan', 22, 16, (p, o) => {
      p.box(1, 4, 20, 11, R.olive, { r: 1 });
      p.rect(4, 8, 8, 2, R.yellow[4]); p.rect(4, 11, 5, 1, R.yellow[3]); p.rect(16, 6, 2, 3, R.gunmetal[5]);
      if (o) { p.rect(3, 5, 16, 3, DK); p.px(6, 6, R.gold[4]); p.px(9, 6, R.gold[4]); p.px(12, 6, R.gold[4]); p.box(1, 0, 20, 4, R.olive, { r: 1 }); }
      else { p.rect(7, 1, 8, 1, R.silver[3]); p.rect(7, 2, 1, 2, R.silver[2]); p.rect(14, 2, 1, 2, R.silver[2]); }
    });
    // 货物托盘：木托盘上码三箱，缠着膜
    cont('pallet', 30, 24, (p, o) => {
      p.rect(1, 19, 28, 2, R.crate[3]); p.rect(2, 21, 4, 3, R.crate[2]); p.rect(13, 21, 4, 3, R.crate[2]); p.rect(24, 21, 4, 3, R.crate[2]);
      p.box(2, 9, 12, 10, R.crate); p.box(15, 9, 13, 10, R.white);
      p.box(7, 2, 16, 7, R.steel);
      p.rect(7, 9, 1, 10, R.crate[5]); p.rect(20, 3, 1, 6, R.silver[3]); p.line(2, 14, 27, 14, R.glass[5]);
      p.rect(18, 12, 4, 3, R.red[3]);
      if (o) { p.rect(9, 3, 12, 3, DK); p.rect(5, 1, 4, 2, R.steel[4]); p.rect(21, 1, 4, 2, R.steel[4]); }
    });
    // 矿石堆：暗石丘，带金属闪点
    cont('oreheap', 28, 20, (p, o) => {
      p.ell(14, 13, 13, 7, R.gunmetal);
      p.ell(8, 10, 5, 4, R.steel, { bias: -0.15 }); p.ell(18, 9, 5, 4, R.rust); p.ell(13, 6, 4, 3, R.gunmetal, { bias: 0.15 });
      p.px(7, 9, R.gold[5]); p.px(19, 8, R.green[4]); p.px(12, 5, R.blue[5]); p.rect(15, 14, 2, 1, R.copper[5]); p.px(22, 14, R.silver[5]);
      if (o) { p.rect(10, 10, 8, 3, DK); p.px(12, 11, R.gold[4]); }
    });
    // 配电箱：灰铁门，闪电，黄黑警示条
    cont('powerbox', 20, 26, (p, o) => {
      p.box(1, 1, 18, 24, R.gunmetal, { r: 1 });
      if (o) {
        p.rect(3, 3, 11, 19, DK); p.rect(5, 6, 3, 2, R.green[4], 1); p.rect(5, 10, 9, 1, R.copper[4]); p.rect(5, 14, 9, 1, R.red[3]); p.rect(5, 17, 6, 1, R.blue[4]);
        p.box(14, 2, 5, 22, R.gunmetal, { bias: 0.1 });
      } else {
        p.rect(3, 3, 14, 19, R.gunmetal[2]);
        p.line(11, 5, 7, 11, R.yellow[5]); p.line(7, 11, 12, 11, R.yellow[5]); p.line(12, 11, 8, 17, R.yellow[5]);
        p.rect(14, 12, 2, 4, R.red[3]);
        for (let x = 3; x < 17; x += 2) p.rect(x, 20, 1, 2, x % 4 === 3 ? R.yellow[4] : R.dark[0]);
      }
    });
    // 珍宝箱：弧顶木箱，铜扣带，金锁
    cont('coffer', 26, 20, (p, o) => {
      p.box(1, 9, 24, 10, R.crate, { r: 1 });
      p.rect(5, 9, 2, 10, R.copper[4]); p.rect(19, 9, 2, 10, R.copper[4]); p.rect(11, 9, 4, 3, R.gold[4]); p.px(12, 10, R.dark[1]);
      if (o) { p.rect(3, 10, 20, 3, DK); p.px(8, 11, R.gold[5]); p.px(14, 11, R.red[4]); p.px(17, 12, R.glass[5]); p.box(2, 0, 22, 6, R.crate, { r: 2 }); p.rect(5, 0, 2, 6, R.copper[4]); p.rect(19, 0, 2, 6, R.copper[4]); }
      else { p.box(1, 2, 24, 8, R.crate, { r: 3 }); p.rect(5, 2, 2, 8, R.copper[4]); p.rect(19, 2, 2, 8, R.copper[4]); p.rect(11, 8, 4, 3, R.gold[5]); p.px(12, 9, R.dark[1]); }
    });
    // 储液罐：立式罐体，警示标，阀门轮
    cont('tankunit', 22, 30, (p, o) => {
      p.box(2, 4, 18, 24, R.plate, { r: 4 });
      p.rect(2, 10, 18, 1, R.dark[2]); p.rect(2, 22, 18, 1, R.dark[2]);
      p.rect(6, 13, 10, 7, R.yellow[4]); p.rect(9, 14, 4, 1, R.dark[1]); p.rect(10, 16, 2, 3, R.dark[1]);
      p.rect(19, 18, 3, 2, R.gunmetal[4]); p.disc(20, 15, 2, R.red[3]);
      p.rect(4, 28, 3, 2, R.gunmetal[2]); p.rect(15, 28, 3, 2, R.gunmetal[2]);
      if (o) { p.rect(5, 2, 12, 3, DK); p.box(12, 0, 9, 2, R.gunmetal, { bias: 0.1 }); }
      else p.box(6, 1, 10, 4, R.gunmetal, { r: 1 });
    });
    return r;
  };
})(D);
