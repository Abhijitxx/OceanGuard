import React, { useState } from 'react';
import { toast } from 'react-toastify';

const VolunteerRegistration = ({ onRegistrationComplete }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    emergencyContact: '',
    skills: [],
    availability: {
      weekdays: false,
      weekends: false,
      evenings: false,
      emergencies: false
    },
    preferredRegions: [],
    experience: '',
    transportation: '',
    languages: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

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

  const languageOptions = [
    'English',
    'Hindi',
    'Tamil',
    'Telugu',
    'Malayalam',
    'Kannada',
    'Bengali',
    'Marathi',
    'Gujarati',
    'Urdu'
  ];

  const regionOptions = [
    'North Coast',
    'South Coast',
    'East Coast',
    'West Coast',
    'Central Region',
    'Urban Areas',
    'Rural Areas',
    'Island Communities'
  ];

  const transportationOptions = [
    'Own Vehicle',
    'Bicycle',
    'Public Transport',
    'Walking Only',
    'Boat Access'
  ];

  // Get current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
          toast.success('Location detected successfully');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Could not detect location. Please enter manually.');
        }
      );
    } else {
      toast.error('Geolocation not supported by this browser');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSkillToggle = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const handleLanguageToggle = (language) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter(l => l !== language)
        : [...prev.languages, language]
    }));
  };

  const handleRegionToggle = (region) => {
    setFormData(prev => ({
      ...prev,
      preferredRegions: prev.preferredRegions.includes(region)
        ? prev.preferredRegions.filter(r => r !== region)
        : [...prev.preferredRegions, region]
    }));
  };

  const handleAvailabilityChange = (type) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [type]: !prev.availability[type]
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.phone || !formData.address) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.skills.length === 0) {
      toast.error('Please select at least one skill');
      return;
    }

    if (!Object.values(formData.availability).some(Boolean)) {
      toast.error('Please select your availability');
      return;
    }

    setIsSubmitting(true);

    try {
      const registrationData = {
        ...formData,
        location: currentLocation,
        skills: formData.skills.join(', '),
        availability: JSON.stringify(formData.availability),
        preferredRegions: formData.preferredRegions.join(', '),
        languages: formData.languages.join(', '),
        registeredAt: new Date().toISOString()
      };

      const response = await fetch('/api/volunteer/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Volunteer registration successful!');
        
        // Store volunteer session
        sessionStorage.setItem('volunteerSession', result.volunteer_id);
        sessionStorage.setItem('volunteerData', JSON.stringify(result));
        
        if (onRegistrationComplete) {
          onRegistrationComplete(result);
        }
      } else {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error(`Registration failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="volunteer-registration">
      <div className="registration-header">
        <h2>🤝 Join Our Volunteer Network</h2>
        <p>Help your community by becoming a certified coastal safety volunteer</p>
      </div>

      <form onSubmit={handleSubmit} className="registration-form">
        {/* Personal Information */}
        <div className="form-section">
          <h3>Personal Information</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Enter your full name"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                placeholder="+91-XXXXXXXXXX"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your.email@example.com"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="emergencyContact">Emergency Contact</label>
              <input
                type="tel"
                id="emergencyContact"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleInputChange}
                placeholder="Emergency contact number"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address">Address *</label>
            <textarea
              id="address"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              required
              placeholder="Enter your complete address"
              rows="3"
            />
            <button 
              type="button" 
              onClick={getCurrentLocation}
              className="location-btn"
            >
              📍 Detect Current Location
            </button>
            {currentLocation && (
              <small className="location-info">
                ✅ Location detected: {currentLocation.lat.toFixed(4)}, {currentLocation.lon.toFixed(4)}
              </small>
            )}
          </div>
        </div>

        {/* Skills & Expertise */}
        <div className="form-section">
          <h3>Skills & Expertise *</h3>
          <p>Select all skills that apply to you:</p>
          
          <div className="skills-grid">
            {skillOptions.map(skill => (
              <label key={skill} className="skill-checkbox">
                <input
                  type="checkbox"
                  checked={formData.skills.includes(skill)}
                  onChange={() => handleSkillToggle(skill)}
                />
                <span className="checkmark"></span>
                {skill}
              </label>
            ))}
          </div>
        </div>

        {/* Availability */}
        <div className="form-section">
          <h3>Availability *</h3>
          <p>When are you available to volunteer?</p>
          
          <div className="availability-options">
            {Object.entries({
              weekdays: 'Weekdays (Mon-Fri)',
              weekends: 'Weekends (Sat-Sun)',
              evenings: 'Evenings (6 PM - 10 PM)',
              emergencies: 'Emergency Response (24/7)'
            }).map(([key, label]) => (
              <label key={key} className="availability-checkbox">
                <input
                  type="checkbox"
                  checked={formData.availability[key]}
                  onChange={() => handleAvailabilityChange(key)}
                />
                <span className="checkmark"></span>
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Preferred Regions */}
        <div className="form-section">
          <h3>Preferred Service Regions</h3>
          <p>Select regions where you prefer to volunteer:</p>
          
          <div className="regions-grid">
            {regionOptions.map(region => (
              <label key={region} className="region-checkbox">
                <input
                  type="checkbox"
                  checked={formData.preferredRegions.includes(region)}
                  onChange={() => handleRegionToggle(region)}
                />
                <span className="checkmark"></span>
                {region}
              </label>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="form-section">
          <h3>Languages Spoken</h3>
          <p>Select languages you can communicate in:</p>
          
          <div className="languages-grid">
            {languageOptions.map(language => (
              <label key={language} className="language-checkbox">
                <input
                  type="checkbox"
                  checked={formData.languages.includes(language)}
                  onChange={() => handleLanguageToggle(language)}
                />
                <span className="checkmark"></span>
                {language}
              </label>
            ))}
          </div>
        </div>

        {/* Additional Information */}
        <div className="form-section">
          <h3>Additional Information</h3>
          
          <div className="form-group">
            <label htmlFor="transportation">Transportation Method</label>
            <select
              id="transportation"
              name="transportation"
              value={formData.transportation}
              onChange={handleInputChange}
            >
              <option value="">Select transportation method</option>
              {transportationOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="experience">Relevant Experience</label>
            <textarea
              id="experience"
              name="experience"
              value={formData.experience}
              onChange={handleInputChange}
              placeholder="Describe any relevant volunteer experience, training, or certifications..."
              rows="4"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button 
            type="submit" 
            className="submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Registering...
              </>
            ) : (
              <>
                <i className="fas fa-user-plus"></i>
                Register as Volunteer
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        .volunteer-registration {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .registration-header {
          text-align: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #e9ecef;
        }

        .registration-header h2 {
          color: #2c3e50;
          margin-bottom: 0.5rem;
          font-size: 1.8rem;
        }

        .registration-header p {
          color: #6c757d;
          font-size: 1.1rem;
        }

        .form-section {
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 8px;
          border-left: 4px solid #3498db;
        }

        .form-section h3 {
          color: #2c3e50;
          margin-bottom: 1rem;
          font-size: 1.3rem;
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
          color: #495057;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #dee2e6;
          border-radius: 6px;
          font-size: 1rem;
          transition: border-color 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #3498db;
          box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        .skills-grid,
        .regions-grid,
        .languages-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .availability-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .skill-checkbox,
        .region-checkbox,
        .language-checkbox,
        .availability-checkbox {
          display: flex;
          align-items: center;
          padding: 0.75rem;
          background: white;
          border: 2px solid #dee2e6;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 0.9rem;
        }

        .skill-checkbox:hover,
        .region-checkbox:hover,
        .language-checkbox:hover,
        .availability-checkbox:hover {
          border-color: #3498db;
          background: #f8f9fa;
        }

        .skill-checkbox input,
        .region-checkbox input,
        .language-checkbox input,
        .availability-checkbox input {
          margin-right: 0.75rem;
          width: auto;
        }

        .location-btn {
          margin-top: 0.5rem;
          padding: 0.5rem 1rem;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background 0.3s ease;
        }

        .location-btn:hover {
          background: #218838;
        }

        .location-info {
          display: block;
          margin-top: 0.5rem;
          color: #28a745;
          font-weight: 500;
        }

        .form-actions {
          text-align: center;
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 2px solid #e9ecef;
        }

        .submit-btn {
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 6px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 200px;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(52, 152, 219, 0.3);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-btn i {
          margin-right: 0.5rem;
        }

        @media (max-width: 768px) {
          .volunteer-registration {
            padding: 1rem;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .skills-grid,
          .regions-grid,
          .languages-grid {
            grid-template-columns: 1fr;
          }

          .availability-options {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default VolunteerRegistration;