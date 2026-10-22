import os

from preset_store import (
    DEFAULT_PRESETS_FILE,
    list_libraries,
    load_presets,
    resolve_library_path,
    save_presets,
)


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


# --- libraries ---


def test_the_default_library_is_the_bundled_file():
    assert resolve_library_path(None) == DEFAULT_PRESETS_FILE
    assert resolve_library_path("") == DEFAULT_PRESETS_FILE
    assert resolve_library_path("main") == DEFAULT_PRESETS_FILE


def test_the_legacy_default_id_still_resolves_to_the_bundled_file():
    # Saved workflows from before the rename carry "default"; they must not 404.
    assert resolve_library_path("default") == DEFAULT_PRESETS_FILE


def test_a_library_id_resolves_to_a_file_in_the_presets_folder(tmp_path, monkeypatch):
    monkeypatch.setattr("preset_store.PRESETS_DIR", str(tmp_path))
    (tmp_path / "sample.json").write_text("{}", encoding="utf-8")
    assert resolve_library_path("sample") == str(tmp_path / "sample.json")


def test_a_library_id_cannot_escape_the_presets_folder(tmp_path, monkeypatch):
    monkeypatch.setattr("preset_store.PRESETS_DIR", str(tmp_path))
    outside = tmp_path.parent / "elsewhere.json"
    outside.write_text("{}", encoding="utf-8")
    # the id is used as a bare filename stem, so separators cannot reach out
    assert resolve_library_path("../../elsewhere") is None
    assert resolve_library_path("elsewhere") is None


def test_an_unknown_library_id_does_not_resolve(tmp_path, monkeypatch):
    monkeypatch.setattr("preset_store.PRESETS_DIR", str(tmp_path))
    assert resolve_library_path("nope") is None


def test_list_libraries_puts_the_default_first_then_the_folder_sorted(tmp_path, monkeypatch):
    monkeypatch.setattr("preset_store.PRESETS_DIR", str(tmp_path))
    (tmp_path / "zeta.json").write_text("{}", encoding="utf-8")
    (tmp_path / "alpha.json").write_text("{}", encoding="utf-8")
    (tmp_path / "notes.txt").write_text("not a library", encoding="utf-8")

    libraries = list_libraries()
    assert [(lib["id"], lib["default"]) for lib in libraries] == [
        ("main", True),
        ("alpha", False),
        ("zeta", False),
    ]
    # the id is the filename stem, so a dropped file needs no registration
    assert libraries[1]["name"] == "Alpha"


def test_list_libraries_survives_a_missing_folder(tmp_path, monkeypatch):
    monkeypatch.setattr("preset_store.PRESETS_DIR", str(tmp_path / "absent"))
    assert list_libraries() == [
        {"id": "main", "name": "Main", "default": True}
    ]
