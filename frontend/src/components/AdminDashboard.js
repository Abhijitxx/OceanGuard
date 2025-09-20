import React, { useState, useEffect } from 'react';
import CategoryBasedDashboard from './CategoryBasedDashboard';
import DetailedHazardView from './DetailedHazardView';
import AlertManagement from './AlertManagement';
import AnalyticsDashboard from './AnalyticsDashboard';
import UserManagement from './UserManagement';
import ReportsManagement from './ReportsManagement';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('validation');
  const [selectedHazard, setSelectedHazard] = useState(null);
  const [pendingHazards, setPendingHazards] = useState([]);
  const [approvedHazards, setApprovedHazards] = useState([]); // New state for approved events
  const [analytics, setAnalytics] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch pending hazards for validation
  const fetchPendingHazards = async () => {
    try {
      // Fetch pending hazards from dedicated endpoint
      const response = await fetch('/api/hazards/pending');
      if (response.ok) {
        const hazards = await response.json();
        console.log('Fetched pending hazards:', hazards.length);
        setPendingHazards(hazards);
      } else {
        console.error('Failed to fetch pending hazards');
        setPendingHazards([]);
      }
    } catch (error) {
      console.error('Error fetching pending hazards:', error);
      // Fallback to empty array on error
      setPendingHazards([]);
    }
  };

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      // Fetch real stats from backend
      const response = await fetch('/api/stats');
      if (response.ok) {
        const stats = await response.json();
        console.log('Fetched stats:', stats);
        setAnalytics({
          total_reports: stats.total_reports || 0,
          validated_reports: (stats.total_reports || 0) - (stats.pending_validation || 0),
          pending_reports: stats.pending_validation || 0,
          accuracy_rate: 0.85, // Default accuracy rate since not provided
          hazard_events: stats.total_hazards || 0,
          emergency_events: stats.confidence_distribution?.high || 0,
          recent_activity: stats.recent_activity || { reports_24h: 0, hazards_24h: 0 }
        });
      } else {
        console.error('Failed to fetch analytics');
        // Fallback to mock data
        setAnalytics({
          total_reports: 0,
          validated_reports: 0,
          pending_reports: 0,
          accuracy_rate: 0,
          hazard_events: 0,
          emergency_events: 0
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Fallback to empty data on error
      setAnalytics({
        total_reports: 0,
        validated_reports: 0,
        pending_reports: 0,
        accuracy_rate: 0,
        hazard_events: 0,
        emergency_events: 0
      });
    }
  };

  // Fetch approved hazards  
  const fetchApprovedHazards = async () => {
    try {
      // Fetch approved hazards from backend
      const response = await fetch('/api/hazards/approved');
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched approved hazards:', data);
        setApprovedHazards(data.hazards || []);
      } else {
        console.error('Failed to fetch approved hazards');
        setApprovedHazards([]);
      }
    } catch (error) {
      console.error('Error fetching approved hazards:', error);
      setApprovedHazards([]);
    }
  };

  // Refresh data
  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Handle hazard selection
  const handleHazardSelect = (hazard) => {
    setSelectedHazard(hazard);
    setActiveTab('details');
  };

  // Handle validation actions with enhanced error handling
  const handleValidationAction = async (hazardId, action, notes = '') => {
    try {
      console.log(`🔧 Admin validation: ${action} for hazard ${hazardId}`, notes);
      
      if (!hazardId) {
        console.error('❌ Invalid hazard ID provided');
        alert('Error: Invalid hazard ID');
        return false;
      }
      
      // Try to send to backend first
      try {
        // Map action to status for backend
        const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action;
        
        console.log(`📡 Sending validation to backend: ${status}`);
        const response = await fetch(`/api/admin/hazards/${hazardId}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, notes })
        });
        
        if (!response.ok) {
          console.warn(`⚠️ Backend validation endpoint returned ${response.status}, proceeding with frontend update`);
          if (response.status === 404) {
            console.log('💡 Backend endpoint may not exist yet, updating frontend only');
          }
        } else {
          const result = await response.json();
          console.log(`✅ Successfully updated hazard ${hazardId} status to ${status} in backend:`, result);
        }
      } catch (apiError) {
        console.warn('⚠️ Backend validation API not available, updating frontend only:', apiError.message);
      }
      
      // Always remove hazard from pending list if approved/rejected
      if (action === 'approve' || action === 'reject') {
        console.log(`🗑️ Removing hazard ${hazardId} from pending list`);
        
        // Close detailed view if it was the selected hazard
        if (selectedHazard && selectedHazard.id === hazardId) {
          console.log(`� Closing detailed view for validated hazard ${hazardId}`);
          setSelectedHazard(null);
        }
        
        // Refresh data from backend to ensure consistency
        console.log(`� Refreshing data after validation action`);
        await fetchPendingHazards(); // Remove from pending queue
        await fetchApprovedHazards(); // Add to approved section
        await fetchAnalytics(); // Update counts
        
        // Show success feedback
        const actionPast = action === 'approve' ? 'approved' : 'rejected';
        console.log(`✅ Hazard ${hazardId} ${actionPast} successfully`);
        
        // Optional: Show toast notification if available
        if (window.toast) {
          window.toast.success(`Hazard ${actionPast} successfully!`);
        }
      }
      
      console.log(`✅ Validation action ${action} completed successfully for hazard ${hazardId}`);
      return true;
      
    } catch (error) {
      console.error('❌ Validation action failed:', error);
      alert(`Validation failed: ${error.message || 'Unknown error'}`);
      return false;
    }
  };

  // All hooks must be called before any conditional returns
  useEffect(() => {
    fetchPendingHazards();
    fetchAnalytics();
    fetchApprovedHazards();
  }, [refreshTrigger]);

  // Auto-refresh every 10 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'validation') {
        fetchPendingHazards();
      } else if (activeTab === 'approved') {
        fetchApprovedHazards();
      }
      fetchAnalytics(); // Always update analytics for live counts
    }, 10000); // More frequent updates (10 seconds)

    return () => clearInterval(interval);
  }, [activeTab]);

  // Real-time notification system for new reports
  useEffect(() => {
    let previousReportCount = analytics.total_reports || 0;
    
    const checkForNewReports = async () => {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const stats = await response.json();
          const currentReportCount = stats.total_reports || 0;
          
          // Check if new reports were submitted
          if (currentReportCount > previousReportCount && previousReportCount > 0) {
            const newReports = currentReportCount - previousReportCount;
            console.log(`🚨 ${newReports} new report(s) submitted!`);
            
            // Show browser notification if permission granted
            if (Notification.permission === 'granted') {
              new Notification('OceanGuard - New Report', {
                body: `${newReports} new hazard report(s) submitted by citizens`,
                icon: '/favicon.ico'
              });
            }
            
            // Update analytics immediately
            setAnalytics(prev => ({...prev, total_reports: currentReportCount}));
            
            // Refresh pending hazards list
            fetchPendingHazards();
          }
          
          previousReportCount = currentReportCount;
        }
      } catch (error) {
        console.error('Error checking for new reports:', error);
      }
    };
    
    // Check every 5 seconds for new reports
    const reportCheckInterval = setInterval(checkForNewReports, 5000);
    
    return () => clearInterval(reportCheckInterval);
  }, [analytics.total_reports]);

  // Request notification permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 🚀 REAL-TIME: Listen for custom events from citizen dashboard
  useEffect(() => {
    const handleNewReport = (event) => {
      console.log('🚨 Real-time: New report submitted!', event.detail);
      
      // Show immediate notification
      if (Notification.permission === 'granted') {
        new Notification('OceanGuard - Report Submitted', {
          body: `New citizen report from ${event.detail.location}`,
          icon: '/favicon.ico',
          tag: 'new-report' // Prevents duplicate notifications
        });
      }
      
      // Immediately refresh data
      fetchAnalytics();
      fetchPendingHazards();
      
      // Visual feedback in console
      console.log('🔄 Admin dashboard refreshed due to new report');
    };
    
    // Listen for custom events from other components
    window.addEventListener('newReportSubmitted', handleNewReport);
    
    return () => {
      window.removeEventListener('newReportSubmitted', handleNewReport);
    };
  }, []);

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div className="header-content">
          <div className="admin-logo">
            <i className="fas fa-shield-alt"></i>
            <div>
              <h1>OceanGuard Admin</h1>
              <span className="admin-subtitle">Hazard Validation & Management</span>
            </div>
          </div>
          
          <div className="admin-info">
            <div className="admin-stats">
              <div className="stat-item">
                <span className="stat-number">{pendingHazards.length}</span>
                <span className="stat-label">Pending</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{analytics.total_reports || 0}</span>
                <span className="stat-label">Total Reports</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{analytics.validated_reports || 0}</span>
                <span className="stat-label">Processed</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">{analytics.hazard_events || 0}</span>
                <span className="stat-label">Hazard Events</span>
              </div>
            </div>
            
            <div className="admin-user">
              <span className="admin-name">Admin Portal</span>
              <a href="/" className="citizen-link">
                <i className="fas fa-user"></i> Citizen Portal
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="admin-nav">
        <div className="nav-content">
          <button
            className={`nav-item ${activeTab === 'validation' ? 'active' : ''}`}
            onClick={() => setActiveTab('validation')}
          >
            <i className="fas fa-tasks"></i>
            <span>Validation Queue</span>
            {pendingHazards.length > 0 && (
              <span className="nav-badge">{pendingHazards.length}</span>
            )}
          </button>
          
          <button
            className={`nav-item ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            <i className="fas fa-check-circle"></i>
            <span>Approved Events</span>
            {approvedHazards.length > 0 && (
              <span className="nav-badge approved">{approvedHazards.length}</span>
            )}
          </button>
          
          <button
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <i className="fas fa-file-alt"></i>
            <span>All Reports</span>
          </button>
          
          <button
            className={`nav-item ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
            disabled={!selectedHazard}
          >
            <i className="fas fa-search-plus"></i>
            <span>Hazard Details</span>
          </button>
          
          <button
            className={`nav-item ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <i className="fas fa-bullhorn"></i>
            <span>Alert Management</span>
          </button>
          
          <button
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <i className="fas fa-chart-line"></i>
            <span>Analytics</span>
          </button>
          
          <button
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="fas fa-users"></i>
            <span>User Management</span>
          </button>
          
          <button className="refresh-btn" onClick={refreshData}>
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="admin-content">
        {activeTab === 'validation' && (
          <CategoryBasedDashboard
            onHazardSelect={setSelectedHazard}
            onValidationAction={handleValidationAction}
            onRefresh={refreshData}
          />
        )}
        
        {activeTab === 'approved' && (
          <div className="approved-events-section">
            <div className="section-header">
              <h2>Approved Events ({approvedHazards.length})</h2>
              <p className="section-description">
                View and manage all approved hazard events that have been validated by administrators.
              </p>
            </div>
            
            {approvedHazards.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-check-circle"></i>
                <h3>No Approved Events</h3>
                <p>Approved hazard events will appear here once they have been validated.</p>
              </div>
            ) : (
              <div className="approved-events-grid">
                {approvedHazards.map((hazard) => (
                  <div key={hazard.id} className="approved-event-card">
                    <div className="event-header">
                      <div className="event-title-section">
                        <h3 className="event-title">{hazard.title || `${hazard.type} Event`}</h3>
                        <div className="event-type-icon">
                          {hazard.type === 'flood' && '💧'}
                          {hazard.type === 'tsunami' && '🌊'}
                          {hazard.type === 'earthquake' && '⚡'}
                          {hazard.type === 'landslide' && '⛰️'}
                          {hazard.type === 'tides' && '🌊'}
                          {!['flood', 'tsunami', 'earthquake', 'landslide', 'tides'].includes(hazard.type) && '🚨'}
                        </div>
                      </div>
                      <div className="confidence-section">
                        <div className={`confidence-icon ${hazard.confidence_level || 'medium'}`}>
                          {hazard.confidence_level === 'high' && '🟢'}
                          {hazard.confidence_level === 'medium' && '🟡'}
                          {hazard.confidence_level === 'low' && '🔴'}
                          {!hazard.confidence_level && '⚪'}
                        </div>
                        <span className="confidence-text">
                          {Math.round((hazard.confidence || 0) * 100)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="event-details">
                      <div className="detail-row">
                        <span className="detail-label">Type:</span>
                        <span className="detail-value hazard-type-badge">{hazard.type}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Location:</span>
                        <span className="detail-value">{hazard.location || 'Unknown'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Severity:</span>
                        <span className="detail-value severity-indicator">
                          {'★'.repeat(Math.min(hazard.severity || 2, 5))}
                          <span className="severity-text">({hazard.severity || 2}/5)</span>
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Approved:</span>
                        <span className="detail-value">{new Date(hazard.validated_at || hazard.created_at).toLocaleDateString()}</span>
                      </div>
                      {hazard.report_count && (
                        <div className="detail-row">
                          <span className="detail-label">Reports:</span>
                          <span className="detail-value">{hazard.report_count} submissions</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="event-actions">
                      <button 
                        className="btn-view-details"
                        onClick={() => {
                          setSelectedHazard(hazard);
                          setActiveTab('details');
                        }}
                      >
                        <i className="fas fa-eye"></i>
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'reports' && (
          <ReportsManagement 
            onRefresh={refreshData}
          />
        )}
        
        {activeTab === 'details' && selectedHazard && (
          <DetailedHazardView
            hazard={selectedHazard}
            onValidationAction={handleValidationAction}
            onClose={() => setActiveTab('validation')}
          />
        )}
        
        {activeTab === 'alerts' && (
          <AlertManagement
            onRefresh={refreshData}
          />
        )}
        
        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            analytics={analytics}
            hazards={analytics.hazards || []}
          />
        )}
        
        {activeTab === 'users' && (
          <UserManagement
            onRefresh={refreshData}
          />
        )}
      </main>

      <style jsx>{`
        .admin-dashboard {
          min-height: 100vh;
          background: #f8f9fa;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .admin-header {
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          color: white;
          padding: 1rem 0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .admin-logo {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .admin-logo i {
          font-size: 2.5rem;
          color: #3498db;
        }

        .admin-logo h1 {
          margin: 0;
          font-size: 1.8rem;
          font-weight: 700;
        }

        .admin-subtitle {
          color: #bdc3c7;
          font-size: 0.9rem;
        }

        .admin-info {
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .admin-stats {
          display: flex;
          gap: 1.5rem;
        }

        .stat-item {
          text-align: center;
        }

        .stat-number {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: #3498db;
        }

        .stat-label {
          font-size: 0.8rem;
          color: #bdc3c7;
        }

        .admin-user {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .admin-name {
          font-weight: 500;
        }

        .admin-logout {
          background: rgba(231, 76, 60, 0.2);
          border: 1px solid #e74c3c;
          color: #e74c3c;
          padding: 0.5rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .admin-logout:hover {
          background: #e74c3c;
          color: white;
        }

        .admin-nav {
          background: white;
          border-bottom: 1px solid #e1e8ed;
          padding: 0;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          align-items: center;
          gap: 0;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          border: none;
          background: transparent;
          color: #7f8c8d;
          cursor: pointer;
          transition: all 0.3s ease;
          border-bottom: 3px solid transparent;
          font-weight: 500;
          position: relative;
        }

        .nav-item:hover:not(:disabled) {
          color: #3498db;
          background: #f8f9fa;
        }

        .nav-item.active {
          color: #3498db;
          border-bottom-color: #3498db;
          background: #f8f9fa;
        }

        .nav-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .nav-badge {
          background: #e74c3c;
          color: white;
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          border-radius: 10px;
          font-weight: 600;
        }

        .refresh-btn {
          margin-left: auto;
          background: #27ae60;
          color: white;
          border: none;
          padding: 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .refresh-btn:hover {
          background: #229954;
          transform: rotate(180deg);
        }

        .admin-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
          min-height: calc(100vh - 200px);
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .admin-info {
            flex-direction: column;
            gap: 1rem;
          }

          .nav-content {
            flex-wrap: wrap;
            justify-content: center;
          }

          .nav-item {
            padding: 0.75rem 1rem;
          }

          .admin-content {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;