import { store } from '@/redux/store.jsx'

export default class Cave {
  static getCaveById(id) {
    // state.map.data is deliberately filtered to caves with a location (it
    // only exists to back map markers) - a plain lookup-by-id needs to see
    // every cave, including ones with no GPS coordinates yet.
    return store.getState().data.caves.find(cave => cave.id === id) || null
  }
}

export const { getCaveById } = Cave