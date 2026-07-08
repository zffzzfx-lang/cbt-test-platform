// Database Module
const DB_NAME = 'CBT_PRO_DB', DB_VER = 1;
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('tests')) d.createObjectStore('tests', { keyPath: 'id', autoIncrement: true });
            if (!d.objectStoreNames.contains('results')) {
                const rs = d.createObjectStore('results', { keyPath: 'id', autoIncrement: true });
                rs.createIndex('testId', 'testId', { unique: false });
                rs.createIndex('studentId', 'studentId', { unique: false });
            }
            if (!d.objectStoreNames.contains('students')) d.createObjectStore('students', { keyPath: 'rollNo' });
        };
        req.onsuccess = e => { db = e.target.result; resolve(db); };
        req.onerror = reject;
    });
}

const DB = {
    add: (store, data) => new Promise(r => { const tx = db.transaction(store, 'readwrite'); const req = tx.objectStore(store).add(data); req.onsuccess = () => r(req.result); }),
    getAll: (store) => new Promise(r => { const tx = db.transaction(store, 'readonly'); const req = tx.objectStore(store).getAll(); req.onsuccess = () => r(req.result); }),
    getById: (store, id) => new Promise(r => { const tx = db.transaction(store, 'readonly'); const req = tx.objectStore(store).get(id); req.onsuccess = () => r(req.result); }),
    getByIndex: (store, idx, val) => new Promise(r => { const tx = db.transaction(store, 'readonly'); const req = tx.objectStore(store).index(idx).getAll(val); req.onsuccess = () => r(req.result); }),
    delete: (store, id) => new Promise(r => { const tx = db.transaction(store, 'readwrite'); const req = tx.objectStore(store).delete(id); req.onsuccess = () => r(); }),
    count: (store) => new Promise(r => { const tx = db.transaction(store, 'readonly'); const req = tx.objectStore(store).count(); req.onsuccess = () => r(req.result); })
};
