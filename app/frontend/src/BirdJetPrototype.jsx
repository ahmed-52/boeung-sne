import React, { useState } from 'react';
import { Upload, Mic, Camera, Database, BarChart3, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function BirdJet() {
  const [audioFile, setAudioFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [dragOver, setDragOver] = useState({ audio: false, image: false });
  const [analysisStatus, setAnalysisStatus] = useState('idle'); // idle, processing, success, error
  const [analysisResults, setAnalysisResults] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const API_BASE = 'http://127.0.0.1:8000';

  const handleAudioUpload = (files) => {
    const file = files[0]; // Only take the first file
    if (file) {
      setAudioFile(file);
      setAnalysisResults(null); // Clear previous results
      setErrorMessage('');
    }
  };

  const handleImageUpload = (files) => {
    const fileArray = Array.from(files);
    setImageFiles(prev => [...prev, ...fileArray]);
  };

  const handleDragOver = (e, type) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: true }));
  };

  const handleDragLeave = (e, type) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
    const files = e.dataTransfer.files;
    if (type === 'audio') {
      handleAudioUpload(files);
    } else {
      handleImageUpload(files);
    }
  };

  const removeAudioFile = () => {
    setAudioFile(null);
    setAnalysisResults(null);
    setErrorMessage('');
  };

  const removeImageFile = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeAudio = async () => {
    if (!audioFile) return;

    try {
      setAnalysisStatus('processing');
      setErrorMessage('');

      const formData = new FormData();
      formData.append('file', audioFile);

      const response = await fetch(`${API_BASE}/analyze?return_segments=true&top_k=3&overlap=0.5&min_conf=0.05`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Analysis failed' }));
        throw new Error(errorData.detail || `Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      setAnalysisResults(result);
      setAnalysisStatus('success');
    } catch (error) {
      console.error('Analysis error:', error);
      setErrorMessage(error.message);
      setAnalysisStatus('error');
      
      // Reset error status after 5 seconds
      setTimeout(() => {
        setAnalysisStatus('idle');
        setErrorMessage('');
      }, 5000);
    }
  };

  const formatSpeciesName = (label) => {
    // Extract species name from "Genus species_Common Name" format
    const parts = label.split('_');
    if (parts.length === 2) {
      return parts[1]; // Return common name
    }
    return label;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Full Width */}
      <header className="w-full bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Database className="w-8 h-8 text-gray-700" />
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 font-mono">BirdView</h1>
                <p className="text-sm text-gray-600 font-mono">Avian Population Monitoring Platform</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-gray-600 hover:text-gray-900 font-mono">Analysis</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 font-mono">Data</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 font-mono">Reports</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content - Constrained Width */}
      <main className="w-full">
        <div className="max-w-6xl mx-auto px-8 py-12">
          {/* Header Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-gray-900 mb-6 font-mono">
              Bird Monitoring Interface
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Upload acoustic recordings for BirdNET species identification and drone imagery for computer vision analysis.
            </p>
          </div>

          {/* Upload Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
            {/* Audio Upload */}
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="flex items-center space-x-4 mb-8">
                <Mic className="w-6 h-6 text-gray-700" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 font-mono">Audio Data</h3>
                  <p className="text-gray-600">Upload a single audio file for BirdNET classification</p>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                  dragOver.audio 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                } ${analysisStatus === 'processing' ? 'opacity-50 pointer-events-none' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'audio')}
                onDragLeave={(e) => handleDragLeave(e, 'audio')}
                onDrop={(e) => handleDrop(e, 'audio')}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-6" />
                <p className="text-gray-600 mb-3 font-mono">
                  Drop audio file here or{' '}
                  <label className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                    select file
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      disabled={analysisStatus === 'processing'}
                      onChange={(e) => handleAudioUpload(e.target.files)}
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-500 font-mono">
                  Supported: WAV, MP3, M4A, FLAC
                </p>
              </div>

              {audioFile && (
                <div className="mt-8">
                  <h4 className="font-medium text-gray-900 mb-4 font-mono">Selected File</h4>
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Mic className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate font-mono">{audioFile.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0 font-mono">
                          {(audioFile.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>
                      <button
                        onClick={removeAudioFile}
                        className="text-red-600 hover:text-red-700 text-sm ml-4 font-mono"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="flex items-center space-x-4 mb-8">
                <Camera className="w-6 h-6 text-gray-700" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 font-mono">Image Data</h3>
                  <p className="text-gray-600">Upload drone imagery for computer vision detection</p>
                </div>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                  dragOver.image 
                    ? 'border-blue-400 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={(e) => handleDragOver(e, 'image')}
                onDragLeave={(e) => handleDragLeave(e, 'image')}
                onDrop={(e) => handleDrop(e, 'image')}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-6" />
                <p className="text-gray-600 mb-3 font-mono">
                  Drop image files here or{' '}
                  <label className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                    select files
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files)}
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-500 font-mono">
                  Supported: JPG, PNG, TIFF
                </p>
              </div>

              {imageFiles.length > 0 && (
                <div className="mt-8">
                  <h4 className="font-medium text-gray-900 mb-4 font-mono">{imageFiles.length} image files</h4>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {imageFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-4 rounded">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Camera className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate font-mono">{file.name}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0 font-mono">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </div>
                        <button
                          onClick={() => removeImageFile(index)}
                          className="text-red-600 hover:text-red-700 text-sm ml-4 font-mono"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analyze Button */}
          {audioFile && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2 font-mono">Ready to Analyze</h3>
                  <p className="text-gray-600 font-mono">
                    Audio file ready for BirdNET species identification
                    {imageFiles.length > 0 && <span className="text-gray-400"> • {imageFiles.length} images attached (analysis coming soon)</span>}
                  </p>
                </div>
                <button 
                  onClick={analyzeAudio}
                  disabled={analysisStatus === 'processing'}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-8 py-4 rounded-lg font-medium font-mono transition-colors flex items-center space-x-2"
                >
                  {analysisStatus === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{analysisStatus === 'processing' ? 'Analyzing...' : 'Analyze Audio'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analysisResults && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
              <div className="flex items-center space-x-3 mb-6">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h3 className="text-lg font-medium text-gray-900 font-mono">Analysis Results</h3>
              </div>

              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm font-mono text-gray-600">File Analyzed</p>
                    <p className="text-lg font-semibold font-mono">{analysisResults.filename}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm font-mono text-gray-600">Species Found</p>
                    <p className="text-lg font-semibold font-mono">{analysisResults.top_k?.length || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm font-mono text-gray-600">Total Classes</p>
                    <p className="text-lg font-semibold font-mono">{analysisResults.num_classes}</p>
                  </div>
                </div>

                <h4 className="font-medium text-gray-900 mb-4 font-mono">Top 3 Species Detections</h4>
                <div className="space-y-4">
                  {analysisResults.top_k?.slice(0, 3).map((detection, idx) => {
                    const borderColor = idx === 0 ? 'border-green-300' : 'border-yellow-300';
                    const bgColor = idx === 0 ? 'bg-green-50' : 'bg-yellow-50';
                    const badgeColor = idx === 0 ? 'bg-green-500' : 'bg-yellow-500';
                    const accentColor = idx === 0 ? 'text-green-700' : 'text-yellow-700';
                    
                    return (
                    <div key={idx} className={`border-2 ${borderColor} ${bgColor} rounded-lg p-6`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className={`w-8 h-8 rounded-full ${badgeColor} flex items-center justify-center text-white font-bold font-mono text-sm`}>
                            {idx + 1}
                          </div>
                          <div>
                            <h5 className={`font-semibold text-xl ${accentColor} font-mono`}>
                              {formatSpeciesName(detection.label)}
                            </h5>
                            <p className="font-mono text-gray-600 text-sm">
                              {detection.label.split('_')[0]}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-mono font-bold ${accentColor}`}>
                            {(detection.score * 100).toFixed(2)}%
                          </p>
                          <p className="font-mono text-gray-600 text-sm">
                            {formatTime(detection.best_segment.start_sec)} - {formatTime(detection.best_segment.end_sec)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {analysisStatus === 'error' && errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-red-800 font-mono font-medium">Analysis Failed</p>
                  <p className="text-red-700 font-mono text-sm mt-1">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Analysis Pipeline Info */}
          <div className="mb-8">
            <h3 className="text-xl font-medium text-gray-900 mb-8 font-mono">Analysis Pipeline</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <Database className="w-10 h-10 text-blue-600 mb-6" />
                <h4 className="font-medium text-gray-900 mb-3 font-mono">Audio Processing</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Automated preprocessing and segmentation of audio data for BirdNET model input
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <BarChart3 className="w-10 h-10 text-green-600 mb-6" />
                <h4 className="font-medium text-gray-900 mb-3 font-mono">Species Classification</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  BirdNET deep learning model identifies species with confidence scores
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <FileText className="w-10 h-10 text-purple-600 mb-6" />
                <h4 className="font-medium text-gray-900 mb-3 font-mono">Results Analysis</h4>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Temporal segments and confidence metrics for each species detection
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}