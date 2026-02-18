import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../utils/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-ink)',
      }}>
        <div className="card" style={{ maxWidth: '420px', background: 'var(--color-white)', textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Lien invalide</h2>
          <p style={{ color: 'var(--color-clay)', marginBottom: 'var(--space-lg)' }}>
            Ce lien de r&eacute;initialisation est invalide ou a expir&eacute;.
          </p>
          <Link to="/login" className="btn btn-primary">Retour &agrave; la connexion</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-ink)',
      }}>
        <div className="card" style={{ maxWidth: '420px', background: 'var(--color-white)', textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--space-md)' }}>Mot de passe modifi&eacute;</h2>
          <p style={{ color: 'var(--color-earth)', marginBottom: 'var(--space-lg)' }}>
            Votre mot de passe a &eacute;t&eacute; r&eacute;initialis&eacute; avec succ&egrave;s.
          </p>
          <Link to="/login" className="btn btn-primary">Se connecter</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-ink)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: 'var(--space-2xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-paper)',
            fontSize: '2rem',
            letterSpacing: '0.05em',
          }}>
            The Human <span style={{ color: 'var(--color-accent-soft)', fontWeight: 400 }}>Archive</span>
          </h1>
        </div>

        <div className="card" style={{ background: 'var(--color-white)' }}>
          <h3 style={{ marginBottom: 'var(--space-lg)' }}>Nouveau mot de passe</h3>

          {error && (
            <p style={{
              color: 'var(--color-error)',
              fontSize: '0.875rem',
              marginBottom: 'var(--space-md)',
              padding: 'var(--space-sm)',
              background: 'rgba(184, 48, 48, 0.08)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nouveau mot de passe</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmer le mot de passe</label>
              <input
                className="form-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', padding: 'var(--space-md)' }}
            >
              {submitting ? 'R\u00e9initialisation\u2026' : 'R\u00e9initialiser le mot de passe'}
            </button>
          </form>

          <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
            <Link to="/login" style={{ color: 'var(--color-clay)', fontSize: '0.85rem' }}>
              Retour &agrave; la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
