import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/cloud.js',import.meta.url),'utf8');
test('loading default team settings never writes manager-only settings',()=>{
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const start=html.indexOf('function le(){try{let e=localStorage.getItem(E.TEAM_SETTINGS)');
 const end=html.indexOf('function ue(e)',start);
 assert.ok(start>=0&&end>start);
 const load=new Function('localStorage','E','ce','ue',html.slice(start,end)+'return le();');
 const defaults={teamName:'Secure Services Limited',projectType:'Technician Allocation'};
 assert.deepEqual(load({getItem:()=>null},{TEAM_SETTINGS:'settings'},defaults,()=>{throw Error('Unexpected startup write');}),defaults);
});
function app({remember=false,lastActivity,handler}={}){
 let now=1000000,reloads=0;
 class Storage{constructor(){this.items=new Map();}getItem(k){return this.items.get(k)??null;}setItem(k,v){this.items.set(k,String(v));}removeItem(k){this.items.delete(k);}}
 const localStorage=new Storage(),sessionStorage=new Storage(),listeners={},timers=[],calls=[];
 const profile={id:'u',username:'tech',role:'Technician',status:'Active',technician_id:'170'};
 (remember?localStorage:sessionStorage).setItem('amc_auth_session',JSON.stringify({cloud:true,user:profile,token:'test-token',refresh_token:'test-refresh',expires_at:999999}));
 if(lastActivity!==undefined)localStorage.setItem('amc_activity_u',String(lastActivity));
 const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
 const fetch=async(url,options={})=>{const body=options.body?JSON.parse(options.body):{};calls.push({url,options,body});const custom=handler?.(url,body,options);return custom||response(200,body.action==='snapshot'?{profile,records:[],users:[profile],technicians:[]}:body.action==='me'?{profile}:{});};
 const element=()=>({style:{},setAttribute(){},append(){},focus(){}});
 const status=element();
 const context=vm.createContext({Storage,localStorage,sessionStorage,fetch,AbortSignal,Date:class extends Date{static now(){return now;}},Promise,Error,JSON,Map,Object,String,Number,Math,
  document:{hidden:false,activeElement:{matches:()=>true},querySelector:()=>({}),getElementById:()=>status,createElement:element,body:{append(){}},addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn)},
  location:{reload:()=>reloads++},setInterval:(fn,ms)=>timers.push({fn,ms}),setTimeout:()=>1,clearTimeout(){},navigator:{}});
 context.window=context;context.addEventListener=(type,fn)=>(listeners[type]??=[]).push(fn);
 vm.runInContext(source,context);
 return {cloud:context.TMCloud,localStorage,sessionStorage,calls,response,now:()=>now,reloads:()=>reloads,
  advance:ms=>now+=ms,tick:async ms=>{for(const t of timers.filter(t=>t.ms===ms))await t.fn();},
  event:async(type,event={})=>{for(const fn of listeners[type]||[])await fn(event);},context};
}
test('idle timeout signs out at five minutes, clears tokens and cached data, and revokes refresh session',async()=>{
 const a=app({remember:true});await a.cloud.start();a.localStorage.setItem('amc_day_allocations','{}');
 a.advance(299999);await a.tick(1000);assert.equal(a.reloads(),0);
 a.advance(1);await a.tick(1000);assert.equal(a.reloads(),1);
 assert.equal(a.localStorage.getItem('amc_auth_session'),null);assert.equal(a.sessionStorage.getItem('amc_auth_session'),null);
 assert.equal(a.localStorage.getItem('amc_day_allocations'),null);
 assert.ok(a.calls.some(c=>c.url.endsWith('/auth/v1/logout?scope=local')));
});
test('user activity resets idle timeout but background account checks do not',async()=>{
 const a=app();await a.cloud.start();a.advance(240000);await a.event('scroll');
 a.advance(240000);await a.tick(15000);assert.equal(a.reloads(),0);
 a.advance(60000);await a.tick(1000);assert.equal(a.reloads(),1);
});
test('deleted account is detected while an input and modal are active',async()=>{
 let deleted=false;const a=app({handler:(_,body)=>deleted&&body.action==='me'?{status:403,ok:false,json:async()=>({error:'Account inactive'})}:null});
 await a.cloud.start();deleted=true;await a.tick(15000);
 assert.equal(a.reloads(),1);assert.equal(a.sessionStorage.getItem('amc_auth_session'),null);
});
test('focus checks elapsed idle time before interaction can revive a sleeping session',async()=>{
 const a=app();await a.cloud.start();a.advance(300001);await a.event('pointerdown');assert.equal(a.reloads(),1);
 const stale=app({lastActivity:600000});await stale.cloud.start();assert.equal(stale.reloads(),1);
 assert.ok(!stale.calls.some(c=>c.body.action==='snapshot'));
});
test('logout propagates between tabs for the same user',async()=>{
 const a=app();await a.cloud.start();await a.event('storage',{key:'amc_signout_u',newValue:String(a.now())});assert.equal(a.reloads(),1);
});
test('ordinary access-denied errors do not sign out active accounts',async()=>{
 const a=app({handler:(_,body)=>body.action==='save_record'?{status:403,ok:false,json:async()=>({error:'Database save denied or invalid record.'})}:null});
 await a.cloud.start();await assert.rejects(a.cloud.api('save_record'),/save denied/);assert.equal(a.reloads(),0);
});
test('expired and revoked refresh sessions force signout',async()=>{
 const a=app({handler:(url,body)=>url.includes('/auth/v1/token')?{status:400,ok:false,json:async()=>({})}:body.action==='me'?{status:401,ok:false,json:async()=>({error:'Session expired'})}:null});
 await a.cloud.start();await a.tick(15000);assert.equal(a.reloads(),1);
});
test('password change uses the configured Auth URL and key after checking the active account',async()=>{
 const a=app();await a.cloud.start();await a.cloud.changePassword('example-only');
 const request=a.calls.find(c=>c.url.endsWith('/auth/v1/user'));
 assert.ok(request);assert.equal(request.options.headers.Authorization,'Bearer test-token');
 assert.ok(request.options.headers.apikey.startsWith('sb_publishable_'));assert.equal(request.options.method,'PUT');
 assert.equal(request.body.password,'example-only');assert.ok(a.calls.some(c=>c.body.action==='me'));
});
test('password provider errors are returned to the modal',async()=>{
 const a=app({handler:url=>url.endsWith('/auth/v1/user')?{status:422,ok:false,json:async()=>({msg:'New password should be different from the old password.'})}:null});
 await a.cloud.start();await assert.rejects(a.cloud.changePassword('example-only'),/different from the old/);assert.equal(a.reloads(),0);
});
