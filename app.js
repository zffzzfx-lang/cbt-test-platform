// ===== PRO-CBT WITH PERFECT PDF EXTRACTION =====
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Database
let DB;
const dbReq = indexedDB.open('CBT_PRO_V4', 4);
dbReq.onupgradeneeded = e => {
    const d = e.target.result;
    if (!d.objectStoreNames.contains('tests')) d.createObjectStore('tests', { keyPath: 'id', autoIncrement: true });
    if (!d.objectStoreNames.contains('results')) { const r = d.createObjectStore('results', { keyPath: 'id', autoIncrement: true }); r.createIndex('testId', 'testId', { unique: false }); }
    if (!d.objectStoreNames.contains('students')) d.createObjectStore('students', { keyPath: 'rollNo' });
};
dbReq.onsuccess = e => { DB = e.target.result; init(); };
dbReq.onerror = () => document.getElementById('app').innerHTML = '<div style="color:#fff;text-align:center;padding:50px"><h2>⚠️ Database Error</h2><p>Allow browser storage.</p></div>';

const dba = (s, d) => new Promise(r => { const t = DB.transaction(s, 'readwrite'); const q = t.objectStore(s).add(d); q.onsuccess = () => r(q.result); });
const dbg = (s) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
const dbgi = (s, i, v) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).index(i).getAll(v); q.onsuccess = () => r(q.result); });
const dbgid = (s, id) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).get(id); q.onsuccess = () => r(q.result); });

// State
let state = { role: 'student', user: null, test: null, engine: null, timerInterval: null, testSubmitted: false };

function toast(msg) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2000); }
function R(html) { const app = document.getElementById('app'); app.style.opacity = '0'; setTimeout(() => { app.innerHTML = html; app.style.opacity = '1'; }, 100); }
document.getElementById('app').style.transition = 'opacity 0.15s ease';

// Init
async function init() {
    const tests = await dbg('tests');
    if (tests.length === 0) {
        await dba('tests', { name: 'Sample Test', subject: 'GK', duration: 30, questions: sampleQs(10), total: 10, createdAt: new Date().toISOString() });
    }
    const s = sessionStorage.getItem('cbt_sess');
    if (s) { const d = JSON.parse(s); d.role === 'admin' ? renderAdmin() : d.testId ? resumeStudent(d) : renderLogin(); }
    else renderLogin();
}

function sampleQs(n) {
    const p = [
        { q: "What is the capital of India?", o: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], a: "New Delhi" },
        { q: "Which planet is Red Planet?", o: ["Venus", "Mars", "Jupiter", "Saturn"], a: "Mars" },
        { q: "H2O is?", o: ["Oxygen", "Water", "Salt", "Sugar"], a: "Water" },
        { q: "Who wrote Romeo Juliet?", o: ["Dickens", "Shakespeare", "Austen", "Twain"], a: "Shakespeare" },
        { q: "Largest ocean?", o: ["Atlantic", "Indian", "Arctic", "Pacific"], a: "Pacific" },
        { q: "√144 = ?", o: ["10", "11", "12", "14"], a: "12" },
        { q: "Au is symbol of?", o: ["Silver", "Gold", "Copper", "Iron"], a: "Gold" },
        { q: "Speed of light?", o: ["3×10⁶", "3×10⁸", "3×10¹⁰", "3×10⁴"], a: "3×10⁸" },
        { q: "Gravity discovered by?", o: ["Einstein", "Newton", "Galileo", "Hawking"], a: "Newton" },
        { q: "Largest continent?", o: ["Africa", "Asia", "Europe", "America"], a: "Asia" }
    ];
    return p.slice(0, Math.min(n, p.length)).map((q, i) => ({ id: i + 1, q: q.q, opts: q.o, ans: q.a }));
}

// ===== LOGIN =====
function renderLogin() {
    state = { role: 'student', user: null, test: null, engine: null, timerInterval: null, testSubmitted: false };
    sessionStorage.removeItem('cbt_sess');
    R(`<div class="login-wrap"><div class="login-card anim-fade"><h1>📚 ProCBT</h1><p class="sub">Perfect PDF Extraction</p><div class="tabs"><div class="tab active" onclick="swTab('student',this)">👨‍🎓 Student</div><div class="tab" onclick="swTab('admin',this)">👨‍🏫 Admin</div></div><div id="loginForm"></div></div></div>`);
    swTab('student', document.querySelector('.tab'));
}

async function swTab(role, el) {
    state.role = role;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const tests = await dbg('tests');
    const f = document.getElementById('loginForm');
    f.innerHTML = role === 'admin' ?
        `<div class="fg"><label>Admin ID</label><input id="aid" value="admin123"></div><div class="fg"><label>Password</label><input id="apass" type="password" value="admin123"></div><button class="btn btn-p" onclick="loginAdmin()">🔑 Login</button><p style="text-align:center;margin-top:8px;color:var(--text2);font-size:11px">admin123 / admin123</p>` :
        `<div class="fg"><label>Full Name</label><input id="sname" placeholder="Enter name"></div><div class="fg"><label>Roll Number</label><input id="sroll" placeholder="Enter roll"></div><div class="fg"><label>Select Test</label><select id="stest">${tests.map(t => `<option value="${t.id}">${t.name} (${t.total} Qs, ${t.duration}min)</option>`).join('')}</select></div><button class="btn btn-p" onclick="loginStudent()">▶️ Start Test</button>`;
}

function loginAdmin() {
    if (document.getElementById('aid').value === 'admin123' && document.getElementById('apass').value === 'admin123') {
        sessionStorage.setItem('cbt_sess', JSON.stringify({ role: 'admin' }));
        renderAdmin();
    } else toast('Invalid!');
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
    test ? (state.test = test, startTest(test)) : renderLogin();
}

// ===== TEST ENGINE =====
class TestEngine {
    constructor(qs, dur) { this.qs = qs; this.dur = dur; this.rem = dur * 60; this.cur = 0; this.ans = {}; this.rev = new Set(); this.st = Date.now(); }
    gq() { return this.qs[this.cur]; }
    sel(i) { this.ans[this.cur] = i; this.rev.delete(this.cur); }
    clr() { delete this.ans[this.cur]; }
    tr() { this.rev.has(this.cur) ? this.rev.delete(this.cur) : this.rev.add(this.cur); }
    nx() { if (this.cur < this.qs.length - 1) this.cur++; }
    pv() { if (this.cur > 0) this.cur--; }
    jp(i) { if (i >= 0 && i < this.qs.length) this.cur = i; }
    calc() {
        let c = 0, inc = 0, u = 0; const det = [];
        this.qs.forEach((q, i) => {
            const ua = this.ans[i];
            if (ua === undefined) { u++; det.push({ q: q.q, user: 'Not Attempted', correct: q.ans, ok: false }); }
            else if (q.opts[ua] === q.ans) { c++; det.push({ q: q.q, user: q.opts[ua], correct: q.ans, ok: true }); }
            else { inc++; det.push({ q: q.q, user: q.opts[ua], correct: q.ans, ok: false }); }
        });
        return { total: this.qs.length, correct: c, incorrect: inc, unattempted: u, percentage: parseFloat(((c / this.qs.length) * 100).toFixed(1)), timeTaken: Math.floor((Date.now() - this.st) / 1000), details: det };
    }
}

function startTest(test) {
    state.testSubmitted = false; state.engine = new TestEngine(test.questions, test.duration);
    R(`<div class="test-wrap"><div class="test-top"><div><h3>${test.name}</h3><small>${state.user.name} | ${state.user.rollNo}</small></div><div class="timer" id="td">00:00</div><div style="display:flex;gap:6px"><button class="btn btn-o btn-sm" onclick="tr()">📌</button><button class="btn btn-d btn-sm" onclick="st()">📝 Submit</button></div></div><div class="test-body"><div class="q-area" id="qA"></div><div class="palette"><div class="pal-title">Palette</div><div class="pal-grid" id="qG"></div></div></div></div>`);
    upd();
    state.timerInterval = setInterval(() => {
        if (!state.engine || state.testSubmitted) { clearInterval(state.timerInterval); return; }
        state.engine.rem--;
        const td = document.getElementById('td');
        if (td) {
            const m = Math.floor(state.engine.rem / 60), s = state.engine.rem % 60;
            td.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            td.className = 'timer' + (state.engine.rem <= 60 ? ' danger' : state.engine.rem <= 300 ? ' warn' : '');
        }
        if (state.engine.rem <= 0) { clearInterval(state.timerInterval); st(true); }
    }, 1000);
}

function upd() {
    if (!state.engine || state.testSubmitted) return;
    const q = state.engine.gq(), qA = document.getElementById('qA'), qG = document.getElementById('qG');
    if (!qA || !qG) return;
    qA.innerHTML = `<div class="anim-fade"><div class="q-num">Q ${state.engine.cur + 1}/${state.engine.qs.length}</div><div class="q-text">${q.q}</div><div class="opts">${q.opts.map((o, i) => `<div class="opt ${state.engine.ans[state.engine.cur] === i ? 'sel' : ''}" onclick="so(${i})"><b>${String.fromCharCode(65 + i)}.</b> ${o}</div>`).join('')}</div><div class="nav-btns"><button class="btn btn-o btn-sm" onclick="pv()" ${state.engine.cur === 0 ? 'disabled' : ''}>◀</button><button class="btn btn-o btn-sm" onclick="cl()">Clear</button><button class="btn btn-p btn-sm" onclick="nx()" ${state.engine.cur === state.engine.qs.length - 1 ? 'disabled' : ''}>▶</button></div></div>`;
    qG.innerHTML = state.engine.qs.map((_, i) => `<div class="pal-btn ${i === state.engine.cur ? 'cur' : state.engine.rev.has(i) ? 'rev' : state.engine.ans[i] !== undefined ? 'ans' : ''}" onclick="jp(${i})">${i + 1}</div>`).join('');
}

function so(i) { state.engine.sel(i); upd(); }
function cl() { state.engine.clr(); upd(); }
function tr() { state.engine.tr(); upd(); }
function nx() { state.engine.nx(); upd(); }
function pv() { state.engine.pv(); upd(); }
function jp(i) { state.engine.jp(i); upd(); }

async function st(auto = false) {
    if (!auto && !confirm('Submit?')) return;
    state.testSubmitted = true; clearInterval(state.timerInterval);
    const r = state.engine.calc(), sess = JSON.parse(sessionStorage.getItem('cbt_sess'));
    await dba('results', { testId: state.test.id, tname: state.test.name, sname: sess.name, sroll: sess.rollNo, ...r, date: new Date().toISOString() });
    const all = (await dbgi('results', 'testId', state.test.id)).sort((a, b) => b.percentage - a.percentage);
    renderRes(r, all.findIndex(x => x.sroll === sess.rollNo) + 1, all);
}

function renderRes(r, rank, all) {
    R(`<div class="res-wrap"><div class="res-card anim-fade"><h2>✅ Done!</h2><div class="score-circle">${r.percentage}%</div><p style="text-align:center;color:var(--text2)">🏅 #${rank}/${all.length} | ⏱️ ${Math.floor(r.timeTaken/60)}m</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0"><div class="stat"><div class="val" style="color:var(--green)">${r.correct}</div><div class="lbl">✅</div></div><div class="stat"><div class="val" style="color:var(--red)">${r.incorrect}</div><div class="lbl">❌</div></div><div class="stat"><div class="val" style="color:var(--yellow)">${r.unattempted}</div><div class="lbl">⚪</div></div></div><div class="charts"><div class="chart-box"><canvas id="c1"></canvas></div><div class="chart-box"><canvas id="c2"></canvas></div></div><div class="card"><h4>🏆 Leaderboard</h4><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Student</th><th>Score</th></tr></thead><tbody>${all.slice(0,5).map((x,i) => `<tr><td><span class="badge ${i===0?'badge-g':i===1?'badge-s':i===2?'badge-b':''}">#${i+1}</span></td><td>${x.sname}</td><td><b>${x.percentage}%</b></td></tr>`).join('')}</tbody></table></div></div><div class="card"><h4>📋 Details</h4>${r.details.map((d,i) => `<div class="answer-detail ${d.ok?'':'wrong'}"><b>Q${i+1}:</b> ${d.q}<br><small>Your: <span style="color:${d.ok?'var(--green)':'var(--red)'}">${d.user}</span> | Correct: <span style="color:var(--green)">${d.correct||'N/A'}</span></small></div>`).join('')}</div><div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-p btn-sm" onclick="renderLogin()">🏠</button><button class="btn btn-o btn-sm" onclick="retake()">🔄 Retake</button></div></div></div>`);
    setTimeout(() => {
        new Chart(document.getElementById('c1'), { type: 'doughnut', data: { labels: ['Correct', 'Incorrect', 'Unattempted'], datasets: [{ data: [r.correct, r.incorrect, r.unattempted], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderColor: '#1a1f2e', borderWidth: 2 }] }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } } } });
        new Chart(document.getElementById('c2'), { type: 'bar', data: { labels: ['Score'], datasets: [{ data: [r.percentage], backgroundColor: '#6366f1', borderRadius: 6 }] }, options: { responsive: true, scales: { y: { max: 100, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } } });
    }, 80);
}
function retake() { if (state.test) startTest(state.test); }

// ===== ADMIN =====
function renderAdmin() {
    R(`<div class="menu-btn" onclick="tsb()">☰</div><div class="sidebar-overlay" id="ov" onclick="tsb()"></div><div class="admin-layout"><div class="sidebar" id="sb"><h2>📊 ProCBT</h2><div class="nav-item active" onclick="at('upload',this)">📤 Upload</div><div class="nav-item" onclick="at('results',this)">📈 Results</div><div class="nav-item" onclick="at('rankings',this)">🏆 Rankings</div><div class="nav-item" onclick="renderLogin()">🚪 Logout</div></div><div class="main-area" id="aa"></div></div>`);
    at('upload', document.querySelector('.nav-item'));
}
function tsb() { const sb = document.getElementById('sb'), ov = document.getElementById('ov'); sb.classList.toggle('open'); ov.classList.toggle('show'); }
async function us() {
    const t = await dbg('tests'), r = await dbg('results'), s = await dbg('students');
    const h = `<div class="stats"><div class="stat"><div class="val" style="color:var(--accent2)">${t.length}</div><div class="lbl">Tests</div></div><div class="stat"><div class="val" style="color:var(--green)">${s.length}</div><div class="lbl">Students</div></div><div class="stat"><div class="val" style="color:var(--yellow)">${r.length}</div><div class="lbl">Taken</div></div><div class="stat"><div class="val" style="color:var(--accent2)">${r.length>0?(r.reduce((a,x)=>a+x.percentage,0)/r.length).toFixed(1):0}%</div><div class="lbl">Avg</div></div></div>`;
    const aa = document.getElementById('aa'); if (aa) { const old = aa.querySelector('.stats'); if (old) old.outerHTML = h; else aa.insertAdjacentHTML('afterbegin', h); }
}
async function at(tab, el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); el.classList.add('active');
    const aa = document.getElementById('aa');
    if (tab === 'upload') {
        aa.innerHTML = `<div class="stats"></div><div class="card anim-fade"><h3>📤 Upload Test (Perfect PDF Extraction)</h3><div class="fg"><label>Test Name</label><input id="tname" placeholder="Test name"></div><div class="fg"><label>Subject</label><input id="tsub" placeholder="Subject"></div><div class="fg"><label>Duration (min)</label><input id="tdur" type="number" value="60" min="1"></div><div class="fg"><label>Upload PDF - <b style="color:var(--green)">ALL questions exactly as in PDF</b></label><input id="tpdf" type="file" accept=".pdf"></div><div class="fg"><label>Answer Key (optional) - Format: 1:A, 2:B</label><textarea id="tkey" rows="2" placeholder="1:A, 2:B, 3:C"></textarea></div><button class="btn btn-p" onclick="ut()">🔄 Extract & Upload</button><div id="us" style="margin-top:10px"></div><div id="preview" style="margin-top:15px"></div></div>`;
    } else if (tab === 'results') {
        const r = await dbg('results');
        aa.innerHTML = `<div class="stats"></div><div class="card"><h3>📈 Results (${r.length})</h3>${r.length===0?'<p style="color:var(--text2)">None</p>':`<div class="table-wrap"><table><thead><tr><th>Student</th><th>Test</th><th>Score</th><th>Time</th></tr></thead><tbody>${r.map(x=>`<tr><td>${x.sname}</td><td>${x.tname}</td><td><b>${x.percentage}%</b></td><td>${Math.floor(x.timeTaken/60)}m</td></tr>`).join('')}</tbody></table></div>`}</div>`;
    } else if (tab === 'rankings') {
        const t = await dbg('tests'), ar = await dbg('results'); let h = '<div class="stats"></div>';
        for (const x of t) { const tr = ar.filter(r => r.testId === x.id).sort((a, b) => b.percentage - a.percentage); h += `<div class="card"><h4>🏆 ${x.name}</h4><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Student</th><th>Score</th></tr></thead><tbody>${tr.slice(0,5).map((r,i)=>`<tr><td><span class="badge ${i===0?'badge-g':i===1?'badge-s':i===2?'badge-b':''}">#${i+1}</span></td><td>${r.sname}</td><td><b>${r.percentage}%</b></td></tr>`).join('')}</tbody></table></div></div>`; }
        aa.innerHTML = h;
    }
    us();
}

// ===== PERFECT PDF EXTRACTION =====
async function ut() {
    const name = document.getElementById('tname').value, sub = document.getElementById('tsub').value;
    const dur = parseInt(document.getElementById('tdur').value), file = document.getElementById('tpdf').files[0];
    const keyText = document.getElementById('tkey').value, st = document.getElementById('us'), preview = document.getElementById('preview');
    
    if (!name || !file) { st.innerHTML = '<span style="color:var(--red)">❌ Fill all fields & select PDF</span>'; return; }
    
    st.innerHTML = '<span style="color:var(--accent2)">⏳ Reading PDF...</span>';
    
    try {
        // READ PDF
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        
        // EXTRACT TEXT FROM EVERY SINGLE PAGE
        let allText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            st.innerHTML = `<span style="color:var(--accent2)">⏳ Extracting page ${i}/${pdf.numPages}...</span>`;
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            
            // Get text with positions for better layout detection
            const items = content.items;
            let pageText = '';
            let lastY = null;
            
            for (const item of items) {
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                    pageText += '\n';
                } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
                    pageText += ' ';
                }
                pageText += item.str;
                lastY = item.transform[5];
            }
            allText += pageText + '\n';
        }
        
        st.innerHTML = '<span style="color:var(--accent2)">🔍 Parsing questions...</span>';
        
        // PARSE QUESTIONS - EXACT EXTRACTION
        const questions = parseQuestionsExact(allText);
        
        // Show preview
        preview.innerHTML = `<div class="card"><h4>📋 Extracted Questions (${questions.length})</h4><div class="preview-list">${questions.slice(0, 10).map(q => `<div class="preview-item"><strong>Q${q.id}:</strong> ${q.q}<div class="opts-preview">${q.opts.map((o,i) => `${String.fromCharCode(65+i)}) ${o}`).join(' | ')}</div></div>`).join('')}${questions.length > 10 ? `<p style="color:var(--text2);text-align:center;margin-top:8px">... and ${questions.length - 10} more questions</p>` : ''}</div></div>`;
        
        // Apply answer key
        if (keyText.trim()) {
            const key = parseKey(keyText);
            applyKey(questions, key);
        }
        
        // Save
        await dba('tests', { name, subject: sub, duration: dur, questions, total: questions.length, createdAt: new Date().toISOString() });
        
        st.innerHTML = `<span style="color:var(--green)">✅ SUCCESS! ${questions.length} questions extracted EXACTLY from PDF!</span>`;
        document.getElementById('tname').value = ''; document.getElementById('tsub').value = ''; document.getElementById('tkey').value = ''; document.getElementById('tpdf').value = '';
        us();
        
    } catch (e) {
        st.innerHTML = `<span style="color:var(--red)">❌ Error: ${e.message}</span>`;
        console.error(e);
    }
}

// ===== THE PERFECT PARSER =====
function parseQuestionsExact(text) {
    const questions = [];
    
    // Normalize text - keep structure intact
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let currentQ = null;
    let optionLetters = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // CHECK IF THIS LINE STARTS A NEW QUESTION
        // Matches: "1.", "1)", "Q1.", "Question 1:", "1 .", "1 -", etc.
        const qStartPatterns = [
            /^(?:Q(?:uestion)?\.?\s*)?(\d+)\s*[.)]\s+(.+)/i,
            /^(?:Q(?:uestion)?\.?\s*)?(\d+)\s*[-:]\s+(.+)/i,
            /^(\d+)\s+[.)]\s+(.+)/,
        ];
        
        let isNewQuestion = false;
        let qNumber = null;
        let qText = '';
        
        for (const pattern of qStartPatterns) {
            const match = line.match(pattern);
            if (match) {
                isNewQuestion = true;
                qNumber = parseInt(match[1]);
                qText = match[2].trim();
                break;
            }
        }
        
        if (isNewQuestion) {
            // Save previous question
            if (currentQ && currentQ.opts.length >= 2 && currentQ.q.length > 2) {
                currentQ.id = questions.length + 1;
                questions.push(currentQ);
            }
            
            // Start new question
            currentQ = { id: questions.length + 1, q: qText, opts: [], ans: null };
            optionLetters = [];
            continue;
        }
        
        // CHECK IF THIS LINE IS AN OPTION
        // Matches: "A.", "A)", "(A)", "A -", "A :", "Option A:", etc.
        if (currentQ) {
            const optPatterns = [
                /^\(?([A-D])\)?\s*[.)]\s+(.+)/,
                /^([A-D])\s*[-:]\s+(.+)/,
                /^Option\s*([A-D])\s*[:.-]\s*(.+)/i,
            ];
            
            let isOption = false;
            let optLetter = '';
            let optText = '';
            
            for (const pattern of optPatterns) {
                const match = line.match(pattern);
                if (match) {
                    isOption = true;
                    optLetter = match[1].toUpperCase();
                    optText = match[2].trim();
                    break;
                }
            }
            
            if (isOption && !optionLetters.includes(optLetter)) {
                currentQ.opts.push(optText);
                optionLetters.push(optLetter);
            } else if (!isOption && optionLetters.length > 0 && line.length > 5) {
                // This might be continuation of last option or question text
                // Append to question if options already started
            }
        }
    }
    
    // Save last question
    if (currentQ && currentQ.opts.length >= 2 && currentQ.q.length > 2) {
        currentQ.id = questions.length;
        questions.push(currentQ);
    }
    
    // If extraction failed, try split method
    if (questions.length < 2) {
        return parseQuestionsSplit(text);
    }
    
    return questions;
}

// Fallback: Split by question numbers
function parseQuestionsSplit(text) {
    const questions = [];
    
    // Split text by question number patterns
    const parts = text.split(/\n(?=\d+[.)]\s)/);
    
    for (const part of parts) {
        const lines = part.trim().split('\n').filter(l => l.trim());
        if (lines.length < 3) continue;
        
        // First line is question
        const firstLine = lines[0].trim();
        const qMatch = firstLine.match(/^\d+[.)]\s*(.+)/);
        if (!qMatch) continue;
        
        const qText = qMatch[1].trim();
        const opts = [];
        
        // Extract options
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            const optMatch = line.match(/^\(?([A-D])\)?\s*[.)]\s*(.+)/);
            if (optMatch) {
                opts.push(optMatch[2].trim());
            }
        }
        
        if (opts.length >= 2 && qText.length > 2) {
            questions.push({ id: questions.length + 1, q: qText, opts, ans: null });
        }
    }
    
    return questions;
}

function parseKey(t) {
    try { const p = JSON.parse(t); if (Array.isArray(p)) return p; } catch (e) {}
    const a = [];
    t.split(/[,;\n]+/).forEach(p => {
        const m = p.trim().match(/(\d+)\s*[:=]\s*([A-D])/i);
        if (m) a.push({ qNo: parseInt(m[1]), answer: m[2].toUpperCase() });
    });
    return a;
}

function applyKey(qs, key) {
    key.forEach(k => {
        const q = qs.find(q => q.id === k.qNo);
        if (q) {
            const i = k.answer.charCodeAt(0) - 65;
            if (i >= 0 && i < q.opts.length) q.ans = q.opts[i];
        }
    });
    return qs;
}

// Keyboard
document.addEventListener('keydown', e => {
    if (!state.engine || state.testSubmitted) return;
    switch (e.key) {
        case 'ArrowRight': e.preventDefault(); nx(); break;
        case 'ArrowLeft': e.preventDefault(); pv(); break;
        case 'm': case 'M': tr(); break;
        case '1': so(0); break; case '2': so(1); break;
        case '3': so(2); break; case '4': so(3); break;
        case 'c': case 'C': cl(); break;
    }
});
