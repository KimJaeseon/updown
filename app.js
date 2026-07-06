/**
 * UpDown Game - core logic and accessibility features
 */

// ==========================================================================
// 1. Game State Management
// ==========================================================================
const gameState = {
  targetNumber: 0,
  minPossible: 1,
  maxPossible: 100,
  attempts: 0,
  maxAttempts: 7, // Limit for Challenge Mode
  mode: 'practice', // 'practice' | 'challenge'
  history: [], // List of { attemptNumber, guess, result }
  isMuted: false,
  zoomLevel: 1.0, // 0.8 | 1.0 | 1.2
  audioCtx: null
};

// ==========================================================================
// 2. DOM Elements
// ==========================================================================
const elements = {
  // Announcer (A11y)
  srAnnouncer: document.getElementById('sr-announcer'),

  // Screen containers
  screenModeSelect: document.getElementById('screen-mode-select'),
  screenGamePlay: document.getElementById('screen-game-play'),

  // Mode Selection Elements
  btnPractice: document.getElementById('btn-practice'),
  btnChallenge: document.getElementById('btn-challenge'),
  highScoreWrapper: document.getElementById('high-score-wrapper'),
  bestScoreValue: document.getElementById('best-score-value'),

  // Gameplay Header
  btnGoBack: document.getElementById('btn-go-back'),
  livesContainer: document.getElementById('lives-container'),

  // Range Visualization
  rangeMinLabel: document.getElementById('range-min-label'),
  rangeMaxLabel: document.getElementById('range-max-label'),
  rangeGuidance: document.getElementById('range-guidance'),
  rangeProgressFill: document.getElementById('range-progress-fill'),

  // Status Display
  statusPanel: document.getElementById('status-panel'),
  statusIcon: document.getElementById('status-icon'),
  statusMessage: document.getElementById('status-message'),

  // Guess Form
  guessForm: document.getElementById('guess-form'),
  inputGuess: document.getElementById('input-guess'),
  btnGuessSubmit: document.getElementById('btn-guess-submit'),
  inputErrorMsg: document.getElementById('input-error-msg'),

  // History List
  tryCount: document.getElementById('try-count'),
  historyList: document.getElementById('history-list'),
  noHistoryText: document.getElementById('no-history-text'),

  // Modal
  resultModal: document.getElementById('result-modal'),
  modalBadge: document.getElementById('modal-badge'),
  modalTitle: document.getElementById('modal-title'),
  modalDesc: document.getElementById('modal-desc'),
  newRecordBadge: document.getElementById('new-record-badge'),
  btnModalRestart: document.getElementById('btn-modal-restart'),
  btnModalClose: document.getElementById('btn-modal-close'),

  // Accessibility Controls
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomReset: document.getElementById('btn-zoom-reset'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnContrastToggle: document.getElementById('btn-contrast-toggle'),
  btnMuteToggle: document.getElementById('btn-mute-toggle'),
  soundIcon: document.getElementById('sound-icon'),

  // Confetti Canvas
  confettiCanvas: document.getElementById('confetti-canvas')
};

// ==========================================================================
// 3. Audio Engine (Web Audio API Synth)
// ==========================================================================
function initAudio() {
  if (!gameState.audioCtx) {
    gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser security autoplays)
  if (gameState.audioCtx.state === 'suspended') {
    gameState.audioCtx.resume();
  }
}

/**
 * Play a synthesized beep or slide tone.
 */
function playTone(freq, type = 'sine', duration = 0.1, endFreq = null) {
  if (gameState.isMuted) return;
  initAudio();
  
  try {
    const ctx = gameState.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    // Frequency slide (portamento) if end frequency is provided
    if (endFreq && endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    }
    
    // Smooth volume envelope to prevent clicking
    gain.gain.setValueAtTime(0.15, ctx.currentTime); // Standard comfortable volume
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error('Audio playback failed', e);
  }
}

// Custom Sound Designs
const sounds = {
  click: () => playTone(220, 'sine', 0.05),
  error: () => playTone(150, 'sawtooth', 0.15),
  up: () => playTone(350, 'triangle', 0.25, 700), // Slide up
  down: () => playTone(600, 'triangle', 0.25, 300), // Slide down
  success: () => {
    // Elegant arpeggio
    const now = gameState.audioCtx ? gameState.audioCtx.currentTime : 0;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        playTone(freq, 'sine', 0.2);
      }, idx * 100);
    });
  },
  fail: () => playTone(220, 'sawtooth', 0.6, 80) // Drastic drop
};

// ==========================================================================
// 4. Confetti Celebration Effect
// ==========================================================================
let confettiActive = false;
let confettiInterval = null;
const confettiColors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#8b5cf6', '#ec4899'];

class ConfettiParticle {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.x = Math.random() * canvasWidth;
    this.y = -20;
    this.size = Math.random() * 8 + 6;
    this.color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    this.speedX = Math.random() * 4 - 2;
    this.speedY = Math.random() * 5 + 3;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 4 - 2;
  }
  
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    return this.y < this.canvasHeight;
  }
  
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  }
}

function runConfetti() {
  const canvas = elements.confettiCanvas;
  const ctx = canvas.getContext('2d');
  let particles = [];
  
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  confettiActive = true;
  
  // Spawn cycle
  confettiInterval = setInterval(() => {
    if (particles.length < 150) {
      particles.push(new ConfettiParticle(canvas.width, canvas.height));
    }
  }, 50);
  
  function loop() {
    if (!confettiActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      window.removeEventListener('resize', resizeCanvas);
      return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => {
      const active = p.update();
      if (active) p.draw(ctx);
      return active;
    });
    
    requestAnimationFrame(loop);
  }
  
  loop();
}

function stopConfetti() {
  confettiActive = false;
  clearInterval(confettiInterval);
}

// ==========================================================================
// 5. Game Logic & Flow
// ==========================================================================

// Load High Score from LocalStorage
function loadHighScore() {
  const score = localStorage.getItem('updown_best_score');
  if (score) {
    elements.bestScoreValue.textContent = score;
    elements.highScoreWrapper.hidden = false;
  } else {
    elements.highScoreWrapper.hidden = true;
  }
}

// Start Game Configuration
function startGame(mode) {
  initAudio();
  sounds.click();
  
  gameState.mode = mode;
  gameState.targetNumber = Math.floor(Math.random() * 100) + 1;
  gameState.minPossible = 1;
  gameState.maxPossible = 100;
  gameState.attempts = 0;
  gameState.history = [];
  
  // Setup elements base state
  elements.inputGuess.value = '';
  elements.inputErrorMsg.hidden = true;
  elements.inputGuess.removeAttribute('aria-invalid');
  
  // Setup range progress labels
  updateRangeUI();
  
  // Setup status panel to initial state
  elements.statusPanel.className = 'status-panel idle';
  elements.statusIcon.textContent = '❓';
  elements.statusMessage.textContent = '숫자를 입력하고 제출해 보세요!';
  
  // Set lives indicator
  renderLives();

  // Reset try count & clear history list
  elements.tryCount.textContent = '0';
  elements.historyList.innerHTML = '';
  elements.noHistoryText.style.display = 'block';

  // Transition screens
  elements.screenModeSelect.hidden = true;
  elements.screenGamePlay.hidden = false;
  
  // accessibility: set focus to input field
  setTimeout(() => {
    elements.inputGuess.focus();
  }, 100);
  
  announceText(`UpDown 게임 ${mode === 'challenge' ? '도전 모드' : '연습 모드'}를 시작합니다. 1부터 100 사이의 숫자를 맞춰보세요.`);
}

// Render lives indicator (hearts)
function renderLives() {
  elements.livesContainer.innerHTML = '';
  if (gameState.mode === 'challenge') {
    elements.livesContainer.setAttribute('aria-label', `남은 기회 ${gameState.maxAttempts - gameState.attempts}번`);
    
    for (let i = 0; i < gameState.maxAttempts; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart-icon';
      if (i >= gameState.maxAttempts - gameState.attempts) {
        heart.classList.add('lost');
        heart.textContent = '♡';
        heart.setAttribute('aria-hidden', 'true');
      } else {
        heart.textContent = '♥';
        heart.setAttribute('aria-hidden', 'true');
      }
      elements.livesContainer.appendChild(heart);
    }
  } else {
    elements.livesContainer.removeAttribute('aria-label');
    elements.livesContainer.innerHTML = '<span class="practice-badge">🎯 연습 모드 (기회 무제한)</span>';
  }
}

// Update Min/Max progress bar & guidance
function updateRangeUI() {
  elements.rangeMinLabel.textContent = gameState.minPossible;
  elements.rangeMaxLabel.textContent = gameState.maxPossible;
  
  const text = `현재 범위: ${gameState.minPossible} ~ ${gameState.maxPossible}`;
  elements.rangeGuidance.textContent = text;
  
  // Progress bar calculation
  // default 1~100 -> progress left limit and right limit.
  // left gap = minPossible - 1
  // right gap = 100 - maxPossible
  const leftPercent = (gameState.minPossible - 1);
  const rightPercent = (100 - gameState.maxPossible);
  
  elements.rangeProgressFill.style.left = `${leftPercent}%`;
  elements.rangeProgressFill.style.right = `${rightPercent}%`;
}

// Make 스크린 리더 announce message
function announceText(text) {
  elements.srAnnouncer.textContent = '';
  // Force screen reader update
  setTimeout(() => {
    elements.srAnnouncer.textContent = text;
  }, 50);
}

// Submit a Guess
function submitGuess(e) {
  if (e) e.preventDefault();
  
  initAudio();
  const rawValue = elements.inputGuess.value;
  const guess = parseInt(rawValue, 10);
  
  // Validation checks
  if (isNaN(guess) || rawValue.trim() === '') {
    showInputError('숫자를 입력해 주세요.');
    return;
  }
  if (guess < 1 || guess > 100) {
    showInputError('1부터 100 사이의 숫자를 입력해 주세요.');
    return;
  }
  if (guess < gameState.minPossible || guess > gameState.maxPossible) {
    showInputError(`현재 좁혀진 범위(${gameState.minPossible} ~ ${gameState.maxPossible}) 내의 숫자를 입력하세요.`);
    return;
  }
  
  // Clear error if any
  hideInputError();
  
  // Increase attempts
  gameState.attempts++;
  
  // Evaluate guess
  let result = '';
  if (guess === gameState.targetNumber) {
    result = 'correct';
    handleGameSuccess();
  } else {
    if (guess < gameState.targetNumber) {
      result = 'UP';
      gameState.minPossible = Math.max(gameState.minPossible, guess + 1);
      sounds.up();
      updateStatusPanel('up', 'UP', `입력한 ${guess}보다 큽니다.`);
      announceText(`UP! 입력한 ${guess}보다 큽니다. 현재 범위는 ${gameState.minPossible}부터 ${gameState.maxPossible}까지입니다.`);
    } else {
      result = 'DOWN';
      gameState.maxPossible = Math.min(gameState.maxPossible, guess - 1);
      sounds.down();
      updateStatusPanel('down', 'DOWN', `입력한 ${guess}보다 작습니다.`);
      announceText(`DOWN! 입력한 ${guess}보다 작습니다. 현재 범위는 ${gameState.minPossible}부터 ${gameState.maxPossible}까지입니다.`);
    }
    
    // Add to history list
    addHistoryItem(gameState.attempts, guess, result);
    updateRangeUI();
    renderLives();
    
    // Check challenge mode failure
    if (gameState.mode === 'challenge' && gameState.attempts >= gameState.maxAttempts) {
      handleGameFailure();
    } else {
      // Clear input and focus back for easy retry
      elements.inputGuess.value = '';
      elements.inputGuess.focus();
    }
  }
}

// Error handling helpers
function showInputError(msg) {
  sounds.error();
  elements.inputErrorMsg.textContent = msg;
  elements.inputErrorMsg.hidden = false;
  elements.inputGuess.setAttribute('aria-invalid', 'true');
  elements.inputGuess.focus();
}

function hideInputError() {
  elements.inputErrorMsg.hidden = true;
  elements.inputGuess.removeAttribute('aria-invalid');
}

// Update visual display panel
function updateStatusPanel(stateClass, icon, message) {
  elements.statusPanel.className = `status-panel ${stateClass}`;
  elements.statusIcon.textContent = icon === 'UP' ? '📈' : '📉';
  elements.statusMessage.textContent = message;
}

// Add an item to the history UI list
function addHistoryItem(attemptNumber, guess, result) {
  elements.noHistoryText.style.display = 'none';
  elements.tryCount.textContent = attemptNumber;
  
  const li = document.createElement('li');
  li.className = 'history-item';
  
  const tagClass = result === 'UP' ? 'tag-up' : 'tag-down';
  
  li.innerHTML = `
    <span class="try-num">${attemptNumber}회차</span>
    <span class="guess-val">${guess}</span>
    <span class="result-tag ${tagClass}">${result}</span>
  `;
  
  elements.historyList.insertBefore(li, elements.historyList.firstChild);
}

// Game Success
function handleGameSuccess() {
  sounds.success();
  runConfetti();
  
  elements.modalBadge.className = 'modal-badge success';
  elements.modalBadge.textContent = '🎉';
  elements.modalTitle.textContent = '성공했습니다!';
  
  let descText = `${gameState.attempts}번의 시도 끝에 정답 **${gameState.targetNumber}**를 맞추셨습니다!`;
  
  // Check & Save Record in Challenge Mode
  if (gameState.mode === 'challenge') {
    const prevBest = localStorage.getItem('updown_best_score');
    if (!prevBest || gameState.attempts < parseInt(prevBest, 10)) {
      localStorage.setItem('updown_best_score', gameState.attempts);
      elements.newRecordBadge.hidden = false;
      descText += '<br>새로운 최고 기록을 달성하여 저장했습니다!';
      loadHighScore();
    } else {
      elements.newRecordBadge.hidden = true;
    }
  } else {
    elements.newRecordBadge.hidden = true;
  }
  
  elements.modalDesc.innerHTML = descText;
  
  // Show Modal
  showModal();
  announceText(`축하합니다! ${gameState.attempts}번의 시도 끝에 정답 ${gameState.targetNumber}를 맞춰 성공했습니다!`);
}

// Game Failure (Challenge Mode)
function handleGameFailure() {
  sounds.fail();
  
  elements.modalBadge.className = 'modal-badge fail';
  elements.modalBadge.textContent = '💀';
  elements.modalTitle.textContent = '도전에 실패했습니다...';
  elements.modalDesc.innerHTML = `7번의 기회를 모두 소진했습니다. 정답은 <strong>${gameState.targetNumber}</strong>였습니다. 다시 도전해 보세요!`;
  elements.newRecordBadge.hidden = true;
  
  showModal();
  announceText(`안타깝게도 실패하셨습니다. 7번의 기회를 모두 사용하여 게임이 끝났습니다. 정답은 ${gameState.targetNumber}였습니다.`);
}

// Modal management
function showModal() {
  elements.resultModal.hidden = false;
  elements.btnModalRestart.focus(); // Shift focus to main modal action
}

function closeModal() {
  elements.resultModal.hidden = true;
  stopConfetti();
  // Move back to main menu
  exitGamePlay();
}

function exitGamePlay() {
  stopConfetti();
  elements.screenGamePlay.hidden = true;
  elements.screenModeSelect.hidden = false;
  loadHighScore();
}

// ==========================================================================
// 6. Accessibility & Control Toolbar Actions
// ==========================================================================

// Font Size Control
function applyZoom() {
  document.documentElement.style.setProperty('--zoom-factor', gameState.zoomLevel);
  elements.btnZoomReset.textContent = `${Math.round(gameState.zoomLevel * 100)}%`;
  announceText(`글자 크기가 ${Math.round(gameState.zoomLevel * 100)}%로 조절되었습니다.`);
}

function handleZoomIn() {
  if (gameState.zoomLevel < 1.4) {
    gameState.zoomLevel = Math.min(1.4, gameState.zoomLevel + 0.1);
    applyZoom();
  } else {
    sounds.error();
  }
}

function handleZoomOut() {
  if (gameState.zoomLevel > 0.8) {
    gameState.zoomLevel = Math.max(0.8, gameState.zoomLevel - 0.1);
    applyZoom();
  } else {
    sounds.error();
  }
}

function handleZoomReset() {
  gameState.zoomLevel = 1.0;
  applyZoom();
}

// High Contrast Mode Toggle
function handleContrastToggle() {
  const isHighContrast = document.body.classList.toggle('high-contrast');
  elements.btnContrastToggle.setAttribute('aria-pressed', isHighContrast ? 'true' : 'false');
  
  if (isHighContrast) {
    announceText("고대비 모드가 활성화되었습니다.");
  } else {
    announceText("고대비 모드가 비활성화되었습니다.");
  }
}

// Sound Mute Toggle
function handleMuteToggle() {
  gameState.isMuted = !gameState.isMuted;
  elements.btnMuteToggle.setAttribute('aria-pressed', gameState.isMuted ? 'true' : 'false');
  
  if (gameState.isMuted) {
    elements.soundIcon.textContent = '🔇';
    elements.btnMuteToggle.innerHTML = '<span class="icon" id="sound-icon">🔇</span> 소리 끔';
    announceText("효과음이 꺼졌습니다.");
  } else {
    elements.soundIcon.textContent = '🔊';
    elements.btnMuteToggle.innerHTML = '<span class="icon" id="sound-icon">🔊</span> 소리 켬';
    // Immediately play brief tone to confirm
    playTone(440, 'sine', 0.08);
    announceText("효과음이 켜졌습니다.");
  }
}

// ==========================================================================
// 7. Event Listeners Initialization
// ==========================================================================
function initEvents() {
  // Screen Transitions
  elements.btnPractice.addEventListener('click', () => startGame('practice'));
  elements.btnChallenge.addEventListener('click', () => startGame('challenge'));
  elements.btnGoBack.addEventListener('click', () => {
    sounds.click();
    exitGamePlay();
  });

  // Submit Guess Form
  elements.guessForm.addEventListener('submit', submitGuess);

  // Modal Actions
  elements.btnModalRestart.addEventListener('click', () => {
    elements.resultModal.hidden = true;
    stopConfetti();
    startGame(gameState.mode);
  });
  elements.btnModalClose.addEventListener('click', closeModal);

  // Accessibility Controls
  elements.btnZoomIn.addEventListener('click', handleZoomIn);
  elements.btnZoomOut.addEventListener('click', handleZoomOut);
  elements.btnZoomReset.addEventListener('click', handleZoomReset);
  elements.btnContrastToggle.addEventListener('click', handleContrastToggle);
  elements.btnMuteToggle.addEventListener('click', handleMuteToggle);

  // Document-wide Keypress escape for modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.resultModal.hidden) {
      closeModal();
    }
  });
}

// Initial setup on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  loadHighScore();
});
