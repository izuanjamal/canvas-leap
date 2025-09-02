// The initial board ID to fetch from the backend (optional).
// If empty, the app will load a local sample board.
// TODO: Set this to an existing board ID from your database when ready.
export const initialBoardId = "";

// Recommendation: Start with this DOM-based canvas approach for rapid iteration.
// If you need high-performance vector drawing (freehand, shapes), consider migrating
// the rendering of those layers to HTML5 Canvas or Fabric.js while keeping the
// existing pan/zoom math and store structure intact.
