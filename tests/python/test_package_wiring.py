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

    assert [path for path, _ in host_routes.registered["GET"]] == ["/preset_gallery/presets"]
    assert [path for path, _ in host_routes.registered["POST"]] == ["/preset_gallery/presets"]


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
