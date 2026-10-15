export async function auditTechnicianLogins(technicians: any[], lookup: (id: string)=>Promise<any[]>, verify: (id: string)=>Promise<any>, provision: (tech: any)=>Promise<any>) {
 const result={checked:technicians.length,existing:0,skipped:0,inactive:0,credentials:[] as any[],failed:[] as string[]};
 for(const tech of technicians){
  const id=String(tech.id);
  try{
   const profiles=await lookup(id);
   if(profiles.some(profile=>['Administrator','Admin','Coordinator'].includes(profile.role))){result.skipped++;continue;}
   const linked=profiles.filter(profile=>profile.role==='Technician');
   if(!linked.length){const credentials=await provision(tech);if(!credentials)throw Error('Login could not be verified');result.credentials.push(credentials);continue;}
   let inactive=false;
   for(const profile of linked){
    const {data,error}=await verify(profile.id);
    if(error||!data?.user)throw Error('Authentication account missing');
    if(profile.status!=='Active'||new Date(data.user.banned_until||0).getTime()>Date.now())inactive=true;
   }
   result.existing++;if(inactive)result.inactive++;
  }catch{result.failed.push(id);}
 }
 return result;
}
