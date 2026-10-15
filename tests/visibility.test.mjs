import {test} from 'node:test';
import assert from 'node:assert/strict';
import {technicianSnapshot,sameTechnician,technicianDirectory} from '../supabase/functions/tm-api/visibility.ts';

test('team directory includes all technicians and excludes personal details',()=>{
 const records=[{kind:'technician',id:'181',payload:{name:'Sarath',mobileNumber:'12345678',cprNumber:'private'}},{kind:'technician',id:'170',payload:{name:'Abhijith',passes:[{number:'private'}]}},{kind:'leave',id:'private',payload:{name:'Leave'}}];
 assert.deepEqual(technicianDirectory(records),[{id:'170',name:'Abhijith'},{id:'181',name:'Sarath'}]);
});

test('IDs match dashboard rules without matching missing IDs',()=>{
 assert.equal(sameTechnician('089',89),true);
 assert.equal(sameTechnician('00170','170'),true);
 for(const id of [null,undefined,''])assert.equal(sameTechnician(id,''),false);
 assert.equal(sameTechnician('170','181'),false);
});
test('directory excludes administrator and coordinator accounts, retaining unlinked technicians',()=>{
 const records=['001','002','003','170','181'].map(id=>({kind:'technician',id,payload:{name:id}}));
 const profiles=[{technician_id:'1',role:'Administrator'},{technician_id:'002',role:'Admin'},{technician_id:'003',role:'Coordinator'},{technician_id:'170',role:'Technician'}];
 assert.deepEqual(technicianDirectory(records,profiles).map(t=>t.id),['170','181']);
});
test('assigned callouts are returned; reassigned and other technicians calls stay private',()=>{
 const call=(id,payload)=>({kind:'callout',id,payload});
 const records=[call('own',{assignedTechnicianId:'170'}),call('other',{assignedTechnicianId:'181'}),call('away',{assignedTechnicianId:'170',rescheduledTechnicianId:'181'}),call('incoming',{assignedTechnicianId:'181',rescheduledTechnicianId:'00170'}),call('unassigned',{})];
 assert.deepEqual(technicianSnapshot(records,'170','u').map(r=>r.id),['own','incoming']);
 assert.equal(technicianSnapshot(records,null,'u').length,0);
});
test('technicians see the entire daily allocation even when not allocated',()=>{
 const day={kind:'allocation_day',id:'2026-10-16',version:3,payload:{allocations:[{technicianId:'089'},{technicianId:'170'},{technicianId:''}],customSections:[{title:'Site',rows:[{technicianId:89},{technicianId:'181'}]},{title:'Private',rows:[{technicianId:'170'}]}]}};
 const before=JSON.stringify(day),[visible]=technicianSnapshot([day],'999','u');
 assert.deepEqual(visible,day);
 assert.deepEqual(technicianSnapshot([day],'170','u'),[day]);
 assert.equal(JSON.stringify(day),before);
});
test('other records retain ownership restrictions',()=>{
 const records=[{kind:'technician',technician_id:'089'},{kind:'technician',technician_id:'170'},{kind:'leave',technician_id:'89'},{kind:'overtime',owner_id:'u'},{kind:'overtime',owner_id:'other'},{kind:'leave_request',owner_id:'u'},{kind:'holiday'},{kind:'team_settings'},{kind:'callout_roster'}];
 assert.deepEqual(technicianSnapshot(records,'89','u').map(r=>r.kind),['technician','leave','overtime','leave_request','holiday','team_settings']);
});
