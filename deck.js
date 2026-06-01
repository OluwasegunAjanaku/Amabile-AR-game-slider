/* ==========================================================================
   AMABILE DI ROSA - POUR DECISIONS: PITCH DECK SLIDESHOW CONTROLLER
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    
    // Slide deck state
    const STATE = {
        currentSlide: 0,
        totalSlides: 9,
        autoPlayTimer: null,
        isAutoPlaying: false,
        audioContext: null
    };

    // Web Audio synthesizer for presentation sounds
    function initAudio() {
        if (STATE.audioContext) return;
        try {
            STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API is not supported in this browser.", e);
        }
    }

    function playClickSound() {
        initAudio();
        if (!STATE.audioContext) return;
        
        if (STATE.audioContext.state === 'suspended') {
            STATE.audioContext.resume();
        }

        const osc = STATE.audioContext.createOscillator();
        const gain = STATE.audioContext.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(1000, STATE.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, STATE.audioContext.currentTime + 0.05);

        gain.gain.setValueAtTime(0.12, STATE.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, STATE.audioContext.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(STATE.audioContext.destination);

        osc.start();
        osc.stop(STATE.audioContext.currentTime + 0.05);
    }

    // DOM selectors
    const DOM = {
        slideProgress: document.getElementById("slide-progress"),
        slideCounter: document.getElementById("slide-counter"),
        prevBtn: document.getElementById("prev-slide-btn"),
        nextBtn: document.getElementById("next-slide-btn"),
        playPresentationBtn: document.getElementById("play-presentation-btn"),
        toggleFullscreenBtn: document.getElementById("toggle-fullscreen-btn"),
        srAnnouncement: document.getElementById("sr-announcement")
    };

    function announceToScreenReader(message) {
        if (DOM.srAnnouncement) {
            DOM.srAnnouncement.textContent = message;
        }
    }

    function updatePresentationUI() {
        const slideIndex = STATE.currentSlide;
        const slides = document.querySelectorAll(".slide");

        // Toggle active slide class
        slides.forEach((slide, index) => {
            if (index === slideIndex) {
                slide.classList.add("active-slide");
                slide.setAttribute("aria-hidden", "false");
            } else {
                slide.classList.remove("active-slide");
                slide.setAttribute("aria-hidden", "true");
            }
        });

        // Update progress bar
        const progressPercent = ((slideIndex + 1) / STATE.totalSlides) * 100;
        if (DOM.slideProgress) {
            DOM.slideProgress.style.width = `${progressPercent}%`;
        }
        if (DOM.slideCounter) {
            DOM.slideCounter.textContent = `${slideIndex + 1} / ${STATE.totalSlides}`;
        }

        // Accessibility announcement
        const slideTitle = slides[slideIndex]?.querySelector("h1, h2")?.textContent || `Slide ${slideIndex + 1}`;
        announceToScreenReader(`Showing slide ${slideIndex + 1} of ${STATE.totalSlides}: ${slideTitle}`);
    }

    function navigateSlide(direction) {
        if (direction === "next") {
            if (STATE.currentSlide < STATE.totalSlides - 1) {
                STATE.currentSlide++;
                playClickSound();
            } else {
                STATE.currentSlide = 0; // wrap around
            }
        } else if (direction === "prev") {
            if (STATE.currentSlide > 0) {
                STATE.currentSlide--;
                playClickSound();
            }
        }
        updatePresentationUI();
    }

    // Keybindings listener
    document.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        
        if (e.key === "ArrowRight" || e.key === " ") {
            e.preventDefault();
            navigateSlide("next");
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            navigateSlide("prev");
        }
    });

    // Auto play presentations
    function toggleAutoPlay() {
        if (STATE.isAutoPlaying) {
            clearInterval(STATE.autoPlayTimer);
            STATE.isAutoPlaying = false;
            if (DOM.playPresentationBtn) {
                DOM.playPresentationBtn.classList.remove("btn-active");
                DOM.playPresentationBtn.innerHTML = `<i class="fa-solid fa-play"></i> Auto-Play`;
            }
        } else {
            initAudio();
            STATE.isAutoPlaying = true;
            if (DOM.playPresentationBtn) {
                DOM.playPresentationBtn.classList.add("btn-active");
                DOM.playPresentationBtn.innerHTML = `<i class="fa-solid fa-pause"></i> Pause`;
            }
            STATE.autoPlayTimer = setInterval(() => {
                navigateSlide("next");
            }, 6000); // 6 seconds auto rotation
        }
    }

    // Toggle fullscreen wrapper
    function toggleFullscreen() {
        const mainPanel = document.getElementById("presentation-panel");
        if (!document.fullscreenElement) {
            mainPanel.requestFullscreen().catch(err => {
                console.warn(`Fullscreen activation failed: ${err.message}`);
            });
            if (DOM.toggleFullscreenBtn) {
                DOM.toggleFullscreenBtn.innerHTML = `<i class="fa-solid fa-compress"></i> Windowed`;
            }
        } else {
            document.exitFullscreen();
            if (DOM.toggleFullscreenBtn) {
                DOM.toggleFullscreenBtn.innerHTML = `<i class="fa-solid fa-expand"></i> Fullscreen`;
            }
        }
    }

    // Event Bindings
    if (DOM.prevBtn) DOM.prevBtn.addEventListener("click", () => navigateSlide("prev"));
    if (DOM.nextBtn) DOM.nextBtn.addEventListener("click", () => navigateSlide("next"));
    if (DOM.playPresentationBtn) DOM.playPresentationBtn.addEventListener("click", toggleAutoPlay);
    if (DOM.toggleFullscreenBtn) DOM.toggleFullscreenBtn.addEventListener("click", toggleFullscreen);

    // Initialize layout defaults
    updatePresentationUI();
});
