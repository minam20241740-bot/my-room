'use strict';
/* 도시의 몬스터와 탐정 사무소 A·B·C 공용.
   1) 폰·태블릿인지 컴퓨터인지 알려 준다: DeviceHint.touch, DeviceHint.pick(컴퓨터 글, 폰 글), 글자 칸에 쓰는 class kb-only(컴퓨터에서만) · tc-only(폰에서만)
   2) 폰이 그래픽 메모리를 비워 3D 화면이 멈추면(webglcontextlost) 게임이 죽지 않고 안내와 '이어서 하기' 단추를 보여 준다. 화면이 저절로 돌아오면 안내가 사라진다
   3) 세로로 든 폰에는 가로로 돌리라는 안내를 잠깐 보여 준다 */
(function () {
  const mq = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const touch = mq('(hover:none)') || mq('(pointer:coarse)');
  window.DeviceHint = { touch: touch, pick: (pc, phone) => (touch ? phone : pc) };
  document.documentElement.classList.add(touch ? 'dv-touch' : 'dv-pc');

  const style = document.createElement('style');
  style.textContent = `
  @media (hover:none),(pointer:coarse){.kb-only{display:none!important}}
  @media (hover:hover) and (pointer:fine){.tc-only{display:none!important}}
  html.dv-touch .sskip{height:96px;padding:0 46px;font-size:36px}
  .dv-lost{position:fixed;inset:0;z-index:2147483300;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,10,24,.88);font-family:Pretendard,system-ui,sans-serif;color:#fff;text-align:center}
  .dv-lost div{max-width:420px}
  .dv-lost b{display:block;font-size:20px;font-weight:800;margin-bottom:8px}
  .dv-lost p{margin:0 0 14px;font-size:15px;line-height:1.5;color:#dfe6ff}
  .dv-lost button{min-width:150px;min-height:48px;padding:0 22px;border:0;border-radius:10px;background:#ffe9a8;color:#101d42;font-family:inherit;font-weight:800;font-size:17px;cursor:pointer}
  .dv-turn{position:fixed;left:50%;top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);z-index:2147483100;width:max-content;max-width:calc(100% - 24px);padding:9px 16px;border-radius:10px;background:rgba(5,10,24,.9);border:1px solid #ffffff59;color:#fff;font:700 14px/1.35 Pretendard,system-ui,sans-serif;text-align:center}`;
  document.head.appendChild(style);

  // ── 3D 화면이 멈췄을 때 ──
  const lost = new Set(); let box = null, waitT = 0;
  const msg = (title, text, label, fn) => {
    if (!box) { box = document.createElement('div'); box.className = 'dv-lost'; box.setAttribute('role', 'alertdialog'); document.body.appendChild(box); }
    box.innerHTML = '<div><b></b><p></p><button type="button"></button></div>';
    box.querySelector('b').textContent = title; box.querySelector('p').textContent = text;
    const bt = box.querySelector('button'); bt.textContent = label; bt.onclick = fn; try { bt.focus({ preventScroll: true }); } catch (e) {}
  };
  const hide = () => { clearTimeout(waitT); if (box) { box.remove(); box = null; } };
  const reload = () => { try { location.reload(); } catch (e) {} };
  // 브라우저가 3D 화면을 다시 살리면(webglcontextrestored) 안내가 저절로 사라지고 게임이 이어진다. 끝내 안 돌아오면 이 단추로 새로 불러온다(저장된 기록은 그대로)
  const resume = () => { if (!lost.size) { hide(); return; } msg('다시 불러오는 중', '잠시만 기다려 주세요.', '기다리는 중', () => {}); setTimeout(reload, 300); };
  const show = () => msg('화면이 잠깐 멈췄어요', '폰이 그래픽 메모리를 비웠어요. 잠시 기다리면 저절로 돌아올 때가 많아요. 계속 멈춰 있으면 아래 단추를 눌러 주세요.', '이어서 하기', resume);
  // webglcontextlost는 위로 올라가지 않으므로 캡처 단계에서 듣는다(three.js의 처리는 그대로 두고 안내만 얹는다)
  document.addEventListener('webglcontextlost', e => { lost.add(e.target); show(); }, true);
  document.addEventListener('webglcontextrestored', e => { lost.delete(e.target); if (!lost.size) hide(); }, true);

  // ── 세로로 든 폰 ──
  if (touch) {
    let bar = null, barT = 0, last = -1e9;
    const portrait = () => innerHeight > innerWidth * 1.05;
    const drop = () => { clearTimeout(barT); if (bar) { bar.remove(); bar = null; } };
    const check = () => {
      if (!portrait()) { drop(); return; }
      if (bar || Date.now() - last < 30000) return;
      last = Date.now(); bar = document.createElement('div'); bar.className = 'dv-turn'; bar.textContent = '휴대폰을 가로로 돌리면 화면이 더 커져요.';
      bar.addEventListener('pointerdown', drop); document.body.appendChild(bar); barT = setTimeout(drop, 8000);
    };
    addEventListener('resize', check); addEventListener('orientationchange', () => setTimeout(check, 200));
    if (document.body) check(); else addEventListener('DOMContentLoaded', check);
  }
})();
