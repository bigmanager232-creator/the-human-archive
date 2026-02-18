import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Upload() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: fichier, 2: contexte, 3: droits
  const [dragActive, setDragActive] = useState(false);
  const [territoryHint, setTerritoryHint] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    media_type: 'video',
    territory_id: '',
    recording_date: '',
    recording_location: '',
    language_spoken: 'fr',
    tags: '',
    context_notes: '',
    license_type: 'all-rights-reserved',
    rights_holder: '',
    access_level: 'restricted',
    consent_obtained: false,
  });

  useEffect(() => {
    api.getTerritories().then(setTerritories).catch(() => {});
  }, []);

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));

    // Auto-suggestion du territoire quand l'utilisateur tape un lieu
    if (field === 'recording_location' && value.length >= 2 && territories.length > 0) {
      const location = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let bestMatch = null;
      let bestScore = 0;

      for (const t of territories) {
        const name = t.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const country = t.country.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const full = `${name}, ${country}`;

        // Correspondance exacte du nom de ville
        if (location.includes(name) || name.includes(location)) {
          const score = name.length;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = t;
          }
        }
        // Correspondance sur "ville, pays"
        if (location.includes(full) || full.includes(location)) {
          const score = full.length + 100; // priorité haute
          if (score > bestScore) {
            bestScore = score;
            bestMatch = t;
          }
        }
      }

      if (bestMatch && form.territory_id !== bestMatch.id) {
        setForm(prev => ({ ...prev, territory_id: bestMatch.id }));
        setTerritoryHint(`→ ${bestMatch.name} (${bestMatch.country})`);
      } else if (!bestMatch) {
        setTerritoryHint('');
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (f) => {
    setFile(f);
    // Détecter le type de média
    const mime = f.type || '';
    if (mime.startsWith('video/')) updateForm('media_type', 'video');
    else if (mime.startsWith('audio/')) updateForm('media_type', 'audio');
    else if (mime.startsWith('image/')) updateForm('media_type', 'image');
    else updateForm('media_type', 'document');

    // Pré-remplir le titre
    if (!form.title) {
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      updateForm('title', name);
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setUploadProgress(0);
    setError('');

    try {
      const metadata = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        territory_id: form.territory_id || undefined,
        recording_date: form.recording_date || undefined,
      };
      await api.createArchive(metadata, file, (progress) => {
        setUploadProgress(progress);
      });
      navigate('/archives');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const formatSize = (bytes) => {
    if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} Go`;
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} Mo`;
    return `${(bytes / 1024).toFixed(0)} Ko`;
  };

  return (
    <div className="container main-content">
      <h1 style={{ marginBottom: 'var(--space-sm)' }}>Déposer une archive</h1>
      <p style={{ color: 'var(--color-earth)', marginBottom: 'var(--space-xl)' }}>
        Ajoutez un document audiovisuel avec son contexte documentaire.
      </p>

      {/* Step indicators */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-xl)',
      }}>
        {[
          { num: 1, label: 'Fichier' },
          { num: 2, label: 'Contextualisation' },
          { num: 3, label: 'Droits & diffusion' },
        ].map(({ num, label }) => (
          <button
            key={num}
            onClick={() => num <= (file ? 3 : 1) && setStep(num)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-md)',
              background: step === num ? 'var(--color-accent)' : num < step ? 'var(--color-forest)' : 'var(--color-paper-warm)',
              color: step === num || num < step ? 'var(--color-white)' : 'var(--color-clay)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: num <= (file ? 3 : 1) ? 'pointer' : 'default',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              letterSpacing: '0.03em',
            }}
          >
            <span style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}>
              {num < step ? '✓' : num}
            </span>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: 'var(--space-md)',
          background: 'rgba(184, 48, 48, 0.08)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-error)',
          marginBottom: 'var(--space-lg)',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* STEP 1: File */}
        {step === 1 && (
          <div
            className={`upload-zone ${dragActive ? 'active' : ''}`}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              accept="video/*,audio/*,image/*,.pdf,.doc,.docx"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <div className="upload-zone-icon" style={{ fontSize: '3rem' }}>📂</div>
            <h3 style={{ marginBottom: 'var(--space-sm)' }}>
              Glissez votre fichier ici
            </h3>
            <p style={{ color: 'var(--color-clay)', fontSize: '0.9rem' }}>
              ou cliquez pour parcourir · Vidéo, audio, image, document · Max 2 Go
            </p>
          </div>
        )}

        {/* STEP 2: Contextualization */}
        {step === 2 && (
          <div className="card">
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Contextualisation documentaire</h2>

            {file && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                padding: 'var(--space-md)',
                background: 'var(--color-paper-warm)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-lg)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
              }}>
                <select
                  value={form.media_type}
                  onChange={(e) => updateForm('media_type', e.target.value)}
                  className={`badge badge--${form.media_type}`}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer',
                    paddingRight: 'var(--space-md)',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\'%3E%3Cpath d=\'M0 0l5 6 5-6z\' fill=\'currentColor\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 4px center',
                  }}
                  title="Modifier le type de média"
                >
                  <option value="video">video</option>
                  <option value="audio">audio</option>
                  <option value="image">image</option>
                  <option value="document">document</option>
                </select>
                <span style={{ flex: 1 }}>{file.name}</span>
                <span style={{ color: 'var(--color-clay)' }}>{formatSize(file.size)}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Titre *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  required
                  placeholder="Titre descriptif de l'archive"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Description du contenu, du contexte de production…"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Territoire</label>
                <select
                  className="form-select"
                  value={form.territory_id}
                  onChange={(e) => {
                    updateForm('territory_id', e.target.value);
                    setTerritoryHint('');
                  }}
                >
                  <option value="">— Sélectionner —</option>
                  {territories.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.country})</option>
                  ))}
                </select>
                {territoryHint && (
                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--color-forest)',
                    marginTop: 'var(--space-xs)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {territoryHint}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Lieu d'enregistrement</label>
                <input
                  className="form-input"
                  value={form.recording_location}
                  onChange={(e) => updateForm('recording_location', e.target.value)}
                  placeholder="Ville, région, pays"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date d'enregistrement</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.recording_date}
                  onChange={(e) => updateForm('recording_date', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Langue parlée</label>
                <select
                  className="form-select"
                  value={form.language_spoken}
                  onChange={(e) => updateForm('language_spoken', e.target.value)}
                >
                  <option value="fr">Français</option>
                  <option value="en">Anglais</option>
                  <option value="es">Espagnol</option>
                  <option value="pt">Portugais</option>
                  <option value="ar">Arabe</option>
                  <option value="wo">Wolof</option>
                  <option value="bm">Bambara</option>
                  <option value="sw">Swahili</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tags</label>
                <input
                  className="form-input"
                  value={form.tags}
                  onChange={(e) => updateForm('tags', e.target.value)}
                  placeholder="mémoire orale, migration, artisanat… (séparés par des virgules)"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notes de contexte</label>
                <textarea
                  className="form-textarea"
                  value={form.context_notes}
                  onChange={(e) => updateForm('context_notes', e.target.value)}
                  placeholder="Conditions de tournage, contexte politique ou social, liens avec d'autres documents…"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-lg)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                ← Retour
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
                Droits & diffusion →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Rights & Publishing */}
        {step === 3 && (
          <div className="card">
            <h2 style={{ marginBottom: 'var(--space-lg)' }}>Droits et diffusion</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
              <div className="form-group">
                <label className="form-label">Licence</label>
                <select
                  className="form-select"
                  value={form.license_type}
                  onChange={(e) => updateForm('license_type', e.target.value)}
                >
                  <option value="all-rights-reserved">Tous droits réservés</option>
                  <option value="cc-by">Creative Commons BY</option>
                  <option value="cc-by-sa">Creative Commons BY-SA</option>
                  <option value="cc-by-nc">Creative Commons BY-NC</option>
                  <option value="cc-by-nc-sa">Creative Commons BY-NC-SA</option>
                  <option value="custom">Licence personnalisée</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Titulaire des droits</label>
                <input
                  className="form-input"
                  value={form.rights_holder}
                  onChange={(e) => updateForm('rights_holder', e.target.value)}
                  placeholder="Personne ou organisation"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Niveau d'accès</label>
                <select
                  className="form-select"
                  value={form.access_level}
                  onChange={(e) => updateForm('access_level', e.target.value)}
                >
                  <option value="public">Public — accessible à tous</option>
                  <option value="partner">Partenaire — institutions partenaires</option>
                  <option value="restricted">Restreint — sur demande</option>
                  <option value="private">Privé — archivage uniquement</option>
                </select>
              </div>

              <div className="form-group" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
                paddingTop: 'var(--space-lg)',
              }}>
                <input
                  type="checkbox"
                  id="consent"
                  checked={form.consent_obtained}
                  onChange={(e) => updateForm('consent_obtained', e.target.checked)}
                  style={{ width: '20px', height: '20px' }}
                />
                <label htmlFor="consent" style={{
                  fontSize: '0.9rem',
                  color: 'var(--color-earth)',
                  cursor: 'pointer',
                }}>
                  Le consentement des personnes présentes a été recueilli
                </label>
              </div>
            </div>

            <div style={{
              padding: 'var(--space-md)',
              background: 'rgba(45, 90, 107, 0.06)',
              borderRadius: 'var(--radius-sm)',
              marginTop: 'var(--space-lg)',
              fontSize: '0.85rem',
              color: 'var(--color-ocean)',
              borderLeft: '3px solid var(--color-ocean)',
            }}>
              Les archives déposées en mode « brouillon » ne seront visibles que par vous
              et les éditeurs du projet. Elles pourront être publiées après validation.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                ← Retour
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !form.title}
                style={{ padding: 'var(--space-sm) var(--space-xl)' }}
              >
                {submitting
                  ? (uploadProgress > 0 ? `Envoi ${uploadProgress}%…` : 'Préparation…')
                  : 'Déposer l\'archive'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
