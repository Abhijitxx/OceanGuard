import React, { useState, useEffect } from 'react';

const HazardValidationQueue = ({ hazards, onHazardSelect, onValidationAction, onRefresh }) => {
  const [sortBy, setSortBy] = useState('created_at');
  const [filterType, setFilterType] = useState('all');
  const [selectedHazards, setSelectedHazards] = useState(new Set());
  const [hazardDetails, setHazardDetails] = useState({});

  // Fetch additional details for hazards to show progressive confidence info
  useEffect(() => {
    const fetchHazardDetails = async () => {
      const details = {};
      for (const hazard of hazards) {
        try {
          // Fetch source reports for this hazard
          const reportsResponse = await fetch(`/api/raw-reports?limit=100`);
          if (reportsResponse.ok) {
            const allReports = await reportsResponse.json();
            // Filter reports that might be related to this hazard (simplified matching)
            const relatedReports = allReports.filter(report => 
              report.nlp_type === hazard.hazard_type && 
              Math.abs(new Date(report.ts) - new Date(hazard.created_at)) < 3600000 // within 1 hour
            );
            
            // Group by source type
            const sourceBreakdown = relatedReports.reduce((acc, report) => {
              const source = report.source || 'unknown';
              if (!acc[source]) acc[source] = { count: 0, avgConf: 0, reports: [] };
              acc[source].reports.push(report);
              acc[source].count++;
              return acc;
            }, {});

            // Calculate average confidence per source
            Object.keys(sourceBreakdown).forEach(source => {
              const reports = sourceBreakdown[source].reports;
              sourceBreakdown[source].avgConf = reports.reduce((sum, r) => sum + (r.nlp_conf || 0), 0) / reports.length;
            });

            details[hazard.id] = {
              totalReports: relatedReports.length,
              sources: sourceBreakdown,
              sourceDiversity: Object.keys(sourceBreakdown).length,
              hasOfficial: sourceBreakdown.incois || sourceBreakdown.lora,
              progressiveStage: getProgressiveStage(hazard.confidence, Object.keys(sourceBreakdown).length)
            };
          }
        } catch (error) {
          console.error(`Error fetching details for hazard ${hazard.id}:`, error);
          details[hazard.id] = { totalReports: 0, sources: {}, sourceDiversity: 0, hasOfficial: false, progressiveStage: 'unknown' };
        }
      }
      setHazardDetails(details);
    };

    if (hazards.length > 0) {
      fetchHazardDetails();
    }
  }, [hazards]);

  // Determine progressive confidence stage
  const getProgressiveStage = (confidence, sourceDiversity) => {
    if (sourceDiversity >= 3 && confidence >= 0.7) return 'high-confidence';
    if (sourceDiversity >= 2 && confidence >= 0.4) return 'medium-confidence';
    if (sourceDiversity === 1 && confidence < 0.3) return 'low-confidence';
    return 'requires-review';
  };

  // Get hazard icon (updated for 5 main hazard types)
  const getHazardIcon = (type) => {
    const icons = {
      flood: '💧',
      tsunami: '🌊', 
      tides: '�',
      earthquake: '⚡',
      landslide: '⛰️',
      emergency: '🚨'
    };
    return icons[type] || '⚠️';
  };

  // Get source icon for progressive confidence display
  const getSourceIcon = (source) => {
    const icons = {
      citizen: '👤',
      incois: '🛰️',
      social: '📱',
      lora: '📡',
      lora_sos: '📡'
    };
    return icons[source] || '📄';
  };

  // Get stage label for progressive confidence
  const getStageLabel = (stage) => {
    const labels = {
      'low-confidence': 'Initial Report',
      'medium-confidence': 'Building Confidence',
      'high-confidence': 'High Confidence',
      'requires-review': 'Needs Review'
    };
    return labels[stage] || 'Unknown';
  };

  // Get confidence color
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.7) return '#27ae60';
    if (confidence >= 0.4) return '#f39c12';
    return '#e74c3c';
  };

  // Get severity stars
  const getSeverityStars = (severity) => {
    return '⭐'.repeat(severity) + '☆'.repeat(5 - severity);
  };

  // Format time ago in IST
  const formatTimeAgo = (dateString) => {
    const now = new Date();
    // Parse the UTC timestamp and convert to IST
    const eventTime = new Date(dateString);
    
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const nowIST = new Date(now.getTime() + istOffset);
    const eventTimeIST = new Date(eventTime.getTime() + istOffset);
    
    const diffMs = nowIST.getTime() - eventTimeIST.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Format full IST timestamp
  const formatISTTime = (dateString) => {
    const date = new Date(dateString);
    const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
    return istDate.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Open location in Google Maps
  const openInGoogleMaps = (lat, lon) => {
    const url = `https://www.google.com/maps?q=${lat},${lon}&z=15`;
    window.open(url, '_blank');
  };

  // Filter and sort hazards
  const filteredHazards = hazards
    .filter(hazard => filterType === 'all' || hazard.hazard_type === filterType)
    .sort((a, b) => {
      switch (sortBy) {
        case 'confidence':
          return b.confidence - a.confidence;
        case 'severity':
          return b.severity - a.severity;
        case 'created_at':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

  // Handle checkbox selection
  const handleSelectHazard = (hazardId) => {
    const newSelected = new Set(selectedHazards);
    if (newSelected.has(hazardId)) {
      newSelected.delete(hazardId);
    } else {
      newSelected.add(hazardId);
    }
    setSelectedHazards(newSelected);
  };

  // Handle bulk actions
  const handleBulkAction = async (action) => {
    const confirmMessage = `Are you sure you want to ${action} ${selectedHazards.size} hazard(s)?`;
    if (window.confirm(confirmMessage)) {
      for (const hazardId of selectedHazards) {
        await onValidationAction(hazardId, action);
      }
      setSelectedHazards(new Set());
      onRefresh();
    }
  };

  // Handle individual validation with enhanced error handling
  const handleQuickValidation = async (hazard, action) => {
    console.log(`🔧 Validation button clicked: ${action} for hazard`, hazard.id);
    
    if (!hazard || !hazard.id) {
      console.error('❌ Invalid hazard object:', hazard);
      alert('Error: Invalid hazard data');
      return;
    }
    
    if (!onValidationAction) {
      console.error('❌ onValidationAction callback not provided');
      alert('Error: Validation function not available');
      return;
    }
    
    const confirmMessage = `${action.toUpperCase()} hazard "${hazard.hazard_type}" (ID: ${hazard.id})?`;
    if (window.confirm(confirmMessage)) {
      try {
        console.log(`⏳ Calling validation action: ${action} for hazard ${hazard.id}`);
        const success = await onValidationAction(hazard.id, action);
        
        if (success) {
          console.log(`✅ Validation successful: ${action} for hazard ${hazard.id}`);
          // Call onRefresh to update the parent component
          if (onRefresh) {
            onRefresh();
          } else {
            console.warn('⚠️ onRefresh callback not available');
          }
        } else {
          console.error(`❌ Validation failed: ${action} for hazard ${hazard.id}`);
          alert(`Failed to ${action} hazard. Please try again.`);
        }
      } catch (error) {
        console.error(`❌ Error during validation:`, error);
        alert(`Error during ${action}: ${error.message || 'Unknown error'}`);
      }
    }
  };

  // Handle hazard selection for details view with error handling
  const handleHazardSelect = (hazard) => {
    console.log(`👁️ View Details clicked for hazard`, hazard.id);
    
    if (!hazard || !hazard.id) {
      console.error('❌ Invalid hazard object:', hazard);
      alert('Error: Invalid hazard data');
      return;
    }
    
    if (onHazardSelect) {
      onHazardSelect(hazard);
    } else {
      console.warn('⚠️ onHazardSelect callback not provided');
      alert('Details view not available');
    }
  };

  return (
    <div className="validation-queue">
      <div className="queue-header">
        <div className="header-left">
          <h2>
            <i className="fas fa-clipboard-check"></i>
            Pending Validation Queue
          </h2>
          <span className="queue-count">{filteredHazards.length} hazards pending review</span>
        </div>
        
        <div className="header-actions">
          <button onClick={onRefresh} className="refresh-btn">
            <i className="fas fa-sync-alt"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="queue-controls">
        <div className="filters">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="flood">Flood</option>
            <option value="tsunami">Tsunami</option>
            <option value="tides">Tides</option>
            <option value="earthquake">Earthquake</option>
            <option value="landslide">Landslide</option>
            <option value="emergency">Emergency</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="created_at">Latest First</option>
            <option value="confidence">Highest Confidence</option>
            <option value="severity">Highest Severity</option>
          </select>
        </div>

        {selectedHazards.size > 0 && (
          <div className="bulk-actions">
            <span className="selected-count">{selectedHazards.size} selected</span>
            <button 
              onClick={() => handleBulkAction('approve')} 
              className="bulk-btn approve"
            >
              <i className="fas fa-check"></i>
              Approve All
            </button>
            <button 
              onClick={() => handleBulkAction('reject')} 
              className="bulk-btn reject"
            >
              <i className="fas fa-times"></i>
              Reject All
            </button>
            <button 
              onClick={() => setSelectedHazards(new Set())} 
              className="bulk-btn clear"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Hazards List */}
      <div className="hazards-list">
        {filteredHazards.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-clipboard-check"></i>
            <h3>No Pending Hazards</h3>
            <p>All hazards have been reviewed! Check back later for new reports.</p>
          </div>
        ) : (
          filteredHazards.map((hazard) => (
            <div key={hazard.id} className="hazard-card">
              <div className="hazard-header">
                <div className="hazard-select">
                  <input
                    type="checkbox"
                    checked={selectedHazards.has(hazard.id)}
                    onChange={() => handleSelectHazard(hazard.id)}
                  />
                </div>
                
                <div className="hazard-icon">
                  <span className="hazard-emoji">{getHazardIcon(hazard.hazard_type)}</span>
                </div>
                
                <div className="hazard-info">
                  <div className="hazard-title">
                    <span className="hazard-type">{hazard.hazard_type.charAt(0).toUpperCase() + hazard.hazard_type.slice(1)}</span>
                    <span className="hazard-id">#{hazard.id}</span>
                    {hazardDetails[hazard.id]?.hasOfficial && (
                      <span className="official-badge">🛰️ Official</span>
                    )}
                  </div>
                  <div className="hazard-meta">
                    <span className="time-ago">{formatTimeAgo(hazard.created_at)}</span>
                    <span className="ist-time" title="{formatISTTime(hazard.created_at)}">🕐 {formatISTTime(hazard.created_at)}</span>
                    <span 
                      className="location clickable-location"
                      onClick={() => openInGoogleMaps(hazard.centroid_lat, hazard.centroid_lon)}
                      title="Click to open in Google Maps"
                    >
                      📍 {hazard.centroid_lat.toFixed(4)}°N, {hazard.centroid_lon.toFixed(4)}°E
                    </span>
                  </div>
                </div>
              </div>

              {/* Basic Confidence Display */}
              <div className="basic-confidence">
                <div className="confidence-header">
                  <span className="confidence-label">Confidence</span>
                  <span className="confidence-value">
                    {(hazard.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                
                <div className="confidence-breakdown">
                  <div className="confidence-main">
                    <div className="confidence-bar">
                      <div 
                        className="confidence-fill"
                        style={{ 
                          width: `${hazard.confidence * 100}%`,
                          background: getConfidenceColor(hazard.confidence)
                        }}
                      ></div>
                      <span className="confidence-text">{(hazard.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  
                  {hazardDetails[hazard.id] && (
                    <div className="source-breakdown">
                      <div className="source-summary">
                        <span className="total-reports">
                          📊 {hazardDetails[hazard.id].totalReports} reports
                        </span>
                        <span className="source-diversity">
                          🔗 {hazardDetails[hazard.id].sourceDiversity} source types
                        </span>
                      </div>
                      
                      <div className="source-types">
                        {Object.entries(hazardDetails[hazard.id].sources).map(([source, data]) => (
                          <div key={source} className="source-item">
                            <span className="source-icon">{getSourceIcon(source)}</span>
                            <span className="source-name">{source}</span>
                            <span className="source-count">{data.count}</span>
                            <span className="source-conf">{(data.avgConf * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="hazard-metrics">                
                <div className="metric">
                  <span className="metric-label">Severity</span>
                  <span className="severity-stars">{getSeverityStars(hazard.severity)}</span>
                </div>
                
                <div className="metric">
                  <span className="metric-label">ML Pipeline</span>
                  <span className="pipeline-status">
                    <i className="fas fa-robot" style={{color: '#27ae60'}}></i>
                    {hazard.status || 'Processed'}
                  </span>
                </div>
              </div>

              <div className="hazard-actions">
                <button 
                  onClick={() => handleHazardSelect(hazard)}
                  className="action-btn details"
                >
                  <i className="fas fa-search-plus"></i>
                  Review Details
                </button>
                
                <button 
                  onClick={() => openInGoogleMaps(hazard.centroid_lat, hazard.centroid_lon)}
                  className="action-btn maps"
                >
                  <i className="fas fa-map-marker-alt"></i>
                  View on Map
                </button>
                
                <button 
                  onClick={() => handleQuickValidation(hazard, 'approve')}
                  className="action-btn approve"
                >
                  <i className="fas fa-check"></i>
                  Approve
                </button>
                
                <button 
                  onClick={() => handleQuickValidation(hazard, 'reject')}
                  className="action-btn reject"
                >
                  <i className="fas fa-times"></i>
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .validation-queue {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .queue-header {
          background: linear-gradient(135deg, #3498db, #2980b9);
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

        .queue-count {
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .refresh-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
        }

        .refresh-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .queue-controls {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e1e8ed;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .filters {
          display: flex;
          gap: 1rem;
        }

        .filter-select, .sort-select {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: white;
          cursor: pointer;
        }

        .bulk-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .selected-count {
          font-weight: 600;
          color: #3498db;
          margin-right: 0.5rem;
        }

        .bulk-btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.85rem;
          transition: all 0.3s ease;
        }

        .bulk-btn.approve {
          background: #27ae60;
          color: white;
        }

        .bulk-btn.reject {
          background: #e74c3c;
          color: white;
        }

        .bulk-btn.clear {
          background: #95a5a6;
          color: white;
        }

        .hazards-list {
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

        .hazard-card {
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .hazard-card:hover {
          border-color: #3498db;
          box-shadow: 0 4px 15px rgba(52, 152, 219, 0.1);
        }

        .hazard-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .hazard-select input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .hazard-icon {
          font-size: 2rem;
        }

        .hazard-info {
          flex: 1;
        }

        .hazard-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .hazard-type {
          font-weight: 600;
          font-size: 1.1rem;
          color: #2c3e50;
        }

        .hazard-id {
          background: #ecf0f1;
          color: #7f8c8d;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .hazard-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.9rem;
          color: #7f8c8d;
          flex-wrap: wrap;
        }

        .ist-time {
          color: #3498db;
          font-weight: 500;
        }

        .clickable-location {
          cursor: pointer;
          color: #e74c3c;
          transition: all 0.3s ease;
        }

        .clickable-location:hover {
          color: #c0392b;
          text-decoration: underline;
        }

        .official-badge {
          background: linear-gradient(135deg, #27ae60, #229954);
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .progressive-confidence {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          border-left: 4px solid #3498db;
        }

        .confidence-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .confidence-label {
          font-weight: 600;
          color: #2c3e50;
          font-size: 0.9rem;
        }

        .confidence-stage {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .confidence-stage.low-confidence {
          background: #ffe6e6;
          color: #e74c3c;
        }

        .confidence-stage.medium-confidence {
          background: #fff3cd;
          color: #f39c12;
        }

        .confidence-stage.high-confidence {
          background: #d4edda;
          color: #27ae60;
        }

        .confidence-stage.requires-review {
          background: #e2e3e5;
          color: #6c757d;
        }

        .confidence-breakdown {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .confidence-main .confidence-bar {
          background: #e9ecef;
          border-radius: 8px;
          height: 24px;
          position: relative;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          border-radius: 8px;
          transition: all 0.3s ease;
          position: relative;
        }

        .confidence-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-weight: 600;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          font-size: 0.85rem;
        }

        .source-breakdown {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .source-summary {
          display: flex;
          gap: 1rem;
          font-size: 0.85rem;
          color: #6c757d;
        }

        .source-types {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .source-item {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          background: white;
          padding: 0.25rem 0.5rem;
          border-radius: 16px;
          border: 1px solid #dee2e6;
          font-size: 0.8rem;
        }

        .source-count {
          background: #e9ecef;
          color: #495057;
          padding: 0.1rem 0.3rem;
          border-radius: 8px;
          font-weight: 600;
        }

        .source-conf {
          color: #6c757d;
          font-weight: 500;
        }

        .hazard-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .metric-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #7f8c8d;
          text-transform: uppercase;
        }

        .confidence-bar {
          position: relative;
          background: #ecf0f1;
          height: 24px;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          align-items: center;
        }

        .confidence-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .confidence-text {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.8rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .severity-stars {
          font-size: 1.2rem;
        }

        .evidence-count {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-weight: 500;
        }

        .hazard-actions {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .action-btn.details {
          background: #3498db;
          color: white;
        }

        .action-btn.approve {
          background: #27ae60;
          color: white;
        }

        .action-btn.reject {
          background: #e74c3c;
          color: white;
        }

        .action-btn.maps {
          background: #e74c3c;
          color: white;
        }

        .action-btn.info {
          background: #f39c12;
          color: white;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        @media (max-width: 768px) {
          .queue-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .filters {
            flex-direction: column;
          }

          .bulk-actions {
            justify-content: center;
          }

          .hazard-header {
            flex-direction: column;
            gap: 0.5rem;
          }

          .hazard-metrics {
            grid-template-columns: 1fr;
          }

          .hazard-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default HazardValidationQueue;