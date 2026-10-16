import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTemporaryPassword} from '../supabase/functions/tm-api/account-security.ts';
test('temporary passwords are unpredictable and meet character and length requirements',()=>{
 const values=Array.from({length:100},createTemporaryPassword);assert.equal(new Set(values).size,100);
 for(const value of values){assert.equal(value.length,24);assert.match(value,/[A-Z]/);assert.match(value,/[a-z]/);assert.match(value,/\d/);assert.match(value,/[!@#$]/);}
});
