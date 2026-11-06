/* Shared, side-effect-free rules for the private WEB test and GitHub merges. */
(function(root){
'use strict';
const copy=x=>structuredClone(x);
const text=x=>typeof x==='string'?x.trim():'';
const fields=['soup','main','main2'];
const organization=x=>/^(?:p\s*r\s*[áa]\s*z\s*d\s*n\s*i\s*n\s*y|[řr]editelsk[eé]\s+volno|neva[řr][íi]\s+se|st[aá]tn[íi]\s+sv[aá]tek)$/iu.test(text(x));
function weekKey(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Neplatné datum týdne');
 const d=new Date(s+'T12:00:00Z');
 if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s||d.getUTCDay()!==1)throw Error('Týden musí začínat platným pondělím');
 return s;
}
function normalizedWeek(w){
 const week=weekKey(w?.week);
 if(!Array.isArray(w.days)||w.days.length!==5)throw Error('Neúplný týden '+week);
 const days=w.days.map((d,i)=>{
  if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Chybí den '+week+'/'+i);
  if(d.closed!==undefined&&typeof d.closed!=='boolean')throw Error('Neplatný stav vaření');
  for(const f of fields)if(d[f]!==undefined&&typeof d[f]!=='string')throw Error('Neplatný text jídla');
  const day={closed:!!d.closed,soup:text(d.soup),main:text(d.main),main2:text(d.main2),category:text(d.category),category2:text(d.category2)};
  if(fields.some(f=>organization(day[f]))&&fields.some(f=>day[f]&&!organization(day[f])))throw Error('Rozporné organizační označení a pokrm '+week+'/'+i);
  if(!day.closed&&(!day.soup||(!day.main&&!organization(day.soup))))throw Error('Neúplný den '+week+'/'+i);
  if(organization(day.soup)&&!day.main&&!day.main2)day.closed=true;
  return day;
 });
 return {week,days};
}
const signature=w=>JSON.stringify((w?.days||[]).map(d=>[!!d.closed,...fields.map(f=>text(d[f]))]));
const sameWeek=(a,b)=>!!a&&!!b&&a.week===b.week&&a.days?.length===5&&b.days?.length===5&&signature(a)===signature(b);
const isVerified=(s,w)=>!!w&&s.stravaVerifiedWeeks?.[w.week]?.source==='strava-5948'&&s.stravaVerifiedWeeks[w.week].signature===signature(w);
const daySignature=d=>JSON.stringify([!!d?.closed,...fields.map(f=>text(d?.[f]))]);
const dateAt=(week,i)=>new Date(Date.parse(week+'T12:00:00Z')+i*86400000).toISOString().slice(0,10);
const isDayVerified=(s,w,i)=>!!w&&(isVerified(s,w)||s.stravaMealWeeks?.[w.week]?.source==='strava-5948'&&s.stravaMealWeeks[w.week].days?.[i]?.signature===daySignature(w.days[i]));
function auditStatus(s,w){
 if(isVerified(s,w))return 'definitive';
 const proof=s.stravaMealWeeks?.[w?.week];
 if(!proof||proof.source!=='strava-5948')return 'unverified';
 const covered=w.days.every((d,i)=>isDayVerified(s,w,i)||d.closed&&!fields.some(f=>text(d[f]))&&proof.noMenuDates?.includes(dateAt(w.week,i)));
 if(!covered)return 'unverified';
 return w.days.some((d,i)=>!d.closed&&isDayVerified(s,w,i))?'meals-verified':'no-published-menu';
}
function planHistoricalAudit(input,audit){
 const s=normalizeState(input),changed=[],issues=[];
 if(!audit)return {state:s,changed,issues,needsWrite:JSON.stringify(s)!==JSON.stringify(input)};
 if(audit.cafeteria!=='5948'||!Array.isArray(audit.weeks))throw Error('Neplatný historický audit 5948');
 for(const raw of audit.weeks){
  weekKey(raw.week);
  if(raw.days?.length!==5||!Array.isArray(raw.noMenuDates)||!raw.documents?.length)throw Error('Neúplný důkaz auditu '+raw.week);
  const w=s.history.find(h=>h.week===raw.week);if(!w||isVerified(s,w))continue;
  const previous=s.stravaMealWeeks[w.week];
  if(previous&&Date.parse(previous.retrievedAt)>Date.parse(audit.retrievedAt))continue;
  const proof={source:'strava-5948',retrievedAt:audit.retrievedAt,days:{},noMenuDates:[],documents:copy(raw.documents)};
  for(let i=0;i<5;i++){
   const incoming=raw.days[i],old=w.days[i];
   if(incoming){
    const d=normalizedWeek({week:w.week,days:Array.from({length:5},(_,n)=>n===i?incoming:{closed:true})}).days[i];
    if(d.closed||old.closed){issues.push(w.week+'/'+i+': rozpor stavu vaření');continue}
    if(daySignature(old)!==daySignature(d)){w.days[i]={...d,category:old.main===d.main?text(old.category):'',category2:old.main2===d.main2?text(old.category2):''};changed.push(dateAt(w.week,i))}
    proof.days[i]={signature:daySignature(w.days[i])};
   }else if(raw.noMenuDates.includes(dateAt(w.week,i))&&old.closed&&!fields.some(f=>text(old[f])))proof.noMenuDates.push(dateAt(w.week,i));
   else issues.push(w.week+'/'+i+': chybějící nebo neúplné menu');
  }
  s.stravaMealWeeks[w.week]=proof;
 }
 reconcile(s);
 return {state:s,changed,issues,needsWrite:JSON.stringify(s)!==JSON.stringify(input)};
}
function normalizeState(input){
 const s=copy(input);
 if(!s?.catalog?.soup||!s?.catalog?.main||!Array.isArray(s.history)||s.week?.days?.length!==5)throw Error('Neplatná záloha jídelníčků');
 for(const kind of ['soup','main'])for(const a of Object.values(s.catalog[kind]))if(!Array.isArray(a)||a.some(x=>typeof x!=='string'))throw Error('Neplatný katalog');
 const seen=new Set();
 for(const w of s.history){weekKey(w.week);if(w.days?.length!==5||seen.has(w.week))throw Error('Neplatný nebo duplicitní historický týden');seen.add(w.week)}
 s.drafts??=[];s.stravaVerifiedWeeks??={};s.stravaMealWeeks??={};s.proposalCatalog??={soup:{},main:{}};s.legacyCatalog??={soup:{},main:{}};
 if(!Array.isArray(s.drafts)||!s.stravaVerifiedWeeks||typeof s.stravaVerifiedWeeks!=='object'||Array.isArray(s.stravaVerifiedWeeks))throw Error('Neplatný původ historie nebo návrhy');
 weekKey(s.week.week);
 for(const w of [s.week,...s.history,...s.drafts]){
  weekKey(w.week);
  if(w.days?.length!==5||w.days.some(d=>!d||typeof d!=='object'||fields.some(f=>d[f]!==undefined&&typeof d[f]!=='string')))throw Error('Neplatná struktura dnů');
 }
 for(const kind of ['soup','main']){
  s.proposalCatalog[kind]??={};
  s.legacyCatalog[kind]??={};
  for(const groups of [s.proposalCatalog[kind],s.legacyCatalog[kind]])for(const names of Object.values(groups))if(!Array.isArray(names)||names.some(n=>typeof n!=='string'))throw Error('Neplatná návrhová nebo neověřená jídla');
 }
 if(typeof s.stravaMealWeeks!=='object'||Array.isArray(s.stravaMealWeeks))throw Error('Neplatné denní důkazy');
 s.dataVersion=2;
 for(const w of s.history){w.status=isVerified(s,w)?'definitive':'unverified';w.source=w.status==='definitive'?'strava-5948':'legacy-unverified'}
 return s;
}
function reconcile(s){
 const verified=s.history.filter(w=>isVerified(s,w));
 const unverified=s.history.length-verified.length;
 s.legacyCatalog??={soup:{},main:{}};
 const partitioned=s.catalogPartitionVersion===1;
 const prune=s.history.length>0&&s.history.every(w=>w.days.every((d,i)=>d.closed||isDayVerified(s,w,i)));
 const result={verified:verified.length,unverified,pruned:prune,added:{soup:[],main:[]},removed:{soup:[],main:[]},movedToLegacy:{soup:[],main:[]}};
 for(const kind of ['soup','main']){
  const needed=new Set(),pending=new Set(),previous=s.catalog[kind],oldLegacy=s.legacyCatalog[kind]||{};
  for(const w of s.history)for(const [i,d] of w.days.entries()){if(d.closed)continue;for(const f of kind==='soup'?['soup']:['main','main2'])if(text(d[f])&&!organization(d[f]))(isDayVerified(s,w,i)?needed:pending).add(text(d[f]));}
  const definitive={},legacy={},seen=new Set();
  for(const [origin,groups] of [['catalog',previous],['legacy',oldLegacy]])for(const [cat,names] of Object.entries(groups))for(const name of names){
   if(!text(name)||organization(name)||seen.has(name)){result.removed[kind].push(name);continue}seen.add(name);
   if(needed.has(name)){(definitive[cat]??=[]).push(name);if(origin==='legacy')result.added[kind].push(name)}
   else if(!prune&&(origin==='legacy'||!partitioned||pending.has(name))){(legacy[cat]??=[]).push(name);if(origin==='catalog')result.movedToLegacy[kind].push(name)}
   else result.removed[kind].push(name);
  }
  const bucket=kind==='soup'?'__POLEVKY__':'__HLAVNI__';
  for(const name of needed)if(!Object.values(definitive).some(a=>a.includes(name))){(definitive[bucket]??=[]).push(name);result.added[kind].push(name)}
  if(!prune)for(const name of pending)if(!needed.has(name)&&!Object.values(legacy).some(a=>a.includes(name)))(legacy[bucket]??=[]).push(name);
  s.catalog[kind]=definitive;s.legacyCatalog[kind]=legacy;
 }
 s.catalogPartitionVersion=1;
 s.catalogAudit={verified:verified.length,unverified,mode:'partitioned',legacyPending:!prune,mealsVerified:s.history.filter(w=>auditStatus(s,w)==='meals-verified').length,noPublishedMenu:s.history.filter(w=>auditStatus(s,w)==='no-published-menu').length,unchecked:s.history.filter(w=>auditStatus(s,w)==='unverified').length};
 if(!s.learningOriginMigrated){s.legacyLearning=copy(s.learning||{});s.learningOriginMigrated=true}
 const learning={main:{},soup:{},pair:{}};
 const count=(kind,name)=>{if(name&&!organization(name))learning[kind][name]=Math.min(20,(learning[kind][name]||0)+1)};
 for(const w of s.history)for(const [i,d] of w.days.entries()){if(d.closed||!isDayVerified(s,w,i))continue;count('soup',d.soup);for(const f of ['main','main2'])if(d[f]&&!organization(d[f])){count('main',d[f]);if(d.soup&&!organization(d.soup))count('pair',d.soup+' ||| '+d[f])}}
 s.learning=learning;
 return result;
}
function parseFeed(data){
 if(data?.cafeteria!=='5948'||data.status!=='received'||!Array.isArray(data.weeks))throw Error('Neplatný zdroj Strava.cz 5948');
 const good=new Map(),issues=[],blocked=new Set();
 for(const raw of data.weeks){
  try{
   const w=normalizedWeek(raw);
   if(good.has(w.week)&&!sameWeek(good.get(w.week),w)){blocked.add(w.week);issues.push('Rozporné zdrojové verze týdne '+w.week)}
   else good.set(w.week,w);
  }catch(e){issues.push(e.message);if(typeof raw?.week==='string')blocked.add(raw.week)}
 }
 for(const k of blocked)good.delete(k);
 return {weeks:[...good.values()].sort((a,b)=>a.week.localeCompare(b.week)),issues};
}
function planImport(input,incoming,meta={}){
 const s=normalizeState(input),changed=[],marked=[],removedDrafts=[];
 const retired={soup:new Set(),main:new Set()};
 const stamp=meta.retrievedAt||new Date().toISOString();
 for(const raw of incoming){
  const w=normalizedWeek(raw),i=s.history.findIndex(h=>h.week===w.week),old=s.history[i];
  if(!sameWeek(old,w)){if(i<0)s.history.push(w);else s.history[i]=w;changed.push(w.week)}
  const actual=s.history.find(h=>h.week===w.week);
  if(!isVerified(s,actual))marked.push(w.week);
  const oldProof=s.stravaVerifiedWeeks[w.week];
  if(!oldProof||oldProof.signature!==signature(w))s.stravaVerifiedWeeks[w.week]={source:'strava-5948',signature:signature(w),retrievedAt:stamp,...(meta.sourceUpdatedAt?{sourceUpdatedAt:meta.sourceUpdatedAt}:{})};
  if(meta.evidenceByWeek?.[w.week]&&!s.stravaVerifiedWeeks[w.week].documents)s.stravaVerifiedWeeks[w.week].documents=copy(meta.evidenceByWeek[w.week]);
  actual.status='definitive';actual.source='strava-5948';
  s.drafts=s.drafts.filter(d=>{if(d.week!==w.week)return true;removedDrafts.push(d.week);for(const day of d.days){retired.soup.add(day.soup);retired.main.add(day.main);retired.main.add(day.main2)}return false});
  if(s.week.week===w.week&&!sameWeek(s.week,w))for(const d of s.week.days){retired.soup.add(d.soup);retired.main.add(d.main);retired.main.add(d.main2)}
  if(s.week.week===w.week){s.week=copy(actual);s.count=w.days.some(d=>d.main2)?2:1}
 }
 s.history.sort((a,b)=>a.week.localeCompare(b.week));
 const catalog=reconcile(s);
 for(const kind of ['soup','main']){
  const used=new Set([...s.history,...s.drafts,s.week].flatMap(w=>w.days.filter(d=>!d.closed).flatMap(d=>kind==='soup'?[d.soup]:[d.main,d.main2])));
  for(const [cat,names] of Object.entries(s.proposalCatalog[kind]))s.proposalCatalog[kind][cat]=names.filter(n=>!retired[kind].has(n)||used.has(n));
 }
 return {state:s,changed,marked,removedDrafts,catalog,needsWrite:JSON.stringify(s)!==JSON.stringify(input)};
}
function mergeStates(baseInput,localInput,serverInput){
 try{
  const base=normalizeState(baseInput),local=normalizeState(localInput),server=normalizeState(serverInput);
  for(const s of [base,local,server])reconcile(s);const out=copy(server);
  const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const choose=(b,a,c)=>eq(a,c)?copy(a):eq(a,b)?copy(c):eq(c,b)?copy(a):undefined;
  out.history=[];out.stravaVerifiedWeeks={};
  for(const key of new Set([...base.history,...local.history,...server.history].map(w=>w.week))){
   const b=base.history.find(w=>w.week===key),a=local.history.find(w=>w.week===key),c=server.history.find(w=>w.week===key);
   const av=a&&isVerified(local,a),cv=c&&isVerified(server,c);let selected;
   if(av&&!cv)selected=a;
   else if(cv&&!av)selected=c;
   else if(av&&cv&&sameWeek(a,c))selected=c;
   else if(a&&c&&(a.days.some((_,i)=>isDayVerified(local,a,i))||c.days.some((_,i)=>isDayVerified(server,c,i)))){
    const days=[];for(let i=0;i<5;i++){
     const ap=isDayVerified(local,a,i),cp=isDayVerified(server,c,i);
     const d=ap&&!cp?a.days[i]:cp&&!ap?c.days[i]:choose(b?.days[i],a.days[i],c.days[i]);
     if(d===undefined)return null;days.push(copy(d));
    }selected={...c,days};
   }else selected=choose(b,a,c);
   if(selected===undefined&&(!eq(a,b)&&!eq(c,b)&&!eq(a,c)))return null;
   if(selected){out.history.push(selected);const proof=sameWeek(selected,a)&&av?local.stravaVerifiedWeeks[key]:sameWeek(selected,c)&&cv?server.stravaVerifiedWeeks[key]:null;if(proof)out.stravaVerifiedWeeks[key]=copy(proof)}
  }
  out.stravaMealWeeks={};
  for(const w of out.history){
   const candidates=[local.stravaMealWeeks[w.week],server.stravaMealWeeks[w.week]].filter(Boolean).sort((a,b)=>Date.parse(b.retrievedAt)-Date.parse(a.retrievedAt));
   if(!candidates.length)continue;
   const proof=copy(candidates[0]);proof.days={};
   for(let i=0;i<5;i++)for(const p of candidates)if(p.days?.[i]?.signature===daySignature(w.days[i])){proof.days[i]=copy(p.days[i]);break}
   out.stravaMealWeeks[w.week]=proof;
  }
  out.drafts=[];
  for(const key of new Set([...base.drafts,...local.drafts,...server.drafts].map(w=>w.week))){
   if(out.history.some(w=>w.week===key&&isVerified(out,w)))continue;
   const b=base.drafts.find(w=>w.week===key),a=local.drafts.find(w=>w.week===key),c=server.drafts.find(w=>w.week===key);
   const d=choose(b,a,c);if(d===undefined&&(!eq(a,b)&&!eq(c,b)&&!eq(a,c)))return null;if(d)out.drafts.push(d);
  }
  for(const pool of ['catalog','legacyCatalog','proposalCatalog'])for(const kind of ['soup','main']){
   out[pool][kind]={};
   for(const cat of new Set([...Object.keys(base[pool][kind]),...Object.keys(local[pool][kind]),...Object.keys(server[pool][kind])])){
    const b=base[pool][kind][cat]||[],a=local[pool][kind][cat]||[],c=server[pool][kind][cat]||[];
    out[pool][kind][cat]=[...new Set([...a,...c])].filter(n=>!b.includes(n)||(a.includes(n)&&c.includes(n)));
   }
  }
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(server)])){
   if(['history','stravaVerifiedWeeks','stravaMealWeeks','drafts','catalog','legacyCatalog','proposalCatalog','learning','catalogPartitionVersion','catalogAudit','dataVersion'].includes(key))continue;
   // I rozepsaná kopie stejného zveřejněného týdne musí ustoupit zdroji.
   if(['week','count'].includes(key)&&local.week.week===server.week.week){const official=out.history.find(w=>w.week===local.week.week&&isVerified(out,w));if(official){out[key]=key==='week'?copy(official):official.days.some(d=>d.main2)?2:1;continue}}
   const value=choose(base[key],local[key],server[key]);
   if(value===undefined&&!eq(local[key],base[key])&&!eq(server[key],base[key])&&!eq(local[key],server[key]))return null;
   if(value===undefined)delete out[key];else out[key]=value;
  }
  out.catalogPartitionVersion=1;reconcile(out);return normalizeState(out);
 }catch{return null}
}
const api={organization,weekKey,normalizedWeek,signature,sameWeek,isVerified,isDayVerified,auditStatus,planHistoricalAudit,normalizeState,reconcile,parseFeed,planImport,mergeStates};
root.JidelnickyData=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
