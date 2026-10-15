import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function transferTechnicianKey('),html.indexOf('var TechnicianTransferControls='));
const helpers=new Function('gatePassValidationError','technicianPasses',source+'return {prepareTechnicianImport,mergeImportedTeams};')(
 passes=>passes.some(p=>!p.name||!p.expiryDate)?'Invalid pass':'',tech=>tech.passes||[]);
test('import preview skips existing and duplicate IDs, including legacy zero padding',()=>{
 const plan=helpers.prepareTechnicianImport({technicians:[{id:'170',name:'Overwrite'},{id:'181',name:'New',cprNumber:'CPR',passes:[{name:'Pass',expiryDate:'2027-01-01',number:'N'}]},{id:'00181',name:'Duplicate'},{id:'bad',name:'Invalid'}]},[{id:'00170',name:'Existing'}]);
 assert.equal(plan.skipped,2);assert.equal(plan.invalid.length,1);assert.equal(plan.added.length,1);assert.equal(plan.added[0].cprNumber,'CPR');assert.equal(plan.added[0].passes[0].number,'N');
});
test('team import preserves existing members and restores only newly imported members',()=>{
 const settings={anchorDate:'2026-01-03',teams:[{id:'one',name:'Existing team',technicianIds:['170']}]};
 const merged=helpers.mergeImportedTeams(settings,[{id:'one',name:'Changed name',technicianIds:['170','181']},{id:'two',name:'New team',technicianIds:['182','999']}],['181','182']);
 assert.deepEqual(merged.teams[0],{id:'one',name:'Existing team',technicianIds:['170','181']});assert.deepEqual(merged.teams[1].technicianIds,['182']);assert.deepEqual(settings.teams[0].technicianIds,['170']);
 assert.throws(()=>helpers.mergeImportedTeams(settings,[{id:'two',technicianIds:['181']}],['181'],1));
});
test('exported full profile data survives import planning without truncating unknown fields',()=>{
 const technician={id:'181',name:'New',role:'Senior technician',mobileNumber:'12345678',cprNumber:'123',cprExpiryDate:'2027-01-01',visaNumber:'456',visaExpiryDate:'2027-02-01',passes:[{id:'p',name:'Site',number:'P',location:'Manama',expiryDate:'2027-03-01'}],custom:{retained:true}};
 assert.deepEqual(helpers.prepareTechnicianImport(JSON.parse(JSON.stringify({technicians:[technician]})),[]).added,[technician]);
});
