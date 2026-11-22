import {clone,type Store} from './model.js'
export type StoreStorage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}
export class StoreConflict extends Error{
 constructor(){super('其他标签页已更新数据，请刷新后重新核对并提交；本次修改未保存。')}
}
export class StoreRecoveryRequired extends Error{
 constructor(){super('本地数据尚未成功读取，本次操作未保存。请刷新重试；如需放弃原数据，请使用原型验收工具中的重置演示数据。')}
}
// Publish the new state only after its complete snapshot has been stored.
export function transactStore(current:Store,mutate:(next:Store)=>Store|void,storage:StoreStorage,key:string,expected:string|null,recoveryRequired=false){
 if(recoveryRequired)throw new StoreRecoveryRequired()
 if(storage.getItem(key)!==expected)throw new StoreConflict()
 const draft=clone(current)
 const next=mutate(draft)??draft
 const token=JSON.stringify(next)
 storage.setItem(key,token)
 return {store:next,token}
}
