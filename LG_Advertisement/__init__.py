import os
import shutil
import time
import requests
import aiohttp
from aiohttp import web
from server import PromptServer

import ssl
ssl._create_default_https_context = ssl._create_unverified_context

routes = PromptServer.instance.routes


def generate_unique_filename(original_filename):
    timestamp = int(time.time() * 1000)
    name, ext = os.path.splitext(original_filename)
    return f"{name}_{timestamp}{ext}"

@routes.post("/proxy_download")
async def proxy_download(request):
    try:
        json_data = await request.json()
        url = json_data.get("url").strip() 

        dest_folder = os.path.join(os.getcwd(), "input", "image_display")
        os.makedirs(dest_folder, exist_ok=True)

        original_filename = url.split('/')[-1] or "image.jpg"
        unique_filename = generate_unique_filename(original_filename)
        dest_path = os.path.join(dest_folder, unique_filename)

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        response = requests.get(url, headers=headers, verify=False)
        response.raise_for_status()

        with open(dest_path, 'wb') as f:
            f.write(response.content)

        return web.json_response({
            "status": "ok",
            "name": unique_filename,
            "path": f"input/image_display/{unique_filename}"
        })

    except Exception as e:
        return web.json_response({
            "status": "error",
            "message": str(e)
        })

@routes.post("/upload_from_path")
async def upload_from_path(request):
    try:
        json_data = await request.json()
        
        source_path = json_data.get("path")
        subfolder = json_data.get("subfolder", "image_display")
        type_folder = json_data.get("type", "input")
        is_relative = json_data.get("relative", False)

        if is_relative:
            base_path = os.getcwd()
            source_path = os.path.join(base_path, source_path)

        source_path = os.path.abspath(source_path)

        if not os.path.exists(source_path):
            return web.json_response({
                "status": "error",
                "message": f"文件不存在: {source_path}"
            })

        dest_folder = os.path.join(os.getcwd(), type_folder, subfolder)
        os.makedirs(dest_folder, exist_ok=True)

        filename = os.path.basename(source_path)
        dest_path = os.path.join(dest_folder, filename)

        if os.path.exists(dest_path):
            try:
                if os.path.samefile(source_path, dest_path):
                    return web.json_response({
                        "status": "ok",
                        "name": filename,
                        "path": f"{type_folder}/{subfolder}/{filename}"
                    })
            except Exception:
                pass

        shutil.copy2(source_path, dest_path)

        return web.json_response({
            "status": "ok",
            "name": filename,
            "path": f"{type_folder}/{subfolder}/{filename}"
        })

    except Exception as e:
        return web.json_response({
            "status": "error",
            "message": str(e)
        })

WEB_DIRECTORY = "web"
# 注册节点
NODE_CLASS_MAPPINGS = {
}

NODE_DISPLAY_NAME_MAPPINGS = {
}
