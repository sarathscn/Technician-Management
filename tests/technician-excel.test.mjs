import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),XLSX=require('../dist/vendor/xlsx-0.20.3.full.min.js');
const window={XLSX};vm.runInNewContext(fs.readFileSync(new URL('../dist/technician-excel.js',import.meta.url),'utf8'),{window,Date,Map,Set,JSON});
const excel=window.TMTechnicianExcel;
const normalize=value=>JSON.parse(JSON.stringify(value));
test('Excel preserves identifiers, documents, multiple passes, custom fields and teams',()=>{
 const tech={id:'00170',name:'Test Technician',mobileNumber:'01234567',role:'Senior',cprNumber:'001234',cprExpiryDate:'2027-01-31',visaNumber:'000111',visaExpiryDate:'2027-02-28',custom:{value:'Retained'},passes:[{id:'p1',name:'Site 1',location:'Manama',number:'001',expiryDate:'2027-03-31',extra:'Retained'},{id:'p2',name:'Site 2',location:'Riffa',number:'002',expiryDate:'2027-04-30'}]};
 const data={technicians:[tech],saturdayTeams:[{id:'team1',name:'Team 1',color:'blue',technicianIds:['00170']}],calloutTeams:[]};
 const bytes=XLSX.write(excel.buildWorkbook(data),{type:'buffer',bookType:'xlsx'});const copy=normalize(excel.parseWorkbook(XLSX.read(bytes,{type:'buffer'})));
 assert.deepEqual(copy,data);
});
test('downloadable template is blank, includes all import sheets and retains text ID formatting',()=>{
 const book=XLSX.read(fs.readFileSync(new URL('../dist/technician-import-template.xlsx',import.meta.url)),{type:'buffer',cellNF:true,sheetStubs:true});
 assert.deepEqual(book.SheetNames,['Technicians','Gate Passes','Saturday Teams','Callout Teams','Instructions']);
 assert.deepEqual(normalize(excel.parseWorkbook(book)).technicians,[]);
 assert.equal(book.Sheets.Technicians.A2.z,'@');
});
test('Excel imports native dates and rejects orphan passes and missing technician sheet',()=>{
 const book=excel.buildWorkbook({technicians:[]});book.Sheets.Technicians=XLSX.utils.aoa_to_sheet([excel.profileColumns,['181','New Technician','12345678','Alarm','CPR',46687,'Visa','31/03/2027']]);
 const result=normalize(excel.parseWorkbook(book));assert.equal(result.technicians[0].cprExpiryDate,'2027-10-27');assert.equal(result.technicians[0].visaExpiryDate,'2027-03-31');
 book.Sheets['Gate Passes']=XLSX.utils.aoa_to_sheet([excel.passColumns,['999','','Pass','','','2027-01-01']]);assert.throws(()=>excel.parseWorkbook(book),/missing from/);
 assert.throws(()=>excel.parseWorkbook({Sheets:{},SheetNames:[]}),/Technicians sheet/);
});
