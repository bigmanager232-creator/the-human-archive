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

function AdminPasswordReset() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getUsers()
      .then((data) => setUsers(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setMessage('');
    setError('');
    setSubmitting(true);
    try {
      await api.adminResetPassword(selectedUser, newPassword);
      setMessage('Mot de passe r\u00e9initialis\u00e9 avec succ\u00e8s.');
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--color-clay)' }}>Chargement des utilisateurs...</p>;

  return (
    <div className="card" style={{ padding: 'var(--space-lg)' }}>
      {message && (
        <p style={{
          color: 'var(--color-forest)',
          fontSize: '0.875rem',
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-sm)',
          background: 'rgba(58, 90, 64, 0.08)',
          borderRadius: 'var(--radius-sm)',
        }}>{message}</p>
      )}
      {error && (
        <p style={{
          color: 'var(--color-error)',
          fontSize: '0.875rem',
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-sm)',
          background: 'rgba(184, 48, 48, 0.08)',
          borderRadius: 'var(--radius-sm)',
        }}>{error}</p>
      )}
      <form onSubmit={handleReset}>
        <div className="form-group">
          <label className="form-label">Utilisateur</label>
          <select
            className="form-input"
            value={selectedUser || ''}
            onChange={(e) => setSelectedUser(e.target.value || null)}
            required
          >
            <option value="">S&eacute;lectionner un utilisateur</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Nouveau mot de passe</label>
          <input
            className="form-input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={submitting || !selectedUser}
        >
          {submitting ? 'R\u00e9initialisation\u2026' : 'R\u00e9initialiser le mot de passe'}
        </button>
      </form>
    </div>
  );
}

function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = () => {
    setLoading(true);
    api.getReports('pending')
      .then((data) => setReports(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, []);

  const handleDismiss = async (reportId) => {
    try {
      await api.dismissReport(reportId);
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch {}
  };

  const handleHide = async (archiveId) => {
    try {
      await api.hideArchive(archiveId);
      setReports(prev => prev.filter(r => r.archive_id !== archiveId));
    } catch {}
  };

  const handleDelete = async (archiveId) => {
    if (!window.confirm('Supprimer cette archive ? Cette action est irr\u00e9versible.')) return;
    try {
      await api.deleteArchive(archiveId);
      setReports(prev => prev.filter(r => r.archive_id !== archiveId));
    } catch {}
  };

  if (loading) return <p style={{ color: 'var(--color-clay)' }}>Chargement des signalements...</p>;
  if (reports.length === 0) return <p style={{ color: 'var(--color-clay)' }}>Aucun signalement en attente.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {reports.map((report) => (
        <div key={report.id} className="card" style={{
          borderLeft: '4px solid var(--color-error)',
          padding: 'var(--space-lg)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: 'var(--space-xs)' }}>
                <Link to={`/archives/${report.archive_id}`} style={{ color: 'var(--color-ink)' }}>
                  {report.archive_title || 'Archive'}
                </Link>
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-earth)', marginBottom: 'var(--space-xs)' }}>
                Signal&eacute; par {report.reporter_name || 'Utilisateur'} &mdash;{' '}
                {new Date(report.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
              <p style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--color-error)' }}>
                {report.reason}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => handleDismiss(report.id)} style={{ fontSize: '0.8rem' }}>
                Lever le signalement
              </button>
              <button className="btn btn-secondary" onClick={() => handleHide(report.archive_id)} style={{ fontSize: '0.8rem' }}>
                Masquer
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleDelete(report.archive_id)}
                style={{ fontSize: '0.8rem', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
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
          <div className="stat-label">Vid&eacute;os</div>
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

      {/* Section admin : contenus signal&eacute;s */}
      {user?.role === 'admin' && (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>Contenus signal&eacute;s</h2>
          <AdminReports />
        </div>
      )}

      {/* Section admin : r&eacute;initialisation mot de passe */}
      {user?.role === 'admin' && (
        <div style={{ marginBottom: 'var(--space-2xl)' }}>
          <h2 style={{ marginBottom: 'var(--space-lg)' }}>R&eacute;initialiser un mot de passe</h2>
          <AdminPasswordReset />
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
      }}>
        <h2>Archives r&eacute;centes</h2>
        <Link to="/upload" className="btn btn-primary">
          + Nouveau d&eacute;p&ocirc;t
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
            D&eacute;poser votre premi&egrave;re archive
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
