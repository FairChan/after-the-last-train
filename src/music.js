/* 末班之后 · 配乐调度（第二代，P1 起）。曲子和引擎在 src/music/（core / inst / player / tracks-*），这里只管"什么时候放哪首"。
   - 曲池：每个场景一个池子（标题、据点、别的城的中继、线路图、坐车、站里探索、撤离、首领、人物主题……），池里随机挑，最近放过的两首不重复，每次一个新种子挑变奏。
   - 站里不换曲，只换层：探索 0 / 警觉 1（有敌人醒着）/ 交火 2（三个以上醒着）；脱战后 6 秒才往下退。
   - 留白：据点、站里探索的曲子放完一整遍，停 15–45 秒只剩环境声，再挑下一首；一有敌人醒着马上接上。
   - 换曲在小节线上接（撤离、首领、精英、高威胁在下一拍），交叉淡入淡出。
   - 战斗（P4）：首领按四家挑（重型 / 虫群 / 智能 / 空中），残血换第二段；醒着的工程机放精英守关；威胁 4 级以上被三个以上追着放高威胁交火。
   - 剧情（P5）：人物主题 4 首、尾声 2 首（到站了 / 还是延误）、序幕；小剧情屋按场次头的 @music mood_<情绪> 放 6 首情绪曲（站里屋里演的那种也换，演完回站里的曲子）。
   - 结算（P6）：撤出来了 / 壳子毁了各两首，放完一遍换另一首。
   - 短乐句：被发现、撤出来了、信号断了、报站、换层（往下 / 往上）、首领出场；P6 加了撤离开始 / 最后十秒、进站 / 未知信号站、搜到传说 / 至宝、
     读到线索、工坊造好、新城市开了、剧情转折（剧本 @sting twist_dark / twist_reveal）。D.Music.sting(名字)。响的时候主曲压低让一让。
   - 总混音（P6）：爆炸、首领警报、首领倒下这几下大音效响时主曲让 4–5 dB，短乐句不让。
   - 旧名字（hub、calm、danger、extract、boss、map、th_lin……）照认，剧本一行不用改。
   - 设置里"音乐品质"：自动（手机低、电脑高）/ 高 / 低；低档不要混响和磁带，同时发声上限 32。
   D.Music.update(G, dt) 每帧调（main.js）。音乐走 sfx.js 的音乐轨（设置里的"音乐"音量）。设计：design/features/music-v2/design.md */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const M2 = D.Mus2;
  const M = D.Music = { cur: null, pool: null, k: null, x: 0, dangerT: 0, recent: [] };
  // 旧名字 → 曲池（x：这个名字默认的强度）
  const ALIAS = {
    hub: { name: '据点', pool: 'hub' }, map: { name: '线路图', pool: 'map' }, title: { name: '标题', pool: 'title' }, ride: { name: '坐车', pool: 'ride' },
    signal: { name: '未知信号', pool: 'signal' }, nanzhan: { name: '南栈站台', pool: 'nanzhan' },
    relay_tieyuan: { name: '铁原中继', pool: 'relay_tieyuan' }, relay_baisha: { name: '白沙中继', pool: 'relay_baisha' }, relay_beidu: { name: '北渡中继', pool: 'relay_beidu' },
    calm: { name: '站里', pool: 'explore' }, danger: { name: '站里（交火）', pool: 'explore', x: 2 },
    extract: { name: '撤离战', pool: 'extract' }, boss: { name: '首领', pool: 'boss', x: 2 },
    hunt: { name: '高威胁交火', pool: 'hunt', x: 2 }, elite: { name: '精英守关', pool: 'elite', x: 2 },
    th_lin: { name: '林桥', pool: 'th_lin' }, th_ahsun: { name: '阿隼', pool: 'th_ahsun' }, th_lu: { name: '陆峥', pool: 'th_lu' },
    th_e17: { name: 'E-17', pool: 'th_e17' }, th_e17_resolve: { name: 'E-17（到站）', pool: 'th_e17_resolve' },
    prologue: { name: '序幕', pool: 'prologue' }, epi_late: { name: '还是延误', pool: 'epi_late' },
    mood_warm: { name: '温情', pool: 'mood_warm' }, mood_uneasy: { name: '不安', pool: 'mood_uneasy' }, mood_sad: { name: '悲伤', pool: 'mood_sad' },
    mood_absurd: { name: '荒诞', pool: 'mood_absurd' }, mood_tense: { name: '紧张', pool: 'mood_tense' }, mood_mystery: { name: '神秘', pool: 'mood_mystery' },
    res_win: { name: '结算（撤出来了）', pool: 'result_win' }, res_dead: { name: '结算（壳子毁了）', pool: 'result_dead' },
  };
  // 曲池的规矩：rest 放完一遍留白的秒数范围；next 放完一遍直接交叉淡到池里的另一首；beat 换曲不等整小节、下一拍就接
  const CFG = { hub: { rest: [20, 45] }, explore: { rest: [15, 45] }, extract: { beat: true, fade: 0.8 }, boss: { beat: true, fade: 0.8 }, boss2: { beat: true, fade: 0.8 }, hunt: { beat: true, fade: 0.8 }, elite: { beat: true, fade: 0.8 },
    title: { next: true }, map: { next: true }, ride: { next: true }, result: { next: true }, relay_tieyuan: { rest: [20, 45] }, relay_baisha: { rest: [20, 45] }, relay_beidu: { rest: [20, 45] } };
  const cfgOf = p => CFG[p] || CFG[p.split('_')[0]] || {}; // explore_platform 这种按 explore 的规矩
  const LEVEL = 0.5; // 新引擎整体比旧的响，垫回音效下面（和第一代的响度对齐）
  const SPOT_CD = 25; // "被发现"短乐句最快 25 秒一次
  const LOUD = { boom: [4, 0.2], bosswarn: [5, 0.6], bossdie: [5, 0.8] }; // 大音效响时主曲让几分贝、停多久

  // 池里有哪些曲子：pool 写成 'explore_platform' 这种也算 'explore' 池
  M.tracksOf = pool => Object.keys(M2.TRACKS).filter(k => { const T = M2.TRACKS[k]; return !T.once && (T.pool === pool || T.pool.startsWith(pool + '_')); });
  // 给剧情屋 / 测试查的表：旧名字都在
  M.TRACKS = {};
  for (const [k, A] of Object.entries(ALIAS)) { const first = M2.TRACKS[M.tracksOf(A.pool)[0]] || {}; M.TRACKS[k] = { name: A.name, pool: A.pool, bpm: first.bpm, layered: !!first.parts && Object.values(first.parts).some(p => p.layer) }; }
  M.ALIAS = ALIAS;

  let E = null;
  const quality = () => { const q = D.settings && D.settings.musicQ; if (q === 0) return 'low'; if (q === 1) return 'high'; try { return matchMedia('(pointer: coarse)').matches ? 'low' : 'high'; } catch (e) { return 'high'; } };
  M.quality = quality;
  function eng() {
    const ac = D.Sfx && D.Sfx.ctx && D.Sfx.ctx(), bus = D.Sfx && D.Sfx.musicBus && D.Sfx.musicBus(); if (!ac || !bus) return null;
    if (!E || E.ac !== ac) { E = new M2.Engine(ac, bus, { q: quality() }); E.master.gain.value = LEVEL * 0.9; E.run(); M.eng = E; }
    const q = quality(); if (E.q !== q) { E.q = q; E.cap = q === 'low' ? 32 : 64; } // 换档：下一首起生效
    return E;
  }

  function pick(pool) {
    const all = M.tracksOf(pool); if (all.length < 2) return all[0] || null;
    let c = all.filter(k => !M.recent.slice(-2).includes(k)); if (!c.length) c = all.filter(k => k !== M.recent[M.recent.length - 1]);
    return c[Math.floor(Math.random() * c.length)];
  }
  M.pick = pick;
  function start(e, pool, x, opt) {
    opt = opt || {}; const now = e.ac.currentTime, cfg = cfgOf(pool) || {}, key = opt.key || pick(pool);
    M.pool = pool; M.restUntil = 0;
    if (!key) { e.stop(2); M.cur = null; return; }
    const cur = e.cur; let at = now + 0.05;
    if (cur && !cur.end) { const beat = cfg.beat || cfgOf(cur.T.pool).beat, g = cur.nextGrid(at, beat); at = g - now > 2.6 ? cur.nextGrid(at, true) : g; } // 在小节线上接；一小节太长就下一拍
    e.intensity = x; M.ex = x;
    e.play(key, { at, fade: opt.fade ?? cfg.fade ?? 1.5, seed: Math.random() * 1e9 | 0, city: M.city });
    M.cur = key; M.recent.push(key); if (M.recent.length > 6) M.recent.shift();
  }

  // ── 站里探索：按站型和这一层的主题挑音色家族（P3）。地上的环境、检修管道、楼上大厦、换乘层、弹坑这些按楼层算，别的按站型
  const TYPE_FAM = { ruin: 'platform', hospital: 'platform', nest: 'platform', checkpoint: 'platform', flooded: 'platform', market: 'commerce', museum: 'commerce', bank: 'commerce',
    hangar: 'industrial', factory: 'industrial', depot: 'industrial', armory: 'industrial', freight: 'industrial', reserve: 'industrial', traincity: 'industrial',
    datacenter: 'machine', dispatch: 'machine', relay: 'machine', blackout: 'sp_blackout', cache: 'sp_vault', outpost: 'sp_camp', refuge: 'sp_camp', blackmarket: 'sp_camp' };
  const THEME_FAM = { platform: 'platform', tile: 'platform', mall: 'commerce', depot: 'industrial', concrete: 'industrial', lab: 'machine', yard: 'industrial', garage: 'industrial',
    street: 'surface', park: 'surface', rooftop: 'surface', harbor: 'surface', site: 'surface', nightmkt: 'surface', sky: 'surface',
    sewer: 'wet', coldstore: 'wet', cave: 'wet', aquarium: 'glow', greenhouse: 'glow', pipe: 'floor_pipe', office: 'floor_tower', atrium: 'floor', crater: 'sp_crater', town: 'sp_camp' };
  const FLOOR_FIRST = new Set(['yard', 'garage', 'street', 'park', 'rooftop', 'harbor', 'site', 'nightmkt', 'sky', 'sewer', 'coldstore', 'cave', 'aquarium', 'greenhouse', 'pipe', 'office', 'atrium', 'crater', 'town']);
  let thKeys = null;
  const themeKey = th => { if (!th || !D.THEMES) return null; if (!thKeys) { thKeys = new Map(); for (const k in D.THEMES) thKeys.set(D.THEMES[k], k); } if (thKeys.has(th)) return thKeys.get(th); for (const k in D.THEMES) if (D.THEMES[k].pattern === th.pattern && D.THEMES[k].name === th.name) return k; return null; };
  M.famOf = S => {
    if (S.tut) return 'sp_training';
    const F = S.floors && S.floors[S.f], th = themeKey(F && F.th), ty = S.st && S.st.type;
    if (th && FLOOR_FIRST.has(th)) return THEME_FAM[th];
    return TYPE_FAM[ty] || THEME_FAM[th] || 'platform';
  };
  M.poolOf = fam => M.tracksOf('explore_' + fam).length ? 'explore_' + fam : 'explore';
  // ── 首领战（P4）：按首领分四家；残血（有一台掉到一半以下）换到这一家的第二段（boss2_<家>，更快）
  const BOSS_FAM = { boss: 'heavy', bx_hammer: 'heavy', bx_borer: 'heavy', warden: 'heavy', queen: 'swarm', bx_pincer: 'swarm', archivist: 'smart', bx_core: 'smart', bx_crow: 'air', bx_kite: 'air', bx_storm: 'air' };
  M.bossFam = kind => BOSS_FAM[kind] || ((D.ENEMIES[kind] || {}).cls === 'air' ? 'air' : 'heavy');
  M.stung = new WeakSet(); // 放过出场短乐句的首领
  // 据点：岚川是南栈；别的城是当地中继（那座城的曲子）
  const home = G => { const c = G.pf && G.pf.cityAt; return c && c !== 'lanchuan' && ALIAS['relay_' + c] ? 'relay_' + c : 'hub'; };
  // ── 这一帧想要什么：{ k: 旧名字, x: 强度 }
  M.want = function (G, dt) {
    switch (G.mode) {
      case 'title': return { k: 'title', x: 0 };
      case 'result': return { k: G.out && G.out.ok === false ? 'res_dead' : 'res_win', x: 0 }; // 结算：撤出来了 / 壳子毁了
      case 'hub': return { k: G.tab === 'map' ? 'map' : home(G), x: 0 };
      case 'brief': return { k: 'map', x: 0 };
      case 'travel': return { k: 'ride', x: 0 }; // 坐车到下一站、在线路图上挑路
      case 'scene': { // 剧情屋：这一场的主题；没写曲子的：事件站放未知信号，站台那间屋放南栈站台
        let k = D.Scene ? D.Scene.music() : 'hub'; const c = D.Scene && D.Scene.cur, set = c && (c.music || (c.R && c.R.scene.music));
        if (!set && D.EvTalk && D.EvTalk.cur) k = 'signal'; else if (!set && c && D.Dlg.SCENES[c.id] && D.Dlg.SCENES[c.id].room === 'platform') k = 'nanzhan';
        return { k, x: (ALIAS[k] && ALIAS[k].x) || 0 };
      }
      case 'station': {
        const S = G.S; if (!S) return { k: 'calm', x: 0 };
        const rt = S.rt && S.rt.state === 'play' && D.Dlg && D.Dlg.SCENES[S.rt.id], rm = rt && rt.music; // 屋里的剧情在演：放这一场标的情绪曲（站里这时停住）
        if (rm && ALIAS[rm]) return { k: rm, x: ALIAS[rm].x || 0 };
        M.over = S.over || M.over;
        const fam = M.famOf(S);
        if (S.safe) return fam === 'sp_camp' ? { k: 'calm', x: 0, pool: M.poolOf(fam) } : { k: 'hub', x: 0 }; // 人类据点、流民营、黑市：篝火那两首
        const here = S.enemies.filter(e => !e.dead && e.f === S.f && e.aware), bosses = here.filter(e => D.ENEMIES[e.kind].boss);
        if (bosses.length) {
          if (!M.boss) M.boss = { fam: M.bossFam(bosses[0].kind), ph2: false };
          if (bosses.some(e => e.hp <= e.maxHp * 0.5)) M.boss.ph2 = true; // 残血：进第二段，不再退回去
          const bp = (M.boss.ph2 ? 'boss2_' : 'boss_') + M.boss.fam;
          return { k: 'boss', x: 2, pool: M.tracksOf(bp).length ? bp : 'boss', boss: bosses[0] };
        }
        M.boss = null;
        if (S.extract) { const X = S.extract, left = X.dur - X.t; return { k: 'extract', x: X.train || left <= 10 ? 2 : X.t >= X.dur * 0.4 ? 1 : 0 }; }
        if (S.outro) return M.k === 'extract' ? { k: 'extract', x: 2 } : { k: 'calm', x: 0 };
        const n = here.filter(e => !e.migrant).length;
        const tgt = n >= 3 ? 2 : n >= 1 || D.threatLv(S.raid) >= 4 ? 1 : 0;
        if (tgt >= M.x) { M.x = tgt; M.dangerT = 6; } else { M.dangerT -= dt || 0; if (M.dangerT <= 0) { M.x = tgt; M.dangerT = 6; } } // 脱战 6 秒才往下退
        // 精英守关（醒着的工程机）；高威胁交火：威胁 4 级以上、三个以上醒着，探索曲换成追兵的曲子
        if (here.some(e => D.ENEMIES[e.kind].elite)) return { k: 'danger', x: Math.max(1, M.x), pool: 'elite' };
        if (M.x >= 2 && D.threatLv(S.raid) >= 4) return { k: 'danger', x: 2, pool: 'hunt' }; // 脱战 6 秒（强度退下交火）就回探索曲
        return { k: M.x >= 2 ? 'danger' : 'calm', x: M.x, pool: M.poolOf(fam) };
      }
    }
    return { k: M.k || 'hub', x: 0 };
  };

  // 别的文件里发生的事：读到线索、工坊做好、大音效。包一层原来的函数，不用改那些文件（只包一次）
  const clueN = pf => ((pf.story && pf.story.clues) || []).length + ((pf.act2 && pf.act2.clues) || []).length;
  function hooks() {
    if (D.craft && !D.craft.__mus) { const f = D.craft; D.craft = function () { const r = f.apply(this, arguments); if (r) M.sting('st_craft'); return r; }; D.craft.__mus = 1; }
    if (D.Sfx && D.Sfx.play && !D.Sfx.play.__mus) { const f = D.Sfx.play; D.Sfx.play = function (n) { const l = LOUD[n]; if (l && E) E.duck(l[0], l[1]); return f.apply(this, arguments); }; D.Sfx.play.__mus = 1; }
  }
  M.seenP = new WeakSet(); // 放过短乐句的搜刮光柱

  M.update = function (G, dt) {
    const w = M.want(G, dt), e = eng(); if (!e) return;
    hooks();
    const now = e.ac.currentTime, A = ALIAS[w.k] || ALIAS.hub, pool = w.pool || A.pool;
    M.city = (G.pf && G.pf.cityAt) || 'lanchuan'; // 探索曲叠哪座城的颜色
    e.muffle(!!G.paused); // 暂停菜单：隔墙听
    // 短乐句
    if (G.mode === 'station' && G.S && !G.S.tut && w.k !== 'extract' && w.k !== 'boss' && w.x >= 1 && !(M.ex >= 1) && now - (M.spotAt || -99) > SPOT_CD) { M.spotAt = now; M.sting('st_spotted'); }
    if (G.mode === 'result' && M.mode === 'station') M.sting(M.over === 'dead' ? 'st_death' : 'st_clear');
    if (w.boss && !M.stung.has(w.boss)) { M.stung.add(w.boss); M.sting('st_boss_' + M.boss.fam); } // 首领出场：每台一次
    if (G.mode !== M.mode) { M.mode = G.mode; if (G.mode !== 'station') { M.over = null; M.boss = null; } }
    // 换层：往下 / 往上各一段短乐句（主曲不换）
    const S = G.mode === 'station' ? G.S : null;
    if (S && M.floorS === S && S.f !== M.floorF && !S.intro) M.sting(S.f > M.floorF ? 'st_floor_down' : 'st_floor_up');
    M.floorS = S; M.floorF = S ? S.f : null;
    if (S && !S.tut) { // 进站（未知信号站换一段）、撤离开始 / 最后十秒、搜出传说 / 至宝
      if (M.arrS !== S) { M.arrS = S; M.sting(S.st && S.st.type === 'event' ? 'st_signal' : 'st_arrive'); }
      const X = S.extract;
      if (X && M.exX !== X) { M.exX = X; M.ex10 = false; M.sting('st_extract_go'); }
      if (X && !M.ex10 && !X.train && X.dur > 14 && X.dur - X.t <= 10) { M.ex10 = true; M.sting('st_extract_10'); }
      for (const pl of S.pillars || []) if (pl.q >= 4 && !M.seenP.has(pl)) { M.seenP.add(pl); M.sting(pl.q >= 5 ? 'st_loot_red' : 'st_loot_gold'); }
    }
    const pf = G.pf; // 读到线索、新城市开了：数一数，多了就响（换了存档从头数）
    if (pf) { const n = clueN(pf), c = (pf.cityOpen || []).length; if (M.pfSeen === pf) { if (n > M.clueN) M.sting('st_clue'); if (c > M.cityN) M.sting('st_city'); } M.pfSeen = pf; M.clueN = n; M.cityN = c; }
    M.k = w.k;
    if (pool !== M.pool) return start(e, pool, w.x);
    if (w.x !== M.ex) { M.ex = w.x; e.setIntensity(w.x); }
    // 留白：放完一整遍、没在打，就停一会儿；一有动静马上接上
    const cfg = cfgOf(pool);
    if (cfg && cfg.rest) {
      if (M.restUntil) { if (w.x > 0 || now >= M.restUntil) start(e, pool, w.x, { fade: w.x > 0 ? 0.8 : 3 }); }
      else if (e.cur && e.cur.rounds >= 1 && w.x === 0) { const at = e.cur.nextGrid(now + 0.05); e.stop(4, at); M.cur = null; M.restUntil = at + 4 + cfg.rest[0] + Math.random() * (cfg.rest[1] - cfg.rest[0]); }
    } else if (cfg && cfg.next && e.cur && e.cur.rounds >= 1 && M.tracksOf(pool).length > 1) start(e, pool, w.x, { fade: 4 }); // 放完一遍换池里另一首
  };
  M.play = function (key) { const e = eng(), A = ALIAS[key]; if (!e || !A) return; M.k = key; if (A.pool !== M.pool) start(e, A.pool, A.x || 0); };
  M.stop = function () { if (E) E.stop(0.6); M.pool = null; M.cur = null; };
  M.sting = function (key) { const e = eng(), k = M2.TRACKS[key] ? key : 'st_' + key; if (!e || !M2.TRACKS[k] || !M2.TRACKS[k].once) return null; return e.sting(k); };

  // 测试用：离线把一首（旧名字取池里第一首）渲染 sec 秒，返回 { rms, peak, notes }
  M.renderOffline = async function (key, sec, opt) {
    const A = ALIAS[key], tk = A ? M.tracksOf(A.pool)[0] : key, x = A ? A.x || 0 : 0;
    const b = await M2.render(tk, sec, Object.assign({ sr: 22050, timeline: [[0, x]], seed: 1 }, opt)), L = b.getChannelData(0), R = b.getChannelData(1);
    let sum = 0, peak = 0, nan = 0; for (let i = 0; i < L.length; i++) { const l = L[i], r = R[i]; if (l !== l || r !== r) { nan++; continue; } sum += (l * l + r * r) / 2; peak = Math.max(peak, Math.abs(l), Math.abs(r)); }
    return { key: tk, rms: Math.sqrt(sum / L.length), peak, nan, notes: b.notes, dropped: b.dropped };
  };
})(D);
