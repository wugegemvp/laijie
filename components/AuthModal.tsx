import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, User } from 'firebase/auth';
import { AlertTriangle } from 'lucide-react';
import { auth, ensureUserProfile } from '../services/firebase';

interface AuthModalProps {
    show: boolean;
    onClose: () => void;
    onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ show, onClose, onAuthSuccess }) => {
    const [isRegister, setIsRegister] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setIsLoading(true);

        if (!auth) {
            setAuthError("Authentication service unavailable.");
            setIsLoading(false);
            return;
        }

        const email = `${username}@temp.com`;
        if (password.length < 6) {
            setAuthError("密码至少需要6位");
            setIsLoading(false);
            return;
        }

        try {
            let userCredential;
            if (isRegister) {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await ensureUserProfile(userCredential.user.uid, email);
            } else {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            }
            onAuthSuccess(userCredential.user);
            onClose();
        } catch (error: any) {
            console.error("Auth Error:", error);
            const errorMessage = error.message.includes('auth/email-already-in-use') ? '用户名已被使用。' :
                                 error.message.includes('auth/invalid-credential') ? '用户名或密码错误。' :
                                 error.message.includes('permission') ? '注册失败：Missing or insufficient permissions.' :
                                 error.message.includes('Firebase') ? '操作失败，请检查网络或权限。' : error.message;
            setAuthError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <h2 className="text-3xl font-extrabold text-indigo-800 text-center">专属记录表登录</h2>
                    
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            type="button"
                            className={`flex-1 py-2 text-lg font-semibold rounded-lg transition-all duration-300 ${!isRegister ? 'bg-white text-indigo-700 shadow-md' : 'text-gray-500 hover:text-indigo-600'}`}
                            onClick={() => setIsRegister(false)}
                        >
                            登录
                        </button>
                        <button
                            type="button"
                            className={`flex-1 py-2 text-lg font-semibold rounded-lg transition-all duration-300 ${isRegister ? 'bg-indigo-700 text-white shadow-md' : 'text-gray-500 hover:text-indigo-600'}`}
                            onClick={() => setIsRegister(true)}
                        >
                            注册
                        </button>
                    </div>

                    <p className="text-sm text-center text-gray-500">当前用户数: 0/10. 请尽快注册!</p>

                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-gray-700">用户名 (作为记录人ID)</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="例如: 生哥"
                            required
                        />

                        <label className="block text-sm font-medium text-gray-700">密码 (至少6位)</label>
                        <div className="relative">
                            <input
                                type="password"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="******"
                                required
                            />
                        </div>
                    </div>

                    {authError && (
                        <div className="text-sm text-red-600 bg-red-100 p-3 rounded-lg flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            <span className="font-semibold">错误:</span> {authError}
                        </div>
                    )}

                    <button
                        type="submit"
                        className={`w-full py-3 rounded-lg text-white font-bold text-lg transition duration-300 shadow-lg ${isLoading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-700 hover:bg-indigo-800'}`}
                        disabled={isLoading}
                    >
                        {isLoading ? '处理中...' : isRegister ? '注册新用户' : '登录'}
                    </button>
                </form>
            </div>
        </div>
    );
};
