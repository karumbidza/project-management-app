// FOLLO MEDIA
// Cloudflare R2 client — S3-compatible storage, zero egress fees
// Users upload directly to R2 via signed URLs (server never handles file bytes)

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// ─── Config from environment ───────────────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET_NAME || "task-media";
const CDN_URL = process.env.CDN_URL || process.env.R2_PUBLIC_URL;

// ─── Validate config on startup ────────────────────────────────────────────
const isConfigured = R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY;

if (!isConfigured) {
  console.warn("[R2] Missing configuration - media uploads will be disabled");
}

// ─── S3 Client (R2 is S3-compatible) ───────────────────────────────────────
export const r2 = isConfigured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    })
  : null;

// ─── Media type configuration ──────────────────────────────────────────────
export const MEDIA_CONFIG = Object.freeze({
  image: {
    maxBytes: 10 * 1024 * 1024, // 10MB
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    folder: "images",
  },
  video: {
    maxBytes: 200 * 1024 * 1024, // 200MB
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    folder: "videos",
  },
  audio: {
    maxBytes: 50 * 1024 * 1024, // 50MB
    mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4"],
    folder: "audio",
  },
  file: {
    maxBytes: 50 * 1024 * 1024, // 50MB
    mimeTypes: [], // any type allowed
    folder: "files",
  },
});

// ─── Generate a signed upload URL ──────────────────────────────────────────
// Client uploads directly to R2 — server never touches the file bytes
// @param {string} mediaType  — "image" | "audio" | "file" (NOT video - use Mux)
// @param {string} mimeType   — e.g. "image/jpeg"
// @param {number} sizeBytes  — file size in bytes
// @returns {{ uploadUrl, fileKey, cdnUrl }}
export async function createSignedUploadUrl(mediaType, mimeType, sizeBytes) {
  if (!r2) {
    throw new Error("R2 storage is not configured");
  }

  const config = MEDIA_CONFIG[mediaType];
  if (!config) {
    throw new Error(`Unknown media type: ${mediaType}`);
  }

  // Validate size
  if (sizeBytes > config.maxBytes) {
    const maxMB = config.maxBytes / 1024 / 1024;
    throw new Error(`File too large. Max size for ${mediaType} is ${maxMB}MB`);
  }

  // Validate mime type (skip for "file" type which allows any)
  if (config.mimeTypes.length > 0 && !config.mimeTypes.includes(mimeType)) {
    throw new Error(`Invalid file type: ${mimeType}. Allowed: ${config.mimeTypes.join(", ")}`);
  }

  // Build a unique storage key with extension
  const ext = getExtensionFromMime(mimeType);
  const fileKey = `${config.folder}/${uuidv4()}.${ext}`;

  // Create presigned PUT URL (expires in 5 minutes)
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: fileKey,
    ContentType: mimeType,
    ContentLength: sizeBytes,
  });

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
  const cdnUrl = CDN_URL ? `${CDN_URL}/${fileKey}` : uploadUrl.split("?")[0];

  return { uploadUrl, fileKey, cdnUrl };
}

// ─── Delete a file from R2 ─────────────────────────────────────────────────
export async function deleteMediaFile(fileKey) {
  if (!r2) {
    throw new Error("R2 storage is not configured");
  }

  await r2.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: fileKey,
    })
  );
}

// ─── Helper: Get file extension from MIME type ─────────────────────────────
function getExtensionFromMime(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "application/pdf": "pdf",
  };

  return map[mimeType] || mimeType.split("/")[1] || "bin";
}

// ─── Check if R2 is configured ─────────────────────────────────────────────
export function isR2Configured() {
  return isConfigured;
}
