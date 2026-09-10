import { useContext } from 'react'
import { AddMediasContext } from './AddMediasProvider.jsx'

export function useAddMedias() {
  return useContext(AddMediasContext)
}