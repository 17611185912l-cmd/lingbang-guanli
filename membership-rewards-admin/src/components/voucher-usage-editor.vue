<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {voucherOrderScopes,type VoucherType,type VoucherUsageRules} from '../model'
defineProps<{couponType?:VoucherType}>()
const usage=defineModel<VoucherUsageRules>({required:true})
const thresholdMode=ref(usage.value.minSpend>0?'minimum':'none')
watch(()=>usage.value,value=>{thresholdMode.value=value.minSpend>0?'minimum':'none'})
const thresholdType=computed({get:()=>thresholdMode.value,set:value=>{thresholdMode.value=value;usage.value.minSpend=value==='minimum'?(usage.value.minSpend||1):0}})
</script>
<template>
 <template v-if="couponType!=='times'">
 <el-form-item label="适用范围" prop="usage.orderScope" :rules="[{type:'array',required:true,min:1,message:'请至少选择一种适用范围',trigger:'change'}]">
  <el-checkbox-group v-model="usage.orderScope" aria-label="本券适用范围"><el-checkbox v-for="scope in voucherOrderScopes" :key="scope" :value="scope">{{scope}}</el-checkbox></el-checkbox-group>
 </el-form-item>
 <el-form-item label="使用门槛" required><el-radio-group v-model="thresholdType" aria-label="本券使用门槛"><el-radio value="none">无门槛</el-radio><el-radio value="minimum">满额可用</el-radio></el-radio-group></el-form-item>
 <el-form-item v-if="thresholdType==='minimum'" label="每张券的订单金额门槛" prop="usage.minSpend" :rules="[{type:'number',required:true,min:0.01,max:99999,message:'请填写0.01～99999元的门槛金额',trigger:'change'}]">
  <span class="threshold-prefix">满</span><el-input-number v-model="usage.minSpend" aria-label="本券门槛金额" :min="0.01" :max="99999" :precision="2"/><span class="unit">元可用</span><p class="field-hint">按其他优惠前的订单金额判断；多张券累计门槛。例如每张满100元，使用2张需满200元。</p>
 </el-form-item>
 </template>
 <template v-else>
  <el-form-item label="抵用方式"><span>每张抵用 1 次，每次使用 1 张</span><p class="field-hint">抵扣所选项目本次全部应付费用，不限金额；应付费用为0时不消耗优惠券。</p></el-form-item>
 </template>
 <el-row :gutter="24">
  <el-col v-if="couponType!=='times'" :span="12"><el-form-item label="本券每单最多使用" required><el-input-number v-model="usage.maxPerOrder" aria-label="本券每单最多使用" :min="1" :max="20" :precision="0"/><span class="unit">张</span></el-form-item></el-col>
  <el-col :span="couponType==='times'?24:12"><el-form-item label="与其他优惠同享"><el-switch v-model="usage.withPromotion" aria-label="本券与其他优惠同享" active-text="允许" inactive-text="不允许"/></el-form-item></el-col>
 </el-row>
 <el-form-item label="全额退款退券" prop="usage.refund" :rules="[{required:true,message:'请选择本券的退款退券方式',trigger:'change'}]">
  <el-select v-model="usage.refund" aria-label="本券全额退款退券" placeholder="请选择本券的退款退券方式"><el-option value="original" label="退回原券，保留原有效期"/><el-option value="extend" label="退回原券并补偿有效期"/><el-option value="none" label="不自动退券，进入人工核对"/></el-select>
 </el-form-item>
 <el-form-item v-if="usage.refund==='extend'" label="补偿有效期" required><el-input-number v-model="usage.refundExtendDays" aria-label="本券补偿有效期" :min="1" :max="365" :precision="0"/><span class="unit">天</span><p class="field-hint">新到期日取“原到期日”和“退款到账时间 + 配置天数”中较晚者。</p></el-form-item>
</template>

<style scoped>
.threshold-prefix{margin-right:8px}
</style>
