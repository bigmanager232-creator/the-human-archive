import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';

export default function Login() {
  const { user, login, register, loading } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'register') {
        await register({ email, password, full_name: fullName, organization });
        await login(email, password);
      } else if (mode === 'forgot') {
        const result = await api.forgotPassword(email);
        if (result.reset_token) {
          setSuccess('Lien de r\u00e9initialisation g\u00e9n\u00e9r\u00e9. Copiez le lien ci-dessous :');
          setError(window.location.origin + '/reset-password?token=' + result.reset_token);
        } else {
          setSuccess(result.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-ink)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: 'var(--space-2xl)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-paper)',
            fontSize: '2rem',
            letterSpacing: '0.05em',
          }}>
            The Human <span style={{ color: 'var(--color-accent-soft)', fontWeight: 400 }}>Archive</span>
          </h1>
          <p style={{
            color: 'var(--color-clay)',
            fontSize: '0.875rem',
            marginTop: 'var(--space-sm)',
          }}>
            Archives audiovisuelles contemporaines
          </p>
        </div>

        <div className="card" style={{ background: 'var(--color-white)' }}>
          {mode !== 'forgot' ? (
            <div style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              marginBottom: 'var(--space-lg)',
            }}>
              <button
                className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                style={{ flex: 1 }}
              >
                Connexion
              </button>
              <button
                className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                style={{ flex: 1 }}
              >
                Inscription
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <h3 style={{ marginBottom: 'var(--space-sm)' }}>Mot de passe oubli&eacute;</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-clay)' }}>
                Entrez votre email pour recevoir un lien de r&eacute;initialisation.
              </p>
            </div>
          )}

          {error && (
            <div style={{
              fontSize: '0.875rem',
              marginBottom: 'var(--space-md)',
              padding: 'var(--space-sm)',
              background: mode === 'forgot' && success ? 'rgba(45, 90, 107, 0.08)' : 'rgba(184, 48, 48, 0.08)',
              borderRadius: 'var(--radius-sm)',
              wordBreak: 'break-all',
              color: mode === 'forgot' && success ? 'var(--color-ocean)' : 'var(--color-error)',
            }}>
              {error}
            </div>
          )}

          {success && (
            <p style={{
              color: 'var(--color-forest)',
              fontSize: '0.875rem',
              marginBottom: 'var(--space-md)',
              padding: 'var(--space-sm)',
              background: 'rgba(58, 90, 64, 0.08)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {success}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Nom complet</label>
                  <input
                    className="form-input"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Organisation</label>
                  <input
                    className="form-input"
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="Optionnel"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {mode !== 'forgot' && (
              <div className="form-group">
                <label className="form-label">Mot de passe</label>
                <input
                  className="form-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', padding: 'var(--space-md)' }}
            >
              {submitting
                ? 'Chargement\u2026'
                : mode === 'login'
                  ? 'Se connecter'
                  : mode === 'register'
                    ? 'Cr\u00e9er un compte'
                    : 'Envoyer le lien'}
            </button>
          </form>

          <div style={{ marginTop: 'var(--space-md)', textAlign: 'center' }}>
            {mode === 'forgot' ? (
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-ocean)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textDecoration: 'underline',
                }}
              >
                Retour &agrave; la connexion
              </button>
            ) : (
              <button
                onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-clay)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  textDecoration: 'underline',
                }}
              >
                Mot de passe oubli&eacute; ?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
