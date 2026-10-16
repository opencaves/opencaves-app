// The admins' map tasks (functions/js/tasks/mapTasks.js' MAP_TASK_SCENARIOS,
// keep them in step): what the checks found of a survey map added in the app,
// the most urgent first - the Tasks page lists the open tasks in this order.
export const MAP_TASK_SCENARIOS = ['exactDuplicate', 'possibleDuplicate', 'newerSurvey', 'alreadyTraced', 'newToLayer']

// The scenarios that say the map may be one OpenCaves already has: shown as
// a warning on the Tasks page.
export const MAP_TASK_DUPLICATE_SCENARIOS = ['exactDuplicate', 'possibleDuplicate']

// The latest tasks the Tasks page reads, open and closed.
export const TASKS_READ = 300
