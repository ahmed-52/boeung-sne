import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';

export const VocalActivityChart = ({ days, surveyId }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchAcoustic = async () => {
            try {
                const params = new URLSearchParams({ days });
                if (surveyId) params.append("survey_id", surveyId);

                const res = await fetch(`/api/stats/acoustic?${params.toString()}`);
                if (res.ok) {
                    const stats = await res.json();
                    setData(stats);
                }
            } catch (e) { console.error(e) }
        };
        fetchAcoustic();
    }, [days, surveyId]);

    if (!data || data.length === 0) {
        return (
            <div className="w-full h-full p-6 flex flex-col">
                <h3 className="text-slate-800 text-lg font-semibold tracking-tight mb-4">Acoustic Activity</h3>
                <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <span className="text-slate-400 text-sm">No acoustic data found</span>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full h-full p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-slate-800 text-lg font-semibold tracking-tight">Acoustic Class Distribution</h3>
            </div>
            <div className="w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} stroke="#64748b" />
                        <Tooltip cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const WeeklyActivityChart = ({ days, surveyId }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const params = new URLSearchParams({ days });
                if (surveyId) params.append("survey_id", surveyId);

                const res = await fetch(`/api/stats/daily?${params.toString()}`);
                if (res.ok) setData(await res.json());
            } catch (e) {
                console.error("Failed to fetch daily stats", e);
            }
        };
        fetchStats();
    }, [days, surveyId]);

    return (
        <div className="w-full h-full p-6 flex flex-col">
            <h3 className="text-slate-800 text-lg font-semibold tracking-tight mb-4">Detection Trend</h3>
            <div className="w-full flex-1 min-h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F2994A" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#F2994A" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            cursor={{ stroke: '#cbd5e1' }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#F2994A" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const SpeciesDistributionChart = ({ days, surveyId }) => {
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchSpecies = async () => {
            try {
                const params = new URLSearchParams({ days });
                if (surveyId) params.append("survey_id", surveyId);

                const res = await fetch(`/api/stats/species?${params.toString()}`);
                if (res.ok) {
                    const stats = await res.json();
                    setData(stats.slice(0, 5));
                }
            } catch (e) { console.error(e) }
        };
        fetchSpecies();
    }, [days, surveyId]);

    const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899'];

    return (
        <div className="w-full h-full p-6 flex flex-col">
            <h3 className="text-slate-800 text-lg font-semibold tracking-tight mb-2">Species Distribution</h3>
            <div className="w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
