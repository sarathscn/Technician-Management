import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('var TechnicianMultiSelect='),html.indexOf('var OvertimeView='));
function render(query='',value=[]){
 let state=0,changed;
 const element=(type,props)=>({type,props});
 const hooks={useState:()=>[state++===0?true:query,()=>{}],useRef:()=>({current:null}),useId:()=>'picker',useEffect:()=>{}};
 const Component=new Function('_','N','FloatingPanel','IconChevronDown',source+'return TechnicianMultiSelect;')(hooks,{jsx:element,jsxs:element},'panel','chevron');
 const tree=Component({technicians:[{id:'181',name:'Sarath'},{id:'170',name:'Abhijith'}],value,onChange:next=>changed=next});
 const nodes=[];const walk=node=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return;}nodes.push(node);walk(node.props?.children);};walk(tree);
 return {nodes,change:()=>changed};
}
test('picker lists all names alphabetically with adjacent checkboxes and IDs',()=>{
 const {nodes}=render();
 const labels=nodes.filter(n=>n.type==='label');
 assert.equal(labels.length,2);
 assert.equal(labels[0].props.children[0].type,'input');
 assert.equal(labels[0].props.children[1].props.children[0].props.children,'Abhijith');
 assert.equal(labels[1].props.children[1].props.children[1].props.children,'ID 181');
});
test('picker searches names and IDs and gives an empty search message',()=>{
 assert.equal(render('181').nodes.filter(n=>n.type==='label').length,1);
 assert.equal(render(' abhi ').nodes.filter(n=>n.type==='label').length,1);
 assert.ok(render('missing').nodes.some(n=>n.props?.children==='No technicians match your search.'));
});
test('picker preserves and removes selected team IDs',()=>{
 const picker=render('',[170]);
 const checkbox=picker.nodes.find(n=>n.type==='input'&&n.props.type==='checkbox');
 assert.equal(checkbox.props.checked,true);
 checkbox.props.onChange({target:{checked:false}});
 assert.deepEqual(picker.change(),[]);
});
