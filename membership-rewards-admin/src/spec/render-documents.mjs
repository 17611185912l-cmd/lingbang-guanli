const cell=value=>String(value??'').replaceAll('|','\\|').replaceAll('\n','<br>')
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
const table=(headers,rows)=>'\n| '+headers.map(cell).join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+row.map(cell).join(' | ')+' |').join('\n')+'\n'
export function validateSpec(spec){
 const errors=[],sections=new Set(),requirements=new Map(),cases=new Map()
 for(const s of spec.sections){
  if(sections.has(s.id))errors.push('重复章节 '+s.id);sections.add(s.id)
  if(!s.title||!s.summary||!s.requirements.length||!s.cases.length)errors.push('章节内容不完整 '+s.id)
  for(const r of s.requirements){if(requirements.has(r.id))errors.push('重复需求 '+r.id);requirements.set(r.id,r);if(!r.title||!r.description||!r.status||!r.acceptance.length||!r.caseIds.length)errors.push('需求不完整 '+r.id)}
  for(const c of s.cases){if(cases.has(c.id))errors.push('重复用例 '+c.id);cases.set(c.id,c);if(!c.preconditions||!c.steps.length||!c.expected.length||!c.requirementIds.length)errors.push('用例不完整 '+c.id)}
  for(const a of s.actions)for(const key of ['entry','condition','result','cancel','feedback'])if(!a[key])errors.push('操作说明缺失 '+s.id+' '+a.entry+' '+key)
  for(const f of s.fields)for(const key of ['name','key','control','required','default','constraints','linkage','error'])if(!f[key])errors.push('字段约束缺失 '+s.id+' '+f.name+' '+key)
 }
 for(const [id,r] of requirements)for(const cid of r.caseIds)if(!cases.has(cid)||!cases.get(cid).requirementIds.includes(id))errors.push('需求用例引用断开 '+id+' '+cid)
 for(const [id,c] of cases)for(const rid of c.requirementIds)if(!requirements.has(rid)||!requirements.get(rid).caseIds.includes(id))errors.push('用例需求引用断开 '+id+' '+rid)
 const referenced=new Set()
 for(const [key,t] of Object.entries(spec.topics)){
  if(!t.title||!t.sectionIds.length)errors.push('场景为空 '+key)
  for(const id of t.sectionIds){if(!sections.has(id))errors.push('场景缺失章节 '+key+' '+id);referenced.add(id)}
  for(const [id,entries] of Object.entries(t.actionEntries??{})){
   if(!t.sectionIds.includes(id))errors.push('场景操作章节缺失 '+key+' '+id)
   for(const entry of entries)if(!spec.sections.find(s=>s.id===id)?.actions.some(a=>a.entry===entry))errors.push('场景操作引用失效 '+key+' '+id+' '+entry)
  }
 }
 for(const s of spec.sections)if(!referenced.has(s.id)&&!['integration','data_contract','navigation','documentation'].includes(s.id))errors.push('没有场景引用 '+s.id)
 return errors
}
function header(spec,title){return '# '+title+'\n\n更新：'+spec.updated+'；规范版本：'+spec.version+'。\n\n'+spec.intro+'\n\n状态说明：界面已实现＝可在原型操作；模型已实现＝业务函数及测试覆盖，未必有真实事件入口；服务待接入＝开发联调要求；业务待确认＝不可擅自当作已确定规则。\n'}
export function renderRequirementsMarkdown(spec){
 let md=header(spec,'运营中心需求列表')
 const rows=spec.sections.flatMap(s=>s.requirements.map(r=>[r.id,s.moduleName,s.title,r.title,r.status,r.description,r.caseIds.join('、')]))
 md+='\n共'+rows.length+'项需求。可按编号关联完整开发说明和测试用例基线。\n'+table(['需求编号','模块','页面／场景','需求名称','实现范围','规则摘要','关联用例'],rows)
 for(const s of spec.sections){md+='\n## '+s.title+'\n';for(const r of s.requirements)md+='\n### '+r.id+' '+r.title+'\n\n状态：'+r.status+'。\n\n'+r.description+'\n\n验收标准：\n\n'+r.acceptance.map(a=>'- '+a).join('\n')+'\n\n关联用例：'+r.caseIds.join('、')+'。\n'}
 return md
}
export function renderCasesMarkdown(spec){
 let md=header(spec,'运营中心测试用例基线')+'\n本文件用于直接拆分测试用例。以下是预期行为，不代表所有用例已经执行。模型与服务场景需在指定环境构造数据，禁止向用户正在使用的5208存储注入测试数据。\n'
 for(const s of spec.sections){md+='\n## '+s.title+'\n';for(const c of s.cases)md+='\n### '+c.id+' '+c.title+'\n\n关联需求：'+c.requirementIds.join('、')+'；范围：'+c.status+'。\n\n前置条件：'+c.preconditions+'\n\n操作步骤：\n\n'+c.steps.map((v,i)=>(i+1)+'. '+v).join('\n')+'\n\n预期结果：\n\n'+c.expected.map(v=>'- '+v).join('\n')+'\n'}
 return md
}
export function renderFullMarkdown(spec){
 let md=header(spec,spec.title)
 md+='\n## 阅读与需求导航\n\n共'+spec.sections.length+'个说明章节，'+spec.sections.reduce((n,s)=>n+s.requirements.length,0)+'项需求；每项均关联前置条件、步骤和预期结果。\n\n'
 md+=spec.sections.map(s=>'- '+s.moduleName+' / '+s.title+'（'+s.requirements.map(r=>r.id).join('、')+'）').join('\n')+'\n'
 for(const s of spec.sections){md+='\n## '+s.title+'\n\n'+s.summary+'\n'
  md+='\n### 需求与验收标准\n'+table(['编号','需求','范围','规则','验收标准','关联用例'],s.requirements.map(r=>[r.id,r.title,r.status,r.description,r.acceptance.join('；'),r.caseIds.join('、')]))
  if(s.actions.length)md+='\n### 点击、去向、返回与反馈\n'+table(['入口／操作','前置／权限','结果与去向','取消／返回','反馈'],s.actions.map(a=>[a.entry,a.condition,a.result,a.cancel,a.feedback]))
  if(s.fields.length)md+='\n### 字段、默认值与约束\n'+table(['字段','模型键','控件','必填／适用','默认值','范围与校验','联动','错误反馈'],s.fields.map(f=>[f.name,f.key,f.control,f.required,f.default,f.constraints,f.linkage,f.error]))
  if(s.rules.length)md+='\n### 联动与边界\n\n'+s.rules.map(r=>'- '+r).join('\n')+'\n'
  md+='\n### 测试用例\n';for(const c of s.cases)md+='\n#### '+c.id+' '+c.title+'\n\n关联：'+c.requirementIds.join('、')+'；范围：'+c.status+'。\n\n前置：'+c.preconditions+'\n\n'+c.steps.map((v,i)=>(i+1)+'. '+v).join('\n')+'\n\n预期：\n\n'+c.expected.map(v=>'- '+v).join('\n')+'\n'
 }
 return md+'\n## 维护来源\n\n规范源：src/spec/prototype-spec.json。业务变动必须同步规范及场景映射；运行npm run docs重建，npm run docs:check检查生成文件一致性。\n'
}
function htmlTable(headers,rows){return '<div class="table-scroll"><table><thead><tr>'+headers.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
export function renderFullHtml(spec){
 const content=spec.sections.map(s=>'<section id="'+s.id+'"><h2>'+escape(s.title)+'</h2><p>'+escape(s.summary)+'</p><h3>需求与验收</h3>'+s.requirements.map(r=>'<article id="'+r.id+'"><h4>'+escape(r.id+' '+r.title)+'</h4><p class="status">'+escape(r.status)+'</p><p>'+escape(r.description)+'</p><ul>'+r.acceptance.map(v=>'<li>'+escape(v)+'</li>').join('')+'</ul><p>关联用例：'+r.caseIds.map(id=>'<a href="#'+id+'">'+id+'</a>').join('、')+'</p></article>').join('')+(s.actions.length?'<h3>点击、去向与返回</h3>'+htmlTable(['入口','权限／前置','结果与去向','取消／返回','反馈'],s.actions.map(a=>[a.entry,a.condition,a.result,a.cancel,a.feedback])):'')+(s.fields.length?'<h3>字段与约束</h3>'+htmlTable(['字段／键','控件／必填','默认','约束','联动／错误'],s.fields.map(f=>[f.name+' / '+f.key,f.control+' / '+f.required,f.default,f.constraints,f.linkage+'；'+f.error])):'')+(s.rules.length?'<h3>联动与边界</h3><ul>'+s.rules.map(v=>'<li>'+escape(v)+'</li>').join('')+'</ul>':'')+'<h3>测试用例</h3>'+s.cases.map(c=>'<article id="'+c.id+'"><h4>'+escape(c.id+' '+c.title)+'</h4><p>'+escape(c.status)+' · 关联 '+escape(c.requirementIds.join('、'))+'</p><p><b>前置：</b>'+escape(c.preconditions)+'</p><ol>'+c.steps.map(v=>'<li>'+escape(v)+'</li>').join('')+'</ol><p><b>预期：</b></p><ul>'+c.expected.map(v=>'<li>'+escape(v)+'</li>').join('')+'</ul></article>').join('')+'<a href="#top">返回目录</a></section>').join('')
 return '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(spec.title)+'</title><style>*{box-sizing:border-box}body{margin:0;color:#303846;background:#f3f5f8;font:14px/1.8 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main,header{max-width:1280px;margin:auto;padding:28px}h1{font-size:28px}h2{font-size:23px}h3{font-size:18px;margin-top:26px}h4{font-size:15px}section{background:white;border:1px solid #e1e5eb;border-radius:10px;margin-bottom:24px;padding:26px;scroll-margin-top:20px}article{border-top:1px solid #e5e8ef;padding:12px 0;scroll-margin-top:20px}a{color:#3268db}.toc{columns:2}.toc li{break-inside:avoid}.status{color:#64748b}.table-scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:10px;border:1px solid #dfe5ed;vertical-align:top;min-width:110px}th{background:#eef3fc}td{overflow-wrap:anywhere}li{margin:5px 0}.toolbar{display:flex;gap:16px;flex-wrap:wrap}@media(max-width:700px){main,header{padding:16px}section{padding:16px}.toc{columns:1}}@media print{body{background:white}header,main{max-width:none;padding:0}.toolbar{display:none}section{border:0;break-before:page;padding:0}tr,article{break-inside:avoid}.table-scroll{overflow:visible}th,td{font-size:9px;min-width:0;padding:4px}}</style></head><body><header id="top"><h1>'+escape(spec.title)+'</h1><p>'+escape(spec.updated+' · '+spec.version)+'</p><p>'+escape(spec.intro)+'</p><p>范围标记：界面已实现／模型已实现／服务待接入／业务待确认。测试章节是验收基线，并不代表全部已执行。</p><div class="toolbar"><a href="原型开发与测试说明.md" download>下载完整MD</a><a href="需求列表.md" download>下载需求列表</a><a href="测试用例基线.md" download>下载测试基线</a></div><nav><ol class="toc">'+spec.sections.map(s=>'<li><a href="#'+s.id+'">'+escape(s.moduleName+' / '+s.title)+'</a></li>').join('')+'</ol></nav></header><main>'+content+'</main></body></html>\n'
}
