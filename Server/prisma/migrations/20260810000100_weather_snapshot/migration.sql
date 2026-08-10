-- FOLLO CALENDAR — weather forecast cache (Phase 4)
-- One row per rounded site location per forecast date; served only from cache.

CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "latBucket" DECIMAL(6,2) NOT NULL,
    "lngBucket" DECIMAL(6,2) NOT NULL,
    "forecastDate" DATE NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'open-meteo',
    "tempMinC" DOUBLE PRECISION,
    "tempMaxC" DOUBLE PRECISION,
    "precipMm" DOUBLE PRECISION,
    "precipProb" INTEGER,
    "windKph" DOUBLE PRECISION,
    "humidity" INTEGER,
    "weatherCode" INTEGER,
    "raw" JSONB,
    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeatherSnapshot_latBucket_lngBucket_forecastDate_key" ON "WeatherSnapshot"("latBucket", "lngBucket", "forecastDate");
CREATE INDEX "WeatherSnapshot_forecastDate_idx" ON "WeatherSnapshot"("forecastDate");
