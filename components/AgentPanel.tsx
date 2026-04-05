'use client';

import React, { useState } from 'react';
import { X, Bot, Lock } from 'lucide-react';

const AgentPanel: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="absolute top-1/2 right-0 -translate-y-1/2 z-50 bg-white text-blue-600 p-2 pl-3 rounded-l-xl shadow-lg hover:shadow-xl hover:bg-blue-50 transition-all border border-gray-200 border-r-0 group"
                    title="Open Agent"
                >
                    <img src="/agent-logo.png" alt="Agent" className="w-5 h-5 rounded object-cover group-hover:scale-110 transition-transform" />
                </button>
            )}

            {/* Panel */}
            <div
                className={`bg-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col border-l border-gray-200 h-full flex-shrink-0`}
                style={{
                    width: isOpen ? '350px' : '0px',
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'auto' : 'none',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <img src="/agent-logo.png" alt="Agent" className="w-8 h-8 rounded-full object-cover" />
                        <span className="font-semibold text-gray-800">Agent</span>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Coming Soon */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <img src="/agent-logo.png" alt="Agent" className="w-16 h-16 rounded-2xl object-cover mb-5" />
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">功能开发中</h3>
                    <p className="text-sm text-gray-500 leading-relaxed max-w-[240px]">
                        Agent 功能正在紧锣密鼓地开发中，后续版本将会开放，敬请期待。
                    </p>
                </div>
            </div>
        </>
    );
};

export default AgentPanel;
