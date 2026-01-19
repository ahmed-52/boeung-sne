import React, { useState, useEffect } from 'react';
import { Upload, X, Loader2, Settings, Save, AlertTriangle, FileCode } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose }) => {
    const [minConfidence, setMinConfidence] = useState(0.25);
    const [defaultLat, setDefaultLat] = useState(11.406949);
    const [defaultLon, setDefaultLon] = useState(105.394883);

    // File states
    const [acousticModel, setAcousticModel] = useState(null);
    const [visualModel, setVisualModel] = useState(null);

    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    // Fetch Settings
    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                setMinConfidence(data.min_confidence);
                setDefaultLat(data.default_lat);
                setDefaultLon(data.default_lon);
            }
        } catch (err) {
            console.error("Failed to fetch settings:", err);
            setMessage({ type: 'error', text: 'Failed to load settings.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setUploading(true);
        setMessage(null);

        try {
            // 1. Save Basic Settings
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    min_confidence: parseFloat(minConfidence),
                    default_lat: parseFloat(defaultLat),
                    default_lon: parseFloat(defaultLon),
                    // ID is fixed to 1 in backend usually
                    id: 1
                })
            });

            if (!res.ok) throw new Error("Failed to save configuration");

            // 2. Upload Acoustic Model if selected
            if (acousticModel) {
                const formData = new FormData();
                formData.append('file', acousticModel);
                formData.append('type', 'acoustic');
                const upRes = await fetch('/api/settings/upload-model', {
                    method: 'POST',
                    body: formData
                });
                if (!upRes.ok) throw new Error("Failed to upload acoustic model");
            }

            // 3. Upload Visual Model if selected
            if (visualModel) {
                const formData = new FormData();
                formData.append('file', visualModel);
                formData.append('type', 'visual');
                const upRes = await fetch('/api/settings/upload-model', {
                    method: 'POST',
                    body: formData
                });
                if (!upRes.ok) throw new Error("Failed to upload visual model");
            }

            setMessage({ type: 'success', text: 'Settings saved successfully!' });

            // Clear files after successful upload
            setAcousticModel(null);
            setVisualModel(null);

            // Close after short delay? No, user might want to see confirmation
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || "An error occurred." });
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 m-4 relative animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-slate-100 p-2 rounded-lg">
                        <Settings className="text-slate-700" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">System Settings</h2>
                        <p className="text-slate-500 text-sm">Configure pipeline parameters and models.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="animate-spin text-slate-400" size={24} />
                    </div>
                ) : (
                    <form onSubmit={handleSaveSettings} className="space-y-6">

                        {/* Pipeline Parameters */}
                        <div className="space-y-4 border-b border-slate-100 pb-6">
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Pipeline Parameters</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Min Confidence</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        value={minConfidence}
                                        onChange={(e) => setMinConfidence(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Threshold for detections (0.0 - 1.0)</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Default Latitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={defaultLat}
                                        onChange={(e) => setDefaultLat(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Default Longitude</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={defaultLon}
                                        onChange={(e) => setDefaultLon(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Model Management */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Model Management</h3>

                            {/* Acoustic Model */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <label className="block text-sm font-medium text-slate-800 mb-2 flex items-center gap-2">
                                    <FileCode size={16} className="text-orange-600" />
                                    Acoustic Model Override
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept=".tflite,.pt,.onnx"
                                            onChange={(e) => setAcousticModel(e.target.files[0])}
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Upload a custom BirdNET classifier (e.g., custom_model.tflite). Leave empty to keep current.</p>
                            </div>

                            {/* Visual Model */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <label className="block text-sm font-medium text-slate-800 mb-2 flex items-center gap-2">
                                    <FileCode size={16} className="text-teal-600" />
                                    Visual Model Override
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept=".pt,.onnx"
                                            onChange={(e) => setVisualModel(e.target.files[0])}
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Upload a custom YOLO model (e.g., best.pt). Leave empty to keep current.</p>
                            </div>
                        </div>

                        {/* Species Color Mapping */}
                        <SpeciesColorMapping />

                        {/* Status Message */}
                        {message && (
                            <div className={`text-sm px-4 py-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                }`}>
                                {message.type === 'error' && <AlertTriangle size={16} />}
                                {message.text}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={uploading}
                                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-lg shadow-slate-900/10 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>

                    </form>
                )}
            </div>
        </div>
    );
};

/**
 * Species Color Mapping Sub-Component
 * Allows users to configure which species belong to which color category for fusion inference.
 */
const SpeciesColorMapping = () => {
    const [mapping, setMapping] = useState({
        white: [],
        black: [],
        brown: [],
        grey: []
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newSpecies, setNewSpecies] = useState({ white: '', black: '', brown: '', grey: '' });

    useEffect(() => {
        // Fetch existing mapping
        fetch('/api/settings/species_colors')
            .then(res => res.json())
            .then(data => {
                if (data.mapping) {
                    setMapping({
                        white: data.mapping.white || [],
                        black: data.mapping.black || [],
                        brown: data.mapping.brown || [],
                        grey: data.mapping.grey || []
                    });
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleAddSpecies = (color) => {
        const species = newSpecies[color].trim();
        if (!species) return;
        if (mapping[color].includes(species)) return;

        setMapping(prev => ({
            ...prev,
            [color]: [...prev[color], species]
        }));
        setNewSpecies(prev => ({ ...prev, [color]: '' }));
    };

    const handleRemoveSpecies = (color, species) => {
        setMapping(prev => ({
            ...prev,
            [color]: prev[color].filter(s => s !== species)
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/settings/species_colors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mapping)
            });
        } catch (err) {
            console.error('Failed to save species colors:', err);
        } finally {
            setSaving(false);
        }
    };

    const colorLabels = {
        white: { label: 'White Birds', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
        black: { label: 'Black Birds', bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-600' },
        brown: { label: 'Brown Birds', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
        grey: { label: 'Grey Birds', bg: 'bg-gray-200', text: 'text-gray-700', border: 'border-gray-400' }
    };

    if (loading) return <div className="text-sm text-slate-400 py-4">Loading species mapping...</div>;

    return (
        <div className="space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Species Color Mapping</h3>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full font-medium hover:bg-indigo-100 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Mapping'}
                </button>
            </div>
            <p className="text-xs text-slate-500">
                Map audio species to drone color classes for fusion inference.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(colorLabels).map(([color, style]) => (
                    <div key={color} className={`p-3 rounded-lg border ${style.border} bg-white`}>
                        <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${style.text}`}>
                            {style.label}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2 min-h-[32px]">
                            {mapping[color].map(sp => (
                                <span
                                    key={sp}
                                    className={`px-2 py-0.5 text-xs rounded-full ${style.bg} ${style.text} cursor-pointer hover:opacity-70`}
                                    onClick={() => handleRemoveSpecies(color, sp)}
                                    title="Click to remove"
                                >
                                    {sp} ×
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-1">
                            <input
                                type="text"
                                placeholder="Add species..."
                                value={newSpecies[color]}
                                onChange={(e) => setNewSpecies(prev => ({ ...prev, [color]: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSpecies(color))}
                                className="flex-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddSpecies(color)}
                                className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                            >
                                +
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SettingsModal;
