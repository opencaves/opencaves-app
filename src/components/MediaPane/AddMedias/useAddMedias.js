import { useContext } from 'react'
import { AddMediasContext } from './AddMediasProvider'

export function useAddMedias() {
  return useContext(AddMediasContext)
}