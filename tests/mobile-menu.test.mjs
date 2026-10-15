import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const start=html.indexOf('function mobileAccountSummary('),end=html.indexOf('var MobileMenuAccount=',start);
const summary=new Function('normalizeAccount',html.slice(start,end)+'return mobileAccountSummary;')(user=>user);
test('administrator aliases collapse to a single Super Admin label',()=>{
 for(const name of ['Super Admin','administrator','Administrator','Admin',''])assert.deepEqual(summary({name,username:'administrator',role:'Administrator'}),{name:'Super Admin',role:''});
});
test('named accounts keep the name and one readable role without a username line',()=>{
 assert.deepEqual(summary({name:'Abhijith',username:'Abhijith@170',role:'Technician'}),{name:'Abhijith',role:'Technician'});
 assert.deepEqual(summary({name:'Sarath',username:'administrator',role:'Administrator'}),{name:'Sarath',role:'Super Admin'});
 assert.deepEqual(summary({name:'Coordinator',username:'coordinator',role:'Coordinator'}),{name:'Coordinator',role:''});
});
