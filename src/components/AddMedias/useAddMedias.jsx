import { useContext } from 'react'
import { AddMediasContext } from './AddMediasContext.js'

export function useAddMedias() {
  return useContext(AddMediasContext)
}