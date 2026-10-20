from __future__ import annotations

import argparse
import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any, Iterable

try:
    from PIL import Image, ImageOps
except ModuleNotFoundError as exc:  # pragma: no cover - import guard
    raise SystemExit(
        "Pillow no esta instalado. Ejecuta: pip install Pillow pillow-avif-plugin"
    ) from exc

try:
    import pillow_avif  # noqa: F401

    AVIF_AVAILABLE = True
except ModuleNotFoundError:
    AVIF_AVAILABLE = False

RESAMPLING_LANCZOS = (
    Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
)


SCRIPT_VERSION = "2.1.0"
SCHEMA_VERSION = 2
SUPPORTED_STEPS = ("imagenes", "videos", "audios", "svg", "og", "favicon")
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".ogg"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".opus"}
SVG_EXTENSIONS = {".svg"}
OG_EXTENSIONS = IMAGE_EXTENSIONS | {".bmp", ".tif", ".tiff"}
FAVICON_EXTENSIONS = OG_EXTENSIONS


class PipelineError(RuntimeError):
    """Raised when the multimedia pipeline cannot complete safely."""


@dataclass(frozen=True)
class ProcessorConfig:
    source: Path
    dest: Path
    force: bool = False
    verbose: bool = True
    image_max_mb: float = 1.0
    image_quality_start: int = 80
    image_quality_min: int = 50
    image_quality_step: int = 5
    webp_quality: int = 80
    avif_quality: int = 50
    video_width: int = 1280
    video_crf: int = 24
    video_fps: int = 30
    webm_bitrate: str = "200k"
    webm_crf: int = 35
    ogg_quality: int = 5
    gif_width: int = 480
    gif_fps: int = 10
    gif_seconds: int = 3
    og_input: str | None = None
    og_output_name: str = "og.jpg"
    og_width: int = 1200
    og_height: int = 630
    og_quality: int = 85
    favicon_input: str | None = None
    favicon_name: str = "Sitio"
    favicon_short_name: str = "Sitio"
    favicon_theme_color: str = "#ffffff"
    favicon_background_color: str = "#ffffff"
    favicon_display: str = "standalone"
    selected_steps: tuple[str, ...] = SUPPORTED_STEPS

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> "ProcessorConfig":
        selected_steps = parse_steps(args.only or os.getenv("MULTIMEDIA_ONLY"))
        config = cls(
            source=Path(args.source or os.getenv("MULTIMEDIA_SOURCE", "recursos")),
            dest=Path(args.dest or os.getenv("MULTIMEDIA_DEST", "public")),
            force=args.force or env_bool("MULTIMEDIA_FORCE", False),
            verbose=not args.quiet and env_bool("MULTIMEDIA_VERBOSE", True),
            image_max_mb=env_float("MULTIMEDIA_IMAGE_MAX_MB", 1.0),
            image_quality_start=env_int("MULTIMEDIA_IMAGE_QUALITY_START", 80),
            image_quality_min=env_int("MULTIMEDIA_IMAGE_QUALITY_MIN", 50),
            image_quality_step=env_int("MULTIMEDIA_IMAGE_QUALITY_STEP", 5),
            webp_quality=env_int("MULTIMEDIA_WEBP_QUALITY", 80),
            avif_quality=env_int("MULTIMEDIA_AVIF_QUALITY", 50),
            video_width=env_int("MULTIMEDIA_VIDEO_WIDTH", 1280),
            video_crf=env_int("MULTIMEDIA_VIDEO_CRF", 24),
            video_fps=env_int("MULTIMEDIA_VIDEO_FPS", 30),
            webm_bitrate=os.getenv("MULTIMEDIA_WEBM_BITRATE", "200k"),
            webm_crf=env_int("MULTIMEDIA_WEBM_CRF", 35),
            ogg_quality=env_int("MULTIMEDIA_OGG_QUALITY", 5),
            gif_width=env_int("MULTIMEDIA_GIF_WIDTH", 480),
            gif_fps=env_int("MULTIMEDIA_GIF_FPS", 10),
            gif_seconds=env_int("MULTIMEDIA_GIF_SECONDS", 3),
            og_input=os.getenv("MULTIMEDIA_OG_INPUT") or None,
            og_output_name=os.getenv("MULTIMEDIA_OG_OUTPUT", "og.jpg"),
            og_width=env_int("MULTIMEDIA_OG_WIDTH", 1200),
            og_height=env_int("MULTIMEDIA_OG_HEIGHT", 630),
            og_quality=env_int("MULTIMEDIA_OG_QUALITY", 85),
            favicon_input=os.getenv("MULTIMEDIA_FAVICON_INPUT") or None,
            favicon_name=os.getenv("MULTIMEDIA_FAVICON_NAME", "Sitio"),
            favicon_short_name=os.getenv("MULTIMEDIA_FAVICON_SHORT_NAME", "Sitio"),
            favicon_theme_color=os.getenv("MULTIMEDIA_FAVICON_THEME_COLOR", "#ffffff"),
            favicon_background_color=os.getenv(
                "MULTIMEDIA_FAVICON_BACKGROUND_COLOR", "#ffffff"
            ),
            favicon_display=os.getenv("MULTIMEDIA_FAVICON_DISPLAY", "standalone"),
            selected_steps=selected_steps,
        )
        config.validate()
        return config

    def validate(self) -> None:
        if not self.source.exists():
            raise PipelineError(f"La carpeta de origen no existe: {self.source}")
        if Path(self.og_output_name).name != self.og_output_name:
            raise PipelineError(
                "MULTIMEDIA_OG_OUTPUT debe ser un nombre de archivo, no una ruta."
            )
        if Path(self.og_output_name).suffix.lower() not in {".jpg", ".jpeg"}:
            raise PipelineError(
                "MULTIMEDIA_OG_OUTPUT debe terminar en .jpg o .jpeg."
            )
        if self.image_quality_start < self.image_quality_min:
            raise PipelineError(
                "MULTIMEDIA_IMAGE_QUALITY_START no puede ser menor que MULTIMEDIA_IMAGE_QUALITY_MIN."
            )
        if self.image_quality_step <= 0:
            raise PipelineError("MULTIMEDIA_IMAGE_QUALITY_STEP debe ser mayor que 0.")
        if self.image_max_mb <= 0:
            raise PipelineError("MULTIMEDIA_IMAGE_MAX_MB debe ser mayor que 0.")
        for field_name in (
            "video_width",
            "video_fps",
            "gif_width",
            "gif_fps",
            "gif_seconds",
            "og_width",
            "og_height",
        ):
            if getattr(self, field_name) <= 0:
                raise PipelineError(f"{field_name} debe ser mayor que 0.")
        for field_name in (
            "image_quality_start",
            "image_quality_min",
            "webp_quality",
            "avif_quality",
            "og_quality",
        ):
            value = getattr(self, field_name)
            if value < 1 or value > 100:
                raise PipelineError(f"{field_name} debe estar entre 1 y 100.")


class MediaProcessor:
    def __init__(self, config: ProcessorConfig) -> None:
        self.config = config
        self.source_dirs = {
            "imagenes": self.config.source / "imagenes",
            "videos": self.config.source / "videos",
            "audios": self.config.source / "audios",
            "svg": self.config.source / "svg",
            "og": self.config.source / "og",
            "favicon": self.config.source / "favicon",
        }
        self.dest_dirs = {
            "imagenes": self.config.dest / "imagenes",
            "videos": self.config.dest / "videos",
            "audios": self.config.dest / "audios",
            "svg": self.config.dest / "svg",
            "og": self.config.dest / "og",
            "favicon": self.config.dest / "favicon",
            "gif": self.config.dest / "gif",
            "registros": self.config.dest / "registros",
        }
        self.summary: dict[str, dict[str, int]] = {
            step: {"processed": 0, "skipped": 0, "removed": 0}
            for step in SUPPORTED_STEPS
        }
        self.avif_warning_emitted = False
        self.warning_count = 0

    def run(self) -> None:
        self.ensure_destinations()
        self.info("Iniciando procesamiento multimedia...")

        for step in self.config.selected_steps:
            getattr(self, f"process_{step}")()

        self.print_summary()

    def ensure_destinations(self) -> None:
        for path in self.dest_dirs.values():
            path.mkdir(parents=True, exist_ok=True)

    def process_imagenes(self) -> None:
        kind = "imagenes"
        source_dir = self.source_dirs[kind]
        manifest = self.load_manifest(kind)
        files = self.list_files(source_dir, IMAGE_EXTENSIONS)
        config_hash = self.config_hash(
            kind,
            {
                "script_version": SCRIPT_VERSION,
                "avif_available": AVIF_AVAILABLE,
                "image_max_mb": self.config.image_max_mb,
                "image_quality_start": self.config.image_quality_start,
                "image_quality_min": self.config.image_quality_min,
                "image_quality_step": self.config.image_quality_step,
                "webp_quality": self.config.webp_quality,
                "avif_quality": self.config.avif_quality,
            },
        )

        new_entries: dict[str, dict[str, Any]] = {}
        active_rel_paths: set[str] = set()

        self.info("Procesando carpeta: imagenes")

        for file_path in files:
            rel_path = relative_posix(file_path, source_dir)
            active_rel_paths.add(rel_path)
            source_hash = file_hash(file_path)
            existing = manifest.get(rel_path)

            if not self.needs_processing(existing, source_hash, config_hash):
                self.info(f"Omitido (sin cambios): {rel_path}")
                new_entries[rel_path] = existing
                self.summary[kind]["skipped"] += 1
                continue

            outputs = self.generate_image_outputs(file_path, self.dest_dirs[kind])
            self.cleanup_superseded_outputs(existing, outputs)
            new_entries[rel_path] = self.build_manifest_entry(
                file_path, source_hash, config_hash, outputs
            )
            self.summary[kind]["processed"] += 1

        self.cleanup_removed_sources(
            kind,
            manifest,
            active_rel_paths,
            protected_outputs=self.manifest_outputs(new_entries),
        )
        self.save_manifest(kind, new_entries)

    def process_videos(self) -> None:
        kind = "videos"
        source_dir = self.source_dirs[kind]
        manifest = self.load_manifest(kind)
        files = self.list_files(source_dir, VIDEO_EXTENSIONS)
        if files:
            self.require_binary("ffmpeg")

        config_hash = self.config_hash(
            kind,
            {
                "script_version": SCRIPT_VERSION,
                "video_width": self.config.video_width,
                "video_crf": self.config.video_crf,
                "video_fps": self.config.video_fps,
                "webm_bitrate": self.config.webm_bitrate,
                "webm_crf": self.config.webm_crf,
                "ogg_quality": self.config.ogg_quality,
                "gif_width": self.config.gif_width,
                "gif_fps": self.config.gif_fps,
                "gif_seconds": self.config.gif_seconds,
            },
        )

        new_entries: dict[str, dict[str, Any]] = {}
        active_rel_paths: set[str] = set()

        self.info("Procesando carpeta: videos")

        for file_path in files:
            rel_path = relative_posix(file_path, source_dir)
            active_rel_paths.add(rel_path)
            source_hash = file_hash(file_path)
            existing = manifest.get(rel_path)

            if not self.needs_processing(existing, source_hash, config_hash):
                self.info(f"Omitido (sin cambios): {rel_path}")
                new_entries[rel_path] = existing
                self.summary[kind]["skipped"] += 1
                continue

            outputs = self.generate_video_outputs(file_path, self.dest_dirs[kind])
            self.cleanup_superseded_outputs(existing, outputs)
            new_entries[rel_path] = self.build_manifest_entry(
                file_path, source_hash, config_hash, outputs
            )
            self.summary[kind]["processed"] += 1

        self.cleanup_removed_sources(
            kind,
            manifest,
            active_rel_paths,
            protected_outputs=self.manifest_outputs(new_entries),
        )
        self.save_manifest(kind, new_entries)

    def process_audios(self) -> None:
        kind = "audios"
        source_dir = self.source_dirs[kind]
        manifest = self.load_manifest(kind)
        files = self.list_files(source_dir, AUDIO_EXTENSIONS)
        config_hash = self.config_hash(kind, {"script_version": SCRIPT_VERSION})

        new_entries: dict[str, dict[str, Any]] = {}
        active_rel_paths: set[str] = set()

        self.info("Procesando carpeta: audios")

        for file_path in files:
            rel_path = relative_posix(file_path, source_dir)
            active_rel_paths.add(rel_path)
            source_hash = file_hash(file_path)
            existing = manifest.get(rel_path)

            if not self.needs_processing(existing, source_hash, config_hash):
                self.info(f"Omitido (sin cambios): {rel_path}")
                new_entries[rel_path] = existing
                self.summary[kind]["skipped"] += 1
                continue

            destination = self.dest_dirs[kind] / rel_path
            atomic_copy(file_path, destination)
            outputs = [relative_posix(destination, self.config.dest)]
            self.cleanup_superseded_outputs(existing, outputs)
            new_entries[rel_path] = self.build_manifest_entry(
                file_path, source_hash, config_hash, outputs
            )
            self.info(f"Copiado: {rel_path}")
            self.summary[kind]["processed"] += 1

        self.cleanup_removed_sources(
            kind,
            manifest,
            active_rel_paths,
            protected_outputs=self.manifest_outputs(new_entries),
        )
        self.save_manifest(kind, new_entries)

    def process_svg(self) -> None:
        kind = "svg"
        source_dir = self.source_dirs[kind]
        manifest = self.load_manifest(kind)
        files = self.list_files(source_dir, SVG_EXTENSIONS)
        config_hash = self.config_hash(kind, {"script_version": SCRIPT_VERSION})

        new_entries: dict[str, dict[str, Any]] = {}
        active_rel_paths: set[str] = set()

        self.info("Procesando carpeta: svg")

        for file_path in files:
            rel_path = relative_posix(file_path, source_dir)
            active_rel_paths.add(rel_path)
            source_hash = file_hash(file_path)
            existing = manifest.get(rel_path)

            if not self.needs_processing(existing, source_hash, config_hash):
                self.info(f"Omitido (sin cambios): {rel_path}")
                new_entries[rel_path] = existing
                self.summary[kind]["skipped"] += 1
                continue

            destination = self.dest_dirs[kind] / rel_path
            atomic_copy(file_path, destination)
            outputs = [relative_posix(destination, self.config.dest)]
            self.cleanup_superseded_outputs(existing, outputs)
            new_entries[rel_path] = self.build_manifest_entry(
                file_path, source_hash, config_hash, outputs
            )
            self.info(f"Copiado: {rel_path}")
            self.summary[kind]["processed"] += 1

        self.cleanup_removed_sources(
            kind,
            manifest,
            active_rel_paths,
            protected_outputs=self.manifest_outputs(new_entries),
        )
        self.save_manifest(kind, new_entries)

    def process_og(self) -> None:
        kind = "og"
        source_dir = self.source_dirs[kind]
        manifest = self.load_manifest(kind)
        selected = self.select_single_source(
            kind,
            source_dir,
            self.config.og_input,
            OG_EXTENSIONS,
        )
        config_hash = self.config_hash(
            kind,
            {
                "script_version": SCRIPT_VERSION,
                "output_name": self.config.og_output_name,
                "width": self.config.og_width,
                "height": self.config.og_height,
                "quality": self.config.og_quality,
            },
        )
        new_entries: dict[str, dict[str, Any]] = {}
        active_rel_paths: set[str] = set()

        self.info("Procesando carpeta: og")

        if selected is not None:
            rel_path = relative_posix(selected, source_dir)
            active_rel_paths.add(rel_path)
            source_hash = file_hash(selected)
            existing = manifest.get(rel_path)

            if not self.needs_processing(existing, source_hash, config_hash):
                self.info(f"Omitido (sin cambios): {rel_path}")
                new_entries[rel_path] = existing
                self.summary[kind]["skipped"] += 1
            else:
                output = self.generate_og_image(selected)
                self.cleanup_superseded_outputs(existing, [output])
                new_entries[rel_path] = self.build_manifest_entry(
                    selected, source_hash, config_hash, [output]
                )
                self.info(f"Generado OG: {Path(output).name}")
                self.summary[kind]["processed"] += 1

        self.cleanup_removed_sources(
            kind,
            manifest,
            active_rel_paths,
            protected_outputs=self.manifest_outputs(new_entries),
        )
        self.save_manifest(kind, new_entries)

    def process_favicon(self) -> None:
        kind = "favicon"
        source_dir = self.source_dirs[kind]
        manifest = self.load_manifest(kind)
        selected = self.select_single_source(
            kind,
            source_dir,
            self.config.favicon_input,
            FAVICON_EXTENSIONS,
        )
        config_hash = self.config_hash(
            kind,
            {
                "script_version": SCRIPT_VERSION,
                "name": self.config.favicon_name,
                "short_name": self.config.favicon_short_name,
                "theme_color": self.config.favicon_theme_color,
                "background_color": self.config.favicon_background_color,
                "display": self.config.favicon_display,
            },
        )
        new_entries: dict[str, dict[str, Any]] = {}
        active_rel_paths: set[str] = set()

        self.info("Procesando carpeta: favicon")

        if selected is not None:
            rel_path = relative_posix(selected, source_dir)
            active_rel_paths.add(rel_path)
            source_hash = file_hash(selected)
            existing = manifest.get(rel_path)

            if not self.needs_processing(existing, source_hash, config_hash):
                self.info(f"Omitido (sin cambios): {rel_path}")
                new_entries[rel_path] = existing
                self.summary[kind]["skipped"] += 1
            else:
                outputs = self.generate_favicons(selected)
                self.cleanup_superseded_outputs(existing, outputs)
                new_entries[rel_path] = self.build_manifest_entry(
                    selected, source_hash, config_hash, outputs
                )
                self.info("Favicons generados.")
                self.summary[kind]["processed"] += 1

        self.cleanup_removed_sources(
            kind,
            manifest,
            active_rel_paths,
            protected_outputs=self.manifest_outputs(new_entries),
        )
        self.save_manifest(kind, new_entries)

    def generate_image_outputs(self, source_file: Path, destination_root: Path) -> list[str]:
        destination_dir = destination_root / source_file.relative_to(
            self.source_dirs["imagenes"]
        ).parent
        destination_dir.mkdir(parents=True, exist_ok=True)
        base_name = source_file.stem

        with Image.open(source_file) as original:
            prepared = ImageOps.exif_transpose(original)
            has_alpha = image_has_alpha(prepared)
            converted = prepared.convert("RGBA" if has_alpha else "RGB")

            final_primary = destination_dir / f"{base_name}{'.png' if has_alpha else '.jpg'}"
            final_webp = destination_dir / f"{base_name}.webp"
            final_avif = destination_dir / f"{base_name}.avif"

            targets: list[tuple[Path, Path]] = [
                (temp_output_path(final_primary), final_primary),
                (temp_output_path(final_webp), final_webp),
            ]
            if AVIF_AVAILABLE:
                targets.append((temp_output_path(final_avif), final_avif))

            cleanup_temp_files([temp for temp, _ in targets])

            try:
                primary_temp = targets[0][0]
                if has_alpha:
                    converted.save(
                        primary_temp,
                        format="PNG",
                        optimize=True,
                        compress_level=9,
                    )
                else:
                    quality = self.config.image_quality_start
                    while True:
                        converted.save(
                            primary_temp,
                            format="JPEG",
                            optimize=True,
                            progressive=True,
                            quality=quality,
                        )
                        if output_size_mb(primary_temp) <= self.config.image_max_mb:
                            break
                        if quality <= self.config.image_quality_min:
                            break
                        quality = max(
                            self.config.image_quality_min,
                            quality - self.config.image_quality_step,
                        )
                        if quality == self.config.image_quality_min:
                            converted.save(
                                primary_temp,
                                format="JPEG",
                                optimize=True,
                                progressive=True,
                                quality=quality,
                            )
                            break

                converted.save(
                    targets[1][0],
                    format="WEBP",
                    quality=self.config.webp_quality,
                    method=6,
                )

                if AVIF_AVAILABLE:
                    converted.save(
                        targets[2][0],
                        format="AVIF",
                        quality=self.config.avif_quality,
                    )

                outputs: list[str] = []
                for temp_file, final_file in targets:
                    temp_file.replace(final_file)
                    outputs.append(relative_posix(final_file, self.config.dest))

                if not AVIF_AVAILABLE and not self.avif_warning_emitted:
                    self.avif_warning_emitted = True
                    self.warn(
                        "pillow-avif-plugin no esta instalado; se omitio la salida AVIF."
                    )
                return outputs
            except Exception as exc:
                cleanup_temp_files([temp for temp, _ in targets])
                raise PipelineError(
                    f"No se pudo procesar la imagen {source_file}: {exc}"
                ) from exc
            finally:
                prepared.close()
                converted.close()

    def generate_video_outputs(self, source_file: Path, destination_root: Path) -> list[str]:
        destination_dir = destination_root / source_file.relative_to(
            self.source_dirs["videos"]
        ).parent
        destination_dir.mkdir(parents=True, exist_ok=True)
        self.dest_dirs["gif"].mkdir(parents=True, exist_ok=True)

        base_name = source_file.stem
        final_mp4 = destination_dir / f"{base_name}.mp4"
        final_webm = destination_dir / f"{base_name}.webm"
        final_ogg = destination_dir / f"{base_name}.ogg"
        final_gif = self.dest_dirs["gif"] / f"{base_name}.gif"

        temp_mp4 = temp_output_path(final_mp4)
        temp_webm = temp_output_path(final_webm)
        temp_ogg = temp_output_path(final_ogg)
        temp_gif = temp_output_path(final_gif)
        temp_files = [temp_mp4, temp_webm, temp_ogg, temp_gif]
        cleanup_temp_files(temp_files)

        scale_filter = f"scale=min(iw\\,{self.config.video_width}):-2"
        gif_filter = (
            f"fps={self.config.gif_fps},"
            f"scale=min(iw\\,{self.config.gif_width}):-2:flags=lanczos"
        )

        try:
            self.run_command(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(source_file),
                    "-vf",
                    scale_filter,
                    "-r",
                    str(self.config.video_fps),
                    "-c:v",
                    "libx264",
                    "-crf",
                    str(self.config.video_crf),
                    "-movflags",
                    "+faststart",
                    str(temp_mp4),
                ],
                label=f"mp4:{source_file.name}",
            )
            self.run_command(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(temp_mp4),
                    "-c:v",
                    "libvpx-vp9",
                    "-b:v",
                    self.config.webm_bitrate,
                    "-crf",
                    str(self.config.webm_crf),
                    str(temp_webm),
                ],
                label=f"webm:{source_file.name}",
            )
            self.run_command(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(temp_mp4),
                    "-c:v",
                    "libtheora",
                    "-qscale:v",
                    str(self.config.ogg_quality),
                    str(temp_ogg),
                ],
                label=f"ogg:{source_file.name}",
            )
            self.run_command(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    str(source_file),
                    "-vf",
                    gif_filter,
                    "-t",
                    str(self.config.gif_seconds),
                    str(temp_gif),
                ],
                label=f"gif:{source_file.name}",
            )

            outputs = []
            for temp_file, final_file in (
                (temp_mp4, final_mp4),
                (temp_webm, final_webm),
                (temp_ogg, final_ogg),
                (temp_gif, final_gif),
            ):
                temp_file.replace(final_file)
                outputs.append(relative_posix(final_file, self.config.dest))

            return outputs
        except Exception as exc:
            cleanup_temp_files(temp_files)
            raise PipelineError(
                f"No se pudo procesar el video {source_file}: {exc}"
            ) from exc

    def generate_og_image(self, source_file: Path) -> str:
        destination = self.dest_dirs["og"] / self.config.og_output_name
        temp_destination = temp_output_path(destination)
        cleanup_temp_files([temp_destination])

        with Image.open(source_file) as original:
            prepared = ImageOps.exif_transpose(original).convert("RGB")
            fitted = ImageOps.fit(
                prepared,
                (self.config.og_width, self.config.og_height),
                method=RESAMPLING_LANCZOS,
            )
            try:
                fitted.save(
                    temp_destination,
                    format="JPEG",
                    optimize=True,
                    progressive=True,
                    quality=self.config.og_quality,
                )
                temp_destination.replace(destination)
                return relative_posix(destination, self.config.dest)
            except Exception as exc:
                cleanup_temp_files([temp_destination])
                raise PipelineError(
                    f"No se pudo generar la imagen OG desde {source_file}: {exc}"
                ) from exc
            finally:
                fitted.close()
                prepared.close()

    def generate_favicons(self, source_file: Path) -> list[str]:
        destination_dir = self.dest_dirs["favicon"]
        destination_dir.mkdir(parents=True, exist_ok=True)
        outputs: list[str] = []

        targets = {
            "favicon-16x16.png": 16,
            "favicon-32x32.png": 32,
            "apple-touch-icon.png": 180,
            "android-chrome-192x192.png": 192,
            "android-chrome-512x512.png": 512,
        }

        temp_targets = {
            destination_dir / name: temp_output_path(destination_dir / name)
            for name in targets
        }
        favicon_ico = destination_dir / "favicon.ico"
        favicon_ico_temp = temp_output_path(favicon_ico)
        manifest_file = destination_dir / "site.webmanifest"
        manifest_temp = temp_output_path(manifest_file)
        cleanup_temp_files([*temp_targets.values(), favicon_ico_temp, manifest_temp])

        with Image.open(source_file) as original:
            prepared = ImageOps.exif_transpose(original).convert("RGBA")
            try:
                for name, size in targets.items():
                    final_path = destination_dir / name
                    resized = ImageOps.fit(
                        prepared,
                        (size, size),
                        method=RESAMPLING_LANCZOS,
                    )
                    resized.save(temp_targets[final_path], format="PNG", optimize=True)
                    resized.close()

                favicon_image = ImageOps.fit(
                    prepared,
                    (32, 32),
                    method=RESAMPLING_LANCZOS,
                )
                favicon_image.save(favicon_ico_temp, format="ICO")
                favicon_image.close()

                manifest_payload = {
                    "background_color": self.config.favicon_background_color,
                    "display": self.config.favicon_display,
                    "icons": [
                        {
                            "src": "/favicon/android-chrome-192x192.png",
                            "sizes": "192x192",
                            "type": "image/png",
                        },
                        {
                            "src": "/favicon/android-chrome-512x512.png",
                            "sizes": "512x512",
                            "type": "image/png",
                        },
                    ],
                    "name": self.config.favicon_name,
                    "short_name": self.config.favicon_short_name,
                    "theme_color": self.config.favicon_theme_color,
                }
                write_json_file(manifest_temp, manifest_payload)

                for final_path, temp_path in temp_targets.items():
                    temp_path.replace(final_path)
                    outputs.append(relative_posix(final_path, self.config.dest))

                favicon_ico_temp.replace(favicon_ico)
                outputs.append(relative_posix(favicon_ico, self.config.dest))

                manifest_temp.replace(manifest_file)
                outputs.append(relative_posix(manifest_file, self.config.dest))
                return outputs
            except Exception as exc:
                cleanup_temp_files(
                    [*temp_targets.values(), favicon_ico_temp, manifest_temp]
                )
                raise PipelineError(
                    f"No se pudieron generar los favicons desde {source_file}: {exc}"
                ) from exc
            finally:
                prepared.close()

    def select_single_source(
        self,
        kind: str,
        source_dir: Path,
        explicit_name: str | None,
        extensions: set[str],
    ) -> Path | None:
        files = self.list_files(source_dir, extensions)
        if explicit_name:
            explicit_path = (source_dir / explicit_name).resolve()
            if not path_is_within(explicit_path, source_dir.resolve()):
                raise PipelineError(
                    f"{kind}: MULTIMEDIA_{kind.upper()}_INPUT apunta fuera de {source_dir}"
                )
            if not explicit_path.exists() or not explicit_path.is_file():
                raise PipelineError(
                    f"{kind}: no existe el archivo configurado: {explicit_path}"
                )
            if explicit_path.suffix.lower() not in extensions:
                allowed = ", ".join(sorted(extensions))
                raise PipelineError(
                    f"{kind}: extension no soportada para {explicit_path.name}. Usa: {allowed}"
                )
            return explicit_path

        if not files:
            return None

        if len(files) > 1:
            self.warn(
                f"{kind}: hay multiples archivos de origen; se usara el primero alfabeticamente. "
                f"Configura MULTIMEDIA_{kind.upper()}_INPUT para fijar uno concreto."
            )

        return files[0]

    def build_manifest_entry(
        self,
        source_file: Path,
        source_hash: str,
        config_hash: str,
        outputs: list[str],
    ) -> dict[str, Any]:
        stat = source_file.stat()
        return {
            "config_hash": config_hash,
            "outputs": outputs,
            "source_hash": source_hash,
            "source_mtime_ns": stat.st_mtime_ns,
            "source_size": stat.st_size,
        }

    def needs_processing(
        self,
        entry: dict[str, Any] | None,
        source_hash: str,
        config_hash: str,
    ) -> bool:
        if self.config.force:
            return True
        if not entry:
            return True
        if entry.get("source_hash") != source_hash:
            return True
        if entry.get("config_hash") != config_hash:
            return True

        outputs = extract_outputs(entry)
        if not outputs:
            return True

        return any(not self.resolve_output_path(output).exists() for output in outputs)

    def load_manifest(self, kind: str) -> dict[str, dict[str, Any]]:
        path = self.dest_dirs["registros"] / f"{kind}.json"
        if not path.exists():
            return {}

        try:
            with path.open(encoding="utf-8") as handle:
                data = json.load(handle)
        except json.JSONDecodeError as exc:
            raise PipelineError(f"Manifest JSON invalido en {path}: {exc}") from exc

        if (
            isinstance(data, dict)
            and data.get("schema_version") == SCHEMA_VERSION
            and isinstance(data.get("entries"), dict)
        ):
            return {
                str(key): dict(value)
                for key, value in data["entries"].items()
                if isinstance(key, str) and isinstance(value, dict)
            }

        if not isinstance(data, dict):
            raise PipelineError(f"Formato de manifest no soportado en {path}")

        migrated: dict[str, dict[str, Any]] = {}
        for key, value in data.items():
            if not isinstance(key, str):
                continue
            entry: dict[str, Any] = {"outputs": extract_outputs(value)}
            if isinstance(value, dict):
                entry.update(value)
            migrated[key] = entry

        if migrated:
            self.warn(
                f"Se detecto un manifest legado en {path.name}; se migrara al nuevo formato."
            )

        return migrated

    def save_manifest(self, kind: str, entries: dict[str, dict[str, Any]]) -> None:
        payload = {
            "entries": dict(sorted(entries.items())),
            "kind": kind,
            "schema_version": SCHEMA_VERSION,
            "script_version": SCRIPT_VERSION,
        }
        path = self.dest_dirs["registros"] / f"{kind}.json"
        write_json_atomic(path, payload)

    def manifest_outputs(self, entries: dict[str, dict[str, Any]]) -> set[str]:
        outputs: set[str] = set()
        for entry in entries.values():
            outputs.update(extract_outputs(entry))
        return outputs

    def cleanup_removed_sources(
        self,
        kind: str,
        previous_entries: dict[str, dict[str, Any]],
        active_rel_paths: set[str],
        protected_outputs: set[str] | None = None,
    ) -> None:
        protected_outputs = protected_outputs or set()
        removed_sources = set(previous_entries) - active_rel_paths
        for rel_path in removed_sources:
            candidate_outputs = extract_outputs(previous_entries.get(rel_path))
            removed_outputs = [
                output for output in candidate_outputs if output not in protected_outputs
            ]
            removed_count = self.remove_outputs(removed_outputs)
            protected_count = len(candidate_outputs) - len(removed_outputs)
            if protected_count:
                self.info(
                    f"Manifest huerfano limpiado sin borrar salidas activas: {rel_path}"
                )
            elif candidate_outputs:
                self.info(f"Eliminando archivo huerfano: {rel_path}")
            self.summary[kind]["removed"] += removed_count

    def cleanup_superseded_outputs(
        self, previous_entry: dict[str, Any] | None, current_outputs: list[str]
    ) -> None:
        if not previous_entry:
            return

        previous_outputs = set(extract_outputs(previous_entry))
        current_output_set = set(current_outputs)
        stale_outputs = sorted(previous_outputs - current_output_set)
        self.remove_outputs(stale_outputs)

    def remove_outputs(self, outputs: Iterable[str]) -> int:
        removed_count = 0
        for output in outputs:
            if not output:
                continue
            output_path = self.resolve_output_path(output)
            if output_path.exists():
                output_path.unlink()
                self.info(f"Eliminado: {output}")
                removed_count += 1
        return removed_count

    def resolve_output_path(self, relative_output: str) -> Path:
        if Path(relative_output).is_absolute():
            raise PipelineError(
                f"El manifest contiene una ruta absoluta no permitida: {relative_output}"
            )

        resolved = (self.config.dest / relative_output).resolve()
        if not path_is_within(resolved, self.config.dest.resolve()):
            raise PipelineError(
                f"El manifest intenta salir de {self.config.dest}: {relative_output}"
            )
        return resolved

    def list_files(
        self, directory: Path, extensions: set[str] | None = None
    ) -> list[Path]:
        if not directory.exists():
            return []

        files = []
        for path in directory.rglob("*"):
            if not path.is_file():
                continue
            if extensions is None or path.suffix.lower() in extensions:
                files.append(path)

        return sorted(files)

    def require_binary(self, binary_name: str) -> None:
        if shutil.which(binary_name):
            return
        raise PipelineError(
            f"No se encontro '{binary_name}' en el sistema. Instala la dependencia y vuelve a ejecutar el pipeline."
        )

    def run_command(self, command: list[str], label: str) -> None:
        try:
            subprocess.run(
                command,
                capture_output=True,
                check=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or "").strip()
            stderr_tail = stderr.splitlines()[-10:] if stderr else []
            details = "\n".join(stderr_tail) if stderr_tail else "Sin salida de error."
            raise PipelineError(f"Fallo {label}.\n{details}") from exc

    def config_hash(self, kind: str, payload: dict[str, Any]) -> str:
        serialized = json.dumps(
            {"kind": kind, **payload},
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def print_summary(self) -> None:
        self.info("Procesamiento finalizado.")
        for step in self.config.selected_steps:
            stats = self.summary[step]
            self.info(
                f"[{step}] procesados={stats['processed']} omitidos={stats['skipped']} eliminados={stats['removed']}"
            )
        if self.warning_count:
            print(
                f"Aviso: Pipeline completado con {self.warning_count} advertencia(s).",
                file=sys.stderr,
            )

    def info(self, message: str) -> None:
        if self.config.verbose:
            print(message)

    def warn(self, message: str) -> None:
        self.warning_count += 1
        print(f"Aviso: {message}", file=sys.stderr)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Pipeline multimedia para recursos/ -> public/."
    )
    parser.add_argument(
        "--only",
        help="Lista separada por comas de pasos a ejecutar. Opciones: imagenes,videos,audios,svg,og,favicon",
    )
    parser.add_argument("--force", action="store_true", help="Reprocesa todo.")
    parser.add_argument("--quiet", action="store_true", help="Reduce la salida.")
    parser.add_argument("--source", help="Carpeta de origen. Default: recursos")
    parser.add_argument("--dest", help="Carpeta de destino. Default: public")
    return parser.parse_args(argv)


def parse_steps(value: str | None) -> tuple[str, ...]:
    if not value:
        return SUPPORTED_STEPS

    raw_steps = [step.strip().lower() for step in value.split(",") if step.strip()]
    if not raw_steps:
        return SUPPORTED_STEPS

    invalid = sorted(set(raw_steps) - set(SUPPORTED_STEPS))
    if invalid:
        raise PipelineError(
            f"Pasos no soportados: {', '.join(invalid)}. Usa solo: {', '.join(SUPPORTED_STEPS)}"
        )

    seen = set()
    ordered_steps = []
    for step in raw_steps:
        if step in seen:
            continue
        seen.add(step)
        ordered_steps.append(step)
    return tuple(ordered_steps)


def load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key or key in os.environ:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[key] = value


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default

    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise PipelineError(f"{name} debe ser booleano. Valor recibido: {value}")


def env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise PipelineError(f"{name} debe ser entero. Valor recibido: {value}") from exc


def env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError as exc:
        raise PipelineError(
            f"{name} debe ser numerico. Valor recibido: {value}"
        ) from exc


def relative_posix(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def path_is_within(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_outputs(entry: Any) -> list[str]:
    if isinstance(entry, list):
        return [str(item) for item in entry if isinstance(item, str) and item]
    if isinstance(entry, str):
        return [entry]
    if not isinstance(entry, dict):
        return []

    outputs: list[str] = []
    value = entry.get("outputs")
    if isinstance(value, list):
        outputs.extend(str(item) for item in value if isinstance(item, str) and item)

    formatos = entry.get("formatos")
    if isinstance(formatos, list):
        outputs.extend(
            str(item) for item in formatos if isinstance(item, str) and item
        )

    gif = entry.get("gif")
    if isinstance(gif, str) and gif:
        outputs.append(gif)

    deduped = []
    seen = set()
    for output in outputs:
        if output in seen:
            continue
        seen.add(output)
        deduped.append(output)
    return deduped


def image_has_alpha(image: Image.Image) -> bool:
    if image.mode in {"RGBA", "LA"}:
        return True
    if image.mode == "P" and "transparency" in image.info:
        return True
    return False


def output_size_mb(path: Path) -> float:
    return path.stat().st_size / (1024 * 1024)


def temp_output_path(target: Path) -> Path:
    return target.with_name(f".tmp-{target.name}")


def cleanup_temp_files(paths: Iterable[Path]) -> None:
    for path in paths:
        if path.exists():
            path.unlink()


def atomic_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_destination = temp_output_path(destination)
    cleanup_temp_files([temp_destination])
    try:
        shutil.copy2(source, temp_destination)
        temp_destination.replace(destination)
    except Exception:
        cleanup_temp_files([temp_destination])
        raise


def write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = temp_output_path(path)
    cleanup_temp_files([temp_path])
    try:
        with temp_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
        temp_path.replace(path)
    except Exception:
        cleanup_temp_files([temp_path])
        raise


def write_json_file(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    try:
        args = parse_args(argv)
        config = ProcessorConfig.from_args(args)
        processor = MediaProcessor(config)
        processor.run()
        return 0
    except PipelineError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
