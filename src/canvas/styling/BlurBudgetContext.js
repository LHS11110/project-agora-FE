import { createContext } from 'react';

// null means all visible objects with background-blur stay within GPU budget.
// A Set<string> limits active backdrop-filter passes to those IDs.
export const BlurBudgetContext = createContext(null);
