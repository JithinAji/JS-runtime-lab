# Experiment 001: Unnecessary Code Generation

## Request

Create an HTML boilerplate with JavaScript and CSS files attached.
Make new JavaScript and CSS files.

## Expected Result

Three minimal files:

- index.html
- style.css
- script.js

The CSS and JavaScript files should be empty.

The HTML should contain only the minimum structure
required to attach the CSS and JavaScript files.

## Actual Result

AI generated additional UI/landing-page code that was not requested.

## Problem

The request contained "boilerplate", which AI interpreted as
a more complete example rather than a minimal file structure.

This resulted in:

- unnecessary code
- unnecessary tokens
- additional code that must be reviewed
- deviation from the requested scope

## Lesson

When creating project scaffolding, explicitly define what
should NOT be generated.

## Proposed Guideline

When the requested implementation is intentionally minimal,
AI must not add example content, styling, components,
or functionality that was not explicitly requested.

## Better Prompt

Create exactly these files:

- index.html
- style.css
- script.js

Requirements:

- index.html should contain only the minimum HTML5 structure.
- Link style.css from index.html.
- Link script.js from index.html.
- style.css must be empty.
- script.js must be empty.
- Do not add UI, sample content, styling, comments,
  libraries, frameworks, or example code.
- Do not create any additional files.