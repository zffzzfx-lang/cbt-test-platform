// Test Engine Module
class TestEngine {
    constructor(questions, duration) {
        this.questions = questions;
        this.duration = duration; // in minutes
        this.currentIndex = 0;
        this.answers = {};
        this.markedForReview = new Set();
        this.startTime = null;
        this.timeRemaining = duration * 60;
        this.timerInterval = null;
        this.isSubmitted = false;
    }

    start() {
        this.startTime = Date.now();
        this.startTimer();
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            if (this.timeRemaining <= 0) {
                this.stop();
                this.submit();
            }
        }, 1000);
    }

    stop() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    getCurrentQuestion() {
        return this.questions[this.currentIndex];
    }

    selectAnswer(optionIndex) {
        this.answers[this.currentIndex] = optionIndex;
    }

    clearAnswer() {
        delete this.answers[this.currentIndex];
        this.markedForReview.delete(this.currentIndex);
    }

    toggleReview() {
        if (this.markedForReview.has(this.currentIndex)) {
            this.markedForReview.delete(this.currentIndex);
        } else {
            this.markedForReview.add(this.currentIndex);
        }
    }

    next() {
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
        }
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
        }
    }

    jumpTo(index) {
        if (index >= 0 && index < this.questions.length) {
            this.currentIndex = index;
        }
    }

    getTimeRemaining() {
        return this.timeRemaining;
    }

    getElapsedTime() {
        return Math.floor((Date.now() - this.startTime) / 1000);
    }

    calculateScore() {
        let correct = 0, incorrect = 0, unattempted = 0;
        const details = [];

        this.questions.forEach((q, i) => {
            const userAns = this.answers[i];
            if (userAns === undefined) {
                unattempted++;
                details.push({ q: q.q, user: 'Not Attempted', correct: q.ans, isCorrect: false });
            } else if (q.opts[userAns] === q.ans) {
                correct++;
                details.push({ q: q.q, user: q.opts[userAns], correct: q.ans, isCorrect: true });
            } else {
                incorrect++;
                details.push({ q: q.q, user: q.opts[userAns], correct: q.ans, isCorrect: false });
            }
        });

        const total = this.questions.length;
        return {
            total, correct, incorrect, unattempted,
            percentage: parseFloat(((correct / total) * 100).toFixed(1)),
            timeTaken: this.getElapsedTime(),
            details
        };
    }

    submit() {
        this.stop();
        this.isSubmitted = true;
        return this.calculateScore();
    }
}
