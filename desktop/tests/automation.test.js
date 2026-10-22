'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {parseVideoLinks,cleanFileName,blockedText}=require('../src/utils');
test('parses and deduplicates TikTok video URLs',()=>{
 const rows=parseVideoLinks('https://www.tiktok.com/@abc/video/7690884460325293332\nhttps://www.tiktok.com/@abc/video/7690884460325293332?is_from_webapp=1');
 assert.equal(rows.length,1); assert.equal(rows[0].id,'7690884460325293332');
});
test('blocks wrong site and malformed video URL',()=>{
 assert.throws(()=>parseVideoLinks('https://www.evil.com/@user/video/7690884460325293332'));
 assert.throws(()=>parseVideoLinks('https://www.tiktok.com/@user/photo/7690884460325293332'));
});
test('sanitizes filename',()=>{assert.equal(cleanFileName('a/b\\c:*'), 'a_b_c__');});
test('detects TikTok challenge',()=>{assert.equal(blockedText('Please verify to continue'),true);});
