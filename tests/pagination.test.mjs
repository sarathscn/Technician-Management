import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function paginationWindow('),html.indexOf('var ListPagination='));
const rows=Array.from({length:45},(_,i)=>i+1);
const paginationWindow=new Function(source+'return paginationWindow;')();
test('default pages contain 20 records and remainder stays on final page',()=>{
 assert.deepEqual(paginationWindow(rows,null,1).items,rows.slice(0,20));
 assert.deepEqual(paginationWindow(rows,20,2).items,rows.slice(20,40));
 assert.deepEqual(paginationWindow(rows,20,3).items,[41,42,43,44,45]);
});
test('all four page sizes and invalid preference fallback work',()=>{
 for(const size of [10,20,50,100])assert.equal(paginationWindow(rows,size,1).items.length,Math.min(size,45));
 assert.equal(paginationWindow(rows,12,1).size,20);
 assert.equal(paginationWindow([],20,9).page,1);
 assert.equal(paginationWindow(rows,20,9).page,3);
});
function harness(){
 const storage=new Map(),states=[],effects=[];let cursor=0;
 const hooks={useState:init=>{const id=cursor++;if(!(id in states))states[id]=typeof init==='function'?init():init;return [states[id],value=>states[id]=typeof value==='function'?value(states[id]):value];},useEffect:()=>{}};
 const hook=new Function('_','localStorage','sessionStorage',source+'return useListPagination;')(hooks,{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},{getItem:()=>null});
 return {render:(items=rows,key='',user='alice')=>{cursor=0;return hook(items,'Technicians',key,{id:user});},storage};
}
test('filters and size changes reset to first page; deletion clamps page',()=>{
 const h=harness();let p=h.render();p.setPage(3);p=h.render();assert.equal(p.page,3);
 p=h.render(rows,'search');assert.equal(p.page,1);
 p.setPage(3);p=h.render(rows,'search');assert.equal(p.page,3);
 p=h.render(rows.slice(0,4),'search');assert.equal(p.page,1);
 p.setSize('10');p=h.render(rows,'search');assert.equal(p.page,1);assert.equal(p.size,10);
 assert.equal(h.storage.get('amc_page_size_alice_Technicians'),'10');
 assert.equal(h.storage.has('amc_page_size_bob_Technicians'),false);
});
