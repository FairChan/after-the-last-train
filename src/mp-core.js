/* 末班之后 · 多人联机（MP0 多玩家就绪）：一个站里有好几个玩家
   做法（design/features/multiplayer/design.md §11）：老代码到处读 S.player、S.raid、S.lootOpen……；不一处处改，
   而是每个玩家各有一份"自己的那几样"（下面的 PF），轮到谁就把谁的那份换到 S 上（D.MP.use），老代码照常读 S.player。
   - 房主每步：先用房主的视角走一遍 D.stepStation（他自己 + 整个世界：敌人、子弹、车、计时），
     再对每个队友换上他的视角、开 S.ponly 走一遍（只走"这个人"：移动、开枪、交互、面板），世界不再走第二遍。
   - 敌人：每个敌人自己挑一个人追（最近的、刚打它的优先），走它那一步时换成那个人的视角，老的 target(S) / damagePlayer 照用。
   - 子弹、手雷记着是谁打的（o.pl），打中时换成那个人的视角结算（击毁数、电容、回血归他）。
   - 联机时不停世界：打击顿帧 S.stop、完美闪避慢动作 S.slowmo 都不放；换层全队一起（楼梯口全队到齐），电梯停用。
   单人时 S.players 只有一个人，从来不换视角，这些都不走。 */
var D = globalThis.D || (globalThis.D = {});
(function (D) {
  'use strict';
  const K = D.K || (D.K = {}), TS = 16;
  // 每个玩家自己的那几样（换视角时整组换）
  const PF = ['player', 'raid', 'SH', 'mods', 'lootOpen', 'talk', 'prompt', 'near', 'fpick', 'holdF', 'cam', 'camShift', 'hitMark', 'hurtDirs', 'recoil',
    'stairCd', 'noAmmoT', 'heartT', 'beat', 'decoy', 'scanT', 'flow', 'flowT', 'kills', 'events', 'ibuf', 'dt', 'shotsFired', 'trade', 'groundNear', 'fsel', 'quickOpen'];
  const MP = D.MP = { PF, MAX: 4 };

  // 换到 p 的视角；返回原来那个人
  MP.use = function (S, p) {
    const cur = S.player; if (!p || cur === p) return cur;
    const a = cur.ctx || (cur.ctx = {}), b = p.ctx;
    for (const k of PF) { a[k] = S[k]; S[k] = b[k]; }
    S.player = p;
    return cur;
  };
  MP.on = S => !!(S && S.players && S.players.length > 1);
  // 全队都"出局"了（倒下 / 上车 / 撤出 / 被留下 / 失联）：这一站结束。有人撤出 = 撤离成功；有人上车 = 去下一站；不然 = 全灭
  MP.teamOver = function (S) {
    if (S.over || S.players.some(p => !p.out)) return;
    const o = S.players.map(p => p.out);
    S.over = o.includes('extracted') ? 'extracted' : o.includes('boarded') ? 'leave' : 'dead'; S.endT = 0;
  };
  // 进站时：S.players = [这个人]；S.me = 本机这个人（镜头、HUD、背包面板跟着他）
  MP.init = function (S) { if (!S.player) return S; S.player.pid = 0; S.players = [S.player]; S.me = S.player; return S; };
  // 加一个队友（房主这边）：raid 是他自己的配装（net/host.js 从他的存档建）；站在房主旁边
  MP.addPlayer = function (S, raid, info) {
    const host = S.players[0]; if (S.player !== host) MP.use(S, host);
    const SH = K.shellOf(raid), p = K.makePlayer(S, raid, SH, S.tut), i = S.players.length;
    p.pid = i; p.name = (info && info.name) || ('P' + (i + 1)); p.x = host.x + (i % 2 ? 1 : -1) * 12 * Math.ceil(i / 2); p.y = host.y + 2;
    if (D.solidAt(S.A, p.x, p.y)) p.x = host.x;
    p.inv = Math.max(p.inv, host.inv); if (D.playerAct && !S.intro) D.playerAct(p, 'stand', 0.75);
    for (const q of p.scarf) { q.x = q.px = p.x; q.y = q.py = p.y - 8; }
    p.ctx = { player: p, raid, SH, mods: raid.modsAtStart || null, lootOpen: null, talk: null, prompt: null, near: null, fpick: null, holdF: 0, cam: { x: S.cam.x, y: S.cam.y }, camShift: 0,
      hitMark: null, hurtDirs: [], recoil: 0, stairCd: 0, noAmmoT: 0, heartT: 0, beat: 0, decoy: null, scanT: 0, flow: null, flowT: 0, kills: 0, events: [], ibuf: null, dt: 0, shotsFired: 0, trade: null, groundNear: [], fsel: undefined, quickOpen: null };
    S.players.push(p);
    return p;
  };
  // 拿某个人的"自己的那几样"（不换视角）：本人在台上就读 S，不在就读他的 ctx
  MP.of = (S, p, k) => (S.player === p ? S[k] : p.ctx && p.ctx[k]);
  // 楼梯口：全队（活着、没撤出的）有几个在 r 以内；单人时 null
  MP.team = function (S, x, y, r) {
    if (!MP.on(S)) return null;
    const live = S.players.filter(q => !q.out && !q.gone);
    return { all: live.length, near: live.filter(q => Math.hypot(q.x - x, q.y - y) < r).length };
  };

  // 敌人挑一个人追：活着的人里最近的；刚打它的那个（2 秒内）、正在追的那个优先一点；倒地的人排后面。换成那个人的视角
  MP.pick = function (S, e) {
    let best = null, bd = 1e9;
    for (const p of S.players) {
      if (p.hp <= 0 || p.out || p.gone) continue;
      let d = Math.hypot(p.x - e.x, p.y - e.y);
      if (p.pid === e.tp) d *= 0.75;
      if (p.pid === e.hitBy && S.t - e.hitT < 2) d *= 0.5;
      if (p.down) d *= 3;
      if (d < bd) { bd = d; best = p; }
    }
    return best || S.players[0];
  };
  MP.aim = function (S, e) { const p = MP.pick(S, e); e.tp = p.pid; MP.use(S, p); };

  // ── 房主一步：inps[i] 是第 i 个人这一步的输入（队友的带 ax / ay 瞄准点）
  MP.stepAll = function (S, dt, inps) {
    const PL = S.players;
    if (!MP.on(S)) return D.stepStation(S, dt, inps[0] || {});
    const host = PL[0], I = D.Input; MP.use(S, host);
    S.stop = 0; S.slowmo = 0; // 联机不停世界
    S.ponly = false; D.stepStation(S, dt, inps[0] || {}); tag(S, host);
    const wx = I.wx, wy = I.wy, HR = S.raid;
    for (let i = 1; i < PL.length; i++) {
      const p = PL[i]; if (p.gone) continue;
      MP.use(S, p);
      S.raid.alert = HR.alert; // 威胁等级全队一样（房主的）
      if (S.intro || S.lift || S.stairWalk) { follow(S, host, p, i); continue; } // 下车过场 / 坐电梯 / 走楼梯时跟着房主
      S.ponly = true;
      try { D.stepStation(S, dt, inps[i] || { mx: 0, my: 0 }); } finally { S.ponly = false; }
      tag(S, p);
    }
    MP.use(S, host); I.wx = wx; I.wy = wy;
  };
  // 子弹、手雷、地雷记着是谁的
  function tag(S, p) { for (const k of ['shots', 'nades', 'mines']) for (const o of S[k]) if (!o.pl) o.pl = p; }
  function follow(S, host, p, i) { p.x = host.x + (i % 2 ? 1 : -1) * 12 * Math.ceil(i / 2); p.y = host.y + 2; p.vx = p.vy = 0; p.aim = host.aim; p.walk = host.walk; p.inv = Math.max(p.inv, host.inv); if (K.scarf) K.scarf(S, p); }

  // 队友脚边能捡的东西 + 自动捡（同 loot.js 的 dropsStep 后半段）
  K.mpNear = function (S) {
    const p = S.player, ST = D.settings || {};
    S.groundNear = p.hp > 0 && !p.out && !S.over ? S.ground.filter(g => g.f === S.f && !g.dropped && g.t > 0.35 && Math.hypot(g.x - p.x, g.y - p.y) < D.TUNE.groundR) : [];
    for (const g of S.groundNear) {
      if (g.auto || g.dropped || g.t < 0.6) continue;
      const it = D.itemInfo(g.id), want = (ST.autoAmmo && g.id.startsWith('ammo:')) || (ST.autoMeds !== false && it.kind === 'use') || (ST.autoQ >= 0 && it.kind === 'item' && it.q >= ST.autoQ);
      if (want) { g.auto = true; D.takeGround(S, g, true); }
    }
  };
  // 画别人：只换人、型号、改装件、手里的东西（镜头不换）
  const DRAW = ['player', 'SH', 'mods', 'raid', 'decoy'];
  MP.drawAs = function (S, p, fn) {
    const keep = DRAW.map(k => S[k]), c = p.ctx || {};
    for (const k of DRAW) S[k] = k === 'player' ? p : c[k];
    try { fn(); } finally { DRAW.forEach((k, i) => { S[k] = keep[i]; }); }
  };
  // 画面上的字（屏幕坐标）：像素字体，带一圈墨色描边（中文也画得出；切英文时 fillText 会被翻译）
  MP.txt = function (ctx, s, x, y, col, align) {
    ctx.save(); ctx.font = D.PXF || '12px PixelZH, monospace'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#0b0a14'; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]]) ctx.fillText(s, Math.round(x) + dx, Math.round(y) + dy);
    ctx.fillStyle = col; ctx.fillText(s, Math.round(x), Math.round(y)); ctx.restore();
  };
  MP.drawTag = function () {}; // 名字画在 mp-coop.js 的屏幕层

  // ── 挂钩
  const es0 = D.enterStation;
  D.enterStation = function (raid, st, step, o) { const S = es0.apply(this, arguments); if (S && o && o.shadow) S.rt = null; return S ? MP.init(S) : S; };
  // 谁开的箱子（面板弹给谁）
  const so0 = K.startOpen;
  if (so0) K.startOpen = function (S, c) { if (MP.on(S)) c.openBy = S.player.pid; return so0.apply(this, arguments); };
  // 联机：只有房主能和人说话、交易（对话、交易面板只在房主那边），队友按 F 提示一下
  if (D.Pick && D.Pick.list) {
    const pl0 = D.Pick.list;
    D.Pick.list = function (S) {
      const C = pl0.apply(this, arguments);
      if (MP.on(S) && S.player !== S.players[0] && C && C.add) {
        const add0 = C.add;
        C.add = o => { const r = o && o.ref; if (r && (r === S.trader || (S.people && S.people.includes(r)) || o.talk || o.npc)) return add0(Object.assign(o, { key: '', text: '联机时只有房主能和人说话、交易', go: null })); return add0(o); };
      }
      return C;
    };
  }
  // 联机时电梯停用（坐电梯会停住整个世界，全队只能走楼梯一起换层）
  const cx0 = K.candX;
  K.candX = function (S, add) {
    if (!MP.on(S) || !cx0) return cx0 && cx0(S, add);
    return cx0(S, o => (S.A.lift && o.ref === S.A.lift ? add(Object.assign(o, { key: '', text: '联机时电梯停用：全队走楼梯', go: null })) : add(o)));
  };
})(D);
