import React, { useState, useEffect, useRef, useCallback } from 'react';
import HazardMap from './HazardMap';
import ReportForm from './ReportForm';
import { toast } from 'react-toastify';
import './CitizenDashboard.css';

const CitizenDashboard = () => {
  const [activeView, setActiveView] = useState('home');
  const [hazardFeed, setHazardFeed] = useState([]);
  const [hazardEvents, setHazardEvents] = useState([]);
  const [userReports, setUserReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [incoisBulletins, setIncoisBulletins] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Utility function for consistent timestamp formatting
  const formatTimestamp = (timestamp) => {
    try {
      if (!timestamp) return 'Unknown time';
      
      // If timestamp doesn't contain timezone info, treat it as UTC
      let dateString = timestamp;
      if (typeof timestamp === 'string' && !timestamp.includes('T') && !timestamp.includes('Z') && !timestamp.includes('+')) {
        // SQLite format without timezone - treat as UTC
        dateString = timestamp.replace(' ', 'T') + 'Z';
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleString();
    } catch (error) {
      console.error('Error formatting timestamp:', timestamp, error);
      return 'Unknown time';
    }
  };

  const [lastNotificationTime, setLastNotificationTime] = useState({});
  const notificationThrottle = 5000; // 5 seconds between same type notifications

  const shouldShowNotification = (type, content = '') => {
    const key = `${type}_${content}`;
    const now = Date.now();
    const lastTime = lastNotificationTime[key] || 0;
    
    if (now - lastTime > notificationThrottle) {
      setLastNotificationTime(prev => ({ ...prev, [key]: now }));
      return true;
    }
    return false;
  };

  // Fetch functions - moved here to fix initialization order
  const fetchHazardEvents = async () => {
    try {
      // Fetch fewer hazard events to reduce clustering and duplication
      const response = await fetch('/api/hazards?limit=30');
      if (response.ok) {
        const events = await response.json();
        setHazardEvents(events);
        console.log(`Loaded ${events.length} clustered hazard events`);
      }
    } catch (error) {
      console.error('Error fetching hazard events:', error);
    }
  };

  const fetchAllReports = async () => {
    try {
      // Fetch all reports including unprocessed ones so users see their submissions immediately
      const response = await fetch('/api/raw-reports?limit=15');
      if (response.ok) {
        const allReports = await response.json();
        
        // Get user's report IDs from session storage
        const userReportIds = JSON.parse(sessionStorage.getItem('userReportIds') || '[]');
        const userSessionId = sessionStorage.getItem('oceanGuardUserSession');
        
        // Mark user's own reports
        const reportsWithUserFlags = allReports.map(report => ({
          ...report,
          isUserReport: userReportIds.includes(report.id) || 
                       (userSessionId && report.user_session_id === userSessionId)
        }));
        
        setAllReports(reportsWithUserFlags);
        console.log(`📊 Loaded ${reportsWithUserFlags.length} reports (${reportsWithUserFlags.filter(r => r.isUserReport).length} user reports)`);
      }
    } catch (error) {
      console.error('Error fetching all reports:', error);
    }
  };

  const fetchHazardFeed = useCallback(async () => {
    try {
      const response = await fetch('/api/citizen/hazard-feed');
      if (response.ok) {
        const data = await response.json();
        setHazardFeed(data.hazards || []);
      }
    } catch (error) {
      console.error('Error fetching hazard feed:', error);
      // Fallback to hazard events if citizen feed fails
      setHazardFeed(hazardEvents);
    }
  }, [hazardEvents]);

  const fetchUserReports = async () => {
    try {
      const response = await fetch('/api/citizen/my-reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
        setUserReports(data.reports || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
      setUserReports([]);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/citizen/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]); // Ensure it's always an array
    }
  };

  const fetchIncoisBulletins = async () => {
    try {
      const response = await fetch('/api/incois-bulletins?limit=20');
      if (response.ok) {
        const bulletins = await response.json();
        setIncoisBulletins(bulletins);
        console.log(`Loaded ${bulletins.length} INCOIS bulletins`);
      }
    } catch (error) {
      console.error('Error fetching INCOIS bulletins:', error);
    }
  };

  // Helper functions for real-time updates
  const setupPolling = useCallback(() => {
    // Only setup polling if no SSE connection
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    // Fallback to polling if SSE fails
    pollIntervalRef.current = setInterval(() => {
      console.log('🔄 Polling for updates...');
      fetchHazardEvents();
      fetchAllReports();
      fetchHazardFeed();
    }, 15000); // Poll every 15 seconds (less frequent)
  }, [fetchHazardEvents, fetchAllReports, fetchHazardFeed]);

  const handleRealTimeEvent = useCallback((eventData) => {
    console.log('📡 Real-time event:', eventData);
    
    switch (eventData.type) {
      case 'connected':
        console.log('✅ SSE connection established');
        if (shouldShowNotification('connected')) {
          toast.success('🔗 Connected to real-time updates!');
        }
        break;
        
      case 'keepalive':
        // Silent keepalive - no notifications
        console.log('💓 Keepalive received');
        break;
        
      case 'new_report':
        if (shouldShowNotification('new_report', eventData.data.text)) {
          toast.info(`📍 New report: ${eventData.data.user_name} reported ${eventData.data.text}`);
        }
        // Refresh reports to show new one
        fetchAllReports();
        break;
        
      case 'report_processed':
        if (shouldShowNotification('report_processed')) {
          toast.info('🤖 Report processed by ML pipeline');
        }
        // Refresh to show updated confidence scores
        fetchHazardEvents();
        fetchAllReports();
        break;
        
      case 'new_hazard':
        const hazard = eventData.data;
        if (shouldShowNotification('new_hazard', hazard.hazard_type)) {
          toast.warning(`⚠️ New ${hazard.hazard_type} detected! Confidence: ${(hazard.confidence * 100).toFixed(1)}%`);
        }
        // Refresh hazard events
        fetchHazardEvents();
        fetchHazardFeed();
        break;
        
      case 'incois_update':
        if (shouldShowNotification('incois_update')) {
          toast.info('🌊 New INCOIS bulletin available');
        }
        fetchIncoisBulletins();
        break;
        
      default:
        console.log('🔄 General update received, type:', eventData.type);
        // Don't show notification for unknown types
        // Only refresh data if it's a meaningful update
        if (eventData.type !== 'keepalive') {
          fetchHazardEvents();
          fetchAllReports();
          fetchHazardFeed();
        }
    }
  }, [shouldShowNotification, fetchAllReports, fetchHazardEvents, fetchHazardFeed, fetchIncoisBulletins]);

  // Real-time updates setup
  const setupRealTimeUpdates = useCallback(() => {
    // Prevent multiple connections
    if (eventSourceRef.current) {
      console.log('📄 Closing existing SSE connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    // Clear any existing polling
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    
    // Setup Server-Sent Events for real-time updates
    try {
      console.log('🔗 Setting up new SSE connection...');
      const eventSource = new EventSource('http://localhost:8000/api/events');
      eventSourceRef.current = eventSource;
      
      eventSource.onopen = () => {
        console.log('🔗 Connected to real-time events');
        setIsConnected(true);
        // Don't show toast here - handleRealTimeEvent will handle the 'connected' event
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealTimeEvent(data);
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };
      
      eventSource.onerror = (error) => {
        console.log('❌ SSE connection error, falling back to polling');
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;
        setupPolling();
      };
      
    } catch (error) {
      console.log('❌ SSE not supported, using polling');
      setupPolling();
    }
  }, [handleRealTimeEvent, setupPolling]);

  useEffect(() => {
    // Initial data fetch
    fetchHazardFeed();
    fetchHazardEvents();
    fetchUserReports();
    fetchAllReports();
    fetchNotifications();
    fetchIncoisBulletins();
    
    // Setup real-time connections only once
    setupRealTimeUpdates();
    
    // Cleanup on unmount
    return () => {
      console.log('🧾 Cleaning up connections on unmount');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const handleReportSubmitted = (reportData) => {
    // Always add the new report to userReports so user can see it immediately
    if (reportData.lat && reportData.lon) {
      const newReport = {
        id: reportData.id,
        lat: reportData.lat,
        lon: reportData.lon,
        user_name: reportData.user_name || "You",
        text: reportData.description || "New report",
        timestamp: new Date().toISOString(),
        ts: new Date().toISOString(),
        status: reportData.status || "processing",
        confidence: null, // No confidence until ML processing
        nlp_conf: null,
        nlp_type: null,
        credibility: null,
        media_path: reportData.media_files && reportData.media_files.length > 0 ? reportData.media_files[0] : null,
        isUserSubmission: true, // Always true for newly submitted reports
        isUserReport: true, // Mark as user's report
        user_session_id: reportData.user_session_id
      };
      
      // Store in session storage for persistence
      const userReportIds = JSON.parse(sessionStorage.getItem('userReportIds') || '[]');
      if (!userReportIds.includes(reportData.id)) {
        userReportIds.push(reportData.id);
        sessionStorage.setItem('userReportIds', JSON.stringify(userReportIds));
      }
      
      // Add to beginning of array so it's prioritized
      setUserReports(prev => [newReport, ...prev.slice(0, 14)]); // Keep total under 15
      
      // FIXED: Also add to allReports immediately so it's visible in the reports list
      setAllReports(prev => [newReport, ...prev.slice(0, 14)]); // Keep total under 15
    }
    
    // Refresh hazard events to check for new clusters
    fetchHazardEvents();
    fetchHazardFeed();
    
    // Refresh data after ML processing to get updated confidence scores
    setTimeout(() => {
      console.log('Refreshing data after ML processing...');
      fetchHazardEvents();
      fetchAllReports();
      fetchHazardFeed();
    }, 5000);
    
    toast.success('Report submitted successfully! 🌊 Your report is now visible in the list.');
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'low': return '#28a745';
      case 'moderate': return '#ffc107';
      case 'high': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'low': return '🟢';
      case 'moderate': return '🟡';
      case 'high': return '🔴';
      default: return '⚪';
    }
  };

  const renderHome = () => (
    <div className="citizen-home">
      <div className="welcome-section">
        <div className="welcome-header">
          <h2>Welcome to OceanGuard!</h2>
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? 'Real-time' : 'Polling mode'}
          </div>
        </div>
        <p>Stay informed about coastal hazards in your area</p>
      </div>

      <div className="quick-stats">
        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div>
            <h3>{reports.length}</h3>
            <p>Your Reports</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🔔</span>
          <div>
            <h3>{Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0}</h3>
            <p>New Alerts</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⚠️</span>
          <div>
            <h3>{Array.isArray(hazardFeed) ? hazardFeed.filter(h => h.severity === 'high').length : 0}</h3>
            <p>Critical Hazards</p>
          </div>
        </div>
      </div>

      <div className="hazard-feed">
        <h3>Real-Time Hazard Updates</h3>
        <div className="feed-filters">
          <button className="filter-btn active">All</button>
          <button className="filter-btn">High Waves</button>
          <button className="filter-btn">Floods</button>
          <button className="filter-btn">Cyclones</button>
          <button className="filter-btn">Tsunami</button>
        </div>
        
        <div className="feed-items">
          {hazardFeed.map((hazard, index) => (
            <div key={index} className="feed-item">
              <div className="hazard-header">
                <span className="severity-indicator" style={{color: getSeverityColor(hazard.severity)}}>
                  {getSeverityIcon(hazard.severity)}
                </span>
                <div className="hazard-info">
                  <h4>{hazard.type}</h4>
                  <p className="hazard-location">{hazard.location}</p>
                </div>
                <span className="hazard-time">{hazard.timestamp}</span>
              </div>
              <p className="hazard-description">{hazard.description}</p>
              <div className="hazard-source">
                <span className="source-tag">{hazard.source}</span>
                <span className="confidence">Confidence: {hazard.confidence}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMap = () => (
    <div className="citizen-map">
      <div className="map-controls">
        <h3>Your Reports + Hazard Map</h3>
        <div className="map-info">
          <p>Your submissions always visible + unique hazards (duplicates filtered)</p>
        </div>
        <div className="map-filters">
          <label>
            <input type="checkbox" defaultChecked /> Hazard Clusters (Max 30)
          </label>
          <label>
            <input type="checkbox" defaultChecked /> Your Reports (Always shown)
          </label>
          <label>
            <input type="checkbox" defaultChecked /> INCOIS Data
          </label>
        </div>
        <select className="time-filter">
          <option>Last 24 hours</option>
          <option>Last 7 days</option>
          <option>Last month</option>
        </select>
      </div>
      <div className="map-wrapper">
        <HazardMap 
          hazardEvents={hazardEvents} 
          userReports={userReports}
        />
      </div>
    </div>
  );

  const renderReportForm = () => (
    <div className="report-form">
      <h3>Report a Hazard</h3>
      <ReportForm 
        onReportSubmitted={handleReportSubmitted}
      />
    </div>
  );

  const renderBulletins = () => (
    <div className="bulletins-section">
      <div className="bulletins-header">
        <h3>🌊 INCOIS Oceanographic Bulletins</h3>
        <p>Official bulletins from Indian National Centre for Ocean Information Services</p>
      </div>
      
      <div className="bulletins-list">
        {incoisBulletins.length === 0 ? (
          <div className="no-bulletins">
            <p>Loading INCOIS bulletins...</p>
          </div>
        ) : (
          incoisBulletins.map((bulletin) => (
            <div key={bulletin.id} className="bulletin-card">
              <div className="bulletin-header">
                <div className="bulletin-type">
                  <span className={`hazard-type ${bulletin.hazard_type}`}>
                    {bulletin.hazard_type.toUpperCase()}
                  </span>
                  <span className={`severity-level severity-${bulletin.severity}`}>
                    Severity: {bulletin.severity}/5
                  </span>
                </div>
                <div className="bulletin-date">
                                  <p>
                  {formatTimestamp(bulletin.issued_at)}
                </p>
                </div>
              </div>
              <div className="bulletin-content">
                <p>{bulletin.description}</p>
              </div>
              <div className="bulletin-footer">
                <span className="bulletin-source">INCOIS Official Bulletin #{bulletin.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="citizen-dashboard">
      <nav className="citizen-nav">
        <div className="nav-brand">
          <span className="logo-icon">🌊</span>
          <span>OceanGuard</span>
        </div>
        
        <div className="nav-menu">
          <button 
            className={activeView === 'home' ? 'active' : ''} 
            onClick={() => setActiveView('home')}
          >
            🏠 Home
          </button>
          <button 
            className={activeView === 'map' ? 'active' : ''} 
            onClick={() => setActiveView('map')}
          >
            🗺️ Map
          </button>
          <button 
            className={activeView === 'report' ? 'active' : ''} 
            onClick={() => setActiveView('report')}
          >
            📝 Report
          </button>
          <button 
            className={activeView === 'bulletins' ? 'active' : ''} 
            onClick={() => setActiveView('bulletins')}
          >
            📢 INCOIS Bulletins
          </button>
          <button 
            className={activeView === 'volunteer' ? 'active' : ''} 
            onClick={() => setActiveView('volunteer')}
          >
            🤝 Volunteer
          </button>
        </div>

        <div className="nav-user">
          <div className="user-info">
            <span>Citizen Portal</span>
          </div>
          <a href="/admin" className="admin-link">Admin Portal</a>
        </div>
      </nav>

      <main className="citizen-main">
        {activeView === 'home' && renderHome()}
        {activeView === 'map' && renderMap()}
        {activeView === 'report' && renderReportForm()}
        {activeView === 'bulletins' && renderBulletins()}
        {activeView === 'volunteer' && (
          <div className="volunteer-section">
            <h3>Volunteer Dashboard</h3>
            <p>Volunteer features will be implemented here</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default CitizenDashboard;