"""Guards the ComfyUI wiring without needing ComfyUI installed.

`preset_gallery.py` imports aiohttp and ComfyUI's `server` module at module
scope, so it cannot be imported on its own - the same host-coupling the JS side
had with scripts/app.js. `conftest.py` stubs both, and the package is loaded
here the way ComfyUI loads it, as a package, so the relative imports inside
`preset_gallery.py` resolve.

The root `__init__.py` tolerates a missing host so pytest's own incidental
import of it does not explode; this test asserts the registered node instead.

Whether ComfyUI actually calls these hooks is the live smoke test's job.
"""

import asyncio
import importlib.util
import os
import sys

PACKAGE_NAME = "preset_gallery_under_test"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _load_package():
    init_path = os.path.join(REPO_ROOT, "__init__.py")
    spec = importlib.util.spec_from_file_location(
        PACKAGE_NAME, init_path, submodule_search_locations=[REPO_ROOT]
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[PACKAGE_NAME] = module
    spec.loader.exec_module(module)
    return module


def test_package_exposes_its_web_directory():
    module = _load_package()
    assert module.WEB_DIRECTORY == "./web"


def test_node_registers_itself():
    module = _load_package()

    assert "PresetGalleryNode" in module.NODE_CLASS_MAPPINGS
    assert module.NODE_DISPLAY_NAME_MAPPINGS["PresetGalleryNode"] == "Preset Gallery"


def test_routes_register_at_import_time(host_routes):
    _load_package()

    assert [path for path, _ in host_routes.registered["GET"]] == [
        "/preset_gallery/libraries",
        "/preset_gallery/presets",
    ]
    assert [path for path, _ in host_routes.registered["POST"]] == ["/preset_gallery/presets"]
    assert [path for path, _ in host_routes.registered["DELETE"]] == [
        "/preset_gallery/presets"
    ]


def test_is_changed_returns_a_value_never_equal_to_itself():
    # This is what forces ComfyUI to re-execute the node on every queue, which
    # is what makes roll-on-generation work. A plain constant here would freeze
    # the rolls and nothing would fail loudly.
    module = _load_package()
    value = module.NODE_CLASS_MAPPINGS["PresetGalleryNode"].IS_CHANGED()
    assert value != value


def test_node_outputs_the_composed_preset():
    module = _load_package()
    node = module.NODE_CLASS_MAPPINGS["PresetGalleryNode"]()

    assert node.RETURN_TYPES == ("STRING",)
    assert node.RETURN_NAMES == ("final_preset",)
    assert node.get_preset("gallery", "upstream") == ("upstream, gallery",)
    assert node.get_preset("raw", "", "expanded") == ("expanded",)


def test_base_preset_is_declared_as_an_input_socket():
    # forceInput means the prepended prompt arrives over a link, not a widget.
    module = _load_package()
    inputs = module.NODE_CLASS_MAPPINGS["PresetGalleryNode"].INPUT_TYPES()

    assert set(inputs["required"]) == {"preset_selection"}
    assert inputs["optional"]["base_preset"][1]["forceInput"] is True
    assert "evaluated_preset" in inputs["optional"]


class _DeleteRequest:
    """Just enough of an aiohttp request for the DELETE route."""

    def __init__(self, library):
        self.query = {"library": library}


def test_deleting_a_library_removes_only_an_empty_one(tmp_path, monkeypatch, host_routes):
    """The DELETE route is the guard behind "remove when empty".

    The frontend only asks once an edit has emptied a library, so the route
    refuses everything else: the bundled library, a library that still holds
    presets, and an id nobody serves.
    """
    _load_package()
    # The package is loaded under a synthetic name, so its `preset_store` is a
    # module of its own - patching the top-level one would miss the route.
    gallery = sys.modules[f"{PACKAGE_NAME}.preset_gallery"]
    store = sys.modules[f"{PACKAGE_NAME}.preset_store"]

    monkeypatch.setattr(store, "PRESETS_DIR", str(tmp_path))
    monkeypatch.setattr(store, "DEFAULT_PRESETS_FILE", str(tmp_path / "main.json"))
    # the DELETE handler compares against the copy it imported
    monkeypatch.setattr(gallery, "DEFAULT_PRESETS_FILE", str(tmp_path / "main.json"))
    (tmp_path / "main.json").write_text(
        '{"Faces/Portrait": {"preset": "p"}}', encoding="utf-8"
    )
    (tmp_path / "socks.json").write_text("{}", encoding="utf-8")
    (tmp_path / "hair.json").write_text(
        '{"hair/long": {"preset": "long"}}', encoding="utf-8"
    )

    endpoint = host_routes.registered["DELETE"][0][1]

    result = asyncio.run(endpoint(_DeleteRequest("socks")))
    assert result["json"][0]["status"] == "success"
    assert not (tmp_path / "socks.json").exists()

    # a library that still holds presets is refused, and left on disk
    result = asyncio.run(endpoint(_DeleteRequest("hair")))
    assert result["json"][0]["status"] == "error"
    assert result["kwargs"]["status"] == 409
    assert (tmp_path / "hair.json").exists()

    # so is the bundled library, even though it is full
    result = asyncio.run(endpoint(_DeleteRequest("main")))
    assert result["json"][0]["status"] == "error"
    assert result["kwargs"]["status"] == 400
    assert (tmp_path / "main.json").exists()

    # and an id nobody serves
    result = asyncio.run(endpoint(_DeleteRequest("ghost")))
    assert result["json"][0]["status"] == "error"
    assert result["kwargs"]["status"] == 404


class _PostRequest:
    """An aiohttp request for the POST route: a library and a JSON body."""

    def __init__(self, library, payload):
        self.query = {"library": library}
        self._payload = payload

    async def json(self):
        return self._payload


class _GetRequest:
    def __init__(self, library):
        self.query = {"library": library}


def test_saving_into_a_library_that_does_not_exist_yet_creates_it(
    tmp_path, monkeypatch, host_routes
):
    """The editor names a library in the folder field (`sdxl#wear/sock`).

    The save is what brings it into being, so the POST route must resolve an id
    that has no file yet - while a GET still 404s rather than inventing one.
    """
    _load_package()
    store = sys.modules[f"{PACKAGE_NAME}.preset_store"]
    monkeypatch.setattr(store, "PRESETS_DIR", str(tmp_path))

    post = host_routes.registered["POST"][0][1]
    get = host_routes.registered["GET"][1][1]

    result = asyncio.run(post(_PostRequest("sdxl", {"wear/sock/ankle": {"preset": "ankle"}})))
    assert result["json"][0]["status"] == "success"
    assert (tmp_path / "sdxl.json").exists()

    # the read now succeeds, and the library is listed
    assert asyncio.run(get(_GetRequest("sdxl")))["json"][0] == {
        "wear/sock/ankle": {"preset": "ankle"}
    }
    listed = asyncio.run(host_routes.registered["GET"][0][1](_GetRequest(None)))
    assert [lib["id"] for lib in listed["json"][0]] == ["main", "sdxl"]

    # an unknown id still 404s on the way in
    result = asyncio.run(get(_GetRequest("ghost")))
    assert result["kwargs"]["status"] == 404
