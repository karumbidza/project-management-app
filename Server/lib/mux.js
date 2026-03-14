// FOLLO MEDIA
// Mux client — video encoding, thumbnails, and HLS streaming
// All video uploads go through Mux (not R2) for proper encoding

import Mux from "@mux/mux-node";

// ─── Config from environment ───────────────────────────────────────────────
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || "http://localhost:5173";

// ─── Validate config on startup ────────────────────────────────────────────
const isConfigured = MUX_TOKEN_ID && MUX_TOKEN_SECRET;

if (!isConfigured) {
  console.warn("[Mux] Missing configuration - video uploads will be disabled");
}

// ─── Mux client ────────────────────────────────────────────────────────────
let mux = null;
if (isConfigured) {
  mux = new Mux({
    tokenId: MUX_TOKEN_ID,
    tokenSecret: MUX_TOKEN_SECRET,
  });
}

// ─── Create a Mux direct upload URL ────────────────────────────────────────
// Use this instead of R2 for videos. Mux handles encoding + CDN delivery.
// @returns {{ uploadUrl, uploadId }}
export async function createMuxUpload() {
  if (!mux) {
    throw new Error("Mux is not configured");
  }

  const upload = await mux.video.uploads.create({
    cors_origin: APP_URL,
    new_asset_settings: {
      playback_policy: ["public"],
      mp4_support: "standard", // Enable MP4 download fallback
    },
  });

  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
  };
}

// ─── Get Mux asset details after upload ────────────────────────────────────
// Poll this after upload completes to get playback ID + thumbnail
// @param {string} uploadId — from createMuxUpload()
// @returns {{ assetId, playbackId, thumbnailUrl, duration, status }}
export async function getMuxAsset(uploadId) {
  if (!mux) {
    throw new Error("Mux is not configured");
  }

  const upload = await mux.video.uploads.retrieve(uploadId);

  // Upload not yet associated with an asset
  if (!upload.asset_id) {
    return { status: "waiting" };
  }

  const asset = await mux.video.assets.retrieve(upload.asset_id);
  const playbackId = asset.playback_ids?.[0]?.id;

  return {
    assetId: asset.id,
    playbackId,
    thumbnailUrl: playbackId
      ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`
      : null,
    duration: asset.duration ?? null, // seconds
    status: asset.status, // "preparing" | "ready" | "errored"
  };
}

// ─── Delete a Mux asset ────────────────────────────────────────────────────
export async function deleteMuxAsset(assetId) {
  if (!mux) {
    throw new Error("Mux is not configured");
  }

  await mux.video.assets.delete(assetId);
}

// ─── Build URLs from playback ID ───────────────────────────────────────────
export function getMuxStreamUrl(playbackId) {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export function getMuxThumbnailUrl(playbackId, time = 0) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}`;
}

// ─── Check if Mux is configured ────────────────────────────────────────────
export function isMuxConfigured() {
  return isConfigured;
}
