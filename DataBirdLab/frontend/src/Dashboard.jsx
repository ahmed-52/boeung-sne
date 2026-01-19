import React, { useEffect, useState, useMemo, useRef } from 'react';

import { WeeklyActivityChart, SpeciesDistributionChart } from './components/Charts';


import StatsCard from './components/StatsCard';
import UnifiedMap from './components/UnifiedMap';
import InspectorPanel from './components/InspectorPanel';
import DailyAcousticActivity from './components/DailyAcousticActivity';
import SpeciesActivityChart from './components/SpeciesActivityChart';
import NewSurveyModal from './components/NewSurveyModal';
import SettingsModal from './components/SettingsModal';
import FusionCard from './components/FusionCard';
import { fetchEcologicalData, fetchSurveys } from './mockData';
import { Bird, Activity, Database, Plus, RefreshCw, BarChart2, Zap, Map as MapIcon, Calendar, Filter, ChevronDown, Check, Upload, Settings } from 'lucide-react';
const Dashboard = () => {
    // ... state declarations remain same ... (lines 14-31)
    const [selectedVisual, setSelectedVisual] = useState(null);
    const [selectedAcoustic, setSelectedAcoustic] = useState(null);
    const [selectedARU, setSelectedARU] = useState(null); // New: track selected ARU
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);

    // Filter States
    const [filterMode, setFilterMode] = useState('7d'); // '7d', '30d'
    const [availableSurveys, setAvailableSurveys] = useState([]);
    const [selectedSurveyIds, setSelectedSurveyIds] = useState([]);
    const [isSurveyDropdownOpen, setIsSurveyDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsSurveyDropdownOpen(false);
            }
        };

        if (isSurveyDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSurveyDropdownOpen]);

    // Data State
    const [visualData, setVisualData] = useState([]);
    const [acousticData, setAcousticData] = useState([]);

    // Modal State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // ... useEffects remain same ... (lines 33-54)
    useEffect(() => {
        const loadSurveys = async () => {
            const surveys = await fetchSurveys();
            setAvailableSurveys(surveys);
        };
        loadSurveys();
    }, []);

    useEffect(() => {
        const loadData = async () => {
            const { visualDetections, acousticDetections } = await fetchEcologicalData(
                filterMode === '7d' ? 7 : 30,
                selectedSurveyIds
            );
            setVisualData(visualDetections);
            setAcousticData(acousticDetections);
        };
        loadData();
    }, [filterMode, selectedSurveyIds]);

    const toggleSurveySelection = (id) => {
        if (selectedSurveyIds.includes(id)) {
            setSelectedSurveyIds(selectedSurveyIds.filter(sid => sid !== id));
        } else {
            setSelectedSurveyIds([...selectedSurveyIds, id]);
        }
    };

    const handleSelectVisual = (d) => {
        setSelectedVisual(d);
        setSelectedAcoustic(null);
        setSelectedARU(null);
        setIsInspectorOpen(true);
    };

    const handleSelectAcoustic = (d) => {
        setSelectedAcoustic(d);
        setSelectedVisual(null);
        setSelectedARU(null);
        setIsInspectorOpen(true);
    };

    const [selectedSurvey, setSelectedSurvey] = useState(null); // New: track selected Survey

    const handleSelectARU = (aruData) => {
        // aruData should have: { id, lat, lon, detectionCount, aru_id }
        setSelectedARU(aruData);
        setSelectedVisual(null);
        setSelectedAcoustic(null);
        setSelectedSurvey(null);
        setIsInspectorOpen(true);

        // Auto-select most recent survey for this ARU if we have data loaded
        if (aruData.aru_id) {
            const relevantDetections = acousticData.filter(d => d.aru_id === aruData.aru_id);
            if (relevantDetections.length > 0) {
                const surveyIds = relevantDetections.map(d => d.survey_id).filter(id => id !== undefined);
                if (surveyIds.length > 0) {
                    const maxId = Math.max(...surveyIds);
                    // Only switch if we found a valid ID and it's different (to trigger update)
                    // But setting it to single ID is what we want
                    setSelectedSurveyIds([maxId]);
                }
            }
        }
    };

    const handleSelectSurvey = (survey) => {
        setSelectedSurvey(survey);
        setSelectedVisual(null);
        setSelectedAcoustic(null);
        setSelectedARU(null);
        setIsInspectorOpen(true);
    };

    const handleCloseInspector = () => {
        setIsInspectorOpen(false);
        setSelectedVisual(null);
        setSelectedAcoustic(null);
        setSelectedARU(null);
        setSelectedSurvey(null);
    };

    // Calculate Overview Stats from Real Data
    const uniqueSpecies = new Set([
        ...visualData.map(d => d.species),
        ...acousticData.map(d => d.species)
    ]).size;

    const totalDetections = visualData.length + acousticData.length;

    // derived chart data
    const chartData = useMemo(() => {
        if (selectedARU && selectedARU.aru_id) {
            return acousticData.filter(d => d.aru_id === selectedARU.aru_id);
        }
        return [...visualData, ...acousticData];
    }, [visualData, acousticData, selectedARU]);

    const handleUploadComplete = async (data) => {
        console.log('Upload complete:', data);
        // Reload surveys
        const surveys = await fetchSurveys();
        setAvailableSurveys(surveys);
        // Reload data
        const { visualDetections, acousticDetections } = await fetchEcologicalData(
            filterMode === '7d' ? 7 : 30,
            selectedSurveyIds
        );
        setVisualData(visualDetections);
        setAcousticData(acousticDetections);
    };



    return (
        <div className="min-h-screen pb-20 bg-[#F1F5F9]">
            <NewSurveyModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadComplete={handleUploadComplete}
            />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
            <InspectorPanel
                isOpen={isInspectorOpen}
                onClose={handleCloseInspector}
                selectedVisual={selectedVisual}
                selectedAcoustic={selectedAcoustic}
                selectedARU={selectedARU}
                selectedSurvey={selectedSurvey}
                filterDays={filterMode === '7d' ? 7 : 30}
                selectedSurveyIds={selectedSurveyIds}
            />

            {/* Header (Integrated directly here to include state controls) */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        {/* Logo Area */}
                        <div className="flex items-center gap-3">
                            <img src="/databird.png" alt="DataBirdLab" className="h-8 w-auto" />
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">
                                DataBird<span className="font-extralight text-slate-400">Lab</span>
                            </h1>
                        </div>

                        <div className="h-8 w-px bg-slate-200"></div>

                        {/* Survey Filter Dropdown (Moved to Left) */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsSurveyDropdownOpen(!isSurveyDropdownOpen)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <Filter size={14} className="text-slate-400" />
                                <span>{selectedSurveyIds.length > 0 ? `${selectedSurveyIds.length} Surveys` : 'All Surveys'}</span>
                                <ChevronDown size={14} className="text-slate-400" />
                            </button>

                            {isSurveyDropdownOpen && (
                                <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl py-2 z-50 max-h-96 overflow-y-auto">
                                    <div className="px-4 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                        <span>Filter by Survey</span>
                                        {selectedSurveyIds.length > 0 && (
                                            <span
                                                onClick={() => setSelectedSurveyIds([])}
                                                className="text-teal-600 cursor-pointer hover:underline text-[10px] normal-case"
                                            >
                                                Clear All
                                            </span>
                                        )}
                                    </div>
                                    {availableSurveys.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-slate-400 italic">No surveys found</div>
                                    ) : (
                                        availableSurveys.map(survey => (
                                            <div
                                                key={survey.id}
                                                onClick={() => toggleSurveySelection(survey.id)}
                                                className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {/* Type Badge */}
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${survey.type === 'drone' ? 'bg-teal-500' : 'bg-orange-500'}`}></span>
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-medium ${selectedSurveyIds.includes(survey.id) ? 'text-teal-700' : 'text-slate-700'}`}>
                                                            {survey.name}
                                                            {survey.aru && (
                                                                <span className="ml-2 text-xs text-orange-600 font-normal">
                                                                    @ {survey.aru.name}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <span className="text-xs text-slate-400">
                                                            {new Date(survey.date).toLocaleDateString()}
                                                            <span className={`ml-2 ${survey.type === 'drone' ? 'text-teal-500' : 'text-orange-500'}`}>
                                                                {survey.type === 'drone' ? '🛸 Drone' : '🎙 Acoustic'}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                                {selectedSurveyIds.includes(survey.id) && (
                                                    <Check size={16} className="text-teal-600" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setFilterMode('7d')}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filterMode === '7d' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setFilterMode('30d')}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${filterMode === '30d' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                30 Days
                            </button>
                        </div>

                        <div className="h-8 w-px bg-slate-200 mx-1"></div>

                        {/* Settings Button */}
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="System Settings"
                        >
                            <Settings size={20} />
                        </button>

                        {/* Upload Button */}
                        <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-teal-500/20 transition-all"
                        >
                            <Upload size={16} />
                            <span>New Survey</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-10 px-6 py-6 max-w-[1920px] mx-auto space-y-6">

                {/* Controls Row - Simplified */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Boeung Sne Colony</h1>
                        <p className="text-sm text-slate-500">Merged Ecological Monitoring</p>
                    </div>
                </div>

                {/* Top Section Layout */}
                <div className="grid grid-cols-12 gap-6 h-auto items-start">

                    {/* Left: Unified Map & Species Charts */}
                    <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                        {/* Map Container */}
                        <div className="h-[600px] glass-card rounded-2xl overflow-hidden relative shadow-sm border border-slate-200">
                            <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 pointer-events-none">
                                <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                                    <MapIcon size={12} className="text-orange-500" />
                                    Visual + Acoustic Map
                                </h3>
                            </div>
                            <UnifiedMap
                                visualDetections={visualData}
                                acousticDetections={acousticData}
                                onSelectVisual={handleSelectVisual}
                                onSelectAcoustic={handleSelectAcoustic}
                                onSelectARU={handleSelectARU}
                                onSelectSurvey={handleSelectSurvey}
                                surveys={selectedSurveyIds.length > 0
                                    ? availableSurveys.filter(s => selectedSurveyIds.includes(s.id))
                                    : availableSurveys
                                }
                            />
                        </div>

                        {/* Fusion Analysis Card */}
                        <FusionCard
                            droneSurveys={availableSurveys.filter(s => s.type === 'drone')}
                            acousticSurveys={availableSurveys.filter(s => s.type === 'acoustic')}
                        />

                        {/* Species Charts Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Species Acoustic History */}
                            <div className="h-[300px] glass-card rounded-xl p-0 shadow-sm border border-slate-200 overflow-hidden">
                                <SpeciesActivityChart type="acoustic" title="Acoustic Detections by Species" />
                            </div>

                            {/* Species Drone History */}
                            <div className="h-[300px] glass-card rounded-xl p-0 shadow-sm border border-slate-200 overflow-hidden">
                                <SpeciesActivityChart type="visual" title="Drone Counts by Species" />
                            </div>
                        </div>
                    </div>

                    {/* Right: Stats Grid & Charts */}
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">

                        {/* Key Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <StatsCard
                                title="Unique Species"
                                value={uniqueSpecies.toString()}
                                icon={Bird}
                            />
                            <StatsCard
                                title="Total Detections"
                                value={totalDetections.toString()}
                                icon={BarChart2}
                            />
                        </div>

                        {/* Charts */}
                        <div className="h-[250px] glass-card rounded-xl p-1 shadow-sm border border-slate-200 overflow-hidden">
                            <WeeklyActivityChart days={7} visualDetections={chartData} />
                        </div>
                        <div className="h-[250px] glass-card rounded-xl p-1 shadow-sm border border-slate-200 overflow-hidden">
                            <SpeciesDistributionChart days={7} visualDetections={chartData} />
                        </div>
                        <div className="h-[300px] glass-card rounded-xl p-0 shadow-sm border border-slate-200 overflow-hidden">
                            <DailyAcousticActivity
                                surveyId={selectedSurveyIds.length > 0
                                    ? selectedSurveyIds[0]
                                    : (availableSurveys.length > 0 ? availableSurveys[0].id : 0)
                                }
                            />
                        </div>

                        {/* Species Drone History - Removed from here */}
                    </div>
                </div>

            </main>
        </div>
    );
};

export default Dashboard;
