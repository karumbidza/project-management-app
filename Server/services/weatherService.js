// FOLLO CALENDAR — Phase 4 weather
/**
 * Weather service. Forecast DATA comes from Open-Meteo (free, strong Africa
 * coverage, no key for dev); it is cached one row per rounded site-location per
 * day so the API is hit at most once per site per day. The request path serves
 * ONLY from cache (with a one-time lazy fill if a location has never been
 * fetched). Risk is ADVISORY — never a prediction (see calendar UI framing).
 */

import prisma from '../configs/prisma.js';
import { requireProjectAccess, requireProjectManager } from '../utils/permissions.js';
import { NotFoundError } from '../utils/errors.js';
import { ERROR_CODES } from '../utils/constants.js';

// Advisory thresholds — tunable. A weather-sensitive activity on a day meeting
// EITHER threshold is flagged for review.
export const WEATHER_RISK = { precipProb: 70, precipMm: 10 };

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const DAILY_FIELDS = 'temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code';

// Round lat/lng to ~1km buckets so nearby projects share a cached forecast.
export const bucket = (v) => Math.round(Number(v) * 100) / 100;

// A day is a weather RISK when rain is likely or rainfall is significant.
export const computeRisk = (s) =>
  (s?.precipProb != null && s.precipProb >= WEATHER_RISK.precipProb) ||
  (s?.precipMm != null && s.precipMm >= WEATHER_RISK.precipMm);

export function buildUrl(lat, lng, timezone = 'UTC', days = 14) {
  const p = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone: timezone || 'UTC',
    forecast_days: String(days),
    daily: DAILY_FIELDS,
  });
  return `${OPEN_METEO}?${p.toString()}`;
}

/** Pure: map an Open-Meteo daily payload → snapshot rows. Testable offline. */
export function parseOpenMeteo(json) {
  const d = json?.daily;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((date, i) => ({
    forecastDate: date, // 'YYYY-MM-DD'
    tempMaxC: d.temperature_2m_max?.[i] ?? null,
    tempMinC: d.temperature_2m_min?.[i] ?? null,
    precipMm: d.precipitation_sum?.[i] ?? null,
    precipProb: d.precipitation_probability_max?.[i] ?? null,
    windKph: d.wind_speed_10m_max?.[i] ?? null,
    weatherCode: d.weather_code?.[i] ?? null,
  }));
}

/** Fetch a location's forecast from Open-Meteo and upsert into the cache. */
export async function fetchAndCache(lat, lng, timezone = 'UTC') {
  const res = await fetch(buildUrl(lat, lng, timezone));
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const rows = parseOpenMeteo(json);
  const latBucket = bucket(lat);
  const lngBucket = bucket(lng);
  const now = new Date();
  for (const r of rows) {
    const forecastDate = new Date(`${r.forecastDate}T00:00:00Z`);
    const data = {
      tempMinC: r.tempMinC, tempMaxC: r.tempMaxC, precipMm: r.precipMm,
      precipProb: r.precipProb, windKph: r.windKph, weatherCode: r.weatherCode,
      fetchedAt: now, source: 'open-meteo',
    };
    await prisma.weatherSnapshot.upsert({
      where: { latBucket_lngBucket_forecastDate: { latBucket, lngBucket, forecastDate } },
      create: { latBucket, lngBucket, forecastDate, ...data },
      update: data,
    });
  }
  return rows.length;
}

const dateOnly = (v, fb) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) : fb;
};

/**
 * Weather for a project's site across [from,to] — served from cache, with a
 * one-time lazy fill if this location has never been fetched. Returns
 * { location, days:[{date, …, risky}] }; location is null if the project has
 * no coordinates set (feature degrades gracefully).
 */
export async function getProjectWeather(projectId, userId, opts = {}) {
  await requireProjectAccess(userId, projectId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { latitude: true, longitude: true, locationName: true, timezone: true },
  });
  if (!project) throw new NotFoundError('Project not found', ERROR_CODES.PROJECT_NOT_FOUND);
  if (project.latitude == null || project.longitude == null) return { location: null, days: [] };

  const latBucket = bucket(project.latitude);
  const lngBucket = bucket(project.longitude);
  const now = new Date();
  const from = dateOnly(opts.from, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
  const to = dateOnly(opts.to, new Date(from.getTime() + 14 * 86400000));

  const read = () => prisma.weatherSnapshot.findMany({
    where: { latBucket, lngBucket, forecastDate: { gte: from, lte: to } },
    orderBy: { forecastDate: 'asc' },
  });

  let rows = await read();
  if (rows.length === 0) {
    // Lazy fill once; on any failure serve an empty forecast (cache-only path).
    try {
      await fetchAndCache(project.latitude, project.longitude, project.timezone || 'UTC');
      rows = await read();
    } catch (err) {
      console.error('[weather] lazy fill failed:', err.message);
    }
  }

  const days = rows.map((r) => ({
    date: r.forecastDate.toISOString().slice(0, 10),
    tempMinC: r.tempMinC, tempMaxC: r.tempMaxC, precipMm: r.precipMm, precipProb: r.precipProb,
    windKph: r.windKph, humidity: r.humidity, weatherCode: r.weatherCode,
    risky: computeRisk(r),
  }));
  return {
    location: { name: project.locationName, latitude: project.latitude, longitude: project.longitude, timezone: project.timezone },
    days,
  };
}

/** Manager/owner sets the project's site location (for weather + agenda TZ). */
export async function setProjectLocation(projectId, userId, data) {
  await requireProjectManager(userId, projectId);
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      locationName: data.locationName ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      ...(data.timezone ? { timezone: data.timezone } : {}),
    },
    select: { locationName: true, latitude: true, longitude: true, timezone: true },
  });
  // Warm the cache for the new location (best-effort).
  if (project.latitude != null && project.longitude != null) {
    fetchAndCache(project.latitude, project.longitude, project.timezone || 'UTC').catch(() => {});
  }
  return project;
}

/** One cached snapshot for a location + date ('YYYY-MM-DD'), or null. */
export async function getSnapshot(lat, lng, dateStr) {
  if (lat == null || lng == null) return null;
  const forecastDate = new Date(`${dateStr}T00:00:00Z`);
  return prisma.weatherSnapshot.findUnique({
    where: { latBucket_lngBucket_forecastDate: { latBucket: bucket(lat), lngBucket: bucket(lng), forecastDate } },
  });
}

/** Distinct rounded locations across all projects that have coordinates. */
export async function listDistinctLocations() {
  const projects = await prisma.project.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { latitude: true, longitude: true, timezone: true },
  });
  const seen = new Map();
  for (const p of projects) {
    const key = `${bucket(p.latitude)},${bucket(p.longitude)}`;
    if (!seen.has(key)) seen.set(key, { lat: p.latitude, lng: p.longitude, timezone: p.timezone || 'UTC' });
  }
  return [...seen.values()];
}
