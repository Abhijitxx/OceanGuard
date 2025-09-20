import React, { useState, useEffect, useCallback } from 'react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'citizen',
    phone: '',
    location: ''
  });

  // Filter users based on search and filter criteria
  const filterUsers = useCallback(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line
    filterUsers();
  }, [filterUsers]);

  const fetchUsers = async () => {
    try {
      // Mock users data - in real app, fetch from API
      const mockUsers = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john.doe@email.com',
          role: 'official',
          status: 'active',
          phone: '+91-9876543210',
          location: 'Mumbai, Maharashtra',
          joinedAt: '2024-01-15',
          lastActive: new Date(Date.now() - 2 * 3600000).toISOString(),
          reportsSubmitted: 45,
          validationAccuracy: 0.92
        },
        {
          id: 2,
          name: 'Sarah Wilson',
          email: 'sarah.wilson@email.com',
          role: 'citizen',
          status: 'active',
          phone: '+91-9876543211',
          location: 'Chennai, Tamil Nadu',
          joinedAt: '2024-02-20',
          lastActive: new Date(Date.now() - 30 * 60000).toISOString(),
          reportsSubmitted: 23,
          validationAccuracy: 0.87
        },
        {
          id: 3,
          name: 'Dr. Raj Patel',
          email: 'raj.patel@incois.gov.in',
          role: 'admin',
          status: 'active',
          phone: '+91-9876543212',
          location: 'Hyderabad, Telangana',
          joinedAt: '2023-12-01',
          lastActive: new Date(Date.now() - 10 * 60000).toISOString(),
          reportsSubmitted: 156,
          validationAccuracy: 0.98
        },
        {
          id: 4,
          name: 'Maya Singh',
          email: 'maya.singh@email.com',
          role: 'citizen',
          status: 'inactive',
          phone: '+91-9876543213',
          location: 'Kochi, Kerala',
          joinedAt: '2024-01-30',
          lastActive: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
          reportsSubmitted: 8,
          validationAccuracy: 0.75
        },
        {
          id: 5,
          name: 'Alex Johnson',
          email: 'alex.johnson@email.com',
          role: 'citizen',
          status: 'suspended',
          phone: '+91-9876543214',
          location: 'Visakhapatnam, AP',
          joinedAt: '2024-03-10',
          lastActive: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
          reportsSubmitted: 12,
          validationAccuracy: 0.58
        }
      ];
      setUsers(mockUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.name || !newUser.email) {
        alert('Name and email are required');
        return;
      }

      const user = {
        id: Date.now(),
        ...newUser,
        status: 'active',
        joinedAt: new Date().toISOString().split('T')[0],
        lastActive: new Date().toISOString(),
        reportsSubmitted: 0,
        validationAccuracy: 0
      };

      setUsers([...users, user]);
      setNewUser({
        name: '',
        email: '',
        role: 'citizen',
        phone: '',
        location: ''
      });
      setIsCreatingUser(false);
    } catch (error) {
      console.error('Error creating user:', error);
    }
  };

  const handleUpdateUserStatus = async (userId, newStatus) => {
    try {
      setUsers(currentUsers =>
        currentUsers.map(user =>
          user.id === userId
            ? { ...user, status: newStatus }
            : user
        )
      );
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      setUsers(currentUsers =>
        currentUsers.map(user =>
          user.id === userId
            ? { ...user, role: newRole }
            : user
        )
      );
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: '#e74c3c',
      official: '#3498db',
      citizen: '#27ae60'
    };
    return colors[role] || '#95a5a6';
  };

  const getStatusColor = (status) => {
    const colors = {
      active: '#27ae60',
      inactive: '#f39c12',
      suspended: '#e74c3c'
    };
    return colors[status] || '#95a5a6';
  };

  const getRoleIcon = (role) => {
    const icons = {
      admin: 'fas fa-crown',
      official: 'fas fa-shield-alt',
      citizen: 'fas fa-user'
    };
    return icons[role] || 'fas fa-user';
  };

  const formatTimeAgo = (dateString) => {
    const now = new Date();
    const eventTime = new Date(dateString);
    const diffMs = now - eventTime;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 0.9) return '#27ae60';
    if (accuracy >= 0.8) return '#f39c12';
    if (accuracy >= 0.7) return '#e67e22';
    return '#e74c3c';
  };

  return (
    <div className="user-management">
      <div className="user-header">
        <div className="header-left">
          <h2>
            <i className="fas fa-users"></i>
            User Management
          </h2>
          <p>Manage users, roles, and permissions for the coastal monitoring system</p>
        </div>
        <button 
          onClick={() => setIsCreatingUser(true)}
          className="create-user-btn"
        >
          <i className="fas fa-user-plus"></i>
          Add New User
        </button>
      </div>

      {/* Filters and Search */}
      <div className="user-controls">
        <div className="search-bar">
          <i className="fas fa-search"></i>
          <input
            type="text"
            placeholder="Search users by name, email, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filters">
          <select 
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="official">Official</option>
            <option value="citizen">Citizen</option>
          </select>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* User Statistics */}
      <div className="user-stats">
        <div className="stat-item">
          <span className="stat-number">{users.length}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{users.filter(u => u.status === 'active').length}</span>
          <span className="stat-label">Active Users</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{users.filter(u => u.role === 'admin').length}</span>
          <span className="stat-label">Admins</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{users.filter(u => u.role === 'official').length}</span>
          <span className="stat-label">Officials</span>
        </div>
        <div className="stat-item">
          <span className="stat-number">{users.filter(u => u.role === 'citizen').length}</span>
          <span className="stat-label">Citizens</span>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreatingUser && (
        <div className="modal-overlay">
          <div className="create-user-modal">
            <div className="modal-header">
              <h3>Add New User</h3>
              <button 
                onClick={() => setIsCreatingUser(false)}
                className="close-btn"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Enter full name..."
                  />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Enter email address..."
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="citizen">Citizen</option>
                    <option value="official">Official</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="Enter phone number..."
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={newUser.location}
                  onChange={(e) => setNewUser({ ...newUser, location: e.target.value })}
                  placeholder="Enter location..."
                />
              </div>

              <div className="modal-actions">
                <button 
                  onClick={() => setIsCreatingUser(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateUser}
                  className="create-btn"
                >
                  <i className="fas fa-user-plus"></i>
                  Create User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="users-list">
        {filteredUsers.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-users"></i>
            <h3>No Users Found</h3>
            <p>No users match your current search and filters.</p>
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className={`user-card ${user.status}`}>
              <div className="user-avatar">
                <div className="avatar-circle" style={{ background: getRoleColor(user.role) }}>
                  <i className={getRoleIcon(user.role)}></i>
                </div>
                <div className="status-indicator" style={{ background: getStatusColor(user.status) }}></div>
              </div>

              <div className="user-info">
                <div className="user-header">
                  <h3 className="user-name">{user.name}</h3>
                  <div className="user-badges">
                    <span 
                      className="role-badge" 
                      style={{ background: getRoleColor(user.role) }}
                    >
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                    <span 
                      className="status-badge" 
                      style={{ color: getStatusColor(user.status) }}
                    >
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="user-details">
                  <div className="detail-item">
                    <i className="fas fa-envelope"></i>
                    <span>{user.email}</span>
                  </div>
                  <div className="detail-item">
                    <i className="fas fa-phone"></i>
                    <span>{user.phone}</span>
                  </div>
                  <div className="detail-item">
                    <i className="fas fa-map-marker-alt"></i>
                    <span>{user.location}</span>
                  </div>
                  <div className="detail-item">
                    <i className="fas fa-calendar"></i>
                    <span>Joined {user.joinedAt}</span>
                  </div>
                </div>

                <div className="user-metrics">
                  <div className="metric">
                    <span className="metric-value">{user.reportsSubmitted}</span>
                    <span className="metric-label">Reports</span>
                  </div>
                  <div className="metric">
                    <span 
                      className="metric-value" 
                      style={{ color: getAccuracyColor(user.validationAccuracy) }}
                    >
                      {(user.validationAccuracy * 100).toFixed(0)}%
                    </span>
                    <span className="metric-label">Accuracy</span>
                  </div>
                  <div className="metric">
                    <span className="metric-value">{formatTimeAgo(user.lastActive)}</span>
                    <span className="metric-label">Last Active</span>
                  </div>
                </div>
              </div>

              <div className="user-actions">
                <button className="action-btn edit">
                  <i className="fas fa-edit"></i>
                  Edit
                </button>
                
                {user.status === 'active' && (
                  <button 
                    onClick={() => handleUpdateUserStatus(user.id, 'suspended')}
                    className="action-btn suspend"
                  >
                    <i className="fas fa-ban"></i>
                    Suspend
                  </button>
                )}
                
                {user.status === 'suspended' && (
                  <button 
                    onClick={() => handleUpdateUserStatus(user.id, 'active')}
                    className="action-btn activate"
                  >
                    <i className="fas fa-check"></i>
                    Activate
                  </button>
                )}

                {user.role !== 'admin' && (
                  <div className="role-selector">
                    <select 
                      value={user.role}
                      onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                      className="role-select"
                    >
                      <option value="citizen">Citizen</option>
                      <option value="official">Official</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                )}

                <button className="action-btn details">
                  <i className="fas fa-chart-line"></i>
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .user-management {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .user-header {
          background: linear-gradient(135deg, #2c3e50, #34495e);
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

        .create-user-btn {
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

        .create-user-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .user-controls {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e1e8ed;
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-bar {
          flex: 1;
          position: relative;
          min-width: 300px;
        }

        .search-bar i {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #7f8c8d;
        }

        .search-bar input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.5rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 0.9rem;
        }

        .filters {
          display: flex;
          gap: 1rem;
        }

        .filters select {
          padding: 0.75rem 1rem;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: white;
          cursor: pointer;
        }

        .user-stats {
          display: flex;
          justify-content: space-around;
          padding: 1.5rem;
          background: #f8f9fa;
          border-bottom: 1px solid #e1e8ed;
        }

        .stat-item {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stat-number {
          font-size: 1.5rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .stat-label {
          font-size: 0.8rem;
          color: #7f8c8d;
          font-weight: 500;
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

        .create-user-modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          background: #2c3e50;
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

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 600;
          color: #2c3e50;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-family: inherit;
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
          background: #2c3e50;
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

        .users-list {
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

        .user-card {
          border: 1px solid #e1e8ed;
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          gap: 1.5rem;
          transition: all 0.3s ease;
        }

        .user-card:hover {
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          border-color: #3498db;
        }

        .user-card.suspended {
          opacity: 0.7;
          border-left: 4px solid #e74c3c;
        }

        .user-card.inactive {
          opacity: 0.8;
          border-left: 4px solid #f39c12;
        }

        .user-avatar {
          position: relative;
          flex-shrink: 0;
        }

        .avatar-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.5rem;
        }

        .status-indicator {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
        }

        .user-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .user-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .user-name {
          margin: 0;
          color: #2c3e50;
          font-size: 1.2rem;
        }

        .user-badges {
          display: flex;
          gap: 0.5rem;
        }

        .role-badge {
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .status-badge {
          font-size: 0.8rem;
          font-weight: 600;
        }

        .user-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 0.5rem;
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: #7f8c8d;
        }

        .detail-item i {
          width: 16px;
          text-align: center;
        }

        .user-metrics {
          display: flex;
          gap: 2rem;
        }

        .metric {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .metric-value {
          font-size: 1.2rem;
          font-weight: 700;
          color: #2c3e50;
        }

        .metric-label {
          font-size: 0.8rem;
          color: #7f8c8d;
          font-weight: 500;
        }

        .user-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .action-btn {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.3s ease;
          white-space: nowrap;
        }

        .action-btn.edit {
          background: #3498db;
          color: white;
        }

        .action-btn.suspend {
          background: #e74c3c;
          color: white;
        }

        .action-btn.activate {
          background: #27ae60;
          color: white;
        }

        .action-btn.details {
          background: #9b59b6;
          color: white;
        }

        .action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .role-selector {
          margin: 0.5rem 0;
        }

        .role-select {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
          font-size: 0.85rem;
        }

        @media (max-width: 768px) {
          .user-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .user-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .search-bar {
            min-width: auto;
          }

          .filters {
            justify-content: center;
          }

          .user-stats {
            flex-wrap: wrap;
            gap: 1rem;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .user-card {
            flex-direction: column;
            text-align: center;
          }

          .user-header {
            flex-direction: column;
            align-items: center;
          }

          .user-details {
            grid-template-columns: 1fr;
          }

          .user-metrics {
            justify-content: center;
          }

          .user-actions {
            flex-direction: row;
            justify-content: center;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};

export default UserManagement;