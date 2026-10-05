# EAD 2026 badge and lanyard artwork reference

## Sources

- Official Egypt Arbitration Days website: https://egyptarbitrationdays.com/
- User-provided specification and reference: `client/public/assets/ead-reference.jpg` (the original 1280 × 635 reference image was supplied inside the user's ZIP archive; the Markdown prompt is the project brief).
- Authentic EAD mark and badge artwork bundled in `client/public/assets/`: `ead-wordmark.png`, `ead-monogram.jpg`, `ead-badge-front.jpg`, `ead-badge-back.jpg`, and `ead-lanyard-strip.jpg`.

## Badge face mapping

The reference labels the ID badge as 7.4 × 10.5 cm and shows both faces side by side. **Front/name-tag side:** red EAD header, blank white center, red geometric footer. The white center is the writable attendee-information panel; place attendee name, company and title there. **Back/event-art side:** blue EAD event artwork and event dates; do not place attendee details over this face. Preserve this front-then-back order in the on-screen preview and print/PDF output.

## Physical output

- One badge face per PDF page, front first and back second.
- Each page is exactly 74 × 105 mm with zero margins and no browser/app chrome.
- Use actual `<img>` artwork, not CSS background-only artwork, so the supplied art is retained when browser print backgrounds are disabled.
- Keep print content in normal document flow; a fixed print layer can repeat on each page. Avoid stray page breaks after the reverse face.
- The separate lanyard reference is 50 × 1.5 cm; it is shown in the staff design preview, not registration.
