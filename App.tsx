import React, { useState, useEffect, useMemo } from 'react';
import { 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged,
    signOut,
    User
} from 'firebase/auth';
import { 
    collection, 
    query, 
    onSnapshot, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    doc,
    serverTimestamp
} from 'firebase/firestore';
import { 
    BarChart2, 
    Plus, 
    CheckCircle, 
    Maximize2, 
    Clock, 
    User as UserIcon, 
    LogOut 
} from 'lucide-react';

import { auth, db, appId, initialAuthToken, ensureUserProfile } from './services/firebase';
import { AuthModal } from './components/AuthModal';
import { RepaymentModal } from './components/RepaymentModal';
import { DebtItem } from './components/DebtItem';
import { StatCard } from './components/StatCard';
import { Debt, Statistics } from './types';

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [newDebt, setNewDebt] = useState({
        date: new Date().toISOString().substring(0, 10),
        debtorName: '',
        quantityInput: '',
    });
    const [showRepaymentModal, setShowRepaymentModal] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
    const [notification, setNotification] = useState({ message: '', type: '' });

    // Notification helper
    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification({ message: '', type: '' }), 3000);
    };

    // Firebase Auth Listener
    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                console.log("[Auth] User signed in:", currentUser.uid);
                if (!currentUser.isAnonymous) {
                    try {
                        await ensureUserProfile(currentUser.uid, currentUser.email || 'N/A');
                        setUser(currentUser);
                    } catch (e: any) {
                         console.error("[Auth] Forced sign out due to profile error:", e.message);
                         await signOut(auth);
                         setUser(null);
                         setShowAuthModal(true);
                    }
                } else {
                    setUser(currentUser);
                    setShowAuthModal(true); 
                }
            } else {
                console.log("[Auth] User signed out.");
                setUser(null);
                
                // Try initial anonymous login or custom token
                if (!authReady) {
                    if (initialAuthToken) {
                         try {
                            const userCredential = await signInWithCustomToken(auth, initialAuthToken);
                            await ensureUserProfile(userCredential.user.uid, userCredential.user.email || 'N/A');
                            setUser(userCredential.user);
                        } catch (e) {
                            console.error("[Auth] Custom token login failed:", e);
                            try {
                                const userCredential = await signInAnonymously(auth);
                                await ensureUserProfile(userCredential.user.uid, userCredential.user.email || 'N/A');
                                setUser(userCredential.user);
                            } catch (anonErr) {
                                console.error("[Auth] Anonymous sign in failed:", anonErr);
                                setShowAuthModal(true);
                            }
                        }
                    } else {
                        try {
                            const userCredential = await signInAnonymously(auth);
                            await ensureUserProfile(userCredential.user.uid, userCredential.user.email || 'N/A');
                            setUser(userCredential.user);
                        } catch (e) {
                            console.error("[Auth] Anonymous sign in failed:", e);
                            setShowAuthModal(true);
                        }
                    }
                } else {
                    setShowAuthModal(true);
                }
            }
            setAuthReady(true);
        });
        return () => unsubscribe();
    }, [authReady]);

    const handleAuthSuccess = (user: User) => {
        if (user.isAnonymous) {
            setShowAuthModal(true);
        } else {
            setShowAuthModal(false);
        }
    };
    
    const handleLogout = async () => {
        if (auth) {
            await signOut(auth);
            setDebts([]);
        }
    };

    // Firestore Listener
    useEffect(() => {
        if (!user || user.isAnonymous || !db) {
            setDebts([]);
            return;
        }

        const userId = user.uid;
        const debtsRef = collection(db, 'artifacts', appId, 'users', userId, 'debts');
        const q = query(debtsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newDebts = snapshot.docs.map(doc => {
                const data = doc.data();
                
                let quantity = null;
                let unit = '';
                
                const match = data.quantityText.match(/^(\d+(\.\d+)?)\s*(.*)$/);
                if (data.isNumeric && match) {
                    quantity = parseFloat(match[1]);
                    unit = match[3] || '杯';
                } else if (data.isNumeric) {
                    quantity = parseFloat(data.quantityText);
                    unit = '杯';
                }
                
                const repaid = data.repaid || 0;
                const repaidNum = typeof repaid === 'number' ? repaid : 0;
                const remaining = quantity !== null ? quantity - repaidNum : null;

                return {
                    id: doc.id,
                    ...data,
                    quantity,
                    repaid,
                    remaining,
                    unit,
                    isPaid: data.isPaid || (remaining !== null && remaining <= 0)
                } as Debt;
            });
            setDebts(newDebts.sort((a, b) => (a.isPaid === b.isPaid ? 0 : a.isPaid ? 1 : -1)));
        }, (error) => {
            console.error("Firestore Debts Snapshot Error:", error);
        });

        return () => unsubscribe();
    }, [user, authReady]);
    
    const isAuthenticated = user && !user.isAnonymous;
    const userIdDisplay = user ? user.uid.substring(0, 10) : '未登录';

    // Operations
    const handleRecordDebt = async () => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }
        if (!newDebt.debtorName.trim() || !newDebt.quantityInput.trim()) {
            showNotification('请填写欠酒人姓名和欠酒数量。', 'error');
            return;
        }
        if (!db) return;

        let quantity: number | null = null;
        let unit = '';
        let isNumeric = false;
        const quantityText = newDebt.quantityInput.trim();
        
        if (!isNaN(parseFloat(quantityText)) && isFinite(Number(quantityText))) {
            quantity = parseFloat(quantityText);
            unit = '杯';
            isNumeric = true;
        } else {
            quantity = 0;
            isNumeric = false;
        }

        try {
            const userId = user.uid;
            const debtsRef = collection(db, 'artifacts', appId, 'users', userId, 'debts');
            
            await addDoc(debtsRef, {
                debtorName: newDebt.debtorName.trim(),
                quantityText: quantityText,
                quantity: quantity,
                unit: unit,
                isNumeric: isNumeric,
                repaid: 0,
                isPaid: false,
                recordDate: newDebt.date,
                recordedAt: serverTimestamp(),
                recorderId: userId
            });

            setNewDebt({
                date: new Date().toISOString().substring(0, 10),
                debtorName: '',
                quantityInput: '',
            });
            showNotification('欠酒事件记录成功！', 'success');
        } catch (e: any) {
            console.error("记录欠酒失败:", e);
            showNotification(`记录失败: ${e.message}`, 'error');
        }
    };
    
    const handleDeleteDebt = async (debtId: string) => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }
        if (!db) return;
        
        if (!window.confirm('确定要删除这条欠酒记录吗？相关的偿还记录也会丢失。')) {
            return;
        }
        
        try {
            const userId = user.uid;
            const debtRef = doc(db, 'artifacts', appId, 'users', userId, 'debts', debtId);
            await deleteDoc(debtRef);
            showNotification('欠酒记录删除成功！', 'success');
        } catch (e: any) {
            console.error("删除记录失败:", e);
            showNotification(`删除失败: ${e.message}`, 'error');
        }
    };

    const handleTogglePaid = async (debtId: string, currentStatus: boolean) => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }
        if (!db) return;
        
        try {
            const userId = user.uid;
            const debtRef = doc(db, 'artifacts', appId, 'users', userId, 'debts', debtId);
            const newStatus = !currentStatus;
            
            let updatePayload: any = { isPaid: newStatus };
            if (newStatus) {
                const debtToUpdate = debts.find(d => d.id === debtId);
                if (debtToUpdate && debtToUpdate.isNumeric) {
                    updatePayload.repaid = debtToUpdate.quantity;
                }
            } else {
                updatePayload.repaid = 0;
            }

            await updateDoc(debtRef, updatePayload);
            showNotification(newStatus ? '记录已标记为“已还清”！' : '记录已标记为“未还清”！', 'success');
        } catch (e: any) {
            console.error("更新状态失败:", e);
            showNotification(`更新状态失败: ${e.message}`, 'error');
        }
    };

    // Statistics Calculation
    const statistics = useMemo<Statistics>(() => {
        let maxDebtorName = '';
        let maxDebtAmount = 0;
        let oldestDebtorName = '';
        let oldestDebtDays = 0;
        let oldestDebtDate = '';
        let countDebtorMap: Record<string, number> = {};
        let countMax = 0;
        let countMaxNames: string[] = [];
        let totalUnpaidCount = 0;

        const now = new Date();

        debts.forEach(debt => {
            if (!debt.isPaid) {
                totalUnpaidCount++;
                
                if (debt.isNumeric && debt.quantity !== null && debt.quantity > maxDebtAmount) {
                    maxDebtAmount = debt.quantity;
                    maxDebtorName = debt.debtorName;
                }

                const debtDate = new Date(debt.recordDate);
                const diffTime = Math.abs(now.getTime() - debtDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > oldestDebtDays) {
                    oldestDebtDays = diffDays;
                    oldestDebtorName = debt.debtorName;
                    oldestDebtDate = debt.recordDate;
                } else if (diffDays === oldestDebtDays) {
                    oldestDebtorName = oldestDebtorName ? `${oldestDebtorName}、${debt.debtorName}` : debt.debtorName;
                }

                countDebtorMap[debt.debtorName] = (countDebtorMap[debt.debtorName] || 0) + 1;
            }
        });
        
        Object.entries(countDebtorMap).forEach(([name, count]) => {
            if (count > countMax) {
                countMax = count;
                countMaxNames = [name];
            } else if (count === countMax && countMax > 0) {
                countMaxNames.push(name);
            }
        });

        return {
            maxDebtor: maxDebtorName || '无',
            maxDebt: maxDebtAmount || '0',
            oldestDebtor: oldestDebtorName || '无',
            oldestDays: oldestDebtDays > 0 ? `${oldestDebtDays} 天` : '0 天',
            oldestDate: oldestDebtDate || 'N/A',
            countMaxDebtors: countMaxNames.join('、') || '无',
            countMaxTimes: countMax || '0',
            totalUnpaidCount: totalUnpaidCount
        };
    }, [debts]);

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800">
            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center space-x-3">
                    <span className="text-3xl" role="img" aria-label="beer">🍺📝</span>
                    <h1 className="text-2xl font-bold text-indigo-700 hidden md:block">赖酒记录小帮手</h1>
                    <h1 className="text-xl font-bold text-indigo-700 block md:hidden">赖酒小帮手</h1>
                    {isAuthenticated && (
                        <span className="text-xs md:text-sm text-gray-500 hidden sm:inline-block">ID: {userIdDisplay}</span>
                    )}
                </div>
                <div className="flex items-center space-x-4">
                    {isAuthenticated ? (
                        <button onClick={handleLogout} className="text-red-500 hover:text-red-700 transition flex items-center text-sm font-medium">
                            <LogOut className="w-5 h-5 mr-1" />
                            登出
                        </button>
                    ) : (
                         <button onClick={() => setShowAuthModal(true)} className="text-indigo-600 hover:text-indigo-800 transition flex items-center font-semibold text-sm">
                            <UserIcon className="w-5 h-5 mr-1" />
                            登录
                        </button>
                    )}
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats and Add Form */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Stats Section */}
                    <section className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center border-b pb-3">
                            <BarChart2 className="w-6 h-6 mr-2 text-indigo-600" />
                            欠酒统计 (未还清)
                            <span className="ml-4 text-sm text-gray-500 font-normal">总条目: {statistics.totalUnpaidCount}</span>
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard 
                                title="最大债王" 
                                value={statistics.maxDebtor}
                                unit={`${statistics.maxDebt} 杯`}
                                icon={Maximize2}
                                colorClass="bg-red-500"
                            />
                            <StatCard 
                                title="最久债王" 
                                value={statistics.oldestDebtor}
                                unit={`${statistics.oldestDate} (${statistics.oldestDays})`}
                                icon={Clock}
                                colorClass="bg-yellow-600"
                            />
                            <StatCard 
                                title="次数之王" 
                                value={statistics.countMaxDebtors}
                                unit={`${statistics.countMaxTimes} 次`}
                                icon={UserIcon}
                                colorClass="bg-indigo-600"
                            />
                        </div>
                    </section>

                    {/* Add Debt Section */}
                    <section className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center border-b pb-3">
                            <Plus className="w-6 h-6 mr-2 text-green-600" />
                            记录新的赖酒事件
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">发生日期</label>
                                    <input
                                        type="date"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                        value={newDebt.date}
                                        onChange={(e) => setNewDebt({ ...newDebt, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">欠酒人姓名</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                        value={newDebt.debtorName}
                                        onChange={(e) => setNewDebt({ ...newDebt, debtorName: e.target.value })}
                                        placeholder="例如: 小明"
                                        required
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700">欠酒数量</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                        value={newDebt.quantityInput}
                                        onChange={(e) => setNewDebt({ ...newDebt, quantityInput: e.target.value })}
                                        placeholder="5 或 5杯酒"
                                        required
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 pt-1">
                                提示: 输入<b>纯数字</b> (如 '5') 将自动开启进度追踪；输入<b>文本</b> (如 '5杯啤酒') 仅作文字记录。
                            </p>
                        </div>
                        
                        <button
                            onClick={handleRecordDebt}
                            className={`w-full mt-6 py-3 rounded-lg text-white font-bold text-lg transition duration-300 shadow-lg ${isAuthenticated ? 'bg-indigo-700 hover:bg-indigo-800' : 'bg-gray-400 cursor-not-allowed'}`}
                            disabled={!isAuthenticated}
                        >
                            {isAuthenticated ? '记录赖酒' : '请先登录'}
                        </button>
                    </section>
                </div>
                
                {/* Right Column: List */}
                <div className="lg:col-span-1">
                    <section className="bg-gray-50 p-6 rounded-xl shadow-lg sticky top-20">
                        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                            <CheckCircle className="w-6 h-6 mr-2 text-indigo-600" />
                            赖酒记录清单
                        </h2>
                        
                        {debts.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 bg-white rounded-lg border border-dashed">
                                暂无赖酒记录。快来记录第一笔吧！
                            </div>
                        ) : (
                            <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
                                {debts.map(debt => (
                                    <DebtItem 
                                        key={debt.id} 
                                        debt={debt} 
                                        onDelete={handleDeleteDebt}
                                        onTogglePaid={handleTogglePaid}
                                        onRepay={() => { setSelectedDebt(debt); setShowRepaymentModal(true); }}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>

            {notification.message && (
                <div 
                    className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-xl text-white font-semibold transition-opacity duration-300 z-50 ${
                        notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                >
                    {notification.message}
                </div>
            )}
            
            <AuthModal 
                show={showAuthModal && !isAuthenticated} 
                onClose={() => setShowAuthModal(false)}
                onAuthSuccess={handleAuthSuccess}
            />
            
            {selectedDebt && (
                <RepaymentModal 
                    show={showRepaymentModal} 
                    onClose={() => setShowRepaymentModal(false)}
                    debt={selectedDebt}
                    userId={user?.uid || ''}
                    appId={appId}
                />
            )}
        </div>
    );
};

export default App;
