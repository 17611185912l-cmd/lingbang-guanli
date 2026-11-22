import {addMonths,clone,deliver,migrateStore,defaultVoucherUsage,type Config,type Store,type Grant,type Role,progressKey} from './model.js'
import type {StoreStorage} from './persistence.js'
export const storageKey='lingbang-member-rewards-admin-v3'
export function baseline():Config{return {
 demandPayment:{enabled:true,amount:9.9},
 member:{enabled:true,closeMode:'purchase-only',closedClock:'continue',badgeIcon:'',plans:[{id:'SKU-MONTH',name:'月度会员',months:1,price:19.9,enabled:true},{id:'SKU-YEAR',name:'年度会员',months:12,price:99.9,enabled:true}],benefits:[{code:'DIRECTED_DEMAND',icon:'',name:'发布定向需求',description:'指定心仪老师，直接向其发送需求',enabled:true},{code:'DEDICATED_SUPPORT',icon:'',name:'专属 1v1 客服',description:'专人跟进服务，协助匹配老师',enabled:true}]},
 vouchers:{templates:[{id:'VC-INVITE-002',name:'邀请好友 2 元优惠券',type:'amount',amount:2,enabled:true,validity:'relative',days:30,fixedStart:'',fixedEnd:'',totalLimit:0,perUserLimit:0,note:'下单支付时可抵扣',usage:defaultVoucherUsage()},{id:'VC-REDEEM-001',name:'需求发布／接单支付抵用券',type:'times',amount:null,enabled:true,validity:'relative',days:30,fixedStart:'',fixedEnd:'',totalLimit:0,perUserLimit:0,note:'需求发布或接单支付，任选一次抵用',usage:{...defaultVoucherUsage(),orderScope:['需求发布','接单支付'],refund:'original'}}]},
 activitySettings:{stacking:'all'},activities:[{id:'ACT-INVITE-001',name:'邀请好友双重奖励',enabled:true,trigger:'invite-register',note:'每10人送1个月会员，每1人送2元优惠券，同时获得',period:'permanent',start:'',end:'',inviterRoles:['parent','teacher'],inviteeRoles:['parent','teacher'],riskPolicy:'hold',rewards:[{kind:'member',enabled:true,target:10,months:1,repeat:true,perUserLimit:0},{kind:'voucher',enabled:true,target:1,templateId:'VC-INVITE-002',quantity:1,repeat:true,perUserLimit:0}]}]
}}
export function seedStore():Store{
 const c=baseline(),now=Date.now();const store:Store={schema:3,config:c,configId:'INITIAL',savedAt:{},users:[{id:'U1001',name:'张*悦',phone:'138****2601',role:'parent',memberExpiry:addMonths(now-3*86400000,1),blocked:false},{id:'U1002',name:'陈*安',phone:'156****7328',role:'teacher',memberExpiry:now-3*86400000,blocked:false},{id:'U1003',name:'李*宁',phone:'137****6842',role:'partner',memberExpiry:null,blocked:false},{id:'U1004',name:'王*',phone:'159****2075',role:'parent',memberExpiry:null,blocked:true}],invites:[],grants:[],progress:{[progressKey('U1001','ACT-INVITE-001','member')]:{count:2,target:10,months:1,version:'DEMO-BASE',reward:clone(c.activities[0].rewards[0])}},logs:[],stock:{},seq:1000}
 const t=c.vouchers.templates[0],activity={activityId:c.activities[0].id,activityName:c.activities[0].name}
 for(let i=1;i<=12;i++){
  const at=now-(i>10?40+i:13-i)*86400000
  store.invites.push({id:'EV-DEMO-'+i,inviterId:'U1001',inviteeId:'NEW-'+i,name:['林*','周*','孙*'][i%3],role:(['parent','teacher'] as Role[])[i%2],inviterRole:'parent',at,isNew:true,risk:false,failure:'none',...activity,activityResults:[{...activity,status:'已计数',reason:'原邀请活动演示记录'}],status:'有效',reason:'演示：首次有效注册，统一用户ID去重',version:'DEMO-BASE'})
  const g:Grant={id:'GR-DEMO-'+String(i).padStart(3,'0'),key:'EV-DEMO-'+i+':voucher:1',userId:'U1001',kind:'voucher',source:'邀请奖励',...activity,eventId:'EV-DEMO-'+i,version:'DEMO-BASE',status:'待发放',reason:'',createdAt:at,amount:2,months:0,template:clone(t),usage:clone(t.usage),attempts:0}
  store.grants.push(g);deliver(store,g,at);if(i===6||i===8)g.usedAt=at+3600000
 }
 store.grants.unshift({id:'GR-DEMO-M1',key:'EV-DEMO-10:member:1',userId:'U1001',kind:'member',source:'邀请奖励',...activity,eventId:'EV-DEMO-10',version:'DEMO-BASE',status:'已发放',reason:'累计第10位有效新用户',createdAt:now-3*86400000,issuedAt:now-3*86400000,amount:0,months:1,memberStart:now-3*86400000,memberEnd:addMonths(now-3*86400000,1),attempts:1})
 store.grants.unshift({id:'GR-DEMO-FAIL',key:'EV-DEMO-FAIL:voucher:1',userId:'U1002',kind:'voucher',source:'邀请奖励',...activity,eventId:'EV-DEMO-FAIL',version:'DEMO-BASE',status:'发放失败',reason:'权益服务超时，等待原单重试',createdAt:now-3600000,amount:2,months:0,template:clone(t),usage:clone(t.usage),attempts:1})
 store.grants.unshift({id:'GR-DEMO-HOLD',key:'EV-DEMO-HOLD:voucher:1',userId:'U1004',kind:'voucher',source:'邀请奖励',...activity,eventId:'EV-DEMO-HOLD',version:'DEMO-BASE',status:'人工处理',reason:'账号被冻结，需先核验账号状态',createdAt:now-1800000,amount:2,months:0,template:clone(t),usage:clone(t.usage),attempts:1})
 store.logs.push({id:'LOG-SEED',at:now,operator:'系统演示',action:'初始化演示数据',target:'独立原型',detail:'包含12条有效邀请、1笔月会员、12张券，以及发放失败和账号异常。DEMO-BASE是演示快照，不表示生产已上线。'})
 return store
}
export function loadStore(storage?:Pick<StoreStorage,'getItem'>):{store:Store;notice:string;token:string|null;recoveryRequired:boolean}{
 let token:string|null=null
 try{
  const source=storage??localStorage
  const current=source.getItem(storageKey);token=current
  const text=current??source.getItem('lingbang-member-rewards-admin-v2')??source.getItem('lingbang-member-rewards-admin-v1')
  if(text===null)return {store:seedStore(),notice:'',token,recoveryRequired:false}
  const migrated=migrateStore(JSON.parse(text))
  if(!migrated)return {store:seedStore(),notice:'本机数据格式不兼容，当前仅展示演示数据；已暂停保存，原存储保留。请刷新重试或明确重置演示数据。',token,recoveryRequired:true}
  return {...migrated,token,recoveryRequired:false}
 }catch{return {store:seedStore(),notice:'本地数据不可用，当前仅展示演示数据；已暂停保存，原存储保留。请检查浏览器存储权限后刷新，或明确重置演示数据。',token,recoveryRequired:true}}
}
