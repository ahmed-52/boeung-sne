import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import { WeeklyActivityChart, SpeciesDistributionChart, VocalActivityChart } from './components/Charts';

import StatsCard from './components/StatsCard';
import ColonyMap from './components/ColonyMap';
import NewSurveyModal from './components/NewSurveyModal';
import { Bird, Activity, Database, Plus, RefreshCw, BarChart2, Zap, Map as MapIcon, Calendar, Filter } from 'lucide-react';

const Dashboard = () => {
    const [surveys, setSurveys] = useState([]);

    // Filter States
    const [filterMode, setFilterMode] = useState('7d'); // '7d', '30d', 'custom'
    const [selectedSurveyId, setSelectedSurveyId] = useState('all'); // 'all' or specific ID

    const [overviewStats, setOverviewStats] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchSurveys = async () => {
        try {
            const res = await fetch('/api/surveys');
            if (res.ok) {
                const data = await res.json();
                setSurveys(data);
            }
        } catch (e) { console.error(e) }
    };

    const fetchOverview = async () => {
        try {
            // Construct Query
            const params = new URLSearchParams();

            if (filterMode === '7d') params.append('days', 7);
            if (filterMode === '30d') params.append('days', 30);

            if (selectedSurveyId !== 'all') params.append('survey_id', selectedSurveyId);

            const res = await fetch(`/api/stats/overview?${params.toString()}`);
            if (res.ok) setOverviewStats(await res.json());
        } catch (e) { console.error(e) }
    }

    // Effect to re-fetch when filters change
    useEffect(() => {
        fetchSurveys();
    }, []);

    useEffect(() => {
        fetchOverview();
    }, [filterMode, selectedSurveyId]);


    // Helper to filter surveys for map
    const getFilteredSurveysForMap = () => {
        if (selectedSurveyId !== 'all') {
            return surveys.filter(s => s.id === parseInt(selectedSurveyId));
        }
        // If 'all', filter by date logic? 
        // For map coverage, it's nice to see all relevant to the time window.
        // E.g. last 7 days.
        const cutoff = new Date();
        if (filterMode === '7d') cutoff.setDate(cutoff.getDate() - 7);
        else if (filterMode === '30d') cutoff.setDate(cutoff.getDate() - 30);
        else cutoff.setFullYear(2000); // Filter ALL time basically

        return surveys.filter(s => new Date(s.date) >= cutoff);
    }

    const filteredSurveys = getFilteredSurveysForMap();

    // Helper for Days Prop
    const getDaysProp = () => {
        if (filterMode === '30d') return 30;
        return 7;
    }

    // Helper for SurveyId Prop
    const getSurveyIdProp = () => {
        return selectedSurveyId === 'all' ? null : parseInt(selectedSurveyId);
    }

    return (
        <div className="min-h-screen pb-20 bg-[#F1F5F9]">
            <NewSurveyModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onUploadComplete={fetchSurveys} />
            <div className="max-w-[1920px] mx-auto">
                <Header />
            </div>

            <main className="relative z-10 px-6 py-6 max-w-[1920px] mx-auto space-y-6">

                {/* Controls Row */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Boeung Sne Colony</h1>
                        <p className="text-sm text-slate-500">Live Environmental Monitoring Dashboard</p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {/* Time Filter */}
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-1 flex items-center">
                            <button
                                onClick={() => setFilterMode('7d')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filterMode === '7d' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Last 7 Days
                            </button>
                            <button
                                onClick={() => setFilterMode('30d')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filterMode === '30d' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Last 30 Days
                            </button>
                        </div>

                        {/* Survey Filter */}
                        <div className="relative">
                            <select
                                value={selectedSurveyId}
                                onChange={(e) => setSelectedSurveyId(e.target.value)}
                                className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-databird-orange focus:border-transparent outline-none shadow-sm appearance-none cursor-pointer hover:bg-slate-50 transition-colors min-w-[200px]"
                            >
                                <option value="all">All Surveys</option>
                                {surveys.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({new Date(s.date).toLocaleDateString()})</option>
                                ))}
                            </select>
                            <Filter className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-sm transition-all"
                        >
                            <Plus size={18} /> New Survey
                        </button>
                    </div>
                </div>

                {/* Top Section Layout */}
                <div className="grid grid-cols-12 gap-6 h-[500px]">

                    {/* Left: Fixed Map */}
                    <div className="col-span-12 lg:col-span-5 glass-card rounded-2xl overflow-hidden relative shadow-sm border border-slate-200">
                        <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm border border-slate-200 pointer-events-none">
                            <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                                <MapIcon size={12} className="text-orange-500" />
                                Survey Coverage
                            </h3>
                        </div>
                        <ColonyMap surveys={filteredSurveys} />
                    </div>

                    {/* Right: Stats Grid & Charts */}
                    <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">

                        {/* 4 Key Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatsCard
                                title="Area Monitored"
                                value={overviewStats?.storage_used || "0 ha"}
                                icon={MapIcon}
                            />
                            <StatsCard
                                title="Unique Species"
                                value={overviewStats?.unique_species?.toString() || "0"}
                                // change="Stable" isPositive={true} 
                                icon={Bird}
                            />
                            <StatsCard
                                title="Total Count"
                                value={overviewStats?.total_detections?.toLocaleString() || "0"}
                                icon={BarChart2}
                            />
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-2 gap-6 flex-1 h-full min-h-0">
                            <div className="glass-card rounded-xl p-1 shadow-sm border border-slate-200 overflow-hidden">
                                <WeeklyActivityChart days={getDaysProp()} surveyId={getSurveyIdProp()} />
                            </div>
                            <div className="glass-card rounded-xl p-1 shadow-sm border border-slate-200 overflow-hidden">
                                <SpeciesDistributionChart days={getDaysProp()} surveyId={getSurveyIdProp()} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Recent List & Vocal Placeholder */}
                <div className="grid grid-cols-12 gap-6 h-[300px]">
                    <div className="col-span-12 lg:col-span-8 glass-card rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* <RecentDetections /> */}
                    </div>
                    <div className="col-span-12 lg:col-span-4 glass-card rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <VocalActivityChart days={getDaysProp()} surveyId={getSurveyIdProp()} />
                    </div>
                </div>

            </main>
        </div>
    );
};

export default Dashboard;
