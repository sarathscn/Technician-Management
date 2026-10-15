// The RPC has already removed these application profiles atomically, denying
// further app access even if the Auth provider is temporarily unavailable.
export async function deleteLinkedAuthUsers(authAdmin: any, ids: string[]): Promise<string[]> {
 const failed: string[]=[];
 for(const id of [...new Set(ids)]){
  try{
   const {error}=await authAdmin.deleteUser(id);
   if(error&&error.status!==404)failed.push(id);
  }catch{failed.push(id);}
 }
 return failed;
}
