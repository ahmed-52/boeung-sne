import React from 'react';

const StatsCard = ({ title, value, icon: Icon, trend }) => {
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
                {trend && (
                    <p className={`text-xs font-medium mt-2 flex items-center ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                        <span className="text-slate-400 ml-1 font-normal">vs last week</span>
                    </p>
                )}
            </div>
            <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                {Icon && <Icon size={20} />}
            </div>
        </div>
    );
};

export default StatsCard;
