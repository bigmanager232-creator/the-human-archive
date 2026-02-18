import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

function withToken(url) {
  if (!url) return url;
  const token = localStorage.getItem('access_token');
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

export default function Archives() {
  const [archives, setArchives] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const fetchArchives = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 12 };
      if (mediaFilter) params.media_type = mediaFilter;

      let data;
      if (searchQuery.length >= 2) {
        data = await api.searchArchives(searchQuery, params);
      } else {
        data = await api.getArchives(params);
      }
      setArchives(data.items || []);
      setTotal(data.total || 0);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, mediaFilter]);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = {};
      if (mediaFilter) params.media_type = mediaFilter;
      await api.exportArchivesCsv(params);
    } catch {
      // erreur silencieuse
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="container main-content">
      <h1 style={{ marginBottom: 'var(--space-xl)' }}>Archives</h1>

      {/* Search & Filters */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-xl)',
        flexWrap: 'wrap',
      }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '280px' }}>
          <span className="search-bar-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher dans les archives…"
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          {['', 'video', 'audio', 'image', 'document'].map((type) => (
            <button
              key={type}
              className={`btn ${mediaFilter === type ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setMediaFilter(type); setPage(1); }}
            >
              {type || 'Tous'}
            </button>
          ))}
        </div>
      </div>

      {/* Results info + Export */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
      }}>
        <p style={{
          color: 'var(--color-clay)',
          fontSize: '0.875rem',
          fontFamily: 'var(--font-mono)',
          margin: 0,
        }}>
          {total} résultat{total !== 1 ? 's' : ''}{searchQuery && ` pour "${searchQuery}"`}
        </p>
        {total > 0 && (
          <button
            className="btn btn-secondary"
            onClick={handleExportCsv}
            disabled={exporting}
            style={{ fontSize: '0.8rem' }}
          >
            {exporting ? 'Export en cours…' : 'Exporter CSV'}
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <p style={{ color: 'var(--color-clay)' }}>Chargement…</p>
      ) : archives.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <p style={{ color: 'var(--color-clay)' }}>Aucune archive trouvée.</p>
        </div>
      ) : (
        <div className="archive-grid">
          {archives.map((archive) => (
            <Link key={archive.id} to={`/archives/${archive.id}`} className="archive-card-link">
              <div className="card card--has-thumb">
                {archive.thumbnail_url ? (
                  <div className="card-thumbnail">
                    <img
                      src={withToken(archive.thumbnail_url)}
                      alt=""
                      onError={(e) => { e.target.closest('.card-thumbnail').style.display = 'none'; }}
                    />
                  </div>
                ) : null}
                <div className="card-header">
                  <span className={`badge badge--${archive.media_type}`}>
                    {archive.media_type}
                  </span>
                  <span className={`badge badge--${archive.status}`}>
                    {archive.status}
                  </span>
                </div>
                <h3 style={{ marginBottom: 'var(--space-sm)' }}>{archive.title}</h3>
                {archive.description && (
                  <p style={{
                    fontSize: '0.9rem',
                    color: 'var(--color-earth)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {archive.description}
                  </p>
                )}
                <div className="card-meta" style={{ marginTop: 'var(--space-md)' }}>
                  {archive.recording_location && <span>{archive.recording_location} · </span>}
                  {archive.file_size_bytes && (
                    <span>{(archive.file_size_bytes / 1048576).toFixed(1)} Mo · </span>
                  )}
                  {new Date(archive.created_at).toLocaleDateString('fr-FR')}
                </div>
                {archive.tags?.length > 0 && (
                  <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                    {archive.tags.map((tag) => (
                      <span key={tag} style={{
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        background: 'var(--color-paper-warm)',
                        borderRadius: '12px',
                        color: 'var(--color-earth)',
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-clay)',
                  }}>
                    {archive.license_type} · {archive.access_level}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 'var(--space-sm)',
          marginTop: 'var(--space-xl)',
        }}>
          <button
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Précédent
          </button>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.875rem',
            color: 'var(--color-clay)',
          }}>
            {page} / {totalPages}
          </span>
          <button
            className="btn btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
