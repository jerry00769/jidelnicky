import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../data-model.js');
const D=globalThis.JidelnickyData,clone=structuredClone;
const original=JSON.parse(fs.readFileSync('docs/podklady/spolecna_data.json')).state;
const weeks=D.parseFeed(JSON.parse(fs.readFileSync('docs/podklady/strava_5948.json'))).weeks;
const script=fs.readFileSync('github-sync.js','utf8');
const key='jidelnicky2_github_baseline_v3',pending='jidelnicky2_github_pending_v3';
const prepare=input=>{const s=D.normalizeState(input);D.reconcile(s);return s};
function server(state=original){
 return {state:clone(state),revision:1,requests:[],beforeGet:null,beforePut:null,async fetch(url,options){
  this.requests.push(options.method);
  if(options.method==='GET'){if(this.beforeGet){const f=this.beforeGet;this.beforeGet=null;f()}return {ok:true,status:200,json:async()=>({type:'file',sha:'r'+this.revision,content:Buffer.from(JSON.stringify({format:'jidelnicky-shared-v1',state:this.state})).toString('base64')})}}
  if(this.beforePut){const f=this.beforePut;this.beforePut=null;f()}
  const body=JSON.parse(options.body);if(body.sha!=='r'+this.revision)return {ok:false,status:409,json:async()=>({message:'simulated concurrent commit'})};
  this.state=JSON.parse(Buffer.from(body.content,'base64').toString()).state;this.revision++;
  return {ok:true,status:200,json:async()=>({content:{sha:'r'+this.revision}})};
 }};
}
function device(api,{local=original,base=original,dirty=false,failApply=false}={}){
 let state=prepare(local),nextTimer=1;const timers=new Map(),values=new Map([[key,JSON.stringify(base)],[pending,dirty?'1':'0'],['jidelnicky2_github_token_v1','ghp_FAKE_TEST_ONLY']]);
 const elements=new Map(),messages=[],confirmations=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,dataset:{},classList:{add(){},remove(){},toggle(){}}});return elements.get(id)};
 if(base===null)values.delete(key);
 const window={JidelnickyData:D,JIDELNICKY_SEED:clone(original),addEventListener(){},dispatchEvent(){}};
 const context={window,document:{hidden:false,getElementById:element,addEventListener(){}},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetch:api.fetch.bind(api),Date,TextDecoder,TextEncoder,Uint8Array,CustomEvent:class{},setInterval(){},setTimeout(fn,ms){const id=nextTimer++;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),confirm(message){confirmations.push(message);return false}};
 vm.runInNewContext(script,context);
 const app={getState:()=>clone(state),applyState:s=>{if(failApply)throw Error('simulated durable write failure');state=prepare(s)},notice:m=>messages.push(m)};
 return {values,messages,confirmations,element,app,start:()=>window.GitHubSync.start(app),changed:()=>window.GitHubSync.changed(),state:()=>clone(state),edit:fn=>fn(state),async flush(){const entry=[...timers].find(([,t])=>t.ms===1200||t.ms===0);assert(entry,'scheduled sync exists');timers.delete(entry[0]);await entry[1].fn()}};
}
test('legacy baseline migrates without a false conflict or an unnecessary API write',async()=>{
 const api=server(),a=device(api);a.changed();assert.equal(a.values.get(pending),'0');await a.start();assert.equal(a.confirmations.length,0);assert.equal(a.element('ghConnect').hidden,true);assert.deepEqual(api.requests,['GET']);
});
test('API sync publishes source import and updates a clean second device',async()=>{
 const api=server(),a=device(api),b=device(api);await a.start();await b.start();const plan=D.planImport(a.state(),weeks);a.app.applyState(plan.state);a.changed();await a.flush();await b.element('ghRefresh').onclick();
 for(const d of [a,b])for(const w of weeks)assert(D.isVerified(d.state(),d.state().history.find(h=>h.week===w.week)));
 assert.equal(a.values.has(pending),false);assert.equal(b.confirmations.length,0);assert.equal(api.requests.filter(m=>m==='PUT').length,1);
});
test('offline stale menu merges through API without replacing authoritative history',async()=>{
 const api=server(D.planImport(original,weeks).state),local=clone(original);local.history.find(w=>w.week===weeks.at(-1).week).days[0].main='Starý ruční návrh';local.week.days[0].main='Starý ruční návrh';
 const b=device(api,{local,dirty:true});await b.start();const s=b.state();assert.equal(b.confirmations.length,0);for(const w of weeks)assert(D.sameWeek(s.history.find(h=>h.week===w.week),w));assert(D.sameWeek(s.week,weeks.at(-1)));assert(!Object.values(s.catalog.main).flat().includes('Starý ruční návrh'));
});
test('API 409 preserves both sides and leaves the local edit pending',async()=>{
 const api=server(),a=device(api);await a.start();a.edit(s=>s.txt='ZAKAZ_HLAVNI = kontrola A');a.changed();api.beforePut=()=>{api.state.txt='ZAKAZ_HLAVNI = kontrola B';api.revision++};await a.flush();assert.equal(a.values.get(pending),'1');assert.equal(a.state().txt,'ZAKAZ_HLAVNI = kontrola A');assert.equal(api.state.txt,'ZAKAZ_HLAVNI = kontrola B');assert(a.messages.some(m=>m.includes('konflikt')));
});
test('edits made during API read are kept and an obsolete snapshot is not sent',async()=>{
 const api=server(),a=device(api);await a.start();a.edit(s=>s.txt='ZAKAZ_HLAVNI = první');a.changed();api.beforeGet=()=>a.edit(s=>s.txt='ZAKAZ_HLAVNI = nejnovější');await a.flush();assert.equal(api.requests.filter(m=>m==='PUT').length,0);assert.equal(a.values.get(pending),'1');assert.equal(a.state().txt,'ZAKAZ_HLAVNI = nejnovější');await a.flush();assert.equal(api.state.txt,'ZAKAZ_HLAVNI = nejnovější');
});
test('failed durable application of remote data cannot advance the baseline',async()=>{
 const api=server(),a=device(api,{failApply:true});await a.start();const baseline=a.values.get(key),before=a.state();api.state=D.planImport(original,weeks).state;api.revision++;await a.element('ghRefresh').onclick();assert.deepEqual(a.state(),before);assert.equal(a.values.get(key),baseline);assert(a.messages.some(m=>m.includes('durable write failure')));
});

test('first connection after local source import merges safely without a stored baseline',async()=>{const api=server();let local=D.planImport(original,weeks).state;local.week={week:'2026-11-16',days:Array.from({length:5},()=>({closed:false,soup:'Návrhová polévka',main:'Návrhové jídlo',main2:''}))};local.drafts=[{...clone(local.week),status:'draft'}];const a=device(api,{local,base:null,dirty:true});await a.start();assert.equal(a.confirmations.length,0);assert.equal(a.state().week.week,'2026-11-16');assert.equal(a.state().drafts.length,1);for(const w of weeks)assert(D.isVerified(api.state,api.state.history.find(h=>h.week===w.week)));assert.equal(api.requests.filter(m=>m==='PUT').length,1);assert.equal(a.values.has(pending),false)});
