#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Text Processor Pro — Fusion Edition
By Disha Galal © (merged & hardened build)

Professional text, file & media toolkit optimized for Termux / Linux (Ubuntu).

This build merges two earlier scripts into one:
  * "Text Processor Pro" (v3.1.0)  — the full text/file toolkit (20 tools:
    read/write/append, search, replace, clean, stats, backups, dedupe,
    sort, regex extraction, diff, merge, temp cleaner, device status...).
  * "PFMT" (v4.0.0)                — added two extra tools: password-based
    file encryption/decryption and audio/video-to-text transcription.

Everything from both is here, deduplicated, bug-fixed, and extended with:
  * Dependency self-check (--check-deps) instead of silent fallbacks only.
  * Safer subprocess/ffmpeg handling (checks the binary before running it).
  * Encrypted files carry the KDF salt + iteration count so old files still
    decrypt if the default iteration count is ever raised later.
  * Batch (whole-directory) encrypt/decrypt.
  * More CLI automation flags for scripting / cron / Termux:boot.

Uses: rich, charset-normalizer, psutil, rapidfuzz, cryptography,
SpeechRecognition (+ ffmpeg binary), concurrent.futures, difflib.
"""

from __future__ import annotations

import os
import sys
import re
import time
import glob
import json
import shutil
import difflib
import argparse
import logging
import subprocess
import concurrent.futures
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple, Union

# ---------------------------------------------------------------------------
# Optional professional libraries (graceful fallback)
# ---------------------------------------------------------------------------
try:
    import arabic_reshaper
    from bidi.algorithm import get_display as _bidi_display
    HAS_ARABIC = True
except ImportError:
    HAS_ARABIC = False
    arabic_reshaper = None  # type: ignore
    _bidi_display = None  # type: ignore

try:
    from charset_normalizer import from_bytes, from_path
    HAS_CHARSET = True
except ImportError:
    HAS_CHARSET = False

try:
    from rich.console import Console, Group
    from rich.table import Table
    from rich.panel import Panel
    from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
    from rich.prompt import Prompt, Confirm
    from rich.text import Text
    from rich.rule import Rule
    from rich.align import Align
    from rich.live import Live
    from rich import box
    console = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console = None  # type: ignore

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    psutil = None  # type: ignore

try:
    from rapidfuzz import fuzz, process as rf_process
    HAS_RAPIDFUZZ = True
except ImportError:
    HAS_RAPIDFUZZ = False
    fuzz = None  # type: ignore
    rf_process = None  # type: ignore

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    tqdm = None  # type: ignore

try:
    import base64
    from cryptography.fernet import Fernet, InvalidToken
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False
    Fernet = None  # type: ignore
    InvalidToken = Exception  # type: ignore

try:
    import speech_recognition as sr
    HAS_SR = True
except ImportError:
    HAS_SR = False
    sr = None  # type: ignore

# ---------------------------------------------------------------------------
# Constants & configuration
# ---------------------------------------------------------------------------
AUTHOR_SIGNATURE = "By Disha Galal ©"
VERSION = "5.0.0-Fusion"
ENC_MAGIC = b"TPPF1"          # file-format tag for encrypted files
ENC_KDF_ITERATIONS = 200_000  # PBKDF2 iterations for new encryptions

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".cache", "proc", "sys",
    ".venv", "venv", "site-packages", ".local", "snap",
}

TEMP_EXTENSIONS = {
    ".tmp", ".temp", ".bak", ".old", ".swp", ".cache", ".log",
    ".crdownload", ".part", ".ds_store", ".pyc", ".pyo",
}
TEMP_DIR_NAMES = {"__pycache__", ".cache", "cache", "tmp", "temp", "Temp", "Cache"}

_ARABIC_RANGE = re.compile(
    r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]"
)

SEARCHABLE_EXTS = {
    ".txt", ".csv", ".json", ".py", ".html", ".htm", ".md", ".log",
    ".php", ".js", ".ts", ".css", ".xml", ".yml", ".yaml", ".ini",
    ".cfg", ".conf", ".sql", ".sh", ".bash", ".zsh", ".toml",
}

BACKUP_DIR = Path.home() / ".script_backups"
DEFAULT_ENCODING_FALLBACKS = ["utf-8", "windows-1256", "cp1256", "latin-1", "iso-8859-6"]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("TextProcessorPro")

# ---------------------------------------------------------------------------
# Dependency self-check
# ---------------------------------------------------------------------------
def print_dependency_report() -> None:
    """Prints which optional libraries/binaries are available vs missing,
    and the exact pip/pkg command to install what's missing."""
    rows = [
        ("rich",                HAS_RICH,    "pip install rich",
         "الواجهة الملوّنة، الجداول، شريط التقدّم"),
        ("charset-normalizer",  HAS_CHARSET, "pip install charset-normalizer",
         "اكتشاف ترميز الملفات تلقائياً (عربي/CP1256/UTF-8...)"),
        ("psutil",              HAS_PSUTIL,  "pip install psutil",
         "قراءة RAM/CPU الحقيقية لحالة الجهاز"),
        ("rapidfuzz",           HAS_RAPIDFUZZ, "pip install rapidfuzz",
         "بحث ضبابي أسرع بكثير من difflib"),
        ("arabic-reshaper+python-bidi", HAS_ARABIC,
         "pip install arabic-reshaper python-bidi",
         "عرض صحيح للنص العربي في بعض الطرفيات"),
        ("cryptography",        HAS_CRYPTO,  "pip install cryptography",
         "تشفير / فك تشفير الملفات (AES عبر Fernet)"),
        ("SpeechRecognition",   HAS_SR,      "pip install SpeechRecognition",
         "تحويل الصوت إلى نص (يتطلب أيضاً ffmpeg)"),
    ]
    ffmpeg_ok = shutil.which("ffmpeg") is not None

    if HAS_RICH and console:
        table = Table(title="📦 تقرير المكتبات (Dependency Report)", box=box.ROUNDED, border_style="cyan")
        table.add_column("المكتبة", style="cyan")
        table.add_column("الحالة", justify="center")
        table.add_column("أمر التثبيت", style="yellow")
        table.add_column("تُستخدم في", style="dim")
        for name, ok, cmd, purpose in rows:
            table.add_row(name, "✅" if ok else "❌", "-" if ok else cmd, purpose)
        table.add_row("ffmpeg (binary)", "✅" if ffmpeg_ok else "❌",
                       "-" if ffmpeg_ok else "pkg install ffmpeg  (Termux) / sudo apt install ffmpeg  (Ubuntu)",
                       "استخراج الصوت من الفيديو قبل التفريغ النصي")
        console.print(table)
    else:
        print("\n📦 Dependency Report:")
        for name, ok, cmd, purpose in rows:
            status = "OK" if ok else "MISSING -> " + cmd
            print(f"  [{status}] {name} — {purpose}")
        status = "OK" if ffmpeg_ok else "MISSING -> pkg/apt install ffmpeg"
        print(f"  [{status}] ffmpeg (binary) — extracts audio before transcription")
    print("\nCore requirements (always needed): Python 3.8+  (stdlib only otherwise)")

# ---------------------------------------------------------------------------
# Arabic display helpers
# ---------------------------------------------------------------------------
def has_arabic(text: str) -> bool:
    return bool(_ARABIC_RANGE.search(text or ""))


def fix_display(text: str) -> str:
    """Reshape + bidi only when Arabic is present and libraries exist."""
    if not text or not has_arabic(text) or not HAS_ARABIC:
        return text
    try:
        return _bidi_display(arabic_reshaper.reshape(text))
    except Exception:
        return text


def aprint(text: Any) -> None:
    for line in str(text).split("\n"):
        print(fix_display(line))


def cprint(text: Any, style: str = "") -> None:
    """Colored / styled print. Uses Rich when available."""
    if HAS_RICH and console is not None:
        for line in str(text).split("\n"):
            console.print(fix_display(line), style=style or None)
    else:
        aprint(text)


def ask(prompt: str, default: str = "") -> str:
    """Rich Prompt with Arabic support, fallback to input."""
    display = fix_display(prompt)
    if HAS_RICH:
        try:
            return Prompt.ask(display, default=default).strip()
        except Exception:
            pass
    raw = input(display + (" " if not prompt.endswith(" ") else ""))
    return raw.strip() if raw else default


def ask_yes_no(prompt: str, default: bool = False) -> bool:
    if HAS_RICH:
        try:
            return Confirm.ask(fix_display(prompt), default=default)
        except Exception:
            pass
    ans = ask(prompt + " (y/نعم / n): ").lower()
    if not ans:
        return default
    return ans in {"y", "yes", "نعم", "ن", "1", "true"}


def human_size(num_bytes: Optional[Union[int, float]]) -> str:
    if num_bytes is None:
        return "N/A"
    num = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB", "PB"):
        if abs(num) < 1024.0:
            return f"{num:.1f} {unit}"
        num /= 1024.0
    return f"{num:.1f} EB"


def fix_path(path: Union[str, Path]) -> Path:
    return Path(os.path.expanduser(str(path).strip())).resolve()


# ---------------------------------------------------------------------------
# Splash / Exit animations
# ---------------------------------------------------------------------------
def _typewriter(text: str, delay: float = 0.04, style: str = "bold yellow") -> None:
    if HAS_RICH and console:
        for ch in text:
            console.print(ch, end="", style=style)
            time.sleep(delay)
        console.print()
    else:
        for ch in text:
            sys.stdout.write(ch)
            sys.stdout.flush()
            time.sleep(delay)
        print()


def show_splash() -> None:
    try:
        os.system("cls" if os.name == "nt" else "clear")
    except Exception:
        pass

    banner = r"""
████████╗███████╗██╗  ██╗████████╗
╚══██╔══╝██╔════╝╚██╗██╔╝╚══██╔══╝
   ██║   █████╗   ╚███╔╝    ██║   
   ██║   ██╔══╝   ██╔██╗    ██║   
   ██║   ███████╗██╔╝ ██╗   ██║   
   ╚═╝   ╚══════╝╚═╝  ╚═╝   ╚═╝   
"""
    if HAS_RICH and console:
        console.print(Align.center(Text(banner, style="bold magenta")))
        console.print(Align.center(Text(AUTHOR_SIGNATURE, style="bold yellow")))
        console.print(Align.center(Text(f"v{VERSION}", style="dim cyan")))
        console.print(Rule(style="magenta"))
        console.print(
            Panel(
                fix_display("سكريبت معالجة النصوص والملفات المتقدم — النسخة النووية"),
                border_style="magenta",
                expand=False,
            )
        )
    else:
        print(banner)
        print(AUTHOR_SIGNATURE)
        print(f"v{VERSION}")
        print("=" * 50)
        aprint("سكريبت معالجة النصوص والملفات المتقدم (النسخة النووية)")
        print("=" * 50)


def show_exit_animation() -> None:
    cprint("\n👋 وداعاً يا برو!", "bold magenta")
    time.sleep(0.25)
    _typewriter("Stay tuned for more", delay=0.03, style="cyan")
    _typewriter(AUTHOR_SIGNATURE, delay=0.06, style="bold yellow")
    if HAS_RICH and console:
        console.print("...", style="dim", end="")
        for _ in range(3):
            time.sleep(0.25)
            console.print(".", style="dim", end="")
        console.print()
    else:
        for _ in range(3):
            sys.stdout.write(".")
            sys.stdout.flush()
            time.sleep(0.3)
        print()


# ---------------------------------------------------------------------------
# Smart path location
# ---------------------------------------------------------------------------
def get_search_roots() -> List[Path]:
    candidates = [
        Path.cwd(),
        Path.home(),
        Path.home() / "storage" / "shared",
        Path.home() / "storage" / "downloads",
        Path("/storage/emulated/0"),
        Path("/sdcard"),
    ]
    roots: List[Path] = []
    seen: set = set()
    for c in candidates:
        try:
            if c.is_dir():
                real = c.resolve()
                if real not in seen:
                    seen.add(real)
                    roots.append(c)
        except Exception:
            continue
    return roots


def _similarity(a: str, b: str) -> float:
    """Best available similarity ratio (0–1)."""
    if HAS_RAPIDFUZZ:
        return fuzz.ratio(a, b) / 100.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def smart_locate(
    query: str,
    roots: Sequence[Path],
    limit: int = 15,
    fuzzy_cutoff: float = 0.55,
    kind: str = "any",
) -> List[Path]:
    query_name = Path(query.strip()).name.lower()
    if not query_name:
        return []

    scored: List[Tuple[float, Path]] = []
    seen: set = set()

    for root in roots:
        if not root.is_dir():
            continue
        try:
            for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
                dirnames[:] = [
                    d for d in dirnames
                    if not d.startswith(".") and d.lower() not in SKIP_DIRS
                ]
                entries: List[Tuple[str, bool]] = []
                if kind in ("any", "file"):
                    entries += [(f, False) for f in filenames]
                if kind in ("any", "dir"):
                    entries += [(d, True) for d in dirnames]

                for name, _is_dir in entries:
                    full = Path(dirpath) / name
                    try:
                        key = str(full.resolve())
                    except Exception:
                        key = str(full)
                    if key in seen:
                        continue
                    lname = name.lower()

                    if query_name == lname:
                        score = 1.0
                    elif query_name in lname:
                        score = 0.9 + 0.05 * (len(query_name) / max(len(lname), 1))
                    elif lname in query_name:
                        score = 0.8
                    else:
                        score = _similarity(query_name, lname)

                    if score >= fuzzy_cutoff:
                        scored.append((score, full))
                        seen.add(key)
        except (PermissionError, OSError):
            continue

    scored.sort(key=lambda x: (-x[0], len(str(x[1]))))
    return [p for _, p in scored[:limit]]


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff",
                    ".heic", ".heif", ".avif", ".svg", ".ico", ".dng"}
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".3gp", ".3g2",
                    ".mpeg", ".mpg", ".wmv", ".flv", ".mts", ".m2ts", ".vob", ".ogv"}


def search_local_media(directory: Union[str, Path], kind: str = "both",
                       query: str = "", recursive: bool = True) -> Tuple[List[Path], List[str]]:
    """Find media by extension and case-insensitive filename substring.

    Does not inspect file contents or follow directory symlinks. Return scan
    errors alongside results so inaccessible folders are never silently omitted.
    """
    if kind not in {"images", "videos", "both"}:
        raise ValueError("Media type must be images, videos, or both")
    root = fix_path(directory)
    if not root.is_dir():
        raise NotADirectoryError(f"Not a directory: {root}")
    extensions = (IMAGE_EXTENSIONS if kind == "images" else VIDEO_EXTENSIONS
                  if kind == "videos" else IMAGE_EXTENSIONS | VIDEO_EXTENSIONS)
    matches: List[Path] = []
    errors: List[str] = []
    needle = query.casefold()
    for parent, dirs, files in os.walk(root, followlinks=False,
                                      onerror=lambda exc: errors.append(str(exc))):
        dirs[:] = sorted(d for d in dirs if d.casefold() not in SKIP_DIRS)
        for name in files:
            path = Path(parent) / name
            if path.suffix.lower() in extensions and needle in name.casefold():
                if path.is_file():
                    matches.append(path)
        if not recursive:
            break
    return sorted(matches, key=lambda path: str(path).casefold()), errors


def display_media_results(matches: List[Path], errors: List[str]) -> None:
    # Plain output preserves filenames containing Rich markup characters.
    for path in matches:
        print(path)
    print(f"Found {len(matches)} media file(s). Search uses filename extensions.")
    for error in errors:
        print(f"Could not scan: {error}", file=sys.stderr)


def select_path(
    prompt: str = "اسم الملف: ",
    kind: str = "file",
    allow_create: bool = False,
) -> Optional[Path]:
    raw = ask(prompt)
    if not raw:
        return None
    path = fix_path(raw)
    if path.exists():
        return path

    cprint(f"⚠️ لم يتم العثور على '{raw}' مباشرة، جاري البحث الذكي...", "yellow")
    matches = smart_locate(raw, get_search_roots(), kind=kind)

    if not matches:
        custom = ask("هل تريد تحديد مجلد بحث يدويًا؟ (اكتب المسار أو اتركه فارغًا): ")
        if custom:
            matches = smart_locate(raw, [fix_path(custom)], kind=kind)

    if not matches:
        if allow_create:
            if ask_yes_no(f"هل تريد إنشاء ملف جديد بهذا المسار؟ ({path})"):
                return path
        cprint("✗ لم يتم العثور على أي نتائج مشابهة.", "bold red")
        return None

    if len(matches) == 1:
        cprint(f"✓ تم العثور على: {matches[0]}", "green")
        if ask_yes_no("استخدام هذا الملف؟", default=True):
            return matches[0]
        return None

    cprint(f"\n🔎 تم العثور على {len(matches)} نتيجة مشابهة:", "bold yellow")
    for i, m in enumerate(matches, 1):
        cprint(f"  [{i}] {m}", "cyan")
    choice = ask("اختر رقم النتيجة (أو 0 للإلغاء): ")
    if choice.isdigit() and 1 <= int(choice) <= len(matches):
        selected = matches[int(choice) - 1]
        cprint(f"✓ تم اختيار: {selected}", "green")
        return selected
    return None


def select_path_for_dir(raw_directory: str) -> Optional[Path]:
    path = fix_path(raw_directory)
    if path.is_dir():
        return path
    cprint(f"⚠️ جاري البحث الذكي عن المجلد '{raw_directory}'...", "yellow")
    matches = smart_locate(raw_directory, get_search_roots(), kind="dir")
    if not matches:
        cprint("✗ لم يتم العثور على مجلد مشابه.", "bold red")
        return None
    if len(matches) == 1:
        cprint(f"✓ تم العثور على: {matches[0]}", "green")
        return matches[0]
    for i, m in enumerate(matches, 1):
        cprint(f"  [{i}] {m}", "cyan")
    choice = ask("اختر رقم النتيجة (أو 0 للإلغاء): ")
    if choice.isdigit() and 1 <= int(choice) <= len(matches):
        return matches[int(choice) - 1]
    return None


# ---------------------------------------------------------------------------
# Core processor
# ---------------------------------------------------------------------------
class TextFileProcessor:
    def __init__(self, backup_dir: Optional[Path] = None) -> None:
        self.current_dir = Path.cwd()
        self.backup_dir = Path(backup_dir) if backup_dir else BACKUP_DIR

    # ------------------------------------------------------------------
    # Encoding-aware I/O
    # ------------------------------------------------------------------
    def _detect_encoding(self, path: Path) -> str:
        """Use charset-normalizer when available, else try common encodings."""
        if HAS_CHARSET:
            try:
                result = from_path(path)
                if result and result.best():
                    return result.best().encoding or "utf-8"
            except Exception as exc:
                log.debug("charset_normalizer failed: %s", exc)
        return "utf-8"

    def read_file(self, filename: Union[str, Path], silent: bool = False) -> Optional[str]:
        path = Path(filename)
        # Prefer charset-normalizer
        if HAS_CHARSET:
            try:
                result = from_path(path)
                best = result.best() if result else None
                if best is not None:
                    content = str(best)
                    enc = best.encoding or "utf-8"
                    if not silent:
                        if enc.lower() not in ("utf-8", "utf8"):
                            cprint(f"⚠️ تم الكشف عن الترميز: {enc}", "yellow")
                        cprint(f"✓ تم قراءة الملف: {path}", "green")
                    return content
            except Exception as exc:
                log.debug("from_path failed: %s", exc)

        # Fallback cascade
        last_err: Optional[Exception] = None
        for enc in DEFAULT_ENCODING_FALLBACKS:
            try:
                content = path.read_text(encoding=enc)
                if not silent:
                    if enc != "utf-8":
                        cprint(f"⚠️ تعذّرت القراءة بترميز UTF-8، تم استخدام: {enc}", "yellow")
                    cprint(f"✓ تم قراءة الملف: {path}", "green")
                return content
            except UnicodeDecodeError as e:
                last_err = e
                continue
            except Exception as e:
                if not silent:
                    cprint(f"✗ خطأ: {e}", "bold red")
                return None
        if not silent:
            cprint(f"✗ تعذّرت قراءة الملف بأي ترميز معروف: {last_err}", "bold red")
        return None

    def write_file(self, filename: Union[str, Path], content: str) -> bool:
        path = Path(filename)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            cprint(f"✓ تم حفظ الملف: {path}", "green")
            return True
        except Exception as e:
            cprint(f"✗ خطأ: {e}", "bold red")
            return False

    def append_file(self, filename: Union[str, Path], content: str) -> bool:
        path = Path(filename)
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as f:
                f.write(content)
            cprint(f"✓ تمت الإضافة إلى: {path}", "green")
            return True
        except Exception as e:
            cprint(f"✗ خطأ: {e}", "bold red")
            return False

    # ------------------------------------------------------------------
    # Backup / Restore
    # ------------------------------------------------------------------
    def backup_file(self, filename: Union[str, Path]) -> Optional[Path]:
        path = Path(filename)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = self.backup_dir / f"{path.name}_{timestamp}.bak"
        try:
            shutil.copy2(path, backup_path)
            cprint(f"🛡️ تم أخذ نسخة احتياطية في: {backup_path}", "dim")
            return backup_path
        except Exception as e:
            cprint(f"⚠️ فشل أخذ نسخة احتياطية: {e}", "yellow")
            return None

    def list_backups(self, filename: Union[str, Path]) -> List[Path]:
        base = Path(filename).name
        if not self.backup_dir.is_dir():
            return []
        found = sorted(
            [
                p for p in self.backup_dir.iterdir()
                if p.name.startswith(base + "_") and p.suffix == ".bak"
            ],
            reverse=True,
        )
        return found

    def restore_backup(self, filename: Union[str, Path]) -> bool:
        path = Path(filename)
        backups = self.list_backups(path)
        if not backups:
            cprint("✗ لا توجد نسخ احتياطية محفوظة لهذا الملف.", "bold red")
            return False

        cprint(f"\n🗂️ النسخ الاحتياطية المتاحة لـ {path.name}:", "bold yellow")
        for i, b in enumerate(backups, 1):
            cprint(f"  [{i}] {b.name}", "cyan")

        choice = ask("اختر رقم النسخة للاسترجاع (أو 0 للإلغاء): ")
        if not (choice.isdigit() and 1 <= int(choice) <= len(backups)):
            cprint("تم الإلغاء.", "dim")
            return False

        chosen = backups[int(choice) - 1]
        self.backup_file(path)
        try:
            shutil.copy2(chosen, path)
            cprint(f"✓ تم استرجاع الملف من: {chosen.name}", "bold green")
            return True
        except Exception as e:
            cprint(f"✗ فشل الاسترجاع: {e}", "bold red")
            return False

    # ------------------------------------------------------------------
    # Encryption / Decryption (merged from PFMT, hardened)
    # ------------------------------------------------------------------
    @staticmethod
    def _derive_key(password: str, salt: bytes, iterations: int) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=iterations,
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode("utf-8")))

    def encrypt_file(self, filepath: Union[str, Path], password: str,
                      delete_original: bool = False) -> Optional[Path]:
        """Password-encrypt a file with Fernet (AES-128-CBC + HMAC).

        Output format: MAGIC(5) + iterations(4, big-endian) + salt(16) + fernet_token
        The iteration count is stored per-file so ENC_KDF_ITERATIONS can be
        raised later without breaking older encrypted files.
        """
        if not HAS_CRYPTO:
            cprint("❌ مكتبة cryptography غير مثبتة. (pip install cryptography)", "bold red")
            return None
        path = Path(filepath)
        if not path.is_file():
            cprint(f"✗ الملف غير موجود: {path}", "bold red")
            return None
        try:
            salt = os.urandom(16)
            key = self._derive_key(password, salt, ENC_KDF_ITERATIONS)
            token = Fernet(key).encrypt(path.read_bytes())
            out_path = path.with_name(path.name + ".enc")
            header = ENC_MAGIC + ENC_KDF_ITERATIONS.to_bytes(4, "big") + salt
            out_path.write_bytes(header + token)
            if delete_original:
                path.unlink(missing_ok=True)
            cprint(f"🔐 تم تشفير الملف بنجاح: {out_path.name}", "bold green")
            return out_path
        except Exception as e:
            cprint(f"❌ فشل التشفير: {e}", "bold red")
            return None

    def decrypt_file(self, filepath: Union[str, Path], password: str,
                      delete_original: bool = False) -> Optional[Path]:
        if not HAS_CRYPTO:
            cprint("❌ مكتبة cryptography غير مثبتة. (pip install cryptography)", "bold red")
            return None
        path = Path(filepath)
        if not path.is_file():
            cprint(f"✗ الملف غير موجود: {path}", "bold red")
            return None
        try:
            raw = path.read_bytes()
            if not raw.startswith(ENC_MAGIC):
                cprint("❌ هذا الملف لم يتم تشفيره بواسطة هذه الأداة (توقيع غير معروف).", "bold red")
                return None
            iterations = int.from_bytes(raw[5:9], "big")
            salt = raw[9:25]
            token = raw[25:]
            key = self._derive_key(password, salt, iterations)
            data = Fernet(key).decrypt(token)
            orig_name = path.name[:-4] if path.name.endswith(".enc") else "decrypted_" + path.name
            out_path = path.with_name(orig_name)
            out_path.write_bytes(data)
            if delete_original:
                path.unlink(missing_ok=True)
            cprint(f"🔓 تم فك التشفير بنجاح: {out_path.name}", "bold green")
            return out_path
        except InvalidToken:
            cprint("❌ فشل فك التشفير: كلمة السر غلط أو الملف تالف.", "bold red")
            return None
        except Exception as e:
            cprint(f"❌ فشل فك التشفير: {e}", "bold red")
            return None

    def batch_crypto(self, directory: Union[str, Path], password: str,
                      mode: str = "encrypt") -> None:
        """Encrypt/decrypt every matching file in a directory (non-recursive)."""
        directory = Path(directory)
        if mode == "encrypt":
            targets = [p for p in directory.iterdir() if p.is_file() and not p.name.endswith(".enc")]
        else:
            targets = [p for p in directory.iterdir() if p.is_file() and p.name.endswith(".enc")]
        if not targets:
            cprint("✗ لا توجد ملفات مناسبة لهذه العملية في المجلد.", "bold red")
            return
        cprint(f"⚙️ جاري {'تشفير' if mode == 'encrypt' else 'فك تشفير'} {len(targets)} ملف...", "bold magenta")
        ok = 0
        for t in targets:
            result = self.encrypt_file(t, password) if mode == "encrypt" else self.decrypt_file(t, password)
            if result is not None:
                ok += 1
        cprint(f"✓ تمت العملية على {ok}/{len(targets)} ملف بنجاح.", "bold green")

    # ------------------------------------------------------------------
    # Media → Text (audio/video transcription, merged from PFMT, hardened)
    # ------------------------------------------------------------------
    def extract_media_text(self, filepath: Union[str, Path], lang: str = "ar-EG") -> Optional[str]:
        if not HAS_SR:
            cprint("❌ مكتبة SpeechRecognition غير مثبتة. (pip install SpeechRecognition)", "bold red")
            return None
        if shutil.which("ffmpeg") is None:
            cprint("❌ أداة ffmpeg غير مثبتة. ثبّتها أولاً:\n"
                   "   Termux : pkg install ffmpeg\n"
                   "   Ubuntu : sudo apt install ffmpeg", "bold red")
            return None

        path = Path(filepath)
        if not path.is_file():
            cprint(f"✗ الملف غير موجود: {path}", "bold red")
            return None

        temp_wav = Path.home() / f".tpp_temp_{int(time.time())}.wav"
        cprint(f"🎬 جاري استخراج الصوت من: {path.name} ...", "yellow")
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(path), "-ac", "1", "-ar", "16000", str(temp_wav)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, timeout=600,
            )
        except subprocess.CalledProcessError:
            cprint("❌ فشل ffmpeg في استخراج الصوت من هذا الملف (هل هو ملف وسائط صالح؟).", "bold red")
            return None
        except subprocess.TimeoutExpired:
            cprint("❌ استغرقت معالجة الملف وقتاً طويلاً جداً وتم إيقافها.", "bold red")
            return None
        except Exception as e:
            cprint(f"❌ خطأ أثناء استخراج الصوت: {e}", "bold red")
            return None

        cprint("🎧 جاري تحويل الصوت إلى نص (Google Speech API)...", "cyan")
        recognizer = sr.Recognizer()
        extracted_text: Optional[str] = None
        try:
            with sr.AudioFile(str(temp_wav)) as source:
                audio_data = recognizer.record(source)
            extracted_text = recognizer.recognize_google(audio_data, language=lang)
            cprint("✓ تم استخراج النص بنجاح!", "bold green")
        except sr.UnknownValueError:
            cprint("❌ تعذّر فهم الصوت (قد يكون غير واضح أو بلا كلام).", "bold red")
        except sr.RequestError as e:
            cprint(f"❌ خطأ في الاتصال بخدمة التعرف على الصوت (يتطلب إنترنت): {e}", "bold red")
        except Exception as e:
            cprint(f"❌ خطأ غير متوقع: {e}", "bold red")
        finally:
            temp_wav.unlink(missing_ok=True)

        return extracted_text

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------
    def search_file(self, filename: Union[str, Path], search_term: str) -> Optional[List[str]]:
        results: List[str] = []
        try:
            with Path(filename).open("r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    if search_term.lower() in line.lower():
                        results.append(line.strip())
            cprint(f"\n🔍 تم العثور على: {len(results)} نتيجة", "bold yellow")
            for res in results[:20]:
                cprint(f"   {res}", "cyan")
            if len(results) > 20:
                cprint("   النتائج كثيرة جداً لعرضها بالكامل.", "yellow")
            return results
        except Exception as e:
            cprint(f"✗ خطأ: {e}", "bold red")
            return None

    def _search_single_file(self, file_path: Path, search_term: str) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        try:
            with file_path.open("r", encoding="utf-8", errors="ignore") as f:
                for line_num, line in enumerate(f, 1):
                    if search_term.lower() in line.lower():
                        results.append({
                            "file": str(file_path),
                            "line_num": line_num,
                            "content": line.strip()[:120],
                        })
        except Exception:
            pass
        return results

    def search_in_directory(self, directory: Union[str, Path], search_term: str) -> None:
        directory = Path(directory)
        cprint(f"\n🚀 جاري البحث المكتسح عن '{search_term}' في: {directory}...", "bold magenta")

        all_files: List[Path] = []
        for root, dirs, files in os.walk(directory):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in SKIP_DIRS]
            for file in files:
                fp = Path(root) / file
                if fp.suffix.lower() in SEARCHABLE_EXTS:
                    all_files.append(fp)

        results: List[Dict[str, Any]] = []
        workers = min(12, (os.cpu_count() or 4) + 2)

        if HAS_RICH and console:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TimeElapsedColumn(),
                console=console,
            ) as progress:
                task = progress.add_task("بحث...", total=len(all_files))
                with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
                    futures = {
                        executor.submit(self._search_single_file, p, search_term): p
                        for p in all_files
                    }
                    for future in concurrent.futures.as_completed(futures):
                        res = future.result()
                        if res:
                            results.extend(res)
                        progress.advance(task)
        else:
            with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
                futures = [executor.submit(self._search_single_file, p, search_term) for p in all_files]
                for future in concurrent.futures.as_completed(futures):
                    res = future.result()
                    if res:
                        results.extend(res)

        if results:
            cprint(f"\n🔥 تم العثور على {len(results)} نتيجة في الملفات المختلفة:", "bold green")
            for res in results[:30]:
                cprint(f"📁 {res['file']} (سطر {res['line_num']})", "cyan")
                cprint(f"   ↳ {res['content']}", "yellow")
            if len(results) > 30:
                cprint(f"\n... وهناك {len(results) - 30} نتيجة أخرى لم تُعرض.", "yellow")
        else:
            cprint("✗ لم يتم العثور على أي نتائج في هذا المجلد.", "bold red")

    def extract_patterns(self, filename: Union[str, Path], pattern_type: str) -> List[str]:
        patterns = {
            "1": (r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", "إيميلات"),
            "2": (r"(?:01[0125]\d{8}|\+?20\d{10}|\+?\d{10,15})", "أرقام هواتف"),
            "3": (r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[^\s]*", "روابط URL"),
        }
        if pattern_type not in patterns:
            cprint("❌ نوع غير مدعوم", "bold red")
            return []

        regex_str, name = patterns[pattern_type]
        regex = re.compile(regex_str, re.IGNORECASE)
        content = self.read_file(filename)
        if not content:
            return []

        matches = sorted(set(regex.findall(content)))
        cprint(f"\n🎯 تم استخراج {len(matches)} نتيجة من نوع ({name}):", "bold green")
        for match in matches[:25]:
            cprint(f"   {match}", "cyan")
        if len(matches) > 25:
            cprint("   ... (تم إخفاء باقي النتائج من الشاشة)", "yellow")
        return matches

    # ------------------------------------------------------------------
    # Text transforms
    # ------------------------------------------------------------------
    def replace_text(self, text: str, old_text: str, new_text: str) -> str:
        count = text.count(old_text)
        new_content = text.replace(old_text, new_text)
        cprint(f"✓ تم استبدال '{old_text}' بـ '{new_text}' ({count} مرات)", "green")
        return new_content

    def clean_text(self, text: str) -> str:
        lines = text.split("\n")
        cleaned_lines = [line.strip() for line in lines if line.strip()]
        cleaned_text = "\n".join(cleaned_lines)
        cprint(f"✓ تم تنظيف النص ({len(lines)} → {len(cleaned_lines)} سطر)", "green")
        return cleaned_text

    def convert_case(self, text: str, case_type: str = "upper") -> str:
        if case_type == "upper":
            return text.upper()
        if case_type == "lower":
            return text.lower()
        if case_type == "title":
            return text.title()
        if case_type == "sentence":
            parts = re.split(r"([.!؟?]\s*)", text)
            result: List[str] = []
            capitalize_next = True
            for part in parts:
                if capitalize_next and part.strip():
                    idx = 0
                    while idx < len(part) and not part[idx].isalpha():
                        idx += 1
                    if idx < len(part):
                        part = part[:idx] + part[idx].upper() + part[idx + 1:]
                    capitalize_next = False
                if re.fullmatch(r"[.!؟?]\s*", part or ""):
                    capitalize_next = True
                result.append(part)
            return "".join(result)
        return text

    def remove_empty_lines(self, text: str) -> str:
        lines = text.split("\n")
        non_empty = [line for line in lines if line.strip()]
        cprint(f"✓ تم إزالة الأسطر الفارغة ({len(lines)} → {len(non_empty)} سطر)", "green")
        return "\n".join(non_empty)

    def remove_duplicate_lines(self, text: str) -> str:
        lines = text.split("\n")
        seen: set = set()
        unique_lines: List[str] = []
        for line in lines:
            key = line.strip()
            if key not in seen:
                seen.add(key)
                unique_lines.append(line)
        cprint(f"✓ تم حذف التكرار ({len(lines)} → {len(unique_lines)} سطر)", "green")
        return "\n".join(unique_lines)

    def sort_lines(self, text: str, reverse: bool = False, ignore_case: bool = True) -> str:
        lines = text.split("\n")
        key_func: Callable[[str], str] = (lambda s: s.lower()) if ignore_case else (lambda s: s)
        sorted_lines = sorted(lines, key=key_func, reverse=reverse)
        direction = "تنازلي" if reverse else "تصاعدي"
        cprint(f"✓ تم ترتيب {len(sorted_lines)} سطر ({direction})", "green")
        return "\n".join(sorted_lines)

    def group_similar_lines(self, text: str, threshold: float = 0.72) -> Tuple[List[List[int]], List[str]]:
        lines = text.split("\n")
        non_empty_idx = [i for i, l in enumerate(lines) if l.strip()]
        used: set = set()
        groups: List[List[int]] = []

        def first_token(s: str) -> str:
            parts = s.strip().split()
            return parts[0].lower() if parts else ""

        for pos, i in enumerate(non_empty_idx):
            if i in used:
                continue
            group = [i]
            used.add(i)
            name_i = first_token(lines[i])
            for j in non_empty_idx[pos + 1:]:
                if j in used or not name_i:
                    continue
                name_j = first_token(lines[j])
                if not name_j:
                    continue
                ratio = _similarity(name_i, name_j)
                if name_i == name_j or ratio >= threshold:
                    group.append(j)
                    used.add(j)
            groups.append(group)
        return groups, lines

    # ------------------------------------------------------------------
    # Deep analysis
    # ------------------------------------------------------------------
    def deep_text_analysis(self, text: str, top_n: int = 12) -> Dict[str, Any]:
        words_raw = text.split()
        cleaned = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
        words = [w.lower() for w in cleaned.split() if len(w) > 1]

        counter = Counter(words)
        top_words = counter.most_common(top_n)

        sentence_splits = re.split(r"[.!؟?\n]+", text)
        sentences = [s.strip() for s in sentence_splits if s.strip()]
        sentence_count = len(sentences) or 1

        total_words = len(words_raw) or 1
        avg_word_len = round(sum(len(w) for w in words) / len(words), 2) if words else 0.0
        avg_sentence_len = round(total_words / sentence_count, 2)
        unique_words = len(set(words))
        vocab_richness = round((unique_words / len(words) * 100), 1) if words else 0.0
        reading_time_min = round(total_words / 200, 2)

        arabic_chars = len(_ARABIC_RANGE.findall(text))
        latin_chars = len(re.findall(r"[A-Za-z]", text))
        longest_word = max(words, key=len) if words else ""

        bigrams = list(zip(words, words[1:]))
        top_bigrams = Counter(bigrams).most_common(6)

        general_stats = [
            ("عدد الكلمات", total_words),
            ("عدد الجمل", sentence_count),
            ("عدد الكلمات الفريدة", unique_words),
            ("نسبة تنوع المفردات", f"{vocab_richness}%"),
            ("متوسط طول الكلمة", avg_word_len),
            ("متوسط طول الجملة (كلمة/جملة)", avg_sentence_len),
            ("أطول كلمة", longest_word),
            ("وقت القراءة المقدّر", f"{reading_time_min} دقيقة"),
            ("حروف عربية", arabic_chars),
            ("حروف لاتينية", latin_chars),
            ("حجم النص (بايت تقريبي)", len(text.encode("utf-8"))),
        ]

        if HAS_RICH and console:
            t1 = Table(title=fix_display("📊 تحليل النص المتقدم"), box=box.ROUNDED, border_style="cyan")
            t1.add_column(fix_display("المقياس"), justify="right", style="cyan")
            t1.add_column(fix_display("القيمة"), justify="left", style="magenta")
            for label, value in general_stats:
                t1.add_row(fix_display(str(label)), fix_display(str(value)))
            console.print(t1)

            if top_words:
                t2 = Table(title=fix_display(f"🔤 أكثر {len(top_words)} كلمة تكرارًا"), box=box.SIMPLE, border_style="green")
                t2.add_column(fix_display("الكلمة"), justify="right", style="cyan")
                t2.add_column(fix_display("عدد المرات"), justify="left", style="magenta")
                for word, count in top_words:
                    t2.add_row(fix_display(word), str(count))
                console.print(t2)

            if top_bigrams:
                t3 = Table(title=fix_display("🔗 أكثر العبارات المكوّنة من كلمتين"), box=box.SIMPLE, border_style="yellow")
                t3.add_column(fix_display("العبارة"), justify="right", style="cyan")
                t3.add_column(fix_display("عدد المرات"), justify="left", style="magenta")
                for (w1, w2), count in top_bigrams:
                    t3.add_row(fix_display(f"{w1} {w2}"), str(count))
                console.print(t3)
        else:
            cprint("\n📊 تحليل النص المتقدم:", "bold yellow")
            for label, value in general_stats:
                cprint(f"   {label}: {value}", "cyan")
            if top_words:
                cprint(f"\n🔤 أكثر {len(top_words)} كلمة تكرارًا:", "bold yellow")
                for word, count in top_words:
                    cprint(f"   {word}: {count}", "cyan")
            if top_bigrams:
                cprint("\n🔗 أكثر العبارات تكرارًا:", "bold yellow")
                for (w1, w2), count in top_bigrams:
                    cprint(f"   {w1} {w2}: {count}", "cyan")

        return {
            "general": dict(general_stats),
            "top_words": top_words,
            "top_bigrams": top_bigrams,
        }

    def export_analysis(self, analysis: Dict[str, Any], out_path: Union[str, Path]) -> bool:
        try:
            path = Path(out_path)
            path.write_text(json.dumps(analysis, ensure_ascii=False, indent=2), encoding="utf-8")
            cprint(f"✓ تم تصدير التحليل إلى: {path}", "green")
            return True
        except Exception as e:
            cprint(f"✗ فشل التصدير: {e}", "bold red")
            return False

    # ------------------------------------------------------------------
    # Compare / Merge
    # ------------------------------------------------------------------
    def compare_files(self, file1: Union[str, Path], file2: Union[str, Path]) -> Optional[List[str]]:
        try:
            lines1 = Path(file1).read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
            lines2 = Path(file2).read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
        except Exception as e:
            cprint(f"✗ خطأ في فتح أحد الملفين: {e}", "bold red")
            return None

        diff = list(
            difflib.unified_diff(
                lines1, lines2,
                fromfile=Path(file1).name,
                tofile=Path(file2).name,
                lineterm="",
            )
        )

        if not diff:
            cprint("✓ الملفان متطابقان تمامًا، لا فروقات.", "bold green")
            return []

        cprint(f"\n🆚 الفروقات بين الملفين ({len(diff)} سطر):", "bold yellow")
        shown = 0
        for line in diff:
            stripped = line.rstrip("\n")
            if stripped.startswith("+") and not stripped.startswith("+++"):
                cprint(stripped, "green")
            elif stripped.startswith("-") and not stripped.startswith("---"):
                cprint(stripped, "red")
            elif stripped.startswith("@@"):
                cprint(stripped, "bold cyan")
            else:
                cprint(stripped, "dim")
            shown += 1
            if shown >= 250:
                cprint("... (تم إخفاء باقي الفروقات لكثرتها)", "yellow")
                break
        return diff

    def merge_files(self, filenames: Sequence[Union[str, Path]], separator: str = "\n") -> Optional[str]:
        merged_parts: List[str] = []
        for fname in filenames:
            content = self.read_file(fname)
            if content is not None:
                merged_parts.append(content)
        if not merged_parts:
            cprint("✗ لم يتم دمج أي ملف (كلها فشلت في القراءة).", "bold red")
            return None
        cprint(f"✓ تم دمج {len(merged_parts)} ملف بنجاح.", "green")
        return separator.join(merged_parts)

    # ------------------------------------------------------------------
    # File listing
    # ------------------------------------------------------------------
    def list_files(self, directory: Optional[Union[str, Path]] = None) -> None:
        directory = Path(directory) if directory else self.current_dir
        try:
            entries = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
            if HAS_RICH and console:
                table = Table(title=fix_display(f"📁 {directory}"), box=box.SIMPLE, border_style="blue")
                table.add_column("النوع", style="dim")
                table.add_column("الاسم", style="cyan")
                table.add_column("الحجم", justify="right")
                for entry in entries:
                    if entry.is_file():
                        try:
                            size = human_size(entry.stat().st_size)
                        except OSError:
                            size = "?"
                        table.add_row("📄", entry.name, size)
                    else:
                        table.add_row("📂", entry.name + "/", "—")
                console.print(table)
            else:
                cprint(f"\n📁 الملفات في {directory}:", "bold yellow")
                for entry in entries:
                    if entry.is_file():
                        try:
                            size = entry.stat().st_size
                        except OSError:
                            size = 0
                        cprint(f"   📄 {entry.name} ({size} bytes)", "green")
                    else:
                        cprint(f"   📂 {entry.name}/", "bold blue")
        except Exception as e:
            cprint(f"✗ خطأ: {e}", "bold red")

    # ------------------------------------------------------------------
    # Temp cleaner
    # ------------------------------------------------------------------
    def scan_temp_files(self, directory: Union[str, Path]) -> List[Tuple[Path, int]]:
        found: List[Tuple[Path, int]] = []
        directory = Path(directory)
        for root, dirs, files in os.walk(directory):
            dirs[:] = [d for d in dirs if not d.startswith(".git")]
            base = Path(root).name
            in_temp_dir = base in TEMP_DIR_NAMES
            for f in files:
                path = Path(root) / f
                ext = path.suffix.lower()
                if ext in TEMP_EXTENSIONS or in_temp_dir:
                    try:
                        size = path.stat().st_size
                    except OSError:
                        size = 0
                    found.append((path, size))
        return found

    def clean_temp_files(self, directory: Union[str, Path], auto_confirm: bool = False) -> None:
        directory = Path(directory)
        cprint(f"\n🧹 جاري فحص الملفات المؤقتة في: {directory} ...", "bold magenta")
        items = self.scan_temp_files(directory)
        if not items:
            cprint("✓ لا توجد ملفات مؤقتة يمكن تنظيفها هنا.", "green")
            return

        items.sort(key=lambda x: -x[1])
        total_size = sum(s for _, s in items)

        cprint(
            f"\n📦 تم العثور على {len(items)} ملف مؤقت، الحجم الإجمالي: {human_size(total_size)}",
            "bold yellow",
        )
        for path, size in items[:20]:
            cprint(f"   🗑️ {path} ({human_size(size)})", "cyan")
        if len(items) > 20:
            cprint(f"   ... و{len(items) - 20} ملف إضافي غير معروض.", "dim")

        proceed = auto_confirm or ask_yes_no(
            f"⚠️ هل تريد حذف كل هذه الملفات وتحرير {human_size(total_size)}؟"
        )
        if not proceed:
            cprint("تم الإلغاء، لم يُحذف شيء.", "dim")
            return

        deleted, freed, failed = 0, 0, 0
        for path, size in items:
            try:
                path.unlink()
                deleted += 1
                freed += size
            except Exception:
                failed += 1

        cprint(f"\n✓ تم حذف {deleted} ملف وتحرير {human_size(freed)} من المساحة.", "bold green")
        if failed:
            cprint(f"⚠️ تعذّر حذف {failed} ملف (قد تكون بلا صلاحية وصول).", "yellow")

    # ------------------------------------------------------------------
    # Device status
    # ------------------------------------------------------------------
    def get_device_status(self) -> Dict[str, Any]:
        status: Dict[str, Any] = {}

        if HAS_PSUTIL and psutil:
            vm = psutil.virtual_memory()
            status["ram_total"] = vm.total
            status["ram_available"] = vm.available
            status["ram_percent"] = vm.percent
            status["cpu_percent"] = psutil.cpu_percent(interval=0.35)
        else:
            try:
                meminfo: Dict[str, int] = {}
                with open("/proc/meminfo") as f:
                    for line in f:
                        parts = line.split(":")
                        if len(parts) == 2:
                            meminfo[parts[0].strip()] = int(parts[1].strip().split()[0]) * 1024
                status["ram_total"] = meminfo.get("MemTotal")
                status["ram_available"] = meminfo.get("MemAvailable")
                if status.get("ram_total") and status.get("ram_available") is not None:
                    used_ratio = 1 - (status["ram_available"] / status["ram_total"])
                    status["ram_percent"] = round(used_ratio * 100, 1)
            except Exception:
                status["ram_total"] = None
            status["cpu_percent"] = None

        try:
            usage = shutil.disk_usage(Path.home())
            status["disk_total"] = usage.total
            status["disk_free"] = usage.free
            status["disk_used"] = usage.used
        except Exception:
            status["disk_total"] = None

        temp: Optional[float] = None
        try:
            for p in glob.glob("/sys/class/thermal/thermal_zone*/temp"):
                try:
                    with open(p) as f:
                        val = int(f.read().strip())
                        temp = max(temp or 0.0, val / 1000.0)
                except Exception:
                    continue
        except Exception:
            pass

        battery_percent: Optional[int] = None
        if temp is None or battery_percent is None:
            try:
                result = subprocess.run(
                    ["termux-battery-status"],
                    capture_output=True,
                    text=True,
                    timeout=3,
                )
                if result.returncode == 0 and result.stdout:
                    data = json.loads(result.stdout)
                    if temp is None:
                        temp = data.get("temperature")
                    battery_percent = data.get("percentage")
            except Exception:
                pass

        status["temperature"] = temp
        status["battery_percent"] = battery_percent
        return status

    def display_device_status(self) -> None:
        status = self.get_device_status()

        def pct_style(pct: Optional[float], warn: float = 60, danger: float = 85) -> str:
            if pct is None:
                return "dim"
            if pct >= danger:
                return "bold red"
            if pct >= warn:
                return "yellow"
            return "green"

        rows: List[Tuple[str, str, str]] = []
        if status.get("ram_total"):
            ram_pct = status.get("ram_percent")
            used = status["ram_total"] - (status.get("ram_available") or 0)
            val = (
                f"{human_size(used)} / {human_size(status['ram_total'])}"
                + (f" ({ram_pct}%)" if ram_pct is not None else "")
            )
            rows.append(("الذاكرة العشوائية (RAM)", val, pct_style(ram_pct)))
        else:
            rows.append(("الذاكرة العشوائية (RAM)", "غير متاح على هذا النظام", "dim"))

        if status.get("cpu_percent") is not None:
            rows.append(
                ("استخدام المعالج (CPU)", f"{status['cpu_percent']}%", pct_style(status["cpu_percent"]))
            )

        if status.get("disk_total"):
            disk_pct = round(status["disk_used"] / status["disk_total"] * 100, 1)
            rows.append((
                "المساحة التخزينية",
                f"مستخدم {human_size(status['disk_used'])} / {human_size(status['disk_total'])}"
                f" — متبقي {human_size(status['disk_free'])} ({disk_pct}%)",
                pct_style(disk_pct),
            ))
        else:
            rows.append(("المساحة التخزينية", "غير متاح", "dim"))

        if status.get("temperature") is not None:
            temp = status["temperature"]
            t_style = "bold red" if temp >= 45 else ("yellow" if temp >= 38 else "green")
            rows.append(("حرارة الجهاز", f"{temp:.1f}°C", t_style))
        else:
            rows.append(("حرارة الجهاز", "غير متاح (يتطلب termux-api أو Linux thermal zones)", "dim"))

        if status.get("battery_percent") is not None:
            rows.append((
                "نسبة البطارية",
                f"{status['battery_percent']}%",
                pct_style(100 - status["battery_percent"]),
            ))

        if HAS_RICH and console:
            table = Table(title=fix_display("📟 حالة الجهاز الحالية"), box=box.ROUNDED, border_style="cyan")
            table.add_column(fix_display("المقياس"), justify="right", style="cyan")
            table.add_column(fix_display("القيمة"), justify="left")
            for label, value, style in rows:
                table.add_row(fix_display(label), Text(fix_display(str(value)), style=style))
            console.print(table)
        else:
            cprint("\n📟 حالة الجهاز الحالية:", "bold yellow")
            for label, value, _ in rows:
                cprint(f"   {label}: {value}", "cyan")


# ---------------------------------------------------------------------------
# Menu
# ---------------------------------------------------------------------------
MENU_ITEMS = [
    ("1", "قراءة ملف (Read file)", False),
    ("2", "كتابة ملف جديد (Write new file)", False),
    ("3", "إضافة محتوى إلى ملف (Append to file)", False),
    ("4", "البحث داخل ملف واحد (Search in file)", False),
    ("5", "استبدال نص (Replace text)", False),
    ("6", "تنظيف النص (Clean text)", False),
    ("7", "إحصائيات النص (Text statistics)", False),
    ("8", "قائمة الملفات (List files)", False),
    ("9", "🧠 تحويل الحروف / تجميع الأسماء الذكي", True),
    ("10", "حذف الأسطر الفارغة (Remove empty lines)", False),
    ("11", "🔥 بحث شامل في مجلد (Folder-wide Search)", True),
    ("12", "🎯 استخراج ذكي للإيميلات والروابط (Regex)", True),
    ("13", "🆚 مقارنة ملفين (Compare two files)", True),
    ("14", "🧹 حذف الأسطر المكررة (Remove duplicate lines)", True),
    ("15", "🔠 ترتيب الأسطر أبجديًا (Sort lines)", True),
    ("16", "🔤 تحليل النص المتقدم + تصدير JSON", True),
    ("17", "📎 دمج عدة ملفات (Merge files)", True),
    ("18", "⏪ استرجاع نسخة احتياطية (Restore backup)", True),
    ("19", "🧽 تنظيف الملفات المؤقتة (Clean temp files)", True),
    ("20", "📟 حالة الجهاز (Device status)", True),
    ("21", "🔐 تشفير / فك تشفير الملفات (Encrypt/Decrypt)", True),
    ("22", "🎙️ استخراج النص من الصوت والفيديو (Media to Text)", True),
    ("23", "🖼️ البحث عن الصور والفيديو على الجهاز (Local media search)", True),
    ("0", "🚪 خروج (Exit)", False),
]


def print_menu() -> None:
    if HAS_RICH and console:
        table = Table(title=fix_display("📋 الخيارات"), box=box.SIMPLE_HEAVY, border_style="yellow", show_header=False)
        table.add_column("رقم", style="bold cyan", width=4)
        table.add_column("الوصف")
        for num, label, is_new in MENU_ITEMS:
            style = "bold magenta" if is_new else ""
            table.add_row(num, Text(fix_display(label), style=style))
        console.print(table)
    else:
        cprint("\n📋 الخيارات:", "bold yellow")
        for num, label, is_new in MENU_ITEMS:
            if is_new:
                cprint(f"{num}. {label}", "bold magenta")
            else:
                aprint(f"{num}. {label}")


def handle_smart_case(processor: TextFileProcessor) -> None:
    filename = select_path("اسم الملف: ", kind="file")
    if not filename:
        return
    content = processor.read_file(filename)
    if not content:
        return

    aprint(
        "\n1. أحرف كبيرة (UPPER)\n"
        "2. أحرف صغيرة (lower)\n"
        "3. عنوان (Title)\n"
        "4. حالة الجملة (Sentence case)\n"
    )
    cprint("5. 🧠 تجميع الأسطر/الأسماء المتشابهة تلقائيًا (Smart similarity grouping)", "bold magenta")
    case_choice = ask("اختر نوع التحويل: ")

    case_map = {"1": "upper", "2": "lower", "3": "title", "4": "sentence"}
    if case_choice in case_map:
        converted = processor.convert_case(content, case_map[case_choice])
        if ask_yes_no("حفظ التغييرات؟"):
            processor.backup_file(filename)
            processor.write_file(filename, converted)
        return

    if case_choice != "5":
        cprint("❌ خيار غير صحيح", "bold red")
        return

    groups, lines = processor.group_similar_lines(content)
    multi = [g for g in groups if len(g) > 1]
    if not multi:
        cprint("✓ لم يتم العثور على أسطر/أسماء متشابهة يمكن تجميعها.", "green")
        return

    cprint(f"\n🧠 تم العثور على {len(multi)} مجموعة أسماء متشابهة:", "bold yellow")
    removed: set = set()
    for g_num, g in enumerate(multi, 1):
        cprint(f"\n— مجموعة {g_num} —", "bold magenta")
        for k, idx in enumerate(g, 1):
            cprint(f"  [{k}] {lines[idx]}", "cyan")
        pick = ask("اختر رقم السطر ليكون الأساسي لهذه المجموعة (Enter لتجاهل المجموعة): ")
        if pick.isdigit() and 1 <= int(pick) <= len(g):
            canonical_idx = g[int(pick) - 1]
            for idx in g:
                if idx != canonical_idx:
                    removed.add(idx)

    if not removed:
        cprint("لم يتم دمج أي مجموعة.", "dim")
        return

    new_lines = [l for i, l in enumerate(lines) if i not in removed]
    merged_text = "\n".join(new_lines)
    cprint(f"✓ تم الدمج: {len(lines)} → {len(new_lines)} سطر", "bold green")
    if ask_yes_no("حفظ التغييرات؟"):
        processor.backup_file(filename)
        processor.write_file(filename, merged_text)


def main() -> None:
    processor = TextFileProcessor()

    while True:
        print_menu()
        choice = ask("\nاختر خيار: ")

        if choice == "1":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            content = processor.read_file(filename)
            if content:
                aprint("\n--- المحتوى ---")
                preview = content[:800] + ("..." if len(content) > 800 else "")
                aprint(preview)
                aprint("----------------\n")

        elif choice == "2":
            filename = fix_path(ask("اسم الملف الجديد: "))
            if filename.exists():
                if not ask_yes_no(f"⚠️ الملف موجود بالفعل: {filename}. استبداله؟"):
                    continue
            content = ask("المحتوى: ")
            processor.write_file(filename, content)

        elif choice == "3":
            filename = select_path("اسم الملف: ", kind="file", allow_create=True)
            if not filename:
                continue
            content = ask("المحتوى المراد إضافته: ")
            processor.append_file(filename, "\n" + content)

        elif choice == "4":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            search_term = ask("ابحث عن (الكلمة أو الحساب): ")
            results = processor.search_file(filename, search_term)
            if results and ask_yes_no("\n💾 حفظ النتائج في ملف جديد؟"):
                new_filename = fix_path(ask("اكتب مسار الملف الجديد: "))
                processor.write_file(new_filename, "\n".join(results))

        elif choice == "5":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            old_text = ask("النص القديم: ")
            new_text = ask("النص الجديد: ")
            content = processor.read_file(filename)
            if content:
                new_content = processor.replace_text(content, old_text, new_text)
                if ask_yes_no("حفظ التغييرات؟"):
                    processor.backup_file(filename)
                    processor.write_file(filename, new_content)

        elif choice == "6":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            content = processor.read_file(filename)
            if content:
                cleaned = processor.clean_text(content)
                if ask_yes_no("حفظ الملف المنظف؟"):
                    processor.backup_file(filename)
                    processor.write_file(filename, cleaned)

        elif choice == "7":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            content = processor.read_file(filename)
            if content:
                analysis = processor.deep_text_analysis(content)
                if ask_yes_no("تصدير التحليل إلى JSON؟"):
                    out = fix_path(ask("مسار ملف JSON: "))
                    processor.export_analysis(analysis, out)

        elif choice == "8":
            directory = ask("المجلد (اتركه فارغاً للمجلد الحالي): ")
            if directory:
                resolved = select_path_for_dir(directory)
                if resolved:
                    processor.list_files(resolved)
            else:
                processor.list_files(None)

        elif choice == "9":
            handle_smart_case(processor)

        elif choice == "10":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            content = processor.read_file(filename)
            if content:
                cleaned = processor.remove_empty_lines(content)
                if ask_yes_no("حفظ التغييرات؟"):
                    processor.backup_file(filename)
                    processor.write_file(filename, cleaned)

        elif choice == "11":
            directory = ask("المجلد المراد البحث بداخله (اتركه فارغاً للبحث في Downloads): ")
            if not directory:
                directory = "~/storage/downloads"
            resolved = select_path_for_dir(directory)
            if resolved:
                search_term = ask("اكتب الكلمة أو الجملة المراد البحث عنها: ")
                processor.search_in_directory(resolved, search_term)

        elif choice == "12":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            aprint("\n1. استخراج الإيميلات (Emails)")
            aprint("2. استخراج أرقام الهواتف (Phone Numbers)")
            aprint("3. استخراج الروابط (URLs)")
            p_type = ask("اختر نوع الاستخراج: ")
            matches = processor.extract_patterns(filename, p_type)
            if matches and ask_yes_no("\n💾 حفظ النتائج في ملف؟"):
                new_filename = fix_path(ask("مسار الملف الجديد (مثال ~/storage/downloads/res.txt): "))
                processor.write_file(new_filename, "\n".join(matches))

        elif choice == "13":
            cprint("اختر الملف الأول:", "yellow")
            file1 = select_path("اسم الملف الأول: ", kind="file")
            if not file1:
                continue
            cprint("اختر الملف الثاني:", "yellow")
            file2 = select_path("اسم الملف الثاني: ", kind="file")
            if not file2:
                continue
            processor.compare_files(file1, file2)

        elif choice == "14":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            content = processor.read_file(filename)
            if content:
                cleaned = processor.remove_duplicate_lines(content)
                if ask_yes_no("حفظ التغييرات؟"):
                    processor.backup_file(filename)
                    processor.write_file(filename, cleaned)

        elif choice == "15":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            content = processor.read_file(filename)
            if content:
                aprint("\n1. تصاعدي (A→Z)\n2. تنازلي (Z→A)")
                dir_choice = ask("اختر اتجاه الترتيب: ")
                sorted_text = processor.sort_lines(content, reverse=(dir_choice == "2"))
                if ask_yes_no("حفظ التغييرات؟"):
                    processor.backup_file(filename)
                    processor.write_file(filename, sorted_text)

        elif choice == "16":
            filename = select_path("اسم الملف: ", kind="file")
            if not filename:
                continue
            content = processor.read_file(filename)
            if content:
                analysis = processor.deep_text_analysis(content)
                if ask_yes_no("تصدير التحليل إلى JSON؟"):
                    out = fix_path(ask("مسار ملف JSON: "))
                    processor.export_analysis(analysis, out)

        elif choice == "17":
            cprint("أدخل أسماء الملفات المراد دمجها، ملف واحد في كل مرة. اترك السطر فارغًا للانتهاء.", "yellow")
            files_to_merge: List[Path] = []
            while True:
                fname = select_path(f"الملف رقم {len(files_to_merge) + 1} (أو Enter للإنهاء): ", kind="file")
                if not fname:
                    break
                files_to_merge.append(fname)
            if len(files_to_merge) < 2:
                cprint("✗ يجب اختيار ملفين على الأقل للدمج.", "bold red")
                continue
            merged = processor.merge_files(files_to_merge)
            if merged is not None:
                out_path = fix_path(ask("مسار ملف الدمج الناتج: "))
                processor.write_file(out_path, merged)

        elif choice == "18":
            filename = select_path("اسم الملف المراد استرجاعه: ", kind="file", allow_create=True)
            if not filename:
                continue
            processor.restore_backup(filename)

        elif choice == "19":
            directory = ask("المجلد المراد تنظيفه (اتركه فارغاً لاستخدام Downloads): ")
            if not directory:
                directory = "~/storage/downloads"
            resolved = select_path_for_dir(directory)
            if resolved:
                processor.clean_temp_files(resolved)

        elif choice == "20":
            processor.display_device_status()
            if ask_yes_no("\nهل تريد معرفة حجم ملف أو مجلد معيّن؟"):
                target = fix_path(ask("اكتب المسار: "))
                if target.exists():
                    if target.is_file():
                        size = target.stat().st_size
                    else:
                        size = sum(f.stat().st_size for f in target.rglob("*") if f.is_file())
                    cprint(f"📦 الحجم: {human_size(size)}", "bold cyan")
                else:
                    cprint("✗ المسار غير موجود.", "bold red")

        elif choice == "21":
            aprint("\n1. تشفير ملف واحد\n2. فك تشفير ملف واحد\n3. تشفير كل ملفات مجلد\n4. فك تشفير كل ملفات مجلد")
            op = ask("اختر العملية: ")
            if op in ("1", "2"):
                filepath = select_path("اسم الملف: ", kind="file")
                if not filepath:
                    continue
                pwd = ask("أدخل كلمة السر: ")
                if not pwd:
                    cprint("✗ كلمة السر مطلوبة.", "bold red")
                    continue
                if op == "1":
                    processor.encrypt_file(filepath, pwd)
                else:
                    processor.decrypt_file(filepath, pwd)
            elif op in ("3", "4"):
                directory = ask("المجلد: ")
                resolved = select_path_for_dir(directory) if directory else processor.current_dir
                if not resolved:
                    continue
                pwd = ask("أدخل كلمة السر: ")
                if not pwd:
                    cprint("✗ كلمة السر مطلوبة.", "bold red")
                    continue
                processor.batch_crypto(resolved, pwd, mode="encrypt" if op == "3" else "decrypt")
            else:
                cprint("❌ خيار غير صحيح", "bold red")

        elif choice == "22":
            filepath = select_path("مسار ملف الصوت أو الفيديو: ", kind="file")
            if not filepath:
                continue
            aprint("\n1. 🇪🇬 عربي (ar-EG)\n2. 🇺🇸 إنجليزي (en-US)")
            lang_choice = ask("لغة الصوت: ")
            lang = "en-US" if lang_choice == "2" else "ar-EG"
            text = processor.extract_media_text(filepath, lang)
            if text:
                aprint("\n--- النص المستخرج ---")
                aprint(text)
                aprint("---------------------")
                if ask_yes_no("\n💾 هل تريد حفظ النص في ملف جديد؟"):
                    out_path = filepath.with_suffix(".txt")
                    processor.write_file(out_path, text)

        elif choice == "23":
            directory = ask("مجلد البحث: ", default=str(processor.current_dir))
            media_choice = ask("1. صور  2. فيديو  3. كلاهما: ", default="3")
            if media_choice not in {"1", "2", "3"}:
                cprint("❌ خيار غير صحيح", "bold red")
                continue
            kind = {"1": "images", "2": "videos", "3": "both"}[media_choice]
            query = ask("جزء من اسم الملف (Enter لكل الملفات): ")
            recursive = ask_yes_no("البحث داخل المجلدات الفرعية؟", default=True)
            try:
                display_media_results(*search_local_media(directory, kind, query, recursive))
            except OSError as exc:
                cprint(f"✗ {exc}", "bold red")

        elif choice in ("0", "exit", "q", "quit"):
            show_exit_animation()
            break
        else:
            cprint("❌ خيار غير صحيح", "bold red")


# ---------------------------------------------------------------------------
# CLI / Automation mode
# ---------------------------------------------------------------------------
def run_cli() -> bool:
    parser = argparse.ArgumentParser(
        description=f"Text Processor Pro v{VERSION} — وضع الأتمتة (CLI)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="أمثلة:\n  python text_processor_pro.py --stats file.txt\n  python text_processor_pro.py --clean-temp ~/Downloads --yes",
    )
    parser.add_argument("--stats", metavar="FILE", help="عرض تحليل نص متقدم لملف مباشرة")
    parser.add_argument("--clean-temp", metavar="DIR", help="تنظيف الملفات المؤقتة في مجلد معيّن")
    parser.add_argument("--device-status", action="store_true", help="عرض حالة الجهاز والخروج")
    parser.add_argument("--export-json", metavar="OUT", help="مع --stats: تصدير التحليل إلى JSON")
    parser.add_argument("--yes", action="store_true", help="تخطي تأكيد الحذف (للأتمتة)")
    parser.add_argument("--check-deps", action="store_true", help="فحص المكتبات المثبتة والمفقودة ثم الخروج")
    parser.add_argument("--encrypt", metavar="FILE", help="تشفير ملف (يتطلب --password)")
    parser.add_argument("--decrypt", metavar="FILE", help="فك تشفير ملف (يتطلب --password)")
    parser.add_argument("--password", metavar="PASS", help="كلمة السر لعمليات التشفير/فك التشفير")
    parser.add_argument("--transcribe", metavar="FILE", help="تحويل ملف صوت/فيديو إلى نص")
    parser.add_argument("--lang", metavar="LANG", default="ar-EG", help="لغة التفريغ الصوتي (افتراضي ar-EG)")
    parser.add_argument("--version", action="version", version=f"%(prog)s {VERSION}")
    parser.add_argument("--search-media", metavar="DIR", help="Search a local folder for images/videos")
    parser.add_argument("--media-type", choices=["images", "videos", "both"], default="both")
    parser.add_argument("--name", default="", help="Media filename substring (case-insensitive)")
    parser.add_argument("--no-recursive", action="store_true", help="Search only the selected folder")
    args, _ = parser.parse_known_args()

    if args.search_media is not None:
        try:
            matches, errors = search_local_media(args.search_media, args.media_type,
                                                 args.name, not args.no_recursive)
        except OSError as exc:
            parser.exit(1, f"Media search failed: {exc}\n")
        display_media_results(matches, errors)
        if errors:
            parser.exit(1)
        return True

    if args.check_deps:
        print_dependency_report()
        return True

    processor = TextFileProcessor()

    if args.stats:
        content = processor.read_file(args.stats)
        if content:
            analysis = processor.deep_text_analysis(content)
            if args.export_json:
                processor.export_analysis(analysis, args.export_json)
        return True

    if args.clean_temp:
        processor.clean_temp_files(fix_path(args.clean_temp), auto_confirm=args.yes)
        return True

    if args.device_status:
        processor.display_device_status()
        return True

    if args.encrypt:
        if not args.password:
            cprint("✗ استخدم --password مع --encrypt", "bold red")
            return True
        processor.encrypt_file(fix_path(args.encrypt), args.password)
        return True

    if args.decrypt:
        if not args.password:
            cprint("✗ استخدم --password مع --decrypt", "bold red")
            return True
        processor.decrypt_file(fix_path(args.decrypt), args.password)
        return True

    if args.transcribe:
        text = processor.extract_media_text(fix_path(args.transcribe), lang=args.lang)
        if text:
            aprint(text)
        return True

    return False


if __name__ == "__main__":
    if not run_cli():
        show_splash()
        main()
