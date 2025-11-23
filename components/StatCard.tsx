import React from 'react';
import { StatCardProps } from '../types';

export const StatCard: React.FC<StatCardProps> = ({ title, value, unit, icon: Icon, colorClass }) => (
    <div className={`p-4 rounded-xl shadow-lg ${colorClass} text-white`}>
        <div className="flex items-center space-x-3 mb-2">
            <Icon className="w-6 h-6" />
            <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-3xl font-extrabold">{value}</p>
        {unit && <p className="text-sm opacity-80">{unit}</p>}
    </div>
);
