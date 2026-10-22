'use strict';
const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');

class StudioUpdater {
  constructor(send) {
    this.send=send; this.downloaded=false; this.ready=false;
    const configPath=path.join(__dirname,'update-config.json');
    const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
    const baseUrl=String(config.updateBaseUrl || '').replace(/\/$/,'');
    // Update endpoint is controlled by the T2M deployment, not user-supplied links.
    if(!app.isPackaged || !baseUrl || !baseUrl.startsWith('https://')) {
      this.send({state:'not-configured',message:app.isPackaged?'Chưa có máy chủ Update. Sẽ cấu hình khi phát hành bản cài chính thức.':'Chế độ phát triển: cập nhật chỉ hoạt động ở bản đã đóng gói.'});
      return;
    }
    autoUpdater.autoDownload=false;
    autoUpdater.autoInstallOnAppQuit=false;
    autoUpdater.setFeedURL({provider:'generic',url:baseUrl});
    this.ready=true;
    autoUpdater.on('checking-for-update',()=>this.send({state:'checking',message:'Đang kiểm tra phiên bản mới…'}));
    autoUpdater.on('update-available',x=>this.send({state:'available',version:x.version,message:'Có bản mới v'+x.version+'. Nhấn Download Update.'}));
    autoUpdater.on('update-not-available',()=>this.send({state:'current',message:'Bạn đang dùng phiên bản mới nhất.'}));
    autoUpdater.on('download-progress',x=>this.send({state:'downloading',progress:Math.round(x.percent),message:'Đang tải: '+Math.round(x.percent)+'%'}));
    autoUpdater.on('update-downloaded',x=>{this.downloaded=true;this.send({state:'downloaded',version:x.version,message:'Đã tải bản '+x.version+'. Nhấn Install & Restart.'});});
    autoUpdater.on('error',e=>this.send({state:'error',message:'Lỗi cập nhật: '+e.message}));
    // Application checks on startup, but only after the publishing endpoint is configured.
    setTimeout(()=>this.check().catch(()=>{}),3500);
  }
  async check() {
    if(!this.ready) return {ok:false,error:'Chưa thiết lập máy chủ Update. Bản MVP chưa có bản cài chính thức.'};
    try {await autoUpdater.checkForUpdates();return {ok:true};}
    catch(e){return {ok:false,error:e.message};}
  }
  async download() {
    if(!this.ready)return {ok:false,error:'Chưa thiết lập máy chủ Update.'};
    try {await autoUpdater.downloadUpdate();return {ok:true};}
    catch(e){return {ok:false,error:e.message};}
  }
  install() {
    if(!this.downloaded)return {ok:false,error:'Chưa tải xong bản cập nhật.'};
    setImmediate(()=>autoUpdater.quitAndInstall(false,true));
    return {ok:true};
  }
}
module.exports={StudioUpdater};
