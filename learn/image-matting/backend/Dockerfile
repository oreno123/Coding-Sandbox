# 核心：使用Python 3.10 slim镜像，和PyTorch 2.1.2+cpu完全兼容
FROM python:3.10-slim

# 设置工作目录（后续所有命令都在/app下执行）
WORKDIR /app

# 安装系统依赖（解决ONNX Runtime等库的依赖问题）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件到容器里
COPY requirements.txt .

# 第一步：单独安装PyTorch（指定官方CPU源，避免版本找不到）
RUN pip install --no-cache-dir \
    torch==2.1.2+cpu \
    torchvision==0.16.2+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu

# 第二步：安装其他依赖（用清华源加速，避免下载慢）
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple \
    -r requirements.txt

# 复制所有代码到容器里
COPY . .

# 暴露端口（和启动命令里的PORT对应）
EXPOSE 8000

# 启动命令：用环境变量PORT，适配Render的端口分配
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]