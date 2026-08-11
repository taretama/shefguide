# Data safety when using AI tools

> Curated general guidance for the ShefGuide prototype. This is the project's
> own knowledge base, not an official University of Sheffield publication.

## What happens to text you paste into a cloud AI tool

Commercial AI assistants are cloud services: text submitted to them leaves
your device and is processed on the provider's servers, which are frequently
located outside the UK. Depending on the product and account type, submitted
content may be retained and, in some consumer tiers, used to improve the
provider's models. Free consumer tiers and paid or institutional tiers often
differ substantially on this point.

## Why this matters more for international students

International students commonly need help with documents that contain
sensitive personal information: visa correspondence, financial statements,
accommodation contracts, and medical or wellbeing correspondence. Research on
student LLM use reports that personally identifiable information is often
disclosed to these tools without the student realising it is being retained
or processed.

## Practical precautions

Remove identifying details before pasting text into a general-purpose AI
tool. Passport and visa numbers, student ID numbers, National Insurance
numbers, bank details, home addresses, and dates of birth are rarely
necessary for the assistant to answer a question usefully.

Prefer institutionally provided AI services where they exist, since these
are normally covered by an agreement with the provider that restricts
retention and training on submitted content.

Treat AI output as a draft to verify rather than an authority, particularly
for anything with legal, financial, or immigration consequences.

## How ShefGuide handles this

ShefGuide shows a disclosure before a student's first AI-backed request,
making clear that queries are processed by a third-party cloud provider. It
runs an automated check that redacts common categories of personally
identifiable information from a message before it is sent to a model, and it
screens for prompt-injection patterns. Requests are rate limited per user.

These are mitigations, not guarantees. Students should still avoid sending
sensitive personal data, and should use the university's own support services
for immigration, financial, medical, and wellbeing matters.

---

## Provenance

- **Authored by:** the researcher, as part of the ShefGuide artefact.
- **Basis:** general, widely-held conventions of UK higher education. Written
  at a level of generality that holds across UK institutions.
- **Status:** prototype content. Not institutional policy, and not a substitute
  for it. Where a claim would depend on a specific institution's rules, the
  text defers to the module handbook, the library guide, or the relevant
  support service rather than asserting a rule.
- **Sources consulted:** none recorded. If this file is later replaced with or
  grounded in published institutional guidance, list the page title, publisher,
  URL, and date accessed here so the content is traceable and citable.
- **Last reviewed:** 2026-08-05.
