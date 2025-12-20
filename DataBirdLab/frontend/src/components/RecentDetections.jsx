import React from 'react';
import { Feather, Clock, MoreHorizontal } from 'lucide-react';

const detections = [
    { id: 1, species: 'Black-capped Chickadee', time: '2 mins ago', confidence: 0.98, image: null },
    { id: 2, species: 'Blue Jay', time: '15 mins ago', confidence: 0.92, image: null },
    { id: 3, species: 'Northern Cardinal', time: '1 hour ago', confidence: 0.88, image: null },
    { id: 4, species: 'American Robin', time: '3 hours ago', confidence: 0.95, image: null },
    { id: 5, species: 'Song Sparrow', time: '4 hours ago', confidence: 0.89, image: null },
];

const RecentDetections = () => {
    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-slate-800 text-lg font-semibold tracking-tight">Recent Detections</h3>
                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                    <MoreHorizontal size={18} />
                </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {detections.map((det) => (
                    <div key={det.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-md transition-all group cursor-pointer">
                        <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-databird-orange shadow-sm">
                            {/* Placeholder for bird image or icon */}
                            <Feather size={20} />
                        </div>

                        <div className="flex-1">
                            <h4 className="font-semibold text-slate-800 group-hover:text-databird-orange transition-colors duration-200">{det.species}</h4>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock size={12} /> {det.time}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-100 font-medium">
                                    {(det.confidence * 100).toFixed(0)}% Conf
                                </span>
                            </div>
                        </div>

                        <div className="w-1.5 h-1.5 rounded-full bg-databird-orange opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RecentDetections;
