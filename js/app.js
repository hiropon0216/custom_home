/* ===== app.js =====
 * ビュー切り替え・ダッシュボード描画・教科書描画・ナビゲーション
 */
const App = (function () {
  let navHistory = [];   // ナビゲーション履歴

  function el(id) { return document.getElementById(id); }

  // ヘッダーの総合進捗を更新
  function refreshHeader() {
    const o = Progress.getOverall();
    el('overall-progress-text').textContent = `${o.clearedCount} / ${o.totalChapters} 章クリア`;
    el('overall-progress-fill').style.width = o.percent + '%';
  }

  // ===== ダッシュボード =====
  function showDashboard() {
    Quiz.stopTimer();
    navHistory = ['dashboard'];
    refreshHeader();

    const overall = Progress.getOverall();
    const cards = CHAPTERS.map(function (ch) {
      const p = Progress.getChapter(ch.id);
      const dots = [];
      for (let i = 0; i < Progress.REQUIRED_PASSES; i++) {
        dots.push(`<span class="pass-dot ${i < p.passes ? 'filled' : ''}"></span>`);
      }
      const badge = p.cleared ? '<span class="cleared-badge">🏆 クリア</span>' : '';
      const best = p.attempts > 0 ? `<div class="best-score">最高スコア ${p.bestScore}/20 ・ 挑戦${p.attempts}回</div>` : '';
      return `
        <div class="chapter-card ${p.cleared ? 'cleared' : ''}" data-chapter="${ch.id}">
          <div class="chapter-card-top">
            <span class="chapter-num">第 ${ch.number} 章</span>
            ${badge}
          </div>
          <h3>${ch.title}</h3>
          <div class="chapter-progress">
            <div class="pass-dots">${dots.join('')}</div>
            <span class="pass-label">${p.passes} / ${Progress.REQUIRED_PASSES} 周</span>
          </div>
          ${best}
        </div>`;
    }).join('');

    el('app').innerHTML = `
      <div class="dashboard">
        <div class="dashboard-intro">
          <h2>家づくりの教科書へようこそ</h2>
          <p>全17章・各章20問のクイズで、注文住宅の知識を体系的にマスターしましょう。各章は18問以上正解で1周クリア、4周クリアで章マスターです。</p>
        </div>
        <div class="stats-row">
          <div class="stat-card"><div class="stat-num">${overall.clearedCount}</div><div class="stat-label">クリア章数 / 17</div></div>
          <div class="stat-card"><div class="stat-num">${overall.totalPasses}</div><div class="stat-label">累計クリア周回</div></div>
          <div class="stat-card"><div class="stat-num">${overall.percent}%</div><div class="stat-label">総合達成率</div></div>
        </div>
        <div class="chapter-grid">${cards}</div>
      </div>`;
    window.scrollTo(0, 0);

    document.querySelectorAll('.chapter-card').forEach(function (card) {
      card.addEventListener('click', function () {
        showChapter(card.getAttribute('data-chapter'));
      });
    });
  }

  // ===== 教科書ビュー =====
  function showChapter(chapterId) {
    Quiz.stopTimer();
    navHistory.push('chapter:' + chapterId);
    const ch = CHAPTERS.find(c => c.id === chapterId);
    if (!ch) { showDashboard(); return; }
    const p = Progress.getChapter(chapterId);

    const quizBtnLabel = p.cleared ? 'この章はクリア済み（再受験不可）' : '問題集へ進む';

    el('app').innerHTML = `
      <div class="reader">
        <div class="reader-nav">
          <button class="btn btn-secondary" id="back-to-dashboard">← ダッシュボードへ戻る</button>
        </div>
        <div class="reader-content">
          ${ch.content}
          <div class="reader-footer">
            <button class="btn btn-primary" id="go-to-quiz" ${p.cleared ? 'disabled' : ''}>${quizBtnLabel}</button>
          </div>
        </div>
      </div>`;
    window.scrollTo(0, 0);

    el('back-to-dashboard').addEventListener('click', showDashboard);
    const quizBtn = el('go-to-quiz');
    if (quizBtn && !p.cleared) {
      quizBtn.addEventListener('click', () => showQuiz(chapterId));
    }
  }

  // ===== クイズビュー =====
  function showQuiz(chapterId) {
    navHistory.push('quiz:' + chapterId);
    Quiz.start(chapterId);
  }

  // 初期化
  function init() {
    el('home-link').addEventListener('click', showDashboard);
    showDashboard();
    // ローディング画面を消す
    setTimeout(function () {
      const ls = el('loading-screen');
      if (ls) ls.classList.add('hidden');
    }, 600);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { showDashboard, showChapter, showQuiz, refreshHeader };
})();
