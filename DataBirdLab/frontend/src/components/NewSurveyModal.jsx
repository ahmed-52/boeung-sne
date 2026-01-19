import React, { useState, useEffect } from 'react';
import { Upload, X, Loader2, FileAudio, Image, Trash2, MapPin, Plus } from 'lucide-react';

const NewSurveyModal = ({ isOpen, onClose, onUploadComplete }) => {
    const [orthomosaicFiles, setOrthomosaicFiles] = useState([]);
    const [audioFiles, setAudioFiles] = useState([]);
    const [audioAruMap, setAudioAruMap] = useState({}); // Maps audio file index to ARU ID
    const [availableArus, setAvailableArus] = useState([]);
    const [name, setName] = useState('');
    const [surveyType, setSurveyType] = useState('drone'); // 'drone' or 'acoustic'
    const [surveyDate, setSurveyDate] = useState(''); // YYYY-MM-DD format
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    // New ARU form
    const [showNewAruForm, setShowNewAruForm] = useState(false);
    const [newAruName, setNewAruName] = useState('');
    const [newAruLat, setNewAruLat] = useState('');
    const [newAruLon, setNewAruLon] = useState('');

    // Fetch ARUs when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchArus();
        }
    }, [isOpen]);

    const fetchArus = async () => {
        try {
            const res = await fetch('/api/arus');
            if (res.ok) {
                const arus = await res.json();
                setAvailableArus(arus);
            }
        } catch (err) {
            console.error('Failed to fetch ARUs:', err);
        }
    };

    const handleCreateAru = async () => {
        if (!newAruName || !newAruLat || !newAruLon) {
            setError('Please fill in all ARU fields');
            return;
        }

        const formData = new FormData();
        formData.append('name', newAruName);
        formData.append('lat', parseFloat(newAruLat));
        formData.append('lon', parseFloat(newAruLon));

        try {
            const res = await fetch('/api/arus', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const newAru = await res.json();
                setAvailableArus([...availableArus, newAru]);
                setShowNewAruForm(false);
                setNewAruName('');
                setNewAruLat('');
                setNewAruLon('');
                setError('');
            }
        } catch (err) {
            setError('Failed to create ARU');
        }
    };

    if (!isOpen) return null;

    const handleOrthomosaicChange = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(f =>
            f.name.toLowerCase().endsWith('.tif') || f.name.toLowerCase().endsWith('.tiff')
        );
        setOrthomosaicFiles([...orthomosaicFiles, ...validFiles]);
    };

    const handleAudioChange = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(f =>
            f.name.toLowerCase().endsWith('.wav') ||
            f.name.toLowerCase().endsWith('.mp3') ||
            f.name.toLowerCase().endsWith('.flac')
        );
        const startIndex = audioFiles.length;
        setAudioFiles([...audioFiles, ...validFiles]);

        // Auto-select first ARU if available
        if (availableArus.length > 0) {
            const newMap = { ...audioAruMap };
            validFiles.forEach((_, idx) => {
                newMap[startIndex + idx] = availableArus[0].id;
            });
            setAudioAruMap(newMap);
        }
    };

    const removeOrthomosaic = (index) => {
        setOrthomosaicFiles(orthomosaicFiles.filter((_, i) => i !== index));
    };

    const removeAudio = (index) => {
        setAudioFiles(audioFiles.filter((_, i) => i !== index));
        const newMap = { ...audioAruMap };
        delete newMap[index];
        setAudioAruMap(newMap);
    };

    const setAruForAudio = (audioIndex, aruId) => {
        setAudioAruMap({ ...audioAruMap, [audioIndex]: parseInt(aruId) });
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name) {
            setError("Please provide a survey name.");
            return;
        }

        if (orthomosaicFiles.length === 0 && audioFiles.length === 0) {
            setError("Please upload at least one file.");
            return;
        }

        // Check all audio files have ARUs selected
        for (let i = 0; i < audioFiles.length; i++) {
            if (!audioAruMap[i]) {
                setError(`Please select an ARU for ${audioFiles[i].name}`);
                return;
            }
        }

        setIsUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('survey_name', name);
        formData.append('survey_type', surveyType);
        if (surveyDate) {
            formData.append('survey_date', surveyDate);
        }

        // Append all orthomosaic files
        orthomosaicFiles.forEach(file => {
            formData.append('orthomosaics', file);
        });

        // Append all audio files
        audioFiles.forEach(file => {
            formData.append('audio_files', file);
        });

        // Send ARU mapping as JSON
        formData.append('audio_aru_mapping', JSON.stringify(audioAruMap));

        try {
            const res = await fetch('/api/surveys/import', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || "Upload failed");
            }

            const data = await res.json();
            onUploadComplete(data);

            // Reset form
            setName('');
            setOrthomosaicFiles([]);
            setAudioFiles([]);
            setAudioAruMap({});
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to upload survey. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 m-4 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-slate-800 mb-1">New Survey Import</h2>
                <p className="text-slate-500 text-sm mb-6">Upload orthomosaics and audio files for analysis.</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Survey Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Survey Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Boeung Sne - Zone 2"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all text-slate-800"
                        />
                    </div>

                    {/* Survey Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Survey Type</label>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setSurveyType('drone')}
                                className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${surveyType === 'drone' ? 'bg-teal-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                            >
                                <Image size={16} />
                                Drone Survey
                            </button>
                            <button
                                type="button"
                                onClick={() => setSurveyType('acoustic')}
                                className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${surveyType === 'acoustic' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                            >
                                <FileAudio size={16} />
                                Acoustic Survey
                            </button>
                        </div>
                    </div>

                    {/* Survey Date - Only show for drone surveys */}
                    {surveyType === 'drone' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Survey Date</label>
                            <input
                                type="date"
                                value={surveyDate}
                                onChange={(e) => setSurveyDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all text-slate-800"
                            />
                            <p className="text-xs text-slate-400 mt-1">Leave blank to use today's date</p>
                        </div>
                    )}

                    {/* Acoustic Date Note */}
                    {surveyType === 'acoustic' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                            📅 <strong>Date will be extracted automatically</strong> from audio filenames (e.g., YYYYMMDD format)
                        </div>
                    )}

                    {/* Conditional File Upload Sections */}
                    {surveyType === 'drone' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <Image size={16} className="text-teal-600" />
                                Orthomosaic Files (.tif, .tiff)
                            </label>
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative group">
                                <input
                                    type="file"
                                    accept=".tif,.tiff"
                                    multiple
                                    onChange={handleOrthomosaicChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <Upload className="text-slate-400 mb-2 group-hover:text-teal-600 transition-colors" size={24} />
                                <span className="text-sm text-slate-500">Click to browse or drag orthomosaics here</span>
                            </div>

                            {/* Orthomosaic File List */}
                            {orthomosaicFiles.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {orthomosaicFiles.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg p-2 px-3">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <Image size={16} className="text-teal-600 flex-shrink-0" />
                                                <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                                                <span className="text-xs text-slate-500 flex-shrink-0">({formatFileSize(file.size)})</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeOrthomosaic(index)}
                                                className="text-rose-500 hover:text-rose-700 transition-colors ml-2"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Audio Files - Show for acoustic surveys */}
                    {surveyType === 'acoustic' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <FileAudio size={16} className="text-orange-600" />
                                Audio Files (.wav, .mp3, .flac)
                            </label>
                            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative group">
                                <input
                                    type="file"
                                    accept=".wav,.mp3,.flac"
                                    multiple
                                    onChange={handleAudioChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <Upload className="text-slate-400 mb-2 group-hover:text-orange-600 transition-colors" size={24} />
                                <span className="text-sm text-slate-500">Click to browse or drag audio files here</span>
                            </div>

                            {/* Audio File List with ARU Selection */}
                            {audioFiles.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {audioFiles.map((file, index) => (
                                        <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <FileAudio size={16} className="text-orange-600 flex-shrink-0" />
                                                    <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                                                    <span className="text-xs text-slate-500 flex-shrink-0">({formatFileSize(file.size)})</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAudio(index)}
                                                    className="text-rose-500 hover:text-rose-700 transition-colors ml-2"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            {/* ARU Selection */}
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-orange-600 flex-shrink-0" />
                                                <select
                                                    value={audioAruMap[index] || ''}
                                                    onChange={(e) => setAruForAudio(index, e.target.value)}
                                                    className="flex-1 text-sm px-2 py-1 bg-white border border-orange-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                                >
                                                    <option value="">Select ARU Location...</option>
                                                    {availableArus.map(aru => (
                                                        <option key={aru.id} value={aru.id}>
                                                            {aru.name} ({aru.lat.toFixed(5)}, {aru.lon.toFixed(5)})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add New ARU Button */}
                                    {!showNewAruForm && (
                                        <button
                                            type="button"
                                            onClick={() => setShowNewAruForm(true)}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors text-sm font-medium"
                                        >
                                            <Plus size={16} />
                                            Add New ARU Location
                                        </button>
                                    )}

                                    {/* New ARU Form */}
                                    {showNewAruForm && (
                                        <div className="bg-white border-2 border-orange-300 rounded-lg p-3 space-y-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-semibold text-slate-700">New ARU Location</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewAruForm(false)}
                                                    className="text-slate-400 hover:text-slate-600"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="ARU Name (e.g., ARU 4)"
                                                value={newAruName}
                                                onChange={(e) => setNewAruName(e.target.value)}
                                                className="w-full text-sm px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                            />
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="Latitude"
                                                    value={newAruLat}
                                                    onChange={(e) => setNewAruLat(e.target.value)}
                                                    className="text-sm px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                                />
                                                <input
                                                    type="number"
                                                    step="any"
                                                    placeholder="Longitude"
                                                    value={newAruLon}
                                                    onChange={(e) => setNewAruLon(e.target.value)}
                                                    className="text-sm px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleCreateAru}
                                                className="w-full px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded transition-colors"
                                            >
                                                Create ARU
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-lg shadow-teal-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Uploading...
                                </>
                            ) : (
                                `Upload ${orthomosaicFiles.length + audioFiles.length} File(s)`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewSurveyModal;
