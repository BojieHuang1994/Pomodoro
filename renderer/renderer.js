/* ===== DOM 引用 ===== */
const timeDisplay = document.getElementById('timeDisplay');
const progressRing = document.querySelector('.ring-progress');
const btnStart = document.getElementById('btnStart');
const btnPause = document.getElementById('btnPause');
const btnReset = document.getElementById('btnReset');
const modeFocusBtn = document.getElementById('modeFocus');
const modeBreakBtn = document.getElementById('modeBreak');
const statCount = document.getElementById('statCount');
const statMinutes = document.getElementById('statMinutes');

/* ===== 常量 ===== */
const FOCUS_SECONDS = 25 * 60;   // 1500
const BREAK_SECONDS = 5 * 60;    // 300
const RING_CIRCUMFERENCE = 2 * Math.PI * 106; // ≈ 666

/* ===== 状态 ===== */
let mode = 'focus';           // 'focus' | 'break'
let timerState = 'idle';      // 'idle' | 'running' | 'paused'
let timeRemaining = FOCUS_SECONDS;
let totalSeconds = FOCUS_SECONDS;
let intervalId = null;
let todayStats = { focusCount: 0, focusMinutes: 0 };

/* ===== 初始化 ===== */
function init() {
  progressRing.style.strokeDasharray = RING_CIRCUMFERENCE;
  progressRing.style.strokeDashoffset = '0';
  updateDisplay();
  loadTodayStats();
}

/* ===== 统计加载 ===== */
async function loadTodayStats() {
  try {
    const stats = await window.electronAPI.getStats();
    const today = new Date().toISOString().slice(0, 10);
    todayStats = stats[today] || { focusCount: 0, focusMinutes: 0 };
  } catch (err) {
    console.error('加载统计失败:', err);
    todayStats = { focusCount: 0, focusMinutes: 0 };
  }
  renderStats();
}

function renderStats() {
  statCount.textContent = todayStats.focusCount;
  statMinutes.textContent = todayStats.focusMinutes;
}

/* ===== 显示更新 ===== */
function updateDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  timeDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const progress = (totalSeconds - timeRemaining) / totalSeconds;
  progressRing.style.strokeDashoffset = progress * RING_CIRCUMFERENCE;
}

/* ===== 模式切换 ===== */
function switchMode(newMode) {
  if (timerState === 'running') {
    stopTimer();
  }

  mode = newMode;
  timerState = 'idle';
  totalSeconds = mode === 'focus' ? FOCUS_SECONDS : BREAK_SECONDS;
  timeRemaining = totalSeconds;

  // 更新模式标签激活状态
  modeFocusBtn.classList.toggle('active', mode === 'focus');
  modeBreakBtn.classList.toggle('active', mode === 'break');

  // 更新进度环颜色
  progressRing.classList.toggle('break-mode', mode === 'break');

  updateDisplay();
  updateButtonStates();
}

/* ===== 计时器控制 ===== */
function startTimer() {
  if (timerState === 'running') return;

  timerState = 'running';
  updateButtonStates();

  intervalId = setInterval(() => {
    timeRemaining--;

    if (timeRemaining <= 0) {
      timeRemaining = 0;
      updateDisplay();
      onTimerComplete();
      return;
    }

    updateDisplay();
  }, 1000);
}

function pauseTimer() {
  if (timerState !== 'running') return;

  stopTimer();
  timerState = 'paused';
  updateButtonStates();
}

function resetTimer() {
  stopTimer();
  timerState = 'idle';
  timeRemaining = totalSeconds;
  updateDisplay();
  updateButtonStates();
}

function stopTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/* ===== 计时完成 ===== */
async function onTimerComplete() {
  stopTimer();

  if (mode === 'focus') {
    // 记录专注完成
    const focusMinutes = Math.floor(FOCUS_SECONDS / 60);

    try {
      const updatedStats = await window.electronAPI.recordFocus(focusMinutes);
      const today = new Date().toISOString().slice(0, 10);
      todayStats = updatedStats[today] || { focusCount: 0, focusMinutes: 0 };
      renderStats();
    } catch (err) {
      // 即使记录失败也更新本地显示
      todayStats.focusCount += 1;
      todayStats.focusMinutes += focusMinutes;
      renderStats();
    }

    // 通知
    window.electronAPI.sendNotification('🍅 专注完成！', '干得好，休息一下吧。');

    // 自动切换到休息模式
    switchMode('break');
    startTimer();
  } else {
    // 休息完成
    window.electronAPI.sendNotification('☕ 休息结束', '准备开始下一轮专注吧！');

    // 切换回专注模式，进入空闲状态
    switchMode('focus');
  }
}

/* ===== 按钮状态 ===== */
function updateButtonStates() {
  switch (timerState) {
    case 'idle':
      btnStart.disabled = false;
      btnStart.textContent = '开始';
      btnPause.disabled = true;
      btnReset.disabled = true;
      break;
    case 'running':
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnPause.textContent = '暂停';
      btnReset.disabled = false;
      break;
    case 'paused':
      btnStart.disabled = false;
      btnStart.textContent = '继续';
      btnPause.disabled = true;
      btnReset.disabled = false;
      break;
  }
}

/* ===== 事件绑定 ===== */
btnStart.addEventListener('click', startTimer);
btnPause.addEventListener('click', pauseTimer);
btnReset.addEventListener('click', resetTimer);

modeFocusBtn.addEventListener('click', () => {
  if (mode !== 'focus') switchMode('focus');
});

modeBreakBtn.addEventListener('click', () => {
  if (mode !== 'break') switchMode('break');
});

/* ===== 启动 ===== */
init();
