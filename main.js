/* ============================================
   BanglaMap — Division Quest  |  main.js
   ============================================ */

"use strict";

// ---- DATA ----
const DIVISIONS = {
  BDC: "Dhaka",
  BDB: "Chittagong",
  BDD: "Khulna",
  BDE: "Rajshahi",
  BDG: "Sylhet",
  BDA: "Barisal",
  BDF: "Rangpur",
  BDH: "Mymensingh"
};
const IDS = Object.keys(DIVISIONS);
const TOTAL_QUESTIONS = IDS.length; // one round = ask for every division once
const TIME_PER_QUESTION = 10;       // seconds

// ---- STATE ----
let state = {
  score:       0,
  streak:      0,
  bestStreak:  0,
  correct:     0,
  queue:       [],    // shuffled question queue for this round
  currentIdx:  0,
  targetId:    null,
  nextId:      null,
  timer:       null,
  timeLeft:    TIME_PER_QUESTION,
  bestScore:   parseInt(localStorage.getItem("banglamap_best") || "0", 10),
  answered:    false
};

// ---- DOM REFS ----
const DOM = {
  scoreDisplay: document.getElementById("score-display"),
  streakDisplay: document.getElementById("streak-display"),
  bestDisplay:  document.getElementById("best-display"),
  streakPill:   document.getElementById("stat-streak"),
  streakFire:   document.getElementById("streak-fire"),
  timerNumber:  document.getElementById("timer-number"),
  timerRing:    document.getElementById("timer-ring-prog"),
  missionCity:  document.getElementById("mission-city"),
  missionHint:  document.getElementById("mission-hint"),
  questionBadge: document.getElementById("question-badge"),
  nextCityName: document.getElementById("next-city-name"),
  toast:        document.getElementById("toast"),
  toastMsg:     document.getElementById("toast-msg"),
  toastIcon:    document.getElementById("toast-icon"),
  modalOverlay: document.getElementById("modal-overlay"),
  mScore:       document.getElementById("m-score"),
  mCorrect:     document.getElementById("m-correct"),
  mStreak:      document.getElementById("m-streak"),
  modalEmoji:   document.getElementById("modal-emoji"),
  modalTitle:   document.getElementById("modal-title"),
  playAgainBtn: document.getElementById("play-again-btn"),
  rippleLayer:  document.getElementById("ripple-layer"),
  mainSvg:      document.getElementById("main-svg"),
  particles:    document.getElementById("particles")
};

// ---- UTILS ----
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function animateStat(el) {
  el.classList.remove("pop");
  void el.offsetWidth; // reflow
  el.classList.add("pop");
}

let toastTimeout;
function showToast(msg, icon, isWrong = false) {
  clearTimeout(toastTimeout);
  DOM.toastMsg.textContent  = msg;
  DOM.toastIcon.textContent = icon;
  DOM.toast.classList.toggle("wrong-toast", isWrong);
  DOM.toast.classList.add("show");
  toastTimeout = setTimeout(() => DOM.toast.classList.remove("show"), 1800);
}

function spawnScorePop(text, good, x, y) {
  const el = document.createElement("div");
  el.className = `score-pop ${good ? "good" : "bad"}`;
  el.textContent = text;
  el.style.left = x + "px";
  el.style.top  = y + "px";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function spawnRipple(x, y, bad = false) {
  const rect = DOM.rippleLayer.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "ripple" + (bad ? " bad" : "");
  el.style.left = (x - rect.left) + "px";
  el.style.top  = (y - rect.top)  + "px";
  DOM.rippleLayer.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

// ---- PARTICLES ----
function spawnParticles() {
  DOM.particles.innerHTML = "";
  for (let i = 0; i < 22; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.left = Math.random() * 100 + "%";
    p.style.bottom = 0;
    p.style.setProperty("--dur",   (6 + Math.random() * 8) + "s");
    p.style.setProperty("--delay", (Math.random() * 10) + "s");
    DOM.particles.appendChild(p);
  }
}

// ---- TIMER ---- 
const CIRCUMFERENCE = 2 * Math.PI * 18; // r=18 → ~113
function startTimer() {
  clearInterval(state.timer);
  state.timeLeft = TIME_PER_QUESTION;
  updateTimerUI();
  state.timer = setInterval(() => {
    state.timeLeft--;
    updateTimerUI();
    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      handleTimeout();
    }
  }, 1000);
}

function updateTimerUI() {
  const pct = state.timeLeft / TIME_PER_QUESTION;
  const offset = CIRCUMFERENCE * (1 - pct);
  DOM.timerRing.style.strokeDashoffset = offset;
  DOM.timerNumber.textContent = state.timeLeft;
  const urgent = state.timeLeft <= 5;
  DOM.timerRing.classList.toggle("urgent", urgent);
  DOM.timerNumber.classList.toggle("urgent", urgent);
}

function stopTimer() {
  clearInterval(state.timer);
}

// ---- GAME LOGIC ----
function buildQueue() {
  return shuffle(IDS);
}

function startGame() {
  state.score      = 0;
  state.streak     = 0;
  state.bestStreak = 0;
  state.correct    = 0;
  state.queue      = buildQueue();
  state.currentIdx = 0;
  state.answered   = false;

  updateScoreUI(false);
  updateStreakUI(false);
  DOM.bestDisplay.textContent = state.bestScore;

  loadQuestion();
  DOM.modalOverlay.classList.remove("show");
}

function loadQuestion() {
  stopTimer();
  state.answered = false;

  // Clear all highlights
  IDS.forEach(id => {
    const el = DOM.mainSvg.querySelector(`#${id}`);
    if (el) {
      el.classList.remove("correct", "wrong",);
    }
  });

  state.targetId = state.queue[state.currentIdx];
  const nextIdx  = state.currentIdx + 1;
  state.nextId   = nextIdx < state.queue.length ? state.queue[nextIdx] : null;

  // Update mission card
  DOM.missionCity.style.animation = "none";
  void DOM.missionCity.offsetWidth;
  DOM.missionCity.style.animation = "";
  DOM.missionCity.textContent   = DIVISIONS[state.targetId];

  DOM.questionBadge.textContent = `${state.currentIdx + 1} / ${TOTAL_QUESTIONS}`;
  DOM.nextCityName.textContent  = state.nextId ? DIVISIONS[state.nextId] : "—";

  // Pulse the target path subtly
  const targetPath = DOM.mainSvg.querySelector(`#${state.targetId}`);
  if (targetPath) targetPath.classList.add("target-pulse");

  startTimer();
}

function handleAnswer(clickedId, clickX, clickY) {
  if (state.answered) return;
  state.answered = true;
  stopTimer();

  const isCorrect = clickedId === state.targetId;
  const targetPath = DOM.mainSvg.querySelector(`#${state.targetId}`);
  const clickedPath = DOM.mainSvg.querySelector(`#${clickedId}`);

  if (isCorrect) {
    // Correct
    state.score  += 2 * (state.streak + 1) + state.timeLeft;
    state.streak += 1;
    state.correct++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    if (clickedPath) {
      clickedPath.classList.remove("target-pulse");
      clickedPath.classList.add("correct");
    }
    spawnRipple(clickX, clickY, false);
    spawnScorePop("+2", true, clickX, clickY - 20);
    showToast(`${DIVISIONS[clickedId]} — Correct!`, "✓", false);
  } else {
    // Wrong
    state.score  = Math.max(0, state.score - 1);
    state.streak = 0;
    if (clickedPath) clickedPath.classList.add("wrong");
    if (targetPath)  {
      targetPath.classList.remove("target-pulse");
      targetPath.classList.add("correct"); // reveal where it was
    }
    spawnRipple(clickX, clickY, true);
    spawnScorePop("−1", false, clickX, clickY - 20);
    showToast(`It was ${DIVISIONS[state.targetId]}!`, "✗", true);
  }

  updateScoreUI(true);
  updateStreakUI(true);

  // Advance after a short delay
  setTimeout(() => {
    state.currentIdx++;
    if (state.currentIdx >= TOTAL_QUESTIONS) {
      endRound();
    } else {
      loadQuestion();
    }
  }, isCorrect ? 900 : 1400);
}

function handleTimeout() {
  if (state.answered) return;
  state.answered = true;

  state.score  = Math.max(0, state.score - 1);
  state.streak = 0;

  const targetPath = DOM.mainSvg.querySelector(`#${state.targetId}`);
  if (targetPath) {
    targetPath.classList.remove("target-pulse");
    targetPath.classList.add("wrong");
  }
  showToast(`Time's up! It was ${DIVISIONS[state.targetId]}`, "⏱", true);
  spawnScorePop("−1", false, window.innerWidth / 2, window.innerHeight / 2);

  updateScoreUI(true);
  updateStreakUI(true);

  setTimeout(() => {
    state.currentIdx++;
    if (state.currentIdx >= TOTAL_QUESTIONS) {
      endRound();
    } else {
      loadQuestion();
    }
  }, 1600);
}

function endRound() {
  stopTimer();
  // Update best score
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem("banglamap_best", state.bestScore);
  }

  const pct = state.correct / TOTAL_QUESTIONS;
  DOM.modalEmoji.textContent = pct === 1 ? "🏆" : pct >= 0.7 ? "🎯" : pct >= 0.4 ? "📍" : "🗺️";
  DOM.modalTitle.textContent = pct === 1 ? "Perfect Round!" : pct >= 0.7 ? "Well Done!" : pct >= 0.4 ? "Good Try!" : "Keep Practicing!";
  DOM.mScore.textContent   = state.score;
  DOM.mCorrect.textContent = `${state.correct}/${TOTAL_QUESTIONS}`;
  DOM.mStreak.textContent  = state.bestStreak;

  setTimeout(() => DOM.modalOverlay.classList.add("show"), 400);
}

// ---- UI HELPERS ----
function updateScoreUI(animate) {
  DOM.scoreDisplay.textContent = state.score;
  DOM.bestDisplay.textContent  = Math.max(state.score, state.bestScore);
  if (animate) {
    animateStat(DOM.scoreDisplay);
    animateStat(DOM.bestDisplay);
  }
}

function updateStreakUI(animate) {
  DOM.streakDisplay.textContent = state.streak;
  DOM.streakPill.classList.toggle("active", state.streak >= 3);
  DOM.streakFire.textContent = state.streak >= 5 ? "🔥" : state.streak >= 3 ? "✨" : "";
  if (animate) animateStat(DOM.streakDisplay);
}

// ---- EVENT LISTENERS ----
DOM.mainSvg.addEventListener("click", function(e) {
  const path = e.target.closest("path");
  if (!path || !path.id || !DIVISIONS[path.id]) return;
  handleAnswer(path.id, e.clientX, e.clientY);
});


DOM.playAgainBtn.addEventListener("click", startGame);

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  spawnParticles();
  startGame();
});
