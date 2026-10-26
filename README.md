# SGX.Graffiti

Paint 3D graffiti in mid-air with your hand, right in the browser. A Spatialgineers experience.

**Live:** https://spatialgineers.github.io/sgxgraffiti/

- **Hand tracking** with MediaPipe, running on-device (video never leaves the browser).
- **Pinch or fist** to press the nozzle; move your hand towards the camera to paint in depth.
- **Mouse, touch and pen** work too, with or without a camera.
- Three caps (Skinny, Fat, Flare), speed-sensitive ink, realistic drips, glow.
- Undo/redo, autosave, PNG export with watermark, two backdrops, ES/EN.

## Controls

| | |
|---|---|
| Pinch / fist | Spray (hand tracking) |
| Drag (Paint tool) | Spray with mouse / finger |
| Right-drag, two fingers | Orbit while in Paint tool |
| `B` / `V` | Paint tool / Orbit tool |
| `1` `2` `3` | Skinny / Fat / Flare cap |
| `[` `]` | Smaller / larger brush |
| `Z`, `Shift+Z` | Undo / redo |
| `S` | Save image |
| `H` | Hide the interface (for projection) |
| `Delete` | Clear (undoable) |

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (spray engine, gestures, filters, history)
npm run build      # typecheck + production build into dist/
```

The camera needs a secure context: `localhost` or HTTPS.

## Architecture

```
src/
  paint/      Spray engine: incremental, seeded particle builder, cap profiles, shader
  tracking/   MediaPipe hand tracker, gesture detection, One Euro smoothing
  input/      Shared cursor state (hand + pointer) and pointer painting
  scene/      react-three-fiber scene: strokes, live stroke, backdrops, effects
  ui/         Top bar, dock, panels, onboarding, toasts
  state/      Zustand store: brush, strokes, undo/redo, settings (persisted)
```

Key ideas:

- **Strokes store inputs, not particles.** Each stroke keeps its samples and a seed; particles are
  regenerated deterministically, so autosave stays small and a stroke looks identical live and after release.
- **Incremental and bounded.** Each new sample only appends particles for its own segment, and only the new
  range is uploaded to the GPU. A per-sample cap means a fast jump can never freeze a frame.
- **Tracking stays out of React.** The tracker runs once per camera frame and writes into a shared mutable
  cursor; React only re-renders on coarse state changes (hand found/lost, spraying on/off).

## Deployment

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` to GitHub Pages on every push to `main`.
In the repository settings, **Pages → Build and deployment → Source** must be set to **GitHub Actions**.
