// Rank titles earned by hold time. Displayed on results, share text and cards.
const TITLES = [
  [10_000, 'Tourist'],
  [30_000, 'Curious Passer-by'],
  [60_000, 'Amateur Thumb'],
  [120_000, 'Enthusiast'],
  [180_000, 'Committed. Worryingly.'],
  [300_000, 'Regional Finalist'],
  [600_000, 'Semi-Professional Holder'],
  [900_000, 'Button Whisperer'],
  [1_800_000, 'National Treasure'],
]

export function timeToTitle(ms) {
  for (const [limit, title] of TITLES) {
    if (ms < limit) return title
  }
  return 'Seek Help'
}
