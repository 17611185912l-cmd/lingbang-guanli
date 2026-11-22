import test from 'node:test'
import assert from 'node:assert/strict'
import {transactStore,StoreConflict,StoreRecoveryRequired} from '../.test-build/persistence.js'
import {clone,deliver} from '../.test-build/model.js'
const initial=()=>({schema:3,config:{member:{enabled:true,closeMode:'purchase-only',closedClock:'continue'}},configId:'V1',users:[{id:'U',memberExpiry:null,blocked:false}],grants:[{id:'G',kind:'member',userId:'U',months:1,status:'发放失败',createdAt:1,attempts:1}],stock:{},logs:[],seq:1})
const memoryStorage=(token)=>({token,getItem(){return this.token},setItem(key,value){this.token=value}})
test('奖励重试写入失败保持原资产，重试成功后只到账一次',()=>{
 const before=initial(),token=JSON.stringify(before),storage=memoryStorage(token)
 storage.setItem=()=>{throw new Error('QuotaExceededError')}
 assert.throws(()=>transactStore(before,next=>deliver(next,next.grants[0],Date.now()),storage,'test',token))
 assert.equal(before.grants[0].status,'发放失败');assert.equal(before.users[0].memberExpiry,null);assert.equal(storage.token,token)
 storage.setItem=function(key,value){this.token=value}
 const saved=transactStore(before,next=>deliver(next,next.grants[0],Date.now()),storage,'test',token)
 assert.equal(saved.store.grants[0].status,'已发放');assert.ok(saved.store.users[0].memberExpiry>Date.now());assert.equal(before.users[0].memberExpiry,null)
 const expiry=saved.store.users[0].memberExpiry
 const repeated=transactStore(saved.store,next=>deliver(next,next.grants[0],Date.now()),storage,'test',saved.token)
 assert.equal(repeated.store.users[0].memberExpiry,expiry)
})
test('撤回、核验与重置在存储失败时不改变原记录',()=>{
 for(const mutate of [next=>{next.grants[0].status='已撤回'},next=>{next.logs.push({detail:'核验通过'});next.seq++},()=>({...initial(),grants:[]})]){
  const original=initial(),snapshot=clone(original),token=JSON.stringify(original),storage=memoryStorage(token)
  storage.setItem=()=>{throw new Error('denied')}
  assert.throws(()=>transactStore(original,mutate,storage,'test',token));assert.deepEqual(original,snapshot);assert.equal(storage.token,token)
 }
})
test('旧标签页提交被拦截，刷新后的新版本可以保存',()=>{
 const base=initial(),token=JSON.stringify(base),storage=memoryStorage(token)
 const first=transactStore(base,next=>{next.seq++;next.logs.push({detail:'标签A'})},storage,'test',token)
 let mutated=false
 assert.throws(()=>transactStore(base,()=>{mutated=true},storage,'test',token),StoreConflict)
 assert.equal(mutated,false);assert.equal(storage.token,first.token)
 const latest=JSON.parse(storage.token),second=transactStore(latest,next=>{next.logs.push({detail:'刷新后的标签B'})},storage,'test',storage.token)
 assert.equal(second.store.logs.length,2)
})
test('读取存储失败也不发布更改；重置替换快照不残留暂停状态',()=>{
 const before=initial();before.memberPause={startedAt:1,users:{U:1}}
 assert.throws(()=>transactStore(before,next=>{next.seq++},{getItem(){throw new Error('denied')},setItem(){}},'test',null));assert.equal(before.seq,1)
 const token=JSON.stringify(before),storage=memoryStorage(token),reset=transactStore(before,()=>initial(),storage,'test',token)
 assert.equal('memberPause' in reset.store,false);assert.ok(before.memberPause)
})
test('恢复读取前不能以演示快照覆盖原数据，明确重置仍须先检查冲突并成功写入',()=>{
 const source='{invalid',storage=memoryStorage(source),before=initial()
 let mutated=false
 assert.throws(()=>transactStore(before,()=>{mutated=true},storage,'test',source,true),StoreRecoveryRequired)
 assert.equal(mutated,false);assert.equal(storage.token,source)
 const reset=transactStore(before,()=>initial(),storage,'test',source)
 assert.deepEqual(JSON.parse(storage.token),reset.store)
 assert.throws(()=>transactStore(before,()=>initial(),storage,'test',source),StoreConflict)
})
