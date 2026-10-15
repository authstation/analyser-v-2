/**
 * Why: §3.1 — job type identifiers shared by producers (controllers), consumers
 *      (job handlers) and the bootstrap. Keeping them in a leaf module avoids a
 *      controller ⇄ job-handler import cycle.
 * When: Enqueueing or registering a background job.
 * Where: src/modules/jobs/services/job-types.ts.
 * How: Plain string constants.
 */
export const RETURN_IMPORT_JOB = "return_import";
export const BIN_IMPORT_JOB = "bin_import";
export const POST_IMPORT_MAINTENANCE_JOB = "post_import_maintenance";

export type ImportJobType = typeof RETURN_IMPORT_JOB | typeof BIN_IMPORT_JOB;
