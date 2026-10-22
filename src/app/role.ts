import { createContext, useContext } from 'react';
export const ROLES = ['Customer', 'Mechanic', 'Dispatcher', 'Admin'] as const;
export const RoleCtx = createContext<(typeof ROLES)[number]>('Customer');
export const useRole = () => useContext(RoleCtx);
/** Demo-only: only Customer/Admin perspectives may decide estimates. Not real security. */
export const canDecide = (r: string) => r === 'Customer' || r === 'Admin';
