'use client';

import { useState, useEffect } from 'react';
import { jobsAPI, healthAPI, aoiAPI, Job, AOI } from '@/lib/api';

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [aois, setAOIs] = useState<AOI[]>([]);
  const [selectedAOI, setSelectedAOI] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    checkHealth();
    loadAOIs();
    loadJobs();
  }, []);

  const checkHealth = async () => {
    try {
      const healthData = await healthAPI.check();
      setHealth(healthData);
      console.log('✅ Backend health:', healthData);
    } catch (err: any) {
      console.error('❌ Health check failed:', err);
      setError('Backend not available. Is it running on port 8000?');
    }
  };

  const loadAOIs = async () => {
    try {
      const aoiList = await aoiAPI.list();
      setAOIs(aoiList);
      console.log('✅ Loaded AOIs:', aoiList);
      
      // Auto-select first AOI if available
      if (aoiList.length > 0 && !selectedAOI) {
        setSelectedAOI(aoiList[0].id);
      }
    } catch (err: any) {
      console.error('❌ Failed to load AOIs:', err);
    }
  };

  const loadJobs = async () => {
    try {
      const jobsList = await jobsAPI.list();
      setJobs(jobsList);
      console.log('✅ Loaded jobs:', jobsList);
    } catch (err: any) {
      console.error('❌ Failed to load jobs:', err);
    }
  };

  const createTestAOI = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Creating test AOI...');
      
      // Mumbai suburban test area (Andheri)
      const newAOI = await aoiAPI.create({
        name: 'Andheri Test Area',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [72.85, 19.11],
            [72.87, 19.11],
            [72.87, 19.13],
            [72.85, 19.13],
            [72.85, 19.11]
          ]]
        },
        ward: 'K/W'
      });
      
      console.log('✅ AOI created:', newAOI);
      alert(`✅ AOI created successfully!\n\nName: ${newAOI.name}\nID: ${newAOI.id}\nWard: ${newAOI.ward}`);
      
      // Refresh AOIs and select the new one
      await loadAOIs();
      setSelectedAOI(newAOI.id);
      
    } catch (err: any) {
      console.error('❌ AOI creation failed:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to create AOI';
      setError(JSON.stringify(err.response?.data, null, 2));
      alert(`❌ Error creating AOI:\n${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const createTestJob = async () => {
    if (!selectedAOI) {
      alert('⚠️ Please create or select an AOI first!');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Creating job for AOI:', selectedAOI);
      
      const newJob = await jobsAPI.create({
        aoi_id: selectedAOI,
        date_from: '2023-01-01T00:00:00',
        date_to: '2024-01-01T00:00:00',
      });
      
      console.log('✅ Job created:', newJob);
      alert(`✅ Job created successfully!\n\nID: ${newJob.id}\nStatus: ${newJob.status}\nAOI: ${selectedAOI}`);
      
      // Refresh jobs list
      await loadJobs();
      
      // Start polling for job status
      pollJobStatus(newJob.id);
      
    } catch (err: any) {
      console.error('❌ Job creation failed:', err);
      console.error('Full error:', err.response?.data);
      
      const errorDetail = err.response?.data?.detail;
      let errorMsg = 'Failed to create job';
      
      if (typeof errorDetail === 'string') {
        errorMsg = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMsg = errorDetail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join('\n');
      }
      
      setError(JSON.stringify(err.response?.data, null, 2));
      alert(`❌ Error creating job:\n${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await jobsAPI.get(jobId);
        console.log(`📊 Job ${jobId} - Status: ${job.status}, Progress: ${job.progress}%`);
        
        // Update jobs list
        setJobs(prev => 
          prev.map(j => j.id === jobId ? job : j)
        );
        
        // Stop polling if job is complete or failed
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(interval);
          
          if (job.status === 'completed') {
            alert(`✅ Job ${jobId} completed successfully!`);
          } else {
            alert(`❌ Job ${jobId} failed: ${job.error_message || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error('Failed to poll job status:', error);
        clearInterval(interval);
      }
    }, 3000); // Poll every 3 seconds
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">UrbanEye Dashboard</h1>
          <p className="text-gray-400">Mumbai Illegal Construction Detection System</p>
        </div>

        {/* Backend Status */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-white mb-3">Backend Status</h3>
          {health ? (
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse" />
                <span className="text-green-400 font-medium">Connected to {health.app_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="bg-gray-700 rounded p-3">
                  <p className="text-xs text-gray-400">Database</p>
                  <p className="text-sm text-white font-semibold">{health.database}</p>
                </div>
                <div className="bg-gray-700 rounded p-3">
                  <p className="text-xs text-gray-400">Tables</p>
                  <p className="text-sm text-white font-semibold">{health.tables_count}</p>
                </div>
                <div className="bg-gray-700 rounded p-3">
                  <p className="text-xs text-gray-400">API Version</p>
                  <p className="text-sm text-white font-semibold">{health.api_version}</p>
                </div>
                <div className="bg-gray-700 rounded p-3">
                  <p className="text-xs text-gray-400">Environment</p>
                  <p className="text-sm text-white font-semibold">{health.environment}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
              <span className="text-red-400">Disconnected - Check if backend is running</span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-8">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-red-200 font-semibold mb-2">❌ Error Details:</p>
                <pre className="text-xs text-red-300 overflow-auto max-h-40 bg-red-950/50 p-3 rounded">
                  {error}
                </pre>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-300 hover:text-red-100 ml-4"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* AOI Management */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            📍 Area of Interest (AOI)
          </h3>
          
          <div className="mb-4">
            {aois.length > 0 ? (
              <div className="space-y-2">
                <label className="text-gray-300 text-sm font-medium">Select AOI:</label>
                <select
                  value={selectedAOI || ''}
                  onChange={(e) => setSelectedAOI(Number(e.target.value))}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">-- Select an AOI --</option>
                  {aois.map((aoi) => (
                    <option key={aoi.id} value={aoi.id}>
                      {aoi.name} (ID: {aoi.id}) {aoi.ward ? `- Ward: ${aoi.ward}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-2">
                  {aois.length} AOI(s) available
                </p>
              </div>
            ) : (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-4">
                <p className="text-yellow-300">
                  ⚠️ No AOIs found. Create a test AOI to get started!
                </p>
              </div>
            )}
          </div>

          <button
            onClick={createTestAOI}
            disabled={loading || !health}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
          >
            {loading ? '⏳ Creating AOI...' : '➕ Create Test AOI (Andheri)'}
          </button>
        </div>

        {/* Create Job Section */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">
            🚀 Create Detection Job
          </h3>
          
          {selectedAOI ? (
            <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4 mb-4">
              <p className="text-blue-300">
                ✅ Selected AOI: <span className="font-semibold">
                  {aois.find(a => a.id === selectedAOI)?.name}
                </span> (ID: {selectedAOI})
              </p>
              <p className="text-xs text-blue-400 mt-1">
                Date Range: 2023-01-01 to 2024-01-01
              </p>
            </div>
          ) : (
            <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-4">
              <p className="text-yellow-300">
                ⚠️ Please select an AOI first
              </p>
            </div>
          )}

          <button
            onClick={createTestJob}
            disabled={loading || !health || !selectedAOI}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
          >
            {loading ? '⏳ Creating Job...' : '🚀 Run Detection Job'}
          </button>
        </div>

        {/* Jobs List */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">
            📋 Recent Jobs
          </h3>
          {jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-white font-medium">Job #{String(job.id)}</p>

                      <p className="text-sm text-gray-400 mt-1">
                        AOI: {aois.find(a => a.id === job.aoi_id)?.name || `ID ${job.aoi_id}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        job.status === 'completed' ? 'bg-green-600' :
                        job.status === 'processing' ? 'bg-blue-600' :
                        job.status === 'failed' ? 'bg-red-600' :
                        'bg-yellow-600'
                      } text-white`}>
                        {job.status.toUpperCase()}
                      </span>
                      {job.status === 'processing' && job.progress !== undefined && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-400">
                            Progress: {job.progress}%
                          </p>
                          <div className="w-24 bg-gray-600 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {job.error_message && (
                    <div className="mt-3 bg-red-900/50 border border-red-600 rounded p-2">
                      <p className="text-red-300 text-sm">
                        ❌ {job.error_message}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-lg">No jobs yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Create an AOI and run a detection job to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
