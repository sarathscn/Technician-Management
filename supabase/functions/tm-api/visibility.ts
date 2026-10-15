// Match the dashboard's numeric technician IDs, including legacy zero padding.
export function sameTechnician(left: unknown, right: unknown): boolean {
 const normalize=(value: unknown)=>String(value??'').trim().replace(/^0+(?=\d)/,'');
 const id=normalize(left);
 return !!id && id===normalize(right);
}

export function technicianSnapshot(records: any[], technicianId: unknown, ownerId: string): any[] {
 return records.flatMap(record=>{
  const payload=record.payload||{};
  if(record.kind==='allocation_day'){
   const own=(row: any)=>sameTechnician(row.technicianId,technicianId);
   return [{...record,payload:{...payload,
    allocations:(payload.allocations||[]).filter(own),
    customSections:(payload.customSections||[]).map((section: any)=>({...section,rows:(section.rows||[]).filter(own)})).filter((section: any)=>section.rows.length)
   }}];
  }
  // Reassignment replaces the original technician's access, as in the dashboard.
  if(record.kind==='callout')return sameTechnician(payload.rescheduledTechnicianId||payload.assignedTechnicianId,technicianId)?[record]:[];
  if(['holiday','team_settings'].includes(record.kind)||
   ['technician','leave'].includes(record.kind)&&sameTechnician(record.technician_id,technicianId)||
   ['leave_request','overtime'].includes(record.kind)&&record.owner_id===ownerId)return [record];
  return [];
 });
}

