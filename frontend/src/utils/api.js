/**
 * Client API pour The Human Archive.
 * Gère l'authentification JWT et les requêtes vers le backend.
 */

const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  setTokens(access, refresh) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  get isAuthenticated() {
    return !!this.accessToken;
  }

  async request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = {
      ...(options.headers || {}),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Ne pas définir Content-Type pour FormData (le navigateur le fait)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Token expiré → tenter le refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.attemptRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        return fetch(url, { ...options, headers });
      }
    }

    return response;
  }

  async attemptRefresh() {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        this.setTokens(data.access_token, data.refresh_token);
        return true;
      }
    } catch {
      // ignore
    }

    this.clearTokens();
    return false;
  }

  // ── Auth ────────────────────────────────────

  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Identifiants incorrects');
    const data = await res.json();
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async register(userData) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Erreur lors de l\'inscription');
    }
    return res.json();
  }

  async getMe() {
    const res = await this.request('/auth/me');
    if (!res.ok) throw new Error('Non authentifié');
    return res.json();
  }

  logout() {
    this.clearTokens();
  }

  // ── Archives ────────────────────────────────

  async getArchives(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await this.request(`/archives/?${query}`);
    if (!res.ok) throw new Error('Erreur de chargement');
    return res.json();
  }

  async getArchive(id) {
    const res = await this.request(`/archives/${id}`);
    if (!res.ok) throw new Error('Archive non trouvée');
    return res.json();
  }

  async createArchive(metadata, file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('data', JSON.stringify(metadata));

    // Utiliser XMLHttpRequest pour le suivi de progression
    if (onProgress) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE}/archives/`);
        if (this.accessToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
        }
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            let detail = 'Erreur lors du dépôt';
            try {
              const err = JSON.parse(xhr.responseText);
              detail = err.detail || detail;
            } catch {}
            reject(new Error(detail));
          }
        };
        xhr.onerror = () => reject(new Error('Erreur réseau — le fichier est peut-être trop volumineux'));
        xhr.ontimeout = () => reject(new Error('Délai dépassé — essayez avec un fichier plus petit'));
        xhr.timeout = 600000; // 10 minutes
        xhr.send(formData);
      });
    }

    const res = await this.request('/archives/', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      let detail = 'Erreur lors du dépôt';
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {}
      throw new Error(detail);
    }
    return res.json();
  }

  async updateArchive(id, data) {
    const res = await this.request(`/archives/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur de mise à jour');
    return res.json();
  }

  async searchArchives(query, params = {}) {
    const allParams = { q: query, ...params };
    const qs = new URLSearchParams(allParams).toString();
    const res = await this.request(`/archives/search/?${qs}`);
    if (!res.ok) throw new Error('Erreur de recherche');
    return res.json();
  }

  async exportArchivesCsv(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await this.request(`/archives/export/csv?${query}`);
    if (!res.ok) throw new Error('Erreur lors de l\'export');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'archives-metadonnees.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Upload par URL pré-signée (gros fichiers) ──

  async getUploadUrl(filename, contentType, fileSize) {
    const res = await this.request('/archives/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        content_type: contentType,
        file_size: fileSize,
      }),
    });
    if (!res.ok) throw new Error('Erreur d\'upload');
    return res.json();
  }

  // ── Territories ─────────────────────────────

  async getTerritories() {
    const res = await this.request('/territories/');
    if (!res.ok) throw new Error('Erreur de chargement');
    return res.json();
  }

  async getTerritoriesWithStats() {
    const res = await this.request('/territories/stats');
    if (!res.ok) throw new Error('Erreur de chargement');
    return res.json();
  }

  async createTerritory(data) {
    const res = await this.request('/territories/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erreur de création');
    return res.json();
  }
}

export const api = new ApiClient();
export default api;
