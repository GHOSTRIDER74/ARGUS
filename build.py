import copy, re
from lxml import etree
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION
from pptx.oxml.ns import qn

# ---------- palette ----------
NAVY = "1B2A49"; BLUE = "0070C0"; TXT = "26324A"; GRAY = "5B6B7F"
LBLUE = "EAF3FB"; WHITE = "FFFFFF"; PURPLE = "6A4C93"; GREEN = "2E7D32"; SLATE = "475569"
AMBER = "B26A00"; RED = "B3261E"; LINE = "C9D6E6"

def rgb(h): return RGBColor.from_string(h)

def tint(h, f=0.90):
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return "%02X%02X%02X" % tuple(int(c + (255 - c) * f) for c in (r, g, b))

# ---------- text helpers ----------
def parse_math(s):
    """'CO_<2>' -> sub run, 'S^<+>' -> sup run"""
    out, i, buf = [], 0, ""
    while i < len(s):
        if s[i] in "_^" and i + 1 < len(s) and s[i + 1] == "<":
            j = s.index(">", i)
            if buf: out.append((buf, {})); buf = ""
            out.append((s[i + 2:j], {"sub" if s[i] == "_" else "sup": True}))
            i = j + 1
        else:
            buf += s[i]; i += 1
    if buf: out.append((buf, {}))
    return out

def style_run(r, size, color, bold, italic, font, extra=None):
    r.font.size = Pt(size); r.font.bold = bold; r.font.italic = italic
    r.font.color.rgb = rgb(color); r.font.name = font
    if extra:
        if extra.get("sub"): r._r.get_or_add_rPr().set("baseline", "-25000")
        if extra.get("sup"): r._r.get_or_add_rPr().set("baseline", "30000")

def set_bullet(p, indent=0.22, char="•", color=None):
    pPr = p._p.get_or_add_pPr()
    pPr.set("marL", str(int(Inches(indent)))); pPr.set("indent", str(-int(Inches(indent))))
    if color:
        bc = etree.SubElement(pPr, qn("a:buClr")); c = etree.SubElement(bc, qn("a:srgbClr")); c.set("val", color)
    bf = etree.SubElement(pPr, qn("a:buFont")); bf.set("typeface", "Arial")
    bu = etree.SubElement(pPr, qn("a:buChar")); bu.set("char", char)

def set_tab(p, inches):
    pPr = p._p.get_or_add_pPr()
    tl = etree.SubElement(pPr, qn("a:tabLst")); t = etree.SubElement(tl, qn("a:tab"))
    t.set("pos", str(int(Inches(inches)))); t.set("algn", "l")

def fill_tf(tf, paras, size=14, color=TXT, bold=False, font="Calibri", align="l",
            anchor="t", margin=(0.1, 0.05), italic=False):
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(margin[0])
    tf.margin_top = tf.margin_bottom = Inches(margin[1])
    tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
    first = True
    for spec in paras:
        if isinstance(spec, str): spec = {"t": spec}
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        al = spec.get("align", align)
        p.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[al]
        if "after" in spec: p.space_after = Pt(spec["after"])
        if "before" in spec: p.space_before = Pt(spec["before"])
        psize = spec.get("size", size); pcol = spec.get("color", color)
        pbold = spec.get("bold", bold); pfont = spec.get("font", font); pital = spec.get("italic", italic)
        runs = spec.get("runs")
        if runs is None:
            runs = parse_math(spec["t"]) if spec.get("math") else [(spec["t"], {})]
        for txt, ov in runs:
            r = p.add_run(); r.text = txt
            style_run(r, ov.get("size", psize), ov.get("color", pcol), ov.get("bold", pbold),
                      ov.get("italic", pital), ov.get("font", pfont), ov)
            if ov.get("link"): r.hyperlink.address = ov["link"]
        if spec.get("bullet"): set_bullet(p, spec.get("indent", 0.22), color=spec.get("bucolor"))
        if "tab" in spec: set_tab(p, spec["tab"])
    return tf

def box(sl, x, y, w, h, fill=None, line=None, lw=1.0, shape=MSO_SHAPE.ROUNDED_RECTANGLE, rad=0.07, name=None):
    s = sl.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE: s.adjustments[0] = rad
    if fill: s.fill.solid(); s.fill.fore_color.rgb = rgb(fill)
    else: s.fill.background()
    if line: s.line.color.rgb = rgb(line); s.line.width = Pt(lw)
    else: s.line.fill.background()
    s.shadow.inherit = False
    if name: s.name = name
    return s

def card(sl, x, y, w, h, paras, fill=LBLUE, line=None, name=None, rad=0.06, **kw):
    s = box(sl, x, y, w, h, fill, line, name=name, rad=rad)
    fill_tf(s.text_frame, paras, **kw)
    return s

def tbox(sl, x, y, w, h, paras, name=None, **kw):
    s = sl.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    if name: s.name = name
    fill_tf(s.text_frame, paras, **kw)
    return s

def arrow(sl, x, y, w, h, kind="down", color=GRAY):
    shp = {"down": MSO_SHAPE.DOWN_ARROW, "right": MSO_SHAPE.RIGHT_ARROW}[kind]
    return box(sl, x, y, w, h, fill=color, shape=shp, name="Flow arrow")

def drop_body(sl):
    for sh in list(sl.shapes):
        if sh.name.startswith("Subtitle"):
            sh._element.getparent().remove(sh._element)

def set_title(sl, text, size=40):
    t = sl.shapes.title
    p = t.text_frame.paragraphs[0]
    runs = p.runs
    runs[0].text = text
    for r in runs[1:]: r._r.getparent().remove(r._r)
    runs[0].font.size = Pt(size)

def make_table(sl, x, y, colw, rows, header=True, rowh=0.45, hdrh=0.4, size=12, hdr_fill=BLUE,
               zebra=(WHITE, LBLUE), first_col_bold=False, name="Table", col_align=None):
    nr, nc = len(rows), len(colw)
    gs = sl.shapes.add_table(nr, nc, Inches(x), Inches(y), Inches(sum(colw)), Inches(hdrh + rowh * (nr - 1)))
    gs.name = name
    tb = gs.table
    tb.first_row = header; tb.horz_banding = False
    for j, wd in enumerate(colw): tb.columns[j].width = Inches(wd)
    for i, row in enumerate(rows):
        tb.rows[i].height = Inches(hdrh if (i == 0 and header) else rowh)
        for j, val in enumerate(row):
            c = tb.cell(i, j)
            c.margin_left = c.margin_right = Inches(0.1); c.margin_top = c.margin_bottom = Inches(0.04)
            c.vertical_anchor = MSO_ANCHOR.MIDDLE
            c.fill.solid()
            is_h = header and i == 0
            c.fill.fore_color.rgb = rgb(hdr_fill if is_h else zebra[(i - (1 if header else 0)) % 2])
            paras = val if isinstance(val, list) else [val]
            fill_tf(c.text_frame, [p if isinstance(p, dict) else {"t": p} for p in paras],
                    size=size, color=WHITE if is_h else TXT,
                    bold=is_h or (first_col_bold and j == 0), margin=(0.1, 0.04),
                    align=(col_align[j] if col_align else "l"), anchor="m")
    return gs

# =====================================================================
prs = Presentation("/tmp/work/struct.pptx")
S = list(prs.slides)
(s_title, s_toc, s_abs, s_int1, s_int2, s_lit1, s_lit2, s_req, s_des,
 s_imp1, s_imp2, s_imp3, s_test, s_res, s_con, s_po) = S

# ---------------- 1. Title ----------------
t = s_title.shapes.title.text_frame.paragraphs[0]
for r in t.runs:
    if r.text.strip() == "Project Title":
        r.text = ("ARGUS: A Digital Twin\u2013Based Framework for Process Drift Detection "
                  "and Dynamic Life Cycle Sustainability Assessment")
        r.font.size = Pt(22)
sub = [sh for sh in s_title.shapes if sh.name.startswith("Subtitle")][0]
paras = sub.text_frame.paragraphs
people = [("Akarsh Naik", "1BM23AD004"), ("Amogh Manjunath", "1BM23AD007"), ("Manoj Kumar N", "1BM23AD032")]
third = copy.deepcopy(paras[1]._p); paras[1]._p.addnext(third)
paras = sub.text_frame.paragraphs
for p, (n, u) in zip(paras[:3], people):
    p.runs[0].text = n + "\t" + u
    set_tab(p, 3.0)
for r in paras[4].runs: r.text = r.text.replace("Guide Name", "Dr. Shruthi K R")
for r in paras[5].runs: r.text = r.text.replace("Designation", "Assistant Professor")

# ---------------- 3. Abstract ----------------
drop_body(s_abs); set_title(s_abs, "Abstract")
items = [
    ("The problem", "Small, undetected shifts in process parameters silently reduce product quality and raise waste across dependent production stages.", 1.35),
    ("The gap", "Current monitoring raises alarms only after a limit is breached, and environmental impact is reported once a year, disconnected from daily operations.", 1.35),
    ("ARGUS", "A digital-twin framework that detects drift early with a hybrid CUSUM + LSTM autoencoder, names the root-cause sensor with SHAP, converts each event into rupee loss, and tracks energy and Scope 2 CO\u2082. Built on open-source tools for mid-size manufacturers.", 1.95),
]
y = 1.5
for lab, body, h in items:
    card(s_abs, 0.6, y, 8.3, h, [
        {"t": lab, "size": 13, "bold": True, "color": BLUE, "after": 3},
        {"t": body, "size": 15}], fill=LBLUE, name="Abstract card", anchor="m", margin=(0.2, 0.08))
    y += h + 0.2
stats = [("1,567", "production runs\n(UCI SECOM)"), ("590", "sensor channels"), ("6", "station digital twin"), ("7", "pipeline stages")]
for k, (num, lab) in enumerate(stats):
    cx = 9.2 + (k % 2) * 1.82; cy = 1.5 + (k // 2) * 2.5
    card(s_abs, cx, cy, 1.7, 2.3, [
        {"t": num, "size": 34, "bold": True, "color": WHITE, "align": "c", "after": 4},
        {"t": lab, "size": 13, "color": "CFE4F7", "align": "c"}], fill=NAVY, name="Stat tile", anchor="m")

# ---------------- 4. Introduction ----------------
drop_body(s_int1); set_title(s_int1, "Introduction")
card(s_int1, 0.6, 1.5, 12.13, 1.2, [
    {"t": "Context", "size": 13, "bold": True, "color": BLUE, "after": 2},
    {"t": "Mid-size electronics manufacturers produce circuit boards for automotive, medical and industrial use across multiple dependent production stages. A small deviation in one stage silently affects every stage after it, leading to defective products, wasted materials and missed sustainability targets.", "size": 14}],
    fill=LBLUE, name="Context card", anchor="m", margin=(0.2, 0.06))
card(s_int1, 0.6, 2.9, 12.13, 2.0, [
    {"t": "Motivation", "size": 13, "bold": True, "color": BLUE, "after": 3},
    {"t": "Large factories run costly AI-based monitoring; mid-size factories cannot afford it", "bullet": True, "after": 4},
    {"t": "Equipment degrades gradually, and manual checks catch problems only after damage is done", "bullet": True, "after": 4},
    {"t": "Environmental reports are filed once a year, out of touch with daily production", "bullet": True, "after": 4},
    {"t": "No affordable system catches issues early and tracks their environmental impact together", "bullet": True}],
    fill=LBLUE, name="Motivation card", size=15, anchor="m", margin=(0.2, 0.06))
tbox(s_int1, 0.6, 5.05, 4, 0.35, [{"t": "Objectives", "size": 13, "bold": True, "color": BLUE}], margin=(0.0, 0.02))
objs = [("Detect drift early", "Hybrid CUSUM + LSTM autoencoder"), ("Explain the root cause", "Kernel SHAP attribution"),
        ("Quantify the loss", "Scrap, downtime and energy in \u20b9"), ("Track sustainability", "Energy and Scope 2 CO\u2082 per event")]
for k, (a, b) in enumerate(objs):
    x = 0.6 + k * 3.06
    box(s_int1, x, 5.45, 2.9, 1.3, fill=WHITE, line=LINE, name="Objective tile")
    c = box(s_int1, x + 0.15, 5.6, 0.42, 0.42, fill=BLUE, shape=MSO_SHAPE.OVAL, name="Objective number")
    fill_tf(c.text_frame, [{"t": str(k + 1), "size": 14, "bold": True, "color": WHITE, "align": "c"}], anchor="m", margin=(0, 0))
    tbox(s_int1, x + 0.65, 5.52, 2.2, 0.6, [{"t": a, "size": 14, "bold": True, "color": NAVY}], anchor="m", margin=(0.02, 0.02))
    tbox(s_int1, x + 0.12, 6.12, 2.7, 0.55, [{"t": b, "size": 12.5, "color": GRAY}], margin=(0.05, 0.02))

# ---------------- 5. Intro 2: SDGs, existing vs proposed ----------------
drop_body(s_int2); set_title(s_int2, "Introduction: SDGs, Existing and Proposed System", 34)
sdgs = [("SDG 9: Industry, Innovation and Infrastructure", "F36D25",
         "ML-driven digital twin technology builds smarter, more resilient manufacturing infrastructure that mid-size producers can afford."),
        ("SDG 12: Responsible Consumption and Production", "BF8B2E",
         "Detecting drift early cuts scrap, rework cycles and chemical waste from etch bath overuse, directly reducing wasteful production."),
        ("SDG 13: Climate Action", "3F7E44",
         "The dynamic LCA engine computes CO\u2082 and energy changes triggered by drift, turning sustainability into an operational metric.")]
for k, (hd, col, bd) in enumerate(sdgs):
    x = 0.6 + k * 4.07
    h = card(s_int2, x, 1.45, 3.99, 0.5, [{"t": hd, "size": 12.5, "bold": True, "color": WHITE}], fill=col, name="SDG header", anchor="m", margin=(0.12, 0.03), rad=0.1)
    card(s_int2, x, 1.95, 3.99, 1.1, [{"t": bd, "size": 12.5}], fill="F3F5F8", line=LINE, name="SDG body", anchor="m", margin=(0.14, 0.05), rad=0.05)
make_table(s_int2, 0.6, 3.3, [5.2, 6.93], [
    ["Existing system", "ARGUS (proposed system)"],
    ["SPC uses fixed control limits and misses slow, gradual drift.",
     "CUSUM catches small persistent shifts and an LSTM autoencoder catches multi-sensor pattern breaks; both feed one alert score."],
    ["FDC systems are reactive and trigger only after a threshold breach, when damage has begun.",
     "Detects drift proactively, before yield degrades, so corrective action can start early."],
    ["APC systems need expensive proprietary SCADA infrastructure, out of reach for mid-size manufacturers.",
     "Built on open-source Python tools (PyTorch, FastAPI, scikit-learn) that run on standard hardware."],
    ["LCA tools run offline, once a year, disconnected from live manufacturing behaviour.",
     "A dynamic LCA engine computes energy loss, CO\u2082 and efficiency for each drift event from the current process state."]],
    rowh=0.78, hdrh=0.42, size=12.5, name="Existing vs proposed table")

# ---------------- 6/7. Literature survey ----------------
lit_cols = [2.95, 2.1, 0.65, 2.5, 2.1, 1.83]
lit_hdr = ["Paper title", "Journal / conference", "Year", "Novelty / technique", "Limitation", "Gap identified"]
def lit_row(title, auth, jr, yr, nov, lim, gap):
    return [[{"t": title, "bold": True, "size": 12}, {"t": auth, "size": 11.5, "color": GRAY}], jr, yr, nov, lim, gap]
lit1 = [lit_hdr,
    lit_row("Real-Time Allocation of Volatile Energy Related Emissions in Manufacturing", "Leherbauer & Hehenberger",
            "IFIP Advances in Information and Communication Technology, Springer", "2023",
            "Mathematical model that allocates CO\u2082 emissions to products in real time using grid carbon intensity",
            "Conceptual; not integrated with live monitoring systems", "Real-time emission tracking tied to process monitoring"),
    lit_row("Digital Twin for Smart Manufacturing: A Review", "Soori, Arezoo & Dastres",
            "Sustainable Manufacturing and Service Economics, Elsevier", "2023",
            "Review confirming real-time process mirrors are feasible and valuable for optimisation",
            "Mostly conceptual, or limited to large facilities with proprietary infrastructure", "Process-level twins for mid-size electronics makers"),
    lit_row("AI-Driven Life Cycle Assessment for Sustainable Hybrid Manufacturing and Remanufacturing", "Shafiq, Ayub et al.",
            "International Journal of Advanced Manufacturing Technology, Springer", "2024",
            "CNN, LSTM and Random Forest together predict LCA metrics better than static methods",
            "Automotive focus; LCA not updated from real-time sensor data", "Dynamic LCA linked to live process behaviour")]
lit2 = [lit_hdr,
    lit_row("Yield Prediction in Semiconductor Manufacturing Using Two-Step ML", "Busch, Czerner et al.",
            "International Journal of Production Research, Taylor & Francis", "2025",
            "Two-step pipeline (classification + regression) predicts wafer yield from process sensors",
            "Finds yield loss after production; cannot see early drift", "Early drift detection before yield degrades"),
    lit_row("A Method to Benchmark High-Dimensional Process Drift Detection", "Wolf & Windisch",
            "Journal of Intelligent Manufacturing, Springer", "2025",
            "Standard benchmark datasets and protocols for testing drift detectors",
            "Benchmarking only; no deployed monitoring system", "Practical drift detection inside manufacturing workflows"),
    lit_row("A Multi-Machine and Multi-Modal Drift Detection (M2D2) Framework for Semiconductor Manufacturing", "Lin, Tseng & Tsai",
            "Applied Sciences, MDPI", "2025",
            "Fuses numeric, text and categorical data; SHAP and LIME explain which parameters drifted",
            "Targets advanced fabs with costly infrastructure; not tuned for legacy equipment", "Affordable open-source drift detection for mid-size makers")]
for sl, title, rows, msg in [
    (s_lit1, "Literature Survey (1/2)", lit1, "Digital twins and AI-based LCA exist, but they are conceptual and not driven by live process data."),
    (s_lit2, "Literature Survey (2/2)", lit2, "Drift and yield work is either after the fact, benchmark-only, or built for high-cost fabs. ARGUS targets the gap in between.")]:
    drop_body(sl); set_title(sl, title)
    make_table(sl, 0.6, 1.5, lit_cols, rows, rowh=1.3, hdrh=0.42, size=12, name="Literature table")
    card(sl, 0.6, 5.95, 12.13, 0.8, [{"t": msg, "size": 15, "bold": True, "color": NAVY}],
         fill=LBLUE, name="Takeaway", anchor="m", margin=(0.25, 0.05))

# ---------------- 8. Requirements ----------------
drop_body(s_req); set_title(s_req, "Requirement Analysis and Specification", 36)
card(s_req, 3.9, 1.42, 5.53, 0.55, [{"t": "Goal: detect drift, explain root cause, quantify cost and carbon", "size": 14, "bold": True, "color": WHITE, "align": "c"}],
     fill=NAVY, name="Goal", anchor="m")
arrow(s_req, 6.55, 2.0, 0.24, 0.17)
tbox(s_req, 0.6, 2.14, 5, 0.3, [{"t": "FUNCTIONAL REQUIREMENTS", "size": 11.5, "bold": True, "color": GRAY}], margin=(0, 0.02))
frs = [("FR-1  Data engineering and validation", "Load, clean and validate SECOM runs; map sensors to station parameters", BLUE),
       ("FR-2  Digital twin and drift detection", "Per-station twin state; CUSUM + LSTM-AE scoring; SHAP root cause", PURPLE),
       ("FR-3  Operational and financial impact", "Scrap, downtime and energy cost in \u20b9; CO\u2082 and efficiency per event", GREEN),
       ("FR-4  API and interface", "FastAPI endpoints for state, metrics, timeseries and simulations", SLATE)]
for k, (a, b, c) in enumerate(frs):
    card(s_req, 0.6 + k * 3.06, 2.45, 2.99, 1.3, [
        {"t": a, "size": 13, "bold": True, "color": c, "after": 3}, {"t": b, "size": 12}],
        fill=tint(c, 0.9), line=c, name="Functional requirement", margin=(0.14, 0.08))
arrow(s_req, 6.55, 3.78, 0.24, 0.17)
tbox(s_req, 0.6, 3.92, 5, 0.3, [{"t": "NON-FUNCTIONAL REQUIREMENTS", "size": 11.5, "bold": True, "color": GRAY}], margin=(0, 0.02))
nfrs = [("Performance", "Under 100 ms per batch"), ("Reliability", "Graceful error handling"),
        ("Extensibility", "Runs standalone or as an API"), ("Traceability", "Formula breakdown for every figure")]
for k, (a, b) in enumerate(nfrs):
    card(s_req, 0.6 + k * 3.06, 4.22, 2.99, 0.85, [
        {"t": a, "size": 13, "bold": True, "color": AMBER, "after": 1}, {"t": b, "size": 12}],
        fill=tint("B26A00", 0.9), line="B26A00", name="Non-functional requirement", anchor="m", margin=(0.14, 0.05))
arrow(s_req, 6.55, 5.1, 0.24, 0.17)
tbox(s_req, 0.6, 5.24, 5, 0.3, [{"t": "TECHNOLOGY STACK", "size": 11.5, "bold": True, "color": GRAY}], margin=(0, 0.02))
stack = [("Backend", "FastAPI, PyTorch, scikit-learn, Pandas, NumPy"), ("Data", "UCI SECOM (CSV) with in-memory twin state"),
         ("Frontend", "React, Vite, TypeScript"), ("Visualization", "Recharts, Tailwind CSS, Three.js")]
for k, (a, b) in enumerate(stack):
    card(s_req, 0.6 + k * 3.06, 5.54, 2.99, 1.15, [
        {"t": a, "size": 13, "bold": True, "color": GREEN, "after": 2}, {"t": b, "size": 12}],
        fill=tint(GREEN, 0.9), line=GREEN, name="Stack item", anchor="m", margin=(0.14, 0.05))

# ---------------- 9. Design (single diagram) ----------------
drop_body(s_des); set_title(s_des, "Design: Modules, Algorithms and Formulas")
X0, XL = 0.6, 1.7           # label col x / width
CX = 2.45; CW = 3.45; GAP = 0.2
def band(sl, y, h, label, col, cards, widths=None):
    lab = card(sl, X0, y, 1.7, h, [{"t": label, "size": 11.5, "bold": True, "color": WHITE, "align": "c"}],
               fill=col, name="Band label", anchor="m", margin=(0.06, 0.04))
    n = len(cards); total = 12.73 - CX
    cw = (total - GAP * (n - 1)) / n
    for k, c in enumerate(cards):
        x = CX + k * (cw + GAP)
        paras = [{"t": c["title"], "size": 12.5, "bold": True, "color": col, "after": 1},
                 {"t": c["algo"], "size": 10.5, "color": GRAY, "after": 2}]
        for f in c.get("formulas", []):
            paras.append({"t": f, "math": True, "size": 11, "font": "Cambria", "color": NAVY, "after": 0})
        card(sl, x, y, cw, h, paras, fill=tint(col, 0.92), line=col, lw=1.0, name="Module " + c["title"][:2],
             anchor="m", margin=(0.1, 0.04), rad=0.05)
        if k < n - 1:
            arrow(sl, x + cw + 0.03, y + h / 2 - 0.09, GAP - 0.06, 0.18, "right", col)

yA, hA = 1.45, 1.22
yB, hB = yA + hA + 0.2, 1.5
yC, hC = yB + hB + 0.2, 1.3
yD, hD = yC + hC + 0.2, 0.78
band(s_des, yA, hA, "DATA AND\nTWIN", BLUE, [
    {"title": "1  Ingestion", "algo": "TelemetryStreamer replays SECOM runs: next_record, get_batch, stream",
     "formulas": ["X_<t> \u2208 R^<590>,  1,567 runs"]},
    {"title": "1  Preprocessing", "algo": "Prune >50% missing, drop constants, forward-fill + median, Winsorize",
     "formulas": ["x_<c> = min( max( x, P_<1> ), P_<99> )"]},
    {"title": "2  Digital twin state manager", "algo": "6 stations, 500-sample buffer, ETCH-01/02 load balancing",
     "formulas": ["HEALTHY \u2264 8 < WARNING \u2264 15 < CRITICAL"]}])
band(s_des, yB, hB, "DETECTION AND\nEXPLANATION", PURPLE, [
    {"title": "3a  Adaptive CUSUM", "algo": "Calibrated on t = 1\u2026200;  k = 1.2,  h = 15,  d = 0.75 / 0.95",
     "formulas": ["z = ( x \u2212 \u03bc ) / ( \u03c3 + 10^<\u22129> )", "S^<+> = max( 0, d\u00b7S^<+> + z \u2212 k )"]},
    {"title": "3b  LSTM autoencoder", "algo": "1-layer LSTM encoder\u2013decoder, H = 32, Adam lr 0.001; alert above P95 error",
     "formulas": ["L = 1/(W\u00b7F) \u00b7 \u03a3 ( x \u2212 x\u2032 )\u00b2"]},
    {"title": "3c  Hybrid score + Kernel SHAP", "algo": "Gradient Boosting (100 trees) explained with Kernel SHAP",
     "formulas": ["Score = max( CUSUM, MSE )", "\u03c6_<i> = \u03a3 |S|!(|F|\u2212|S|\u22121)!/|F|! \u00b7 [ f(S\u222a{i}) \u2212 f(S) ]"]}])
band(s_des, yC, hC, "IMPACT AND\nSCENARIOS", GREEN, [
    {"title": "4  Techno-economic impact", "algo": "Severity s \u2208 [0, 1] scales defects and downtime",
     "formulas": ["Rate = 1.04% + 15%\u00b7s;  Scrap = \u230aN\u00b7Rate\u230b \u00d7 \u20b941,665", "Downtime = 2.5\u00b7s h \u00d7 \u20b92,08,325/h"]},
    {"title": "5  Dynamic LCA", "algo": "Scope 2 energy and carbon from RF calibration drift",
     "formulas": ["E = |\u0394RF| \u00d7 0.05 kWh;  CO_<2> = E \u00d7 0.42 kg/kWh", "\u03b7 = max( 0, 0.95 \u2212 0.02\u00b7\u0394RF );  flag if \u03b7 < 0.90"]},
    {"title": "6  What-if simulation", "algo": "Gradual, sudden and cyclical drift plus Gaussian noise",
     "formulas": ["x_<t> = x_<0> + (t\u2212t_<0>)/(N\u2212t_<0>)\u00b7m\u00b7\u03c3", "Cyclical: + m\u00b7\u03c3\u00b7sin( 2\u03c0(t\u2212t_<0>)/T )"]}])
band(s_des, yD, hD, "SERVING", SLATE, [
    {"title": "7  FastAPI orchestration", "algo": "Endpoints: state, metrics, timeseries, simulations"},
    {"title": "React + Vite dashboard", "algo": "Twin, drift events, impact, sustainability, simulation views"}])
# vertical flow arrows between bands
for yy in (yA + hA, yB + hB, yC + hC):
    arrow(s_des, 7.45, yy + 0.02, 0.26, 0.16, "down", GRAY)

# ---------------- 10. Implementation 1 ----------------
drop_body(s_imp1); set_title(s_imp1, "Implementation: Data Pipeline and Digital Twin", 34)
tiles = [("1,567", "production runs, in time order"), ("590", "continuous sensor channels"),
         ("104", "failures, about 6.6% defect baseline"), ("6", "stations in the digital twin")]
for k, (n, l) in enumerate(tiles):
    card(s_imp1, 0.6 + k * 3.06, 1.45, 2.99, 1.0, [
        {"t": n, "size": 26, "bold": True, "color": BLUE, "after": 0}, {"t": l, "size": 12, "color": GRAY}],
        fill=LBLUE, name="Dataset tile", anchor="m", margin=(0.18, 0.04))
steps = [("Timestamp sorting", "merge date + time, order runs"), ("Missing-value pruning", "drop sensors with >50% nulls"),
         ("Zero-variance removal", "drop constant sensors"), ("Imputation", "forward-fill, then feature median"),
         ("Winsorization", "clip to the 1st\u201399th percentile")]
tbox(s_imp1, 0.6, 2.65, 4.4, 0.35, [{"t": "Preprocessing (EDA/preprocessing.py)", "size": 14, "bold": True, "color": NAVY}], margin=(0, 0.02))
for k, (a, b) in enumerate(steps):
    y = 3.05 + k * 0.74
    c = box(s_imp1, 0.6, y + 0.06, 0.4, 0.4, fill=BLUE, shape=MSO_SHAPE.OVAL, name="Step number")
    fill_tf(c.text_frame, [{"t": str(k + 1), "size": 13, "bold": True, "color": WHITE, "align": "c"}], anchor="m", margin=(0, 0))
    tbox(s_imp1, 1.1, y, 3.9, 0.6, [{"runs": [(a, {"bold": True, "color": NAVY}), ("  " + b, {"color": TXT})], "t": ""}], size=13, anchor="m", margin=(0.02, 0.02))
tbox(s_imp1, 5.3, 2.65, 7.4, 0.35, [{"t": "Feature schema: SECOM index mapped to process parameters", "size": 14, "bold": True, "color": NAVY}], margin=(0, 0.02))
make_table(s_imp1, 5.3, 3.05, [1.65, 1.35, 4.43], [
    ["Stage", "Tool ID", "Key parameters"],
    ["Plasma etch", "ETCH-01 / 02", "rf_power, etch_rate, chamber_pressure, etchant_gas_flow"],
    ["Thin-film deposition", "DEP-01", "dep_temp, gas_flow_rate, film_thickness, chamber_vacuum"],
    ["CMP planarization", "CMP-01", "pad_pressure, slurry_flow, rotation_speed, friction_coefficient"],
    ["Photolithography", "LITHO-01", "focus_offset, exposure_dose, alignment_error, lens_temp"],
    ["Wet clean", "CLEAN-01", "bath_temp, chemical_ph, rinse_flow, particle_count"]],
    rowh=0.5, hdrh=0.38, size=12, first_col_bold=True, name="Feature schema table")
states = [("HEALTHY", "score \u2264 8 and no boundary violation", GREEN), ("WARNING", "score > 8 or \u2265 1 violation", AMBER),
          ("CRITICAL", "score > 15 or \u2265 3 violations", RED)]
for k, (a, b, c) in enumerate(states):
    card(s_imp1, 5.3 + k * 2.5, 6.15, 2.43, 0.7, [
        {"t": a, "size": 12.5, "bold": True, "color": c, "after": 0}, {"t": b, "size": 11, "color": TXT}],
        fill=tint(c, 0.9), line=c, name="Twin state", anchor="m", margin=(0.12, 0.03))

# ---------------- 11. Implementation 2 ----------------
drop_body(s_imp2); set_title(s_imp2, "Implementation: Hybrid Drift Detection Engine", 34)
tbox(s_imp2, 0.6, 1.45, 5.8, 0.35, [{"t": "Adaptive CUSUM (src/3.drift/cusum_detector.py)", "size": 14, "bold": True, "color": PURPLE}], margin=(0, 0.02))
make_table(s_imp2, 0.6, 1.85, [3.0, 2.73], [
    ["Parameter", "Value"], ["Calibration window", "t = 1 \u2026 200"], ["Slack allowance k", "1.2"],
    ["Decay within tolerance", "0.75"], ["Decay while drifting", "0.95"], ["Alarm threshold h", "15.0"]],
    rowh=0.4, hdrh=0.38, size=13, hdr_fill=PURPLE, zebra=(WHITE, tint(PURPLE, 0.92)), name="CUSUM table")
tbox(s_imp2, 6.7, 1.45, 6, 0.35, [{"t": "LSTM autoencoder (src/3.drift/lstm_autoencoder.py)", "size": 14, "bold": True, "color": PURPLE}], margin=(0, 0.02))
make_table(s_imp2, 6.7, 1.85, [2.6, 3.43], [
    ["Parameter", "Value"], ["Encoder / decoder", "1-layer LSTM each"], ["Hidden dimension", "32"],
    ["Optimizer", "Adam, learning rate 0.001"], ["Batch size / epochs", "64 / 20"],
    ["Training data", "Normal pre-drift telemetry only"], ["Alert threshold", "95th-percentile reconstruction error"]],
    rowh=0.4, hdrh=0.38, size=13, hdr_fill=PURPLE, zebra=(WHITE, tint(PURPLE, 0.92)), name="LSTM table")
# bottom: hybrid + SHAP + chart
card(s_imp2, 0.6, 4.75, 3.7, 2.05, [
    {"t": "Hybrid anomaly evaluator", "size": 13, "bold": True, "color": NAVY, "after": 4},
    {"t": "Score = max( CUSUM, MSE )", "size": 14, "font": "Cambria", "color": NAVY, "after": 4},
    {"t": "A breach triggers the explainer and the WARNING / CRITICAL state change.", "size": 12, "color": GRAY}],
    fill=LBLUE, name="Hybrid card", anchor="m", margin=(0.18, 0.06))
arrow(s_imp2, 4.36, 5.68, 0.24, 0.2, "right", GRAY)
card(s_imp2, 4.66, 4.75, 3.7, 2.05, [
    {"t": "Kernel SHAP explainer", "size": 13, "bold": True, "color": NAVY, "after": 4},
    {"t": "Gradient Boosting classifier (100 trees) maps window features to drift labels; Kernel SHAP ranks each sensor's share of the drift.", "size": 12, "color": TXT, "after": 2}],
    fill=LBLUE, name="SHAP card", anchor="m", margin=(0.18, 0.06))
arrow(s_imp2, 8.42, 5.68, 0.24, 0.2, "right", GRAY)
box(s_imp2, 8.72, 4.75, 4.01, 2.05, fill=WHITE, line=LINE, name="Chart frame")
tbox(s_imp2, 8.8, 4.78, 3.9, 0.3, [{"t": "Example root-cause output (share of drift, %)", "size": 11.5, "bold": True, "color": NAVY}], margin=(0.05, 0.02))
cd = CategoryChartData(); cd.categories = ["rf_power", "chamber_pressure", "etch_rate"]; cd.add_series("Share", (62, 28, 10))
gf = s_imp2.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Inches(8.78), Inches(5.08), Inches(3.9), Inches(1.68), cd)
gf.name = "SHAP attribution chart"
ch = gf.chart; ch.has_legend = False; ch.has_title = False
ch.font.size = Pt(11); ch.font.name = "Calibri"; ch.font.color.rgb = rgb(TXT)
pl = ch.plots[0]; pl.gap_width = 45; pl.has_data_labels = True
pl.data_labels.number_format = '0"%"'; pl.data_labels.number_format_is_linked = False
pl.data_labels.position = XL_LABEL_POSITION.OUTSIDE_END; pl.data_labels.font.size = Pt(11)
pl.series[0].format.fill.solid(); pl.series[0].format.fill.fore_color.rgb = rgb(PURPLE)
ch.category_axis.reverse_order = True; ch.category_axis.format.line.color.rgb = rgb(LINE)
ch.category_axis.tick_labels.font.size = Pt(11)
ch.value_axis.visible = False; ch.value_axis.has_major_gridlines = False; ch.value_axis.maximum_scale = 80; ch.value_axis.minimum_scale = 0

# ---------------- 12. Implementation 3 ----------------
drop_body(s_imp3); set_title(s_imp3, "Implementation: Impact, LCA, Simulation and API", 34)
def kv_card(sl, x, y, w, h, title, col, rows, tabx=2.3, name="KV card"):
    paras = [{"t": title, "size": 14, "bold": True, "color": col, "after": 5}]
    for k, v in rows:
        paras.append({"runs": [(k, {"bold": True, "color": NAVY}), ("\t" + v, {"color": TXT})], "t": "", "tab": tabx, "after": 3})
    card(sl, x, y, w, h, paras, fill=tint(col, 0.92), line=col, name=name, size=12.5, anchor="m", margin=(0.2, 0.08))
kv_card(s_imp3, 0.6, 1.45, 5.95, 2.45, "Techno-economic impact (src/4.impact)", AMBER, [
    ("Scrap penalty", "\u20b941,665 per failed unit"), ("Electricity tariff", "\u20b912.50 per kWh"),
    ("Tool downtime", "\u20b92,08,325 per hour"), ("Baseline defect rate", "1.04% + 15% \u00d7 severity"),
    ("Throughput loss", "min( 100%, 35% \u00d7 severity )")], tabx=2.0)
kv_card(s_imp3, 6.78, 1.45, 5.95, 2.45, "Dynamic LCA (src/5.lca)", GREEN, [
    ("Energy per unit \u0394RF", "0.05 kWh"), ("Grid carbon intensity", "0.42 kg CO\u2082 per kWh"),
    ("Efficiency baseline", "95%, minus 0.02 per unit \u0394RF"), ("Recalibration flag", "efficiency below 90%")], tabx=2.3)
kv_card(s_imp3, 0.6, 4.1, 5.95, 2.0, "What-if simulation (src/6.simulation)", PURPLE, [
    ("Patterns", "gradual wear, sudden valve trip, cyclical thermal hunting"),
    ("Noise", "Gaussian, \u03b5 ~ N( 0, \u03c3\u00b2 \u00b7 noise_scale )"),
    ("Purpose", "test detection latency and sensitivity")], tabx=1.1)
kv_card(s_imp3, 6.78, 4.1, 5.95, 2.0, "FastAPI orchestration (src/7.api)", SLATE, [
    ("Endpoints", "state, metrics, timeseries, simulations"),
    ("Consumers", "React + Vite dashboard"),
    ("Engines served", "drift, impact and LCA metrics")], tabx=1.5)
card(s_imp3, 0.6, 6.3, 12.13, 0.55, [{"runs": [("Source code:  ", {"bold": True, "color": NAVY}),
     ("https://github.com/GHOSTRIDER74/ARGUS", {"link": "https://github.com/GHOSTRIDER74/ARGUS", "color": BLUE})], "t": "", "size": 14}],
     fill=LBLUE, name="Repository link", anchor="m", margin=(0.25, 0.03))

# ---------------- 15. Conclusion ----------------
drop_body(s_con, ); set_title(s_con, "Conclusion")
tbox(s_con, 0.6, 1.45, 7, 0.4, [{"t": "What ARGUS delivers", "size": 16, "bold": True, "color": NAVY}], margin=(0, 0.02))
delivered = [
    "A seven-stage backend pipeline that carries SECOM telemetry through to an API-fed dashboard",
    "A six-station digital twin with HEALTHY, WARNING and CRITICAL states",
    "Hybrid drift detection (adaptive CUSUM + LSTM autoencoder) with SHAP root-cause ranking",
    "Each drift event translated into rupee loss and into energy and Scope 2 CO\u2082",
    "A what-if simulator that injects gradual, sudden and cyclical drift to test detection latency"]
for k, t_ in enumerate(delivered):
    y = 1.95 + k * 0.96
    c = box(s_con, 0.6, y + 0.14, 0.5, 0.5, fill=BLUE, shape=MSO_SHAPE.OVAL, name="Point number")
    fill_tf(c.text_frame, [{"t": str(k + 1), "size": 15, "bold": True, "color": WHITE, "align": "c"}], anchor="m", margin=(0, 0))
    card(s_con, 1.25, y, 6.7, 0.8, [{"t": t_, "size": 14}], fill=LBLUE, name="Delivered item", anchor="m", margin=(0.18, 0.04))
card(s_con, 8.3, 1.95, 4.43, 4.65, [
    {"t": "Future scope", "size": 16, "bold": True, "color": WHITE, "after": 10},
    {"t": "Connect live equipment through OPC-UA, MQTT and SECS/GEM adapters", "bullet": True, "after": 8, "bucolor": "9CCBF0"},
    {"t": "Replace CSV replay with true streaming ingestion", "bullet": True, "after": 8, "bucolor": "9CCBF0"},
    {"t": "Validate on further datasets such as SKAB and AI4I 2020", "bullet": True, "after": 8, "bucolor": "9CCBF0"},
    {"t": "Calibrate cost and grid-carbon constants to Indian conditions", "bullet": True, "bucolor": "9CCBF0"}],
    fill=NAVY, name="Future scope", size=14, color=WHITE, anchor="m", margin=(0.28, 0.1))

prs.save("/tmp/work/ARGUS_Final_Presentation.pptx")
print("saved")