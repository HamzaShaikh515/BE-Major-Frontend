'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface JobState {
  job_id: string;
  status: JobStatus;
  message?: string;
}

interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

interface AnalysisResult {
  encroachment_percent: number;
  risk_level: 'Low' | 'Medium' | 'High';
  report_id?: number;
  t0_thumb?: string;
  t1_thumb?: string;
  encroach_thumb?: string;
}

export default function Dashboard() {
  const [coords, setCoords] = useState({
    lat: 19.2625,
    lon: 72.9680
  });
  const [radius, setRadius] = useState(1500);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [date1Start, setDate1Start] = useState("2022-01-01");
  const [date1End, setDate1End] = useState("2022-02-01");
  const [date2Start, setDate2Start] = useState("2023-01-01");
  const [date2End, setDate2End] = useState("2023-02-01");
  const [polygon, setPolygon] = useState<GeoJSONPolygon | null>(null);
  const [inputMode, setInputMode] = useState<'manual' | 'polygon'>('manual');
  const [mapKey, setMapKey] = useState(0);
  const [locationName, setLocationName] = useState<string>('Kasarvadali, Thane, Maharashtra, India');

  // Job tracking state
  const [job, setJob] = useState<JobState | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reverse geocode to get location name from coordinates
  const getLocationName = async (lat: number, lon: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const data = await response.json();
      if (data.display_name) {
        setLocationName(data.display_name);
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  // --- Polling logic ---
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}/job/${jobId}`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();

      const status: JobStatus = data.status;
      setJob({ job_id: jobId, status, message: data.message });

      if (status === 'completed') {
        stopPolling();
        setResult(data.result ?? data);
        setLoading(false);
      } else if (status === 'failed') {
        stopPolling();
        setJobError(data.error ?? data.message ?? 'Job failed on the server.');
        setLoading(false);
      }
    } catch (err: unknown) {
      stopPolling();
      setJobError(err instanceof Error ? err.message : 'Failed to fetch job status.');
      setLoading(false);
    }
  }, [stopPolling]);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    pollJob(jobId); // run immediately, then on interval
    pollIntervalRef.current = setInterval(() => pollJob(jobId), 3000);
  }, [stopPolling, pollJob]);

  // Clean up interval on unmount
  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  // --- Cancel running job ---
  const cancelJob = () => {
    stopPolling();
    setJob(null);
    setJobError(null);
    setLoading(false);
  };

  // --- Submit Analysis ---
  const runAnalysis = async () => {
    setLoading(true);
    setResult(null);
    setJob(null);
    setJobError(null);

    const body = polygon
      ? {
        polygon,
        lat: null,
        lon: null,
        radius: null,
        date1_start: date1Start,
        date1_end: date1End,
        date2_start: date2Start,
        date2_end: date2End,
      }
      : {
        polygon: null,
        lat: coords.lat,
        lon: coords.lon,
        radius,
        date1_start: date1Start,
        date1_end: date1End,
        date2_start: date2Start,
        date2_end: date2End,
      };

    try {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail ?? `Server returned ${res.status}`);
      }

      const data = await res.json();
      const jobId: string = data.job_id;
      setJob({ job_id: jobId, status: 'queued' });
      startPolling(jobId);
    } catch (err: unknown) {
      setJobError(err instanceof Error ? err.message : 'Failed to submit analysis job.');
      setLoading(false);
    }
  };

  const clearPolygon = () => {
    setPolygon(null);
    setInputMode('manual');
    setMapKey(prev => prev + 1);
  };

  const handleCoordsChange = (newCoords: { lat: number; lon: number }) => {
    setCoords(newCoords);
    setPolygon(null);
    setInputMode('manual');
    setMapKey(prev => prev + 1);
    getLocationName(newCoords.lat, newCoords.lon);
  };

  const handlePolygonChange = (newPolygon: GeoJSONPolygon | null) => {
    setPolygon(newPolygon);
    if (newPolygon) {
      setInputMode('polygon');
      const coordinates = newPolygon.coordinates[0];
      const lats = coordinates.map((c) => c[1]);
      const lons = coordinates.map((c) => c[0]);
      const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const centerLon = lons.reduce((a, b) => a + b, 0) / lons.length;
      setCoords({ lat: centerLat, lon: centerLon });
      getLocationName(centerLat, centerLon);
    } else {
      setInputMode('manual');
    }
  };

  const handleSearchLocationChange = (newLat: number, newLon: number, name?: string) => {
    setCoords({ lat: newLat, lon: newLon });
    setPolygon(null);
    setInputMode('manual');
    setMapKey(prev => prev + 1);
    if (name) {
      setLocationName(name);
    } else {
      getLocationName(newLat, newLon);
    }
  };

  const downloadReport = async () => {
    if (!result?.report_id) return;
    try {
      const res = await fetch(`${API_BASE}/report/${result.report_id}`);
      if (!res.ok) { alert("Failed to download report."); return; }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `urbaneye_report_${result.report_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error downloading report.");
    }
  };

  // --- Status badge helpers ---
  const statusConfig: Record<JobStatus, { color: string; icon: string; label: string }> = {
    queued: { color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50', icon: '⏳', label: 'Job Queued' },
    processing: { color: 'bg-blue-500/20 text-blue-300 border-blue-500/50', icon: '⚙️', label: 'Processing…' },
    completed: { color: 'bg-green-500/20 text-green-300 border-green-500/50', icon: '✅', label: 'Completed' },
    failed: { color: 'bg-red-500/20 text-red-300 border-red-500/50', icon: '❌', label: 'Failed' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <span className="text-5xl">🌍</span>
            UrbanEye Dashboard
          </h1>
          <p className="text-blue-100 mt-2">Satellite-based urban encroachment detection and analysis</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-6">

            {/* Area Selection */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  📍 Area Selection
                </h2>
              </div>
              <div className="p-5 space-y-4">
                {/* Mode Indicator */}
                <div className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3">
                  <span className="text-sm text-gray-300">Active Mode:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${inputMode === 'manual'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                    }`}>
                    {inputMode === 'manual' ? '🎯 Manual' : '🖊️ Polygon'}
                  </span>
                </div>

                {polygon && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-purple-300">✓ Polygon drawn</span>
                      <button
                        onClick={clearPolygon}
                        className="text-xs px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Latitude</label>
                  <input
                    type="number" step="0.000001" value={coords.lat}
                    onChange={(e) => handleCoordsChange({ ...coords, lat: Number(e.target.value) })}
                    className="w-full bg-gray-700/50 border border-gray-600 text-white px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={inputMode === 'polygon'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Longitude</label>
                  <input
                    type="number" step="0.000001" value={coords.lon}
                    onChange={(e) => handleCoordsChange({ ...coords, lon: Number(e.target.value) })}
                    className="w-full bg-gray-700/50 border border-gray-600 text-white px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={inputMode === 'polygon'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Radius (meters)</label>
                  <input
                    type="number" value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full bg-gray-700/50 border border-gray-600 text-white px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={inputMode === 'polygon'}
                  />
                </div>
                {inputMode === 'manual' && (
                  <p className="text-xs text-gray-400 italic">
                    💡 Or draw a polygon on the map to define custom area
                  </p>
                )}
              </div>
            </div>

            {/* Time Period Selection */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  📅 Time Periods
                </h2>
              </div>
              <div className="p-5 space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                    Before Period (t0)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Start</label>
                      <input type="date" value={date1Start} onChange={(e) => setDate1Start(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">End</label>
                      <input type="date" value={date1End} onChange={(e) => setDate1End(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-300">
                    <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                    After Period (t1)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Start</label>
                      <input type="date" value={date2Start} onChange={(e) => setDate2Start(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">End</label>
                      <input type="date" value={date2End} onChange={(e) => setDate2End(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Run Analysis Button */}
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {job?.status === 'queued' || job?.status === 'processing' ? 'Analyzing…' : 'Submitting…'}
                </>
              ) : (
                <>
                  <span className="text-xl">🔍</span>
                  Run Analysis
                </>
              )}
            </button>

            {/* Job Status Card */}
            {job && job.status !== 'completed' && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-slate-600 to-gray-600 px-5 py-3">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    🛰️ Job Status
                  </h2>
                </div>
                <div className="p-5 space-y-3">
                  {/* Job ID */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-mono">Job ID</span>
                    <span className="text-xs text-gray-300 font-mono bg-gray-700/60 px-2 py-1 rounded truncate max-w-[160px]">
                      {job.job_id}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${statusConfig[job.status].color}`}>
                    <span>{statusConfig[job.status].icon}</span>
                    <span className="text-sm font-medium">{statusConfig[job.status].label}</span>
                    {(job.status === 'queued' || job.status === 'processing') && (
                      <div className="ml-auto w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
                    )}
                  </div>

                  {job.message && (
                    <p className="text-xs text-gray-400 italic">{job.message}</p>
                  )}

                  {/* Cancel button */}
                  {(job.status === 'queued' || job.status === 'processing') && (
                    <button
                      onClick={cancelJob}
                      className="w-full text-sm px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                    >
                      Cancel Polling
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Job Error */}
            {jobError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="text-sm font-semibold text-red-300 mb-1">❌ Analysis Failed</div>
                <div className="text-xs text-red-400">{jobError}</div>
                <button
                  onClick={() => setJobError(null)}
                  className="mt-2 text-xs px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-3">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    📊 Analysis Results
                  </h2>
                </div>
                <div className="p-5 space-y-4">
                  <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Encroachment Detected</div>
                    <div className="text-3xl font-bold text-white">{result.encroachment_percent}%</div>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Risk Level</div>
                    <div className={`text-2xl font-bold inline-block px-4 py-2 rounded-lg ${result.risk_level === 'High' ? 'bg-red-500/20 text-red-300' :
                      result.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-green-500/20 text-green-300'
                      }`}>
                      {result.risk_level}
                    </div>
                  </div>
                  <button
                    onClick={downloadReport}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PDF Report
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Map */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  🗺️ Interactive Map
                </h2>
                {/* Live job status pill in map header */}
                {job && (job.status === 'queued' || job.status === 'processing') && (
                  <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${statusConfig[job.status].color}`}>
                    <span className="w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin" />
                    {statusConfig[job.status].label}
                  </span>
                )}
                {job && job.status === 'completed' && (
                  <span className={`text-xs px-3 py-1 rounded-full border ${statusConfig.completed.color}`}>
                    ✅ Map Updated
                  </span>
                )}
              </div>
              <div className="p-2">
                <MapView
                  key={mapKey}
                  result={result}
                  lat={coords.lat}
                  lon={coords.lon}
                  radius={radius}
                  hasPolygon={!!polygon}
                  setPolygon={handlePolygonChange}
                  onLocationChange={handleSearchLocationChange}
                />
              </div>

              {/* Currently Selected Area */}
              <div className="bg-gradient-to-r from-slate-700/50 to-slate-800/50 px-5 py-4 border-t border-gray-700">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <span className="text-lg">📍</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-400 mb-1">Currently Selected Area</div>
                    <div className="text-sm text-white font-medium break-words">
                      {locationName}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
                      {inputMode === 'polygon' && (
                        <span className="ml-2 text-purple-400">• Custom Polygon</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}