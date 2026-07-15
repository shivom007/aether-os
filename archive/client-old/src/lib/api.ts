// src/lib/api.ts

const API_BASE = 'http://localhost:8080/api/v1';

export class ApiClient {
  private static token: string | null = null;

  static setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  static getToken(): string | null {
    return this.token || localStorage.getItem('token');
  }

  private static getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const t = this.getToken();
    if (t) {
      headers['Authorization'] = `Bearer ${t}`;
    }
    return headers;
  }

  // === AUTH ===
  static async register(username: string, authHash: string) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ username, authHash }),
    });
    const data = await res.json();
    if (data.token) this.setToken(data.token);
    return data;
  }

  static async login(username: string, authHash: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ username, authHash }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (data.token) this.setToken(data.token);
    return data;
  }

  // === FILESYSTEM ===
  static async listFiles(parentId?: number) {
    const url = new URL(`${API_BASE}/fs`);
    if (parentId !== undefined) url.searchParams.append('parentId', parentId.toString());
    
    const res = await fetch(url.toString(), { headers: this.getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async registerFile(name: string, size: number, mimeType: string, folderId?: number) {
    const res = await fetch(`${API_BASE}/fs/file`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, size, mimeType, folderId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async getFileDetails(fileId: number) {
    const res = await fetch(`${API_BASE}/fs/file/${fileId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async deleteFile(fileId: number) {
    const res = await fetch(`${API_BASE}/fs/file/${fileId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // === SHARDS ===
  static async allocateShards(fileVersionId: number, chunkIndex: number, chunkSize: number) {
    const res = await fetch(`${API_BASE}/shards/allocate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ fileVersionId, chunkIndex, chunkSize }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async uploadShard(shardId: number, file: Blob) {
    const formData = new FormData();
    formData.append('shardId', shardId.toString());
    formData.append('file', file); // Encrypted shard payload

    // Form data doesn't use Content-Type: application/json
    const headers: HeadersInit = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}/shards/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  static async downloadShard(shardId: number): Promise<ArrayBuffer> {
    const res = await fetch(`${API_BASE}/shards/download/${shardId}?t=${Date.now()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.arrayBuffer();
  }

  static async getProviders() {
    const res = await fetch(`${API_BASE}/providers`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('Failed to fetch providers');
    return res.json();
  }

  static async linkAWS(data: any) {
    const res = await fetch(`${API_BASE}/providers/aws`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to link AWS');
    return res.json();
  }

  static async unlinkProvider(id: number) {
    const res = await fetch(`${API_BASE}/providers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    if (!res.ok) throw new Error('Failed to unlink provider');
    return res.json();
  }
}
