// Auth Module
const Auth = {
    loginAdmin(id, pass) {
        return id === 'admin123' && pass === 'admin123';
    },
    async loginStudent(name, roll) {
        if (!name || !roll) throw new Error('Please fill all fields');
        let s = await DB.getById('students', roll);
        if (!s) {
            s = { rollNo: roll, name, createdAt: new Date().toISOString() };
            await DB.add('students', s);
        }
        return s;
    },
    getSession() {
        const d = sessionStorage.getItem('cbt_user');
        return d ? JSON.parse(d) : null;
    },
    setSession(user) {
        sessionStorage.setItem('cbt_user', JSON.stringify(user));
    },
    clearSession() {
        sessionStorage.removeItem('cbt_user');
    },
    logout() {
        Auth.clearSession();
        location.reload();
    }
};
