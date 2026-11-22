import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8')
const asset=(extension)=>{const match=html.match(new RegExp(`(?:src|href)="\\./(assets/[^\"]+\\.${extension})"`));if(!match)throw Error(`Missing ${extension}`);return fs.readFileSync(path.join(root,'dist',match[1]),'utf8')}
const css=asset('css').replaceAll('</style','<\\/style')
const js=asset('js').replaceAll('</script','<\\/script')
if(/(?:from\s*|import\s*)["']\.\//.test(js))throw Error('External module dependency remains')
const output=`<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>会员与奖励配置 · 领榜后台</title><style>${css}</style></head><body><div id="app"></div><script type="module">${js}</script></body></html>`
const target=path.resolve(root,'../会员与邀请奖励配置.html')
fs.writeFileSync(target,output)
console.log(`Standalone HTML: ${target} (${Math.round(Buffer.byteLength(output)/1024)} KB; no external assets)`)
