import { fmtTime } from './format.js'

// Renders a shareable score card as a PNG blob. The sponsor plate is baked
// into the image so shared screenshots always carry the brand.
export function makeShareCard({ ms, rank, title, reason }) {
  const W = 1080
  const H = 1350
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  const font = (px, weight = 900) =>
    `${weight} ${px}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`

  ctx.fillStyle = '#111014'
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'

  ctx.fillStyle = '#ff5a36'
  ctx.font = font(44)
  ctx.fillText('H O L D   T H E   B U T T O N', W / 2, 130)

  ctx.fillStyle = '#9b95a3'
  ctx.font = font(40, 600)
  ctx.fillText('I held the button for', W / 2, 330)

  ctx.fillStyle = '#f5f2ec'
  ctx.font = font(190)
  ctx.fillText(fmtTime(ms), W / 2, 510)

  ctx.fillStyle = '#ff5a36'
  ctx.font = font(52)
  ctx.fillText(`"${title}"`, W / 2, 610)

  ctx.fillStyle = '#9b95a3'
  ctx.font = font(40, 600)
  if (rank) ctx.fillText(`Rank #${rank} in the world`, W / 2, 690)
  ctx.fillText(
    reason === 'focus' ? 'Cause of death: looked away' : 'Cause of death: let go',
    W / 2, rank ? 750 : 690
  )

  ctx.fillStyle = '#f5f2ec'
  ctx.font = font(38, 700)
  ctx.fillText('Think you can beat it? Free to play:', W / 2, 890)
  ctx.fillStyle = '#ff5a36'
  ctx.font = font(42)
  ctx.fillText(window.location.origin.replace(/^https?:\/\//, ''), W / 2, 950)

  // Sponsor plate
  const px = 90, py = 1030, pw = W - 180, ph = 220, r = 28
  ctx.beginPath()
  ctx.moveTo(px + r, py)
  ctx.arcTo(px + pw, py, px + pw, py + ph, r)
  ctx.arcTo(px + pw, py + ph, px, py + ph, r)
  ctx.arcTo(px, py + ph, px, py, r)
  ctx.arcTo(px, py, px + pw, py, r)
  ctx.closePath()
  ctx.fillStyle = '#1c1a21'
  ctx.fill()
  ctx.strokeStyle = '#ff5a36'
  ctx.lineWidth = 5
  ctx.stroke()

  ctx.fillStyle = '#9b95a3'
  ctx.font = font(28, 700)
  ctx.fillText('S P O N S O R E D   B Y', W / 2, py + 62)
  ctx.fillStyle = '#f5f2ec'
  ctx.font = font(56)
  ctx.fillText('Rifkin & Livesey', W / 2, py + 128)
  ctx.fillStyle = '#9b95a3'
  ctx.font = font(28, 600)
  ctx.fillText('Commercial, Industrial & Product Photography', W / 2, py + 168)
  ctx.fillStyle = '#ff5a36'
  ctx.font = font(30, 800)
  ctx.fillText('rifkinandlivesey.co.uk', W / 2, py + 206)

  return new Promise(resolve => c.toBlob(resolve, 'image/png'))
}
