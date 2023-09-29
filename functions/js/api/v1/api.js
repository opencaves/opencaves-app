import { onRequest } from 'firebase-functions/v2/https'

export const api = onRequest({ region: 'northamerica-northeast1' }, (req, res) => {
  res.send('yep!')
})