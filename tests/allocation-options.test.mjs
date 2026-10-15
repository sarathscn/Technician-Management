import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const start=html.indexOf('function allocationTechnicians('),end=html.indexOf('// Technician Allocation Table',start);
const records=[{id:'001',name:'Administrator'},{id:'002',name:'Coordinator'},{id:'170',name:'Abhijith'},{id:'181',name:'Sarath'}];
test('allocation dropdown uses the technician-only directory without changing stored records',()=>{
 const get=new Function('window','localStorage',html.slice(start,end)+'return allocationTechnicians;')({TMCloud:{}},{getItem:()=>JSON.stringify([{id:'170',name:'Abhijith'},{id:'181',name:'Sarath'}])});
 assert.deepEqual(get(records).map(t=>t.id),['170','181']);assert.equal(records.length,4);
});
test('offline allocation dropdown excludes linked manager accounts',()=>{
 const get=new Function('window','localStorage','accountMatchesTechnician',html.slice(start,end)+'return allocationTechnicians;')({},{getItem:()=>JSON.stringify([{role:'Administrator',technicianNumber:'001'},{role:'Coordinator',technicianNumber:'002'}])},(account,id)=>account.technicianNumber===id);
 assert.deepEqual(get(records).map(t=>t.id),['170','181']);
});
