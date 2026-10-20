import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDesktopAPI } from '../src/desktop-api.mjs'

test('Desktop history uses legacy parts, preserves cursor and never switches execution engine', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bc-desktop-api-')); t.after(() => rm(root, {recursive:true,force:true}))
  const calls = []
  const request = async (path, method, body) => {
    calls.push({path,method,body})
    if (path === '/session/ses_one') return {data: {directory:'/project',agent:'build'}}
    if (path.startsWith('/session/ses_one/message?')) return {data: [{info:{id:'msg_one',role:'assistant'},parts:[{id:'part_one',type:'text',text:'Existing Desktop response'}]}],cursor:'older'}
    if (path.includes('/prompt_async')) return {data:undefined}
    throw new Error(path)
  }
  const api = await createDesktopAPI({request, storePath:join(root,'admissions.json')})
  const page = await api.handle('GET','/api/session/ses_one/message?limit=50&order=desc')
  assert.equal(page.data.data[0].content[0].text,'Existing Desktop response')
  assert.equal(page.data.cursor.next,'older')
  const prompt = {id:'msg_stable',prompt:{text:'Continue the same work'}}
  await api.handle('POST','/api/session/ses_one/prompt',prompt)
  const reopened = await createDesktopAPI({request, storePath:join(root,'admissions.json')})
  await reopened.handle('POST','/api/session/ses_one/prompt',prompt)
  assert.equal(calls.filter(c=>c.path.includes('/prompt_async')).length,1)
  assert.equal(calls.find(c=>c.path.includes('/prompt_async')).body.messageID,'msg_stable')
  await assert.rejects(reopened.handle('POST','/api/session/ses_one/prompt',{...prompt,prompt:{text:'Different'}}), /identity/)
})
test('an uncertain Desktop admission is never automatically executed a second time', async t => {
  const root = await mkdtemp(join(tmpdir(), 'bc-desktop-api-')); t.after(() => rm(root, {recursive:true,force:true}))
  let submissions=0
  const request = async path => {
    if(path === '/session/ses_one') return {data:{directory:'/project'}}
    if(path.includes('prompt_async')) { submissions++; throw new Error('connection lost') }
    throw Object.assign(new Error('not found'),{status:404})
  }
  const api=await createDesktopAPI({request,storePath:join(root,'admissions.json')})
  const prompt={id:'msg_one',prompt:{text:'Run tests'}}
  await assert.rejects(api.handle('POST','/api/session/ses_one/prompt',prompt))
  await assert.rejects(api.handle('POST','/api/session/ses_one/prompt',prompt),/unconfirmed/)
  assert.equal(submissions,1)
})
test('Desktop provider and agent choices exclude secrets and hidden agents', async t => {
  const root=await mkdtemp(join(tmpdir(),'bc-desktop-api-'));t.after(()=>rm(root,{recursive:true,force:true}))
  const request=async path=>({data:path.startsWith('/provider')?{connected:['provider_one'],all:[{id:'provider_one',key:'private',models:{model_one:{id:'model_one',name:'Model',api:{key:'private'}}}},{id:'unconfigured',models:{unused:{id:'unused'}}}]}:[{name:'build',permission:{secret:'private'}},{name:'internal',hidden:true}]})
  const api=await createDesktopAPI({request,storePath:join(root,'admissions.json')})
  const models=await api.handle('GET','/api/model')
  assert.deepEqual(models.data.data,[{id:'model_one',providerID:'provider_one',name:'Model',enabled:true}])
  assert.equal(JSON.stringify(models).includes('private'),false)
  const agents=await api.handle('GET','/api/agent')
  assert.deepEqual(agents.data.data.map(a=>a.id),['build'])
  assert.equal(JSON.stringify(agents).includes('private'),false)
})
test('Desktop request decisions verify session ownership before reply',async t=>{
  const root=await mkdtemp(join(tmpdir(),'bc-desktop-api-'));t.after(()=>rm(root,{recursive:true,force:true}))
  let replies=0
  const request=async(path,method)=>{if(method==='POST')replies++;return {data:path==='/session/ses_one'?{directory:'/work'}:[{id:'per_one',sessionID:'ses_other'}]}}
  const api=await createDesktopAPI({request,storePath:join(root,'admissions.json')})
  await assert.rejects(api.handle('POST','/api/session/ses_one/permission/per_one/reply',{reply:'once'}),/resolved|unavailable/)
  assert.equal(replies,0)
})
