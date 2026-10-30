// ===== 스토리 장면 (오프닝 · 장 삽화 · 엔딩) =====
// Story.play({ video?, scenes: [{ img, title?, text }] }) -> Promise
// 삽화 위로 천천히 움직이는 카메라(켄 번즈)와 한 글자씩 찍히는 자막. 터치 = 다음, 건너뛰기 버튼 = 종료.
const Story = (() => {
  const $ = (s) => document.querySelector(s);
  let typing = null, resolveAll = null, scenes = [], idx = 0, started = 0, narr = null;
  function playNarration(src) {
    stopNarration(); if (!src) return;
    try { narr = new Audio(src); narr.volume = 1; const p = narr.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { narr = null; }
  }
  function stopNarration() { if (narr) { try { narr.pause(); } catch (e) { /* 무시 */ } narr = null; } }
  const KB = ['kb-a', 'kb-b', 'kb-c', 'kb-d'];   // 카메라 움직임 종류를 번갈아 씀

  function stopTyping() { if (typing) { clearInterval(typing); typing = null; } }
  function typeText(el, text) {
    stopTyping(); el.textContent = ''; let i = 0;
    typing = setInterval(() => { i++; el.textContent = text.slice(0, i); if (i >= text.length) stopTyping(); }, 38);
  }
  function preload(src) { if (src) { const im = new Image(); im.src = src; } }

  function showScene(i) {
    const s = scenes[i]; if (!s) { finish(); return; }
    idx = i; started = Date.now();
    const img = $('#storyImg');
    img.classList.remove(...KB); void img.offsetWidth;   // 애니메이션 재시작
    img.style.backgroundImage = s.img ? `url(${s.img})` : 'none';
    img.classList.add(KB[i % KB.length]);
    $('#storyTitle').textContent = s.title || '';
    $('#storyTitle').classList.toggle('hidden', !s.title);
    typeText($('#storyText'), s.text || '');
    playNarration(s.audio);
    $('#storyHint').textContent = i < scenes.length - 1 ? '▼ 터치해서 계속' : '▼ 터치해서 시작';
    if (scenes[i + 1]) preload(scenes[i + 1].img);
  }
  function onTap(e) {
    e.preventDefault();
    if (Date.now() - started < 250) return;
    const el = $('#storyText'), s = scenes[idx];
    if (typing) { stopTyping(); el.textContent = s.text || ''; return; }
    showScene(idx + 1);
  }
  function finish() {
    stopTyping(); stopNarration();
    const v = $('#storyVideo'); v.pause(); v.removeAttribute('src'); v.load(); v.classList.add('hidden');
    $('#story').classList.add('hidden');
    $('#storyStage').removeEventListener('pointerdown', onTap);
    const r = resolveAll; resolveAll = null; if (r) r();
  }
  // 동영상(있으면)을 먼저 틀고, 끝나거나 실패하면 삽화 장면으로 넘어간다
  function playVideo(src) {
    return new Promise((res) => {
      const v = $('#storyVideo');
      let done = false, played = false;
      const end = () => { if (!done) { done = true; v.classList.add('hidden'); v.pause(); res(played); } };
      v.muted = false; v.playsInline = true; v.src = src; v.classList.remove('hidden');
      v.onended = end; v.onerror = end; v.onplaying = () => { played = true; };
      const tryPlay = () => { const p = v.play(); if (p && p.catch) p.catch(() => { if (!v.muted) { v.muted = true; tryPlay(); } else end(); }); };
      tryPlay();
      $('#storyVideoSkip').onclick = (e) => { e.stopPropagation(); played = true; end(); };
      setTimeout(() => { if (!done && !played) end(); }, 6000);   // 6초 안에 못 틀면 건너뜀
    });
  }
  async function play(o) {
    scenes = o.scenes || []; idx = 0;
    $('#story').classList.remove('hidden');
    $('#storyImg').style.backgroundImage = 'none'; $('#storyText').textContent = ''; $('#storyTitle').textContent = '';
    if (scenes[0]) preload(scenes[0].img);
    let videoDone = false;
    if (o.video) videoDone = await playVideo(o.video);
    return new Promise((res) => {
      resolveAll = res;
      if (!scenes.length || (videoDone && o.scenesAreFallback)) { finish(); return; }   // 동영상이 재생됐으면 같은 내용의 삽화 장면은 생략
      $('#storyStage').addEventListener('pointerdown', onTap);
      $('#storySkip').onclick = (e) => { e.stopPropagation(); finish(); };
      showScene(0);
    });
  }
  return { play };
})();
