# Banco CAD

[Italiano](README.md) · **English**

A parametric 3D modeller for schools, inspired by SolidWorks, in **a single HTML page**: double-click it to open it in Chrome, Edge or Firefox. There is nothing to install and it works offline.

> The program's interface is in **Italian**. This page explains what it does and how to use it; command names are given in Italian with their meaning.

![Banco CAD: flange with hub and six holes in isometric view](docs/img/modello-3d.png)

Designed for technical secondary schools (mechanical and mechatronic engineering): students learn the workflow of professional CAD (dimensioned sketch, features, feature tree, ISO technical drawings) on a lightweight program that runs on any school computer or tablet.

---

## Contents

1. [Getting started](#getting-started)
2. [Your first part in 6 steps](#your-first-part-in-6-steps)
3. [View controls](#view-controls)
4. [What it can do](#what-it-can-do)
5. [Guide, glossary and exercises](#guide-glossary-and-exercises)
6. [Verified calculations](#verified-calculations)
7. [For developers](#for-developers)

---

## Getting started

1. Download [`index.html`](index.html): on the file's page press the download button (the arrow at the top right).
2. Double-click it: it opens in your browser.
3. Press **Guida** (Guide) at the top right and start with «Il primo pezzo in 6 passi» (your first part in 6 steps), or open the **Esercitazioni** (Exercises) tab.

Your work is saved automatically in the browser. To move it to another computer use **Progetto › Esporta il progetto** (Project › Export) and then **Importa un progetto** (Import).

With **Progetto › Importa STL o OBJ** (Project › Import STL or OBJ) you can also open a part made with another program (SolidWorks, Inventor, Tinkercad… saved as STL or OBJ): it arrives as a faceted body that you can measure, put on a drawing and weigh, and you can add sketches and features on its flat faces.

With **Progetto › Importa DXF (schizzo)** (Project › Import DXF), or **Inserisci DXF** (Insert DXF) in the Sketch tab, a 2D drawing (AutoCAD, DraftSight, LibreCAD, a SolidWorks drawing…) becomes a sketch: lines, arcs, circles, polylines and blocks, in the file's units; dash-dot axes become centerlines. Then you extrude or revolve it.

## Your first part in 6 steps

Every model follows the same path: **dimensioned sketch → feature**.

![Sketch of an 80 × 50 plate with a Ø20 hole, fully defined](docs/img/schizzo.png)

1. **Schizzo › Schizzo** (Sketch › Sketch), then choose the **Piano superiore** (Top plane).
2. Draw a **Rettangolo** (Rectangle) starting from the origin (the pointer snaps to it).
3. With **Quota intelligente** (Smart Dimension) click a side, click where to place the dimension and type the value (80, then 50).
4. When the sketch turns **black** it is *fully defined*: shape and position are fixed.
5. Press **Estrusione base** (Extruded Boss, Features tab): the sketch is confirmed automatically.
6. Type the depth and confirm with ✓.

Sketch colours tell you where you are: **blue** = dimensions or relations still missing, **black** = fully defined, **red** = one dimension or relation too many.

## View controls

| Action | Mouse | Tablet |
|---|---|---|
| Move left / right | wheel | tap the part, then two fingers |
| Rotate | Ctrl + wheel, or drag with the left button on empty space | tap the part, then one finger |
| Zoom | Shift + wheel | two fingers (always) |
| Move in any direction | drag with the right button (or Shift + left) | tap the part, then two fingers |
| Fit the part to the window | **F** key or the first button of the view toolbar | first button of the view toolbar |
| Standard views (Front, Top, Isometric…) | space bar | orientation button in the view toolbar |

On a tablet, when you tap the part the view gets a blue border and «Pezzo preso» (part grabbed) appears. Tap empty space or press «Lascia» (release) to let go.

## What it can do

### Parametric sketch

Line, corner and centre rectangle, circle, arcs (centre-ends, 3-point, tangent), polygon, slot, point, centreline and construction geometry; sketch fillet and chamfer, trim, mirror and convert entities. Geometric relations (coincident, horizontal, vertical, parallel, perpendicular, tangent, equal, concentric, symmetric…) and **Smart Dimension** for lengths, distances, diameters, radii and angles.

### Features

![Block with all edges filleted R6: spherical corners](docs/img/raccordi.png)

- **Extruded boss** and **Extruded cut**: blind, through all, mid-plane, two directions, **draft**.
- **Revolved boss** and **Revolved cut** for turned parts.
- **Swept boss** and **Swept cut** along tangent lines and arcs.
- **Rib** from an open line, automatically extended to the part.
- **Hole wizard** to standards: clearance (ISO 273), counterbore (DIN 974-1), countersink (ISO 15065), tapped (tap drill), M3 to M20.
- **Fillet** and **Chamfer** on edges, all processed **together** as in SolidWorks: where two fillets meet they blend, where three meet at a right angle the corner becomes a spherical patch.
- **Linear pattern** (also as a grid), **Circular pattern**, **Mirror**, **Reference plane**.
- Feature tree with edit, suppress, rollback bar, undo and redo.

### Evaluate

Mass properties (volume, area, mass, centre of mass, bounding box) computed on the exact surfaces, 13 materials (steels, cast iron, aluminium, brass, copper, plastics), measure, section view.

### Drawings

![Drawing of the flange: first-angle views, dimensions, title block](docs/img/messa-in-tavola.png)

Orthographic views in **first-angle projection** (ISO 5456-2), hidden lines, centre lines, hatched section views, dimensions (also automatic), title block, A4 to A2 sheets with standard scales. Print to scale or to PDF, export to **SVG** and **DXF** (for AutoCAD). The Project menu also exports **STL** for 3D printing.

## Guide, glossary and exercises

![«How to» guide: fillet and chamfer edges](docs/img/guida.png)

- **Guida** (Guide, button at the top): 41 «how to» topics with numbered steps, tips and terms. **Mostrami dove** (Show me where) opens the right tab and makes the command blink.
- **Glossario** (Glossary): more than 130 terms explained in plain words (commands, relations, options, standards). The small **ⓘ** next to panel headings opens the explanation of that item.
- **Esercitazioni** (Exercises): 8 mechanical parts, from a drilled plate to a lever with tangent eyes, each with its drawing to reproduce, a suggested procedure and **automatic checking** of the model (bounding box, volume, area, fully defined sketches).

![Exercise 2: L-bracket with its drawing](docs/img/esercitazioni.png)

## Verified calculations

Every calculation is checked by automatic tests: 77 test parts (extrusions, revolutions, cuts, fillets and chamfers including several edges at once, ISO holes, patterns, mirror, draft, sweep, ribs, bodies imported from STL and OBJ, sketches imported from DXF, dimensioned sketches) are rebuilt and their volume, area, centre of mass and bounding box are compared with values worked out by hand with geometry formulas. The allowed error is **1 %**; today it is practically zero.

The same tests can be run inside the program: **Valuta › Autoverifica** (Evaluate › Self-check).

![Self-check: 66 tests passed](docs/img/autoverifica.png)

## For developers

The program is one file, `index.html`, with HTML, CSS and JavaScript together (no dependencies, no build step). The tests use Node.js and Playwright.

```bash
npm install
npx playwright install chromium   # first time only
npm test                          # all tests
npm run test:kernel               # calculations only (66 tests, a few seconds)
npm run test:ui                   # interface only, in Chromium (33 tests)
```

If you already have Chromium installed you can point to it with `CHROMIUM_PATH=/path/to/chrome npm run test:ui`. When a test fails, screenshots are saved in `tests/output/`.

```
index.html            the complete program
docs/img/             the images in this README
tests/extract.js      extracts the calculation modules from the file to test them in Node
tests/kernel.test.js  calculation tests (the same as the in-app Self-check)
tests/ui.test.js      interface tests with Playwright
```

The interface tests use the program the way a student would: they draw with the mouse, type dimensions, press buttons, simulate fingers on a tablet and reload the page. They also check that every command is explained in the Guide and the Glossary.
