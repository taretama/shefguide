# ShefGuide Design Direction

## Three stylistic approaches

### 1. The Arrivals Desk

**Very Brief Intro:** An editorial, welcoming British-study companion that feels like a beautifully considered student field guide rather than a generic dashboard. Warm paper tones meet confident cobalt and contextual, hand-drawn navigation cues.

**Probability:** 0.07

### 2. Campus Signal

**Very Brief Intro:** A crisp contemporary product interface with cool blue panels, translucent utility layers and data-informed navigation. It frames academic support as a capable digital campus service.

**Probability:** 0.04

### 3. Common Room Notes

**Very Brief Intro:** A tactile pinboard-inspired direction that uses imperfect paper cards, stamps and friendly annotations to make the community element feel social and low-pressure.

**Probability:** 0.08

## Chosen approach: The Arrivals Desk

### Design Movement

**Contemporary editorial wayfinding** with a modern British stationery sensibility. The interface borrows the clarity of a well-designed student handbook and the warmth of a trusted orientation desk.

### Core Principles

1. **Calm orientation over technical intimidation:** Reduce the cognitive load of an unfamiliar education system through generous space, purposeful hierarchy and plain-language labels.
2. **A journey, not a dashboard:** Content is staged as chapters, pathways and next steps instead of dense controls or administrative tables.
3. **Tactile credibility:** Fine rules, paper-like surfaces, ink-blue headings, pins and subtle tape motifs imply that the service is curated rather than generic.
4. **Support with boundaries:** Safety messages and escalation guidance must be prominent, human and non-alarmist.

### Color Philosophy

The base is **warm parchment** and oyster white, reducing the clinical character of standard SaaS interfaces and making reading feel less exhausting. A deep **atlas cobalt** provides academic authority and strong direction, while coral-red signals human support, and moss green marks progress without creating gamified noise.

### Layout Paradigm

Pages behave like an annotated desk layout. Landing content is arranged through broad horizontal bands and offset feature notes. The app workspace uses a stable slim left rail, a wide conversational reading canvas, and a contextual right-hand utility panel. Mobile collapses this cleanly into an intentional single-column journey.

### Signature Elements

1. A custom folded-map **wayfinding mark** that implies discovery and academic navigation.
2. Quiet blue **guide lines** and small page-number / section-label treatments.
3. Pinned-note motifs: imperfect angled labels, red dots, and soft paper shadows used sparingly on prompts and practical tips.

### Interaction Philosophy

Interactions should reward decisive progress rather than distract. Cards lift lightly, completion controls resolve with a confident tick, and chat prompts become immediate conversation starters. Model selection feels like choosing a knowledgeable guide, not configuring software.

### Animation

Use short, deliberate 160–240ms transitions with a custom ease-out. Landing elements fade upward by 8–12px in staggered groups; side panels slide in by a small horizontal offset. Hover states may shift paper cards by 2px and deepen shadows. Respect reduced-motion preferences and avoid continuous decorative movement.

### Typography System

**DM Serif Display** leads large statements and section titles, offering editorial warmth and academic poise. **DM Sans** handles reading, navigation and UI controls at clear accessible sizes. Small labels use DM Sans in uppercase with tracked letter spacing; never use Inter.

### Brand Essence

**ShefGuide turns the unknowns of UK university life into a clear, curated route for international students.**

Personality: **reassuring, informed, practical**.

### Brand Voice

Write as a capable peer who knows the system and never patronises the student. Headlines are direct and calming; CTAs sound like an offered next step, not a sales conversion.

Example lines:

> “Find your footing before the first seminar.”

> “Ask the question you were not sure how to phrase.”

### Wordmark & Logo

Use a folded map with a circular location point as the symbol. The wordmark pairs its generous geometry with a subtly editorial serif name treatment. The mark must work independently as an app icon and favicon.

### Signature Brand Color

**Atlas Cobalt — `#174CCF`**. A saturated, ownable blue that acts as an orienting signal across every route.

## Style Decisions

- Atlas Cobalt is an **orienting signal rather than a default fill**. It is reserved for primary actions, active route markers and key guide moments, and balanced by parchment surfaces, ink-blue type, coral support cues and moss progress marks.
- Every product route is treated as a **chapter in an annotated student handbook**, using section labels, fine guide rules, paper layers and pinned-note cues as recurring structure.
- The folded-map mark must read first as a **route and arrival symbol** with a circular location point, not as a generic university crest.
- App routes read as **annotated handbook chapters first and dashboards second**. Each major route uses visible chapter framing, a fine guide rule, a route marker and a tactile note, stamp or pin cue.
- The checklist is an **arrival path**: moss denotes completed ground, cobalt denotes the next guided action, and paper-grey denotes future steps.
- **Atlas Cobalt `#174CCF`** is used only for primary route actions, active states and guide emphasis. Paper, oyster and ink surfaces carry the visual weight.
- Major landing sections carry a visible wayfinding cue—route number, folded-map/arrival point, guide rule, stamp, pin or marginal label—so the visual system is recognisably ShefGuide beyond its copy.
- Calls to action use **offered-next-step language**: “Start with a question” and “Save your route” replace conversion-first account messaging except where route-saving is explicit.
