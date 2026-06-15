// --- DOM Elements ---
const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const sidebar = document.getElementById('sidebar');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const collapseBtn = document.getElementById('collapseBtn');
const floatingExpandBtn = document.getElementById('floatingExpandBtn');

// Mode buttons
const modeBtns = document.querySelectorAll('.segment-btn[data-mode]');
const wallParams = document.getElementById('wallParams');
const twoBodyParams = document.getElementById('twoBodyParams');

// Sidebar Sliders & Labels
const wallMassInput = document.getElementById('wallMass');
const wallMassVal = document.getElementById('wallMassVal');
const wallVelInput = document.getElementById('wallVel');
const wallVelVal = document.getElementById('wallVelVal');
const wallElasticityInput = document.getElementById('wallElasticity');
const wallElasticityVal = document.getElementById('wallElasticityVal');

const objAMassInput = document.getElementById('objAMass');
const objAMassVal = document.getElementById('objAMassVal');
const objAVelInput = document.getElementById('objAVel');
const objAVelVal = document.getElementById('objAVelVal');
const objBMassInput = document.getElementById('objBMass');
const objBMassVal = document.getElementById('objBMassVal');
const objBVelInput = document.getElementById('objBVel');
const objBVelVal = document.getElementById('objBVelVal');
const twoBodyElasticityInput = document.getElementById('twoBodyElasticity');
const twoBodyElasticityVal = document.getElementById('twoBodyElasticityVal');

// Simulation Speed Slider & Checkbox
const simSpeedInput = document.getElementById('simSpeed');
const simSpeedVal = document.getElementById('simSpeedVal');
const stopObjAAfterCollisionInput = document.getElementById('stopObjAAfterCollision');

// Playback Controls
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');

const floatPlayBtn = document.getElementById('floatPlayBtn');
const floatPrevBtn = document.getElementById('floatPrevBtn');
const floatNextBtn = document.getElementById('floatNextBtn');
const floatResetBtn = document.getElementById('floatResetBtn');
const floatingPlayback = document.getElementById('floatingPlayback');

// Zoom & Graph Controls
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomFitBtn = document.getElementById('zoomFitBtn');
const graphToggleBtn = document.getElementById('graphToggleBtn');
const graphCard = document.getElementById('graphCard');
const graphCloseBtn = document.getElementById('graphCloseBtn');
const graphCanvas = document.getElementById('graphCanvas');
const graphCtx = graphCanvas.getContext('2d');
const graphVals = document.getElementById('graphVals');
const overlayStats = document.getElementById('overlayStats');
const statsGrid = document.getElementById('statsGrid');

// --- Physics & Simulation Constants ---
const dt = 1 / 60; // 60 FPS time step
const collisionDuration = 24; // Duration of collision in frames (~0.4s)
const floorY = 320; // Floor level in world Y coordinates
const wallX = 600;  // Wall level in world X coordinates

// --- Simulation State ---
let simMode = 'wall'; // 'wall' or 'two-body'
let isPlaying = false;
let playSpeed = 1.0;  // Speed multiplier: 1.0 or 0.2 (Slow-mo)
let currentFrame = 0;
let history = [];     // Precalculated array of states

// --- Zoom & Pan State ---
let zoomScale = 1.0;
let panX = 0;
let panY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let startPanX = 0;
let startPanY = 0;
let isCameraUserModified = false;

// Multi-touch Pinch zoom tracking
let activeTouches = {};

// Cosmetic Spark Particles
let activeParticles = [];

// Audio Context (Web Audio API for synthesized thud sounds)
let audioCtx = null;

// --- Initialize App ---
function init() {
    setupEventListeners();
    resizeCanvas();
    updateThemeUI();
    precalculate();
    resetSimulation();
    animate();
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    window.addEventListener('resize', () => {
        resizeCanvas();
        draw();
    });

    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Sidebar toggles
    collapseBtn.addEventListener('click', collapseSidebar);
    floatingExpandBtn.addEventListener('click', expandSidebar);

    // Mode Selector
    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnTarget = e.currentTarget;
            modeBtns.forEach(b => b.classList.remove('active'));
            btnTarget.classList.add('active');
            
            simMode = btnTarget.dataset.mode;
            if (simMode === 'wall') {
                wallParams.style.display = 'block';
                twoBodyParams.style.display = 'none';
                document.getElementById('dropParams').style.display = 'none';
            } else if (simMode === 'two-body') {
                wallParams.style.display = 'none';
                twoBodyParams.style.display = 'block';
                document.getElementById('dropParams').style.display = 'none';
            } else {
                wallParams.style.display = 'none';
                twoBodyParams.style.display = 'none';
                document.getElementById('dropParams').style.display = 'block';
            }
            
            precalculate();
            resetSimulation();
        });
    });

    // Connect slider inputs to precalculation updates
    const sliders = [
        { el: wallMassInput, valEl: wallMassVal, suffix: ' kg' },
        { el: wallVelInput, valEl: wallVelVal, suffix: ' m/s' },
        { el: wallElasticityInput, valEl: wallElasticityVal, suffix: '' },
        { el: objAMassInput, valEl: objAMassVal, suffix: ' kg' },
        { el: objAVelInput, valEl: objAVelVal, suffix: ' m/s' },
        { el: objBMassInput, valEl: objBMassVal, suffix: ' kg' },
        { el: objBVelInput, valEl: objBVelVal, suffix: ' m/s' },
        { el: twoBodyElasticityInput, valEl: twoBodyElasticityVal, suffix: '' },
        { el: document.getElementById('dropHeight'), valEl: document.getElementById('dropHeightVal'), suffix: ' m' },
        { el: document.getElementById('dropMass'), valEl: document.getElementById('dropMassVal'), suffix: ' kg' },
        { el: document.getElementById('dropDurationA'), valEl: document.getElementById('dropDurationAVal'), suffix: '', callback: (val) => `${(val / 60).toFixed(2)} 초 (${val}프레임)` },
        { el: document.getElementById('dropDurationB'), valEl: document.getElementById('dropDurationBVal'), suffix: '', callback: (val) => `${(val / 60).toFixed(2)} 초 (${val}프레임)` }
    ];

    sliders.forEach(slider => {
        if (!slider.el) return;
        slider.el.addEventListener('input', (e) => {
            if (slider.callback) {
                slider.valEl.textContent = slider.callback(e.target.value);
            } else {
                slider.valEl.textContent = e.target.value + slider.suffix;
            }
            precalculate();
            resetSimulation();
        });
    });

    // Speed Control Slider
    if (simSpeedInput) {
        simSpeedInput.addEventListener('input', (e) => {
            playSpeed = parseFloat(e.target.value);
            simSpeedVal.textContent = playSpeed.toFixed(1) + 'x';
        });
    }

    // Stop Object A Checkbox
    if (stopObjAAfterCollisionInput) {
        stopObjAAfterCollisionInput.addEventListener('change', () => {
            precalculate();
            resetSimulation();
        });
    }

    // Playback buttons
    const triggerPlay = () => {
        isPlaying = !isPlaying;
        updatePlaybackUI();
    };

    playBtn.addEventListener('click', triggerPlay);
    floatPlayBtn.addEventListener('click', triggerPlay);

    const triggerPrev = () => {
        isPlaying = false;
        updatePlaybackUI();
        if (currentFrame > 0) {
            currentFrame = Math.max(0, currentFrame - 5);
            draw();
        }
    };
    prevBtn.addEventListener('click', triggerPrev);
    floatPrevBtn.addEventListener('click', triggerPrev);

    const triggerNext = () => {
        isPlaying = false;
        updatePlaybackUI();
        if (currentFrame < history.length - 1) {
            currentFrame = Math.min(history.length - 1, currentFrame + 5);
            draw();
        }
    };
    nextBtn.addEventListener('click', triggerNext);
    floatNextBtn.addEventListener('click', triggerNext);

    const triggerReset = () => {
        isCameraUserModified = false;
        resetSimulation();
    };
    resetBtn.addEventListener('click', triggerReset);
    floatResetBtn.addEventListener('click', triggerReset);

    // Zoom Buttons
    zoomInBtn.addEventListener('click', () => zoom(1.2, canvas.width / 2, canvas.height / 2));
    zoomOutBtn.addEventListener('click', () => zoom(1 / 1.2, canvas.width / 2, canvas.height / 2));
    zoomFitBtn.addEventListener('click', () => {
        isCameraUserModified = false;
        draw();
    });
    
    // Graph toggle buttons
    graphToggleBtn.addEventListener('click', () => {
        graphCard.classList.toggle('collapsed');
        draw();
    });
    graphCloseBtn.addEventListener('click', () => {
        graphCard.classList.add('collapsed');
        draw();
    });
    // Graph zoom and fullscreen controls
    const graphZoomControl = document.getElementById('graphZoomControl');
    if (graphZoomControl) {
        const zoomBtns = graphZoomControl.querySelectorAll('.small-segment');
        zoomBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                zoomBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Exit fullscreen when selecting specific zoom
                graphCard.classList.remove('view-fullscreen');
                const graphFullscreenBtn = document.getElementById('graphFullscreenBtn');
                if (graphFullscreenBtn) {
                    graphFullscreenBtn.querySelector('.fullscreen-enter-icon').style.display = 'block';
                    graphFullscreenBtn.querySelector('.fullscreen-exit-icon').style.display = 'none';
                    graphFullscreenBtn.title = "전체화면 보기";
                }
                
                const zoomVal = btn.dataset.zoom;
                if (zoomVal === '100') {
                    graphCard.classList.add('view-100');
                    graphCard.classList.remove('view-300');
                } else {
                    graphCard.classList.add('view-300');
                    graphCard.classList.remove('view-100');
                }
                
                // Adjust viewport immediately
                draw();
                
                // Redraw current frame graph
                setTimeout(() => {
                    const state = history[currentFrame] || history[0];
                    drawGraph(state);
                }, 350);
            });
        });
    }

    const graphFullscreenBtn = document.getElementById('graphFullscreenBtn');
    if (graphFullscreenBtn) {
        graphFullscreenBtn.addEventListener('click', () => {
            const isFullscreen = graphCard.classList.toggle('view-fullscreen');
            const enterIcon = graphFullscreenBtn.querySelector('.fullscreen-enter-icon');
            const exitIcon = graphFullscreenBtn.querySelector('.fullscreen-exit-icon');
            
            if (isFullscreen) {
                enterIcon.style.display = 'none';
                exitIcon.style.display = 'block';
                graphFullscreenBtn.title = "전체화면 종료";
            } else {
                enterIcon.style.display = 'block';
                exitIcon.style.display = 'none';
                graphFullscreenBtn.title = "전체화면 보기";
            }
            
            // Adjust viewport immediately
            draw();
            
            // Redraw current frame graph after resizing
            setTimeout(() => {
                const state = history[currentFrame] || history[0];
                drawGraph(state);
            }, 350);
        });
    }

    // Canvas Pointer events for Zooming & Drag Panning
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Collapsible Real-time Stats panel
    const statsHeader = document.getElementById('statsHeader');
    if (statsHeader) {
        statsHeader.addEventListener('click', () => {
            const overlayStats = document.getElementById('overlayStats');
            if (overlayStats) {
                overlayStats.classList.toggle('collapsed');
            }
        });
    }
}

// --- Canvas Resizing ---
function resizeCanvas() {
    const rect = canvas.parentNode.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Scale backing store for sharp retina rendering
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    ctx.scale(dpr, dpr);
}

// --- Sidebar Collapse/Expand ---
function collapseSidebar() {
    sidebar.classList.add('collapsed');
    floatingExpandBtn.style.display = 'flex';
    floatingPlayback.style.display = 'flex';
    
    // Let's trigger a transition resize
    setTimeout(() => {
        resizeCanvas();
        draw();
    }, 300);
}

function expandSidebar() {
    sidebar.classList.remove('collapsed');
    floatingExpandBtn.style.display = 'none';
    floatingPlayback.style.display = 'none';
    
    setTimeout(() => {
        resizeCanvas();
        draw();
    }, 300);
}

// --- Theme Management ---
function toggleTheme() {
    document.body.classList.toggle('light-theme');
    updateThemeUI();
    draw();
}

function updateThemeUI() {
    const isLight = document.body.classList.contains('light-theme');
    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');
    
    if (isLight) {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
    }
}

// --- Playback State UI syncing ---
function updatePlaybackUI() {
    const playIcons = document.querySelectorAll('.play-icon');
    const pauseIcons = document.querySelectorAll('.pause-icon');
    
    if (isPlaying) {
        playIcons.forEach(i => i.style.display = 'none');
        pauseIcons.forEach(i => i.style.display = 'block');
    } else {
        playIcons.forEach(i => i.style.display = 'block');
        pauseIcons.forEach(i => i.style.display = 'none');
    }
}

// --- Panning & Zooming Math ---
function screenToWorld(sx, sy) {
    return {
        x: (sx - panX) / zoomScale,
        y: (sy - panY) / zoomScale
    };
}

function zoom(factor, centerX, centerY) {
    isCameraUserModified = true;
    const worldPt = screenToWorld(centerX, centerY);
    
    zoomScale = Math.min(Math.max(0.2, zoomScale * factor), 5.0);
    
    panX = centerX - worldPt.x * zoomScale;
    panY = centerY - worldPt.y * zoomScale;
    
    draw();
}

function fitView() {
    if (isCameraUserModified) return;
    
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    
    // Determine the deterministic width of the graph card
    let graphWidth = 0;
    const graphCard = document.getElementById('graphCard');
    if (graphCard && !graphCard.classList.contains('collapsed') && !graphCard.classList.contains('view-fullscreen')) {
        if (graphCard.classList.contains('view-300')) {
            graphWidth = 800;
        } else {
            graphWidth = 380; // view-100 or default
        }
    }
    
    // Calculate visible width of the canvas (excluding graph card overlay on the right)
    let visibleWidth = w;
    if (graphWidth > 0 && w > 600) {
        visibleWidth = w - (graphWidth + 20);
    }
    
    const state = history[currentFrame] || history[0];
    if (!state) return;
    
    // Calculate bounds of objects we want to display
    let minX, maxX;
    
    if (simMode === 'drop') {
        const r = state.objA.r;
        const dHeight = state.dHeight || 3.0;
        const scale = 45;
        
        minX = 220 - r - 80;
        maxX = 460 + r + 80;
        const sceneWidth = maxX - minX;
        
        const requiredZoom = visibleWidth / sceneWidth;
        zoomScale = Math.min(Math.max(0.25, requiredZoom), 1.25);
        
        panX = visibleWidth / 2 - (minX + maxX) / 2 * zoomScale;
        
        // Center the vertical height of the drop in the canvas
        const dropTopY = floorY - dHeight * scale - r;
        const dropBottomY = floorY + 40;
        
        panY = (h / 2) - (dropTopY + dropBottomY) / 2 * zoomScale;
        return;
    }
    
    minX = state.objA.x - state.objA.r;
    maxX = state.objA.x + state.objA.r;
    
    if (simMode === 'two-body') {
        minX = Math.min(minX, state.objB.x - state.objB.r);
        maxX = Math.max(maxX, state.objB.x + state.objB.r);
    } else {
        // Wall mode: include the wall
        minX = Math.min(minX, 0);
        maxX = Math.max(maxX, wallX + 40);
    }
    
    // Add margins (50px in world coordinates)
    const margin = 50;
    minX -= margin;
    maxX += margin;
    
    const sceneWidth = maxX - minX;
    
    // Adjust zoomScale to fit visible width
    const requiredZoom = visibleWidth / sceneWidth;
    zoomScale = Math.min(Math.max(0.25, requiredZoom), 1.25);
    
    // Center the scene horizontally in the visible area
    panX = visibleWidth / 2 - (minX + maxX) / 2 * zoomScale;
    
    // Center the floor vertically in the canvas height
    // floorY in world is 320. We want the floor to sit around h/2 + 50
    panY = (h / 2 + 50) - floorY * zoomScale;
}

// Event handlers for dragging and zooming
function onPointerDown(e) {
    canvas.setPointerCapture(e.pointerId);
    activeTouches[e.pointerId] = { x: e.offsetX, y: e.offsetY };
    
    const touchKeys = Object.keys(activeTouches);
    if (touchKeys.length === 1) {
        isDragging = true;
        startDragX = e.offsetX;
        startDragY = e.offsetY;
        startPanX = panX;
        startPanY = panY;
    }
}

function onPointerMove(e) {
    if (!activeTouches[e.pointerId]) return;
    
    activeTouches[e.pointerId] = { x: e.offsetX, y: e.offsetY };
    const touchKeys = Object.keys(activeTouches);
    
    if (touchKeys.length === 2) {
        // Pinch-to-zoom logic
        isDragging = false;
        isCameraUserModified = true;
        const p1 = activeTouches[touchKeys[0]];
        const p2 = activeTouches[touchKeys[1]];
        
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        
        if (this.lastPinchDist) {
            const factor = dist / this.lastPinchDist;
            zoom(factor, midX, midY);
        }
        this.lastPinchDist = dist;
    } else if (isDragging && touchKeys.length === 1) {
        isCameraUserModified = true;
        const dx = e.offsetX - startDragX;
        const dy = e.offsetY - startDragY;
        panX = startPanX + dx;
        panY = startPanY + dy;
        draw();
    }
}

function onPointerUp(e) {
    delete activeTouches[e.pointerId];
    canvas.releasePointerCapture(e.pointerId);
    
    const touchKeys = Object.keys(activeTouches);
    if (touchKeys.length < 2) {
        this.lastPinchDist = null;
    }
    if (touchKeys.length === 0) {
        isDragging = false;
    }
}

function onWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoom(zoomFactor, e.offsetX, e.offsetY);
}

// --- Synthesized Sound Generator ---
function playThud(intensity, elasticity) {
    // Lazy initialize AudioContext on user action
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const lowpass = audioCtx.createBiquadFilter();
        
        osc.connect(lowpass);
        lowpass.connect(gain);
        gain.connect(audioCtx.destination);
        
        // Pitch mapping: high bounce = high pitch, heavy inelastic = low thud
        let basePitch = 120 + elasticity * 160 - intensity * 2;
        basePitch = Math.max(50, Math.min(400, basePitch));
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(basePitch, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.18);
        
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(400, audioCtx.currentTime);
        lowpass.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.15);
        
        // Volume maps to collision intensity
        let volume = Math.min(0.6, 0.05 + intensity * 0.008);
        
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.22);
    } catch (err) {
        console.warn("Web Audio blocked or not supported:", err);
    }
}

// --- Particles Generator ---
function spawnSparks(x, y, dir, count = 15) {
    for (let i = 0; i < count; i++) {
        // Random velocity vector centered around normal direction
        const angle = dir + (Math.random() - 0.5) * Math.PI * 0.8;
        const speed = 2 + Math.random() * 6;
        activeParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (1 + Math.random() * 2), // upward bias
            life: 1.0,
            decay: 0.02 + Math.random() * 0.03,
            color: `hsl(${25 + Math.random() * 25}, 100%, ${60 + Math.random() * 20}%)` // fiery yellow-orange sparks
        });
    }
}

function updateParticles() {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gravity
        p.life -= p.decay;
        if (p.life <= 0) {
            activeParticles.splice(i, 1);
        }
    }
}

function precalculate() {
    history = [];
    
    // Check if we are in drop mode and precalculate vertically
    if (simMode === 'drop') {
        const dHeightInput = document.getElementById('dropHeight');
        const dMassInput = document.getElementById('dropMass');
        const dDurAInput = document.getElementById('dropDurationA');
        const dDurBInput = document.getElementById('dropDurationB');
        
        const dHeight = dHeightInput ? parseFloat(dHeightInput.value) : 3.0;
        const dMass = dMassInput ? parseInt(dMassInput.value) : 5;
        const dDurA = dDurAInput ? parseInt(dDurAInput.value) : 30;
        const dDurB = dDurBInput ? parseInt(dDurBInput.value) : 10;
        
        const g = 9.8;
        const scale = 45;
        const r = 30 + dMass * 3;
        
        const Y_init = floorY - dHeight * scale - r;
        const t_fall = Math.sqrt(2 * dHeight / g);
        const f_hit = Math.floor(t_fall / dt);
        const v_hit = g * t_fall;
        
        const impulse = dMass * v_hit;
        const fMaxA = impulse * Math.PI / (2 * dDurA * dt);
        const fMaxB = impulse * Math.PI / (2 * dDurB * dt);
        
        let hasCollidedA = false;
        let hasCollidedB = false;
        
        for (let f = 0; f < 600; f++) {
            const t = f * dt;
            let frameState = {
                frame: f,
                mode: 'drop',
                objA: { x: 220, y: floorY - r, vx: 0, vy: 0, m: dMass, r: r },
                objB: { x: 460, y: floorY - r, vx: 0, vy: 0, m: dMass, r: r },
                forceA: 0,
                forceB: 0,
                isCollidingA: false,
                isCollidingB: false,
                hasCollidedA: false,
                hasCollidedB: false,
                fMaxA: fMaxA,
                fMaxB: fMaxB,
                v_hit: v_hit,
                dHeight: dHeight,
                dDurA: dDurA,
                dDurB: dDurB,
                collisionStartFrame: f_hit
            };
            
            // A Calculations (Cushion)
            if (f < f_hit) {
                const dist = 0.5 * g * t * t;
                frameState.objA.y = Y_init + dist * scale;
                frameState.objA.vy = g * t;
            } else if (f < f_hit + dDurA) {
                hasCollidedA = true;
                frameState.isCollidingA = true;
                const progress = (f - f_hit + 1) / dDurA;
                frameState.objA.vy = v_hit * 0.5 * (1 + Math.cos(Math.PI * progress));
                frameState.forceA = fMaxA * Math.sin(Math.PI * progress);
                const squish = 1.0 - (frameState.forceA / fMaxA) * 0.15;
                frameState.objA.y = floorY - r * squish;
            } else {
                hasCollidedA = true;
                frameState.objA.y = floorY - r;
                frameState.objA.vy = 0;
            }
            frameState.hasCollidedA = hasCollidedA;
            
            // B Calculations (Concrete)
            if (f < f_hit) {
                const dist = 0.5 * g * t * t;
                frameState.objB.y = Y_init + dist * scale;
                frameState.objB.vy = g * t;
            } else if (f < f_hit + dDurB) {
                hasCollidedB = true;
                frameState.isCollidingB = true;
                const progress = (f - f_hit + 1) / dDurB;
                frameState.objB.vy = v_hit * 0.5 * (1 + Math.cos(Math.PI * progress));
                frameState.forceB = fMaxB * Math.sin(Math.PI * progress);
                const squish = 1.0 - (frameState.forceB / fMaxB) * 0.15;
                frameState.objB.y = floorY - r * squish;
            } else {
                hasCollidedB = true;
                frameState.objB.y = floorY - r;
                frameState.objB.vy = 0;
            }
            frameState.hasCollidedB = hasCollidedB;
            
            history.push(frameState);
        }
        return;
    }

    // Get all values from inputs
    let state = {
        frame: 0,
        mode: simMode,
        objA: {
            x: 100,
            vx: simMode === 'wall' ? parseInt(wallVelInput.value) : parseInt(objAVelInput.value),
            m: simMode === 'wall' ? parseInt(wallMassInput.value) : parseInt(objAMassInput.value),
        },
        objB: {
            x: simMode === 'wall' ? 99999 : 500,
            vx: simMode === 'wall' ? 0 : parseInt(objBVelInput.value),
            m: simMode === 'wall' ? 1 : parseInt(objBMassInput.value),
        },
        e: simMode === 'wall' ? parseFloat(wallElasticityInput.value) : parseFloat(twoBodyElasticityInput.value),
        isColliding: false,
        collisionProgress: -1,
        collisionStartFrame: -1,
        vAi: 0, vAf: 0,
        vBi: 0, vBf: 0,
        fMax: 0,
        force: 0,
        hasCollided: false
    };
    
    // Radius formula (scaled linearly with mass)
    state.objA.r = 30 + state.objA.m * 3;
    state.objB.r = 30 + state.objB.m * 3;
    
    // Set proper initial locations to avoid early collisions
    state.objA.x = 120;
    if (simMode === 'two-body') {
        state.objB.x = 480;
    }
    
    // Pre-calculated variables
    let collisionTriggered = false;
    let colStart = -1;
    let colEnd = -1;
    let vAi_col = 0, vBi_col = 0;
    let vAf_col = 0, vBf_col = 0;
    let fMax_col = 0;
    let hasCollided_flag = false;
    
    // Step forward 600 frames
    for (let f = 0; f < 600; f++) {
        // deep copy current state
        let frameState = JSON.parse(JSON.stringify(state));
        frameState.frame = f;
        
        if (!state.isColliding) {
            let collisionDetect = false;
            
            if (simMode === 'wall') {
                // Ball hits wall at wallX = 600
                if (state.objA.vx > 0 && state.objA.x + state.objA.r >= wallX) {
                    collisionDetect = true;
                    // Snap to collision boundary to avoid visually intersecting the wall
                    state.objA.x = wallX - state.objA.r;
                }
            } else {
                // Ball A hits Ball B
                let dist = state.objB.x - state.objA.x;
                let minDist = state.objA.r + state.objB.r;
                
                // If touching and moving towards each other
                if (dist <= minDist && (state.objA.vx - state.objB.vx) > 0) {
                    collisionDetect = true;
                    // Snap positions exactly touching
                    let overlap = minDist - dist;
                    state.objA.x -= overlap / 2;
                    state.objB.x += overlap / 2;
                }
            }
            
            if (collisionDetect && !hasCollided_flag) {
                state.isColliding = true;
                state.collisionProgress = 0;
                state.collisionStartFrame = f;
                colStart = f;
                hasCollided_flag = true;
                
                vAi_col = state.objA.vx;
                vBi_col = state.objB.vx;
                
                // Solve collision velocities
                if (simMode === 'wall') {
                    vAf_col = -state.e * vAi_col;
                    vBf_col = 0;
                    
                    let impulse = state.objA.m * (vAf_col - vAi_col);
                    fMax_col = Math.abs(impulse * Math.PI / (2 * collisionDuration * dt));
                } else {
                    let mA = state.objA.m;
                    let mB = state.objB.m;
                    if (stopObjAAfterCollisionInput && stopObjAAfterCollisionInput.checked) {
                        vAf_col = 0;
                        vBf_col = (mA * vAi_col + mB * vBi_col) / mB;
                    } else {
                        vAf_col = (mA * vAi_col + mB * vBi_col - state.e * mB * (vAi_col - vBi_col)) / (mA + mB);
                        vBf_col = (mA * vAi_col + mB * vBi_col + state.e * mA * (vAi_col - vBi_col)) / (mA + mB);
                    }
                    
                    let impulse = mA * (vAf_col - vAi_col);
                    fMax_col = Math.abs(impulse * Math.PI / (2 * collisionDuration * dt));
                }
                
                state.vAi = vAi_col;
                state.vBi = vBi_col;
                state.vAf = vAf_col;
                state.vBf = vBf_col;
                state.fMax = fMax_col;
            }
        }
        
        if (state.isColliding) {
            state.collisionProgress++;
            let progress = state.collisionProgress / collisionDuration;
            
            // Smoothed cosine profile mapping initial velocity to final velocity
            state.objA.vx = vAi_col + (vAf_col - vAi_col) * 0.5 * (1 - Math.cos(Math.PI * progress));
            if (simMode === 'two-body') {
                state.objB.vx = vBi_col + (vBf_col - vBi_col) * 0.5 * (1 - Math.cos(Math.PI * progress));
            }
            
            // Force curve
            state.force = fMax_col * Math.sin(Math.PI * progress);
            
            state.objA.x += state.objA.vx * dt * 45; // 45px per m/s
            if (simMode === 'two-body') {
                state.objB.x += state.objB.vx * dt * 45;
            }
            
            if (state.collisionProgress >= collisionDuration) {
                state.isColliding = false;
                state.collisionProgress = -1;
                state.objA.vx = vAf_col;
                state.objB.vx = vBf_col;
                state.force = 0;
            }
        } else {
            state.objA.x += state.objA.vx * dt * 45;
            if (simMode === 'two-body') {
                state.objB.x += state.objB.vx * dt * 45;
            }
            state.force = 0;
        }
        
        // Populate frame calculations
        frameState.isColliding = state.isColliding;
        frameState.collisionProgress = state.collisionProgress;
        frameState.collisionStartFrame = colStart;
        frameState.vAi = vAi_col;
        frameState.vBi = vBi_col;
        frameState.vAf = vAf_col;
        frameState.vBf = vBf_col;
        frameState.fMax = fMax_col;
        frameState.force = state.force;
        frameState.hasCollided = hasCollided_flag;
        
        frameState.objA.x = state.objA.x;
        frameState.objA.vx = state.objA.vx;
        frameState.objB.x = state.objB.x;
        frameState.objB.vx = state.objB.vx;
        
        history.push(frameState);
    }
}

// --- Reset Simulation ---
function resetSimulation() {
    currentFrame = 0;
    isPlaying = false;
    activeParticles = [];
    updatePlaybackUI();
    draw();
}

// --- Main Drawing Loop ---
function animate() {
    if (isPlaying) {
        // Slow-mo speed scaling
        let framesToAdvance = playSpeed === 1.0 ? 1 : 1; 
        
        // If slow-motion, we handle fractional frame advance
        if (playSpeed < 1.0) {
            if (!this.accumulatedFrame) this.accumulatedFrame = 0;
            this.accumulatedFrame += playSpeed;
            if (this.accumulatedFrame >= 1.0) {
                framesToAdvance = Math.floor(this.accumulatedFrame);
                this.accumulatedFrame -= framesToAdvance;
            } else {
                framesToAdvance = 0;
            }
        }
        
        if (framesToAdvance > 0) {
            // Trigger sound and sparks when collision starts
            const nextF = Math.min(currentFrame + framesToAdvance, history.length - 1);
            
            // Check if we hit the collision frame in history
            const prevS = history[currentFrame];
            const nextS = history[nextF];
            
            if (nextS.isColliding && (!prevS.isColliding || prevS.collisionProgress === -1)) {
                // Collision just started! Play thud & sparks
                let intensity = Math.abs(nextS.vAi - nextS.vBi) * nextS.objA.m;
                playThud(intensity, nextS.e);
                
                // Spawn sparkles
                if (simMode === 'wall') {
                    spawnSparks(wallX, floorY - 50, Math.PI, 18);
                } else {
                    let avgX = (nextS.objA.x + nextS.objA.r + nextS.objB.x - nextS.objB.r) / 2;
                    spawnSparks(avgX, floorY - 50, 0, 10);
                    spawnSparks(avgX, floorY - 50, Math.PI, 10);
                }
            }
            
            // Spark streams during contact
            if (nextS.isColliding) {
                if (simMode === 'wall') {
                    spawnSparks(wallX, floorY - 50, Math.PI, 1);
                } else {
                    let avgX = (nextS.objA.x + nextS.objA.r + nextS.objB.x - nextS.objB.r) / 2;
                    spawnSparks(avgX, floorY - 50, 0, 1);
                    spawnSparks(avgX, floorY - 50, Math.PI, 1);
                }
            }

            currentFrame = nextF;
            if (currentFrame >= history.length - 1) {
                isPlaying = false;
                updatePlaybackUI();
            }
        }
    }
    
    updateParticles();
    draw();
    requestAnimationFrame(animate);
}

// --- Draw Scene ---
function draw() {
    fitView();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const isDark = !document.body.classList.contains('light-theme');
    
    // Theme colors resolver
    const floorColor = isDark ? '#334155' : '#94a3b8';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
    const objectAColor = isDark ? '#60a5fa' : '#2563eb';
    const objectBColor = isDark ? '#f87171' : '#dc2626';
    const wallColor = isDark ? '#64748b' : '#475569';
    
    // Get current precalculated frame state
    const state = history[currentFrame] || history[0];
    
    ctx.save();
    // Apply pan & zoom
    ctx.translate(panX, panY);
    ctx.scale(zoomScale, zoomScale);
    
    // 1. Draw Grid Lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    const gridSpacing = 50;
    
    // Draw vertical & horizontal grid lines
    const startPt = screenToWorld(0, 0);
    const endPt = screenToWorld(canvas.width, canvas.height);
    
    const startGridX = Math.floor(startPt.x / gridSpacing) * gridSpacing;
    const endGridX = Math.ceil(endPt.x / gridSpacing) * gridSpacing;
    const startGridY = Math.floor(startPt.y / gridSpacing) * gridSpacing;
    const endGridY = Math.ceil(endPt.y / gridSpacing) * gridSpacing;
    
    for (let x = startGridX; x <= endGridX; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, startGridY);
        ctx.lineTo(x, endGridY);
        ctx.stroke();
    }
    for (let y = startGridY; y <= endGridY; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(startGridX, y);
        ctx.lineTo(endGridX, y);
        ctx.stroke();
    }
    
    // 2. Draw Floor Hatch patterns (Physics style)
    ctx.strokeStyle = floorColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startPt.x - 200, floorY);
    ctx.lineTo(endPt.x + 200, floorY);
    ctx.stroke();
    
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = Math.floor(startPt.x / 20) * 20 - 100; x <= endPt.x + 100; x += 20) {
        ctx.moveTo(x, floorY);
        ctx.lineTo(x - 8, floorY + 12);
    }
    ctx.stroke();
    
    // 2.5 Draw Cushion and Concrete slabs for Drop Mode
    if (simMode === 'drop') {
        // Soft mat (A)
        ctx.fillStyle = isDark ? '#1e3a8a' : '#bfdbfe';
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.rect(220 - 60, floorY, 120, 20);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = isDark ? '#93c5fd' : '#1e3a8a';
        ctx.font = `bold 11px ${varName('--font-primary')}`;
        ctx.textAlign = 'center';
        ctx.fillText("푹신한 바닥 (매트)", 220, floorY + 14);
        
        // Hard concrete (B)
        ctx.fillStyle = isDark ? '#334155' : '#e2e8f0';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.rect(460 - 60, floorY, 120, 20);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = isDark ? '#cbd5e1' : '#334155';
        ctx.fillText("딱딱한 바닥 (콘크리트)", 460, floorY + 14);
    }
    
    // 3. Draw Wall (If Wall Mode)
    if (simMode === 'wall') {
        ctx.fillStyle = wallColor;
        ctx.strokeStyle = isDark ? '#475569' : '#334155';
        ctx.lineWidth = 3;
        
        // Steel box wall
        ctx.beginPath();
        ctx.rect(wallX, floorY - 160, 40, 160);
        ctx.fill();
        ctx.stroke();
        
        // Wall warning diagonal lines
        ctx.strokeStyle = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        for (let y = floorY - 150; y <= floorY; y += 24) {
            ctx.moveTo(wallX, y);
            ctx.lineTo(wallX + 40, y + 15);
        }
        ctx.stroke();
    }
    
    // 4. Draw Particles (Sparks)
    activeParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    });
    
    // 5. Draw Object A
    let squishA = 1.0;
    let squishYA = 1.0;
    if (simMode === 'drop') {
        if (state.isCollidingA && state.forceA > 0) {
            squishYA = 1.0 - (state.forceA / state.fMaxA) * 0.15;
            squishA = 1.0 + (state.forceA / state.fMaxA) * 0.05;
        }
        drawCart(
            state.objA.x, 
            state.objA.y + state.objA.r * squishYA, 
            state.objA.r, 
            squishA, 
            objectAColor, 
            `A`, 
            `${state.objA.m}kg`,
            squishYA
        );
    } else {
        if (state.isColliding && state.force > 0) {
            squishA = 1.0 - (state.force / state.fMax) * 0.15;
        }
        drawCart(
            state.objA.x, 
            floorY, 
            state.objA.r, 
            squishA, 
            objectAColor, 
            `A`, 
            `${state.objA.m}kg`
        );
    }
    
    // 6. Draw Object B (If Two-Body Mode or Drop Mode)
    if (simMode === 'two-body' || simMode === 'drop') {
        let squishB = 1.0;
        let squishYB = 1.0;
        if (simMode === 'drop') {
            if (state.isCollidingB && state.forceB > 0) {
                squishYB = 1.0 - (state.forceB / state.fMaxB) * 0.15;
                squishB = 1.0 + (state.forceB / state.fMaxB) * 0.05;
            }
            drawCart(
                state.objB.x, 
                state.objB.y + state.objB.r * squishYB, 
                state.objB.r, 
                squishB, 
                objectBColor, 
                `B`, 
                `${state.objB.m}kg`,
                squishYB
            );
        } else {
            if (state.isColliding && state.force > 0) {
                squishB = 1.0 - (state.force / state.fMax) * 0.15;
            }
            drawCart(
                state.objB.x, 
                floorY, 
                state.objB.r, 
                squishB, 
                objectBColor, 
                `B`, 
                `${state.objB.m}kg`
            );
        }
    }
    
    // 7. Draw Velocity & Momentum Vectors
    const showVectors = true;
    if (showVectors) {
        const velArrowColor = isDark ? '#34d399' : '#059669';
        const momArrowColor = isDark ? '#fbbf24' : '#d97706';
        
        if (simMode === 'drop') {
            const vyA = state.objA.vy;
            const pA = state.objA.m * vyA;
            const vyB = state.objB.vy;
            const pB = state.objB.m * vyB;
            
            // Object A vertical vectors
            if (Math.abs(vyA) > 0.05) {
                drawArrow(
                    state.objA.x - state.objA.r - 12, 
                    state.objA.y, 
                    state.objA.x - state.objA.r - 12, 
                    state.objA.y + vyA * 12, 
                    velArrowColor, 
                    `v = ${vyA.toFixed(1)} m/s`
                );
            }
            if (Math.abs(pA) > 0.05) {
                drawArrow(
                    state.objA.x + state.objA.r + 12, 
                    state.objA.y, 
                    state.objA.x + state.objA.r + 12, 
                    state.objA.y + pA * 2.5, 
                    momArrowColor, 
                    `p = ${pA.toFixed(1)} kg·m/s`
                );
            }
            
            // Object B vertical vectors
            if (Math.abs(vyB) > 0.05) {
                drawArrow(
                    state.objB.x - state.objB.r - 12, 
                    state.objB.y, 
                    state.objB.x - state.objB.r - 12, 
                    state.objB.y + vyB * 12, 
                    velArrowColor, 
                    `v = ${vyB.toFixed(1)} m/s`
                );
            }
            if (Math.abs(pB) > 0.05) {
                drawArrow(
                    state.objB.x + state.objB.r + 12, 
                    state.objB.y, 
                    state.objB.x + state.objB.r + 12, 
                    state.objB.y + pB * 2.5, 
                    momArrowColor, 
                    `p = ${pB.toFixed(1)} kg·m/s`
                );
            }
        } else {
            // Object A Vectors
            const va = state.objA.vx;
            const pa = state.objA.m * va;
            
            // Draw Velocity Arrow (Green, above)
            if (Math.abs(va) > 0.05) {
                drawArrow(
                    state.objA.x, 
                    floorY - 2 * state.objA.r - 15, 
                    state.objA.x + va * 14, 
                    floorY - 2 * state.objA.r - 15, 
                    velArrowColor, 
                    `v = ${va.toFixed(1)} m/s`
                );
            }
            
            // Draw Momentum Arrow (Gold, below)
            if (Math.abs(pa) > 0.05) {
                drawArrow(
                    state.objA.x, 
                    floorY + 25, 
                    state.objA.x + pa * 3, 
                    floorY + 25, 
                    momArrowColor, 
                    `p = ${pa.toFixed(1)} kg·m/s`
                );
            }
            
            // Object B Vectors
            if (simMode === 'two-body') {
                const vb = state.objB.vx;
                const pb = state.objB.m * vb;
                
                // Velocity
                if (Math.abs(vb) > 0.05) {
                    drawArrow(
                        state.objB.x, 
                        floorY - 2 * state.objB.r - 15, 
                        state.objB.x + vb * 14, 
                        floorY - 2 * state.objB.r - 15, 
                        velArrowColor, 
                        `v = ${vb.toFixed(1)} m/s`
                    );
                }
                
                // Momentum
                if (Math.abs(pb) > 0.05) {
                    drawArrow(
                        state.objB.x, 
                        floorY + 25, 
                        state.objB.x + pb * 3, 
                        floorY + 25, 
                        momArrowColor, 
                        `p = ${pb.toFixed(1)} kg·m/s`
                    );
                }
            }
        }
    }
    
    // 8. Draw Collision forces (Action-Reaction) during collision
    if (simMode === 'drop') {
        if (state.forceA > 1) {
            drawArrow(
                state.objA.x, 
                floorY, 
                state.objA.x, 
                floorY - Math.min(150, state.forceA * 0.12), 
                '#60a5fa', 
                `F_A = ${Math.round(state.forceA)}N`
            );
        }
        if (state.forceB > 1) {
            drawArrow(
                state.objB.x, 
                floorY, 
                state.objB.x, 
                floorY - Math.min(150, state.forceB * 0.12), 
                '#f87171', 
                `F_B = ${Math.round(state.forceB)}N`
            );
        }
    } else if (state.isColliding && state.force > 1) {
        ctx.strokeStyle = '#ef4444';
        ctx.fillStyle = '#ef4444';
        ctx.lineWidth = 3;
        
        if (simMode === 'wall') {
            const forceY1 = floorY - state.objA.r;
            const forceY2 = forceY1 - 40;
            // Draw force on A (pointing left, from wall to center of A)
            drawArrow(
                wallX, 
                forceY1, 
                wallX - Math.min(150, state.force * 0.12), 
                forceY1, 
                '#f87171', 
                `F = ${Math.round(state.force)}N`, 
                10
            );
            // Action-reaction wall force
            drawArrow(
                wallX, 
                forceY2, 
                wallX + Math.min(150, state.force * 0.12), 
                forceY2, 
                '#ef4444', 
                `반작용 F = ${Math.round(state.force)}N`, 
                10
            );
        } else {
            // Mid contact point
            let midX = (state.objA.x + state.objA.r + state.objB.x - state.objB.r) / 2;
            const forceY1 = floorY - Math.min(state.objA.r, state.objB.r);
            const forceY2 = forceY1 - 40;
            
            // Force on B (pointing right)
            drawArrow(
                midX, 
                forceY1, 
                midX + Math.min(150, state.force * 0.12), 
                forceY1, 
                '#ef4444', 
                `F_A→B = ${Math.round(state.force)}N`
            );
            // Force on A (pointing left)
            drawArrow(
                midX, 
                forceY2, 
                midX - Math.min(150, state.force * 0.12), 
                forceY2, 
                '#60a5fa', 
                `F_B→A = ${Math.round(state.force)}N`
            );
        }
    }
    
    ctx.restore();
    
    // 9. Update HTML Stats & Graph Overlay
    updateHUDStats(state);
    drawGraph(state);
}

// --- Cart/Object drawing helper ---
function drawCart(x, y, r, squishX, color, label, massText, squishY = 1.0) {
    const isDark = !document.body.classList.contains('light-theme');
    
    ctx.save();
    ctx.translate(x, y - r * squishY); // Sit directly on the floor
    ctx.scale(squishX, squishY);
    
    // Draw Cart Body (Glow shadow)
    ctx.shadowBlur = 15;
    ctx.shadowColor = color + '4d'; // transparent tint
    ctx.fillStyle = color;
    
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 2 * Math.PI);
    ctx.fill();
    
    // Overlay stroke
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    // Draw Text details inside Cart
    ctx.fillStyle = '#ffffff'; // White text on colored carts for best contrast
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Name Label
    ctx.save();
    ctx.scale(1 / squishX, 1 / squishY);
    ctx.font = `800 ${r > 38 ? 16 : 14}px ${varName('--font-heading')}`;
    ctx.fillText(label, 0, -r/4);
    
    // Mass label
    ctx.font = `600 ${r > 38 ? 12 : 10}px ${varName('--font-primary')}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(massText, 0, r/3);
    ctx.restore();
    
    ctx.restore();
}

// --- Vector Arrow drawing helper ---
function drawArrow(fromX, fromY, toX, toY, color, label, arrowSize = 10) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.hypot(dx, dy);
    
    if (length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5; // Sleeker line width
    
    const angle = Math.atan2(dy, dx);
    
    // Stop the line slightly before the tip of the arrowhead to make it look clean
    const lineEndX = toX - (arrowSize - 2) * Math.cos(angle);
    const lineEndY = toY - (arrowSize - 2) * Math.sin(angle);
    
    // Draw Line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();
    
    // Draw sleek indented triangular arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - arrowSize * Math.cos(angle - Math.PI / 7), toY - arrowSize * Math.sin(angle - Math.PI / 7));
    ctx.lineTo(toX - arrowSize * 0.75 * Math.cos(angle), toY - arrowSize * 0.75 * Math.sin(angle));
    ctx.lineTo(toX - arrowSize * Math.cos(angle + Math.PI / 7), toY - arrowSize * Math.sin(angle + Math.PI / 7));
    ctx.closePath();
    ctx.fill();
    
    // Text Label shadow rendering
    const isDark = !document.body.classList.contains('light-theme');
    ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.font = `bold 12.5px ${varName('--font-heading')}`;
    
    // Check if vertical or horizontal
    const isVertical = Math.abs(fromX - toX) < 1;
    ctx.strokeStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.lineWidth = 3.5;
    
    if (isVertical) {
        // Place text next to the arrow (left or right side depending on coordinate)
        ctx.textAlign = fromX < 340 ? 'right' : 'left';
        ctx.textBaseline = 'middle';
        const textX = fromX < 340 ? fromX - 8 : fromX + 8;
        const textY = (fromY + toY) / 2;
        ctx.strokeText(label, textX, textY);
        ctx.fillText(label, textX, textY);
    } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.strokeText(label, (fromX + toX) / 2, fromY - 10);
        ctx.fillText(label, (fromX + toX) / 2, fromY - 10);
    }
    
    ctx.restore();
}

// Helper to get CSS font variable names
function varName(cssVar) {
    return getComputedStyle(document.body).getPropertyValue(cssVar).trim() || 'Arial';
}

// --- HUD Real-time Values Panel ---
function updateHUDStats(state) {
    const isDark = !document.body.classList.contains('light-theme');
    const finalState = history[history.length - 1] || state;
    
    let html = '';
    const badgeA = `<span class="badge" style="background-color: var(--accent-a);">A</span>`;
    const badgeB = `<span class="badge" style="background-color: var(--accent-b);">B</span>`;
    
    if (simMode === 'drop') {
        const v_hit = finalState.v_hit;
        const impulse = finalState.objA.m * v_hit;
        
        html = `
            <div class="stat-row">
                <span class="stat-label">공통 질량 (m)</span>
                <span class="stat-value">${state.objA.m} kg</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">낙하 높이 (h)</span>
                <span class="stat-value">${finalState.dHeight.toFixed(1)} m</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">바닥 도달 속도 (v)</span>
                <span class="stat-value" style="color: var(--arrow-v);">${v_hit.toFixed(1)} m/s</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">동일 운동량 변화량 (Δp)</span>
                <span class="stat-value" style="color: var(--arrow-p);">${impulse.toFixed(1)} kg·m/s</span>
            </div>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 8px 0;">
            <div class="stat-row" style="font-weight: 800; color: var(--accent-a);">
                <span class="stat-label">${badgeA} (푹신) 최대 충격력</span>
                <span class="stat-value" style="color: var(--accent-a);">${Math.round(finalState.fMaxA)} N</span>
            </div>
            <div class="stat-row" style="font-weight: 800; color: var(--accent-b);">
                <span class="stat-label">${badgeB} (딱딱) 최대 충격력</span>
                <span class="stat-value" style="color: var(--accent-b);">${Math.round(finalState.fMaxB)} N</span>
            </div>
        `;
    } else if (simMode === 'wall') {
        const p_initial = state.objA.m * finalState.vAi;
        const p_final = state.objA.m * finalState.vAf;
        const impulse = p_final - p_initial;
        
        html = `
            <div class="stat-row">
                <span class="stat-label">${badgeA} 질량 (m<sub>A</sub>)</span>
                <span class="stat-value">${state.objA.m} kg</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">${badgeA} 현재 속도 (v)</span>
                <span class="stat-value" style="color: var(--arrow-v);">${state.objA.vx.toFixed(1)} m/s</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">${badgeA} 현재 운동량 (p)</span>
                <span class="stat-value" style="color: var(--arrow-p);">${(state.objA.m * state.objA.vx).toFixed(1)} kg·m/s</span>
            </div>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 8px 0;">
            <div class="stat-row">
                <span class="stat-label">충돌 전 운동량 (p<sub>i</sub>)</span>
                <span class="stat-value">${p_initial.toFixed(1)} kg·m/s</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">충돌 후 운동량 (p<sub>f</sub>)</span>
                <span class="stat-value" style="color: var(--primary-color);">${p_final.toFixed(1)} kg·m/s</span>
            </div>
            <div class="stat-row" style="font-weight: 800; border-top: 1px dashed var(--border-color); padding-top: 6px; margin-top: 4px;">
                <span class="stat-label" style="color: var(--primary-color);">교환한 충격량 (I = Δp)</span>
                <span class="stat-value" style="color: var(--primary-color);">${Math.abs(impulse).toFixed(1)} N·s</span>
            </div>
        `;
    } else {
        const pa = state.objA.m * state.objA.vx;
        const pb = state.objB.m * state.objB.vx;
        
        const p_total_initial = state.objA.m * finalState.vAi + state.objB.m * finalState.vBi;
        const p_total_current = pa + pb;
        
        // Impulse on A
        const impulseA = state.objA.m * (finalState.vAf - finalState.vAi);
        
        html = `
            <div class="stat-row">
                <span class="stat-label">${badgeA} 현재 운동량 (p<sub>A</sub>)</span>
                <span class="stat-value">${pa.toFixed(1)} kg·m/s</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">${badgeB} 현재 운동량 (p<sub>B</sub>)</span>
                <span class="stat-value">${pb.toFixed(1)} kg·m/s</span>
            </div>
            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 8px 0;">
            <div class="stat-row">
                <span class="stat-label">초기 총 운동량 (P<sub>i</sub>)</span>
                <span class="stat-value">${p_total_initial.toFixed(1)} kg·m/s</span>
            </div>
            <div class="stat-row" style="font-weight: 800; color: var(--arrow-v);">
                <span class="stat-label">현재 총 운동량 (P)</span>
                <span class="stat-value">${p_total_current.toFixed(1)} kg·m/s</span>
            </div>
            <div class="stat-row" style="font-weight: 800; border-top: 1px dashed var(--border-color); padding-top: 6px; margin-top: 4px;">
                <span class="stat-label" style="color: var(--primary-color);">교환한 충격량 (I)</span>
                <span class="stat-value" style="color: var(--primary-color);">${Math.abs(impulseA).toFixed(1)} N·s</span>
            </div>
        `;
    }
    
    statsGrid.innerHTML = html;
}

// --- Draw Force-Time Graph ---
function drawGraph(state) {
    const rect = graphCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);
    
    if (graphCanvas.width !== targetWidth || graphCanvas.height !== targetHeight) {
        graphCanvas.width = targetWidth;
        graphCanvas.height = targetHeight;
    }
    
    graphCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    const dw = rect.width;
    const dh = rect.height;
    
    graphCtx.clearRect(0, 0, dw, dh);
    
    const isDark = !document.body.classList.contains('light-theme');
    const labelColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const curveColor = '#10b981';
    
    // Margin variables
    const padding = { top: 20, right: 20, bottom: 25, left: 35 };
    const graphWidth = dw - padding.left - padding.right;
    const graphHeight = dh - padding.top - padding.bottom;
    
    // Draw Graph Box Border & Grid
    graphCtx.strokeStyle = gridColor;
    graphCtx.lineWidth = 1;
    
    // Draw 4 horizontal division lines
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (graphHeight / 4) * i;
        graphCtx.beginPath();
        graphCtx.moveTo(padding.left, y);
        graphCtx.lineTo(dw - padding.right, y);
        graphCtx.stroke();
    }
    
    // Draw X-axis divisions
    for (let i = 0; i <= 4; i++) {
        const x = padding.left + (graphWidth / 4) * i;
        graphCtx.beginPath();
        graphCtx.moveTo(x, padding.top);
        graphCtx.lineTo(x, dh - padding.bottom);
        graphCtx.stroke();
    }
    
    // Axes labels
    graphCtx.fillStyle = labelColor;
    graphCtx.font = `11px ${varName('--font-primary')}`;
    graphCtx.textAlign = 'right';
    graphCtx.fillText("힘 F (N)", padding.left - 5, padding.top + 3);
    
    graphCtx.textAlign = 'center';
    graphCtx.fillText("시간 t (s)", dw - padding.right, dh - 8);
    
    // Use the final state to determine overall collision parameters
    const finalState = history[history.length - 1] || state;
    const colStart = finalState.collisionStartFrame;
    
    // Toggle standard vs drop legends in graph legend panel
    const standardLegend = document.getElementById('standardLegend');
    const dropLegend = document.getElementById('dropLegend');
    if (standardLegend && dropLegend) {
        if (simMode === 'drop') {
            standardLegend.style.display = 'none';
            dropLegend.style.display = 'inline-flex';
        } else {
            standardLegend.style.display = 'inline-flex';
            dropLegend.style.display = 'none';
        }
    }

    if (colStart === -1 || (!finalState.hasCollided && !finalState.hasCollidedA && !finalState.hasCollidedB)) {
        // Draw F=0 flat line
        graphCtx.strokeStyle = curveColor;
        graphCtx.lineWidth = 2.5;
        graphCtx.beginPath();
        graphCtx.moveTo(padding.left, dh - padding.bottom);
        graphCtx.lineTo(dw - padding.right, dh - padding.bottom);
        graphCtx.stroke();
        
        graphVals.innerHTML = `<span>I = Δp = 0.0 N·s</span>`;
        return;
    }
    
    // Determine bounds for X-axis
    let frameStart, frameEnd;
    let maxForceVal;
    
    if (simMode === 'drop') {
        frameStart = colStart - 15;
        frameEnd = colStart + Math.max(finalState.dDurA, finalState.dDurB) + 15;
        maxForceVal = Math.max(finalState.fMaxA, finalState.fMaxB) * 1.15;
    } else {
        frameStart = colStart - 15;
        frameEnd = colStart + collisionDuration + 15;
        maxForceVal = finalState.fMax * 1.15; // 15% headroom
    }
    
    const totalFrames = frameEnd - frameStart;
    
    // Map frame index to canvas coordinates
    function getX(fIndex) {
        const pct = (fIndex - frameStart) / totalFrames;
        return padding.left + pct * graphWidth;
    }
    function getY(forceVal) {
        const pct = forceVal / maxForceVal;
        return dh - padding.bottom - pct * graphHeight;
    }
    
    // Draw X-axis label ticks
    graphCtx.fillStyle = labelColor;
    graphCtx.textAlign = 'center';
    
    // 0 on X axis corresponds to collision start
    const xColStart = getX(colStart);
    
    graphCtx.beginPath();
    graphCtx.moveTo(xColStart, dh - padding.bottom);
    graphCtx.lineTo(xColStart, dh - padding.bottom + 4);
    
    if (simMode === 'drop') {
        const xColEndA = getX(colStart + finalState.dDurA);
        const xColEndB = getX(colStart + finalState.dDurB);
        graphCtx.moveTo(xColEndA, dh - padding.bottom);
        graphCtx.lineTo(xColEndA, dh - padding.bottom + 4);
        graphCtx.moveTo(xColEndB, dh - padding.bottom);
        graphCtx.lineTo(xColEndB, dh - padding.bottom + 4);
        
        graphCtx.strokeStyle = labelColor;
        graphCtx.stroke();
        
        graphCtx.fillText("충돌 시작", xColStart, dh - padding.bottom + 16);
        graphCtx.fillText("B 종료", xColEndB, dh - padding.bottom + 16);
        graphCtx.fillText("A 종료", xColEndA, dh - padding.bottom + 16);
    } else {
        const xColEnd = getX(colStart + collisionDuration);
        graphCtx.moveTo(xColEnd, dh - padding.bottom);
        graphCtx.lineTo(xColEnd, dh - padding.bottom + 4);
        
        graphCtx.strokeStyle = labelColor;
        graphCtx.stroke();
        
        graphCtx.fillText("충돌 시작", xColStart, dh - padding.bottom + 16);
        graphCtx.fillText("충돌 종료", xColEnd, dh - padding.bottom + 16);
    }
    
    if (simMode === 'drop') {
        // --- DRAW CUSHION (A) CURVES (Blue) ---
        // Draw Shaded area A
        graphCtx.fillStyle = isDark ? 'rgba(96, 165, 250, 0.22)' : 'rgba(59, 130, 246, 0.18)';
        graphCtx.beginPath();
        graphCtx.moveTo(getX(colStart - 1), getY(0));
        
        const lastShadeFrameA = Math.min(currentFrame, colStart + finalState.dDurA);
        if (currentFrame >= colStart - 1) {
            for (let f = colStart - 1; f <= lastShadeFrameA; f++) {
                const fState = history[f];
                if (fState) {
                    const force = (fState && fState.hasCollidedA) ? fState.forceA : 0;
                    graphCtx.lineTo(getX(f), getY(force));
                }
            }
            graphCtx.lineTo(getX(lastShadeFrameA), getY(0));
            graphCtx.closePath();
            graphCtx.fill();
        }
        
        // Draw Shaded area B
        graphCtx.fillStyle = isDark ? 'rgba(248, 113, 113, 0.22)' : 'rgba(239, 68, 68, 0.18)';
        graphCtx.beginPath();
        graphCtx.moveTo(getX(colStart - 1), getY(0));
        
        const lastShadeFrameB = Math.min(currentFrame, colStart + finalState.dDurB);
        if (currentFrame >= colStart - 1) {
            for (let f = colStart - 1; f <= lastShadeFrameB; f++) {
                const fState = history[f];
                if (fState) {
                    const force = (fState && fState.hasCollidedB) ? fState.forceB : 0;
                    graphCtx.lineTo(getX(f), getY(force));
                }
            }
            graphCtx.lineTo(getX(lastShadeFrameB), getY(0));
            graphCtx.closePath();
            graphCtx.fill();
        }
        
        // Draw Outline A (Blue)
        graphCtx.strokeStyle = '#3b82f6';
        graphCtx.lineWidth = 3;
        graphCtx.beginPath();
        
        let endF_A = Math.min(currentFrame, frameEnd);
        if (endF_A >= frameStart) {
            const firstState = history[frameStart];
            const firstForce = (firstState && firstState.hasCollidedA) ? firstState.forceA : 0;
            graphCtx.moveTo(getX(frameStart), getY(firstForce));
            
            for (let f = frameStart + 1; f <= endF_A; f++) {
                const fState = history[f];
                const force = (fState && fState.hasCollidedA) ? fState.forceA : 0;
                graphCtx.lineTo(getX(f), getY(force));
            }
            graphCtx.stroke();
        }
        
        // Draw Outline B (Red)
        graphCtx.strokeStyle = '#ef4444';
        graphCtx.lineWidth = 3;
        graphCtx.beginPath();
        
        let endF_B = Math.min(currentFrame, frameEnd);
        if (endF_B >= frameStart) {
            const firstState = history[frameStart];
            const firstForce = (firstState && firstState.hasCollidedB) ? firstState.forceB : 0;
            graphCtx.moveTo(getX(frameStart), getY(firstForce));
            
            for (let f = frameStart + 1; f <= endF_B; f++) {
                const fState = history[f];
                const force = (fState && fState.hasCollidedB) ? fState.forceB : 0;
                graphCtx.lineTo(getX(f), getY(force));
            }
            graphCtx.stroke();
        }
        
        // Draw cursor dots for both
        if (currentFrame >= frameStart && currentFrame <= frameEnd) {
            const curX = getX(currentFrame);
            
            // Vertical indicator line
            graphCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
            graphCtx.lineWidth = 1;
            graphCtx.setLineDash([4, 4]);
            graphCtx.beginPath();
            graphCtx.moveTo(curX, padding.top);
            graphCtx.lineTo(curX, dh - padding.bottom);
            graphCtx.stroke();
            graphCtx.setLineDash([]);
            
            // Dot A
            const curForceA = (currentFrame >= colStart && currentFrame <= colStart + finalState.dDurA)
                ? (history[currentFrame] ? history[currentFrame].forceA : 0)
                : 0;
            graphCtx.fillStyle = '#3b82f6';
            graphCtx.beginPath();
            graphCtx.arc(curX, getY(curForceA), 5, 0, 2 * Math.PI);
            graphCtx.fill();
            
            // Dot B
            const curForceB = (currentFrame >= colStart && currentFrame <= colStart + finalState.dDurB)
                ? (history[currentFrame] ? history[currentFrame].forceB : 0)
                : 0;
            graphCtx.fillStyle = '#ef4444';
            graphCtx.beginPath();
            graphCtx.arc(curX, getY(curForceB), 5, 0, 2 * Math.PI);
            graphCtx.fill();
        }
    } else {
        // --- DRAW ORIGINAL SINGLE CURVE (Green) ---
        // Draw Shaded area under force curve up to current frame
        graphCtx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(5, 150, 105, 0.18)';
        graphCtx.beginPath();
        graphCtx.moveTo(getX(colStart - 1), getY(0));
        
        const lastShadeFrame = Math.min(currentFrame, colStart + collisionDuration);
        if (currentFrame >= colStart - 1) {
            for (let f = colStart - 1; f <= lastShadeFrame; f++) {
                const fState = history[f];
                if (fState) {
                    const force = (fState && fState.hasCollided) ? fState.force : 0;
                    graphCtx.lineTo(getX(f), getY(force));
                }
            }
            graphCtx.lineTo(getX(lastShadeFrame), getY(0));
            graphCtx.closePath();
            graphCtx.fill();
        }
        
        // Draw collision curve outline up to current frame
        graphCtx.strokeStyle = curveColor;
        graphCtx.lineWidth = 3;
        graphCtx.beginPath();
        
        const startF = frameStart;
        const endF = Math.min(currentFrame, frameEnd);
        
        if (endF >= startF) {
            const firstState = history[startF];
            const firstForce = (firstState && firstState.hasCollided) ? firstState.force : 0;
            graphCtx.moveTo(getX(startF), getY(firstForce));
            
            for (let f = startF + 1; f <= endF; f++) {
                const fState = history[f];
                const force = (fState && fState.hasCollided) ? fState.force : 0;
                graphCtx.lineTo(getX(f), getY(force));
            }
            graphCtx.stroke();
        }
        
        // Draw current frame cursor dot and line
        if (currentFrame >= frameStart && currentFrame <= frameEnd) {
            const curX = getX(currentFrame);
            const curForce = (currentFrame >= colStart && currentFrame <= colStart + collisionDuration)
                ? (history[currentFrame] ? history[currentFrame].force : 0)
                : 0;
            const curY = getY(curForce);
            
            // Vertical indicator line
            graphCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)';
            graphCtx.lineWidth = 1;
            graphCtx.setLineDash([4, 4]);
            graphCtx.beginPath();
            graphCtx.moveTo(curX, padding.top);
            graphCtx.lineTo(curX, dh - padding.bottom);
            graphCtx.stroke();
            graphCtx.setLineDash([]);
            
            // Dot on curve
            graphCtx.fillStyle = '#ef4444';
            graphCtx.shadowBlur = 6;
            graphCtx.shadowColor = '#ef4444';
            graphCtx.beginPath();
            graphCtx.arc(curX, curY, 5, 0, 2 * Math.PI);
            graphCtx.fill();
            graphCtx.shadowBlur = 0; // reset
        }
    }
    
    // Update calculated text values
    let impulse = 0;
    if (simMode === 'drop') {
        const v_hit = finalState.v_hit;
        impulse = finalState.objA.m * v_hit;
    } else if (simMode === 'wall') {
        const p_initial = finalState.objA.m * finalState.vAi;
        const p_final = finalState.objA.m * finalState.vAf;
        impulse = Math.abs(p_final - p_initial);
    } else {
        const pA_initial = finalState.objA.m * finalState.vAi;
        const pA_final = finalState.objA.m * finalState.vAf;
        impulse = Math.abs(pA_final - pA_initial);
    }
    
    // Fill text under graph showing equivalence
    if (simMode === 'drop') {
        if (finalState.hasCollidedA || finalState.hasCollidedB) {
            graphVals.innerHTML = `
                <span><b>운동량 변화량 (Δp)</b> = <b>${impulse.toFixed(1)} kg·m/s</b> (동일) | A 최대 힘: <b>${Math.round(finalState.fMaxA)}N</b>, B 최대 힘: <b>${Math.round(finalState.fMaxB)}N</b></span>
            `;
        } else {
            graphVals.innerHTML = `<span>I = Δp = 0.0 N·s</span>`;
        }
    } else {
        if (finalState.hasCollided) {
            graphVals.innerHTML = `
                <span><b>충격량 (I = 면적)</b> = <b>${impulse.toFixed(1)} N·s</b> | <b>운동량 변화량 (Δp)</b> = <b>${impulse.toFixed(1)} kg·m/s</b></span>
            `;
        } else {
            graphVals.innerHTML = `<span>I = Δp = 0.0 N·s</span>`;
        }
    }
}

// --- Trigger Start on Load ---
init();
