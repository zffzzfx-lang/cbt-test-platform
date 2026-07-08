// Charts Module
class Charts {
    static createScoreChart(canvasId, correct, incorrect, unattempted) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Correct', 'Incorrect', 'Unattempted'],
                datasets: [{
                    data: [correct, incorrect, unattempted],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                    borderColor: '#1a1f2e',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', padding: 15 }
                    }
                }
            }
        });
    }

    static createBarChart(canvasId, percentage) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Score'],
                datasets: [{
                    data: [percentage],
                    backgroundColor: percentage >= 60 ? '#10b981' : percentage >= 40 ? '#f59e0b' : '#ef4444',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, max: 100, grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}
