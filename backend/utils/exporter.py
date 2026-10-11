import csv
import html
import io
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from reportlab.lib.pagesizes import landscape, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from PIL import Image, ImageDraw, ImageFont
from utils.timetable_formatter import build_table_rows


VIEW_TITLES = {
    "master": "Master University Schedule",
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
        self.title = VIEW_TITLES[self.view_type]
        self.rows = build_table_rows(entries, view_type=self.view_type)

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
        sanitized_rows = [
            [_sanitize_spreadsheet_cell(cell) for cell in row] for row in self.rows
        ]
        writer.writerows(sanitized_rows)
        return buf.getvalue().encode("utf-8")

    def _export_xlsx(self) -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = f"{self.view_type.capitalize()} Schedule"

        thin_border = Border(
            left=Side(style="thin", color="CCCCCC"),
            right=Side(style="thin", color="CCCCCC"),
            top=Side(style="thin", color="CCCCCC"),
            bottom=Side(style="thin", color="CCCCCC"),
        )

        for r_idx, row in enumerate(self.rows, start=1):
            for c_idx, val in enumerate(row, start=1):
                safe_val = _sanitize_spreadsheet_cell(val)
                cell = ws.cell(row=r_idx, column=c_idx, value=safe_val)
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                cell.border = thin_border

                if r_idx == 1:
                    cell.fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
                    cell.font = Font(color="FFFFFF", bold=True, size=11)
                elif "Lunch" in str(val) or "BREAK" in str(row[0]):
                    cell.fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")
                    cell.font = Font(color="7F6000", bold=True)

        for col in ws.columns:
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = 24
        for r_idx in range(2, len(self.rows) + 1):
            ws.row_dimensions[r_idx].height = 45

        ws_meta = wb.create_sheet("Metrics")
        ws_meta.append(["Metric", "Value"])
        ws_meta.append(["Audience View", self.title])
        ws_meta.append(["Fairness Score", self.metadata.get("fairness_score", 0.92)])
        ws_meta.append(["Preference Satisfaction", self.metadata.get("preference_satisfaction", 0.88)])
        ws_meta.append(["Total Courses", self.metadata.get("total_courses", len(self.entries))])
        ws_meta.append(["Total Teachers", self.metadata.get("total_teachers", 5)])

        out = io.BytesIO()
        wb.save(out)
        return out.getvalue()

    def _export_pdf(self) -> bytes:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(A4),
            leftMargin=24,
            rightMargin=24,
            topMargin=24,
            bottomMargin=24,
        )
        elements = []
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ScheduleTitle",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=colors.HexColor("#1F4E78"),
            alignment=1,
            spaceAfter=14,
        )
        elements.append(Paragraph(html.escape(self.title), title_style))

        num_day_cols = max(1, (len(self.rows[0]) - 1) if self.rows else 5)
        day_col_width = min(1.85 * inch, (9.2 * inch) / num_day_cols)
        col_widths = [1.3 * inch] + [day_col_width] * num_day_cols
        table = Table(self.rows, colWidths=col_widths)

        t_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E78")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ]
        for r_idx, row in enumerate(self.rows):
            if r_idx > 0 and "BREAK" in str(row[0]):
                t_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), colors.HexColor("#FEF3C7")))

        table.setStyle(TableStyle(t_style))
        elements.append(table)
        elements.append(Spacer(1, 14))

        fairness = float(self.metadata.get("fairness_score", 0.92)) * 100
        pref = float(self.metadata.get("preference_satisfaction", 0.88)) * 100
        summary_html = (
            f"<b>Optimization Summary:</b> Fairness Score: {fairness:.1f}% | "
            f"Preference Satisfaction: {pref:.1f}% | "
            f"Courses Scheduled: {int(self.metadata.get('total_courses', len(self.entries)))}"
        )
        elements.append(Paragraph(summary_html, styles["Normal"]))

        doc.build(elements)
        return buf.getvalue()

    def _export_image(self, ext: str = "png") -> bytes:
        num_cols = len(self.rows[0]) if self.rows else 6
        num_rows = len(self.rows)
        cell_w = 210
        cell_h = 85
        margin = 24
        header_h = 60

        img_w = num_cols * cell_w + margin * 2
        img_h = header_h + num_rows * cell_h + margin * 2

        img = Image.new("RGB", (img_w, img_h), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        font = ImageFont.load_default()

        draw.text((margin, 20), f"{self.title} (OR-Tools CP-SAT + ML)", fill=(31, 78, 120), font=font)

        y_start = header_h
        for r_idx, row in enumerate(self.rows):
            for c_idx, cell_val in enumerate(row):
                x = margin + c_idx * cell_w
                y = y_start + r_idx * cell_h

                if r_idx == 0:
                    bg = (31, 78, 120)
                    fg = (255, 255, 255)
                elif "BREAK" in str(row[0]):
                    bg = (254, 243, 199)
                    fg = (120, 53, 15)
                elif r_idx % 2 == 0:
                    bg = (248, 250, 252)
                    fg = (15, 23, 42)
                else:
                    bg = (255, 255, 255)
                    fg = (15, 23, 42)

                draw.rectangle([(x, y), (x + cell_w, y + cell_h)], fill=bg, outline=(203, 213, 225), width=1)

                lines = str(cell_val).split("\n")[:4]
                for l_i, line in enumerate(lines):
                    draw.text((x + 8, y + 8 + l_i * 16), line[:28], fill=fg, font=font)

        buf = io.BytesIO()
        if ext == "jpg":
            img.save(buf, format="JPEG", quality=92)
        else:
            img.save(buf, format="PNG")
        return buf.getvalue()

    def _export_json(self) -> bytes:
        payload = {
            "view_type": self.view_type,
            "title": self.title,
            "metadata": {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "fairness_score": self.metadata.get("fairness_score", 0.92),
                "preference_satisfaction": self.metadata.get("preference_satisfaction", 0.88),
                "total_courses": self.metadata.get("total_courses", len(self.entries)),
                "total_teachers": self.metadata.get("total_teachers", 5),
            },
            "headers": self.rows[0] if self.rows else [],
            "table_rows": self.rows[1:] if len(self.rows) > 1 else [],
            "entries": self.entries,
        }
        return json.dumps(payload, indent=2).encode("utf-8")

    def _export_html(self) -> bytes:
        fairness = float(self.metadata.get("fairness_score", 0.92)) * 100
        pref = float(self.metadata.get("preference_satisfaction", 0.88)) * 100
        safe_title = html.escape(self.title)

        html_lines = [
            "<!DOCTYPE html>",
            "<html><head><meta charset='UTF-8'>",
            f"<title>{safe_title}</title>",
            "<style>",
            "body { font-family: system-ui, -apple-system, sans-serif; margin: 24px; background: #f8fafc; color: #0f172a; }",
            "h1 { color: #1e3a8a; margin-bottom: 8px; }",
            "table { border-collapse: collapse; width: 100%; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }",
            "th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-size: 13px; white-space: pre-line; }",
            "th { background: #1e3a8a; color: white; font-weight: 600; }",
            "tr:nth-child(even) { background: #f1f5f9; }",
            ".break-row { background: #fef3c7 !important; font-weight: 600; color: #92400e; }",
            ".metrics { margin-top: 16px; padding: 14px; background: white; border: 1px solid #cbd5e1; border-radius: 8px; }",
            "</style></head><body>",
            f"<h1>{safe_title}</h1>",
            "<table>",
        ]

        for r_idx, row in enumerate(self.rows):
            if r_idx == 0:
                html_lines.append(
                    "<thead><tr>"
                    + "".join(f"<th>{html.escape(str(c))}</th>" for c in row)
                    + "</tr></thead><tbody>"
                )
            else:
                row_cls = " class='break-row'" if "BREAK" in str(row[0]) else ""
                html_lines.append(
                    f"<tr{row_cls}>"
                    + "".join(f"<td>{html.escape(str(c))}</td>" for c in row)
                    + "</tr>"
                )

        html_lines.extend(
            [
                "</tbody></table>",
                "<div class='metrics'>",
                f"<strong>Fairness Score:</strong> {fairness:.1f}% &nbsp;|&nbsp; ",
                f"<strong>Preference Satisfaction:</strong> {pref:.1f}% &nbsp;|&nbsp; ",
                f"<strong>Total Courses:</strong> {int(self.metadata.get('total_courses', len(self.entries)))}",
                "</div></body></html>",
            ]
        )
        return "\n".join(html_lines).encode("utf-8")
