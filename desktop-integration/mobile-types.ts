export type MobileAction = { type: "state" | "pair" | "disable" | "approve" | "decline" | "revoke"; id?: string }
export type MobileState = {
  enabled: boolean
  connecting: boolean
  devices: { id: string; name: string; pairedAt: number }[]
  requests: { claimID: string; name: string; confirmation: string; expiresAt: number }[]
  pairing?: string
  qrImage?: string
  errorKey?: string
}
