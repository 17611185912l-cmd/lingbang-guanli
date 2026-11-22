<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {ElMessage} from 'element-plus'
import {Present} from '@element-plus/icons-vue'
import {benefitIconError,benefitIconMaxBytes,benefitIconTypes} from '../model'
import directedIcon from '../assets/benefit-directed.svg'
import supportIcon from '../assets/benefit-support.svg'
const icon=defineModel<string>({required:true})
const props=defineProps<{code:string;name:string;disabled:boolean;defaultIcon?:string;badge?:boolean}>()
const emit=defineEmits<{busy:[value:boolean]}>()
const input=ref<HTMLInputElement|null>(null),reading=ref(false),previewFailed=ref(false)
const fallback=computed(()=>props.defaultIcon??(props.code==='DEDICATED_SUPPORT'?supportIcon:props.code==='DIRECTED_DEMAND'?directedIcon:''))
let revision=0,reader:FileReader|null=null
watch(icon,()=>previewFailed.value=false)
function setBusy(value:boolean){reading.value=value;emit('busy',value)}
async function selectFile(event:Event){
 const control=event.target as HTMLInputElement,file=control.files?.[0];control.value=''
 if(!file||props.disabled||reading.value)return
 if(!benefitIconTypes.includes(file.type)){ElMessage.error('请上传 PNG、JPG 或 WebP 图标');return}
 if(file.size>benefitIconMaxBytes){ElMessage.error('图标大小不能超过 500 KB');return}
 const current=++revision;setBusy(true)
 try{
  const data=await new Promise<string>((resolve,reject)=>{
   reader=new FileReader();reader.onload=()=>resolve(String(reader?.result??''));reader.onerror=()=>reject(new Error('读取失败'));reader.onabort=()=>reject(new Error('读取取消'));reader.readAsDataURL(file)
  })
  const error=benefitIconError(data);if(error)throw new Error(error)
  const image=new Image();image.src=data;await image.decode()
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('无效图片')
  if(current===revision)icon.value=data
 }catch{if(current===revision)ElMessage.error('图标无法读取，请选择有效图片重新上传')}
 finally{if(current===revision){reader=null;setBusy(false)}}
}
onBeforeUnmount(()=>{revision++;reader?.abort();setBusy(false)})
</script>
<template>
 <div class="benefit-icon-input" :class="{'is-badge':badge}">
  <img v-if="icon&&!previewFailed||fallback" class="benefit-icon-preview" :src="icon&&!previewFailed?icon:fallback" :alt="name+'图标'" @error="previewFailed=true"/>
  <span v-else class="benefit-icon-preview benefit-icon-placeholder" role="img" :aria-label="name+'默认图标'"><el-icon><Present/></el-icon></span>
  <div class="benefit-icon-actions">
   <input ref="input" class="benefit-icon-file" type="file" accept="image/png,image/jpeg,image/webp" :aria-label="name+'图标文件'" :disabled="disabled||reading" @change="selectFile"/>
   <el-button type="primary" link :aria-label="name+'上传图标'" :disabled="disabled" :loading="reading" @click="input?.click()">{{icon?'更换图标':'上传图标'}}</el-button>
   <el-button v-if="!badge" link :aria-label="name+'恢复默认图标'" :disabled="disabled||reading||!icon" @click="icon=''">恢复默认</el-button>
  </div>
 </div>
</template>
