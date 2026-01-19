import React, { useEffect, useState, useMemo } from 'react';
import { X, Activity, Layers, Bird, Eye, Mic, RefreshCw, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

/**
 * Fusion Insights Panel
 * Displays combined analysis of overlapping acoustic + visual data.
 */

const COLORS = ['#0d9488', '#f97316', '#6366f1', '#84cc16', '#ec4899', '#8b5cf6'];

const FusionInsightsPanel = ({ isOpen, onClose, visualSurveyId, acousticSurveyId, aruId, visualSurveyName, acousticSurveyName }) => {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isOpen || !visualSurveyId) return;
        if (!acousticSurveyId && !aruId) return;

        setLoading(true);
        setError(null);

        // Build query params
        let url = `/api/fusion/report?visual_survey_id=${visualSurveyId}`;
        if (acousticSurveyId) url += `&acoustic_survey_id=${acousticSurveyId}`;
        if (aruId) url += `&aru_id=${aruId}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch fusion report');
                return res.json();
            })
            .then(data => {
                setReport(data);
            })
            .catch(err => {
                console.error(err);
                setError(err.message);
            })
            .finally(() => setLoading(false));
    }, [isOpen, visualSurveyId, acousticSurveyId, aruId]);

    // Prepare chart data - MUST be before any early returns
    const visualChartData = useMemo(() => {
        if (!report?.visual_counts) return [];
        return Object.entries(report.visual_counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [report]);

    const acousticChartData = useMemo(() => {
        if (!report?.acoustic_counts) return [];
        return Object.entries(report.acoustic_counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [report]);

    // Early return AFTER all hooks
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-orange-50 shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-teal-700 mb-1">
                                <Layers size={16} />
                                Data Fusion Analysis
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {visualSurveyName || `Survey ${visualSurveyId}`}
                                <ChevronRight className="inline mx-1 text-slate-400" size={16} />
                                {acousticSurveyName || (aruId ? `ARU ${aruId}` : `Survey ${acousticSurveyId}`)}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/50 rounded-full transition-colors"
                        >
                            <X size={20} className="text-slate-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <RefreshCw className="animate-spin mb-3" size={32} />
                            <p>Generating fusion report...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12 text-red-500">
                            <p>{error}</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard
                                    label="Visual Detections"
                                    value={Object.values(report.visual_counts || {}).reduce((a, b) => a + b, 0)}
                                    icon={<Eye size={18} />}
                                    color="teal"
                                />
                                <StatCard
                                    label="Acoustic Detections"
                                    value={Object.values(report.acoustic_counts || {}).reduce((a, b) => a + b, 0)}
                                    icon={<Mic size={18} />}
                                    color="orange"
                                />
                                <StatCard
                                    label="Visual Species"
                                    value={Object.keys(report.visual_counts || {}).length}
                                    icon={<Bird size={18} />}
                                    color="indigo"
                                />
                                <StatCard
                                    label="Acoustic Species"
                                    value={Object.keys(report.acoustic_counts || {}).length}
                                    icon={<Activity size={18} />}
                                    color="pink"
                                />
                            </div>

                            {/* Charts Side-by-Side */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Visual Breakdown */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                        <Eye size={16} className="text-teal-500" />
                                        Visual (Drone)
                                    </h4>
                                    {visualChartData.length > 0 ? (
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={visualChartData} layout="vertical">
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                                    <Tooltip />
                                                    <Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 text-center py-8">No visual data</p>
                                    )}
                                </div>

                                {/* Acoustic Breakdown */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                        <Mic size={16} className="text-orange-500" />
                                        Acoustic (BirdNET)
                                    </h4>
                                    {acousticChartData.length > 0 ? (
                                        <div className="h-48">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={acousticChartData} layout="vertical">
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                                                    <Tooltip />
                                                    <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-slate-400 text-center py-8">No acoustic data</p>
                                    )}
                                </div>
                            </div>

                            {/* Inferences Section */}
                            {report.inferences && report.inferences.length > 0 && (
                                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 p-5 rounded-xl border border-indigo-100">
                                    <h4 className="font-semibold text-indigo-800 mb-4 flex items-center gap-2">
                                        <Layers size={16} />
                                        Species Inferences
                                    </h4>
                                    <p className="text-sm text-slate-600 mb-4">
                                        These inferences combine drone color-class detections with BirdNET species identifications.
                                    </p>
                                    <div className="space-y-3">
                                        {report.inferences.map((inf, idx) => (
                                            <div key={idx} className="bg-white/70 p-4 rounded-lg border border-indigo-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-slate-800 capitalize">
                                                        {inf.drone_class.replace('_', ' ')}
                                                    </span>
                                                    <span className="text-lg font-bold text-indigo-700">{inf.drone_count}</span>
                                                </div>
                                                {Object.keys(inf.audio_species).length > 0 ? (
                                                    <div className="text-sm text-slate-600">
                                                        <p className="mb-1">Possible species (from audio):</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(inf.audio_species).map(([sp, count]) => (
                                                                <span key={sp} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                                                    {sp}: {count}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {inf.unidentified > 0 && (
                                                            <p className="text-xs text-slate-400 mt-2">
                                                                {inf.unidentified} remain unidentified via audio
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400">No matching audio species detected</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// Simple Stat Card Component
const StatCard = ({ label, value, icon, color }) => {
    const colorClasses = {
        teal: 'bg-teal-50 text-teal-600 border-teal-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        pink: 'bg-pink-50 text-pink-600 border-pink-100'
    };

    return (
        <div className={`p-4 rounded-xl border ${colorClasses[color] || colorClasses.teal}`}>
            <div className="flex items-center gap-2 mb-1 opacity-70">
                {icon}
                <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
};

export default FusionInsightsPanel;
