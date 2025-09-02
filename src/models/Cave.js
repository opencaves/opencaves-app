import { store } from '@/redux/store.js'

export default class Cave {
  static getCaveById(id) {
    const map = store.getState().map

    if (map) {
      return map.data.find(cave => cave.id === id)
    }

    return null
  }
}

export const { getCaveById } = Cave