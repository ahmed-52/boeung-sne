import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatsCard = ({ title, value, change, isPositive, icon: Icon, label }) => {
    return (
        <div className="glass-card p-6 rounded-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity text-slate-900">
                {Icon && <Icon size={48} />}
            </div>

            <h3 className="text-slate-500 text-sm font-medium uppercase tracking-wide mb-2">{title}</h3>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{value}</span>
                {label && <span className="text-sm text-slate-400 font-medium">{label}</span>}
            </div>

            {change && (
                <div className={`flex items-center gap-1 mt-4 text-sm ${isPositive ? 'text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full' : 'text-rose-600 bg-rose-50 w-fit px-2 py-0.5 rounded-full'}`}>
                    {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    <span className="font-semibold">{change}</span>
                    <span className="text-slate-500 ml-1 font-normal">vs last week</span>
                </div>
            )}
        </div>
    );
};

export default StatsCard;
