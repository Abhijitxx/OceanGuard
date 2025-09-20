import React, { useState, useEffect } from 'react';

const AnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('hazards');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Mock analytics data - in real app, fetch from API
      const mockData = {
        overview: {
          totalHazards: 156,
          totalReports: 423,
          averageConfidence: 0.78,
          responseTime: '12m',
          validatedHazards: 134,
          falsePositives: 22
        },
        // Progressive confidence data removed - not required
        hazardTypes: [
          { type: 'flood', count: 67, percentage: 43, trend: '+12%' },
          { type: 'tsunami', count: 25, percentage: 25, trend: '+8%' },
          { type: 'tides', count: 18, percentage: 18, trend: '+3%' },
          { type: 'earthquake', count: 12, percentage: 12, trend: '+15%' },
          { type: 'landslide', count: 8, percentage: 5, trend: '+2%' }
        ],
        sourceContribution: [
          { source: 'Citizen Reports', count: 234, percentage: 55, reliability: 0.82 },
          { source: 'INCOIS Data', count: 98, percentage: 23, reliability: 0.94 },
          { source: 'Social Media', count: 67, percentage: 16, reliability: 0.68 },
          { source: 'LoRa SOS', count: 24, percentage: 6, reliability: 0.96 }
        ],
        temporalData: {
          hourly: [
            { hour: '00', hazards: 8, reports: 15 },
            { hour: '06', hazards: 12, reports: 28 },
            { hour: '12', hazards: 18, reports: 42 },
            { hour: '18', hazards: 15, reports: 35 },
            { hour: '24', hazards: 10, reports: 22 }
          ],
          daily: [
            { day: 'Mon', hazards: 23, reports: 56 },
            { day: 'Tue', hazards: 18, reports: 43 },
            { day: 'Wed', hazards: 31, reports: 72 },
            { day: 'Thu', hazards: 25, reports: 58 },
            { day: 'Fri', hazards: 29, reports: 67 },
            { day: 'Sat', hazards: 19, reports: 41 },
            { day: 'Sun', hazards: 11, reports: 26 }
          ]
        },
        geographicData: [
          { region: 'North Coast', hazards: 45, severity: 3.2, population: 125000 },
          { region: 'South Coast', hazards: 38, severity: 2.8, population: 98000 },
          { region: 'East Coast', hazards: 42, severity: 3.5, population: 156000 },
          { region: 'West Coast', hazards: 31, severity: 2.9, population: 87000 }
        ],
        performanceMetrics: {
          validationAccuracy: 0.89,
          falsePositiveRate: 0.14,
          averageResponseTime: 720, // seconds
          userEngagement: 0.76,
          systemUptime: 0.998
        }
      };
      
      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    }
    setIsLoading(false);
  };

  const getHazardIcon = (type) => {
    const icons = {
      flood: '💧',
      tsunami: '�',
      tides: '�',
      earthquake: '⚡',
      landslide: '⛰️',
      emergency: '🚨'
    };
    return icons[type] || '⚠️';
  };

  const getSourceIcon = (source) => {
    const icons = {
      'Citizen Reports': '👤',
      'INCOIS Data': '🛰️',
      'Social Media': '📱',
      'LoRa SOS': '📡'
    };
    return icons[source] || '📄';
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getReliabilityColor = (reliability) => {
    if (reliability >= 0.9) return '#27ae60';
    if (reliability >= 0.8) return '#f39c12';
    if (reliability >= 0.7) return '#e67e22';
    return '#e74c3c';
  };

  const getTrendColor = (trend) => {
    if (trend.startsWith('+')) return '#27ae60';
    if (trend.startsWith('-')) return '#e74c3c';
    return '#95a5a6';
  };

  const getConfidenceRangeColor = (range) => {
    switch (range) {
      case '0-20%': return '#e74c3c';
      case '21-40%': return '#e67e22';
      case '41-60%': return '#f39c12';
      case '61-80%': return '#27ae60';
      case '81-100%': return '#2ecc71';
      default: return '#95a5a6';
    }
  };

  if (isLoading) {
    return (
      <div className="analytics-loading">
        <i className="fas fa-chart-bar fa-spin"></i>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div className="header-left">
          <h2>
            <i className="fas fa-chart-line"></i>
            Analytics Dashboard
          </h2>
          <p>Comprehensive insights into coastal hazard monitoring system</p>
        </div>
        
        <div className="time-range-selector">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="overview-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="stat-content">
            <h3>{analyticsData.overview.totalHazards}</h3>
            <p>Total Hazards</p>
            <span className="stat-change positive">+{Math.round(analyticsData.overview.totalHazards * 0.08)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <div className="stat-content">
            <h3>{analyticsData.overview.totalReports}</h3>
            <p>Total Reports</p>
            <span className="stat-change positive">+{Math.round(analyticsData.overview.totalReports * 0.12)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-content">
            <h3>{(analyticsData.overview.averageConfidence * 100).toFixed(1)}%</h3>
            <p>Avg Confidence</p>
            <span className="stat-change positive">+2.3%</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <h3>{analyticsData.overview.responseTime}</h3>
            <p>Avg Response</p>
            <span className="stat-change negative">-1.2m</span>
          </div>
        </div>
      </div>

      {/* Progressive Confidence Analytics removed - not required */}

      <div className="analytics-grid">
        {/* Hazard Types Distribution */}
        <div className="analytics-card">
          <h3>
            <i className="fas fa-chart-pie"></i>
            Hazard Types Distribution
          </h3>
          <div className="hazard-types-chart">
            {analyticsData.hazardTypes.map((hazard, index) => (
              <div key={hazard.type} className="hazard-type-item">
                <div className="hazard-info">
                  <span className="hazard-icon">{getHazardIcon(hazard.type)}</span>
                  <div className="hazard-details">
                    <span className="hazard-name">{hazard.type.charAt(0).toUpperCase() + hazard.type.slice(1)}</span>
                    <span className="hazard-count">{hazard.count} incidents</span>
                  </div>
                </div>
                <div className="hazard-stats">
                  <div className="percentage-bar">
                    <div 
                      className="percentage-fill" 
                      style={{ width: `${hazard.percentage}%` }}
                    ></div>
                    <span className="percentage-text">{hazard.percentage}%</span>
                  </div>
                  <span 
                    className="trend" 
                    style={{ color: getTrendColor(hazard.trend) }}
                  >
                    {hazard.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source Contribution */}
        <div className="analytics-card">
          <h3>
            <i className="fas fa-sources"></i>
            Data Source Contribution
          </h3>
          <div className="source-contribution">
            {analyticsData.sourceContribution.map((source) => (
              <div key={source.source} className="source-item">
                <div className="source-header">
                  <div className="source-info">
                    <span className="source-icon">{getSourceIcon(source.source)}</span>
                    <span className="source-name">{source.source}</span>
                  </div>
                  <span className="source-count">{source.count}</span>
                </div>
                <div className="source-metrics">
                  <div className="contribution-bar">
                    <div 
                      className="contribution-fill" 
                      style={{ width: `${source.percentage}%` }}
                    ></div>
                    <span className="contribution-text">{source.percentage}%</span>
                  </div>
                  <div className="reliability">
                    <span>Reliability: </span>
                    <span 
                      style={{ color: getReliabilityColor(source.reliability) }}
                      className="reliability-score"
                    >
                      {(source.reliability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Temporal Analysis */}
        <div className="analytics-card">
          <h3>
            <i className="fas fa-calendar-alt"></i>
            Temporal Analysis
          </h3>
          <div className="temporal-selector">
            <button 
              className={selectedMetric === 'hazards' ? 'active' : ''}
              onClick={() => setSelectedMetric('hazards')}
            >
              Hazards
            </button>
            <button 
              className={selectedMetric === 'reports' ? 'active' : ''}
              onClick={() => setSelectedMetric('reports')}
            >
              Reports
            </button>
          </div>
          <div className="temporal-chart">
            <div className="chart-bars">
              {analyticsData.temporalData.daily.map((day) => (
                <div key={day.day} className="chart-bar-group">
                  <div 
                    className="chart-bar"
                    style={{ 
                      height: `${(day[selectedMetric] / Math.max(...analyticsData.temporalData.daily.map(d => d[selectedMetric]))) * 100}%` 
                    }}
                    title={`${day.day}: ${day[selectedMetric]} ${selectedMetric}`}
                  ></div>
                  <span className="chart-label">{day.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="analytics-card">
          <h3>
            <i className="fas fa-map-marked-alt"></i>
            Geographic Distribution
          </h3>
          <div className="geographic-data">
            {analyticsData.geographicData.map((region) => (
              <div key={region.region} className="region-item">
                <div className="region-header">
                  <h4>{region.region}</h4>
                  <span className="region-population">
                    👥 {(region.population / 1000).toFixed(0)}K residents
                  </span>
                </div>
                <div className="region-metrics">
                  <div className="region-metric">
                    <span className="metric-label">Hazards:</span>
                    <span className="metric-value">{region.hazards}</span>
                  </div>
                  <div className="region-metric">
                    <span className="metric-label">Avg Severity:</span>
                    <span className="metric-value">
                      {'⭐'.repeat(Math.floor(region.severity))} ({region.severity.toFixed(1)})
                    </span>
                  </div>
                  <div className="region-metric">
                    <span className="metric-label">Risk Index:</span>
                    <span className="metric-value risk-index">
                      {((region.hazards / region.population) * 100000).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="analytics-card full-width">
          <h3>
            <i className="fas fa-tachometer-alt"></i>
            System Performance Metrics
          </h3>
          <div className="performance-grid">
            <div className="performance-metric">
              <div className="metric-circle">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path className="circle"
                    strokeDasharray={`${analyticsData.performanceMetrics.validationAccuracy * 100}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" className="percentage">
                    {(analyticsData.performanceMetrics.validationAccuracy * 100).toFixed(0)}%
                  </text>
                </svg>
              </div>
              <span className="metric-name">Validation Accuracy</span>
            </div>

            <div className="performance-metric">
              <div className="metric-circle">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path className="circle false-positive"
                    strokeDasharray={`${analyticsData.performanceMetrics.falsePositiveRate * 100}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" className="percentage">
                    {(analyticsData.performanceMetrics.falsePositiveRate * 100).toFixed(0)}%
                  </text>
                </svg>
              </div>
              <span className="metric-name">False Positive Rate</span>
            </div>

            <div className="performance-metric">
              <div className="metric-value-large">
                {formatDuration(analyticsData.performanceMetrics.averageResponseTime)}
              </div>
              <span className="metric-name">Avg Response Time</span>
            </div>

            <div className="performance-metric">
              <div className="metric-circle">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path className="circle"
                    strokeDasharray={`${analyticsData.performanceMetrics.userEngagement * 100}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" className="percentage">
                    {(analyticsData.performanceMetrics.userEngagement * 100).toFixed(0)}%
                  </text>
                </svg>
              </div>
              <span className="metric-name">User Engagement</span>
            </div>

            <div className="performance-metric">
              <div className="metric-circle">
                <svg viewBox="0 0 36 36" className="circular-chart">
                  <path className="circle-bg"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path className="circle uptime"
                    strokeDasharray={`${analyticsData.performanceMetrics.systemUptime * 100}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" className="percentage">
                    {(analyticsData.performanceMetrics.systemUptime * 100).toFixed(1)}%
                  </text>
                </svg>
              </div>
              <span className="metric-name">System Uptime</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .analytics-dashboard {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .analytics-loading {
          text-align: center;
          padding: 4rem;
          color: #7f8c8d;
        }

        .analytics-loading i {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .analytics-header {
          background: linear-gradient(135deg, #9b59b6, #8e44ad);
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

        .time-range-selector select {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
        }

        .overview-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          padding: 1.5rem;
          background: #f8f9fa;
        }

        .stat-card {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .stat-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3498db, #2980b9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.5rem;
        }

        .stat-content h3 {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .stat-content p {
          margin: 0.25rem 0;
          color: #7f8c8d;
          font-weight: 500;
        }

        .stat-change {
          font-size: 0.85rem;
          font-weight: 600;
        }

        .stat-change.positive {
          color: #27ae60;
        }

        .stat-change.negative {
          color: #e74c3c;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
          padding: 1.5rem;
        }

        .analytics-card {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
        }

        .analytics-card.full-width {
          grid-column: 1 / -1;
        }

        .analytics-card h3 {
          margin: 0 0 1.5rem 0;
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
        }

        .hazard-types-chart {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .hazard-type-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .hazard-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
        }

        .hazard-icon {
          font-size: 1.5rem;
        }

        .hazard-details {
          display: flex;
          flex-direction: column;
        }

        .hazard-name {
          font-weight: 600;
          color: #2c3e50;
        }

        .hazard-count {
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .hazard-stats {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .percentage-bar {
          width: 100px;
          height: 20px;
          background: #ecf0f1;
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }

        .percentage-fill {
          height: 100%;
          background: linear-gradient(90deg, #3498db, #2980b9);
          transition: width 0.3s ease;
        }

        .percentage-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.8rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .trend {
          font-weight: 600;
          font-size: 0.9rem;
        }

        .source-contribution {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .source-item {
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .source-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .source-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .source-icon {
          font-size: 1.2rem;
        }

        .source-name {
          font-weight: 600;
          color: #2c3e50;
        }

        .source-count {
          font-weight: 600;
          color: #3498db;
        }

        .source-metrics {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .contribution-bar {
          width: 120px;
          height: 16px;
          background: #ecf0f1;
          border-radius: 8px;
          position: relative;
          overflow: hidden;
        }

        .contribution-fill {
          height: 100%;
          background: linear-gradient(90deg, #27ae60, #2ecc71);
          transition: width 0.3s ease;
        }

        .contribution-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.7rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .reliability {
          font-size: 0.9rem;
        }

        .reliability-score {
          font-weight: 600;
        }

        .temporal-selector {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .temporal-selector button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .temporal-selector button.active {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }

        .temporal-chart {
          height: 200px;
          display: flex;
          align-items: end;
          padding: 1rem 0;
        }

        .chart-bars {
          display: flex;
          justify-content: space-between;
          align-items: end;
          width: 100%;
          height: 100%;
        }

        .chart-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }

        .chart-bar {
          width: 30px;
          background: linear-gradient(180deg, #3498db, #2980b9);
          border-radius: 4px 4px 0 0;
          cursor: pointer;
          transition: all 0.3s ease;
          min-height: 10px;
        }

        .chart-bar:hover {
          background: linear-gradient(180deg, #2980b9, #3498db);
        }

        .chart-label {
          font-size: 0.8rem;
          font-weight: 500;
          color: #7f8c8d;
        }

        .geographic-data {
          display: grid;
          gap: 1rem;
        }

        .region-item {
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .region-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .region-header h4 {
          margin: 0;
          color: #2c3e50;
        }

        .region-population {
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .region-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 1rem;
        }

        .region-metric {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .metric-label {
          font-size: 0.8rem;
          color: #7f8c8d;
          font-weight: 500;
        }

        .metric-value {
          font-weight: 600;
          color: #2c3e50;
        }

        .risk-index {
          color: #e74c3c;
        }

        .performance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 2rem;
          text-align: center;
        }

        .performance-metric {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .metric-circle {
          width: 80px;
          height: 80px;
        }

        .circular-chart {
          display: block;
          margin: 10px auto;
          max-width: 80%;
          max-height: 250px;
        }

        .circle-bg {
          fill: none;
          stroke: #eee;
          stroke-width: 3.8;
        }

        .circle {
          fill: none;
          stroke-width: 2.8;
          stroke-linecap: round;
          animation: progress 1s ease-out forwards;
          stroke: #3498db;
        }

        .circle.false-positive {
          stroke: #e74c3c;
        }

        .circle.uptime {
          stroke: #27ae60;
        }

        .percentage {
          fill: #666;
          font-family: sans-serif;
          font-size: 0.5em;
          text-anchor: middle;
        }

        .metric-value-large {
          font-size: 2rem;
          font-weight: 700;
          color: #3498db;
        }

        .metric-name {
          font-weight: 600;
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        @keyframes progress {
          0% {
            stroke-dasharray: 0 100;
          }
        }

        /* Progressive Confidence Styles */
        .progressive-confidence-section {
          margin: 2rem 0;
        }

        .section-title {
          color: #2c3e50;
          margin-bottom: 1.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 3px solid #3498db;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .confidence-analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
          gap: 1.5rem;
        }

        /* Source Reliability Analysis */
        .source-reliability-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }

        .source-reliability-card {
          background: #f8f9fa;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          padding: 1rem;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .source-reliability-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .source-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .source-header .source-icon {
          font-size: 1.5rem;
        }

        .source-info h4 {
          margin: 0;
          color: #2c3e50;
          font-size: 1rem;
        }

        .report-count {
          font-size: 0.8rem;
          color: #7f8c8d;
        }

        .confidence-metrics {
          margin-bottom: 1rem;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .metric-row.final-metric {
          font-weight: 600;
          border-top: 1px solid #ecf0f1;
          padding-top: 0.5rem;
          margin-top: 0.5rem;
        }

        .metric-label {
          color: #7f8c8d;
        }

        .metric-value {
          color: #2c3e50;
          font-weight: 500;
        }

        .metric-value.peak {
          color: #27ae60;
          font-weight: 600;
        }

        .confidence-progression {
          margin-top: 1rem;
        }

        .progression-bar {
          height: 8px;
          background: #ecf0f1;
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }

        .base-fill {
          height: 100%;
          background: #3498db;
          position: absolute;
          top: 0;
          left: 0;
          border-radius: 4px 0 0 4px;
        }

        .boost-fill {
          height: 100%;
          background: #27ae60;
          position: absolute;
          top: 0;
          border-radius: 0 4px 4px 0;
        }

        .progression-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #7f8c8d;
          margin-top: 0.25rem;
        }

        /* Volume Scaling Chart */
        .volume-scaling-chart {
          padding: 1rem;
        }

        .scaling-legend {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .legend-color.citizen { background: #e74c3c; }
        .legend-color.incois { background: #3498db; }
        .legend-color.social { background: #f39c12; }
        .legend-color.lora { background: #27ae60; }

        .scaling-chart {
          display: flex;
          gap: 1rem;
          align-items: end;
          height: 200px;
          padding: 1rem 0;
        }

        .volume-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .volume-label {
          font-size: 0.8rem;
          color: #7f8c8d;
          text-align: center;
          writing-mode: horizontal-tb;
        }

        .volume-bars {
          display: flex;
          gap: 2px;
          align-items: end;
          height: 150px;
        }

        .volume-bar {
          width: 12px;
          border-radius: 2px 2px 0 0;
          min-height: 2px;
          transition: all 0.3s ease;
        }

        .volume-bar:hover {
          opacity: 0.8;
          transform: scaleX(1.2);
        }

        .volume-bar.citizen { background: #e74c3c; }
        .volume-bar.incois { background: #3498db; }
        .volume-bar.social { background: #f39c12; }
        .volume-bar.lora { background: #27ae60; }

        /* Confidence Distribution */
        .confidence-distribution {
          display: flex;
          gap: 2rem;
          align-items: flex-start;
        }

        .distribution-chart {
          display: flex;
          gap: 1rem;
          align-items: end;
          height: 200px;
          flex: 1;
          padding: 1rem 0;
        }

        .distribution-segment {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .segment-bar {
          width: 100%;
          min-height: 10px;
          border-radius: 4px 4px 0 0;
          transition: all 0.3s ease;
        }

        .segment-bar:hover {
          opacity: 0.8;
          transform: scaleY(1.05);
        }

        .segment-label {
          text-align: center;
          font-size: 0.8rem;
        }

        .segment-label .range {
          display: block;
          color: #2c3e50;
          font-weight: 600;
        }

        .segment-label .count {
          display: block;
          color: #7f8c8d;
        }

        .distribution-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .distribution-item {
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 4px solid transparent;
        }

        .distribution-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .confidence-indicator {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        .stage-name {
          font-weight: 600;
          color: #2c3e50;
          flex: 1;
        }

        .stage-percentage {
          font-weight: 600;
          color: #7f8c8d;
        }

        .stage-description {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          color: #95a5a6;
        }

        /* ML Pipeline Health */
        .pipeline-health {
          display: flex;
          gap: 2rem;
          align-items: flex-start;
        }

        .pipeline-overview {
          flex-shrink: 0;
        }

        .health-score {
          text-align: center;
        }

        .score-circle {
          width: 120px;
          height: 120px;
          margin-bottom: 1rem;
        }

        .circular-chart.health {
          max-width: 100%;
        }

        .circle.health {
          stroke: #27ae60;
        }

        .health-label {
          font-weight: 600;
          color: #2c3e50;
        }

        .pipeline-components {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .component-metric {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 6px;
          border-left: 4px solid #3498db;
        }

        .component-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .component-name {
          font-weight: 600;
          color: #2c3e50;
        }

        .component-score {
          font-weight: 600;
        }

        .component-bar {
          height: 8px;
          background: #ecf0f1;
          border-radius: 4px;
          overflow: hidden;
        }

        .component-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        @media (max-width: 768px) {
          .analytics-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .overview-stats {
            grid-template-columns: 1fr;
          }

          .analytics-grid {
            grid-template-columns: 1fr;
          }

          .hazard-type-item,
          .source-item {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .performance-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default AnalyticsDashboard;