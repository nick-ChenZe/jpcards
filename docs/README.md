# Docs Archive

This directory stores product and engineering documentation in a retrievable structure.

## Directory Structure

- `product/`: product positioning, PRD, roadmap, decision records
- `api/`: API 契约、接口约束与变更记录

## Naming and Versioning Rules

- Use ordered prefixes for major docs: `00-`, `01-`, `02-`...
- Keep stable topic names in kebab-case.
- Keep product docs flat under `product/` for fast retrieval.
- For formal updates, bump version in document title (for example: `PRD v0.2`).

## Retrieval Conventions

- Start from the product index file: `product/README.md`
- 从 API 索引开始检索：`api/README.md`
- Use `decision-log.md` to trace why a requirement changed.
- Keep unresolved items centralized in `questions-for-owner.md`
