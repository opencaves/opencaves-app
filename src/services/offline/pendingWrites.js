// Edits saved but not yet confirmed by the server (useSettleWrite) - offline,
// those waiting to sync. Counted so "back online" can say whether there are
// changes syncing.
let count = 0

export function trackWrite(write) {
  count += 1
  const done = () => {
    count -= 1
  }
  write.then(done, done)
  return write
}

export const pendingWriteCount = () => count
