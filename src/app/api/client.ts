export const API_BASE_URL = '';

export interface Room {
  room_id: string;
  name: string;
  created_at: string;
  participant_count: number;
}

export interface RoomListResponse {
  rooms: Room[];
}

export interface MixRevision {
  revision_no: number;
  switchover_ms: number;
  length_ms: number;
  audio_url: string;
}

export interface MixTrackSegment {
  position: number;
  start_ms: number;
  end_ms: number;
  source_start_ms: number;
  song_name: string;
  artist_name: string;
}

export interface MixResponse {
  mix_id: string;
  revision: MixRevision;
  tracklist: MixTrackSegment[];
}

export interface TrackMetadata {
  artist: string;
  title: string;
  bpm?: number;
}

// --- Base Client ---

const baseClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text) return {} as T;

    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('API returned non-JSON response:', text);
      return text as unknown as T;
    }
  },

  post: async <T>(endpoint: string, data: any): Promise<T> => {
    const isFormData = data instanceof FormData;
    const headers: HeadersInit | undefined = isFormData ? undefined : { 'Content-Type': 'application/json' };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: isFormData ? data : JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response Body:', errorText);
      try {
        const err = JSON.parse(errorText);
        console.error('API Error Details (JSON):', err);
      } catch (e) {
        // Not JSON
      }
      throw new Error(`API Error: ${response.statusText}`);
    }

    // Check if response has content
    const text = await response.text();
    if (!text) return {} as T;

    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('API returned non-JSON response:', text);
      return text as unknown as T;
    }
  },

  patch: async <T>(endpoint: string, data: any): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
  }
};

// --- API Methods ---

export const apiClient = {
  // Rooms
  getRooms: () => baseClient.get<RoomListResponse>('/v1/rooms'),

  createRoom: (name: string, files: File[], metadatas: TrackMetadata[]) => {
    const formData = new FormData();
    formData.append('name', name);
    files.forEach(f => formData.append('files', f));
    formData.append('tracks_metadata', JSON.stringify(metadatas.map(m => ({
      artist_name: m.artist,
      song_name: m.title
    }))));
    return baseClient.post<Room>('/v1/rooms', formData);
  },

  uploadRoomTracks: (roomId: string, files: File[], metadatas: TrackMetadata[], clientPlayheadMs: number) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('tracks_metadata', JSON.stringify(metadatas.map(m => ({
      artist_name: m.artist,
      song_name: m.title
    }))));
    formData.append('client_playhead_ms', clientPlayheadMs.toString());
    return baseClient.post<void>(`/v1/rooms/${roomId}/tracks:upload`, formData);
  },

  // Mixes
  createMix: (files: File[], metadatas: TrackMetadata[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('tracks_metadata', JSON.stringify(metadatas.map(m => ({
      artist_name: m.artist,
      song_name: m.title
    }))));
    return baseClient.post<MixResponse>('/v1/mixes', formData);
  },

  getMix: (mixId: string) => baseClient.get<MixResponse>(`/v1/mixes/${mixId}`),

  getMixRevision: (mixId: string, revisionNo: number) =>
    baseClient.get<MixResponse>(`/v1/mixes/${mixId}/revisions/${revisionNo}`),

  addTracksToMix: (mixId: string, files: File[], metadatas: TrackMetadata[], clientPlayheadMs: number) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('tracks_metadata', JSON.stringify(metadatas.map(m => ({
      artist_name: m.artist,
      song_name: m.title
    }))));
    formData.append('client_playhead_ms', clientPlayheadMs.toString());
    return baseClient.post<void>(`/v1/mixes/${mixId}/tracks:upload`, formData);
  },

  deleteRoom: (roomId: string) => {
    return fetch(`${API_BASE_URL}/v1/rooms/${roomId}`, { method: 'DELETE' });
  }
};
