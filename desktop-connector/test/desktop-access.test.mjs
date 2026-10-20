import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createMobileAccess } from '../src/desktop-access.mjs'

test('Desktop starts no tunnel until enabled, and disabling closes both resources', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bc-access-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  let connects = 0, closes = 0
  const access = await createMobileAccess({
    userDataPath: directory,
    getConnection: () => ({ url: 'http://127.0.0.1:4096', username: 'opencode', password: 'private' }),
    tunnelFactory: async () => { connects++; return { origin: 'https://unit.opentunnel.xyz', close: async () => { closes++ }, events: (async function* () {})() } },
  })
  t.after(() => access.close())
  await access.restore()
  assert.equal(access.snapshot().errorKey, undefined)
  assert.equal(connects, 0)
  await access.action({ type: 'pair' })
  assert.equal(connects, 1)
  assert.ok(access.snapshot().qrImage.startsWith('data:image/png;base64,'))
  assert.equal(JSON.parse(access.snapshot().pairing).v, 1)
  await access.action({ type: 'disable' })
  assert.equal(closes, 1)
  assert.equal(access.snapshot().enabled, false)
  assert.equal(access.snapshot().pairing, undefined)
  await assert.rejects(access.action({ type: 'approve', id: 'unknown' }))
})

test('Desktop refuses a remote or unprotected sidecar without creating a tunnel', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bc-access-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const access = await createMobileAccess({ userDataPath: directory, getConnection: () => ({ url: 'https://other.example', password: '' }), tunnelFactory: () => { throw new Error('must not connect') } })
  t.after(() => access.close())
  await assert.rejects(access.action({ type: 'pair' }))
  assert.equal(access.snapshot().enabled, false)
})
