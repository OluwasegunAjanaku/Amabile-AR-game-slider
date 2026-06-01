/* ==========================================================================
   AMABILE DI ROSA - POUR DECISIONS: AR SIMULATOR & DECK CONTROLLER
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================================================
    // 1. DATA & STATE MANAGEMENT
    // ==========================================================================
    
    const STATE = {
        currentSlide: 0,
        totalSlides: 9,
        guidedMode: true, // If true, simulator views auto-match slide index
        players: [],      // Array of: { id, name, color, avatar, legitVotes, totalVotes }
        activePlayerIndex: null,
        activeCategory: null,
        drawnCard: null,
        spinsCount: 0,
        drawsCount: 0,
        isSpinning: false,
        isFlipped: false,
        autoPlayTimer: null,
        isAutoPlaying: false,
        audioContext: null
    };

    // Color registry for players
    const PLAYER_COLORS = [
        { main: "var(--brand-red)", text: "#FFFFFF", rgb: "232, 88, 53" },
        { main: "var(--brand-blue)", text: "#FFFFFF", rgb: "74, 107, 130" },
        { main: "var(--brand-green)", text: "#FFFFFF", rgb: "36, 161, 72" },
        { main: "#D97706", text: "#FFFFFF", rgb: "217, 119, 6" } // Amber
    ];

    // Prompts Database
    const PROMPTS_DATABASE = {
        DARE: [
            "Pour a drink using your non-dominant hand while lock-eye contact with the target player.",
            "Do your best dramatic runway walk across the room showing off your 'sweet' side.",
            "Try to make the player on your left laugh in under 30 seconds using only silent facial expressions.",
            "Whisper a secret about yourself to the target player, or take a penalty sip.",
            "Keep hands joined with the player to your right for the next two spin cycles.",
            "Re-enact a romantic scene from a movie using a bottle of wine as your co-star.",
            "Let the player to your left send a playful text from your phone to anyone you choose."
        ],
        SPILL: [
            "What was your very first honest impression of the host of this evening's session?",
            "If you had to share a bottle of Amabile with anyone in this room on a deserted island, who is it and why?",
            "Have you ever made a 'poor decision' on a date that actually turned out amazing? Spill the details!",
            "What is your biggest social turn-on that you've never admitted out loud to this group?",
            "What is the funniest or most embarrassing text message currently sitting in your recent chats?",
            "Spill the truth: Who in this room do you think is the best flirt, and why?",
            "If you could trade lives with any player here for one single day, who would it be?"
        ],
        SIP: [
            "SIP PENALTY: Everyone in the room currently wearing the color red must take a sip immediately!",
            "SIP PENALTY: The oldest and the youngest player at the table must cheers and take a sip together.",
            "SIP PENALTY: Take a sip if you've ever checked your phone to avoid an awkward conversation.",
            "SIP PENALTY: The last person at the table to touch their nose must take a sip of sweet wine!",
            "SIP PENALTY: Cheers and share a sip with the player who was most recently voted Legit.",
            "SIP PENALTY: Take two sips if you have ever liked someone's photo from three years ago by accident.",
            "SIP PENALTY: Drink if you've ever given a fake name at a bar or coffee shop."
        ]
    };

    // ==========================================================================
    // 2. SYNTHESIZED WEB AUDIO CORE
    // ==========================================================================
    
    function initAudio() {
        if (STATE.audioContext) return;
        try {
            STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API is not supported in this browser.", e);
        }
    }

    function synthSound(freq, type, duration, sweepFreq = null) {
        initAudio();
        if (!STATE.audioContext) return;
        
        // Resume if suspended (browser security policy)
        if (STATE.audioContext.state === 'suspended') {
            STATE.audioContext.resume();
        }

        const osc = STATE.audioContext.createOscillator();
        const gain = STATE.audioContext.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, STATE.audioContext.currentTime);
        
        if (sweepFreq) {
            osc.frequency.exponentialRampToValueAtTime(sweepFreq, STATE.audioContext.currentTime + duration);
        }

        gain.gain.setValueAtTime(0.15, STATE.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, STATE.audioContext.currentTime + duration);

        osc.connect(gain);
        gain.connect(STATE.audioContext.destination);

        osc.start();
        osc.stop(STATE.audioContext.currentTime + duration);
    }

    const SOUNDS = {
        click: () => synthSound(1200, "sine", 0.05, 800),
        swish: () => synthSound(300, "triangle", 0.15, 900),
        win: () => {
            synthSound(523.25, "sine", 0.2); // C5
            setTimeout(() => synthSound(659.25, "sine", 0.2), 100); // E5
            setTimeout(() => synthSound(783.99, "sine", 0.4), 200); // G5
        },
        cap: () => {
            synthSound(180, "sawtooth", 0.3, 100);
        },
        pop: () => synthSound(600, "sine", 0.08, 1200)
    };

    // ==========================================================================
    // 3. DOM ELEMENT CACHE
    // ==========================================================================
    
    const DOM = {
        // Deck Elements
        slidesViewport: document.getElementById("slides-viewport"),
        slideProgress: document.getElementById("slide-progress"),
        slideCounter: document.getElementById("slide-counter"),
        prevBtn: document.getElementById("prev-slide-btn"),
        nextBtn: document.getElementById("next-slide-btn"),
        playPresentationBtn: document.getElementById("play-presentation-btn"),
        toggleSandboxBtn: document.getElementById("toggle-sandbox-btn"),
        toggleFullscreenBtn: document.getElementById("toggle-fullscreen-btn"),
        guidedBadge: document.getElementById("guided-badge"),
        sandboxBadge: document.getElementById("sandbox-badge"),
        srAnnouncement: document.getElementById("sr-announcement"),

        // Phone Simulator Container Views
        views: document.querySelectorAll(".sim-view"),
        viewContainer: document.getElementById("view-container"),
        resetBtn: document.getElementById("simulator-reset-btn"),
        webcamStream: document.getElementById("webcam-stream"),
        dummyCamera: document.getElementById("dummy-camera-feed"),

        // Scan View Elements
        startScanningBtn: document.getElementById("start-scanning-btn"),
        mockScanSuccessBtn: document.getElementById("mock-scan-success-btn"),
        scanProgressBar: document.getElementById("scan-progress-bar"),
        scanHintText: document.getElementById("scan-hint-text"),

        // Lobby View Elements
        playerOnboardForm: document.getElementById("player-onboard-form"),
        playerNameInput: document.getElementById("player-name-input"),
        lobbyPlayersList: document.getElementById("lobby-players-list"),
        lobbyStartGameBtn: document.getElementById("lobby-start-game-btn"),

        // Spinner View Elements
        physicsBottle: document.getElementById("physics-bottle"),
        wheelSectorsContainer: document.getElementById("wheel-sectors-container"),
        spinnerPlayersBar: document.getElementById("spinner-players-bar"),
        selectedTargetPlayer: document.getElementById("selected-target-player"),
        turnActiveAvatar: document.getElementById("turn-active-avatar"),
        triggerSpinBtn: document.getElementById("trigger-spin-btn"),
        spinnerStatusTitle: document.getElementById("spinner-status-title"),

        // Cards View Elements
        promptCardWrapper: document.getElementById("prompt-card-wrapper"),
        cardActiveAvatar: document.getElementById("card-active-avatar"),
        cardActiveName: document.getElementById("card-active-name"),
        drawnPromptContent: document.getElementById("drawn-prompt-content"),
        cardStripBg: document.getElementById("card-strip-bg"),
        cardStripIcon: document.getElementById("card-strip-icon"),
        cardStripLabel: document.getElementById("card-strip-label"),
        categoryButtons: document.querySelectorAll(".cat-selector-btn"),

        // Verdict View Elements
        verdictPlayerAvatar: document.getElementById("verdict-player-avatar"),
        verdictPlayerName: document.getElementById("verdict-player-name"),
        verdictActivePromptDisplay: document.getElementById("verdict-active-prompt-display"),
        juryLegitBtn: document.getElementById("jury-legit-btn"),
        juryCapBtn: document.getElementById("jury-cap-btn"),
        juryPercentage: document.getElementById("jury-percentage"),
        juryBarLegit: document.getElementById("jury-bar-legit"),

        // Ending View Elements
        confettiCanvas: document.getElementById("ending-confetti-canvas"),
        winnerAvatar: document.getElementById("winner-avatar"),
        winnerNameText: document.getElementById("winner-name-text"),
        winnerScoreText: document.getElementById("winner-score-text"),
        loserAvatar: document.getElementById("loser-avatar"),
        loserNameText: document.getElementById("loser-name-text"),
        loserScoreText: document.getElementById("loser-score-text"),
        gameRestartFinalBtn: document.getElementById("game-restart-final-btn"),
        simCommerceBtn: document.getElementById("sim-commerce-btn"),

        // Specs Sandbox View
        specActiveMode: document.getElementById("spec-active-mode"),
        specPlayersCount: document.getElementById("spec-players-count"),
        specSpinsCount: document.getElementById("spec-spins-count"),
        specDrawsCount: document.getElementById("spec-draws-count"),
        sandboxPlayNowBtn: document.getElementById("sandbox-play-now-btn")
    };

    // ==========================================================================
    // 4. PRESENTATION DECK LOGIC
    // ==========================================================================
    
    function announceToScreenReader(message) {
        DOM.srAnnouncement.textContent = message;
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
        DOM.slideProgress.style.width = `${progressPercent}%`;
        DOM.slideCounter.textContent = `${slideIndex + 1} / ${STATE.totalSlides}`;

        // Accessibility announcement
        const slideTitle = slides[slideIndex].querySelector("h1, h2")?.textContent || `Slide ${slideIndex + 1}`;
        announceToScreenReader(`Showing slide ${slideIndex + 1} of ${STATE.totalSlides}: ${slideTitle}`);

        // guided mode view syncing
        if (STATE.guidedMode) {
            const targetScene = slides[slideIndex].getAttribute("data-scene");
            if (targetScene) {
                switchView(targetScene);
            }
        }
    }

    function navigateSlide(direction) {
        if (direction === "next") {
            if (STATE.currentSlide < STATE.totalSlides - 1) {
                STATE.currentSlide++;
                SOUNDS.click();
            } else {
                // Wrap around at the end
                STATE.currentSlide = 0;
            }
        } else if (direction === "prev") {
            if (STATE.currentSlide > 0) {
                STATE.currentSlide--;
                SOUNDS.click();
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
            DOM.playPresentationBtn.classList.remove("btn-active");
            DOM.playPresentationBtn.innerHTML = `<i class="fa-solid fa-play"></i> Auto-Play`;
        } else {
            initAudio();
            STATE.isAutoPlaying = true;
            DOM.playPresentationBtn.classList.add("btn-active");
            DOM.playPresentationBtn.innerHTML = `<i class="fa-solid fa-pause"></i> Pause`;
            STATE.autoPlayTimer = setInterval(() => {
                navigateSlide("next");
            }, 6000); // 6 seconds auto rotation
        }
    }

    // Toggle fullscreen wrapper
    function toggleFullscreen() {
        const mainPanel = document.getElementById("main-deck");
        if (!document.fullscreenElement) {
            mainPanel.requestFullscreen().catch(err => {
                console.warn(`Fullscreen activation failed: ${err.message}`);
            });
            DOM.toggleFullscreenBtn.innerHTML = `<i class="fa-solid fa-compress"></i> Windowed`;
        } else {
            document.exitFullscreen();
            DOM.toggleFullscreenBtn.innerHTML = `<i class="fa-solid fa-expand"></i> Fullscreen`;
        }
    }

    // Toggle sandbox play vs guided slide deck
    function toggleSandboxMode(forcePlay = null) {
        const nextState = forcePlay !== null ? forcePlay : !STATE.guidedMode;
        if (nextState) {
            STATE.guidedMode = false;
            DOM.guidedBadge.classList.remove("active");
            DOM.sandboxBadge.classList.add("active");
            DOM.toggleSandboxBtn.classList.add("btn-active");
            announceToScreenReader("Sandbox Play Mode Enabled. Simulator is now unlocked from slides.");
        } else {
            STATE.guidedMode = true;
            DOM.guidedBadge.classList.add("active");
            DOM.sandboxBadge.classList.remove("active");
            DOM.toggleSandboxBtn.classList.remove("btn-active");
            announceToScreenReader("Guided Mode Activated. Simulator is synchronized with slide view.");
            updatePresentationUI();
        }
        updateSpecsViewData();
    }

    // Event Bindings for slides
    DOM.prevBtn.addEventListener("click", () => navigateSlide("prev"));
    DOM.nextBtn.addEventListener("click", () => navigateSlide("next"));
    DOM.playPresentationBtn.addEventListener("click", toggleAutoPlay);
    DOM.toggleFullscreenBtn.addEventListener("click", toggleFullscreen);
    DOM.toggleSandboxBtn.addEventListener("click", () => toggleSandboxMode());

    // ==========================================================================
    // 5. SMARTPHONE SIMULATOR VIEW CONTROLLER
    // ==========================================================================
    
    function switchView(viewName) {
        DOM.views.forEach(view => {
            if (view.getAttribute("data-view") === viewName) {
                view.classList.add("active-view");
            } else {
                view.classList.remove("active-view");
            }
        });

        // Specific view initialization routines
        if (viewName === "scan") {
            startCameraStream();
        } else {
            stopCameraStream();
        }

        if (viewName === "ending") {
            triggerEndingConfetti();
        }
        
        updateSpecsViewData();
    }

    // WebRTC Camera access controller
    function startCameraStream() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            // No camera interface support, show fallback animations
            DOM.dummyCamera.style.opacity = "1";
            DOM.webcamStream.style.display = "none";
            return;
        }

        const constraints = {
            video: {
                width: { ideal: 360 },
                height: { ideal: 640 },
                facingMode: "user"
            },
            audio: false
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                DOM.webcamStream.srcObject = stream;
                DOM.webcamStream.style.display = "block";
                DOM.dummyCamera.style.opacity = "0"; // hide fallback bokeh
            })
            .catch(err => {
                console.warn("Camera streaming error: Access Denied or Missing Device.", err);
                DOM.dummyCamera.style.opacity = "1";
                DOM.webcamStream.style.display = "none";
            });
    }

    function stopCameraStream() {
        if (DOM.webcamStream.srcObject) {
            const tracks = DOM.webcamStream.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            DOM.webcamStream.srcObject = null;
        }
    }

    // ==========================================================================
    // 6. PHASE 1: SCAN SIMULATOR INTERACTION
    // ==========================================================================
    
    let scanTimeout = null;
    
    function executeSimulatedScan() {
        initAudio();
        SOUNDS.pop();
        DOM.scanProgressBar.style.width = "0%";
        DOM.scanHintText.textContent = "Scanning bottle label contours...";
        DOM.mockScanSuccessBtn.setAttribute("disabled", "true");

        let progress = 0;
        clearInterval(scanTimeout);
        
        scanTimeout = setInterval(() => {
            progress += 10;
            DOM.scanProgressBar.style.width = `${progress}%`;
            SOUNDS.click();

            if (progress >= 100) {
                clearInterval(scanTimeout);
                DOM.scanHintText.textContent = "Bottle Matched! Pour Decisions Unlocked.";
                SOUNDS.win();
                
                setTimeout(() => {
                    DOM.mockScanSuccessBtn.removeAttribute("disabled");
                    DOM.scanProgressBar.style.width = "0%";
                    DOM.scanHintText.textContent = "Point camera at the Amabile di Rosa bottle";
                    
                    // Transition to Setup View
                    if (STATE.guidedMode) {
                        navigateSlide("next"); // triggers Phase 2 slide and lobby view
                    } else {
                        switchView("lobby");
                    }
                }, 1000);
            }
        }, 150);
    }

    DOM.startScanningBtn.addEventListener("click", () => {
        if (STATE.guidedMode) {
            navigateSlide("next");
        } else {
            switchView("scan");
        }
    });

    DOM.mockScanSuccessBtn.addEventListener("click", executeSimulatedScan);

    // ==========================================================================
    // 7. PHASE 2: PLAYER LOBBY REGISTRATION
    // ==========================================================================
    
    function renderPlayersLobbyList() {
        DOM.lobbyPlayersList.innerHTML = "";
        
        STATE.players.forEach((player, idx) => {
            const playerRow = document.createElement("div");
            playerRow.className = "lobby-player-row";
            playerRow.style.borderLeftColor = player.color;
            
            playerRow.innerHTML = `
                <div class="lobby-player-info">
                    <div class="player-avatar-circle" style="background-color: ${player.color};">
                        ${player.avatar}
                    </div>
                    <span class="player-name-txt">${player.name}</span>
                </div>
                <button class="remove-player-btn" data-index="${idx}" aria-label="Remove Player">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            DOM.lobbyPlayersList.appendChild(playerRow);
        });

        // Manage Lobby start action state
        const playerCount = STATE.players.length;
        if (playerCount >= 2) {
            DOM.lobbyStartGameBtn.removeAttribute("disabled");
            DOM.lobbyStartGameBtn.classList.remove("locked-btn");
            DOM.lobbyStartGameBtn.innerHTML = `<span>START THE GAME (${playerCount}/4)</span> <i class="fa-solid fa-play"></i>`;
        } else {
            DOM.lobbyStartGameBtn.setAttribute("disabled", "true");
            DOM.lobbyStartGameBtn.classList.add("locked-btn");
            DOM.lobbyStartGameBtn.innerHTML = `<span>START THE GAME (${playerCount}/2 Required)</span> <i class="fa-solid fa-play"></i>`;
        }

        // Keep dynamic mini bars synchronized in other panels
        updateActivePlayersSpinnerBar();
    }

    function addPlayer(name) {
        if (STATE.players.length >= 4) {
            announceToScreenReader("Lobby full. Max 4 players allowed.");
            return;
        }
        if (!name.trim()) return;

        const pIdx = STATE.players.length;
        const colorPalette = PLAYER_COLORS[pIdx];
        const newPlayer = {
            id: Date.now(),
            name: name.trim(),
            color: colorPalette.main,
            textCol: colorPalette.text,
            avatar: name.trim().charAt(0).toUpperCase(),
            legitVotes: 0,
            totalVotes: 0
        };

        STATE.players.push(newPlayer);
        SOUNDS.pop();
        renderPlayersLobbyList();
        updateSpecsViewData();
    }

    function removePlayer(index) {
        STATE.players.splice(index, 1);
        // Re-assign colors to keep design harmonious
        STATE.players.forEach((player, idx) => {
            player.color = PLAYER_COLORS[idx].main;
            player.textCol = PLAYER_COLORS[idx].text;
        });
        SOUNDS.click();
        renderPlayersLobbyList();
        updateSpecsViewData();
    }

    DOM.playerOnboardForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const value = DOM.playerNameInput.value;
        if (value) {
            addPlayer(value);
            DOM.playerNameInput.value = "";
            DOM.playerNameInput.focus();
        }
    });

    DOM.lobbyPlayersList.addEventListener("click", (e) => {
        const trashBtn = e.target.closest(".remove-player-btn");
        if (trashBtn) {
            const index = parseInt(trashBtn.getAttribute("data-index"));
            removePlayer(index);
        }
    });

    DOM.lobbyStartGameBtn.addEventListener("click", () => {
        if (STATE.players.length >= 2) {
            if (STATE.guidedMode) {
                navigateSlide("next"); // triggers Spinner phase slide
            } else {
                switchView("spinner");
            }
        }
    });

    // Auto-filler helper: Prevents blocking clients, guarantees interactivity
    function guaranteeTestPlayers() {
        if (STATE.players.length < 2) {
            STATE.players = [];
            addPlayer("Alex");
            addPlayer("Jordan");
            addPlayer("Taylor");
        }
    }

    // ==========================================================================
    // 8. PHASE 3: INTERACTIVE BOTTLE SPINNER PHYSICS
    // ==========================================================================
    
    let currentRotation = 0;
    
    function updateActivePlayersSpinnerBar() {
        DOM.spinnerPlayersBar.innerHTML = "";
        STATE.players.forEach((player, idx) => {
            const bubble = document.createElement("div");
            bubble.className = "mini-avatar-bubble";
            bubble.style.backgroundColor = player.color;
            bubble.style.color = player.textCol;
            bubble.id = `mini-av-${idx}`;
            bubble.textContent = player.avatar;
            DOM.spinnerPlayersBar.appendChild(bubble);
        });
    }

    function buildSpinnerSectors() {
        guaranteeTestPlayers();
        const count = STATE.players.length;
        DOM.wheelSectorsContainer.innerHTML = "";
        
        const degPerSlice = 360 / count;
        
        STATE.players.forEach((player, idx) => {
            // Setup wedges inside absolute circular frame using clip paths or linear lines
            const wedge = document.createElement("div");
            wedge.className = "sector-wedge";
            wedge.style.backgroundColor = player.color;
            wedge.style.opacity = "0.08";
            
            // Standard sector rotation positioning
            const rot = idx * degPerSlice;
            const skew = 90 - degPerSlice;
            wedge.style.transform = `rotate(${rot}deg) skewY(${skew}deg)`;
            DOM.wheelSectorsContainer.appendChild(wedge);
        });

        updateActivePlayersSpinnerBar();
    }

    function executeBottleSpin() {
        if (STATE.isSpinning) return;
        initAudio();
        guaranteeTestPlayers();
        buildSpinnerSectors();
        
        STATE.isSpinning = true;
        DOM.triggerSpinBtn.setAttribute("disabled", "true");
        DOM.spinnerStatusTitle.textContent = "SPINNING...";
        
        // Remove highlit classes
        document.querySelectorAll(".mini-avatar-bubble").forEach(b => b.classList.remove("active-spinner-target"));

        // Spin physics initialization variables
        let angularVelocity = Math.random() * 40 + 40; // 40 - 80 speed range
        const friction = 0.978; // natural deceleration decay
        let totalWedgesCrossed = 0;
        const degPerPlayer = 360 / STATE.players.length;

        function animateSpin() {
            if (angularVelocity < 0.05) {
                // Stopped spinning
                STATE.isSpinning = false;
                DOM.triggerSpinBtn.removeAttribute("disabled");
                DOM.spinnerStatusTitle.textContent = "TAP BOTTLE TO SPIN";
                
                // Determine targeted segment player
                // normalize rotation within 360 deg
                const finalRotationDegrees = (currentRotation % 360 + 360) % 360;
                
                // Camera vector is pointing straight up (0 deg or 360 deg relative to phone top)
                // Since bottle rotates clockwise, the nozzle points to (360 - angle) mapping target
                const pointingAngle = (360 - finalRotationDegrees) % 360;
                const winnerIndex = Math.floor(pointingAngle / degPerPlayer) % STATE.players.length;
                
                resolveSpinnerTurn(winnerIndex);
                return;
            }

            currentRotation += angularVelocity;
            DOM.physicsBottle.style.transform = `rotate(${currentRotation}deg)`;
            angularVelocity *= friction;

            // Audio click tick trigger on sector bounds intersection
            const crossedCount = Math.floor(currentRotation / degPerPlayer);
            if (crossedCount > totalWedgesCrossed) {
                totalWedgesCrossed = crossedCount;
                SOUNDS.click();
                
                // Subtle dynamic mini-hightlight
                const currentSector = (STATE.players.length - 1) - (totalWedgesCrossed % STATE.players.length);
                const bubble = document.getElementById(`mini-av-${currentSector}`);
                if (bubble) {
                    document.querySelectorAll(".mini-avatar-bubble").forEach(b => b.classList.remove("active-spinner-target"));
                    bubble.classList.add("active-spinner-target");
                }
            }

            requestAnimationFrame(animateSpin);
        }

        animateSpin();
    }

    function resolveSpinnerTurn(winnerIndex) {
        STATE.activePlayerIndex = winnerIndex;
        STATE.spinsCount++;
        const player = STATE.players[winnerIndex];

        SOUNDS.win();

        // Highlight selected profile
        document.querySelectorAll(".mini-avatar-bubble").forEach(b => b.classList.remove("active-spinner-target"));
        const bubble = document.getElementById(`mini-av-${winnerIndex}`);
        if (bubble) bubble.classList.add("active-spinner-target");

        // Footer status display
        DOM.selectedTargetPlayer.textContent = player.name;
        DOM.turnActiveAvatar.textContent = player.avatar;
        DOM.turnActiveAvatar.style.backgroundColor = player.color;
        DOM.turnActiveAvatar.style.color = player.textCol;

        // Auto move after dynamic timer in guided mode
        setTimeout(() => {
            if (STATE.guidedMode) {
                navigateSlide("next"); // shifts deck to prompts categorization slide
            } else {
                switchView("cards");
            }
        }, 1800);
    }

    DOM.triggerSpinBtn.addEventListener("click", executeBottleSpin);
    DOM.physicsBottle.addEventListener("click", executeBottleSpin);

    // ==========================================================================
    // 9. PHASE 4: PROMPTS DRAWING (3D CARD FLIP)
    // ==========================================================================
    
    function preparePromptCardDraw() {
        guaranteeTestPlayers();
        if (STATE.activePlayerIndex === null) {
            STATE.activePlayerIndex = 0;
        }

        const activePlayer = STATE.players[STATE.activePlayerIndex];

        // Draw profile card header
        DOM.cardActiveName.textContent = activePlayer.name;
        DOM.cardActiveAvatar.textContent = activePlayer.avatar;
        DOM.cardActiveAvatar.style.backgroundColor = activePlayer.color;
        DOM.cardActiveAvatar.style.color = activePlayer.textCol;

        // Reset flip state card face
        DOM.promptCardWrapper.classList.remove("is-flipped");
        STATE.isFlipped = false;
        
        DOM.drawnPromptContent.textContent = "Tap a category deck below to pull your card!";
        DOM.cardStripBg.style.backgroundColor = "var(--text-muted)";
        DOM.cardStripLabel.textContent = "READY";
    }

    function executeCardDraw(category) {
        if (STATE.isFlipped) return;
        initAudio();
        STATE.drawsCount++;

        const prompts = PROMPTS_DATABASE[category];
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        
        STATE.activeCategory = category;
        STATE.drawnCard = randomPrompt;

        // Update front side DOM content
        DOM.drawnPromptContent.textContent = randomPrompt;
        
        // Render category color strip badges
        let catColor = "var(--brand-red)";
        let catIcon = "fa-glass-cheers";
        if (category === "DARE") {
            catColor = "var(--brand-blue)";
            catIcon = "fa-hand-holding-heart";
        } else if (category === "SPILL") {
            catColor = "var(--brand-green)";
            catIcon = "fa-comment-dots";
        }
        
        DOM.cardStripBg.style.backgroundColor = catColor;
        DOM.cardStripIcon.className = `fa-solid ${catIcon}`;
        DOM.cardStripLabel.textContent = category;

        // 3D Flip Execution Trigger
        SOUNDS.swish();
        DOM.promptCardWrapper.classList.add("is-flipped");
        STATE.isFlipped = true;

        // Auto routing advancement in guided presentation mode
        setTimeout(() => {
            if (STATE.guidedMode) {
                navigateSlide("next"); // opens jury feedback slide view
            } else {
                switchView("verdict");
            }
        }, 3000);
    }

    DOM.categoryButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const category = btn.getAttribute("data-category");
            executeCardDraw(category);
        });
    });

    // Tap card wrapper to return/draw alternate
    DOM.promptCardWrapper.addEventListener("click", () => {
        if (STATE.isFlipped && !STATE.guidedMode) {
            DOM.promptCardWrapper.classList.remove("is-flipped");
            STATE.isFlipped = false;
            SOUNDS.swish();
        }
    });

    // ==========================================================================
    // 10. PHASE 5: THE PEER JURY VERDICT
    // ==========================================================================
    
    function prepareJuryVerdictView() {
        guaranteeTestPlayers();
        if (STATE.activePlayerIndex === null) {
            STATE.activePlayerIndex = 0;
        }

        const activePlayer = STATE.players[STATE.activePlayerIndex];
        const promptDrawn = STATE.drawnCard || "Tell the group your funniest secret or take a sip of Amabile di Rosa sweet wine.";

        DOM.verdictPlayerName.textContent = activePlayer.name;
        DOM.verdictPlayerAvatar.textContent = activePlayer.avatar;
        DOM.verdictPlayerAvatar.style.backgroundColor = activePlayer.color;
        DOM.verdictPlayerAvatar.style.color = activePlayer.textCol;
        DOM.verdictActivePromptDisplay.textContent = promptDrawn;

        // Reset percentages indicator
        STATE.votesLegit = 0;
        STATE.votesTotal = 0;
        updateJuryVerdictsBarDisplay();
    }

    function updateJuryVerdictsBarDisplay() {
        if (STATE.votesTotal === 0) {
            DOM.juryPercentage.textContent = "Jury has not voted";
            DOM.juryBarLegit.style.width = "50%"; // Balanced
            return;
        }

        const percentage = Math.round((STATE.votesLegit / STATE.votesTotal) * 100);
        DOM.juryPercentage.textContent = `${percentage}% Legit`;
        DOM.juryBarLegit.style.width = `${percentage}%`;
    }

    function recordJuryVote(isLegit) {
        initAudio();
        STATE.votesTotal++;
        if (isLegit) {
            STATE.votesLegit++;
            SOUNDS.pop();
        } else {
            SOUNDS.cap();
        }

        // Add to global player metrics
        const player = STATE.players[STATE.activePlayerIndex];
        if (isLegit) {
            player.legitVotes++;
        }
        player.totalVotes++;

        updateJuryVerdictsBarDisplay();

        // Check if full jury panel has finalized (e.g. 2 votes total)
        if (STATE.votesTotal >= 2) {
            // Play success sounds
            setTimeout(() => {
                // If this is the ending of round sequences or a complete deck explore
                if (STATE.guidedMode) {
                    navigateSlide("next"); // shows global outcomes final slide
                } else {
                    // Check if we want to loop back to spinner or show close ending
                    if (STATE.spinsCount >= 3) {
                        switchView("ending");
                    } else {
                        switchView("spinner");
                    }
                }
            }, 1500);
        }
    }

    DOM.juryLegitBtn.addEventListener("click", () => recordJuryVote(true));
    DOM.juryCapBtn.addEventListener("click", () => recordJuryVote(false));

    // ==========================================================================
    // 11. PHASE 6: STAKES & OUTCOME CELEBRATIONS
    // ==========================================================================
    
    let confettiAnimationFrame = null;

    function prepareEndingCelebrationView() {
        guaranteeTestPlayers();

        // Calculate ratios
        let highestScore = -1;
        let lowestScore = 999;
        let winner = STATE.players[0];
        let loser = STATE.players[1] || STATE.players[0];

        STATE.players.forEach(p => {
            const ratio = p.totalVotes > 0 ? (p.legitVotes / p.totalVotes) * 100 : 50;
            if (ratio > highestScore) {
                highestScore = ratio;
                winner = p;
            }
            if (ratio < lowestScore) {
                lowestScore = ratio;
                loser = p;
            }
        });

        // Set Winner DOM details
        DOM.winnerNameText.textContent = winner.name;
        DOM.winnerAvatar.textContent = winner.avatar;
        DOM.winnerAvatar.style.backgroundColor = winner.color;
        DOM.winnerAvatar.style.color = winner.textCol;
        DOM.winnerScoreText.textContent = `${Math.round(highestScore)}% Legit`;

        // Set Loser DOM details
        DOM.loserNameText.textContent = loser.name;
        DOM.loserAvatar.textContent = loser.avatar;
        DOM.loserAvatar.style.backgroundColor = loser.color;
        DOM.loserAvatar.style.color = loser.textCol;
        DOM.loserScoreText.textContent = `${Math.round(lowestScore)}% Legit`;
        
        SOUNDS.win();
        triggerEndingConfetti();
    }

    // HTML5 Canvas Confetti Simulation System
    function triggerEndingConfetti() {
        const canvas = DOM.confettiCanvas;
        const ctx = canvas.getContext("2d");
        
        // Scale canvas viewport sizes
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;

        const particles = [];
        const colors = ["#E85835", "#4A6B82", "#24A148", "#FBBF24", "#FFFFFF"];

        for (let i = 0; i < 60; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -100 - 20,
                r: Math.random() * 6 + 4,
                d: Math.random() * canvas.height,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                tiltAngle: 0,
                speedY: Math.random() * 2 + 2,
                speedX: Math.random() * 2 - 1
            });
        }

        cancelAnimationFrame(confettiAnimationFrame);

        function drawConfetti() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let activeParticles = 0;

            particles.forEach((p, idx) => {
                p.tiltAngle += p.tiltAngleIncremental;
                p.y += p.speedY;
                p.x += p.speedX;
                p.tilt = Math.sin(p.tiltAngle) * 12;

                if (p.y <= canvas.height + 20) {
                    activeParticles++;
                }

                ctx.beginPath();
                ctx.lineWidth = p.r;
                ctx.strokeStyle = p.color;
                ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
                ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
                ctx.stroke();

                // Recycle particles
                if (p.y > canvas.height + 10) {
                    p.y = -20;
                    p.x = Math.random() * canvas.width;
                }
            });

            if (activeParticles > 0) {
                confettiAnimationFrame = requestAnimationFrame(drawConfetti);
            }
        }

        drawConfetti();
    }

    DOM.gameRestartFinalBtn.addEventListener("click", () => {
        STATE.players = [];
        STATE.spinsCount = 0;
        STATE.drawsCount = 0;
        STATE.activePlayerIndex = null;
        
        renderPlayersLobbyList();
        SOUNDS.pop();
        
        if (STATE.guidedMode) {
            STATE.currentSlide = 0;
            updatePresentationUI();
        } else {
            switchView("intro");
        }
    });

    DOM.simCommerceBtn.addEventListener("click", () => {
        SOUNDS.win();
        alert("Loser redirected to purchase checklist. Branded bottle of Amabile di Rosa added to basket!");
    });

    // ==========================================================================
    // 12. ROUTER STATE VIEW COORDINATOR (GUIDED/SANDBOX DETECTOR)
    // ==========================================================================
    
    function updateSpecsViewData() {
        DOM.specActiveMode.textContent = STATE.guidedMode ? "Guided Slide Mode" : "Sandbox Sandbox Mode";
        DOM.specPlayersCount.textContent = `${STATE.players.length} Registered`;
        DOM.specSpinsCount.textContent = `${STATE.spinsCount} Spins`;
        DOM.specDrawsCount.textContent = `${STATE.drawsCount} Draws`;
    }

    // Handles state conversions when views switch
    function handleSceneTransitionInit(viewName) {
        if (viewName === "scan") {
            DOM.scanProgressBar.style.width = "0%";
        } else if (viewName === "lobby") {
            renderPlayersLobbyList();
        } else if (viewName === "spinner") {
            buildSpinnerSectors();
        } else if (viewName === "cards") {
            preparePromptCardDraw();
        } else if (viewName === "verdict") {
            prepareJuryVerdictView();
        } else if (viewName === "ending") {
            prepareEndingCelebrationView();
        }
    }

    // Intercept View Swappings in system
    const originalSwitchView = switchView;
    switchView = function(viewName) {
        handleSceneTransitionInit(viewName);
        originalSwitchView(viewName);
    };

    DOM.sandboxPlayNowBtn.addEventListener("click", () => {
        toggleSandboxMode(true);
        switchView("lobby");
    });

    DOM.resetBtn.addEventListener("click", () => {
        initAudio();
        SOUNDS.pop();
        if (STATE.guidedMode) {
            STATE.currentSlide = 0;
            updatePresentationUI();
        } else {
            switchView("intro");
        }
    });

    // Initialize layout defaults
    updatePresentationUI();
});
