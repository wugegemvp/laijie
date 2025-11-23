import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { db } from '../services/firebase';
import { ModalWrapper } from './ModalWrapper';
import { Debt } from '../types';

interface RepaymentModalProps {
    show: boolean;
    onClose: () => void;
    debt: Debt;
    userId: string;
    appId: string;
}

export const RepaymentModal: React.FC<RepaymentModalProps> = ({ show, onClose, debt, userId, appId }) => {
    const [repaidAmount, setRepaidAmount] = useState('');
    const [memo, setMemo] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (show) {
            setRepaidAmount('');
            setMemo('');
            setError('');
            setIsLoading(false);
        }
    }, [show]);

    const isNumericDebt = typeof debt.quantity === 'number';
    // If debt.repaid is a string (for non-numeric), treat as 0 for calculation purposes
    const repaidNum = typeof debt.repaid === 'number' ? debt.repaid : 0;
    const remaining = isNumericDebt && debt.quantity !== null ? debt.quantity - repaidNum : 0;
    
    if (show && debt.isPaid) {
        return (
            <ModalWrapper show={show} onClose={onClose} title={`记录 ${debt.debtorName} 的偿还进度`}>
                <div className="p-6 text-center text-green-700">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4" />
                    <p className="font-bold text-xl">已还清</p>
                    <p className="text-gray-600 mt-2">这笔欠酒记录已标记为完全还清，无需继续记录。</p>
                </div>
            </ModalWrapper>
        );
    }
    
    const handleRepay = async () => {
        if (!db) return;
        setError('');
        setIsLoading(true);

        const parsedRepaid = parseFloat(repaidAmount);
        
        if (!isNumericDebt) {
            if (!memo.trim()) {
                setError('非数字记录需要填写备注/详情。');
                setIsLoading(false);
                return;
            }
            await recordRepayment(repaidAmount, memo, true);
        } else {
            if (isNaN(parsedRepaid) || parsedRepaid <= 0) {
                setError('请输入有效的偿还数量。');
                setIsLoading(false);
                return;
            }
            if (parsedRepaid > remaining) {
                setError(`偿还数量不能超过剩余欠款 ${remaining} ${debt.unit || '单位'}。`);
                setIsLoading(false);
                return;
            }
            await recordRepayment(parsedRepaid, memo, parsedRepaid === remaining);
        }
        
        setIsLoading(false);
        onClose();
    };

    const recordRepayment = async (amount: number | string, detail: string, markPaid = false) => {
        if (!db) return;
        try {
            const repaymentRef = collection(db, 'artifacts', appId, 'users', userId, 'repayments');
            await addDoc(repaymentRef, {
                debtId: debt.id,
                debtorName: debt.debtorName,
                amount: amount,
                memo: detail,
                isFullRepayment: markPaid,
                recordedAt: serverTimestamp(),
                recordedBy: userId
            });

            const debtRef = doc(db, 'artifacts', appId, 'users', userId, 'debts', debt.id);
            let updatePayload: any = {};

            if (isNumericDebt) {
                updatePayload.repaid = (typeof debt.repaid === 'number' ? debt.repaid : 0) + (typeof amount === 'number' ? amount : 0);
                if (markPaid) {
                    updatePayload.isPaid = true;
                }
            } else {
                updatePayload.isPaid = true;
                updatePayload.repaid = `已处理: ${amount} | ${detail}`;
            }

            await updateDoc(debtRef, updatePayload);

        } catch (e: any) {
            console.error("记录偿还失败:", e);
            setError(`记录失败: ${e.message}`);
        }
    };
    
    const handleMarkFullPaid = async () => {
        if (!db) return;
        setError('');
        setIsLoading(true);
        if (isNumericDebt) {
            const amountToRepay = remaining;
            const detail = '一键标记为完全还清。';
            await recordRepayment(amountToRepay, detail, true);
        } else {
            try {
                const debtRef = doc(db, 'artifacts', appId, 'users', userId, 'debts', debt.id);
                await updateDoc(debtRef, { isPaid: true });
            } catch (e: any) {
                console.error("标记已还清失败:", e);
                setError(`标记失败: ${e.message}`);
            }
        }
        setIsLoading(false);
        onClose();
    };

    const RepaymentInfo = () => (
        <div className="bg-indigo-50 p-4 rounded-lg mb-4">
            <h3 className="text-lg font-bold text-indigo-700 border-b pb-2 mb-2">记录的偿还进度</h3>
            <div className="flex justify-between text-gray-700">
                <span className="font-medium">最初欠酒:</span>
                <span className="font-semibold text-indigo-900">{debt.quantityText}</span>
            </div>
            <div className="flex justify-between text-gray-700">
                <span className="font-medium">已偿还:</span>
                <span className="font-semibold text-green-600">
                    {isNumericDebt ? `${debt.repaid || 0} ${debt.unit || '单位'}` : 'N/A'}
                </span>
            </div>
            <div className="flex justify-between text-gray-700 text-xl font-bold mt-2">
                <span className="font-medium text-red-600">当前剩余欠酒:</span>
                <span className="text-red-600">
                    {isNumericDebt ? `${remaining} ${debt.unit || '单位'}` : '非数字记录'}
                </span>
            </div>
            
            {isNumericDebt && debt.quantity && (
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-3">
                    <div 
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${((repaidNum || 0) / debt.quantity) * 100}%` }}
                    ></div>
                </div>
            )}
        </div>
    );
    
    return (
        <ModalWrapper show={show} onClose={onClose} title={`记录 ${debt.debtorName} 的偿还进度`}>
            {RepaymentInfo()}

            <div className="space-y-4 p-4">
                {isNumericDebt ? (
                    <>
                        <label className="block text-sm font-bold text-gray-700">本次偿还数量 ({debt.unit || '单位'})</label>
                        <input
                            type="number"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                            value={repaidAmount}
                            onChange={(e) => setRepaidAmount(e.target.value)}
                            placeholder={`例如: 还了 2 ${debt.unit || '单位'}`}
                            min="0.01"
                            step="0.01"
                            required
                        />
                        <p className="text-xs text-gray-500">
                            提示: 若输入值与**当前剩余欠酒**完全一致，将自动标记为**已还清**。
                        </p>

                        <button
                            onClick={handleMarkFullPaid}
                            className="w-full py-2 rounded-lg text-white font-bold transition duration-300 bg-green-600 hover:bg-green-700 shadow-md"
                            disabled={isLoading || remaining === 0}
                        >
                            一键标记为完全偿还 ({remaining} {debt.unit || '单位'})
                        </button>
                    </>
                ) : (
                    <div className="p-3 bg-yellow-100 rounded-lg text-yellow-800">
                        <p className="font-bold">非数字记录：</p>
                        <p className="text-sm">该记录没有可追踪的数字进度，请在下方备注/详情中记录偿还情况，并点击“确认记录偿还”将其标记为**已还清**。</p>
                    </div>
                )}
                
                <label className="block text-sm font-bold text-gray-700">偿还详情 / 备注</label>
                <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                    rows={3}
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="例如: 请客吃了火锅"
                    required={!isNumericDebt}
                />
            </div>
            
            {error && (
                <div className="text-sm text-red-600 bg-red-100 p-3 rounded-lg flex items-center mt-4">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {error}
                </div>
            )}

            <div className="flex justify-end space-x-3 p-4 border-t mt-4">
                <button
                    onClick={onClose}
                    className="py-2 px-4 rounded-lg text-gray-600 hover:bg-gray-100 transition"
                    disabled={isLoading}
                >
                    取消
                </button>
                <button
                    onClick={handleRepay}
                    className={`py-2 px-4 rounded-lg text-white font-bold transition duration-300 ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-700 hover:bg-indigo-800'}`}
                    disabled={isLoading || (isNumericDebt && (!repaidAmount || remaining === 0)) || (!isNumericDebt && !memo.trim())}
                >
                    {isLoading ? '记录中...' : '确认记录偿还'}
                </button>
            </div>
        </ModalWrapper>
    );
};
