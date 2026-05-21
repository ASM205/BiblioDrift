import { BookRenderer } from './bookRenderer.js';

export class SearchFilterManager {
    constructor(container, books, renderer) {
        this.container = container;
        this.books = books;
        this.renderer = renderer;
        this.activeFilter = null;
        this.uniqueMoods = new Set();
        this.bookElements = new Map(); // bookId -> bookSceneElement

        // Initialize UI elements
        this.filterBar = document.getElementById('mood-filter-bar');
        this.chipsContainer = document.getElementById('filter-chips');
        
        if (this.filterBar && this.chipsContainer) {
            this.filterBar.hidden = false;
            this.chipsContainer.innerHTML = '';
        }

        // Restore active filter from URL query params or sessionStorage if exists
        const urlParams = new URLSearchParams(window.location.search);
        this.activeFilter = urlParams.get('mood') || sessionStorage.getItem('active_mood_filter');

        this.init();
    }

    async init() {
        // Clear previous grid
        this.container.innerHTML = '';
        
        // Render all books first
        for (const book of this.books) {
            try {
                const bookElement = await this.renderer.createBookElement(book);
                if (bookElement) {
                    this.container.appendChild(bookElement);
                    this.bookElements.set(book.id, bookElement);
                }
            } catch (err) {
                console.error("Failed to render book in search filter:", book.id, err);
            }
        }

        // Process hydration in a staggered fashion to avoid 429 rate limits
        let delayMs = 0;
        for (const book of this.books) {
            const bookElement = this.bookElements.get(book.id);
            if (bookElement) {
                setTimeout(() => {
                    this.hydrateBookMoodTags(book, bookElement);
                }, delayMs);
                delayMs += 350; // Stagger by 350ms to respect backend rate limits
            }
        }

        // If no elements were rendered, show error/empty
        if (this.container.children.length === 0) {
            this.container.innerHTML = '<p class="empty-state">No books available for this collection.</p>';
        }
    }

    async hydrateBookMoodTags(book, bookElement, retryCount = 0) {
        const title = book.volumeInfo?.title || "Untitled";
        const authors = book.volumeInfo?.authors ? book.volumeInfo?.authors.join(", ") : "Unknown Author";

        try {
            const res = await this.renderer.fetchMoodTags(title, authors);

            if (res && res.status === 429) {
                // Rate limited! Retry after a delay if retryCount < 3
                if (retryCount < 3) {
                    const backoff = (retryCount + 1) * 1000;
                    setTimeout(() => {
                        this.hydrateBookMoodTags(book, bookElement, retryCount + 1);
                    }, backoff);
                    return;
                }
            }

            if (res && res.ok) {
                const data = await res.json();
                const moods = data.data?.mood_tags || [];
                if (moods && moods.length > 0) {
                    book.moods = moods; // Save to book object

                    // Update back face tags in DOM
                    const backFace = bookElement.querySelector('.book__face--back > div');
                    if (backFace) {
                        let tagsEl = backFace.querySelector('.book-mood-tags');
                        if (!tagsEl) {
                            tagsEl = document.createElement('div');
                            tagsEl.className = 'book-mood-tags';
                            tagsEl.style.cssText = 'margin-bottom: 0.8rem; display: flex; flex-wrap: wrap; gap: 4px;';
                            backFace.appendChild(tagsEl);
                        }
                        tagsEl.innerHTML = moods.map(m => `
                            <span class="mood-tag-badge" data-mood="${m}" style="font-size: 0.6rem; background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 10px; text-transform: capitalize; color: var(--text-main);">
                                <i class="fa-solid ${this.renderer.getMoodIcon(m)}"></i> ${m}
                            </span>
                        `).join('');
                    }

                    // Add to unique moods set
                    moods.forEach(mood => {
                        // Standardize casing to capitalize first letter for cleaner chips display
                        const cleanMood = mood.charAt(0).toUpperCase() + mood.slice(1).toLowerCase();
                        this.uniqueMoods.add(cleanMood);
                    });

                    // Update filter chips bar
                    this.renderFilterChips();

                    // If this book matches the active filter
                    this.updateBookVisibility(book.id);
                }
            }
        } catch (e) {
            console.warn("Failed to hydrate mood tags for", title, e);
        }
    }

    renderFilterChips() {
        if (!this.chipsContainer) return;

        // If no moods loaded yet, don't show the bar
        if (this.uniqueMoods.size === 0) {
            this.filterBar.hidden = true;
            return;
        }

        this.filterBar.hidden = false;

        // Save current active element scroll or cursor position if needed
        const prevScrollLeft = this.chipsContainer.scrollLeft;

        this.chipsContainer.innerHTML = '';

        // 1. Add "All" or "Clear Filter" chip
        const allChip = document.createElement('div');
        allChip.className = `filter-chip ${!this.activeFilter ? 'active' : ''}`;
        allChip.innerHTML = `<i class="fa-solid fa-border-all"></i> All`;
        allChip.addEventListener('click', () => this.setFilter(null));
        this.chipsContainer.appendChild(allChip);

        // 2. Add dynamic chips for unique moods
        const sortedMoods = Array.from(this.uniqueMoods).sort();
        sortedMoods.forEach(mood => {
            const isChipActive = this.activeFilter && this.activeFilter.toLowerCase() === mood.toLowerCase();
            const chip = document.createElement('div');
            chip.className = `filter-chip ${isChipActive ? 'active' : ''}`;
            chip.innerHTML = `<i class="fa-solid ${this.renderer.getMoodIcon(mood)}"></i> ${mood}`;
            chip.addEventListener('click', () => this.setFilter(mood));
            this.chipsContainer.appendChild(chip);
        });

        // Restore scroll position
        this.chipsContainer.scrollLeft = prevScrollLeft;
    }

    setFilter(mood) {
        if (mood) {
            this.activeFilter = mood.toLowerCase();
            sessionStorage.setItem('active_mood_filter', this.activeFilter);
            
            // Update URL query parameters without reloading the page
            const url = new URL(window.location);
            url.searchParams.set('mood', this.activeFilter);
            window.history.pushState({}, '', url);
        } else {
            this.activeFilter = null;
            sessionStorage.removeItem('active_mood_filter');
            
            // Remove mood query param
            const url = new URL(window.location);
            url.searchParams.delete('mood');
            window.history.pushState({}, '', url);
        }

        // Render chips state update
        this.renderFilterChips();

        // Apply filtering logic to book elements
        this.applyFilter();
    }

    updateBookVisibility(bookId) {
        const element = this.bookElements.get(bookId);
        if (!element) return;

        const book = this.books.find(b => b.id === bookId);
        if (!book) return;

        let visible = true;
        if (this.activeFilter) {
            const bookMoods = (book.moods || []).map(m => m.toLowerCase());
            visible = bookMoods.includes(this.activeFilter);
        }

        if (visible) {
            element.style.display = 'block';
            element.classList.remove('filtered-out');
        } else {
            element.style.display = 'none';
            element.classList.add('filtered-out');
        }
    }

    applyFilter() {
        let visibleCount = 0;
        
        for (const [bookId, element] of this.bookElements.entries()) {
            const book = this.books.find(b => b.id === bookId);
            if (!book) continue;

            let visible = true;
            if (this.activeFilter) {
                const bookMoods = (book.moods || []).map(m => m.toLowerCase());
                visible = bookMoods.includes(this.activeFilter);
            }

            if (visible) {
                element.style.display = 'block';
                element.classList.remove('filtered-out');
                visibleCount++;
            } else {
                element.style.display = 'none';
                element.classList.add('filtered-out');
            }
        }

        // Handle empty matching filter state
        const existingEmptyState = this.container.querySelector('.empty-filter-state');
        if (existingEmptyState) {
            existingEmptyState.remove();
        }

        if (visibleCount === 0 && this.books.length > 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-filter-state';
            emptyState.id = 'empty-filter-state';
            
            const activeMoodName = this.activeFilter.charAt(0).toUpperCase() + this.activeFilter.slice(1);
            emptyState.innerHTML = `
                <i class="fa-solid ${this.renderer.getMoodIcon(this.activeFilter)}"></i>
                <h3>No "${activeMoodName}" vibes on this shelf</h3>
                <p>Try selecting a different mood chip to explore other avenues.</p>
            `;
            this.container.appendChild(emptyState);
        }
    }
}

