# -*- coding: utf-8 -*-
"""悬浮清单 — 关不掉的桌面 Todolist 悬浮框 (pywebview + WebView2)"""
import json
import os
import threading
import ctypes
import webview

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE, 'data.json')

EXPANDED = (300, 440)
COLLAPSED = (140, 46)

QUIT = [False]
SAVE_LOCK = threading.Lock()


def load_store():
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def write_store(store):
    with SAVE_LOCK:
        tmp = DATA_FILE + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            json.dump(store, f, ensure_ascii=False, indent=1)
        os.replace(tmp, DATA_FILE)


HTML = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="dark">
<style>
* { margin:0; padding:0; box-sizing:border-box; -webkit-user-select:none; user-select:none; }
html,body { width:100%; height:100%; background:transparent; overflow:hidden;
  font-family:'Segoe UI Variable Text','Segoe UI','Microsoft YaHei UI',sans-serif; }
body { visibility:hidden; }
body.ready { visibility:visible; }

#card { width:100%; height:100%; display:flex; flex-direction:column;
  background:rgba(30,32,38,.96);
  border:1px solid rgba(255,255,255,.10); border-radius:8px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07); color:#e8eaed; font-size:13px; }

/* ---------- 展开态 ---------- */
#header { flex:0 0 44px; display:flex; align-items:center; gap:8px; padding:0 8px 0 14px;
  border-bottom:1px solid rgba(255,255,255,.06); }
#header .title { font-weight:600; letter-spacing:.5px; }
#header .count { margin-left:auto; font-size:11px; color:#9aa0a8; background:rgba(255,255,255,.07);
  padding:2px 9px; border-radius:10px; }
#collapseBtn { flex:0 0 28px; height:28px; border:none; border-radius:8px; background:transparent;
  color:#9aa0a8; cursor:pointer; display:flex; align-items:center; justify-content:center; }
#collapseBtn:hover { background:rgba(255,255,255,.09); color:#e8eaed; }

#list { flex:1; overflow-y:auto; padding:6px 8px; }
#list::-webkit-scrollbar { width:6px; }
#list::-webkit-scrollbar-thumb { background:rgba(255,255,255,.12); border-radius:3px; }
#empty { height:100%; display:flex; align-items:center; justify-content:center;
  color:#6b7078; font-size:12px; letter-spacing:1px; }

.task { display:flex; align-items:center; gap:9px; padding:8px 8px; border-radius:9px; position:relative; }
.task:hover { background:rgba(255,255,255,.05); }
.task .chk { flex:0 0 17px; height:17px; border-radius:50%; border:1.6px solid #565b64;
  cursor:pointer; display:flex; align-items:center; justify-content:center; background:transparent; }
.task .chk:hover { border-color:#7dd8c8; }
.task.done .chk { border-color:#3c414a; background:#3c414a; }
.task .txt { flex:1; line-height:1.45; word-break:break-all; }
.task.done .txt { color:#6b7078; text-decoration:line-through; }
.task .ddl { flex:0 0 auto; font-size:11px; padding:2px 8px; border-radius:9px; cursor:pointer;
  border:1px solid transparent; white-space:nowrap; }
.task .ddl.far   { color:#8b909a; background:rgba(255,255,255,.06); }
.task .ddl.soon  { color:#ffb454; background:rgba(255,180,84,.12); }
.task .ddl.over  { color:#ff7a76; background:rgba(255,122,118,.13); }
.task .ddl.add   { color:#565b64; background:transparent; border-color:rgba(255,255,255,.14); opacity:0; }
.task:hover .ddl.add { opacity:1; }
.task .ddl.add:hover { color:#7dd8c8; border-color:#7dd8c8; }
.task .del { flex:0 0 22px; height:22px; border:none; border-radius:6px; background:transparent;
  color:#565b64; cursor:pointer; opacity:0; display:flex; align-items:center; justify-content:center; }
.task:hover .del { opacity:1; }
.task .del:hover { color:#ff7a76; background:rgba(255,122,118,.1); }
.task.overdue:not(.done) .txt { color:#ffb3b0; }

#inputBar { flex:0 0 54px; display:flex; align-items:center; padding:0 12px 12px; }
#input { flex:1; height:32px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1);
  border-radius:9px; padding:0 12px; color:#e8eaed; font-size:13px; outline:none;
  font-family:inherit; -webkit-user-select:text; user-select:text; }
#input::placeholder { color:#565b64; }
#input:focus { border-color:rgba(125,216,200,.55); background:rgba(255,255,255,.08); }

#picker { position:absolute; opacity:0; pointer-events:none; height:0; width:0; }

/* ---------- 折叠态 ---------- */
#pill { display:none; width:100%; height:100%; }
body.collapsed #card { display:none; }
body.collapsed #pill { display:flex; align-items:center; justify-content:center; gap:7px;
  background:rgba(30,32,38,.96);
  border:1px solid rgba(255,255,255,.10); border-radius:4px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.07); color:#e8eaed;
  font-size:12.5px; cursor:pointer; }
#pill:hover { background:rgba(38,40,47,.92); }
#pill .dot { width:7px; height:7px; border-radius:50%; background:#7dd8c8; }
#pill .n { font-weight:600; color:#7dd8c8; }
</style>
</head>
<body>
<div id="card">
  <div id="header" class="pywebview-drag-region">
    <span class="title">悬浮清单</span>
    <span class="count" id="count">0 待办</span>
    <button id="collapseBtn" title="折叠">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>
    </button>
  </div>
  <div id="list"></div>
  <div id="inputBar">
    <input id="input" placeholder="回车添加任务…" maxlength="120">
  </div>
</div>
<div id="pill" class="pywebview-drag-region">
  <span class="dot"></span><span class="n" id="pillN">0</span><span>项待办</span>
</div>
<input type="date" id="picker">

<script>
const LSKEY = 'float-todo-state';
let state = { tasks: [], collapsed: false };
let saveTimer = null;

const $ = s => document.querySelector(s);
const api = () => window.pywebview && window.pywebview.api;

function esc(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function todayStr(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function dayDiff(dstr){
  const [y,m,dd] = dstr.split('-').map(Number);
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m-1, dd) - t0) / 86400000);
}
function ddlMeta(dstr){
  const d = dayDiff(dstr);
  if (d < 0)  return { cls:'over',  label:'超' + (-d) + '天' };
  if (d === 0) return { cls:'soon', label:'今天' };
  if (d === 1) return { cls:'soon', label:'明天' };
  return { cls:'far', label: d + '天后' };
}

function sorted(){
  const undone = state.tasks.filter(t => !t.done);
  const done = state.tasks.filter(t => t.done);
  undone.sort((a,b) => {
    if (!!a.ddl !== !!b.ddl) return a.ddl ? -1 : 1;
    if (a.ddl && b.ddl) return a.ddl < b.ddl ? -1 : a.ddl > b.ddl ? 1 : 0;
    return a.created - b.created;
  });
  done.sort((a,b) => (b.done_at||0) - (a.done_at||0));
  return undone.concat(done);
}

function render(){
  const list = $('#list');
  const items = sorted();
  if (!items.length) {
    list.innerHTML = '<div id="empty">今天没有安排，回车加一条</div>';
  } else {
    list.innerHTML = items.map(t => {
      let ddl;
      if (t.ddl) {
        const m = ddlMeta(t.ddl);
        ddl = '<span class="ddl ' + m.cls + '" data-a="ddl" data-id="' + t.id + '" title="修改期限">' + m.label + '</span>';
      } else if (!t.done) {
        ddl = '<span class="ddl add" data-a="ddl" data-id="' + t.id + '">+ 期限</span>';
      } else ddl = '';
      return '<div class="task' + (t.done ? ' done' : '') + (t.ddl && !t.done && dayDiff(t.ddl) < 0 ? ' overdue' : '') + '" data-id="' + t.id + '">' +
        '<span class="chk" data-a="toggle" data-id="' + t.id + '">' +
          (t.done ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0e0f12" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l6 6L20 6"/></svg>' : '') +
        '</span>' +
        '<span class="txt">' + esc(t.text) + '</span>' + ddl +
        '<button class="del" data-a="del" data-id="' + t.id + '" title="删除">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button></div>';
    }).join('');
  }
  const n = state.tasks.filter(t => !t.done).length;
  $('#count').textContent = n + ' 待办';
  $('#pillN').textContent = n;
}

function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { api() && api().save(JSON.stringify({ tasks: state.tasks, collapsed: state.collapsed })); } catch(e) {}
  }, 400);
}

function addTask(){
  const inp = $('#input');
  const text = inp.value.trim();
  if (!text) return;
  state.tasks.push({ id: Date.now() + '' + Math.floor(Math.random()*1000), text, ddl: null, done: false, created: Date.now(), done_at: null });
  inp.value = '';
  render(); save();
}

$('#input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) addTask();
});
$('#input').addEventListener('contextmenu', e => e.stopPropagation());

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const id = el.dataset.id, a = el.dataset.a;
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  if (a === 'toggle') { t.done = !t.done; t.done_at = t.done ? Date.now() : null; render(); save(); }
  if (a === 'del')    { state.tasks = state.tasks.filter(x => x.id !== id); render(); save(); }
  if (a === 'ddl')    { pickDdl(t); }
});

function pickDdl(t){
  const p = $('#picker');
  p.value = t.ddl || todayStr();
  p.onchange = () => { t.ddl = p.value || null; render(); save(); };
  try { p.showPicker(); } catch(err) { p.click(); }
}

function setCollapsed(c){
  state.collapsed = c;
  document.body.classList.toggle('collapsed', c);
  try { api() && (c ? api().collapse() : api().expand()); } catch(e) {}
  save();
}

$('#collapseBtn').addEventListener('click', () => setCollapsed(true));
$('#pill').addEventListener('click', () => setCollapsed(false));
$('#pill').addEventListener('contextmenu', e => {
  e.preventDefault();
  if (confirm('退出悬浮清单？')) { try { api() && api().quit(); } catch(err) {} }
});

async function boot(){
  try {
    const raw = await api().load();
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.tasks)) state = data;
  } catch(e) {}
  document.body.classList.add('ready');
  if (state.collapsed) document.body.classList.add('collapsed');
  render();
}
boot();
</script>
</body>
</html>"""


class Api:
    def __init__(self, window_holder):
        self.window_holder = window_holder

    def load(self):
        store = load_store()
        return json.dumps({
            'tasks': store.get('tasks', []),
            'collapsed': store.get('win', {}).get('collapsed', False),
        }, ensure_ascii=False)

    def save(self, payload):
        try:
            data = json.loads(payload)
        except Exception:
            return
        store = load_store()
        store['tasks'] = data.get('tasks', [])
        store.setdefault('win', {})
        store['win']['collapsed'] = bool(data.get('collapsed', False))
        write_store(store)

    def collapse(self):
        w = self.window_holder.get('w')
        if w:
            w.resize(*COLLAPSED)

    def expand(self):
        w = self.window_holder.get('w')
        if w:
            w.resize(*EXPANDED)

    def quit(self):
        QUIT[0] = True
        w = self.window_holder.get('w')
        if w:
            w.destroy()


def main():
    store = load_store()
    win_cfg = store.get('win', {})
    collapsed = bool(win_cfg.get('collapsed', False))
    size = COLLAPSED if collapsed else EXPANDED

    x, y = win_cfg.get('x'), win_cfg.get('y')
    if not isinstance(x, int) or not isinstance(y, int):
        try:
            s = webview.screens[0]
            x, y = s.width - size[0] - 40, s.height - size[1] - 80
        except Exception:
            x, y = 1200, 400

    window_holder = {}
    api = Api(window_holder)

    window = webview.create_window(
        '悬浮清单', html=HTML, js_api=api,
        x=x, y=y, width=size[0], height=size[1],
        frameless=True, easy_drag=False, on_top=True,
        background_color='#1E2026',
    )
    window_holder['w'] = window

    def on_loaded():
        # DWM 系统圆角(DWMWA_WINDOW_CORNER_PREFERENCE=33, DWMWCP_ROUND=2)：
        # 由系统直接裁剪窗口，四角无像素，避免 WebView2 白角
        try:
            hwnd = window.native.Handle
            val = ctypes.c_int(2)
            ctypes.windll.dwmapi.DwmSetWindowAttribute(
                hwnd, 33, ctypes.byref(val), ctypes.sizeof(val))
        except Exception as e:
            print('DWM corner failed:', e)

    def on_closing():
        return QUIT[0]

    def save_pos(x, y):
        try:
            st = load_store()
            st.setdefault('win', {})
            st['win']['x'] = int(x)
            st['win']['y'] = int(y)
            st['win']['collapsed'] = bool(st.get('win', {}).get('collapsed', False))
            write_store(st)
        except Exception:
            pass

    timer = [None]

    def on_moved(x, y):
        if timer[0]:
            timer[0].cancel()
        import threading as _t
        timer[0] = _t.Timer(0.8, save_pos, args=(x, y))
        timer[0].daemon = True
        timer[0].start()

    window.events.closing += on_closing
    window.events.moved += on_moved
    window.events.loaded += on_loaded

    webview.start()


if __name__ == '__main__':
    main()
