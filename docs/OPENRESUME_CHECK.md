# OpenResume: a second, manual readability check

The packet's **parse check** (Resume tab) reads the stored PDF back with PDF.js and the Word file with Mammoth. OpenResume's parser is a different program with its own rules for finding sections and fields, so running the same PDF through it is a cheap second opinion. It is a manual step; nothing in this repo calls it.

**What it is, and is not.** OpenResume is an open-source resume builder with a resume parser page, described in its README as a way "to test a resume's ATS readability". It is not any employer's ATS, and passing it does not predict a ranking. It tells you whether a generic parser can pull your contact details, education, experience and skills out of the PDF.

**License.** OpenResume is AGPL-3.0 (github.com/xitanggg/open-resume). Use the hosted page or run your own copy, but do not copy its parser code into this repo (an AGPL dependency in a public repo would carry AGPL obligations with it). This is why part 6 is a doc and not code.

## When to run it

- After changing the resume template or renderer (`supabase/functions/_shared/render.ts`, `render_pdf.ts`).
- Before the first real application with a new base resume.
- Not per application: the parse check on the packet already covers each tailored file.

## Run it on a sample, not your real resume

Your real packet PDF carries your name, email and phone. The README says the app "only runs locally on your browser" and "no data ever leaves your browser", but it makes that claim under the resume builder, not the parser page, so it is not confirmed for uploads to the parser. Use fake data. The renderer test writes sample PDFs with a made-up person:

```sh
mkdir -p /tmp/resume-samples
PDF_OUT=/tmp/resume-samples deno test -A supabase/functions/_shared/render_pdf_test.ts
```

That writes `resume.pdf` (and `letter.pdf`) through the real renderer. The sample runs to two pages by design (it tests wrapping), so for a one-page check, trim its bullets in `render_pdf_test.ts` locally and do not commit the change.

If you want to check a real packet, do it only after confirming in your browser's network tab that the page sends nothing when you pick the file, or run OpenResume yourself (`git clone https://github.com/xitanggg/open-resume`, then its README steps) so the file never leaves your machine.

## Steps

1. Open the parser page. The README links its algorithm write-up at `https://open-resume.com/resume-parser`; the parser page is very likely at the same address (inferred from the link and the project's `/resume-parser` route, not stated outright).
2. Upload the PDF. It takes PDF only as far as the README says; it does not mention Word files.
3. Compare what it shows with the expected values below.

## What to compare

| Check | Pass |
|---|---|
| Name, email, phone, location | Each lands in its own field, not merged into one line |
| Education | School, degree and date each found; GPA if listed |
| Work experience | Each employer and title found, dates attached to the right job, every bullet under the right job |
| Projects | Each project heading found, bullets attached |
| Skills | The skills line comes through, with the label ("Tools:") not swallowed into a skill |
| Nothing extra | No bullet text appearing as a field value, no sections merged |

Record any miss next to the parse-check result. A miss in OpenResume that the packet's parse check did not flag is a lead on a layout detail (date alignment, a heading name, a separator), not proof that an employer's system will fail.

## Known gaps

- The README does not list accepted file types, the page's output format or the parser's limitations. Check those on the page itself before relying on them.
- It is PDF-based and uses PDF.js for its first step, so it is not independent of the packet's PDF.js check on text extraction; its value is the second layer (section and field detection).
