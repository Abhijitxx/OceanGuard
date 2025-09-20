import React, { useState } from 'react';

const Dashboard = ({ stats, hazardEvents }) => {
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Calculate additional statistics
  const getHazardTypeStats = () => {
    const typeCount = {};
    hazardEvents.forEach(event => {
      typeCount[event.hazard_type] = (typeCount[event.hazard_type] || 0) + 1;
    });
    return typeCount;
  };

  const getConfidenceStats = () => {
    let high = 0, medium = 0, low = 0;
    hazardEvents.forEach(event => {
      if (event.confidence >= 0.7) high++;
      else if (event.confidence >= 0.4) medium++;
      else low++;
    });
    return { high, medium, low };
  };

  const getRecentActivity = () => {
    return hazardEvents
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);
  };

  const hazardTypeStats = getHazardTypeStats();
  const confidenceStats = getConfidenceStats();
  const recentActivity = getRecentActivity();

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const eventTime = new Date(dateString);
    const diffMs = now - eventTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getHazardIcon = (type) => {
    const icons = {
      flood: '💧',
      tsunami: '🌊',
      cyclone: '🌀',
      erosion: '🏔️',
      pollution: '🏭',
      emergency: '🚨'
    };
    return icons[type] || '⚠️';
  };

  const getStatusColor = (status) => {
    const colors = {
      emergency: '#e74c3c',
      review: '#f39c12',
      resolved: '#27ae60'
    };
    return colors[status] || '#7f8c8d';
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>
          <i className="fas fa-chart-line"></i>
          System Dashboard
        </h2>
        <div className="last-update">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-icon">
            <i className="fas fa-list"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.total_reports || 0}</h3>
            <p>Total Reports</p>
            <div className="stat-detail">
              {stats.processed_reports || 0} processed ({stats.processing_rate || '0%'})
            </div>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.hazard_events || 0}</h3>
            <p>Active Hazards</p>
            <div className="stat-detail">
              Across Chennai coastal area
            </div>
          </div>
        </div>

        <div className="stat-card emergency">
          <div className="stat-icon">
            <i className="fas fa-bell"></i>
          </div>
          <div className="stat-content">
            <h3>{stats.emergency_events || 0}</h3>
            <p>Emergency Alerts</p>
            <div className="stat-detail">
              Requiring immediate attention
            </div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <i className="fas fa-shield-alt"></i>
          </div>
          <div className="stat-content">
            <h3>{confidenceStats.high}</h3>
            <p>High Confidence</p>
            <div className="stat-detail">
              Events with ≥70% confidence
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Analytics */}
      <div className="analytics-grid">
        {/* Hazard Type Distribution */}
        <div className="analytics-card">
          <h3>
            <i className="fas fa-chart-pie"></i>
            Hazard Type Distribution
          </h3>
          <div className="chart-container">
            {Object.entries(hazardTypeStats).length > 0 ? (
              Object.entries(hazardTypeStats).map(([type, count]) => (
                <div key={type} className="chart-bar">
                  <div className="bar-label">
                    <span className="hazard-icon">{getHazardIcon(type)}</span>
                    <span className="hazard-name">{type}</span>
                  </div>
                  <div className="bar-container">
                    <div 
                      className="bar-fill"
                      style={{ 
                        width: `${(count / Math.max(...Object.values(hazardTypeStats))) * 100}%`,
                        background: getStatusColor(type === 'emergency' ? 'emergency' : 'review')
                      }}
                    ></div>
                    <span className="bar-value">{count}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="no-data">
                <i className="fas fa-chart-pie"></i>
                <p>No hazard data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Confidence Levels */}
        <div className="analytics-card">
          <h3>
            <i className="fas fa-chart-bar"></i>
            Confidence Levels
          </h3>
          <div className="confidence-chart">
            <div className="confidence-item">
              <div className="confidence-bar high">
                <div className="confidence-fill" style={{ width: `${(confidenceStats.high / (hazardEvents.length || 1)) * 100}%` }}></div>
              </div>
              <div className="confidence-label">
                <span className="confidence-color high"></span>
                High (≥70%): {confidenceStats.high}
              </div>
            </div>
            <div className="confidence-item">
              <div className="confidence-bar medium">
                <div className="confidence-fill" style={{ width: `${(confidenceStats.medium / (hazardEvents.length || 1)) * 100}%` }}></div>
              </div>
              <div className="confidence-label">
                <span className="confidence-color medium"></span>
                Medium (40-70%): {confidenceStats.medium}
              </div>
            </div>
            <div className="confidence-item">
              <div className="confidence-bar low">
                <div className="confidence-fill" style={{ width: `${(confidenceStats.low / (hazardEvents.length || 1)) * 100}%` }}></div>
              </div>
              <div className="confidence-label">
                <span className="confidence-color low"></span>
                Low (&lt;40%): {confidenceStats.low}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <h3>
          <i className="fas fa-clock"></i>
          Recent Hazard Events
        </h3>
        <div className="activity-list">
          {recentActivity.length > 0 ? (
            recentActivity.map((event) => (
              <div 
                key={event.id} 
                className={`activity-item ${selectedEvent?.id === event.id ? 'selected' : ''}`}
                onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
              >
                <div className="activity-icon">
                  <span className="hazard-emoji">{getHazardIcon(event.hazard_type)}</span>
                </div>
                <div className="activity-content">
                  <div className="activity-header">
                    <span className={`hazard-type ${event.hazard_type}`}>
                      {event.hazard_type.charAt(0).toUpperCase() + event.hazard_type.slice(1)}
                    </span>
                    <span className="activity-time">{formatTimeAgo(event.created_at)}</span>
                  </div>
                  <div className="activity-location">
                    📍 {event.centroid_lat.toFixed(4)}°N, {event.centroid_lon.toFixed(4)}°E
                  </div>
                  <div className="activity-meta">
                    <span className={`confidence-badge confidence-${event.confidence >= 0.7 ? 'high' : event.confidence >= 0.4 ? 'medium' : 'low'}`}>
                      {(event.confidence * 100).toFixed(1)}% confidence
                    </span>
                    <span className={`status-badge ${event.status}`}>
                      {event.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="activity-chevron">
                  <i className={`fas fa-chevron-${selectedEvent?.id === event.id ? 'up' : 'down'}`}></i>
                </div>
              </div>
            ))
          ) : (
            <div className="no-activity">
              <i className="fas fa-info-circle"></i>
              <p>No recent hazard events to display</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Event Details */}
      {selectedEvent && (
        <div className="event-details">
          <h3>
            <i className="fas fa-info-circle"></i>
            Event Details - #{selectedEvent.id}
          </h3>
          <div className="details-grid">
            <div className="detail-item">
              <strong>Type:</strong>
              <span className={`hazard-type ${selectedEvent.hazard_type}`}>
                {getHazardIcon(selectedEvent.hazard_type)} {selectedEvent.hazard_type}
              </span>
            </div>
            <div className="detail-item">
              <strong>Status:</strong>
              <span className={`status-badge ${selectedEvent.status}`}>
                {selectedEvent.status.toUpperCase()}
              </span>
            </div>
            <div className="detail-item">
              <strong>Confidence:</strong>
              <span className={`confidence-badge confidence-${selectedEvent.confidence >= 0.7 ? 'high' : selectedEvent.confidence >= 0.4 ? 'medium' : 'low'}`}>
                {(selectedEvent.confidence * 100).toFixed(2)}%
              </span>
            </div>
            <div className="detail-item">
              <strong>Severity:</strong>
              <span className="severity-level">
                {'⭐'.repeat(selectedEvent.severity)} ({selectedEvent.severity}/5)
              </span>
            </div>
            <div className="detail-item">
              <strong>Created:</strong>
              <span>{new Date(selectedEvent.created_at).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <strong>Last Updated:</strong>
              <span>{new Date(selectedEvent.updated_at).toLocaleString()}</span>
            </div>
            <div className="detail-item full-width">
              <strong>Location:</strong>
              <span className="coordinates">
                {selectedEvent.centroid_lat.toFixed(6)}°N, {selectedEvent.centroid_lon.toFixed(6)}°E
              </span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .dashboard {
          padding: 2rem;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .dashboard-header h2 {
          color: #2c3e50;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .last-update {
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 1rem;
          border-left: 4px solid;
        }

        .stat-card.info { border-left-color: #3498db; }
        .stat-card.warning { border-left-color: #f39c12; }
        .stat-card.emergency { border-left-color: #e74c3c; }
        .stat-card.success { border-left-color: #27ae60; }

        .stat-icon {
          font-size: 2rem;
          padding: 1rem;
          border-radius: 50%;
          color: white;
        }

        .stat-card.info .stat-icon { background: #3498db; }
        .stat-card.warning .stat-icon { background: #f39c12; }
        .stat-card.emergency .stat-icon { background: #e74c3c; }
        .stat-card.success .stat-icon { background: #27ae60; }

        .stat-content h3 {
          font-size: 2rem;
          margin: 0;
          color: #2c3e50;
        }

        .stat-content p {
          margin: 0.25rem 0;
          color: #7f8c8d;
          font-weight: 600;
        }

        .stat-detail {
          font-size: 0.8rem;
          color: #95a5a6;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .analytics-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .analytics-card h3 {
          color: #2c3e50;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .chart-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .chart-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .bar-label {
          min-width: 120px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .hazard-icon {
          font-size: 1.2rem;
        }

        .hazard-name {
          font-weight: 500;
          text-transform: capitalize;
        }

        .bar-container {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          position: relative;
        }

        .bar-fill {
          height: 20px;
          border-radius: 10px;
          position: relative;
          min-width: 20px;
          transition: width 0.3s ease;
        }

        .bar-value {
          font-weight: 600;
          min-width: 20px;
        }

        .confidence-chart {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .confidence-item {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .confidence-bar {
          flex: 1;
          height: 20px;
          background: #ecf0f1;
          border-radius: 10px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .confidence-bar.high .confidence-fill { background: #27ae60; }
        .confidence-bar.medium .confidence-fill { background: #f39c12; }
        .confidence-bar.low .confidence-fill { background: #e74c3c; }

        .confidence-label {
          min-width: 140px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .confidence-color {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .confidence-color.high { background: #27ae60; }
        .confidence-color.medium { background: #f39c12; }
        .confidence-color.low { background: #e74c3c; }

        .activity-section {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }

        .activity-section h3 {
          color: #2c3e50;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .activity-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .activity-item {
          display: flex;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid #ecf0f1;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .activity-item:hover {
          background: #f8f9fa;
        }

        .activity-item.selected {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
        }

        .activity-item:last-child {
          border-bottom: none;
        }

        .activity-icon {
          margin-right: 1rem;
        }

        .hazard-emoji {
          font-size: 1.5rem;
        }

        .activity-content {
          flex: 1;
        }

        .activity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.25rem;
        }

        .activity-location {
          font-size: 0.85rem;
          color: #7f8c8d;
          margin-bottom: 0.5rem;
        }

        .activity-meta {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .activity-chevron {
          color: #bdc3c7;
        }

        .event-details {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .event-details h3 {
          color: #2c3e50;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .detail-item.full-width {
          grid-column: 1 / -1;
        }

        .coordinates {
          font-family: monospace;
          color: #2c3e50;
        }

        .no-data, .no-activity {
          text-align: center;
          padding: 2rem;
          color: #7f8c8d;
        }

        .no-data i, .no-activity i {
          font-size: 2rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        @media (max-width: 768px) {
          .dashboard {
            padding: 1rem;
          }

          .dashboard-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .analytics-grid {
            grid-template-columns: 1fr;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .activity-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;