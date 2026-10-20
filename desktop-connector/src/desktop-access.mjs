import { join } from 'node:path'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import QRCode from 'qrcode'
import { createGateway } from './gateway.mjs'
import { connectTunnel } from './tunnel.mjs'
import { openDevices } from './devices.mjs'

export async function createMobileAccess(options) {
  const root = join(options.userDataPath, 'mobile-access')
  await mkdir(root, { recursive: true, mode: 0o700 })
  const storePath = join(root, 'devices.json')
  const initial = await openDevices(storePath)
  let gateway, tunnel, pairing, qrImage, errorKey, starting, epoch = 0
  let devices = initial.list(), requests = []
  let enabled = false
  const flagPath = join(root, 'enabled.json')
  const persist = async value => { await writeFile(flagPath + '.tmp', JSON.stringify({ enabled: value }), { mode: 0o600 }); await rename(flagPath + '.tmp', flagPath) }
  const snapshot = () => ({ enabled, connecting: !!starting, devices: devices.map(d => ({ ...d })), requests: requests.map(r => ({ ...r })), pairing, qrImage, errorKey })
  const emit = () => options.onChange?.(snapshot())
  async function enable() {
    if (enabled) return
    if (starting) return starting
    const token = ++epoch
    starting = (async () => {
      errorKey = undefined; emit()
      const connection = options.getConnection()
      if (!connection?.password) throw new Error('Protected local Desktop sidecar required')
      gateway = await createGateway({ upstream: connection.url, username: connection.username ?? 'opencode', password: connection.password, storePath, onPairingRequest: claim => { requests.push(claim); emit() } })
      try {
        const target = await gateway.listen()
        tunnel = await (options.tunnelFactory ?? connectTunnel)({ target, storePath: join(root, 'tunnel') })
        enabled = true; await persist(true)
        void (async () => {
          try { for await (const event of tunnel.events) { if (token !== epoch) break; errorKey = event.type === 'disconnected' || event.type === 'reconnecting' ? 'mobile.error.reconnecting' : undefined; emit() } }
          catch { if (token === epoch) { errorKey = 'mobile.error.connection'; emit() } }
        })()
      } catch (error) { await gateway.close(); gateway = undefined; throw error }
    })()
    try { await starting } catch (error) { errorKey = 'mobile.error.connection'; throw error } finally { starting = undefined; emit() }
  }
  async function disable() {
    ++epoch
    if (starting) { try { await starting } catch {} }
    await gateway?.close(); await tunnel?.close()
    gateway = undefined; tunnel = undefined; enabled = false; pairing = undefined; qrImage = undefined; requests = []
    devices = (await openDevices(storePath)).list()
    await persist(false); emit()
  }
  async function run(input) {
    if (!input || typeof input.type !== 'string' || (input.id !== undefined && (typeof input.id !== 'string' || input.id.length > 100))) throw new Error('Invalid mobile action')
    if (input.type === 'state') {
      requests = requests.filter(r => r.expiresAt > Date.now())
      if (gateway) devices = gateway.devices()
      return snapshot()
    }
    if (input.type === 'pair') {
      await enable()
      pairing = JSON.stringify(gateway.issuePairing(tunnel.origin))
      qrImage = await QRCode.toDataURL(pairing, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
    } else if (input.type === 'disable') { await disable() }
    else if (input.type === 'approve') { if (!gateway) throw new Error('Remote access disabled'); await gateway.approve(input.id); requests = requests.filter(r => r.claimID !== input.id) }
    else if (input.type === 'decline') { gateway?.decline(input.id); requests = requests.filter(r => r.claimID !== input.id) }
    else if (input.type === 'revoke') {
      if (gateway) await gateway.revoke(input.id)
      else { const registry = await openDevices(storePath); await registry.remove(input.id); devices = registry.list() }
    } else { throw new Error('Unknown mobile action') }
    if (gateway) devices = gateway.devices()
    emit(); return snapshot()
  }
  let actions = Promise.resolve()
  return {
    snapshot,
    action(input) { const operation = actions.then(() => run(input)); actions = operation.catch(() => {}); return operation },
    async restore() { try { if (JSON.parse(await readFile(flagPath, 'utf8')).enabled === true) await enable() } catch (error) { if (error.code !== 'ENOENT') { errorKey = 'mobile.error.connection'; emit() } } },
    async close() { ++epoch; if (starting) { try { await starting } catch {} } await gateway?.close(); await tunnel?.close(); gateway = undefined; tunnel = undefined; enabled = false },
  }
}
