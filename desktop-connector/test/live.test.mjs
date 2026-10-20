import test from 'node:test'
import assert from 'node:assert/strict'
import { projectEvents } from '../src/live.mjs'

test('live stream selects the conversation and excludes credentials and unrelated activity', async () => {
  async function* source() {
    const events = [
      { id: 'evt_1', type: 'session.next.text.delta', data: { sessionID: 'ses_one', assistantMessageID: 'msg_one', textID: 'txt_one', delta: 'Hi' } },
      { id: 'evt_2', type: 'session.next.text.delta', data: { sessionID: 'ses_other', delta: 'private' } },
      { id: 'evt_3', type: 'provider.updated', data: { sessionID: 'ses_one', key: 'secret' } },
      { id: 'evt_4', type: 'permission.v2.asked', data: { sessionID: 'ses_one', id: 'per_one' } },
    ]
    const bytes = Buffer.from(events.map(event => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''))
    yield bytes.subarray(0, 15); yield bytes.subarray(15)
  }
  const events = []
  for await (const event of projectEvents(source(), 'ses_one')) events.push(event)
  assert.deepEqual(events.map(event => event.id), ['evt_1', 'evt_4'])
  assert.equal(JSON.stringify(events).includes('secret'), false)
})
test('live stream bounds unterminated frames', async () => {
  async function* source() { yield Buffer.alloc(1_048_577, 97) }
  await assert.rejects(async () => { for await (const _ of projectEvents(source(), 'ses_one')) {} }, /too large/)
})
