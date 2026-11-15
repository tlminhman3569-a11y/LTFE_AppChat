import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice.ts'
import conversationsReducer from './slices/conversationsSlice.ts'
import presenceReducer from './slices/presenceSlice.ts'
import messagesReducer from './slices/messagesSlice.ts'

export const store = configureStore({
    reducer: {
        auth: authReducer,
        conversations: conversationsReducer,
        presence: presenceReducer,
        messages: messagesReducer,
    },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
