import React, { useState } from 'react';

const UserAuth = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    emergencyContact: '',
    role: 'citizen'
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Simulate API call for user registration/login
      const userData = {
        ...formData,
        id: Date.now(), // Simple ID generation
        registeredAt: new Date().toISOString(),
        sessionId: `session_${Date.now()}`
      };
      
      // Store user data in localStorage for this demo
      localStorage.setItem('oceanGuardUser', JSON.stringify(userData));
      
      // Call the parent login handler
      onLogin(userData);
      
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ submit: 'Failed to register. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <i className="fas fa-shield-wave"></i>
            <h1>OceanGuard</h1>
          </div>
          <p className="tagline">Coastal Hazard Monitoring System</p>
          <p className="subtitle">Please provide your details to access the platform</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">
              <i className="fas fa-user"></i>
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter your full name"
              className={errors.name ? 'error' : ''}
            />
            {errors.name && <span className="error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              <i className="fas fa-phone"></i>
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Enter your phone number"
              className={errors.phone ? 'error' : ''}
            />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">
              <i className="fas fa-envelope"></i>
              Email Address (Optional)
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter your email address"
              className={errors.email ? 'error' : ''}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="address">
              <i className="fas fa-map-marker-alt"></i>
              Address *
            </label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              placeholder="Enter your complete address"
              rows="3"
              className={errors.address ? 'error' : ''}
            />
            {errors.address && <span className="error-text">{errors.address}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="emergencyContact">
              <i className="fas fa-phone-square-alt"></i>
              Emergency Contact (Optional)
            </label>
            <input
              type="tel"
              id="emergencyContact"
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleInputChange}
              placeholder="Emergency contact number"
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">
              <i className="fas fa-user-tag"></i>
              User Type
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              className="role-select"
            >
              <option value="citizen">Citizen Reporter</option>
              <option value="official">Government Official</option>
              <option value="researcher">Researcher</option>
              <option value="emergency">Emergency Responder</option>
            </select>
          </div>

          {errors.submit && (
            <div className="error-banner">
              <i className="fas fa-exclamation-triangle"></i>
              {errors.submit}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Registering...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i>
                Access OceanGuard
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <div className="security-note">
            <i className="fas fa-lock"></i>
            <small>Your information is secure and used only for emergency communication and report tracking.</small>
          </div>
          
          <div className="features-preview">
            <h4>Platform Features:</h4>
            <ul>
              <li><i className="fas fa-map"></i> Interactive hazard map</li>
              <li><i className="fas fa-camera"></i> Report hazards with photos</li>
              <li><i className="fas fa-bell"></i> Real-time alerts</li>
              <li><i className="fas fa-chart-line"></i> Analytics dashboard</li>
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .auth-card {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          max-width: 500px;
          width: 100%;
          overflow: hidden;
          animation: slideUp 0.6s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .auth-header {
          background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
          color: white;
          padding: 2rem;
          text-align: center;
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .logo i {
          font-size: 2.5rem;
          color: #74b9ff;
        }

        .logo h1 {
          margin: 0;
          font-size: 2.2rem;
          font-weight: 700;
        }

        .tagline {
          font-size: 1.1rem;
          margin: 0.5rem 0;
          opacity: 0.9;
        }

        .subtitle {
          font-size: 0.95rem;
          margin: 0;
          opacity: 0.8;
        }

        .auth-form {
          padding: 2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .form-group label i {
          color: #3498db;
          width: 16px;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 0.875rem;
          border: 2px solid #e1e8ed;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: #f8f9fa;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #3498db;
          background: white;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        .form-group input.error,
        .form-group textarea.error {
          border-color: #e74c3c;
          background: #fdf2f2;
        }

        .error-text {
          color: #e74c3c;
          font-size: 0.8rem;
          margin-top: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .error-text::before {
          content: "⚠️";
          font-size: 0.7rem;
        }

        .role-select {
          cursor: pointer;
        }

        .error-banner {
          background: #fdf2f2;
          border: 1px solid #e74c3c;
          color: #e74c3c;
          padding: 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .auth-submit-btn {
          width: 100%;
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(52, 152, 219, 0.3);
        }

        .auth-submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .auth-footer {
          background: #f8f9fa;
          padding: 1.5rem 2rem;
          border-top: 1px solid #e1e8ed;
        }

        .security-note {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          color: #7f8c8d;
        }

        .security-note i {
          color: #27ae60;
          margin-top: 0.1rem;
        }

        .features-preview h4 {
          color: #2c3e50;
          margin: 0 0 0.75rem 0;
          font-size: 1rem;
        }

        .features-preview ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .features-preview li {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #7f8c8d;
          font-size: 0.85rem;
        }

        .features-preview li i {
          color: #3498db;
          width: 14px;
        }

        @media (max-width: 768px) {
          .auth-container {
            padding: 1rem;
          }

          .auth-header {
            padding: 1.5rem;
          }

          .logo h1 {
            font-size: 1.8rem;
          }

          .auth-form {
            padding: 1.5rem;
          }

          .features-preview ul {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default UserAuth;