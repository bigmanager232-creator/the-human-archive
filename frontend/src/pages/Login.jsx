import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { user, login, register, loading } = useAuth();
  const [mode, setMode] = useState('login'); // login | register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ email, password, full_name: fullName, organization });
        await login(email, password);
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
          <div style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-lg)',
          }}>
            <button
              className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('login')}
              style={{ flex: 1 }}
            >
              Connexion
            </button>
            <button
              className={`btn ${mode === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('register')}
              style={{ flex: 1 }}
            >
              Inscription
            </button>
          </div>

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

            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', padding: 'var(--space-md)' }}
            >
              {submitting ? 'Chargement…' : mode === 'login' ? 'Se connecter' : 'Créer un compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
