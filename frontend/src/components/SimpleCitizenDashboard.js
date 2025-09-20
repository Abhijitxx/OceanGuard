import React, { useState } from 'react';
import './CitizenDashboard.css';

const SimpleCitizenDashboard = () => {
  const [activeView, setActiveView] = useState('home');

  return (
    <div className="citizen-dashboard">
      <nav className="citizen-nav">
        <div className="nav-brand">
          <span className="logo-icon">🌊</span>
          OceanGuard
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
        </div>

        <div className="nav-user">
          <div className="user-info">
            <span>Citizen Portal</span>
          </div>
        </div>
      </nav>

      <main className="citizen-main">
        {activeView === 'home' && (
          <div style={{ padding: '20px' }}>
            <h2>Welcome to OceanGuard</h2>
            <p>This is a simplified dashboard that should render properly.</p>
            <div style={{ background: 'white', padding: '20px', margin: '20px 0', borderRadius: '8px' }}>
              <h3>Test Content</h3>
              <p>If you can see this, the basic dashboard structure works!</p>
            </div>
          </div>
        )}
        
        {activeView === 'map' && (
          <div style={{ padding: '20px' }}>
            <h2>Map View</h2>
            <p>Map component would go here</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default SimpleCitizenDashboard;