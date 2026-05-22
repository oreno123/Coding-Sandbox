---
name: assignment-writer
description: Generates software engineering assignment reports from Markdown requirements. Creates text-based solutions in Markdown (default) or LaTeX source format. Supports Essay or Bullet-point styles, strictly adhering to specific plain-language guidelines (no tables, no parentheses, descriptive style).
---

# Assignment Writer

## Overview

This skill generates software engineering assignment reports based on provided Markdown requirements. It is designed to produce content that feels authentic, using plain, descriptive language while strictly avoiding specific formatting elements like tables and parentheses. It can output either Markdown files or LaTeX source code.

## Usage

### 1. Trigger
Use this skill when provided with:
- A Markdown document containing assignment requirements or questions (specifically for Software Engineering or subjective topics).
- A request to generate a solution, report, or homework submission.

### 2. Output Format
The skill supports two file formats. **Default to Markdown** unless LaTeX is explicitly requested.
- **Markdown (.md)**: Standard formatted text.
- **LaTeX Source (.tex)**: Complete source code using the standard `article` class.

### 3. Style Selection
The skill supports two primary output formats. If not specified, ask the user or infer from the requirements:
- **Essay Style (论文体)**: Continuous prose, suitable for analysis or comprehensive answers.
- **Bullet Points (分点陈述)**: Structured list of points, suitable for multi-part questions.

### 3. Execution Rules
**CRITICAL**: You must strictly follow the writing guidelines defined in [references/style_guide.md](references/style_guide.md).

Key Highlights from Style Guide:
- **Plain, Descriptive Language**: Avoid rhetoric and formatting.
- **NO Parentheses**: Never use `()` for explanations.
- **NO Tables**: Use text descriptions instead.
- **Acceptable logic flow**: It doesn't need to be perfectly structured text; readable but slightly unstructured "student-like" logic is acceptable.

## Workflow

1.  **Read Requirements**: Analyze the input Markdown to identify specific questions and constraints.
2.  **Apply Style**: Generate the answer for each question.
    *   Consult [references/style_guide.md](references/style_guide.md) continuously.
    *   Ensure language is Chinese (with English terms where necessary, but *without* parentheses).
3.  **Review**: Check generated text against "Absolute Prohibitions" (No tables, no parentheses).

## Examples

**User Request:**
> "Here are the requirements for my ML assignment. Please generate a report in essay style."

**Action:**
1.  Read the ML assignment questions.
2.  Draft answers in continuous prose.
3.  Ensure sentences are descriptive and plain.
4.  Remove any accidental parentheses or tables.
