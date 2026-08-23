---
name: figma-inspector
description: Inspect, audit, search, extract specs, and export visuals from Figma documents using Figma MCP tools.
---

# Figma Inspector Specialist

Use this skill when reading document structures, extracting design tokens/specs, finding layers, or validating designs.

## Workflow

1. **Targeted Inspection:**
   - Active selection: `get_selection`
   - Node details: `get_node` (by ID) or `get_nodes_info` (batch IDs)
   - Scope tree context: `get_design_context` (use `maxDepth` and `detailLevel` to limit payload)
   - Document metadata: `get_metadata`, `get_pages`

2. **Search & Layer Scanning:**
   - Name/type search: `search_nodes`
   - Extract text content: `scan_text_nodes`
   - Search by node types: `scan_nodes_by_types`
   - Font audit: `get_fonts`

3. **Visual Extraction & Review:**
   - Capture node image preview: `get_screenshot`
   - Save screenshots to disk: `save_screenshots`
   - Export multi-frame PDF: `export_frames_to_pdf`
   - Inspect dev annotations: `get_annotations`
