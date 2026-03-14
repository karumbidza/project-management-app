// FOLLO MEDIA
// useMediaUpload — React hook for uploading media to R2/Mux
// Handles validation, signed URLs, progress tracking, and video processing

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

// ─── Media type detection ──────────────────────────────────────────────────
function detectMediaType(file) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
}

// ─── Client-side validation limits ─────────────────────────────────────────
const MAX_SIZES = Object.freeze({
  image: 10 * 1024 * 1024, // 10MB
  video: 200 * 1024 * 1024, // 200MB
  audio: 50 * 1024 * 1024, // 50MB
  file: 50 * 1024 * 1024, // 50MB
});

const ALLOWED_TYPES = Object.freeze({
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/quicktime", "video/webm"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4"],
  file: [], // any
});

// ─── Validate file before upload ───────────────────────────────────────────
function validateFile(file, mediaType) {
  // Check size
  if (file.size > MAX_SIZES[mediaType]) {
    const maxMB = MAX_SIZES[mediaType] / 1024 / 1024;
    throw new Error(`File too large. Max size for ${mediaType} is ${maxMB}MB`);
  }

  // Check type (skip for generic files)
  const allowedTypes = ALLOWED_TYPES[mediaType];
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(", ")}`
    );
  }
}

// ─── Upload hook ───────────────────────────────────────────────────────────
export function useMediaUpload() {
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const upload = useCallback(
    async (file) => {
      setUploading(true);
      setProgress(0);
      setError(null);

      try {
        const token = await getToken();
        const mediaType = detectMediaType(file);
        validateFile(file, mediaType);

        // ── Video: use Mux upload flow ─────────────────────────────────────
        if (mediaType === "video") {
          // 1. Get Mux upload URL
          const signRes = await fetch(`${API_URL}/api/v1/media/sign/video`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (!signRes.ok) {
            const err = await signRes.json().catch(() => ({}));
            throw new Error(err.error?.message || "Failed to get video upload URL");
          }

          const { uploadUrl, uploadId } = await signRes.json().then((r) => r.data);

          // 2. Upload directly to Mux with progress
          await uploadWithProgress(file, uploadUrl, setProgress);

          // 3. Poll until Mux finishes processing (max 2 min)
          const asset = await pollMuxAsset(uploadId, token);

          return {
            type: "VIDEO",
            url: `https://stream.mux.com/${asset.playbackId}.m3u8`,
            thumbnailUrl: asset.thumbnailUrl,
            duration: asset.duration,
            sizeBytes: file.size,
            fileName: file.name,
            muxUploadId: uploadId,
            muxAssetId: asset.assetId,
            muxPlaybackId: asset.playbackId,
          };
        }

        // ── Image / Audio / File: use R2 signed URL ────────────────────────
        // 1. Get signed upload URL from backend
        const signRes = await fetch(`${API_URL}/api/v1/media/sign`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mediaType,
            mimeType: file.type,
            sizeBytes: file.size,
          }),
        });

        if (!signRes.ok) {
          const err = await signRes.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to get upload URL");
        }

        const { uploadUrl, fileKey, cdnUrl } = await signRes.json().then((r) => r.data);

        // 2. Upload directly to R2 (bypasses server)
        await uploadWithProgress(file, uploadUrl, setProgress);

        return {
          type: mediaType.toUpperCase(),
          url: cdnUrl,
          fileKey,
          sizeBytes: file.size,
          fileName: file.name,
          // Duration for audio (calculated client-side if possible)
          ...(mediaType === "audio" ? { duration: await getAudioDuration(file) } : {}),
        };
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [getToken]
  );

  // Reset error state
  const clearError = useCallback(() => setError(null), []);

  return { upload, uploading, progress, error, clearError };
}

// ─── Upload with XHR for progress tracking ─────────────────────────────────
// fetch() doesn't support upload progress, so we use XMLHttpRequest
function uploadWithProgress(file, signedUrl, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

// ─── Poll Mux until video is ready ─────────────────────────────────────────
async function pollMuxAsset(uploadId, token, maxAttempts = 24, intervalMs = 5000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const res = await fetch(`${API_URL}/api/v1/media/video/${uploadId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("Failed to check video status");
    }

    const { data: asset } = await res.json();

    if (asset.status === "ready") return asset;
    if (asset.status === "errored") throw new Error("Video processing failed");
    // "waiting" | "preparing" → keep polling
  }

  throw new Error("Video processing timed out");
}

// ─── Get audio duration from file ──────────────────────────────────────────
function getAudioDuration(file) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";

    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration);
      URL.revokeObjectURL(audio.src);
    });

    audio.addEventListener("error", () => {
      resolve(null);
      URL.revokeObjectURL(audio.src);
    });

    audio.src = URL.createObjectURL(file);
  });
}

// ─── Export validation helpers for use in components ───────────────────────
export const MEDIA_LIMITS = MAX_SIZES;
export const MEDIA_ALLOWED_TYPES = ALLOWED_TYPES;
export { detectMediaType, validateFile };
