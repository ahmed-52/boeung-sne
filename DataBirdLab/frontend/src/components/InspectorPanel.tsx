import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, Image as ImageIcon, MapPin, Calendar, ExternalLink, Activity, PlayCircle, ChevronDown, Database, BarChart3, List, PieChart } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { VisualDetection, AcousticDetection, visualDetections, acousticDetections } from '../mockData';

interface InspectorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    selectedVisual: VisualDetection | null;
    selectedAcoustic: AcousticDetection | null;
    selectedARU: { id: string, lat: number, lon: number, detectionCount: number, aru_id?: number } | null;
    selectedSurvey?: { id: number, name: string, date: string } | null;
    filterDays: number;
    selectedSurveyIds: number[];
}

// Deterministic color generator for distinct species
const getSpeciesColor = (species: string) => {
    const colors = [
        { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', text: '#b91c1c' }, // Red
        { border: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', text: '#c2410c' }, // Orange
        { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', text: '#b45309' }, // Amber
        { border: '#84cc16', bg: 'rgba(132, 204, 22, 0.2)', text: '#4d7c0f' }, // Lime
        { border: '#10b981', bg: 'rgba(16, 185, 129, 0.2)', text: '#047857' }, // Emerald
        { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.2)', text: '#0e7490' }, // Cyan
        { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)', text: '#1d4ed8' }, // Blue
        { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)', text: '#4338ca' }, // Indigo
        { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)', text: '#6d28d9' }, // Violet
        { border: '#d946ef', bg: 'rgba(217, 70, 239, 0.2)', text: '#a21caf' }, // Fuchsia
        { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.2)', text: '#be123c' }, // Rose
    ];

    let hash = 0;
    for (let i = 0; i < species.length; i++) {
        hash = species.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
};

// Haversine formula to calculate distance in meters
const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

const InspectorPanel: React.FC<InspectorPanelProps> = ({
    isOpen,
    onClose,
    selectedVisual,
    selectedAcoustic,
    selectedARU,
    selectedSurvey,
    filterDays,
    selectedSurveyIds
}) => {
    const [allDetections, setAllDetections] = useState<any[]>([]);
    const [isLoadingDetections, setIsLoadingDetections] = useState(false);
    const [selectedSurveyFilter, setSelectedSurveyFilter] = useState<number | 'all'>('all');

    // View Mode for ARU Panel
    const [viewMode, setViewMode] = useState<'summary' | 'details'>('summary');


    // For Tile View
    const [selectedTileId, setSelectedTileId] = useState<number | null>(null);

    // Fetch detections when ARU is selected
    // Note: This logic for ARU is kept somewhat separate from the new Survey view
    const [filteredDetections, setFilteredDetections] = useState<any[]>([]);
    const [availableSurveys, setAvailableSurveys] = useState<any[]>([]);

    // Fetch detections for Selected Survey
    useEffect(() => {
        if (selectedSurvey) {
            setIsLoadingDetections(true);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - filterDays);

            Promise.all([

                // Fetch Visual Detections - Request all time data for this survey
                fetch(`/api/detections/visual?survey_ids=${selectedSurvey.id}&days=3650`)
                    .then(res => res.json()),
                // Fetch Acoustic Detections
                fetch(`/api/detections/acoustic?survey_ids=${selectedSurvey.id}&days=3650`)
                    .then(res => res.json())
            ]).then(([visual, acoustic]) => {
                const combined = [
                    ...visual.map((d: any) => ({ ...d, type: 'visual', timestamp: d.timestamp || new Date().toISOString() })),
                    ...acoustic.map((d: any) => ({ ...d, type: 'acoustic', timestamp: d.timestamp || new Date().toISOString() }))
                ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                console.log("InspectorPanel: Fetched detections", { visualCount: visual.length, acousticCount: acoustic.length, firstVisual: visual[0] });
                setAllDetections(combined);
            }).catch(err => {
                console.error("Failed to fetch detections:", err);
                setAllDetections([]);
            }).finally(() => {
                setIsLoadingDetections(false);
            });
        }
    }, [selectedSurvey, filterDays]);


    useEffect(() => {
        if (selectedARU) {
            setIsLoadingDetections(true);

            // Use aru_id if available (numeric), otherwise fallback to id (string) - but API needs int.
            // If aru_id is missing, we might have an issue, but let's try.
            const targetId = selectedARU.aru_id;
            if (!targetId) {
                console.error("No numeric ARU ID found for", selectedARU);
                setIsLoadingDetections(false);
                return;
            }

            fetch(`/api/arus/${targetId}/detections?days=${filterDays}&survey_ids=${selectedSurveyIds.join(',')}`)
                .then(res => res.json())
                .then(data => {
                    if (!Array.isArray(data)) {
                        console.error("Expected array of detections, got:", data);
                        setFilteredDetections([]);
                        return;
                    }
                    setFilteredDetections(data);

                    // Extract unique surveys
                    const surveys: any = {};
                    data.forEach((d: any) => {
                        if (d.survey_id) {
                            surveys[d.survey_id] = { id: d.survey_id, name: d.survey_name, count: (surveys[d.survey_id]?.count || 0) + 1 };
                        }
                    });
                    setAvailableSurveys(Object.values(surveys));
                })
                .catch(console.error)
                .finally(() => setIsLoadingDetections(false));
        }
    }, [selectedARU, filterDays, selectedSurveyIds]);


    // Derived state for Tile View
    const detectionsByTile = useMemo(() => {
        const grouped: Record<number, any[]> = {};
        allDetections.forEach(det => {
            if (det.type === 'visual' && det.asset_id) {
                if (!grouped[det.asset_id]) {
                    grouped[det.asset_id] = [];
                }
                grouped[det.asset_id].push(det);
            }
        });
        console.log("InspectorPanel: detectionsByTile computed", {
            allCount: allDetections.length,
            tileCount: Object.keys(grouped).length,
            sampleDet: allDetections.find(d => d.type === 'visual')
        });
        console.log("InspectorPanel: detectionsByTile computed", {
            allCount: allDetections.length,
            tileCount: Object.keys(grouped).length,
            sampleDet: allDetections.find(d => d.type === 'visual')
        });
        return grouped;
    }, [allDetections]);

    const selectedTileDetections = useMemo(() => {
        if (!selectedTileId) return [];
        return detectionsByTile[selectedTileId] || [];
    }, [selectedTileId, detectionsByTile]);


    // Cross-reference logic (for single detection view)
    const correlations = useMemo(() => {
        if (!selectedVisual && !selectedAcoustic) return [];

        const current = (selectedVisual || selectedAcoustic)!;
        const currentType = selectedVisual ? 'visual' : 'acoustic';
        const otherType = selectedVisual ? 'acoustic' : 'visual';

        // Find relevant detections from the other set
        const sourceData = currentType === 'visual' ? acousticDetections : visualDetections;

        return sourceData
            .map(d => {
                const dist = getDistanceMeters(current.lat, current.lon, d.lat, d.lon);
                // Check time proximity (within 30 mins)
                const timeDiff = Math.abs(new Date(current.timestamp).getTime() - new Date(d.timestamp).getTime()) / 1000 / 60;

                return { data: d, dist, timeDiff, type: otherType };
            })
            .filter(item => item.dist < 500 && item.timeDiff < 30) // 500m radius, 30min window
            .sort((a, b) => a.dist - b.dist);

    }, [selectedVisual, selectedAcoustic]);

    const detectionsBySurvey = useMemo(() => {
        const grouped: any = {};
        filteredDetections.forEach(det => {
            if (!grouped[det.survey_id]) grouped[det.survey_id] = [];
            grouped[det.survey_id].push(det);
        });
        return grouped;
    }, [filteredDetections]);

    if (!isOpen) return null;

    // Survey View
    if (selectedSurvey) {
        return (
            <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-[500] border-l border-slate-200 transform transition-transform duration-300 overflow-y-auto">
                <div className="p-6 border-b border-slate-100 bg-teal-50 sticky top-0 z-10">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-2 bg-teal-100 text-teal-700">
                                <MapPin size={12} />
                                Orthomosaic Survey
                            </span>
                            <h2 className="text-xl font-bold text-slate-800">{selectedSurvey.name}</h2>
                            <p className="text-sm text-slate-500 mt-1">{new Date(selectedSurvey.date).toLocaleDateString()}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-teal-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600">
                        <h4 className="font-semibold text-slate-800 mb-2">Survey Details</h4>
                        <p className="mb-2">This is a processed aerial survey. The highlighted area represents the bounding box of the orthomosaic.</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                                <span className="text-xs text-slate-400 block">ID</span>
                                <span className="font-mono text-slate-700">{selectedSurvey.id}</span>
                            </div>
                            <div>
                                <span className="text-xs text-slate-400 block">Status</span>
                                <span className="text-emerald-600 font-medium">Processed</span>
                            </div>
                        </div>
                    </div>

                    {/* Species Summary */}
                    {!isLoadingDetections && allDetections.length > 0 && (
                        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <h4 className="font-semibold text-slate-800 mb-3 text-xs uppercase tracking-wider">Species Summary</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(
                                    allDetections.reduce((acc: any, det) => {
                                        acc[det.species] = (acc[det.species] || 0) + 1;
                                        return acc;
                                    }, {})
                                ).map(([species, count]: any) => {
                                    const color = getSpeciesColor(species);
                                    return (
                                        <div key={species} className="flex justify-between items-center text-sm p-2 rounded bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: color.border }}
                                                />
                                                <span className="text-slate-700 font-medium">{species}</span>
                                            </div>
                                            <span
                                                className="px-2 py-0.5 rounded-full text-xs font-bold"
                                                style={{ backgroundColor: color.bg, color: color.text }}
                                            >
                                                {count}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Detections List (Grid View) */}
                    <div>
                        <h3 className="font-bold text-slate-800 mb-3 flex items-center justify-between bg-white py-2 z-10">
                            <span>Detections by Tile</span>
                            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{Object.keys(detectionsByTile).length} tiles</span>
                        </h3>

                        {isLoadingDetections ? (
                            <div className="text-center py-8">
                                <Activity className="animate-spin mx-auto text-teal-500 mb-2" size={24} />
                                <p className="text-sm text-slate-500">Loading detections...</p>
                            </div>
                        ) : Object.keys(detectionsByTile).length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                                {Object.keys(detectionsByTile).map((tileId) => {
                                    const dets = detectionsByTile[parseInt(tileId)];
                                    const thumbnail = dets[0].imageUrl;

                                    return (
                                        <div
                                            key={tileId}
                                            onClick={() => setSelectedTileId(parseInt(tileId))}
                                            className="group relative aspect-square bg-slate-100 rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-teal-400 hover:ring-2 hover:ring-teal-400/20 transition-all"
                                        >
                                            <img src={thumbnail} alt="Tile" className="w-full h-full object-cover" />

                                            {/* Badge */}
                                            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm group-hover:bg-teal-600 transition-colors">
                                                {dets.length}
                                            </div>

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                <div className="bg-white/90 text-slate-800 p-1.5 rounded-full shadow-lg">
                                                    <ExternalLink size={16} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                                No visual detections found in this survey.
                            </div>
                        )}
                    </div>
                </div>

                {/* Tile Detail Modal */}
                {selectedTileId && createPortal(
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8" onClick={() => setSelectedTileId(null)}>
                        <div
                            className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <div>
                                    <h3 className="font-bold text-slate-800">Tile Details</h3>
                                    <p className="text-xs text-slate-500">{selectedTileDetections.length} detections found in this image</p>
                                </div>
                                <button
                                    onClick={() => setSelectedTileId(null)}
                                    className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Content - Scrollable */}
                            <div className="flex-1 overflow-auto p-4 bg-slate-900 flex items-center justify-center relative">
                                <div className="relative inline-block shadow-2xl">
                                    {selectedTileDetections.length > 0 && (
                                        <img
                                            src={selectedTileDetections[0].imageUrl}
                                            alt="Full Tile"
                                            className="max-h-[75vh] object-contain rounded-lg"
                                        />
                                    )}

                                    {/* Draw Bounding Boxes */}
                                    {selectedTileDetections.map((det) => {
                                        // det.bbox is {cx, cy, w, h} normalized (0-1)
                                        // Convert to top-left percentage
                                        const w_pct = det.bbox.w * 100;
                                        const h_pct = det.bbox.h * 100;
                                        const left_pct = (det.bbox.cx - det.bbox.w / 2) * 100;
                                        const top_pct = (det.bbox.cy - det.bbox.h / 2) * 100;

                                        const color = getSpeciesColor(det.species);

                                        return (
                                            <div
                                                key={det.id}
                                                className="absolute border-2 group transition-colors cursor-help"
                                                style={{
                                                    left: `${left_pct}%`,
                                                    top: `${top_pct}%`,
                                                    width: `${w_pct}%`,
                                                    height: `${h_pct}%`,
                                                    borderColor: color.border,
                                                }}
                                                title={`${det.species} (${(det.confidence * 100).toFixed(0)}%)`}
                                            >
                                                {/* Shade on hover */}
                                                <div
                                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style={{ backgroundColor: color.bg }}
                                                />

                                                <div
                                                    className="absolute -top-6 left-0 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                                                    style={{ backgroundColor: color.border }}
                                                >
                                                    {det.species} {(det.confidence * 100).toFixed(0)}%
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        );
    }

    // ARU View
    if (selectedARU) {

        // --- PREPARE SUMMARY DATA ---
        const totalDetections = filteredDetections.length;
        const uniqueSpecies = new Set(filteredDetections.map(d => d.species)).size;

        // Species Distribution for Pie Chart
        const speciesCounts = filteredDetections.reduce((acc, curr) => {
            acc[curr.species] = (acc[curr.species] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const pieData = Object.entries(speciesCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a: any, b: any) => b.value - a.value)
            .slice(0, 8); // Top 8 species

        // Hourly Activity for Bar Chart
        const hourlyCounts = filteredDetections.reduce((acc, curr) => {
            const hour = new Date(curr.timestamp).getHours();
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {} as Record<number, number>);

        const barData = Array.from({ length: 24 }, (_, i) => ({
            hour: `${i}:00`,
            count: hourlyCounts[i] || 0
        }));


        return (
            <div className="fixed right-0 top-0 bottom-0 w-[450px] bg-white shadow-2xl z-[500] border-l border-slate-200 transform transition-transform duration-300 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-orange-50 shrink-0">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-2 bg-orange-100 text-orange-700">
                                <Mic size={12} />
                                Acoustic Recording Unit
                            </span>
                            <h2 className="text-xl font-bold text-slate-800">{selectedARU.id}</h2>
                            <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                                <MapPin size={14} />
                                <span className="font-mono">{selectedARU.lat.toFixed(5)}, {selectedARU.lon.toFixed(5)}</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex p-1 bg-white/50 rounded-lg border border-orange-100 mt-4">
                        <button
                            onClick={() => setViewMode('summary')}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'summary'
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <BarChart3 size={16} />
                            Summary
                        </button>
                        <button
                            onClick={() => setViewMode('details')}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'details'
                                ? 'bg-white text-orange-600 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <List size={16} />
                            Detections ({totalDetections})
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {isLoadingDetections ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Activity className="animate-spin mb-3 text-orange-500" size={32} />
                            <p>Loading data...</p>
                        </div>
                    ) : filteredDetections.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                            <p>No detections found for the selected period.</p>
                        </div>
                    ) : viewMode === 'summary' ? (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Key Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Events</div>
                                    <div className="text-2xl font-bold text-slate-800">{totalDetections}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                    <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Unique Species</div>
                                    <div className="text-2xl font-bold text-slate-800">{uniqueSpecies}</div>
                                </div>
                            </div>

                            {/* Species Chart */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <PieChart size={16} className="text-teal-500" />
                                    Top Species
                                </h4>
                                <div className="h-48 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RePieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={70}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => {
                                                    const col = getSpeciesColor(entry.name);
                                                    return <Cell key={`cell-${index}`} fill={col.text} stroke={col.border} />;
                                                })}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend
                                                layout="vertical"
                                                verticalAlign="middle"
                                                align="right"
                                                iconSize={8}
                                                formatter={(value: any) => <span className="text-slate-600 text-xs">{value}</span>}
                                            />
                                        </RePieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Hourly Activity */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                    <Activity size={16} className="text-orange-500" />
                                    Hourly Activity
                                </h4>
                                <div className="h-40 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={barData}>
                                            <XAxis dataKey="hour" hide />
                                            <Tooltip
                                                cursor={{ fill: 'transparent' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 mt-2 px-2">
                                    <span>00:00</span>
                                    <span>12:00</span>
                                    <span>23:00</span>
                                </div>
                            </div>

                            {/* Most Common Species Highlight */}
                            {pieData.length > 0 && (
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 rounded-xl text-white shadow-lg shadow-orange-500/20">
                                    <div className="text-xs font-medium text-orange-100 uppercase tracking-widest mb-1">Dominant Species</div>
                                    <div className="text-lg font-bold">{pieData[0].name}</div>
                                    <div className="text-sm opacity-90">{pieData[0].value} detections found</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2 animate-in fade-in duration-300">
                            {/* Filter Dropdown in Details View */}
                            <div className="mb-4">
                                <select
                                    value={selectedSurveyFilter}
                                    onChange={(e) => setSelectedSurveyFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                >
                                    <option value="all">All Surveys ({allDetections.length})</option>
                                    {availableSurveys.map(survey => (
                                        <option key={survey.id} value={survey.id}>
                                            {survey.name} ({survey.count})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Compact List */}
                            {selectedSurveyFilter === 'all' ? (
                                availableSurveys.map(survey => {
                                    const surveyDetections = detectionsBySurvey[survey.id] || [];
                                    if (surveyDetections.length === 0) return null;
                                    return (
                                        <div key={survey.id} className="mb-4">
                                            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-slate-50 py-1 z-10">{survey.name}</h5>
                                            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-50 overflow-hidden">
                                                {surveyDetections.map((det: any) => (
                                                    <DetectionRow key={det.id} detection={det} />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-50 overflow-hidden">
                                    {filteredDetections.map((det: any) => (
                                        <DetectionRow key={det.id} detection={det} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }


    // Original single detection view (Visual or Acoustic)
    const isVisual = !!selectedVisual;
    const data = (selectedVisual || selectedAcoustic)!;

    return (
        <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-[500] border-l border-slate-200 transform transition-transform duration-300 overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-2 ${isVisual ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700'}`}>
                        {isVisual ? <ImageIcon size={12} /> : <Mic size={12} />}
                        {isVisual ? 'Visual Detection' : 'Acoustic Event'}
                    </span>
                    <h2 className="text-xl font-bold text-slate-800">{data.species}</h2>
                    <p className="text-sm text-slate-500 font-mono mt-1">ID: {data.id}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Main Content */}
            <div className="p-6 space-y-6">

                {/* Media Preview */}
                <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    {isVisual ? (
                        <div className="relative aspect-video group cursor-pointer">
                            <img src={(data as VisualDetection).imageUrl} alt={data.species} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ExternalLink className="text-white" />
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 flex flex-col items-center justify-center gap-3">
                            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 animate-pulse">
                                <Activity size={32} />
                            </div>
                            <audio controls className="w-full h-8 mt-2" src={(data as AcousticDetection).audioUrl}></audio>
                        </div>
                    )}
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                            <Activity size={12} /> Confidence
                        </div>
                        <div className="font-semibold text-slate-700">{(data.confidence * 100).toFixed(1)}%</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                            <Calendar size={12} /> Timestamp
                        </div>
                        <div className="font-semibold text-slate-700 text-sm">{new Date(data.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                        <MapPin size={16} className="text-slate-400" />
                        <div className="text-sm text-slate-700 font-mono">{data.lat.toFixed(5)}, {data.lon.toFixed(5)}</div>
                    </div>
                    {/* Survey Info */}
                    {(data as any).survey_name && (
                        <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                            <Database size={16} className="text-slate-400" />
                            <div className="text-sm text-slate-700">
                                <span className="text-slate-500 text-xs mr-2">Survey:</span>
                                <span className="font-medium">{(data as any).survey_name}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Cross-Reference Results */}
                <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Ecological Correlation
                    </h3>

                    {correlations.length > 0 ? (
                        <div className="space-y-3">
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-800 flex gap-2">
                                <div className="mt-0.5">✨</div>
                                <div>
                                    <strong>Correlated Data Found</strong>
                                    <p className="opacity-80">Found {correlations.length} matching event(s) within range.</p>
                                </div>
                            </div>

                            {correlations.map((c, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors shadow-sm">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.type === 'visual' ? 'bg-teal-50 text-teal-600' : 'bg-orange-50 text-orange-600'}`}>
                                        {c.type === 'visual' ? <ImageIcon size={18} /> : <Mic size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-slate-800 text-sm truncate">{(c.data as any).species}</div>
                                        <div className="text-xs text-slate-500">{c.dist.toFixed(1)}m away • {((c.data.confidence) * 100).toFixed(0)}% Match</div>
                                    </div>
                                    <ExternalLink size={14} className="text-slate-300" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                            No correlated data found nearby.
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

// Compact Detection Row for List View
const DetectionRow: React.FC<{ detection: any }> = ({ detection }) => {
    return (
        <div className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors group">
            {/* Play Button or Icon */}
            <div className="shrink-0">
                {detection.audioUrl ? (
                    <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center cursor-pointer hover:bg-orange-200 transition-colors">
                        <PlayCircle size={16} />
                        {/* Note: In a real app, this would trigger a global player or play locally */}
                    </div>
                ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                        <Activity size={16} />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700 text-sm truncate">{detection.species}</span>
                    <span className="text-xs font-mono text-slate-400">{new Date(detection.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    {/* Confidence Bar */}
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${detection.confidence > 0.7 ? 'bg-emerald-500' : 'bg-orange-400'}`}
                            style={{ width: `${detection.confidence * 100}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-slate-400">{(detection.confidence * 100).toFixed(0)}%</span>
                </div>
            </div>

            {/* View Details Icon */}
            {detection.audioUrl && (
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <audio src={detection.audioUrl} className="w-20 h-6 hidden" controls />
                    {/* Hidden audio element ref could be used here */}
                </div>
            )}
        </div>
    );
};

// Detection Item Component
const DetectionItem: React.FC<{ detection: any, showSurvey?: boolean }> = ({ detection, showSurvey = true }) => {
    return (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-orange-300 transition-colors">
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <div className="font-medium text-slate-800 text-sm">{detection.species}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(detection.timestamp).toLocaleString()}
                    </div>
                </div>
                <div className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded">
                    {(detection.confidence * 100).toFixed(1)}%
                </div>
            </div>

            {detection.start_time !== undefined && (
                <div className="text-xs text-slate-500 mb-2">
                    {detection.start_time.toFixed(1)}s - {detection.end_time.toFixed(1)}s
                </div>
            )}

            {/* Audio Player */}
            {detection.audioUrl && (
                <audio
                    controls
                    className="w-full h-8 mt-2"
                    src={detection.audioUrl}
                    preload="none"
                >
                    Your browser does not support the audio element.
                </audio>
            )}

            {/* Image Preview (Visual) */}
            {detection.imageUrl && (
                <div className="mt-2 rounded overflow-hidden h-32 bg-slate-100 border border-slate-200 relative group cursor-pointer">
                    <img src={detection.imageUrl} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
            )}

            {showSurvey && detection.survey_name && (
                <div className="text-xs text-slate-400 mt-2">
                    Survey: {detection.survey_name}
                </div>
            )}
        </div>
    );
};

export default InspectorPanel;
