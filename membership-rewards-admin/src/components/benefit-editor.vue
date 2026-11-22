<script setup lang="ts">
import {ref} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import {Plus} from '@element-plus/icons-vue'
import {memberBenefitLimit,type Benefit} from '../model'
import BenefitIconInput from './benefit-icon-input.vue'
import {usePageGuide} from '../spec/guide-context'
const benefits=defineModel<Benefit[]>({required:true})
const props=defineProps<{disabled:boolean}>()
const emit=defineEmits<{busy:[value:boolean]}>()
const readingIcons=ref(new Set<string>())
const confirmingRemove=ref(false)
usePageGuide(()=>confirmingRemove.value?{topic:'member_benefit_remove',priority:40}:null)
const builtInNames:Record<string,string>={DIRECTED_DEMAND:'定向需求',DEDICATED_SUPPORT:'专属客服'}
function setIconBusy(code:string,value:boolean){if(value)readingIcons.value.add(code);else readingIcons.value.delete(code);emit('busy',readingIcons.value.size>0)}
function addBenefit(){
 if(props.disabled||readingIcons.value.size)return
 if(benefits.value.length>=memberBenefitLimit){ElMessage.warning('最多配置'+memberBenefitLimit+'项权益（含现有权益）');return}
 benefits.value.push({code:'CUSTOM_'+crypto.randomUUID().replaceAll('-','').toUpperCase(),name:'',description:'',enabled:true,icon:''})
}
async function removeBenefit(benefit:Benefit){
 if(props.disabled||readingIcons.value.size||builtInNames[benefit.code])return
 try{
  confirmingRemove.value=true
  await ElMessageBox.confirm('删除后须保存会员设置才会生效；取消会员设置可放弃本次修改。','删除“'+(benefit.name.trim()||'新增权益')+'”',{type:'warning',confirmButtonText:'删除',cancelButtonText:'取消'})
  if(props.disabled||readingIcons.value.size)return
  benefits.value=benefits.value.filter(item=>item.code!==benefit.code)
 }catch{}finally{confirmingRemove.value=false}
}
</script>
<template>
 <section class="panel">
  <div class="panel-heading"><h2>会员专属权益</h2><el-space :size="12"><span class="muted">{{benefits.length}} / {{memberBenefitLimit}}</span><el-tooltip :content="'最多配置'+memberBenefitLimit+'项权益（含现有权益）'" :disabled="benefits.length<memberBenefitLimit"><span><el-button type="primary" :icon="Plus" :disabled="disabled||readingIcons.size>0||benefits.length>=memberBenefitLimit" @click="addBenefit">新增权益</el-button></span></el-tooltip></el-space></div>
  <el-table :data="benefits" border row-key="code" empty-text="暂无权益，可点击新增权益">
   <el-table-column label="权益" width="150"><template #default="{row}"><div>{{builtInNames[row.code]||row.name||'新增权益'}}</div><div class="subline">{{builtInNames[row.code]?row.code:'自定义权益'}}</div></template></el-table-column>
   <el-table-column label="图标" width="180"><template #default="{row}"><benefit-icon-input v-model="row.icon" :code="row.code" :name="row.name||'新增权益'" :disabled="disabled" @busy="value=>setIconBusy(row.code,value)"/></template></el-table-column>
   <el-table-column label="名称 / 用户端说明" min-width="270"><template #default="{row}"><el-input v-model="row.name" :aria-label="row.code+'权益名称'" placeholder="请输入权益名称" maxlength="20"/><el-input v-model="row.description" :aria-label="row.code+'权益说明'" placeholder="请输入用户端说明" maxlength="80" class="mt8"/></template></el-table-column>
   <el-table-column label="开放权益" width="100" align="center"><template #default="{row}"><el-switch v-model="row.enabled" :aria-label="(row.name||'新增权益')+'权益开关'"/></template></el-table-column>
   <el-table-column label="操作" width="75" align="center"><template #default="{row}"><el-button v-if="!builtInNames[row.code]" type="danger" link :aria-label="'删除'+(row.name||'新增权益')" :disabled="disabled||readingIcons.size>0" @click="removeBenefit(row)">删除</el-button><span v-else class="muted">—</span></template></el-table-column>
  </el-table>
  <p class="benefit-icon-hint">图标支持 PNG、JPG、WebP，单张不超过 500 KB，建议 96 × 96 px。</p>
 </section>
</template>
