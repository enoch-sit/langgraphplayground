# UI Layout Fix: StateInspector Panel

## Problem

The UI was only showing the StateInspector panel with "No thread selected" message, while the other panels (graph, chat, controls) were missing.

## Root Cause

The StateInspector panel was placed **outside** the `main-content` div in App.tsx:

```tsx
<div className="main-content">   {/* 4-column grid container */}
  <div className="panel left-panel">...</div>      {/* Column 1 */}
  <div className="panel center-panel">...</div>    {/* Column 2 */}
  <div className="panel right-panel">...</div>     {/* Column 3 */}
</div>  {/* ← Grid ENDS here */}

{/* StateInspector was HERE - outside the grid! */}
<div className="panel state-inspector-panel">
  <StateInspector ... />
</div>
```

Because it was outside the grid container, the CSS rule:
```css
.main-content {
  display: grid;
  grid-template-columns: 300px 1fr 350px 400px;  /* 4 columns */
}
```

Only applied to the first 3 panels, and the StateInspector was rendered below them (or overlapping).

## Solution

Moved the StateInspector panel **inside** the `main-content` div:

```tsx
<div className="main-content">   {/* 4-column grid container */}
  <div className="panel left-panel">...</div>       {/* Column 1: Controls */}
  <div className="panel center-panel">...</div>     {/* Column 2: Graph */}
  <div className="panel right-panel">...</div>      {/* Column 3: Chat */}
  
  {/* Column 4: State Inspector - NOW INSIDE THE GRID! */}
  <div className="panel state-inspector-panel">
    <StateInspector threadId={currentThreadId} onRefresh={handleStateRefresh} />
  </div>
</div>  {/* ← Grid ENDS here with all 4 columns */}
```

## Result

Now all 4 panels are properly laid out in a grid:

```
┌─────────┬────────────┬─────────┬──────────────┐
│         │            │         │              │
│ Controls│   Graph    │  Chat   │    State     │
│         │  Viz       │         │  Inspector   │
│ 300px   │    1fr     │ 350px   │    400px     │
│         │            │         │              │
└─────────┴────────────┴─────────┴──────────────┘
```

## Files Modified

✅ `frontend/src/App.tsx` - Moved StateInspector inside main-content div

## Testing

1. Refresh the page in your browser
2. You should now see all 4 panels:
   - **Left**: Thread controls and live state
   - **Center**: Graph visualization
   - **Center-right**: Chat messages
   - **Right**: State Inspector

## Verification

The layout should now match the design:
- All panels visible side-by-side
- StateInspector shows "No thread selected" initially (expected)
- Create a thread to populate all panels
