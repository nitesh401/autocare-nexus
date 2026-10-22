import { useSyncExternalStore } from 'react';
import { createStore, LocalStorageRepository } from '../repositories/store';
import { seedOrders, seedParts, T0 } from '../data/seed';
export const store = createStore(new LocalStorageRepository(), () => ({ orders: seedOrders(), parts: seedParts(), now: T0, simulatedClock: true }));
export const useApp = () => useSyncExternalStore(store.subscribe, store.getState);
