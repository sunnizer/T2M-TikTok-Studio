'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { collectMetrics } = require('./metrics');

const { parseVideoLinks,cleanFileName,blockedText,sleep } = require('./utils');

class TikTokProcessor {
  constructor({profileDir, screenshotDir, stateFile, emit}) {
    Object.assign(this, {profileDir, screenshotDir, stateFile, emit});
    this.context = null; this.page = null; this.running = false; this.cancelled = false;
  }
  async chrome() {
    if (this.context) return this.context;
    try {
      await fs.mkdir(this.profileDir, {recursive:true});
      this.context = await chromium.launchPersistentContext(this.profileDir, {
        channel: 'chrome', headless: false, viewport: {width: 1390, height: 900},
        acceptDownloads: false, timeout: 30000
      });
      this.context.on('close',()=> { this.context = null; this.page = null; });
      this.page = this.context.pages()[0] || await this.context.newPage();
      return this.context;
    } catch (e) {
      this.context = null; this.page = null;
      throw new Error('Không mở được Chrome. Hãy cài Chrome chính thức và đóng cửa sổ Chrome T2M khác. Chi tiết: ' + e.message);
    }
  }
  async openChrome() {
    await this.chrome();
    if (!this.page || this.page.isClosed()) this.page = await this.context.newPage();
    await this.page.goto('https://www.tiktok.com/', {waitUntil:'domcontentloaded',timeout:45000});
    this.emit('status', {message:'Chrome riêng đã mở. Đăng nhập TikTok thủ công nếu cần.'});
    return {ok:true};
  }
  async writeState(obj) {
    await fs.mkdir(path.dirname(this.stateFile),{recursive:true});
    const temp = this.stateFile + '.tmp';
    await fs.writeFile(temp,JSON.stringify(obj,null,2),'utf8');
    await fs.rename(temp,this.stateFile);
  }
  async readState() {
    try {return JSON.parse(await fs.readFile(this.stateFile,'utf8'));} catch {return null;}
  }
  stop() { this.cancelled = true; this.emit('status',{message:'Đã yêu cầu dừng. Sẽ dừng sau bước đang xử lý.'}); }
  async process(options) {
    if (this.running) throw new Error('Có Batch đang chạy. Hãy dừng Batch hiện tại trước.');
    const items = parseVideoLinks(options.rawInput);
    const mode = options.mode === 'profile' ? 'profile' : 'engagement';
    const waitMs = Number(options.waitMs);
    if (![1200,2000,3500].includes(waitMs)) throw new Error('Thời gian chờ không hợp lệ.');
    this.running = true; this.cancelled = false;
    const previous = options.resume ? await this.readState() : null;
    const completed = previous && previous.mode === mode ? previous.results || [] : [];
    const known = new Set(completed.filter(x=>x.status==='SAVED').map(x=>x.id));
    const results = items.filter(x=>known.has(x.id)).map(x=>completed.find(r=>r.id===x.id));
    const state = { mode, items, results, savedAt:new Date().toISOString(), running:true };
    const notify = (message) => this.emit('progress',{message,done:results.length,total:items.length,results});
    try {
      await fs.mkdir(this.screenshotDir,{recursive:true});
      await this.chrome();
      notify('Bắt đầu xử lý ' + items.length + ' video.');
      for (const item of items) {
        if (this.cancelled) break;
        if (known.has(item.id)) continue;
        let record;
        try { record = await this.captureOne(item,mode,waitMs); }
        catch(e) {
          if (e.code === 'TIKTOK_ACCESS_RESTRICTED') {
            record = {id:item.id,username:item.username,status:'BLOCKED',error:e.message};
            results.push(record); notify('TikTok yêu cầu xác minh hoặc giới hạn truy cập. Batch tạm dừng.');
            this.cancelled = true;
          } else record = {id:item.id,username:item.username,status:'ERROR',error:e.message};
        }
        if (!results.some(r=>r===record)) results.push(record);
        state.results=results; state.running=!this.cancelled; state.savedAt=new Date().toISOString();
        await this.writeState(state);
        notify(`${record.status}: @${item.username} • ${item.id}`);
      }
      return {done:results.length,total:items.length,stopped:this.cancelled,results};
    } finally {
      state.running=false; state.results=results; state.savedAt=new Date().toISOString();
      await this.writeState(state);
      this.running=false;
      notify(this.cancelled?'Batch đã dừng; có thể tiếp tục ở lần sau.':'Batch hoàn tất.');
    }
  }
  async captureOne(item,mode,waitMs) {
    const page=this.page;
    const dst = path.join(this.screenshotDir,cleanFileName(`${item.username}_${item.id}_${mode}`)+'.png');
    if (mode === 'profile') {
      await page.goto(`https://www.tiktok.com/@${item.username}`,{waitUntil:'domcontentloaded',timeout:45000});
      await sleep(waitMs);
      await this.assertUnblocked(page);
      const card = page.locator(`a[href*="/video/${item.id}"]`).first();
      let found=false;
      for(let j=0;j<24 && !this.cancelled;j++) {
        if(await card.count()) { found=true;break; }
        await page.evaluate(()=>window.scrollBy(0,Math.max(500,innerHeight*0.75)));
        await sleep(650);
      }
      if(!found)throw new Error('Không tìm thấy thumbnail trên Profile. Hãy thử chế độ mở Video.');
      await card.scrollIntoViewIfNeeded({timeout:10000});
      await sleep(400);
      await page.screenshot({path:dst,animations:'disabled',timeout:15000});
      return {id:item.id,username:item.username,url:item.url,status:'SAVED',file:dst,mode,metrics:{}};
    }
    await page.goto(item.url,{waitUntil:'domcontentloaded',timeout:45000});
    await sleep(waitMs);
    await this.assertUnblocked(page);
    try { await page.locator('video').first().waitFor({state:'attached',timeout:12000}); }
    catch {throw new Error('Video không xuất hiện. Có thể link bị hạn chế, cần đăng nhập hoặc giao diện đã thay đổi.');}
    const displayedUrl=new URL(page.url());
    if(!displayedUrl.pathname.includes(`/video/${item.id}`))
      throw new Error('TikTok đã điều hướng khỏi video yêu cầu. Không chụp để tránh nhầm ID.');
    const metrics=await page.evaluate(collectMetrics,item.id);
    // Clear prior T2M overlay and add a visibly labeled, non-native measurement panel.
    await page.evaluate(({metrics,id})=>{
      document.getElementById('t2m-studio-evidence')?.remove();
      const box=document.createElement('div');box.id='t2m-studio-evidence';
      box.setAttribute('style','position:fixed;top:14px;right:14px;z-index:2147483647;max-width:370px;padding:12px 16px;border:1px solid #c8e8ec;border-radius:12px;background:#0b1722ee;color:#fff;font:600 13px system-ui;box-shadow:0 8px 28px #0008;pointer-events:none');
      const title=document.createElement('div'); title.textContent='T2M EVIDENCE OVERLAY • số liệu đọc từ trang TikTok';
      title.style='color:#91e3e4;font-size:10px;letter-spacing:.03em;margin-bottom:5px';box.append(title);
      for(const [key,label] of [['views','Views'],['likes','Likes'],['comments','Comments'],['shares','Shares']]) {
        const line=document.createElement('div');line.textContent=label+': '+(metrics[key]??'Chưa xác minh');box.append(line);
      }
      const foot=document.createElement('div');foot.style='font-size:10px;color:#aaa;margin-top:6px';
      foot.textContent='ID: '+id+'  • '+new Date().toLocaleString('vi-VN');box.append(foot);
      document.body.append(box);
    },{metrics,id:item.id});
    await sleep(200);
    await page.screenshot({path:dst,animations:'disabled',timeout:15000});
    const evidencePath=dst.replace(/\.png$/i,'.json');
    await fs.writeFile(evidencePath, JSON.stringify({url:item.url,videoId:item.id,capturedAt:new Date().toISOString(),metrics,notice:'Overlay do T2M tạo, không phải chỉ số hiển thị gốc của TikTok. Chỉ số vắng mặt không được suy diễn.'},null,2));
    return {id:item.id,username:item.username,url:item.url,status:'SAVED',file:dst,metrics,mode};
  }
  async assertUnblocked(page) {
    const text=await page.locator('body').innerText({timeout:10000}).catch(()=> '');
    if(blockedText(text.slice(0,8000))) {
      const error=new Error('TikTok hiện CAPTCHA/xác minh hoặc giới hạn truy cập. Vui lòng xử lý thủ công trong Chrome rồi mới tiếp tục.');
      error.code='TIKTOK_ACCESS_RESTRICTED'; throw error;
    }
  }
  async shutdown() {
    this.cancelled=true;
    if(this.context){ await this.context.close().catch(()=>{}); }
  }
}
module.exports={TikTokProcessor,parseVideoLinks,cleanFileName,blockedText};
