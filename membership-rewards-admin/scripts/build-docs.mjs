import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {validateSpec,renderFullMarkdown,renderRequirementsMarkdown,renderCasesMarkdown,renderFullHtml} from '../src/spec/render-documents.mjs'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const spec=JSON.parse(fs.readFileSync(path.join(root,'src/spec/prototype-spec.json'),'utf8'))
const errors=validateSpec(spec)
if(errors.length)throw new Error(errors.join('\n'))
const files={'原型开发与测试说明.md':renderFullMarkdown(spec),'需求列表.md':renderRequirementsMarkdown(spec),'测试用例基线.md':renderCasesMarkdown(spec),'原型开发与测试说明.html':renderFullHtml(spec)}
const check=process.argv.includes('--check')
for(const [name,content] of Object.entries(files)){
 const file=path.join(root,'docs',name)
 if(check){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==content)throw new Error('文档未同步，请执行npm run docs：'+name)}
 else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content)}
}
console.log((check?'Checked':'Generated')+' '+spec.sections.length+' sections, '+spec.sections.reduce((n,s)=>n+s.requirements.length,0)+' requirements, '+spec.sections.reduce((n,s)=>n+s.cases.length,0)+' test cases.')
