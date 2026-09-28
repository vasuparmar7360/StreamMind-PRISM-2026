/**
 * Centralized API client for communicating with the FastAPI backend.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

export interface ActionRecord {
  id: string;
  action_type: string;
  title: string;
  description: string;
  payload: any;
  status: string;
  risk_level: string;
  execution_status?: string;
  execution_result?: any;
  source_decision_id?: string;
  source_document_id?: string;
  source_chunk_id?: string;
  created_at?: string;
  approved_at?: string;
  rejected_at?: string;
  executed_at?: string;
}

export interface AuditEventRecord {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  title: string;
  description: string;
  source_document_id?: string;
  source_chunk_id?: string;
  decision_id?: string;
  conflict_id?: string;
  action_id?: string;
  metadata_json?: any;
  created_at: string;
  actor_type: string;
  actor_id: string;
}
export interface DecisionRecord {
  id: string;
  topic: string;
  normalized_topic: string;
  value: string;
  status: string;
  reason: string | null;
  source_document: string | null;
  source_document_id: string;
  source_chunk_id: string | null;
  source_date: string | null;
  supersedes_decision_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DecisionLineageResponse {
  id: string;
  topic: string;
  current: {
    value: string;
    status: string;
    reason: string | null;
    source?: string;
    source_date?: string;
    created_at?: string;
  };
  lineage: {
    value: string;
    status: string;
    reason: string | null;
    source?: string;
    source_date?: string;
    created_at?: string;
  }[];
}

export interface ConflictRecord {
  id: string;
  topic: string;
  status: string;
  conflict_type: string;
  existing_value: string;
  candidate_value: string;
  source_document: string | null;
  created_at: string | null;
}
export class APIError extends Error {
  constructor(
    public message: string,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Base generic fetcher
 */
async function fetchFromAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    // Parse JSON safely
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new APIError(
        data?.message || data?.detail || `API Error: ${response.status} ${response.statusText}`,
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    
    // Handle network errors (e.g., connection refused)
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new APIError('Unable to connect to the backend server. Is it running?', 0);
    }
    
    throw new APIError(error instanceof Error ? error.message : 'Unknown API error');
  }
}

export interface AskSource {
  label: string;
  document_id: string;
  document_name: string;
  chunk_id: string;
  chunk_index: number;
  excerpt: string;
  similarity_score: number;
}

export interface AskResponse {
  question: string;
  status: 'answered' | 'insufficient_evidence' | 'conflicting_evidence' | 'model_unavailable';
  answer: string;
  model: string | null;
  sources: AskSource[];
}

/**
 * API methods
 */
export const api = {
  /**
   * Check if the backend is reachable and healthy
   */
  checkBackendHealth: async () => {
    try {
      return await fetchFromAPI<{ status: string; message: string; timestamp: string }>('/api/health');
    } catch (error) {
      // Re-throw to be handled by the caller
      throw error;
    }
  },
  
  /**
   * Upload a project document to the local server
   */
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Custom fetch for upload to avoid setting Content-Type to application/json
    // so the browser automatically sets it to multipart/form-data with boundary
    const url = `${API_BASE_URL}/api/documents/upload`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      });
      
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      if (!response.ok) {
        throw new APIError(
          data?.message || data?.detail || `API Error: ${response.status} ${response.statusText}`,
          response.status,
          data
        );
      }
      
      return data;
    } catch (error) {
      if (error instanceof APIError) throw error;
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new APIError('Unable to connect to the backend server. Is it running?', 0);
      }
      throw new APIError(error instanceof Error ? error.message : 'Unknown API error');
    }
  },
  
  /**
   * Ask a question and get grounded evidence from the backend
   */
  askOwnMind: async (question: string, topK: number = 5): Promise<AskResponse> => {
    return await fetchFromAPI<AskResponse>('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question, top_k: topK }),
    });
  },

  /**
   * Get all uploaded project documents
   */
  getDocuments: async () => {
    return await fetchFromAPI<{ documents: any[] }>('/api/documents');
  },

  /**
   * Get specific document details
   */
  getDocument: async (documentId: string) => {
    return await fetchFromAPI<any>(`/api/documents/${documentId}`);
  },

  /**
   * Manually trigger indexing for a document
   */
  indexDocument: async (documentId: string) => {
    return await fetchFromAPI<any>(`/api/documents/${documentId}/index`, {
      method: 'POST'
    });
  },

  /**
   * Safely delete a document, respecting dependencies
   */
  deleteDocument: async (documentId: string, confirm: boolean = false) => {
    return await fetchFromAPI<any>(`/api/documents/${documentId}?confirm=${confirm}`, {
      method: 'DELETE'
    });
  },

  getDecisions: async () => {
    return await fetchFromAPI<{ total: number, decisions: DecisionRecord[] }>('/api/decisions');
  },

  getDecisionById: async (decisionId: string) => {
    return await fetchFromAPI<DecisionLineageResponse>(`/api/decisions/${decisionId}`);
  },

  getConflicts: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return await fetchFromAPI<{ total: number, conflicts: ConflictRecord[] }>(`/api/conflicts${query}`);
  },

  getActions: async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return await fetchFromAPI<{ total: number, actions: ActionRecord[] }>(`/api/actions${query}`);
  },

  getActionById: async (actionId: string) => {
    return await fetchFromAPI<ActionRecord>(`/api/actions/${actionId}`);
  },

  approveAction: async (actionId: string) => {
    return await fetchFromAPI<ActionRecord>(`/api/actions/${actionId}/approve`, {
      method: 'POST'
    });
  },

  rejectAction: async (actionId: string, reason?: string) => {
    return await fetchFromAPI<ActionRecord>(`/api/actions/${actionId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || "Rejected by user" })
    });
  },

  executeAction: async (actionId: string) => {
    return await fetchFromAPI<ActionRecord>(`/api/actions/${actionId}/execute`, {
      method: 'POST'
    });
  },

  getAuditEvents: async (filters?: { event_type?: string, entity_type?: string, document_id?: string, decision_id?: string, conflict_id?: string, action_id?: string, limit?: number, offset?: number }) => {
    const queryParts = [];
    if (filters?.event_type) queryParts.push(`event_type=${filters.event_type}`);
    if (filters?.entity_type) queryParts.push(`entity_type=${filters.entity_type}`);
    if (filters?.document_id) queryParts.push(`document_id=${filters.document_id}`);
    if (filters?.decision_id) queryParts.push(`decision_id=${filters.decision_id}`);
    if (filters?.conflict_id) queryParts.push(`conflict_id=${filters.conflict_id}`);
    if (filters?.action_id) queryParts.push(`action_id=${filters.action_id}`);
    if (filters?.limit) queryParts.push(`limit=${filters.limit}`);
    if (filters?.offset) queryParts.push(`offset=${filters.offset}`);
    const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return await fetchFromAPI<{ total: number, events: AuditEventRecord[] }>(`/api/audit${query}`);
  },

  getAuditEventById: async (eventId: string) => {
    return await fetchFromAPI<AuditEventRecord>(`/api/audit/${eventId}`);
  },

  getMemorySummary: async () => {
    return await fetchFromAPI<{
      documents_uploaded: number;
      documents_indexed: number;
      total_chunks: number;
      active_decisions: number;
      replaced_decisions: number;
      ambiguous_decisions: number;
      open_conflicts: number;
      pending_actions: number;
      executed_actions: number;
      audit_events: number;
    }>('/api/memory/summary');
  },

  exportMemory: async () => {
    return await fetchFromAPI<any>('/api/memory/export');
  },

  getSystemStatus: async () => {
    return await fetchFromAPI<{
      backend: Record<string, string>;
      database: Record<string, any>;
      ollama: Record<string, string>;
      chat_model: Record<string, any>;
      embedding_model: Record<string, any>;
      privacy: Record<string, boolean>;
    }>('/api/system/status');
  },

  getSettings: async () => {
    return await fetchFromAPI<{
      local_only: boolean;
      chat_model: string;
      embedding_model: string;
      max_upload_size_mb: number;
      chunk_size_words: number;
      chunk_overlap_words: number;
      search_top_k: number;
    }>('/api/settings');
  },
};
