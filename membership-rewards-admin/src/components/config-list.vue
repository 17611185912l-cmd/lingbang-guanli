<script setup lang="ts">
import {computed,reactive,ref,watch} from 'vue'
import {Search,Refresh,Plus,Setting,FullScreen} from '@element-plus/icons-vue'
import {money,voucherBenefit,voucherTypeLabels,voucherUsageSummary,voucherThresholdSummary,voucherRefundLabels,type Config,type Plan,type VoucherTemplate} from '../model'
const props=defineProps<{config:Config;section:'member'|'voucher';readonly:boolean;fullscreen:boolean;stock:Record<string,number>}>()
const emit=defineEmits<{plan:[plan:Plan|null];template:[template:VoucherTemplate|null];copy:[template:VoucherTemplate];settings:[];refresh:[];fullscreen:[]}>()
const filters=reactive({query:'',status:''}),applied=ref({...filters}),page=ref(1),size=ref(20),showSearch=ref(true)
const isMember=computed(()=>props.section==='member'),isVoucher=computed(()=>props.section==='voucher')
const title=computed(()=>isMember.value?'会员方案列表':'优惠券模板列表')
type ListRow={id:string;name:string;period?:string;enabled:boolean;amount:string;rule?:string;limit?:string;plan?:Plan;template?:VoucherTemplate}
const all=computed<ListRow[]>(()=>{
 const c=props.config
 if(isMember.value)return c.member.plans.map(p=>({id:p.id,name:p.name,period:p.months+'个自然月',enabled:p.enabled,amount:'¥'+money(p.price),plan:p}))
 return c.vouchers.templates.map(t=>({id:t.id,name:t.name,enabled:t.enabled,amount:voucherBenefit(t),rule:t.validity==='relative'?'到账起 '+t.days+' 天':t.fixedStart+' 至 '+t.fixedEnd,limit:t.totalLimit?t.totalLimit+'张':'不限',template:t}))
})
const filtered=computed(()=>all.value.filter(r=>(!applied.value.query||(r.name+r.id).includes(applied.value.query))&&(!applied.value.status||String(r.enabled)===applied.value.status)))
const rows=computed(()=>filtered.value.slice((page.value-1)*size.value,page.value*size.value))
function search(){applied.value={...filters};page.value=1}
function reset(){Object.assign(filters,{query:'',status:''});search()}
watch(()=>props.section,reset)
watch(()=>filtered.value.length,()=>{page.value=Math.min(page.value,Math.max(1,Math.ceil(filtered.value.length/size.value)))})
</script>
<template>
 <div class="config-list-page">
  <section v-if="showSearch" class="search-card"><el-form :model="filters" label-width="90px" @submit.prevent="search"><div class="query-grid"><el-form-item :label="isMember?'方案名称':'模板名称'"><el-input v-model="filters.query" :placeholder="isMember?'方案名称 / 编号':'模板名称 / 编号'" clearable @keyup.enter="search"/></el-form-item><el-form-item label="状态"><el-select v-model="filters.status" placeholder="全部状态" clearable><el-option value="true" :label="isMember?'上架':'启用'"/><el-option value="false" :label="isMember?'下架':'停用'"/></el-select></el-form-item><div class="search-actions"><el-button @click="reset">重置</el-button><el-button type="primary" @click="search">搜索</el-button></div></div></el-form></section>
  <div class="primary-actions"><el-button v-if="isMember" type="primary" :icon="Plus" :disabled="readonly" @click="emit('plan',null)">新增方案</el-button><el-button v-else-if="isVoucher" type="primary" :icon="Plus" :disabled="readonly" @click="emit('template',null)">新增模板</el-button><el-button v-if="isMember" :icon="Setting" @click="emit('settings')">{{readonly?'查看会员设置':'会员设置'}}</el-button></div>
  <section class="list-card"><div class="list-header"><strong>{{title}}</strong><el-space :size="8"><el-tooltip content="显示 / 隐藏搜索"><el-button circle :icon="Search" :type="showSearch?'primary':'default'" aria-label="显示搜索" @click="showSearch=!showSearch"/></el-tooltip><el-tooltip content="刷新列表"><el-button circle :icon="Refresh" aria-label="刷新列表" @click="emit('refresh')"/></el-tooltip><el-tooltip :content="fullscreen?'退出全屏':'全屏工作区'"><el-button circle :icon="FullScreen" :aria-label="fullscreen?'退出全屏':'全屏工作区'" @click="emit('fullscreen')"/></el-tooltip></el-space></div>
   <el-table :data="rows" row-key="id" border class="configuration-table" empty-text="暂无匹配配置，请调整筛选条件">
    <el-table-column v-if="isMember" prop="id" label="方案编号" min-width="165" show-overflow-tooltip/>
    <el-table-column :label="isMember?'方案名称':'模板名称 / 编号'" :min-width="isMember?180:175"><template #default="{row}">{{row.name}}<div v-if="isVoucher" class="subline mono">{{row.id}}</div></template></el-table-column>
    <el-table-column v-if="isMember" prop="period" label="会员时长" min-width="110"/>
    <el-table-column prop="amount" :label="isMember?'售价':'类型 / 抵用内容'" :min-width="isMember?130:125"><template #default="{row}"><span v-if="isMember">{{row.amount}}</span><template v-else>{{voucherTypeLabels[row.template.type as keyof typeof voucherTypeLabels]}}<div class="subline">{{row.amount}}</div></template></template></el-table-column>
    <el-table-column v-if="isVoucher" prop="rule" label="有效期" min-width="125" show-overflow-tooltip/>
    <el-table-column v-if="isVoucher" label="适用范围" min-width="120"><template #default="{row}"><div v-for="scope in row.template.usage.orderScope" :key="scope">{{scope}}</div><span v-if="!row.template.usage.orderScope.length" class="error-text">未配置</span></template></el-table-column>
    <el-table-column v-if="isVoucher" label="用券规则" min-width="220"><template #default="{row}"><el-tooltip :content="voucherUsageSummary(row.template.usage,row.template.type)" placement="top"><div>{{row.template.type==='times'?'每张抵用1次 · 不限金额':voucherThresholdSummary(row.template.usage)}}<div class="subline">{{row.template.type==='times'?'每次使用1张':'每单最多 '+row.template.usage.maxPerOrder+' 张'}} · {{row.template.usage.withPromotion?'优惠可同享':'优惠不同享'}}</div><div class="subline" :class="{'error-text':!row.template.usage.refund}">{{voucherRefundLabels[row.template.usage.refund as keyof typeof voucherRefundLabels]}}{{row.template.usage.refund==='extend'?'（'+row.template.usage.refundExtendDays+'天）':''}}</div></div></el-tooltip></template></el-table-column>
    <el-table-column v-if="isVoucher" label="累计已发 / 上限" min-width="115"><template #default="{row}">{{stock[row.id]??0}} / {{row.limit}}</template></el-table-column>
    <el-table-column label="状态" :width="isMember?105:75" align="center"><template #default="{row}"><el-tag :type="row.enabled?'success':'info'">{{row.enabled?(isMember?'上架':'启用'):(isMember?'下架':'停用')}}</el-tag></template></el-table-column>
    <el-table-column label="操作" :width="isVoucher?110:90" fixed="right" align="center"><template #default="{row}"><el-button type="primary" link @click="row.plan?emit('plan',row.plan):emit('template',row.template)">{{readonly?'查看':'编辑'}}</el-button><el-button v-if="row.template" type="primary" link :disabled="readonly" @click="emit('copy',row.template)">复制</el-button></template></el-table-column>
   </el-table>
   <div class="pagination"><el-pagination v-model:current-page="page" v-model:page-size="size" :page-sizes="[10,20,50]" :total="filtered.length" layout="total, sizes, prev, pager, next" @size-change="page=1"/></div>
  </section>
 </div>
</template>
