// Main App Module
const App = {
    engine: null,
    currentTest: null,

    async init() {
        await openDB();
        const session = Auth.getSession();
        if (session?.role === 'admin') UI.adminPanel();
        else if (session?.role === 'student') this.resumeTest();
        else UI.loginScreen();
    },

    adminLogin() {
        const id = document.getElementById('aid').value;
        const pass = document.getElementById('apass').value;
        if (Auth.loginAdmin(id, pass)) {
            Auth.setSession({ role: 'admin' });
            UI.adminPanel();
        } else {
            alert('Invalid credentials!');
        }
    },

    async loadTestList() {
        const tests = await DB.getAll('tests');
        if (tests.length === 0) {
            const parser = new PDFParser();
            await DB.add('tests', {
                name: 'Sample Test',
                subject: 'General Knowledge',
                duration: 30,
                questions: parser.generateSample(),
                total: 5,
                createdAt: new Date().toISOString()
            });
            return this.loadTestList();
        }
        const sel = document.getElementById('stest');
        if (sel) sel.innerHTML = tests.map(t => `<option value="${t.id}">${t.name} (${t.duration}min)</option>`).join('');
    },

    async studentLogin() {
        const name = document.getElementById('sname').value;
        const roll = document.getElementById('sroll').value;
        const testId = parseInt(document.getElementById('stest').value);
        
        try {
            const student = await Auth.loginStudent(name, roll);
            const test = await DB.getById('tests', testId);
            if (!test) throw new Error('Test not found');
            
            this.currentTest = test;
            Auth.setSession({ role: 'student', name: student.name, rollNo: student.rollNo, testId });
            
            this.engine = new TestEngine(test.questions, test.duration);
            this.engine.start();
            
            UI.testInterface(this.engine, test.name, student.name);
            UI.updateTestUI(this.engine);
            
            // Auto-update timer
            this.timerUpdater = setInterval(() => {
                if (this.engine && !this.engine.isSubmitted) {
                    UI.updateTestUI(this.engine);
                }
            }, 1000);
        } catch (e) {
            alert(e.message);
        }
    },

    resumeTest() {
        const session = Auth.getSession();
        if (!session?.testId) return UI.loginScreen();
        // For simplicity, start fresh
        Auth.clearSession();
        UI.loginScreen();
    },

    async uploadTest() {
        const name = document.getElementById('tname').value;
        const sub = document.getElementById('tsub').value;
        const dur = parseInt(document.getElementById('tdur').value);
        const file = document.getElementById('tpdf').files[0];
        const keyText = document.getElementById('tkey').value;
        const status = document.getElementById('uploadStatus');

        if (!name || !file) {
            status.innerHTML = '<span style="color:var(--danger)">❌ Please fill all fields and select PDF</span>';
            return;
        }

        status.innerHTML = '<span style="color:var(--accent-light)">⏳ Processing PDF...</span>';

        try {
            const parser = new PDFParser();
            let questions = parser.parseQuestions(await parser.extractText(file));
            
            if (questions.length < 2) {
                questions = parser.generateSample();
                status.innerHTML += '<br><span style="color:var(--warning)">⚠️ Low questions detected. Using sample.</span>';
            }

            if (keyText.trim()) {
                const answerKey = parser.parseAnswerKey(keyText);
                questions = parser.mergeAnswers(questions, answerKey);
            }

            await DB.add('tests', {
                name, subject: sub, duration: dur,
                questions, total: questions.length,
                createdAt: new Date().toISOString()
            });

            status.innerHTML = `<span style="color:var(--success)">✅ Success! ${questions.length} questions uploaded.</span>`;
            document.getElementById('tname').value = '';
            document.getElementById('tsub').value = '';
            document.getElementById('tkey').value = '';
            document.getElementById('tpdf').value = '';
        } catch (e) {
            status.innerHTML = `<span style="color:var(--danger)">❌ Error: ${e.message}</span>`;
        }
    },

    selectOption(index) {
        this.engine.selectAnswer(index);
        UI.updateTestUI(this.engine);
    },

    toggleReview() {
        this.engine.toggleReview();
        UI.updateTestUI(this.engine);
    },

    nextQuestion() {
        this.engine.next();
        UI.updateTestUI(this.engine);
    },

    prevQuestion() {
        this.engine.prev();
        UI.updateTestUI(this.engine);
    },

    jumpTo(index) {
        this.engine.jumpTo(index);
        UI.updateTestUI(this.engine);
    },

    async submitTest() {
        if (!confirm('Are you sure you want to submit the test?')) return;
        
        clearInterval(this.timerUpdater);
        const result = this.engine.submit();
        const session = Auth.getSession();

        await DB.add('results', {
            testId: this.currentTest.id,
            tname: this.currentTest.name,
            sname: session.name,
            sroll: session.rollNo,
            ...result,
            date: new Date().toISOString()
        });

        const allResults = (await DB.getByIndex('results', 'testId', this.currentTest.id))
            .sort((a, b) => b.percentage - a.percentage);
        const rank = allResults.findIndex(r => r.sroll === session.rollNo) + 1;

        UI.resultsScreen(result, rank, allResults);
    }
};

// Keyboard shortcuts
document.addEventListener('keydown', e => {
    if (!App.engine || App.engine.isSubmitted) return;
    switch(e.key) {
        case 'ArrowRight': App.nextQuestion(); break;
        case 'ArrowLeft': App.prevQuestion(); break;
        case 'm': App.toggleReview(); break;
        case 's': if(e.ctrlKey) { e.preventDefault(); App.submitTest(); } break;
        case '1': case '2': case '3': case '4':
            const idx = parseInt(e.key) - 1;
            if (idx < App.engine.getCurrentQuestion().opts.length) App.selectOption(idx);
            break;
    }
});

// Start
App.init();
