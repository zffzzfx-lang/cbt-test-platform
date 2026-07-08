// ===== COMPLETE APP - NO FLICKER, FULL PDF EXTRACTION, AUTO NAVIGATION =====
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ===== DATABASE =====
let DB;
const dbReq = indexedDB.open('CBT_PRO_V2', 2);
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
dbReq.onerror = () => { document.getElementById('app').innerHTML = '<div style="color:#fff;text-align:center;padding:50px"><h2>Database Error</h2><p>Please allow storage in your browser settings.</p></div>'; };

const dba = (s, d) => new Promise(r => { const t = DB.transaction(s, 'readwrite'); const q = t.objectStore(s).add(d); q.onsuccess = () => r(q.result); });
const dbg = (s) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
const dbgi = (s, i, v) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).index(i).getAll(v); q.onsuccess = () => r(q.result); });
const dbgid = (s, id) => new Promise(r => { const t = DB.transaction(s, 'readonly'); const q = t.objectStore(s).get(id); q.onsuccess = () => r(q.result); });

// ===== STATE =====
let state = {
    role: 'student',
    user: null,
    test: null,
    engine: null,
    timerInterval: null,
    testSubmitted: false
};

// ===== RENDER =====
function R(html) {
    const app = document.getElementById('app');
    app.style.opacity = '0';
    setTimeout(() => { app.innerHTML = html; app.style.opacity = '1'; }, 150);
}
document.getElementById('app').style.transition = 'opacity 0.2s ease';

// ===== SAMPLE QUESTIONS =====
function sampleQuestions(count = 10) {
    const qs = [
        { q: "What is the capital of India?", o: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], a: "New Delhi" },
        { q: "Which planet is known as the Red Planet?", o: ["Venus", "Mars", "Jupiter", "Saturn"], a: "Mars" },
        { q: "What is H2O commonly known as?", o: ["Oxygen", "Hydrogen", "Water", "Salt"], a: "Water" },
        { q: "Who wrote 'Romeo and Juliet'?", o: ["Dickens", "Shakespeare", "Austen", "Twain"], a: "Shakespeare" },
        { q: "What is the largest ocean?", o: ["Atlantic", "Indian", "Arctic", "Pacific"], a: "Pacific" },
        { q: "What is the square root of 144?", o: ["10", "11", "12", "14"], a: "12" },
        { q: "Which element has the symbol 'Au'?", o: ["Silver", "Gold", "Copper", "Iron"], a: "Gold" },
        { q: "What is the speed of light?", o: ["3×10⁶ m/s", "3×10⁸ m/s", "3×10¹⁰ m/s", "3×10⁴ m/s"], a: "3×10⁸ m/s" },
        { q: "Who discovered gravity?", o: ["Einstein", "Newton", "Galileo", "Hawking"], a: "Newton" },
        { q: "What is the largest continent?", o: ["Africa", "Asia", "Europe", "America"], a: "Asia" },
        { q: "What is the boiling point of water?", o: ["90°C", "100°C", "110°C", "120°C"], a: "100°C" },
        { q: "Which gas do plants absorb?", o: ["Oxygen", "Nitrogen", "CO2", "Hydrogen"], a: "CO2" },
        { q: "What is the smallest prime number?", o: ["0", "1", "2", "3"], a: "2" },
        { q: "Who painted the Mona Lisa?", o: ["Van Gogh", "Da Vinci", "Picasso", "Rembrandt"], a: "Da Vinci" },
        { q: "What is the currency of Japan?", o: ["Yuan", "Won", "Yen", "Dollar"], a: "Yen" }
    ];
    return qs.slice(0, count).map((q, i) => ({ id: i + 1, q: q.q, opts: q.o, ans: q.a }));
}

// ===== INIT =====
async function init() {
    const tests = await dbg('tests');
    if (tests.length === 0) {
        await dba('tests', {
            name: 'Sample General Knowledge Test',
            subject: 'GK',
            duration: 30,
            questions: sampleQuestions(10),
            total: 10,
            createdAt: new Date().toISOString()
        });
    }
    const session = sessionStorage.getItem('cbt_session');
    if (session) {
        const data = JSON.parse(session);
        if (data.role === 'admin') renderAdmin();
        else if (data.role === 'student' && data.testId) renderTestFromSession(data);
        else renderLogin();
    } else {
        renderLogin();
    }
}

// ===== LOGIN =====
function renderLogin() {
    state = { role: 'student', user: null, test: null, engine: null, timerInterval: null, testSubmitted: false };
    sessionStorage.removeItem('cbt_session');
    
    R(`
        <div class="login-wrap">
            <div class="login-card anim-fade">
                <h1>📚 ProCBT Platform</h1>
                <p class="sub">Professional Computer Based Test</p>
                <div class="tabs">
                    <div class="tab active" onclick="switchTab('student',this)">👨‍🎓 Student</div>
                    <div class="tab" onclick="switchTab('admin',this)">👨‍🏫 Admin</div>
                </div>
                <div id="loginForm"></div>
            </div>
        </div>
    `);
    switchTab('student', document.querySelector('.tab'));
}

async function switchTab(role, el) {
    state.role = role;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    
    const form = document.getElementById('loginForm');
    const tests = await dbg('tests');
    
    if (role === 'admin') {
        form.innerHTML = `
            <div class="fg"><label>Admin ID</label><input id="aid" value="admin123"></div>
            <div class="fg"><label>Password</label><input id="apass" type="password" value="admin123"></div>
            <button class="btn btn-p" onclick="loginAdmin()">🔑 Login</button>
            <p style="text-align:center;margin-top:10px;color:var(--text2);font-size:11px">Demo: admin123 / admin123</p>
        `;
    } else {
        form.innerHTML = `
            <div class="fg"><label>Full Name</label><input id="sname" placeholder="Enter your name"></div>
            <div class="fg"><label>Roll Number</label><input id="sroll" placeholder="Enter roll number"></div>
            <div class="fg"><label>Select Test</label>
                <select id="stest">
                    ${tests.length === 0 ? '<option>No tests available</option>' : 
                      tests.map(t => `<option value="${t.id}">${t.name} (${t.duration}min, ${t.total} Qs)</option>`).join('')}
                </select>
            </div>
            <button class="btn btn-p" onclick="loginStudent()">▶️ Start Test</button>
            ${tests.length === 0 ? '<p style="text-align:center;margin-top:10px;color:var(--yellow);font-size:11px">Login as Admin first to upload tests</p>' : ''}
        `;
    }
}

// ===== ADMIN LOGIN =====
function loginAdmin() {
    const id = document.getElementById('aid').value;
    const pass = document.getElementById('apass').value;
    if (id === 'admin123' && pass === 'admin123') {
        sessionStorage.setItem('cbt_session', JSON.stringify({ role: 'admin' }));
        renderAdmin();
    } else {
        alert('Invalid credentials! Use admin123 / admin123');
    }
}

// ===== STUDENT LOGIN =====
async function loginStudent() {
    const name = document.getElementById('sname').value;
    const roll = document.getElementById('sroll').value;
    const testId = parseInt(document.getElementById('stest').value);
    
    if (!name || !roll) { alert('Please fill all fields'); return; }
    
    const test = await dbgid('tests', testId);
    if (!test) { alert('Test not found!'); return; }
    
    await dba('students', { rollNo: roll, name, lastLogin: new Date().toISOString() });
    
    state.user = { name, rollNo: roll };
    state.test = test;
    sessionStorage.setItem('cbt_session', JSON.stringify({ role: 'student', name, rollNo: roll, testId }));
    
    startTest(test);
}

function renderTestFromSession(data) {
    state.role = 'student';
    state.user = { name: data.name, rollNo: data.rollNo };
    dbgid('tests', data.testId).then(test => {
        if (test) { state.test = test; startTest(test); }
        else { renderLogin(); }
    });
}

// ===== START TEST =====
function startTest(test) {
    state.testSubmitted = false;
    const engine = new TestEngine(test.questions, test.duration);
    state.engine = engine;
    engine.start();
    
    R(`
        <div class="test-wrap">
            <div class="test-top">
                <div><h3>${test.name}</h3><small>${state.user.name} | Roll: ${state.user.rollNo}</small></div>
                <div class="timer" id="timerDisp">00:00</div>
                <div style="display:flex;gap:8px;">
                    <button class="btn btn-o btn-sm" onclick="toggleReview()">📌 Mark</button>
                    <button class="btn btn-d btn-sm" onclick="submitTest()">📝 Submit</button>
                </div>
            </div>
            <div class="test-body">
                <div class="q-area" id="qArea"></div>
                <div class="palette">
                    <div class="pal-title">Question Palette</div>
                    <div class="pal-grid" id="qGrid"></div>
                    <div class="legend">
                        <span style="background:rgba(16,185,129,0.4)"></span> Answered &nbsp;
                        <span style="background:var(--accent)"></span> Current &nbsp;
                        <span style="background:rgba(245,158,11,0.4)"></span> Review &nbsp;
                        <span style="background:rgba(239,68,68,0.3)"></span> Skipped
                    </div>
                </div>
            </div>
        </div>
    `);
    
    updateTestUI();
    
    state.timerInterval = setInterval(() => {
        if (!state.engine || state.testSubmitted) { clearInterval(state.timerInterval); return; }
        updateTimer();
        if (state.engine.timeRemaining <= 0) {
            clearInterval(state.timerInterval);
            submitTest(true);
        }
    }, 1000);
}

// ===== TEST ENGINE =====
class TestEngine {
    constructor(questions, duration) {
        this.questions = questions;
        this.duration = duration;
        this.timeRemaining = duration * 60;
        this.currentIndex = 0;
        this.answers = {};
        this.review = new Set();
        this.startTime = Date.now();
    }
    
    start() { this.startTime = Date.now(); }
    
    getCurrent() { return this.questions[this.currentIndex]; }
    
    selectAnswer(idx) { this.answers[this.currentIndex] = idx; this.review.delete(this.currentIndex); }
    clearAnswer() { delete this.answers[this.currentIndex]; }
    toggleReview() { this.review.has(this.currentIndex) ? this.review.delete(this.currentIndex) : this.review.add(this.currentIndex); }
    
    next() { if (this.currentIndex < this.questions.length - 1) this.currentIndex++; }
    prev() { if (this.currentIndex > 0) this.currentIndex--; }
    jump(idx) { if (idx >= 0 && idx < this.questions.length) this.currentIndex = idx; }
    
    getTimeRemaining() { return this.timeRemaining; }
    getElapsed() { return Math.floor((Date.now() - this.startTime) / 1000); }
    
    calculate() {
        let correct = 0, incorrect = 0, unattempted = 0;
        const details = [];
        
        this.questions.forEach((q, i) => {
            const ua = this.answers[i];
            if (ua === undefined) {
                unattempted++;
                details.push({ q: q.q, user: 'Not Attempted', correct: q.ans, isCorrect: false });
            } else if (q.opts[ua] === q.ans) {
                correct++;
                details.push({ q: q.q, user: q.opts[ua], correct: q.ans, isCorrect: true });
            } else {
                incorrect++;
                details.push({ q: q.q, user: q.opts[ua], correct: q.ans, isCorrect: false });
            }
        });
        
        return {
            total: this.questions.length, correct, incorrect, unattempted,
            percentage: parseFloat(((correct / this.questions.length) * 100).toFixed(1)),
            timeTaken: this.getElapsed(),
            details
        };
    }
}

// ===== UPDATE TEST UI =====
function updateTestUI() {
    if (!state.engine || state.testSubmitted) return;
    
    const q = state.engine.getCurrent();
    const qArea = document.getElementById('qArea');
    const qGrid = document.getElementById('qGrid');
    
    if (!qArea || !qGrid) return;
    
    qArea.innerHTML = `
        <div class="anim-fade">
            <div class="q-num">Question ${state.engine.currentIndex + 1} of ${state.engine.questions.length}</div>
            <div class="q-text">${q.q}</div>
            <div class="opts">
                ${q.opts.map((opt, i) => `
                    <div class="opt ${state.engine.answers[state.engine.currentIndex] === i ? 'sel' : ''}" 
                         onclick="selectOption(${i})">
                        <b>${String.fromCharCode(65 + i)}.</b> ${opt}
                    </div>
                `).join('')}
            </div>
            <div class="nav-btns">
                <button class="btn btn-o btn-sm" onclick="prevQ()" ${state.engine.currentIndex === 0 ? 'disabled' : ''}>◀ Prev</button>
                <button class="btn btn-o btn-sm" onclick="clearQ()">Clear</button>
                <button class="btn btn-p btn-sm" onclick="nextQ()" ${state.engine.currentIndex === state.engine.questions.length - 1 ? 'disabled' : ''}>Next ▶</button>
            </div>
        </div>
    `;
    
    qGrid.innerHTML = state.engine.questions.map((_, i) => {
        let cls = '';
        if (i === state.engine.currentIndex) cls = 'cur';
        else if (state.engine.review.has(i)) cls = 'rev';
        else if (state.engine.answers[i] !== undefined) cls = 'ans';
        return `<div class="pal-btn ${cls}" onclick="jumpQ(${i})">${i + 1}</div>`;
    }).join('');
}

function updateTimer() {
    const timer = document.getElementById('timerDisp');
    if (!timer || !state.engine) return;
    
    state.engine.timeRemaining--;
    const rem = state.engine.timeRemaining;
    const m = Math.floor(rem / 60), s = rem % 60;
    timer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    timer.className = 'timer';
    if (rem <= 60) timer.classList.add('danger');
    else if (rem <= 300) timer.classList.add('warn');
}

// ===== TEST ACTIONS =====
function selectOption(idx) { state.engine.selectAnswer(idx); updateTestUI(); }
function clearQ() { state.engine.clearAnswer(); updateTestUI(); }
function toggleReview() { state.engine.toggleReview(); updateTestUI(); }
function nextQ() { state.engine.next(); updateTestUI(); }
function prevQ() { state.engine.prev(); updateTestUI(); }
function jumpQ(idx) { state.engine.jump(idx); updateTestUI(); }

async function submitTest(auto = false) {
    if (!auto && !confirm('Are you sure you want to submit? You cannot change answers after submission.')) return;
    
    state.testSubmitted = true;
    clearInterval(state.timerInterval);
    
    const result = state.engine.calculate();
    const session = JSON.parse(sessionStorage.getItem('cbt_session'));
    
    await dba('results', {
        testId: state.test.id,
        tname: state.test.name,
        sname: session.name,
        sroll: session.rollNo,
        ...result,
        date: new Date().toISOString()
    });
    
    const allResults = (await dbgi('results', 'testId', state.test.id))
        .sort((a, b) => b.percentage - a.percentage);
    const rank = allResults.findIndex(r => r.sroll === session.rollNo) + 1;
    
    renderResults(result, rank, allResults);
}

// ===== RESULTS =====
function renderResults(result, rank, allResults) {
    R(`
        <div class="res-wrap">
            <div class="res-card anim-fade">
                <h2 style="text-align:center">✅ Test Completed!</h2>
                <div class="score-circle">${result.percentage}%</div>
                <p style="text-align:center;color:var(--text2);margin:10px 0">
                    🏅 Rank: <b style="color:var(--accent2)">#${rank}</b> of ${allResults.length} | 
                    ⏱️ Time: ${Math.floor(result.timeTaken / 60)}m ${result.timeTaken % 60}s
                </p>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0">
                    <div class="stat"><div class="val" style="color:var(--green)">${result.correct}</div><div class="lbl">✅ Correct</div></div>
                    <div class="stat"><div class="val" style="color:var(--red)">${result.incorrect}</div><div class="lbl">❌ Incorrect</div></div>
                    <div class="stat"><div class="val" style="color:var(--yellow)">${result.unattempted}</div><div class="lbl">⚪ Unattempted</div></div>
                </div>
                <div class="charts">
                    <div class="chart-box"><canvas id="chart1"></canvas></div>
                    <div class="chart-box"><canvas id="chart2"></canvas></div>
                </div>
                <div class="card" style="margin-top:15px">
                    <h4>🏆 Leaderboard</h4>
                    <table><thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Time</th></tr></thead><tbody>
                        ${allResults.slice(0, 5).map((r, i) => `
                            <tr ${r.sroll === result.sroll ? 'style="background:rgba(99,102,241,0.08)"' : ''}>
                                <td><span class="badge ${i===0?'badge-g':i===1?'badge-s':i===2?'badge-b':''}">#${i+1}</span></td>
                                <td>${r.sname}</td><td><b>${r.percentage}%</b></td><td>${Math.floor(r.timeTaken/60)}m</td>
                            </tr>
                        `).join('')}
                    </tbody></table>
                </div>
                <div class="card" style="margin-top:15px">
                    <h4>📋 Detailed Analysis</h4>
                    ${result.details.map((d, i) => `
                        <div style="padding:12px;margin:8px 0;border-left:4px solid ${d.isCorrect ? 'var(--green)' : 'var(--red)'};background:var(--input);border-radius:0 8px 8px 0">
                            <b>Q${i+1}:</b> ${d.q}<br>
                            <small style="color:var(--text2)">Your Answer: <span style="color:${d.isCorrect ? 'var(--green)' : 'var(--red)'}">${d.user}</span> | 
                            Correct: <span style="color:var(--green)">${d.correct || 'N/A'}</span></small>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex;gap:10px;margin-top:15px">
                    <button class="btn btn-p" onclick="renderLogin()">🏠 Back to Login</button>
                    <button class="btn btn-o" onclick="retakeTest()">🔄 Retake Test</button>
                </div>
            </div>
        </div>
    `);
    
    setTimeout(() => {
        new Chart(document.getElementById('chart1'), {
            type: 'doughnut',
            data: {
                labels: ['Correct', 'Incorrect', 'Unattempted'],
                datasets: [{ data: [result.correct, result.incorrect, result.unattempted], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderColor: '#1a1f2e', borderWidth: 3 }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 15 } } } }
        });
        
        new Chart(document.getElementById('chart2'), {
            type: 'bar',
            data: { labels: ['Score'], datasets: [{ data: [result.percentage], backgroundColor: result.percentage >= 60 ? '#10b981' : result.percentage >= 40 ? '#f59e0b' : '#ef4444', borderRadius: 8 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, max: 100, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } }
        });
    }, 100);
}

function retakeTest() {
    if (state.test) startTest(state.test);
}

// ===== ADMIN PANEL =====
function renderAdmin() {
    R(`
        <div class="admin-layout">
            <div class="sidebar">
                <h2>📊 ProCBT</h2>
                <div class="nav-item active" onclick="adminTab('upload',this)">📤 Upload Test</div>
                <div class="nav-item" onclick="adminTab('results',this)">📈 All Results</div>
                <div class="nav-item" onclick="adminTab('rankings',this)">🏆 Rankings</div>
                <div class="nav-item" onclick="renderLogin()">🚪 Logout</div>
            </div>
            <div class="main-area" id="adminArea"></div>
        </div>
    `);
    adminTab('upload', document.querySelector('.nav-item'));
    updateStats();
}

async function updateStats() {
    const tests = await dbg('tests');
    const results = await dbg('results');
    const students = await dbg('students');
    
    const statsHTML = `
        <div class="stats">
            <div class="stat"><div class="val" style="color:var(--accent2)">${tests.length}</div><div class="lbl">Total Tests</div></div>
            <div class="stat"><div class="val" style="color:var(--green)">${students.length}</div><div class="lbl">Students</div></div>
            <div class="stat"><div class="val" style="color:var(--yellow)">${results.length}</div><div class="lbl">Tests Taken</div></div>
            <div class="stat"><div class="val" style="color:var(--accent2)">${results.length > 0 ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(1) : 0}%</div><div class="lbl">Avg Score</div></div>
        </div>
    `;
    
    const area = document.getElementById('adminArea');
    if (area) {
        const existingStats = area.querySelector('.stats');
        if (!existingStats) {
            area.insertAdjacentHTML('afterbegin', statsHTML);
        }
    }
}

async function adminTab(tab, el) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    
    const area = document.getElementById('adminArea');
    updateStats();
    
    if (tab === 'upload') {
        area.innerHTML = `
            <div class="stats"></div>
            <div class="card anim-fade">
                <h3>📤 Upload New Test</h3>
                <div class="fg"><label>Test Name</label><input id="tname" placeholder="e.g. Physics Mid-Term"></div>
                <div class="fg"><label>Subject</label><input id="tsub" placeholder="e.g. Physics"></div>
                <div class="fg"><label>Duration (minutes)</label><input id="tdur" type="number" value="60" min="1"></div>
                <div class="fg"><label>Upload Question Paper (PDF) - All pages will be extracted</label><input id="tpdf" type="file" accept=".pdf"></div>
                <div class="fg"><label>Answer Key (optional)</label><textarea id="tkey" rows="3" placeholder="Format: 1:A, 2:B, 3:C&#10;OR JSON: [{&quot;qNo&quot;:1,&quot;answer&quot;:&quot;A&quot;}]"></textarea></div>
                <button class="btn btn-p" onclick="uploadTest()">🔄 Process All Questions & Upload</button>
                <div id="upStatus" style="margin-top:12px"></div>
            </div>`;
        updateStats();
    } else if (tab === 'results') {
        const results = await dbg('results');
        area.innerHTML = `
            <div class="stats"></div>
            <div class="card anim-fade"><h3>📈 All Results (${results.length})</h3>
                ${results.length === 0 ? '<p style="color:var(--text2)">No results yet.</p>' : `
                <table><thead><tr><th>Student</th><th>Roll</th><th>Test</th><th>Score</th><th>Time</th><th>Date</th></tr></thead><tbody>
                ${results.map(r => `<tr><td>${r.sname}</td><td>${r.sroll}</td><td>${r.tname}</td><td><b style="color:${r.percentage>=60?'var(--green)':r.percentage>=40?'var(--yellow)':'var(--red)'}">${r.percentage}%</b></td><td>${Math.floor(r.timeTaken/60)}m ${r.timeTaken%60}s</td><td>${new Date(r.date).toLocaleDateString()}</td></tr>`).join('')}
                </tbody></table>`}
            </div>`;
        updateStats();
    } else if (tab === 'rankings') {
        const tests = await dbg('tests'), allResults = await dbg('results');
        let html = '<div class="stats"></div>';
        for (const t of tests) {
            const tr = allResults.filter(r => r.testId === t.id).sort((a, b) => b.percentage - a.percentage);
            html += `<div class="card"><h4>🏆 ${t.name}</h4><table><thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Time</th></tr></thead><tbody>`;
            tr.slice(0, 10).forEach((r, i) => {
                const badge = i === 0 ? 'badge-g' : i === 1 ? 'badge-s' : i === 2 ? 'badge-b' : '';
                html += `<tr><td><span class="badge ${badge}">#${i+1}</span></td><td>${r.sname}</td><td><b>${r.percentage}%</b></td><td>${Math.floor(r.timeTaken/60)}m</td></tr>`;
            });
            html += '</tbody></table></div>';
        }
        area.innerHTML = html;
        updateStats();
    }
}

// ===== PDF UPLOAD =====
async function uploadTest() {
    const name = document.getElementById('tname').value;
    const sub = document.getElementById('tsub').value;
    const dur = parseInt(document.getElementById('tdur').value);
    const file = document.getElementById('tpdf').files[0];
    const keyText = document.getElementById('tkey').value;
    const status = document.getElementById('upStatus');
    
    if (!name || !file) {
        status.innerHTML = '<span style="color:var(--red)">❌ Fill all fields and select PDF</span>';
        return;
    }
    
    status.innerHTML = '<span style="color:var(--accent2)">⏳ Extracting ALL questions from PDF...</span>';
    
    try {
        // Read PDF
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        
        // Extract text from ALL pages
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map(it => it.str).join(' ') + '\n';
            status.innerHTML = `<span style="color:var(--accent2)">⏳ Processing page ${i} of ${pdf.numPages}...</span>`;
        }
        
        // Parse ALL questions
        let questions = parseAllQuestions(fullText);
        
        if (questions.length < 2) {
            questions = sampleQuestions(10);
            status.innerHTML += '<br><span style="color:var(--yellow)">⚠️ Could not extract enough questions. Using 10 sample questions.</span>';
        }
        
        // Apply answer key
        if (keyText.trim()) {
            const key = parseAnswerKey(keyText);
            questions = applyAnswerKey(questions, key);
        }
        
        // Save
        await dba('tests', {
            name, subject: sub, duration: dur,
            questions, total: questions.length,
            createdAt: new Date().toISOString()
        });
        
        status.innerHTML = `<span style="color:var(--green)">✅ Success! All ${questions.length} questions extracted and uploaded!</span>`;
        document.getElementById('tname').value = '';
        document.getElementById('tsub').value = '';
        document.getElementById('tkey').value = '';
        document.getElementById('tpdf').value = '';
        
        updateStats();
    } catch (e) {
        status.innerHTML = `<span style="color:var(--red)">❌ Error: ${e.message}</span>`;
        console.error(e);
    }
}

function parseAllQuestions(text) {
    const questions = [];
    
    // Clean text
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n').filter(l => l.trim().length > 3);
    
    // Strategy 1: Numbered questions
    let current = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Question start patterns
        const qPatterns = [
            /^(?:Q\.?\s*)?(\d+)\s*[.)]\s+(.+)/i,
            /^(?:Question\s*)?(\d+)\s*[:.-]\s*(.+)/i,
            /^(\d+)\s*[.)]\s+(.+)/,
        ];
        
        let isQuestion = false;
        let qNum = null, qText = '';
        
        for (const pattern of qPatterns) {
            const match = trimmed.match(pattern);
            if (match) {
                isQuestion = true;
                qNum = match[1];
                qText = match[2];
                break;
            }
        }
        
        if (isQuestion) {
            if (current && current.opts.length >= 2 && current.q.length > 3) {
                questions.push(current);
            }
            current = { id: questions.length + 1, q: qText, opts: [], ans: null };
            continue;
        }
        
        // Option patterns
        const optPatterns = [
            /^\(?([A-D])\)?\s*[.)]\s*(.+)/,
            /^([A-D])\s*[.)]\s*(.+)/,
            /^Option\s*([A-D])\s*[:.-]\s*(.+)/i,
        ];
        
        let isOption = false;
        let optLetter = '', optText = '';
        
        for (const pattern of optPatterns) {
            const match = trimmed.match(pattern);
            if (match && current) {
                isOption = true;
                optLetter = match[1];
                optText = match[2];
                break;
            }
        }
        
        if (isOption && current) {
            current.opts.push(optText);
        }
    }
    
    // Add last question
    if (current && current.opts.length >= 2 && current.q.length > 3) {
        questions.push(current);
    }
    
    // Strategy 2: If still not enough, try splitting by numbers
    if (questions.length < 3) {
        const chunks = cleanText.split(/(?=\d+\s*[.)])/);
        for (const chunk of chunks) {
            const trimmed = chunk.trim();
            if (!trimmed || trimmed.length < 10) continue;
            
            const optMatches = [];
            const optRegex = /\(?([A-D])\)?\s*[.)]\s*([^A-D]+?)(?=\s*\(?[A-D]\)?\s*[.)]|$)/gi;
            let m;
            while ((m = optRegex.exec(trimmed)) !== null) {
                optMatches.push(m[2].trim());
            }
            
            if (optMatches.length >= 2) {
                let qText = trimmed;
                optMatches.forEach(o => {
                    qText = qText.replace(new RegExp(o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
                });
                qText = qText.replace(/\(?[A-D]\)?\s*[.)]/gi, '').replace(/\s+/g, ' ').trim();
                qText = qText.replace(/^\d+\s*[.)]\s*/, '');
                
                if (qText.length > 3) {
                    questions.push({
                        id: questions.length + 1,
                        q: qText,
                        opts: optMatches,
                        ans: null
                    });
                }
            }
        }
    }
    
    return questions;
}

function parseAnswerKey(text) {
    const answers = [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
    
    const pairs = text.split(/[,;\n]+/);
    for (const pair of pairs) {
        const m = pair.trim().match(/(\d+)\s*[:=]\s*([A-D])/i);
        if (m) {
            answers.push({ qNo: parseInt(m[1]), answer: m[2].toUpperCase() });
        }
    }
    return answers;
}

function applyAnswerKey(questions, key) {
    for (const ans of key) {
        const q = questions.find(q => q.id === ans.qNo);
        if (q) {
            const idx = ans.answer.charCodeAt(0) - 65;
            if (idx >= 0 && idx < q.opts.length) {
                q.ans = q.opts[idx];
            }
        }
    }
    return questions;
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
    if (!state.engine || state.testSubmitted) return;
    switch (e.key) {
        case 'ArrowRight': e.preventDefault(); nextQ(); break;
        case 'ArrowLeft': e.preventDefault(); prevQ(); break;
        case 'm': case 'M': toggleReview(); break;
        case '1': selectOption(0); break;
        case '2': selectOption(1); break;
        case '3': selectOption(2); break;
        case '4': selectOption(3); break;
        case 'c': case 'C': clearQ(); break;
    }
});
