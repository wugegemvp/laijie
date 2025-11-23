import React from 'react';

interface ModalWrapperProps {
    show: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({ show, onClose, title, children }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-70 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-indigo-700">{title}</h2>
                </div>
                {children}
            </div>
        </div>
    );
};
