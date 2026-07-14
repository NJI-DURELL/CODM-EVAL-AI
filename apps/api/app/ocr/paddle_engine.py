from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from PIL import Image


@dataclass
class OcrToken:
    text: str
    confidence: float
    x_center: float
    y_center: float


@lru_cache
def _load_engine():
    # Imported lazily: PaddleOCR pulls in paddlepaddle and downloads model
    # weights on first use, which is slow and unnecessary for anything that
    # doesn't touch OCR (e.g. running the test suite for scoring logic).
    from paddleocr import PaddleOCR

    return PaddleOCR(use_angle_cls=True, lang="en", show_log=False)


def run_ocr(image: Image.Image) -> list[OcrToken]:
    engine = _load_engine()
    image_array = np.array(image.convert("RGB"))
    result = engine.ocr(image_array, cls=True)

    tokens: list[OcrToken] = []
    for line in result or []:
        # PaddleOCR returns `[None]` (a page entry, not an empty result) for
        # a page/region with no detected text, rather than `[]` — skip it.
        for box, (text, confidence) in line or []:
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            tokens.append(
                OcrToken(
                    text=text.strip(),
                    confidence=confidence,
                    x_center=sum(xs) / len(xs),
                    y_center=sum(ys) / len(ys),
                )
            )
    return tokens
