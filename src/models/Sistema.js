import { store } from '@/redux/store.jsx'

export function getSistemaById(id) {
  return store.getState().data.sistemas.find(sistema => sistema.id === id)
}