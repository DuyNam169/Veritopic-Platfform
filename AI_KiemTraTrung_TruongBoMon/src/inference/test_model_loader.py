import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from src.inference import model_loader


class ModelLoaderTests(unittest.TestCase):
    def test_rejects_missing_directory_and_empty_checkpoints(self):
        with tempfile.TemporaryDirectory() as directory:
            checkpoint = Path(directory) / "tier1_best.pt"
            with patch.object(model_loader, "MODEL_PATH", checkpoint):
                with self.assertRaises(FileNotFoundError):
                    model_loader.validate_checkpoint()
                checkpoint.mkdir()
                with self.assertRaises(FileNotFoundError):
                    model_loader.validate_checkpoint()
                checkpoint.rmdir()
                checkpoint.touch()
                with self.assertRaises(FileNotFoundError):
                    model_loader.validate_checkpoint()
                checkpoint.write_bytes(b"checkpoint")
                model_loader.validate_checkpoint()

    @patch.object(model_loader, "validate_checkpoint")
    @patch.object(model_loader.torch, "load")
    @patch.object(model_loader, "SiamesePhoBERT")
    def test_failed_load_is_not_cached_and_next_request_retries(
        self, constructor, load, _validate
    ):
        failed_model, ready_model = Mock(), Mock()
        failed_model.load_state_dict.side_effect = RuntimeError("bad checkpoint")
        constructor.side_effect = [failed_model, ready_model]
        with patch.object(model_loader, "_model", None), patch.object(model_loader, "MODEL_MODE", "checkpoint"):
            with self.assertRaises(RuntimeError):
                model_loader.get_model()
            self.assertIsNone(model_loader._model)
            self.assertIs(model_loader.get_model(), ready_model)
            self.assertIs(model_loader.get_model(), ready_model)
            self.assertEqual(constructor.call_count, 2)
            ready_model.to.assert_called_once_with(model_loader.get_device())
            ready_model.eval.assert_called_once_with()
            self.assertTrue(load.call_args.kwargs["weights_only"])

    @patch.object(model_loader, "validate_checkpoint")
    @patch.object(model_loader.torch, "load")
    @patch.object(model_loader, "SiamesePhoBERT")
    def test_pretrained_mode_does_not_require_a_checkpoint(self, constructor, load, validate):
        with patch.object(model_loader, "_model", None), patch.object(model_loader, "MODEL_MODE", "pretrained"):
            self.assertIs(model_loader.get_model(), constructor.return_value)
            self.assertIs(model_loader.get_model(), constructor.return_value)
        constructor.assert_called_once_with(model_loader.MODEL_NAME)
        constructor.return_value.eval.assert_called_once_with()
        load.assert_not_called()
        validate.assert_not_called()
