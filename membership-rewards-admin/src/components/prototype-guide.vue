<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,ref,watch} from 'vue'
import {Close,Download} from '@element-plus/icons-vue'
import SpecContent from './spec-content.vue'
import {spec,type GuideContext,type GuideTopicConfig,type SpecRequirement,type SpecSection} from '../spec/types'
import {renderCasesMarkdown,renderFullHtml,renderFullMarkdown,renderRequirementsMarkdown} from '../spec/render-documents.mjs'
const open=defineModel<boolean>({required:true})
const props=defineProps<{context:GuideContext}>()
const scrollEl=ref<HTMLElement|null>(null)
const tab=ref('current'),view=ref<'actions'|'fields'|'rules'|'cases'>('actions'),query=ref(''),module=ref(''),status=ref(''),page=ref(1),pageSize=ref(20),selected=ref<SpecRequirement|null>(null),chapter=ref('navigation')
const sectionsById=new Map(spec.sections.map(s=>[s.id,s]))
const currentTopic=computed<GuideTopicConfig>(()=>spec.topics[props.context.topic])
const sections=computed(()=>currentTopic.value.sectionIds.map(id=>sectionsById.get(id)).filter((s):s is SpecSection=>!!s).map(section=>{
 const entries=currentTopic.value.actionEntries?.[section.id]
 return {...section,actions:entries?section.actions.filter(action=>entries.includes(action.entry)):section.actions,fields:currentTopic.value.readonly?section.fields.map(field=>({...field,control:'只读展示',required:'本场景无输入',default:'当前已保存值',linkage:'当前为查看场景；下述范围用于解释来源配置，修改须进入对应编辑。',error:'查看时无字段提交或保存校验。'})):section.fields}
}))
const requirements=spec.sections.flatMap(section=>section.requirements.map(requirement=>({...requirement,sectionId:section.id,sectionTitle:section.title,module:section.module,moduleName:section.moduleName})))
const modules=[...new Map(spec.sections.map(s=>[s.module,s.moduleName])).entries()]
const states=[...new Set(requirements.map(r=>r.status))]
const filtered=computed(()=>requirements.filter(r=>(!module.value||r.module===module.value)&&(!status.value||r.status===status.value)&&(!query.value.trim()||(r.id+r.title+r.description+r.sectionTitle).toLowerCase().includes(query.value.trim().toLowerCase()))))
const rows=computed(()=>filtered.value.slice((page.value-1)*pageSize.value,page.value*pageSize.value))
const selectedCases=computed(()=>selected.value?spec.sections.flatMap(s=>s.cases).filter(c=>selected.value!.caseIds.includes(c.id)):[])
const selectedSection=computed(()=>spec.sections.find(s=>s.requirements.some(r=>r.id===selected.value?.id)))
const fullSection=computed(()=>sectionsById.get(chapter.value))
function showRequirements(){tab.value='requirements';selected.value=null}
function showCurrent(){tab.value='current'}
function launch(mode:'current'|'requirements'){open.value=true;if(mode==='requirements')showRequirements();else showCurrent()}
defineExpose({showRequirements,showCurrent})
function resetFilters(){query.value='';module.value='';status.value='';page.value=1;selected.value=null}
function chooseRequirement(row:SpecRequirement){selected.value=row;nextTick(()=>scrollEl.value?.scrollTo({top:0}))}
function showFull(sectionId=sections.value[0]?.id??'navigation'){chapter.value=sectionId;tab.value='full'}
watch([query,module,status,pageSize],()=>{page.value=1;selected.value=null})
watch(()=>props.context.topic,()=>{selected.value=null;chapter.value=sections.value[0]?.id??'navigation'})
watch(open,value=>{document.body.classList.toggle('operation-guide-open',value)},{immediate:true})
onBeforeUnmount(()=>document.body.classList.remove('operation-guide-open'))
function download(kind:'full'|'requirements'|'cases'|'html'){
 const file=kind==='full'?['原型开发与测试说明.md',renderFullMarkdown(spec),'text/markdown;charset=utf-8']:kind==='requirements'?['需求列表.md',renderRequirementsMarkdown(spec),'text/markdown;charset=utf-8']:kind==='cases'?['测试用例基线.md',renderCasesMarkdown(spec),'text/markdown;charset=utf-8']:['原型开发与测试说明.html',renderFullHtml(spec),'text/html;charset=utf-8']
 const url=URL.createObjectURL(new Blob([file[1]],{type:file[2]})),a=document.createElement('a');a.href=url;a.download=file[0];a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
</script>
<template>
 <Teleport to="body">
 <div v-if="!open" class="guide-launcher"><el-button text class="spec-entry-button" @click="launch('current')">原型说明</el-button><el-button text class="spec-entry-button" @click="launch('requirements')">需求列表</el-button></div>
 <aside v-if="open" class="prototype-guide" aria-label="原型开发与测试说明" data-testid="prototype-guide">
  <header class="guide-heading"><div><strong>开发与测试说明</strong><small>{{spec.updated}} · {{requirements.length}}项需求</small></div><el-button :icon="Close" text circle aria-label="收起原型说明" @click="open=false"/></header>
  <div class="guide-current" aria-live="polite"><b>{{context.label||currentTopic.title}}</b><p v-if="context.detail">{{context.detail}}</p></div>
  <el-tabs v-model="tab" class="guide-tabs"><el-tab-pane label="当前页面" name="current"/><el-tab-pane label="需求列表" name="requirements"/><el-tab-pane label="完整说明" name="full"/></el-tabs>
  <div ref="scrollEl" class="guide-scroll">
   <template v-if="tab==='current'">
    <p class="guide-hint">说明随当前页面、页签和弹窗切换。测试内容为用例基线，范围标记区分界面、模型与待接入。</p>
    <el-radio-group v-model="view" size="small" aria-label="说明内容分类" class="guide-view-switch"><el-radio-button value="actions">操作</el-radio-button><el-radio-button value="fields">字段</el-radio-button><el-radio-button value="rules">规则</el-radio-button><el-radio-button value="cases">测试</el-radio-button></el-radio-group>
    <spec-content :sections="sections" :mode="view"/>
    <el-button link type="primary" @click="showFull()">查看本场景完整说明</el-button>
   </template>
   <template v-else-if="tab==='requirements'">
    <template v-if="!selected">
    <div class="guide-query"><el-input v-model="query" aria-label="搜索需求" placeholder="需求编号、名称或规则关键词" clearable/><div><el-select v-model="module" aria-label="需求模块" placeholder="全部模块" clearable><el-option v-for="[id,name] in modules" :key="id" :label="name" :value="id"/></el-select><el-select v-model="status" aria-label="需求实现范围" placeholder="全部范围" clearable><el-option v-for="item in states" :key="item" :label="item" :value="item"/></el-select></div><el-button size="small" @click="resetFilters">重置需求筛选</el-button><span>共 {{filtered.length}} / {{requirements.length}} 项</span></div>
    <el-table :data="rows" border size="small" empty-text="没有匹配需求" @row-click="chooseRequirement"><el-table-column label="需求 / 编号" min-width="180"><template #default="{row}"><el-button type="primary" link class="requirement-title" @click.stop="chooseRequirement(row)">{{row.title}}</el-button><code>{{row.id}}</code><small>{{row.moduleName}} · {{row.sectionTitle}}</small></template></el-table-column><el-table-column label="范围" width="98"><template #default="{row}"><span>{{row.status}}</span></template></el-table-column></el-table>
    <el-pagination v-model:current-page="page" v-model:page-size="pageSize" size="small" :total="filtered.length" layout="prev, pager, next"/>
    </template>
    <section v-else class="requirement-detail" aria-label="选中需求详情"><el-button size="small" @click="selected=null">返回需求列表</el-button><h3>{{selected.title}}</h3><code>{{selected.id}}</code><p>{{selected.status}} · {{selected.description}}</p><el-button v-if="selectedSection" link type="primary" @click="showFull(selectedSection.id)">查看所属章节完整说明</el-button><h4>验收标准</h4><ul><li v-for="item in selected.acceptance" :key="item">{{item}}</li></ul><article v-for="c in selectedCases" :key="c.id" class="spec-entry"><h4>{{c.id}} {{c.title}}</h4><p><b>前置：</b>{{c.preconditions}}</p><ol><li v-for="step in c.steps" :key="step">{{step}}</li></ol><p><b>预期：</b></p><ul><li v-for="item in c.expected" :key="item">{{item}}</li></ul></article></section>
   </template>
   <template v-else>
    <el-select v-model="chapter" aria-label="完整说明章节" filterable class="guide-chapters"><el-option v-for="s in spec.sections" :key="s.id" :value="s.id" :label="s.moduleName+' / '+s.title"/></el-select>
    <spec-content v-if="fullSection" :sections="[fullSection]" mode="all"/>
   </template>
  </div>
  <footer class="guide-downloads"><el-dropdown trigger="click" @command="download"><el-button size="small" :icon="Download">下载文档</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="full">完整开发与测试说明 MD</el-dropdown-item><el-dropdown-item command="requirements">需求列表 MD</el-dropdown-item><el-dropdown-item command="cases">测试用例基线 MD</el-dropdown-item><el-dropdown-item command="html">独立 HTML（可打印）</el-dropdown-item></el-dropdown-menu></template></el-dropdown><span>页面与文档共用规范源</span></footer>
 </aside>
 </Teleport>
</template>
