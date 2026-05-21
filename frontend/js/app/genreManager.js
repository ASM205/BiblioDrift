import { BookRenderer } from './bookRenderer.js';

export class GenreManager {
    constructor(libraryManager = null) {
        this.libraryManager = libraryManager;
        this.genreGrid = document.getElementById('genre-grid');
        this.modal = document.getElementById('genre-modal');
        this.closeBtn = document.getElementById('close-genre-modal');
        this.modalTitle = document.getElementById('genre-modal-title');
        this.booksGrid = document.getElementById('genre-books-grid');
    }

    init() {
        if (!this.genreGrid) return;

        // Add click listeners to genre cards
        const cards = this.genreGrid.querySelectorAll('.genre-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const genre = card.dataset.genre;
                this.openGenre(genre);
            });
        });

        // Close modal listeners
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }

        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });
        }
    }

    openGenre(genre) {
        if (!this.modal) return;

        const genreName = genre.charAt(0).toUpperCase() + genre.slice(1);
        this.modalTitle.textContent = `${genreName} Books`;
        this.modal.showModal();
        document.body.style.overflow = 'hidden'; // Prevent scrolling

        this.fetchBooks(genre);
    }

    closeModal() {
        if (!this.modal) return;
        this.modal.close();
        document.body.style.overflow = ''; // Restore scrolling
    }

    async fetchBooks(genre) {
        if (!this.booksGrid) return;

        // Show loading skeletons
        if (window.renderer) {
            window.renderer.renderSkeletons(this.booksGrid, 10);
        } else {
            this.booksGrid.innerHTML = `
                <div class="genre-loading">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Finding best ${genre} books...</span>
                </div>
            `;
        }

        try {
            const client = window.GoogleBooksClient;
            const data = client
                ? await client.fetchVolumes(`subject:${genre}`, { maxResults: 20, extraParams: '&langRestrict=en&orderBy=relevance' })
                : await (async () => {
                    const keyParam = GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : '';
                    const response = await fetch(`${API_BASE}?q=subject:${genre}&maxResults=20&langRestrict=en&orderBy=relevance${keyParam}`);
                    if (!response.ok) {
                        throw new Error(`API Error: ${response.status}`);
                    }
                    return await response.json();
                })();

            const items = data.items || [];
            if (items.length > 0) {
                this.renderBooks(items);
            } else {
                this.renderBooks(getFallbackBooks(genre, 20));
            }
        } catch (error) {
            console.error('Error fetching genre books:', error);
            this.renderBooks(getFallbackBooks(genre, 20));
        }
    }

    async renderBooks(books) {
        this.booksGrid.innerHTML = '';


        const renderer = new BookRenderer(this.libraryManager);
        for (const book of books) {
            const el = await renderer.createBookElement(book);
            this.booksGrid.appendChild(el);
        }
    }
}

// Init
// --- Application Bootstrap ---
