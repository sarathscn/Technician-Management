// Match the dashboard's numeric technician IDs, including legacy zero padding.
export function sameTechnician(left: unknown, right: unknown): boolean {
 const normalize=(value: unknown)=>String(value??'').trim().replace(/^0+(?=\d)/,'');
 const id=normalize(left);
 return !!id && id===normalize(right);
}

export function technicianDirectory(records: any[]): {id: string, name: string}[] {
 return records.filter(record=>record.kind==='technician').map(record=>({
  id:String(record.id),name:String(record.payload?.name||record.id)
 })).sort((a,b)=>a.name.localeCompare(b.name));
}

export function technicianSnapshot(records: any[], technicianId: unknown, ownerId: string): any[] {
 return records.flatMap(record=>{
  const payload=record.payload||{};
  // The daily allocation is a shared read-only team schedule for technicians.
  // Save permissions remain enforced independently by tm_save_record.
  if(record.kind==='allocation_day')return [record];
  // Reassignment replaces the original technician's access, as in the dashboard.
  if(record.kind==='callout')return sameTechnician(payload.rescheduledTechnicianId||payload.assignedTechnicianId,technicianId)?[record]:[];
  if(['holiday','team_settings'].includes(record.kind)||
   ['technician','leave'].includes(record.kind)&&sameTechnician(record.technician_id,technicianId)||
   ['leave_request','overtime'].includes(record.kind)&&record.owner_id===ownerId)return [record];
  return [];
 });
}
