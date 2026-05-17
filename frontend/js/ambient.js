/**
 * Ambient Sanctuary Logic for BiblioDrift
 * Handles background ambient sounds with layered toggle switches and global volume control.
 */

class AmbientManager {
    constructor() {
       // --- 1. DOM Elements Mapping ---
        this.toggleBtn = document.getElementById('ambientToggle');
        this.panel = document.getElementById('ambientPanel');
        this.volumeSlider = document.getElementById('ambientVolume');
        
        // Toggle input bindings
        this.rainToggle = document.getElementById('rainToggle');
        this.fireToggle = document.getElementById('fireToggle');
        this.spaceToggle = document.getElementById('spaceToggle');
        this.trainToggle = document.getElementById('trainToggle');
        this.forestToggle = document.getElementById('forestToggle'); 
        this.animeToggle = document.getElementById('animeToggle');
        this.magicToggle = document.getElementById('magicToggle');
        this.oceanToggle = document.getElementById('oceanToggle');
        this.stormToggle = document.getElementById('stormToggle');
        this.volumeSlider = document.getElementById('ambientVolume');
      
        if (!this.toggleBtn || !this.panel) {

            console.warn("Ambient Sanctuary elements missing from DOM.");

            return;

        }

        // --- 2. Audio Initialization & Audio Asset Mapping ---
        this.rainAudio = new Audio('https://archive.org/download/Red_Library_Nature_Rain/R22-25-General%20Rain.mp3');
        this.rainAudio.preload = 'auto';
        this.fireAudio = new Audio('https://archive.org/download/1-hour-cozy-fire-crackling-fireplace-320/1%20hour%20Cozy%20Fire%20Crackling%20Fireplace%20320.mp3');
        this.spaceAudio = new Audio('../assets/sounds/space.mp3');
        this.trainAudio = new Audio('../assets/sounds/train.mp3');
        this.forestAudio = new Audio('../assets/sounds/forest.mp3');
        this.animeAudio = new Audio('../assets/sounds/anime.mp3');
        this.magicAudio = new Audio('../assets/sounds/magic.mp3');
        this.oceanAudio = new Audio('../assets/sounds/calm-ocean-waves.mp3');
        this.stormAudio = new Audio('../assets/sounds/Rain-and-storm.mp3');

        // Cache all audio objects into an array for cleaner looping operations
        this.allTracks = [this.rainAudio, this.fireAudio, this.spaceAudio, this.trainAudio, this.forestAudio, this.animeAudio, this.magicAudio,this.oceanAudio,this.stormAudio];

        // --- 3. Preload and Loop Configuration ---
        this.allTracks.forEach(track => {
            track.preload = 'auto';
            track.loop = true;
        });

        // Prevent the 'high bass' microphone bump or thunder sound at the very end of the rain track
        // by artificially resetting its looping frame 4 seconds early.
        this.rainAudio.addEventListener('timeupdate', () => {
            if (this.rainAudio.duration && this.rainAudio.currentTime >= this.rainAudio.duration - 4) {
                this.rainAudio.currentTime = 0;
                this.rainAudio.play().catch(e => {});
            }
        });

        // --- 4. Global Audio Context Unlock (Required by modern browsers) ---
        this.audioUnlocked = false;
        this.unlockAudio = () => {
            if (this.audioUnlocked) return;
            
            // Soft-play and pause elements instantly to whitelist audio flags on user interactions
            this.allTracks.forEach(track => {
                track.play().then(() => { track.pause(); }).catch(e => {});
            });

            console.log("Audio Context Unlocked Across All Tracks");
            this.audioUnlocked = true;
            window.removeEventListener('click', this.unlockAudio);
        };
        window.addEventListener('click', this.unlockAudio);

        // --- 5. Boot Processes & Volume Injection ---
        this.init();
        this.syncVolume();
    }

    /**
     * Helper to uniformly configure, play, or pause an audio channel
     */
    handlePlayback(toggleInput, audioInstance, trackLabel) {
        if (!toggleInput || !audioInstance) return;

        toggleInput.addEventListener('change', () => {
            if (toggleInput.checked) {
                audioInstance.currentTime = 0;
                audioInstance.play()
                    .then(() => console.log(`${trackLabel} audio playing`))
                    .catch(e => {
                        console.error(`${trackLabel} audio failed:`, e);
                        if (typeof showToast === 'function') {
                            showToast("Audio playback blocked. Click anywhere to enable.", "info");
                        }
                    });
            } else {
                audioInstance.pause();
            }
        });
    }

    /**
     * Loops through tracking variables to apply uniform master gains
     */
    syncVolume() {
        if (!this.volumeSlider) return;
        const volume = parseFloat(this.volumeSlider.value) ?? 0.5;
        this.allTracks.forEach(track => {
            if (track) track.volume = volume;
        });
    }

    init() {
        // --- UI Interactions Panel Toggle ---
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents document click from instantly firing and closing it
            this.unlockAudio();  // Explicitly unlock browser media restrictions

            // Toggle all common active status naming variants to guarantee CSS pickup
            this.panel.classList.toggle('active');
            this.panel.classList.toggle('show');
            this.panel.classList.toggle('open');

            // Hard Fallback: If style rules fail completely via stylesheet, force layout rendering flag
            if (this.panel.classList.contains('active')) {
                if (window.getComputedStyle(this.panel).display === 'none') {
                    this.panel.style.display = 'block';
                }
            } else {
                this.panel.style.removeAttribute ? this.panel.style.removeAttribute('display') : this.panel.style.display = '';
            }
        });

        // Close panel context when clicking anywhere outside of its boundary box
        document.addEventListener('click', (e) => {
            if (!this.panel.contains(e.target) && e.target !== this.toggleBtn) {
                this.panel.classList.remove('active', 'show', 'open');
                if (this.panel.style.display === 'block') {
                    this.panel.style.display = '';
                }
            }
        });

        // Prevent closing drawer when clicking internal control settings (like the volume slider)
        this.panel.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // --- Core Audio Input Observers ---
        this.handlePlayback(this.rainToggle, this.rainAudio, "Rainy Evening");
        this.handlePlayback(this.fireToggle, this.fireAudio, "Cozy Fireplace");
        this.handlePlayback(this.spaceToggle, this.spaceAudio, "Space Drift");
        this.handlePlayback(this.trainToggle, this.trainAudio, "Night Train");
        this.handlePlayback(this.forestToggle, this.forestAudio, "Forest Cabin");
        this.handlePlayback(this.animeToggle, this.animeAudio, "Anime Ambience");
        this.handlePlayback(this.magicToggle, this.magicAudio, "Magic Realm");
        this.handlePlayback(this.oceanToggle, this.oceanAudio, "Calm Ocean Waves");
        this.handlePlayback(this.stormToggle, this.stormAudio, "Stormy Rain");

        // --- Master Volume Monitor ---
        this.volumeSlider?.addEventListener('input', () => {
            this.syncVolume();
        });
    }
}

// Initialize application on secure DOM state load
document.addEventListener('DOMContentLoaded', () => {
    window.ambientManager = new AmbientManager();
});