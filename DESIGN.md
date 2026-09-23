# Clockwork Garden

A small brass-and-botanical instrument. Open one HTML file, press **Wake the garden**, and hear six welcoming flowers. No network, account, downloaded assets or AI runtime.

## Exact musical rules
The garden is a 16-column, 8-row musical bed. One column is one eighth note. A moving gold scan line completes a two-bar phrase. Moving right delays a flower's pattern by one eighth note per column. Moving up selects higher notes in C major pentatonic. Rows from bottom to top are C3, D3, E3, G3, A3, C4, D4, E4. Quantization makes every placement musical.

Four species have distinct original shapes and synthesized voices. Bellflower uses a rounded sine bell at offsets 0 and 8. Copper Clover uses a triangle pluck at 0, 3 and 6. Glass Reed uses a soft sustained fundamental and octave at 0 and 8. Velvet Moss uses a low sine pulse at 0, 4, 8 and 12, one octave below its row. Levels and envelopes are conservative. Tempo is 60–120 BPM, initially 84. Population is at most 16, one flower per cell.

A directed vine connects one flower to another. Each flower has at most one outgoing vine. Whenever a source plays its own pattern, its target gives one quiet reply an eighth note later using the target's species and pitch. Replies cannot create further replies, even in cycles. Reconnecting replaces the outgoing vine. The visual shows direction and the target pulses with its actual sound.

## Interaction and appearance
Ivory paper, deep green bed, brass rails, original SVG botanical mechanisms. Upright Georgia/Baskerville/serif everywhere. Four seed buttons select a species. Click or tap an empty cell to plant. Click an existing flower to select, then drag it or use arrow keys. Inspector exposes pitch/timing, connect, remove and accessible movement. Play/pause, volume, tempo, clear and restore example are visible. Tooltips supplement but never replace readable instructions. Phone layout stacks, with a horizontally scrollable garden retaining 48px musical cells and minimum 44px primary controls. This supersedes the initial scroll-free aspiration after actual phone inspection found tiny flower targets. Touch swipes scroll, taps select, and visible movement buttons avoid gesture conflicts. A Plant selected seed button supports keyboard and touch planting. Reduced motion keeps audio pulses subtle and removes decorative motion.

## Reliability and delivery
Web Audio begins only on a user gesture. One bounded look-ahead scheduler uses audio-clock time, and pauses on tab hiding. Resume restarts the phrase, with no backlog. Local save is explicit, with visible storage errors. JSON export/import and a composition-only URL fragment are validated against strict caps. A local fragment is not advertised as a publicly hosted link. Package contains standalone HTML, editable source, README and tests. Verify real browser input and output signal, inspect desktop and phone screenshots, then open a freshly extracted package. Disclose lack of subjective listening or physical-device coverage rather than claiming either.
