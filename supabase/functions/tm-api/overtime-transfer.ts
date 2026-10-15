import { sameTechnician } from './visibility.ts';
export function overtimeInvitations(records:any[], actor:any) {
 const accepted=new Set(records.filter(r=>r.kind==='overtime'&&r.owner_id===actor.id).map(r=>r.payload?.sourceOvertimeId).filter(Boolean));
 return records.filter(r=>r.kind==='overtime'&&r.owner_id!==actor.id&&!r.payload?.sourceOvertimeId&&Array.isArray(r.payload?.teamIds)&&r.payload.teamIds.some((id:any)=>sameTechnician(id,actor.technician_id))&&!accepted.has(r.id)).map(r=>({...r.payload,id:r.id,version:r.version}));
}
export function invitedOvertimeCopy(source:any,actor:any,directory:any[]) {
 if(source.kind!=='overtime'||source.owner_id===actor.id||source.payload?.sourceOvertimeId||!Array.isArray(source.payload?.teamIds)||!source.payload.teamIds.some((id:any)=>sameTechnician(id,actor.technician_id)))throw Error('This overtime invitation is not available to your account.');
 const p=source.payload;
 const ids=[p.ownerTechnicianId,...p.teamIds].filter(id=>id&&!sameTechnician(id,actor.technician_id));
 const teamIds=[...new Set(ids.map(String))];
 return {id:'ot-team-'+source.id+'-'+actor.id,sourceOvertimeId:source.id,sourceOwnerName:p.ownerName||'',ownerId:actor.id,ownerTechnicianId:actor.technician_id,ownerName:actor.name||actor.username,date:p.date,start:p.start,end:p.end,workType:p.workType,work:p.work,client:p.client,location:p.location,approvedBy:p.approvedBy||'',approvedById:p.approvedById||'',teamIds,teamNames:teamIds.map(id=>directory.find(t=>sameTechnician(t.id,id))?.name||id),createdAt:new Date().toISOString()};
}
export function validateTechnicianImport(input:any) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid technician record.');
 const id=String(input.id??'').trim(),name=String(input.name??'').trim();
 if(!/^\d{1,5}$/.test(id)||!name||name.length>100)throw Error('Each technician needs a name and an ID of 1–5 digits.');
 if(input.mobileNumber&&!/^\d{8}$/.test(String(input.mobileNumber)))throw Error('Mobile numbers must contain 8 digits.');
 if(input.passes&&!Array.isArray(input.passes))throw Error('Gate passes must be a list.');
 for(const pass of input.passes||[])if(!pass||!String(pass.name||'').trim()||!/^\d{4}-\d{2}-\d{2}$/.test(pass.expiryDate||''))throw Error('Each gate pass needs a name and expiry date.');
 const encoded=JSON.stringify(input);if(encoded.length>200000||/"(?:password|access_token|refresh_token|__proto__|constructor|prototype)"\s*:/.test(encoded))throw Error('Invalid technician data.');
 return {...input,id,name};
}
