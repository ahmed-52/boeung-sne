import React, { useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

const NewSurveyModal = ({ isOpen, onClose, onUploadComplete }) => {
    const [file, setFile] = useState(null);
    const [name, setName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || !name) {
            setError("Please provide both a name and a GeoTIFF file.");
            return;
        }

        setIsUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('survey_name', name);
        formData.append('file', file);

        // Optional: date is defaulted to today in backend, can add picker later

        try {
            const res = await fetch('/api/surveys/import', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                throw new Error("Upload failed");
            }

            const data = await res.json();
            onUploadComplete(data);
            onClose();
        } catch (err) {
            console.error(err);
            setError("Failed to upload survey. Please try again.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 m-4 relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold text-slate-800 mb-1">New Survey Import</h2>
                <p className="text-slate-500 text-sm mb-6">Upload a Drone Orthomosaic (.tif) for analysis.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Survey Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Zone 2 - Morning"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-databird-orange/50 transition-all text-slate-800"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Orthomosaic File (.tif)</label>
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative group">
                            <input
                                type="file"
                                accept=".tif,.tiff"
                                onChange={(e) => setFile(e.target.files[0])}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <Upload className="text-slate-400 mb-2 group-hover:text-databird-orange transition-colors" size={24} />
                            {file ? (
                                <span className="text-sm font-medium text-slate-700 break-all">{file.name}</span>
                            ) : (
                                <span className="text-sm text-slate-500">Click to browse or drag file here</span>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isUploading}
                            className="w-full py-2.5 bg-databird-orange hover:bg-orange-500 text-white font-semibold rounded-lg shadow-lg shadow-orange-500/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Processing...
                                </>
                            ) : (
                                "Start Processing"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewSurveyModal;
