'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const events=new Set(['studio:progress','studio:status','studio:complete','studio:failure','studio:update']);
contextBridge.exposeInMainWorld('studio',{
  info:()=>ipcRenderer.invoke('studio:get-info'),
  chrome:()=>ipcRenderer.invoke('studio:open-chrome'),
  start:x=>ipcRenderer.invoke('studio:start',x),
  stop:()=>ipcRenderer.invoke('studio:stop'),
  openFolder:()=>ipcRenderer.invoke('studio:open-folder'),
  checkUpdate:()=>ipcRenderer.invoke('studio:check-update'),
  downloadUpdate:()=>ipcRenderer.invoke('studio:download-update'),
  installUpdate:()=>ipcRenderer.invoke('studio:install-update'),
  on:(channel,callback)=>{
    if(!events.has(channel)||typeof callback!=='function')return ()=>{};
    const handler=(_e,data)=>callback(data);
    ipcRenderer.on(channel,handler);
    return ()=>ipcRenderer.removeListener(channel,handler);
  }
});
