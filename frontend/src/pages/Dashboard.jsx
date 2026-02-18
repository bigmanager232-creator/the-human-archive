import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';

function withToken(url) {
  if (!url) return url;
  const token = localStorage.getItem('access_token');
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getArchives({ page: 1, page_size: 6 })
      .then((data) => setArchives(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total: archives.length,
    video: archives.filter(a => a.media_type === 'video').length,
    audio: archives.filter(a => a.media_type === 'audio').length,
    image: archives.filter(a => a.media_type === 'image').length,
  };

  return (
    <div className="container main-content">
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <h1>Bonjour, {user?.full_name}</h1>
        <p style={{ color: 'var(--color-earth)', marginTop: 'var(--space-sm)' }}>
          Bienvenue sur The Human Archive
        </p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Archives</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.video}</div>
          <div className="stat-label">Vidéos</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.audio}</div>
          <div className="stat-label">Audio</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.image}</div>
          <div className="stat-label">Images</div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
      }}>
        <h2>Archives récentes</h2>
        <Link to="/upload" className="btn btn-primary">
          + Nouveau dépôt
        </Link>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-clay)' }}>Chargement…</p>
      ) : archives.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <p style={{ color: 'var(--color-clay)', marginBottom: 'var(--space-md)' }}>
            Aucune archive pour le moment.
          </p>
          <Link to="/upload" className="btn btn-primary">
            Déposer votre première archive
          </Link>
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
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
