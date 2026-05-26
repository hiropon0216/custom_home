/* ===== quiz.js =====
 * クイズエンジン: シャッフル・タイマー・出題・採点・結果描画
 */
const Quiz = (function () {
  const TIMER_SECONDS = 30;
  const PASS_THRESHOLD = 18;   // 18/20 以上でその周をクリア
  const TOTAL_QUESTIONS = 20;

  let state = null;

  // Fisher-Yates シャッフル
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // クイズ開始
  function start(chapterId) {
    const pool = (typeof QUESTIONS !== 'undefined' && QUESTIONS[chapterId]) || [];
    const questions = shuffle(pool).slice(0, TOTAL_QUESTIONS);
    state = {
      chapterId: chapterId,
      questions: questions,
      index: 0,
      answers: [],     // { qIndex, selected, correct(bool), timedOut(bool) }
      timer: null,
      remaining: TIMER_SECONDS
    };
    renderQuestion();
  }

  // タイマー停止
  function stopTimer() {
    if (state && state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  // タイマー開始
  function startTimer() {
    state.remaining = TIMER_SECONDS;
    updateTimerUI();
    state.timer = setInterval(function () {
      state.remaining -= 1;
      updateTimerUI();
      if (state.remaining <= 0) {
        stopTimer();
        // 時間切れ = 自動的に不正解扱いで次へ
        recordAnswer(null, true);
      }
    }, 1000);
  }

  function updateTimerUI() {
    const fill = document.getElementById('timer-fill');
    const sec = document.getElementById('timer-seconds');
    if (!fill || !sec) return;
    const pct = Math.max(0, (state.remaining / TIMER_SECONDS) * 100);
    fill.style.width = pct + '%';
    sec.textContent = state.remaining + ' 秒';
    if (state.remaining <= 10) fill.classList.add('warning');
    else fill.classList.remove('warning');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const TYPE_LABEL = { multiple: '4択問題', truefalse: '○×問題', fillblank: '穴埋め問題' };

  // 現在の問題を描画
  function renderQuestion() {
    const q = state.questions[state.index];
    const qNum = state.index + 1;
    const total = state.questions.length;

    let optionsHtml = '';
    if (q.type === 'truefalse') {
      optionsHtml = `
        <div class="quiz-options tf-options">
          <button class="option-btn" data-value="true">○ 正しい</button>
          <button class="option-btn" data-value="false">✕ 誤り</button>
        </div>`;
    } else {
      const markers = ['A', 'B', 'C', 'D', 'E', 'F'];
      // 選択肢をシャッフル（data-valueは元インデックスを保持するため採点ロジック変更不要）
      const indices = q.options.map(function (_, i) { return i; });
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = indices[i]; indices[i] = indices[j]; indices[j] = tmp;
      }
      optionsHtml = '<div class="quiz-options">' +
        indices.map(function (origIdx, displayPos) {
          return `<button class="option-btn" data-value="${origIdx}">
            <span class="opt-marker">${markers[displayPos]}</span>
            <span>${escapeHtml(q.options[origIdx])}</span>
          </button>`;
        }).join('') +
        '</div>';
    }

    const html = `
      <div class="quiz">
        <div class="quiz-header">
          <div class="quiz-meta">問題 <span class="q-num">${qNum}</span> / ${total}</div>
          <div class="quiz-pass-info">${PASS_THRESHOLD}問以上正解で1周クリア（全${Progress.REQUIRED_PASSES}周で章クリア）</div>
        </div>
        <div class="timer-wrap">
          <div class="timer-label">
            <span>残り時間</span>
            <span class="timer-seconds" id="timer-seconds">${TIMER_SECONDS} 秒</span>
          </div>
          <div class="timer-track">
            <div class="timer-fill" id="timer-fill" style="width:100%"></div>
          </div>
        </div>
        <div class="quiz-card">
          <span class="quiz-type-tag">${TYPE_LABEL[q.type] || ''}</span>
          <div class="quiz-question">${escapeHtml(q.question)}</div>
          ${optionsHtml}
          <div class="quiz-actions">
            <button class="btn btn-primary" id="submit-answer" disabled>回答する</button>
          </div>
        </div>
      </div>`;

    document.getElementById('app').innerHTML = html;
    window.scrollTo(0, 0);

    // 選択肢のクリック処理
    let selected = null;
    const optionBtns = document.querySelectorAll('.option-btn');
    const submitBtn = document.getElementById('submit-answer');
    optionBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        optionBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selected = btn.getAttribute('data-value');
        submitBtn.disabled = false;
      });
    });

    submitBtn.addEventListener('click', function () {
      if (selected === null) return;
      stopTimer();
      recordAnswer(selected, false);
    });

    startTimer();
  }

  // 回答を記録し次へ
  function recordAnswer(rawSelected, timedOut) {
    const q = state.questions[state.index];
    let isCorrect = false;
    let selectedValue = null;

    if (!timedOut && rawSelected !== null) {
      if (q.type === 'truefalse') {
        selectedValue = (rawSelected === 'true');
        isCorrect = (selectedValue === q.correct);
      } else {
        selectedValue = parseInt(rawSelected, 10);
        isCorrect = (selectedValue === q.correct);
      }
    }

    state.answers.push({
      question: q,
      selected: selectedValue,
      correct: isCorrect,
      timedOut: timedOut
    });

    state.index += 1;
    if (state.index < state.questions.length) {
      renderQuestion();
    } else {
      finish();
    }
  }

  // 終了 → 採点 → progress 更新 → 結果描画
  function finish() {
    stopTimer();
    const score = state.answers.filter(a => a.correct).length;
    const passed = score >= PASS_THRESHOLD;
    const updated = Progress.recordResult(state.chapterId, score, passed);
    const justCleared = passed && updated.cleared && updated.passes === Progress.REQUIRED_PASSES;
    renderResult(score, passed, updated, justCleared);
  }

  // 解答文言の整形
  function answerText(q, value) {
    if (value === null || value === undefined) return '(無回答)';
    if (q.type === 'truefalse') return value ? '○ 正しい' : '✕ 誤り';
    return q.options[value];
  }
  function correctText(q) {
    if (q.type === 'truefalse') return q.correct ? '○ 正しい' : '✕ 誤り';
    return q.options[q.correct];
  }

  // 結果画面描画
  function renderResult(score, passed, prog, justCleared) {
    const total = state.questions.length;
    const pct = Math.round((score / total) * 100);

    const reviewHtml = state.answers.map(function (a, i) {
      const q = a.question;
      const cls = a.correct ? 'correct' : 'incorrect';
      const mark = a.correct ? '✅' : '❌';
      const yourCls = a.correct ? '' : 'wrong';
      const yourLabel = a.timedOut ? '(時間切れ)' : answerText(q, a.selected);
      let answerLine = `<div class="review-answer"><span class="lbl">あなたの回答: </span><span class="your-ans ${yourCls}">${Quiz._esc(yourLabel)}</span></div>`;
      if (!a.correct) {
        answerLine += `<div class="review-answer"><span class="lbl">正解: </span><span class="correct-ans">${Quiz._esc(correctText(q))}</span></div>`;
      }
      return `
        <div class="review-item ${cls}">
          <div class="review-head">
            <span class="review-mark">${mark}</span>
            <span class="review-q">${i + 1}. ${Quiz._esc(q.question)}</span>
          </div>
          ${answerLine}
          <div class="review-explanation"><span class="exp-lbl">解説: </span>${Quiz._esc(q.explanation)}</div>
        </div>`;
    }).join('');

    const verdictCls = passed ? 'pass' : 'fail';
    const verdictText = passed ? '合格！ この周をクリアしました' : '不合格 — もう一度挑戦しましょう';
    const verdictSub = passed
      ? `${PASS_THRESHOLD}問以上正解です。現在 ${prog.passes} / ${Progress.REQUIRED_PASSES} 周クリア`
      : `合格ラインは${PASS_THRESHOLD}問です。あと${Math.max(0, PASS_THRESHOLD - score)}問でした。`;

    let celebrationHtml = '';
    if (justCleared) {
      celebrationHtml = `
        <div class="celebration">
          <div class="cele-badge">🏆</div>
          <div class="cele-title">章クリア達成！</div>
          <div class="cele-text">全${Progress.REQUIRED_PASSES}周を達成しました。この章はマスターです。ゴールドバッジを獲得しました！</div>
        </div>`;
    }

    const html = `
      <div class="result">
        <div class="result-header">
          <div class="score-circle ${verdictCls}">
            <div class="score-main">${score}</div>
            <div class="score-total">/ ${total} 問正解</div>
            <div class="score-pct">${pct}%</div>
          </div>
          <div class="result-verdict ${verdictCls}">${verdictText}</div>
          <div class="result-sub">${verdictSub}</div>
        </div>
        ${celebrationHtml}
        <h2 style="font-size:1.3rem;font-weight:900;margin:1.5rem 0 0.5rem;">解答と解説</h2>
        <div class="review-list">${reviewHtml}</div>
        <div class="result-actions">
          <button class="btn btn-secondary" id="result-to-dashboard">ダッシュボードへ</button>
          ${prog.cleared
            ? '<button class="btn btn-primary" disabled>章クリア済み（再受験不可）</button>'
            : `<button class="btn btn-primary" id="result-retry">もう一度挑戦</button>`}
        </div>
      </div>`;

    document.getElementById('app').innerHTML = html;
    window.scrollTo(0, 0);
    App.refreshHeader();

    const dashBtn = document.getElementById('result-to-dashboard');
    if (dashBtn) dashBtn.addEventListener('click', () => App.showDashboard());
    const retryBtn = document.getElementById('result-retry');
    if (retryBtn) retryBtn.addEventListener('click', () => Quiz.start(state.chapterId));
  }

  // HTMLエスケープ（結果用に公開）
  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return { start, stopTimer, _esc, PASS_THRESHOLD, TIMER_SECONDS, TOTAL_QUESTIONS };
})();
