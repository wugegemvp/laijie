import { LucideIcon } from 'lucide-react';

declare global {
    var __app_id: string | undefined;
    var __firebase_config: string | undefined;
    var __initial_auth_token: string | undefined;
}

export interface Debt {
    id: string;
    debtorName: string;
    quantityText: string;
    quantity: number | null;
    unit: string;
    isNumeric: boolean;
    repaid: number | string;
    isPaid: boolean;
    remaining: number | null;
    recordDate: string;
    recordedAt: any;
    recorderId: string;
}

export interface Statistics {
    maxDebtor: string;
    maxDebt: number | string;
    oldestDebtor: string;
    oldestDays: string;
    oldestDate: string;
    countMaxDebtors: string;
    countMaxTimes: number | string;
    totalUnpaidCount: number;
}

export interface StatCardProps {
    title: string;
    value: string | number;
    unit?: string;
    icon: LucideIcon;
    colorClass: string;
}
