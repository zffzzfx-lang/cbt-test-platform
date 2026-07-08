// PDF Parser Module
class PDFParser {
    constructor() {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    async extractText(file) {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(' ') + '\n';
        }
        return text;
    }

    parseQuestions(text) {
        const cleanText = text.replace(/\s+/g, ' ').trim();
        const questions = [];
        
        // Multiple parsing strategies
        const patterns = [
            // Pattern 1: Q1. ... (A) ... (B) ...
            /(?:Q\.?\s*)?(\d+)\s*[.)]\s*(.*?)(?=(?:\s*(?:Q\.?\s*)?\d+\s*[.)])|$)/gi,
            // Pattern 2: 1. ... A. ... B. ...
            /(\d+)\s*[.)]\s*(.*?)(?=\s*\d+\s*[.)]|$)/gi
        ];

        for (const pattern of patterns) {
            let match;
            const textCopy = cleanText;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(textCopy)) !== null) {
                const qNum = match[1];
                const content = match[2].trim();
                
                // Extract options
                const optionRegex = /\(?([A-D])\)?[.)\s]+([^A-D]+?)(?=\s*\(?[A-D]\)?[.)\s]|$)/gi;
                const options = [];
                let optMatch;
                
                while ((optMatch = optionRegex.exec(content)) !== null) {
                    options.push(optMatch[2].trim());
                }

                if (options.length >= 2 && content.length > 5) {
                    // Remove options from question text
                    let questionText = content;
                    options.forEach(opt => {
                        questionText = questionText.replace(new RegExp(`\\(?[A-D]\\)?[.)\\s]*${opt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '');
                    });
                    questionText = questionText.replace(/\s+/g, ' ').trim();

                    if (questionText.length > 3) {
                        questions.push({
                            id: questions.length + 1,
                            q: questionText,
                            opts: options,
                            ans: null
                        });
                    }
                }
            }
            
            if (questions.length >= 3) break;
        }

        // If parsing failed, try line-by-line
        if (questions.length < 2) {
            const lines = text.split('\n').filter(l => l.trim().length > 5);
            let current = null;
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                if (/^\d+[.)]\s/.test(trimmed)) {
                    if (current && current.opts.length >= 2) questions.push(current);
                    current = { id: questions.length + 1, q: trimmed.replace(/^\d+[.)]\s*/, ''), opts: [], ans: null };
                } else if (/^[A-D][.)]\s/.test(trimmed) && current) {
                    current.opts.push(trimmed.replace(/^[A-D][.)]\s*/, ''));
                }
            }
            if (current && current.opts.length >= 2) questions.push(current);
        }

        return questions;
    }

    parseAnswerKey(text) {
        const answers = [];
        
        // Try JSON
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {}

        // Try format: 1:A, 2:B or 1:A;2:B
        const pairs = text.split(/[,;\n]+/);
        for (const pair of pairs) {
            const m = pair.trim().match(/(\d+)\s*[:=]\s*([A-D])/i);
            if (m) {
                answers.push({ qNo: parseInt(m[1]), answer: m[2].toUpperCase() });
            }
        }

        return answers;
    }

    mergeAnswers(questions, answerKey) {
        for (const ans of answerKey) {
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

    generateSample() {
        return [
            { id: 1, q: "What is the capital of India?", opts: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], ans: "New Delhi" },
            { id: 2, q: "Which is the largest planet in our solar system?", opts: ["Earth", "Mars", "Jupiter", "Saturn"], ans: "Jupiter" },
            { id: 3, q: "What is the chemical formula of water?", opts: ["H2O", "CO2", "NaCl", "O2"], ans: "H2O" },
            { id: 4, q: "Who wrote 'Romeo and Juliet'?", opts: ["Dickens", "Shakespeare", "Austen", "Twain"], ans: "Shakespeare" },
            { id: 5, q: "What is the speed of light approximately?", opts: ["3×10⁸ m/s", "3×10⁶ m/s", "3×10⁴ m/s", "3×10² m/s"], ans: "3×10⁸ m/s" }
        ];
    }
}
