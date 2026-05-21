import { showToast, CollectionAPI } from './api.js';
import { SafeStorage } from './storage.js';

export class BookRenderer {
    constructor(libraryManager = null) {
        this.libraryManager = libraryManager;
    }

    renderSkeletons(container, count = 5, type = 'card') {
        if (!container) return;
        let html = '';
        if (type === 'card') {
            html = Array(count).fill(0).map(() => `
                <div class="book-skeleton skeleton"></div>
            `).join('');
        } else if (type === 'spine') {
            html = Array(count).fill(0).map(() => `
                <div class="spine-skeleton skeleton"></div>
            `).join('');
        }
        container.innerHTML = html;
    }

    async createBookElement(bookData, shelf = null) {
        const { id, volumeInfo } = bookData;
        const progress = typeof bookData.progress === 'number' ? bookData.progress : 0;
        const title = volumeInfo.title || "Untitled";
        const authors = volumeInfo.authors ? volumeInfo.authors.join(", ") : "Unknown Author";
        const thumb = volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : 'https://via.placeholder.com/128x196?text=No+Cover';
        const originalDescription = volumeInfo.description ? volumeInfo.description.substring(0, 100) + "..." : "A mysterious tome waiting to be opened.";
        const categories = volumeInfo.categories || [];

        const vibe = this.generateVibe(originalDescription, categories);
        const spineColors = ['#5D4037', '#4E342E', '#3E2723', '#2C2420', '#8D6E63'];
        const randomSpine = spineColors[Math.floor(Math.random() * spineColors.length)];
        const cleanId = title.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        const spineImagePath = `assets/images/${cleanId}_spine.jpg`;

        const scene = document.createElement('div');
        scene.className = 'book-scene';

        // Load flip sound
        const flipSound = new Audio('../assets/sounds/page-flip.mp3');
        flipSound.preload = 'auto';
        flipSound.volume = 0.5;

        const escapeHTML = (str) => {
            if (!str) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        };

        const safeTitle = escapeHTML(title);
        const safeAuthors = escapeHTML(authors);
        const safeOriginalDescription = escapeHTML(originalDescription);
        const safeVibe = escapeHTML(vibe);
        const safeThumb = escapeHTML(thumb.replace('http:', 'https:'));

        scene.innerHTML = `
            <div class="book" data-id="${escapeHTML(id)}">
                <div class="book__face book__face--front">
                    <img src="${safeThumb}" alt="${safeTitle}">
                </div>
                <div class="book__face book__face--spine" style="background: ${randomSpine}"></div>
                <div class="book__face book__face--right"></div>
                <div class="book__face book__face--top"></div>
                <div class="book__face book__face--bottom"></div>
                <div class="book__face book__face--back">
                    <div style="overflow-y: auto; height: 100%; padding-right: 5px; scrollbar-width: thin;">
                        <div style="font-weight: bold; font-size: 0.9rem; margin-bottom: 0.5rem; color: #2c2420;">${safeTitle}</div>
                        <div class="handwritten-note" style="margin-bottom: 0.8rem; font-style: italic; color: #5d4037;">${safeVibe}</div>
                        ${bookData.moods && bookData.moods.length > 0 ? `
                        <div class="book-mood-tags" style="margin-bottom: 0.8rem; display: flex; flex-wrap: wrap; gap: 4px;">
                            ${bookData.moods.map(m => `<span style="font-size: 0.6rem; background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 10px;"><i class="fa-solid ${this.getMoodIcon(m)}"></i> ${m}</span>`).join('')}
                        </div>
                        ` : ''}
                    </div>

                    <button class="read-details-btn" title="Read Details">
                        <i class="fa-solid fa-circle-info"></i> Read Details
                    </button>

                    ${shelf === 'current' ? `
                    <div class="reading-progress">
                        <input type="range" min="0" max="100" value="${progress}" class="progress-slider" />
                        <small>${progress}% read</small>
                    </div>` : ''}
                    <div class="book-actions">
                        <button class="btn-icon add-btn" title="Add to Library"><i class="fa-regular fa-heart"></i></button>
                        <button class="btn-icon share-btn" title="Share Book"><i class="fa-solid fa-share-nodes"></i></button>
                        <button class="btn-icon mood-btn" title="Explore Mood"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
                        <button class="btn-icon flip-back-btn" title="Flip Back"><i class="fa-solid fa-rotate-left"></i></button>
                    </div>
                </div>
            </div>
        <div class="book-pages-3d"></div>
    <div class="glass-overlay">
        <strong>${safeTitle}</strong><br><small>${safeAuthors}</small>
    </div>
`;

        // Interaction: Progress Slider
        const slider = scene.querySelector('.progress-slider');
        if (slider) {
            slider.addEventListener('change', (e) => {
                const newProgress = parseInt(e.target.value);
                if (this.libraryManager) {
                    this.libraryManager.updateBook(id, { progress: newProgress });
                }
                // Update small tag
                const small = slider.nextElementSibling;
                if (small) small.textContent = `${newProgress}% read`;
            });
        }

        // Interaction: Flip
        const bookEl = scene.querySelector('.book');
        scene.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-icon') && !e.target.closest('.reading-progress')) {
                if (bookEl) {
                    bookEl.classList.toggle('flipped');
                }
                // Play sound
                flipSound.play().catch(e => {
                    if (IS_DEV) {
                        console.log("Audio play failed", e);
                    }
                });
            }
        });

        // Interaction: Add to Library Logic
        const addBtn = scene.querySelector('.add-btn');
        const updateBtn = () => {
            addBtn.innerHTML = this.libraryManager.findBook(id) ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-regular fa-heart"></i>';
        };
        updateBtn();

        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.libraryManager.findBook(id)) {
                this.libraryManager.removeBook(id);
            } else {
                this.libraryManager.addBook(bookData, shelf || 'want');
            }
            updateBtn();
        });

        // Info Button
        scene.querySelector('.read-details-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openModal(bookData);
        });

        // Share Button
        scene.querySelector('.share-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const shareText = `Check out this book: ${title} by ${authors}`;
            navigator.clipboard.writeText(shareText).then(() => {
                showToast('Book details copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                showToast('Failed to copy book details.', 'error');
            });
        });

        // Explore Mood Button
        scene.querySelector('.mood-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.exploreBookMood(title, authors);
        });

        // Flip Back Button
        scene.querySelector('.flip-back-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            bookEl.classList.remove('flipped');
            flipSound.play().catch(err => {
                if (IS_DEV) {
                    console.log("Audio play failed", err);
                }
            });
        });

        // Async fetch AI Vibe - Hydrate the UI
        this.fetchAIVibe(title, authors, volumeInfo.description || "").then(aiVibe => {
            if (aiVibe) {
                // Strip any accidental prefix the AI might return
                const cleanVibe = aiVibe.replace(/^(Bookseller's Note:|Note:|Recommendation:)\s*/i, "");

                const noteEl = scene.querySelector('.handwritten-note');
                if (noteEl) {
                    noteEl.innerHTML = cleanVibe;
                    noteEl.classList.add('fade-in'); // Optional animation hook
                }
            }
        });

        return scene;
    }

    async fetchAIVibe(title, author, description) {
        try {
            const res = await fetch(`${MOOD_API_BASE}/generate-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ title, author, description })
            });
            if (res.ok) {
                const data = await res.json();
                const payload = data.data || data;
                return payload?.vibe || payload?.bookseller_note || payload?.insight || payload?.note || null;
            }
        } catch (e) {
            // Silently fail to use fallback
        }
        return null;
    }

    async fetchAIBlurb(bookId, title, author, description, categories = []) {
        try {
            const res = await fetch(`${MOOD_API_BASE}/generate-note`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ bookId, title, author, description, categories })
            });
            if (res.ok) {
                const data = await res.json();
                return data.data?.blurb || null;
            }
        } catch (e) {
            // Silently fail to use fallback
        }
        return null;
    }

    async fetchMoodTags(title, author) {
        try {
            const csrfToken = getCookie('csrf_access_token');
            const headers = { 'Content-Type': 'application/json' };
            if (csrfToken) {
                headers['X-CSRF-TOKEN'] = csrfToken;
            }
            const res = await fetch(`${MOOD_API_BASE}/mood-tags`, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify({ title, author })
            });
            return res;
        } catch (e) {
            console.error("fetchMoodTags error", e);
            return null;
        }
    }

    generateVibe(text, categories = []) {
        // Fallback vibes if AI hasn't loaded yet.
        const lowerText = text.toLowerCase();
        const lowerCats = categories.join(' ').toLowerCase();

        // 1. Context-aware fallbacks
        if (lowerCats.includes('classic') || lowerText.includes('classic')) return "A timeless tale that defined a genre.";
        if (lowerCats.includes('romance') || lowerText.includes('love')) return "A heartwarming story of connection.";
        if (lowerCats.includes('mystery') || lowerText.includes('murder') || lowerText.includes('detective')) return "Full of twists that keep you guessing.";
        if (lowerCats.includes('fantasy') || lowerText.includes('magic')) return "A magical escape to another world.";
        if (lowerCats.includes('fiction') || lowerText.includes('novel')) return "A compelling narrative voice.";
        if (lowerCats.includes('history') || lowerText.includes('war')) return "A journey into the past.";
        if (lowerCats.includes('science') || lowerText.includes('space')) return "Opens your mind to new possibilities.";

        // 2. Generic fallbacks (Deterministic hash)
        const vibes = [
            "Perfect for a rainy afternoon.",
            "A quiet companion for coffee.",
            "Intense and thought-provoking.",
            "Will make you laugh and cry.",
            "Best devoured in one sitting.",
            "Prepare to be surprised."
        ];

        // Simple hash to pick a stable vibe for this book text
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }

        return vibes[Math.abs(hash) % vibes.length];
    }

    openModal(book) {
        const modal = document.getElementById('book-details-modal');
        if (!modal) return;

        document.getElementById('modal-img').src = book.volumeInfo.imageLinks?.thumbnail.replace('http:', 'https:') || '';
        document.getElementById('modal-title').textContent = book.volumeInfo.title;
        document.getElementById('modal-author').textContent = book.volumeInfo.authors?.join(", ") || "Unknown Author";
        
        const summaryEl = document.getElementById('modal-summary');
        if (summaryEl) {
            // Show skeletons while AI is "thinking"
            summaryEl.innerHTML = `
                <div class="text-skeleton skeleton"></div>
                <div class="text-skeleton skeleton" style="width: 90%"></div>
            `;

            // Fetch the AI vibe to populate the Insight box
            this.fetchAIVibe(book.volumeInfo.title, book.volumeInfo.authors?.join(", ") || "", book.volumeInfo.description || "").then(vibe => {
                if (vibe) {
                    const cleanVibe = vibe.replace(/^(Bookseller's Note:|Note:|Recommendation:)\s*/i, "");
                    summaryEl.innerHTML = `<p class="fade-in">${cleanVibe}</p>`;
                } else {
                    // Fallback to description if AI vibe fails
                    summaryEl.textContent = book.volumeInfo.description || "No description available.";
                }
            });
        }

        const addBtn = document.getElementById('modal-add-btn');
        const shareBtn = document.getElementById('modal-share-btn');
        const isInLibrary = this.libraryManager && typeof this.libraryManager.findBook === 'function' && this.libraryManager.findBook(book.id);

        if (addBtn) {
            addBtn.onclick = null;
            addBtn.classList.toggle('library-remove-btn', isInLibrary);
            addBtn.innerHTML = isInLibrary
                ? '<i class="fa-solid fa-trash"></i> Remove from Library'
                : '<i class="fa-regular fa-heart"></i> Add to Library';

            addBtn.onclick = async () => {
                if (!this.libraryManager) return;

                if (isInLibrary) {
                    if (confirm('Are you sure you want to remove this book from your library?')) {
                        await this.libraryManager.removeBook(book.id);
                        modal.close();
                    }
                    return;
                }

                await this.libraryManager.addBook(book, 'want');
                addBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Remove from Library';
                addBtn.classList.add('library-remove-btn');
            };
        }

        if (shareBtn) {
            shareBtn.onclick = () => {
                const shareText = `Check out this book: ${book.volumeInfo.title} by ${book.volumeInfo.authors?.join(", ") || "Unknown Author"}`;
                navigator.clipboard.writeText(shareText).then(() => {
                    showToast('Book title and author copied!', 'success');
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                    showToast('Failed to copy book details.', 'error');
                });
            };
        }

        // Preview Button — opens the Google Books Embedded Viewer
        const previewBtn = document.getElementById('modal-preview-btn');
        if (previewBtn) {
            previewBtn.onclick = () => {
                if (window.BookPreview && book.id) {
                    window.BookPreview.open(book.id, book.volumeInfo.title || 'Book Preview');
                }
            };
        }

        // Fetch and render purchase links
        const purchaseLinksEl = document.getElementById('modal-purchase-links');
        if (purchaseLinksEl) {
            purchaseLinksEl.innerHTML = '<div class="text-skeleton skeleton" style="width: 100%; height: 30px;"></div>';
            
            const title = encodeURIComponent(book.volumeInfo.title || '');
            const author = encodeURIComponent(book.volumeInfo.authors ? book.volumeInfo.authors[0] : '');
            let isbn = '';
            if (book.volumeInfo.industryIdentifiers) {
                const identifier = book.volumeInfo.industryIdentifiers.find(i => i.type === 'ISBN_13' || i.type === 'ISBN_10');
                if (identifier) isbn = encodeURIComponent(identifier.identifier);
            }
            
            fetch(`${MOOD_API_BASE}/books/purchase-links?title=${title}&author=${author}&isbn=${isbn}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.links && data.links.length > 0) {
                        const linksHtml = data.links.map(link => {
                            return `<a href="${link.url}" target="_blank" class="purchase-link-btn" style="background-color: ${link.color || 'var(--wood-dark)'}; color: white; padding: 5px 10px; border-radius: 5px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; margin-right: 5px; margin-bottom: 5px; font-size: 0.85rem;">
                                <i class="${link.icon || 'fa-solid fa-book'}"></i> ${link.name}
                            </a>`;
                        }).join('');
                        purchaseLinksEl.innerHTML = linksHtml;
                    } else {
                        purchaseLinksEl.innerHTML = '<p class="modal-subtitle" style="margin: 0; font-size: 0.85rem; opacity: 0.7;">No purchase links available.</p>';
                    }
                })
                .catch(err => {
                    console.error('Failed to load purchase links', err);
                    purchaseLinksEl.innerHTML = '<p class="modal-subtitle" style="margin: 0; font-size: 0.85rem; opacity: 0.7;">Failed to load purchase links.</p>';
                });
        // Explore Mood Button
        const moodBtnModal = document.getElementById('modal-mood-btn');
        if (moodBtnModal) {
            moodBtnModal.onclick = () => {
                this.exploreBookMood(book.volumeInfo.title, book.volumeInfo.authors?.join(", ") || "");
            };
        }

        modal.showModal();
        document.getElementById('closeModalBtn').onclick = () => modal.close();

        // Emotion Tagging UI
        const emotionContainer = document.createElement('div');
        emotionContainer.className = 'emotion-tagging-section';
        emotionContainer.innerHTML = `
            <h3 class="modal-section-title" style="color: var(--text-main); font-family: 'Playfair Display', serif; font-size: 1rem; margin-bottom: 10px;">How does this book make you feel?</h3>
            <div class="emotion-tags-container">
                ${['Melancholic', 'Cozy', 'Tense', 'Inspiring', 'Whimsical', 'Dark', 'Adventurous'].map(mood => {
            const isActive = book.moods && book.moods.includes(mood);
            return `<span class="emotion-tag ${isActive ? 'active' : ''}" data-mood="${mood}" style="color: var(--text-main); border-color: var(--control-border);">
                        <i class="fa-solid ${this.getMoodIcon(mood)}"></i> ${mood}
                    </span>`;
        }).join('')}
            </div>
        `;
        // Insert before the buttons
        const modalBody = modal.querySelector('.modal-body') || modal.querySelector('.book-details-content');
        const actions = modal.querySelector('.modal-actions') || modal.querySelector('.book-actions-section');
        
        if (actions) {
            // Remove existing tagging section if re-opening
            const existing = actions.parentNode.querySelector('.emotion-tagging-section');
            if (existing) existing.remove();
            
            actions.parentNode.insertBefore(emotionContainer, actions);
        } else if (modalBody) {
            // Fallback
            const existing = modalBody.querySelector('.emotion-tagging-section');
            if (existing) existing.remove();
            modalBody.appendChild(emotionContainer);
        }

        // Add tag toggle listeners
        emotionContainer.querySelectorAll('.emotion-tag').forEach(tag => {
            tag.onclick = async () => {
                const mood = tag.dataset.mood;
                if (!book.moods) book.moods = [];

                const index = book.moods.indexOf(mood);
                if (index > -1) {
                    book.moods.splice(index, 1);
                    tag.classList.remove('active');
                } else {
                    book.moods.push(mood);
                    tag.classList.add('active');
                }

                if (this.libraryManager) {
                    await this.libraryManager.updateBook(book.id, { moods: book.moods });
                }
            };
        });

        // Custom Collections Section
        let collectionsSection = document.getElementById('modal-discovery-collections-tagging');
        if (!collectionsSection) {
            collectionsSection = document.createElement('div');
            collectionsSection.id = 'modal-discovery-collections-tagging';
            collectionsSection.className = 'collections-tagging-section';
            collectionsSection.style.cssText = 'margin-top: 15px; margin-bottom: 15px; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);';
        }
        
        if (actions) {
            const existing = actions.parentNode.querySelector('#modal-discovery-collections-tagging');
            if (existing) existing.remove();
            actions.parentNode.insertBefore(collectionsSection, actions);
        } else if (modalBody) {
            const existing = modalBody.querySelector('#modal-discovery-collections-tagging');
            if (existing) existing.remove();
            modalBody.appendChild(collectionsSection);
        }

        const userObj = typeof parseStoredUser === 'function' ? parseStoredUser() : null;
        if (!userObj) {
            collectionsSection.innerHTML = `
                <h4 style="margin: 0 0 5px 0; color: var(--accent-gold); font-family: 'Playfair Display', serif; font-size: 0.95rem;">Save in Custom Collections</h4>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;"><a href="auth.html" style="color: var(--accent-gold); text-decoration: underline;">Sign in</a> to save this book in custom shelves.</p>
            `;
        } else {
            collectionsSection.innerHTML = `
                <h4 style="margin: 0 0 8px 0; color: var(--accent-gold); font-family: 'Playfair Display', serif; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-folder-open"></i> Add to Custom Collections
                </h4>
                <div id="modal-discovery-collections-list" style="display: flex; flex-direction: column; gap: 6px; max-height: 120px; overflow-y: auto; padding-right: 4px;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Retrieving collections...</span>
                </div>
            `;
            
            (async () => {
                try {
                    const cols = await window.CollectionAPI.getCollections(userObj.id);
                    const listEl = document.getElementById('modal-discovery-collections-list');
                    if (!listEl) return;
                    
                    if (cols.length === 0) {
                        listEl.innerHTML = `
                            <span style="font-size: 0.8rem; color: var(--text-muted);">No custom collections created yet. Go to Custom Collections view to create one!</span>
                        `;
                        return;
                    }
                    
                    const colsWithItems = await Promise.all(
                        cols.map(async (c) => {
                            try {
                                return await window.CollectionAPI.getCollection(c.id);
                            } catch (e) {
                                return { id: c.id, name: c.name, items: [] };
                            }
                        })
                    );
                    
                    listEl.innerHTML = '';
                    colsWithItems.forEach(col => {
                        const existingItem = col.items.find(item => item.google_books_id === book.id);
                        const isChecked = !!existingItem;
                        const label = document.createElement('label');
                        label.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-main); cursor: pointer; user-select: none; margin-bottom: 4px;';
                        
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.checked = isChecked;
                        checkbox.style.cssText = 'cursor: pointer; width: 15px; height: 15px; margin: 0;';
                        
                        if (isChecked) {
                            checkbox.dataset.bookId = existingItem.book_id;
                        }
                        
                        checkbox.onchange = async () => {
                            checkbox.disabled = true;
                            try {
                                if (checkbox.checked) {
                                    const authorStr = Array.isArray(book.volumeInfo.authors) ? book.volumeInfo.authors.join(', ') : (book.volumeInfo.authors || 'Unknown Author');
                                    const res = await window.CollectionAPI.addBookToCollection(
                                        col.id,
                                        userObj.id,
                                        book.id,
                                        book.volumeInfo.title,
                                        authorStr,
                                        book.volumeInfo.imageLinks?.thumbnail || ''
                                    );
                                    checkbox.dataset.bookId = res.item.book_id;
                                    showToast(`Added to "${col.name}"`, 'success');
                                } else {
                                    const bookId = checkbox.dataset.bookId;
                                    if (bookId) {
                                        await window.CollectionAPI.removeBookFromCollection(col.id, bookId);
                                        delete checkbox.dataset.bookId;
                                        showToast(`Removed from "${col.name}"`, 'success');
                                    }
                                }
                            } catch (err) {
                                checkbox.checked = !checkbox.checked; // Revert
                                showToast(err.message, 'error');
                            } finally {
                                checkbox.disabled = false;
                            }
                        };
                        
                        label.appendChild(checkbox);
                        
                        const textSpan = document.createElement('span');
                        textSpan.textContent = col.name;
                        label.appendChild(textSpan);
                        
                        listEl.appendChild(label);
                    });
                } catch (e) {
                    console.error('Modal collections load failed', e);
                    const listEl = document.getElementById('modal-discovery-collections-list');
                    if (listEl) {
                        listEl.innerHTML = `<span style="font-size: 0.8rem; color: #e53935;">Failed to load collections.</span>`;
                    }
                }
            })();
        }
    }
    }

    async exploreBookMood(title, author) {
        const cacheKey = `${title.toLowerCase().trim()}|${(author || '').toLowerCase().trim()}`;
        
        // 1. Create and show the mood modal dynamically
        let modal = document.getElementById('mood-analysis-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'mood-analysis-modal';
            modal.className = 'mood-modal';
            document.body.appendChild(modal);
        } else {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }

        const escapeHTML = (str) => {
            if (!str) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        };

        modal.innerHTML = `
            <div class="mood-modal-content">
                <div class="mood-modal-header">
                    <h3>Mood Deep-Dive: ${escapeHTML(title)}</h3>
                    <button class="close-modal" id="close-mood-modal">&times;</button>
                </div>
                <div class="mood-modal-body">
                    <div id="mood-modal-loader" class="mood-loading-section" style="text-align: center; padding: 2rem;">
                        <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--accent-gold); margin-bottom: 1rem;"></i>
                        <p style="color: var(--text-muted); font-size: 0.9rem;">Scraping GoodReads reviews & analyzing sentiment...</p>
                    </div>
                    <div id="mood-modal-error" class="mood-error-section hidden" style="text-align: center; padding: 2rem;">
                        <i class="fa-solid fa-triangle-exclamation fa-2x" style="color: #f44336; margin-bottom: 1rem;"></i>
                        <p id="mood-error-message" style="color: var(--text-main); font-size: 0.95rem;"></p>
                    </div>
                    <div id="mood-modal-results" class="mood-results-section hidden">
                        <div class="mood-section">
                            <h4>Primary Moods</h4>
                            <div class="mood-tags-large" id="mood-modal-tags" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0.5rem;">
                                <!-- Mood tags go here -->
                            </div>
                        </div>
                        <div class="mood-section" style="margin-top: 1.5rem;">
                            <h4>Overall Sentiment</h4>
                            <div class="sentiment-bar">
                                <div class="sentiment-fill" id="mood-modal-sentiment-fill" style="width: 0%;"></div>
                            </div>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;" id="mood-modal-sentiment-desc"></p>
                        </div>
                        <div class="mood-section" style="margin-top: 1.5rem;">
                            <h4>Bookseller's Vibe</h4>
                            <div class="vibe-quote" id="mood-modal-vibe" style="margin-top: 0.5rem;">
                                <!-- Vibe quote goes here -->
                            </div>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-align: right; margin-top: 1.5rem;" id="mood-modal-meta">
                            <!-- Meta info goes here -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        const closeModal = () => {
            modal.style.display = 'none';
            modal.classList.add('hidden');
        };

        modal.querySelector('#close-mood-modal').onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        const showLoader = () => {
            modal.querySelector('#mood-modal-loader').classList.remove('hidden');
            modal.querySelector('#mood-modal-error').classList.add('hidden');
            modal.querySelector('#mood-modal-results').classList.add('hidden');
        };

        const showError = (msg) => {
            modal.querySelector('#mood-modal-loader').classList.add('hidden');
            modal.querySelector('#mood-modal-error').classList.remove('hidden');
            modal.querySelector('#mood-modal-error p').textContent = msg;
            modal.querySelector('#mood-modal-results').classList.add('hidden');
        };

        const renderResults = (analysis) => {
            modal.querySelector('#mood-modal-loader').classList.add('hidden');
            modal.querySelector('#mood-modal-error').classList.add('hidden');
            const resultsSection = modal.querySelector('#mood-modal-results');
            resultsSection.classList.remove('hidden');

            // Render primary moods
            const tagsContainer = modal.querySelector('#mood-modal-tags');
            tagsContainer.innerHTML = '';
            if (analysis.primary_moods && analysis.primary_moods.length > 0) {
                analysis.primary_moods.forEach(moodObj => {
                    const moodVal = moodObj.mood;
                    const confidence = moodObj.confidence;
                    const tag = document.createElement('span');
                    const moodClass = `mood-${moodVal.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
                    tag.className = `mood-tag-large ${moodClass}`;
                    tag.innerHTML = `<i class="fa-solid ${this.getMoodIcon(moodVal)}"></i> ${escapeHTML(moodVal)} (${Math.round(confidence * 100)}%)`;
                    tagsContainer.appendChild(tag);
                });
            } else {
                tagsContainer.innerHTML = '<span style="font-size: 0.9rem; color: var(--text-muted);">No distinct moods detected.</span>';
            }

            // Render sentiment bar
            const compoundScore = analysis.overall_sentiment?.compound_score || 0;
            const percentage = Math.round(((compoundScore + 1) / 2) * 100);
            modal.querySelector('#mood-modal-sentiment-fill').style.width = `${percentage}%`;
            modal.querySelector('#mood-modal-sentiment-desc').textContent = `${analysis.mood_description || 'Sentiment analyzed successfully.'} (Score: ${compoundScore.toFixed(2)})`;

            // Render vibe
            modal.querySelector('#mood-modal-vibe').innerHTML = `<p>${escapeHTML(analysis.bibliodrift_vibe || 'A quiet read with deep undertones.')}</p>`;

            // Render metadata
            const totalReviews = analysis.total_reviews_analyzed || 0;
            const confidenceScore = analysis.analysis_confidence ? Math.round(analysis.analysis_confidence * 100) : 50;
            modal.querySelector('#mood-modal-meta').textContent = `Analyzed ${totalReviews} Goodreads reviews. Vibe confidence: ${confidenceScore}%.`;
        };

        // 2. Fetch or load from cache
        if (moodAnalysisCache.has(cacheKey)) {
            if (IS_DEV) console.log(`Cache hit for mood analysis: ${cacheKey}`);
            renderResults(moodAnalysisCache.get(cacheKey));
            return;
        }

        showLoader();

        try {
            const csrf = getCookie('csrf_access_token');
            const headers = { 'Content-Type': 'application/json' };
            if (csrf) {
                headers['X-CSRF-TOKEN'] = csrf;
            }

            const res = await fetch(`${MOOD_API_BASE}/analyze-mood`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ title, author })
            });

            if (res.ok) {
                const data = await res.json();
                const analysis = data.data?.mood_analysis || data.mood_analysis;
                if (analysis && analysis.success) {
                    moodAnalysisCache.set(cacheKey, analysis);
                    renderResults(analysis);
                } else {
                    showError(analysis?.error || 'Could not parse mood analysis for this book.');
                }
            } else {
                if (res.status === 429) {
                    const data = await res.json().catch(() => ({}));
                    const retryAfter = data.retry_after || 60;
                    showError(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
                } else if (res.status === 503) {
                    showError('Mood analysis is currently offline (missing backend dependencies).');
                } else if (res.status === 404) {
                    showError('No Goodreads reviews found for this title to analyze.');
                } else {
                    showError(`Failed to fetch mood analysis (Server error: ${res.status}).`);
                }
            }
        } catch (err) {
            console.error('Failed to explore book mood:', err);
            showError('Network error connecting to mood analysis service.');
        }
    }

    getMoodIcon(mood) {
        if (!mood) return 'fa-tag';
        const icons = {
            'melancholic': 'fa-cloud-showers-heavy',
            'melancholy': 'fa-cloud-showers-heavy',
            'cozy': 'fa-mug-hot',
            'tense': 'fa-bolt',
            'intense': 'fa-bolt',
            'inspiring': 'fa-lightbulb',
            'uplifting': 'fa-lightbulb',
            'whimsical': 'fa-wand-magic-sparkles',
            'dark': 'fa-moon',
            'adventurous': 'fa-compass',
            'mysterious': 'fa-eye',
            'romantic': 'fa-heart',
            'atmospheric': 'fa-wind',
            'thoughtful': 'fa-brain',
            'thought-provoking': 'fa-brain',
            'emotional': 'fa-face-sad-tear'
        };
        return icons[mood.toLowerCase().trim()] || 'fa-tag';
    }

    async renderCuratedSection(query, elementId, maxResults = 5) {
        const container = document.getElementById(elementId);
        if (!container) return;

        // Show skeletons while loading
        this.renderSkeletons(container, maxResults);

        try {
            const client = window.GoogleBooksClient;
            const data = client
                ? await client.fetchVolumes(query, { maxResults, extraParams: '&printType=books' })
                : await (async () => {
                    const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
                    const encodedQuery = encodeURIComponent(query);
                    const res = await fetch(`${API_BASE}?q=${encodedQuery}&maxResults=${maxResults}&printType=books${keyParam}`);
                    if (!res.ok) {
                        throw new Error(`API Error: ${res.statusText}`);
                    }
                    return await res.json();
                })();

            if (data.items && data.items.length > 0) {
                await this.renderBookCards(container, data.items.slice(0, maxResults));
            } else {
                const fallbackBooks = getFallbackBooks(query, maxResults);
                if (fallbackBooks.length > 0) {
                    await this.renderBookCards(container, fallbackBooks);
                } else {
                    container.innerHTML = `
                        <div class="empty-state">
                            <i class="fa-solid fa-box-open"></i>
                            <p>No books found. The shelves are empty.</p>
                        </div>`;
                }
            }
        } catch (err) {
            console.error("Failed to fetch books", err);
            const fallbackBooks = getFallbackBooks(query, maxResults);
            if (fallbackBooks.length > 0) {
                await this.renderBookCards(container, fallbackBooks);
                return;
            }

            showToast("Failed to load bookshelf.", "error");
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p>Bookshelf Empty (API connection failed)</p>
                </div>`;
        }
    }

    async renderMoodCategorySection(categoryConfig, elementId, maxResults = 5) {
        const container = document.getElementById(elementId);
        if (!container) return;

        this.renderSkeletons(container, maxResults);

        try {
            const res = await fetch(`${MOOD_API_BASE}/category-books`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    category: categoryConfig.category,
                    vibe_description: categoryConfig.vibeDescription,
                    count: maxResults
                })
            });

            if (!res.ok) {
                throw new Error(`Category API Error: ${res.status}`);
            }

            const payload = await res.json();
            const categoryBooks = payload?.data?.books || [];

            if (categoryBooks.length === 0) {
                throw new Error(`No books returned for category: ${categoryConfig.category}`);
            }

            const resolvedBooks = await this.resolveCategoryBooks(categoryBooks);
            if (resolvedBooks.length > 0) {
                await this.renderBookCards(container, resolvedBooks.slice(0, maxResults));
                return;
            }

            throw new Error(`Could not resolve Google Books matches for category: ${categoryConfig.category}`);
        } catch (err) {
            console.error(`Failed to load category shelf "${categoryConfig.category}"`, err);
            await this.renderCuratedSection(categoryConfig.fallbackQuery, elementId, maxResults);
        }
    }

    async resolveCategoryBooks(categoryBooks) {
        const resolvedBooks = [];

        for (const item of categoryBooks) {
            const title = String(item?.title || '').trim();
            const author = String(item?.author || '').trim();
            if (!title) continue;

            const searchQuery = author
                ? `intitle:${title} inauthor:${author}`
                : `intitle:${title}`;

            try {
                const client = window.GoogleBooksClient;
                const data = client
                    ? await client.fetchVolumes(searchQuery, { maxResults: 1, extraParams: '&printType=books' })
                    : await (async () => {
                        const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
                        const res = await fetch(`${API_BASE}?q=${encodeURIComponent(searchQuery)}&maxResults=1&printType=books${keyParam}`);
                        if (!res.ok) {
                            throw new Error(`Google Books API Error: ${res.status}`);
                        }
                        return await res.json();
                    })();

                const matchedBook = data?.items?.[0];
                if (matchedBook) {
                    matchedBook.categoryReason = item.reason || '';
                    resolvedBooks.push(matchedBook);
                }
            } catch (error) {
                console.warn(`Failed to resolve category book "${title}"`, error);
            }
        }

        return resolvedBooks;
    }

    async renderBookCards(container, books) {
        if (container.id === 'search-results-grid') {
            window.searchFilterManager = new SearchFilterManager(container, books, this);
            return;
        }

        container.innerHTML = '';
        if (!books || books.length === 0) {
            container.innerHTML = '<p class="empty-state">No books available for this collection.</p>';
            return;
        }

        for (const book of books) {
            try {
                const bookElement = await this.createBookElement(book);
                if (bookElement) {
                    container.appendChild(bookElement);
                }
            } catch (err) {
                console.error("Failed to render individual book:", book.id, err);
                // Continue to next book instead of breaking the row
            }
        }

        // If nothing was rendered, show error
        if (container.children.length === 0) {
            container.innerHTML = '<p class="empty-state">Failed to load books. Please check your connection.</p>';
        }
    }
}

