import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import pymupdf  # Modern PyMuPDF API
from pydantic import BaseModel, Field

from backend.app.schemas.provenance import (
    BoundingBox,
    ExtractionStatus,
    PageExtractionInfo,
    UncertaintyFlag,
)

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB safety limit


class TextWord(BaseModel):
    """Word-level coordinate token."""
    text: str
    bbox: BoundingBox
    block_no: int
    line_no: int
    word_no: int


class TextLine(BaseModel):
    """Line-level coordinate token."""
    text: str
    bbox: BoundingBox
    words: List[TextWord] = Field(default_factory=list)


class TextBlock(BaseModel):
    """Block-level coordinate container."""
    block_no: int
    bbox: BoundingBox
    text: str
    lines: List[TextLine] = Field(default_factory=list)


class PDFPageContent(BaseModel):
    """Rich page-level content with layout coordinates and multi-signal metrics."""
    page_number: int
    text: str
    rect: List[float] = Field(default_factory=list)  # [x0, y0, x1, y1]
    image_count: int = 0
    drawing_count: int = 0
    font_count: int = 0
    word_count: int = 0
    has_selectable_text: bool = True
    is_likely_scanned: bool = False
    needs_ocr: bool = False
    page_uncertainty_flags: List[UncertaintyFlag] = Field(default_factory=list)
    words: List[TextWord] = Field(default_factory=list)
    blocks: List[TextBlock] = Field(default_factory=list)

    def to_page_info(self) -> PageExtractionInfo:
        return PageExtractionInfo(
            page_number=self.page_number,
            has_selectable_text=self.has_selectable_text,
            text_length=len(self.text.strip()),
            word_count=self.word_count,
            image_count=self.image_count,
            drawing_count=self.drawing_count,
            is_likely_scanned=self.is_likely_scanned,
            needs_ocr=self.needs_ocr,
            page_uncertainty_flags=self.page_uncertainty_flags,
        )


class PDFParsedDocument(BaseModel):
    """Document-level container for multi-page extraction and safety diagnostics."""
    filename: str
    page_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)
    pages: List[PDFPageContent] = Field(default_factory=list)
    full_text: str = ""
    extraction_status: ExtractionStatus = ExtractionStatus.SUCCESS
    ocr_required: bool = False
    document_uncertainty_flags: List[UncertaintyFlag] = Field(default_factory=list)
    error_detail: Optional[str] = None


class PDFParser:
    """
    Robust PyMuPDF-based PDF parser supporting multi-signal scanned page detection,
    coordinate tracking, and safe handling of corrupt, empty, and encrypted documents.
    """

    @classmethod
    def parse_pdf(
        cls,
        file_bytes_or_path: Union[bytes, str, Path],
        filename: str = "document.pdf",
    ) -> PDFParsedDocument:
        """
        Parse a PDF file from bytes or path with comprehensive safety validations.
        Never logs sensitive document contents or patient PII.
        """
        # 1. File existence / Empty check
        if isinstance(file_bytes_or_path, (str, Path)):
            path = Path(file_bytes_or_path)
            if not path.exists():
                return PDFParsedDocument(
                    filename=filename,
                    extraction_status=ExtractionStatus.CORRUPT_DOCUMENT,
                    error_detail=f"File not found: {filename}",
                )
            if path.stat().st_size == 0:
                return PDFParsedDocument(
                    filename=filename,
                    extraction_status=ExtractionStatus.EMPTY_DOCUMENT,
                    error_detail="File is empty (0 bytes)",
                )
            if path.stat().st_size > MAX_FILE_SIZE_BYTES:
                return PDFParsedDocument(
                    filename=filename,
                    extraction_status=ExtractionStatus.UNSUPPORTED_FORMAT,
                    error_detail=f"File exceeds maximum permissible size of {MAX_FILE_SIZE_BYTES // (1024*1024)} MB",
                )
            open_target = str(path)
            is_stream = False
        else:
            raw_bytes = file_bytes_or_path
            if len(raw_bytes) == 0:
                return PDFParsedDocument(
                    filename=filename,
                    extraction_status=ExtractionStatus.EMPTY_DOCUMENT,
                    error_detail="Uploaded file is empty (0 bytes)",
                )
            if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
                return PDFParsedDocument(
                    filename=filename,
                    extraction_status=ExtractionStatus.UNSUPPORTED_FORMAT,
                    error_detail=f"File exceeds maximum permissible size of {MAX_FILE_SIZE_BYTES // (1024*1024)} MB",
                )
            open_target = raw_bytes
            is_stream = True

        # 2. Open PDF with PyMuPDF
        try:
            if is_stream:
                doc = pymupdf.open(stream=open_target, filetype="pdf")
            else:
                doc = pymupdf.open(open_target)
        except (pymupdf.FileDataError, Exception) as e:
            logger.warning(f"Failed to open document '{filename}' as valid PDF: {type(e).__name__}")
            return PDFParsedDocument(
                filename=filename,
                extraction_status=ExtractionStatus.CORRUPT_DOCUMENT,
                error_detail="Document is corrupt or not a valid PDF file format.",
            )

        try:
            # 3. Check for encryption / password protection
            if doc.is_encrypted or doc.needs_pass:
                logger.info(f"Document '{filename}' is encrypted/password-protected.")
                return PDFParsedDocument(
                    filename=filename,
                    page_count=len(doc),
                    extraction_status=ExtractionStatus.ENCRYPTED_DOCUMENT,
                    error_detail="Document is password protected or encrypted.",
                )

            page_count = len(doc)
            if page_count == 0:
                return PDFParsedDocument(
                    filename=filename,
                    page_count=0,
                    extraction_status=ExtractionStatus.EMPTY_DOCUMENT,
                    error_detail="PDF contains 0 pages.",
                )

            pages: List[PDFPageContent] = []
            full_text_parts: List[str] = []
            doc_uncertainties: List[UncertaintyFlag] = []
            ocr_required_doc = False

            # 4. Extract each page
            for page_idx in range(page_count):
                page = doc[page_idx]
                page_num = page_idx + 1

                # Raw metrics
                page_text = page.get_text("text") or ""
                trimmed_text = page_text.strip()
                text_len = len(trimmed_text)

                raw_words = page.get_text("words") or []
                word_count = len(raw_words)

                images = page.get_images() or []
                image_count = len(images)

                drawings = page.get_drawings() or []
                drawing_count = len(drawings)

                fonts = page.get_fonts() or []
                font_count = len(fonts)

                page_rect = [page.rect.x0, page.rect.y0, page.rect.x1, page.rect.y1]

                # Multi-signal scanned / image detection
                has_selectable_text = False
                is_likely_scanned = False
                needs_ocr = False
                page_flags: List[UncertaintyFlag] = []

                if text_len >= 80 and word_count >= 10:
                    # Strong selectable digital text
                    has_selectable_text = True
                    is_likely_scanned = False
                    needs_ocr = False
                elif text_len < 30 and image_count >= 1:
                    # Scanned page: virtually no text, but has raster image(s)
                    has_selectable_text = False
                    is_likely_scanned = True
                    needs_ocr = True
                    page_flags.append(UncertaintyFlag.SCANNED_PAGE_DETECTED)
                    page_flags.append(UncertaintyFlag.OCR_REQUIRED)
                elif text_len < 30 and image_count == 0 and drawing_count > 0:
                    # Drawings only without fonts
                    has_selectable_text = False
                    is_likely_scanned = False
                    needs_ocr = True
                    page_flags.append(UncertaintyFlag.UNCERTAIN_PAGE_TYPE)
                    page_flags.append(UncertaintyFlag.OCR_REQUIRED)
                elif text_len == 0 and image_count == 0 and drawing_count == 0:
                    # Pure blank page
                    has_selectable_text = False
                    is_likely_scanned = False
                    needs_ocr = False
                elif 30 <= text_len < 80 and image_count >= 1:
                    # Ambiguous / partial scan
                    has_selectable_text = True
                    is_likely_scanned = False
                    needs_ocr = True
                    page_flags.append(UncertaintyFlag.UNCERTAIN_PAGE_TYPE)
                    page_flags.append(UncertaintyFlag.OCR_REQUIRED)
                elif text_len < 30:
                    # Very sparse text without images
                    has_selectable_text = text_len > 0
                    is_likely_scanned = False
                    needs_ocr = False
                    page_flags.append(UncertaintyFlag.UNCERTAIN_PAGE_TYPE)
                else:
                    has_selectable_text = True
                    is_likely_scanned = False
                    needs_ocr = False

                if needs_ocr:
                    ocr_required_doc = True
                    if UncertaintyFlag.OCR_REQUIRED not in doc_uncertainties:
                        doc_uncertainties.append(UncertaintyFlag.OCR_REQUIRED)

                for f in page_flags:
                    if f not in doc_uncertainties:
                        doc_uncertainties.append(f)

                # Extract word tokens with bounding boxes
                words: List[TextWord] = []
                for w in raw_words:
                    # w format: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
                    if len(w) >= 8:
                        bbox = BoundingBox(x0=w[0], y0=w[1], x1=w[2], y1=w[3])
                        words.append(
                            TextWord(
                                text=str(w[4]),
                                bbox=bbox,
                                block_no=int(w[5]),
                                line_no=int(w[6]),
                                word_no=int(w[7]),
                            )
                        )

                # Extract blocks with layout coordinates
                blocks: List[TextBlock] = cls._extract_blocks(page, page_num)

                pages.append(
                    PDFPageContent(
                        page_number=page_num,
                        text=page_text,
                        rect=page_rect,
                        image_count=image_count,
                        drawing_count=drawing_count,
                        font_count=font_count,
                        word_count=word_count,
                        has_selectable_text=has_selectable_text,
                        is_likely_scanned=is_likely_scanned,
                        needs_ocr=needs_ocr,
                        page_uncertainty_flags=page_flags,
                        words=words,
                        blocks=blocks,
                    )
                )
                full_text_parts.append(page_text)

            overall_status = ExtractionStatus.SUCCESS
            if ocr_required_doc:
                overall_status = ExtractionStatus.OCR_REQUIRED
            elif any(f == UncertaintyFlag.UNCERTAIN_PAGE_TYPE for f in doc_uncertainties):
                overall_status = ExtractionStatus.UNCERTAIN

            meta = dict(doc.metadata) if doc.metadata else {}
            # Sanitize metadata (do not include passwords/keys)
            safe_meta = {k: str(v) for k, v in meta.items() if v}

            return PDFParsedDocument(
                filename=filename,
                page_count=page_count,
                metadata=safe_meta,
                pages=pages,
                full_text="\n\n".join(full_text_parts),
                extraction_status=overall_status,
                ocr_required=ocr_required_doc,
                document_uncertainty_flags=doc_uncertainties,
            )
        finally:
            doc.close()

    @staticmethod
    def _extract_blocks(page: pymupdf.Page, page_num: int) -> List[TextBlock]:
        """Extract structured block hierarchy from page."""
        raw_blocks = page.get_text("blocks") or []
        blocks: List[TextBlock] = []

        for b in raw_blocks:
            # b format: (x0, y0, x1, y1, "text", block_no, block_type)
            if len(b) >= 7 and b[6] == 0:  # block_type 0 = text
                bbox = BoundingBox(x0=b[0], y0=b[1], x1=b[2], y1=b[3])
                blocks.append(
                    TextBlock(
                        block_no=int(b[5]),
                        bbox=bbox,
                        text=str(b[4]),
                        lines=[],
                    )
                )

        return blocks
