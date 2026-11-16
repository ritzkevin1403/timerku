var IS_OUT = location.hash === '#output';
var DEF = {showClock:true, mode:'sec', msg:'', showMsg:false, msgColor:'#1fb6ff'};
var timers = [], liveId = null, opts = Object.assign({}, DEF), openIds = {};
var bc = null; try { bc = new BroadcastChannel('pp-timer-lite'); } catch(e){}
var uid = function(){ return 't' + Math.random().toString(36).slice(2,8); };

function parseHMS(s){
  var p = String(s).trim().split(':').map(function(x){ return parseInt(x,10) || 0; });
  if (p.length === 1) return p[0];
  if (p.length === 2) return p[0]*60 + p[1];
  return p[0]*3600 + p[1]*60 + p[2];
}
function pad(n){ return (n<10?'0':'') + n; }
function hms(sec, forceH){
  var h = Math.floor(sec/3600), m = Math.floor(sec%3600/60), s = sec%60;
  return (h>0||forceH ? pad(h)+':' : '') + pad(m) + ':' + pad(s);
}
function nextTarget(str, now){
  var s = parseHMS(str), d = new Date(now);
  d.setHours(0,0,0,0);
  var t = d.getTime() + s*1000;
  if (t <= now) t += 86400000;
  return t;
}
function mk(type){
  return {id:uid(), name: type==='up'?'Elapsed':type==='to'?'Countdown ke jam':'Countdown', type:type||'down',
    dur:300, time:'09:00:00', start:0, end:0, overrun:true, running:false, t0:0, base:0, target:0, color:''};
}
function val(t, now){
  var el = t.base + (t.running ? now - t.t0 : 0), ms;
  if (t.type === 'down') ms = t.dur*1000 - el;
  else if (t.type === 'to') ms = (t.running ? t.target : nextTarget(t.time, now)) - now;
  else {
    ms = t.start*1000 + el;
    if (t.end > 0 && ms >= t.end*1000 && !t.overrun) ms = t.end*1000;
    return {ms:ms, over:false, warn:false, sec:Math.floor(ms/1000), text:hms(Math.floor(ms/1000), false)};
  }
  var over = ms < 0;
  if (over && !t.overrun){ ms = 0; over = false; }
  var sec = over ? Math.floor(-ms/1000) : Math.ceil(ms/1000);
  return {ms:ms, over:over, warn:!over && ms<300000, sec:sec, text:(over?'-':'') + hms(sec, false)};
}
// mode 'min': hanya menit, tanpa detik
function fmtV(v, t, mode){
  if (mode !== 'min') return v.text;
  var m = (t.type==='up' || v.over) ? Math.floor(v.sec/60) : Math.ceil(v.sec/60);
  var h = Math.floor(m/60);
  return (v.over?'-':'') + (h>0 ? h+':'+pad(m%60) : pad(m));
}
function fit(el, h, max){
  var s = max; el.style.fontSize = s + 'px';
  while (s > 12 && el.scrollHeight > h){ s -= Math.max(1, Math.floor(s*0.06)); el.style.fontSize = s + 'px'; }
}
function startT(t){
  var now = Date.now();
  if (t.running) return;
  if (t.type==='down' && val(t,now).ms<=0) t.base = 0;
  t.t0 = now; t.running = true;
  if (t.type==='to') t.target = nextTarget(t.time, now);
}
function stopT(t){ if (t.running){ t.base += Date.now() - t.t0; t.running = false; } }
function resetT(t){ t.base = 0; t.running = false; }

function save(){
  var st = {timers:timers, liveId:liveId, opts:opts};
  try { localStorage.setItem('pp-timer-lite', JSON.stringify(st)); } catch(e){}
  if (bc) bc.postMessage({type:'state', st:st});
}
function load(){
  try { var s = JSON.parse(localStorage.getItem('pp-timer-lite')); if (s){ timers=s.timers||[]; liveId=s.liveId; opts=Object.assign({}, DEF, s.opts||{}); if (opts.msgColor==='#17bebb') opts.msgColor = DEF.msgColor; } } catch(e){}
}
function clockText(now){
  var d = new Date(now);
  return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}
function textOn(c){
  var n = parseInt(String(c).slice(1), 16), R = n>>16&255, G = n>>8&255, B = n&255;
  return (R*299 + G*587 + B*114)/1000 > 150 ? '#111' : '#fff';
}
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* ---------- OUTPUT (dipakai layar output dan preview) ---------- */
function buildOut(root){
  root.innerHTML = '<div class="oclk"></div><div class="omsg"></div><div class="otm"><div class="odisp">--:--</div></div>';
}
function updateOut(root, now){
  var q = function(c){ return root.querySelector(c); };
  var t = timers.filter(function(x){ return x.id===liveId; })[0];
  var full = opts.mode === 'msg', msg = opts.showMsg ? String(opts.msg).trim() : '';
  root.className = 'oroot' + (root.dataset.big ? ' big' : '') + (full ? ' full' : '') + (msg && !full ? ' hasmsg' : '');
  var od = q('.odisp');
  if (t){
    var v = val(t, now);
    od.textContent = fmtV(v, t, opts.mode);
    od.className = 'odisp' + (v.over ? ' over' : v.warn && t.type!=='up' ? ' warn' : '');
  } else { od.textContent = '--:--'; od.className = 'odisp'; od.style.color = ''; }
  q('.oclk').textContent = opts.showClock ? clockText(now) : '';
  q('.omsg').style.color = opts.msgColor || '#1fb6ff';
  var om = q('.omsg'), W = root.clientWidth, H = root.clientHeight, key = msg + '|' + full + '|' + W + 'x' + H;
  if (key !== root._k){
    root._k = key; om.textContent = msg;
    if (msg){ if (full) fit(om, H*0.62, W*0.16); else fit(om, H*0.2, W*0.045); }
  }
}
function initOutput(){
  document.title = 'Timer Output';
  document.body.className = 'outbody';
  var root = document.createElement('div'); root.dataset.big = '1'; buildOut(root); document.body.appendChild(root);
  var h = document.createElement('div'); h.className = 'ohint'; h.textContent = 'Klik untuk fullscreen'; document.body.appendChild(h);
  document.body.onclick = function(){
    h.style.display = 'none';
    var el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function(){});
    else if (document.exitFullscreen) document.exitFullscreen();
  };
  load();
  function apply(st){ timers=st.timers; liveId=st.liveId; opts=Object.assign({}, DEF, st.opts); }
  if (bc){ bc.onmessage = function(e){ if (e.data.type==='state') apply(e.data.st); }; bc.postMessage({type:'hello'}); }
  window.addEventListener('storage', function(){ load(); });
  setInterval(function(){ updateOut(root, Date.now()); }, 100);
}

/* ---------- CONTROLLER ---------- */
function initController(){
  load();
  if (!timers.length){ var a = mk('down'); a.name='Pre-service'; var b = mk('to'); var c = mk('up'); timers=[a,b,c]; liveId=a.id; }
  document.body.innerHTML =
   '<header><div><h1>Timer Lite</h1></div>'+
   '<div class="clock" id="clk"></div>'+
   '<div class="bar"><label class="hint"><input type="checkbox" id="sc"> Jam di output</label>'+
   '<button id="openout" class="golive"><i class="lamp"></i>Live</button></div></header>'+
   '<main class="grid"><section><div id="list" style="display:grid;gap:8px"></div>'+
   '<button id="addd" class="slot">+ Tambah timer</button>'+
   '</section>'+
   '<aside class="card side"><h2>Output</h2><div class="pv"><div class="oroot" id="pv"></div></div>'+
   
   '<div class="seg"><label><input type="radio" name="mode" value="sec"><span>Dengan detik</span></label>'+
   '<label><input type="radio" name="mode" value="min"><span>Menit saja</span></label>'+
   '<label><input type="radio" name="mode" value="msg"><span>Full message</span></label></div>'+
   '<div class="hint">Pesan</div>'+
   '<textarea id="msg" rows="3" placeholder="Ketik pesan..."></textarea>'+
   '<div class="row"><label class="hint">Warna pesan <input type="color" id="msgcolor"></label><button id="msgreset">Reset</button></div>'+
   '<div class="row"><button class="p" id="msgshow">Tampilkan</button><button id="msghide">Sembunyikan</button></div>'+
   '</aside></main><div id="modal"></div>';
  var $ = function(id){ return document.getElementById(id); };
  buildOut($('pv'));
  $('sc').checked = opts.showClock;
  $('sc').onchange = function(){ opts.showClock = this.checked; save(); };
  $('openout').onclick = function(){ window.open(location.href.split('#')[0] + '#output', 'ppout', 'width=960,height=540'); };
  Array.prototype.forEach.call(document.querySelectorAll('input[name=mode]'), function(r){
    r.checked = r.value === opts.mode;
    r.onchange = function(){ opts.mode = this.value; save(); };
  });
  $('msg').value = opts.msg;
  $('msgcolor').value = opts.msgColor || '#1fb6ff';
  $('msgcolor').oninput = function(){ opts.msgColor = this.value; save(); };
  $('msgreset').onclick = function(){ opts.msgColor = DEF.msgColor; $('msgcolor').value = DEF.msgColor; save(); };
  $('msgshow').onclick = function(){ opts.msg = $('msg').value; opts.showMsg = true; save(); };
  $('msghide').onclick = function(){ opts.showMsg = false; save(); };
 
  function add(type){ var t = mk(type); timers.push(t); if (!liveId) liveId = t.id; save(); render(); }
  $('addd').onclick = function(){ add('down'); };
  if (bc) bc.onmessage = function(e){ if (e.data.type==='hello') save(); };

  function find(id){ return timers.filter(function(x){ return x.id===id; })[0]; }
  var editId = null;
  function fieldsHtml(t){
    var tf = t.type==='down' ? '<label>Durasi <input class="tin" data-f="dur" value="'+hms(t.dur,true)+'"></label>'
      : t.type==='to' ? '<label>Target jam <input class="tin" data-f="time" value="'+esc(t.time)+'"></label>'
      : '<label>Mulai <input class="tin" data-f="start" value="'+hms(t.start,true)+'"></label><label>Selesai <input class="tin" data-f="end" value="'+(t.end?hms(t.end,true):'')+'" placeholder="opsional"></label>';
    return '<div class="set"><div class="row"><label>Nama <input class="name" data-f="name" value="'+esc(t.name)+'"></label></div>'+
      '<div class="row"><label>Jenis <select data-f="type"><option value="down"'+(t.type==='down'?' selected':'')+'>Count Down Timer</option><option value="to"'+(t.type==='to'?' selected':'')+'>Count Down to Time</option><option value="up"'+(t.type==='up'?' selected':'')+'>Elapsed Time</option></select></label></div>'+
      '<div class="row">'+tf+'</div>'+
      '<div class="row"><label>Warna kolom <input type="color" data-f="color" value="'+(t.color||'#2f2f2f')+'"></label><button data-a="nocolor">Reset</button></div>'+
      '<div class="row"><label><input type="checkbox" data-f="overrun"'+(t.overrun?' checked':'')+'> Allow overrun</label><span class="sp"></span><button class="r" data-a="del">Hapus</button></div></div>';
  }
  var dragging = false;
  function render(){
    if (dragging) return;
    var h = '';
    timers.forEach(function(t){
      h += '<div class="card'+(t.id===liveId?' live':'')+(t.running?' run':'')+'" data-id="'+t.id+'"'+(t.color?' style="background:'+esc(t.color)+';border-color:'+esc(t.color)+';color:'+textOn(t.color)+'"':'')+'><div class="row line">'+
        '<span class="tname">'+esc(t.name)+'</span><span class="sp"></span>'+
        '<button class="play'+(t.running?' on':'')+'" data-a="play" aria-label="Trigger">'+(t.running?'&#10073;&#10073;':'&#9654;')+'</button>'+
        '<button class="gear" data-a="gear" aria-label="Pengaturan">&#9881;</button></div></div>';
    });
    $('list').innerHTML = h;
  }
  function renderModal(){
    var m = $('modal'), t = editId ? find(editId) : null;
    if (!t){ editId = null; m.className = ''; m.innerHTML = ''; return; }
    m.className = 'on';
    m.innerHTML = '<div class="mbox"><div class="row"><b>Pengaturan timer</b><span class="sp"></span><button data-a="close">Tutup</button></div>'+fieldsHtml(t)+'</div>';
  }
  $('list').addEventListener('click', function(e){
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var t = find(b.closest('.card').dataset.id), a = b.dataset.a;
    if (a==='play'){
      if (t.running) stopT(t);
      else { timers.forEach(function(x){ if (x!==t && x.running) resetT(x); }); startT(t); liveId = t.id; }
    }
    else if (a==='gear'){ editId = t.id; renderModal(); return; }
    save(); render();
  });
  // tahan lalu geser untuk ubah urutan
  (function(){
    var list = $('list'), hold = null, card = null, grab = 0, ty = 0, sx = 0, sy = 0, pid = null;
    function place(y){
      var top = y - grab, h = card.offsetHeight, c = top + h/2 - list.getBoundingClientRect().top, p, n;
      while ((p = card.previousElementSibling) && c < p.offsetTop + p.offsetHeight/2) list.insertBefore(card, p);
      while ((n = card.nextElementSibling) && c > n.offsetTop + n.offsetHeight/2) list.insertBefore(card, n.nextElementSibling);
      card.style.transform = 'translateY(' + (top - list.getBoundingClientRect().top - card.offsetTop) + 'px)';
    }
    function end(){
      clearTimeout(hold); hold = null;
      if (!dragging) { card = null; return; }
      var order = Array.prototype.map.call(list.children, function(c){ return c.dataset.id; });
      timers.sort(function(a, b){ return order.indexOf(a.id) - order.indexOf(b.id); });
      dragging = false; card = null; save(); render();
    }
    list.style.position = 'relative';
    list.addEventListener('pointerdown', function(e){
      if (e.button > 0 || e.target.closest('button,input,select')) return;
      var c = e.target.closest('.card'); if (!c) return;
      sx = e.clientX; sy = e.clientY; pid = e.pointerId;
      hold = setTimeout(function(){
        card = c; dragging = true; grab = sy - c.getBoundingClientRect().top;
        c.classList.add('drag');
        try { list.setPointerCapture(pid); } catch(x){}
      }, 350);
    });
    list.addEventListener('pointermove', function(e){
      if (dragging && card){ e.preventDefault(); place(e.clientY); }
      else if (hold && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10){ clearTimeout(hold); hold = null; }
    });
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
    list.addEventListener('contextmenu', function(e){ if (hold || dragging) e.preventDefault(); });
    list.addEventListener('touchmove', function(e){ if (dragging) e.preventDefault(); }, {passive:false});
  })();
  function closeModal(){ editId = null; renderModal(); }
  document.addEventListener('keydown', function(e){ if (e.key==='Escape' && editId) closeModal(); });
  $('modal').addEventListener('click', function(e){
    if (e.target.id === 'modal') return closeModal();
    var b = e.target.closest('button[data-a]'); if (!b) return;
    if (b.dataset.a === 'close') closeModal();
    else if (b.dataset.a === 'nocolor'){ find(editId).color = ''; save(); render(); renderModal(); }
    else if (b.dataset.a === 'del'){
      var t = find(editId);
      timers = timers.filter(function(x){ return x!==t; });
      if (liveId===t.id) liveId = timers[0] ? timers[0].id : null;
      save(); render(); closeModal();
    }
  });
  $('modal').addEventListener('change', function(e){
    var el = e.target, f = el.dataset.f; if (!f) return;
    var t = find(editId);
    if (f==='name') t.name = el.value;
    else if (f==='overrun') t.overrun = el.checked;
    else if (f==='color') t.color = el.value;
    else if (f==='type'){ t.type = el.value; resetT(t); }
    else if (f==='time'){ t.time = hms(parseHMS(el.value), true); resetT(t); }
    else { t[f] = el.value.trim()==='' ? 0 : parseHMS(el.value); resetT(t); }
    save(); render(); renderModal();
  });
  render();
  setInterval(function(){
    var now = Date.now(), changed = false;
    $('clk').textContent = clockText(now);
    timers.forEach(function(t){
      var v = val(t, now);
      if (t.running && !t.overrun && ((t.type!=='up' && v.ms<=0) || (t.type==='up' && t.end>0 && v.ms>=t.end*1000))){
        t.running = false; t.base = t.type==='down' ? t.dur*1000 : t.base + (now - t.t0); changed = true;
      }
      var d = document.querySelector('[data-d="'+t.id+'"]');
      if (d){ d.textContent = fmtV(v, t, opts.mode) + (opts.mode==='min' ? ' menit' : ''); d.className = 'disp' + (v.over ? ' over' : v.warn && t.type!=='up' ? ' warn' : ''); }
    });
    if (changed){ save(); render(); }
    updateOut($('pv'), now);
  }, 100);
}
if (IS_OUT) initOutput(); else initController();
window.addEventListener('hashchange', function(){ location.reload(); });