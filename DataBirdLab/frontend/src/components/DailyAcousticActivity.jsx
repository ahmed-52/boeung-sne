import React, { useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Activity } from 'lucide-react';

const DailyAcousticActivity = ({ surveyId }) => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!surveyId) return;

        setLoading(true);
        fetch(`http://localhost:8000/api/acoustic/activity/hourly?survey_id=${surveyId}`)
            .then(res => res.json())
            .then(setData)
            .catch(err => console.error("Failed to fetch acoustic activity:", err))
            .finally(() => setLoading(false));
    }, [surveyId]);

    return (
        <div className="w-full h-full flex flex-col">
            <div className="px-4 pt-3 mb-1 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-700">24h Acoustic Activity</h3>
                <Activity size={14} className="text-orange-500" />
            </div>

            <div className="flex-1 min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-xs text-slate-400">Loading...</div>
                ) : data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <XAxis
                                dataKey="label"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                interval={3}
                                tick={{ fill: '#94a3b8' }}
                            />
                            <YAxis
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#94a3b8' }}
                            />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill="#f97316" fillOpacity={0.6 + (entry.count / Math.max(...data.map(d => d.count)) * 0.4)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-xs text-slate-400">
                        No acoustic data available
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyAcousticActivity;
