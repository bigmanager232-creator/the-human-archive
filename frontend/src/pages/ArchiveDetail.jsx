import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';

function withToken(url) {
  if (!url) return url;
  const token = localStorage.getItem('access_token');
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

function MediaPlayer({ archive }) {
  const { media_type, file_url, title, mime_type } = archive;

  if (!file_url) {
    return (
      <div className="media-player media-player--empty">
        <p>Fichier non disponible</p>
      </div>
    );
  }

  if (media_type === 'video') {
    return (
      <div className="media-player media-player--video">
        <video controls preload="metadata">
          <source src={withToken(file_url)} type={mime_type || 'video/mp4'} />
          Votre navigateur ne supporte pas la lecture vidéo.
        </video>
      </div>
    );
  }

  if (media_type === 'audio') {
    return (
      <div className="media-player media-player--audio">
        <div className="audio-visual">
          <div className="audio-icon">&#9835;</div>
          <h3>{title}</h3>
        </div>
        <audio controls preload="metadata" style={{ width: '100%' }}>
          <source src={withToken(file_url)} type={mime_type || 'audio/mpeg'} />
          Votre navigateur ne supporte pas la lecture audio.
        </audio>
      </div>
    );
  }

  if (media_type === 'image') {
    return (
      <div className="media-player media-player--image">
        <img
          src={withToken(file_url)}
          alt={title}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.insertAdjacentHTML('afterend',
              '<p style="color: var(--color-clay); padding: 2rem; text-align: center;">Impossible de charger l\'image</p>'
            );
          }}
        />
      </div>
    );
  }

  // document
  return (
    <div className="media-player media-player--document">
      <div className="document-icon">&#128196;</div>
      <p>Document</p>
      <a href={withToken(file_url)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
        Télécharger le fichier
      </a>
    </div>
  );
}

function MetadataItem({ label, children }) {
  if (!children) return null;
  return (
    <div className="metadata-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return null;
  if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} Go`;
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} Mo`;
  return `${(bytes / 1024).toFixed(0)} Ko`;
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ACCESS_LABELS = {
  public: 'Public',
  partner: 'Partenaire',
  restricted: 'Restreint',
  private: 'Privé',
};

const STATUS_LABELS = {
  draft: 'Brouillon',
  review: 'En révision',
  published: 'Publié',
  archived: 'Archivé',
};

const WORKFLOW = {
  draft:     { next: 'review',    label: 'Soumettre en révision',  nextLabel: 'En révision' },
  review:    { next: 'published', label: 'Publier',                nextLabel: 'Publié' },
  published: { next: 'archived',  label: 'Archiver',              nextLabel: 'Archivé' },
};

const REPORT_REASONS = [
  'Contenu pornographique ou sexuellement explicite',
  'Discours haineux, racisme ou discrimination',
  'Violence ou incitation à la violence',
  'Contenu trompeur ou faux',
  'Violation des droits d\'auteur',
  'Autre',
];

export default function ArchiveDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [archive, setArchive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [reportError, setReportError] = useState('');

  const handleReport = async () => {
    const reason = reportReason === 'Autre'
      ? reportDetail
      : `${reportReason}${reportDetail ? ` — ${reportDetail}` : ''}`;
    if (!reason || reason.length < 5) return;
    try {
      await api.reportArchive(archive.id, reason);
      setReportSent(true);
      setShowReport(false);
    } catch (err) {
      setReportError(err.message);
    }
  };

  const handleAdminDelete = async () => {
    if (!window.confirm('Supprimer cette archive ? Cette action est irréversible.')) return;
    try {
      await api.deleteArchive(archive.id);
      navigate('/archives');
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const handleAdminHide = async () => {
    try {
      await api.hideArchive(archive.id);
      setArchive(prev => ({ ...prev, status: 'draft' }));
    } catch {
      setError('Erreur lors du masquage');
    }
  };

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getArchive(id)
      .then(setArchive)
      .catch(() => setError('Archive non trouvée'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container main-content">
        <p style={{ color: 'var(--color-clay)' }}>Chargement…</p>
      </div>
    );
  }

  if (error || !archive) {
    return (
      <div className="container main-content">
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Archive non trouvée</h2>
          <p style={{ color: 'var(--color-clay)', marginBottom: 'var(--space-lg)' }}>
            Cette archive n'existe pas ou vous n'y avez pas accès.
          </p>
          <Link to="/archives" className="btn btn-primary">Retour aux archives</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container main-content archive-detail">
      {/* Navigation */}
      <Link to="/archives" className="archive-detail-back">
        &larr; Retour aux archives
      </Link>

      {/* Media player */}
      <MediaPlayer archive={archive} />

      {/* Content */}
      <div className="archive-detail-content">
        {/* Main column */}
        <div className="archive-detail-main">
          <div className="archive-detail-header">
            <span className={`badge badge--${archive.media_type}`}>{archive.media_type}</span>
            <span className={`badge badge--${archive.status}`}>
              {STATUS_LABELS[archive.status] || archive.status}
            </span>
          </div>

          <h1>{archive.title}</h1>

          {archive.description && (
            <div className="archive-detail-section">
              <h3>Description</h3>
              <p>{archive.description}</p>
            </div>
          )}

          {archive.context_notes && (
            <div className="archive-detail-section">
              <h3>Notes de contexte</h3>
              <p>{archive.context_notes}</p>
            </div>
          )}

          {archive.participants?.length > 0 && (
            <div className="archive-detail-section">
              <h3>Participants</h3>
              <ul style={{ paddingLeft: 'var(--space-lg)' }}>
                {archive.participants.map((p, i) => (
                  <li key={i}>{p.name || p.nom || JSON.stringify(p)}</li>
                ))}
              </ul>
            </div>
          )}

          {archive.tags?.length > 0 && (
            <div className="archive-detail-section">
              <h3>Tags</h3>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {archive.tags.map((tag) => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Bouton Signaler */}
          <div style={{ marginTop: 'var(--space-xl)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--color-paper-warm)' }}>
            {reportSent ? (
              <p style={{ color: 'var(--color-forest)', fontSize: '0.9rem' }}>
                Signalement envoy&eacute;. Merci pour votre vigilance.
              </p>
            ) : !showReport ? (
              <button
                className="btn btn-secondary"
                onClick={() => setShowReport(true)}
                style={{ fontSize: '0.85rem', color: 'var(--color-error)' }}
              >
                Signaler ce contenu
              </button>
            ) : (
              <div style={{
                padding: 'var(--space-lg)',
                background: 'rgba(184, 48, 48, 0.04)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(184, 48, 48, 0.15)',
              }}>
                <h4 style={{ marginBottom: 'var(--space-md)', color: 'var(--color-error)' }}>
                  Signaler ce contenu
                </h4>
                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Motif du signalement</label>
                  <select
                    className="form-select"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  >
                    <option value="">-- Choisir un motif --</option>
                    {REPORT_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Pr&eacute;cisions (optionnel)</label>
                  <textarea
                    className="form-textarea"
                    value={reportDetail}
                    onChange={(e) => setReportDetail(e.target.value)}
                    placeholder="D&eacute;crivez le probl&egrave;me..."
                    rows={3}
                  />
                </div>
                {reportError && (
                  <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginBottom: 'var(--space-sm)' }}>
                    {reportError}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleReport}
                    disabled={!reportReason}
                    style={{ background: 'var(--color-error)' }}
                  >
                    Envoyer le signalement
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { setShowReport(false); setReportError(''); }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions admin */}
          {user?.role === 'admin' && (
            <div style={{
              marginTop: 'var(--space-lg)',
              padding: 'var(--space-lg)',
              background: 'rgba(184, 48, 48, 0.04)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(184, 48, 48, 0.15)',
            }}>
              <h4 style={{ marginBottom: 'var(--space-md)' }}>Actions administrateur</h4>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                {archive.status === 'published' && (
                  <button className="btn btn-secondary" onClick={handleAdminHide}>
                    Masquer cette archive
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={handleAdminDelete}
                  style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                >
                  Supprimer d&eacute;finitivement
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="archive-detail-sidebar">
          <dl className="metadata-grid">
            <MetadataItem label="Type">{archive.media_type}</MetadataItem>
            <MetadataItem label="Taille">{formatSize(archive.file_size_bytes)}</MetadataItem>
            <MetadataItem label="Durée">{formatDuration(archive.duration_seconds)}</MetadataItem>
            <MetadataItem label="Format">{archive.mime_type}</MetadataItem>
            <MetadataItem label="Lieu">{archive.recording_location}</MetadataItem>
            <MetadataItem label="Date d'enregistrement">
              {archive.recording_date && new Date(archive.recording_date).toLocaleDateString('fr-FR')}
            </MetadataItem>
            <MetadataItem label="Langue">{archive.language_spoken}</MetadataItem>
            <MetadataItem label="Licence">{archive.license_type}</MetadataItem>
            <MetadataItem label="Titulaire">{archive.rights_holder}</MetadataItem>
            <MetadataItem label="Accès">{ACCESS_LABELS[archive.access_level] || archive.access_level}</MetadataItem>
            <MetadataItem label="Consentement">{archive.consent_obtained ? 'Oui' : 'Non'}</MetadataItem>
            <MetadataItem label="Déposé le">
              {new Date(archive.created_at).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </MetadataItem>
          </dl>

          {/* Workflow éditorial (admin uniquement) */}
          {user?.role === 'admin' && WORKFLOW[archive.status] && (
            <div className="workflow-panel">
              <h4 className="workflow-title">Workflow éditorial</h4>
              <div className="workflow-status">
                <span className={`badge badge--${archive.status}`}>
                  {STATUS_LABELS[archive.status]}
                </span>
                <span className="workflow-arrow">&rarr;</span>
                <span className={`badge badge--${WORKFLOW[archive.status].next}`}>
                  {WORKFLOW[archive.status].nextLabel}
                </span>
              </div>
              <button
                className="btn btn-primary workflow-btn"
                disabled={updating}
                onClick={async () => {
                  setUpdating(true);
                  try {
                    const updated = await api.updateArchive(archive.id, {
                      status: WORKFLOW[archive.status].next,
                    });
                    setArchive(updated);
                  } catch {
                    setError('Erreur lors du changement de statut');
                  } finally {
                    setUpdating(false);
                  }
                }}
              >
                {updating ? 'Mise à jour…' : WORKFLOW[archive.status].label}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
