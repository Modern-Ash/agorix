# Ori review body cancellation guard

The internal streaming body reader now accepts an optional `AbortSignal` and returns `null` if the signal is aborted before reading, between chunks, or before returning parsed metadata. It never invokes the downstream Ori review.

Tests cover pre-aborted input, abort between chunks and abort after the final chunk.

## Explicit limitation

This is cooperative cancellation only: an `AbortSignal` cannot by itself interrupt an asynchronous iterator blocked waiting for the next network chunk. A future HTTP route must connect the request's abort/close events to an abort controller, enforce an independent deadline, and destroy or close the underlying stream on cancellation. A complete timeout implementation requires a separate tested change. This increment does not register an endpoint or enable Ori for children.
