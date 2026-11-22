<script setup lang="ts">
import {computed,nextTick,reactive,ref,watch} from 'vue'
import {ElMessage,type FormInstance,type FormRules} from 'element-plus'
import {clone,defaultVoucherUsage,timesVoucherScope,timesVoucherScopes,type Plan,type VoucherTemplate,type VoucherType,parseChina} from '../model'
import VoucherUsageEditor from './voucher-usage-editor.vue'
import {usePageGuide} from '../spec/guide-context'
import type {GuideTopic} from '../spec/types'
const open=defineModel<boolean>({required:true})
const props=defineProps<{kind:'plan'|'template';plan:Plan|null;template:VoucherTemplate|null;readonly:boolean;existingIds:string[];prefillTemplate:VoucherTemplate|null;savePlan:(plan:Plan)=>Promise<string>;saveTemplate:(template:VoucherTemplate)=>Promise<string>}>()
const form=ref<FormInstance>(),busy=ref(false),saveError=ref('')
const p=reactive<Plan>({id:'',name:'',months:1,price:19.9,enabled:true})
const newTemplate=():VoucherTemplate=>({id:'VC-'+Date.now().toString().slice(-8),name:'',type:'amount',amount:2,enabled:true,validity:'relative',days:30,fixedStart:'',fixedEnd:'',totalLimit:0,perUserLimit:0,note:'下单支付时可抵扣',usage:defaultVoucherUsage()})
const t=reactive<VoucherTemplate>(newTemplate())
usePageGuide(()=>open.value?{topic:(props.kind==='plan'?'plan_'+(props.readonly?'view':props.plan?'edit':'create'):'voucher_'+(props.readonly?'view':props.template?'edit':props.prefillTemplate?'copy':'create')+'_'+t.type) as GuideTopic,priority:20,detail:props.kind==='plan'?(props.plan?'已有方案：编号锁定。':'新建方案：编号可编辑。'):(props.template?'已保存模板：类型与编号锁定。':'首次保存前可选择类型。')+' 当前有效期：'+(t.validity==='relative'?'到账后固定天数':'固定起止时间')+'；退款：'+(t.usage.refund==='extend'?'补偿有效期':t.usage.refund==='original'?'退回原券':t.usage.refund==='none'?'人工核对':'尚未选择')}:null)
let amountFields={amount:2,orderScope:['需求单支付'],minSpend:0,maxPerOrder:1}
let redemptionScope=[timesVoucherScope]
const defaultRedemptionNote=()=>t.usage.orderScope.length===1?'抵用一次'+t.usage.orderScope[0]+'费用':t.usage.orderScope.length>1?t.usage.orderScope.join('或')+'，任选一次抵用':'抵用所选项目的一次费用'
const redemptionNotes=['抵用一次需求发布费用','抵用一次接单支付费用','需求发布或接单支付，任选一次抵用','接单支付或需求发布，任选一次抵用','抵用所选项目的一次费用']
watch(()=>t.usage.orderScope.join('|'),()=>{if(t.type==='times'&&redemptionNotes.includes(t.note))t.note=defaultRedemptionNote()})
const couponType=computed<VoucherType>({get:()=>t.type,set:value=>{
 if(props.template||value===t.type)return
 if(value==='times'){
  amountFields={amount:t.amount??2,orderScope:[...t.usage.orderScope],minSpend:t.usage.minSpend,maxPerOrder:t.usage.maxPerOrder}
  t.amount=null;t.usage={...t.usage,orderScope:[...redemptionScope],minSpend:0,maxPerOrder:1}
  if(t.note==='下单支付时可抵扣')t.note=defaultRedemptionNote()
 }else{
  redemptionScope=[...t.usage.orderScope]
  t.amount=amountFields.amount;t.usage={...t.usage,orderScope:[...amountFields.orderScope],minSpend:amountFields.minSpend,maxPerOrder:amountFields.maxPerOrder}
  if(redemptionNotes.includes(t.note))t.note='下单支付时可抵扣'
 }
 t.type=value;nextTick(()=>form.value?.clearValidate())
}})
watch(open,value=>{if(value){saveError.value='';Object.assign(p,props.plan?clone(props.plan):{id:'SKU-'+Date.now().toString().slice(-8),name:'',months:1,price:19.9,enabled:true});Object.assign(t,props.template?clone(props.template):props.prefillTemplate?clone(props.prefillTemplate):newTemplate());amountFields={amount:2,orderScope:['需求单支付'],minSpend:0,maxPerOrder:1};redemptionScope=t.type==='times'?[...t.usage.orderScope]:[timesVoucherScope];form.value?.clearValidate()}})
const required={required:true,message:'此项不能为空',trigger:'blur'}
const rules:FormRules={id:[required,{pattern:/^[A-Z0-9_-]{3,40}$/,message:'使用3～40位大写字母、数字、下划线或横线',trigger:'blur'}],name:[required]}
async function save(){if(props.readonly||busy.value)return;const valid=await form.value?.validate().catch(()=>false);if(!valid)return;const item=props.kind==='plan'?p:t;const isNew=props.kind==='plan'?!props.plan:!props.template;if(isNew&&props.existingIds.includes(item.id)){ElMessage.error('编号已存在，请更换');return}if(props.kind==='template'&&t.validity==='fixed'&&(!t.fixedStart||!t.fixedEnd||parseChina(t.fixedStart)>=parseChina(t.fixedEnd))){ElMessage.error('请设置正确的固定有效期');return}busy.value=true;try{saveError.value=props.kind==='plan'?await props.savePlan(clone(p)):await props.saveTemplate(clone(t));if(!saveError.value)open.value=false;else ElMessage.error(saveError.value)}catch{saveError.value='保存失败，请重试'}finally{busy.value=false}}
</script>
<template>
 <el-drawer v-model="open" :title="readonly?(kind==='plan'?'查看购买方案':'查看优惠券模板'):(kind==='plan'?(plan?'编辑购买方案':'新增购买方案'):(template?'编辑优惠券模板':'新增优惠券模板'))" :size="kind==='plan'?'650px':'720px'" :close-on-click-modal="true">
  <el-form ref="form" :model="kind==='plan'?p:t" :rules="rules" :disabled="readonly||busy" label-position="top">
   <template v-if="kind==='plan'">
    <el-form-item label="方案编号" prop="id"><el-input v-model="p.id" :disabled="!!plan" maxlength="40"/></el-form-item>
    <el-form-item label="方案名称" prop="name"><el-input v-model="p.name" maxlength="20" show-word-limit/></el-form-item>
    <el-row :gutter="24"><el-col :span="12"><el-form-item label="会员时长（自然月）" required><el-input-number v-model="p.months" :min="1" :max="120" :precision="0"/></el-form-item></el-col><el-col :span="12"><el-form-item label="售价（元）" required><el-input-number v-model="p.price" :min="0.01" :max="99999" :precision="2" :step="1"/></el-form-item></el-col></el-row>
    <el-form-item label="上架状态"><el-switch v-model="p.enabled" active-text="上架" inactive-text="下架"/></el-form-item>
    <el-alert title="下架后停止新下单，已付款待发放订单仍正常履约。改价不修改历史订单金额，不自动续费。" type="warning" :closable="false"/>
   </template>
   <template v-else>
    <section class="panel"><div class="panel-heading"><h2>基本信息</h2></div><div class="form-body">
    <el-form-item label="模板编号" prop="id"><el-input v-model="t.id" :disabled="!!template" maxlength="40"/></el-form-item>
    <el-form-item label="模板名称" prop="name"><el-input v-model="t.name" maxlength="30" show-word-limit/></el-form-item>
    <el-form-item label="优惠券类型" required><el-radio-group v-model="couponType" :disabled="!!template" aria-label="优惠券类型"><el-radio value="amount">金额券</el-radio><el-radio value="times">抵用券</el-radio></el-radio-group><p v-if="template" class="field-hint">类型创建后不可修改，如需变更请新增模板。</p></el-form-item>
    <el-row :gutter="24"><el-col :span="12"><el-form-item v-if="t.type==='amount'" label="券面额（元）" required><el-input-number v-model="t.amount" aria-label="券面额（元）" :min="0.01" :max="99999" :precision="2"/></el-form-item><el-form-item v-else label="抵用项目" prop="usage.orderScope" :rules="[{type:'array',required:true,min:1,message:'请至少选择一个抵用项目',trigger:'change'}]"><el-checkbox-group v-model="t.usage.orderScope" aria-label="本券抵用项目"><el-checkbox v-for="scope in timesVoucherScopes" :key="scope" :value="scope">{{scope}}</el-checkbox></el-checkbox-group><p class="field-hint">每张抵用所选项目中的任意1次费用，不设金额上限。</p></el-form-item></el-col><el-col :span="12"><el-form-item label="模板状态"><el-switch v-model="t.enabled" active-text="启用" inactive-text="停用"/></el-form-item></el-col></el-row>
    <el-form-item label="有效期方式"><el-radio-group v-model="t.validity"><el-radio value="relative">到账后固定天数</el-radio><el-radio value="fixed">固定起止时间</el-radio></el-radio-group></el-form-item>
    <el-form-item v-if="t.validity==='relative'" label="到账后有效天数" required><el-input-number v-model="t.days" :min="1" :max="3650" :precision="0"/><span class="unit">天</span><p class="field-hint">从实际到账时刻起精确计算N×24小时；到期时刻起不可使用。</p></el-form-item>
    <template v-else><el-form-item label="有效期开始（北京时间）" required><el-date-picker v-model="t.fixedStart" type="datetime" value-format="YYYY-MM-DD HH:mm:ss"/></el-form-item><el-form-item label="有效期结束（北京时间）" required><el-date-picker v-model="t.fixedEnd" type="datetime" value-format="YYYY-MM-DD HH:mm:ss"/></el-form-item><el-alert title="到期后不能新发或补发。开始时间之前的应发单保留为待发放，需在有效期内处理。" type="warning" :closable="false" class="mb20"/></template>
    <el-form-item label="用户端用途文案"><el-input v-model="t.note" maxlength="50" show-word-limit/></el-form-item>
    </div></section>
    <section class="panel"><div class="panel-heading"><h2>发放限制</h2></div><div class="form-body"><el-row :gutter="24"><el-col :span="12"><el-form-item label="模板累计发放上限（张）"><el-input-number v-model="t.totalLimit" :min="0" :max="1000000" :precision="0"/><p class="field-hint">0表示不限；额度用尽保留待发资格。</p></el-form-item></el-col><el-col :span="12"><el-form-item label="每人累计发放上限（张）"><el-input-number v-model="t.perUserLimit" :min="0" :max="1000000" :precision="0"/><p class="field-hint">0表示不限；与活动奖励上限同时校验。</p></el-form-item></el-col></el-row></div></section>
    <section class="panel"><div class="panel-heading"><h2>用券规则</h2></div><div class="form-body"><voucher-usage-editor v-model="t.usage" :coupon-type="t.type"/></div></section>
   </template>
  </el-form>
  <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" class="mt16"/>
  <template #footer><el-button @click="open=false">{{readonly?'关闭':'取消'}}</el-button><el-button type="primary" :loading="busy" :disabled="readonly" @click="save">保存</el-button></template>
 </el-drawer>
</template>
