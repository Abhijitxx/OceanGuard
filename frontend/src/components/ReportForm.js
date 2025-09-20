import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';

const ReportForm = ({ onReportSubmitted }) => {
  const [formData, setFormData] = useState({
    text: '',
    lat: '',
    lon: '',
    media_path: null,
    media_file: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const fileInputRef = useRef();

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle image file selection
  const handleImageSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      setFormData(prev => ({
        ...prev,
        media_path: file.name,
        media_file: file
      }));

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error('Please select a valid image file');
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleImageSelect(files[0]);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          lat: position.coords.latitude.toFixed(6),
          lon: position.coords.longitude.toFixed(6)
        }));
        setLocationLoading(false);
        toast.success('📍 Location captured successfully!');
      },
      (error) => {
        setLocationLoading(false);
        toast.error('Failed to get location: ' + error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  // Validate form
  const validateForm = () => {
    if (!formData.text.trim()) {
      toast.error('Please describe the hazard');
      return false;
    }

    if (!formData.lat || !formData.lon) {
      toast.error('Please provide location coordinates');
      return false;
    }

    const lat = parseFloat(formData.lat);
    const lon = parseFloat(formData.lon);

    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Please provide valid coordinates');
      return false;
    }

    // Check if coordinates are roughly in Chennai area
    if (lat < 12.0 || lat > 14.0 || lon < 79.0 || lon > 81.0) {
      toast.warning('Coordinates seem to be outside Chennai area. Please verify.');
    }

    return true;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Generate a unique session ID for this user if not exists
      let userSessionId = sessionStorage.getItem('oceanGuardUserSession');
      if (!userSessionId) {
        userSessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('oceanGuardUserSession', userSessionId);
      }

      // If a file is selected, upload it first to get a public URL
      let uploadedFileUrl = null;
      if (formData.media_file) {
        try {
          const fd = new FormData();
          fd.append('file', formData.media_file, formData.media_file.name);
          const uploadResp = await fetch('/api/upload-image', {
            method: 'POST',
            body: fd
          });
          if (uploadResp.ok) {
            const uploadJson = await uploadResp.json();
            uploadedFileUrl = uploadJson.file_url || null;
          } else {
            const err = await uploadResp.json().catch(() => ({}));
            console.error('Upload failed:', err);
            toast.error('Image upload failed; submitting report without image.');
          }
        } catch (uploadError) {
          console.error('Upload exception:', uploadError);
          toast.error('Image upload failed; submitting report without image.');
        }
      }

      const submitData = {
        description: formData.text.trim(),
        lat: parseFloat(formData.lat),
        lon: parseFloat(formData.lon),
        media_files: uploadedFileUrl ? [uploadedFileUrl] : [],
        location: `${formData.lat}, ${formData.lon}`,
        hazard_type: 'general', // Default type, could be made selectable
        severity: 'moderate', // Default severity, could be made selectable
        user_name: 'You', // Mark as user's own report
        user_session_id: userSessionId, // Add session tracking
        media_path: uploadedFileUrl
      };

      const response = await fetch('/api/citizen/submit-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        const result = await response.json();

        // Build object to send to parent that includes the submitted lat/lon and other form values
        const resultWithSession = {
          ...submitData,
          id: result.id,
          isUserSubmission: true,
          user_session_id: userSessionId
        };

        // Store this report ID as user's own submission
        const userReports = JSON.parse(sessionStorage.getItem('userReportIds') || '[]');
        if (!userReports.includes(result.id)) {
          userReports.push(result.id);
          sessionStorage.setItem('userReportIds', JSON.stringify(userReports));
        }

        // Clear form
        setFormData({
          text: '',
          lat: '',
          lon: '',
          media_path: null
        });
        setImagePreview(null);

        // Notify parent component with full report data (includes lat/lon)
        onReportSubmitted(resultWithSession);

        // 🚀 REAL-TIME UPDATE: Broadcast to admin dashboard
        // Send custom event to trigger admin dashboard refresh (use submitData for accurate coords)
        window.dispatchEvent(new CustomEvent('newReportSubmitted', {
          detail: {
            reportId: result.id,
            timestamp: new Date().toISOString(),
            location: `${submitData.lat}, ${submitData.lon}`,
            type: 'citizen_report'
          }
        }));
        
        // Also try direct API call to trigger admin refresh if possible
        try {
          fetch('/api/admin/notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'new_report',
              report_id: result.id,
              timestamp: new Date().toISOString()
            })
          }).catch(() => {}); // Silent fail if endpoint doesn't exist
        } catch (e) {}
        
        toast.success('🌊 Report submitted successfully! Our AI is analyzing it now...');
      } else {
        const error = await response.json();
        toast.error('Failed to submit report: ' + (error.detail || 'Unknown error'));
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick location presets for Chennai
  const locationPresets = [
    { name: 'Marina Beach', lat: 13.0478, lon: 80.2838 },
    { name: 'Ennore Port', lat: 13.2847, lon: 80.3242 },
    { name: 'Kovalam Beach', lat: 12.7904, lon: 80.2504 },
    { name: 'Pulicat Lake', lat: 13.4164, lon: 80.1714 },
    { name: 'Mahabalipuram', lat: 12.6208, lon: 80.1982 }
  ];

  const setPresetLocation = (preset) => {
    setFormData(prev => ({
      ...prev,
      lat: preset.lat.toString(),
      lon: preset.lon.toString()
    }));
    toast.info(`📍 Location set to ${preset.name}`);
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <h2>
          <i className="fas fa-exclamation-triangle"></i>
          Report Coastal Hazard
        </h2>
        <p className="form-description">
          Help protect our coastal community by reporting hazards you observe. 
          Your report will be analyzed by our AI system and integrated into the live hazard map.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="hazard-form">
        {/* Hazard Description */}
        <div className="form-section">
          <h3>
            <i className="fas fa-edit"></i>
            Describe the Hazard
          </h3>
          <div className="form-group">
            <label htmlFor="text">
              What did you observe? *
              <span className="help-text">
                Describe the hazard in detail (flooding, erosion, pollution, etc.)
              </span>
            </label>
            <textarea
              id="text"
              name="text"
              value={formData.text}
              onChange={handleInputChange}
              placeholder="e.g., Heavy flooding on Marina Beach Road. Water level is knee-deep and rising. Several cars are stuck..."
              rows="4"
              required
              disabled={isSubmitting}
            />
            <div className="char-count">
              {formData.text.length}/500 characters
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="form-section">
          <h3>
            <i className="fas fa-map-marker-alt"></i>
            Location
          </h3>
          
          <div className="location-controls">
            <button
              type="button"
              className="btn-location"
              onClick={getCurrentLocation}
              disabled={locationLoading || isSubmitting}
            >
              {locationLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Getting Location...
                </>
              ) : (
                <>
                  <i className="fas fa-crosshairs"></i>
                  Use Current Location
                </>
              )}
            </button>

            <div className="location-presets">
              <span className="preset-label">Quick locations:</span>
              {locationPresets.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  className="btn-preset"
                  onClick={() => setPresetLocation(preset)}
                  disabled={isSubmitting}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="coordinates-input">
            <div className="form-group">
              <label htmlFor="lat">Latitude *</label>
              <input
                type="number"
                id="lat"
                name="lat"
                value={formData.lat}
                onChange={handleInputChange}
                placeholder="13.0827"
                step="0.000001"
                min="12"
                max="14"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lon">Longitude *</label>
              <input
                type="number"
                id="lon"
                name="lon"
                value={formData.lon}
                onChange={handleInputChange}
                placeholder="80.2707"
                step="0.000001"
                min="79"
                max="81"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          {formData.lat && formData.lon && (
            <div className="location-preview">
              <i className="fas fa-info-circle"></i>
              Location: {parseFloat(formData.lat).toFixed(4)}°N, {parseFloat(formData.lon).toFixed(4)}°E
            </div>
          )}
        </div>

        {/* Image Upload */}
        <div className="form-section">
          <h3>
            <i className="fas fa-camera"></i>
            Evidence Photo (Optional)
          </h3>
          
          <div 
            className={`image-upload ${dragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <div className="image-info">
                  <p><strong>File:</strong> {formData.media_path}</p>
                  <button
                    type="button"
                    className="btn-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                      setFormData(prev => ({ ...prev, media_path: null }));
                    }}
                  >
                    <i className="fas fa-trash"></i>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="upload-prompt">
                <i className="fas fa-cloud-upload-alt"></i>
                <p><strong>Click to upload</strong> or drag and drop</p>
                <p className="file-types">JPG, PNG, GIF up to 10MB</p>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            disabled={isSubmitting}
          />
        </div>

        {/* Emergency Options */}
        <div className="form-section emergency-section">
          <h3>
            <i className="fas fa-exclamation-triangle"></i>
            Emergency Status
          </h3>
          <div className="emergency-info">
            <div className="info-box">
              <i className="fas fa-info-circle"></i>
              <div>
                <strong>Is this an emergency?</strong>
                <p>If this is a life-threatening situation, call emergency services immediately at <strong>108</strong>. 
                This system is for hazard monitoring and may not provide immediate emergency response.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-actions">
          <button 
            type="submit" 
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Submitting Report...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i>
                Submit Hazard Report
              </>
            )}
          </button>
          
          <div className="submit-info">
            <p>
              <i className="fas fa-shield-alt"></i>
              Your report will be processed through our AI system for automatic classification and credibility assessment.
            </p>
          </div>
        </div>
      </form>

      <style jsx>{`
        .form-container {
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
        }

        .form-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .form-header h2 {
          color: #2c3e50;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .form-description {
          color: #7f8c8d;
          line-height: 1.6;
        }

        .form-section {
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 12px;
          border-left: 4px solid #0077be;
        }

        .form-section h3 {
          color: #2c3e50;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
        }

        .help-text {
          display: block;
          font-size: 0.8rem;
          color: #7f8c8d;
          font-weight: normal;
          margin-top: 0.25rem;
        }

        .char-count {
          text-align: right;
          font-size: 0.8rem;
          color: #7f8c8d;
          margin-top: 0.25rem;
        }

        .location-controls {
          margin-bottom: 1rem;
        }

        .btn-location {
          background: #27ae60;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          transition: all 0.3s ease;
        }

        .btn-location:hover:not(:disabled) {
          background: #229954;
          transform: translateY(-1px);
        }

        .btn-location:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .location-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .preset-label {
          font-size: 0.9rem;
          color: #7f8c8d;
          margin-right: 0.5rem;
        }

        .btn-preset {
          background: #ecf0f1;
          color: #2c3e50;
          border: 1px solid #bdc3c7;
          padding: 0.4rem 0.8rem;
          border-radius: 15px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.3s ease;
        }

        .btn-preset:hover:not(:disabled) {
          background: #0077be;
          color: white;
          border-color: #0077be;
        }

        .coordinates-input {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .location-preview {
          background: #e8f5e8;
          color: #27ae60;
          padding: 0.75rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          font-family: monospace;
        }

        .image-upload {
          border: 2px dashed #0077be;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          min-height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-upload:hover {
          background: rgba(0, 119, 190, 0.05);
          border-color: #005a8b;
        }

        .image-upload.drag-over {
          background: rgba(0, 119, 190, 0.1);
          border-color: #005a8b;
          transform: scale(1.02);
        }

        .upload-prompt {
          text-align: center;
        }

        .upload-prompt i {
          font-size: 2rem;
          color: #0077be;
          margin-bottom: 1rem;
        }

        .upload-prompt p {
          margin: 0.5rem 0;
        }

        .file-types {
          font-size: 0.8rem;
          color: #7f8c8d;
        }

        .image-preview {
          display: flex;
          align-items: center;
          gap: 1rem;
          text-align: left;
        }

        .image-preview img {
          max-width: 120px;
          max-height: 120px;
          border-radius: 8px;
          object-fit: cover;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .image-info p {
          margin: 0.5rem 0;
          font-size: 0.9rem;
        }

        .btn-remove {
          background: #e74c3c;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
        }

        .btn-remove:hover {
          background: #c0392b;
        }

        .emergency-section {
          border-left-color: #e74c3c;
        }

        .info-box {
          background: #fdf2e9;
          border: 1px solid #f39c12;
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          gap: 1rem;
        }

        .info-box i {
          color: #f39c12;
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .info-box strong {
          color: #e67e22;
        }

        .form-actions {
          text-align: center;
          margin-top: 2rem;
        }

        .submit-info {
          margin-top: 1rem;
          color: #7f8c8d;
          font-size: 0.9rem;
        }

        .submit-info p {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        @media (max-width: 768px) {
          .form-container {
            padding: 1rem;
          }

          .coordinates-input {
            grid-template-columns: 1fr;
          }

          .location-presets {
            flex-direction: column;
            align-items: flex-start;
          }

          .image-preview {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default ReportForm;