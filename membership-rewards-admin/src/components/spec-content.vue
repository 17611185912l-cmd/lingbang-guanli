<script setup lang="ts">
import type {SpecSection} from '../spec/types'
defineProps<{sections:SpecSection[];mode:'actions'|'fields'|'rules'|'cases'|'all'}>()
</script>
<template>
 <section v-for="section in sections" :key="section.id" class="spec-section" :data-spec-section="section.id">
  <h3>{{section.title}}</h3>
  <p class="spec-summary">{{section.summary}}</p>
  <template v-if="mode==='rules'||mode==='all'">
   <article v-for="r in section.requirements" :key="r.id" class="spec-entry" :data-requirement="r.id"><div class="spec-entry-heading"><strong>{{r.title}}</strong><span class="spec-status">{{r.status}}</span></div><code>{{r.id}}</code><p>{{r.description}}</p><ul><li v-for="item in r.acceptance" :key="item">{{item}}</li></ul><small>关联用例：{{r.caseIds.join('、')}}</small></article>
   <ul v-if="section.rules.length" class="spec-boundaries"><li v-for="rule in section.rules" :key="rule">{{rule}}</li></ul>
  </template>
  <template v-if="mode==='actions'||mode==='all'"><h4 v-if="mode==='all'&&section.actions.length">点击、去向与返回</h4><dl v-for="a in section.actions" :key="a.entry" class="spec-entry"><dt>{{a.entry}}</dt><dd><b>前置／权限：</b>{{a.condition}}</dd><dd><b>结果：</b>{{a.result}}</dd><dd><b>取消／返回：</b>{{a.cancel}}</dd><dd><b>反馈：</b>{{a.feedback}}</dd></dl><p v-if="!section.actions.length&&mode==='actions'" class="spec-empty">本节为规则与数据说明，具体操作见当前场景其他章节。</p></template>
  <template v-if="mode==='fields'||mode==='all'"><h4 v-if="mode==='all'&&section.fields.length">字段与约束</h4><dl v-for="f in section.fields" :key="f.key" class="spec-entry"><dt>{{f.name}}</dt><dd><code>{{f.key}}</code></dd><dd><b>控件／必填：</b>{{f.control}} · {{f.required}}</dd><dd><b>默认：</b>{{f.default}}</dd><dd><b>范围与校验：</b>{{f.constraints}}</dd><dd><b>联动：</b>{{f.linkage}}</dd><dd><b>错误：</b>{{f.error}}</dd></dl><p v-if="!section.fields.length&&mode==='fields'" class="spec-empty">本节没有额外输入字段。</p></template>
  <template v-if="mode==='cases'||mode==='all'"><h4 v-if="mode==='all'">测试用例基线</h4><article v-for="c in section.cases" :key="c.id" class="spec-entry" :data-case="c.id"><strong>{{c.title}}</strong><p><code>{{c.id}}</code> · {{c.status}}</p><p><b>关联需求：</b>{{c.requirementIds.join('、')}}</p><p><b>前置：</b>{{c.preconditions}}</p><ol><li v-for="(step,index) in c.steps" :key="index">{{step}}</li></ol><p><b>预期：</b></p><ul><li v-for="(item,index) in c.expected" :key="index">{{item}}</li></ul></article></template>
 </section>
</template>
