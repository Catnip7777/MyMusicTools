const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const WHITE_INDICES = [0, 2, 4, 5, 7, 9, 11];

const BLACK_INDICES = [1, 3, 6, 8, 10];



/** Standard 88-key piano: A0 (21) – C8 (108) */
const MIDI_MIN = 21;

const MIDI_MAX = 108;

const TAP_DURATION_RATIO = 0.54;



let audioCtx = null;

let currentTarget = null;

let answered = false;

let stats = { correct: 0, total: 0, streak: 0 };

let roundReplay = { guessMidi: null, targetMidi: null };



const els = {

  rangeLow: document.getElementById("range-low"),

  rangeHigh: document.getElementById("range-high"),

  includeBlack: document.getElementById("include-black"),

  instrument: document.getElementById("instrument"),

  volume: document.getElementById("volume"),

  volumeValue: document.getElementById("volume-value"),

  duration: document.getElementById("duration"),

  durationValue: document.getElementById("duration-value"),

  btnPlay: document.getElementById("btn-play"),

  btnReplayQuestion: document.getElementById("btn-replay-question"),

  btnNext: document.getElementById("btn-next"),

  piano: document.getElementById("piano"),

  hint: document.getElementById("hint"),

  feedback: document.getElementById("feedback"),

  feedbackResult: document.getElementById("feedback-result"),

  feedbackAnswer: document.getElementById("feedback-answer"),

  statCorrect: document.getElementById("stat-correct"),

  statTotal: document.getElementById("stat-total"),

  statStreak: document.getElementById("stat-streak"),

  replayPanel: document.getElementById("replay-panel"),

  replayGuessBlock: document.getElementById("replay-guess-block"),

  replayAnswerBlock: document.getElementById("replay-answer-block"),

  replayGuessLabel: document.getElementById("replay-guess-label"),

  replayAnswerLabel: document.getElementById("replay-answer-label"),

  btnReplayGuess: document.getElementById("btn-replay-guess"),

  btnReplayAnswer: document.getElementById("btn-replay-answer"),

  usernameInput: document.getElementById("username-input"),

  btnAccountLogin: document.getElementById("btn-account-login"),

  accountSelect: document.getElementById("account-select"),

  accountStatus: document.getElementById("account-status"),

  accountMessage: document.getElementById("account-message"),

  btnAccountReset: document.getElementById("btn-account-reset"),

  btnAccountDelete: document.getElementById("btn-account-delete"),

};



function midiToFreq(midi) {

  return 440 * Math.pow(2, (midi - 69) / 12);

}



function midiToLabel(midi) {

  const name = NOTE_NAMES[midi % 12];

  const octave = Math.floor(midi / 12) - 1;

  return `${name}${octave}`;

}



function ensureAudio() {

  if (!audioCtx) {

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  }

  if (audioCtx.state === "suspended") {

    audioCtx.resume();

  }

}



function getVolume() {
  return (parseInt(els.volume?.value ?? "85", 10) || 0) / 100;
}

function getDuration() {
  return (parseInt(els.duration?.value ?? "28", 10) || 28) / 10;
}

function getTapDuration() {
  return getDuration() * TAP_DURATION_RATIO;
}

function playNote(midi, duration) {
  ensureAudio();
  const now = audioCtx.currentTime;
  const freq = midiToFreq(midi);
  const id = els.instrument?.value ?? InstrumentEngine.defaultId;
  const dur = duration ?? getDuration();
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(getVolume(), now);
  master.connect(audioCtx.destination);
  InstrumentEngine.play(audioCtx, id, freq, now, dur, master);
}

function syncDurationSliderAria() {
  const sec = getDuration();
  els.duration.setAttribute("aria-valuenow", String(sec));
  els.duration.setAttribute("aria-valuetext", `${sec} 秒`);
}

function updateVolumeLabel() {
  const v = parseInt(els.volume.value, 10);
  els.volumeValue.textContent = `${v}%`;
  els.volume.setAttribute("aria-valuetext", `${v}%`);
}

function updateDurationLabel() {
  const sec = getDuration();
  els.durationValue.textContent = `${sec.toFixed(1)} 秒`;
  syncDurationSliderAria();
}

let settingsPreviewTimer = null;

function previewSettingsNote() {
  clearTimeout(settingsPreviewTimer);
  settingsPreviewTimer = setTimeout(() => {
    ensureAudio();
    playNote(60, getDuration());
  }, 150);
}

function persistSettings() {
  AppSettings.save(AppSettings.readFromDOM(els));
}

function initAppSettings() {
  const validInstruments = InstrumentEngine.list().map((i) => i.id);
  AppSettings.applyToDOM(els, AppSettings.get(), validInstruments);
  updateVolumeLabel();
  updateDurationLabel();

  els.volume.addEventListener("input", () => {
    updateVolumeLabel();
    persistSettings();
    previewSettingsNote();
  });

  els.duration.addEventListener("input", () => {
    updateDurationLabel();
    persistSettings();
    previewSettingsNote();
  });

  els.rangeLow.addEventListener("change", () => {
    persistSettings();
    onSettingsChange();
  });

  els.rangeHigh.addEventListener("change", () => {
    persistSettings();
    onSettingsChange();
  });

  els.includeBlack.addEventListener("change", () => {
    persistSettings();
    onSettingsChange();
  });

  els.instrument.addEventListener("change", () => {
    persistSettings();
    previewInstrument();
  });
}



function persistStats() {

  const user = AccountStore.getCurrent();

  if (user) AccountStore.setStats(user, stats);

}



function loadAccountStats() {

  const user = AccountStore.getCurrent();

  stats = user ? { ...AccountStore.getStats(user) } : { correct: 0, total: 0, streak: 0 };

  updateStats();

}



function showAccountMessage(text, type = "info") {

  if (!text) {

    els.accountMessage.hidden = true;

    return;

  }

  els.accountMessage.hidden = false;

  els.accountMessage.textContent = text;

  els.accountMessage.className = `account-message account-message--${type}`;

}



function refreshAccountSelect() {

  const current = AccountStore.getCurrent();

  const names = AccountStore.list();

  els.accountSelect.innerHTML = '<option value="">— 未选择 —</option>';

  names.forEach((name) => {

    const opt = document.createElement("option");

    opt.value = name;

    opt.textContent = name;

    els.accountSelect.appendChild(opt);

  });

  els.accountSelect.value = current ?? "";

}



function updateAccountUI() {

  const user = AccountStore.getCurrent();

  const loggedIn = !!user;

  els.btnAccountReset.disabled = !loggedIn;

  els.btnAccountDelete.disabled = !loggedIn;

  refreshAccountSelect();

  if (loggedIn) {

    const s = AccountStore.getStats(user);

    els.accountStatus.textContent = `当前账号：${user}（正确 ${s.correct} / 总计 ${s.total} / 连对 ${s.streak}）`;

    els.usernameInput.value = user;

  } else {

    els.accountStatus.textContent =
      "未登录，请输入用户名后点击「进入」（未登录时成绩不会保存）";

  }

}



function handleAccountLogin() {

  const result = AccountStore.createOrLogin(els.usernameInput.value);

  if (!result.ok) {

    showAccountMessage(result.error, "error");

    return;

  }

  loadAccountStats();

  updateAccountUI();

  showAccountMessage(

    result.created ? `已创建账号「${result.username}」` : `已登录「${result.username}」`,

    "success"

  );

}



function handleAccountSwitch() {

  const name = els.accountSelect.value;

  if (!name) {

    const cur = AccountStore.getCurrent();

    if (cur) {

      AccountStore.setStats(cur, stats);

    }

    AccountStore.logout();

    stats = { correct: 0, total: 0, streak: 0 };

    updateStats();

    updateAccountUI();

    showAccountMessage("已退出当前账号（成绩已保存）", "info");

    return;

  }

  const current = AccountStore.getCurrent();

  if (current) AccountStore.setStats(current, stats);

  const result = AccountStore.switchTo(name);

  if (!result.ok) {

    showAccountMessage(result.error, "error");

    return;

  }

  loadAccountStats();

  updateAccountUI();

  showAccountMessage(`已切换到「${name}」`, "success");

}



function handleAccountReset() {

  const user = AccountStore.getCurrent();

  if (!user) return;

  if (!confirm(`确定重置「${user}」的成绩吗？`)) return;

  const result = AccountStore.reset(user);

  if (!result.ok) {

    showAccountMessage(result.error, "error");

    return;

  }

  stats = { ...result.stats };

  updateStats();

  updateAccountUI();

  showAccountMessage(`已重置「${user}」的成绩`, "success");

}



function handleAccountDelete() {

  const user = AccountStore.getCurrent();

  if (!user) return;

  if (!confirm(`确定删除账号「${user}」吗？此操作不可恢复。`)) return;

  const result = AccountStore.remove(user);

  if (!result.ok) {

    showAccountMessage(result.error, "error");

    return;

  }

  stats = { correct: 0, total: 0, streak: 0 };

  updateStats();

  els.usernameInput.value = "";

  updateAccountUI();

  showAccountMessage(`已删除账号「${user}」`, "success");

}



function clearReplayPanel() {

  roundReplay = { guessMidi: null, targetMidi: null };

  els.replayPanel.hidden = true;

  els.replayGuessBlock.hidden = true;

  els.replayAnswerBlock.hidden = true;

}



function showReplayPanel(guessedMidi, targetMidi) {

  roundReplay = { guessMidi: guessedMidi, targetMidi };

  els.replayPanel.hidden = false;

  els.replayGuessBlock.hidden = false;

  els.replayAnswerBlock.hidden = false;

  els.replayGuessLabel.textContent = midiToLabel(guessedMidi);

  els.replayAnswerLabel.textContent = midiToLabel(targetMidi);

  if (guessedMidi === targetMidi) {

    els.replayGuessBlock.classList.add("replay-card--same");

  } else {

    els.replayGuessBlock.classList.remove("replay-card--same");

  }

}



function fillInstrumentSelect() {

  InstrumentEngine.list().forEach(({ id, label }) => {

    const opt = document.createElement("option");

    opt.value = id;

    opt.textContent = label;

    els.instrument.appendChild(opt);

  });

}



function previewInstrument() {

  ensureAudio();

  playNote(60, getTapDuration());

}



function fillRangeSelects() {

  for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {

    const label = midiToLabel(midi);

    const optLow = document.createElement("option");

    optLow.value = String(midi);

    optLow.textContent = label;

    els.rangeLow.appendChild(optLow);



    const optHigh = document.createElement("option");

    optHigh.value = String(midi);

    optHigh.textContent = label;

    els.rangeHigh.appendChild(optHigh);

  }

}



function getRange() {

  let low = parseInt(els.rangeLow.value, 10);

  let high = parseInt(els.rangeHigh.value, 10);

  if (low > high) [low, high] = [high, low];

  return { low, high };

}



function getAllowedMidis() {

  const { low, high } = getRange();

  const includeBlack = els.includeBlack.checked;

  const list = [];

  for (let m = low; m <= high; m++) {

    const isBlack = BLACK_INDICES.includes(m % 12);

    if (!includeBlack && isBlack) continue;

    list.push(m);

  }

  return list;

}



function pickRandomTarget() {

  const allowed = getAllowedMidis();

  if (allowed.length === 0) return null;

  return allowed[Math.floor(Math.random() * allowed.length)];

}



function isBlackKey(midi) {

  return BLACK_INDICES.includes(midi % 12);

}



function isKeyInRange(midi) {

  const { low, high } = getRange();

  return midi >= low && midi <= high;

}



function isKeyAllowedForQuiz(midi) {

  if (!isKeyInRange(midi)) return false;

  if (!els.includeBlack.checked && isBlackKey(midi)) return false;

  return true;

}



function countWhitesBefore(midi) {

  let count = 0;

  for (let m = MIDI_MIN; m < midi; m++) {

    if (WHITE_INDICES.includes(m % 12)) count++;

  }

  return count;

}



function buildPiano() {
  els.piano.innerHTML = "";

  const whiteKeys = [];
  for (let m = MIDI_MIN; m <= MIDI_MAX; m++) {
    if (WHITE_INDICES.includes(m % 12)) whiteKeys.push(m);
  }

  els.piano.style.setProperty("--white-count", String(whiteKeys.length));
  els.piano.style.width = "";

  whiteKeys.forEach((midi) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "key white";
    btn.dataset.midi = String(midi);
    btn.setAttribute("aria-label", midiToLabel(midi));
    const showLabel = midi % 12 === 0;
    btn.innerHTML = showLabel
      ? `<span class="key-label">${midiToLabel(midi)}</span>`
      : "";
    btn.addEventListener("pointerdown", (e) => onKeyPress(e, midi, btn));
    els.piano.appendChild(btn);
  });

  for (let m = MIDI_MIN; m <= MIDI_MAX; m++) {
    if (!isBlackKey(m)) continue;

    const whiteIndexBefore = countWhitesBefore(m);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "key black";
    btn.dataset.midi = String(m);
    btn.setAttribute("aria-label", midiToLabel(m));
    btn.style.setProperty("--black-slot", String(whiteIndexBefore));
    btn.addEventListener("pointerdown", (e) => onKeyPress(e, m, btn));
    els.piano.appendChild(btn);
  }

  updatePianoState();
}



function updatePianoState() {

  const { low, high } = getRange();

  const includeBlack = els.includeBlack.checked;



  els.piano.querySelectorAll(".key").forEach((btn) => {

    const m = parseInt(btn.dataset.midi, 10);

    const inRange = m >= low && m <= high;

    const excluded = inRange && isBlackKey(m) && !includeBlack;



    btn.classList.toggle("out-of-range", !inRange);

    btn.classList.toggle("excluded", excluded);

    btn.toggleAttribute("data-inactive", !inRange || excluded);

  });

}



function flashKey(btn, className, ms = 400) {

  btn.classList.add("active", className);

  setTimeout(() => {

    btn.classList.remove("active");

    if (!answered || className !== "highlight-answer") {

      btn.classList.remove(className);

    }

  }, ms);

}



function onKeyPress(e, midi, btn) {

  e.preventDefault();

  ensureAudio();

  const canAnswer =

    currentTarget !== null && !answered && isKeyAllowedForQuiz(midi);

  playNote(midi, canAnswer ? getTapDuration() : getTapDuration() * 0.85);

  flashKey(btn, "active", 180);



  if (!canAnswer) return;



  answered = true;

  const correct = midi === currentTarget;

  stats.total += 1;

  if (correct) {

    stats.correct += 1;

    stats.streak += 1;

  } else {

    stats.streak = 0;

  }

  updateStats();

  persistStats();

  showFeedback(correct, midi);

  showReplayPanel(midi, currentTarget);

  highlightKeys(midi);

  els.btnPlay.disabled = true;

  els.piano.classList.add("round-locked");

}



function highlightKeys(guessedMidi) {

  const keys = els.piano.querySelectorAll(".key");

  keys.forEach((k) => {

    const m = parseInt(k.dataset.midi, 10);

    k.classList.remove("highlight-correct", "highlight-wrong", "highlight-answer");

    if (m === currentTarget) {

      k.classList.add("highlight-answer");

    }

    if (m === guessedMidi && guessedMidi === currentTarget) {

      k.classList.add("highlight-correct");

    } else if (m === guessedMidi) {

      k.classList.add("highlight-wrong");

    }

  });

}



function showFeedback(correct, guessedMidi) {

  els.feedback.hidden = false;

  els.feedback.className = `feedback ${correct ? "correct" : "wrong"}`;

  els.feedbackResult.textContent = correct ? "回答正确！" : "回答错误";

  const targetLabel = midiToLabel(currentTarget);

  const guessedLabel = midiToLabel(guessedMidi);

  if (correct) {

    els.feedbackAnswer.textContent = `正确答案：${targetLabel}`;

  } else {

    els.feedbackAnswer.textContent = `你的选择：${guessedLabel}　·　正确答案：${targetLabel}`;

  }

  els.hint.hidden = true;

}



function updateStats() {

  els.statCorrect.textContent = String(stats.correct);

  els.statTotal.textContent = String(stats.total);

  els.statStreak.textContent = String(stats.streak);

}



function updateQuizButtons() {
  const inRound = currentTarget !== null && !answered;
  els.btnReplayQuestion.disabled = !inRound;
}

function replayCurrentQuestion() {
  if (currentTarget === null || answered) return;
  ensureAudio();
  playNote(currentTarget, getDuration());
}

function resetRound() {

  currentTarget = null;

  answered = false;

  els.feedback.hidden = true;

  els.hint.hidden = false;

  els.btnPlay.disabled = false;

  updateQuizButtons();

  els.piano.classList.remove("round-locked");

  els.piano.querySelectorAll(".key").forEach((k) => {

    k.classList.remove("highlight-correct", "highlight-wrong", "highlight-answer");

  });

}



function startRound() {

  const allowed = getAllowedMidis();

  if (allowed.length === 0) {

    els.hint.textContent = "当前音域没有可选音符，请调整范围或开启黑键";

    return;

  }



  clearReplayPanel();

  resetRound();

  currentTarget = pickRandomTarget();

  playNote(currentTarget, getDuration());

  updateQuizButtons();

  els.hint.textContent =
    "请听音后在琴键上作答；没听清可点「重播本题」（灰色琴键不在练习范围）";

}



function onSettingsChange() {

  if (parseInt(els.rangeLow.value, 10) > parseInt(els.rangeHigh.value, 10)) {

    if (document.activeElement === els.rangeLow) {

      els.rangeHigh.value = els.rangeLow.value;

    } else {

      els.rangeLow.value = els.rangeHigh.value;

    }

  }

  updatePianoState();

  resetRound();

  clearReplayPanel();

}



function initAccounts() {

  const saved = AccountStore.getCurrent();

  if (saved) {

    loadAccountStats();

    els.usernameInput.value = saved;

  }

  updateAccountUI();



  els.btnAccountLogin.addEventListener("click", handleAccountLogin);

  els.usernameInput.addEventListener("keydown", (e) => {

    if (e.key === "Enter") handleAccountLogin();

  });

  els.accountSelect.addEventListener("change", handleAccountSwitch);

  els.btnAccountReset.addEventListener("click", handleAccountReset);

  els.btnAccountDelete.addEventListener("click", handleAccountDelete);

}



function init() {

  fillRangeSelects();

  fillInstrumentSelect();

  initAppSettings();

  buildPiano();
  updatePianoState();

  initAccounts();

  updateStats();

  updateQuizButtons();



  els.btnReplayGuess.addEventListener("click", () => {

    if (roundReplay.guessMidi != null) {

      ensureAudio();

      playNote(roundReplay.guessMidi, getDuration());

    }

  });

  els.btnReplayAnswer.addEventListener("click", () => {

    if (roundReplay.targetMidi != null) {

      ensureAudio();

      playNote(roundReplay.targetMidi, getDuration());

    }

  });



  els.btnReplayQuestion.addEventListener("click", replayCurrentQuestion);

  els.btnPlay.addEventListener("click", () => {
    ensureAudio();
    if (answered) {
      resetRound();
      startRound();
      return;
    }
    if (currentTarget !== null) return;
    startRound();
  });



  els.btnNext.addEventListener("click", () => {

    resetRound();

    startRound();

  });

  document.addEventListener("keydown", (e) => {
    if (document.activeElement?.tagName === "SELECT") return;
    if (e.code === "Space") {
      e.preventDefault();
      if (currentTarget !== null && !answered) {
        replayCurrentQuestion();
      } else {
        els.btnPlay.click();
      }
    }
    if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (currentTarget !== null && !answered) {
        e.preventDefault();
        replayCurrentQuestion();
      }
    }
  });

}



init();


