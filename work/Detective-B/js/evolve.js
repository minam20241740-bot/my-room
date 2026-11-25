// evolve-and-impact: 친구의 진화(예전 게임의 2·3단계 모델과 이름)와 진화 장면.
// 규칙: 편성에 넣고 함께 사건(또는 의뢰·진정)을 하나 끝낼 때마다 유대가 1 오르고, 1이면 2단계, 2면 3단계가 된다.
;(function () {
  'use strict';
  var GB = window.GB, S = window.Stage3D, G = window.GAME;
  if (!GB || !S || !G || window.Evolve) return;
  var EVO = {"malangbul": {"color": "#efb14e", "accent": "#d95744", "el": "빛", "stages": [{"id": "malangbul", "name": "말랑불", "img": "img/malangbul.png", "h": 0.6}, {"id": "malangbul_s2", "name": "불빛꼬리", "img": "img/evo/malangbul_s2.png", "h": 0.7}, {"id": "malangbul_s3", "name": "등불수호", "img": "img/evo/malangbul_s3.png", "h": 0.8}]}, "bangului": {"color": "#7dc7e0", "accent": "#f1e4c5", "el": "물", "stages": [{"id": "bangului", "name": "방울이", "img": "img/bangului.png", "h": 0.6}, {"id": "bangului_s2", "name": "물결방울", "img": "img/evo/bangului_s2.png", "h": 0.7}, {"id": "bangului_s3", "name": "해류수호", "img": "img/evo/bangului_s3.png", "h": 0.8}]}, "mongeul": {"color": "#c5b5db", "accent": "#efc35a", "el": "전기", "stages": [{"id": "mongeul", "name": "몽글번개", "img": "img/mongeul.png", "h": 0.6}, {"id": "mongeul_s2", "name": "뇌운몽글", "img": "img/evo/mongeul_s2.png", "h": 0.7}, {"id": "mongeul_s3", "name": "천둥수호", "img": "img/evo/mongeul_s3.png", "h": 0.8}]}}, THEME = {"bg": "#0f5fa8", "hi": "#ffd92e"};
  var stage = document.getElementById('stage');
  var save = function () { return GB.save; };
  var bond = function () { var s = save(); if (!s.bond || typeof s.bond !== 'object') s.bond = {}; return s.bond; };
  var stageOf = function (k) { var e = EVO[k]; return e ? Math.min(e.stages.length, 1 + (bond()[k] || 0)) : 1; };
  var info = function (k, st) { var e = EVO[k]; return e ? e.stages[(st || stageOf(k)) - 1] : null; };
  var party = function () { return (save().party || []).filter(function (k) { return !!EVO[k]; }); };
  var store = function () { try { GB.store(); } catch (e) {} };

  // 화면에 보이는 이름과 그림을 지금 단계로 맞춘다(편성, 도감, 친구 화면이 모두 G.friends를 읽는다)
  function applyNames() {
    Object.keys(EVO).forEach(function (k) {
      var f = G.friends && G.friends[k], d = info(k); if (!f || !d) return;
      if (!f._base) f._base = { name: f.name, img: f.img };
      f.name = stageOf(k) > 1 ? d.name : f._base.name; f.img = stageOf(k) > 1 ? d.img : f._base.img; f.stage = stageOf(k);
    });
  }

  // 1) 3D 모델: 동행을 세우는 호출점(field.js의 pals, C안 world.js의 pal)에서만 부른다. 야생·상대·영입 장면의 같은 키는 건드리지 않는다.
  //    make(k, h)는 호출점이 원래 쓰던 배우 만들기, baseH는 원래 넘기던 키(m)다.
  function pal(key, make, baseH) {
    var e = EVO[key], st = e ? stageOf(key) : 1;
    if (!e || st < 2) return make(key, baseH);
    var d = e.stages[st - 1];
    try {
      var a = make(d.id, (baseH || e.stages[0].h) * d.h / e.stages[0].h); a.key = key; a.evo = d.id;
      // 예전 2·3단계 모델에는 달리기·살피기 동작이 없다. 걷기·기술 동작으로 대신해 제자리에서 미끄러지지 않게 한다.
      if (a.clips) { if (!a.clips.run && a.clips.walk) a.clips.run = a.clips.walk; if (!a.clips.inspect && a.clips.use) a.clips.inspect = a.clips.use; if (!a.clips.skill && a.clips.use) a.clips.skill = a.clips.use; }
      return a;
    } catch (err) { return make(key, baseH); }
  }

  // 진화 장면이 떠 있는 동안에는 3D 장면을 멈춘다(C안처럼 실시간으로 움직이는 곳에서 화면 뒤로 일이 벌어지지 않게).
  var start0 = S.start, stop0 = S.stop, lastTick = null, running = false;
  if (typeof start0 === 'function' && typeof stop0 === 'function') {
    S.start = function (t) { lastTick = t || null; running = true; return start0.apply(S, arguments); };
    S.stop = function () { running = false; return stop0.apply(S, arguments); };
  }
  function hold() { if (!running || typeof stop0 !== 'function') return function () {}; stop0.call(S); return function () { if (running) start0.call(S, lastTick); }; }

  // 2) 진행 감시: 끝낸 일이 늘면, 그 전부터 편성에 있던 친구의 유대가 오른다
  function progress() {
    var s = save(), w = s.world || {}, n = (s.cleared || []).length;
    if (w.calm) n += Object.keys(w.calm).length;
    if (w.done) n += Object.keys(w.done).length;
    return n;
  }
  var queue = [], playing = false, prevParty = null;
  function tick() {
    var s = save(), p = progress();
    if (s.bondAt == null || p < s.bondAt) { s.bondAt = p; if (p === 0) { s.bond = {}; s.bondFinal = 0; } prevParty = party(); applyNames(); store(); return; }
    if (prevParty == null) prevParty = party();
    if (p > s.bondAt) {
      s.bondAt = p;
      prevParty.forEach(function (k) {
        if (party().indexOf(k) < 0) return;
        var before = stageOf(k); bond()[k] = (bond()[k] || 0) + 1; var after = stageOf(k);
        if (after > before) queue.push({ k: k, from: before, to: after });
      });
      applyNames(); store();
    }
    // 네 사건을 모두 끝내면, 끝까지 편성에 있던 친구는 마지막 모습이 된다(3단계에는 두 발로 서는 모습이 있다)
    if (!s.bondFinal && G.cases && G.cases.length && G.cases.every(function (c) { return (s.cleared || []).indexOf(c.id) >= 0; })) {
      s.bondFinal = 1;
      party().forEach(function (k) {
        var max = EVO[k].stages.length, before = stageOf(k);
        if (before < max) { bond()[k] = max - 1; queue.push({ k: k, from: before, to: max, last: true }); }
      });
      applyNames(); store();
    }
    prevParty = party();
    if (queue.length && !playing && idle()) play(queue.shift());
  }
  function idle() { return !document.querySelector('#story.on, #pop.on, #card.on, #loading.on, #evo'); }

  // 3) 진화 장면
  function el(tag, cls, parent, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; parent.appendChild(e); return e; }
  function snd(n) { try { GB.snd(n); } catch (e) {} }
  function play(job, done) {
    var e = EVO[job.k], a = e.stages[job.from - 1], b = e.stages[job.to - 1]; playing = true;
    var resume = hold();
    var o = el('div', 'evo', stage); o.id = 'evo'; o.style.setProperty('--c', e.color); o.style.setProperty('--a', e.accent);
    o.style.setProperty('--bg', THEME.bg); o.style.setProperty('--hi', THEME.hi); o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', a.name + ' 진화');
    el('div', 'evo-bg', o); el('div', 'evo-rays', o);
    for (var r = 0; r < 3; r++) el('div', 'evo-ring r' + r, o);
    var sp = el('div', 'evo-sparks', o);
    for (var i = 0; i < 28; i++) { var s = el('span', '', sp); var ang = i / 28 * 360 + (i % 2) * 6, dist = 420 + (i * 53) % 300; s.style.setProperty('--r', ang + 'deg'); s.style.setProperty('--d', dist + 'px'); s.style.setProperty('--t', (0.5 + (i % 5) * 0.09) + 's'); s.style.setProperty('--w', (10 + (i % 4) * 6) + 'px'); }
    var pic = el('div', 'evo-pic', o);
    el('i', 'evo-old', pic).style.backgroundImage = 'url(' + a.img + ')';
    el('i', 'evo-new', pic).style.backgroundImage = 'url(' + b.img + ')';
    el('div', 'evo-flash', o);
    var cap = el('div', 'evo-cap', o, '<small>' + e.el + ' · ' + job.to + '단계</small><p class="evo-names"><b>' + a.name + '</b><span></span><b class="to">' + b.name + '</b></p><p class="evo-line">' + (job.last ? '1부를 끝까지 함께해 마지막 모습이 되었다.' : '함께 사건을 풀며 모습이 달라졌다.') + '</p>');
    var ok = el('button', 'evo-ok', o, '<span>확인</span>'); ok.type = 'button';
    snd('open');
    setTimeout(function () { o.classList.add('s2'); snd('pop'); }, 1900);
    setTimeout(function () { o.classList.add('s3'); ok.focus({ preventScroll: true }); }, 2500);
    var close = function () { if (!o.parentNode) return; o.classList.add('out'); setTimeout(function () { o.remove(); playing = false; try { if (window.EvolveRefresh) window.EvolveRefresh(); } catch (x) {} resume(); if (done) done(); }, 260); };
    ok.onclick = close;
    o.addEventListener('click', function (ev) { if (ev.target !== ok && o.classList.contains('s3')) close(); });
    o.addEventListener('keydown', function (ev) { if (o.classList.contains('s3') && (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Escape')) { ev.preventDefault(); ev.stopPropagation(); close(); } });
    void cap;
  }

  applyNames();
  setInterval(tick, 700);
  window.Evolve = { EVO: EVO, stageOf: stageOf, info: info, pal: pal, play: play, tick: tick, applyNames: applyNames };
})();
