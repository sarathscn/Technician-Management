import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canRemoveCoordinator} from '../supabase/functions/tm-api/account-removal.ts';
test('only active administrators can remove another coordinator account',()=>{
 const target={id:'coordinator',role:'Coordinator'};
 for(const role of ['Administrator','Admin'])assert.equal(canRemoveCoordinator({id:'manager',role,status:'Active'},target),true);
 for(const role of ['Coordinator','Technician'])assert.equal(canRemoveCoordinator({id:'manager',role,status:'Active'},target),false);
 assert.equal(canRemoveCoordinator({id:'coordinator',role:'Administrator',status:'Active'},target),false);
 assert.equal(canRemoveCoordinator({id:'manager',role:'Administrator',status:'Suspended'},target),false);
 for(const role of ['Administrator','Admin','Technician'])assert.equal(canRemoveCoordinator({id:'manager',role:'Administrator',status:'Active'},{id:'target',role}),false);
});
