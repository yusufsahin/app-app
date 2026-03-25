export const qualityEn = {
  common: {
    cancel: "Cancel",
    create: "Create",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
  },
  tree: {
    folders: "Folders",
    loading: "Loading...",
    empty: "No quality folders.",
    clearFilter: "Clear folder filter",
  },
  workspace: {
    noQualityTree: "Quality tree is not defined in the manifest.",
    selectFolderFirst: "Select a folder from the left first.",
    selectedFolderChildren: "Selected folder children",
    selectFolderToList: "Select a folder to list items",
    selectedItem: "Selected item",
    selectItemToEdit: "Select an item to edit",
    noItemSelected: "No item selected.",
  },
  modals: {
    createTitle: "Create quality item",
    editTitle: "Edit quality item",
    deleteTitle: "Delete quality item",
    saveError: "Unable to save. Please try again.",
    fields: {
      title: "Title",
      description: "Description",
    },
    placeholders: {
      title: "Enter title",
      description: "Enter description",
    },
  },
  steps: {
    title: "Steps",
    add: "Add Step",
    empty: "No steps defined. Add one to begin.",
    noName: "No name defined",
    dragHint: "Drag to reorder",
    fields: {
      name: "Name",
      description: "Description",
      expectedResult: "Expected Result",
    },
    placeholders: {
      name: "What should the tester do?",
      description: "Additional context for the step",
      expectedResult: "What should happen?",
    },
  },
  execution: {
    markAllPassed: "Mark All Passed",
    actualResult: "Actual Result",
    copyExpected: "Copy Expected",
    notes: "Notes / Observations",
    copyBugReport: "Copy Bug Report",
    placeholders: {
      actualResult: "What actually happened?",
      notes: "Any bugs or context...",
    },
  },
} as const;

