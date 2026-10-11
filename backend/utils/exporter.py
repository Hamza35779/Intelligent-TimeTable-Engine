import csv
import html
import io
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from PIL import Image, ImageDraw, ImageFont
from utils.timetable_formatter import build_table_rows, build_university_sheet_data


VIEW_TITLES = {
    "master": "AI 2024 - Section A",
    "teacher": "Faculty & Teacher Schedule View",
    "student": "Student Cohort Schedule View",
    "staff": "Support & Facilities Staff View",
    "canteen": "Canteen & Dining Demand Schedule",
}

DANGEROUS_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _sanitize_spreadsheet_cell(value: Any) -> str:
    text = str(value if value is not None else "")
    stripped = text.lstrip()
    if stripped.startswith(DANGEROUS_FORMULA_PREFIXES):
        return f"'{text}"
    return text


class TimetableExporter:
    def __init__(
        self,
        entries: List[Dict[str, Any]],
        metadata: Dict[str, Any],
        view_type: str = "master",
    ):
        self.entries = entries
        self.metadata = metadata or {}
        self.view_type = view_type if view_type in VIEW_TITLES else "master"
        self.section_title = (
            self.metadata.get("section_title")
            or (VIEW_TITLES[self.view_type] if self.view_type != "master" else "AI 2024 - Section A")
        )
        self.title = self.section_title
        self.rows = build_table_rows(entries, view_type=self.view_type)
        self.sheet = build_university_sheet_data(
            entries, section_title=self.section_title, view_type=self.view_type
        )

    def export(self, format_type: str) -> Tuple[bytes, str, str]:
        fmt = format_type.strip().lower()
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        base_name = f"timetable_{self.view_type}_{ts}"

        if fmt == "csv":
            return self._export_csv(), "text/csv", f"{base_name}.csv"
        elif fmt == "xlsx":
            return (
                self._export_xlsx(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                f"{base_name}.xlsx",
            )
        elif fmt == "pdf":
            return self._export_pdf(), "application/pdf", f"{base_name}.pdf"
        elif fmt in ("png", "jpg", "jpeg"):
            ext = "jpg" if fmt in ("jpg", "jpeg") else "png"
            mime = "image/jpeg" if ext == "jpg" else "image/png"
            return self._export_image(ext), mime, f"{base_name}.{ext}"
        elif fmt == "json":
            return self._export_json(), "application/json", f"{base_name}.json"
        elif fmt == "html":
            return self._export_html(), "text/html", f"{base_name}.html"
        else:
            raise ValueError(f"Unsupported export format: {format_type}")

    def _export_csv(self) -> bytes:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([_sanitize_spreadsheet_cell(self.section_title)])
        sanitized_rows = [
            [_sanitize_spreadsheet_cell(cell) for cell in row] for row in self.rows
        ]
        writer.writerows(sanitized_rows)
        writer.writerow([])
        writer.writerow(
            [
                "Serial",
                "Course Code",
                "Course Titles",
                "CHs",
                "Name of Faculty",
                "Elective / Compulsory",
                "Venues",
                "Remarks",
            ]
        )
        for c_row in self.sheet["course_legend"]:
            writer.writerow(
                [
                    _sanitize_spreadsheet_cell(c_row["serial"]),
                    _sanitize_spreadsheet_cell(c_row["course_code"]),
                    _sanitize_spreadsheet_cell(c_row["course_title"]),
                    _sanitize_spreadsheet_cell(c_row["credit_hours"]),
                    _sanitize_spreadsheet_cell(c_row["faculty_name"]),
                    _sanitize_spreadsheet_cell(c_row["elective_compulsory"]),
                    _sanitize_spreadsheet_cell(c_row["venues"]),
                    _sanitize_spreadsheet_cell(c_row["remarks"]),
                ]
            )
        return buf.getvalue().encode("utf-8")

    def _export_xlsx(self) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = self.section_title[:31]

        black_border = Border(
            left=Side(style="thin", color="000000"),
            right=Side(style="thin", color="000000"),
            top=Side(style="thin", color="000000"),
            bottom=Side(style="thin", color="000000"),
        )
        blue_fill = PatternFill(start_color="2E75B6", end_color="2E75B6", fill_type="solid")
        center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

        # Row 1: Blue Section Banner merged across columns A..J (10 columns)
        ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=10)
        for col_idx in range(1, 11):
            c = ws.cell(row=1, column=col_idx)
            c.fill = blue_fill
            c.border = black_border
        banner_cell = ws.cell(row=1, column=1, value=_sanitize_spreadsheet_cell(self.section_title))
        banner_cell.font = Font(name="Calibri", color="FFFFFF", bold=True, size=12)
        banner_cell.alignment = center_align
        ws.row_dimensions[1].height = 24

        # Row 2: Slot 1 .. Slot 9
        for col_idx, val in enumerate(self.sheet["slot_headers"], start=1):
            c = ws.cell(row=2, column=col_idx, value=_sanitize_spreadsheet_cell(val))
            c.font = Font(name="Calibri", bold=True, size=10)
            c.alignment = center_align
            c.border = black_border
        ws.row_dimensions[2].height = 20

        # Row 3: Day/Time | 0830-9020 .. 1510-1600
        for col_idx, val in enumerate(self.sheet["time_headers"], start=1):
            c = ws.cell(row=3, column=col_idx, value=_sanitize_spreadsheet_cell(val))
            c.font = Font(name="Calibri", bold=True, size=10)
            c.alignment = center_align
            c.border = black_border
        ws.row_dimensions[3].height = 20

        # Rows 4..8: Days with merged horizontal spans
        current_row = 4
        for day in self.sheet["days"]:
            day_cell = ws.cell(row=current_row, column=1, value=_sanitize_spreadsheet_cell(day))
            day_cell.font = Font(name="Calibri", bold=True, size=10)
            day_cell.alignment = center_align
            day_cell.border = black_border

            spans = self.sheet["merged_day_cells"].get(day, [])
            for span in spans:
                start_col = span["startSlot"] + 1  # Slot 1 is column 2
                end_col = start_col + span["colSpan"] - 1
                if end_col > start_col:
                    ws.merge_cells(
                        start_row=current_row,
                        start_column=start_col,
                        end_row=current_row,
                        end_column=end_col,
                    )
                for col_i in range(start_col, end_col + 1):
                    c = ws.cell(row=current_row, column=col_i)
                    c.border = black_border
                    c.alignment = center_align
                top_cell = ws.cell(
                    row=current_row,
                    column=start_col,
                    value=_sanitize_spreadsheet_cell(span["text"]),
                )
                top_cell.font = Font(name="Calibri", size=10)
                top_cell.alignment = center_align
            ws.row_dimensions[current_row].height = 42
            current_row += 1

        # Blank separator row
        current_row += 1

        # Lower Table: Course & Faculty Summary Legend
        legend_headers = [
            "Serial",
            "Course Code",
            "Course Titles",
            "CHs",
            "Name of Faculty",
            "Elective / Compulsory",
            "Venues",
            "Remarks",
        ]
        # Map 8 legend columns neatly across the 10-column sheet (Course Titles spans C..D, Name of Faculty spans F..G)
        legend_col_spans = [
            (1, 1),   # Serial
            (2, 2),   # Course Code
            (3, 4),   # Course Titles
            (5, 5),   # CHs
            (6, 7),   # Name of Faculty
            (8, 8),   # Elective / Compulsory
            (9, 9),   # Venues
            (10, 10), # Remarks
        ]
        for h_val, (sc, ec) in zip(legend_headers, legend_col_spans):
            if ec > sc:
                ws.merge_cells(start_row=current_row, start_column=sc, end_row=current_row, end_column=ec)
            for col_i in range(sc, ec + 1):
                c = ws.cell(row=current_row, column=col_i)
                c.border = black_border
                c.alignment = center_align
            hc = ws.cell(row=current_row, column=sc, value=h_val)
            hc.font = Font(name="Calibri", bold=True, size=10)
        ws.row_dimensions[current_row].height = 24
        current_row += 1

        for c_row in self.sheet["course_legend"]:
            vals = [
                c_row["serial"],
                c_row["course_code"],
                c_row["course_title"],
                c_row["credit_hours"],
                c_row["faculty_name"],
                c_row["elective_compulsory"],
                c_row["venues"],
                c_row["remarks"],
            ]
            for val, (sc, ec) in zip(vals, legend_col_spans):
                if ec > sc:
                    ws.merge_cells(start_row=current_row, start_column=sc, end_row=current_row, end_column=ec)
                for col_i in range(sc, ec + 1):
                    c = ws.cell(row=current_row, column=col_i)
                    c.border = black_border
                    c.alignment = center_align
                vc = ws.cell(row=current_row, column=sc, value=_sanitize_spreadsheet_cell(val))
                vc.font = Font(name="Calibri", size=10)
            ws.row_dimensions[current_row].height = 22
            current_row += 1

        for col_idx in range(1, 11):
            col_letter = get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = 16 if col_idx > 1 else 15

        out = io.BytesIO()
        wb.save(out)
        return out.getvalue()

    def _export_pdf(self) -> bytes:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(A4),
            leftMargin=20,
            rightMargin=20,
            topMargin=20,
            bottomMargin=20,
        )
        elements = []
        cell_style = ParagraphStyle(
            "CellText",
            fontName="Helvetica",
            fontSize=8,
            leading=10,
            alignment=1,
        )
        bold_style = ParagraphStyle(
            "CellBold",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=10,
            alignment=1,
        )
        banner_style = ParagraphStyle(
            "BannerText",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.white,
            alignment=1,
        )

        # Build Upper Table (Banner + Slot Headers + Time Headers + Days)
        upper_data = []
        upper_data.append([Paragraph(html.escape(self.section_title), banner_style)] + [""] * 9)
        upper_data.append([Paragraph(html.escape(s), bold_style) for s in self.sheet["slot_headers"]])
        upper_data.append([Paragraph(html.escape(t), bold_style) for t in self.sheet["time_headers"]])

        upper_styles = [
            ("SPAN", (0, 0), (9, 0)),
            ("BACKGROUND", (0, 0), (9, 0), colors.HexColor("#2E75B6")),
            ("TEXTCOLOR", (0, 0), (9, 0), colors.white),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.75, colors.black),
            ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ]

        for d_idx, day in enumerate(self.sheet["days"]):
            r_idx = 3 + d_idx
            row_cells = [Paragraph(html.escape(day), bold_style)] + [""] * 9
            spans = self.sheet["merged_day_cells"].get(day, [])
            for sp in spans:
                sc = sp["startSlot"]
                ec = sc + sp["colSpan"] - 1
                txt_html = html.escape(sp["text"]).replace("\n", "<br/>")
                row_cells[sc] = Paragraph(txt_html, cell_style)
                if ec > sc:
                    upper_styles.append(("SPAN", (sc, r_idx), (ec, r_idx)))
            upper_data.append(row_cells)

        col_widths = [1.05 * inch] + [1.06 * inch] * 9
        upper_table = Table(upper_data, colWidths=col_widths)
        upper_table.setStyle(TableStyle(upper_styles))
        elements.append(upper_table)
        elements.append(Spacer(1, 14))

        # Lower Table: 8-Column Course Legend
        legend_headers = [
            "Serial",
            "Course Code",
            "Course Titles",
            "CHs",
            "Name of Faculty",
            "Elective / Compulsory",
            "Venues",
            "Remarks",
        ]
        lower_data = [[Paragraph(html.escape(h), bold_style) for h in legend_headers]]
        for c_row in self.sheet["course_legend"]:
            lower_data.append(
                [
                    Paragraph(html.escape(str(c_row["serial"])), cell_style),
                    Paragraph(html.escape(str(c_row["course_code"])), cell_style),
                    Paragraph(html.escape(str(c_row["course_title"])), cell_style),
                    Paragraph(html.escape(str(c_row["credit_hours"])), cell_style),
                    Paragraph(html.escape(str(c_row["faculty_name"])), cell_style),
                    Paragraph(html.escape(str(c_row["elective_compulsory"])), cell_style),
                    Paragraph(html.escape(str(c_row["venues"])), cell_style),
                    Paragraph(html.escape(str(c_row["remarks"])), cell_style),
                ]
            )

        lower_col_widths = [
            0.6 * inch,
            1.0 * inch,
            2.5 * inch,
            0.6 * inch,
            2.0 * inch,
            1.5 * inch,
            1.2 * inch,
            1.19 * inch,
        ]
        lower_table = Table(lower_data, colWidths=lower_col_widths)
        lower_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("GRID", (0, 0), (-1, -1), 0.75, colors.black),
                    ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ]
            )
        )
        elements.append(lower_table)

        doc.build(elements)
        return buf.getvalue()

    def _export_image(self, ext: str = "png") -> bytes:
        margin = 20
        col_w = 135
        total_w = col_w * 10
        banner_h = 34
        hdr_h = 28
        day_h = 64
        gap_h = 26
        leg_row_h = 30

        num_days = len(self.sheet["days"])
        num_legend_rows = len(self.sheet["course_legend"]) + 1
        img_w = total_w + margin * 2
        img_h = (
            margin * 2
            + banner_h
            + hdr_h * 2
            + num_days * day_h
            + gap_h
            + num_legend_rows * leg_row_h
        )

        img = Image.new("RGB", (img_w, img_h), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        font = ImageFont.load_default()

        def draw_centered_text(box: Tuple[int, int, int, int], text: str, fill=(0, 0, 0)):
            x0, y0, x1, y1 = box
            lines = [line.strip() for line in str(text).split("\n") if line.strip()]
            if not lines:
                return
            line_h = 14
            total_txt_h = len(lines) * line_h
            start_y = y0 + max(4, (y1 - y0 - total_txt_h) // 2)
            for idx, line in enumerate(lines[:3]):
                approx_w = len(line) * 6
                start_x = x0 + max(4, (x1 - x0 - approx_w) // 2)
                draw.text((start_x, start_y + idx * line_h), line, fill=fill, font=font)

        y = margin
        # 1. Blue Section Banner
        draw.rectangle(
            [(margin, y), (margin + total_w, y + banner_h)],
            fill=(46, 117, 182),
            outline=(0, 0, 0),
            width=1,
        )
        draw_centered_text((margin, y, margin + total_w, y + banner_h), self.section_title, fill=(255, 255, 255))
        y += banner_h

        # 2. Slot Headers
        for c_idx, val in enumerate(self.sheet["slot_headers"]):
            x0 = margin + c_idx * col_w
            draw.rectangle([(x0, y), (x0 + col_w, y + hdr_h)], fill=(255, 255, 255), outline=(0, 0, 0), width=1)
            draw_centered_text((x0, y, x0 + col_w, y + hdr_h), val)
        y += hdr_h

        # 3. Time Headers
        for c_idx, val in enumerate(self.sheet["time_headers"]):
            x0 = margin + c_idx * col_w
            draw.rectangle([(x0, y), (x0 + col_w, y + hdr_h)], fill=(255, 255, 255), outline=(0, 0, 0), width=1)
            draw_centered_text((x0, y, x0 + col_w, y + hdr_h), val)
        y += hdr_h

        # 4. Day Rows with merged cells
        for day in self.sheet["days"]:
            draw.rectangle([(margin, y), (margin + col_w, y + day_h)], fill=(255, 255, 255), outline=(0, 0, 0), width=1)
            draw_centered_text((margin, y, margin + col_w, y + day_h), day)

            spans = self.sheet["merged_day_cells"].get(day, [])
            for sp in spans:
                x0 = margin + sp["startSlot"] * col_w
                w = sp["colSpan"] * col_w
                draw.rectangle([(x0, y), (x0 + w, y + day_h)], fill=(255, 255, 255), outline=(0, 0, 0), width=1)
                draw_centered_text((x0, y, x0 + w, y + day_h), sp["text"])
            y += day_h

        y += gap_h

        # 5. Lower Table (8 columns across total_w)
        leg_widths = [70, 120, 310, 70, 260, 190, 165, 165]
        leg_headers = [
            "Serial",
            "Course Code",
            "Course Titles",
            "CHs",
            "Name of Faculty",
            "Elective / Compulsory",
            "Venues",
            "Remarks",
        ]
        cx = margin
        for h_txt, lw in zip(leg_headers, leg_widths):
            draw.rectangle([(cx, y), (cx + lw, y + leg_row_h)], fill=(255, 255, 255), outline=(0, 0, 0), width=1)
            draw_centered_text((cx, y, cx + lw, y + leg_row_h), h_txt)
            cx += lw
        y += leg_row_h

        for c_row in self.sheet["course_legend"]:
            vals = [
                c_row["serial"],
                c_row["course_code"],
                c_row["course_title"],
                c_row["credit_hours"],
                c_row["faculty_name"],
                c_row["elective_compulsory"],
                c_row["venues"],
                c_row["remarks"],
            ]
            cx = margin
            for val, lw in zip(vals, leg_widths):
                draw.rectangle([(cx, y), (cx + lw, y + leg_row_h)], fill=(255, 255, 255), outline=(0, 0, 0), width=1)
                draw_centered_text((cx, y, cx + lw, y + leg_row_h), str(val))
                cx += lw
            y += leg_row_h

        buf = io.BytesIO()
        if ext == "jpg":
            img.save(buf, format="JPEG", quality=95)
        else:
            img.save(buf, format="PNG")
        return buf.getvalue()

    def _export_json(self) -> bytes:
        payload = {
            "view_type": self.view_type,
            "title": self.title,
            "section_title": self.section_title,
            "metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "fairness_score": self.metadata.get("fairness_score", 0.92),
                "preference_satisfaction": self.metadata.get("preference_satisfaction", 0.88),
                "total_courses": self.metadata.get("total_courses", len(self.entries)),
                "total_teachers": self.metadata.get("total_teachers", 5),
            },
            "headers": self.rows[0] if self.rows else [],
            "table_rows": self.rows[1:] if len(self.rows) > 1 else [],
            "sheet": self.sheet,
            "entries": self.entries,
        }
        return json.dumps(payload, indent=2).encode("utf-8")

    def _export_html(self) -> bytes:
        safe_title = html.escape(self.section_title)
        html_lines = [
            "<!DOCTYPE html>",
            "<html><head><meta charset='UTF-8'>",
            f"<title>{safe_title}</title>",
            "<style>",
            "body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; margin: 24px; background: #ffffff; color: #000000; }",
            "table { border-collapse: collapse; width: 100%; background: #ffffff; margin-bottom: 24px; }",
            "th, td { border: 1px solid #000000; padding: 8px 6px; text-align: center; vertical-align: middle; font-size: 13px; white-space: pre-line; }",
            ".banner { background: #2E75B6; color: #ffffff; font-weight: 700; font-size: 16px; padding: 8px; }",
            ".bold-cell { font-weight: 700; }",
            "</style></head><body>",
            "<table>",
            f"<thead><tr><th colspan='10' class='banner'>{safe_title}</th></tr>",
            "<tr>" + "".join(f"<th class='bold-cell'>{html.escape(s)}</th>" for s in self.sheet["slot_headers"]) + "</tr>",
            "<tr>" + "".join(f"<th class='bold-cell'>{html.escape(t)}</th>" for t in self.sheet["time_headers"]) + "</tr>",
            "</thead><tbody>",
        ]

        for day in self.sheet["days"]:
            row_html = [f"<tr><td class='bold-cell'>{html.escape(day)}</td>"]
            for sp in self.sheet["merged_day_cells"].get(day, []):
                colspan = f" colspan='{sp['colSpan']}'" if sp["colSpan"] > 1 else ""
                row_html.append(f"<td{colspan}>{html.escape(sp['text'])}</td>")
            row_html.append("</tr>")
            html_lines.append("".join(row_html))

        html_lines.append("</tbody></table>")

        # Lower Table: Course & Faculty Summary Legend
        html_lines.extend(
            [
                "<table><thead><tr>",
                "<th>Serial</th><th>Course Code</th><th>Course Titles</th><th>CHs</th>",
                "<th>Name of Faculty</th><th>Elective / Compulsory</th><th>Venues</th><th>Remarks</th>",
                "</tr></thead><tbody>",
            ]
        )
        for c_row in self.sheet["course_legend"]:
            html_lines.append(
                "<tr>"
                f"<td>{html.escape(str(c_row['serial']))}</td>"
                f"<td>{html.escape(str(c_row['course_code']))}</td>"
                f"<td>{html.escape(str(c_row['course_title']))}</td>"
                f"<td>{html.escape(str(c_row['credit_hours']))}</td>"
                f"<td>{html.escape(str(c_row['faculty_name']))}</td>"
                f"<td>{html.escape(str(c_row['elective_compulsory']))}</td>"
                f"<td>{html.escape(str(c_row['venues']))}</td>"
                f"<td>{html.escape(str(c_row['remarks']))}</td>"
                "</tr>"
            )
        html_lines.append("</tbody></table></body></html>")
        return "\n".join(html_lines).encode("utf-8")
