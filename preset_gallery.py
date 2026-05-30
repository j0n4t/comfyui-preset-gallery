import os
import shutil
import zipfile
from io import BytesIO
from aiohttp import web
from server import PromptServer

# Configuration
POOL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "presets_pool")
os.makedirs(POOL_DIR, exist_ok=True)
VALID_IMAGES = ('.jpg', '.jpeg', '.png', '.webp', '.bmp')

def _prune_empty_directories(start_path):
    """
    Recursively walks up from start_path and removes empty directories 
    until it hits POOL_DIR or a directory that isn't empty.
    """
    current_dir = os.path.dirname(os.path.abspath(start_path))
    pool_root = os.path.abspath(POOL_DIR)
    
    while current_dir and current_dir != pool_root:
        if current_dir.startswith(pool_root):
            if not os.listdir(current_dir):
                try:
                    os.rmdir(current_dir)
                except OSError:
                    break
                current_dir = os.path.dirname(current_dir)
            else:
                break
        else:
            break

def get_live_presets():
    """Scans the pool directory and builds a catalog using lowercased, snake_case paths as keys."""
    presets = {}
    if not os.path.exists(POOL_DIR):
        return presets
    
    for root, _, files in os.walk(POOL_DIR):
        for file in files:
            if not file.lower().endswith('.txt'):
                continue
                
            file_path = os.path.join(root, file)
            rel_dir = os.path.relpath(root, POOL_DIR)
            
            base_name_clean = file[:-4].lower().replace(" ", "_")
            
            if rel_dir == ".":
                tags = []
                unique_key = base_name_clean
            else:
                normalized_path = rel_dir.lower().replace("\\", "/").replace(" ", "_")
                tags = [t.strip() for t in normalized_path.split("/") if t.strip()]
                unique_key = f"{normalized_path}/{base_name_clean}"
            
            with open(file_path, "r", encoding="utf-8") as f:
                preset_content = f.read().strip() or base_name_clean.replace("_", " ")
            
            img_filename = None
            for ext in VALID_IMAGES:
                potential_img = os.path.join(root, f"{file[:-4]}{ext}")
                if os.path.exists(potential_img):
                    img_filename = f"{unique_key}{ext}"
                    break
            
            presets[unique_key] = {
                "preset": preset_content, 
                "filename": img_filename,
                "tags": tags
            }
    return presets

class PresetGalleryNode:
    @classmethod
    def INPUT_TYPES(cls):
        presets = list(get_live_presets().keys()) or ["no_presets_found"]
        return {
            "required": {
                "preset_selection": ("STRING", {"default": "", "multiline": True})
            },
            "optional": {
                "base_preset": ("STRING", {"forceInput": True, "default": ""})
            }
        }
        
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("final_preset",)
    FUNCTION = "get_preset"
    CATEGORY = "utils"
    
    def get_preset(self, preset_selection, base_preset=""):
        live_pool = get_live_presets()
        selected_keys = [k.strip().lower().replace(" ", "_") for k in preset_selection.split(",") if k.strip()]
        collected = [live_pool[k]["preset"].strip() for k in selected_keys if k in live_pool]
        gallery_text = ", ".join(collected)
        
        if base_preset and base_preset.strip():
            clean_base = base_preset.strip().rstrip(',')
            return (f"{clean_base}, {gallery_text}",)
            
        return (gallery_text,)

# --- HTTP Routes ---

@PromptServer.instance.routes.get("/custom_node/live_preset_gallery")
async def api_get_gallery(request): 
    return web.json_response(get_live_presets())

@PromptServer.instance.routes.get("/custom_node/get_preset_image")
async def api_get_image(request):
    filename = request.query.get("filename", "")
    if not filename: 
        return web.Response(status=404)
        
    path = os.path.abspath(os.path.join(POOL_DIR, filename))
    if not path.startswith(os.path.abspath(POOL_DIR)) or not os.path.exists(path): 
        return web.Response(status=404)
        
    return web.FileResponse(path)

@PromptServer.instance.routes.post("/custom_node/save_preset_item")
async def api_save_item(request):
    data = await request.post()
    name = data.get("preset_name", "").strip().lower().replace(" ", "_")
    subfolder = data.get("subfolder", "").strip().lower().replace(" ", "_")
    overwrite = data.get("overwrite", "true").lower() == "true"
    clear_image = data.get("clear_image", "false").lower() == "true"
    
    if not name: 
        return web.json_response({"success": False, "error": "Invalid name"})
    
    target_dir = os.path.join(POOL_DIR, subfolder) if subfolder else POOL_DIR
    target_txt_path = os.path.join(target_dir, f"{name}.txt")
    
    if os.path.exists(target_txt_path) and not overwrite:
        return web.json_response({"success": False, "error": "File collision detected"})

    os.makedirs(target_dir, exist_ok=True)
    
    with open(target_txt_path, "w", encoding="utf-8") as f:
        f.write(data.get("preset_text", "").strip())
        
    img = data.get("image_file")
    if img and img.file:
        for ext in VALID_IMAGES:
            old_img = os.path.join(target_dir, f"{name}{ext}")
            if os.path.exists(old_img):
                os.remove(old_img)
                
        ext = os.path.splitext(img.filename)[1].lower() or ".jpg"
        if ext not in VALID_IMAGES:
            ext = ".jpg"
        with open(os.path.join(target_dir, f"{name}{ext}"), "wb") as f: 
            shutil.copyfileobj(img.file, f)
            
    elif clear_image:
        for ext in VALID_IMAGES:
            target_img_path = os.path.join(target_dir, f"{name}{ext}")
            if os.path.exists(target_img_path):
                os.remove(target_img_path)
                _prune_empty_directories(target_img_path)
            
    unique_key = f"{subfolder}/{name}" if subfolder else name
    return web.json_response({"success": True, "unique_key": unique_key})

@PromptServer.instance.routes.post("/custom_node/delete_preset_item")
async def api_delete_item(request):
    data = await request.json()
    unique_key = data.get("unique_key", "").strip().lower().replace(" ", "_")
    live_pool = get_live_presets()
    
    if unique_key in live_pool:
        extensions = [".txt"] + list(VALID_IMAGES)
        for ext in extensions:
            file_path = os.path.join(POOL_DIR, f"{unique_key}{ext}")
            if os.path.exists(file_path): 
                os.remove(file_path)
                _prune_empty_directories(file_path)
                
    return web.json_response({"success": True})

@PromptServer.instance.routes.get("/custom_node/export_presets_zip")
async def api_export_zip(request):
    try:
        memory_zip = BytesIO()
        with zipfile.ZipFile(memory_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(POOL_DIR):
                for file in files:
                    fp = os.path.join(root, file)
                    zf.write(fp, arcname=os.path.relpath(fp, POOL_DIR))
        memory_zip.seek(0)
        return web.Response(
            body=memory_zip.read(), 
            content_type="application/zip", 
            headers={"Content-Disposition": "attachment; filename=presets_export.zip"}
        )
    except Exception as e: 
        return web.Response(text=str(e), status=500)

@PromptServer.instance.routes.post("/custom_node/import_presets_zip")
async def api_import_zip(request):
    try:
        data = await request.post()
        zip_file = data.get("zip_file")
        if not zip_file or not zip_file.file: 
            return web.json_response({"success": False, "error": "No file metadata provided"})
            
        memory_zip = BytesIO(zip_file.file.read())
        with zipfile.ZipFile(memory_zip, "r") as zf:
            for member in zf.namelist():
                if member.endswith("/") or "__MACOSX" in member: 
                    continue
                target_path = os.path.abspath(os.path.join(POOL_DIR, member))
                if not target_path.startswith(os.path.abspath(POOL_DIR)): 
                    continue
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                with open(target_path, "wb") as target: 
                    shutil.copyfileobj(zf.open(member), target)
                    
        return web.json_response({"success": True})
    except Exception as e: 
        return web.json_response({"success": False, "error": str(e)})

NODE_CLASS_MAPPINGS = {"PresetGalleryNode": PresetGalleryNode}
NODE_DISPLAY_NAME_MAPPINGS = {"PresetGalleryNode": "Preset Gallery"}