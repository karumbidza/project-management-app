// FOLLO SRP
import { configureStore } from '@reduxjs/toolkit'
import workspaceReducer from '../features/workspaceSlice'
import taskReducer from '../features/taskSlice'
import commentReducer from '../features/commentSlice'
import slaReducer from '../features/slaSlice'
import themeReducer from '../features/themeSlice'
import notificationReducer from '../features/notificationSlice'

export const store = configureStore({
    reducer: {
        workspace: workspaceReducer,
        task: taskReducer,
        comment: commentReducer,
        sla: slaReducer,
        theme: themeReducer,
        notifications: notificationReducer,
    },
})