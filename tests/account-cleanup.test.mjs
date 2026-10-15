import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deleteLinkedAuthUsers} from '../supabase/functions/tm-api/account-cleanup.ts';
test('removes all linked authentication accounts once',async()=>{
 const deleted=[];const failed=await deleteLinkedAuthUsers({deleteUser:async id=>{deleted.push(id);return {error:null};}},['one','two','one']);
 assert.deepEqual(deleted,['one','two']);assert.deepEqual(failed,[]);
});
test('already deleted users are successful; provider failures are reported',async()=>{
 const failed=await deleteLinkedAuthUsers({deleteUser:async id=>{if(id==='network')throw Error('Offline');return {error:id==='gone'?{status:404}:{status:500}};}},['gone','failed','network']);
 assert.deepEqual(failed,['failed','network']);
});
