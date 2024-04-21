import { collection, query, where, getDocs, getDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'

const RATINGS_COLL_NAME = 'ratings'
const COLL = collection(db, RATINGS_COLL_NAME)

export default class Rating {

  static async getByCaveId(caveId) {
    return new Promise(async (resolve, reject) => {
      try {
        const rating = new Rating(caveId)
        const q = query(COLL, where('caveId', '==', caveId))
        const snapshot = await getDocs(q)

        if (snapshot.empty) {
          rating.value = null
          return resolve(rating)
        }

        let sum = 0
        snapshot.forEach(doc => {
          const data = doc.data()
          sum += data.value
        })

        rating.value = sum / snapshot.size

        resolve(rating)

      } catch (error) {
        reject(error)
      }
    })
  }

  constructor(caveId, value = null) {
    this.caveId = caveId
    this.value = value
  }
}

export const getByCaveId = Rating.getByCaveId