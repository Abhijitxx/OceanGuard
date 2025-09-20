import React, { useState, useEffect, useCallback } from 'react';

const DetailedHazardView = ({ hazard, onClose, onValidationAction, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [validationNotes, setValidationNotes] = useState('');
  const [progressiveAnalysis, setProgressiveAnalysis] = useState(null);

  // Fetch detailed hazard information including progressive confidence analysis
  const fetchHazardDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      // Prefer backend-provided related reports when available
      if (hazard && hazard.related_reports && Array.isArray(hazard.related_reports) && hazard.related_reports.length > 0) {
        const transformedReports = hazard.related_reports.map((report) => ({
          id: report.id,
          type: getReportType(report.source || report.type),
          source: report.source || report.type,
          reporter: report.user_name || report.reporter || `user${report.id}@system.local`,
          timestamp: report.timestamp || report.created_at || report.ts,
          confidence: report.nlp_conf || report.confidence || 0,
          credibility: report.credibility || 0,
          description: report.text || report.description || report.message || '',
          location: {
            lat: report.lat,
            lon: report.lon
          },
          processed: report.processed,
          image_url: report.image_url || report.media_path || report.media_url || null,
          content: report.content,
          engagement: report.engagement
        }));

        setReports(transformedReports);
        setProgressiveAnalysis(calculateProgressiveAnalysis(transformedReports, hazard));
      } else {
        // Fallback: fetch recent raw reports and filter by proximity/time/type
        const reportsResponse = await fetch(`/api/raw-reports?limit=100`);
        if (reportsResponse.ok) {
          const allReports = await reportsResponse.json();

          const relatedReports = allReports.filter(report => {
            try {
              return (
                report.nlp_type === hazard.hazard_type &&
                Math.abs(new Date(report.ts) - new Date(hazard.created_at)) < 86400000 &&
                Math.abs(report.lat - hazard.centroid_lat) < 0.5 &&
                Math.abs(report.lon - hazard.centroid_lon) < 0.5
              );
            } catch (e) {
              return false;
            }
          });

          const transformedReports = relatedReports.map((report) => ({
            id: report.id,
            type: getReportType(report.source),
            source: report.source,
            reporter: `user${report.id}@system.local`,
            timestamp: report.ts,
            confidence: report.nlp_conf || 0,
            credibility: report.credibility || 0,
            description: report.text,
            location: { lat: report.lat, lon: report.lon },
            processed: report.processed,
            image_url: report.image_url || report.media_path || null
          }));

          setReports(transformedReports);
          setProgressiveAnalysis(calculateProgressiveAnalysis(transformedReports, hazard));
        } else {
          setReports(generateMockReports(hazard));
          setProgressiveAnalysis(generateMockAnalysis(hazard));
        }
      }
    } catch (error) {
      console.error('Error fetching hazard details:', error);
      setReports(generateMockReports(hazard));
      setProgressiveAnalysis(generateMockAnalysis(hazard));
    } finally {
      setIsLoading(false);
    }
  }, [hazard]);

  // Transform source to report type
  const getReportType = (source) => {
    const typeMap = {
      'citizen': 'citizen_report',
      'incois': 'incois_data', 
      'social': 'social_media',
      'lora': 'lora_sos',
      'lora_sos': 'lora_sos'
    };
    return typeMap[source] || 'citizen_report';
  };

  // Calculate progressive confidence analysis from real data
  const calculateProgressiveAnalysis = (reports, hazard) => {
    const sourceGroups = reports.reduce((acc, report) => {
      const source = report.source || 'unknown';
      if (!acc[source]) acc[source] = [];
      acc[source].push(report);
      return acc;
    }, {});

    const confidenceEvolution = [];
    let cumulativeReports = [];
    
    // Sort reports by timestamp to show evolution
    const sortedReports = [...reports].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    sortedReports.forEach((report, index) => {
      cumulativeReports.push(report);
      const sources = [...new Set(cumulativeReports.map(r => r.source))];
      
      confidenceEvolution.push({
        step: index + 1,
        timestamp: report.timestamp,
        reportCount: cumulativeReports.length,
        sources: sources.length,
        confidence: calculateGroupConfidence(cumulativeReports),
        newSource: report.source,
        description: `${report.source} report added`
      });
    });

    return {
      totalReports: reports.length,
      uniqueSources: Object.keys(sourceGroups).length,
      sourceBreakdown: Object.entries(sourceGroups).map(([source, reports]) => ({
        source,
        count: reports.length,
        avgConfidence: reports.reduce((sum, r) => sum + (r.confidence || 0), 0) / reports.length,
        avgCredibility: reports.reduce((sum, r) => sum + (r.credibility || 0), 0) / reports.length,
        reports
      })),
      confidenceEvolution,
      finalConfidence: hazard.confidence,
      mlPipelineStage: reports.every(r => r.processed) ? 'completed' : 'processing'
    };
  };

  // Simple confidence calculation for evolution tracking
  const calculateGroupConfidence = (reports) => {
    if (reports.length === 0) return 0;
    const avgConf = reports.reduce((sum, r) => sum + (r.confidence || 0), 0) / reports.length;
    const sourceDiversity = [...new Set(reports.map(r => r.source))].length;
    const diversityBoost = sourceDiversity === 1 ? 1.0 : sourceDiversity * 0.3;
    return Math.min(0.95, avgConf * diversityBoost);
  };

  // Generate mock reports when real data is not available
  const generateMockReports = (hazard) => {
    return [
      {
        id: 1,
        type: 'citizen_report',
        source: 'citizen',
        reporter: 'user123@email.com',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
        confidence: 0.17,
        credibility: 0.65,
        description: 'Flooding observed in coastal road near the market area. Water level approximately 2 feet high.',
        image_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzOThkYiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPlNhbXBsZSBJbWFnZTwvdGV4dD48L3N2Zz4=',
        location: {
          lat: hazard?.centroid_lat ? hazard.centroid_lat + 0.001 : 0,
          lon: hazard?.centroid_lon ? hazard.centroid_lon + 0.001 : 0
        },
        processed: true
      },
      {
        id: 2,
        type: 'social_media',
        source: 'social',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        confidence: 0.18,
        credibility: 0.42,
        content: 'Heavy flooding reported near coastal highway. Traffic completely stopped. #flood #emergency',
        engagement: { likes: 45, retweets: 23, replies: 8 },
        processed: true
      },
      {
        id: 3,
        type: 'incois_data',
        source: 'incois',
        timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
        confidence: 0.50,
        credibility: 0.95,
        data: {
          water_level: '2.3m above normal',
          tide_height: '4.2m',
          weather_condition: 'Heavy rainfall detected'
        },
        processed: true
      }
    ];
  };

  // Generate mock progressive analysis
  const generateMockAnalysis = (hazard) => {
    return {
      totalReports: 3,
      uniqueSources: 3,
      sourceBreakdown: [
        { source: 'citizen', count: 1, avgConfidence: 0.17, avgCredibility: 0.65, reports: [] },
        { source: 'social', count: 1, avgConfidence: 0.18, avgCredibility: 0.42, reports: [] },
        { source: 'incois', count: 1, avgConfidence: 0.50, avgCredibility: 0.95, reports: [] }
      ],
      confidenceEvolution: [
        { step: 1, reportCount: 1, sources: 1, confidence: 0.17, newSource: 'citizen', description: 'Initial citizen report' },
        { step: 2, reportCount: 2, sources: 2, confidence: 0.25, newSource: 'social', description: 'Social media confirmation' },
        { step: 3, reportCount: 3, sources: 3, confidence: 0.42, newSource: 'incois', description: 'Official INCOIS data' }
      ],
      finalConfidence: hazard.confidence,
      mlPipelineStage: 'completed'
    };
  };

  // Fetch detailed reports for this hazard
  useEffect(() => {
    if (hazard) {
      fetchHazardDetails();
    }
  }, [hazard, fetchHazardDetails]);

  const handleValidation = async (action) => {
    const confirmMessage = `${action.toUpperCase()} this hazard? ${validationNotes ? 'Notes: ' + validationNotes : ''}`;
    if (window.confirm(confirmMessage)) {
      await onValidationAction(hazard.id, action, validationNotes);
      onRefresh();
      onClose();
    }
  };

  const getSourceIcon = (type) => {
    const icons = {
      citizen_report: '👤',
      social_media: '📱',
      incois_data: '🛰️',
      lora_sos: '📡'
    };
    return icons[type] || '📄';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.7) return '#27ae60';
    if (confidence >= 0.4) return '#f39c12';
    return '#e74c3c';
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const eventTime = new Date(dateString);
    const diffMs = now - eventTime;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return `${diffHours}h ago`;
  };

  if (!hazard) {
    return (
      <div className="detailed-hazard-overlay">
        <div className="detailed-hazard-modal">
          <div className="modal-header">
            <h2>No hazard selected</h2>
            <button onClick={onClose} className="close-btn">
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="modal-content">
            <p>Please select a hazard to view details.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="detailed-hazard-overlay">
      <div className="detailed-hazard-modal">
        <div className="modal-header">
          <div className="header-info">
            <h2>
              <span className="hazard-emoji">
                {hazard.hazard_type === 'flood' ? '💧' : 
                 hazard.hazard_type === 'tsunami' ? '🌊' :
                 hazard.hazard_type === 'cyclone' ? '🌀' : '⚠️'}
              </span>
              {hazard.hazard_type.charAt(0).toUpperCase() + hazard.hazard_type.slice(1)} #{hazard.id}
            </h2>
            <div className="hazard-status">
              <span className="status-badge pending">Pending Validation</span>
              <span className="confidence-badge" style={{ color: getConfidenceColor(hazard.confidence) }}>
                {(hazard.confidence * 100).toFixed(1)}% Confidence
              </span>
            </div>
          </div>
          <button onClick={onClose} className="close-btn">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-tabs">
          <button 
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="fas fa-chart-line"></i>
            Overview
          </button>
          {/* Removed Progressive Analysis tab - not required */}
          <button 
            className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <i className="fas fa-file-alt"></i>
            Reports ({reports.length})
          </button>
          <button 
            className={`tab ${activeTab === 'map' ? 'active' : ''}`}
            onClick={() => setActiveTab('map')}
          >
            <i className="fas fa-map-marker-alt"></i>
            Location
          </button>
          <button 
            className={`tab ${activeTab === 'validation' ? 'active' : ''}`}
            onClick={() => setActiveTab('validation')}
          >
            <i className="fas fa-clipboard-check"></i>
            Validate
          </button>
        </div>

        <div className="modal-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="overview-grid">
                <div className="overview-card">
                  <h3><i className="fas fa-info-circle"></i> Basic Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">Type:</span>
                      <span className="value">{hazard.hazard_type}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Severity:</span>
                      <span className="value">{'⭐'.repeat(hazard.severity)} ({hazard.severity}/5)</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Detected:</span>
                      <span className="value">{formatTimeAgo(hazard.created_at)}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Location:</span>
                      <span className="value">
                        {hazard.centroid_lat.toFixed(4)}°N, {hazard.centroid_lon.toFixed(4)}°E
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overview-card">
                  <h3><i className="fas fa-chart-bar"></i> Confidence Breakdown</h3>
                  <div className="confidence-breakdown">
                    <div className="confidence-item">
                      <span className="source">Citizen Reports</span>
                      <div className="confidence-bar">
                        <div className="fill" style={{ width: '85%', background: '#27ae60' }}></div>
                        <span className="percentage">85%</span>
                      </div>
                    </div>
                    <div className="confidence-item">
                      <span className="source">INCOIS Data</span>
                      <div className="confidence-bar">
                        <div className="fill" style={{ width: '91%', background: '#27ae60' }}></div>
                        <span className="percentage">91%</span>
                      </div>
                    </div>
                    <div className="confidence-item">
                      <span className="source">Social Media</span>
                      <div className="confidence-bar">
                        <div className="fill" style={{ width: '72%', background: '#f39c12' }}></div>
                        <span className="percentage">72%</span>
                      </div>
                    </div>
                    <div className="confidence-item">
                      <span className="source">LoRa SOS</span>
                      <div className="confidence-bar">
                        <div className="fill" style={{ width: '95%', background: '#27ae60' }}></div>
                        <span className="percentage">95%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {hazard.related_news && hazard.related_news.length > 0 && (
                  <div className="overview-card">
                    <h3><i className="fas fa-newspaper"></i> Related News</h3>
                    <ul className="news-list">
                      {hazard.related_news.slice(0,5).map((n, i) => (
                        <li key={i} className="news-item">
                          <a href={n.url || '#'} target="_blank" rel="noreferrer">{n.title || n.headline || n.summary || 'News item'}</a>
                          <div className="news-meta">{n.source || n.user_name || 'Local News'} • {formatTimeAgo(n.published_at || n.published || n.created_at || new Date().toISOString())}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Progressive Analysis tab removed - not required */}

          {activeTab === 'reports' && (
            <div className="reports-tab">
              {isLoading ? (
                <div className="loading">
                  <i className="fas fa-spinner fa-spin"></i>
                  Loading detailed reports...
                </div>
              ) : !reports || reports.length === 0 ? (
                <div className="no-reports">
                  <i className="fas fa-inbox"></i>
                  <p>No reports available for this hazard</p>
                </div>
              ) : (
                <div className="reports-list">
                  {(reports || []).map((report) => (
                    <div key={report.id} className="report-card">
                      <div className="report-header">
                        <div className="report-source">
                          <span className="source-icon">{getSourceIcon(report.type)}</span>
                          <div className="source-info">
                            <span className="source-type">
                              {report.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            {report.source && <span className="source-name"> - {report.source}</span>}
                            {report.reporter && <span className="reporter"> by {report.reporter}</span>}
                          </div>
                        </div>
                        <div className="report-meta">
                          <span className="timestamp">{formatTimeAgo(report.timestamp)}</span>
                          <span 
                            className="confidence" 
                            style={{ color: getConfidenceColor(report.confidence) }}
                          >
                            {(report.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="report-content">
                        {report.description && (
                          <p className="description">{report.description}</p>
                        )}
                        
                        {report.content && (
                          <p className="social-content">{report.content}</p>
                        )}

                        {report.message && (
                          <div className="sos-message">
                            <i className="fas fa-exclamation-triangle"></i>
                            {report.message}
                          </div>
                        )}

                        {report.data && (
                          <div className="data-grid">
                            {Object.entries(report.data).map(([key, value]) => (
                              <div key={key} className="data-item">
                                <span className="data-label">{key.replace('_', ' ')}:</span>
                                <span className="data-value">{value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {report.image_url && (
                          <div className="report-image">
                            <img src={report.image_url} alt="Report evidence" />
                          </div>
                        )}

                        {report.engagement && (
                          <div className="engagement-stats">
                            <span><i className="fas fa-heart"></i> {report.engagement.likes}</span>
                            <span><i className="fas fa-retweet"></i> {report.engagement.retweets}</span>
                            <span><i className="fas fa-comment"></i> {report.engagement.replies}</span>
                          </div>
                        )}

                        {report.battery_level && (
                          <div className="device-info">
                            <span><i className="fas fa-battery-three-quarters"></i> {report.battery_level}</span>
                            <span><i className="fas fa-microchip"></i> {report.device_id}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'map' && (
            <div className="map-tab">
              <div className="map-placeholder">
                <i className="fas fa-map-marked-alt"></i>
                <h3>Hazard Location Map</h3>
                <p>Interactive map showing:</p>
                <ul>
                  <li>📍 Hazard center: {hazard.centroid_lat.toFixed(4)}°N, {hazard.centroid_lon.toFixed(4)}°E</li>
                  <li>👤 Citizen report locations</li>
                  <li>📡 LoRa device positions</li>
                  <li>🛰️ Satellite data coverage area</li>
                </ul>
                <button className="map-btn">
                  <i className="fas fa-external-link-alt"></i>
                  Open Full Map
                </button>
              </div>
            </div>
          )}

          {activeTab === 'validation' && (
            <div className="validation-tab">
              <div className="validation-form">
                <h3><i className="fas fa-clipboard-check"></i> Validation Decision</h3>
                
                <div className="validation-summary">
                  <div className="summary-item">
                    <span className="label">Overall Confidence:</span>
                    <span className="value confidence-high">
                      {(hazard.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Evidence Sources:</span>
                    <span className="value">{reports.length} reports</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Severity Level:</span>
                    <span className="value">Level {hazard.severity}/5</span>
                  </div>
                </div>

                <div className="validation-notes">
                  <label htmlFor="notes">Validation Notes (Optional):</label>
                  <textarea
                    id="notes"
                    value={validationNotes}
                    onChange={(e) => setValidationNotes(e.target.value)}
                    placeholder="Add any notes about your validation decision..."
                    rows={4}
                  />
                </div>

                <div className="validation-actions">
                  <button 
                    onClick={() => handleValidation('approve')}
                    className="validation-btn approve"
                  >
                    <i className="fas fa-check-circle"></i>
                    Approve Hazard
                  </button>
                  
                  <button 
                    onClick={() => handleValidation('reject')}
                    className="validation-btn reject"
                  >
                    <i className="fas fa-times-circle"></i>
                    Reject Report
                  </button>
                  
                  <button 
                    onClick={() => handleValidation('request_more_info')}
                    className="validation-btn info"
                  >
                    <i className="fas fa-question-circle"></i>
                    Request More Info
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .detailed-hazard-overlay {
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
          padding: 2rem;
        }

        .detailed-hazard-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 1200px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          background: linear-gradient(135deg, #3498db, #2980b9);
          color: white;
          padding: 1.5rem;
          border-radius: 16px 16px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-info h2 {
          margin: 0 0 0.5rem 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.5rem;
        }

        .hazard-status {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .status-badge {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .confidence-badge {
          font-weight: 600;
          font-size: 0.9rem;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 0.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1.2rem;
          transition: background 0.3s ease;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .modal-tabs {
          display: flex;
          background: #f8f9fa;
          border-bottom: 1px solid #e1e8ed;
        }

        .tab {
          flex: 1;
          padding: 1rem;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-weight: 500;
          color: #7f8c8d;
          transition: all 0.3s ease;
        }

        .tab.active {
          background: white;
          color: #3498db;
          border-bottom: 2px solid #3498db;
        }

        .tab:hover {
          background: rgba(52, 152, 219, 0.1);
        }

        .modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        .overview-card {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 1.5rem;
        }

        .overview-card h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .info-grid {
          display: grid;
          gap: 1rem;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e1e8ed;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .label {
          font-weight: 600;
          color: #7f8c8d;
        }

        .value {
          color: #2c3e50;
          font-weight: 500;
        }

        .confidence-breakdown {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .confidence-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .source {
          font-weight: 500;
          color: #2c3e50;
          min-width: 120px;
        }

        .confidence-bar {
          flex: 1;
          margin: 0 1rem;
          height: 20px;
          background: #ecf0f1;
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }

        .fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .percentage {
          font-weight: 600;
          color: #2c3e50;
          min-width: 40px;
          text-align: right;
        }

        .reports-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .report-card {
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          background: white;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .report-source {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .source-icon {
          font-size: 1.5rem;
        }

        .source-type {
          font-weight: 600;
          color: #2c3e50;
        }

        .source-name, .reporter {
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .report-meta {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .timestamp {
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .confidence {
          font-weight: 600;
        }

        .report-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .description, .social-content {
          color: #2c3e50;
          line-height: 1.5;
        }

        .sos-message {
          background: #e74c3c;
          color: white;
          padding: 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
        }

        .data-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.5rem;
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
        }

        .data-item {
          display: flex;
          justify-content: space-between;
        }

        .data-label {
          font-weight: 500;
          color: #7f8c8d;
          text-transform: capitalize;
        }

        .data-value {
          color: #2c3e50;
          font-weight: 500;
        }

        .report-image {
          text-align: center;
        }

        .report-image img {
          max-width: 100%;
          max-height: 200px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .engagement-stats, .device-info {
          display: flex;
          gap: 1rem;
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .map-placeholder {
          text-align: center;
          padding: 3rem;
          color: #7f8c8d;
        }

        .map-placeholder i {
          font-size: 4rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .map-placeholder ul {
          text-align: left;
          display: inline-block;
          margin: 1rem 0;
        }

        .map-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 1rem auto 0;
          transition: background 0.3s ease;
        }

        .map-btn:hover {
          background: #2980b9;
        }

        .validation-form {
          max-width: 600px;
          margin: 0 auto;
        }

        .validation-form h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .validation-summary {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid #e1e8ed;
        }

        .summary-item:last-child {
          border-bottom: none;
        }

        .confidence-high {
          color: #27ae60;
          font-weight: 600;
        }

        .validation-notes {
          margin-bottom: 1.5rem;
        }

        .validation-notes label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .validation-notes textarea {
          width: 100%;
          padding: 1rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          resize: vertical;
          font-family: inherit;
        }

        .validation-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .validation-btn {
          padding: 1rem 2rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .validation-btn.approve {
          background: #27ae60;
          color: white;
        }

        .validation-btn.reject {
          background: #e74c3c;
          color: white;
        }

        .validation-btn.info {
          background: #f39c12;
          color: white;
        }

        .validation-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .loading {
          text-align: center;
          padding: 3rem;
          color: #7f8c8d;
        }

        .loading i {
          font-size: 2rem;
          margin-bottom: 1rem;
        }

        /* Progressive Confidence Tab Styles */
        .confidence-tab {
          padding: 1.5rem;
        }

        .progressive-analysis {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .analysis-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        .analysis-card {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .analysis-card h3 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
          border-bottom: 2px solid #ecf0f1;
          padding-bottom: 0.5rem;
        }

        /* Confidence Evolution Timeline */
        .confidence-timeline {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .timeline-item {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .timeline-marker {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #3498db;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .timeline-content {
          flex: 1;
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          border-left: 3px solid #3498db;
        }

        .stage-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .stage-title {
          font-weight: 600;
          color: #2c3e50;
        }

        .stage-confidence {
          font-weight: 700;
          font-size: 1.1rem;
        }

        .stage-details p {
          margin: 0 0 0.5rem 0;
          color: #34495e;
          line-height: 1.4;
        }

        .stage-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .stage-meta span {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        /* ML Pipeline Styles */
        .pipeline-stages {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .pipeline-stage {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #ecf0f1;
        }

        .pipeline-stage[data-status="completed"] {
          border-left-color: #27ae60;
        }

        .pipeline-stage[data-status="processing"] {
          border-left-color: #f39c12;
        }

        .pipeline-stage[data-status="pending"] {
          border-left-color: #95a5a6;
        }

        .stage-icon {
          flex-shrink: 0;
          width: 24px;
          text-align: center;
          color: #7f8c8d;
        }

        .pipeline-stage[data-status="completed"] .stage-icon {
          color: #27ae60;
        }

        .pipeline-stage[data-status="processing"] .stage-icon {
          color: #f39c12;
        }

        .stage-info {
          flex: 1;
        }

        .stage-name {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.25rem;
        }

        .stage-status {
          font-size: 0.9rem;
          color: #7f8c8d;
          text-transform: capitalize;
          margin-bottom: 0.25rem;
        }

        .stage-status[data-status="completed"] {
          color: #27ae60;
        }

        .stage-status[data-status="processing"] {
          color: #f39c12;
        }

        .stage-details {
          font-size: 0.85rem;
          color: #95a5a6;
        }

        .stage-timing {
          flex-shrink: 0;
          font-size: 0.8rem;
          color: #95a5a6;
        }

        /* Source Reliability Styles */
        .reliability-breakdown {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .reliability-item {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #ecf0f1;
        }

        .source-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .source-count {
          color: #7f8c8d;
          font-weight: 400;
          font-size: 0.9rem;
        }

        .reliability-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 0.5rem;
        }

        .metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: white;
          border-radius: 6px;
          border: 1px solid #e1e8ed;
        }

        .metric-label {
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .metric-value {
          font-weight: 600;
          color: #2c3e50;
        }

        .metric-value.final {
          font-size: 1.1rem;
        }

        /* AI Insights Styles */
        .ai-insights {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .insight-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #3498db;
        }

        .insight-icon {
          flex-shrink: 0;
          width: 24px;
          text-align: center;
          color: #3498db;
        }

        .insight-content {
          flex: 1;
        }

        .insight-title {
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .insight-description {
          color: #34495e;
          line-height: 1.4;
          margin-bottom: 0.5rem;
        }

        .insight-action {
          color: #7f8c8d;
          font-size: 0.9rem;
          font-style: italic;
        }

        .insight-action strong {
          color: #2c3e50;
        }

        @media (max-width: 768px) {
          .detailed-hazard-overlay {
            padding: 1rem;
          }

          .overview-grid {
            grid-template-columns: 1fr;
          }

          .modal-tabs {
            flex-wrap: wrap;
          }

          .tab {
            min-width: 25%;
          }

          .validation-actions {
            flex-direction: column;
          }

          .report-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default DetailedHazardView;