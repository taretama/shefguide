# Data safety when using AI tools

> Curated guidance for the ShefGuide prototype, grounded in the Information
> Commissioner's Office (ICO) guidance on AI and data protection (see
> Provenance below). The ICO is the UK's independent regulator for data
> protection and UK GDPR.

## What happens to text you send to a cloud AI tool

Commercial AI assistants are cloud services: text submitted to them leaves
your device and is processed on the provider's servers, which are
frequently located outside the UK. Where an AI system processes personal
data, UK GDPR applies to that processing in the same way it applies to any
other automated system, and the organisation running it must have a lawful
basis for that processing, must be transparent about what is collected and
why, and must not collect more personal data than the purpose requires
(ICO, "Guidance on AI and data protection").

Depending on the product and account type, submitted content may be
retained and, in some consumer tiers, used to improve the provider's
models. Free consumer tiers and paid or institutional tiers often differ
substantially on this point, and a service's own privacy notice is the
authoritative source for what actually happens to a specific submission.

## Why this matters more for international students

International students commonly need help with documents that contain
sensitive personal information: visa correspondence, financial statements,
accommodation contracts, and medical or wellbeing correspondence. It is
easy to disclose this kind of information to a general-purpose AI tool
without stopping to consider that it is being retained, processed by a
provider outside the UK, or shared with a sub-processor as part of the
service.

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
making clear that queries are processed by a third-party cloud provider
(OpenAI or Google, depending on the model selected) — the kind of
transparency the ICO's guidance treats as a baseline expectation for any
service built on AI. It runs an automated check that redacts common
categories of personally identifiable information from a message before it
is sent to a model, and it screens for prompt-injection patterns. Requests
are rate limited per user.

These are mitigations, not guarantees. Students should still avoid sending
sensitive personal data, and should use the university's own support
services for immigration, financial, medical, and wellbeing matters.

---

## Provenance

- **Authored by:** the researcher, drafted with AI assistance as part of the
  ShefGuide artefact, and grounded in the published ICO guidance listed
  below.
- **Basis:** the Information Commissioner's Office's guidance on AI and data
  protection, which sets out how UK GDPR principles (lawfulness,
  transparency, data minimisation) apply to systems that process personal
  data using AI.
- **Status:** prototype content, written for general applicability. It is
  not legal advice, and a specific AI provider's own privacy notice is
  authoritative for what happens to data submitted to that product.
- **Sources consulted:**
  - ICO (Information Commissioner's Office) (n.d.) "Guidance on AI and data
    protection."
    https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/
    (accessed 2026-08-11).
- **Last reviewed:** 2026-08-11.
