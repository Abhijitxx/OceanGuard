import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

const VolunteerDashboard = () => {
  const [volunteerData, setVolunteerData] = useState(null);
  const [activeTasks, setActiveTasks] = useState([]);
  const [taskHistory, setTaskHistory] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState('available');
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tasks');
  const eventSourceRef = useRef(null);

  useEffect(() => {
    // Load volunteer data from session
    const storedVolunteerData = sessionStorage.getItem('volunteerData');
    if (storedVolunteerData) {
      setVolunteerData(JSON.parse(storedVolunteerData));
    }

    // Fetch initial data
    fetchVolunteerTasks();
    fetchNotifications();
    setupRealTimeUpdates();
    setIsLoading(false);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const setupRealTimeUpdates = () => {
    try {
      const eventSource = new EventSource('http://localhost:8000/api/events');
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealTimeEvent(data);
        } catch (error) {
          console.error('Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.log('SSE connection error:', error);
      };
    } catch (error) {
      console.log('SSE not supported, using polling');
      setupPolling();
    }
  };

  const setupPolling = () => {
    const interval = setInterval(() => {
      fetchVolunteerTasks();
      fetchNotifications();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  };

  const handleRealTimeEvent = (eventData) => {
    switch (eventData.type) {
      case 'new_task_assigned':
        if (eventData.data.volunteer_id === volunteerData?.id) {
          toast.success(`🎯 New task assigned: ${eventData.data.task_title}`);
          fetchVolunteerTasks();
        }
        break;
      case 'task_updated':
        if (eventData.data.volunteer_id === volunteerData?.id) {
          toast.info(`📝 Task updated: ${eventData.data.task_title}`);
          fetchVolunteerTasks();
        }
        break;
      case 'emergency_alert':
        toast.error(`🚨 Emergency Alert: ${eventData.data.message}`);
        break;
      default:
        // Handle other event types
        break;
    }
  };

  const fetchVolunteerTasks = async () => {
    try {
      const volunteerId = volunteerData?.id || sessionStorage.getItem('volunteerSession');
      if (!volunteerId) return;

      const response = await fetch(`/api/volunteer/tasks?volunteer_id=${volunteerId}`);
      if (response.ok) {
        const tasks = await response.json();
        setActiveTasks(tasks.filter(task => ['assigned', 'accepted', 'in_progress'].includes(task.status)));
        setTaskHistory(tasks.filter(task => ['completed', 'cancelled'].includes(task.status)));
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const volunteerId = volunteerData?.id || sessionStorage.getItem('volunteerSession');
      if (!volunteerId) return;

      const response = await fetch(`/api/volunteer/notifications?volunteer_id=${volunteerId}`);
      if (response.ok) {
        const notifs = await response.json();
        setNotifications(notifs);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleTaskAction = async (taskId, action, notes = '') => {
    try {
      const response = await fetch(`/api/volunteer/tasks/${taskId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          notes,
          volunteer_id: volunteerData?.id || sessionStorage.getItem('volunteerSession')
        })
      });

      if (response.ok) {
        toast.success(`Task ${action} successfully`);
        fetchVolunteerTasks();
      } else {
        throw new Error('Action failed');
      }
    } catch (error) {
      console.error('Task action error:', error);
      toast.error(`Failed to ${action} task`);
    }
  };

  const updateAvailabilityStatus = async (status) => {
    try {
      const volunteerId = volunteerData?.id || sessionStorage.getItem('volunteerSession');
      const response = await fetch(`/api/volunteer/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          volunteer_id: volunteerId,
          status
        })
      });

      if (response.ok) {
        setAvailabilityStatus(status);
        toast.success(`Availability updated to ${status}`);
      }
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
    }
  };

  const getTaskIcon = (taskType) => {
    const icons = {
      'emergency_response': '🚨',
      'hazard_assessment': '🔍',
      'community_outreach': '📢',
      'data_collection': '📊',
      'rescue_support': '🛟',
      'evacuation_assist': '🏃‍♂️',
      'supply_distribution': '📦',
      'communication': '📡'
    };
    return icons[taskType] || '📋';
  };

  const getTaskPriority = (priority) => {
    const priorities = {
      'high': { color: '#e74c3c', icon: '🔴' },
      'medium': { color: '#f39c12', icon: '🟡' },
      'low': { color: '#27ae60', icon: '🟢' }
    };
    return priorities[priority] || priorities['medium'];
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const taskTime = new Date(dateString);
    const diffMs = now - taskTime;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="volunteer-loading">
        <i className="fas fa-hands-helping fa-spin"></i>
        <p>Loading volunteer dashboard...</p>
      </div>
    );
  }

  if (!volunteerData) {
    return (
      <div className="volunteer-not-registered">
        <div className="not-registered-content">
          <i className="fas fa-user-plus"></i>
          <h2>Not Registered as Volunteer</h2>
          <p>Please register as a volunteer to access the dashboard</p>
          <button onClick={() => window.location.href = '/volunteer/register'} className="register-btn">
            Register Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="volunteer-dashboard">
      {/* Header */}
      <header className="volunteer-header">
        <div className="header-content">
          <div className="volunteer-info">
            <div className="avatar">
              <i className="fas fa-user-circle"></i>
            </div>
            <div className="volunteer-details">
              <h1>Welcome, {volunteerData.name}!</h1>
              <p className="volunteer-role">Certified Volunteer</p>
              <div className="volunteer-stats">
                <span className="stat-item">
                  <i className="fas fa-tasks"></i>
                  {activeTasks.length} Active Tasks
                </span>
                <span className="stat-item">
                  <i className="fas fa-check-circle"></i>
                  {taskHistory.length} Completed
                </span>
              </div>
            </div>
          </div>

          <div className="availability-controls">
            <div className="availability-status">
              <label>Status:</label>
              <select 
                value={availabilityStatus} 
                onChange={(e) => updateAvailabilityStatus(e.target.value)}
                className={`status-select ${availabilityStatus}`}
              >
                <option value="available">🟢 Available</option>
                <option value="busy">🟡 Busy</option>
                <option value="offline">🔴 Offline</option>
                <option value="emergency_only">🚨 Emergency Only</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="volunteer-nav">
        <button
          className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <i className="fas fa-tasks"></i>
          Active Tasks
          {activeTasks.length > 0 && <span className="nav-badge">{activeTasks.length}</span>}
        </button>
        
        <button
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <i className="fas fa-history"></i>
          Task History
        </button>
        
        <button
          className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <i className="fas fa-bell"></i>
          Notifications
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="nav-badge">{notifications.filter(n => !n.read).length}</span>
          )}
        </button>
        
        <button
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <i className="fas fa-user"></i>
          Profile
        </button>
      </nav>

      {/* Main Content */}
      <main className="volunteer-content">
        {activeTab === 'tasks' && (
          <div className="tasks-section">
            <div className="section-header">
              <h2>
                <i className="fas fa-tasks"></i>
                Active Tasks ({activeTasks.length})
              </h2>
              <button onClick={fetchVolunteerTasks} className="refresh-btn">
                <i className="fas fa-sync-alt"></i>
                Refresh
              </button>
            </div>

            {activeTasks.length === 0 ? (
              <div className="no-tasks">
                <i className="fas fa-clipboard-check"></i>
                <h3>No Active Tasks</h3>
                <p>You're all caught up! New tasks will appear here when assigned.</p>
              </div>
            ) : (
              <div className="tasks-grid">
                {activeTasks.map(task => {
                  const priority = getTaskPriority(task.priority);
                  return (
                    <div key={task.id} className="task-card">
                      <div className="task-header">
                        <div className="task-icon">
                          {getTaskIcon(task.task_type)}
                        </div>
                        <div className="task-info">
                          <h3>{task.title}</h3>
                          <p className="task-location">
                            <i className="fas fa-map-marker-alt"></i>
                            {task.location || 'Location TBD'}
                          </p>
                        </div>
                        <div className="task-priority" style={{color: priority.color}}>
                          {priority.icon}
                        </div>
                      </div>

                      <div className="task-description">
                        <p>{task.description}</p>
                      </div>

                      <div className="task-details">
                        <div className="task-meta">
                          <span className="task-time">
                            <i className="fas fa-clock"></i>
                            {formatTimeAgo(task.created_at)}
                          </span>
                          <span className={`task-status ${task.status}`}>
                            {task.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        {task.hazard_info && (
                          <div className="hazard-context">
                            <strong>Related Hazard:</strong> {task.hazard_info.type} 
                            (Confidence: {(task.hazard_info.confidence * 100).toFixed(1)}%)
                          </div>
                        )}
                      </div>

                      <div className="task-actions">
                        {task.status === 'assigned' && (
                          <>
                            <button 
                              onClick={() => handleTaskAction(task.id, 'accept')}
                              className="action-btn accept"
                            >
                              <i className="fas fa-check"></i>
                              Accept
                            </button>
                            <button 
                              onClick={() => handleTaskAction(task.id, 'decline', 'Not available at this time')}
                              className="action-btn decline"
                            >
                              <i className="fas fa-times"></i>
                              Decline
                            </button>
                          </>
                        )}

                        {task.status === 'accepted' && (
                          <button 
                            onClick={() => handleTaskAction(task.id, 'start')}
                            className="action-btn start"
                          >
                            <i className="fas fa-play"></i>
                            Start Task
                          </button>
                        )}

                        {task.status === 'in_progress' && (
                          <button 
                            onClick={() => handleTaskAction(task.id, 'complete', 'Task completed successfully')}
                            className="action-btn complete"
                          >
                            <i className="fas fa-flag-checkered"></i>
                            Mark Complete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <div className="section-header">
              <h2>
                <i className="fas fa-history"></i>
                Task History ({taskHistory.length})
              </h2>
            </div>

            {taskHistory.length === 0 ? (
              <div className="no-history">
                <i className="fas fa-history"></i>
                <h3>No Task History</h3>
                <p>Your completed tasks will appear here.</p>
              </div>
            ) : (
              <div className="history-list">
                {taskHistory.map(task => (
                  <div key={task.id} className="history-item">
                    <div className="history-icon">
                      {getTaskIcon(task.task_type)}
                    </div>
                    <div className="history-details">
                      <h4>{task.title}</h4>
                      <p>{task.description}</p>
                      <div className="history-meta">
                        <span className="history-date">
                          <i className="fas fa-calendar"></i>
                          {formatTimeAgo(task.completed_at || task.updated_at)}
                        </span>
                        <span className={`history-status ${task.status}`}>
                          {task.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="notifications-section">
            <div className="section-header">
              <h2>
                <i className="fas fa-bell"></i>
                Notifications ({notifications.length})
              </h2>
            </div>

            {notifications.length === 0 ? (
              <div className="no-notifications">
                <i className="fas fa-bell-slash"></i>
                <h3>No Notifications</h3>
                <p>You're all up to date!</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map(notification => (
                  <div key={notification.id} className={`notification-item ${notification.read ? 'read' : 'unread'}`}>
                    <div className="notification-icon">
                      <i className={notification.icon || 'fas fa-info-circle'}></i>
                    </div>
                    <div className="notification-content">
                      <h4>{notification.title}</h4>
                      <p>{notification.message}</p>
                      <span className="notification-time">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && volunteerData && (
          <div className="profile-section">
            <div className="section-header">
              <h2>
                <i className="fas fa-user"></i>
                Volunteer Profile
              </h2>
            </div>

            <div className="profile-content">
              <div className="profile-info">
                <div className="info-group">
                  <h3>Personal Information</h3>
                  <div className="info-item">
                    <label>Name:</label>
                    <span>{volunteerData.name}</span>
                  </div>
                  <div className="info-item">
                    <label>Phone:</label>
                    <span>{volunteerData.phone}</span>
                  </div>
                  <div className="info-item">
                    <label>Email:</label>
                    <span>{volunteerData.email || 'Not provided'}</span>
                  </div>
                  <div className="info-item">
                    <label>Address:</label>
                    <span>{volunteerData.address}</span>
                  </div>
                </div>

                <div className="info-group">
                  <h3>Skills & Expertise</h3>
                  <div className="skills-display">
                    {volunteerData.skills?.split(', ').map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                  </div>
                </div>

                <div className="info-group">
                  <h3>Availability</h3>
                  <div className="availability-display">
                    {JSON.parse(volunteerData.availability || '{}') && 
                      Object.entries(JSON.parse(volunteerData.availability || '{}')).map(([key, value]) => (
                        value && <span key={key} className="availability-tag">
                          {key.replace('_', ' ').charAt(0).toUpperCase() + key.replace('_', ' ').slice(1)}
                        </span>
                      ))
                    }
                  </div>
                </div>

                {volunteerData.languages && (
                  <div className="info-group">
                    <h3>Languages</h3>
                    <div className="languages-display">
                      {volunteerData.languages.split(', ').map(language => (
                        <span key={language} className="language-tag">{language}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .volunteer-dashboard {
          min-height: 100vh;
          background: #f8f9fa;
        }

        .volunteer-header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 2rem 0;
        }

        .header-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .volunteer-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .avatar {
          font-size: 4rem;
          color: rgba(255, 255, 255, 0.9);
        }

        .volunteer-details h1 {
          margin: 0;
          font-size: 1.8rem;
        }

        .volunteer-role {
          margin: 0.25rem 0;
          opacity: 0.9;
          font-size: 1rem;
        }

        .volunteer-stats {
          display: flex;
          gap: 2rem;
          margin-top: 0.5rem;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .availability-controls {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1rem;
        }

        .availability-status label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }

        .status-select {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .status-select.available {
          background: #28a745;
          color: white;
        }

        .status-select.busy {
          background: #ffc107;
          color: #212529;
        }

        .status-select.offline {
          background: #dc3545;
          color: white;
        }

        .status-select.emergency_only {
          background: #fd7e14;
          color: white;
        }

        .volunteer-nav {
          background: white;
          padding: 0;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          display: flex;
          max-width: 1200px;
          margin: 0 auto;
        }

        .nav-item {
          background: none;
          border: none;
          padding: 1rem 2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1rem;
          font-weight: 500;
          color: #6c757d;
          border-bottom: 3px solid transparent;
          transition: all 0.3s ease;
          position: relative;
        }

        .nav-item.active {
          color: #28a745;
          border-bottom-color: #28a745;
          background: #f8f9fa;
        }

        .nav-item:hover {
          background: #f8f9fa;
          color: #28a745;
        }

        .nav-badge {
          background: #dc3545;
          color: white;
          border-radius: 50%;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          margin-left: 0.5rem;
        }

        .volunteer-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .section-header h2 {
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
        }

        .refresh-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .refresh-btn:hover {
          background: #5a6268;
        }

        .tasks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
        }

        .task-card {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          border-left: 4px solid #28a745;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .task-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .task-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .task-icon {
          font-size: 2rem;
          margin-top: 0.25rem;
        }

        .task-info {
          flex: 1;
        }

        .task-info h3 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
          font-size: 1.2rem;
        }

        .task-location {
          margin: 0;
          color: #6c757d;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .task-priority {
          font-size: 1.5rem;
        }

        .task-description {
          margin-bottom: 1rem;
          color: #495057;
          line-height: 1.5;
        }

        .task-details {
          margin-bottom: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e9ecef;
        }

        .task-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .task-time {
          color: #6c757d;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .task-status {
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .task-status.assigned {
          background: #fff3cd;
          color: #856404;
        }

        .task-status.accepted {
          background: #d1ecf1;
          color: #0c5460;
        }

        .task-status.in_progress {
          background: #d4edda;
          color: #155724;
        }

        .hazard-context {
          background: #f8f9fa;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.9rem;
          color: #495057;
        }

        .task-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .action-btn {
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
          flex: 1;
          justify-content: center;
          min-width: 100px;
        }

        .action-btn.accept {
          background: #28a745;
          color: white;
        }

        .action-btn.accept:hover {
          background: #218838;
        }

        .action-btn.decline {
          background: #dc3545;
          color: white;
        }

        .action-btn.decline:hover {
          background: #c82333;
        }

        .action-btn.start {
          background: #007bff;
          color: white;
        }

        .action-btn.start:hover {
          background: #0056b3;
        }

        .action-btn.complete {
          background: #28a745;
          color: white;
        }

        .action-btn.complete:hover {
          background: #218838;
        }

        .no-tasks,
        .no-history,
        .no-notifications {
          text-align: center;
          padding: 3rem;
          color: #6c757d;
        }

        .no-tasks i,
        .no-history i,
        .no-notifications i {
          font-size: 4rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .no-tasks h3,
        .no-history h3,
        .no-notifications h3 {
          margin-bottom: 0.5rem;
          color: #495057;
        }

        .history-list {
          space-y: 1rem;
        }

        .history-item {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .history-icon {
          font-size: 2rem;
          opacity: 0.7;
        }

        .history-details {
          flex: 1;
        }

        .history-details h4 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
        }

        .history-details p {
          margin: 0 0 0.75rem 0;
          color: #6c757d;
        }

        .history-meta {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .history-date {
          color: #6c757d;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .history-status.completed {
          background: #d4edda;
          color: #155724;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .history-status.cancelled {
          background: #f8d7da;
          color: #721c24;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .notifications-list {
          space-y: 1rem;
        }

        .notification-item {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          border-left: 4px solid #dee2e6;
        }

        .notification-item.unread {
          border-left-color: #007bff;
          background: #f8f9fe;
        }

        .notification-icon {
          font-size: 1.5rem;
          color: #6c757d;
        }

        .notification-content {
          flex: 1;
        }

        .notification-content h4 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
        }

        .notification-content p {
          margin: 0 0 0.75rem 0;
          color: #6c757d;
        }

        .notification-time {
          color: #6c757d;
          font-size: 0.9rem;
        }

        .profile-content {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .info-group {
          margin-bottom: 2rem;
        }

        .info-group h3 {
          color: #2c3e50;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid #e9ecef;
        }

        .info-item {
          display: flex;
          padding: 0.75rem 0;
          border-bottom: 1px solid #f8f9fa;
        }

        .info-item label {
          font-weight: 600;
          color: #495057;
          min-width: 120px;
        }

        .info-item span {
          color: #6c757d;
        }

        .skills-display,
        .availability-display,
        .languages-display {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .skill-tag,
        .availability-tag,
        .language-tag {
          background: #e9ecef;
          color: #495057;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .skill-tag {
          background: #d4edda;
          color: #155724;
        }

        .availability-tag {
          background: #d1ecf1;
          color: #0c5460;
        }

        .language-tag {
          background: #fff3cd;
          color: #856404;
        }

        .volunteer-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          color: #6c757d;
        }

        .volunteer-loading i {
          font-size: 3rem;
          margin-bottom: 1rem;
          color: #28a745;
        }

        .volunteer-not-registered {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
        }

        .not-registered-content {
          text-align: center;
          padding: 3rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .not-registered-content i {
          font-size: 4rem;
          color: #6c757d;
          margin-bottom: 1rem;
        }

        .register-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 6px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 1rem;
        }

        .register-btn:hover {
          background: #218838;
        }

        @media (max-width: 768px) {
          .header-content {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .volunteer-nav {
            flex-direction: column;
          }

          .tasks-grid {
            grid-template-columns: 1fr;
          }

          .task-actions {
            flex-direction: column;
          }

          .action-btn {
            flex: none;
          }
        }
      `}</style>
    </div>
  );
};

export default VolunteerDashboard;