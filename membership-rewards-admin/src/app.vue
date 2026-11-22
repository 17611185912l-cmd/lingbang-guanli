<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import {Setting,Refresh,Fold,Expand,User,Tickets,Medal,Share,CreditCard,DArrowLeft,DArrowRight} from '@element-plus/icons-vue'
import DemandPaymentConfig from './components/demand-payment-config.vue'
import ActivityManager from './components/activity-manager.vue'
import ConfigList from './components/config-list.vue'
import logoMark from './assets/logo.svg'
import ConfigPanel from './components/config-panel.vue'
import ItemEditor from './components/item-editor.vue'
import RecordPanel from './components/record-panel.vue'
import {loadStore,seedStore,storageKey} from './data'
import PrototypeGuide from './components/prototype-guide.vue'
import {providePageGuide,usePageGuide} from './spec/guide-context'
import type {GuideContext,GuideTopic} from './spec/types'
import {clone,diffConfig,validateModule,mergeModule,moduleNames,applyConfig,memberCloseModeLabels,memberClosedClockLabels,log,deliver,canRevokeVoucher,auditInvite,type Activity,type Config,type ConfigModule,type Grant,type InviteRecord,type Plan,type VoucherTemplate,type Store} from './model'
import {transactStore,StoreConflict,StoreRecoveryRequired} from './persistence'
const loaded=loadStore(),store=ref<Store>(loaded.store),config=computed(()=>store.value.config),storageNotice=ref(loaded.notice)
let storageToken=loaded.token
let storageRecoveryRequired=loaded.recoveryRequired
const collapsed=ref(false),workFullscreen=ref(false),configOpen=ref(false),configEditor=ref<Config>(clone(config.value)),saveError=ref(''),editorGeneration=ref(0),settingsIconBusy=ref(false),workspaceEl=ref<HTMLElement|null>(null)
const initialPage=new URLSearchParams(location.search).get('page')??'member'
const page=ref(['member','voucher','demand-payment','activities','records'].includes(initialPage)?initialPage:'member'),role=ref('admin'),loading=ref(true),loadError=ref(false),busy=ref(false),now=ref(Date.now()),toolsOpen=ref(false)
const canEdit=computed(()=>role.value==='admin'),canRead=computed(()=>role.value!=='none')
const confirmingSettings=ref(false)
const menu=[{id:'member',name:'会员配置'},{id:'voucher',name:'优惠券配置'},{id:'demand-payment',name:'需求支付'},{id:'activities',name:'活动管理'},{id:'records',name:'运营记录'}]
const current=computed(()=>menu.find(m=>m.id===page.value)!)
const guideOpen=ref(false),confirmationGuide=ref<GuideContext|null>(null)
const pageTopics:Record<string,GuideTopic>={member:'member_list',voucher:'voucher_list','demand-payment':'demand_payment',activities:'activity_list',records:'records_assets'}
const {context:guideContext,bus:guideBus}=providePageGuide(()=>({topic:!canRead.value?'no_access':loading.value?'loading':loadError.value?'load_error':storageRecoveryRequired?'storage_error':pageTopics[page.value],detail:canRead.value?(canEdit.value?'当前角色：运营管理员':'当前角色：只读运营'):'当前角色无访问权限',priority:!toolsOpen.value&&(!canRead.value||loading.value||loadError.value||storageRecoveryRequired)?60:0}))
usePageGuide(()=>confirmationGuide.value,guideBus)
usePageGuide(()=>configOpen.value?{topic:'member_settings',priority:20,detail:'当前为'+(canEdit.value?'编辑':'查看')+'；关闭范围：'+memberCloseModeLabels[configEditor.value.member.closeMode]+'；有效期：'+memberClosedClockLabels[configEditor.value.member.closedClock]+'；权益'+configEditor.value.member.benefits.length+'/5'}:null,guideBus)
const planOpen=ref(false),editKind=ref<'plan'|'template'>('plan'),selectedPlan=ref<Plan|null>(null),selectedTemplate=ref<VoucherTemplate|null>(null)
function persistMutation(mutate:(next:Store)=>Store|void,reset=false){
 const saved=transactStore(store.value,mutate,localStorage,storageKey,storageToken,storageRecoveryRequired&&!reset)
 store.value=saved.store;storageToken=saved.token;storageRecoveryRequired=false;storageNotice.value=''
}
function persistenceError(error:unknown){return error instanceof StoreConflict||error instanceof StoreRecoveryRequired?error.message:'保存失败，本次修改未生效。请检查本地存储空间或浏览器权限后重试。'}
function allowed(){if(!canEdit.value){ElMessage.warning('当前角色没有修改权限');return false}return true}
const delay=()=>new Promise(r=>setTimeout(r,220))
async function commit(next:Config,module:ConfigModule,activityId?:string):Promise<string>{
 if(!allowed())return '当前角色没有修改权限'
 if(busy.value)return '正在保存，请稍后重试'
 if(storageRecoveryRequired)return new StoreRecoveryRequired().message
 const issues=validateModule(next,module,store.value.stock,activityId,config.value)
 if(issues.length)return issues.map(i=>i.field+'：'+i.message).join('；')
 const changes=diffConfig(config.value,next)
 if(!changes.length){ElMessage.success('内容未变更，当前配置已生效');return ''}
 busy.value=true
 try{
  await delay()
  if(!allowed())return '当前角色没有修改权限'
  const at=Date.now()
  persistMutation(updated=>{
  applyConfig(updated,next,at);updated.configId='CFG-'+String(++updated.seq);updated.savedAt[module]=at
  log(updated,'保存并生效',module==='activity'?(next.activities.find(a=>a.id===activityId)?.name??'活动管理'):moduleNames[module],changes.map(c=>c.field+'：'+c.before+' → '+c.after).join('；'))
  })
  ElMessage.success(moduleNames[module]+'已保存并生效')
  return ''
 }catch(error){return persistenceError(error)}
 finally{busy.value=false}
}
function editPlan(p:Plan|null){copiedTemplate.value=null;selectedPlan.value=p?clone(p):null;selectedTemplate.value=null;editKind.value='plan';planOpen.value=true}
function editTemplate(t:VoucherTemplate|null){copiedTemplate.value=null;selectedTemplate.value=t?clone(t):null;selectedPlan.value=null;editKind.value='template';planOpen.value=true}
async function savePlan(p:Plan):Promise<string>{const next=clone(config.value),index=next.member.plans.findIndex(x=>x.id===p.id);if(index<0)next.member.plans.push(p);else next.member.plans[index]=p;return commit(next,'plan',p.id)}
async function saveTemplate(t:VoucherTemplate):Promise<string>{const next=clone(config.value),index=next.vouchers.templates.findIndex(x=>x.id===t.id);if(index<0)next.vouchers.templates.push(t);else next.vouchers.templates[index]=t;return commit(next,'template',t.id)}
async function saveActivity(activity:Activity):Promise<string>{const next=clone(config.value),index=next.activities.findIndex(a=>a.id===activity.id);if(index<0)next.activities.push(activity);else next.activities[index]=activity;return commit(next,'activity',activity.id)}
async function deleteActivity(id:string):Promise<string>{const a=config.value.activities.find(a=>a.id===id);if(!a)return '活动不存在';if(a.enabled)return '请先停用活动';if(store.value.invites.some(i=>i.activityResults?.some(r=>r.activityId===id&&!['未命中','优先级排除'].includes(r.status)))||store.value.grants.some(g=>g.activityId===id)||Object.entries(store.value.progress).some(([key,p])=>key.includes(':'+id+':')&&p.count>0))return '活动存在参与记录、奖励或未完成进度，请停用并保留追溯';const next=clone(config.value);const saved=next.activities.find(a=>a.id===id)!;saved.archived=true;saved.enabled=false;return commit(next,'activity',id)}
async function saveDemandPayment(payment:Config['demandPayment']):Promise<string>{const edited=clone(config.value);edited.demandPayment=payment;return commit(mergeModule(config.value,edited,'demand-payment'),'demand-payment')}
function copyTemplate(t:VoucherTemplate){if(!allowed())return;const copy=clone(t);copy.id='VC-'+Date.now().toString().slice(-8);copy.name=t.name.slice(0,22)+'（副本）';copy.enabled=false;editTemplate(copy);selectedTemplate.value=null;copiedTemplate.value=copy}
const copiedTemplate=ref<VoucherTemplate|null>(null)
function openSettings(){editorGeneration.value++;settingsIconBusy.value=false;copiedTemplate.value=null;configEditor.value=clone(config.value);saveError.value='';configOpen.value=true}
async function saveSettings(){
 if(confirmingSettings.value||busy.value)return
 if(settingsIconBusy.value){ElMessage.warning('图标正在读取，请稍后保存');return}
 const next=mergeModule(config.value,configEditor.value,'member')
 const issues=validateModule(next,'member',store.value.stock)
 if(issues.length){saveError.value=issues.map(i=>i.field+'：'+i.message).join('；');ElMessage.error(saveError.value);return}
 if(!next.member.enabled&&(config.value.member.enabled||next.member.closeMode!==config.value.member.closeMode||next.member.closeMode==='all'&&next.member.closedClock!==config.value.member.closedClock)){
  confirmingSettings.value=true;confirmationGuide.value={topic:'member_close_confirm',priority:40}
  try{await ElMessageBox.confirm(next.member.closeMode==='all'?(next.member.closedClock==='invalidate'?'保存后停止新的购买，使已有会员及全部会员权益立即失效，剩余时长不再恢复。重新开启后需重新购买或重新获得活动会员；关闭期间的会员奖励也失效。历史购买、邀请及发放记录保留。':'保存后停止新的购买，并暂停所有会员身份和权益（含活动赠送）。'+memberClosedClockLabels[next.member.closedClock]+'；已有资产及活动奖励记录保留。'):'保存后停止新的会员购买，已有会员身份、权益及活动赠送继续生效。',next.member.closeMode==='all'&&next.member.closedClock==='invalidate'?'确认关闭并使会员失效':memberCloseModeLabels[next.member.closeMode],{type:'warning',confirmButtonText:next.member.closeMode==='all'&&next.member.closedClock==='invalidate'?'确认关闭并失效':'确认保存',cancelButtonText:'取消'})}catch{return}finally{confirmingSettings.value=false;confirmationGuide.value=null}
 }
 saveError.value=await commit(next,'member')
 if(!saveError.value)configOpen.value=false;else ElMessage.error(saveError.value)
}
async function retry(grants:Grant[]){
 if(!allowed()||busy.value)return
 busy.value=true;confirmationGuide.value={topic:'retry',priority:40,detail:'本次选中'+grants.length+'笔；确认前不执行发放。'}
 try{
  await ElMessageBox.confirm('将按原发放单的奖励快照重试 '+grants.length+' 笔；已成功分支不会重复到账。额度不足或账号冻结的单据仍保留待处理。','重试奖励发放',{confirmButtonText:'确认重试',cancelButtonText:'取消',type:'warning'})
  if(!allowed())return
  await delay()
  if(!allowed())return
  let success=0
  try{persistMutation(next=>{for(const id of new Set(grants.map(g=>g.id))){const g=next.grants.find(g=>g.id===id);if(!g||!['发放失败','待发放','人工处理'].includes(g.status))continue;deliver(next,g,Date.now());if(g.status==='已发放')success++;log(next,'重试发放',g.id,g.status+'；'+g.reason)}})}catch(error){ElMessage.error(persistenceError(error));return}
  ElMessage.success('成功 '+success+' 笔，其余保留原单待处理')
 }catch{/* Confirmation cancelled. */}finally{busy.value=false;confirmationGuide.value=null}
}
async function revoke(grant:Grant){
 if(!allowed()||busy.value)return
 if(!canRevokeVoucher(grant,Date.now())){ElMessage.warning('仅未使用且未锁定的券可撤回');return}
 busy.value=true;confirmationGuide.value={topic:'revoke',priority:40,detail:'撤回原因必填；取消不改变当前券。'}
 try{
  const response=await ElMessageBox.prompt('撤回后本券不可再使用；原邀请记录和历史累计发放额度不回退。已使用或支付锁定的券不能直接撤回。','撤回优惠券',{inputPlaceholder:'请输入撤回原因',inputValidator:v=>!!v?.trim()||'撤回原因不能为空',type:'warning',confirmButtonText:'确认撤回',cancelButtonText:'取消'})
  if(!allowed())return
  try{persistMutation(next=>{const g=next.grants.find(g=>g.id===grant.id);if(!g||!canRevokeVoucher(g,Date.now()))throw new Error('券状态已改变');g.status='已撤回';g.reason=response.value.trim();log(next,'撤回优惠券',g.id,g.reason)})}catch(error){ElMessage.error(persistenceError(error));return}
  ElMessage.success('已撤回并保留操作记录')
 }catch{/* Confirmation cancelled. */}finally{busy.value=false;confirmationGuide.value=null}
}
const auditOpen=ref(false),auditRecord=ref<InviteRecord|null>(null),auditResult=ref('pass'),auditReason=ref('')
usePageGuide(()=>auditOpen.value?{topic:'audit',priority:30,detail:'当前选择：'+(auditResult.value==='pass'?'通过，按原快照处理':'不通过，不计奖')+'；核验说明必填。'}:null,guideBus)
usePageGuide(()=>toolsOpen.value?{topic:'tools',priority:30}:null,guideBus)
function openAudit(r:InviteRecord){auditRecord.value=r;auditReason.value='';auditResult.value='pass';auditOpen.value=true}
async function confirmAudit(){
 if(!allowed()||!auditRecord.value||busy.value)return
 if(!auditReason.value.trim()){ElMessage.error('请填写核验说明');return}
 busy.value=true
 try{
  await delay();if(!allowed())return
  const id=auditRecord.value.id
  persistMutation(next=>{const record=next.invites.find(i=>i.id===id);if(!record)throw new Error('邀请记录不存在');auditInvite(next,record,auditResult.value==='pass',auditReason.value.trim());log(next,'核验异常邀请',id,(auditResult.value==='pass'?'通过':'不通过')+'；'+auditReason.value.trim())})
  auditOpen.value=false;ElMessage.success('核验已完成，结果已记录')
 }catch(error){ElMessage.error(persistenceError(error))}finally{busy.value=false}
}
function download(filename:string,content:string){const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportRecords(kind:string,rows:Record<string,string|number>[]){if(!canRead.value||!rows.length)return;const keys=Object.keys(rows[0]),cell=(value:unknown)=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';download('领榜_'+kind+'_'+Date.now()+'.csv','\ufeff'+[keys.map(cell).join(','),...rows.map(row=>keys.map(key=>cell(row[key])).join(','))].join('\r\n'));ElMessage.success('已导出筛选后的 '+rows.length+' 条记录')}
async function resetDemo(){
 if(!allowed()||busy.value)return
 busy.value=true;confirmationGuide.value={topic:'reset_confirm',priority:40}
 try{
  await ElMessageBox.confirm('仅重置此HTML在本机保存的配置与演示记录，现有小程序与其他页面不受影响。','重置本地演示',{type:'warning',confirmButtonText:'确认重置',cancelButtonText:'取消'})
  if(!allowed())return
  try{persistMutation(()=>seedStore(),true)}catch(error){ElMessage.error(persistenceError(error));return}
  toolsOpen.value=false;ElMessage.success('已恢复初始演示')
 }catch{/* Confirmation cancelled. */}finally{busy.value=false;confirmationGuide.value=null}
}
async function reload(fail=false){loading.value=true;loadError.value=false;await delay();if(!fail){const fresh=loadStore();store.value=fresh.store;storageToken=fresh.token;storageRecoveryRequired=fresh.recoveryRequired;storageNotice.value=fresh.notice}loadError.value=fail;loading.value=false}
const timer=setInterval(()=>{now.value=Date.now()},1000)
onMounted(()=>reload());onBeforeUnmount(()=>clearInterval(timer))
watch(page,value=>{workspaceEl.value?.scrollTo({top:0});const url=new URL(location.href);url.searchParams.set('page',value);history.replaceState(null,'',url)});watch(role,value=>{if(value!=='admin'){planOpen.value=false;auditOpen.value=false;configOpen.value=false}})
</script>
<template>
 <div class="admin-page admin-shell" :class="{collapsed,'workspace-fullscreen':workFullscreen}">
  <aside class="sidebar"><div class="brand"><img :src="logoMark" alt="领榜教育管理系统"/><strong v-if="!collapsed">领榜教育管理系统</strong></div><el-menu :default-active="page" :default-openeds="['operation']" :collapse="collapsed" class="side-menu" @select="(value:string)=>page=value"><el-sub-menu index="operation"><template #title><el-icon><Setting/></el-icon><span>运营中心</span></template><el-menu-item v-for="item in menu" :key="item.id" :index="item.id"><el-icon><Medal v-if="item.id==='member'"/><Tickets v-else-if="item.id==='voucher'"/><CreditCard v-else-if="item.id==='demand-payment'"/><Share v-else-if="item.id==='activities'"/><User v-else/></el-icon><span>{{item.name}}</span></el-menu-item></el-sub-menu></el-menu><el-button class="sidebar-toggle" :icon="collapsed?DArrowRight:DArrowLeft" text aria-label="折叠菜单" @click="collapsed=!collapsed"/></aside>
  <div class="shell-main"><header class="topbar"><el-tooltip content="切换侧栏"><el-button :icon="collapsed?Expand:Fold" text aria-label="切换侧栏" @click="collapsed=!collapsed"/></el-tooltip><el-tooltip content="刷新"><el-button :icon="Refresh" text aria-label="刷新页面" @click="reload()"/></el-tooltip><el-breadcrumb separator="›"><el-breadcrumb-item>运营中心</el-breadcrumb-item><el-breadcrumb-item>{{current.name}}</el-breadcrumb-item></el-breadcrumb><div class="top-right"><span class="guide-launcher-slot"/><span class="prototype-label">独立原型</span><el-tooltip content="原型验收工具"><el-button :icon="Setting" text circle aria-label="原型验收工具" @click="toolsOpen=true"/></el-tooltip><el-avatar :size="32">{{role==='admin'?'管理':role==='viewer'?'只读':'无权'}}</el-avatar></div></header>
  <main ref="workspaceEl" class="workspace">
   <el-alert v-if="storageNotice" :title="storageNotice" type="warning" :closable="false" class="mb16"/>
   <el-result v-if="!canRead" icon="warning" title="没有访问权限" sub-title="当前角色无权查看运营配置与用户资产，可在原型验收工具中切换角色。"><template #extra><el-button @click="toolsOpen=true">切换演示角色</el-button></template></el-result>
   <el-skeleton v-else-if="loading" :rows="10" animated class="panel skeleton"/>
   <el-result v-else-if="loadError" icon="error" title="配置加载失败" sub-title="数据未加载，不会显示成空数据；已保存内容保留。"><template #extra><el-button type="primary" :icon="Refresh" @click="reload()">重新加载</el-button></template></el-result>
   <template v-else>
    <div v-if="!canEdit" class="readonly-notice">只读运营：可查看，不可修改配置。</div>
    <config-list v-if="page==='member'||page==='voucher'" :config="config" :section="page" :readonly="!canEdit" :stock="store.stock" :fullscreen="workFullscreen" @plan="editPlan" @template="editTemplate" @copy="copyTemplate" @settings="openSettings()" @refresh="reload()" @fullscreen="workFullscreen=!workFullscreen"/>
    <demand-payment-config v-else-if="page==='demand-payment'" :config="config" :readonly="!canEdit" :busy="busy" :save="saveDemandPayment"/>
    <activity-manager v-else-if="page==='activities'" :config="config" :store="store" :readonly="!canEdit" :busy="busy" :fullscreen="workFullscreen" :now="now" :save-activity="saveActivity" :delete-activity="deleteActivity" @refresh="reload()" @fullscreen="workFullscreen=!workFullscreen"/>
    <record-panel v-else-if="page==='records'" :store="store" :readonly="!canEdit" :busy="busy" :now="now" @retry="retry" @revoke="revoke" @audit="openAudit" @export="exportRecords"/>
   </template>
  </main></div>
  <el-drawer v-model="configOpen" title="会员设置" size="min(1080px, calc(100vw - 72px))" :close-on-click-modal="true"><config-panel :key="editorGeneration" v-model="configEditor" :disabled="!canEdit||busy||confirmingSettings" @busy="settingsIconBusy=$event"/><el-alert v-if="saveError" :title="saveError" type="error" :closable="false" class="mt16"/><template #footer><el-button @click="configOpen=false">{{canEdit?'取消':'关闭'}}</el-button><el-button v-if="canEdit" type="primary" :loading="busy||confirmingSettings" :disabled="settingsIconBusy" @click="saveSettings">保存</el-button></template></el-drawer>
  <item-editor v-model="planOpen" :kind="editKind" :plan="selectedPlan" :template="selectedTemplate" :prefill-template="copiedTemplate" :readonly="!canEdit" :existing-ids="editKind==='plan'?config.member.plans.map(p=>p.id):config.vouchers.templates.map(t=>t.id)" :save-plan="savePlan" :save-template="saveTemplate"/>
  <el-dialog v-model="auditOpen" title="核验异常邀请" width="580px" :close-on-click-modal="false"><template v-if="auditRecord"><el-alert :title="auditRecord.id+' · '+auditRecord.inviteeId" type="info" :closable="false" class="mb20"/><el-form label-position="top"><el-form-item label="核验结果"><el-radio-group v-model="auditResult"><el-radio value="pass">通过，按原事件快照重新计奖</el-radio><el-radio value="reject">不通过，不计奖</el-radio></el-radio-group></el-form-item><el-form-item label="核验说明" required><el-input v-model="auditReason" type="textarea" :rows="3" maxlength="200" show-word-limit/></el-form-item></el-form></template><template #footer><el-button @click="auditOpen=false">取消</el-button><el-button type="primary" :disabled="!canEdit" :loading="busy" @click="confirmAudit">确认核验</el-button></template></el-dialog>
  <el-dialog v-model="toolsOpen" title="原型验收工具" width="560px"><el-form label-position="top"><el-form-item label="角色权限"><el-radio-group v-model="role"><el-radio value="admin">运营管理员</el-radio><el-radio value="viewer">只读运营</el-radio><el-radio value="none">无访问权限</el-radio></el-radio-group></el-form-item><el-form-item label="页面状态"><el-button @click="toolsOpen=false;reload(true)">模拟加载失败</el-button><el-button @click="toolsOpen=false;reload()">恢复正常</el-button></el-form-item><el-form-item label="本地数据"><el-button type="danger" plain :disabled="!canEdit" @click="resetDemo">重置演示数据</el-button><span class="field-hint">仅重置当前页面的数据，不影响其他页面。</span></el-form-item></el-form><el-alert title="运营记录支持重试、撤回、核验和导出。无权限角色用于检查界面，不等于生产权限机制。" type="info" :closable="false"/><template #footer><el-button type="primary" @click="toolsOpen=false">完成</el-button></template></el-dialog>
 </div>
 <prototype-guide v-model="guideOpen" :context="guideContext"/>
</template>
