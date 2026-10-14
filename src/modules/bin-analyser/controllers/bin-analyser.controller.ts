/**
 * BIN Analyser Controller Facade
 * 
 * Re-exports all handlers from specialized sub-controllers for modular architecture
 * and complete backward compatibility with routes/api.ts.
 */

export {
  list,
  filters,
  allStats,
  search,
  drilldownPivot,
  comparison,
  duplicates
} from './bin-reports.controller.js';

export {
  parse,
  save,
  deleteAll
} from './bin-import.controller.js';

export {
  exportData
} from './bin-export.controller.js';
