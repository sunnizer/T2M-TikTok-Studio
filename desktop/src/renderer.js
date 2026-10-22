'use strict';
const $=id=>document.getElementById(id);
const studio=window.studio;
let running=false, updateState='';
function status(msg){$('status').textContent=msg;}
function showProgress(data){
  const done=Number(data.done||0),total=Number(data.total||0);
  $('counter').textContent=`${done} / ${total}`;
  $('bar').style.width=(total?Math.min(100,Math.round(100*done/total)):0)+'%';
  status(data.message||'');
  $('results').replaceChildren();
  for(const r of (data.results||[]).slice(-150)) {
    const row=document.createElement('div');row.className='result'+(r.status!=='SAVED'?' error':'');
    const strong=document.createElement('strong');strong.textContent=r.status+' • @'+r.username+' • '+r.id;
    const detail=document.createElement('small');detail.textContent=r.error||r.file||'';
    row.append(strong,detail);$('results').append(row);
  }
}
function setRunning(v){running=v;$('startBtn').disabled=v;$('stopBtn').disabled=!v;}
function errorText(x){return x?.error||x?.message||'Có lỗi không xác định.';}
async function safeCall(fn) {try{const r=await fn();if(r?.ok===false) status(errorText(r));return r;}catch(e){status(e.message);return {ok:false};}}
$('chromeBtn').onclick=()=>safeCall(()=>studio.chrome());
$('folderBtn').onclick=()=>safeCall(()=>studio.openFolder());
$('stopBtn').onclick=()=>safeCall(()=>studio.stop());
$('startBtn').onclick=async()=>{
  if(running)return;
  const params={rawInput:$('links').value,mode:document.querySelector('input[name=mode]:checked').value,waitMs:Number($('wait').value),resume:$('resume').checked};
  const response=await safeCall(()=>studio.start(params));
  if(response?.ok)setRunning(true);
};
$('checkBtn').onclick=()=>safeCall(()=>studio.checkUpdate());
$('downloadBtn').onclick=()=>safeCall(()=>studio.downloadUpdate());
$('installBtn').onclick=()=>safeCall(()=>studio.installUpdate());
studio.on('studio:progress',showProgress);
studio.on('studio:status',x=>status(x.message));
studio.on('studio:complete',x=>{setRunning(false);showProgress({message:x.stopped?'Đã dừng. Dùng Resume để tiếp tục.':'Hoàn thành Batch.',done:x.done,total:x.total,results:x.results});});
studio.on('studio:failure',x=>{setRunning(false);status('Lỗi: '+x.message);});
studio.on('studio:update',x=>{
  updateState=x.state;
  $('updateTitle').textContent=x.state==='available'?'Đã có bản '+x.version:x.state==='downloaded'?'Sẵn sàng cài đặt':x.state==='current'?'Đã là phiên bản mới nhất':'Software Update';
  $('updateDescription').textContent=x.message;
  $('downloadBtn').hidden=x.state!=='available';
  $('installBtn').hidden=x.state!=='downloaded';
});
studio.info().then(info=>{
  $('version').textContent='v'+info.version;
  if(info.job?.results?.length)showProgress({message:'Đã khôi phục kết quả Batch gần nhất. Để tiếp tục, dán cùng danh sách link.',done:info.job.results.length,total:info.job.items?.length,results:info.job.results});
}).catch(e=>status(e.message));
