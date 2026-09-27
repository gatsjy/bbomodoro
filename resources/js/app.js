(function () {
  'use strict';

  var HOUR = 3600 * 1000;
  var W = 144, H = 216;
  var NEU = typeof window.NL_PORT !== 'undefined' && window.Neutralino;

  var C = {
    bg: '#fdf0d5', check: '#f8e2bd', ink: '#3b1424', soft: '#b58b7a',
    paper: '#eadbc6', red: '#e8434f', redD: '#a3203a', cream: '#fff8ea',
    green: '#3faf5a', gold: '#ffc94a', orange: '#ff8a3d'
  };

  // ---------- canvas ----------
  var stage = document.getElementById('stage');
  var view = document.getElementById('screen');
  var vctx = view.getContext('2d');
  var buf = document.createElement('canvas');
  buf.width = W; buf.height = H;
  var ctx = buf.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  var scale = 3, dpr = 1;

  // Scale in whole *device* pixels so every art pixel is the same size at any
  // OS/zoom scaling (125%, 150%...). `scale` is then CSS px per art pixel.
  function resize() {
    dpr = window.devicePixelRatio || 1;
    var k = Math.max(1, Math.floor(Math.min(window.innerWidth * dpr / W, window.innerHeight * dpr / H)));
    scale = k / dpr;
    view.width = W * k; view.height = H * k;
    var cw = W * k / dpr, ch = H * k / dpr;
    view.style.width = cw + 'px'; view.style.height = ch + 'px';
    stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
    // snap the origin to a device pixel so nothing gets resampled
    stage.style.left = Math.round((window.innerWidth - cw) / 2 * dpr) / dpr + 'px';
    stage.style.top = Math.round((window.innerHeight - ch) / 2 * dpr) / dpr + 'px';
    stage.style.setProperty('--s', scale);
    vctx.imageSmoothingEnabled = false;
  }
  window.addEventListener('resize', resize);
  resize();

  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

  // ---------- text: one pixel font (Galmuri9) for Korean + Latin ----------
  // Drawn at its native 10px and alpha-thresholded, so every glyph pixel sits
  // exactly on the same art-pixel grid as the tomato.
  var FONT = '10px Galmuri9';
  var TEXT_DY = 0, CAP = 7; // calibrated from the real glyphs once the font loads
  var tcache = {}, tcount = 0;
  function glyphs(str, c) {
    var key = c + '|' + str;
    if (tcache[key]) return tcache[key];
    if (++tcount > 400) { tcache = {}; tcount = 0; }
    var cv = document.createElement('canvas');
    var g = cv.getContext('2d', { willReadFrequently: true });
    g.font = FONT;
    cv.width = Math.max(1, Math.ceil(g.measureText(str).width)); cv.height = 14;
    g.font = FONT; g.textBaseline = 'top'; g.fillStyle = '#000';
    g.fillText(str, 0, 0);
    var img = g.getImageData(0, 0, cv.width, cv.height), d = img.data, rgb = Sprite.hex(c);
    for (var i = 0; i < d.length; i += 4) {
      var on = d[i + 3] >= 110;
      d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = on ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
    return (tcache[key] = cv);
  }
  function calibrate() {
    var cv = glyphs('H', '#000000'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    var top = -1, bottom = -1;
    for (var y = 0; y < cv.height; y++) {
      for (var x = 0; x < cv.width; x++) {
        if (d[(y * cv.width + x) * 4 + 3]) { if (top < 0) top = y; bottom = y; break; }
      }
    }
    if (top >= 0) { TEXT_DY = -top; CAP = bottom - top + 1; }
    tcache = {}; tcount = 0;
  }
  function textWidth(str, k) { str = String(str); return str ? (glyphs(str, '#000000').width - 1) * (k || 1) : 0; }
  // (x, y) is the top-left of the capital letters, like a sprite
  function text(str, x, y, c, k) {
    str = String(str); k = k || 1;
    if (!str) return;
    var b = glyphs(str, c);
    ctx.drawImage(b, Math.round(x), Math.round(y) + TEXT_DY * k, b.width * k, b.height * k);
  }
  function fit(str, maxW) {
    if (textWidth(str) <= maxW) return str;
    while (str.length > 1 && textWidth(str + '..') > maxW) str = str.slice(0, -1);
    return str + '..';
  }
  function ctext(s, y, c, k) { text(s, Math.round((W - textWidth(String(s), k)) / 2), y, c, k); }

  // pixel box with 1px outline and drop shadow
  function box(x, y, w, h, fill, edge) {
    rect(x + 1, y + h, w - 1, 1, edge);
    rect(x + w, y + 1, 1, h, edge);
    rect(x + 1, y, w - 2, 1, edge); rect(x + 1, y + h - 1, w - 2, 1, edge);
    rect(x, y + 1, 1, h - 2, edge); rect(x + w - 1, y + 1, 1, h - 2, edge);
    rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  // ---------- sprite ----------
  var GRID = Sprite.build();
  var ORDER = Sprite.paintOrder(GRID);
  var TOTAL = ORDER.length;
  var RANK = {}; // "x,y" -> order index
  ORDER.forEach(function (p, i) { RANK[p[0] + ',' + p[1]] = i; });

  var FULL = {}, FADE = {};
  Object.keys(Sprite.PAL).forEach(function (k) {
    var t = (k === 'o' || k === 'e') ? 0.55 : 0.8;
    FULL[k] = Sprite.PAL[k];
    FADE[k] = Sprite.mix(Sprite.PAL[k], C.paper, t);
  });
  FADE.w = C.cream;

  // ---------- state ----------
  // days: { 'YYYY-MM-DD': hours completed that day }  -> attendance / streak
  // log:  [{ d, h, task }]                             -> cleared goals
  var KEY = 'bbomodoro.v1';
  var S = {
    goal: 1, acc: 0, startedAt: null, sound: true, pin: false,
    task: '', credited: 0, cleared: false, focus: true, away: 0,
    days: {}, best: 0, log: []
  };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  function elapsed() { return Math.min(S.acc + (S.startedAt ? Date.now() - S.startedAt : 0), S.goal * HOUR); }
  function running() { return S.startedAt !== null; }
  function done() { return elapsed() >= S.goal * HOUR; }
  function painted() { return Math.floor(elapsed() / (S.goal * HOUR) * TOTAL); }
  function hoursDone() { return Math.floor(elapsed() / HOUR); }

  function dayKey(d) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function daysAgo(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; }
  // streak counts back from today; if today isn't done yet, yesterday keeps it alive
  function streak() {
    var n = 0, i = S.days[dayKey(daysAgo(0))] ? 0 : 1;
    while (S.days[dayKey(daysAgo(i))]) { n++; i++; }
    return n;
  }
  function totalHours() {
    return Object.keys(S.days).reduce(function (a, k) { return a + S.days[k]; }, 0);
  }

  var fx = {
    flash: {}, jumpAt: 0, hourAt: 0,
    say: null, sayUntil: 0,
    confetti: [],
    confirmReset: 0,
    press: null, pressAt: 0,
    clearAt: 0, lastFw: -1, focusOn: false, awayAt: 0, backAt: 0, pullTimer: null
  };
  var lastPainted = painted();

  function say(msg, ms) { fx.say = msg; fx.sayUntil = Date.now() + (ms || 2500); }

  // ---------- sound (tiny square-wave chiptunes) ----------
  var ac = null;
  function tone(freq, t0, dur, vol) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.05, ac.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur + 0.02);
  }
  function play(notes, step) {
    if (!S.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      notes.forEach(function (f, i) { if (f) tone(f, i * (step || 0.09), (step || 0.09) * 1.4); });
    } catch (e) {}
  }
  var SFX = {
    click: function () { play([880], 0.04); },
    start: function () { play([523, 659, 784]); },
    pause: function () { play([784, 523]); },
    hour: function () { play([659, 784, 1047, 0, 1047, 1319], 0.1); },
    warn: function () { play([392, 330, 262], 0.12); },
    streak: function () { play([784, 988, 1175, 1568, 0, 1568, 1568], 0.08); },
    clear: function () { play([523, 659, 784, 1047, 0, 784, 1047, 1319, 1568], 0.11); }
  };

  function notify(title, body) {
    if (NEU) { try { Neutralino.os.showNotification(title, body); } catch (e) {} return; }
    try {
      if (window.Notification && Notification.permission === 'granted') new Notification(title, { body: body });
    } catch (e) {}
  }

  // ---------- goal text (HTML overlay, so Korean renders properly) ----------
  var taskInput = document.getElementById('taskInput');

  function editTask() {
    SFX.click();
    taskInput.value = S.task;
    taskInput.hidden = false;
    taskInput.focus(); taskInput.select();
  }
  function closeTask(commit) {
    if (taskInput.hidden) return;
    if (commit) {
      var v = taskInput.value.trim();
      if (v && v !== S.task) { say('GOOD!', 1500); play([659, 988], 0.07); }
      S.task = v; save();
    }
    taskInput.hidden = true;
  }
  taskInput.addEventListener('keydown', function (e) {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.isComposing) closeTask(true);
    else if (e.key === 'Escape') closeTask(false);
  });
  taskInput.addEventListener('blur', function () { closeTask(true); });

  // ---------- record panel (streak calendar + cleared goals) ----------
  var record = document.getElementById('record');
  function openRecord() {
    SFX.click();
    document.getElementById('rStreak').textContent = streak();
    document.getElementById('rBest').textContent = Math.max(S.best, streak());
    document.getElementById('rTotal').textContent = totalHours();

    var grid = document.getElementById('rGrid');
    grid.innerHTML = '';
    var WD = ['일', '월', '화', '수', '목', '금', '토'];
    for (var w = 0; w < 7; w++) {
      var lab = document.createElement('i');
      lab.textContent = WD[(daysAgo(27).getDay() + w) % 7];
      grid.appendChild(lab);
    }
    for (var i = 27; i >= 0; i--) {
      var d = daysAgo(i), h = S.days[dayKey(d)] || 0;
      var cell = document.createElement('span');
      cell.className = 'lv' + Math.min(h, 3) + (i === 0 ? ' today' : '');
      cell.title = (d.getMonth() + 1) + '/' + d.getDate() + ' · ' + h + '시간';
      cell.textContent = d.getDate();
      grid.appendChild(cell);
    }

    var list = document.getElementById('rLog');
    list.innerHTML = '';
    var recent = S.log.slice(-30).reverse();
    if (!recent.length) {
      var li0 = document.createElement('li');
      li0.className = 'none'; li0.textContent = '아직 없어요. 첫 토마토를 익혀볼까요?';
      list.appendChild(li0);
    }
    recent.forEach(function (r) {
      var li = document.createElement('li');
      var date = document.createElement('b');
      date.textContent = r.d.slice(5).replace('-', '/') + ' · ' + r.h + 'H';
      li.appendChild(date);
      li.appendChild(document.createTextNode(' ' + (r.task || '집중 완료') + (r.away ? ' · 딴짓 ' + r.away + '회' : ' · 딴짓 0회 ★')));
      list.appendChild(li);
    });
    record.hidden = false;
  }
  function closeRecord() { record.hidden = true; SFX.click(); }
  document.getElementById('rClose').addEventListener('click', closeRecord);
  record.addEventListener('mousedown', function (e) { if (e.target === record) closeRecord(); });

  // ---------- focus (do-not-disturb) mode ----------
  // While the timer runs: fullscreen + always-on-top, and leaving the window counts as a distraction.
  function focusActive() { return S.focus && running(); }
  function applyFocus() {
    var want = focusActive();
    if (want === fx.focusOn) return;
    fx.focusOn = want;
    document.body.classList.toggle('focus', want);
    if (NEU) {
      try {
        if (want) { Neutralino.window.setFullScreen(); Neutralino.window.setAlwaysOnTop(true); }
        else { Neutralino.window.exitFullScreen(); Neutralino.window.setAlwaysOnTop(S.pin); }
      } catch (e) {}
    } else {
      try {
        if (want && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {});
        else if (!want && document.fullscreenElement) document.exitFullscreen().catch(function () {});
      } catch (e) {}
    }
  }
  function toggleFocus() {
    S.focus = !S.focus; save(); SFX.click();
    say(S.focus ? 'FOCUS ON' : 'FOCUS OFF', 1200);
    applyFocus();
  }
  window.addEventListener('blur', function () {
    if (!fx.focusOn || fx.awayAt) return;
    fx.awayAt = Date.now(); S.away++; save();
    SFX.warn(); say('COME BACK!', 60000);
    // gently pull the window back to the front after a few seconds
    if (NEU) fx.pullTimer = setTimeout(function () {
      try { Neutralino.window.show(); Neutralino.window.focus(); } catch (e) {}
    }, 5000);
  });
  window.addEventListener('focus', function () {
    clearTimeout(fx.pullTimer);
    if (!fx.awayAt) return;
    fx.awayAt = 0; fx.backAt = Date.now();
    if (fx.focusOn) { say('WELCOME BACK', 1800); play([523, 784], 0.08); }
    else fx.sayUntil = 0;
  });

  // ---------- actions ----------
  function toggle() {
    if (done()) { reset(true); return; }
    if (running()) {
      S.acc = elapsed(); S.startedAt = null; SFX.pause(); say('ZZZ', 1500);
    } else {
      S.startedAt = Date.now(); SFX.start(); say('GO!'); fx.jumpAt = Date.now();
      try { if (!NEU && window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
    }
    save(); applyFocus();
  }
  function reset(force) {
    if (!force && elapsed() > 0 && Date.now() - fx.confirmReset > 2000) {
      fx.confirmReset = Date.now(); SFX.click(); say('SURE?', 2000); return;
    }
    S.acc = 0; S.startedAt = null; S.credited = 0; S.cleared = false; S.away = 0;
    fx.confirmReset = 0; fx.flash = {}; fx.confetti = []; fx.clearAt = 0;
    applyFocus();
    lastPainted = 0;
    save(); SFX.click(); say('HI!', 1500);
  }
  function setGoal(h) {
    if (running() || (elapsed() > 0 && !done())) { say('LOCKED', 1200); SFX.click(); return; }
    if (done()) reset(true);
    S.goal = h; save(); SFX.click(); say(h + 'H!', 1200);
    lastPainted = painted();
  }
  function togglePin() {
    S.pin = !S.pin; save(); SFX.click();
    if (NEU) { try { Neutralino.window.setAlwaysOnTop(S.pin); } catch (e) {} }
    say(S.pin ? 'PIN ON' : 'PIN OFF', 1200);
  }
  function toggleSound() { S.sound = !S.sound; save(); SFX.click(); }

  // ---------- layout / hit boxes ----------
  var TASK_Y = 17, ROW_Y = 36, TOM_Y = 52, BAR_Y = 126, GOAL_Y = 172, CTRL_Y = 194;
  var buttons = [
    { id: 'g1', x: 12, y: GOAL_Y, w: 36, h: 14, act: function () { setGoal(1); } },
    { id: 'g2', x: 54, y: GOAL_Y, w: 36, h: 14, act: function () { setGoal(2); } },
    { id: 'g3', x: 96, y: GOAL_Y, w: 36, h: 14, act: function () { setGoal(3); } },
    { id: 'go', x: 12, y: CTRL_Y, w: 78, h: 15, act: toggle },
    { id: 'rs', x: 96, y: CTRL_Y, w: 36, h: 15, act: function () { reset(false); } },
    { id: 'snd', x: 4, y: 3, w: 12, h: 11, act: toggleSound },
    { id: 'pin', x: 128, y: 3, w: 12, h: 11, act: togglePin },
    { id: 'dnd', x: 114, y: 3, w: 12, h: 11, act: toggleFocus },
    { id: 'task', x: 8, y: TASK_Y, w: 128, h: 14, act: editTask },
    { id: 'cal', x: 116, y: ROW_Y - 1, w: 22, h: 13, act: openRecord },
    { id: 'stk', x: 6, y: ROW_Y - 1, w: 30, h: 13, act: openRecord }
  ];

  view.addEventListener('mousedown', function (e) {
    var r = view.getBoundingClientRect();
    var x = (e.clientX - r.left) / scale, y = (e.clientY - r.top) / scale;
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (x >= b.x && x < b.x + b.w + 1 && y >= b.y && y < b.y + b.h + 1) {
        if (b.id === 'task') e.preventDefault(); // keep focus on the input we open
        fx.press = b.id; fx.pressAt = Date.now(); b.act(); return;
      }
    }
    // poke the tomato
    if (x >= 40 && x < 104 && y >= TOM_Y - 2 && y < TOM_Y + 64) {
      fx.jumpAt = Date.now(); play([1047, 1319], 0.05);
      var pokes = ['♥', 'HEHE', 'FOCUS!', 'YOU GOT IT', '*_*'];
      say(pokes[Math.floor(Math.random() * pokes.length)], 1200);
    }
  });
  window.addEventListener('keydown', function (e) {
    if (!taskInput.hidden) return;
    if (!record.hidden) { if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') closeRecord(); return; }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); toggle(); }
    else if (e.key === 'r' || e.key === 'R') reset(false);
    else if (e.key === '1' || e.key === '2' || e.key === '3') setGoal(+e.key);
    else if (e.key === 'm' || e.key === 'M') toggleSound();
    else if (e.key === 'p' || e.key === 'P') togglePin();
    else if (e.key === 'g' || e.key === 'G') { e.preventDefault(); editTask(); }
    else if (e.key === 'c' || e.key === 'C') openRecord();
    else if (e.key === 'f' || e.key === 'F') toggleFocus();
    else if (e.key === 'Escape' && fx.focusOn) toggleFocus();
  });

  // ---------- drawing ----------
  function fmt(ms) {
    var s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function drawBackground(now) {
    rect(0, 0, W, H, C.bg);
    var off = Math.floor(now / 200) % 16;
    ctx.fillStyle = C.check;
    for (var y = -16; y < H; y += 16) {
      for (var x = -16; x < W; x += 16) ctx.fillRect(x + off, y + off, 8, 8), ctx.fillRect(x + off + 8, y + off + 8, 8, 8);
    }
  }

  function drawIcons() {
    // speaker
    var c = S.sound ? C.ink : C.soft;
    rect(6, 7, 2, 3, c); rect(8, 6, 1, 5, c); rect(9, 5, 1, 7, c);
    if (S.sound) { rect(11, 7, 1, 3, c); rect(13, 6, 1, 5, c); }
    else { rect(11, 6, 1, 1, c); rect(12, 7, 1, 1, c); rect(13, 8, 1, 1, c); rect(12, 9, 1, 1, c); rect(11, 10, 1, 1, c); rect(13, 6, 1, 1, c); rect(13, 10, 1, 1, c); }
    // moon = focus mode
    c = S.focus ? (fx.focusOn ? C.red : C.ink) : C.soft;
    rect(118, 4, 3, 1, c); rect(117, 5, 2, 1, c); rect(116, 6, 2, 4, c); rect(117, 10, 2, 1, c);
    rect(118, 11, 4, 1, c); rect(121, 10, 2, 1, c);
    if (S.focus) { rect(122, 5, 1, 1, C.gold); rect(123, 7, 1, 1, C.gold); }
    // pin
    c = S.pin ? C.red : C.soft;
    rect(132, 4, 5, 1, c); rect(133, 5, 3, 3, c); rect(131, 8, 7, 1, c); rect(134, 9, 1, 4, c);
  }

  function drawTaskBox() {
    var clear = !!S.task && done();
    box(8, TASK_Y, 128, 14, clear ? '#fff1c9' : C.cream, C.ink);
    // pencil (or check once cleared)
    if (clear) {
      rect(12, 24, 1, 1, C.green); rect(13, 25, 1, 1, C.green); rect(14, 24, 1, 1, C.green);
      rect(15, 23, 1, 1, C.green); rect(16, 22, 1, 1, C.green); rect(12, 23, 1, 1, C.green); rect(14, 25, 1, 1, C.green);
    } else {
      rect(16, 21, 2, 2, C.red); rect(15, 22, 2, 2, C.gold); rect(14, 23, 2, 2, C.gold);
      rect(13, 24, 2, 2, C.gold); rect(12, 26, 2, 1, C.ink);
    }
    if (!taskInput.hidden) return;
    var label = fit(S.task || '오늘의 목표를 적어요', 110);
    var col = !S.task ? C.soft : clear ? C.redD : C.ink;
    text(label, 22, TASK_Y + Math.round((14 - CAP) / 2), col);
    if (clear) rect(21, TASK_Y + Math.round((14 - CAP) / 2) + Math.floor(CAP / 2), textWidth(label) + 2, 1, C.redD);
  }

  function flame(x, y, on, now) {
    var a = on ? C.orange : C.soft, b = on ? C.gold : C.paper, t = on && Math.floor(now / 250) % 2;
    rect(x + 3, y + t, 1, 1, a);
    rect(x + 2, y + 1, 2, 2, a); rect(x + 1, y + 3, 5, 2, a); rect(x, y + 5, 7, 3, a);
    rect(x + 1, y + 8, 5, 1, a);
    rect(x + 3, y + 4, 1, 1, b); rect(x + 2, y + 5, 3, 3, b);
  }

  function drawStreak(now) {
    var n = streak(), today = !!S.days[dayKey(new Date())];
    flame(8, ROW_Y, n > 0, now);
    text(n + '일', 17, ROW_Y + 1, n > 0 ? C.ink : C.soft);
    // today's attendance dot
    if (!today) { rect(8, ROW_Y + 10, 7, 1, Math.floor(now / 500) % 2 ? C.red : C.bg); }

    // calendar button
    var pr = fx.press === 'cal' && now - fx.pressAt < 120 ? 1 : 0;
    var cx = 120 + pr, cy = ROW_Y + pr;
    rect(cx, cy + 1, 13, 9, C.ink); rect(cx + 1, cy + 3, 11, 6, C.cream); rect(cx + 1, cy + 2, 11, 1, C.red);
    rect(cx + 3, cy, 1, 2, C.ink); rect(cx + 9, cy, 1, 2, C.ink);
    for (var i = 0; i < 3; i++) for (var j = 0; j < 2; j++) rect(cx + 3 + i * 3, cy + 4 + j * 2, 1, 1, i + j * 3 < 4 ? C.red : C.soft);
  }

  function miniTomato(x, y, on, pop) {
    var dy = pop ? -Math.round(Math.sin(Math.min(1, pop) * Math.PI) * 3) : 0;
    y += dy;
    var o = on ? C.ink : C.soft, f = on ? C.red : C.cream;
    rect(x + 2, y + 2, 7, 1, o); rect(x + 1, y + 3, 1, 5, o); rect(x + 9, y + 3, 1, 5, o);
    rect(x + 2, y + 8, 7, 1, o); rect(x + 2, y + 3, 7, 5, f);
    if (on) { rect(x + 3, y + 4, 1, 1, '#ffd3c4'); }
    rect(x + 4, y + 1, 3, 1, on ? C.green : C.soft); rect(x + 5, y, 1, 1, on ? C.green : C.soft);
    if (on) { // check mark
      rect(x + 3, y + 5, 1, 1, C.cream); rect(x + 4, y + 6, 1, 1, C.cream);
      rect(x + 5, y + 5, 1, 1, C.cream); rect(x + 6, y + 4, 1, 1, C.cream); rect(x + 7, y + 3, 1, 1, C.cream);
    }
  }

  function drawHours(now) {
    var n = S.goal, hd = hoursDone(), gap = 18, total = n * 11 + (n - 1) * (gap - 11);
    var x0 = Math.round((W - total) / 2);
    for (var i = 0; i < n; i++) {
      var pop = (i === hd - 1 && now - fx.hourAt < 600) ? (now - fx.hourAt) / 600 : 0;
      miniTomato(x0 + i * gap, ROW_Y, i < hd, pop);
    }
  }

  function drawTomato(now) {
    var p = painted(), run = running(), fin = done();
    var bob = 0;
    if (fin) bob = Math.floor(now / 300) % 2 ? -2 : 0;
    else if (run) bob = Math.floor(now / 500) % 2 ? -1 : 0;
    else bob = Math.floor(now / 1200) % 2 ? -1 : 0;
    var jt = now - fx.jumpAt;
    if (jt < 400) bob -= Math.round(Math.sin(jt / 400 * Math.PI) * 6);
    var ct = now - fx.clearAt;
    if (fx.clearAt && ct < 1800) { // three victory hops
      var hop = Math.floor(ct / 600), f = (ct % 600) / 600;
      bob = -Math.round(Math.sin(f * Math.PI) * [16, 10, 5][hop]);
    }

    var ox = 40, oy = TOM_Y + bob, k = 2;

    var sw = 44 + bob * 2;
    rect(Math.round((W - sw) / 2), TOM_Y + 65, sw, 3, 'rgba(59,20,36,0.18)');

    for (var y = 0; y < Sprite.SIZE; y++) {
      for (var x = 0; x < Sprite.SIZE; x++) {
        var c = GRID[y][x];
        if (!c) continue;
        var idx = RANK[x + ',' + y];
        var col = idx < p ? FULL[c] : FADE[c];
        var ft = fx.flash[idx];
        if (ft && now - ft < 500) col = (Math.floor((now - ft) / 100) % 2) ? '#ffffff' : C.gold;
        rect(ox + x * k, oy + y * k, k, k, col);
      }
    }

    var sad = fx.awayAt || now - fx.backAt < 1500;
    var mood = fin ? 'happy' : sad ? 'sad' : (!run && elapsed() > 0) ? 'sleep' : (now % 3200 < 160 ? 'blink' : 'open');
    Sprite.face(mood).forEach(function (f) {
      var idx = RANK[f[0] + ',' + f[1]];
      var col = (idx < p || fin) ? FULL[f[2]] : FADE[f[2]];
      rect(ox + f[0] * k, oy + f[1] * k, k, k, col);
    });

    if (fin) drawCrown(oy, now);
    if (sad && !fin) { // sweat drop
      rect(ox + 50, oy + 22, 2, 2, '#6fc3ff'); rect(ox + 51, oy + 20, 1, 2, '#6fc3ff');
    }

    if (!run && !fin && elapsed() > 0) {
      var t = (now / 700) % 3;
      for (var i = 0; i < 2; i++) {
        var zt = (t + i * 1.5) % 3;
        text('Z', 104 + Math.round(zt * 3), TOM_Y + 4 - Math.round(zt * 5), zt > 2.4 ? C.soft : C.ink, 1);
      }
    }
    if (fin) {
      [[30, 4], [110, 10], [26, 50], [114, 48], [70, -6]].forEach(function (s, i) {
        if (Math.floor(now / 250 + i) % 3 === 0) return;
        var sx = s[0], sy = TOM_Y + s[1];
        rect(sx, sy - 2, 1, 5, C.gold); rect(sx - 2, sy, 5, 1, C.gold); rect(sx, sy, 1, 1, '#fff');
      });
    }
  }

  var CROWN = ['g...g...g', 'gg.ggg.gg', 'ggggggggg', 'grgwgrgwg', 'ggggggggg', 'ddddddddd'];
  var CROWN_PAL = { g: C.gold, d: '#d4892a', r: C.red, w: '#fff' };
  function drawCrown(oy, now) {
    var ct = fx.clearAt ? now - fx.clearAt : 99999;
    if (ct < 1700) return;
    var drop = ct < 2200 ? -Math.round((1 - Math.sin((ct - 1700) / 500 * Math.PI / 2)) * 40) : 0;
    var k = 2, x0 = 72 - 9, y0 = oy - 4 + drop;
    CROWN.forEach(function (row, y) { // outline pass
      for (var x = 0; x < row.length; x++) if (row[x] !== '.') rect(x0 + x * k - 1, y0 + y * k - 1, k + 2, k + 2, C.ink);
    });
    CROWN.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) if (row[x] !== '.') rect(x0 + x * k, y0 + y * k, k, k, CROWN_PAL[row[x]]);
    });
    if (Math.floor(now / 300) % 4 === 0) rect(x0 + 2, y0 + 5, 1, 1, '#fff');
  }

  function firework(x, y) {
    var cols = [C.red, C.gold, C.green, '#6fc3ff', '#ff9fb8'];
    var col = cols[Math.floor(Math.random() * cols.length)];
    for (var i = 0; i < 18; i++) {
      var a = i / 18 * Math.PI * 2, v = 1.1 + Math.random() * 0.4;
      fx.confetti.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: i % 3 ? col : '#fff', g: 0.02, life: 45 });
    }
  }

  // "STAGE CLEAR" sequence: flash -> hops -> banner + fireworks -> crown drop
  function drawClear(now) {
    if (!fx.clearAt) return;
    var t = now - fx.clearAt;
    if (t > 5000) return;
    if (t < 250) { ctx.fillStyle = 'rgba(255,255,255,' + (1 - t / 250) + ')'; ctx.fillRect(0, 0, W, H); }
    if (t < 3600 && Math.floor(t / 450) !== fx.lastFw) {
      fx.lastFw = Math.floor(t / 450);
      firework(20 + Math.random() * 104, 20 + Math.random() * 60);
    }
    if (t > 300 && t < 4600) {
      var inT = Math.min(1, (t - 300) / 300), outT = t > 4200 ? (t - 4200) / 400 : 0;
      var dx = Math.round((1 - inT) * -W + outT * W);
      var y = BAR_Y - 2, h = 28, blink = Math.floor(t / 150) % 2, sh = Math.floor(t / 100) % 8;
      rect(dx, y - 1, W, h + 2, C.ink);
      rect(dx, y, W, h, blink ? C.red : C.redD);
      for (var i = -8; i < W; i += 8) { rect(dx + i + sh, y + 2, 3, 1, C.gold); rect(dx + i + 7 - sh, y + h - 3, 3, 1, C.gold); }
      text('STAGE', dx + Math.round((W - textWidth('STAGE')) / 2), y + 5, C.gold, 1);
      var lx = dx + Math.round((W - textWidth('CLEAR!', 2)) / 2);
      text('CLEAR!', lx + 1, y + 14, C.ink, 2);
      text('CLEAR!', lx, y + 13, C.cream, 2);
    }
  }

  function drawBubble(now) {
    var msg = null;
    if (fx.say && now < fx.sayUntil) msg = fx.say;
    else if (done()) msg = 'YAY!';
    else if (!running() && elapsed() === 0) msg = 'HI!';
    if (!msg) return;
    var w = textWidth(msg) + 7, x = Math.min(W - w - 3, 96), y = TOM_Y - 8, bh = CAP + 4;
    box(x, y, w, bh, C.cream, C.ink);
    rect(x + 3, y + bh - 1, 3, 1, C.cream); rect(x + 2, y + bh, 2, 1, C.ink); rect(x + 1, y + bh + 1, 1, 1, C.ink);
    rect(x + 4, y + bh, 1, 1, C.ink);
    text(msg, x + 4, y + 2, C.ink);
  }

  function drawProgress() {
    var x = 12, y = BAR_Y, w = 120, h = 7;
    box(x, y, w, h, C.cream, C.ink);
    var fill = Math.floor((w - 2) * elapsed() / (S.goal * HOUR));
    if (fill > 0) {
      rect(x + 1, y + 1, fill, h - 2, C.red);
      rect(x + 1, y + 1, fill, 1, '#ff7f6e');
    }
    for (var i = 1; i < S.goal; i++) rect(x + Math.round(w * i / S.goal), y + 1, 1, h - 2, C.ink);
  }

  function drawInfo() {
    var remain = S.goal * HOUR - elapsed();
    ctext(fmt(remain), BAR_Y + 11, done() ? C.red : C.ink, 2);
    var p = Math.min(painted(), TOTAL);
    ctext(p + '/' + TOTAL + ' PX  ' + Math.floor(100 * elapsed() / (S.goal * HOUR)) + '%', BAR_Y + 34, C.soft, 1);
  }

  function button(b, label, on, disabled, now) {
    var pressed = fx.press === b.id && now - fx.pressAt < 120;
    var dx = pressed ? 1 : 0;
    var fill = on ? C.red : C.cream, fg = on ? C.cream : C.ink, edge = C.ink;
    if (disabled) { fg = C.soft; edge = C.soft; }
    if (pressed) box(b.x + 1, b.y + 1, b.w - 1, b.h - 1, fill, edge);
    else box(b.x, b.y, b.w, b.h, fill, edge);
    text(label, b.x + dx + Math.round((b.w - textWidth(label)) / 2), b.y + dx + Math.round((b.h - CAP) / 2), fg);
  }

  function drawButtons(now) {
    var locked = running() || (elapsed() > 0 && !done());
    for (var i = 1; i <= 3; i++) button(buttons[i - 1], i + 'H', S.goal === i, locked && S.goal !== i, now);
    var label = done() ? 'AGAIN' : running() ? 'PAUSE' : elapsed() > 0 ? 'RESUME' : 'START';
    button(buttons[3], label, true, false, now);
    var confirming = now - fx.confirmReset < 2000;
    button(buttons[4], confirming ? 'OK?' : 'RESET', confirming, elapsed() === 0, now);
  }

  function drawConfetti() {
    fx.confetti = fx.confetti.filter(function (c) { return c.y < H + 4 && (c.life === undefined || c.life-- > 0); });
    fx.confetti.forEach(function (c) {
      c.x += c.vx; c.y += c.vy; c.vy += c.g || 0.03;
      rect(Math.round(c.x), Math.round(c.y), 2, 2, c.c);
    });
  }
  function burst() {
    var cols = [C.red, C.gold, C.green, '#6fc3ff', '#ff9fb8'];
    for (var i = 0; i < 60; i++) {
      fx.confetti.push({ x: 72, y: TOM_Y + 24, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5 - 0.5, c: cols[i % cols.length] });
    }
  }

  // ---------- progress events ----------
  function update(now) {
    if (running() && done()) { S.acc = S.goal * HOUR; S.startedAt = null; save(); applyFocus(); }

    var p = painted();
    if (p > lastPainted) {
      if (p - lastPainted < 20) for (var i = lastPainted; i < p; i++) fx.flash[i] = now;
      lastPainted = p;
    }

    // credit finished hours to today's attendance (persisted, so reopening the app can't double count)
    var hd = hoursDone();
    if (hd > S.credited) {
      var key = dayKey(new Date());
      var firstToday = !S.days[key];
      S.days[key] = (S.days[key] || 0) + (hd - S.credited);
      S.credited = hd;
      S.best = Math.max(S.best, streak());
      save();
      fx.hourAt = now; fx.jumpAt = now;
      if (firstToday) {
        SFX.streak(); say(streak() + ' DAY STREAK!', 3500);
        notify('Bbomodoro', '오늘 출석 완료! 🔥 ' + streak() + '일 연속');
      } else if (!done()) {
        SFX.hour(); say(hd + 'H CLEAR!', 3500);
        notify('Bbomodoro', hd + '시간 달성! 계속 가보자 🍅');
      }
    }

    if (done() && !S.cleared) {
      S.cleared = true;
      S.log.push({ d: dayKey(new Date()), h: S.goal, task: S.task, away: S.away });
      if (S.log.length > 200) S.log = S.log.slice(-200);
      save();
      SFX.clear(); burst(); fx.clearAt = now; fx.lastFw = -1;
      say('YAY!', 5000);
      notify('Bbomodoro', S.goal + '시간 완료! ' + (S.task ? '"' + S.task + '" ' : '') + '토마토가 다 익었어요 🍅');
    }
  }

  // ---------- loop ----------
  function tick() {
    var now = Date.now();
    update(now);

    drawBackground(now);
    ctext('BBOMODORO', 5, C.ink, 1);
    drawIcons();
    drawTaskBox();
    drawStreak(now);
    drawHours(now);
    drawTomato(now);
    drawBubble(now);
    drawProgress();
    drawInfo();
    drawButtons(now);
    drawConfetti();
    drawClear(now);

    vctx.imageSmoothingEnabled = false;
    vctx.drawImage(buf, 0, 0, view.width, view.height);

    var busy = fx.confetti.length || (fx.clearAt && now - fx.clearAt < 5000);
    setTimeout(tick, busy ? 33 : 100);
  }

  // ---------- boot ----------
  if (NEU) {
    try {
      Neutralino.init();
      if (S.pin) Neutralino.window.setAlwaysOnTop(true);
    } catch (e) {}
  }
  applyFocus();
  var boot = function () { calibrate(); tick(); };
  if (document.fonts && document.fonts.load) document.fonts.load(FONT, '가A').then(boot, boot);
  else boot();
})();
