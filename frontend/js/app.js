import { CollectionAPI, verifyStoredAuthSession, renderAuthNavigation, loadConfig } from './app/api.js';
import { SafeStorage } from './app/storage.js';
import { BookRenderer } from './app/bookRenderer.js';
import { SearchFilterManager } from './app/searchFilter.js';
import { LibraryManager } from './app/libraryManager.js';
import { ThemeManager } from './app/themeManager.js';
import { GenreManager } from './app/genreManager.js';

// Attach to window for global access by inline scripts
window.CollectionAPI = CollectionAPI;
window.verifyStoredAuthSession = verifyStoredAuthSession;
window.renderAuthNavigation = renderAuthNavigation;
window.SafeStorage = SafeStorage;
window.BookRenderer = BookRenderer;
window.LibraryManager = LibraryManager;
window.ThemeManager = ThemeManager;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 BiblioDrift Initializing...');

    // 1. Initialize Managers
    const libManager = new LibraryManager();
    window.libManager = libManager;
    window.dispatchEvent(new CustomEvent('bibliodrift:library-manager-ready', {
        detail: { libraryManager: libManager }
    }));
    libManager.ready().then(() => {
        window.dispatchEvent(new CustomEvent('bibliodrift:library-manager-synced', {
            detail: { libraryManager: libManager }
        }));
    });

    window.renderer = new BookRenderer(libManager);
    const themeManager = new ThemeManager();

    // 2. Load Config (Non-blocking)
    loadConfig();



    // --- AUTH LOGIC ---
    const toggleLink = document.getElementById('toggleText');
    const authTitle = document.getElementById('authTitle');
    const authBtn = document.getElementById('submitBtn');
    const authForm = document.getElementById('authForm');
    const nameField = document.getElementById('nameField');

    if (toggleLink && authTitle && authBtn && authForm) {
        let isLogin = true;
        authForm.dataset.mode = 'login';

        toggleLink.addEventListener('click', () => {
            isLogin = !isLogin;
            
            if (!isLogin) {
                // Switch to Register Mode
                authForm.dataset.mode = 'register';
                authTitle.textContent = 'Create Account';
                authBtn.textContent = 'Sign Up';
                toggleLink.textContent = 'Already have an account? Sign in.';
                if (nameField) nameField.style.display = 'block';
            } else {
                // Switch to Login Mode
                authForm.dataset.mode = 'login';
                authTitle.textContent = 'Welcome Back';
                authBtn.textContent = 'Sign In';
                toggleLink.textContent = 'No account? Create one.';
                if (nameField) nameField.style.display = 'none';
            }
        });
    }

    const genreManager = new GenreManager(libManager);
    genreManager.init();
    const exportBtn = document.getElementById("export-library");
    if (exportBtn) {
        const isLibraryPage = document.getElementById("shelf-want");
        exportBtn.style.display = isLibraryPage ? "inline-flex" : "none";

        exportBtn.addEventListener("click", () => {
            const library = SafeStorage.get("bibliodrift_library");
            if (!library) {
                showToast("Library is empty!", "info");
                return;
            }
            const blob = new Blob([library], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `bibliodrift_library_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
            showToast("Library exported successfully!", "success");
        });
    }



    const verifiedUser = await verifyStoredAuthSession();
    const isLoggedIn = !!verifiedUser;
    const authLink = document.getElementById('navAuthLink');
    const tooltip = document.getElementById('navAuthTooltip');
    renderAuthNavigation(authLink, tooltip, isLoggedIn);

    // Redirect if already logged in and on the sign-in page
    if (verifiedUser && window.location.pathname.endsWith('auth.html')) {
        window.location.href = 'profile.html';
        return;
    }

    if (verifiedUser) {
        await libManager.syncWithBackend();
    }

    const searchInput = document.getElementById('searchInput');
    const searchIcon = document.querySelector('.search-bar .search-icon');

    const performSearch = () => {
        if (searchInput && searchInput.value.trim()) {
            // Only redirect to discovery search if we're not already on the library page 
            // where search is handled by the local library filter.
            if (!window.location.pathname.includes('library.html')) {
                window.location.href = `index.html?q=${encodeURIComponent(searchInput.value.trim())}`;
            }
        }
    };

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }

    if (searchIcon) {
        searchIcon.style.cursor = 'pointer';
        searchIcon.addEventListener('click', performSearch);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');

    // Fill search box if query exists
    if (query && searchInput) {
        searchInput.value = query;
    }

    if (query && document.getElementById('search-results-section')) {
        const searchSection = document.getElementById('search-results-section');
        const queryDisplay = document.getElementById('search-query-display');
        
        queryDisplay.textContent = `Results for "${query}"`;
        searchSection.removeAttribute('hidden');
        
        // Hide other main content to focus on search without destroying modals
        document.querySelectorAll('.curated-section:not(#search-results-section), .hero').forEach(el => {
            el.style.display = 'none';
        });

        renderer.renderCuratedSection(query, 'search-results-grid', 20);
    } else if (document.getElementById('row-rainy')) {
        console.log('📚 Initializing Curated Discovery Sections...');
        const discoveryShelves = [
            { type: 'query', query: 'subject:mystery atmosphere', elementId: 'row-rainy' },
            { type: 'query', query: 'authors:arundhati roy|subject:india', elementId: 'row-indian' },
            { type: 'query', query: 'subject:classic fiction', elementId: 'row-classics' },
           {
                 type: 'query',
                 query: 'subject:gothic fiction subject:dark academia subject:campus',
                 elementId: 'row-dark-academia',
                 vibeDescription: 'gothic, intellectual, melancholic, and candlelit',
                 fallbackQuery: 'subject:gothic fiction subject:campus'
            },
            { type: 'query', query: 'subject:fiction', elementId: 'row-fiction' }
        ];
        (async () => {
            try {
                for (const shelf of discoveryShelves) {
                    if (shelf.type === 'category') {
                        await renderer.renderMoodCategorySection(shelf, shelf.elementId);
                    } else {
                        await renderer.renderCuratedSection(shelf.query, shelf.elementId);
                    }
                    await delay(500);
                }
                console.log('✅ Discovery shelves populated.');
            } catch (err) {
                console.error('❌ Critical error during shelf initialization:', err);
            }
        })();
    }

    // Re-rendering is now handled by libManager.init() asynchronously to ensure
    // data is loaded from IndexedDB backup if LocalStorage was wiped.
    // if (document.getElementById('shelf-want')) {
    //     libManager.renderShelf('want', 'shelf-want');
    //     libManager.renderShelf('current', 'shelf-current');
    //     libManager.renderShelf('finished', 'shelf-finished');
    // }


    // Check if Profile Page
    if (document.getElementById('profile-page')) {
        const user = verifiedUser;
        if (!user) {
            window.location.href = 'auth.html';
            return;
        }

        // populate User Info
        document.getElementById('profile-username').textContent = user.username || 'Bookworm';
        document.getElementById('profile-email').textContent = user.email || '';
        document.getElementById('profile-joined').textContent = user.created_at ? new Date(user.created_at).getFullYear() : '2024';

        // populate Stats
        const currentCount = libManager.library.current?.length || 0;
        const wantCount = libManager.library.want?.length || 0;
        const finishedCount = libManager.library.finished?.length || 0;

        const totalBooks = currentCount + wantCount + finishedCount;

        // Vibe/Genre calculation
        const allBooks = [
            ...(libManager.library.current || []),
            ...(libManager.library.want || []),
            ...(libManager.library.finished || [])
        ];
        
        const categoryCounts = {};
        allBooks.forEach(book => {
            const categories = book.volumeInfo?.categories || [];
            categories.forEach(cat => {
                categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
            });
        });
        
        let topVibe = 'Mystery'; // Fallback
        if (Object.keys(categoryCounts).length > 0) {
            topVibe = Object.keys(categoryCounts).reduce((a, b) => categoryCounts[a] > categoryCounts[b] ? a : b);
        } else if (totalBooks === 0) {
            topVibe = '-';
        }

        const statTotalEl = document.getElementById('stat-total');
        const statWantDashEl = document.getElementById('stat-want-dash');
        const statVibeEl = document.getElementById('stat-vibe');
        
        if (statTotalEl) statTotalEl.textContent = totalBooks;
        if (statWantDashEl) statWantDashEl.textContent = wantCount;
        if (statVibeEl) statVibeEl.textContent = topVibe;

        // Initialize Extended Stats (Goals, Streak, Leaderboard)
        const currentYear = new Date().getFullYear();
        if (document.getElementById('current-year-display')) {
            document.getElementById('current-year-display').textContent = currentYear;
        }

        const loadExtendedStats = async () => {
            const token = SafeStorage.get('bibliodrift_token');
            if (!token) return;

            try {
                // Fetch Stats & Goals
                const statsResponse = await fetch(`${MOOD_API_BASE}/stats?user_id=${user.id}&year=${currentYear}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (statsResponse.ok) {
                    const stats = await statsResponse.json();
                    
                    // Update Streak
                    if (stats.current_streak > 0) {
                        const streakBadge = document.getElementById('streak-badge');
                        const streakCount = document.getElementById('streak-count');
                        if (streakBadge && streakCount) {
                            streakBadge.style.display = 'inline-block';
                            streakCount.textContent = stats.current_streak;
                        }
                    }

                    // Update Goal Progress
                    if (stats.goal) {
                        const progressText = document.getElementById('goal-progress-text');
                        const barGoal = document.getElementById('bar-goal');
                        const target = stats.goal.target_books || 0;
                        const completed = stats.books_this_year || 0;

                        if (progressText) progressText.textContent = `${completed} / ${target} books`;
                        if (barGoal && target > 0) {
                            barGoal.style.width = `${Math.min(100, (completed / target) * 100)}%`;
                        }
                    } else {
                        const progressText = document.getElementById('goal-progress-text');
                        if (progressText) progressText.textContent = 'No goal set for this year';
                    }
                }

                // Fetch Leaderboard
                const lbResponse = await fetch(`${MOOD_API_BASE}/stats/leaderboard?year=${currentYear}&limit=5`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (lbResponse.ok) {
                    const leaderboard = await lbResponse.json();
                    const lbSection = document.getElementById('leaderboard-section');
                    const lbList = document.getElementById('leaderboard-list');
                    
                    if (leaderboard && leaderboard.length > 0 && lbSection && lbList) {
                        lbSection.style.display = 'block';
                        lbList.innerHTML = leaderboard.map((entry, index) => `
                            <div class="leaderboard-entry" style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid var(--border-color); ${entry.user_id === user.id ? 'background: rgba(139, 115, 85, 0.1); border-radius: 8px;' : ''}">
                                <div style="display: flex; align-items: center; gap: 15px;">
                                    <span style="font-weight: bold; min-width: 25px;">#${index + 1}</span>
                                    <span>${entry.username} ${entry.user_id === user.id ? '(You)' : ''}</span>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 600;">${entry.total_books} books</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${entry.total_pages.toLocaleString()} pages</div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } catch (error) {
                console.error('Error loading extended stats:', error);
            }
        };

        // Goal Editing Logic
        const editGoalBtn = document.getElementById('edit-goal-btn');
        const saveGoalBtn = document.getElementById('save-goal-btn');
        const goalInput = document.getElementById('goal-input');
        const goalEditGroup = document.getElementById('goal-edit-group');

        if (editGoalBtn) {
            editGoalBtn.addEventListener('click', () => {
                goalEditGroup.style.display = goalEditGroup.style.display === 'none' ? 'flex' : 'none';
                if (goalEditGroup.style.display === 'flex') goalInput.focus();
            });
        }

        if (saveGoalBtn) {
            saveGoalBtn.addEventListener('click', async () => {
                const target = parseInt(goalInput.value);
                if (isNaN(target) || target < 1) return;

                const token = SafeStorage.get('bibliodrift_token');
                try {
                    const response = await fetch(`${MOOD_API_BASE}/stats/goal`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            user_id: user.id,
                            year: currentYear,
                            target_books: target
                        })
                    });

                    if (response.ok) {
                        goalEditGroup.style.display = 'none';
                        loadExtendedStats(); // Refresh
                    }
                } catch (error) {
                    console.error('Failed to save goal:', error);
                }
            });
        }

        loadExtendedStats();

        // Progress Bar Calculation
        const barFinished = document.getElementById('bar-finished');
        const barCurrent = document.getElementById('bar-current');
        const barWant = document.getElementById('bar-want');
        
        const countFinishedEl = document.getElementById('count-finished');
        const countCurrentEl = document.getElementById('count-current');
        const countWantEl = document.getElementById('count-want');
        
        if (countFinishedEl) countFinishedEl.textContent = finishedCount;
        if (countCurrentEl) countCurrentEl.textContent = currentCount;
        if (countWantEl) countWantEl.textContent = wantCount;
        
        if (totalBooks > 0) {
            setTimeout(() => {
                if (barFinished) barFinished.style.width = `${(finishedCount / totalBooks) * 100}%`;
                if (barCurrent) barCurrent.style.width = `${(currentCount / totalBooks) * 100}%`;
                if (barWant) barWant.style.width = `${(wantCount / totalBooks) * 100}%`;
            }, 100);
        }

        // =====================================================================
        // READING PROGRESS OVERVIEW
        // Renders a progress card for each book currently being read.
        // =====================================================================
        const progressGrid = document.getElementById('progress-overview-grid');
        if (progressGrid) {
            const currentBooks = libManager.library.current || [];
            if (currentBooks.length === 0) {
                progressGrid.innerHTML = '<div class="empty-state"><p>No books currently in progress. <a href="library.html">Visit your library</a> to start reading.</p></div>';
            } else {
                progressGrid.innerHTML = '';
                currentBooks.forEach(book => {
                    const title = book.volumeInfo?.title || book.title || 'Untitled';
                    const author = (book.volumeInfo?.authors?.[0]) || book.author || 'Unknown Author';
                    const cover = book.volumeInfo?.imageLinks?.thumbnail || book.cover || '';
                    const progress = typeof book.progress === 'number' ? book.progress : 0;

                    const card = document.createElement('div');
                    card.className = 'progress-overview-card';
                    card.innerHTML = `
                        <div class="progress-card-cover">
                            ${cover ? `<img src="${cover.replace('http:', 'https:')}" alt="${title}" loading="lazy">` : '<i class="fa-solid fa-book"></i>'}
                        </div>
                        <div class="progress-card-info">
                            <div class="progress-card-title">${title}</div>
                            <div class="progress-card-author">${author}</div>
                            <div class="progress-card-bar-wrap">
                                <div class="progress-card-bar-track">
                                    <div class="progress-card-bar-fill" style="width:${progress}%"></div>
                                </div>
                                <span class="progress-card-pct">${progress}%</span>
                            </div>
                            <div class="progress-card-quick-update">
                                <input type="range" min="0" max="100" value="${progress}"
                                    class="progress-card-slider"
                                    aria-label="Update reading progress for ${title}">
                                <button class="progress-card-save-btn" data-book-id="${book.id}">
                                    <i class="fa-solid fa-floppy-disk"></i>
                                </button>
                            </div>
                        </div>
                    `;

                    // Wire up the quick-update slider
                    const slider = card.querySelector('.progress-card-slider');
                    const barFill = card.querySelector('.progress-card-bar-fill');
                    const pctLabel = card.querySelector('.progress-card-pct');
                    const saveBtn = card.querySelector('.progress-card-save-btn');

                    slider.addEventListener('input', () => {
                        const val = parseInt(slider.value);
                        barFill.style.width = `${val}%`;
                        pctLabel.textContent = `${val}%`;
                    });

                    saveBtn.addEventListener('click', async () => {
                        const newProgress = parseInt(slider.value);
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                        try {
                            await libManager.updateBook(book.id, { progress: newProgress });
                            book.progress = newProgress;
                            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                            saveBtn.style.background = '#4caf50';
                            setTimeout(() => {
                                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
                                saveBtn.style.background = '';
                                saveBtn.disabled = false;
                            }, 2000);
                        } catch (err) {
                            saveBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
                            saveBtn.style.background = '#e53935';
                            setTimeout(() => {
                                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>';
                                saveBtn.style.background = '';
                                saveBtn.disabled = false;
                            }, 2000);
                        }
                    });

                    progressGrid.appendChild(card);
                });
            }
        }

        // Populate Achievements
        const achievementsGrid = document.getElementById('achievements-grid');
        achievementsGrid.innerHTML = '';

        const achievements = [
            { id: 'reader', icon: 'fa-book', title: 'Avid Reader', desc: 'Finished 5 books', condition: finishedCount >= 5 },
            { id: 'collector', icon: 'fa-layer-group', title: 'Curator', desc: 'Added 10 books', condition: (currentCount + wantCount + finishedCount) >= 10 },
            { id: 'critic', icon: 'fa-pen-fancy', title: 'Critic', desc: 'Saved 3 reviews', condition: false }, // Mock
            { id: 'focused', icon: 'fa-glasses', title: 'Focused', desc: 'Reading 3 at once', condition: currentCount >= 3 }
        ];

        achievements.forEach(ach => {
            const card = document.createElement('div');
            card.className = `achievement-card ${ach.condition ? 'unlocked' : 'locked'}`;
            card.innerHTML = `
                <i class="fa-solid ${ach.icon}"></i>
                <h4>${ach.title}</h4>
                <p>${ach.desc}</p>
            `;
            achievementsGrid.appendChild(card);
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            try {
                // Clear backend cookies
                await fetch(`${MOOD_API_BASE}/logout`, { method: 'POST', credentials: 'include' });
            } catch (e) {
                console.warn("Backend logout failed", e);
            }
            SafeStorage.remove('bibliodrift_user');
            SafeStorage.remove('bibliodrift_token');
            SafeStorage.remove('isLoggedIn');
            window.location.href = 'index.html';
        });
    }
    // Scroll Manager (Back to Top)
    const backToTopBtn = document.getElementById('backToTop');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 200) {
                backToTopBtn.classList.remove('hidden');
            } else {
                backToTopBtn.classList.add('hidden');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }


});

/**
 * ==============================================================================
 * SECURITY FIX: CSRF PROTECTION & SESSION MANAGEMENT
 * ==============================================================================
 * 
 * Issue:
 * ------
 * The auth form has no CSRF protection — it directly POSTs credentials to the API 
 * from the browser.
 * 
 * Why it matters:
 * ---------------
 * Without a CSRF token, a malicious third-party page could trick authenticated 
 * users into making authenticated requests. Also, isLoggedIn was previously stored 
 * as a plain string 'true' in localStorage, meaning any script could forge the 
 * login state by setting this key.
 * 
 * Fix:
 * ----
 * Move the authenticated session indicator to an HttpOnly cookie managed by the 
 * backend, and validate the JWT on every protected API call (which is already 
 * done server-side — the frontend just needs to stop relying on the localStorage 
 * flag for access control decisions).
 * ==============================================================================
 */
async function handleAuth(event) {
    event.preventDefault();
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]') || document.getElementById('submitBtn');
    const originalText = btn ? btn.innerHTML : (form.dataset.mode === 'register' ? 'Sign Up' : 'Sign In');

    // 1. Immediate UI Feedback: Disable button and show loading state
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
    }

    // Determine mode from dataset (set by our toggle logic) or default to login
    const mode = form.dataset.mode || 'login';

    const email = document.getElementById("email").value;
    const password = form.querySelector('input[type="password"]').value;
    const usernameInput = document.getElementById("username");

    // Helper to reset button state on failure
    const resetBtn = () => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    };

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        if (typeof showToast === 'function') showToast("Enter a valid email address", "error");
        else alert("Enter a valid email address");
        resetBtn();
        return;
    }

    // Demo bypass logic
    if (email === 'demo@bibliodrift.com') {
        const demoUser = { id: 1, username: 'Demo User', email: 'demo@bibliodrift.com' };
        SafeStorage.set('bibliodrift_user', JSON.stringify(demoUser));
        SafeStorage.set('isLoggedIn', 'true');
        SafeStorage.set('bibliodrift_token', 'demo-token-12345');
        
        if (typeof showToast === 'function')
            showToast(`Welcome, Demo User!`, "success");

        // Keep button disabled during redirect delay
        setTimeout(() => {
            window.location.href = "library.html";
        }, 1000);
        return;
    }

    // Prepare Payload
    let payload = {};
    let endpoint = "";

    if (mode === 'register') {
        const username = usernameInput ? usernameInput.value : email.split('@')[0];
        endpoint = '/register';
        payload = { username, email, password };
    } else {
        endpoint = '/login';
        payload = { username: email, password: password };
    }

    // =========================================================================
    // SECURITY ENHANCEMENT: CSRF TOKEN INTEGRATION
    // =========================================================================
    // We retrieve the CSRF token from the hidden input field 'csrf_token'.
    // This token is then injected into the 'X-CSRF-Token' header. 
    // The Flask-WTF backend expects this header for all state-changing
    // AJAX requests. This protects against Cross-Site Request Forgery 
    // by ensuring that the request is authenticated via the browser's 
    // Same-Origin Policy and session-bound secrets.
    // =========================================================================
    const csrfToken = document.getElementById('csrf_token')?.value;

    try {
        const fetchOptions = {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        };

        // Inject CSRF token into headers if available
        if (csrfToken) {
            fetchOptions.headers['X-CSRF-Token'] = csrfToken;
        } else if (IS_DEV) {
            console.warn('[Security] No CSRF token found in DOM. Request may be rejected by server.');
        }

        const res = await fetch(`${MOOD_API_BASE}${endpoint.replace('/api/v1', '')}`, fetchOptions);

        const data = await res.json();

        if (res.ok) {
            // Success!
            // Token is now in an HttpOnly cookie (managed by backend)
            SafeStorage.set('bibliodrift_user', JSON.stringify(data.user));
            SafeStorage.set('isLoggedIn', 'true');

            if (typeof showToast === 'function')
                showToast(`${mode === 'login' ? 'Welcome back' : 'Welcome'}, ${data.user.username}!`, "success");

            // SYNC LOGIC
            if (window.libManager) {
                if (typeof showToast === 'function') showToast("Syncing your library...", "info");
                await window.libManager.syncLocalToBackend(data.user);
            }

            // Redirect - Button remains disabled
            setTimeout(() => {
                window.location.href = "library.html";
            }, 1000);
        } else {
            // Authentication failed - re-enable button
            if (typeof showToast === 'function') showToast(data.error || "Authentication failed", "error");
            else alert(data.error || "Authentication failed");
            resetBtn();
        }
    } catch (e) {
        console.error("Auth Error", e);
        if (typeof showToast === 'function') showToast("Server connection failed", "error");
        else alert("Server connection failed");
        resetBtn();
    }
}


function enableTapEffects() {
    if (!('ontouchstart' in window)) return;

    document.querySelectorAll('.btn-icon').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('tap-btn-icon');
        });
    });


    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            link.classList.toggle('tap-nav-link');
        });
    });

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            themeToggle.classList.toggle('tap-theme-toggle');
        });
    }

    const backTop = document.querySelector('.back-to-top');
    if (backTop) {
        backTop.addEventListener('click', () => {
            backTop.classList.toggle('tap-back-to-top');
        });
    }


    document.querySelectorAll('.social_icons a').forEach(icon => {
        icon.addEventListener('click', () => {
            icon.classList.toggle('tap-social-icon');
        });
    });
}

enableTapEffects();

// --- creak and page flip effects ---
const pageFlipSound = new Audio('../assets/sounds/page-flip.mp3');
pageFlipSound.preload = 'auto';
pageFlipSound.volume = 0.2;
pageFlipSound.muted = true;

document.addEventListener('click', () => {
    pageFlipSound.play().catch(() => {});
}, { once: true });


document.addEventListener("click", (e) => {
    const scene = e.target.closest(".book-scene");
    if (!scene) return;

    if (IS_DEV) {
        console.log("BOOK CLICK");
    }

    const book = scene.querySelector(".book");
    const overlay = scene.querySelector(".glass-overlay");

    pageFlipSound.muted = false;

    pageFlipSound.pause();
    pageFlipSound.currentTime = 0;
    book.classList.toggle("tap-effect");
    if (overlay) overlay.classList.toggle("tap-overlay");
});
// ============================================
// Keyboard Shortcuts Module (Issue #103)
// ============================================
// Provides keyboard navigation and interaction
// with BiblioDrift library and book management

const KeyboardShortcuts = {
    // Shortcut configuration mapping
    shortcuts: {
        'j': { action: 'navigateNext', description: 'Navigate to next book' },
        'k': { action: 'navigatePrev', description: 'Navigate to previous book' },
        'Enter': { action: 'selectBook', description: 'Select/open current book' },
        'a': { action: 'addToWantRead', description: 'Add to Want to Read' },
        'r': { action: 'markCurrentlyReading', description: 'Mark as Currently Reading' },
        'f': { action: 'addToFavorites', description: 'Add to Favorites' },
        'Escape': { action: 'closeModal', description: 'Close popup/modal' },
        '?': { action: 'showHelpMenu', description: 'Show keyboard shortcuts help' },
        '/': { action: 'focusSearch', description: 'Focus search bar' }
    },

    // Initialize keyboard event listener
    init() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        if (IS_DEV) {
            console.log('BiblioDrift Keyboard Shortcuts Initialized');
        }
    },


    // Handle keypress events
    handleKeyPress(event) {
        // Don't trigger shortcuts when typing in input fields
        if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
            return;
        }

        const key = event.key;
        const shortcut = this.shortcuts[key];

        if (shortcut) {
            event.preventDefault();
            this.executeAction(shortcut.action);
        }
    },

    // Execute action based on shortcut
    executeAction(action) {
        switch (action) {
            case 'navigateNext':
                if (IS_DEV) {
                    console.log('Navigating to next book...');
                }
                this.navigateToNextBook();
                break;
            case 'navigatePrev':
                if (IS_DEV) {
                    console.log('Navigating to previous book...');
                }
                this.navigateToPreviousBook();
                break;
            case 'selectBook':
                if (IS_DEV) {
                    console.log('Selecting current book...');
                }
                this.selectCurrentBook();
                break;
            case 'addToWantRead':
                if (IS_DEV) {
                    console.log('Adding to Want to Read list...');
                }
                this.moveCurrentBookToShelf('want');
                break;
            case 'markCurrentlyReading':
                if (IS_DEV) {
                    console.log('Marking as Currently Reading...');
                }
                this.moveCurrentBookToShelf('current');
                break;
            case 'addToFavorites':
                if (IS_DEV) {
                    console.log('Adding to Favorites...');
                }
                this.moveCurrentBookToShelf('finished');
                break;
            case 'closeModal':
                if (IS_DEV) {
                    console.log('Closing modal...');
                }
                const modals = document.querySelectorAll('.modal, [role="dialog"]');
                modals.forEach(modal => modal.style.display = 'none');
                break;
            case 'showHelpMenu':
                if (IS_DEV) {
                    console.log('Showing help menu...');
                }
                this.displayHelpMenu();
                break;
            case 'focusSearch':
                if (IS_DEV) {
                    console.log('Focusing search bar...');
                }
                const searchInput = document.querySelector('input[type="search"], input.search, [placeholder*="search" i]');
                if (searchInput) searchInput.focus();
                break;
        }
    },

    // Display keyboard shortcuts help menu
    displayHelpMenu() {
        const helpContent = Object.entries(this.shortcuts)
            .map(([key, data]) => `<strong>${key}</strong>: ${data.description}`)
            .join('<br/>');

        alert('BiblioDrift Keyboard Shortcuts\n\n' +
            Object.entries(this.shortcuts)
                .map(([key, data]) => `${key}: ${data.description}`)
                .join('\n'));
    },

    // Helper: Get all visible book spine elements
    getVisibleBooks() {
        return Array.from(document.querySelectorAll('.book-spine-3d'));
    },

    // Helper: Get current focused book index
    getFocusedBookIndex() {
        const books = this.getVisibleBooks();
        const focused = document.querySelector('.book-spine-3d.focused');
        if (focused) {
            return books.indexOf(focused);
        }
        return -1;
    },

    // Helper: Set focus on a book spine
    setBookFocus(bookElement) {
        // Remove previous focus
        document.querySelectorAll('.book-spine-3d.focused').forEach(el => {
            el.classList.remove('focused');
        });

        if (bookElement) {
            bookElement.classList.add('focused');
            bookElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

            // Get the book data from the element
            const bookId = bookElement.dataset.bookId;
            if (window.bookshelfRenderer && bookId) {
                const storage = window.libManager?.getLibrarySnapshot?.() || { current: [], want: [], finished: [] };
                for (const shelf of ['current', 'want', 'finished']) {
                    const book = storage[shelf].find(b => b.id === bookId);
                    if (book) {
                        window.bookshelfRenderer.currentBook = book.volumeInfo ? {
                            id: book.id,
                            title: book.volumeInfo.title || 'Untitled',
                            author: (book.volumeInfo.authors && book.volumeInfo.authors[0]) || 'Unknown',
                            cover: book.volumeInfo.imageLinks?.thumbnail || '',
                            description: book.volumeInfo.description || '',
                            rating: book.volumeInfo.averageRating || 0,
                            ratingCount: book.volumeInfo.ratingsCount || 0,
                            categories: book.volumeInfo.categories || [],
                            moods: book.moods || [],
                            reviews: []
                        } : book;
                        break;
                    }
                }
            }
        }
    },

    // Navigate to next book
    navigateToNextBook() {
        const books = this.getVisibleBooks();
        if (books.length === 0) {
            showToast('No books to navigate', 'info');
            return;
        }

        let currentIndex = this.getFocusedBookIndex();
        let nextIndex = (currentIndex + 1) % books.length;

        this.setBookFocus(books[nextIndex]);
    },

    // Navigate to previous book
    navigateToPreviousBook() {
        const books = this.getVisibleBooks();
        if (books.length === 0) {
            showToast('No books to navigate', 'info');
            return;
        }

        let currentIndex = this.getFocusedBookIndex();
        let prevIndex = currentIndex <= 0 ? books.length - 1 : currentIndex - 1;

        this.setBookFocus(books[prevIndex]);
    },

    // Select/open the current book
    selectCurrentBook() {
        if (window.bookshelfRenderer && window.bookshelfRenderer.currentBook) {
            window.bookshelfRenderer.openModal(window.bookshelfRenderer.currentBook);
            showToast('Opening book details', 'info');
        } else {
            showToast('No book selected', 'info');
        }
    },

    // Move current book to a specific shelf
    moveCurrentBookToShelf(targetShelf) {
        if (!window.bookshelfRenderer || !window.bookshelfRenderer.currentBook) {
            showToast('No book selected', 'info');
            return;
        }

        const currentBook = window.bookshelfRenderer.currentBook;
        const storage = window.libManager?.getLibrarySnapshot?.() || { current: [], want: [], finished: [] };

        // Find current shelf
        let currentShelf = null;
        for (const shelf of ['current', 'want', 'finished']) {
            const found = storage[shelf].find(b => b.id === currentBook.id);
            if (found) {
                currentShelf = shelf;
                break;
            }
        }

        if (!currentShelf) {
            showToast('Book not found in library', 'error');
            return;
        }

        if (currentShelf === targetShelf) {
            showToast('Book is already on that shelf', 'info');
            return;
        }

        // Move the book
        window.bookshelfRenderer.moveBook(currentBook.id, currentShelf, targetShelf);

        // Show appropriate feedback
        const shelfNames = {
            'current': 'Currently Immersed',
            'want': 'Anticipated Journeys',
            'finished': 'Lifetime Favorites'
        };

        showToast(`Moved to ${shelfNames[targetShelf]}`, 'success');
    }
};

// Initialize keyboard shortcuts when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KeyboardShortcuts.init());
} else {
    KeyboardShortcuts.init();
}
// Register Service Worker for offline asset caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('BiblioDrift Service Worker registered successfully!', reg))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}
// --- Connection Management & Offline Fallback Fallback Hooks ---

// Function to automatically track network status changes
function handleConnectivityChange() {
    const offlineIndicator = document.getElementById('offline-indicator');
    
    if (!navigator.onLine) {
        console.warn("🌐 Connection dropped. Switching to local sanctuary archives...");
        
        // Show an elegant banner to let the user know they are reading offline
        if (offlineIndicator) {
            offlineIndicator.style.display = 'block';
        }
        
        // Fall back to loading cached books from IndexedDB
        triggerOfflineLibraryView();
    } else {
        console.log("🌐 Connection restored! Connected back to the live backend cloud server.");
        if (offlineIndicator) {
            offlineIndicator.style.display = 'none';
        }
        
        // Reload live API content if the user comes back online
        if (typeof loadDiscoverBooks === 'function') {
            loadDiscoverBooks();
        }
    }
}

// Fallback logic to retrieve data from Dexie when offline
async function triggerOfflineLibraryView() {
    // Look up the database instance initialized on the global window context
    if (!window.db) {
        console.error("Database layer is missing from window.db context.");
        return;
    }

    try {
        const savedBooks = await window.db.books.toArray();
        // Target your bookshelf or matching layout grid element from the page markup
        const libraryContainer = document.getElementById('search-results-grid') || document.querySelector('.bookshelf');
        
        if (!libraryContainer) return;

        if (savedBooks.length === 0) {
            // Friendly empty state UI explaining how to save books
            libraryContainer.innerHTML = `
                <div class="offline-empty-state" style="grid-column: 1/-1; text-align: center; color: #a0a0a0; padding: 3rem 1rem;">
                    <p style="font-size: 1.5rem; margin-bottom: 0.5rem;">✨ You are wandering offline</p>
                    <p style="font-size: 1rem; opacity: 0.8;">No cached books found on your shelf. Save books while online to read them anywhere.</p>
                </div>`;
        } else {
            libraryContainer.innerHTML = ""; // Wipe standard layout containers
            
            // Render cached items back onto the UI shelf
            savedBooks.forEach(book => {
                const bookCard = document.createElement('div');
                bookCard.className = 'book-card offline-card';
                bookCard.innerHTML = `
                    <div class="book-cover-wrapper">
                        <img src="${book.coverUrl || '../assets/images/default-cover.png'}" alt="${book.title}" class="book-cover-img" />
                    </div>
                    <div class="book-details">
                        <h3>${book.title}</h3>
                        <p class="author-tag">By ${book.author}</p>
                        <p class="offline-summary">${book.content}</p>
                        <span class="offline-badge" style="background: #2c3e50; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">Saved Offline</span>
                    </div>
                `;
                libraryContainer.appendChild(bookCard);
            });
        }
    } catch (error) {
        console.error("Failed to load local offline assets:", error);
    }
}

// Attach network listeners directly to the window lifecycle
window.addEventListener('online', handleConnectivityChange);
window.addEventListener('offline', handleConnectivityChange);

// Run a status check right away on startup in case the user loads the app while already disconnected
document.addEventListener('DOMContentLoaded', handleConnectivityChange);