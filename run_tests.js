const fs=require('fs'),vm=require('vm'),assert=require('assert');
const fakeStore=new Map();
const ctx={
 console, Math, Date, JSON, Number, String, Array, Object, Set, Map, Promise,
 crypto:{randomUUID:()=> 'test-writer'},
 localStorage:{getItem:k=>fakeStore.get(k)||null,setItem:(k,v)=>fakeStore.set(k,String(v)),removeItem:k=>fakeStore.delete(k)},
 indexedDB:{open:()=>{throw new Error('not used in core test')}},
 window:{addEventListener(){},},
 document:{activeElement:null,getElementById(){return {value:'',checked:false,textContent:'',classList:{toggle(){}},closest(){return null}}},querySelectorAll(){return []},addEventListener(){},body:{classList:{toggle(){}}}},
 setTimeout:()=>{},clearTimeout:()=>{},setInterval:()=>{},URL,Blob,
};
vm.createContext(ctx);
let code=fs.readFileSync('/mnt/data/ledger_v28/test_core.js','utf8');
vm.runInContext(code,ctx);
const run=src=>vm.runInContext(src,ctx);
run('db=clone(defaultDB)');
// historical rate selection
run("db.fxHistory=[{id:1,date:'2026-09-01',rate:11.5},{id:2,date:'2026-10-01',rate:11.0}]" );
assert.strictEqual(run("rateForDate('2026-09-15')"),11.5);
assert.strictEqual(run("rateForDate('2026-10-03')"),11);
// timeline ordering and scoped validation
run("db.accounts=[{id:1,name:'A',currency:'RUB',initial:100,allowNegative:false,active:true},{id:2,name:'B',currency:'RUB',initial:0,allowNegative:false,active:true},{id:3,name:'C',currency:'CNY',initial:0,allowNegative:false,active:true}]");
run("db.tx=[{id:1,type:'expense',amount:80,currency:'RUB',account:1,category:'餐饮',date:'2026-10-01',occurredAt:'2026-10-01T10:00',createdAt:1,fxRate:11},{id:2,type:'income',amount:50,currency:'RUB',account:1,category:'工资',date:'2026-10-01',occurredAt:'2026-10-01T12:00',createdAt:2,fxRate:11}]");
assert.strictEqual(run("validateAccountTimeline()"),'');
run("db.accounts[0].initial=50");
assert.ok(run("validateAccountTimeline(new Set([1]))").includes('余额不足'));
assert.strictEqual(run("validateAccountTimeline(new Set([2]))"),'');
// current account timeline with unrelated negative account does not block validation for account 1
run("db.accounts[0].initial=100; db.accounts[1].initial=0; db.accounts.push({id:4,name:'Bad',currency:'RUB',initial:0,allowNegative:false,active:true}); db.tx.push({id:3,type:'expense',amount:100,currency:'RUB',account:4,category:'购物',date:'2026-10-01',occurredAt:'2026-10-01T09:00',createdAt:3,fxRate:11})");
assert.strictEqual(run("validateBalances({id:9,type:'expense',amount:10,currency:'RUB',account:1,category:'餐饮',date:'2026-10-02',occurredAt:'2026-10-02T10:00',createdAt:4,fxRate:11},0)"),'');
// invalid import date logic helper
assert.strictEqual(run("normalizeDate('2026-02-29')"),null);
assert.strictEqual(run("normalizeDate('2026-10-03')"),'2026-10-03');
// data wrapper parsing latest by timestamp
const wrapped=run("storageEnvelope({version:2.8,accounts:[],tx:[]},{revision:7,savedAt:999,writerId:'x'})");
assert.strictEqual(JSON.parse(wrapped).revision,7);
console.log('core tests passed');
