import React from 'react';
import { Trash2 } from 'lucide-react';
import { Debt } from '../types';

interface DebtItemProps {
    debt: Debt;
    onDelete: (id: string) => void;
    onTogglePaid: (id: string, status: boolean) => void;
    onRepay: (debt: Debt) => void;
}

export const DebtItem: React.FC<DebtItemProps> = ({ debt, onDelete, onTogglePaid, onRepay }) => {
    const remaining = debt.remaining !== null ? debt.remaining : 'N/A';
    // Ensure repaid is treated as number for progress calculation
    const repaidVal = typeof debt.repaid === 'number' ? debt.repaid : 0;
    const progress = debt.quantity !== null && debt.quantity > 0 ? (repaidVal / debt.quantity) * 100 : 0;
    const isNumeric = debt.isNumeric;
    
    return (
        <div className={`p-4 rounded-xl shadow-lg transition duration-300 mb-4 ${debt.isPaid ? 'bg-green-50 border-2 border-green-200' : 'bg-white border-2 border-red-200 hover:shadow-xl'}`}>
            <div className="flex justify-between items-start mb-2">
                <h3 className={`text-xl font-extrabold ${debt.isPaid ? 'text-green-700' : 'text-red-700'}`}>
                    {debt.debtorName}: <span className="text-gray-900 font-semibold">{debt.quantityText}</span>
                </h3>
                <div className="flex space-x-2 items-center">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${debt.isPaid ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
                        {debt.isPaid ? '已还清' : '未还清'}
                    </span>
                    <Trash2 
                        className="w-5 h-5 text-gray-400 hover:text-red-500 cursor-pointer transition" 
                        onClick={() => onDelete(debt.id)}
                        title="删除记录"
                    />
                </div>
            </div>

            <p className="text-sm text-gray-500">发生日期: {debt.recordDate}</p>
            <p className="text-sm text-gray-500 mb-3">记录人ID: {debt.recorderId ? debt.recorderId.substring(0, 10) : 'Unknown'}</p>

            {isNumeric && (
                <>
                    <div className="flex justify-between text-sm font-semibold mt-1">
                        <span className="text-red-600">还欠余额: {remaining} / {debt.quantity} {debt.unit}</span>
                        <span className="text-gray-600">已还: {debt.repaid} {debt.unit}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 my-2">
                        <div 
                            className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </>
            )}
            
            {!debt.isPaid ? (
                <button
                    onClick={() => onRepay(debt)}
                    className="w-full mt-3 py-2 rounded-lg text-white font-bold transition duration-300 bg-indigo-600 hover:bg-indigo-700 shadow-md"
                >
                    记录偿还进度
                </button>
            ) : (
                <button
                    onClick={() => onTogglePaid(debt.id, true)}
                    className="w-full mt-3 py-2 rounded-lg text-gray-700 font-bold transition duration-300 bg-gray-200 hover:bg-gray-300"
                >
                    标记为未还清
                </button>
            )}
        </div>
    );
};
