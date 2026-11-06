import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(process.env.JIDELNICKY_GITHUB_SYNC_SOURCE||new URL('../github-sync.js',import.meta.url),'utf8');
const tokenKey='jidelnicky2_github_token_v1';
const pendingKey='jidelnicky2_github_pending_v3';
const baselineKey='jidelnicky2_github_baseline_v3';
const data={catalog:{soup:{},main:{}},history:[],week:{days:[{},{},{},{},{}]}};
function browser({token='',response=200,pending=false}={}){
 const stored=new Map([[tokenKey,token],[baselineKey,JSON.stringify(data)],['menus','original menus'],[pendingKey,pending?'1':'0']]);
 const elements=new Map();const messages=[],requests=[],answers=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:'',dataset:{},classList:{add(){},remove(){},toggle(){}}});return elements.get(id)};
 let nextResponse=response;
 const context={window:{addEventListener(){},dispatchEvent(){}},document:{getElementById:element,addEventListener(){},hidden:false},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)},setTimeout(){},clearTimeout(){},setInterval(){},CustomEvent:class{},Date,TextDecoder,TextEncoder,Uint8Array,atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64'),prompt:()=>answers.shift(),confirm(){throw Error('unexpected confirmation')},fetch:async(url,options)=>{requests.push({url,options});if(nextResponse==='offline')throw Error('Network error');return {status:nextResponse,ok:nextResponse===200,json:async()=>nextResponse===200?{sha:'fake-sha',type:'file',content:Buffer.from(JSON.stringify({format:'jidelnicky-shared-v1',state:data})).toString('base64')}:{message:'test rejection'}}}};
 vm.runInNewContext(source,context);
 return {stored,requests,answers,messages,element,respond:status=>nextResponse=status,start:()=>context.window.GitHubSync.start({getState:()=>structuredClone(data),applyState(){throw Error('unexpected data replacement')},notice:message=>messages.push(message)})};
}
test('malformed restored token is rejected before fetch and can be entered again',async()=>{
 const b=browser({token:'github_pat_fake\r\ninjected: value',pending:true});
 await b.start();assert.equal(b.requests.length,0);assert.equal(b.stored.has(tokenKey),false);
 assert.equal(b.stored.get(pendingKey),'1');assert.equal(b.stored.get('menus'),'original menus');assert(b.stored.has(baselineKey));
 assert.match(b.messages[0],/Klíč obsahuje/);assert(!b.messages.join('').includes('injected'));
 b.answers.push('  github_pat_FAKE_FOR_TEST_ONLY  ');await b.element('ghConnect').onclick();
 assert.equal(b.requests.length,1);assert.equal(b.requests[0].options.method,'GET');assert.equal(b.requests[0].options.headers.Authorization,'Bearer github_pat_FAKE_FOR_TEST_ONLY');
 assert.equal(b.element('ghConnect').hidden,true);
});
test('401 releases only the rejected credential and preserves pending menus and baseline',async()=>{
 const b=browser({token:'ghp_FAKE_FOR_TEST_ONLY',response:401,pending:true});await b.start();
 assert.equal(b.stored.has(tokenKey),false);assert.equal(b.stored.get(pendingKey),'1');assert.equal(b.stored.get('menus'),'original menus');assert(b.stored.has(baselineKey));
 assert.match(b.messages[0],/401/);assert.equal(b.element('ghConnect').hidden,false);
 b.respond(200);b.answers.push('ghp_ANOTHER_FAKE_FOR_TEST_ONLY');await b.element('ghConnect').onclick();assert.equal(b.element('ghConnect').hidden,true);
});
test('403, server outages and network errors preserve the stored credential',async()=>{
 for(const response of [403,500,'offline']){const b=browser({token:'ghp_FAKE_FOR_TEST_ONLY',response,pending:true});await b.start();assert.equal(b.stored.get(tokenKey),'ghp_FAKE_FOR_TEST_ONLY');assert.equal(b.stored.get(pendingKey),'1')}
});
test('invalid pasted values never enter storage or network',async()=>{
 for(const value of ['Bearer ghp_FAKE','"ghp_FAKE"','github_pat_fake\u200b','ghp_fake\nother','ghp_fake\tother','český klíč']){
  const b=browser();await b.start();b.answers.push(value);await b.element('ghConnect').onclick();assert.equal(b.requests.length,0);assert(!b.stored.get(tokenKey));assert.match(b.messages[0],/Klíč obsahuje/);
 }
});
