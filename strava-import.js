/* Strava 5948 – inteligentní, bezpečný import. Bez přímého CORS volání Strava.cz. */
(()=>{'use strict';
const test=new URLSearchParams(location.search).get('strava_test')==='1';
let previewOnly=false;
let changedWeeks=[];
const PREF_KEY='jidelnicky:strava-auto-check-enabled';
let enabled=true;
try{enabled=localStorage.getItem(PREF_KEY)!=='false'}catch(_e){}
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs').replace(/\bpol[eé]vka\b/g,'').replace(/\bm\.m\.\b/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monday=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Neplatné datum týdne');const d=new Date(s+'T12:00:00');if(isNaN(d)||d.toISOString().slice(0,10)!==s)throw Error('Neplatné datum týdne');d.setDate(d.getDate()-(d.getDay()+6)%7);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const dayNames=['Pondělí','Úterý','Středa','Čtvrtek','Pátek'];
const style=document.createElement('style');style.textContent=`
#stravaSmart{box-sizing:border-box;width:min(900px,calc(100vw - 20px));max-height:92dvh;max-height:92vh;border:1px solid #d8e0e8;border-radius:16px;padding:0;color:#172d42;background:#fff;box-shadow:0 20px 70px #0004}
#stravaSmart *{box-sizing:border-box}#stravaSmart::backdrop{background:#101e2d99}
#stravaSmart .ss-head{padding:17px 20px 12px;border-bottom:1px solid #e4eaf0}#stravaSmart h2{margin:0 0 6px;font-size:21px}#stravaSmart p{margin:6px 0;line-height:1.45}
#stravaSmart .ss-body{padding:12px 20px;overflow:auto;max-height:calc(92vh - 190px)}#stravaSmart .ss-foot{display:flex;gap:9px;flex-wrap:wrap;padding:13px 20px;border-top:1px solid #e4eaf0;background:white}
#stravaSmart button{font:inherit;border-radius:9px;border:1px solid #c9d4df;background:white;color:#172d42;padding:9px 13px;cursor:pointer}#stravaSmart button.ss-primary{background:#1764a2;color:white;border-color:#1764a2}#stravaSmart button:disabled{opacity:.5;cursor:not-allowed}
#stravaSmart .ss-week{border:1px solid #e0e6ec;border-radius:12px;margin:11px 0;padding:12px}#stravaSmart .ss-week h3{margin:0 0 9px;font-size:17px}#stravaSmart .ss-day{border-top:1px solid #e8edf2;padding:10px 0}#stravaSmart .ss-line{display:grid;grid-template-columns:95px minmax(0,1fr) auto;gap:8px;align-items:start;margin:5px 0;font-size:14px}
#stravaSmart .ss-line strong{overflow-wrap:anywhere;font-weight:550}#stravaSmart .ss-pill{font-size:11px;border-radius:30px;padding:3px 7px;background:#e7f4ed;color:#21613f;white-space:nowrap}#stravaSmart .ss-pill.ss-warn{background:#fff1d7;color:#8c5200}
#stravaSmart .ss-issue{border:1px solid #efd39c;border-radius:10px;background:#fffdf8;padding:12px;margin:10px 0}#stravaSmart .ss-issue h4{margin:0 0 5px;font-size:15px}#stravaSmart .ss-choice{display:block;margin:6px 0;padding:8px;border:1px solid #e0e5ea;border-radius:8px;cursor:pointer}#stravaSmart .ss-choice input{margin-right:7px}#stravaSmart .ss-search{width:100%;max-width:440px;padding:9px;border:1px solid #bbc8d4;border-radius:8px;font:inherit}#stravaSmart .ss-muted{color:#617386;font-size:13px}#stravaSmart details{margin-top:9px}#stravaSmart summary{cursor:pointer;color:#1764a2}#stravaSmart .ss-hits{max-height:190px;overflow:auto}#stravaSmart select{max-width:100%;padding:8px;border:1px solid #bbc8d4;border-radius:8px}#stravaSmart .ss-error{color:#a12b2b}
@media(max-width:580px){#stravaSmart .ss-head{padding:13px}#stravaSmart .ss-body{padding:8px 12px;max-height:calc(92vh - 180px)}#stravaSmart .ss-foot{padding:10px 12px}#stravaSmart .ss-line{grid-template-columns:70px minmax(0,1fr);gap:5px}#stravaSmart .ss-pill{grid-column:2;justify-self:start}#stravaSmart h2{font-size:18px}#stravaSmart .ss-foot button{flex:1 1 130px}}
/* PC: GitHub vlevo, Strava vpravo. Mobil: oba ukazatele pod sebou. */
@media(max-width:650px){
 #githubIndicator.github-indicator{left:auto!important;right:12px!important;bottom:12px!important;max-width:calc(100vw - 24px)!important;font-size:10px!important}
 #stravaToggle{left:auto!important;right:12px!important;bottom:48px!important;max-width:calc(100vw - 24px)!important}
}
#stravaToggle{position:fixed;right:12px;bottom:12px;z-index:1900;box-sizing:border-box;display:block;width:max-content;max-width:calc(50vw - 18px);min-height:0;margin:0;padding:7px 10px;border:1px solid #c8d4e0;border-radius:7px;background:#fff;color:#173d60;box-shadow:0 2px 8px #0004;font:500 11px/1.2 Arial,sans-serif;text-align:center;overflow-wrap:anywhere;cursor:pointer}#stravaToggle[data-off="true"]{color:#66717c;background:#f4f5f6}#stravaToggle:focus-visible{outline:3px solid #1764a2;outline-offset:2px}
`;document.head.append(style);
const dlg=document.createElement('dialog');dlg.id='stravaSmart';dlg.innerHTML=`<div class="ss-head"><h2>Jídelníčky ze Strava.cz</h2><p id="ssInfo"></p></div><div id="ssBody" class="ss-body"></div><div class="ss-foot" id="ssFoot"></div>`;document.body.append(dlg);
const $=id=>document.getElementById(id);
const toggle=document.createElement('button');toggle.id='stravaToggle';toggle.type='button';toggle.title='Zapnout nebo vypnout automatickou kontrolu nových jídelníčků ze Strava.cz';
function refreshToggle(){toggle.textContent=enabled?'Strava.cz: zapnuto ✓':'Strava.cz: vypnuto';toggle.dataset.off=String(!enabled);toggle.setAttribute('aria-pressed',String(enabled))}
refreshToggle();document.body.append(toggle);
toggle.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(PREF_KEY,String(enabled))}catch(_e){}refreshToggle();if(!enabled){controller?.abort();if(dlg.open)close();report('Strava.cz: automatická kontrola vypnuta.')}else{report('Strava.cz: automatická kontrola zapnuta.');check()}});
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
function close(){dlg.close();weeks=[];previewOnly=false}
function choice(){stage='choice';$('ssInfo').textContent=`Nalezeno ${weeks.length} nových týdnů. Co chceš udělat?`;const body=$('ssBody');body.replaceChildren();const p=document.createElement('p');p.textContent='Program už porovnal všechna jídla s katalogem. Převzetí ze Strava.cz vyžaduje jen kontrolu případných nejasností.';body.append(p);for(const w of weeks){const p=document.createElement('p');const auto=w.entries.filter(e=>e.mode==='auto').length,all=w.entries.length;p.textContent=`Týden ${w.week}: automaticky rozpoznáno ${auto} z ${all} jídel.`;body.append(p)}if(test){const p=document.createElement('p');p.className='ss-muted';p.textContent='TEST NANEČISTO – ukládání je vypnuté.';body.append(p)}setFooter([{text:'Použít Strava.cz',primary:true,action:review},{text:'Vytvořit vlastní',action:()=>{close();report('Strava.cz: zvolena vlastní tvorba; nic nebylo změněno.')}},{text:'Připomenout později',action:close}])}
function decisionLabel(e){return e.kind==='soup'?'Polévka':e.field==='main2'?'Oběd 2':'Oběd 1'}
function buildIssue(e){
 const section=document.createElement('div');section.className='ss-issue';
 const title=document.createElement('h4');title.textContent=`${dayNames[e.day]} · ${decisionLabel(e)}`;section.append(title);
 const raw=document.createElement('p');raw.textContent='Strava.cz: '+e.raw;section.append(raw);
 const info=document.createElement('p');info.className='ss-muted';
 info.textContent='Přesná shoda v katalogu nebyla nalezena. Jídlo bude přidáno jako nové.';
 section.append(info);
 if(e.categoryConfident){
  const p=document.createElement('p');
  p.textContent='Kategorie automaticky: '+e.categorySuggestion;
  section.append(p);
 }else{
  const cat=document.createElement('div');cat.style.marginTop='8px';
  const label=document.createElement('label');label.textContent='Kategorie (nepodařilo se určit jednoznačně): ';
  const sel=document.createElement('select');
  sel.add(new Option('— Vyber kategorii —',''));
  for(const name of Object.keys(catalog[e.kind]))sel.add(new Option(name,name));
  sel.value=e.categorySuggestion;
  sel.onchange=()=>{e.categorySuggestion=sel.value;updateReady()};
  cat.append(label,sel);section.append(cat);
 }
 e.choice='__new';return section;
}
function review(){stage='review';const issues=weeks.flatMap(w=>w.entries.filter(e=>e.mode!=='auto'));const auto=weeks.flatMap(w=>w.entries).length-issues.length;$('ssInfo').textContent=`${auto} jídel rozpoznáno automaticky · ${issues.length} položek k rozhodnutí`;const body=$('ssBody');body.replaceChildren();for(const w of weeks){const sec=document.createElement('section');sec.className='ss-week';sec.innerHTML='<h3>Týden '+escape(w.week)+'</h3>';for(let i=0;i<5;i++){const d=document.createElement('div');d.className='ss-day';const head=document.createElement('strong');head.textContent=dayNames[i];d.append(head);const entries=w.entries.filter(e=>e.day===i);if(!entries.length){const p=document.createElement('p');p.textContent='Bez jídel';d.append(p)}for(const e of entries){const line=document.createElement('div');line.className='ss-line';const label=document.createElement('span');label.textContent=decisionLabel(e);const name=document.createElement('strong');name.textContent=e.mode==='auto'?e.matched.name:e.raw;const pill=document.createElement('span');pill.className='ss-pill'+(e.mode==='auto'?'':' ss-warn');pill.textContent=e.mode==='auto'?'Rozpoznáno':e.categoryConfident?'Nové · kategorie určena':'Vyžaduje kategorii';line.append(label,name,pill);d.append(line);if(e.mode!=='auto')d.append(buildIssue(e,w))}sec.append(d)}body.append(sec)}if(!issues.length){const p=document.createElement('p');p.textContent='Všechna jídla jsou jednoznačně přiřazena. Stačí schválit celý týden.';body.prepend(p)}if(test||previewOnly){const p=document.createElement('p');p.className='ss-muted';p.textContent=test?'TEST NANEČISTO – žádná data se neuloží.':'NÁHLED JIŽ NAČTENÉHO TÝDNE – žádná data se neuloží.';body.prepend(p)}updateReady()}
function updateReady(){if(stage!=='review')return;const missing=weeks.flatMap(w=>w.entries).filter(e=>e.mode!=='auto'&&(!e.choice||!e.categorySuggestion)).length;setFooter(test||previewOnly?[{text:'Zavřít',primary:true,action:close}]:[{text:'Schválit a uložit',primary:true,disabled:missing>0,action:commit},{text:'Zavřít',action:close}]);}
function parseWeeks(data){const state=window.JidelnickyApp.getState();catalog=state.catalog;const existing=new Set(test||previewOnly?[]:state.history.map(x=>x.week));changedWeeks=[];const seen=new Set();skipped=0;weeks=[];for(const w of data.weeks){if(!w||typeof w.week!=='string'||!Array.isArray(w.days)||w.days.length!==5)throw Error('Neplatný formát týdne');const week=monday(w.week);if(existing.has(week)||seen.has(week)){
  skipped++;
  if(existing.has(week)){
   const saved=state.history.find(x=>x.week===week);
   if(saved?.days?.length===5){
    const differs=w.days.some((d,i)=>!d.closed&&['soup','main','main2'].some(f=>norm(d[f]||'')!==norm(saved.days[i]?.[f]||'')));
    if(differs)changedWeeks.push(week);
   }
  }
  continue
 }seen.add(week);const entries=[],days=[];for(let i=0;i<5;i++){const day=w.days[i];if(!day||typeof day!=='object')throw Error('Neplatný den');const closed=!!day.closed;const result={closed,soup:'',main:'',category:'',main2:'',category2:''};for(const [field,kind,cat] of [['soup','soup',null],['main','main','category'],['main2','main','category2']]){const raw=String(day[field]||'').trim();if(!raw)continue;const matched=match(raw,kind);const suggestion=matched?{category:matched.category,confident:true}:suggestCategory(raw,kind);entries.push({day:i,field,kind,cat,raw,matched,mode:matched?'auto':'review',choice:null,categorySuggestion:suggestion.category,categoryConfident:suggestion.confident});}if(!closed&&(!day.soup||!day.main))throw Error(`Týden ${week}, ${dayNames[i]}: chybí polévka nebo oběd 1. Import byl bezpečně zastaven.`);days.push(result)}weeks.push({week,days,entries})}}
function commit(){if(test||previewOnly)return;try{const state=structuredClone(window.JidelnickyApp.getState());const existing=new Set(state.history.map(x=>x.week));if(weeks.some(w=>existing.has(w.week)))throw Error('Historie se mezitím změnila. Obnov stránku a zkus to znovu.');for(const w of weeks){const days=w.days.map(x=>({...x}));for(const e of w.entries){let chosen=e.matched;if(e.mode!=='auto'){if(!e.choice)throw Error('Některá jídla nejsou schválená');if(e.choice==='__new'){const category=e.categorySuggestion;if(!state.catalog[e.kind][category])throw Error('Neplatná kategorie');const collisions=Object.entries(state.catalog[e.kind]).flatMap(([c,names])=>names.filter(n=>norm(n)===norm(e.raw)).map(name=>({name,category:c})));if(collisions.length){if(collisions.length!==1||collisions[0].category!==category)throw Error('Jídlo již existuje v jiné kategorii: '+e.raw);chosen=collisions[0]}else{state.catalog[e.kind][category].push(e.raw);chosen={name:e.raw,category}}}else{chosen=JSON.parse(e.choice);if(!state.catalog[e.kind][chosen.category]?.includes(chosen.name))throw Error('Vybrané jídlo už není v katalogu: '+chosen.name)}}days[e.day][e.field]=chosen.name;if(e.cat)days[e.day][e.cat]=chosen.category}state.history.push({week:w.week,days})}window.JidelnickyApp.applyState(state);window.GitHubSync?.changed?.();const n=weeks.length;close();report('Strava.cz: '+n+' týdnů doplněno; synchronizace čeká na GitHub.')}catch(err){window.alert('Import nebyl dokončen: '+err.message)}}
async function check(){
 if(checking||dlg.open||!enabled)return;
 checking=true;controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 report('Strava.cz 5948: probíhá kontrola…');
 try{
  const r=await fetch('./strava_5948.json?ts='+Date.now(),{cache:'no-store',signal:controller.signal});
  if(!r.ok)throw Error('JSON nedostupný (HTTP '+r.status+')');
  const data=await r.json();
  if(data.cafeteria!=='5948'||data.status!=='received'||!Array.isArray(data.weeks))throw Error('Neplatná odpověď');
  if(!window.JidelnickyApp?.getState)throw Error('Generátor ještě není připraven');
  if(!enabled)return;
  sourceStamp=data.checked_at_utc||'';
  previewOnly=false;
  parseWeeks(data);
  if(!weeks.length){
   report(changedWeeks.length?'Strava.cz: změny v již uložených týdnech '+changedWeeks.join(', ')+' – automaticky nepřepsáno.':'Strava.cz 5948: aktuální, žádné nové týdny.');
   return;
  }
  if(test){
   report('Strava.cz: testovací náhled – žádné ukládání.');
   review();if(!dlg.open)dlg.showModal();
  }else{
   const ready=weeks.filter(w=>w.entries.every(e=>e.mode==='auto'||e.categoryConfident));
   const pending=weeks.filter(w=>w.entries.some(e=>e.mode!=='auto'&&!e.categoryConfident));
   // Odložené týdny zůstávají v aktuálním strava_5948.json a při další kontrole
   // se znovu vyhodnotí. Nikdy je nezapisujeme s vymyšlenou kategorií.
   weeks=ready;
   if(ready.length){
    for(const w of ready)for(const e of w.entries)if(e.mode!=='auto')e.choice='__new';
    commit();
   }
   const notes=[];
   if(ready.length)notes.push(ready.length+' nových týdnů automaticky převzato');
   if(pending.length)notes.push(pending.length+' týdnů čeká na jednoznačné zařazení (bez přepsání dat)');
   if(changedWeeks.length)notes.push('změny uložených týdnů '+changedWeeks.join(', ')+' nepřepsány');
   report('Strava.cz: '+(notes.join('; ')||'aktuální, žádné nové týdny')+'.',pending.length>0);
  }
 }catch(err){
  if(err.name==='AbortError'&&!enabled)return;
  console.warn('Strava.cz import',err);
  report('Strava.cz 5948: kontrola se nezdařila ('+(err.name==='AbortError'?'časový limit 12 s':err.message)+'). Data beze změny.',true);
 }finally{clearTimeout(timeout);checking=false;controller=null}
}
window.addEventListener('load',()=>setTimeout(()=>{if(enabled)check()},1800));
})();
// Kontrolni nasazeni GitHub Pages 2026-11-01
