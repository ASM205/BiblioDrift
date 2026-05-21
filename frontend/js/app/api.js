import { SafeStorage } from './storage.js';

/**
 * ==============================================================================
 * BiblioDrift Core Logic - Main Application Entry Point
 * ==============================================================================
 *
 * Overview:
 * ---------
 * This file serves as the primary orchestrator for the BiblioDrift application.
 * It ties together the DOM manipulation, state management, 3D rendering interactions,
 * and API communications (both Google Books API and our custom Python backend).
 *
 * Key Components:
 * ---------------
 * 1. SafeStorage:
 *    A robust wrapper around `localStorage` with an `IndexedDB` fallback mechanism.
 *    This component is critical for offline-first capabilities and prevents the
 *    entire app from crashing when iOS/Safari or restrictive browser quotas prevent
 *    standard `localStorage` operations.
 *    - Automatically handles QuotaExceeded exceptions.
 *    - Provides asynchronous data restoration algorithms.
 *    - Integrates closely with the LibraryManager to store thousands of books safely.
 *
 * 2. LibraryManager:
 *    The central state machine over the user's book collection.
 *    - Shelf Types: Manages three distinctive shelves: 'want', 'current', 'finished'.
 *    - Concurrency Control: Handles race conditions when syncing local states with
 *      the backend utilizing optimistic locking techniques.
 *    - Merging Strategy: In the event of a conflict between the client data and
 *      server data, it attempts a non-destructive merge, retaining the state with
 *      the highest integer version map.
 *
 * 3. BookRenderer:
 *    An interface bridge to the DOM. Handles instantiation of HTML templates for
 *    individual 3D book instances, binding their unique event listeners, and
 *    applying their generated CSS styles and thematic properties.
 *    It integrates directly with `LibraryManager` to reflect real-time progress updates.
 *
 * 4. ThemeManager:
 *    Observes User Preferences and seamlessly toggles the UI's color palette between
 *    predefined themes (e.g., dark mode and light mode, wood mode), persisting
 *    these preferences to SafeStorage for a seamless experience across reloads.
 *
 * API Architecture Details:
 * -------------------------
 * - Google Books API: Facilitates the search and retrieval of rich book metadata
 *   including volume summaries, author info, and high-quality thumbnail images.
 * - Local Proxy/Backend: Certain complex interactions such as Machine Learning
 *   sentiment analysis (fetchAIVibe) are offloaded to `MOOD_API_BASE` to bypass
 *   client-side compute limitations and securely handle secret API keys.
 *
 * Security & Data Integrity Considerations:
 * -----------------------------------------
 * - Data Sanitization: All text rendered from external APIs is strictly passed
 *   through the `escapeHTML` utility safely converting brackets to entities to
 *   prevent XSS (Cross-Site Scripting) vectors.
 * - CSRF Protection: Interacts closely with the server-supplied `csrf_access_token`
 *   to securely validate state-mutating requests (POST, PUT, DELETE) preventing
 *   Cross Site Request Forgery attacks against logged-in users.
 *
 * Coding Standards and Development Guidelines:
 * --------------------------------------------
 * 1. Offline-First Philosophy: Ensure that actions (add, remove, update) are
 *    optimistically applied to local state before waiting for server resolution.
 * 2. Safe Storage Wrapper: Always use `SafeStorage.set()` instead of native
 *    `localStorage.setItem()`.
 * 3. Centralized Styling: For broad CSS manipulations, modify standard tokens in
 *    `index.css` rather than directly overriding inline styles to maintain a
 *    dynamic and cohesive theme strategy.
 *
 * File Structure:
 * ---------------
 * - [000-100]: Initialization and Utility Wrappers
 * - [100-300]: SafeStorage Implementation
 * - [300-800]: BookRenderer Class and 3D interactions
 * - [800-1300]: LibraryManager state machine and synchronization
 * - [1300+]: UI Controllers, Events, and Application Bootstrap
 * ==============================================================================
 */

// API_BASE and MOOD_API_BASE are declared globally in config.js (loaded first).
// Do NOT re-declare them here — use the globals from config.js directly.
const IS_DEV = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const moodAnalysisCache = new Map();

export const delay = (ms) => new Promise((res) => setTimeout(res, ms));

let GOOGLE_API_KEY = '';

/**
 * Utility to extract a cookie value by name.
 */
export function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

export async function loadConfig() {
    try {
        const res = await fetch(`${MOOD_API_BASE}/config`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            GOOGLE_API_KEY = data.google_books_key || '';
            if (window.GoogleBooksClient) {
                window.GoogleBooksClient.setKeys([
                    data.google_books_key,
                    data.google_books_key_secondary,
                ]);
            }
            if (IS_DEV) {
                console.log('Config loaded');
            }
        }
    } catch (e) {
        console.warn('Failed to load backend config', e);
    }
}

export const CollectionAPI = {
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const csrf = getCookie('csrf_access_token');
        if (csrf) {
            headers['X-CSRF-TOKEN'] = csrf;
        }
        return headers;
    },
    async createCollection(userId, name, description = '', isPublic = false) {
        const res = await fetch(`${MOOD_API_BASE}/api/v1/collections`, {
            method: 'POST',
            headers: this.getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ user_id: parseInt(userId), name, description, is_public: isPublic })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },
    async getCollections(userId) {
        const res = await fetch(`${MOOD_API_BASE}/api/v1/collections?user_id=${userId}`, {
            method: 'GET',
            headers: this.getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.collections || [];
    },
    async getCollection(id) {
        const res = await fetch(`${MOOD_API_BASE}/api/v1/collections/${id}`, {
            method: 'GET',
            headers: this.getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        return data.collection;
    },
    async updateCollection(id, name, description, isPublic) {
        const payload = {};
        if (name !== undefined) payload.name = name;
        if (description !== undefined) payload.description = description;
        if (isPublic !== undefined) payload.is_public = isPublic;

        const res = await fetch(`${MOOD_API_BASE}/api/v1/collections/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },
    async deleteCollection(id) {
        const res = await fetch(`${MOOD_API_BASE}/api/v1/collections/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },
    async addBookToCollection(collectionId, userId, bookId, title, authors = '', thumbnail = '') {
        const res = await fetch(`${MOOD_API_BASE}/api/v1/collections/${collectionId}/books`, {
            method: 'POST',
            headers: this.getHeaders(),
            credentials: 'include',
            body: JSON.stringify({
                user_id: parseInt(userId),
                google_books_id: bookId,
                title: title,
                authors: Array.isArray(authors) ? authors.join(', ') : authors,
                thumbnail: thumbnail
            })
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },
    async removeBookFromCollection(collectionId, bookId) {
        const res = await fetch(`${MOOD_API_BASE}/api/v1/collections/${collectionId}/books/${bookId}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
            credentials: 'include'
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}`);
        }
        return await res.json();
    }
};


// Example click handler for your custom "Save for Offline" icon
export async function handleDownloadToggle(bookCard, bookData) {
    const isAlreadyDownloaded = await window.db.downloadedBooks.get(bookData.id);
    
    if (isAlreadyDownloaded) {
        const success = await window.removeOfflineBook(bookData.id);
        if (success) bookCard.classList.remove('is-downloaded');
    } else {
        const success = await window.saveBookOffline(bookData);
        if (success) bookCard.classList.add('is-downloaded');
    }
}
// Toast Notification Helper
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function clearStoredAuthState() {
    SafeStorage.remove('bibliodrift_user');
    SafeStorage.remove('bibliodrift_token');
    SafeStorage.remove('isLoggedIn');
    authSessionPromise = null;
}

export function parseStoredUser() {
    const userStr = SafeStorage.get('bibliodrift_user');
    if (!userStr) return null;

    try {
        return JSON.parse(userStr);
    } catch (error) {
        return null;
    }
}

export function renderAuthNavigation(authLink, tooltip, isAuthenticated) {
    if (!authLink) return;

    if (isAuthenticated) {
        authLink.innerHTML = '<i class="fa-solid fa-user"></i> Profile';
        authLink.href = 'profile.html';
        authLink.classList.remove('active');
        authLink.setAttribute('aria-label', 'View profile');
        if (tooltip) tooltip.innerHTML = '<i class="fa-solid fa-id-card"></i> View Profile';
        return;
    }

    authLink.textContent = 'Sign In';
    authLink.href = 'auth.html';
    if (tooltip) tooltip.innerHTML = '<i class="fa-solid fa-key"></i> Access account';
}

let authSessionPromise = null;

export async function verifyStoredAuthSession() {
    if (authSessionPromise) {
        return authSessionPromise;
    }

    authSessionPromise = (async () => {
        const token = SafeStorage.get('bibliodrift_token');
        const storedUser = parseStoredUser();
        const thinksLoggedIn = SafeStorage.get('isLoggedIn') === 'true';

        if (token === 'demo-token-12345') {
            return storedUser;
        }

        // Real logins use HttpOnly JWT cookies (see backend JWT_TOKEN_LOCATION). Optional CSRF cookie is readable by JS.
        const shouldProbe = thinksLoggedIn || storedUser || getCookie('csrf_access_token');
        if (!shouldProbe) {
            return null;
        }

        try {
            const headers = {
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            };
            const csrf = getCookie('csrf_access_token');
            if (csrf) {
                headers['X-CSRF-TOKEN'] = csrf;
            }

            const response = await fetch(`${MOOD_API_BASE}/auth/verify`, {
                credentials: 'include',
                headers,
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                const verifiedUser = data.user || storedUser;
                if (verifiedUser) {
                    SafeStorage.set('bibliodrift_user', JSON.stringify(verifiedUser));
                }
                SafeStorage.set('isLoggedIn', 'true');
                return verifiedUser || null;
            }

            if (response.status === 401 || response.status === 422) {
                clearStoredAuthState();
            }
            return null;
        } catch (error) {
            console.warn('Auth verification failed; using cached session state if available.', error);
            return storedUser;
        }
    })();

    return authSessionPromise;
}




/**
 * Robust Wrapper for Storage (LocalStorage + IndexedDB Fallback)
 * Prevents application data loss and handles browser storage wipes/quotas.
 */
