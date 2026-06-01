/* ==========================================================================
   AMABILE DI ROSA - POUR DECISIONS: AR SIMULATOR GAMEPLAY CONTROLLER
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    
    // Sandbox game state
    const STATE = {
        players: [],      // Array of: { id, name, color, avatar, legitVotes, totalVotes }
        activePlayerIndex: null,
        activeCategory: null,
        drawnCard: null,
        spinsCount: 0,
        drawsCount: 0,
        isSpinning: false,
        isFlipped: false,
        audioContext: null
    };

    // Color palette registry for players
    const PLAYER_COLORS = [
        { main: "var(--brand-red)", text: "#FFFFFF", rgb: "232, 88, 53" },
        { main: "var(--brand-blue)", text: "#FFFFFF", rgb: "74, 107, 130" },
        { main: "var(--brand-green)", text: "#FFFFFF", rgb: "36, 161, 72" },
        { main: "#D97706", text: "#FFFFFF", rgb: "217, 119, 6" } // Amber
    ];

    // Card Prompt Database
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
    // AUDIO SYNTHESIZER
    // ==========================================================================
    function initAudio() {
        if (STATE.audioContext) return;
        try {
            STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn("Web Audio API is not supported.", e);
        }
    }

    function synthSound(freq, type, duration, sweepFreq = null) {
        initAudio();
        if (!STATE.audioContext) return;
        
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
        cap: () => synthSound(180, "sawtooth", 0.3, 100),
        pop: () => synthSound(600, "sine", 0.08, 1200)
    };

    // ==========================================================================
    // DOM CACHE
    // ==========================================================================
    const DOM = {
        views: document.querySelectorAll(".sim-view"),
        resetBtn: document.getElementById("simulator-reset-btn"),
        webcamStream: document.getElementById("webcam-stream"),
        dummyCamera: document.getElementById("dummy-camera-feed"),
        srAnnouncement: document.getElementById("sr-announcement"),

        // Scan View
        startScanningBtn: document.getElementById("start-scanning-btn"),
        mockScanSuccessBtn: document.getElementById("mock-scan-success-btn"),
        scanProgressBar: document.getElementById("scan-progress-bar"),
        scanHintText: document.getElementById("scan-hint-text"),

        // Lobby View
        playerOnboardForm: document.getElementById("player-onboard-form"),
        playerNameInput: document.getElementById("player-name-input"),
        lobbyPlayersList: document.getElementById("lobby-players-list"),
        lobbyStartGameBtn: document.getElementById("lobby-start-game-btn"),

        // Spinner View
        physicsBottle: document.getElementById("physics-bottle"),
        wheelSectorsContainer: document.getElementById("wheel-sectors-container"),
        spinnerPlayersBar: document.getElementById("spinner-players-bar"),
        selectedTargetPlayer: document.getElementById("selected-target-player"),
        turnActiveAvatar: document.getElementById("turn-active-avatar"),
        triggerSpinBtn: document.getElementById("trigger-spin-btn"),
        spinnerStatusTitle: document.getElementById("spinner-status-title"),

        // Cards View
        promptCardWrapper: document.getElementById("prompt-card-wrapper"),
        cardActiveAvatar: document.getElementById("card-active-avatar"),
        cardActiveName: document.getElementById("card-active-name"),
        drawnPromptContent: document.getElementById("drawn-prompt-content"),
        cardStripBg: document.getElementById("card-strip-bg"),
        cardStripIcon: document.getElementById("card-strip-icon"),
        cardStripLabel: document.getElementById("card-strip-label"),
        categoryButtons: document.querySelectorAll(".cat-selector-btn"),

        // Verdict View
        verdictPlayerAvatar: document.getElementById("verdict-player-avatar"),
        verdictPlayerName: document.getElementById("verdict-player-name"),
        verdictActivePromptDisplay: document.getElementById("verdict-active-prompt-display"),
        juryLegitBtn: document.getElementById("jury-legit-btn"),
        juryCapBtn: document.getElementById("jury-cap-btn"),
        juryPercentage: document.getElementById("jury-percentage"),
        juryBarLegit: document.getElementById("jury-bar-legit"),

        // Ending View
        confettiCanvas: document.getElementById("ending-confetti-canvas"),
        winnerAvatar: document.getElementById("winner-avatar"),
        winnerNameText: document.getElementById("winner-name-text"),
        winnerScoreText: document.getElementById("winner-score-text"),
        loserAvatar: document.getElementById("loser-avatar"),
        loserNameText: document.getElementById("loser-name-text"),
        loserScoreText: document.getElementById("loser-score-text"),
        gameRestartFinalBtn: document.getElementById("game-restart-final-btn"),
        simCommerceBtn: document.getElementById("sim-commerce-btn")
    };

    function announceToScreenReader(message) {
        if (DOM.srAnnouncement) {
            DOM.srAnnouncement.textContent = message;
        }
    }

    // ==========================================================================
    // VIEWPORT NAVIGATION STATE MACHINE
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
            DOM.scanProgressBar.style.width = "0%";
        } else {
            stopCameraStream();
        }

        if (viewName === "lobby") {
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

        announceToScreenReader(`Switched simulator scene to ${viewName}`);
    }

    // WebRTC Camera controller
    function startCameraStream() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            DOM.dummyCamera.style.opacity = "1";
            DOM.webcamStream.style.display = "none";
            return;
        }

        const constraints = {
            video: { width: { ideal: 360 }, height: { ideal: 640 }, facingMode: "user" },
            audio: false
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                DOM.webcamStream.srcObject = stream;
                DOM.webcamStream.style.display = "block";
                DOM.dummyCamera.style.opacity = "0";
            })
            .catch(err => {
                console.warn("Camera access denied.", err);
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
    // PHASE 1: SCANNINGFEED
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
                    
                    switchView("lobby");
                }, 1000);
            }
        }, 150);
    }

    DOM.startScanningBtn.addEventListener("click", () => switchView("scan"));
    DOM.mockScanSuccessBtn.addEventListener("click", executeSimulatedScan);

    // ==========================================================================
    // PHASE 2: PLAYER LOBBY
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

        updateActivePlayersSpinnerBar();
    }

    function addPlayer(name) {
        if (STATE.players.length >= 4) return;
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
    }

    function removePlayer(index) {
        STATE.players.splice(index, 1);
        STATE.players.forEach((player, idx) => {
            player.color = PLAYER_COLORS[idx].main;
            player.textCol = PLAYER_COLORS[idx].text;
        });
        SOUNDS.click();
        renderPlayersLobbyList();
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
            switchView("spinner");
        }
    });

    function guaranteeTestPlayers() {
        if (STATE.players.length < 2) {
            STATE.players = [];
            addPlayer("Alex");
            addPlayer("Jordan");
            addPlayer("Taylor");
        }
    }

    // ==========================================================================
    // PHASE 3: INTERACTIVE BOTTLE SPINNER PHYSICS
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
            const wedge = document.createElement("div");
            wedge.className = "sector-wedge";
            wedge.style.backgroundColor = player.color;
            wedge.style.opacity = "0.08";
            
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
        
        document.querySelectorAll(".mini-avatar-bubble").forEach(b => b.classList.remove("active-spinner-target"));

        let angularVelocity = Math.random() * 40 + 40;
        const friction = 0.978;
        let totalWedgesCrossed = 0;
        const degPerPlayer = 360 / STATE.players.length;

        function animateSpin() {
            if (angularVelocity < 0.05) {
                STATE.isSpinning = false;
                DOM.triggerSpinBtn.removeAttribute("disabled");
                DOM.spinnerStatusTitle.textContent = "TAP BOTTLE TO SPIN";
                
                const finalRotationDegrees = (currentRotation % 360 + 360) % 360;
                const pointingAngle = (360 - finalRotationDegrees) % 360;
                const winnerIndex = Math.floor(pointingAngle / degPerPlayer) % STATE.players.length;
                
                resolveSpinnerTurn(winnerIndex);
                return;
            }

            currentRotation += angularVelocity;
            DOM.physicsBottle.style.transform = `rotate(${currentRotation}deg)`;
            angularVelocity *= friction;

            const crossedCount = Math.floor(currentRotation / degPerPlayer);
            if (crossedCount > totalWedgesCrossed) {
                totalWedgesCrossed = crossedCount;
                SOUNDS.click();
                
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

        document.querySelectorAll(".mini-avatar-bubble").forEach(b => b.classList.remove("active-spinner-target"));
        const bubble = document.getElementById(`mini-av-${winnerIndex}`);
        if (bubble) bubble.classList.add("active-spinner-target");

        DOM.selectedTargetPlayer.textContent = player.name;
        DOM.turnActiveAvatar.textContent = player.avatar;
        DOM.turnActiveAvatar.style.backgroundColor = player.color;
        DOM.turnActiveAvatar.style.color = player.textCol;

        setTimeout(() => {
            switchView("cards");
        }, 1800);
    }

    DOM.triggerSpinBtn.addEventListener("click", executeBottleSpin);
    DOM.physicsBottle.addEventListener("click", executeBottleSpin);

    // ==========================================================================
    // PHASE 4: PROMPTS CARD DRAW
    // ==========================================================================
    function preparePromptCardDraw() {
        guaranteeTestPlayers();
        if (STATE.activePlayerIndex === null) {
            STATE.activePlayerIndex = 0;
        }

        const activePlayer = STATE.players[STATE.activePlayerIndex];

        DOM.cardActiveName.textContent = activePlayer.name;
        DOM.cardActiveAvatar.textContent = activePlayer.avatar;
        DOM.cardActiveAvatar.style.backgroundColor = activePlayer.color;
        DOM.cardActiveAvatar.style.color = activePlayer.textCol;

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

        DOM.drawnPromptContent.textContent = randomPrompt;
        
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

        SOUNDS.swish();
        DOM.promptCardWrapper.classList.add("is-flipped");
        STATE.isFlipped = true;

        setTimeout(() => {
            switchView("verdict");
        }, 3000);
    }

    DOM.categoryButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const category = btn.getAttribute("data-category");
            executeCardDraw(category);
        });
    });

    DOM.promptCardWrapper.addEventListener("click", () => {
        if (STATE.isFlipped) {
            DOM.promptCardWrapper.classList.remove("is-flipped");
            STATE.isFlipped = false;
            SOUNDS.swish();
        }
    });

    // ==========================================================================
    // PHASE 5: THE PEER JURY VERDICT
    // ==========================================================================
    function prepareJuryVerdictView() {
        guaranteeTestPlayers();
        if (STATE.activePlayerIndex === null) {
            STATE.activePlayerIndex = 0;
        }

        const activePlayer = STATE.players[STATE.activePlayerIndex];
        const promptDrawn = STATE.drawnCard || "Tell the group your funniest secret or take a sip of Amabile di Rosa.";

        DOM.verdictPlayerName.textContent = activePlayer.name;
        DOM.verdictPlayerAvatar.textContent = activePlayer.avatar;
        DOM.verdictPlayerAvatar.style.backgroundColor = activePlayer.color;
        DOM.verdictPlayerAvatar.style.color = activePlayer.textCol;
        DOM.verdictActivePromptDisplay.textContent = promptDrawn;

        STATE.votesLegit = 0;
        STATE.votesTotal = 0;
        updateJuryVerdictsBarDisplay();
    }

    function updateJuryVerdictsBarDisplay() {
        if (STATE.votesTotal === 0) {
            DOM.juryPercentage.textContent = "Jury has not voted";
            DOM.juryBarLegit.style.width = "50%";
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

        const player = STATE.players[STATE.activePlayerIndex];
        if (isLegit) player.legitVotes++;
        player.totalVotes++;

        updateJuryVerdictsBarDisplay();

        if (STATE.votesTotal >= 2) {
            setTimeout(() => {
                if (STATE.spinsCount >= 3) {
                    switchView("ending");
                } else {
                    switchView("spinner");
                }
            }, 1500);
        }
    }

    DOM.juryLegitBtn.addEventListener("click", () => recordJuryVote(true));
    DOM.juryCapBtn.addEventListener("click", () => recordJuryVote(false));

    // ==========================================================================
    // PHASE 6: OUTCOME CELEBRATIONS
    // ==========================================================================
    let confettiAnimationFrame = null;

    function prepareEndingCelebrationView() {
        guaranteeTestPlayers();

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

        DOM.winnerNameText.textContent = winner.name;
        DOM.winnerAvatar.textContent = winner.avatar;
        DOM.winnerAvatar.style.backgroundColor = winner.color;
        DOM.winnerAvatar.style.color = winner.textCol;
        DOM.winnerScoreText.textContent = `${Math.round(highestScore)}% Legit`;

        DOM.loserNameText.textContent = loser.name;
        DOM.loserAvatar.textContent = loser.avatar;
        DOM.loserAvatar.style.backgroundColor = loser.color;
        DOM.loserAvatar.style.color = loser.textCol;
        DOM.loserScoreText.textContent = `${Math.round(lowestScore)}% Legit`;
        
        SOUNDS.win();
        triggerEndingConfetti();
    }

    function triggerEndingConfetti() {
        const canvas = DOM.confettiCanvas;
        const ctx = canvas.getContext("2d");
        
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
        switchView("intro");
    });

    DOM.simCommerceBtn.addEventListener("click", () => {
        SOUNDS.win();
        alert("Loser redirected to purchase checklist. Branded bottle of Amabile di Rosa added to basket!");
    });

    DOM.resetBtn.addEventListener("click", () => {
        initAudio();
        SOUNDS.pop();
        switchView("intro");
    });

    // Boot simulator in introwelcome view
    switchView("intro");
});
