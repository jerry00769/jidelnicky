/* Strava.cz 5948 – complete weeks only, transactional import. */
(()=>{'use strict';
const style=document.createElement('style');style.textContent=`
#stravaSmart:not([open]){display:none!important}
#stravaSmart[open]{display:flex;flex-direction:column;overflow:hidden;margin:auto;position:fixed;inset:0;box-sizing:border-box;width:min(900px,calc(100vw - 20px));max-height:calc(100dvh - 24px);border:1px solid #d8e0e8;border-radius:16px;padding:0;color:#172d42;background:#fff;box-shadow:0 20px 70px #0004}
#stravaSmart *{box-sizing:border-box}#stravaSmart::backdrop{background:#101e2d99}
#stravaSmart .ss-head{padding:17px 20px 12px;border-bottom:1px solid #e4eaf0}#stravaSmart h2{margin:0 0 6px;font-size:21px}#stravaSmart p{margin:6px 0;line-height:1.45}
#stravaSmart .ss-body{padding:12px 20px;overflow-y:auto;min-height:0;flex:1 1 auto;overscroll-behavior:contain}#stravaSmart .ss-foot{display:flex;gap:9px;flex-wrap:wrap;flex:0 0 auto;padding:13px 20px;border-top:1px solid #e4eaf0;background:white}
#stravaSmart button{font:inherit;border-radius:9px;border:1px solid #c9d4df;background:white;color:#172d42;padding:9px 13px;cursor:pointer}#stravaSmart button.ss-primary{background:#1764a2;color:white;border-color:#1764a2}#stravaSmart button:disabled{opacity:.5;cursor:not-allowed}
#stravaSmart .ss-week{border:1px solid #e0e6ec;border-radius:12px;margin:11px 0;padding:12px}#stravaSmart .ss-week h3{margin:0 0 9px;font-size:17px}#stravaSmart .ss-day{border-top:1px solid #e8edf2;padding:10px 0}#stravaSmart .ss-line{display:grid;grid-template-columns:95px minmax(0,1fr) auto;gap:8px;align-items:start;margin:5px 0;font-size:14px}
#stravaSmart .ss-line strong{overflow-wrap:anywhere;font-weight:550}#stravaSmart .ss-pill{font-size:11px;border-radius:30px;padding:3px 7px;background:#e7f4ed;color:#21613f;white-space:nowrap}#stravaSmart .ss-pill.ss-warn{background:#fff1d7;color:#8c5200}
#stravaSmart .ss-issue{border:1px solid #efd39c;border-radius:10px;background:#fffdf8;padding:12px;margin:10px 0}#stravaSmart .ss-issue h4{margin:0 0 5px;font-size:15px}#stravaSmart .ss-choice{display:block;margin:6px 0;padding:8px;border:1px solid #e0e5ea;border-radius:8px;cursor:pointer}#stravaSmart .ss-choice input{margin-right:7px}#stravaSmart .ss-search{width:100%;max-width:440px;padding:9px;border:1px solid #bbc8d4;border-radius:8px;font:inherit}#stravaSmart .ss-muted{color:#617386;font-size:13px}#stravaSmart details{margin-top:9px}#stravaSmart summary{cursor:pointer;color:#1764a2}#stravaSmart .ss-hits{max-height:190px;overflow:auto}#stravaSmart select{max-width:100%;padding:8px;border:1px solid #bbc8d4;border-radius:8px}#stravaSmart .ss-error{color:#a12b2b}
@media(max-width:580px){#stravaSmart .ss-head{padding:13px}#stravaSmart .ss-body{padding:8px 12px}#stravaSmart .ss-foot{padding:10px 12px}#stravaSmart .ss-line{grid-template-columns:70px minmax(0,1fr);gap:5px}#stravaSmart .ss-pill{grid-column:2;justify-self:start}#stravaSmart h2{font-size:18px}#stravaSmart .ss-foot button{flex:1 1 auto;padding:8px 10px}#stravaSmart .ss-foot{gap:5px;padding:7px 12px}#stravaSmart .ss-head{flex:0 0 auto}#stravaSmart{max-height:calc(100dvh - 16px)}}
/* Indikatory na mobilu na jednom radku: GitHub vlevo, Strava vpravo. */
#stravaToggle{position:fixed;right:12px;bottom:12px;z-index:1900;box-sizing:border-box;display:block;width:max-content;max-width:calc(50vw - 18px);min-height:0;margin:0;padding:7px 10px;border:1px solid #c8d4e0;border-radius:7px;background:#fff;color:#173d60;box-shadow:0 2px 8px #0004;font:500 11px/1.2 Arial,sans-serif;text-align:center;overflow-wrap:anywhere;cursor:pointer}#stravaToggle[data-off="true"]{color:#66717c;background:#f4f5f6}#stravaToggle:focus-visible{outline:3px solid #1764a2;outline-offset:2px}
@media(max-width:650px){
 #githubIndicator.github-indicator{left:8px!important;right:auto!important;bottom:8px!important;max-width:calc(50vw - 14px)!important;box-sizing:border-box!important;padding:7px 8px!important;font-size:clamp(9px,2.4vw,11px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;overflow-wrap:normal!important}
 #stravaToggle{left:auto!important;right:8px!important;bottom:8px!important;max-width:calc(50vw - 14px)!important;box-sizing:border-box!important;padding:7px 8px!important;font-size:clamp(9px,2.4vw,11px)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;overflow-wrap:normal!important}
}

`;document.head.append(style);
const Data=window.JidelnickyData,$=id=>document.getElementById(id);
const PREF=window.JIDELNICKY_CONFIG?.preferenceKey||'jidelnicky2:strava-auto-check-enabled';
let enabled=true;try{enabled=localStorage.getItem(PREF)!=='false'}catch{}
let sourceWeeks=[],issues=[],lastSummary='',checking=false,controller=null,lastCheck=0,openAfterCheck=false,sourceInfo='';
const dlg=document.createElement('dialog');dlg.id='stravaSmart';dlg.setAttribute('aria-labelledby','ssTitle');
dlg.innerHTML='<div class="ss-head"><h2 id="ssTitle">Kontrola Strava.cz</h2><p id="ssInfo"></p><label><input id="ssAuto" type="checkbox"> Automatická kontrola po otevření</label></div><div id="ssBody" class="ss-body"></div><div class="ss-foot"><button id="ssClose" type="button">Zavřít</button></div>';
document.body.append(dlg);
const toggle=document.createElement('button');toggle.id='stravaToggle';toggle.type='button';toggle.title='Otevřít kontrolu Strava.cz a nastavení automatiky';document.body.append(toggle);
function refreshToggle(){toggle.textContent=enabled?'Strava.cz: zapnuto '+(checking?'…':toggle.dataset.error==='true'?'⚠':'✓'):'Strava.cz: vypnuto';toggle.dataset.off=String(!enabled);$('ssAuto').checked=enabled}
function close(){dlg.close()}
$('ssClose').onclick=close;
dlg.addEventListener('click',e=>{if(e.target!==dlg)return;const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()});
$('ssAuto').onchange=()=>{
 enabled=$('ssAuto').checked;try{localStorage.setItem(PREF,String(enabled))}catch{}
 refreshToggle();if(!enabled){controller?.abort();lastSummary='Automatika je vypnutá. Uložená data zůstávají zachována.';showPreview()}
 else{close();check(true)}
};
refreshToggle();
function report(message,error=false){
 toggle.dataset.error=String(error);toggle.style.borderColor=error?'#d79034':'';
 refreshToggle();toggle.title=message||'Otevřít kontrolu Strava.cz';
 window.dispatchEvent(new CustomEvent('jidelnicky:strava-status',{detail:{text:message,kind:error?'error':'ok'}}));
}
function showPreview(){
 $('ssInfo').textContent=sourceInfo||'Jídelna 5948 · ZŠ a MŠ Březová Děčín';
 const body=$('ssBody');body.replaceChildren();
 for(const w of [...sourceWeeks].sort((a,b)=>b.week.localeCompare(a.week)).slice(0,2)){
  const sec=document.createElement('section');sec.className='ss-week';
  const h=document.createElement('h3');h.textContent='Týden od '+new Date(w.week+'T12:00:00').toLocaleDateString('cs-CZ');sec.append(h);
  w.days.forEach((d,i)=>{
   const box=document.createElement('div');box.className='ss-day';const title=document.createElement('strong');title.textContent=['Pondělí','Úterý','Středa','Čtvrtek','Pátek'][i];box.append(title);
   for(const [f,label] of [['soup','Polévka'],['main','Oběd 1'],['main2','Oběd 2']])if(d[f]){const line=document.createElement('p');line.textContent=(Data.organization(d[f])||(f==='soup'&&/^Polévka\s/i.test(d[f]))?'':label+': ')+d[f];box.append(line)}
   if(d.closed&&!Data.organization(d.soup)){const line=document.createElement('p');line.textContent='Nevaří se';box.append(line)}
   sec.append(box);
  });body.append(sec);
 }
 if(!sourceWeeks.length){const p=document.createElement('p');p.textContent='Není dostupný žádný úplný zdrojový týden.';body.append(p)}
 const summary=document.createElement('p');summary.id='ssSummary';summary.className='ss-muted';summary.textContent=lastSummary;body.append(summary);
 if(issues.length){const p=document.createElement('p');p.className='ss-error';p.textContent='Nepřevzaté údaje: '+issues.join('; ');body.append(p)}
 if(!dlg.open)dlg.showModal();
}
async function check(manual=false){
 if(checking){openAfterCheck||=manual;return}
 if(!enabled&&!manual)return;
 checking=true;openAfterCheck=manual;lastSummary='Probíhá kontrola dostupných týdnů Strava.cz…';report(lastSummary);
 await window.JidelnickyReady;
 const archive=window.JIDELNICKY_ARCHIVE;let archiveError;
 try{if(archive){
  const cached=Data.parseFeed(archive);sourceWeeks=cached.weeks;
  if(enabled&&sourceWeeks.length){const current=window.JidelnickyApp.getState();const eligible=sourceWeeks.filter(w=>{const old=current.history.find(h=>h.week===w.week),proof=current.stravaVerifiedWeeks?.[w.week];return !Data.isVerified(current,old)||Date.parse(proof?.retrievedAt||'')<=Date.parse(archive.retrievedAt||'')});const initial=Data.planImport(current,eligible,{retrievedAt:archive.retrievedAt,evidenceByWeek:archive.weekEvidence});const historical=Data.planHistoricalAudit(initial.state,archive.historicalAudit);if(initial.needsWrite||historical.needsWrite){window.JidelnickyApp.applyState(historical.state);window.GitHubSync?.changed()}}
 }}catch(error){archiveError=error}
 controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  if(archiveError)throw archiveError;
  const r=await fetch((window.JIDELNICKY_CONFIG?.stravaUrl||'./strava_5948.json')+'?ts='+Date.now(),{cache:'no-store',signal:controller.signal});
  if(!r.ok)throw Error('Zdroj není dostupný (HTTP '+r.status+')');
  const feed=await r.json();
  const live=Data.parseFeed(feed),combined=new Map(sourceWeeks.map(w=>[w.week,w]));
  const currentProofs=window.JidelnickyApp.getState();
  for(const w of currentProofs.history)if(Data.isVerified(currentProofs,w)&&Date.parse(currentProofs.stravaVerifiedWeeks[w.week].retrievedAt||'')>Date.parse(archive?.retrievedAt||''))combined.set(w.week,w);
  for(const w of live.weeks)combined.set(w.week,w);
  sourceWeeks=[...combined.values()];issues=live.issues;
  sourceInfo='Jídelna 5948 · automaticky aktualizovaný archiv Strava.cz · načten '+new Date(feed.retrievedAt||Date.now()).toLocaleString('cs-CZ');
  let result;
  if(enabled&&sourceWeeks.length){
   result=Data.planImport(window.JidelnickyApp.getState(),sourceWeeks,{retrievedAt:feed.retrievedAt,sourceUpdatedAt:feed.sourceUpdatedAt});
   if(result.needsWrite){window.JidelnickyApp.applyState(result.state);window.GitHubSync?.changed()}
  }
  const current=window.JidelnickyApp.getState(),available=new Set(sourceWeeks.map(w=>w.week));
  const remaining=sourceWeeks.filter(w=>!Data.sameWeek(current.history.find(h=>h.week===w.week),w)).length;
  const unverified=current.history.filter(w=>!Data.isVerified(current,w)).length;
  const changed=result?.changed.length||0;
  if(!enabled)lastSummary='Automatika je vypnutá; přehled je pouze ke čtení.';
  else if(issues.length||remaining)lastSummary='Některé týdny nebylo možné bezpečně převzít. Dosavadní úplné týdny a návrhy zůstávají zachované.';
  else if(!sourceWeeks.length)lastSummary='Zdroj nyní neobsahuje úplné týdny. Uložené jídelníčky zůstávají v Historii.';
  else lastSummary='Ověřeno '+sourceWeeks.length+' dostupných týdnů'+(changed?', aktualizováno '+changed:'')+'. '+(current.catalogAudit?.mealsVerified||current.catalogAudit?.noPublishedMenu?'Dalších '+current.catalogAudit.mealsVerified+' týdnů má ověřena všechna jídla a dny bez menu; '+current.catalogAudit.noPublishedMenu+' týdnů je ve zdroji zcela bez menu. Absence menu nepotvrzuje uzavření jídelny.':unverified?'Dalších '+unverified+' historických týdnů není úplně ověřeno.':'Ostatní dostupné týdny jsou v souladu se Strava.cz.')+' Starší jídelníčky najdete v Historii.';
  lastCheck=Date.now();report(lastSummary,!!issues.length||!!remaining||!sourceWeeks.length);
 }catch(e){
  if(e.name==='AbortError'&&!enabled)return;
  lastSummary='Kontrolu Strava.cz se nyní nepodařilo dokončit. Uložené jídelníčky a návrhy zůstaly zachované.';
  sourceInfo=sourceWeeks.length?'Poslední načtený přehled · nyní bez nového ověření':'Jídelna 5948 · zdroj nyní není dostupný';
  report(lastSummary,true);
 }finally{
  clearTimeout(timeout);controller=null;checking=false;refreshToggle();
  if(openAfterCheck)showPreview();openAfterCheck=false;
 }
}
toggle.onclick=()=>check(true);
window.addEventListener('load',()=>check(false));
window.addEventListener('online',()=>check(false));
window.addEventListener('focus',()=>{if(Date.now()-lastCheck>60000&&!dlg.open)check(false)});
setInterval(()=>{if(!document.hidden&&!dlg.open&&Date.now()-lastCheck>900000)check(false)},60000);
})();
