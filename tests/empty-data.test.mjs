import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('var loadBahrainHolidaysFromStorage ='),html.indexOf('var saveBahrainHolidaysToStorage ='));
const load=value=>new Function('localStorage','DEFAULT_BAHRAIN_HOLIDAYS',source+'return loadBahrainHolidaysFromStorage();')({getItem:()=>value},[{id:'default'}]);
test('an explicitly empty holiday list stays empty after a data reset',()=>assert.deepEqual(load('[]'),[]));
test('existing holiday records still load and first-time offline defaults remain available',()=>{assert.deepEqual(load('[{"id":"saved"}]'),[{id:'saved'}]);assert.deepEqual(load(null),[{id:'default'}]);});
