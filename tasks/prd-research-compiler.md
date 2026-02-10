# PRD: Research Compiler

## Introduction
A research compiler skill that aggregates information from multiple sources, generates structured summaries, manages bibliographies, and exports findings to various document formats (PDF, Word, Markdown). Enables the Researcher (Russ) to compile and share research efficiently.

## Goals
- Aggregate sources from web searches, news, and saved content
- Generate structured summaries with citations
- Automatically manage bibliography and references
- Export compiled research to multiple formats (PDF, DOCX, Markdown)
- Support collaborative research organization

## User Stories

### US-001: Source Aggregation
**Description:** As a researcher, I want to aggregate sources from various searches so that I can compile comprehensive research.

**Acceptance Criteria:**
- [ ] Import sources from Web Search, News Aggregator, and Saved Searches
- [ ] Add manual sources with metadata (title, URL, author, date)
- [ ] Organize sources into collections/projects
- [ ] Tag sources with topics or keywords
- [ ] Typecheck passes

### US-002: Summary Generation
**Description:** As a researcher, I want to generate summaries so that I can quickly understand key findings.

**Acceptance Criteria:**
- [ ] Extract key points from each source
- [ ] Generate thematic summaries across multiple sources
- [ ] Highlight conflicting information between sources
- [ ] Support custom summary templates
- [ ] Typecheck passes

### US-003: Bibliography Management
**Description:** As a researcher, I want automatic bibliography generation so that I can properly cite sources.

**Acceptance Criteria:**
- [ ] Generate citations in multiple formats (APA, MLA, Chicago, BibTeX)
- [ ] Auto-extract citation metadata from URLs
- [ ] De-duplicate references automatically
- [ ] Support manual citation editing
- [ ] Typecheck passes

### US-004: Document Export
**Description:** As a researcher, I want to export compiled research so that I can share findings with others.

**Acceptance Criteria:**
- [ ] Export to PDF with proper formatting
- [ ] Export to Microsoft Word (.docx)
- [ ] Export to Markdown for web publishing
- [ ] Include table of contents and page numbers
- [ ] Preserve formatting and citations in exports
- [ ] Typecheck passes

### US-005: Research Organization
**Description:** As a researcher, I want to organize my research so that I can manage multiple projects.

**Acceptance Criteria:**
- [ ] Create and manage research projects
- [ ] Add notes and annotations to sources
- [ ] Create outlines and structure for reports
- [ ] Search across all research content
- [ ] Archive completed projects
- [ ] Typecheck passes

## Functional Requirements
- FR-1: Import sources from other skills and manual entry
- FR-2: Generate summaries using extractive or template-based methods
- FR-3: Support multiple citation formats (APA, MLA, Chicago, IEEE, BibTeX)
- FR-4: Export to PDF, DOCX, HTML, and Markdown formats
- FR-5: Organize research into projects with metadata
- FR-6: Add notes and annotations to individual sources
- FR-7: Generate table of contents and cross-references
- FR-8: Validate citations for completeness
- FR-9: Support version history for compiled documents

## Non-Goals
- No AI-generated original research or analysis
- No real-time collaborative editing
- No plagiarism detection
- No integration with reference management tools (Zotero, Mendeley)
- No automatic fact-checking or source verification

## Technical Considerations
- **Document Generation:** pandoc, pdfmake, or python-docx/weasyprint
- **Citation Parsing:** Citation.js or manual parsing for common formats
- **Storage:** SQLite for project metadata, file system for exports
- **Templates:** Support custom LaTeX or HTML templates for styling
- **Dependencies:** Minimize heavy dependencies; optional LaTeX for PDF quality
- **Performance:** Async processing for large document generation

## Success Metrics
- Support 50+ sources per research project
- Export generation time < 10 seconds for 20-page document
- Citation format compliance > 95% for standard styles
- Support all major export formats (PDF, DOCX, MD, HTML)

## Open Questions
- Should we support collaborative research with shared projects?
- Should we integrate with cloud storage (Google Drive, Dropbox) for exports?
- Should we support custom branding/themes for exported documents?
