// UI Module
const UI = {
    app: document.getElementById('app'),

    render(html) {
        this.app.innerHTML = html;
    },

    loginScreen() {
        this.render(`
            <div class="login-container">
                <div class="login-card">
                    <h1>📚 ProCBT</h1>
                    <p class="subtitle">Professional Computer Based Test Platform</p>
                    <div class="role-tabs">
                        <div class="role-tab active" onclick="UI.switchRole('admin',this)">👨‍🏫 Admin</div>
                        <div class="role-tab" onclick="UI.switchRole('student',this)">👨‍🎓 Student</div>
                    </div>
                    <div id="loginForm"></div>
                </div>
            </div>
        `);
        UI.switchRole('admin', document.querySelector('.role-tab'));
    },

    switchRole(role, el) {
        document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        
        if (role === 'admin') {
            document.getElementById('loginForm').innerHTML = `
                <div class="form-group"><label>Admin ID</label><input id="aid" value="admin123"></div>
                <div class="form-group"><label>Password</label><input id="apass" type="password" value="admin123"></div>
                <button class="btn btn-primary" onclick="App.adminLogin()">🔑 Login</button>
                <p style="text-align:center;margin-top:10px;color:var(--text-secondary);font-size:12px">Demo: admin123 / admin123</p>
            `;
        } else {
            document.getElementById('loginForm').innerHTML = `
                <div class="form-group"><label>Full Name</label><input id="sname" placeholder="Enter name"></div>
                <div class="form-group"><label>Roll Number</label><input id="sroll" placeholder="Enter roll number"></div>
                <div class="form-group"><label>Select Test</label><select id="stest"><option>Loading...</option></select></div>
                <button class="btn btn-primary" onclick="App.studentLogin()">▶️ Start Test</button>
            `;
            App.loadTestList();
        }
    },

    adminPanel() {
        this.render(`
            <div class="admin-layout">
                <div class="sidebar">
                    <div class="sidebar-header">📊 ProCBT</div>
                    <div class="nav-item active" onclick="UI.adminTab('upload',this)">📤 Upload Test</div>
                    <div class="nav-item" onclick="UI.adminTab('results',this)">📈 Results</div>
                    <div class="nav-item" onclick="UI.adminTab('rankings',this)">🏆 Rankings</div>
                    <div class="nav-item" onclick="Auth.logout()">🚪 Logout</div>
                </div>
                <div class="main-content" id="adminContent"></div>
            </div>
        `);
        UI.adminTab('upload', document.querySelector('.nav-item'));
    },

    async adminTab(tab, el) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
        
        const area = document.getElementById('adminContent');
        
        if (tab === 'upload') {
            area.innerHTML = `
                <div class="content-card animate-in"><h3>📤 Upload New Test</h3>
                    <div class="form-group"><label>Test Name</label><input id="tname" placeholder="e.g. Physics Half-Yearly"></div>
                    <div class="form-group"><label>Subject</label><input id="tsub" placeholder="e.g. Physics"></div>
                    <div class="form-group"><label>Duration (minutes)</label><input id="tdur" type="number" value="60" min="1"></div>
                    <div class="form-group"><label>Upload Question Paper (PDF)</label><input id="tpdf" type="file" accept=".pdf"></div>
                    <div class="form-group"><label>Answer Key</label><textarea id="tkey" rows="3" placeholder="1:A, 2:B, 3:C&#10;OR JSON: [{&quot;qNo&quot;:1,&quot;answer&quot;:&quot;A&quot;}]"></textarea></div>
                    <button class="btn btn-primary" onclick="App.uploadTest()">🔄 Process & Upload</button>
                    <div id="uploadStatus" style="margin-top:10px"></div>
                </div>`;
        } else if (tab === 'results') {
            const results = await DB.getAll('results');
            area.innerHTML = `<div class="content-card animate-in"><h3>📈 All Results (${results.length})</h3>
                ${results.length === 0 ? '<p style="color:var(--text-secondary)">No results yet</p>' : `
                <table><thead><tr><th>Student</th><th>Roll</th><th>Test</th><th>Score</th><th>Time</th><th>Date</th></tr></thead><tbody>
                ${results.map(r => `<tr><td>${r.sname}</td><td>${r.sroll}</td><td>${r.tname}</td><td><b style="color:${r.pct>=60?'var(--success)':r.pct>=40?'var(--warning)':'var(--danger)'}">${r.pct}%</b></td><td>${Math.floor(r.time/60)}m ${r.time%60}s</td><td>${new Date(r.date).toLocaleDateString()}</td></tr>`).join('')}
                </tbody></table>`}</div>`;
        } else if (tab === 'rankings') {
            const tests = await DB.getAll('tests'), allResults = await DB.getAll('results');
            let html = '';
            for (const t of tests) {
                const tr = allResults.filter(r => r.testId === t.id).sort((a, b) => b.pct - a.pct);
                html += `<div class="content-card"><h4>🏆 ${t.name}</h4><table><thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Time</th></tr></thead><tbody>`;
                tr.slice(0, 10).forEach((r, i) => {
                    const badge = i === 0 ? 'badge-gold' : i === 1 ? 'badge-silver' : i === 2 ? 'badge-bronze' : '';
                    html += `<tr><td><span class="badge ${badge}">#${i + 1}</span></td><td>${r.sname}</td><td><b>${r.pct}%</b></td><td>${Math.floor(r.time/60)}m</td></tr>`;
                });
                html += '</tbody></table></div>';
            }
            area.innerHTML = `<div class="animate-in">${html || '<p style="color:var(--text-secondary)">No data</p>'}</div>`;
        }
    },

    testInterface(engine, testName, studentName) {
        this.render(`
            <div class="test-container">
                <div class="test-header">
                    <div class="test-info"><h3>${testName}</h3><small>${studentName}</small></div>
                    <div class="timer-display" id="timerDisplay">00:00</div>
                    <div>
                        <button class="btn btn-outline btn-sm" onclick="App.toggleReview()">📌 Mark</button>
                        <button class="btn btn-danger btn-sm" onclick="App.submitTest()">📝 Submit</button>
                    </div>
                </div>
                <div class="test-body">
                    <div class="question-area" id="qArea"></div>
                    <div class="question-palette">
                        <div class="palette-title">Question Palette</div>
                        <div class="palette-grid" id="qGrid"></div>
                        <div style="margin-top:15px;font-size:11px;color:var(--text-secondary)">
                            🟢 Answered | 🟣 Current | 🟡 Review | ⚫ Not Visited
                        </div>
                    </div>
                </div>
            </div>
        `);
    },

    updateTestUI(engine) {
        const q = engine.getCurrentQuestion();
        document.getElementById('qArea').innerHTML = `
            <div class="animate-in">
                <div class="question-number">Question ${engine.currentIndex + 1} of ${engine.questions.length}</div>
                <div class="question-text">${q.q}</div>
                <div class="options-list">
                    ${q.opts.map((opt, i) => `
                        <div class="option-item ${engine.answers[engine.currentIndex] === i ? 'selected' : ''}" onclick="App.selectOption(${i})">
                            <b>${String.fromCharCode(65 + i)}.</b> ${opt}
                        </div>
                    `).join('')}
                </div>
                <div class="nav-buttons">
                    <button class="btn btn-outline btn-sm" onclick="App.prevQuestion()" ${engine.currentIndex === 0 ? 'disabled' : ''}>◀ Previous</button>
                    <button class="btn btn-primary btn-sm" onclick="App.nextQuestion()" ${engine.currentIndex === engine.questions.length - 1 ? 'disabled' : ''}>Next ▶</button>
                </div>
            </div>`;

        document.getElementById('qGrid').innerHTML = engine.questions.map((_, i) => `
            <div class="palette-btn ${engine.answers[i] !== undefined ? 'answered' : ''} ${i === engine.currentIndex ? 'current' : ''} ${engine.markedForReview.has(i) ? 'review' : ''}" onclick="App.jumpTo(${i})">${i + 1}</div>
        `).join('');

        const timer = document.getElementById('timerDisplay');
        const rem = engine.getTimeRemaining();
        const mins = Math.floor(rem / 60), secs = rem % 60;
        timer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        timer.className = 'timer-display';
        if (rem <= 60) timer.classList.add('danger');
        else if (rem <= 300) timer.classList.add('warning');
    },

    resultsScreen(result, rank, allResults) {
        this.render(`
            <div class="results-container">
                <div class="results-card">
                    <h2 style="text-align:center">✅ Test Completed!</h2>
                    <div class="score-display">
                        <div class="score-circle">${result.percentage}%</div>
                        <p style="margin-top:10px;color:var(--text-secondary)">
                            🏅 Rank: <b style="color:var(--accent-light)">#${rank}</b> of ${allResults.length} | 
                            ⏱️ Time: ${Math.floor(result.timeTaken/60)}m ${result.timeTaken%60}s
                        </p>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0">
                        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${result.correct}</div><div class="stat-label">✅ Correct</div></div>
                        <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${result.incorrect}</div><div class="stat-label">❌ Incorrect</div></div>
                        <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${result.unattempted}</div><div class="stat-label">⚪ Unattempted</div></div>
                    </div>
                    <div class="chart-row">
                        <div class="chart-container"><canvas id="scoreChart"></canvas></div>
                        <div class="chart-container"><canvas id="barChart"></canvas></div>
                    </div>
                    <div class="content-card" style="margin-top:15px">
                        <h4>🏆 Leaderboard</h4>
                        <table><thead><tr><th>Rank</th><th>Student</th><th>Score</th><th>Time</th></tr></thead><tbody>
                            ${allResults.slice(0, 5).map((r, i) => `
                                <tr ${r.sroll === result.sroll ? 'style="background:rgba(99,102,241,0.1)"' : ''}>
                                    <td><span class="badge ${i===0?'badge-gold':i===1?'badge-silver':i===2?'badge-bronze':''}">#${i+1}</span></td>
                                    <td>${r.sname}</td><td><b>${r.pct}%</b></td><td>${Math.floor(r.time/60)}m</td>
                                </tr>
                            `).join('')}
                        </tbody></table>
                    </div>
                    <div class="content-card" style="margin-top:15px">
                        <h4>📋 Detailed Analysis</h4>
                        ${result.details.map((d, i) => `
                            <div style="padding:12px;margin:8px 0;border-left:4px solid ${d.isCorrect?'var(--success)':'var(--danger)'};background:var(--bg-input);border-radius:0 8px 8px 0">
                                <b>Q${i+1}:</b> ${d.q}<br>
                                <small>Your Answer: <span style="color:${d.isCorrect?'var(--success)':'var(--danger)'}">${d.user}</span> | 
                                Correct: <span style="color:var(--success)">${d.correct || 'N/A'}</span></small>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-primary" onclick="Auth.logout()" style="margin-top:15px">🏠 Back to Login</button>
                </div>
            </div>
        `);
        Charts.createScoreChart('scoreChart', result.correct, result.incorrect, result.unattempted);
        Charts.createBarChart('barChart', result.percentage);
    }
};
