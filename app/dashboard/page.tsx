'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false
});

export default function Dashboard() {
  const [coords, setCoords] = useState({
    lat: 19.271322,
    lon: 72.96894
  });
  const [radius, setRadius] = useState(1500);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [date1Start, setDate1Start] = useState("2022-01-01");
  const [date1End, setDate1End] = useState("2022-02-01");
  const [date2Start, setDate2Start] = useState("2023-01-01");
  const [date2End, setDate2End] = useState("2023-02-01");
  const [polygon, setPolygon] = useState<any>(null);
  const [inputMode, setInputMode] = useState<'manual' | 'polygon'>('manual');
  const [mapKey, setMapKey] = useState(0);

  // Update map when manual coords change
  const handleCoordsChange = (newCoords: { lat: number; lon: number }) => {
    setCoords(newCoords);
    setPolygon(null);
    setInputMode('manual');
    setMapKey(prev => prev + 1);
  };

  // Update coords when polygon is drawn
  const handlePolygonChange = (newPolygon: any) => {
    setPolygon(newPolygon);
    if (newPolygon) {
      setInputMode('polygon');
      // Calculate center of polygon
      const coordinates = newPolygon.coordinates[0];
      const lats = coordinates.map((c: number[]) => c[1]);
      const lons = coordinates.map((c: number[]) => c[0]);
      const centerLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
      const centerLon = lons.reduce((a: number, b: number) => a + b, 0) / lons.length;
      setCoords({ lat: centerLat, lon: centerLon });
    } else {
      setInputMode('manual');
    }
  };

  const runAnalysis = async () => {
    setLoading(true);

    const body = polygon
      ? {
        polygon: polygon,
        lat: null,
        lon: null,
        radius: null,
        date1_start: date1Start,
        date1_end: date1End,
        date2_start: date2Start,
        date2_end: date2End
      }
      : {
        polygon: null,
        lat: coords.lat,
        lon: coords.lon,
        radius: radius,
        date1_start: date1Start,
        date1_end: date1End,
        date2_start: date2Start,
        date2_end: date2End
      };

    const res = await fetch('http://127.0.0.1:8000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  const clearPolygon = () => {
    setPolygon(null);
    setInputMode('manual');
    setMapKey(prev => prev + 1);
  };

  const downloadReport = async () => {
    if (!result?.report_id) return;

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/report/${result.report_id}`
      );

      if (!res.ok) {
        alert("Failed to download report.");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `urbaneye_report_${result.report_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert("Error downloading report.");
    }
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

                {/* Coordinates */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={coords.lat}
                    onChange={(e) => handleCoordsChange({ ...coords, lat: Number(e.target.value) })}
                    className="w-full bg-gray-700/50 border border-gray-600 text-white px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={inputMode === 'polygon'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    value={coords.lon}
                    onChange={(e) => handleCoordsChange({ ...coords, lon: Number(e.target.value) })}
                    className="w-full bg-gray-700/50 border border-gray-600 text-white px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    disabled={inputMode === 'polygon'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Radius (meters)
                  </label>
                  <input
                    type="number"
                    value={radius}
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

                {/* Before Period */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                    Before Period (t0)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Start</label>
                      <input
                        type="date"
                        value={date1Start}
                        onChange={(e) => setDate1Start(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">End</label>
                      <input
                        type="date"
                        value={date1End}
                        onChange={(e) => setDate1End(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* After Period */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-orange-300">
                    <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                    After Period (t1)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">Start</label>
                      <input
                        type="date"
                        value={date2Start}
                        onChange={(e) => setDate2Start(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5">End</label>
                      <input
                        type="date"
                        value={date2End}
                        onChange={(e) => setDate2End(e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
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
                  <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <span className="text-xl">🔍</span>
                  Run Analysis
                </>
              )}
            </button>

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
                    <div className="text-3xl font-bold text-white">
                      {result.encroachment_percent}%
                    </div>
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

                  {result && (
                    <div className="bg-gradient-to-br from-gray-800 to-gray-850 ...">
                      <button
                        onClick={downloadReport}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download PDF Report
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Map */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-br from-gray-800 to-gray-850 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  🗺️ Interactive Map
                </h2>
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
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}