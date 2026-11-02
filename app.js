(()=>{'use strict';
const $=id=>document.getElementById(id),clone=x=>structuredClone(x),storeKey='jidelnicky2_static_v1';
const defaults={fish:1,legumes:1,meatless:1,sweetMax:1,avoidLegumePair:true,avoidFishPair:true};
const weekdays=['Pondělí','Úterý','Středa','Čtvrtek','Pátek'];
const today=new Date(),iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseDate=s=>{let [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const monday=s=>{let d=parseDate(s);if(Number.isNaN(d.getTime()))throw Error('Neplatné datum');d.setDate(d.getDate()-(d.getDay()+6)%7);return iso(d)};
// Nejbližší pondělí striktně po dnešku: v neděli zítra, v pondělí za 7 dní.
const preparationWeek=(date=new Date())=>{const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);const days=(8-d.getDay())%7||7;d.setDate(d.getDate()+days);return iso(d)};
const dateAt=(s,i)=>{let d=parseDate(s);d.setDate(d.getDate()+i);return d};
const format=d=>d.toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'});
const freshDay=()=>({closed:false,soup:'',main:'',category:'',main2:'',category2:''});
const freshWeek=s=>({week:monday(s),days:Array.from({length:5},freshDay)});

let state;try{state=JSON.parse(localStorage.getItem(storeKey)||'null')}catch{};
const hasSavedState=!!(state?.catalog?.main&&state?.catalog?.soup&&state?.week?.days?.length===5);
if(!state||!state.catalog||!state.week||!Array.isArray(state.week.days)||state.week.days.length!==5)state={catalog:clone(window.INITIAL_CATALOG),week:freshWeek(preparationWeek(today)),history:[],rules:clone(defaults),txt:'',count:1,lockMain:8,lockSoup:3};
// Bezpecne doplneni POUZE historicky pouzitych nazvu do katalogu.
// Neodstranuje zadne zaznamy ani neprepise historii; respektuje ulozene uzivatelske nazvy.
function reconcileCatalogWithHistory(target){
 if(!target?.catalog?.soup||!target?.catalog?.main||!Array.isArray(target.history))return 0;
 const normName=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('cs');
 let added=0;
 for(const kind of ['soup','main']){
  const groups=target.catalog[kind];
  const known=new Set(Object.values(groups).flat().map(normName));
  const baseline=window.INITIAL_CATALOG?.[kind]||{};
  const baselineGroup=new Map();
  for(const [cat,items] of Object.entries(baseline))for(const name of items)baselineGroup.set(normName(name),cat);
  for(const week of target.history)for(const day of week.days||[]){
   if(day.closed)continue;
   for(const field of kind==='soup'?['soup']:['main','main2']){
    const name=String(day[field]||'').trim(),key=normName(name);
    if(!key||known.has(key)||(kind==='soup'&&key==='prazdniny'))continue;
    const cat=baselineGroup.get(key)||Object.keys(groups)[0]||'OSTATNI';
    (groups[cat]??=[]).push(name);known.add(key);added++;
   }
  }
 }
 return added;
}
state.history??=[];state.learning=cleanLearning(state.learning);state.rules={...defaults,...state.rules};state.txt??='';state.count=[1,2].includes(+state.count)?+state.count:1;
const repairedOnLoad=reconcileCatalogWithHistory(state);
if(repairedOnLoad){try{localStorage.setItem(storeKey,JSON.stringify(state))}catch(e){console.warn("Katalog se nepodařilo uložit",e)}}

// Preference z ručních úprav; omezené skóre zabraňuje zacyklení výběru.
function cleanLearning(value){
    const result={main:{},soup:{},pair:{}};
    for(const kind of Object.keys(result)){
        const source=value?.[kind];
        if(!source||typeof source!=='object'||Array.isArray(source))continue;
        for(const [name,score] of Object.entries(source)){
            if(typeof score==='number'&&Number.isFinite(score))result[kind][name]=Math.max(-20,Math.min(20,Math.round(score)));
        }
    }
    return result;
}
function learn(kind,key,delta){
    if(!key)return;
    const table=state.learning[kind];
    table[key]=Math.max(-20,Math.min(20,(table[key]||0)+delta));
}
const pairKey=(soup,main)=>soup+' ||| '+main;
function weightedPick(items,kind,getKey=x=>x){
    if(!items.length)return undefined;
    const weights=items.map(item=>Math.max(1,10+2*(state.learning[kind][getKey(item)]||0)));
    let draw=Math.random()*weights.reduce((a,b)=>a+b,0);
    for(let i=0;i<items.length;i++){draw-=weights[i];if(draw<0)return items[i]}
    return items[items.length-1];
}
function weightedOrder(items,kind,getKey=x=>x){
    const pool=[...items],result=[];
    while(pool.length){const choice=weightedPick(pool,kind,getKey);result.push(choice);pool.splice(pool.indexOf(choice),1)}
    return result;
}

const undo=[],redo=[];let lastSaved=JSON.stringify(state),printingHistory=false;
const save=()=>{if(printingHistory)return;const json=JSON.stringify(state);if(json===lastSaved)return;try{localStorage.setItem(storeKey,json);lastSaved=json;window.GitHubSync?.changed()}catch(e){notice('Uložení do prohlížeče selhalo.',true)}};
function download(name,content,type){const b=new Blob([content],{type});const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}
window.JidelnickyApp={getState:()=>clone(state),applyState(next){if(!next?.catalog?.main||!next?.catalog?.soup||!Array.isArray(next.history)||next?.week?.days?.length!==5)throw Error('Neplatná společná data');state=clone(next);reconcileCatalogWithHistory(state);state.learning=cleanLearning(state.learning);state.rules={...defaults,...state.rules};state.txt??='';state.count=[1,2].includes(+state.count)?+state.count:1;undo.length=0;redo.length=0;lastSaved=JSON.stringify(state);localStorage.setItem(storeKey,lastSaved);if(typeof selectedHistory!=='undefined'&&selectedHistory&&!state.history.some(h=>h.week===selectedHistory))selectedHistory=[...state.history].sort((a,b)=>b.week.localeCompare(a.week))[0]?.week||null;render();if($('historyDialog')?.open){historyRows();historyDetail()}},notice};
const snapshot=()=>{undo.push(clone(state));if(undo.length>60)undo.shift();redo.length=0};

// Kontrola je pouze čtecí; GitHub se nemění bez výslovného souhlasu.
function auditCatalogHistory(){
 const key=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('cs');
 const known={soup:new Set(),main:new Set()};
 for(const kind of ['soup','main'])for(const names of Object.values(state.catalog[kind]||{}))for(const name of names)known[kind].add(key(name));
 const missing={soup:new Map(),main:new Map()};
 for(const week of state.history||[])for(const day of week.days||[]){
  if(day.closed)continue;
  for(const [kind,field] of [['soup','soup'],['main','main'],['main','main2']]){
   const name=String(day[field]||'').trim(),k=key(name);
   if(!k||(kind==='soup'&&k==='prazdniny'))continue;
   if(!known[kind].has(k)&&!missing[kind].has(k))missing[kind].set(k,{name});
  }
 }
 return {missing};
}
async function runCatalogAudit(){
 // Jídelníčky 2: jen kontrola názvů. Historie se nikdy automaticky nepřepisuje.
 const repaired=reconcileCatalogWithHistory(state);
 if(repaired)save();
 const audit=auditCatalogHistory();
 const missing=[...audit.missing.soup.values()].map(x=>'Polévka: '+x.name).concat([...audit.missing.main.values()].map(x=>'Hlavní jídlo: '+x.name));
 alert('Kontrola databáze (bez kategorizace)\n\nHistorie: '+state.history.length+' týdnů.\nChybějící názvy v katalogu: '+missing.length+'\n\n'+(missing.join('\n')||'Žádné chybějící názvy.')+'\n\nDoplněno z historie do katalogu: '+repaired+' názvů. Historie zůstala beze změny.');
}
$('auditCatalog')?.addEventListener('click',()=>runCatalogAudit().catch(e=>notice('Kontrola databáze selhala: '+e.message,true)));

let statusTimer;function notice(message,error=false){const el=$('status');if(!el)return;clearTimeout(statusTimer);el.textContent=message;el.className=error?'error':'success';el.style.display='block';statusTimer=setTimeout(()=>el.style.display='none',6500)}
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const starts=(cat,p)=>cat.startsWith(p);
const all=(kind)=>Object.entries(state.catalog[kind]||{}).flatMap(([cat,items])=>items.map(name=>({cat,name})));
// Pomocné kategorie zůstávají v datech pro automatický import, nikoli v ručním výběru.
const isInternalCategory=cat=>/^(K ZAŘAZENÍ|K OVĚŘENÍ)$/i.test(String(cat||'').trim());

function txtRules(){
    const t={ban_main:[],ban_soup:[],ban_pair:[],require_main:[],require_soup:[],require_pair:[]};
    const names={ZAKAZ_HLAVNI:'ban_main',ZAKAZ_POLEVKA:'ban_soup',ZAKAZ_KOMBINACE:'ban_pair',VYZADUJ_HLAVNI:'require_main',VYZADUJ_POLEVKA:'require_soup',VYZADUJ_KOMBINACE:'require_pair'};
    for(const [i,raw] of state.txt.split(/\r?\n/).entries()){
        const line=raw.trim();if(!line||line.startsWith('#'))continue;
        const pos=line.indexOf('=');if(pos<0)throw Error(`TXT pravidla, řádek ${i+1}: chybí =`);
        const key=line.slice(0,pos).trim().toUpperCase(),value=line.slice(pos+1).trim();
        if(!names[key]||!value)throw Error(`TXT pravidla, řádek ${i+1}: neznámý příkaz nebo prázdná hodnota`);
        let item=value;if(key.includes('KOMBINACE')){item=value.split('|').map(x=>x.trim());if(item.length!==2||item.some(x=>!x))throw Error(`TXT pravidla, řádek ${i+1}: použij polévka | hlavní jídlo`)}
        t[names[key]].push(item)
    }
    return t;
}

const contains=(name,term)=>norm(name).includes(norm(term));
// V2: pouze automatické rozpoznání názvu, žádné přiřazování do kategorií.
const mealType=name=>{
 const n=norm(name);
 if(/\b(ryb|rybi|ryba|file|losos|tresk|kapr|tunak|pangasi|pstruh)/.test(n))return 'fish';
 if(/\b(cock|fazol|hrach|cizrn|lustenin|sojov|tofu)/.test(n))return 'legumes';
 if(/\b(bucht|palacink|livanc|zemlov|knedliky s|nudle s makem|krupic|sladk)/.test(n))return 'sweet';
 if(/\b(kure|kruti|kachn|vepr|hovez|telec|maso|masov|gulas|rizek|uzen|sunk|slanina|klobas|parek|karbanat|sekana|ryb)/.test(n))return 'meat';
 if(/\b(syr|smazak|bramborak|zelenin|spenat|testovin|rizot|kvetak|brokolic|houb|zampion|vejce|omelet)/.test(n))return 'meatless';
 return 'unknown';
};
const soupType=name=>{const n=norm(name);return /cock|fazol|hrach|cizrn|lustenin/.test(n)?'legumes':/ryb|rybi/.test(n)?'fish':'other'};
// Střídání podle posledního dřívějšího schváleného VAŘENÉHO pondělí.
// Pondělí bez ryby/luštěnin ani zavřené pondělí nepřerušuje posloupnost.
function mondayCat(week){
 const prior=[...state.history].filter(h=>h.week<week&&h.days?.[0]&&!h.days[0].closed).sort((a,b)=>b.week.localeCompare(a.week));
 for(const h of prior){const t=mealType(h.days[0].main);if(t==='fish')return 'legumes';if(t==='legumes')return 'fish';}
 return 'legumes';
}
function mondayException(w=state.week){
 return !w.days[0].closed&&mealType(w.days[0].main)!==mondayCat(w.week);
}
function validate(w=state.week,{allowMondayException=false}={}){
 const errors=[],r=state.rules,t=txtRules(),active=w.days.filter(d=>!d.closed),mains=[],soups=[];
 if(!active.length)return ['Není vybrán žádný den vaření.'];
 for(const d of active){
  if(!d.soup||!d.main||(state.count===2&&!d.main2))errors.push('Některému dni chybí polévka nebo oběd.');
  soups.push(d.soup);
  for(const field of state.count===2?['main','main2']:['main']){
   const m=d[field];mains.push(m);
   if(t.ban_main.some(x=>contains(m,x))||t.ban_pair.some(([a,b])=>contains(d.soup,a)&&contains(m,b)))errors.push('Zakázané hlavní jídlo nebo kombinace.');
   if(r.avoidLegumePair&&mealType(m)==='legumes'&&soupType(d.soup)==='legumes')errors.push('Luštěninová polévka s luštěninovým hlavním jídlem.');
   if(r.avoidFishPair&&mealType(m)==='fish'&&soupType(d.soup)==='fish')errors.push('Rybí polévka s rybím hlavním jídlem.');
  }
  if(t.ban_soup.some(x=>contains(d.soup,x)))errors.push('Zakázaná polévka.');
 }
 if(new Set(mains).size!==mains.length||new Set(soups).size!==soups.length)errors.push('Opakování jídel nebo polévek v týdnu.');
 for(const [k,label] of [['fish','ryb'],['legumes','luštěnin'],['meatless','bezmasých']])if(mains.filter(m=>mealType(m)===k).length<r[k])errors.push('Nedostatek '+label+' jídel podle názvů.');
 if(mains.filter(m=>mealType(m)==='sweet').length>r.sweetMax)errors.push('Příliš mnoho sladkých jídel.');
 if(!allowMondayException&&mondayException(w))errors.push('Pondělní Oběd 1 nesplňuje střídání ryb a luštěnin podle historie.');
 if(state.count===2&&!w.days[0].closed&&w.days[0].main===w.days[0].main2)errors.push('Pondělní obědy musí být různé.');
 for(const term of t.require_main)if(!active.some(d=>contains(d.main,term)||(state.count===2&&contains(d.main2,term))))errors.push('Chybí požadované hlavní jídlo: '+term);
 for(const term of t.require_soup)if(!active.some(d=>contains(d.soup,term)))errors.push('Chybí požadovaná polévka: '+term);
 for(const [so,ma] of t.require_pair)if(!active.some(d=>contains(d.soup,so)&&(contains(d.main,ma)||(state.count===2&&contains(d.main2,ma)))))errors.push('Chybí požadovaná kombinace: '+so+' | '+ma);
 return [...new Set(errors)];
}
const rand=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function generate(){
 const week=monday($('date').value),active=state.week.days.map((d,i)=>d.closed?-1:i).filter(i=>i>=0);
 if(!active.length)throw Error('Není vybrán den vaření.');
 const t=txtRules(),r=state.rules,mainNames=[...new Set(all('main').map(x=>x.name))],soupNames=[...new Set(all('soup').map(x=>x.name))];
 const required=[];for(const k of ['fish','legumes','meatless'])for(let i=0;i<r[k];i++)required.push(k);
 const mon=mondayCat(week);if(active.includes(0)&&!required.includes(mon))required.push(mon);
 if(required.length>active.length*state.count)throw Error('Povinných druhů jídel je více než dostupných obědů.');
 const blockedMain=new Set(),blockedSoup=new Set();
 for(const h of state.history){const delta=(parseDate(week)-parseDate(h.week))/604800000;if(delta<=0)continue;for(const d of h.days||[]){if(d.closed)continue;if(delta<state.lockMain){if(d.main)blockedMain.add(d.main);if(d.main2)blockedMain.add(d.main2)}if(delta<state.lockSoup&&d.soup)blockedSoup.add(d.soup)}}
 let lastErrors=[];
 for(let attempt=0;attempt<700;attempt++){
  const days=Array.from({length:5},(_,i)=>({...freshDay(),closed:!active.includes(i)}));
  const usedM=new Set(),usedS=new Set(),must=[...required];let failed=false;
  for(const day of active){
   const wanted=day===0?mon:must[0];
   const candidates=weightedOrder(mainNames.filter(m=>!usedM.has(m)&&!blockedMain.has(m)&&!t.ban_main.some(x=>contains(m,x))&&(day!==0||mealType(m)===mon)),'main');
   const ordered=wanted?[...candidates.filter(m=>mealType(m)===wanted),...candidates.filter(m=>mealType(m)!==wanted)]:candidates;
   let chosen=null;
   for(const m of ordered){
    const ss=weightedOrder(soupNames.filter(so=>!usedS.has(so)&&!blockedSoup.has(so)&&!t.ban_soup.some(x=>contains(so,x))&&!t.ban_pair.some(([x,y])=>contains(so,x)&&contains(m,y))&&!(r.avoidLegumePair&&mealType(m)==='legumes'&&soupType(so)==='legumes')&&!(r.avoidFishPair&&mealType(m)==='fish'&&soupType(so)==='fish')),'soup');
    if(ss.length){chosen={m,s:weightedPick(ss,'pair',so=>pairKey(so,m))};break}
   }
   if(!chosen){failed=true;break}
   const d=days[day];d.closed=false;d.main=chosen.m;d.soup=chosen.s;usedM.add(chosen.m);usedS.add(chosen.s);
   const consumed=must.indexOf(mealType(chosen.m));if(consumed>=0)must.splice(consumed,1);
   if(state.count===2){
    const choices=mainNames.filter(m=>!usedM.has(m)&&!blockedMain.has(m)&&!t.ban_main.some(x=>contains(m,x))&&!t.ban_pair.some(([x,y])=>contains(chosen.s,x)&&contains(m,y))&&!(r.avoidLegumePair&&mealType(m)==='legumes'&&soupType(chosen.s)==='legumes')&&!(r.avoidFishPair&&mealType(m)==='fish'&&soupType(chosen.s)==='fish'));
    if(!choices.length){failed=true;break}
    const need=must[0],pool=need&&choices.some(m=>mealType(m)===need)?choices.filter(m=>mealType(m)===need):choices;
    d.main2=weightedPick(pool,'main');usedM.add(d.main2);
    const idx=must.indexOf(mealType(d.main2));if(idx>=0)must.splice(idx,1);
   }
  }
  if(failed||must.length)continue;
  const w={week,days},errors=validate(w);if(!errors.length)return w;lastErrors=errors;
 }
 throw Error('Nelze sestavit platný týden bez porušení pravidel. '+lastErrors.slice(0,3).join(' '));
}

function render(){
    const w=state.week;
    $('date').value=w.week;$('count').value=state.count;$('lockMain').value=state.lockMain;$('lockSoup').value=state.lockSoup;$('lockMainMobile').value=state.lockMain;$('lockSoupMobile').value=state.lockSoup;
    $('range').textContent=`${format(dateAt(w.week,0))} – ${format(dateAt(w.week,4))}`;
    $('days').replaceChildren();
    for(let i=0;i<5;i++){
        const d=w.days[i],section=document.createElement('section');section.className='day';
        const title=document.createElement('div');title.className='daytitle';title.textContent=`${weekdays[i]} ${format(dateAt(w.week,i))}`;
        section.append(title);
        if(d.closed){
            const note=document.createElement('div');note.className='closed';note.textContent='(nevaří se)';section.append(note)
        }else{
            const meal=(label,key)=>{
                const row=document.createElement('div');row.className='meal';
                const lab=document.createElement('strong');lab.textContent=label;
                const btn=document.createElement('button');btn.textContent=d[key]||'Vybrat jídlo…';
                btn.addEventListener('click',()=>openPicker(i,key));
                row.append(lab,btn);section.append(row)
            };
            meal('Polévka','soup');meal('Oběd 1','main');
            if(state.count===2)meal('Oběd 2','main2')
        }
        $('days').append(section);
        const checkbox=document.querySelector(`[data-day="${i}"]`);
        if(checkbox)checkbox.checked=!d.closed
    }
    renderRules();
    $('txtRules').value=state.txt;save();
    if($('days').children.length!==5)notice('Chyba vykreslení pěti dnů.',true)
}

let selectedHistory=null;
function historyRows(){
    const target=$('historyList');target.replaceChildren();
    const items=[...state.history].sort((a,b)=>b.week.localeCompare(a.week));
    for(const h of items){
        const b=document.createElement('button');b.className='history-item'+(selectedHistory===h.week?' selected':'');
        b.textContent=`${format(dateAt(h.week,0))} – ${format(dateAt(h.week,4))}`;
        b.onclick=()=>{selectedHistory=h.week;historyRows();historyDetail()};
        target.append(b)
    }
    if(!items.length)target.textContent='Historie je zatím prázdná.'
}

function historyDetail(){
 const h=state.history.find(x=>x.week===selectedHistory),el=$('historyPreview');el.replaceChildren();
 $('historyTitle').textContent=h?`Jídelníček ${format(dateAt(h.week,0))} – ${format(dateAt(h.week,4))}`:'Vyber uložený týden';
 for(const id of ['historyLoad','historyCopy','historyPrint','historyDelete'])$(id).disabled=!h;
 if(!h)return;
 for(let i=0;i<5;i++){
  const d=h.days[i]||{},day=document.createElement('section');day.className='history-day';
  const header=document.createElement('div');header.className='history-day-head';
  const name=document.createElement('strong');name.textContent=`${weekdays[i]} ${format(dateAt(h.week,i))}`;
  const closed=document.createElement('button');closed.type='button';closed.className='history-closed-toggle alt';closed.textContent=d.closed?(dateAt(h.week,i)<parseDate(iso(new Date()))?'Nevařilo se':'Nevaří se'):(dateAt(h.week,i)<parseDate(iso(new Date()))?'Vařilo se':'Vaří se');
  closed.onclick=()=>{snapshot();d.closed=!d.closed;render();historyDetail();notice('Stav vaření uložen do historie.');};
  header.append(name,closed);day.append(header);
  // Stejně jako v Pythonu: při Nevaří se skrýt VŠECHNA jídla,
  // ale ponechat je beze změny v datech pro případné opětovné zapnutí.
  if(!d.closed)for(const [key,label] of [['soup','Polévka'],['main','Oběd 1'],['main2','Oběd 2']]){
   if(key==='main2'&&!d.main2&&!d.category2&&!h.days.some(x=>x.main2))continue;
   const b=document.createElement('button');b.type='button';b.className='history-meal-edit';
   b.textContent=`${label}: ${d[key]||(key==='soup'?'[Vybrat polévku]':'[Vybrat jídlo]')}`;b.title='Kliknutím upravit přímo v historii';
   b.onclick=()=>openHistoryPicker(h.week,i,key);day.append(b);
  }
  el.append(day);
 }
}
function bestCatalogMatch(kind,name,cat=''){
 if(!name)return null;
 const items=all(kind),needle=norm(name).trim();
 const exact=items.find(x=>norm(x.name)===needle&&(!cat||x.cat===cat))||items.find(x=>norm(x.name)===needle);
 if(exact)return exact;
 const partial=items.filter(x=>norm(x.name).includes(needle)||needle.includes(norm(x.name)));
 if(partial.length)return partial.sort((a,b)=>Number(b.cat===cat)-Number(a.cat===cat)||Math.abs(a.name.length-name.length)-Math.abs(b.name.length-name.length))[0];
 const words=needle.split(/[^a-z0-9]+/).filter(w=>w.length>=4);
 const ranked=items.map(x=>({item:x,score:words.filter(w=>norm(x.name).includes(w)).length})).sort((a,b)=>b.score-a.score);
 return ranked[0]?.score>=2?ranked[0].item:null;
}
function openHistoryPicker(week,day,key){
 const h=state.history.find(x=>x.week===week);if(!h)return;
 const kind=key==='soup'?'soup':'main',d=h.days[day],currentName=d[key]||'',cat=key==='main'?'category':'category2';
 picking={day,key,kind,historyWeek:week};
 $('pickerTitle').textContent=`Historie – ${weekdays[day]} – ${key==='soup'?'Polévka':key==='main'?'Oběd 1':'Oběd 2'}`;
 $('pickerKind').value=kind;$('pickerKind').disabled=true;$('pickerKindLabel').hidden=false;
 $('pickerCategory').replaceChildren(new Option('VŠECHNY',''));$('search').value='';
 pickerSelected=bestCatalogMatch(kind,currentName,key==='soup'?'':d[cat]);
 $('pickerMealName').value=currentName;
 $('pickerChoose').hidden=false;
 renderChoices();$('picker').showModal();$('search').focus({preventScroll:true});requestAnimationFrame(()=>requestAnimationFrame(centerPickerSelection));
}
function historyMutation(fn,message){
 const h=state.history.find(x=>x.week===picking?.historyWeek);if(!h)throw Error('Historický týden již neexistuje.');
 snapshot();fn(h.days[picking.day]);render();historyDetail();notice(message);
}

function showHistory(week){
    selectedHistory=week||[...state.history].sort((a,b)=>b.week.localeCompare(a.week))[0]?.week||null;
    historyRows();historyDetail();
    $('historyDialog').showModal(); $('historyDialog').scrollTop=0
}

function chosenHistory(){return state.history.find(h=>h.week===selectedHistory)}

$('openHistory').onclick=()=>showHistory();
$('closeHistory').onclick=()=>$('historyDialog').close();
$('historyLoad').onclick=()=>safe(()=>{const h=chosenHistory();if(!h)return;snapshot();state.week=clone(h);state.count=h.days.some(d=>d.main2)?2:1;$('historyDialog').close();render();notice('Načtena pracovní kopie. Schválená historie se nezměnila.')});
// Vlastni kalendar pro kopirovani schvaleneho tydne.
let copySource=null,copyDate=null,copyMonth=null;
const copyDlg=$('copyWeekDialog');
let calendarMode='history';
$('openMainCalendar').onclick=()=>{
 calendarMode='main';copySource=null;
 copyDate=parseDate(state.week.week);copyMonth=new Date(copyDate.getFullYear(),copyDate.getMonth(),1);
 $('copyWeekTitle').textContent='Vybrat týden';
 $('copyConfirm').textContent='Nastavit týden';
 drawCopyCalendar();copyDlg.showModal();
};
function drawCopyCalendar(){
 const y=copyMonth.getFullYear(),m=copyMonth.getMonth(),start=new Date(y,m,1),offset=(start.getDay()+6)%7;
 $('copyMonthLabel').textContent=new Intl.DateTimeFormat('cs-CZ',{month:'long',year:'numeric'}).format(copyMonth);
 const grid=$('copyCalendar');grid.replaceChildren();
 const todayKey=iso(new Date()),selectedKey=iso(copyDate),weekKey=monday(selectedKey);
 for(let i=0;i<42;i++){
  const d=new Date(y,m,1-offset+i),key=iso(d),button=document.createElement('button');
  button.type='button';button.textContent=d.getDate();button.className='copy-cal-day';
  button.setAttribute('aria-label',new Intl.DateTimeFormat('cs-CZ',{dateStyle:'full'}).format(d));
  if(d.getMonth()!==m)button.classList.add('outside');
  if(monday(key)===weekKey&&d.getDay()!==0&&d.getDay()!==6)button.classList.add('in-week');
  if(key===todayKey){button.classList.add('is-today');button.setAttribute('aria-current','date')}
  if(key===selectedKey){button.classList.add('is-selected');button.setAttribute('aria-pressed','true')}
  button.onclick=()=>{copyDate=d;copyMonth=new Date(d.getFullYear(),d.getMonth(),1);drawCopyCalendar()};grid.append(button);
 }
 $('copyWeekRange').textContent='Cílový týden: '+format(parseDate(weekKey))+' – '+format(dateAt(weekKey,4));
 $('copyWeekWarning').textContent=state.history.some(h=>h.week===weekKey)?(calendarMode==='main'?'Tento týden už je ve schválené historii. Přepnutí vytvoří nový pracovní návrh; schválený týden zůstane zachovaný.':'Tento týden už je ve schválené historii. Kopie bude jen pracovní návrh; historie se nepřepíše.') : '';
}
$('copyPrevMonth').onclick=()=>{copyMonth=new Date(copyMonth.getFullYear(),copyMonth.getMonth()-1,1);drawCopyCalendar()};
$('copyNextMonth').onclick=()=>{copyMonth=new Date(copyMonth.getFullYear(),copyMonth.getMonth()+1,1);drawCopyCalendar()};
$('copyToday').onclick=()=>{copyDate=new Date();copyMonth=new Date(copyDate.getFullYear(),copyDate.getMonth(),1);drawCopyCalendar()};
$('copyCancel').onclick=()=>copyDlg.close();
$('copyConfirm').onclick=()=>safe(()=>{
 const target=monday(iso(copyDate));
 if(calendarMode==='main'){
  if(target===state.week.week){copyDlg.close();return}
  // Změna data nesmí bez dotazu zahodit načtený nebo rozepsaný pracovní jídelníček.
  pendingWeekTarget=target;
  $('changeWeekMessage').textContent='Přechod z týdne '+format(parseDate(state.week.week))+' na '+format(parseDate(target))+'. Co se má stát s aktuálně zobrazenými jídly?';
  copyDlg.close();$('changeWeekDialog').showModal();return;
 }
 const h=state.history.find(x=>x.week===copySource);if(!h)throw Error('Původní týden už není v historii.');
 snapshot();state.week=clone(h);state.week.week=target;state.count=h.days.some(d=>d.main2)?2:1;
 copyDlg.close();$('historyDialog').close();render();notice('Týden zkopírován jako pracovní návrh. Historie se nezměnila.');
});
let pendingWeekTarget=null;
function finishWeekChange(keepMeals){
 const target=pendingWeekTarget;pendingWeekTarget=null;
 $('changeWeekDialog').close();
 if(!target||target===state.week.week)return;
 snapshot();
 if(keepMeals){state.week=clone(state.week);state.week.week=target;}
 else state.week=freshWeek(target);
 render();notice(keepMeals?'Jídla zachována a převedena na týden '+format(parseDate(target))+'.':'Nastaven prázdný týden '+format(parseDate(target))+'.');
}
$('changeWeekKeep').onclick=()=>safe(()=>finishWeekChange(true));
$('changeWeekEmpty').onclick=()=>safe(()=>finishWeekChange(false));
$('changeWeekCancel').onclick=()=>{pendingWeekTarget=null;$('changeWeekDialog').close()};
$('changeWeekDialog').addEventListener('close',()=>{pendingWeekTarget=null});
$('historyCopy').onclick=()=>safe(()=>{
 const h=chosenHistory();if(!h)return;calendarMode='history';copySource=h.week;copyDate=new Date();copyMonth=new Date(copyDate.getFullYear(),copyDate.getMonth(),1);$('copyWeekTitle').textContent='Kopírovat do jiného týdne';$('copyConfirm').textContent='Kopírovat';
 drawCopyCalendar();copyDlg.showModal();
});
$('historyDelete').onclick=()=>safe(()=>{const h=chosenHistory();if(!h)return;if(!confirm('Opravdu smazat schválený týden '+format(dateAt(h.week,0))+'? Změnu lze vrátit tlačítkem Zpět.'))return;snapshot();state.history=state.history.filter(x=>x.week!==h.week);selectedHistory=[...state.history].sort((a,b)=>b.week.localeCompare(a.week))[0]?.week||null;render();historyRows();historyDetail();notice('Týden smazán z historie. '+(selectedHistory?'Vybrán nejnovější zbývající týden. ':'Historie je prázdná. ')+'Lze vrátit tlačítkem Zpět.')});
$('historyPrint').onclick=()=>safe(()=>{const h=chosenHistory();if(!h)return;const previous=clone(state.week),count=state.count;printingHistory=true;try{state.week=clone(h);state.count=h.days.some(d=>d.main2)?2:1;render();$('historyDialog').close();window.print()}finally{state.week=previous;state.count=count;render();printingHistory=false}notice('Připraven tisk vybraného týdne.')});

// Samostatný přenos historie mezi WEBem a Pythonem (pole týdnů JSON).
function validHistoryRecords(data){
 if(!Array.isArray(data))throw Error('Soubor musí obsahovat pouze seznam týdnů historie JSON. Nepoužívejte kompletní zálohu aplikace.');
 const seen=new Set();
 for(const [i,h] of data.entries()){
  if(!h||typeof h!=='object'||Array.isArray(h)||typeof h.week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(h.week)||!Array.isArray(h.days)||h.days.length!==5)throw Error(`Neplatný týden historie na pozici ${i+1}.`);
  const date=parseDate(h.week);
  if(Number.isNaN(date.getTime())||iso(date)!==h.week||date.getDay()!==1)throw Error(`Neplatné pondělí týdne ${h.week}.`);
  if(seen.has(h.week))throw Error(`Duplicitní týden ${h.week}.`);seen.add(h.week);
  for(const [j,d] of h.days.entries()){
   if(!d||typeof d!=='object'||Array.isArray(d))throw Error(`Neplatný den ${j+1} týdne ${h.week}.`);
   for(const field of ['soup','main','main2','category','category2'])if(field in d&&typeof d[field]!=='string')throw Error(`Neplatné pole ${field} týdne ${h.week}.`);
   if('closed' in d&&typeof d.closed!=='boolean')throw Error(`Neplatný příznak closed týdne ${h.week}, den ${j+1}.`);
  }
 }
 return data.map(h=>({...clone(h),days:h.days.map(d=>({...freshDay(),...d,closed:typeof d.closed==='boolean'?d.closed:false}))}));
}
$('exportHistory').onclick=()=>safe(()=>{
 const records=validHistoryRecords(state.history);
 download('historie_jidelnicku_'+iso(today)+'.json',JSON.stringify(records,null,2),'application/json;charset=utf-8');
 notice(`Exportována pouze historie: ${records.length} týdnů. Soubor lze importovat i v Pythonu.`);
});
$('importHistory').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  const incoming=validHistoryRecords(JSON.parse(await f.text()));
  if(!incoming.length)throw Error('Importovaná historie je prázdná. Přepsání bylo z bezpečnostních důvodů zrušeno.');
  const oldHistory=clone(state.history);
  if(!confirm(`Načteno ${incoming.length} týdnů historie.\nSoučasná WEB historie: ${oldHistory.length} týdnů.\n\nANO = zálohovat původní historii a NAHRADIT všechny týdny.\nNE = nic neměnit.\n\nKatalog, pravidla a pracovní týden zůstanou zachované.`))return;
  // Trvalá lokální záloha navíc ke staženému souboru; při nemožnosti uložit import zastavit.
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const backupJson=JSON.stringify(oldHistory,null,2);
  try{localStorage.setItem('jidelnicky_historie_pred_importem',backupJson)}catch(err){throw Error('Nepodařilo se bezpečně uložit místní zálohu historie. Import zrušen: '+err.message)}
  download(`historie_jidelnicku_pred_importem_${stamp}.json`,backupJson,'application/json;charset=utf-8');
  snapshot();state.history=incoming;
  if(selectedHistory&&!state.history.some(h=>h.week===selectedHistory))selectedHistory=[...state.history].sort((a,b)=>b.week.localeCompare(a.week))[0]?.week||null;
  render();if($('historyDialog')?.open){historyRows();historyDetail()}
  notice(`Historie nahrazena (${incoming.length} týdnů). Záloha historie nabídnuta ke stažení a uložena v prohlížeči. GitHub: čeká na synchronizaci.`);
 }catch(err){notice(err.message,true)}finally{e.target.value=''}
};

const ruleNames={fish:'Ryby – minimálně',legumes:'Luštěniny – minimálně',meatless:'Bezmasá – minimálně',sweetMax:'Sladká – maximálně',avoidLegumePair:'Ne kombinace luštěnina + luštěnina',avoidFishPair:'Ne kombinace ryba + rybí polévka'};
function renderRules(){
    const el=$('rules');el.replaceChildren();
    for(const [key,label] of Object.entries(ruleNames)){
        const row=document.createElement('label');row.className='rule';
        const span=document.createElement('span');span.textContent=label;
        const input=document.createElement('input');input.dataset.rule=key;
        if(typeof defaults[key]==='boolean'){input.type='checkbox';input.checked=!!state.rules[key]}
        else{input.type='number';input.min='0';input.max='5';input.value=state.rules[key]}
        row.append(span,input);el.append(row)
    }
}

let picking=null,pickerSelected=null;
function openPicker(day,key){
    picking={day,key,kind:key==='soup'?'soup':'main'};
    $('pickerChoose').hidden=false;
    $('pickerTitle').textContent=`${weekdays[day]} – ${key==='soup'?'Polévka':key==='main'?'Oběd 1':'Oběd 2'}`;
    $('pickerKind').value=picking.kind;$('pickerKind').disabled=true;$('pickerKindLabel').hidden=false;$('pickerCategory').replaceChildren(new Option('VŠECHNY',''));$('search').value='';$('pickerCategory').value='';const currentName=state.week.days[day]?.[key]||'';
    const currentCat=key==='soup'?null:state.week.days[day]?.[key==='main'?'category':'category2'];
    const match=bestCatalogMatch(picking.kind,currentName,currentCat);
    pickerSelected=match?{name:match.name,cat:match.cat}:null;
    $('pickerMealName').value=currentName;
    renderChoices();$('picker').showModal();$('search').focus({preventScroll:true});
    // Po otevření posuň pouze seznam jídel, aby byl aktuální výběr uprostřed.
    requestAnimationFrame(()=>requestAnimationFrame(centerPickerSelection))
}

function centerPickerSelection(){
    const list=$('choices'),selected=list.querySelector('.choice.selected');
    if(!selected)return;
    // U mobilu i PC počkej na rozměry otevřeného dialogu.
    if(!list.clientHeight){requestAnimationFrame(centerPickerSelection);return;}
    const target=list.scrollTop+selected.getBoundingClientRect().top-list.getBoundingClientRect().top;
    list.scrollTop=Math.max(0,Math.min(list.scrollHeight-list.clientHeight,target));
}

function renderChoices(){
    const kind=picking.kind,q=norm($('search').value.trim()),catFilter=$('pickerCategory').value,el=$('choices');el.replaceChildren();
    const cats=[];const categorySelect=$('pickerCategory');
    if(categorySelect.options.length!==cats.length+1||cats.some((c,i)=>categorySelect.options[i+1]?.value!==c)){categorySelect.replaceChildren();categorySelect.add(new Option('VŠECHNY',''));for(const cat of cats)categorySelect.add(new Option(cat,cat));categorySelect.value=cats.includes(catFilter)?catFilter:'';}
    const current=picking.day===null?null:(picking.historyWeek?state.history.find(h=>h.week===picking.historyWeek)?.days[picking.day]:state.week.days[picking.day]);
    // Presny podretezec nazvu NEBO kategorie, bez diakritiky; bez fuzzy shod a aliasu.
    const options=all(kind).filter(x=>(!categorySelect.value||x.cat===categorySelect.value)&&contains(x.name,q)).filter(x=>!current||picking.key==='soup'||(picking.key==='main'?norm(x.name)!==norm(current.main2):norm(x.name)!==norm(current.main)));
    options.sort((a,b)=>a.name.localeCompare(b.name,'cs')||a.cat.localeCompare(b.cat,'cs'));
    const duplicateNames=new Map();
    for(const item of options){const key=norm(item.name);duplicateNames.set(key,(duplicateNames.get(key)||0)+1)}
    for(const item of options){
        const btn=document.createElement('button');btn.type='button';btn.className='choice';btn.dataset.meal=item.name;btn.dataset.category=item.cat;
        btn.textContent=item.name;
        if(pickerSelected?.name===item.name&&pickerSelected?.cat===item.cat){btn.classList.add('selected');btn.setAttribute('aria-pressed','true')}
        else btn.setAttribute('aria-pressed','false');
        btn.onclick=()=>{pickerSelected={name:item.name,cat:item.cat};$('pickerMealName').value=item.name;renderChoices();requestAnimationFrame(centerPickerSelection)};
        el.append(btn);
    }
    if(!options.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='Žádné odpovídající jídlo.';el.append(empty)}
}


function suggestMealCategory(kind,name){
 const cats=Object.keys(state.catalog[kind]||{});
 const words=norm(name).split(/[^a-z0-9]+/).filter(w=>w.length>=4);
 const hints=kind==='soup'?
  {'VÝVARY':['vyvar','hovezi','kureci','ovarova'],'LUŠTĚNINOVÉ A MASOVÉ':['cockova','fazolova','hrachova','cizrnova','gulasova','lusteninova'],'ZELENINOVÉ A KRÉMOVÉ':['krem','zeleninova','brokolicova','bramborova','rajcatova','cesnekova','kvetakova']}:
  {'RYBY':['rybi','ryba','losos','file','treska','kapr'],'LUŠTĚNINOVÁ':['cocka','fazole','fazolovy','cizrna','hrach','lusteniny'],'SLADKÁ':['buchty','buchticky','zemlovka','livance','palacinky','makem','krupicova'],'HOVĚZÍ A TELECÍ':['hovezi','teleci','svickova'],'VEPŘOVÉ A UZENÉ':['veprove','veprova','veprovy','uzene','krkovice'],'DRŮBEŽ A KRÁLÍK':['kure','kureci','kruti','kralik','drubezi'],'MLETÉ MASO A ZAPÉKANÉ':['sekana','karbanatek','zapekane','mlete'],'BEZMASÁ SLANÁ':['syr','zeleninove','bramboraky','testoviny']};
 const scored=cats.map(cat=>{
  let score=0;
  for(const item of state.catalog[kind][cat]||[]){
   const itemWords=new Set(norm(item).split(/[^a-z0-9]+/).filter(w=>w.length>=4));
   for(const word of words)if(itemWords.has(word))score+=2;
  }
  for(const hint of hints[cat]||[])if(norm(name).includes(hint))score+=12;
  return {cat,score};
 }).sort((a,b)=>b.score-a.score);
 return scored[0]?.score>0?scored[0].cat:'';
}
function confirmNewMealCategory(kind,name){
 const cat=kind==='soup'?'__POLEVKY__':'__HLAVNI__';
 if(!state.catalog[kind][cat])state.catalog[kind][cat]=[];
 const value=String(name||'').trim();
 return Promise.resolve(value.length>=2?{cat,name:value}:null);
}


async function pickerCatalogEdit(operation){
 try {
 const kind=picking.kind,name=$('pickerMealName').value.trim();
 if(picking.historyWeek){
  const field=picking.key,categoryField=field==='main'?'category':'category2';
  const old=state.history.find(h=>h.week===picking.historyWeek)?.days[picking.day]?.[field]||'';
  if(operation==='remove'){
   if(!old)return notice('Jídlo je již prázdné.');
   if(!confirm(`Opravdu smazat „${old}“ z tohoto dne historie?`))return;
   historyMutation(d=>{d[field]='';if(kind==='main')d[categoryField]='';},'Jídlo smazáno pouze z historie.');
   $('picker').close();return;
  }
  if(name.length<2)throw Error('Zadej název jídla.');
  if(operation==='rename'){
   // Přejmenování katalogové položky je transakční: katalog, všechny přesné
   // výskyty v historii a pracovní týden se mění v jednom snapshotu.
   const chosen=pickerSelected;
   const items=chosen&&state.catalog[kind]?.[chosen.cat];
   if(!chosen||!items?.includes(chosen.name))throw Error('Přejmenování v databázi vyžaduje označené existující jídlo. Pokud chybí, nejprve ho přidej.');
   if(items.some(x=>x!==chosen.name&&norm(x)===norm(name)))throw Error('Nový název už existuje.');
   const original=chosen.name,category=chosen.cat;
   if(original===name&&old===name)return notice('Název se nezměnil.');
   const targetWeek=state.history.find(h=>h.week===picking.historyWeek);
   if(!targetWeek)throw Error('Historický týden již neexistuje.');
   snapshot();
   items[items.indexOf(original)]=name;
   items.sort((a,b)=>a.localeCompare(b,'cs'));
   const changeDay=(d)=>{
    if(kind==='soup'){if(d.soup===original)d.soup=name;}
    else {
     if(d.main===original&&d.category===category)d.main=name;
     if(d.main2===original&&d.category2===category)d.main2=name;
    }
   };
   for(const week of state.history)for(const day of week.days)changeDay(day);
   for(const day of state.week.days)changeDay(day);
   // U kliknutého historického záznamu oprav také odlišný starý název.
   const target=targetWeek.days[picking.day];target[field]=name;
   if(kind==='main')target[categoryField]='';
   render();historyDetail();notice('Přejmenováno v katalogu i historii. Změny čekají na synchronizaci GitHubu.');
   $('picker').close();return;
  }
  if(operation==='add'){
   // Dialog se zobrazí vždy, i když jídlo už v katalogu existuje.
   // Potvrzená existující položka se neduplikuje, pouze přiřadí do historie.
   const entry=await confirmNewMealCategory(kind,name);
   if(!entry)return;
   const {cat,name:newName}=entry;
   if(!state.catalog[kind]?.[cat])throw Error('Nelze uložit jídlo.');
   const existing=state.catalog[kind][cat].find(x=>norm(x)===norm(newName));
   historyMutation(d=>{
    if(!existing){state.catalog[kind][cat].push(newName);state.catalog[kind][cat].sort((a,b)=>a.localeCompare(b,'cs'));}
    d[field]=existing||newName;if(kind==='main')d[categoryField]='';
   },existing?'Existující jídlo přiřazeno do historie.':'Jídlo přidáno do historie i katalogu.');
   $('picker').close();return;
  }
 }

 let cat=$('pickerCategory').value;
 if(operation==='add'){
  if(name.length<2)throw Error('Zadej název nového jídla.');
  const entry=await confirmNewMealCategory(kind,name);
  if(!entry)return;
  cat=entry.cat;
  const newName=entry.name;
  if(!state.catalog[kind]?.[cat])throw Error('Nelze uložit jídlo.');
  if(all(kind).some(x=>norm(x.name)===norm(newName)))throw Error('Jídlo už existuje.');
  snapshot();state.catalog[kind][cat].push(newName);state.catalog[kind][cat].sort((a,b)=>a.localeCompare(b,'cs'));pickerSelected={name:newName,cat};
 }else{
  if(!pickerSelected)throw Error('Nejdříve označ jídlo v seznamu.');
  const {name:oldName,cat:oldCat}=pickerSelected,items=state.catalog[kind]?.[oldCat];
  if(!items?.includes(oldName))throw Error('Vybrané jídlo už není v databázi.');
  if(operation==='rename'){
   if(name.length<2)throw Error('Zadej nový název.');
   if(items.some(x=>x!==oldName&&norm(x)===norm(name)))throw Error('Jídlo už existuje.');
   if(name===oldName)return notice('Název se nezměnil.');
   snapshot();items[items.indexOf(oldName)]=name;
   for(const week of state.history)for(const day of week.days){
    if(kind==='soup'&&day.soup===oldName)day.soup=name;
    if(kind==='main'){
     if(day.main===oldName&&day.category===oldCat)day.main=name;
     if(day.main2===oldName&&day.category2===oldCat)day.main2=name;
    }
   }

   for(const day of state.week.days){if(kind==='soup'&&day.soup===oldName)day.soup=name;if(kind==='main'){if(day.main===oldName&&day.category===oldCat)day.main=name;if(day.main2===oldName&&day.category2===oldCat)day.main2=name}}
   pickerSelected={name,cat:oldCat};
  }else{
   if(!confirm(`Opravdu smazat jídlo „${oldName}“ z databáze?`))return;
   snapshot();items.splice(items.indexOf(oldName),1);pickerSelected=null;$('pickerMealName').value='';
  }
  items.sort((a,b)=>a.localeCompare(b,'cs'));
 }
 render();renderChoices();notice(operation==='add'?'Jídlo přidáno.':operation==='rename'?'Jídlo přejmenováno.':'Jídlo smazáno.');
} catch(e){notice(e.message||String(e),true)}
}
$('pickerChoose').onclick=()=>safe(()=>{
 if(!picking||!pickerSelected)throw Error('Nejdříve označ jídlo nebo polévku v seznamu.');
 const item=pickerSelected,kind=picking.kind;
 if(picking.historyWeek){
  const field=picking.key,categoryField=field==='main'?'category':'category2';
  historyMutation(d=>{d[field]=item.name;if(kind==='main')d[categoryField]=item.cat;},'Jídlo změněno přímo v historii.');
  $('picker').close();return;
 }

 if(!state.catalog[kind]?.[item.cat]?.includes(item.name))throw Error('Vybrané jídlo již není v databázi.');
 if(picking.day===0&&picking.key==='main'&&!state.week.days[0].closed&&!starts(item.cat,mondayCat(state.week.week))){
  const expected=mondayCat(state.week.week)==='RYBY'?'rybí':'luštěninové';
  if(!confirm(`Pondělní Oběd 1 by měl být podle posledního schváleného pondělí ${expected}.\n\nOpravdu chcete vědomě povolit výjimku a vybrat „${item.name}“?`))return;
 }
 const d=state.week.days[picking.day],oldName=d[picking.key];
 if(oldName===item.name){$('picker').close();return}
 snapshot();const beforeSoup=d.soup,beforeMain=d.main;
 if(oldName)learn(kind,oldName,-1);
 learn(kind,item.name,1);
 if(beforeSoup&&beforeMain)learn('pair',pairKey(beforeSoup,beforeMain),-1);
 d[picking.key]=item.name;
 if(kind==='main')d[picking.key==='main'?'category':'category2']='';
 if(d.soup&&d.main)learn('pair',pairKey(d.soup,d.main),1);
 $('picker').close();render();notice('Jídlo upraveno; preference se učí z ručních výměn.');
});
$('pickerAdd').onclick=()=>pickerCatalogEdit('add');
$('pickerRename').onclick=()=>pickerCatalogEdit('rename');
$('pickerRemove').onclick=()=>pickerCatalogEdit('remove');
function csv(){
    const rows=[['Den','Datum','Polévka','Oběd 1','Oběd 2']];
    state.week.days.forEach((d,i)=>rows.push([weekdays[i],format(dateAt(state.week.week,i)),d.closed?'(nevaří se)':d.soup,d.closed?'':d.main,d.closed?'':state.count===2?d.main2:'']));
    const quote=x=>'"'+String(x??'').replaceAll('"','""')+'"';
    download('jidelnicek_'+state.week.week+'.csv','\ufeff'+rows.map(r=>r.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8')
}

function safe(fn){try{fn()}catch(e){console.error(e);notice(e.message||'Nastala chyba.',true)}}

$('generate').onclick=()=>safe(()=>{const proposal=generate();snapshot();state.week=proposal;render();notice('Vygenerováno pět dnů jídelníčku.')});
$('approve').onclick=()=>safe(()=>{
    const active=state.week.days.filter(d=>!d.closed);
    if(!active.length)throw Error('Nelze schválit: není vybrán žádný den vaření.');
    if(active.some(d=>!d.soup||!d.main||(state.count===2&&!d.main2)))throw Error('Nelze schválit: některému dni chybí polévka nebo oběd.');
    const errors=validate(state.week);
    if(errors.length&&!confirm('Kontrola zjistila následující rozpory:\n\n• '+errors.join('\n• ')+'\n\nOK = přesto schválit a uložit\nZrušit = vrátit se k úpravám'))return;
    if(state.history.some(h=>h.week===state.week.week)&&!confirm('Tento týden už je v historii. Opravdu přepsat schválenou verzi?'))return;
    snapshot();state.history=state.history.filter(h=>h.week!==state.week.week);state.history.push(clone(state.week));render();notice(errors.length?'Jídelníček schválen s vědomou výjimkou a uložen do historie.':'Jídelníček schválen a uložen do historie.');
});
$('validate').onclick=()=>safe(()=>{const e=validate();notice(e.length?e.join(' · '):'Jídelníček splňuje nastavená pravidla.',!!e.length)});

$('undo').onclick=()=>{if(!undo.length)return notice('Není co vrátit.');redo.push(clone(state));state=undo.pop();render();notice('Změna vrácena.')};
$('redo').onclick=()=>{~redo.length||notice('Není co zopakovat.');if(!redo.length)return;undo.push(clone(state));state=redo.pop();render();notice('Změna zopakována.')};
$('date').onchange=()=>safe(()=>{snapshot();state.week=freshWeek($('date').value);render()});
$('count').onchange=()=>safe(()=>{snapshot();state.count=+$('count').value;render()});
for(const key of ['lockMain','lockSoup'])$(key).onchange=()=>{snapshot();state[key]=Math.max(0,Math.min(20,Number($(key).value)||0));render()};
for(const key of ['lockMain','lockSoup'])$(key+'Mobile').onchange=()=>{snapshot();state[key]=Math.max(0,Math.min(20,Number($(key+'Mobile').value)||0));render()};
document.querySelectorAll('[data-day]').forEach(input=>input.onchange=()=>{snapshot();const d=state.week.days[+input.dataset.day];d.closed=!input.checked;if(d.closed){d.soup='';d.main='';d.category='';d.main2='';d.category2=''}render()});
$('saveRules').onclick=()=>safe(()=>{const rules={};for(const input of document.querySelectorAll('[data-rule]'))rules[input.dataset.rule]=input.type==='checkbox'?input.checked:Math.max(0,Math.min(5,Number(input.value)||0));const txt=$('txtRules').value;const previous=state.txt;state.txt=txt;try{txtRules()}catch(e){state.txt=previous;throw e}state.txt=previous;snapshot();state.txt=txt;state.rules=rules;render();save();notice('Pravidla uložena.')});
$('pickerKind').onchange=()=>{if(picking?.day!==null)return;picking.kind=$('pickerKind').value;pickerSelected=null;$('pickerMealName').value='';$('pickerCategory').replaceChildren(new Option('VŠECHNY',''));renderChoices()};
$('search').oninput=()=>{pickerSelected=null;renderChoices()};
$('pickerCategory').onchange=renderChoices;
$('closePicker').onclick=()=>$('picker').close();
$('csv').onclick=csv;
$('print').onclick=()=>window.print();
$('backup').onclick=()=>download('jidelnicky_zaloha_'+iso(today)+'.json',JSON.stringify({format:'jidelnicky-static-v1',state},null,2),'application/json;charset=utf-8');
$('restore').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
        const imported=JSON.parse(await file.text());const next=imported.state;
        if(imported.format!=='jidelnicky-static-v1'||!next?.catalog?.main||!next?.catalog?.soup||!Array.isArray(next?.history)||next?.week?.days?.length!==5)throw Error('Neplatná záloha jídelníčků.');
        if(!confirm('Import přepíše aktuální data v tomto prohlížeči. Pokračovat?'))return;
        snapshot();state=next;state.learning=cleanLearning(state.learning);state.rules={...defaults,...state.rules};render();notice('Záloha načtena.')
    }catch(err){notice(err.message,true)}finally{e.target.value=''}
};

// Funkce pro parsování TXT katalogu (skolni_obedy.txt) do struktury state.catalog
async function loadTxtCatalogIntoState() {
    try {
        let res = await fetch('skolni_obedy.txt');
        if (res.ok) {
            let text = await res.text();
            let parsed = { soup: {}, main: {} };
            let currentKind = null;
            let currentCat = null;
            for (let line of text.split(/\r?\n/)) {
                line = line.trim();
                if (!line) continue;
                let match = line.match(/^(POLÉVKY|HLAVNÍ JÍDLA)\s*[–-]\s*(.+?)\s*\(\d+\)\s*$/i);
                if (match) {
                    currentKind = match[1].toUpperCase().startsWith('POLÉVKY') ? 'soup' : 'main';
                    currentCat = match[2].trim().toUpperCase();
                    if (!parsed[currentKind][currentCat]) parsed[currentKind][currentCat] = [];
                    continue;
                }
                if (line.startsWith('-') && currentKind && currentCat) {
                    let mealName = line.replace(/^-\s*/, '').trim();
                    if (mealName && !parsed[currentKind][currentCat].includes(mealName)) {
                        parsed[currentKind][currentCat].push(mealName);
                    }
                }
            }
            if (Object.keys(parsed.main).length > 0) {
                for(const kind of ['soup','main']) for(const [category,items] of Object.entries(parsed[kind])) { const existing=state.catalog[kind][category]||[]; state.catalog[kind][category]=[...new Set([...existing,...items])].sort((a,b)=>a.localeCompare(b,'cs')); }
            }
        }
    } catch (e) {
        console.log('TXT katalog nebyl načten přes fetch (spuštěno lokálně přes file://), používá se výchozí katalog.');
    }
}


// Spuštění aplikace – načtení katalogu, historie a prvního jídelníčku
window.addEventListener('DOMContentLoaded', async () => {
    if(!hasSavedState){
    await loadTxtCatalogIntoState();

    try {
        const resHist = await fetch('historie_jidelnicku.json');

        if (resHist.ok) {
            const jsonHistory = await resHist.json();

            if (Array.isArray(jsonHistory) && jsonHistory.length > 0) {
                const seen = new Set(state.history.map(h => h.week));

                for (const h of jsonHistory) {
                    if (!seen.has(h.week)) {
                        state.history.push(h);
                        seen.add(h.week);
                    }
                }
            }
        }
    } catch (e) {
        console.log('Automatické načtení historie nebylo možné.', e);
    }

    } // výchozí TXT a historie pouze při prvním spuštění
    // Při prvním spuštění zůstává pracovní týden prázdný pro ruční výběr.
    // Tlačítko Generovat jej může kdykoli vyplnit automaticky.
    render();
    // Nejprve dokončíme první načtení z GitHubu. Jinak by vzdálená data
    // mohla následně přepsat uživatelem zvolený aktuální týden.
    try {
        await window.GitHubSync?.start(window.JidelnickyApp);
    } catch (e) {
        console.error('Počáteční synchronizace selhala:', e);
        notice('Synchronizace se nezdařila; místní data zůstala zachována.', true);
    }
    // Po dokončení synchronizace nabídnout nejbližší budoucí pondělí bez dotazu.
    // Uložená historie se nemění; předchozí pracovní stav je v relaci
    // dostupný přes tlačítko Zpět.
    const current = preparationWeek();
    if (state.week.week !== current) {
        snapshot();
        state.week = freshWeek(current);
        render();
        save();
    }
});
})();

// v44: kliknutí na backdrop zavře dialog bez spuštění potvrzovacích akcí.
// Používáme hranice dialogu, nikoli target===dialog (vnitřní padding může být také dialog).
for (const dlg of document.querySelectorAll('dialog')) {
  dlg.addEventListener('click', (event) => {
    if (event.button !== 0 || !dlg.open) return;
    const r = dlg.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right ||
        event.clientY < r.top || event.clientY > r.bottom) {
      dlg.close();
    }
  });
}
