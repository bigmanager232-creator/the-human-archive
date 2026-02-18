import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../utils/api';

import 'leaflet/dist/leaflet.css';

// Fix pour les icônes Leaflet manquantes avec les bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function createCountIcon(count) {
  return L.divIcon({
    className: 'territory-marker',
    html: `<div class="territory-marker-inner">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function FitBounds({ territories }) {
  const map = useMap();

  useEffect(() => {
    const points = territories
      .filter((t) => t.latitude && t.longitude)
      .map((t) => [t.latitude, t.longitude]);

    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 10 });
    }
  }, [territories, map]);

  return null;
}

export default function Territories() {
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.getTerritoriesWithStats()
      .then(setTerritories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const withCoords = territories.filter((t) => t.latitude && t.longitude);
  const totalArchives = territories.reduce((sum, t) => sum + t.archive_count, 0);

  if (loading) {
    return (
      <div className="container main-content">
        <p style={{ color: 'var(--color-clay)' }}>Chargement…</p>
      </div>
    );
  }

  return (
    <div className="container main-content">
      <h1 style={{ marginBottom: 'var(--space-md)' }}>Territoires</h1>
      <p style={{
        color: 'var(--color-clay)',
        fontSize: '0.875rem',
        fontFamily: 'var(--font-mono)',
        marginBottom: 'var(--space-xl)',
      }}>
        {territories.length} territoire{territories.length !== 1 ? 's' : ''} &middot; {totalArchives} archive{totalArchives !== 1 ? 's' : ''}
      </p>

      {/* Carte */}
      {withCoords.length > 0 && (
        <div className="territory-map-container">
          <MapContainer
            center={[20, 0]}
            zoom={2}
            className="territory-map"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds territories={withCoords} />
            {withCoords.map((territory) => (
              <Marker
                key={territory.id}
                position={[territory.latitude, territory.longitude]}
                icon={createCountIcon(territory.archive_count)}
                eventHandlers={{
                  click: () => setSelected(territory.id),
                }}
              >
                <Popup>
                  <div className="territory-popup">
                    <strong>{territory.name}</strong>
                    <span>{territory.country}{territory.region ? `, ${territory.region}` : ''}</span>
                    <span>{territory.archive_count} archive{territory.archive_count !== 1 ? 's' : ''}</span>
                    <Link to={`/archives?territory=${territory.id}`}>
                      Voir les archives
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Liste */}
      <div className="territory-grid">
        {territories.map((territory) => (
          <div
            key={territory.id}
            className={`card territory-card${selected === territory.id ? ' territory-card--selected' : ''}`}
            onClick={() => setSelected(territory.id === selected ? null : territory.id)}
          >
            <div className="territory-card-header">
              <div>
                <h3 style={{ marginBottom: 'var(--space-xs)' }}>{territory.name}</h3>
                <p className="card-meta" style={{ margin: 0 }}>
                  {territory.country}{territory.region ? ` · ${territory.region}` : ''}
                </p>
              </div>
              <div className="territory-count">
                <span className="territory-count-number">{territory.archive_count}</span>
                <span className="territory-count-label">archive{territory.archive_count !== 1 ? 's' : ''}</span>
              </div>
            </div>

            {territory.description && (
              <p style={{
                fontSize: '0.9rem',
                color: 'var(--color-earth)',
                marginTop: 'var(--space-sm)',
                marginBottom: 'var(--space-sm)',
              }}>
                {territory.description}
              </p>
            )}

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'var(--space-md)',
            }}>
              {territory.partner_institution && (
                <span style={{
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-clay)',
                }}>
                  {territory.partner_institution}
                </span>
              )}
              {territory.archive_count > 0 && (
                <Link
                  to={`/archives?territory=${territory.id}`}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Voir les archives
                </Link>
              )}
            </div>

            {territory.latitude && territory.longitude && (
              <p style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-stone)',
                marginTop: 'var(--space-sm)',
                marginBottom: 0,
              }}>
                {territory.latitude.toFixed(4)}, {territory.longitude.toFixed(4)}
              </p>
            )}
          </div>
        ))}
      </div>

      {territories.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <p style={{ color: 'var(--color-clay)' }}>Aucun territoire enregistré.</p>
        </div>
      )}
    </div>
  );
}
