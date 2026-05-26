/* ===== progress.js =====
 * LocalStorage への進捗の読み書き・集計を担当
 */
const Progress = (function () {
  const STORAGE_KEY = 'custom_home_progress';
  const REQUIRED_PASSES = 4;   // 4周クリアで章クリア
  const TOTAL_CHAPTERS = 17;

  // 全進捗を取得
  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('進捗の読み込みに失敗しました', e);
      return {};
    }
  }

  // 全進捗を保存
  function saveAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('進捗の保存に失敗しました', e);
    }
  }

  // 特定章の進捗を取得（無ければ初期値）
  function getChapter(chapterId) {
    const all = loadAll();
    return all[chapterId] || { passes: 0, cleared: false, attempts: 0, bestScore: 0 };
  }

  // クイズ結果を反映
  // score: 今回の正解数 / passed: 18問以上正解で true
  function recordResult(chapterId, score, passed) {
    const all = loadAll();
    const cur = all[chapterId] || { passes: 0, cleared: false, attempts: 0, bestScore: 0 };

    cur.attempts += 1;
    if (score > cur.bestScore) cur.bestScore = score;

    // 既にクリア済みの場合は周回数を増やさない（再受験不可）
    if (!cur.cleared && passed) {
      cur.passes += 1;
      if (cur.passes >= REQUIRED_PASSES) {
        cur.cleared = true;
      }
    }

    all[chapterId] = cur;
    saveAll(all);
    return cur;
  }

  // 章がクリア済みか
  function isCleared(chapterId) {
    return getChapter(chapterId).cleared === true;
  }

  // 全体集計
  function getOverall() {
    const all = loadAll();
    let clearedCount = 0;
    let totalPasses = 0;
    for (let i = 1; i <= TOTAL_CHAPTERS; i++) {
      const c = all['chapter_' + i];
      if (c) {
        if (c.cleared) clearedCount++;
        totalPasses += c.passes || 0;
      }
    }
    return {
      clearedCount: clearedCount,
      totalChapters: TOTAL_CHAPTERS,
      totalPasses: totalPasses,
      percent: Math.round((clearedCount / TOTAL_CHAPTERS) * 100)
    };
  }

  return {
    REQUIRED_PASSES,
    TOTAL_CHAPTERS,
    getChapter,
    recordResult,
    isCleared,
    getOverall
  };
})();
