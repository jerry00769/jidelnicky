/* Bezpečný import již získaných dat Strava.cz. Neobsahuje neověřený scraper. */
(()=>{'use strict';
const testMode=new URLSearchParams(location.search).get('strava_test')==='1';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const mon=s=>{const d=new Date(s+'T12:00:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||isNaN(d)||d.toISOString().slice(0,10)!==s)throw Error('Neplatné datum '+s);d.setDate(d.getDate()-(d.getDay()+6)%7);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=document.createElement('div');root.innerHTML=`<dialog id="stravaDialog" style="width:min(850px,96vw)"><h2>Nové jídelníčky ze Strava.cz</h2><p id="stravaMessage"></p><div id="stravaResult" style="max-height:55vh;overflow:auto;margin:12px 0"></div><button id="stravaCommit" type="button" disabled>Ano, doplnit do historie</button> <button id="stravaClose" type="button" class="alt">Ne, později</button></dialog>`;
document.body.append(root.querySelector('#stravaDialog'));
const $=id=>document.getElementById(id);let pending=[];
function reportCheck(message,error=false){
 window.dispatchEvent(new CustomEvent('jidelnicky:strava-status',{detail:{text:String(message),kind:error?'error':/probíhá|kontroluji/i.test(message)?'info':'ok'}}));
}

$('stravaClose').onclick=()=>$('stravaDialog').close();
function catalogIndex(catalog,kind){const map=new Map();for(const [category,arr] of Object.entries(catalog[kind]))for(const name of arr){const k=norm(name);if(!map.has(k))map.set(k,[]);map.get(k).push({name,category})}return map}
function match(index,name){const found=index.get(norm(name))||[];return found.length===1?found[0]:null}
function prepare(input){const weeks=Array.isArray(input)?input:Array.isArray(input.weeks)?input.weeks:null;if(!weeks)throw Error('Očekávám pole týdnů nebo objekt {weeks:[...]}');const state=window.JidelnickyApp.getState(),existing=new Set(testMode?[]:state.history.map(x=>x.week)),seen=new Set(),soup=catalogIndex(state.catalog,'soup'),main=catalogIndex(state.catalog,'main');let skipped=0;pending=[];
for(const w of weeks){if(!w||typeof w.week!=='string'||!Array.isArray(w.days)||w.days.length!==5)throw Error('Každý týden musí mít week a přesně 5 dnů.');const week=mon(w.week);if(existing.has(week)||seen.has(week)){skipped++;continue}seen.add(week);const days=w.days.map((d,i)=>{if(!d||typeof d!=='object')throw Error('Neplatný den v týdnu '+week);const closed=!!d.closed;const result={closed,soup:'',main:'',category:'',main2:'',category2:''};for(const [field,kind,cat] of [['soup','soup',null],['main','main','category'],['main2','main','category2']]){const raw=String(d[field]||'').trim();if(!raw)continue;const found=match(kind==='soup'?soup:main,raw);if(found){result[field]=found.name;if(cat)result[cat]=found.category}else{result[field]=raw;result['_'+field+'Pending']=true}}if(!closed&&(!result.soup||!result.main))result._incomplete=true;return result});pending.push({week,days})}
renderReview(skipped,state.catalog);if(testMode){$('stravaCommit').disabled=true;$('stravaCommit').textContent='Testovací režim – ukládání vypnuto';$('stravaMessage').textContent='TEST NANEČISTO: existující týdny jsou pro porovnání dočasně ignorovány. Žádná data se neuloží. Zkontroluj nabídku a klikni Ne, později.';}}
function renderReview(skipped,catalog){const box=$('stravaResult');box.replaceChildren();const intro=document.createElement('p');intro.textContent=`Nové týdny: ${pending.length}. Přeskočené existující/duplicitní: ${skipped}. Existující týdny se nikdy nepřepisují.`;box.append(intro);
for(const w of pending){const sec=document.createElement('section');sec.style.cssText='border-top:1px solid #ddd;padding:10px 0';const h=document.createElement('strong');h.textContent='Týden '+w.week;sec.append(h);for(const [i,d] of w.days.entries()){if(d._incomplete){const p=document.createElement('p');p.textContent=`Den ${i+1}: neúplný jídelníček – týden nelze uložit.`;sec.append(p)}for(const [field,kind,cat] of [['soup','soup',null],['main','main','category'],['main2','main','category2']]){if(!d['_'+field+'Pending'])continue;const wrap=document.createElement('div');wrap.style.margin='9px 0';const lab=document.createElement('label');lab.textContent=`Den ${i+1}, ${field}: „${d[field]}“ → `;wrap.append(lab);const sel=document.createElement('select');sel.style.maxWidth='100%';sel.add(new Option('— Vyber existující jídlo nebo nové —',''));for(const [category,items] of Object.entries(catalog[kind]))for(const name of items)sel.add(new Option(`${category}: ${name}`,JSON.stringify({name,category})));sel.add(new Option('NOVÉ JÍDLO – schválit a zařadit','__new'));wrap.append(sel);const categorySel=document.createElement('select');categorySel.hidden=true;categorySel.add(new Option('Vyber kategorii',''));for(const category of Object.keys(catalog[kind]))categorySel.add(new Option(category,category));wrap.append(categorySel);sel.onchange=()=>{categorySel.hidden=sel.value!=='__new';d['_'+field+'Decision']=sel.value;refreshButton()};categorySel.onchange=()=>{d['_'+field+'Category']=categorySel.value;refreshButton()};sec.append(wrap)}}box.append(sec)}refreshButton()}
function ready(){return pending.length>0&&pending.every(w=>w.days.every(d=>!d._incomplete&&['soup','main','main2'].every(field=>!d['_'+field+'Pending']||(d['_'+field+'Decision']&&(d['_'+field+'Decision']!=='__new'||d['_'+field+'Category'])))))}
function refreshButton(){$('stravaCommit').disabled=testMode||!ready()}

$('stravaCommit').onclick=()=>{if(testMode)return;try{if(!ready())throw Error('Některé položky nejsou schválené');const state=window.JidelnickyApp.getState(),existing=new Set(state.history.map(x=>x.week));for(const w of pending){if(existing.has(w.week))throw Error('Historie se mezitím změnila; načti import znovu.');const days=w.days.map(d=>{const out={closed:d.closed,soup:'',main:'',category:'',main2:'',category2:''};for(const [field,kind,cat] of [['soup','soup',null],['main','main','category'],['main2','main','category2']]){let name=d[field];if(d['_'+field+'Pending']){const decision=d['_'+field+'Decision'];if(decision==='__new'){const category=d['_'+field+'Category'];const exists=Object.values(state.catalog[kind]).flat().some(x=>norm(x)===norm(name));if(exists){const same=state.catalog[kind][category].find(x=>norm(x)===norm(name));if(!same)throw Error('Jídlo již existuje v jiné kategorii: '+name);name=same;}else state.catalog[kind][category].push(name);if(cat)out[cat]=category}else{const chosen=JSON.parse(decision);name=chosen.name;if(cat)out[cat]=chosen.category}}else if(cat)out[cat]=d[cat];out[field]=name}return out});state.history.push({week:w.week,days})}window.JidelnickyApp.applyState(state);window.GitHubSync?.changed?.();const n=pending.length;pending=[];$('stravaResult').textContent=`Uloženo ${n} týdnů. Zkontroluj stav synchronizace GitHub.`;$('stravaCommit').disabled=true;$('stravaDialog').close()}catch(err){alert('Import se nezapsal: '+err.message)}};
// Veřejný JSON generovaný na GitHub Actions; nikdy nevolat Strava.cz přímo z prohlížeče.
async function checkStrava(){
 reportCheck('Strava.cz 5948: probíhá kontrola jídelníčků…');
 try{
  const r=await fetch('./strava_5948.json?ts='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('Soubor strava_5948.json zatím není dostupný (HTTP '+r.status+').');
  const data=await r.json();
  if(data.cafeteria!=='5948'||data.status!=='received'||!Array.isArray(data.weeks))throw Error('Neplatná nebo neúplná odpověď.');
  if(!window.JidelnickyApp?.getState)throw Error('Generátor není připraven.');
  prepare(data);
  if(!pending.length){reportCheck('Strava.cz 5948: kontrola dokončena, žádné nové celé týdny nebyly nalezeny.');return;}
  if(!testMode)$('stravaMessage').textContent=`Strava.cz: nalezeno ${pending.length} dosud neuložených týdnů. Chcete je doplnit? Nejasná jídla je nutné nejprve schválit.`;
  reportCheck(testMode?'Strava.cz 5948: test výzvy (bez zápisu).':'Strava.cz 5948: nalezeno '+pending.length+' nových týdnů.');
  $('stravaDialog').showModal();
 }catch(err){console.warn('Kontrola Strava.cz:',err);reportCheck('Strava.cz 5948: kontrola se nezdařila ('+err.message+'). Historie zůstala beze změny.',true);}
}
window.addEventListener('load',()=>setTimeout(checkStrava,1100));
})();
