/* 英文：冷却加长后的消耗品说明（cooldown.js） */
var D = globalThis.D || (globalThis.D = {});
D.I18N.add({
  '读条 0.4 秒，回复 10 耐久（没有维修包时按 C 用它）。用完 5 秒内不能再用药': 'Use time 0.4s, restores 10 armor (C uses it when you have no repair kit). No more healing for 5s after',
  '读条 0.25 秒，回复 18 耐久；用完 6 秒内不能再用药': 'Use time 0.25s, restores 18 armor; no more healing for 6s after',
  '读条 1.5 秒，回复 30 耐久。挨打会打断（药不消耗）；用完 10 秒内不能再用药': 'Use time 1.5s, restores 30 armor. Getting hit interrupts it (not consumed); no more healing for 10s after',
  '读条 1.8 秒，回复 55 耐久。挨打会打断（药不消耗）；用完 14 秒内不能再用药': 'Use time 1.8s, restores 55 armor. Getting hit interrupts it (not consumed); no more healing for 14s after',
  '获得 20 护盾；用完 8 秒内不能再用护盾电池': 'Gain 20 shield; no more shield cells for 8s after',
  '读条 0.8 秒，获得 35 护盾（背包里没有护盾电池时按 V 用）；用完 12 秒内不能再用护盾电池': 'Use time 0.8s, gain 35 shield (V uses it when you have no shield cell); no more shield cells for 12s after',
  '读条 1 秒，获得 55 护盾；用完 16 秒内不能再用护盾电池': 'Use time 1s, gain 55 shield; no more shield cells for 16s after',
});
