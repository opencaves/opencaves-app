import { onRequest } from 'firebase-functions/v2/https'
import { REGION } from '../../constants.js'

export const api = onRequest({ region: REGION }, (req, res) => {
  res.send('yep!')
})