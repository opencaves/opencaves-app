import { createContext } from 'react'

// On its own: in AddMediasProvider.jsx, an edit to anything it imports
// recreated the context on hot reload, leaving the provider on the page with
// the old one - useAddMedias() then got null ("Cannot destructure property
// 'promptForMedias'"). Never edited, this module is never reloaded.
export const AddMediasContext = createContext(null)
