import axios from 'axios';
import type { AxiosError } from 'axios';

// ✅ CORRECT: Use port 8000, not 5000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Create axios instance with proper config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds
  withCredentials: true, // Important for CORS
});

// Add request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log('🚀 API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', response.status, response.config.url);
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ API Error:', error.response?.status, error.message);
    console.error('Error details:', error.response?.data);
    return Promise.reject(error);
  }
);

// ============================================
// TYPES
// ============================================

export interface JobCreate {
  aoi_id: number;
  date_from: string;
  date_to: string;
}

export interface Job {
  id: string;
  aoi_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface AOI {
  id: number;
  name: string;
  geometry: any; // GeoJSON geometry
  ward?: string;
  area_sqm?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AOICreate {
  name: string;
  geometry: any; // GeoJSON geometry
  ward?: string;
}

export interface Detection {
  id: number;
  job_id: string;
  geometry: any;
  confidence_score: number;
  area_sqm: number;
  flagged: boolean;
  change_type?: string;
}

// ============================================
// JOBS API
// ============================================
export const jobsAPI = {
  // Create new detection job
  create: async (data: JobCreate): Promise<Job> => {
    const response = await apiClient.post<Job>('/jobs', data);
    return response.data;
  },

  // Get job by ID
  get: async (jobId: string): Promise<Job> => {
    const response = await apiClient.get<Job>(`/jobs/${jobId}`);
    return response.data;
  },

  // List all jobs
  list: async (params?: { aoi_id?: number; status?: string }): Promise<Job[]> => {
    const response = await apiClient.get<Job[]>('/jobs', { params });
    return response.data;
  },

  // Cancel job
  cancel: async (jobId: string): Promise<void> => {
    await apiClient.delete(`/jobs/${jobId}`);
  },
};

// ============================================
// AOI API
// ============================================
export const aoiAPI = {
  // List all AOIs
  list: async (): Promise<AOI[]> => {
    const response = await apiClient.get<AOI[]>('/aoi');
    return response.data;
  },

  // Get AOI by ID
  get: async (aoiId: number): Promise<AOI> => {
    const response = await apiClient.get<AOI>(`/aoi/${aoiId}`);
    return response.data;
  },

  // Create new AOI
  create: async (data: AOICreate): Promise<AOI> => {
    const response = await apiClient.post<AOI>('/aoi', data);
    return response.data;
  },

  // Delete AOI
  delete: async (aoiId: number): Promise<void> => {
    await apiClient.delete(`/aoi/${aoiId}`);
  },
};

// ============================================
// DETECTIONS API
// ============================================
export const detectionsAPI = {
  // List detections for a job
  list: async (jobId?: string): Promise<Detection[]> => {
    const params = jobId ? { job_id: jobId } : {};
    const response = await apiClient.get<Detection[]>('/detections', { params });
    return response.data;
  },

  // Get detection by ID
  get: async (detectionId: number): Promise<Detection> => {
    const response = await apiClient.get<Detection>(`/detections/${detectionId}`);
    return response.data;
  },
};

// ============================================
// HEALTH CHECK API
// ============================================
export const healthAPI = {
  check: async () => {
    const response = await axios.get<{
      status: string;
      database: string;
      tables_count: number;
      app_name: string;
      environment: string;
      api_version: string;
    }>('http://localhost:8000/health');
    return response.data;
  },
};

export default apiClient;
