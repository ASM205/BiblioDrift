
export const SafeStorage = {
    _dbName: 'BiblioDriftDB',
    _storeName: 'library_backup',

    /**
     * Attempts to request persistent storage from the browser.
     * This prevents the browser from clearing storage when disk space is low.
     */
    async requestPersistence() {
        if (navigator.storage && navigator.storage.persist) {
            try {
                const isPersisted = await navigator.storage.persist();
                if (IS_DEV) {
                    console.log(`[Storage] Persistent status: ${isPersisted}`);
                }
            } catch (e) {
                console.warn('[Storage] Persist request failed', e);
            }
        }
    },

    /**
     * Internal: Opens the IndexedDB for backup.
     */
    async _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this._dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this._storeName)) {
                    db.createObjectStore(this._storeName);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    /**
     * Attempts to save data to localStorage with IndexedDB backup.
     * @param {string} key
     * @param {string} value
     * @returns {boolean} Success status
     */
    set(key, value) {
        // 1. Primary: LocalStorage
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            const isQuotaError =
                error instanceof DOMException &&
                (error.code === 22 ||
                    error.code === 1014 ||
                    error.name === 'QuotaExceededError' ||
                    error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

            if (isQuotaError) {
                showToast('Local storage full! Saving to secure backup.', 'info');
            } else {
                console.error('LocalStorage Error:', error);
            }
        }

        // 2. Secondary: IndexedDB (Durable Backup for Library)
        if (key === 'bibliodrift_library') {
            this._saveToDB(key, value);
        }
        return true;
    },

    async _saveToDB(key, value) {
        try {
            const db = await this._openDB();
            const transaction = db.transaction(this._storeName, 'readwrite');
            const store = transaction.objectStore(this._storeName);
            store.put(value, key);
        } catch (e) {
            console.error('IndexedDB Backup Failed', e);
        }

        showToast('Local storage full! Please sync to cloud and clear cache.', 'error');
        return false;
    },

    /**
     * Safely retrieves data from localStorage.
     */
    get(key) {
        try {
            const value = localStorage.getItem(key);
            return value;
        } catch (e) {
            return null;
        }
    },

    /**
     * Retrieves data with IndexedDB fallback if LocalStorage is wiped.
     */
    async getAsync(key) {
        let val = this.get(key);
        if (!val && key === 'bibliodrift_library') {
            try {
                const db = await this._openDB();
                const transaction = db.transaction(this._storeName, 'readonly');
                const store = transaction.objectStore(this._storeName);
                val = await new Promise((resolve) => {
                    const request = store.get(key);
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => resolve(null);
                });

                if (val) {
                    if (IS_DEV) console.log('[Storage] Restored from IndexedDB backup');
                    // Try to restore to LocalStorage for future sync calls
                    try {
                        localStorage.setItem(key, val);
                    } catch (e) {}
                }
            } catch (e) {
                console.warn('Backup retrieval failed', e);
            }
        }
        return val;
    },

    /**
     * Safely removes data from storage.
     * @param {string} key
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            if (key === 'bibliodrift_library') {
                this._saveToDB(key, null);
            }
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Safely clears all localStorage.
     */
    clear() {
        try {
            localStorage.clear();
            this.setMeta({});
            return true;
        } catch (e) {
            return false;
        }
    },
};
export const MOCK_BOOKS = [
    {
        id: "mock-dune",
        volumeInfo: {
            title: "Dune",
            authors: ["Frank Herbert"],
            description: "A sweeping science fiction epic set on the desert planet Arrakis. Dune explores complex themes of politics, religion, and man's relationship with nature. Paul Atreides must navigate a treacherous path to becoming the mysterious Muad'Dib.",
            imageLinks: { thumbnail: "../assets/images/dune.jpg" }
        }
    },
    {
        id: "mock-1984",
        volumeInfo: {
            title: "1984",
            authors: ["George Orwell"],
            description: "Orwell's chilling prophecy of a totalitarian future where Big Brother is always watching. A profound exploration of surveillance, truth, and the resilience of the human spirit.",
            imageLinks: { thumbnail: "../assets/images/1984.jpg" }
        }
    },
    {
        id: "mock-hobbit",
        volumeInfo: {
            title: "The Hobbit",
            authors: ["J.R.R. Tolkien"],
            description: "In a hole in the ground there lived a hobbit. Join Bilbo Baggins on an unexpected journey across Middle-earth, encountering dragons, dwarves, and a rigorous test of courage.",
            imageLinks: { thumbnail: "../assets/images/hobbit.jpg" }
        }
    },
    {
        id: "mock-pride",
        volumeInfo: {
            title: "Pride and Prejudice",
            authors: ["Jane Austen"],
            description: "A timeless romance of manners and misunderstanding. Elizabeth Bennet's wit matches Mr. Darcy's pride in this sharp social commentary that remains one of the most loved novels in English literature.",
            imageLinks: { thumbnail: "../assets/images/pride.jpg" }
        }
    },
    {
        id: "mock-gatsby",
        volumeInfo: {
            title: "The Great Gatsby",
            authors: ["F. Scott Fitzgerald"],
            description: "The quintessential novel of the Jazz Age. Jay Gatsby's obsessive love for Daisy Buchanan drives a tragic tale of wealth, illusion, and the American Dream.",
            imageLinks: { thumbnail: "../assets/images/gatsby.jpg" }
        }
    },
    {
        id: "mock-sapiens",
        volumeInfo: {
            title: "Sapiens",
            authors: ["Yuval Noah Harari"],
            description: "A groundbreaking narrative of humanity's creation and evolution. Harari explores the ways in which biology and history have defined us and enhanced our understanding of what it means to be 'human'.",
            imageLinks: { thumbnail: "../assets/images/sapiens.jpg" }
        }
    },
    {
        id: "mock-hail-mary",
        volumeInfo: {
            title: "Project Hail Mary",
            authors: ["Andy Weir"],
            description: "A lone astronaut must save the earth from disaster in this gripping tale of survival and scientific discovery. Full of humor and hard science, it is a celebration of human ingenuity.",
            imageLinks: { thumbnail: "../assets/images/hail_mary.jpg" }
        }
    }
];

export function normalizeQueryTerms(query) {
    return String(query || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

export function scoreMockBook(book, queryTerms) {
    const volumeInfo = book.volumeInfo || {};
    const haystack = [
        volumeInfo.title || '',
        (volumeInfo.authors || []).join(' '),
        volumeInfo.description || '',
        (volumeInfo.categories || []).join(' ')
    ].join(' ').toLowerCase();

    return queryTerms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

export function getFallbackBooks(query, maxResults = 5) {
    const queryTerms = normalizeQueryTerms(query);
    const ranked = MOCK_BOOKS
        .map(book => ({ book, score: scoreMockBook(book, queryTerms) }))
        .sort((a, b) => b.score - a.score);

    const matches = ranked.filter(item => item.score > 0).map(item => item.book);
    const pool = matches.length > 0 ? matches : MOCK_BOOKS;

    return pool.slice(0, maxResults);
}


