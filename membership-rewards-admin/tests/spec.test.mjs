import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {validateSpec,renderFullMarkdown,renderRequirementsMarkdown,renderCasesMarkdown,renderFullHtml} from '../src/spec/render-documents.mjs'
const spec=JSON.parse(fs.readFileSync(new URL('../src/spec/prototype-spec.json',import.meta.url),'utf8'))
test('需求、用例、字段和40个页面场景引用完整且不重复',()=>{
 assert.deepEqual(validateSpec(spec),[])
 assert.equal(new Set(Object.keys(spec.topics)).size,40)
 const chapters=['member_list','voucher_list','demand_payment','activity_list','records_assets','records_invites','records_grants','member_settings','plan_create','plan_edit','plan_view','audit','retry','revoke','tools','loading','load_error','no_access','storage_error']
 for(const id of chapters)assert.ok(spec.topics[id],id)
 for(const mode of ['create','copy','edit','view'])for(const type of ['amount','times'])assert.ok(spec.topics['voucher_'+mode+'_'+type])
 const invalid=structuredClone(spec)
 invalid.topics.activity_view.actionEntries.activity_list.push('不存在的详情动作')
 assert.ok(validateSpec(invalid).some(error=>error.includes('场景操作引用失效')))
 assert.deepEqual(spec.topics.activity_view.actionEntries.activity_form,[])
})
test('同源独立MD与HTML和规范一致，不允许页面文档分叉',()=>{
 for(const [name,render] of [['原型开发与测试说明.md',renderFullMarkdown],['需求列表.md',renderRequirementsMarkdown],['测试用例基线.md',renderCasesMarkdown],['原型开发与测试说明.html',renderFullHtml]])assert.equal(fs.readFileSync(new URL('../docs/'+name,import.meta.url),'utf8'),render(spec),name)
})
test('接入待定事项不能混入界面已实现需求',()=>{
 const integration=spec.sections.find(s=>s.id==='integration')
 assert.ok(integration.requirements.length)
 assert.ok(integration.requirements.every(r=>['服务待接入','业务待确认'].includes(r.status)))
 const ids=spec.sections.flatMap(s=>s.requirements.map(r=>r.id)),cases=spec.sections.flatMap(s=>s.cases)
 assert.equal(ids.length,96);assert.equal(cases.length,96)
 assert.ok(cases.every(c=>c.preconditions&&c.steps.length&&c.expected.length))
})
test('说明导出转义表格和HTML内容，不把输入变为标记或脚本',()=>{
 const changed=structuredClone(spec)
 changed.sections[0].fields[0].constraints='a|b\nc <script>alert(1)</script>'
 const md=renderFullMarkdown(changed),html=renderFullHtml(changed)
 assert.ok(md.includes('a\\|b<br>c <script>alert(1)</script>'))
 assert.ok(html.includes('a|b\nc &lt;script&gt;alert(1)&lt;/script&gt;'))
 assert.equal(html.includes('<script>'),false)
})
