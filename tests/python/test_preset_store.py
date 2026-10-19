import os

from preset_store import DEFAULT_PRESETS_FILE, load_presets, save_presets


def test_load_missing_file_returns_an_empty_library(tmp_path):
    assert load_presets(str(tmp_path / "absent.json")) == {}


def test_save_then_load_round_trips(tmp_path):
    path = str(tmp_path / "presets.json")
    library = {"Faces/Portrait": {"preset": "portrait, studio"}}
    assert save_presets(library, path) is True
    assert load_presets(path) == library


def test_saved_file_is_indented_and_keeps_non_ascii_readable(tmp_path):
    path = str(tmp_path / "presets.json")
    save_presets({"Faces/Émile": {"preset": "café"}}, path)
    raw = open(path, encoding="utf-8").read()
    assert "\n  " in raw          # indent=2
    assert "café" in raw          # ensure_ascii=False
    assert "\\u00e9" not in raw


def test_corrupt_file_reads_as_an_empty_library(tmp_path):
    path = tmp_path / "presets.json"
    path.write_text("{ this is not json", encoding="utf-8")
    assert load_presets(str(path)) == {}


def test_corrupt_file_is_silently_replaced_by_the_next_save(tmp_path):
    # Pins the data-loss path. load_presets cannot tell "missing" from
    # "corrupt", and the frontend POSTs the whole library back on any edit, so
    # a corrupt file is overwritten by whatever the UI happens to be holding.
    path = tmp_path / "presets.json"
    path.write_text("{ this is not json", encoding="utf-8")
    assert load_presets(str(path)) == {}

    save_presets({"Faces/Portrait": {"preset": "p"}}, str(path))
    assert load_presets(str(path)) == {"Faces/Portrait": {"preset": "p"}}


def test_save_reports_failure_instead_of_raising(tmp_path):
    unwritable = str(tmp_path / "no" / "such" / "dir" / "presets.json")
    assert save_presets({}, unwritable) is False


def test_default_path_points_at_the_repo_library():
    assert os.path.basename(DEFAULT_PRESETS_FILE) == "presets.json"
    assert os.path.isdir(os.path.dirname(DEFAULT_PRESETS_FILE))
    assert os.path.isfile(os.path.join(os.path.dirname(DEFAULT_PRESETS_FILE), "__init__.py"))
