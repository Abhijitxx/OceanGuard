import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

const AdminVolunteerManagement = ({ onRefresh }) => {
  const [volunteers, setVolunteers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('volunteers');
  const [selectedVolunteers, setSelectedVolunteers] = useState(new Set());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    task_type: '',
    priority: 'medium',
    location: '',
    estimated_duration: '',
    required_skills: [],
    max_volunteers: 1
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const taskTypes = [
    'emergency_response',
    'hazard_assessment', 
    'community_outreach',
    'data_collection',
    'rescue_support',
    'evacuation_assist',
    'supply_distribution',
    'communication'
  ];

  const skillOptions = [
    'First Aid/Medical',
    'Search & Rescue',
    'Swimming/Water Safety',
    'Emergency Communication',
    'Crowd Management',
    'Supply Distribution',
    'Technical Support',
    'Translation Services',
    'Community Outreach',
    'Data Collection'
  ];

  useEffect(() => {
    fetchVolunteers();
    fetchTasks();
  }, []);

  const fetchVolunteers = async () => {
    try {
      const response = await fetch('/api/admin/volunteers');
      if (response.ok) {
        const data = await response.json();
        setVolunteers(data);
      } else {
        // Fallback to mock data if API fails
        const mockVolunteers = [
          {
            id: 1,
            name: 'Arjun Kumar',
            phone: '+91-9876543210',
            email: 'arjun@example.com',
            skills: 'First Aid/Medical, Search & Rescue',
            availability: '{"weekdays": true, "emergencies": true}',
            status: 'available',
            location: 'Mumbai, Maharashtra',
            tasks_completed: 15,
            rating: 4.8,
            last_active: '2025-09-19T10:30:00Z'
          },
          {
            id: 2,
            name: 'Priya Sharma',
            phone: '+91-9876543211',
            email: 'priya@example.com',
            skills: 'Community Outreach, Translation Services',
            availability: '{"weekends": true, "evenings": true}',
            status: 'busy',
            location: 'Chennai, Tamil Nadu',
            tasks_completed: 22,
            rating: 4.9,
            last_active: '2025-09-19T09:15:00Z'
          },
          {
            id: 3,
            name: 'Rajesh Patel',
            phone: '+91-9876543212',
            email: 'rajesh@example.com',
            skills: 'Swimming/Water Safety, Rescue Support',
            availability: '{"emergencies": true, "weekdays": true}',
            status: 'available',
            location: 'Kochi, Kerala',
            tasks_completed: 8,
            rating: 4.6,
            last_active: '2025-09-19T11:45:00Z'
          }
        ];
        setVolunteers(mockVolunteers);
      }
    } catch (error) {
      console.error('Error fetching volunteers:', error);
      setVolunteers([]);
    }
    setIsLoading(false);
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/admin/volunteer-tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        // Fallback to mock data
        const mockTasks = [
          {
            id: 1,
            title: 'Emergency Beach Evacuation',
            description: 'Assist with evacuating beachgoers due to high wave alert',
            task_type: 'evacuation_assist',
            priority: 'high',
            status: 'assigned',
            assigned_volunteers: ['Arjun Kumar'],
            created_at: '2025-09-19T08:00:00Z',
            location: 'Marina Beach, Chennai'
          },
          {
            id: 2,
            title: 'Flood Assessment Survey',
            description: 'Conduct door-to-door survey in flood-affected areas',
            task_type: 'data_collection',
            priority: 'medium',
            status: 'in_progress',
            assigned_volunteers: ['Priya Sharma', 'Rajesh Patel'],
            created_at: '2025-09-19T06:30:00Z',
            location: 'Kochi Backwaters'
          }
        ];
        setTasks(mockTasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    }
  };

  const handleVolunteerSelect = (volunteerId) => {
    const newSelected = new Set(selectedVolunteers);
    if (newSelected.has(volunteerId)) {
      newSelected.delete(volunteerId);
    } else {
      newSelected.add(volunteerId);
    }
    setSelectedVolunteers(newSelected);
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.description || !newTask.task_type) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const taskData = {
        ...newTask,
        created_at: new Date().toISOString(),
        status: 'pending_assignment',
        required_skills: newTask.required_skills.join(', ')
      };

      const response = await fetch('/api/admin/volunteer-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData)
      });

      if (response.ok) {
        const createdTask = await response.json();
        setTasks(prev => [createdTask, ...prev]);
        setShowTaskModal(false);
        setNewTask({
          title: '',
          description: '',
          task_type: '',
          priority: 'medium',
          location: '',
          estimated_duration: '',
          required_skills: [],
          max_volunteers: 1
        });
        toast.success('Task created successfully');
      } else {
        throw new Error('Failed to create task');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    }
  };

  const handleAssignTask = async (taskId, volunteerIds) => {
    try {
      const response = await fetch(`/api/admin/volunteer-tasks/${taskId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          volunteer_ids: Array.isArray(volunteerIds) ? volunteerIds : [volunteerIds]
        })
      });

      if (response.ok) {
        toast.success('Task assigned successfully');
        fetchTasks();
        fetchVolunteers();
        setSelectedVolunteers(new Set());
      } else {
        throw new Error('Failed to assign task');
      }
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error('Failed to assign task');
    }
  };

  const handleSkillToggle = (skill) => {
    setNewTask(prev => ({
      ...prev,
      required_skills: prev.required_skills.includes(skill)
        ? prev.required_skills.filter(s => s !== skill)
        : [...prev.required_skills, skill]
    }));
  };

  const getStatusColor = (status) => {
    const colors = {
      'available': '#28a745',
      'busy': '#ffc107', 
      'offline': '#6c757d',
      'emergency_only': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  const getTaskPriorityColor = (priority) => {
    const colors = {
      'high': '#dc3545',
      'medium': '#ffc107',
      'low': '#28a745'
    };
    return colors[priority] || '#ffc107';
  };

  const getTaskStatusColor = (status) => {
    const colors = {
      'pending_assignment': '#6c757d',
      'assigned': '#17a2b8',
      'in_progress': '#ffc107',
      'completed': '#28a745',
      'cancelled': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const time = new Date(dateString);
    const diffMs = now - time;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const filteredVolunteers = volunteers.filter(volunteer => {
    const matchesSearch = volunteer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         volunteer.skills.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         volunteer.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || volunteer.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="loading-container">
        <i className="fas fa-users fa-spin"></i>
        <p>Loading volunteer management...</p>
      </div>
    );
  }

  return (
    <div className="volunteer-management">
      <div className="management-header">
        <div className="header-left">
          <h2>
            <i className="fas fa-users-cog"></i>
            Volunteer Management
          </h2>
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-number">{volunteers.length}</span>
              <span className="stat-label">Total Volunteers</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{volunteers.filter(v => v.status === 'available').length}</span>
              <span className="stat-label">Available</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length}</span>
              <span className="stat-label">Active Tasks</span>
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowTaskModal(true)}
            className="create-task-btn"
          >
            <i className="fas fa-plus"></i>
            Create Task
          </button>
          <button onClick={() => { fetchVolunteers(); fetchTasks(); }} className="refresh-btn">
            <i className="fas fa-sync-alt"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="management-nav">
        <button
          className={`nav-tab ${activeTab === 'volunteers' ? 'active' : ''}`}
          onClick={() => setActiveTab('volunteers')}
        >
          <i className="fas fa-users"></i>
          Volunteers ({volunteers.length})
        </button>
        <button
          className={`nav-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <i className="fas fa-tasks"></i>
          Tasks ({tasks.length})
        </button>
        <button
          className={`nav-tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          <i className="fas fa-user-check"></i>
          Assignment Center
        </button>
      </div>

      {/* Volunteers Tab */}
      {activeTab === 'volunteers' && (
        <div className="volunteers-section">
          <div className="section-controls">
            <div className="search-filters">
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  placeholder="Search volunteers by name, skills, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="status-filter"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
                <option value="emergency_only">Emergency Only</option>
              </select>
            </div>

            {selectedVolunteers.size > 0 && (
              <div className="bulk-actions">
                <span className="selected-count">
                  {selectedVolunteers.size} volunteer(s) selected
                </span>
                <button className="bulk-btn">
                  <i className="fas fa-envelope"></i>
                  Send Message
                </button>
                <button className="bulk-btn">
                  <i className="fas fa-tasks"></i>
                  Assign Task
                </button>
              </div>
            )}
          </div>

          <div className="volunteers-grid">
            {filteredVolunteers.map(volunteer => (
              <div key={volunteer.id} className="volunteer-card">
                <div className="volunteer-header">
                  <div className="volunteer-select">
                    <input
                      type="checkbox"
                      checked={selectedVolunteers.has(volunteer.id)}
                      onChange={() => handleVolunteerSelect(volunteer.id)}
                    />
                  </div>
                  <div className="volunteer-avatar">
                    <i className="fas fa-user-circle"></i>
                  </div>
                  <div className="volunteer-info">
                    <h3>{volunteer.name}</h3>
                    <p className="volunteer-location">
                      <i className="fas fa-map-marker-alt"></i>
                      {volunteer.location}
                    </p>
                  </div>
                  <div 
                    className="volunteer-status"
                    style={{ color: getStatusColor(volunteer.status) }}
                  >
                    ●
                  </div>
                </div>

                <div className="volunteer-details">
                  <div className="contact-info">
                    <div className="contact-item">
                      <i className="fas fa-phone"></i>
                      <span>{volunteer.phone}</span>
                    </div>
                    <div className="contact-item">
                      <i className="fas fa-envelope"></i>
                      <span>{volunteer.email}</span>
                    </div>
                  </div>

                  <div className="skills-display">
                    <strong>Skills:</strong>
                    <div className="skills-tags">
                      {volunteer.skills.split(', ').map(skill => (
                        <span key={skill} className="skill-tag">{skill}</span>
                      ))}
                    </div>
                  </div>

                  <div className="volunteer-stats">
                    <div className="stat-item">
                      <span className="stat-value">{volunteer.tasks_completed || 0}</span>
                      <span className="stat-label">Tasks Completed</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{volunteer.rating || 'N/A'}</span>
                      <span className="stat-label">Rating</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">{formatTimeAgo(volunteer.last_active)}</span>
                      <span className="stat-label">Last Active</span>
                    </div>
                  </div>
                </div>

                <div className="volunteer-actions">
                  <button className="action-btn message">
                    <i className="fas fa-comment"></i>
                    Message
                  </button>
                  <button className="action-btn assign">
                    <i className="fas fa-tasks"></i>
                    Assign Task
                  </button>
                  <button className="action-btn profile">
                    <i className="fas fa-user"></i>
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredVolunteers.length === 0 && (
            <div className="no-volunteers">
              <i className="fas fa-users"></i>
              <h3>No Volunteers Found</h3>
              <p>No volunteers match your current search criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="tasks-section">
          <div className="tasks-list">
            {tasks.map(task => (
              <div key={task.id} className="task-item">
                <div className="task-header">
                  <div className="task-info">
                    <h3>{task.title}</h3>
                    <p className="task-description">{task.description}</p>
                  </div>
                  <div className="task-meta">
                    <span 
                      className="task-priority"
                      style={{ backgroundColor: getTaskPriorityColor(task.priority) }}
                    >
                      {task.priority.toUpperCase()}
                    </span>
                    <span 
                      className="task-status"
                      style={{ backgroundColor: getTaskStatusColor(task.status) }}
                    >
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="task-details">
                  <div className="task-location">
                    <i className="fas fa-map-marker-alt"></i>
                    {task.location || 'Location TBD'}
                  </div>
                  <div className="task-time">
                    <i className="fas fa-clock"></i>
                    Created {formatTimeAgo(task.created_at)}
                  </div>
                  {task.assigned_volunteers && task.assigned_volunteers.length > 0 && (
                    <div className="assigned-volunteers">
                      <i className="fas fa-users"></i>
                      Assigned: {task.assigned_volunteers.join(', ')}
                    </div>
                  )}
                </div>

                <div className="task-actions">
                  <button className="action-btn edit">
                    <i className="fas fa-edit"></i>
                    Edit
                  </button>
                  <button className="action-btn assign">
                    <i className="fas fa-user-plus"></i>
                    Assign Volunteers
                  </button>
                  <button className="action-btn cancel">
                    <i className="fas fa-times"></i>
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>

          {tasks.length === 0 && (
            <div className="no-tasks">
              <i className="fas fa-tasks"></i>
              <h3>No Tasks Created</h3>
              <p>Create your first volunteer task to get started.</p>
              <button 
                onClick={() => setShowTaskModal(true)}
                className="create-first-task-btn"
              >
                <i className="fas fa-plus"></i>
                Create First Task
              </button>
            </div>
          )}
        </div>
      )}

      {/* Assignment Center Tab */}
      {activeTab === 'assignments' && (
        <div className="assignments-section">
          <div className="assignment-content">
            <h3>Smart Volunteer Assignment</h3>
            <p>Match volunteers with tasks based on skills, availability, and location.</p>
            
            <div className="assignment-interface">
              <div className="pending-tasks">
                <h4>Pending Tasks</h4>
                {tasks.filter(t => t.status === 'pending_assignment').map(task => (
                  <div key={task.id} className="pending-task-item">
                    <div className="task-summary">
                      <h5>{task.title}</h5>
                      <p>{task.description}</p>
                      <div className="task-requirements">
                        <span>Skills: {task.required_skills || 'Any'}</span>
                        <span>Priority: {task.priority}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAssignTask(task.id, Array.from(selectedVolunteers))}
                      className="auto-assign-btn"
                      disabled={selectedVolunteers.size === 0}
                    >
                      Assign Selected Volunteers
                    </button>
                  </div>
                ))}
                
                {tasks.filter(t => t.status === 'pending_assignment').length === 0 && (
                  <p className="no-pending">No pending assignments</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Volunteer Task</h3>
              <button 
                onClick={() => setShowTaskModal(false)}
                className="modal-close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Task Title *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title"
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the task in detail"
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Task Type *</label>
                  <select
                    value={newTask.task_type}
                    onChange={(e) => setNewTask(prev => ({ ...prev, task_type: e.target.value }))}
                  >
                    <option value="">Select task type</option>
                    {taskTypes.map(type => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={newTask.location}
                  onChange={(e) => setNewTask(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Task location"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estimated Duration</label>
                  <input
                    type="text"
                    value={newTask.estimated_duration}
                    onChange={(e) => setNewTask(prev => ({ ...prev, estimated_duration: e.target.value }))}
                    placeholder="e.g., 2 hours"
                  />
                </div>

                <div className="form-group">
                  <label>Max Volunteers</label>
                  <input
                    type="number"
                    value={newTask.max_volunteers}
                    onChange={(e) => setNewTask(prev => ({ ...prev, max_volunteers: parseInt(e.target.value) || 1 }))}
                    min="1"
                    max="50"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Required Skills</label>
                <div className="skills-selection">
                  {skillOptions.map(skill => (
                    <label key={skill} className="skill-checkbox">
                      <input
                        type="checkbox"
                        checked={newTask.required_skills.includes(skill)}
                        onChange={() => handleSkillToggle(skill)}
                      />
                      {skill}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                onClick={() => setShowTaskModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateTask}
                className="create-btn"
              >
                <i className="fas fa-plus"></i>
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .volunteer-management {
          padding: 0;
          background: #f8f9fa;
          min-height: 100vh;
        }

        .management-header {
          background: white;
          padding: 2rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header-left h2 {
          margin: 0 0 1rem 0;
          color: #2c3e50;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .stats-row {
          display: flex;
          gap: 2rem;
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
          font-size: 0.9rem;
          color: #6c757d;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
        }

        .create-task-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
        }

        .create-task-btn:hover {
          background: #218838;
        }

        .refresh-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .refresh-btn:hover {
          background: #5a6268;
        }

        .management-nav {
          background: white;
          display: flex;
          border-bottom: 1px solid #e9ecef;
        }

        .nav-tab {
          background: none;
          border: none;
          padding: 1rem 2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #6c757d;
          font-weight: 500;
          border-bottom: 3px solid transparent;
        }

        .nav-tab.active {
          color: #3498db;
          border-bottom-color: #3498db;
          background: #f8f9fa;
        }

        .nav-tab:hover {
          background: #f8f9fa;
        }

        .volunteers-section,
        .tasks-section,
        .assignments-section {
          padding: 2rem;
        }

        .section-controls {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .search-filters {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .search-box {
          position: relative;
          flex: 1;
        }

        .search-box i {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #6c757d;
        }

        .search-box input {
          width: 100%;
          padding: 0.75rem 0.75rem 0.75rem 2.5rem;
          border: 2px solid #e9ecef;
          border-radius: 6px;
          font-size: 1rem;
        }

        .search-box input:focus {
          outline: none;
          border-color: #3498db;
        }

        .status-filter {
          padding: 0.75rem;
          border: 2px solid #e9ecef;
          border-radius: 6px;
          background: white;
          cursor: pointer;
        }

        .bulk-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding-top: 1rem;
          border-top: 1px solid #e9ecef;
        }

        .selected-count {
          color: #6c757d;
          font-weight: 500;
        }

        .bulk-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .bulk-btn:hover {
          background: #2980b9;
        }

        .volunteers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: 1.5rem;
        }

        .volunteer-card {
          background: white;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .volunteer-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .volunteer-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .volunteer-select input {
          width: 1.2rem;
          height: 1.2rem;
        }

        .volunteer-avatar {
          font-size: 2.5rem;
          color: #6c757d;
        }

        .volunteer-info {
          flex: 1;
        }

        .volunteer-info h3 {
          margin: 0 0 0.25rem 0;
          color: #2c3e50;
        }

        .volunteer-location {
          margin: 0;
          color: #6c757d;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .volunteer-status {
          font-size: 1.5rem;
        }

        .volunteer-details {
          margin-bottom: 1rem;
        }

        .contact-info {
          margin-bottom: 1rem;
        }

        .contact-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
          font-size: 0.9rem;
          color: #6c757d;
        }

        .skills-display {
          margin-bottom: 1rem;
        }

        .skills-display strong {
          display: block;
          margin-bottom: 0.5rem;
          color: #495057;
        }

        .skills-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
        }

        .skill-tag {
          background: #e9ecef;
          color: #495057;
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.8rem;
        }

        .volunteer-stats {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .volunteer-stats .stat-item {
          text-align: center;
        }

        .volunteer-stats .stat-value {
          display: block;
          font-weight: 600;
          color: #2c3e50;
        }

        .volunteer-stats .stat-label {
          font-size: 0.8rem;
          color: #6c757d;
        }

        .volunteer-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn {
          flex: 1;
          border: none;
          padding: 0.5rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
        }

        .action-btn.message {
          background: #17a2b8;
          color: white;
        }

        .action-btn.assign {
          background: #28a745;
          color: white;
        }

        .action-btn.profile {
          background: #6c757d;
          color: white;
        }

        .action-btn:hover {
          opacity: 0.9;
        }

        .tasks-list {
          space-y: 1rem;
        }

        .task-item {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          margin-bottom: 1rem;
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .task-info {
          flex: 1;
        }

        .task-info h3 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
        }

        .task-description {
          margin: 0;
          color: #6c757d;
        }

        .task-meta {
          display: flex;
          gap: 0.5rem;
        }

        .task-priority,
        .task-status {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          color: white;
        }

        .task-details {
          display: flex;
          gap: 2rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .task-location,
        .task-time,
        .assigned-volunteers {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #6c757d;
          font-size: 0.9rem;
        }

        .task-actions {
          display: flex;
          gap: 0.75rem;
        }

        .task-actions .action-btn {
          flex: none;
          padding: 0.5rem 1rem;
        }

        .action-btn.edit {
          background: #ffc107;
          color: #212529;
        }

        .action-btn.cancel {
          background: #dc3545;
          color: white;
        }

        .assignments-section {
          background: white;
          border-radius: 8px;
          margin: 2rem;
          padding: 2rem;
        }

        .assignment-content h3 {
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }

        .assignment-interface {
          margin-top: 2rem;
        }

        .pending-tasks h4 {
          color: #495057;
          margin-bottom: 1rem;
        }

        .pending-task-item {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .task-summary h5 {
          margin: 0 0 0.5rem 0;
          color: #2c3e50;
        }

        .task-summary p {
          margin: 0 0 0.5rem 0;
          color: #6c757d;
          font-size: 0.9rem;
        }

        .task-requirements {
          display: flex;
          gap: 1rem;
          font-size: 0.8rem;
          color: #6c757d;
        }

        .auto-assign-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .auto-assign-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .no-pending {
          color: #6c757d;
          font-style: italic;
        }

        .no-volunteers,
        .no-tasks {
          text-align: center;
          padding: 3rem;
          color: #6c757d;
        }

        .no-volunteers i,
        .no-tasks i {
          font-size: 4rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .create-first-task-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          margin-top: 1rem;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e9ecef;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h3 {
          margin: 0;
          color: #2c3e50;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6c757d;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #495057;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #e9ecef;
          border-radius: 6px;
          font-size: 1rem;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #3498db;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .skills-selection {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .skill-checkbox {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
          cursor: pointer;
        }

        .skill-checkbox:hover {
          background: #e9ecef;
        }

        .modal-footer {
          padding: 1.5rem;
          border-top: 1px solid #e9ecef;
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
        }

        .cancel-btn {
          background: #6c757d;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
        }

        .create-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 50vh;
          color: #6c757d;
        }

        .loading-container i {
          font-size: 3rem;
          margin-bottom: 1rem;
          color: #3498db;
        }

        @media (max-width: 768px) {
          .management-header {
            flex-direction: column;
            gap: 1rem;
          }

          .volunteers-grid {
            grid-template-columns: 1fr;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .task-details {
            flex-direction: column;
            gap: 0.5rem;
          }

          .task-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminVolunteerManagement;