# Sidebar and Progress Sheet Redesign

## Goal
Make the Dashboard the first screen after sign-in, move navigation into a collapsible sidebar, and focus the opening view on progress, today’s work, and the daily streak.

## What will change
- Add one responsive sidebar used across Dashboard, Course Tracker, Reports, and Settings.
- Keep the sidebar collapsible on desktop and available through a menu button on mobile.
- Include Progress Sheet, Courses, Subjects, Syllabus, Tests, Analytics, Reports, and Settings; preserve the existing content and behavior of every destination.
- Change the default signed-in address to the Dashboard and move Course Tracker to its own address, while keeping old links working.
- Remove the current top navigation buttons and the large statistics/progress-bar layout from the Dashboard.
- Rebuild the Dashboard opening area around:
  - overall progress sheet
  - daily streak
  - today’s unfinished syllabus topics, ordered by highest exam weightage
  - completed exam weightage and item totals
- Add course and subject selectors to the progress sheet.
- Show a donut/pie chart for the selected subject with completed versus remaining weightage, plus clear percentage and topic totals.
- Provide sensible empty states when no course, subject, or syllabus topic exists.

## Technical details
- Create a shared authenticated app layout using the existing sidebar system and active-route highlighting.
- Use query parameters for Course Tracker sections so sidebar links open the existing Courses, Subjects, Syllabus, Tests, and Analytics views directly.
- Extend Dashboard’s existing course query to retain subject-level syllabus data for tasks and chart calculations.
- Use semantic theme colors for the chart and sidebar, with no changes to stored course, test, study-time, or report data.
- Validate desktop and mobile layouts, navigation, chart selection, and TypeScript checks.
