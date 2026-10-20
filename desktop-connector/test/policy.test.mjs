import test from 'node:test'
import assert from 'node:assert/strict'
import { allowed } from '../src/policy.mjs'

test('project directory query encoding is allowed without allowing encoded API path traversal', () => {
  for (const directory of ['/work/fixture project', 'C:\\Projects\\Mobile']) {
    const query = new URLSearchParams({ 'location[directory]': directory })
    assert.equal(allowed('GET', '/api/question/request?' + query), true)
    assert.equal(allowed('GET', '/api/permission/request?' + query), true)
  }
  for (const path of ['/api/session/ses_one%2Fmessage', '/api/session/%2e%2e/model', '/api/session/ses_one%5cmessage']) {
    assert.equal(allowed('GET', path), false)
  }
  assert.equal(allowed('GET', '/api/question/request?location%5Bdirectory%5D=%00'), false)
  assert.equal(allowed('GET', '/api/question/request?unexpected=%2Fwork'), false)
})
