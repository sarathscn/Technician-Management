import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

// Deploy with gateway JWT verification disabled: login is public, every other
// action verifies the access token and active profile explicitly below.
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const url = Deno.env.get('SUPABASE_URL')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const manage=(actor:string,target:string)=>actor==='Administrator'||actor==='Admin'&&['Coordinator','Technician'].includes(target)||actor==='Coordinator'&&target==='Technician';
const fail=(error:unknown)=>{if(error)throw Error('Database operation failed.');};
async function provisionTechnician(tech:any){
 const id=String(tech.id||'');
 if(!/^\d{1,5}$/.test(id)||!String(tech.name||'').trim())throw Error('Invalid technician');
 const {data:linked,error:lookup}=await admin.from('tm_profiles').select('id').eq('technician_id',id).limit(1);fail(lookup);
 if(linked?.length)return null;
 const username=(String(tech.name).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')||'technician')+'@'+id;
 const password='Tm!'+crypto.randomUUID().replaceAll('-','').slice(0,18);
 const {data,error}=await admin.auth.admin.createUser({email:username.replace('@','.')+'@technician-management.invalid',password,email_confirm:true});
 if(error||!data.user)throw Error('Could not provision technician login');
 const {error:profileError}=await admin.from('tm_profiles').insert({id:data.user.id,username,name:String(tech.name).trim(),technician_id:id,role:'Technician',status:'Active'});
 if(profileError){await admin.auth.admin.deleteUser(data.user.id);throw Error('Could not link technician login');}
 return {name:tech.name,username,password,technician_id:id};
}

Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});
 if(request.method!=='POST')return reply({error:'POST required'},405);
 try{
  const input=await request.json();
  if(input.action==='login'){
   const username=String(input.username||'').trim().toLowerCase();
   const {data:profile,error}=await admin.from('tm_profiles').select('*').eq('username',username).eq('status','Active').maybeSingle();
   if(error||!profile)return reply({error:'Invalid username or password.'},401);
   const {data:account,error:lookupError}=await admin.auth.admin.getUserById(profile.id);
   if(lookupError||!account.user?.email)return reply({error:'Invalid username or password.'},401);
   const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error:authError}=await auth.auth.signInWithPassword({email:account.user.email,password:String(input.password||'')});
   if(authError||!data.session)return reply({error:'Invalid username or password.'},401);
   return reply({session:data.session,profile});
  }
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return reply({error:'Sign in required'},401);
  const {data:verified,error:tokenError}=await admin.auth.getUser(token);
  if(tokenError||!verified.user)return reply({error:'Session expired'},401);
  const {data:actor,error:actorError}=await admin.from('tm_profiles').select('*').eq('id',verified.user.id).eq('status','Active').single();
  if(actorError||!actor)return reply({error:'Account inactive'},403);
  if(input.action==='me')return reply({profile:actor});
  if(input.action==='provision_technicians'){
   if(!['Administrator','Admin','Coordinator'].includes(actor.role))return reply({error:'Access denied'},403);
   const {data,error}=await admin.from('tm_records').select('payload').eq('kind','technician');fail(error);
   const credentials=[];const failed=[];
   for(const row of data||[]){try{const account=await provisionTechnician(row.payload);if(account)credentials.push(account);}catch{failed.push(String(row.payload.id));}}
   return reply({credentials,failed});
  }
  if(input.action==='snapshot'){
   const manager=['Administrator','Admin','Coordinator'].includes(actor.role);
   let query=admin.from('tm_records').select('*').order('kind').order('id');
   // Page the result; PostgREST defaults to 1000 records.
   const records:Record<string,unknown>[]=[];
   for(let offset=0;;offset+=500){const {data,error}=await query.range(offset,offset+499);fail(error);records.push(...(data||[]));if((data||[]).length<500)break;}
   const filtered=manager?records:records.flatMap((record:any)=>{
    if(record.kind==='allocation_day'){
     const own=(row:any)=>String(row.technicianId)===String(actor.technician_id);
     return [{...record,payload:{...record.payload,allocations:(record.payload.allocations||[]).filter(own),customSections:(record.payload.customSections||[]).map((s:any)=>({...s,rows:(s.rows||[]).filter(own)})).filter((s:any)=>s.rows.length)}}];
    }
    if(['holiday','team_settings'].includes(record.kind)||['technician','leave'].includes(record.kind)&&record.technician_id===actor.technician_id||['leave_request','overtime'].includes(record.kind)&&record.owner_id===actor.id)return [record];
    return [];
   });
   const {data:profiles,error}=await admin.from('tm_profiles').select('id,username,name,technician_id,role,status,created_at');fail(error);
   return reply({profile:actor,records:filtered,users:manager?profiles:(profiles||[]).filter(p=>p.id===actor.id||p.role==='Coordinator'&&p.status==='Active')});
  }
  if(input.action==='save_record'){
   const {data,error}=await admin.rpc('tm_save_record',{p_actor:actor.id,p_kind:input.kind,p_id:input.id,p_payload:input.payload||{},p_version:Number(input.version||0),p_delete:!!input.deleted});
   if(error)return reply({error:error.message.includes('CONFLICT')?'Another user updated this record. Reload before saving.':'Database save denied or invalid record.'},error.message.includes('CONFLICT')?409:403);
   if(input.kind==='technician'&&!input.deleted&&['Administrator','Admin','Coordinator'].includes(actor.role)){
    try{const credential=await provisionTechnician(data.payload);return reply({record:data,credentials:credential?[credential]:[]});}
    catch{return reply({record:data,accountWarning:'Technician saved, but login creation failed. Use Create missing technician logins in User Management to retry.'});}
   }
   return reply({record:data});
  }
  if(input.action==='users'){
   if(!['Administrator','Admin','Coordinator'].includes(actor.role))return reply({error:'Access denied'},403);
   const {data,error}=await admin.from('tm_profiles').select('*').order('created_at');fail(error);
   return reply({users:data});
  }
  if(input.action==='create_user'){
   const role=String(input.role||'Technician');
   if(!manage(actor.role,role))return reply({error:'Role assignment denied'},403);
   const username=String(input.username||'').trim().toLowerCase();
   const name=String(input.name||'').trim();
   if(!/^[a-z0-9._-]+(?:@[a-z0-9_-]+)?$/.test(username)||!name||String(input.password||'').length<8)return reply({error:'Valid username, name and password of at least 8 characters required'},400);
   const email=String(input.email||username.replace('@','.')+'@technician-management.invalid').trim().toLowerCase();
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'Valid account email required'},400);
   const {data,error}=await admin.auth.admin.createUser({email,password:input.password,email_confirm:true});
   if(error||!data.user)return reply({error:'Could not create Auth account. Check email uniqueness and password requirements.'},400);
   const {error:profileError}=await admin.from('tm_profiles').insert({id:data.user.id,username,name,role,technician_id:String(input.technician_id||username.split('@')[1]),status:'Active'});
   if(profileError){await admin.auth.admin.deleteUser(data.user.id);return reply({error:'Could not create profile. Username may already exist.'},400);}
   return reply({id:data.user.id});
  }
  if(['update_user','delete_user','reset_password'].includes(input.action)){
   const {data:target,error}=await admin.from('tm_profiles').select('*').eq('id',input.id).single();
   if(error||!target)return reply({error:'Account not found'},404);
   if(target.id===actor.id)return reply({error:'Use your own profile/password settings'},403);
   if(!manage(actor.role,target.role))return reply({error:'Account management denied'},403);
   if(input.action==='delete_user'){
    // Preserve historical record ownership; suspension revokes application access.
    const {error}=await admin.from('tm_profiles').update({status:'Suspended'}).eq('id',target.id);fail(error);
    const result=await admin.auth.admin.updateUserById(target.id,{ban_duration:'876000h'});fail(result.error);
    return reply({ok:true,retainedForHistory:true});
   }
   if(input.action==='reset_password'){
    if(String(input.password||'').length<8)return reply({error:'Use at least 8 characters'},400);
    const result=await admin.auth.admin.updateUserById(target.id,{password:input.password});fail(result.error);return reply({ok:true});
   }
   const role=String(input.role||target.role),status=String(input.status||target.status);
   if(!manage(actor.role,role)||!['Active','Suspended'].includes(status))return reply({error:'Role/status denied'},403);
   if(target.role==='Administrator'&&(role!=='Administrator'||status!=='Active')){
    const {count,error}=await admin.from('tm_profiles').select('id',{count:'exact',head:true}).eq('role','Administrator').eq('status','Active').neq('id',target.id);fail(error);
    if(!count)return reply({error:'Keep an active Super Admin'},400);
   }
   const authUpdate=await admin.auth.admin.updateUserById(target.id,{ban_duration:status==='Suspended'?'876000h':'none'});fail(authUpdate.error);
   const result=await admin.from('tm_profiles').update({name:String(input.name||target.name),role,status}).eq('id',target.id);fail(result.error);return reply({ok:true});
  }
  return reply({error:'Unsupported action'},400);
 }catch{return reply({error:'Request failed. Check server configuration and request fields.'},400);}
});

