export type Tone = 'success'|'warning'|'danger'|'info'|'primary'
export type Role = 'parent'|'teacher'|'partner'
export type Plan = {id:string; name:string; months:number; price:number; enabled:boolean}
export type Benefit = {code:string; name:string; description:string; enabled:boolean; icon:string}
export type MemberCloseMode='purchase-only'|'all'
export const memberCloseModeLabels:Record<MemberCloseMode,string>={'purchase-only':'仅关闭会员购买',all:'关闭会员及全部权益'}
export type MemberClosedClock='continue'|'pause'|'invalidate'
export const memberClosedClockLabels:Record<MemberClosedClock,string>={continue:'关闭期间继续计时',pause:'关闭期间暂停计时',invalidate:'关闭后失效，重新开启需重新购买'}
export const memberBenefitLimit=5
export const benefitIconMaxBytes=500*1024
export const benefitIconTypes=['image/png','image/jpeg','image/webp']
export function benefitIconError(value:string):string{
 if(value==='')return ''
 const match=/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
 if(!match||match[1].length%4!==0)return '请上传 PNG、JPG 或 WebP 图标'
 const body=match[1],bytes=body.length/4*3-(body.endsWith('==')?2:body.endsWith('=')?1:0)
 return bytes>benefitIconMaxBytes?'图标大小不能超过 500 KB':''
}
export type VoucherUsageRules={orderScope:string[];minSpend:number;maxPerOrder:number;withPromotion:boolean;refund:''|'original'|'extend'|'none';refundExtendDays:number}
export type VoucherType='amount'|'times'
export const voucherTypeLabels:Record<VoucherType,string>={amount:'金额券',times:'抵用券'}
export type VoucherTemplate = {id:string; name:string; type:VoucherType; amount:number|null; enabled:boolean; validity:'relative'|'fixed'; days:number; fixedStart:string; fixedEnd:string; totalLimit:number; perUserLimit:number; note:string;usage:VoucherUsageRules}
export const voucherOrderScopes=['需求单支付','会员支付','订单支付']
export const timesVoucherScope='需求发布'
export const timesVoucherScopes=[timesVoucherScope,'接单支付']
export const voucherTemplateName=(voucher:Pick<VoucherTemplate,'name'>&{type?:VoucherType})=>voucher.type==='times'?voucher.name.replaceAll('次数券','抵用券'):voucher.name.replaceAll('抵用券','优惠券')
export const redemptionContent=(scopes:string[])=>scopes.length===1?scopes[0]+'1次':scopes.length>1?scopes.join(' / ')+'任选1次':'抵用1次（未选择项目）'
export const voucherBenefit=(voucher:Pick<VoucherTemplate,'amount'>&{type?:VoucherType;usage?:VoucherUsageRules})=>voucher.type==='times'?redemptionContent(voucher.usage?.orderScope??[]):'¥'+money(voucher.amount??NaN)
export const grantVoucherType=(grant:Grant):VoucherType=>grant.template?.type??'amount'
export const grantVoucherBenefit=(grant:Grant)=>voucherBenefit({type:grantVoucherType(grant),amount:grant.amount,usage:grantUsage(grant)??undefined})
export function voucherAssetSummary(grants:Grant[]):string{
 const amounts=grants.filter(g=>grantVoucherType(g)==='amount'),times=grants.length-amounts.length
 return [amounts.length?'金额券 ¥'+money(amounts.reduce((sum,g)=>sum+(g.amount??0),0)):'',times?'抵用券 '+times+'张':''].filter(Boolean).join(' · ')||'暂无可用券'
}
export const voucherRefundLabels:Record<VoucherUsageRules['refund'],string>={'':'未配置退款规则',original:'退回原券，保留原有效期',extend:'退回原券并补偿有效期',none:'不自动退券，人工核对'}
export const defaultVoucherUsage=():VoucherUsageRules=>({orderScope:['需求单支付'],minSpend:0,maxPerOrder:1,withPromotion:false,refund:'',refundExtendDays:7})
type LegacyVoucherUsage=Partial<VoucherUsageRules>&{allowMemberPurchase?:boolean}
function normalizeVoucherUsage(value:LegacyVoucherUsage):VoucherUsageRules{
 const rules={...defaultVoucherUsage(),...value}
 const orderScope=[...new Set(rules.orderScope.map(scope=>['需求单','体验课订单','正式课订单'].includes(scope)?'需求单支付':['会员','会员购买'].includes(scope)?'会员支付':scope))]
 if(value.allowMemberPurchase===true&&!orderScope.includes('会员支付'))orderScope.push('会员支付')
 return {orderScope,minSpend:rules.minSpend,maxPerOrder:rules.maxPerOrder,withPromotion:rules.withPromotion,refund:rules.refund,refundExtendDays:rules.refundExtendDays}
}
// Legacy snapshots keep their original shape; resolve their rules without rewriting history.
export function templateUsage(template:VoucherTemplate,legacy:LegacyVoucherUsage={}):VoucherUsageRules{return normalizeVoucherUsage(template.usage??legacy)}
export function grantUsage(grant:Grant):VoucherUsageRules|null{return grant.usage?normalizeVoucherUsage(grant.usage):grant.template?.usage?templateUsage(grant.template):null}
export function voucherThresholdSummary(rules:VoucherUsageRules):string{return (rules.minSpend??0)>0?'满 ¥'+money(rules.minSpend)+' 可用':'无门槛'}
export function voucherUsageSummary(rules:VoucherUsageRules,type:VoucherType='amount'):string{return (type==='times'?'每张抵用'+redemptionContent(rules.orderScope)+'，抵扣本次全部应付费用，不限金额':voucherThresholdSummary(rules)+((rules.minSpend??0)>0?'（优惠前金额，多张累计门槛）':'')+' · 每单最多'+rules.maxPerOrder+'张')+' · '+(rules.withPromotion?'可与其他优惠同享':'不与其他优惠同享')+' · '+voucherRefundLabels[rules.refund]+(rules.refund==='extend'?'（'+rules.refundExtendDays+'天）':'')}
export type InvitationRules={period:'permanent'|'range';start:string;end:string;inviterRoles:Role[];inviteeRoles:Role[];riskPolicy:'hold'|'block'}
export type MemberReward={kind:'member';enabled:boolean;target:number;months:number;repeat:boolean;perUserLimit:number}
export type VoucherReward={kind:'voucher';enabled:boolean;target:number;templateId:string;quantity:number;repeat:boolean;perUserLimit:number}
export type ActivityReward=MemberReward|VoucherReward
// Priority is retained only to read existing activity policies; new forms do not configure it.
export type Activity=InvitationRules&{id:string;name:string;enabled:boolean;archived?:boolean;trigger:'invite-register';priority?:number;note:string;rewards:ActivityReward[]}
export type Config = {
  demandPayment:{enabled:boolean;amount:number};
  member:{enabled:boolean; closeMode:MemberCloseMode; closedClock:MemberClosedClock; badgeIcon:string; plans:Plan[]; benefits:Benefit[]};
  vouchers:{templates:VoucherTemplate[]};
  activities:Activity[];activitySettings:{stacking:'all'|'priority'}
}
export type ConfigModule='member'|'plan'|'template'|'activity'|'demand-payment'
export type Issue={section:string;field:string;message:string}
export type Progress={count:number;target:number;months:number;version:string;reward?:ActivityReward;template?:VoucherTemplate;usage?:VoucherUsageRules}
export type InviteEvent={id:string;inviterId:string;inviteeId:string;name:string;role:Role;inviterRole:Role;at:number;isNew:boolean;risk:boolean;failure:'none'|'member'|'voucher'|'both';boundAt?:number}
export type ActivityResult={activityId:string;activityName:string;status:'已计数'|'未命中'|'待核验'|'不计奖'|'优先级排除';reason:string}
export type InviteRecord=InviteEvent&{status:'有效'|'不计奖'|'待核验';reason:string;version:string;configSnapshot?:Config;activityResults?:ActivityResult[]}
export type GrantStatus='已发放'|'发放失败'|'待发放'|'已撤回'|'人工处理'|'已失效'
export type Grant={id:string;key:string;userId:string;kind:'member'|'voucher';source:'邀请奖励'|'购买会员'|'人工补发';eventId:string;activityId?:string;activityName?:string;version:string;status:GrantStatus;reason:string;createdAt:number;issuedAt?:number;amount:number|null;months:number;template?:VoucherTemplate;usage?:VoucherUsageRules;expiresAt?:number;usedAt?:number;lockedUntil?:number;beforeExpiry?:number;memberStart?:number;memberEnd?:number;attempts:number}
export type User={id:string;name:string;phone:string;role:Role;memberExpiry:number|null;blocked:boolean}
export const memberSuspended=(c:Config)=>!c.member.enabled&&c.member.closeMode==='all'
export const memberInvalidating=(c:Config)=>memberSuspended(c)&&c.member.closedClock==='invalidate'
export function memberExpiryAt(store:Store,user:User,now:number):number|null{
 if(user.memberExpiry===null)return null
 const pausedAt=store.memberPause?.users[user.id]
 return user.memberExpiry+(pausedAt===undefined?0:Math.max(0,now-pausedAt))
}
export function memberStatus(store:Store,user:User,now:number):string{
 const invalidation=store.memberInvalidations?.[user.id]
 if(invalidation&&invalidation.restoredAt===undefined)return '会员已失效'
 const expiry=memberExpiryAt(store,user,now)
 if(expiry===null)return '未开通'
 if(expiry<=now)return '已过期'
 return memberSuspended(store.config)?'会员已停用':'有效会员'
}
export const availableMemberBenefits=(store:Store,user:User,now:number)=>!user.blocked&&memberStatus(store,user,now)==='有效会员'?store.config.member.benefits.filter(b=>b.enabled):[]
export type Log={id:string;at:number;operator:string;action:string;target:string;detail:string}
export type Store={schema:3;config:Config;configId:string;savedAt:Partial<Record<ConfigModule,number>>;users:User[];invites:InviteRecord[];grants:Grant[];progress:Record<string,Progress>;logs:Log[];stock:Record<string,number>;seq:number;memberPause?:{startedAt:number;users:Record<string,number>};memberInvalidatedBefore?:number;memberInvalidations?:Record<string,{at:number;previousExpiry:number|null;restoredAt?:number}>}
export function applyConfig(store:Store,next:Config,now:number){
 const invalidate=memberInvalidating(next)&&!memberInvalidating(store.config)
 const pause=memberSuspended(next)&&next.member.closedClock==='pause'
 if(store.memberPause&&!pause){
  for(const user of store.users)user.memberExpiry=memberExpiryAt(store,user,now)
  delete store.memberPause
 }
 if(pause&&!store.memberPause)store.memberPause={startedAt:now,users:Object.fromEntries(store.users.filter(u=>(u.memberExpiry??0)>now).map(u=>[u.id,now]))}
 if(invalidate){
  store.memberInvalidatedBefore=now
  for(const user of store.users)if((user.memberExpiry??0)>now){
   store.memberInvalidations??={}
   store.memberInvalidations[user.id]={at:now,previousExpiry:user.memberExpiry}
   user.memberExpiry=now
  }
 }
 store.config=clone(next)
}
export const roleLabels:Record<Role,string>={parent:'家长',teacher:'老师',partner:'合伙人'}
export const activityRoles:Role[]=['parent','teacher']
export const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T
export const cents=(yuan:number)=>Math.round((yuan+Number.EPSILON)*100)
export const money=(yuan:number)=>Number.isFinite(yuan)?yuan.toFixed(2):'—'
export const stamp=(value:number|undefined)=>value===undefined||!Number.isFinite(value)?'—':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(value).replaceAll('/','-')
export const parseChina=(value:string|null|undefined)=>typeof value!=='string'||!value.trim()?NaN:Date.parse(value.replace(' ','T')+(value.includes('+')||value.endsWith('Z')?'':'+08:00'))
export function addMonths(base:number,months:number){
  const date=new Date(base+8*3600000),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+months)
  const lastDay=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,lastDay));return date.getTime()-8*3600000
}
export const voucherStatus=(grant:Grant,now:number)=>grant.status==='已撤回'?'已撤回':grant.usedAt!==undefined?'已使用':(grant.expiresAt??0)<=now?'已过期':(grant.lockedUntil??0)>now?'锁定中':'未使用'
export const canRevokeVoucher=(grant:Grant,now:number)=>grant.kind==='voucher'&&grant.status==='已发放'&&grant.usedAt===undefined&&(grant.lockedUntil??0)<=now
export const tone=(status:string):Tone=>['已发放','有效','未使用','生效中','有效会员'].includes(status)?'success':['待发放','待核验','锁定中','待生效','未发布','会员已停用'].includes(status)?'warning':['发放失败','已撤回','人工处理','不计奖','已失效','会员已失效'].includes(status)?'danger':'info'
const integer=(value:number,min=1,max=1000000)=>Number.isInteger(value)&&value>=min&&value<=max
export const moduleNames:Record<ConfigModule,string>={member:'会员设置',plan:'购买方案',template:'优惠券模板',activity:'活动管理','demand-payment':'需求支付'}
export function mergeModule(current:Config,edited:Config,module:ConfigModule):Config{
 const next=clone(current)
 if(module==='demand-payment')next.demandPayment=clone(edited.demandPayment)
 else if(module==='member')next.member={...clone(edited.member),plans:next.member.plans}
 else if(module==='plan')next.member.plans=clone(edited.member.plans)
 else if(module==='template')next.vouchers.templates=clone(edited.vouchers.templates)
 else next.activities=clone(edited.activities)
 return next
}
export function newActivity(id='ACT-'+Date.now()):Activity{return {id,name:'',enabled:true,trigger:'invite-register',note:'',period:'permanent',start:'',end:'',inviterRoles:[...activityRoles],inviteeRoles:[...activityRoles],riskPolicy:'hold',rewards:[]}}
export const activityOrder=(a:Activity,b:Activity)=>(a.priority??100)-(b.priority??100)||a.id.localeCompare(b.id)
export function activityStatus(a:Activity,now=Date.now()):string{return !a.enabled?'已停用':a.period==='range'&&now<parseChina(a.start)?'未开始':a.period==='range'&&now>=parseChina(a.end)?'已结束':'进行中'}
export function rewardSummary(r:ActivityReward,c:Config,compact=false){const t=r.kind==='voucher'?c.vouchers.templates.find(t=>t.id===r.templateId):undefined;if(compact)return '满'+r.target+'位新用户，送'+(r.kind==='member'?r.months+'个月会员':(t?voucherBenefit(t):'未关联优惠券')+'优惠券×'+r.quantity)+(r.repeat?'':'（仅一次）');const award=r.kind==='member'?r.months+'个月会员':r.quantity+'张'+(c.vouchers.templates.find(t=>t.id===r.templateId)?.name??'未关联优惠券');return '每累计邀请'+r.target+'人，送'+award+(r.repeat?'':'（仅一次）')}
export function validateActivity(c:Config,a:Activity):Issue[]{
 const errors:Issue[]=[],err=(field:string,message:string)=>errors.push({section:'活动管理',field:(a.name||'活动')+' / '+field,message})
 if(!/^[A-Z0-9_-]{3,40}$/.test(a.id)||c.activities.filter(x=>x.id===a.id).length>1)err('活动编号','编号须唯一，使用3～40位大写字母、数字、下划线或横线')
 if(!a.name.trim())err('活动名称','请填写活动名称')
 if(a.name.length>40)err('活动名称','活动名称不能超过40字')
 if(a.trigger!=='invite-register')err('完成条件','目前支持邀请新用户完成注册')
 if(!a.inviterRoles.length||!a.inviteeRoles.length)err('参与身份','邀请人和新用户均须至少保留一种身份')
 if([...a.inviterRoles,...a.inviteeRoles].some(role=>!activityRoles.includes(role)))err('参与身份','邀请人和新用户身份仅支持家长、老师')
 if(a.period==='range'&&(!Number.isFinite(parseChina(a.start))||!Number.isFinite(parseChina(a.end))||parseChina(a.start)>=parseChina(a.end)))err('活动时间','结束时间须晚于开始时间')
 const enabled=a.rewards.filter(r=>r.enabled)
 if(!enabled.length)err('赠送奖励','请至少选择一种奖励')
 if(new Set(a.rewards.map(r=>r.kind)).size!==a.rewards.length)err('赠送奖励','同一活动同一种奖励只设置一条规则')
 for(const r of enabled){
  if(!integer(r.target,1,100000)||!integer(r.perUserLimit,0))err('达标条件','人数须为1～100000，每人上限须为非负整数')
  if(r.kind==='member'&&!integer(r.months,1,120))err('会员时长','须为1～120个自然月')
  if(r.kind==='voucher'){
   if(!integer(r.quantity,1,100))err('赠券张数','每次须为1～100张')
   if(r.perUserLimit>0&&r.perUserLimit<r.quantity)err('每人券上限','不能小于单次赠送张数')
   const t=c.vouchers.templates.find(t=>t.id===r.templateId)
   if(!t)err('奖励券模板','请选择存在的优惠券模板')
   if(a.enabled&&!t?.enabled)err('关联模板','启用活动前须先启用关联券模板')
   if(a.enabled&&t?.validity==='fixed'&&parseChina(t.fixedEnd)<=Date.now())err('模板有效期','固定有效期模板已过期，请换绑有效模板')
  }
 }
 return errors
}
export function validateModule(c:Config,module:ConfigModule,stock:Record<string,number>={},targetId?:string,current?:Config):Issue[]{
 const errors:Issue[]=[],section=moduleNames[module]
 const err=(field:string,message:string)=>errors.push({section,field,message})
 if(module==='demand-payment'){
  if(typeof c.demandPayment.enabled!=='boolean')err('需求支付开关','请选择开启或关闭')
  const amount=c.demandPayment.amount
  if(!Number.isFinite(amount)||amount<0.01||amount>99999||Math.abs(amount*100-cents(amount))>0.000001)err('单次发布金额','请输入0.01～99999元，最多两位小数')
 }
 if(module==='member'){
  if(!Object.hasOwn(memberCloseModeLabels,c.member.closeMode))err('关闭范围','请选择仅关闭会员购买或关闭会员及全部权益')
  if(!Object.hasOwn(memberClosedClockLabels,c.member.closedClock))err('有效期处理','请选择继续计时、暂停计时或关闭后失效')
  const badgeError=benefitIconError(c.member.badgeIcon);if(badgeError)err('会员标识',badgeError)
  if(c.member.benefits.length>memberBenefitLimit)err('会员权益','最多配置'+memberBenefitLimit+'项权益（含现有权益）')
  const codes=new Set<string>()
  c.member.benefits.forEach((b,index)=>{
   const field='第'+(index+1)+'项权益'
   if(!b.code||codes.has(b.code))err(field,'权益标识缺失或重复，请删除后重新新增');codes.add(b.code)
   if(!b.name.trim()||!b.description.trim())err(field,'请填写完整权益名称及说明')
   if(b.name.length>20)err(field,'权益名称不能超过20字')
   if(b.description.length>80)err(field,'权益说明不能超过80字')
   const iconError=benefitIconError(b.icon);if(iconError)err(b.name+'图标',iconError)
  })
  if(c.member.enabled&&!c.member.plans.some(p=>p.enabled))err('购买方案','开启会员开关前，至少启用一个购买方案')
 }
 if(module==='plan'){
  c.member.plans.filter(p=>!targetId||p.id===targetId).forEach(p=>{
   if(!/^[A-Z0-9_-]{3,40}$/.test(p.id)||c.member.plans.filter(x=>x.id===p.id).length>1)err('方案编号','方案编号须唯一，使用3～40位大写字母、数字、下划线或横线')
   if(!p.name.trim()||c.member.plans.filter(x=>x.name.trim()===p.name.trim()).length>1)err('方案名称','方案名称不能为空且不能重复')
   if(!integer(p.months,1,120))err(p.name,'时长须为1～120个自然月')
   if(!Number.isFinite(p.price)||p.price<0.01||p.price>99999||Math.abs(p.price*100-cents(p.price))>0.000001)err(p.name,'价格须为0.01～99999元，最多两位小数')
  })
  if(c.member.enabled&&!c.member.plans.some(p=>p.enabled))err('购买方案','会员开关已开启，不能下架最后一个方案；请先关闭会员开关')
 }
 if(module==='template'){
  c.vouchers.templates.filter(t=>!targetId||t.id===targetId).forEach(t=>{
   if(!/^[A-Z0-9_-]{3,40}$/.test(t.id)||c.vouchers.templates.filter(x=>x.id===t.id).length>1)err('模板编号','模板编号须唯一，使用3～40位大写字母、数字、下划线或横线')
   if(!t.name.trim())err('模板名称','请填写模板名称')
   const saved=current?.vouchers.templates.find(template=>template.id===t.id)
   if(saved&&(saved.type??'amount')!==(t.type??'amount'))err(t.name+' / 优惠券类型','类型创建后不可修改，如需变更请新增模板')
   if(!Object.hasOwn(voucherTypeLabels,t.type??'amount'))err(t.name+' / 优惠券类型','请选择金额券或抵用券')
   if(t.type==='times'){if(t.amount!==null)err(t.name,'抵用券不设置面额')}
   else if(t.amount===null||!Number.isFinite(t.amount)||t.amount<0.01||t.amount>99999||Math.abs(t.amount*100-cents(t.amount))>0.000001)err(t.name,'面额须为0.01～99999元，最多两位小数')
   if(t.validity==='relative'&&!integer(t.days,1,3650))err(t.name,'有效期须为1～3650天')
   if(t.validity==='fixed'&&(!Number.isFinite(parseChina(t.fixedStart))||!Number.isFinite(parseChina(t.fixedEnd))||parseChina(t.fixedStart)>=parseChina(t.fixedEnd)))err(t.name,'固定有效期起止时间不正确')
   if(!integer(t.totalLimit,0)||!integer(t.perUserLimit,0))err(t.name,'发放上限须为非负整数，0表示不限')
   if(t.totalLimit>0&&t.totalLimit<(stock[t.id]??0))err(t.name,'累计发放上限不能低于历史已成功发放 '+stock[t.id]+' 张（含已撤回）')
   const usage=t.usage
   if(!usage){err(t.name+' / 用券规则','请配置本券的用券规则');return}
   if(!usage.orderScope.length)err(t.name+' / 适用范围','请至少选择一种适用范围')
   if(t.type==='times'){
    if(usage.orderScope.some(scope=>!timesVoucherScopes.includes(scope)))err(t.name+' / 适用范围','抵用项目可选择需求发布、接单支付')
    if(usage.minSpend!==0||usage.maxPerOrder!==1)err(t.name+' / 抵用方式','抵用券不设金额门槛，每次使用1张')
   }else if(usage.orderScope.some(scope=>!voucherOrderScopes.includes(scope)))err(t.name+' / 适用范围','请选择需求单支付、会员支付或订单支付')
   if(!Number.isFinite(usage.minSpend)||usage.minSpend<0||usage.minSpend>99999||Math.abs(usage.minSpend*100-cents(usage.minSpend))>0.000001)err(t.name+' / 使用门槛','门槛须为0～99999元，最多两位小数；0表示无门槛')
   if(!integer(usage.maxPerOrder,1,20))err(t.name+' / 每单张数','本券每单须为1～20张')
   if(!usage.refund||!Object.hasOwn(voucherRefundLabels,usage.refund))err(t.name+' / 退款退券','请选择退款退券方式')
   if(usage.refund==='extend'&&!integer(usage.refundExtendDays,1,365))err(t.name+' / 退券有效期','退券延长时间须为1～365天')
  })
  for(const a of c.activities.filter(a=>a.enabled))for(const r of a.rewards)if(r.enabled&&r.kind==='voucher'&&(!targetId||r.templateId===targetId)&&!c.vouchers.templates.some(t=>t.id===r.templateId&&t.enabled))err('关联模板','活动「'+a.name+'」正在使用该模板，请先换绑模板、取消该奖励或停用活动')
  for(const a of c.activities.filter(a=>a.enabled&&!a.archived))for(const r of a.rewards)if(r.enabled&&r.kind==='voucher'&&(!targetId||r.templateId===targetId)){
   const t=c.vouchers.templates.find(t=>t.id===r.templateId)
   if(t?.enabled&&t.validity==='fixed'&&parseChina(t.fixedEnd)<=Date.now())err('关联模板','活动「'+a.name+'」正在使用该模板，不能将其有效期改为已结束；请先换绑或停用活动')
  }
 }
 if(module==='activity')for(const a of c.activities.filter(a=>!a.archived&&(!targetId||a.id===targetId)))errors.push(...validateActivity(c,a))
 return errors
}
export function validateConfig(c:Config):Issue[]{return (Object.keys(moduleNames) as ConfigModule[]).flatMap(m=>validateModule(c,m))}
type LegacyAttribution={attribution?:'first'|'last';attributionDays?:number}
type LegacyConfig=Omit<Config,'activities'|'activitySettings'>&{invitation:InvitationRules&LegacyAttribution&{enabled:boolean};memberReward:Omit<MemberReward,'kind'>;voucherReward:Omit<VoucherReward,'kind'|'target'|'repeat'>}
function upgradeConfig(old:LegacyConfig):Config{
 const {invitation,memberReward,voucherReward,...rest}=old
 const {enabled,...rules}=invitation
 return {...clone(rest),activitySettings:{stacking:'all'},activities:[{...clone(rules),id:'ACT-INVITE-001',name:'邀请好友双重奖励',enabled:enabled&&(memberReward.enabled||voucherReward.enabled),trigger:'invite-register',note:'由原邀请奖励配置合并，会员与优惠券分别达标、同时赠送',rewards:[{...clone(memberReward),kind:'member'},{...clone(voucherReward),kind:'voucher',target:1,repeat:true}]}]}
}
function normalizeConfig(c:Config){
 c.demandPayment={enabled:c.demandPayment?.enabled??true,amount:c.demandPayment?.amount??9.9}
 const {enabled,closeMode,closedClock,badgeIcon,benefits,plans}=c.member
 c.member={enabled,closeMode:closeMode??'purchase-only',closedClock:closedClock??'continue',badgeIcon:typeof badgeIcon==='string'?badgeIcon:'',benefits:benefits.map(b=>({...b,icon:typeof b.icon==='string'?b.icon:''})),plans:plans.map(({id,name,months,price,enabled})=>({id,name,months,price,enabled}))}
 const old=c.vouchers as Config['vouchers']&LegacyVoucherUsage
 c.vouchers={templates:old.templates.map(t=>({...t,type:t.type??'amount',name:voucherTemplateName(t),note:t.type==='times'?t.note.replaceAll('次数券','抵用券'):t.note.replaceAll('抵用券','优惠券'),usage:templateUsage(t,old)}))}
 c.activities=c.activities.map(activity=>{
  const {attribution:unusedAttribution,attributionDays:unusedAttributionDays,...current}=activity as Activity&LegacyAttribution
  return {...current,inviterRoles:activity.inviterRoles.filter(role=>activityRoles.includes(role)),inviteeRoles:activity.inviteeRoles.filter(role=>activityRoles.includes(role))}
 })
}
function preserveProgressUsage(store:Store){
 for(const p of Object.values(store.progress))if(p.template&&!p.usage){
  const snapshot=store.invites.find(i=>i.version===p.version&&i.configSnapshot)?.configSnapshot
  const legacy=(snapshot??store.config).vouchers as Config['vouchers']&LegacyVoucherUsage
  p.usage=templateUsage(p.template,legacy)
 }
}
export function migrateStore(value:unknown):{store:Store;notice:string}|null{
 if(!value||typeof value!=='object')return null
 const legacy=value as Record<string,unknown>
 if(legacy.schema===3&&legacy.config&&Array.isArray(legacy.grants)){const store=clone(value as Store);preserveProgressUsage(store);normalizeConfig(store.config);return {store,notice:''}}
 if(![1,2].includes(Number(legacy.schema))||!Array.isArray(legacy.grants))return null
 const old=value as Omit<Store,'schema'|'config'|'savedAt'>&{config?:LegacyConfig;savedAt?:Record<string,number>;draft?:LegacyConfig;versions?:{status:string;id:string;config:LegacyConfig}[]}
 const active=old.versions?.find(v=>v.status==='生效中'),before=active?.config??old.config??old.draft
 if(!before?.invitation||!before.memberReward||!before.voucherReward)return null
 const {draft:unusedDraft,versions:unusedVersions,savedAt:unusedSaved,...records}=clone(old)
 const store:Store={...records,schema:3,config:upgradeConfig(before),configId:active?.id??old.configId??'MIGRATED',savedAt:{}}
 for(const i of store.invites){if(i.configSnapshot)i.configSnapshot=upgradeConfig(i.configSnapshot as unknown as LegacyConfig);i.activityResults=[{activityId:'ACT-INVITE-001',activityName:'邀请好友双重奖励',status:i.status==='待核验'?'待核验':i.status==='有效'?'已计数':'不计奖',reason:i.reason}]}
 for(const g of store.grants)if(g.source==='邀请奖励'){g.activityId='ACT-INVITE-001';g.activityName='邀请好友双重奖励'}
 normalizeConfig(store.config)
 const progress:Record<string,Progress>={}
 for(const [user,p] of Object.entries(store.progress)){progress[progressKey(user,'ACT-INVITE-001','member')]={...p,reward:{...clone(before.memberReward),kind:'member',target:p.target,months:p.months}}}
 store.progress=progress
 const migrationDetail='原两类邀请奖励已合并为「邀请好友双重奖励」活动；历史资产和未完成会员进度保留，旧数据未删除，未启用旧定时计划。'
 log(store,'迁移活动管理','ACT-INVITE-001',migrationDetail)
 return {store,notice:''}
}
export function expiryOf(t:VoucherTemplate,issuedAt:number){return t.validity==='relative'?issuedAt+t.days*86400000:parseChina(t.fixedEnd)}
export const progressKey=(userId:string,activityId:string,kind:ActivityReward['kind'])=>userId+':'+activityId+':'+kind
export function orderDiscount(rules:VoucherUsageRules,amount:number,count:number,face:number|null,orderType:string,promotion:boolean,originalAmount?:number,type:VoucherType='amount'){
  if(!Number.isFinite(amount)||amount<0)return {discount:0,payable:0,reason:'订单应付金额无效，暂不可使用本券'}
  if(!Object.hasOwn(voucherTypeLabels,type))return {discount:0,payable:cents(amount),reason:'优惠券类型无效，暂不可使用'}
  if(!(type==='times'?timesVoucherScopes:voucherOrderScopes).includes(orderType)||!rules.orderScope.includes(orderType))return {discount:0,payable:cents(amount),reason:'该订单不在本券抵用范围'}
  if(promotion&&!rules.withPromotion)return {discount:0,payable:cents(amount),reason:'本券不允许与其他优惠同享'}
  if(!integer(count,1,rules.maxPerOrder))return {discount:0,payable:cents(amount),reason:'所选张数超过本券每单上限'}
  const total=cents(amount)
  if(total===0)return {discount:0,payable:0,reason:'本单应付为0，不占用或核销优惠券'}
  if(type==='times'){
   if(count!==1||rules.maxPerOrder!==1||rules.minSpend!==0||rules.orderScope.some(scope=>!timesVoucherScopes.includes(scope)))return {discount:0,payable:total,reason:'抵用券每次使用1张，不设金额门槛，请配置有效抵用项目'}
   return {discount:total,payable:0,reason:'使用1张抵用券抵用本次'+orderType+'，全部应付费用已抵扣'}
  }
  if(face===null||!Number.isFinite(face)||face<=0)return {discount:0,payable:total,reason:'本券面额无效，暂不可使用'}
  const discount=Math.min(total,cents(face)*count)
  const minSpend=rules.minSpend===undefined?0:rules.minSpend
  if(!Number.isFinite(minSpend)||minSpend<0)return {discount:0,payable:total,reason:'本券使用门槛无效，暂不可使用'}
  const threshold=cents(minSpend)*count
  if(threshold>0){
   const base=originalAmount??(promotion?undefined:amount)
   if(base===undefined||!Number.isFinite(base)||base<0||cents(base)<total)return {discount:0,payable:total,reason:'缺少有效的优惠前订单金额，暂不可使用本券'}
   if(cents(base)<threshold)return {discount:0,payable:total,reason:count+'张券需优惠前订单金额满 ¥'+money(threshold/100)+'，当前为 ¥'+money(base)}
  }
  return {discount,payable:total-discount,reason:discount===total?'最多抵扣本单应付金额，不找零；所选券整张核销':'按本单实际抵扣金额核销'}
}
const fieldNames:Record<string,string>={'demandPayment.enabled':'需求支付开关','demandPayment.amount':'单次发布金额','member.enabled':'会员开关','member.closeMode':'关闭范围','member.closedClock':'有效期处理','member.badgeIcon':'会员标识图标','member.plans':'购买方案','member.benefits':'会员权益','vouchers.templates':'优惠券模板'}
function textValue(value:unknown):string{
 if(typeof value==='boolean')return value?'开启':'关闭'
 if(Array.isArray(value))return value.map((x:unknown)=>{
  if(typeof x!=='object'||x===null)return roleLabels[x as Role]||String(x)
  const item=x as Record<string,unknown>
  if('price' in item)return item.name+'：'+item.months+'个月 / ¥'+money(Number(item.price))+' / '+(item.enabled?'上架':'下架')
  if('amount' in item){const t=item as unknown as VoucherTemplate;return t.name+'：'+voucherTypeLabels[t.type??'amount']+' / '+voucherBenefit(t)+' / '+(t.validity==='relative'?'到账起'+t.days+'天':t.fixedStart+'至'+t.fixedEnd)+' / '+(t.enabled?'启用':'停用')+' / 总量'+(t.totalLimit||'不限')+' / 每人'+(t.perUserLimit||'不限')+' / '+(t.usage?t.usage.orderScope.join('、')+' / '+voucherUsageSummary(t.usage,t.type):'历史规则未记录')+' / '+t.note}
  if('code' in item)return item.name+'：'+(item.enabled?'开启':'关闭')+'（'+item.description+'） / '+(item.icon?'自定义图标':'默认图标')
  return String(item.name??'配置项')
 }).join('；')
 return value===''?'未配置':String(value)
}
function configFieldValue(section:string,key:string,value:unknown){if(section==='demandPayment'&&key==='amount')return value===undefined?'未配置':'¥'+money(Number(value))+' / 次';if(section==='member'&&key==='closeMode')return memberCloseModeLabels[value as MemberCloseMode]??'未配置';if(section==='member'&&key==='closedClock')return memberClosedClockLabels[value as MemberClosedClock]??'未配置';return section==='member'&&key==='badgeIcon'?(value?'自定义图标':'默认图标'):textValue(value)}
export function diffConfig(before:Config|null,after:Config){
 const diff:{field:string;before:string;after:string}[]=[]
 for(const section of ['member','vouchers','activitySettings','demandPayment'] as const){const a=(after[section]??{}) as unknown as Record<string,unknown>,b=(before?.[section]??{}) as Record<string,unknown>;for(const key of Object.keys(a))if(JSON.stringify(a[key])!==JSON.stringify(b[key]))diff.push({field:section==='activitySettings'?'多活动奖励规则':fieldNames[section+'.'+key]??section+'.'+key,before:before?section==='activitySettings'?(b[key]==='all'?'全部发奖':'优先级参与一个'):configFieldValue(section,key,b[key]):'首次配置',after:section==='activitySettings'?(a[key]==='all'?'全部发奖':'优先级参与一个'):configFieldValue(section,key,a[key])})}
 for(const a of after.activities){const old=before?.activities.find(x=>x.id===a.id);if(JSON.stringify(old)!==JSON.stringify(a))diff.push({field:'活动 '+a.id,before:old?activityDescription(old,before!):'新增',after:activityDescription(a,after)})}
 for(const a of before?.activities??[])if(!after.activities.some(x=>x.id===a.id))diff.push({field:'活动 '+a.id,before:activityDescription(a,before!),after:'已删除（历史记录保留）'})
 return diff
}
export function activityDescription(a:Activity,c:Config){return a.name+' / '+(a.archived?'已归档':a.enabled?'启用':'停用')+' / '+(a.period==='permanent'?'长期':a.start+'至'+a.end)+' / 邀请人'+a.inviterRoles.map(r=>roleLabels[r]).join('、')+' / 新用户'+a.inviteeRoles.map(r=>roleLabels[r]).join('、')+' / '+a.rewards.filter(r=>r.enabled).map(r=>rewardSummary(r,c)+'，上限'+(r.perUserLimit||'不限')).join('；')+' / 异常'+a.riskPolicy+' / '+a.note}
export function log(store:Store,action:string,target:string,detail:string,operator='运营管理员'){store.logs.unshift({id:'LOG-'+(++store.seq),at:Date.now(),operator,action,target,detail})}
export function deliver(store:Store,g:Grant,now:number,fail=false){
  if(['已发放','已撤回','已失效'].includes(g.status))return
  const user=store.users.find(x=>x.id===g.userId);g.attempts++
  if(g.kind==='member'&&(memberInvalidating(store.config)||g.createdAt<=(store.memberInvalidatedBefore??-Infinity))){g.status='已失效';g.reason='会员关闭后失效，重新开启不会恢复本笔权益；需新购买或新获得活动会员';return}
  if(!user||user.blocked){g.status='人工处理';g.reason='用户不存在或账号被冻结，请核验后处理';return}
  if(fail){g.status='发放失败';g.reason='权益服务暂不可用，可使用原发放单重试';return}
  if(g.kind==='voucher'){
    const t=g.template;if(!t){g.status='人工处理';g.reason='发放单缺少券模板快照';return}
    const expiry=expiryOf(t,now);if(expiry<=now){g.status='人工处理';g.reason='固定有效期已结束，不能补发过期券；请人工核对补偿';return}
    if(t.validity==='fixed'&&parseChina(t.fixedStart)>now){g.status='待发放';g.reason='尚未到券有效期开始时间';return}
    const capacity=store.config.vouchers.templates.find(x=>x.id===t.id)??t
    if(capacity.totalLimit&&((store.stock[t.id]??0)>=capacity.totalLimit)){g.status='待发放';g.reason='模板发放额度不足，保留应发资格，补量后重试';return}
    const issued=store.grants.filter(x=>x.id!==g.id&&x.userId===g.userId&&x.template?.id===t.id&&['已发放','已撤回'].includes(x.status)).length
    if(t.perUserLimit&&issued>=t.perUserLimit){g.status='人工处理';g.reason='达到券模板每人累计发放上限，请核对冲突规则';return}
    store.stock[t.id]=(store.stock[t.id]??0)+1;g.expiresAt=expiry
  }else{g.beforeExpiry=memberExpiryAt(store,user,now)??undefined;g.memberStart=Math.max(now,g.beforeExpiry??now);g.memberEnd=addMonths(g.memberStart,g.months);user.memberExpiry=g.memberEnd;if(store.memberPause)store.memberPause.users[user.id]=now;const invalidation=store.memberInvalidations?.[user.id];if(invalidation)invalidation.restoredAt=now}
  g.status='已发放';g.issuedAt=now;g.reason='权益已到账'
}
function applyActivity(store:Store,e:InviteEvent,c:Config,a:Activity,version:string,grants:Grant[]){
 for(const rule of a.rewards.filter(r=>r.enabled)){
  if(rule.kind==='voucher'&&!c.vouchers.templates.some(t=>t.id===rule.templateId&&t.enabled))continue
  const key=progressKey(e.inviterId,a.id,rule.kind),old=store.progress[key]
  const p:Progress=old??{count:0,target:rule.target,months:rule.kind==='member'?rule.months:0,version,reward:clone(rule)}
  if(!p.count){p.target=rule.target;p.months=rule.kind==='member'?rule.months:0;p.reward=clone(rule);p.version=version;p.template=rule.kind==='voucher'?clone(c.vouchers.templates.find(t=>t.id===rule.templateId)!):undefined;p.usage=p.template?templateUsage(p.template,c.vouchers as LegacyVoucherUsage):undefined}
  const r=p.reward??rule
  const claimed=store.grants.filter(g=>g.userId===e.inviterId&&g.activityId===a.id&&g.kind===r.kind&&g.source==='邀请奖励').length
  const cap=r.repeat?(rule.perUserLimit||Infinity):(r.kind==='member'?1:r.quantity)
  const quantity=r.kind==='member'?1:r.quantity
  if(claimed+quantity>cap){store.progress[key]=p;continue}
  p.count++
  if(p.count>=p.target){
   const template=r.kind==='voucher'?(p.template??c.vouchers.templates.find(t=>t.id===r.templateId)):undefined
   for(let i=0;i<quantity;i++){
    const grantKey=e.id+':'+a.id+':'+r.kind+':'+(i+1)
    if(store.grants.some(g=>g.key===grantKey))continue
    const usage=template?clone(p.usage??templateUsage(template,c.vouchers as LegacyVoucherUsage)):undefined
    const g:Grant={id:'GR-'+String(++store.seq).padStart(6,'0'),key:grantKey,userId:e.inviterId,kind:r.kind,source:'邀请奖励',eventId:e.id,activityId:a.id,activityName:a.name,version:p.version,status:'待发放',reason:'资格已锁定',createdAt:e.at,amount:template?template.amount:0,months:r.kind==='member'?r.months:0,template:template?clone(template):undefined,usage,attempts:0}
    store.grants.unshift(g);grants.push(g);deliver(store,g,Date.now(),e.failure===r.kind||e.failure==='both')
   }
   p.count=0;p.target=rule.target;p.months=rule.kind==='member'?rule.months:0;p.reward=clone(rule);p.version=version
  }
  store.progress[key]=p
 }
}
function matchingReason(e:InviteEvent,a:Activity){
 if(a.archived)return '活动已归档'
 if(!a.enabled)return '活动已停用'
 if(!a.rewards.some(r=>r.enabled))return '活动没有启用的奖励'
 if(a.period==='range'&&(e.at<parseChina(a.start)||e.at>=parseChina(a.end)))return '不在活动时间内'
 if(!activityRoles.includes(e.inviterRole)||!activityRoles.includes(e.role)||!a.inviterRoles.includes(e.inviterRole)||!a.inviteeRoles.includes(e.role))return '身份不在活动参与范围'
 if(e.boundAt!==undefined&&e.boundAt>e.at)return '未在注册前完成有效邀请绑定'
 return ''
}
export function processInvite(store:Store,e:InviteEvent,c:Config,version:string){
 const replay=store.invites.find(x=>x.id===e.id)
 if(replay)return {duplicate:true,record:replay,grants:[] as Grant[]}
 let reason=''
 if(!store.users.some(x=>x.id===e.inviterId))reason='邀请人不存在'
 else if(e.inviterId===e.inviteeId)reason='自己邀请自己，不计奖'
 else if(store.users.some(x=>x.id===e.inviteeId)||!e.isNew)reason='已注册老用户，不属于有效新用户'
 else if(store.invites.some(x=>x.inviteeId===e.inviteeId))reason='同一实际用户已处理，新增身份或其他邀请人不重复计奖'
 const record:InviteRecord={...e,status:reason?'不计奖':'有效',reason:reason||'新用户首次有效注册，统一用户去重',version,configSnapshot:clone(c),activityResults:[]};store.invites.unshift(record)
 const grants:Grant[]=[]
 if(reason)return {duplicate:false,record,grants}
 const candidates=c.activities.filter(a=>!matchingReason(e,a)).sort(activityOrder)
 const selected=c.activitySettings.stacking==='priority'?candidates.slice(0,1):candidates
 for(const a of c.activities){
  const miss=matchingReason(e,a),r:ActivityResult={activityId:a.id,activityName:a.name,status:'未命中',reason:miss}
  if(!miss&&!selected.some(s=>s.id===a.id)){r.status='优先级排除';r.reason='按优先级仅参加活动「'+selected[0]?.name+'」'}
  else if(!miss&&e.risk){r.status=a.riskPolicy==='hold'?'待核验':'不计奖';r.reason=a.riskPolicy==='hold'?'异常邀请待核验，不加进度':'异常邀请拒绝计奖'}
  else if(!miss){r.status='已计数';r.reason='按活动内各奖励独立累计';applyActivity(store,e,c,a,version,grants)}
  record.activityResults!.push(r)
 }
 const pending=record.activityResults!.some(r=>r.status==='待核验'),counted=record.activityResults!.some(r=>r.status==='已计数')
 record.status=pending&&!counted?'待核验':e.risk&&!counted?'不计奖':'有效'
 record.reason=counted?'已计入'+record.activityResults!.filter(r=>r.status==='已计数').length+'个活动'+(pending?'，另有活动待核验':''):pending?'异常邀请待核验':'邀请关系已记录，当前未计入任何活动'
 return {duplicate:false,record,grants}
}
export function auditInvite(store:Store,record:InviteRecord,pass:boolean,reason:string){
 const grants:Grant[]=[],c=record.configSnapshot??store.config
 for(const result of record.activityResults??[]){if(result.status!=='待核验')continue;const a=c.activities.find(a=>a.id===result.activityId);if(pass&&a){applyActivity(store,{...record,risk:false,failure:'none'},c,a,record.version,grants);result.status='已计数';result.reason='核验通过：'+reason}else{result.status='不计奖';result.reason='核验不通过：'+reason}}
 record.status=record.activityResults?.some(r=>r.status==='已计数')?'有效':'不计奖';record.reason=(pass?'已按原活动快照补计，已计分支不重复处理':'核验不通过，不计奖')+'：'+reason
 return grants
}
