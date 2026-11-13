import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import conversationsReducer from './slices/conversationsSlice'

export const store = configureStore({
    reducer: {
        auth: authReducer,
        conversations: conversationsReducer,
    },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
