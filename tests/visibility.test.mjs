import {test} from 'node:test';
import assert from 'node:assert/strict';
import {technicianSnapshot,sameTechnician} from '../supabase/functions/tm-api/visibility.ts';

test('IDs match dashboard rules without matching missing IDs',()=>{
 assert.equal(sameTechnician('089',89),true);
 assert.equal(sameTechnician('00170','170'),true);
 for(const id of [null,undefined,''])assert.equal(sameTechnician(id,''),false);
 assert.equal(sameTechnician('170','181'),false);
});
test('assigned callouts are returned; reassigned and other technicians calls stay private',()=>{
 const call=(id,payload)=>({kind:'callout',id,payload});
 const records=[call('own',{assignedTechnicianId:'170'}),call('other',{assignedTechnicianId:'181'}),call('away',{assignedTechnicianId:'170',rescheduledTechnicianId:'181'}),call('incoming',{assignedTechnicianId:'181',rescheduledTechnicianId:'00170'}),call('unassigned',{})];
 assert.deepEqual(technicianSnapshot(records,'170','u').map(r=>r.id),['own','incoming']);
 assert.equal(technicianSnapshot(records,null,'u').length,0);
});
test('main and custom allocations include only own rows and preserve dates and metadata',()=>{
 const day={kind:'allocation_day',id:'2026-10-16',version:3,payload:{allocations:[{technicianId:'089'},{technicianId:'170'},{technicianId:''}],customSections:[{title:'Site',rows:[{technicianId:89},{technicianId:'181'}]},{title:'Private',rows:[{technicianId:'170'}]}]}};
 const before=JSON.stringify(day),[visible]=technicianSnapshot([day],'89','u');
 assert.equal(visible.id,'2026-10-16');assert.equal(visible.version,3);
 assert.deepEqual(visible.payload.allocations,[{technicianId:'089'}]);
 assert.deepEqual(visible.payload.customSections,[{title:'Site',rows:[{technicianId:89}]}]);
 assert.equal(JSON.stringify(day),before);
});
test('other records retain ownership restrictions',()=>{
 const records=[{kind:'technician',technician_id:'089'},{kind:'technician',technician_id:'170'},{kind:'leave',technician_id:'89'},{kind:'overtime',owner_id:'u'},{kind:'overtime',owner_id:'other'},{kind:'leave_request',owner_id:'u'},{kind:'holiday'},{kind:'team_settings'},{kind:'callout_roster'}];
 assert.deepEqual(technicianSnapshot(records,'89','u').map(r=>r.kind),['technician','leave','overtime','leave_request','holiday','team_settings']);
});

