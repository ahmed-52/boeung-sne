import React, { useState, useMemo } from 'react';
import { Layers, ChevronDown, ChevronUp, Eye, Mic, Zap, HelpCircle, TrendingUp } from 'lucide-react';

/**
 * FusionCard - Dashboard component for Data Fusion Analysis
 * Allows user to manually select drone + acoustic surveys and generate insights
 */

const FusionCard = ({ droneSurveys, acousticSurveys, onGenerateReport }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedDroneSurvey, setSelectedDroneSurvey] = useState(null);
    const [selectedAcousticSurvey, setSelectedAcousticSurvey] = useState(null);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const canGenerate = selectedDroneSurvey && selectedAcousticSurvey;

    const handleGenerate = async () => {
        if (!canGenerate) return;

        setLoading(true);
        setError(null);

        try {
            const url = `/api/fusion/report?visual_survey_id=${selectedDroneSurvey.id}&acoustic_survey_id=${selectedAcousticSurvey.id}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to generate fusion report');
            const data = await res.json();
            setReport(data);
            if (onGenerateReport) onGenerateReport(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Calculate species probabilities from report
    const speciesInferences = useMemo(() => {
        if (!report) return [];

        const inferences = [];
        const { visual_counts, acoustic_counts, species_color_mapping } = report;

        // For each color class detected by drone
        for (const [colorKey, speciesList] of Object.entries(species_color_mapping || {})) {
            const droneClass = `${colorKey}_birds`; // Match actual class names (plural)
            const droneCount = visual_counts?.[droneClass] || 0;

            if (droneCount === 0) continue;

            // Calculate audio detections for each species in this color
            const speciesBreakdown = speciesList.map(species => {
                const audioCount = acoustic_counts?.[species] || 0;
                return { species, audioCount };
            }).filter(s => s.audioCount > 0);

            // Total audio detections for this color category
            const totalAudio = speciesBreakdown.reduce((sum, s) => sum + s.audioCount, 0);

            // Calculate probabilities
            const withProbabilities = speciesBreakdown.map(s => ({
                ...s,
                probability: totalAudio > 0 ? Math.round((s.audioCount / totalAudio) * 100) : 0
            })).sort((a, b) => b.probability - a.probability);

            // Estimate how many drone detections are "explained" by audio
            const explainedCount = Math.min(droneCount, totalAudio);
            const unidentified = droneCount - explainedCount;

            inferences.push({
                colorClass: colorKey,
                droneClass,
                droneCount,
                species: withProbabilities,
                totalAudioDetections: totalAudio,
                unidentified,
                confidenceScore: totalAudio > 0 ? Math.min(100, Math.round((totalAudio / droneCount) * 100)) : 0
            });
        }

        return inferences;
    }, [report]);

    return (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            {/* Header - Always visible */}
            <div
                className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 cursor-pointer flex items-center justify-between"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                        <Layers className="text-indigo-600" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Data Fusion Analysis</h3>
                        <p className="text-xs text-slate-500">Combine drone + acoustic data for species inference</p>
                    </div>
                </div>
                <button className="p-1 hover:bg-white/50 rounded-lg transition-colors">
                    {isExpanded ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
                </button>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 space-y-4">
                    {/* Survey Selectors */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Drone Survey Selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <Eye size={14} className="text-teal-500" />
                                Drone Survey
                            </label>
                            <select
                                value={selectedDroneSurvey?.id || ''}
                                onChange={(e) => {
                                    const survey = droneSurveys.find(s => s.id === parseInt(e.target.value));
                                    setSelectedDroneSurvey(survey || null);
                                    setReport(null); // Clear old report
                                }}
                                className="w-full px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-sm"
                            >
                                <option value="">Select drone survey...</option>
                                {droneSurveys.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({new Date(s.date).toLocaleDateString()})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Acoustic Survey Selector */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                                <Mic size={14} className="text-orange-500" />
                                Acoustic Survey
                            </label>
                            <select
                                value={selectedAcousticSurvey?.id || ''}
                                onChange={(e) => {
                                    const survey = acousticSurveys.find(s => s.id === parseInt(e.target.value));
                                    setSelectedAcousticSurvey(survey || null);
                                    setReport(null); // Clear old report
                                }}
                                className="w-full px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-sm"
                            >
                                <option value="">Select acoustic survey...</option>
                                {acousticSurveys.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} {s.aru ? `@ ${s.aru.name}` : ''} ({new Date(s.date).toLocaleDateString()})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={!canGenerate || loading}
                        className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${canGenerate
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700 shadow-lg'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div>
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Zap size={18} />
                                Generate Fusion Analysis
                            </>
                        )}
                    </button>

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Results */}
                    {report && speciesInferences.length > 0 && (
                        <div className="space-y-4 pt-2">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                <TrendingUp size={16} className="text-indigo-500" />
                                Species Probability Analysis
                            </h4>

                            {speciesInferences.map((inf, idx) => (
                                <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    {/* Color Class Header */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-4 h-4 rounded-full ${inf.colorClass === 'white' ? 'bg-gray-200 border border-gray-300' :
                                                inf.colorClass === 'black' ? 'bg-gray-800' :
                                                    inf.colorClass === 'brown' ? 'bg-amber-700' : 'bg-slate-400'
                                                }`}></span>
                                            <span className="font-semibold text-slate-800 capitalize">
                                                {inf.colorClass} Birds
                                            </span>
                                        </div>
                                        <span className="text-lg font-bold text-indigo-600">
                                            {inf.droneCount} detected
                                        </span>
                                    </div>

                                    {/* Species Breakdown */}
                                    <div className="space-y-2">
                                        {inf.species.map((sp, spIdx) => (
                                            <div key={spIdx} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 flex-1">
                                                    <span className="text-sm text-slate-700">{sp.species}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                                                            style={{ width: `${sp.probability}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-sm font-semibold text-indigo-600 w-12 text-right">
                                                        {sp.probability}%
                                                    </span>
                                                    <span className="text-xs text-slate-400 w-16 text-right">
                                                        ({sp.audioCount} audio)
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Confidence and Unidentified */}
                                    <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-1 text-slate-500">
                                            <HelpCircle size={14} />
                                            <span>Confidence: <strong className={inf.confidenceScore > 70 ? 'text-green-600' : inf.confidenceScore > 40 ? 'text-yellow-600' : 'text-red-500'}>{inf.confidenceScore}%</strong></span>
                                        </div>
                                        {inf.unidentified > 0 && (
                                            <span className="text-amber-600">
                                                ~{inf.unidentified} unidentified by audio
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                                <div className="bg-teal-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-teal-600">
                                        {Object.values(report.visual_counts || {}).reduce((a, b) => a + b, 0)}
                                    </div>
                                    <div className="text-xs text-teal-700">Drone Detections</div>
                                </div>
                                <div className="bg-orange-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-orange-600">
                                        {Object.values(report.acoustic_counts || {}).reduce((a, b) => a + b, 0)}
                                    </div>
                                    <div className="text-xs text-orange-700">Audio Detections</div>
                                </div>
                                <div className="bg-indigo-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-indigo-600">
                                        {Object.keys(report.acoustic_counts || {}).length}
                                    </div>
                                    <div className="text-xs text-indigo-700">Species ID'd</div>
                                </div>
                                <div className="bg-violet-50 p-3 rounded-lg text-center">
                                    <div className="text-2xl font-bold text-violet-600">
                                        {speciesInferences.reduce((sum, inf) => sum + inf.unidentified, 0)}
                                    </div>
                                    <div className="text-xs text-violet-700">Unidentified</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* No results yet */}
                    {report && speciesInferences.length === 0 && (
                        <div className="text-center py-8 text-slate-400">
                            <HelpCircle size={32} className="mx-auto mb-2" />
                            <p>No color-based species inferences available.</p>
                            <p className="text-xs">This may happen if drone detected only named species (not color classes).</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FusionCard;
