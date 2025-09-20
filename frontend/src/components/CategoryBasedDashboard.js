import React, { useState, useEffect } from 'react';

const CategoryBasedDashboard = ({ onHazardSelect, onValidationAction, onRefresh }) => {
  const [activeCategory, setActiveCategory] = useState('overview');
  const [hazardsByCategory, setHazardsByCategory] = useState({});
  const [reportsByCategory, setReportsByCategory] = useState({});
  const [progressiveAnalysis, setProgressiveAnalysis] = useState({});
  const [overviewStats, setOverviewStats] = useState({
    totalHazards: 0,
    totalReports: 0,
    pendingReview: 0,
    highConfidence: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // Hazard categories with their metadata (updated for 5 main hazard types)
  const categories = {
    overview: {
      name: 'Dashboard Overview',
      icon: '📊',
      color: '#3498db',
      description: 'Summary of all hazard types'
    },
    flood: {
      name: 'Flood Events',
      icon: '💧',
      color: '#3498db',
      description: 'Water-related hazards and flooding'
    },
    tsunami: {
      name: 'Tsunami Alerts',
      icon: '🌊',
      color: '#e74c3c',
      description: 'Tsunami warnings and sea surges'
    },
    tides: {
      name: 'Tidal Events',
      icon: '�',
      color: '#16a085',
      description: 'Abnormal tides and tidal surges'
    },
    earthquake: {
      name: 'Seismic Activity',
      icon: '⚡',
      color: '#f39c12',
      description: 'Earthquake reports and tremors'
    },
    landslide: {
      name: 'Landslides',
      icon: '⛰️',
      color: '#8e44ad',
      description: 'Slope failures and landslides'
    },
    emergency: {
      name: 'Emergency Events',
      icon: '🚨',
      color: '#e74c3c',
      description: 'High-priority emergency situations'
    }
  };

  // Fetch all data and organize by categories
  useEffect(() => {
    fetchCategoryData();
  }, []);

  const fetchCategoryData = async () => {
    setIsLoading(true);
    try {
      // Fetch real stats from backend for overview
      const statsResponse = await fetch('/api/stats');
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        setOverviewStats({
          totalHazards: stats.total_hazards || 0,
          totalReports: stats.total_reports || 0,
          pendingReview: stats.pending_validation || 0,
          highConfidence: stats.confidence_distribution?.high || 0
        });
      }

      // Fetch PENDING hazard events only (for validation queue)
      const hazardsResponse = await fetch('/api/hazards/pending');
      const hazards = hazardsResponse.ok ? await hazardsResponse.json() : [];

      // Fetch raw reports
      const reportsResponse = await fetch('/api/raw-reports?limit=100');
      const reports = reportsResponse.ok ? await reportsResponse.json() : [];

      // Organize hazards by category
      const hazardsByType = {};
      const reportsByType = {};
      const analysisData = {};

      // Initialize categories
      Object.keys(categories).forEach(type => {
        if (type !== 'overview') {
          hazardsByType[type] = [];
          reportsByType[type] = [];
          analysisData[type] = {
            totalReports: 0,
            uniqueLocations: 0,
            confidenceProgression: [],
            deduplicationStats: {
              originalReports: 0,
              clusteredEvents: 0,
              reductionRate: 0
            }
          };
        }
      });

      // Categorize hazards
      hazards.forEach(hazard => {
        const type = hazard.hazard_type;
        if (hazardsByType[type]) {
          hazardsByType[type].push(hazard);
        }
      });

      // Categorize reports and calculate progressive confidence
      reports.forEach(report => {
        const type = report.nlp_type;
        if (reportsByType[type]) {
          reportsByType[type].push(report);
          analysisData[type].totalReports++;
        }
      });

      // Calculate progressive confidence and deduplication for each category
      Object.keys(analysisData).forEach(type => {
        const categoryReports = reportsByType[type];
        const categoryHazards = hazardsByType[type];

        if (categoryReports.length > 0) {
          // Calculate unique locations (simplified)
          const uniqueLocations = new Set(
            categoryReports.map(r => `${r.lat.toFixed(3)}_${r.lon.toFixed(3)}`)
          ).size;

          // Progressive confidence simulation
          const confidenceSteps = calculateProgressiveConfidence(categoryReports, categoryHazards);
          
          analysisData[type] = {
            ...analysisData[type],
            uniqueLocations,
            confidenceProgression: confidenceSteps,
            deduplicationStats: {
              originalReports: categoryReports.length,
              clusteredEvents: categoryHazards.length,
              reductionRate: categoryReports.length > 0 ? 
                ((categoryReports.length - categoryHazards.length) / categoryReports.length * 100) : 0
            }
          };
        }
      });

      setHazardsByCategory(hazardsByType);
      setReportsByCategory(reportsByType);
      setProgressiveAnalysis(analysisData);

    } catch (error) {
      console.error('Error fetching category data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate progressive confidence steps
  const calculateProgressiveConfidence = (reports, hazards) => {
    if (reports.length === 0) return [];

    // Sort reports by timestamp
    const sortedReports = reports.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const steps = [];

    // Simulate progressive confidence building
    let cumulativeConfidence = 0;
    let reportCount = 0;

    sortedReports.forEach((report, index) => {
      reportCount++;
      
      // Base confidence from NLP
      const baseConf = report.nlp_conf || 0.15;
      
      // Progressive boost based on report count and source diversity
      const progressiveBoost = Math.min(reportCount * 0.1, 0.4);
      
      // Credibility factor
      const credibilityFactor = (report.credibility || 0.5) * 0.2;
      
      cumulativeConfidence = Math.min(baseConf + progressiveBoost + credibilityFactor, 0.95);

      steps.push({
        step: index + 1,
        reportId: report.id,
        timestamp: report.ts,
        confidence: cumulativeConfidence,
        contribution: baseConf,
        boost: progressiveBoost,
        credibility: credibilityFactor,
        source: report.source
      });
    });

    return steps;
  };

  // Get category statistics
  const getCategoryStats = (type) => {
    const hazards = hazardsByCategory[type] || [];
    const reports = reportsByCategory[type] || [];
    const analysis = progressiveAnalysis[type] || {};

    return {
      totalHazards: hazards.length,
      totalReports: reports.length,
      pendingReview: hazards.filter(h => h.status === 'review' || h.status === 'pending').length,
      highConfidence: hazards.filter(h => h.confidence >= 0.7).length,
      avgConfidence: hazards.length > 0 ? 
        hazards.reduce((sum, h) => sum + h.confidence, 0) / hazards.length : 0,
      deduplicationRate: analysis.deduplicationStats?.reductionRate || 0
    };
  };

  // Render overview dashboard
  const renderOverview = () => {
    return (
      <div className="overview-dashboard">
        <div className="overview-stats">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{overviewStats.totalHazards}</h3>
              <p>Total Hazard Events</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📝</div>
            <div className="stat-content">
              <h3>{overviewStats.totalReports}</h3>
              <p>Raw Reports Processed</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏳</div>
            <div className="stat-content">
              <h3>{overviewStats.pendingReview}</h3>
              <p>Pending Review</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{overviewStats.highConfidence}</h3>
              <p>High Confidence</p>
            </div>
          </div>
        </div>

        <div className="category-grid">
          {Object.entries(categories)
            .filter(([key]) => key !== 'overview')
            .map(([key, category]) => {
              const stats = getCategoryStats(key);
              return (
                <div 
                  key={key} 
                  className="category-card"
                  onClick={() => setActiveCategory(key)}
                  style={{ borderLeftColor: category.color }}
                >
                  <div className="category-header">
                    <span className="category-icon">{category.icon}</span>
                    <h3>{category.name}</h3>
                  </div>
                  <p className="category-description">{category.description}</p>
                  
                  <div className="category-stats">
                    <div className="stat-item">
                      <span className="stat-number">{stats.totalHazards}</span>
                      <span className="stat-label">Events</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-number">{stats.totalReports}</span>
                      <span className="stat-label">Reports</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-number">{stats.pendingReview}</span>
                      <span className="stat-label">Pending</span>
                    </div>
                  </div>

                  <div className="category-confidence">
                    <div className="confidence-bar">
                      <div 
                        className="confidence-fill"
                        style={{ 
                          width: `${stats.avgConfidence * 100}%`,
                          backgroundColor: category.color 
                        }}
                      ></div>
                    </div>
                    <span className="confidence-text">
                      {(stats.avgConfidence * 100).toFixed(0)}% avg confidence
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  // Render category-specific view
  const renderCategoryView = (categoryType) => {
    const category = categories[categoryType];
    const hazards = hazardsByCategory[categoryType] || [];
    const reports = reportsByCategory[categoryType] || [];
    const analysis = progressiveAnalysis[categoryType] || {};
    const stats = getCategoryStats(categoryType);

    return (
      <div className="category-view">
        <div className="category-header-section">
          <div className="category-title">
            <span className="category-icon-large">{category.icon}</span>
            <div>
              <h2>{category.name}</h2>
              <p>{category.description}</p>
            </div>
          </div>
          
          <div className="category-summary">
            <div className="summary-stat">
              <h4>{stats.totalReports}</h4>
              <span>Raw Reports</span>
            </div>
            <div className="summary-stat">
              <h4>{stats.totalHazards}</h4>
              <span>Clustered Events</span>
            </div>
            <div className="summary-stat">
              <h4>{stats.deduplicationRate.toFixed(0)}%</h4>
              <span>Deduplication Rate</span>
            </div>
            <div className="summary-stat">
              <h4>{(stats.avgConfidence * 100).toFixed(0)}%</h4>
              <span>Avg Confidence</span>
            </div>
          </div>
        </div>

        {/* Progressive Confidence Visualization */}
        {analysis.confidenceProgression && analysis.confidenceProgression.length > 0 && (
          <div className="progressive-confidence-section">
            <h3>📈 Progressive Confidence Building</h3>
            <div className="confidence-timeline">
              {analysis.confidenceProgression.map((step, index) => (
                <div key={index} className="confidence-step">
                  <div className="step-number">{step.step}</div>
                  <div className="step-details">
                    <div className="step-header">
                      <span className="step-source">{step.source}</span>
                      <span className="step-confidence">
                        {(step.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="step-breakdown">
                      <div className="confidence-component">
                        <span>Base: {(step.contribution * 100).toFixed(1)}%</span>
                      </div>
                      <div className="confidence-component">
                        <span>Progressive: +{(step.boost * 100).toFixed(1)}%</span>
                      </div>
                      <div className="confidence-component">
                        <span>Credibility: +{(step.credibility * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="step-bar">
                    <div 
                      className="step-fill"
                      style={{ width: `${step.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hazard Events List */}
        <div className="hazards-section">
          <h3>🌊 Clustered Hazard Events ({hazards.length})</h3>
          {hazards.length === 0 ? (
            <div className="empty-state">
              <p>No {categoryType} events found</p>
            </div>
          ) : (
            <div className="hazards-grid">
              {hazards.map(hazard => (
                <div key={hazard.id} className="hazard-event-card">
                  <div className="hazard-event-header">
                    <div className="hazard-event-title">
                      <h4>Event #{hazard.id}</h4>
                      <span className={`status-badge ${hazard.status}`}>
                        {hazard.status}
                      </span>
                    </div>
                    <div className="hazard-event-confidence">
                      <div className="confidence-circle">
                        <span>{(hazard.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="hazard-event-details">
                    <div className="detail-row">
                      <span>📍 Location:</span>
                      <span>{hazard.centroid_lat.toFixed(4)}°N, {hazard.centroid_lon.toFixed(4)}°E</span>
                    </div>
                    <div className="detail-row">
                      <span>⏰ Created:</span>
                      <span>{new Date(hazard.created_at).toLocaleString()}</span>
                    </div>
                    <div className="detail-row">
                      <span>🎯 Severity:</span>
                      <span>{'⭐'.repeat(hazard.severity)}</span>
                    </div>
                  </div>

                  <div className="hazard-event-actions">
                    <button 
                      onClick={() => onHazardSelect(hazard)}
                      className="btn-details"
                    >
                      View Details
                    </button>
                    <button 
                      onClick={() => onValidationAction(hazard.id, 'approve')}
                      className="btn-approve"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => onValidationAction(hazard.id, 'reject')}
                      className="btn-reject"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="category-dashboard">
      {/* Navigation */}
      <div className="dashboard-nav">
        {Object.entries(categories).map(([key, category]) => (
          <button
            key={key}
            className={`nav-button ${activeCategory === key ? 'active' : ''}`}
            onClick={() => setActiveCategory(key)}
            style={{ '--category-color': category.color }}
          >
            <span className="nav-icon">{category.icon}</span>
            <span className="nav-text">{category.name}</span>
            {key !== 'overview' && (
              <span className="nav-badge">
                {getCategoryStats(key).pendingReview}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {activeCategory === 'overview' ? 
          renderOverview() : 
          renderCategoryView(activeCategory)
        }
      </div>

      <style jsx>{`
        .category-dashboard {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #f8f9fa;
        }

        .dashboard-nav {
          display: flex;
          background: white;
          border-bottom: 1px solid #e1e8ed;
          padding: 1rem;
          gap: 0.5rem;
          overflow-x: auto;
        }

        .nav-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border: 1px solid #dee2e6;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          position: relative;
        }

        .nav-button:hover {
          background: #f8f9fa;
          border-color: var(--category-color);
        }

        .nav-button.active {
          background: var(--category-color);
          color: white;
          border-color: var(--category-color);
        }

        .nav-icon {
          font-size: 1.2rem;
        }

        .nav-text {
          font-weight: 500;
        }

        .nav-badge {
          background: rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          min-width: 20px;
          text-align: center;
        }

        .nav-button:not(.active) .nav-badge {
          background: #e74c3c;
          color: white;
        }

        .dashboard-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          gap: 1rem;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Overview Styles */
        .overview-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .stat-icon {
          font-size: 2.5rem;
          opacity: 0.8;
        }

        .stat-content h3 {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .stat-content p {
          margin: 0;
          color: #7f8c8d;
          font-weight: 500;
        }

        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .category-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          border-left: 4px solid #3498db;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .category-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .category-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .category-icon {
          font-size: 2rem;
        }

        .category-header h3 {
          margin: 0;
          color: #2c3e50;
        }

        .category-description {
          color: #7f8c8d;
          margin-bottom: 1.5rem;
        }

        .category-stats {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .stat-label {
          font-size: 0.8rem;
          color: #7f8c8d;
          text-transform: uppercase;
        }

        .category-confidence {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .confidence-bar {
          height: 8px;
          background: #ecf0f1;
          border-radius: 4px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .confidence-text {
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        /* Category View Styles */
        .category-view {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .category-header-section {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .category-title {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .category-icon-large {
          font-size: 4rem;
        }

        .category-title h2 {
          margin: 0;
          color: #2c3e50;
        }

        .category-title p {
          margin: 0;
          color: #7f8c8d;
        }

        .category-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1.5rem;
        }

        .summary-stat {
          text-align: center;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .summary-stat h4 {
          margin: 0;
          font-size: 2rem;
          color: #2c3e50;
        }

        .summary-stat span {
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        /* Progressive Confidence Styles */
        .progressive-confidence-section {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .progressive-confidence-section h3 {
          margin-top: 0;
          color: #2c3e50;
        }

        .confidence-timeline {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .confidence-step {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .step-number {
          width: 40px;
          height: 40px;
          background: #3498db;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .step-details {
          flex: 1;
        }

        .step-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .step-source {
          font-weight: 600;
          color: #2c3e50;
        }

        .step-confidence {
          font-weight: 700;
          color: #27ae60;
        }

        .step-breakdown {
          display: flex;
          gap: 1rem;
          font-size: 0.85rem;
          color: #7f8c8d;
        }

        .step-bar {
          width: 200px;
          height: 8px;
          background: #ecf0f1;
          border-radius: 4px;
          overflow: hidden;
        }

        .step-fill {
          height: 100%;
          background: linear-gradient(90deg, #3498db, #27ae60);
          transition: width 0.3s ease;
        }

        /* Hazards Section Styles */
        .hazards-section {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .hazards-section h3 {
          margin-top: 0;
          color: #2c3e50;
        }

        .hazards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .hazard-event-card {
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .hazard-event-card:hover {
          border-color: #3498db;
          box-shadow: 0 4px 15px rgba(52, 152, 219, 0.1);
        }

        .hazard-event-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .hazard-event-title h4 {
          margin: 0;
          color: #2c3e50;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.pending {
          background: #fff3cd;
          color: #856404;
        }

        .status-badge.review {
          background: #f8d7da;
          color: #721c24;
        }

        .status-badge.approved {
          background: #d4edda;
          color: #155724;
        }

        .confidence-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3498db, #27ae60);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        }

        .hazard-event-details {
          margin-bottom: 1.5rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .detail-row span:first-child {
          color: #7f8c8d;
        }

        .detail-row span:last-child {
          font-weight: 500;
          color: #2c3e50;
        }

        .hazard-event-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-details, .btn-approve, .btn-reject {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .btn-details {
          background: #3498db;
          color: white;
        }

        .btn-approve {
          background: #27ae60;
          color: white;
        }

        .btn-reject {
          background: #e74c3c;
          color: white;
        }

        .btn-details:hover, .btn-approve:hover, .btn-reject:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #7f8c8d;
        }

        @media (max-width: 768px) {
          .dashboard-nav {
            padding: 0.5rem;
          }

          .nav-button {
            padding: 0.5rem 1rem;
          }

          .nav-text {
            display: none;
          }

          .dashboard-content {
            padding: 1rem;
          }

          .category-title {
            flex-direction: column;
            text-align: center;
          }

          .hazards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default CategoryBasedDashboard;