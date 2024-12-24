import { app } from "../../../scripts/app.js";
import { api } from "../../scripts/api.js";

class BaseNode extends LGraphNode {
    static defaultComfyClass = "BaseNode"; 
     constructor(title, comfyClass) {
        super(title);
        this.isVirtualNode = false;
        this.configuring = false;
        this.__constructed__ = false;
        this.widgets = this.widgets || [];
        this.properties = this.properties || {};

        this.comfyClass = comfyClass || this.constructor.comfyClass || BaseNode.defaultComfyClass;
         setTimeout(() => {
            this.checkAndRunOnConstructed();
        });
    }

    checkAndRunOnConstructed() {
        if (!this.__constructed__) {
            this.onConstructed();
        }
        return this.__constructed__;
    }

    onConstructed() {
        if (this.__constructed__) return false;
        this.type = this.type ?? undefined;
        this.__constructed__ = true;
        return this.__constructed__;
    }

    configure(info) {
        this.configuring = true;
        super.configure(info);
        for (const w of this.widgets || []) {
            w.last_y = w.last_y || 0;
        }
        this.configuring = false;
    }
    static setUp() {
        if (!this.type) {
            throw new Error(`Missing type for ${this.name}: ${this.title}`);
        }
        LiteGraph.registerNodeType(this.type, this);
        if (this._category) {
            this.category = this._category;
        }
    }
}


class ImageDisplayNode extends BaseNode {
    static type = "Advertisement";
    static title = "Advertisement";
    static category = "🎈LAOGOU";
    static _category = "🎈LAOGOU";
    static comfyClass = "Advertisement";
     constructor(title = ImageDisplayNode.title) {
        super(title, ImageDisplayNode.comfyClass); 
        this.comfyClass = "Advertisement";
        this.resizable = true;
        this.size = [200, 200];
        this.media = null; 
        this.mediaType = null; 
        this.isVirtualNode = true;
        
        // 设置节点属性
        this.properties = {
            borderRadius: 0,
            backgroundColor: "transparent",
            padding: 0,
            fitMode: "contain",
            flipH: false,
            flipV: false,
            autoplay: true,
            loop: true,
            mediaSource: "",
            volume: 0,    
        };

        // 移除默认标题栏
        this.flags = {
            showTitle: false
        };

        // 设置节点颜色为透明
        this.color = "transparent";
        this.bgcolor = "transparent";
        
        this.onConstructed();
        this.isDraggingOver = false;
        this.gifPlayer = null;
        this.scriptPath = import.meta.url;
    }
    setProperty(name, value) {
        super.setProperty(name, value);
        
        if (name === "mediaSource" && value) {
            this.handleMediaSource(value).catch(error => {
                console.error("处理媒体源失败:", error);
                alert("处理媒体源失败: " + error.message);
            });
        }
    }

    async handleMediaSource(source) {
        try {
            let file;
            
            if (source.startsWith('http://') || source.startsWith('https://')) {
                // 处理网络地址
                console.log('开始下载网络文件:', source);
                
                // 通过后端代理下载
                const response = await api.fetchApi('/proxy_download', {
                    method: 'POST',
                    body: JSON.stringify({
                        url: source
                    })
                });

                const data = await response.json();
                if (data.status === "error") {
                    throw new Error(data.message || '下载文件失败');
                }

                // 获取已下载的文件
                const fileResponse = await fetch(this.getViewPath(`input/image_display/${data.name}`));
                if (!fileResponse.ok) {
                    throw new Error('无法加载已下载的文件');
                }
                
                const blob = await fileResponse.blob();
                file = new File([blob], data.name, { type: this.getMimeTypeFromUrl(data.name) });
                
            } else {
                const cleanPath = source.trim()
                    .replace(/[\r\n]+/g, '')
                    .replace(/^["']|["']$/g, '');  // 去除开头和结尾的引号
                
                // 处理相对路径
                let fullPath = cleanPath;
                const isRelativePath = !cleanPath.match(/^([A-Za-z]:|\/)/) && 
                                     !cleanPath.includes('/input/image_display/') && 
                                     !cleanPath.includes('\\input\\image_display\\');
                
                if (isRelativePath) {
                    // 如果是相对路径，去掉可能存在的 './'
                    fullPath = cleanPath.startsWith('./') ? cleanPath.slice(2) : cleanPath;
                }
                
                console.log('开始处理文件:', fullPath, isRelativePath ? '(相对路径)' : '(绝对路径)');
                
                // 检查文件是否已经在目标文件夹中
                const fileName = fullPath.split(/[\\/]/).pop();
                const targetPath = `input/image_display/${fileName}`;
                
                // 如果文件已经在目标文件夹中，直接使用
                if (cleanPath.includes('/input/image_display/') || cleanPath.includes('\\input\\image_display\\')) {
                    console.log('文件已在目标文件夹中，直接使用');
                    const fileResponse = await fetch(this.getViewPath(`input/image_display/${fileName}`));
                    if (!fileResponse.ok) {
                        throw new Error('无法加载文件');
                    }
                    
                    const blob = await fileResponse.blob();
                    const mimeType = this.getMimeTypeFromUrl(fileName);
                    file = new File([blob], fileName, { type: mimeType });
                    

                    if (file.type.startsWith('video/')) {
                        await this.loadVideo(file);
                    } else if (file.type.startsWith('image/')) {
                        if (file.type === 'image/gif') {
                            await this.loadGif(file);
                        } else {
                            await this.loadImage(file);
                        }
                    }
                    return; 
                }

                const response = await api.fetchApi('/upload_from_path', {
                    method: 'POST',
                    body: JSON.stringify({
                        path: fullPath,
                        subfolder: 'image_display',
                        type: 'input',
                        relative: isRelativePath
                    })
                });
    
                const data = await response.json();
                if (data.status === "error") {
                    throw new Error(data.message || '处理本地文件失败');
                }
    
                // 获取复制后的文件
                const fileResponse = await fetch(this.getViewPath(`input/image_display/${fileName}`));
                if (!fileResponse.ok) {
                    throw new Error('无法加载文件');
                }
                
                const blob = await fileResponse.blob();
                const mimeType = this.getMimeTypeFromUrl(fileName);
                file = new File([blob], fileName, { type: mimeType });
            }
    
            // 保存和加载媒体
            console.log('开始保存文件:', file.name);
            const savedPath = await this.saveMediaToTemp(file);
            if (!savedPath) {
                throw new Error('保存文件失败');
            }
    
            // 根据文件类型加载媒体
            if (file.type.startsWith('video/')) {
                await this.loadVideo(file);
            } else if (file.type.startsWith('image/')) {
                if (file.type === 'image/gif') {
                    await this.loadGif(file);
                } else {
                    await this.loadImage(file);
                }
            }
    
        } catch (error) {
            console.error('处理媒体源失败:', error);
            throw error;
        }
    }

    getFileNameFromUrl(source) {
        if (source.startsWith('http')) {
            const urlParts = source.split(/[#?]/)[0].split('/');
            return decodeURIComponent(urlParts.pop() || 'unknown');
        } else {
            // 处理本地路径
            return source.split(/[\\/]/).pop();
        }
    }

    getMimeTypeFromUrl(source) {
        const ext = source.split('.').pop().toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'mp4': 'video/mp4',
            'webm': 'video/webm'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    async loadGifLibrary() {
        try {

            const basePath = this.scriptPath.substring(0, this.scriptPath.lastIndexOf('/'));
            const libPath = `${basePath}/lib/libgif.js`;
            
            console.log('Loading GIF library from:', libPath); // 调试用
            
            const script = document.createElement('script');
            script.src = libPath;
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = (e) => {
                    console.error('Failed to load GIF library:', e); // 调试用
                    reject(e);
                };
                document.head.appendChild(script);
            });
            
            console.log('GIF library loaded successfully'); // 调试用
            
        } catch (error) {
            console.error('Error loading GIF library:', error);

            return false;
        }
        return true;
    }
    draw(ctx) {
        ctx.save();
        

        this.color = "transparent";
        this.bgcolor = "transparent";

        if (this.properties.backgroundColor !== "transparent") {
            ctx.beginPath();
            const borderRadius = this.properties.borderRadius || 0;
            ctx.roundRect(0, 0, this.size[0], this.size[1], [borderRadius]);
            ctx.fillStyle = this.properties.backgroundColor;
            ctx.fill();
        }
    

        if (this.media) {
            const padding = this.properties.padding || 0;
            const drawWidth = this.size[0] - (padding * 2);
            const drawHeight = this.size[1] - (padding * 2);

            let mediaWidth, mediaHeight;
            if (this.mediaType === 'video') {
                mediaWidth = this.media.videoWidth;
                mediaHeight = this.media.videoHeight;
            } else {
                mediaWidth = this.media.width;
                mediaHeight = this.media.height;
            }

            const mediaRatio = mediaWidth / mediaHeight;
            const nodeRatio = drawWidth / drawHeight;
            let finalWidth = drawWidth;
            let finalHeight = drawHeight;
            let x = padding;
            let y = padding;
    
            if (this.properties.fitMode === "contain") {
                if (mediaRatio > nodeRatio) {
                    finalHeight = drawWidth / mediaRatio;
                    y = padding + (drawHeight - finalHeight) / 2;
                } else {
                    finalWidth = drawHeight * mediaRatio;
                    x = padding + (drawWidth - finalWidth) / 2;
                }
            } else if (this.properties.fitMode === "cover") {
                if (mediaRatio > nodeRatio) {
                    finalWidth = drawHeight * mediaRatio;
                    x = padding + (drawWidth - finalWidth) / 2;
                } else {
                    finalHeight = drawWidth / mediaRatio;
                    y = padding + (drawHeight - finalHeight) / 2;
                }
            }
    
            if (this.properties.flipH || this.properties.flipV) {
                ctx.save();

                ctx.translate(x + finalWidth / 2, y + finalHeight / 2);

                ctx.scale(this.properties.flipH ? -1 : 1, this.properties.flipV ? -1 : 1);

                ctx.translate(-(x + finalWidth / 2), -(y + finalHeight / 2));
            }
        
            // 绘制媒体
            ctx.drawImage(this.media, x, y, finalWidth, finalHeight);
        

            if (this.properties.flipH || this.properties.flipV) {
                ctx.restore();
            }
    

            if (this.mediaType === 'video' || this.mediaType === 'gif') {
                requestAnimationFrame(() => {
                    if (this.graph) {
                        this.graph.setDirtyCanvas(true);
                    }
                });
            }
            if (this.mediaType === 'gif' && this.gifPlayer) {
                requestAnimationFrame(() => {
                    if (this.graph) {
                        this.graph.setDirtyCanvas(true);
                    }
                });
            }

            if (this.mediaType === 'video' && !this.properties.autoplay) {
                // 绘制播放图标
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.beginPath();
                ctx.arc(this.size[0]/2, this.size[1]/2, 20, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#fff";
                ctx.beginPath();
                ctx.moveTo(this.size[0]/2 - 8, this.size[1]/2 - 10);
                ctx.lineTo(this.size[0]/2 - 8, this.size[1]/2 + 10);
                ctx.lineTo(this.size[0]/2 + 8, this.size[1]/2);
                ctx.closePath();
                ctx.fill();
            }
        } else {

            ctx.fillStyle = "#666";
            ctx.font = "14px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("拖放媒体文件到此处", this.size[0] / 2, this.size[1] / 2);
            ctx.font = "12px Arial";
            ctx.fillText("支持图片、GIF和视频", this.size[0] / 2, this.size[1] / 2 + 20);
        }
    
        ctx.restore();
    }

    onDragOver(e, local_pos, canvas) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        
        // 更新拖放状态
        if (!this.isDraggingOver) {
            this.isDraggingOver = true;
            this.graph.setDirtyCanvas(true);
        }
        return true;
    }

    onDragLeave(e) {
        this.isDraggingOver = false;
        this.graph.setDirtyCanvas(true);
    }

    onDragDrop(e, local_pos, canvas) {
        e.preventDefault();
        e.stopPropagation();
        this.isDraggingOver = false;
    
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            const type = file.type.toLowerCase();
    
            if (this.media) {
                if (this.mediaType === 'video') {
                    this.media.pause();
                    URL.revokeObjectURL(this.media.src);
                }
                this.media = null;
            }
    
            if (type.startsWith('video/')) {
                this.loadVideo(file);
            } else if (type.startsWith('image/')) {
                if (type === 'image/gif') {
                    this.loadGif(file);
                } else {
                    this.loadImage(file);
                }
            }
        }
    
        this.graph.setDirtyCanvas(true);
        return true;
    }

    async saveMediaToTemp(file, subfolder = 'image_display') {
        try {

            this.originalFileName = file.name;
    

            const formData = new FormData();
            formData.append('image', file);
            formData.append('type', 'input');  
            formData.append('subfolder', subfolder);
            formData.append('overwrite', 'true');
            
            const response = await api.fetchApi('/upload/image', {
                method: 'POST',
                body: formData
            });
    
            const responseData = await response.json();
            if (responseData?.name) {
                const path = `input/${subfolder}/${responseData.name}`;
                return path;
            }
            return null;
        } catch (error) {
            console.error('保存文件失败:', error);
            return null;
        }
    }

    serialize() {
        const data = super.serialize();
        if (this.media && this.tempFilePath) {

            data.mediaType = this.mediaType;
            data.tempFilePath = this.tempFilePath;
        }
        return data;
    }

    getViewPath(filePath) {
        const filename = filePath.split('/').pop();
        const subfolder = filePath.split('/')[1]; 
        return `/view?filename=${filename}&type=input&subfolder=${subfolder}`; 
    }


    createMediaElement(type, viewPath, autoplay = false, loop = false) {
        switch(type) {
            case 'video':
                const video = document.createElement('video');
                video.autoplay = autoplay;
                video.loop = loop;
                video.muted = true; 
                video.volume = this.properties.volume;
                video.playsInline = true;
                video.src = viewPath;
                return video;
                
            case 'gif':
                const tempImg = document.createElement('img');
                tempImg.src = viewPath;
                return tempImg;
                
            default: // 'image'
                const img = new Image();
                img.src = viewPath;
                return img;
        }
    }

    configure(info) {
        super.configure(info);
        if (!info.mediaType || !info.tempFilePath) return;
        
        this.tempFilePath = info.tempFilePath;
        const viewPath = this.getViewPath(this.tempFilePath);
        
        if (info.mediaType === 'gif') {
            this.handleGif(viewPath);
            return;
        }
        
        const element = this.createMediaElement(
            info.mediaType, 
            viewPath, 
            this.properties.autoplay, 
            this.properties.loop
        );
        
        const loadHandler = info.mediaType === 'video' ? 'onloadedmetadata' : 'onload';
        element[loadHandler] = () => {
            this.media = element;
            this.mediaType = info.mediaType;
            if (info.mediaType === 'video' && this.properties.autoplay) {
                element.play().catch(console.error);
            }
            this.graph?.setDirtyCanvas(true);
        };
        if (this.mediaType === 'video') {
            this.updateAudioSettings();
        }
    }

    async handleGif(viewPath) {
        if (typeof SuperGif === 'undefined') {
            await this.loadGifLibrary();
        }

        const tempImg = this.createMediaElement('gif', viewPath);
        this.gifPlayer = new SuperGif({ 
            gif: tempImg, 
            auto_play: true,
            loop_mode: true
        });

        return new Promise((resolve) => {
            this.gifPlayer.load(() => {
                this.media = this.gifPlayer.get_canvas();
                this.mediaType = 'gif';
                this.graph?.setDirtyCanvas(true);
                resolve();
            });
        });
    }
    async loadMedia(file, type) {
        console.log(`开始加载${type}:`, file.name);
        
        const tempPath = await this.saveMediaToTemp(file);
        if (!tempPath) {
            console.error(`Failed to save ${type}`);
            return;
        }
        
        this.tempFilePath = tempPath;
        const viewPath = this.getViewPath(tempPath);
        console.log('构建的访问路径:', viewPath);
        
        if (type === 'gif') {
            await this.handleGif(viewPath);
            return;
        }
        
        const element = this.createMediaElement(
            type, 
            viewPath, 
            this.properties.autoplay, 
            this.properties.loop
        );
        
        const loadHandler = type === 'video' ? 'onloadedmetadata' : 'onload';
        element[loadHandler] = () => {
            this.media = element;
            this.mediaType = type;
            if (type === 'video' && this.properties.autoplay) {
                element.play().catch(e => console.warn("Video autoplay failed:", e));
            }
            this.graph.setDirtyCanvas(true);
        };
    }


    loadImage(file) { return this.loadMedia(file, 'image'); }
    loadGif(file) { return this.loadMedia(file, 'gif'); }
    updateAudioSettings() {
        if (this.media && this.mediaType === 'video') {
            console.log('更新音频设置，当前音量:', this.properties.volume); 
            this.media.volume = this.properties.volume;
            this.media.muted = false;
        }
    }

    loadVideo(file) {
        return this.loadMedia(file, 'video').then(() => {
            if (this.media) {
                this.media.muted = true;
                this.media.play().then(() => {
                    if (this.properties.volume > 0) {
                        this.media.muted = false;
                        this.media.volume = this.properties.volume;
                    }
                }).catch(console.error);
            }
        });
    }

    clone() {
        const cloned = super.clone();
        
        if (this.mediaType && this.tempFilePath) {
            cloned.mediaType = this.mediaType;
            cloned.tempFilePath = this.tempFilePath;
            
            const viewPath = this.getViewPath(this.tempFilePath);
            
            if (this.mediaType === 'gif') {
                cloned.handleGif(viewPath);
                return cloned;
            }
            
            const element = this.createMediaElement(
                this.mediaType, 
                viewPath, 
                this.properties.autoplay, 
                this.properties.loop
            );
            
            const loadHandler = this.mediaType === 'video' ? 'onloadedmetadata' : 'onload';
            element[loadHandler] = () => {
                cloned.media = element;
                if (this.mediaType === 'video' && cloned.properties.autoplay) {
                    element.play().catch(console.error);
                }
                cloned.graph?.setDirtyCanvas(true);
            };
        }
        
        return cloned;
    }
    

    getExtraMenuOptions(canvas, options) {
        const node = this; 
        const volumeId = `volume-${Date.now()}`;
        const fileInputId = `file-input-${Date.now()}`;
         // 创建隐藏的文件输入框
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = fileInputId;
        fileInput.style.display = 'none';
        fileInput.accept = 'video/*,audio/*,image/*,.gif'; 
        document.body.appendChild(fileInput);
         // 监听文件选择
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
             try {
                // 根据文件类型调用相应的加载方法
                if (file.type.startsWith('video/')) {
                    await this.loadVideo(file);
                } else if (file.type.startsWith('audio/')) {
                    await this.loadMedia(file, 'audio');
                } else if (file.type.startsWith('image/')) {
                    if (file.type === 'image/gif') {
                        await this.loadGif(file);
                    } else {
                        await this.loadImage(file);
                    }
                }
                 canvas.setDirty(true);
            } catch (error) {
                console.error('加载媒体文件失败:', error);
            } finally {
                // 清理文件输入框
                document.body.removeChild(fileInput);
            }
        });
         options.unshift(  // 在开头添加上传选项
            {
                content: "上传媒体文件",
                callback: () => {
                    fileInput.click();
                }
            },
            null,  // 添加分隔线
        );
        options.push(
            {
                content: "水平翻转",
                callback: () => {
                    this.properties.flipH = !this.properties.flipH;
                    canvas.setDirty(true);
                }
            },
            {
                content: "垂直翻转",
                callback: () => {
                    this.properties.flipV = !this.properties.flipV;
                    canvas.setDirty(true);
                }
            },
            null,

            ...(this.mediaType === 'video' ? [
                {
                    content: this.properties.autoplay ? "暂停自动播放" : "启用自动播放",
                    callback: () => {
                        this.properties.autoplay = !this.properties.autoplay;
                        if (this.media) {
                            if (this.properties.autoplay) {
                                this.media.play().catch(e => console.error('播放失败:', e));
                            } else {
                                this.media.pause();
                            }
                            this.media.autoplay = this.properties.autoplay;
                        }
                        canvas.setDirty(true);
                    }
                },
                {
                    content: this.properties.loop ? "禁用循环播放" : "启用循环播放",
                    callback: () => {
                        this.properties.loop = !this.properties.loop;
                        if (this.media) {
                            this.media.loop = this.properties.loop;
                            if (this.properties.loop && this.properties.autoplay) {
                                this.media.play().catch(e => console.error('播放失败:', e));
                            }
                        }
                        canvas.setDirty(true);
                    }
                },
                null,
                {
                    content: `<div style="padding: 5px">
                        <div id="${volumeId}-label">音量: ${Math.round((this.properties.volume || 0) * 100)}%</div>
                        <input type="range" 
                               id="${volumeId}-slider"
                               min="0" 
                               max="1" 
                               step="0.01" 
                               value="${this.properties.volume}" 
                               style="width: 150px"
                               onmousedown="event.stopPropagation()"
                        />
                    </div>`,
                    isHTML: true,
                    callback: () => false
                }
            ] : []),
            null,
            {
                content: "清除媒体",
                callback: () => {
                    // 处理视频媒体
                    if (this.media && this.mediaType === 'video') {
                        this.media.pause();
                        URL.revokeObjectURL(this.media.src);
                    }
                    
                    if (this.properties.mediaSource && this.properties.mediaSource.startsWith('blob:')) {
                        URL.revokeObjectURL(this.properties.mediaSource);
                    }
                    
                    // 重置所有相关属性
                    this.media = null;
                    this.mediaType = null;
                    this.properties.mediaSource = "";  // 清除 URL
                    
                    // 更新显示
                    this.updateContent();
                    canvas.setDirty(true);
                }
            }
        );  
        setTimeout(() => {
            const slider = document.getElementById(`${volumeId}-slider`);
            const label = document.getElementById(`${volumeId}-label`);
            
            if (slider && label) {
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    node.properties.volume = value;
                    if (node.media) {
                        node.media.volume = value;
                        node.media.muted = false;
                    }
                    label.textContent = `音量: ${Math.round(value * 100)}%`;
                    node.graph.setDirtyCanvas(true);
                    e.stopPropagation();
                });
            }
        }, 0);
    }

    onRemoved() {

        if (this.mediaType === 'video' && this.media) {
            this.media.pause();
            URL.revokeObjectURL(this.media.src);
        }

        if (this.mediaType === 'gif') {
            if (this.gifPlayer) {
                // 停止 GIF 播放
                this.gifPlayer.pause();
                this.gifPlayer = null;
            }
        }
        
        this.media = null;
        this.mediaType = null;

        this.isDraggingOver = false;
    }
}


ImageDisplayNode.title_mode = LiteGraph.NO_TITLE;
ImageDisplayNode.collapsable = false;

ImageDisplayNode["@borderRadius"] = { type: "number" };
ImageDisplayNode["@backgroundColor"] = { type: "string" };
ImageDisplayNode["@padding"] = { type: "number" };
ImageDisplayNode["@fitMode"] = { type: "combo", values: ["contain", "cover", "stretch"] };
ImageDisplayNode["@volume"] = { type: "number", default: 0, min: 0, max: 1, step: 0.01 };
const oldDrawNode = LGraphCanvas.prototype.drawNode;
LGraphCanvas.prototype.drawNode = function (node, ctx) {
    if (node instanceof ImageDisplayNode) {
        node.bgcolor = "transparent";
        node.color = "transparent";
        const v = oldDrawNode.apply(this, arguments);
        node.draw(ctx);
        return v;
    }
    return oldDrawNode.apply(this, arguments);
};


app.registerExtension({
    name: "Advertisement",
    registerCustomNodes() {
        ImageDisplayNode.setUp();
    },
});

class MediaPlayerNode extends BaseNode {
    static type = "MediaPlayer";
    static title = "Media Player";
    static category = "🎈LAOGOU";
    static _category = "🎈LAOGOU";
    static comfyClass = "MediaPlayer";
    constructor(title = MediaPlayerNode.title) {
        super(title, MediaPlayerNode.comfyClass); 
        

        this.resizable = true;
        this.size = [320, 240];
        this.isVirtualNode = true;
        this.shape = LiteGraph.ROUND_SHAPE;
        this.serialize_widgets = true;

        this.addProperty("url", "", "string");
        const container = document.createElement('div');
        const inner = document.createElement('div');
        this.inner = inner;
        
        container.append(inner);
        inner.classList.add('media-player-preview');
        
        // 设置容器样式
        container.style.cssText = `
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            background: white;
        `;
        
        inner.style.cssText = `
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            background: #f0f0f0;
        `;

        this.html_widget = this.addDOMWidget('HTML', 'html', container, {
            setValue: () => {},
            getValue: () => {},
            getMinHeight: () => this.size[1],
            onDraw: () => {
                this.html_widget.element.style.pointerEvents = 'all';
            }
        });

        this.color = "#E0E0E0"; 
        this.bgcolor = "#FFFFFF"; 

        this.flags = {
            showTitle: false
        };
        this.onConstructed();
        this.updateContent();
    }
    updateContent() {
        if (!this.inner) return;
        
        let url = this.properties.url;
        if (url && url.trim()) {
            url = url.trim();
            
            if (url.includes('<iframe') || url.includes('<video')) {
                // 嵌入代码只处理 http 到 https 的改
               let secureContent = url.replace(/http:\/\//g, 'https://');
               secureContent = secureContent.replace(/\/\/player\.bilibili\.com/g, 'https://player.bilibili.com');
               
               this.inner.innerHTML = `
                   <div style="
                       width: 100%;
                       height: 100%;
                       display: flex;
                       align-items: center;
                       justify-content: center;
                       background: white;
                       border-radius: 4px;
                   ">
                       ${secureContent}
                   </div>
               `;
                const elements = this.inner.querySelectorAll('iframe, video');
               elements.forEach(element => {
                   if (element.src && element.src.startsWith('http:')) {
                       element.src = element.src.replace('http:', 'https:');
                   }
                   
                   element.style.cssText = `
                       width: 100%;
                       height: 100%;
                       border: none;
                       border-radius: 4px;
                       background: black;
                       max-width: 100%;
                       max-height: 100%;
                   `;
               });
           } else {
               // 只对普通 URL 进行补全
               if (!url.match(/^https?:\/\//)) {
                   url = 'https://' + url;
               }
                let secureUrl = url;
                if (url.startsWith('http:')) {
                    secureUrl = url.replace('http:', 'https:');
                }
                 this.inner.innerHTML = `
                    <iframe 
                        src="${secureUrl}"
                        style="
                            width: 100%;
                            height: 100%;
                            border: none;
                            border-radius: 4px;
                            background: white;
                        "
                        allowfullscreen
                        referrerpolicy="no-referrer"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                    ></iframe>
                `;
            }
        } else {

            this.inner.innerHTML = `
                <div style="
                    padding: 20px;
                    background: white;
                    border-radius: 4px;
                    height: 100%;
                    box-sizing: border-box;
                ">
                    <h3 style="margin: 0 0 10px 0;">Media Player</h3>
                    <div style="color: #666;">
                        支持：<br>
                        1. 网页 URL<br>
                        2. 视频嵌入代码
                    </div>
                </div>
            `;
        }

        const iframes = this.inner.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            iframe.setAttribute('allowfullscreen', '');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.setAttribute('referrerpolicy', 'no-referrer');
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
        });
    }
     onPropertyChanged(name, value) {
        if (name === "url") {
            this.updateContent();
        }
    }
}


MediaPlayerNode.collapsable = false;
app.registerExtension({
   name: "MediaPlayer",
   registerCustomNodes() {
    MediaPlayerNode.setUp();
   }
});