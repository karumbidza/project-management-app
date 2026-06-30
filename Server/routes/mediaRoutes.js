// FOLLO MEDIA
// Media upload routes — signed URLs for direct-to-cloud uploads
// POST /api/v1/media/sign          → R2 signed URL (images, audio, files)
// POST /api/v1/media/sign/video    → Mux upload URL (video)
// GET  /api/v1/media/video/:uploadId → Poll video processing status
// DELETE /api/v1/media/:fileKey    → Delete a file

import express from "express";
import { createSignedUploadUrl, deleteMediaFile, MEDIA_CONFIG, isR2Configured } from "../lib/r2.js";
import { createMuxUpload, getMuxAsset, deleteMuxAsset, isMuxConfigured, getPlaybackInfo } from "../lib/mux.js";
import { asyncHandler, ValidationError, AuthorizationError } from "../utils/errors.js";
import { sendSuccess, sendCreated } from "../utils/response.js";
import prisma from "../configs/prisma.js";
import { requireProjectAccess } from "../utils/permissions.js";
import { PROJECT_ROLES } from "../utils/constants.js";
import { mediaLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// FOLLO SECURITY — only the uploader of the media (the comment author) or a
// project manager/owner may delete it. Looks up the owning comment by its R2
// fileKey or Mux assetId and enforces access on the parent project.
async function assertMediaDeletePermission(userId, { fileKey, assetId }) {
  const comment = await prisma.comment.findFirst({
    where: assetId ? { muxAssetId: assetId } : { fileKey },
    select: { userId: true, task: { select: { projectId: true } } },
  });

  // No comment references this media — refuse rather than allow blind deletes.
  if (!comment) {
    throw new AuthorizationError("Media not found or you do not have permission to delete it");
  }

  if (comment.userId === userId) return;

  const access = await requireProjectAccess(userId, comment.task.projectId);
  const managerRoles = [PROJECT_ROLES.OWNER, PROJECT_ROLES.MANAGER];
  if (!managerRoles.includes(access.role)) {
    throw new AuthorizationError("Only the uploader or a project manager can delete this media");
  }
}

// ─── POST /api/v1/media/sign ───────────────────────────────────────────────
// Get a signed R2 upload URL for images, audio, or files
// Body: { mediaType, mimeType, sizeBytes }
// Response: { uploadUrl, fileKey, cdnUrl }
router.post(
  "/sign",
  mediaLimiter,
  asyncHandler(async (req, res) => {
    const { mediaType, mimeType, sizeBytes, projectId } = req.body;

    // Validate required fields
    if (!mediaType || !mimeType || !sizeBytes) {
      throw new ValidationError(
        "Missing required fields: mediaType, mimeType, sizeBytes"
      );
    }

    // Object-level authz: only mint an upload URL for a project the caller can
    // access (prevents any authed user minting unlimited presigned PUTs).
    if (!projectId) {
      throw new ValidationError("projectId is required");
    }
    await requireProjectAccess(req.userId, projectId);

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
  mediaLimiter,
  asyncHandler(async (req, res) => {
    const { projectId } = req.body || {};

    // Object-level authz: only mint a Mux upload for a project the caller can access.
    if (!projectId) {
      throw new ValidationError("projectId is required");
    }
    await requireProjectAccess(req.userId, projectId);

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
// FOLLO SECURITY — ownership is enforced: only the uploader or a project
// manager/owner of the media's parent task may delete it.
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
      await assertMediaDeletePermission(req.userId, { assetId });
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

    await assertMediaDeletePermission(req.userId, { fileKey });
    await deleteMediaFile(fileKey);

    sendSuccess(res, { deleted: true, type: "file", fileKey });
  })
);

// ─── GET /api/v1/media/playback/:playbackId ────────────────────────────────
// Mint ready-to-play (public or short-lived signed) Mux URLs at VIEW time.
// Authz: the playback ID must belong to a comment whose parent project the
// caller can access — so signed media can't be streamed cross-tenant.
router.get(
  "/playback/:playbackId",
  asyncHandler(async (req, res) => {
    const { playbackId } = req.params;
    if (!playbackId) throw new ValidationError("playbackId is required");

    const comment = await prisma.comment.findFirst({
      where: { muxPlaybackId: playbackId },
      select: { task: { select: { projectId: true } } },
    });
    if (!comment?.task?.projectId) {
      throw new AuthorizationError("Media not found or you do not have permission to view it");
    }
    await requireProjectAccess(req.userId, comment.task.projectId);

    const info = await getPlaybackInfo(playbackId);
    sendSuccess(res, info);
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
