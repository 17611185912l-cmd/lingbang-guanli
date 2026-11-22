import test from 'node:test'
import assert from 'node:assert/strict'
import {loadStore,seedStore,storageKey} from '../.test-build/data.js'
const sourceStorage=(values)=>({getItem(key){return values[key]??null}})
test('空存储可首次保存，正常存储读取后保留原比较令牌',()=>{
 const first=loadStore(sourceStorage({}))
 assert.equal(first.recoveryRequired,false);assert.equal(first.token,null)
 const raw=JSON.stringify(seedStore()),loaded=loadStore(sourceStorage({[storageKey]:raw}))
 assert.equal(loaded.recoveryRequired,false);assert.equal(loaded.token,raw);assert.equal(loaded.store.grants.length,15)
})
test('损坏、不兼容和空文本只展示演示数据并暂停保存，不回退旧版本覆盖当前记录',()=>{
 for(const raw of ['{invalid','{"schema":99}','']){
  const values={[storageKey]:raw,'lingbang-member-rewards-admin-v2':JSON.stringify(seedStore())},before={...values}
  const loaded=loadStore(sourceStorage(values))
  assert.equal(loaded.recoveryRequired,true);assert.equal(loaded.token,raw);assert.match(loaded.notice,/暂停保存/);assert.deepEqual(values,before)
 }
})
test('读取中途失败保留已读的当前令牌，旧键损坏时也不允许误保存演示数据',()=>{
 const unavailable=loadStore()
 assert.equal(unavailable.recoveryRequired,true)
 const denied=loadStore({getItem(){throw new Error('SecurityError')}})
 assert.equal(denied.recoveryRequired,true);assert.equal(denied.token,null)
 const legacy=loadStore(sourceStorage({'lingbang-member-rewards-admin-v2':'bad'}))
 assert.equal(legacy.recoveryRequired,true);assert.equal(legacy.token,null)
 const current='{"schema":3,"config":{},"grants":[]}',partial=loadStore(sourceStorage({[storageKey]:current}))
 assert.equal(partial.recoveryRequired,true);assert.equal(partial.token,current)
})
