'use strict';
/* Lecture Recorder — installable web app.
   Records audio (MediaRecorder), transcribes live (Web Speech API), keeps jottings on the same clock,
   and saves everything on the device in IndexedDB as it goes, so a crash or closed tab loses at most a few seconds. */

const $ = id => document.getElementById(id);
const COMPANION = 'https://claude.ai/artifact/BmH69tUFkvt8JrU7rRg2FB';
const TAGS = { note: 'Note', important: 'Important', exam: 'Exam hint', confused: 'Lost me here', reading: 'Reading' };
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const canRecord = !!(navigator.mediaDevices && window.MediaRecorder);

const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(x).padStart(2, '0'); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const slug = s => (s || 'lecture').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lecture';
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, ms); }

/* ---------------- storage (IndexedDB) ---------------- */
let dbp;
function idb() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('lecture-recorder', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('lectures', { keyPath: 'id' });
      const c = d.createObjectStore('chunks', { keyPath: ['id', 'seg', 'seq'] });
      c.createIndex('byLecture', 'id');
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), s = t.objectStore(store); let out;
    Promise.resolve(fn(s)).then(v => out = v);
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const putLecture = L => tx('lectures', 'readwrite', s => s.put(JSON.parse(JSON.stringify(L))));
const getLecture = id => tx('lectures', 'readonly', s => reqP(s.get(id)));
const allLectures = () => tx('lectures', 'readonly', s => reqP(s.getAll()));
const putChunk = c => tx('chunks', 'readwrite', s => s.put(c));
const chunksFor = id => tx('chunks', 'readonly', s => reqP(s.index('byLecture').getAll(id)));
async function deleteLecture(id) {
  await tx('lectures', 'readwrite', s => s.delete(id));
  await tx('chunks', 'readwrite', s => s.delete(IDBKeyRange.bound([id, 0, 0], [id, Infinity, Infinity])));
}

/* ---------------- views ---------------- */
let view = 'library';
function show(v, title) {
  view = v;
  ['library', 'record', 'detail'].forEach(x => $('v-' + x).hidden = x !== v);
  $('backBtn').hidden = v === 'library';
  $('barTitle').textContent = title || (v === 'library' ? 'Lectures' : v === 'record' ? 'Recording' : 'Lecture');
  document.body.classList.toggle('recording-view', v === 'record');
  scrollTo(0, 0);
}
$('backBtn').onclick = async () => {
  if (view === 'record' && rec.state !== 'idle') {
    if (!$('backBtn').dataset.sure) { $('backBtn').dataset.sure = '1'; toast('Recording is still on. Tap ← again to finish and go back.'); setTimeout(() => delete $('backBtn').dataset.sure, 4000); return; }
    delete $('backBtn').dataset.sure; await finish();
  }
  renderLibrary(); show('library');
};

/* ---------------- library ---------------- */
async function renderLibrary() {
  const list = (await allLectures()).sort((a, b) => b.created - a.created);
  const ul = $('lib');
  if (!list.length) { ul.innerHTML = '<li class="empty">No lectures yet. Press <b>Record a lecture</b> when your class starts.</li>'; return; }
  ul.innerHTML = '';
  for (const L of list) {
    const li = document.createElement('li'), b = document.createElement('button');
    const jots = L.lines.filter(l => l.kind === 'jot').length;
    const words = L.lines.filter(l => l.kind === 'speech').reduce((n, l) => n + l.text.split(/\s+/).length, 0);
    b.innerHTML = `<span class="t"></span><span class="m"></span>`;
    b.querySelector('.t').textContent = L.title || 'Untitled lecture';
    b.querySelector('.m').textContent = [L.course, L.date, fmt(L.durationMs), `${jots} jot${jots === 1 ? '' : 's'}`, `${words.toLocaleString()} words`,
      L.status === 'interrupted' ? 'Interrupted — open to continue' : ''].filter(Boolean).join(' · ');
    b.onclick = () => openDetail(L.id);
    li.append(b); ul.append(li);
  }
}

/* ---------------- recording ---------------- */
const rec = { state: 'idle', L: null, acc: 0, runStart: 0, stream: null, mr: null, seg: 0, seq: 0, recog: null, tick: null, lock: null, saveT: null, interimEl: null };
const now = () => rec.acc + (rec.state === 'running' ? Date.now() - rec.runStart : 0);

function newLecture() {
  return { id: uid(), title: '', course: localStorageGet('lr-course') || '', date: today(), created: Date.now(), durationMs: 0, lines: [], segments: 0, status: 'new' };
}
function localStorageGet(k) { try { return localStorage.getItem(k) } catch (_) { return null } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v) } catch (_) {} }

function openRecorder(L) {
  rec.L = L; rec.acc = L.durationMs || 0; rec.state = 'idle'; rec.seg = L.segments || 0;
  $('rTitle').value = L.title; $('rCourse').value = L.course;
  $('log').innerHTML = ''; rec.interimEl = null;
  if (L.lines.length) L.lines.forEach(renderLine); else $('log').innerHTML = '<p class="fine center" id="logEmpty">The transcript and your jottings appear here as you go.</p>';
  $('clock').textContent = fmt(rec.acc);
  setStatus(L.lines.length ? 'Ready to continue' : 'Ready');
  $('startBtn').textContent = L.lines.length ? 'Continue' : 'Start';
  $('startBtn').disabled = false; $('pauseBtn').disabled = true; $('finishBtn').disabled = true;
  $('recWarn').hidden = true;
  show('record', 'Recording');
}
function setStatus(t, on) { $('statusText').textContent = t; $('dot').classList.toggle('on', !!on); }
function warn(msg) { $('recWarn').hidden = !msg; $('recWarn').textContent = msg || ''; }

function renderLine(l) {
  const log = $('log'); const e = $('logEmpty'); if (e) e.remove();
  const d = document.createElement('div'); d.className = 'line' + (l.kind === 'jot' ? ' jot' : '');
  const t = document.createElement('time'); t.textContent = fmt(l.t);
  const s = document.createElement('span');
  s.textContent = l.kind === 'jot' ? `${TAGS[l.tag] || l.tag}${l.text ? ': ' + l.text : ''}` : l.text;
  d.append(t, s);
  if (rec.interimEl && rec.interimEl.parentNode === log) log.insertBefore(d, rec.interimEl); else log.append(d);
  if (view === 'record') d.scrollIntoView({ block: 'end', behavior: 'smooth' });
}
function addLine(l) { rec.L.lines.push(l); renderLine(l); queueSave(); }
function queueSave() { clearTimeout(rec.saveT); rec.saveT = setTimeout(saveNow, 800); }
async function saveNow() {
  if (!rec.L) return; clearTimeout(rec.saveT);
  rec.L.durationMs = now(); rec.L.title = $('rTitle').value.trim(); rec.L.course = $('rCourse').value.trim();
  try { await putLecture(rec.L); } catch (e) { warn('Couldn’t save to this device: ' + e.message); }
}
['rTitle', 'rCourse'].forEach(id => $(id).addEventListener('input', () => { if (id === 'rCourse') localStorageSet('lr-course', $(id).value.trim()); if (rec.L.status !== 'new') queueSave(); }));

async function wake() { try { rec.lock = await navigator.wakeLock?.request('screen'); } catch (_) {} }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && rec.state === 'running') wake();
  if (document.visibilityState === 'hidden' && rec.L) saveNow();
});

function startRecog() {
  if (!SR) return;
  const r = new SR(); rec.recog = r;
  r.continuous = true; r.interimResults = true; r.lang = localStorageGet('lr-lang') || 'en-GB';
  r.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) { const text = res[0].transcript.trim(); if (text) addLine({ t: now(), kind: 'speech', text }); }
      else interim += res[0].transcript;
    }
    const log = $('log');
    if (!rec.interimEl) { rec.interimEl = document.createElement('div'); rec.interimEl.className = 'line interim'; rec.interimEl.innerHTML = '<time>…</time><span></span>'; }
    rec.interimEl.querySelector('span').textContent = interim;
    if (interim) { if (rec.interimEl.parentNode !== log) log.append(rec.interimEl); } else rec.interimEl.remove();
  };
  r.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') warn('Live transcript is blocked. Allow the microphone for this app in your browser settings.');
    else if (e.error === 'audio-capture') warn('This device can’t transcribe while it records audio. Audio is still recording; transcribe it afterwards, or use a laptop for live transcript.');
    else if (e.error === 'network') warn('Live transcript needs an internet connection. Audio and jottings still work offline.');
  };
  r.onend = () => { if (rec.state === 'running' && rec.recog === r) setTimeout(() => { try { r.start(); } catch (_) {} }, 250); };
  try { r.start(); } catch (_) {}
}
function stopRecog() { const r = rec.recog; rec.recog = null; try { r && r.stop(); } catch (_) {} rec.interimEl && rec.interimEl.remove(); }

async function start() {
  if (rec.state === 'paused') { // resume
    rec.mr && rec.mr.state === 'paused' && rec.mr.resume();
  } else {
    if (canRecord) {
      try { rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } }); }
      catch (e) { warn('The microphone was blocked. Allow it for this app, then press Start again. You can still jot without it.'); }
      if (rec.stream) {
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
        rec.mr = new MediaRecorder(rec.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
        rec.L.audioMime = rec.mr.mimeType || mime || 'audio/webm';
        rec.seg = (rec.L.segments || 0); rec.L.segments = rec.seg + 1; rec.seq = 0;
        const seg = rec.seg, id = rec.L.id;
        rec.mr.ondataavailable = ev => { if (ev.data && ev.data.size) putChunk({ id, seg, seq: rec.seq++, blob: ev.data }).catch(() => warn('Storage is full — audio stopped saving. Jottings and transcript still save.')); };
        rec.mr.start(5000); // a chunk every 5 s goes straight to storage
      }
    }
  }
  rec.state = 'running'; rec.runStart = Date.now(); rec.L.status = 'recording';
  startRecog(); wake();
  clearInterval(rec.tick); rec.tick = setInterval(() => $('clock').textContent = fmt(now()), 500);
  setStatus(rec.stream ? (SR ? 'Recording · live transcript on' : 'Recording audio') : 'Clock running · jotting only', true);
  $('startBtn').disabled = true; $('pauseBtn').disabled = false; $('finishBtn').disabled = false;
  if (!SR) warn('Live transcript isn’t supported in this browser. Audio and jottings still work — Chrome or Edge add live transcript.');
  saveNow();
}
async function pause() {
  rec.acc = now(); rec.state = 'paused'; clearInterval(rec.tick);
  rec.mr && rec.mr.state === 'recording' && rec.mr.pause(); stopRecog();
  setStatus('Paused'); $('startBtn').textContent = 'Resume'; $('startBtn').disabled = false; $('pauseBtn').disabled = true;
  await saveNow();
}
async function finish() {
  if (rec.state === 'running') rec.acc = now();
  rec.state = 'idle'; clearInterval(rec.tick); stopRecog();
  if (rec.mr && rec.mr.state !== 'inactive') { await new Promise(r => { rec.mr.addEventListener('stop', () => setTimeout(r, 300), { once: true }); rec.mr.stop(); }); }
  rec.stream && rec.stream.getTracks().forEach(t => t.stop()); rec.stream = null; rec.mr = null;
  try { await rec.lock?.release(); } catch (_) {}
  rec.L.status = 'done'; await saveNow();
  const id = rec.L.id; rec.L = null; return id;
}
$('startBtn').onclick = start;
$('pauseBtn').onclick = pause;
$('finishBtn').onclick = async () => { const id = await finish(); openDetail(id); toast('Saved on this device'); };

function jot(tag, text) {
  if (!rec.L) return;
  if (rec.state === 'idle' && !rec.L.lines.length) { toast('Press Start first so your jottings get the right time'); return; }
  addLine({ t: now(), kind: 'jot', tag, text: (text || '').trim() });
  if (navigator.vibrate) navigator.vibrate(15);
}
$('jotForm').addEventListener('submit', e => { e.preventDefault(); const v = $('jotText').value; if (!v.trim()) return; jot('note', v); $('jotText').value = ''; });
document.querySelectorAll('.tag').forEach(b => b.onclick = () => { jot(b.dataset.tag, $('jotText').value); $('jotText').value = ''; });

$('newBtn').onclick = () => openRecorder(newLecture());

/* ---------------- detail ---------------- */
let current = null;
async function openDetail(id) {
  current = await getLecture(id); if (!current) { renderLibrary(); show('library'); return; }
  const L = current;
  $('dTitle').value = L.title; $('dCourse').value = L.course;
  const words = L.lines.filter(l => l.kind === 'speech').reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  $('dMeta').textContent = [L.date, fmt(L.durationMs), `${words.toLocaleString()} words transcribed`].join(' · ');
  const jots = L.lines.filter(l => l.kind === 'jot');
  $('dJots').innerHTML = jots.length ? '' : '<li class="fine" style="display:block">No jottings in this lecture.</li>';
  jots.forEach(j => { const li = document.createElement('li'); li.innerHTML = `<time>${fmt(j.t)}</time><span class="chip ${j.tag}">${TAGS[j.tag] || j.tag}</span><span></span>`; li.lastChild.textContent = j.text; $('dJots').append(li); });
  const dl = $('dLog'); dl.innerHTML = '';
  const speech = L.lines.filter(l => l.kind === 'speech');
  if (!speech.length) dl.innerHTML = '<p class="fine">No live transcript for this lecture. If you have the audio, a transcription tool can turn it into text for Lecture Companion.</p>';
  speech.forEach(l => { const d = document.createElement('div'); d.className = 'line'; d.innerHTML = `<time>${fmt(l.t)}</time><span></span>`; d.lastChild.textContent = l.text; dl.append(d); });
  const chunks = await chunksFor(id);
  $('audioBtn').hidden = !chunks.length;
  $('player').hidden = !chunks.length; $('player').removeAttribute('src');
  if (chunks.length) { const b = await audioBlobs(chunks); if (b.length) { $('player').src = URL.createObjectURL(b[0].blob); } }
  $('delWrap').innerHTML = '<button class="danger" id="delBtn">Delete</button>'; bindDelete();
  show('detail', L.title || 'Untitled lecture');
}
async function audioBlobs(chunks) {
  const segs = {};
  chunks.sort((a, b) => a.seg - b.seg || a.seq - b.seq).forEach(c => (segs[c.seg] ||= []).push(c.blob));
  const mime = current.audioMime || 'audio/webm';
  return Object.keys(segs).map(k => ({ seg: +k, blob: new Blob(segs[k], { type: mime.split(';')[0] }) }));
}
['dTitle', 'dCourse'].forEach(id => $(id).addEventListener('change', async () => {
  current.title = $('dTitle').value.trim(); current.course = $('dCourse').value.trim(); await putLecture(current);
  $('barTitle').textContent = current.title || 'Untitled lecture';
}));

function exportText(L) {
  const jots = L.lines.filter(l => l.kind === 'jot').map(l => `[${fmt(l.t)}] (${l.tag}) ${l.text}`);
  const speech = L.lines.filter(l => l.kind === 'speech').map(l => `[${fmt(l.t)}] ${l.text}`);
  return `# ${L.title || 'Lecture'}\nCourse: ${L.course || ''}\nDate: ${L.date}\n\n## Jottings\n${jots.join('\n')}\n\n## Transcript\n${speech.join('\n')}\n`;
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

$('shareBtn').onclick = async () => {
  const name = `${slug(current.title)}-${current.date}.txt`;
  const file = new File([exportText(current)], name, { type: 'text/plain' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: current.title || 'Lecture' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  download(file, name); toast('Downloaded — drop it into the Transcript tab in Lecture Companion', 4000);
};
$('copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(exportText(current)); toast('Copied — paste it into the Transcript tab in Lecture Companion', 4000); }
  catch (_) { toast('Copy didn’t work here. Use Send file instead.'); }
};
$('audioBtn').onclick = async () => {
  const parts = await audioBlobs(await chunksFor(current.id));
  const ext = (current.audioMime || '').includes('mp4') ? 'm4a' : 'webm';
  parts.forEach((p, i) => setTimeout(() => download(p.blob, `${slug(current.title)}-${current.date}${parts.length > 1 ? '-part' + (i + 1) : ''}.${ext}`), i * 600));
};
$('resumeBtn').onclick = () => openRecorder(current);
function bindDelete() {
  $('delBtn').onclick = () => {
    $('delWrap').innerHTML = '<span class="ctrls"><button class="danger" id="delYes">Delete for good</button><button id="delNo">Keep</button></span>';
    $('delNo').onclick = () => { $('delWrap').innerHTML = '<button class="danger" id="delBtn">Delete</button>'; bindDelete(); };
    $('delYes').onclick = async () => { await deleteLecture(current.id); current = null; renderLibrary(); show('library'); toast('Lecture deleted'); };
  };
}

/* ---------------- install + offline ---------------- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').hidden = false; });
$('installBtn').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('installBtn').hidden = true; };
window.addEventListener('appinstalled', () => $('installBtn').hidden = true);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------------- boot ---------------- */
(async () => {
  const notes = [];
  if (!canRecord) notes.push('This browser can’t record audio. You can still jot.');
  if (!SR) notes.push('Live transcript needs Chrome or Edge. On iPhone, audio and jottings work; transcribe the audio afterwards.');
  if (!window.isSecureContext) notes.push('Open this app from its https:// address — the microphone is blocked on plain files and http.');
  $('supportNote').hidden = !notes.length; $('supportNote').textContent = notes.join(' ');
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch (_) {}
  try {
    const all = await allLectures();
    for (const L of all) if (L.status === 'recording') { L.status = 'interrupted'; await putLecture(L); }
  } catch (e) { $('supportNote').hidden = false; $('supportNote').textContent = 'Storage isn’t available in this browser mode (private windows block it).'; }
  $('storageNote').textContent = 'Lectures are saved on this device only. Nothing is uploaded, apart from the speech your browser sends for live transcription.';
  renderLibrary();
})();
window.addEventListener('beforeunload', e => { if (rec.state !== 'idle') { saveNow(); e.preventDefault(); e.returnValue = ''; } });
