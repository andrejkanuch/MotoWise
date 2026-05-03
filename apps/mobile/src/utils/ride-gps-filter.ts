/**
 * GPS signal processing: Kalman filtering, drift prevention, and speed smoothing.
 * Based on Strava/Calimoto-level best practices for ride tracking.
 */

// --- 1D Kalman Filter (per-axis: latitude and longitude) ---

class KalmanAxis {
  private x: number; // estimated position
  private v: number; // estimated velocity
  private p: number; // estimation error covariance
  private q: number; // process noise
  private r: number; // measurement noise (GPS accuracy)

  constructor(initial: number, processNoise = 0.000001) {
    this.x = initial;
    this.v = 0;
    this.p = 1;
    this.q = processNoise;
    this.r = 0.0001; // default, overridden by GPS accuracy
  }

  update(measurement: number, accuracy: number, dt: number): number {
    // Adapt measurement noise from GPS accuracy (meters → degrees²)
    this.r = (accuracy / 111_000) ** 2;

    // Predict
    this.x += this.v * dt;
    this.p += this.q;

    // Update (Kalman gain)
    const k = this.p / (this.p + this.r);
    const residual = measurement - this.x;
    this.v += k * (residual / Math.max(dt, 0.1)) * 0.1;
    this.x += k * residual;
    this.p = (1 - k) * this.p;

    return this.x;
  }
}

// --- Speed smoother (weighted moving average with spike rejection) ---

class SpeedSmoother {
  private buffer: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize = 5) {
    this.windowSize = windowSize;
  }

  add(speed: number): number {
    // Reject spikes: if >2.5x recent average, clamp
    if (this.buffer.length >= 3) {
      const recentAvg = this.buffer.slice(-3).reduce((a, b) => a + b, 0) / 3;
      if (speed > recentAvg * 2.5 && recentAvg > 1) {
        speed = recentAvg;
      }
    }

    this.buffer.push(speed);
    if (this.buffer.length > this.windowSize) this.buffer.shift();

    // Weighted moving average (recent readings weighted more)
    let weightSum = 0;
    let valueSum = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      const weight = i + 1;
      weightSum += weight;
      valueSum += this.buffer[i] * weight;
    }
    return valueSum / weightSum;
  }

  reset(): void {
    this.buffer = [];
  }
}

// --- Elevation tracker (EMA smoothing with Strava-like thresholds) ---

class ElevationTracker {
  private smoothed: number | null = null;
  private lastCounted: number | null = null;
  private _totalAscent = 0;
  private _totalDescent = 0;
  private _maxAltitude = -Infinity;
  private _minAltitude = Infinity;
  private readonly threshold: number;
  private readonly alpha: number;

  constructor() {
    // GPS-only thresholds (no barometer access via expo-location)
    this.threshold = 6; // meters — ignore elevation changes smaller than this
    this.alpha = 0.15; // EMA factor — lower = smoother
  }

  get totalAscent(): number {
    return this._totalAscent;
  }
  get totalDescent(): number {
    return this._totalDescent;
  }
  get maxAltitude(): number {
    return this._maxAltitude === -Infinity ? 0 : this._maxAltitude;
  }
  get minAltitude(): number {
    return this._minAltitude === Infinity ? 0 : this._minAltitude;
  }

  addReading(rawAltitude: number): number {
    if (this.smoothed === null) {
      this.smoothed = rawAltitude;
      this.lastCounted = rawAltitude;
    } else {
      this.smoothed = this.alpha * rawAltitude + (1 - this.alpha) * this.smoothed;
    }

    if (this.smoothed > this._maxAltitude) this._maxAltitude = this.smoothed;
    if (this.smoothed < this._minAltitude) this._minAltitude = this.smoothed;

    // Only accumulate gain/loss if change exceeds threshold
    const delta = this.smoothed - (this.lastCounted ?? this.smoothed);
    if (Math.abs(delta) >= this.threshold) {
      if (delta > 0) this._totalAscent += delta;
      else this._totalDescent += Math.abs(delta);
      this.lastCounted = this.smoothed;
    }

    return this.smoothed;
  }

  reset(): void {
    this.smoothed = null;
    this.lastCounted = null;
    this._totalAscent = 0;
    this._totalDescent = 0;
    this._maxAltitude = -Infinity;
    this._minAltitude = Infinity;
  }
}

// --- GPS Filter (combines all processing) ---

export interface FilteredLocation {
  latitude: number;
  longitude: number;
  altitude: number | null;
  speed: number; // smoothed, m/s
  heading: number | null;
  accuracy: number;
  timestamp: number;
  // Computed stats
  segmentDistance: number; // distance from previous accepted point (meters)
  smoothedAltitude: number | null;
}

export interface GPSStats {
  totalAscent: number;
  totalDescent: number;
  maxAltitude: number;
  minAltitude: number;
  maxSpeed: number;
  maxSpeedLat: number;
  maxSpeedLng: number;
  maxSpeedTimestamp: number;
  stopCount: number;
}

class GPSFilter {
  private latFilter: KalmanAxis | null = null;
  private lngFilter: KalmanAxis | null = null;
  private speedSmoother = new SpeedSmoother(5);
  private elevationTracker = new ElevationTracker();
  private lastAccepted: FilteredLocation | null = null;
  private _maxSpeed = 0;
  private _maxSpeedLat = 0;
  private _maxSpeedLng = 0;
  private _maxSpeedTimestamp = 0;
  private _stopCount = 0;
  private _wasStopped = false;

  /** Process a raw GPS location. Returns null if the point should be rejected. */
  process(
    latitude: number,
    longitude: number,
    altitude: number | null | undefined,
    speed: number | null | undefined,
    heading: number | null | undefined,
    accuracy: number | null | undefined,
    timestamp: number,
  ): FilteredLocation | null {
    const acc = accuracy ?? 15;
    const rawSpeed = Math.max(0, speed ?? 0);

    // Reject points with very poor accuracy
    if (acc > 50) return null;

    // Initialize Kalman filters on first point
    if (!this.latFilter || !this.lngFilter) {
      this.latFilter = new KalmanAxis(latitude);
      this.lngFilter = new KalmanAxis(longitude);
    }

    // Time delta
    const dt = this.lastAccepted ? (timestamp - this.lastAccepted.timestamp) / 1000 : 1;

    // Apply Kalman filter
    const filteredLat = this.latFilter.update(latitude, acc, dt);
    const filteredLng = this.lngFilter.update(longitude, acc, dt);

    // Smooth speed
    const smoothedSpeed = this.speedSmoother.add(rawSpeed);

    // Reject unrealistic speed (>300 km/h = 83.3 m/s for motorcycles)
    if (smoothedSpeed > 83.3) return null;

    // Compute segment distance
    let segmentDistance = 0;
    if (this.lastAccepted) {
      segmentDistance = haversine(
        this.lastAccepted.latitude,
        this.lastAccepted.longitude,
        filteredLat,
        filteredLng,
      );

      // Drift prevention: reject if distance < accuracy and speed is near-zero
      if (segmentDistance < acc * 1.2 && smoothedSpeed < 1.0) {
        return null;
      }

      // Reject teleportation: impossible distance for time elapsed
      if (dt > 0 && segmentDistance / dt > 90) {
        return null; // >324 km/h
      }
    }

    // Track max speed with location
    if (smoothedSpeed > this._maxSpeed) {
      this._maxSpeed = smoothedSpeed;
      this._maxSpeedLat = filteredLat;
      this._maxSpeedLng = filteredLng;
      this._maxSpeedTimestamp = timestamp;
    }

    // Track stops (for stop count stat)
    if (smoothedSpeed < 0.5) {
      if (!this._wasStopped) {
        this._stopCount++;
        this._wasStopped = true;
      }
    } else {
      this._wasStopped = false;
    }

    // Process elevation
    let smoothedAltitude: number | null = null;
    if (altitude != null) {
      smoothedAltitude = this.elevationTracker.addReading(altitude);
    }

    const filtered: FilteredLocation = {
      latitude: filteredLat,
      longitude: filteredLng,
      altitude: altitude ?? null,
      speed: smoothedSpeed,
      heading: heading != null && heading >= 0 ? heading : null,
      accuracy: acc,
      timestamp,
      segmentDistance,
      smoothedAltitude,
    };

    this.lastAccepted = filtered;
    return filtered;
  }

  get stats(): GPSStats {
    return {
      totalAscent: this.elevationTracker.totalAscent,
      totalDescent: this.elevationTracker.totalDescent,
      maxAltitude: this.elevationTracker.maxAltitude,
      minAltitude: this.elevationTracker.minAltitude,
      maxSpeed: this._maxSpeed,
      maxSpeedLat: this._maxSpeedLat,
      maxSpeedLng: this._maxSpeedLng,
      maxSpeedTimestamp: this._maxSpeedTimestamp,
      stopCount: this._stopCount,
    };
  }

  reset(): void {
    this.latFilter = null;
    this.lngFilter = null;
    this.speedSmoother.reset();
    this.elevationTracker.reset();
    this.lastAccepted = null;
    this._maxSpeed = 0;
    this._maxSpeedLat = 0;
    this._maxSpeedLng = 0;
    this._maxSpeedTimestamp = 0;
    this._stopCount = 0;
    this._wasStopped = false;
  }
}

// --- Haversine (fast, accurate enough for segment distances) ---

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Singleton instance (module-level, survives across callbacks) ---

export const gpsFilter = new GPSFilter();
