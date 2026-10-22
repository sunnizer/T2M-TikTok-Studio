'use strict';

// Extract data from the currently rendered public TikTok page only. Missing = null;
// never synthesize engagement metrics or claim that incomplete evidence is verified.
function collectMetrics(videoId) {
  const selectors = {
    views: ['[data-e2e="browse-video-count"]', '[data-e2e="video-views"]', '[data-e2e="video-view-count"]', '[data-e2e="browse-video-views"]'],
    likes: ['[data-e2e="browse-like-count"]', '[data-e2e="like-count"]', '[data-e2e="video-like-count"]'],
    comments: ['[data-e2e="browse-comment-count"]', '[data-e2e="comment-count"]', '[data-e2e="video-comment-count"]'],
    shares: ['[data-e2e="share-count"]', '[data-e2e="browse-share-count"]', '[data-e2e="video-share-count"]']
  };
  const output = { videoId, views: null, likes: null, comments: null, shares: null, sources: {} };
  for (const [key, options] of Object.entries(selectors)) {
    for (const css of options) {
      const el = document.querySelector(css);
      if (el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0) {
        const text = (el.textContent || el.getAttribute('title') || '').trim();
        if (text && /^\d[\d.,KMBkmb\s]*$/.test(text)) {
          output[key] = text;
          output.sources[key] = 'visible DOM ' + css;
          break;
        }
      }
    }
  }
  if (output.views === null) {
    const ids = ['__UNIVERSAL_DATA_FOR_REHYDRATION__', 'SIGI_STATE'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el?.textContent) continue;
      try {
        const data = JSON.parse(el.textContent);
        const seen = new WeakSet();
        let visited = 0;
        function find(node, depth) {
          if (visited++ > 60000 || depth > 14 || !node || typeof node !== 'object' || seen.has(node)) return null;
          seen.add(node);
          if ((String(node.id || node.videoId || node.aweme_id || '') === String(videoId)) &&
              (node.stats?.playCount !== undefined || node.statistics?.playCount !== undefined)) {
            return node.stats?.playCount ?? node.statistics?.playCount;
          }
          for (const v of Object.values(node)) {
            const r = find(v, depth + 1);
            if (r !== null) return r;
          }
          return null;
        }
        const v = find(data, 0);
        if (v !== null && /^\d+$/.test(String(v))) {
          output.views = String(v);
          output.sources.views = 'page embedded JSON ' + id;
          break;
        }
      } catch (_) { /* TikTok can change embedded page format */ }
    }
  }
  return output;
}

module.exports = { collectMetrics };
