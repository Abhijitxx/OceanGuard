import React, { useState, useEffect } from 'react';

const AlertManagement = () => {
  const [alerts, setAlerts] = useState([]);
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({
    title: '',
    message: '',
    severity: 'medium',
    type: 'general',
    location: '',
    expiresAt: ''
  });
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      // Mock alerts data - in real app, fetch from API
      const mockAlerts = [
        {
          id: 1,
          title: 'Coastal Flooding Warning',
          message: 'High tide combined with heavy rainfall may cause flooding in low-lying coastal areas. Residents are advised to avoid waterlogged roads.',
          severity: 'high',
          type: 'flood',
          status: 'active',
          location: 'Coastal Highway, Zone A',
          createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
          expiresAt: new Date(Date.now() + 6 * 3600000).toISOString(),
          sentTo: 1250,
          acknowledged: 890
        },
        {
          id: 2,
          title: 'Tsunami Watch Lifted',
          message: 'The tsunami watch issued earlier has been lifted. Normal coastal activities may resume.',
          severity: 'low',
          type: 'tsunami',
          status: 'expired',
          location: 'All coastal areas',
          createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
          expiresAt: new Date(Date.now() - 1 * 3600000).toISOString(),
          sentTo: 3200,
          acknowledged: 2850
        },
        {
          id: 3,
          title: 'Pollution Alert - Industrial Spill',
          message: 'Chemical spill reported near industrial area. Water contamination possible. Avoid contact with affected water bodies.',
          severity: 'critical',
          type: 'pollution',
          status: 'active',
          location: 'Industrial Zone B',
          createdAt: new Date(Date.now() - 30 * 60000).toISOString(),
          expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
          sentTo: 580,
          acknowledged: 320
        }
      ];
      setAlerts(mockAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const handleCreateAlert = async () => {
    try {
      // Validate form
      if (!newAlert.title || !newAlert.message) {
        alert('Title and message are required');
        return;
      }

      // Mock creating alert - in real app, send to API
      const newAlertData = {
        id: Date.now(),
        ...newAlert,
        status: 'active',
        createdAt: new Date().toISOString(),
        sentTo: 0,
        acknowledged: 0
      };

      setAlerts([newAlertData, ...alerts]);
      setNewAlert({
        title: '',
        message: '',
        severity: 'medium',
        type: 'general',
        location: '',
        expiresAt: ''
      });
      setIsCreatingAlert(false);
      
      // Simulate sending alert
      setTimeout(() => {
        setAlerts(currentAlerts => 
          currentAlerts.map(a => 
            a.id === alert.id 
              ? { ...a, sentTo: Math.floor(Math.random() * 2000) + 500 }
              : a
          )
        );
      }, 2000);

    } catch (error) {
      console.error('Error creating alert:', error);
    }
  };

  const handleUpdateAlertStatus = async (alertId, newStatus) => {
    try {
      setAlerts(currentAlerts =>
        currentAlerts.map(alert =>
          alert.id === alertId
            ? { ...alert, status: newStatus }
            : alert
        )
      );
    } catch (error) {
      console.error('Error updating alert status:', error);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: '#27ae60',
      medium: '#f39c12',
      high: '#e67e22',
      critical: '#e74c3c'
    };
    return colors[severity] || '#95a5a6';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      low: 'fas fa-info-circle',
      medium: 'fas fa-exclamation-triangle',
      high: 'fas fa-exclamation-circle',
      critical: 'fas fa-skull-crossbones'
    };
    return icons[severity] || 'fas fa-bell';
  };

  const getTypeIcon = (type) => {
    const icons = {
      flood: '💧',
      tsunami: '🌊',
      cyclone: '🌀',
      pollution: '🏭',
      emergency: '🚨',
      general: '📢'
    };
    return icons[type] || '📢';
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const eventTime = new Date(dateString);
    const diffMs = now - eventTime;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatExpiryTime = (dateString) => {
    const now = new Date();
    const expiryTime = new Date(dateString);
    const diffMs = expiryTime - now;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) return 'Expired';
    if (diffHours < 1) return 'Expires soon';
    if (diffHours < 24) return `Expires in ${diffHours}h`;
    return `Expires in ${diffDays}d`;
  };

  const filteredAlerts = alerts.filter(alert => {
    const severityMatch = filterSeverity === 'all' || alert.severity === filterSeverity;
    const statusMatch = filterStatus === 'all' || alert.status === filterStatus;
    return severityMatch && statusMatch;
  });

  return (
    <div className="alert-management">
      <div className="alert-header">
        <div className="header-left">
          <h2>
            <i className="fas fa-bullhorn"></i>
            Alert Management
          </h2>
          <p>Manage emergency alerts and notifications for coastal monitoring</p>
        </div>
        <button 
          onClick={() => setIsCreatingAlert(true)}
          className="create-alert-btn"
        >
          <i className="fas fa-plus"></i>
          Create New Alert
        </button>
      </div>

      {/* Filters */}
      <div className="alert-filters">
        <div className="filter-group">
          <label>Severity:</label>
          <select 
            value={filterSeverity} 
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Create Alert Modal */}
      {isCreatingAlert && (
        <div className="modal-overlay">
          <div className="create-alert-modal">
            <div className="modal-header">
              <h3>Create New Alert</h3>
              <button 
                onClick={() => setIsCreatingAlert(false)}
                className="close-btn"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Alert Title *</label>
                <input
                  type="text"
                  value={newAlert.title}
                  onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
                  placeholder="Enter alert title..."
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label>Alert Message *</label>
                <textarea
                  value={newAlert.message}
                  onChange={(e) => setNewAlert({ ...newAlert, message: e.target.value })}
                  placeholder="Enter detailed alert message..."
                  rows={4}
                  maxLength={500}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Severity</label>
                  <select
                    value={newAlert.severity}
                    onChange={(e) => setNewAlert({ ...newAlert, severity: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={newAlert.type}
                    onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value })}
                  >
                    <option value="general">General</option>
                    <option value="flood">Flood</option>
                    <option value="tsunami">Tsunami</option>
                    <option value="cyclone">Cyclone</option>
                    <option value="pollution">Pollution</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={newAlert.location}
                  onChange={(e) => setNewAlert({ ...newAlert, location: e.target.value })}
                  placeholder="Specify affected area..."
                />
              </div>

              <div className="form-group">
                <label>Expires At</label>
                <input
                  type="datetime-local"
                  value={newAlert.expiresAt}
                  onChange={(e) => setNewAlert({ ...newAlert, expiresAt: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button 
                  onClick={() => setIsCreatingAlert(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateAlert}
                  className="create-btn"
                >
                  <i className="fas fa-bullhorn"></i>
                  Send Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-bullhorn"></i>
            <h3>No Alerts Found</h3>
            <p>No alerts match your current filters. Try adjusting the filters or create a new alert.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div key={alert.id} className={`alert-card ${alert.status}`}>
              <div className="alert-card-header">
                <div className="alert-info">
                  <div className="alert-icon">
                    <span className="type-emoji">{getTypeIcon(alert.type)}</span>
                    <i className={getSeverityIcon(alert.severity)} style={{ color: getSeverityColor(alert.severity) }}></i>
                  </div>
                  <div className="alert-details">
                    <h3 className="alert-title">{alert.title}</h3>
                    <div className="alert-meta">
                      <span className="alert-type">{alert.type}</span>
                      <span className="alert-location">📍 {alert.location}</span>
                      <span className="alert-time">Created {formatTimeAgo(alert.createdAt)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="alert-status">
                  <span className={`status-badge ${alert.status}`}>
                    {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                  </span>
                  <span className="severity-badge" style={{ backgroundColor: getSeverityColor(alert.severity) }}>
                    {alert.severity.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="alert-message">
                <p>{alert.message}</p>
              </div>

              <div className="alert-metrics">
                <div className="metric">
                  <span className="metric-label">Sent To:</span>
                  <span className="metric-value">{alert.sentTo.toLocaleString()} users</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Acknowledged:</span>
                  <span className="metric-value">
                    {alert.acknowledged.toLocaleString()} 
                    ({alert.sentTo > 0 ? Math.round((alert.acknowledged / alert.sentTo) * 100) : 0}%)
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Expires:</span>
                  <span className="metric-value">{formatExpiryTime(alert.expiresAt)}</span>
                </div>
              </div>

              <div className="alert-actions">
                {alert.status === 'active' && (
                  <>
                    <button 
                      onClick={() => handleUpdateAlertStatus(alert.id, 'cancelled')}
                      className="action-btn cancel"
                    >
                      <i className="fas fa-ban"></i>
                      Cancel Alert
                    </button>
                    <button className="action-btn edit">
                      <i className="fas fa-edit"></i>
                      Edit
                    </button>
                  </>
                )}
                
                <button className="action-btn details">
                  <i className="fas fa-chart-bar"></i>
                  View Analytics
                </button>
                
                <button className="action-btn resend">
                  <i className="fas fa-redo"></i>
                  Resend
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .alert-management {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .alert-header {
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          color: white;
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left h2 {
          margin: 0 0 0.25rem 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.5rem;
        }

        .header-left p {
          margin: 0;
          opacity: 0.9;
          font-size: 0.9rem;
        }

        .create-alert-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .create-alert-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .alert-filters {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e1e8ed;
          display: flex;
          gap: 2rem;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-group label {
          font-weight: 600;
          color: #2c3e50;
        }

        .filter-group select {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .create-alert-modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          background: #e74c3c;
          color: white;
          padding: 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 12px 12px 0 0;
        }

        .modal-header h3 {
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0.25rem;
        }

        .modal-content {
          padding: 1.5rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-family: inherit;
        }

        .form-group textarea {
          resize: vertical;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        .cancel-btn {
          background: #95a5a6;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
        }

        .create-btn {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
        }

        .alerts-list {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #7f8c8d;
        }

        .empty-state i {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .alert-card {
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .alert-card.active {
          border-left: 4px solid #27ae60;
        }

        .alert-card.expired {
          border-left: 4px solid #95a5a6;
          opacity: 0.7;
        }

        .alert-card.cancelled {
          border-left: 4px solid #e74c3c;
          opacity: 0.8;
        }

        .alert-card:hover {
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .alert-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .alert-info {
          display: flex;
          gap: 1rem;
          flex: 1;
        }

        .alert-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .type-emoji {
          font-size: 1.5rem;
        }

        .alert-details {
          flex: 1;
        }

        .alert-title {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
          font-size: 1.2rem;
        }

        .alert-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.9rem;
          color: #7f8c8d;
          flex-wrap: wrap;
        }

        .alert-status {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-end;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .status-badge.active {
          background: #d5f4e6;
          color: #27ae60;
        }

        .status-badge.expired {
          background: #f5f6fa;
          color: #95a5a6;
        }

        .status-badge.cancelled {
          background: #fdeaea;
          color: #e74c3c;
        }

        .severity-badge {
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .alert-message {
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .alert-message p {
          margin: 0;
          line-height: 1.5;
          color: #2c3e50;
        }

        .alert-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .metric-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #7f8c8d;
          text-transform: uppercase;
        }

        .metric-value {
          font-weight: 600;
          color: #2c3e50;
        }

        .alert-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .action-btn.cancel {
          background: #e74c3c;
          color: white;
        }

        .action-btn.edit {
          background: #3498db;
          color: white;
        }

        .action-btn.details {
          background: #9b59b6;
          color: white;
        }

        .action-btn.resend {
          background: #f39c12;
          color: white;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        @media (max-width: 768px) {
          .alert-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .alert-filters {
            flex-direction: column;
            gap: 1rem;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .alert-card-header {
            flex-direction: column;
            gap: 1rem;
          }

          .alert-status {
            align-items: flex-start;
            flex-direction: row;
          }

          .alert-metrics {
            grid-template-columns: 1fr;
          }

          .alert-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default AlertManagement;