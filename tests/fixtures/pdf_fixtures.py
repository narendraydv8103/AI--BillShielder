import pymupdf


def create_digital_invoice_multipage_pdf() -> bytes:
    """
    Generate a 2-page digital invoice PDF with:
    - Hospital header, metadata, patient details
    - Multi-page line items across page 1 and page 2
    - Repeated table headers on page 2
    - Summary section with Subtotal, Discount, and Total Net Payable
    """
    doc = pymupdf.open()

    # --- Page 1 ---
    page1 = doc.new_page(width=595, height=842)  # A4

    # Hospital Header
    page1.insert_text(pymupdf.Point(50, 50), "Max Super Speciality Hospital, New Delhi", fontsize=14)
    page1.insert_text(pymupdf.Point(50, 70), "1 Press Enclave Road, Saket, New Delhi - 110017", fontsize=9)

    # Invoice & Patient Metadata
    page1.insert_text(pymupdf.Point(50, 100), "Bill No: MAX-2024-8831", fontsize=10)
    page1.insert_text(pymupdf.Point(300, 100), "Bill Date: 12-Oct-2024", fontsize=10)
    page1.insert_text(pymupdf.Point(50, 120), "Patient Name: Rajesh Sharma", fontsize=10)
    page1.insert_text(pymupdf.Point(300, 120), "UHID: MX-908123", fontsize=10)
    page1.insert_text(pymupdf.Point(50, 140), "Admission Date: 08-Oct-2024", fontsize=10)
    page1.insert_text(pymupdf.Point(300, 140), "Discharge Date: 12-Oct-2024", fontsize=10)

    # Table Header (Page 1)
    y = 180
    page1.insert_text(pymupdf.Point(50, y), "S.No", fontsize=10)
    page1.insert_text(pymupdf.Point(90, y), "Description", fontsize=10)
    page1.insert_text(pymupdf.Point(350, y), "Qty", fontsize=10)
    page1.insert_text(pymupdf.Point(410, y), "Rate", fontsize=10)
    page1.insert_text(pymupdf.Point(490, y), "Amount", fontsize=10)

    # Page 1 Items
    items_p1 = [
        ("1", "ICU Bed & Monitoring Charges", "2.0", "15000.00", "30000.00"),
        ("2", "Doctor In-Patient Visit", "4.0", "2500.00", "10000.00"),
        ("3", "Nursing Care Charges", "2.0", "3000.00", "6000.00"),
        ("4", "Syringe Infusion Pump Overhead", "2.0", "1200.00", "2400.00"),
    ]
    for sno, desc, qty, rate, amt in items_p1:
        y += 30
        page1.insert_text(pymupdf.Point(50, y), sno, fontsize=9)
        page1.insert_text(pymupdf.Point(90, y), desc, fontsize=9)
        page1.insert_text(pymupdf.Point(350, y), qty, fontsize=9)
        page1.insert_text(pymupdf.Point(410, y), rate, fontsize=9)
        page1.insert_text(pymupdf.Point(490, y), amt, fontsize=9)

    page1.insert_text(pymupdf.Point(250, 800), "Continued on Page 2...", fontsize=9)

    # --- Page 2 ---
    page2 = doc.new_page(width=595, height=842)

    page2.insert_text(pymupdf.Point(50, 50), "Max Super Speciality Hospital, New Delhi (Page 2)", fontsize=10)
    page2.insert_text(pymupdf.Point(50, 70), "Bill No: MAX-2024-8831", fontsize=9)

    # Repeated Table Header (Page 2)
    y = 100
    page2.insert_text(pymupdf.Point(50, y), "S.No", fontsize=10)
    page2.insert_text(pymupdf.Point(90, y), "Description", fontsize=10)
    page2.insert_text(pymupdf.Point(350, y), "Qty", fontsize=10)
    page2.insert_text(pymupdf.Point(410, y), "Rate", fontsize=10)
    page2.insert_text(pymupdf.Point(490, y), "Amount", fontsize=10)

    # Page 2 Items
    items_p2 = [
        ("5", "High Risk PPE Kit Care", "4.0", "1800.00", "7200.00"),
        ("6", "Sterile Surgical Gloves", "6.0", "350.00", "2100.00"),
        ("7", "Paracetamol IV 100ml", "4.0", "220.00", "880.00"),
        ("8", "Administrative Record File Fee", "1.0", "2500.00", "2500.00"),
    ]
    for sno, desc, qty, rate, amt in items_p2:
        y += 30
        page2.insert_text(pymupdf.Point(50, y), sno, fontsize=9)
        page2.insert_text(pymupdf.Point(90, y), desc, fontsize=9)
        page2.insert_text(pymupdf.Point(350, y), qty, fontsize=9)
        page2.insert_text(pymupdf.Point(410, y), rate, fontsize=9)
        page2.insert_text(pymupdf.Point(490, y), amt, fontsize=9)

    # Summary section
    y += 50
    page2.insert_text(pymupdf.Point(320, y), "Sub Total:", fontsize=10)
    page2.insert_text(pymupdf.Point(480, y), "61080.00", fontsize=10)

    y += 25
    page2.insert_text(pymupdf.Point(320, y), "Discount:", fontsize=10)
    page2.insert_text(pymupdf.Point(480, y), "-1080.00", fontsize=10)

    y += 25
    page2.insert_text(pymupdf.Point(320, y), "Total Net Payable:", fontsize=11)
    page2.insert_text(pymupdf.Point(480, y), "60000.00", fontsize=11)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_wrapped_description_pdf() -> bytes:
    """
    Generate a PDF where a line item has a multi-line wrapped description:
    Row 1: description part 1 with Qty, Rate, Amount
    Row 2: description part 2 with NO numbers (should be stitched into Row 1)
    """
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)

    page.insert_text(pymupdf.Point(50, 50), "Fortis Healthcare Institute, New Delhi", fontsize=13)
    page.insert_text(pymupdf.Point(50, 75), "Bill No: FOR-9921", fontsize=10)

    y = 120
    page.insert_text(pymupdf.Point(50, y), "S.No", fontsize=10)
    page.insert_text(pymupdf.Point(90, y), "Description", fontsize=10)
    page.insert_text(pymupdf.Point(350, y), "Qty", fontsize=10)
    page.insert_text(pymupdf.Point(410, y), "Rate", fontsize=10)
    page.insert_text(pymupdf.Point(490, y), "Amount", fontsize=10)

    # Item 1 with wrapped description line
    y += 30
    page.insert_text(pymupdf.Point(50, y), "1", fontsize=9)
    page.insert_text(pymupdf.Point(90, y), "Surgical Laparoscopic Abdominal Intervention", fontsize=9)
    page.insert_text(pymupdf.Point(350, y), "1.0", fontsize=9)
    page.insert_text(pymupdf.Point(410, y), "45000.00", fontsize=9)
    page.insert_text(pymupdf.Point(490, y), "45000.00", fontsize=9)

    # Wrapped continuation line (immediately below, within 15 points)
    y += 14
    page.insert_text(pymupdf.Point(90, y), "with intraoperative fluoroscopy guidance and continuous monitoring", fontsize=8)

    # Item 2
    y += 30
    page.insert_text(pymupdf.Point(50, y), "2", fontsize=9)
    page.insert_text(pymupdf.Point(90, y), "Post-Operative Room Rent Deluxe", fontsize=9)
    page.insert_text(pymupdf.Point(350, y), "2.0", fontsize=9)
    page.insert_text(pymupdf.Point(410, y), "8000.00", fontsize=9)
    page.insert_text(pymupdf.Point(490, y), "16000.00", fontsize=9)

    # Summary
    y += 50
    page.insert_text(pymupdf.Point(350, y), "Sub Total:", fontsize=10)
    page.insert_text(pymupdf.Point(480, y), "61000.00", fontsize=10)

    y += 25
    page.insert_text(pymupdf.Point(350, y), "Total:", fontsize=10)
    page.insert_text(pymupdf.Point(480, y), "61000.00", fontsize=10)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_indian_currency_pdf() -> bytes:
    """
    Generate a PDF testing diverse Indian currency formats:
    - Symbols: ₹ 1,50,000.00, Rs. 4,500.50
    - Negative discount: -1,200.00
    - Parenthesized credit: (500.00)
    - Indian /- notation: 500/-
    """
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)

    page.insert_text(pymupdf.Point(50, 50), "Manipal Hospital, Bangalore", fontsize=13)
    page.insert_text(pymupdf.Point(50, 75), "Bill No: MAN-5521", fontsize=10)

    y = 120
    page.insert_text(pymupdf.Point(50, y), "S.No", fontsize=10)
    page.insert_text(pymupdf.Point(90, y), "Description", fontsize=10)
    page.insert_text(pymupdf.Point(350, y), "Qty", fontsize=10)
    page.insert_text(pymupdf.Point(410, y), "Rate", fontsize=10)
    page.insert_text(pymupdf.Point(490, y), "Amount", fontsize=10)

    items = [
        ("1", "Specialist Consultation Fee", "1.0", "₹ 1,50,000.00", "₹ 1,50,000.00"),
        ("2", "Advanced Pathology Panel", "1.0", "Rs. 4,500.50", "Rs. 4,500.50"),
        ("3", "Institutional Concession Discount", "1.0", "-1,200.00", "-1,200.00"),
        ("4", "Advance Booking Credit", "1.0", "(500.00)", "(500.00)"),
        ("5", "Surgical Dressing Surcharge", "1.0", "500/-", "500/-"),
    ]

    for sno, desc, qty, rate, amt in items:
        y += 30
        page.insert_text(pymupdf.Point(50, y), sno, fontsize=9)
        page.insert_text(pymupdf.Point(90, y), desc, fontsize=9)
        page.insert_text(pymupdf.Point(350, y), qty, fontsize=9)
        page.insert_text(pymupdf.Point(400, y), rate, fontsize=9)
        page.insert_text(pymupdf.Point(480, y), amt, fontsize=9)

    y += 50
    page.insert_text(pymupdf.Point(350, y), "Total Amount:", fontsize=10)
    page.insert_text(pymupdf.Point(480, y), "₹ 1,53,300.50", fontsize=10)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_ambiguous_columns_pdf() -> bytes:
    """
    Generate a PDF testing missing columns and ambiguous rates/quantities:
    - Item 1: Description and Total only (missing rate & quantity)
    - Item 2: Description, Qty (small int), and Total (missing rate)
    - Item 3: Description, Rate (large float), and Total (missing qty)
    """
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)

    page.insert_text(pymupdf.Point(50, 50), "City Clinic Healthcare, Delhi", fontsize=13)
    page.insert_text(pymupdf.Point(50, 75), "Bill No: CIT-1002", fontsize=10)

    y = 120
    page.insert_text(pymupdf.Point(50, y), "S.No", fontsize=10)
    page.insert_text(pymupdf.Point(90, y), "Description", fontsize=10)
    page.insert_text(pymupdf.Point(450, y), "Amount", fontsize=10)

    # 1 number: only total charge
    y += 30
    page.insert_text(pymupdf.Point(50, y), "1", fontsize=9)
    page.insert_text(pymupdf.Point(90, y), "Emergency Resuscitation Service", fontsize=9)
    page.insert_text(pymupdf.Point(450, y), "5000.00", fontsize=9)

    # 2 numbers: qty (2) and total (4000.00)
    y += 30
    page.insert_text(pymupdf.Point(50, y), "2", fontsize=9)
    page.insert_text(pymupdf.Point(90, y), "Diagnostic Ultrasound Abdomen", fontsize=9)
    page.insert_text(pymupdf.Point(380, y), "2", fontsize=9)
    page.insert_text(pymupdf.Point(450, y), "4000.00", fontsize=9)

    # 2 numbers: rate (1500.00) and total (3000.00)
    y += 30
    page.insert_text(pymupdf.Point(50, y), "3", fontsize=9)
    page.insert_text(pymupdf.Point(90, y), "Physiotherapy Session", fontsize=9)
    page.insert_text(pymupdf.Point(380, y), "1500.00", fontsize=9)
    page.insert_text(pymupdf.Point(450, y), "3000.00", fontsize=9)

    # Total
    y += 40
    page.insert_text(pymupdf.Point(350, y), "Total:", fontsize=10)
    page.insert_text(pymupdf.Point(450, y), "12000.00", fontsize=10)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_scanned_image_pdf() -> bytes:
    """
    Generate a PDF page containing only an embedded raster image (pixmap)
    and ZERO selectable text tokens, simulating a scanned document.
    """
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)

    # Create synthetic RGB raster image
    pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 300, 400), 0)
    page.insert_image(pymupdf.Rect(50, 50, 500, 750), pixmap=pix)

    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_blank_pdf() -> bytes:
    """
    Generate an empty 1-page PDF document with zero text, zero images, zero drawings.
    """
    doc = pymupdf.open()
    doc.new_page(width=595, height=842)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def create_encrypted_pdf(password: str = "secret123") -> bytes:
    """
    Generate a PDF encrypted with user password using AES-256 encryption.
    """
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text(pymupdf.Point(50, 100), "Confidential Protected Medical Document", fontsize=12)

    pdf_bytes = doc.tobytes(
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw=password,
        owner_pw="master123",
    )
    doc.close()
    return pdf_bytes
