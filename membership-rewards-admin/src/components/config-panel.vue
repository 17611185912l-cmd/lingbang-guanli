<script setup lang="ts">
import {ref} from 'vue'
import {memberClosedClockLabels,type Config} from '../model'
import BenefitIconInput from './benefit-icon-input.vue'
import BenefitEditor from './benefit-editor.vue'
import memberBadge from '../assets/member-badge.svg'
const config=defineModel<Config>({required:true})
defineProps<{disabled:boolean}>()
const emit=defineEmits<{busy:[value:boolean]}>()
const readingIcons=ref(new Set<string>())
function setIconBusy(code:string,value:boolean){if(value)readingIcons.value.add(code);else readingIcons.value.delete(code);emit('busy',readingIcons.value.size>0)}
</script>
<template>
 <el-form :disabled="disabled" label-position="right" label-width="154px" class="configuration-form">
   <section class="panel"><div class="panel-heading"><h2>会员基础配置</h2></div><div class="form-body">
    <el-form-item label="会员开关"><el-switch v-model="config.member.enabled" aria-label="会员开关" active-text="开启" inactive-text="关闭"/></el-form-item>
    <el-form-item label="关闭范围" required><el-radio-group v-model="config.member.closeMode" aria-label="关闭范围"><el-radio value="purchase-only">仅关闭会员购买</el-radio><el-radio value="all">关闭会员及全部权益</el-radio></el-radio-group><p class="field-hint">{{config.member.closeMode==='all'?(config.member.closedClock==='invalidate'?'关闭后停止购买，已有会员身份及全部权益按失效规则处理。':'关闭后停止购买，购买或活动赠送的会员身份及全部权益均暂停使用。活动赠送继续累计入账。'):'关闭后仅停止新的会员购买，已有会员身份及权益继续可用。活动赠送继续累计入账。'}}</p></el-form-item>
    <el-form-item v-if="config.member.closeMode==='all'" label="有效期处理" required><el-radio-group v-model="config.member.closedClock" aria-label="有效期处理"><el-radio v-for="(label,value) in memberClosedClockLabels" :key="value" :value="value">{{label}}</el-radio></el-radio-group><p class="field-hint">{{config.member.closedClock==='invalidate'?'保存关闭后，已有会员剩余时长失效，重新开启不会恢复旧权益。新购买或新活动赠送可重新生效；关闭期间的会员奖励失效。历史记录保留。':config.member.closedClock==='pause'?'保存关闭后冻结剩余时长，重新开启时顺延；关闭期间到账的会员从到账时暂停计时。':'关闭期间继续计时；重新开启后，仅未到期会员恢复使用。'}}</p></el-form-item>
    <el-form-item label="会员标识"><benefit-icon-input v-model="config.member.badgeIcon" code="MEMBER_BADGE" name="会员标识" :default-icon="memberBadge" badge :disabled="disabled" @busy="value=>setIconBusy('MEMBER_BADGE',value)"/><p class="field-hint">PNG、JPG、WebP，单张不超过 500 KB。</p></el-form-item>
   </div></section>
   <benefit-editor v-model="config.member.benefits" :disabled="disabled" @busy="value=>setIconBusy('BENEFITS',value)"/>
 </el-form>
</template>
