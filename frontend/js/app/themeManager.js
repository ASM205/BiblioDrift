import { SafeStorage } from './storage.js';

export class ThemeManager {
    constructor() {
        this.themeKey = 'bibliodrift_theme';
        this.toggleBtn = null;
        this.currentTheme = 'light';

        // Named handler so we can safely remove/re-add without stacking listeners
        this._handler = this._onClick.bind(this);

        // Wait until the DOM is ready before querying #themeToggle
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init(), { once: true });
        } else {
            this.init();
        }
    }

    _getStoredTheme() {
        // Safe fallback if SafeStorage is not loaded yet
        try {
            if (typeof SafeStorage !== 'undefined' && SafeStorage.get) {
                const stored = SafeStorage.get(this.themeKey);
                return stored === 'night' ? 'night' : 'light';
            }

            const stored = localStorage.getItem(this.themeKey);
            return stored === 'night' ? 'night' : 'light';
        } catch {
            return 'light';
        }
    }

    _saveTheme(theme) {
        try {
            if (typeof SafeStorage !== 'undefined' && SafeStorage.set) {
                SafeStorage.set(this.themeKey, theme);
            } else {
                localStorage.setItem(this.themeKey, theme);
            }
        } catch {
            // Ignore storage errors
        }
    }

    _onClick() {
        this.currentTheme =
            this.currentTheme === 'night' ? 'light' : 'night';

        this.applyTheme(this.currentTheme);
        this._saveTheme(this.currentTheme);
    }

    init() {
        // Re-query in case the button wasn't available during construction
        this.toggleBtn = document.getElementById('themeToggle');

        // Load saved theme and apply it even if the button doesn't exist
        this.currentTheme = this._getStoredTheme();
        this.applyTheme(this.currentTheme);

        // Exit if no toggle button on this page
        if (!this.toggleBtn) return;

        // Prevent duplicate listeners if init() runs more than once
        this.toggleBtn.removeEventListener('click', this._handler);
        this.toggleBtn.addEventListener('click', this._handler);
    }

    applyTheme(theme) {
        const isNight = theme === 'night';

        // Apply theme to <html>
        if (isNight) {
            document.documentElement.setAttribute('data-theme', 'night');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        // Update toggle button icon and accessibility labels
        if (this.toggleBtn) {
            const icon = this.toggleBtn.querySelector('i');

            if (icon) {
                icon.className = isNight
                    ? 'fa-solid fa-sun'
                    : 'fa-solid fa-moon';
            }

            this.toggleBtn.title = isNight
                ? 'Switch to Light Mode'
                : 'Switch to Dark Mode';

            this.toggleBtn.setAttribute(
                'aria-label',
                this.toggleBtn.title
            );

            this.toggleBtn.setAttribute(
                'aria-pressed',
                String(isNight)
            );
        }
    }
}

// Initialize once
window.themeManager = new ThemeManager();

