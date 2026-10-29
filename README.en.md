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

> [!IMPORTANT]
> **How to use Banco CAD**
>
> **Banco CAD does not run on GitHub:** GitHub stores the file but does not run it. You must **download the file and open it in your browser**.
>
> 1. Open the file [`index.html`](index.html).
> 2. GitHub says the file is too big to display ("Sorry about that, but we can't show files that are this big right now"): **this is normal**, the file is fine. Press the **Download raw file** button: the **down arrow** at the top right. Do **not** press "Raw" or "View raw": they would only show the program's text.
> 3. The downloaded file is called `index.html`, **like the DWG → DXF converter**: rename it, for example `banco-cad.html`, so you don't mix them up.
> 4. **Double-click** it: it opens in Chrome, Edge or Firefox. No internet needed.
> 5. Press **Guida** (Guide) at the top right and start with «Il primo pezzo in 6 passi» (your first part in 6 steps), or open the **Esercitazioni** (Exercises) tab.

Your work is saved automatically in the browser. To move it to another computer use **Progetto › Esporta il progetto** (Project › Export) and then **Importa un progetto** (Import).

With **Progetto › Esporta STEP** (Project › Export STEP) the part opens in another CAD program (SolidWorks, Inventor, Fusion, FreeCAD…): cylinders, cones, spheres and tori arrive as **true surfaces**, with circular or elliptical edges, as SolidWorks would write them; only surfaces that cannot be written exactly (for example two crossing cylinders) arrive as flat facets. **Salva PDF** (Save PDF) saves the drawing, the sketch or the 3D view.

With **Progetto › Importa STEP o IGES** (Project › Import STEP or IGES) you can open a part (or a small assembly) made with another CAD program (SolidWorks, Inventor, Fusion, FreeCAD… saved as STEP or IGES): it arrives with its real faces and the file's units; you can measure it, put it on a drawing, get volume and mass with an error well below 1 %, and add sketches and features on it. If the file holds several bodies you choose which ones to import, and each arrives as its own «Importato» feature (or all together in one); face colours written in the file show on the part. The reader is OpenCascade, compressed inside the page: it works offline too, and reads the file in the background so the page never freezes (reading can be cancelled).

With **Progetto › Importa STL o OBJ** (Project › Import STL or OBJ) you can also open a part made with another program (SolidWorks, Inventor, Tinkercad… saved as STL or OBJ): it arrives as a faceted body that you can measure, put on a drawing and weigh, and you can add sketches and features on its flat faces.

With **Progetto › Importa DXF (schizzo)** (Project › Import DXF), or **Inserisci DXF** (Insert DXF) in the Sketch tab, a 2D drawing (AutoCAD, DraftSight, LibreCAD, a SolidWorks drawing…) becomes a sketch: lines, arcs, circles, polylines, ellipses, splines and blocks, in the file's units; ellipses and splines become chains of tangent arcs (biarcs) within a few thousandths of a millimetre of the true curve; dash-dot axes become centerlines. The dialog shows a preview of the drawing and lets you pick the layers to import (for example without the title block and dimensions). Then you extrude or revolve it.

AutoCAD **DWG** files are first turned into DXF with the **DWG → DXF converter** (*Convertitore DWG → DXF*), a separate page (folder `convertitore-dwg/`): it works in the browser with the free LibreDWG reader, from release R1.4 to 2018 (so files from AutoCAD 2019–2025 too). It is a separate program under the GNU GPL 3; Banco CAD links to it when a DWG is chosen and also opens the `.zip` in which the published page saves DXF files.

> [!IMPORTANT]
> **How to use the DWG → DXF converter**
>
> **The converter does not run on GitHub:** GitHub stores the file but does not run it. You must **download the file and open it in your browser**.
>
> 1. Open the file [`convertitore-dwg/index.html`](convertitore-dwg/index.html).
> 2. GitHub says the file is too big to display ("Sorry about that, but we can't show files that are this big right now"): **this is normal**, the file is fine. Press the **Download raw file** button: the **down arrow** at the top right. Do **not** press "Raw" or "View raw": they would only show the program's text.
> 3. The downloaded file is called `index.html`, **like Banco CAD**: rename it, for example `convertitore-dwg.html`, so you don't mix them up.
> 4. **Double-click** it: it opens in Chrome, Edge or Firefox. No internet needed.
> 5. Press **Scegli i file DWG** (*choose DWG files*, or drag the `.dwg` files onto the page), check the **preview**, then press **Salva DXF** (*save DXF*) next to each drawing, or **Salva tutti i DXF (.zip)** (*save all DXF*) to get them in one file.
> 6. In Banco CAD: **Progetto › Importa DXF (schizzo)** and choose the `.dxf` file you just saved.
>
> It also works on **tablets and phones**: the converter starts with 16 MB of memory and takes more only for large drawings.

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
| Zoom (in and out) | wheel, towards the pointer: forward zooms in, backward zooms out (in drawings too) | two fingers (always) |
| Rotate | Ctrl + wheel, or drag with the left button on empty space | tap the part, then one finger |
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
- **Fillet** and **Chamfer** on edges, all processed **together** as in SolidWorks: where two fillets meet they blend, where three meet at a right angle the corner becomes a spherical patch. Arcs (slots) and the edge of an imported ellipse or spline can be filleted too; one click picks the whole curved edge. With **tangent propagation** (as in SolidWorks) one click on an edge also processes the edges that continue it without a corner, for example the whole edge of a slot.
- **Linear pattern** (also as a grid), **Circular pattern**, **Mirror**, **Reference plane**.
- Feature tree with edit, suppress, rollback bar, undo and redo.

### Evaluate

Mass properties (volume, area, mass, centre of mass, bounding box) computed on the exact surfaces, 13 materials (steels, cast iron, aluminium, brass, copper, plastics), measure, section view.

### Drawings

![Drawing of the flange: first-angle views, dimensions, title block](docs/img/messa-in-tavola.png)

Orthographic views in **first-angle projection** (ISO 5456-2), hidden lines, centre lines, hatched section views, dimensions (also automatic), title block, A4 to A2 sheets with standard scales. The isometric view can be **shaded**, with the part's colours (including those of a STEP file). **Salva PDF** (*save PDF*: a vector PDF of the drawing on the real sheet size, at 1:1), print to scale, export to **SVG** and **DXF** (for AutoCAD). The Project menu also saves a PDF of the open sketch (vector, at the largest standard scale that fits an A4 sheet) or of the 3D view, exports the part as **STEP** to open it in SolidWorks, Inventor, Fusion or FreeCAD (a solid in millimetres; curved surfaces split into flat faces) and as **STL** for 3D printing.

## Guide, glossary and exercises

![«How to» guide: fillet and chamfer edges](docs/img/guida.png)

- **Guida** (Guide, button at the top): 41 «how to» topics with numbered steps, tips and terms. **Mostrami dove** (Show me where) opens the right tab and makes the command blink.
- **Glossario** (Glossary): more than 130 terms explained in plain words (commands, relations, options, standards). The small **ⓘ** next to panel headings opens the explanation of that item.
- **Esercitazioni** (Exercises): 8 mechanical parts, from a drilled plate to a lever with tangent eyes, each with its drawing to reproduce, a suggested procedure and **automatic checking** of the model (bounding box, volume, area, fully defined sketches).

![Exercise 2: L-bracket with its drawing](docs/img/esercitazioni.png)

## Verified calculations

Every calculation is checked by automatic tests: 110 test parts (extrusions, revolutions, cuts, fillets and chamfers including several edges at once, arcs, the edges of ellipses and splines and tangent propagation, ISO holes, patterns, mirror, draft, sweep, ribs, bodies imported from STL, OBJ, STEP and IGES, sketches imported from DXF including ellipses and splines, dimensioned sketches) are rebuilt and their volume, area, centre of mass and bounding box are compared with values worked out by hand with geometry formulas. The allowed error is **1 %**; today it is practically zero. Another 14 tests run the real reader on STEP and IGES files written for the purpose (blocks, cylinder, plate with a hole, different units, assemblies with colours, damaged files), and 14 read back the STEP files exported by Banco CAD: with true surfaces the volume read back is the exact one (sphere, cone, tube, plate with holes).

The same tests can be run inside the program: **Valuta › Autoverifica** (Evaluate › Self-check).

![Self-check: 66 tests passed](docs/img/autoverifica.png)

## For developers

The program is one file, `index.html` (about 5 MB), with HTML, CSS and JavaScript together, no build step. The only part not written here is the STEP/IGES reader (occt-import-js with OpenCascade, LGPL 2.1 licence), compressed at the end of the page: licences and how to replace it are in `licenze/`. The tests use Node.js and Playwright.

```bash
npm install
npx playwright install chromium   # first time only
npm test                          # all tests
npm run test:kernel               # calculations only (152 + 28 STEP/IGES and exported STEP + 14 DWG converter tests, about a minute)
npm run test:ui                   # interface only, in Chromium (52 tests)
```

If you already have Chromium installed you can point to it with `CHROMIUM_PATH=/path/to/chrome npm run test:ui`. When a test fails, screenshots are saved in `tests/output/`.

```
index.html            the complete program
docs/img/             the images in this README
tests/extract.js      extracts the calculation modules from the file to test them in Node
tests/kernel.test.js  calculation tests (the same as the in-app Self-check)
tests/ui.test.js      interface tests with Playwright
tests/pdfcheck.py     reads the saved PDFs back with pdfplumber (Python) and measures them in mm
tests/step.test.js    tests of the real STEP/IGES reader and of exported STEP files (read back with OpenCascade)
tests/stepgen.js      writes small STEP test files (igesgen.js: IGES)
tests/dwg.test.js     tests of the DWG → DXF converter (DWG from R11 to 2018, compared with reference DXF files)
tools/incorpora-occt.js  inserts or updates the STEP/IGES reader in the page
licenze/              licences of the STEP/IGES reader (LGPL 2.1)
convertitore-dwg/     DWG → DXF converter, a separate GPL 3 program (LibreDWG): page, LEGGIMI (readme), tests
```

The interface tests use the program the way a student would: they draw with the mouse, type dimensions, press buttons, simulate fingers on a tablet and reload the page. They also check that every command is explained in the Guide and the Glossary.
