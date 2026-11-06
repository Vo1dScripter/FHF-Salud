#!/usr/bin/env python3
"""Genera el informe desde evidencia Markdown; requiere reportlab."""
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.utils import ImageReader

root=Path(__file__).resolve().parents[2]
folder=root/'evidencias/TAR05'
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyReport',fontName='Helvetica',fontSize=10,leading=15,spaceAfter=9,splitLongWords=True))
styles.add(ParagraphStyle(name='CoverReport',fontName='Helvetica-Bold',fontSize=28,leading=34,textColor=colors.HexColor('#07594d'),alignment=TA_CENTER,spaceAfter=22))
styles.add(ParagraphStyle(name='SubtitleReport',fontName='Helvetica',fontSize=13,leading=20,alignment=TA_CENTER,spaceAfter=20))
styles['Heading1'].textColor=colors.HexColor('#07594d')
story=[Spacer(1,65),Paragraph('FHF SALUD',styles['CoverReport']),Paragraph('TAR05 - Equipo Amarillo',styles['CoverReport']),Paragraph('Ingeniería de Software (SCD-1011)<br/>Instituto Tecnológico Superior de Xalapa',styles['SubtitleReport']),Spacer(1,25),Paragraph('Auditoría, integración y consolidación de base de datos',styles['SubtitleReport']),Paragraph('6 de noviembre de 2026',styles['SubtitleReport']),Spacer(1,22),Paragraph('Supabase real y Vercel verificados.<br/>E2E autenticado: 26 PASS.<br/>Concurrencia remota y limpieza aprobadas.',styles['SubtitleReport']),Paragraph('Autores verificables en Git: Rodrigo Ruiz Aguilar; Emilio Martinez; yaird meyer; jesus_ff; Manuel Alvarez.',styles['SubtitleReport']),Paragraph('No se proporcionó un reporte TAR05 previo con portada o firmas. No se generaron firmas ni se completaron identidades. El PDF PRY05 original se conserva intacto.',styles['BodyReport']),PageBreak()]
for block in (folder/'INFORME.md').read_text().split('\n\n'):
    text=block.strip()
    if not text or text.startswith('# TAR05'):continue
    if text.startswith('## '):
        story.append(Paragraph(escape(text[3:]),styles['Heading1']))
    else:
        story.append(Paragraph(escape(text).replace('\n',' '),styles['BodyReport']))
story += [PageBreak(),Paragraph('Anexo - E2E autenticado en producción',styles['Heading1']),Paragraph('Capturas reales del sitio publicado con cuentas normales y datos ficticios de la corrida tar05-1793949455394. Los registros y las tres cuentas fueron eliminados después de validar. Las pruebas anteriores sin sesión permanecen en el repositorio como antecedentes.',styles['BodyReport'])]
shots = []
for viewport in ['1440', '390']:
    for suffix, label in [
        ('01-registro','RF-01: alta UI con ID persistido'),
        ('02-detalle-recargado','RF-02: detalle tras recargar'),
        ('03-reprogramada','RF-03: horario reprogramado'),
        ('04-confirmada-recargada','RF-06: confirmada después de recargar'),
        ('05-cancelada-conservada','RF-04: cancelada conservando su registro'),
    ]:
        shots.append((f'e2e-tar05-1793949455394/{viewport}-{suffix}.png',f'{label} - {viewport}px',460 if viewport == '1440' else 250))
shots += [('e2e-tar05-1793949455394/permisos-physician.png','Cuenta médica: consulta limitada por permisos.',460),('e2e-tar05-1793949455394/permisos-noRole.png','Cuenta sin rol: acceso restringido.',460)]
for filename,label,width in shots:
    path=folder/filename
    if path.exists():
        w,h=ImageReader(str(path)).getSize()
        width=min(width, 620*w/h)
        story.append(KeepTogether([Paragraph(label,styles['Heading2']),Image(str(path),width=width,height=width*h/w),Spacer(1,15)]))
def footer(canvas,doc):
    canvas.saveState();canvas.setStrokeColor(colors.HexColor('#91b8ac'));canvas.line(42,36,553,36)
    canvas.setFont('Helvetica',8);canvas.drawString(42,24,'FHF Salud | TAR05 | E2E real 26 PASS y limpieza verificada')
    canvas.drawRightString(553,24,str(doc.page));canvas.restoreState()
SimpleDocTemplate(str(folder/'TAR05-Amarillo.pdf'),pagesize=(595.28,841.89),rightMargin=42,leftMargin=42,topMargin=44,bottomMargin=48,title='TAR05 - Amarillo - FHF Salud',author='Equipo Amarillo').build(story,onFirstPage=footer,onLaterPages=footer)
print(folder/'TAR05-Amarillo.pdf')
