/* Strava 5948 – inteligentní, bezpečný import. Bez přímého CORS volání Strava.cz. */
(()=>{'use strict';
const test=new URLSearchParams(location.search).get('strava_test')==='1';
let previewOnly=false;
let changedWeeks=[];
let changedDetails=[];
const PREF_KEY='jidelnicky2:strava-auto-check-enabled';
// Import nesmí vycházet z místního katalogu před prvním dokončeným GitHub syncem.
let githubReady=false;
let githubWaiters=[];
function notifyGithubReady(){
 githubReady=true;
 for(const resolve of githubWaiters.splice(0))resolve(true);
}
window.addEventListener('jidelnicky:github-status',event=>{
 const detail=event.detail||{};
 if(detail.kind==='ok'&&/data synchronizov[aá]na|spole[cč]n[aá] data vytvo[rř]ena/i.test(detail.text||''))notifyGithubReady();
});
function waitForGithub(ms=16000){
 if(githubReady)return Promise.resolve(true);
 // Důležitá pojistka: místní katalog se bez synchronizace nepovažuje za aktuální.
 return new Promise(resolve=>{
  let finished=false;
  const done=value=>{if(finished)return;finished=true;resolve(value)};
  githubWaiters.push(done);
  setTimeout(()=>done(false),ms);
 });
}

let enabled=true;
try{enabled=localStorage.getItem(PREF_KEY)!=='false'}catch(_e){}
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs').replace(/\bpol[eé]vka\b/g,'').replace(/\bm\.m\.\b/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
// Shoda uloženého jídla a Strava.cz: nejprve text, pak jednoznačná
// katalogová identita. Pouhá stejná kategorie NENÍ důkazem shody.
function sameMeal(saved,incoming,kind){
 if(norm(saved)===norm(incoming))return true;
 if(!String(saved||'').trim()||!String(incoming||'').trim())return false;
 const a=match(saved,kind),b=match(incoming,kind);
 if(a&&b&&norm(a.name)===norm(b.name))return true;
 // Jen výslovně ověřená varianta z historie 2. 11. 2026.
 // Nepovažovat obecně jídla stejné kategorie za totožná.
 if(kind==='soup'){
  const variants=new Set(['hovezi s kapanim','hovezi se syrovym kapanim']);
  if(variants.has(norm(saved))&&variants.has(norm(incoming)))return true;
 }
 return false;
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monday=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Neplatné datum týdne');const d=new Date(s+'T12:00:00');if(isNaN(d)||d.toISOString().slice(0,10)!==s)throw Error('Neplatné datum týdne');d.setDate(d.getDate()-(d.getDay()+6)%7);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const currentMonday=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const dayNames=['Pondělí','Úterý','Středa','Čtvrtek','Pátek'];
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
const dlg=document.createElement('dialog');dlg.id='stravaSmart';dlg.innerHTML=`<div class="ss-head"><h2>Jídelníčky ze Strava.cz</h2><p id="ssInfo"></p></div><div id="ssBody" class="ss-body"></div><div class="ss-foot" id="ssFoot"></div>`;document.body.append(dlg);
const $=id=>document.getElementById(id);
const toggle=document.createElement('button');toggle.id='stravaToggle';toggle.type='button';toggle.title='Zapnout nebo vypnout automatickou kontrolu nových jídelníčků ze Strava.cz';
function refreshToggle(){toggle.textContent=enabled?'Strava.cz: zapnuto ✓':'Strava.cz: vypnuto';toggle.dataset.off=String(!enabled);toggle.setAttribute('aria-pressed',String(enabled))}
refreshToggle();document.body.append(toggle);
toggle.title='Kliknutím zapnout/vypnout Strava.cz; při zapnutí zobrazit přehled';
toggle.addEventListener('click',()=>{
 enabled=!enabled;
 try{localStorage.setItem(PREF_KEY,String(enabled))}catch(_e){}
 refreshToggle();
 if(!enabled){controller?.abort();if(dlg.open)close();report('Strava.cz: automatická kontrola vypnuta.');return}
 check(true);
});
let corrections=new Map();
let weeks=[],catalog=null,sourceStamp='',stage='choice',skipped=0,checking=false,controller=null;
const report=(text,error=false)=>window.dispatchEvent(new CustomEvent('jidelnicky:strava-status',{detail:{text,kind:error?'error':/probíhá/i.test(text)?'info':'ok'}}));
function items(kind){return Object.entries(catalog[kind]).flatMap(([category,names])=>names.map(name=>({name,category,key:norm(name)})))}
// Bezpečné rozpoznávání: automaticky pouze přesná normalizovaná shoda.
// Podobnost slov není důkazem totožnosti jídla.
function match(raw,kind){const found=items(kind).filter(x=>x.key===norm(raw));return found.length===1?found[0]:null}
// Kategorie: nejdříve již zatříděný katalog, pak jednoznačná pravidla.
// Neznámou kategorii nikdy nenahrazujeme první položkou seznamu.
function suggestCategory(raw,kind){
 const n=norm(raw), categories=Object.keys(catalog[kind]||{});
 const pick=pattern=>categories.find(c=>pattern.test(norm(c)))||'';
 const tokens=n.split(' ').filter(t=>t.length>=4&&!/^(smazene|pecene|varene|dusene|omackou|brambory|ryze|testoviny|masem|polevka)$/.test(t));
 const scores=new Map();
 for(const item of items(kind)){
  const words=new Set(item.key.split(' ').filter(t=>t.length>=4));
  const shared=tokens.filter(t=>words.has(t)).length;
  if(shared>=2){const score=shared/Math.max(tokens.length,words.size);
   const prev=scores.get(item.category)||{score:0,count:0};
   scores.set(item.category,{score:prev.score+score,count:prev.count+1});
  }
 }
 const ranked=[...scores].sort((a,b)=>b[1].score-a[1].score);
 const inferred=ranked.length&&ranked[0][1].score>=2.0&&ranked[0][1].count>=3&&
   (!ranked[1]||ranked[0][1].score>=ranked[1][1].score*2)
   ?ranked[0][0]:'';
 // Vývary mají přednost před obecnými slovy jako zelenina nebo kapání.
 let rule='';
 if(kind==='soup'){
  if(/\b(vyvar|hovezi|kureci|slepi|kruti)\b/.test(n)&&
    !/\b(krem|kremova|gulasova|drstkova)\b/.test(n))rule=pick(/vyvary|vyvar/);
  else if(/\b(cockova|fazolova|hrachova|cizrnova)\b/.test(n))rule=pick(/lustenin/);
  else if(/\b(zeleninova|rajcatova|brokolicova|kvetakova|bramborova|kremova)\b/.test(n))rule=pick(/zelenin/);
 }else{
  const rules=[
   [/\b(rybi|ryba|file|losos|treska|kapr)\b/,/ryby|rybi/],
   [/\b(kureci|kruti|kachni|slepici)\b/,/drubez/],
   [/\b(veprove|veprovy|plecko|krkovice|kotleta)\b/,/veprove/],
   [/\b(hovezi|teleci)\b/,/hovezi/],
   [/\b(buchticky|palacinky|livance|zemlovka)\b/,/sladka/],
   [/\b(cocka|fazole|hrachem|cizrna)\b/,/lustenin/]
  ];
  for(const [word,category] of rules)if(word.test(n)){rule=pick(category);break}
 }
 // Pokud katalog a pravidlo odporují, vyžádáme ruční výběr.
 const category=rule&&inferred&&rule!==inferred?'':rule||inferred;
 return {category,confident:!!category,source:rule?'pravidla a katalog':'katalog'};
}
function setFooter(buttons){$('ssFoot').replaceChildren();for(const b of buttons){const el=document.createElement('button');el.type='button';el.textContent=b.text;el.className=b.primary?'ss-primary':'';el.disabled=!!b.disabled;el.onclick=b.action;$('ssFoot').append(el)}}
function close(){dlg.close();weeks=[];previewOnly=false;corrections.clear()}
// Kliknutí na ztmavené pozadí zavře přehled stejně jako tlačítko Zavřít.
// Kontrolujeme skutečné souřadnice, aby kliknutí uvnitř dialogu nic nezavíralo.
dlg.addEventListener('click',event=>{
 if(!dlg.open||event.target!==dlg)return;
 const r=dlg.getBoundingClientRect();
 if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();
});
function previewFooter(){
 const buttons=[];
 // Automatika se ovládá pouze hlavním přepínačem Strava.cz mimo dialog.
 buttons.push({text:'Zavřít',action:close});setFooter(buttons);
}
function correctionKey(w,e){return w.week+'|'+e.day+'|'+e.field}
function saveCorrections(){
 if(!previewOnly||test){window.alert('Ukládání je dostupné pouze v běžném přehledu, nikoli v testu.');return;}if(!corrections.size)return;
 try{
  const state=structuredClone(window.JidelnickyApp.getState());
  let count=0;
  const planned=new Map();
  for(const entry of corrections.values()){const k=entry.kind+'|'+norm(entry.raw);if(planned.has(k)&&planned.get(k)!==entry.category)throw Error('Stejné jídlo má dvě různé kategorie: '+entry.raw);planned.set(k,entry.category);}
  const processed=new Set();
  for(const {week,day,field,kind,raw,category} of corrections.values()){
   if(!state.catalog?.[kind]?.[category])throw Error('Kategorie v katalogu již neexistuje: '+category);
   const nameKey=norm(raw);
   const uniqueKey=kind+'|'+nameKey;
   if(processed.has(uniqueKey))continue;
   processed.add(uniqueKey);
   // Přesunout pouze toto konkrétní jídlo, ne podobné názvy.
   for(const names of Object.values(state.catalog[kind])){
    for(let i=names.length-1;i>=0;i--)if(norm(names[i])===nameKey)names.splice(i,1);
   }
   if(!state.catalog[kind][category].some(n=>norm(n)===nameKey))state.catalog[kind][category].push(raw);
   // U již uloženého týdne měnit jen kategorii, pokud je v daném poli přesně stejné jídlo.
   const saved=state.history.find(h=>h.week===week);
   if(saved?.days?.[day]&&norm(saved.days[day][field])===nameKey){
    const catField=field==='main'?'category':field==='main2'?'category2':null;
    if(catField)saved.days[day][catField]=category;
   }
   count++;
  }
  window.JidelnickyApp.applyState(state);window.GitHubSync?.changed?.();
  corrections.clear();
  // Přepočítat rozpoznávání z právě uloženého katalogu a ihned ukázat zelený stav.
  catalog=window.JidelnickyApp.getState().catalog;
  for(const w of weeks)for(const e of w.entries){const found=match(e.raw,e.kind);if(found){e.matched=found;e.mode='auto';e.categorySuggestion=found.category;e.categoryConfident=true;}}
  review();previewFooter();
  report('Strava.cz: '+count+' položek potvrzeno/opraveno v katalogu; synchronizace na GitHub čeká na dokončení.');
 }catch(err){window.alert('Opravy se nepodařilo uložit: '+err.message)}
}

function showPreview(message){previewOnly=true;corrections.clear();review();$('ssInfo').textContent=message;if(changedWeeks.length){const p=document.createElement('p');p.className='ss-issue';p.textContent='Skutečné rozdíly v uložených týdnech (nic nebylo přepsáno): '+changedDetails.join(' | ');$('ssBody').prepend(p)}previewFooter();if(!dlg.open)dlg.showModal()}
function choice(){stage='choice';$('ssInfo').textContent=`Nalezeno ${weeks.length} nových týdnů. Co chceš udělat?`;const body=$('ssBody');body.replaceChildren();const p=document.createElement('p');p.textContent='Program už porovnal všechna jídla s katalogem. Převzetí ze Strava.cz vyžaduje jen kontrolu případných nejasností.';body.append(p);for(const w of weeks){const p=document.createElement('p');const auto=w.entries.filter(e=>e.mode==='auto').length,all=w.entries.length;p.textContent=`Týden ${w.week}: automaticky rozpoznáno ${auto} z ${all} jídel.`;body.append(p)}if(test){const p=document.createElement('p');p.className='ss-muted';p.textContent='TEST NANEČISTO – ukládání je vypnuté.';body.append(p)}setFooter([{text:'Použít Strava.cz',primary:true,action:review},{text:'Vytvořit vlastní',action:()=>{close();report('Strava.cz: zvolena vlastní tvorba; nic nebylo změněno.')}},{text:'Připomenout později',action:close}])}
function decisionLabel(e){return e.kind==='soup'?'Polévka':e.field==='main2'?'Oběd 2':'Oběd 1'}
function buildIssue(e,w){
 const box=document.createElement('div');box.className='ss-issue';
 box.textContent=dayNames[e.day]+' · '+decisionLabel(e)+' · '+e.raw+' (nový název, bez kategorizace)';return box;
}
function review(){
 stage='review';const body=$('ssBody');body.replaceChildren();
 $('ssInfo').textContent='Přehled jídel ze Strava.cz – bez kategorií';
 for(const w of weeks){const sec=document.createElement('section');sec.className='ss-week';const h=document.createElement('h3');h.textContent='Týden '+w.week;sec.append(h);
 for(const e of w.entries){const line=document.createElement('p');line.textContent=dayNames[e.day]+' · '+decisionLabel(e)+' · '+(e.matched?.name||e.raw);sec.append(line)}body.append(sec)}
 updateReady();
}
function updateReady(){if(stage!=='review')return;if(previewOnly||test){previewFooter();return;}setFooter([{text:'Uložit chybějící týdny',primary:true,action:commit},{text:'Zavřít',action:close}]);}
function parseWeeks(data){const state=window.JidelnickyApp.getState();catalog=state.catalog;const existing=new Set(test||previewOnly?[]:state.history.map(x=>x.week));changedWeeks=[];changedDetails=[];const seen=new Set();skipped=0;weeks=[];for(const w of data.weeks){if(!w||typeof w.week!=='string'||!Array.isArray(w.days)||w.days.length!==5)throw Error('Neplatný formát týdne');const week=monday(w.week);const isPast=week<currentMonday();if(existing.has(week)||seen.has(week)){
  skipped++;
  if(existing.has(week)&&!isPast){
   const saved=state.history.find(x=>x.week===week);
   if(saved?.days?.length===5){
    const differences=[];
    w.days.forEach((d,i)=>{
     if(d.closed)return;
     for(const f of ['soup','main','main2']){
      const before=saved.days[i]?.[f]||'',after=d[f]||'';
      if(!sameMeal(before,after,f==='soup'?'soup':'main'))
       differences.push(dayNames[i]+' / '+(f==='soup'?'Polévka':f==='main'?'Oběd 1':'Oběd 2')+': „'+before+'“ → „'+after+'“');
     }
    });
    if(differences.length){changedWeeks.push(week);changedDetails.push(...differences.map(t=>week+' – '+t));}
   }
  }
  continue
 }seen.add(week);const entries=[],days=[];for(let i=0;i<5;i++){const day=w.days[i];if(!day||typeof day!=='object')throw Error('Neplatný den');const closed=!!day.closed;const result={closed,soup:'',main:'',category:'',main2:'',category2:''};for(const [field,kind,cat] of [['soup','soup',null],['main','main','category'],['main2','main','category2']]){const raw=String(day[field]||'').trim();if(!raw)continue;const matched=match(raw,kind);entries.push({day:i,field,kind,cat,raw,matched,mode:'auto',choice:null,categorySuggestion:'',categoryConfident:true});}if(!closed&&(!day.soup||!day.main))throw Error(`Týden ${week}, ${dayNames[i]}: chybí polévka nebo oběd 1. Import byl bezpečně zastaven.`);days.push(result)}weeks.push({week,days,entries})}}
function commit(){
 if(test||previewOnly)return;
 try{
  const state=structuredClone(window.JidelnickyApp.getState());
  const existing=new Set(state.history.map(x=>x.week));
  if(weeks.some(w=>existing.has(w.week)))throw Error('Historie se mezitím změnila; import bezpečně zastaven.');
  const chooseName=(kind,raw)=>{
   const existing=Object.values(state.catalog[kind]).flat().find(name=>norm(name)===norm(raw));
   if(existing)return existing;
   const bucket=kind==='soup'?'__POLEVKY__':'__HLAVNI__';
   if(!state.catalog[kind][bucket])state.catalog[kind][bucket]=[];
   state.catalog[kind][bucket].push(raw);return raw;
  };
  for(const w of weeks){
   const days=w.days.map(x=>({...x}));
   for(const e of w.entries){
    days[e.day][e.field]=e.matched?.name||chooseName(e.kind,e.raw);
   }
   state.history.push({week:w.week,days});
  }
  window.JidelnickyApp.applyState(state);
  window.GitHubSync?.changed?.();
  const n=weeks.length;close();report('Strava.cz: '+n+' nových týdnů doplněno; původní týdny zachovány.');
 }catch(err){window.alert('Import nebyl dokončen: '+err.message)}
}

async function check(manual=false){
 if(checking||dlg.open||(!enabled&&!manual))return;
 checking=true;previewOnly=false;controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 report('Strava.cz 5948: probíhá kontrola…');
 try{
  const r=await fetch('./strava_5948.json?ts='+Date.now(),{cache:'no-store',signal:controller.signal});
  if(!r.ok)throw Error('JSON nedostupný (HTTP '+r.status+')');
  const data=await r.json();
  if(data.cafeteria!=='5948'||data.status!=='received'||!Array.isArray(data.weeks))throw Error('Neplatná odpověď');
  if(!window.JidelnickyApp?.getState)throw Error('Generátor ještě není připraven');
  if(!enabled&&!manual)return;
  sourceStamp=data.checked_at_utc||'';
  previewOnly=manual&&!test;
  // Vyčkej na skutečné převzetí společných dat; badge se může zobrazit později.
  const synced=await waitForGithub();
  if(!synced){
   report('Strava.cz: společný katalog z GitHubu ještě není synchronizovaný. Import pozastaven, nic se neuložilo.',true);
   return;
  }
  if(!enabled&&!manual)return;
  parseWeeks(data);
  if(!weeks.length){
   if(manual){showPreview('Strava.cz: dostupný přehled je prázdný.');return}
   if(changedWeeks.length){showPreview('Strava.cz: zjištěny změny v aktuálním nebo budoucím období.');return}
   report('Strava.cz 5948: aktuální, žádné nové týdny.');
   return;
  }
  if(test||manual){
   report('Strava.cz: náhled bez ukládání.');
   showPreview('Strava.cz: přehled dostupných jídel, bez ukládání.');
  }else{
   // Varianta A: neznámá kategorie nikdy nezastaví automatický import.
   // Ochrana: jen dosud neexistující týdny, pouze po dokončeném GitHub syncu.
   const ready=weeks.slice();
   weeks=ready;
   if(ready.length)commit();
   if(changedWeeks.length)report('Strava.cz: existující týdny '+changedWeeks.join(', ')+' nebyly přepsány.');

  }
 }catch(err){
  if(err.name==='AbortError'&&!enabled)return;
  console.warn('Strava.cz import',err);
  report('Strava.cz 5948: kontrola se nezdařila ('+(err.name==='AbortError'?'časový limit 12 s':err.message)+'). Data beze změny.',true);
 }finally{clearTimeout(timeout);checking=false;controller=null}
}
window.addEventListener('load',()=>setTimeout(()=>{if(enabled)check(false)},1800));
})();
// Kontrolni nasazeni GitHub Pages 2026-11-01
