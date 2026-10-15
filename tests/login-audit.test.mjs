import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditTechnicianLogins} from '../supabase/functions/tm-api/login-audit.ts';
test('checks actual Auth accounts, creates only missing logins and preserves suspended accounts',async()=>{
 const techs=['001','170','181','089','404'].map(id=>({id,name:id})),verified=[],created=[];
 const profiles={'001':[{id:'admin',role:'Administrator'}],'170':[{id:'active',role:'Technician',status:'Active'}],'089':[{id:'suspended',role:'Technician',status:'Suspended'}],'404':[{id:'missing-auth',role:'Technician',status:'Active'}]};
 const result=await auditTechnicianLogins(techs,async id=>profiles[id]||[],async id=>{verified.push(id);return id==='missing-auth'?{error:{status:404}}:{data:{user:{id}}};},async tech=>{created.push(tech.id);return {technician_id:tech.id};});
 assert.deepEqual(verified,['active','suspended','missing-auth']);assert.deepEqual(created,['181']);
 assert.equal(result.checked,5);assert.equal(result.existing,2);assert.equal(result.inactive,1);assert.equal(result.skipped,1);assert.deepEqual(result.failed,['404']);
});
test('verification failures are reported without stopping checks for other technicians',async()=>{
 const result=await auditTechnicianLogins([{id:'1'},{id:'2'}],async id=>{if(id==='1')throw Error('Unavailable');return [];},async()=>({}),async tech=>({technician_id:tech.id}));
 assert.deepEqual(result.failed,['1']);assert.equal(result.credentials.length,1);assert.equal(result.checked,2);
});
