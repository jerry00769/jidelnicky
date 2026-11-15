/* Read-only lookup of the last historical occurrence. No storage or network writes. */
(function(root){
'use strict';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs-CZ').replace(/[^a-z0-9]+/g,' ').trim();
// Search-only vocabulary: original recipe names and dates are never rewritten.
const wordFamilies={
 zeli:'zeli zelim',klobasa:'klobasa klobasu klobasy klobasou klobas klobasam klobasami',
 brambora:'brambora brambory brambor bramborem bramboram bramborami bramborech bramboru',
 maso:'maso masa masem masu',kase:'kase kasi kasemi',ryze:'ryze ryzi',
 kure:'kure kurete kuretem kureta kureci kurecim kurecich kurecimi kureciho kurecimu',
 hovezi:'hovezi hovezim hovezich hovezimi hoveziho hovezimu',
 kruta:'kruta kruty krutim kruti krutich krutimi krutiho krutimu',
 cesnek:'cesnek cesneku cesnekem',cibule:'cibule cibuli cibulky cibulkou cibulka',
 rajce:'rajce rajcata rajcat rajcaty rajcatem rajcatova rajcatove rajcatovy rajcatovou',
 mrkev:'mrkev mrkve mrkvi',hrach:'hrach hrachu hrachem hrasek hrasku hraskem',
 cocka:'cocka cocky cockou cocce',fazole:'fazole fazoli fazolemi',
 houba:'houba houby hub houbami houbou',zampion:'zampion zampiony zampionu zampionech zampionem',
 kopr:'kopr kopru koprem',spenat:'spenat spenatu spenatem',kvetak:'kvetak kvetaku kvetakem',
 brokolice:'brokolice brokolici',celer:'celer celeru celerem',porek:'porek porku porkem',
 dyne:'dyne dyni',smetana:'smetana smetany smetanou smetane',
 vejce:'vejce vajicko vajicka vejci vejcem vejcemi vajickem',
 syr:'syr syra syrem syry syru',slanina:'slanina slaniny slaninou',parek:'parek parky parku parkem',
 ryba:'ryba ryby rybou rybami rybi rybim rybich rybimi',
 knedlik:'knedlik knedliky knedliku knedlikem knedlicky knedlicku knedlickem',
 rizek:'rizek rizky rizku rizkem rizecky rizecku',
 testovina:'testovina testoviny testovin testovinami',spageta:'spageta spagety spaget spaghetti',
 rizoto:'rizoto rizota rizotem risotto',polevka:'polevka polevky polevku polevkou',omacka:'omacka omacky omacku omackou',
 kapusta:'kapusta kapusty kapustou',
};
const adjectiveStems={zeli:'zeln',klobasa:'klobasov',brambora:'bramborov',ryze:'ryzov',cesnek:'cesnekov',cibule:'cibulov',rajce:'rajsk',mrkev:'mrkvov',hrach:'hrachov hraskov',cocka:'cockov',fazole:'fazolov',houba:'houbov',zampion:'zampionov',kopr:'koprov',spenat:'spenatov',kvetak:'kvetakov',brokolice:'brokolicov',celer:'celerov',porek:'porkov',dyne:'dynov',smetana:'smetanov',vejce:'vajecn vajeckov',syr:'syrov',slanina:'slaninov',parek:'parkov',knedlik:'knedlikov',testovina:'testovinov',kapusta:'kapustov',veprove:'veprov',pecene:'pecen',smazene:'smazen',zapecene:'zapecen',varene:'varen',kysane:'kysan',zelenina:'zeleninov'};
const familyWords=new Map();
for(const [key,words] of Object.entries(wordFamilies))for(const word of words.split(' '))familyWords.set(word,key);
for(const [key,stems] of Object.entries(adjectiveStems))for(const stem of stems.split(' '))for(const ending of ['a','e','y','ou','eho','emu','em','ym','ych','ymi'])familyWords.set(stem+ending,key);
const aliases={zelnacka:['polevka','zeli'],zelnacku:['polevka','zeli'],zelnacky:['polevka','zeli'],cesnecka:['polevka','cesnek'],bramboracka:['polevka','brambora'],hrachovka:['polevka','hrach'],cockovka:['polevka','cocka'],smazak:['smazene','syr'],knedlo:['knedlik'],zelo:['zeli'],vepro:['veprove']};
const stopWords=new Set(['s','se','z','ze','a','i','na','v','ve','do','k','ke','po','pod','nad','u']);
function analyze(value,kind){
 const words=normalize(value).split(' ').filter(Boolean),positive=new Set(),negative=new Set();let negated=false;
 for(const word of words){
  if(word==='bez'){negated=true;continue}
  if(stopWords.has(word))continue;
  for(const concept of aliases[word]||[familyWords.get(word)||word])(negated?negative:positive).add(concept);
  negated=false;
 }
 if(kind==='soup')positive.add('polevka');
 return {positive:[...positive],negative:[...negative]};
}
const localToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const dateAt=(week,i)=>new Date(Date.parse(week+'T12:00:00Z')+i*86400000).toISOString().slice(0,10);
const organization=value=>/^(?:p\s*r\s*a\s*z\s*d\s*n\s*i\s*n\s*y|reditelske volno|nevari se|nevarilo se|statni svatek|dovolena)$/i.test(normalize(value));
function buildIndex(state,today=localToday(),data=root.JidelnickyData){
 const groups=new Map();let first=null,last=null,servedDays=new Set();
 for(const w of state?.history||[]){
  if(w.status==='draft'||!/^\d{4}-\d{2}-\d{2}$/.test(w.week)||!Number.isFinite(Date.parse(w.week+'T12:00:00Z')))continue;
  for(const [i,d] of (w.days||[]).entries()){
   if(i>4||!d||d.closed)continue;
   const date=dateAt(w.week,i);if(date>today)continue;
   for(const field of ['soup','main','main2']){
    const name=d[field];if(typeof name!=='string'||!name.trim()||organization(name)||data?.organization?.(name))continue;
    const kind=field==='soup'?'soup':'main',key=kind+'\0'+name;
    if(!groups.has(key))groups.set(key,{key,name,kind,normalized:normalize(name),meaning:analyze(name,kind),occurrences:[]});
    const group=groups.get(key);let hit=group.occurrences.find(h=>h.date===date);
    if(!hit){hit={date,week:w.week,day:i,slots:[],verified:!!data?.isDayVerified?.(state,w,i)};group.occurrences.push(hit)}
    if(!hit.slots.includes(field))hit.slots.push(field);
    servedDays.add(date);if(!first||date<first)first=date;if(!last||date>last)last=date;
   }
  }
 }
 const items=[...groups.values()];
 for(const group of items){group.occurrences.sort((a,b)=>b.date.localeCompare(a.date));group.last=group.occurrences[0]}
 items.sort((a,b)=>b.last.date.localeCompare(a.last.date)||a.name.localeCompare(b.name,'cs'));
 return {items,first,last,servedDays:servedDays.size,today};
}
function distance(a,b,limit){
 if(Math.abs(a.length-b.length)>limit)return limit+1;
 let previous=Array.from({length:b.length+1},(_,i)=>i),before=null;
 for(let i=1;i<=a.length;i++){
  const row=[i];let best=i;
  for(let j=1;j<=b.length;j++){
   let value=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]!==b[j-1]));
   if(before&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])value=Math.min(value,before[j-2]+1);
   row[j]=value;best=Math.min(best,value);
  }
  if(best>limit)return limit+1;before=previous;previous=row;
 }
 return previous[b.length];
}
function search(index,query='',kind='all'){
 const q=normalize(String(query).slice(0,120)),terms=[...new Set(q.split(' ').filter(Boolean))];
 const candidates=index.items.filter(item=>kind==='all'||item.kind===kind);
 const wanted=analyze(q),meaningful=terms.filter(term=>!stopWords.has(term)),effective=meaningful.length?meaningful:terms;
 const compatible=item=>wanted.positive.every(term=>!item.meaning.negative.includes(term))&&wanted.negative.every(term=>item.meaning.negative.includes(term));
 const literal=item=>compatible(item)&&effective.every(term=>item.normalized.includes(term));
 const semantic=item=>compatible(item)&&wanted.positive.every(term=>item.meaning.positive.some(word=>word===term||word.includes(term)))&&wanted.negative.every(term=>item.meaning.negative.includes(term));
 const direct=candidates.filter(item=>literal(item)||(wanted.positive.length+wanted.negative.length>0&&semantic(item)));
 const order=(a,b)=>(Number(b.normalized===q)-Number(a.normalized===q))||b.last.date.localeCompare(a.last.date)||a.name.localeCompare(b.name,'cs');
 if(direct.length||!terms.length)return {items:direct.sort(order),approximate:false,expanded:direct.some(item=>!literal(item))};
 // A typo is only a labelled suggestion, never silently treated as an exact name.
 const similar=candidates.filter(item=>{
  const words=[...item.normalized.split(' '),...item.meaning.positive];
  return compatible(item)&&wanted.positive.length>0&&wanted.positive.every(term=>words.some(word=>word.includes(term)||(term.length>=4&&distance(term,word,term.length>=8?2:1)<=(term.length>=8?2:1))));
 });
 return {items:similar.sort(order),approximate:similar.length>0,expanded:false};
}
const api={normalize,buildIndex,search};root.JidelnickyMealSearch=api;
if(typeof module!=='undefined')module.exports=api;
if(!root.document)return;
const $=id=>document.getElementById(id),dialog=$('mealHistorySearch'),open=$('openMealHistorySearch');
if(!dialog||!open)return;
const query=$('mealHistoryQuery'),results=$('mealHistoryResults'),status=$('mealHistorySearchStatus');
const fullDate=new Intl.DateTimeFormat('cs-CZ',{weekday:'long',day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'});
const shortDate=new Intl.DateTimeFormat('cs-CZ',{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'});
const format=date=>fullDate.format(new Date(date+'T12:00:00Z'));
const slotLabel=slot=>({'soup':'Polévka','main':'Oběd 1','main2':'Oběd 2'})[slot];
let shown=30,composing=false;
function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}
function openOccurrence(hit){
 const app=root.JidelnickyApp;
 if(!app?.getState().history.some(w=>w.week===hit.week)){render();return}
 dialog.close();app.openHistory(hit.week);
 const day=$('historyPreview').querySelectorAll('.history-day')[hit.day];
 document.querySelectorAll('.mhs-history-target').forEach(el=>el.classList.remove('mhs-history-target'));
 if(day){day.classList.add('mhs-history-target');day.scrollIntoView({block:'nearest'})}
}
function relative(date,today){
 const days=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000);
 return days===0?'dnes':days===1?'včera':`před ${days} dny`;
}
function card(item,today){
 const hit=item.last,box=element('article','mhs-result'),heading=element('h3'),pick=element('button','mhs-pick-name',item.name);
 pick.type='button';pick.setAttribute('aria-label','Vybrat název: '+item.name);pick.title='Vybrat tento název do hledání';
 pick.onclick=()=>{query.value=item.name;shown=30;render();query.focus({preventScroll:true});query.select()};
 heading.append(pick);box.append(heading);
 const row=element('div','mhs-result-meta'),date=element('div');
 date.append(element('p','mhs-last-label','Poslední výskyt'),element('time','mhs-date',format(hit.date)),element('span','mhs-relative',relative(hit.date,today)));
 date.querySelector('time').dateTime=hit.date;
 const view=element('button','alt','Otevřít týden');view.type='button';view.setAttribute('aria-label',`Otevřít týden: ${item.name}, ${format(hit.date)}`);view.onclick=()=>openOccurrence(hit);row.append(date,view);box.append(row);
 box.append(element('span','mhs-kind',`${hit.slots.map(slotLabel).join(' / ')} · ${hit.verified?'Strava.cz':'Neověřená historie'}`));
 if(item.occurrences.length>1){
  const details=element('details'),summary=element('summary','',`Všechny výskyty (${item.occurrences.length})`),list=element('ul','mhs-dates');
  for(const entry of item.occurrences){const li=element('li'),button=element('button','alt',shortDate.format(new Date(entry.date+'T12:00:00Z')));button.type='button';button.onclick=()=>openOccurrence(entry);li.append(element('span','',entry.slots.map(slotLabel).join(' / ')),button);list.append(li)}
  details.append(summary,list);box.append(details);
 }
 return box;
}
function render(){
 const app=root.JidelnickyApp;if(!app)return;
 const index=buildIndex(app.getState()),found=search(index,query.value,'all');
 const coverage=$('mealHistoryCoverage');coverage.textContent=index.first?`Uložená historie: ${shortDate.format(new Date(index.first+'T12:00:00Z'))} – ${shortDate.format(new Date(index.last+'T12:00:00Z'))}.`:'V historii zatím nejsou žádná jídla s minulým nebo dnešním datem.';
 status.textContent=found.approximate?'Podobné názvy – možný překlep. Ověřte název jídla.':query.value.trim()?`Nalezené názvy: ${found.items.length}.${found.expanded?' Zahrnuty podobné výrazy a české tvary.':''} Vyberte název nebo se podívejte na poslední datum.`:'Začněte psát. Nabídnou se jídla z historie i s posledním datem.';
 results.replaceChildren();
 if(!found.items.length){results.append(element('p','mhs-empty',query.value.trim()?'V uložené historii nenalezeno. Zkuste kratší část názvu.':'V historii zatím není žádný výskyt.'));return}
 const fragment=document.createDocumentFragment();for(const item of found.items.slice(0,shown))fragment.append(card(item,index.today));results.append(fragment);
 if(found.items.length>shown){const more=element('button','alt mhs-more',`Zobrazit další (${found.items.length-shown})`);more.type='button';more.onclick=()=>{shown+=30;render()};results.append(more)}
}
open.addEventListener('click',()=>{shown=30;render();dialog.showModal();query.focus({preventScroll:true});query.select()});
$('closeMealHistorySearch').addEventListener('click',()=>dialog.close());
query.addEventListener('compositionstart',()=>composing=true);
query.addEventListener('compositionend',()=>{composing=false;shown=30;render()});
query.addEventListener('input',()=>{if(!composing){shown=30;render()}});
dialog.addEventListener('close',()=>open.focus({preventScroll:true}));
dialog.addEventListener('pointerdown',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
const hint=$('mealHistorySearchHint');
if(hint)hint.textContent='Napovídá během psaní, rozpozná běžné české tvary i podobné výrazy (např. zelná / z kysaného zelí). Počítá historii do dneška, bez návrhů.';
root.JidelnickyReady?.then(()=>{if(dialog.open)render()});
})(typeof window==='undefined'?globalThis:window);
