import React, { useState, useEffect } from 'react';

const ReportsManagement = ({ onRefresh }) => {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    filterAndSortReports();
  }, [reports, filterStatus, searchTerm, sortBy]);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/raw-reports?limit=100');
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      } else {
        console.error('Failed to fetch reports');
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortReports = () => {
    let filtered = [...reports];

    // Apply status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'processed') {
        filtered = filtered.filter(report => report.processed === 1);
      } else if (filterStatus === 'unprocessed') {
        filtered = filtered.filter(report => report.processed === 0);
      } else if (filterStatus === 'high_confidence') {
        filtered = filtered.filter(report => report.nlp_conf > 0.7);
      } else if (filterStatus === 'low_confidence') {
        filtered = filtered.filter(report => report.nlp_conf <= 0.4);
      }
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.nlp_type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.ts || b.timestamp) - new Date(a.ts || a.timestamp);
        case 'confidence':
          return (b.nlp_conf || 0) - (a.nlp_conf || 0);
        case 'type':
          return (a.nlp_type || '').localeCompare(b.nlp_type || '');
        case 'user':
          return (a.user_name || '').localeCompare(b.user_name || '');
        default:
          return 0;
      }
    });

    setFilteredReports(filtered);
  };

  const formatTimestamp = (timestamp) => {
    try {
      if (!timestamp) return 'Unknown time';
      let dateString = timestamp;
      if (typeof timestamp === 'string' && !timestamp.includes('T') && !timestamp.includes('Z') && !timestamp.includes('+')) {
        dateString = timestamp.replace(' ', 'T') + 'Z';
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleString();
    } catch (error) {
      return 'Unknown time';
    }
  };

  const getConfidenceColor = (confidence) => {
    if (!confidence) return '#6c757d';
    if (confidence > 0.7) return '#28a745';
    if (confidence > 0.4) return '#ffc107';
    return '#dc3545';
  };

  const getConfidenceLabel = (confidence) => {
    if (!confidence) return 'Unknown';
    if (confidence > 0.7) return 'High';
    if (confidence > 0.4) return 'Medium';
    return 'Low';
  };

  if (isLoading) {
    return (
      <div className="reports-management loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-management">
      <div className="reports-header">
        <h2>All Submitted Reports ({reports.length})</h2>
        <p className="section-description">
          View and manage all citizen reports submitted to the system.
        </p>
      </div>

      {/* Filters and Search */}
      <div className="reports-controls">
        <div className="search-box">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search reports by content, user, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-controls">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Reports</option>
            <option value="processed">Processed</option>
            <option value="unprocessed">Unprocessed</option>
            <option value="high_confidence">High Confidence</option>
            <option value="low_confidence">Low Confidence</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="date">Sort by Date</option>
            <option value="confidence">Sort by Confidence</option>
            <option value="type">Sort by Type</option>
            <option value="user">Sort by User</option>
          </select>
        </div>

        <button onClick={fetchReports} className="refresh-btn">
          <i className="fas fa-sync-alt"></i>
          Refresh
        </button>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-file-alt"></i>
          <h3>No Reports Found</h3>
          <p>No reports match your current filters.</p>
        </div>
      ) : (
        <div className="reports-grid">
          {filteredReports.map((report, index) => (
            <div key={report.id || index} className="report-card">
              <div className="report-header">
                <div className="report-meta">
                  <span className="report-id">#{report.id}</span>
                  <span className="report-user">
                    <i className="fas fa-user"></i>
                    {report.user_name || 'Anonymous'}
                  </span>
                </div>
                <div className="report-status">
                  {report.processed ? (
                    <span className="status-badge processed">
                      <i className="fas fa-check"></i>
                      Processed
                    </span>
                  ) : (
                    <span className="status-badge unprocessed">
                      <i className="fas fa-clock"></i>
                      Pending
                    </span>
                  )}
                </div>
              </div>

              <div className="report-content">
                <p className="report-text">
                  {report.text || 'No description provided'}
                </p>
              </div>

              <div className="report-details">
                <div className="detail-item">
                  <i className="fas fa-map-marker-alt"></i>
                  <span>
                    {report.lat && report.lon 
                      ? `${parseFloat(report.lat).toFixed(4)}, ${parseFloat(report.lon).toFixed(4)}`
                      : 'Location not provided'
                    }
                  </span>
                </div>

                <div className="detail-item">
                  <i className="fas fa-clock"></i>
                  <span>{formatTimestamp(report.ts || report.timestamp)}</span>
                </div>

                {report.nlp_type && (
                  <div className="detail-item">
                    <i className="fas fa-tag"></i>
                    <span className="hazard-type">{report.nlp_type}</span>
                  </div>
                )}

                {report.nlp_conf !== null && report.nlp_conf !== undefined && (
                  <div className="detail-item">
                    <i className="fas fa-chart-bar"></i>
                    <span 
                      className="confidence-indicator"
                      style={{ color: getConfidenceColor(report.nlp_conf) }}
                    >
                      {getConfidenceLabel(report.nlp_conf)} ({Math.round(report.nlp_conf * 100)}%)
                    </span>
                  </div>
                )}

                {report.media_path && (
                  <div className="detail-item">
                    <i className="fas fa-image"></i>
                    <span>Has media</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsManagement;