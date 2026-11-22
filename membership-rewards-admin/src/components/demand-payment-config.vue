<script setup lang="ts">
import {computed,reactive,ref,watch} from 'vue'
import {ElMessageBox} from 'element-plus'
import {clone,validateModule,type Config} from '../model'
import {usePageGuide} from '../spec/guide-context'
const props=defineProps<{config:Config;readonly:boolean;busy:boolean;save:(payment:Config['demandPayment'])=>Promise<string>}>()
const draft=reactive<{enabled:boolean;amount:number|undefined}>({...props.config.demandPayment})
const error=ref(''),amountError=ref(''),confirming=ref(false)
usePageGuide(()=>({topic:confirming.value?'demand_confirm':'demand_payment',priority:confirming.value?40:10,detail:'当前编辑：'+(draft.enabled?'开启收费，金额可编辑':'关闭收费，金额保留并禁用')+'；标题状态始终代表已保存配置。'}))
const changed=computed(()=>draft.enabled!==props.config.demandPayment.enabled||draft.amount!==props.config.demandPayment.amount)
function reset(){Object.assign(draft,props.config.demandPayment);error.value='';amountError.value=''}
watch(()=>props.config.demandPayment,reset,{deep:true})
watch(draft,()=>{error.value='';amountError.value=''})
async function submit(){
 if(props.readonly||props.busy||confirming.value)return
 const next=clone(props.config)
 next.demandPayment={enabled:draft.enabled,amount:draft.amount??NaN}
 // Turning payment off must remain possible after clearing an unsaved amount.
 if(!draft.enabled&&validateModule(next,'demand-payment').length)next.demandPayment.amount=props.config.demandPayment.amount
 const issues=validateModule(next,'demand-payment')
 if(issues.length){amountError.value=issues.find(i=>i.field==='单次发布金额')?.message??'';error.value=issues.filter(i=>i.field!=='单次发布金额').map(i=>i.message).join('；');return}
 if(props.config.demandPayment.enabled&&!draft.enabled){
  confirming.value=true
  try{await ElMessageBox.confirm('关闭后，新发布的普通需求和指定老师需求均免费。','关闭需求支付',{type:'warning',confirmButtonText:'确认关闭',cancelButtonText:'取消'})}catch{return}finally{confirming.value=false}
 }
 error.value=await props.save(next.demandPayment)
 if(!error.value)reset()
}
</script>
<template>
 <div class="demand-payment-page">
  <el-form label-width="138px" class="configuration-form" :disabled="readonly||busy||confirming" novalidate @submit.prevent="submit">
   <section class="panel">
    <div class="panel-heading"><h2>需求支付配置</h2><el-tag :type="config.demandPayment.enabled?'success':'info'">{{config.demandPayment.enabled?'已开启':'已关闭'}}</el-tag></div>
    <div class="form-body">
     <el-form-item label="需求支付开关"><el-switch v-model="draft.enabled" aria-label="需求支付开关" active-text="开启" inactive-text="关闭"/><p class="field-hint">{{draft.enabled?'普通发布和指定老师发布，非会员按次支付，会员免费。':'关闭后，所有用户免费发布普通需求和指定老师需求。'}}</p></el-form-item>
     <el-form-item label="单次发布金额" :required="draft.enabled" :error="amountError"><el-input-number :key="Number(readonly||busy||confirming||!draft.enabled)" v-model="draft.amount" aria-label="单次发布金额" :disabled="readonly||busy||confirming||!draft.enabled" :min="0.01" :max="99999" :step="0.01" :precision="2" :controls="false" placeholder="请输入金额"/><span class="unit">元 / 次</span></el-form-item>
    </div>
   </section>
   <el-alert v-if="error" :title="error" type="error" :closable="false" class="mb16"/>
   <div v-if="!readonly" class="save-bar demand-payment-actions"><el-space><el-button :disabled="!changed||busy||confirming" @click="reset">取消修改</el-button><el-button type="primary" native-type="submit" :loading="busy||confirming" :disabled="!changed">保存</el-button></el-space></div>
  </el-form>
 </div>
</template>
<style scoped>
.demand-payment-page .form-body{padding-bottom:16px}
.demand-payment-page .el-input-number{width:180px}
.demand-payment-actions{justify-content:flex-end}
</style>
