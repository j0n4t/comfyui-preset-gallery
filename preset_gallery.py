import os

from aiohttp import web
from server import PromptServer

from .preset_compose import compose_final_preset
from .preset_store import (
    DEFAULT_LIBRARY_ID,
    DEFAULT_PRESETS_FILE,
    list_libraries,
    load_presets,
    resolve_library_path,
    save_presets,
)


def _requested_path(request):
    """The file behind `?library=`, or None when that id is not served."""
    return resolve_library_path(request.query.get("library") or DEFAULT_LIBRARY_ID)


# Register ComfyUI Server Routes
@PromptServer.instance.routes.get("/preset_gallery/libraries")
async def list_libraries_endpoint(request):
    return web.json_response(list_libraries())


@PromptServer.instance.routes.get("/preset_gallery/presets")
async def get_presets_endpoint(request):
    path = _requested_path(request)
    if path is None:
        return web.json_response(
            {"status": "error", "message": "Unknown library"}, status=404
        )
    return web.json_response(load_presets(path))


@PromptServer.instance.routes.post("/preset_gallery/presets")
async def save_presets_endpoint(request):
    path = _requested_path(request)
    if path is None:
        return web.json_response(
            {"status": "error", "message": "Unknown library"}, status=404
        )
    try:
        data = await request.json()
    except Exception:
        return web.json_response(
            {"status": "error", "message": "Failed to read the request body"}, status=400
        )
    if save_presets(data, path):
        return web.json_response({"status": "success"})
    return web.json_response({"status": "error", "message": "Failed to save file"}, status=500)


@PromptServer.instance.routes.delete("/preset_gallery/presets")
async def delete_library_endpoint(request):
    """Remove a whole library.

    Only an empty one: the bundled library is never removed, and a library that
    still holds presets is refused. The frontend only asks when it has just
    emptied one, so this is the guard behind that.
    """
    path = _requested_path(request)
    if path is None:
        return web.json_response(
            {"status": "error", "message": "Unknown library"}, status=404
        )
    if path == DEFAULT_PRESETS_FILE:
        return web.json_response(
            {"status": "error", "message": "The bundled library cannot be removed"},
            status=400,
        )
    if load_presets(path):
        return web.json_response(
            {"status": "error", "message": "Library is not empty"}, status=409
        )
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    return web.json_response({"status": "success"})


class PresetGalleryNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "preset_selection": ("STRING", {"default": "", "multiline": True})
            },
            "optional": {
                "base_preset": ("STRING", {"forceInput": True, "default": ""}),
                "evaluated_preset": ("STRING", {"default": "", "multiline": True})
            }
        }

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        # NaN != NaN, so ComfyUI re-executes this node on every queue. That is
        # what makes roll-on-generation produce a fresh selection each run; a
        # constant here would silently freeze the rolls.
        return float("NaN")

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("final_preset",)
    FUNCTION = "get_preset"
    CATEGORY = "utils"

    def get_preset(self, preset_selection, base_preset="", evaluated_preset=""):
        return (compose_final_preset(preset_selection, base_preset, evaluated_preset),)

NODE_CLASS_MAPPINGS = {
    "PresetGalleryNode": PresetGalleryNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PresetGalleryNode": "Preset Gallery"
}
