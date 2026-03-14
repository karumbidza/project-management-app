// FOLLO MEDIA
// MediaRenderer — displays images, videos, audio, and files in task comments
// Supports lazy loading, lightbox, video player, audio player, and file downloads

import { useState, useRef, useCallback } from "react";
import { 
  Play, 
  Pause, 
  Download, 
  FileText, 
  Image as ImageIcon,
  Film,
  Music,
  X,
  Maximize2,
} from "lucide-react";

// ─── Main renderer — picks the right component by type ─────────────────────
export function MediaRenderer({ comment }) {
  const type = comment.type?.toLowerCase();
  
  switch (type) {
    case "image":
      return <ImageMedia comment={comment} />;
    case "video":
      return <VideoMedia comment={comment} />;
    case "audio":
      return <AudioMedia comment={comment} />;
    case "file":
      return <FileMedia comment={comment} />;
    default:
      return null;
  }
}

// ─── Image with lazy loading and lightbox ──────────────────────────────────
function ImageMedia({ comment }) {
  const [loaded, setLoaded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div
        className="relative max-w-xs rounded-xl overflow-hidden cursor-pointer group"
        onClick={() => setLightboxOpen(true)}
      >
        {/* Loading placeholder */}
        {!loaded && (
          <div className="w-64 h-40 bg-zinc-200 dark:bg-zinc-700 animate-pulse rounded-xl flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-zinc-400" />
          </div>
        )}
        
        <img
          src={comment.url}
          alt={comment.fileName || "Shared image"}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`max-w-xs max-h-72 rounded-xl object-cover transition-all duration-300 ${
            loaded ? "opacity-100" : "opacity-0 absolute inset-0"
          }`}
        />
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <img
            src={comment.url}
            alt={comment.fileName || "Shared image"}
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// ─── Video with thumbnail preview and HLS player ───────────────────────────
function VideoMedia({ comment }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  const handlePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  return (
    <div className="max-w-sm rounded-xl overflow-hidden bg-black relative group">
      {comment.muxPlaybackId || comment.url ? (
        <>
          <video
            ref={videoRef}
            controls={playing}
            poster={comment.thumbnailUrl}
            className="w-full max-w-sm rounded-xl"
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          >
            <source src={comment.url} type="application/x-mpegURL" />
            <source src={comment.url} type="video/mp4" />
            Your browser does not support video playback.
          </video>
          
          {/* Play button overlay */}
          {!playing && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/30 group-hover:bg-black/40 transition-colors"
              onClick={handlePlay}
            >
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <Play className="w-8 h-8 text-zinc-900 ml-1" fill="currentColor" />
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-64 h-40 bg-zinc-900 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <Film className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
            <span className="text-zinc-400 text-sm">Video processing…</span>
          </div>
        </div>
      )}
      
      {/* Duration badge */}
      {comment.duration && (
        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded text-xs text-white">
          {formatDuration(comment.duration)}
        </div>
      )}
    </div>
  );
}

// ─── Audio player with progress bar ────────────────────────────────────────
function AudioMedia({ comment }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(comment.duration ?? 0);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleTimeUpdate = useCallback(() => {
    setCurrentTime(audioRef.current?.currentTime ?? 0);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    setDuration(audioRef.current?.duration ?? 0);
  }, []);

  const handleSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const newTime = ratio * duration;
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  }, [duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-3 max-w-xs">
      <audio
        ref={audioRef}
        src={comment.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        preload="metadata"
      />

      {/* Play / Pause button */}
      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center flex-shrink-0 transition-colors"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="w-5 h-5 text-white" fill="currentColor" />
        ) : (
          <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 min-w-0">
        <div
          className="h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full cursor-pointer relative overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDuration(currentTime)}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDuration(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── File download card ────────────────────────────────────────────────────
function FileMedia({ comment }) {
  const fileName = comment.fileName || comment.url?.split("/").pop() || "file";
  const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";
  const size = comment.sizeBytes ? formatBytes(comment.sizeBytes) : null;

  const getFileIcon = () => {
    const lowerExt = ext.toLowerCase();
    if (["pdf"].includes(lowerExt)) return <FileText className="w-5 h-5" />;
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(lowerExt)) return <ImageIcon className="w-5 h-5" />;
    if (["mp4", "mov", "webm", "avi"].includes(lowerExt)) return <Film className="w-5 h-5" />;
    if (["mp3", "wav", "ogg", "m4a"].includes(lowerExt)) return <Music className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <a
      href={comment.url}
      download={fileName}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors rounded-xl px-4 py-3 max-w-xs no-underline"
    >
      {/* File type badge */}
      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 text-blue-700 dark:text-blue-400">
        {getFileIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {fileName}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {ext} {size && `• ${size}`}
        </p>
      </div>

      {/* Download icon */}
      <Download className="w-5 h-5 text-zinc-400 flex-shrink-0" />
    </a>
  );
}

// ─── Helper functions ──────────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default MediaRenderer;
