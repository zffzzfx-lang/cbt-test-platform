// ===== PRO-CBT - FULLY RESPONSIVE =====
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Database
let DB;
const dbReq = indexedDB.open('CBT_PRO_V3', 3);
dbReq.onupgradeneeded = e => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains('tests')) d.createObjectStore('tests', { keyPath: 'id', autoIncrement: true });
    if (!d.objectStoreNames.contains('results')) {
        const r = d.createObjectStore('results', { keyPath: 'id', autoIncrement: true });
        r.createIndex('testId', 'testId', { unique: false });
    }
    if (!d.objectStoreNames.contains('students')) d.createObjectStore('students', { keyPath: 'rollNo' });
};
dbReq.onsuccess = e => { DB = e.target.result; init(); };
dbReq.onerror = () => document.getElementById('app').innerHTML = '<div style="color:#fff;text-align:center;padding:50px"><h2>⚠️ Database Error</h2><p>Please allow storage in browser settings.</p></div>';

const dba = (s, d) => new Promise(r => { const t = DB.transaction(s, 'readwrite'); const q = t.objectStore(s).add(d); q.onsuccess = () => r(q.result); });
const dbg = (s) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
const dbgi = (s, i, v) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).index(i).getAll(v); q.onsuccess = () => r(q.result); });
const dbgid = (s, id) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).get(id); q.onsuccess = () => r(q.result); });

// State
let state = { role: 'student', user: null, test: null, engine: null, timerInterval: null, testSubmitted: false, sidebarOpen: false };

// Toast
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
}

// Render with transition
function R(html) {
    const app = document.getElementById('app');
    app.style.opacity = '0';
    setTimeout(() => { app.innerHTML = html; app.style.opacity = '1'; }, 120);
}
document.getElementById('app').style.transition = 'opacity 0.15s ease';

// Sample questions
function sampleQs(n = 15) {
    const pool = [
        { q: "What is the capital of India?", o: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], a: "New Delhi" },
        { q: "Which planet is known as the Red Planet?", o: ["Venus", "Mars", "Jupiter", "Saturn"], a: "Mars" },
        { q: "What is H2O commonly known as?", o: ["Oxygen", "Hydrogen", "Water", "Salt"], a: "Water" },
        { q: "Who wrote 'Romeo and Juliet'?", o: ["Dickens", "Shakespeare", "Austen", "Twain"], a: "Shakespeare" },
        { q: "What is the largest ocean?", o: ["Atlantic", "Indian", "Arctic", "Pacific"], a: "Pacific" },
        { q: "What is the square root of 144?", o: ["10", "11", "12", "14"], a: "12" },
        { q: "Which element has symbol 'Au'?", o: ["Silver", "Gold", "Copper", "Iron"], a: "Gold" },
        { q: "Speed of light?", o: ["3×10⁶ m/s", "3×10⁸ m/s", "3×10¹⁰ m/s", "3×10⁴ m/s"], a: "3×10⁸ m/s" },
        { q: "Who discovered gravity?", o: ["Einstein", "Newton", "Galileo", "Hawking"], a: "Newton" },
        { q: "Largest continent?", o: ["Africa", "Asia", "Europe", "America"], a: "Asia" },
        { q: "Boiling point of water?", o: ["90°C", "100°C", "110°C", "120°C"], a: "100°C" },
        { q: "Gas absorbed by plants?", o: ["Oxygen", "Nitrogen", "CO2", "Hydrogen"], a: "CO2" },
        { q: "Smallest prime number?", o: ["0", "1", "2", "3"], a: "2" },
        { q: "Mona Lisa painter?", o: ["Van Gogh", "Da Vinci", "Picasso", "Rembrandt"], a: "Da Vinci" },
        { q: "Currency of Japan?", o: ["Yuan", "Won", "Yen", "Dollar"], a: "Yen" },
        { q: "How many continents?", o: ["5", "6", "7", "8"], a: "7" },
        { q: "Largest animal?", o: ["Elephant", "Blue Whale", "Giraffe", "Shark"], a: "Blue Whale" },
        { q: "Sun rises from?", o: ["North", "South", "East", "West"], a: "East" },
        { q: "National bird of India?", o: ["Eagle", "Peacock", "Parrot", "Sparrow"], a: "Peacock" },
        { q: "How many days in a leap year?", o: ["364", "365", "366", "367"], a: "366" }
    ];
    return pool.slice(0, Math.min(n, pool.length)).map((q, i) => ({ id: i + 1, q: q.q, opts: q.o, ans: q.a }));
}

// Init
async function init() {
    const tests = await dbg('tests');
    if (tests.length === 0) {
        await dba('tests', { name: 'Sample GK Test', subject: 'GK', duration: 30, questions: sampleQs(15), total: 15, createdAt: new Date().toISOString() });
    }
    const session = sessionStorage.getItem('cbt_sess');
    if (session) {
        const d = JSON.parse(session);
        if (d.role === 'admin') renderAdmin();
        else if (d.role === 'student' && d.testId) resumeStudent(d);
        else renderLogin();
    } else renderLogin();
}

// ===== LOGIN =====
function renderLogin() {
    state = { role: 'student', user: null, test: null, engine: null, timerInterval: null, testSubmitted: false, sidebarOpen: false };
    sessionStorage.removeItem('cbt_sess');
    R(`<div class="login-wrap"><div class="login-card anim-fade"><h1>📚 ProCBT</h1><p class="sub">Professional Test Platform</p><div class="tabs"><div class="tab active" onclick="swTab('student',this)">👨‍🎓 Student</div><div class="tab" onclick="swTab('admin',this)">👨‍🏫 Admin</div></div><div id="loginForm"></div></div></div>`);
    swTab('student', document.querySelector('.tab'));
}

async function swTab(role, el) {
    state.role = role;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const tests = await dbg('tests');
    const f = document.getElementById('loginForm');
    if (role === 'admin') {
        f.innerHTML = `<div class="fg"><label>Admin ID</label><input id="aid" value="admin123"></div><div class="fg"><label>Password</label><input id="apass" type="password" value="admin123"></div><button class="btn btn-p" onclick="loginAdmin()">🔑 Login</button><p style="text-align:center;margin-top:8px;color:var(--text2);font-size:11px">admin123 / admin123</p>`;
    } else {
        f.innerHTML = `<div class="fg"><label>Full Name</label><input id="sname" placeholder="Enter your name"></div><div class="fg"><label>Roll Number</label><input id="sroll" placeholder="Enter roll number"></div><div class="fg"><label>Select Test</label><select id="stest">${tests.map(t => `<option value="${t.id}">${t.name} (${t.duration}min)</option>`).join('')}</select></div><button class="btn btn-p" onclick="loginStudent()">▶️ Start Test</button>`;
    }
}

function loginAdmin() {
    if (document.getElementById('aid').value === 'admin123' && document.getElementById('apass').value === 'admin123') {
        sessionStorage.setItem('cbt_sess', JSON.stringify({ role: 'admin' }));
        renderAdmin();
    } else toast('Invalid credentials!');
}

async function loginStudent() {
    const n = document.getElementById('sname').value, r = document.getElementById('sroll').value, tid = parseInt(document.getElementById('stest').value);
    if (!n || !r) return toast('Fill all fields');
    const test = await dbgid('tests', tid);
    if (!test) return toast('Test not found');
    await dba('students', { rollNo: r, name: n, lastLogin: new Date().toISOString() });
    state.user = { name: n, rollNo: r }; state.test = test;
    sessionStorage.setItem('cbt_sess', JSON.stringify({ role: 'student', name: n, rollNo: r, testId: tid }));
    startTest(test);
}

async function resumeStudent(d) {
    state.role = 'student'; state.user = { name: d.name, rollNo: d.rollNo };
    const test = await dbgid('tests', d.testId);
    if (test) { state.test = test; startTest(test); } else renderLogin();
}

// ===== TEST ENGINE =====
class TestEngine {
    constructor(qs, dur) {
        this.questions = qs; this.duration = dur;
        this.timeRemaining = dur * 60; this.cur = 0;
        this.answers = {}; this.review = new Set();
        this.startTime = Date.now();
    }
    getQ() { return this.questions[this.cur]; }
    sel(i) { this.answers[this.cur] = i; this.review.delete(this.cur); }
    clr() { delete this.answers[this.cur]; }
    togRev() { this.review.has(this.cur) ? this.review.delete(this.cur) : this.review.add(this.cur); }
    nxt() { if (this.cur < this.questions.length - 1) this.cur++; }
    prv() { if (this.cur > 0) this.cur--; }
    jmp(i) { if (i >= 0 && i < this.questions.length) this.cur = i; }
    calc() {
        let c = 0, inc = 0, u = 0; const det = [];
        this.questions.forEach((q, i) => {
            const ua = this.answers[i];
            if (ua === undefined) { u++; det.push({ q: q.q, user: 'Not Attempted', correct: q.ans, ok: false }); }
            else if (q.opts[ua] === q.ans) { c++; det.push({ q: q.q, user: q.opts[ua], correct: q.ans, ok: true }); }
            else { inc++; det.push({ q: q.q, user: q.opts[ua], correct: q.ans, ok: false }); }
        });
        return { total: this.questions.length, correct: c, incorrect: inc, unattempted: u, percentage: parseFloat(((c / this.questions.length) * 100).toFixed(1)), timeTaken: Math.floor((Date.now() - this.startTime) / 1000), details: det };
    }
}

// ===== START TEST =====
function startTest(test) {
    state.testSubmitted = false; state.engine = new TestEngine(test.questions, test.duration);
    R(`<div class="test-wrap"><div class="test-top"><div><h3>${test.name}</h3><small>${state.user.name} | ${state.user.rollNo}</small></div><div class="timer" id="td">00:00</div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-o btn-sm" onclick="togRev()">📌</button><button class="btn btn-d btn-sm" onclick="subTest()">📝 Submit</button></div></div><div class="test-body"><div class="q-area" id="qA"></div><div class="palette"><div class="pal-title">Palette</div><div class="pal-grid" id="qG"></div><div class="legend"><span style="background:rgba(16,185,129,0.4)"></span> Ans <span style="background:var(--accent)"></span> Cur <span style="background:rgba(245,158,11,0.4)"></span> Rev</div></div></div></div>`);
    updUI();
    state.timerInterval = setInterval(() => {
        if (!state.engine || state.testSubmitted) { clearInterval(state.timerInterval); return; }
        state.engine.timeRemaining--;
        const td = document.getElementById('td');
        if (td) {
            const m = Math.floor(state.engine.timeRemaining / 60), s = state.engine.timeRemaining % 60;
            td.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            td.className = 'timer' + (state.engine.timeRemaining <= 60 ? ' danger' : state.engine.timeRemaining <= 300 ? ' warn' : '');
        }
        if (state.engine.timeRemaining <= 0) { clearInterval(state.timerInterval); subTest(true); }
    }, 1000);
}

function updUI() {
    if (!state.engine || state.testSubmitted) return;
    const q = state.engine.getQ(), qA = document.getElementById('qA'), qG = document.getElementById('qG');
    if (!qA || !qG) return;
    qA.innerHTML = `<div class="anim-fade"><div class="q-num">Q ${state.engine.cur + 1}/${state.engine.questions.length}</div><div class="q-text">${q.q}</div><div class="opts">${q.opts.map((o, i) => `<div class="opt ${state.engine.answers[state.engine.cur] === i ? 'sel' : ''}" onclick="selOpt(${i})"><b>${String.fromCharCode(65 + i)}.</b> ${o}</div>`).join('')}</div><div class="nav-btns"><button class="btn btn-o btn-sm" onclick="prvQ()" ${state.engine.cur === 0 ? 'disabled' : ''}>◀</button><button class="btn btn-o btn-sm" onclick="clrQ()">Clear</button><button class="btn btn-p btn-sm" onclick="nxtQ()" ${state.engine.cur === state.engine.questions.length - 1 ? 'disabled' : ''}>▶</button></div></div>`;
    qG.innerHTML = state.engine.questions.map((_, i) => {
        let cls = ''; if (i === state.engine.cur) cls = 'cur'; else if (state.engine.review.has(i)) cls = 'rev'; else if (state.engine.answers[i] !== undefined) cls = 'ans';
        return `<div class="pal-btn ${cls}" onclick="jmpQ(${i})">${i + 1}</div>`;
    }).join('');
}

// Actions
function selOpt(i) { state.engine.sel(i); updUI(); }
function clrQ() { state.engine.clr(); updUI(); }
function togRev() { state.engine.togRev(); updUI(); }
function nxtQ() { state.engine.nxt(); updUI(); }
function prvQ() { state.engine.prv(); updUI(); }
function jmpQ(i) { state.engine.jmp(i); updUI(); }

async function subTest(auto = false) {
    if (!auto && !confirm('Submit test? You cannot change answers.')) return;
    state.testSubmitted = true; clearInterval(state.timerInterval);
    const result = state.engine.calc(), sess = JSON.parse(sessionStorage.getItem('cbt_sess'));
    await dba('results', { testId: state.test.id, tname: state.test.name, sname: sess.name, sroll: sess.rollNo, ...result, date: new Date().toISOString() });
    const all = (await dbgi('results', 'testId', state.test.id)).sort((a, b) => b.percentage - a.percentage);
    const rank = all.findIndex(r => r.sroll === sess.rollNo) + 1;
    renderResults(result, rank, all);
}

// ===== RESULTS =====
function renderResults(r, rank, all) {
    R(`<div class="res-wrap"><div class="res-card anim-fade"><h2>✅ Test Completed!</h2><div class="score-circle">${r.percentage}%</div><p style="text-align:center;color:var(--text2);margin:8px 0">🏅 Rank: <b style="color:var(--accent2)">#${rank}</b>/${all.length} | ⏱️ ${Math.floor(r.timeTaken/60)}m ${r.timeTaken%60}s</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0"><div class="stat"><div class="val" style="color:var(--green)">${r.correct}</div><div class="lbl">✅ Correct</div></div><div class="stat"><div class="val" style="color:var(--red)">${r.incorrect}</div><div class="lbl">❌ Incorrect</div></div><div class="stat"><div class="val" style="color:var(--yellow)">${r.unattempted}</div><div class="lbl">⚪ Unattempted</div></div></div><div class="charts"><div class="chart-box"><canvas id="c1"></canvas></div><div class="chart-box"><canvas id="c2"></canvas></div></div><div class="card"><h4>🏆 Leaderboard</h4><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Time</th></tr></thead><tbody>${all.slice(0,5).map((x,i) => `<tr ${x.sroll===r.sroll?'style="background:rgba(99,102,241,0.06)"':''}><td><span class="badge ${i===0?'badge-g':i===1?'badge-s':i===2?'badge-b':''}">#${i+1}</span></td><td>${x.sname}</td><td><b>${x.percentage}%</b></td><td>${Math.floor(x.timeTaken/60)}m</td></tr>`).join('')}</tbody></table></div></div><div class="card"><h4>📋 Details</h4>${r.details.map((d,i) => `<div class="answer-detail ${d.ok?'':'wrong'}"><b>Q${i+1}:</b> ${d.q}<br><small>Your: <span style="color:${d.ok?'var(--green)':'var(--red)'}">${d.user}</span> | Correct: <span style="color:var(--green)">${d.correct||'N/A'}</span></small></div>`).join('')}</div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-p btn-sm" onclick="renderLogin()">🏠 Login</button><button class="btn btn-o btn-sm" onclick="retake()">🔄 Retake</button></div></div></div>`);
    setTimeout(() => {
        new Chart(document.getElementById('c1'), { type: 'doughnut', data: { labels: ['Correct', 'Incorrect', 'Unattempted'], datasets: [{ data: [r.correct, r.incorrect, r.unattempted], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderColor: '#1a1f2e', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 10, font: { size: 11 } } } } } });
        new Chart(document.getElementById('c2'), { type: 'bar', data: { labels: ['Score'], datasets: [{ data: [r.percentage], backgroundColor: r.percentage >= 60 ? '#10b981' : r.percentage >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: true, scales: { y: { max: 100, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } } });
    }, 80);
}

function retake() { if (state.test) startTest(state.test); }

// ===== ADMIN =====
function renderAdmin() {
    R(`<div class="menu-btn" onclick="toggleSidebar()">☰</div><div class="sidebar-overlay" id="overlay" onclick="toggleSidebar()"></div><div class="admin-layout"><div class="sidebar" id="sidebar"><h2>📊 ProCBT</h2><div class="nav-item active" onclick="admTab('upload',this)">📤 Upload</div><div class="nav-item" onclick="admTab('results',this)">📈 Results</div><div class="nav-item" onclick="admTab('rankings',this)">🏆 Rankings</div><div class="nav-item" onclick="renderLogin()">🚪 Logout</div></div><div class="main-area" id="admArea"></div></div>`);
    admTab('upload', document.querySelector('.nav-item'));
    updStats();
}

function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    document.getElementById('sidebar').classList.toggle('open', state.sidebarOpen);
    document.getElementById('overlay').classList.toggle('show', state.sidebarOpen);
}

async function updStats() {
    const t = await dbg('tests'), r = await dbg('results'), s = await dbg('students');
    const st = `<div class="stats"><div class="stat"><div class="val" style="color:var(--accent2)">${t.length}</div><div class="lbl">Tests</div></div><div class="stat"><div class="val" style="color:var(--green)">${s.length}</div><div class="lbl">Students</div></div><div class="stat"><div class="val" style="color:var(--yellow)">${r.length}</div><div class="lbl">Taken</div></div><div class="stat"><div class="val" style="color:var(--accent2)">${r.length>0?(r.reduce((a,x)=>a+x.percentage,0)/r.length).toFixed(1):0}%</div><div class="lbl">Avg</div></div></div>`;
    const area = document.getElementById('admArea');
    if (area) { const old = area.querySelector('.stats'); if (!old) area.insertAdjacentHTML('afterbegin', st); else old.outerHTML = st; }
}

async function admTab(tab, el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    const area = document.getElementById('admArea');
    if (tab === 'upload') {
        area.innerHTML = `<div class="stats"></div><div class="card anim-fade"><h3>📤 Upload Test</h3><div class="fg"><label>Test Name</label><input id="tname" placeholder="e.g. Physics Mid-Term"></div><div class="fg"><label>Subject</label><input id="tsub" placeholder="e.g. Physics"></div><div class="fg"><label>Duration (min)</label><input id="tdur" type="number" value="60" min="1"></div><div class="fg"><label>Upload PDF (All pages extracted)</label><input id="tpdf" type="file" accept=".pdf"></div><div class="fg"><label>Answer Key (optional)</label><textarea id="tkey" rows="2" placeholder="1:A, 2:B, 3:C"></textarea></div><button class="btn btn-p" onclick="upTest()">🔄 Process & Upload</button><div id="upStat" style="margin-top:10px"></div></div>`;
    } else if (tab === 'results') {
        const r = await dbg('results');
        area.innerHTML = `<div class="stats"></div><div class="card anim-fade"><h3>📈 Results (${r.length})</h3>${r.length===0?'<p style="color:var(--text2)">None</p>':`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Roll</th><th>Test</th><th>Score</th><th>Time</th><th>Date</th></tr></thead><tbody>${r.map(x=>`<tr><td>${x.sname}</td><td>${x.sroll}</td><td>${x.tname}</td><td><b style="color:${x.percentage>=60?'var(--green)':x.percentage>=40?'var(--yellow)':'var(--red)'}">${x.percentage}%</b></td><td>${Math.floor(x.timeTaken/60)}m</td><td>${new Date(x.date).toLocaleDateString()}</td></tr>`).join('')}</tbody></table></div>`}</div>`;
    } else if (tab === 'rankings') {
        const tests = await dbg('tests'), allR = await dbg('results');
        let h = '<div class="stats"></div>';
        for (const t of tests) {
            const tr = allR.filter(x => x.testId === t.id).sort((a, b) => b.percentage - a.percentage);
            h += `<div class="card"><h4>🏆 ${t.name}</h4><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Time</th></tr></thead><tbody>${tr.slice(0,10).map((x,i)=>`<tr><td><span class="badge ${i===0?'badge-g':i===1?'badge-s':i===2?'badge-b':''}">#${i+1}</span></td><td>${x.sname}</td><td><b>${x.percentage}%</b></td><td>${Math.floor(x.timeTaken/60)}m</td></tr>`).join('')}</tbody></table></div></div>`;
        }
        area.innerHTML = h;
    }
    updStats();
}

// ===== PDF UPLOAD =====
async function upTest() {
    const name = document.getElementById('tname').value, sub = document.getElementById('tsub').value, dur = parseInt(document.getElementById('tdur').value), file = document.getElementById('tpdf').files[0], keyText = document.getElementById('tkey').value, st = document.getElementById('upStat');
    if (!name || !file) { st.innerHTML = '<span style="color:var(--red)">❌ Fill fields & select PDF</span>'; return; }
    st.innerHTML = '<span style="color:var(--accent2)">⏳ Extracting all questions...</span>';
    try {
        const buf = await file.arrayBuffer(), pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) { const p = await pdf.getPage(i); text += (await p.getTextContent()).items.map(it => it.str).join(' ') + '\n'; st.innerHTML = `<span style="color:var(--accent2)">⏳ Page ${i}/${pdf.numPages}...</span>`; }
        let qs = parseQs(text);
        if (qs.length < 2) { qs = sampleQs(15); st.innerHTML += '<br><span style="color:var(--yellow)">⚠️ Using 15 sample questions</span>'; }
        if (keyText.trim()) { const key = parseKey(keyText); qs = applyKey(qs, key); }
        await dba('tests', { name, subject: sub, duration: dur, questions: qs, total: qs.length, createdAt: new Date().toISOString() });
        st.innerHTML = `<span style="color:var(--green)">✅ ${qs.length} questions uploaded!</span>`;
        document.getElementById('tname').value = ''; document.getElementById('tsub').value = ''; document.getElementById('tkey').value = ''; document.getElementById('tpdf').value = '';
        updStats();
    } catch (e) { st.innerHTML = `<span style="color:var(--red)">❌ ${e.message}</span>`; }
}

function parseQs(text) {
    const qs = [], lines = text.split('\n').filter(l => l.trim().length > 3);
    let cur = null;
    for (const line of lines) {
        const t = line.trim();
        if (/^\d+[.)]\s/.test(t)) { if (cur && cur.opts.length >= 2 && cur.q.length > 3) qs.push(cur); cur = { id: qs.length + 1, q: t.replace(/^\d+[.)]\s*/, ''), opts: [], ans: null }; }
        else if (/^[A-D][.)]\s/.test(t) && cur) cur.opts.push(t.replace(/^[A-D][.)]\s*/, ''));
    }
    if (cur && cur.opts.length >= 2 && cur.q.length > 3) qs.push(cur);
    if (qs.length < 3) {
        const chunks = text.replace(/\s+/g, ' ').split(/(?=\d+\s*[.)])/);
        for (const chunk of chunks) {
            const ct = chunk.trim(); if (!ct || ct.length < 10) continue;
            const om = []; const orx = /\(?([A-D])\)?\s*[.)]\s*([^A-D]+?)(?=\s*\(?[A-D]\)?\s*[.)]|$)/gi; let m;
            while ((m = orx.exec(ct)) !== null) om.push(m[2].trim());
            if (om.length >= 2) { let qt = ct; om.forEach(o => qt = qt.replace(new RegExp(o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')); qt = qt.replace(/\(?[A-D]\)?\s*[.)]/gi, '').replace(/\s+/g, ' ').replace(/^\d+\s*[.)]\s*/, '').trim(); if (qt.length > 3) qs.push({ id: qs.length + 1, q: qt, opts: om, ans: null }); }
        }
    }
    return qs;
}

function parseKey(t) { try { const p = JSON.parse(t); if (Array.isArray(p)) return p; } catch (e) {} const a = []; t.split(/[,;\n]+/).forEach(p => { const m = p.trim().match(/(\d+)\s*[:=]\s*([A-D])/i); if (m) a.push({ qNo: parseInt(m[1]), answer: m[2].toUpperCase() }); }); return a; }
function applyKey(qs, key) { key.forEach(k => { const q = qs.find(q => q.id === k.qNo); if (q) { const i = k.answer.charCodeAt(0) - 65; if (i >= 0 && i < q.opts.length) q.ans = q.opts[i]; } }); return qs; }

// Keyboard
document.addEventListener('keydown', e => { if (!state.engine || state.testSubmitted) return; switch (e.key) { case 'ArrowRight': e.preventDefault(); nxtQ(); break; case 'ArrowLeft': e.preventDefault(); prvQ(); break; case 'm': case 'M': togRev(); break; case '1': selOpt(0); break; case '2': selOpt(1); break; case '3': selOpt(2); break; case '4': selOpt(3); break; case 'c': case 'C': clrQ(); break; } });
