'use strict';
const path = require('node:path');
const {app,BrowserWindow,ipcMain,shell} = require('electron');
const {TikTokProcessor} = require('./automation');
const {StudioUpdater} = require('./updates');

let win,processor,updater;
function send(type, data) { if(win && !win.isDestroyed())win.webContents.send(type,data); }
function assertAppSender(event) { if(!win || event.sender!==win.webContents) throw new Error('Không được phép gọi từ cửa sổ này.'); }

function init() {
  const userDir=app.getPath('userData');
  const screenshotDir=path.join(app.getPath('documents'),'T2M TikTok Studio','Screenshots');
  processor=new TikTokProcessor({
    profileDir:path.join(userDir,'chrome-tiktok-profile'),
    screenshotDir,stateFile:path.join(userDir,'batch-state.json'),
    emit:(kind,data)=>send('studio:'+kind,data)
  });
  win=new BrowserWindow({width:1050,height:830,minWidth:850,minHeight:650,
    title:`T2M TikTok Studio v${app.getVersion()}`,
    icon:path.join(__dirname,'../assets/icon128.png'),
    show:false,
    webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true}
  });
  win.loadFile(path.join(__dirname,'index.html'));
  win.once('ready-to-show',()=>win.show());
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event)=>event.preventDefault());
  updater=new StudioUpdater(x=>send('studio:update',x));
  ipcMain.handle('studio:get-info',async event=>{
    assertAppSender(event);
    return {version:app.getVersion(),screenshotDir,job:await processor.readState(),packaged:app.isPackaged};
  });
  ipcMain.handle('studio:open-chrome',async event=>{assertAppSender(event);return processor.openChrome();});
  ipcMain.handle('studio:start',async (event,params)=>{
    assertAppSender(event);
    if(!params || typeof params.rawInput!=='string'||params.rawInput.length>65000)return {ok:false,error:'Danh sách video không hợp lệ.'};
    if(processor.running)return {ok:false,error:'Có Batch đang chạy.'};
    // Run without blocking renderer IPC: progress comes through events.
    setImmediate(()=>processor.process(params).then(result=>send('studio:complete',result)).catch(e=>send('studio:failure',{message:e.message})));
    return {ok:true};
  });
  ipcMain.handle('studio:stop',event=>{assertAppSender(event);processor.stop();return {ok:true};});
  ipcMain.handle('studio:open-folder',async event=>{
    assertAppSender(event);
    const fs=require('node:fs/promises');await fs.mkdir(screenshotDir,{recursive:true});
    const e=await shell.openPath(screenshotDir);return e?{ok:false,error:e}:{ok:true};
  });
  ipcMain.handle('studio:check-update',async event=>{assertAppSender(event);return updater.check();});
  ipcMain.handle('studio:download-update',async event=>{assertAppSender(event);return updater.download();});
  ipcMain.handle('studio:install-update',event=>{assertAppSender(event);return updater.install();});
}
app.whenReady().then(init);
app.on('window-all-closed',()=>{app.quit();});
app.on('before-quit',()=>{if(processor)processor.stop();});
