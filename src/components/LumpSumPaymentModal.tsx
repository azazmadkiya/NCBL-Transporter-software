import React from 'react';
import { DirectPartyPaymentModal } from './DirectPartyPaymentModal';
import { Invoice, PaymentRecord, Party } from '../types';

interface LumpSumPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  parties: Party[];
  invoices: Invoice[];
  initialPartyId?: string;
  onAddPayment: (invoice: Invoice, payment: PaymentRecord) => void;
}

export const LumpSumPaymentModal: React.FC<LumpSumPaymentModalProps> = (props) => {
  return <DirectPartyPaymentModal {...props} />;
};
