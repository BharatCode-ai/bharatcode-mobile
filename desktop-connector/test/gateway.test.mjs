import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGateway } from '../src/gateway.mjs'

async function setup(t, options = {}) {
  const seen = []
  const upstream = createServer((req, res) => {
    seen.push({ url: req.url, method: req.method, headers: req.headers })
    if (req.url === '/session/ses_one') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id: 'ses_one', directory: '/work/fixture project' })); return }
    if (req.url === '/api/model') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ data: [{ id: 'model_one', providerID: 'provider_one', name: 'Configured model', enabled: true, request: { headers: { authorization: 'secret-provider-key' } }, api: { settings: { apiKey: 'secret-provider-key' } } }] }))
      return
    }
    if (req.url === '/api/session/ses_changes') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: { location: { directory: '/work/storefront' } } })); return }
    if (req.url.startsWith('/vcs/diff?')) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify([{ file: 'address.ts', patch: '@@ -1 +1 @@\n-old\n+new', additions: 1, deletions: 1 }])); return }
    if (req.url === '/api/event' || req.url === '/api/event?directory=%2Fwork%2Ffixture+project') {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const event of [
        { id: 'evt_live', type: 'session.next.text.delta', data: { sessionID: 'ses_one', assistantMessageID: 'msg_one', textID: 'txt_one', delta: 'Hello' } },
        { id: 'evt_other', type: 'session.next.text.delta', data: { sessionID: 'ses_other', delta: 'private' } },
        { id: 'evt_secret', type: 'provider.updated', data: { sessionID: 'ses_one', secret: 'hidden' } },
      ]) res.write(`data: ${JSON.stringify(event)}\n\n`)
      return
    }
    if (req.url.includes('/event')) {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write('data: {"type":"connected"}\n\n')
      return
    }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ data: [], cursor: {} }))
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  t.after(() => { upstream.closeAllConnections(); upstream.close() })
  const directory = await mkdtemp(join(tmpdir(), 'bc-mobile-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  let currentTime = 1_000_000
  const claims = []
  const gateway = await createGateway({
    upstream: `http://127.0.0.1:${upstream.address().port}`,
    username: 'opencode', password: 'private-sidecar-secret',
    storePath: join(directory, 'devices.json'),
    now: () => currentTime, onPairingRequest: claim => claims.push(claim),
    ...options,
  })
  const origin = await gateway.listen()
  t.after(() => gateway.close())
  const post = (path, body, token) => fetch(origin + path, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  async function pair() {
    const qr = gateway.issuePairing('https://api.unit.opentunnel.xyz')
    const response = await post('/mobile/v1/claim', { code: qr.code, deviceName: 'Test phone' })
    assert.equal(response.status, 201)
    const claim = await response.json()
    await gateway.approve(claim.claimID)
    const result = await post('/mobile/v1/claim/status', claim)
    return { ...(await result.json()), claim, qr }
  }
  return { gateway, origin, post, pair, seen, claims, directory, expire: () => { currentTime += 300_001 } }
}

test('scan needs explicit desktop approval, and one-use code cannot be claimed twice', async t => {
  const c = await setup(t)
  const qr = c.gateway.issuePairing('https://api.unit.opentunnel.xyz')
  const responses = await Promise.all([1, 2].map(() => c.post('/mobile/v1/claim', { code: qr.code, deviceName: 'Phone' })))
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 401])
  const claim = await responses.find(r => r.status === 201).json()
  assert.equal((await (await c.post('/mobile/v1/claim/status', claim)).json()).state, 'waiting')
  assert.equal(c.claims.length, 1)
  assert.equal(c.gateway.devices().length, 0)
  await c.gateway.approve(claim.claimID)
  const result = await (await c.post('/mobile/v1/claim/status', claim)).json()
  assert.equal(result.state, 'approved')
  assert.ok(result.token.length >= 40)
  assert.equal((await c.post('/mobile/v1/claim/status', claim)).status, 410)
})

test('expired pairing codes and pending approvals cannot issue a credential', async t => {
  const c = await setup(t)
  const qr = c.gateway.issuePairing('https://unit.opentunnel.xyz')
  c.expire()
  assert.equal((await c.post('/mobile/v1/claim', { code: qr.code, deviceName: 'Phone' })).status, 401)
  const next = c.gateway.issuePairing('https://unit.opentunnel.xyz')
  const claim = await (await c.post('/mobile/v1/claim', { code: next.code, deviceName: 'Phone' })).json()
  c.expire()
  await assert.rejects(c.gateway.approve(claim.claimID), /expired/)
  assert.equal(c.gateway.devices().length, 0)
})

test('only HTTPS OpenTunnel origins can be issued and issuing a new QR invalidates the old one', async t => {
  const c = await setup(t)
  for (const url of ['http://unit.opentunnel.xyz', 'https://evil.example', 'https://unit.opentunnel.xyz/path', 'https://user:pass@unit.opentunnel.xyz']) {
    assert.throws(() => c.gateway.issuePairing(url))
  }
  const old = c.gateway.issuePairing('https://unit.opentunnel.xyz')
  c.gateway.issuePairing('https://unit.opentunnel.xyz')
  assert.equal((await c.post('/mobile/v1/claim', { code: old.code, deviceName: 'Phone' })).status, 401)
})

test('denied claim cannot be approved and a wrong claim secret cannot poll', async t => {
  const c = await setup(t)
  const qr = c.gateway.issuePairing('https://unit.opentunnel.xyz')
  const claim = await (await c.post('/mobile/v1/claim', { code: qr.code, deviceName: 'Phone' })).json()
  assert.equal((await c.post('/mobile/v1/claim/status', { ...claim, claimSecret: 'wrong' })).status, 401)
  c.gateway.decline(claim.claimID)
  assert.equal((await (await c.post('/mobile/v1/claim/status', claim)).json()).state, 'declined')
  await assert.rejects(c.gateway.approve(claim.claimID))
})

test('device credential proxies only allowed routes and never leaks master credentials', async t => {
  const c = await setup(t)
  assert.equal((await fetch(c.origin + '/api/session')).status, 401)
  const { token } = await c.pair()
  const response = await fetch(c.origin + '/api/session?limit=30', { headers: { authorization: `Bearer ${token}`, 'x-forwarded-host': 'evil.example' } })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { data: [], cursor: {} })
  assert.equal(c.seen[0].headers.authorization, 'Basic ' + Buffer.from('opencode:private-sidecar-secret').toString('base64'))
  assert.equal(c.seen[0].headers['x-forwarded-host'], undefined)
  const metadata = await (await fetch(c.origin + '/mobile/v1/health', { headers: { authorization: `Bearer ${token}` } })).text()
  assert.ok(!metadata.includes('private-sidecar-secret'))
  for (const path of ['/api/credential', '/api/config', '/api/integration', '/api/session/abc/permission', '/api/fs/file?path=/etc/passwd', '/api/session/abc%2F..%2Fcredential']) {
    const denied = await c.post(path, {}, token)
    assert.equal(denied.status, 403, path)
  }
  assert.equal(c.seen.length, 1)
})

test('bodyless Desktop interrupts work while nonempty bodies still require JSON', async t => {
  const c = await setup(t, {runtime:'desktop'})
  const {token} = await c.pair()
  const headers = {authorization:`Bearer ${token}`}
  const response = await fetch(c.origin+'/api/session/ses_one/interrupt',{method:'POST',headers})
  assert.equal(response.status,200)
  const aborts=c.seen.filter(r=>r.url.startsWith('/session/ses_one/abort?'))
  assert.equal(aborts.length,1)
  assert.equal(aborts[0].method,'POST')
  const before=c.seen.length
  const rejected=await fetch(c.origin+'/api/session/ses_one/interrupt',{method:'POST',headers:{...headers,'content-type':'text/plain'},body:'{}'})
  assert.equal(rejected.status,415)
  assert.equal(c.seen.length,before)
})

test('persisted registry contains verifiers, survives restart and supports individual revocation', async t => {
  const c = await setup(t)
  const first = await c.pair()
  const second = await c.pair()
  const content = await readFile(join(c.directory, 'devices.json'), 'utf8')
  assert.ok(!content.includes(first.token))
  assert.ok(!content.includes(second.token))
  await c.gateway.revoke(first.device.id)
  assert.equal((await fetch(c.origin + '/mobile/v1/health', { headers: { authorization: `Bearer ${first.token}` } })).status, 401)
  assert.equal((await fetch(c.origin + '/mobile/v1/health', { headers: { authorization: `Bearer ${second.token}` } })).status, 200)
  const reopened = await createGateway({ upstream: 'http://127.0.0.1:1', username: 'opencode', password: 'secret', storePath: join(c.directory, 'devices.json') })
  t.after(() => reopened.close())
  const url = await reopened.listen()
  assert.equal((await fetch(url + '/mobile/v1/health', { headers: { authorization: `Bearer ${second.token}` } })).status, 200)
})

test('revocation closes an already authenticated live event stream', async t => {
  const c = await setup(t)
  const { token, device } = await c.pair()
  const response = await fetch(c.origin + '/api/session/ses_abc/event?after=0', { headers: { authorization: `Bearer ${token}` } })
  const reader = response.body.getReader()
  assert.ok((await reader.read()).value.length > 0)
  await c.gateway.revoke(device.id)
  const ended = await Promise.race([reader.read().then(r => r.done, () => true), new Promise(resolve => setTimeout(() => resolve(false), 500))])
  assert.equal(ended, true)
})

test('requests with hostile browser origins and oversized bodies are rejected before upstream access', async t => {
  const c = await setup(t)
  const { token } = await c.pair()
  assert.equal((await fetch(c.origin + '/api/session', { headers: { authorization: `Bearer ${token}`, origin: 'https://evil.example' } })).status, 403)
  assert.equal((await fetch(c.origin + '/api/session', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(1_048_577) }) })).status, 413)
  assert.equal(c.seen.length, 0)
})

test('model metadata is projected without provider configuration or secrets', async t => {
  const c = await setup(t)
  const { token } = await c.pair()
  const response = await fetch(c.origin + '/api/model', { headers: { authorization: `Bearer ${token}` } })
  assert.deepEqual(await response.json(), { data: [{ id: 'model_one', providerID: 'provider_one', name: 'Configured model', enabled: true }] })
  assert.equal((await fetch(c.origin + '/api/event', { headers: { authorization: `Bearer ${token}` } })).status, 403)
})

test('working changes derive their directory from the authenticated session, never a caller path', async t => {
  const c = await setup(t)
  const { token } = await c.pair()
  const headers = { authorization: `Bearer ${token}` }
  const result = await fetch(c.origin + '/mobile/v1/session/ses_changes/changes', { headers })
  assert.equal(result.status, 200)
  assert.deepEqual((await result.json()).data.map(v => v.file), ['address.ts'])
  assert.equal(c.seen[1].url, '/vcs/diff?directory=%2Fwork%2Fstorefront&mode=git&context=3')
  assert.equal((await fetch(c.origin + '/mobile/v1/session/ses_changes/changes?directory=/etc', { headers })).status, 403)
})

test('revoking a phone while it uploads a prompt prevents later upstream execution', async t => {
  const c = await setup(t)
  const { token, device } = await c.pair()
  const uploading = request(c.origin + '/api/session/ses_demo/prompt', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } })
  const settled = new Promise(resolve => { uploading.on('error', () => resolve()); uploading.on('response', response => { response.resume(); response.on('end', resolve) }) })
  uploading.write('{')
  await new Promise(resolve => setTimeout(resolve, 30))
  await c.gateway.revoke(device.id)
  uploading.end('"id":"msg_one","prompt":{"text":"do it"}}')
  await settled
  assert.equal(c.seen.length, 0)
})

test('mobile live endpoint projects native events and closes on device revocation', async t => {
  const c = await setup(t)
  const paired = await c.pair()
  const response = await fetch(c.origin + '/mobile/v1/session/ses_one/live', { headers: { authorization: `Bearer ${paired.token}` } })
  assert.equal(response.status, 200)
  const reader = response.body.getReader()
  let result = ''
  while (!result.includes('evt_live')) result += Buffer.from((await reader.read()).value).toString()
  assert.ok(result.includes('Hello'))
  assert.ok(!result.includes('private'))
  assert.ok(!result.includes('hidden'))
  assert.equal(c.seen[0].url, '/api/event')
  await c.gateway.revoke(paired.device.id)
  await assert.rejects(async () => { while (!(await reader.read()).done) {} })
})

 test('Desktop live subscription uses the selected session project directory', async t => {
  const c = await setup(t, { runtime: 'desktop' })
  const paired = await c.pair()
  const response = await fetch(c.origin + '/mobile/v1/session/ses_one/live', { headers: { authorization: `Bearer ${paired.token}` } })
  try {
    assert.equal(response.status, 200)
    assert.deepEqual(c.seen.map(item => item.url), ['/session/ses_one', '/api/event?directory=%2Fwork%2Ffixture+project'])
  } finally { await response.body.cancel() }
})

test('Desktop advertises live history recovery without a native replay journal', async t => {
  const c = await setup(t, { runtime: 'desktop' })
  const paired = await c.pair()
  const response = await fetch(c.origin + '/mobile/v1/health', { headers: { authorization: `Bearer ${paired.token}` } })
  const health = await response.json()
  assert.equal(health.capabilities.replay, false)
  assert.equal(health.capabilities.live, true)
})
