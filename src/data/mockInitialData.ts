import { Invoice, Party, Vehicle, Expense, CompanySettings, UserProfile, NoteReminder, AppUserAccount } from '../types';

export const initialCompanySettings: CompanySettings = {
  companyName: 'NCBL Transport',
  tagline: 'Safe, Secure & On-Time Fleet Operations',
  gstin: '27AAAAA0000A1Z5',
  pan: 'AAAAA0000A',
  phone: '+91 98765 43210',
  alternatePhone: '+91 98220 11223',
  email: 'billing@ncbltransport.com',
  address: 'Plot No. 42, Transport Nagar, Nigdi, Pimpri-Chinchwad',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411044',
  bankName: 'HDFC Bank Ltd',
  bankAccountNo: '50200012345678',
  bankIfsc: 'HDFC0001234',
  bankBranch: 'Chinchwad Branch, Pune',
  upiId: '9687709315@upi',
  termsAndConditions: [
    'Goods transported at owner\'s risk unless insured.',
    'Payment due within 15 days from bill submission date.',
    'Demurrage/Detention charges extra after 24 hrs loading/unloading delay.',
    'Subject to Pune jurisdiction only.'
  ]
};

export const initialNotesReminders: NoteReminder[] = [
  {
    id: 'note-1',
    title: 'Pune to Mumbai Freight Rate',
    category: 'bhada_rate',
    originCity: 'Pune',
    destinationCity: 'Mumbai',
    bhadaAmount: 22000,
    ratePerTon: 1100,
    vehicleType: '32ft Container',
    description: 'Standard 20 Ton bhada rate including toll charges',
    isCompleted: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 'note-2',
    title: 'Ahmedabad to Delhi Freight Rate',
    category: 'bhada_rate',
    originCity: 'Ahmedabad',
    destinationCity: 'Delhi',
    bhadaAmount: 38000,
    ratePerTon: 1900,
    vehicleType: 'Taurus 16 Wheeler',
    description: 'Fixed Bhada rate for industrial goods load',
    isCompleted: false,
    createdAt: new Date().toISOString()
  }
];

export const initialParties: Party[] = [];

export const initialVehicles: Vehicle[] = [];

export const initialExpenses: Expense[] = [];

export const initialInvoices: Invoice[] = [];

export const initialAppUsers: AppUserAccount[] = [
  {
    id: 'user-azazmadkiya',
    username: 'azazmadkiya',
    password: '9687709315',
    displayName: 'Azazmadkiya',
    email: 'azazmadkiya@gmail.com',
    role: 'admin',
    phone: '+91 96877 09315'
  }
];

export const demoProfiles: UserProfile[] = [
  {
    uid: 'demo-admin-1',
    email: 'admin@ncbltransport.com',
    displayName: 'Rajesh Sharma (Admin)',
    role: 'admin',
    phone: '+91 98765 43210'
  },
  {
    uid: 'demo-accountant-1',
    email: 'accountant@ncbltransport.com',
    displayName: 'Priya Verma (Accountant)',
    role: 'accountant',
    phone: '+91 98220 99887'
  },
  {
    uid: 'demo-driver-1',
    email: 'ramesh.driver@ncbltransport.com',
    displayName: 'Ramesh Singh (Driver)',
    role: 'driver',
    phone: '+91 98223 88123',
    truckNumber: 'MH-12-PQ-9876'
  }
];
