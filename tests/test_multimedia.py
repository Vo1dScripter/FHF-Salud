from __future__ import annotations

import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

import multimedia


def create_image(path: Path, color: tuple[int, int, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (160, 120), color)
    image.save(path, format="PNG")
    image.close()


class MultimediaPipelineTests(unittest.TestCase):
    def create_processor(
        self,
        source: Path,
        dest: Path,
        *,
        selected_steps: tuple[str, ...] = multimedia.SUPPORTED_STEPS,
    ) -> multimedia.MediaProcessor:
        config = multimedia.ProcessorConfig(
            source=source,
            dest=dest,
            selected_steps=selected_steps,
            verbose=False,
        )
        processor = multimedia.MediaProcessor(config)
        processor.ensure_destinations()
        return processor

    def test_load_manifest_migrates_legacy_format(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "recursos"
            dest = root / "public"
            source.mkdir()
            (dest / "registros").mkdir(parents=True, exist_ok=True)
            legacy_path = dest / "registros" / "imagenes.json"
            legacy_payload = {"hero.png": ["imagenes/hero.jpg", "imagenes/hero.webp"]}
            legacy_path.write_text(json.dumps(legacy_payload), encoding="utf-8")

            processor = self.create_processor(source, dest, selected_steps=("imagenes",))
            manifest = processor.load_manifest("imagenes")

            self.assertIn("hero.png", manifest)
            self.assertEqual(
                manifest["hero.png"]["outputs"],
                ["imagenes/hero.jpg", "imagenes/hero.webp"],
            )

    def test_process_imagenes_reprocesses_when_source_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "recursos"
            dest = root / "public"
            image_path = source / "imagenes" / "hero.png"
            create_image(image_path, (255, 120, 0))

            processor = self.create_processor(source, dest, selected_steps=("imagenes",))
            processor.process_imagenes()

            manifest_path = dest / "registros" / "imagenes.json"
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
            first_entry = manifest_data["entries"]["hero.png"]
            first_hash = first_entry["source_hash"]

            create_image(image_path, (0, 140, 255))
            processor = self.create_processor(source, dest, selected_steps=("imagenes",))
            processor.process_imagenes()

            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
            second_entry = manifest_data["entries"]["hero.png"]
            second_hash = second_entry["source_hash"]

            self.assertNotEqual(first_hash, second_hash)
            for output in second_entry["outputs"]:
                self.assertTrue((dest / output).exists(), output)

    def test_process_og_reprocesses_when_same_named_source_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "recursos"
            dest = root / "public"
            og_source = source / "og" / "og.jpg"
            create_image(og_source, (255, 120, 0))

            processor = self.create_processor(source, dest, selected_steps=("og",))
            processor.process_og()

            manifest_path = dest / "registros" / "og.json"
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
            first_hash = manifest_data["entries"]["og.jpg"]["source_hash"]

            create_image(og_source, (0, 140, 255))
            processor = self.create_processor(source, dest, selected_steps=("og",))
            processor.process_og()

            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
            second_entry = manifest_data["entries"]["og.jpg"]

            self.assertNotEqual(first_hash, second_entry["source_hash"])
            self.assertTrue((dest / "og" / "og.jpg").exists())

    def test_process_og_keeps_new_shared_output_when_previous_source_is_removed(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "recursos"
            dest = root / "public"
            first_source = source / "og" / "first.png"
            second_source = source / "og" / "second.png"
            create_image(first_source, (255, 120, 0))

            processor = self.create_processor(source, dest, selected_steps=("og",))
            processor.process_og()

            first_source.unlink()
            create_image(second_source, (0, 140, 255))
            processor = self.create_processor(source, dest, selected_steps=("og",))
            processor.process_og()

            manifest_path = dest / "registros" / "og.json"
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))

            self.assertEqual(set(manifest_data["entries"]), {"second.png"})
            self.assertEqual(
                manifest_data["entries"]["second.png"]["outputs"],
                ["og/og.jpg"],
            )
            self.assertTrue((dest / "og" / "og.jpg").exists())

    def test_process_favicon_generates_expected_assets(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "recursos"
            dest = root / "public"
            favicon_source = source / "favicon" / "icon.png"
            create_image(favicon_source, (40, 90, 220))

            processor = self.create_processor(source, dest, selected_steps=("favicon",))
            processor.process_favicon()

            expected = {
                "favicon/favicon-16x16.png",
                "favicon/favicon-32x32.png",
                "favicon/apple-touch-icon.png",
                "favicon/android-chrome-192x192.png",
                "favicon/android-chrome-512x512.png",
                "favicon/favicon.ico",
                "favicon/site.webmanifest",
            }

            manifest_path = dest / "registros" / "favicon.json"
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
            entry = manifest_data["entries"]["icon.png"]
            self.assertEqual(set(entry["outputs"]), expected)
            for output in expected:
                self.assertTrue((dest / output).exists(), output)

    def test_process_favicon_keeps_new_shared_outputs_when_previous_source_is_removed(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "recursos"
            dest = root / "public"
            first_source = source / "favicon" / "first.png"
            second_source = source / "favicon" / "second.png"
            create_image(first_source, (40, 90, 220))

            processor = self.create_processor(source, dest, selected_steps=("favicon",))
            processor.process_favicon()

            first_source.unlink()
            create_image(second_source, (220, 90, 40))
            processor = self.create_processor(source, dest, selected_steps=("favicon",))
            processor.process_favicon()

            expected = {
                "favicon/favicon-16x16.png",
                "favicon/favicon-32x32.png",
                "favicon/apple-touch-icon.png",
                "favicon/android-chrome-192x192.png",
                "favicon/android-chrome-512x512.png",
                "favicon/favicon.ico",
                "favicon/site.webmanifest",
            }

            manifest_path = dest / "registros" / "favicon.json"
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(set(manifest_data["entries"]), {"second.png"})
            self.assertEqual(
                set(manifest_data["entries"]["second.png"]["outputs"]),
                expected,
            )
            for output in expected:
                self.assertTrue((dest / output).exists(), output)

    def test_process_audios_ignores_unsupported_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "recursos"
            dest = root / "public"
            audio_file = source / "audios" / "track.mp3"
            ignored_file = source / "audios" / "notes.txt"
            audio_file.parent.mkdir(parents=True, exist_ok=True)
            audio_file.write_bytes(b"audio-placeholder")
            ignored_file.write_text("metadata", encoding="utf-8")

            processor = self.create_processor(source, dest, selected_steps=("audios",))
            processor.process_audios()

            manifest_path = dest / "registros" / "audios.json"
            manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))

            self.assertEqual(set(manifest_data["entries"]), {"track.mp3"})
            self.assertTrue((dest / "audios" / "track.mp3").exists())
            self.assertFalse((dest / "audios" / "notes.txt").exists())

    def test_run_command_surfaces_ffmpeg_errors(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "recursos"
            dest = root / "public"
            source.mkdir()
            processor = self.create_processor(source, dest, selected_steps=("videos",))

            with patch("subprocess.run") as mocked_run:
                mocked_run.side_effect = subprocess.CalledProcessError(
                    returncode=1,
                    cmd=["ffmpeg"],
                    stderr="detalle ffmpeg",
                )
                with self.assertRaises(multimedia.PipelineError) as ctx:
                    processor.run_command(["ffmpeg"], label="video-test")

            self.assertIn("video-test", str(ctx.exception))
            self.assertIn("detalle ffmpeg", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
