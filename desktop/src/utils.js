'use strict';
function parseVideoLinks(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!lines.length || lines.length > 200) throw new Error('Nhập từ 1 đến 200 link video TikTok, mỗi dòng một link.');
  const result = [], seen = new Set();
  for (const line of lines) {
    let url;
    try { url = new URL(line); } catch { throw new Error('Link không hợp lệ: ' + line.slice(0, 90)); }
    if (url.protocol !== 'https:' || !['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(url.hostname))
      throw new Error('Chỉ chấp nhận URL TikTok HTTPS đầy đủ.');
    const match = url.pathname.match(/^\/@([^/]+)\/video\/(\d{8,})\/?$/);
    if (!match) throw new Error('Link phải có dạng https://www.tiktok.com/@user/video/ID');
    const [, username, id] = match;
    if (!seen.has(id)) {
      seen.add(id);
      result.push({ id, username, url: `https://www.tiktok.com/@${username}/video/${id}` });
    }
  }
  return result;
}
function cleanFileName(str) { return String(str).replace(/[^\w.\-]/g,'_').slice(0, 110); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function blockedText(text) {
  return /verify to continue|captcha|too many requests|access denied|unusual activity|xác minh|truy cập quá nhiều|verify you are human/i.test(text);
}

module.exports={parseVideoLinks,cleanFileName,blockedText,sleep};
