import { create, OpenTunnelStorage } from '@opentunnel/client'
import { mkdir } from 'node:fs/promises'
import { tunnelOrigin } from './policy.mjs'

// Only called after the user enables remote access in Desktop.
export async function connectTunnel({ target, storePath, signal }) {
  const url = new URL(target)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port) throw new Error('Gateway must listen on loopback')
  await mkdir(storePath, { recursive: true, mode: 0o700 })
  const client = create({ store: OpenTunnelStorage.xdg({ env: { ...process.env, XDG_DATA_HOME: storePath } }) })
  try {
    const connection = await client.tunnel.connect({ profile: 'bharatcode-mobile', routes: { '@': `${url.hostname}:${url.port}` }, signal })
    return { origin: tunnelOrigin(`https://${connection.tunnel.hostname}`), events: connection.events, close: async () => { await connection.close(); await client.dispose() } }
  } catch (error) { await client.dispose(); throw error }
}
