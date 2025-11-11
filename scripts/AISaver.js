// AISaver.js
class AISaver {
    constructor(neatInstance, options = {}) {
        this.neat = neatInstance;
        this.storageKey = options.storageKey || 'myAI';
        this.dbName = options.dbName || 'aiDB';
        this.storeName = options.storeName || 'aiStore';
    }

    // --- LocalStorage ---
    saveToLocal() {
        const data = JSON.stringify(this.neat.export());
        localStorage.setItem(this.storageKey, data);
        console.log('AI saved to LocalStorage.');
    }

    loadFromLocal() {
        const data = localStorage.getItem(this.storageKey);
        if (!data) return false;
        const json = JSON.parse(data);
        this.neat.import(json);
        console.log('AI loaded from LocalStorage.');
        return true;
    }

    // --- File ---
    saveToFile(filename = 'ai.json') {
        const data = JSON.stringify(this.neat.export());
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                const json = JSON.parse(e.target.result);
                this.neat.import(json);
                resolve(true);
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // --- Save The Best ---
    saveBest() {
        const best = this.neat.getFittest();
        const json = best.toJSON();
        console.log(JSON.stringify(json));
    }
    loadBest() {
        // 
    }

    // --- IndexedDB ---
    async saveToDB() {
        const data = JSON.stringify(this.neat.export());
        const db = await this._openDB();
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        await store.put({ id: this.storageKey, data });
        await tx.complete;
        db.close();
        console.log('AI saved to IndexedDB.');
    }

    async loadFromDB() {
        const db = await this._openDB();
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const entry = await store.get(this.storageKey);
        await tx.complete;
        db.close();
        if (!entry) return false;
        this.neat.import(JSON.parse(entry.data));
        console.log('AI loaded from IndexedDB.');
        return true;
    }

    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            request.onsuccess = e => resolve(e.target.result);
            request.onerror = e => reject(e.target.error);
        });
    }
}

// ---- Usage ----
// 
// // Save
// aiManager.saveToLocal();
// aiManager.saveToFile();
// await aiManager.saveToDB();

// // Load
// aiManager.loadFromLocal();
// await aiManager.loadFromDB();
// await aiManager.loadFromFile(fileInput.files[0]);