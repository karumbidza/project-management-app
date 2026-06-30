// FOLLO MEDIA
// Mux client — video encoding, thumbnails, and HLS streaming
// All video uploads go through Mux (not R2) for proper encoding

import Mux from "@mux/mux-node";

// ─── Config from environment ───────────────────────────────────────────────
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID;
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET;
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || "http://localhost:5173";

// Signing keys for *signed* playback. When present, uploaded videos use a
// `signed` playback policy and can only be streamed with a short-lived token —
// so a leaked playback ID alone can't be streamed/downloaded cross-tenant.
const MUX_SIGNING_KEY_ID = process.env.MUX_SIGNING_KEY_ID;
const MUX_SIGNING_KEY_PRIVATE = process.env.MUX_SIGNING_KEY_PRIVATE; // base64 PEM

// ─── Validate config on startup ────────────────────────────────────────────
const isConfigured = MUX_TOKEN_ID && MUX_TOKEN_SECRET;
const signingConfigured = !!(MUX_SIGNING_KEY_ID && MUX_SIGNING_KEY_PRIVATE);

if (!isConfigured) {
  console.warn("[Mux] Missing configuration - video uploads will be disabled");
} else if (!signingConfigured) {
  console.warn(
    "[Mux] MUX_SIGNING_KEY_ID / MUX_SIGNING_KEY_PRIVATE not set — falling back to PUBLIC " +
    "playback. Anyone with a playback ID can stream/download these videos. Set signing keys " +
    "for confidential media."
  );
}

// Token lifetime for signed playback (short-lived; client re-fetches when viewing).
const SIGNED_TOKEN_TTL = "6h";

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

  // When signing keys are configured, use a `signed` policy and DON'T enable the
  // downloadable MP4 rendition (that would be a public, un-tokenised download).
  const newAssetSettings = signingConfigured
    ? { playback_policy: ["signed"] }
    : { playback_policy: ["public"], mp4_support: "standard" };

  const upload = await mux.video.uploads.create({
    cors_origin: APP_URL,
    new_asset_settings: newAssetSettings,
  });

  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
  };
}

// ─── Sign a short-lived playback token ─────────────────────────────────────
// @param {string} playbackId
// @param {"video"|"thumbnail"|"gif"|"storyboard"} type
// @returns {Promise<string|null>} JWT token, or null when signing isn't configured
export async function signMuxToken(playbackId, type = "video") {
  if (!mux || !signingConfigured) return null;
  return mux.jwt.signPlaybackId(playbackId, {
    type,
    expiration: SIGNED_TOKEN_TTL,
    keyId: MUX_SIGNING_KEY_ID,
    keySecret: MUX_SIGNING_KEY_PRIVATE,
  });
}

// ─── Build ready-to-play URLs for a playback ID (public or signed) ─────────
// Called at *view* time so signed tokens are always fresh. Returns the same
// shape regardless of policy so the client has a single code path.
export async function getPlaybackInfo(playbackId) {
  if (!playbackId) return null;
  if (!signingConfigured) {
    return {
      signed: false,
      streamUrl: `https://stream.mux.com/${playbackId}.m3u8`,
      thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`,
    };
  }
  const [videoToken, thumbToken] = await Promise.all([
    signMuxToken(playbackId, "video"),
    signMuxToken(playbackId, "thumbnail"),
  ]);
  return {
    signed: true,
    streamUrl: `https://stream.mux.com/${playbackId}.m3u8?token=${videoToken}`,
    thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${thumbToken}`,
  };
}

// ─── Check if signed playback is configured ────────────────────────────────
export function isMuxSigningConfigured() {
  return signingConfigured;
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
