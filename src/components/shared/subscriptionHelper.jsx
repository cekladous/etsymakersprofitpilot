import { format } from 'date-fns';

export const PLANS = ['free', 'maker_pro', 'maker_plus'];

export const PLAN_CONFIG = {
  free: {
    name: 'Free',
    price: 0,
    features: {
      monthly_imports: 1,
      reconciliation: false,
      month_close: false,
      csv_exports: false,
      locked_months: false,
      max_users: 1,
      priority_support: false
    }
  },
  maker_pro: {
    name: 'Maker Pro',
    price: 9,
    features: {
      monthly_imports: -1,
      reconciliation: true,
      month_close: true,
      csv_exports: true,
      locked_months: false,
      max_users: 1,
      priority_support: false
    }
  },
  maker_plus: {
    name: 'Maker Plus',
    price: 14,
    features: {
      monthly_imports: -1,
      reconciliation: true,
      month_close: true,
      csv_exports: true,
      locked_months: true,
      max_users: 2,
      priority_support: true
    }
  }
};

export const formatRenewalDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'trial':
      return 'bg-blue-100 text-blue-800';
    case 'expired':
      return 'bg-gray-100 text-gray-800';
    case 'payment_failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusLabel = (status) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trial':
      return 'Trial';
    case 'expired':
      return 'Expired';
    case 'payment_failed':
      return 'Payment Failed';
    case 'canceled':
      return 'Canceled';
    default:
      return status;
  }
};