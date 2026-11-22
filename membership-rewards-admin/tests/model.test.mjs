import test from 'node:test'
import assert from 'node:assert/strict'
import {addMonths,parseChina,stamp,cents,orderDiscount,processInvite,deliver,expiryOf,voucherStatus,validateConfig,validateModule,mergeModule,migrateStore,progressKey,auditInvite,clone,newActivity,benefitIconError,benefitIconMaxBytes,diffConfig,applyConfig,memberExpiryAt,memberStatus,availableMemberBenefits,defaultVoucherUsage,grantUsage,voucherUsageSummary,voucherThresholdSummary,voucherBenefit,voucherTypeLabels,grantVoucherType,grantVoucherBenefit,voucherAssetSummary,rewardSummary,timesVoucherScope,timesVoucherScopes,voucherTemplateName,canRevokeVoucher} from '../.test-build/model.js'
const config=()=>({demandPayment:{enabled:true,amount:9.9},member:{enabled:true,closeMode:'purchase-only',closedClock:'continue',badgeIcon:'',plans:[{id:'MON',name:'月',months:1,price:19.9,enabled:true}],benefits:[]},vouchers:{templates:[{id:'TPL',name:'2元券',type:'amount',amount:2,enabled:true,validity:'relative',days:30,fixedStart:'',fixedEnd:'',totalLimit:0,perUserLimit:0,note:'',usage:{orderScope:['需求单支付'],minSpend:0,maxPerOrder:1,withPromotion:false,refund:'original',refundExtendDays:7}}]},activitySettings:{stacking:'all'},activities:[{...newActivity('ACT-001'),name:'邀请双奖',enabled:true,rewards:[{kind:'member',enabled:true,target:10,months:1,repeat:true,perUserLimit:0},{kind:'voucher',enabled:true,target:1,templateId:'TPL',quantity:1,repeat:true,perUserLimit:0}]}]})
const pk=progressKey('U','ACT-001','member')
const store=()=>({schema:3,config:config(),configId:'TEST',savedAt:{},users:[{id:'U',name:'测试',phone:'',role:'parent',memberExpiry:null,blocked:false}],invites:[],grants:[],progress:{[pk]:{count:9,target:10,months:1,version:'V1',reward:clone(config().activities[0].rewards[0])}},logs:[],stock:{},seq:1})
const event=(id='EV1',overrides={})=>({id,inviterId:'U',inviteeId:'NEW',name:'新人',role:'parent',inviterRole:'parent',at:Date.now(),isNew:true,risk:false,failure:'none',...overrides})
function globalRules(c){const v=c.vouchers;v.enabled=true;if(v.templates[0].usage)Object.assign(v,clone(v.templates[0].usage));for(const t of v.templates)delete t.usage;return c}
const member=c=>c.activities[0].rewards[0],voucher=c=>c.activities[0].rewards[1]
const addActivity=(c,overrides={})=>{const a=clone(c.activities[0]);Object.assign(a,{id:'ACT-002',name:'第二活动',priority:50},overrides);c.activities.push(a);return a}
test('需求支付开关与金额校验，金额须为正数且精确到分',()=>{
 const c=config();assert.deepEqual(validateModule(c,'demand-payment'),[])
 for(const amount of [0,-1,0.001,9.999,100000,NaN,Infinity,undefined]){c.demandPayment.amount=amount;assert.ok(validateModule(c,'demand-payment').some(i=>i.field==='单次发布金额'))}
 for(const amount of [0.01,9.9,99999]){c.demandPayment.amount=amount;assert.deepEqual(validateModule(c,'demand-payment'),[])}
 c.demandPayment.enabled='false';assert.ok(validateModule(c,'demand-payment').some(i=>i.field==='需求支付开关'))
 c.demandPayment.enabled=false;assert.deepEqual(validateModule(c,'demand-payment'),[])
})
test('需求支付独立合并保存，不提交其他配置且记录中文变更金额',()=>{
 const before=config(),edited=clone(before)
 edited.demandPayment={enabled:false,amount:12.34};edited.member.enabled=false;edited.activities[0].name='不应保存';edited.vouchers.templates[0].amount=5
 const next=mergeModule(before,edited,'demand-payment')
 assert.deepEqual(next.demandPayment,{enabled:false,amount:12.34});assert.deepEqual(next.member,before.member);assert.deepEqual(next.activities,before.activities);assert.deepEqual(next.vouchers,before.vouchers)
 assert.deepEqual(diffConfig(before,next),[{field:'需求支付开关',before:'开启',after:'关闭'},{field:'单次发布金额',before:'¥9.90 / 次',after:'¥12.34 / 次'}])
 assert.deepEqual(mergeModule(before,edited,'member').demandPayment,before.demandPayment)
})
test('旧当前配置补齐需求支付9.9元，新值及历史快照保持原状',()=>{
 const original=store();delete original.config.demandPayment
 original.invites.push({...event(),status:'有效',reason:'历史记录',version:'OLD',configSnapshot:clone(original.config)})
 const history=clone(original.invites),loaded=migrateStore(original).store
 assert.deepEqual(loaded.config.demandPayment,{enabled:true,amount:9.9});assert.deepEqual(loaded.invites,history);assert.equal('demandPayment' in original.config,false)
 loaded.config.demandPayment={enabled:false,amount:12.34}
 const reloaded=migrateStore(loaded).store
 assert.deepEqual(reloaded.config.demandPayment,{enabled:false,amount:12.34});assert.deepEqual(reloaded.invites,history)
})
test('保存需求支付不改变会员、券资产和邀请进度',()=>{
 const s=store();processInvite(s,event(),s.config,'V1')
 const assets=structuredClone({users:s.users,grants:s.grants,invites:s.invites,progress:s.progress}),next=clone(s.config)
 next.demandPayment={enabled:false,amount:18.8};applyConfig(s,next,Date.now())
 assert.deepEqual(s.config.demandPayment,next.demandPayment);assert.deepEqual({users:s.users,grants:s.grants,invites:s.invites,progress:s.progress},assets)
})
test('自然月月底 / 闰年 / 北京时间',()=>{assert.equal(stamp(addMonths(parseChina('2027-01-31 23:30:00'),1)),'2027-02-28 23:30:00');assert.equal(stamp(addMonths(parseChina('2028-02-29 00:01:00'),12)),'2029-02-28 00:01:00')})
test('券30天、到期边界及已使用状态',()=>{const c=config(),at=parseChina('2026-11-19 10:00:00'),expiry=expiryOf(c.vouchers.templates[0],at);assert.equal(expiry-at,30*86400000);const g={status:'已发放',expiresAt:expiry};assert.equal(voucherStatus(g,expiry-1),'未使用');assert.equal(voucherStatus(g,expiry),'已过期');assert.equal(voucherStatus({...g,usedAt:at+1},expiry+1),'已使用')})
test('金额精确到分、0元不核销及订单范围叠加',()=>{assert.equal(cents(19.9),1990);const c=config();assert.equal(orderDiscount(c.vouchers.templates[0].usage,1.5,1,2,'需求单支付',false).payable,0);assert.equal(orderDiscount(c.vouchers.templates[0].usage,0,1,2,'需求单支付',false).discount,0);assert.equal(orderDiscount(c.vouchers.templates[0].usage,19.9,1,2,'需求单支付',false).payable,1790);assert.equal(orderDiscount(c.vouchers.templates[0].usage,10,1,2,'会员支付',false).discount,0);assert.equal(orderDiscount(c.vouchers.templates[0].usage,10,2,2,'需求单支付',false).discount,0);assert.equal(orderDiscount(c.vouchers.templates[0].usage,10,1,2,'需求单支付',true).discount,0);c.vouchers.templates[0].usage.maxPerOrder=2;c.vouchers.templates[0].usage.withPromotion=true;c.vouchers.templates[0].usage.orderScope.push('会员支付');assert.equal(orderDiscount(c.vouchers.templates[0].usage,10,2,2,'会员支付',true).discount,400)})
test('单活动9到10同时送会员及券，跨轮累计且分支独立',()=>{
 const c=config(),s=store(),first=processInvite(s,event(),c,'V1')
 assert.equal(first.grants.filter(g=>g.kind==='member').length,1);assert.equal(first.grants.filter(g=>g.kind==='voucher').length,1);assert.equal(s.progress[pk].count,0)
 const batch=store()
 for(let i=0;i<12;i++)processInvite(batch,event('BATCH-'+i,{inviteeId:'BATCH-USER-'+i}),c,'V1')
 assert.equal(batch.grants.filter(g=>g.kind==='member').length,2);assert.equal(batch.grants.filter(g=>g.kind==='voucher').length,12);assert.equal(batch.progress[pk].count,1)
 member(c).enabled=false
 const vouchersOnly=processInvite(store(),event(),c,'V1').grants
 assert.equal(vouchersOnly.filter(g=>g.kind==='member').length,0);assert.equal(vouchersOnly.filter(g=>g.kind==='voucher').length,1)
})
test('同一事件和跨身份重复不重复累计或发奖',()=>{const s=store(),c=config();const first=processInvite(s,event(),c,'V1');assert.equal(first.grants.length,2);const expiry=s.users[0].memberExpiry;assert.equal(processInvite(s,event(),c,'V1').duplicate,true);assert.equal(s.grants.length,2);assert.equal(s.users[0].memberExpiry,expiry);assert.equal(processInvite(s,event('EV2',{role:'teacher'}),c,'V1').grants.length,0)})
test('会员成功券失败，只重试券并保留原快照',()=>{const s=store(),c=config();const result=processInvite(s,event('EV1',{failure:'voucher'}),c,'V1');const m=result.grants.find(g=>g.kind==='member'),v=result.grants.find(g=>g.kind==='voucher');assert.equal(m.status,'已发放');assert.equal(v.status,'发放失败');const expiry=s.users[0].memberExpiry;c.vouchers.templates[0].days=7;deliver(s,v,Date.now());assert.equal(v.expiresAt-v.issuedAt,30*86400000);assert.equal(s.users[0].memberExpiry,expiry);deliver(s,v,Date.now());assert.equal(s.stock.TPL,1)})
test('老用户、自邀、异常待核验均不直接发奖',()=>{for(const change of [{isNew:false},{inviteeId:'U'},{risk:true}]){const s=store(),r=processInvite(s,event('EV',change),config(),'V1');assert.equal(r.grants.length,0);assert.notEqual(r.record.status,'有效');assert.equal(s.progress[pk].count,9)}})
test('活动停用和奖励取消不消耗对应进度',()=>{const c=config();c.activities[0].enabled=false;const s=store();assert.equal(processInvite(s,event(),c,'V1').grants.length,0);assert.equal(s.progress[pk].count,9);c.activities[0].enabled=true;member(c).enabled=false;assert.equal(processInvite(s,event('EV2',{inviteeId:'OTHER'}),c,'V1').grants.length,1);assert.equal(s.progress[pk].count,9)})
test('修改门槛保留旧会员轮次，下一轮使用新值',()=>{const s=store(),c=config();member(c).target=5;member(c).months=2;const first=processInvite(s,event(),c,'V2');assert.equal(first.grants.find(g=>g.kind==='member').months,1);assert.equal(first.grants.find(g=>g.kind==='member').version,'V1');assert.equal(s.progress[pk].target,5);assert.equal(s.progress[pk].months,2);assert.equal(s.progress[pk].count,0)})
test('活动时间开始包含、结束排除',()=>{const c=config(),a=c.activities[0];a.period='range';a.start='2026-11-19 10:00:00';a.end='2026-11-19 11:00:00';assert.equal(processInvite(store(),event('A',{at:parseChina(a.start)}),c,'V1').grants.length,2);assert.equal(processInvite(store(),event('B',{at:parseChina(a.end)}),c,'V1').grants.length,0)})
test('额度不足保留资格，补量后原单发放',()=>{const s=store(),c=config();c.vouchers.templates[0].totalLimit=1;s.config=c;s.stock.TPL=1;const v=processInvite(s,event(),c,'V1').grants.find(g=>g.kind==='voucher');assert.equal(v.status,'待发放');s.config.vouchers.templates[0].totalLimit=2;deliver(s,v,Date.now());assert.equal(v.status,'已发放');assert.equal(s.stock.TPL,2)})
test('固定期过期及冻结账号不伪成功',()=>{const s=store(),c=config();c.vouchers.templates[0].validity='fixed';c.vouchers.templates[0].fixedEnd='2020-01-01 10:00:00';assert.equal(processInvite(s,event(),c,'V1').grants.find(g=>g.kind==='voucher').status,'人工处理');const s2=store();s2.users[0].blocked=true;assert.ok(processInvite(s2,event(),config(),'V1').grants.every(g=>g.status==='人工处理'))})
test('启用活动依赖有效模板，未配置无关退款不阻塞活动',()=>{const c=config();c.vouchers.templates[0].usage.refund='';assert.deepEqual(validateModule(c,'activity'),[]);c.vouchers.templates[0].enabled=false;assert.ok(validateModule(c,'activity').some(e=>e.field.includes('关联模板')));assert.ok(validateModule(c,'template').some(e=>e.field==='关联模板'))})
test('活动基本信息、奖励选择、人数及额度校验',()=>{const c=config();assert.deepEqual(validateConfig(c),[]);c.activities[0].name='';member(c).target=0;voucher(c).perUserLimit=1;voucher(c).quantity=2;assert.ok(validateModule(c,'activity').length>=3);c.activities[0].rewards=[];assert.ok(validateModule(c,'activity').some(e=>e.field.includes('赠送奖励')))})
test('活动不再配置优先级，新活动可保存且已有排他策略继续按旧值执行',()=>{
 const c=config();c.activitySettings.stacking='priority';c.activities[0].priority=100
 const existing=addActivity(c),created=newActivity('ACT-NEW');existing.priority=10
 created.name='新活动';created.rewards=clone(c.activities[0].rewards)
 assert.equal('priority' in created,false)
 c.activities.push(created)
 assert.deepEqual(validateModule(c,'activity',{},created.id),[])
 const loaded=migrateStore({...store(),config:c}).store
 assert.equal(loaded.config.activities.find(a=>a.id===existing.id).priority,10)
 assert.equal(loaded.config.activities.find(a=>a.id===created.id).priority,undefined)
 assert.equal(loaded.config.activitySettings.stacking,'priority')
 const result=processInvite(loaded,event('LEGACY-PRIORITY'),loaded.config,'V1')
 assert.ok(result.grants.length>0);assert.ok(result.grants.every(g=>g.activityId===existing.id))
 const edited=clone(loaded.config);edited.activities[0].name='修改活动名称'
 assert.doesNotMatch(JSON.stringify(diffConfig(loaded.config,edited)),/优先级|undefined/)
})
test('两个活动可同时计奖，进度及限额互不串用',()=>{const s=store(),c=config(),a=addActivity(c);a.rewards[0].target=1;a.rewards[0].months=2;a.rewards[1].perUserLimit=1;const first=processInvite(s,event(),c,'V1');assert.equal(first.grants.length,4);assert.equal(first.grants.filter(g=>g.kind==='member').reduce((n,g)=>n+g.months,0),3);assert.equal(s.progress[pk].count,0);const next=processInvite(s,event('NEXT',{inviteeId:'NEW2'}),c,'V1');assert.equal(next.grants.filter(g=>g.kind==='voucher').length,1);assert.equal(next.grants.find(g=>g.kind==='voucher').activityId,'ACT-001');assert.equal(s.progress[pk].count,1)})
test('按优先级只参加一个活动，不污染其他活动旧进度',()=>{const s=store(),c=config(),a=addActivity(c);c.activitySettings.stacking='priority';a.rewards[0].target=1;const first=processInvite(s,event(),c,'V1');assert.equal(first.grants.length,2);assert.ok(first.grants.every(g=>g.activityId==='ACT-002'));assert.equal(s.progress[pk].count,9);assert.equal(first.record.activityResults.find(r=>r.activityId==='ACT-001').status,'优先级排除')})
test('优先级选择先过滤时间与身份；同优先级稳定按编号',()=>{const c=config(),a=addActivity(c);c.activitySettings.stacking='priority';a.inviteeRoles=['teacher'];let first=processInvite(store(),event(),c,'V1');assert.ok(first.grants.every(g=>g.activityId==='ACT-001'));a.inviteeRoles=['parent'];a.priority=100;first=processInvite(store(),event(),c,'V1');assert.ok(first.grants.every(g=>g.activityId==='ACT-001'))})
test('优先活动已封顶时不自动转入低优先级活动',()=>{const s=store(),c=config(),a=addActivity(c);c.activitySettings.stacking='priority';a.rewards.forEach(r=>{r.target=1;r.repeat=false});processInvite(s,event(),c,'V1');const next=processInvite(s,event('NEXT',{inviteeId:'NEW2'}),c,'V1');assert.equal(next.grants.length,0);assert.equal(s.progress[pk].count,9)})
test('切换跨活动策略只影响新事件，重放不改变原判定',()=>{const s=store(),c=config();addActivity(c);processInvite(s,event(),c,'V1');c.activitySettings.stacking='priority';assert.equal(processInvite(s,event(),c,'V2').duplicate,true);assert.equal(s.grants.length,3);const next=processInvite(s,event('NEXT',{inviteeId:'NEW2'}),c,'V2');assert.ok(next.grants.every(g=>g.activityId==='ACT-002'))})
test('券也可满N人达标，不等同于每邀请1人',()=>{const s=store(),c=config();member(c).enabled=false;voucher(c).target=3;voucher(c).quantity=2;for(let i=1;i<=2;i++)assert.equal(processInvite(s,event('E'+i,{inviteeId:'N'+i}),c,'V1').grants.length,0);const r=processInvite(s,event('E3',{inviteeId:'N3'}),c,'V1');assert.equal(r.grants.length,2);assert.equal(s.progress[progressKey('U','ACT-001','voucher')].count,0)})
test('券轮次变更保留原模板快照并在下一轮切换',()=>{const s=store(),c=config();member(c).enabled=false;voucher(c).target=2;processInvite(s,event('E1',{inviteeId:'N1'}),c,'V1');c.vouchers.templates[0].amount=9;voucher(c).target=1;const r=processInvite(s,event('E2',{inviteeId:'N2'}),c,'V2');assert.equal(r.grants[0].amount,2);assert.equal(r.grants[0].version,'V1');const next=processInvite(s,event('E3',{inviteeId:'N3'}),c,'V2');assert.equal(next.grants[0].amount,9)})
test('个人会员次数与券张数上限各自计算，撤回不释放额度',()=>{
 const c=config(),s=store();member(c).perUserLimit=2;voucher(c).perUserLimit=1
 processInvite(s,event(),c,'V1');s.grants.find(g=>g.kind==='voucher').status='已撤回';s.progress[pk].count=9
 const next=processInvite(s,event('NEXT',{inviteeId:'NEW2'}),c,'V1')
 assert.equal(next.grants.filter(g=>g.kind==='voucher').length,0);assert.equal(next.grants.filter(g=>g.kind==='member').length,1)
})
test('多活动共享券模板的个人上限，不超发',()=>{const s=store(),c=config();c.vouchers.templates[0].perUserLimit=1;addActivity(c);const r=processInvite(s,event(),c,'V1');assert.equal(r.grants.filter(g=>g.kind==='voucher'&&g.status==='已发放').length,1);assert.equal(r.grants.filter(g=>g.kind==='voucher'&&g.status==='人工处理').length,1);assert.equal(s.stock.TPL,1)})
test('异常邀请按活动核验，只补待核验分支并幂等',()=>{const s=store(),c=config(),a=addActivity(c);a.riskPolicy='block';const r=processInvite(s,event('RISK',{risk:true}),c,'V1');assert.equal(r.grants.length,0);assert.equal(r.record.activityResults.filter(r=>r.status==='待核验').length,1);assert.equal(auditInvite(s,r.record,true,'核验通过').length,2);assert.equal(auditInvite(s,r.record,true,'重复审核').length,0);assert.equal(s.grants.length,2);assert.ok(s.grants.every(g=>g.activityId==='ACT-001'))})
test('活动不再限制绑定后的注册天数，仍拒绝注册后补绑',()=>{
 const c=config(),at=Date.now();Object.assign(c.activities[0],{attribution:'last',attributionDays:1})
 for(const days of [0,31,366])assert.equal(processInvite(store(),event('BOUND-'+days,{at,boundAt:at-days*86400000}),c,'V1').grants.length,2)
 const future=processInvite(store(),event('FUTURE',{at,boundAt:at+1}),c,'V1')
 assert.equal(future.grants.length,0)
 assert.equal(future.record.activityResults[0].reason,'未在注册前完成有效邀请绑定')
})
test('独立保存活动不被其他未完成活动阻塞',()=>{const c=config();addActivity(c,{name:''});assert.deepEqual(validateModule(c,'activity',{},'ACT-001'),[]);assert.ok(validateModule(c,'activity').length);c.vouchers.templates[0].usage.refund='';assert.deepEqual(validateModule(c,'activity',{},'ACT-001'),[])})
test('会员设置与方案、模板和活动独立合并，不相互提交',()=>{const current=config(),editing=clone(current);editing.member.enabled=false;editing.member.plans[0].price=88;editing.activities[0].name='不应保存';current.member.plans[0].price=25;const next=mergeModule(current,editing,'member');assert.equal(next.member.enabled,false);assert.equal(next.member.plans[0].price,25);assert.equal(next.activities[0].name,'邀请双奖');assert.deepEqual(next.activitySettings,current.activitySettings)})
test('模板停用检查所有活动引用，停用活动后允许停用全部模板',()=>{const c=config();addActivity(c);c.vouchers.templates[0].enabled=false;assert.ok(validateModule(c,'template').some(i=>i.message.includes('第二活动')));c.activities.forEach(a=>a.enabled=false);assert.deepEqual(validateModule(c,'template'),[]);assert.deepEqual(validateConfig(c),[]);c.activities[1].enabled=true;assert.ok(validateModule(c,'activity',{},'ACT-002').some(i=>i.field.includes('关联模板')))})
test('最后上架方案和历史库存约束与活动独立',()=>{const c=config();c.member.plans[0].enabled=false;assert.ok(validateModule(c,'plan').length);c.member.enabled=false;assert.deepEqual(validateModule(c,'plan'),[]);c.vouchers.templates[0].totalLimit=5;assert.ok(validateModule(c,'template',{TPL:6}).length);assert.deepEqual(validateModule(c,'activity',{TPL:6}),[]);assert.equal(processInvite(store(),event(),c,'V1').grants.find(g=>g.kind==='member').status,'已发放')})
function legacyConfig(){const c=globalRules(config()),a=c.activities[0],{kind:mk,...m}=a.rewards[0],{kind:vk,target,repeat,...v}=a.rewards[1],{activities,activitySettings,...rest}=c;return {...rest,invitation:{enabled:true,period:'permanent',start:'',end:'',inviterRoles:a.inviterRoles,inviteeRoles:a.inviteeRoles,attribution:'first',attributionDays:30,riskPolicy:'hold'},memberReward:m,voucherReward:v}}
test('移除活动归因配置时清理schema1/2/3当前字段，历史快照及记录保留',()=>{
 assert.equal('attribution' in newActivity(),false)
 assert.equal('attributionDays' in newActivity(),false)
 for(const schema of [1,2,3]){
  const old=store();old.schema=schema;if(schema!==3)old.config=legacyConfig()
  const rules=schema===3?old.config.activities[0]:old.config.invitation
  Object.assign(rules,{attribution:'last',attributionDays:0})
  old.invites=[{...event('OLD-ATTR',{boundAt:Date.now()-40*86400000}),status:'有效',reason:'历史邀请',version:'OLD',configSnapshot:clone(old.config)}]
  old.logs=[{id:'OLD-ATTR-LOG',detail:'历史归因配置'}]
  const loaded=migrateStore(old).store,a=loaded.config.activities[0]
  assert.equal('attribution' in a,false);assert.equal('attributionDays' in a,false)
  assert.deepEqual(validateModule(loaded.config,'activity'),[])
  assert.equal(loaded.invites[0].configSnapshot.activities[0].attribution,'last')
  assert.equal(loaded.invites[0].configSnapshot.activities[0].attributionDays,0)
  assert.equal(loaded.invites[0].boundAt,old.invites[0].boundAt)
  assert.deepEqual(loaded.grants,old.grants);assert.deepEqual(loaded.users,old.users)
  assert.equal(Object.values(loaded.progress)[0].count,9)
  assert.deepEqual(loaded.logs.find(log=>log.id==='OLD-ATTR-LOG'),old.logs[0])
  assert.equal(rules.attribution,'last');assert.equal(rules.attributionDays,0)
  const updated=clone(loaded.config);updated.activities[0].name='修改活动名称'
  assert.doesNotMatch(JSON.stringify(diffConfig(loaded.config,updated)),/undefined|归因/)
 }
})
test('活动只配置家长和老师，旧合伙人选项不能参与新的计奖',()=>{
 const c=config(),a=c.activities[0]
 assert.deepEqual(a.inviterRoles,['parent','teacher'])
 assert.deepEqual(a.inviteeRoles,['parent','teacher'])
 a.inviterRoles.push('partner');a.inviteeRoles.push('partner')
 assert.ok(validateModule(c,'activity').some(issue=>issue.message.includes('仅支持家长、老师')))
 for(const overrides of [{role:'partner'},{inviterRole:'partner'}]){
  const s=store(),result=processInvite(s,event('PARTNER',overrides),c,'V1')
  assert.equal(result.grants.length,0)
  assert.equal(s.progress[pk].count,9)
  assert.equal(result.record.activityResults[0].reason,'身份不在活动参与范围')
 }
 for(const role of ['parent','teacher']){
  const result=processInvite(store(),event(role,{role,inviterRole:role}),config(),'V1')
  assert.equal(result.grants.length,2)
 }
})
test('旧活动只清理当前合伙人选项，不扩大身份范围或改写历史',()=>{
 for(const schema of [1,2,3]){
  const old=store();old.schema=schema;if(schema!==3)old.config=legacyConfig()
  const rules=schema===3?old.config.activities[0]:old.config.invitation
  rules.inviterRoles=['parent','partner'];rules.inviteeRoles=['partner']
  old.invites=[{...event('OLD',{role:'partner'}),status:'有效',reason:'历史记录',version:'OLD',configSnapshot:clone(old.config)}]
  const loaded=migrateStore(old).store,a=loaded.config.activities[0]
  assert.deepEqual(a.inviterRoles,['parent'])
  assert.deepEqual(a.inviteeRoles,[])
  assert.ok(validateModule(loaded.config,'activity').some(issue=>issue.message.includes('至少保留一种身份')))
  assert.deepEqual(loaded.invites[0].configSnapshot.activities[0].inviteeRoles,['partner'])
  assert.deepEqual(loaded.users,old.users)
  assert.deepEqual(loaded.grants,old.grants)
  assert.equal(Object.values(loaded.progress)[0].count,9)
  assert.deepEqual(rules.inviteeRoles,['partner'])
 }
})
test('移除合伙人选项后，旧待核验记录仍按原活动快照处理且不重复发放',()=>{
 const old=store(),c=clone(old.config);c.activities[0].inviteeRoles=['partner']
 old.invites=[{...event('OLD-HOLD',{role:'partner',risk:true}),status:'待核验',reason:'异常邀请待核验',version:'OLD',configSnapshot:c,activityResults:[{activityId:'ACT-001',activityName:c.activities[0].name,status:'待核验',reason:'异常邀请待核验'}]}]
 const loaded=migrateStore(old).store,record=loaded.invites[0]
 assert.deepEqual(record.configSnapshot.activities[0].inviteeRoles,['partner'])
 assert.equal(auditInvite(loaded,record,true,'核验通过').length,2)
 assert.equal(auditInvite(loaded,record,true,'重复审核').length,0)
 assert.equal(loaded.grants.length,2)
})
test('schema2迁移为单个双奖活动，保存历史资产与旧进度',()=>{const old=store();old.schema=2;old.config=legacyConfig();old.config.member.plans[0].sort=99;old.progress={U:{count:9,target:10,months:1,version:'OLD'}};old.grants=[{source:'邀请奖励',id:'OLD-GR'}];const r=migrateStore(old);assert.equal(r.store.schema,3);assert.equal(r.store.config.activities.length,1);assert.equal(r.store.config.activities[0].rewards.length,2);assert.equal(r.store.progress[progressKey('U','ACT-INVITE-001','member')].count,9);assert.equal(r.store.grants[0].activityId,'ACT-INVITE-001');assert.equal('memberReward' in r.store.config,false);assert.equal('sort' in r.store.config.member.plans[0],false);assert.deepEqual(r.store.users,old.users)})
test('schema1迁移用旧生效配置，不启用草稿及定时计划',()=>{const old=store(),active=legacyConfig(),pending=legacyConfig();active.member.plans[0].price=10;pending.member.plans[0].price=100;const legacy={...old,schema:1,draft:pending,versions:[{id:'V2',status:'待生效',config:pending},{id:'V1',status:'生效中',config:active}],progress:{U:{count:9,target:10,months:1,version:'V1'}}};delete legacy.config;const r=migrateStore(legacy);assert.equal(r.store.schema,3);assert.equal(r.store.config.member.plans[0].price,10);assert.equal(r.store.configId,'V1');assert.equal('versions' in r.store,false);assert.equal('draft' in r.store,false);assert.equal(migrateStore({schema:1}),null)})
test('已归档活动不匹配新事件，当前保存不改历史归档状态',()=>{const c=config();c.activities[0].archived=true;c.activities[0].enabled=false;assert.equal(processInvite(store(),event(),c,'V1').grants.length,0);const old=store();old.config=c;const loaded=migrateStore(old).store;assert.equal(loaded.config.activities[0].archived,true);assert.deepEqual(validateModule(loaded.config,'activity',{},'ACT-001'),[])})
test('清理当前会员配置的已删字段，保留历史快照且不阻塞保存',()=>{
 for(const schema of [1,2,3]){
  const old=store();old.schema=schema;if(schema!==3)old.config=legacyConfig()
  Object.assign(old.config.member,{name:'历史会员名称',purchaseRefund:'',serviceChannel:'历史客服',serviceHours:'历史时间'})
  old.config.member.plans[0].sort=99
  old.invites=[{...event(),status:'有效',reason:'历史记录',version:'OLD',configSnapshot:clone(old.config)}]
  old.logs=[{id:'LOG-OLD',detail:'保留旧会员退款设置的操作记录'}]
  const result=migrateStore(old).store
  assert.deepEqual(Object.keys(result.config.member).sort(),['enabled','closeMode','closedClock','badgeIcon','plans','benefits'].sort())
  assert.deepEqual(validateModule(result.config,'member'),[])
  assert.equal('sort' in result.config.member.plans[0],false)
  assert.equal(result.invites[0].configSnapshot.member.serviceChannel,'历史客服')
  assert.equal(result.invites[0].configSnapshot.member.name,'历史会员名称')
  assert.deepEqual(result.logs.filter(entry=>entry.id==='LOG-OLD'),old.logs)
  assert.deepEqual(result.grants,old.grants)
  assert.equal(old.config.member.serviceHours,'历史时间')
 }
})

test('权益图标允许默认或本地图片，拒绝外链、异常格式及超限图片',()=>{
 const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII='
 assert.equal(benefitIconError(''),'')
 assert.equal(benefitIconError(picture),'')
 for(const bad of ['https://example.com/icon.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,???','data:image/png;base64,AAAA='])assert.ok(benefitIconError(bad))
 assert.equal(benefitIconError('data:image/png;base64,'+Buffer.alloc(benefitIconMaxBytes).toString('base64')),'')
 assert.match(benefitIconError('data:image/png;base64,'+Buffer.alloc(benefitIconMaxBytes+1).toString('base64')),/500 KB/)
 const c=config();c.member.benefits=[{code:'DIRECTED_DEMAND',name:'定向需求',description:'指定老师发送需求',enabled:true,icon:picture}]
 assert.deepEqual(validateModule(c,'member'),[])
 c.member.benefits[0].icon='https://example.com/icon.png'
 assert.ok(validateModule(c,'member').some(issue=>issue.field==='定向需求图标'))
})
test('旧权益补默认图标，自定义图标随会员设置保存且不污染历史或其他模块',()=>{
 const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII='
 for(const schema of [2,3]){
  const old=store();old.schema=schema;if(schema===2)old.config=legacyConfig()
  old.config.member.benefits=[{code:'DIRECTED_DEMAND',name:'定向需求',description:'指定老师发送需求',enabled:true},{code:'DEDICATED_SUPPORT',name:'客服',description:'专属客服',enabled:true,icon:picture}]
  old.invites=[{...event(),status:'有效',reason:'历史记录',version:'OLD',configSnapshot:clone(old.config)}]
  const loaded=migrateStore(old).store
  assert.equal(loaded.config.member.benefits[0].icon,'')
  assert.equal(loaded.config.member.benefits[1].icon,picture)
  assert.equal('icon' in loaded.invites[0].configSnapshot.member.benefits[0],false)
  const editing=clone(loaded.config);editing.member.benefits[0].icon=picture;editing.vouchers.templates[0].usage.maxPerOrder=3
  const saved=mergeModule(loaded.config,editing,'member')
  assert.equal(saved.member.benefits[0].icon,picture)
  assert.equal(saved.vouchers.templates[0].usage.maxPerOrder,loaded.config.vouchers.templates[0].usage.maxPerOrder)
  const changes=diffConfig(loaded.config,saved)
  assert.ok(changes.some(change=>change.field==='会员权益'&&change.after.includes('自定义图标')))
  assert.equal(JSON.stringify(changes).includes('base64'),false)
  assert.equal(migrateStore({...loaded,config:saved}).store.config.member.benefits[0].icon,picture)
 }
})

test('会员标识由文案迁移为图标，默认与自定义均可独立保存',()=>{
 const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII='
 for(const schema of [1,2,3]){
  const old=store();old.schema=schema;if(schema!==3)old.config=legacyConfig()
  delete old.config.member.badgeIcon;old.config.member.badge='会员支付'
  old.invites=[{...event(),status:'有效',reason:'历史',version:'OLD',configSnapshot:clone(old.config)}]
  const migrated=migrateStore(old).store
  assert.equal(migrated.config.member.badgeIcon,'')
  assert.equal('badge' in migrated.config.member,false)
  assert.equal(migrated.invites[0].configSnapshot.member.badge,'会员支付')
  assert.deepEqual(validateModule(migrated.config,'member'),[])
  const editing=clone(migrated.config);editing.member.badgeIcon=picture
  const saved=mergeModule(migrated.config,editing,'member')
  assert.equal(migrateStore({...migrated,config:saved}).store.config.member.badgeIcon,picture)
  const change=diffConfig(migrated.config,saved).find(change=>change.field==='会员标识图标')
  assert.deepEqual(change,{field:'会员标识图标',before:'默认图标',after:'自定义图标'})
  assert.equal(JSON.stringify(diffConfig(migrated.config,saved)).includes('base64'),false)
  saved.member.badgeIcon='会员支付';assert.ok(validateModule(saved,'member').some(issue=>issue.field==='会员标识'))
 }
})

test('会员权益总数含停用项最多5项，超限阻止保存且不截断旧数据',()=>{
 const c=config()
 c.member.benefits=Array.from({length:5},(_,index)=>({code:'CUSTOM_'+index,name:'权益'+index,description:'权益说明'+index,enabled:index!==4,icon:''}))
 assert.deepEqual(validateModule(c,'member'),[])
 c.member.benefits.push({code:'CUSTOM_5',name:'第六项',description:'超过上限',enabled:true,icon:''})
 assert.ok(validateModule(c,'member').some(issue=>issue.message.includes('最多配置5项')))
 const old=store();old.config=c;old.invites=[{...event(),status:'有效',reason:'历史',version:'OLD',configSnapshot:clone(c)}]
 const loaded=migrateStore(old).store
 assert.equal(loaded.config.member.benefits.length,6)
 assert.deepEqual(loaded.invites[0].configSnapshot,c)
})

test('新增权益必填与标识校验，保存和刷新保留自定义项且不影响其他模块',()=>{
 const current=config(),editing=clone(current)
 const benefit={code:'CUSTOM_TEST',name:'',description:'',enabled:true,icon:''}
 editing.member.benefits.push(benefit)
 assert.ok(validateModule(editing,'member').some(issue=>issue.message.includes('填写完整权益名称及说明')))
 benefit.name='预约提醒';benefit.description='预约前提醒上课时间'
 assert.deepEqual(validateModule(editing,'member'),[])
 benefit.name='长'.repeat(21);assert.ok(validateModule(editing,'member').some(issue=>issue.message.includes('20字')));benefit.name='预约提醒'
 benefit.description='长'.repeat(81);assert.ok(validateModule(editing,'member').some(issue=>issue.message.includes('80字')));benefit.description='预约前提醒上课时间'
 editing.member.benefits.push({...benefit})
 assert.ok(validateModule(editing,'member').some(issue=>issue.message.includes('权益标识缺失或重复')))
 editing.member.benefits.pop();editing.vouchers.templates[0].usage.maxPerOrder=9
 const saved=mergeModule(current,editing,'member'),loaded=migrateStore({...store(),config:saved}).store
 assert.deepEqual(loaded.config.member.benefits,[benefit])
 assert.equal(loaded.config.vouchers.templates[0].usage.maxPerOrder,current.vouchers.templates[0].usage.maxPerOrder)
 assert.equal(current.member.benefits.length,0)
 assert.ok(diffConfig(current,saved).some(change=>change.field==='会员权益'&&change.after.includes('预约提醒')))
})

test('三类支付范围全部7种组合独立抵扣，空选拦截保存',()=>{
 const c=config()
 for(const scope of [['需求单支付'],['会员支付'],['订单支付'],['需求单支付','会员支付'],['需求单支付','订单支付'],['会员支付','订单支付'],['需求单支付','会员支付','订单支付']]){
  c.vouchers.templates[0].usage.orderScope=scope
  assert.deepEqual(validateModule(c,'template'),[])
  for(const orderType of ['需求单支付','会员支付','订单支付'])assert.equal(orderDiscount(c.vouchers.templates[0].usage,10,1,2,orderType,false).discount,scope.includes(orderType)?200:0)
 }
 c.vouchers.templates[0].usage.orderScope=[];assert.ok(validateModule(c,'template').some(issue=>issue.field.endsWith('适用范围')))
 c.vouchers.templates[0].usage.orderScope=['其他'];assert.ok(validateModule(c,'template').some(issue=>issue.field.endsWith('适用范围')))
 assert.equal(orderDiscount(c.vouchers.templates[0].usage,10,1,2,'其他',false).discount,0)
})

test('旧用券范围合并并清理锁券字段，保留旧券、历史快照、资产与进度',()=>{
 for(const schema of [1,2,3])for(const scope of [[],['体验课订单'],['正式课订单'],['体验课订单','正式课订单']])for(const allowMemberPurchase of [false,true]){
  const old=store();old.schema=schema;if(schema!==3)old.config=legacyConfig()
  globalRules(old.config)
  Object.assign(old.config.vouchers,{orderScope:scope,allowMemberPurchase,lockMinutes:0})
  old.grants=[{id:'OLD',kind:'voucher',source:'邀请奖励',usage:clone(old.config.vouchers)}]
  old.invites=[{...event(),status:'有效',reason:'历史',version:'OLD',configSnapshot:clone(old.config)}]
  if(schema!==3)old.progress={U:{count:9,target:10,months:1,version:'OLD'}}
  const result=migrateStore(old).store,expected=[...(scope.length?['需求单支付']:[]),...(allowMemberPurchase?['会员支付']:[])]
  assert.deepEqual(result.config.vouchers.templates[0].usage.orderScope,expected)
  assert.equal('allowMemberPurchase' in result.config.vouchers,false)
  assert.equal('lockMinutes' in result.config.vouchers,false)
  assert.deepEqual(result.grants[0].usage,old.grants[0].usage)
  assert.deepEqual(result.invites[0].configSnapshot.vouchers,old.config.vouchers)
  assert.deepEqual(result.users,old.users)
  assert.equal(result.progress[progressKey('U',schema===3?'ACT-001':'ACT-INVITE-001','member')].count,9)
  const editing=clone(result.config);editing.vouchers.templates[0].usage.orderScope=['会员支付']
  const saved=mergeModule(result.config,editing,'template')
  assert.deepEqual(migrateStore({...result,config:saved}).store.config.vouchers.templates[0].usage.orderScope,['会员支付'])
 }
})


test('关闭范围控制会员身份及全部权益，重新开启恢复逐项配置',()=>{
 const s=store(),now=parseChina('2026-11-20 10:00:00'),u=s.users[0]
 u.memberExpiry=now+86400000
 s.config.member.benefits=[{code:'DIRECTED_DEMAND',name:'定向需求',description:'说明',enabled:true,icon:''},{code:'CUSTOM_OFF',name:'停用项',description:'说明',enabled:false,icon:''}]
 const original=clone(s.config.member.benefits),next=clone(s.config)
 next.member.enabled=false
 applyConfig(s,next,now)
 assert.equal(memberStatus(s,u,now),'有效会员')
 assert.equal(availableMemberBenefits(s,u,now).length,1)
 next.member.closeMode='all'
 applyConfig(s,next,now)
 assert.equal(memberStatus(s,u,now),'会员已停用')
 assert.deepEqual(availableMemberBenefits(s,u,now),[])
 assert.equal(memberStatus(s,u,u.memberExpiry),'已过期')
 next.member.enabled=true
 applyConfig(s,next,now+1000)
 assert.equal(memberStatus(s,u,now+1000),'有效会员')
 assert.deepEqual(s.config.member.benefits,original)
 assert.equal(availableMemberBenefits(s,u,now+1000).length,1)
 u.blocked=true;assert.deepEqual(availableMemberBenefits(s,u,now),[])
 next.member.closeMode='invalid';assert.ok(validateModule(next,'member').some(i=>i.field==='关闭范围'))
 next.member.closeMode='all';next.member.closedClock='invalid';assert.ok(validateModule(next,'member').some(i=>i.field==='有效期处理'))
})

test('暂停计时跨刷新保留剩余时长，重复保存不重置，恢复只顺延一次',()=>{
 const s=store(),at=parseChina('2026-11-20 10:00:00'),day=86400000,u=s.users[0]
 u.memberExpiry=at+day
 s.users.push({...u,id:'EXPIRED',memberExpiry:at-1})
 const next=clone(s.config);Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'pause'})
 applyConfig(s,next,at)
 assert.equal(memberExpiryAt(s,u,at+3*day),at+4*day)
 assert.equal(memberStatus(s,u,at+3*day),'会员已停用')
 applyConfig(s,next,at+day)
 assert.equal(s.memberPause.users.U,at)
 const loaded=migrateStore(s).store,editing=clone(loaded.config)
 assert.deepEqual(loaded.memberPause,s.memberPause)
 editing.member.enabled=true
 applyConfig(loaded,editing,at+3*day)
 assert.equal(loaded.users[0].memberExpiry,at+4*day)
 assert.equal(loaded.users[1].memberExpiry,at-1)
 assert.equal(loaded.memberPause,undefined)
 applyConfig(loaded,editing,at+5*day)
 assert.equal(loaded.users[0].memberExpiry,at+4*day)
 assert.equal(memberStatus(loaded,loaded.users[0],at+5*day),'已过期')
})

test('暂停中改为继续计时或仅停购买，先结算暂停时长再恢复计时',()=>{
 for(const scope of ['all','purchase-only']){
  const s=store(),at=parseChina('2026-11-20 10:00:00'),day=86400000,next=clone(s.config)
  s.users[0].memberExpiry=at+day
  Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'pause'});applyConfig(s,next,at)
  next.member.closeMode=scope;next.member.closedClock='continue';applyConfig(s,next,at+2*day)
  assert.equal(s.users[0].memberExpiry,at+3*day)
  assert.equal(s.memberPause,undefined)
  assert.equal(memberStatus(s,s.users[0],at+4*day),'已过期')
 }
})

test('暂停期间会员奖励仍入账，新到账起暂停且不丢原剩余时长和历史快照',()=>{
 const s=store(),at=parseChina('2026-11-20 10:00:00'),day=86400000,next=clone(s.config),u=s.users[0]
 u.memberExpiry=at+day
 Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'pause'});applyConfig(s,next,at)
 const grant={id:'PAUSE-M',key:'PAUSE-M',userId:'U',kind:'member',source:'邀请奖励',eventId:'E',version:'V1',status:'待发放',reason:'',createdAt:at+2*day,amount:0,months:1,attempts:0}
 s.grants.push(grant);deliver(s,grant,at+2*day)
 const end=addMonths(at+3*day,1),snapshot=clone(grant)
 assert.equal(grant.memberStart,at+3*day)
 assert.equal(memberExpiryAt(s,u,at+4*day),end+2*day)
 assert.deepEqual(availableMemberBenefits(s,u,at+4*day),[])
 const fresh={...u,id:'NEW-M',memberExpiry:null};s.users.push(fresh)
 const freshGrant={...grant,id:'FRESH',key:'FRESH',userId:'NEW-M',status:'待发放',issuedAt:undefined};s.grants.push(freshGrant)
 deliver(s,freshGrant,at+3*day)
 assert.equal(memberExpiryAt(s,fresh,at+4*day),addMonths(at+3*day,1)+day)
 next.member.enabled=true;applyConfig(s,next,at+4*day)
 assert.equal(u.memberExpiry,end+2*day)
 assert.deepEqual(grant,snapshot)
 deliver(s,grant,at+5*day);assert.equal(u.memberExpiry,end+2*day)
})

test('旧关闭配置保留原购买限制，历史快照不回写，新策略独立保存并有中文日志',()=>{
 for(const schema of [1,2,3]){
  const old=store();old.schema=schema;if(schema!==3)old.config=legacyConfig()
  old.config.member.enabled=false;delete old.config.member.closeMode;delete old.config.member.closedClock
  old.invites=[{...event(),status:'有效',reason:'历史',version:'OLD',configSnapshot:clone(old.config)}]
  if(schema!==3)old.progress={U:{count:9,target:10,months:1,version:'OLD'}}
  const loaded=migrateStore(old).store
  assert.equal(loaded.config.member.closeMode,'purchase-only');assert.equal(loaded.config.member.closedClock,'continue')
  assert.equal('closeMode' in loaded.invites[0].configSnapshot.member,false)
  assert.equal('closedClock' in loaded.invites[0].configSnapshot.member,false)
  assert.deepEqual(loaded.users,old.users);assert.deepEqual(loaded.grants,old.grants)
  const editing=clone(loaded.config);editing.member.closeMode='all';editing.member.closedClock='pause';editing.vouchers.templates[0].usage.maxPerOrder=5
  const saved=mergeModule(loaded.config,editing,'member'),changes=diffConfig(loaded.config,saved)
  assert.equal(saved.vouchers.templates[0].usage.maxPerOrder,loaded.config.vouchers.templates[0].usage.maxPerOrder)
  assert.ok(changes.some(c=>c.field==='关闭范围'&&c.after==='关闭会员及全部权益'))
  assert.ok(changes.some(c=>c.field==='有效期处理'&&c.after==='关闭期间暂停计时'))
  assert.equal(migrateStore({...loaded,config:saved}).store.config.member.closedClock,'pause')
 }
})


test('全部关闭仍按活动赠送双奖，会员不可用而券正常，重放不重复入账',()=>{
 const s=store(),next=clone(s.config),now=Date.now()
 Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'pause'})
 applyConfig(s,next,now)
 const result=processInvite(s,event(),s.config,'V2')
 assert.equal(result.grants.length,2)
 assert.ok(result.grants.every(g=>g.status==='已发放'))
 assert.equal(memberStatus(s,s.users[0],now+1000),'会员已停用')
 assert.deepEqual(availableMemberBenefits(s,s.users[0],now+1000),[])
 assert.equal(voucherStatus(result.grants.find(g=>g.kind==='voucher'),now+1000),'未使用')
 const before=clone(s.memberPause)
 assert.equal(processInvite(s,event(),s.config,'V2').duplicate,true)
 assert.deepEqual(s.memberPause,before)
})

test('关闭后失效截断剩余时长，重新开启或改策略不恢复，历史快照及券不变',()=>{
 const s=store(),at=parseChina('2026-11-20 10:00:00'),day=86400000,next=clone(s.config),u=s.users[0]
 u.memberExpiry=at+30*day;s.users.push({...u,id:'EXPIRED',memberExpiry:at-1},{...u,id:'NONE',memberExpiry:null})
 s.grants=[{id:'OLD-SUCCESS',kind:'member',status:'已发放',memberEnd:u.memberExpiry}]
 s.invites=[{...event(),configSnapshot:clone(s.config)}]
 const history=clone({grants:s.grants,invites:s.invites,progress:s.progress,stock:s.stock})
 Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'invalidate'})
 assert.deepEqual(validateModule(next,'member'),[])
 assert.ok(diffConfig(s.config,next).some(c=>c.field==='有效期处理'&&c.after.includes('重新购买')))
 applyConfig(s,next,at)
 assert.equal(u.memberExpiry,at)
 assert.deepEqual(s.memberInvalidations.U,{at,previousExpiry:at+30*day})
 assert.equal(memberStatus(s,u,at+day),'会员已失效')
 assert.deepEqual(availableMemberBenefits(s,u,at+day),[])
 const loaded=migrateStore(s).store
 assert.deepEqual(loaded.memberInvalidations,s.memberInvalidations)
 assert.equal(memberStatus(loaded,loaded.users[0],at+day),'会员已失效')
 next.member.enabled=true;applyConfig(s,next,at+day)
 assert.equal(memberStatus(s,u,at+day),'会员已失效')
 Object.assign(next.member,{enabled:false,closedClock:'pause'});applyConfig(s,next,at+2*day)
 next.member.enabled=true;applyConfig(s,next,at+3*day)
 assert.equal(u.memberExpiry,at)
 assert.equal(memberStatus(s,u,at+3*day),'会员已失效')
 assert.equal(memberStatus(s,s.users[1],at+day),'已过期')
 assert.equal(memberStatus(s,s.users[2],at+day),'未开通')
 assert.deepEqual({grants:s.grants,invites:s.invites,progress:s.progress,stock:s.stock},history)
})

test('暂停后改为失效只在进入时执行，不因无关保存重复清理',()=>{
 const s=store(),at=parseChina('2026-11-20 10:00:00'),day=86400000,next=clone(s.config),u=s.users[0]
 u.memberExpiry=at+day
 Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'pause'});applyConfig(s,next,at)
 next.member.closedClock='invalidate';applyConfig(s,next,at+2*day)
 assert.equal(s.memberPause,undefined)
 assert.equal(s.memberInvalidations.U.previousExpiry,at+3*day)
 assert.equal(u.memberExpiry,at+2*day)
 const snapshot=clone(s.memberInvalidations)
 next.member.badgeIcon='';applyConfig(s,next,at+3*day)
 assert.deepEqual(s.memberInvalidations,snapshot)
 assert.equal(u.memberExpiry,at+2*day)
 assert.equal(s.memberInvalidatedBefore,at+2*day)
})

const pendingMember=(id,userId,at,source='邀请奖励')=>({id,key:id,userId,kind:'member',source,eventId:id,version:'V1',status:'待发放',reason:'',createdAt:at,amount:0,months:1,attempts:0})
test('失效期间会员奖励和关闭前的待发单不能重试恢复，券正常，重新购买从新到账时起算',()=>{
 const s=store(),at=parseChina('2026-11-20 10:00:00'),day=86400000,next=clone(s.config),u=s.users[0]
 u.memberExpiry=at+30*day
 const old=pendingMember('OLD','U',at-1),during=pendingMember('DURING','U',at+day)
 Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'invalidate'});applyConfig(s,next,at)
 deliver(s,during,at+day,true)
 assert.equal(during.status,'已失效')
 next.member.enabled=true;applyConfig(s,next,at+2*day)
 deliver(s,old,at+2*day)
 assert.equal(old.status,'已失效')
 const before=clone(during);deliver(s,during,at+3*day);assert.deepEqual(during,before)
 const purchase=pendingMember('BUY','U',at+3*day,'购买会员')
 deliver(s,purchase,at+3*day,true);assert.equal(memberStatus(s,u,at+3*day),'会员已失效')
 deliver(s,purchase,at+3*day)
 assert.equal(purchase.memberStart,at+3*day)
 assert.equal(u.memberExpiry,addMonths(at+3*day,1))
 assert.equal(memberStatus(s,u,at+3*day),'有效会员')
 const expiry=u.memberExpiry;deliver(s,old,at+4*day);assert.equal(u.memberExpiry,expiry)
 assert.equal(memberStatus(s,u,expiry),'已过期')
})


test('重新开启后新赠送和新购买均可重新获得会员，旧失效单始终不能恢复',()=>{
 for(const source of ['邀请奖励','购买会员','人工补发']){
  const s=store(),at=parseChina('2026-11-20 10:00:00'),day=86400000,next=clone(s.config),u=s.users[0]
  u.memberExpiry=at+30*day
  s.config.member.benefits=[{code:'CUSTOM',name:'新权益',description:'说明',enabled:true,icon:''}]
  next.member.benefits=clone(s.config.member.benefits)
  Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'invalidate'});applyConfig(s,next,at)
  const during=pendingMember('CLOSED','U',at+day);deliver(s,during,at+day)
  next.member.enabled=true;applyConfig(s,next,at+2*day)
  const fresh=pendingMember('NEW-'+source,'U',at+3*day,source)
  deliver(s,fresh,at+3*day)
  assert.equal(fresh.status,'已发放')
  assert.equal(fresh.memberStart,at+3*day)
  assert.equal(u.memberExpiry,addMonths(at+3*day,1))
  assert.equal(availableMemberBenefits(s,u,at+3*day).length,1)
  const snapshot=clone(fresh),expiry=u.memberExpiry
  deliver(s,during,at+4*day);deliver(s,fresh,at+4*day)
  assert.equal(u.memberExpiry,expiry);assert.deepEqual(fresh,snapshot)
  assert.equal(memberStatus(migrateStore(s).store,u,at+4*day),'有效会员')
  next.member.enabled=false;applyConfig(s,next,at+5*day)
  assert.equal(memberStatus(s,u,at+5*day),'会员已失效')
  assert.equal(s.memberInvalidations.U.previousExpiry,expiry)
 }
})

test('失效模式仍独立发券，重新开启后新邀请会员按新时长和新权益生效',()=>{
 const s=store(),at=Date.now()-1000,next=clone(s.config),u=s.users[0]
 u.memberExpiry=at+30*86400000
 Object.assign(next.member,{enabled:false,closeMode:'all',closedClock:'invalidate'});applyConfig(s,next,at)
 const closed=processInvite(s,event('CLOSED-EVENT',{at:at+1,inviteeId:'CLOSED-NEW'}),s.config,'CLOSED')
 const invalid=closed.grants.find(g=>g.kind==='member')
 assert.equal(invalid.status,'已失效')
 assert.equal(closed.grants.find(g=>g.kind==='voucher').status,'已发放')
 next.member.enabled=true;member(next).target=1;member(next).months=2
 next.member.benefits=[{code:'NEW-BENEFIT',name:'新权益',description:'新说明',enabled:true,icon:''}]
 applyConfig(s,next,at+2)
 const fresh=processInvite(s,event('NEW-EVENT',{at:at+3,inviteeId:'AFTER-NEW'}),s.config,'REOPENED')
 assert.equal(fresh.grants.find(g=>g.kind==='member').status,'已发放')
 assert.equal(fresh.grants.find(g=>g.kind==='member').months,2)
 assert.equal(memberStatus(s,u,Date.now()),'有效会员')
 assert.equal(availableMemberBenefits(s,u,Date.now())[0].code,'NEW-BENEFIT')
 const expiry=u.memberExpiry;deliver(s,invalid,Date.now());assert.equal(u.memberExpiry,expiry)
})


test('支付范围名称迁移保留旧勾选，新订单支付独立保存，历史券和快照不变',()=>{
 for(const scope of [[],['需求单'],['会员'],['需求单','会员'],['会员购买'],['需求单支付','会员支付','订单支付'],['需求单','需求单支付','会员','会员支付','订单支付']]){
  const old=store();globalRules(old.config);old.config.vouchers.orderScope=clone(scope)
  old.grants=[{id:'HISTORY',kind:'voucher',usage:clone(old.config.vouchers)}]
  old.invites=[{...event(),status:'有效',version:'OLD',configSnapshot:clone(old.config)}]
  const loaded=migrateStore(old).store,expected=[...new Set(scope.map(s=>s==='需求单'?'需求单支付':['会员','会员购买'].includes(s)?'会员支付':s))]
  assert.deepEqual(loaded.config.vouchers.templates[0].usage.orderScope,expected)
  assert.deepEqual(loaded.grants,old.grants)
  assert.deepEqual(loaded.invites,old.invites)
  const edit=clone(loaded.config);edit.vouchers.templates[0].usage.orderScope=['订单支付']
  const saved=mergeModule(loaded.config,edit,'template')
  assert.deepEqual(migrateStore({...loaded,config:saved}).store.config.vouchers.templates[0].usage.orderScope,['订单支付'])
  assert.equal(orderDiscount(saved.vouchers.templates[0].usage,10,1,2,'订单支付',false).discount,200)
  assert.equal(orderDiscount(saved.vouchers.templates[0].usage,10,1,2,'需求单支付',false).discount,0)
  assert.equal(orderDiscount(saved.vouchers.templates[0].usage,10,1,2,'会员支付',false).discount,0)
 }
})

test('不同模板的范围、张数、优惠同享和退款独立，不随另一张券变更',()=>{
 const c=config(),a=c.vouchers.templates[0],b={...clone(a),id:'SECOND',name:'会员券',amount:5,usage:{orderScope:['会员支付'],minSpend:0,maxPerOrder:3,withPromotion:true,refund:'extend',refundExtendDays:14}}
 c.vouchers.templates.push(b)
 assert.equal(orderDiscount(a.usage,20,1,a.amount,'需求单支付',false).discount,200)
 assert.equal(orderDiscount(b.usage,20,3,b.amount,'会员支付',true).discount,1500)
 assert.equal(orderDiscount(a.usage,20,1,a.amount,'会员支付',false).discount,0)
 assert.equal(orderDiscount(b.usage,20,1,b.amount,'需求单支付',false).discount,0)
 const previous=clone(a)
 b.usage.orderScope.push('订单支付');b.usage.maxPerOrder=2;b.usage.refund='none'
 assert.deepEqual(a,previous)
 assert.equal(a.usage.refund,'original')
 assert.equal(b.usage.refund,'none')
 assert.deepEqual(validateModule(c,'template'),[])
})

test('保存某张模板只校验该券及其依赖；其他券未完善不阻塞',()=>{
 const c=config(),other={...clone(c.vouchers.templates[0]),id:'OTHER',name:'待完善券',usage:defaultVoucherUsage()}
 other.usage.orderScope=[];c.vouchers.templates.push(other)
 assert.deepEqual(validateModule(c,'template',{},'TPL'),[])
 assert.ok(validateModule(c,'template',{},'OTHER').length>=2)
 const edit=clone(c);edit.vouchers.templates[0].usage.maxPerOrder=4;edit.member.enabled=false
 const saved=mergeModule(c,edit,'template')
 assert.equal(saved.vouchers.templates[0].usage.maxPerOrder,4)
 assert.deepEqual(saved.vouchers.templates[1],other)
 assert.equal('enabled' in saved.vouchers,false);assert.equal(saved.member.enabled,true)
 saved.vouchers.templates[0].enabled=false
 assert.ok(validateModule(saved,'template',{},'TPL').some(e=>e.field==='关联模板'))
 assert.deepEqual(validateModule(saved,'template',{},'OTHER').filter(e=>e.field==='关联模板'),[])
})

test('schema1/2/3将旧统一规则迁入每券，已具备独立规则的券优先且不污染历史',()=>{
 for(const schema of [1,2,3]){
  const old=store();old.schema=schema;old.config=schema===3?globalRules(config()):legacyConfig()
  Object.assign(old.config.vouchers,{orderScope:['需求单','会员'],minSpend:0,maxPerOrder:4,withPromotion:true,refund:'extend',refundExtendDays:12})
  const first=old.config.vouchers.templates[0]
  old.config.vouchers.templates.push({...clone(first),id:'COPY',name:'旧券2'})
  const own={orderScope:['订单支付'],minSpend:0,maxPerOrder:2,withPromotion:false,refund:'none',refundExtendDays:1}
  old.config.vouchers.templates.push({...clone(first),id:'OWN',name:'已有独立规则',usage:clone(own)})
  if(schema!==3)old.progress={U:{count:9,target:10,months:1,version:'OLD'}}
  old.grants=[{id:'OLD',kind:'voucher',source:'邀请奖励',template:clone(first),usage:clone(old.config.vouchers)}]
  old.invites=[{...event(),status:'有效',version:'OLD',configSnapshot:clone(old.config)}]
  const before=clone(old),loaded=migrateStore(old).store
  const [a,b,independent]=loaded.config.vouchers.templates
  assert.deepEqual(a.usage,{orderScope:['需求单支付','会员支付'],minSpend:0,maxPerOrder:4,withPromotion:true,refund:'extend',refundExtendDays:12})
  assert.deepEqual(b.usage,a.usage);assert.deepEqual(independent.usage,own)
  assert.deepEqual(Object.keys(loaded.config.vouchers),['templates'])
  assert.deepEqual(loaded.grants[0].template,before.grants[0].template)
  assert.deepEqual(loaded.grants[0].usage,before.grants[0].usage)
  assert.deepEqual(loaded.invites[0].configSnapshot.vouchers,before.invites[0].configSnapshot.vouchers)
  assert.deepEqual(migrateStore(loaded).store.config,loaded.config)
  a.usage.orderScope.push('订单支付');assert.equal(b.usage.orderScope.includes('订单支付'),false)
  assert.deepEqual(old,before)
 }
})

test('迁移不擅自补全未确认退款方式；新券默认值不继承任一现有券',()=>{
 const old=store();globalRules(old.config);old.config.vouchers.refund=''
 const loaded=migrateStore(old).store
 assert.equal(loaded.config.vouchers.templates[0].usage.refund,'')
 assert.ok(validateModule(loaded.config,'template',{},'TPL').some(e=>e.field.endsWith('退款退券')))
 const a=defaultVoucherUsage(),b=defaultVoucherUsage();a.orderScope.push('订单支付')
 assert.deepEqual(b.orderScope,['需求单支付']);assert.equal(b.refund,'')
})

test('活动发放引用各自券规则；已发单和失败补发单保持原规则',()=>{
 const s=store(),c=config(),a=c.vouchers.templates[0],b={...clone(a),id:'SECOND',name:'第二张',amount:8,usage:{orderScope:['订单支付'],minSpend:0,maxPerOrder:2,withPromotion:true,refund:'extend',refundExtendDays:9}}
 c.vouchers.templates.push(b);const second=addActivity(c);second.rewards[1].templateId=b.id
 const result=processInvite(s,event('TWO'),c,'V1'),grants=result.grants.filter(g=>g.kind==='voucher')
 assert.equal(grants.length,2)
 assert.deepEqual(grants.find(g=>g.template.id==='TPL').usage,a.usage)
 assert.deepEqual(grants.find(g=>g.template.id==='SECOND').usage,b.usage)
 const failed=processInvite(s,event('FAILED',{inviteeId:'FAILED-NEW',failure:'voucher'}),c,'V1').grants.find(g=>g.template?.id==='SECOND')
 const oldUsage=clone(failed.usage);b.usage.orderScope=['会员支付'];b.usage.refund='none';s.config=c
 deliver(s,failed,Date.now())
 assert.equal(failed.status,'已发放');assert.deepEqual(grantUsage(failed),oldUsage)
 assert.equal(orderDiscount(grantUsage(failed),20,1,8,'订单支付',true).discount,800)
 assert.equal(orderDiscount(b.usage,20,1,8,'订单支付',true).discount,0)
})

test('未完成券奖励轮次锁定用券规则，刷新后继续旧轮次，下一轮使用新规则',()=>{
 let s=store();const c=config();member(c).enabled=false;voucher(c).target=2
 processInvite(s,event('ROUND-1',{inviteeId:'ROUND-N1'}),c,'V1')
 const old=clone(c.vouchers.templates[0].usage)
 c.vouchers.templates[0].usage={orderScope:['会员支付'],minSpend:0,maxPerOrder:3,withPromotion:true,refund:'none',refundExtendDays:4}
 s.config=c;s=migrateStore(s).store
 const first=processInvite(s,event('ROUND-2',{inviteeId:'ROUND-N2'}),s.config,'V2').grants[0]
 assert.equal(first.version,'V1');assert.deepEqual(first.usage,old)
 processInvite(s,event('ROUND-3',{inviteeId:'ROUND-N3'}),s.config,'V2')
 const next=processInvite(s,event('ROUND-4',{inviteeId:'ROUND-N4'}),s.config,'V2').grants[0]
 assert.equal(next.version,'V2');assert.deepEqual(next.usage,c.vouchers.templates[0].usage)
 assert.deepEqual(first.usage,old)
})

test('旧未完成轮次从对应历史快照继承统一用券规则，不使用最新模板规则',()=>{
 const old=store(),history=globalRules(config());voucher(history).target=2
 history.vouchers.orderScope=['会员'];history.vouchers.refund='extend';history.vouchers.refundExtendDays=15
 const key=progressKey('U','ACT-001','voucher')
 old.progress[key]={count:1,target:2,months:0,version:'OLD',reward:clone(voucher(history)),template:clone(history.vouchers.templates[0])}
 old.invites=[{...event('PRIOR',{inviteeId:'PRIOR-NEW'}),status:'有效',version:'OLD',configSnapshot:clone(history)}]
 old.config.vouchers.templates[0].usage.orderScope=['订单支付']
 const before=clone(old),loaded=migrateStore(old).store
 assert.deepEqual(loaded.progress[key].template,before.progress[key].template)
 assert.deepEqual(loaded.invites,before.invites)
 const grant=processInvite(loaded,event('FINISH',{inviteeId:'FINISH-NEW'}),loaded.config,'NEW').grants.find(g=>g.kind==='voucher')
 assert.equal(grant.version,'OLD');assert.deepEqual(grant.usage.orderScope,['会员支付']);assert.equal(grant.usage.refundExtendDays,15)
})

test('旧待核验邀请按旧全局规则发券；历史缺少规则时明确未知',()=>{
 const s=store(),c=globalRules(config());c.vouchers.orderScope=['会员'];c.vouchers.refund='none'
 const r=processInvite(s,event('AUDIT-OLD',{risk:true}),c,'OLD')
 const loaded=migrateStore(s).store
 const g=auditInvite(loaded,loaded.invites[0],true,'核验通过').find(g=>g.kind==='voucher')
 assert.deepEqual(g.usage.orderScope,['会员支付']);assert.equal(g.usage.refund,'none')
 const historical={usage:{...clone(c.vouchers)},template:clone(c.vouchers.templates[0])},before=clone(historical)
 assert.deepEqual(grantUsage(historical).orderScope,['会员支付']);assert.deepEqual(historical,before)
 assert.equal(grantUsage({template:clone(c.vouchers.templates[0])}),null)
 assert.deepEqual(grantUsage({template:clone(config().vouchers.templates[0])}),config().vouchers.templates[0].usage)
 assert.equal(r.record.configSnapshot.vouchers.orderScope[0],'会员')
})

test('复制模板规则互不引用，规则修改有明确中文操作日志',()=>{
 const before=config(),after=clone(before),a=after.vouchers.templates[0],copy=clone(a)
 copy.id='COPY';copy.name='副本';copy.usage.orderScope=['订单支付'];copy.usage.maxPerOrder=3;copy.usage.refund='extend';copy.usage.refundExtendDays=21
 after.vouchers.templates.push(copy)
 assert.deepEqual(a.usage,before.vouchers.templates[0].usage)
 assert.ok(diffConfig(before,after).some(d=>d.field==='优惠券模板'&&d.after.includes('订单支付')&&d.after.includes('21天')))
 const edit=clone(before);edit.vouchers.templates[0].usage.withPromotion=true
 const difference=diffConfig(before,edit).find(d=>d.field==='优惠券模板')
 assert.match(difference.before,/不与其他优惠同享/);assert.match(difference.after,/可与其他优惠同享/)
 assert.match(voucherUsageSummary(copy.usage),/每单最多3张/)
})

test('旧发券总开关从当前配置移除，历史记录及逐券规则保留',()=>{
 for(const schema of [1,2,3])for(const enabled of [true,false]){
  const old=store();old.schema=schema;old.config=schema===3?config():legacyConfig();old.config.vouchers.enabled=enabled
  if(schema!==3)old.progress={U:{count:9,target:10,months:1,version:'OLD'}}
  old.grants=[{id:'OLD-GRANT',kind:'voucher',source:'邀请奖励',status:'已发放',template:clone(old.config.vouchers.templates[0]),usage:{enabled,orderScope:['需求单支付'],minSpend:0,maxPerOrder:2,withPromotion:false,refund:'original',refundExtendDays:7}}]
  old.invites=[{...event('HISTORY'),version:'OLD',status:'有效',configSnapshot:clone(old.config)}]
  const before=clone(old),loaded=migrateStore(old).store
  assert.equal('enabled' in loaded.config.vouchers,false)
  assert.equal(loaded.invites[0].configSnapshot.vouchers.enabled,enabled)
  assert.deepEqual(loaded.grants[0].usage,before.grants[0].usage)
  assert.deepEqual(loaded.grants[0].template,before.grants[0].template)
  assert.deepEqual(grantUsage(loaded.grants[0]).orderScope,['需求单支付'])
  assert.deepEqual(validateModule(loaded.config,'activity'),[])
  const result=processInvite(loaded,event('AFTER',{inviteeId:'AFTER-NEW'}),loaded.config,'NEW')
  assert.equal(result.grants.find(g=>g.kind==='voucher').status,'已发放')
  assert.deepEqual(old,before)
 }
})

test('删除总开关后仅活动、奖励及模板状态控制新增发券，补发仍按原单',()=>{
 for(const disabled of ['activity','reward','template']){
  const s=store(),c=config();member(c).enabled=false
  const prior=processInvite(s,event('FAILED',{failure:'voucher'}),c,'V1').grants[0]
  assert.equal(prior.status,'发放失败')
  if(disabled==='activity')c.activities[0].enabled=false
  if(disabled==='reward')voucher(c).enabled=false
  if(disabled==='template')c.vouchers.templates[0].enabled=false
  s.config=c
  assert.equal(processInvite(s,event('DISABLED',{inviteeId:'DISABLED-NEW'}),c,'V2').grants.length,0)
  deliver(s,prior,Date.now());assert.equal(prior.status,'已发放');assert.equal(s.stock.TPL,1)
 }
})

test('满额门槛按优惠前金额判断，多张逐张累加且边界精确到分',()=>{
 const r={...defaultVoucherUsage(),minSpend:100,maxPerOrder:3,withPromotion:true}
 assert.equal(orderDiscount(r,80,1,10,'需求单支付',true,99.99).discount,0)
 assert.equal(orderDiscount(r,80,1,10,'需求单支付',true,100).discount,1000)
 assert.equal(orderDiscount(r,80,2,10,'需求单支付',true,199.99).discount,0)
 assert.equal(orderDiscount(r,80,2,10,'需求单支付',true,200).discount,2000)
 assert.equal(orderDiscount(r,80,3,10,'需求单支付',true,300).discount,3000)
 assert.equal(orderDiscount(r,80,4,10,'需求单支付',true,400).discount,0)
 r.minSpend=0.1
 assert.equal(orderDiscount(r,0.29,3,0.01,'需求单支付',true,0.29).discount,0)
 assert.equal(orderDiscount(r,0.29,3,0.01,'需求单支付',true,0.3).discount,3)
})

test('满额不替代适用范围及同享校验，抵扣只减优惠后应付，不产生负数',()=>{
 const r={...defaultVoucherUsage(),minSpend:100,maxPerOrder:2,withPromotion:true}
 const result=orderDiscount(r,5,2,10,'需求单支付',true,200)
 assert.equal(result.discount,500);assert.equal(result.payable,0)
 assert.equal(orderDiscount(r,0,2,10,'需求单支付',true,200).discount,0)
 assert.equal(orderDiscount(r,80,1,10,'会员支付',true,100).discount,0)
 r.withPromotion=false
 assert.equal(orderDiscount(r,80,1,10,'需求单支付',true,100).discount,0)
 assert.equal(orderDiscount(r,100,1,10,'需求单支付',false).discount,1000)
 r.minSpend=0;r.withPromotion=true
 assert.equal(orderDiscount(r,80,2,10,'需求单支付',true).discount,2000)
 assert.match(voucherThresholdSummary(r),/无门槛/)
})

test('满额券缺少或收到异常优惠前金额时不误判通过',()=>{
 const r={...defaultVoucherUsage(),minSpend:100,withPromotion:true}
 for(const original of [undefined,NaN,Infinity,-1,70]){
  const result=orderDiscount(r,80,1,10,'需求单支付',true,original)
  assert.equal(result.discount,0);assert.equal(result.payable,8000);assert.match(result.reason,/优惠前订单金额/)
 }
 for(const minSpend of [-1,null,NaN,Infinity])assert.equal(orderDiscount({...r,minSpend},80,1,10,'需求单支付',true,100).discount,0)
})

test('每券门槛金额校验、独立保存、复制及日志，允许无门槛且最多两位小数',()=>{
 const c=config(),r=c.vouchers.templates[0].usage
 for(const amount of [0,0.01,99.99,100,99999]){r.minSpend=amount;assert.deepEqual(validateModule(c,'template',{},'TPL'),[])}
 for(const amount of [-0.01,0.001,100000,NaN,Infinity,null,undefined]){
  r.minSpend=amount;assert.ok(validateModule(c,'template',{},'TPL').some(i=>i.field.endsWith('使用门槛')))
 }
 r.minSpend=100
 const before=config(),saved=mergeModule(before,c,'template'),copy=clone(saved.vouchers.templates[0]);copy.usage.minSpend=200
 assert.equal(saved.vouchers.templates[0].usage.minSpend,100);assert.equal(before.vouchers.templates[0].usage.minSpend,0)
 const change=diffConfig(before,saved).find(d=>d.field==='优惠券模板')
 assert.match(change.before,/无门槛/);assert.match(change.after,/满 ¥100.00 可用/)
 assert.match(change.after,/优惠前金额，多张累计门槛/)
 assert.equal(migrateStore({...store(),config:saved}).store.config.vouchers.templates[0].usage.minSpend,100)
})

test('旧券和旧配置缺少金额门槛时按无门槛读取，不回写历史，已有门槛不丢失',()=>{
 for(const schema of [1,2,3]){
  const old=store();old.schema=schema;old.config=schema===3?config():legacyConfig()
  if(schema===3)delete old.config.vouchers.templates[0].usage.minSpend
  else{delete old.config.vouchers.minSpend;old.progress={U:{count:9,target:10,months:1,version:'OLD'}}}
  old.grants=[{id:'HISTORY',kind:'voucher',source:'邀请奖励',usage:clone(config().vouchers.templates[0].usage)}];delete old.grants[0].usage.minSpend
  old.invites=[{...event('OLD-EVENT'),status:'有效',version:'OLD',configSnapshot:clone(old.config)}]
  const before=clone(old),loaded=migrateStore(old).store
  assert.equal(loaded.config.vouchers.templates[0].usage.minSpend,0)
  assert.equal(grantUsage(loaded.grants[0]).minSpend,0)
  assert.deepEqual(loaded.grants[0].usage,before.grants[0].usage)
  assert.deepEqual(loaded.invites[0].configSnapshot.vouchers,before.invites[0].configSnapshot.vouchers)
  assert.equal(orderDiscount(grantUsage(loaded.grants[0]),1,1,2,'需求单支付',false).discount,100)
  assert.deepEqual(old,before)
 }
 const old=store();old.config.vouchers.templates[0].usage.minSpend=100
 assert.equal(migrateStore(old).store.config.vouchers.templates[0].usage.minSpend,100)
})

test('修改金额门槛不改变已发券和旧轮次，下一轮采用新门槛，失败补发保留原门槛',()=>{
 let s=store();const c=config();member(c).enabled=false;voucher(c).target=2
 const t=c.vouchers.templates[0];t.usage.minSpend=100
 processInvite(s,event('T1',{inviteeId:'N1'}),c,'V1')
 t.usage.minSpend=200;s.config=c;s=migrateStore(s).store
 const first=processInvite(s,event('T2',{inviteeId:'N2',failure:'voucher'}),s.config,'V2').grants[0]
 assert.equal(first.status,'发放失败');assert.equal(first.usage.minSpend,100)
 deliver(s,first,Date.now());assert.equal(first.status,'已发放');assert.equal(grantUsage(first).minSpend,100)
 processInvite(s,event('T3',{inviteeId:'N3'}),s.config,'V2')
 const next=processInvite(s,event('T4',{inviteeId:'N4'}),s.config,'V2').grants[0]
 assert.equal(next.usage.minSpend,200)
 assert.equal(orderDiscount(grantUsage(first),150,1,2,'需求单支付',false).discount,200)
 assert.equal(orderDiscount(grantUsage(next),150,1,2,'需求单支付',false).discount,0)
})

const timesTemplate=()=>({...config().vouchers.templates[0],type:'times',amount:null,name:'需求发布抵用券',usage:{...defaultVoucherUsage(),orderScope:[timesVoucherScope],refund:'original'}})

test('抵用券按一次需求发布全额抵扣，不设面额上限；零元不消耗',()=>{
 const t=timesTemplate()
 for(const amount of [0.01,19.9,99.99,10000,1000000]){
  const result=orderDiscount(t.usage,amount,1,t.amount,timesVoucherScope,false,undefined,t.type)
  assert.equal(result.discount,cents(amount));assert.equal(result.payable,0);assert.match(result.reason,/1张抵用券/)
 }
 const zero=orderDiscount(t.usage,0,1,null,timesVoucherScope,false,undefined,t.type)
 assert.equal(zero.discount,0);assert.match(zero.reason,/不占用或核销/)
 for(const amount of [-1,NaN,Infinity])assert.equal(orderDiscount(t.usage,amount,1,null,timesVoucherScope,false,undefined,t.type).discount,0)
})

test('抵用券不抵需求单课费、会员或其他订单；一单一张且保留同享约束',()=>{
 const t=timesTemplate(),pay=(scope,count=1,promotion=false)=>orderDiscount(t.usage,20,count,null,scope,promotion,100,t.type)
 for(const scope of ['需求单支付','会员支付','订单支付','其他'])assert.equal(pay(scope).discount,0)
 for(const count of [0,2,1.5])assert.equal(pay(timesVoucherScope,count).discount,0)
 assert.equal(pay(timesVoucherScope,1,true).discount,0)
 t.usage.withPromotion=true
 assert.equal(pay(timesVoucherScope,1,true).discount,2000)
 t.usage.minSpend=100
 assert.equal(pay(timesVoucherScope).discount,0)
 t.usage.minSpend=0;t.usage.maxPerOrder=2
 assert.equal(pay(timesVoucherScope).discount,0)
 const amount=config().vouchers.templates[0]
 assert.equal(orderDiscount(amount.usage,20,1,amount.amount,timesVoucherScope,false).discount,0)
})

test('抵用券保存校验不依赖面额，拒绝错误类型、金额门槛和无效抵用范围',()=>{
 const c=config();c.vouchers.templates[0]=timesTemplate()
 assert.deepEqual(validateModule(c,'template',{},'TPL'),[])
 const mutations=[t=>{t.type='unknown'},t=>{t.amount=2},t=>{t.usage.minSpend=1},t=>{t.usage.maxPerOrder=2},t=>{t.usage.orderScope=['需求单支付']},t=>{t.usage.orderScope=[]}]
 for(const change of mutations){const bad=clone(c);change(bad.vouchers.templates[0]);assert.ok(validateModule(bad,'template',{},'TPL').length>0)}
 const saved=mergeModule(config(),c,'template'),copy=clone(saved.vouchers.templates[0]);copy.usage.withPromotion=true
 assert.equal(saved.vouchers.templates[0].amount,null);assert.equal(saved.vouchers.templates[0].usage.withPromotion,false)
 assert.equal(migrateStore({...store(),config:saved}).store.config.vouchers.templates[0].type,'times')
 assert.equal(migrateStore({...store(),config:saved}).store.config.vouchers.templates[0].amount,null)
})

test('抵用券奖励按张计发，发放失败和重复事件不影响其他奖励且不重复入账',()=>{
 const c=config(),s=store();c.vouchers.templates[0]=timesTemplate();voucher(c).quantity=2;s.config=c
 const r=processInvite(s,event('TIMES',{failure:'voucher'}),c,'TIMES-V1'),gs=r.grants.filter(g=>g.kind==='voucher')
 assert.equal(gs.length,2);assert.ok(gs.every(g=>g.status==='发放失败'&&g.amount===null&&g.template.type==='times'))
 const expiry=s.users[0].memberExpiry
 for(const g of gs){deliver(s,g,Date.now());deliver(s,g,Date.now());assert.equal(g.status,'已发放');assert.equal(g.expiresAt-g.issuedAt,30*86400000)}
 assert.equal(s.stock.TPL,2);assert.equal(s.users[0].memberExpiry,expiry)
 assert.equal(processInvite(s,event('TIMES'),c,'TIMES-V1').grants.length,0)
 assert.equal(gs.filter(g=>g.template.type==='times').length,2);assert.ok(gs.every(g=>g.amount===null))
})

test('已创建模板无论是否发放均锁定类型，兼容缺少类型的旧金额券',()=>{
 for(const original of [config().vouchers.templates[0],timesTemplate()]){
  const current=config();current.vouchers.templates[0]=clone(original)
  const next=clone(current);next.vouchers.templates[0]=original.type==='times'?config().vouchers.templates[0]:timesTemplate()
  for(const stock of [{},{TPL:13}])assert.ok(validateModule(next,'template',stock,'TPL',current).some(issue=>issue.field.includes('优惠券类型')&&issue.message.includes('创建后不可修改')))
  assert.equal(current.vouchers.templates[0].type,original.type)
 }
 const current=config();delete current.vouchers.templates[0].type
 const next=config();assert.deepEqual(validateModule(next,'template',{},'TPL',current),[])
 next.vouchers.templates[0]=timesTemplate()
 assert.ok(validateModule(next,'template',{},'TPL',current).some(issue=>issue.message.includes('创建后不可修改')))
})

test('新建和复制的新模板可选择类型，保存后锁定且其他规则仍可编辑',()=>{
 const current=config(),next=clone(current),created={...timesTemplate(),id:'TPL-REDEEM'}
 next.vouchers.templates.push(created)
 assert.deepEqual(validateModule(next,'template',{},created.id,current),[])
 const saved=migrateStore({...store(),config:next}).store.config,edited=clone(saved),t=edited.vouchers.templates[1]
 t.name='新抵用券名称';t.days=60;t.usage.orderScope=['接单支付'];t.usage.withPromotion=true
 assert.deepEqual(validateModule(edited,'template',{},t.id,saved),[])
 const copy={...clone(t),id:'TPL-COPY',type:'amount',amount:10,usage:defaultVoucherUsage()};copy.usage.refund='original'
 edited.vouchers.templates.push(copy)
 assert.deepEqual(validateModule(edited,'template',{},copy.id,saved),[])
 t.type='amount'
 assert.ok(validateModule(edited,'template',{},t.id,saved).some(issue=>issue.message.includes('创建后不可修改')))
})

test('活动换绑新抵用券模板，旧轮次和失败单保留原类型，下一轮使用新模板',()=>{
 let s=store();const c=config();member(c).enabled=false;voucher(c).target=2;s.config=c
 processInvite(s,event('TYPE1',{inviteeId:'N1'}),c,'AMOUNT-V1')
 const redemption={...timesTemplate(),id:'TPL-REDEEM'};c.vouchers.templates.push(redemption);voucher(c).templateId=redemption.id;s=migrateStore(s).store;s.config=c
 const old=processInvite(s,event('TYPE2',{inviteeId:'N2',failure:'voucher'}),c,'TIMES-V2').grants[0]
 assert.equal(grantVoucherType(old),'amount');assert.equal(old.amount,2)
 deliver(s,old,Date.now());assert.equal(old.status,'已发放');assert.equal(grantVoucherBenefit(old),'¥2.00')
 processInvite(s,event('TYPE3',{inviteeId:'N3'}),c,'TIMES-V2')
 const next=processInvite(s,event('TYPE4',{inviteeId:'N4'}),c,'TIMES-V2').grants[0]
 assert.equal(grantVoucherType(next),'times');assert.equal(next.amount,null);assert.equal(next.usage.orderScope[0],timesVoucherScope)
 assert.equal(c.vouchers.templates[0].type,'amount');assert.equal(next.template.id,redemption.id)
 redemption.usage.orderScope=['接单支付']
 assert.equal(grantVoucherType(next),'times');assert.equal(grantVoucherBenefit(next),'需求发布1次')
})

test('旧schema1/2/3默认金额券，历史资产及邀请快照不补写类型',()=>{
 for(const schema of [1,2,3]){
  const old=store();old.schema=schema;old.config=schema===3?config():legacyConfig();delete old.config.vouchers.templates[0].type
  if(schema!==3)old.progress={U:{count:9,target:10,months:1,version:'OLD'}}
  const template=clone(old.config.vouchers.templates[0]);old.grants=[{id:'OLD-TYPE',kind:'voucher',source:'邀请奖励',amount:2,template}]
  old.invites=[{...event('OLD-TYPE-EVENT'),status:'有效',version:'OLD',configSnapshot:clone(old.config)}]
  const before=clone(old),loaded=migrateStore(old).store
  assert.equal(loaded.config.vouchers.templates[0].type,'amount');assert.equal(loaded.config.vouchers.templates[0].amount,2)
  assert.equal(grantVoucherType(loaded.grants[0]),'amount');assert.equal(Object.hasOwn(loaded.grants[0].template,'type'),false)
  assert.deepEqual(loaded.invites[0].configSnapshot.vouchers,before.invites[0].configSnapshot.vouchers);assert.deepEqual(old,before)
 }
})

test('抵用券在规则、活动、资产汇总和日志中显示次数，不显示0元面额',()=>{
 const c=config(),before=clone(c);c.vouchers.templates[0]=timesTemplate()
 const t=c.vouchers.templates[0],times={kind:'voucher',template:clone(t),amount:null},old={kind:'voucher',amount:2}
 assert.equal(voucherBenefit(t),'需求发布1次');assert.equal(voucherTypeLabels[t.type],'抵用券')
 assert.match(voucherUsageSummary(t.usage,t.type),/全部应付费用/)
 assert.doesNotMatch(voucherUsageSummary(t.usage,t.type),/门槛|¥|0元/)
 assert.match(rewardSummary(voucher(c),c,true),/需求发布1次/)
 assert.equal(voucherAssetSummary([times,old]),'金额券 ¥2.00 · 抵用券 1张')
 assert.equal(voucherAssetSummary([times]),'抵用券 1张');assert.equal(voucherAssetSummary([]),'暂无可用券')
 const change=diffConfig(before,c).find(d=>d.field==='优惠券模板')
 assert.match(change.after,/抵用券 \/ 需求发布1次/);assert.doesNotMatch(change.after,/¥0.00/)
})

test('抵用项目三种非空组合独立保存并精确匹配，全额抵扣接单支付',()=>{
 for(const scopes of [['需求发布'],['接单支付'],timesVoucherScopes]){
  const c=config();c.vouchers.templates[0]=timesTemplate();const t=c.vouchers.templates[0];t.usage.orderScope=[...scopes]
  assert.deepEqual(validateModule(c,'template',{},'TPL'),[])
  const saved=migrateStore({...store(),config:mergeModule(config(),c,'template')}).store.config.vouchers.templates[0]
  assert.deepEqual(saved.usage.orderScope,scopes)
  for(const scope of timesVoucherScopes){
   for(const amount of [0.01,19.9,99999,1000000]){
    const r=orderDiscount(saved.usage,amount,1,null,scope,false,undefined,'times')
    assert.equal(r.discount,scopes.includes(scope)?cents(amount):0)
    if(scopes.includes(scope)){assert.equal(r.payable,0);assert.match(r.reason,new RegExp(scope))}
   }
  }
  for(const scope of ['需求单支付','会员支付','订单支付'])assert.equal(orderDiscount(saved.usage,100,1,null,scope,false,undefined,'times').discount,0)
 }
 const bad=timesTemplate();bad.usage.orderScope=['需求发布','其他']
 assert.equal(orderDiscount(bad.usage,10,1,null,'需求发布',false,undefined,'times').discount,0)
})

test('项目摘要与记录按券快照展示，双项目表示任选一次且保留抵用券名称',()=>{
 const t=timesTemplate();t.name='接单支付抵用券';t.note='送一张接单支付抵用券';t.usage.orderScope=['接单支付']
 assert.equal(voucherBenefit(t),'接单支付1次')
 assert.match(voucherUsageSummary(t.usage,t.type),/接单支付1次/)
 const c=config();c.vouchers.templates[0]=t;c.activities[0].note='奖励接单支付抵用券'
 assert.match(rewardSummary(voucher(c),c,true),/接单支付1次/)
 const s=store();s.config=c
 const loaded=migrateStore(s).store
 assert.equal(loaded.config.vouchers.templates[0].name,t.name);assert.equal(loaded.config.vouchers.templates[0].note,t.note)
 assert.equal(loaded.config.activities[0].note,c.activities[0].note)
 assert.equal(voucherTemplateName({...t,name:'旧次数券'}),'旧抵用券')
 assert.equal(voucherTemplateName({...t,type:'amount',name:'2元抵用券'}),'2元优惠券')
 const g={kind:'voucher',amount:null,template:clone(t),usage:clone(t.usage)}
 t.usage.orderScope=[...timesVoucherScopes]
 assert.equal(voucherBenefit(t),'需求发布 / 接单支付任选1次')
 assert.equal(grantVoucherBenefit(g),'接单支付1次')
 assert.match(voucherUsageSummary(t.usage,t.type),/需求发布 \/ 接单支付任选1次/)
 assert.equal(voucherAssetSummary([g]),'抵用券 1张')
})

test('扩展抵用项目不扩大旧券和未完成轮次，补发与下一轮分别沿用正确范围',()=>{
 let s=store();const c=config();member(c).enabled=false;voucher(c).target=2;c.vouchers.templates[0]=timesTemplate();s.config=clone(c)
 processInvite(s,event('SCOPE1',{inviteeId:'SC1'}),c,'PUBLISH')
 c.vouchers.templates[0].usage.orderScope=['接单支付'];s.config=clone(c);s=migrateStore(s).store
 const old=processInvite(s,event('SCOPE2',{inviteeId:'SC2',failure:'voucher'}),s.config,'ACCEPT').grants[0]
 assert.deepEqual(old.usage.orderScope,['需求发布']);assert.equal(old.status,'发放失败')
 deliver(s,old,Date.now());assert.equal(old.status,'已发放');assert.equal(grantVoucherBenefit(old),'需求发布1次')
 processInvite(s,event('SCOPE3',{inviteeId:'SC3'}),s.config,'ACCEPT')
 const next=processInvite(s,event('SCOPE4',{inviteeId:'SC4'}),s.config,'ACCEPT').grants[0]
 assert.deepEqual(next.usage.orderScope,['接单支付']);assert.equal(grantVoucherBenefit(next),'接单支付1次')
 assert.equal(orderDiscount(old.usage,30,1,null,'接单支付',false,undefined,'times').discount,0)
 assert.equal(orderDiscount(next.usage,30,1,null,'接单支付',false,undefined,'times').discount,3000)
 const before=clone(s.grants);s=migrateStore(s).store;assert.deepEqual(s.grants,before)
})


test('日期清空、非法日期和缺失历史时间不会抛异常或通过校验',()=>{
 for(const value of [null,undefined,'','invalid'])assert.ok(Number.isNaN(parseChina(value)))
 assert.equal(stamp(undefined),'—');assert.equal(stamp(NaN),'—')
 const c=config();c.activities[0].period='range';c.activities[0].start=null;c.activities[0].end='2026-11-30 10:00:00'
 assert.ok(validateModule(c,'activity').some(i=>i.field.includes('活动时间')))
 const t=c.vouchers.templates[0];t.validity='fixed';t.fixedStart=null;t.fixedEnd='2026-12-30 10:00:00'
 assert.ok(validateModule(c,'template').some(i=>i.message.includes('起止时间')))
})
test('购买方案独立校验当前项，全局重复编号及重名仍被阻止',()=>{
 const c=config();c.member.plans.push({id:'BAD',name:'未完善方案',months:0,price:0,enabled:false})
 assert.deepEqual(validateModule(c,'plan',{},'MON'),[]);assert.ok(validateModule(c,'plan').length)
 c.member.plans[1].name=c.member.plans[0].name;assert.ok(validateModule(c,'plan',{},'MON').some(i=>i.field==='方案名称'))
 c.member.plans[1].id='MON';assert.ok(validateModule(c,'plan',{},'MON').some(i=>i.field==='方案编号'))
})
test('方案价格与券面额拒绝小于1分及超过两位小数的值',()=>{
 const c=config()
 for(const amount of [0.005,1.001,9.999]){
  c.member.plans[0].price=amount;c.vouchers.templates[0].amount=amount
  assert.ok(validateModule(c,'plan').some(i=>i.message.includes('两位小数')))
  assert.ok(validateModule(c,'template').some(i=>i.message.includes('两位小数')))
 }
})
test('活动引用的固定有效期券不能被编辑为已过期，停用活动后可保存',()=>{
 const c=config(),t=c.vouchers.templates[0];t.validity='fixed';t.fixedStart='2020-01-01 00:00:00';t.fixedEnd='2020-02-01 00:00:00'
 assert.ok(validateModule(c,'template',{},t.id).some(i=>i.field==='关联模板'))
 c.activities[0].enabled=false;assert.deepEqual(validateModule(c,'template',{},t.id),[])
})
test('已过期但仍被订单锁定的券不能撤回，解锁后可撤回',()=>{
 const now=Date.now(),g={kind:'voucher',status:'已发放',expiresAt:now-1000,lockedUntil:now+1000}
 assert.equal(voucherStatus(g,now),'已过期');assert.equal(canRevokeVoucher(g,now),false)
 assert.equal(canRevokeVoucher({...g,lockedUntil:now},now),true)
 assert.equal(canRevokeVoucher({...g,lockedUntil:now,usedAt:now-2000},now),false)
 assert.equal(canRevokeVoucher({...g,kind:'member',lockedUntil:now},now),false)
})
