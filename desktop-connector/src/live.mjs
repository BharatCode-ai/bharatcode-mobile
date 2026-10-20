import { StringDecoder } from 'node:string_decoder'

// Never forward the global sidecar event bus. Project only the selected
// conversation's text and invalidation signals; configuration stays local.
export async function* projectEvents(source, sessionID) {
  const decoder = new StringDecoder('utf8')
  let buffer = ''
  for await (const chunk of source) {
    buffer += decoder.write(chunk)
    let match
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      if (match.index > 1_048_576) throw new Error('Event frame too large')
      const frame = buffer.slice(0, match.index)
      buffer = buffer.slice(match.index + match[0].length)
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n')
      if (!data) continue
      let event
      try { event = JSON.parse(data) } catch { continue }
      if (event.data?.sessionID !== sessionID) continue
      const text = /^session\.next\.text\.(started|delta|ended)$/.test(event.type)
      const invalidation = /^(permission\.v2\.(asked|replied)|question\.v2\.(asked|replied|rejected)|session\.next\.(step\.(started|ended|failed)|tool\.(called|progress|success|failed)))$/.test(event.type)
      if (!text && !invalidation) continue
      const fields = text ? ['sessionID', 'assistantMessageID', 'textID', 'delta', 'text'] : ['sessionID', 'requestID', 'id']
      yield { id: event.id, type: event.type, data: Object.fromEntries(fields.filter(key => Object.hasOwn(event.data, key)).map(key => [key, event.data[key]])) }
    }
    if (buffer.length > 1_048_576) throw new Error('Event frame too large')
  }
}
