'use strict';

(function () {
  const G = window.GAME;
  G.models.ally_noel = { file: 'assets/chr/ally_noel.glb', height: 1, grounded: true };
  G.world.npcs.push({
    id: 'ally_noel', model: 'ally_noel', size: 1, name: '노엘', role: '도시의 현장 안내인',
    x: 8.8, z: -10.9, ry: Math.PI,
    when: save => save.cleared.includes('clock'),
    lines: [
      { who: 'ally_noel', text: '별빛도시 현장 안내를 맡은 노엘이야. 시계 열쇠를 찾아 준 덕에 동쪽 길을 다시 열었어.' },
      { who: 'ally_noel', text: '광장에서 동쪽으로 가면 별빛 역, 북쪽 길은 시계탑 거리야. 길이 갈라지는 곳에선 열차 지도를 열면 돼.' }
    ]
  });
})();
