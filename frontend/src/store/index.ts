import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import conversationsReducer from './slices/conversationsSlice'
import presenceReducer from './slices/presenceSlice'
import messagesReducer from './slices/messagesSlice'

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
