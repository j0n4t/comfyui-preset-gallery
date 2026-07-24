import os
import json
from aiohttp import web
from server import PromptServer

# File path to save the presets JSON file
PRESETS_FILE = os.path.join(os.path.dirname(os.path.realpath(__file__)), "presets.json")

def load_presets_from_file():
    if os.path.exists(PRESETS_FILE):
        try:
            with open(PRESETS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[PresetGallery] Error reading presets.json: {e}")
    return {}

def save_presets_to_file(data):
    try:
        with open(PRESETS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[PresetGallery] Error writing presets.json: {e}")
        return False

# Register ComfyUI Server Routes
@PromptServer.instance.routes.get("/preset_gallery/presets")
async def get_presets_endpoint(request):
    return web.json_response(load_presets_from_file())

@PromptServer.instance.routes.post("/preset_gallery/presets")
async def save_presets_endpoint(request):
    try:
        data = await request.json()
        if save_presets_to_file(data):
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
                "base_preset": ("STRING", {"forceInput": True, "default": ""})
            }
        }
    
    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("final_preset",)
    FUNCTION = "get_preset"
    CATEGORY = "utils"
    
    def get_preset(self, preset_selection, base_preset=""):
        parts = [p.strip() for p in [base_preset, preset_selection] if p and p.strip()]
        final_preset = ", ".join(parts)
        return (final_preset,)

NODE_CLASS_MAPPINGS = {
    "PresetGalleryNode": PresetGalleryNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PresetGalleryNode": "Preset Gallery"
}