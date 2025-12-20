import React from 'react';

const Header = () => {
    return (
        <header className="w-full h-20 px-8 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-200 z-50 sticky top-0 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-3">
                <div className="w-14 h-14 flex items-center justify-center">
                    <img src="/databird.png" alt="DataBird" className="w-14 h-14 object-contain" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">DataBird</h1>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-sm font-semibold text-emerald-700">Online</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-databird-orange hover:bg-orange-50 hover:border-orange-200 transition-all cursor-pointer shadow-sm">
                    <span className="font-bold text-sm">AH</span>
                </div>
            </div>
        </header>
    );
};

export default Header;
