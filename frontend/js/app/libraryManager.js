import { SafeStorage } from './storage.js';
import { CollectionAPI, showToast } from './api.js';
import { BookRenderer } from './bookRenderer.js';

export class LibraryManager {
    constructor() {
        this.storageKey = 'bibliodrift_library';
        // Initialize with empty library to prevent crashes during async load
        this.library = {
            current: [],
            want: [],
            finished: []
        };


        this.apiBase = MOOD_API_BASE; // Fixed: Use global constant (Issue #7)

        // Asynchronous initialization
        this._initPromise = this.init();
    }

    async ready() {
        await this._initPromise;
        return this;
    }

    async init() {
        // 1. Request persistent storage to prevent wipes
        await SafeStorage.requestPersistence();

        // 2. Load from LocalStorage or IndexedDB backup (Issue #8)
        const stored = await SafeStorage.getAsync(this.storageKey);
        if (stored) {
            try {
                this.library = JSON.parse(stored);
            } catch (e) {
                console.error("[Library] Failed to parse stored library, resetting to empty.", e);
            }
        }

        // 3. Setup sorting and trigger initial fast render
        this.setupSorting();

        if (document.getElementById('shelf-want')) {
            // Fast Render from local data
            this.renderShelf('want', 'shelf-want');
            this.renderShelf('current', 'shelf-current');
            this.renderShelf('finished', 'shelf-finished');
        }

        // 4. Sync with backend if available (Full Refresh)
        await this.syncWithBackend();
        if (navigator.onLine) {
            await this.flushPendingLibraryMutations();
        }
        await this.updateSyncStatus();
    }

    getUser() {
        const userStr = SafeStorage.get('bibliodrift_user');
        return userStr ? JSON.parse(userStr) : null;
    }

    getAuthHeaders() {
        const csrfToken = getCookie('csrf_access_token');
        const headers = {
            'Content-Type': 'application/json'
        };
        // CSRF protection for cookie-based auth
        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken;
        }
        return new Headers(headers);
    }

    async _getPendingSyncCount() {
        const user = this.getUser();
        if (!user || !window.db?.syncQueue) return 0;
        return await window.db.syncQueue.where('userId').equals(user.id).count();
    }

    async updateSyncStatus() {
        const statusEl = document.getElementById('library-sync-status');
        if (!statusEl) return;

        const pendingCount = await this._getPendingSyncCount();
        statusEl.hidden = false;
        statusEl.textContent = pendingCount > 0
            ? `${pendingCount} pending sync${pendingCount === 1 ? '' : 's'}`
            : 'Synced';
        statusEl.dataset.state = pendingCount > 0 ? 'pending' : 'synced';
    }

    async _queueMutation(action, book, extra = {}) {
        if (typeof window.enqueueLibraryMutation !== 'function') return;

        const user = this.getUser();
        if (!user || !window.db?.syncQueue) return;

        const snapshot = JSON.parse(JSON.stringify(book));

        const existingMutations = (await window.db.syncQueue.where('userId').equals(user.id).toArray())
            .filter((mutation) => mutation.bookId === snapshot.id);

        if (action === 'remove') {
            await Promise.all(existingMutations.map((mutation) => window.db.syncQueue.delete(mutation.id)));
            await this.updateSyncStatus();
            return;
        }

        const shelf = extra.shelf || this.findBookShelf(snapshot.id) || null;
        const mergedMutation = {
            userId: user.id,
            action,
            bookId: snapshot.id,
            db_id: snapshot.db_id || null,
            shelf,
            payload: extra,
            book: snapshot
        };

        const pendingAdd = existingMutations.find((mutation) => mutation.action === 'add');
        if (pendingAdd && (action === 'move' || action === 'update')) {
            await window.db.syncQueue.put({
                ...pendingAdd,
                db_id: mergedMutation.db_id || pendingAdd.db_id || null,
                shelf: action === 'move' ? extra.toShelf || pendingAdd.shelf : pendingAdd.shelf,
                payload: {
                    ...(pendingAdd.payload || {}),
                    ...extra
                },
                book: snapshot,
                createdAt: pendingAdd.createdAt || new Date().toISOString()
            });
            await this.updateSyncStatus();
            return;
        }

        if (action === 'add') {
            await Promise.all(existingMutations.map((mutation) => window.db.syncQueue.delete(mutation.id)));
        }

        await window.enqueueLibraryMutation(mergedMutation);
        await this.updateSyncStatus();
    }

    async _applyQueuedMutation(mutation) {
        const user = this.getUser();
        if (!user) return;

        const localBookResult = this.findBookInShelf(mutation.bookId);
        const localBook = localBookResult?.book || mutation.book;
        const dbId = localBook?.db_id || mutation.db_id;

        if (mutation.action === 'add') {
            if (!localBook) return;

            const payload = {
                user_id: user.id,
                google_books_id: localBook.id,
                title: localBook.volumeInfo?.title || localBook.title || '',
                authors: localBook.volumeInfo?.authors ? localBook.volumeInfo.authors.join(', ') : '',
                thumbnail: localBook.volumeInfo?.imageLinks?.thumbnail || '',
                shelf_type: mutation.shelf || mutation.payload?.shelf || 'want'
            };

            const res = await fetch(`${this.apiBase}/library`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (localBook) {
                localBook.db_id = data.item.id;
                localBook.version = data.item.version;
                this.saveLocally();
            }
            return;
        }

        if (mutation.action === 'remove') {
            if (!dbId) return;

            const res = await fetch(`${this.apiBase}/library/${dbId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
                credentials: 'include'
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
            }
            return;
        }

        if (mutation.action === 'move' || mutation.action === 'update') {
            if (!dbId || !localBook) return;

            const body = mutation.action === 'move'
                ? {
                    shelf_type: mutation.payload?.toShelf,
                    progress: localBook.progress,
                    version: localBook.version
                }
                : {
                    ...mutation.payload?.updates,
                    version: localBook.version
                };

            const res = await fetch(`${this.apiBase}/library/${dbId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            const data = await res.json();
            localBook.version = data.item.version;
            this.saveLocally();
        }
    }

    async flushPendingLibraryMutations() {
        const user = this.getUser();
        if (!user || !window.db?.syncQueue) {
            await this.updateSyncStatus();
            return 0;
        }

        const pendingMutations = await window.db.syncQueue.where('userId').equals(user.id).sortBy('createdAt');
        if (pendingMutations.length === 0) {
            await this.updateSyncStatus();
            return 0;
        }

        let processed = 0;
        for (const mutation of pendingMutations) {
            await this._applyQueuedMutation(mutation);
            await window.db.syncQueue.delete(mutation.id);
            processed += 1;
        }

        if (processed > 0) {
            await this.syncWithBackend();
        }

        await this.updateSyncStatus();
        return processed;
    }

    async syncWithBackend() {
        const user = this.getUser();
        if (!user) return;

        try {
            const res = await fetch(`${this.apiBase}/library/${user.id}`, {
                headers: this.getAuthHeaders(),
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();

                // Merge Strategy:
                // 1. Create a map of existing local books for quick lookup
                const localBooksMap = new Map();
                ['current', 'want', 'finished'].forEach(shelf => {
                    this.library[shelf].forEach(book => {
                        localBooksMap.set(book.id, { book, shelf });
                    });
                });

                // 2. Process backend books
                data.library.forEach(item => {
                    const existing = localBooksMap.get(item.google_books_id);

                    // Construct standard book object
                    const remoteBook = {
                        id: item.google_books_id,
                        db_id: item.id,
                        version: item.version,
                        volumeInfo: {
                            title: item.title,
                            authors: item.authors ? item.authors.split(', ') : [],
                            imageLinks: { thumbnail: item.thumbnail }
                        },
                        // Backend data is authoritative during sync DOWN
                        progress: item.progress,
                        date_added: item.created_at || new Date().toISOString()
                    };

                    if (existing) {
                        const localBook = existing.book;

                        // Conflict Resolution Logic:
                        // If backend has a higher version, it wins.
                        if (item.version > (localBook.version || 0)) {
                            if (existing.shelf !== item.shelf_type) {
                                // Remove from old shelf
                                this.library[existing.shelf] = this.library[existing.shelf].filter(b => b.id !== item.google_books_id);
                                // Add to new shelf
                                this.library[item.shelf_type].push(remoteBook);
                            } else {
                                // Update details in place
                                Object.assign(localBook, remoteBook);
                            }
                        } else if (item.version === (localBook.version || 0)) {
                            // Versions match, just ensure db_id is set
                            localBook.db_id = item.id;
                        }
                        // If item.version < localBook.version, we have unsynced local changes.
                        // syncLocalToBackend will handle pushing these.

                        // Mark as processed/merged
                        localBooksMap.delete(item.google_books_id);
                    } else {
                        // New book from backend
                        if (this.library[item.shelf_type]) {
                            this.library[item.shelf_type].push(remoteBook);
                        }
                    }
                });

                // 3. Handle remaining local books (not in backend)
                // These could be:
                // a) Added offline and not yet synced -> Keep them
                // b) Deleted on another device -> Should remove?
                // For this implementation, we will KEEP them to prioritize no data loss (offline first).
                // Ideally, we'd check timestamps or have a specific "sync queue".

                this.saveLocally();

                // Trigger Render
                if (document.getElementById('shelf-want')) {
                    const sortSelect = document.getElementById('sortLibrary');
                    if (sortSelect && typeof this.sortLibrary === 'function') {
                        this.sortLibrary(sortSelect.value);
                    } else {
                        this.renderShelf('want', 'shelf-want');
                        this.renderShelf('current', 'shelf-current');
                        this.renderShelf('finished', 'shelf-finished');
                    }
                }
                await this.updateSyncStatus();
            }
        } catch (e) {
            console.error("Sync failed", e);
            showToast("Sync failed. Using local library.", "error");
        }
    }

    async syncLocalToBackend(user) {
        if (!user) return;

        // Flatten local library into a list of items with 'shelf' property
        const itemsToSync = [];
        ['current', 'want', 'finished'].forEach(shelf => {
            if (this.library[shelf]) {
                this.library[shelf].forEach(book => {
                    // Sync both new (anonymous) items and potentially updated items (with db_id)
                    // If book.db_id is present, it's an update. If not, it's a new item.
                    itemsToSync.push({
                        ...book,
                        shelf: shelf,
                        // Ensure version is sent if present
                        version: book.version || 0
                    });
                });
            }
        });

        if (itemsToSync.length === 0) return; // Nothing to sync

        try {
            if (IS_DEV) {
                console.log(`Syncing ${itemsToSync.length} items to backend...`);
            }
            const res = await fetch(`${this.apiBase}/library/sync`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({
                    user_id: user.id,
                    items: itemsToSync
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (IS_DEV) {
                    console.log("Sync result:", data);
                }

                if (data.conflicts > 0) {
                    showToast(`Synced ${data.message} (${data.conflicts} conflicts resolved by server)`, "info");
                } else {
                    showToast(`Synced ${data.message}`, "success");
                }

                // After upload, pull fresh state from backend to get the new DB IDs and versions
                await this.syncWithBackend();
                await this.updateSyncStatus();
            } else {
                const data = await res.json();
                console.error("Backend refused sync", data);
                showToast("Sync failed: " + (data.error || "Server error"), "error");
            }
        } catch (e) {
            console.error("Sync upload failed", e);
            showToast("Failed to upload local library", "error");
        }
    }

    setupSorting() {
        const sortSelect = document.getElementById('library-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortLibrary(e.target.value);
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                this.filterLibrary(query);
            });
        }
    }

    filterLibrary(query) {
        ['current', 'want', 'finished'].forEach(shelf => {
            const containerId = `shelf-${shelf}-3d`;
            const container = document.getElementById(containerId);
            if (!container) return;

            const books = this.library[shelf];
            const filtered = books.filter(book => {
                const title = (book.volumeInfo.title || "").toLowerCase();
                const author = (book.volumeInfo.authors || []).join(" ").toLowerCase();
                const moods = (book.moods || []).join(" ").toLowerCase();
                return title.includes(query) || author.includes(query) || moods.includes(query);
            });

            this.renderFilteredShelf(shelf, containerId, filtered);
        });
    }

    async renderFilteredShelf(shelfName, elementId, books) {
        const container = document.getElementById(elementId);
        if (!container) return;

        container.innerHTML = '';
        if (books.length === 0) {
            container.innerHTML = '<div class="empty-state">No matching books found.</div>';
            return;
        }

        try {
            const renderer = new BookRenderer(this);
            for (const book of books) {
                const el = await renderer.createBookElement(book, shelfName);
                container.appendChild(el);
            }
        } catch (error) {
            console.error(`[Library] Error rendering filtered shelf:`, error);
        }
    }

    sortLibrary(criteria) {
        const sortFn = (a, b) => {
            switch (criteria) {
                case 'date_desc':
                    return new Date(b.date_added || 0) - new Date(a.date_added || 0);
                case 'date_asc':
                    return new Date(a.date_added || 0) - new Date(b.date_added || 0);
                case 'title':
                case 'title_asc':
                    return (a.volumeInfo.title || "").localeCompare(b.volumeInfo.title || "");
                case 'title_desc':
                    return (b.volumeInfo.title || "").localeCompare(a.volumeInfo.title || "");
                case 'author':
                case 'author_asc':
                    const authorA = (a.volumeInfo.authors && a.volumeInfo.authors[0]) || "";
                    const authorB = (b.volumeInfo.authors && b.volumeInfo.authors[0]) || "";
                    return authorA.localeCompare(authorB);
                case 'mood':
                    // Sort by primary mood if available
                    const moodA = (a.moods && a.moods[0]) || "zzz"; // push untagged to bottom
                    const moodB = (b.moods && b.moods[0]) || "zzz";
                    return moodA.localeCompare(moodB);
                case 'rating':
                    return (b.volumeInfo.averageRating || 0) - (a.volumeInfo.averageRating || 0);
                default:
                    return 0;
            }
        };

        ['current', 'want', 'finished'].forEach(shelf => {
            if (this.library[shelf]) {
                this.library[shelf].sort(sortFn);
                // If we have a dedicated 3D renderer, let it handle the UI to avoid duplicate rendering
                if (window.bookshelf3D && typeof window.bookshelf3D.refreshShelves === 'function') {
                    window.bookshelf3D.refreshShelves();
                } else {
                    this.renderShelf(shelf, `shelf-${shelf}-3d`);
                }
            }
        });
    }

    async addBook(book, shelf) {
        // Check if book exists ANYWHERE in library specifically by ID
        if (this.findBook(book.id)) {
            // It exists. Check where.
            const existingShelf = this.findBookShelf(book.id);
            if (existingShelf === shelf) {
                showToast("Book already in this shelf!", "info");
                return;
            } else if (existingShelf) {
                // Move logic? For now, prevent duplicates and notify user.
                // Or allow "moving" implicitly? 
                // Let's implement move: Remove from old, add to new.
                this.removeBook(book.id);
                // Fall through to add
                showToast(`Moved book from ${existingShelf} to ${shelf}`, "info");
            }
        }

        const enrichedBook = {
            ...book,
            progress: shelf === 'current' ? 0 : null,
            date_added: new Date().toISOString()
        };

        // 1. Update Local State
        this.library[shelf].push(enrichedBook);
        this.saveLocally();
        if (IS_DEV) {
            console.log(`Added ${book.volumeInfo.title} to ${shelf}`);
        }
        if (typeof window.logReadingActivity === 'function') {
            window.logReadingActivity('add', `Added "${book.volumeInfo.title}" to ${shelf}`);
        }

        // 2. Update Backend
        const user = this.getUser();
        if (user) {
            try {
                const payload = {
                    user_id: user.id,
                    google_books_id: book.id,
                    title: book.volumeInfo.title,
                    authors: book.volumeInfo.authors ? book.volumeInfo.authors.join(", ") : "",
                    thumbnail: book.volumeInfo.imageLinks ? book.volumeInfo.imageLinks.thumbnail : "",
                    shelf_type: shelf
                };

                const res = await fetch(`${this.apiBase}/library`, {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    // Store the DB ID and version back to the local object
                    enrichedBook.db_id = data.item.id;
                    enrichedBook.version = data.item.version;
                    this.saveLocally();
                    await this.updateSyncStatus();
                }
            } catch (e) {
                console.error("Failed to save to backend", e);
                await this._queueMutation('add', enrichedBook, { shelf });
                showToast("Saved locally; sync queued", "info");
            }
        }
    }


    async updateBook(id, updates) {
        const result = this.findBookInShelf(id);
        if (!result) return;

        const { shelf, book } = result;

        // 1. Update Local State
        Object.assign(book, updates);

        // Local "Finished" logic
        if (updates.progress === 100 && shelf !== 'finished') {
            // Remove from current, add to finished
            this.library[shelf] = this.library[shelf].filter(b => b.id !== id);
            this.library.finished.push(book);
            showToast(`Congrats! You finished ${book.volumeInfo.title}!`, "success");
            if (typeof window.logReadingActivity === 'function') {
                window.logReadingActivity('finish', `Finished reading "${book.volumeInfo.title}"`);
            }
        }

        this.saveLocally();

        // 2. Update Backend
        const user = this.getUser();
        if (user && book.db_id) {
            try {
                const res = await fetch(`${this.apiBase}/library/${book.db_id}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    credentials: 'include',
                    body: JSON.stringify({
                        ...updates,
                        version: book.version // Optimistic locking
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    book.version = data.item.version;
                    this.saveLocally();
                    await this.updateSyncStatus();
                } else if (res.status === 409) {
                    const data = await res.json();
                    showToast("Conflict detected! Syncing with server...", "error");
                    // Optionally show a more detailed merge UI here
                    await this.syncWithBackend();
                } else {
                    const data = await res.json();
                    console.error("Update failed:", data.error);
                }
            } catch (e) {
                console.error("Failed to update backend", e);
                await this._queueMutation('update', book, { updates });
                showToast("Saved locally; sync queued", "info");
            }
        }
    }


    findBook(id) {
        for (const shelf in this.library) {
            if (this.library[shelf].some(b => b.id === id)) return true;
        }
        return false;
    }

    findBookShelf(id) {
        for (const shelf in this.library) {
            if (this.library[shelf].some(b => b.id === id)) return shelf;
        }
        return null;
    }

    findBookInShelf(id) {
        for (const shelf in this.library) {
            const book = this.library[shelf].find(b => b.id === id);
            if (book) return { shelf, book };
        }
        return null;
    }

    getShelfBooks(shelf) {
        return Array.isArray(this.library[shelf]) ? [...this.library[shelf]] : [];
    }

    getLibrarySnapshot() {
        return {
            current: this.getShelfBooks('current'),
            want: this.getShelfBooks('want'),
            finished: this.getShelfBooks('finished')
        };
    }

    async removeBook(id) {
        const result = this.findBookInShelf(id);
        if (result) {
            const { shelf, book } = result;

            // 1. Update Local
            this.library[shelf] = this.library[shelf].filter(b => b.id !== id);
            this.saveLocally();
            if (IS_DEV) {
                console.log(`Removed book ${id} from ${shelf}`);
            }

            // 2. Update Backend
            const user = this.getUser();
            // We need the DB ID to delete from backend usually, 
            // but our remove_from_library endpoint uses item_id (DB ID).
            // Do we have it?
            if (user && book.db_id) {
                try {
                    await fetch(`${this.apiBase}/library/${book.db_id}`, {
                        method: 'DELETE',
                        headers: this.getAuthHeaders(),
                        credentials: 'include'
                    });
                    await this.updateSyncStatus();
                } catch (e) {
                    console.error("Failed to delete from backend", e);
                    await this._queueMutation('remove', book, { shelf });
                    showToast("Removed locally; sync queued", "info");
                }
            } else if (user) {
                // Fallback: If we don't have db_id locally (maybe added before login logic), 
                // we might need to look it up or accept that local-only items can't be remotely deleted easily
                // without an API change to delete by google_id.
                // For MVP, we proceed.
                console.warn("Could not delete from backend: missing db_id");
            }

            return true;
        }
        return false;
    }

    async moveBook(id, toShelf) {
        const result = this.findBookInShelf(id);
        if (!result) return false;

        const { shelf: fromShelf, book } = result;
        if (fromShelf === toShelf) return true;
        if (!this.library[toShelf]) return false;

        this.library[fromShelf] = this.library[fromShelf].filter(b => b.id !== id);

        if (toShelf === 'finished' && book.progress !== 100) {
            book.progress = 100;
        } else if (toShelf === 'current' && (book.progress == null || book.progress === 100)) {
            book.progress = 0;
        }

        this.library[toShelf].push(book);
        this.saveLocally();

        const user = this.getUser();
        if (user && book.db_id) {
            try {
                const res = await fetch(`${this.apiBase}/library/${book.db_id}`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    credentials: 'include',
                    body: JSON.stringify({
                        shelf_type: toShelf,
                        progress: book.progress,
                        version: book.version
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    book.version = data.item.version;
                    this.saveLocally();
                    await this.updateSyncStatus();
                } else if (res.status === 409) {
                    showToast("Conflict detected! Syncing with server...", "error");
                    await this.syncWithBackend();
                    return false;
                } else {
                    const data = await res.json();
                    console.error("Move failed:", data.error);
                }
            } catch (e) {
                console.error("Failed to update backend during move", e);
                await this._queueMutation('move', book, { fromShelf, toShelf });
                showToast("Moved locally; sync queued", "info");
            }
        }

        await this.updateSyncStatus();
        return true;
    }

    saveLocally() {
        SafeStorage.set(this.storageKey, JSON.stringify(this.library));
    }

    async renderShelf(shelfName, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;
        const books = this.library[shelfName];
        if (books.length === 0) {
            // If we have no books, ensure empty state is visible (if we cleared it previously)
            container.innerHTML = '<div class="empty-state">This shelf is empty.</div>';
            return;
        }

        // Clear container for re-rendering (essential for sorting)
        container.innerHTML = '';

        try {
            for (const book of books) {
                const renderer = new BookRenderer(this);
                const el = await renderer.createBookElement(book, shelfName);
                container.appendChild(el);
            }
        } catch (error) {
            console.error(`[Library] Error rendering shelf ${shelfName}:`, error);
        }
    }
}


