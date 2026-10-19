from aiohttp import web
from server import PromptServer

from .preset_compose import compose_final_preset
from .preset_store import load_presets, save_presets

# Register ComfyUI Server Routes
@PromptServer.instance.routes.get("/preset_gallery/presets")
async def get_presets_endpoint(request):
    return web.json_response(load_presets())

@PromptServer.instance.routes.post("/preset_gallery/presets")
async def save_presets_endpoint(request):
    try:
        data = await request.json()
        if save_presets(data):
            return web.json_response({"status": "success"})
        return web.json_response({"status": "error", "message": "Failed to save file"}, status=500)
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)


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
