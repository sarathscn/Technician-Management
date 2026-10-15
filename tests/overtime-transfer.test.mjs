import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overtimeInvitations,invitedOvertimeCopy,validateTechnicianImport} from '../supabase/functions/tm-api/overtime-transfer.ts';
const actor={id:'recipient',technician_id:'170',name:'Recipient',role:'Technician'};
const source={kind:'overtime',id:'source',owner_id:'sender',payload:{ownerId:'sender',ownerName:'Sender',ownerTechnicianId:'181',teamIds:['00170','182'],date:'2026-10-16',start:'17:00',end:'20:00',work:'Repair',teamNames:['Recipient','Other']}};
test('only selected technicians receive overtime invitations, without exposing unrelated overtime',()=>{
 assert.equal(overtimeInvitations([source],actor).length,1);
 assert.equal(overtimeInvitations([source],{...actor,technician_id:'999'}).length,0);
 assert.equal(overtimeInvitations([source],{...actor,id:'sender'}).length,0);
 assert.equal(overtimeInvitations([{...source,payload:{...source.payload,teamIds:undefined}}],actor).length,0);
});
test('accept copies shared fields under recipient ownership and cannot fan out invitations',()=>{
 const copy=invitedOvertimeCopy(source,actor,[{id:'181',name:'Sender'},{id:'182',name:'Other'}]);
 assert.equal(copy.ownerId,'recipient');assert.equal(copy.ownerTechnicianId,'170');assert.equal(copy.work,'Repair');assert.equal(copy.start,'17:00');
 assert.deepEqual(copy.teamIds,['181','182']);assert.deepEqual(copy.teamNames,['Sender','Other']);
 assert.equal(invitedOvertimeCopy(source,actor,[]).id,copy.id);
 const saved={kind:'overtime',id:copy.id,owner_id:actor.id,payload:copy};
 assert.equal(overtimeInvitations([source,saved],actor).length,0);
 assert.equal(overtimeInvitations([saved],{id:'other',technician_id:'182'}).length,0);
 assert.throws(()=>invitedOvertimeCopy(source,{...actor,technician_id:'999'},[]));
});
test('technician import preserves full data but rejects malformed or credential-bearing input',()=>{
 const input={id:'00170',name:'Technician',mobileNumber:'12345678',role:'Alarm',cprNumber:'private',visaNumber:'visa',passes:[{name:'Gate',expiryDate:'2027-01-01',number:'pass'}],extra:'retained'};
 assert.deepEqual(validateTechnicianImport(input),input);
 for(const change of [{id:''},{id:'123456'},{name:''},{mobileNumber:'12'},{password:'secret'},{passes:[{name:'Gate'}]}])assert.throws(()=>validateTechnicianImport({...input,...change}));
});
