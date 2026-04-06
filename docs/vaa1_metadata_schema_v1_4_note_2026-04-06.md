# VAA1 Metadata Schema v1.4

User-facing, simple + extensible

## Design goals

- easy to fill in
- no cognitive overload
- structured enough for analysis
- supports clips and full works
- allows later additions without breaking structure
- keeps categories stable across use cases

## Structure overview

Think of the schema as six simple sections:

1. Basic info
2. People and roles
3. Context
4. Interaction and narrative
5. References
6. Confidence and notes

## 1. Basic info

### Title

What:
- short name for the media

Examples:
- `Group discussion after unexpected event`
- `Episode 3 - confrontation scene`

### Scope

What:
- how much material is included

Options:
- short clip
- scene / segment
- full recording
- full episode / film

Example:
- `Full episode`

### Description

What:
- what is happening in one to two sentences

Example:
- `A speaker explains a situation while others respond with questions and reactions`

## 2. People and roles

### Persons / characters

What:
- who appears, whether real or fictional

Format suggestion:
- name or role

Examples:
- `main speaker`
- `interviewer`
- `character: detective (actor: lead performer)`

### Relations

What:
- how people are connected

Examples:
- `interviewer ↔ guest`
- `leader → group`
- `actor represented by agency`
- `character reports to superior`

## 3. Context

### Location

What:
- where this takes place

Structure:
- general to specific

Example:
- country: `Germany`
- city: `Berlin`
- place: `conference centre`
- room: `main hall`

Users should be able to fill only what they know.

### Time / period

What:
- when this happens

Structure:
- general to specific

Examples:
- era: `Cold War era`
- year: `1980s`
- moment: `after announcement`

### Situation / event

What:
- what kind of situation this is

Examples:
- `panel discussion`
- `response to incident`
- `investigation scene`

### Keywords

What:
- three to seven important themes

Examples:
- `tension, explanation, response`
- `conflict, revelation, resolution`

## 4. Interaction and narrative

### Interaction dynamics

What:
- how people behave toward each other

Examples:
- `one speaker dominates, others listen`
- `frequent interruptions`
- `audience reacts to performer`

### Narrative / situation development

What:
- what changes over time

Examples:
- `tone shifts from calm to tense`
- `initial agreement breaks into disagreement`
- `mystery gradually revealed`

### Performance / expression

What:
- notable delivery or expression

Examples:
- `controlled and formal`
- `hesitation despite confidence`
- `standout dramatic performance`

### Genre

What:
- type of media

Examples:
- `interview`
- `news segment`
- `film scene`
- `music video`
- `stand-up performance`

## 5. References

### Reference materials

What:
- related material

Examples:
- article about the same situation
- transcript
- report
- alternate video

### Relation to media

What:
- how the reference connects

Examples:
- `same event`
- `background context`
- `planned vs actual speech`
- `alternate angle`

### Source

What:
- where the reference comes from

Examples:
- `news outlet`
- `archive`
- `organization`

## 6. Confidence and notes

### Confidence

What:
- how sure the user is

Options:
- high
- medium
- low

This should be available per field where needed.

### Notes

What:
- anything worth remembering, checking, or questioning

Examples:
- `clip may be edited`
- `identity uncertain`
- `compare with reference article`

## How this works in practice

### A. During upload: light mode

Only show:

- title
- scope
- description
- persons, optional
- keywords, optional
- references, optional

Goal:
- fast, low-friction input

### B. After upload: expandable mode

Allow later enrichment for:

- context
- interaction and narrative
- relations
- confidence per field
- references

Goal:
- gradual enrichment without slowing upload

### C. Inline editing

Every field should support:

- click to edit
- add to append rather than overwrite
- confidence toggle

## Key design rules

### Rule 1

Nothing is mandatory except minimal basics.

Purpose:
- prevents user drop-off

### Rule 2

Everything is extendable later.

Purpose:
- supports research workflows

### Rule 3

Structure stays stable.

Purpose:
- keeps data comparable

### Rule 4

Users can be approximate.

Purpose:
- uncertainty is handled through confidence, not blocked input

## Strongly recommended additions

Add gentle post-upload prompts such as:

- `Add people?`
- `Add context?`
- `Add references?`

These should encourage deeper annotation without making the initial upload heavy.

## What this schema enables

This schema:

- works for clips and full films
- supports research, behavioral, and narrative analysis
- is simple enough for first use
- is rich enough for advanced academic use
- integrates naturally with:
  - system extraction
  - provenance graph
  - future modeling

## Next step

The next implementation step should be:

- turn this schema into a UI flow

That means defining:

- upload screen
- step progression
- post-upload enrichment panel
- how system results appear alongside user metadata

