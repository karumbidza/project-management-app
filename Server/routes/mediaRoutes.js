// FOLLO MEDIA
// Media upload routes — signed URLs for direct-to-cloud uploads
// POST /api/v1/media/sign          → R2 signed URL (images, audio, files)
// POST /api/v1/media/sign/video    → Mux upload URL (video)
// GET  /api/v1/media/video/:uploadId → Poll video processing status
// DELETE /api/v1/media/:fileKey    → Delete a file

import express from "express";
import { createSignedUploadUrl, deleteMediaFile, MEDIA_CONFIG, isR2Configured } from "../lib/r2.js";
import { createMuxUpload, getMuxAsset, deleteMuxAsset, isMuxConfigured } from "../lib/mux.js";
import { asyncHandler, ValidationError } from "../utils/errors.js";
import { sendSuccess, sendCreated } from "../utils/response.js";

const router = express.Router();

// ─── POST /api/v1/media/sign ───────────────────────────────────────────────
// Get a signed R2 upload URL for images, audio, or files
// Body: { mediaType, mimeType, sizeBytes }
// Response: { uploadUrl, fileKey, cdnUrl }
router.post(
  "/sign",
  asyncHandler(async (req, res) => {
    const { mediaType, mimeType, sizeBytes } = req.body;

    // Validate required fields
    if (!mediaType || !mimeType || !sizeBytes) {
      throw new ValidationError(
        "Missing required fields: mediaType, mimeType, sizeBytes"
      );
    }

    // Block video — use /sign/video instead (Mux handles encoding)
    if (mediaType === "video") {
      throw new ValidationError("Use /api/v1/media/sign/video for video uploads");
    }

    // Validate media type
    if (!MEDIA_CONFIG[mediaType]) {
      throw new ValidationError(
        `Invalid mediaType. Allowed: ${Object.keys(MEDIA_CONFIG).join(", ")}`
      );
    }

    // Check R2 is configured
    if (!isR2Configured()) {
      throw new ValidationError("Media uploads are not configured on this server");
    }

    const result = await createSignedUploadUrl(mediaType, mimeType, sizeBytes);

    sendSuccess(res, result);
  })
);

// ─── POST /api/v1/media/sign/video ─────────────────────────────────────────
// Get a Mux direct upload URL for video
// Body: (none)
// Response: { uploadUrl, uploadId }
router.post(
  "/sign/video",
  asyncHandler(async (req, res) => {
    // Check Mux is configured
    if (!isMuxConfigured()) {
      throw new ValidationError("Video uploads are not configured on this server");
    }

    const result = await createMuxUpload();

    sendCreated(res, result, "Video upload URL created");
  })
);

// ─── GET /api/v1/media/video/:uploadId ─────────────────────────────────────
// Poll video processing status after upload
// Response: { status, playbackId, thumbnailUrl, duration, assetId }
router.get(
  "/video/:uploadId",
  asyncHandler(async (req, res) => {
    const { uploadId } = req.params;

    if (!uploadId) {
      throw new ValidationError("Upload ID is required");
    }

    if (!isMuxConfigured()) {
      throw new ValidationError("Video service is not configured");
    }

    const result = await getMuxAsset(uploadId);

    sendSuccess(res, result);
  })
);

// ─── DELETE /api/v1/media/:fileKey ─────────────────────────────────────────
// Delete a file from R2 or Mux
// Body: { assetId? } — only for video (Mux)
// Note: Caller should verify ownership before calling this
router.delete(
  "/:fileKey",
  asyncHandler(async (req, res) => {
    const { fileKey } = req.params;
    const { assetId } = req.body || {};

    // If assetId is provided, delete from Mux (video)
    if (assetId) {
      if (!isMuxConfigured()) {
        throw new ValidationError("Video service is not configured");
      }
      await deleteMuxAsset(assetId);
      return sendSuccess(res, { deleted: true, type: "video" });
    }

    // Otherwise, delete from R2
    if (!fileKey) {
      throw new ValidationError("File key is required");
    }

    if (!isR2Configured()) {
      throw new ValidationError("Media storage is not configured");
    }

    await deleteMediaFile(fileKey);

    sendSuccess(res, { deleted: true, type: "file", fileKey });
  })
);

// ─── GET /api/v1/media/config ──────────────────────────────────────────────
// Get media configuration (limits, supported types)
// Response: { image: { maxBytes, mimeTypes }, ... }
router.get(
  "/config",
  asyncHandler(async (req, res) => {
    // Return sanitized config (no sensitive data)
    const config = {
      image: {
        maxBytes: MEDIA_CONFIG.image.maxBytes,
        maxMB: MEDIA_CONFIG.image.maxBytes / 1024 / 1024,
        mimeTypes: MEDIA_CONFIG.image.mimeTypes,
      },
      video: {
        maxBytes: MEDIA_CONFIG.video.maxBytes,
        maxMB: MEDIA_CONFIG.video.maxBytes / 1024 / 1024,
        mimeTypes: MEDIA_CONFIG.video.mimeTypes,
      },
      audio: {
        maxBytes: MEDIA_CONFIG.audio.maxBytes,
        maxMB: MEDIA_CONFIG.audio.maxBytes / 1024 / 1024,
        mimeTypes: MEDIA_CONFIG.audio.mimeTypes,
      },
      file: {
        maxBytes: MEDIA_CONFIG.file.maxBytes,
        maxMB: MEDIA_CONFIG.file.maxBytes / 1024 / 1024,
        mimeTypes: [], // any
      },
      enabled: {
        r2: isR2Configured(),
        mux: isMuxConfigured(),
      },
    };

    sendSuccess(res, config);
  })
);

export default router;
