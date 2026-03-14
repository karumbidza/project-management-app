// FOLLO SRP
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { apiCall, API_V1 } from "./apiHelper";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMENT THUNKS (FOLLO MEDIA)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const addCommentAsync = createAsyncThunk(
    'comment/addComment',
    async ({ taskId, getToken, content, type, url, fileKey, thumbnailUrl, duration, sizeBytes, fileName, muxUploadId, muxAssetId, muxPlaybackId }, { rejectWithValue }) => {
        try {
            // Build comment data - supports both text and media comments
            const commentData = { content, type };
            
            // Add media fields if present
            if (url) commentData.url = url;
            if (fileKey) commentData.fileKey = fileKey;
            if (thumbnailUrl) commentData.thumbnailUrl = thumbnailUrl;
            if (duration !== undefined) commentData.duration = duration;
            if (sizeBytes !== undefined) commentData.sizeBytes = sizeBytes;
            if (fileName) commentData.fileName = fileName;
            if (muxUploadId) commentData.muxUploadId = muxUploadId;
            if (muxAssetId) commentData.muxAssetId = muxAssetId;
            if (muxPlaybackId) commentData.muxPlaybackId = muxPlaybackId;

            const result = await apiCall(`${API_V1}/tasks/${taskId}/comments`, {
                method: 'POST',
                body: JSON.stringify(commentData),
            }, getToken);
            
            // Defensive: handle both direct data and double-wrapped { data, statusCode } from legacy sendCreated
            const comment = (result.data && result.data.id) ? result.data : result.data?.data || result.data;
            return { taskId, comment };
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SLICE (minimal — comment loading tracked in workspace slice)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const commentSlice = createSlice({
    name: "comment",
    initialState: {},
    reducers: {},
});

export default commentSlice.reducer;
