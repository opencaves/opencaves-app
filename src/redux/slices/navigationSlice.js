import { createSlice } from "@reduxjs/toolkit"

const initialState = {
  title: 'Open Caves'
}

const navigationSlice = createSlice({
  name: 'navigationSlice',
  initialState,
  reducers: {
    setTitle: (state, action) => {
      state.title = action.payload
    }
  }
})

export const { setTitle } = navigationSlice.actions
export default navigationSlice.reducer