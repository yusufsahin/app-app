/**
 * Layout and spacing constants for consistent UX.
 * Use theme.spacing() in sx when possible; these are semantic defaults.
 */
export const LAYOUT = {
  /** Vertical gap between page title and description (theme spacing units) */
  pageTitleBottom: 2,
  /** Vertical gap between description and main content */
  pageDescriptionBottom: 3,
  /** Vertical gap between major page sections */
  pageSectionGap: 4,
  /** Modal: gap between body and action buttons */
  modalActionsTop: 2,
  /** Modal: gap between action buttons */
  modalActionsGap: 1,
  /** Content area padding (modal body, cards) */
  contentPadding: 2,
} as const;
