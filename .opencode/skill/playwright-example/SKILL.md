---
name: playwright-example
description: Browser automation skill for web testing, scraping, and interaction. Use for end-to-end testing, screenshots, and browser automation tasks.
argument-hint: describe what you want to do (e.g., "take a screenshot of homepage", "test login flow", "fill out a form")
mcp:
  playwright:
    command: ["npx", "-y", "@playwright/mcp@latest"]
---

# Playwright Browser Automation

This skill provides browser automation capabilities via the Playwright MCP server.

## Available Operations

The Playwright MCP provides tools for:

- **Navigation**: Navigate to URLs, go back/forward, reload pages
- **Screenshots**: Capture full page or element screenshots
- **Interactions**: Click, type, select, hover, and other user interactions
- **Forms**: Fill out forms, submit data, handle file uploads
- **Assertions**: Wait for elements, check visibility, verify content
- **Scraping**: Extract text, attributes, and data from pages

## Usage Guidelines

1. **End-to-End Testing**:
   - Automate user flows and verify functionality
   - Test authentication flows
   - Validate form submissions

2. **Screenshots & Visual Testing**:
   - Capture screenshots for documentation
   - Compare visual states before/after changes
   - Debug UI issues

3. **Web Scraping**:
   - Extract data from web pages
   - Navigate through paginated content
   - Handle dynamic content loading

4. **Form Automation**:
   - Fill and submit forms
   - Handle multi-step wizards
   - Test validation behavior

## Example Tasks

- "Navigate to the login page and take a screenshot"
- "Fill out the registration form with test data"
- "Click the submit button and wait for the success message"
- "Extract all product names from the catalog page"
- "Test the checkout flow from cart to confirmation"
- "Take a screenshot of the dashboard after logging in"
